"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, Monitor, Bell, ShieldCheck, LogOut, Loader2, CheckCircle2, XCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useTheme } from "@/lib/theme";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/lib/AuthContext";
import { logoutAllDevices, AuthError } from "@/lib/auth";
import { getSettings, updateSettings, UserSettings } from "@/lib/settings";

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{hint}</p>}
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className="w-10 h-6 rounded-full relative transition-colors shrink-0"
        style={{ background: checked ? "var(--primary)" : "var(--border)", opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
        aria-pressed={checked}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}

function SettingsPageContent() {
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [savingKey, setSavingKey] = useState<keyof UserSettings | null>(null);

  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => setLoadError("Couldn't load your saved preferences. Showing defaults."));
  }, []);

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "system" as const, icon: Monitor, label: "System" },
  ];

  const handleToggle = async (key: keyof UserSettings, value: boolean) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value }); // optimistic update
    setSavingKey(key);
    try {
      const updated = await updateSettings({ [key]: value });
      setSettings(updated);
    } catch {
      setSettings(previous); // revert on failure
    } finally {
      setSavingKey(null);
    }
  };

  const handleLogoutAllDevices = async () => {
    setLogoutMessage(null);
    setLoggingOutAll(true);
    try {
      const message = await logoutAllDevices();
      setLogoutMessage({ type: "success", text: message });
      // This session's own token is revoked too, so log out locally and
      // send the user to login, matching what just happened server-side.
      setTimeout(() => {
        logout();
        router.push("/login");
      }, 1200);
    } catch (err) {
      setLogoutMessage({ type: "error", text: err instanceof AuthError ? err.message : "Couldn't reach the server. Please try again." });
      setLoggingOutAll(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Account</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Settings</h1>
      </div>

      <Card className="p-6 mb-5">
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Appearance</p>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className="flex flex-col items-center gap-2 py-4 rounded-xl transition-colors"
                style={{
                  border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                  background: active ? "var(--primary-soft)" : "transparent",
                }}
              >
                <Icon size={18} style={{ color: active ? "var(--primary)" : "var(--text-secondary)" }} />
                <span className="text-xs font-medium" style={{ color: active ? "var(--primary)" : "var(--text-secondary)" }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={16} style={{ color: "var(--text-primary)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</p>
          {savingKey && <Loader2 size={13} className="animate-spin" style={{ color: "var(--text-muted)" }} />}
        </div>
        {loadError && (
          <p className="text-xs mb-2 flex items-center gap-1" style={{ color: "var(--danger)" }}>
            <XCircle size={12} /> {loadError}
          </p>
        )}
        <ToggleRow
          label="Email notifications"
          hint="Receive a daily digest by email"
          checked={settings?.email_notifications ?? true}
          onChange={(v) => handleToggle("email_notifications", v)}
          disabled={!settings}
        />
        <ToggleRow
          label="Agent alerts"
          hint="Get notified when an agent needs attention"
          checked={settings?.agent_alerts ?? true}
          onChange={(v) => handleToggle("agent_alerts", v)}
          disabled={!settings}
        />
        <ToggleRow
          label="Approval alerts"
          hint="Get notified when something needs your sign-off"
          checked={settings?.approval_alerts ?? true}
          onChange={(v) => handleToggle("approval_alerts", v)}
          disabled={!settings}
        />
        <ToggleRow
          label="Security alerts"
          hint="Critical security events"
          checked={settings?.security_alerts ?? true}
          onChange={(v) => handleToggle("security_alerts", v)}
          disabled={!settings}
        />
      </Card>

      <Card className="p-6 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} style={{ color: "var(--text-primary)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Security</p>
        </div>
        <ToggleRow
          label="Two-factor authentication"
          hint="Not available yet — coming in a future update"
          checked={false}
          onChange={() => {}}
          disabled
        />
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Active sessions</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Session-by-session management isn&apos;t available yet — use &quot;Log out of all devices&quot; below if you need to revoke access.
            </p>
          </div>
          <Button variant="secondary" size="sm" disabled>Manage</Button>
        </div>
      </Card>

      <Card className="p-6">
        <Button variant="danger" size="sm" onClick={handleLogoutAllDevices} disabled={loggingOutAll}>
          {loggingOutAll ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          Log out of all devices
        </Button>
        {logoutMessage && (
          <p
            className="text-xs mt-3 flex items-center gap-1.5"
            style={{ color: logoutMessage.type === "success" ? "var(--success)" : "var(--danger)" }}
          >
            {logoutMessage.type === "success" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {logoutMessage.text}
          </p>
        )}
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsPageContent />
    </RequireAuth>
  );
}
