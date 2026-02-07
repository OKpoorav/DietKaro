# Module 3: Mobile App (Client App) Improvements

**Priority:** P1
**Effort:** 3-4 days
**Impact:** User experience, stability, type safety

---

## Current State

The React Native (Expo) client app has good UX patterns (OTP auto-focus, weight charts, clean meal cards) but lacks proper error handling, type safety on API responses, shared theming, and has incomplete screens.

---

## What Needs To Be Done

### 1. Create Shared Theme System

**Problem:** Color constants, spacing, shadows, and card styles are duplicated in **17 files** with inline `StyleSheet.create()`.

**Create:** `client-app/constants/theme.ts` (expand existing file)

```
Current theme.ts likely has basic colors.
Needs to include:
- colors (primary, secondary, background, text, error, success, warning)
- spacing (xs, sm, md, lg, xl)
- borderRadius values
- shadow presets (cardShadow, modalShadow)
- typography (fontSize, fontWeight, lineHeight presets)
```

Then update all 17 screen files to import from theme instead of redefining colors inline.

**Files to update:**
- `app/(auth)/login.tsx`
- `app/(auth)/verify.tsx`
- `app/(onboarding)/step1.tsx` through `complete.tsx`
- `app/(tabs)/home/index.tsx`
- `app/(tabs)/weight/index.tsx`
- `app/(tabs)/progress/index.tsx`
- `app/(tabs)/profile/index.tsx`
- `app/(tabs)/notifications/index.tsx`

---

### 2. Fix API Response Type Safety

**Problem:** API responses use `unknown` type, losing all type safety.

**File:** `client-app/services/api.ts`

#### 2.1 Create Typed Response Wrapper

**Create:** `client-app/types/api.ts`

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; };
  meta?: { page: number; pageSize: number; total: number; };
}
```

#### 2.2 Update All API Methods

Replace every `api.post<{ success: boolean; data: unknown }>` with the specific typed response.

**Methods to update in `services/api.ts`:**

| Method | Current Return | Should Return |
|--------|---------------|---------------|
| `requestOTP()` | `unknown` | `{ message: string; sessionToken: string }` |
| `verifyOTP()` | `unknown` | `{ accessToken: string; client: Client }` |
| `getTodayMeals()` | `unknown` | `MealLog[]` |
| `getMealDetail()` | `unknown` | `MealLog` |
| `logMeal()` | `unknown` | `MealLog` |
| `uploadPhoto()` | `unknown` | `{ photoUrl: string }` |
| `getWeightLogs()` | `unknown` | `WeightLog[]` |
| `createWeightLog()` | `unknown` | `WeightLog` |
| `getStats()` | `unknown` | `ClientStats` |

#### 2.3 Add Missing Type Definitions

**File:** `client-app/types/index.ts`

Add types that are referenced but not defined:
- `ClientStats` (for dashboard stats)
- `Notification` (for notifications screen)
- `OnboardingStep` (for onboarding flow)

---

### 3. Implement Global Error Handling

**Problem:** Errors show raw Alert.alert() with no retry, no offline awareness, no categorization.

#### 3.1 Create Error Handler Utility

**Create:** `client-app/utils/errorHandler.ts`

```
Responsibilities:
- Categorize errors (network, auth, validation, server)
- Show appropriate toast/alert per category
- Handle 401 -> redirect to login
- Handle network errors -> show offline banner
- Provide retry callback
```

#### 3.2 Create Toast Notification Component

**Create:** `client-app/components/Toast.tsx`

Replace `Alert.alert()` calls with toast notifications for non-critical messages (success, info). Keep Alert for destructive/blocking actions only.

#### 3.3 Add React Query Global Error Handler

**File:** `client-app/app/_layout.tsx` (where QueryClient is configured)

```
Add QueryClient defaultOptions:
- retry: 3 with exponential backoff
- onError: global error handler callback
- networkMode: 'offlineFirst' for offline support
```

#### 3.4 Update Individual Screens

| Screen | Current Error Handling | Improvement Needed |
|--------|----------------------|-------------------|
| `login.tsx` | Alert only, no retry | Add retry button, loading state |
| `verify.tsx` | Alert only | Add resend OTP countdown, retry |
| `weight/index.tsx` | Alert with generic message | Categorize errors (409 = duplicate, 500 = server) |
| `home/index.tsx` | React Query implicit | Add error state UI component |

---

### 4. Extract Reusable Components

**Problem:** UI patterns repeated across screens without extraction.

#### 4.1 `<Card />` Component

**Create:** `client-app/components/Card.tsx`

Used in: home, weight, progress, profile screens. Currently each has inline:
```
backgroundColor: '#fff', borderRadius: 16, padding: 20,
shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05
```

#### 4.2 `<StatusBadge />` Component

**Create:** `client-app/components/StatusBadge.tsx`

Used for meal status (pending, eaten, skipped, substituted). Currently inline in home/index.tsx.

#### 4.3 `<LoadingScreen />` Component

**Create:** `client-app/components/LoadingScreen.tsx`

Standardize loading states across all screens (currently each has its own spinner).

#### 4.4 `<EmptyState />` Component

**Create:** `client-app/components/EmptyState.tsx`

For when lists have no data (no meals today, no weight logs, no notifications).

---

### 5. Fix Auth Flow Issues

**File:** `client-app/app/(auth)/login.tsx`

| Issue | Fix |
|-------|-----|
| Hardcoded `+91` country code | Make configurable or add country picker |
| Phone validation (length only) | Add proper phone number validation |
| No loading overlay during API call | Add loading state to prevent double-tap |
| No error recovery | Add retry button on failure |

**File:** `client-app/app/(auth)/verify.tsx`

| Issue | Fix |
|-------|-----|
| No OTP resend countdown | Add 60s cooldown timer with resend button |
| No loading state | Show spinner during verification |

---

### 6. Fix State Duplication

**Problem:** Client data stored in both SecureStore (`authStore.ts`) AND in `useState` within hooks. This creates sync issues.

**Solution:** Use SecureStore as the single source of truth. Hooks should read from store, not maintain separate state copies.

---

### 7. Add Request Timeout Configuration

**File:** `client-app/services/api.ts`

Current timeout is 15s with no explanation. Set per-endpoint timeouts:
- Auth endpoints: 10s
- Photo upload: 60s
- Regular API: 15s

---

### 8. Implement Offline Awareness

**Create:** `client-app/hooks/useNetworkStatus.ts`

- Monitor network connectivity
- Show offline banner when disconnected
- Queue mutations for when back online (React Query offline mode)
- Show cached data when offline

---

## Definition of Done

- [ ] Shared theme system created and adopted across all 17 screen files
- [ ] All API responses properly typed (zero `unknown` types)
- [ ] Missing type definitions added (ClientStats, Notification, OnboardingStep)
- [ ] Global error handler created with categorized error handling
- [ ] Toast component replaces Alert.alert for non-critical messages
- [ ] React Query configured with retry and global error handler
- [ ] 4 reusable components extracted (Card, StatusBadge, LoadingScreen, EmptyState)
- [ ] Auth flow issues fixed (loading states, retry, OTP resend)
- [ ] State duplication between SecureStore and useState resolved
- [ ] Per-endpoint timeouts configured
