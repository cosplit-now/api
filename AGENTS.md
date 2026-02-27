# AGENTS

This repository is a NestJS + Prisma API. Use this guide when making changes.

## Quick Commands

### Install

- npm install

### Build

- npm run build

### Lint / Format

- npm run lint
- npm run format

### Unit Tests (Vitest)

- npm run test
- npm run test:watch
- npm run test:cov
- npm run test:debug

Run a single unit test file:

- npx vitest run src/path/to/file.spec.ts

Run a single test by name:

- npx vitest run -t "test name"

### E2E Tests

- npm run test:e2e

Run a single E2E test file:

- npx vitest run --config vitest.config.e2e.ts test/allocations.e2e-spec.ts

### Database / Prisma

- npm run db:migrate
- npm run db:migrate:deploy
- npm run db:reset
- npm run db:seed
- npm run db:generate
- npm run db:studio

## Test Environment

- E2E tests use real services from `.env.test`.
- PostgreSQL on `localhost:55432` (DB: `cosplit-api-test`).
- Redis on `localhost:56379`.
- S3/R2 values are mocked in tests and not used.
- `test/setup.ts` runs migrations and seeds test users.
- Use `test/helpers/create-app.helper.ts` to create Nest test apps.
- Auth in tests is injected via Express middleware:
  `req.session = { user: TEST_USER }`.

## Project Structure

- `src/` contains feature modules in a flat layout.
- `test/` contains E2E tests (`*.e2e-spec.ts`).
- Unit tests live next to code (`*.spec.ts`).
- DTOs live under `src/<module>/dto`.
- Mappers live under `src/<module>/*.mapper.ts`.

## API Conventions

- API versioning uses URI versioning (`/v1`).
- Responses are plain objects from mapper functions.
- Avoid `ClassSerializerInterceptor` and entity response classes.
- Monetary values are **strings** in API responses.
- Use `formatMoney()` for output formatting.
- Use `Prisma.Decimal` for precise money arithmetic in business logic.

## Code Style and Formatting

- Prettier is authoritative.
  - Double quotes.
  - Trailing commas where possible.
- ESLint is enabled with type-aware rules.
  - `@typescript-eslint/no-explicit-any` is off.
  - Floating promises are warned.
- Keep imports ordered by:
  1. Node/third-party
  2. Internal modules
  3. Local relative imports
- Use `import type` for type-only imports.

## Types and Naming

- Use `PascalCase` for classes and types.
- Use `camelCase` for variables and functions.
- Use `kebab-case` for filenames.
- DTO classes end with `Dto`.
- Interfaces used for API responses are in `src/<module>/*.types.ts`.

## Error Handling

- Use Nest exceptions (`BadRequestException`, `NotFoundException`,
  `UnprocessableEntityException`) for user-facing errors.
- For ownership checks, return `NotFoundException` (avoid leaking existence).
- Validation is handled by `ValidationPipe` with `whitelist: true`.

## Money Calculations

- Use `Prisma.Decimal` for all arithmetic that affects API money values.
- Use `decimal.js` in tests when you need deterministic precision helpers.
- Use `formatMoney()` for response formatting.
- Avoid floating-point comparisons and `Number(...)` for sums.

## Allocations and Summary

- Allocation calculations are centralized in
  `src/allocations/allocation-calculator.ts`.
- `PUT /v1/items/:id/allocations` replaces all allocations atomically.
- `GET /v1/receipts/:id/summary` aggregates from allocation amounts.
- Summary totals should use `Decimal` for aggregation.

## Testing Guidelines

- E2E tests use real DB + Redis and seed users from `test/setup.ts`.
- Mock external integrations (S3, BullMQ) via provider overrides.
- Use `createTestApp()` to ensure auth middleware and ValidationPipe are set.
- Clean DB state in E2E tests using helper utilities.

## Docs Alignment

- API behavior should match `docs/api.md`.
- Product flow should match `docs/product.md`.
- When adding fields to responses, update docs.

## Cursor / Copilot Rules

- No Cursor rules found in `.cursor/rules/` or `.cursorrules`.
- No Copilot rules found in `.github/copilot-instructions.md`.
