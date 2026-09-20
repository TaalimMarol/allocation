// api/_auth.js  –  shared session helper
// Sessions are a signed JWT stored in an HttpOnly cookie.
// We use a lightweight manual HMAC-SHA256 so we have zero
// extra dependencies beyond what Node 18 already ships.

import { createHmac } from "crypto";

const SECRET   = process.env.SESSION_SECRET || "change-me-in-env";
const COOKIE   = "ads_session";
const MAX_AGE  = 60 * 60 * 8; // 8 hours

export const ALLOWED_EMAILS = [
  "fakhruddin.burhanpurwala@jameasaifiyah.edu",
  "mustafa.nasir@jameasaifiyah.edu",
  "ammar.talib@jameasaifiyah.edu",
  "mustafa.h@jameasaifiyah.edu",
];

// ── sign / verify ──────────────────────────────────────────
function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig  = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verify(token) {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(data).digest("base64url");
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── cookie helpers ─────────────────────────────────────────
function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").map((c) => c.trim().split("=").map(decodeURIComponent))
  );
}

export function setSessionCookie(res, email) {
  const token = sign({ email, exp: Date.now() + MAX_AGE * 1000 });
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export function getSession(req) {
  const cookies = parseCookies(req);
  return verify(cookies[COOKIE] || "");
}

// ── middleware ─────────────────────────────────────────────
export function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return session;
}
