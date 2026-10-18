import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const WORKER_URL = "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": WORKER_URL,
      "/ws": { target: WORKER_URL, ws: true },
    },
  },
  test: {
    environment: "jsdom",
  },
});
