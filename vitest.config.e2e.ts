import { resolve } from "path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.e2e-spec.ts"],
    globals: true,
    root: "./",
  },
  resolve: {
    alias: {
      "generated/prisma/client": resolve(__dirname, "generated/prisma/client"),
    },
  },
  plugins: [swc.vite()],
});
