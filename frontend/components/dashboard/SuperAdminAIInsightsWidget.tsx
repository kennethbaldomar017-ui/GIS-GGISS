"use client";

import { Brain, AlertTriangle, Target, TrendingUp, MapPin, Clock, Zap } from "lucide-react";
import Link from "next/link";

interface CriticalBarangay {
  barangay_name: string;
  risk_level: string;
  cases_needing_action: number;
  priority_level: string;
}

interface BarangayRanking {
  barangay_name: string;
  risk_level: string;
  malnutrition_rate: number;
  critical_cases: number;
  at_risk_children: number;
}

interface CityIntervention {
  type: string;
  priority?: string;
  title: string;
  description: string;
  target_barangays?: string[];
  expected_impact?: string;
}

interface AIInterpretation {
  city_trend_analysis: string;
  forecast_outlook: string;
  critical_city_alerts: string[];
  positive_indicators: string[];
  strategic_recommendations: string;
}

interface SuperAdminAIInsightsData {
  city_summary: {
    total_children: number;
    unique_barangays: number;
    total_at_risk: number;
    critical_cases: number;
    high_risk_cases: number;
    city_malnutrition_rate: number;
    city_wasting_rate: number;
    city_stunting_rate: number;
    city_underweight_rate: number;
    overall_risk_level: string;
    overall_risk_score: number;
    previous_year: number;
    previous_malnutrition_rate: number | null;
    malnutrition_rate_change: number | null;
    confidence_level: "high" | "moderate" | "limited" | "insufficient";
    sample_size: number;
  };
  barangay_rankings: BarangayRanking[];
  critical_barangays: CriticalBarangay[];
  recommended_city_interventions: CityIntervention[];
  ai_interpretation?: AIInterpretation;
}

const priorityColors = {
  critical: "bg-red-50 border-red-200 text-red-900",
  urgent: "bg-red-50 border-red-200 text-red-900",
  high: "bg-orange-50 border-orange-200 text-orange-900",
  medium: "bg-amber-50 border-amber-200 text-amber-900",
};

const riskLevelColors = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

const priorityBadgeColors = {
  critical: "bg-red-100 text-red-800",
  urgent: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-amber-100 text-amber-800",
};

