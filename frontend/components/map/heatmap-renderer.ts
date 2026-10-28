export type HeatmapColorMode = "red-yellow-green" | "blue-purple" | "fire" | "ocean" | "cool";

export type TierDefinition = {
  label: string;
  range: string;
  min: number;
  max: number;
  weight: number;
  color: string;
  labelColor: string;
};

export const COLOR_PALETTES: Record<HeatmapColorMode, TierDefinition[]> = {
  "red-yellow-green": [
    { label: "Low",           range: "0-4 cases",   min: 0,  max: 4,        weight: 0.06, color: "#4ade80", labelColor: "#16a34a" },
    { label: "Low-Moderate",  range: "5-9 cases",   min: 5,  max: 9,        weight: 0.25, color: "#fde047", labelColor: "#ca8a04" },
    { label: "Moderate",      range: "10-14 cases", min: 10, max: 14,       weight: 0.44, color: "#fdba74", labelColor: "#ea580c" },
    { label: "Moderate-High", range: "15-19 cases", min: 15, max: 19,       weight: 0.62, color: "#fb923c", labelColor: "#c2410c" },
    { label: "High",          range: "20-24 cases", min: 20, max: 24,       weight: 0.80, color: "#f87171", labelColor: "#b91c1c" },
    { label: "Very High",     range: "25+ cases",   min: 25, max: Infinity, weight: 1.00, color: "#dc2626", labelColor: "#991b1b" },
  ],
  "blue-purple": [
    { label: "Low",           range: "0-4 cases",   min: 0,  max: 4,        weight: 0.06, color: "#60a5fa", labelColor: "#1e40af" },
    { label: "Low-Moderate",  range: "5-9 cases",   min: 5,  max: 9,        weight: 0.25, color: "#7c3aed", labelColor: "#5b21b6" },
    { label: "Moderate",      range: "10-14 cases", min: 10, max: 14,       weight: 0.44, color: "#a855f7", labelColor: "#6b21a8" },
    { label: "Moderate-High", range: "15-19 cases", min: 15, max: 19,       weight: 0.62, color: "#d946ef", labelColor: "#831843" },
    { label: "High",          range: "20-24 cases", min: 20, max: 24,       weight: 0.80, color: "#ec4899", labelColor: "#831843" },
    { label: "Very High",     range: "25+ cases",   min: 25, max: Infinity, weight: 1.00, color: "#be123c", labelColor: "#800726" },
  ],
  "fire": [
    { label: "Low",           range: "0-4 cases",   min: 0,  max: 4,        weight: 0.06, color: "#fef3c7", labelColor: "#92400e" },
    { label: "Low-Moderate",  range: "5-9 cases",   min: 5,  max: 9,        weight: 0.25, color: "#fcd34d", labelColor: "#b45309" },
    { label: "Moderate",      range: "10-14 cases", min: 10, max: 14,       weight: 0.44, color: "#fbbf24", labelColor: "#d97706" },
    { label: "Moderate-High", range: "15-19 cases", min: 15, max: 19,       weight: 0.62, color: "#f59e0b", labelColor: "#d97706" },
    { label: "High",          range: "20-24 cases", min: 20, max: 24,       weight: 0.80, color: "#ea580c", labelColor: "#7c2d12" },
    { label: "Very High",     range: "25+ cases",   min: 25, max: Infinity, weight: 1.00, color: "#7c2d12", labelColor: "#431407" },
  ],
  "ocean": [
    { label: "Low",           range: "0-4 cases",   min: 0,  max: 4,        weight: 0.06, color: "#cffafe", labelColor: "#164e63" },
    { label: "Low-Moderate",  range: "5-9 cases",   min: 5,  max: 9,        weight: 0.25, color: "#06b6d4", labelColor: "#164e63" },
    { label: "Moderate",      range: "10-14 cases", min: 10, max: 14,       weight: 0.44, color: "#0891b2", labelColor: "#164e63" },
    { label: "Moderate-High", range: "15-19 cases", min: 15, max: 19,       weight: 0.62, color: "#0e7490", labelColor: "#164e63" },
    { label: "High",          range: "20-24 cases", min: 20, max: 24,       weight: 0.80, color: "#155e75", labelColor: "#ecf0f1" },
    { label: "Very High",     range: "25+ cases",   min: 25, max: Infinity, weight: 1.00, color: "#082f49", labelColor: "#ecf0f1" },
  ],
  "cool": [
    { label: "Low",           range: "0-4 cases",   min: 0,  max: 4,        weight: 0.06, color: "#a7f3d0", labelColor: "#065f46" },
    { label: "Low-Moderate",  range: "5-9 cases",   min: 5,  max: 9,        weight: 0.25, color: "#6ee7b7", labelColor: "#047857" },
    { label: "Moderate",      range: "10-14 cases", min: 10, max: 14,       weight: 0.44, color: "#34d399", labelColor: "#047857" },
    { label: "Moderate-High", range: "15-19 cases", min: 15, max: 19,       weight: 0.62, color: "#10b981", labelColor: "#065f46" },
    { label: "High",          range: "20-24 cases", min: 20, max: 24,       weight: 0.80, color: "#059669", labelColor: "#ecf0f1" },
    { label: "Very High",     range: "25+ cases",   min: 25, max: Infinity, weight: 1.00, color: "#047857", labelColor: "#ecf0f1" },
  ],
};

