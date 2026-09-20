// api/data.js  –  GET /api/data
// Returns all sheet rows (filtered, enriched).
// Protected: requires a valid session cookie.

import { requireAuth } from "./_auth.js";
import { getAllData }   from "./_sheets.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = requireAuth(req, res);
  if (!session) return; // requireAuth already sent 401

  try {
    const data = await getAllData();
    res.json(data);
  } catch (err) {
    console.error("getAllData error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
