// Boutique : catalogue Supabase + panier local + commande (paiement SIMULÉ, aucune donnée bancaire).
// Si votre site possède déjà un panier, gardez-le : adaptez CH.cart (supabase-shop.js) à son format.
document.addEventListener('DOMContentLoaded', async function () {
  if (!window.CH || !CH.sb) { document.getElementById('grid').innerHTML = '<p class="msg err">Supabase n’est pas configuré : voir SUPABASE.md.</p>'; return; }
  var grid = document.getElementById('grid'), chips = document.getElementById('chips'), cartBox = document.getElementById('cart'), form = document.getElementById('co'), msg = document.getElementById('cm'), btn = document.getElementById('cb'), esc = CH.esc, all = [], cat = '';
  function card(p) {
    var img = p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' : esc(p.name.charAt(0));
    return '<article class="card"><div class="ph">' + img + '</div><h3 style="margin-top:12px">' + esc(p.name) + '</h3><span class="tag">' + esc(CH.CATEGORIES[p.category] || p.category) + '</span><p class="muted">' + esc(p.description) + '</p>' + (p.features || []).map(function (f) { return '<small class="muted">• ' + esc(f) + '</small><br>'; }).join('') + '<p class="row" style="justify-content:space-between"><b>' + CH.money(p.price_cents) + '</b><button data-add="' + esc(p.id) + '">Ajouter au panier</button></p></article>';
  }
  function paint() {
    var cs = Object.keys(CH.CATEGORIES).filter(function (c) { return all.some(function (p) { return p.category === c; }); });
    chips.innerHTML = [['', 'Tout']].concat(cs.map(function (c) { return [c, CH.CATEGORIES[c]]; })).map(function (x) { return '<button class="' + (cat === x[0] ? '' : 'alt') + '" data-cat="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join(' ');
    var l = all.filter(function (p) { return !cat || p.category === cat; });
    grid.innerHTML = l.length ? l.map(card).join('') : '<p class="muted">Aucun produit disponible pour le moment.</p>';
  }
  async function paintCart() {
    try {
      var s = await CH.orders.summary();
      if (!s || !s.lines.length) { cartBox.innerHTML = '<p class="muted">Votre panier est vide.</p>'; form.hidden = true; return; }
      cartBox.innerHTML = '<table><tr><th>Produit</th><th>Qté</th><th>Total</th><th></th></tr>' + s.lines.map(function (l) { return '<tr><td>' + esc(l.p.name) + '</td><td><input type="number" min="1" max="20" value="' + l.qty + '" data-qty="' + esc(l.p.id) + '" style="width:70px;margin:0"></td><td>' + CH.money(l.line) + '</td><td><button class="alt" data-rm="' + esc(l.p.id) + '">Retirer</button></td></tr>'; }).join('') + '</table><p>Sous-total : ' + CH.money(s.sub) + '<br>Livraison : ' + (s.ship ? CH.money(s.ship) : 'offerte') + '<br><b>Total : ' + CH.money(s.total) + '</b></p>' + (s.missing ? '<p class="msg err">Un produit du panier n’est plus disponible : retirez-le.</p>' : '');
      var u = await CH.auth.user();
      form.hidden = !u; document.getElementById('login-hint').hidden = !!u;
    } catch (e) { cartBox.innerHTML = '<p class="msg err">' + esc(CH.friendly(e)) + '</p>'; }
  }
  document.body.addEventListener('click', function (e) {
    var t = e.target;
    if (t.dataset.cat !== undefined) { cat = t.dataset.cat; paint(); }
    if (t.dataset.add) { CH.cart.add(t.dataset.add); paintCart(); }
    if (t.dataset.rm) { CH.cart.remove(t.dataset.rm); paintCart(); }
  });
  document.body.addEventListener('change', function (e) { if (e.target.dataset.qty) { CH.cart.setQty(e.target.dataset.qty, parseInt(e.target.value, 10) || 1); paintCart(); } });
  form.onsubmit = async function (e) {
    e.preventDefault(); var v = Object.fromEntries(new FormData(form)); msg.className = 'msg err';
    if (v.name.trim().length < 2) return msg.textContent = 'Saisissez votre nom.';
    if (!/^\+?[0-9 ]{8,15}$/.test(v.phone.trim())) return msg.textContent = 'Téléphone invalide.';
    if (v.address.trim().length < 6 || v.city.trim().length < 2) return msg.textContent = 'Adresse et ville requises.';
    btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Enregistrement de la commande…';
    try { var o = await CH.orders.create({ name: v.name, phone: v.phone, address: v.address, city: v.city, payment: v.payment }); msg.className = 'msg ok'; msg.textContent = 'Commande ' + o.reference + ' enregistrée (paiement simulé). Total : ' + CH.money(o.total_cents) + '.'; form.reset(); paintCart(); }
    catch (x) { msg.className = 'msg err'; msg.textContent = CH.friendly(x); }   // le panier est conservé
    btn.disabled = false;
  };
  try { all = await CH.catalog.list(); paint(); } catch (e) { grid.innerHTML = '<p class="msg err">' + esc(CH.friendly(e)) + '</p>'; }
  paintCart();
});
