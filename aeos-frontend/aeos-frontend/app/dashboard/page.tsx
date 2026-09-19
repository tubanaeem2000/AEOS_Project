"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  Tooltip,
} from "recharts";
import { Activity, Users, ClipboardCheck, ShieldAlert } from "lucide-react";
import Card from "@/components/ui/Card";
import MetricCard from "@/components/ui/MetricCard";
import { useTheme } from "@/lib/theme";
import RequireAuth from "@/components/RequireAuth";
import { getDashboardStats, DashboardStats } from "@/lib/stats";
import { getUser } from "@/lib/auth";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function DashboardPageContent() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const axisColor = isDark ? "#9ca3af" : "#64748b";
  const gridStroke = isDark ? "#1f2937" : "#e2e8f0";
  const primary = isDark ? "#8b5cf6" : "#2563eb";
  const success = isDark ? "#10b981" : "#059669";
  const warning = isDark ? "#f59e0b" : "#d97706";

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const user = getUser();

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((e) => setError(e.message || "Failed to load dashboard data"));
  }, []);

  const riskAccent =
    stats?.risk_score === "High" ? warning : stats?.risk_score === "Medium" ? warning : success;

  const statusData = stats
    ? [
        { name: "Online", value: stats.active_agents, color: success },
        { name: "Needs Review", value: Math.max(stats.total_agents - stats.active_agents, 0), color: warning },
      ]
    : [];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Dashboard</p>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
            Good morning{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Here&apos;s what&apos;s happening across your organization.
          </p>
        </div>
      </div>

      {error && (
        <Card className="p-4 mb-6 text-sm" style={{ color: "var(--warning)" }}>
          Couldn&apos;t load live data: {error}
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Active Agents"
          value={stats ? `${stats.active_agents} / ${stats.total_agents}` : "—"}
          change={stats ? (stats.active_agents === stats.total_agents ? "All online" : "Some need review") : "Loading..."}
          icon={Users}
          accent={success}
        />
        <MetricCard
          label="Tasks Today"
          value={stats ? String(stats.tasks_today) : "—"}
          change="Across all agents"
          icon={Activity}
          accent={primary}
        />
        <MetricCard
          label="Pending Approvals"
          value={stats ? String(stats.pending_approvals) : "—"}
          change="Needs review"
          icon={ClipboardCheck}
          accent={warning}
        />
        <MetricCard
          label="Risk Score"
          value={stats?.risk_score ?? "—"}
          change={stats ? `${stats.high_risk_workflows_today} high-risk task(s) today` : "Loading..."}
          icon={ShieldAlert}
          accent={riskAccent}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-5">
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Tasks — Last 14 Days
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats?.tasks_last_14_days ?? []}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: `1px solid ${gridStroke}`, borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="tasks" stroke={primary} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 flex flex-col items-center">
          <p className="text-sm font-semibold mb-2 self-start" style={{ color: "var(--text-primary)" }}>
            Agent Status
          </p>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={statusData} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={3}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--surface)", border: `1px solid ${gridStroke}`, borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: success }} /> Online
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: warning }} /> Review
            </span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 mb-6">
        <Card className="p-5">
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Tasks Today by Agent
          </p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={stats?.tasks_by_agent ?? []}>
              <XAxis dataKey="agent" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: `1px solid ${gridStroke}`, borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="tasks" fill={primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Recent Activity
        </p>
        <div className="space-y-1">
          {(stats?.recent_activity ?? []).length === 0 && (
            <p className="text-sm py-2" style={{ color: "var(--text-secondary)" }}>
              {stats ? "No agent activity yet." : "Loading..."}
            </p>
          )}
          {(stats?.recent_activity ?? []).map((item, i, arr) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5"
              style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: item.status === "failed" ? warning : primary }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {item.agent_name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                    {item.question}
                  </p>
                </div>
              </div>
              <p className="text-xs shrink-0 ml-3" style={{ color: "var(--text-muted)" }}>
                {timeAgo(item.created_at)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardPageContent />
    </RequireAuth>
  );
}