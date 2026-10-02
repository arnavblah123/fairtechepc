# Fairtech Site Manager

Mobile-first web app for supervising a remote fabrication site. Supervisors update from their phones; the MD approves and reviews from anywhere.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma · Postgres (Neon free tier) · Vercel free tier · Vercel Blob for photos (from Phase 4).

## What is built

| Module | Status |
| --- | --- |
| Login, roles (incl. purchase desk), user management, jobs, stages | ✅ |
| Labour master, attendance (muster photo), holidays, daily plan | ✅ |
| Stage progress (quantity-based), DPR (compile, submit, print) | ✅ |
| Geotagged 5-slot daily photos, gallery | ✅ |
| Issues with escalation | ✅ |
| Material plan per job, request → approval → purchase order → dispatch → inward & acceptance | ✅ |
| Machines: owned or rented, dispatch/return, status, breakdown tickets with sign-off | ✅ |
| Petty cash expenses: cash-in-hand ledger, approval, reversals, spend analysis | ✅ |
| Advances, wage sheets, site cash book | ✅ |
| Superadmin exception dashboard with one-tap approvals | ✅ |
| Delete (with reason + audit trail) on every record type | ✅ |

### How progress is measured

**Time is the yardstick.** A job is created with all its stages written in one
go — name and planned days for each — and saved once. There is no tonnage
field and nobody types a percentage.

Each day the supervisor records who worked on which stage, and ticks a stage
when it is finished. From that the app knows when each stage started, how many
days it has used against its plan, and which stage is running over. Overall job
progress weights stages by their planned days, so a 25-day welding stage counts
for more than a 6-day inspection, and a stage never reads 100% until it is
ticked finished.

For the jobs where quantity is actually measured, switch on "also track
quantity" when writing the stages; those stages then read by quantity done
against plan instead, which is a truer figure when it exists.

### Approvals

Every petty cash expense needs the superadmin's approval, whatever the amount.
There is no auto-approve threshold.

### Who does what in purchasing

1. **Site supervisor** raises a material request (item, quantity, reason, needed-by).
2. **Arnav** approves or rejects, and chooses: purchase desk buys, send from factory, or site buys locally.
3. **Purchase (Pune)** places the order with a vendor (vendor, PO number, rate, expected date) and dispatches it.
4. **Site** inwards the consignment, enters the quantity actually received, and a short receipt is flagged with a reason. Stock goes up only on acceptance.

Every job also carries a **material plan**: all consumables it will need, entered
before work starts, so requests can be read against the plan.

### Deleting things

Superadmin can delete any record — jobs, stages, workers, attendance, photos,
issues, requests, dispatches, consumption, cash entries, machines, tickets,
users, items. Deletion always asks for a reason, keeps the row in the database
marked void, and writes to the audit log. Numbers stay correct: deleting a
consumption entry puts the stock back, deleting a wage sheet releases its
advances, deleting a job takes its stages with it. A stage that already has
progress cannot be deleted on its own, and the last superadmin cannot be removed.

## Logins

On a fresh deployment the app shows a one-time **Setup** page where you create your own superadmin login. If you tick "Add sample data" you also get:

| Username | Password | Role |
| --- | --- | --- |
| `incharge` | `site123` | Site In-charge (sample) |
| `supervisor` | `site123` | Supervisor (sample) |
| `purchase` | `site123` | Purchase desk, Pune (sample) |

Superadmin can reset anyone's password from **More → Users**. Everyone can change their own from **More → Change password**.

---

## Part A: Put it on the internet for free (Vercel + Neon)

About 15 minutes, all in the browser. No credit card, nothing to install on your laptop.

### Step 1: Sign up on Vercel

1. Go to https://vercel.com/signup and choose **Continue with GitHub**. Use the GitHub account that owns this repository.
2. Pick the free **Hobby** plan.

### Step 2: Import this repository

1. Click **Add New… → Project**.
2. Find `fairtechepc` in the list and click **Import**. (If it is not listed, click "Adjust GitHub App Permissions" and give Vercel access to the repository.)
3. Leave everything as it is (Framework: Next.js). Open **Environment Variables** and add one variable:

   | Name | Value |
   | --- | --- |
   | `SESSION_SECRET` | any long random text, 30+ letters and numbers, e.g. a sentence with no spaces |

4. Click **Deploy** and wait about 2 minutes. The first deploy has no database yet; that is expected. The site will show a "Database not connected" page with the next steps.

### Step 3: Create the database (inside Vercel)

1. In your new project click the **Storage** tab → **Create Database**.
2. Choose **Neon** (Postgres) → **Continue** → accept the free plan → region **Singapore** → **Create**.
3. Click **Connect Project** (it may already be connected). This automatically adds `DATABASE_URL` to your project. Nothing to copy.

