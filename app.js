const CONFIG = window.IMAGEKIT_CONFIG || {};
const GALLERY_PASSWORD = "System.activ";
let galleryToken = "";
let galleryImages = [];

const $ = id => document.getElementById(id);

function show(screen) {
  $("loginScreen").classList.toggle("hidden", screen !== "loginScreen");
  $("galleryScreen").classList.toggle("hidden", screen !== "galleryScreen");
}
function message(id, text, type = "") {
  const el = $(id);
  el.textContent = text;
  el.className = "status" + (type ? " " + type : "");
}
function configReady() {
  if (!CONFIG.appScriptUrl || !CONFIG.appScriptUrl.startsWith("https://script.google.com/")) {
    throw new Error("Add your Google Apps Script Web App URL to imagekit-config.js.");
  }
}
function jsonp(action, params = {}) {
  configReady();
  return new Promise((resolve, reject) => {
    const callback = "__gallery_" + Date.now().toString(36) + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const query = new URLSearchParams({ action, callback, _: String(Date.now()) });
    Object.entries(params).forEach(([key, value]) => query.set(key, String(value)));
    const base = CONFIG.appScriptUrl.replace(/\/$/, "");
    const cleanup = () => { delete window[callback]; script.remove(); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error("The gallery server did not respond. Check the Apps Script deployment.")); }, 25000);
    window[callback] = data => {
      clearTimeout(timeout); cleanup();
      if (!data || !data.ok) reject(new Error(data && data.error ? data.error : "Server request failed."));
      else resolve(data);
    };
    script.onerror = () => { clearTimeout(timeout); cleanup(); reject(new Error("Could not contact Google Apps Script.")); };
    script.src = base + (base.includes("?") ? "&" : "?") + query.toString();
    document.head.appendChild(script);
  });
}
function renderGallery() {
  $("imageCount").textContent = galleryImages.length + " image" + (galleryImages.length === 1 ? "" : "s");
  $("gallery").replaceChildren();
  $("galleryEmpty").classList.toggle("hidden", galleryImages.length !== 0);
  for (const item of galleryImages) {
    const tile = document.createElement("article");
    tile.className = "tile";
    const link = document.createElement("a");
    link.href = item.viewUrl || item.imageUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const img = document.createElement("img");
    img.src = item.thumbnailUrl || item.imageUrl;
    img.alt = item.name || "Gallery image";
    img.loading = "lazy";
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = item.name || "Image";
    meta.append(name);
    link.append(img, meta);
    tile.append(link);
    $("gallery").append(tile);
    img.addEventListener("error", () => { img.alt = "Image preview unavailable. Open the image to view it."; });
  }
}
async function loadImages() {
  message("galleryStatus", "Loading images…");
  try {
    const data = await jsonp("listDriveImages", { token: galleryToken });
    galleryImages = data.images || [];
    renderGallery();
    message("galleryStatus", "");
  } catch (error) {
    message("galleryStatus", error.message, "error");
    if (/session|password|expired/i.test(error.message)) lockGallery();
  }
}
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("loginBtn");
  button.disabled = true;
  message("loginStatus", "Checking password…");
  try {
    if ($("galleryPassword").value !== GALLERY_PASSWORD) throw new Error("Incorrect password.");
    const data = await jsonp("galleryLogin", { password: GALLERY_PASSWORD });
    galleryToken = data.token;
    $("galleryPassword").value = "";
    show("galleryScreen");
    await loadImages();
  } catch (error) {
    message("loginStatus", error.message, "error");
  } finally {
    button.disabled = false;
  }
});
function lockGallery() {
  galleryToken = "";
  galleryImages = [];
  $("gallery").replaceChildren();
  $("galleryPassword").value = "";
  message("loginStatus", "");
  show("loginScreen");
}
$("refreshBtn").addEventListener("click", loadImages);
$("lockBtn").addEventListener("click", lockGallery);
