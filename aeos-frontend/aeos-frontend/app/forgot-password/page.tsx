"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { forgotPassword, AuthError } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const message = await forgotPassword(email);
      // Note: we show the "check your email" screen regardless of whether
      // the account exists, by design (see backend) — this prevents this
      // form from being used to discover which emails have accounts.
      // A genuine send failure (e.g. SMTP misconfigured) throws instead
      // and is shown as an error below, not a fake success.
      setSuccessMessage(message);
      setSent(true);
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
          {sent ? (
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--success-soft)" }}
              >
                <CheckCircle2 size={22} style={{ color: "var(--success)" }} />
              </div>
              <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Check your email
              </h1>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                {successMessage.startsWith("Development reset link:")
                  ? "SMTP is not configured for local development. Use the reset link below."
                  : <>We sent a password reset link to <strong>{email}</strong>.</>}
              </p>
              {successMessage.startsWith("Development reset link:") && (
                <a
                  href={successMessage.replace("Development reset link: ", "")}
                  className="text-sm font-medium break-all block mb-6"
                  style={{ color: "var(--primary)" }}
                >
                  Open reset link
                </a>
              )}
              <Link href="/login" className="text-sm font-medium inline-flex items-center gap-1.5" style={{ color: "var(--primary)" }}>
                <ArrowLeft size={14} /> Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Forgot password?
              </h1>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                Enter your email and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

                {error && <p className="text-xs -mt-1" style={{ color: "var(--danger)" }}>{error}</p>}

                <Button type="submit" disabled={loading} className="w-full mt-1">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Send reset link"}
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