export function SuperAdminAIInsightsWidget({
  data,
  isLoading,
}: {
  data?: SuperAdminAIInsightsData;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded-lg w-1/3" />
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded-lg w-full" />
            <div className="h-4 bg-slate-200 rounded-lg w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-slate-400" />
          <p className="text-sm text-slate-600">No data available for analysis</p>
        </div>
      </div>
    );
  }

  const summary = data.city_summary;
  const trendChange = summary.malnutrition_rate_change;
  const confidenceLabel = summary.confidence_level === "insufficient"
    ? "Insufficient data"
    : `${summary.confidence_level[0].toUpperCase()}${summary.confidence_level.slice(1)} confidence`;
  const colorForRisk = (level: string) => {
    switch (level.toLowerCase()) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-green-100 text-green-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Insights Header Card */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="h-5 w-5 text-emerald-600 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">🤖 City-Wide Decision Support & Strategic Forecast</h2>
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase animate-pulse">
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
                  RULE-BASED ANALYSIS
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Evidence-based city-level recommendations using OPT Plus rule-based classification and prevalence analysis
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4 pt-4 border-t border-emerald-200">
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Children</p>
            <p className="text-2xl font-black text-emerald-700">{summary.total_children}</p>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Unique Barangays</p>
            <p className="text-2xl font-black text-blue-700">{summary.unique_barangays}</p>
            <p className="text-[9px] text-blue-600 mt-1">Coverage areas</p>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Malnutrition Rate</p>
            <p className="text-2xl font-black text-red-600">{summary.city_malnutrition_rate}%</p>
            <p className="text-[9px] text-red-600 mt-1">City average</p>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Data Freshness</p>
            <p className="text-lg font-black text-emerald-600">Live</p>
            <p className="text-[9px] text-emerald-600 mt-1">Real-time updates</p>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">At-Risk</p>
            <p className="text-2xl font-black text-orange-600">{summary.total_at_risk}</p>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Year Change</p>
            <p className={`text-lg font-black ${trendChange === null ? "text-slate-500" : trendChange > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {trendChange === null ? "N/A" : `${trendChange > 0 ? "+" : ""}${trendChange.toFixed(1)} pp`}
            </p>
            <p className="text-[9px] text-slate-500 mt-1">vs {summary.previous_year}</p>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Evidence</p>
            <p className="text-lg font-black text-slate-700">{confidenceLabel}</p>
            <p className="text-[9px] text-slate-500 mt-1">n={summary.sample_size}</p>
          </div>
        </div>
      </div>

      {/* AI Interpretation Section */}
      {data.ai_interpretation && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Brain className="h-4 w-4 text-emerald-600" />
            AI Strategic Analysis
          </h3>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4 space-y-3">
            {/* Trend Analysis */}
            <div>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">📊 City Trend Analysis</p>
              <p className="text-sm text-blue-900">{data.ai_interpretation.city_trend_analysis}</p>
            </div>

            {/* Forecast */}
            <div className="pt-2 border-t border-blue-200">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">🔮 Forecast Outlook</p>
              <p className="text-sm text-blue-900">{data.ai_interpretation.forecast_outlook}</p>
            </div>

            {/* Strategic Recommendations */}
            <div className="pt-2 border-t border-blue-200">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">⭐ Strategic Recommendations</p>
              <p className="text-sm text-blue-900">{data.ai_interpretation.strategic_recommendations}</p>
            </div>
          </div>

          {/* Critical Alerts */}
          {data.ai_interpretation.critical_city_alerts && data.ai_interpretation.critical_city_alerts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">🚨 Critical City Alerts</p>
              <div className="space-y-1.5">
                {data.ai_interpretation.critical_city_alerts
                  .filter(Boolean)
                  .map((alert, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-red-900">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span>{alert}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Positive Indicators */}
          {data.ai_interpretation.positive_indicators && data.ai_interpretation.positive_indicators.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">✅ Positive Indicators</p>
              <div className="space-y-1.5">
                {data.ai_interpretation.positive_indicators.map((indicator, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-green-900">
                    <span>✓</span>
                    <span>{indicator}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* City-Wide Recommendations Section */}
      {data.recommended_city_interventions && data.recommended_city_interventions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-600" />
            Strategic City Interventions ({data.recommended_city_interventions.length})
          </h3>

          <div className="space-y-3">
            {data.recommended_city_interventions.map((rec, idx) => (
              <div
                key={idx}
                className={`border rounded-xl p-4 ${
                  priorityColors[rec.priority as keyof typeof priorityColors] ||
                  priorityColors.medium
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-2 flex-1">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                      priorityBadgeColors[rec.priority as keyof typeof priorityBadgeColors] ||
                      priorityBadgeColors.medium
                    }`}>
                      {(rec.priority || "MEDIUM").toUpperCase()}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm mb-1">{rec.title}</h4>
                      <p className="text-sm leading-relaxed mb-2">{rec.description}</p>
                      {rec.target_barangays && rec.target_barangays.length > 0 && (
                        <p className="text-xs font-semibold flex items-center gap-1 text-slate-700 mb-2">
                          <MapPin className="h-3 w-3" />
                          Target: {rec.target_barangays.join(", ")}
                        </p>
                      )}
                      {rec.expected_impact && (
                        <p className="text-xs font-semibold flex items-center gap-1 text-slate-700">
                          <TrendingUp className="h-3 w-3" />
                          {rec.expected_impact}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Critical Barangays */}
      {data.critical_barangays && data.critical_barangays.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Critical Barangays (Priority Action)
            </h3>
          </div>

          <div className="space-y-2">
            {data.critical_barangays.slice(0, 5).map((brgy, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-3 ${
                  brgy.risk_level === "critical"
                    ? "bg-red-50 border-red-200"
                    : brgy.risk_level === "high"
                    ? "bg-orange-50 border-orange-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-slate-900">{brgy.barangay_name}</h4>
                    <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold ${colorForRisk(brgy.risk_level)}`}>
                        {brgy.risk_level.toUpperCase()}
                      </span>
                      <span>{brgy.cases_needing_action} cases needing action</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Concern Barangays Rankings */}
      {data.barangay_rankings && data.barangay_rankings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            Top Concern Barangays (Risk Ranking)
          </h3>

          <div className="space-y-2">
            {data.barangay_rankings.slice(0, 5).map((brgy, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-lg p-3.5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-slate-900">
                      #{idx + 1} {brgy.barangay_name}
                    </h4>
                  </div>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${colorForRisk(brgy.risk_level)}`}>
                    {brgy.risk_level.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                  <div className="bg-slate-50 rounded p-2">
                    <p className="text-[10px] font-bold text-slate-600 uppercase">Malnutrition Rate</p>
                    <p className="text-sm font-black text-slate-900">{brgy.malnutrition_rate.toFixed(1)}%</p>
                  </div>
                  <div className="bg-slate-50 rounded p-2">
                    <p className="text-[10px] font-bold text-slate-600 uppercase">Critical Cases</p>
                    <p className="text-sm font-black text-red-600">{brgy.critical_cases}</p>
                  </div>
                  <div className="bg-slate-50 rounded p-2">
                    <p className="text-[10px] font-bold text-slate-600 uppercase">At-Risk</p>
                    <p className="text-sm font-black text-orange-600">{brgy.at_risk_children}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-xs text-emerald-900 font-semibold">
          <div className="relative h-2 w-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 absolute animate-pulse"></span>
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 opacity-75"></span>
          </div>
          <span>RULE-BASED CLASSIFICATION ACTIVE • OPT Plus Standards • Rule-Based Decision Support</span>
        </div>
      </div>
    </div>
  );
}
