-- =====================================================================
-- CreatHub – ÉTAPE 3/3 : commandes (relançable sans perdre de commandes)
-- Prérequis : supabase-setup.sql exécuté. Paiement : SIMULATION uniquement.
-- Livraison : 8,00 DT, offerte à partir de 150,00 DT (modifiez v_free_from / v_ship_fee
-- ici ET SHIPPING dans supabase-shop.js).
-- =====================================================================
create table if not exists public.orders (
  id              bigint generated always as identity primary key,
  reference       text not null unique,
  user_id         uuid not null references auth.users(id) on delete restrict,
  attempt_id      uuid not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  items           jsonb not null,
  customer_name   text not null check (char_length(customer_name) between 2 and 80),
  phone           text not null check (phone ~ '^\+?[0-9 ]{8,15}$'),
  address         text not null check (char_length(address) between 6 and 250),
  city            text not null check (char_length(city) between 2 and 80),
  payment_method  text not null check (payment_method in ('cod','bank_transfer_demo')),
  subtotal_cents  integer not null check (subtotal_cents >= 0),
  shipping_cents  integer not null check (shipping_cents >= 0),
  total_cents     integer not null,
  status          text not null default 'new' check (status in ('new','preparing','done','cancelled')),
  constraint orders_total_ok check (total_cents = subtotal_cents + shipping_cents),
  constraint orders_attempt_unique unique (user_id, attempt_id)
);
create index if not exists orders_user_idx on public.orders (user_id, id desc);

create or replace function public.touch_order() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end $$;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_order();

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;   -- l'admin ne peut changer que le statut
drop policy if exists orders_read   on public.orders;
drop policy if exists orders_status on public.orders;
create policy orders_read   on public.orders for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy orders_status on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Création de commande : montants recalculés depuis le catalogue, propriétaire = auth.uid().
create or replace function public.create_demo_order(
  p_attempt_id uuid, p_items jsonb, p_customer_name text, p_phone text,
  p_address text, p_city text, p_payment_method text, p_expected_total_cents integer)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders; v_prod public.products; r record;
  v_sub integer := 0; v_ship integer; v_total integer; v_snap jsonb := '[]'::jsonb;
  v_ship_fee constant integer := 800; v_free_from constant integer := 15000;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_order from public.orders where user_id = v_uid and attempt_id = p_attempt_id;
  if found then return v_order; end if;                       -- nouvelle tentative identique : pas de doublon
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 40 then raise exception 'INVALID_CART'; end if;
  for r in
    select e->>'id' as id, sum((e->>'qty')::integer) as qty
    from jsonb_array_elements(p_items) e
    where (e->>'qty') ~ '^[0-9]{1,2}$' group by 1
  loop
    if r.qty < 1 or r.qty > 20 then raise exception 'INVALID_CART'; end if;
    select * into v_prod from public.products where id = r.id and available;
    if not found then raise exception 'PRODUCT_UNAVAILABLE:%', r.id; end if;
    v_sub := v_sub + v_prod.price_cents * r.qty;
    v_snap := v_snap || jsonb_build_object('id', v_prod.id, 'name', v_prod.name, 'price_cents', v_prod.price_cents, 'qty', r.qty, 'line_cents', v_prod.price_cents * r.qty);
  end loop;
  if jsonb_array_length(v_snap) = 0 then raise exception 'INVALID_CART'; end if;
  v_ship := case when v_sub >= v_free_from then 0 else v_ship_fee end;
  v_total := v_sub + v_ship;
  if p_expected_total_cents is distinct from v_total then raise exception 'PRICE_CHANGED:%', v_total; end if;
  begin
    insert into public.orders (reference, user_id, attempt_id, items, customer_name, phone, address, city, payment_method, subtotal_cents, shipping_cents, total_cents)
    values ('CH-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
            v_uid, p_attempt_id, v_snap, btrim(p_customer_name), btrim(p_phone), btrim(p_address), btrim(p_city), p_payment_method, v_sub, v_ship, v_total)
    returning * into v_order;
  exception when unique_violation then
    select * into v_order from public.orders where user_id = v_uid and attempt_id = p_attempt_id;
    if not found then raise; end if;
  end;
  return v_order;
end $$;
revoke all on function public.create_demo_order(uuid, jsonb, text, text, text, text, text, integer) from public, anon;
grant execute on function public.create_demo_order(uuid, jsonb, text, text, text, text, text, integer) to authenticated;
