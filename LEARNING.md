# Learning Backend: Step-by-Step Guide

This document walks through **every step** used to build this project. It’s written so a beginner can follow along and understand not only _what_ was done, but _why_.

---

## Step 1: Initialize the project

**What you did**

- Created a folder (e.g. `simple-be`) and turned it into a Node.js project with a `package.json`.

**How**

- Either run `pnpm init` (or `npm init -y`) in that folder, or create `package.json` by hand with at least `name`, `version`, and `scripts`.

**Why**

- `package.json` is the manifest of your app: name, version, scripts, and list of dependencies. Without it, you can’t use `pnpm install` or run scripts like `pnpm dev`.

**Newbie takeaway**

- Every Node.js project has a root `package.json`. Scripts defined there (e.g. `"dev": "ts-node src/index.ts"`) are run with `pnpm dev` or `npm run dev`.

---

## Step 2: Install the core dependencies

**What you did**

- Installed the libraries the backend needs to run: **Express** (web server), **TypeScript** and **ts-node** (to write and run TS), **dotenv** (to load `.env`), **cors**, **helmet**, **pino**, **pino-http**, **zod**, **prisma**, **@prisma/client**, **pg**, **@prisma/adapter-pg**.

**Why**

- **Express** – handles HTTP: routes, request/response, middleware.
- **TypeScript** – types make the code safer and easier to refactor.
- **ts-node** – runs `.ts` files directly in development without a separate build step.
- **dotenv** – reads `.env` and puts variables in `process.env` (e.g. `DATABASE_URL`).
- **cors** – allows browsers to call your API from another origin (e.g. a frontend on another port).
- **helmet** – sets security-related HTTP headers.
- **pino / pino-http** – fast logging for your app and for each HTTP request.
- **zod** – validates and parses JSON (e.g. request body) and gives clear errors.
- **prisma** – CLI and tooling for schema and migrations.
- **@prisma/client** – the generated client you use in code to talk to the database.
- **pg** – PostgreSQL driver; Prisma uses it via **@prisma/adapter-pg** to run queries.

**Newbie takeaway**

- Backend = HTTP server + database + validation + security + logging. Each of these packages covers one of those jobs.

---

## Step 3: Configure TypeScript

**What you did**

- Added `tsconfig.json` so the TypeScript compiler knows how to build your project: output folder, strict mode, where source files are.

**Important options used**

- `"rootDir": "src"` – all source code lives under `src/`.
- `"outDir": "dist"` – compiled JavaScript goes to `dist/`.
- `"strict": true` – stricter type checking (fewer bugs).
- `"include": ["src/**/*"]` – only compile files in `src/`.

**Why**

- So you can run `tsc` (or `pnpm build`) and get a clean `dist/` folder for production, and so your editor and ts-node use the same rules.

**Newbie takeaway**

- TypeScript doesn’t run in Node directly; it’s compiled to JavaScript. `tsconfig.json` is the config for that compiler.

---

## Step 4: Install Prisma and add the schema file

**What you did**

- Installed Prisma (see Step 2). Then you created `prisma/schema.prisma`, where you define your **data model** and **database connection**.

**What’s in the schema (conceptually)**

- **Generator** – “how to generate the client” (e.g. `prisma-client`, output folder).
- **Datasource** – “which database” (here: PostgreSQL). The actual URL comes from env (`DATABASE_URL`), not hardcoded in the schema.
- **Models** – each model is one table. Here you have one: **Snippet**, with fields like `id`, `title`, `code`, `language`, `createdAt`, `updatedAt`.

**Why**

- The schema is the single source of truth: same file drives migrations (database structure) and the TypeScript client (types and methods like `prisma.snippet.create()`).

**Newbie takeaway**

- Prisma = “define your tables in one place, get type-safe database access in code.” The schema file is that “one place.”

---

## Step 5: Point Prisma at the database URL (prisma.config.ts)

**What you did**

- Created `prisma.config.ts` at the project root. In it you set the schema path, migrations folder, and — importantly — the **datasource URL** from `process.env.DATABASE_URL`.

**Why**

- Prisma needs to know _where_ the database is (host, port, database name, user, password). That’s sensitive, so it’s not put in the schema file; it comes from environment variables. `prisma.config.ts` is where you tell Prisma “use `DATABASE_URL` from the environment.”

**Newbie takeaway**

- Never put real passwords in code. Use `.env` and `DATABASE_URL`, and reference them in config (e.g. `prisma.config.ts`).

---

## Step 6: Create the Snippet model in the schema

**What you did**

- In `prisma/schema.prisma` you defined the **Snippet** model: `id` (cuid), `title`, `code`, `language`, `createdAt`, `updatedAt`.

