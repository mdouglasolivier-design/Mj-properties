/**
 * /api/messages — CommonJS.
 *
 * POST { name, email, phone?, subject?, message }   (public — contact form)
 * GET                                               (admin) → { messages: [...] }
 * PATCH  ?id=3 { status }                           (admin) → { ok, message }
 * DELETE ?id=3                                      (admin)
 */
const { readData, writeData, cors, parseBody } = require('./_lib/data.js');
const { requireAdmin } = require('./_lib/auth.js');

async function handler(req, res) {
  if (cors(req, res)) return;
  const data = await readData();

  // ---------- Public: contact form ----------
  if (req.method === 'POST') {
    const body = parseBody(req);
    const required = ['name', 'email', 'message'];
    const missing = required.filter(k => !body[k]);
    if (missing.length) {
      return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
    }

    const id = data.messages.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    const message = {
      id,
      data: {
        name: String(body.name).slice(0, 120),
        email: String(body.email).slice(0, 200),
        phone: body.phone ? String(body.phone).slice(0, 40) : '',
        subject: body.subject ? String(body.subject).slice(0, 200) : 'Website inquiry',
        message: String(body.message).slice(0, 5000)
      },
      type: 'contact',
      date: new Date().toISOString(),
      status: 'new'
    };

    data.messages.push(message);
    await writeData(data);
    return res.status(201).json({ ok: true, id: message.id });
  }

  // ---------- Admin ----------
  const session = requireAdmin(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    return res.status(200).json({ messages: data.messages });
  }

  if (req.method === 'PATCH') {
    const id = parseInt(req.query.id, 10);
    const message = data.messages.find(m => m.id === id);
    if (!message) return res.status(404).json({ error: `Message ${id} not found` });

    const body = parseBody(req);
    if (body.status && ['new', 'read'].includes(body.status)) {
      message.status = body.status;
      await writeData(data);
      return res.status(200).json({ ok: true, message });
    }
    return res.status(400).json({ error: 'Nothing to update' });
  }

  if (req.method === 'DELETE') {
    const id = parseInt(req.query.id, 10);
    const idx = data.messages.findIndex(m => m.id === id);
    if (idx === -1) return res.status(404).json({ error: `Message ${id} not found` });
    data.messages.splice(idx, 1);
    await writeData(data);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
