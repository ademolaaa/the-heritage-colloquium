import crypto from 'node:crypto';

/**
 * A stateless admin authentication library that uses environment variables.
 * This ensures compatibility with Vercel/Serverless where the filesystem is read-only.
 */
export function createAdminAuth({ envPasscode }) {
  // Use the environment variable as the source of truth
  const defaultPasscode = envPasscode || 'heritage-admin';

  async function verifyAdminPasscode(passcode) {
    if (!passcode) return false;
    
    // Simple timing-safe comparison
    // In a production app, you might want to hash this, but since it's 
    // coming from an environment variable (already secure), 
    // a direct comparison is often used for simple admin tokens.
    try {
      return crypto.timingSafeEqual(
        Buffer.from(String(passcode)),
        Buffer.from(String(defaultPasscode))
      );
    } catch (e) {
      // Handle buffer length mismatch
      return String(passcode) === String(defaultPasscode);
    }
  }

  async function rotatePasscode() {
    return { 
      ok: false, 
      error: 'Passcode rotation is disabled in Serverless mode. Please update the ADMIN_PASSCODE variable in your Vercel dashboard.' 
    };
  }

  return { verifyAdminPasscode, rotatePasscode };
}
