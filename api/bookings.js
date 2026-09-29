/**
 * /api/bookings
 *
 * GET                       (admin) → { bookings: [...] }
 * POST   { name, email, phone, property, checkin, checkout, guests, message, total }
 *                           (public) → { ok, booking }  — guest booking flow
 * PATCH  ?ref=BK-1006 { status?, name?, phone?, checkin?, checkout? }
 *                           (admin) → { ok, booking }
 * DELETE ?ref=BK-1006       (admin) → { ok }
 */
import { readData, writeData, cors, parseBody } from './_lib/data.js';
import { requireAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const data = await readData();

  // ---------- Public: guest submits a booking ----------
  if (req.method === 'POST') {
    const body = parseBody(req);
    const required = ['name', 'email', 'phone', 'property', 'checkin', 'checkout'];
    const missing = required.filter(k => !body[k]);
    if (missing.length) {
      return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
    }
    if (String(body.checkout) <= String(body.checkin)) {
      return res.status(400).json({ error: 'Check-out must be after check-in' });
    }

    const maxNum = data.bookings.reduce((m, b) => {
      const n = parseInt(String(b.ref || '').replace('BK-', ''), 10) || 0;
      return Math.max(m, n);
    }, 1005);
    const ref = 'BK-' + (maxNum + 1);

    const booking = {
      ref,
      id: maxNum + 1,
      name: String(body.name).slice(0, 120),
      email: String(body.email).slice(0, 200),
      phone: String(body.phone).slice(0, 40),
      property: String(body.property).slice(0, 200),
      propertyId: body.propertyId || null,
      checkin: String(body.checkin).slice(0, 10),
      checkout: String(body.checkout).slice(0, 10),
      guests: parseInt(body.guests, 10) || 2,
      message: String(body.message || '').slice(0, 2000),
      total: body.total || null,
      status: 'pending',
      date: new Date().toISOString(),
      source: 'guest-api'
    };

    data.bookings.push(booking);
    await writeData(data);
    return res.status(201).json({ ok: true, booking });
  }

  // ---------- Admin routes below ----------
  const session = requireAdmin(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    return res.status(200).json({ bookings: data.bookings });
  }

  if (req.method === 'PATCH') {
    const ref = req.query.ref;
    const booking = data.bookings.find(b => b.ref === ref);
    if (!booking) return res.status(404).json({ error: `Booking ${ref} not found` });

    const body = parseBody(req);
    const allowed = ['status', 'name', 'phone', 'checkin', 'checkout'];
    let changed = false;
    for (const k of allowed) {
      if (body[k] !== undefined && body[k] !== booking[k]) {
        booking[k] = body[k];
        changed = true;
      }
    }
    if (!changed) return res.status(400).json({ error: 'Nothing to update' });

    await writeData(data);
    return res.status(200).json({ ok: true, booking });
  }

  if (req.method === 'DELETE') {
    const ref = req.query.ref;
    const idx = data.bookings.findIndex(b => b.ref === ref);
    if (idx === -1) return res.status(404).json({ error: `Booking ${ref} not found` });
    data.bookings.splice(idx, 1);
    await writeData(data);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
