# The Secure Gallery Vault

A room-based image gallery hosted on GitHub Pages. Original image files upload directly from the browser to ImageKit as binary multipart data. Google Apps Script only creates rooms, stores image metadata, and signs short-lived ImageKit upload requests. The image bytes do not pass through Apps Script.

## Active architecture

- **GitHub Pages:** hosts the website.
- **ImageKit:** stores and serves original images and optimized thumbnail URLs.
- **Google Apps Script:** handles room codes, metadata, short-lived upload signatures, and image deletion.
- **Google Sheets:** stores room and image metadata.

The old Cloudflare Worker/R2 files are no longer part of the active website.

## Image upload flow

1. The browser asks Apps Script for a short-lived ImageKit upload signature.
2. Apps Script reads `IMAGEKIT_PRIVATE_KEY` from Script Properties and signs the request.
3. The browser uploads the original `File` directly to ImageKit using `FormData` and XMLHttpRequest.
4. Apps Script stores the returned ImageKit file ID and URLs in the spreadsheet.
5. The gallery displays ImageKit URLs and ImageKit transformation URLs for thumbnails.

No Base64 conversion or chunked text uploads are used for new images.

## Setup

### 1. Configure the Apps Script backend

1. Open the Google Apps Script project connected to the existing spreadsheet.
2. Replace its `Code.gs` with the repository's updated `Code.gs`.
3. In Apps Script, open **Project Settings → Script Properties**.
4. Add a property:
   - Name: `IMAGEKIT_PRIVATE_KEY`
   - Value: your ImageKit Private API Key
5. Do not put the Private API Key in any file served by GitHub Pages.
6. Deploy as a **Web app**, executing as your account, with access set to **Anyone**.
7. Copy the Web App URL ending in `/exec`.

The Apps Script project must be authorized to use the connected Google Sheet and `UrlFetchApp`. The first run/deployment may ask for Google permissions.

### 2. Configure the website

Open `imagekit-config.js` in the repository root and replace:

`PASTE_YOUR_UPDATED_APPS_SCRIPT_WEB_APP_URL_HERE`

with the Web App URL copied in step 1.

The ImageKit Public Key and URL endpoint are already configured for the ImageKit account supplied for this project. The Private Key must remain in Apps Script Script Properties.

### 3. Publish and test

1. Commit the files to the `main` branch.
2. Wait for GitHub Pages to publish.
3. Open the Pages site.
4. Create a room and save its code.
5. Upload a small PNG or JPG first.
6. Confirm it appears, refresh the room, open it, and test deleting it.

## Supported behavior

- Create a room with a unique 8-character access code.
- Open an existing room.
- List and refresh room images.
- Upload multiple PNG, JPEG, WebP, and GIF files.
- Upload each original file directly as binary data to ImageKit.
- Show per-file upload progress.
- Display optimized ImageKit thumbnails.
- Open the original image.
- Delete an image from ImageKit and remove its metadata.
- Maximum file size: 15 MB per image.

## Important security notes

- Never put the ImageKit Private API Key in `imagekit-config.js`, `app.js`, HTML, or any other file served by GitHub Pages. A private GitHub repository does not make the published Pages JavaScript private.
- GitHub Actions secrets are available to workflows, not as private runtime secrets to browser JavaScript.
- The ImageKit upload signature is short-lived. Apps Script only signs requests for valid room codes.
- A room code is a shared access code, not strong authentication. Anyone who knows a room code can view and upload to that room. Do not use this for highly sensitive images.
- Apps Script, Google Sheets, and ImageKit have usage quotas and service limits. This setup does not promise unlimited storage or traffic.
- Images uploaded by the old Google Drive/Base64 version are not automatically migrated into ImageKit. They remain in the old Drive folder; upload them again through the new gallery to add them to ImageKit.

## ImageKit account values

- URL endpoint: `https://ik.imagekit.io/ibaggrixo`
- Public key: configured in `imagekit-config.js`
- Private key: stored only in Apps Script Script Properties as `IMAGEKIT_PRIVATE_KEY`
