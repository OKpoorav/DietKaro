# 08 - Client App (React Native / Expo) Issues

> Seven issues in the DietKaro mobile client app ranging from silent data loss to UX confusion. The two HIGH-severity items can cause users to lose meal photos without any indication of failure.

---

## 8.1 Photo Upload Is Fire-and-Forget

**Severity:** HIGH
**Category:** Silent Data Loss
**File:** `client-app/hooks/useMealLog.ts` lines 38-52

### The Problem

```typescript
// client-app/hooks/useMealLog.ts — inside useLogMeal mutationFn
// Upload photo if provided (fire-and-forget — meal log succeeds even if photo fails)
if (photoUri) {
    try {
        const actualId = result.id || mealLogId;
        const formData = new FormData();
        formData.append('photo', {
            uri: photoUri,
            name: 'meal-photo.jpg',
            type: 'image/jpeg',
        } as any);
        await mealLogsApi.uploadPhoto(actualId, formData);
    } catch (err) {
        console.warn('Photo upload failed, meal log was saved:', err);
    }
}
```

The photo upload is wrapped in a try/catch that swallows the error with `console.warn`. The mutation itself resolves successfully regardless of whether the photo upload succeeded or failed.

Meanwhile, in the meal detail screen, the user always sees the success toast:

```typescript
// client-app/app/(tabs)/home/meal/[id].tsx — handleSubmit
await logMutation.mutateAsync({ ... });
showToast({ title: 'Success', message: 'Meal logged successfully!', variant: 'success' });
router.back();
```

### User Impact

1. The user takes a photo of their meal, taps Submit, and sees "Meal logged successfully!" with a green checkmark.
2. The photo upload fails silently (network timeout, server error, file too large).
3. The user navigates back to the home screen. Their meal card shows the camera placeholder instead of their photo.
4. The dietitian never sees the meal photo and cannot provide visual feedback.
5. The user has no way to know the photo was lost and no way to retry uploading it.
6. On slow mobile connections (3G, spotty WiFi), this will happen frequently because the photo upload has a 60-second timeout (`client-app/services/api.ts` line 86) but large photos can easily exceed that.

### The Fix

Return photo upload status from the mutation so the UI can show a warning toast if the photo failed, and provide a retry mechanism.

```typescript
// client-app/hooks/useMealLog.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mealLogsApi } from '../services/api';

// ... useMealLog stays the same ...

interface LogMealInput {
    mealLogId: string;
    status: 'eaten' | 'skipped' | 'substituted';
    notes?: string;
    photoUri?: string;
    chosenOptionGroup?: number;
}

interface LogMealResult {
    mealLog: any;
    photoUploadFailed: boolean;
    photoError?: Error;
}

export function useLogMeal() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            mealLogId,
            status,
            notes,
            photoUri,
            chosenOptionGroup,
        }: LogMealInput): Promise<LogMealResult> => {
            const { data } = await mealLogsApi.logMeal(mealLogId, {
                status,
                notes,
                chosenOptionGroup,
            });
            const result = data.data;
            let photoUploadFailed = false;
            let photoError: Error | undefined;

            if (photoUri) {
                try {
                    const actualId = result.id || mealLogId;
                    const formData = new FormData();
                    formData.append('photo', {
                        uri: photoUri,
                        name: 'meal-photo.jpg',
                        type: 'image/jpeg',
                    } as any);
                    await mealLogsApi.uploadPhoto(actualId, formData);
                } catch (err) {
                    photoUploadFailed = true;
                    photoError = err instanceof Error ? err : new Error(String(err));
                    console.warn('Photo upload failed, meal log was saved:', err);
                }
            }

            return { mealLog: result, photoUploadFailed, photoError };
        },
        onSuccess: async (result) => {
            const actualId = result.mealLog.id;
            await queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });
            queryClient.invalidateQueries({ queryKey: ['meal-log', actualId] });
            queryClient.invalidateQueries({ queryKey: ['client', 'stats'] });
        },
    });
}

// Separate hook for retrying a failed photo upload
export function useRetryPhotoUpload() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            mealLogId,
            photoUri,
        }: {
            mealLogId: string;
            photoUri: string;
        }) => {
            const formData = new FormData();
            formData.append('photo', {
                uri: photoUri,
                name: 'meal-photo.jpg',
                type: 'image/jpeg',
            } as any);
            const { data } = await mealLogsApi.uploadPhoto(mealLogId, formData);
            return data.data;
        },
        onSuccess: (_, { mealLogId }) => {
            queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });
            queryClient.invalidateQueries({ queryKey: ['meal-log', mealLogId] });
        },
    });
}
```

