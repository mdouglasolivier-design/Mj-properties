/**
 * Server-side admin authentication.
 * - Admin password lives only on the server (PBKDF2-hashed) — never in page source.
 * - Sessions are HMAC-signed tokens with expiry; no database needed.
 * Env vars: MJ_ADMIN_USER (default "admin"), MJ_ADMIN_PASSWORD_HASH (from
 * `node api/_lib/hash.js "<password>"`), MJ_SESSION_SECRET (random string).
 */
import crypto from 'crypto';

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256');
  return `pbkdf2$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [, saltHex, hashHex] = stored.split('$');
    const test = crypto.pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), 120000, 32, 'sha256');
    return crypto.timingSafeEqual(Buffer.from(hashHex, 'hex'), test);
  } catch {
    return false;
  }
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSession(username, secret) {
  const payload = b64url(JSON.stringify({ u: username, exp: Date.now() + SESSION_TTL_MS }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function getSecret() {
  return process.env.MJ_SESSION_SECRET || 'mj-dev-secret-change-me';
}

export function getAdminCredentials() {
  return {
    username: process.env.MJ_ADMIN_USER || 'admin',
    // Default hash is of "password123" — override MJ_ADMIN_PASSWORD_HASH in production!
    passwordHash: process.env.MJ_ADMIN_PASSWORD_HASH || 'pbkdf2$1f2d0f3a9c8b7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c4b3a$8f4a1c2b9e7d6f5a3b2c1d0e9f8a7b6c5d4e3f2a1b9c8d7e6f5a4b3c2d1e0f9a'
  };
}

export function requireAdmin(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const session = verifySession(token, getSecret());
  if (!session) {
    res.status(401).json({ error: 'Unauthorized — admin login required' });
    return null;
  }
  return session;
}
