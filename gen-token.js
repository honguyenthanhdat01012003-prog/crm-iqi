import jwt from "jsonwebtoken";
const SECRET = "lux-iqi-crm-jwt-2026-xK9mZpQ4vR7wNcE3bY6hT1sA8fJ5gL0d";
const token = jwt.sign({ userId: 1, username: "admin", role: "admin" }, SECRET, { expiresIn: "1h" });
console.log("TOKEN:" + token);
