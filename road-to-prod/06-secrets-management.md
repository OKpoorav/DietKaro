# 06 - Secrets Management

## Priority: CRITICAL
## Effort: 1 hour
## Risk if skipped: Database credentials, API keys, and S3 secrets exposed in version control

---

## The Problem

The `backend/.env` file contains real credentials and is tracked by git:

```
DATABASE_URL='postgresql://neondb_owner:npg_8EVytAZigL9H@...'
CLERK_SECRET_KEY=sk_test_...
S3_ACCESS_KEY=GK2e09e5e80afd4a2f2d6ff7e9
S3_SECRET_KEY=2cb4e6e2d408addcf6ddee3bae1437d1394fa956fe88cfac4c0dc67d54faec3c
```

Anyone with access to the git history can extract these credentials permanently, even after the file is removed.

---

## Immediate Actions

### Step 1: Add .env to .gitignore (if not already there)

```bash
echo "backend/.env" >> .gitignore
echo ".env" >> .gitignore
```

Verify the `.gitignore` already has this (the user has `aud` on line 42 which looks like a partial entry).

### Step 2: Remove .env from git tracking

```bash
git rm --cached backend/.env
git commit -m "chore: remove .env from version control"
```

### Step 3: Rotate ALL exposed credentials

Since these secrets have been in git history, they must be considered compromised:

| Secret | Where to rotate |
|--------|----------------|
| `DATABASE_URL` (Neon password) | Neon dashboard > Project > Connection Details > Reset password |
| `CLERK_SECRET_KEY` | Clerk dashboard > API Keys > Rotate |
| `CLERK_PUBLISHABLE_KEY` | Clerk dashboard > API Keys |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Garage admin or S3 provider dashboard |
| `CLIENT_JWT_SECRET` | Generate new: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |

### Step 4: Create a proper .env.example

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx

# S3/Object Storage
S3_ENDPOINT=https://your-s3-endpoint
S3_REGION=us-east-1
S3_BUCKET=dietkaro-media
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_PUBLIC_URL=https://your-public-url

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Client Auth
CLIENT_JWT_SECRET=generate-with-crypto-randomBytes

# App URLs
FRONTEND_URL=http://localhost:3001
API_BASE_URL=http://localhost:3000

# Email (optional)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

# Redis (if using Redis for OTP)
REDIS_URL=redis://localhost:6379
```

---

## Production Secrets Management

For production deployment, do NOT use `.env` files. Use your hosting platform's secret management:

| Platform | Method |
|----------|--------|
| Railway | Environment variables in dashboard |
| Render | Environment groups |
| AWS ECS/Fargate | AWS Secrets Manager + task definition |
| Fly.io | `fly secrets set KEY=VALUE` |
| Vercel (frontend) | Environment variables in project settings |
| Docker | Docker secrets or env file mounted at runtime (not in image) |

---

## Scrubbing Git History (Optional but Recommended)

If the repo is private and you want to remove secrets from git history entirely:

```bash
# WARNING: This rewrites git history. Coordinate with all contributors.
# Install git-filter-repo first: brew install git-filter-repo

git filter-repo --path backend/.env --invert-paths
git push origin main --force
```

If force-pushing is not feasible, rotating credentials (Step 3) is sufficient.

---

## Files to Change

| File | Change |
|------|--------|
| `.gitignore` | Ensure `backend/.env` and `.env` are listed |
| `backend/.env` | Remove from git tracking |
| `backend/.env.example` | Update with all required variables (no real values) |

---

## Verification

1. `git status` should NOT show `backend/.env` as tracked
2. `git log --all --full-history -- backend/.env` shows it was removed
3. All rotated credentials work with the new values
4. Server starts successfully with new credentials
