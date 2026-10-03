const CONFIG = {
  spreadsheetId: "1iAl1YgpKqPNnx7SJPAQTncOkquVUmT_RnO3HT_SpgBI",
  googleClientId: "4790857483-dfsu661skbet2drpfhlpb6hgihvndfhg.apps.googleusercontent.com",
  sheetName: "1449Working",
  departmentSheetName: "Dept_Allocation",
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
    if (method === "GET" && action === "departments") {
      return json_(getDepartmentData_());
    }
    if (method === "POST" && action === "sync") {
      return json_(syncRow_(request.rowNumber, request.newIts, request.newName));
    }
    if (method === "POST" && action === "department-sync") {
      return json_(syncTeacherDepartments_(request.its, request.assignments));
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
  const historyHeader = findHeader_(headers, [
    "1448Tafweed", "1448 Tafweed", "1448_Tafweed", "Tafweed1448"
  ]) || "1448 Tafweed";
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
    const historyAssignment = String(getCol_(index, row, [
      "1448Tafweed", "1448 Tafweed", "1448_Tafweed", "Tafweed1448"
    ])).trim();
    const bookName = String(getCol_(index, row, ["BookName", "bookname"])).trim();
    rows.push({
      rowNumber: r + 1, class: cls, section: section, gender: gender,
      shorthand: cls + section + gender, subject: subject,
      bookName: bookName,
      weekly: Number(getCol_(index, row, ["Weekly", "weekly"])) || 0,
      its: its, teacherKey: its || "NAME:" + name, name: name,
      periods1448: historyAssignment,
      history1448: historyAssignment,
      isRepeatAssignment: matchesTeacherHistory_(name, its, historyAssignment),
      essayEligible: isEssayEligible_(bookName, cls),
      totalPeriod1449: Number(getCol_(index, row, ["Total_period_1449"])) || 0,
      teacherGender: String(getCol_(index, row, ["TeacherGender", "teacherGender"])).trim(),
      musaid: String(getCol_(index, row, ["Musaid", "musaid"])).trim(),
      ustadDaera: String(getCol_(index, row, [
        "Ustad_Daera", "USTAD_DAERA", "ustad_daera", "ustadDaera",
        "Ustad Daera", "Daera", "Daerat", "Daerat_Name", "Daerat Name"
      ])).trim()
    });
  }
  return { rows: rows, headers: headers, historyHeader: historyHeader };
}

function getDepartmentData_() {
  const sheet = getNamedSheet_(CONFIG.departmentSheetName);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return { rows: [], headers: values[0] || [] };

  const headers = values[0].map(function (header) { return String(header || "").trim(); });
  const index = buildColIdx_(headers);
  const itsCol = findColumnIndex_(index, [
    "ITS", "Teacher ITS", "ITS Number", "ITS No", "ITS_No", "ITS ID", "ITS_ID",
    "ITSID", "ItsID", "TeacherITS"
  ]);
  if (itsCol === -1) throw new Error("Dept_Allocation is missing an ITS column.");

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const its = String(row[itsCol] || "").trim();
    if (!its) continue;
    rows.push({
      rowNumber: r + 1,
      its: its,
      department: String(getCol_(index, row, [
        "department", "department_en", "department english", "DepartmentName", "Department Name"
      ])).trim(),
      departmentAr: String(getCol_(index, row, [
        "department_ar", "department ar", "arabic department", "DepartmentNameAR",
        "Department Name AR", "DepartmentName_Ar"
      ])).trim(),
      designation: String(getCol_(index, row, ["designation", "designations", "Designation"])).trim(),
      responsibility: String(getCol_(index, row, ["responsibility", "responsibilities"])).trim(),
      deptResponsibilitiesMaster: String(getCol_(index, row, [
        "dept_responsibilities_Master", "dept responsibilities master",
        "dept_responsibilities_Master field details", "dept_responsibilities_master",
        "Department Responsibilities Master", "Responsibilities Master"
      ])).trim()
    });
  }
  return { rows: rows, headers: headers };
}

