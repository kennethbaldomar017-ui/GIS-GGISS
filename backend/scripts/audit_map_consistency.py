"""Read-only audit of map parity across all barangays and user roles.

Run from backend: ../.venv/Scripts/python.exe scripts/audit_map_consistency.py
No account credentials, sign-ins, or database writes are involved.
"""
import asyncio
import contextlib
import io
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, text
from shapely.geometry import shape, Point
from app.database import AsyncSessionLocal, engine
from app.models import Barangay
from app.routers.maps import (
    barangay_choropleth, child_markers, cluster_summary,
    get_barangay_boundary, heatmap_points,
)


def viewer(role, barangay_id=None):
    return SimpleNamespace(role=SimpleNamespace(value=role), barangay_id=barangay_id)


async def audit():
    report = {"barangays": [], "failures": []}
    superadmin = viewer("super_admin")
    async with AsyncSessionLocal() as db:
        await db.execute(text("PRAGMA query_only=ON"))
        city = await barangay_choropleth(db=db, user=superadmin)
        report["heatmap"] = {
            "centers": city["heatmap_centers"],
            "observations": [{key: feature["properties"][key] for key in (
                "name", "lat", "lng", "malnutrition_count", "total_children",
                "normal_count", "moderate_count", "severe_count", "other_count", "scatter_geometry",
            )} for feature in city["features"]],
        }
        city_features = {f["properties"]["id"]: f for f in city["features"]}
        city_clusters = {r["purok_id"]: r for r in await cluster_summary(db=db, user=superadmin)}
        all_markers = await child_markers(db=db, user=superadmin)
        for barangay in (await db.scalars(select(Barangay).order_by(Barangay.name))).all():
            admin = viewer("admin", barangay.id)
            detail = await barangay_choropleth(db=db, user=admin)
            focused = await barangay_choropleth(barangay_name=barangay.name, db=db, user=superadmin)
            # Even a different name in the URL must not change an admin's assignment.
            alternate = await barangay_choropleth(barangay_name="Other barangay", db=db, user=admin)
            parent = next((f for f in detail["features"] if f["properties"]["featureType"] == "barangay"), None)
            checks = {
                "parent_matches_city": parent == city_features.get(str(barangay.id)),
                "indicative_outline_contains_map_center": parent is not None and shape(parent["properties"]["scatter_geometry"]).covers(
                    Point(parent["properties"]["lng"], parent["properties"]["lat"])
                ),
                "focused_view_matches_admin": detail == focused,
                "admin_scope_preserved": detail == alternate,
                "boundary_matches_map": parent == await get_barangay_boundary(db=db, user=admin),
                "status_counts_balance": parent is not None and sum(parent["properties"][key] for key in ("normal_count", "moderate_count", "severe_count", "other_count")) == parent["properties"]["total_children"],
                "heatmap_coverage_matches_city": detail["heatmap_centers"] == city["heatmap_centers"],
                "heatmap_centers_contain_no_clinical_data": all(
                    set(center) == {"name", "lat", "lng"} for center in detail["heatmap_centers"]
                ),
            }
            clusters = {r["purok_id"]: r for r in await cluster_summary(db=db, user=admin)}
            checks["clusters_match_city"] = all(row == city_clusters.get(pid) for pid, row in clusters.items())
            checks["clusters_match_detail"] = True
            checks["no_invented_purok_boundaries"] = True
            for feature in detail["features"]:
                props = feature["properties"]
                if props["featureType"] != "purok":
                    continue
                cluster = clusters.get(props["id"], {})
                if props["location_source"] != "recorded_geometry":
                    checks["no_invented_purok_boundaries"] &= (
                        feature["geometry"] is None or feature["geometry"]["type"] == "Point"
                    )
                checks["clusters_match_detail"] &= all((
                    props["lat"] == cluster.get("centroid_lat"),
                    props["lng"] == cluster.get("centroid_lng"),
                    props["malnutrition_count"] == cluster.get("malnutrition_count"),
                    props["prevalence_rate"] == cluster.get("prevalence_rate"),
                    props["risk_level"] == cluster.get("risk_level"),
                    props["location_source"] == cluster.get("location_source"),
                ))
            markers = await child_markers(db=db, user=admin)
            expected = [m for m in all_markers if m["barangay_id"] == str(barangay.id)]
            checks["child_markers_match_city"] = sorted(markers, key=lambda m: m["id"]) == sorted(expected, key=lambda m: m["id"])
            checks["heatmap_points_match"] = (
                await heatmap_points(db=db, user=admin)
                == await heatmap_points(barangay_id=barangay.id, db=db, user=superadmin)
            )
            row = {"name": barangay.name, "checks": checks, "puroks": len(clusters), "mapped_children": len(markers)}
            report["barangays"].append(row)
            report["failures"].extend(f"{barangay.name}: {check}" for check, passed in checks.items() if not passed)
    await engine.dispose()
    report["summary"] = {
        "barangays": len(report["barangays"]),
        "puroks": sum(r["puroks"] for r in report["barangays"]),
        "checks": sum(len(r["checks"]) for r in report["barangays"]),
        "failures": len(report["failures"]),
    }
    return report


if __name__ == "__main__":
    with contextlib.redirect_stdout(io.StringIO()):
        result = asyncio.run(audit())
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result["summary"]))
    for failure in result["failures"]:
        print(failure)
    raise SystemExit(bool(result["failures"]))
