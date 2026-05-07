# API Documentation

## Base URL
`/api`

## Authentication
Admin endpoints require `x-admin-passcode` header.

## Media & Uploads

### Get Presigned URL (S3)
`POST /api/v1/media/presigned`
**Headers:** `x-admin-passcode`
**Body:**
```json
{
  "fileName": "example.jpg",
  "contentType": "image/jpeg"
}
```
**Response:**
```json
{
  "ok": true,
  "url": "https://s3.amazonaws.com/...",
  "key": "upload_...",
  "publicUrl": "https://..."
}
```

### Register Media
`POST /api/v1/media`
**Headers:** `x-admin-passcode`
**Body:**
```json
{
  "type": "image",
  "title": "Example",
  "url": "https://...",
  "s3Key": "upload_...",
  "sizeBytes": 1024,
  "mimeType": "image/jpeg"
}
```

## Social Feed

### List Posts
`GET /api/social/posts?limit=20&offset=0`

### Create Post
`POST /api/social/posts`
**Body:**
```json
{
  "content": "Hello world",
  "author": "User",
  "mediaId": "med_..."
}
```

### Like Post
`POST /api/social/posts/:id/like`

### Add Comment
`POST /api/social/posts/:id/comments`
**Body:**
```json
{
  "content": "Great post!",
  "author": "User"
}
```

## Ask Ahiajoku (Q&A)

### List Questions
`GET /api/qa/questions`

### Ask Question
`POST /api/qa/questions`
**Body:**
```json
{
  "title": "About the festival",
  "content": "When does it start?",
  "author": "Guest"
}
```

### Answer Question
`POST /api/qa/questions/:id/answers`
**Body:**
```json
{
  "content": "It starts on...",
  "author": "Admin"
}
```
