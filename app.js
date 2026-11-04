const WORKER_URL = "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE";
const ALLOWED_IMAGE_TYPES = ["image/png","image/jpeg","image/webp","image/gif"];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

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
function apiReady() {
  if (!WORKER_URL.startsWith("https://") || WORKER_URL.includes("PASTE_YOUR_")) {
    throw new Error("Cloudflare Worker is not connected yet. Add your Worker URL to app.js.");
  }
}
async function api(path, options={}) {
  apiReady();
  let response;
  try {
    response = await fetch(WORKER_URL.replace(/\/$/, "") + path, options);
  } catch (err) {
    throw new Error("Could not reach the image server. Check the Worker URL and CORS settings. (" + (err.message || "network error") + ")");
  }
  let data;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    throw new Error("The image server returned an unexpected response.");
  }
  if (!response.ok || !data.ok) throw new Error(data.error || "Image server request failed.");
  return data;
}
function makeId() {
  return (crypto.randomUUID ? crypto.randomUUID().replace(/-/g,"") : Date.now().toString(36)+Math.random().toString(36).slice(2)).slice(0,32);
}
async function loadRoom(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{5,32}$/.test(normalized)) throw new Error("Enter a room code with 5–32 letters, numbers, _ or -.");
  const data = await api("/api/rooms/" + encodeURIComponent(normalized) + "/images");
  roomCode = normalized;
  currentImages = data.images || [];
  $("roomTitle").textContent = "Room · " + normalized;
  show("galleryScreen");
  renderGallery();
}
async function openEnteredRoom() {
  message("roomStatus","Opening room…");
  try {
    await loadRoom($("roomCode").value);
    message("roomStatus","");
  } catch(err) { message("roomStatus",err.message,"error"); }
}
$("roomForm").addEventListener("submit",e=>{
  e.preventDefault();
  e.stopPropagation();
  openEnteredRoom();
});
$("createRoomBtn").addEventListener("click",async()=>{
  const button=$("createRoomBtn");
  button.disabled=true;
  message("roomStatus","Creating room…");
  try {
    const data=await api("/api/rooms",{method:"POST"});
    $("roomCode").value=data.roomCode;
    await loadRoom(data.roomCode);
    message("galleryStatus","New room created. Save this room code: "+data.roomCode,"good");
  } catch(err) { message("roomStatus",err.message,"error"); }
  finally { button.disabled=false; }
});
function renderGallery() {
  $("imageCount").textContent=currentImages.length+" image"+(currentImages.length===1?"":"s");
  $("gallery").replaceChildren();
  $("galleryEmpty").classList.toggle("hidden",currentImages.length!==0);
  for (const item of currentImages) {
    const tile=document.createElement("article");
    tile.className="tile";
    const img=document.createElement("img");
    img.alt=item.fileName||"Uploaded image";
    img.loading="lazy";
    img.src=WORKER_URL.replace(/\/$/,"") + "/api/rooms/" + encodeURIComponent(roomCode) + "/images/" + encodeURIComponent(item.imageId) + "?variant=thumb";
    const meta=document.createElement("div");
    meta.className="meta";
    const name=document.createElement("span");
    name.className="name";
    name.textContent=item.fileName||"Image";
    const open=document.createElement("a");
    open.href=WORKER_URL.replace(/\/$/,"") + "/api/rooms/" + encodeURIComponent(roomCode) + "/images/" + encodeURIComponent(item.imageId);
    open.target="_blank";
    open.rel="noopener";
    open.textContent="Open";
    open.style.color="var(--accent)";
    open.style.fontSize="13px";
    meta.append(name,open);
    tile.append(img,meta);
    $("gallery").append(tile);
    img.addEventListener("error",()=>{img.alt="Could not load image";});
  }
}
async function refreshGallery() {
  message("galleryStatus","Refreshing room…");
  try {
    const data=await api("/api/rooms/" + encodeURIComponent(roomCode) + "/images");
    currentImages=data.images||[];
    renderGallery();
    message("galleryStatus","");
  } catch(err) { message("galleryStatus",err.message,"error"); }
}
async function makeThumbnail(file) {
  if(!("createImageBitmap" in window)) return null;
  let bitmap;
  try {
    bitmap=await createImageBitmap(file);
    const scale=Math.min(1,320/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext("2d");
    if(!context) return null;
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.55));
  } catch(e) {
    return null;
  } finally {
    if(bitmap) bitmap.close();
  }
}
async function uploadOne(file) {
  if(file.size>MAX_IMAGE_BYTES) throw new Error("File is over the 15 MB limit.");
  const imageId=makeId();
  const form=new FormData();
  form.append("image",file,file.name);
  const thumbnail=await makeThumbnail(file);
  if(thumbnail) form.append("thumbnail",thumbnail,"thumbnail.jpg");
  form.append("imageId",imageId);
  form.append("fileName",file.name);
  const data=await api("/api/rooms/" + encodeURIComponent(roomCode) + "/images",{
    method:"POST",
    body:form
  });
  return data;
}
$("fileInput").addEventListener("change",async e=>{
  const selected=Array.from(e.target.files||[]);
  e.target.value="";
  if(!selected.length)return;
  const valid=[],errors=[];
  for(const file of selected){
    if(!ALLOWED_IMAGE_TYPES.includes(file.type))errors.push(file.name+": use PNG, JPG, WebP or GIF");
    else if(file.size>MAX_IMAGE_BYTES)errors.push(file.name+": file is over 15 MB");
    else valid.push(file);
  }
  if(!valid.length){message("galleryStatus",errors.join(" · ")||"No supported images selected.","error");return;}
  const uploadButton=document.querySelector('label[for="fileInput"]');
  uploadButton.style.pointerEvents="none";uploadButton.style.opacity=".55";$("fileInput").disabled=true;
  let saved=0;
  try{
    for(let i=0;i<valid.length;i++){
      try{
        await uploadOne(valid[i]);
        saved++;
      } catch(err) {
        errors.push(valid[i].name+": "+err.message);
      }
      message("galleryStatus","Uploading "+(i+1)+" of "+valid.length+"… ("+saved+" saved)");
    }
  }finally{$("fileInput").disabled=false;uploadButton.style.pointerEvents="";uploadButton.style.opacity="";}
  await refreshGallery();
  const summary=saved+" of "+valid.length+" images saved.";
  message("galleryStatus",errors.length?summary+" Problems: "+errors.join(" · "):summary,saved===valid.length?"good":"error");
});
$("backBtn").addEventListener("click",()=>{
  roomCode="";$("roomCode").value="";show("roomScreen");
});
