-- Contrôle de capacité au moment de l'insertion d'une réservation.
--
-- CONSTAT (audit du 19/08/2026) : la vérification de capacité n'existait
-- QU'À L'AFFICHAGE. Deux personnes réservant simultanément pouvaient dépasser
-- la capacité sans que rien ne s'y oppose.
--
-- NUANCE ESSENTIELLE : `establishments.capacity` est null sur les 11
-- établissements existants. La contrainte ne doit donc RIEN bloquer quand la
-- capacité n'est pas définie — sinon toutes les réservations échoueraient
-- d'un coup. `null` = aucune limite, exactement comme le fait l'affichage.
--
-- Un trigger BEFORE INSERT, et non une CHECK constraint : la règle dépend des
-- autres lignes de la table, ce qu'une CHECK ne peut pas exprimer.

create or replace function check_booking_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity  integer;
  v_requested integer;
  v_existing  integer;
  v_day       date;
begin
  -- Les statuts qui ne consomment pas de place n'ont rien à vérifier.
  if new.status in ('cancelled', 'rejected') then
    return new;
  end if;

  select capacity into v_capacity
  from establishments
  where id = new.establishment_id;

  -- Capacité non définie => aucune limite. C'est le cas de tous les
  -- établissements aujourd'hui : la contrainte est inerte tant que le
  -- partenaire n'a rien saisi.
  if v_capacity is null then
    return new;
  end if;

  v_requested := coalesce(new.guests, 0) + coalesce(new.children, 0);

  if new.visit_date is not null then
    -- Visite datée : on compare sur le créneau si présent, sinon sur la journée.
    select coalesce(sum(coalesce(b.guests, 0) + coalesce(b.children, 0)), 0)
      into v_existing
    from bookings b
    where b.establishment_id = new.establishment_id
      and b.status in ('pending', 'confirmed', 'checked_in')
      and b.visit_date = new.visit_date
      and (new.visit_time is null or b.visit_time is not distinct from new.visit_time);

    if v_existing + v_requested > v_capacity then
      raise exception
        'CAPACITY_EXCEEDED: il ne reste que % place(s) pour cette date.',
        greatest(v_capacity - v_existing, 0)
        using errcode = 'check_violation';
    end if;

  elsif new.check_in is not null and new.check_out is not null then
    -- Séjour : on vérifie chaque nuit, départ exclu. Une seule nuit saturée
    -- suffit à refuser — sinon on accepterait un séjour impossible à honorer.
    for v_day in
      select d::date
      from generate_series(new.check_in, new.check_out - 1, interval '1 day') d
    loop
      select coalesce(sum(coalesce(b.guests, 0) + coalesce(b.children, 0)), 0)
        into v_existing
      from bookings b
      where b.establishment_id = new.establishment_id
        and b.status in ('pending', 'confirmed', 'checked_in')
        and b.check_in is not null and b.check_out is not null
        and v_day >= b.check_in and v_day < b.check_out;

      if v_existing + v_requested > v_capacity then
        raise exception
          'CAPACITY_EXCEEDED: la nuit du % est complète (% place(s) restante(s)).',
          to_char(v_day, 'DD/MM/YYYY'), greatest(v_capacity - v_existing, 0)
          using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_booking_capacity on bookings;

create trigger trg_check_booking_capacity
  before insert on bookings
  for each row
  execute function check_booking_capacity();
