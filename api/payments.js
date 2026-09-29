/**
 * /api/payments — admin only. CommonJS.
 *
 * GET                → { payments: [...] }
 * PATCH ?id=TXN-1043 { status }  — one of pending|paid|failed|refunded
 */
const { readData, writeData, cors, parseBody } = require('./_lib/data.js');
const { requireAdmin } = require('./_lib/auth.js');

const STATUSES = ['pending', 'paid', 'failed', 'refunded'];

async function handler(req, res) {
  if (cors(req, res)) return;

  const session = requireAdmin(req, res);
  if (!session) return;

  const data = await readData();

  if (req.method === 'GET') {
    return res.status(200).json({ payments: data.payments });
  }

  if (req.method === 'PATCH') {
    const id = req.query.id;
    const txn = data.payments.find(p => p.id === id);
    if (!txn) return res.status(404).json({ error: `Transaction ${id} not found` });

    const body = parseBody(req);
    if (!body.status || !STATUSES.includes(body.status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }
    txn.status = body.status;
    await writeData(data);
    return res.status(200).json({ ok: true, payment: txn });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
