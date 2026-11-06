const TTS_KEY="secureGalleryTTS";
let ttsWords=[],ttsWordIndex=1,ttsRun=0,ttsChunkStart=0,ttsChunkEnd=0;
function ttsSave(){try{localStorage.setItem(TTS_KEY,JSON.stringify({text:$("ttsText").value,wordIndex:ttsWordIndex}))}catch(e){}}
function ttsBuildWords(){ttsWords=[];const re=new RegExp("\\S+","g");let m;while((m=re.exec($("ttsText").value)))ttsWords.push({start:m.index,end:re.lastIndex})}
function ttsProgress(){const total=ttsWords.length;ttsWordIndex=Math.max(1,Math.min(ttsWordIndex,(total||1)+1));$("ttsWord").value=ttsWordIndex;$("ttsProgress").textContent="Word "+ttsWordIndex+" / "+total;ttsSave()}
function ttsSetStatus(s){$("ttsStatus").textContent=s}
function ttsWordAt(char){for(let i=0;i<ttsWords.length;i++){if(ttsWords[i].end>char)return i+1}return ttsWords.length+1}
function ttsCharAt(word){return ttsWords[Math.max(0,Math.min(ttsWords.length-1,word-1))]?.start??0}
function ttsSpeak(run){
 if(run!==ttsRun)return;
 const text=$("ttsText").value;if(!text.trim()){ttsSetStatus("Enter some text first.");return}
 ttsBuildWords();if(!ttsWords.length)return;
 if(ttsWordIndex>ttsWords.length){ttsSetStatus("Finished");ttsProgress();return}
 const start=ttsCharAt(ttsWordIndex);let dot=text.indexOf(".",start);const end=dot<0?text.length:dot+1;
 const chunk=text.slice(start,end);if(!chunk.trim()){ttsWordIndex=ttsWords.length+1;ttsProgress();ttsSetStatus("Finished");return}
 ttsChunkStart=start;ttsChunkEnd=end;
 const utter=new SpeechSynthesisUtterance(chunk);
 utter.onboundary=e=>{if(run!==ttsRun)return;if(e.name==="word"){ttsWordIndex=ttsWordAt(ttsChunkStart+(e.charIndex||0));ttsProgress()}};
 utter.onend=()=>{if(run!==ttsRun)return;ttsWordIndex=ttsWordAt(ttsChunkEnd);ttsProgress();if(ttsWordIndex<=ttsWords.length)ttsSpeak(run);else ttsSetStatus("Finished")};
 utter.onerror=e=>{if(run===ttsRun&&e.error!=="canceled"&&e.error!=="interrupted")ttsSetStatus("Speech error: "+e.error)};
 ttsSetStatus("Speaking…");speechSynthesis.speak(utter);
}
function playTTS(){if(!("speechSynthesis" in window)){ttsSetStatus("Text-to-speech is not supported in this browser.");return}if(speechSynthesis.paused){speechSynthesis.resume();ttsSetStatus("Speaking…");return}if(speechSynthesis.speaking)return;ttsRun++;ttsSpeak(ttsRun)}
function pauseTTS(){if("speechSynthesis" in window&&speechSynthesis.speaking){speechSynthesis.pause();ttsSetStatus("Paused");ttsSave()}}
function stopTTS(){ttsRun++;if("speechSynthesis" in window)speechSynthesis.cancel();ttsSetStatus("Stopped");ttsSave()}
function jumpTTS(){ttsBuildWords();const n=Math.max(1,Math.min(ttsWords.length||1,Number($("ttsWord").value)||1));stopTTS();ttsWordIndex=n;ttsProgress();ttsSetStatus("Ready at word "+n)}
function initTTS(){let saved=null;try{saved=JSON.parse(localStorage.getItem(TTS_KEY)||"null")}catch(e){}if(saved){$("ttsText").value=saved.text||"";ttsWordIndex=Number(saved.wordIndex)||1}ttsBuildWords();ttsProgress();$("ttsText").addEventListener("input",()=>{stopTTS();ttsBuildWords();ttsWordIndex=1;ttsProgress();ttsSetStatus("Saved locally")});$("ttsPlay").addEventListener("click",playTTS);$("ttsPause").addEventListener("click",pauseTTS);$("ttsStop").addEventListener("click",stopTTS);$("ttsJump").addEventListener("click",jumpTTS);$("ttsWord").addEventListener("keydown",e=>{if(e.key==="Enter")jumpTTS()})}
initTTS();