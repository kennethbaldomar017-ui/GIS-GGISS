from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..middleware.rbac import get_current_user
from ..models import Alert, Barangay, Child, Measurement, Purok, User
from ..routers.barangays import feature
from ..services.analytics import latest_measurements, EXCLUDED_BARANGAYS
from ..utils.who_zscore import calculate_prevalence, classify_risk_level
from sqlalchemy.orm import selectinload
from ..routers.children import age_months


router = APIRouter(prefix="/api/maps", tags=["maps"])


# Default coordinates used by imported seed data (Butuan City center). These
# are NOT valid Cabadbaran locations and must never be used for mapping/centroids.
BUTUAN_DEFAULT_COORDS = (8.9483, 125.5282)

BARANGAY_COORDINATES = {
    "Antonio Luna": (9.0827, 125.5911),
    "Bay-ang": (9.1041, 125.5773),
    "Bayabas": (9.1455, 125.5937),
    "Caasinan": (9.1362, 125.5236),
    "Cabinet": (9.1245, 125.5268),
    "Calamba": (9.0985, 125.6006),
    "Calibunan": (9.1057, 125.5338),
    "Comagascas": (9.1350, 125.5587),
    "Concepcion": (9.1807, 125.5822),
    "Del Pilar": (9.1513, 125.5840),
    "Katugasan": (9.1313, 125.5837),
    "Kauswagan": (9.1299, 125.5309),
    "La Union": (9.0986, 125.5518),
    "Mabini": (9.1129, 125.5523),
    "Mahaba": (9.1171, 125.6329),
    "Puting Bato": (9.1263, 125.6368),
    "Sanghan": (9.0878, 125.5709),
    "Soriano": (9.0967, 125.5684),
    "Tolosa": (9.1175, 125.5255),
    "Poblacion 1": (9.1232, 125.5330),
    "Poblacion 2": (9.1238, 125.5337),
    "Poblacion 3": (9.1233, 125.5297),
    "Poblacion 4": (9.1194, 125.5325),
    "Poblacion 5": (9.1189, 125.5338),
    "Poblacion 6": (9.1206, 125.5339),
    "Poblacion 7": (9.1250, 125.5373),
    "Poblacion 8": (9.1229, 125.5361),
    "Poblacion 9": (9.1227, 125.5420),
    "Poblacion 10": (9.1206, 125.5367),
    "Poblacion 11": (9.1182, 125.5354),
    "Poblacion 12": (9.1178, 125.5410),
}


def barangay_coordinates(barangay: Barangay) -> tuple[float, float] | None:
    """Return supplied authoritative coordinates, falling back to geometry."""
    return BARANGAY_COORDINATES.get(barangay.name) or get_polygon_centroid(barangay.geometry)


def child_point(lat, lng):
    """
    Child coordinates as a valid (lat, lng) pair, or None.

    Wraps sanitize_coords and additionally rejects the known seed-data
    default coordinate so clusters/markers never land outside Cabadbaran.
    """
    coords = sanitize_coords(lat, lng)
    if coords is None:
        return None
    if abs(coords[0] - BUTUAN_DEFAULT_COORDS[0]) < 1e-6 and abs(coords[1] - BUTUAN_DEFAULT_COORDS[1]) < 1e-6:
        return None
    return coords


def sanitize_coords(lat, lng):
    """
    Validate and normalize a latitude/longitude pair.

    Handles missing, invalid, and reversed coordinates safely:
    - Returns None when either coordinate is missing, non-numeric, or zero.
    - Swaps lat/lng when they were recorded in reversed order.
    - Enforces valid world ranges (lat: -90..90, lng: -180..180).

    Returns a (lat, lng) tuple of floats when valid, otherwise None.
    """
    if lat is None or lng is None:
        return None
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return None
    if lat == 0.0 or lng == 0.0:
        return None
    # Detect reversed coordinates: one value looks like a longitude while the
    # other looks like a latitude (e.g. latitude stored as 125.56, longitude as 9.12).
    if -90 <= lng <= 90 and not (-90 <= lat <= 90):
        lat, lng = lng, lat
    if -90 <= lat <= 90 and -180 <= lng <= 180:
        return (lat, lng)
    return None


