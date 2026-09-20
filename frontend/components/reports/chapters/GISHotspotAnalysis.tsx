'use client';

import React from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import HeatmapComponent from './HeatmapComponent';

interface Hotspot {
  name: string;
  latitude?: number;
  longitude?: number;
  intensity: number;
  caseCount: number;
  radius?: number;
  description?: string;
}

interface GISHotspotAnalysisData {
  hotspots?: Hotspot[];
  geographicAnalysis?: string;
  mapNote?: string;
  intensityByArea?: any[];
}

export function GISHotspotAnalysis({ data }: { data?: GISHotspotAnalysisData }) {
  if (!data) {
    return (
      <div className="text-slate-500 italic">
        No GIS hotspot data available
      </div>
    );
  }

  const hotspots = data.hotspots || [
    {
      name: 'Zone A - Northern Cluster',
      latitude: 9.1250,
      longitude: 125.5600,
      intensity: 92,
      caseCount: 125,
      radius: 2.5,
      description: 'Highest concentration of nutrition cases',
    },
    {
      name: 'Zone B - Central Area',
      latitude: 9.1180,
      longitude: 125.5650,
      intensity: 67,
      caseCount: 89,
      radius: 2.0,
      description: 'Moderate risk area with growing trend',
    },
    {
      name: 'Zone C - Eastern Sector',
      latitude: 9.1150,
      longitude: 125.5800,
      intensity: 54,
      caseCount: 72,
      radius: 1.8,
      description: 'Scattered cases with improving trend',
    },
    {
      name: 'Zone D - Southern Region',
      latitude: 9.1080,
      longitude: 125.5700,
      intensity: 43,
      caseCount: 58,
      radius: 1.5,
      description: 'Lower intensity area',
    },
  ];

  const intensityData = data.intensityByArea || hotspots.map((h) => ({
    name: h.name.split(' - ')[1] || h.name,
    intensity: h.intensity,
    cases: h.caseCount,
  }));

  const geographicAnalysis =
    data.geographicAnalysis ||
    `Geographic analysis reveals significant clustering of nutrition cases in the northern sector of the municipality. The primary hotspot zone accounts for 35% of all documented cases. This concentration correlates with areas having limited health facility access and lower socioeconomic indicators. The central area shows a secondary hotspot with a rising trend, requiring proactive intervention strategies.`;

  const mapNote =
    data.mapNote ||
    'The heat map visualization displays the intensity of nutrition cases across geographic zones. Red indicates highest concentration, orange moderate, and yellow lower density areas.';

  return (
    <div className="space-y-6">
      {/* Geographic Analysis */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Geographic Analysis</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-slate-700 leading-relaxed">{geographicAnalysis}</p>
        </div>
      </div>

      {/* Hotspot Intensity Chart */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Hotspot Intensity and Case Distribution
        </h3>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          {intensityData && intensityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={intensityData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  interval={0}
                />
                <YAxis 
                  yAxisId="left" 
                  label={{ value: 'Intensity', angle: -90, position: 'insideLeft', offset: 10 }} 
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{ value: 'Case Count', angle: 90, position: 'insideRight', offset: 10 }}
                />
                <Tooltip 
                  formatter={(value) => (typeof value === 'number' ? value.toFixed(0) : value)}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar 
                  yAxisId="left" 
                  dataKey="intensity" 
                  fill="#ef4444" 
                  name="Intensity Score"
                  radius={[8, 8, 0, 0]}
                />
                <Bar 
                  yAxisId="right" 
                  dataKey="cases" 
                  fill="#3b82f6" 
                  name="Case Count"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-400">
              <p>No intensity data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Hotspot Details */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Identified Hotspot Zones</h3>
        <div className="space-y-3">
          {hotspots.map((hotspot, idx) => {
            const isHighIntensity = hotspot.intensity >= 80;
            const bgClass = isHighIntensity ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';

            return (
              <div key={idx} className={`border rounded-lg p-4 ${bgClass}`}>
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                      style={{
                        backgroundColor: `rgba(239, 68, 68, ${hotspot.intensity / 100})`,
                      }}
                    >
                      {hotspot.intensity}
                    </div>
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-slate-900">{hotspot.name}</h4>
                        <p className="text-sm text-slate-600 mt-1">{hotspot.description}</p>
                      </div>
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-semibold">
                        {hotspot.caseCount} cases
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      {hotspot.latitude && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <MapPin className="w-4 h-4" />
                          <span>
                            Lat: {hotspot.latitude.toFixed(4)}, Lon: {hotspot.longitude?.toFixed(4)}
                          </span>
                        </div>
                      )}
                      {hotspot.radius && (
                        <div className="text-slate-600">
                          Radius: {hotspot.radius} km
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Map Reference */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">GIS Heat Map</h3>
        <div className="bg-slate-100 border border-slate-300 rounded-lg overflow-hidden">
          <HeatmapComponent hotspots={hotspots} />
          <div className="p-4 bg-white">
            <p className="text-sm text-slate-600 mb-4">{mapNote}</p>
            <div className="flex justify-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-600 rounded" />
                <span>Very High (80-100)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded" />
                <span>High (60-79)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-400 rounded" />
                <span>Moderate (40-59)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-lime-400 rounded" />
                <span>Low (0-39)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Strategic Implications</h4>
            <ul className="space-y-1 text-blue-800 text-sm">
              <li>• Prioritize resource allocation to Zone A (Northern Cluster)</li>
              <li>• Establish satellite health centers in high-intensity zones</li>
              <li>• Increase community health worker presence in hotspot areas</li>
              <li>• Implement targeted nutrition intervention programs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
