-- Lignes de réservation — Lot B2.
--
-- Un simple offer_id sur bookings ne suffirait pas : un site touristique doit
-- pouvoir combiner « 2 adultes + 1 enfant + 1 visite guidée » dans une même
-- réservation. D'où une table de lignes.

create table if not exists booking_items (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references bookings(id) on delete cascade,
  offer_id uuid not null references establishment_offers(id),
  -- Nombre d'UNITÉS de cette offre : des chambres pour un hôtel, des billets
  -- pour un site. Un groupe de 5 dans une chambre de 4 consomme 2 chambres.
  quantity int not null check (quantity > 0),
  -- Prix gelé au moment de la réservation. Sans lui, une hausse de tarif
  -- réécrirait rétroactivement les revenus passés du partenaire : c'est une
  -- donnée comptable, pas une jointure.
  unit_price numeric not null check (unit_price >= 0),
  currency text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_items_booking on booking_items (booking_id);
create index if not exists idx_booking_items_offer on booking_items (offer_id);

-- Motif d'annulation : la spec demande d'annuler « avec un motif explicite »
-- quand le partenaire retire une catégorie. `notes` appartient au voyageur et
-- ne doit pas être écrasé, d'où une colonne dédiée.
alter table bookings
  add column if not exists cancellation_reason text;

-- ═══════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════

alter table booking_items enable row level security;

-- Le voyageur voit les lignes de ses réservations ; le partenaire celles des
-- réservations portant sur ses établissements. Même motif `exists (...)` en
-- ligne que le reste du schéma.
drop policy if exists "booking_items_select" on booking_items;
create policy "booking_items_select" on booking_items
  for select using (
    exists (
      select 1 from bookings b
      where b.id = booking_id
        and (
          b.traveler_id = auth.uid()
          or exists (
            select 1 from establishments e
            where e.id = b.establishment_id and e.owner_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "booking_items_insert_traveler" on booking_items;
create policy "booking_items_insert_traveler" on booking_items
  for insert with check (
    exists (select 1 from bookings b where b.id = booking_id and b.traveler_id = auth.uid())
  );

drop policy if exists "booking_items_admin_all" on booking_items;
create policy "booking_items_admin_all" on booking_items
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- Reprise des réservations existantes
-- ═══════════════════════════════════════════

-- Chaque réservation existante reçoit une ligne pointant vers l'offre la moins
-- chère de son établissement (celle qui servait déjà de « à partir de »).
--
-- Le prix de l'époque n'est pas récupérable : `bookings` n'a jamais stocké de
-- montant, et `rates` ne conserve aucun historique. On gèle donc le prix
-- ACTUEL de cette offre, faute de mieux — c'est signalé plutôt que masqué.
--
-- Les réservations dont l'établissement n'a aucune offre restent sans ligne :
-- elles n'ont jamais eu de prix, leur en inventer un serait faux.
insert into booking_items (booking_id, offer_id, quantity, unit_price, currency)
select
  b.id,
  o.id,
  1,
  o.price,
  o.currency
from bookings b
join lateral (
  select o2.id, o2.price, o2.currency
  from establishment_offers o2
  where o2.establishment_id = b.establishment_id
    and o2.is_active
  order by o2.price asc
  limit 1
) o on true
where not exists (select 1 from booking_items bi where bi.booking_id = b.id);
