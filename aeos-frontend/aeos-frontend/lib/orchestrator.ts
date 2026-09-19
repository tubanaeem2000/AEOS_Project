// Phase 1: orchestrator API client.
//
// Every call goes through /orchestrator/* on the FastAPI backend and
// requires a logged-in user (same bearer-token pattern as lib/auth.ts).
// This is the "task goes to the orchestrator first" path we decided on -
// direct per-agent chat (AgentChat.tsx) is the separate, simpler path for
// single-agent questions that don't need a DAG or a governance gate.

import { getAccessToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type WorkflowStatus =
  | "running"
  | "awaiting_approval"
  | "waiting_for_input"
  | "completed"
  | "rejected"
  | "failed";

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_approval"
  | "needs_info"
  | "rejected";

export type WorkflowStep = {
  id: number;
  step_index: number;
  agent_slug: string;
  agent_name: string;
  input_text: string;
  output_text: string | null;
  status: StepStatus;
};

export type WorkflowRun = {
  id: number;
  description: string;
  status: WorkflowStatus;
  risk_level: "low" | "high";
  risk_reason: string | null;
  steps: WorkflowStep[];
};

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
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

export function submitTask(description: string): Promise<WorkflowRun> {
  return authedFetch("/orchestrator/tasks", {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}

export function listTasks(): Promise<WorkflowRun[]> {
  return authedFetch("/orchestrator/tasks");
}

export function getTask(id: number): Promise<WorkflowRun> {
  return authedFetch(`/orchestrator/tasks/${id}`);
}

export function approveTask(id: number): Promise<WorkflowRun> {
  return authedFetch(`/orchestrator/tasks/${id}/approve`, { method: "POST" });
}

export function rejectTask(id: number): Promise<WorkflowRun> {
  return authedFetch(`/orchestrator/tasks/${id}/reject`, { method: "POST" });
}

export function provideTaskInfo(id: number, info: string): Promise<WorkflowRun> {
  return authedFetch(`/orchestrator/tasks/${id}/provide-info`, {
    method: "POST",
    body: JSON.stringify({ info }),
  });
}



