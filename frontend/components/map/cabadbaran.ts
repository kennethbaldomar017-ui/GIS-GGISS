import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

// ─── Center & Bounds ──────────────────────────────────────────────────────────
// Centered on Cabadbaran City proper (OSM-derived)
export const CABADBARAN_CENTER: LatLngExpression = [9.118, 125.565];

// Tight bounds covering all 31 barangays (derived from OSM coordinates)
export const CABADBARAN_BOUNDS: LatLngBoundsExpression = [
  [9.07,  125.51],  // SW
  [9.20,  125.65],  // NE
];

// Barangays NOT part of Cabadbaran City — excluded from all map/heatmap displays
export const EXCLUDED_BARANGAY_NAMES = new Set<string>();

export const CABADBARAN_MAP_OPTIONS = {
  center: CABADBARAN_CENTER,
  maxBounds: CABADBARAN_BOUNDS,
  maxBoundsViscosity: 1.0,
  minZoom: 12,
  zoom: 13,
  zoomControl: true,
  zoomAnimation: false,
  fadeAnimation: false,
  markerZoomAnimation: false,
};

// ─── Mask — dark overlay that covers EVERYTHING outside the city ──────────────
export const CABADBARAN_MASK: LatLngExpression[][] = [
  // Outer ring: covers whole world
  [[-90, -180], [90, -180], [90, 180], [-90, 180], [-90, -180]],
  // Inner hole: only this rectangle is left clear = Cabadbaran City bounds
  [
    [9.07,  125.51],
    [9.07,  125.65],
    [9.20,  125.65],
    [9.20,  125.51],
    [9.07,  125.51],
  ],
];

// ─── Map class ────────────────────────────────────────────────────────────────
export const CABADBARAN_MAP_CLASS =
  "h-full w-full rounded-lg border border-slate-200 shadow-sm";

// ─── Tile Layers ──────────────────────────────────────────────────────────────
export const TILE_LAYERS = {
  Default: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  Streets: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  Terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; OpenTopoMap (CC-BY-SA)",
  },
  Satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri — Source: Esri, Maxar, GeoEye, Earthstar Geographics",
  },
  Dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  Light: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  Heatmap: {
    url: "", // Special layer - no static URL
    attribution: "Malnutrition Heatmap (Real-time)",
  },
} as const;

// ─── Street Labels Overlay (for Satellite + Streets hybrid) ──────────────────
export const STREET_LABELS_OVERLAY = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  attribution: "Labels &copy; Esri",
};

export type TileLayerKey = keyof typeof TILE_LAYERS;

// ─── Authoritative Barangay Coordinates (WGS84) ──────────────────────────────
// Supplied barangay coordinates used for icon placement and fallback geometry.
export const BARANGAY_COORDS: Record<string, [number, number]> = {
  "Antonio Luna": [9.0827,  125.5911],
  "Bay-ang":      [9.1041,  125.5773],
  "Bayabas":      [9.1455,  125.5937],
  "Caasinan":     [9.1362,  125.5236],
  "Cabinet":      [9.1245,  125.5268],
  "Calamba":      [9.0985,  125.6006],
  "Calibunan":    [9.1057,  125.5338],
  "Comagascas":   [9.1350,  125.5587],
  "Concepcion":   [9.1807,  125.5822],
  "Del Pilar":    [9.1513,  125.5840],
  "Katugasan":    [9.1313,  125.5837],
  "Kauswagan":    [9.1299,  125.5309],
  "La Union":     [9.0986,  125.5518],
  "Mabini":       [9.1129,  125.5523],
  "Mahaba":       [9.1171,  125.6329],
  "Poblacion 1":  [9.1232,  125.5330],
  "Poblacion 2":  [9.1238,  125.5337],
  "Poblacion 3":  [9.1233,  125.5297],
  "Poblacion 4":  [9.1194,  125.5325],
  "Poblacion 5":  [9.1189,  125.5338],
  "Poblacion 6":  [9.1206,  125.5339],
  "Poblacion 7":  [9.1250,  125.5373],
  "Poblacion 8":  [9.1229,  125.5361],
  "Poblacion 9":  [9.1227,  125.5420],
  "Poblacion 10": [9.1206,  125.5367],
  "Poblacion 11": [9.1182,  125.5354],
  "Poblacion 12": [9.1178,  125.5410],
  "Puting Bato":  [9.1263,  125.6368],
  "Sanghan":      [9.0878,  125.5709],
  "Soriano":      [9.0967,  125.5684],
  "Tolosa":       [9.1175,  125.5255],
};

// ─── Polygon builder: small square around each barangay center ───────────────
function makePoly(lat: number, lng: number): [number, number][] {
  const hw = 0.004;
  const hh = 0.004;
  return [
    [lat - hh, lng - hw],
    [lat - hh, lng + hw],
    [lat + hh, lng + hw],
    [lat + hh, lng - hw],
    [lat - hh, lng - hw],
  ];
}

export const BARANGAY_GEOJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: Object.entries(BARANGAY_COORDS).map(([name, [lat, lng]]) => ({
    type: "Feature" as const,
    properties: { name },
    geometry: {
      type: "Polygon" as const,
      // GeoJSON uses [lng, lat] order
      coordinates: [makePoly(lat, lng).map(([lt, ln]) => [ln, lt])],
    },
  })),
};

// ─── Bounds helper ────────────────────────────────────────────────────────────
export function isWithinCabadbaranBounds(lat: number, lng: number) {
  const [[south, west], [north, east]] = CABADBARAN_BOUNDS as [
    [number, number],
    [number, number],
  ];
  return lat >= south && lat <= north && lng >= west && lng <= east;
}
