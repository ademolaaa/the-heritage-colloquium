<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# The Heritage Colloquium

A luxury, high-ticket cultural institution website built with React, Vite, and Express. Designed for seamless deployment on **Vercel** with a **Supabase** backend.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/the-heritage-colloquium.git
   cd the-heritage-colloquium
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup Environment Variables:
   Copy `.env.example` to `.env` and fill in your Supabase credentials.
   ```bash
   cp .env.example .env
   ```

4. Run locally:
   ```bash
   # Start frontend (Vite)
   npm run dev

   # Start backend (Express)
   npm run server
   ```

## 🛠 Tech Stack
- **Frontend**: React 19, Vite, Framer Motion, Tailwind CSS
- **Backend**: Node.js, Express, PostgreSQL (via Supabase)
- **Database/Auth**: Supabase
- **Hosting**: Vercel

## ☁️ Deployment

### Vercel (Frontend)
The project is optimized for Vercel. Simply connect your GitHub repository to Vercel and it will auto-detect the Vite build.
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Supabase (Database)
1. Create a new project on [Supabase](https://supabase.com/).
2. Run the schema in `server/db/schema.sql` (if available) or use Supabase's table builder.
3. Copy your `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` to your Vercel Environment Variables.

## 🔐 Admin Console
- **URL**: `/#/admin`
- **Default Passcode**: Set via `ADMIN_PASSCODE` in environment variables.

## 📄 License
This project is for cultural and educational purposes.
