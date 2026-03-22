# PaveCraft — Paving Block Production & Sales Manager

A web app for managing paving block production output and sales. Track production by cement bags or units, manage inventory across multiple block designs and colors, and record daily sales.

## Features

- **Dashboard** — Overview stats, recent production/sales, low stock alerts
- **Production** — Log daily output by cement bags (auto-calculates units) or direct units
- **Sales** — Record sales in units with customer tracking and stock visibility
- **Inventory** — Full stock breakdown by design × color with filters
- **Admin** — Manage block designs, colors, and units-per-bag rates

## Quick Deploy to Railway (Recommended — Free Tier Available)

### Step 1: Get the code on GitHub
1. Go to [github.com](https://github.com) and create an account (or log in)
2. Click **"New repository"**, name it `pavecraft`, keep it private, click **Create**
3. Upload all the files from this folder to the repository

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app) and sign up with your GitHub account
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your `pavecraft` repository
4. Railway will auto-detect the Dockerfile and deploy
5. Click **"Generate Domain"** in Settings to get your public URL
6. Add a **Volume** (click "+ New" → "Volume") and mount it at `/data` so your database persists

### That's it! Share the URL with your 4 users.

---

## Alternative: Deploy to Render (Free Tier)

1. Push code to GitHub (same as above)
2. Go to [render.com](https://render.com), sign up, click **"New Web Service"**
3. Connect your GitHub repo
4. Settings: **Runtime** = Docker, **Instance** = Free
5. Add a **Disk** mounted at `/data` for persistent database
6. Deploy and get your URL

---

## Alternative: Deploy to Fly.io

```bash
# Install flyctl, then:
fly launch
fly volumes create data --size 1
fly deploy
```

---

## Run Locally (for testing)

```bash
npm install
npm start
# Open http://localhost:3000
```

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3) — zero config, single file
- **Frontend**: Vanilla HTML/CSS/JS — no build step needed

## Project Structure

```
pavecraft/
├── server.js          # Express API server
├── public/
│   └── index.html     # Complete frontend (single file)
├── package.json
├── Dockerfile         # For cloud deployment
└── README.md
```
