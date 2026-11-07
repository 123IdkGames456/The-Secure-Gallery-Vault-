function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || "list";
  const isHTML = action === "html_list";
  if (action !== "list" && !isHTML) {
    return jsonResponse_({ok:false,error:"Unknown action."}, params.callback);
  }
  try {
    const sheet = getLibrarySheet_(isHTML ? "HTML" : "Texts");
    const records = readRecords_(sheet);
    const result = isHTML
      ? {ok:true,html:records.map(r=>({id:r.id,title:r.title,html:r.content,updatedAt:r.updatedAt}))}
      : {ok:true,texts:records.map(r=>({id:r.id,title:r.title,text:r.content,wordCount:r.content.trim()?r.content.trim().split(/\s+/).length:0,updatedAt:r.updatedAt}))};
    return jsonResponse_(result, params.callback);
  } catch (error) {
    return jsonResponse_({ok:false,error:String(error)}, params.callback);
  }
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || "";
  let result;
  try {
    if (action === "save" || action === "html_save") {
      const isHTML = action === "html_save";
      const sheet = getLibrarySheet_(isHTML ? "HTML" : "Texts");
      const id = saveRecord_(sheet, p.id || "", p.title || (isHTML ? "Untitled HTML" : "Untitled"), isHTML ? (p.html || "") : (p.text || ""));
      result = {ok:true,action:action,id:id};
    } else if (action === "delete" || action === "html_delete") {
      const sheet = getLibrarySheet_(action === "html_delete" ? "HTML" : "Texts");
      deleteRecord_(sheet, p.id || "");
      result = {ok:true,action:action,id:p.id || ""};
    } else {
      result = {ok:false,error:"Unknown action."};
    }
  } catch (error) {
    result = {ok:false,error:String(error),action:action};
  }
  const messageType = action.indexOf("html_") === 0 ? "htmlLibraryResult" : "textLibraryResult";
  const safe = JSON.stringify({type:messageType,result:result}).replace(/</g,"\\u003c");
  return HtmlService.createHtmlOutput("<!doctype html><html><body><script>window.parent.postMessage("+safe+",'*');</script>Request complete. You can close this window.</body></html>")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getLibrarySheet_(name) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("This Apps Script must be attached to the Google Sheet. Open the sheet and choose Extensions > Apps Script.");
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,4).setValues([["ID","Name","Content","Last edited"]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readRecords_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2,1,lastRow-1,4).getValues()
    .filter(row => row[0] !== "" && row[0] !== null)
    .map(row => ({
      id:String(row[0]),
      title:String(row[1] || "Untitled"),
      content:String(row[2] || ""),
      updatedAt:row[3] instanceof Date ? row[3].toISOString() : (row[3] ? String(row[3]) : "")
    }));
}

function saveRecord_(sheet, id, title, content) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const lastRow = sheet.getLastRow();
    let rowNumber = 0;
    if (id && lastRow >= 2) {
      const ids = sheet.getRange(2,1,lastRow-1,1).getDisplayValues();
      const index = ids.findIndex(row => String(row[0]) === String(id));
      if (index >= 0) rowNumber = index + 2;
    }
    if (!id || !rowNumber) id = Utilities.getUuid();
    if (!rowNumber) rowNumber = sheet.getLastRow() + 1;
    sheet.getRange(rowNumber,1,1,4).setValues([[id,String(title).slice(0,180),String(content),new Date()]]);
    SpreadsheetApp.flush();
    return id;
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord_(sheet, id) {
  if (!id) throw new Error("Missing record ID.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const ids = sheet.getRange(2,1,lastRow-1,1).getDisplayValues();
    const index = ids.findIndex(row => String(row[0]) === String(id));
    if (index >= 0) sheet.deleteRow(index + 2);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse_(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
