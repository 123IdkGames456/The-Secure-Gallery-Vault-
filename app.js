const API_URL = "https://script.google.com/macros/s/AKfycbxL8enxViK6dad3UCrFvzRVoHFd-5sBFuQ19SdIgFUvXs9iyvPekQqkfHEPPSZYNUcawA/exec";
const PICRD_UPLOAD_URL = "https://picrd.com/api/upload";
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png","image/jpeg","image/webp","image/gif"];

const $ = id => document.getElementById(id);
let masterPassword = "";
let roomCode = "";

function show(screen) {
  ["masterScreen","roomScreen","galleryScreen"].forEach(id => $(id).classList.toggle("hidden", id !== screen));
  $("logoutBtn").classList.toggle("hidden", screen === "masterScreen");
}
function message(id, text, type="") {
  const el = $(id);
  el.textContent = text;
  el.className = "status" + (type ? " " + type : "");
}
async function api(action, extra={}) {
  if (!API_URL.startsWith("https://script.google.com/")) throw new Error("The Google Apps Script URL is missing.");
  const response = await fetch(API_URL, {
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({action,masterPassword,roomCode,...extra})
  });
  if (!response.ok) throw new Error("The room database returned HTTP " + response.status);
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Request failed.");
  return data;
}

$("masterForm").addEventListener("submit", async e => {
  e.preventDefault();
  masterPassword = $("masterPassword").value;
  message("masterStatus","Checking access…");
  try {
    await api("checkMaster");
    show("roomScreen");
    $("roomCode").focus();
    message("masterStatus","");
  } catch (err) {
    masterPassword = "";
    $("masterPassword").value = "";
    message("masterStatus",err.message,"error");
  }
});

$("roomForm").addEventListener("submit", async e => {
  e.preventDefault();
  roomCode = $("roomCode").value.trim();
  message("roomStatus","Unlocking room…");
  try {
    await api("listImages");
    $("roomTitle").textContent = "Room · " + roomCode;
    show("galleryScreen");
    await refreshGallery();
  } catch (err) {
    roomCode = "";
    message("roomStatus",err.message,"error");
  }
});

async function refreshGallery() {
  message("galleryStatus","Loading images…");
  try {
    const data = await api("listImages");
    const images = data.images || [];
    $("imageCount").textContent = images.length + " image" + (images.length === 1 ? "" : "s");
    $("gallery").replaceChildren();
    $("galleryEmpty").classList.toggle("hidden", images.length !== 0);

    for (const item of images) {
      const tile = document.createElement("article");
      tile.className = "tile";
      const img = document.createElement("img");
      img.alt = item.name || "Uploaded image";
      img.loading = "lazy";
      img.src = item.imageUrl;
      img.onerror = () => {
        img.alt = "Image could not be loaded";
        img.style.height = "100px";
      };
      const meta = document.createElement("div");
      meta.className = "meta";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = item.name || "Image";
      meta.append(name);
      tile.append(img,meta);
      $("gallery").append(tile);
    }
    message("galleryStatus","");
  } catch (err) {
    message("galleryStatus",err.message,"error");
  }
}

async function uploadOne(file) {
  const form = new FormData();
  form.append("file",file,file.name);
  form.append("visibility","unlisted");
  // No ttl_seconds is sent, so Picrd does not set an automatic expiry.
  const response = await fetch(PICRD_UPLOAD_URL,{method:"POST",body:form});
  let uploaded;
  try {
    uploaded = await response.json();
  } catch {
    throw new Error("Picrd returned an unreadable response.");
  }
  if (!response.ok || !uploaded.image_id || !uploaded.image_url || !uploaded.delete_url) {
    throw new Error(uploaded.error || "Picrd upload failed (HTTP " + response.status + ").");
  }

  await api("registerImage",{
    imageId:uploaded.image_id,
    imageUrl:uploaded.image_url,
    deleteUrl:uploaded.delete_url,
    name:file.name,
    mimeType:file.type
  });
}

$("fileInput").addEventListener("change",async e => {
  const selected = Array.from(e.target.files || []);
  e.target.value = "";
  if (!selected.length) return;

  const valid = [];
  const errors = [];
  for (const file of selected) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) errors.push(file.name + ": use PNG, JPG, WebP or GIF");
    else if (file.size > MAX_IMAGE_SIZE) errors.push(file.name + ": larger than 8 MB");
    else valid.push(file);
  }
  if (!valid.length) {
    message("galleryStatus",errors.join(" · ") || "No supported images selected.","error");
    return;
  }

  const uploadButton = document.querySelector('label[for="fileInput"]');
  uploadButton.style.pointerEvents = "none";
  uploadButton.style.opacity = ".55";
  $("fileInput").disabled = true;
  let completed = 0;
  let nextIndex = 0;
  let saved = 0;
  message("galleryStatus","Uploading 0 of " + valid.length + " images to Picrd…");

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= valid.length) return;
      const file = valid[index];
      try {
        await uploadOne(file);
        saved++;
      } catch (err) {
        errors.push(file.name + ": " + err.message);
      }
      completed++;
      message("galleryStatus","Uploading " + completed + " of " + valid.length + " images… (" + saved + " saved)");
    }
  }

  try {
    await Promise.all(Array.from({length:Math.min(2,valid.length)},() => worker()));
  } finally {
    $("fileInput").disabled = false;
    uploadButton.style.pointerEvents = "";
    uploadButton.style.opacity = "";
  }

  await refreshGallery();
  const summary = saved + " of " + valid.length + " images saved.";
  message("galleryStatus",errors.length ? summary + " Problems: " + errors.join(" · ") : summary,saved === valid.length ? "good" : "error");
});

$("backBtn").addEventListener("click",() => {
  roomCode = "";
  $("roomCode").value = "";
  show("roomScreen");
});
$("logoutBtn").addEventListener("click",() => {
  masterPassword = "";
  roomCode = "";
  $("masterPassword").value = "";
  $("roomCode").value = "";
  show("masterScreen");
});