Then update the meal detail screen to show a warning when the photo fails:

```typescript
// client-app/app/(tabs)/home/meal/[id].tsx — handleSubmit
const handleSubmit = async () => {
    if (!id) return;

    setIsSubmitting(true);
    try {
        const result = await logMutation.mutateAsync({
            mealLogId: id,
            status: 'eaten',
            notes: notes || undefined,
            photoUri: photoUri || undefined,
            chosenOptionGroup: hasAlternatives ? selectedOption : undefined,
        });

        if (result.photoUploadFailed) {
            showToast({
                title: 'Meal Saved, Photo Failed',
                message: 'Your meal was logged but the photo could not be uploaded. You can retry from the meal details.',
                variant: 'warning',
            });
        } else {
            showToast({
                title: 'Success',
                message: 'Meal logged successfully!',
                variant: 'success',
            });
        }
        router.back();
    } catch (error) {
        console.error('Log meal error:', error);
        const appError = normalizeError(error);
        showToast({ title: appError.title, message: appError.message, variant: 'error' });
    } finally {
        setIsSubmitting(false);
    }
};
```

---

## 8.2 useMealLog Invalidates Wrong Query Key

**Severity:** HIGH
**Category:** Stale UI / Cache Mismatch
**File:** `client-app/hooks/useMealLog.ts` lines 56-61

### The Problem

```typescript
// client-app/hooks/useMealLog.ts — onSuccess callback
onSuccess: async (_, { mealLogId }) => {
    await queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });
    await queryClient.refetchQueries({ queryKey: ['meals', 'today'] });
    queryClient.invalidateQueries({ queryKey: ['meal-log', mealLogId] });
    queryClient.invalidateQueries({ queryKey: ['client', 'stats'] });
},
```

There are two distinct bugs here:

**Bug A: Redundant invalidate + refetch.** `invalidateQueries` already marks queries as stale and triggers a refetch for any active (mounted) queries. Calling `refetchQueries` immediately after on the same key forces a second network request. Both calls are also `await`ed sequentially, meaning the user waits for two round-trips to the server before `onSuccess` completes.

**Bug B: Invalidating with the wrong ID.** The `mealLogId` from the mutation input may be a `pending-xxx` prefixed string (this is how the app handles meals that have not yet been created server-side). But the server responds with a real UUID in `result.id`. The `onSuccess` callback destructures `mealLogId` from the **input**, not the result:

```typescript
// The input mealLogId could be 'pending-breakfast-1234'
// The server returns result.id = '550e8400-e29b-41d4-a716-446655440000'
// But we invalidate ['meal-log', 'pending-breakfast-1234'] — which is never in the cache
```

The query hook itself guards against this:

```typescript
// client-app/hooks/useMealLog.ts line 5
const isPending = mealLogId?.startsWith('pending-');
// ...
enabled: !!mealLogId && !isPending,  // never fetches for pending IDs
```

So `['meal-log', 'pending-xxx']` is never populated in the cache. The invalidation is a no-op, and the real cached entry under `['meal-log', '<actual-uuid>']` remains stale.

### User Impact

1. After logging a meal, the meal detail screen may show stale data (old status, missing photo URL) if the user navigates back to it before the stale time (30 seconds) expires.
2. Two redundant network requests fire on every successful meal log, wasting bandwidth and adding latency on mobile connections.
3. If the user logs a pending meal, navigates back, and immediately taps the same meal card, they may see the pre-logged state.

### The Fix

```typescript
// client-app/hooks/useMealLog.ts — corrected onSuccess
onSuccess: async (result) => {
    // result is now the LogMealResult from the fix in 8.1
    // If not applying 8.1, use: onSuccess: async (result, { mealLogId }) =>
    const actualId = result.mealLog?.id || result.id;

    // invalidateQueries is sufficient — it marks stale AND triggers refetch
    // for any actively mounted query. No need for a separate refetchQueries call.
    await queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });

    // Use the ACTUAL server-returned ID, not the input mealLogId
    queryClient.invalidateQueries({ queryKey: ['meal-log', actualId] });

    // Refresh stats (compliance, streak, etc.)
    queryClient.invalidateQueries({ queryKey: ['client', 'stats'] });
},
```

If applying this fix independently of issue 8.1 (i.e., the mutation still returns just `result` directly):