### Step 4: Redeploy

1. Click the **Deployments** tab → the three dots (⋯) on the top deployment → **Redeploy** → confirm.
2. Wait about 2 minutes. This build creates all the database tables automatically.

### Step 5: Create your account

1. Click **Visit** (or open the `https://….vercel.app` link).
2. You land on the **Setup** page. Enter your name, username and password. Keep "Add sample data" ticked to explore with a sample site and job.
3. Click **Create account and start**. You are logged in as superadmin. The setup page never appears again.

### Step 6: Put it on phones like an app

Open the link in Chrome on Android → menu (⋮) → **Add to Home screen**. Do this on the site in-charge's and each supervisor's phone. Create their logins from **More → Users**.

### Photo storage (required for photos and bills)

Photos (muster, site photos, bills) are stored in **Vercel Blob**:

1. In your Vercel project open **Storage** → **Create Database** → choose **Blob** → create (or **Connect** an existing Blob store).
2. Connecting it adds `BLOB_READ_WRITE_TOKEN` to the project automatically.
3. **Deployments** → ⋯ → **Redeploy**.

Until Blob is connected, photo uploads show a clear error telling you to connect it; everything else works.

### Updating later

Every push to the `claude/session-ryyom4` branch (the repository's default branch) redeploys automatically in about 2 minutes. Database changes apply during the build.

### If you would rather create the Neon database yourself

Sign up at https://neon.tech, create a project, copy the **pooled** connection string into a Vercel environment variable named `DATABASE_URL` and the **direct** string into `DIRECT_URL`, then redeploy. The build uses `DIRECT_URL` for migrations if present, otherwise falls back to `DATABASE_URL_UNPOOLED`, then `DATABASE_URL`.

---

## Part B: Run it on your own laptop (optional, for developers)

Needs Node.js 20+ and a Postgres database (local or Neon).

```bash
npm install
cp .env.example .env          # edit DATABASE_URL, DIRECT_URL, SESSION_SECRET
npx prisma migrate deploy     # creates the tables
npm run db:seed               # optional: superadmin + sample data from SEED_* vars in .env
npm run dev                   # open http://localhost:3000 (shows /setup if you skipped the seed)
```

Set `SEED_SAMPLE_DATA=false` to seed only the superadmin and item master.

---

## Free-tier limits to be aware of

The app runs **one site** for now. The database is still multi-site, so a second
site can be added later without a rewrite; the site switcher only appears once a
second site exists.

* **Neon free:** 0.5 GB storage, database sleeps after 5 minutes idle and wakes in about 1 second on first request. Plenty for years of text records.
* **Vercel free (Hobby):** 100 GB bandwidth/month, non-commercial use policy. Photos are compressed to ~200 KB so 5 photos/day is ~30 MB/month.
* **Vercel Blob free:** 1 GB storage (from Phase 4). At ~200 KB per photo that is roughly 5,000 photos; older photos can be archived later.

## Project layout

```
prisma/schema.prisma     all tables (26 models), multi-site from day one
prisma/seed.ts           superadmin, site, sample job + 8 stages, 15 workers, item master
prisma/migrations/       SQL applied automatically on deploy
src/lib/permissions.ts   the single role → capability table (UI and API both use it)
src/lib/auth.ts          bcrypt passwords, DB-backed session cookie
src/lib/api.ts           withAuth() wrapper: every API route enforces role server-side
src/lib/audit.ts         AuditLog writer (old/new values, user, time)
src/lib/format.ts        ₹ Indian format, DD-MM-YYYY, IST helpers
src/lib/seed-data.ts     seed logic shared by the CLI seed and the one-time /setup page
scripts/build.mjs        Vercel build: prisma generate → migrate deploy → next build
src/app/(app)/           screens (mobile shell with bottom nav)
src/app/api/             JSON API routes
docs/SOP.md              one-page daily routine for the site in-charge (also at /sop in the app)
```

## Security rules implemented

* Screens a role cannot use are not rendered at all and return 404 if the URL is typed manually.
* Every API route is wrapped in `withAuth(capability)`; a supervisor calling `POST /api/jobs` gets HTTP 403.
* Site-bound roles can never read or write another site's data, even by passing a different `siteId`.
* Nothing is hard-deleted: jobs and stages are "voided" with a reason; users are deactivated.
* Every create, update, void, approve, reject, login, and password change is written to `AuditLog`.
* Passwords are bcrypt-hashed. Session tokens are stored hashed. Password reset logs the user out of every phone.
* The `/setup` page and its API only work while the database has zero users.
