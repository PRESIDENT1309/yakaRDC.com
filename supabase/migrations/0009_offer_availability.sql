-- Disponibilité par offre — Lot B2.
--
-- Jusqu'ici l'occupation se comparait à `establishments.capacity`, une valeur
-- unique pour tout l'établissement (et vide partout). Conséquence : « Suite
-- complète » bloquait aussi la Standard. Le calcul raisonne désormais offre
-- par offre.
--
-- DISTINCTION CENTRALE, source d'erreur principale de ce modèle :
--   quantity   = nombre d'unités de ce type (8 chambres Standard)
--   max_guests = capacité d'UNE unité (2 personnes par chambre)
-- Une réservation de 2 personnes en Standard consomme UNE chambre, pas deux
-- places. C'est pourquoi l'occupation se mesure en unités (booking_items.
-- quantity), jamais en voyageurs.

-- Charge par offre sur une plage de dates.
-- Renvoie une ligne par (offre, jour) — l'appelant traite l'absence comme 0.
create or replace function establishment_offer_load(
  p_establishment_id uuid,
  p_from date,
  p_to   date
)
returns table (offer_id uuid, day date, units integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id as offer_id,
    d::date as day,
    coalesce(sum(bi.quantity), 0)::integer as units
  from establishment_offers o
  cross join generate_series(p_from, p_to, interval '1 day') as d
  left join booking_items bi on bi.offer_id = o.id
  left join bookings b
    on b.id = bi.booking_id
   and b.status in ('pending', 'confirmed', 'checked_in')
   and (
     -- Séjour : la nuit du départ n'est pas occupée
     (b.check_in is not null and b.check_out is not null
       and d::date >= b.check_in and d::date < b.check_out)
     -- Visite datée : le seul jour concerné
     or (b.visit_date is not null and d::date = b.visit_date)
   )
  where o.establishment_id = p_establishment_id
    and o.is_active
    -- Écarte les lignes dont la réservation ne chevauche pas ce jour : sans
    -- cette condition, le LEFT JOIN sur bookings laisserait passer bi avec
    -- b nul et compterait la ligne sur TOUS les jours de la plage — c'est
    -- exactement le bug qui rendait establishment_daily_load constante.
    and (bi.id is null or b.id is not null)
  group by o.id, d
  order by o.id, d;
$$;

-- Charge par offre pour un créneau horaire donné (restaurant / site).
create or replace function establishment_offer_slot_load(
  p_establishment_id uuid,
  p_date date
)
returns table (offer_id uuid, slot text, units integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    bi.offer_id,
    b.visit_time as slot,
    sum(bi.quantity)::integer as units
  from booking_items bi
  join bookings b on b.id = bi.booking_id
  join establishment_offers o on o.id = bi.offer_id
  where o.establishment_id = p_establishment_id
    and b.visit_date = p_date
    and b.visit_time is not null
    and b.status in ('pending', 'confirmed', 'checked_in')
  group by bi.offer_id, b.visit_time
  order by b.visit_time;
$$;

grant execute on function establishment_offer_load(uuid, date, date) to anon, authenticated;
grant execute on function establishment_offer_slot_load(uuid, date) to anon, authenticated;

-- ═══════════════════════════════════════════
-- Contrainte de capacité — bascule sur l'offre
-- ═══════════════════════════════════════════

-- La 0004 vérifiait `establishments.capacity`. Elle doit désormais vérifier la
-- quantité de l'offre concernée. Le contrôle se déplace donc de bookings vers
-- booking_items : c'est la ligne qui porte l'offre et le nombre d'unités.
--
-- `quantity` à null sur l'offre = aucune limite, exactement comme capacity null
-- auparavant. La contrainte reste donc inerte tant que le partenaire n'a rien
-- déclaré.
create or replace function check_offer_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer     establishment_offers%rowtype;
  v_booking   bookings%rowtype;
  v_existing  integer;
  v_day       date;
begin
  select * into v_offer from establishment_offers where id = new.offer_id;
  if not found or v_offer.quantity is null then
    return new; -- offre sans limite déclarée
  end if;

  select * into v_booking from bookings where id = new.booking_id;
  if not found or v_booking.status in ('cancelled', 'rejected') then
    return new;
  end if;

  if v_booking.visit_date is not null then
    select coalesce(sum(bi.quantity), 0) into v_existing
    from booking_items bi
    join bookings b on b.id = bi.booking_id
    where bi.offer_id = new.offer_id
      and bi.id <> new.id
      and b.status in ('pending', 'confirmed', 'checked_in')
      and b.visit_date = v_booking.visit_date
      and (v_booking.visit_time is null or b.visit_time is not distinct from v_booking.visit_time);

    if v_existing + new.quantity > v_offer.quantity then
      raise exception
        'OFFER_FULL: il ne reste que % place(s) pour cette date.',
        greatest(v_offer.quantity - v_existing, 0)
        using errcode = 'check_violation';
    end if;

  elsif v_booking.check_in is not null and v_booking.check_out is not null then
    -- Une seule nuit saturée suffit à refuser : accepter reviendrait à
    -- promettre un séjour impossible à honorer jusqu'au bout.
    for v_day in
      select d::date from generate_series(v_booking.check_in, v_booking.check_out - 1, interval '1 day') d
    loop
      select coalesce(sum(bi.quantity), 0) into v_existing
      from booking_items bi
      join bookings b on b.id = bi.booking_id
      where bi.offer_id = new.offer_id
        and bi.id <> new.id
        and b.status in ('pending', 'confirmed', 'checked_in')
        and b.check_in is not null and b.check_out is not null
        and v_day >= b.check_in and v_day < b.check_out;

      if v_existing + new.quantity > v_offer.quantity then
        raise exception
          'OFFER_FULL: la nuit du % est complète (% unité(s) restante(s)).',
          to_char(v_day, 'DD/MM/YYYY'), greatest(v_offer.quantity - v_existing, 0)
          using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_offer_capacity on booking_items;
create trigger trg_check_offer_capacity
  after insert on booking_items
  for each row
  execute function check_offer_capacity();

-- L'ancienne contrainte, portée par establishments.capacity, n'a plus d'objet.
-- Elle est retirée ici pour éviter qu'un même dépassement soit vérifié deux
-- fois selon deux règles différentes.
drop trigger if exists trg_check_booking_capacity on bookings;
drop function if exists check_booking_capacity();
