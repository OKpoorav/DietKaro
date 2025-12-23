# DietConnect PRD (Product Requirements Document)

**Version:** 1.0.0  
**Date:** December 7, 2025  
**Status:** Ready for Development  
**Team:** Poorav (PM/Tech Lead)

---

## Executive Summary

**DietConnect** is a **B2B SaaS platform** connecting dietitians with clients for personalized nutrition management. Dietitians create custom meal plans, clients log meals with photos, and dietitians provide real-time feedback. Built on self-hosted infrastructure for complete data control and cost efficiency.

**Target Users:** Nutrition clinics, private practice dietitians, wellness centers in India

**Launch Timeline:** 3-4 weeks (MVP)

---

## 1. Vision & Goals

### Product Vision
Enable dietitians to scale their practice by providing a digital platform for meal planning, client tracking, and real-time nutrition feedback.

### Success Metrics (Month 1-6)
- 50+ registered dietitians
- 500+ active clients
- 10,000+ meal logs per month
- 90%+ client retention (1-month)
- < 2 second API response time
- 99.5% uptime

---

## 2. Market & User Analysis

### Primary Users

#### **User Persona 1: Dietitian (Dashboard)**
- **Name:** Dr. Priya Sharma
- **Age:** 32
- **Experience:** 8+ years in nutrition
- **Pain Points:** 
  - Manual meal plan creation takes 2-3 hours per client
  - Can't track client adherence in real-time
  - Limited to email follow-ups
  - Managing 30+ clients manually is chaotic
- **Goals:**
  - Reduce plan creation time to 30 minutes
  - See client progress instantly
  - Send automated reminders
  - Scale to 100+ clients

#### **User Persona 2: Client (Mobile App)**
- **Name:** Sarah Sharma
- **Age:** 28
- **Goals:** Lose 10kg in 3 months
- **Pain Points:**
  - Forgets when to eat meals
  - Doesn't know if portions are correct
  - No feedback from dietitian
  - Gets demotivated easily
- **Goals:**
  - Easy meal logging (just take a photo)
  - Quick dietitian feedback
  - Track weight progress
  - Stay motivated with reminders

### Target Market Size
- **India:** ~50,000 professional dietitians
- **Addressable:** ~5,000 practicing dietitians with digital practice
- **Year 1 Goal:** 100-200 dietitians

---

## 3. Core Features (MVP)

### **Phase 1: MVP (Weeks 1-3)**

#### 3.1 Authentication & Onboarding

**Dietitian Registration**
- Email/password signup
- License number verification (optional for MVP)
- Organization setup
- Clinic profile creation

**Client Onboarding**
- OTP-based mobile login
- Medical history questionnaire (5-10 questions)
- Health goals setup
- Dietary preferences & allergies

---

#### 3.2 Dietitian Dashboard

##### A. Client Management
- **Client List View**
  - Name, age, goal, primary dietitian
  - Current weight vs target
  - Last interaction date
  - Status (active/paused/completed)
  - Search & filter by status, dietitian
  - Bulk actions (export, message)

- **Client Profile**
  - Demographics (DOB, height, weight, activity level)
  - Medical history (diagnoses, medications, allergies)
  - Emergency contact
  - Session notes history
  - Weight tracking graph
  - Body measurement history

- **Add Client**
  - Form: name, email, phone, DOB, height, weight, goal
  - Medical profile: conditions, medications, allergies
  - Primary dietitian assignment

##### B. Diet Plan Builder (Core Feature)
- **Three-column layout:**
  1. Left: Client info + medical history sidebar
  2. Center: Weekly meal grid (7 days × 4 meals)
  3. Right: Daily macro targets & current totals

- **Meal Creation**
  - Click any day/meal type to add meal
  - Type meal name (e.g., "Paneer Tikka + Rice")
  - Search & add food items from database
  - Adjust quantities via drag-handle
  - Auto-calculate nutrition
  - Add cooking instructions
  - Save as template option

