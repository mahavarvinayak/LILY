# LILY

A private B2B revenue workspace: verified leads arrive at 08:00 IST, each with a
drafted, human-reviewed outreach pitch. Built with Next.js 15 (App Router) and
Supabase.

## What it does

- **Daily lead drop** — the operator ingests enriched leads; each one lands in a
  client workspace with a pre-drafted subject and icebreaker.
- **Pipeline** — companies, people, opportunities and tasks, all scoped per
  workspace by Postgres row-level security.
- **Outreach** — send from a connected Gmail/Outlook mailbox (Composio) or a
  custom SMTP mailbox whose password is encrypted with AES-256-GCM.
- **Agent** — a chat bar over the workspace, backed by Z.ai GLM with a Groq
  fallback.
- **Digests** — 08:00 lead drop, 13:00 outreach nudge and 18:00 daily wrap by
  email, plus an optional Slack webhook.

## Getting started

```sh
npm install
cp .env.example .env.local   # fill in Supabase + ENCRYPTION_SECRET at minimum
npm run dev
```

Apply `supabase/migrations/*.sql` in order in the Supabase SQL editor, then sign
in with a 6-digit email code. New workspaces are created through the signup
form and must complete the 7-question ICP calibration before the dashboard
opens.

### Required environment

| Variable | Required | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Auth + all client data |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | OTP codes, mailbox storage, operator routes |
| `ENCRYPTION_SECRET` | yes | SMTP password encryption + OTP HMAC |
| `CRON_SECRET` | yes | `/api/cron/daily-digest` bearer auth |
| `LILY_MCP_SECRET_KEY` | yes | `/api/mcp` bearer auth |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | for email | OTP delivery + digests |
| `GROQ_API_KEY`, `ZAI_*` | for AI | drafts and the agent |
| `COMPOSIO_API_KEY` | for connectors | Gmail / Outlook / Calendar OAuth |
| `SLACK_WEBHOOK_URL` | optional | Slack digests |
| `NEXT_PUBLIC_APP_URL` | yes | redirects and email links |
| `DEMO_MODE` | optional | `1` serves the in-memory demo workspace (non-production only) |

## Scripts

```sh
npm run dev        # local dev server
npm run build      # production build (stop the dev server first)
npm run start      # serve the build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```
