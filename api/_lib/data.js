/**
 * Shared data layer for all MJ Properties API routes.
 * Stores the whole dataset as one JSON document in Vercel Blob
 * (private access — only the server can read it). CommonJS so Vercel
 * bundles it correctly with each serverless function.
 */
const { put, get } = require('@vercel/blob');

const DATA_KEY = 'mj-data-v1';

// Warm-instance cache: avoids a blob round-trip on every request.
let cache = null;

function seedDefaults() {
  return {
    bookings: [
      { ref: 'BK-1001', id: 1001, name: 'Sarah K.', phone: '+256772123456', property: 'Luxury Villa with Pool', propertyId: 1, checkin: '2026-10-05', checkout: '2026-10-08', guests: 2, status: 'confirmed', date: '2026-09-20T09:00:00Z' },
      { ref: 'BK-1002', id: 1002, name: 'David M.', phone: '+256783456789', property: 'Modern Apartment in City Center', propertyId: 2, checkin: '2026-10-10', checkout: '2026-10-13', guests: 2, status: 'pending', date: '2026-09-22T09:00:00Z' },
      { ref: 'BK-1003', id: 1003, name: 'Aisha N.', phone: '+256701234890', property: 'Beachfront Cottage', propertyId: 3, checkin: '2026-10-15', checkout: '2026-10-18', guests: 4, status: 'confirmed', date: '2026-09-24T09:00:00Z' },
      { ref: 'BK-1004', id: 1004, name: 'James T.', phone: '+256758765432', property: 'Family House with Garden', propertyId: 4, checkin: '2026-10-20', checkout: '2026-10-24', guests: 6, status: 'confirmed', date: '2026-09-25T09:00:00Z' },
      { ref: 'BK-1005', id: 1005, name: 'Grace A.', phone: '+256702345678', property: 'Luxury Villa with Pool', propertyId: 1, checkin: '2026-11-02', checkout: '2026-11-05', guests: 2, status: 'cancelled', date: '2026-09-26T09:00:00Z' }
    ],
    messages: [
      { id: 1, data: { name: 'Sarah K.', email: 'sarah@example.com', subject: 'Late check-out request', message: 'Hi, is it possible to arrange a late check-out for our stay in October? Thanks!' }, type: 'contact', date: '2026-09-24T09:30:00Z', status: 'new' },
      { id: 2, data: { name: 'David M.', email: 'david@example.com', subject: 'Airport pickup', message: 'Do you offer airport pickup from Entebbe? And what would it cost?' }, type: 'contact', date: '2026-09-25T14:12:00Z', status: 'new' },
      { id: 3, data: { name: 'James T.', email: 'james@example.com', subject: 'AC repair', message: 'The AC in the family house was weak during our last stay. Can someone check it before our next visit?' }, type: 'contact', date: '2026-09-26T08:05:00Z', status: 'read' },
      { id: 4, data: { name: 'Grace A.', email: 'grace@example.com', subject: 'Group booking', message: 'We are 8 people looking at the villa in November. Is there a group discount?' }, type: 'contact', date: '2026-09-27T16:40:00Z', status: 'new' }
    ],
    reviews: [
      { id: 1, guest: 'Sarah K.', property: 'Luxury Villa with Pool', rating: 5, text: 'Absolutely stunning villa, the pool was immaculate and views were breathtaking!', date: '2026-09-20', status: 'published' },
      { id: 2, guest: 'David M.', property: 'Modern Apartment in City Center', rating: 4, text: 'Great location, walkable to everything. Slightly noisy at night.', date: '2026-09-22', status: 'pending' },
      { id: 3, guest: 'Aisha N.', property: 'Beachfront Cottage', rating: 5, text: 'Perfect weekend getaway. Waking up to the sound of waves was magical.', date: '2026-09-24', status: 'pending' },
      { id: 4, guest: 'James T.', property: 'Family House with Garden', rating: 2, text: 'House was okay but check-in took over an hour and AC was weak.', date: '2026-09-25', status: 'pending' }
    ],
    payments: [
      { id: 'TXN-1042', guest: 'Sarah K.', method: 'MTN MoMo', amount: 750, status: 'paid', date: '2026-09-20' },
      { id: 'TXN-1043', guest: 'David M.', method: 'Airtel Money', amount: 360, status: 'pending', date: '2026-09-22' },
      { id: 'TXN-1044', guest: 'Aisha N.', method: 'Card · Visa ****4242', amount: 540, status: 'paid', date: '2026-09-24' },
      { id: 'TXN-1045', guest: 'James T.', method: 'MTN MoMo', amount: 600, status: 'failed', date: '2026-09-25' },
      { id: 'TXN-1046', guest: 'Grace A.', method: 'Card · Mastercard ****8210', amount: 250, status: 'refunded', date: '2026-09-26' }
    ],
    users: [
      { id: 1, name: 'Admin User', email: 'admin@mjproperties.com', phone: '+256740286242', role: 'admin' },
      { id: 2, name: 'John Doe', email: 'john@example.com', phone: '+256712345678', role: 'guest' }
    ],
    settings: {
      siteName: 'MJ Properties',
      siteEmail: 'mjsoniainvestmentes@gmail.com',
      sitePhone: '+256740286242',
      siteLocation: 'Kampala Gigo, Uganda',
      commissionRate: 15
    },
    properties: [
      { id: 1, title: 'Luxury Villa with Pool', location: 'Kololo, Kampala', price: 250, type: 'villa', bedrooms: 4, bathrooms: 3, guests: 8, rating: 4.9, image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80', description: 'Stunning villa with private pool and panoramic city views.' },
      { id: 2, title: 'Modern Apartment in City Center', location: 'Nakasero, Kampala', price: 120, type: 'apartment', bedrooms: 2, bathrooms: 2, guests: 4, rating: 4.7, image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80', description: 'Contemporary apartment with all amenities in the heart of the city.' },
      { id: 3, title: 'Beachfront Cottage', location: 'Entebbe', price: 180, type: 'cottage', bedrooms: 3, bathrooms: 2, guests: 6, rating: 4.8, image: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?ixlib=rb-4.0.3&auto=format&fit=crop&w=1465&q=80', description: 'Charming cottage with direct beach access and sunset views.' },
      { id: 4, title: 'Family House with Garden', location: 'Muyenga, Kampala', price: 200, type: 'house', bedrooms: 5, bathrooms: 4, guests: 10, rating: 4.6, image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80', description: 'Spacious family home with large garden and outdoor entertainment area.' }
    ]
  };
}

async function readData() {
  // Read through the Blob SDK with useCache:false — authenticated, direct from origin,
  // never served from the CDN edge cache (which was serving stale data).
  try {
    const blob = await get(DATA_KEY, { access: 'public', useCache: false });
    const reader = blob.stream.getReader();
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    const parsed = JSON.parse(text);
    cache = { ...seedDefaults(), ...parsed };
    return cache;
  } catch (e) {
    // First run (or unreadable) — seed and persist defaults.
    cache = cache || seedDefaults();
    return cache;
  }
}

async function writeData(data) {
  cache = data;
  await put(DATA_KEY, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0 // never serve stale data from the CDN
  });
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { readData, writeData, parseBody, cors, seedDefaults };