- **Food Database Search**
  - Search by name, category, brand
  - Filter: vegetarian, vegan, high-protein, low-carb
  - Show nutrition per 100g
  - Option to create custom food items

- **Meal Plan Management**
  - Save as draft
  - Preview as client sees it
  - Publish (auto-generates meal logs for client)
  - Edit existing plans
  - Clone & modify previous plans
  - Save as template for reuse

- **Macro Targets**
  - Set daily targets: Calories, Protein, Carbs, Fats, Fiber
  - See current totals vs targets
  - Green (on target), Yellow (5-10% off), Red (>10% off)
  - Adjust meals to hit targets

##### C. Meal Log Review
- **Pending Photos**
  - List of photos awaiting review
  - Sorted by date (newest first)
  - Status: Pending → Reviewed
  
- **Review Interface**
  - Large photo display
  - Original meal details (name, planned nutrition)
  - Client's notes ("Used less oil today")
  - Quick feedback buttons:
    - ✅ Great job! (with optional custom message)
    - ⚠️ Good, but... (with custom feedback)
    - ❌ Off plan (with suggestion)
  - Save feedback → Notification sent to client

##### D. Client Progress
- **Weight Tracking**
  - Line graph: weight over time
  - Statistics: total loss, weekly average, trend
  - Comparison to target
  
- **Adherence Analytics**
  - % meals logged this week
  - % meals on-plan (eaten vs skipped)
  - Most logged meals (hit/miss)
  - Compliance score (0-100)

- **Session Notes**
  - Create SOAP notes (Subjective/Objective/Assessment/Plan)
  - Store notes linked to date
  - View history of all notes

##### E. Billing & Invoicing
- **Invoice Creation**
  - Manual invoice generation
  - Line items: consultation, meal plan, follow-up
  - Save as draft or send immediately
  - Email invoice to client
  - Track paid/unpaid status

---

#### 3.3 Client Mobile App (React Native)

##### A. Authentication
- **OTP Login**
  - Enter phone → Receive OTP → Verify → Logged in
  - Token stored securely (secure storage)
  - Auto-logout after 30 days inactivity

##### B. Today's Plan View
- **Home Screen**
  - Date header
  - Current meal streak counter
  - 4 meal cards:
    - Breakfast (8 AM)
    - Lunch (1 PM)
    - Snack (4 PM)
    - Dinner (8 PM)
  
  - Each card shows:
    - Meal name ("Besan Chilla + Curd")
    - Meal photo
    - Planned nutrition (calories, macros)
    - Instruction icon (collapsible)
    - Status: Pending → Logged → Reviewed
    - Dietitian feedback (if any)

##### C. Meal Logging
- **Log Meal Flow**
  1. Tap meal card
  2. Choose: Camera → Photo, Gallery → Photo, Or "Skipped" / "Substitute"
  3. If photo: Display photo, allow edit/crop
  4. Optional notes ("Used less oil", "Added extra salad")
  5. Tap "Log Meal" → Uploaded to server
  6. Show success → Return to home

- **Photo Upload**
  - Camera capture
  - Gallery pick
  - Compress to <2MB
  - Upload with progress indicator
  - Display thumbnail once uploaded

##### D. Weight Tracking
- **Weight Screen**
  - Weekly line graph (auto-scales)
  - Current weight vs target
  - Progress card: "3kg down, 7kg to go"
  - Quick log button
  - View full history

- **Log Weight**
  - Date picker
  - Weight input field
  - Optional notes
  - Show weight change from previous entry

##### E. Progress & Insights
- **Dashboard Tab**
  - Weekly adherence %
  - Weight trend (arrow: ↓ Good, ↑ Concerning)
  - Meal completion %
  - Calories burned vs consumed (if tracked)
  - Dietitian's message (latest feedback)

