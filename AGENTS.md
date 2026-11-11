# LILY — agent notes

LILY is a private B2B revenue workspace: a Next.js 15 App Router app backed by
Supabase. Every screen reads real rows; there is no sample data anywhere.

## Never do

- Rewrite published git history (no force-push, no rebase/amend/squash of
  pushed commits). Push forward only, and keep the branch working.
- Reintroduce mock/demo data into product screens. The in-memory demo store
  exists only for `DEMO_MODE=1` on a non-production build; production with
  missing Supabase env must fail closed with a 503.
- Put secret values in the repo.

## Stack

- Next.js 15 App Router, React 19, TypeScript, Tailwind, shadcn/ui.
- Supabase (Postgres + Auth). Migrations live in `supabase/migrations` and are
  applied manually in the Supabase SQL editor (`supabase db push` also works).
  Keep them additive and idempotent; a new behaviour gets a new numbered file.
- TanStack Query for client data, Resend for email, Composio for mailbox OAuth,
  Z.ai GLM + Groq for drafting.

## Where things live

- `app/api/**` — route handlers (auth, agent, admin ingest, MCP, Composio,
  mailboxes, send-email, cron).
- `app/dashboard` — client shell; `app/dashboard/page.tsx` is the chat,
  `/dashboard/overview` is the stats page, `/dashboard/assistant` redirects.
- `lib/workspace.ts` — the only place workspace rows are read/written in the
  browser (React Query + the Supabase browser client, so RLS scopes rows per
  user). Add new mutations to its `api` object.
- `lib/env.ts` — all environment access and the `is*Configured()` /
  `isDemoMode()` guards. Read env through this module.
- `lib/ssrf.ts` — DNS-resolves a host and pins the vetted address before any
  SMTP connection. Never connect to a user-supplied host without it.
- `components/lily/` — shared brand pieces; `app/globals.css` +
  `tailwind.config` hold the design tokens.

## Auth and data rules

- Sign-in is passwordless: `/api/auth/send-otp` stores a hashed 6-digit code in
  `auth_otps`, `/api/auth/verify-otp` exchanges the Supabase token. Signup never
  returns a session.
- Roles live on `profiles.role` (`client` | `super_admin`) and are enforced by
  `is_super_admin()` in RLS. Client code must never write `role`,
  `daily_lead_quota` or `id` (a trigger guards this).
- `auth_otps` and `workspace_mailboxes` have RLS on with no policies: only the
  service-role admin client touches them, and only after verifying the caller.
- Composio isolation is the Supabase auth user id used as the Composio
  `user_id`; never accept a user_id from the browser.
- Operator-only routes require both a `super_admin` profile and an email in
  `ALLOWED_OPERATOR_EMAILS`.

## Checks before shipping

```sh
npm run typecheck
npm run lint
npm run build
```

`npm run build` clears `.next`, so stop any running dev server first.
