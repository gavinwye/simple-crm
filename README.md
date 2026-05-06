# GovTech Stakeholders – working pilot

A Next.js + SQLite implementation of the CRM described in `../SPEC.md`.

This is the pilot build: real database, real auth, real email-ingestion endpoint, real Claude extraction. Where production credentials aren't available it falls back to sensible local defaults so you can run the whole thing on your laptop without configuring anything.

## Requirements

- Node.js 20 or later (22 recommended)
- macOS, Linux, or WSL — `better-sqlite3` builds a small native module on install. On macOS you need Xcode Command Line Tools (`xcode-select --install`) the first time only.

## Quick start

From the `web/` folder:

```bash
npm install        # installs deps and compiles the SQLite native module
npm run db:push    # creates the SQLite schema in data/dev.db
npm run db:seed    # populates it with the prototype's fictional data
npm run dev        # starts the app at http://localhost:3000
```

Open http://localhost:3000. Pick a seeded user on the sign-in page (Abisola is the admin); you're in. The `npm run setup` shortcut runs install + db:push + db:seed in one step.

To wipe and re-seed: `npm run db:reset`.

## What works out of the box

- **Sign-in.** Local mode shows a "pick a user" page with the three seeded users. No password. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` to switch to real Google Workspace OAuth (the `hd` domain check rejects anyone outside `ALLOWED_HD`).
- **Dashboard, contacts, organisations, meetings, search, action items.** All read from the SQLite database, all writeable for `admin` and `member` roles.
- **Log a meeting.** The form uses a server action that writes a real interaction with attendees, internal attendees, and action items. Land on the saved meeting after submit.
- **Search.** Substring search across contacts, organisations, meetings, emails, and notes. Highlights matches.
- **Email webhook.** `POST /api/inbound/email` accepts a Postmark-shaped payload, matches participants to existing contacts, runs Claude extraction (or the deterministic stub when no API key is set), and creates a `pending` interaction the team can review.
- **Email review.** `/emails/[id]/review` lets a member confirm or reject an extraction; on confirm, the suggested actions become real action items.
- **Audit log.** Every sign-in, meeting save, email ingest, confirm, reject, and sign-out is recorded to the `audit_log` table. (No UI yet; query the DB directly for the pilot.)
- **RBAC.** `admin` sees everything plus the (placeholder) admin section; `member` can read and write; `viewer` can read only — the *New meeting* button is hidden and `requireRole('member')` server actions reject them.

## Try the email webhook

While `npm run dev` is running, in another terminal:

```bash
curl -X POST http://localhost:3000/api/inbound/email \
  -H "content-type: application/json" \
  -d '{
    "From": "sandra.husbands@mist.gov.bb",
    "To": "abisola@govtech.bb",
    "Cc": "marcus.bynoe@finance.gov.bb",
    "Subject": "Quick update on the rollout",
    "TextBody": "Hi Abisola, could you please refresh the risk register before Friday and share with the team? Thanks, Sandra"
  }'
```

You'll get back a `reviewUrl`. Open it in the browser to confirm the extraction.

## Optional: enable real Claude extraction

Drop your Anthropic API key into `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Without a key, the email webhook uses a deterministic stub that produces a believable summary and one or two suggested actions based on simple keyword cues. Useful for demos.

## Optional: enable Google Workspace sign-in

Create OAuth client credentials in Google Cloud (web application, redirect URI `http://localhost:3000/api/auth/google/callback`) and set in `.env.local`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ALLOWED_HD=govtech.bb
```

When `GOOGLE_CLIENT_ID` is set the sign-in page shows the Google button instead of the user picker. Sign-in is rejected unless the ID token's `hd` claim matches `ALLOWED_HD`.

For production, also verify the ID token signature against Google's JWKS — the current code decodes the JWT but doesn't verify the signature. There's a `TODO` in `src/app/api/auth/google/callback/route.ts`.

## Project layout

```
web/
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── drizzle.config.ts
├── .env.example
├── data/                 SQLite database (gitignored)
├── drizzle/              auto-generated migrations
└── src/
    ├── app/
    │   ├── layout.tsx              root html shell
    │   ├── page.tsx                redirects to /dashboard or /signin
    │   ├── globals.css
    │   ├── signin/page.tsx
    │   ├── (app)/
    │   │   ├── layout.tsx          sidebar + topbar
    │   │   ├── dashboard/page.tsx
    │   │   ├── contacts/page.tsx
    │   │   ├── contacts/[id]/page.tsx
    │   │   ├── organisations/page.tsx
    │   │   ├── organisations/[id]/page.tsx
    │   │   ├── meetings/page.tsx
    │   │   ├── meetings/new/page.tsx     (server action saves to DB)
    │   │   ├── meetings/[id]/page.tsx
    │   │   ├── emails/[id]/review/page.tsx
    │   │   ├── search/page.tsx
    │   │   └── actions/page.tsx
    │   └── api/
    │       ├── auth/signout/route.ts
    │       ├── auth/google/start/route.ts
    │       ├── auth/google/callback/route.ts
    │       └── inbound/email/route.ts
    ├── components/
    │   ├── sidebar.tsx
    │   └── topbar.tsx
    ├── db/
    │   ├── schema.ts                Drizzle schema
    │   ├── index.ts                 DB client
    │   └── seed.ts                  fictional data
    └── lib/
        ├── auth.ts                  cookie sessions, role checks
        ├── audit.ts                 audit log writer
        ├── claude.ts                Anthropic client + stub extractor
        └── utils.ts                 dates, initials, colours
```

## What's still cut from the pilot

These are intentionally not in this build (Phase 2/3 in the spec):

- **Granola transcript ingestion.** The new-meeting form already accepts a transcript paste, but there's no API endpoint or webhook listener. Easy to add: a sister to `/api/inbound/email` that does the same Claude extraction.
- **File attachments.** The schema has an `attachments` column on the email model and a slot in the meeting form, but no upload UI or storage adapter yet.
- **Background jobs (Inngest).** Email extraction runs synchronously inside the webhook. For production move it to a queue.
- **Postgres.** SQLite is the local default. Switching to Postgres is a `drizzle.config.ts` and `db/index.ts` change; the schema is dialect-portable.
- **Audit log viewer.** The `audit_log` table is being written; nothing reads it in the UI.
- **CSV import.** Schema is ready; no UI yet.
- **Sensitivity-based query filtering.** The flag is stored and shown; no read filter is applied yet.
- **Real Google ID-token signature verification.** Currently decoded but not verified — see the TODO in the callback route.

## Switching to Postgres

When you're ready (e.g. moving to Vercel + Neon, or AWS + RDS):

1. Add `postgres` and `@types/pg` deps; remove `better-sqlite3`.
2. In `drizzle.config.ts` change `dialect: 'sqlite'` to `'postgresql'` and the `dbCredentials.url` to your Postgres URL.
3. In `src/db/index.ts` swap the better-sqlite3 driver for `drizzle-orm/postgres-js` or `node-postgres`.
4. In `src/db/schema.ts`, change `sqliteTable` → `pgTable` and `integer({ mode: 'timestamp' })` → `timestamp()`. The rest of the schema is identical.
5. Run `npm run db:push` against the Postgres URL and re-seed.

The application code (queries, server actions, routes) does not change.

## Notes

- The "pick a user" sign-in is a development convenience. Disable it in production by setting `GOOGLE_CLIENT_ID`.
- All data is fictional. The seed includes nine organisations, fourteen contacts, eight interactions, nine action items.
- The pilot banner on the dashboard reminds users data may be migrated before general release. Edit it in `src/app/(app)/dashboard/page.tsx`.