##### F. Notifications
- **Push Notifications**
  - Meal reminders (8 AM, 1 PM, 4 PM, 8 PM)
  - "Breakfast time! Log your meal"
  - Dietitian feedback ("Dr. Priya reviewed your lunch")
  - Weight check-in reminder (weekly)
  - Personalized motivation messages

---

### **Phase 2: Post-MVP (Week 4+) - NOT in MVP**

These are explicitly **excluded** from MVP to keep scope tight:

- ❌ AI food recognition
- ❌ Grocery list generation
- ❌ Prescription meal plans
- ❌ Video consultations
- ❌ Community features
- ❌ Advanced reporting
- ❌ Integration with wearables
- ❌ Multi-language support

---

## 4. Technical Architecture

### 4.1 Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Backend** | Node.js 18 + Express + TypeScript | Fast, scalable, type-safe |
| **Database** | PostgreSQL 14 (self-hosted) | ACID, RLS for multi-tenant |
| **ORM** | Prisma | Type-safe, migrations |
| **File Storage** | Disk storage (/var/uploads) | Self-hosted, simple |
| **Web Server** | Nginx (reverse proxy) | Load balancing, SSL |
| **Frontend** | Next.js 14 + Tailwind CSS | SSR, fast builds |
| **Mobile** | React Native (Expo) | Cross-platform MVP |
| **Notifications** | Postfix SMTP + Push (FCM) | Email & mobile alerts |
| **Monitoring** | Prometheus + Grafana | Server metrics |
| **Containerization** | Docker + Docker Compose | Local and server deployment |

### 4.2 Architecture Diagram

```
┌──────────────────────────────────────────┐
│        Client Machines                   │
├──────────────┬──────────────┬────────────┤
│  Web Browser │ Mobile App   │ Postman    │
│  (Dashboard) │ (React NA)   │ (Testing)  │
└──────────┬───┴──────────┬───┴────────────┘
           │              │
           └──────┬───────┘
                  │ HTTPS
        ┌─────────▼────────────┐
        │  Nginx (Port 443)    │
        │  Reverse Proxy       │
        └─────────┬────────────┘
                  │
      ┌───────────┼───────────┐
      │           │           │
      ▼           ▼           ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Backend │  │Frontend │  │ (Files) │
│ :3000   │  │ :3001   │  │Upload   │
└────┬────┘  └─────────┘  │/uploads │
     │                    └─────────┘
     │ TCP
     ▼
┌──────────────────┐
│  PostgreSQL      │
│  Database        │
│  Port 5432       │
└──────────────────┘
```

### 4.3 Database Schema (18 Tables)
- Organizations
- Users (Dietitians/Admins)
- Clients
- DietPlans
- Meals
- MealFoodItems
- FoodItems
- MealLogs
- WeightLogs
- BodyMeasurements
- SessionNotes
- Notifications
- ActivityLogs
- Invoices
- MedicalProfiles
- (+ 2-3 junction/utility tables)

**All with:**
- UUID primary keys
- Soft deletes (deletedAt field)
- Timestamps (createdAt, updatedAt)
- Row-level security (multi-tenant isolation)

---

## 5. User Flows

### 5.1 Dietitian User Flow

```
1. SIGNUP
   Email → Verify → Organization setup → Profile → Dashboard

2. CREATE CLIENT
   Add client form → Medical history → Assign to self → Client invite link

3. CREATE DIET PLAN
   Select client → Set macros → Add meals → Search foods → 
   Adjust portions → Preview → Publish → Auto-generate meal logs

4. REVIEW MEAL LOGS
   See pending photos → View photo + client notes → 
   Give feedback → Notification sent to client

5. TRACK PROGRESS
   View client weight graph → View adherence % → 
   Session notes → Identify patterns
```

### 5.2 Client User Flow

