/* =====================================================================
   VETRIVER — storefront logic
   Loaded on every page so the cart button/drawer/checkout work no matter
   which page the visitor is on. Stock is fetched from the backend so it
   is authoritative, never trusted from the client. Price is ALSO
   re-verified server-side at order creation — the amount below is
   display only.

   The hero buy-box (qty/gallery/stock) and the catalogue grid only exist
   on shop.html — every function that touches them checks the element
   exists first, so this script no-ops harmlessly on every other page.
   ===================================================================== */

const API = ''; // same-origin; set to your API base if hosted separately

/* The hero buy box offers 4 sizes of the same garland, switched with a
   card selector — each size is its own catalogue product id (see
   MOCK_PRODUCTS and server.js CATALOGUE), not a separate variant system.
   "Above 5 ft" is enquiry-only (made to order) and isn't a catalogue row —
   it's a plain link in the markup, not wired here. */
const SIZES = [
  { id:'garland-1ft', label:'1 ft' },
  { id:'garland-2ft', label:'2 ft' },
  { id:'garland-3ft', label:'3 ft' },
  { id:'garland-5ft', label:'5 ft' },
];
let selectedSizeId = SIZES[0].id;
const selectedProduct = () => MOCK_PRODUCTS.find(p => p.id === selectedSizeId);

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh',
'Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu & Kashmir',
'Jharkhand','Karnataka','Kerala','Ladakh','Madhya Pradesh','Maharashtra','Manipur',
'Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim',
'Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];

let stock    = { available: null, total: 50, status: 'loading' };
let products = [];
let qty      = 1;
let step     = 'cart';      // cart | ship
let cart     = JSON.parse(localStorage.getItem('vetriver_cart') || '[]');

const $ = id => document.getElementById(id);
const inr = n => '₹' + n.toLocaleString('en-IN');

/* Static preview data — used only when /api is unreachable (e.g. this page
   hosted on GitHub Pages for design review). Mirrors CATALOGUE in server.js.
   PLACEHOLDER PRICING for everything but 1ft/cushion/quils — see note in
   server.js CATALOGUE. The 5ft photo reuses the 3ft artwork — no distinct
   real photo exists yet for that size. */
const MOCK_PRODUCTS = [
  { id:'garland-1ft',      name:'Vetiver Garland, 1 ft', tagline:'Hand-tied vetiver root garland', grade:'Finest long fibre', price:899,  mrp:1299, img:'assets/garland-1ft.jpg', available:42, total:50, status:'in' },
  { id:'garland-2ft',      name:'Vetiver Garland, 2 ft', tagline:'Hand-tied vetiver root garland', grade:'Finest long fibre', price:1449, mrp:1999, img:'assets/garland-2ft.jpg', available:33, total:40, status:'in' },
  { id:'garland-3ft',      name:'Vetiver Garland, 3 ft', tagline:'Hand-tied vetiver root garland', grade:'Finest long fibre', price:1999, mrp:2699, img:'assets/garland-3ft.jpg', available:21, total:30, status:'in' },
  { id:'garland-5ft',      name:'Vetiver Garland, 5 ft', tagline:'Hand-tied vetiver root garland', grade:'Finest long fibre', price:2999, mrp:3999, img:'assets/garland-5ft.jpg', available:14, total:20, status:'in' },
  { id:'cushion-classic',  name:'Vetiver Cushion',        tagline:'Woven root, cool to touch',      grade:'Medium fibre',      price:1249, mrp:1699, img:'assets/c-mat.jpg',       available:25, total:25, status:'in' },
  { id:'quils-classic',    name:'Vetiver Quils',          tagline:'Hand-rolled root quils',         grade:'Short fibre',       price:399,  mrp:599,  img:'assets/c-pad.jpg',       available:80, total:80, status:'in' },
];

