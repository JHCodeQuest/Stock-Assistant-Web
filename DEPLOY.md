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
   DB_HOST = your-postgres-host
   DB_PORT = 5432
   DB_NAME = stock_inventory
   DB_USER = your-db-user
   DB_PASSWORD = your-db-password
   ```

6. Click **Create Web Service**

7. Wait for deployment (~2-3 minutes)

8. Note your URL: `https://stock-assistant-api.onrender.com`

---

## Free Database (Render PostgreSQL)

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
