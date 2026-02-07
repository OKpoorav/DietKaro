# Module 11: Mobile App Screens Completion

**Priority:** P1
**Effort:** 3-4 days
**Impact:** Client-facing app must be fully functional for launch

---

## Current State

| Screen | Completeness | Key Issue |
|--------|-------------|-----------|
| Home (today's meals) | 85% | Working well |
| Meal detail/logging `[id].tsx` | 85% | Photo upload works, minor hardcoded values |
| Weight tracking | 90% | Excellent UI, chart is placeholder |
| **Progress** | **80%** | **Chart is just a line, no real visualization** |
| **Notifications** | **40%** | **100% mock data, no API integration** |
| **Profile** | **75%** | **Hardcoded values, missing sections** |
| Profile > Referral | Exists | Needs verification |
| Profile > Reports | Exists | Needs verification |

---

## What Needs To Be Done

### 1. Complete Notifications Screen

**File:** `client-app/app/(tabs)/notifications/index.tsx`

**Current state:** 5 hardcoded mock notifications, refresh is a TODO stub.

#### 1.1 Replace Mock Data with API Integration

- Remove hardcoded notification array (lines 19-60)
- Use `useNotifications()` hook (created in Module 9)
- Fetch from `GET /api/v1/client/notifications`

#### 1.2 Implement Real Functionality

| Feature | Current | Needed |
|---------|---------|--------|
| Data source | Hardcoded array | API via React Query |
| Pull-to-refresh | Stubbed (TODO comment) | `onRefresh` with query refetch |
| Mark as read | Not implemented | `PATCH /notifications/:id/read` on tap |
| Deep link navigation | Not implemented | Navigate to meal/weight screen on tap |
| Empty state | Exists | Keep as-is |
| Loading state | Not present | Add loading spinner |
| Error state | Not present | Add error with retry |
| Unread indicator | Hardcoded | Dynamic from API `isRead` field |

#### 1.3 Add Notification Type Icons

Map notification types to correct icons:
```
meal_reminder     -> Clock icon
dietitian_feedback -> CheckCircle icon
photo_uploaded    -> Camera icon
weight_logged     -> Scale icon
plan_published    -> FileText icon
achievement       -> Award icon
weekly_checkin    -> Calendar icon
```

---

### 2. Complete Progress Screen

**File:** `client-app/app/(tabs)/progress/index.tsx`

**Current state:** Weight input modal works, chart is a simple horizontal line placeholder.

#### 2.1 Add Real Weight Chart

Replace the placeholder line (lines 95-110) with an actual chart visualization.

**Options:**
- `react-native-chart-kit` (simple, works with Expo)
- `victory-native` (more customizable)
- `react-native-gifted-charts` (modern, performant)

The chart should show:
- X-axis: dates (last 8 weeks or configurable)
- Y-axis: weight in kg
- Line connecting data points
- Target weight as a horizontal dashed line
- Current weight highlighted
- Tap on data point to see exact value and date

#### 2.2 Add Compliance/Adherence Section

Below the weight chart, add a section showing (data from Module 6's compliance service):
- This week's meal adherence percentage
- Daily completion dots (7 dots, green/yellow/red/gray)
- Meal logging streak counter ("12 days in a row!")
- Comparison with last week

#### 2.3 Add Body Measurements Section (Optional)

If body measurements exist (from onboarding Step 6):
- Show latest measurements
- Show change from first measurement
- "Update Measurements" button

---

### 3. Complete Profile Screen

**File:** `client-app/app/(tabs)/profile/index.tsx`

**Current state:** Profile card works, logout works, several sections are stubbed.

#### 3.1 Fix Hardcoded Values

| Issue | Location | Fix |
|-------|----------|-----|
| Subscription renewal date shows `-- / -- / ----` | line 121 | Fetch from API or show plan end date |
| Privacy & Security shows "Coming Soon" alert | line 158 | Either implement or remove from menu |
| Help shows static alert with email | line 163 | Either link to support page or keep with real email |

#### 3.2 Wire Referral Screen

**File:** `client-app/app/(tabs)/profile/referral.tsx`

Verify this screen:
- Shows client's referral code
- Shows how many people they've referred
- Shows benefit earned (free months)
- Share referral code button (WhatsApp, copy to clipboard)

#### 3.3 Wire Reports Screen

**File:** `client-app/app/(tabs)/profile/reports.tsx`

Verify this screen:
- Lists uploaded medical reports
- Upload new report button (camera/gallery/file picker)
- View/download existing reports
- Integrates with reports controller (`GET /client/reports`)

#### 3.4 Add Edit Profile Functionality

Currently profile data is display-only. Add:
- "Edit" button on profile card
- Edit screen for: name, phone, profile photo
- Save changes via `PATCH /client/profile`

---

### 4. Enhance Meal Detail Screen

**File:** `client-app/app/(tabs)/home/meal/[id].tsx`

**Current state:** 85% complete, feature-rich.

#### 4.1 Fix Minor Issues

| Issue | Fix |
|-------|-----|
| Scheduled time display hardcoded via route params | Fetch from meal data |
| No image compression before upload | Add image compression (< 2MB as per PRD) |
| No upload progress indicator | Add progress bar during photo upload |

#### 4.2 Add Nutrition Info Display

When viewing a logged meal, show the planned nutrition:
- Calories, protein, carbs, fats
- Per-food-item breakdown (if available from meal's food items)

#### 4.3 Add Substitute Flow

When client selects "Substituted" status:
- Show text input for substitute description
- Optional: show food search to log what they actually ate
- Capture estimated calories of substitute

---

### 5. Improve Home Screen

**File:** `client-app/app/(tabs)/home/index.tsx`

#### 5.1 Add Daily Progress Bar

At the top of the home screen:
- "2 of 4 meals logged today" with progress bar
- Color: green when 100%, yellow when partial, gray when none

#### 5.2 Add Streak Counter

Below the date header:
- "Day 12 streak" with flame icon (if client has been logging consistently)
- Motivational message based on streak length

#### 5.3 Add Dietitian Feedback Badges

On each meal card, if the dietitian has reviewed it:
- Small badge showing review status
- Green check for positive, yellow warning for improvement needed

---

### 6. Handle Offline State

**Create:** `client-app/components/OfflineBanner.tsx`

Add to `_layout.tsx`:
- Detect network connectivity
- Show a banner at top: "You're offline. Data will sync when connected."
- Queue meal logs and weight entries for when back online
- React Query's `networkMode: 'offlineFirst'` handles this partially

---

### 7. Add Onboarding Prompt

If `onboardingCompleted` is false when the app launches, redirect to the onboarding flow instead of home screen.

**File:** `client-app/app/index.tsx` or `client-app/app/(tabs)/_layout.tsx`

Check on mount:
```
if (client.onboardingCompleted === false) {
  router.replace('/(onboarding)/step1');
}
```

---

## Definition of Done

- [ ] Notifications screen fetches real data from API (zero mock data)
- [ ] Pull-to-refresh, mark-as-read, deep link navigation working
- [ ] Notification type icons correctly mapped
- [ ] Progress screen has a real weight chart (not a placeholder line)
- [ ] Progress screen shows weekly adherence data
- [ ] Profile screen has no hardcoded values
- [ ] Referral screen verified and functional
- [ ] Reports screen verified and functional
- [ ] Edit profile functionality added
- [ ] Meal detail shows nutrition info
- [ ] Image compression before upload (< 2MB)
- [ ] Upload progress indicator on photo upload
- [ ] Home screen shows daily progress bar
- [ ] Offline banner component created
- [ ] Onboarding redirect works for incomplete onboarding
