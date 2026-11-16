// CreatHub – accès Supabase : authentification, catalogue, commandes, administration.
// Chargé APRÈS supabase-client.js. Expose window.CH.
(function () {
  'use strict';
  var sb = window.sb;
  var SHIPPING = { fee: 800, freeFrom: 15000 };            // doit correspondre à supabase-orders.sql
  var STATUS = { new: 'Nouvelle', preparing: 'En préparation', done: 'Terminée', cancelled: 'Annulée' };
  var PAYMENT = { cod: 'Paiement à la livraison (simulé)', bank_transfer_demo: 'Virement (simulé)' };
  var CATEGORIES = { painting: 'Peinture', ceramics: 'Céramique', crafts: 'Artisanat traditionnel', photo: 'Photographie', digital: 'Art numérique', sculpture: 'Sculpture', illustration: 'Illustration', graphic: 'Design graphique', jewelry: 'Bijoux', decor: 'Objets décoratifs', other: 'Autre' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (c) { return (c / 100).toFixed(2).replace('.', ',') + ' DT'; };
  var pageUrl = function (file, params) { var u = new URL(file, location.href); Object.keys(params || {}).forEach(function (k) { if (params[k]) u.searchParams.set(k, params[k]); }); return u.href; };
  var safeNext = function (n) { return /^[A-Za-z0-9_.\-]+\.html(\?.*)?$/.test(n || '') ? n : 'compte.html'; };
  function friendly(e) {
    var m = (e && e.message) || String(e);
    if (/PRICE_CHANGED/.test(m)) return 'Un prix a changé depuis l’ajout au panier. Vérifiez le nouveau total puis recommencez.';
    if (/PRODUCT_UNAVAILABLE/.test(m)) return 'Un produit de votre panier n’est plus disponible.';
    if (/AUTH_REQUIRED|JWT/.test(m)) return 'Votre session a expiré. Reconnectez-vous.';
    if (/INVALID_CART/.test(m)) return 'Panier invalide.';
    if (/Invalid login/i.test(m)) return 'E-mail ou mot de passe incorrect.';
    if (/Email not confirmed/i.test(m)) return 'Adresse e-mail non confirmée : ouvrez le lien reçu par e-mail.';
    if (/already registered/i.test(m)) return 'Cette adresse e-mail est déjà utilisée.';
    if (/row-level security|permission denied/i.test(m)) return 'Action non autorisée pour ce compte.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
    return 'Une erreur est survenue : ' + m;
  }
  function need() { if (!sb) throw new Error('Supabase n’est pas configuré (voir SUPABASE.md).'); return sb; }
  /* ---------- Authentification ---------- */
  var auth = {
    signUp: async function (f) {
      var r = await need().auth.signUp({ email: f.email, password: f.password, options: { data: { first_name: f.first, last_name: f.last }, emailRedirectTo: pageUrl('verification.html', { next: f.next }) } });
      if (r.error) throw r.error; return r.data;
    },
    resend: async function (email, next) { var r = await need().auth.resend({ type: 'signup', email: email, options: { emailRedirectTo: pageUrl('verification.html', { next: next }) } }); if (r.error) throw r.error; },
    login: async function (email, password) { var r = await need().auth.signInWithPassword({ email: email, password: password }); if (r.error) throw r.error; return r.data.user; },
    logout: async function () { await need().auth.signOut(); },
    user: async function () { if (!sb) return null; var s = await sb.auth.getSession(); if (!s.data.session) return null; var r = await sb.auth.getUser(); return r.error ? null : r.data.user; },
    isAdmin: async function (u) { if (!u) return false; var r = await need().from('user_roles').select('role').eq('user_id', u.id).maybeSingle(); return !!(r.data && r.data.role === 'admin'); }
  };
  /* ---------- Panier local (clé conservée si votre site en a déjà une : adaptez CART_KEY) ---------- */
  var CART_KEY = 'creathub_cart', ATT_KEY = 'creathub_attempt';
  var cart = {
    get: function () { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; } },
    set: function (v) { localStorage.setItem(CART_KEY, JSON.stringify(v)); },
    add: function (id, q) { var c = this.get(), i = c.find(function (x) { return x.id === id; }); if (i) i.qty = Math.min(20, i.qty + (q || 1)); else c.push({ id: id, qty: q || 1 }); this.set(c); },
    setQty: function (id, q) { this.set(this.get().map(function (x) { return x.id === id ? { id: id, qty: Math.max(1, Math.min(20, q)) } : x; })); },
    remove: function (id) { this.set(this.get().filter(function (x) { return x.id !== id; })); },
    clear: function () { localStorage.removeItem(CART_KEY); }
  };
  /* ---------- Catalogue ---------- */
  var catalog = {
    list: async function () { var r = await need().from('products').select('*').eq('available', true).order('created_at', { ascending: false }); if (r.error) throw r.error; return r.data; },
    byIds: async function (ids) { var r = await need().from('products').select('*').in('id', ids).eq('available', true); if (r.error) throw r.error; return r.data; }
  };
  /* ---------- Commandes ---------- */
  function attemptId(sig) { var a = null; try { a = JSON.parse(localStorage.getItem(ATT_KEY)); } catch (e) {} if (a && a.sig === sig) return a.id; var id = crypto.randomUUID(); localStorage.setItem(ATT_KEY, JSON.stringify({ sig: sig, id: id })); return id; }
  var orders = {
    summary: async function () { var c = cart.get(); if (!c.length) return null; var ps = await catalog.byIds(c.map(function (x) { return x.id; })); var lines = c.map(function (x) { var p = ps.find(function (q) { return q.id === x.id; }); return p ? { p: p, qty: x.qty, line: p.price_cents * x.qty } : null; }).filter(Boolean); var sub = lines.reduce(function (s, l) { return s + l.line; }, 0), ship = sub >= SHIPPING.freeFrom ? 0 : SHIPPING.fee; return { lines: lines, sub: sub, ship: ship, total: sub + ship, missing: c.length - lines.length }; },
    create: async function (form) {
      var s = await this.summary(); if (!s || !s.lines.length) throw new Error('Votre panier est vide.'); if (s.missing) throw new Error('PRODUCT_UNAVAILABLE');
      var items = s.lines.map(function (l) { return { id: l.p.id, qty: l.qty }; }), sig = JSON.stringify(items) + s.total;
      var r = await need().rpc('create_demo_order', { p_attempt_id: attemptId(sig), p_items: items, p_customer_name: form.name, p_phone: form.phone, p_address: form.address, p_city: form.city, p_payment_method: form.payment, p_expected_total_cents: s.total });
      if (r.error) { if (/PRICE_CHANGED|PRODUCT_UNAVAILABLE|INVALID_CART/.test(r.error.message)) localStorage.removeItem(ATT_KEY); throw r.error; }
      cart.clear(); localStorage.removeItem(ATT_KEY); return r.data;       // panier vidé seulement après succès confirmé
    },
    mine: async function () { var r = await need().from('orders').select('*').order('id', { ascending: false }).limit(100); if (r.error) throw r.error; return r.data; }
  };
  /* ---------- Administration (la base refuse tout si le rôle admin manque) ---------- */
  var admin = {
    orders: async function (o) { var q = need().from('orders').select('*').order('id', { ascending: false }).limit(50); if (o && o.status) q = q.eq('status', o.status); if (o && o.beforeId) q = q.lt('id', o.beforeId); var r = await q; if (r.error) throw r.error; return r.data; },
    setStatus: async function (id, status, expectedUpdatedAt) { var r = await need().from('orders').update({ status: status }).eq('id', id).eq('updated_at', expectedUpdatedAt).select(); if (r.error) throw r.error; if (!r.data.length) { var e = new Error('CONFLICT'); e.conflict = true; throw e; } return r.data[0]; },
    products: async function () { var r = await need().from('products').select('*').order('created_at', { ascending: false }); if (r.error) throw r.error; return r.data; },
    saveProduct: async function (p, isNew) { var r = isNew ? await need().from('products').insert(p) : await need().from('products').update(p).eq('id', p.id); if (r.error) throw r.error; },
    deleteProduct: async function (id) { var r = await need().from('products').delete().eq('id', id); if (r.error) throw r.error; }
  };
  window.CH = { sb: sb, esc: esc, money: money, pageUrl: pageUrl, safeNext: safeNext, friendly: friendly, auth: auth, cart: cart, catalog: catalog, orders: orders, admin: admin, STATUS: STATUS, PAYMENT: PAYMENT, CATEGORIES: CATEGORIES, SHIPPING: SHIPPING };
})();
