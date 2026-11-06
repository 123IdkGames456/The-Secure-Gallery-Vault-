const IMAGE_FOLDER_ID = "1w0R8gjCiNEcMD1AAdfeVplwvzThJaoto";
const VIDEO_FOLDER_ID = "1HbO0_G4w26iMWhXM_UjQ-Jnaf8x9cTBw";
const TEXT_FOLDER_ID = "1tao5qocbKyLK_YIX0MtBnDHe3M6erro6";

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || "list";
  let result;
  try {
    if (action === "read") {
      const file = DriveApp.getFileById(p.id);
      if (!isInFolder(file, TEXT_FOLDER_ID)) throw new Error("This file is not in the Text folder");
      result = { ok: true, id: file.getId(), name: file.getName(), content: file.getBlob().getDataAsString("UTF-8") };
    } else result = listFiles();
  } catch (err) {
    result = { ok: false, error: String(err.message || err) };
  }
  return output(result, p.callback);
}

function doPost(e) {
  let result;
  try {
    const p = (e && e.parameter) || {};
    const action = p.action;
    if (action === "createText") {
      const name = ensureTxt(p.name || "New text.txt");
      const file = DriveApp.getFolderById(TEXT_FOLDER_ID).createFile(name, p.content || "", MimeType.PLAIN_TEXT);
      result = { ok: true, id: file.getId(), name: file.getName() };
    } else if (action === "updateText") {
      const file = DriveApp.getFileById(p.id);
      if (!isInFolder(file, TEXT_FOLDER_ID)) throw new Error("This file is not in the Text folder");
      file.setContent(p.content || "");
      if (p.name) file.setName(ensureTxt(p.name));
      result = { ok: true, id: file.getId(), name: file.getName() };
    } else throw new Error("Unknown action");
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
  const texts = getFiles(TEXT_FOLDER_ID, false).filter(x => /\.txt$/i.test(x.name) || x.mimeType === "text/plain");
  return {
    ok: true,
    images: images.filter(x => x.mimeType.indexOf("image/") === 0),
    videos: videos,
    texts: texts,
    counts: { images: images.length, videos: videos.length, texts: texts.length,
      imagesAvailableToClient: images.length, videosAvailableToClient: videos.length },
    delivery: { canSendImagesToClient: false, canSendVideosToClient: false }
  };
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

function isInFolder(file, folderId) {
  const parents = file.getParents();
  while (parents.hasNext()) if (parents.next().getId() === folderId) return true;
  return false;
}

function safeName(name) {
  return String(name || "upload").replace(/[\\\\/:*?\"<>|]/g, "_").slice(0, 180);
}
function ensureTxt(name) {
  name = safeName(name);
  return /\.txt$/i.test(name) ? name : name + ".txt";
}
