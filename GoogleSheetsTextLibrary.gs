const SPREADSHEET_ID = "1qJ9iFvPsQ9--BoWMHhaGZ9sF6GnsF_4hYRGOpbfoqa8";
const SHEET_NAME = "Text Library";
const HEADERS = ["ID", "Title", "Text", "Created At", "Updated At", "Word Count"];

function doGet(e) {
  const p = (e && e.parameter) || {};
  let result;
  try {
    if (p.action === "list") result = { ok: true, texts: listTexts() };
    else result = { ok: false, error: "Unknown action." };
  } catch (err) { result = { ok: false, error: String(err.message || err) }; }
  return output(result, p.callback);
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  let result;
  try {
    if (p.action === "save") result = saveText(p);
    else if (p.action === "delete") result = deleteText(p.id);
    else throw new Error("Unknown action.");
  } catch (err) { result = { ok: false, error: String(err.message || err) }; }
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' +
    JSON.stringify({ type: "textLibraryResult", result: result }).replace(/</g, "\\u003c") + ', "*");</script>');
}

function getSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function listTexts() {
  const sheet = getSheet();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues()
    .filter(row => row[0] && row[2] !== "")
    .map(row => ({ id: String(row[0]), title: String(row[1] || "Untitled"), text: String(row[2] || ""),
      createdAt: row[3] instanceof Date ? row[3].toISOString() : String(row[3] || ""),
      updatedAt: row[4] instanceof Date ? row[4].toISOString() : String(row[4] || ""),
      wordCount: Number(row[5]) || countWords(String(row[2] || "")) })).reverse();
}

function saveText(p) {
  const id = String(p.id || "").trim();
  const title = String(p.title || "Untitled").trim().slice(0, 180) || "Untitled";
  const content = String(p.text || "");
  if (!content.trim()) throw new Error("Text cannot be empty.");
  if (content.length > 500000) throw new Error("Text is too large (maximum 500,000 characters).");
  const sheet = getSheet(), now = new Date(), lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (id && sheet.getLastRow() >= 2) {
      const found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
      if (found) {
        const row = found.getRow(), created = sheet.getRange(row, 4).getValue() || now;
        sheet.getRange(row, 1, 1, HEADERS.length).setValues([[id, title, content, created, now, countWords(content)]]);
        return { ok: true, action: "save", id: id, title: title, updated: true };
      }
    }
    const newId = Utilities.getUuid();
    sheet.appendRow([newId, title, content, now, now, countWords(content)]);
    return { ok: true, action: "save", id: newId, title: title, updated: false };
  } finally { lock.releaseLock(); }
}

function deleteText(id) {
  id = String(id || "").trim();
  if (!id) throw new Error("Missing text ID.");
  const sheet = getSheet();
  if (sheet.getLastRow() < 2) throw new Error("Text not found.");
  const found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  if (!found) throw new Error("Text not found.");
  sheet.deleteRow(found.getRow());
  return { ok: true, action: "delete", id: id };
}

function countWords(value) { const s = String(value || "").trim(); return s ? s.split(/\s+/).length : 0; }
function output(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback))
    return ContentService.createTextOutput(callback + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}