/**
 * Factory for creating NestJS test applications.
 *
 * Every test app created here has:
 *   - Test user injected via Express middleware (req.user)
 *   - URI versioning enabled (matches main.ts future config)
 *   - ValidationPipe enabled globally (whitelist + transform)
 *   - Caller-supplied provider overrides (e.g. S3Service mock)
 *
 * Auth strategy:
 *   Tests import individual feature modules (e.g. UploadsModule), NOT the
 *   full AppModule, so JwtAuthGuard (registered as APP_GUARD) is never
 *   loaded. The middleware below sets req.user directly, which is what the
 *   @CurrentUser() param decorator reads from.
 *
 * Usage:
 *   const app = await createTestApp([UploadsModule], {
 *     overrideProviders: [
 *       { provide: S3Service, useValue: mockS3Service },
 *     ],
 *   });
 */

import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { ModuleMetadata } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NextFunction, Request, Response } from "express";
import { TEST_USER } from "./auth.helper";
import { App } from "supertest/types";

interface ProviderOverride {
  provide: any;
  useValue: any;
}

interface CreateTestAppOptions {
  /** Additional provider overrides, e.g. S3Service or BullMQ queue mocks */
  overrideProviders?: ProviderOverride[];
}

export async function createTestApp(
  imports: NonNullable<ModuleMetadata["imports"]>,
  options: CreateTestAppOptions = {},
): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({ imports });

  for (const { provide, useValue } of options.overrideProviders ?? []) {
    builder = builder.overrideProvider(provide).useValue(useValue);
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();

  // Inject test user via middleware BEFORE any route handler runs.
  // @CurrentUser() reads req.user, which is set here.
  app.use(
    (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
      req.user = TEST_USER;
      next();
    },
  );

  // Mirror the configuration that will be in main.ts
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  await app.init();
  return app;
}
