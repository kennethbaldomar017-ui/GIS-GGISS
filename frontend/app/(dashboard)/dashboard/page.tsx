"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import "@/styles/admin.css";
import { HeroImageSlider } from "@/components/dashboard/HeroImageSlider";
import { useAuthStore } from "@/store/auth";
import { useDashboardRealtimeUpdates } from "@/hooks/useDashboardRealtimeUpdates";
import { UpcomingProgramsWidget } from "@/components/dashboard/UpcomingProgramsWidget";
import { ChildMonitoringWidget } from "@/components/dashboard/ChildMonitoringWidget";
import { SuperAdminProgramsOverview } from "@/components/dashboard/SuperAdminProgramsOverview";
import BarangayAIInsights from "@/components/dashboard/BarangayAIInsights";
import SuperAdminAIInsights from "@/components/dashboard/SuperAdminAIInsights";
import { SuperAdminAIInsightsWidget } from "@/components/dashboard/SuperAdminAIInsightsWidget";
import {
  Users,
  CheckCircle,
  AlertTriangle,
  MapPin,
  TrendingUp,
  TrendingDown,
  Bell,
  ArrowRight,
  Shield,
  Activity,
  Heart,
  FileText,
  Mail,
  Zap,
  Globe,
  Radio,
  Award,
  BarChart2,
  Package,
  Brain,
  Wifi,
  WifiOff,
  Clock,
  ChevronRight,
  Sparkles,
  Calendar
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, RadialBarChart, RadialBar, Legend
} from "recharts";

interface RankingRow {
  rank: number;
  name: string;
  riskLevel: string;
  riskScore: string;
  totalChildren: number;
  malnutritionCases: number;
  prevalence: string;
  trend: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";
  
  // Year filter state
  const [selectedYear, setSelectedYear] = useState<number>(2025); // Default to 2025 where data exists
  
  // Debug logging
  useEffect(() => {
    console.log("🔐 [Dashboard] User Info:", {
      id: user?.id,
      username: user?.username,
      role: user?.role,
      isSuperAdmin: isSuperAdmin,
      barangay_id: user?.barangay_id,
      barangay_name: user?.barangay_name,
    });
  }, [user, isSuperAdmin]);
  
  // Enable real-time updates for dashboard data
  const wsStatus = useDashboardRealtimeUpdates();

  // Queries for live data integration with year filtering
  const summary = useQuery({
    queryKey: ["summary", selectedYear],
    queryFn: async () => {
      console.log(`[DEBUG] Fetching summary for year ${selectedYear}`);
      const response = await api.get(`/api/dashboard/summary?year=${selectedYear}`);
      console.log(`[DEBUG] Summary response for year ${selectedYear}:`, response.data);
      return response.data;
    },
    refetchInterval: 15_000,
    staleTime: 0, // Always fetch fresh when year changes
    gcTime: 0, // Don't cache between year changes
  });

  const alertsQuery = useQuery({
    queryKey: ["dashboard-alerts", selectedYear],
    queryFn: async () => {
      console.log(`[DEBUG] Fetching alerts for year ${selectedYear}`);
      const response = await api.get(`/api/alerts?is_resolved=false&year=${selectedYear}`);
      console.log(`[DEBUG] Alerts response for year ${selectedYear}:`, response.data);
      return response.data;
    },
    refetchInterval: 15_000,
    staleTime: 0,
    gcTime: 0,
  });

  const rankingQuery = useQuery({
    queryKey: ["dashboard-ranking", selectedYear],
    queryFn: () => api.get(`/api/dashboard/barangay-comparison?year=${selectedYear}`).then((r) => r.data),
    refetchInterval: 20_000,
    enabled: isSuperAdmin,
  });

  const complianceQuery = useQuery({
    queryKey: ["dashboard-compliance", selectedYear],
    queryFn: () => api.get(`/api/dashboard/compliance?year=${selectedYear}`).then((r) => r.data),
    refetchInterval: 30_000,
    enabled: isSuperAdmin,
  });

