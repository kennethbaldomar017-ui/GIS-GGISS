"use client";
import "@/styles/admin.css";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Sliders,
  Settings as SettingsIcon,
  Bell,
  MapPin,
  Database,
  Activity,
  CheckCircle,
  HelpCircle,
  Save,
  Loader2,
  Trash2,
  AlertTriangle
} from "lucide-react";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("algorithm");

  const [uwWeight, setUwWeight] = useState("30");
  const [stWeight, setStWeight] = useState("30");
  const [waWeight, setWaWeight] = useState("40");
  const [lowMin, setLowMin] = useState("0");
  const [lowMax, setLowMax] = useState("30");
  const [modMin, setModMin] = useState("31");
  const [modMax, setModMax] = useState("60");
  const [highMin, setHighMin] = useState("61");
  const [highMax, setHighMax] = useState("80");
  const [critMin, setCritMin] = useState("81");
  const [critMax, setCritMax] = useState("100");
  const [wazThreshold, setWazThreshold] = useState("-2.00");
  const [hazThreshold, setHazThreshold] = useState("-2.00");
  const [whzThreshold, setWhzThreshold] = useState("-2.00");
  const [severeWasting, setSevereWasting] = useState("-3.00");
  const [updateFreq, setUpdateFreq] = useState("7 days");
  const [enableForecast, setEnableForecast] = useState(true);
  const [enableAlert, setEnableAlert] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");
  
  // Checklist for what to delete
  const [deleteOptions, setDeleteOptions] = useState({
    children: true,
    measurements: true,
    alerts: true,
    referrals: true,
    reports: true,
    notifications: true,
    programs: true,
    homeVisits: true,
    cases: true,
    messages: true,
    calendar: true,
    households: true,
    budgets: true,
    logs: true,
    imports: true,
    users: false // Admin users - default to false for safety
  });

  const toggleAllDelete = (checked: boolean) => {
    setDeleteOptions({
      children: checked,
      measurements: checked,
      alerts: checked,
      referrals: checked,
      reports: checked,
      notifications: checked,
      programs: checked,
      homeVisits: checked,
      cases: checked,
      messages: checked,
      calendar: checked,
      households: checked,
      budgets: checked,
      logs: checked,
      imports: checked,
      users: checked
    });
  };

  const isAnySelected = Object.values(deleteOptions).some(v => v);

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get("/api/settings").then((r) => r.data),
  });

  useEffect(() => {
    if (settingsData) {
      if (settingsData.uw_weight) setUwWeight(settingsData.uw_weight);
      if (settingsData.st_weight) setStWeight(settingsData.st_weight);
      if (settingsData.wa_weight) setWaWeight(settingsData.wa_weight);
      if (settingsData.waz_threshold) setWazThreshold(settingsData.waz_threshold);
      if (settingsData.haz_threshold) setHazThreshold(settingsData.haz_threshold);
      if (settingsData.whz_threshold) setWhzThreshold(settingsData.whz_threshold);
      if (settingsData.severe_wasting) setSevereWasting(settingsData.severe_wasting);
      if (settingsData.update_freq) setUpdateFreq(settingsData.update_freq);
      if (settingsData.enable_forecast) setEnableForecast(settingsData.enable_forecast === "true");
      if (settingsData.enable_alert) setEnableAlert(settingsData.enable_alert === "true");
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: (payload: { key: string; value: string }) =>
      api.post("/api/settings", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage("");
    const settings = [
      { key: "uw_weight", value: uwWeight },
      { key: "st_weight", value: stWeight },
      { key: "wa_weight", value: waWeight },
      { key: "waz_threshold", value: wazThreshold },
      { key: "haz_threshold", value: hazThreshold },
      { key: "whz_threshold", value: whzThreshold },
      { key: "severe_wasting", value: severeWasting },
      { key: "update_freq", value: updateFreq },
      { key: "enable_forecast", value: String(enableForecast) },
      { key: "enable_alert", value: String(enableAlert) },
    ];
    Promise.all(settings.map((s) => saveMutation.mutateAsync(s)))
      .then(() => setSaveMessage("Settings saved successfully!"))
      .catch(() => setSaveMessage("Failed to save settings"))
      .finally(() => setTimeout(() => setSaveMessage(""), 3000));
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== "DELETE ALL DATA") {
      setDeleteError("Please type 'DELETE ALL DATA' exactly to confirm");
      return;
    }

    if (!isAnySelected) {
      setDeleteError("Please select at least one data type to delete");
      return;
    }

    setDeleteLoading(true);
    setDeleteError("");
    setDeleteSuccess("");

    try {
      const response = await api.delete("/api/security/data/delete-all", {
        params: { 
          confirm: deleteConfirmText,
          ...deleteOptions // Send the checklist options
        }
      });

      setDeleteSuccess(response.data.message);
      setDeleteConfirmText("");
      
      // Show detailed results
      const counts = response.data.deleted_counts;
      const total = Object.values(counts).reduce((sum: number, val: any) => sum + val, 0);
      console.log("Deleted counts:", counts);
      console.log("Total deleted:", total);
      
      // Refresh the page after 3 seconds
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error: any) {
      setDeleteError(error.response?.data?.detail || "Failed to delete data");
    } finally {
      setDeleteLoading(false);
    }
  };

  const tabs = [
    { id: "general", label: "General Settings", icon: SettingsIcon },
    { id: "algorithm", label: "Algorithm Settings", icon: Sliders },
    { id: "notification", label: "Notification Settings", icon: Bell },
    { id: "gis", label: "GIS Settings", icon: MapPin },
    { id: "data", label: "Data Management", icon: Database },
    { id: "logs", label: "Activity Logs", icon: Activity }
  ];

  return (
    <div className="admin-container space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            System Settings Module
          </h1>
          <p className="text-sm mt-1">
            Configure system preferences and parameters
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Tab Navigation (3 cols) */}
        <div className="admin-glass-panel lg:col-span-3 p-4 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all text-left admin-tab-vertical ${
                  isActive
                    ? "active"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Content Pane (9 cols) */}
        <div className="admin-glass-panel lg:col-span-9 p-6">
          {activeTab === "algorithm" ? (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
                  Algorithm Settings
                </h3>
                <p className="text-xs text-slate-450 mt-0.5">Configure all implemented algorithms for nutritional assessment, risk classification, and decision support.</p>
              </div>

              {/* Implemented Algorithms Overview */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-indigo-600" />
                  <h4 className="text-sm font-extrabold text-indigo-900">Implemented Algorithms</h4>
                </div>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-slate-700">📊 Z-Score Calculation (WHO)</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Anthropometric assessment using LMS parameters</p>
                  </div>
                  <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-slate-700">⚠️ Three-Tier Alert System</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Individual, Purok, and Population-level alerts</p>
                  </div>
                  <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-slate-700">📈 Trend Analysis Engine</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Percent change and velocity calculations</p>
                  </div>
                  <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-slate-700">🎯 Risk Scoring Algorithm</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Weighted composite risk assessment</p>
                  </div>
                  <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-slate-700">🤖 AI-Powered Recommendations</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">AI-driven interventions and monitoring plans</p>
                  </div>
                  <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-slate-700">📋 TAM Analysis</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Technology Acceptance Model for system adoption</p>
                  </div>
                  <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-slate-700">✅ Accuracy Assessment</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Sensitivity and specificity metrics</p>
                  </div>
                  <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-slate-700">🔍 Population-Level Alerts</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Absolute thresholds and trend detection</p>
                  </div>
                  <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-slate-700">💊 OPT+ Calculations</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Operation Timbang Plus indicators</p>
                  </div>
                </div>
              </div>

              {/* Section 1: Z-Score Calculation Algorithm */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-lg">📊</div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-800">WHO Z-Score Calculation</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Uses WHO 2006 LMS (Lambda, Mu, Sigma) parameters for anthropometric assessment</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-[10px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-bold text-slate-700">Formula:</span> Z = ((X/M)^L - 1) / (L × S)</div>
                    <div><span className="font-bold text-slate-700">Classification:</span> WAZ, HAZ, WHZ indices</div>
                    <div><span className="font-bold text-slate-700">Data Source:</span> WHO anthropometric reference data</div>
                    <div><span className="font-bold text-slate-700">Application:</span> Individual child measurement assessment</div>
                  </div>
                </div>
              </div>

              {/* Section 2: Three-Tier Alert System */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-yellow-100 flex items-center justify-center text-lg">⚠️</div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-800">Three-Tier Alert Generation System</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Automated alert generation at individual, purok, and population levels</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-[10px]">
                  <div className="space-y-1.5">
                    <div><span className="font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">TIER 1 - Individual</span> SAM/MAM detection per child</div>
                    <div><span className="font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">TIER 2 - Purok</span> When {'>'} 10% children malnourished</div>
                    <div><span className="font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">TIER 3 - Population</span> Barangay-level prevalence trends</div>
                  </div>
                </div>
              </div>

              {/* Section 3: Risk Scoring Algorithm */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center text-lg">🎯</div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-800">Composite Risk Scoring Algorithm</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Weighted combination of multiple malnutrition indicators</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-[10px]">
                  <div className="text-[9px]">Formula: Risk Score = (WAZ% × {uwWeight}) + (HAZ% × {stWeight}) + (WHZ% × {waWeight})</div>
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded">
                    <div className="text-center"><span className="font-bold block">Underweight (WAZ)</span>{uwWeight}%</div>
                    <div className="text-center"><span className="font-bold block">Stunted (HAZ)</span>{stWeight}%</div>
                    <div className="text-center"><span className="font-bold block">Wasted (WHZ)</span>{waWeight}%</div>
                  </div>
                </div>
              </div>

              {/* Section 4: Trend Analysis Engine */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center text-lg">📈</div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-800">Trend Analysis Engine</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Calculates velocity and direction of nutritional changes</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 text-[10px]">
                  <div><span className="font-bold">Percent Change Formula:</span> ((Current - Previous) / Previous) × 100</div>
                  <div><span className="font-bold">Indicators:</span> Wasting, Stunting, Underweight rates</div>
                  <div><span className="font-bold">Frequency:</span> {updateFreq}</div>
                  <div><span className="font-bold">Application:</span> Detect improving or declining nutritional status</div>
                </div>
              </div>

              {/* Section 5: AI-Powered Recommendations */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-lg">🤖</div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-800">AI-Powered Recommendations (Retrieval-Augmented Generation)</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">AI-powered personalized interventions based on child status</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 text-[10px]">
                  <div><span className="font-bold">Generates:</span> Nutrition advice, monitoring schedules, follow-up plans</div>
                  <div><span className="font-bold">Data Inputs:</span> Measurement status, age, trends, location</div>
                  <div><span className="font-bold">Knowledge Source:</span> Health protocols and guidelines</div>
                  <div><span className="font-bold">Status:</span> {enableForecast ? "✅ Enabled" : "❌ Disabled"}</div>
                </div>
              </div>

              {/* Section 6: Population-Level Alerts */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center text-lg">🔍</div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-800">Population-Level Alert Detection</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Monitors aggregate barangay/purok indicators</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 text-[10px]">
                  <div><span className="font-bold">Methods:</span> Absolute thresholds + Trend analysis</div>
                  <div><span className="font-bold">Triggers:</span> {'>'} 15% wasting, increasing trends</div>
                  <div><span className="font-bold">Scope:</span> Barangay and purok-level aggregates</div>
                  <div><span className="font-bold">Status:</span> {enableAlert ? "✅ Enabled" : "❌ Disabled"}</div>
                </div>
              </div>

              {/* Risk Score Formula Section */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-750">
                  <Sliders className="h-4 w-4 text-slate-500" />
                  <span>Risk Score Formula</span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  Assign weights (percentage totals must sum to 100%) for undernutrition indices.
                </p>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Underweight Weight (%)</label>
                    <input
                      type="number"
                      value={uwWeight}
                      onChange={(e) => setUwWeight(e.target.value)}
                      className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Stunted Weight (%)</label>
                    <input
                      type="number"
                      value={stWeight}
                      onChange={(e) => setStWeight(e.target.value)}
                      className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Wasted Weight (%)</label>
                    <input
                      type="number"
                      value={waWeight}
                      onChange={(e) => setWaWeight(e.target.value)}
                      className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Risk Level Classification */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-4">
                <p className="flex items-center gap-1.5 font-bold text-xs text-slate-750">
                  <Activity className="h-4 w-4 text-slate-500" />
                  <span>Risk Level Classification Range</span>
                </p>

                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  <div className="bg-white border border-slate-250 rounded-lg p-3">
                    <span className="h-3.5 w-full bg-green-500 rounded text-center text-[8.5px] text-white flex items-center justify-center font-bold mb-2">0-30 LOW RISK</span>
                    <div className="flex gap-1 items-center justify-center text-xs">
                      <input type="number" value={lowMin} onChange={(e) => setLowMin(e.target.value)} className="admin-interactive-input w-12 p-1 rounded text-center text-[11px]" />
                      <span>to</span>
                      <input type="number" value={lowMax} onChange={(e) => setLowMax(e.target.value)} className="admin-interactive-input w-12 p-1 rounded text-center text-[11px]" />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-250 rounded-lg p-3">
                    <span className="h-3.5 w-full bg-yellow-500 rounded text-center text-[8.5px] text-white flex items-center justify-center font-bold mb-2">31-60 MODERATE</span>
                    <div className="flex gap-1 items-center justify-center text-xs">
                      <input type="number" value={modMin} onChange={(e) => setModMin(e.target.value)} className="admin-interactive-input w-12 p-1 rounded text-center text-[11px]" />
                      <span>to</span>
                      <input type="number" value={modMax} onChange={(e) => setModMax(e.target.value)} className="admin-interactive-input w-12 p-1 rounded text-center text-[11px]" />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-250 rounded-lg p-3">
                    <span className="h-3.5 w-full bg-orange-500 rounded text-center text-[8.5px] text-white flex items-center justify-center font-bold mb-2">61-80 HIGH RISK</span>
                    <div className="flex gap-1 items-center justify-center text-xs">
                      <input type="number" value={highMin} onChange={(e) => setHighMin(e.target.value)} className="admin-interactive-input w-12 p-1 rounded text-center text-[11px]" />
                      <span>to</span>
                      <input type="number" value={highMax} onChange={(e) => setHighMax(e.target.value)} className="admin-interactive-input w-12 p-1 rounded text-center text-[11px]" />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-250 rounded-lg p-3">
                    <span className="h-3.5 w-full bg-red-655 rounded text-center text-[8.5px] text-white flex items-center justify-center font-bold mb-2">81-100 CRITICAL</span>
                    <div className="flex gap-1 items-center justify-center text-xs">
                      <input type="number" value={critMin} onChange={(e) => setCritMin(e.target.value)} className="admin-interactive-input w-12 p-1 rounded text-center text-[11px]" />
                      <span>to</span>
                      <input type="number" value={critMax} onChange={(e) => setCritMax(e.target.value)} className="admin-interactive-input w-12 p-1 rounded text-center text-[11px]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Threshold Settings */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-4">
                <p className="flex items-center gap-1.5 font-bold text-xs text-slate-750">
                  <Sliders className="h-4 w-4 text-slate-500" />
                  <span>Threshold Settings</span>
                </p>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Underweight Threshold (WAZ)</label>
                    <input
                      type="text"
                      value={wazThreshold}
                      onChange={(e) => setWazThreshold(e.target.value)}
                      className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Stunted Threshold (HAZ)</label>
                    <input
                      type="text"
                      value={hazThreshold}
                      onChange={(e) => setHazThreshold(e.target.value)}
                      className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Wasting Threshold (WHZ)</label>
                    <input
                      type="text"
                      value={whzThreshold}
                      onChange={(e) => setWhzThreshold(e.target.value)}
                      className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Severe Wasting Threshold</label>
                    <input
                      type="text"
                      value={severeWasting}
                      onChange={(e) => setSevereWasting(e.target.value)}
                      className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Other Settings */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-4">
                <p className="flex items-center gap-1.5 font-bold text-xs text-slate-750">
                  <SettingsIcon className="h-4 w-4 text-slate-500" />
                  <span>Other Settings</span>
                </p>

                <div className="grid gap-6 sm:grid-cols-3 items-center">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Update Risk Level Every</label>
                    <select
                      value={updateFreq}
                      onChange={(e) => setUpdateFreq(e.target.value)}
                      className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs bg-white text-slate-700"
                    >
                      <option value="24 hours">24 hours</option>
                      <option value="7 days">7 days</option>
                      <option value="30 days">30 days</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between border border-slate-100 rounded-lg p-2.5 bg-white">
                    <span className="text-xs font-bold text-slate-650">Enable Predictive Forecasting</span>
                    <input
                      type="checkbox"
                      checked={enableForecast}
                      onChange={(e) => setEnableForecast(e.target.checked)}
                      className="rounded text-teal-650 h-4.5 w-4.5"
                    />
                  </div>

                  <div className="flex items-center justify-between border border-slate-100 rounded-lg p-2.5 bg-white">
                    <span className="text-xs font-bold text-slate-650">Enable Auto Alert Generation</span>
                    <input
                      type="checkbox"
                      checked={enableAlert}
                      onChange={(e) => setEnableAlert(e.target.checked)}
                      className="rounded text-teal-650 h-4.5 w-4.5"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                {saveMessage && (
                  <span className={`text-xs font-bold ${saveMessage.includes("success") ? "text-green-600" : "text-red-600"}`}>
                    {saveMessage}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="admin-action-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs disabled:opacity-50"
                >
                  {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {saveMutation.isPending ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          ) : (
            <div className="py-12 space-y-6">
              {/* GENERAL SETTINGS TAB */}
              {activeTab === "general" && (
                <div className="admin-container space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">General System Settings</h3>
                    <p className="text-xs text-slate-450 mt-0.5">Configure basic system information and preferences.</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">System Name</label>
                        <input type="text" defaultValue="Child Malnutrition Monitoring System" className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Organization</label>
                        <input type="text" defaultValue="Cabadbaran City Health Office" className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">System Email</label>
                        <input type="email" defaultValue="gishms@cabadbaran.gov.ph" className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Support Phone</label>
                        <input type="tel" defaultValue="+63 (085) 817-0040" className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700">System Preferences</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg">
                        <span className="text-xs font-bold text-slate-600">Enable Two-Factor Authentication</span>
                        <input type="checkbox" className="rounded h-4 w-4" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg">
                        <span className="text-xs font-bold text-slate-600">Enable System Maintenance Mode</span>
                        <input type="checkbox" className="rounded h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button className="admin-action-btn-primary px-5 py-2.5 rounded-lg text-xs">Save General Settings</button>
                  </div>
                </div>
              )}

              {/* NOTIFICATION SETTINGS TAB */}
              {activeTab === "notification" && (
                <div className="admin-container space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Notification Settings</h3>
                    <p className="text-xs text-slate-450 mt-0.5">Configure how and when system notifications are sent.</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2"><Bell className="h-4 w-4" /> Alert Notification Rules</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Critical Malnutrition Alerts</p>
                          <p className="text-[10px] text-slate-500">Send immediately when severe cases are detected</p>
                        </div>
                        <input type="checkbox" defaultChecked className="rounded h-4 w-4" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Daily Digest Emails</p>
                          <p className="text-[10px] text-slate-500">Send summary at 8:00 AM</p>
                        </div>
                        <input type="checkbox" defaultChecked className="rounded h-4 w-4" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Weekly Reports</p>
                          <p className="text-[10px] text-slate-500">Send every Monday at 6:00 AM</p>
                        </div>
                        <input type="checkbox" defaultChecked className="rounded h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button className="admin-action-btn-primary px-5 py-2.5 rounded-lg text-xs">Save Notification Settings</button>
                  </div>
                </div>
              )}

              {/* GIS SETTINGS TAB */}
              {activeTab === "gis" && (
                <div className="admin-container space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">GIS Map Settings</h3>
                    <p className="text-xs text-slate-450 mt-0.5">Configure geographic information system preferences.</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Map Center Latitude</label>
                        <input type="text" defaultValue="9.118" className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Map Center Longitude</label>
                        <input type="text" defaultValue="125.565" className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Default Zoom Level</label>
                        <input type="number" defaultValue="12" className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Heatmap Blur Radius</label>
                        <input type="number" defaultValue="20" className="admin-interactive-input w-full rounded-lg px-3 py-2 text-xs" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button className="admin-action-btn-primary px-5 py-2.5 rounded-lg text-xs">Save GIS Settings</button>
                  </div>
                </div>
              )}

              {/* DATA MANAGEMENT TAB */}
              {activeTab === "data" && (
                <div className="admin-container space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Data Management</h3>
                    <p className="text-xs text-slate-450 mt-0.5">Manage system data and perform bulk operations.</p>
                  </div>

                  {/* Delete All Data Section */}
                  <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-extrabold text-red-900">⚠️ Delete All Data (Super Admin Only)</h4>
                        <p className="text-xs text-red-700 mt-2 leading-relaxed">
                          This action will permanently delete selected data from all barangays. 
                          <span className="font-bold block mt-1">Select what you want to delete:</span>
                        </p>
                        
                        {/* Select All Checkbox */}
                        <div className="bg-white border-2 border-red-300 rounded-lg p-3 mt-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Object.values(deleteOptions).every(v => v)}
                              onChange={(e) => toggleAllDelete(e.target.checked)}
                              className="h-5 w-5 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm font-bold text-red-900">Select / Deselect All</span>
                          </label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.children}
                              onChange={(e) => setDeleteOptions({...deleteOptions, children: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Children records</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.measurements}
                              onChange={(e) => setDeleteOptions({...deleteOptions, measurements: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Measurements</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.alerts}
                              onChange={(e) => setDeleteOptions({...deleteOptions, alerts: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Alerts</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.notifications}
                              onChange={(e) => setDeleteOptions({...deleteOptions, notifications: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Notifications</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.reports}
                              onChange={(e) => setDeleteOptions({...deleteOptions, reports: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Reports</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.referrals}
                              onChange={(e) => setDeleteOptions({...deleteOptions, referrals: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Referrals</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.programs}
                              onChange={(e) => setDeleteOptions({...deleteOptions, programs: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Program Activities</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.homeVisits}
                              onChange={(e) => setDeleteOptions({...deleteOptions, homeVisits: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Home Visits</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.cases}
                              onChange={(e) => setDeleteOptions({...deleteOptions, cases: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Cases & History</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.messages}
                              onChange={(e) => setDeleteOptions({...deleteOptions, messages: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Messages</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.calendar}
                              onChange={(e) => setDeleteOptions({...deleteOptions, calendar: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Calendar Events</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.households}
                              onChange={(e) => setDeleteOptions({...deleteOptions, households: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Households</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.budgets}
                              onChange={(e) => setDeleteOptions({...deleteOptions, budgets: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Project Budgets</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.logs}
                              onChange={(e) => setDeleteOptions({...deleteOptions, logs: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Activity Logs</span>
                          </label>
                          
                          <label className="bg-white border border-red-200 rounded-lg p-2.5 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.imports}
                              onChange={(e) => setDeleteOptions({...deleteOptions, imports: e.target.checked})}
                              className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="font-bold text-red-800">Import Jobs</span>
                          </label>
                          
                          <label className="bg-orange-100 border-2 border-orange-400 rounded-lg p-2.5 cursor-pointer hover:bg-orange-200 transition-colors flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOptions.users}
                              onChange={(e) => setDeleteOptions({...deleteOptions, users: e.target.checked})}
                              className="h-4 w-4 rounded border-orange-400 text-orange-600 focus:ring-orange-500"
                            />
                            <span className="font-bold text-orange-900">Admin Users ⚠️</span>
                          </label>
                        </div>
                        
                        {/* Warning for users deletion */}
                        {deleteOptions.users && (
                          <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-3 mt-2">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold text-orange-900">⚠️ Warning: Delete Admin Users Selected!</p>
                                <p className="text-xs text-orange-800 mt-1">
                                  This will delete all <span className="font-bold">admin users</span> (BHWs). 
                                  The current <span className="font-bold">super_admin</span> account will be preserved.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Selected count display */}
                        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mt-3">
                          <p className="text-xs font-bold text-yellow-900">
                            ✓ Selected: {Object.values(deleteOptions).filter(v => v).length} of {Object.keys(deleteOptions).length} data types
                          </p>
                        </div>

                        <div className="bg-green-50 border border-green-300 rounded-lg p-3 mt-3">
                          <p className="text-xs font-bold text-green-800 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            The following will be PRESERVED:
                          </p>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                            <p className="text-green-700">✓ Barangays</p>
                            <p className="text-green-700">✓ Puroks</p>
                            <p className="text-green-700">✓ Super Admin Account</p>
                            <p className="text-green-700">✓ System Settings</p>
                            {!deleteOptions.users && (
                              <p className="text-green-700 col-span-2">✓ All Admin Users (BHWs)</p>
                            )}
                          </div>
                        </div>

                        <div className="bg-white border-2 border-red-300 rounded-lg p-4 mt-4 space-y-3">
                          <label className="block">
                            <span className="text-xs font-bold text-red-900 mb-2 block">
                              Type <span className="bg-red-200 px-2 py-0.5 rounded font-mono">DELETE ALL DATA</span> to confirm:
                            </span>
                            <input
                              type="text"
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              placeholder="Type: DELETE ALL DATA"
                              className="w-full px-4 py-2.5 border-2 border-red-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              disabled={deleteLoading}
                            />
                          </label>

                          {deleteError && (
                            <div className="bg-red-100 border border-red-300 rounded-lg p-3 flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs font-bold text-red-800">{deleteError}</p>
                            </div>
                          )}

                          {deleteSuccess && (
                            <div className="bg-green-100 border border-green-300 rounded-lg p-3 flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs font-bold text-green-800">{deleteSuccess}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2">
                            <p className="text-[10px] text-red-600 font-bold">
                              ⚠️ This action cannot be undone!
                            </p>
                            <button
                              onClick={handleDeleteAllData}
                              disabled={deleteLoading || deleteConfirmText !== "DELETE ALL DATA" || !isAnySelected}
                              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all shadow-lg"
                            >
                              {deleteLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4" />
                                  Delete Selected ({Object.values(deleteOptions).filter(v => v).length})
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <HelpCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-blue-900">Why would I use this?</p>
                        <p className="text-xs text-blue-700 mt-1">
                          This feature is useful for resetting the system for a new operational period (e.g., new year) 
                          while preserving your organizational structure (barangays, puroks) and user accounts.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIVITY LOGS TAB */}
              {activeTab === "logs" && (
                <div className="admin-container space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Activity Logs</h3>
                    <p className="text-xs text-slate-450 mt-0.5">View system activity and audit trail.</p>
                  </div>

                  <div className="space-y-2">
                    {[
                      { time: "2:45 PM", action: "superadmin logged in", user: "superadmin" },
                      { time: "2:30 PM", action: "Backup completed", user: "system" },
                      { time: "2:15 PM", action: "admin_brgy1 created new child record", user: "admin_brgy1" },
                      { time: "1:50 PM", action: "System settings updated", user: "superadmin" },
                      { time: "1:30 PM", action: "Report generated", user: "admin_brgy5" },
                    ].map((log, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 border border-slate-150 rounded-lg bg-white">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                          <Activity className="h-4 w-4 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-700">{log.action}</p>
                          <p className="text-[10px] text-slate-550 font-medium">by {log.user}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">{log.time}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button className="admin-action-btn-secondary px-5 py-2.5 rounded-lg text-xs">Export Logs</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
