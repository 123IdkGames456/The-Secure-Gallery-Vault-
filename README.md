# The Secure Gallery Vault

A simple room-based image gallery using Picrd for image hosting. No Google account, Google Sheets, Apps Script, Base64 image storage, or server setup is required.

## How it works

- The master password is checked in the site's public `app.js` file.
- Create a room from the site. Picrd creates an album and returns its room code.
- The room code is the Picrd album ID.
- Images upload directly to Picrd and are added to that room's album.
- The gallery reads the album directly from Picrd.
- Images are uploaded as unlisted.
- The upload request omits `ttl_seconds`, so Picrd's documented default is no automatic expiry.

## Master password

The current master password is `vault123`.

Change `MASTER_PASSWORD` near the top of `app.js` if you want a different one. Anyone can inspect public JavaScript and see this password, so it is only a simple screen lock, not real authentication.

## Rooms

1. Open the site and enter the master password.
2. Select **Create a new room**.
3. Save the room code Picrd gives you.
4. To reopen that room later, enter its room code.

The room code is the album ID. Anyone who knows it may be able to view the album.

## Image uploads

- PNG, JPG, WebP, and GIF are supported.
- Multiple images can be uploaded at once.
- Images are resized/compressed in the browser when needed to fit below 9.5 MB.
- Oversized animated GIFs are rejected rather than having their animation removed.
- Uploads are sent directly to Picrd. Images are not converted to Base64 for storage.

## Privacy and limitations

- Picrd's unlisted images are not publicly listed, but anyone with the image or album URL may be able to view them.
- The master password is public in the JavaScript.
- Do not upload sensitive or private images.
- Picrd is a third-party service. Its availability, limits, and retention policies may change.
- Picrd documents a 10 MB per-image upload limit and a limit of 60 uploads per hour per IP.

## GitHub Pages

Enable GitHub Pages for the `main` branch and root folder in the repository settings.
