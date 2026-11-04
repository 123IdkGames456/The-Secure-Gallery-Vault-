const SPREADSHEET_ID = "1QZckLOQyYTiTumAtZJOTDb3_fhiVw6KSkAuPUZE3-78";
const CHUNK_SIZE = 40000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function doGet(e) {
  return output_({ ok: true, service: "Secure Gallery Vault API", version: 1 });
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(request.action || "");
    if (action === "createRoom") return output_(createRoom_());
    if (action === "listImages") return output_(listImages_(request.roomCode));
    if (action === "uploadChunk") return output_(uploadChunk_(request));
    if (action === "getImage") return output_(getImage_(request));
    return output_({ ok: false, error: "Unknown action." });
  } catch (error) {
    return output_({ ok: false, error: error && error.message ? error.message : String(error) });
  }
}

function output_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let rooms = ss.getSheetByName("VaultRooms");
  if (!rooms) {
    rooms = ss.insertSheet("VaultRooms");
    rooms.appendRow(["RoomCode", "CreatedAt"]);
  }
  let images = ss.getSheetByName("VaultImages");
  if (!images) {
    images = ss.insertSheet("VaultImages");
    images.appendRow(["RoomCode", "ImageId", "ChunkIndex", "TotalChunks", "FileName", "MimeType", "Base64Data", "CreatedAt"]);
  }
  return { rooms: rooms, images: images };
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
  } finally {
    lock.releaseLock();
  }
}

function validRoom_(roomCode) {
  const code = String(roomCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{5,32}$/.test(code)) throw new Error("Invalid room code.");
  const s = sheets_();
  const found = s.rooms.createTextFinder(code).matchEntireCell(true).findNext();
  if (!found) throw new Error("Room not found.");
  return { code: code, sheets: s };
}

function listImages_(roomCode) {
  const room = validRoom_(roomCode);
  const sheet = room.sheets.images;
  if (sheet.getLastRow() < 2) return { ok: true, images: [] };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  const grouped = {};
  rows.forEach(function(row) {
    if (String(row[0]) !== room.code) return;
    const id = String(row[1]);
    if (!grouped[id]) grouped[id] = {
      imageId: id, fileName: String(row[4]), mimeType: String(row[5]),
      totalChunks: Number(row[3]), chunksFound: 0
    };
    grouped[id].chunksFound++;
  });
  const images = Object.keys(grouped).map(function(id) { return grouped[id]; })
    .filter(function(item) { return item.chunksFound === item.totalChunks; });
  return { ok: true, images: images };
}

function uploadChunk_(request) {
  const room = validRoom_(request.roomCode);
  const imageId = String(request.imageId || "");
  const fileName = String(request.fileName || "image");
  const mimeType = String(request.mimeType || "application/octet-stream");
  const chunkIndex = Number(request.chunkIndex);
  const totalChunks = Number(request.totalChunks);
  const data = String(request.data || "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(imageId)) throw new Error("Invalid image ID.");
  if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || totalChunks < 1 || chunkIndex < 0 || chunkIndex >= totalChunks) throw new Error("Invalid chunk position.");
  if (!data || data.length > CHUNK_SIZE || !/^[A-Za-z0-9+/=]+$/.test(data)) throw new Error("Invalid image data chunk.");
  if (totalChunks * CHUNK_SIZE > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + CHUNK_SIZE) throw new Error("Image is too large.");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = room.sheets.images;
    const last = sheet.getLastRow();
    if (last >= 2) {
      const existing = sheet.getRange(2, 1, last - 1, 3).getValues();
      for (let i = 0; i < existing.length; i++) {
        if (String(existing[i][0]) === room.code && String(existing[i][1]) === imageId && Number(existing[i][2]) === chunkIndex) {
          throw new Error("This image chunk was already uploaded.");
        }
      }
    }
    sheet.appendRow([room.code, imageId, chunkIndex, totalChunks, fileName, mimeType, data, new Date()]);
    return { ok: true, imageId: imageId, chunkIndex: chunkIndex };
  } finally {
    lock.releaseLock();
  }
}

function getImage_(request) {
  const room = validRoom_(request.roomCode);
  const imageId = String(request.imageId || "");
  const sheet = room.sheets.images;
  if (sheet.getLastRow() < 2) throw new Error("Image not found.");
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  const chunks = [];
  let meta = null;
  rows.forEach(function(row) {
    if (String(row[0]) === room.code && String(row[1]) === imageId) {
      meta = { fileName: String(row[4]), mimeType: String(row[5]), totalChunks: Number(row[3]) };
      chunks[Number(row[2])] = String(row[6]);
    }
  });
  if (!meta || chunks.filter(function(x) { return typeof x === "string"; }).length !== meta.totalChunks) throw new Error("Image is incomplete or does not exist.");
  let base64 = "";
  for (let i = 0; i < meta.totalChunks; i++) {
    if (typeof chunks[i] !== "string") throw new Error("An image chunk is missing.");
    base64 += chunks[i];
  }
  return { ok: true, imageId: imageId, fileName: meta.fileName, mimeType: meta.mimeType, base64: base64 };
}
