"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

/**
 * Wrap any page's content with this to require a logged-in user.
 * Redirects to /login if not authenticated. Shows nothing (or a
 * lightweight loading state) while the session check is in flight,
 * to avoid flashing protected content before the check completes.
 *
 * This is a client-side guard (checks localStorage-held tokens via
 * AuthContext). See RUN_GUIDE.md for the known limitation vs.
 * middleware/cookie-based server-side protection.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect effect above will kick in; render nothing in the meantime.
    return null;
  }

  return <>{children}</>;
}
