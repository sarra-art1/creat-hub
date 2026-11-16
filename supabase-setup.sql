-- =====================================================================
-- CreatHub – ÉTAPE 1/3 : catalogue, rôles, RLS
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor, sur une base NEUVE.
-- Si les tables products / user_roles existent déjà, NE LANCEZ PAS ce fichier :
-- envoyez-moi leur schéma pour que je prépare une migration compatible.
-- Prix : stockés en centièmes de dinar (1250 = 12,50 DT). Affichage : 2 décimales.
-- =====================================================================
create table public.products (
  id           text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  name         text not null check (char_length(name) between 2 and 120),
  category     text not null check (category in ('painting','ceramics','crafts','photo','digital','sculpture','illustration','graphic','jewelry','decor','other')),
  description  text not null default '' check (char_length(description) <= 3000),
  price_cents  integer not null check (price_cents > 0 and price_cents <= 100000000),
  image        text not null default '' check (image = '' or image ~ '^(https://[^[:space:]]+|[A-Za-z0-9_./-]+)$'),
  features     text[] not null default '{}',
  available    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);  -- Pas de ligne = compte client.

-- Test d'administrateur utilisé par les politiques. Lecture du rôle côté serveur uniquement.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.products   enable row level security;
alter table public.user_roles enable row level security;
revoke all on public.products, public.user_roles from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;   -- limité aux admins par les politiques
grant select on public.user_roles to authenticated;                 -- aucune écriture depuis le navigateur

create policy products_read_available on public.products for select to anon, authenticated using (available = true);
create policy products_read_admin     on public.products for select to authenticated using (public.is_admin());
create policy products_insert_admin   on public.products for insert to authenticated with check (public.is_admin());
create policy products_update_admin   on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_delete_admin   on public.products for delete to authenticated using (public.is_admin());
create policy roles_read_own          on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
-- Volontairement AUCUNE politique ni droit d'écriture sur user_roles.

-- Données de démonstration (exemples fictifs, sans photo : ajoutez vos vraies images depuis l'admin)
insert into public.products (id, name, category, description, price_cents, features) values
 ('vase-ceramique-main','Vase en céramique fait main','ceramics','Exemple de démonstration : vase tourné à la main, émail bleu.',8500,'{"Hauteur 24 cm","Grès émaillé"}'),
 ('aquarelle-medina','Aquarelle originale – Médina','painting','Exemple de démonstration : aquarelle sur papier coton.',12000,'{"30 x 40 cm","Papier 300 g"}'),
 ('tirage-photo-ruelles','Tirage photo – Ruelles bleues','photo','Exemple de démonstration : tirage fine art signé.',7500,'{"30 x 45 cm","Édition limitée"}'),
 ('decoration-traditionnelle','Décoration traditionnelle faite main','crafts','Exemple de démonstration : décoration murale artisanale.',6500,'{"Fait main"}'),
 ('illustration-numerique','Illustration numérique','digital','Exemple de démonstration : impression A3.',5000,'{"A3","Impression pigmentaire"}'),
 ('collier-argent','Collier artisanal en argent','jewelry','Exemple de démonstration : collier en argent 925.',11000,'{"Argent 925","Longueur 45 cm"}');
