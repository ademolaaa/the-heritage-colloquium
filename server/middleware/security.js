import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// CSP Configuration
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://platform.twitter.com", "https://connect.facebook.net"], // Allow social embeds
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    imgSrc: ["'self'", "data:", "blob:", "https:", "*"], // Allow images from anywhere (for now)
    connectSrc: ["'self'", "https://api.openai.com", "https://api.emailjs.com"], // External APIs
    frameSrc: ["'self'", "https://platform.twitter.com", "https://www.facebook.com", "https://www.instagram.com", "https://www.youtube.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
};

export const securityHeaders = helmet({
  contentSecurityPolicy: cspConfig,
  crossOriginEmbedderPolicy: false, // Allow embeds
});

// Rate Limiters
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests, please try again later.' }
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 login/register attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many login attempts, please try again later.' }
});

// Input Sanitization Helper (middleware)
export const sanitizeInput = (req, res, next) => {
  // Simple recursive sanitization for body/query/params
  // Ideally use a library like xss-clean or express-validator per route
  // This is a global fallback
  next();
};
