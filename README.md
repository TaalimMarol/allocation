# Allocation Dashboard — Vercel Deployment Guide

## Architecture

```
Browser
  │
  ├─ GET /              → public/index.html   (static SPA)
  ├─ GET /api/auth/me   → checks session cookie
  ├─ GET /api/auth/login → redirects to Google OAuth
  ├─ GET /api/auth/callback → handles OAuth return, sets cookie
  ├─ GET /api/auth/logout → clears cookie
  ├─ GET /api/data      → reads Google Sheet (service account)
  ├─ POST /api/sync     → writes one row back to Sheet
  └─ GET /api/photos    → reads Drive folder images
```

**Why Vercel?**
- Free tier handles this workload easily
- Serverless functions run Node 18 natively — no server to manage
- GitHub integration means every `git push` auto-deploys
- Environment variables stored securely (never in code)

---

## Step 1 — Google Cloud Setup (one-time, ~10 minutes)

### 1a. Create a Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click **New Project** → name it `allocation-dashboard`
3. Wait for it to create, then select it

### 1b. Enable APIs
In the Cloud Console sidebar: **APIs & Services → Library**

Search and enable each:
- **Google Sheets API**
- **Google Drive API**
- **Google People API** *(needed for OAuth profile)*

### 1c. Create OAuth 2.0 Credentials (for user login)
1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. If prompted, configure the consent screen first:
   - User Type: **Internal** (if your org uses Google Workspace) or External
   - App name: `Allocation Dashboard`
   - Add scopes: `openid`, `email`, `profile`
4. Application type: **Web application**
5. Name: `Allocation Dashboard Web`
6. Authorised redirect URIs — add **both**:
   ```
   http://localhost:3000/api/auth/callback
   https://YOUR-APP-NAME.vercel.app/api/auth/callback
   ```
   *(You'll fill in the Vercel URL after deployment)*
7. Click **Create** → copy the **Client ID** and **Client Secret**

### 1d. Create a Service Account (for Sheet/Drive access)
1. Go to **APIs & Services → Credentials → + Create Credentials → Service Account**
2. Name it `allocation-sheets-reader`
3. Click **Create and Continue** → skip role for now → **Done**
4. Click the new service account in the list → **Keys** tab
5. **Add Key → Create New Key → JSON** → download the file
6. Open the JSON file — you'll need the entire contents as one env var later

### 1e. Share your Sheet with the Service Account
1. Open the JSON key file — copy the `client_email` value
   (looks like `allocation-sheets-reader@your-project.iam.gserviceaccount.com`)
2. Open your Google Sheet
3. Click **Share** → paste the service account email → role: **Editor** → Share

### 1f. Get your Sheet ID
From the Sheet URL:
```
https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_SHEET_ID/edit
```
Copy the long string between `/d/` and `/edit`.

---

## Step 2 — Deploy to Vercel

### 2a. Push to GitHub
```bash
# In this project folder:
git init
git add .
git commit -m "Initial allocation dashboard"
git remote add origin https://github.com/YOUR_USERNAME/allocation-dashboard.git
git push -u origin main
```

### 2b. Import to Vercel
1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Framework preset: **Other** (leave as-is)
4. Click **Deploy** — it will fail because env vars aren't set yet. That's fine.

### 2c. Add Environment Variables
In Vercel dashboard → your project → **Settings → Environment Variables**

Add each of these:

| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | From step 1c |
| `GOOGLE_CLIENT_SECRET` | From step 1c |
| `GOOGLE_REDIRECT_URI` | `https://YOUR-APP.vercel.app/api/auth/callback` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The **entire contents** of the JSON key file (paste as-is) |
| `SPREADSHEET_ID` | Your Sheet ID from step 1f |
| `SHEET_NAME` | The tab name (e.g. `Sheet1`) — leave blank for first tab |
| `PHOTO_FOLDER_ID` | Google Drive folder ID for teacher photos (or leave blank) |
| `SESSION_SECRET` | Any long random string — generate one: `openssl rand -hex 32` |

### 2d. Redeploy
In Vercel → **Deployments → Redeploy** (the latest one).

### 2e. Update OAuth Redirect URI
Now that you have your Vercel URL, go back to Google Cloud Console:
- **APIs & Services → Credentials → your OAuth client**
- Add the real Vercel URL to **Authorised redirect URIs**:
  ```
  https://YOUR-APP.vercel.app/api/auth/callback
  ```

---

## Step 3 — Test

1. Open your Vercel URL
2. Click **Continue with Google**
3. Sign in with one of the 4 authorised emails
4. You should see the dashboard with classes and teachers

---

## Local Development

```bash
npm install
npm install -g vercel
vercel dev   # runs at http://localhost:3000
```

Create a `.env` file locally (never commit this!):
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SPREADSHEET_ID=...
SHEET_NAME=Sheet1
PHOTO_FOLDER_ID=...
SESSION_SECRET=any-random-string
```

---

## File Structure

```
allocation-dashboard/
├── api/
│   ├── _auth.js          ← session cookie helpers
│   ├── _sheets.js        ← Google Sheets/Drive data layer
│   ├── auth/
│   │   ├── login.js      ← starts OAuth flow
│   │   ├── callback.js   ← handles OAuth return
│   │   ├── logout.js     ← clears session
│   │   └── me.js         ← session check
│   ├── data.js           ← GET /api/data (all rows)
│   ├── sync.js           ← POST /api/sync (write row)
│   └── photos.js         ← GET /api/photos (Drive images)
├── public/
│   └── index.html        ← entire SPA frontend
├── package.json
├── vercel.json
└── README.md
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Access denied" after login | Your email isn't in the `ALLOWED_EMAILS` list in `api/_auth.js` |
| Blank screen / no classes | Check `SPREADSHEET_ID` and that the service account has Editor access to the Sheet |
| "GOOGLE_SERVICE_ACCOUNT_JSON env var is missing" | Paste the entire JSON key contents as one env var — including `{` and `}` |
| Photos not loading | Check `PHOTO_FOLDER_ID` and share the folder with the service account email |
| OAuth redirect error | Make sure `GOOGLE_REDIRECT_URI` exactly matches what's in Google Cloud Console |
| 401 on `/api/data` | Session expired — sign out and sign back in |
