/**
 * VETRIVER — storefront API (v2)
 * ---------------------------------------------------------------
 * Security posture (unchanged — still the part that matters):
 *   1. The browser NEVER sends a price. It sends {id, qty}. Server prices it.
 *   2. Stock is RESERVED at order creation, CONFIRMED only by the webhook.
 *   3. Webhook signature verified with HMAC over the RAW body, timing-safe.
 *   4. Address is validated BEFORE payment — refusing an undeliverable order
 *      now is far cheaper than refunding it later.
 *
 *   npm i express better-sqlite3 razorpay helmet compression express-rate-limit
 *   node server.js
 */

const express     = require('express');
const crypto      = require('crypto');
const Razorpay    = require('razorpay');
const Database    = require('better-sqlite3');
const helmet      = require('helmet');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');

const {
  RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
  ADMIN_TOKEN, PORT = 3000
} = process.env;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error('Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET');
  process.exit(1);
}

const rzp = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
const app = express();

/* ============================= DB ============================= */
const db = new Database('vetriver.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    tagline  TEXT NOT NULL,
    grade    TEXT NOT NULL,
    price    INTEGER NOT NULL,
    mrp      INTEGER,
    img      TEXT NOT NULL,
    stock    INTEGER NOT NULL,
    reserved INTEGER NOT NULL DEFAULT 0,
    batch    INTEGER NOT NULL DEFAULT 50,
    active   INTEGER NOT NULL DEFAULT 1,
    sort     INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id       TEXT PRIMARY KEY,
    items    TEXT NOT NULL,
    amount   INTEGER NOT NULL,
    ship     TEXT NOT NULL,
    status   TEXT NOT NULL,
    payment  TEXT,
    tracking TEXT,
    created  INTEGER NOT NULL
  );