  const predictionsQuery = useQuery({
    queryKey: ["dashboard-predictions", selectedYear],
    queryFn: () => api.get(`/api/dashboard/predictions?year=${selectedYear}`).then((r) => r.data),
    refetchInterval: 60_000,
    enabled: isSuperAdmin,
  });

  const resourceQuery = useQuery({
    queryKey: ["dashboard-resource", selectedYear],
    queryFn: () => api.get(`/api/dashboard/resource-allocation?year=${selectedYear}`).then((r) => r.data),
    refetchInterval: 60_000,
    enabled: isSuperAdmin,
  });

  const effectivenessQuery = useQuery({
    queryKey: ["dashboard-effectiveness", selectedYear],
    queryFn: () => api.get(`/api/dashboard/intervention-effectiveness?year=${selectedYear}`).then((r) => r.data),
    refetchInterval: 60_000,
    enabled: isSuperAdmin,
  });

  // Admin BHW dashboard queries (also works for super_admin to preview barangay programs)
  const upcomingProgramsQuery = useQuery({
    queryKey: ["admin-upcoming-programs", selectedYear],
    queryFn: () => api.get(`/api/dashboard/admin/upcoming-programs?year=${selectedYear}`).then((r) => r.data),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: true, // Enable for all users to support program viewing
  });

  // SuperAdmin city-wide program overview (new query)
  const superAdminProgramsQuery = useQuery({
    queryKey: ["superadmin-programs-overview", selectedYear],
    queryFn: () => api.get(`/api/dashboard/superadmin/programs-overview?year=${selectedYear}`).then((r) => r.data),
    refetchInterval: 30_000,
    enabled: isSuperAdmin,
  });

  // SuperAdmin city-wide child monitoring (new query)
  const childMonitoringQuery = useQuery({
    queryKey: ["admin-child-monitoring", selectedYear],
    queryFn: () => api.get(`/api/dashboard/admin/child-monitoring?year=${selectedYear}`).then((r) => r.data),
    refetchInterval: 30_000,
    enabled: !isSuperAdmin,
  });

  // Super admin decision support insights (rule-based analysis)
  const aiInsightsQuery = useQuery({
    queryKey: ["dashboard-ai-insights", selectedYear],
    queryFn: async () => {
      console.log(`🔍 [Dashboard] Fetching SuperAdmin Decision Support Insights for year ${selectedYear}`);
      const response = await api.get(`/api/dashboard/superadmin/ai-insights?year=${selectedYear}`);
      console.log("✅ [Dashboard] Decision Support Insights fetched (Rule-Based Classification):", response.data);
      return response.data;
    },
    refetchInterval: 30_000,  // Refresh every 30 seconds for rule-based analysis
    refetchOnWindowFocus: true,  // Auto-refresh when user focuses window
    refetchOnReconnect: true,  // Auto-refresh when reconnecting
    refetchIntervalInBackground: true,  // Keep polling in background
    staleTime: 0,  // Always treat data as stale - forces refetch
    gcTime: 5000,  // Cache for 5 seconds minimum
    enabled: isSuperAdmin,
    retry: 3,
    retryDelay: 1000,
  });

  // Log query state for debugging
  useEffect(() => {
    console.log("📊 [Dashboard] AI Insights Query State:", {
      enabled: isSuperAdmin,
      isLoading: aiInsightsQuery.isLoading,
      isError: aiInsightsQuery.isError,
      error: aiInsightsQuery.error,
      dataAvailable: !!aiInsightsQuery.data,
    });
  }, [isSuperAdmin, aiInsightsQuery.isLoading, aiInsightsQuery.isError, aiInsightsQuery.data]);