```
1. SIGNUP
   OTP login → Medical history → Goals → Dietary prefs → Home

2. VIEW PLAN
   Open app → See today's meals → View meal details →
   See instructions → View dietitian's notes

3. LOG MEAL
   Tap meal → Take photo → Add notes → "Log meal" → 
   Upload → Wait for feedback

4. TRACK WEIGHT
   Progress tab → Log weight → See graph → Check trend

5. GET FEEDBACK
   Notification: "Dietitian reviewed your lunch" → 
   Tap → See feedback → Encouragement/adjustment
```

---

## 6. API Endpoints (V1)

### Summary: 45+ endpoints across 10 domains

| Domain | Endpoints | Priority |
|--------|-----------|----------|
| Auth | 4 | P0 |
| Organization | 2 | P0 |
| Users | 5 | P0 |
| Clients | 6 | P0 |
| Medical Profiles | 2 | P0 |
| Diet Plans | 8 | P0 |
| Meals | 6 | P0 |
| Food Items | 5 | P0 |
| Meal Logs | 6 | P0 |
| Weight Logs | 4 | P0 |
| Session Notes | 5 | P1 |
| Notifications | 3 | P1 |
| Activity Logs | 1 | P2 |
| Invoices | 5 | P2 |
| Body Measurements | 2 | P2 |

**Full API doc:** See attached `api-v1.md` (comprehensive)

---

## 7. Non-Functional Requirements

### 7.1 Performance
- API response time: < 2 seconds (p95)
- File upload: < 5 seconds (for 2MB photo)
- Database query: < 500ms
- Frontend load: < 3 seconds (First Contentful Paint)
- Mobile app load: < 2 seconds per screen

### 7.2 Scalability
- Support 10,000 concurrent users (Phase 2)
- 100,000 meal logs/month
- Store 50GB+ photos over 1 year
- Database: Can scale to 1M records per table

### 7.3 Security
- HTTPS/TLS for all traffic
- JWT tokens (1-hour expiry)
- Row-level security (tenant isolation)
- Password hashing (bcrypt)
- Rate limiting: 1000 req/hour per user
- Input validation on all endpoints
- CSRF protection
- SQL injection protection (Prisma parameterized queries)

### 7.4 Reliability
- 99.5% uptime target
- Database backups: Daily (7-day retention)
- Photo backups: Daily to external drive
- Error tracking: Sentry integration
- Health checks: Every 5 minutes
- Graceful error messages (no 500 errors)

### 7.5 Compliance
- GDPR-ready (data export/deletion)
- Data residency: India (self-hosted)
- Privacy policy: Clear consent for photo storage
- Medical data: Encrypted in transit & at rest

---

## 8. Success Criteria (MVP)

### Functional Success
- [ ] All 20 priority API endpoints working
- [ ] Dietitian can create full diet plan in < 5 minutes
- [ ] Client can log meal with photo in < 1 minute
- [ ] Photos upload & display correctly
- [ ] Weight tracking graph works smoothly
- [ ] Notifications send and display correctly
- [ ] No data loss on server restart

### Non-Functional Success
- [ ] API response time: < 2 sec average
- [ ] Mobile app: < 3 seconds cold start
- [ ] Dashboard: < 2 seconds page load
- [ ] Server uptime: 99%+ in week 1
- [ ] No security vulnerabilities (OWASP Top 10)

### User Success
- [ ] Dietitian can invite client (email works)
- [ ] Client receives invite and signs up via OTP
- [ ] Dietitian receives meal log photo
- [ ] Client receives dietitian feedback notification
- [ ] 10 internal testers can use app without bugs

---

## 9. Development Roadmap

### Week 1: Backend Foundation
- [ ] Prisma schema + migrations
- [ ] PostgreSQL setup
- [ ] Express server + middleware
- [ ] Auth endpoints (login, refresh)
- [ ] Organization endpoints
- [ ] User CRUD endpoints
- [ ] Client CRUD endpoints

**Deliverable:** 10 working API endpoints, testable in Postman

