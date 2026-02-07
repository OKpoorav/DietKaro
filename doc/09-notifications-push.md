# Module 9: Notifications & Push System

**Priority:** P1
**Effort:** 3 days
**Impact:** Core engagement loop - clients need reminders and feedback alerts

---

## Current State

| Component | Completeness | Status |
|-----------|-------------|--------|
| `notification.service.ts` | 30% | Push completely simulated - Expo SDK commented out |
| `notification.controller.ts` | 70% | DB operations work, client token registration stubbed (501) |
| `notification.routes.ts` | 100% | All 3 routes defined |
| Mobile notifications screen | 40% | 100% mock/hardcoded data, no API integration |
| Dashboard notifications | N/A | No notification bell/inbox for dietitians |

**Core problem:** The notification service logs to console instead of actually sending push notifications. The Expo Server SDK import is commented out with a TODO.

---

## What Needs To Be Done

### 1. Install and Integrate Expo Push Notifications

**File:** `backend/src/services/notification.service.ts`

#### 1.1 Install Expo Server SDK

```
cd backend && npm install expo-server-sdk
```

#### 1.2 Replace Simulated Push with Real Implementation

The service currently has:
- Line 3: `// TODO: import Expo from 'expo-server-sdk'` (commented out)
- Lines 81-89: Commented-out Expo push logic
- Line 96: Returns `"push_simulated"` status

**Replace with:**
- Uncomment and configure Expo SDK
- Implement actual push sending with proper error handling
- Handle invalid push tokens (remove from DB)
- Handle rate limiting from Expo servers
- Implement receipt checking for delivery confirmation

#### 1.3 Implement Retry Logic

Push notifications can fail transiently. Add:
- 3 retries with exponential backoff
- Dead letter queue for permanently failed notifications
- Update `deliveryStatus` to `failed` with error reason after all retries exhausted

---

### 2. Fix Client Token Registration

**File:** `backend/src/controllers/notification.controller.ts`

Line 39: `registerClientToken` currently returns 501 (Not Implemented).

**Implement:**
```
POST /api/v1/client/notifications/device-token
Body: { token: "ExponentPushToken[xxx]", platform: "ios" | "android" }

Logic:
1. Validate token format (must be ExponentPushToken[...])
2. Store/update in DB linked to clientId
3. Remove old tokens for this client (one device per client for MVP)
```

---

### 3. Define Notification Triggers

Create notification events that auto-fire across the app:

| Trigger | Recipient | Type | When |
|---------|-----------|------|------|
| Meal reminder | Client | `meal_reminder` | At scheduled meal time (8am, 1pm, 4pm, 8pm) |
| Dietitian reviewed meal | Client | `dietitian_feedback` | When dietitian submits feedback |
| Client uploaded photo | Dietitian | `photo_uploaded` | When client logs a meal with photo |
| Weight logged | Dietitian | `weight_logged` | When client logs weight |
| Plan published | Client | `plan_published` | When dietitian publishes a diet plan |
| Weekly check-in | Client | `weekly_checkin` | Every Monday morning |
| Streak milestone | Client | `achievement` | At 7, 14, 30 day meal logging streaks |

#### 3.1 Add Notification Triggers to Existing Controllers

| Controller | Method | Notification to Send |
|------------|--------|---------------------|
| `mealLog.controller.ts` | PATCH (review) | `dietitian_feedback` to client |
| `mealLog.controller.ts` | PATCH (log meal) | `photo_uploaded` to dietitian |
| `weightLog.controller.ts` | POST | `weight_logged` to dietitian |
| `dietPlan.controller.ts` | POST (publish) | `plan_published` to client |

Add at the end of each handler (after the main operation succeeds):
```typescript
await notificationService.send({
  recipientId: clientId,
  recipientType: 'client',
  orgId,
  type: 'dietitian_feedback',
  title: 'Dr. Priya reviewed your lunch',
  message: 'Great choice! Keep it up.',
  deepLink: `/meals/${mealLogId}`,
});
```

