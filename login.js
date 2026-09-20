// api/auth/login.js
// Redirects the browser to Google's OAuth consent screen.
// After the user approves, Google sends them back to /api/auth/callback.

import { google } from "googleapis";

export default function handler(req, res) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI   // e.g. https://your-app.vercel.app/api/auth/callback
  );

  const url = oauth2.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });

  res.redirect(302, url);
}
