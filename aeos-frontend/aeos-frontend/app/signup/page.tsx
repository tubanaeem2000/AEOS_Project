"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Building2, Eye, EyeOff, Loader2, Check } from "lucide-react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/lib/AuthContext";
import { AuthError } from "@/lib/auth";

function scorePassword(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const strengthLabels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const strengthColors = ["var(--danger)", "var(--danger)", "var(--warning)", "var(--primary)", "var(--success)"];

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const score = useMemo(() => scorePassword(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password || !confirm) {
      setError("Please fill in all required fields.");
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
    if (!agreed) {
      setError("Please accept the Terms & Conditions to continue.");
      return;
    }
    setLoading(true);
    try {
      // Note: "company" is collected for future use but not yet sent to
      // the backend — there is no company field on the Phase 1 users table.
      await signup(name, email, password);
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
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8 animate-fade-in-up">
          <div
            className="neural-ring w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
            data-glow="true"
            style={{ background: "var(--gradient-brand)", fontFamily: "var(--font-display)" }}
          >
            A
          </div>
          <span className="text-lg font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>AEOS</span>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Create your workspace
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Set up your enterprise AI operating system
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Full name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tuba Naeem" className="input-field w-full pl-9 pr-3 py-2.5 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Work email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="input-field w-full pl-9 pr-3 py-2.5 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Company (optional)</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." className="input-field w-full pl-9 pr-3 py-2.5 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="input-field w-full pl-9 pr-9 py-2.5 text-sm"
                />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="h-1 flex-1 rounded-full"
                        style={{ background: i < score ? strengthColors[score - 1] : "var(--border)" }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {strengthLabels[Math.max(score - 1, 0)]} &middot; use 8+ characters with upper/lowercase, a number and a symbol
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Confirm password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="input-field w-full pl-9 pr-9 py-2.5 text-sm"
                />
                {confirm && confirm === password && (
                  <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--success)" }} />
                )}
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 rounded" />
              I agree to the Terms & Conditions and Privacy Policy
            </label>

            {error && <p className="text-xs -mt-1" style={{ color: "var(--danger)" }}>{error}</p>}

            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Create account"}
            </Button>
          </form>

          <p className="text-xs text-center mt-6" style={{ color: "var(--text-muted)" }}>
            Already have a workspace?{" "}
            <Link href="/login" className="font-medium" style={{ color: "var(--primary)" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