/* ---------- CATALOGUE (shop.html only) ---------- */
async function loadCatalogue(){
  const el = $('catalogue');
  if(!el) return;   // catalogue grid only exists on shop.html

  try{
    const r = await fetch(API + '/api/products', {cache:'no-store'});
    if(!r.ok) throw 0;
    products = await r.json();
  }catch(e){
    products = MOCK_PRODUCTS;   // no backend on this host — show the preview catalogue
  }

  // The 4 garland sizes already have their own buy box above (size selector); don't repeat them here.
  const sizeIds = SIZES.map(s => s.id);
  const rest = products.filter(p => !sizeIds.includes(p.id));
  const label = { in:'In stock', low:'Low stock', out:'Sold out', closed:'Unavailable' };

  el.innerHTML = rest.map(p => {
    const gone = p.status === 'out' || p.status === 'closed';
    const cls  = p.status === 'low' ? 'low' : gone ? 'out' : '';
    const note = p.status === 'low' ? `Only ${p.available} left`
               : gone ? label[p.status]
               : `${p.available} ready to ship`;
    return `
      <article class="card ${gone ? 'sold' : ''}">
        <div class="card-img">
          <span class="grade">${p.grade}</span>
          <img src="${p.img}" alt="${p.name}, ${p.tagline}" loading="lazy">
        </div>
        <div class="card-body">
          <h3>${p.name}</h3>
          <p class="tag">${p.tagline}</p>
          <div class="card-foot">
            <span class="p"><b>${inr(p.price)}</b>${p.mrp ? `<s>${inr(p.mrp)}</s>` : ''}</span>
            <button class="add" data-add="${p.id}" ${gone ? 'disabled' : ''}>
              ${gone ? 'Sold out' : 'Add'}
            </button>
          </div>
          <p class="st ${cls}"><i></i>${note}</p>
        </div>
      </article>`;
  }).join('');

  el.querySelectorAll('[data-add]').forEach(b => {
    b.onclick = () => {
      const p = products.find(x => x.id === b.dataset.add);
      requireLogin(() => addItem({ id:p.id, name:p.name, price:p.price, img:p.img }, 1, p.available));
    };
  });
}

/* ---------- SIZE SELECTOR (hero product, shop.html only) ---------- */
function renderSizePills(){
  const el = $('sizePills');
  if(!el) return;
  el.querySelectorAll('button[data-size]').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.size === selectedSizeId)));
}

function renderPrice(){
  if(!$('priceAmt')) return;
  const p = selectedProduct();
  $('priceAmt').textContent = inr(p.price);
  $('mrpAmt').textContent = inr(p.mrp);
  const off = Math.round((1 - p.price / p.mrp) * 100);
  $('offAmt').textContent = `SAVE ${off}%`;
  $('heroImg').src = p.img;
  $('heroImg').alt = `Vetriver ${p.name}, handwoven vetiver root garland`;
}

if($('sizePills')){
  $('sizePills').querySelectorAll('button[data-size]').forEach(b => {
    b.onclick = () => {
      selectedSizeId = b.dataset.size;
      qty = 1; $('qVal').textContent = qty;
      renderSizePills(); renderPrice(); loadStock();
    };
  });
}

/* ---------- LIVE STOCK (hero product, shop.html only) ---------- */
async function loadStock(){
  if(!$('stockBox')) return;   // hero buy box only exists on shop.html

  try{
    const r = await fetch(API + '/api/stock/' + selectedSizeId, {cache:'no-store'});
    if(!r.ok) throw 0;
    const d = await r.json();
    stock = { available: d.available, total: d.total || 50, status: d.status };
  }catch(e){
    // No backend on this host — fall back to the same preview numbers as the catalogue.
    const m = selectedProduct();
    stock = { available: m.available, total: m.total, status: m.status };
  }
  renderStock();
}

