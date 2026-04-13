import jwt from "jsonwebtoken";
const SECRET = "lux-iqi-crm-jwt-2026-xK9mZpQ4vR7wNcE3bY6hT1sA8fJ5gL0d";
const token = jwt.sign({ userId: 1, username: "admin", role: "admin" }, SECRET, { expiresIn: "1h" });

const r = await fetch("http://localhost:4000/api/personal-leads", {
  headers: { Authorization: `Bearer ${token}` }
});
console.log("Status:", r.status);
const body = await r.text();
console.log("Body:", body);

// Also try POST
const r2 = await fetch("http://localhost:4000/api/personal-leads", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: "Test", phone: "0123456789", product: "2pn", status: "new", note: "test" })
});
console.log("POST Status:", r2.status);
const body2 = await r2.text();
console.log("POST Body:", body2);
