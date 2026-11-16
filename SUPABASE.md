# CreatHub × Supabase : guide complet

Tous les fichiers sont à placer **à la racine de votre site** (le dossier qui contient `index.html`) :
`supabase-client.js`, `supabase-shop.js`, `header.js`, `script.js`, `creathub-pages.css`, `signup.html`, `login.html`, `verification.html`, `compte.html`, `admin.html`, `shop.html`.
Les trois fichiers `.sql` ne sont **pas** déployés : ils servent seulement dans Supabase (SQL Editor).

> Ces pages sont une base de référence. Si votre site a déjà une boutique et un panier, gardez-les et branchez-les sur `CH` (`supabase-shop.js`) : `CH.cart` (panier), `CH.catalog.list()` (produits), `CH.orders.create()` (commande), `CH.auth.*` (comptes). Si `script.js` existe déjà chez vous, **fusionnez** : ne l'écrasez pas.

## 1. Créer le projet Supabase
1. supabase.com → **New project** → nom, mot de passe de base (gardez-le pour vous : il n'est jamais utilisé dans le site), région proche (Europe).
2. Attendez la fin de la création.

## 2. Récupérer l'URL et la clé publique
1. **Project Settings → API Keys**.
2. Copiez **Project URL** et la clé **Publishable** (`sb_publishable_…`).
3. Collez-les dans `supabase-client.js`. N'utilisez **jamais** la clé *secret* / *service_role* dans le site.

## 3. Exécuter les scripts SQL (dans cet ordre)
**SQL Editor → New query**, collez, **Run** :
1. `supabase-setup.sql` : base **neuve** uniquement (produits, rôles, RLS, 6 produits d'exemple).
   Si vous avez déjà des tables `products` ou `user_roles`, arrêtez-vous et envoyez-moi leur schéma.
2. `supabase-orders.sql` : commandes + fonction `create_demo_order` (relançable sans perte).
3. `supabase-admin.sql` : **après** l'étape 4 ci-dessous.

## 4. Configurer l'authentification
**Authentication → URL Configuration** :
- *Site URL* : `http://localhost:8000` pendant les tests (puis votre adresse Vercel).
- *Redirect URLs* : ajoutez `http://localhost:8000/**` **et** `https://VOTRE-SITE.vercel.app/**`.

**Authentication → Providers → Email** : laissez « Confirm email » activé.
Le service d'e-mail par défaut de Supabase est limité en nombre d'envois et peut finir en courrier indésirable : pour un vrai site, configurez un SMTP (Authentication → SMTP Settings).

## 5. Créer le compte administrateur
1. Ouvrez `signup.html`, inscrivez-vous avec **votre** e-mail, cliquez le lien reçu.
2. **Authentication → Users** : copiez l'**UUID** de ce compte.
3. Dans `supabase-admin.sql`, remplacez `VOTRE-UUID`, puis exécutez-le.
4. Reconnectez-vous : le lien **Admin** apparaît. Un compte sans ligne dans `user_roles` est un client.

## 6. Lancer en local
```
cd dossier-du-site
python -m http.server 8000      # ou l'extension Live Server de VS Code (adaptez l'URL Auth)
```
Ouvrez `http://localhost:8000/shop.html`.

## 7. Déployer sur Vercel
1. Poussez le dossier sur GitHub (sans `.env` ni secrets : il n'y en a pas dans ce site).
2. vercel.com → **Add New → Project** → importez le dépôt.
3. **Framework Preset : Other**. **Root Directory** : le dossier qui contient `index.html`. **Build Command** : vide. **Output Directory** : vide (ou `.`).
4. **Deploy**, puis copiez l'adresse `https://xxx.vercel.app`.
5. Dans Supabase (section 4) : ajoutez cette URL à *Site URL* et *Redirect URLs*.
6. Refaites les tests de la section 8 **sur l'adresse HTTPS** (inscription, e-mail, commande, admin).
Si votre projet utilise un framework (React, Vite…), adaptez Preset, Build Command et Output Directory à sa vraie compilation.

## 8. Tests à faire sur VOTRE projet (je n'ai pas pu les exécuter)
Le SQL Editor (propriétaire) contourne le RLS : testez avec de vraies sessions.
| Acteur | À vérifier |
|---|---|
| Visiteur | voit les produits ; `compte.html` et `admin.html` le renvoient vers la connexion ; aucune commande lisible |
| Client A | commande OK ; voit **ses** commandes ; `admin.html` affiche « Accès refusé » |
| Client B | ne voit pas les commandes de A ; ne peut pas ajouter/modifier un produit |
| Admin | voit toutes les commandes, change un statut, ajoute/modifie/supprime un produit (visible aussitôt dans `shop.html`) |
Test réseau : coupez le réseau pendant « Confirmer la commande », rétablissez, recommencez : une seule commande doit exister.
Test prix : changez un prix dans l'admin avec un panier ouvert : la commande est refusée (« un prix a changé »).

## 9. Erreurs fréquentes
- **« Supabase n'est pas configuré »** : URL/clé non remplacées dans `supabase-client.js`.
- **« Email not confirmed »** : cliquez le lien reçu ; vérifiez les courriers indésirables.
- **Le lien d'e-mail mène à localhost ou une erreur** : *Site URL* / *Redirect URLs* incomplètes.
- **Produits vides** : `supabase-setup.sql` non exécuté, ou produits décochés « Visible ».
- **« permission denied » / « row-level security »** : normal pour un compte non admin ; sinon vérifiez la ligne dans `user_roles`.
- **Commande refusée (PRICE_CHANGED)** : un prix a changé, rechargez la page.
- **429 / e-mail non reçu** : limite d'envoi du SMTP par défaut ; configurez un SMTP.

## 10. Ce qui reste hors périmètre
Paiement réel (simulation seulement, aucune donnée bancaire), récupération de mot de passe (non implémentée), téléversement d'images (URL HTTPS ou fichier du site), import des anciennes commandes ou anciens comptes locaux.
