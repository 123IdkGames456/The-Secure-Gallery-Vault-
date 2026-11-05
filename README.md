# Shared Image Gallery

A read-only image gallery hosted on GitHub Pages. The website asks for a password, then lists image files from a Google Drive folder. Visitors can view images and open them in Drive, but the site has no upload or delete controls.

## Active architecture

- **GitHub Pages:** hosts the gallery website.
- **Google Apps Script:** checks the gallery password, creates temporary viewing sessions, and lists images from Google Drive.
- **Google Drive:** stores the original image files.

The gallery searches the selected folder and its subfolders. It includes files whose MIME type starts with `image/`.

## Setup

### 1. Configure Google Apps Script

1. Open the Apps Script project connected to the existing spreadsheet.
2. Replace its `Code.gs` with this repository's updated `Code.gs`.
3. Open **Project Settings → Script Properties**.
4. Add these properties:
   - `GALLERY_PASSWORD`: the password you chose for the gallery.
   - `DRIVE_FOLDER_ID`: the ID of the Google Drive folder containing the images.
5. Do not put the gallery password in `index.html`, `app.js`, or any other GitHub Pages file.
6. Deploy as a **Web app**, executing as your account, with access set to **Anyone**.
7. Copy the Web App URL ending in `/exec`.

The folder ID is the part after `/folders/` in the Google Drive folder URL.

### 2. Configure the website

Open `imagekit-config.js` and replace `PASTE_YOUR_UPDATED_APPS_SCRIPT_WEB_APP_URL_HERE` with the Apps Script Web App URL.

The file name is kept for compatibility with the existing project, but the read-only Drive gallery no longer uploads to ImageKit.

### 3. Google Drive image access

The Apps Script account needs permission to read the folder.

For image previews to load for visitors who are not signed in to your Google account, the image files must be viewable by link. **That also means someone with a direct Drive image link may be able to view that image without entering the website password.** The website password is a basic front-door lock, not strong protection for private files. Do not use this setup for sensitive images.

### 4. Publish and test

1. Commit the files to the `main` branch.
2. Wait for GitHub Pages to publish.
3. Open the site and enter the password.
4. Check that images and subfolder images appear.
5. Test the Refresh and Lock buttons.

## Features

- Password prompt before the gallery is shown.
- Password stored in Apps Script Script Properties, not in the GitHub website files.
- Temporary six-hour server-side viewing session.
- Lists images from the selected Drive folder and its subfolders.
- Refreshes the image list from Drive.
- Opens the original Drive file when an image is selected.
- No upload, edit, or delete controls on the website.

## Security and limitations

- The password is checked by Apps Script and is not hardcoded in the public website source. The login request still sends it to the Apps Script endpoint over HTTPS, so this is suitable only as a basic private-community gate, not high-security authentication.
- If Drive files are shared as "Anyone with the link", direct file links can bypass the website password.
- The Apps Script Web App must be deployed with access set to Anyone so the GitHub Pages site can contact it.
- Google Apps Script and Google Drive have quotas and service limits.
- Do not store sensitive or confidential images in this gallery.
