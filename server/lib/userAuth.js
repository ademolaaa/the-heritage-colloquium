import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { jsonError } from './http.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-prod';

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

import { createClient } from '@supabase/supabase-js';
import { db } from './postgres.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export async function authenticateToken(token) {
  // 1. Try local custom JWT
  try {
    const localUser = jwt.verify(token, JWT_SECRET);
    if (localUser) return localUser;
  } catch (err) {
    // Ignore and try Supabase next
  }

  // 2. Try Supabase JWT
  if (supabase) {
    try {
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
      if (!error && supabaseUser) {
        const adminEmailsRaw = process.env.VITE_ADMIN_EMAILS || '';
        const role = adminEmailsRaw.split(',').map(e => e.trim().toLowerCase()).includes(supabaseUser.email.toLowerCase()) ? 'admin' : 'user';
        
        const username = supabaseUser.user_metadata?.username || supabaseUser.email.split('@')[0];
        const fullName = supabaseUser.user_metadata?.full_name || null;
        const avatarUrl = supabaseUser.user_metadata?.avatar_url || null;
        const dummyPasswordHash = '$2b$10$6R6xGpe.wBvB3C3.T7uPKeW7xNuC5nJqNfK9.rJbQyO9P2Rz21Dqy'; // dummy bcrypt hash

        const query = `
          INSERT INTO users (id, email, password_hash, username, full_name, avatar_url, role, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (email) DO UPDATE SET
            username = COALESCE(users.username, EXCLUDED.username),
            full_name = COALESCE(users.full_name, EXCLUDED.full_name),
            avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url),
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, email, username, full_name, avatar_url, role;
        `;
        
        const result = await db.query(query, [
          supabaseUser.id,
          supabaseUser.email.toLowerCase(),
          dummyPasswordHash,
          username,
          fullName,
          avatarUrl,
          role
        ]);

        if (result.rowCount > 0) {
          const syncedUser = result.rows[0];
          return {
            id: syncedUser.id,
            email: syncedUser.email,
            username: syncedUser.username,
            full_name: syncedUser.full_name,
            avatar_url: syncedUser.avatar_url,
            role: syncedUser.role
          };
        }
      }
    } catch (e) {
      console.error('Failed to sync Supabase user:', e);
    }
  }

  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonError(res, 401, 'Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const user = await authenticateToken(token);

    if (!user) {
      return jsonError(res, 401, 'Invalid or expired token');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const user = await authenticateToken(token);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
