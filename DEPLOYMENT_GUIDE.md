# MoneyMate Deployment Guide

This guide covers deploying the MoneyMate application to production. The project uses a **three-service architecture**:

| Service | Provider | Purpose |
|---------|----------|---------|
| **Backend API** | Render | FastAPI application server |
| **Frontend** | Vercel | React SPA hosting |
| **Database** | Neon | PostgreSQL database |

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup (Neon)](#database-setup-neon)
4. [Backend Deployment (Render)](#backend-deployment-render)
5. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
6. [Build Process](#build-process)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Common Deployment Issues](#common-deployment-issues)
9. [Vercel Configuration](#vercel-configuration)

---

## Prerequisites

Before deploying, ensure you have:

- **GitHub account** with the MoneyMate repository
- **Render account** (free tier is sufficient)
- **Vercel account** (free tier is sufficient)
- **Neon account** (free tier with 0.5 GB storage)
- **Resend account** (for password reset emails)
- **Google Gemini API key** (for AI features)

---

## Environment Configuration

### Environment Variables Reference

| Variable | Required | Service | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | Backend | PostgreSQL connection string |
| `SECRET_KEY` | Yes | Backend | JWT signing secret |
| `ALGORITHM` | No | Backend | JWT algorithm (default: HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Backend | Access token TTL (default: 30) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | Backend | Refresh token TTL (default: 7) |
| `RESEND_API_KEY` | Yes | Backend | Resend email API key |
| `GEMINI_API_KEY` | Yes | Backend | Google Gemini API key |
| `CORS_ALLOW_ORIGINS` | Yes | Backend | Comma-separated allowed origins |
| `FRONTEND_URL` | Yes | Backend | Frontend URL for email links |
| `RENDER_SERVICE_ID` | No | Backend | Auto-set by Render |
| `VITE_API_URL` | Yes | Frontend | Backend API URL |

### Generating a Secure SECRET_KEY

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## Database Setup (Neon)

### 1. Create a Neon Project

1. Go to [neon.tech](https://neon.tech) and sign in
2. Click **Create a project**
3. Name it `moneymate` (or your preferred name)
4. Select a region close to your Render deployment region
5. Click **Create**

### 2. Get the Connection String

1. In your Neon project dashboard, click **Connect**
2. Copy the **Connection string** (it looks like `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/moneymate?sslmode=require`)
3. This will be your `DATABASE_URL`

### 3. Run Migrations

After deploying the backend (or locally with the production DATABASE_URL):

```bash
alembic upgrade head
```

---

## Backend Deployment (Render)

### 1. Create a Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `moneymate-api` |
| **Region** | Choose closest to your users |
| **Branch** | `main` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Plan** | Free |

### 2. Set Environment Variables

In the Render dashboard, add the following environment variables:

```
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/moneymate?sslmode=require
SECRET_KEY=your-generated-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
RESEND_API_KEY=re_xxxxx
GEMINI_API_KEY=your-gemini-api-key
CORS_ALLOW_ORIGINS=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
```

### 3. Deploy

1. Click **Create Web Service**
2. Wait for the initial build and deploy (5-10 minutes)
3. Once deployed, note your service URL: `https://moneymate-api.onrender.com`

### 4. Run Database Migrations on Render

After the service is deployed, run migrations via the Render Shell:

1. Go to your Render service dashboard
2. Click **Shell**
3. Run:
   ```bash
   alembic upgrade head
   ```

Alternatively, you can run migrations from your local machine:

```bash
DATABASE_URL="your-neon-connection-string" alembic upgrade head
```

---

## Frontend Deployment (Vercel)

### 1. Prepare Your Repository

Ensure `vercel.json` exists in the project root:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This ensures client-side routing works correctly (all paths serve `index.html`).

### 2. Deploy to Vercel

#### Option A: Via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure the project:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `client` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

5. Add environment variable:

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://moneymate-api.onrender.com` |

6. Click **Deploy**

#### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from the client directory
cd client
vercel --prod

# Follow the prompts to link your project
# Set VITE_API_URL when prompted
```

### 3. Custom Domain (Optional)

1. In your Vercel project dashboard, go to **Settings** → **Domains**
2. Add your custom domain
3. Follow Vercel's DNS configuration instructions

---

## Build Process

### Backend Build

The backend build is handled automatically by Render:

1. Render clones the repository
2. Runs `pip install -r requirements.txt`
3. Starts the server with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

No additional build step is needed for the Python backend.

### Frontend Build

The frontend build is handled by Vite:

```bash
cd client
npm install
npm run build
```

This produces a `dist/` directory with optimized static files.

**What the build does:**
- TypeScript type checking (`tsc --noEmit`)
- Bundles React components with Vite
- Minifies CSS and JavaScript
- Generates hashed filenames for cache busting
- Outputs to `client/dist/`

---

## Post-Deployment Verification

### 1. Verify Backend Health

```bash
curl https://moneymate-api.onrender.com/status/db
```

Expected response:
```json
{"db": "ok"}
```

### 2. Verify API Documentation

Visit `https://moneymate-api.onrender.com/docs` — you should see the Swagger UI.

### 3. Verify Frontend

Visit your Vercel URL — you should see the MoneyMate landing page.

### 4. Test Authentication Flow

```bash
# Register a test user
curl -X POST https://moneymate-api.onrender.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestP@ss1","display_name":"Test User","currency":"USD"}'

# Login
curl -X POST https://moneymate-api.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestP@ss1"}'
```

---

## Common Deployment Issues

### Issue 1: Database Connection Failures

**Symptom:** Backend returns 503 on `/status/db` or crashes on startup.

**Solutions:**
- Verify `DATABASE_URL` is correct in Render environment variables
- Ensure Neon allows connections from Render's IP range
- Check that `sslmode=require` is appended to the Neon connection string
- Verify the database exists (Neon creates a default database with the project name)

### Issue 2: CORS Errors

**Symptom:** Frontend can't make API calls, browser console shows CORS errors.

**Solutions:**
- Ensure `CORS_ALLOW_ORIGINS` on Render includes the exact Vercel frontend URL (no trailing slash)
- If using a custom domain, add it to `CORS_ALLOW_ORIGINS`
- For development, you can set `CORS_ALLOW_ORIGINS=*` (not recommended for production)

### Issue 3: Frontend Shows Blank Page

**Symptom:** Vercel deployment loads but shows a blank white page.

**Solutions:**
- Check browser console for JavaScript errors
- Verify `VITE_API_URL` is set correctly in Vercel environment variables
- Ensure `vercel.json` exists with the rewrites configuration
- Run `npm run build` locally to check for build errors

### Issue 4: AI Features Not Working

**Symptom:** Chat, insights, or AI categorization return errors.

**Solutions:**
- Verify `GEMINI_API_KEY` is set correctly
- Check that the Gemini API key has billing enabled (free tier has rate limits)
- Look for API error logs in Render dashboard

### Issue 5: Password Reset Emails Not Sending

**Symptom:** "Forgot password" returns success but no email arrives.

**Solutions:**
- Verify `RESEND_API_KEY` is correct
- Check that the sender email is verified in Resend
- Ensure `FRONTEND_URL` is set correctly (the reset link in the email uses this)
- Check spam/junk folder

### Issue 6: Migrations Not Applied

**Symptom:** Backend starts but endpoints return errors about missing tables.

**Solutions:**
- Run `alembic upgrade head` via Render Shell
- Check that `alembic.ini` has the correct `sqlalchemy.url` or uses `DATABASE_URL` env var
- Verify migration files exist in `alembic/versions/`

### Issue 7: Render Free Tier Cold Start

**Symptom:** First request after inactivity takes 30-60 seconds.

**Explanation:** Render's free tier spins down after 15 minutes of inactivity. The first request after a period of inactivity will be slow as the service starts up.

**Solutions:**
- This is normal behavior for free tier
- Consider upgrading to a paid plan for consistent performance
- Use a uptime monitoring service (e.g., UptimeRobot) to ping the service every 10 minutes

---

## Vercel Configuration

The `vercel.json` file in the project root configures the Vercel deployment:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This rewrite rule ensures that all routes (like `/dashboard`, `/transactions`, etc.) serve the `index.html` file, allowing React Router to handle client-side routing.

### Additional Vercel Configuration Options

You can extend `vercel.json` with additional settings:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

## Updating a Deployment

### Backend (Render)

Render automatically deploys when changes are pushed to the connected branch. To manually trigger a redeploy:

1. Go to your Render dashboard
2. Click **Manual Deploy** → **Deploy latest commit**

### Frontend (Vercel)

Vercel automatically deploys when changes are pushed to the connected branch. To manually trigger a redeploy:

1. Go to your Vercel project dashboard
2. Go to **Deployments**
3. Find the latest deployment and click **Redeploy**

---

## Monitoring & Logs

### Render Logs

1. Go to your Render service dashboard
2. Click **Logs** tab
3. View real-time application logs

### Vercel Logs

1. Go to your Vercel project dashboard
2. Click **Deployments**
3. Select a deployment
4. Click **Functions** or **Logs**

---

## Rollback

### Render

1. Go to your Render service dashboard
2. Click **Manual Deploy** → **Deploy specific commit**
3. Select the commit to roll back to

### Vercel

1. Go to your Vercel project dashboard
2. Click **Deployments**
3. Find the working deployment
4. Click the three dots (⋮) → **Promote to Production**