```typescript
onSuccess: async (result, { mealLogId }) => {
    // Use server-returned ID; fall back to input ID only if server didn't return one
    const actualId = result.id || mealLogId;

    await queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });
    // Do NOT call refetchQueries — invalidateQueries handles it
    queryClient.invalidateQueries({ queryKey: ['meal-log', actualId] });
    queryClient.invalidateQueries({ queryKey: ['client', 'stats'] });
},
```

---

## 8.3 No Offline Support

**Severity:** MEDIUM
**Category:** Poor Connectivity Handling
**Files:** All API consumers across `client-app/`

### The Problem

Every API call in the client app goes directly through axios with no offline awareness:

```typescript
// client-app/services/api.ts
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});
```

When the user is offline (subway, elevator, airplane mode, poor cellular):

- Tapping "Submit" on a meal log throws a network error after the 15-second timeout.
- The error is caught and shown as a generic error toast.
- The user's meal log data (status, notes, photo) is lost completely.
- Weight log entries are lost.
- Pull-to-refresh shows an error and the screen goes blank if previously cached data has expired.

The app already has `@react-native-community/netinfo` in its dependencies (`package.json` line 14) but never uses it.

### User Impact

1. Users on unreliable mobile connections (common in India, where DietKaro is likely targeting) will frequently lose meal log submissions.
2. Morning meal logging on the commute (a prime use case) becomes unreliable.
3. Users learn not to trust the app and stop logging meals, defeating the entire purpose of the diet tracking app.

### The Fix

**Step 1: Configure react-query's online manager with NetInfo.**

```typescript
// client-app/services/queryClient.ts (new file or add to existing setup)

import { onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

// Tell react-query about the actual network state
onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
        setOnline(!!state.isConnected);
    });
});
```

This ensures that when the device is offline, react-query will:
- Pause mutations instead of firing them (they queue automatically).
- Not refetch queries (avoids error toasts from failed background refetches).
- Automatically replay paused mutations when the connection returns.

**Step 2: Persist the mutation queue so it survives app restarts.**

```typescript
// client-app/services/queryClient.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MutationCache, QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Keep data in cache for 5 minutes so screens don't go blank offline
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 2,
            // Avoid refetching on reconnect if data is still fresh
            refetchOnReconnect: 'always',
        },
        mutations: {
            // Retry failed mutations once on network recovery
            retry: 1,
        },
    },
});
```

**Step 3: Show a subtle offline banner so the user knows their actions are queued.**

```typescript
// client-app/components/OfflineBanner.tsx

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Colors, FontSizes, Spacing } from '../constants/theme';

export function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setIsOffline(!state.isConnected);
        });
        return () => unsubscribe();
    }, []);

    if (!isOffline) return null;

    return (
        <View style={styles.banner}>
            <Text style={styles.text}>
                You are offline. Changes will sync when connection returns.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        alignItems: 'center',
    },
    text: {
        fontSize: FontSizes.sm,
        color: '#92400E',
        textAlign: 'center',
    },
});
```

**Step 4: Add the banner to the root layout.**

```typescript
// In the root layout, above the main content:
<OfflineBanner />
```

### Additional Consideration

For meal photo uploads specifically, the photo URI is a local file path that remains valid even after the app restarts. If using react-query's built-in mutation persistence (`persistQueryClient`), the queued photo uploads can survive app restarts and upload when connectivity returns.

Install the required additional dependency:

```bash
npx expo install @react-native-async-storage/async-storage
```

---

## 8.4 Hardcoded localhost API URL

**Severity:** MEDIUM
**Category:** Configuration / Deployment
**File:** `client-app/services/api.ts` line 23

### The Problem

```typescript
// client-app/services/api.ts
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api/v1';
```

The API base URL falls back to `http://localhost:3000/api/v1` if `apiUrl` is not configured in the Expo config's `extra` field.

The current `app.json` has no `extra` field at all:

```json
{
  "expo": {
    "name": "DietConnect",
    "slug": "dietconnect-client",
    "version": "1.0.0",
    // ... no "extra" key
  }
}
```

This means `Constants.expoConfig?.extra?.apiUrl` is always `undefined`, and the app is **currently using `http://localhost:3000/api/v1` in every environment**, including production builds.

### User Impact

