/**
 * aaPanel: chọn file chạy = server/keeper.js
 * Tự restart khi Node chết (OOM / crash) — tránh trạng thái Stopped mãi.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appScript = path.join(__dirname, "index.js");
const RESTART_MS = Math.max(1000, Number(process.env.KEEPER_RESTART_MS) || 3000);
const MAX_OLD = process.env.NODE_MAX_OLD_SPACE_SIZE || "768";

let child = null;
let stopping = false;

function log(...args) {
  console.log(`[keeper ${new Date().toISOString()}]`, ...args);
}

function start() {
  if (stopping) return;
  const env = {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--max-old-space-size=${MAX_OLD}`]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
  log(`start ${appScript} (heap max ${MAX_OLD}MB)`);
  child = spawn(process.execPath, [appScript], {
    stdio: "inherit",
    env,
    cwd: path.join(__dirname, ".."),
  });
  child.on("exit", (code, signal) => {
    child = null;
    if (stopping) {
      log(`stopped (code=${code} signal=${signal})`);
      process.exit(code || 0);
      return;
    }
    log(`child died code=${code} signal=${signal} — restart after ${RESTART_MS}ms`);
    setTimeout(start, RESTART_MS);
  });
}

function shutdown(sig) {
  if (stopping) return;
  stopping = true;
  log(`received ${sig}, stopping child…`);
  if (child && !child.killed) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (child && !child.killed) {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
      process.exit(0);
    }, 4000);
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