function renderStock(){
  const box = $('stockBox'), label = $('stockLabel'),
        bar = $('stockBar'), note = $('stockNote');
  if(!box) return;
  box.classList.remove('low','out');

  if(stock.status === 'unknown'){
    label.textContent = 'Stock unavailable';
    note.textContent  = 'Live inventory not connected yet. Connect /api/stock to enable.';
    bar.style.width = '0%';
    box.classList.add('out');
    setBuyable(false);
    return;
  }
  const a = stock.available, pct = Math.max(0, Math.min(100, (a / stock.total) * 100));
  bar.style.width = pct + '%';

  if(a <= 0){
    box.classList.add('out');
    label.textContent = 'Sold out';
    note.textContent  = 'This batch is fully sold. The next harvest batch is being tied now.';
    setBuyable(false);
  } else if(a <= 10){
    box.classList.add('low');
    label.textContent = 'Low stock';
    note.textContent  = `Only ${a} left from this batch.`;
    setBuyable(true);
  } else {
    label.textContent = 'In stock';
    note.textContent  = `${a} garlands ready to ship from Dindigul.`;
    setBuyable(true);
  }
}

function setBuyable(ok){
  if(!$('addBtn')) return;
  $('addBtn').disabled = !ok;
  $('buyNowBtn').disabled = !ok;
  $('addBtn').textContent = ok ? 'Add to cart' : 'Sold out';
  $('qPlus').disabled = !ok;
  $('qMinus').disabled = !ok;
}

/* ---------- QUANTITY (shop.html only) ---------- */
if($('qPlus')){
  $('qPlus').onclick = () => {
    const cap = stock.available ?? 1;
    if(qty < Math.min(cap, 10)) { qty++; $('qVal').textContent = qty; }
  };
  $('qMinus').onclick = () => { if(qty > 1){ qty--; $('qVal').textContent = qty; } };
}

/* ---------- GALLERY (shop.html only) ---------- */
document.querySelectorAll('.thumbs button').forEach(b => {
  b.onclick = () => {
    $('heroImg').src = b.dataset.src;
    document.querySelectorAll('.thumbs button').forEach(x => x.setAttribute('aria-current','false'));
    b.setAttribute('aria-current','true');
  };
});

/* ---------- CART (every page) ---------- */
const save = () => localStorage.setItem('vetriver_cart', JSON.stringify(cart));

function addItem(prod, n, cap = 10){
  const line = cart.find(i => i.id === prod.id);
  if(line) line.qty = Math.min(line.qty + n, cap, 10);
  else cart.push({ ...prod, qty: Math.min(n, cap, 10) });
  save(); renderCart(); toast(`${prod.name} added`);
}

function renderCart(){
  const body  = $('cartBody');
  const count = cart.reduce((s,i) => s + i.qty, 0);
  const total = cart.reduce((s,i) => s + i.qty * i.price, 0);
  $('cartCount').textContent = count;
  $('cartTotal').textContent = inr(total);
  $('checkoutBtn').disabled  = count === 0;

  body.innerHTML = count === 0
    ? '<p class="empty">Your cart is empty.<br>The garland is waiting.</p>'
    : cart.map(i => `
        <div class="line-item">
          <img src="${i.img}" alt="">
          <div>
            <b>${i.name}</b>
            <small>${i.qty} × ${inr(i.price)}</small>
            <button class="rm" data-rm="${i.id}">Remove</button>
          </div>
          <b>${inr(i.qty * i.price)}</b>
        </div>`).join('');

  body.querySelectorAll('[data-rm]').forEach(b => {
    b.onclick = () => {
      cart = cart.filter(i => i.id !== b.dataset.rm);
      save(); renderCart();
      if(!cart.length) gotoStep('cart');
    };
  });
}

/* ---------- DRAWER + STEPS (every page — the drawer markup is global) ---------- */
function gotoStep(s){
  step = s;
  const ship = s === 'ship';
  $('stepCart').hidden = ship;
  $('stepShip').hidden = !ship;
  $('drawerTitle').textContent = ship ? 'Delivery' : 'Your cart';
  $('checkoutBtn').textContent = ship ? 'Pay securely' : 'Continue to delivery';
  $('formErr').classList.remove('show');
}

