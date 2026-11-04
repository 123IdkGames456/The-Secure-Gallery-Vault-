const PICRD_API = "https://picrd.com/api";
const MAX_UPLOAD_SIZE = 9.5 * 1024 * 1024;
const MAX_SOURCE_SIZE = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png","image/jpeg","image/webp","image/gif"];

const $ = id => document.getElementById(id);
let roomCode = "";
let currentImages = [];

function show(screen) {
  ["roomScreen","galleryScreen"].forEach(id => $(id).classList.toggle("hidden", id !== screen));
}
function message(id, text, type="") {
  const el = $(id);
  el.textContent = text;
  el.className = "status" + (type ? " " + type : "");
}
function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)).toFixed(2) + " MB" : (bytes / 1024).toFixed(0) + " KB";
}
async function picrdRequest(url, options={}) {
  const response = await fetch(url,options);
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Picrd returned an unreadable response."); }
  if (!response.ok) throw new Error(data.error || "Picrd request failed (HTTP " + response.status + ").");
  return data;
}

async function loadRoom(albumId) {
  if (!/^[A-Za-z0-9_-]{5,80}$/.test(albumId)) throw new Error("That room code does not look valid.");
  const data = await picrdRequest(PICRD_API + "/album/" + encodeURIComponent(albumId));
  if (!Array.isArray(data.images)) throw new Error("Picrd did not return an album image list.");
  roomCode = albumId;
  currentImages = data.images;
  $("roomTitle").textContent = "Room · " + albumId;
  renderGallery();
  show("galleryScreen");
}

async function openEnteredRoom() {
  const albumId = $("roomCode").value.trim();
  message("roomStatus","Opening room…");
  try {
    await loadRoom(albumId);
    message("roomStatus","");
  } catch(err) {
    message("roomStatus",err.message,"error");
  }
}

$("openRoomBtn").addEventListener("click",openEnteredRoom);
$("roomForm").addEventListener("submit",e=>{
  e.preventDefault();
  openEnteredRoom();
});

$("createRoomBtn").addEventListener("click",async()=>{
  const button = $("createRoomBtn");
  button.disabled = true;
  message("roomStatus","Creating a Picrd album…");
  try {
    const data = await picrdRequest(PICRD_API + "/album",{method:"POST"});
    if (!data.album_id) throw new Error("Picrd did not return a room code.");
    $("roomCode").value = data.album_id;
    await loadRoom(data.album_id);
    message("galleryStatus","New room created. Save its room code: " + data.album_id,"good");
  } catch(err) {
    message("roomStatus",err.message,"error");
  } finally {
    button.disabled = false;
  }
});

function renderGallery() {
  $("imageCount").textContent = currentImages.length + " image" + (currentImages.length === 1 ? "" : "s");
  $("gallery").replaceChildren();
  $("galleryEmpty").classList.toggle("hidden",currentImages.length !== 0);
  for (const item of currentImages) {
    const tile = document.createElement("article");
    tile.className = "tile";
    const img = document.createElement("img");
    img.alt = item.image_id || "Uploaded image";
    img.loading = "lazy";
    img.src = item.image_url;
    img.onerror = () => { img.alt = "Image could not be loaded"; img.style.height = "100px"; };
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = item.image_id || "Image";
    meta.append(name);
    tile.append(img,meta);
    $("gallery").append(tile);
  }
}
async function refreshGallery() {
  message("galleryStatus","Refreshing room…");
  try {
    const data = await picrdRequest(PICRD_API + "/album/" + encodeURIComponent(roomCode));
    currentImages = data.images || [];
    renderGallery();
    message("galleryStatus","");
  } catch(err) {
    message("galleryStatus",err.message,"error");
  }
}

