"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRoot() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main dashboard view
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">Loading dashboard...</p>
      </div>
    </div>
  );
}
