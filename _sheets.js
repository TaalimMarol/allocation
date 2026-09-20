// api/_sheets.js  –  Google Sheets data layer
// Uses a Service Account (JSON key stored in GOOGLE_SERVICE_ACCOUNT_JSON env var)
// to read/write the target spreadsheet (SPREADSHEET_ID env var).

import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME     = process.env.SHEET_NAME || "";   // leave blank = first sheet

const EXCLUDED_SUBJECTS = [
  "marhalat saqafat aamah",
  "barāmij ʿilmiyya",
  "baraamij ilmiyya",
  "baramij ilmiyya",
  "khaimat riyadat",
  "nashat thaqafi",
  "jameeiyah ula",
  "jameeiyaah thaniyah",
];

function isExcluded(subject) {
  const s = (subject || "").toString().trim().toLowerCase();
  return EXCLUDED_SUBJECTS.some((ex) => s === ex.toLowerCase());
}

function makeShorthand(cls, section, gender) {
  return `${cls || ""}${section || ""}${gender || ""}`;
}

// Build a case-insensitive column index  { "name" -> idx, "Name" -> idx, … }
function buildColIdx(headers) {
  const idx = {};
  headers.forEach((h, i) => {
    const key = h.toString().trim();
    idx[key]              = i;
    idx[key.toLowerCase()] = i;
  });
  return idx;
}

function getCol(colIdx, row, ...candidates) {
  for (const name of candidates) {
    const i = colIdx[name] !== undefined
      ? colIdx[name]
      : colIdx[name.toLowerCase()];
    if (i !== undefined && row[i] !== undefined && row[i] !== "") return row[i];
  }
  return "";
}

// ── Auth client (cached per cold-start) ───────────────────
let _auth = null;
function getAuth() {
  if (_auth) return _auth;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is missing");
  const credentials = JSON.parse(raw);
  _auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  return _auth;
}

async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

// ── getAllData ─────────────────────────────────────────────
export async function getAllData() {
  const sheets = await getSheetsClient();
  const range  = SHEET_NAME ? `${SHEET_NAME}!A:Z` : "A:Z";

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values = resp.data.values || [];
  if (values.length < 2) return { rows: [], headers: [] };

  const headers  = values[0].map((h) => (h || "").toString().trim());
  const colIdx   = buildColIdx(headers);
  const get      = (row, ...names) => getCol(colIdx, row, ...names);
  const rows     = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    // Skip blank rows
    if (!row || !row.some((c) => c !== "" && c !== null && c !== undefined)) continue;

    const subject = get(row, "Subject", "subject").toString().trim();
    if (isExcluded(subject)) continue;

    const cls     = get(row, "Class",   "class").toString().trim();
    const section = get(row, "Section", "section").toString().trim();
    const gender  = get(row, "Gender",  "gender").toString().trim();
    const its     = get(row, "ITS",     "its").toString().trim();
    const name    = get(row, "Name",    "name").toString().trim();

    if (!its && !name) continue;

    const teacherKey = its || ("NAME:" + name);
    const ustadDaera = get(row,
      "Ustad_Daera", "USTAD_DAERA", "ustad_daera", "ustadDaera"
    ).toString().trim();

    rows.push({
      rowNumber:       r + 1,         // 1-based sheet row
      class:           cls,
      section:         section,
      gender:          gender,
      shorthand:       makeShorthand(cls, section, gender),
      subject:         subject,
      bookName:        get(row, "BookName", "bookname").toString().trim(),
      weekly:          Number(get(row, "Weekly", "weekly")) || 0,
      its:             its,
      teacherKey:      teacherKey,
      name:            name,
      periods1448:     Number(get(row, "1448Tafweed")) || 0,
      totalPeriod1449: Number(get(row, "Total_period_1449")) || 0,
      teacherGender:   get(row, "TeacherGender", "teacherGender").toString().trim(),
      musaid:          get(row, "Musaid", "musaid").toString().trim(),
      ustadDaera:      ustadDaera,
    });
  }

  return { rows, headers };
}

// ── syncRow ───────────────────────────────────────────────
export async function syncRow(rowNumber, newIts, newName) {
  const sheets  = await getSheetsClient();
  const range   = SHEET_NAME ? `${SHEET_NAME}!A1:Z1` : "A1:Z1";

  const hdrResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const headers = (hdrResp.data.values?.[0] || []).map((h) => h.toString().trim());
  const colIdx  = buildColIdx(headers);

  const itsCol  = colIdx["ITS"]  ?? colIdx["its"];
  const nameCol = colIdx["Name"] ?? colIdx["name"];

  const updates = [];

  if (itsCol !== undefined) {
    const col = colToLetter(itsCol + 1);
    const r   = SHEET_NAME
      ? `${SHEET_NAME}!${col}${rowNumber}`
      : `${col}${rowNumber}`;
    updates.push({ range: r, values: [[newIts]] });
  }

  if (nameCol !== undefined) {
    const col = colToLetter(nameCol + 1);
    const r   = SHEET_NAME
      ? `${SHEET_NAME}!${col}${rowNumber}`
      : `${col}${rowNumber}`;
    updates.push({ range: r, values: [[newName]] });
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    });
  }

  return { success: true };
}

// ── Drive photos ──────────────────────────────────────────
export async function getTeacherPhotos(folderID) {
  const folderId = folderID || process.env.PHOTO_FOLDER_ID || "";
  if (!folderId) return {};

  const auth   = getAuth();
  const drive  = google.drive({ version: "v3", auth });
  const result = {};

  try {
    const listResp = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/'`,
      fields: "files(id,name,mimeType)",
      pageSize: 500,
    });

    for (const file of listResp.data.files || []) {
      const match = file.name.match(/^(\d+)\.(jpg|jpeg|png|webp)$/i);
      if (!match) continue;

      const its = match[1];
      try {
        const dl = await drive.files.get(
          { fileId: file.id, alt: "media" },
          { responseType: "arraybuffer" }
        );
        const base64 = Buffer.from(dl.data).toString("base64");
        result[its]  = `data:${file.mimeType};base64,${base64}`;
      } catch (_) { /* skip unreadable file */ }
    }
  } catch (err) {
    console.error("Drive photos error:", err.message);
  }

  return result;
}

// ── Utility ───────────────────────────────────────────────
function colToLetter(col) {
  let letter = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}
