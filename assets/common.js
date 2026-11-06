const API="https://script.google.com/macros/s/AKfycby2U4rxm0a75fq-jZan2ar61JfqZWxC7yhj5EJT-sPA9ZyD-MkEKdMqdB4A8WVJTzB4/exec";
const $=id=>document.getElementById(id);
let images=[],videos=[],texts=[],uploadTimer=null;
function showUploadProgress(title,message,percent,indeterminate=false){
 const panel=$("uploadProgress");if(!panel)return;
 panel.classList.remove("hidden-section");$("uploadTitle").textContent=title;$("uploadMessage").textContent=message;
 $("uploadPercent").textContent=indeterminate?"":Math.round(percent)+"%";
 $("uploadBar").style.width=indeterminate?"35%":Math.max(0,Math.min(100,percent))+"%";
 $("uploadBar").classList.toggle("indeterminate",indeterminate);
}
function hideUploadProgress(){if(uploadTimer)clearTimeout(uploadTimer);uploadTimer=null;const panel=$("uploadProgress");if(panel)panel.classList.add("hidden-section");}
function sendWrite(fields){
 const isUpload=fields.action==="uploadImage"||fields.action==="uploadVideo";
 if(isUpload)showUploadProgress("Sending to Google Drive","Uploading file… Please keep this page open.",0,true);
 const frame=document.createElement("iframe");frame.name="writeFrame"+Date.now();frame.style.display="none";document.body.append(frame);
 const form=document.createElement("form");form.method="POST";form.action=API;form.target=frame.name;form.style.display="none";
 Object.entries(fields).forEach(([k,v])=>{const input=document.createElement("input");input.type="hidden";input.name=k;input.value=v;form.append(input)});
 document.body.append(form);form.submit();form.remove();
 if(uploadTimer)clearTimeout(uploadTimer);
 uploadTimer=setTimeout(()=>{if(isUpload){showUploadProgress("Upload taking too long","Google Drive has not confirmed the upload yet. Check your connection and try again.",0,true);$("uploadBar").classList.add("upload-error")}frame.remove()},120000);
 setTimeout(()=>frame.remove(),125000);
}
window.addEventListener("message",e=>{
 if(!e.data||e.data.type!=="galleryWriteResult")return;
 if(uploadTimer)clearTimeout(uploadTimer);uploadTimer=null;
 const result=e.data.result||{};
 if(result.ok){
  showUploadProgress("Upload complete","Saved to Google Drive: "+(result.name||"Done"),100,false);
  setTimeout(hideUploadProgress,3500);
  if(!["uploadImage","uploadVideo"].includes(result.action)){alert("Saved: "+(result.name||"Done"))}
  galleryLoaded=false;$("deliverySummary").textContent="Refreshing gallery…";
  loadGalleryData(()=>{initImages();initVideos();initTexts();galleryLoaded=true;setTab(activeTab)});
 }else{
  showUploadProgress("Upload failed",result.error||"Google Drive could not save the file.",0,false);
  $("uploadBar").classList.add("upload-error");
  setTimeout(hideUploadProgress,7000);
  alert(result.error||"Could not save.");
 }
});
function loadGalleryData(done){const old=document.getElementById("galleryApi");if(old)old.remove();const script=document.createElement("script");script.id="galleryApi";script.src=API+"?callback=galleryCallback&t="+Date.now();script.onerror=()=>{const s=$("status")||$("videoStatus")||$("textStatus");if(s)s.textContent="Could not connect to Google Drive. Check that Apps Script is deployed as a Web app.";};window.galleryCallback=data=>{script.remove();if(!data||!data.ok){const s=$("status")||$("videoStatus")||$("textStatus");if(s)s.textContent=data?.error||"Could not load files.";return}images=Array.isArray(data.images)?data.images:[];videos=Array.isArray(data.videos)?data.videos:[];texts=Array.isArray(data.texts)?data.texts:[];done(data)};document.head.append(script)}
function setupCommon(){}