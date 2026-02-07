# Module 12: Dashboard Pages Completion & Deployment

**Priority:** P2
**Effort:** 4-5 days
**Impact:** Completes the dietitian-facing dashboard for production

---

## Current State

| Page | Completeness | Key Issue |
|------|-------------|-----------|
| Dashboard (home) | 85% | Stats from API, but some values may be stale |
| Clients list | 90% | Production-ready |
| Client detail `[id]` | 75% | Tab switching not implemented, missing sections |
| Diet plans list | 85% | Working |
| Diet plan detail `[id]` | 80% | Working, edit mode exists |
| Diet plan new | 60% | 830-line monolith (covered in Module 02) |
| Food library | 85% | Working |
| **Reviews** | **95%** | **Production-ready** |
| **Referrals** | **90%** | **Production-ready** |
| **Analytics** | **60%** | **Simulated data, no real API** |
| **Settings** | **60%** | **4 sections show "Coming Soon"** |
| **Team** | 85% | Working, invite flow exists |

---

## What Needs To Be Done

### 1. Complete Analytics Page

**File:** `frontend/src/app/dashboard/analytics/page.tsx`

**Current state:** 4 stat cards work, but adherence data is randomly generated (`80 + Math.floor(Math.random() * 15)`), and the weekly chart has no real data.

#### 1.1 Create Analytics Backend Endpoint

**Create:** `backend/src/controllers/analytics.controller.ts`
**Create:** `backend/src/routes/analytics.routes.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/analytics/overview` | Dashboard stats summary |
| GET | `/api/v1/analytics/adherence?period=weekly` | Adherence trend data |
| GET | `/api/v1/analytics/clients?metric=weight_change` | Client-level analytics |

**Overview endpoint should return:**
```json
{
  "totalClients": 45,
  "activeClients": 38,
  "activePlans": 32,
  "pendingReviews": 12,
  "averageAdherence": 78.5,
  "averageWeightChange": -1.8,
  "newClientsThisMonth": 5,
  "mealLogsThisWeek": 156
}
```

**Adherence endpoint should return:**
```json
{
  "period": "weekly",
  "data": [
    { "week": "2026-01-06", "adherence": 72 },
    { "week": "2026-01-13", "adherence": 75 },
    { "week": "2026-01-20", "adherence": 78 },
    { "week": "2026-01-27", "adherence": 81 }
  ],
  "trend": "improving"
}
```

#### 1.2 Create Analytics Hook

**Create:** `frontend/src/lib/hooks/use-analytics.ts`

```typescript
useAnalyticsOverview()    // Stats cards
useAdherenceTrend(period) // Chart data
useClientMetrics(metric)  // Client-level data
```

#### 1.3 Replace Simulated Data

Update `analytics/page.tsx`:
- Replace random adherence values with real API data
- Replace hardcoded weight loss with real aggregate
- Add a real chart library (recharts is already likely a dep with Next.js)
- Show real weekly adherence trend line chart
- Add date range picker for custom periods

#### 1.4 Add Analytics Sections

Expand the page with:
- **Client Performance Table**: Name, adherence %, weight change, last activity
- **Top Performing Clients**: Highest adherence this week
- **Clients Needing Attention**: Declining adherence, no logs in 3+ days
- **Meal Type Breakdown**: Which meals are most skipped (breakfast/lunch/dinner)

---

### 2. Complete Settings Page

**File:** `frontend/src/app/dashboard/settings/page.tsx`

**Current state:** Profile editing works. 4 sections show "Coming soon": Security, Language, Billing, Help.

#### 2.1 Security Section

