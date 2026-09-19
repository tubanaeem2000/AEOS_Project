"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ListChecks, AlertTriangle } from "lucide-react";
import Card from "@/components/ui/Card";
import MetricCard from "@/components/ui/MetricCard";
import Badge from "@/components/ui/Badge";
import RequireAuth from "@/components/RequireAuth";
import { getAgentStats, AgentStats } from "@/lib/stats";
import { toFrontendSlug } from "@/lib/agents";

function ObservabilityPageContent() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentStats[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAgentStats()
      .then((data) => setAgents(data))
      .catch((e) => setError(e.message || "Failed to load agent stats"))
      .finally(() => setLoaded(true));
  }, []);

  const online = agents.filter((a) => a.status === "online").length;
  const totalTasks = agents.reduce((sum, a) => sum + a.tasks_today, 0);

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Monitoring</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Agent Observability</h1>
      </div>

      {error && (
        <Card className="p-4 mb-6 text-sm" style={{ color: "var(--warning)" }}>
          Couldn&apos;t load live data: {error}
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Agents Online" value={`${online} / ${agents.length || 11}`} icon={Activity} accent="var(--success)" />
        <MetricCard label="Total Tasks Today" value={String(totalTasks)} icon={ListChecks} accent="var(--primary)" />
        <MetricCard
          label="Needs Review"
          value={String(agents.filter((a) => a.status === "review").length)}
          icon={AlertTriangle}
          accent="var(--warning)"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                <th className="px-5 py-3 font-medium">Agent</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Tasks Today</th>
                <th className="px-5 py-3 font-medium">Avg. Time</th>
                <th className="px-5 py-3 font-medium">Cost Today</th>
                <th className="px-5 py-3 font-medium">Error Rate</th>
              </tr>
            </thead>
            <tbody>
              {loaded && agents.length === 0 && !error && (
                <tr>
                  <td className="px-5 py-6 text-center" colSpan={6} style={{ color: "var(--text-secondary)" }}>
                    No agent activity recorded yet.
                  </td>
                </tr>
              )}
              {agents.map((agent) => (
                <tr
                  key={agent.slug}
                  onClick={() => router.push(`/agents/${toFrontendSlug(agent.slug)}`)}
                  className="cursor-pointer transition-colors hover:opacity-80"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{agent.name}</td>
                  <td className="px-5 py-3">
                    <Badge tone={agent.status === "online" ? "success" : "warning"}>
                      {agent.status === "online" ? "Online" : "Needs Review"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{agent.tasks_today}</td>
                  <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>
                    {agent.avg_latency_ms !== null ? `${(agent.avg_latency_ms / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>${agent.cost_today.toFixed(2)}</td>
                  <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{agent.error_rate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function ObservabilityPage() {
  return (
    <RequireAuth>
      <ObservabilityPageContent />
    </RequireAuth>
  );
}