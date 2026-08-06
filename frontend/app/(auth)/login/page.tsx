"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  Users, 
  ShieldCheck, 
  TrendingUp, 
  Heart, 
  ChevronDown, 
  MapPin, 
  Shield 
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

// Barangay admin accounts — auto-fills username when selected
const BARANGAY_ACCOUNTS = [
  { label: "Antonio Luna",  username: "admin_antonio_luna" },
  { label: "Bay-ang",       username: "admin_bay_ang" },
  { label: "Bayabas",       username: "admin_bayabas" },
  { label: "Caasinan",      username: "admin_caasinan" },
  { label: "Cabinet",       username: "admin_cabinet" },
  { label: "Calamba",       username: "admin_calamba" },
  { label: "Calibunan",     username: "admin_calibunan" },
  { label: "Comagascas",    username: "admin_comagascas" },
  { label: "Del Pilar",     username: "admin_del_pilar" },
  { label: "Katugasan",     username: "admin_katugasan" },
  { label: "Kauswagan",     username: "admin_kauswagan" },
  { label: "La Union",      username: "admin_la_union" },
  { label: "Mabini",        username: "admin_mabini" },
  { label: "Mahaba",        username: "admin_mahaba" },
  { label: "Poblacion 1",   username: "admin_poblacion_1" },
  { label: "Poblacion 2",   username: "admin_poblacion_2" },
  { label: "Poblacion 3",   username: "admin_poblacion_3" },
  { label: "Poblacion 4",   username: "admin_poblacion_4" },
  { label: "Poblacion 5",   username: "admin_poblacion_5" },
  { label: "Poblacion 6",   username: "admin_poblacion_6" },
  { label: "Poblacion 7",   username: "admin_poblacion_7" },
  { label: "Poblacion 8",   username: "admin_poblacion_8" },
  { label: "Poblacion 9",   username: "admin_poblacion_9" },
  { label: "Poblacion 10",  username: "admin_poblacion_10" },
  { label: "Poblacion 11",  username: "admin_poblacion_11" },
  { label: "Poblacion 12",  username: "admin_poblacion_12" },
  { label: "Puting Bato",   username: "admin_puting_bato" },
  { label: "Sanghan",       username: "admin_sanghan" },
  { label: "Soriano",       username: "admin_soriano" },
  { label: "Tolosa",        username: "admin_tolosa" },
];

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showBarangayList, setShowBarangayList] = useState(false);
  const [autofillMessage, setAutofillMessage] = useState("");

  const handleSuperAdminQuickClick = () => {
    setUsername("superadmin");
    setPassword("Admin@123");
    setShowBarangayList(false);
    setError("");
    setAutofillMessage("Super Admin credentials autofilled!");
    setTimeout(() => setAutofillMessage(""), 3000);
  };

  const handleBarangayAdminQuickClick = () => {
    setShowBarangayList(!showBarangayList);
    setError("");
    setAutofillMessage("");
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      // Wait a moment for state to update, then redirect
      await new Promise(resolve => setTimeout(resolve, 500));
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      // Provide more specific error messages
      if (err.code === "ERR_NETWORK") {
        setError("Cannot connect to server. Please check if the backend is running.");
      } else if (err.response?.status === 401) {
        setError("Invalid username or password.");
      } else if (err.response?.status === 403) {
        setError("Your account has been deactivated. Please contact an administrator.");
      } else {
        setError("An error occurred during login. Please try again.");
      }
      setLoading(false);
    }
  }

  const footerCards = [
    {
      icon: Users,
      title: "Monitor",
      description: "children's growth and nutrition"
    },
    {
      icon: ShieldCheck,
      title: "Detect risks",
      description: "early and take action"
    },
    {
      icon: TrendingUp,
      title: "Track programs",
      description: "and interventions in real-time"
    },
    {
      icon: Heart,
      title: "Build a healthier",
      description: "future for our children"
    }
  ];

  return (
    <main className="min-h-screen bg-[url('/login-bg.png')] bg-cover bg-center bg-no-repeat flex flex-col items-center justify-between p-4 md:p-6 font-sans">
      {/* Spacer to push card to center vertically */}
      <div className="flex-grow flex items-center justify-center w-full">
        
        {/* Sign-In Card Container */}
        <div className="w-full max-w-[430px] bg-white/95 backdrop-blur-md border border-gray-100 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col my-4">
          
          {/* Official Seal Logo */}
          <div className="flex justify-center mb-3">
            <img
              src="/cabadbaran-seal.png"
              alt="Cabadbaran City Seal"
              className="h-32 w-32 object-contain drop-shadow-sm"
            />
          </div>

          {/* Heading Section */}
          <div className="text-center mb-4">
            <h1 className="text-base font-extrabold tracking-tight text-[#0D47A1] leading-tight">
              HEALTH MONITORING SYSTEM FOR
            </h1>
            <h2 className="text-base font-extrabold tracking-tight text-brand leading-tight mt-0.5">
              CHILD MALNUTRITION CASES
            </h2>
            <p className="text-[11px] font-bold text-brand mt-1.5 uppercase tracking-wider">
              Cabadbaran City
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="h-[1px] w-6 bg-brand/20" />
              <span className="text-[9px] font-bold text-brand flex items-center gap-1">
                <Heart className="h-2.5 w-2.5 fill-brand text-brand" />
                Healthy Children, Stronger Cabadbaran
                <Heart className="h-2.5 w-2.5 fill-brand text-brand" />
              </span>
              <span className="h-[1px] w-6 bg-brand/20" />
            </div>
          </div>


          {/* Divider line */}
          <div className="border-t border-gray-100 my-3" />

          {/* Sign In Header */}
          <div className="text-left mb-4">
            <h3 className="text-base font-bold text-gray-900">Sign In</h3>
            <p className="text-xs text-gray-500">Please enter your credentials to continue</p>
          </div>

          {/* Login Form */}
          <form onSubmit={submit} className="flex flex-col gap-4">
            
            {/* Username or Email Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <User className="h-4.5 w-4.5 text-gray-400" />
              </span>
              <input
                required
                autoComplete="username"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                placeholder="Username or Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Lock className="h-4.5 w-4.5 text-gray-400" />
              </span>
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand"
                />
                Remember me
              </label>
              <a href="#" className="text-brandBlue hover:underline font-bold transition-colors">
                Forgot Password?
              </a>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-[#236027] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl py-2.5 text-xs transition-all duration-200 shadow-md shadow-brand/10 flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  SIGN IN
                </>
              )}
            </button>
          </form>

          {/* Autofill Notification Message */}
          {autofillMessage && (
            <div className="mt-2 text-center text-[10px] font-bold text-brandBlue animate-pulse">
              {autofillMessage}
            </div>
          )}

          {/* Quick Select Portal Login */}
          <div className="mt-4 space-y-2.5">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <span className="relative px-2.5 bg-white text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                OR SIGN IN AS
              </span>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleBarangayAdminQuickClick}
                className={`flex-1 flex items-center justify-center gap-1.5 border font-bold py-2 px-2.5 rounded-xl text-[11px] transition-all duration-150 ${
                  showBarangayList
                    ? "border-brand bg-brandMint text-brand shadow-sm"
                    : "border-brand/30 hover:border-brand text-brand hover:bg-brandMint/30"
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                Barangay Admin
              </button>
              <button
                type="button"
                onClick={handleSuperAdminQuickClick}
                className="flex-1 flex items-center justify-center gap-1.5 border border-brandBlue/30 hover:border-brandBlue text-brandBlue hover:bg-brandLightBlue/30 font-bold py-2 px-2.5 rounded-xl text-[11px] transition-all duration-150"
              >
                <Shield className="h-3.5 w-3.5" />
                Super Admin
              </button>
            </div>

            {/* Barangay Admin Select Dropdown */}
            {showBarangayList && (
              <div className="relative mt-2 p-2.5 bg-[#E8F5E9]/50 border border-brand/10 rounded-xl space-y-1.5">
                <label className="block text-[9px] font-extrabold text-brand uppercase tracking-wider">
                  Select Barangay
                </label>
                <div className="relative">
                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setUsername(val);
                        setPassword("Admin@123");
                      }
                    }}
                    defaultValue=""
                    className="w-full appearance-none bg-white border border-brand/20 text-gray-700 rounded-lg px-2.5 py-1.5 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand cursor-pointer"
                  >
                    <option value="" disabled>— Select Barangay —</option>
                    {BARANGAY_ACCOUNTS.map((b) => (
                      <option key={b.username} value={b.username}>
                        📍 {b.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-brand" />
                </div>
              </div>
            )}
          </div>

          {/* Footer Copyright inside Card */}
          <div className="text-center text-gray-400 text-[10px] mt-4 pt-3 border-t border-gray-50 leading-relaxed">
            <p>© 2025 Health Monitoring System for Child Malnutrition Cases</p>
            <p>All rights reserved.</p>
          </div>

        </div>
      </div>

      {/* Footer Feature Info Cards Grid */}
      <div className="w-full max-w-6xl mt-4 mb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {footerCards.map((card, idx) => (
            <div key={idx} className="bg-white border border-gray-100/80 rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#2E7D32]">
                <card.icon className="h-4.5 w-4.5" />
              </div>
              <div className="text-left text-xs leading-tight">
                <p className="font-extrabold text-gray-800">{card.title}</p>
                <p className="text-gray-500 font-medium">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}
