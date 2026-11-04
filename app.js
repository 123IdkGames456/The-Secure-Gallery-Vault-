// Paste the deployed Google Apps Script Web App URL here.
const API_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
const $ = id => document.getElementById(id);
let masterPassword = "";
let roomCode = "";
let images = [];

function show(screen) {
  ["masterScreen","roomScreen","galleryScreen"].forEach(id => $(id).classList.toggle("hidden", id !== screen));
  $("logoutBtn").classList.toggle("hidden", screen === "masterScreen");
}
function message(id, text, type="") {
  const el=$(id); el.textContent=text; el.className="status"+(type?" "+type:"");
}
async function api(action, extra={}) {
  if (!API_URL.startsWith("https://script.google.com/")) throw new Error("Add your deployed Google Apps Script URL to app.js first.");
  const response=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,masterPassword,roomCode,...extra})});
  if(!response.ok) throw new Error("The storage service returned HTTP "+response.status);
  const data=await response.json();
  if(!data.ok) throw new Error(data.error||"Request failed.");
  return data;
}
$("masterForm").addEventListener("submit",async e=>{
  e.preventDefault(); masterPassword=$("masterPassword").value;
  message("masterStatus","Checking access…");
  try{await api("checkMaster");show("roomScreen");$("roomCode").focus();message("masterStatus","");}
  catch(err){masterPassword="";$("masterPassword").value="";message("masterStatus",err.message,"error");}
});
$("roomForm").addEventListener("submit",async e=>{
  e.preventDefault();roomCode=$("roomCode").value.trim();
  message("roomStatus","Unlocking room…");
  try{await api("listImages");$("roomTitle").textContent="Room · "+roomCode;show("galleryScreen");await refreshGallery();}
  catch(err){roomCode="";message("roomStatus",err.message,"error");}
});
async function refreshGallery(){
  message("galleryStatus","Loading images…");
  try{
    const data=await api("listImages");images=data.images||[];
    $("imageCount").textContent=images.length+" image"+(images.length===1?"":"s");
    $("gallery").replaceChildren();$("galleryEmpty").classList.toggle("hidden",images.length!==0);
    for(const item of images){
      const tile=document.createElement("article");tile.className="tile";
      const img=document.createElement("img");img.alt=item.name;img.loading="lazy";
      try{const full=await api("getImage",{imageId:item.id});img.src="data:"+full.mimeType+";base64,"+full.base64;}
      catch(e){img.alt="Could not load "+item.name;img.style.height="100px";}
      const meta=document.createElement("div");meta.className="meta";
      const name=document.createElement("span");name.className="name";name.textContent=item.name;
      meta.append(name);tile.append(img,meta);$("gallery").append(tile);
    }
    message("galleryStatus","");
  }catch(err){message("galleryStatus",err.message,"error");}
}
$("fileInput").addEventListener("change",async e=>{
  const files=Array.from(e.target.files||[]);e.target.value="";
  for(const file of files){
    if(!file.type.startsWith("image/"))continue;
    if(file.size>8*1024*1024){message("galleryStatus",file.name+" is over the 8 MB upload limit.","error");continue;}
    message("galleryStatus","Uploading "+file.name+"…");
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("Could not read image."));reader.readAsDataURL(file);});
      const base64=String(dataUrl).split(",")[1];
      await api("uploadImage",{name:file.name,mimeType:file.type,base64});
      message("galleryStatus",file.name+" uploaded.","good");
    }catch(err){message("galleryStatus",err.message,"error");}
  }
  await refreshGallery();
});
$("backBtn").addEventListener("click",()=>{roomCode="";$("roomCode").value="";show("roomScreen");});
$("logoutBtn").addEventListener("click",()=>{masterPassword="";roomCode="";images=[];$("masterPassword").value="";$("roomCode").value="";show("masterScreen");});
