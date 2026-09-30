/**
 * /api/properties — public catalog of properties (no auth needed to read).
 *
 * GET  → { properties: [...] }   (used by the home page & properties page)
 */
const { readData, cors } = require('./_lib/data.js');

async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const data = await readData();
  return res.status(200).json({ properties: data.properties || [] });
}

module.exports = handler;
