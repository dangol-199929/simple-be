# Snippet Manager API (simple-be)

**Target audience:** Developers who need to run, extend, or deploy this backend.

## Overview

**simple-be** is a small REST API for managing code snippets. It stores snippets (title, code, language) in PostgreSQL and exposes CRUD endpoints. The app is built with **Express**, **Prisma**, **TypeScript**, and **Zod**, and is designed to run locally or in Docker.

## Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Runtime      | Node.js 22                              |
| Framework    | Express 5                               |
| Database     | PostgreSQL 16 (Prisma ORM, driver `pg`) |
| Validation   | Zod                                     |
| Logging      | Pino + pino-http                        |
| Security     | Helmet, CORS                            |
| Package mgmt | pnpm                                    |

## How It Works

- **Entry:** `src/index.ts` loads env (dotenv), creates the Express app from `src/app.ts`, and listens on `PORT` (default 3000).
- **App:** `src/app.ts` wires global middleware (Helmet, CORS, JSON, request logging), mounts the snippets router at `/snippets`, and registers a global error handler that logs and returns 500.
- **Data:** Prisma client is created in `src/lib/prisma.ts` using the `@prisma/adapter-pg` adapter and `DATABASE_URL`. The schema lives in `prisma/schema.prisma`; the client is generated to `prisma/src/generated/prisma/` (see `prisma.config.ts`).
- **Validation:** Create/update payloads are validated with Zod in `src/schemas/snippets.ts`; invalid bodies return 400 with `details` from `flatten()`.
- **Snippets API:** `src/routes/snippets.ts` implements list (GET), create (POST), update (PUT), delete (DELETE). Updates/deletes return 404 when the record is not found (Prisma `P2025`).

## Project Structure

```
simple-be/
├── prisma/
│   ├── schema.prisma          # Snippet model and DB config
│   └── src/generated/prisma/  # Generated Prisma client
├── prisma.config.ts           # Prisma config, migrations path, datasource URL
├── src/
│   ├── index.ts               # Start server
│   ├── app.ts                 # Express app, middleware, routes
│   ├── lib/prisma.ts          # Prisma client singleton (pg adapter)
│   ├── routes/snippets.ts     # /snippets CRUD
│   └── schemas/snippets.ts    # Zod schemas for create/update
├── Dockerfile                 # Multi-stage build + runner
├── docker-compose.yml         # api + db services
├── docker-entrypoint.sh       # migrate deploy + node dist/index.js
├── package.json
└── tsconfig.json
```

## API Endpoints

| Method | Path            | Description                                                 |
| ------ | --------------- | ----------------------------------------------------------- |
| GET    | `/`             | Service info: `{ ok, service }`                             |
| GET    | `/health`       | Health check: `{ status: "ok" }`                            |
| GET    | `/snippets`     | List all snippets (newest first)                            |
| POST   | `/snippets`     | Create snippet (body: `title`, `code`, `language`)          |
| PUT    | `/snippets/:id` | Update snippet (body: optional `title`, `code`, `language`) |
| DELETE | `/snippets/:id` | Delete snippet (204)                                        |

**Snippet model:** `id` (cuid), `title`, `code`, `language`, `createdAt`, `updatedAt`.

**Validation (Zod):**

- Create: `title` (1–255), `code` (string), `language` (1–50).
- Update: same fields, all optional.

## Running Locally

1. **Dependencies and DB**
   - Copy `.env.example` to `.env` and set `DATABASE_URL` (e.g. local Postgres).
   - Install: `pnpm install`
   - Migrate: `pnpm prisma:migrate` (or `prisma migrate dev`).

2. **Generate Prisma client and run**
   - Generate: `pnpm prisma generate` (or run as part of migrate).
   - Dev: `pnpm dev` (ts-node).
   - Build + run: `pnpm build` then `pnpm start`.

## Running with Docker

- **Stack:** `docker-compose up --build` runs:
  - **db:** Postgres 16, DB `snippet_manager`, healthcheck.
  - **api:** Built from `Dockerfile`, `docker-entrypoint.sh` runs `prisma migrate deploy` then `node dist/index.js`; expects `DATABASE_URL` (and optional `PORT`, `LOG_LEVEL`).

- **Dockerfile:** Two stages:
  1. **builder:** Node 22 Alpine, pnpm, install → copy Prisma + source → `prisma generate` + `pnpm build`.
  2. **runner:** Node 22 Alpine, non-root user `expressjs`, copy `dist`, `node_modules`, `package.json`, `prisma`, `prisma.config.ts`, entrypoint; `EXPOSE 3000`, `NODE_ENV=production`, `PORT=3000`.

## Environment Variables

| Variable       | Required | Description                                            |
| -------------- | -------- | ------------------------------------------------------ |
| `DATABASE_URL` | Yes      | PostgreSQL connection string (used by Prisma and API). |
| `PORT`         | No       | Server port (default `3000`).                          |
| `LOG_LEVEL`    | No       | Pino level (default `info`).                           |
| `NODE_ENV`     | No       | e.g. `development` / `production`.                     |

## Scripts

- `pnpm dev` — run with ts-node.
- `pnpm build` — compile TypeScript to `dist/`.
- `pnpm start` — run `node dist/index.js`.
- `pnpm prisma:migrate` — run Prisma migrations in dev.

---

_This README describes the current behavior of the Snippet Manager API (simple-be) as implemented in the codebase._
