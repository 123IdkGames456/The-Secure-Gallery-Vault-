const IMAGE_FOLDER_ID = "1w0R8gjCiNEcMD1AAdfeVplwvzThJaoto";
const VIDEO_FOLDER_ID = "1HbO0_G4w26iMWhXM_UjQ-Jnaf8x9cTBw";
const TEXT_SPREADSHEET_ID = "1qJ9iFvPsQ9--BoWMHhaGZ9sF6GnsF_4hYRGOpbfoqa8";
const TEXT_SHEET_NAME = "Texts";

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || "list";
  let result;
  try {
    if (action === "read") {
      result = readText(p.id);
    } else {
      result = listFiles();
    }
  } catch (err) {
    result = { ok: false, error: String(err.message || err) };
  }
  return output(result, p.callback);
}

function doPost(e) {
  let result;
  try {
    const p = (e && e.parameter) || {};
    if (p.action === "createText") {
      result = createText(p.name, p.content);
    } else if (p.action === "updateText") {
      result = updateText(p.id, p.name, p.content);
    } else {
      throw new Error("Unknown action");
    }
  } catch (err) {
    result = { ok: false, error: String(err.message || err) };
  }
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' +
    JSON.stringify({ type: "galleryWriteResult", result: result }).replace(/</g, "\\u003c") +
    ', "*");</script>'
  );
}

function listFiles() {
  const images = getFiles(IMAGE_FOLDER_ID, true);
  const videos = getFiles(VIDEO_FOLDER_ID, false);
  const texts = getSheetTexts();
  return {
    ok: true,
    images: images.filter(x => x.mimeType.indexOf("image/") === 0),
    videos: videos,
    texts: texts,
    counts: { images: images.length, videos: videos.length, texts: texts.length },
    delivery: { canSendImagesToClient: false, canSendVideosToClient: false, textStorage: "Google Sheets" }
  };
}

function getTextSheet() {
  const spreadsheet = SpreadsheetApp.openById(TEXT_SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(TEXT_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(TEXT_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Name", "Content", "Last edited"]);
  } else {
    const headers = sheet.getRange(1, 1, 1, Math.max(4, sheet.getLastColumn())).getValues()[0];
    if (headers[0] !== "ID") {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, 4).setValues([["ID", "Name", "Content", "Last edited"]]);
    }
  }
  return sheet;
}

function getSheetTexts() {
  const sheet = getTextSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 4).getValues()
    .filter(row => row[0] && row[1])
    .map(row => ({
      id: String(row[0]),
      name: String(row[1]),
      lastEdited: row[3] ? new Date(row[3]).toISOString() : ""
    }));
}

function readText(id) {
  if (!id) throw new Error("Missing text ID.");
  const sheet = getTextSheet();
  const row = findTextRow(sheet, id);
  if (!row) throw new Error("Text not found in Google Sheets.");
  const values = sheet.getRange(row, 1, 1, 4).getValues()[0];
  return {
    ok: true,
    id: String(values[0]),
    name: String(values[1]),
    content: String(values[2] || "")
  };
}

function createText(name, content) {
  const sheet = getTextSheet();
  const id = Utilities.getUuid();
  const safe = ensureTxt(name || "New text.txt");
  sheet.appendRow([id, safe, String(content || ""), new Date()]);
  return { ok: true, id: id, name: safe };
}

function updateText(id, name, content) {
  if (!id) throw new Error("Missing text ID.");
  const sheet = getTextSheet();
  const row = findTextRow(sheet, id);
  if (!row) throw new Error("Text not found in Google Sheets.");
  const oldName = sheet.getRange(row, 2).getValue();
  sheet.getRange(row, 2, 1, 3).setValues([
    [ensureTxt(name || oldName), String(content || ""), new Date()]
  ]);
  return { ok: true, id: String(id), name: ensureTxt(name || oldName) };
}

function findTextRow(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  const wanted = String(id);
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === wanted) return i + 2;
  }
  return 0;
}

function getFiles(folderId, imagesOnly) {
  const folder = DriveApp.getFolderById(folderId);
  const iterator = folder.getFiles();
  const files = [];
  while (iterator.hasNext()) {
    const file = iterator.next();
    const mime = file.getMimeType();
    if (imagesOnly && mime.indexOf("image/") !== 0) continue;
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const id = file.getId();
    files.push({
      id: id,
      name: file.getName(),
      mimeType: mime,
      url: imagesOnly
        ? "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w1600"
        : "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(id),
      previewUrl: "https://drive.google.com/file/d/" + encodeURIComponent(id) + "/preview",
      canSendToClient: false
    });
  }
  return files;
}

function output(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function safeName(name) {
  return String(name || "text").replace(/[\\/:*?"<>|]/g, "_").slice(0, 180);
}

function ensureTxt(name) {
  name = safeName(name);
  return /\.txt$/i.test(name) ? name : name + ".txt";
}