### Week 2: Core Features
- [ ] Diet plan CRUD endpoints
- [ ] Meal endpoints
- [ ] Food database endpoints
- [ ] Meal log endpoints
- [ ] Weight log endpoints
- [ ] File upload (disk storage)
- [ ] Notification system

**Deliverable:** 30+ working API endpoints

### Week 2-3: Frontend (Dashboard)
- [ ] Next.js project setup
- [ ] Login page
- [ ] Client list page
- [ ] Client detail page
- [ ] Diet plan builder (3-column layout)
- [ ] Meal log review page
- [ ] Weight tracking page

**Deliverable:** Fully functional dietitian dashboard

### Week 3-4: Mobile App
- [ ] React Native project setup
- [ ] OTP login
- [ ] Home/today's plan screen
- [ ] Meal logging (photo upload)
- [ ] Weight tracking
- [ ] Progress dashboard
- [ ] Notifications

**Deliverable:** Fully functional mobile app

### Week 4: Testing & Deployment
- [ ] API testing (Postman collection)
- [ ] Frontend testing (Cypress E2E)
- [ ] Mobile testing (iOS/Android)
- [ ] Security audit
- [ ] Deploy to self-hosted servers
- [ ] Docker setup
- [ ] Nginx SSL configuration

**Deliverable:** Live MVP at dietconnect.yourcompany.com

---

## 10. Deployment & Infrastructure

### 10.1 Self-Hosted Stack

```
Hardware: Your local servers
OS: Ubuntu 20.04 LTS
Docker: Version 24+
Disk: /var/uploads (for photos)
Database: PostgreSQL 14 (self-managed)
Backup: Daily (external drive)
```

### 10.2 Services

```
PostgreSQL     → Port 5432 (internal only)
Backend API    → Port 3000 (via Nginx)
Frontend       → Port 3001 (via Nginx)
Nginx          → Port 80, 443 (HTTPS)
Prometheus     → Port 9090 (internal)
Grafana        → Port 3100 (internal)
```

### 10.3 Docker Compose
Single file deploys everything:
```bash
docker-compose up -d
# Waits for all services
# Auto-migrations run
# All health checks pass
```

### 10.4 Backup Strategy
- **Database:** PostgreSQL dump daily → /backups/
- **Photos:** rsync to external NAS daily
- **Retention:** 30-day rotating backup
- **Recovery:** < 1 hour

---

## 11. Launch Plan

### Week 1-3: Internal Development
- Build MVP with your team
- Test with internal users (yourself + 2-3 testers)
- Fix critical bugs

### Week 4: Soft Launch
- 10-20 beta users (select dietitians)
- Gather feedback
- Fix issues

### Week 5: Official Launch
- Public website launch
- Marketing/outreach begins
- Support team ready

### Month 2-3: Growth
- Onboard 50+ dietitians
- Scale infrastructure if needed
- Plan Phase 2 features

---

## 12. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Data loss** | Critical | Daily backups, 30-day retention |
| **Security breach** | Critical | HTTPS, RLS, rate limiting, audit logs |
| **Server downtime** | High | Health checks, restart on crash, monitoring |
| **Photo upload fails** | Medium | Retry logic, queue system |
| **Client churn** | High | Great UX, quick feedback loops |
| **Compliance issues** | High | Privacy policy, data residency |
| **Scaling problems** | Medium | Load testing, optimize queries |

---

## 13. Success Metrics & KPIs

### Month 1-2
- 50+ registered dietitians
- 10+ meal plans created
- 0 critical bugs

### Month 3
- 100+ dietitians
- 1000+ clients onboarded
- 10,000+ meal logs
- < 0.1% error rate

### Month 6
- 200+ dietitians
- 2000+ active clients
- 30,000+ meal logs/month
- 90%+ client retention
- NPS > 50

---

## 14. Out of Scope (MVP)

**Explicitly NOT included:**