`);

/* Catalogue. Grades map to the real harvest separation:
   fine long fibre -> garlands; medium -> cushions; short -> quils.
   garland-1ft/2ft/3ft/5ft are size options of the same garland, switched via a
   front-end card selector on the hero buy box (not a separate variant system —
   each size is just its own catalogue row, same as any other product).
   Garlands above 5 ft are made-to-order and handled as a WhatsApp enquiry in
   the markup, not a catalogue row here.
   PLACEHOLDER PRICING for 2ft/3ft/5ft — scaled off the real 1ft price; confirm
   real numbers with the client before launch. */
const CATALOGUE = [
  ['garland-1ft',      'Vetiver Garland — 1 ft', 'Hand-tied vetiver root garland', 'Finest long fibre',  899,1299,'assets/garland-1ft.jpg', 50,1],
  ['garland-2ft',      'Vetiver Garland — 2 ft', 'Hand-tied vetiver root garland', 'Finest long fibre', 1449,1999,'assets/garland-2ft.jpg', 40,2],
  ['garland-3ft',      'Vetiver Garland — 3 ft', 'Hand-tied vetiver root garland', 'Finest long fibre', 1999,2699,'assets/garland-3ft.jpg', 30,3],
  // No distinct real photo exists yet for 5 ft — reuses the 3 ft artwork as a placeholder.
  ['garland-5ft',      'Vetiver Garland — 5 ft', 'Hand-tied vetiver root garland', 'Finest long fibre', 2999,3999,'assets/garland-5ft.jpg', 20,4],
  ['cushion-classic',  'Vetiver Cushion',        'Woven root, cool to touch',      'Medium fibre',       1249,1699,'assets/c-mat.jpg',       25,5],
  ['quils-classic',    'Vetiver Quils',          'Hand-rolled root quils',         'Short fibre',         399, 599,'assets/c-pad.jpg',       80,6],
];
const ins = db.prepare(`INSERT OR IGNORE INTO products
  (id,name,tagline,grade,price,mrp,img,stock,sort,batch) VALUES (?,?,?,?,?,?,?,?,?,?)`);
for (const c of CATALOGUE) ins.run(...c, c[7]);   // batch := initial stock

/* ========================= middleware ========================= */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com'],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'https://*.razorpay.com'],
      frameSrc:   ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
      connectSrc: ["'self'", 'https://*.razorpay.com'],
    }
  }
}));
app.use(compression());

/* WEBHOOK FIRST — needs the RAW body, before any JSON parser touches it. */
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-razorpay-signature'];
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
                         .update(req.body).digest('hex');
  const ok = sig && expected.length === sig.length &&
             crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  if (!ok) return res.status(400).send('bad signature');

  const evt = JSON.parse(req.body.toString());

  if (evt.event === 'payment.captured') {
    const orderId   = evt.payload.payment.entity.order_id;
    const paymentId = evt.payload.payment.entity.id;
    const row = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);

    // Idempotent — Razorpay retries. Never decrement twice.
    if (row && row.status !== 'paid') {
      db.transaction(() => {
        for (const it of JSON.parse(row.items)) {
          db.prepare(`UPDATE products SET stock = stock - ?,
                      reserved = MAX(reserved - ?, 0) WHERE id = ?`)
            .run(it.qty, it.qty, it.id);
        }
        db.prepare('UPDATE orders SET status=?, payment=? WHERE id=?')
          .run('paid', paymentId, orderId);
      })();
      console.log('PAID', orderId, paymentId);
      // TODO: confirmation email/SMS -> Resend or MSG91
    }
  }

  if (evt.event === 'payment.failed') {
    releaseReservation(evt.payload.payment.entity.order_id);
  }
  res.json({ ok: true });
});

app.use(express.json({ limit: '10kb' }));
app.use(express.static('.', { maxAge: '1h', etag: true }));
app.use('/api', rateLimit({ windowMs: 60_000, max: 60 }));

/* ========================== helpers ========================== */
const available = p => Math.max(0, p.stock - p.reserved);
const statusOf  = p => !p.active ? 'closed'
                     : available(p) <= 0 ? 'out'
                     : available(p) <= 10 ? 'low' : 'in';

function releaseReservation(orderId) {
  const row = db.prepare(`SELECT * FROM orders WHERE id=? AND status='created'`).get(orderId);
  if (!row) return;
  db.transaction(() => {
    for (const it of JSON.parse(row.items)) {
      db.prepare('UPDATE products SET reserved = MAX(reserved - ?,0) WHERE id=?')
        .run(it.qty, it.id);
    }
    db.prepare(`UPDATE orders SET status='failed' WHERE id=?`).run(orderId);
  })();
}

// Abandoned checkouts give their stock back after 20 minutes.
setInterval(() => {
  const cutoff = Date.now() - 20 * 60_000;
  db.prepare(`SELECT id FROM orders WHERE status='created' AND created < ?`)
    .all(cutoff).forEach(r => releaseReservation(r.id));
}, 5 * 60_000);

/* Address validation — runs BEFORE payment. */
function validateShip(s) {
  if (!s || typeof s !== 'object') return 'Delivery details are missing';
  const name  = String(s.name  || '').trim();
  const phone = String(s.phone || '').replace(/[\s-]/g, '');
  const email = String(s.email || '').trim();
  const addr  = String(s.address || '').trim();
  const city  = String(s.city  || '').trim();
  const state = String(s.state || '').trim();
  const pin   = String(s.pin   || '').trim();

  if (name.length < 2)                             return 'Enter the recipient’s name';
  if (!/^(\+91)?[6-9]\d{9}$/.test(phone))          return 'Enter a valid 10-digit Indian mobile number';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email))return 'Enter a valid email address';
  if (addr.length < 10)                            return 'Enter the full street address';
  if (city.length < 2)                             return 'Enter the city or town';
  if (state.length < 2)                            return 'Select the state';
  if (!/^[1-9]\d{5}$/.test(pin))                   return 'Enter a valid 6-digit PIN code';
  return null;
}

/* ========================= public API ========================= */

app.get('/api/products', (_, res) => {
  res.set('Cache-Control', 'no-store').json(
    db.prepare('SELECT * FROM products ORDER BY sort').all().map(p => ({
      id: p.id, name: p.name, tagline: p.tagline, grade: p.grade,
      price: p.price, mrp: p.mrp, img: p.img,
      available: p.active ? available(p) : 0,
      total: p.batch, status: statusOf(p)
    })));
});

app.get('/api/stock/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.set('Cache-Control', 'no-store').json({
    id: p.id, available: p.active ? available(p) : 0,
    total: p.batch, status: statusOf(p)
  });
});

app.post('/api/order', (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty' });

  const shipErr = validateShip(req.body.ship);
  if (shipErr) return res.status(400).json({ error: shipErr });

  let amount = 0;
  const priced = [];

  for (const raw of items) {
    const qty = Math.floor(Number(raw.qty));
    if (!Number.isInteger(qty) || qty < 1 || qty > 10)
      return res.status(400).json({ error: 'Invalid quantity' });

    const p = db.prepare('SELECT * FROM products WHERE id=?').get(String(raw.id));
    if (!p || !p.active) return res.status(400).json({ error: 'An item is no longer available' });
    if (available(p) < qty)
      return res.status(409).json({ error: `Only ${available(p)} × ${p.name} left in stock` });

    amount += p.price * qty;                 // price from the DB, never the client
    priced.push({ id: p.id, name: p.name, qty, price: p.price });
  }

  rzp.orders.create({
    amount: amount * 100, currency: 'INR', receipt: 'vr_' + Date.now()
  }).then(order => {
    db.transaction(() => {
      for (const it of priced) {
        db.prepare('UPDATE products SET reserved = reserved + ? WHERE id=?')
          .run(it.qty, it.id);
      }
      db.prepare(`INSERT INTO orders (id,items,amount,ship,status,created)
                  VALUES (?,?,?,?,?,?)`)
        .run(order.id, JSON.stringify(priced), amount,
             JSON.stringify(req.body.ship), 'created', Date.now());
    })();

    res.json({
      id: order.id, amount: order.amount,
      key_id: RAZORPAY_KEY_ID,      // publishable. The SECRET never leaves this server.
      prefill: {
        name: req.body.ship.name,
        email: req.body.ship.email,
        contact: req.body.ship.phone
      }
    });
  }).catch(e => {
    console.error(e);
    res.status(502).json({ error: 'Payment gateway unavailable. Please try again.' });
  });
});

app.post('/api/verify', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  res.json({ valid: expected === razorpay_signature });
});

/* ===================== admin (bearer token) ===================== */
const admin = (req, res, next) =>
  req.headers.authorization === `Bearer ${ADMIN_TOKEN}`
    ? next() : res.status(401).json({ error: 'unauthorized' });

app.get('/api/admin/products', admin, (_, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY sort').all()
    .map(p => ({ ...p, available: available(p), state: statusOf(p) })));
});

app.patch('/api/admin/product/:id', admin, (req, res) => {
  const { stock, price, active, batch } = req.body;
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });

  db.prepare(`UPDATE products SET
      stock  = COALESCE(?, stock),  price = COALESCE(?, price),
      active = COALESCE(?, active), batch = COALESCE(?, batch)
    WHERE id = ?`)
    .run(stock ?? null, price ?? null,
         active === undefined ? null : (active ? 1 : 0),
         batch ?? null, req.params.id);

  const u = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  res.json({ ...u, available: available(u), state: statusOf(u) });
});

// The fulfilment queue: who paid, what to pack, where it goes.
app.get('/api/admin/orders', admin, (_, res) => {
  res.json(db.prepare(`SELECT * FROM orders WHERE status IN ('paid','shipped')
                       ORDER BY created DESC LIMIT 200`).all()
    .map(o => ({
      id: o.id, amount: o.amount, status: o.status, tracking: o.tracking,
      created: o.created, items: JSON.parse(o.items), ship: JSON.parse(o.ship)
    })));
});

app.patch('/api/admin/order/:id', admin, (req, res) => {
  const { status, tracking } = req.body;
  db.prepare('UPDATE orders SET status=COALESCE(?,status), tracking=COALESCE(?,tracking) WHERE id=?')
    .run(status ?? null, tracking ?? null, req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/sales', admin, (_, res) => {
  const paid = db.prepare(`SELECT * FROM orders WHERE status IN ('paid','shipped')`).all();
  const byProduct = {};
  let units = 0, revenue = 0;
  for (const o of paid) {
    revenue += o.amount;
    for (const i of JSON.parse(o.items)) {
      units += i.qty;
      byProduct[i.id] ??= { name: i.name, units: 0, revenue: 0 };
      byProduct[i.id].units   += i.qty;
      byProduct[i.id].revenue += i.qty * i.price;
    }
  }
  res.json({ orders: paid.length, units, revenue, byProduct });
});

app.listen(PORT, () => console.log(`Vetriver on :${PORT}`));
