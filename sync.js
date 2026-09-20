// api/sync.js  –  POST /api/sync
// Body: { rowNumber, newIts, newName }
// Writes the new teacher assignment back to the sheet.

import { requireAuth } from "./_auth.js";
import { syncRow }     from "./_sheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = requireAuth(req, res);
  if (!session) return;

  const { rowNumber, newIts, newName } = req.body || {};
  if (!rowNumber) return res.status(400).json({ error: "rowNumber required" });

  try {
    const result = await syncRow(Number(rowNumber), newIts || "", newName || "");
    res.json(result);
  } catch (err) {
    console.error("syncRow error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
