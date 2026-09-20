"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Polygon, GeoJSON, Popup, useMap } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { STATUS_COLORS, getStatusColor } from "@/lib/theme";
import { X, MapPin, Users, Home, Activity } from "lucide-react";
import {
  CABADBARAN_CENTER,
  CABADBARAN_MAP_CLASS,
  CABADBARAN_MAP_OPTIONS,
  CABADBARAN_MASK,
  EXCLUDED_BARANGAY_NAMES,
  TILE_LAYERS,
  STREET_LABELS_OVERLAY,
  type TileLayerKey,
} from "./cabadbaran";

// ─── Helper: coordinate validation ───────────────────────────────────────────
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

// ─── Helper: pan/zoom controller ─────────────────────────────────────────────
function MapCenterController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    try {
      if (map && map.getContainer().isConnected) {
        map.stop();
        map.setView(center, zoom);
      }
    } catch (err) {
      console.error('[MapCenterController] Error setting view:', err);
    }
  }, [center, zoom, map]);
  return null;
}

// ─── Popup positioning helper ────────────────────────────────────────────────
function positionPopupToRight(popup: L.Popup, map: L.Map) {
  if (!popup || !map) return;
  try {
    const popupElement = (popup as any)._container as HTMLElement;
    if (!popupElement) return;
    
    // Get map dimensions
    const mapContainer = map.getContainer();
    const mapWidth = mapContainer.offsetWidth;
    
    // Get popup position and dimensions
    const popupRect = popupElement.getBoundingClientRect();
    const mapRect = mapContainer.getBoundingClientRect();
    
    // Calculate if popup will go offscreen on the right
    const rightEdge = popupRect.left + popupRect.width - mapRect.left;
    
    // If popup goes offscreen on right, position it to the left instead
    if (rightEdge > mapWidth - 40) {
      popupElement.classList.add('leaflet-popup-left');
      popupElement.classList.remove('leaflet-popup-right');
    } else {
      // Position to the right (default)
      popupElement.classList.add('leaflet-popup-right');
      popupElement.classList.remove('leaflet-popup-left');
    }
  } catch (err) {
    console.warn('[positionPopupToRight] Error:', err);
  }
}

