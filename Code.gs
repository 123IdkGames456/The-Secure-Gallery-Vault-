const SPREADSHEET_ID = "1QZckLOQyYTiTumAtZJOTDb3_fhiVw6KSkAuPUZE3-78";
const IMAGEKIT_PUBLIC_KEY = "public_XZbFss0pNSVF1c3axMLcanvYZUc=";
const IMAGEKIT_ENDPOINT = "https://ik.imagekit.io/ibaggrixo";
const IMAGEKIT_API_BASE = "https://api.imagekit.io/v1";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const callback = String(params.callback || "");
  const action = String(params.action || "");
  try {
    let result;
    if (action === "createRoom") result = createRoom_();
    else if (action === "listImages") result = listImages_(params.roomCode);
    else if (action === "signUpload") result = signUpload_(params.roomCode);
    else if (action === "registerImage") result = registerImage_(params);
    else if (action === "deleteImage") result = deleteImage_(params.roomCode, params.fileId);
    else if (action === "health") result = { ok: true, service: "Secure Gallery Vault", storage: "ImageKit", upload: "direct-binary" };
    else result = { ok: false, error: "Unknown action." };
    return jsonp_(result, callback);
  } catch (error) {
    return jsonp_({ ok: false, error: error && error.message ? error.message : String(error) }, callback);
  }
}

function jsonp_(data, callback) {
  const safeCallback = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback) ? callback : "";
  const json = JSON.stringify(data);
  if (!safeCallback) {
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(safeCallback + "(" + json + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function sheets_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let rooms = spreadsheet.getSheetByName("VaultRooms");
  if (!rooms) {
    rooms = spreadsheet.insertSheet("VaultRooms");
    rooms.appendRow(["RoomCode", "CreatedAt"]);
  }
  let files = spreadsheet.getSheetByName("VaultFiles");
  if (!files) {
    files = spreadsheet.insertSheet("VaultFiles");
    files.appendRow(["RoomCode", "ImageId", "DriveFileId", "FileName", "MimeType", "ThumbnailBase64", "CreatedAt"]);
  }
  if (files.getMaxColumns() < 11) files.insertColumnsAfter(files.getMaxColumns(), 11 - files.getMaxColumns());
  const extraHeaders = files.getRange(1, 8, 1, 4).getValues()[0];
  if (!extraHeaders[0]) {
    files.getRange(1, 8, 1, 4).setValues([["ImageKitFileId", "ImageUrl", "ThumbnailUrl", "FileSize"]]);
  }
  return { rooms, files };
}

function createRoom_() {
  const sheets = sheets_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let code;
    do {
      code = Utilities.getUuid().replace(/-/g, "").substring(0, 8).toUpperCase();
    } while (sheets.rooms.createTextFinder(code).matchEntireCell(true).findNext());
    sheets.rooms.appendRow([code, new Date()]);
    return { ok: true, roomCode: code };
  } finally {
    lock.releaseLock();
  }
}

function validRoom_(roomCode) {
  const code = String(roomCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{5,32}$/.test(code)) throw new Error("Invalid room code.");
  const sheets = sheets_();
  if (!sheets.rooms.createTextFinder(code).matchEntireCell(true).findNext()) throw new Error("Room not found.");
  return { code, sheets };
}

function listImages_(roomCode) {
  const room = validRoom_(roomCode);
  const sheet = room.sheets.files;
  if (sheet.getLastRow() < 2) return { ok: true, images: [] };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
  const images = [];
  rows.forEach(row => {
    if (String(row[0]) !== room.code) return;
    if (row[8]) {
      images.push({
        imageId: String(row[1]),
        fileId: String(row[7]),
        fileName: String(row[3]),
        mimeType: String(row[4]),
        size: Number(row[10]) || 0,
        url: String(row[8]),
        thumbnailUrl: String(row[9] || row[8]),
        createdAt: row[6] instanceof Date ? row[6].toISOString() : String(row[6] || "")
      });
    }
  });
  images.reverse();
  return { ok: true, images };
}

function signUpload_(roomCode) {
  validRoom_(roomCode);
  const privateKey = PropertiesService.getScriptProperties().getProperty("IMAGEKIT_PRIVATE_KEY");
  if (!privateKey) throw new Error("IMAGEKIT_PRIVATE_KEY is missing from Apps Script Script Properties.");
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const expire = Math.floor(Date.now() / 1000) + 300;
  const signatureBytes = Utilities.computeHmacSha1Signature(token + expire, privateKey);
  const signature = signatureBytes.map(byte => {
    const value = (byte + 256) % 256;
    return value.toString(16).padStart(2, "0");
  }).join("");
  return { ok: true, token, expire, signature, publicKey: IMAGEKIT_PUBLIC_KEY };
}

function registerImage_(params) {
  const room = validRoom_(params.roomCode);
  const imageId = String(params.imageId || "");
  const fileId = String(params.fileId || "");
  const fileName = String(params.fileName || "image").replace(/[\\/:*?"<>|]/g, "_").substring(0, 180);
  const mimeType = String(params.mimeType || "");
  const size = Number(params.size || 0);
  const url = String(params.url || "");
  const thumbnailUrl = String(params.thumbnailUrl || url);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(imageId)) throw new Error("Invalid image ID.");
  if (!fileId || fileId.length > 200) throw new Error("Invalid ImageKit file ID.");
  if (!/^image\/(png|jpeg|webp|gif)$/.test(mimeType)) throw new Error("Unsupported image type.");
  if (!Number.isFinite(size) || size < 1 || size > MAX_IMAGE_BYTES) throw new Error("Image must be 15 MB or smaller.");
  if (!url.startsWith(IMAGEKIT_ENDPOINT + "/")) throw new Error("Image URL does not match this ImageKit account.");
  if (!thumbnailUrl.startsWith(IMAGEKIT_ENDPOINT + "/")) throw new Error("Thumbnail URL does not match this ImageKit account.");

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = room.sheets.files;
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const existing = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      for (let index = 0; index < existing.length; index++) {
        if (String(existing[index][0]) === room.code && String(existing[index][1]) === imageId) {
          throw new Error("This image is already registered.");
        }
      }
    }
    sheet.appendRow([room.code, imageId, "", fileName, mimeType, "", new Date(), fileId, url, thumbnailUrl, size]);
    return { ok: true, imageId };
  } finally {
    lock.releaseLock();
  }
}

function deleteImage_(roomCode, fileId) {
  const room = validRoom_(roomCode);
  const id = String(fileId || "");
  if (!id || id.length > 200) throw new Error("Invalid image file ID.");
  const privateKey = PropertiesService.getScriptProperties().getProperty("IMAGEKIT_PRIVATE_KEY");
  if (!privateKey) throw new Error("IMAGEKIT_PRIVATE_KEY is missing from Apps Script Script Properties.");

  const sheet = room.sheets.files;
  if (sheet.getLastRow() < 2) throw new Error("Image not found.");
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
  let rowNumber = -1;
  for (let index = 0; index < rows.length; index++) {
    if (String(rows[index][0]) === room.code && String(rows[index][7]) === id) {
      rowNumber = index + 2;
      break;
    }
  }
  if (rowNumber < 0) throw new Error("Image not found in this room.");

  const response = UrlFetchApp.fetch(IMAGEKIT_API_BASE + "/files/" + encodeURIComponent(id), {
    method: "delete",
    headers: { Authorization: "Basic " + Utilities.base64Encode(privateKey + ":") },
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  if (status !== 200 && status !== 204) {
    throw new Error("ImageKit could not delete this image (HTTP " + status + ").");
  }
  sheet.deleteRow(rowNumber);
  return { ok: true };
}
