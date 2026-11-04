const CONFIG = window.IMAGEKIT_CONFIG || {};
const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const $ = id => document.getElementById(id);
let roomCode = "";
let currentImages = [];

function show(screen) {
  ["roomScreen", "galleryScreen"].forEach(id => $(id).classList.toggle("hidden", id !== screen));
}

function message(id, text, type = "") {
  const el = $(id);
  el.textContent = text;
  el.className = "status" + (type ? " " + type : "");
}

function configReady() {
  if (!CONFIG.publicKey || !CONFIG.publicKey.startsWith("public_")) {
    throw new Error("ImageKit Public Key is missing from imagekit-config.js.");
  }
  if (!CONFIG.urlEndpoint || !CONFIG.urlEndpoint.startsWith("https://")) {
    throw new Error("ImageKit URL endpoint is missing from imagekit-config.js.");
  }
  if (!CONFIG.appScriptUrl || !CONFIG.appScriptUrl.startsWith("https://script.google.com/")) {
    throw new Error("Add your updated Google Apps Script Web App URL to imagekit-config.js.");
  }
}

function jsonp(action, params = {}) {
  configReady();
  return new Promise((resolve, reject) => {
    const callback = "__sgv_" + Date.now().toString(36) + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const query = new URLSearchParams({ action, callback, _: String(Date.now()) });
    Object.entries(params).forEach(([key, value]) => query.set(key, String(value)));
    const base = CONFIG.appScriptUrl.replace(/\/$/, "");
    const cleanup = () => {
      delete window[callback];
      script.remove();
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Google Apps Script did not respond. Check its deployment URL and access setting."));
    }, 25000);
    window[callback] = data => {
      clearTimeout(timeout);
      cleanup();
      if (!data || !data.ok) reject(new Error(data && data.error ? data.error : "Server request failed."));
      else resolve(data);
    };
    script.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Could not contact Google Apps Script."));
    };
    script.src = base + (base.includes("?") ? "&" : "?") + query.toString();
    document.head.appendChild(script);
  });
}

function makeId() {
  return (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 32);
}

async function loadRoom(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{5,32}$/.test(normalized)) {
    throw new Error("Enter a room code with 5–32 letters, numbers, _ or -.");
  }
  const data = await jsonp("listImages", { roomCode: normalized });
  roomCode = normalized;
  currentImages = data.images || [];
  $("roomTitle").textContent = "Room · " + normalized;
  show("galleryScreen");
  renderGallery();
}

async function openEnteredRoom() {
  message("roomStatus", "Opening room…");
  try {
    await loadRoom($("roomCode").value);
    message("roomStatus", "");
  } catch (error) {
    message("roomStatus", error.message, "error");
  }
}

$("roomForm").addEventListener("submit", event => {
  event.preventDefault();
  openEnteredRoom();
});

$("createRoomBtn").addEventListener("click", async () => {
  const button = $("createRoomBtn");
  button.disabled = true;
  message("roomStatus", "Creating room…");
  try {
    const data = await jsonp("createRoom");
    $("roomCode").value = data.roomCode;
    await loadRoom(data.roomCode);
    message("galleryStatus", "New room created. Save this room code: " + data.roomCode, "good");
  } catch (error) {
    message("roomStatus", error.message, "error");
  } finally {
    button.disabled = false;
  }
});

function thumbnailFor(item) {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (item.thumbnailBase64) return "data:image/jpeg;base64," + item.thumbnailBase64;
  if (item.url) return item.url + (item.url.includes("?") ? "&" : "?") + "tr=w-480,h-320,c-maintain_ratio";
  return "";
}

function renderGallery() {
  $("imageCount").textContent = currentImages.length + " image" + (currentImages.length === 1 ? "" : "s");
  $("gallery").replaceChildren();
  $("galleryEmpty").classList.toggle("hidden", currentImages.length !== 0);

  for (const item of currentImages) {
    const tile = document.createElement("article");
    tile.className = "tile";

    const img = document.createElement("img");
    img.alt = item.fileName || "Uploaded image";
    img.loading = "lazy";
    img.src = thumbnailFor(item);

    const meta = document.createElement("div");
    meta.className = "meta";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = item.fileName || "Image";

    const open = document.createElement("a");
    open.href = item.url || img.src;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "Open";
    open.style.color = "var(--accent)";
    open.style.fontSize = "13px";

    meta.append(name, open);

    if (item.fileId) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-image";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => deleteImage(item, remove));
      meta.append(remove);
    }

    tile.append(img, meta);
    $("gallery").append(tile);
    img.addEventListener("error", () => { img.alt = "Could not load image"; });
  }
}