let lastFocus = null;
const openCart  = () => {
  lastFocus = document.activeElement;
  $('drawer').classList.add('open'); $('scrim').classList.add('open');
  $('cartBtn').setAttribute('aria-expanded','true');
  $('closeCart').focus();                         // move focus into the dialog
};
const closeCart = () => {
  $('drawer').classList.remove('open'); $('scrim').classList.remove('open');
  $('cartBtn').setAttribute('aria-expanded','false');
  lastFocus?.focus();                             // restore focus to trigger
};
$('cartBtn').onclick   = openCart;
$('closeCart').onclick = closeCart;
$('scrim').onclick     = closeCart;
$('backToCart').onclick = () => gotoStep('cart');
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeCart(); });

// keep Tab inside an open dialog (cart drawer or login gate)
function trapTab(container, e){
  if(e.key !== 'Tab') return;
  const items = [...container.querySelectorAll('a[href],button:not([disabled]),input,select,textarea')]
    .filter(el => el.offsetParent !== null);   // skip hidden (e.g. the inactive step)
  if(!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
}
$('drawer').addEventListener('keydown', e => trapTab($('drawer'), e));

const heroCartItem = () => {
  const p = selectedProduct();
  return { id:p.id, name:p.name, price:p.price, img:p.img };
};
if($('addBtn'))    $('addBtn').onclick    = () => requireLogin(() => addItem(heroCartItem(), qty, stock.available ?? 10));
if($('buyNowBtn')) $('buyNowBtn').onclick = () => requireLogin(() => { addItem(heroCartItem(), qty, stock.available ?? 10); openCart(); });

/* ---------- LOGIN GATE (shop.html only) ----------
   A lightweight phone-number gate shown the first time a visitor tries to
   add something to the cart or buy now. No OTP backend exists yet — this
   just captures the number and remembers it for the session/browser, then
   runs whatever action was waiting. Real OTP verification is a server-side
   addition for later. */
let userPhone = localStorage.getItem('vetriver_phone') || null;
let pendingAction = null;
let loginLastFocus = null;

function requireLogin(action){
  if(userPhone || !$('loginModal')){ action(); return; }
  pendingAction = action;
  loginLastFocus = document.activeElement;
  $('loginModal').classList.add('open'); $('loginScrim').classList.add('open');
  $('loginPhone').value = '';
  $('loginErr').classList.remove('show');
  $('loginPhone').focus();
}
function closeLogin(){
  $('loginModal').classList.remove('open'); $('loginScrim').classList.remove('open');
  loginLastFocus?.focus();
}
if($('loginModal')){
  $('loginClose').onclick = closeLogin;
  $('loginScrim').onclick = closeLogin;
  $('loginModal').addEventListener('keydown', e => trapTab($('loginModal'), e));
  $('loginPhone').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
  $('loginSubmit').onclick = () => {
    const v = $('loginPhone').value.trim();
    if(!/^[6-9]\d{9}$/.test(v)){
      $('loginErr').textContent = 'Enter a valid 10-digit mobile number';
      $('loginErr').classList.add('show');
      $('loginPhone').focus();
      return;
    }
    userPhone = v;
    localStorage.setItem('vetriver_phone', v);
    closeLogin();
    const action = pendingAction; pendingAction = null;
    action?.();
  };
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && $('loginModal').classList.contains('open')) closeLogin();
  });
}

// state dropdown (address form lives in the global drawer)
$('fState').insertAdjacentHTML('beforeend',
  STATES.map(s => `<option value="${s}">${s}</option>`).join(''));

// digits only, where digits are the only valid input
['fPhone','fPin'].forEach(id => {
  $(id).addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '');
  });
});

/* ---------- ADDRESS VALIDATION (mirrored server-side; this is only UX) ---------- */
const FIELDS = {
  fName:  v => v.trim().length >= 2            || 'Enter the recipient’s name',
  fPhone: v => /^[6-9]\d{9}$/.test(v)          || 'Enter a valid 10-digit mobile number',
  fPin:   v => /^[1-9]\d{5}$/.test(v)          || 'Enter a valid 6-digit PIN code',
  fEmail: v => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.trim()) || 'Enter a valid email address',
  fAddr:  v => v.trim().length >= 10           || 'Enter the full street address',
  fCity:  v => v.trim().length >= 2            || 'Enter the city or town',
  fState: v => v !== ''                        || 'Select the state',
};

