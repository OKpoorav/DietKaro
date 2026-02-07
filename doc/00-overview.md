# DietKaro - Complete Implementation Roadmap

**Generated:** February 7, 2026
**Overall Score:** 6/10 - Functional Foundation, Needs Completion
**Total Estimated Effort:** ~40 days for fully launch-ready MVP

---

## Module Index

### Architecture & Quality (Modules 01-04, 08)

| # | Module | Priority | Effort | Score | Focus |
|---|--------|----------|--------|-------|-------|
| [01](01-backend-architecture.md) | Backend Architecture | P0 | 5-6 days | 5/10 | Extract service layer, fix fat controllers, DRY violations |
| [02](02-frontend-dashboard.md) | Frontend Dashboard Refactor | P1 | 3-4 days | 6/10 | Refactor 830-line page, extract components, remove dead code |
| [03](03-mobile-app.md) | Mobile App Quality | P1 | 3-4 days | 7/10 | Type safety, error handling, shared theme, reusable components |
| [04](04-database-schema.md) | Database Schema | P1 | 1-2 days | 9/10 | Soft deletes, compound indexes, missing models |
| [08](08-code-quality-testing.md) | Code Quality & Testing | P2 | 3-5 days | 3/10 | Tests (0% coverage), config extraction, TypeScript strictness |

### Core Feature Completion (Modules 05-07)

