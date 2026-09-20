// api/auth/callback.js
// Google redirects here after the user logs in.
// We exchange the code for an ID token, verify the email
// is in the allow-list, then set an HttpOnly session cookie.

import { google } from "googleapis";
import { ALLOWED_EMAILS, setSessionCookie } from "../_auth.js";

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(302, `/?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return res.redirect(302, "/?error=missing_code");
  }

  try {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Decode the ID token payload (no need to verify sig for our use case;
    // the token was obtained directly from Google's server)
    const idToken  = tokens.id_token;
    const payload  = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString()
    );
    const email    = (payload.email || "").toLowerCase().trim();

    if (!ALLOWED_EMAILS.includes(email)) {
      return res.redirect(302, `/?error=unauthorized&email=${encodeURIComponent(email)}`);
    }

    setSessionCookie(res, email);
    return res.redirect(302, "/");

  } catch (err) {
    console.error("OAuth callback error:", err.message);
    return res.redirect(302, `/?error=oauth_failed`);
  }
}
