import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  build: {
    rollupOptions: {
      // Exclude server-only packages from Rollup resolver (fixes ENOTDIR on Linux)
      external: [
        "@sparticuz/chromium",
        "puppeteer-core",
        "@libsql/client",
        "express",
        "cors",
        "helmet",
        "jsonwebtoken",
      ],
    },
    sourcemap: false,
  },
});
