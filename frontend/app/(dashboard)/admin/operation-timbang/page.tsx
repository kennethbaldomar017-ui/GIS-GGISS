"use client";
import "@/styles/admin.css";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Plus, Search, Eye, Edit3, X, Save, Loader2,
  Trash2, AlertTriangle, MapPin, User, Badge, Weight, FileText, Upload, Download, CheckCircle, AlertCircle
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import SuperAdminOPTPlusPage from "./superadmin-opt-plus";
import { OptPlusAnalytics } from "./opt-plus-analytics";

interface OperationTimbangRecord {
  id: string;
  child_id: string;
  child_name: string;
  mother_name: string;
  location: string;
  indigenous_child: "YES" | "NO";
  sex: string;
  date_of_birth: string;
  actual_date_visit: string;
  weight: number;
  height: number;
  age_in_months: number;
  weight_for_age: string;
  height_for_age: string;
  weight_for_height: string;
  nutritional_status: string;
  notes: string;
  created_at: string;
}

type TabId = "list" | "add" | "edit";

// Import Modal Component
function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const queryClient = useQueryClient();

  const handleImport = async () => {
    if (!file) {
      alert("Please select a file");
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/api/opt-plus/import-measurements", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setResult(response.data);
      
      // Clear all related caches and force a hard refetch
      await queryClient.invalidateQueries({ queryKey: ["operation-timbang"], exact: false });
      
      // Hard refetch after a brief delay to ensure database is updated
      setTimeout(async () => {
        await queryClient.refetchQueries({ queryKey: ["operation-timbang"] });
      }, 500);
      
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Import failed: ${error?.response?.data?.detail || error?.message}`);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const sampleData = [
        ["full_name", "birth_date", "sex", "measurement_date", "weight_kg", "height_cm", "muac_cm", "notes", "child_id", "address", "latitude", "longitude", "guardian_name", "purok_id", "barangay_id"],
        ["John Doe", "2020-01-15", "M", "2024-01-15", "12.5", "85.5", "", "Healthy", "", "123 Main St, Barangay Sample", "8.9483", "125.5282", "Jane Doe (Mother)", "", ""],
        ["Maria Santos", "2019-06-20", "F", "2024-01-15", "13.2", "88.0", "14.5", "", "", "456 Oak Ave, Barangay Sample", "8.9490", "125.5290", "Rosa Santos (Mother)", "", ""],
      ];

      const csv = sampleData.map(row => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "measurement_import_template.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <div className="admin-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="admin-modal-content bg-white rounded-2xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">Import Measurements</h2>
              <p className="text-blue-100 text-xs mt-1">Bulk import child assessment data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {!result ? (
            <>
              {/* Instructions */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm text-blue-900 font-semibold">Import Instructions:</p>
                <ul className="text-xs text-blue-800 mt-2 space-y-1 ml-4 list-disc">
                  <li>Create an Excel or CSV file with required columns</li>
                  <li>Date format: YYYY-MM-DD (e.g., 2020-01-15)</li>
                  <li>Sex: M for Male, F for Female</li>
                  <li><strong>Children not in system will be auto-created</strong> (requires columns 10-15)</li>
                  <li>Age must be between 0-71 months for OPT Plus</li>
                  <li>Download the template for the correct column order</li>
                </ul>
              </div>

              {/* File Selection */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">Select Excel or CSV File</label>
                <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-8 bg-slate-50/50 hover:bg-slate-50 transition text-center cursor-pointer" onClick={() => document.getElementById("file-input")?.click()}>
                  <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Click to browse or drag & drop</p>
                  <p className="text-xs text-slate-500 mt-1">Excel (.xlsx) or CSV (.csv)</p>
                  {file && <p className="text-xs text-green-600 font-semibold mt-2">📄 {file.name}</p>}
                  <input
                    id="file-input"
                    type="file"
                    hidden
                    accept=".xlsx,.csv,.xls"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              {/* Download Template */}
              <div className="flex gap-2">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Results */}
              <div className={`rounded-lg p-4 ${result.errors === 0 ? "bg-green-50" : "bg-yellow-50"}`}>
                <div className="flex items-center gap-2 mb-3">
                  {result.errors === 0 ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <p className="text-green-900 font-bold text-lg">✓ Import Successful!</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <p className="text-yellow-900 font-bold text-lg">⚠ Import Completed with Issues</p>
                    </>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-4">
                    <p><span className="font-bold text-green-700 text-base">{result.imported}</span> <span className="text-slate-600">records imported</span></p>
                    {result.errors > 0 && <p><span className="font-bold text-red-700 text-base">{result.errors}</span> <span className="text-slate-600">rows with errors</span></p>}
                  </div>

                  {/* Imported Records Summary */}
                  {result.imported_records?.length > 0 && (
                    <div className="mt-4 bg-white rounded-lg p-3 max-h-48 overflow-y-auto border border-green-200">
                      <p className="text-xs font-bold text-slate-700 mb-2 sticky top-0 bg-white">📋 Imported Records:</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-1 px-2 text-slate-600">Child Name</th>
                            <th className="text-center py-1 px-2 text-slate-600">Age (mo)</th>
                            <th className="text-center py-1 px-2 text-slate-600">Weight (kg)</th>
                            <th className="text-center py-1 px-2 text-slate-600">Height (cm)</th>
                            <th className="text-center py-1 px-2 text-slate-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.imported_records.map((record: any, i: number) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-1 px-2 text-left text-slate-700 font-medium">{record.child_name}</td>
                              <td className="py-1 px-2 text-center text-slate-600">{record.age_months}</td>
                              <td className="py-1 px-2 text-center text-slate-600">{record.weight_kg}</td>
                              <td className="py-1 px-2 text-center text-slate-600">{record.height_cm}</td>
                              <td className="py-1 px-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  record.status === "N" ? "bg-green-100 text-green-700" :
                                  record.status === "UW" ? "bg-yellow-100 text-yellow-700" :
                                  record.status === "ST" ? "bg-orange-100 text-orange-700" :
                                  record.status === "W" ? "bg-red-100 text-red-700" :
                                  "bg-slate-100 text-slate-700"
                                }`}>
                                  {record.status === "N" ? "Normal" :
                                   record.status === "UW" ? "Underweight" :
                                   record.status === "ST" ? "Stunted" :
                                   record.status === "W" ? "Wasted" :
                                   record.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Error Details */}
                  {result.error_details?.length > 0 && (
                    <div className="mt-4 bg-white rounded-lg p-3 max-h-60 overflow-y-auto border border-red-200">
                      <p className="text-xs font-bold text-slate-700 mb-3">❌ Error Details ({result.error_details.length} total errors):</p>
                      
                      {/* Show categorized errors if available */}
                      {result.error_categories && Object.keys(result.error_categories).length > 0 ? (
                        <div className="space-y-3">
                          {Object.entries(result.error_categories).map(([category, categoryErrors]: [string, any]) => (
                            <div key={category} className="border-l-2 border-red-300 pl-3">
                              <p className="text-xs font-bold text-red-600 mb-1">
                                {category} ({categoryErrors.length} errors)
                              </p>
                              <ul className="space-y-1 text-xs text-slate-600">
                                {categoryErrors.slice(0, 5).map((err: string, i: number) => (
                                  <li key={i} className="flex gap-2">
                                    <span className="text-red-500 font-bold">•</span>
                                    <span>{err}</span>
                                  </li>
                                ))}
                                {categoryErrors.length > 5 && (
                                  <li className="text-xs text-slate-500 italic ml-4">
                                    ... and {categoryErrors.length - 5} more {category} errors
                                  </li>
                                )}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ul className="space-y-1 text-xs text-slate-600">
                          {result.error_details.map((err: string, i: number) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-red-500 font-bold">•</span>
                              <span>{err}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl border-t">
          {!result ? (
            <>
              <button
                onClick={onClose}
                className="admin-action-btn-secondary px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="admin-action-btn-primary flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 text-sm"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                <Upload className="h-4 w-4" />
                Import File
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="admin-action-btn-primary px-4 py-2 rounded-lg text-sm"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// OPT Plus Report Component
function OptPlusReportSection() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [showFilters, setShowFilters] = useState(false);

  const optPlusQuery = useQuery({
    queryKey: ["opt-plus-report", selectedYear, selectedMonth],
    queryFn: () =>
      api.get(`/api/opt-plus/report?year=${selectedYear}&month=${selectedMonth}`)
        .then((r) => r.data),
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 2,
  });

  const data = optPlusQuery.data;

  const yearOptions = Array.from({ length: 11 }, (_, i) => 2020 + i);
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
              <label className="block text-xs font-semibold text-green-700 mb-2">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
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
                  setSelectedYear(new Date().getFullYear());
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
          <p className="text-red-500 text-sm">{(optPlusQuery.error as any)?.message || "Failed to load data"}</p>
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
                <p className="text-xs font-semibold text-purple-700 uppercase">WFA</p>
                <p className="text-xl font-black text-purple-900 mt-1">{data.total_wfa}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-orange-700 uppercase">HFA</p>
                <p className="text-xl font-black text-orange-900 mt-1">{data.total_hfa}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 uppercase">WFL/H</p>
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
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
          <p className="text-blue-900 font-semibold mb-3">No data available for the selected period</p>
          <p className="text-blue-700 text-sm mb-4">
            The OPT Plus report shows coverage for children measured during the selected month. 
            {selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear() 
              ? " Currently viewing the current month - create or import measurements to see coverage data."
              : " Try selecting a different month/year, or create measurements for the current period."}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => {
                setSelectedYear(new Date().getFullYear());
                setSelectedMonth(new Date().getMonth() + 1);
              }}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition"
            >
              View Current Month
            </button>
            <button
              onClick={() => {
                setSelectedYear(2026);
                setSelectedMonth(5);
              }}
              className="text-xs bg-slate-600 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg transition"
            >
              View May 2026 (Has Data)
            </button>
            <button
              onClick={() => {
                setSelectedYear(2025);
                setSelectedMonth(12);
              }}
              className="text-xs bg-slate-600 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg transition"
            >
              View Dec 2025 (Has Data)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal Component for Viewing Records
function ViewModal({ record, onClose }: { record: OperationTimbangRecord | null; onClose: () => void }) {
  if (!record) return null;

  const statusColors: any = {
    "normal": { bg: "bg-green-50", text: "text-green-700", label: "Normal" },
    "moderate_acute_malnutrition": { bg: "bg-amber-50", text: "text-amber-700", label: "Moderate Acute Malnutrition (MAM)" },
    "underweight": { bg: "bg-amber-50", text: "text-amber-700", label: "Underweight" },
    "severe_acute_malnutrition": { bg: "bg-red-50", text: "text-red-700", label: "Severe Acute Malnutrition (SAM)" },
    "wasted": { bg: "bg-red-50", text: "text-red-700", label: "Wasted (SAM)" },
    "stunted": { bg: "bg-orange-50", text: "text-orange-700", label: "Stunted" },
    "overweight": { bg: "bg-yellow-50", text: "text-yellow-700", label: "Overweight" },
    "obese": { bg: "bg-red-900", text: "text-red-100", label: "Obese" },
    // Old format for backward compatibility
    "N": { bg: "bg-green-50", text: "text-green-700", label: "Normal" },
    "UW": { bg: "bg-amber-50", text: "text-amber-700", label: "Underweight" },
    "ST": { bg: "bg-orange-50", text: "text-orange-700", label: "Stunted" },
    "W": { bg: "bg-red-50", text: "text-red-700", label: "Wasted (SAM)" },
    "OW": { bg: "bg-yellow-50", text: "text-yellow-700", label: "Overweight" },
    "O": { bg: "bg-red-900", text: "text-red-100", label: "Obese" },
  };

  const status = statusColors[record.nutritional_status] || statusColors["normal"];

  return (
    <div className="admin-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="admin-modal-content bg-white rounded-2xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">{record.child_name}</h2>
            <p className="text-slate-300 text-sm mt-1">Nutritional Assessment Details</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Status Card */}
          <div className={`${status.bg} ${status.text} rounded-xl p-4 border-2 ${status.text.replace('text', 'border')}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold opacity-75">Nutritional Status</p>
                <p className="text-2xl font-bold mt-1">{status.label}</p>
              </div>
              <div className="text-4xl opacity-30">
                {record.nutritional_status === "normal" || record.nutritional_status === "N" ? "✓" : record.nutritional_status === "severe_acute_malnutrition" || record.nutritional_status === "W" ? "!" : "⚠"}
              </div>
            </div>
          </div>

          {/* Child Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-4">
              <p className="text-xs text-slate-500 font-semibold uppercase">Mother/Caregiver</p>
              <p className="text-base font-semibold mt-2">{record.mother_name}</p>
            </div>
            <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-4">
              <p className="text-xs text-slate-500 font-semibold uppercase">Location</p>
              <p className="text-base font-semibold mt-2">{record.location}</p>
            </div>
            <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-4">
              <p className="text-xs text-slate-500 font-semibold uppercase">Sex</p>
              <p className="text-base font-semibold mt-2">{record.sex === "M" ? "Male" : "Female"}</p>
            </div>
            <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-4">
              <p className="text-xs text-slate-500 font-semibold uppercase">Indigenous Child</p>
              <p className="text-base font-semibold mt-2">{record.indigenous_child}</p>
            </div>
          </div>

          {/* Anthropometric Measurements */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-3">Anthropometric Measurements</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs text-slate-500 font-semibold">Age (months)</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{record.age_in_months}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <p className="text-xs text-slate-500 font-semibold">Weight (kg)</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{record.weight}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <p className="text-xs text-slate-500 font-semibold">Height (cm)</p>
                <p className="text-2xl font-bold text-indigo-700 mt-1">{record.height}</p>
              </div>
            </div>
          </div>

          {/* Nutritional Assessment Indicators */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-3">Assessment Indicators</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-3 border-2 border-amber-200 bg-amber-50">
                <p className="text-xs text-amber-600 font-semibold">WFA</p>
                <p className="text-xs text-slate-500 mt-1">Weight for Age</p>
                <p className="text-lg font-bold text-amber-700 mt-2">{record.weight_for_age}</p>
              </div>
              <div className="rounded-lg p-3 border-2 border-orange-200 bg-orange-50">
                <p className="text-xs text-orange-600 font-semibold">HFA</p>
                <p className="text-xs text-slate-500 mt-1">Height for Age</p>
                <p className="text-lg font-bold text-orange-700 mt-2">{record.height_for_age}</p>
              </div>
              <div className="rounded-lg p-3 border-2 border-red-200 bg-red-50">
                <p className="text-xs text-red-600 font-semibold">WFH</p>
                <p className="text-xs text-slate-500 mt-1">Weight for Height</p>
                <p className="text-lg font-bold text-red-700 mt-2">{record.weight_for_height}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 font-semibold">Date of Birth</p>
              <p className="mt-1 font-semibold">{new Date(record.date_of_birth).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold">Measurement Date</p>
              <p className="mt-1 font-semibold">{new Date(record.actual_date_visit).toLocaleDateString()}</p>
            </div>
          </div>

          {record.notes && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-slate-700">Notes</p>
              <p className="text-sm text-slate-600 mt-2">{record.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex justify-end rounded-b-2xl border-t">
          <button
            onClick={onClose}
            className="admin-action-btn-primary px-4 py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OperationTimbangPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Declare all hooks first (before any early returns)
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabId>("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [viewRecord, setViewRecord] = useState<OperationTimbangRecord | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedPurok, setSelectedPurok] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const [form, setForm] = useState({
    child_name: "",
    mother_name: "",
    location: "",
    indigenous_child: "NO" as "YES" | "NO",
    sex: "M",
    date_of_birth: "",
    actual_date_visit: new Date().toISOString().split("T")[0],
    weight: 0,
    height: 0,
    notes: ""
  });

  const recordsQ = useQuery({
    queryKey: ["operation-timbang", selectedYear, selectedPurok],
    queryFn: () => api.get("/api/operation-timbang").then(r => r.data?.data || r.data || []),
    retry: false,
    staleTime: 0, // Always consider data stale
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Get unique puroks for filter dropdown
  const puroks = useMemo((): string[] => {
    const records = recordsQ.data || [];
    const uniquePuroks = new Set(records.map((r: any) => r.location).filter(Boolean));
    return Array.from(uniquePuroks).sort() as string[];
  }, [recordsQ.data]);

  // Filter records by year, purok, and search
  const filteredRecords = useMemo(() => {
    let records = recordsQ.data || [];
    if (!Array.isArray(records)) records = [];
    
    // Filter by year
    if (selectedYear) {
      records = records.filter((r: any) => {
        const year = new Date(r.actual_date_visit).getFullYear();
        return year === selectedYear;
      });
    }
    
    // Filter by purok
    if (selectedPurok) {
      records = records.filter((r: any) => r.location === selectedPurok);
    }
    
    // Filter by search query
    const q = search.trim().toLowerCase();
    if (q) {
      records = records.filter((r: any) =>
        r.child_name?.toLowerCase().includes(q) ||
        r.mother_name?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q)
      );
    }
    
    // Show only the latest record per unique child
    const childMap = new Map<string, any>();
    records.forEach((record: any) => {
      const child_id = record.child_id;
      const existing = childMap.get(child_id);
      
      // Keep the most recent record for each child
      if (!existing || new Date(record.actual_date_visit) > new Date(existing.actual_date_visit)) {
        childMap.set(child_id, record);
      }
    });
    
    return Array.from(childMap.values());
  }, [recordsQ.data, selectedYear, selectedPurok, search]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/operation-timbang", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-timbang"] });
      setForm({
        child_name: "", mother_name: "", location: "", indigenous_child: "NO", sex: "M",
        date_of_birth: "", actual_date_visit: new Date().toISOString().split("T")[0],
        weight: 0, height: 0, notes: ""
      });
      setTab("list");
      alert("Record created successfully!");
    },
    onError: (error: any) => {
      alert(`Error: ${error?.response?.data?.detail || error?.message || "Failed to create"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/api/operation-timbang/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-timbang"] });
      setTab("list");
      setEditId(null);
      alert("Record updated successfully!");
    },
    onError: (error: any) => {
      alert(`Error: ${error?.response?.data?.detail || error?.message || "Failed to update"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/operation-timbang/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operation-timbang"] });
      alert("Record deleted successfully!");
    },
    onError: (error: any) => {
      alert(`Error: ${error?.response?.data?.detail || error?.message || "Failed to delete"}`);
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => api.delete("/api/operation-timbang/bulk/delete-all"),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["operation-timbang"] });
      const data = response.data;
      alert(`✓ Successfully deleted all records!\n\nDeleted: ${data.deleted_count} records\nScope: ${data.user_role === "super_admin" ? "All barangays" : `Barangay ${user?.barangay_name}`}`);
    },
    onError: (error: any) => {
      alert(`Error: ${error?.response?.data?.detail || error?.message || "Failed to delete all records"}`);
    },
  });

  const handleDeleteAll = () => {
    const scope = user?.role === "super_admin" ? "ALL BARANGAYS in the system" : `your barangay (${user?.barangay_name})`;
    const confirmMessage = `⚠️ CRITICAL WARNING ⚠️\n\nYou are about to DELETE ALL Operation Timbang records for ${scope}.\n\n` +
      `This will permanently remove:\n` +
      `• All measurement records\n` +
      `• All assessment data\n` +
      `• All nutritional status information\n\n` +
      `❌ THIS ACTION CANNOT BE UNDONE! ❌\n\n` +
      `Type "DELETE ALL" to confirm this action.`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput === "DELETE ALL") {
      const finalConfirm = confirm(`Are you absolutely sure? This will delete ALL records for ${scope}.`);
      if (finalConfirm) {
        deleteAllMutation.mutate();
      }
    } else if (userInput !== null) {
      alert("Delete cancelled - confirmation text did not match.");
    }
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const birth = new Date(birthDate);
    const today = new Date();
    return (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  };

  // NOW do the role checks after all hooks are declared
  // SuperAdmin gets dedicated OPT Plus view
  if (user?.role === "super_admin") {
    return <SuperAdminOPTPlusPage />;
  }

  if (user?.role !== "admin") {
    return (
      <div className="admin-container">
        <div className="text-center py-12">
          <p className="text-red-600 font-semibold">Access Denied</p>
          <p className="text-slate-600 mt-2">This feature is only available for Admin users</p>
        </div>
      </div>
    );
  }

  // Stats removed - Summary cards section deleted

  if (tab === "add" || (tab === "edit" && editId)) {
    return (
      <div className="admin-modal-overlay fixed inset-0 flex items-center justify-center p-4 z-50">
        <div className="admin-modal-content bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Form Header Gradient */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-6 flex items-center justify-between sticky top-0">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{tab === "add" ? "Add New Record" : "Edit Record"}</h2>
                <p className="text-emerald-100 text-xs mt-1">Operation Timbang Plus - Child Assessment</p>
              </div>
            </div>
            <button
              onClick={() => { setTab("list"); setEditId(null); }}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Content */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const ageMonths = calculateAge(form.date_of_birth);
              const payload = { ...form, age_in_months: ageMonths };
              tab === "add" ? createMutation.mutate(payload) : updateMutation.mutate({ id: editId, data: payload });
            }}
            className="p-8 space-y-4"
          >
            {/* Row 1: Location & Mother */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Location <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Purok, Street, Landmark..."
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="admin-interactive-input w-full px-3 py-2 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mother/Guardian <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={form.mother_name}
                  onChange={(e) => setForm({ ...form, mother_name: e.target.value })}
                  className="admin-interactive-input w-full px-3 py-2 rounded-lg text-sm"
                  required
                />
              </div>
            </div>

            {/* Row 2: Child Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Child's Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                placeholder="Full Name"
                value={form.child_name}
                onChange={(e) => setForm({ ...form, child_name: e.target.value })}
                className="admin-interactive-input w-full px-3 py-2 rounded-lg text-sm"
                required
              />
            </div>

            {/* Row 3: Indigenous, Sex, Date of Birth */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Indigenous <span className="text-red-500">*</span></label>
                <select
                  value={form.indigenous_child}
                  onChange={(e) => setForm({ ...form, indigenous_child: e.target.value as "YES" | "NO" })}
                  className="admin-interactive-input w-full px-3 py-2 rounded-lg text-sm font-medium bg-white"
                  required
                >
                  <option value="NO">NO</option>
                  <option value="YES">YES</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Sex <span className="text-red-500">*</span></label>
                <select
                  value={form.sex}
                  onChange={(e) => setForm({ ...form, sex: e.target.value })}
                  className="admin-interactive-input w-full px-3 py-2 rounded-lg text-sm font-medium bg-white"
                  required
                >
                  <option value="M">M (Male)</option>
                  <option value="F">F (Female)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  className="admin-interactive-input w-full px-3 py-2 rounded-lg text-sm"
                  required
                />
              </div>
            </div>

            {/* Row 4: Date of Measurement, Weight, Height */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Measurement Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={form.actual_date_visit}
                  onChange={(e) => setForm({ ...form, actual_date_visit: e.target.value })}
                  className="admin-interactive-input w-full px-3 py-2 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Weight (kg) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 10.5"
                  value={form.weight || ""}
                  onChange={(e) => setForm({ ...form, weight: parseFloat(e.target.value) || 0 })}
                  className="admin-interactive-input w-full px-3 py-2 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Height (cm) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 87.0"
                  value={form.height || ""}
                  onChange={(e) => setForm({ ...form, height: parseFloat(e.target.value) || 0 })}
                  className="admin-interactive-input w-full px-3 py-2 rounded-lg text-sm"
                  required
                />
              </div>
            </div>

            {/* Row 5: Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notes/Observations</label>
              <textarea
                rows={2}
                placeholder="Enter any additional notes or observations..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="admin-interactive-input w-full px-3 py-2 rounded-lg text-sm resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => { setTab("list"); setEditId(null); }}
                className="admin-action-btn-secondary px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="admin-action-btn-primary flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 text-sm"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <Save className="h-4 w-4" />
                {tab === "add" ? "Create Record" : "Update"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container space-y-6">
      {/* Modals */}
      <ViewModal record={viewRecord} onClose={() => setViewRecord(null)} />
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSuccess={() => setTab("list")} />}

      {/* Header */}
      <div className="admin-page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <span>🏥</span>
            <span>Operation Timbang Plus</span>
          </h1>
          <p className="text-sm mt-1">Nutritional Assessment & Monitoring Tool</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowImport(true)} 
            className="admin-action-btn-primary flex items-center gap-2 px-4 py-2.5 text-xs"
          >
            <Upload className="h-4 w-4" /> Import Data
          </button>
          <button 
            onClick={() => setTab("add")} 
            className="admin-action-btn-secondary flex items-center gap-2 px-4 py-2.5 text-xs"
          >
            <Plus className="h-4 w-4" /> Add Record
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={deleteAllMutation.isPending}
            className="admin-action-btn-secondary flex items-center gap-2 px-3 py-2.5 text-xs bg-red-600 text-white hover:bg-red-700 rounded-lg"
            title="Delete all Operation Timbang records"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button 
            onClick={handleDeleteAll}
            disabled={deleteAllMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleteAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete All
          </button>
        </div>
      </div>

      {/* Records Table */}
      <Panel title="📋 Assessment Records">
        {/* Year and Purok Filters */}
        <div className="mb-4 p-4 bg-gradient-to-r from-teal-50 to-green-50 border border-teal-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 text-sm">🔍 Filters</h3>
            <button
              onClick={() => {
                setSelectedYear(new Date().getFullYear());
                setSelectedPurok("");
                setSearch("");
              }}
              className="text-xs px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded transition"
            >
              Reset All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full border border-teal-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Purok</label>
              <select
                value={selectedPurok}
                onChange={(e) => setSelectedPurok(e.target.value)}
                className="w-full border border-teal-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Puroks</option>
                {puroks.map((purok) => (
                  <option key={purok} value={purok}>{purok}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Results</label>
              <div className="h-10 flex items-center px-3 bg-white border border-teal-300 rounded text-sm font-semibold text-teal-700">
                {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search by name, mother, or location..." value={search} onChange={(e) => setSearch(e.target.value)} className="admin-interactive-input w-full pl-9 pr-3 py-2 rounded-lg text-sm" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            {/* Header Row 1 - Main Column Groups */}
            <thead>
              <tr className="bg-teal-700 text-white">
                <th colSpan={1} className="border border-teal-800 py-2 px-2 text-center font-bold">Child Seq.</th>
                <th colSpan={1} className="border border-teal-800 py-2 px-3 text-center font-bold">Address or Location of Residence</th>
                <th colSpan={1} className="border border-teal-800 py-2 px-3 text-center font-bold">Name of Mother or Caregiver</th>
                <th colSpan={1} className="border border-teal-800 py-2 px-3 text-center font-bold">Full Name of Child</th>
                <th colSpan={1} className="border border-teal-800 py-2 px-2 text-center font-bold">Indigenous Preschool Child</th>
                <th colSpan={1} className="border border-teal-800 py-2 px-2 text-center font-bold">Sex</th>
                <th colSpan={1} className="border border-teal-800 py-2 px-2 text-center font-bold">Date of Birth</th>
                <th colSpan={1} className="border border-teal-800 py-2 px-2 text-center font-bold">Actual Date of Weighing</th>
                <th colSpan={1} className="border border-teal-800 py-2 px-2 text-center font-bold">Weight</th>
                <th colSpan={1} className="border border-teal-800 py-2 px-2 text-center font-bold">Height</th>
                <th colSpan={4} className="border border-yellow-500 bg-yellow-400 py-2 px-2 text-center font-bold text-black">NO DATA ENTRY REQUIRED - VALUES WILL BE AUTO-CALCULATED</th>
                <th colSpan={1} className="border border-teal-800 py-2 px-2 text-center font-bold">Actions</th>
              </tr>
              
              {/* Header Row 2 - Sub-labels */}
              <tr className="bg-slate-700 text-white border-b-2 border-teal-700">
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs">#</th>
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs">(House #, Street, Purok, Landmark, etc.)</th>
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs">(Surname, First Name)</th>
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs">(Surname, First Name)</th>
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs">YES/NO</th>
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs">(M/F)</th>
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs">(MM/DD/YYYY)</th>
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs">(MM/DD/YYYY)</th>
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs">(kg)</th>
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs">(cm)</th>
                <th className="border border-yellow-500 bg-yellow-300 text-slate-900 py-1 px-2 text-center font-bold text-xs">Age in Months</th>
                <th className="border border-yellow-500 bg-yellow-300 text-slate-900 py-1 px-2 text-center font-bold text-xs">Weight for Age Status</th>
                <th className="border border-yellow-500 bg-yellow-300 text-slate-900 py-1 px-2 text-center font-bold text-xs">Height for Age Status</th>
                <th className="border border-yellow-500 bg-yellow-300 text-slate-900 py-1 px-2 text-center font-bold text-xs">Weight for Height/Length Status</th>
                <th className="border border-slate-600 py-2 px-2 text-center font-semibold text-xs"></th>
              </tr>
            </thead>
            
            <tbody>
              {Array.isArray(filteredRecords) && filteredRecords.length > 0 ? (
                filteredRecords.map((record: any, idx: number) => {
                  const ageMonths = calculateAge(record.date_of_birth);
                  const getWFAColor = (status: string) => {
                    switch(status) {
                      case "normal": return "bg-green-100 text-green-800";
                      case "underweight": 
                      case "moderate_acute_malnutrition": return "bg-yellow-100 text-yellow-800";
                      case "N": return "bg-green-100 text-green-800";
                      case "UW": return "bg-yellow-100 text-yellow-800";
                      default: return "bg-slate-100 text-slate-800";
                    }
                  };
                  const getHFAColor = (status: string) => {
                    switch(status) {
                      case "normal": return "bg-green-100 text-green-800";
                      case "stunted": 
                      case "severely_stunted": return "bg-orange-100 text-orange-800";
                      case "N": return "bg-green-100 text-green-800";
                      case "ST": return "bg-orange-100 text-orange-800";
                      default: return "bg-slate-100 text-slate-800";
                    }
                  };
                  const getWFHColor = (status: string) => {
                    switch(status) {
                      case "normal": return "bg-green-100 text-green-800";
                      case "wasted":
                      case "severe_acute_malnutrition": return "bg-red-100 text-red-800";
                      case "overweight": return "bg-orange-100 text-orange-800";
                      case "obese": return "bg-red-100 text-red-800";
                      case "N": return "bg-green-100 text-green-800";
                      case "W": return "bg-red-100 text-red-800";
                      case "OW": return "bg-orange-100 text-orange-800";
                      case "O": return "bg-red-100 text-red-800";
                      default: return "bg-slate-100 text-slate-800";
                    }
                  };

                  return (
                    <tr key={record.id} className="admin-table-row">
                      <td className="admin-table-cell border border-slate-100 text-center font-semibold">{idx + 1}</td>
                      <td className="admin-table-cell border border-slate-100 text-left text-slate-700">{record.location}</td>
                      <td className="admin-table-cell border border-slate-100 text-left text-slate-700">{record.mother_name}</td>
                      <td className="admin-table-cell border border-slate-100 text-left font-semibold text-slate-900">{record.child_name}</td>
                      <td className="admin-table-cell border border-slate-100 text-center font-semibold">{record.indigenous_child}</td>
                      <td className="admin-table-cell border border-slate-100 text-center font-semibold">{record.sex}</td>
                      <td className="admin-table-cell border border-slate-100 text-center text-slate-700">{new Date(record.date_of_birth).toLocaleDateString()}</td>
                      <td className="admin-table-cell border border-slate-100 text-center text-slate-700">{new Date(record.actual_date_visit).toLocaleDateString()}</td>
                      <td className="admin-table-cell border border-slate-100 text-center font-semibold">{record.weight}</td>
                      <td className="admin-table-cell border border-slate-100 text-center font-semibold">{record.height}</td>
                      <td className="admin-table-cell border border-yellow-300 bg-yellow-50/50 text-center font-bold text-slate-900">{ageMonths}</td>
                      <td className={`admin-table-cell border border-yellow-300 text-center font-bold text-xs ${getWFAColor(record.weight_for_age)}`}>{record.weight_for_age}</td>
                      <td className={`admin-table-cell border border-yellow-300 text-center font-bold text-xs ${getHFAColor(record.height_for_age)}`}>{record.height_for_age}</td>
                      <td className={`admin-table-cell border border-yellow-300 text-center font-bold text-xs ${getWFHColor(record.weight_for_height)}`}>{record.weight_for_height}</td>
                      <td className="admin-table-cell border border-slate-100 text-center space-x-1 flex justify-center items-center">
                        <button onClick={() => setViewRecord(record)} className="admin-action-btn-secondary p-1 rounded text-blue-600 transition" title="View"><Eye className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { setForm(record); setEditId(record.id); setTab("edit"); }} className="admin-action-btn-secondary p-1 rounded text-amber-600 transition" title="Edit"><Edit3 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => deleteMutation.mutate(record.id)} className="admin-action-btn-secondary p-1 rounded text-red-655 transition" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={15} className="py-8 text-center text-slate-400">No records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* OPT Plus Report Section */}
      <Panel title="📊 OPT Plus Report - Real-Time Tallies">
        <OptPlusReportSection />
      </Panel>

      {/* Detailed Analytics Section */}
      <Panel title="📈 Detailed Nutritional Analytics">
        <OptPlusAnalytics selectedYear={new Date().getFullYear()} />
      </Panel>
    </div>
  );
}

