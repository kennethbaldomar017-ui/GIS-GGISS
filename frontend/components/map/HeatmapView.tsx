"use client";
import { useState } from "react";
import { MapView } from "./MapView";

// Legacy entry point uses the same area-dot map as the main GIS page.
export function HeatmapView() {
  const [enabled, setEnabled] = useState(true);
  return <MapView heatmapOn={enabled} setHeatmapOn={setEnabled} />;
}
