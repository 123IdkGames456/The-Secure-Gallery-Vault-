const SPREADSHEET_ID = "1WX2xLz_X4an9Sag2rjen_Y0hyn8fHNjYyX6tzRyYAuw";
const SHEET_NAME = "PicrdImages";

function setupVault() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["imageId","roomHash","name","mimeType","createdAt","imageUrl","deleteUrl"]);
  }
  props.setProperty("SPREADSHEET_ID", SPREADSHEET_ID);
  if (!props.getProperty("MASTER_PASSWORD")) props.setProperty("MASTER_PASSWORD", "CHANGE_THIS_MASTER_PASSWORD");
  if (!props.getProperty("ROOM_CODES")) props.setProperty("ROOM_CODES", "CHANGE_THIS_TO_COMMA_SEPARATED_ROOM_CODES");
  Logger.log("Using spreadsheet: https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/edit");
  Logger.log("Set MASTER_PASSWORD and ROOM_CODES in Project Settings > Script Properties before deploying.");
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty("SPREADSHEET_ID") !== SPREADSHEET_ID) throw new Error("Run setupVault() first.");
    if (body.masterPassword !== props.getProperty("MASTER_PASSWORD")) throw new Error("Incorrect master password.");
    if (body.action === "checkMaster") return output({ok:true});

    const code = String(body.roomCode || "");
    const allowed = (props.getProperty("ROOM_CODES") || "").split(",").map(x => x.trim()).filter(Boolean);
    if (!allowed.includes(code)) throw new Error("That room code is not valid.");

    const roomHash = digest(code);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Run setupVault() first.");

    if (body.action === "listImages") {
      const rows = sheet.getDataRange().getValues();
      const images = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r[1] !== roomHash || !String(r[5] || "").startsWith("https://i.picrd.com/images/")) continue;
        images.push({id:r[0],name:r[2],mimeType:r[3],createdAt:r[4],imageUrl:r[5]});
      }
      images.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      return output({ok:true,images});
    }

    if (body.action === "registerImage") {
      const imageId = String(body.imageId || "").slice(0,100);
      const imageUrl = String(body.imageUrl || "");
      const deleteUrl = String(body.deleteUrl || "");
      const name = String(body.name || "image").slice(0,180);
      const mimeType = String(body.mimeType || "");
      if (!imageId) throw new Error("Missing Picrd image ID.");
      if (!/^https:\/\/i\.picrd\.com\/images\/[A-Za-z0-9_-]+\.(png|jpe?g|webp|gif)$/i.test(imageUrl)) throw new Error("Invalid Picrd image URL.");
      if (!/^https:\/\/picrd\.com\/delete\/[A-Za-z0-9_-]+$/i.test(deleteUrl)) throw new Error("Invalid Picrd delete URL.");
      if (!["image/png","image/jpeg","image/webp","image/gif"].includes(mimeType)) throw new Error("Unsupported image type.");
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        sheet.appendRow([imageId,roomHash,name,mimeType,new Date().toISOString(),imageUrl,deleteUrl]);
      } finally {
        lock.releaseLock();
      }
      return output({ok:true,id:imageId});
    }

    throw new Error("Unknown action.");
  } catch (err) {
    return output({ok:false,error:String(err.message || err)});
  }
}

function digest(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8);
  return bytes.map(b => (b + 256).toString(16).slice(-2)).join("");
}

function output(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