const TIERS = COLOR_PALETTES["red-yellow-green"];

export function getTier(count: number, tiers = TIERS): TierDefinition {
  return tiers.find((tier) => count >= tier.min && count <= tier.max) ?? tiers[0];
}


export type HeatmapObservation = { malnutrition_count: number; total_children: number };
export function hasHeatmapData(value?: HeatmapObservation): boolean {
  return !!value && Number.isFinite(value.total_children) && value.total_children > 0 &&
    Number.isInteger(value.malnutrition_count) && value.malnutrition_count >= 0 &&
    value.malnutrition_count <= value.total_children;
}

export function getChoroplethColor(malnutritionCount: number, totalChildren: number): string {
  if (!hasHeatmapData({ malnutrition_count: malnutritionCount, total_children: totalChildren })) return "#cbd5e1";
  // Calculate prevalence rate (percentage)
  const prevalenceRate = (malnutritionCount * 100) / totalChildren;

  // Color scheme based on prevalence rate (matching your requirements)
  if (prevalenceRate > 20) return '#800026';      // Very High (>20%)
  if (prevalenceRate > 15) return '#BD0026';      // High (15-20%)
  if (prevalenceRate > 10) return '#E31A1C';      // Moderate-High (10-15%)
  if (prevalenceRate > 7)  return '#FC4E2A';      // Moderate (7-10%)
  if (prevalenceRate > 4)  return '#FD8D3C';      // Low-Moderate (4-7%)
  if (prevalenceRate > 2)  return '#FEB24C';      // Low (2-4%)
  if (prevalenceRate > 0)  return '#FED976';      // Very Low (0-2%)
  return '#FFEDA0';                                // No cases
}



export const STATUS_DOTS = {
  normal: { label: "Normal", color: "#16a34a" },
  moderate: { label: "Moderate (MAM)", color: "#f59e0b" },
  severe: { label: "Severe (SAM)", color: "#dc2626" },
  mixed: { label: "Mixed / tied", color: "#8b5cf6" },
  unavailable: { label: "No eligible status data", color: "#94a3b8" },
} as const;

export type StatusCounts = { normal_count?: number; moderate_count: number; severe_count: number };
export function dominantStatus(counts: StatusCounts): keyof typeof STATUS_DOTS {
  const values = [counts.normal_count, counts.moderate_count, counts.severe_count];
  if (values.some(value => typeof value !== "number" || !Number.isInteger(value) || value < 0)) return "unavailable";
  const maximum = Math.max(...values as number[]);
  if (maximum === 0) return "unavailable";
  const winners = values.map((value, index) => value === maximum ? index : -1).filter(index => index >= 0);
  if (winners.length > 1) return "mixed";
  return (["normal", "moderate", "severe"] as const)[winners[0]];
}


