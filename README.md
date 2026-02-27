# Cosplit API

Cosplit helps people split receipt expenses. This service powers the backend
APIs for uploads, OCR-driven receipts, participants, allocations, and summary.

For product context and API behavior:

- `docs/product.md`
- `docs/api.md`

## For Users

Cosplit lets you:

- Upload a receipt image and run OCR
- Review and edit items
- Add participants
- Split items equally, by shares, or by custom amounts
- View a summary of who owes what

If you are integrating with this API, start with `docs/api.md`.

## For Developers

This project is a NestJS + Prisma API that provides the v1 endpoints described
in `docs/api.md`.

## Requirements

- Node.js 18+
- PostgreSQL
- Redis (Valkey)

Optional (recommended for local dev/testing): Docker + docker compose

## Quick Start

```bash
npm install
npm run db:generate
npm run start:dev
```

## Environment

Create a `.env` file for local development (not committed):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cosplit-api-development
BETTER_AUTH_SECRET=your-secret-32-characters-minimum
BETTER_AUTH_URL=http://localhost:3000/auth
REDIS_HOST=localhost
REDIS_PORT=6379
R2_ACCOUNT_ID=dev
R2_ACCESS_KEY_ID=dev
R2_SECRET_ACCESS_KEY=dev
R2_BUCKET=dev-bucket
R2_PUBLIC_BASE_URL=https://dev-r2.example.com
```

For tests, `.env.test` is already defined and uses local ports:

- PostgreSQL: `localhost:55432`
- Redis: `localhost:56379`

## Docker (optional)

Start local dependencies:

```bash
docker compose up -d
```

Start test dependencies:

```bash
docker compose -f docker-compose.test.yml up -d
```

## Scripts

### Build / Lint / Format

```bash
npm run build
npm run lint
npm run format
```

### Unit Tests (Vitest)

```bash
npm run test
npm run test:watch
npm run test:cov
npm run test:debug
```

Run a single unit test file:

```bash
npx vitest run src/path/to/file.spec.ts
```

Run a single test by name:

```bash
npx vitest run -t "test name"
```

### E2E Tests

```bash
npm run test:e2e
```

Run a single E2E test file:

```bash
npx vitest run --config vitest.config.e2e.ts test/allocations.e2e-spec.ts
```

### Prisma

```bash
npm run db:migrate
npm run db:migrate:deploy
npm run db:reset
npm run db:seed
npm run db:generate
npm run db:studio
```

## Project Structure

- `src/` feature modules (flat layout)
- `src/<module>/dto` DTO classes
- `src/<module>/*.mapper.ts` response mappers
- `src/<module>/*.types.ts` response interfaces
- `test/` E2E tests (`*.e2e-spec.ts`)
- `docs/api.md` API documentation
- `docs/product.md` product requirements

## API Conventions

- Versioning uses URI prefix: `/v1`.
- Responses are plain objects from mapper functions.
- Monetary values are **strings** in API responses.
- Use `formatMoney()` for output formatting.
- Use `Prisma.Decimal` for precise money arithmetic in business logic.

## Testing Notes

- `test/setup.ts` runs migrations and seeds test users.
- Use `test/helpers/create-app.helper.ts` to build Nest test apps.
- Auth in tests is injected via Express middleware (`req.session.user`).
- External integrations (S3/BullMQ) are mocked in tests.

## Docs

- API behavior must match `docs/api.md`.
- Product flow must match `docs/product.md`.
- When adding response fields, update the docs.

## Agent Guidance

See `AGENTS.md` for detailed coding conventions and test environment rules.
