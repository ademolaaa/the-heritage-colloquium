# Infrastructure Upgrade Design for Site oo (Heritage Colloquium)

## 1. Overview
This document outlines the architectural upgrade for the "Heritage Colloquium" platform ("site oo") to support high traffic, large media uploads, social features, and a Q&A module. The goal is to transition from a monolithic/shared hosting architecture to a scalable, cloud-native architecture on a VPS or Cloud environment.

## 2. Hosting Requirements (Whogohost)
To support the features below (Node.js, Redis, Background Workers, FFmpeg), **Shared Hosting is insufficient**.
**Recommended Plan:** Whogohost **Linux VPS (NG-VPS)** or **Cloud Server**.
- **Minimum Specs:** 4GB RAM, 2 vCPU, 80GB SSD.
- **OS:** Ubuntu 22.04 LTS.
- **Why:** 
  - Shared hosting cannot run persistent Node.js processes or Redis.
  - Media processing (FFmpeg) requires significant CPU not available on shared plans.
  - Horizontal scaling requires full root access to configure load balancers and multiple service instances.

## 3. Architecture Diagram (Conceptual)
```
[User Browser] <--> [CDN (CloudFront/Cloudflare)] <--> [Load Balancer (Nginx)]
                                                        |
                                       -----------------------------------
                                       |                                 |
                                [API Cluster (Node.js)]            [Media Worker Cluster]
                                       |            |                    |
                                       |            |                    |
                                 [Redis Cache]   [Database]        [Object Storage (S3/GCS)]
                                 (Sessions/Data) (PostgreSQL)      (Media Files)
```

## 4. Core Components

### 3.1 Frontend (React + Vite)
- **Modifications:**
  - Enhance `UploadWidget` to use Presigned URLs for direct-to-S3 uploads (bypassing server bottleneck).
  - Implement `SocialFeed` component with infinite scroll and real-time updates (via polling or WebSocket).
  - Implement `AskAhiajoku` component for Q&A.
- **Deployment:** Static hosting on Vercel/Netlify or served via Nginx in Docker.

### 3.2 Backend API (Node.js/Express)
- **Modifications:**
  - **Horizontal Scaling:** Stateless API design. Session store in Redis.
  - **Database:** Migrate from JSON/MySQL to **PostgreSQL** for better relational data integrity (Social Graph, complex queries).
  - **Caching:** Implement Redis for caching frequent queries (e.g., Feed, Media list).
  - **Uploads:** Generate Presigned URLs for client-side upload to S3.
  - **Authentication:** JWT or Session-based auth (persisted in Redis).

### 3.3 Media Processing (Worker Service)
- **Technology:** Node.js + BullMQ (Redis-based queue) + FFmpeg/Sharp.
- **Responsibilities:**
  - Listen for "File Uploaded" events (via S3 Event Notifications or API webhook).
  - Generate thumbnails for images and videos.
  - Transcode video to HLS/DASH for adaptive streaming.
  - Optimize images (WebP/AVIF).

### 3.4 Data Storage
- **Primary DB:** PostgreSQL (managed RDS or Cloud SQL).
  - Tables: `Users`, `Media`, `Posts`, `Comments`, `Likes`, `Questions`, `Answers`.
- **Object Storage:** AWS S3 or Google Cloud Storage.
  - Buckets: `raw-uploads`, `processed-media`.
- **Cache:** Redis (ElastiCache or Memorystore).

## 4. Feature Specifications

### 4.1 Secure Media Upload
- **Flow:**
  1. Client requests upload URL from API -> API validates request & returns S3 Presigned URL.
  2. Client uploads file directly to S3.
  3. S3 triggers Lambda/Worker -> Worker processes file -> Updates DB status to "ready".

### 4.2 Social Feed
- **Data Model:**
  - `Post` (User, Content, MediaID, Timestamp)
  - `Like` (User, Post)
  - `Comment` (User, Post, Content)
- **Performance:**
  - Pagination (Cursor-based).
  - Caching of popular feeds in Redis.

### 4.3 ASK Ahiajoku (Q&A)
- **Data Model:**
  - `Question` (User, Content, Status[Pending/Answered], Category)
  - `Answer` (Admin/Expert, Content, QuestionID)
- **Features:** Searchable knowledge base.

## 5. Deployment Strategy
- **Containerization:** Docker for all services (API, Worker, Frontend-Server).
- **Orchestration:** Docker Compose (Local/VPS) or Kubernetes (Production Scale).
- **CI/CD:** GitHub Actions to build and push images.

## 6. Security
- **Rate Limiting:** Implement rate limiting on API endpoints (Redis-based).
- **Input Validation:** Strict validation using Zod/Joi.
- **Content Moderation:** Integration with AWS Rekognition or similar for automated moderation of uploads.
