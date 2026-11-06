const TTS_KEY="secureGalleryTTS";
let ttsWords=[],ttsWordIndex=1,ttsRun=0,ttsChunkStart=0,ttsChunkEnd=0,ttsVoices=[],ttsWatchTimer=null,ttsChunkId=0;
function ttsSave(){try{localStorage.setItem(TTS_KEY,JSON.stringify({text:$("ttsText").value,wordIndex:ttsWordIndex,voice:$("ttsVoice").value,rate:Number($("ttsRate").value)}))}catch(e){}}
function ttsBuildWords(){ttsWords=[];const re=new RegExp("\\S+","g");let m;while((m=re.exec($("ttsText").value)))ttsWords.push({start:m.index,end:re.lastIndex})}
function ttsProgress(){const total=ttsWords.length;ttsWordIndex=Math.max(1,Math.min(ttsWordIndex,(total||1)+1));$("ttsWord").value=ttsWordIndex;$("ttsProgress").textContent="Word "+ttsWordIndex+" / "+total;ttsSave()}
function ttsSetStatus(s){$("ttsStatus").textContent=s}
function ttsClearWatch(){if(ttsWatchTimer!==null){clearTimeout(ttsWatchTimer);ttsWatchTimer=null}}
function ttsArmWatch(run,chunkId){
 ttsClearWatch();
 ttsWatchTimer=setTimeout(()=>{
  if(run!==ttsRun||chunkId!==ttsChunkId)return;
  if(speechSynthesis.paused){ttsArmWatch(run,chunkId);return}
  ttsWordIndex=Math.min(ttsWords.length+1,ttsWordIndex+1);
  ttsProgress();
  ttsSetStatus("Skipping a stuck word and continuing…");
  ttsChunkId++;
  speechSynthesis.cancel();
  ttsClearWatch();
  setTimeout(()=>{if(run===ttsRun)ttsSpeak(run)},80);
 },1100);
}
function ttsWordAt(char){for(let i=0;i<ttsWords.length;i++){if(ttsWords[i].end>char)return i+1}return ttsWords.length+1}
function ttsCharAt(word){return ttsWords[Math.max(0,Math.min(ttsWords.length-1,word-1))]?.start??0}
function ttsLoadVoices(){
 if(!("speechSynthesis" in window))return;
 const previous=$("ttsVoice").value;
 ttsVoices=speechSynthesis.getVoices().filter(v=>/^en([-_]|$)/i.test(v.lang));
 ttsVoices.sort((a,b)=>voiceScore(b)-voiceScore(a));
 $("ttsVoice").innerHTML="";
 if(!ttsVoices.length){$("ttsVoice").add(new Option("No English voice found",""));ttsSetStatus("No English voice is installed. Add one in your device's speech settings.");return}
 ttsVoices.forEach(v=>$("ttsVoice").add(new Option(v.name+" ("+v.lang+")",v.voiceURI)));
 if(ttsVoices.some(v=>v.voiceURI===previous))$("ttsVoice").value=previous;
 else $("ttsVoice").value=ttsVoices[0].voiceURI;
 ttsSave();
}
function voiceScore(v){const s=(v.name+" "+v.lang).toLowerCase();let n=0;if(/natural|neural|enhanced|premium/.test(s))n+=10;if(/google|microsoft/.test(s))n+=4;if(/en-us/.test(s))n+=2;return n}
function ttsSpeak(run){
 if(run!==ttsRun)return;
 const text=$("ttsText").value;if(!text.trim()){ttsSetStatus("Enter some text first.");return}
 ttsBuildWords();if(!ttsWords.length)return;
 if(ttsWordIndex>ttsWords.length){ttsSetStatus("Finished");ttsProgress();return}
 const start=ttsCharAt(ttsWordIndex);const end=text.length;
 const chunk=text.slice(start,end);if(!chunk.trim()){ttsWordIndex=ttsWords.length+1;ttsProgress();ttsSetStatus("Finished");return}
 ttsChunkStart=start;ttsChunkEnd=end;const chunkId=++ttsChunkId;
 const utter=new SpeechSynthesisUtterance(chunk);
 const voice=ttsVoices.find(v=>v.voiceURI===$("ttsVoice").value);
 utter.lang=voice?.lang||"en-US";if(voice)utter.voice=voice;
 utter.rate=Number($("ttsRate").value)||0.95;utter.pitch=1;
 utter.onboundary=e=>{if(run!==ttsRun||chunkId!==ttsChunkId)return;if(e.name==="word"){ttsWordIndex=ttsWordAt(ttsChunkStart+(e.charIndex||0));ttsProgress();ttsArmWatch(run,chunkId)}};
 utter.onend=()=>{if(run!==ttsRun||chunkId!==ttsChunkId)return;ttsClearWatch();ttsWordIndex=ttsWords.length+1;ttsProgress();ttsSetStatus("Finished")};
 utter.onerror=e=>{if(run===ttsRun&&e.error!=="canceled"&&e.error!=="interrupted")ttsSetStatus("Speech error: "+e.error)};
 ttsSetStatus("Speaking in English…");speechSynthesis.speak(utter);ttsArmWatch(run,chunkId);
}
function playTTS(){if(!("speechSynthesis" in window)){ttsSetStatus("Text-to-speech is not supported in this browser.");return}if(speechSynthesis.paused){speechSynthesis.resume();ttsSetStatus("Speaking…");return}if(speechSynthesis.speaking)return;ttsRun++;ttsSpeak(ttsRun)}
function pauseTTS(){if("speechSynthesis" in window&&speechSynthesis.speaking){speechSynthesis.pause();ttsSetStatus("Paused");ttsSave()}}
function stopTTS(){ttsRun++;ttsChunkId++;ttsClearWatch();if("speechSynthesis" in window)speechSynthesis.cancel();ttsSetStatus("Stopped");ttsSave()}
function jumpTTS(){ttsBuildWords();const n=Math.max(1,Math.min(ttsWords.length||1,Number($("ttsWord").value)||1));stopTTS();ttsWordIndex=n;ttsProgress();ttsSetStatus("Ready at word "+n)}
function initTTS(){
 let saved=null;try{saved=JSON.parse(localStorage.getItem(TTS_KEY)||"null")}catch(e){}
 if(saved){$("ttsText").value=saved.text||"";ttsWordIndex=Number(saved.wordIndex)||1;if(saved.rate)$("ttsRate").value=saved.rate}
 $("ttsRateValue").textContent=Number($("ttsRate").value).toFixed(2)+"×";
 ttsBuildWords();ttsProgress();ttsLoadVoices();
 if("speechSynthesis" in window)speechSynthesis.onvoiceschanged=ttsLoadVoices;
 $("ttsText").addEventListener("input",()=>{stopTTS();ttsBuildWords();ttsWordIndex=1;ttsProgress();ttsSetStatus("Saved locally")});
 $("ttsPlay").addEventListener("click",playTTS);$("ttsPause").addEventListener("click",pauseTTS);$("ttsStop").addEventListener("click",stopTTS);$("ttsJump").addEventListener("click",jumpTTS);
 $("ttsWord").addEventListener("keydown",e=>{if(e.key==="Enter")jumpTTS()});
 $("ttsVoice").addEventListener("change",()=>{stopTTS();ttsSave();ttsSetStatus("English voice selected")});
 $("ttsRate").addEventListener("input",()=>{$("ttsRateValue").textContent=Number($("ttsRate").value).toFixed(2)+"×";ttsSave()});
}
initTTS();

