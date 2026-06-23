-- Yaka — Schéma initial
-- À exécuter dans l'éditeur SQL de Supabase (ou via la CLI Supabase)

create extension if not exists "uuid-ossp";

-- Types

create type user_role as enum ('traveler', 'partner', 'admin');
create type establishment_type as enum ('hotel', 'furnished_house', 'restaurant', 'site');
create type establishment_status as enum ('pending', 'approved', 'rejected');
create type booking_status as enum ('pending', 'confirmed', 'rejected', 'checked_in', 'cancelled');
create type payment_status as enum ('unpaid', 'paid', 'refunded');
create type rate_unit as enum ('night', 'person', 'visit');

-- Tables

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text unique,
  email text unique,
  role user_role not null default 'traveler',
  created_at timestamptz not null default now()
);

create table cities (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  is_active boolean not null default true
);

create table establishments (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  type establishment_type not null,
  name text not null,
  description text,
  city text not null,
  neighborhood text,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  amenities text[] not null default '{}',
  status establishment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index establishments_owner_idx on establishments(owner_id);
create index establishments_type_city_idx on establishments(type, city) where status = 'approved';

create table listing_photos (
  id uuid primary key default uuid_generate_v4(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  url text not null,
  position int not null default 0
);

create table rates (
  id uuid primary key default uuid_generate_v4(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  price numeric not null,
  unit rate_unit not null,
  currency text not null default 'USD'
);

create table bookings (
  id uuid primary key default uuid_generate_v4(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  traveler_id uuid not null references profiles(id) on delete cascade,
  status booking_status not null default 'pending',
  -- payment_status est prévu pour la Phase 3 (intégration CinetPay) et n'est pas utilisé en V1
  payment_status payment_status not null default 'unpaid',
  check_in date,
  check_out date,
  guests int,
  visit_date date,
  visit_time time,
  notes text,
  unique_code text unique,
  qr_token uuid unique not null default uuid_generate_v4(),
  used_at timestamptz,
  validated_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index bookings_traveler_idx on bookings(traveler_id);
create index bookings_establishment_idx on bookings(establishment_id);

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  traveler_id uuid not null references profiles(id) on delete cascade,
  booking_id uuid references bookings(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- Génère le code court à la confirmation d'une réservation (ex. YK-4F9X2A)

create or replace function generate_booking_code()
returns trigger language plpgsql as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' and new.unique_code is null then
    new.unique_code := 'YK-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 7));
  end if;
  return new;
end;
$$;

create trigger trg_generate_booking_code
before update on bookings
for each row execute function generate_booking_code();

-- Validation du ticket à usage unique (appelée en RPC depuis l'écran de scan du partenaire)
-- p_code accepte soit le code court (unique_code), soit le jeton du QR (qr_token)

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
  where unique_code = p_code or qr_token::text = p_code
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

-- Row Level Security

alter table profiles enable row level security;
alter table establishments enable row level security;
alter table listing_photos enable row level security;
alter table rates enable row level security;
alter table bookings enable row level security;
alter table reviews enable row level security;
alter table cities enable row level security;

-- profiles : chacun lit/modifie son propre profil ; un partenaire lit le profil
-- d'un voyageur uniquement si ce voyageur a une réservation sur un de ses établissements
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_select_for_partner_bookings" on profiles
  for select using (
    exists (
      select 1 from bookings b
      join establishments e on e.id = b.establishment_id
      where b.traveler_id = profiles.id and e.owner_id = auth.uid()
    )
  );

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- establishments : lecture publique des établissements approuvés, gestion par le propriétaire
create policy "establishments_select_approved" on establishments
  for select using (status = 'approved' or owner_id = auth.uid());

create policy "establishments_insert_owner" on establishments
  for insert with check (owner_id = auth.uid());

create policy "establishments_update_owner" on establishments
  for update using (owner_id = auth.uid());

create policy "establishments_admin_all" on establishments
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- listing_photos et rates : lisibles si l'établissement est visible, modifiables par le propriétaire
create policy "photos_select" on listing_photos
  for select using (
    exists (select 1 from establishments e where e.id = establishment_id and (e.status = 'approved' or e.owner_id = auth.uid()))
  );

create policy "photos_manage_owner" on listing_photos
  for all using (
    exists (select 1 from establishments e where e.id = establishment_id and e.owner_id = auth.uid())
  );

create policy "rates_select" on rates
  for select using (
    exists (select 1 from establishments e where e.id = establishment_id and (e.status = 'approved' or e.owner_id = auth.uid()))
  );

create policy "rates_manage_owner" on rates
  for all using (
    exists (select 1 from establishments e where e.id = establishment_id and e.owner_id = auth.uid())
  );

-- bookings : le voyageur voit ses réservations, le partenaire voit celles de ses établissements
create policy "bookings_select_traveler" on bookings
  for select using (traveler_id = auth.uid());

create policy "bookings_select_partner" on bookings
  for select using (
    exists (select 1 from establishments e where e.id = establishment_id and e.owner_id = auth.uid())
  );

create policy "bookings_insert_traveler" on bookings
  for insert with check (traveler_id = auth.uid());

create policy "bookings_update_partner" on bookings
  for update using (
    exists (select 1 from establishments e where e.id = establishment_id and e.owner_id = auth.uid())
  );

create policy "bookings_admin_all" on bookings
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- reviews : lecture publique, écriture par le voyageur concerné
create policy "reviews_select_all" on reviews
  for select using (true);

create policy "reviews_insert_traveler" on reviews
  for insert with check (traveler_id = auth.uid());

-- cities : lecture publique
create policy "cities_select_all" on cities
  for select using (true);

insert into cities (name) values ('Kinshasa');
