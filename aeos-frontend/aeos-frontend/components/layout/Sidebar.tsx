"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  GitBranch,
  Users,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Scale,
  ShieldCheck,
  Headphones,
  Megaphone,
  BarChart3,
  ClipboardCheck,
  Cloud,
  FileText,
  Settings,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/lib/AuthContext";

const agents = [
  { name: "HR", path: "/agents/hr", icon: Users },
  { name: "Finance", path: "/agents/finance", icon: DollarSign },
  { name: "Sales", path: "/agents/sales", icon: TrendingUp },
  { name: "Procurement", path: "/agents/procurement", icon: ShoppingCart },
  { name: "Legal", path: "/agents/legal", icon: Scale },
  { name: "Cyber Security", path: "/agents/cyber-security", icon: ShieldCheck },
  { name: "Customer Support", path: "/agents/support", icon: Headphones },
  { name: "Marketing", path: "/agents/marketing", icon: Megaphone },
  { name: "Data Analytics", path: "/agents/analytics", icon: BarChart3 },
  { name: "Compliance", path: "/agents/compliance", icon: ClipboardCheck },
  { name: "Cloud Operations", path: "/agents/cloud-ops", icon: Cloud },
];

const mainNav = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Orchestrator", path: "/orchestrator", icon: GitBranch },
  { name: "Observability", path: "/observability", icon: Activity },
];

const systemNav = [
  { name: "Reports", path: "/reports", icon: FileText },
  { name: "Settings", path: "/settings", icon: Settings },
];

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
      style={{
        background: active ? "var(--primary-soft)" : "transparent",
        color: active ? "var(--primary)" : "var(--text-secondary)",
        fontWeight: active ? 600 : 500,
      }}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
          style={{ background: "var(--gradient-brand)" }}
        />
      )}
      <Icon size={16} strokeWidth={1.8} />
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const displayName = user?.name || "Guest";
  const displayEmail = user?.email || "";

  return (
    <aside
      className="w-64 h-screen flex flex-col fixed left-0 top-0 overflow-y-auto"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center gap-2.5 px-5 h-16 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="neural-ring w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
          data-glow="true"
          style={{ background: "var(--gradient-brand)", fontFamily: "var(--font-display)" }}
        >
          A
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            AEOS
          </p>
          <p className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
            Enterprise AI OS
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1">
        {mainNav.map((item) => (
          <NavLink key={item.path} href={item.path} icon={item.icon} label={item.name} active={pathname === item.path} />
        ))}

        <p
          className="mt-5 mb-1 text-[11px] font-semibold uppercase tracking-wider px-3"
          style={{ color: "var(--text-muted)" }}
        >
          AI Agents
        </p>

        {agents.map((agent) => (
          <NavLink
            key={agent.path}
            href={agent.path}
            icon={agent.icon}
            label={agent.name}
            active={pathname === agent.path}
          />
        ))}

        <p
          className="mt-5 mb-1 text-[11px] font-semibold uppercase tracking-wider px-3"
          style={{ color: "var(--text-muted)" }}
        >
          System
        </p>

        {systemNav.map((item) => (
          <NavLink key={item.path} href={item.path} icon={item.icon} label={item.name} active={pathname === item.path} />
        ))}
      </nav>

      <Link
        href="/profile"
        className="flex items-center gap-2.5 px-4 py-3 shrink-0 transition-colors hover:opacity-80"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <Avatar name={displayName} src={user?.avatar_url} size={32} />
        <div className="leading-tight min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {displayName}
          </p>
          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
            {displayEmail}
          </p>
        </div>
      </Link>
    </aside>
  );
}
