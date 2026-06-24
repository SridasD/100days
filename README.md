# HDP Kerala — 100 Days Programme Portal (v2 rebuild)

Next.js 15 + TypeScript + Tailwind + ShadCN UI + Drizzle ORM + NextAuth.js v5
rebuild of `100days.kerala.gov.in`. Architecture reference:
`HDP_Platform_Blueprint_v2.md`.

## Quickstart

```bash
cp .env.example .env.local
# fill in DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)

npm install
npm run db:push          # apply Drizzle schema to the hdp PostgreSQL schema
npm run dev              # http://localhost:3000
```

## Stack

| Layer        | Choice                                |
| ------------ | ------------------------------------- |
| Framework    | Next.js 15 (App Router)               |
| Language     | TypeScript                            |
| UI           | Tailwind CSS + ShadCN UI              |
| Auth         | NextAuth.js v5 (Credentials + bcrypt) |
| ORM          | Drizzle ORM + node-postgres           |
| Validation   | Zod (shared client + server)          |
| Forms        | React Hook Form + Zod resolvers       |

## Folder structure

See Section 6 of `HDP_Platform_Blueprint_v2.md`. Route groups:

- `app/(public)` — citizen-facing dashboards, no login
- `app/(auth)`   — login, forgot/reset/change password
- `app/(officer)` — Nodal Officer (role_id = 2)
- `app/(verify)` — Verification Officer (role_id = 1)
- `app/(admin)`  — Admin / Super Admin (role_id = 3)

## Database

Connects to the existing `hdp` PostgreSQL schema. Required alterations
(Section 4.2 of the blueprint) live in `lib/db/migrations/`.
