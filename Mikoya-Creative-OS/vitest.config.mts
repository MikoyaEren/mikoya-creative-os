import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    // Tests must never see a real key.
    env: { ANTHROPIC_API_KEY: "" },
    environment: "node",
  },
});
