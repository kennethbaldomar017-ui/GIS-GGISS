"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface OptPlusData {
  province: string;
  region: string;
  municipality: string;
  psgc: string;
  total_population: number;
  children_0_59_months: number;
  coverage_percentage: number;
  total_wfa: number;
  total_hfa: number;
  total_wflh: number;
  age_group_data: any[];
  gender_breakdown: any;
  summary: {
    undernutrition_0_59: number;
    overweight_0_59: number;
    undernutrition_0_23: number;
    overweight_0_23: number;
  };
}

export default function OptPlusReportPage() {
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [showFilters, setShowFilters] = useState(false);

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

  const optPlusQuery = useQuery({
    queryKey: ["opt-plus-report", selectedYear, selectedMonth],
    queryFn: () =>
      api.get(`/api/opt-plus/report?year=${selectedYear}&month=${selectedMonth}`)
        .then((r) => r.data),
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 2,
  });

  const data = optPlusQuery.data as OptPlusData | undefined;

  const handleDownloadPDF = async () => {
    try {
      const element = document.getElementById("opt-plus-report");
      if (!element) return;

      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>OPT Plus Report ${selectedYear}</title>
          <style>
            @page { size: A4 landscape; margin: 0.5in; }
            body { font-family: Arial, sans-serif; font-size: 10px; }
            table { border-collapse: collapse; width: 100%; margin: 10px 0; }
            td, th { border: 1px solid #000; padding: 4px; text-align: center; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .header { font-size: 14px; font-weight: bold; margin: 10px 0; }
            .summary-box { border: 2px solid #000; padding: 8px; margin: 10px 0; }
          </style>
        </head>
        <body>
          ${element.innerHTML}
        </body>
        </html>
      `);

      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              OPT Plus Report {selectedYear}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Operation Timbang Plus - Child Nutrition Monitoring Report
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
            >
              Filters
            </button>
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
            >
              Download PDF
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
            >
              Print
            </button>
            <button
              onClick={() => optPlusQuery.refetch()}
              disabled={optPlusQuery.isLoading}
              className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      {showFilters && (
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-green-900">Filter Options</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

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
                  setSelectedYear(2025);
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

      {/* REPORT CONTENT */}
      {optPlusQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin h-8 w-8 text-emerald-600 border-4 border-emerald-200 border-t-emerald-600 rounded-full mb-3"></div>
            <p className="text-slate-600 font-semibold">Loading OPT Plus report...</p>
          </div>
        </div>
      ) : optPlusQuery.isError ? (
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
      ) : !data ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-slate-600 font-semibold">No data available for the selected period</p>
        </div>
      ) : (
        <div id="opt-plus-report" className="space-y-6">
          {/* HEADER SECTION */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="border-b-2 border-emerald-200 pb-3">
                <p className="text-xs font-semibold text-slate-600 uppercase">Province</p>
                <p className="text-lg font-bold text-slate-900">{data.province}</p>
              </div>
              <div className="border-b-2 border-emerald-200 pb-3">
                <p className="text-xs font-semibold text-slate-600 uppercase">Region</p>
                <p className="text-lg font-bold text-slate-900">{data.region}</p>
              </div>
              <div className="border-b-2 border-emerald-200 pb-3">
                <p className="text-xs font-semibold text-slate-600 uppercase">Municipality</p>
                <p className="text-lg font-bold text-slate-900">{data.municipality}</p>
              </div>
              <div className="border-b-2 border-emerald-200 pb-3">
                <p className="text-xs font-semibold text-slate-600 uppercase">Coverage</p>
                <p className="text-lg font-bold text-emerald-600">{data.coverage_percentage.toFixed(1)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 uppercase">Total Population</p>
                <p className="text-2xl font-black text-blue-900">{data.total_population.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-700 uppercase">Children 0-59m</p>
                <p className="text-2xl font-black text-green-900">{data.children_0_59_months.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-purple-700 uppercase">Total Weight-for-Age (WFA)</p>
                <p className="text-2xl font-black text-purple-900">{data.total_wfa.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-orange-700 uppercase">Total Height-for-Age (HFA)</p>
                <p className="text-2xl font-black text-orange-900">{data.total_hfa.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 uppercase">Total Weight-for-Length/Height (WFL/H)</p>
                <p className="text-2xl font-black text-red-900">{data.total_wflh.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* SUMMARY SECTION */}
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 rounded-2xl p-6">
            <h2 className="text-lg font-black text-emerald-900 mb-4">Children Affected Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase">Undernutrition (0-59m)</p>
                <p className="text-3xl font-black text-red-600">{data.summary.undernutrition_0_59}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase">Overweight (0-59m)</p>
                <p className="text-3xl font-black text-orange-600">{data.summary.overweight_0_59}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase">Undernutrition (0-23m)</p>
                <p className="text-3xl font-black text-red-700">{data.summary.undernutrition_0_23}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 uppercase">Overweight (0-23m)</p>
                <p className="text-3xl font-black text-orange-700">{data.summary.overweight_0_23}</p>
              </div>
            </div>
          </div>

          {/* PRINTING INSTRUCTIONS */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800 font-semibold">
            💡 <strong>Printing Instructions:</strong> For best results, print in landscape orientation with margins set
            to 0.5 inches. Use print scaling at 100% or "fit to page".
          </div>
        </div>
      )}
    </div>
  );
}
