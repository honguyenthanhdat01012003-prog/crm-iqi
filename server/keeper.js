/**
 * aaPanel: Project File = server/keeper.js (KHÔNG phải index.js)
 * Tự restart CRM khi Node chết (OOM / crash) — tránh Stopped mãi trên panel.
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appScript = path.join(__dirname, "index.js");
const HEARTBEAT = path.join(__dirname, "data", "keeper.heartbeat");
const RESTART_MS = Math.max(1500, Number(process.env.KEEPER_RESTART_MS) || 2500);
const MAX_OLD = process.env.NODE_MAX_OLD_SPACE_SIZE || "1536";

let child = null;
let stopping = false;
let restarts = 0;
let lastStartAt = 0;

function log(...args) {
  console.log(`[keeper ${new Date().toISOString()}]`, ...args);
}

function touchHeartbeat() {
  try {
    fs.mkdirSync(path.dirname(HEARTBEAT), { recursive: true });
    fs.writeFileSync(HEARTBEAT, String(Date.now()), "utf8");
  } catch {
    /* ignore */
  }
}

function start() {
  if (stopping) return;
  if (child) return;

  const now = Date.now();
  // Crash loop: tăng delay (tránh aaPanel/PM2 "too many unstable restarts")
  let delay = RESTART_MS;
  if (now - lastStartAt < 15000) {
    restarts += 1;
    delay = Math.min(60000, RESTART_MS * Math.pow(1.6, Math.min(restarts, 8)));
  } else {
    restarts = 0;
  }
  lastStartAt = now;

  const env = {
    ...process.env,
    NODE_OPTIONS: [
      process.env.NODE_OPTIONS,
      `--max-old-space-size=${MAX_OLD}`,
      "--expose-gc",
      process.env.NODE_OPTIONS?.includes("use-system-ca") ? "" : "--use-system-ca",
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };

  const launch = () => {
    if (stopping) return;
    log(`start ${appScript} (heap max ${MAX_OLD}MB, restart#${restarts}, delay=${delay}ms)`);
    touchHeartbeat();
    try {
      const nodeArgs = process.execArgv.includes("use-system-ca")
        ? [appScript]
        : ["--use-system-ca", appScript];
      child = spawn(process.execPath, nodeArgs, {
        stdio: "inherit",
        env,
        cwd: path.join(__dirname, ".."),
      });
    } catch (err) {
      log("spawn failed:", err?.message || err);
      child = null;
      setTimeout(start, delay);
      return;
    }

    child.on("error", (err) => {
      log("child error:", err?.message || err);
    });

    child.on("exit", (code, signal) => {
      child = null;
      touchHeartbeat();
      if (stopping) {
        log(`stopped (code=${code} signal=${signal})`);
        process.exit(code || 0);
        return;
      }
      const nextDelay = Math.min(60000, RESTART_MS * Math.pow(1.5, Math.min(restarts, 8)));
      log(`child died code=${code} signal=${signal} — restart after ${nextDelay}ms`);
      setTimeout(start, nextDelay);
    });
  };

  if (restarts > 0) setTimeout(launch, delay);
  else launch();
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
    }, 5000);
  } else {
    process.exit(0);
  }
}

// Keeper không được chết vì lỗi lặt vặt
process.on("uncaughtException", (err) => {
  log("keeper uncaughtException:", err?.stack || err);
});
process.on("unhandledRejection", (reason) => {
  log("keeper unhandledRejection:", reason);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

setInterval(touchHeartbeat, 15000);
touchHeartbeat();
start();
