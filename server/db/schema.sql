-- Users (General Public)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(50) UNIQUE, -- Display name
  full_name VARCHAR(255),
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'user', -- user, admin, moderator
  is_verified BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id),
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users & Contributors
CREATE TABLE IF NOT EXISTS contributors (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50),
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Media Files (Uploads)
CREATE TABLE IF NOT EXISTS media (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50), -- image, video, audio, pdf, file
  title VARCHAR(255) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  file_path TEXT,
  s3_key TEXT,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  category VARCHAR(50),
  related_lecture_id VARCHAR(255),
  related_event_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'ready',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'scheduled',
  status_history JSONB DEFAULT '[]',
  media_id VARCHAR(255) REFERENCES media(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Lectures
CREATE TABLE IF NOT EXISTS lectures (
  id VARCHAR(255) PRIMARY KEY,
  year INTEGER,
  theme TEXT,
  speaker VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image TEXT,
  role VARCHAR(100),
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Publications
CREATE TABLE IF NOT EXISTS publications (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255),
  abstract TEXT,
  publish_date DATE,
  pdf_url TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Gallery
CREATE TABLE IF NOT EXISTS gallery (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255),
  description TEXT,
  media_id VARCHAR(255) REFERENCES media(id),
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Social Feed (Posts)
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255), -- Could be anonymous or linked to auth
  content TEXT,
  media_ids JSONB, -- Array of media IDs
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  is_approved BOOLEAN DEFAULT FALSE, -- Moderation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(255) PRIMARY KEY,
  post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Likes
CREATE TABLE IF NOT EXISTS likes (
  id VARCHAR(255) PRIMARY KEY,
  post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

-- Q&A (Ask Ahiajoku)
CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(255) PRIMARY KEY,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  content TEXT NOT NULL,
  category VARCHAR(50),
  is_answered BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS answers (
  id VARCHAR(255) PRIMARY KEY,
  question_id VARCHAR(255) REFERENCES questions(id) ON DELETE CASCADE,
  responder_name VARCHAR(255),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Site Settings
CREATE TABLE IF NOT EXISTS site_settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
