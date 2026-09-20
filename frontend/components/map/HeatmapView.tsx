"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  CABADBARAN_CENTER,
  CABADBARAN_MAP_CLASS,
  CABADBARAN_MAP_OPTIONS,
  CABADBARAN_MASK,
  BARANGAY_COORDS,
  EXCLUDED_BARANGAY_NAMES,
  TILE_LAYERS,
  STREET_LABELS_OVERLAY,
  type TileLayerKey,
} from "./cabadbaran";

// ─── Coordinate validation ───────────────────────────────────────────────────
function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" && Number.isFinite(lat) &&
    typeof lng === "number" && Number.isFinite(lng) &&
    lat !== 0 && lng !== 0 &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

function formatCoordinate(value: unknown, digits = 5): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "N/A";
}

// Helper component to programmatically pan/zoom Leaflet map
function MapCenterController({ center, zoom }: { center: any; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

// ─── Layer switcher ───────────────────────────────────────────────────────────
function LayerSwitcher({
  active,
  onChange,
}: {
  active: TileLayerKey;
  onChange: (k: TileLayerKey) => void;
}) {
  return (
    <div className="absolute bottom-8 right-2 z-[1000] flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm p-1 shadow-md">
      {(Object.keys(TILE_LAYERS) as TileLayerKey[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            active === k
              ? "bg-teal-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
type BarangaySeverity = {
  alert_count: number;
  malnutrition_count: number;
  moderate_count: number;
  name: string;
  prevalence_rate: number;
  risk_level: "critical" | "high" | "medium" | "low";
  severe_count: number;
  total_children: number;
  lat?: number;
  lng?: number;
};

// ─── Legend tiers (based on malnutrition case count) ─────────────────────────
const TIERS = [
  { label: "Low",             range: "0-4 cases",   min: 0,  max: 4,        weight: 0.06, color: "#4ade80", labelColor: "#16a34a" },
  { label: "Low-Moderate",    range: "5-9 cases",   min: 5,  max: 9,        weight: 0.25, color: "#fde047", labelColor: "#ca8a04" },
  { label: "Moderate",        range: "10-14 cases", min: 10, max: 14,       weight: 0.44, color: "#fdba74", labelColor: "#ea580c" },
  { label: "Moderate-High",   range: "15-19 cases", min: 15, max: 19,       weight: 0.62, color: "#fb923c", labelColor: "#c2410c" },
  { label: "High",            range: "20-24 cases", min: 20, max: 24,       weight: 0.80, color: "#f87171", labelColor: "#b91c1c" },
  { label: "Very High",       range: "25+ cases",   min: 25, max: Infinity, weight: 1.00, color: "#dc2626", labelColor: "#991b1b" },
];

function getWeight(caseCount: number): number {
  return TIERS.find((t) => caseCount >= t.min && caseCount <= t.max)?.weight ?? 0.06;
}

function getLabelColor(caseCount: number): string {
  return TIERS.find((t) => caseCount >= t.min && caseCount <= t.max)?.labelColor ?? "#16a34a";
}

// ─── IDW: Inverse Distance Weighting (no sqrt → uses power=2 for speed) ──────
function idw(
  lat: number,
  lng: number,
  pts: { lat: number; lng: number; w: number }[]
): number {
  let num = 0, den = 0;
  for (const p of pts) {
    const d2 = (lat - p.lat) ** 2 + (lng - p.lng) ** 2;
    if (d2 < 1e-10) return p.w;          // exactly on a known point
    const inv = 1 / d2;                  // power = 2 (fast, no sqrt)
    num += inv * p.w;
    den += inv;
  }
  return den > 0 ? num / den : 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return [r, g, b];
}

function intensityToRGB(t: number): [number, number, number] {
  // Find the tier that matches this weight
  const tier = TIERS.find((tier) => t <= tier.weight) || TIERS[TIERS.length - 1];
  return hexToRgb(tier.color);
}

// ─── Popup HTML ───────────────────────────────────────────────────────────────
function buildPopupHtml(props: BarangaySeverity) {
  const tier =
    TIERS.find((t) => props.malnutrition_count >= t.min && props.malnutrition_count <= t.max) ?? TIERS[0];
  return `
    <div style="padding:12px;min-width:230px;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
        <span style="font-weight:700;font-size:15px;color:#0f172a;">${props.name}</span>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${tier.color}33;color:${tier.labelColor};border:1px solid ${tier.color};">
          ${tier.label.toUpperCase()}
        </span>
      </div>
      <div style="font-size:13px;color:#334155;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span>Total Children:</span><strong>${props.total_children}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span>Malnutrition Cases:</span><strong style="color:${tier.labelColor}">${props.malnutrition_count}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span>Prevalence Rate:</span><strong>${props.prevalence_rate}%</strong></div>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;">
        <div style="font-size:12px;font-weight:600;color:#1e293b;margin-bottom:4px;">Case Breakdown:</div>
        <div style="font-size:12px;color:#475569;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>🔴 Severe (SAM):</span><strong>${props.severe_count}</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>🟠 Moderate (MAM):</span><strong>${props.moderate_count}</strong></div>
        </div>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;font-weight:600;color:#475569;">📍 Location</span>
        <span style="font-size:11px;font-family:monospace;font-weight:600;color:#334155;">${formatCoordinate(props.lat)}°N, ${formatCoordinate(props.lng)}°E</span>
      </div>
    </div>`;
}

// ─── City geographic bounds ───────────────────────────────────────────────────
const GEO = { south: 9.07, north: 9.20, west: 125.51, east: 125.65 } as const;

// ─── Canvas IDW layer ─────────────────────────────────────────────────────────
// Renders a pixel-accurate IDW heatmap as an ImageOverlay on the map.
// Produces smooth, full-coverage gradients like the NOAA weather forecast map.
function IDWCanvasLayer({ data }: { data: BarangaySeverity[] }) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const groupRef   = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    // ── 1. Known barangay intensity points ────────────────────────────────
    const pts = data
      .map((b) => {
        const lat = b.lat;
        const lng = b.lng;
        return isValidCoordinate(lat, lng) ? { lat, lng, w: getWeight(b.malnutrition_count) } : null;
      })
      .filter(Boolean) as { lat: number; lng: number; w: number }[];

    // ── 2. Render IDW to an offscreen canvas ──────────────────────────────
    const CW = 400, CH = 400;
    const raw = document.createElement("canvas");
    raw.width = CW; raw.height = CH;
    const rawCtx = raw.getContext("2d")!;
    const imgData = rawCtx.createImageData(CW, CH);
    const px = imgData.data;

    const latRange = GEO.north - GEO.south;
    const lngRange = GEO.east  - GEO.west;

    const maxRadius = 0.025; // in degrees, approx 2.8 km

    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const lat = GEO.north - (y / CH) * latRange;
        const lng = GEO.west  + (x / CW) * lngRange;
        
        // Find distance to the nearest barangay center
        let minDist2 = Infinity;
        for (const p of pts) {
          const d2 = (lat - p.lat) ** 2 + (lng - p.lng) ** 2;
          if (d2 < minDist2) {
            minDist2 = d2;
          }
        }
        const minDist = Math.sqrt(minDist2);
        const i = (y * CW + x) * 4;

        if (minDist >= maxRadius) {
          // Outside the zone of influence: make pixel completely transparent
          px[i]     = 0;
          px[i + 1] = 0;
          px[i + 2] = 0;
          px[i + 3] = 0;
        } else {
          // Within the zone: calculate IDW intensity and map to discrete tier colors
          const intensity = idw(lat, lng, pts);
          const [r, g, b] = intensityToRGB(intensity);
          
          // Smooth cosine-based opacity fade-out
          const ratio = minDist / maxRadius;
          const fade = Math.cos(ratio * Math.PI / 2) ** 2;
          
          px[i]     = r;
          px[i + 1] = g;
          px[i + 2] = b;
          px[i + 3] = Math.round(fade * 215); // fade the opacity smoothly
        }
      }
    }
    rawCtx.putImageData(imgData, 0, 0);

    // ── 3. Apply gaussian blur for smooth NOAA-style transitions ──────────
    const blurred = document.createElement("canvas");
    blurred.width = CW; blurred.height = CH;
    const bCtx = blurred.getContext("2d")!;
    bCtx.filter = "blur(14px)";
    bCtx.drawImage(raw, 0, 0);

    // ── 4. Add as Leaflet ImageOverlay ────────────────────────────────────
    const dataUrl = blurred.toDataURL("image/png");
    const leafletBounds: L.LatLngBoundsExpression = [
      [GEO.south, GEO.west],
      [GEO.north, GEO.east],
    ];

    const overlay = L.imageOverlay(dataUrl, leafletBounds, {
      opacity: 0.82,
      interactive: false,
      zIndex: 400,
    });
    overlay.addTo(map);
    overlayRef.current = overlay;

    // ── 5. Barangay labels (number + name, like the NOAA city labels) ─────
    const group = L.layerGroup().addTo(map);
    groupRef.current = group;

    data.forEach((b) => {
      const lat = b.lat;
      const lng = b.lng;
      if (!lat || !lng) return;
      const lc = getLabelColor(b.malnutrition_count);
      const short = b.name.replace(/^Poblacion\s+/, "Pob. ");

      const icon = L.divIcon({
        className: "",
        iconAnchor: [0, 0],
        html: `<div style="transform:translate(-50%,-50%);text-align:center;pointer-events:auto;cursor:pointer;">
          <div style="font-size:15px;font-weight:900;color:${lc};text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000,0 0 6px rgba(0,0,0,0.9);line-height:1.1;white-space:nowrap;">${b.prevalence_rate.toFixed(1)}%</div>
          <div style="font-size:9px;font-weight:700;color:#fff;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;white-space:nowrap;margin-top:1px;">${short}</div>
        </div>`,
      });

      const marker = L.marker([lat, lng], { icon, interactive: true, zIndexOffset: 700 });
      const popup = L.popup({ closeButton: false, autoClose: false, offset: [0, -8] })
        .setContent(buildPopupHtml(b));

      marker.on("mouseover", (e) => { marker.bindPopup(popup).openPopup(e.latlng); });
      marker.on("mousemove", (e) => { popup.setLatLng(e.latlng); });
      marker.on("mouseout",  ()  => { marker.closePopup(); });
      
      // Add click handler for navigation (superadmin only)
      marker.on("click", () => {
        // Click event will be handled by the map-level click listener below
        // Just ensure the marker is clickable
        (marker as any).fire("markerclick", { barangayName: b.name });
      });

      group.addLayer(marker);
    });

    return () => {
      if (overlayRef.current) map.removeLayer(overlayRef.current);
      if (groupRef.current)   map.removeLayer(groupRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return null;
}

// ─── Accuracy Gate Component ──────────────────────────────────────────────────
type AccuracyData = {
  accuracy_pct: number;
  is_reliable: boolean;
  message: string;
};

// ─── Click handler for marker labels (navigate to barangay) ──────────────────
function HeatmapClickHandler({ 
  barangayList, 
  user 
}: { 
  barangayList: BarangaySeverity[];
  user: any;
}) {
  const router = useRouter();
  const map = useMap();

  useEffect(() => {
    if (!map || !barangayList || barangayList.length === 0) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const clickLat = e.latlng.lat;
      const clickLng = e.latlng.lng;

      // Check if click is near any barangay center (within ~0.01 degrees, ~1.1km)
      const threshold = 0.01;
      let closestBarangay: BarangaySeverity | null = null;
      let closestDistance = threshold;

      for (const b of barangayList) {
        if (!b.lat || !b.lng) continue;
        const dist = Math.sqrt((clickLat - b.lat) ** 2 + (clickLng - b.lng) ** 2);
        if (dist < closestDistance) {
          closestDistance = dist;
          closestBarangay = b;
        }
      }

      if (!closestBarangay) return;

      console.log('[HeatmapClickHandler] BARANGAY CLICKED:', {
        userRole: user?.role,
        barangayName: closestBarangay.name,
        lat: closestBarangay.lat,
        lng: closestBarangay.lng
      });

      if (user?.role === "super_admin") {
        // Navigate to barangay-focused map
        const barangayName = encodeURIComponent(closestBarangay.name);
        const url = `/map?barangay=${barangayName}`;
        console.log('[HeatmapClickHandler] Navigating to:', url);
        router.push(url);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, barangayList, user?.role, router]);

  return null;
}

function AccuracyGate({ barangayId }: { barangayId?: string }) {
  const { data: accuracy, isLoading } = useQuery<AccuracyData>({
    queryKey: ["accuracy", barangayId],
    queryFn: () =>
      api
        .get(`/api/maps/accuracy/${barangayId}`)
        .then((r) => r.data)
        .catch(() => ({
          accuracy_pct: 0,
          is_reliable: false,
          message: "Unable to load accuracy data"
        })),
    enabled: !!barangayId,
  });

  if (isLoading) {
    return (
      <div className="bg-blue-50 border border-blue-300 p-3 rounded-lg">
        <p className="text-sm text-blue-700">Loading accuracy data...</p>
      </div>
    );
  }

  if (!accuracy?.is_reliable) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg">
        <div className="font-bold text-yellow-800 mb-2">
          ⚠️ Data Accuracy: {accuracy?.accuracy_pct?.toFixed(1) || 0}%
        </div>
        <p className="text-sm text-yellow-700">
          {accuracy?.message || "Heatmap requires 95% accuracy for reliability."}
          {accuracy?.accuracy_pct ? (
            accuracy.accuracy_pct < 50 
              ? " Please verify more children data." 
              : " Almost reliable! Verify a few more entries."
          ) : " Not verified yet."}
        </p>
      </div>
    );
  }

  // Reliable - show green checkmark
  return (
    <div className="bg-green-50 border border-green-300 p-3 rounded-lg">
      <p className="text-sm text-green-700">
        ✅ Data Accuracy: {accuracy.accuracy_pct.toFixed(1)}% - Heatmap is reliable
      </p>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function HeatmapView() {
  const [tileKey, setTileKey] = useState<TileLayerKey>("Satellite");
  const tile = TILE_LAYERS[tileKey];
  const { user } = useAuthStore();

  const choropleth = useQuery({
    queryKey: ["barangay-severity-heatmap", user?.id],
    queryFn: () =>
      api
        .get("/api/maps/barangay-choropleth")
        .then((r) => {
          console.log("Heatmap data received:", r.data); // DEBUG
          return r.data as { features: { properties: BarangaySeverity }[] };
        }),
    enabled: !!user?.id,
  });

  const barangayList: BarangaySeverity[] =
    (choropleth.data?.features?.map((f) => f.properties) ?? [])
      // Exclude barangays not part of Cabadbaran City (e.g. Concepcion)
      .filter((b: BarangaySeverity) => !EXCLUDED_BARANGAY_NAMES.has(b.name));

  console.log("Filtered barangay list:", barangayList); // DEBUG

  // Get first barangay ID for accuracy check
  const firstBarangayId = barangayList.length > 0 ? barangayList[0].alert_count?.toString() : undefined;

  // Compute dynamic center and zoom based on role
  const mapCenter = useMemo(() => {
    if (user?.role === "admin" && barangayList.length > 0) {
      const first = barangayList[0];
      const lat = first.lat;
      const lng = first.lng;
      if (lat && lng) return [lat, lng] as [number, number];
    }
    return CABADBARAN_CENTER;
  }, [user, barangayList]);

  const mapZoom = user?.role === "admin" ? 15 : 13;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Accuracy Gate */}
      {barangayList.length > 0 && user?.role === "super_admin" && (
        <AccuracyGate barangayId={barangayList[0]?.alert_count?.toString()} />
      )}

      <div className="relative min-h-0 flex-1 w-full">
        <LayerSwitcher active={tileKey} onChange={setTileKey} />
        
        {/* Debug info */}
        {choropleth.isLoading && (
          <div className="absolute top-2 left-2 z-[1001] bg-blue-500 text-white px-3 py-1 rounded text-xs">
            Loading heatmap data...
          </div>
        )}
        
        {choropleth.isError && (
          <div className="absolute top-2 left-2 z-[1001] bg-red-500 text-white px-3 py-1 rounded text-xs">
            Error loading heatmap: {String(choropleth.error)}
          </div>
        )}
        
        {barangayList.length === 0 && !choropleth.isLoading && (
          <div className="absolute top-2 left-2 z-[1001] bg-yellow-500 text-black px-3 py-1 rounded text-xs">
            No barangay data available
          </div>
        )}

        <MapContainer {...CABADBARAN_MAP_OPTIONS} className={CABADBARAN_MAP_CLASS}>
          <MapCenterController center={mapCenter} zoom={mapZoom} />
          <TileLayer key={tileKey} attribution={tile.attribution} url={tile.url} />
          
          {/* Street labels overlay for Satellite and Terrain views */}
          {(tileKey === "Satellite" || tileKey === "Terrain") && (
            <TileLayer
              url={STREET_LABELS_OVERLAY.url}
              attribution={STREET_LABELS_OVERLAY.attribution}
              zIndex={1000}
            />
          )}
          
          {/* Click handler for marker/label navigation */}
          {barangayList.length > 0 && <HeatmapClickHandler barangayList={barangayList} user={user} />}

          {/* Dark mask outside Cabadbaran bounds */}
          <Polygon
            positions={CABADBARAN_MASK}
            pathOptions={{ color: "transparent", fillColor: "#000000", fillOpacity: 0.65 }}
            interactive={false}
          />

          {/* Canvas IDW heatmap + labels */}
          {barangayList.length > 0 && <IDWCanvasLayer data={barangayList} />}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-700 shadow-sm shrink-0">
        <span className="font-bold text-slate-800 tracking-wide whitespace-nowrap">
          Heatmap Legend
        </span>
        <div className="flex flex-wrap gap-3">
          {TIERS.map((tier) => (
            <span key={tier.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="inline-block h-4 w-4 rounded-sm flex-shrink-0 shadow-sm"
                style={{ backgroundColor: tier.color }}
              />
              <span className="text-slate-700">
                {tier.label}
                <span className="ml-1 text-slate-400">({tier.range})</span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
