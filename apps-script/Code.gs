const CONFIG = {
  spreadsheetId: "1iAl1YgpKqPNnx7SJPAQTncOkquVUmT_RnO3HT_SpgBI",
  googleClientId: "4790857483-dfsu661skbet2drpfhlpb6hgihvndfhg.apps.googleusercontent.com",
  sheetName: "1449Working",
  photoFolderId: "1stZ952fMp9RD1YjlV4YYv6BCSb6CSXBB",
  allowedEmails: [
    "fakhruddin.burhanpurwala@jameasaifiyah.edu",
    "mustafa.nasir@jameasaifiyah.edu",
    "ammar.talib@jameasaifiyah.edu",
    "mustafa.h@jameasaifiyah.edu"
  ]
};

const EXCLUDED_SUBJECTS = [
  "marhalat saqafat aamah", "barāmij ʿilmiyya", "baraamij ilmiyya",
  "baramij ilmiyya", "khaimat riyadat", "nashat thaqafi",
  "jameeiyah ula", "jameeiyaah thaniyah"
];

function doGet(e) {
  return handleRequest_(e && e.parameter ? e.parameter : {}, "GET");
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json_({ error: "Invalid JSON request body." }, 400);
  }
  return handleRequest_(body, "POST");
}

function handleRequest_(request, method) {
  const auth = authenticate_(request.token);
  if (!auth.ok) return json_({ error: auth.error }, 401);

  try {
    const action = request.action || "data";
    if (method === "GET" && action === "me") {
      return json_({ email: auth.email });
    }
    if (method === "GET" && action === "data") {
      return json_(getAllData_());
    }
    if (method === "GET" && action === "photos") {
      return json_(getTeacherPhotos_());
    }
    if (method === "POST" && action === "sync") {
      return json_(syncRow_(request.rowNumber, request.newIts, request.newName));
    }
    return json_({ error: "Unsupported action." }, 400);
  } catch (err) {
    console.error(err.stack || err.message);
    return json_({ error: err.message || "Backend request failed." }, 500);
  }
}

function authenticate_(token) {
  if (!token) return { ok: false, error: "Missing Google sign-in token." };
  const response = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token),
    { muteHttpExceptions: true }
  );
  if (response.getResponseCode() !== 200) {
    return { ok: false, error: "Invalid Google sign-in token." };
  }
  const payload = JSON.parse(response.getContentText());
  const email = String(payload.email || "").toLowerCase().trim();
  if (payload.aud !== CONFIG.googleClientId ||
      !payload.email_verified || CONFIG.allowedEmails.indexOf(email) === -1) {
    return { ok: false, error: "This Google account is not authorised." };
  }
  return { ok: true, email: email };
}

function getAllData_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return { rows: [], headers: [] };

  const headers = values[0].map(function (h) { return String(h || "").trim(); });
  const index = buildColIdx_(headers);
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row.some(function (cell) { return cell !== ""; })) continue;
    const subject = String(getCol_(index, row, ["Subject", "subject"])).trim();
    if (EXCLUDED_SUBJECTS.indexOf(subject.toLowerCase()) !== -1) continue;
    const cls = String(getCol_(index, row, ["Class", "class"])).trim();
    const section = String(getCol_(index, row, ["Section", "section"])).trim();
    const gender = String(getCol_(index, row, ["Gender", "gender"])).trim();
    const its = String(getCol_(index, row, ["ITS", "its"])).trim();
    const name = String(getCol_(index, row, ["Name", "name"])).trim();
    if (!its && !name) continue;
    rows.push({
      rowNumber: r + 1, class: cls, section: section, gender: gender,
      shorthand: cls + section + gender, subject: subject,
      bookName: String(getCol_(index, row, ["BookName", "bookname"])).trim(),
      weekly: Number(getCol_(index, row, ["Weekly", "weekly"])) || 0,
      its: its, teacherKey: its || "NAME:" + name, name: name,
      periods1448: Number(getCol_(index, row, ["1448Tafweed"])) || 0,
      totalPeriod1449: Number(getCol_(index, row, ["Total_period_1449"])) || 0,
      teacherGender: String(getCol_(index, row, ["TeacherGender", "teacherGender"])).trim(),
      musaid: String(getCol_(index, row, ["Musaid", "musaid"])).trim(),
      ustadDaera: String(getCol_(index, row, [
        "Ustad_Daera", "USTAD_DAERA", "ustad_daera", "ustadDaera",
        "Ustad Daera", "Daera", "Daerat", "Daerat_Name", "Daerat Name"
      ])).trim()
    });
  }
  return { rows: rows, headers: headers };
}

function syncRow_(rowNumber, newIts, newName) {
  if (!Number.isInteger(Number(rowNumber)) || Number(rowNumber) < 2) {
    throw new Error("Invalid sheet row.");
  }
  const sheet = getSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const index = buildColIdx_(headers);
  const itsCol = index.its !== undefined ? index.its : index.ITS;
  const nameCol = index.name !== undefined ? index.name : index.Name;
  if (itsCol !== undefined) sheet.getRange(Number(rowNumber), itsCol + 1).setValue(String(newIts || ""));
  if (nameCol !== undefined) sheet.getRange(Number(rowNumber), nameCol + 1).setValue(String(newName || ""));
  return { success: true };
}

function getTeacherPhotos_() {
  if (!CONFIG.photoFolderId || CONFIG.photoFolderId.indexOf("PASTE_") === 0) return {};
  const result = {};
  const files = DriveApp.getFolderById(CONFIG.photoFolderId).getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const match = file.getName().trim().match(/^(\d+)(?:\.(jpg|jpeg|png|webp))?$/i);
    if (!match) continue;
    result[match[1]] = "data:" + file.getMimeType() + ";base64," +
      Utilities.base64Encode(file.getBlob().getBytes());
  }
  return result;
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  return CONFIG.sheetName ? spreadsheet.getSheetByName(CONFIG.sheetName) : spreadsheet.getSheets()[0];
}

function buildColIdx_(headers) {
  const index = {};
  headers.forEach(function (header, i) {
    const key = String(header || "").trim();
    index[key] = i;
    index[key.toLowerCase()] = i;
  });
  return index;
}

function getCol_(index, row, names) {
  for (let i = 0; i < names.length; i++) {
    const position = index[names[i]] !== undefined ? index[names[i]] : index[names[i].toLowerCase()];
    if (position !== undefined && row[position] !== "") return row[position];
  }
  return "";
}

function json_(payload, status) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