export const CASE_DOT_STYLES = {
  normal: STATUS_DOTS.normal,
  moderate: STATUS_DOTS.moderate,
  severe: STATUS_DOTS.severe,
  other: { label: "Other measured status", color: "#94a3b8" },
} as const;
export type AreaGeometry = { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
export type ScatterArea = StatusCounts & { name: string; id?: string; lat?: number; lng?: number; other_count?: number; scatter_geometry?: AreaGeometry };
export type ScatterCenter = { name: string; lat: number; lng: number };

function inRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function insideArea(lng: number, lat: number, geometry: AreaGeometry): boolean {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(polygon => polygon.length > 0 && inRing(lng, lat, polygon[0]) &&
    !polygon.slice(1).some(hole => inRing(lng, lat, hole)));
}

function ringArea(ring: number[][]): number {
  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) total += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(total) / 2;
}

function halton(index: number, base: number): number {
  let result = 0, fraction = 1;
  while (index > 0) { fraction /= base; result += fraction * (index % base); index = Math.floor(index / base); }
  return result;
}

/** Visual density follows the supplied land polygon; colors preserve measured status shares. */
export function scatterCaseDots(area: ScatterArea, _centers: ScatterCenter[] = [], density = 6) {
  const geometry = area.scatter_geometry;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) return [];
  const counts = [area.normal_count, area.moderate_count, area.severe_count, area.other_count ?? 0];
  if (counts.some(count => typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)) return [];
  const measured = (counts as number[]).reduce((sum, count) => sum + count, 0);
  if (!measured) return [];
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const vertices = polygons.flatMap(polygon => polygon[0] ?? []);
  if (vertices.length < 3 || vertices.some(point => point.length < 2 || !point.every(Number.isFinite))) return [];
  const west = Math.min(...vertices.map(point => point[0]));
  const east = Math.max(...vertices.map(point => point[0]));
  const south = Math.min(...vertices.map(point => point[1]));
  const north = Math.max(...vertices.map(point => point[1]));
  if (east <= west || north <= south) return [];
  const landArea = polygons.reduce((sum, polygon) => sum + ringArea(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0), 0);
  const squareKm = landArea * 12364 * Math.cos((north + south) / 2 * Math.PI / 180);
  const level = Math.max(1, Math.min(12, Number.isFinite(density) ? Math.round(density) : 6));
  const target = Math.min(6000, Math.max(measured * level, Math.min(200 * level, Math.ceil(squareKm * 100 * level))));
  const allocations = (counts as number[]).map(count => Math.floor(target * count / measured));
  const ranking = counts.map((count, index) => ({index, remainder: target * count! / measured - allocations[index]}))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let n = target - allocations.reduce((sum, value) => sum + value, 0), i = 0; i < n; i++) allocations[ranking[i].index]++;
  const statuses = (["normal", "moderate", "severe", "other"] as const)
    .flatMap((status, index) => Array(allocations[index]).fill(status)) as (keyof typeof CASE_DOT_STYLES)[];
  let seed = 2166136261;
  for (const character of area.name) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = statuses.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [statuses[i], statuses[j]] = [statuses[j], statuses[i]]; }
  const offset = seed % 4096;
  const points: { status: keyof typeof CASE_DOT_STYLES; lat: number; lng: number }[] = [];
  for (let index = 1; points.length < target && index <= target * 200; index++) {
    const lng = west + halton(index + offset, 2) * (east - west);
    const lat = south + halton(index + offset, 3) * (north - south);
    if (insideArea(lng, lat, geometry)) points.push({ status: statuses[points.length], lat, lng });
  }
  return points;
}
