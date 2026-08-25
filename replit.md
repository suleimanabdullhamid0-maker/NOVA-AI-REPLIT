# NOVA AI

NOVA AI is a calm personal intelligence workspace for secure conversations, research, document analysis, image creation, and account administration.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Python 3.11 + FastAPI/Uvicorn (the workspace's managed API service; provider adapters are environment-driven)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/nova-ai` — React/Vite application and PWA surface
- `artifacts/api-server/src/routes/nova.ts` — auth, conversations, assistant capability states, billing, and admin routes
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/index.ts` — PostgreSQL schema for users, sessions, conversations, and messages

## Architecture decisions

- Sessions are httpOnly cookie-backed records in PostgreSQL; passwords are salted with Node's built-in scrypt.
- The configured admin email is promoted to ADMIN + PREMIUM on login when `ADMIN_PASSWORD` is present.
- Provider-dependent capabilities fail explicitly with `configuration_required` until their secrets or managed integrations exist.

## Product

Users can sign up, sign in, maintain persistent conversation history, switch assistant modes, view usage limits, choose a premium plan, and access a protected admin console. The PWA manifest is included for installability and later native wrapping.

## User preferences

- Never hard-code credentials or provider keys.

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after OpenAPI changes, then run `pnpm run typecheck`.
- The first admin account is created/promoted only when `ADMIN_PASSWORD` is available through Replit Secrets.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