function checkField(id){
  const el = $(id), wrap = el.closest('.field');
  const res = FIELDS[id](el.value);
  let err = wrap.querySelector('.err');
  if(!err){ err = document.createElement('p'); err.className = 'err'; wrap.appendChild(err); }
  if(res === true){
    wrap.classList.remove('bad'); err.classList.remove('show'); return true;
  }
  wrap.classList.add('bad'); err.textContent = res; err.classList.add('show'); return false;
}
// validate on blur, clear the error as soon as they fix it
Object.keys(FIELDS).forEach(id => {
  $(id).addEventListener('blur',  () => { if($(id).value) checkField(id); });
  $(id).addEventListener('input', () => {
    const w = $(id).closest('.field');
    if(w.classList.contains('bad')) checkField(id);
  });
});

const shipData = () => ({
  name:  $('fName').value.trim(),
  phone: $('fPhone').value.trim(),
  email: $('fEmail').value.trim(),
  address: $('fAddr').value.trim(),
  city:  $('fCity').value.trim(),
  state: $('fState').value,
  pin:   $('fPin').value.trim(),
});

/* ---------- CHECKOUT (Razorpay) ----------
   The client NEVER sends the price. It sends items + quantities + address.
   The server prices the order, re-checks stock, validates the address,
   creates the Razorpay order and returns only the order_id. The signature
   is verified server-side on the webhook — a frontend 'success' handler
   alone can be spoofed.
------------------------------------------------------------------ */
$('checkoutBtn').onclick = async () => {
  const btn = $('checkoutBtn');

  // Step 1 -> 2: just move to the address form.
  if(step === 'cart'){
    if(!cart.length) return;
    gotoStep('ship');
    $('fName').focus();
    return;
  }

  // Step 2: validate everything, then pay.
  const allOk = Object.keys(FIELDS).map(checkField).every(Boolean);
  if(!allOk){
    $('formErr').textContent = 'Please correct the highlighted fields.';
    $('formErr').classList.add('show');
    $('stepShip').querySelector('.bad input, .bad select, .bad textarea')?.focus();
    return;
  }

  btn.disabled = true; btn.textContent = 'Preparing…';

  try{
    const res = await fetch(API + '/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map(i => ({ id: i.id, qty: i.qty })),   // no price sent
        ship:  shipData()
      })
    });
    if(!res.ok) throw new Error((await res.json()).error || 'Could not start checkout');
    const order = await res.json();

    const rzp = new Razorpay({
      key: order.key_id,
      order_id: order.id,
      amount: order.amount,
      currency: 'INR',
      name: 'Vetriver',
      description: 'Vetiver root, natural wellness',
      image: 'assets/logo-light.png',
      prefill: order.prefill,
      theme: { color: '#A97B2E' },
      handler: async r => {
        // Advisory only. The webhook is what actually fulfils the order.
        await fetch(API + '/api/verify', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(r)
        });
        cart = []; save(); renderCart(); closeCart(); gotoStep('cart');
        toast('Payment received, thank you');
        loadStock(); loadCatalogue();
      },
      modal: {
        ondismiss: () => { btn.disabled = false; btn.textContent = 'Pay securely'; }
      }
    });
    rzp.on('payment.failed', resp => {
      toast(resp.error.description || 'Payment failed. Nothing was charged.');
      btn.disabled = false; btn.textContent = 'Pay securely';
    });
    rzp.open();
    btn.textContent = 'Pay securely';

  }catch(err){
    $('formErr').textContent = err.message;
    $('formErr').classList.add('show');
    btn.disabled = false; btn.textContent = 'Pay securely';
  }
};

function toast(msg){
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- boot ---------- */
renderCart();
gotoStep('cart');
renderSizePills();
renderPrice();
loadStock();
loadCatalogue();
setInterval(() => { loadStock(); loadCatalogue(); }, 60000);  // keep stock honest
