<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# The Heritage Colloquium

Luxury, high-ticket cultural institution site with a passcode-gated Admin console.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Admin

- Admin URL: `/#/admin`
- Default passcode: `heritage-admin`
- To change passcode, set `VITE_ADMIN_PASSCODE` (see [.env.example](.env.example))

## Content “Database” (Optional)

By default, Admin edits are saved locally (in the browser). For a shared multi-device setup, run the included Content API and point Admin to it.

### Run Content API locally

1. Create an env file (example): copy `.env.example` to `.env` and set:
   - `ADMIN_PASSCODE`
   - `PORT` (optional)
2. Start API:
   `npm run server`
3. In your Vite env (e.g. `.env.local`), set:
   - `VITE_CONTENT_READ_URL=http://localhost:8787/api/content`
   - `VITE_CONTENT_WRITE_URL=http://localhost:8787/api/content`
4. Restart `npm run dev`, open Admin and use “Pull/Publish”.

### Hostinger deployment (quick static)

This project uses `HashRouter`, so you can host it as a static site without special rewrite rules.

1. Build:
   `npm run build`
2. Upload the `dist/` folder contents to Hostinger `public_html/`
3. Visit your domain.

### Hostinger + Database (shared content)

Hostinger “shared hosting” is usually PHP-first. For a true database-backed Admin, the simplest path is:

- **Option A (Recommended): Hostinger VPS / Node hosting**
  - Deploy this Content API (`npm run server`) on the VPS (PM2 recommended)
  - Set `ADMIN_PASSCODE` on the server
  - Point the frontend to your server using `VITE_CONTENT_READ_URL` and `VITE_CONTENT_WRITE_URL`

- **Option B: Keep Hostinger static + external DB**
  - Host the frontend on Hostinger (static)
  - Run the Content API on a VPS (Hostinger VPS or any provider)

Security note: the Content API requires `x-admin-passcode` for writes. Use HTTPS and a strong passcode.
