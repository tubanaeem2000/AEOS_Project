"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/theme";

const options = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "System" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-lg"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            title={opt.label}
            aria-label={`Use ${opt.label} theme`}
            className="p-1.5 rounded-md transition-colors"
            style={{
              background: active ? "var(--bg)" : "transparent",
              color: active ? "var(--primary)" : "var(--text-muted)",
              boxShadow: active ? "var(--shadow-sm)" : "none",
            }}
          >
            <Icon size={14} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
