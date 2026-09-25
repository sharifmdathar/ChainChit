import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([{
    extends: [...nextCoreWebVitals],
    rules: {
      // Newly-adopted React 19 perf rule: flags intentional mount-time
      // initialization (setLoading/read persisted prefs). Keep visible as a
      // warning rather than blocking the gate on pre-existing patterns.
      "react-hooks/set-state-in-effect": "warn",
    },
}]);