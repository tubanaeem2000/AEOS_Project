"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { resetPassword, AuthError } from "@/lib/auth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing its token. Please use the link from your email.");
      return;
    }
    if (!password || !confirm) {
      setError("Please fill in both password fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else {
        setError("Couldn't reach the server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: "var(--primary)" }}>
            A
          </div>
          <span className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>AEOS</span>
        </div>

        <div className="card p-8">
          {done ? (
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--success-soft)" }}
              >
                <CheckCircle2 size={22} style={{ color: "var(--success)" }} />
              </div>
              <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Password reset
              </h1>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                Your password has been changed. You can now log in with your new password.
              </p>
              <Button onClick={() => router.push("/login")} className="w-full">
                Go to login
              </Button>
            </div>
          ) : !token ? (
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--danger-soft)" }}
              >
                <AlertCircle size={22} style={{ color: "var(--danger)" }} />
              </div>
              <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Invalid reset link
              </h1>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                This link is missing its reset token. Please request a new password reset email.
              </p>
              <Link href="/forgot-password" className="text-sm font-medium inline-flex items-center gap-1.5" style={{ color: "var(--primary)" }}>
                <ArrowLeft size={14} /> Request a new link
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Set a new password
              </h1>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                Choose a new password for your account.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                    New password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="input-field w-full pl-9 pr-9 py-2.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                    Confirm new password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter password"
                      className="input-field w-full pl-9 pr-3 py-2.5 text-sm"
                    />
                  </div>
                </div>

                {error && <p className="text-xs -mt-1" style={{ color: "var(--danger)" }}>{error}</p>}

                <Button type="submit" disabled={loading} className="w-full mt-1">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Reset password"}
                </Button>
              </form>

              <Link href="/login" className="text-xs font-medium mt-6 inline-flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <ArrowLeft size={13} /> Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
