// Real API client for the persistent notification preferences on the
// existing Settings page. Theme is intentionally not handled here - it's
// already fully persisted client-side (see lib/theme.tsx).

import { getAccessToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type UserSettings = {
  email_notifications: boolean;
  agent_alerts: boolean;
  approval_alerts: boolean;
  security_alerts: boolean;
};

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    return "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export async function getSettings(): Promise<UserSettings> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/settings`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }

  return res.json();
}

export async function updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }

  return res.json();
}
