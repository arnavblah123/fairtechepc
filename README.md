# Fairtech Site Manager

Mobile-first web app for supervising a remote fabrication site. Supervisors update from their phones; the MD approves and reviews from anywhere.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma · Postgres (Neon free tier) · Vercel free tier · Vercel Blob for photos (from Phase 4).

## What is built so far

| Phase | Module | Status |
| --- | --- | --- |
| 1 | Login, roles, user management, sites, jobs, stages | ✅ Ready to test |
| 2 | Attendance, labour master, daily plan | ⏳ next |
| 3 | Stage progress, DPR | ⏳ |
| 4 | Geotagged photos | ⏳ |
| 5 | Issues | ⏳ |
| 6 | Consumables | ⏳ |
| 7 | Machines | ⏳ |
| 8 | Petty cash, wages, advances | ⏳ |
| 9 | Superadmin dashboard and exports | ⏳ |

The database schema for **all** phases is already in `prisma/schema.prisma`, so later phases add screens, not migrations.

## Logins after seeding

| Username | Password | Role |
| --- | --- | --- |
| `arnav` (or `SEED_ADMIN_USERNAME`) | `SEED_ADMIN_PASSWORD` from `.env` | Superadmin |
| `incharge` | `site123` | Site In-charge (sample) |
| `supervisor` | `site123` | Supervisor (sample) |

Change these passwords from **More → Change password** after first login. Superadmin can reset anyone's password from **More → Users**.

---

## Part A: Run it on your own laptop (optional)

You need Node.js 20 or newer (https://nodejs.org, LTS version) and a Postgres database (Neon from Part B works fine for this too).

```bash
npm install
cp .env.example .env          # then edit .env, see below
npx prisma migrate deploy     # creates the tables
npm run db:seed               # creates your superadmin, one site, sample job, 15 workers, item master
npm run dev                   # open http://localhost:3000
```

`.env` values:

| Variable | What to put |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string |
| `DIRECT_URL` | Neon **direct** (non-pooled) connection string |
| `SESSION_SECRET` | Any long random text. On Mac/Linux run `openssl rand -hex 32` |
| `SEED_ADMIN_USERNAME` | Your login name, e.g. `arnav` |
| `SEED_ADMIN_PASSWORD` | Your first password |
| `BLOB_READ_WRITE_TOKEN` | Leave empty until Phase 4 |

---

## Part B: Put it on the internet for free (Neon + Vercel)

Total time about 20 minutes. No credit card needed.

### Step 1: Create the database on Neon

1. Go to https://neon.tech and sign up (Google login is fine).
2. Click **New Project**. Name: `fairtech`. Region: **Singapore (ap-southeast-1)** is closest to India. Click **Create**.
3. On the project dashboard click **Connect** (or "Connection Details").
4. You will see a connection string starting with `postgresql://`. There is a toggle or dropdown for **Pooled connection**.
   * Copy the **pooled** string. This is your `DATABASE_URL`.
   * Switch the toggle off (direct connection) and copy that string. This is your `DIRECT_URL`.
   * Keep both in a notepad. They contain the password, so do not share them.

### Step 2: Put the code on GitHub

If you are reading this on GitHub, this step is done. Otherwise create a free GitHub account, create a new **private** repository, and upload this folder.

### Step 3: Deploy on Vercel

1. Go to https://vercel.com and sign up with the same GitHub account.
2. Click **Add New → Project**, then **Import** next to this repository.
3. Leave Framework Preset as **Next.js**. Do not change the build command.
4. Open **Environment Variables** and add these one by one:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | pooled string from Neon |
   | `DIRECT_URL` | direct string from Neon |
   | `SESSION_SECRET` | a long random text (30+ characters, letters and numbers) |
   | `SEED_ADMIN_USERNAME` | `arnav` |
   | `SEED_ADMIN_PASSWORD` | a strong password you will use to log in |

5. Click **Deploy**. Wait 2 to 3 minutes. The build automatically creates the database tables (`prisma migrate deploy`).
6. When it says "Congratulations", click the link. You will land on the login page, but there are no users yet. Go to Step 4.

### Step 4: Create your superadmin account (one time)

The seed script runs once from your laptop, using the Neon database:

1. Install Node.js from https://nodejs.org (LTS).
2. Download this repository as a ZIP from GitHub, unzip, open a terminal in that folder.
3. Create a file named `.env` with the same five values you gave Vercel.
4. Run:

   ```bash
   npm install
   npm run db:seed
   ```

   You will see `Superadmin: arnav`, `Site: Fabrication Site 1`, `Job: SITE-001 ...`, `Workers: 15`, `Consumable items: 27`.

5. Open your Vercel link on your phone and log in.

If you do not want the sample data, delete the sample site, job and workers from inside the app after logging in (they are marked inactive/void, never deleted, as per the audit rule). Or ask for a "clean seed" and only the superadmin will be created.

### Step 5: Add it to phones like an app

Open the Vercel link in Chrome on Android → menu (⋮) → **Add to Home screen**. It opens full-screen like an app. Do this for the site in-charge and each supervisor.

### Updating later

Every time new code is pushed to the `main` branch on GitHub, Vercel redeploys automatically in about 2 minutes. Database changes are applied automatically during the build.

---

## Free-tier limits to be aware of

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