- ❌ Video consultations
- ❌ AI food recognition
- ❌ Grocery list generation
- ❌ Wearable integration (Fitbit, Apple Watch)
- ❌ Advanced reporting/analytics
- ❌ Multi-language support
- ❌ Payment processing (invoices manual)
- ❌ Third-party integrations
- ❌ Mobile app admin panel
- ❌ Advanced scheduling

**These are Phase 2+ features.**

---

## 15. Glossary & Definitions

| Term | Definition |
|------|-----------|
| **Dietitian** | Nutrition professional creating plans & reviewing logs |
| **Client** | End-user logging meals & tracking progress |
| **Meal Plan** | Weekly meal schedule with nutrition targets |
| **Meal Log** | Client's photo/record of eating a meal |
| **Session Note** | SOAP note documenting consultation |
| **Macro** | Macronutrient (protein, carbs, fats) |
| **Adherence** | % of planned meals client actually logged/ate |
| **MVP** | Minimum Viable Product (core features only) |

---

## 16. Approval & Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Manager | Poorav | Dec 7, 2025 | ✓ |
| Tech Lead | Poorav | Dec 7, 2025 | ✓ |
| Stakeholder | You | — | — |

---

## Appendix A: File Structure

```
DietConnect/
├── backend/
│   ├── src/
│   │   ├── index.ts (entry point)
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── .env
│   ├── Dockerfile
│   └── package.json
├── dashboard/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── (routes)/
│   ├── components/
│   ├── lib/
│   ├── .env.local
│   ├── Dockerfile
│   └── package.json
├── client-app/
│   ├── app/
│   ├── components/
│   ├── services/
│   ├── .env
│   ├── app.json
│   └── package.json
├── docker-compose.yml
├── nginx.conf
└── docs/
    ├── api-v1.md
    ├── deployment.md
    └── database-schema.md
```

---

## Appendix B: API Response Examples

### Successful Response
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Sarah Sharma",
    "email": "sarah@example.com"
  },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is already in use",
    "details": {
      "field": "email"
    }
  }
}
```

---

## Appendix C: Database Statistics (MVP)

| Table | Estimated Records | Storage (1 year) |
|-------|------------------|-----------------|
| Clients | 500 | 50 MB |
| Diet Plans | 2,000 | 100 MB |
| Meal Logs | 30,000 | 200 MB + 50GB photos |
| Weight Logs | 5,000 | 50 MB |
| Food Items | 10,000 | 50 MB |
| Session Notes | 5,000 | 100 MB |
| **TOTAL** | **~50,000** | **~50.5 GB** |

**Photos:** ~1.5 MB average × 30,000 = 45GB

---

## Appendix D: Environment Variables (All Services)

```bash
# PostgreSQL
DATABASE_URL="postgresql://user:pass@localhost:5432/dietconnect"

# Server
PORT=3000
NODE_ENV=production
JWT_SECRET="your-super-secret-key-min-32-chars"

# File Storage (local disk)
UPLOAD_DIR="/var/uploads/meal-logs"
UPLOAD_MAX_SIZE_MB=5

# Email (Postfix)
SMTP_HOST="localhost"
SMTP_PORT=25
SMTP_FROM="noreply@dietconnect.yourcompany.com"

# Frontend
NEXT_PUBLIC_API_URL="https://api.dietconnect.yourcompany.com/v1"
NEXT_PUBLIC_APP_URL="https://dietconnect.yourcompany.com"

# Mobile App
REACT_APP_API_URL="https://api.dietconnect.yourcompany.com/v1"
REACT_APP_APP_VERSION="1.0.0"

# Monitoring
PROMETHEUS_ENABLED=true
SENTRY_ENABLED=false  # Enable after MVP

# Backup
BACKUP_ENABLED=true
BACKUP_PATH="/backups"
BACKUP_RETENTION_DAYS=30
```

---

**END OF PRD**

This PRD is a **north star** for the next 3-4 weeks of development. Any questions or changes should be documented and versioned.

**Next Action:** Start Week 1 development with backend foundation setup.
