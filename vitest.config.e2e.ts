import { resolve } from "path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Load .env.test before Vitest spawns any workers so that all processes
// (globalSetup, test files) inherit the test environment variables.
config({ path: resolve(__dirname, ".env.test") });

export default defineConfig({
  test: {
    include: ["**/*.e2e-spec.ts"],
    globals: true,
    root: "./",

    // Run migrations and seed the test user once before all test files
    globalSetup: "./test/setup.ts",

    // Run test files serially (replaces singleFork in Vitest 4).
    // Prevents concurrent writes from different test files on the same tables.
    maxWorkers: 1,

    // DB operations can be slow — give each test and hook enough time
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "generated/prisma/client": resolve(__dirname, "generated/prisma/client"),
    },
  },
  plugins: [swc.vite()],
});
