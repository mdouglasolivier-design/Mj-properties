// Live end-to-end test of the MJ Properties backend
// Usage: node test-backend.mjs
const BASE = 'https://mj-properties-seven.vercel.app';

async function j(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

(async () => {
  let pass = 0, fail = 0;
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
    ok ? pass++ : fail++;
  };

  // 1. Bad login rejected
  const bad = await j('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrong' })
  });
  check('bad login rejected', bad.status === 401);

  // 2. Admin data requires auth
  const noauth = await j('/api/data');
  check('admin data requires auth', noauth.status === 401);

  // 3. Good login
  const login = await j('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'MjAdmin2026!' })
  });
  check('admin login', login.status === 200 && !!login.body.token);
  const token = login.body.token;
  const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  // 4. Admin data returns collections
  const data = await j('/api/data', { headers: auth });
  check('admin dataset loads', data.status === 200 && Array.isArray(data.body.bookings));
  const before = data.body.bookings.length;

  // 5. Guest booking (no auth) — cross-device flow
  const gb = await j('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Cross Device Guest', email: 'guest@test.com', phone: '+256700111222',
      property: 'Luxury Villa with Pool', checkin: '2026-12-20', checkout: '2026-12-23',
      guests: 2, message: 'E2E test booking'
    })
  });
  check('guest booking accepted', gb.status === 201 && /^BK-\d+$/.test(gb.body.booking.ref), gb.body.booking ? gb.body.booking.ref : JSON.stringify(gb.body));

  // 6. Booking appears in admin data (blob cache may lag ~60s)
  let found = null, data2 = null;
  for (let i = 0; i < 12; i++) {
    data2 = await j('/api/data', { headers: auth });
    found = data2.body.bookings.find(b => b.name === 'Cross Device Guest');
    if (found) break;
    process.stdout.write('  waiting for cache to settle...\n');
    await new Promise(r => setTimeout(r, 5000));
  }
  check('booking visible to admin', !!found, found ? found.ref : 'cache lag >60s');
  check('booking count grew', data2.body.bookings.length >= before + 1);

  // 7. Admin updates booking status
  const patched = await j('/api/bookings?ref=' + found.ref, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'confirmed' })
  });
  check('booking status update', patched.status === 200 && patched.body.booking.status === 'confirmed');

  // 8. Contact form intake
  const msg = await j('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'API Tester', email: 'tester@test.com', subject: 'E2E', message: 'Hello from the test suite' })
  });
  check('contact form accepted', msg.status === 201);

  // 9. Email endpoint — unconfigured SMTP returns a clear 503 (not a crash)
  const mail = await j('/api/email', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ to: 'guest@test.com', subject: 'Hi', text: 'Test' })
  });
  check('email endpoint responds', mail.status === 200 || mail.status === 503, 'status ' + mail.status);

  // 10. Cleanup: delete the test booking
  const del = await j('/api/bookings?ref=' + found.ref, { method: 'DELETE', headers: auth });
  check('cleanup booking', del.status === 200);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
