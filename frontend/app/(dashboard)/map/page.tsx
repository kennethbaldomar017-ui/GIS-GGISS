"use client";
import "@/styles/admin.css";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { DynamicMap } from "@/components/map/MapContainer";
import { MapControls } from "@/components/map/MapControls";
import { MapSidebar } from "@/components/map/MapSidebar";

export default function MapPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [barangayParam, setBarangayParam] = useState<string | null>(null);

  // Listen to URL changes to update barangayParam
  useEffect(() => {
    const updateBarangayParam = () => {
      try {
        const params = new URL(window.location.href).searchParams;
        const newBarangayParam = params.get("barangay");
        console.log('[MapPage] URL changed, barangay param:', newBarangayParam);
        setBarangayParam(newBarangayParam);
      } catch (e) {
        // SSR fallback
      }
    };

    // Initial load
    updateBarangayParam();

    // Listen to popstate (back/forward navigation)
    window.addEventListener('popstate', updateBarangayParam);
    
    // Listen to custom event for programmatic navigation
    window.addEventListener('urlchange', updateBarangayParam);

    return () => {
      window.removeEventListener('popstate', updateBarangayParam);
      window.removeEventListener('urlchange', updateBarangayParam);
    };
  }, []);

  // Debug log when barangay param changes
  useEffect(() => {
    console.log('[MapPage] Barangay param state updated to:', barangayParam);
  }, [barangayParam]);
  
  const isAdmin = user?.role === "admin";
  const title   = isAdmin ? "Purok Map" : "Cabadbaran City Map";
  const subtitle = isAdmin
    ? "Child markers & malnutrition heatmap for your barangay"
    : "All registered children & city-wide malnutrition heatmap";

  // Layer visibility states
  const [showHotspots, setShowHotspots] = useState(true);
  const [showProgramCoverage, setShowProgramCoverage] = useState(true);
  const [showHomeVisits, setShowHomeVisits] = useState(false);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showPredictions, setShowPredictions] = useState(false);
  const [heatmapColorMode, setHeatmapColorMode] = useState<"red-yellow-green" | "blue-purple" | "fire" | "ocean" | "cool">("red-yellow-green");
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [choroplethOn, setChoroplethOn] = useState(false);
  const [currentTileLayer, setCurrentTileLayer] = useState<string>("Default");

  return (
    <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 72px)" }}>
      {/* Header */}
      <div className="admin-page-header shrink-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm mt-0.5">{subtitle}</p>
      </div>

      {/* Map + sidebar - fills remaining height */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        {/* Map fills all available height */}
        <section className="relative h-full min-h-[420px] rounded-xl border border-slate-200 overflow-hidden shadow-sm lg:min-h-0">
          <DynamicMap 
            showHotspots={showHotspots}
            showProgramCoverage={showProgramCoverage}
            showHomeVisits={showHomeVisits}
            showFacilities={showFacilities}
            showPredictions={showPredictions}
            focusBarangay={barangayParam}
            heatmapColorMode={heatmapColorMode}
            heatmapOn={heatmapOn}
            setHeatmapOn={setHeatmapOn}
            choroplethOn={choroplethOn}
            setChoroplethOn={setChoroplethOn}
            onTileLayerChange={setCurrentTileLayer}
          />
        </section>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 overflow-auto">
          <MapControls 
            showHotspots={showHotspots}
            setShowHotspots={setShowHotspots}
            showProgramCoverage={showProgramCoverage}
            setShowProgramCoverage={setShowProgramCoverage}
            showHomeVisits={showHomeVisits}
            setShowHomeVisits={setShowHomeVisits}
            showFacilities={showFacilities}
            setShowFacilities={setShowFacilities}
            showPredictions={showPredictions}
            setShowPredictions={setShowPredictions}
            heatmapOn={heatmapOn}
            choroplethOn={choroplethOn}
            setChoroplethOn={setChoroplethOn}
            heatmapColorMode={heatmapColorMode}
            setHeatmapColorMode={setHeatmapColorMode}
            showHeatmapColorSelector={currentTileLayer === "Heatmap"}
          />
          <MapSidebar />
        </div>
      </div>
    </div>
  );
}