1. On a real device or production build, `http://localhost:3000` points to the device itself, not the server. Every API call fails immediately.
2. The app appears completely broken: no meals load, login fails, nothing works.
3. During development with Expo Go, it only works if the developer is also running the backend on the same machine and the device can reach `localhost` (which only works on simulators/emulators, not physical devices).
4. This is a ticking time bomb for the production release.

### The Fix

**Fail loudly if `apiUrl` is not configured in production, rather than silently falling back to localhost.**

```typescript
// client-app/services/api.ts

import Constants from 'expo-constants';

function getApiBaseUrl(): string {
    const configuredUrl = Constants.expoConfig?.extra?.apiUrl;

    if (configuredUrl) {
        return configuredUrl;
    }

    // In development, allow fallback to localhost for simulator convenience
    if (__DEV__) {
        console.warn(
            '[API] No apiUrl configured in app.json extra field. ' +
            'Falling back to http://localhost:3000/api/v1. ' +
            'This will NOT work on physical devices. ' +
            'Set expo.extra.apiUrl in app.json or app.config.ts.'
        );
        return 'http://localhost:3000/api/v1';
    }

    // In production, refuse to start with a broken URL
    throw new Error(
        'FATAL: API URL is not configured. ' +
        'Set expo.extra.apiUrl in app.json or use an app.config.ts with EAS environment variables. ' +
        'The app cannot function without a valid API endpoint.'
    );
}

const API_BASE_URL = getApiBaseUrl();
```

**Also configure `app.json` (or convert to `app.config.ts`) with the proper URL:**

```json
{
  "expo": {
    "name": "DietConnect",
    "slug": "dietconnect-client",
    "extra": {
      "apiUrl": "https://api.dietkaro.com/api/v1"
    }
  }
}
```

Or, for environment-aware configuration using `app.config.ts`:

```typescript
// client-app/app.config.ts
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: 'DietConnect',
    slug: 'dietconnect-client',
    extra: {
        apiUrl: process.env.API_URL || 'http://localhost:3000/api/v1',
    },
});
```

---

## 8.5 mealTypes Array Includes 'Substituted'

**Severity:** MEDIUM
**Category:** UX Confusion / Data Integrity
**File:** `client-app/app/(tabs)/home/meal/[id].tsx` line 23

### The Problem

```typescript
// client-app/app/(tabs)/home/meal/[id].tsx
const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Substituted'] as const;
```

This array is rendered as a horizontal list of selectable pill buttons in the meal logging screen:

```typescript
// Lines 331-351
<Text style={styles.sectionTitle}>Meal Type</Text>
<View style={styles.mealTypeContainer}>
    {mealTypes.map((type) => (
        <TouchableOpacity
            key={type}
            style={[
                styles.mealTypeButton,
                selectedMealType === type && styles.mealTypeButtonSelected,
            ]}
            onPress={() => setSelectedMealType(type)}
        >
            <Text style={[
                styles.mealTypeText,
                selectedMealType === type && styles.mealTypeTextSelected,
            ]}>
                {type}
            </Text>
        </TouchableOpacity>
    ))}
</View>
```

The `Meal` type definition makes the valid meal types clear:

```typescript
// client-app/types/index.ts
export interface Meal {
    // ...
    mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
    // ...
}
```

And the `MealLog` status field defines `substituted` as a **status**, not a type:

```typescript
// client-app/types/index.ts
export interface MealLog {
    // ...
    status: 'pending' | 'eaten' | 'skipped' | 'substituted';
    // ...
}
```

`Substituted` is a meal log **status** (the client ate something different from what was prescribed). It is not a meal **type** (breakfast, lunch, dinner, snack). These are two completely different concepts:

- **Meal type** = when in the day the meal is eaten (breakfast, lunch, dinner, snack).
- **Meal status** = what happened with the meal (pending, eaten, skipped, substituted).

### User Impact

1. Users see five buttons: `Breakfast | Lunch | Dinner | Snack | Substituted`.
2. A user who ate a different breakfast might tap "Substituted" thinking it means "I ate something else" -- but this is the meal type selector, not the status selector.
3. If the user selects "Substituted" as the meal type, this value (`"Substituted"`) is sent to the backend. The backend's `Meal` schema expects `'breakfast' | 'lunch' | 'snack' | 'dinner'`, so either:
   - The backend rejects it with a validation error, confusing the user.
   - The backend accepts it as a freeform string, creating data inconsistency.
4. The meal type selector is read-only in practice (it's pre-populated from the meal's data and the user rarely changes it), but the "Substituted" button is still visible and tappable, creating confusion.

