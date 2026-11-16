// Test local (node test-logic.js) de la logique JS avec un FAUX client Supabase.
// Il NE teste PAS le SQL ni le RLS : ceux-ci doivent être testés sur votre vrai projet (voir SUPABASE.md, section 8).
const assert = require('assert'); const store = {};
global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.crypto = require('crypto'); global.location = { href: 'https://creathub.vercel.app/shop.html' };
const products = [{ id: 'a', name: 'A', price_cents: 5000, available: true }, { id: 'b', name: 'B', price_cents: 12000, available: true }];
let rpcCalls = [], failNext = null, updateRows = [{ id: 1, status: 'done' }];
const q = (rows) => { const o = { select: () => o, eq: () => o, in: () => o, order: () => o, limit: () => o, lt: () => o, then: (r) => r({ data: rows, error: null }) }; return o; };
global.window = { supabase: null, sb: { rpc: async (n, a) => { rpcCalls.push(a); if (failNext) { const e = failNext; failNext = null; return { error: e }; } return { data: { reference: 'CH-1', total_cents: a.p_expected_total_cents } }; },
  from: (t) => t === 'products' ? q(products) : { update: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: updateRows, error: null }) }) }) }) } } };
global.document = {}; require('./supabase-shop.js'); const CH = global.window.CH;
(async () => {
  assert.equal(CH.money(1250), '12,50 DT'); assert.equal(CH.safeNext('https://evil.com'), 'compte.html'); assert.equal(CH.safeNext('shop.html'), 'shop.html');
  assert.equal(CH.esc('<img onerror=x>'), '&lt;img onerror=x&gt;');
  CH.cart.add('a', 2); CH.cart.add('b'); const s = await CH.orders.summary();
  assert.equal(s.sub, 22000); assert.equal(s.ship, 0);                       // >= 150 DT : livraison offerte
  CH.cart.clear(); CH.cart.add('a'); assert.equal((await CH.orders.summary()).ship, 800);   // 50 DT : 8 DT de livraison
  const f = { name: 'Test', phone: '20123456', address: '1 rue Test', city: 'Tunis', payment: 'cod' };
  failNext = new Error('Failed to fetch');                                    // coupure réseau
  await assert.rejects(CH.orders.create(f)); assert.equal(CH.cart.get().length, 1, 'le panier doit être conservé après une erreur');
  const id1 = rpcCalls[0].p_attempt_id; const o = await CH.orders.create(f);   // nouvelle tentative
  assert.equal(rpcCalls[1].p_attempt_id, id1, 'même identifiant de tentative après erreur réseau'); assert.equal(o.reference, 'CH-1');
  assert.equal(CH.cart.get().length, 0, 'panier vidé après succès'); assert.equal(rpcCalls[1].p_expected_total_cents, 5800);
  assert.equal((await CH.admin.setStatus(1, 'done', 't')).status, 'done');
  updateRows = []; await assert.rejects(CH.admin.setStatus(1, 'done', 'old'), (e) => e.conflict === true);   // modification concurrente
  console.log('Tous les tests de logique JS passent.');
})().catch((e) => { console.error('ÉCHEC :', e.message); process.exit(1); });
