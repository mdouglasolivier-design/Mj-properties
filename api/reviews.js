/**
 * /api/reviews — CommonJS.
 *
 * POST { guest, property, rating, text }   (public — guest review submission)
 * GET                                      (admin) → { reviews: [...] }
 * PATCH ?id=2 { status }                   (admin) — publish/hide
 * DELETE ?id=2                             (admin)
 */
const { readData, writeData, cors, parseBody } = require('./_lib/data.js');
const { requireAdmin } = require('./_lib/auth.js');

async function handler(req, res) {
  if (cors(req, res)) return;
  const data = await readData();

  if (req.method === 'POST') {
    const body = parseBody(req);
    const required = ['guest', 'property', 'rating', 'text'];
    const missing = required.filter(k => body[k] === undefined || body[k] === '');
    if (missing.length) {
      return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
    }
    const rating = parseInt(body.rating, 10);
    if (!(rating >= 1 && rating <= 5)) {
      return res.status(400).json({ error: 'Rating must be 1-5' });
    }

    const id = data.reviews.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    const review = {
      id,
      guest: String(body.guest).slice(0, 120),
      property: String(body.property).slice(0, 200),
      rating,
      text: String(body.text).slice(0, 2000),
      date: new Date().toISOString().slice(0, 10),
      status: 'pending'
    };
    data.reviews.push(review);
    await writeData(data);
    return res.status(201).json({ ok: true, review });
  }

  const session = requireAdmin(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    return res.status(200).json({ reviews: data.reviews });
  }

  if (req.method === 'PATCH') {
    const id = parseInt(req.query.id, 10);
    const review = data.reviews.find(r => r.id === id);
    if (!review) return res.status(404).json({ error: `Review ${id} not found` });
    const body = parseBody(req);
    if (body.status && ['pending', 'published', 'hidden'].includes(body.status)) {
      review.status = body.status;
      await writeData(data);
      return res.status(200).json({ ok: true, review });
    }
    return res.status(400).json({ error: 'Nothing to update' });
  }

  if (req.method === 'DELETE') {
    const id = parseInt(req.query.id, 10);
    const idx = data.reviews.findIndex(r => r.id === id);
    if (idx === -1) return res.status(404).json({ error: `Review ${id} not found` });
    data.reviews.splice(idx, 1);
    await writeData(data);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
