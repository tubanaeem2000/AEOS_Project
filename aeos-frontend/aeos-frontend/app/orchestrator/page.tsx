"use client";

import { useEffect, useState } from "react";
import {
  Users,
  DollarSign,
  Scale,
  ShoppingCart,
  ClipboardCheck,
  ShieldCheck,
  TrendingUp,
  Megaphone,
  BarChart3,
  Cloud,
  Headphones,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertCircle,
  Send,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/lib/AuthContext";
import {
  submitTask,
  listTasks,
  approveTask,
  rejectTask,
  provideTaskInfo,
  type WorkflowRun,
} from "@/lib/orchestrator";

const AGENT_ICONS: Record<string, any> = {
  hr: Users,
  finance: DollarSign,
  sales: TrendingUp,
  procurement: ShoppingCart,
  legal: Scale,
  cybersecurity: ShieldCheck,
  marketing: Megaphone,
  analytics: BarChart3,
  compliance: ClipboardCheck,
  cloudops: Cloud,
  support: Headphones,
};

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "primary";

function statusTone(status: WorkflowRun["status"]): BadgeTone {
  switch (status) {
    case "completed":
      return "success";
    case "rejected":
    case "failed":
      return "danger";
    case "awaiting_approval":
    case "waiting_for_input":
      return "warning";
    default:
      return "primary";
  }
}

function statusLabel(status: WorkflowRun["status"]) {
  return {
    running: "Running",
    awaiting_approval: "Awaiting Approval",
    waiting_for_input: "Needs Info",
    completed: "Completed",
    rejected: "Rejected",
    failed: "Failed",
  }[status] || status;
}

function getStepChartData(steps: { status: string }[]) {
  const counts: Record<string, number> = {};
  steps.forEach((s) => {
    counts[s.status] = (counts[s.status] || 0) + 1;
  });
  return [
    { name: "Completed", value: counts.completed || 0, color: "var(--success)" },
    { name: "In Progress", value: counts.running || 0, color: "var(--primary)" },
    { name: "Awaiting Approval", value: counts.awaiting_approval || 0, color: "var(--warning)" },
    { name: "Pending", value: counts.pending || 0, color: "var(--text-muted)" },
        { name: "Needs Info", value: counts.needs_info || 0, color: "var(--warning)" },
    { name: "Failed / Rejected", value: (counts.failed || 0) + (counts.rejected || 0), color: "var(--danger)" },
  ].filter((d) => d.value > 0);
}

function OrchestratorPageContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tasks, setTasks] = useState<WorkflowRun[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actingOn, setActingOn] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
    const [infoText, setInfoText] = useState("");
  const [providingInfo, setProvidingInfo] = useState(false);

  const refreshTasks = async () => {
    try {
      const data = await listTasks();
      setTasks(data);
      return data;
    } catch (e: any) {
      setError(e.message || "Could not load tasks");
      return [];
    } finally {
      setLoadingList(false);
    }
  };

 useEffect(() => {
    refreshTasks();
    const interval = setInterval(refreshTasks, 2500);
    return () => clearInterval(interval);
}, []);

  const handleSubmit = async () => {
    if (!description.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const wf = await submitTask(description.trim());
      setDescription("");
      const data = await refreshTasks();
      setSelectedId(wf.id);
      if (!data.find((t) => t.id === wf.id)) setTasks((prev) => [wf, ...prev]);
    } catch (e: any) {
      setError(e.message || "Failed to submit task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (id: number, decision: "approve" | "reject") => {
    setActingOn(id);
    setError(null);
    try {
      const fn = decision === "approve" ? approveTask : rejectTask;
      await fn(id);
      await refreshTasks();
    } catch (e: any) {
      setError(e.message || "Failed to record decision");
    } finally {
      setActingOn(null);
    }
  };

    const handleProvideInfo = async (id: number) => {
    if (!infoText.trim() || providingInfo) return;
    setProvidingInfo(true);
    setError(null);
    try {
      await provideTaskInfo(id, infoText.trim());
      setInfoText("");
      await refreshTasks();
    } catch (e: any) {
      setError(e.message || "Failed to submit info");
    } finally {
      setProvidingInfo(false);
    }
  };

  const selected = tasks.find((t) => t.id === selectedId) || tasks[0] || null;
  const pendingApprovals = tasks.filter((t) => t.status === "awaiting_approval");

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Orchestrator</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Workflow Tracker</h1>
      </div>

      {/* Submit a new task - this is the "goes to the orchestrator first" entry point */}
      <Card className="p-5 mb-6">
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          Submit a task
        </p>
        <div className="flex gap-2">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder='e.g. "Review and approve vendor invoice INV-2291 for $12,400 from Nexora Corp"'
            className="input-field flex-1 text-sm px-3 py-2"
            disabled={submitting}
          />
          <Button onClick={handleSubmit} disabled={submitting || !description.trim()}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? "Running..." : "Submit"}
          </Button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          The orchestrator plans which agents this needs, runs them in order, and pauses for your
          approval only if it detects a high-value or high-risk step.
        </p>
        {error && (
          <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>{error}</p>
        )}
      </Card>

      {/* Recent tasks list */}
      <Card className="p-5 mb-6">
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Recent tasks
        </p>
        {loadingList ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No tasks yet — submit one above to see the orchestrator plan and run it.
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className="w-full text-left flex items-center justify-between rounded-xl px-4 py-3 transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  background: selected?.id === t.id ? "var(--surface)" : "transparent",
                }}
              >
                <span className="text-sm truncate pr-3" style={{ color: "var(--text-primary)" }}>
                  #{t.id} — {t.description}
                </span>
                <Badge tone={statusTone(t.status)}>{statusLabel(t.status)}</Badge>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Selected workflow pipeline */}
      {selected && (
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Task #{selected.id} — {selected.description}
            </p>
            <Badge tone={statusTone(selected.status)}>{statusLabel(selected.status)}</Badge>
          </div>
          {selected.risk_level === "high" && (
            <p className="text-xs mb-6 flex items-center gap-1" style={{ color: "var(--warning)" }}>
              <AlertCircle size={12} /> High risk — {selected.risk_reason}
            </p>
          )}
          {selected.risk_level !== "high" && <div className="mb-6" />}
{(() => {
  const chartData = getStepChartData(selected.steps);
  const completedCount = selected.steps.filter((s) => s.status === "completed").length;
  return (
    <div className="flex items-center gap-6 mb-6 flex-wrap">
      <div className="relative w-28 h-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius={34}
              outerRadius={52}
              paddingAngle={3}
              strokeWidth={0}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
            {completedCount}/{selected.steps.length}
          </p>
          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>steps done</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {chartData.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span style={{ color: "var(--text-secondary)" }}>
              {d.name}: <span style={{ color: "var(--text-primary)" }}>{d.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
})()}
          <div className="flex items-start overflow-x-auto pb-1 pt-2">
            {selected.steps.map((step, i) => {
              const Icon = AGENT_ICONS[step.agent_slug] || ClipboardCheck;
              const isDone = step.status === "completed";
              const isRunning = step.status === "running";
              const isWaiting = step.status === "awaiting_approval";
              const isRejected = step.status === "rejected";
              const isFailed = step.status === "failed";
              const isPending = step.status === "pending";
              const isNeedsInfo = step.status === "needs_info";
              const connectorActive = isDone; // segment before this node already flowed

              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-none min-w-[112px] dag-step-enter">
                  <div className="flex flex-col items-center text-center w-28">
                    <div className="relative mb-2">
                      <span
                        className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center z-10"
                        style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                      >
                        {i + 1}
                      </span>
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${isRunning ? "dag-node-active" : ""}`}
                        style={{
                          background: isDone
                            ? "var(--success-soft)"
                            : isRunning
                            ? "var(--primary)"
                            : isWaiting || isNeedsInfo
                            ? "var(--warning)"
                            : isRejected || isFailed
                            ? "var(--danger)"
                            : "var(--surface)",
                          color: isDone
                            ? "var(--success)"
                            : isRunning || isWaiting || isRejected || isFailed
                            ? "#ffffff"
                            : "var(--text-muted)",
                          ["--pulse-color" as any]: "var(--primary)",
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 size={20} />
                        ) : isRunning ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : isWaiting ? (
                          <Clock size={18} />
                        ) : isRejected || isFailed ? (
                          <XCircle size={18} />
                        ) : (
                          <Icon size={18} strokeWidth={1.8} />
                        )}
                      </div>
                    </div>
                    <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {step.agent_name}
                    </p>
                    <p
                      className="text-[11px] mt-0.5 capitalize font-medium"
                      style={{
                        color: isRunning
                          ? "var(--primary)"
                          : isWaiting
                          ? "var(--warning)"
                          : isRejected || isFailed
                          ? "var(--danger)"
                          : "var(--text-muted)",
                      }}
                    >
                      {isPending ? "Queued" : step.status.replace("_", " ")}
                    </p>
                  </div>
                  {i < selected.steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 ${connectorActive ? "dag-connector-flow" : ""}`}
                      style={{
                        marginTop: -20,
                        background: connectorActive ? undefined : "var(--border)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed step-by-step timeline: what each agent was asked and what it returned */}
          <div className="mt-6 space-y-2">
            {selected.steps.map((step) => {
              const Icon = AGENT_ICONS[step.agent_slug] || ClipboardCheck;
              return (
                <details
                  key={step.id}
                  className="group rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border)" }}
                  open={step.status === "running" || step.status === "awaiting_approval" || step.status === "needs_info"}
                >
                  <summary
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none list-none"
                    style={{ background: "var(--surface)" }}
                  >
                    <Icon size={14} style={{ color: "var(--text-secondary)" }} />
                    <span className="text-xs font-medium flex-1" style={{ color: "var(--text-primary)" }}>
                      {step.agent_name}
                    </span>
                    <Badge tone={statusTone(step.status as any) as any} dot={false}>
                      {step.status.replace("_", " ")}
                    </Badge>
                  </summary>
                  <div className="px-4 py-3 text-xs space-y-2" style={{ background: "var(--bg)" }}>
                    <p style={{ color: "var(--text-muted)" }}>
                      <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Input: </span>
                      {step.input_text}
                    </p>
                    {step.output_text && (
                      <p style={{ color: "var(--text-secondary)" }}>
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>Output: </span>
                        {step.output_text}
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      )}
      {selected && selected.status === "waiting_for_input" && (
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} style={{ color: "var(--warning)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Agent needs more information
            </p>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            An agent paused the workflow and asked for details. Answer below to continue the chain.
          </p>
          {selected.steps
            .filter((s) => s.status === "needs_info")
            .map((s) => (
              <p
                key={s.id}
                className="text-xs mb-3 p-3 rounded-lg"
                style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
              >
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {s.agent_name}:{" "}
                </span>
                {s.output_text}
              </p>
            ))}
          <textarea
            value={infoText}
            onChange={(e) => setInfoText(e.target.value)}
            placeholder='e.g. "Vendor: ABC Supplies Ltd, PO: PO-2026-441, Invoice: INV-8891, Goods received in full, Budget: IT-OPS-200"'
            className="input-field w-full text-sm px-3 py-2 mb-3 min-h-[80px]"
            disabled={providingInfo}
          />
          <Button
            onClick={() => handleProvideInfo(selected.id)}
            disabled={providingInfo || !infoText.trim()}
          >
            {providingInfo ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {providingInfo ? "Submitting..." : "Submit info & continue"}
          </Button>
        </Card>
      )}
      {/* Pending human approvals - the governance gate */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle size={16} style={{ color: "var(--warning)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Awaiting your approval
          </p>
        </div>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          High-value or flagged tasks pause here before their final agent step runs.
        </p>

        {pendingApprovals.length === 0 ? (
          <div className="py-10 text-center">
            <Clock size={22} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No pending approvals right now.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl px-4 py-3 gap-3 flex-wrap"
                style={{ border: "1px solid var(--border)" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    #{t.id} — {t.description}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {t.risk_reason}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isAdmin ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={actingOn === t.id}
                        onClick={() => handleDecision(t.id, "reject")}
                        style={{ color: "var(--danger)" }}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={actingOn === t.id}
                        onClick={() => handleDecision(t.id, "approve")}
                        style={{ background: "var(--success)" }}
                      >
                        Approve
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Admin approval required
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function OrchestratorPage() {
  return (
    <RequireAuth>
      <OrchestratorPageContent />
    </RequireAuth>
  );
}
