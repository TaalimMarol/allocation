// api/auth/logout.js
import { clearSessionCookie } from "../_auth.js";

export default function handler(req, res) {
  clearSessionCookie(res);
  res.redirect(302, "/");
}
