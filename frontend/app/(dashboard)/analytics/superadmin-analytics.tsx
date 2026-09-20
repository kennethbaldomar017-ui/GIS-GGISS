"use client";
import "@/styles/admin.css";
import "@/styles/analytics.css";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Brain,
  Zap
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area
} from "recharts";
import { SuperAdminAIInsightsWidget } from "@/components/dashboard/SuperAdminAIInsightsWidget";

interface SuperAdminAnalyticsProps {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  expandedForecast: boolean;
  setExpandedForecast: (value: boolean) => void;
  isRefreshing: boolean;
  handleRefresh: () => Promise<void>;
  summary: any;
  childMonitoring: any;
  trendData: any[];
  forecastData: any[];
}

export function SuperAdminAnalytics({
  selectedYear,
  setSelectedYear,
  expandedForecast,
  setExpandedForecast,
  isRefreshing,
  handleRefresh,
  summary,
  childMonitoring,
  trendData,
  forecastData,
}: SuperAdminAnalyticsProps) {
  // OPT Plus Report state
  const [optPlusMonth, setOptPlusMonth] = useState<number>(new Date().getMonth() + 1);
  
  // Generate year options (2020-2030)
  const yearOptions = Array.from({ length: 11 }, (_, i) => 2020 + i);
  
  // OPT Plus Report Query
  const optPlusQuery = useQuery({
    queryKey: ["opt-plus-analytics", selectedYear, optPlusMonth],
    queryFn: async () => {
      try {
        const response = await api.get(`/api/opt-plus/report?year=${selectedYear}&month=${optPlusMonth}`);
        return response.data;
      } catch (error: any) {
        console.error("❌ Failed to fetch OPT Plus report:", error);
        throw error;
      }
    },
    refetchInterval: 10_000, // 10 seconds - Real-time
    staleTime: 5_000,
    retry: 2,
  });
  
  // City-wide AI Insights Query (different from admin endpoint) with year filter
  const aiInsightsQuery = useQuery({
    queryKey: ["analytics-ai-insights-superadmin", selectedYear],
    queryFn: async () => {
      try {
        console.log("🔍 Fetching SuperAdmin AI Insights from:", `/api/dashboard/superadmin/ai-insights?year=${selectedYear}`);
        const response = await api.get(`/api/dashboard/superadmin/ai-insights?year=${selectedYear}`);
        console.log("✅ SuperAdmin AI Insights Response:", response.data);
        return response.data;
      } catch (error: any) {
        console.error("❌ Failed to fetch SuperAdmin AI insights:", error);
        console.error("Error status:", error.response?.status);
        console.error("Error data:", error.response?.data);
        console.error("Request URL:", error.config?.url);
        console.error("Base URL:", error.config?.baseURL);
        throw error;
      }
    },
    refetchInterval: 10000, // 10 seconds - Real-time
    refetchOnWindowFocus: true,
    staleTime: 5000,
    retry: 2, // Retry twice before showing error
    retryDelay: 1000, // Wait 1 second between retries
  });

  const pieData = getSuperAdminPieData(childMonitoring.data);
  const barangayComparison = getSuperAdminBarangayComparison(childMonitoring.data);
  const cityTotals = getSuperAdminCityTotals(summary.data);

  return (
    <div className="admin-container space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            📊 City-Wide Analytics Dashboard
            <span className="text-lg font-normal text-slate-500">({selectedYear})</span>
          </h1>
          <p className="text-sm mt-1">
            City-level nutrition data & AI strategic analysis (Real-time • Auto-refresh every 10s)
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex items-center gap-3">
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="analytics-year" className="text-xs font-semibold text-slate-600">
              Year:
            </label>
            <select
              id="analytics-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="admin-action-btn-secondary inline-flex items-center gap-2 disabled:opacity-50 px-3 py-2.5 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh Now"}
          </button>
          <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>May 1 - May 20, 2026</span>
          </div>
        </div>
      </div>

      {/* AI INSIGHTS SECTION - City-Wide Strategic Analysis */}
      <div className="chart-container p-6 border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-6 w-6 text-emerald-600" />
          <h2 className="chart-title text-lg text-slate-900">🤖 City-Wide AI Strategic Insights</h2>
        </div>
        
        {/* Debugging info - shows backend connection status */}
        {!aiInsightsQuery.data && !aiInsightsQuery.isLoading && !aiInsightsQuery.isError && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-xs text-blue-800">
              🔄 Initializing AI Insights... Check browser console for details.
            </p>
          </div>
        )}
        
        {/* Debug/Error info */}
        {aiInsightsQuery.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900 mb-2">
                  Failed to Load AI Insights
                </p>
                <p className="text-xs text-red-800 mb-2">
                  {(() => {
                    const err = aiInsightsQuery.error as any;
                    if (err?.response?.status === 404) {
                      return "Endpoint not found (404). Backend server may not be running or endpoint not configured.";
                    } else if (err?.response?.status === 403) {
                      return "Access denied (403). You must be logged in as super_admin.";
                    } else if (err?.response?.status === 401) {
                      return "Unauthorized (401). Please log in again.";
                    } else if (err?.code === "ERR_NETWORK") {
                      return "Network error. Cannot connect to backend server.";
                    }
                    return err?.toString() || "Unknown error";
                  })()}
                </p>
                <details className="text-xs text-red-700">
                  <summary className="cursor-pointer font-semibold hover:text-red-900">
                    Troubleshooting Steps
                  </summary>
                  <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
                    <li>✅ Check backend server is running: <code className="bg-red-100 px-1 rounded">http://localhost:8000</code></li>
                    <li>✅ Verify you're logged in as <strong>super_admin</strong> (not regular admin)</li>
                    <li>✅ Test endpoint directly: <code className="bg-red-100 px-1 rounded">GET /api/dashboard/superadmin/ai-insights</code></li>
                    <li>✅ Check browser console (F12) for detailed error logs</li>
                    <li>✅ Ensure database has children data with measurements</li>
                    <li>✅ Try refreshing the page or logging out and back in</li>
                  </ul>
                </details>
              </div>
            </div>
          </div>
        )}
        <SuperAdminAIInsightsWidget
          data={aiInsightsQuery.data}
          isLoading={aiInsightsQuery.isLoading}
        />
      </div>

      {/* Main Charts Grid - City Level */}
      <div className="grid gap-6 md:grid-cols-2 auto-rows-max">
        {/* Card 1: City Malnutrition Trend (Monthly) */}
        <div className="chart-container h-[320px] flex flex-col">
          <h3 className="chart-title text-sm tracking-tight mb-4">
            🏙️ City Malnutrition Trend (Monthly)
          </h3>
          <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="Underweight" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Stunted" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Wasted" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: City Nutritional Status Distribution */}
        <div className="chart-container h-[320px] flex flex-col">
          <h3 className="chart-title text-sm tracking-tight mb-2">
            🏙️ City Nutritional Status Distribution
          </h3>
          <div className="relative flex-1 min-h-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `${v} Children`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-5px]">
              <span className="text-xl font-black text-slate-850">{cityTotals.total.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total City Children</span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-0.5 border-t border-slate-100 pt-3 text-center">
            {pieData.map((d) => (
              <div key={d.name}>
                <p className="text-xs font-black" style={{ color: d.color }}>{d.percent}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide truncate mt-0.5">{d.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Barangay Comparison - Malnutrition Rates */}
        <div className="chart-container h-auto flex flex-col">
          <h3 className="chart-title text-sm tracking-tight mb-4">
            📊 Top 10 Barangay Comparison (Malnutrition Rate)
          </h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barangayComparison}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 180, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 9, fill: "#64748b" }} stroke="#e2e8f0" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#64748b" }} stroke="#e2e8f0" width={175} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="rate" fill="#ef4444" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 4: City Risk Distribution */}
        <div className="chart-container h-auto flex flex-col justify-between">
          <h3 className="chart-title text-sm tracking-tight border-b border-slate-100 pb-2.5">
            ⚠️ City Risk Classification
          </h3>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="stat-card bg-gradient-to-br from-green-50 to-green-100 border border-green-200 p-4">
              <span className="analytics-badge low">Low Risk</span>
              <p className="stat-value mt-2 text-green-700">{cityTotals.low}</p>
              <p className="stat-label mt-1 text-green-600">{((cityTotals.low / cityTotals.total) * 100).toFixed(1)}% of population</p>
            </div>
            <div className="stat-card bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 p-4">
              <span className="analytics-badge medium">At Risk</span>
              <p className="stat-value mt-2 text-yellow-700">{cityTotals.atRisk}</p>
              <p className="stat-label mt-1 text-yellow-600">{((cityTotals.atRisk / cityTotals.total) * 100).toFixed(1)}% of population</p>
            </div>
            <div className="stat-card bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 p-4">
              <span className="analytics-badge high">High Risk</span>
              <p className="stat-value mt-2 text-orange-700">{cityTotals.highRisk}</p>
              <p className="stat-label mt-1 text-orange-600">{((cityTotals.highRisk / cityTotals.total) * 100).toFixed(1)}% of population</p>
            </div>
            <div className="stat-card bg-gradient-to-br from-red-50 to-red-100 border border-red-200 p-4">
              <span className="analytics-badge critical">Critical (SAM)</span>
              <p className="stat-value mt-2 text-red-700">{cityTotals.critical}</p>
              <p className="stat-label mt-1 text-red-600">{((cityTotals.critical / cityTotals.total) * 100).toFixed(1)}% of population</p>
            </div>
          </div>
        </div>

        {/* Card 5: City Predictive Forecast Chart */}
        <div className="col-span-full chart-container">
          <div className="flex items-center justify-between mb-4">
            <h3 className="chart-title text-sm tracking-tight">
              🔮 City-Wide Predictive Forecast (Next 3 Months)
            </h3>
            <button
              onClick={() => setExpandedForecast(!expandedForecast)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {expandedForecast ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>
          </div>

          {expandedForecast && (
            <>
              {/* Forecast Chart */}
              <div className="h-[280px] mb-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" domain={[10, 20]} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="upper" stroke="none" fill="#818cf8" fillOpacity={0.15} name="Upper Bound" />
                    <Area type="monotone" dataKey="lower" stroke="none" fill="#818cf8" fillOpacity={0.15} name="Lower Bound" />
                    <Line type="monotone" dataKey="actual" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4 }} name="Actual Rate" />
                    <Line type="monotone" dataKey="forecast" stroke="#818cf8" strokeDasharray="4 4" strokeWidth={2} dot={false} name="Forecast Rate" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Forecast Confidence Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2.5">
                  <Zap className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-blue-900 mb-1">📈 City-Wide Forecast Insights</h4>
                    <p className="text-[11px] text-blue-800">
                      City-wide analytics and AI strategic recommendations update every 10 seconds. Analysis incorporates all barangay data, city health policies, WHO standards, and NNC guidelines. Critical city-wide alerts activate automatically for coordinated response.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Card 6: City Coverage Overview */}
        <div className="col-span-full chart-container bg-gradient-to-r from-slate-50 to-blue-50">
          <h3 className="chart-title text-sm tracking-tight mb-4">
            🏥 City Coverage & Program Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Total Children Monitored</p>
              <p className="text-3xl font-black text-slate-900">{cityTotals.total.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-2">Across all barangays in city</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Unique Barangays</p>
              <p className="text-3xl font-black text-teal-600">{barangayComparison.length}</p>
              <p className="text-xs text-slate-500 mt-2">Coverage areas</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Average Malnutrition Rate</p>
              <p className="text-3xl font-black text-orange-600">
                {(barangayComparison.reduce((sum: number, b: any) => sum + b.rate, 0) / barangayComparison.length).toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-2">City average</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Data Freshness</p>
              <div className="mt-1 mb-2">
                <span className="realtime-indicator">Live</span>
              </div>
              <p className="text-xs text-slate-500">Real-time updates every 10s</p>
            </div>
          </div>
        </div>
      </div>

      {/* OPT PLUS REPORT SECTION - Graphics & Visualizations */}
      <div className="space-y-6 border-t-2 border-emerald-100 pt-6">
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-emerald-500"></div>
          <h2 className="text-lg font-extrabold text-slate-900">📊 OPT Plus Nutrition Report - Graphs & Analytics</h2>
        </div>

        {/* OPT Plus Report Filter Controls */}
        <div className="admin-glass-panel p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Month</label>
              <select
                value={optPlusMonth}
                onChange={(e) => setOptPlusMonth(Number(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {[
                  { value: 1, label: "January" },
                  { value: 2, label: "February" },
                  { value: 3, label: "March" },
                  { value: 4, label: "April" },
                  { value: 5, label: "May" },
                  { value: 6, label: "June" },
                  { value: 7, label: "July" },
                  { value: 8, label: "August" },
                  { value: 9, label: "September" },
                  { value: 10, label: "October" },
                  { value: 11, label: "November" },
                  { value: 12, label: "December" }
                ].map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => optPlusQuery.refetch()}
              disabled={optPlusQuery.isLoading}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-colors mt-6"
            >
              <RefreshCw className={`h-4 w-4 ${optPlusQuery.isLoading ? "animate-spin" : ""}`} />
              {optPlusQuery.isLoading ? "Refreshing..." : "Refresh"}
            </button>

            <div className="text-xs text-slate-600 font-semibold mt-6">
              ⏱️ Auto-refresh: Every 10 seconds
            </div>
          </div>
        </div>

        {/* Loading State */}
        {optPlusQuery.isLoading && (
          <div className="admin-glass-panel p-12 text-center">
            <div className="inline-block animate-spin h-8 w-8 text-emerald-600 border-4 border-emerald-200 border-t-emerald-600 rounded-full mb-3"></div>
            <p className="text-slate-600 font-semibold">Loading OPT Plus report data...</p>
          </div>
        )}

        {/* Error State */}
        {optPlusQuery.isError && (
          <div className="admin-glass-panel p-6 bg-red-50 border border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900 mb-2">Failed to Load OPT Plus Report</p>
                <p className="text-xs text-red-800">{(optPlusQuery.error as any)?.message || "An error occurred"}</p>
                <button
                  onClick={() => optPlusQuery.refetch()}
                  className="mt-3 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Display */}
        {!optPlusQuery.isLoading && !optPlusQuery.isError && optPlusQuery.data && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-5">
              <div className="stat-card bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-l-green-500 p-4">
                <span className="analytics-badge low">Children 0-59m</span>
                <p className="stat-value text-green-900 mt-2">{optPlusQuery.data.children_0_59_months.toLocaleString()}</p>
                <p className="stat-label">Monitored children</p>
              </div>

              <div className="stat-card bg-gradient-to-br from-blue-50 to-cyan-50 border-l-4 border-l-blue-500 p-4">
                <span className="analytics-badge low" style={{ background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)", color: "#1e3a8a", border: "1px solid #93c5fd" }}>Undernutrition 0-59m</span>
                <p className="stat-value text-blue-900 mt-2">{optPlusQuery.data.summary.undernutrition_0_59}</p>
                <p className="stat-label">
                  {optPlusQuery.data.children_0_59_months > 0 
                    ? ((optPlusQuery.data.summary.undernutrition_0_59 / optPlusQuery.data.children_0_59_months) * 100).toFixed(1)
                    : "0"}% of total
                </p>
              </div>

              <div className="stat-card bg-gradient-to-br from-orange-50 to-amber-50 border-l-4 border-l-orange-500 p-4">
                <span className="analytics-badge medium">Undernutrition 0-23m</span>
                <p className="stat-value text-orange-900 mt-2">{optPlusQuery.data.summary.undernutrition_0_23}</p>
                <p className="stat-label">Focus group</p>
              </div>

              <div className="stat-card bg-gradient-to-br from-red-50 to-pink-50 border-l-4 border-l-red-500 p-4">
                <span className="analytics-badge critical">Overweight 0-59m</span>
                <p className="stat-value text-red-900 mt-2">{optPlusQuery.data.summary.overweight_0_59}</p>
                <p className="stat-label">Needs intervention</p>
              </div>

              <div className="stat-card bg-gradient-to-br from-purple-50 to-indigo-50 border-l-4 border-l-purple-500 p-4">
                <span className="analytics-badge high" style={{ background: "linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)", color: "#581c87", border: "1px solid #d8b4fe" }}>Coverage %</span>
                <p className="stat-value text-purple-900 mt-2">{optPlusQuery.data.coverage_percentage.toFixed(1)}%</p>
                <p className="stat-label">Assessment rate</p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Chart 1: Age Group Distribution Bar Chart */}
              <div className="chart-container h-[300px] flex flex-col">
                <h3 className="chart-title text-sm tracking-tight mb-4">
                  📊 Children by Age Group
                </h3>
                <div className="flex-1 min-h-0 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={optPlusQuery.data.age_group_data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="age_group" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                      <YAxis tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Gender Distribution Pie Chart */}
              <div className="chart-container h-[300px] flex flex-col">
                <h3 className="chart-title text-sm tracking-tight mb-4">
                  👥 Gender Distribution
                </h3>
                <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Male", value: optPlusQuery.data.gender_breakdown.male, fill: "#3b82f6" },
                          { name: "Female", value: optPlusQuery.data.gender_breakdown.female, fill: "#ec4899" }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {[
                          { name: "Male", value: optPlusQuery.data.gender_breakdown.male, fill: "#3b82f6" },
                          { name: "Female", value: optPlusQuery.data.gender_breakdown.female, fill: "#ec4899" }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `${v} Children`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Nutritional Status Breakdown */}
              <div className="chart-container h-[300px] flex flex-col">
                <h3 className="chart-title text-sm tracking-tight mb-4">
                  🥗 Nutritional Status Summary
                </h3>
                <div className="flex-1 min-h-0 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "0-23m Undernutrition", value: optPlusQuery.data.summary.undernutrition_0_23, fill: "#f97316" },
                        { name: "0-59m Undernutrition", value: optPlusQuery.data.summary.undernutrition_0_59, fill: "#ef4444" },
                        { name: "0-23m Overweight", value: optPlusQuery.data.summary.overweight_0_23, fill: "#f59e0b" },
                        { name: "0-59m Overweight", value: optPlusQuery.data.summary.overweight_0_59, fill: "#ea580c" }
                      ]}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 9, fill: "#64748b" }} stroke="#e2e8f0" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#64748b" }} stroke="#e2e8f0" width={145} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="value" fill="#10b981" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4: Indicators Comparison */}
              <div className="chart-container h-[300px] flex flex-col">
                <h3 className="chart-title text-sm tracking-tight mb-4">
                  📈 Assessment Indicators Count
                </h3>
                <div className="flex-1 min-h-0 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "Weight-for-Age", count: optPlusQuery.data.total_wfa, fill: "#6366f1" },
                        { name: "Height-for-Age", count: optPlusQuery.data.total_hfa, fill: "#8b5cf6" },
                        { name: "Weight-for-Length/Height", count: optPlusQuery.data.total_wflh, fill: "#d946ef" }
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                      <YAxis tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Summary Tables */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Age Group Table */}
              <div className="chart-container">
                <h3 className="chart-title text-sm tracking-tight mb-4">
                  📋 Age Group Distribution Table
                </h3>
                <div className="overflow-x-auto">
                  <table className="analytics-table text-xs">
                    <thead>
                      <tr>
                        <th>Age Group</th>
                        <th className="text-center">Count</th>
                        <th className="text-center">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optPlusQuery.data.age_group_data.map((group: any) => (
                        <tr key={group.age_group}>
                          <td className="font-semibold text-slate-900">{group.age_group}</td>
                          <td className="text-center font-bold text-emerald-600">{group.count}</td>
                          <td className="text-center text-slate-700">
                            {optPlusQuery.data.children_0_59_months > 0 
                              ? ((group.count / optPlusQuery.data.children_0_59_months) * 100).toFixed(1)
                              : "0"}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Stats Table */}
              <div className="chart-container">
                <h3 className="chart-title text-sm tracking-tight mb-4">
                  📊 Nutritional Status Summary
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-700 uppercase mb-1">0-59m Children</p>
                      <p className="text-xl font-black text-green-900">{optPlusQuery.data.children_0_59_months}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Coverage</p>
                      <p className="text-xl font-black text-purple-900">{optPlusQuery.data.coverage_percentage.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-700">Undernutrition (0-59m):</span>
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-bold text-xs">{optPlusQuery.data.summary.undernutrition_0_59}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-700">Undernutrition (0-23m):</span>
                      <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded font-bold text-xs">{optPlusQuery.data.summary.undernutrition_0_23}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-700">Overweight (0-59m):</span>
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-bold text-xs">{optPlusQuery.data.summary.overweight_0_59}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-700">Overweight (0-23m):</span>
                      <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold text-xs">{optPlusQuery.data.summary.overweight_0_23}</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-3">
                    <p className="text-xs text-blue-800 font-semibold">
                      ⏱️ Last updated: {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!optPlusQuery.isLoading && !optPlusQuery.isError && !optPlusQuery.data && (
          <div className="admin-glass-panel p-12 text-center">
            <p className="text-slate-600 font-semibold">No OPT Plus data available for the selected period</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions for SuperAdmin data
function getSuperAdminPieData(data: any) {
  if (data?.barangay_summary) {
    const summary_data = data.barangay_summary;
    const total = summary_data.total_children || 1;
    const normal_percent = ((summary_data.normal / total) * 100).toFixed(1);
    const underweight_percent = ((summary_data.underweight / total) * 100).toFixed(1);
    const stunted_percent = ((summary_data.stunted / total) * 100).toFixed(1);
    const wasted_percent = ((summary_data.wasted / total) * 100).toFixed(1);
    const severe_percent = ((summary_data.sam / total) * 100).toFixed(1);

    return [
      { name: "Normal", value: summary_data.normal, color: "#10b981", percent: `${normal_percent}%` },
      { name: "Underweight", value: summary_data.underweight, color: "#fbbf24", percent: `${underweight_percent}%` },
      { name: "Stunted", value: summary_data.stunted, color: "#f97316", percent: `${stunted_percent}%` },
      { name: "Wasted", value: summary_data.wasted, color: "#ef4444", percent: `${wasted_percent}%` },
      { name: "Severe", value: summary_data.sam, color: "#b91c1c", percent: `${severe_percent}%` }
    ];
  }
  return [
    { name: "Normal", value: 1255, color: "#10b981", percent: "51.2%" },
    { name: "Underweight", value: 411, color: "#fbbf24", percent: "16.8%" },
    { name: "Stunted", value: 487, color: "#f97316", percent: "19.9%" },
    { name: "Wasted", value: 198, color: "#ef4444", percent: "8.1%" },
    { name: "Severe", value: 102, color: "#b91c1c", percent: "4.1%" }
  ];
}

function getSuperAdminBarangayComparison(data: any) {
  // Mock data for now - would come from API in production
  return [
    { name: "Barangay A", rate: 18.5 },
    { name: "Barangay B", rate: 17.2 },
    { name: "Barangay C", rate: 16.8 },
    { name: "Barangay D", rate: 15.9 },
    { name: "Barangay E", rate: 15.3 },
    { name: "Barangay F", rate: 14.7 },
    { name: "Barangay G", rate: 14.2 },
    { name: "Barangay H", rate: 13.8 },
    { name: "Barangay I", rate: 13.1 },
    { name: "Barangay J", rate: 12.9 }
  ];
}

function getSuperAdminCityTotals(data: any) {
  const total = data?.total_children || 2453;
  const normal = Math.round(total * 0.512);
  const low = normal;
  const atRisk = Math.round(total * 0.168); // underweight
  const highRisk = Math.round(total * 0.199); // stunted
  const critical = Math.round(total * 0.081); // wasted + severe

  return { total, low, atRisk, highRisk, critical };
}
