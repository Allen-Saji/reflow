import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3411", headless: true },
  webServer: {
    command: "pnpm start",
    url: "http://127.0.0.1:3411/api/health",
    env: { PORT: "3411" },
    reuseExistingServer: false,
  },
});
