# Security Architecture & Procedures

This document outlines the security measures implemented in the Heritage Colloquium platform, along with procedures for incident response and maintenance.

## 1. Security Configurations

### 1.1 Transport Security
*   **HTTPS**: Must be enforced at the infrastructure level (Reverse Proxy, Load Balancer, or Hosting Provider like Render/Railway).
*   **HSTS**: Enabled via Helmet middleware to force browsers to use HTTPS.

### 1.2 Content Security Policy (CSP)
Implemented via `helmet` in `server/middleware/security.js`.
*   **Directives**: Restricts script sources to 'self' and trusted domains (Twitter, Facebook).
*   **Embeds**: Allowed for social media integration.

### 1.3 Rate Limiting
Implemented via `express-rate-limit`.
*   **Global Limit**: 500 requests per 15 minutes per IP.
*   **Auth Limit**: 10 login/register attempts per hour per IP.

### 1.4 Authentication & Session Management
*   **Passwords**:
    *   Hashed using `bcrypt` (salt rounds: 10).
    *   Minimum complexity: 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.
*   **Tokens**: JWT (JSON Web Tokens) signed with `HS256`.
*   **2FA**: Time-based One-Time Password (TOTP) supported via `speakeasy`.
*   **Session**: Stateless JWTs. Short-lived access tokens recommended (currently configurable via `JWT_EXPIRES_IN` in `.env` if added, default 7 days).

### 1.5 Input Validation
*   **Sanitization**: Basic input sanitization middleware.
*   **SQL Injection**: Prevented via parameterized queries (`pg` library).

### 1.6 Audit Logging
*   **Storage**: `audit_logs` table in PostgreSQL.
*   **Events Logged**: Login success/failure, Registration, 2FA setup/verify.
*   **Data**: User ID, IP Address, User Agent, Action Type, Details (JSON).

## 2. Incident Response Procedures

### 2.1 Breach Detection
*   Monitor `audit_logs` for suspicious activities (e.g., multiple failed logins from same IP).
*   Check server logs (`pm2 logs`) for unhandled exceptions or rate limit warnings.

### 2.2 Response Steps
1.  **Containment**:
    *   Block suspicious IPs at the firewall/WAF level (Cloudflare/AWS WAF).
    *   Revoke compromised JWTs (requires implementing a token blacklist or rotating `JWT_SECRET`).
2.  **Eradication**:
    *   Patch vulnerabilities.
    *   Reset compromised user passwords.
3.  **Recovery**:
    *   Restore database from backups if data integrity is compromised.
    *   Notify affected users.

## 3. Regular Security Updates

### 3.1 Dependency Audits
Run `npm audit` weekly to identify vulnerable packages.
```bash
npm audit
npm update
```

### 3.2 Penetration Testing
*   **Frequency**: Quarterly or after major feature releases.
*   **Scope**: Auth endpoints, File Uploads, Social Feed inputs.

## 4. Configuration Reference (`.env`)

Ensure these are set in production:

```env
NODE_ENV=production
JWT_SECRET=<strong_random_string_min_32_chars>
# Cookie settings if moved to cookies
COOKIE_SECRET=<another_strong_secret>
```

## 5. Web Application Firewall (WAF)
Recommended to use **Cloudflare** (Free Tier) in front of the application to provide:
*   DDoS Protection.
*   Bot Management.
*   Geo-blocking.
