-- Correctif de casse sur validate_ticket
--
-- qr_token est de type uuid : Postgres le rend toujours en minuscules, et c'est
-- cette forme minuscule qui est encodée dans le QR code du ticket. unique_code,
-- lui, est généré en majuscules ('YK-' || upper(...)).
-- L'ancienne comparaison exigeait donc que l'appelant devine la casse attendue,
-- selon qu'il transmettait un code court ou un jeton de QR. La fonction normalise
-- désormais elle-même chaque branche : elle accepte le code dans n'importe quelle
-- casse, quel que soit l'appelant.

create or replace function validate_ticket(p_code text, p_validator uuid)
returns table (
  booking_id uuid,
  already_used boolean,
  used_at timestamptz
) language plpgsql security definer as $$
declare
  v_booking bookings%rowtype;
  v_owns_establishment boolean;
begin
  select * into v_booking
  from bookings
  where unique_code = upper(p_code) or qr_token::text = lower(p_code)
  for update;

  if not found then
    raise exception 'Code introuvable';
  end if;

  select exists (
    select 1 from establishments e
    where e.id = v_booking.establishment_id and e.owner_id = p_validator
  ) into v_owns_establishment;

  if not v_owns_establishment then
    raise exception 'Ce code n''appartient pas à un de vos établissements';
  end if;

  if v_booking.used_at is not null then
    return query select v_booking.id, true, v_booking.used_at;
    return;
  end if;

  update bookings
  set status = 'checked_in', used_at = now(), validated_by = p_validator
  where id = v_booking.id;

  return query select v_booking.id, false, now();
end;
$$;
