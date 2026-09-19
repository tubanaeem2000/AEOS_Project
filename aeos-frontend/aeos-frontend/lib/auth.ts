// Phase 1: real authentication against the FastAPI backend.
//
// Tokens are stored in localStorage for simplicity. See RUN_GUIDE.md /
// the Phase 1 report for the known limitation and hardening note
// (httpOnly cookies would be a stronger option for a later phase).

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const ACCESS_TOKEN_KEY = "aeos-access-token";
const REFRESH_TOKEN_KEY = "aeos-refresh-token";
const USER_KEY = "aeos-user";

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  department?: string | null;
  avatar_url?: string | null;
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// --- Token storage ---
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function setAccessToken(accessToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// --- User storage (cached profile, not the source of truth for auth) ---
export function saveUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// --- API calls ---
async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      // FastAPI/Pydantic validation error array
      return data.detail.map((d: any) => d.msg).join(", ");
    }
    return "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export async function signup(name: string, email: string, password: string): Promise<User> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    throw new AuthError(await parseErrorDetail(res), res.status);
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  saveUser(data.user);
  return data.user;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new AuthError(await parseErrorDetail(res), res.status);
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  saveUser(data.user);
  return data.user;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    // Refresh token is invalid/expired — force logout.
    clearTokens();
    return null;
  }

  const data = await res.json();
  setAccessToken(data.access_token);
  return data.access_token;
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = getAccessToken();
  if (!token) return null;

  let res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    // Access token likely expired — try refreshing once.
    const newToken = await refreshAccessToken();
    if (!newToken) return null;
    res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
  }

  if (!res.ok) return null;

  const user = await res.json();
  saveUser(user);
  return user;
}

export function logoutUser() {
  clearTokens();
}

export async function forgotPassword(email: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    // Real failures (e.g. SMTP down) surface here — never silently
    // treated as success.
    throw new AuthError(await parseErrorDetail(res), res.status);
  }

  const data = await res.json();
  return data.message as string;
}

export async function resetPassword(token: string, newPassword: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });

  if (!res.ok) {
    throw new AuthError(await parseErrorDetail(res), res.status);
  }

  const data = await res.json();
  return data.message as string;
}

export async function updateProfile(updates: {
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
}): Promise<User> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    throw new AuthError(await parseErrorDetail(res), res.status);
  }

  const user = await res.json();
  saveUser(user);
  return user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<string> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

  if (!res.ok) {
    throw new AuthError(await parseErrorDetail(res), res.status);
  }

  const data = await res.json();
  return data.message as string;
}

export async function uploadAvatar(dataUrl: string): Promise<User> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/auth/avatar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ avatar_data_url: dataUrl }),
  });

  if (!res.ok) {
    throw new AuthError(await parseErrorDetail(res), res.status);
  }

  const user = await res.json();
  saveUser(user);
  return user;
}

export async function removeAvatar(): Promise<User> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/auth/avatar`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new AuthError(await parseErrorDetail(res), res.status);
  }

  const user = await res.json();
  saveUser(user);
  return user;
}

export async function logoutAllDevices(): Promise<string> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/auth/logout-all-devices`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new AuthError(await parseErrorDetail(res), res.status);
  }

  const data = await res.json();
  return data.message as string;
}
