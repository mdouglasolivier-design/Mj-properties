/**
 * /api/data — one-shot admin dataset (bookings, messages, reviews, payments, users, settings). CommonJS.
 *
 * GET    (admin) → full dataset
 * PATCH  (admin) — update any collection wholesale: body like { reviews: [...], payments: [...] }
 */
const { readData, writeData, cors, parseBody } = require('./_lib/data.js');
const { requireAdmin } = require('./_lib/auth.js');

const COLLECTIONS = ['bookings', 'messages', 'reviews', 'payments', 'users', 'settings', 'properties'];

async function handler(req, res) {
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
    const changed = [];
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

module.exports = handler;
