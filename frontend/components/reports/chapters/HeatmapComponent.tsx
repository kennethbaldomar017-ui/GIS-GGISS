'use client';

import React, { useEffect, useRef } from 'react';
import { scatterCaseDots, CASE_DOT_STYLES, type AreaGeometry } from '@/components/map/heatmap-renderer';

interface Hotspot {
  name: string;
  latitude?: number;
  longitude?: number;
  intensity: number;
  normal_count?: number;
  moderate_count?: number;
  severe_count?: number;
  other_count?: number;
  scatter_geometry?: AreaGeometry;
  caseCount: number;
  radius?: number;
  description?: string;
}

interface HeatmapComponentProps {
  hotspots: Hotspot[];
}

export default function HeatmapComponent({ hotspots }: HeatmapComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Geographic bounds (Cabadbaran City area)
    const minLat = 9.0;
    const maxLat = 9.3;
    const minLng = 125.4;
    const maxLng = 125.78;

    // Function to convert lat/lng to canvas coordinates
    const getCanvasCoords = (lat: number, lng: number) => {
      const x = ((lng - minLng) / (maxLng - minLng)) * width;
      const y = ((maxLat - lat) / (maxLat - minLat)) * height;
      return { x, y };
    };

    // Draw markers for each hotspot
    hotspots.forEach((hotspot) => {
      const lat = hotspot.latitude;
      const lng = hotspot.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return;
      const { x, y } = getCanvasCoords(lat, lng);

      const centers = hotspots.filter(area => typeof area.latitude === 'number' && typeof area.longitude === 'number')
        .map(area => ({ name: area.name, lat: area.latitude!, lng: area.longitude! }));
      const points = scatterCaseDots({ name: hotspot.name, lat, lng,
        scatter_geometry: hotspot.scatter_geometry, normal_count: hotspot.normal_count, moderate_count: hotspot.moderate_count ?? NaN,
        severe_count: hotspot.severe_count ?? NaN, other_count: hotspot.other_count ?? 0,
      }, centers);
      for (const point of points) {
        const position = getCanvasCoords(point.lat, point.lng);
        ctx.fillStyle = CASE_DOT_STYLES[point.status].color;
        ctx.beginPath();
        ctx.arc(position.x, position.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (points.length) {
        ctx.fillStyle = '#334155';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(hotspot.name, x, y + 9);
      }

    });

    // Draw border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

  }, [hotspots]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={400}
      style={{
        width: '100%',
        height: 'auto',
        display: 'block',
        borderRadius: '0.5rem',
      }}
    />
  );
}
