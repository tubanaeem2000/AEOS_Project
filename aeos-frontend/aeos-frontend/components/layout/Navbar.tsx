"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, HelpCircle, ChevronDown, User, Settings, LogOut } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, logout } = useAuth();
  const displayName = user?.name || "Guest";
  const displayEmail = user?.email || "";

  const notifications = [
    { id: 1, title: "New AI report ready", text: "Finance summary is available for review." },
    { id: 2, title: "Approval needed", text: "Two workflows are waiting for your sign-off." },
    { id: 3, title: "System update", text: "All services are operating normally." },
  ];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header
      className="h-16 flex items-center justify-between px-6 ml-64 fixed top-0 right-0 left-0 z-20"
      style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="relative w-80">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="text"
          placeholder="Search agents, tasks, workflows..."
          className="input-field w-full pl-9 pr-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <span
          className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full mr-1"
          style={{ background: "var(--success-soft)", color: "var(--success)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
          All Systems Operational
        </span>

        <ThemeToggle />

        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setNotificationsOpen((o) => !o)}
            className="p-2 rounded-lg transition-colors relative"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Notifications"
          >
            <Bell size={17} strokeWidth={1.8} />
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--danger)" }}
            />
          </button>

          {notificationsOpen && (
            <div
              className="absolute right-0 mt-2 w-72 rounded-xl overflow-hidden card py-1.5"
              style={{ boxShadow: "var(--shadow-md)" }}
            >
              <div className="px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Notifications
                </p>
              </div>
              {notifications.map((item) => (
                <button
                  key={item.id}
                  className="w-full text-left px-3.5 py-2.5 transition-colors hover:opacity-80"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {item.text}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="p-2 rounded-lg transition-colors hidden sm:block"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Help"
        >
          <HelpCircle size={17} strokeWidth={1.8} />
        </button>

        <div className="relative ml-1" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg transition-colors"
            style={{ background: menuOpen ? "var(--surface)" : "transparent" }}
          >
            <Avatar name={displayName} src={user?.avatar_url} size={30} />
            <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-52 rounded-xl overflow-hidden card py-1.5"
              style={{ boxShadow: "var(--shadow-md)" }}
            >
              <div className="px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {displayName}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {displayEmail}
                </p>
              </div>
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:opacity-80"
                style={{ color: "var(--text-secondary)" }}
              >
                <User size={15} /> View Profile
              </Link>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:opacity-80"
                style={{ color: "var(--text-secondary)" }}
              >
                <Settings size={15} /> Settings
              </Link>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  router.push("/login");
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:opacity-80"
                style={{ color: "var(--danger)", borderTop: "1px solid var(--border)" }}
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
