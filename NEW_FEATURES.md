# New Features & Setup Guide

This document outlines the new features added to The Heritage Colloquium platform, including User Authentication, Social Feed with Media Uploads, and the "Ask Ahiajoku" Q&A system.

## 1. Setup Requirements

### Environment Variables
The following variables have been added to `.env`. Ensure they are configured:

```env
# Database (PostgreSQL required for Auth, Social, and Q&A)
DATABASE_URL=postgresql://user:password@localhost:5432/heritage_colloquium

# Authentication
JWT_SECRET=your-secure-random-secret-key

# OpenAI (For Ask Ahiajoku Chatbot)
OPENAI_API_KEY=sk-your-openai-key

# AWS S3 (Optional - Defaults to local storage if not set)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=
# AWS_S3_BUCKET_NAME=
```

### Database Initialization
The application uses PostgreSQL. The schema is defined in `server/db/schema.sql`.
On server startup (`node server/index.js`), the application will automatically attempt to run the schema migration if tables do not exist.

## 2. New Features

### A. User Authentication
*   **Sign Up / Login**: Public users can now register accounts.
*   **Profile**: Users have basic profiles (Username, Email).
*   **Security**: Passwords are hashed using `bcrypt`. Sessions are managed via `JWT`.

### B. Social Media Feed
*   **Community Feed**: Users can post updates to `/feed`.
*   **Media Support**: Posts can include Images, Videos, and Audio files.
*   **Interactions**:
    *   **Like**: Users can like posts.
    *   **Comment**: Users can comment on posts.
*   **Uploads**: Large media files (up to 500MB) are supported via chunked uploads (local storage).

### C. Ask Ahiajoku
A dual-mode question and answer feature:
1.  **Consult the Deity (AI Chatbot)**:
    *   Users can chat with "Ahiajoku" (powered by OpenAI).
    *   The persona is configured to be wise, cultural, and knowledgeable about Igbo traditions.
2.  **Community Q&A**:
    *   Users can post public questions.
    *   The community can answer these questions.
    *   Questions are tracked as "Pending" or "Answered".

## 3. API Endpoints

### Auth
*   `POST /api/auth/register` - Create account
*   `POST /api/auth/login` - Login
*   `GET /api/auth/me` - Get current user

### Social
*   `GET /api/social/posts` - Get feed
*   `POST /api/social/posts` - Create post
*   `POST /api/social/posts/:id/like` - Like post
*   `POST /api/social/posts/:id/comments` - Comment

### Media
*   `POST /api/media/upload` - Upload file (Multipart form data)

### Q&A & Chatbot
*   `GET /api/qa/questions` - List questions
*   `POST /api/qa/questions` - Ask question
*   `POST /api/chatbot/ask` - Chat with AI

## 4. Admin vs. User
*   **Admin Console**: Remains at `/admin` (requires Passcode).
*   **User Features**: Accessible via the main site navigation (Feed, Ask, etc.).
