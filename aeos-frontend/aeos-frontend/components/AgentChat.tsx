"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getAccessToken } from "@/lib/auth";

type Message = {
  role: "user" | "agent";
  text: string;
  sources?: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Sirf yeh agents abhi real backend se connected hain.
// Naya agent backend mein banao toh yahan bhi uska slug + endpoint add kar dena.
const CONNECTED_AGENTS: Record<string, string> = {
  support: "/support-agent",
  hr: "/hr-agent",
  finance: "/finance-agent",
  sales: "/sales-agent",
  procurement: "/procurement-agent",
  legal: "/legal-agent",
  "cyber-security": "/cybersecurity-agent",
  marketing: "/marketing-agent",
  analytics: "/analytics-agent",
  compliance: "/compliance-agent",
  "cloud-ops": "/cloudops-agent",
};

export default function AgentChat({
  agentName,
  agentId,
}: {
  agentName: string;
  agentId?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "agent", text: `Hi, I'm the ${agentName}. How can I help you today?` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const endpoint = agentId ? CONNECTED_AGENTS[agentId] : undefined;

    if (!endpoint) {
      setLoading(true);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            text: `Got it — I'm processing your request: "${userMessage.text}". This is a demo response, real AI integration coming soon.`,
          },
        ]);
        setLoading(false);
      }, 700);
      return;
    }

    setLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: userMessage.text }),
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: "Sorry, I couldn't reach the server. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);
    try {
      const token = getAccessToken();
      const formData = new FormData();
      formData.append("file", file);
      // Tag the upload to this specific agent (derived from the existing
      // endpoint path, e.g. "/cybersecurity-agent" -> "cybersecurity") so
      // the 11 agents' uploaded knowledge stays separate, as intended -
      // if this agent isn't in the connected list for some reason, the
      // upload still goes through without a tag (visible to all agents,
      // same as before this change).
      const endpointPath = agentId ? CONNECTED_AGENTS[agentId] : undefined;
      const agentSlug = endpointPath?.replace(/^\//, "").replace(/-agent$/, "");
      if (agentSlug) formData.append("agent", agentSlug);

      const res = await fetch(`${API_URL}/rag/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Upload failed.");
      }

      setUploadStatus({ type: "success", message: data.message || `"${file.name}" was added to the knowledge base.` });
    } catch (err) {
      setUploadStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't reach the server. Please try again.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col h-80 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: "var(--surface)" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed"
              style={
                msg.role === "user"
                  ? { background: "var(--primary)", color: "#ffffff", borderBottomRightRadius: 4 }
                  : {
                      background: "var(--bg)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                      borderBottomLeftRadius: 4,
                    }
              }
            >
              {msg.role === "user" ? (
                msg.text
              ) : (
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                    li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                    h1: ({ node, ...props }) => <h1 className="text-base font-bold my-2" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-sm font-bold my-2" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-sm font-semibold my-1" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              )}
              {msg.role === "agent" && msg.sources && msg.sources.length > 0 && (
                <p
                  className="text-xs mt-1.5 pt-1.5"
                  style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}
                >
                  Sources used: {msg.sources.join(", ")}
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div
              className="max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm flex items-center gap-1.5"
              style={{ background: "var(--bg)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full neural-glow-dot" style={{ background: "var(--neon-cyan)", animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full neural-glow-dot" style={{ background: "var(--neon-violet)", animationDelay: "200ms" }} />
              <span className="w-1.5 h-1.5 rounded-full neural-glow-dot" style={{ background: "var(--neon-magenta)", animationDelay: "400ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {uploadStatus && (
        <div
          className="flex items-center gap-2 px-3 py-2 text-xs"
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
            color: uploadStatus.type === "success" ? "var(--success)" : "var(--danger)",
          }}
        >
          {uploadStatus.type === "success" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {uploadStatus.message}
        </div>
      )}

      <div className="flex items-center gap-2 p-3" style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.csv,.xlsx"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Upload a document to the knowledge base (PDF, DOCX, TXT, CSV, XLSX)"
          className="p-2 rounded-lg transition-colors shrink-0"
          style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={`Message ${agentName}...`}
          className="input-field flex-1 text-sm px-3 py-2"
        />
        <button
          onClick={handleSend}
          className="p-2 rounded-lg transition-colors"
          style={{ background: "var(--primary)", color: "#ffffff" }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}