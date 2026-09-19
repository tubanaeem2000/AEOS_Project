# AEOS — Run Guide — Real Profile & Persistent Settings

Covers what changed. Everything else (dashboard, 11 agents, RAG, Orchestrator, RBAC,
reports, observability, UI design/layout/colors) is unchanged.

---

## 1. Prerequisites

Python 3.11/3.12, Node.js 20+, PostgreSQL 16.

## 2. Backend setup

```powershell
cd aeos_backened
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

No new dependencies were added. No new environment variables are required. All new
database columns/tables are created automatically the first time the backend starts —
verified against a real existing database with real existing accounts; nothing was lost.

## 3. Frontend setup

```powershell
cd aeos-frontend
npm install
npm run dev
```

Open `http://localhost:3000` (use `localhost`, not `127.0.0.1`).

---

## 4. What's now REAL on the Profile page

- **Name, Email, Phone, Department** — loaded from your actual logged-in account, editable,
  and saved to PostgreSQL via `PATCH /auth/me`. Changing email is validated for uniqueness
  (you can't take another account's email).
- **Profile photo** — a real upload (PNG/JPG/etc, under ~500KB), stored on your user record
  and shown everywhere your avatar already appeared (navbar, sidebar, profile card). "Remove"
  actually clears it. No fake "success" messages — a bad file or oversized image shows a real
  error.
- **Change password** — requires your current password, validates the new one (8+ characters,
  must match confirmation), and uses the exact same bcrypt hashing as everywhere else in the
  app. After changing it, your old password stops working immediately.

## 5. What's now REAL and persistent on the Settings page

- **Theme** (Light/Dark/System) — this was already fully persistent before this change
  (saved in your browser, survives refresh) — nothing needed to change here.
- **Notification toggles** (Email notifications, Agent alerts, Approval alerts, Security
  alerts) — each one saves to the database immediately when you flip it, reloads correctly
  when you open Settings again, and survives logout/login.
- **"Log out of all devices"** — this is a **real, working security feature**, not a fake
  button. It immediately invalidates every access and refresh token issued to your account
  so far — including the one you're using right now, so you'll be sent back to the login
  page. Logging back in afterward works completely normally and issues fresh, valid tokens.

## 6. What's honestly marked as NOT implemented

- **Two-factor authentication** — the toggle is visibly disabled with the label "Not
  available yet — coming in a future update." It does not pretend to turn on.
- **Active Sessions / "Manage"** — there's no real session-by-session tracking in this
  project's architecture. Instead of a fake "1 device currently signed in" number, the UI
  honestly explains this and points you at "Log out of all devices" as the real alternative
  if you need to revoke access.

---

## 7. Database changes

- `users` table: added `phone`, `department`, `avatar_url` (all optional/nullable — existing
  accounts are unaffected) and `token_version` (used only by "Log out of all devices")
- New `user_settings` table (one row per user, auto-created on first visit to Settings)

All additive — no existing table, column, or row was changed or removed.

---

## 8. How to test it yourself (matches the exact flow that was verified)

1. Sign up a new account, log in.
2. Open Profile — confirm it shows *your* real name/email, not a placeholder.
3. Edit name/phone/department, click Save — confirm the green "Saved" message appears.
4. Refresh the page — confirm your changes are still there.
5. Log out, log back in — confirm your changes are still there.
6. Change your password (enter your current one + a new one twice) — confirm the success
   message, then log out and try logging in with the *old* password (should fail) and the
   *new* one (should work).
7. Open Settings, change the theme, refresh — confirm it stuck.
8. Toggle a notification preference off, refresh — confirm it stayed off. Log out/in — still
   off.
9. Click "Log out of all devices" — confirm you're sent to the login page, and that logging
   back in works normally afterward.

---

## 9. Files changed

**Backend:** `models.py`, `database.py`, `schemas.py`, `auth_utils.py`, `auth_routes.py`,
`main.py` (two lines, to register the new router), and one new file `settings_routes.py`.

**Frontend:** `app/profile/page.tsx`, `app/settings/page.tsx` (both rewritten with the exact
same layout/design, now wired to real data), `lib/auth.ts` (added API functions),
`lib/AuthContext.tsx` (added a `refreshUser()` helper so the navbar/sidebar update
immediately after a profile change), and one new file `lib/settings.ts`.

Nothing else was touched — not the dashboard, not any of the 11 agents, not RAG, not the
file upload system, not the Orchestrator, not RBAC, not Forgot Password, not Reports, not
Observability, not the sidebar/navbar/colors/layout.