async function prepareImageForUpload(file) {
  if (file.size <= MAX_UPLOAD_SIZE) return file;
  if (file.type === "image/gif") throw new Error("This GIF is too large. Animated GIF resizing is not supported, so its animation will be preserved.");
  if (!("createImageBitmap" in window)) throw new Error("This browser cannot resize images automatically.");
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("The image could not be opened for resizing."); }
  try {
    let width = bitmap.width, height = bitmap.height;
    const outputType = file.type === "image/png" ? "image/webp" : file.type;
    let quality = outputType === "image/webp" || outputType === "image/jpeg" ? 0.88 : undefined;
    for (let attempt=0; attempt<16; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1,Math.round(width));
      canvas.height = Math.max(1,Math.round(height));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not create image resize canvas.");
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob = await new Promise(resolve=>canvas.toBlob(resolve,outputType,quality));
      canvas.width=1; canvas.height=1;
      if (!blob) throw new Error("The browser could not compress this image.");
      if (blob.size <= MAX_UPLOAD_SIZE) {
        const ext = outputType==="image/webp"?"webp":outputType==="image/jpeg"?"jpg":"png";
        return new File([blob],file.name.replace(/\.[^.]+$/,"")+"."+ext,{type:outputType,lastModified:Date.now()});
      }
      width *= 0.82; height *= 0.82;
      if (quality !== undefined) quality = Math.max(0.45,quality-0.06);
    }
    throw new Error("Could not reduce the image below 9.5 MB. Try a smaller image.");
  } finally { bitmap.close(); }
}

async function uploadOne(originalFile) {
  const file = await prepareImageForUpload(originalFile);
  const form = new FormData();
  form.append("file",file,file.name);
  form.append("visibility","unlisted");
  // ttl_seconds is intentionally omitted: Picrd documents no automatic expiry by default.
  form.append("album_id",roomCode);
  const uploaded = await picrdRequest(PICRD_API + "/upload",{method:"POST",body:form});
  if (!uploaded.image_id || !uploaded.image_url) throw new Error("Picrd did not return the uploaded image details.");
  return {resized:file.size!==originalFile.size,uploadedSize:file.size};
}

$("fileInput").addEventListener("change",async e=>{
  const selected=Array.from(e.target.files||[]);
  e.target.value="";
  if(!selected.length)return;
  const valid=[], errors=[];
  for(const file of selected){
    if(!ALLOWED_IMAGE_TYPES.includes(file.type)) errors.push(file.name+": use PNG, JPG, WebP or GIF");
    else if(file.size>MAX_SOURCE_SIZE) errors.push(file.name+": original file is over 50 MB");
    else valid.push(file);
  }
  if(!valid.length){message("galleryStatus",errors.join(" · ")||"No supported images selected.","error");return;}
  const uploadButton=document.querySelector('label[for="fileInput"]');
  uploadButton.style.pointerEvents="none";uploadButton.style.opacity=".55";$("fileInput").disabled=true;
  let completed=0,nextIndex=0,saved=0,resized=0;
  message("galleryStatus","Preparing and uploading 0 of "+valid.length+" images…");
  async function worker(){
    while(true){
      const index=nextIndex++;
      if(index>=valid.length)return;
      const file=valid[index];
      try{const result=await uploadOne(file);saved++;if(result.resized)resized++;}
      catch(err){errors.push(file.name+": "+err.message);}
      completed++;
      message("galleryStatus","Uploading "+completed+" of "+valid.length+"… ("+saved+" saved, "+resized+" resized)");
    }
  }
  try{await Promise.all(Array.from({length:Math.min(2,valid.length)},()=>worker()));}
  finally{$("fileInput").disabled=false;uploadButton.style.pointerEvents="";uploadButton.style.opacity="";}
  await refreshGallery();
  const summary=saved+" of "+valid.length+" images saved. "+resized+" resized to fit.";
  message("galleryStatus",errors.length?summary+" Problems: "+errors.join(" · "):summary,saved===valid.length?"good":"error");
});

$("backBtn").addEventListener("click",()=>{
  roomCode="";
  $("roomCode").value="";
  show("roomScreen");
});
