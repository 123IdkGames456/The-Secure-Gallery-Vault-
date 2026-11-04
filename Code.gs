const SPREADSHEET_ID = "1QZckLOQyYTiTumAtZJOTDb3_fhiVw6KSkAuPUZE3-78";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const DRIVE_FOLDER_NAME = "Secure Gallery Vault Images";

function doGet() {
  return output_({ ok: true, service: "Secure Gallery Vault API", version: 2 });
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(request.action || "");
    if (action === "createRoom") return output_(createRoom_());
    if (action === "listImages") return output_(listImages_(request.roomCode));
    if (action === "uploadImage") return output_(uploadImage_(request));
    if (action === "getImage") return output_(getImage_(request));
    return output_({ ok: false, error: "Unknown action." });
  } catch (error) {
    return output_({ ok: false, error: error && error.message ? error.message : String(error) });
  }
}

function output_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function sheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let rooms = ss.getSheetByName("VaultRooms");
  if (!rooms) {
    rooms = ss.insertSheet("VaultRooms");
    rooms.appendRow(["RoomCode", "CreatedAt"]);
  }
  let files = ss.getSheetByName("VaultFiles");
  if (!files) {
    files = ss.insertSheet("VaultFiles");
    files.appendRow(["RoomCode", "ImageId", "DriveFileId", "FileName", "MimeType", "ThumbnailBase64", "CreatedAt"]);
  }
  return { rooms: rooms, files: files };
}

function driveFolder_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty("VAULT_DRIVE_FOLDER_ID");
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (e) {}
  }
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
  props.setProperty("VAULT_DRIVE_FOLDER_ID", folder.getId());
  return folder;
}

function createRoom_() {
  const s = sheets_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let code;
    do {
      code = Utilities.getUuid().replace(/-/g, "").substring(0, 8).toUpperCase();
    } while (s.rooms.createTextFinder(code).matchEntireCell(true).findNext());
    s.rooms.appendRow([code, new Date()]);
    return { ok: true, roomCode: code };
  } finally { lock.releaseLock(); }
}

function validRoom_(roomCode) {
  const code = String(roomCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{5,32}$/.test(code)) throw new Error("Invalid room code.");
  const s = sheets_();
  if (!s.rooms.createTextFinder(code).matchEntireCell(true).findNext()) throw new Error("Room not found.");
  return { code: code, sheets: s };
}

function listImages_(roomCode) {
  const room = validRoom_(roomCode);
  const sheet = room.sheets.files;
  if (sheet.getLastRow() < 2) return { ok: true, images: [] };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  const images = [];
  rows.forEach(function(row) {
    if (String(row[0]) !== room.code) return;
    images.push({
      imageId: String(row[1]),
      fileName: String(row[3]),
      mimeType: String(row[4]),
      thumbnailBase64: String(row[5] || "")
    });
  });
  return { ok: true, images: images };
}

function uploadImage_(request) {
  const room = validRoom_(request.roomCode);
  const imageId = String(request.imageId || "");
  const fileName = String(request.fileName || "image").replace(/[\\\\/:*?"<>|]/g, "_").substring(0, 180);
  const mimeType = String(request.mimeType || "application/octet-stream");
  const base64 = String(request.base64 || "");
  const thumbnailBase64 = String(request.thumbnailBase64 || "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(imageId)) throw new Error("Invalid image ID.");
  if (!/^image\\/(png|jpeg|webp|gif)$/.test(mimeType)) throw new Error("Unsupported image type.");
  if (!base64 || !/^[A-Za-z0-9+/=]+$/.test(base64)) throw new Error("Invalid image data.");
  const estimatedBytes = Math.floor(base64.length * 3 / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) throw new Error("Image is over the 12 MB upload limit.");
  if (thumbnailBase64.length > 100000 || (thumbnailBase64 && !/^[A-Za-z0-9+/=]+$/.test(thumbnailBase64))) throw new Error("Invalid thumbnail.");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let driveFile = null;
  try {
    const sheet = room.sheets.files;
    const last = sheet.getLastRow();
    if (last >= 2) {
      const existing = sheet.getRange(2, 1, last - 1, 2).getValues();
      for (let i = 0; i < existing.length; i++) {
        if (String(existing[i][0]) === room.code && String(existing[i][1]) === imageId) throw new Error("This image already exists.");
      }
    }
    const bytes = Utilities.base64Decode(base64);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    driveFile = driveFolder_().createFile(blob);
    // Files remain private in Drive. The web app streams image data only after validating the room code.
    sheet.appendRow([room.code, imageId, driveFile.getId(), fileName, mimeType, thumbnailBase64, new Date()]);
    return { ok: true, imageId: imageId };
  } catch (error) {
    if (driveFile) {
      try { driveFile.setTrashed(true); } catch (ignored) {}
    }
    throw error;
  } finally { lock.releaseLock(); }
}

function getImage_(request) {
  const room = validRoom_(request.roomCode);
  const imageId = String(request.imageId || "");
  const sheet = room.sheets.files;
  if (sheet.getLastRow() < 2) throw new Error("Image not found.");
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[0]) === room.code && String(row[1]) === imageId) {
      const file = DriveApp.getFileById(String(row[2]));
      const blob = file.getBlob();
      return {
        ok: true,
        imageId: imageId,
        fileName: String(row[3]),
        mimeType: String(row[4]),
        base64: Utilities.base64Encode(blob.getBytes())
      };
    }
  }
  throw new Error("Image not found in this room.");
}
