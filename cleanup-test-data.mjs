/**
 * One-time cleanup: removes test bookings created during E2E testing.
 * Usage: node cleanup-test-data.mjs
 * Keeps only the 5 seeded bookings (BK-1001 … BK-1005).
 */
const BASE = 'https://mj-properties-seven.vercel.app';

async function j(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  return res.json();
}

(async () => {
  const login = await j('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'MjAdmin2026!' })
  });
  if (!login.token) { console.error('Login failed'); process.exit(1); }
  const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token };

  const data = await j('/api/data', { headers: auth });
  const keep = ['BK-1001', 'BK-1002', 'BK-1003', 'BK-1004', 'BK-1005'];
  const removed = data.bookings.filter(b => !keep.includes(b.ref)).map(b => b.ref);
  data.bookings = data.bookings.filter(b => keep.includes(b.ref));

  // Also drop the E2E test message
  const beforeMsgs = data.messages.length;
  data.messages = data.messages.filter(m => !(m.data && m.data.email === 'tester@test.com'));

  const res = await fetch(BASE + '/api/data', {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ bookings: data.bookings, messages: data.messages })
  });
  const out = await res.json();
  console.log('cleanup:', out.ok ? 'done' : out.error, '| removed bookings:', removed.join(', ') || 'none', '| removed messages:', beforeMsgs - data.messages.length);
})();