  // Live stats from backend - display actual data from API
  const liveStats = useMemo(() => {
    // Debug log to see what data we're getting
    console.log('[DEBUG] liveStats - selectedYear:', selectedYear);
    console.log('[DEBUG] liveStats - summary.data:', summary.data);
    console.log('[DEBUG] liveStats - alertsQuery.data:', alertsQuery.data);
    console.log('[DEBUG] liveStats - summary.isLoading:', summary.isLoading);
    console.log('[DEBUG] liveStats - summary.error:', summary.error);
    
    // Use child monitoring data if available (for admin), otherwise use summary
    let total = summary.data?.total_children || 0;
    
    // For admin users, use the child monitoring total_children (unique children count, not records)
    if (!isSuperAdmin && childMonitoringQuery.data?.barangay_summary?.total_children) {
      total = childMonitoringQuery.data.barangay_summary.total_children;
    }
    
    const criticalBrgys = summary.data?.critical_barangays_count || 0;
    
    // Use actual backend stats - these are filtered by year in the backend
    const normal = summary.data?.normal_count || 0;
    const underweight = summary.data?.underweight_count || 0;
    const stunted = summary.data?.stunted_count || 0;
    const wasted = summary.data?.wasted_count || 0;
    const severe = summary.data?.severe_count || 0;
    
    const activeAlerts = alertsQuery.data?.length || 0;

    console.log('[DEBUG] liveStats calculated:', {
      total, normal, underweight, stunted, wasted, severe, activeAlerts, criticalBrgys
    });
    
    // Additional debug: Check if we actually have data
    if (total === 0 && normal === 0 && underweight === 0) {
      console.warn('[WARNING] All values are 0! This might indicate:');
      console.warn('1. Backend returned no data for year', selectedYear);
      console.warn('2. API call failed');
      console.warn('3. Database has no data for this year');
    }

    return {
      total,
      normal,
      underweight,
      stunted,
      wasted,
      severe,
      activeAlerts,
      criticalBrgys
    };
  }, [summary.data, alertsQuery.data, childMonitoringQuery.data, isSuperAdmin, selectedYear]);

  // Fetch Malnutrition Trend (Monthly) - from backend
  const trendQuery = useQuery({
    queryKey: ["dashboard-trend"],
    queryFn: () => api.get("/api/dashboard/prevalence-trend").then((r) => r.data),
    refetchInterval: 60_000,
  });

  const trendData = useMemo(() => {
    if (trendQuery.data && trendQuery.data.length > 0) {
      return trendQuery.data.map((item: any) => ({
        month: item.month,
        Underweight: Math.round(item.underweight || 0),
        Stunted: Math.round(item.stunting || 0),
        Wasted: Math.round(item.wasting || 0)
      }));
    }
    // Return empty array when no data
    return [];
  }, [trendQuery.data]);

  const pieData = [
    { name: "Normal", value: liveStats.normal, color: "#10b981", percent: "51.2%" },
    { name: "Underweight", value: liveStats.underweight, color: "#fbbf24", percent: "16.8%" },
    { name: "Stunted", value: liveStats.stunted, color: "#f97316", percent: "19.9%" },
    { name: "Wasted", value: liveStats.wasted, color: "#ef4444", percent: "8.1%" },
    { name: "Severe", value: liveStats.severe, color: "#b91c1c", percent: "4.1%" }
  ];

  // Fetch Age Group Distribution - from backend
  const ageQuery = useQuery({
    queryKey: ["dashboard-age-distribution"],
    queryFn: () => api.get("/api/dashboard/age-distribution").then((r) => r.data),
    refetchInterval: 60_000,
  });

  const ageData = useMemo(() => {
    if (ageQuery.data && ageQuery.data.length > 0) {
      return ageQuery.data.map((item: any) => ({
        group: item.bracket || item.group,
        count: item.count
      }));
    }
    // Return empty array when no data
    return [];
  }, [ageQuery.data]);

