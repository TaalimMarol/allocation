// api/photos.js  –  GET /api/photos
// Returns { its: "data:image/jpeg;base64,..." } map.
// Slow (reads Drive) so the frontend fetches this after the main data.

import { requireAuth }      from "./_auth.js";
import { getTeacherPhotos } from "./_sheets.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const session = requireAuth(req, res);
  if (!session) return;

  const folderID = req.query.folderID || process.env.PHOTO_FOLDER_ID || "";

  try {
    const photos = await getTeacherPhotos(folderID);
    // Cache for 10 minutes – photos rarely change
    res.setHeader("Cache-Control", "private, max-age=600");
    res.json(photos);
  } catch (err) {
    console.error("photos error:", err.message);
    res.status(500).json({});
  }
}