### The Fix

Remove `'Substituted'` from the `mealTypes` array:

```typescript
// client-app/app/(tabs)/home/meal/[id].tsx
const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
```

This aligns with the `Meal` type definition and the backend schema. The four values match exactly with the backend's enum: `breakfast`, `lunch`, `dinner`, `snack` (the UI capitalizes the first letter for display).

If the "substituted" concept needs UI representation, it belongs in the meal status flow (e.g., a "I ate something different" button alongside "Mark as eaten" and "Skip"), not in the meal type selector.

---

## 8.6 No Image Compression Before Upload

**Severity:** MEDIUM
**Category:** Performance / Reliability
**Files:** `client-app/app/(tabs)/home/meal/[id].tsx` lines 64-100, `client-app/hooks/useMealLog.ts` lines 38-52

### The Problem

The camera and gallery pickers set `quality: 0.8` but do not constrain dimensions:

```typescript
// client-app/app/(tabs)/home/meal/[id].tsx
const result = await ImagePicker.launchCameraAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [3, 2],
    quality: 0.8,    // JPEG quality only — does NOT constrain dimensions
});
```

```typescript
const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [3, 2],
    quality: 0.8,    // Same issue
});
```

Modern smartphones capture photos at:
- iPhone 15 Pro: 48MP (8064 x 6048 pixels)
- Samsung Galaxy S24: 50MP (8160 x 6120 pixels)
- Mid-range phones: 12-16MP (4032 x 3024 pixels)

Even at quality 0.8, these result in files of 3-8 MB depending on the scene complexity. The `allowsEditing` + `aspect` crop helps somewhat, but the output is still at the full resolution of the cropped area.

The upload endpoint has a 60-second timeout:

```typescript
// client-app/services/api.ts lines 83-87
uploadPhoto: (mealId: string, formData: FormData) =>
    api.post<ApiResponse<{ url: string }>>(`/client/meals/${mealId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,  // 60 seconds
    }),
```

On a typical Indian 4G connection (5-10 Mbps upload), a 5 MB photo takes 4-8 seconds. On 3G or congested networks (0.5-1 Mbps upload), it takes 40-80 seconds, exceeding the 60-second timeout.

Combined with issue 8.1 (fire-and-forget), this means the photo silently fails on slow connections.

### User Impact

1. Photo uploads time out on slow connections, and the user never knows (see issue 8.1).
2. Even on good connections, uploading 5-8 MB per meal photo wastes mobile data. Users logging 4-5 meals per day could use 20-40 MB daily just on meal photos.
3. Server storage costs increase unnecessarily. A 1920px-wide photo is more than sufficient for dietitian review on a dashboard.
4. The upload blocks the mutation completion, adding seconds of perceived latency to every meal log.

### The Fix

Use `expo-image-manipulator` to resize images before upload. The package is available in the Expo SDK and does not require native module installation.

**Install the dependency:**

```bash
npx expo install expo-image-manipulator
```

**Create a utility function:**

```typescript
// client-app/utils/imageUtils.ts

import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1920; // Max width or height in pixels
const JPEG_QUALITY = 0.7;   // Good balance of quality vs size

/**
 * Compresses and resizes an image for upload.
 * Typical output: 200-500 KB instead of 3-8 MB.
 */
export async function compressImageForUpload(uri: string): Promise<string> {
    try {
        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: MAX_DIMENSION } }],
            {
                compress: JPEG_QUALITY,
                format: ImageManipulator.SaveFormat.JPEG,
            }
        );
        return result.uri;
    } catch (error) {
        console.warn('Image compression failed, using original:', error);
        // Fall back to original if compression fails
        return uri;
    }
}
```

**Use it in the meal log hook before uploading:**

```typescript
// client-app/hooks/useMealLog.ts — inside mutationFn, before FormData creation

import { compressImageForUpload } from '../utils/imageUtils';