  // Barangay Risk Ranking List - Always uses backend data, no hardcoded fallback
  const rankingRows = useMemo((): RankingRow[] => {
    if (rankingQuery.data && rankingQuery.data.length > 0) {
      return rankingQuery.data.slice(0, 5).map((row: any, i: number): RankingRow => ({
        rank: i + 1,
        name: row.name || row.barangay || "Unknown",
        riskLevel: row.risk_level || "low",
        riskScore: row.wasting_rate ? (row.wasting_rate * 0.85).toFixed(1) : "0.0",
        totalChildren: row.total_children || 0,
        malnutritionCases: (row.severe_count || 0) + (row.moderate_count || 0),
        prevalence: row.wasting_rate ? `${row.wasting_rate.toFixed(1)}%` : "0%",
        trend: (row.wasting_rate || 0) > 15 ? "up" : "down"
      }));
    }
    return [];
  }, [rankingQuery.data]);

  // Child Monitoring Summary data - Hardcoded for now as it requires specific child selection
  const childGrowthData = [
    { month: "Jan", weight: 9.2, normalMin: 9.8, median: 11.5, normalMax: 13.5 },
    { month: "Feb", weight: 9.3, normalMin: 10.0, median: 11.8, normalMax: 13.9 },
    { month: "Mar", weight: 9.0, normalMin: 10.2, median: 12.0, normalMax: 14.2 },
    { month: "Apr", weight: 8.8, normalMin: 10.5, median: 12.3, normalMax: 14.5 },
    { month: "May", weight: 8.6, normalMin: 10.8, median: 12.5, normalMax: 14.8 }
  ];

