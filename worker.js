const ALLOWED_ORIGINS = [
  "https://123idkgames456.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const TYPES = new Set(["image/png","image/jpeg","image/webp","image/gif"]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type":"application/json; charset=utf-8", ...corsHeaders(request) }
  });
}
function validCode(code) {
  return /^[A-Z0-9_-]{5,32}$/.test(code || "");
}
function safeName(name) {
  return String(name || "image").replace(/[\\/:*?"<>|]/g,"_").slice(0,180);
}
function keyFor(code) {
  return "room:" + code;
}
async function getRoom(env, code) {
  if (!validCode(code)) return null;
  const raw = await env.GALLERY_DATA.get(keyFor(code));
  return raw ? JSON.parse(raw) : null;
}
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null,{status:204,headers:corsHeaders(request)});
    }
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return json({ok:true,service:"Secure Gallery Vault",storage:"Cloudflare R2",upload:"binary"},200,request);
      }
      if (request.method === "POST" && url.pathname === "/api/rooms") {
        let code;
        do {
          code = crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase();
        } while (await env.GALLERY_DATA.get(keyFor(code)));
        const room = {roomCode:code,createdAt:new Date().toISOString(),images:[]};
        await env.GALLERY_DATA.put(keyFor(code),JSON.stringify(room));
        return json({ok:true,roomCode:code},200,request);
      }
      if (parts[0] !== "api" || parts[1] !== "rooms" || !parts[2]) {
        return json({ok:false,error:"Not found."},404,request);
      }
      const code = parts[2].toUpperCase();
      const room = await getRoom(env,code);
      if (!room) return json({ok:false,error:"Room not found."},404,request);
      if (parts[3] !== "images") return json({ok:false,error:"Not found."},404,request);

      if (parts.length === 4 && request.method === "GET") {
        return json({ok:true,images:room.images},200,request);
      }

      if (parts.length === 4 && request.method === "POST") {
        const form = await request.formData();
        const file = form.get("image");
        const thumb = form.get("thumbnail");
        const imageId = String(form.get("imageId") || "");
        const fileName = safeName(form.get("fileName") || (file && file.name));
        if (!(file instanceof File)) return json({ok:false,error:"Image file is missing."},400,request);
        if (!TYPES.has(file.type)) return json({ok:false,error:"Use PNG, JPG, WebP or GIF."},400,request);
        if (file.size < 1 || file.size > MAX_IMAGE_BYTES) return json({ok:false,error:"Image must be smaller than 15 MB."},400,request);
        if (!/^[A-Za-z0-9_-]{8,80}$/.test(imageId)) return json({ok:false,error:"Invalid image ID."},400,request);
        if (room.images.some(item => item.imageId === imageId)) return json({ok:false,error:"Image already exists."},409,request);
        const originalKey = "rooms/" + code + "/" + imageId;
        const thumbKey = "rooms/" + code + "/" + imageId + ".thumb.jpg";
        await env.GALLERY_BUCKET.put(originalKey,file.stream(),{
          httpMetadata:{contentType:file.type,cacheControl:"private, max-age=60"},
          customMetadata:{roomCode:code,imageId,fileName}
        });
        let hasThumb = false;
        if (thumb instanceof File && thumb.size > 0 && thumb.size < 300000) {
          await env.GALLERY_BUCKET.put(thumbKey,thumb.stream(),{
            httpMetadata:{contentType:"image/jpeg",cacheControl:"private, max-age=60"}
          });
          hasThumb = true;
        }
        room.images.unshift({
          imageId,
          fileName,
          mimeType:file.type,
          size:file.size,
          createdAt:new Date().toISOString(),
          hasThumbnail:hasThumb
        });
        await env.GALLERY_DATA.put(keyFor(code),JSON.stringify(room));
        return json({ok:true,imageId},201,request);
      }

      if (parts.length === 5 && request.method === "GET") {
        const imageId = parts[4];
        const item = room.images.find(entry => entry.imageId === imageId);
        if (!item) return json({ok:false,error:"Image not found."},404,request);
        const isThumb = url.searchParams.get("variant") === "thumb" && item.hasThumbnail;
        const object = await env.GALLERY_BUCKET.get(
          "rooms/" + code + "/" + imageId + (isThumb ? ".thumb.jpg" : "")
        );
        if (!object) return json({ok:false,error:"Image file not found."},404,request);
        const headers = new Headers(corsHeaders(request));
        object.writeHttpMetadata(headers);
        headers.set("ETag",object.httpEtag);
        headers.set("Cache-Control","private, max-age=60");
        headers.set("X-Content-Type-Options","nosniff");
        return new Response(object.body,{headers});
      }
      return json({ok:false,error:"Method not allowed."},405,request);
    } catch (error) {
      return json({ok:false,error:error && error.message ? error.message : "Server error."},500,request);
    }
  }
};
