/**
 * Password hash generator.
 * Usage:  node api/_lib/hash.js "your-new-password"
 * Copy the output into the MJ_ADMIN_PASSWORD_HASH environment variable in Vercel.
 */
import crypto from 'crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node api/_lib/hash.js "your-new-password"');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256');
console.log(`pbkdf2$${salt.toString('hex')}$${hash.toString('hex')}`);
