LOOP — Multi-Tenant Feedback Intelligence Platform
LOOP is a B2B SaaS feedback analytics platform that ingests customer feedback, automatically classifies and clusters it using AI, and lets teams ask plain-English questions or generate executive-ready reports — all grounded in real data.
Built as a capstone project aligned with production-level standards.
---
Tech Stack
Layer	Technology
Framework	Next.js 14 App Router + TypeScript (monolith)
Styling	Tailwind CSS
Database	PostgreSQL via Supabase
ORM	Prisma 5.22.0 (pinned exactly — see Gotchas)
Auth	Auth.js / NextAuth v5 beta, Credentials provider, JWT sessions
AI	Google Gemini API (`gemini-3.6-flash`, `gemini-embedding-001`)
Vector search	pgvector
Charts	Recharts
Validation	Zod
PDF export	`@react-pdf/renderer`
Deploy target	Vercel
---
AI Features
AI1 — Auto-classification
Every piece of feedback is automatically tagged with sentiment, a sentiment score, a feature-area label, and lightweight theme tags — strictly JSON-validated via Zod, stored on the record (not recomputed), with a manual re-classify action for corrections.
AI2 — Theme clustering & trends
New feedback is matched to an existing workspace theme or forms a new one in real time. A trends view compares the last 30 days against the prior 30 days and flags themes that are spiking. Clicking a theme drills into its underlying feedback.
AI3 — Ask LOOP (grounded Q&A)
A chat interface answers plain-English questions about your feedback. Questions are embedded and matched against real feedback embeddings via pgvector cosine similarity; answers are generated only from retrieved items and cite their sources. If nothing relevant is found, it says so rather than inventing an answer.
AI4 — Voice-of-Customer report
Generates a report for any custom date range: real aggregated sentiment shifts, top themes, verbatim quotes, and AI-synthesized recommended actions. Reports are saved, viewable later, and exportable as PDF.
---
Roles & Permissions
Role	Permissions
Admin	Everything Analyst can do, plus intended to manage members and roles (see Known Limitations)
Analyst	Ingest and manage feedback: CSV upload, simulate channel, change status, re-classify, generate reports
Viewer	Read-only across the app
RBAC is enforced server-side on every mutating route (returns `403 FORBIDDEN` for Viewer). The UI also hides or disables restricted controls for Viewer via a lightweight `GET /api/me` role check, so the interface doesn't show clickable controls that the backend would reject.
---
Getting Started
1. Clone and install
```powershell
npm install
```
2. Environment variables
Create a `.env` file in the project root with:
```env
DATABASE_URL="postgresql://...@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...@aws-0-<region>.pooler.supabase.com:5432/postgres"
AUTH_SECRET="your-generated-secret"
GEMINI_API_KEY="your-free-tier-key-from-aistudio.google.com"
```
> ⚠️ `DATABASE_URL` (port 6543, pooled) is used at runtime. `DIRECT_URL` (port 5432, direct) is required for migrations. Both point to the same Supabase project.
3. Set up the database
```powershell
npx prisma generate
npx prisma db push
npx prisma db seed
```
> If `migrate dev` prompts to reset the schema due to Supabase's auto-installed extensions (`pg_stat_statements`, `pgcrypto`, etc.), use `db push` instead — see Gotchas below.
4. Backfill real embeddings (first-time setup only)
The seed script inserts placeholder vectors. Replace them with real Gemini embeddings:
```powershell
npx tsx scripts/backfillEmbeddings.ts
```
5. Run the dev server
```powershell
npm run dev
```
Visit http://localhost:3000 (not the network IP — see Gotchas).
Demo logins
All seeded accounts use the password `password123`:
`admin@neat.com` / `analyst@neat.com` / `viewer@neat.com`
(a second seeded workspace, Globex Corp, also exists with the same role pattern under `@globexcorp.com`)
---
Project Structure (key paths)
```
app/
  api/
    me/route.ts                    GET — current user's role/workspace (for UI gating)
    feedback/route.ts              GET (paginated/filtered), POST (create + classify)
    feedback/[id]/route.ts         PATCH status update
    feedback/[id]/reclassify/      PATCH manual re-classify
    insights/route.ts              POST — Ask LOOP grounded Q&A
    reports/route.ts               GET (list), POST (generate)
    reports/[id]/route.ts          GET single report
  dashboard/
    error.tsx                      Shared error boundary for all dashboard pages
    not-found.tsx                  Shared styled 404 for all dashboard pages
    feedback/page.tsx              Inbox UI
    themes/
      page.tsx                     Trends UI
      loading.tsx                  Skeleton while trends load
    AskPage/page.tsx                Ask LOOP chat UI
    reports/
      page.tsx                     Report list + generate form
      [id]/
        page.tsx                   Report view + PDF export
        loading.tsx                Skeleton while report loads
        DownLoadPdfButton.tsx      PDF export component
    analytics/page.tsx             Charts dashboard
lib/
  ai/
    classify.ts                    AI1 — classification
    assignTheme.ts                 AI2 — theme clustering
    embed.ts                       AI3 groundwork — embeddings
    storeEmbedding.ts              Raw SQL upsert for pgvector
    generateReport.ts              AI4 — report generation
scripts/
  backfillEmbeddings.ts            One-time real-embedding backfill
prisma/
  schema.prisma
  seed.ts
```
---
Known Gotchas (avoid repeating these)
Prisma version drift: must stay pinned exactly at `5.22.0` (`--save-exact`) — a plain `npm install` can silently pull v7 and break the schema.
Supabase migration drift: `migrate dev` will prompt to reset the schema because Supabase auto-installs extensions (`pg_stat_statements`, `pgcrypto`, `supabase_vault`, `uuid-ossp`) that aren't in migration history. Use `npx prisma db push` for additive, non-destructive schema changes instead.
Gemini model names change: if you hit a `404` on a model name, check Google AI Studio for the current recommended model (we migrated from `gemini-2.5-flash` → `gemini-3.6-flash` mid-project).
Gemini embedding normalization: `gemini-embedding-001` requires manual L2 normalization when requesting a non-default output dimension (we use 1536 to match the `vector(1536)` column).
NextAuth session must expose `id`: the `jwt` and `session` callbacks must explicitly copy `user.id` → `token.id` → `session.user.id`, or foreign keys relying on it (like `Report.generatedById`) will silently fail. Sign out and back in after changing callbacks — JWTs are cached client-side.
Next.js 16 async `params`: dynamic route `params` must be `await`-ed (`const { id } = await params`) before use. Accessing `params.id` synchronously silently returns `undefined`, and Prisma silently drops `undefined` filter values — this can cause queries to return the wrong (or first) record instead of erroring.
Next.js file routing is case-sensitive: a folder like `[Id]` will not match code destructuring `params.id`. Windows' filesystem is case-preserving but case-insensitive, so a rename that changes only casing can silently fail — use a two-step rename (`[Id]` → `[id_temp]` → `[id]`) if this happens.
Route files must be named exactly `page.tsx`: Next.js App Router ignores any other filename (e.g. `ReportPage.tsx`) as a route — the containing folder name becomes the URL segment, but the file itself must be `page.tsx`.
PowerShell and bracket folders: commands like `Get-Content` or `Rename-Item` interpret `[...]` as wildcard syntax. Use `-LiteralPath` when targeting dynamic-route folders (e.g. `[id]`).
A working button isn't proof of authorization: RBAC must be verified server-side, not by whether a UI control is clickable. We found the backend correctly rejected Viewer's mutating requests even though the UI didn't yet hide those controls — a UX gap, not a security bug, but worth testing both layers explicitly.
Access via `localhost:3000`, never the `192.168.x.x` network IP — it breaks HMR and can make auth appear broken when it isn't.
`.env` edits: Notepad has silently failed to save changes; prefer `Add-Content` in PowerShell and verify with `Get-Content` after.
---
