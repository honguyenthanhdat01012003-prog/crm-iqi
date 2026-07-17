import fs from "fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const hasAndroidFirebase = fs.existsSync(path.resolve("android/app/google-services.json"));
const hasIosFirebase = fs.existsSync(path.resolve("ios/App/App/GoogleService-Info.plist"));
const hasFirebaseConfig = hasAndroidFirebase || hasIosFirebase;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const nativePushEnabled = hasFirebaseConfig && env.VITE_NATIVE_PUSH_ENABLED !== "false";
  const isCapacitor = mode === "capacitor";

  return {
  plugins: [react()],
  base: isCapacitor ? "./" : "/",
  define: {
    "import.meta.env.VITE_NATIVE_PUSH_ENABLED": JSON.stringify(nativePushEnabled ? "true" : "false"),
  },
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
};
});