// ─── Layer switcher ───────────────────────────────────────────────────────────
function LayerSwitcher({ active, onChange }: { active: TileLayerKey; onChange: (k: TileLayerKey) => void }) {
  return (
    <div className="absolute bottom-8 right-2 z-[1000] flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm p-1 shadow-md">
      {(Object.keys(TILE_LAYERS) as TileLayerKey[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            active === k ? "bg-teal-600 text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type BarangaySeverity = {
  id?: string;
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

// ─── Malnutrition status colours (markers) ───────────────────────────────────
// Now uses centralized theme - import is at top of file

// ─── SVG pin marker ───────────────────────────────────────────────────────────
function pinIcon(status: string | undefined) {
  const colorObj = getStatusColor(status);
  const colour = colorObj.hex;
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z"
        fill="${colour}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.85"/>
    </svg>`
  );
return new L.Icon({
        iconUrl: `data:image/svg+xml,${svg}`,
        iconSize: [10, 15],
        iconAnchor: [5, 15],
        popupAnchor: [0, -17],
      });
}

// ─── Invisible barangay boundary style ───────────────────────────────────────
// NOTE: Must have non-zero opacity for Leaflet to fire mouse events!
// Using low opacity (0.05) to maintain interactivity while staying nearly invisible
// ─── Choropleth Color Function - Get color based on malnutrition density ─────
function getChoroplethColor(malnutritionCount: number, totalChildren: number): string {
  // Calculate prevalence rate (percentage)
  const prevalenceRate = totalChildren > 0 ? (malnutritionCount / totalChildren) * 100 : 0;
  
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

// ─── Get Choropleth Style for Barangay ───────────────────────────────────────
function getChoroplethStyle(
  feature: any,
  barangaySeverities: BarangaySeverity[],
  showOnlyOutlines: boolean = false
): L.PathOptions {
  const barangayName = feature?.properties?.name;
  const severity = barangaySeverities.find(b => b.name === barangayName);
  
  // When showing only outlines (default map view)
  if (showOnlyOutlines) {
    if (feature?.properties?.featureType === "purok") {
      return {
        color: "#000000",
        fillColor: "transparent",
        fillOpacity: 0,
        weight: 2,
        opacity: 0.7,
      };
    }
    return {
      color: "#1a1a1a",
      fillColor: "transparent",
      fillOpacity: 0,
      weight: 2.5,
      opacity: 0.6,
    };
  }
  
  // Choropleth mode - color based on malnutrition data
  if (severity) {
    const fillColor = getChoroplethColor(severity.malnutrition_count, severity.total_children);
    
    return {
      fillColor: fillColor,
      fillOpacity: 1.0,                // Full opacity - CSS blend mode handles transparency
      color: '#333333',                // Dark gray border
      weight: 1.5,                     // Border thickness
      opacity: 1,                      // Full border opacity
    };
  }
  
  // Default style for areas without data
  return {
    fillColor: '#f0f0f0',
    fillOpacity: 0.5,
    color: '#999999',
    weight: 1,
    opacity: 0.5,
  };
}

const barangayStyle: L.PathOptions = {
  color: "#10b981",
  fillColor: "#10b981",
  fillOpacity: 0.05,  // Increased from 0.01 to 0.05 for better event detection
  weight: 1.5,
  opacity: 0.05,      // Increased from 0.01 to 0.05 for better event detection
};

// ─── Heatmap Legend tiers ─────────────────────────────────────────────────────
type HeatmapColorMode = "red-yellow-green" | "blue-purple" | "fire" | "ocean" | "cool";

type TierDefinition = {
  label: string;
  range: string;
  min: number;
  max: number;
  weight: number;
  color: string;
  labelColor: string;
};

const COLOR_PALETTES: Record<HeatmapColorMode, TierDefinition[]> = {
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

let TIERS = COLOR_PALETTES["red-yellow-green"];

function getWeight(count: number): number {
  return TIERS.find((t) => count >= t.min && count <= t.max)?.weight ?? 0.06;
}
function getLabelColor(count: number): string {
  return TIERS.find((t) => count >= t.min && count <= t.max)?.labelColor ?? "#16a34a";
}

// ─── IDW interpolation ────────────────────────────────────────────────────────
function idw(lat: number, lng: number, pts: { lat: number; lng: number; w: number }[]): number {
  let num = 0, den = 0;
  for (const p of pts) {
    const d2 = (lat - p.lat) ** 2 + (lng - p.lng) ** 2;
    if (d2 < 1e-10) return p.w;
    const inv = 1 / d2;
    num += inv * p.w;
    den += inv;
  }
  return den > 0 ? num / den : 0;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function intensityToRGB(t: number): [number, number, number] {
  const tier = TIERS.find((tier) => t <= tier.weight) || TIERS[TIERS.length - 1];
  return hexToRgb(tier.color);
}

// ─── Popup HTML for heatmap labels ───────────────────────────────────────────
// ─── Risk level colour scheme for enhanced display ────────────────────────
function getRiskLevelInfo(riskLevel: string): { bg: string; color: string; icon: string } {
  switch (riskLevel) {
    case "critical":
      return { bg: "#fee2e2", color: "#991b1b", icon: "🔴" };
    case "high":
      return { bg: "#ffedd5", color: "#9a3412", icon: "🟠" };
    case "medium":
      return { bg: "#fef9c3", color: "#713f12", icon: "🟡" };
    default:
      return { bg: "#d1fae5", color: "#065f46", icon: "🟢" };
  }
}

// ─── Calculate NEWS (Nutrition Early Warning System) indicators ──────────────
function buildNewsIndicators(props: BarangaySeverity): {
  undernutritionStatus: string;
  trendIndicator: string;
  alertLevel: string;
} {
  const malnutritionPercentage = props.total_children > 0 ? (props.malnutrition_count / props.total_children) * 100 : 0;
  
  let undernutritionStatus = "LOW";
  if (malnutritionPercentage > 30) undernutritionStatus = "CRITICAL";
  else if (malnutritionPercentage > 20) undernutritionStatus = "HIGH";
  else if (malnutritionPercentage > 10) undernutritionStatus = "MODERATE";
  
  let trendIndicator = "Stable";
  if (props.severe_count > props.moderate_count * 2) trendIndicator = "⚠️ Worsening";
  else if (props.severe_count === 0 && props.moderate_count === 0) trendIndicator = "✓ Improving";
  
  const alertLevel = props.risk_level === "critical" ? "🚨 URGENT ACTION" : props.risk_level === "high" ? "⚠️ HIGH PRIORITY" : "📋 MONITOR";
  
  return { undernutritionStatus, trendIndicator, alertLevel };
}

// ─── Popup HTML for barangay labels with enhanced information ──────────────
function buildPopupHtml(props: BarangaySeverity) {
  const tier = TIERS.find((t) => props.malnutrition_count >= t.min && props.malnutrition_count <= t.max) ?? TIERS[0];
  const riskInfo = getRiskLevelInfo(props.risk_level);
  const newsIndicators = buildNewsIndicators(props);
  const malnutritionPercentage = props.total_children > 0 ? ((props.malnutrition_count / props.total_children) * 100).toFixed(1) : "0";
  const severePercentage = props.total_children > 0 ? ((props.severe_count / props.total_children) * 100).toFixed(1) : "0";
  const moderatePercentage = props.total_children > 0 ? ((props.moderate_count / props.total_children) * 100).toFixed(1) : "0";

  return `
    <div style="padding:14px;width:100%;font-family:system-ui,-apple-system,sans-serif;line-height:1.4;color:#0f172a;background:#fff;">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;border-bottom:2px solid ${riskInfo.bg};padding-bottom:8px;">
        <span style="font-weight:700;font-size:15px;color:#0f172a;">${props.name}</span>
        <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:16px;background:${riskInfo.bg};color:${riskInfo.color};border:1px solid ${riskInfo.color};white-space:nowrap;">
          ${riskInfo.icon} ${props.risk_level.toUpperCase()}
        </span>
      </div>

      <!-- Main Content Grid - Now with better spacing for wider popup -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
        
        <!-- TOP LEFT: Algorithm-Driven Risk Prediction -->
        <div style="border-left:4px solid #0284c7;padding-left:10px;">
          <div style="font-size:10px;font-weight:700;color:#0284c7;text-transform:uppercase;margin-bottom:5px;">🧠 RISK</div>
          <div style="font-size:11px;color:#334155;line-height:1.6;">
            <div style="margin-bottom:3px;"><strong>Class:</strong> ${props.risk_level.toUpperCase()}</div>
            <div style="margin-bottom:3px;"><strong>Confidence:</strong> ${props.malnutrition_count > 5 ? "High" : props.malnutrition_count > 0 ? "Moderate" : "Low"}</div>
            <div style="font-size:10px;"><strong>Trend:</strong> ${props.severe_count > 2 ? "🔴 Worsening" : props.malnutrition_count > 10 ? "🟡 Stable" : "🟢 Improving"}</div>
          </div>
        </div>

        <!-- TOP MIDDLE: Nutrition Early Warning System -->
        <div style="border-left:4px solid #f59e0b;padding-left:10px;">
          <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:5px;">📊 NEWS</div>
          <div style="font-size:11px;color:#334155;line-height:1.6;">
            <div style="margin-bottom:3px;"><strong>Undernutrition:</strong> <span style="color:${riskInfo.color};font-weight:700;font-size:10px;">${newsIndicators.undernutritionStatus}</span></div>
            <div style="margin-bottom:3px;"><strong>Trend:</strong> ${newsIndicators.trendIndicator}</div>
            <div style="font-size:10px;"><strong>Alert:</strong> ${newsIndicators.alertLevel}</div>
          </div>
        </div>

        <!-- TOP RIGHT: Case Severity -->
        <div style="border-left:4px solid #ef4444;padding-left:10px;">
          <div style="font-size:10px;font-weight:700;color:#7f1d1d;text-transform:uppercase;margin-bottom:5px;">⚠️ SEVERITY</div>
          <div style="font-size:11px;color:#334155;line-height:1.6;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;gap:4px;">
              <span style="font-size:10px;">🔴 SAM:</span>
              <span style="display:flex;gap:3px;align-items:center;">
                <strong style="color:#dc2626;font-size:11px;">${props.severe_count}</strong>
                <span style="font-size:9px;color:#fff;background:#dc2626;padding:2px 4px;border-radius:2px;font-weight:700;">${severePercentage}%</span>
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
              <span style="font-size:10px;">🟠 MAM:</span>
              <span style="display:flex;gap:3px;align-items:center;">
                <strong style="color:#f97316;font-size:11px;">${props.moderate_count}</strong>
                <span style="font-size:9px;color:#fff;background:#f97316;padding:2px 4px;border-radius:2px;font-weight:700;">${moderatePercentage}%</span>
              </span>
            </div>
          </div>
        </div>

        <!-- BOTTOM LEFT: Coverage & Prevalence -->
        <div style="border-left:4px solid #10b981;padding-left:10px;">
          <div style="font-size:10px;font-weight:700;color:#047857;text-transform:uppercase;margin-bottom:5px;">📋 COVERAGE</div>
          <div style="font-size:11px;color:#334155;line-height:1.7;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-size:10px;">Children Monitored:</span><strong style="font-size:11px;">${props.total_children}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-size:10px;">Cases:</span><strong style="color:${tier.labelColor};font-size:11px;">${props.malnutrition_count}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="font-size:10px;">Prevalence Rate:</span><strong style="font-size:11px;">${props.prevalence_rate}%</strong></div>
          </div>
        </div>

        <!-- BOTTOM MIDDLE: Heatmap Intensity -->
        <div style="border-left:4px solid ${tier.color};padding-left:10px;">
          <div style="font-size:10px;font-weight:700;color:${tier.labelColor};text-transform:uppercase;margin-bottom:5px;">🔥 INTENSITY</div>
          <div style="font-size:11px;color:#334155;line-height:1.7;">
            <div style="margin-bottom:3px;"><strong>Intensity Tier:</strong> <span style="background:${tier.color};color:#fff;padding:3px 6px;border-radius:8px;font-size:10px;font-weight:700;">${tier.label}</span></div>
            <div style="margin-bottom:3px;"><strong>Case Range:</strong> <span style="font-size:10px;">${tier.range}</span></div>
            <div style="font-size:10px;"><strong>Status:</strong> 🔴 Monitoring</div>
          </div>
        </div>

        <!-- BOTTOM RIGHT: Summary -->
        <div style="border-left:4px solid #8b5cf6;padding-left:10px;">
          <div style="font-size:10px;font-weight:700;color:#6d28d9;text-transform:uppercase;margin-bottom:5px;">📊 SUMMARY</div>
          <div style="font-size:11px;color:#334155;line-height:1.7;">
            <div style="margin-bottom:3px;"><strong>Total Cases:</strong> <span style="font-weight:700;color:#0f172a;font-size:11px;">${props.malnutrition_count}</span></div>
            <div style="margin-bottom:3px;"><strong>Malnutrition %:</strong> <span style="font-weight:700;color:#0f172a;font-size:11px;">${malnutritionPercentage}%</span></div>
            <div style="font-size:10px;"><strong>Overall Status:</strong> ${props.risk_level === "critical" ? "🔴 Critical" : props.risk_level === "high" ? "🟠 High" : props.risk_level === "medium" ? "🟡 Medium" : "🟢 Low"}</div>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div style="height:2px;background:#e2e8f0;margin-bottom:10px;"></div>

      <!-- Location -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px;font-size:10px;color:#334155;">
        <span style="font-weight:700;color:#475569;">📍 Location</span>
        <span style="font-family:monospace;font-weight:600;">${formatCoordinate(props.lat)}°N, ${formatCoordinate(props.lng)}°E</span>
      </div>

      <!-- Footer: Key Metrics Bar (EXPANDED for wider popup) -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;padding:10px 0;font-size:10px;">
        <div style="text-align:center;padding-right:8px;border-right:1px solid #e2e8f0;">
          <span style="color:#64748b;font-weight:700;display:block;margin-bottom:4px;">👶 Monitored</span>
          <div style="font-weight:700;color:#0f172a;font-size:12px;">${props.total_children}</div>
        </div>
        <div style="text-align:center;padding:0 8px;border-right:1px solid #e2e8f0;">
          <span style="color:#64748b;font-weight:700;display:block;margin-bottom:4px;">⚠️ Cases</span>
          <div style="font-weight:700;color:${tier.labelColor};font-size:12px;">${props.malnutrition_count}</div>
        </div>
        <div style="text-align:center;padding:0 8px;border-right:1px solid #e2e8f0;">
          <span style="color:#64748b;font-weight:700;display:block;margin-bottom:4px;">📈 Prevalence</span>
          <div style="font-weight:700;color:#0f172a;font-size:12px;">${props.prevalence_rate}%</div>
        </div>
        <div style="text-align:center;padding-left:8px;">
          <span style="color:#64748b;font-weight:700;display:block;margin-bottom:4px;">🚨 Risk Level</span>
          <div style="font-weight:700;color:${riskInfo.color};font-size:11px;padding:2px 6px;background:${riskInfo.bg};border-radius:8px;display:inline-block;border:1px solid ${riskInfo.color};">${props.risk_level.toUpperCase()}</div>
        </div>
      </div>
    </div>`;
}

// ─── Geographic bounds for IDW canvas ────────────────────────────────────────
const GEO = { south: 9.07, north: 9.20, west: 125.51, east: 125.65 } as const;

// ─── IDW Canvas heatmap layer (malnutrition intensity) ───────────────────────
function IDWCanvasLayer({ data, showLabels = true, colorMode = "red-yellow-green", opacity = 0.82 }: { data: BarangaySeverity[]; showLabels?: boolean; colorMode?: HeatmapColorMode; opacity?: number }) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const groupRef   = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    // Update TIERS based on selected color mode
    TIERS = COLOR_PALETTES[colorMode];

    if (!data || data.length === 0) return;

    const pts = data
      .map((b) => isValidCoordinate(b.lat, b.lng) ? { lat: b.lat, lng: b.lng, w: getWeight(b.malnutrition_count) } : null)
      .filter(Boolean) as { lat: number; lng: number; w: number }[];
    const CW = 400, CH = 400;
    const raw = document.createElement("canvas");
    raw.width = CW; raw.height = CH;
    const rawCtx = raw.getContext("2d")!;
    const imgData = rawCtx.createImageData(CW, CH);
    const px = imgData.data;
    const latRange = GEO.north - GEO.south;
    const lngRange = GEO.east  - GEO.west;
    const maxRadius = 0.025;

    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const lat = GEO.north - (y / CH) * latRange;
        const lng = GEO.west  + (x / CW) * lngRange;
        let minDist2 = Infinity;
        for (const p of pts) {
          const d2 = (lat - p.lat) ** 2 + (lng - p.lng) ** 2;
          if (d2 < minDist2) minDist2 = d2;
        }
        const minDist = Math.sqrt(minDist2);
        const i = (y * CW + x) * 4;
        if (minDist >= maxRadius) {
          px[i] = px[i+1] = px[i+2] = px[i+3] = 0;
        } else {
          // Keep each pixel in the nearest barangay's case-count band. IDW blending
          // can otherwise turn a low-count barangay orange because of a nearby high one.
          const nearestPoint = pts.reduce((nearest, point) => {
            const distance = (lat - point.lat) ** 2 + (lng - point.lng) ** 2;
            const nearestDistance = (lat - nearest.lat) ** 2 + (lng - nearest.lng) ** 2;
            return distance < nearestDistance ? point : nearest;
          });
          const intensity = nearestPoint.w;
          const [r, g, b] = intensityToRGB(intensity);
          const ratio = minDist / maxRadius;
          const fade = Math.cos(ratio * Math.PI / 2) ** 2;
          px[i] = r; px[i+1] = g; px[i+2] = b;
          px[i+3] = Math.round(fade * 215);
        }
      }
    }
    rawCtx.putImageData(imgData, 0, 0);

    const blurred = document.createElement("canvas");
    blurred.width = CW; blurred.height = CH;
    const bCtx = blurred.getContext("2d")!;
    bCtx.filter = "blur(14px)";
    bCtx.drawImage(raw, 0, 0);

    const overlay = L.imageOverlay(blurred.toDataURL("image/png"), [[GEO.south, GEO.west],[GEO.north, GEO.east]], {
      opacity: opacity, interactive: false, zIndex: 400,
    });
    overlay.addTo(map);
    overlayRef.current = overlay;

    // Barangay count labels (only if showLabels is true)
    const group = L.layerGroup().addTo(map);
    groupRef.current = group;
    if (showLabels) {
      data.forEach((b) => {
        if (!b.lat || !b.lng) return;
        const lc = getLabelColor(b.malnutrition_count);
        const short = b.name.replace(/^Poblacion\s+/, "Pob. ");
        const icon = L.divIcon({
          className: "",
          iconAnchor: [0, 0],
          html: `<div style="transform:translate(-50%,-50%);text-align:center;pointer-events:auto;cursor:pointer;">
            <div style="font-size:10px;font-weight:900;color:${lc};text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000,0 0 6px rgba(0,0,0,0.9);line-height:1.1;white-space:nowrap;">${b.malnutrition_count}</div>
            <div style="font-size:7px;font-weight:700;color:#fff;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;white-space:nowrap;margin-top:1px;">${short}</div>
          </div>`,
        });
        const marker = L.marker([b.lat, b.lng], { icon, interactive: true, zIndexOffset: 700 });
        const popup = L.popup({ closeButton: false, autoClose: true, closeOnClick: false, offset: [0, -8], maxWidth: 400 }).setContent(buildPopupHtml(b));
        marker.bindPopup(popup);
        marker.on("mouseover", () => { 
          marker.openPopup(); 
        });
        marker.on("mouseout", () => { 
          marker.closePopup(); 
        });
        group.addLayer(marker);
      });
    }

    return () => {
      if (overlayRef.current) map.removeLayer(overlayRef.current);
      if (groupRef.current)   map.removeLayer(groupRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, showLabels, colorMode, opacity]);

  return null;
}

// ─── Icon layers display ──────────────────────────────────────────────────────
function IconLayers({
  showHotspots,
  showProgramCoverage,
  showHomeVisits,
  showFacilities,
  showPredictions,
}: {
  showHotspots: boolean;
  showProgramCoverage: boolean;
  showHomeVisits: boolean;
  showFacilities: boolean;
  showPredictions: boolean;
}) {
  return null; // Removed - icons will be displayed in legend instead
}

// ─── Layer icons overlay on barangays ──────────────────────────────────────────
function LayerIconsOverlay({
  showHotspots,
  showProgramCoverage,
  showHomeVisits,
  showFacilities,
  showPredictions,
  barangayList,
}: {
  showHotspots: boolean;
  showProgramCoverage: boolean;
  showHomeVisits: boolean;
  showFacilities: boolean;
  showPredictions: boolean;
  barangayList: BarangaySeverity[];
}) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!barangayList || barangayList.length === 0) return;

    // Remove old markers
    if (groupRef.current) map.removeLayer(groupRef.current);
    groupRef.current = null;

    // Check if any layer is enabled
    const anyLayerEnabled = showHotspots || showProgramCoverage || showHomeVisits || showFacilities || showPredictions;
    if (!anyLayerEnabled) return;

    const group = L.layerGroup().addTo(map);
    groupRef.current = group;

    // Create icons for each barangay
    barangayList.forEach((barangay) => {
      if (!barangay.lat || !barangay.lng) return;

      let icons = [];
      if (showHotspots) icons.push("⚠️");
      if (showProgramCoverage) icons.push("📍");
      if (showHomeVisits) icons.push("🏠");
      if (showFacilities) icons.push("🏥");
      if (showPredictions) icons.push("🧠");

      if (icons.length === 0) return;

      // Create a div icon with all active layer icons (no background)
      const iconHtml = icons.map((icon) => `<span style="margin: 0 1px;">${icon}</span>`).join("");
      
      const divIcon = L.divIcon({
        className: "",
        html: `<div style="
          display: flex;
          gap: 1px;
          font-size: 14px;
          filter: drop-shadow(0 0 2px rgba(0,0,0,0.6));
          line-height: 1;
        ">${iconHtml}</div>`,
        iconSize: [40, 18],
        iconAnchor: [20, 9],
      });

      const marker = L.marker([barangay.lat, barangay.lng], { 
        icon: divIcon, 
        interactive: false,
        zIndexOffset: 500 
      }).addTo(group);
    });

    return () => {
      if (groupRef.current) map.removeLayer(groupRef.current);
      groupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHotspots, showProgramCoverage, showHomeVisits, showFacilities, showPredictions, barangayList]);

  return null;
}

