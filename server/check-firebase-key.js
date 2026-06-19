import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeFirebasePrivateKey(raw = "") {
  let key = String(raw || "").trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n");
  if (!key.includes("\n") && key.includes("-----BEGIN")) {
    key = key
      .replace("-----BEGIN PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----\n")
      .replace("-----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----\n");
  }
  return key.trim();
}

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function checkKey(label, privateKey) {
  const normalized = normalizeFirebasePrivateKey(privateKey);
  if (!normalized) {
    console.log(`${label}: MISSING`);
    return false;
  }
  try {
    crypto.createSign("RSA-SHA256").update("crm-fcm-key-check").sign(normalized);
    console.log(`${label}: KEY OK (${normalized.length} chars)`);
    return true;
  } catch (err) {
    console.log(`${label}: KEY FAIL -> ${err.message}`);
    return false;
  }
}

loadEnvFile();

console.log("=== Firebase key check ===");

const jsonPaths = [
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  path.join(__dirname, "..", "secrets", "firebase-service-account.json"),
  path.join(__dirname, "..", "firebase-service-account.json"),
].filter(Boolean);

let anyOk = false;
for (const filePath of jsonPaths) {
  if (!fs.existsSync(filePath)) continue;
  try {
    const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (checkKey(`JSON ${filePath}`, json.private_key)) anyOk = true;
  } catch (err) {
    console.log(`JSON ${filePath}: READ FAIL -> ${err.message}`);
  }
}

if (process.env.FIREBASE_PRIVATE_KEY) {
  if (checkKey("ENV FIREBASE_PRIVATE_KEY (.env or aaPanel)", process.env.FIREBASE_PRIVATE_KEY)) anyOk = true;
} else {
  console.log("ENV FIREBASE_PRIVATE_KEY: MISSING");
}

console.log("");
if (anyOk) {
  console.log("Result: at least one key source is valid. Restart Node then POST /api/native-push/test");
} else {
  console.log("Result: ALL keys invalid. Upload secrets/firebase-service-account.json from Firebase Console.");
  process.exit(1);
}
