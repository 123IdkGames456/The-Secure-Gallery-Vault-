# The Secure Gallery Vault

A room-based image gallery hosted on GitHub Pages, using Google Sheets and Google Apps Script as its storage API.

## Storage

- Spreadsheet ID: `1QZckLOQyYTiTumAtZJOTDb3_fhiVw6KSkAuPUZE3-78`
- Google Apps Script source: `Code.gs`
- Images are converted to Base64 in the browser and saved in 40,000-character chunks in the `VaultImages` sheet.
- Room codes and creation dates are stored in `VaultRooms`.
- Each image is automatically resized/compressed to fit a maximum of 25 upload parts (40,000 Base64 characters per part), roughly 750 KB of image data.
- Large still images are reduced in dimensions and quality until they fit. Animated GIFs above the limit are rejected because the browser does not recompress their animation.
- Original selected files over 20 MB are rejected.

## Setup

1. Open the Google Sheet linked to the spreadsheet ID above.
2. Open **Extensions → Apps Script**.
3. Replace the editor contents with the repository's `Code.gs`.
4. Save the project.
5. Select **Deploy → New deployment → Web app**.
6. Set **Execute as** to your account.
7. Set **Who has access** to **Anyone** if you want the public GitHub Pages site to use it.
8. Deploy and copy the web app URL ending in `/exec`.
9. In `app.js`, replace `PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE` with that URL, then commit the change to GitHub.

The first request creates the `VaultRooms` and `VaultImages` tabs automatically.

## API actions

- `createRoom`: creates a random room code.
- `listImages`: lists completed images in a room.
- `uploadChunk`: stores one Base64 chunk.
- `getImage`: returns the joined Base64 image data.

Requests use a plain-text JSON POST body to avoid a browser CORS preflight. The Apps Script web app must be deployed with access allowed to the site's visitors.

## Privacy and limitations

- A room code is an access code, not strong authentication. Anyone who knows it can view its images.
- The spreadsheet owner can see all stored image data.
- Base64 increases storage size compared with binary image files.
- Google Sheets has spreadsheet-wide cell limits and Apps Script has execution and request quotas. This is suitable for a small gallery, not unlimited image hosting.
- Do not store sensitive or private images here.