function syncTeacherDepartments_(its, assignments) {
  const teacherIts = String(its || "").trim();
  if (!teacherIts) throw new Error("Teacher ITS is required.");
  if (!Array.isArray(assignments)) throw new Error("Department assignments must be a list.");

  const sheet = getNamedSheet_(CONFIG.departmentSheetName);
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) throw new Error("Dept_Allocation has no header row.");
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const index = buildColIdx_(headers);
  const columns = {
    its: findColumnIndex_(index, [
      "ITS", "Teacher ITS", "ITS Number", "ITS No", "ITS_No", "ITS ID", "ITS_ID",
      "ITSID", "ItsID", "TeacherITS"
    ]),
    department: findColumnIndex_(index, [
      "department", "department_en", "department english", "DepartmentName", "Department Name"
    ]),
    departmentAr: findColumnIndex_(index, [
      "department_ar", "department ar", "arabic department", "DepartmentNameAR",
      "Department Name AR", "DepartmentName_Ar"
    ]),
    designation: findColumnIndex_(index, ["designation", "designations"]),
    responsibility: findColumnIndex_(index, ["responsibility", "responsibilities"]),
    deptResponsibilitiesMaster: findColumnIndex_(index, [
      "dept_responsibilities_Master", "dept responsibilities master",
      "dept_responsibilities_Master field details", "dept_responsibilities_master",
      "Department Responsibilities Master", "Responsibilities Master"
    ])
  };
  Object.keys(columns).forEach(function (key) {
    if (columns[key] === -1 && key !== "responsibility" && key !== "deptResponsibilitiesMaster") {
      throw new Error("Dept_Allocation is missing the " + key + " column.");
    }
  });
  if (columns.responsibility === -1 && columns.deptResponsibilitiesMaster === -1) {
    throw new Error("Dept_Allocation is missing a responsibility column.");
  }

  const lastRow = sheet.getLastRow();
  const data = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues()
    : [];
  const target = normaliseIts_(teacherIts);
  const matchingRows = [];
  data.forEach(function (row, offset) {
    if (normaliseIts_(row[columns.its]) === target) matchingRows.push(offset + 2);
  });

  const cleaned = assignments.map(function (assignment) {
    if (!assignment || typeof assignment !== "object") {
      throw new Error("Each department assignment must be an object.");
    }
    return {
      department: String(assignment.department || "").trim(),
      departmentAr: String(assignment.departmentAr || "").trim(),
      designation: String(assignment.designation || "").trim(),
      responsibility: String(assignment.responsibility || "").trim(),
      deptResponsibilitiesMaster: String(assignment.deptResponsibilitiesMaster || "").trim()
    };
  }).filter(function (assignment) {
    return assignment.department || assignment.departmentAr ||
      assignment.designation || assignment.responsibility || assignment.deptResponsibilitiesMaster;
  });

  const existingCount = matchingRows.length;
  if (cleaned.length > existingCount) {
    for (let i = existingCount; i < cleaned.length; i++) {
      matchingRows.push(lastRow + 1 + i - existingCount);
    }
  }

  for (let i = 0; i < Math.max(matchingRows.length, cleaned.length); i++) {
    const rowNumber = matchingRows[i];
    if (i < cleaned.length) {
      const assignment = cleaned[i];
      sheet.getRange(rowNumber, columns.its + 1).setValue(teacherIts);
      sheet.getRange(rowNumber, columns.department + 1).setValue(assignment.department);
      sheet.getRange(rowNumber, columns.departmentAr + 1).setValue(assignment.departmentAr);
      sheet.getRange(rowNumber, columns.designation + 1).setValue(assignment.designation);
      if (columns.responsibility !== -1) {
        sheet.getRange(rowNumber, columns.responsibility + 1).setValue(assignment.responsibility);
      }
      if (columns.deptResponsibilitiesMaster !== -1) {
        sheet.getRange(rowNumber, columns.deptResponsibilitiesMaster + 1)
          .setValue(assignment.deptResponsibilitiesMaster);
      }
    } else if (matchingRows[i]) {
      sheet.getRange(rowNumber, columns.department + 1, 1, 1).clearContent();
      sheet.getRange(rowNumber, columns.departmentAr + 1, 1, 1).clearContent();
      sheet.getRange(rowNumber, columns.designation + 1, 1, 1).clearContent();
      if (columns.responsibility !== -1) {
        sheet.getRange(rowNumber, columns.responsibility + 1, 1, 1).clearContent();
      }
      if (columns.deptResponsibilitiesMaster !== -1) {
        sheet.getRange(rowNumber, columns.deptResponsibilitiesMaster + 1, 1, 1).clearContent();
      }
    }
  }
  return { success: true };
}

function normaliseIts_(value) {
  return String(value || "").trim().toLowerCase();
}

function findColumnIndex_(index, names) {
  for (let i = 0; i < names.length; i++) {
    const key = names[i].toLowerCase();
    if (index[key] !== undefined) return index[key];
  }
  return -1;
}

function normaliseTeacherMatch_(value) {
  return String(value || "").toLowerCase()
    .replace(/[\u2018\u2019\u201b\u02bb]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function matchesTeacherHistory_(name, its, historyAssignment) {
  const history = normaliseTeacherMatch_(historyAssignment);
  if (!history) return false;
  return [name, its].some(function (value) {
    const candidate = normaliseTeacherMatch_(value);
    return candidate && (candidate === history ||
      candidate.indexOf(history) !== -1 || history.indexOf(candidate) !== -1);
  });
}

function isEssayEligible_(bookName, classValue) {
  const book = normaliseTeacherMatch_(bookName);
  const classNumber = Number(classValue);
  if (classNumber >= 1 && classNumber <= 4) {
    return book === "essay" || book === "english";
  }
  if (classNumber >= 5 && classNumber <= 7) {
    return book === "almasul" || book === "literature";
  }
  return false;
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
  collectTeacherPhotos_(DriveApp.getFolderById(CONFIG.photoFolderId), result);
  return result;
}

function collectTeacherPhotos_(folder, result) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (String(file.getMimeType()).toLowerCase().indexOf("image/") !== 0) continue;
    const match = file.getName().trim().match(/(?:^|[^0-9])(\d{8})(?:[^0-9]|$)/);
    if (!match) continue;
    result[match[1]] = "data:" + file.getMimeType() + ";base64," +
      Utilities.base64Encode(file.getBlob().getBytes());
  }
  const folders = folder.getFolders();
  while (folders.hasNext()) collectTeacherPhotos_(folders.next(), result);
}

function getSheet_() {
  return getNamedSheet_(CONFIG.sheetName);
}

function getNamedSheet_(name) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  if (!name) return spreadsheet.getSheets()[0];
  const exact = spreadsheet.getSheetByName(name);
  if (exact) return exact;
  const wanted = name.toLowerCase();
  const match = spreadsheet.getSheets().find(function (sheet) {
    return sheet.getName().toLowerCase() === wanted;
  });
  if (!match) throw new Error("Sheet tab not found: " + name);
  return match;
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

function findHeader_(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const wanted = names[i].toLowerCase();
    for (let j = 0; j < headers.length; j++) {
      if (String(headers[j]).toLowerCase() === wanted) return headers[j];
    }
  }
  return "";
}

function json_(payload, status) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
