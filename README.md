# The Secure Gallery Vault

A room-based image gallery hosted on GitHub Pages. Images are uploaded as their original binary files to a private Cloudflare R2 bucket through a Cloudflare Worker. No Base64 conversion or chunked image uploads are used.

## Storage architecture

- GitHub Pages hosts the website.
- Cloudflare Worker handles room creation, image uploads, image listings and image delivery.
- Cloudflare R2 stores original image files and small JPEG thumbnails as binary objects.
- Cloudflare KV stores room codes and image metadata.
- Google Sheets and Google Apps Script are no longer used by the active website.

## Cloudflare setup

### 1. Create the storage resources

In the Cloudflare dashboard:

1. Open **R2 Object Storage** and create a bucket named `secure-gallery-vault`.
2. Open **Workers & Pages → KV** and create a namespace, for example `GALLERY_DATA`.
3. Open **Workers & Pages** and create a Worker named `secure-gallery-vault-api`.

### 2. Add Worker bindings

Open the Worker settings and add these bindings:

- **R2 bucket**: variable name `GALLERY_BUCKET`, bucket `secure-gallery-vault`.
- **KV namespace**: variable name `GALLERY_DATA`, namespace created in step 1.

The binding names must match exactly.

### 3. Deploy the Worker code

Copy the contents of `worker.js` into the Cloudflare Worker editor and deploy it.

The included `wrangler.toml` is for Wrangler deployments. Replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with the real namespace ID before using it with Wrangler.

### 4. Connect the website

After deploying, copy the Worker URL. It normally looks like:

`https://secure-gallery-vault-api.<your-subdomain>.workers.dev`

Open `app.js` and replace:

`PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE`

with the Worker URL. Commit the change to GitHub.

### 5. Test the API

Open:

`https://YOUR-WORKER-URL/api/health`

It should return JSON showing:

- `ok: true`
- `storage: "Cloudflare R2"`
- `upload: "binary"`

Then open the GitHub Pages website, create a room, upload a small image, refresh the room and confirm the image remains visible.

## Upload behavior

- The browser sends the actual image file using `FormData`.
- No Base64 encoding is used.
- No 40,000-character chunks are used.
- Original images up to 15 MB are accepted.
- The browser creates a small JPEG thumbnail when possible; the thumbnail is also uploaded as a binary file.
- Original images remain in their original format, including animated GIFs.

## API routes

- `GET /api/health`: service health check.
- `POST /api/rooms`: create a room.
- `GET /api/rooms/{roomCode}/images`: list room images.
- `POST /api/rooms/{roomCode}/images`: upload multipart binary image data.
- `GET /api/rooms/{roomCode}/images/{imageId}`: retrieve the original image.
- `GET /api/rooms/{roomCode}/images/{imageId}?variant=thumb`: retrieve its thumbnail.

## Important privacy notes

- R2 objects are private; the Worker delivers them only after checking the room code.
- A room code is a shared access code, not strong user authentication. Anyone who knows it can view that room.
- Do not upload sensitive or highly private images.
- Keep the Worker bindings private; never put R2 API secrets in frontend JavaScript.
- The current Worker uses KV for room metadata. KV updates are eventually consistent, so this starter setup is intended for a small gallery rather than high-concurrency production workloads.

## Existing Google Apps Script

`Code.gs` is retained in the repository as the previous backend reference. The new website does not call it.
