/**
 * Factory for creating NestJS test applications.
 *
 * Every test app created here has:
 *   - Test user injected via Express middleware (req.session + req.user)
 *   - URI versioning enabled (matches main.ts future config)
 *   - ValidationPipe enabled globally (whitelist + transform)
 *   - Caller-supplied provider overrides (e.g. S3Service mock)
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

  // Inject test session via middleware BEFORE any route handler runs.
  //
  // Why middleware instead of overrideGuard:
  //   Tests import individual feature modules (e.g. UploadsModule), NOT the
  //   full AppModule, so AuthModule's global guard is never registered.
  //   overrideGuard(AuthGuard) would be a no-op. Using middleware guarantees
  //   that request.session is always populated, which is exactly what the
  //   @Session() param decorator from @thallesp/nestjs-better-auth reads.
  app.use((req: any, _res: any, next: () => void) => {
    req.session = { user: TEST_USER };
    req.user = TEST_USER;
    next();
  });

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
