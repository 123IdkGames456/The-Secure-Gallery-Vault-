const HTML_LIBRARY_API = "https://script.google.com/macros/s/PASTE_YOUR_HTML_LIBRARY_WEB_APP_URL/exec";
let savedHTML = [];
let htmlLibraryRequest = 0;
let editingHTMLId = "";
let playingHTML = null;
function htmlApiReady(){return HTML_LIBRARY_API.includes("script.google.com")&&!HTML_LIBRARY_API.includes("PASTE_YOUR");}
function loadHTMLLibrary(){
 const status=$("htmlStatus"),grid=$("htmlGrid");
 if(!htmlApiReady()){status.textContent="Add your deployed Google Apps Script URL in assets/html-library.js to enable the HTML library.";grid.innerHTML="";return}
 status.textContent="Loading HTML files…";
 const old=document.getElementById("htmlLibraryApi");if(old)old.remove();
 const script=document.createElement("script"),callback="htmlLibraryCallback"+(++htmlLibraryRequest);
 window[callback]=data=>{delete window[callback];script.remove();if(!data||!data.ok){status.textContent=data?.error||"Could not load HTML files.";return}savedHTML=Array.isArray(data.html)?data.html:[];renderHTMLLibrary()};
 script.id="htmlLibraryApi";script.src=HTML_LIBRARY_API+"?action=html_list&callback="+callback+"&t="+Date.now();
 script.onerror=()=>{delete window[callback];script.remove();status.textContent="Could not connect to the HTML Library. Check the Apps Script Web app deployment."};
 document.head.append(script);
}
function renderHTMLLibrary(){
 const grid=$("htmlGrid");grid.innerHTML="";
 $("htmlStatus").textContent=savedHTML.length?savedHTML.length+" saved HTML file"+(savedHTML.length===1?"":"s"):"No HTML files yet. Add your first HTML page above.";
 savedHTML.forEach(item=>{
  const card=document.createElement("article");card.className="html-card";
  const title=document.createElement("h3");title.textContent=item.title||"Untitled HTML";
  const meta=document.createElement("p");meta.className="text-card-meta";meta.textContent="HTML page"+(item.updatedAt?" · "+new Date(item.updatedAt).toLocaleString():"");
  const excerpt=document.createElement("p");excerpt.className="text-card-excerpt";excerpt.textContent=(item.html||"").slice(0,220).replace(/\s+/g," ");
  const actions=document.createElement("div");actions.className="text-card-actions";
  const play=document.createElement("button");play.className="header-btn";play.textContent="▶ Play";play.addEventListener("click",()=>playHTML(item));
  const edit=document.createElement("button");edit.className="header-btn";edit.textContent="Edit";edit.addEventListener("click",()=>editHTML(item));
  const del=document.createElement("button");del.className="header-btn danger-btn";del.textContent="Remove";del.addEventListener("click",()=>removeHTML(item.id));
  actions.append(play,edit,del);card.append(title,meta,excerpt,actions);grid.append(card);
 });
}
function clearHTMLEditor(){
 editingHTMLId="";$("htmlTitle").value="";$("htmlCode").value="";$("htmlFile").value="";$("htmlEditorTitle").textContent="Add HTML";$("htmlSaveButton").textContent="Save HTML";$("htmlCancelEdit").classList.add("hidden-section");
}
function editHTML(item){
 editingHTMLId=item.id;$("htmlTitle").value=item.title||"";$("htmlCode").value=item.html||"";$("htmlFile").value="";
 $("htmlEditorTitle").textContent="Edit HTML";$("htmlSaveButton").textContent="Save changes";$("htmlCancelEdit").classList.remove("hidden-section");
 $("htmlEditor").scrollIntoView({behavior:"smooth",block:"start"});
}
function readHTMLFile(file){
 if(!file)return;
 if(file.size>2*1024*1024){alert("HTML files must be 2 MB or smaller.");$("htmlFile").value="";return}
 const reader=new FileReader();
 reader.onload=()=>{$("htmlCode").value=String(reader.result||"");if(!$("htmlTitle").value.trim())$("htmlTitle").value=file.name.replace(/\.html?$/i,"")};
 reader.onerror=()=>alert("Could not read that file.");
 reader.readAsText(file);
}
function sendHTMLAction(fields){
 if(!htmlApiReady()){alert("Add your deployed Google Apps Script URL in assets/html-library.js first.");return}
 const frame=document.createElement("iframe");frame.name="htmlLibraryFrame"+Date.now();frame.style.display="none";
 const form=document.createElement("form");form.method="POST";form.action=HTML_LIBRARY_API;form.target=frame.name;form.style.display="none";
 Object.entries(fields).forEach(([key,value])=>{const input=document.createElement("input");input.type="hidden";input.name=key;input.value=value;form.append(input)});
 document.body.append(frame,form);form.submit();form.remove();setTimeout(()=>frame.remove(),20000);
}
function saveHTML(){
 const html=$("htmlCode").value;if(!html.trim()){alert("Paste HTML code or choose an HTML file first.");return}
 $("htmlSaveStatus").textContent="Saving…";
 sendHTMLAction({action:"html_save",id:editingHTMLId,title:$("htmlTitle").value.trim()||"Untitled HTML",html});
}
function removeHTML(id){
 if(confirm("Remove this HTML page permanently?"))sendHTMLAction({action:"html_delete",id});
}
function playHTML(item){
 playingHTML=item;$("htmlPreviewTitle").textContent=item.title||"HTML preview";
 $("htmlPreviewFrame").srcdoc=item.html||"";
 $("htmlPreview").classList.remove("hidden-section");document.body.style.overflow="hidden";
 $("htmlPreviewMenu").classList.add("hidden-section");
}
function closeHTMLPreview(){
 $("htmlPreview").classList.add("hidden-section");$("htmlPreviewFrame").srcdoc="";document.body.style.overflow="";
 $("htmlPreviewMenu").classList.add("hidden-section");playingHTML=null;
}
function downloadPlayingHTML(){
 if(!playingHTML)return;
 const blob=new Blob([playingHTML.html||""],{type:"text/html;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=(playingHTML.title||"page").replace(/[\\/:*?"<>|]+/g,"_")+".html";
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("htmlFile").addEventListener("change",()=>readHTMLFile($("htmlFile").files[0]));
$("htmlSaveButton").addEventListener("click",saveHTML);
$("htmlCancelEdit").addEventListener("click",clearHTMLEditor);
$("htmlPreviewMenuButton").addEventListener("click",()=>$("htmlPreviewMenu").classList.toggle("hidden-section"));
$("htmlDownloadButton").addEventListener("click",downloadPlayingHTML);
$("htmlCloseButton").addEventListener("click",closeHTMLPreview);
$("htmlReloadButton").addEventListener("click",()=>{if(playingHTML)$("htmlPreviewFrame").srcdoc=playingHTML.html||""});
window.addEventListener("message",event=>{
 if(!event.data||event.data.type!=="htmlLibraryResult")return;
 const result=event.data.result||{};
 if(!result.ok){$("htmlSaveStatus").textContent=result.error||"Could not save.";alert(result.error||"Could not save HTML.");return}
 $("htmlSaveStatus").textContent=result.action==="html_delete"?"Removed.":"Saved online.";
 clearHTMLEditor();loadHTMLLibrary();
});
