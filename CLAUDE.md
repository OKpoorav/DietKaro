# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Run everything (backend + frontend + mobile):**
```bash
npm run dev          # from repo root — runs all three concurrently
```

**Individual apps:**
```bash
npm run dev:backend  # backend only (tsx watch, port 3001)
npm run dev:frontend # frontend only (Next.js, port 3001 override)
npm run dev:mobile   # Expo mobile app
```

**Backend:**
```bash
cd backend
npm run dev          # tsx watch src/server.ts
npm run build        # tsc
npm run test         # vitest run (excludes validationEngine.test.ts by default)
npm run test:watch   # vitest interactive
npm run test:coverage
```

**Database:**
```bash
cd backend
npx prisma migrate dev     # apply migrations
npx prisma studio          # GUI browser
npx prisma generate        # regenerate client after schema change
npx prisma db seed         # seed ingredients (seed-ingredients.ts)
```

**Infrastructure (local dev):**
```bash
docker-compose up -d       # starts Redis + MinIO (no Postgres — run separately)
```

## Architecture

DietKaro is a **dietitian SaaS platform** — three apps sharing one backend:

| App | Tech | Purpose |
|-----|------|---------|
| `backend/` | Express 5 + TypeScript + Prisma | API server |
| `frontend/` | Next.js 14 + Tailwind | Dietitian web dashboard |
| `client-app/` | Expo (React Native) | Patient mobile app |

### Backend structure (`backend/src/`)

```
server.ts          entry point — starts HTTP, Socket.io, BullMQ workers
app.ts             Express app — middleware stack, route mounting
config/env.ts      env validation — crashes at startup if required vars missing
routes/            one file per domain (dietPlan, mealLog, leads, etc.)
controllers/       thin layer — parse request, call service, send response
services/          business logic
  ai/              AI provider wrappers (OpenAI, Google AI via Vercel AI SDK)
  extraction/      file parsing (pdf.extractor, docx.extractor, csv.extractor)
jobs/
  queue.ts         BullMQ queue definitions + setupScheduledJobs()
  workers/         one worker per job type (document-processor, email-pdf,
                   unified-summary, meal-reminder, plan-expiry,
                   compliance-alert, lead-followup-reminder)
socket/            Socket.io setup + chat handlers
middleware/        auth (two kinds), rate limiter, upload, validation, error
```

### Two auth systems

**Dietitians/admins** use **Clerk** (`@clerk/express`):
- Middleware: `requireAuth` in `middleware/auth.middleware.ts`
- Attaches `req.user` + `req.organization` from Prisma after Clerk verification
- Routes under `routes/` (non-client routes)

**Patients/clients** use **custom JWT** (`CLIENT_JWT_SECRET`):
- Middleware: `requireClientAuth` in `middleware/clientAuth.middleware.ts`
- 15-min access token + 7-day refresh token (hashed with SHA-256 in DB)
- Routes under `client*.routes.ts` files

### Data model key entities

`Organization` → has many `User` (dietitians) + `Client` (patients)  
`Client` → has `DietPlan`, `MealLog`, `WeightLog`, `BodyMeasurement`, `ClientReport`  
`Lead` → CRM entity with `LeadSource`, `LeadStatus`, `Invitation`  
`Conversation` → chat between dietitian and client (real-time via Socket.io)

All entities are org-scoped — always filter by `orgId`.

### Background jobs (BullMQ + Redis)

Workers auto-start in `server.ts`. Queues defined in `jobs/queue.ts`:
- `document-processor` — parses uploaded PDFs/DOCX/CSV for lab reports
- `email-pdf` — generates and emails PDF reports
- `unified-summary` — AI-generated client summaries
- `meal-reminder` / `plan-expiry` / `compliance-alert` — scheduled notifications
- `lead-followup-reminder` — CRM follow-up reminders

### Real-time

Socket.io with Redis adapter (`@socket.io/redis-adapter`). Auth middleware in `socket/auth.middleware.ts` — uses the same Clerk token as HTTP. Chat handlers in `socket/chat.handlers.ts`.

### AI

Vercel AI SDK (`ai` package) with two providers configured in `services/ai/providers.ts`:
- OpenAI (default for chat/summaries)
- Google AI — Gemini (document extraction)

### Storage

Two S3 targets:
- **MinIO** (self-hosted, `S3_ENDPOINT`) — media uploads (profile photos, documents)
- **AWS S3** (`AWS_S3_BUCKET`) — generated reports/PDFs

### Frontend (`frontend/src/`)

Next.js App Router. `app/` pages:
- `dashboard/` — main dietitian UI (clients, diet plans, meal logs, analytics)
- `onboarding/` — org setup flow
- `join/` — invite acceptance
- `sign-in/` / `sign-up/` — Clerk auth pages

`lib/` — API client wrappers (axios + React Query). `middleware.ts` — Clerk auth guard.

### Mobile (`client-app/`)

Expo Router with file-based routing. Route groups:
- `(auth)/` — OTP login for clients (phone-based, no Clerk)
- `(onboarding)/` — first-time setup
- `(tabs)/` — main app: home, progress, meals, chat, notifications, profile, weight

`store/authStore.ts` — Zustand store for JWT tokens (access + refresh).  
`services/` — Socket.io client + API service.

## Environment variables

Required for backend (see `config/env.ts` for full list):
- `DATABASE_URL` — PostgreSQL
- `CLERK_SECRET_KEY` — Clerk backend key
- `CLIENT_JWT_SECRET` — sign patient JWT tokens (generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- `REDIS_URL` — required in production, defaults to `redis://localhost:6379`

Optional but needed for full functionality:
- `OPENAI_API_KEY` — AI chat/summaries
- `GOOGLE_AI_API_KEY` — document extraction
- `S3_ACCESS_KEY` / `S3_SECRET_KEY` — file uploads

## Testing

Tests use Vitest. `tests/setup.ts` runs before all tests. `validationEngine.test.ts` is excluded from the default run (run explicitly with `npx vitest run tests/validationEngine.test.ts`).

Test files live in `backend/src/**/*.test.ts` and `backend/tests/`.

## MCP Tools

This repo has a code-review-graph knowledge graph. Use graph tools before Grep/Glob/Read for exploration:
- `semantic_search_nodes` — find functions/classes by keyword
- `get_impact_radius` — blast radius before changing shared code
- `detect_changes` + `get_review_context` — for code review
- `query_graph` — trace callers/callees/imports
