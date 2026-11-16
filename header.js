// En-tête commun : lien Admin visible UNIQUEMENT pour l'administrateur (la vraie protection est dans la base).
document.addEventListener('DOMContentLoaded', async function () {
  var box = document.getElementById('authLinks'); if (!box || !window.CH) return;
  try {
    var u = await CH.auth.user();
    if (!u) { box.innerHTML = '<a href="login.html">Connexion</a><a href="signup.html">Inscription</a>'; return; }
    box.innerHTML = '<a href="compte.html">Mon compte</a><a id="adminLink" href="admin.html" hidden>Admin</a><a href="#" id="logoutLink">Déconnexion</a>';
    document.getElementById('logoutLink').onclick = async function (e) { e.preventDefault(); await CH.auth.logout(); location.href = 'login.html'; };
    if (await CH.auth.isAdmin(u)) document.getElementById('adminLink').hidden = false;
  } catch (e) { console.warn(e); }
});
