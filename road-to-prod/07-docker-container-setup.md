# 07 - Docker / Container Setup

## Priority: CRITICAL
## Effort: 2-3 hours
## Risk if skipped: Cannot deploy to any cloud platform (Railway, Render, AWS, GCP, Fly.io, etc.)

---

## The Problem

No Dockerfiles, docker-compose, or containerization config exists anywhere in the repo. This blocks:
- Cloud deployment (most platforms expect containers)
- Consistent dev environments across team members
- CI/CD pipelines
- Horizontal scaling

---

## The Fix

### 1. Backend Dockerfile

Create `backend/Dockerfile`:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Create logs directory
RUN mkdir -p logs && chown appuser:nodejs logs

USER appuser

EXPOSE 3000

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

### 2. Frontend Dockerfile

Create `frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build args for public env vars (injected at build time)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

Note: For the standalone output, add to `frontend/next.config.js`:
```javascript
module.exports = {
    output: 'standalone',
    // ... existing config
};
```

### 3. Docker Compose (Development)

Create `docker-compose.yml` in the project root:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      target: builder
    command: npx tsx watch src/server.ts
    ports:
      - "3000:3000"
    env_file:
      - ./backend/.env
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./backend/src:/app/src
      - ./backend/prisma:/app/prisma
    depends_on:
      - redis

  frontend:
    build:
      context: ./frontend
      target: builder
    command: npm run dev
    ports:
      - "3001:3000"
    env_file:
      - ./frontend/.env.local
    volumes:
      - ./frontend/src:/app/src
    depends_on:
      - backend

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### 4. Docker Ignore Files

Create `backend/.dockerignore`:
```
node_modules
dist
logs
.env
*.log
.git
```

Create `frontend/.dockerignore`:
```
node_modules
.next
.env.local
.git
```

---

## Production Docker Compose (Example)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      target: runner
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - CLIENT_JWT_SECRET=${CLIENT_JWT_SECRET}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_REGION=${S3_REGION}
      - S3_BUCKET=${S3_BUCKET}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
      - REDIS_URL=redis://redis:6379
      - FRONTEND_URL=${FRONTEND_URL}
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

---

## Platform-Specific Deployment

If using managed platforms that auto-detect, you may not need Docker at all:

| Platform | What it needs |
|----------|--------------|
| Railway | Auto-detects from `package.json`. Add `Procfile` or nixpacks config |
| Render | Auto-detects. Set build command and start command in dashboard |
| Fly.io | Needs Dockerfile (use the one above) |
| Vercel (frontend only) | Auto-detects Next.js. Zero config needed |

### Railway / Render Procfile (Alternative to Docker)

Create `backend/Procfile`:
```
web: npx prisma migrate deploy && node dist/server.js
```

Create `backend/nixpacks.toml` (for Railway):
```toml
[phases.build]
cmds = ["npm ci", "npx prisma generate", "npm run build"]

[start]
cmd = "npx prisma migrate deploy && node dist/server.js"
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Backend container build |
| `frontend/Dockerfile` | Frontend container build |
| `docker-compose.yml` | Local development |
| `docker-compose.prod.yml` | Production reference |
| `backend/.dockerignore` | Exclude files from Docker build |
| `frontend/.dockerignore` | Exclude files from Docker build |

---

## Verification

1. `docker compose up` - both services should start and be accessible
2. `docker compose -f docker-compose.prod.yml build` - production images should build
3. Backend image should run migrations on startup
4. Frontend should be accessible at `http://localhost:3001`