#### 3.2 Implement Scheduled Notifications (Meal Reminders)

**Create:** `backend/src/jobs/mealReminder.job.ts`

This needs a job scheduler (e.g., `node-cron` or `bull` queue):
- Run every hour
- Query MealLogs where `scheduledTime` is within the next hour and status is `pending`
- Send push reminder to client: "Breakfast time! Log your meal"
- Don't resend if already reminded (track `reminderSentAt` or use a flag)

For MVP, a simple `setInterval` or `node-cron` is sufficient. No need for Redis/Bull yet.

---

### 4. Wire Up Mobile Notifications Screen

**File:** `client-app/app/(tabs)/notifications/index.tsx`

Currently 100% mock data (5 hardcoded notifications). Replace with real API integration.

#### 4.1 Create Notification Hook

**Create:** `client-app/hooks/useNotifications.ts`

```typescript
// Fetch real notifications from API
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/client/notifications'),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useMarkAsRead() {
  return useMutation({
    mutationFn: (id: string) => api.patch(`/client/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });
}
```

#### 4.2 Update Notifications Screen

Replace mock data array with `useNotifications()` hook:
- Show loading spinner while fetching
- Show empty state if no notifications
- Pull-to-refresh support
- Mark as read on tap
- Navigate to deep link on tap (meal detail, weight log, etc.)
- Show unread badge count on bottom tab icon

#### 4.3 Register Push Token on App Launch

**File:** `client-app/app/_layout.tsx` or `client-app/hooks/useAuth.ts`

After successful login:
1. Request push notification permissions from user
2. Get Expo push token via `Notifications.getExpoPushTokenAsync()`
3. Send token to backend: `POST /client/notifications/device-token`
4. Store token locally to avoid re-registering on every launch

---

### 5. Add Unread Badge to Tab Bar

**File:** `client-app/components/BottomTabBar.tsx`

- Fetch unread notification count
- Show red badge dot on the notifications tab when count > 0
- Update count when notifications are marked as read

---

### 6. Dashboard Notification Bell (Dietitian Side)

**Create notification components for the dietitian dashboard:**

#### 6.1 Notification Bell Icon

**Add to:** `frontend/src/app/dashboard/layout.tsx` (header area)

- Bell icon in top-right header
- Red badge with unread count
- Dropdown panel showing recent notifications on click
- "View all" link to full notifications page

#### 6.2 Create Dietitian Notifications Hook

**Create:** `frontend/src/lib/hooks/use-notifications.ts`

```typescript
export function useNotifications() {
  return useQuery({
    queryKey: ['dietitian-notifications'],
    queryFn: () => apiClient.get('/notifications'),
    refetchInterval: 60 * 1000, // Poll every 60 seconds
  });
}
```

---

### 7. Email Notification Fallback

**File:** `backend/src/utils/emailService.ts`

Currently dev-mode only (logs to console without SMTP config).

#### 7.1 Configure for Production

- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` env vars
- Test with a real SMTP provider (SendGrid, AWS SES, or self-hosted Postfix per PRD)
- Ensure HTML email templates render correctly

#### 7.2 Add Email Fallback for Critical Notifications

For these notification types, also send an email if push fails:
- `plan_published` (client should know they have a new plan)
- `dietitian_feedback` (important for engagement)
- `weekly_checkin` (summary email)

---

## Definition of Done

- [ ] `expo-server-sdk` installed and integrated
- [ ] Push notifications actually send to real devices
- [ ] Client device token registration working (not 501)
- [ ] Invalid push token cleanup implemented
- [ ] 7 notification triggers wired into existing controllers
- [ ] Meal reminder job running on schedule
- [ ] Mobile notifications screen uses real API data (no mock data)
- [ ] Push token registered on app launch after login
- [ ] Pull-to-refresh on notifications screen
- [ ] Mark-as-read on tap with deep link navigation
- [ ] Unread badge on mobile tab bar
- [ ] Notification bell in dashboard header with dropdown
- [ ] Email service configured for production SMTP
- [ ] Email fallback for critical notification types
