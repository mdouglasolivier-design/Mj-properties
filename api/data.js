/**
 * /api/data — one-shot admin dataset (bookings, messages, reviews, payments, users, settings).
 *
 * GET    (admin) → full dataset
 * PATCH  (admin) — update any collection wholesale: body like { reviews: [...], payments: [...] }
 */
import { readData, writeData, cors, parseBody } from './_lib/data.js';
import { requireAdmin } from './_lib/auth.js';

const COLLECTIONS = ['bookings', 'messages', 'reviews', 'payments', 'users', 'settings'];

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const session = requireAdmin(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const data = await readData();
    const out = {};
    for (const c of COLLECTIONS) out[c] = data[c];
    return res.status(200).json(out);
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const data = await readData();
    let changed = [];
    for (const c of COLLECTIONS) {
      if (Array.isArray(body[c])) {
        data[c] = body[c];
        changed.push(c);
      } else if (c === 'settings' && body.settings && typeof body.settings === 'object') {
        data.settings = { ...data.settings, ...body.settings };
        changed.push('settings');
      }
    }
    if (!changed.length) return res.status(400).json({ error: 'No valid collections in body' });
    await writeData(data);
    return res.status(200).json({ ok: true, changed });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