function ChildMarkersLayer({
  markers,
  showProgramCoverage,
  heatmapOn,
}: {
  markers: any[];
  showProgramCoverage: boolean;
  heatmapOn: boolean;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom());
    map.on("zoomend", updateZoom);
    return () => map.off("zoomend", updateZoom);
  }, [map]);

  if (!showProgramCoverage || heatmapOn || zoom < 15) return null;

  return (
    <>
      {markers.map((marker: any) => (
        <Marker
          key={marker.id}
          position={[marker.lat, marker.lng]}
          icon={pinIcon(marker.overall_status)}
          eventHandlers={{
            mouseover: (event) => event.target.openPopup(),
            mouseout: (event) => event.target.closePopup(),
          }}
        >
          <Popup closeButton={false} autoClose closeOnClick={false}>
            <strong className="block text-slate-800">{marker.name}</strong>
            <span className="text-xs font-semibold" style={{ color: getStatusColor(marker.overall_status).hex }}>
              {(marker.overall_status ?? "normal").replace(/_/g, " ")}
            </span>
            <br />
            <span className="text-xs text-slate-500">
              Age: {marker.age_months} months
              <br />
              Last measured: {marker.last_measured}
              <br />
              Lat: {formatCoordinate(marker.lat)}, Lng: {formatCoordinate(marker.lng)}
            </span>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

// ─── Helper: detect clicked feature and navigate ─────────────────────────────
// NOTE: Removed - BarangayGeoJSON component handles all click/hover events via onEachFeature
// function MapClickHandler({ 
//   data, 
//   user 
// }: { 
//   data: any;
//   user: any;
// }) {
//   const router = useRouter();
//   const map = useMap();
//
//   useEffect(() => {
//     if (!map || !data) return;
//     // ... rest of function commented out
//   }, [map, data, user?.role, router]);
//
//   return null;
// }

// Helper function for point-in-polygon detection
// NOTE: Not used anymore since BarangayGeoJSON handles all interactions
// function pointInPolygon(point: [number, number], ringCoordinates: number[][]): boolean {
//   const [x, y] = point;
//   const ring = ringCoordinates; // These are already the ring coordinates
//   let inside = false;

//   for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
//     const xi = ring[i][0];
//     const yi = ring[i][1];
//     const xj = ring[j][0];
//     const yj = ring[j][1];

//     const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
//     if (intersect) inside = !inside;
//   }

//   return inside;
// }

// ─── Custom Hover Overlay Component (Canvas-based) ───────────────────────────
function HoverOverlay({ 
  hoveredFeature, 
  mousePosition 
}: { 
  hoveredFeature: any | null;
  mousePosition: { x: number; y: number } | null;
}) {
  if (!hoveredFeature || !mousePosition) return null;

  const props = hoveredFeature.properties as BarangaySeverity;
  
  // Get risk info styling
  const riskInfo = getRiskLevelInfo(props.risk_level || 'low');
  const tier = TIERS.find((t) => props.malnutrition_count >= t.min && props.malnutrition_count <= t.max) ?? TIERS[0];
  const newsIndicators = buildNewsIndicators(props);
  
  // Calculate additional metrics
  const malnutritionPercentage = props.total_children > 0 
    ? ((props.malnutrition_count / props.total_children) * 100).toFixed(1) 
    : "0.0";
  const severePercentage = props.total_children > 0 
    ? ((props.severe_count / props.total_children) * 100).toFixed(1) 
    : "0.0";
  const moderatePercentage = props.total_children > 0 
    ? ((props.moderate_count / props.total_children) * 100).toFixed(1) 
    : "0.0";
  
  // Determine position (left or right of cursor)
  const rightEdgeBarangays = ['Del Pilar', 'Poblacion 8', 'Poblacion 10', 'Katugasan'];
  const showLeft = rightEdgeBarangays.includes(props.name);
  
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    left: showLeft ? mousePosition.x - 580 : mousePosition.x + 20,
    top: mousePosition.y - 180,
    maxWidth: '560px',
    minWidth: '540px',
    backgroundColor: 'white',
    border: `3px solid ${riskInfo.color}`,
    borderRadius: '12px',
    padding: '0',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 99999,
    pointerEvents: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  return (
    <div style={overlayStyle}>
      {/* Header */}
      <div style={{ 
        background: riskInfo.bg, 
        borderBottom: `2px solid ${riskInfo.color}`,
        padding: '10px 14px',
        borderRadius: '9px 9px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px'
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f172a' }}>
          {props.name}
        </div>
        <div style={{ 
          fontSize: '10px', 
          fontWeight: '700', 
          padding: '3px 10px', 
          borderRadius: '12px',
          background: 'white',
          color: riskInfo.color,
          border: `1.5px solid ${riskInfo.color}`,
          whiteSpace: 'nowrap'
        }}>
          {riskInfo.icon} {(props.risk_level || 'low').toUpperCase()}
        </div>
      </div>
      
      {/* Main Content Grid */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          
          {/* TOP LEFT: Algorithm-Driven Risk Prediction */}
          <div style={{ borderLeft: '4px solid #0284c7', paddingLeft: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#0284c7', textTransform: 'uppercase', marginBottom: '5px' }}>🧠 RISK</div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.6' }}>
              <div style={{ marginBottom: '3px' }}><strong>Class:</strong> {(props.risk_level || 'low').toUpperCase()}</div>
              <div style={{ marginBottom: '3px' }}><strong>Confidence:</strong> {props.malnutrition_count > 5 ? "High" : props.malnutrition_count > 0 ? "Moderate" : "Low"}</div>
              <div style={{ fontSize: '10px' }}><strong>Trend:</strong> {props.severe_count > 2 ? "🔴 Worsening" : props.malnutrition_count > 10 ? "🟡 Stable" : "🟢 Improving"}</div>
            </div>
          </div>

          {/* TOP MIDDLE: Nutrition Early Warning System */}
          <div style={{ borderLeft: '4px solid #f59e0b', paddingLeft: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', marginBottom: '5px' }}>📊 NEWS</div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.6' }}>
              <div style={{ marginBottom: '3px' }}><strong>Undernutrition:</strong> <span style={{ color: riskInfo.color, fontWeight: '700', fontSize: '10px' }}>{newsIndicators.undernutritionStatus}</span></div>
              <div style={{ marginBottom: '3px' }}><strong>Trend:</strong> {newsIndicators.trendIndicator}</div>
              <div style={{ fontSize: '10px' }}><strong>Alert:</strong> {newsIndicators.alertLevel}</div>
            </div>
          </div>

          {/* TOP RIGHT: Case Severity */}
          <div style={{ borderLeft: '4px solid #ef4444', paddingLeft: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#7f1d1d', textTransform: 'uppercase', marginBottom: '5px' }}>⚠️ SEVERITY</div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', gap: '4px' }}>
                <span style={{ fontSize: '10px' }}>🔴 SAM:</span>
                <span style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  <strong style={{ color: '#dc2626', fontSize: '11px' }}>{props.severe_count || 0}</strong>
                  <span style={{ fontSize: '9px', color: '#fff', background: '#dc2626', padding: '2px 4px', borderRadius: '2px', fontWeight: '700' }}>{severePercentage}%</span>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px' }}>🟠 MAM:</span>
                <span style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  <strong style={{ color: '#f97316', fontSize: '11px' }}>{props.moderate_count || 0}</strong>
                  <span style={{ fontSize: '9px', color: '#fff', background: '#f97316', padding: '2px 4px', borderRadius: '2px', fontWeight: '700' }}>{moderatePercentage}%</span>
                </span>
              </div>
            </div>
          </div>

          {/* BOTTOM LEFT: Coverage & Prevalence */}
          <div style={{ borderLeft: '4px solid #10b981', paddingLeft: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', marginBottom: '5px' }}>📋 COVERAGE</div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}><span style={{ fontSize: '10px' }}>Children Monitored:</span><strong style={{ fontSize: '11px' }}>{props.total_children || 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}><span style={{ fontSize: '10px' }}>Cases:</span><strong style={{ color: tier.labelColor, fontSize: '11px' }}>{props.malnutrition_count || 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '10px' }}>Prevalence Rate:</span><strong style={{ fontSize: '11px' }}>{props.prevalence_rate || 0}%</strong></div>
            </div>
          </div>

          {/* BOTTOM MIDDLE: Heatmap Intensity */}
          <div style={{ borderLeft: `4px solid ${tier.color}`, paddingLeft: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: tier.labelColor, textTransform: 'uppercase', marginBottom: '5px' }}>🔥 INTENSITY</div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.7' }}>
              <div style={{ marginBottom: '3px' }}><strong>Intensity Tier:</strong> <span style={{ background: tier.color, color: '#fff', padding: '3px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '700' }}>{tier.label}</span></div>
              <div style={{ marginBottom: '3px' }}><strong>Case Range:</strong> <span style={{ fontSize: '10px' }}>{tier.range}</span></div>
              <div style={{ fontSize: '10px' }}><strong>Status:</strong> 🔴 Monitoring</div>
            </div>
          </div>

          {/* BOTTOM RIGHT: Summary */}
          <div style={{ borderLeft: '4px solid #8b5cf6', paddingLeft: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6d28d9', textTransform: 'uppercase', marginBottom: '5px' }}>📊 SUMMARY</div>
            <div style={{ fontSize: '11px', color: '#334155', lineHeight: '1.7' }}>
              <div style={{ marginBottom: '3px' }}><strong>Total Cases:</strong> <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '11px' }}>{props.malnutrition_count || 0}</span></div>
              <div style={{ marginBottom: '3px' }}><strong>Malnutrition %:</strong> <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '11px' }}>{malnutritionPercentage}%</span></div>
              <div style={{ fontSize: '10px' }}><strong>Overall Status:</strong> {props.risk_level === "critical" ? "🔴 Critical" : props.risk_level === "high" ? "🟠 High" : props.risk_level === "medium" ? "🟡 Medium" : "🟢 Low"}</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '2px', background: '#e2e8f0', marginBottom: '10px' }}></div>

        {/* Footer: Key Metrics Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', padding: '10px 0', fontSize: '10px' }}>
          <div style={{ textAlign: 'center', paddingRight: '8px', borderRight: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>👶 Monitored</span>
            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12px' }}>{props.total_children || 0}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 8px', borderRight: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>⚠️ Cases</span>
            <div style={{ fontWeight: '700', color: tier.labelColor, fontSize: '12px' }}>{props.malnutrition_count || 0}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 8px', borderRight: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>📈 Prevalence</span>
            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12px' }}>{props.prevalence_rate || 0}%</div>
          </div>
          <div style={{ textAlign: 'center', paddingLeft: '8px' }}>
            <span style={{ color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '4px' }}>🚨 Risk Level</span>
            <div style={{ fontWeight: '700', color: riskInfo.color, fontSize: '11px', padding: '2px 6px', background: riskInfo.bg, borderRadius: '8px', display: 'inline-block', border: `1px solid ${riskInfo.color}` }}>{(props.risk_level || 'low').toUpperCase()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Barangay/Purok GeoJSON with click navigation ─────────────────────────────
function BarangayGeoJSON({ 
  data, 
  user,
  onHover,
  setSelectedPurokId,
  setShowPurokModal,
  showOnlyOutlines = false,
  enableChoropleth = false,
  barangaySeverities = [],
}: { 
  data: any; 
  user: any;
  onHover: (feature: any | null, position: { x: number; y: number } | null) => void;
  setSelectedPurokId: (id: string | null) => void;
  setShowPurokModal: (show: boolean) => void;
  showOnlyOutlines?: boolean;
  enableChoropleth?: boolean;
  barangaySeverities?: BarangaySeverity[];
}) {
  const router = useRouter();
  const map = useMap();

  // Debug logging
  useEffect(() => {
    console.log('[BarangayGeoJSON] Component mounted/updated');
    console.log('[BarangayGeoJSON] Data features count:', data?.features?.length || 0);
    console.log('[BarangayGeoJSON] User role:', user?.role);
    console.log('[BarangayGeoJSON] Choropleth enabled:', enableChoropleth);
    console.log('[BarangayGeoJSON] Severities count:', barangaySeverities.length);
    
    // Log all features and their types
    if (data?.features) {
      const featureTypes = data.features.map((f: any) => ({
        name: f.properties?.name,
        type: f.properties?.featureType || 'barangay',
        id: f.properties?.id
      }));
      console.log('[BarangayGeoJSON] All features:', featureTypes);
    }
  }, [data, user, enableChoropleth, barangaySeverities]);

  return (
    <GeoJSON
      key={`${JSON.stringify(data)}-${enableChoropleth}`}
      data={data}
      interactive={true}
      style={(feature) => {
        // If choropleth is enabled, use data-driven colors
        if (enableChoropleth && feature?.properties?.featureType !== "purok") {
          return getChoroplethStyle(feature, barangaySeverities, false);
        }
        
        // When showing only outlines (Heatmap mode), show clear visible lines
        if (showOnlyOutlines) {
          if (feature?.properties?.featureType === "purok") {
            return {
              color: "#000000",      // Black border for puroks in heatmap mode
              fillColor: "transparent",
              fillOpacity: 0,
              weight: 2,
              opacity: 0.7,
            };
          }
          // Barangay borders in heatmap mode
          return {
            color: "#1a1a1a",      // Dark border
            fillColor: "transparent",
            fillOpacity: 0,
            weight: 2.5,
            opacity: 0.6,
          };
        }
        
        // Different styles for barangays vs puroks (normal mode)
        if (feature?.properties?.featureType === "purok") {
          return {
            color: "#f97316",      // Orange border for puroks
            fillColor: "#fed7aa",  // Light orange fill
            fillOpacity: 0.3,
            weight: 2,
            opacity: 0.8,
            // Make puroks appear above barangays
            pane: 'overlayPane',
          };
        }
        // Barangay style - invisible boundary
        return {
          color: "#d1d5db",
          fillColor: "#f3f4f6",
          fillOpacity: 0.1,
          weight: 1,
          opacity: 0.3,
          // Barangays stay below puroks
          pane: 'tilePane',
        };
      }}
      onEachFeature={(feature, layer) => {
        console.log('[BarangayGeoJSON] onEachFeature called for:', feature.properties?.name);
        try {
          // Show permanent labels for both barangays and puroks for navigation
          if (feature.properties?.name) {
            const isBarangay = feature.properties?.featureType !== "purok";
            
            // In choropleth mode, add prevalence info to tooltip
            let labelText = feature.properties.name;
            if (enableChoropleth && isBarangay) {
              const severity = barangaySeverities.find(b => b.name === feature.properties.name);
              if (severity) {
                const prevalenceRate = severity.total_children > 0 
                  ? ((severity.malnutrition_count / severity.total_children) * 100).toFixed(1)
                  : '0.0';
                labelText = `${feature.properties.name}\n${prevalenceRate}% prevalence`;
              }
            }
            
            layer.bindTooltip(labelText, {
              permanent: true,
              direction: "center",
              className: isBarangay ? "barangay-label" : "purok-label",
              opacity: 0, // Force tooltip container to be invisible
            });
          }
          const props = feature.properties as BarangaySeverity;
          
          // NOTE: Removed popup binding - click now navigates directly to details page
          
          // Create a TOOLTIP for hover (simpler, no flickering)
          const tooltipContent = `<div style="font-weight: bold; font-size: 13px; padding: 4px 8px;">${props.name}</div>`;
          layer.bindTooltip(tooltipContent, {
            permanent: false,
            direction: 'right',
            offset: [10, 0],
            className: 'barangay-hover-tooltip',
            opacity: 0.95,
          });
          
          layer.on({
            mouseover: (e) => {
              try {
                const target = e.target as L.Polygon;
                
                // Get mouse position and feature
                const mouseEvent = e.originalEvent as MouseEvent;
                onHover(feature, { x: mouseEvent.clientX, y: mouseEvent.clientY });
                
                // Highlight on hover
                const featureType = (e.target.feature?.properties?.featureType || "barangay");
                if (featureType === "purok") {
                  target.setStyle({ color: "#ea580c", fillColor: "#fb923c", fillOpacity: 0.5, weight: 3 });
                } else {
                  target.setStyle({ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.2, weight: 2, opacity: 1 });
                }
              } catch (err) {
                console.warn('[BarangayGeoJSON] Error on mouseover:', err);
              }
            },
            mouseout: (e) => {
              try {
                const target = e.target as L.Polygon;
                
                // Clear hover overlay
                onHover(null, null);
                
                // Restore original style
                const featureType = (e.target.feature?.properties?.featureType || "barangay");
                if (featureType === "purok") {
                  target.setStyle({ color: "#f97316", fillColor: "#fed7aa", fillOpacity: 0.3, weight: 2, opacity: 0.8 });
                } else {
                  target.setStyle(barangayStyle);
                }
              } catch (err) {
                console.warn('[BarangayGeoJSON] Error on mouseout:', err);
              }
            },
            click: (e: L.LeafletMouseEvent) => {
              try {
                // Stop propagation
                L.DomEvent.stopPropagation(e);
                
                const target = e.target as L.Layer;
                const props = feature.properties as BarangaySeverity;
                
                // Check feature type - handle both undefined and explicit values
                const featureType = (props as any).featureType || "barangay";
                
                console.log('[BarangayGeoJSON] ========================================');
                console.log('[BarangayGeoJSON] CLICK EVENT FIRED!');
                console.log('[BarangayGeoJSON] Feature properties:', props);
                console.log('[BarangayGeoJSON] Feature type:', featureType);
                console.log('[BarangayGeoJSON] User role:', user?.role);
                console.log('[BarangayGeoJSON] Feature ID:', props.id);
                console.log('[BarangayGeoJSON] Feature name:', props.name);
                console.log('[BarangayGeoJSON] ========================================');
                
                // Navigate to portal based on feature type (no preview popup)
                if (featureType === "barangay" || featureType === undefined) {
                  // Clicking on barangay - navigate directly to barangay details page
                  console.log('[BarangayGeoJSON] → ACTION: Navigating to barangay portal');
                  const barangayName = encodeURIComponent(props.name);
                  const url = `/admin/barangays?selected=${barangayName}`;
                  console.log('[BarangayGeoJSON] → URL:', url);
                  router.push(url);
                  window.dispatchEvent(new Event('urlchange'));
                } else if (featureType === "purok") {
                  // Purok click behavior - navigate directly to purok management
                  console.log('[BarangayGeoJSON] → ACTION: Purok clicked');
                  console.log('[BarangayGeoJSON] → Purok ID:', props.id);
                  console.log('[BarangayGeoJSON] → Purok name:', props.name);
                  console.log('[BarangayGeoJSON] → User role:', user?.role);
                  
                  if (props.id) {
                    console.log('[BarangayGeoJSON] → ✅ Navigating to purok management...');
                    const url = `/admin/puroks?selected=${props.id}`;
                    console.log('[BarangayGeoJSON] → URL:', url);
                    router.push(url);
                    window.dispatchEvent(new Event('urlchange'));
                  } else {
                    console.error('[BarangayGeoJSON] → ❌ No purok ID found');
                  }
                } else {
                  // Fallback: just show the popup for unknown types
                  console.log('[BarangayGeoJSON] → Unknown feature type - showing popup only');
                  if (target && typeof (target as any).openPopup === 'function') {
                    (target as any).openPopup();
                  }
                }
              } catch (err) {
                console.error('[BarangayGeoJSON] ❌ CLICK ERROR:', err);
              }
            },
          });
        } catch (err) {
          console.error('[BarangayGeoJSON] Error in onEachFeature:', err);
        }
      }}
    />
  );
}

// ─── Main unified component ───────────────────────────────────────────────────
export function MapView({
  showHotspots = true,
  showProgramCoverage = true,
  showHomeVisits = false,
  showFacilities = true,
  showPredictions = false,
  focusBarangay = null,
  heatmapColorMode = "red-yellow-green",
  heatmapOn: externalHeatmapOn,
  setHeatmapOn: externalSetHeatmapOn,
  choroplethOn: externalChoroplethOn,
  setChoroplethOn: externalSetChoroplethOn,
  onTileLayerChange,
}: {
  showHotspots?: boolean;
  showProgramCoverage?: boolean;
  showHomeVisits?: boolean;
  showFacilities?: boolean;
  showPredictions?: boolean;
  focusBarangay?: string | null;
  heatmapColorMode?: HeatmapColorMode;
  heatmapOn?: boolean;
  setHeatmapOn?: (value: boolean) => void;
  choroplethOn?: boolean;
  setChoroplethOn?: (value: boolean) => void;
  onTileLayerChange?: (layerName: string) => void;
}) {
  const { user } = useAuthStore();
  const [tileKey, setTileKey] = useState<TileLayerKey>("Default");
  const tile = TILE_LAYERS[tileKey];
  
  // Notify parent when tile layer changes
  useEffect(() => {
    onTileLayerChange?.(tileKey);
  }, [tileKey, onTileLayerChange]);
  const [internalHeatmapOn, setInternalHeatmapOn] = useState(false);
  const [internalChoroplethOn, setInternalChoroplethOn] = useState(false);
  const heatmapOn = externalHeatmapOn !== undefined ? externalHeatmapOn : internalHeatmapOn;
  const setHeatmapOn = externalSetHeatmapOn || setInternalHeatmapOn;
  const choroplethOn = externalChoroplethOn !== undefined ? externalChoroplethOn : internalChoroplethOn;
  const setChoroplethOn = externalSetChoroplethOn || setInternalChoroplethOn;
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Hover overlay state
  const [hoveredFeature, setHoveredFeature] = useState<any | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  
  // Purok modal state
  const [showPurokModal, setShowPurokModal] = useState(false);
  const [selectedPurokId, setSelectedPurokId] = useState<string | null>(null);
  
  // Debug logging for modal state changes
  useEffect(() => {
    console.log('[MapView] Purok modal state changed:', { showPurokModal, selectedPurokId });
    if (showPurokModal && selectedPurokId) {
      console.log('[MapView] ✅ Modal should be visible now');
    } else {
      console.log('[MapView] ❌ Modal is hidden');
    }
  }, [showPurokModal, selectedPurokId]);
  
  // Fetch purok details when modal is open
  const purokDetailsQ = useQuery({
    queryKey: ["purok-details", selectedPurokId],
    queryFn: () => api.get(`/api/puroks/${selectedPurokId}`).then(r => r.data),
    enabled: !!selectedPurokId && showPurokModal,
  });
  
  const purokChildrenQ = useQuery({
    queryKey: ["purok-children", selectedPurokId],
    queryFn: () => api.get(`/api/children`, { params: { purok_id: selectedPurokId } }).then(r => r.data),
    enabled: !!selectedPurokId && showPurokModal,
  });

  const handleHover = (feature: any | null, position: { x: number; y: number } | null) => {
    setHoveredFeature(feature);
    setMousePosition(position);
  };

  // ── Child markers (coloured pins) ─────────────────────────────────────────
  const { data: markersData } = useQuery({
    queryKey: ["map-markers", user?.id, user?.barangay_id],
    queryFn: async () => {
      // For admin users, filter markers by their assigned barangay
      if (user?.role === "admin" && user?.barangay_id) {
        return api.get("/api/maps/child-markers", {
          params: { barangay_id: user.barangay_id }
        }).then((r) => r.data);
      }
      // For superadmin, get all markers
      return api.get("/api/maps/child-markers").then((r) => r.data);
    },
    enabled: !!user?.id,
  });

  // ── Barangay/purok choropleth (used for heatmap data + boundaries) ─────────
  const { data: barangaysData } = useQuery({
    queryKey: ["barangay-choropleth", user?.id, user?.barangay_id, focusBarangay],
    queryFn: async () => {
      // FOR ADMIN: Always filter by their assigned barangay
      // Use focusBarangay if provided, otherwise use user's barangay_id
      if (user?.role === "admin") {
        // Get the barangay name to filter by
        let barangayName = null;
        
        if (focusBarangay) {
          barangayName = decodeURIComponent(focusBarangay);
        } else if (user?.barangay_id) {
          // Fetch the barangay name from barangay_id
          try {
            const barangayRes = await api.get(`/api/barangays/${user.barangay_id}`);
            barangayName = barangayRes.data?.name;
          } catch (err) {
            console.error('[MapView] Failed to fetch admin barangay name:', err);
          }
        }
        
        if (barangayName) {
          const params = `?barangay_name=${encodeURIComponent(barangayName)}`;
          console.log('[MapView] Admin - Fetching data for barangay:', barangayName);
          return api.get(`/api/maps/barangay-choropleth${params}`).then((r) => r.data);
        }
      }
      
      // FOR SUPERADMIN: Always fetch ALL barangays (no filter)
      console.log('[MapView] Superadmin - Fetching all barangays');
      return api.get(`/api/maps/barangay-choropleth`).then((r) => r.data);
    },
    enabled: !!user?.id,
  });

  const markers = useMemo(() =>
    (markersData ?? []).filter((m: any) => isValidCoordinate(m.lat, m.lng)),
    [markersData]
  );

  const filteredBarangaysData = useMemo(() => {
    if (!barangaysData) return null;
    
    // Filter out excluded barangay names
    let features = (barangaysData.features ?? []).filter(
      (f: any) => !EXCLUDED_BARANGAY_NAMES.has(f.properties?.name)
    );
    
    // Data is already filtered by backend for admins, no need for additional filtering
    // Just return the features as-is
    
    return {
      ...barangaysData,
      features,
    };
  }, [barangaysData]);

  // Split data into barangays and puroks for separate rendering
  const barangayFeatures = useMemo(() => {
    if (!filteredBarangaysData) return null;
    const features = filteredBarangaysData.features?.filter(
      (f: any) => f.properties?.featureType !== "purok"
    ) || [];
    console.log('[MapView] Barangay features:', features.length);
    return {
      ...filteredBarangaysData,
      features
    };
  }, [filteredBarangaysData]);

  const purokFeatures = useMemo(() => {
    if (!filteredBarangaysData) return null;
    const features = filteredBarangaysData.features?.filter(
      (f: any) => f.properties?.featureType === "purok"
    ) || [];
    console.log('[MapView] Purok features:', features.length);
    // Debug: log first purok to see structure
    if (features.length > 0) {
      console.log('[MapView] Sample purok feature:', features[0]);
    }
    return {
      ...filteredBarangaysData,
      features
    };
  }, [filteredBarangaysData]);

  // Resolve the selected purok's coordinates from its map feature (marked at the exact recorded location)
  const selectedPurokCoords = useMemo(() => {
    if (!selectedPurokId || !purokFeatures?.features) return null;
    const feat = purokFeatures.features.find((f: any) => f.properties?.id === selectedPurokId);
    const lat = feat?.properties?.lat;
    const lng = feat?.properties?.lng;
    return isValidCoordinate(lat, lng) ? { lat, lng } : null;
  }, [selectedPurokId, purokFeatures]);

  // List used for IDW heatmap
  const barangayList: BarangaySeverity[] = useMemo(() =>
    (filteredBarangaysData?.features
      ?.filter((f: any) => f.properties?.featureType !== "purok")
      .map((f: any) => f.properties) ?? []),
    [filteredBarangaysData]
  );

  // Dynamic centre — admin zooms to their barangay, superadmin sees whole city
  const mapCenter = useMemo((): [number, number] => {
    if (!filteredBarangaysData?.features?.length) {
      return CABADBARAN_CENTER as [number, number];
    }
    
    // For admin users, center on their assigned barangay (first barangay feature)
    if (user?.role === "admin") {
      // Find the barangay feature (not purok)
      const barangayFeature = filteredBarangaysData.features.find(
        (f: any) => f.properties?.featureType === "barangay" || !f.properties?.featureType
      );
      
      if (barangayFeature) {
        const lat = barangayFeature.properties?.lat;
        const lng = barangayFeature.properties?.lng;
        if (isValidCoordinate(lat, lng)) {
          console.log('[MapView] Admin - Centering on barangay:', barangayFeature.properties?.name, `[${lat}, ${lng}]`);
          return [lat, lng];
        }
      }
    }
    
    // For superadmin or fallback, use default center
    return CABADBARAN_CENTER as [number, number];
  }, [user, filteredBarangaysData]);

  const mapZoom = focusBarangay || user?.role === "admin" ? 15 : 13;

  // Ensure container has proper dimensions before map initializes
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn('[MapView] Container not yet properly sized, map may fail to initialize');
      }
    }
  }, []);

  // Ensure container has proper dimensions before map initializes
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn('[MapView] Container not yet properly sized, map may fail to initialize');
      }
    }
  }, []);

  const [mapError, setMapError] = useState<string | null>(null);

  // Add error handler for map initialization
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('_leaflet_pos') || event.message?.includes('leaflet')) {
        console.error('[MapView] Leaflet error caught:', event.message);
        // Don't block the UI, just log it
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full h-full flex flex-col bg-gray-100 ${choroplethOn ? 'choropleth-mode' : ''}`}>

      {/* Layer switcher */}
      <LayerSwitcher active={tileKey} onChange={setTileKey} />

      <div className="flex-1 w-full min-h-0 relative overflow-hidden">
        <MapContainer 
          {...CABADBARAN_MAP_OPTIONS} 
          className={CABADBARAN_MAP_CLASS} 
          style={{ height: "100%", width: "100%", display: "block" }}
        >
          <MapCenterController center={mapCenter} zoom={mapZoom} />
          
          {/* Show tile layer only if NOT in Heatmap view mode */}
          {tileKey !== "Heatmap" && (
            <TileLayer key={tileKey} attribution={tile.attribution} url={tile.url} />
          )}
          
          {/* Street labels overlay for Satellite and Terrain views */}
          {(tileKey === "Satellite" || tileKey === "Terrain") && (
            <TileLayer
              url={STREET_LABELS_OVERLAY.url}
              attribution={STREET_LABELS_OVERLAY.attribution}
              zIndex={1000}
            />
          )}
          
          {/* For Heatmap tile layer mode, show ONLY heatmap with minimal background - no street labels */}
          {tileKey === "Heatmap" && (
            <TileLayer 
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
              zIndex={100}
              opacity={0.15}
            />
          )}

          {/* Barangay boundaries (render first, below puroks) */}
          {barangayFeatures && barangayFeatures.features?.length > 0 && (
            <BarangayGeoJSON 
              data={barangayFeatures} 
              user={user}
              onHover={handleHover}
              setSelectedPurokId={setSelectedPurokId}
              setShowPurokModal={setShowPurokModal}
              showOnlyOutlines={tileKey === "Heatmap" && !choroplethOn}
              enableChoropleth={choroplethOn}
              barangaySeverities={barangayList}
            />
          )}
          
          {/* Purok boundaries (render second, on top of barangays) */}
          {purokFeatures && purokFeatures.features?.length > 0 && (
            <BarangayGeoJSON 
              data={purokFeatures} 
              user={user}
              onHover={handleHover}
              setSelectedPurokId={setSelectedPurokId}
              setShowPurokModal={setShowPurokModal}
              showOnlyOutlines={tileKey === "Heatmap" && !choroplethOn}
              enableChoropleth={false}
              barangaySeverities={[]}
            />
          )}

          {/* Dark mask outside city */}
          <Polygon
            positions={CABADBARAN_MASK}
            pathOptions={{ color: "transparent", fillColor: "#1e293b", fillOpacity: 0.65 }}
            interactive={false}
          />

          <ChildMarkersLayer
            markers={markers}
            showProgramCoverage={showProgramCoverage}
            heatmapOn={heatmapOn}
          />

          {/* IDW heatmap overlay — show when: toggle is ON AND showHotspots is true AND choropleth is OFF, OR when Heatmap tile layer is selected AND choropleth is OFF */}
          {((heatmapOn && showHotspots) || tileKey === "Heatmap") && !choroplethOn && barangayList.length > 0 && (
            <IDWCanvasLayer 
              data={barangayList} 
              showLabels={tileKey !== "Heatmap"} 
              colorMode={heatmapColorMode}
              opacity={tileKey === "Heatmap" ? 0.95 : 0.82}
            />
          )}

          <LayerIconsOverlay
            showHotspots={showHotspots && !heatmapOn}
            showProgramCoverage={showProgramCoverage}
            showHomeVisits={showHomeVisits}
            showFacilities={showFacilities}
            showPredictions={showPredictions}
            barangayList={barangayList}
          />

        </MapContainer>
      </div>

      {/* ── Heatmap toggle button (inside map panel) — hidden when Heatmap tile is active ── */}
      {tileKey !== "Heatmap" && (
        <button
          onClick={() => setHeatmapOn(!heatmapOn)}
          className={`absolute bottom-4 left-4 z-[999] flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold border shadow-lg transition-all ${
            heatmapOn
              ? "bg-red-600 text-white border-red-500 hover:bg-red-700"
              : "bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${heatmapOn ? "bg-white animate-pulse" : "bg-slate-400"}`} />
          {heatmapOn ? "🔴 Heatmap ON" : "⚫ Heatmap OFF"}
        </button>
      )}

      {/* ── Marker legend (bottom-left, above toggle when heatmap off) ── */}
      {!heatmapOn && tileKey !== "Heatmap" && (
        <div className="absolute bottom-16 left-4 z-[999] flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-md backdrop-blur-sm">
          <p className="font-semibold text-slate-700">Nutritional Status</p>
          <span className="flex items-center gap-2 text-slate-600"><span className="h-3 w-3 rounded-full bg-red-600" />Severe Acute Malnutrition</span>
          <span className="flex items-center gap-2 text-slate-600"><span className="h-3 w-3 rounded-full bg-orange-500" />Moderate Acute Malnutrition</span>
          <span className="flex items-center gap-2 text-slate-600"><span className="h-3 w-3 rounded-full bg-green-500" />Normal / No Data</span>
        </div>
      )}

      {/* ── Heatmap legend (shown only when ON or Heatmap layer selected, but NOT when choropleth is ON) ── */}
      {(heatmapOn || tileKey === "Heatmap") && !choroplethOn && (
        <div className="absolute bottom-16 left-4 z-[999] flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-md backdrop-blur-sm max-w-[200px]">
          <p className="font-semibold text-slate-700">Malnutrition Intensity</p>
          {TIERS.map((tier) => (
            <span key={tier.label} className="flex items-center gap-2 text-slate-600">
              <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: tier.color }} />
              {tier.label} <span className="text-slate-400">({tier.range})</span>
            </span>
          ))}
        </div>
      )}
      
      {/* ── Choropleth legend (shown only when choropleth is ON) ── */}
      {choroplethOn && (
        <div className="absolute bottom-16 left-4 z-[999] flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-md backdrop-blur-sm max-w-[220px]">
          <p className="font-semibold text-slate-700">Malnutrition Prevalence</p>
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: '#800026' }} />
            Very High <span className="text-slate-400">(&gt;20%)</span>
          </span>
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: '#BD0026' }} />
            High <span className="text-slate-400">(15-20%)</span>
          </span>
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: '#E31A1C' }} />
            Moderate-High <span className="text-slate-400">(10-15%)</span>
          </span>
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: '#FC4E2A' }} />
            Moderate <span className="text-slate-400">(7-10%)</span>
          </span>
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: '#FD8D3C' }} />
            Low-Moderate <span className="text-slate-400">(4-7%)</span>
          </span>
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: '#FEB24C' }} />
            Low <span className="text-slate-400">(2-4%)</span>
          </span>
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: '#FED976' }} />
            Very Low <span className="text-slate-400">(0-2%)</span>
          </span>
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: '#FFEDA0' }} />
            No Cases <span className="text-slate-400">(0%)</span>
          </span>
        </div>
      )}
      
      {/* ── Custom Hover Overlay (Canvas-based, no flicker) ── */}
      <HoverOverlay hoveredFeature={hoveredFeature} mousePosition={mousePosition} />
      
      {/* ── Purok Details Modal ── */}
      {showPurokModal && selectedPurokId && (
        <div 
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            console.log('[MapView] Modal overlay clicked - closing modal');
            setShowPurokModal(false);
            setSelectedPurokId(null);
          }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div 
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => {
              console.log('[MapView] Modal content clicked - preventing close');
              e.stopPropagation();
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-emerald-50 shrink-0">
              <div className="flex items-center gap-3">
                <MapPin className="h-6 w-6 text-teal-600" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {purokDetailsQ.data?.name || "Loading..."}
                  </h2>
                  {purokDetailsQ.data && (
                    <p className="text-xs text-slate-600 font-medium">
                      Code: {purokDetailsQ.data.code || "N/A"} • Barangay: {purokDetailsQ.data.barangay_name || "N/A"}
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowPurokModal(false);
                  setSelectedPurokId(null);
                }}
                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              {purokDetailsQ.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                    <p className="text-slate-500">Loading purok details...</p>
                  </div>
                </div>
              ) : purokDetailsQ.data ? (
                <div className="p-6 space-y-6">
                  {/* Overview Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-600 rounded-lg p-4">
                      <p className="text-xs text-blue-600 font-bold uppercase">Children</p>
                      <p className="text-3xl font-black text-blue-800 mt-2">
                        {purokChildrenQ.data?.length || 0}
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-600 rounded-lg p-4">
                      <p className="text-xs text-red-600 font-bold uppercase">Active Cases</p>
                      <p className="text-3xl font-black text-red-800 mt-2">
                        {purokChildrenQ.data?.filter((c: any) => 
                          c.overall_status === 'severe_acute_malnutrition' || 
                          c.overall_status === 'moderate_acute_malnutrition'
                        ).length || 0}
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-600 rounded-lg p-4">
                      <p className="text-xs text-purple-600 font-bold uppercase">Households</p>
                      <p className="text-3xl font-black text-purple-800 mt-2">
                        {purokDetailsQ.data.household_count || 0}
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-600 rounded-lg p-4">
                      <p className="text-xs text-green-600 font-bold uppercase">Risk Level</p>
                      <p className="text-xl font-black text-green-800 mt-2 capitalize">
                        {purokDetailsQ.data.risk_level || "Low"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Purok Information */}
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Purok Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 font-semibold">Code:</p>
                        <p className="text-slate-800 font-mono">{purokDetailsQ.data.code || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Leader:</p>
                        <p className="text-slate-800">{purokDetailsQ.data.leader || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Population:</p>
                        <p className="text-slate-800">{purokDetailsQ.data.population || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Contact:</p>
                        <p className="text-slate-800">{purokDetailsQ.data.contact_number || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">BNS:</p>
                        <p className="text-slate-800">{purokDetailsQ.data.assigned_bns || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Health Worker:</p>
                        <p className="text-slate-800">{purokDetailsQ.data.assigned_health_worker || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Latitude:</p>
                        <p className="text-slate-800 font-mono">
                          {selectedPurokCoords ? formatCoordinate(selectedPurokCoords.lat) : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Longitude:</p>
                        <p className="text-slate-800 font-mono">
                          {selectedPurokCoords ? formatCoordinate(selectedPurokCoords.lng) : "N/A"}
                        </p>
                      </div>
                    </div>
                    {purokDetailsQ.data.notes && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-slate-500 font-semibold text-xs">Notes:</p>
                        <p className="text-slate-700 text-sm mt-1">{purokDetailsQ.data.notes}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Recent Children */}
                  {purokChildrenQ.data && purokChildrenQ.data.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200">
                      <h3 className="text-sm font-bold text-slate-800 px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Recent Children ({purokChildrenQ.data.length})
                      </h3>
                      <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                        {purokChildrenQ.data.slice(0, 10).map((child: any) => (
                          <div key={child.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-slate-800 text-sm">{child.name}</p>
                                <p className="text-xs text-slate-500">
                                  Age: {child.age_months} months • Gender: {child.gender}
                                </p>
                              </div>
                              <span 
                                className="text-xs font-bold px-2 py-1 rounded"
                                style={{ 
                                  backgroundColor: getStatusColor(child.overall_status).hex + '20',
                                  color: getStatusColor(child.overall_status).hex
                                }}
                              >
                                {(child.overall_status || 'normal').replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-slate-500">Failed to load purok details</p>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <button
                onClick={() => {
                  setShowPurokModal(false);
                  setSelectedPurokId(null);
                }}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
