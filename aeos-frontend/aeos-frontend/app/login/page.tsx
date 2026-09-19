"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/lib/AuthContext";
import { AuthError } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
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
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Left brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none dark:opacity-100 opacity-0"
          style={{
            background:
              "radial-gradient(ellipse 600px 500px at 20% 15%, rgba(140,107,255,0.22), transparent 60%), radial-gradient(ellipse 500px 450px at 90% 85%, rgba(43,241,214,0.14), transparent 55%)",
          }}
        />
        <div className="flex items-center gap-2.5 relative">
          <div
            className="neural-ring w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
            data-glow="true"
            style={{ background: "var(--gradient-brand)", fontFamily: "var(--font-display)" }}
          >
            A
          </div>
          <span className="text-lg font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>AEOS</span>
        </div>

        <div className="relative animate-fade-in-up">
          <h1
            className="text-4xl font-bold leading-tight mb-4 gradient-text"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your enterprise.
            <br />
            Powered by intelligent agents.
          </h1>
          <p className="text-sm max-w-sm" style={{ color: "var(--text-secondary)" }}>
            11 specialized AI agents collaborate through a single orchestration layer to run
            finance, legal, compliance, security and more — with humans in the loop where it matters.
          </p>
        </div>

        <p className="text-xs relative" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          Enterprise AI Operating System &middot; v1.0
        </p>
      </div>

      {/* Right auth card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div
              className="neural-ring w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
              data-glow="true"
              style={{ background: "var(--gradient-brand)", fontFamily: "var(--font-display)" }}
            >
              A
            </div>
            <span className="text-lg font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>AEOS</span>
          </div>

          <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            Welcome back
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Sign in to your enterprise workspace
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-field w-full pl-9 pr-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-medium" style={{ color: "var(--primary)" }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field w-full pl-9 pr-9 py-2.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded"
              />
              Remember me for 30 days
            </label>

            {error && (
              <p className="text-xs -mt-1" style={{ color: "var(--danger)" }}>{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="text-xs text-center mt-6" style={{ color: "var(--text-muted)" }}>
            Don&apos;t have a workspace?{" "}
            <Link href="/signup" className="font-medium" style={{ color: "var(--primary)" }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
