// api/auth/me.js
// The frontend calls GET /api/auth/me on load.
// Returns { email } if authenticated, 401 if not.

import { getSession } from "../_auth.js";

export default function handler(req, res) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  res.json({ email: session.email });
}
