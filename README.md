# The Secure Gallery Vault

A private, room-based image gallery with a Google Sheets storage backend.

## How image storage works

- Each image's Base64 data is divided into chunks of **40,000 characters**.
- The chunks are placed across **10 spreadsheet columns** per data row.
- If an image needs more than 10 chunks, more rows are added for that same image.
- When the gallery loads an image, the app reads the rows in order and joins all 10-column segments back into one Base64 string.
- Each row stores a SHA-256 hash of the room code, not the room code itself.

This design respects Google Sheets' 50,000-character-per-cell limit. Ten fixed cells in one row alone would not be enough for large images, so additional rows are used as needed.

## Setup

1. Open [Google Apps Script](https://script.google.com/) and create a project.
2. Copy `Code.gs` from this repository into the Apps Script editor.
3. Run `setupVault()` once and approve the requested Google permissions. It creates a Google spreadsheet named **Secure Gallery Vault Storage**.
4. In Apps Script, open **Project Settings → Script Properties** and set:
   - `MASTER_PASSWORD`: your private master password.
   - `ROOM_CODES`: comma-separated allowed room codes, for example `ALPHA-01,BETA-02,GAMMA-03`.
   - Keep the generated `SPREADSHEET_ID` unchanged.
5. Deploy → New deployment → Web app. Set **Execute as: Me**. Set access to **Anyone** so the public GitHub Pages site can call the endpoint. The script itself checks the master password and room code on every request.
6. Copy the Web App URL ending in `/exec` into `API_URL` at the top of `app.js`.
7. Open `index.html` through GitHub Pages or a local web server.

## Security notes

- The master password is stored in Apps Script Script Properties, not in the public HTML or JavaScript.
- Room codes are checked on the server. Only images whose room hash matches the entered room are returned.
- Do not share edit access to the Apps Script project or spreadsheet with people who should not administer the vault.
- The spreadsheet is private to the Google account that owns the Apps Script project. Do not publish it to the web.
- This is a small private gallery, not a hardened high-security file vault. Anyone who knows both credentials can access a room. Use unique passwords and room codes, and do not upload sensitive images.
- The current browser upload limit is 8 MB per image; Apps Script and Sheets quotas may impose lower practical limits depending on usage.

## GitHub Pages

In the repository settings, enable Pages for the `main` branch and root folder.
