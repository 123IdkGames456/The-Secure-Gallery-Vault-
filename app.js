const GOOGLE_SCRIPT_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const CHUNK_SIZE = 40000;
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
function apiReady() {
  if (!GOOGLE_SCRIPT_URL.startsWith("https://script.google.com/macros/s/") || !GOOGLE_SCRIPT_URL.endsWith("/exec")) {
    throw new Error("Google Apps Script is not connected yet. Add your deployed /exec URL to app.js.");
  }
}
async function api(action, payload={}) {
  apiReady();
  let response;
  try {
    response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload })
    });
  } catch (err) {
    throw new Error("Could not reach Google Apps Script. Check its deployment access and web app URL. (" + (err.message || "network error") + ")");
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Google Apps Script returned an unreadable response. Check that the /exec deployment is active."); }
  if (!data.ok) throw new Error(data.error || "Google Apps Script request failed.");
  return data;
}
function makeId() {
  return (crypto.randomUUID ? crypto.randomUUID().replace(/-/g,"") : Date.now().toString(36)+Math.random().toString(36).slice(2)).slice(0,32);
}
async function loadRoom(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{5,32}$/.test(normalized)) throw new Error("Enter a room code with 5–32 letters, numbers, _ or -.");
  const data = await api("listImages", { roomCode: normalized });
  roomCode = normalized;
  currentImages = data.images || [];
  $("roomTitle").textContent = "Room · " + normalized;
  show("galleryScreen");
  await renderGallery();
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
    const data=await api("createRoom");
    $("roomCode").value=data.roomCode;
    await loadRoom(data.roomCode);
    message("galleryStatus","New room created. Save this room code: "+data.roomCode,"good");
  } catch(err) { message("roomStatus",err.message,"error"); }
  finally { button.disabled=false; }
});
async function renderGallery() {
  $("imageCount").textContent=currentImages.length+" image"+(currentImages.length===1?"":"s");
  $("gallery").replaceChildren();
  $("galleryEmpty").classList.toggle("hidden",currentImages.length!==0);
  for (const item of currentImages) {
    const tile=document.createElement("article");
    tile.className="tile";
    const img=document.createElement("img");
    img.alt=item.fileName||"Uploaded image";
    img.loading="lazy";
    img.src="";
    const meta=document.createElement("div");
    meta.className="meta";
    const name=document.createElement("span");
    name.className="name";
    name.textContent=item.fileName||"Image";
    meta.append(name);
    tile.append(img,meta);
    $("gallery").append(tile);
    try {
      const data=await api("getImage",{roomCode,imageId:item.imageId});
      img.src="data:"+data.mimeType+";base64,"+data.base64;
    } catch(err) { img.alt="Could not load image: "+err.message; }
  }
}
async function refreshGallery() {
  message("galleryStatus","Refreshing room…");
  try {
    const data=await api("listImages",{roomCode});
    currentImages=data.images||[];
    await renderGallery();
    message("galleryStatus","");
  } catch(err) { message("galleryStatus",err.message,"error"); }
}
async function prepareImage(file) {
  if(file.size<=MAX_IMAGE_BYTES)return file;
  if(file.type==="image/gif")throw new Error("GIF is larger than 4 MB. Animated GIF compression is not supported.");
  if(!("createImageBitmap" in window))throw new Error("This browser cannot resize images.");
  const bitmap=await createImageBitmap(file);
  try {
    let width=bitmap.width,height=bitmap.height,quality=.82;
    for(let attempt=0;attempt<18;attempt++){
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));
      const context=canvas.getContext("2d");
      if(!context)throw new Error("Could not create image resize canvas.");
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));
      canvas.width=1;canvas.height=1;
      if(!blob)throw new Error("Could not compress image.");
      if(blob.size<=MAX_IMAGE_BYTES)return new File([blob],file.name.replace(/\.[^.]+$/,"")+".webp",{type:"image/webp",lastModified:Date.now()});
      width*=.82;height*=.82;quality=Math.max(.45,quality-.04);
    }
    throw new Error("Could not reduce image below 4 MB.");
  } finally { bitmap.close(); }
}
function fileToBase64(file) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");
    reader.onerror=()=>reject(new Error("Could not read selected image."));
    reader.readAsDataURL(file);
  });
}
async function uploadOne(originalFile) {
  const file=await prepareImage(originalFile);
  const base64=await fileToBase64(file);
  const totalChunks=Math.ceil(base64.length/CHUNK_SIZE);
  const imageId=makeId();
  for(let chunkIndex=0;chunkIndex<totalChunks;chunkIndex++){
    const data=base64.slice(chunkIndex*CHUNK_SIZE,(chunkIndex+1)*CHUNK_SIZE);
    await api("uploadChunk",{
      roomCode,imageId,chunkIndex,totalChunks,
      fileName:file.name,mimeType:file.type,data
    });
    message("galleryStatus","Uploading "+originalFile.name+" · part "+(chunkIndex+1)+" of "+totalChunks+"…");
  }
  return {resized:file.size!==originalFile.size};
}
$("fileInput").addEventListener("change",async e=>{
  const selected=Array.from(e.target.files||[]);
  e.target.value="";
  if(!selected.length)return;
  const valid=[],errors=[];
  for(const file of selected){
    if(!ALLOWED_IMAGE_TYPES.includes(file.type))errors.push(file.name+": use PNG, JPG, WebP or GIF");
    else if(file.size>20*1024*1024)errors.push(file.name+": original file is over 20 MB");
    else valid.push(file);
  }
  if(!valid.length){message("galleryStatus",errors.join(" · ")||"No supported images selected.","error");return;}
  const uploadButton=document.querySelector('label[for="fileInput"]');
  uploadButton.style.pointerEvents="none";uploadButton.style.opacity=".55";$("fileInput").disabled=true;
  let saved=0,resized=0;
  try{
    for(let i=0;i<valid.length;i++){
      try{const result=await uploadOne(valid[i]);saved++;if(result.resized)resized++;}
      catch(err){errors.push(valid[i].name+": "+err.message);}
      message("galleryStatus","Uploading "+(i+1)+" of "+valid.length+"… ("+saved+" saved)");
    }
  }finally{$("fileInput").disabled=false;uploadButton.style.pointerEvents="";uploadButton.style.opacity="";}
  await refreshGallery();
  const summary=saved+" of "+valid.length+" images saved. "+resized+" resized.";
  message("galleryStatus",errors.length?summary+" Problems: "+errors.join(" · "):summary,saved===valid.length?"good":"error");
});
$("backBtn").addEventListener("click",()=>{
  roomCode="";$("roomCode").value="";show("roomScreen");
});
