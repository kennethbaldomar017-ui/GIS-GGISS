"use client";

import { Calendar, MapPin, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";

interface BarangayProgram {
  barangay_name: string;
  total_programs: number;
  active_programs: number;
  upcoming_sessions: number;
  government_funded: number;
  total_budget: number;
}

interface ProgramsOverviewData {
  by_barangay: BarangayProgram[];
  city_total_programs: number;
  city_active_programs: number;
  city_upcoming_sessions: number;
  city_total_budget: number;
  most_active_barangay: string;
  least_active_barangay: string;
}

export function SuperAdminProgramsOverview({ data, isLoading }: { data?: ProgramsOverviewData; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            City-Wide Nutrition Program Overview
          </h2>
        </div>
        <div className="flex items-center justify-center h-40">
          <p className="text-xs text-slate-400 font-semibold">Loading program data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            City-Wide Nutrition Program Overview
          </h2>
        </div>
        <div className="flex items-center justify-center h-40">
          <p className="text-xs text-slate-400 font-semibold">No program data available</p>
        </div>
      </div>
    );
  }

  const {
    by_barangay,
    city_total_programs,
    city_active_programs,
    city_upcoming_sessions,
    city_total_budget,
    most_active_barangay,
    least_active_barangay
  } = data;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <h2 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600" />
          City-Wide Nutrition Program Overview
        </h2>
        <Link href="/nutrition" className="text-xs font-bold text-indigo-650 hover:underline">
          View All Programs
        </Link>
      </div>

      {/* City-Level Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl p-3">
          <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wide mb-1">Total Programs</p>
          <p className="text-2xl font-black text-indigo-900">{city_total_programs}</p>
          <p className="text-[9px] text-indigo-600 font-semibold mt-1">City-wide</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-3">
          <p className="text-[10px] text-green-700 font-bold uppercase tracking-wide mb-1">Active</p>
          <p className="text-2xl font-black text-green-900">{city_active_programs}</p>
          <p className="text-[9px] text-green-600 font-semibold mt-1">Running now</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-3">
          <p className="text-[10px] text-blue-700 font-bold uppercase tracking-wide mb-1">Upcoming</p>
          <p className="text-2xl font-black text-blue-900">{city_upcoming_sessions}</p>
          <p className="text-[9px] text-blue-600 font-semibold mt-1">Sessions (30d)</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-3">
          <p className="text-[10px] text-orange-700 font-bold uppercase tracking-wide mb-1">Total Budget</p>
          <p className="text-xl font-black text-orange-900">₱{(city_total_budget / 1_000_000).toFixed(1)}M</p>
          <p className="text-[9px] text-orange-600 font-semibold mt-1">Allocated</p>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-green-700 font-bold uppercase tracking-wide">Most Active Barangay</p>
              <p className="text-lg font-black text-green-900 mt-1">{most_active_barangay}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600 opacity-30" />
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wide">Needs Support</p>
              <p className="text-lg font-black text-amber-900 mt-1">{least_active_barangay}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-amber-600 opacity-30" />
          </div>
        </div>
      </div>

      {/* Barangay Program Breakdown Table */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-slate-500" />
          Program Activity by Barangay
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium text-slate-600">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Barangay</th>
                <th className="px-3">Total Programs</th>
                <th className="px-3">Active</th>
                <th className="px-3">Upcoming Sessions</th>
                <th className="px-3">Funded Programs</th>
                <th className="px-3 text-right">Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {by_barangay.map((brgy, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-800">{brgy.barangay_name}</td>
                  <td className="px-3 font-semibold text-slate-700">{brgy.total_programs}</td>
                  <td className="px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-green-50 border border-green-200 text-green-700">
                      {brgy.active_programs}
                    </span>
                  </td>
                  <td className="px-3 font-semibold text-slate-700">{brgy.upcoming_sessions}</td>
                  <td className="px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                      {brgy.government_funded}
                    </span>
                  </td>
                  <td className="px-3 text-right font-bold text-slate-800">₱{(brgy.total_budget / 1000).toFixed(0)}K</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
