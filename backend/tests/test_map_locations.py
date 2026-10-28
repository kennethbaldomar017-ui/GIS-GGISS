import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
from app.routers.maps import (
    BUTUAN_DEFAULT_COORDS, assigned_barangay_id, map_statistics,
    purok_coordinates, purok_feature,
)


class MapLocationTests(unittest.TestCase):
    def setUp(self):
        self.parent = SimpleNamespace(name="Tolosa", geometry=None)
        self.purok = SimpleNamespace(id=uuid4(), barangay_id=uuid4(), geometry=None)

    def measurement(self, lat, lng, status="normal"):
        return SimpleNamespace(child=SimpleNamespace(latitude=lat, longitude=lng),
                               overall_status=SimpleNamespace(value=status),
                               haz_status="normal", whz_status="normal", waz_status="normal")

    def test_missing_boundary_uses_point_at_shared_parent_center(self):
        lat, lng, source = purok_coordinates(self.purok, [], self.parent)
        self.assertEqual((lat, lng, source), (9.1175, 125.5255, "barangay_fallback"))
        feature = purok_feature(self.purok, lat, lng, {})
        self.assertEqual(feature["geometry"], {"type": "Point", "coordinates": [lng, lat]})

    def test_child_centroid_ignores_import_default_and_missing_coords(self):
        measurements = [self.measurement(*BUTUAN_DEFAULT_COORDS), self.measurement(None, None),
                        self.measurement(9.116, 125.524), self.measurement(9.118, 125.526)]
        lat, lng, source = purok_coordinates(self.purok, measurements, self.parent)
        self.assertAlmostEqual(lat, 9.117)
        self.assertAlmostEqual(lng, 125.525)
        self.assertEqual(source, "child_centroid")

    def test_recorded_multipolygon_is_preserved_and_drives_center(self):
        self.purok.geometry = {"type": "MultiPolygon", "coordinates": [[[
            [125.52, 9.11], [125.53, 9.11], [125.53, 9.12],
            [125.52, 9.12], [125.52, 9.11],
        ]]]}
        lat, lng, source = purok_coordinates(self.purok, [self.measurement(9.15, 125.6)], self.parent)
        self.assertAlmostEqual(lat, 9.115, places=5)
        self.assertAlmostEqual(lng, 125.525, places=5)
        self.assertEqual(source, "recorded_geometry")
        self.assertEqual(purok_feature(self.purok, lat, lng, {})["geometry"], self.purok.geometry)

    def test_unknown_location_does_not_invent_a_city_center(self):
        unknown = SimpleNamespace(name="Unknown", geometry=None)
        self.assertEqual(purok_coordinates(self.purok, [], unknown), (None, None, "unavailable"))
        self.assertIsNone(purok_feature(self.purok, None, None, {})["geometry"])

    def test_unassigned_admin_cannot_fall_back_to_city_scope(self):
        with self.assertRaises(HTTPException) as error:
            assigned_barangay_id(SimpleNamespace(role=SimpleNamespace(value="admin"), barangay_id=None))
        self.assertEqual(error.exception.status_code, 403)

    def test_empty_statistics_have_same_zero_values_for_every_consumer(self):
        stats = map_statistics([])
        self.assertEqual(stats["malnutrition_count"], 0)
        self.assertEqual(stats["prevalence_rate"], 0)
        self.assertEqual(stats["risk_level"], "low")

    def test_overweight_is_not_counted_as_acute_malnutrition(self):
        stats = map_statistics([
            self.measurement(9.117, 125.525, status) for status in (
                "severe_acute_malnutrition", "moderate_acute_malnutrition", "normal", "overweight",
            )
        ])
        self.assertEqual(stats["total_children"], 4)
        self.assertEqual(stats["malnutrition_count"], 2)
        self.assertEqual(stats["prevalence_rate"], 50.0)
        self.assertEqual(stats["risk_level"], "critical")


if __name__ == "__main__":
    unittest.main()