**Why**

- This is the “shape” of one row in the snippets table. `@id @default(cuid())` gives a unique ID. `@default(now())` and `@updatedAt` handle timestamps automatically.

**Newbie takeaway**

- Each **model** = one table. Each **field** = one column. Prisma will create the table when you run migrations.

---

## Step 7: Generate the Prisma client

**What you did**

- Ran `pnpm prisma generate` (or `npx prisma generate`). Prisma read `prisma/schema.prisma` and generated TypeScript code under `prisma/src/generated/prisma/` (client, types, etc.).

**Why**

- Your app doesn’t talk to the database by writing SQL by hand. It uses the **Prisma client**: `prisma.snippet.findMany()`, `prisma.snippet.create()`, etc. That client is _generated_ from your schema so it matches your models and is type-safe.

**Newbie takeaway**

- After every change to `schema.prisma`, run `prisma generate` again so the client stays in sync with your schema.

---

## Step 8: Run the first migration (create the table)

**What you did**

- You created a migration (e.g. `prisma migrate dev --name init`) so Prisma created the real PostgreSQL table(s) from your schema (e.g. the `Snippet` table).

**Why**

- The schema is just a definition. **Migrations** apply that definition to the actual database (create/alter tables). In production you run `prisma migrate deploy`; in development you use `prisma migrate dev`, which also runs migrations and can create the DB if needed.

**Newbie takeaway**

- **Schema** = what you want. **Migrations** = the steps that make the real database match that. Always run migrations (locally with `migrate dev`, in production with `migrate deploy`) before expecting tables to exist.

---

## Step 9: Connect the app to the database (lib/prisma.ts)

**What you did**

- Created `src/lib/prisma.ts`. There you create the Prisma client using the **pg** driver and `DATABASE_URL`, and export a single shared instance (`prisma`). In development you reuse that instance (singleton) so you don’t open too many connections.

**Why**

- Every route that needs the database should use the same client. Putting it in `lib/prisma.ts` means one place to read `DATABASE_URL`, one place to configure the adapter, and one shared client for the whole app.

**Newbie takeaway**

- “Database connection” in this project = one Prisma client instance, created with `DATABASE_URL`, imported wherever you need to query (e.g. in routes).

---

## Step 10: Load environment variables (dotenv)

**What you did**

- Installed `dotenv` and, at the very start of the app (e.g. in `src/index.ts`), added `import "dotenv/config"`. You also created `.env` (and `.env.example`) with `DATABASE_URL`, `PORT`, `LOG_LEVEL`, etc.

**Why**

- Config that changes per environment (dev vs prod, or your machine vs someone else’s) shouldn’t be in code. `.env` holds that config; `dotenv/config` loads it into `process.env` when the app starts.

**Newbie takeaway**

- Put secrets and environment-specific values in `.env`. Never commit real `.env` (add it to `.gitignore`). Commit `.env.example` with fake or empty values so others know what variables are needed.

---

## Step 11: Create the Express app (app.ts)

**What you did**

- Created `src/app.ts`. There you create the Express app (`express()`), then add **middleware** and **routes**.

**What is middleware?**

- Functions that run for (almost) every request, in order. They can read the request, change it, send a response, or call the next middleware. Examples: parse JSON body, log the request, add security headers.

**What you added**

- **helmet()** – security headers.
- **cors()** – allow cross-origin requests.
- **express.json()** – parse `Content-Type: application/json` body into `req.body`.
- **pinoHttp** – log each request.
- Then you mounted routes (e.g. `app.use("/snippets", snippetsRouter)`) and a final **error handler** that catches errors, logs them, and returns 500.

**Newbie takeaway**

- The Express app is a chain of middleware + routes. Order matters: e.g. `express.json()` before routes so `req.body` is already parsed when a route runs.

---

## Step 12: Add the root and health routes

**What you did**

- In `app.ts` you added:
  - `GET /` – returns something like `{ ok: true, service: "snippet-manager-api" }`.
  - `GET /health` – returns `{ status: "ok" }` with status 200.

**Why**

- Root gives a quick “is the API up?” and the service name. Health is used by load balancers, Docker, and monitoring to check if the app is alive.

**Newbie takeaway**

- Even a tiny API benefits from a known root and a health endpoint; they’re conventions for “is this service running?”

---

## Step 13: Define request validation (Zod schemas)

**What you did**

- Created `src/schemas/snippets.ts`. With **Zod** you defined:
  - **createSnippetSchema** – for POST: `title` (required, 1–255 chars), `code` (string), `language` (required, 1–50 chars).
  - **updateSnippetSchema** – for PUT: same fields, all optional.

