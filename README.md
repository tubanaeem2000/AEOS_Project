# AEOS Project

AEOS is an enterprise AI operations platform that combines a multi-agent AI workflow system, a dashboard, authentication, profile management, and RAG-based document search.

## Overview

This project includes:

- FastAPI backend for authentication, orchestration, stats, and document upload
- Next.js frontend for dashboard, agents, settings, and profile pages
- PostgreSQL-backed data models
- Gemini-powered AI agents
- FAISS-based retrieval for RAG workflows
- Role-based access control and admin approval flows

## Project Structure

```text
AEOS_2/
├── README.md
├── aeos_backened_profile_settings/
│   └── aeos_backened/
│       ├── auth_routes.py
│       ├── auth_utils.py
│       ├── database.py
│       ├── email_utils.py
│       ├── main.py
│       ├── models.py
│       ├── orchestrator.py
│       ├── orchestrator_routes.py
│       ├── requirements.txt
│       ├── schemas.py
│       ├── settings_routes.py
│       ├── stats_routes.py
│       ├── upload_routes.py
│       └── rag/
│           ├── ...
├── aeos-frontend/
│   └── aeos-frontend/
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── package.json
│       └── ...
```

## Tech Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- Recharts
- Lucide React

### Backend
- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT authentication
- Pydantic
- Google GenAI SDK

### AI / Search
- Google Gemini
- FAISS
- scikit-learn
- RAG document ingestion and retrieval

## Prerequisites

Before running the project, install:

- Python 3.11 or 3.12
- Node.js 20+
- PostgreSQL 16+
- Git

## Backend Setup

```powershell
cd aeos_backened_profile_settings\aeos_backened
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create a local `.env` file in this folder using the sample file `.env.example` and fill in your own values.

Run the backend:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:

- http://localhost:8000

## Frontend Setup

```powershell
cd aeos-frontend\aeos-frontend
npm install
npm run dev
```

The app will be available at:

- http://localhost:3000

## Environment Variables

Important: do not commit the real `.env` files. Use `.env.example` as a template.

### Backend `.env`
Required values include:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- SMTP settings for password reset email delivery

### Frontend `.env`
Usually includes:

- `NEXT_PUBLIC_API_URL`

## Features Included

- User signup/login
- JWT refresh flow
- Protected routes
- Profile editing and avatar upload
- Password change
- Forgot password and reset password flows
- Settings page with notification preferences
- Theme switching
- Dashboard analytics
- AI agent chat and orchestration
- Document upload and RAG indexing
- Admin approval flow for workflow tasks

## Notes

- Real secrets must stay local.
- `.env` files are intentionally ignored by Git.
- The repo is meant for local development unless production hardening is added later.

## GitHub Safety

This project intentionally keeps environment files local and uncommitted. Do not push real `.env` files to GitHub.

## License

This project is provided for development and learning use.
