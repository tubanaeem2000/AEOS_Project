"use client";

import { FileText } from "lucide-react";
import Card from "@/components/ui/Card";
import RequireAuth from "@/components/RequireAuth";

function ReportsPageContent() {
  return (
    <div>
      <div className="mb-6">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Monitoring</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Reports</h1>
      </div>
      <Card className="p-10 flex flex-col items-center text-center">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: "var(--primary-soft)" }}
        >
          <FileText size={20} style={{ color: "var(--primary)" }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Reports are coming soon
        </p>
        <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--text-secondary)" }}>
          Executive, financial, risk and compliance reports will appear here once connected
          to the AEOS backend.
        </p>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequireAuth>
      <ReportsPageContent />
    </RequireAuth>
  );
}