def get_polygon_centroid(geometry: dict) -> tuple[float, float] | None:
    """Calculate an area-weighted centroid from GeoJSON Polygon/MultiPolygon geometry."""
    if not geometry:
        return None
    if geometry.get("type") == "Polygon":
        polygons = [geometry.get("coordinates") or []]
    elif geometry.get("type") == "MultiPolygon":
        polygons = geometry.get("coordinates") or []
    else:
        return None

    total_area = 0.0
    total_lng = 0.0
    total_lat = 0.0
    for polygon in polygons:
        ring = polygon[0] if polygon else []
        if len(ring) < 3:
            continue
        area_twice = 0.0
        centroid_lng = 0.0
        centroid_lat = 0.0
        for index, (lng_a, lat_a) in enumerate(ring[:-1]):
            lng_b, lat_b = ring[index + 1]
            cross = lng_a * lat_b - lng_b * lat_a
            area_twice += cross
            centroid_lng += (lng_a + lng_b) * cross
            centroid_lat += (lat_a + lat_b) * cross
        if abs(area_twice) < 1e-12:
            continue
        area = abs(area_twice) / 2
        total_area += area
        total_lng += (centroid_lng / (3 * area_twice)) * area
        total_lat += (centroid_lat / (3 * area_twice)) * area

    if total_area == 0:
        return None
    return sanitize_coords(total_lat / total_area, total_lng / total_area)


# Half-size (degrees) of the small square drawn around each barangay centroid.
# Barangay centroids are ~0.003 deg apart in the Poblacion grid, so squares must
# be smaller than that or neighbouring boundaries overlap on the map.
BARANGAY_SQUARE_HALF = 0.00125


def compact_barangay_feature(b, props):
    """
    Barangay GeoJSON feature whose boundary is a small square around its
    centroid. The square hugs the child marker pins so boundaries never
    overlap neighbouring barangays. Pins themselves keep their real coords.
    """
    lat = props.get("lat")
    lng = props.get("lng")
    f = feature(b, props)
    if lat is None or lng is None:
        return f
    h = BARANGAY_SQUARE_HALF
    f["geometry"] = {
        "type": "MultiPolygon",
        "coordinates": [[[
            [lng - h, lat - h], [lng + h, lat - h],
            [lng + h, lat + h], [lng - h, lat + h],
            [lng - h, lat - h],
        ]]],
    }
    return f


