# Deploy to Render (Free Tier)

## Backend API Setup

1. Go to [Render](https://render.com) and sign up (free)

2. Click **New +** → **Web Service**

3. Connect your GitHub repo: `JHCodeQuest/Stock-Assistant-Web`

4. Configure the service:
   - **Name**: `stock-assistant-api`
   - **Region**: Oregon (or nearest)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

5. Add Environment Variables (click **Environment** tab):
   ```
   NODE_ENV = production
   PORT = 10000
   JWT_SECRET = your-secure-jwt-secret-here
   DATABASE_URL = postgresql://user:password@host:5432/dbname
   ```
   `DATABASE_URL` is the only database setting the code reads (not `DB_HOST`, `DB_USER` etc).

6. Under **Settings** → **Health Check Path**, enter `/api/health`. It returns 200 only when
   the database answers, and 503 with `"database": "not configured" | "connecting" | "unreachable"`
   otherwise, so a database problem shows up straight away instead of as a hanging request.

7. Click **Create Web Service**

8. Wait for deployment (~2-3 minutes)

9. Note your URL: `https://stock-assistant-api.onrender.com`

---

## Database

**Render's free PostgreSQL is deleted 30 days after it is created.** That is the likely reason
this app's API stopped responding in 2026: it used to exit whenever it couldn't connect. For a
demo that should stay up, use a free database that doesn't expire (for example Neon or Supabase) and
paste its connection string into `DATABASE_URL`; TLS is switched on for those hosts automatically.
The API now stays up without a database, retries in the background, and reports the state on
`/api/health`.

### Option: Render PostgreSQL (expires after 30 days on the free plan)

1. Click **New +** → **PostgreSQL**

2. Configure:
   - **Name**: `stock-db`
   - **Region**: Same as web service

3. Click **Create Database**

4. Copy the **Internal Connection URL**

5. Paste it into your Web Service environment variables:
   ```
   DATABASE_URL = postgresql://user:password@host:5432/dbname
   ```

---

## Frontend GitHub Pages Setup

1. Go to your repo: `https://github.com/JHCodeQuest/Stock-Assistant-Web`

2. Go to **Settings** → **Pages**

3. Configure:
   - **Source**: Deploy from a branch
   - **Branch**: `main` / `/ (root)`
   - Click **Save**

4. Wait 2-3 minutes for deployment

5. Your site will be at: `https://JHCodeQuest.github.io/Stock-Assistant-Web`

---

## Update Frontend API URL

1. Go to your GitHub repo → `frontend/src/services/api.ts`

2. Change line 3 to your Render URL:
   ```typescript
   const API_URL = process.env.REACT_APP_API_URL || 'https://stock-assistant-api.onrender.com/api';
   ```

3. Commit and push - GitHub Pages will auto-rebuild

---

## Free Tier Limits (Render)

- Service sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds (cold start)
- 750 hours/month free
- 512 MB RAM

For selling this project, consider upgrading to paid tier ($7/month) for always-on performance.
