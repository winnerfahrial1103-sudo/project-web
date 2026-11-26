import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

/**
 * Resolve runtime directories dynamically from environment when needed.
 * On Vercel Serverless, /var/task is read-only so fallback to os.tmpdir().
 */
export function getPaths() {
  const dataDir = process.env.CAMILLA_DATA_DIR
    ? path.resolve(process.env.CAMILLA_DATA_DIR)
    : process.env.VERCEL
      ? path.join(os.tmpdir(), 'camilla-store-data')
      : path.join(ROOT_DIR, 'data');
  const uploadsDir = path.join(dataDir, 'uploads');
  const storeFile = path.join(dataDir, 'store.json');
  return { dataDir, uploadsDir, storeFile };
}

export function getKvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

export const PORT = Number(process.env.PORT) || 3456;
export const DEFAULT_ADMIN_PASSWORD = process.env.CAMILLA_ADMIN_PASSWORD || 'camilla123';
export const SESSION_COOKIE_NAME = 'camilla_admin_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Hash a plaintext password using scrypt with a random salt.
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

/**
 * Verify a plaintext password against a stored `salt:hash` string in constant time.
 */
export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(keyHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

/**
 * Create a signed HMAC session token containing expiration timestamp.
 */
export function createSessionToken(secret) {
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', exp: Date.now() + SESSION_TTL_MS })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify a signed session token and ensure it has not expired.
 */
export function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed?.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}
