"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: "light" | "dark" | "system"; icon: React.ReactNode }[] = [
    { value: "light", icon: <Sun size={14} /> },
    { value: "dark", icon: <Moon size={14} /> },
    { value: "system", icon: <Monitor size={14} /> },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`p-1.5 rounded-md transition-colors ${
            theme === opt.value
              ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}