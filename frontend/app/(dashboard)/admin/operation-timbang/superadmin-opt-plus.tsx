"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Download, Upload, Search, FileSpreadsheet, TrendingUp, Users, AlertCircle, BarChart3, Trash2, Loader2, Eye, Edit3 } from "lucide-react";
import { ComprehensiveReport } from "./comprehensive-report";
import { OptPlusAnalytics } from "./opt-plus-analytics";
import { useToast } from "@/lib/toast-context";

interface BarangayOPTData {
  sequence: number;
  barangay_name: string;
  barangay_id: string;
  population: number;
  valid_wfa: number;
  valid_hfa: number;
  valid_wflh: number;
  age_groups: {
    [key: string]: {
      normal: number;
      overweight: number;
      severely_underweight: number;
      underweight: number;
      severely_stunted: number;
      stunted: number;
      tall: number;
      obese: number;
      severely_wasted: number;
      wasted: number;
    };
  };
  indigenous_children: number;
  estimated_preschoolers: number;
  measured_preschoolers: number;
  below_normal: number;
  above_normal: number;
  children_0_23_months: number;
  below_normal_0_23: number;
  total_mothers: number;
  mothers_with_below_normal: number;
  mothers_with_above_normal: number;
}

interface OPTSummary {
  total_barangays: number;
  barangays_with_opt: number;
  coverage_percentage: number;
  total_children_measured: number;
  total_valid_wfa: number;
  total_valid_hfa: number;
  total_valid_wflh: number;
  total_below_normal: number;
  total_above_normal: number;
  indigenous_children: number;
}

