/**
 * /api/auth — server-side admin login.
 *
 * POST { username, password }  → { token, user }   (sets httpOnly cookie too)
 * GET                          → { user }          (validates Bearer token)
 * DELETE                       → 204 (logout)
 */
import { readData, writeData, cors, parseBody } from '../_lib/data.js';
import { createSession, verifySession, verifyPassword, getSecret, getAdminCredentials, requireAdmin } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Validate current session
  if (req.method === 'GET') {
    const session = requireAdmin(req, res);
    if (!session) return;
    const data = await readData();
    const user = data.users.find(u => u.role === 'admin');
    return res.status(200).json({ user: user || null });
  }

  // Login
  if (req.method === 'POST') {
    const { username, password } = parseBody(req);
    const creds = getAdminCredentials();

    if (username !== creds.username || !password || !verifyPassword(password, creds.passwordHash)) {
      // Small delay to blunt brute-force attempts
      await new Promise(r => setTimeout(r, 400));
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = createSession(creds.username, getSecret());
    res.setHeader('Set-Cookie', `mj_session=${token}; HttpOnly; Path=/; Max-Age=43200; SameSite=Lax`);
    return res.status(200).json({ token });
  }

  // Logout
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', 'mj_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
