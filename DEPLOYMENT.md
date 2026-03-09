# Car Storage Management System — Deployment Guide

## Prerequisites
- Node.js 20+ (or Vercel)
- MongoDB Atlas account (free tier is fine)
- SMTP credentials (Gmail App Password works)

---

## Local Development

### 1. Clone & install
```bash
git clone <your-repo>
cd carpark
npm install
```

### 2. Configure environment
```bash
cp env.local.example .env.local
```
Edit `.env.local` and fill in all values:

| Variable | Description |
|---|---|
| `MONGODB_URI` | Full Atlas connection string, database name `carpark` |
| `JWT_SECRET` | 32+ byte random hex string |
| `SMTP_HOST/PORT/USER/PASS` | SMTP credentials for statement emails |
| `SMTP_SECURE` | `true` for port 465, `false` for 587 |
| `SMTP_FROM` | Display name + email for outgoing mail |
| `CRON_SECRET` | 32+ byte random hex string for cron endpoint auth |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` locally, your domain in prod |

Generate random secrets quickly:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### 4. First-run setup
Hit the setup endpoint once to create your carpark + admin account:
```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "carparkName": "Acme Car Storage",
    "adminName": "Admin",
    "email": "admin@example.com",
    "password": "SecurePassword123!"
  }'
```
This endpoint is **permanently blocked** once any user exists — it cannot be called again.

### 5. Login
Go to [http://localhost:3000/login](http://localhost:3000/login) and sign in with the credentials you just created.

---

## Vercel Deployment

### 1. Push to GitHub
```bash
git add -A && git commit -m "initial" && git push
```

### 2. Import into Vercel
- Go to [vercel.com](https://vercel.com), click **Add New → Project**
- Import your GitHub repo
- Framework preset: **Next.js** (auto-detected)

### 3. Environment variables
In Vercel → Project → Settings → Environment Variables, add every variable from `.env.local.example` with your production values.

Set `NEXT_PUBLIC_BASE_URL` to your Vercel production URL, e.g. `https://carpark.vercel.app`

### 4. Cron for monthly statements
`vercel.json` already schedules the monthly statement job:
```json
{ "schedule": "0 19 20 * *" }
```
This runs at **07:00 NZST (UTC+12) on the 20th of each month** and emails all on-account customers their statement + payment link.

For Vercel Cron to authenticate with the endpoint, add a `x-cron-secret` header-forwarding rule **or** ensure the `CRON_SECRET` environment variable in Vercel matches `.env.local`. Vercel automatically forwards the `Authorization` header set in `vercel.json`; alternatively, use `Vercel's built-in cron secret` feature:

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/monthly-statements",
    "schedule": "0 19 20 * *"
  }]
}
```
Then in the cron handler our middleware checks `x-cron-secret === process.env.CRON_SECRET`. You can trigger it manually from your Vercel dashboard or:
```bash
curl https://your-domain.vercel.app/api/cron/monthly-statements \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### 5. Deploy
```bash
vercel --prod
```
Or push to `main` and Vercel auto-deploys.

---

## MongoDB Atlas Setup

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a database user with **readWrite** on database `carpark`
3. Allow network access: `0.0.0.0/0` (required for Vercel's dynamic IPs)
4. Copy the connection string, replace `<password>` and append `/carpark` before the `?` query string

Example:
```
mongodb+srv://user:password@cluster.kk0xcxa.mongodb.net/carpark?retryWrites=true&w=majority
```

---

## Running on Windows (no Vercel)

1. Install Node.js 20 from [nodejs.org](https://nodejs.org)
2. Follow the local development steps above
3. Build and start with PM2 for production:
```bash
npm run build
npm install -g pm2
pm2 start "npm start" --name carpark
pm2 save
pm2 startup
```
Access via `http://localhost:3000` or set up a reverse proxy (Nginx/Caddy) for a custom domain.

---

## Gmail App Password (SMTP)

1. Enable 2FA on your Google account
2. Google Account → Security → App Passwords
3. Create an App Password for "Mail"
4. Use that 16-character password as `SMTP_PASS`

---

## Roles & Permissions

| Action | staff | manager | admin |
|---|:---:|:---:|:---:|
| View dashboard | ✓ | ✓ | ✓ |
| Create/edit sessions | ✓ | ✓ | ✓ |
| Create/edit customers | | ✓ | ✓ |
| Delete customers | | | ✓ |
| Manage staff | | | ✓ |
| Run billing | | ✓ | ✓ |
| View reports | ✓ | ✓ | ✓ |

---

## Manual Billing Trigger

To send monthly statements manually for a specific period:
```bash
curl -X POST https://your-domain/api/billing/run \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_JWT" \
  -d '{ "period": "2026-03", "dryRun": false }'
```
Use `"dryRun": true` first to preview without sending emails.