  return (
    <div className="admin-container space-y-6">
      {/* Hero Image Slider */}
      <HeroImageSlider />

      {/* Top Header Card — role-aware */}
      {isSuperAdmin ? (
        /* ─── SUPERADMIN: Citywide Command Center Banner ─── */
        <div
          className="relative overflow-hidden rounded-2xl p-6 shadow-lg text-white"
          style={{
            background: "linear-gradient(135deg, #0f4c2f 0%, #1b6b47 50%, #2d8d5f 100%)",
          }}
        >
          {/* Animated background pulse */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-4 left-8 h-32 w-32 bg-emerald-400 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-2 right-12 h-24 w-24 bg-green-400 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "1s" }} />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 font-bold uppercase tracking-widest mb-3">
                <span className={`h-1.5 w-1.5 rounded-full ${wsStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                {wsStatus.connected ? 'Live Monitoring Active' : 'Connection Offline'}
              </div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5 text-white">
                <Radio className="h-6 w-6 text-emerald-400" />
                Citywide Command Center
                <span className="text-base font-normal text-emerald-200">({selectedYear})</span>
              </h1>
              <p className="text-sm text-emerald-200 font-medium mt-1">
                Real-time oversight of all barangays · Cabadbaran City Health Management System
              </p>
            </div>

            {/* Year Selector & Live KPI Badges */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Year Selector */}
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2 backdrop-blur-sm">
                <Calendar className="h-4 w-4 text-cyan-300" />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-transparent text-white font-semibold text-sm border-none outline-none cursor-pointer"
                >
                  {Array.from({ length: 11 }, (_, i) => 2020 + i).map((year) => (
                    <option key={year} value={year} className="bg-slate-800">
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                <Wifi className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wide">Barangays Online</p>
                  <p className="text-xl font-black text-white">{summary.data?.barangays_online ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                <AlertTriangle className="h-4 w-4 text-red-300" />
                <div>
                  <p className="text-[10px] text-red-200 font-bold uppercase tracking-wide">Need Attention</p>
                  <p className="text-xl font-black text-white">{liveStats.criticalBrgys}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                <Bell className="h-4 w-4 text-yellow-300" />
                <div>
                  <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wide">Active Alerts</p>
                  <p className="text-xl font-black text-white">{liveStats.activeAlerts}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                <Users className="h-4 w-4 text-emerald-300" />
                <div>
                  <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wide">Children Monitored</p>
                  <p className="text-xl font-black text-white">{liveStats.total.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ─── REGULAR ADMIN/STAFF: Standard Header ─── */
        <div
          className="relative overflow-hidden rounded-2xl p-6 shadow-lg text-white"
          style={{
            background: "linear-gradient(135deg, #064e3b 0%, #022c22 100%)",
          }}
        >
          {/* Animated background pulse */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-4 left-8 h-32 w-32 bg-emerald-400 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-2 right-12 h-24 w-24 bg-teal-450 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "1s" }} />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-xs text-emerald-300 font-bold uppercase tracking-widest mb-3">
                <span className={`h-1.5 w-1.5 rounded-full ${wsStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                {wsStatus.connected ? 'Live Monitoring Active' : 'Connection Offline'}
              </div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5 text-white">
                <Globe className="h-6 w-6 text-emerald-300" />
                Dashboard Overview
                <span className="text-base font-normal text-emerald-200">({selectedYear})</span>
              </h1>
              <p className="text-sm text-emerald-100 font-medium mt-1 uppercase">
                GIS-INTEGRATED HEALTH MONITORING SYSTEM WITH AI DECISION SUPPORT AND ALERT GENERATION FOR CHILD MALNUTRITION
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <div className="inline-flex items-center gap-1.5 bg-white/10 text-emerald-100 text-xs font-semibold px-2.5 py-1 rounded-full border border-white/20">
                  <Globe className="h-3.5 w-3.5 text-emerald-300" />
                  <span>Cabadbaran City</span>
                </div>
                {user?.barangay_name && (
                  <div className="inline-flex items-center gap-1.5 bg-white/10 text-emerald-100 text-xs font-semibold px-2.5 py-1 rounded-full border border-white/20">
                    <MapPin className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Assigned Barangay: {user.barangay_name}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Year Selector */}
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2 backdrop-blur-sm">
              <Calendar className="h-4 w-4 text-emerald-300" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-transparent text-white font-semibold text-sm border-none outline-none cursor-pointer"
              >
                {Array.from({ length: 11 }, (_, i) => 2020 + i).map((year) => (
                  <option key={year} value={year} className="bg-slate-800">
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Row (8 cards) */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        {/* Total Children */}
        <div className="admin-glass-panel p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <Users className="h-4.5 w-4.5" />
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Children</p>
          </div>
          <div className="mt-3.5">
            <p className="text-2xl font-black text-slate-800">{liveStats.total.toLocaleString()}</p>
            <p className="text-xs font-semibold text-slate-400 mt-1">100% Monitored</p>
          </div>
        </div>

        {/* Normal Status */}
        <div className="admin-glass-panel p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-4.5 w-4.5" />
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Normal Status</p>
          </div>
          <div className="mt-3.5">
            <p className="text-2xl font-black text-green-700">{liveStats.normal.toLocaleString()}</p>
            <p className="text-xs font-bold text-green-600 mt-1">
              {((liveStats.normal / liveStats.total) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Underweight Cases */}
        <div className="admin-glass-panel p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-yellow-50 text-yellow-600 rounded-lg flex items-center justify-center">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Underweight (Weight-for-Age)</p>
          </div>
          <div className="mt-3.5">
            <p className="text-2xl font-black text-yellow-750">{liveStats.underweight.toLocaleString()}</p>
            <p className="text-xs font-bold text-yellow-600 mt-1">
              {((liveStats.underweight / liveStats.total) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Stunted Cases */}
        <div className="admin-glass-panel p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Stunted (Height-for-Age)</p>
          </div>
          <div className="mt-3.5">
            <p className="text-2xl font-black text-orange-700">{liveStats.stunted.toLocaleString()}</p>
            <p className="text-xs font-bold text-orange-600 mt-1">
              {((liveStats.stunted / liveStats.total) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Wasted Cases */}
        <div className="admin-glass-panel p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Wasted (Weight-for-Height)</p>
          </div>
          <div className="mt-3.5">
            <p className="text-2xl font-black text-red-650">{liveStats.wasted.toLocaleString()}</p>
            <p className="text-xs font-bold text-red-500 mt-1">
              {((liveStats.wasted / liveStats.total) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Severe Cases */}
        <div className="admin-glass-panel p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-red-900/10 text-red-655 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Severe Cases</p>
          </div>
          <div className="mt-3.5">
            <p className="text-2xl font-black text-red-750">{liveStats.severe.toLocaleString()}</p>
            <p className="text-xs font-bold text-red-750 mt-1">
              {((liveStats.severe / liveStats.total) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="admin-glass-panel p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
              <Bell className="h-4.5 w-4.5" />
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Active Alerts</p>
          </div>
          <div className="mt-3.5">
            <p className="text-2xl font-black text-purple-700">{liveStats.activeAlerts}</p>
            <Link href="/alerts" className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-0.5 mt-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* High-Risk Barangays */}
        <div className="admin-glass-panel p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center">
              <MapPin className="h-4.5 w-4.5" />
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">High-Risk Brgys</p>
          </div>
          <div className="mt-3.5">
            <p className="text-2xl font-black text-teal-700">{liveStats.criticalBrgys}</p>
            <Link href="/barangay-ranking" className="text-xs font-bold text-teal-600 hover:underline flex items-center gap-0.5 mt-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* SuperAdmin Strategic Overview - Charts Row */}



      {/* ADMIN ONLY: Upcoming Program Activities & Child Monitoring Summary */}
      {!isSuperAdmin && (
        <div className="space-y-6">
          {/* Upcoming Program Activities */}
          <UpcomingProgramsWidget 
            data={upcomingProgramsQuery.data} 
            isLoading={upcomingProgramsQuery.isLoading} 
          />

          {/* Child Monitoring Summaries */}
          <ChildMonitoringWidget 
            data={childMonitoringQuery.data} 
            isLoading={childMonitoringQuery.isLoading} 
          />

          {/* Malnutrition Trend & Nutritional Status Charts */}
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Malnutrition Trend Chart */}
            <div className="admin-glass-panel p-5 flex flex-col h-[340px]">
              <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-3 border-b border-slate-150 pb-2.5">
                📈 Malnutrition Trend (6 Months)
              </h3>
              <div className="flex-1 min-h-0 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey="Underweight" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Stunted" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Wasted" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Nutritional Status Distribution */}
            <div className="admin-glass-panel p-5 flex flex-col h-[340px]">
              <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-3 border-b border-slate-150 pb-2.5">
                📊 Nutritional Status Distribution
              </h3>
              <div className="flex flex-1 items-center justify-center position-relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
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

                {/* Middle Total Indicator */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-5px]">
                  <span className="text-xl font-black text-slate-800">{liveStats.total.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
           SUPERADMIN STRATEGIC INTELLIGENCE DASHBOARD
      ═══════════════════════════════════════════════════════ */}
      {isSuperAdmin && (
        <div className="space-y-6 border-t-2 border-indigo-100 pt-6">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Strategic Intelligence Hub</h2>
            <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase">SuperAdmin Only</span>
          </div>
          <p className="text-sm text-slate-600 font-medium ml-8">City-wide barangay performance monitoring, predictive analytics, and resource optimization</p>

          {/* ─── ROW 1: Compliance Dashboard ─── */}
          <div className="grid gap-6">
            {/* Barangay Compliance Dashboard */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
                <div className="flex items-center gap-2">
                  <Award className="h-4.5 w-4.5 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-800">Barangay Compliance Dashboard</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">Based on reports, programs & assessments</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-4">#</th>
                      <th className="px-4">Barangay</th>
                      <th className="px-4">Reports</th>
                      <th className="px-4">Programs</th>
                      <th className="px-4">Assessments</th>
                      <th className="px-4">Overall</th>
                      <th className="px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(complianceQuery.data ?? [
                      { rank: 1, name: "Kauswagan", report_compliance: 96, program_compliance: 92, assessment_compliance: 98, overall_compliance: 95.3, status: "compliant" },
                      { rank: 2, name: "Bayabas", report_compliance: 88, program_compliance: 84, assessment_compliance: 90, overall_compliance: 87.3, status: "compliant" },
                      { rank: 3, name: "Sanghan", report_compliance: 72, program_compliance: 65, assessment_compliance: 78, overall_compliance: 71.7, status: "needs_attention" },
                      { rank: 4, name: "Del Pilar", report_compliance: 60, program_compliance: 55, assessment_compliance: 64, overall_compliance: 59.7, status: "non_compliant" },
                      { rank: 5, name: "Poblacion", report_compliance: 95, program_compliance: 88, assessment_compliance: 94, overall_compliance: 92.3, status: "compliant" },
                    ]).slice(0, 8).map((row: any, i: number) => {
                      const pct = row.overall_compliance ?? row.compliance_score ?? 0;
                      const status = row.status ?? (pct >= 85 ? "compliant" : pct >= 65 ? "needs_attention" : "non_compliant");
                      return (
                        <tr key={row.name ?? i} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-400">{i + 1}</td>
                          <td className="px-4 font-extrabold text-slate-800">{row.name ?? row.barangay_name}</td>
                          <td className="px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${row.report_compliance ?? pct}%` }} />
                              </div>
                              <span className="font-bold text-slate-700">{Math.round(row.report_compliance ?? pct)}%</span>
                            </div>
                          </td>
                          <td className="px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-400 rounded-full" style={{ width: `${row.program_compliance ?? pct}%` }} />
                              </div>
                              <span className="font-bold text-slate-700">{Math.round(row.program_compliance ?? pct)}%</span>
                            </div>
                          </td>
                          <td className="px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-400 rounded-full" style={{ width: `${row.assessment_compliance ?? pct}%` }} />
                              </div>
                              <span className="font-bold text-slate-700">{Math.round(row.assessment_compliance ?? pct)}%</span>
                            </div>
                          </td>
                          <td className="px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    pct >= 85 ? "bg-emerald-500" : pct >= 65 ? "bg-amber-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-black text-slate-800">{pct.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                              status === "compliant"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : status === "needs_attention"
                                ? "bg-amber-50 border-amber-200 text-amber-700"
                                : "bg-red-50 border-red-200 text-red-700"
                            }`}>
                              {status === "compliant" ? "Compliant" : status === "needs_attention" ? "Needs Attention" : "Non-Compliant"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ─── ROW 2: Activity Monitoring Board ─── */}
          <div className="grid gap-6">
            {/* Barangay Activity Monitoring Board */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white">
                <div className="flex items-center gap-2">
                  <Radio className="h-4.5 w-4.5 text-teal-600" />
                  <h3 className="text-sm font-black text-slate-800">Barangay Activity Monitoring Board</h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                  Live Feed
                </div>
              </div>
              <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                {[
                  { time: "1:20 PM", barangay: "Del Pilar", action: "resolved Severe Case #2045", type: "resolve", color: "emerald" },
                  { time: "11:00 AM", barangay: "Bayabas", action: "submitted Monthly Report", type: "report", color: "indigo" },
                  { time: "10:15 AM", barangay: "Kauswagan", action: "conducted Feeding Program", type: "program", color: "amber" },
                  { time: "9:45 AM", barangay: "Sanghan", action: "completed Child Assessments (12 children)", type: "assessment", color: "blue" },
                  { time: "9:00 AM", barangay: "Poblacion", action: "filed Home Visit Report", type: "report", color: "indigo" },
                  { time: "8:30 AM", barangay: "Del Pilar", action: "initiated Vitamin A Supplementation", type: "program", color: "amber" },
                  { time: "8:00 AM", barangay: "Kauswagan", action: "escalated Alert #312 (Severe Case)", type: "alert", color: "red" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-400">{item.time}</span>
                    </div>
                    <div className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${
                      item.color === "red" ? "bg-red-500" :
                      item.color === "emerald" ? "bg-emerald-500" :
                      item.color === "amber" ? "bg-amber-500" :
                      item.color === "indigo" ? "bg-indigo-500" : "bg-blue-500"
                    }`} />
                    <div>
                      <p className="text-xs text-slate-700 font-medium">
                        <span className="font-extrabold text-slate-900">Barangay {item.barangay}</span>{" "}
                        {item.action}.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── ROW 3: Intervention Effectiveness Analytics ─── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4.5 w-4.5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-800">Intervention Effectiveness Analytics</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Weight gain vs. stunting reduction outcomes</span>
            </div>
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Chart */}
              <div className="md:col-span-2 p-5 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={effectivenessQuery.data ?? [
                      { name: "Feeding Program", success_rate: 78, children_improved: 45, avg_weight_gain: 0.8 },
                      { name: "Vit A Supplement", success_rate: 91, children_improved: 72, avg_weight_gain: 0.2 },
                      { name: "Iron Supplement", success_rate: 85, children_improved: 60, avg_weight_gain: 0.4 },
                      { name: "Deworming", success_rate: 88, children_improved: 55, avg_weight_gain: 0.5 },
                      { name: "Home Visit", success_rate: 72, children_improved: 38, avg_weight_gain: 0.3 },
                    ]}
                    margin={{ top: 5, right: 20, bottom: 40, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} angle={-25} textAnchor="end" stroke="#e2e8f0" />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} stroke="#e2e8f0" />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="success_rate" name="Success Rate %" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28} />
                    <Bar dataKey="children_improved" name="Children Improved" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* KPI Summary */}
              <div className="p-5 flex flex-col justify-center gap-4">
                {[
                  { label: "Top Intervention", value: effectivenessQuery.data?.[0]?.name ?? "Vitamin A", sub: "Highest success rate", color: "emerald" },
                  { label: "Avg Success Rate", value: effectivenessQuery.data ? `${(effectivenessQuery.data.reduce((a: number, b: any) => a + (b.success_rate ?? 0), 0) / effectivenessQuery.data.length).toFixed(0)}%` : "83%", sub: "Across all programs", color: "indigo" },
                  { label: "Children Improved", value: effectivenessQuery.data ? effectivenessQuery.data.reduce((a: number, b: any) => a + (b.children_improved ?? 0), 0) : 270, sub: "This quarter", color: "teal" },
                ].map((kpi, i) => (
                  <div key={i} className={`rounded-xl p-3.5 border ${
                    kpi.color === "emerald" ? "bg-emerald-50 border-emerald-100" :
                    kpi.color === "indigo" ? "bg-indigo-50 border-indigo-100" :
                    "bg-teal-50 border-teal-100"
                  }`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{kpi.label}</p>
                    <p className={`text-xl font-black mt-0.5 ${
                      kpi.color === "emerald" ? "text-emerald-700" :
                      kpi.color === "indigo" ? "text-indigo-700" : "text-teal-700"
                    }`}>{kpi.value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{kpi.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── ROW 4: City-Wide Programs Overview ─── */}
          <div className="space-y-6">
            {/* City-Wide Programs Overview */}
            <SuperAdminProgramsOverview 
              data={superAdminProgramsQuery.data}
              isLoading={superAdminProgramsQuery.isLoading}
            />

            {/* City-Wide AI Strategic Analysis Widget */}
            <div className="border-t-2 border-indigo-100 pt-6 mt-6">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">AI Insights & Strategic Recommendations</h3>
              </div>
              <SuperAdminAIInsightsWidget 
                data={aiInsightsQuery.data}
                isLoading={aiInsightsQuery.isLoading}
              />
            </div>
          </div>
        </div>
      )}

      {/* ADMIN ONLY: Barangay AI Insights */}
      {!isSuperAdmin && (
        <div className="mt-8 pt-6 border-t border-slate-100">
          <BarangayAIInsights />
        </div>
      )}
    </div>
  );
}
