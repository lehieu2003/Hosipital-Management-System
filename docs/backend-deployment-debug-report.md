# Backend Deployment Debug Report

## Reader and Goal

This document is for a developer debugging the backend production deployment.

After reading it, the developer should be able to explain what failed, identify the same class of failure from GitHub Actions and EC2 logs, and apply the same verification workflow without relying on guesswork.

## Incident Summary

The backend CI/CD pipeline reached a state where GitHub Actions could report a successful deploy while the EC2 backend container was still restarting. The public health endpoint was unavailable even though the build and deploy commands had completed.

There were several separate deployment issues uncovered in sequence:

1. GitHub Actions could not push the backend image to GHCR because the token did not have package write permission.
2. The EC2 deploy job initially failed before running the app because the SSH and Docker Compose setup were incomplete.
3. The app later deployed but crashed at runtime because the production container did not load Prisma correctly under Linux.
4. The deploy script did not fail on an unhealthy container, so GitHub Actions could show green while the app was down.

The final production state was verified with the public health endpoint:

```json
{"success":true,"data":{"status":"ok","ready":true}}
```

## How the Logs Were Read

### 1. Start with the failing GitHub Actions step

The first useful signal came from the exact failed step in GitHub Actions, not from the final job status.

Examples:

```text
denied: permission_denied: write_package
```

This pointed to the GHCR token scope. The build had already succeeded, so the failure was not Dockerfile-related. The fix was to use a repo secret token with package write permission for GHCR login and image push.

Another failure:

```text
Error: Cannot perform an interactive login from a non TTY device
```

This meant the Docker login command was receiving an empty password. In CI that usually means the secret is missing, misnamed, or not passed into the job environment.

### 2. Separate deploy-command success from app-health success

At one point the deploy step passed, but the browser showed:

```text
ERR_CONNECTION_REFUSED
```

That meant the EC2 host was reachable, but nothing healthy was listening on the app port.

The next check was on EC2:

```bash
docker ps -a
docker logs --tail=120 hms-node-backend
curl -fsS http://127.0.0.1:3000/api/v1/healthz
```

This separated network/security-group problems from application startup problems.

The container status showed it was restarting:

```text
Restarting (1)
```

That made the browser error a symptom, not the root cause.

### 3. Read container logs as the source of truth

The key runtime errors were inside container logs.

The first Prisma runtime error was:

```text
Named export 'AppointmentStatus' not found. The requested module '@prisma/client/index' is a CommonJS module
```

This showed that the code worked in one environment but failed in the Linux production container because Prisma's generated client is CommonJS. The code was using named ESM imports for runtime enum values.

The fix was to import Prisma's package as a default CommonJS object for runtime values, while keeping type-only imports for TypeScript:

```ts
import prismaClientPkg, { type UserRole as UserRoleType } from '@prisma/client/index';

const { UserRole } = prismaClientPkg;
```

Runtime enum access now comes from the default package object. TypeScript annotations use type-only aliases so they do not conflict with the runtime constants.

### 4. Keep reading logs after the first fix

After the CommonJS import fix, the container still restarted. The next log showed a different root cause:

```text
@prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.
```

This meant the production image contained a fresh production install of `@prisma/client`, but not the generated Prisma client from the build stage.

The Docker build had generated Prisma in the build stage. The runtime stage then copied production dependencies from a separate stage, which overwrote that generated state. The runtime image needed the generated Prisma output copied from the build stage.

The fix was to copy the generated Prisma artifacts into the final runtime image:

```dockerfile
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
```

## Fixes Applied

### Runtime Prisma imports

All runtime Prisma enum and client imports were changed from direct named runtime imports to default package destructuring.

Before:

```ts
import { PrismaClient, UserRole } from '@prisma/client/index';
```

After:

```ts
import prismaClientPkg, {
  type PrismaClient as PrismaClientType,
  type UserRole as UserRoleType,
} from '@prisma/client/index';

const { PrismaClient, UserRole } = prismaClientPkg;
```

This keeps runtime behavior compatible with Prisma's CommonJS client while preserving TypeScript type safety.

### Docker runtime image

The runtime image now includes the generated Prisma client from the build stage. This avoids shipping an uninitialized `@prisma/client` package.

### Deploy health gate

The deploy script now checks the backend health endpoint after recreating the container.

If health does not pass after the retry window, the deploy fails and prints recent container logs. This prevents a false green GitHub Actions deployment.

The deploy also removes the temporary runtime env file before running the deploy script so the GHCR token is not left on disk after it has been sourced.

## Verification Performed

Local backend checks:

```bash
npm run build
npm test
```

Result:

```text
12 test files passed
76 tests passed
```

GitHub Actions checks:

```bash
gh run watch <run-id> --exit-status
```

Result:

```text
Backend CI/CD passed
Test backend passed
Build and push backend image passed
Deploy backend to AWS EC2 passed
```

EC2 checks:

```bash
docker ps
curl -fsS http://127.0.0.1:3000/api/v1/healthz
docker logs --tail=20 hms-node-backend
```

Result:

```text
hms-node-backend Up ... healthy
```

Public check:

```bash
curl -fsS http://ec2-3-25-161-36.ap-southeast-2.compute.amazonaws.com:3000/api/v1/healthz
```

Result:

```json
{"success":true,"data":{"status":"ok","ready":true}}
```

Secret cleanup check:

```bash
test ! -e ~/hms-backend/deploy-runtime.env
```

Result:

```text
deploy-runtime.env removed
```

## Debugging Checklist for Next Time

Use this order when a deployment fails:

1. Check the exact failed GitHub Actions step.
2. If image push fails, inspect GHCR token scope and workflow permissions.
3. If SSH fails, validate host, user, port, private key format, and EC2 security group.
4. If deploy passes but browser fails, SSH into EC2 and check `docker ps`.
5. If the container is restarting, read `docker logs`; do not debug the browser first.
6. If Prisma fails in production, distinguish TypeScript build success from generated-client availability in the final Docker image.
7. Always verify both local EC2 health and public DNS health.
8. Make the deploy job fail on failed health checks so CI reflects the real production state.

## Security Notes

Any secret pasted into chat, terminal output, or screenshots should be rotated.

For this deployment, rotate these if they were exposed:

- GHCR personal access token
- EC2 SSH private key
- JWT secrets
- database password or database URL

The deploy process should never leave temporary files containing `GHCR_TOKEN` on EC2 after deployment.
