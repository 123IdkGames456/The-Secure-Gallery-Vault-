const API="https://script.google.com/macros/s/AKfycby2U4rxm0a75fq-jZan2ar61JfqZWxC7yhj5EJT-sPA9ZyD-MkEKdMqdB4A8WVJTzB4/exec";
const $=id=>document.getElementById(id);
let images=[],videos=[],texts=[],uploadTimer=null,uploadBusy=false;
function showUploadProgress(title,message,percent,indeterminate=false){
 const panel=$("uploadProgress");if(!panel)return;
 panel.classList.remove("hidden-section");$("uploadTitle").textContent=title;$("uploadMessage").textContent=message;
 $("uploadPercent").textContent=indeterminate?"Sending…":Math.round(percent)+"%";
 $("uploadBar").style.width=indeterminate?"38%":Math.max(0,Math.min(100,percent))+"%";
 $("uploadBar").classList.toggle("indeterminate",indeterminate);
 $("uploadBar").classList.remove("upload-error");
}
function hideUploadProgress(){if(uploadTimer)clearTimeout(uploadTimer);uploadTimer=null;const panel=$("uploadProgress");if(panel)panel.classList.add("hidden-section");uploadBusy=false}
function sendWrite(fields,fileInfo){
 const isUpload=fields.action==="uploadImage"||fields.action==="uploadVideo";
 if(uploadBusy){alert("A file is already being sent. Wait until it finishes.");return}
 if(isUpload)uploadBusy=true;
 const folder=fields.action==="uploadImage"?"Images":fields.action==="uploadVideo"?"Videos":"";
 if(isUpload)showUploadProgress("Sending to Google Drive", "Sending "+(fileInfo?.name||"file")+" ("+(fileInfo?.sizeMB||"")+") to the "+folder+" folder. The bar animates while Drive processes it.",30,true);
 const frame=document.createElement("iframe");frame.name="writeFrame"+Date.now();frame.style.display="none";document.body.append(frame);
 const form=document.createElement("form");form.method="POST";form.action=API;form.target=frame.name;form.style.display="none";
 Object.entries(fields).forEach(([k,v])=>{const input=document.createElement("input");input.type="hidden";input.name=k;input.value=v;form.append(input)});
 document.body.append(form);form.submit();form.remove();
 if(uploadTimer)clearTimeout(uploadTimer);
 uploadTimer=setTimeout(()=>{if(isUpload){showUploadProgress("Upload not confirmed","Google Drive has not confirmed the upload after 3 minutes. Check the Drive folder before trying again.",0,false);$("uploadBar").classList.add("upload-error");uploadBusy=false}frame.remove()},180000);
 setTimeout(()=>frame.remove(),185000);
}
window.addEventListener("message",e=>{
 if(!e.data||e.data.type!=="galleryWriteResult")return;
 if(uploadTimer)clearTimeout(uploadTimer);uploadTimer=null;
 const result=e.data.result||{};
 if(result.ok){
  if(uploadBusy){showUploadProgress("Upload complete","Saved to the "+(result.action==="uploadVideo"?"Videos":"Images")+" folder in Google Drive: "+(result.name||"Done"),100,false);setTimeout(hideUploadProgress,5000)}
  else alert("Saved: "+(result.name||"Done"));
  galleryLoaded=false;$("deliverySummary").textContent="Refreshing gallery…";
  loadGalleryData(()=>{initImages();initVideos();initTexts();galleryLoaded=true;setTab(activeTab)});
 }else{
  if(uploadBusy){showUploadProgress("Upload failed",result.error||"Google Drive could not save the file.",0,false);$("uploadBar").classList.add("upload-error");setTimeout(hideUploadProgress,8000)}
  else alert(result.error||"Could not save.");
 }
});
function loadGalleryData(done){const old=document.getElementById("galleryApi");if(old)old.remove();const script=document.createElement("script");script.id="galleryApi";script.src=API+"?callback=galleryCallback&t="+Date.now();script.onerror=()=>{const s=$("status")||$("videoStatus")||$("textStatus");if(s)s.textContent="Could not connect to Google Drive. Check that Apps Script is deployed as a Web app.";};window.galleryCallback=data=>{script.remove();if(!data||!data.ok){const s=$("status")||$("videoStatus")||$("textStatus");if(s)s.textContent=data?.error||"Could not load files.";return}images=Array.isArray(data.images)?data.images:[];videos=Array.isArray(data.videos)?data.videos:[];texts=Array.isArray(data.texts)?data.texts:[];done(data)};document.head.append(script)}
function setupCommon(){}