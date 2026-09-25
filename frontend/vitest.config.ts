import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Node-environment unit tests for the pure logic layers (formatting, deadline
// math, commit-reveal hashing). No DOM needed — contract/RPC calls are mocked
// where a module touches @stellar/stellar-sdk at import time.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