| # | Module | Priority | Effort | Score | Focus |
|---|--------|----------|--------|-------|-------|
| [05](05-food-validation-engine.md) | Food Validation Engine | P0 | 2-3 days | 7/10 | Complete missing rules (#7, #8), make configurable |
| [06](06-compliance-service.md) | Compliance Service | P0 | 2-3 days | 4/10 | Complete scoring, auto-triggers, API endpoints |
| [07](07-onboarding-flow.md) | Onboarding Flow | P0 | 2-3 days | 6/10 | Create Step 6, verify all steps save correctly |

### Feature Completion for Launch (Modules 09-12)

| # | Module | Priority | Effort | Score | Focus |
|---|--------|----------|--------|-------|-------|
| [09](09-notifications-push.md) | Notifications & Push | P1 | 3 days | 30% | Real push via Expo SDK, triggers, mobile integration |
| [10](10-session-notes-invoicing.md) | Session Notes, Invoicing, Activity Log | P2 | 4-5 days | 0% | CRUD for notes, invoices with PDF, audit trail |
| [11](11-mobile-screens-completion.md) | Mobile Screens Completion | P1 | 3-4 days | 65% | Notifications, progress chart, profile, offline |
| [12](12-dashboard-pages-completion.md) | Dashboard Pages & Deployment | P2 | 4-5 days | 65% | Analytics, settings, client detail tabs, Docker |

---

## Priority Execution Order

### Phase 1: P0 Critical (Weeks 1-2) - Architecture + Core Features

These block the MVP and must be done first:

```
Week 1:
  Day 1-3: Module 01 - Backend service layer extraction (unblocks everything)
  Day 3-5: Module 05 - Complete validation engine rules

Week 2:
  Day 1-2: Module 06 - Compliance service completion
  Day 3-4: Module 07 - Onboarding flow (Step 6 + verification)
  Day 5:   Module 04 - Database schema fixes (soft deletes, indexes)
```

### Phase 2: P1 Important (Weeks 3-4) - Quality + Engagement Features

```
Week 3:
  Day 1-2: Module 02 - Frontend refactoring (830-line page split)
  Day 3-4: Module 03 - Mobile app quality (types, errors, theme)
  Day 5:   Module 09 - Notifications push integration (Expo SDK)

Week 4:
  Day 1-2: Module 09 - Notification triggers + mobile screen
  Day 3-5: Module 11 - Mobile screens completion (progress, profile, notifications)
```

### Phase 3: P2 Completeness (Weeks 5-6) - Professional Tools + Deploy

```
Week 5:
  Day 1-3: Module 10 - Session notes + invoicing
  Day 4-5: Module 12 - Analytics page + settings page

Week 6:
  Day 1-2: Module 12 - Client detail tabs + share/export + deployment
  Day 3-5: Module 08 - Testing, config extraction, linting
```

---

## Cross-Module Dependencies

```
Module 01 (Backend Services)
  ├── unblocks ──> Module 06 (Compliance auto-triggers)
  ├── unblocks ──> Module 05 (Validation in service layer)
  ├── unblocks ──> Module 10 (Session notes + invoice services)
  └── unblocks ──> Module 08 (Testable service layer)

Module 04 (Schema: ClientPreferences)
  └── required by ──> Module 07 (Onboarding Step 5)

Module 03 (Mobile Theme)
  ├── should do before ──> Module 07 (Onboarding screens)
  └── should do before ──> Module 11 (Mobile screens completion)

Module 06 (Compliance Service)
  └── provides data for ──> Module 11 (Progress screen adherence)

Module 09 (Notifications Backend)
  └── required by ──> Module 11 (Mobile notifications screen)

Module 10 (Session Notes + Invoicing)
  └── wired into ──> Module 12 (Client detail tabs, invoice page)
```

---

## SOLID Principles Summary

| Principle | Current State | Modules That Fix It |
|-----------|--------------|-------------------|
| **S** - Single Responsibility | VIOLATED - Fat controllers, monolith page | 01, 02 |
| **O** - Open/Closed | VIOLATED - Hardcoded business rules | 05, 06, 08 |
| **L** - Liskov Substitution | OK | - |
| **I** - Interface Segregation | MINOR - No service interfaces | 01 |
| **D** - Dependency Inversion | VIOLATED - Direct Prisma in controllers | 01 |

## DRY Violations Summary

| Violation | Where | Module That Fixes It |
|-----------|-------|---------------------|
| Nutrition calculation code | 3 controllers | 01 (shared utility) |
| Date filtering patterns | 5 controllers | 01 (query filter builder) |
| Org ID verification | 16 controllers | 01 (service layer) |
| `getInitials()` helper | 3 frontend pages | 02 (shared formatters) |
| `formatTimeAgo()` helper | 2 frontend pages | 02 (shared formatters) |
| Color/theme constants | 17 mobile screens | 03 (shared theme) |
| Card shadow styles | 4+ mobile components | 03 (Card component) |

---

## Feature Coverage Matrix

After completing all 12 modules, here's what's covered:

### PRD Features

| Feature | Module | Status After |
|---------|--------|-------------|
| Auth (Clerk + OTP) | Existing | Done |
| Client CRUD | 01 (service extraction) | Done |
| Diet Plan Builder | 02 (refactor) | Done |
| Food Validation | 05 | Done |
| Meal Logging | 01, 11 | Done |
| Meal Photo Review | Existing (reviews page 95%) | Done |
| Weight Tracking | 11 (chart), Existing | Done |
| Compliance/Adherence | 06 | Done |
| Push Notifications | 09 | Done |
| Session Notes (SOAP) | 10 | Done |
| Invoicing | 10 | Done |
| Activity Audit Log | 10 | Done |
| Analytics Dashboard | 12 | Done |
| PDF Reports/Export | 12 (share buttons) | Done |
| Email Integration | 09 (email fallback) | Done |
| Referral System | Existing (90%) | Done |
| Team Management | Existing (85%) | Done |
| Client Onboarding | 07 | Done |
| Deployment (Docker) | 12 | Done |

### NOT Covered (P3 / Post-MVP)

| Feature | Reason |
|---------|--------|
| AI Food Recognition | Post-MVP, different branch |
| AI/RAG Medical Extraction | Post-MVP, 3+ days |
| Redis Caching | Optimization, not MVP |
| Grocery List Generation | PRD Phase 2 |
| Video Consultations | PRD Phase 2 |
| Wearable Integration | PRD Phase 2 |
| Multi-language Support | PRD Phase 2 |
| Advanced Reporting | PRD Phase 2 |
| Expand Food Database (200+ items) | Content task, not dev |

---

## Quick Reference: Key Files to Modify

### Backend (most changes)
- `backend/src/controllers/*.ts` - All 16 controllers need slimming
- `backend/src/services/` - 6+ new services to create
- `backend/src/utils/` - 3 new utilities (nutrition, filters, response)
- `backend/src/config/` - New directory for extracted configuration
- `backend/src/jobs/` - New directory for scheduled jobs (meal reminders)
- `backend/prisma/schema.prisma` - Schema updates

### Frontend
- `frontend/src/app/dashboard/diet-plans/new/page.tsx` - Split into components
- `frontend/src/app/dashboard/analytics/page.tsx` - Real data integration
- `frontend/src/app/dashboard/settings/page.tsx` - Complete all sections
- `frontend/src/app/dashboard/clients/[id]/page.tsx` - Tab navigation
- `frontend/src/components/diet-plan/` - 6+ new components
- `frontend/src/lib/hooks/` - 5+ new hooks
- `frontend/src/lib/utils/formatters.ts` - New shared utilities
- `frontend/src/lib/api/client.ts` - Delete (dead code)

### Mobile App
- `client-app/constants/theme.ts` - Expand with full theme
- `client-app/services/api.ts` - Fix response types
- `client-app/types/index.ts` - Add missing types
- `client-app/app/(tabs)/notifications/index.tsx` - Replace mock data
- `client-app/app/(tabs)/progress/index.tsx` - Real chart
- `client-app/app/(tabs)/profile/index.tsx` - Fix hardcoded values
- `client-app/app/(onboarding)/step6.tsx` - New screen
- `client-app/hooks/useNotifications.ts` - New hook
- `client-app/components/` - 5+ new reusable components

### Deployment
- `docker-compose.yml` - New
- `backend/Dockerfile` - New
- `frontend/Dockerfile` - New
- `nginx/nginx.conf` - New
- `.env.example` - Complete variable documentation

---

## Effort Summary

| Phase | Modules | Days | Cumulative |
|-------|---------|------|------------|
| Phase 1 (P0) | 01, 04, 05, 06, 07 | ~12 days | 12 days |
| Phase 2 (P1) | 02, 03, 09, 11 | ~13 days | 25 days |
| Phase 3 (P2) | 08, 10, 12 | ~14 days | 39 days |
| **Total** | **12 modules** | **~39 days** | |

After all 12 modules: the app covers every PRD MVP feature, has clean architecture, and is deployment-ready.