export default function SuperAdminOPTPlusPage() {
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(2025); // Default to 2025 where data exists
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  // Generate year options (2020-2030)
  const yearOptions = Array.from({ length: 11 }, (_, i) => 2020 + i);

  // Fetch barangay-level OPT Plus data
  const optDataQuery = useQuery({
    queryKey: ["superadmin-opt-plus", selectedYear],
    queryFn: async () => {
      const response = await api.get(`/api/operation-timbang/superadmin/summary?year=${selectedYear}`);
      console.log(`[DEBUG] OPT Plus data for year ${selectedYear}:`, response.data);
      return response.data;
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache
  });

  const barangayData: BarangayOPTData[] = optDataQuery.data?.barangays || [];
  const summary: OPTSummary = optDataQuery.data?.summary || {
    total_barangays: 0,
    barangays_with_opt: 0,
    coverage_percentage: 0,
    total_children_measured: 0,
    total_valid_wfa: 0,
    total_valid_hfa: 0,
    total_valid_wflh: 0,
    total_below_normal: 0,
    total_above_normal: 0,
    indigenous_children: 0,
  };

  const filteredData = useMemo(() => {
    if (!search.trim()) return barangayData;
    const q = search.toLowerCase();
    return barangayData.filter((b) => b.barangay_name.toLowerCase().includes(q));
  }, [barangayData, search]);

  const handleExportExcel = async () => {
    try {
      addToast("📊 Generating Excel file... Please wait", "alert");
      const response = await api.get(`/api/operation-timbang/superadmin/export-excel?year=${selectedYear}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `e-OPT_PLUS_${selectedYear}_Cabadbaran.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      addToast("✅ Excel file downloaded successfully!", "success");
    } catch (error) {
      console.error("Export failed:", error);
      addToast("❌ Failed to export Excel file", "error");
    }
  };

  const handleImportExcel = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        addToast("📤 Importing Excel file... Please wait", "alert");
        const response = await api.post("/api/operation-timbang/superadmin/import-excel", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        
        const data = response.data;
        let message = `✅ Import completed!\n\nValidated: ${data.imported} barangays\nErrors: ${data.errors}`;
        
        if (data.error_details && data.error_details.length > 0) {
          message += "\n\nErrors:\n" + data.error_details.slice(0, 3).join("\n");
        }
        
        if (data.message) {
          message += "\n\n" + data.message;
        }
        
        addToast(message, "success");
        optDataQuery.refetch();
      } catch (error: any) {
        console.error("Import error:", error);
        addToast(`❌ Import failed: ${error?.response?.data?.detail || error?.message || "Unknown error"}`, "error");
      }
    };
    input.click();
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== "DELETE ALL DATA") {
      setDeleteError("Please type 'DELETE ALL DATA' exactly to confirm");
      return;
    }

    setDeleteLoading(true);
    setDeleteError("");
    setDeleteSuccess("");

    try {
      const response = await api.delete("/api/security/data/delete-all", {
        params: { 
          confirm: deleteConfirmText,
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
          users: false // Don't delete users from Operation Timbang
        }
      });

      setDeleteSuccess(response.data.message);
      setDeleteConfirmText("");
      
      // Refresh the page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      setDeleteError(error.response?.data?.detail || "Failed to delete data");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteAllOptPlus = async () => {
    if (deleteConfirmText !== "DELETE ALL OPT+") {
      setDeleteError("Please type 'DELETE ALL OPT+' exactly to confirm");
      return;
    }

    setDeleteLoading(true);
    setDeleteError("");
    setDeleteSuccess("");

    try {
      const response = await api.delete("/api/operation-timbang/bulk/delete-all");
      setDeleteSuccess(`✓ Deleted ${response.data.deleted_count || response.data.deleted_count === 0 ? response.data.deleted_count : 'unknown'} OPT+ records`);
      setDeleteConfirmText("");
      optDataQuery.refetch();
      // Optionally refresh after short delay
      setTimeout(() => { optDataQuery.refetch(); }, 800);
    } catch (error: any) {
      setDeleteError(error?.response?.data?.detail || "Failed to delete OPT+ records");
    } finally {
      setDeleteLoading(false);
      setShowDeleteAllModal(false);
    }
  };

  const quickDeleteAllOptPlus = async () => {
    const confirm = prompt("Type DELETE ALL OPT+ to permanently delete all Operation Timbang records (this cannot be undone)");
    if (confirm !== "DELETE ALL OPT+") {
      if (confirm !== null) addToast("Delete cancelled - confirmation text did not match", "alert");
      return;
    }

    setDeleteLoading(true);
    try {
      const response = await api.delete("/api/operation-timbang/bulk/delete-all");
      addToast(`✓ Deleted ${response.data.deleted_count || 0} OPT+ records`, "success");
      optDataQuery.refetch();
    } catch (error: any) {
      addToast(`❌ Failed to delete OPT+ records: ${error?.response?.data?.detail || error?.message || 'Unknown error'}`, "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (optDataQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading OPT Plus data...</p>
        </div>
      </div>
    );
  }

  if (optDataQuery.isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <p className="text-red-600 font-semibold">Failed to load data</p>
          <p className="text-slate-600 mt-2 text-sm">
            {(optDataQuery.error as any)?.response?.data?.detail || "Unknown error"}
          </p>
          <button
            onClick={() => optDataQuery.refetch()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <span>🏥</span>
            <span>Operation Timbang Plus</span>
            <span className="text-lg font-normal text-slate-500">({selectedYear})</span>
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            City-Wide Nutritional Monitoring • e-OPT PLUS Tool Format
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="year-select" className="text-sm font-semibold text-slate-700">
              Year:
            </label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowDeleteAllModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold text-sm"
          >
            <Trash2 className="h-4 w-4" />
            Delete All Data
          </button>
          <button
            onClick={quickDeleteAllOptPlus}
            disabled={deleteLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-semibold text-sm"
          >
            {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete All OPT+ Records
          </button>
          
          <button
            onClick={handleImportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
          >
            <Upload className="h-4 w-4" />
            Import Excel
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold text-sm"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-semibold uppercase">Total Barangays</p>
              <p className="text-3xl font-bold mt-2">{summary.total_barangays}</p>
              <p className="text-blue-100 text-xs mt-1">
                {summary.barangays_with_opt} with OPT+ ({summary.coverage_percentage.toFixed(0)}% coverage)
              </p>
            </div>
            <BarChart3 className="h-12 w-12 text-blue-200 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-xs font-semibold uppercase">Children Measured</p>
              <p className="text-3xl font-bold mt-2">{summary.total_children_measured}</p>
              <p className="text-emerald-100 text-xs mt-1">
                Weight-for-Age: {summary.total_valid_wfa} • Height-for-Age: {summary.total_valid_hfa}
              </p>
            </div>
            <Users className="h-12 w-12 text-emerald-200 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-xs font-semibold uppercase">Below Normal NS</p>
              <p className="text-3xl font-bold mt-2">{summary.total_below_normal}</p>
              <p className="text-orange-100 text-xs mt-1">
                {summary.total_children_measured > 0
                  ? ((summary.total_below_normal / summary.total_children_measured) * 100).toFixed(1)
                  : 0}% of total measured
              </p>
            </div>
            <AlertCircle className="h-12 w-12 text-orange-200 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-xs font-semibold uppercase">Indigenous Children</p>
              <p className="text-3xl font-bold mt-2">{summary.indigenous_children}</p>
              <p className="text-purple-100 text-xs mt-1">
                Above Normal: {summary.total_above_normal}
              </p>
            </div>
            <TrendingUp className="h-12 w-12 text-purple-200 opacity-50" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search barangays..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Barangay Data Table - Full e-OPT PLUS Format */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              {/* Multi-row header like Excel */}
              <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                <th rowSpan={3} className="px-2 py-2 text-left font-semibold border border-slate-600 sticky left-0 bg-slate-800 z-20 min-w-[40px]">
                  #
                </th>
                <th rowSpan={3} className="px-3 py-2 text-left font-semibold border border-slate-600 sticky left-[40px] bg-slate-800 z-20 min-w-[140px]">
                  Barangay
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 min-w-[60px]">
                  Valid<br/>Weight-for-Age
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 min-w-[60px]">
                  Valid<br/>Height-for-Age
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 min-w-[60px]">
                  Valid<br/>WFL/H
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 min-w-[70px]">
                  Barangay<br/>Population
                </th>
                <th colSpan={10} className="px-2 py-1 text-center font-semibold border border-slate-600 bg-blue-700">
                  0-5 Months
                </th>
                <th colSpan={10} className="px-2 py-1 text-center font-semibold border border-slate-600 bg-emerald-700">
                  6-11 Months
                </th>
                <th colSpan={10} className="px-2 py-1 text-center font-semibold border border-slate-600 bg-cyan-700">
                  12-23 Months
                </th>
                <th colSpan={10} className="px-2 py-1 text-center font-semibold border border-slate-600 bg-teal-700">
                  24-35 Months
                </th>
                <th colSpan={10} className="px-2 py-1 text-center font-semibold border border-slate-600 bg-indigo-700">
                  36-47 Months
                </th>
                <th colSpan={10} className="px-2 py-1 text-center font-semibold border border-slate-600 bg-purple-700">
                  48-59 Months
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 bg-orange-700 min-w-[50px]">
                  IP<br/>Child
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 min-w-[50px]">
                  Est.<br/>PS
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 min-w-[60px]">
                  Meas.<br/>PS
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 bg-red-700 min-w-[60px]">
                  Below<br/>Normal
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 bg-yellow-700 min-w-[60px]">
                  Above<br/>Normal
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 bg-pink-700 min-w-[60px]">
                  0-23 mos<br/>Children
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 bg-violet-700 min-w-[60px]">
                  Total<br/>M/Cs
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 bg-rose-700 min-w-[60px]">
                  M/Cs<br/>Below N
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 bg-amber-700 min-w-[60px]">
                  M/Cs<br/>Above N
                </th>
                <th rowSpan={3} className="px-2 py-2 text-center font-semibold border border-slate-600 bg-slate-600 min-w-[100px]">
                  Actions
                </th>
              </tr>
              <tr className="bg-gradient-to-r from-slate-700 to-slate-600 text-white text-[10px]">
                {/* 0-5 Months subheaders */}
                {["N", "OW", "SUW", "UW", "SS", "S", "T", "Ob", "SW", "W"].map((status, i) => (
                  <th key={`0-5-${i}`} className="px-1 py-1 text-center border border-slate-600 min-w-[32px]">{status}</th>
                ))}
                {/* 6-11 Months subheaders */}
                {["N", "OW", "SUW", "UW", "SS", "S", "T", "Ob", "SW", "W"].map((status, i) => (
                  <th key={`6-11-${i}`} className="px-1 py-1 text-center border border-slate-600 min-w-[32px]">{status}</th>
                ))}
                {/* 12-23 Months subheaders */}
                {["N", "OW", "SUW", "UW", "SS", "S", "T", "Ob", "SW", "W"].map((status, i) => (
                  <th key={`12-23-${i}`} className="px-1 py-1 text-center border border-slate-600 min-w-[32px]">{status}</th>
                ))}
                {/* 24-35 Months subheaders */}
                {["N", "OW", "SUW", "UW", "SS", "S", "T", "Ob", "SW", "W"].map((status, i) => (
                  <th key={`24-35-${i}`} className="px-1 py-1 text-center border border-slate-600 min-w-[32px]">{status}</th>
                ))}
                {/* 36-47 Months subheaders */}
                {["N", "OW", "SUW", "UW", "SS", "S", "T", "Ob", "SW", "W"].map((status, i) => (
                  <th key={`36-47-${i}`} className="px-1 py-1 text-center border border-slate-600 min-w-[32px]">{status}</th>
                ))}
                {/* 48-59 Months subheaders */}
                {["N", "OW", "SUW", "UW", "SS", "S", "T", "Ob", "SW", "W"].map((status, i) => (
                  <th key={`48-59-${i}`} className="px-1 py-1 text-center border border-slate-600 min-w-[32px]">{status}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredData.map((barangay, index) => {
                const ageGroups = barangay.age_groups || {};
                const getAgeGroupData = (group: string) => ageGroups[group] || {
                  normal: 0, overweight: 0, severely_underweight: 0, underweight: 0,
                  severely_stunted: 0, stunted: 0, tall: 0, obese: 0,
                  severely_wasted: 0, wasted: 0
                };

                return (
                  <tr key={barangay.barangay_id} className="hover:bg-slate-50 transition">
                    <td className="px-2 py-2 font-semibold text-slate-700 text-center border border-slate-200 sticky left-0 bg-white z-10">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-800 border border-slate-200 sticky left-[40px] bg-white z-10">
                      {barangay.barangay_name}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-blue-700 bg-blue-50 border border-slate-200">
                      {barangay.valid_wfa}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-blue-700 bg-blue-50 border border-slate-200">
                      {barangay.valid_hfa}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-blue-700 bg-blue-50 border border-slate-200">
                      {barangay.valid_wflh}
                    </td>
                    <td className="px-2 py-2 text-center text-slate-600 border border-slate-200">
                      {barangay.population.toLocaleString()}
                    </td>

                    {/* 0-5 Months */}
                    {(() => {
                      const data = getAgeGroupData("0-5");
                      return [
                        data.normal, data.overweight, data.severely_underweight, data.underweight,
                        data.severely_stunted, data.stunted, data.tall, data.obese,
                        data.severely_wasted, data.wasted
                      ].map((val, i) => (
                        <td key={`0-5-${i}`} className="px-1 py-2 text-center text-slate-700 border border-slate-200 bg-blue-50/30">
                          {val || 0}
                        </td>
                      ));
                    })()}

                    {/* 6-11 Months */}
                    {(() => {
                      const data = getAgeGroupData("6-11");
                      return [
                        data.normal, data.overweight, data.severely_underweight, data.underweight,
                        data.severely_stunted, data.stunted, data.tall, data.obese,
                        data.severely_wasted, data.wasted
                      ].map((val, i) => (
                        <td key={`6-11-${i}`} className="px-1 py-2 text-center text-slate-700 border border-slate-200 bg-emerald-50/30">
                          {val || 0}
                        </td>
                      ));
                    })()}

                    {/* 12-23 Months */}
                    {(() => {
                      const data = getAgeGroupData("12-23");
                      return [
                        data.normal, data.overweight, data.severely_underweight, data.underweight,
                        data.severely_stunted, data.stunted, data.tall, data.obese,
                        data.severely_wasted, data.wasted
                      ].map((val, i) => (
                        <td key={`12-23-${i}`} className="px-1 py-2 text-center text-slate-700 border border-slate-200 bg-cyan-50/30">
                          {val || 0}
                        </td>
                      ));
                    })()}

                    {/* 24-35 Months */}
                    {(() => {
                      const data = getAgeGroupData("24-35");
                      return [
                        data.normal, data.overweight, data.severely_underweight, data.underweight,
                        data.severely_stunted, data.stunted, data.tall, data.obese,
                        data.severely_wasted, data.wasted
                      ].map((val, i) => (
                        <td key={`24-35-${i}`} className="px-1 py-2 text-center text-slate-700 border border-slate-200 bg-teal-50/30">
                          {val || 0}
                        </td>
                      ));
                    })()}

                    {/* 36-47 Months */}
                    {(() => {
                      const data = getAgeGroupData("36-47");
                      return [
                        data.normal, data.overweight, data.severely_underweight, data.underweight,
                        data.severely_stunted, data.stunted, data.tall, data.obese,
                        data.severely_wasted, data.wasted
                      ].map((val, i) => (
                        <td key={`36-47-${i}`} className="px-1 py-2 text-center text-slate-700 border border-slate-200 bg-indigo-50/30">
                          {val || 0}
                        </td>
                      ));
                    })()}

                    {/* 48-59 Months */}
                    {(() => {
                      const data = getAgeGroupData("48-59");
                      return [
                        data.normal, data.overweight, data.severely_underweight, data.underweight,
                        data.severely_stunted, data.stunted, data.tall, data.obese,
                        data.severely_wasted, data.wasted
                      ].map((val, i) => (
                        <td key={`48-59-${i}`} className="px-1 py-2 text-center text-slate-700 border border-slate-200 bg-purple-50/30">
                          {val || 0}
                        </td>
                      ));
                    })()}

                    <td className="px-2 py-2 text-center font-semibold text-orange-700 bg-orange-50 border border-slate-200">
                      {barangay.indigenous_children}
                    </td>
                    <td className="px-2 py-2 text-center text-slate-600 border border-slate-200">
                      {barangay.estimated_preschoolers}
                    </td>
                    <td className="px-2 py-2 text-center text-slate-600 border border-slate-200">
                      {barangay.measured_preschoolers}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-red-700 bg-red-50 border border-slate-200">
                      {barangay.below_normal}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-yellow-700 bg-yellow-50 border border-slate-200">
                      {barangay.above_normal}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-pink-700 bg-pink-50 border border-slate-200">
                      {barangay.children_0_23_months}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-violet-700 bg-violet-50 border border-slate-200">
                      {barangay.total_mothers}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-rose-700 bg-rose-50 border border-slate-200">
                      {barangay.mothers_with_below_normal}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-amber-700 bg-amber-50 border border-slate-200">
                      {barangay.mothers_with_above_normal}
                    </td>
                    <td className="px-2 py-2 text-center space-x-2 border border-slate-200 bg-slate-50 flex justify-center items-center">
                      <button 
                        onClick={() => addToast(`📄 Viewing: ${barangay.barangay_name}`, "alert")}
                        className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => addToast(`✏️ Edit: ${barangay.barangay_name}`, "alert")}
                        className="p-2 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-600 transition"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`Delete all records for ${barangay.barangay_name}?`)) {
                            addToast(`🗑️ Deleted: ${barangay.barangay_name}`, "success");
                          }
                        }}
                        className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={72} className="px-4 py-12 text-center text-slate-500 border border-slate-200">
                    <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-semibold">No barangay data found</p>
                    <p className="text-xs mt-1">Try importing an e-OPT PLUS Excel file</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instructions Panel */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 p-3 rounded-lg">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 text-lg">e-OPT PLUS Tool Format</h3>
            <p className="text-sm text-slate-600 mt-2">
              This page displays data in the format used by the Department of Health's Operation Timbang Plus program.
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p><strong>Nutritional Status Indicators:</strong></p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>• <strong>N</strong> = Normal</div>
                <div>• <strong>OW</strong> = Overweight</div>
                <div>• <strong>SUW</strong> = Severely Underweight</div>
                <div>• <strong>UW</strong> = Underweight</div>
                <div>• <strong>SS</strong> = Severely Stunted</div>
                <div>• <strong>S</strong> = Stunted</div>
                <div>• <strong>T</strong> = Tall</div>
                <div>• <strong>Ob</strong> = Obese</div>
                <div>• <strong>SW</strong> = Severely Wasted</div>
                <div>• <strong>W</strong> = Wasted</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OPT Plus Report Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            📊 OPT Plus Report - Real-Time Tallies
          </h2>
          <p className="text-sm text-slate-600 mt-1">Auto-tallied data with real-time updates every 10 seconds</p>
        </div>
        <SuperAdminOptPlusReportSection selectedYear={selectedYear} />
      </div>

      {/* Delete All Data Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete All Data</h3>
                  <p className="text-xs text-red-100">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeleteAllModal(false);
                  setDeleteConfirmText("");
                  setDeleteError("");
                  setDeleteSuccess("");
                }}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition"
              >
                <AlertCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                <p className="text-sm text-red-900 font-bold mb-2">
                  ⚠️ This will permanently delete ALL data from all barangays:
                </p>
                <ul className="grid grid-cols-2 gap-2 text-xs text-red-800">
                  <li>✓ All children records</li>
                  <li>✓ All measurements</li>
                  <li>✓ All alerts & reports</li>
                  <li>✓ All programs & activities</li>
                  <li>✓ All home visits & cases</li>
                  <li>✓ All messages & events</li>
                  <li>✓ All households</li>
                  <li>✓ All activity logs</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                <p className="text-xs font-bold text-green-900 mb-1">✅ Will be preserved:</p>
                <p className="text-xs text-green-800">
                  Barangays • Puroks • Users & Accounts • System Settings
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-900">
                  Type <span className="bg-red-200 px-2 py-0.5 rounded font-mono text-red-900">DELETE ALL DATA</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type: DELETE ALL DATA"
                  className="w-full px-4 py-3 border-2 border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 rounded-lg font-mono"
                  autoFocus
                />
              </div>

              {/* Error Message */}
              {deleteError && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-red-800">{deleteError}</p>
                </div>
              )}

              {/* Success Message */}
              {deleteSuccess && (
                <div className="bg-green-100 border border-green-300 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-green-800">{deleteSuccess}</p>
                    <p className="text-xs text-green-700 mt-1">Reloading page...</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDeleteAllModal(false);
                    setDeleteConfirmText("");
                    setDeleteError("");
                    setDeleteSuccess("");
                  }}
                  className="flex-1 px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllData}
                  disabled={deleteLoading || deleteConfirmText !== "DELETE ALL DATA"}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete All Data
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SuperAdmin OPT Plus Report Component
function SuperAdminOptPlusReportSection({ selectedYear }: { selectedYear: number }) {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [showFilters, setShowFilters] = useState(false);

  const optPlusQuery = useQuery({
    queryKey: ["superadmin-opt-plus-report", selectedYear, selectedMonth],
    queryFn: () =>
      api.get(`/api/opt-plus/report?year=${selectedYear}&month=${selectedMonth}`)
        .then((r) => r.data),
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const data = optPlusQuery.data;

  const monthOptions = [
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
    { value: 12, label: "December" },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Section */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
        >
          🔍 Filters
        </button>
        <button
          onClick={() => optPlusQuery.refetch()}
          disabled={optPlusQuery.isLoading}
          className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>

      {showFilters && (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 rounded-2xl p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-green-700 mb-2">Year: {selectedYear}</label>
              <p className="text-sm font-semibold text-slate-700">Selected from main year dropdown</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-green-700 mb-2">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedMonth(new Date().getMonth() + 1);
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {optPlusQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin h-8 w-8 text-emerald-600 border-4 border-emerald-200 border-t-emerald-600 rounded-full mb-3"></div>
            <p className="text-slate-600 font-semibold">Loading OPT Plus report...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {optPlusQuery.isError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-12 text-center">
          <p className="text-red-600 font-semibold mb-2">Error Loading Report</p>
          <p className="text-red-500 text-sm">{(optPlusQuery.error as any)?.response?.data?.detail || (optPlusQuery.error as any)?.message || "Failed to load data"}</p>
          <p className="text-slate-500 text-xs mt-2">Note: This may occur if no measurements exist for the selected month.</p>
          <button
            onClick={() => optPlusQuery.refetch()}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Data Display */}
      {!optPlusQuery.isLoading && !optPlusQuery.isError && data && (
        <div className="space-y-4">
          {/* Header Info */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="border-b-2 border-emerald-200 pb-2">
                <p className="text-xs font-semibold text-slate-600 uppercase">Province</p>
                <p className="text-lg font-bold text-slate-900">{data.province}</p>
              </div>
              <div className="border-b-2 border-emerald-200 pb-2">
                <p className="text-xs font-semibold text-slate-600 uppercase">Region</p>
                <p className="text-lg font-bold text-slate-900">{data.region}</p>
              </div>
              <div className="border-b-2 border-emerald-200 pb-2">
                <p className="text-xs font-semibold text-slate-600 uppercase">Municipality</p>
                <p className="text-lg font-bold text-slate-900">{data.municipality}</p>
              </div>
              <div className="border-b-2 border-emerald-200 pb-2">
                <p className="text-xs font-semibold text-slate-600 uppercase">Coverage</p>
                <p className="text-lg font-bold text-emerald-600">{data.coverage_percentage.toFixed(1)}%</p>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 uppercase">Total Pop</p>
                <p className="text-xl font-black text-blue-900 mt-1">{data.total_population.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-700 uppercase">Children</p>
                <p className="text-xl font-black text-green-900 mt-1">{data.children_0_59_months.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-purple-700 uppercase">Weight-for-Age (WFA)</p>
                <p className="text-xl font-black text-purple-900 mt-1">{data.total_wfa}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-orange-700 uppercase">Height-for-Age (HFA)</p>
                <p className="text-xl font-black text-orange-900 mt-1">{data.total_hfa}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 uppercase">Weight-for-Length/Height (WFL/H)</p>
                <p className="text-xl font-black text-red-900 mt-1">{data.total_wflh}</p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 rounded-2xl p-4">
            <h3 className="text-lg font-black text-emerald-900 mb-3">Children Affected Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase">Undernutrition (0-59m)</p>
                <p className="text-2xl font-black text-red-600 mt-1">{data.summary.undernutrition_0_59}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase">Overweight (0-59m)</p>
                <p className="text-2xl font-black text-orange-600 mt-1">{data.summary.overweight_0_59}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase">Undernutrition (0-23m)</p>
                <p className="text-2xl font-black text-red-700 mt-1">{data.summary.undernutrition_0_23}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase">Overweight (0-23m)</p>
                <p className="text-2xl font-black text-orange-700 mt-1">{data.summary.overweight_0_23}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!optPlusQuery.isLoading && !optPlusQuery.isError && !data && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-slate-600 font-semibold">No data available for the selected period</p>
        </div>
      )}

      {/* Comprehensive Overall Report Section */}
      <div className="mt-8 border-t-2 border-slate-200 pt-8">
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-slate-900">📈 Overall Report for {selectedYear}</h2>
          <p className="text-sm text-slate-600 mt-1">City-wide comprehensive statistics and data analysis</p>
        </div>
        <ComprehensiveReport selectedYear={selectedYear} />
      </div>

      {/* Detailed Analytics Section */}
      <div className="mt-8 border-t-2 border-slate-200 pt-8">
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-slate-900">📊 Detailed Nutritional Analytics</h2>
          <p className="text-sm text-slate-600 mt-1">Comprehensive breakdown by nutritional indicator and barangay rankings</p>
        </div>
        <OptPlusAnalytics selectedYear={selectedYear} />
      </div>
    </div>
  );
}