Replace "Coming Soon" with:
- Password change (redirect to Clerk's password management)
- Two-factor authentication toggle (Clerk handles this)
- Active sessions list (Clerk provides this)

Since auth is via Clerk, most of this is linking to Clerk's hosted UI components.

#### 2.2 Organization Settings

Add a section for organization management (owner/admin only):
- Organization name, logo, description, contact info
- Timezone setting
- Subscription status display
- Uses existing `PATCH /organization` endpoint

#### 2.3 Notification Preferences

Current toggles exist but verify they save to the backend:
- Email notifications on/off
- Push notifications on/off
- Meal log alerts on/off
- Weekly summary on/off

#### 2.4 Billing Section (Owner Only)

- Show current subscription tier and status
- Show expiry date
- Link to upgrade (can be a simple contact link for MVP)
- Uses existing `GET /organization/subscription` endpoint

#### 2.5 Help & Support

Replace "Coming Soon" with:
- Link to documentation
- Support email with prefilled subject
- App version info

---

### 3. Complete Client Detail Page

**File:** `frontend/src/app/dashboard/clients/[id]/page.tsx`

**Current state:** 279 lines. Tab buttons exist but no tab switching logic.

#### 3.1 Implement Tab Navigation

The page shows buttons for different sections but they don't switch content. Implement:

| Tab | Content | Data Source |
|-----|---------|-------------|
| **Overview** | Demographics, vitals, current plan | Client API |
| **Diet Plans** | List of all plans for this client | Diet Plans API |
| **Meal Logs** | Recent meal logs with photos | Meal Logs API |
| **Weight** | Weight chart + history | Weight Logs API |
| **Session Notes** | SOAP/DAP notes list | Session Notes API (Module 10) |
| **Activity** | Recent activity feed | Activity Logs API (Module 10) |

Use `useState` for active tab, render appropriate content component.

#### 3.2 Add Medical Summary Panel

On the right side or as a collapsible panel, show the client's medical summary:
- Allergies (red badges)
- Medical conditions
- Medications
- Diet pattern
- Food dislikes
- Lab-derived flags

This uses the `ClientRestrictionsSummary` component that already exists.

#### 3.3 Add Quick Actions

Add action buttons:
- "Create Diet Plan" -> navigate to diet-plans/new with client pre-selected
- "Log Weight" -> inline weight entry
- "Add Session Note" -> open note form modal

---

### 4. Add Medical Summary Sidebar to Diet Plan Builder

**Source:** remaining.md P1 item

**Where:** Diet plan creation page (after Module 02 refactoring)

**Create:** `frontend/src/components/diet-plan/medical-sidebar.tsx`

This sidebar should be always visible while creating a diet plan, showing:
- Client allergies with red badges
- Intolerances with yellow badges
- Medical conditions
- Current medications
- Diet pattern
- Food dislikes
- Lab alerts (if lab values exist)

The existing `ClientRestrictionsSummary` component covers most of this. Wire it into the diet plan builder's left panel.

---

### 5. Add Share/Export Functionality

**Backend already exists:** `share.controller.ts` has PDF, print, email, WhatsApp endpoints.

#### 5.1 Add Share Buttons to Diet Plan Detail

**File:** `frontend/src/app/dashboard/diet-plans/[id]/page.tsx`

Add action buttons:
- "Download PDF" -> `GET /diet-plans/:id/pdf` (downloads file)
- "Print" -> `GET /diet-plans/:id/print` (opens print-friendly page)
- "Email to Client" -> `POST /diet-plans/:id/email` (shows confirmation)
- "Share via WhatsApp" -> `GET /diet-plans/:id/share-link` (opens WhatsApp)

---

### 6. Deployment Setup

**Priority:** P2 (needed before launch, not before feature development)

#### 6.1 Docker Compose

**Create:** `docker-compose.yml` at project root

Services:
- `postgres` - Database
- `backend` - Node.js API
- `frontend` - Next.js dashboard
- `nginx` - Reverse proxy with SSL

#### 6.2 Backend Dockerfile

**Create:** `backend/Dockerfile`

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY prisma/ ./prisma/
RUN npx prisma generate
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

#### 6.3 Frontend Dockerfile

**Create:** `frontend/Dockerfile`

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["npm", "start"]
```

#### 6.4 Nginx Configuration

**Create:** `nginx/nginx.conf`

- Reverse proxy: `/api/*` -> backend:3000
- Reverse proxy: `/*` -> frontend:3001
- SSL termination with Let's Encrypt
- Gzip compression
- Static file caching headers
- Upload size limit (10MB for photos)

#### 6.5 Environment Files

**Create:** `.env.example` at root with all required variables documented.

Verify `backend/.env.example` has:
- DATABASE_URL
- CLERK_SECRET_KEY
- S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
- EXPO_ACCESS_TOKEN (for push notifications)

---

## Definition of Done

### Analytics
- [ ] Backend analytics endpoints created (overview, adherence, clients)
- [ ] Analytics hook created
- [ ] Real data replaces all simulated/random values
- [ ] Weekly adherence chart renders with real data
- [ ] Client performance table added
- [ ] "Needs attention" alert list added

### Settings
- [ ] Security section links to Clerk password/2FA management
- [ ] Organization settings section for owner/admin
- [ ] Notification preferences save to backend
- [ ] Billing section shows subscription info
- [ ] Help section has support email link

### Client Detail
- [ ] Tab navigation implemented (6 tabs)
- [ ] Each tab renders appropriate content
- [ ] Medical summary panel visible
- [ ] Quick action buttons (create plan, log weight, add note)

### Share/Export
- [ ] PDF download button on diet plan detail
- [ ] Print view button
- [ ] Email to client button with confirmation
- [ ] WhatsApp share link

### Deployment
- [ ] docker-compose.yml working with all services
- [ ] Backend Dockerfile tested
- [ ] Frontend Dockerfile tested
- [ ] Nginx configured with SSL
- [ ] All env vars documented in .env.example
