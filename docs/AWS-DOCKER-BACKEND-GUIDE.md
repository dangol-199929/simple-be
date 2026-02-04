# AWS + Docker Backend Guide

**Purpose:** Reference for building and deploying a Node.js/Express backend on AWS (ECS Fargate, RDS PostgreSQL, ALB) with Docker and CDK. Covers architecture, workflows, and **every bug we solved** so you can reuse this for future backend development.

**Target audience:** Developers doing backend work on AWS and Docker (local → ECR → ECS).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [What Was Built (Phases 1–3)](#2-what-was-built-phases-13)
3. [Tech Stack & Key Files](#3-tech-stack--key-files)
4. [Bugs Solved (Reference)](#4-bugs-solved-reference)
5. [Commands & Workflows](#5-commands--workflows)
6. [Lessons & Best Practices](#6-lessons--best-practices)

---

## 1. Architecture Overview

```
Internet → ALB (port 80) → ECS Fargate (api container, port 3000) → RDS PostgreSQL (port 5432)
                ↑                          ↑
         Target group              DB credentials from
         health check /health       Secrets Manager (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME)
```

- **VPC:** Public + private subnets, 2 AZs, 1 NAT gateway (cost-conscious).
- **ALB:** Public, routes HTTP to the ECS service target group; health check on `/health`.
- **ECS Fargate:** One task (512 MB, 0.25 vCPU), private subnets, no public IP. Image from ECR.
- **RDS:** PostgreSQL 16 (`db.t4g.micro`) in private subnets; master secret in Secrets Manager.
- **Security groups:** ALB ← internet:80; ECS ← ALB:3000; RDS ← ECS:5432.

---

## 2. What Was Built (Phases 1–3)

| Phase                             | Scope            | Deliverables                                                                                                                                                                    |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Local containerization**     | Backend + Docker | Express API, Prisma + pg adapter, Zod, Pino; Dockerfile (multi-stage); `docker-entrypoint.sh` (migrate + start); docker-compose (api + postgres).                               |
| **2. Cloud infrastructure (CDK)** | Infra as code    | VPC, RDS, ECR, ECS cluster + Fargate service, ALB, target group, security groups; DB secret; CDK outputs (ApiRepoUri, AlbDnsName, EcsClusterName, EcsServiceName, DbSecretArn). |
| **3. CI/CD**                      | Deploy pipeline  | GitHub Actions: checkout → AWS auth → ECR login → build image → push to ECR → `aws ecs update-service --force-new-deployment`.                                                  |

**Phase 4 (production hardening)** — monitoring, budget alarms, stop exposing error details in 500 responses — is not covered in this doc.

---

## 3. Tech Stack & Key Files

| Layer      | Technology       | Notes                                                                                      |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------ |
| Runtime    | Node.js 22       | In Docker and ECS.                                                                         |
| Framework  | Express 5        | App in `src/app.ts`, entry `src/index.ts`.                                                 |
| Database   | PostgreSQL 16    | RDS; Prisma ORM with `@prisma/adapter-pg` (driver `pg`).                                   |
| Config     | Prisma 7         | `prisma.config.ts` holds `datasource.url` (from env); schema has no `url` in `datasource`. |
| Validation | Zod              | Request bodies in `src/schemas/snippets.ts`.                                               |
| Logging    | Pino + pino-http | ECS logs to CloudWatch via `awslogs` driver.                                               |

**Key files:**

| File                           | Role                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma.config.ts`             | Prisma config; `datasource.url = process.env.DATABASE_URL`.                                                                                                 |
| `prisma/schema.prisma`         | Model + generator; `output = "../src/generated/prisma"`.                                                                                                    |
| `src/lib/prisma.ts`            | Prisma client: build URL from `DATABASE_URL` or `DB_*`; for RDS use pg `PoolConfig` with `ssl: { rejectUnauthorized: false }` and strip `sslmode` from URL. |
| `docker-entrypoint.sh`         | If no `DATABASE_URL`, build it from `DB_*`; `prisma migrate deploy`; `exec node dist/index.js`.                                                             |
| `Dockerfile`                   | Multi-stage: builder (install, generate, build) → runner (dist + node_modules + prisma + entrypoint); `npm install` (not pnpm) with retries.                |
| `infra/lib/infra-stack.ts`     | CDK: VPC, RDS, ECR, ECS task def (secrets from Secrets Manager), service, ALB, target group, health check.                                                  |
| `.github/workflows/deploy.yml` | Build image, push ECR, force ECS deploy; uses GitHub secrets for AWS and ECS.                                                                               |

---

## 4. Bugs Solved (Reference)

Each entry: **symptom** → **cause** → **fix**. Use this when you hit similar issues.

---

### 4.1 Prisma 7 — `datasource.url` in schema

- **Symptom:** Prisma expects `url` in `schema.prisma` or errors.
- **Cause:** Prisma 7 can drive the URL from config; having it only in config is valid.
- **Fix:** Do **not** put `url = env("DATABASE_URL")` in `prisma/schema.prisma`. Put only `provider = "postgresql"` in `datasource` and set `datasource.url` in `prisma.config.ts` via `process.env.DATABASE_URL`.

---

### 4.2 Prisma client generated path

- **Symptom:** Imports from generated client fail or client is in wrong place.
- **Cause:** Generator `output` pointed to a path not under `src/`.
- **Fix:** In `prisma/schema.prisma`, set `output = "../src/generated/prisma"` so the client is under `src/` and imports like `from "../generated/prisma/client"` resolve.

---

### 4.3 Prisma 7 + `@prisma/adapter-pg` — client constructor

- **Symptom:** `PrismaClient` constructor or datasource URL not accepted.
- **Cause:** Prisma 7 with driver adapters uses adapter + optional URL; URL can come from adapter config.
- **Fix:** Use `@prisma/adapter-pg`: create a `pg.Pool` config (or connection string) and pass it to `new PrismaPg(...)`. Build connection string from `DATABASE_URL` or `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_NAME` in `src/lib/prisma.ts`.

---

### 4.4 TypeScript — `@types/cors` / `@types/pg` missing

- **Symptom:** TS errors for `cors` or `pg` types.
- **Fix:** Install types: `pnpm add -D @types/cors @types/pg` (or npm equivalent).

---

### 4.5 `req.params.id` type mismatch

- **Symptom:** TypeScript error using `req.params.id` (e.g. in PUT/DELETE).
- **Cause:** Express typings can give `params.id` as `string | undefined` or array.
- **Fix:** Coerce once: `const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0]` and check `id` before use.

---

### 4.6 Docker — ECR URI malformed (e.g. double dot)

- **Symptom:** `docker push` or pull fails; URI looks wrong.
- **Cause:** Building ECR URI without region or with a typo (e.g. `..amazonaws.com`).
- **Fix:** Use exact format: `{account}.dkr.ecr.{region}.amazonaws.com/{repository-name}`. In CI, set `ECR_URI` from `aws sts get-caller-identity` and `AWS_REGION` (e.g. from secrets).

---

### 4.7 Docker — using pnpm lock in Dockerfile

- **Symptom:** Docker build fails (lockfile version mismatch or missing pnpm).
- **Cause:** Image uses `npm` but repo has only `pnpm-lock.yaml`.
- **Fix:** In Dockerfile use `npm install` (and copy `package.json` only, or a minimal lockfile if you want). Optionally add `npm config set fetch-retries` and timeouts to reduce flakiness.

---

### 4.8 Docker — `ECONNRESET` during `npm install` in build

- **Symptom:** Intermittent connection reset while fetching packages.
- **Fix:** In Dockerfile before `npm install`:  
  `RUN npm config set fetch-retries 5 && npm config set fetch-retry-mintimeout 20000 && npm config set fetch-retry-maxtimeout 120000`  
  then run `npm install`.

---

### 4.9 ECR repository not found

- **Symptom:** Push or reference to ECR repo fails.
- **Cause:** Repo not created yet or wrong name/region.
- **Fix:** Ensure CDK stack that creates the ECR repo has been deployed (`cdk deploy`). If you created the repo manually, use the exact same name (e.g. `snippet-manager-api`) in build/push and in the task definition image.

---

### 4.10 ECS — `CannotPullContainerError` / platform mismatch

- **Symptom:** ECS task fails to start; error indicates image platform mismatch.
- **Cause:** Image built on Apple Silicon is `linux/arm64`; Fargate task definition was `X86_64` (or the opposite).
- **Fix:** Build for the same platform as the task definition. For Fargate X86_64:  
  `docker build --platform linux/amd64 -t <ecr-uri>:latest .`  
  Push that image. In CI (e.g. GitHub Actions on `ubuntu-latest`), the default is usually amd64; if you use an arm runner, add `--platform linux/amd64` to the build step.

---

### 4.11 ECS task exits (e.g. Exit code 1) — Prisma / DB URL

- **Symptom:** Task starts then stops; Prisma or migration complains about missing `datasource.url`.
- **Cause:** ECS injects `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` from Secrets Manager, but the app and Prisma CLI expect `DATABASE_URL`. Entrypoint runs before the Node app; if it doesn’t set `DATABASE_URL`, `prisma migrate deploy` and/or the app see no URL.
- **Fix:** In `docker-entrypoint.sh`, if `DATABASE_URL` is unset and `DB_HOST`/`DB_USERNAME`/`DB_PASSWORD` are set, build and export `DATABASE_URL` from those vars (and `DB_PORT`/`DB_NAME`), then run `npx prisma migrate deploy` and `exec node dist/index.js`. Example:
  ```sh
  if [ -z "$DATABASE_URL" ] && [ -n "$DB_HOST" ] && [ -n "$DB_USERNAME" ] && [ -n "$DB_PASSWORD" ]; then
    DB_NAME="${DB_NAME:-snippet_manager}"
    DB_PORT="${DB_PORT:-5432}"
    export DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&sslmode=no-verify"
  fi
  npx prisma migrate deploy
  exec node dist/index.js
  ```

---

### 4.12 GET /snippets returns 500 — “Internal server error”

- **Symptom:** `/health` is 200 but `/snippets` returns 500 with no detail (or with a message if you exposed it).
- **Cause:** App can reach DB, but TLS handshake fails: Node rejects the RDS server certificate (“self-signed certificate in certificate chain”).
- **Fix (two parts):**
  1. **Use TLS but don’t verify server cert for RDS**  
     In `src/lib/prisma.ts`, when connecting to RDS (e.g. when `DB_HOST` is set), pass a **pg `PoolConfig`** to `PrismaPg`, not only a connection string:
     - `connectionString`: your Postgres URL (see below for stripping).
     - `ssl: { rejectUnauthorized: false }`  
       So the `pg` driver uses TLS but does not verify the server certificate.

  2. **Don’t let the URL override SSL config**  
     The `pg` library merges parsed connection-string options over your config. If the URL has `sslmode=require`, pg-connection-string can set `ssl: {}` without `rejectUnauthorized: false`, so you still get strict verification.  
     **Fix:** When using RDS (`DB_HOST` set), strip `sslmode` (and `ssl`) from the connection string before passing it to the adapter. Build the `PoolConfig` as:
     - `connectionString`: result of stripping `sslmode`/`ssl` from `getConnectionString()` (e.g. via `URL` search params or regex).
     - `ssl: { rejectUnauthorized: false }` (only for RDS path).  
       Then pass this `PoolConfig` to `new PrismaPg(poolConfig)`.

  **Entrypoint:** For `prisma migrate deploy`, you can keep building `DATABASE_URL` from `DB_*` and append `&sslmode=no-verify` so the CLI uses TLS without verification; the Node app relies on the PoolConfig above, not on the URL’s sslmode.

---

### 4.13 Seeing the real error when /snippets returns 500

- **Symptom:** You get `{"error":"Internal server error"}` and need the actual exception.
- **Fix (debugging only):** In the global error handler, log `err`, `message`, and `stack`, and optionally include `message` (and if needed `stack`) in the 500 JSON response. Use an env flag (e.g. `EXPOSE_ERROR=1`) if you want to enable this only in non-production. For production, remove or gate this so responses don’t leak internals.

---

## 5. Commands & Workflows

### 5.1 Local run (no Docker)

```bash
pnpm install
cp .env.example .env   # set DATABASE_URL
npx prisma migrate dev
pnpm dev
```

### 5.2 Local run with Docker

```bash
docker compose up -d
# API: http://localhost:3000
```

### 5.3 Build image for ECS (e.g. Apple Silicon → Fargate amd64)

```bash
docker build --platform linux/amd64 -t 508261694268.dkr.ecr.us-east-1.amazonaws.com/snippet-manager-api:latest .
```

(Replace account/region/repo with your ECR URI.)

### 5.4 Push to ECR and deploy ECS

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 508261694268.dkr.ecr.us-east-1.amazonaws.com
docker push 508261694268.dkr.ecr.us-east-1.amazonaws.com/snippet-manager-api:latest
aws ecs update-service \
  --cluster InfraStack-ClusterEB0386A7-VTrbcgZs7cxw \
  --service InfraStack-ServiceD69D759B-tGtFGcu1HdHE \
  --force-new-deployment \
  --region us-east-1
```

(Replace cluster/service/region with your CDK outputs.)

### 5.5 CDK deploy (infra only; does not build or push the app image)

```bash
cd infra
npm ci
npx cdk deploy
```

### 5.6 Test API after deploy

```bash
ALB_DNS="InfraS-Alb16-BFNklFjq8r8j-642511015.us-east-1.elb.amazonaws.com"  # use your AlbDnsName
curl "http://${ALB_DNS}/health"
curl "http://${ALB_DNS}/snippets"
curl -X POST "http://${ALB_DNS}/snippets" -H "Content-Type: application/json" -d '{"title":"Test","language":"javascript","code":"console.log(1);"}'
```

### 5.7 Where to see the new ECS task after force-new-deployment

- **Console:** ECS → Clusters → _your cluster_ → Services → _your service_ → **Tasks** tab; sort by **Started at** (newest is the new task).
- **Target health:** EC2 → Target Groups → _your target group_ → **Targets**; wait until the new task’s target is **Healthy** before relying on the ALB.

---

## 6. Lessons & Best Practices

- **Platform:** Build the Docker image for the same architecture as the ECS task (e.g. `--platform linux/amd64` for Fargate X86_64). CI on amd64 runners usually doesn’t need it; arm runners or local Mac M1/M2 need it.
- **DB URL in ECS:** ECS can inject individual DB vars from Secrets Manager; the container entrypoint should build `DATABASE_URL` from them so both Prisma CLI and the Node app see the same URL (and run migrations before starting the app).
- **RDS + Node TLS:** Use TLS for RDS; to avoid “self-signed certificate in certificate chain”, pass a pg `PoolConfig` with `ssl: { rejectUnauthorized: false }` and strip `sslmode` from the connection string so the URL doesn’t override your SSL config.
- **CDK vs app image:** `cdk deploy` updates only infra (VPC, ECS service definition, ALB, etc.). It does **not** build or push the app image. To run new app code, build the image, push to ECR, then run `aws ecs update-service ... --force-new-deployment`.
- **CI/CD:** Keep ECR repo name and image tag consistent (e.g. `snippet-manager-api:latest`). Use GitHub (or other) secrets for AWS credentials and ECS cluster/service names. Always force a new ECS deployment after push so the service pulls the new image.
- **Errors in production:** Log full errors (message + stack) in the app; don’t expose them in 500 responses in production. Use a flag or env (e.g. `EXPOSE_ERROR=1`) only for temporary debugging.

---

_Last updated to reflect the state of the repo after Phases 1–3 and deployment/RDS TLS fixes._
