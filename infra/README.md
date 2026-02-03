# Snippet Manager – AWS Infrastructure (CDK)

This folder contains the **Infrastructure as Code** for the Snippet Manager API: VPC, RDS (PostgreSQL), ECS (Fargate), ALB, ECR, and Secrets Manager.

## What’s in the stack

| Resource          | Purpose                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| **VPC**           | Network with public subnets (ALB) and private subnets (Fargate + RDS). 1 NAT gateway to reduce cost. |
| **RDS**           | PostgreSQL 16 (`db.t4g.micro`) in private subnets. Master password in Secrets Manager.               |
| **ECS + Fargate** | Runs the API container (512 MB, 0.25 vCPU). DB credentials injected from Secrets Manager.            |
| **ALB**           | Public HTTP (port 80). Health check on `/health`. Forwards to Fargate.                               |
| **ECR**           | Repository for the API Docker image (tag: `latest`).                                                 |

## Prerequisites

- AWS CLI configured (`aws sts get-caller-identity` works).
- Docker installed (for building and pushing the image).

## Deploy the stack

### 1. Deploy infrastructure

```bash
cd infra
npm run build
npx cdk deploy
```

Confirm when prompted. After deploy, note the outputs: **ApiRepoUri**, **AlbDnsName**, **DbSecretArn**, **EcsClusterName**, **EcsServiceName** (needed for Phase 3 CI/CD).

### 2. Build and push the API image

From the **project root** (parent of `infra`):

```bash
# Replace REGION and ACCOUNT with your AWS region and account ID (from cdk deploy output or aws sts get-caller-identity)
export REGION=us-east-1
export ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export ECR_URI="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/snippet-manager-api"

# Log in to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI

# Build and push (tag: latest)
docker build -t snippet-manager-api:latest .
docker tag snippet-manager-api:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

### 3. Force ECS to use the new image

After the first push, ECS will pull the image and start the task. If you push a new image later, force a new deployment:

```bash
aws ecs update-service \
  --cluster InfraStack-Cluster* \
  --service InfraStack-Service* \
  --force-new-deployment \
  --region $REGION
```

(Use the exact cluster and service names from the AWS Console → ECS → Clusters.)

### 4. Open the API

Use the **AlbDnsName** from the deploy output:

```text
http://<AlbDnsName>/
http://<AlbDnsName>/health
http://<AlbDnsName>/snippets
```

## Phase 3: CI/CD (GitHub Actions)

A workflow in `.github/workflows/deploy.yml` runs on **push to `main`**: it builds the Docker image, pushes it to ECR, and forces a new ECS deployment so Fargate pulls the new image. No manual uploads.

### One-time setup: GitHub Secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**. Add:

| Secret name             | Value            | Where to get it                                                                |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------ |
| `AWS_ACCESS_KEY_ID`     | IAM access key   | IAM user (e.g. snippet-manager-dev) → Security credentials → Create access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key   | Same as above (shown once)                                                     |
| `AWS_REGION`            | e.g. `us-east-1` | Same region you used for `cdk deploy`                                          |
| `ECS_CLUSTER_NAME`      | Cluster name     | From `cdk deploy` output **EcsClusterName**                                    |
| `ECS_SERVICE_NAME`      | Service name     | From `cdk deploy` output **EcsServiceName**                                    |

After the first `cdk deploy`, copy **EcsClusterName** and **EcsServiceName** from the terminal output (or from CloudFormation → Stack → Outputs) into these secrets.

### What the workflow does

1. **Checkout** the repo.
2. **Configure AWS** using the secrets above.
3. **Login to ECR** and **build** the Docker image from the project root.
4. **Push** the image to ECR with tag `latest`.
5. **Force ECS** to run a new deployment so the service pulls the new image and replaces running tasks.

You can also run the workflow manually: **Actions → Build and Deploy API → Run workflow**.

---

## Undeploy (destroy)

To remove all resources and stop billing:

```bash
cd infra
npx cdk destroy
```

Confirm when prompted. This deletes the stack (VPC, RDS, ECS, ALB, ECR, etc.). The CDK bootstrap stack (CDKToolkit) is left in place unless you run `npx cdk bootstrap destroy`.

## Useful commands

- `npm run build` – Compile TypeScript.
- `npx cdk synth` – Generate CloudFormation template (no deploy).
- `npx cdk diff` – Compare deployed stack with current code.
- `npx cdk deploy` – Deploy the stack.
- `npx cdk destroy` – Delete the stack.