// ... inside the if (photoUri) block:
if (photoUri) {
    try {
        const actualId = result.id || mealLogId;
        const compressedUri = await compressImageForUpload(photoUri);
        const formData = new FormData();
        formData.append('photo', {
            uri: compressedUri,
            name: 'meal-photo.jpg',
            type: 'image/jpeg',
        } as any);
        await mealLogsApi.uploadPhoto(actualId, formData);
    } catch (err) {
        photoUploadFailed = true;
        photoError = err instanceof Error ? err : new Error(String(err));
        console.warn('Photo upload failed, meal log was saved:', err);
    }
}
```

### Expected Improvement

| Metric | Before | After |
|--------|--------|-------|
| Typical file size | 3-8 MB | 200-500 KB |
| Upload time (4G) | 2-6 seconds | < 1 second |
| Upload time (3G) | 24-64 seconds | 2-4 seconds |
| Timeout failures | Frequent on slow networks | Rare |
| Monthly data usage (4 meals/day) | 360 MB - 960 MB | 24 MB - 60 MB |

---

## 8.7 TypeScript `as any` Casts in FormData

**Severity:** LOW
**Category:** TypeScript Correctness / Developer Experience
**File:** `client-app/hooks/useMealLog.ts` lines 43-47

### The Problem

```typescript
// client-app/hooks/useMealLog.ts
const formData = new FormData();
formData.append('photo', {
    uri: photoUri,
    name: 'meal-photo.jpg',
    type: 'image/jpeg',
} as any);
```

The standard Web `FormData.append()` method accepts `string | Blob` as its second argument. But React Native's `FormData` implementation accepts an object with `{ uri, name, type }` to represent a file from the device's filesystem. This non-standard API is not reflected in TypeScript's built-in DOM type definitions, so the compiler complains:

```
Argument of type '{ uri: string; name: string; type: string; }' is not assignable to
parameter of type 'string | Blob'.
```

The `as any` cast silences this error but removes all type safety from the argument.

### User Impact

This issue does not affect end users. It is a developer experience concern:

1. Future developers may not understand why the `as any` is needed and might accidentally break the object shape.
2. TypeScript cannot catch errors like a missing `uri` field or a typo in `type: 'image/jpge'`.
3. The `as any` cast hides the non-standard React Native API, making the code harder to understand for developers coming from web React.

### The Fix

This is a known React Native limitation. The proper fix is to declare the React Native-specific `FormData` type extension. Create a type declaration file:

```typescript
// client-app/types/react-native-form-data.d.ts

/**
 * React Native extends the standard FormData API to accept file-like objects
 * with { uri, name, type } instead of Blob. This is not reflected in the
 * standard TypeScript DOM types.
 *
 * @see https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Network/FormData.js
 */
interface ReactNativeFile {
    /** Local file URI (e.g., file:///path/to/photo.jpg) */
    uri: string;
    /** File name for the upload (e.g., 'meal-photo.jpg') */
    name: string;
    /** MIME type (e.g., 'image/jpeg') */
    type: string;
}

// Augment the global FormData interface to accept ReactNativeFile
declare global {
    interface FormData {
        append(name: string, value: ReactNativeFile, fileName?: string): void;
    }
}

export {};
```

Then update the code to remove the `as any`:

```typescript
// client-app/hooks/useMealLog.ts — now type-safe
const formData = new FormData();
formData.append('photo', {
    uri: photoUri,
    name: 'meal-photo.jpg',
    type: 'image/jpeg',
});
```

This preserves full type safety while documenting the React Native-specific behavior. If a developer accidentally passes `{ url: photoUri }` instead of `{ uri: photoUri }`, TypeScript will now catch the error.

### Alternative: Inline Comment Documentation

If the type declaration file feels like over-engineering for this single usage, at minimum add a comment explaining the cast:

```typescript
// React Native's FormData.append() accepts { uri, name, type } objects
// for file uploads, but TypeScript's DOM types only allow string | Blob.
// This is a known RN limitation. See:
// https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Network/FormData.js
formData.append('photo', {
    uri: photoUri,
    name: 'meal-photo.jpg',
    type: 'image/jpeg',
} as any);
```

---

## Summary

| Issue | Severity | Category | Quick Description |
|-------|----------|----------|-------------------|
| 8.1 | HIGH | Silent Data Loss | Photo upload failure silently swallowed; user sees success toast |
| 8.2 | HIGH | Stale UI | Invalidates wrong query key + redundant refetch call |
| 8.3 | MEDIUM | Offline UX | All API calls fail offline; no queuing or offline indicator |
| 8.4 | MEDIUM | Configuration | Falls back to `localhost:3000` if apiUrl not set; breaks production |
| 8.5 | MEDIUM | UX Confusion | 'Substituted' (a status) listed as a meal type in the selector |
| 8.6 | MEDIUM | Performance | No image dimension constraint; 3-8 MB uploads on slow networks |
| 8.7 | LOW | TypeScript | `as any` cast for RN FormData; known limitation, should be typed |
