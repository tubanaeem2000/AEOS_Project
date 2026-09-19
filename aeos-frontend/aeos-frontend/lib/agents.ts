export type Agent = {
  slug: string;
  name: string;
  icon: string;
  description: string;
  status: "online" | "review";
  tasksToday: number;
  activity: string[];
};
export const FRONTEND_TO_BACKEND_SLUG: Record<string, string> = {
  "cyber-security": "cybersecurity",
  "cloud-ops": "cloudops",
};

export const BACKEND_TO_FRONTEND_SLUG: Record<string, string> = {
  cybersecurity: "cyber-security",
  cloudops: "cloud-ops",
};

export function toBackendSlug(frontendSlug: string): string {
  return FRONTEND_TO_BACKEND_SLUG[frontendSlug] ?? frontendSlug;
}

export function toFrontendSlug(backendSlug: string): string {
  return BACKEND_TO_FRONTEND_SLUG[backendSlug] ?? backendSlug;
}
export const agentsData: Record<string, Agent> = {
  hr: {
    slug: "hr",
    name: "HR Agent",
    icon: "🧑‍💼",
    description: "Handles resume screening, interviews, onboarding and leave approvals.",
    status: "online",
    tasksToday: 32,
    activity: [
      "Screened 8 new resumes for Backend Developer role",
      "Scheduled 3 interviews for tomorrow",
      "Approved 2 leave requests",
    ],
  },
  finance: {
    slug: "finance",
    name: "Finance Agent",
    icon: "💰",
    description: "Processes invoices, budgets, forecasting and fraud detection.",
    status: "online",
    tasksToday: 48,
    activity: [
      "Processed invoice #INV-2291 — $4,200",
      "Flagged 0 fraud indicators today",
      "Generated weekly financial report",
    ],
  },
  sales: {
    slug: "sales",
    name: "Sales Agent",
    icon: "📈",
    description: "Qualifies leads, updates CRM and generates proposals.",
    status: "online",
    tasksToday: 40,
    activity: [
      "Qualified lead — Nexora Corp",
      "Sent proposal to Bright Retail",
      "Updated CRM for 12 accounts",
    ],
  },
  procurement: {
    slug: "procurement",
    name: "Procurement Agent",
    icon: "📦",
    description: "Handles vendor comparison, purchase requests and RFQs.",
    status: "online",
    tasksToday: 22,
    activity: [
      "Compared 3 vendor quotes for office supplies",
      "Auto-generated RFQ for cloud servers",
    ],
  },
  legal: {
    slug: "legal",
    name: "Legal Agent",
    icon: "⚖️",
    description: "Reviews contracts, checks risk and generates NDAs.",
    status: "review",
    tasksToday: 18,
    activity: [
      "Flagged risky clause in vendor contract — needs review",
      "Generated NDA for new partner onboarding",
    ],
  },
  "cyber-security": {
    slug: "cyber-security",
    name: "Cyber Security Agent",
    icon: "🛡️",
    description: "Monitors threats, vulnerabilities and phishing attempts.",
    status: "online",
    tasksToday: 27,
    activity: [
      "Completed weekly vulnerability scan",
      "Blocked 4 phishing attempts",
    ],
  },
  support: {
    slug: "support",
    name: "Customer Support Agent",
    icon: "🎧",
    description: "Handles tickets, chatbot queries and sentiment analysis.",
    status: "online",
    tasksToday: 55,
    activity: [
      "Resolved 40 tickets automatically",
      "Escalated 3 high-priority tickets to human agent",
    ],
  },
  marketing: {
    slug: "marketing",
    name: "Marketing Agent",
    icon: "📣",
    description: "Generates campaigns, social posts and SEO content.",
    status: "online",
    tasksToday: 30,
    activity: [
      "Published 2 social media posts",
      "Drafted email campaign for product launch",
    ],
  },
  analytics: {
    slug: "analytics",
    name: "Data Analytics Agent",
    icon: "📊",
    description: "Builds dashboards, predictive analytics and insights.",
    status: "online",
    tasksToday: 36,
    activity: [
      "Generated weekly KPI dashboard",
      "Identified revenue dip in Region 3",
    ],
  },
  compliance: {
    slug: "compliance",
    name: "Compliance Agent",
    icon: "📋",
    description: "Ensures ISO, GDPR, HIPAA compliance and audits.",
    status: "review",
    tasksToday: 15,
    activity: [
      "Weekly GDPR audit — 1 item needs review",
      "Verified internal policy compliance",
    ],
  },
  "cloud-ops": {
    slug: "cloud-ops",
    name: "Cloud Operations Agent",
    icon: "☁️",
    description: "Monitors cloud infra, cost and disaster recovery.",
    status: "online",
    tasksToday: 41,
    activity: [
      "Auto-scaled servers for traffic spike",
      "Verified nightly backup — success",
    ],
  },
};