@router.get("/heatmap-points")
async def heatmap_points(barangay_id: UUID | None = None, indicator: str = "wasting", db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role.value == "admin":
        barangay_id = user.barangay_id
    rows = await latest_measurements(db, barangay_id)
    points = []
    for m in rows:
        coords = child_point(m.child.latitude, m.child.longitude)
        if coords is None:
            continue
        status = {"wasting": m.whz_status.value, "stunting": m.haz_status.value, "underweight": m.waz_status.value}.get(indicator, m.whz_status.value)
        intensity = 1.0 if status.startswith("severely") else 0.6 if status in {"wasted", "stunted", "underweight"} else 0
        points.append({"lat": coords[0], "lng": coords[1], "intensity": intensity})
    return points


def purok_feature(obj, lat: float, lng: float, props: dict):
    """Create a feature for a purok, using actual geometry if available"""
    # Priority 1: Use actual purok geometry if available
    if obj.geometry and obj.geometry.get("type") == "Polygon":
        return {
            "type": "Feature", 
            "geometry": obj.geometry, 
            "properties": {"id": str(obj.id), "featureType": "purok", **props}
        }
    
    # Priority 2: Create a small square marker around the centroid for puroks without geometry
    hw = 0.003  # Small square for visual marker
    hh = 0.003
    geometry = {
        "type": "Polygon",
        "coordinates": [[[
            lng - hw, lat - hh
        ], [
            lng + hw, lat - hh
        ], [
            lng + hw, lat + hh
        ], [
            lng - hw, lat + hh
        ], [
            lng - hw, lat - hh
        ]]]
    }
    return {"type": "Feature", "geometry": geometry, "properties": {"id": str(obj.id), "featureType": "purok", **props}}


@router.get("/barangay-boundary")
async def get_barangay_boundary(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Get the boundary polygon of the admin's assigned barangay.
    Only for barangay admins - returns their barangay boundary for map display.
    """
    if user.role.value != "admin":
        return {"error": "Only barangay admins can access this endpoint"}
    
    if not user.barangay_id:
        return {"error": "User not assigned to a barangay"}
    
    # Get the barangay
    barangay = await db.get(Barangay, user.barangay_id)
    
    if not barangay:
        return {"error": "Barangay not found"}
    
    # Get measurements for statistics
    measurements = await latest_measurements(db, user.barangay_id)
    prevalence = calculate_prevalence(measurements)
    
    severe_count = sum(1 for m in measurements if m.overall_status.value == "severe_acute_malnutrition")
    moderate_count = sum(1 for m in measurements if m.overall_status.value == "moderate_acute_malnutrition")
    malnutrition_count = severe_count + moderate_count
    total_children = prevalence["sample_size"]
    malnutrition_rate = round((malnutrition_count / total_children * 100), 1) if total_children else 0
    
    # Determine risk level
    if malnutrition_rate >= 30:
        risk_level = "critical"
    elif malnutrition_rate >= 15:
        risk_level = "high"
    else:
        risk_level = "low"
    
    # Get centroid
    centroid = barangay_coordinates(barangay)
    lat, lng = centroid if centroid else (None, None)
    
    # Return barangay boundary as GeoJSON feature
    return {
        "type": "Feature",
        "geometry": barangay.geometry if barangay.geometry else None,
        "properties": {
            "id": str(barangay.id),
            "name": barangay.name,
            "risk_level": risk_level,
            "prevalence_rate": malnutrition_rate,
            "wasting_rate": prevalence["wasting_rate"],
            "stunting_rate": prevalence["stunting_rate"],
            "underweight_rate": prevalence["underweight_rate"],
            "total_children": total_children,
            "malnutrition_count": malnutrition_count,
            "moderate_count": moderate_count,
            "severe_count": severe_count,
            "lat": lat,
            "lng": lng,
        }
    }


@router.get("/barangay-choropleth")
async def barangay_choropleth(barangay_name: str | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    features = []
    if user.role.value == "super_admin":
        # Exclude barangays not part of Cabadbaran City (e.g. Concepcion)
        map_excluded_barangays = EXCLUDED_BARANGAYS - {"Concepcion"}
        query = select(Barangay).where(Barangay.name.notin_(map_excluded_barangays)).order_by(Barangay.name)
        
        # If a specific barangay is requested, filter to it
        if barangay_name:
            query = query.where(Barangay.name == barangay_name)
        
        barangays = (await db.scalars(query)).all()
        
        # OPTIMIZATION: Fetch all latest measurements in ONE query (not per-barangay loop)
        all_measurements = await latest_measurements(db, None)  # No barangay filter = all
        measurements_by_barangay = {}
        for m in all_measurements:
            b_id = m.child.barangay_id
            if b_id not in measurements_by_barangay:
                measurements_by_barangay[b_id] = []
            measurements_by_barangay[b_id].append(m)
        
        # OPTIMIZATION: Batch query alert counts (not per-barangay queries)
        alert_counts_stmt = (
            select(Child.barangay_id, func.count(Alert.id).label("alert_count"))
            .select_from(Alert)
            .join(Child, Child.id == Alert.child_id)
            .where(Alert.is_resolved.is_(False))
            .group_by(Child.barangay_id)
        )
        alert_counts_rows = await db.execute(alert_counts_stmt)
        alert_counts_map = {row[0]: row[1] for row in alert_counts_rows}
        
        for b in barangays:
            # Use pre-fetched measurements
            measurements = measurements_by_barangay.get(b.id, [])
            prevalence = calculate_prevalence(measurements)
            severe_count = sum(1 for m in measurements if m.overall_status.value == "severe_acute_malnutrition")
            moderate_count = sum(1 for m in measurements if m.overall_status.value == "moderate_acute_malnutrition")
            malnutrition_count = severe_count + moderate_count
            total_children = prevalence["sample_size"]
            malnutrition_rate = round((malnutrition_count / total_children * 100), 1) if total_children else 0
            
            # Hotspot Detection Thresholds for Map Visualization
            # High Risk (Red): ≥ 30%
            # Medium Risk (Yellow): 15-29%
            # Low Risk (Green): < 15%
            if malnutrition_rate >= 30:
                risk_level = "critical"  # Red on map
            elif malnutrition_rate >= 15:
                risk_level = "high"  # Yellow on map
            else:
                risk_level = "low"  # Green on map
            
            # Use pre-fetched alert counts
            alert_count = alert_counts_map.get(b.id, 0)
            
            # Use centroid coordinates for static markers on maps
            centroid = barangay_coordinates(b)
            lat, lng = centroid if centroid else (None, None)
                
            features.append(compact_barangay_feature(b, {
                "name": b.name,
                "risk_level": risk_level,
                "prevalence_rate": malnutrition_rate,
                "wasting_rate": prevalence["wasting_rate"],
                "total_children": total_children,
                "malnutrition_count": malnutrition_count,
                "moderate_count": moderate_count,
                "severe_count": severe_count,
                "alert_count": alert_count,
                "lat": lat,
                "lng": lng,
            }))
    elif user.role.value == "admin":
        # Get parent barangay for boundary display
        parent_brgy = await db.get(Barangay, user.barangay_id)
        fallback_lat, fallback_lng = None, None
        
        # Add the barangay boundary as a feature so admin sees their barangay polygon
        if parent_brgy and parent_brgy.geometry:
            # Get barangay measurements for stats
            measurements = await latest_measurements(db, user.barangay_id)
            prevalence = calculate_prevalence(measurements)
            severe_count = sum(1 for m in measurements if m.overall_status.value == "severe_acute_malnutrition")
            moderate_count = sum(1 for m in measurements if m.overall_status.value == "moderate_acute_malnutrition")
            malnutrition_count = severe_count + moderate_count
            total_children = prevalence["sample_size"]
            malnutrition_rate = round((malnutrition_count / total_children * 100), 1) if total_children else 0
            
            if malnutrition_rate >= 30:
                risk_level = "critical"
            elif malnutrition_rate >= 15:
                risk_level = "high"
            else:
                risk_level = "low"
            
            # Get barangay center coordinates
            centroid = barangay_coordinates(parent_brgy)
            if centroid:
                fallback_lat, fallback_lng = centroid
            
            # Add barangay boundary feature
            features.append(compact_barangay_feature(parent_brgy, {
                "name": parent_brgy.name,
                "risk_level": risk_level,
                "prevalence_rate": malnutrition_rate,
                "wasting_rate": prevalence["wasting_rate"],
                "total_children": total_children,
                "malnutrition_count": malnutrition_count,
                "moderate_count": moderate_count,
                "severe_count": severe_count,
                "alert_count": 0,
                "lat": fallback_lat,
                "lng": fallback_lng,
            }))
        
        # Get puroks
        puroks = (await db.scalars(select(Purok).where(Purok.barangay_id == user.barangay_id).order_by(Purok.name))).all()
        measurements = await latest_measurements(db, user.barangay_id)
        
        for p in puroks:
            subset = [m for m in measurements if m.child.purok_id == p.id]
            prevalence = calculate_prevalence(subset)
            severe_count = sum(1 for m in subset if m.overall_status.value == "severe_acute_malnutrition")
            moderate_count = sum(1 for m in subset if m.overall_status.value == "moderate_acute_malnutrition")
            malnutrition_count = severe_count + moderate_count
            total_children = prevalence["sample_size"]
            malnutrition_rate = round((malnutrition_count / total_children * 100), 1) if total_children else 0
            
            # Hotspot Detection Thresholds for Map Visualization
            # High Risk (Red): ≥ 30%
            # Medium Risk (Yellow): 15-29%
            # Low Risk (Green): < 15%
            if malnutrition_rate >= 30:
                risk_level = "critical"  # Red on map
            elif malnutrition_rate >= 15:
                risk_level = "high"  # Yellow on map
            else:
                risk_level = "low"  # Green on map
            
            # Priority 1: Get centroid from child measurements (most accurate)
            p_lat, p_lng = fallback_lat, fallback_lng
            child_coords = [child_point(m.child.latitude, m.child.longitude) for m in subset]
            child_coords = [c for c in child_coords if c]
            if child_coords:
                lats = [c[0] for c in child_coords]
                lngs = [c[1] for c in child_coords]
                centroid = sanitize_coords(sum(lats) / len(lats), sum(lngs) / len(lngs))
                if centroid:
                    p_lat, p_lng = centroid
            # Priority 2: Get centroid from purok geometry (fallback)
            if (p_lat, p_lng) == (fallback_lat, fallback_lng) and p.geometry:
                centroid = get_polygon_centroid(p.geometry)
                if centroid:
                    p_lat, p_lng = centroid
                
            features.append(purok_feature(p, p_lat, p_lng, {
                "name": p.name,
                "risk_level": risk_level,
                "prevalence_rate": malnutrition_rate,
                "wasting_rate": prevalence["wasting_rate"],
                "total_children": total_children,
                "malnutrition_count": malnutrition_count,
                "moderate_count": moderate_count,
                "severe_count": severe_count,
                "alert_count": 0,
                "lat": p_lat,
                "lng": p_lng,
            }))
    return {"type": "FeatureCollection", "features": features}


@router.get("/child-markers")
async def child_markers(barangay_id: UUID | None = None, status_filter: str | None = None, show_sam_only: bool = False, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role.value == "admin":
        barangay_id = user.barangay_id
    stmt = (
        select(Child)
        .options(selectinload(Child.measurements))
        .join(Barangay, Barangay.id == Child.barangay_id)
        .where(Child.is_active.is_(True))
        .where(Barangay.name.notin_(EXCLUDED_BARANGAYS))
    )
    if barangay_id:
        stmt = stmt.where(Child.barangay_id == barangay_id)
    children = (await db.scalars(stmt)).all()
    out = []
    for c in children:
        latest = sorted(c.measurements, key=lambda m: m.measurement_date, reverse=True)[0] if c.measurements else None
        status = latest.overall_status.value if latest else "normal"
        if show_sam_only and status != "severe_acute_malnutrition":
            continue
        if status_filter and status != status_filter:
            continue
        coords = child_point(c.latitude, c.longitude)
        if coords is None:
            continue
        out.append({
            "id": str(c.id),
            "name": c.full_name,
            "lat": coords[0],
            "lng": coords[1],
            "overall_status": status,
            "age_months": latest.age_in_months if latest else age_months(c.birth_date),
            "last_measured": latest.measurement_date if latest else None
        })
    return out


@router.get("/cluster-summary")
async def cluster_summary(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Purok)
    if user.role.value == "admin":
        stmt = stmt.where(Purok.barangay_id == user.barangay_id)
    rows = []

    # Barangay-level fallback centroid for admin users
    fallback_lat, fallback_lng = 9.118, 125.565
    if user.role.value == "admin" and user.barangay_id:
        parent_brgy = await db.get(Barangay, user.barangay_id)
        if parent_brgy:
            centroid = get_polygon_centroid(parent_brgy.geometry)
            if centroid:
                fallback_lat, fallback_lng = centroid

    measurements = await latest_measurements(db, user.barangay_id if user.role.value == "admin" else None)
    for p in (await db.scalars(stmt)).all():
        subset = [m for m in measurements if m.child.purok_id == p.id]
        prevalence = calculate_prevalence(subset)

        # Priority 1: average of child measurement coordinates (most accurate)
        centroid_lat, centroid_lng = fallback_lat, fallback_lng
        child_coords = [c for c in (child_point(m.child.latitude, m.child.longitude) for m in subset) if c]
        if child_coords:
            lats = [c[0] for c in child_coords]
            lngs = [c[1] for c in child_coords]
            centroid = sanitize_coords(sum(lats) / len(lats), sum(lngs) / len(lngs))
            if centroid:
                centroid_lat, centroid_lng = centroid
        # Priority 2: purok geometry centroid (fallback)
        if (centroid_lat, centroid_lng) == (fallback_lat, fallback_lng) and p.geometry:
            centroid = get_polygon_centroid(p.geometry)
            if centroid:
                centroid_lat, centroid_lng = centroid

        rows.append({"purok_id": str(p.id), "name": p.name, "centroid_lat": centroid_lat, "centroid_lng": centroid_lng, "child_count": len(subset), "malnutrition_count": sum(1 for m in subset if m.overall_status.value != "normal"), "prevalence_rate": prevalence["wasting_rate"], "risk_level": classify_risk_level(prevalence)})
    return rows



# ─── GIS ACCURACY ENDPOINTS ────────────────────────────────────────────────────

@router.get("/accuracy/{barangay_id}")
async def get_accuracy(
    barangay_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get latest GIS accuracy for a barangay"""
    from ..services.accuracy import get_latest_accuracy
    
    accuracy = await get_latest_accuracy(db, barangay_id)
    
    if not accuracy:
        return {
            "accuracy_pct": 0,
            "is_reliable": False,
            "message": "No accuracy data available - please verify children count"
        }
    
    return accuracy


@router.get("/accuracy-history/{barangay_id}")
async def get_accuracy_history(
    barangay_id: UUID,
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get accuracy history for a barangay"""
    from ..services.accuracy import get_accuracy_history
    
    history = await get_accuracy_history(db, barangay_id, limit)
    return {"barangay_id": str(barangay_id), "history": history}


@router.get("/accuracy-all")
async def get_all_accuracy(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get latest accuracy for all barangays (super admin only)"""
    from ..services.accuracy import get_all_barangay_accuracy
    
    if user.role.value != "super_admin":
        return {"error": "Only super admin can view all accuracies"}
    
    accuracies = await get_all_barangay_accuracy(db)
    return {"total": len(accuracies), "accuracies": accuracies}


@router.post("/verify-children/{barangay_id}")
async def verify_children_count(
    barangay_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Mark verified count for barangay and calculate accuracy.
    Super admin only.
    
    Request body:
    {
        "verified_count": 150,
        "notes": "Verified on 2026-06-28 by admin"
    }
    """
    from ..services.accuracy import calculate_accuracy
    from datetime import date
    
    # Only super admin can verify
    if user.role.value != "super_admin":
        return {"error": "Only super admin can verify children count"}
    
    verified_count = int(body.get("verified_count", 0))
    notes = body.get("notes", "")
    
    if verified_count <= 0:
        return {"error": "verified_count must be greater than 0"}
    
    try:
        # Calculate and store accuracy
        accuracy = await calculate_accuracy(
            db,
            barangay_id,
            date.today(),
            verified_count,
            created_by_user_id=user.id,
            notes=notes
        )
        
        return {
            "success": True,
            "data": accuracy
        }
    except Exception as e:
        return {
            "error": f"Failed to verify: {str(e)}"
        }
