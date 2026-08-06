"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { 
  Activity, 
  Bell, 
  Building2, 
  ChartLine, 
  ClipboardList, 
  FileText, 
  Flame, 
  LayoutDashboard, 
  LogOut, 
  Map, 
  MapPin,
  Users,
  Apple,
  X,
  Lightbulb,
  Upload,
  Settings,
  Heart,
  Trophy,
  Calendar,
  MessageSquare,
  Target,
  Home,
  Zap,
  CheckSquare,
  Wifi,
  WifiOff,
  Database,
  Menu,
  Plus,
  Shield,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Weight,
  Play,
  Pause
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { ToastProvider } from "@/lib/toast-context";

interface NavSubItem {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: NavSubItem[];
}

interface ToastMessage {
  id: string;
  message: string;
  type: "alert" | "log" | "success" | "error";
}

// Nutrition Banner Component
function NutritionBanner() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  
  const bannerData = [
    {
      image: "/image1.jpg",
      motto: "Good Nutrition, Healthy Future",
      icon: "🥗",
      color: "from-green-600 to-emerald-600"
    },
    {
      image: "/image2.jpg",
      motto: "Every Child Deserves Better Health",
      icon: "❤️",
      color: "from-red-600 to-pink-600"
    }
  ];

  useEffect(() => {
    if (!isAutoPlay) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % bannerData.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlay, bannerData.length]);

  const currentBanner = bannerData[currentImageIndex];

  return (
    <div className="shrink-0 space-y-2.5 px-3 pb-3 overflow-hidden">
      
      {/* Main Banner Card */}
      <div className="relative w-full overflow-hidden rounded-lg shadow-lg border-2 border-brandLightGreen/40 hover:border-brandLightGreen/70 transition-colors group">
        
        {/* Banner Image Container - Enhanced */}
        <div className="relative w-full h-40 overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900">
          {/* Current Image - No scroll, centered */}
          <img
            key={`banner-${currentImageIndex}`}
            src={currentBanner.image}
            alt="Nutrition banner"
            className="w-full h-full object-cover object-center transition-all duration-1000 ease-in-out hover:scale-105 pointer-events-none"
          />
          
          {/* Subtle overlay only */}
          <div className={`absolute inset-0 bg-gradient-to-t ${currentBanner.color} opacity-15 mix-blend-overlay`} />
          
          {/* Vignette effect for better image visibility */}
          <div className="absolute inset-0 bg-radial-gradient to-transparent opacity-40" style={{
            background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)"
          }} />
        </div>

        {/* Navigation Arrows - Enhanced */}
        <button
          onClick={() => {
            setCurrentImageIndex((prev) => (prev - 1 + bannerData.length) % bannerData.length);
            setIsAutoPlay(false);
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/30 hover:bg-white/50 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 shadow-lg"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <button
          onClick={() => {
            setCurrentImageIndex((prev) => (prev + 1) % bannerData.length);
            setIsAutoPlay(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/30 hover:bg-white/50 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 shadow-lg"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Auto-play toggle - Enhanced */}
        <button
          onClick={() => setIsAutoPlay(!isAutoPlay)}
          className="absolute top-2.5 right-2.5 z-20 bg-white/30 hover:bg-white/50 text-white p-1.5 rounded-full backdrop-blur-md transition-all shadow-lg"
          title={isAutoPlay ? "Pause auto-play" : "Resume auto-play"}
        >
          {isAutoPlay ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Motto Below Image - VISIBLE with border */}
      <div 
        className="text-center px-3 py-2.5 bg-gradient-to-r from-white/5 to-white/5 backdrop-blur-sm border border-brandLightGreen/30 rounded-lg hover:border-brandLightGreen/60 transition-colors"
        style={{
          fontFamily: "'Poppins', 'Segoe UI', sans-serif",
          fontSize: "12px",
          fontWeight: "600",
          letterSpacing: "0.4px"
        }}
      >
        <p className="text-white/90 leading-relaxed">{currentBanner.motto}</p>
      </div>

      {/* Progress bar - Enhanced */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
        <div
          className={`h-full bg-gradient-to-r ${currentBanner.color} transition-all duration-500 shadow-lg`}
          style={{ width: `${((currentImageIndex + 1) / bannerData.length) * 100}%` }}
        />
      </div>

      {/* Indicator Dots - Enhanced */}
      <div className="flex justify-center gap-2 items-center">
        {bannerData.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setCurrentImageIndex(idx);
              setIsAutoPlay(false);
            }}
            className={`transition-all duration-300 rounded-full ${
              idx === currentImageIndex
                ? `w-7 h-2.5 bg-gradient-to-r ${bannerData[idx].color} shadow-lg`
                : "w-2 h-2 bg-white/30 hover:bg-white/70"
            }`}
            title={bannerData[idx].motto}
          />
        ))}
      </div>

    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refreshUser, logout } = useAuthStore();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [previousAlertIds, setPreviousAlertIds] = useState<string[]>([]);
  const [previousLogIds, setPreviousLogIds] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  // Date and Time ticker - Initialize on client side only to avoid hydration mismatch
  useEffect(() => {
    // Set initial time on mount (client side only)
    setCurrentTime(new Date());
    setMounted(true);
    
    // Update time every 60 seconds
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch notifications
  const notificationsQuery = useQuery({
    queryKey: ["system-notifications", user?.id],
    queryFn: () => api.get("/api/system-notifications").then((r) => r.data),
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = notificationsQuery.data?.filter((n: any) => !n.is_read).length || 0;

  // Check auth
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    
    if (!user) {
      refreshUser().catch((error) => {
        console.error("Failed to refresh user:", error);
        router.push("/login");
      });
    }
  }, [user, refreshUser, router]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pendingSync > 0) {
        addToast(`${pendingSync} records synced successfully`, "log");
        setPendingSync(0);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast("You are now offline. Data will be saved locally.", "alert");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [pendingSync]);

  // Fetch active alerts
  const activeAlertsQuery = useQuery({
    queryKey: ["active-alerts-count", user?.id],
    queryFn: () => api.get("/api/alerts?is_resolved=false").then((r) => r.data),
    enabled: !!user?.id,
  });

  // Fetch logs
  const logsQuery = useQuery({
    queryKey: ["logs-count", user?.id],
    queryFn: () => api.get("/api/logs").then((r) => r.data),
    enabled: !!user?.id,
  });

  const activeAlertsCount = activeAlertsQuery.data?.length || 0;
  const recentLogsCount = logsQuery.data?.length || 0;

  // Real-time alert notifications
  useEffect(() => {
    if (activeAlertsQuery.data) {
      const currentAlerts = activeAlertsQuery.data;
      const currentIds = currentAlerts.map((a: any) => a.id);

      if (previousAlertIds.length > 0) {
        const newAlerts = currentAlerts.filter(
          (a: any) => !previousAlertIds.includes(a.id)
        );

        newAlerts.forEach((a: any) => {
          addToast(`⚠️ New Active Alert: ${a.message}`, "alert");
        });
      } else {
        const criticalCount = currentAlerts.filter(
          (a: any) => a.severity === "critical" || a.severity === "high"
        ).length;
        if (criticalCount > 0) {
          addToast(
            `Warning: You have ${criticalCount} unresolved high-priority alerts requiring attention.`,
            "alert"
          );
        }
      }

      setPreviousAlertIds(currentIds);
    }
  }, [activeAlertsQuery.data]);

  // Real-time activity log notifications
  useEffect(() => {
    if (logsQuery.data && user) {
      const currentLogs = logsQuery.data;
      const currentIds = currentLogs.map((l: any) => l.id);

      if (previousLogIds.length > 0) {
        const newLogs = currentLogs.filter(
          (l: any) => !previousLogIds.includes(l.id)
        );

        newLogs.forEach((l: any) => {
          const title = l.action.replace(/_/g, " ").toLowerCase();
          addToast(`⚡ New Action: ${title}`, "log");
        });
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const todaysLogs = currentLogs.filter((l: any) =>
          l.created_at.startsWith(today)
        ).length;
        if (todaysLogs > 0) {
          addToast(
            `Recent Activity: ${todaysLogs} system actions recorded today.`,
            "log"
          );
        }
      }

      setPreviousLogIds(currentIds);
    }
  }, [logsQuery.data, user]);

  function addToast(message: string, type: "alert" | "log" | "success" | "error") {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 6000);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const isActive = (href: string) => pathname === href;

  const menuItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "GIS Map", href: "/map", icon: Map },
    { label: "Program Activities", href: "/program-activities", icon: Target },
    { label: "Real-Time Monitoring", href: "/realtime-monitoring", icon: Zap },
    { label: "Alerts", href: "/alerts", icon: Bell },
    { label: "Reports & Decision Support", href: "/reports", icon: FileText },
    { label: "Analytics", href: "/analytics", icon: ChartLine },
    { label: "Messaging Center", href: "/messaging", icon: MessageSquare },
    { label: "Nutrition Calendar", href: "/nutrition-calendar", icon: Calendar },
  ];

  const adminMenuItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "GIS Map", href: "/map", icon: Map },
    { label: "Program Activities", href: "/program-activities", icon: Target },
    { label: "Real-Time Monitoring", href: "/realtime-monitoring", icon: Zap },
    { label: "Alerts", href: "/alerts", icon: Bell },
    { label: "Reports & Decision Support", href: "/reports", icon: FileText },
    { label: "Analytics", href: "/analytics", icon: ChartLine },
    { label: "Messaging Center", href: "/messaging", icon: MessageSquare },
    { label: "Nutrition Calendar", href: "/nutrition-calendar", icon: Calendar },
    { label: "Operation Timbang", href: "/admin/operation-timbang", icon: Weight },
  ];

  const superAdminMenuItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "GIS Map", href: "/map", icon: Map },
    { label: "Program Activities", href: "/program-activities", icon: Target },
    { label: "Real-Time Monitoring", href: "/realtime-monitoring", icon: Zap },
    { label: "Alerts", href: "/alerts", icon: Bell },
    { label: "Reports & Decision Support", href: "/reports", icon: FileText },
    { label: "Analytics", href: "/analytics", icon: ChartLine },
    { label: "Messaging Center", href: "/messaging", icon: MessageSquare },
    { label: "Nutrition Calendar", href: "/nutrition-calendar", icon: Calendar },
    { label: "Operation Timbang", href: "/admin/operation-timbang", icon: Weight },
    { label: "Barangay Mgmt & Monitoring", href: "/admin/barangays", icon: Building2 },
    { label: "Activity Logs", href: "/admin/logs", icon: Activity },
    { label: "System Settings", href: "/admin/settings", icon: Settings },
  ];

  const superAdminNav: NavItem[] = [
    { label: "Users Management", href: "/admin/users", icon: Users },
  ];

  const adminNav: NavItem[] = [
    { label: "Purok Mgmt & Monitoring", href: "/admin/puroks", icon: MapPin },
    { label: "Activity Logs", href: "/admin/logs", icon: Activity },
    { label: "System Settings", href: "/admin/settings", icon: Settings },
  ];

  let items = menuItems;
  if (user?.role === "super_admin") {
    items = [...superAdminMenuItems, ...superAdminNav];
  } else if (user?.role === "admin") {
    items = [...adminMenuItems, ...adminNav];
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatDayTime = (date: Date | null) => {
    if (!date) return "";
    const day = date.toLocaleDateString("en-US", { weekday: "short" });
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    return `${day} | ${time}`;
  };

  const getBadge = (label: string) => {
    if (label === "GIS Map") return { text: "3", type: "purple" };
    if (label === "Purok Monitoring") return { text: "NEW", type: "green" };
    if (label === "Program Activities") return { text: "6", type: "red" };
    if (label === "Assessments") return { text: "NEW", type: "orange" };
    if (label === "Real-Time Monitoring") return { text: "LIVE", type: "live" };
    if (label === "Alerts" && activeAlertsCount > 0) return { text: String(activeAlertsCount), type: "red" };
    return null;
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans">
      
      {/* Top Header - Styled in Green */}
      <header className="flex h-28 shrink-0 items-center justify-between bg-[#1b4324] px-4 text-white shadow-md z-10 border-b border-white/10">
        
        {/* Left header segment - Logo and Title */}
        <div className="flex items-end gap-0.10 pb-5">
          {/* Combined Logo */}
          <img 
            src="/logos.png" 
            alt="Cabadbaran Health Logo" 
            className="h-24 w-auto object-contain drop-shadow-lg flex-shrink-0"
          />
          
          {/* Title Section - positioned lower, aligned to bottom */}
          <div className="flex-1">
            <h1 className="text-lg font-black text-white uppercase leading-tight tracking-tighter">
              HEALTH MONITORING SYSTEM FOR CHILD MALNUTRITION MANAGEMENT CASES
            </h1>
            <p className="text-sm text-brandLightGreen font-bold mt-1 tracking-tight">
              City Health Office, Cabadbaran City
            </p>
          </div>
        </div>

        {/* Right header segment - Positioned at top right */}
        <div className="flex items-start gap-4 pt-1">
          
          {/* Notifications Icon Card */}
          <div className="relative">
            <div 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative cursor-pointer hover:bg-white/10 p-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Bell className="h-4.5 w-4.5 text-white" />
              <span className="hidden md:inline text-[10px] font-bold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white font-extrabold text-[9px] h-4 w-4 rounded-full flex items-center justify-center animate-pulse leading-none">
                  {unreadCount}
                </span>
              )}
            </div>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowNotifications(false)}
                />
                
                {/* Dropdown Panel */}
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-[#0b0f19] to-[#1e293b] px-4 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Notifications</h3>
                      <p className="text-xs text-slate-300">{unreadCount} unread</p>
                    </div>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-white hover:bg-white/10 rounded-lg p-1 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Notifications List */}
                  <div className="overflow-y-auto flex-1">
                    {notificationsQuery.isLoading ? (
                      <div className="p-8 text-center text-slate-400 text-sm">
                        Loading notifications...
                      </div>
                    ) : !notificationsQuery.data || notificationsQuery.data.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-slate-600">No notifications yet</p>
                        <p className="text-xs text-slate-400 mt-1">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notificationsQuery.data.map((notif: any) => (
                          <div
                            key={notif.id}
                            className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                              !notif.is_read ? "bg-blue-50/50" : ""
                            }`}
                            onClick={async () => {
                              // Mark as read
                              if (!notif.is_read) {
                                await api.post(`/api/system-notifications/${notif.id}/read`);
                                notificationsQuery.refetch();
                              }
                              // Navigate if there's a link
                              if (notif.link) {
                                router.push(notif.link);
                                setShowNotifications(false);
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                notif.type === "alert" ? "bg-red-100 text-red-600" :
                                notif.type === "info" ? "bg-blue-100 text-blue-600" :
                                notif.type === "success" ? "bg-green-100 text-green-600" :
                                "bg-slate-100 text-slate-600"
                              }`}>
                                <Bell className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 line-clamp-1">
                                  {notif.title}
                                </p>
                                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                                  {notif.message}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {new Date(notif.created_at).toLocaleString()}
                                </p>
                              </div>
                              {!notif.is_read && (
                                <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {notificationsQuery.data && notificationsQuery.data.length > 0 && (
                    <div className="border-t border-slate-200 p-2">
                      <Link
                        href="/notifications"
                        className="block text-center text-xs font-semibold text-[#0b0f19] hover:text-[#1e293b] py-2 transition-colors"
                        onClick={() => setShowNotifications(false)}
                      >
                        View All Notifications →
                      </Link>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Date & Time display - Only render after client mount to avoid hydration mismatch */}
          {mounted && currentTime ? (
            <div className="hidden md:flex flex-col bg-white/10 border border-white/20 rounded-xl px-3 py-1 text-center leading-tight">
              <p className="text-[10px] font-bold text-white tracking-wide">{formatDate(currentTime)}</p>
              <p className="text-[9px] font-semibold text-brandLightGreen mt-0.5">{formatDayTime(currentTime)}</p>
            </div>
          ) : null}

          {/* Profile Badge in Header */}
          <div className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full border border-white/20 cursor-pointer transition-colors">
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-brandLightGreen text-brand text-xs font-black shadow-inner">
              {user?.username ? user.username[0].toUpperCase() : "U"}
            </div>
            <div className="text-left leading-none hidden sm:block">
              <p className="text-xs font-bold text-white capitalize">{user?.username || "Loading"}</p>
              <p className="text-[8px] text-brandLightGreen font-bold capitalize mt-0.5">
                {user?.role ? user.role.replace("_", " ") : ""}
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <button 
            onClick={async () => { 
              try {
                console.log("Logout button clicked");
                await logout();
                console.log("Logout completed, redirecting...");
                router.push("/login");
              } catch (error) {
                console.error("Logout button error:", error);
                // Still redirect even if there's an error
                router.push("/login");
              }
            }} 
            className="inline-flex items-center gap-1 bg-white/10 hover:bg-red-700 hover:border-red-600 rounded-full border border-white/25 px-3 py-1.5 text-xs text-white transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </header>

      {/* Workspace Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        
        {/* Floating Sidebar Toggle Button - Invisible until hover */}
        {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="fixed left-0 top-32 z-50 bg-transparent hover:bg-[#1b4324] text-transparent hover:text-white p-3 rounded-r-lg hover:shadow-lg transition-all flex items-center gap-2 border-0 hover:border-r-2 hover:border-t-2 hover:border-b-2 hover:border-white/20"
            title="Show Sidebar"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
        
        {/* Sidebar - Styled in Green */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} shrink-0 bg-[#1b4324] flex flex-col border-r border-white/10 text-white select-none overflow-hidden transition-all duration-300 relative`}>
          
          <div className="flex flex-col h-full">
            
            {/* Hide/Show Button - Top of Sidebar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 shrink-0">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hover:bg-white/20 bg-white/10 p-2 rounded-lg transition-all text-white shadow-sm border border-white/20"
                title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-[10px] font-bold text-white uppercase tracking-wide">
                {user?.role === "super_admin" ? "SUPERADMIN MENU" : "MENU"}
              </span>
            </div>

            {/* Navigation List links - Scrollable */}
            <nav className="flex-1 overflow-y-auto py-2 px-3" style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}>
              <style>{`
                nav::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {items.map((item) => {
                const active = item.href ? isActive(item.href) : false;
                const badge = getBadge(item.label);

                if (item.subItems) {
                  return (
                    <div key={item.label} className="mb-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-bold text-white/65">
                        <item.icon className="h-3.5 w-3.5 text-white/45" />
                        <span>{item.label}</span>
                      </div>
                      <div className="ml-3 pl-2 border-l border-white/15">
                        {item.subItems.map((sub: NavSubItem) => {
                          const subActive = isActive(sub.href);
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className={`block rounded-lg px-2 py-1 text-[11px] font-bold transition-all mb-0.5 ${
                                subActive
                                  ? "bg-brand text-white shadow-sm"
                                  : "text-white/70 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href || item.label}
                    href={item.href || "#"}
                    className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all duration-150 group mb-0.5 ${
                      active
                        ? "bg-brand text-white shadow-md shadow-black/10"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`h-3.5 w-3.5 transition-colors ${
                        active ? "text-white" : "text-white/50 group-hover:text-white"
                      }`} />
                      <span>{item.label}</span>
                    </div>

                    {/* Badge count indicators */}
                    {badge && (
                      <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md leading-none ${
                        badge.type === "purple" ? "bg-purple-600 text-white" :
                        badge.type === "green" ? "bg-green-600 text-white" :
                        badge.type === "red" ? "bg-red-500 text-white animate-pulse" :
                        badge.type === "orange" ? "bg-orange-500 text-white" :
                        badge.type === "live" ? "bg-emerald-500 text-white animate-pulse" :
                        "bg-slate-500 text-white"
                      }`}>
                        {badge.text}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Nutrition Banner Section - Fixed at bottom */}
            <div className="border-t-2 border-brandLightGreen pt-3 pb-3">
              <NutritionBanner />
            </div>
          </div>

        </aside>

        {/* Content Wrapper */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6 relative bg-cover bg-center" style={{ backgroundImage: "url('/dashboard_bg.png')" }}>
          <ToastProvider addToast={addToast}>
            {children}
          </ToastProvider>

          {/* Floating Toast Notification Container */}
          <div className="fixed top-20 right-6 z-50 space-y-3 max-w-sm pointer-events-none">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`pointer-events-auto rounded-xl border p-4 shadow-xl flex items-start gap-3 w-80 animate-in slide-in-from-right-10 duration-300 ${
                  t.type === "alert"
                    ? "bg-red-50 border-red-100 text-red-900 font-medium animate-bounce"
                    : t.type === "success"
                    ? "bg-green-50 border-green-100 text-green-900 font-medium"
                    : t.type === "error"
                    ? "bg-red-50 border-red-100 text-red-900 font-medium"
                    : "bg-blue-50 border-blue-100 text-blue-900 font-medium"
                }`}
              >
                <div className="flex-1 text-xs font-semibold leading-relaxed">
                  {t.message}
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="p-0.5 rounded-full hover:bg-black/5 text-slate-400 hover:text-slate-655 transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </main>

      </div>
    </div>
  );
}