**Why**

- You can’t trust the client. Validating with Zod ensures invalid or malicious payloads are rejected with a 400 and clear error messages (`parsed.error.flatten()`), and you get a typed `parsed.data` when valid.

**Newbie takeaway**

- Always validate request body (and query params if needed). Zod gives you one schema and both validation and TypeScript types.

---

## Step 14: Implement the snippets CRUD routes

**What you did**

- Created `src/routes/snippets.ts` and implemented:
  - **GET /** – list all snippets (e.g. `prisma.snippet.findMany()` ordered by `updatedAt` desc).
  - **POST /** – validate body with `createSnippetSchema`, then `prisma.snippet.create()`; return 201 and the created snippet.
  - **PUT /:id** – validate body with `updateSnippetSchema`, then `prisma.snippet.update()`; if Prisma throws `P2025` (record not found), return 404.
  - **DELETE /:id** – `prisma.snippet.delete()`; on `P2025`, return 404; otherwise 204.

**Why**

- This is the core API: create, read, update, delete snippets. Validation keeps data safe; handling `P2025` gives a proper 404 instead of a 500.

**Newbie takeaway**

- One router per “resource” (here, snippets). Each HTTP method + path does one thing. Validate input, call Prisma, then send the right status and JSON.

---

## Step 15: Wire the app and start the server (index.ts)

**What you did**

- Created `src/index.ts`: load env (`import "dotenv/config"`), import the app from `app.ts`, read `PORT` from env (default 3000), and call `app.listen(PORT, ...)`.

**Why**

- Entry point is separate from “building the app” so you can import the same `app` in tests or in a different server file. Keeping `listen` in one place keeps startup logic simple.

**Newbie takeaway**

- `index.ts` (or `main.ts`) = “start the app.” Everything else is “define the app” (routes, middleware, DB).

---

## Step 16: Add scripts to package.json

**What you did**

- In `package.json` you added scripts such as:
  - `dev` – run with ts-node (no separate build).
  - `build` – run `tsc` to compile to `dist/`.
  - `start` – run `node dist/index.js` for production.
  - `prisma:migrate` – run Prisma migrations in dev.

**Why**

- One-command workflow: `pnpm dev` for development, `pnpm build && pnpm start` for production. No need to remember long commands.

**Newbie takeaway**

- Scripts in `package.json` are the standard way to define how to run, build, and migrate your project.

---

## Step 17: Dockerize the app (Dockerfile + docker-compose)

**What you did**

- **Dockerfile:** Two stages. **Builder:** install deps, copy schema and source, run `prisma generate` and `pnpm build`. **Runner:** minimal image, non-root user, copy only `dist/`, `node_modules`, `package.json`, Prisma files and entrypoint; run migrations then start the server.
- **docker-entrypoint.sh:** run `npx prisma migrate deploy`, then `exec node dist/index.js`.
- **docker-compose.yml:** two services — **db** (Postgres 16, database `snippet_manager`, healthcheck) and **api** (build from Dockerfile, env `DATABASE_URL` pointing at `db`, depends on db being healthy).

**Why**

- So anyone can run “database + API” with one command (`docker-compose up`) without installing Node or Postgres. The multi-stage Dockerfile keeps the final image small and production-like.

**Newbie takeaway**

- Docker = “run this app in a box.” Docker Compose = “run app + database together.” Entrypoint = “when the container starts, run migrations, then start the server.”

---

## Summary: order of steps (learning path)

1. Initialize project (`package.json`).
2. Install dependencies (Express, TypeScript, Prisma, Zod, etc.).
3. Configure TypeScript (`tsconfig.json`).
4. Install Prisma and create `prisma/schema.prisma`.
5. Add `prisma.config.ts` and wire `DATABASE_URL`.
6. Define the Snippet model in the schema.
7. Generate the Prisma client (`prisma generate`).
8. Run the first migration (`prisma migrate dev`).
9. Create the DB connection in `src/lib/prisma.ts`.
10. Load env with dotenv and add `.env` / `.env.example`.
11. Create the Express app and middleware in `app.ts`.
12. Add root and health routes.
13. Add Zod schemas for create/update snippet.
14. Implement snippets CRUD in `src/routes/snippets.ts`.
15. Create entry point in `src/index.ts`.
16. Add npm/pnpm scripts (dev, build, start, prisma:migrate).
17. Add Dockerfile, docker-entrypoint.sh, and docker-compose.

If you follow this order, you build the backend from zero to a working, Docker-ready API. Use this file as your “learning map” and the main [README](README.md) as a reference for how everything fits together and how to run the project.
