# 01 - CORS Lockdown

## Priority: CRITICAL
## Effort: 15 minutes
## Risk if skipped: Any website on the internet can make authenticated API calls to your backend

---

## The Problem

```typescript
// backend/src/app.ts:13
app.use(cors());
```

`cors()` with no options = **allow every origin, every method, every header**. This means:
- A malicious site can make fetch requests to your API from a user's browser
- If the user is logged in (cookies/tokens stored), those requests carry credentials
- Attacker can read/modify/delete data on behalf of the user

---

## The Fix

```typescript
// backend/src/app.ts

const allowedOrigins = [
    process.env.FRONTEND_URL,              // e.g. https://dietkaro.com
    process.env.CLIENT_APP_URL,            // e.g. exp://your-expo-app (if needed)
].filter(Boolean) as string[];

// In development, also allow localhost
if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081');
}

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

---

## Environment Variables to Add

```env
FRONTEND_URL=https://your-domain.com
CLIENT_APP_URL=https://your-mobile-domain.com   # optional
```

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/app.ts:13` | Replace `cors()` with origin-whitelisted config |
| `backend/.env` | Add `FRONTEND_URL` |
| `backend/.env.example` | Add `FRONTEND_URL` |

---

## Verification

1. Start the server with `FRONTEND_URL=http://localhost:3001`
2. From `http://localhost:3001` - API calls should work
3. Open browser console on `http://evil-site.com` and try `fetch('http://localhost:3000/api/v1/clients')` - should be blocked by CORS
