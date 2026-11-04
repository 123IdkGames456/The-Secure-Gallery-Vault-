const CHUNK_SIZE = 40000;
const CHUNKS_PER_ROW = 10;
const SHEET_NAME = "VaultImages";

function setupVault() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("SPREADSHEET_ID");
  if (!id) {
    const ss = SpreadsheetApp.create("Secure Gallery Vault Storage");
    id = ss.getId();
    const sheet = ss.getSheets()[0];
    sheet.setName(SHEET_NAME);
    sheet.appendRow(["imageId","roomHash","name","mimeType","createdAt","partIndex","partCount",
      "chunk1","chunk2","chunk3","chunk4","chunk5","chunk6","chunk7","chunk8","chunk9","chunk10"]);
    props.setProperty("SPREADSHEET_ID", id);
  }
  if (!props.getProperty("MASTER_PASSWORD")) props.setProperty("MASTER_PASSWORD", "CHANGE_THIS_MASTER_PASSWORD");
  if (!props.getProperty("ROOM_CODES")) props.setProperty("ROOM_CODES", "CHANGE_THIS_TO_COMMA_SEPARATED_ROOM_CODES");
  Logger.log("Spreadsheet: https://docs.google.com/spreadsheets/d/" + id + "/edit");
  Logger.log("Set MASTER_PASSWORD and ROOM_CODES in Project Settings > Script Properties before deploying.");
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty("SPREADSHEET_ID")) throw new Error("Run setupVault() first.");
    if (body.masterPassword !== props.getProperty("MASTER_PASSWORD")) throw new Error("Incorrect master password.");
    if (body.action === "checkMaster") return output({ok:true});
    const code = String(body.roomCode || "");
    const allowed = (props.getProperty("ROOM_CODES") || "").split(",").map(x=>x.trim()).filter(Boolean);
    if (!allowed.includes(code)) throw new Error("That room code is not valid.");
    const roomHash = digest(code);
    const sheet = SpreadsheetApp.openById(props.getProperty("SPREADSHEET_ID")).getSheetByName(SHEET_NAME);
    if (body.action === "listImages") {
      const rows = sheet.getDataRange().getValues();
      const found = {};
      for (let i=1;i<rows.length;i++) {
        const r=rows[i]; if (r[1] !== roomHash) continue;
        found[r[0]]={id:r[0],name:r[2],mimeType:r[3],createdAt:r[4]};
      }
      return output({ok:true,images:Object.values(found).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))});
    }
    if (body.action === "getImage") {
      const rows=sheet.getDataRange().getValues(), parts=[];
      let meta=null;
      for(let i=1;i<rows.length;i++){
        const r=rows[i];
        if(r[0]===body.imageId && r[1]===roomHash){
          meta={mimeType:r[3],partCount:Number(r[6])};
          parts[Number(r[5])]=r.slice(7,17).join("");
        }
      }
      if(!meta) throw new Error("Image not found in this room.");
      if(parts.length!==meta.partCount) throw new Error("Image data is incomplete.");
      return output({ok:true,mimeType:meta.mimeType,base64:parts.join("")});
    }
    if (body.action === "uploadImage") {
      const base64=String(body.base64||"");
      if(!base64 || base64.length>12000000) throw new Error("Image data is empty or too large.");
      if(!/^image\/[a-zA-Z0-9.+-]+$/.test(String(body.mimeType||""))) throw new Error("Unsupported image type.");
      const imageId=Utilities.getUuid(), name=String(body.name||"image").slice(0,180);
      const totalChunks=Math.ceil(base64.length/CHUNK_SIZE);
      const partCount=Math.ceil(totalChunks/CHUNKS_PER_ROW);
      const now=new Date().toISOString(), rows=[];
      for(let p=0;p<partCount;p++){
        const row=[imageId,roomHash,name,body.mimeType,now,p,partCount];
        for(let c=0;c<CHUNKS_PER_ROW;c++){
          const start=(p*CHUNKS_PER_ROW+c)*CHUNK_SIZE;
          row.push(base64.slice(start,start+CHUNK_SIZE));
        }
        rows.push(row);
      }
      sheet.getRange(sheet.getLastRow()+1,1,rows.length,7+CHUNKS_PER_ROW).setValues(rows);
      return output({ok:true,id:imageId});
    }
    throw new Error("Unknown action.");
  } catch(err) {
    return output({ok:false,error:String(err.message||err)});
  }
}

function digest(value) {
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8);
  return bytes.map(b=>(b+256).toString(16).slice(-2)).join("");
}
function output(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}