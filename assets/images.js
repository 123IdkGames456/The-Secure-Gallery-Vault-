let current=0;
function applyHideSetting(){const enabled=localStorage.getItem("secureGalleryHideImages")==="true";$("hideImages").checked=enabled;document.body.classList.toggle("hide-images",enabled)}
function openImage(i){if(!images.length)return;current=i;$("viewer").classList.remove("hidden");renderViewer()}
function openRandomImage(){if(!images.length)return;let next=Math.floor(Math.random()*images.length);if(images.length>1&&next===current)next=(next+1+Math.floor(Math.random()*(images.length-1)))%images.length;openImage(next)}
function renderViewer(){const item=images[current];$("big").src=item.url;$("big").alt=item.name;$("caption").textContent=item.name+" · "+(current+1)+" / "+images.length;$("prev").disabled=current===0;$("next").disabled=current===images.length-1}
function moveImage(n){current=Math.max(0,Math.min(images.length-1,current+n));renderViewer()}
function closeViewer(){$("viewer").classList.add("hidden");$("big").removeAttribute("src")}
function renderImages(){ $("grid").replaceChildren();$("total").textContent=images.length+" images";$("status").textContent=images.length?"":"No images found.";images.forEach((item,i)=>{const tile=document.createElement("button");tile.type="button";tile.className="tile";tile.setAttribute("aria-label","Open "+item.name);const img=document.createElement("img");img.src=item.url;img.alt=item.name;img.loading="lazy";const name=document.createElement("span");name.textContent=item.name;tile.append(img,name);tile.addEventListener("click",()=>openImage(i));$("grid").append(tile)})}
$("hideImages").addEventListener("change",e=>{localStorage.setItem("secureGalleryHideImages",String(e.target.checked));document.body.classList.toggle("hide-images",e.target.checked)});
$("randomImage").addEventListener("click",openRandomImage);$("close").addEventListener("click",closeViewer);$("prev").addEventListener("click",()=>moveImage(-1));$("next").addEventListener("click",()=>moveImage(1));
$("viewer").addEventListener("touchstart",e=>$("viewer").dataset.touchX=e.changedTouches[0].screenX,{passive:true});$("viewer").addEventListener("touchend",e=>{const dx=e.changedTouches[0].screenX-Number($("viewer").dataset.touchX||0);if(Math.abs(dx)>55)moveImage(dx<0?1:-1)},{passive:true});
document.addEventListener("keydown",e=>{if($("viewer").classList.contains("hidden"))return;if(e.key==="Escape")closeViewer();else if(e.key==="ArrowLeft")moveImage(-1);else if(e.key==="ArrowRight")moveImage(1)});
function initImages(){applyHideSetting();renderImages()}
