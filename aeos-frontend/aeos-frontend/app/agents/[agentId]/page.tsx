"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { agentsData, toBackendSlug } from "@/lib/agents";
import AgentChat from "@/components/AgentChat";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import RequireAuth from "@/components/RequireAuth";
import { getAgentStats, getAgentActivity, AgentStats, ActivityItem } from "@/lib/stats";

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

function AgentPageContent({ agentId }: { agentId: string }) {
  const agent = agentsData[agentId];
  const [liveStats, setLiveStats] = useState<AgentStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    if (!agent) return;
    const backendSlug = toBackendSlug(agent.slug);

    getAgentStats()
      .then((all) => setLiveStats(all.find((a) => a.slug === backendSlug) ?? null))
      .catch(() => setLiveStats(null));

    getAgentActivity(backendSlug)
      .then(setActivity)
      .catch(() => setActivity([]));
  }, [agent]);

  if (!agent) return notFound();

  const status = liveStats?.status ?? agent.status;
  const tasksToday = liveStats ? liveStats.tasks_today : agent.tasksToday;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
          style={{ background: "var(--surface)" }}
        >
          {agent.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{agent.name}</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{agent.description}</p>
        </div>
        <div className="ml-auto">
          <Badge tone={status === "online" ? "success" : "warning"}>
            {status === "online" ? "Online" : "Needs Review"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Tasks Today</p>
          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{tasksToday}</p>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Quick Action</p>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            Chat directly with this agent or review its recent activity below.
          </p>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Recent Activity</p>
        <div className="space-y-3">
          {activity === null && (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading...</p>
          )}
          {activity !== null && activity.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No activity recorded yet.</p>
          )}
          {activity?.map((item, i) => (
            <div key={i} className="flex gap-3 items-start justify-between text-sm" style={{ color: "var(--text-secondary)" }}>
              <div className="flex gap-3 items-start min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                  style={{ background: item.status === "failed" ? "var(--warning)" : "var(--text-muted)" }}
                />
                <span className="truncate">{item.question}</span>
              </div>
              <span className="text-xs shrink-0 ml-3" style={{ color: "var(--text-muted)" }}>
                {timeAgo(item.created_at)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          Talk to {agent.name}
        </p>
        <AgentChat agentName={agent.name} agentId={agent.slug} />
      </Card>
    </div>
  );
}

export default function AgentPage() {
  const params = useParams<{ agentId: string }>();
  return (
    <RequireAuth>
      <AgentPageContent agentId={params.agentId} />
    </RequireAuth>
  );
}