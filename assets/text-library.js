const TEXT_LIBRARY_API = "https://script.google.com/macros/s/AKfycbwbrXbe2he8rQm2_YOrWTK314CMmMH52k5FVarkMman84mJ8b-jrtTgrG8TwerAUPfRhg/exec";
let savedTexts = [];
let textLibraryRequest = 0;
let editingTextId = "";
let pendingTextOperation = null;
function textApiReady(){return TEXT_LIBRARY_API&&!TEXT_LIBRARY_API.includes("PASTE_SECOND")}
function loadTextLibrary(){
 const status=$("textStatus"),grid=$("textGrid");
 if(!textApiReady()){status.textContent="Connect the Google Apps Script to enable your online text library.";grid.innerHTML="";return}
 status.textContent="Loading saved texts…";
 const old=document.getElementById("textLibraryApi");if(old)old.remove();
 const script=document.createElement("script"),callback="textLibraryCallback"+(++textLibraryRequest);
 window[callback]=data=>{delete window[callback];script.remove();if(!data||!data.ok){status.textContent=data?.error||"Could not load saved texts.";return}savedTexts=(Array.isArray(data.texts)?data.texts:[]).filter(item=>!(item.title||"").startsWith("[[HTML]] "));renderTextLibrary()};
 script.id="textLibraryApi";script.src=TEXT_LIBRARY_API+"?action=list&callback="+callback+"&t="+Date.now();
 script.onerror=()=>{delete window[callback];script.remove();status.textContent="Could not connect to the Text Library script. Check its Web app deployment."};
 document.head.append(script);
}
function renderTextLibrary(){
 const grid=$("textGrid");grid.innerHTML="";
 $("textStatus").textContent=savedTexts.length?savedTexts.length+" saved text"+(savedTexts.length===1?"":"s"):"No saved texts yet. Open TTS and save your first text.";
 savedTexts.forEach(item=>{
  const card=document.createElement("article");card.className="text-card";
  const title=document.createElement("h3");title.textContent=item.title||"Untitled";
  const meta=document.createElement("p");meta.className="text-card-meta";meta.textContent=(item.wordCount||0)+" words"+(item.updatedAt?" · "+new Date(item.updatedAt).toLocaleString():"");
  const excerpt=document.createElement("p");excerpt.className="text-card-excerpt";excerpt.textContent=(item.text||"").slice(0,240);
  const actions=document.createElement("div");actions.className="text-card-actions";
  const open=document.createElement("button");open.className="header-btn";open.textContent="Open in TTS";open.addEventListener("click",()=>openSavedText(item.id));
  const edit=document.createElement("button");edit.className="header-btn";edit.textContent="Edit";edit.addEventListener("click",()=>editSavedText(item));
  const del=document.createElement("button");del.className="header-btn danger-btn";del.textContent="Delete";del.addEventListener("click",()=>deleteSavedText(item.id));
  actions.append(open,edit,del);card.append(title,meta,excerpt,actions);grid.append(card);
 });
}
function editSavedText(item){
 editingTextId=item.id;$("ttsTitle").value=item.title||"";$("ttsText").value=item.text||"";stopTTS();ttsWordIndex=1;ttsBuildWords();ttsProgress();$("textSaveStatus").textContent="Editing saved text";setTab("tts");
}
function readTextFile(file){
 if(!file)return;
 const reader=new FileReader();reader.onload=()=>{$("ttsText").value=String(reader.result||"");if(!$("ttsTitle").value.trim())$("ttsTitle").value=file.name.replace(/\\.txt$/i,"");$("textSaveStatus").textContent="File loaded. Press Save online to upload it."};reader.onerror=()=>{$("textSaveStatus").textContent="Could not read file."};reader.readAsText(file);
}
function openSavedText(id){
 const item=savedTexts.find(x=>x.id===id);if(!item)return;
 stopTTS();$("ttsTitle").value=item.title||"";$("ttsText").value=item.text||"";ttsWordIndex=1;ttsBuildWords();ttsProgress();ttsSetStatus("Loaded from online library");setTab("tts");
}
function sendTextLibraryAction(fields){
 if(!textApiReady()){alert("The Google Apps Script URL has not been added yet.");return}
 const frame=document.createElement("iframe");frame.name="textLibraryFrame"+Date.now();frame.style.display="none";
 const form=document.createElement("form");form.method="POST";form.action=TEXT_LIBRARY_API;form.target=frame.name;form.style.display="none";
 Object.entries(fields).forEach(([key,value])=>{const input=document.createElement("input");input.type="hidden";input.name=key;input.value=value;form.append(input)});
 document.body.append(frame,form);form.submit();form.remove();setTimeout(()=>frame.remove(),65000);
}
function saveTextOnline(){
 const text=$("ttsText").value;if(!text.trim()){alert("Enter some text first.");return}
 const title=$("ttsTitle").value.trim()||"Untitled";
 pendingTextOperation={action:"save",id:editingTextId,title,text};
 $("textSaveStatus").textContent="Sending online…";
 sendTextLibraryAction({action:"save",id:editingTextId,title,text});
}
function deleteSavedText(id){
 if(!confirm("Delete this saved text permanently?"))return;
 pendingTextOperation={action:"delete",id};
 $("textStatus").textContent="Deleting… waiting for online confirmation";
 sendTextLibraryAction({action:"delete",id});
}
function fetchTextRecords(callback){
 const script=document.createElement("script"),callbackName="textVerifyCallback"+(++textLibraryRequest);
 window[callbackName]=data=>{delete window[callbackName];script.remove();callback(data&&data.ok?null:(data?.error||"Could not read the online list."),data?.texts||[])};
 script.src=TEXT_LIBRARY_API+"?action=list&callback="+callbackName+"&t="+Date.now();
 script.onerror=()=>{delete window[callbackName];script.remove();callback("Could not connect to the online list.",[])};
 document.head.append(script);
}
function verifyTextOperation(result){
 const op=pendingTextOperation;if(!op)return;
 if(!result.ok){$("textSaveStatus").textContent=result.error||"Online request failed."; $("textStatus").textContent=result.error||"Online request failed.";pendingTextOperation=null;loadTextLibrary();return}
 if(result.id)op.id=result.id;
 const started=Date.now();
 $("textSaveStatus").textContent=op.action==="delete"?"Checking that it was deleted…":"Checking that it was saved online…";
 function check(){
  fetchTextRecords((error,records)=>{
   const found=records.find(item=>String(item.id)===String(op.id));
   const done=op.action==="delete"?!found:!!found&&found.title===op.title&&found.text===op.text;
   if(!error&&done){
    pendingTextOperation=null;
    if(op.action==="save"){editingTextId="";$("textSaveStatus").textContent="Done! Saved online."; $("textStatus").textContent="Saved and verified online."}
    else{$("textSaveStatus").textContent="Done! Deleted online."; $("textStatus").textContent="Deleted and verified online."}
    loadTextLibrary();return;
   }
   if(Date.now()-started>=60000){
    pendingTextOperation=null;
    $("textSaveStatus").textContent="Not confirmed yet. Refresh the list and check the connection.";
    $("textStatus").textContent="Could not confirm the change after 60 seconds.";
    loadTextLibrary();return;
   }
   $("textSaveStatus").textContent=(op.action==="delete"?"Waiting for deletion":"Waiting for save")+" · checking every second…";
   $("textStatus").textContent=(op.action==="delete"?"Waiting for the text to disappear":"Waiting for the text to appear")+" · checking every second…";
   setTimeout(check,1000);
  });
 }
 check();
}
window.addEventListener("message",event=>{
 if(!event.data||event.data.type!=="textLibraryResult")return;
 verifyTextOperation(event.data.result||{});
});
$("ttsSaveOnline").addEventListener("click",saveTextOnline);
if($("ttsFile"))$("ttsFile").addEventListener("change",()=>readTextFile($("ttsFile").files[0]));
