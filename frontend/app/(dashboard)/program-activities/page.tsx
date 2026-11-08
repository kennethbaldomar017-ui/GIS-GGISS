"use client";
import "@/styles/admin.css";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/lib/toast-context";
import { FormalProgramActivityReport } from "@/components/reports/FormalProgramActivityReport";
import {
  Target,
  Users,
  QrCode,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  MapPin,
  Download,
  Upload,
  Scan,
  Play,
  Pause,
  Save,
  FileText,
  Award,
  Heart,
  RotateCcw,
  ChevronRight,
  User,
  MessageSquare,
  Loader2,
  Eye,
  FileSpreadsheet
} from "lucide-react";

interface Program {
  id: string;
  name: string;
  type: string;
  date: string;
  time: string;
  location: string;
  status: string;
  registered_children: number;
  total_children: number;
}

interface Child {
  id: string;
  name: string;
  age: number;
  sex: string;
  qr_code: string;
  attended: boolean;
  check_in_time?: string;
}

interface PurokOption {
  id: string;
  name: string;
  barangay_id: string;
  barangay_name: string;
}

export default function ProgramActivitiesPage() {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [activeTab, setActiveTab] = useState<"programs" | "accomplishments">("programs");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "revision" | null>(null);
  const [comment, setComment] = useState("");

  // Form state for creating program
  const [programForm, setProgramForm] = useState({
    name: "",
    type: "",
    funding_source: "",
    estimated_participants: 20,
    purok_id: "",
    date: "",
    time: "",
    description: ""
  });
  
  // AI recommendation state
  const [aiRecommendation, setAiRecommendation] = useState<any>(null);
  
  // Fetch program enums
  const { data: programEnums } = useQuery({
    queryKey: ["program-enums"],
    queryFn: async () => {
      const res = await api.get("/api/nutrition-programs/enums");
      return res.data;
    }
  });

  const { data: puroks, isLoading: puroksLoading, error: puroksError } = useQuery<PurokOption[]>({
    queryKey: ["program-location-puroks"],
    queryFn: async () => {
      const res = await api.get("/api/puroks");
      return res.data;
    }
  });
  const availablePuroks = (puroks ?? []).filter((purok) =>
    user?.role !== "admin" || purok.barangay_id === user.barangay_id
  );

  // Form state for registering participant
  const [participantForm, setParticipantForm] = useState({
    child_name: "",
    birth_date: "",
    sex: "male",
    weight: "",
    height: "",
    guardian_name: "",
    guardian_contact: "",
    address: "",
    notes: ""
  });

  const { data: programs, isLoading: programsLoading, error: programsError } = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      try {
        console.log("Fetching programs...");
        const response = await api.get("/api/programs");
        console.log("Programs response:", response.data);
        return response.data;
      } catch (error: any) {
        console.error("Error fetching programs:", error);
        console.error("Error response:", error.response?.data);
        console.error("Error status:", error.response?.status);
        throw error;
      }
    },
    retry: 1,
  });

  // Fetch nutrition programs (for SuperAdmin approvals)
  const nutritionProgramsQuery = useQuery({
    queryKey: ["nutrition-programs"],
    queryFn: () => api.get("/api/nutrition-programs/programs").then((r) => r.data),
    refetchInterval: 30_000,
    enabled: user?.role === "super_admin",
  });

  // Fetch approved/generated programs for accomplishments
  const accomplishmentsQuery = useQuery({
    queryKey: ["accomplishments-programs"],
    queryFn: () => api.get("/api/programs").then((r) => r.data),
    refetchInterval: 30_000,
  });

  // Fetch generated program reports
  const programReportsQuery = useQuery({
    queryKey: ["program-activity-reports"],
    queryFn: () => api.get("/api/reports").then((r) => {
      // Filter only program_activities reports
      const allReports = r.data || [];
      return allReports.filter((report: any) => report.report_type === "program_activities");
    }),
    refetchInterval: 10_000,
  });

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ["program-children", selectedProgram?.id],
    queryFn: () => api.get(`/api/programs/${selectedProgram?.id}/children`).then((r) => r.data),
    enabled: !!selectedProgram,
  });

  const checkInMutation = useMutation({
    mutationFn: (childId: number) => 
      api.post(`/api/programs/${selectedProgram?.id}/check-in`, { child_id: childId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-children"] });
    },
  });

  // Delete program mutation
  const deleteProgramMutation = useMutation({
    mutationFn: (programId: string) => 
      api.delete(`/api/programs/${programId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["accomplishments-programs"] });
      setShowDeleteModal(false);
      setProgramToDelete(null);
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (programIds: string[]) => {
      const results = await Promise.allSettled(
        programIds.map(id => api.delete(`/api/programs/${id}`))
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["accomplishments-programs"] });
      setShowBulkDeleteModal(false);
      setSelectedPrograms(new Set());
    },
  });

  const handleDeleteProgram = async () => {
    if (!programToDelete) return;
    try {
      await deleteProgramMutation.mutateAsync(programToDelete.id);
      addToast("✅ Program deleted successfully!", "success");
    } catch (error: any) {
      console.error("Error deleting program:", error);
      addToast("❌ Error: " + (error?.response?.data?.detail || "Failed to delete program"), "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPrograms.size === 0) return;
    try {
      await bulkDeleteMutation.mutateAsync(Array.from(selectedPrograms));
      addToast(`✅ ${selectedPrograms.size} program(s) deleted successfully!`, "success");
    } catch (error: any) {
      console.error("Error deleting programs:", error);
      addToast("❌ Error: Failed to delete one or more programs", "error");
    }
  };

  const handleGenerateReport = async (program: Program) => {
    if (!program) return;
    try {
      console.log("Generating report for program:", program.id);
      console.log("API URL:", api.defaults.baseURL);
      console.log("Full endpoint:", `${api.defaults.baseURL}/api/programs/${program.id}/generate-report`);
      
      const response = await api.post(`/api/programs/${program.id}/generate-report`);
      console.log("Report response:", response.data);
      
      addToast(`✅ Report generated successfully! Report saved to Generated Reports tab.`, "success");
      queryClient.invalidateQueries({ queryKey: ["program-activity-reports"] });
      queryClient.invalidateQueries({ queryKey: ["reports-list"] });
      
      // Auto-switch to Generated Reports tab
      setActiveTab("accomplishments");
    } catch (error: any) {
      console.error("Error generating report:", error);
      console.error("Error response:", error?.response);
      console.error("Error status:", error?.response?.status);
      console.error("Error data:", error?.response?.data);
      addToast("❌ Error: " + (error?.response?.data?.detail || "Failed to generate report"), "error");
    }
  };

  // Download program report as PDF
  const handleDownloadPDF = async (program: Program) => {
    if (!program) return;
    try {
      addToast("📥 Generating PDF... Please wait", "alert");
      
      // For now, we'll create a simple PDF with program details
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text("Program Activity Report", 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Program Name: ${program.name}`, 20, 40);
      doc.text(`Type: ${program.type || "General"}`, 20, 50);
      doc.text(`Location: ${program.location || "N/A"}`, 20, 60);
      doc.text(`Total Children: ${program.total_children}`, 20, 70);
      doc.text(`Registered Children: ${program.registered_children}`, 20, 80);
      doc.text(`Status: ${program.status || "Active"}`, 20, 90);
      
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 110);
      
      doc.save(`${program.name.replace(/\s+/g, "_")}_report.pdf`);
      addToast("✅ PDF downloaded successfully!", "success");
    } catch (error: any) {
      console.error("PDF generation error:", error);
      addToast("❌ Failed to generate PDF", "error");
    }
  };

  // Export program data as Excel
  const handleExportExcel = async (program: Program) => {
    if (!program) return;
    try {
      addToast("📊 Exporting to Excel... Please wait", "alert");
      
      // Try to get the Excel export from backend
      try {
        const response = await api.get(`/api/programs/${program.id}/export`, {
          responseType: 'blob'
        });
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${program.name.replace(/\s+/g, "_")}_data.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        
        addToast("✅ Excel file downloaded successfully!", "success");
      } catch (apiError) {
        // Fallback: Create a simple CSV
        let csv = "Field,Value\n";
        csv += `"Program Name","${program.name}"\n`;
        csv += `"Type","${program.type || "N/A"}"\n`;
        csv += `"Location","${program.location || "N/A"}"\n`;
        csv += `"Total Children",${program.total_children}\n`;
        csv += `"Registered Children",${program.registered_children}\n`;
        csv += `"Status","${program.status || "Active"}"\n`;
        csv += `"Generated","${new Date().toLocaleString()}"\n`;
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${program.name.replace(/\s+/g, "_")}_data.csv`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        
        addToast("✅ Data exported as CSV (Excel format not available)", "success");
      }
    } catch (error: any) {
      console.error("Export error:", error);
      addToast("❌ Failed to export data", "error");
    }
  };

  // Register participant button handler (opens modal)
  const handleOpenRegisterModal = () => {
    if (!selectedProgram) {
      addToast("❌ Please select a program first", "error");
      return;
    }
    // Show the participant registration form modal
    setShowRegistrationModal(true);
  };

  // Scan QR Code handler
  const handleScanQRCode = () => {
    if (!selectedProgram) {
      addToast("❌ Please select a program first", "error");
      return;
    }
    addToast("📱 QR Code scanner feature coming soon!", "alert");
    // TODO: Implement QR code scanner
  };

  // Import data handler
  const handleImportData = () => {
    if (!selectedProgram) {
      addToast("❌ Please select a program first", "error");
      return;
    }
    addToast("📤 Import data feature coming soon!", "alert");
    // TODO: Implement data import functionality
  };

  const toggleProgramSelection = (programId: string) => {
    const newSelected = new Set(selectedPrograms);
    if (newSelected.has(programId)) {
      newSelected.delete(programId);
    } else {
      newSelected.add(programId);
    }
    setSelectedPrograms(newSelected);
  };

  const toggleSelectAll = (allPrograms: Program[]) => {
    if (selectedPrograms.size === allPrograms.length) {
      setSelectedPrograms(new Set());
    } else {
      setSelectedPrograms(new Set(allPrograms.map(p => p.id)));
    }
  };

  // Handle approval actions
  const handleApprovalAction = async (type: "approve" | "reject" | "revision") => {
    if (!selectedItem) return;
    setActionType(type);
    setShowCommentModal(true);
  };

  const submitApprovalAction = async () => {
    if (!selectedItem || !actionType) return;

    try {
      const endpoint = `/api/nutrition-programs/programs/${selectedItem.id}/${actionType}`;
      await api.put(endpoint, { comments: comment || "" });

      // Refresh queries
      await nutritionProgramsQuery.refetch();
      setShowCommentModal(false);
      setSelectedItem(null);
      setComment("");
      setActionType(null);
      
      // Show success message
      addToast(`✅ Program has been ${actionType === "approve" ? "approved" : actionType === "reject" ? "rejected" : "sent for revision"}`, "success");
    } catch (error: any) {
      console.error("Error submitting action:", error);
      addToast("❌ Error: " + (error?.response?.data?.detail || "Failed to process approval"), "error");
    }
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage("");

    try {
      const response = await api.post("/api/programs", {
        name: programForm.name,
        type: programForm.type,
        funding_source: programForm.funding_source,
        estimated_participants: programForm.estimated_participants,
        purok_id: programForm.purok_id,
        date: programForm.date,
        time: programForm.time,
        description: programForm.description,
        status: "scheduled"
      });

      // Show AI budget recommendation
      if (response.data.ai_budget) {
        setAiRecommendation(response.data.ai_budget);
      }

      // Auto-select the newly created program
      setSelectedProgram(response.data);

      setFormMessage("✅ Program created successfully!");
      setProgramForm({
        name: "",
        type: "",
        funding_source: "",
        estimated_participants: 20,
        purok_id: "",
        date: "",
        time: "",
        description: ""
      });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      setTimeout(() => {
        setShowCreateModal(false);
        setFormMessage("");
      }, 2000);
    } catch (error: any) {
      console.error("Create program error:", error);
      setFormMessage("❌ Error: " + (error.response?.data?.detail || error.message || "Failed to create program"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleRegisterParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage("");

    try {
      // Register participant with child data
      const response = await api.post(`/api/programs/${selectedProgram?.id}/register`, {
        child_name: participantForm.child_name,
        birth_date: participantForm.birth_date,
        sex: participantForm.sex,
        weight: parseFloat(participantForm.weight),
        height: parseFloat(participantForm.height),
        guardian_name: participantForm.guardian_name,
        guardian_contact: participantForm.guardian_contact,
        address: participantForm.address,
        notes: participantForm.notes
      });

      setFormMessage("✅ Participant registered successfully!");
      setParticipantForm({
        child_name: "",
        birth_date: "",
        sex: "male",
        weight: "",
        height: "",
        guardian_name: "",
        guardian_contact: "",
        address: "",
        notes: ""
      });
      queryClient.invalidateQueries({ queryKey: ["program-children", selectedProgram?.id] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      setTimeout(() => {
        setShowRegistrationModal(false);
        setFormMessage("");
      }, 2000);
    } catch (error: any) {
      console.error("Register participant error:", error);
      setFormMessage("❌ Error: " + (error.response?.data?.detail || error.message || "Failed to register participant"));
    } finally {
      setFormLoading(false);
    }
  };

  const filteredChildren = children?.filter((child: Child) => 
    child.name.toLowerCase().includes(manualSearch.toLowerCase()) ||
    child.qr_code.toLowerCase().includes(manualSearch.toLowerCase())
  ) || [];

  const handleCheckIn = (childId: number) => {
    checkInMutation.mutate(childId);
  };

  const handleQRScan = (qrCode: string) => {
    const child = children?.find((c: Child) => c.qr_code === qrCode);
    if (child && !child.attended) {
      handleCheckIn(child.id);
    }
  };

  if (programsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading programs...</div>
      </div>
    );
  }

  if (programsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-red-500">Error loading programs</div>
        <div className="text-sm text-slate-600">
          {programsError instanceof Error ? programsError.message : "Unknown error"}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div className="admin-container space-y-6">
      {/* Header */}
      <div className="admin-page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Program Activities & Interventions</h1>
          <p className="text-sm">Manage programs, track interventions with dual budget allocations (CHO + Barangay), and monitor accomplishments</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="admin-action-btn-emerald flex items-center gap-2 px-4 py-2.5 text-xs text-white"
        >
          <Plus className="h-4 w-4" />
          Create Program
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab("programs")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "programs"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Programs & Report
          </button>
          <button
            onClick={() => setActiveTab("accomplishments")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "accomplishments"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Generated Reports
          </button>
        </nav>
      </div>

      {activeTab === "programs" && (
        <>
          {/* Program Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="admin-glass-panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Programs</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{programs?.length || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="admin-glass-panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Today</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {programs?.filter((p: Program) => p.status === "active").length || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                  <Play className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </div>

            <div className="admin-glass-panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Beneficiaries</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {programs?.reduce((sum: number, p: Program) => sum + p.registered_children, 0) || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="admin-glass-panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">This Month</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">12</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Programs List */}
          <div className="admin-glass-panel">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={programs && selectedPrograms.size === programs.length && programs.length > 0}
                    onChange={() => toggleSelectAll(programs || [])}
                    className="rounded border-slate-300 cursor-pointer w-4 h-4"
                    title="Select all programs"
                  />
                  <h3 className="text-sm font-semibold text-slate-900">Program Schedule</h3>
                  {selectedPrograms.size > 0 && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                      {selectedPrograms.size} selected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedPrograms.size > 0 && (
                    <button
                      onClick={() => setShowBulkDeleteModal(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      Delete Selected ({selectedPrograms.size})
                    </button>
                  )}
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search programs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {programs?.filter((p: Program) => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((program: Program) => (
                <div
                  key={program.id}
                  className={`p-6 hover:bg-slate-50 transition-colors ${
                    selectedProgram?.id === program.id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
                  } ${selectedPrograms.has(program.id) ? "bg-blue-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <input
                      type="checkbox"
                      checked={selectedPrograms.has(program.id)}
                      onChange={() => toggleProgramSelection(program.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 cursor-pointer w-4 h-4 shrink-0"
                    />
                    <div
                      className="flex items-center justify-between flex-1 cursor-pointer"
                      onClick={() => setSelectedProgram(selectedProgram?.id === program.id ? null : program)}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${
                          program.status === "active" ? "bg-green-100" :
                          program.status === "completed" ? "bg-blue-100" :
                          "bg-slate-100"
                        }`}>
                          {program.status === "active" ? (
                            <Play className="h-6 w-6 text-green-600" />
                          ) : program.status === "completed" ? (
                            <CheckCircle className="h-6 w-6 text-blue-600" />
                          ) : (
                            <Clock className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{program.name}</h4>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {program.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {program.time}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {program.location}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900">
                          {program.registered_children} / {program.total_children}
                        </div>
                        <div className="text-xs text-slate-500">Registered</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setProgramToDelete(program);
                        setShowDeleteModal(true);
                      }}
                      className="ml-4 flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors shrink-0"
                    >
                      <XCircle className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Report Section - Shows when a program is selected */}
          {selectedProgram && (
            <div className="admin-glass-panel">
              <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">📊 Program Details & Report</h3>
                      <p className="text-sm text-slate-500 mt-1">{selectedProgram.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleDownloadPDF(selectedProgram)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download PDF
                      </button>
                      <button 
                        onClick={() => handleExportExcel(selectedProgram)}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        Export Excel
                      </button>
                      <button
                        onClick={() => handleGenerateReport(selectedProgram)}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        Generate Report
                      </button>
                      <button
                        onClick={() => {
                          setProgramToDelete(selectedProgram);
                          setShowDeleteModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                        Delete Program
                      </button>
                    </div>
                  </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Registered Participants Section */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    👥 Registered Participants
                  </h4>
                  <div className="admin-glass-panel">
                    <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-600 uppercase font-semibold mb-1">Total Registered</p>
                          <p className="text-3xl font-bold text-blue-600">{selectedProgram.registered_children}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-600 uppercase font-semibold mb-1">Capacity</p>
                          <p className="text-2xl font-bold text-slate-900">{selectedProgram.total_children}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-600 uppercase font-semibold mb-1">Fill Rate</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {((selectedProgram.registered_children / selectedProgram.total_children) * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200 max-h-[400px] overflow-y-auto">
                      {childrenLoading ? (
                        <div className="p-8 text-center text-slate-500">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
                          <p className="text-sm">Loading participants...</p>
                        </div>
                      ) : children && children.length > 0 ? (
                        children.map((child: Child, idx: number) => (
                          <div key={child.id} className="p-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <span className="text-sm font-bold text-slate-400 w-8">{idx + 1}</span>
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                                  {child.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {child.age} years • {child.sex} • QR: {child.qr_code}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {child.attended ? (
                                  <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="h-5 w-5" />
                                    <div className="text-right">
                                      <p className="text-xs font-bold">Attended</p>
                                      <p className="text-[10px] text-slate-500">{child.check_in_time}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                                    Registered
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-500">
                          <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                          <p className="text-sm font-semibold">No participants registered yet</p>
                          <p className="text-xs mt-1">Participants will appear here once registered</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detailed Program Information */}
                <div className="border-t-4 border-slate-200 pt-6">
                  <h4 className="text-lg font-bold text-slate-900 mb-4">📋 Detailed Program Information</h4>
                  
                  {/* Program Overview */}
                  <div className="mb-6">
                    <h5 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Program Overview</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Program Type</p>
                        <p className="text-sm font-bold text-slate-900">{selectedProgram.type}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Date & Time</p>
                        <p className="text-sm font-bold text-slate-900">{selectedProgram.date}</p>
                        <p className="text-xs text-slate-600">{selectedProgram.time}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Location</p>
                        <p className="text-sm font-bold text-slate-900">{selectedProgram.location}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Status</p>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                          selectedProgram.status === "active" ? "bg-green-100 text-green-700" :
                          selectedProgram.status === "completed" ? "bg-blue-100 text-blue-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {selectedProgram.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Statistics */}
                  <div className="mb-6">
                    <h5 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Attendance Statistics</h5>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                        <p className="text-xs text-green-700 uppercase font-semibold mb-1">Attended</p>
                        <p className="text-2xl font-bold text-green-900">
                          {children?.filter((c: Child) => c.attended).length || 0}
                        </p>
                        <p className="text-xs text-green-600 mt-1">participants checked in</p>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                        <p className="text-xs text-orange-700 uppercase font-semibold mb-1">Pending</p>
                        <p className="text-2xl font-bold text-orange-900">
                          {children?.filter((c: Child) => !c.attended).length || 0}
                        </p>
                        <p className="text-xs text-orange-600 mt-1">awaiting check-in</p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                        <p className="text-xs text-blue-700 uppercase font-semibold mb-1">Attendance Rate</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {children && children.length > 0
                            ? ((children.filter((c: Child) => c.attended).length / children.length) * 100).toFixed(1)
                            : 0}%
                        </p>
                        <p className="text-xs text-blue-600 mt-1">of registered</p>
                      </div>
                    </div>
                  </div>

                  {/* Budget Information */}
                  <div className="mb-6">
                    <h5 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">💰 Budget & Financial Summary</h5>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                        <p className="text-xs text-blue-700 uppercase font-semibold mb-1">Estimated Budget</p>
                        <p className="text-xl font-bold text-blue-900">
                          ₱{(selectedProgram as any).budget_amount?.toLocaleString() || '0'}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">Per month</p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                        <p className="text-xs text-green-700 uppercase font-semibold mb-1">Annual Projection</p>
                        <p className="text-xl font-bold text-green-900">
                          ₱{(((selectedProgram as any).budget_amount || 0) * 12)?.toLocaleString()}
                        </p>
                        <p className="text-xs text-green-600 mt-1">12 months</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                        <p className="text-xs text-purple-700 uppercase font-semibold mb-1">Total Participants</p>
                        <p className="text-xl font-bold text-purple-900">
                          {(selectedProgram as any).total_registered || selectedProgram.registered_children}
                        </p>
                        <p className="text-xs text-purple-600 mt-1">Beneficiaries</p>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                        <p className="text-xs text-orange-700 uppercase font-semibold mb-1">Cost Per Child</p>
                        <p className="text-xl font-bold text-orange-900">
                          ₱{(((selectedProgram as any).budget_amount || 0) / Math.max((selectedProgram as any).total_registered || selectedProgram.registered_children || 1, 1)).toFixed(0)}
                        </p>
                        <p className="text-xs text-orange-600 mt-1">Average cost</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h5 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Quick Actions</h5>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleOpenRegisterModal}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Register Participant
                      </button>
                      <button 
                        onClick={handleScanQRCode}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        <QrCode className="h-4 w-4" />
                        Scan QR Code
                      </button>
                      <button 
                        onClick={handleImportData}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Import Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Accomplishments Tab - Generated Reports */}
      {activeTab === "accomplishments" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="admin-glass-panel p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
                  <FileText className="h-6 w-6 text-blue-600" />
                  Program Activity Reports & Documentation
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Official program activity reports with complete documentation and statistics
                </p>
              </div>
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                <p className="text-xs font-semibold uppercase">Total Reports</p>
                <p className="text-2xl font-bold">{programReportsQuery.data?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Reports List - Formal Documentation Style */}
          <div className="space-y-4">
            {programReportsQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-slate-200">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
                <p className="text-sm font-semibold text-slate-600">Loading official reports...</p>
                <p className="text-xs text-slate-400 mt-1">Please wait</p>
              </div>
            ) : programReportsQuery.data && programReportsQuery.data.length > 0 ? (
              programReportsQuery.data.map((report: any, index: number) => (
                <div
                  key={report.id}
                  className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all duration-200"
                >
                  {/* Report Header */}
                  <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 border-b-2 border-slate-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="bg-blue-600 text-white rounded-lg p-3 shadow-md">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Report #{String(index + 1).padStart(3, '0')}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                              report.status === "approved" ? "bg-green-100 text-green-700 border border-green-300" :
                              report.status === "submitted" ? "bg-blue-100 text-blue-700 border border-blue-300" :
                              report.status === "rejected" ? "bg-red-100 text-red-700 border border-red-300" :
                              "bg-slate-100 text-slate-700 border border-slate-300"
                            }`}>
                              {report.status}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mt-1">
                            {report.title}
                          </h3>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <Calendar className="h-3.5 w-3.5" />
                              Generated: {new Date(report.generated_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                            <span className="flex items-center gap-1.5 font-semibold">
                              <MapPin className="h-3.5 w-3.5" />
                              {report.barangay_name || "City-wide"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Report Body - Formal Documentation Component */}
                  <div className="p-8 bg-slate-50">
                    <FormalProgramActivityReport report={report} />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-300">
                <div className="bg-slate-100 rounded-full p-6 mb-4">
                  <FileText className="h-12 w-12 text-slate-400" />
                </div>
                <p className="text-lg font-bold text-slate-700">No Reports Generated Yet</p>
                <p className="text-sm text-slate-500 mt-2 max-w-md text-center">
                  Generate official program activity reports by clicking the <strong>"Generate Report"</strong> button on any program in the Programs tab.
                </p>
                <button
                  onClick={() => setActiveTab("programs")}
                  className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-md"
                >
                  Go to Programs Tab
                </button>
              </div>
            )}
          </div>
        </div>
      )}

          {/* Program Details - Shows when a program is selected */}
          {selectedProgram && (
            <div className="admin-glass-panel">
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">📊 Program Details</h3>
                    <p className="text-sm text-slate-500 mt-1">{selectedProgram.name}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedProgram(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Program Overview */}
                <div>
                  <h5 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Program Overview</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Program Type</p>
                      <p className="text-sm font-bold text-slate-900">{selectedProgram.type}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Date & Time</p>
                      <p className="text-sm font-bold text-slate-900">{selectedProgram.date}</p>
                      <p className="text-xs text-slate-600">{selectedProgram.time}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Location</p>
                      <p className="text-sm font-bold text-slate-900">{selectedProgram.location}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Status</p>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                        selectedProgram.status === "active" ? "bg-green-100 text-green-700" :
                        selectedProgram.status === "completed" ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {selectedProgram.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Participants Summary */}
                <div>
                  <h5 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Participants Summary</h5>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <p className="text-xs text-blue-700 uppercase font-semibold mb-1">Total Registered</p>
                      <p className="text-2xl font-bold text-blue-900">{selectedProgram.registered_children}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                      <p className="text-xs text-green-700 uppercase font-semibold mb-1">Capacity</p>
                      <p className="text-2xl font-bold text-green-900">{selectedProgram.total_children}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                      <p className="text-xs text-purple-700 uppercase font-semibold mb-1">Fill Rate</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {((selectedProgram.registered_children / selectedProgram.total_children) * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

      {/* Approvals Tab - Disabled */}
      {(false as any) && (activeTab as any) === "approvals" && user?.role === "super_admin" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="admin-glass-panel flex items-center justify-between p-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
                <Award className="h-6 w-6 text-emerald-500" />
                Program Approval Center
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Review and approve nutrition programs
              </p>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* Items List */}
            <div className="admin-glass-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-sm font-extrabold text-slate-800">Pending Nutrition Programs</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {nutritionProgramsQuery.data?.filter((p: any) => p.approval_status === "pending").length || 0} item{(nutritionProgramsQuery.data?.filter((p: any) => p.approval_status === "pending").length || 0) !== 1 ? "s" : ""} awaiting review
                </p>
              </div>

              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {nutritionProgramsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
                  </div>
                ) : (nutritionProgramsQuery.data?.filter((p: any) => p.approval_status === "pending") || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                    <p className="text-sm font-semibold text-slate-700">No pending items</p>
                    <p className="text-xs text-slate-500 mt-1">All items have been reviewed</p>
                  </div>
                ) : (
                  (nutritionProgramsQuery.data?.filter((p: any) => p.approval_status === "pending") || []).map((item: any) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`p-4 cursor-pointer transition-colors hover:bg-slate-50/50 ${
                        selectedItem?.id === item.id ? "bg-emerald-50/40 border-l-4 border-emerald-500" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-extrabold text-slate-900">{item.name}</h3>
                            <span className="bg-yellow-100 text-yellow-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                              Pending
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>Purok {item.purok_id}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{item.frequency}</span>
                            </div>
                          </div>
                          {item.description && (
                            <p className="text-xs text-slate-600 mt-2 line-clamp-2">{item.description}</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-1" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Detail Panel */}
            <div className="admin-glass-panel overflow-hidden">
              {selectedItem ? (
                <>
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-sm font-extrabold text-slate-800">Review Details</h2>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Item Details */}
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</p>
                        <p className="text-sm font-extrabold text-slate-900 mt-0.5">{selectedItem.name}</p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</p>
                        <p className="text-xs text-slate-700 mt-0.5">{selectedItem.description || "N/A"}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frequency</p>
                          <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedItem.frequency}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Budget</p>
                          <p className="text-xs font-semibold text-slate-700 mt-0.5">
                            {selectedItem.budget_amount ? `₱${selectedItem.budget_amount.toLocaleString()}` : "N/A"}
                          </p>
                        </div>
                      </div>

                      {selectedItem.comments && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Existing Comments</p>
                          <p className="text-xs text-slate-700 mt-0.5 bg-slate-50 p-2 rounded">{selectedItem.comments}</p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-slate-100 space-y-2">
                      <button
                        onClick={() => handleApprovalAction("approve")}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-extrabold transition-colors shadow-sm"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprovalAction("revision")}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-white text-xs font-extrabold transition-colors shadow-sm"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Return for Revision
                      </button>
                      <button
                        onClick={() => handleApprovalAction("reject")}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-red-655 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-extrabold transition-colors shadow-sm"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center px-5">
                  <MessageSquare className="h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Select an item to review</p>
                  <p className="text-xs text-slate-500 mt-1">Choose from the list to view details and take action</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="admin-modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="admin-modal-content w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 md:p-8 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                {actionType === "approve" && "Add Approval Comments"}
                {actionType === "revision" && "Revision Instructions"}
                {actionType === "reject" && "Rejection Reason"}
              </h3>
            </div>
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Enter your comments or instructions..."
                className="admin-interactive-input w-full rounded-xl px-3 py-2 text-sm min-h-[120px]"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setComment("");
                  setActionType(null);
                }}
                className="admin-action-btn-secondary px-4 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={submitApprovalAction}
                className="admin-action-btn-primary px-4 py-2 rounded-xl text-xs"
              >
                {actionType === "approve" && "Approve"}
                {actionType === "revision" && "Return for Revision"}
                {actionType === "reject" && "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && programToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 mb-1">Delete Program</h3>
                <p className="text-sm text-slate-600">
                  Are you sure you want to delete <strong>{programToDelete.name}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setProgramToDelete(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProgram}
                disabled={deleteProgramMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteProgramMutation.isPending ? "Deleting..." : "Delete Program"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && selectedPrograms.size > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 mb-1">Delete Multiple Programs</h3>
                <p className="text-sm text-slate-600">
                  Are you sure you want to delete <strong>{selectedPrograms.size} program(s)</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedPrograms.size} Programs`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {showRegistrationModal && selectedProgram && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in slide-in-from-bottom-5 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">Register Participant</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedProgram.name}</p>
              </div>
              <button 
                onClick={() => {
                  setShowRegistrationModal(false);
                  setFormMessage("");
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterParticipant} className="space-y-4">
              {/* Child Information Section */}
              <div className="bg-blue-50/50 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  Child Information
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Child's Full Name *
                    </label>
                    <input
                      type="text"
                      value={participantForm.child_name}
                      onChange={(e) => setParticipantForm({...participantForm, child_name: e.target.value})}
                      placeholder="e.g., Juan Dela Cruz"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Birth Date *
                    </label>
                    <input
                      type="date"
                      value={participantForm.birth_date}
                      onChange={(e) => setParticipantForm({...participantForm, birth_date: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Sex *
                    </label>
                    <select
                      value={participantForm.sex}
                      onChange={(e) => setParticipantForm({...participantForm, sex: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Measurement Section */}
              <div className="bg-green-50/50 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" />
                  Nutritional Measurement
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Weight (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={participantForm.weight}
                      onChange={(e) => setParticipantForm({...participantForm, weight: e.target.value})}
                      placeholder="e.g., 12.5"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Height (cm) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={participantForm.height}
                      onChange={(e) => setParticipantForm({...participantForm, height: e.target.value})}
                      placeholder="e.g., 95.0"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Guardian Information Section */}
              <div className="bg-purple-50/50 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  Guardian Information
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Guardian Name *
                    </label>
                    <input
                      type="text"
                      value={participantForm.guardian_name}
                      onChange={(e) => setParticipantForm({...participantForm, guardian_name: e.target.value})}
                      placeholder="e.g., Maria Dela Cruz"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Contact Number
                    </label>
                    <input
                      type="tel"
                      value={participantForm.guardian_contact}
                      onChange={(e) => setParticipantForm({...participantForm, guardian_contact: e.target.value})}
                      placeholder="e.g., 09123456789"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Address
                    </label>
                    <input
                      type="text"
                      value={participantForm.address}
                      onChange={(e) => setParticipantForm({...participantForm, address: e.target.value})}
                      placeholder="e.g., Purok 1, Poblacion"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  value={participantForm.notes}
                  onChange={(e) => setParticipantForm({...participantForm, notes: e.target.value})}
                  placeholder="Any additional observations or notes..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {formMessage && (
                <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  formMessage.includes("✅") 
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}>
                  {formMessage}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegistrationModal(false);
                    setFormMessage("");
                  }}
                  className="flex-1 border border-slate-200 text-slate-600 font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? "Registering..." : "Register Participant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Program Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-lg font-extrabold text-slate-800">Create New Program</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProgram} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Program Name *
                </label>
                <input
                  type="text"
                  value={programForm.name}
                  onChange={(e) => setProgramForm({...programForm, name: e.target.value})}
                  placeholder="e.g., Vitamin A Supplementation Program"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Program Type *
                </label>
                <select
                  value={programForm.type}
                  onChange={(e) => setProgramForm({...programForm, type: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select type...</option>
                  {programEnums?.program_types?.map((pt: any) => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Funding Source *
                </label>
                <select
                  value={programForm.funding_source}
                  onChange={(e) => setProgramForm({...programForm, funding_source: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select funding source...</option>
                  {programEnums?.funding_sources?.map((fs: any) => (
                    <option key={fs.value} value={fs.value}>{fs.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Estimated Participants *
                </label>
                <input
                  type="number"
                  min="1"
                  value={programForm.estimated_participants}
                  onChange={(e) => setProgramForm({...programForm, estimated_participants: parseInt(e.target.value) || 0})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="e.g., 20"
                />
                <p className="text-xs text-slate-500 mt-1">Number of children expected to participate</p>
              </div>
              
              {/* AI Budget Recommendation Display */}
              {aiRecommendation && (
                <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">AI</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-blue-900 mb-2">
                        💡 AI Budget Recommendation
                      </h4>
                      <p className="text-lg font-bold text-blue-700 mb-2">
                        ₱{aiRecommendation.recommended_budget?.toLocaleString()}
                        <span className="text-xs font-normal text-blue-600 ml-2">(monthly)</span>
                      </p>
                      <div className="text-xs text-blue-800 space-y-1">
                        <p>• Target Children: {aiRecommendation.breakdown?.target_children}</p>
                        <p>• Base Cost/Child: ₱{aiRecommendation.breakdown?.base_cost?.toLocaleString()}</p>
                        <p>• Annual Budget: ₱{aiRecommendation.breakdown?.recommended_annual?.toLocaleString()}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiRecommendation(null)}
                        className="text-xs text-blue-600 hover:text-blue-800 mt-2 underline"
                      >
                        Hide details
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={programForm.date}
                    onChange={(e) => setProgramForm({...programForm, date: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Time *
                  </label>
                  <input
                    type="time"
                    value={programForm.time}
                    onChange={(e) => setProgramForm({...programForm, time: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Location (Purok) *
                </label>
                <select
                  value={programForm.purok_id}
                  onChange={(e) => setProgramForm({...programForm, purok_id: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={puroksLoading || !!puroksError || availablePuroks.length === 0}
                >
                  <option value="">
                    {puroksLoading ? "Loading locations..." : "Select a purok..."}
                  </option>
                  {availablePuroks.map((purok) => (
                    <option key={purok.id} value={purok.id}>
                      {purok.barangay_name} — {purok.name}
                    </option>
                  ))}
                </select>
                {puroksError ? (
                  <p className="text-xs text-red-600 mt-1">Could not load locations. Please try again.</p>
                ) : !puroksLoading && availablePuroks.length === 0 ? (
                  <p className="text-xs text-amber-700 mt-1">
                    {user?.role === "admin"
                      ? "No active puroks are available in your assigned barangay."
                      : "No active puroks are available."}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  value={programForm.description}
                  onChange={(e) => setProgramForm({...programForm, description: e.target.value})}
                  placeholder="Additional program details..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm placeholder-slate-400 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {formMessage && (
                <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  formMessage.includes("✅") 
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}>
                  {formMessage}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border border-slate-200 text-slate-600 font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? "Creating..." : "Create Program"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
