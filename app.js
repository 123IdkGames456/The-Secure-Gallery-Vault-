const API_URL = "https://script.google.com/macros/s/AKfycbxL8enxViK6dad3UCrFvzRVoHFd-5sBFuQ19SdIgFUvXs9iyvPekQqkfHEPPSZYNUcawA/exec";
const PICRD_UPLOAD_URL = "https://picrd.com/api/upload";
const MAX_UPLOAD_SIZE = 9.5 * 1024 * 1024;
const MAX_SOURCE_SIZE = 50 * 1024 * 1024;
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
function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)).toFixed(2) + " MB" : (bytes / 1024).toFixed(0) + " KB";
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

// Shrink oversized still images in the browser before sending them to Picrd.
// Images already below the safe upload limit are kept unchanged.
async function prepareImageForUpload(file) {
  if (file.size <= MAX_UPLOAD_SIZE) return file;
  if (file.type === "image/gif") {
    throw new Error("This GIF is over the size limit. Animated GIF resizing is not supported yet, so its animation will not be changed.");
  }
  if (!("createImageBitmap" in window)) {
    throw new Error("This browser cannot resize the image automatically. Try a smaller image.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("The image could not be opened for resizing.");
  }

  try {
    let width = bitmap.width;
    let height = bitmap.height;
    const outputType = file.type === "image/png" ? "image/webp" : file.type;
    let quality = outputType === "image/png" ? undefined : 0.88;
    let lastBlob = null;

    for (let attempt = 0; attempt < 14; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not create an image resize canvas.");
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);

      const blob = await new Promise(resolve => canvas.toBlob(resolve,outputType,quality));
      canvas.width = 1;
      canvas.height = 1;
      if (!blob) throw new Error("The browser could not compress this image.");
      lastBlob = blob;
      if (blob.size <= MAX_UPLOAD_SIZE) {
        const extension = outputType === "image/webp" ? "webp" : outputType === "image/jpeg" ? "jpg" : "png";
        const baseName = file.name.replace(/\.[^.]+$/,"");
        return new File([blob],baseName+"."+extension,{type:outputType,lastModified:Date.now()});
      }

      // Reduce pixel dimensions each pass; lower quality as a secondary size control.
      width *= 0.82;
      height *= 0.82;
      if (quality !== undefined) quality = Math.max(0.48,quality - 0.06);
    }

    if (lastBlob && lastBlob.size <= MAX_UPLOAD_SIZE) {
      return new File([lastBlob],file.name,{type:outputType,lastModified:Date.now()});
    }
    throw new Error("Could not reduce this image below 9.5 MB. Try a smaller source image.");
  } finally {
    bitmap.close();
  }
}

async function uploadOne(originalFile) {
  const file = await prepareImageForUpload(originalFile);
  const form = new FormData();
  form.append("file",file,file.name);
  form.append("visibility","unlisted");
  // ttl_seconds is intentionally omitted: Picrd documents this as no automatic expiry.
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
    name:originalFile.name,
    mimeType:file.type
  });

  return {originalSize:originalFile.size,uploadedSize:file.size,wasResized:file.size !== originalFile.size};
}

$("fileInput").addEventListener("change",async e => {
  const selected = Array.from(e.target.files || []);
  e.target.value = "";
  if (!selected.length) return;

  const valid = [];
  const errors = [];
  for (const file of selected) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) errors.push(file.name + ": use PNG, JPG, WebP or GIF");
    else if (file.size > MAX_SOURCE_SIZE) errors.push(file.name + ": original file is over 50 MB");
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
  let resized = 0;
  message("galleryStatus","Preparing and uploading 0 of " + valid.length + " images…");

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= valid.length) return;
      const file = valid[index];
      try {
        const result = await uploadOne(file);
        saved++;
        if (result.wasResized) resized++;
      } catch (err) {
        errors.push(file.name + ": " + err.message);
      }
      completed++;
      message("galleryStatus","Uploading " + completed + " of " + valid.length + "… (" + saved + " saved, " + resized + " resized)");
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
  const summary = saved + " of " + valid.length + " images saved. " + resized + " resized to fit.";
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
