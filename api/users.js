/**
 * /api/users — admin only. Also handles site settings.
 *
 * GET                         → { users, settings }
 * PATCH ?id=1 { name, email, phone, role }  → update user (incl. admin profile)
 * PATCH { settings: {...} }                 → update site settings
 */
import { readData, writeData, cors, parseBody } from './_lib/data.js';
import { requireAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const session = requireAdmin(req, res);
  if (!session) return;

  const data = await readData();

  if (req.method === 'GET') {
    return res.status(200).json({ users: data.users, settings: data.settings });
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);

    // Settings update path
    if (body.settings && typeof body.settings === 'object') {
      data.settings = { ...data.settings, ...body.settings };
      await writeData(data);
      return res.status(200).json({ ok: true, settings: data.settings });
    }

    // User update path
    const id = parseInt(req.query.id, 10);
    const user = data.users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: `User ${id} not found` });

    const allowed = ['name', 'email', 'phone', 'role'];
    let changed = false;
    for (const k of allowed) {
      if (body[k] !== undefined && body[k] !== user[k]) {
        if (k === 'role' && user.role === 'admin') continue; // never demote the admin via API
        user[k] = String(body[k]).slice(0, 200);
        changed = true;
      }
    }
    if (!changed) return res.status(400).json({ error: 'Nothing to update' });
    await writeData(data);
    return res.status(200).json({ ok: true, user });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
