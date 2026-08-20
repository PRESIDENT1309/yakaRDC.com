-- Correction du calcul de disponibilité.
--
-- CONSTAT (audit du 19/08/2026) : establishment_daily_load retournait
-- `guests: 1` pour TOUT jour de la plage demandée, quel que soit
-- l'établissement, y compris en janvier 2019 — des années avant la première
-- réservation. Elle ne mesurait donc aucune occupation réelle.
--
-- Le diagnostic retenu est qu'un `coalesce(b.guests, 1)` était évalué sur la
-- ligne nulle produite par un LEFT JOIN sans correspondance : le coalesce
-- devait couvrir une réservation sans nombre de voyageurs, pas l'absence de
-- réservation. La fonction est ici réécrite entièrement plutôt que rustinée,
-- de façon que sa sémantique soit lisible et vérifiable.
--
-- SÉMANTIQUE RETENUE
--   Hôtel / maison meublée : une réservation du 20 au 23 occupe les nuits du
--     20, 21 et 22 — pas celle du 23, jour du départ. D'où `check_out` exclu.
--   Restaurant / site       : seul le jour de visit_date est occupé.
--   Statuts comptés         : 'pending', 'confirmed', 'checked_in'.
--     'cancelled' et 'rejected' libèrent la place et sont ignorés.
--   Occupation d'une ligne  : adultes + enfants. Un enfant occupe une place.
--
-- Un jour sans réservation retourne 0 — il n'est plus omis, pour que
-- l'appelant puisse distinguer « aucune donnée » de « libre ».

create or replace function establishment_daily_load(
  p_establishment_id uuid,
  p_from date,
  p_to   date
)
returns table (day date, guests integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    d::date as day,
    coalesce(sum(
      coalesce(b.guests, 0) + coalesce(b.children, 0)
    ), 0)::integer as guests
  from generate_series(p_from, p_to, interval '1 day') as d
  -- LEFT JOIN : les jours sans réservation restent présents, à 0.
  left join bookings b
    on b.establishment_id = p_establishment_id
   and b.status in ('pending', 'confirmed', 'checked_in')
   and (
     -- Séjour : départ exclu
     (b.check_in is not null and b.check_out is not null
       and d::date >= b.check_in and d::date < b.check_out)
     -- Visite datée : le seul jour concerné
     or (b.visit_date is not null and d::date = b.visit_date)
   )
  -- L'établissement doit exister : sinon la fonction retourne un ensemble vide
  -- plutôt qu'une plage de zéros, ce qui distingue « inconnu » de « libre ».
  where exists (select 1 from establishments e where e.id = p_establishment_id)
  group by d
  order by d;
$$;

-- Charge par créneau horaire, pour un jour donné (restaurant / site).
-- Même correction de principe : seules les réservations réelles comptent, et
-- un créneau sans réservation n'apparaît simplement pas (l'appelant traite
-- l'absence comme 0, ce que fait déjà `slotLoads[s] ?? 0` côté application).
create or replace function establishment_slot_load(
  p_establishment_id uuid,
  p_date date
)
returns table (slot text, guests integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.visit_time as slot,
    sum(coalesce(b.guests, 0) + coalesce(b.children, 0))::integer as guests
  from bookings b
  where b.establishment_id = p_establishment_id
    and b.visit_date = p_date
    and b.visit_time is not null
    and b.status in ('pending', 'confirmed', 'checked_in')
  group by b.visit_time
  order by b.visit_time;
$$;

grant execute on function establishment_daily_load(uuid, date, date) to anon, authenticated;
grant execute on function establishment_slot_load(uuid, date) to anon, authenticated;
