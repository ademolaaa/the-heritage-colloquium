# Deployment Guide

## Prerequisites
- Node.js 18+
- Docker & Docker Compose (optional but recommended)
- AWS Account (for S3)

## Environment Variables
Create a `.env` file based on `.env.example`:
```bash
PORT=8787
ADMIN_PASSCODE=your-secret-passcode
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_REGION=us-east-1
```

## Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev:full
   ```
   This runs both the Vite frontend and the Node.js backend.

## Production Deployment (Docker)
1. Build and start the container:
   ```bash
   docker-compose up -d --build
   ```
2. The application will be available at `http://localhost:8787`.

## Production Deployment (Manual)
1. Build the frontend:
   ```bash
   npm run build:local
   ```
2. Start the server:
   ```bash
   node server/index.js
   ```

## Infrastructure Notes
- **Database:** Currently uses a JSON-based file store in `server/db/`. For high-traffic production, migrate to PostgreSQL or MongoDB.
- **Object Storage:** Configured for AWS S3. Ensure your IAM user has `PutObject` and `GetObject` permissions.
- **Scaling:** The current Node.js server is stateless (except for the local JSON DB). To scale horizontally, you **MUST** migrate the database to an external service (RDS/Cloud SQL) and use a shared Redis for session/cache.
