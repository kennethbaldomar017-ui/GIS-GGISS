"use client";

import { useState } from "react";
import { api, API_URL } from "@/lib/api";
import { Download, Upload, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ImportPage() {
  const [job, setJob] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/api/import/upload", form);
      setJob(res.data.job_id);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Bulk Data Import</h1>
        <p className="text-sm text-slate-500 mt-1">Import multiple children records from CSV or Excel files</p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-blue-900 mb-3">Before importing:</h3>
            <ul className="text-sm text-blue-800 space-y-1.5">
              <li>• Download the Excel template and fill in your data</li>
              <li>• Ensure all required fields are filled correctly</li>
              <li>• Age should be in months, height in cm, weight in kg</li>
              <li>• Status must be one of: Normal, Underweight, Severely Underweight, Stunted, Wasted</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: Download Template */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Download className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Step 1: Download Template</h3>
              <p className="text-xs text-slate-500 mt-0.5">Get the Excel template file</p>
            </div>
          </div>
          <a
            href={`${API_URL}/api/import/template`}
            download
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Excel Template
          </a>
        </div>

        {/* Step 2: Upload Data */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Step 2: Upload Data</h3>
              <p className="text-xs text-slate-500 mt-0.5">Import a filled CSV or Excel file</p>
            </div>
          </div>
          <label className="block">
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center cursor-pointer hover:bg-blue-50/50 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xlsm,.xltx,.xltm"
                onChange={upload}
                disabled={isUploading}
                className="hidden"
              />
              <Upload className="h-8 w-8 text-blue-500 mx-auto mb-3" />
              <p className="font-semibold text-slate-700 text-sm">Click to upload CSV or Excel file</p>
              <p className="text-xs text-slate-500 mt-1">or drag and drop</p>
            </div>
          </label>
          <button
            onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
            disabled={isUploading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Upload Data File</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sample Data Format */}
      {!job && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Sample Data Format</h3>
          <div className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto">
            <p className="text-slate-400 mb-2">Child ID, Name, Age (months), Gender, Height (cm), Weight (kg), Barangay, Purok, Guardian Name, Contact Number, Status</p>
            <p>C001, Maria Santos, 36, Female, 85.2, 10.5, Bayabas, Purok 3, Ana Santos, 09171234567, Underweight</p>
            <p>C002, Juan Dela Cruz, 24, Male, 78.5, 9.2, Poblacion 3, Purok 2, Rosa Dela Cruz, 09181234568, Normal</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {job && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <h3 className="font-bold text-green-900">Import Successful!</h3>
              <p className="text-sm text-green-800 mt-1">Import job created: <code className="bg-white px-2 py-1 rounded border border-green-200">{job}</code></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
