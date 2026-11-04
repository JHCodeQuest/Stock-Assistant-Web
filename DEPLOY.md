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

1. In the repository, open **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. The **Frontend Pages** workflow builds `frontend/` on pull requests and deploys
   `frontend/build` after frontend changes merge to `main`. It can also run manually.
   The old checked-in `docs/` bundle is not the deployment source.
4. Open `https://jhcodequest.github.io/Stock-Assistant-Web/#/login`.

Routes use the URL fragment so GitHub Pages always serves the repository's index document.
For example, inventory is `/Stock-Assistant-Web/#/inventory`; refreshing it sends only
`/Stock-Assistant-Web/` to the server. Use the app's navigation links and hash-form bookmarks.
Signed-out protected links redirect to `#/login`.

After deployment, check login and registration, then sign in and visit each inventory page.
Refresh `#/inventory` and confirm the page still renders.

## Update Frontend API URL

Set the repository **Settings → Secrets and variables → Actions → Variables**
entry `REACT_APP_API_URL` to the backend URL including `/api`, for example
`https://stock-assistant-api-3x6i.onrender.com/api`. It is public build configuration.
Run **Frontend Pages** again after changing it. If unset, the source's default API URL is used.

---

## Free Tier Limits (Render)

- Service sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds (cold start)
- 750 hours/month free
- 512 MB RAM

For selling this project, consider upgrading to paid tier ($7/month) for always-on performance.

## Registration and authentication limits

Registration is closed unless the backend has a non-empty `REGISTRATION_INVITE_CODE`.
Set a long random value in Render's Environment settings and give it only to intended demo
users. Users enter it in the registration form; never put it in frontend environment variables,
the repository, or logs. Remove the variable to close registration again; rotate it to revoke
the previous invitation. Existing accounts can still log in.

Newly registered and seeded accounts have role `staff`. Database initialization updates the
default for existing databases too. Existing account roles are preserved; review previously
created admin accounts separately and explicitly promote only accounts you trust.

Login permits 10 requests per client IP per 15 minutes. Registration permits 5, including
invalid invitation attempts. Both return 429 with JSON error and Retry-After when blocked.
Counters are in memory for this single-instance demo: restarts reset them; multiple instances
need a shared store.

On Render (`RENDER=true`), Express trusts the nearest reverse proxy hop to identify each
client. Direct local deployments do not trust forwarded headers. If hosting changes, confirm
the proxy topology before changing this setting.

## Permanent image storage (Cloudinary)

Uploaded images in production are sent to Cloudinary's authenticated image Upload API.
The returned HTTPS delivery URL is saved on the inventory item; the browser loads the image
from Cloudinary without depending on the Render filesystem. See the
[Cloudinary Upload API documentation](https://cloudinary.com/documentation/upload_images#authenticated_requests).

1. Create/select a Cloudinary product environment and open its API keys settings.
2. In Render's backend Environment settings, set `CLOUDINARY_CLOUD_NAME`,
   `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
   Keep credentials out of the repository, chats, logs, and frontend build variables.
3. Deploy the latest backend. No unsigned upload preset is needed.
4. Log in and add an inventory item with a small PNG, JPEG, or WebP image.
   Confirm `POST /api/upload` returns a URL beginning with
   `https://res.cloudinary.com/<your-cloud>/image/upload/` and the saved item uses that URL.
5. Redeploy/restart the Render service, reload the item, and confirm the same image URL still loads.
   This live check is required before closing task #6.

Uploads retain the 5 MB limit, image MIME/extension/signature validation, and login requirement.
Production (`NODE_ENV=production` or `RENDER=true`) returns 503 when Cloudinary is missing or
unavailable; it never falls back to Render's temporary disk. Local development without Cloudinary
credentials can still use local files. If any Cloudinary setting is present, all three are required.

Existing local image URLs are not migrated automatically. Re-upload surviving originals through
the app to update their inventory records; files already wiped from Render cannot be recovered
by this change. Configure Cloudinary before deploying this backend to keep new uploads available.
