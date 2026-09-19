import { getAccessToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type AgentStats = {
  slug: string;
  name: string;
  status: "online" | "review";
  tasks_today: number;
  tasks_total: number;
  avg_latency_ms: number | null;
  cost_today: number;
  error_rate: number;
};

export type ActivityItem = {
  agent_slug: string;
  agent_name: string;
  question: string;
  status: "success" | "failed";
  created_at: string;
};

export type DashboardStats = {
  active_agents: number;
  total_agents: number;
  tasks_today: number;
  pending_approvals: number;
  risk_score: "Low" | "Medium" | "High";
  high_risk_workflows_today: number;
  tasks_by_agent: { agent: string; tasks: number }[];
  tasks_last_14_days: { date: string; tasks: number }[];
  recent_activity: ActivityItem[];
};

async function authedFetch(path: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    let detail = "Something went wrong. Please try again.";
    try {
      const data = await res.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      // ignore - use default message
    }
    throw new Error(detail);
  }

  return res.json();
}

export function getDashboardStats(): Promise<DashboardStats> {
  return authedFetch("/stats/dashboard");
}

export function getAgentStats(): Promise<AgentStats[]> {
  return authedFetch("/stats/agents");
}

export function getAgentActivity(slug: string): Promise<ActivityItem[]> {
  return authedFetch(`/stats/agents/${slug}/activity`);
}