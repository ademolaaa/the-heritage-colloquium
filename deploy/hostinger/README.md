# Hostinger Deployment (File Manager + MySQL)

This repo is a Vite-built React site and can be deployed to Hostinger shared hosting as:
- Static frontend (upload `dist/` into `public_html/`)
- PHP + MySQL API (upload `api/` into `public_html/api/`) used by the Admin Console + site content loading
 - PHP media upload endpoint (uploading images/PDF/video from Admin) at `public_html/api/media/upload.php` storing files in `public_html/uploads/`

## 1) Create the MySQL database
In Hostinger hPanel:
1. Create a MySQL database and user
2. Open phpMyAdmin and import: `deploy/hostinger/schema.sql`

## 2) Configure the PHP API
On your computer:
1. Copy `api/config.example.php` → `api/config.php`
2. Edit `api/config.php` with your Hostinger DB credentials
3. Set `admin.default_passcode` to a strong passcode (this becomes the publishing passcode)

On Hostinger File Manager:
1. Upload the entire `api/` folder into `public_html/api/`
2. Create a folder `public_html/uploads/` (writable) for uploaded files
2. Confirm these endpoints work:
   - `https://YOURDOMAIN.com/api/health.php`
   - `https://YOURDOMAIN.com/api/content.php`
   - `https://YOURDOMAIN.com/api/media/upload.php` (POST only, requires x-admin-passcode)

## 3) Build and upload the frontend
On your computer:
1. `npm install`
2. `npm run hostinger:zip`

On Hostinger File Manager:
1. Upload `hostinger_upload.zip` into `public_html/` and extract it
2. Ensure `.htaccess` is included (it is produced from `public/.htaccess`)

## 4) Verify content + admin publishing
1. Visit your site in the browser
2. Open `https://YOURDOMAIN.com/#/admin`
3. If you set `VITE_ADMIN_PASSCODE` at build-time, unlock using that value (use the same value as your publishing passcode so the same input can unlock + publish + upload)
4. In “Database Publishing”, enter the **publishing passcode** you set in `api/config.php`
5. Click “Publish”

Notes:
- In production builds, the frontend defaults to same-origin endpoints:
  - Read: `/api/content.php`
  - Write: `/api/content.php`
  - Passcode change: `/api/admin/passcode.php`
- You can still override these via build-time env vars (`VITE_CONTENT_READ_URL`, `VITE_CONTENT_WRITE_URL`) if needed.
