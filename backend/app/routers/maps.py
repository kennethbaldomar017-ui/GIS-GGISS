from uuid import UUID
import json
from pathlib import Path
from shapely.geometry import shape, Point
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..middleware.rbac import get_current_user
from ..models import Alert, Barangay, Child, Purok, User
from ..routers.barangays import feature
from ..services.analytics import latest_measurements, EXCLUDED_BARANGAYS
from ..utils.who_zscore import calculate_prevalence
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


BOUNDARY_FILE = Path(__file__).resolve().parents[1] / "data" / "cabadbaran-boundaries.geojson"
INDICATIVE_BOUNDARIES = {
    feature["properties"]["name"].casefold(): feature["geometry"]
    for feature in json.loads(BOUNDARY_FILE.read_text(encoding="utf-8"))["features"]
}


def barangay_coordinates(barangay: Barangay) -> tuple[float, float] | None:
    """Keep map centers inside their indicative barangay polygon."""
    supplied = BARANGAY_COORDINATES.get(barangay.name)
    geometry = INDICATIVE_BOUNDARIES.get(barangay.name.casefold())
    if geometry:
        polygon = shape(geometry)
        if supplied and polygon.covers(Point(supplied[1], supplied[0])):
            return supplied
        point = polygon.representative_point()
        return point.y, point.x
    return supplied or get_polygon_centroid(barangay.geometry)


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
    Return an illustrative display square at the shared barangay center.
    This is not a surveyed boundary. Child pins keep their recorded coordinates.
    """
    lat = props.get("lat")
    lng = props.get("lng")
    boundary = INDICATIVE_BOUNDARIES.get(b.name.casefold())
    if boundary:
        f = feature(b, {"geometry_source": "namria_indicative_2023", "scatter_geometry": boundary, **props})
        f["geometry"] = boundary
        return f
    f = feature(b, {"geometry_source": "illustrative_extent", **props})
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
        barangay_id = assigned_barangay_id(user)
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


def purok_coordinates(purok, measurements, parent):
    """Resolve one location for both the detailed map and cluster summaries."""
    centroid = get_polygon_centroid(purok.geometry)
    if centroid:
        return (*centroid, "recorded_geometry")
    points = [point for m in measurements
              if (point := child_point(m.child.latitude, m.child.longitude))]
    if points:
        centroid = sanitize_coords(
            sum(p[0] for p in points) / len(points),
            sum(p[1] for p in points) / len(points),
        )
        if centroid:
            return (*centroid, "child_centroid")
    centroid = barangay_coordinates(parent) if parent else None
    return (*centroid, "barangay_fallback") if centroid else (None, None, "unavailable")


def map_statistics(measurements):
    prevalence = calculate_prevalence(measurements)
    severe = sum(m.overall_status.value == "severe_acute_malnutrition" for m in measurements)
    moderate = sum(m.overall_status.value == "moderate_acute_malnutrition" for m in measurements)
    normal = sum(m.overall_status.value == "normal" for m in measurements)
    other = len(measurements) - severe - moderate - normal
    count = severe + moderate
    total = prevalence["sample_size"]
    rate = round(count / total * 100, 1) if total else 0
    return {
        "risk_level": "critical" if rate >= 30 else "high" if rate >= 15 else "low",
        "prevalence_rate": rate,
        "wasting_rate": prevalence["wasting_rate"],
        "stunting_rate": prevalence["stunting_rate"],
        "underweight_rate": prevalence["underweight_rate"],
        "total_children": total, "malnutrition_count": count,
        "moderate_count": moderate, "severe_count": severe,
        "normal_count": normal, "other_count": other,
    }


def barangay_map_feature(barangay, measurements, alert_count):
    centroid = barangay_coordinates(barangay)
    lat, lng = centroid if centroid else (None, None)
    return compact_barangay_feature(barangay, {
        "name": barangay.name, **map_statistics(measurements),
        "alert_count": alert_count, "lat": lat, "lng": lng,
    })


def purok_feature(obj, lat, lng, props):
    """Use a recorded boundary when present; never invent a purok boundary."""
    if get_polygon_centroid(obj.geometry):
        geometry = obj.geometry
    else:
        geometry = {"type": "Point", "coordinates": [lng, lat]} if lat is not None and lng is not None else None
    return {
        "type": "Feature", "geometry": geometry,
        "properties": {"id": str(obj.id), "featureType": "purok",
                       "barangay_id": str(obj.barangay_id), **props},
    }


def assigned_barangay_id(user):
    if user.role.value == "admin" and not user.barangay_id:
        raise HTTPException(403, "User not assigned to a barangay")
    return user.barangay_id if user.role.value == "admin" else None


@router.get("/barangay-boundary")
async def get_barangay_boundary(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role.value != "admin":
        raise HTTPException(403, "Only barangay admins can access this endpoint")
    result = await barangay_choropleth(db=db, user=user)
    parent = next((f for f in result["features"] if f["properties"]["featureType"] == "barangay"), None)
    if not parent:
        raise HTTPException(404, "Barangay not found")
    return parent


@router.get("/barangay-choropleth")
async def barangay_choropleth(barangay_name: str | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    scope = assigned_barangay_id(user)
    query = select(Barangay).order_by(Barangay.name)
    if user.role.value == "admin":
        query = query.where(Barangay.id == scope)
    else:
        query = query.where(Barangay.name.notin_(EXCLUDED_BARANGAYS - {"Concepcion"}))
        if barangay_name:
            query = query.where(Barangay.name == barangay_name)
    barangays = (await db.scalars(query)).all()
    ids = [b.id for b in barangays]
    measurements_by_barangay = {}
    measurements_by_purok = {}
    for measurement in await latest_measurements(db, scope):
        measurements_by_barangay.setdefault(measurement.child.barangay_id, []).append(measurement)
        measurements_by_purok.setdefault(measurement.child.purok_id, []).append(measurement)
    alert_rows = await db.execute(
        select(Child.barangay_id, Child.purok_id, func.count(Alert.id))
        .select_from(Alert).join(Child, Child.id == Alert.child_id)
        .where(Alert.is_resolved.is_(False), Child.barangay_id.in_(ids))
        .group_by(Child.barangay_id, Child.purok_id)
    )
    alert_counts = {}
    purok_alert_counts = {}
    for barangay_id, purok_id, count in alert_rows.all():
        alert_counts[barangay_id] = alert_counts.get(barangay_id, 0) + count
        purok_alert_counts[purok_id] = purok_alert_counts.get(purok_id, 0) + count
    features = [barangay_map_feature(b, measurements_by_barangay.get(b.id, []), alert_counts.get(b.id, 0))
                for b in barangays]
    # A focused superadmin view exposes the same detail as that barangay's admin.
    if user.role.value == "admin" or barangay_name:
        parents = {b.id: b for b in barangays}
        puroks = (await db.scalars(select(Purok).where(
            Purok.barangay_id.in_(ids), Purok.is_archived.is_(False)
        ).order_by(Purok.name))).all()
        for purok in puroks:
            subset = measurements_by_purok.get(purok.id, [])
            lat, lng, source = purok_coordinates(purok, subset, parents.get(purok.barangay_id))
            features.append(purok_feature(purok, lat, lng, {
                "name": purok.name, **map_statistics(subset),
                "alert_count": purok_alert_counts.get(purok.id, 0),
                "lat": lat, "lng": lng, "location_source": source,
            }))
    # Only geographic metadata is shared outside the viewer's clinical scope.
    centers = []
    for barangay in (await db.scalars(select(Barangay).where(
        Barangay.name.notin_(EXCLUDED_BARANGAYS - {"Concepcion"})
    ).order_by(Barangay.name))).all():
        coordinates = barangay_coordinates(barangay)
        if coordinates:
            centers.append({"name": barangay.name, "lat": coordinates[0], "lng": coordinates[1]})
    return {"type": "FeatureCollection", "features": features, "heatmap_centers": centers}


@router.get("/child-markers")
async def child_markers(barangay_id: UUID | None = None, status_filter: str | None = None, show_sam_only: bool = False, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role.value == "admin":
        barangay_id = assigned_barangay_id(user)
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
            "barangay_id": str(c.barangay_id),
            "purok_id": str(c.purok_id) if c.purok_id else None,
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
    scope = assigned_barangay_id(user)
    stmt = select(Purok).where(Purok.is_archived.is_(False)).order_by(Purok.name)
    if scope:
        stmt = stmt.where(Purok.barangay_id == scope)
    parents = {b.id: b for b in (await db.scalars(select(Barangay))).all()}
    by_purok = {}
    for measurement in await latest_measurements(db, scope):
        by_purok.setdefault(measurement.child.purok_id, []).append(measurement)
    rows = []
    for purok in (await db.scalars(stmt)).all():
        subset = by_purok.get(purok.id, [])
        lat, lng, source = purok_coordinates(purok, subset, parents.get(purok.barangay_id))
        stats = map_statistics(subset)
        rows.append({
            "purok_id": str(purok.id), "name": purok.name,
            "centroid_lat": lat, "centroid_lng": lng, "location_source": source,
            "child_count": stats["total_children"],
            "malnutrition_count": stats["malnutrition_count"],
            "prevalence_rate": stats["prevalence_rate"], "risk_level": stats["risk_level"],
        })
    return rows


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