async function refreshGallery(showMessage = true) {
  if (showMessage) message("galleryStatus", "Refreshing room…");
  try {
    const data = await jsonp("listImages", { roomCode });
    currentImages = data.images || [];
    renderGallery();
    if (showMessage) message("galleryStatus", "");
  } catch (error) {
    message("galleryStatus", error.message, "error");
  }
}

function getUploadAuth() {
  return jsonp("signUpload", { roomCode });
}

function uploadToImageKit(file, auth, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("fileName", file.name);
    form.append("publicKey", CONFIG.publicKey);
    form.append("token", auth.token);
    form.append("expire", String(auth.expire));
    form.append("signature", auth.signature);
    form.append("folder", "/gallery-vault/" + roomCode);
    form.append("useUniqueFileName", "true");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", IMAGEKIT_UPLOAD_URL);
    xhr.upload.addEventListener("progress", event => {
      if (event.lengthComputable && onProgress) onProgress(Math.round(event.loaded / event.total * 100));
    });
    xhr.onload = () => {
      let data;
      try { data = JSON.parse(xhr.responseText || "{}"); }
      catch (error) { reject(new Error("ImageKit returned an unreadable response.")); return; }
      if (xhr.status < 200 || xhr.status >= 300 || !data.fileId || !data.url) {
        reject(new Error(data.message || data help || "ImageKit upload failed."));
        return;
      }
      resolve(data);
    };
    xhr.onerror = () => reject(new Error("Network error while uploading to ImageKit."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(form);
  });
}

async function uploadOne(file, onProgress) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Use PNG, JPG, WebP or GIF.");
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) throw new Error("File must be between 1 byte and 15 MB.");

  const auth = await getUploadAuth();
  const uploaded = await uploadToImageKit(file, auth, onProgress);
  const imageId = makeId();
  const thumbnailUrl = uploaded.thumbnailUrl || uploaded.url;

  await jsonp("registerImage", {
    roomCode,
    imageId,
    fileId: uploaded.fileId,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    url: uploaded.url,
    thumbnailUrl
  });
  return uploaded;
}

$("fileInput").addEventListener("change", async event => {
  const selected = Array.from(event.target.files || []);
  event.target.value = "";
  if (!selected.length) return;

  const valid = [];
  const errors = [];
  for (const file of selected) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) errors.push(file.name + ": unsupported image type");
    else if (file.size > MAX_IMAGE_BYTES) errors.push(file.name + ": over 15 MB");
    else valid.push(file);
  }

  if (!valid.length) {
    message("galleryStatus", errors.join(" · ") || "No supported images selected.", "error");
    return;
  }

  const uploadButton = document.querySelector('label[for="fileInput"]');
  uploadButton.style.pointerEvents = "none";
  uploadButton.style.opacity = ".55";
  $("fileInput").disabled = true;

  let saved = 0;
  try {
    for (let index = 0; index < valid.length; index++) {
      const file = valid[index];
      try {
        await uploadOne(file, percent => {
          message("galleryStatus", "Uploading " + (index + 1) + " of " + valid.length + ": " + percent + "%");
        });
        saved++;
      } catch (error) {
        errors.push(file.name + ": " + error.message);
      }
    }
  } finally {
    $("fileInput").disabled = false;
    uploadButton.style.pointerEvents = "";
    uploadButton.style.opacity = "";
  }

  await refreshGallery(false);
  const summary = saved + " of " + valid.length + " images saved.";
  message("galleryStatus", errors.length ? summary + " Problems: " + errors.join(" · ") : summary, saved === valid.length ? "good" : "error");
});

async function deleteImage(item, button) {
  if (!confirm("Delete " + (item.fileName || "this image") + "?")) return;
  button.disabled = true;
  try {
    await jsonp("deleteImage", { roomCode, fileId: item.fileId });
    currentImages = currentImages.filter(image => image.fileId !== item.fileId);
    renderGallery();
    message("galleryStatus", "Image deleted.", "good");
  } catch (error) {
    message("galleryStatus", error.message, "error");
    button.disabled = false;
  }
}

$("refreshBtn").addEventListener("click", () => refreshGallery());
$("backBtn").addEventListener("click", () => {
  roomCode = "";
  $("roomCode").value = "";
  show("roomScreen");
});
