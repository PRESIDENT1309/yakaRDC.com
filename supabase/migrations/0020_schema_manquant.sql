-- ============================================================================
--  Rattrapage : la moitié du schéma vivait hors des migrations
-- ============================================================================
--
--  Constat
--  -------
--  Le code applicatif utilise 18 tables ; les migrations n'en créaient que 10.
--  Huit tables, une vue, un type et deux fonctions avaient été créés
--  directement dans le tableau de bord Supabase, sans jamais être versionnés.
--
--  Conséquence : reconstruire la base depuis `supabase/migrations/` donnait une
--  application sans favoris, sans planificateur de voyage, sans réglages, sans
--  demandes de partenariat et sans journal d'administration. Le schéma n'était
--  pas reproductible.
--
--  Ce fichier a été écrit à partir d'une introspection de la base réelle
--  (pg_class, pg_constraint, pg_indexes, pg_policies) le 31/08/2026. Il décrit
--  l'existant ; il ne le modifie pas.
--
--  Idempotence
--  -----------
--  Tout est en `if not exists`, `create or replace`, ou précédé d'un
--  `drop ... if exists`. Le fichier peut donc être rejoué sur la base actuelle
--  sans effet, et suffit à recréer le schéma sur une base vierge.
--
--  Une réserve, signalée et NON corrigée ici
--  -----------------------------------------
--  `partner_requests.created_establishment_id` référence `establishments(id)`
--  SANS clause `on delete`. C'est ce qui a empêché la suppression des
--  établissements le 31/08 : Postgres refuse de supprimer une ligne encore
--  référencée. `on delete set null` serait plus juste — un établissement
--  supprimé ne laisse aucune information utile dans ce champ. Le changement
--  est proposé en fin de fichier, commenté : c'est une décision, pas un
--  constat, et ce fichier n'a vocation qu'à constater.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ── Type ────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'partner_request_status') then
    create type partner_request_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- ── Fonctions ───────────────────────────────────────────────────────────────

-- `is_admin()` est appelée par les politiques de `app_settings`. Sa définition
-- n'a pas pu être relue : on ne la crée donc QUE si elle manque, pour ne jamais
-- écraser l'implémentation en place. Le corps reproduit la vérification que les
-- autres politiques écrivent en toutes lettres.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
  ) then
    execute $f$
      create function public.is_admin() returns boolean
        language sql stable security definer set search_path = public
      as $b$
        select exists (
          select 1 from profiles where id = auth.uid() and role = 'admin'
        );
      $b$;
    $f$;
  end if;
end $$;

create or replace function public.increment_establishment_views(p_establishment_id uuid)
  returns void language sql security definer
as $$
  update establishments set view_count = view_count + 1 where id = p_establishment_id;
$$;

-- ── Journal d'administration ────────────────────────────────────────────────
create table if not exists admin_activity_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_log_created_idx on admin_activity_log (created_at desc);

-- ── Réglages de l'application ───────────────────────────────────────────────
-- Lecture publique : l'apparence du site (images de fond, etc.) est servie à
-- des visiteurs non connectés. L'écriture reste réservée aux administrateurs.
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- ── Avertissements adressés à un établissement ──────────────────────────────
create table if not exists establishment_warnings (
  id uuid primary key default uuid_generate_v4(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  issued_by uuid references profiles(id),
  reason text not null,
  created_at timestamptz not null default now()
);

-- ── Favoris ─────────────────────────────────────────────────────────────────
create table if not exists favorites (
  id uuid primary key default uuid_generate_v4(),
  traveler_id uuid not null references profiles(id) on delete cascade,
  establishment_id uuid not null references establishments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (traveler_id, establishment_id)
);
create index if not exists favorites_traveler_idx on favorites (traveler_id);

-- ── Demandes de partenariat ─────────────────────────────────────────────────
-- La table que les migrations 0011, 0014 et 0019 altéraient sans qu'aucune ne
-- la crée. Les colonnes ajoutées par ces trois migrations figurent ici : sur
-- une base vierge, elles s'appliqueront ensuite sans effet.
create table if not exists partner_requests (
  id uuid primary key default uuid_generate_v4(),
  establishment_type establishment_type not null,
  establishment_name text not null,
  description text,
  city text not null default 'Kinshasa',
  commune text,
  neighborhood text,
  avenue text,
  numero text,
  reference text,
  contact_name text not null,
  contact_phone text not null,
  contact_email text,
  photo_urls text[] not null default '{}'::text[],
  status partner_request_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_establishment_id uuid references establishments(id),
  user_id uuid references profiles(id) on delete set null,
  confirmation_sent_at timestamptz,
  credentials_sent boolean,
  credentials_error text,
  credentials_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists partner_requests_status_idx on partner_requests (status);
create index if not exists idx_partner_requests_user on partner_requests (user_id);
create index if not exists idx_partner_requests_credentials_ko
  on partner_requests (status) where credentials_sent is false;

-- ── Planificateur de voyage ─────────────────────────────────────────────────
create table if not exists trip_plans (
  id uuid primary key default uuid_generate_v4(),
  traveler_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'Mon voyage',
  destination text,
  start_date date not null,
  end_date date not null,
  traveler_count integer not null default 1,
  planned_budget numeric,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists trip_plans_traveler_idx on trip_plans (traveler_id);

create table if not exists trip_plan_items (
  id uuid primary key default uuid_generate_v4(),
  trip_plan_id uuid not null references trip_plans(id) on delete cascade,
  -- `set null` et non `cascade` : un établissement retiré du catalogue ne doit
  -- pas effacer l'étape que le voyageur avait prévue. Le titre saisi reste.
  establishment_id uuid references establishments(id) on delete set null,
  item_type text not null default 'itinerary'
    check (item_type = any (array['itinerary'::text, 'wishlist'::text])),
  day_date date,
  time text,
  title text not null,
  estimated_cost numeric not null default 0,
  actual_cost numeric,
  currency text not null default 'USD',
  notes text,
  visited boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists trip_plan_items_plan_idx on trip_plan_items (trip_plan_id);

create table if not exists trip_packing_items (
  id uuid primary key default uuid_generate_v4(),
  trip_plan_id uuid not null references trip_plans(id) on delete cascade,
  category text not null default 'custom'
    check (category = any (array['documents'::text, 'clothing'::text,
                                 'personal'::text, 'custom'::text])),
  label text not null,
  is_checked boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists trip_packing_items_plan_idx on trip_packing_items (trip_plan_id);

-- ── Vue des notes ───────────────────────────────────────────────────────────
-- Jointure externe volontaire : un établissement sans avis doit apparaître,
-- avec `avg_rating` à null — et non disparaître du résultat.
create or replace view establishment_ratings as
  select e.id as establishment_id,
         count(r.id)::integer as review_count,
         case when count(r.id) = 0 then null::numeric
              else round(avg(r.rating), 1) end as avg_rating
    from establishments e
    left join reviews r on r.establishment_id = e.id
   group by e.id;

-- ── Sécurité au niveau des lignes ───────────────────────────────────────────
alter table admin_activity_log      enable row level security;
alter table app_settings            enable row level security;
alter table establishment_warnings  enable row level security;
alter table favorites               enable row level security;
alter table partner_requests        enable row level security;
alter table trip_plans              enable row level security;
alter table trip_plan_items         enable row level security;
alter table trip_packing_items      enable row level security;

-- Postgres n'accepte pas `create policy if not exists` : on retire puis on
-- recrée. Dans une transaction, l'opération est atomique — aucune fenêtre
-- pendant laquelle la table serait sans protection.

drop policy if exists admin_log_admin_all on admin_activity_log;
create policy admin_log_admin_all on admin_activity_log
  for all using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists app_settings_public_read on app_settings;
create policy app_settings_public_read on app_settings
  for select using (true);
drop policy if exists app_settings_admin_write on app_settings;
create policy app_settings_admin_write on app_settings
  for insert with check (is_admin());
drop policy if exists app_settings_admin_update on app_settings;
create policy app_settings_admin_update on app_settings
  for update using (is_admin()) with check (is_admin());

drop policy if exists warnings_admin_all on establishment_warnings;
create policy warnings_admin_all on establishment_warnings
  for all using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
-- Le partenaire lit les avertissements qui le concernent : les lui cacher
-- reviendrait à le sanctionner sans le lui dire.
drop policy if exists warnings_select_owner on establishment_warnings;
create policy warnings_select_owner on establishment_warnings
  for select using (exists (
    select 1 from establishments e
    where e.id = establishment_warnings.establishment_id and e.owner_id = auth.uid()
  ));

drop policy if exists favorites_owner_all on favorites;
create policy favorites_owner_all on favorites
  for all using (traveler_id = auth.uid()) with check (traveler_id = auth.uid());

drop policy if exists partner_requests_admin_all on partner_requests;
create policy partner_requests_admin_all on partner_requests
  for all using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
-- Dépôt ouvert : un établissement peut candidater sans avoir de compte.
-- Voir 0015 — la relecture après insertion, elle, reste interdite.
drop policy if exists partner_requests_insert_public on partner_requests;
create policy partner_requests_insert_public on partner_requests
  for insert with check (true);
drop policy if exists partner_requests_select_own on partner_requests;
create policy partner_requests_select_own on partner_requests
  for select using (user_id = auth.uid());

drop policy if exists trip_plans_owner_all on trip_plans;
create policy trip_plans_owner_all on trip_plans
  for all using (traveler_id = auth.uid()) with check (traveler_id = auth.uid());

drop policy if exists trip_plan_items_owner_all on trip_plan_items;
create policy trip_plan_items_owner_all on trip_plan_items
  for all using (exists (
    select 1 from trip_plans tp
    where tp.id = trip_plan_items.trip_plan_id and tp.traveler_id = auth.uid()
  )) with check (exists (
    select 1 from trip_plans tp
    where tp.id = trip_plan_items.trip_plan_id and tp.traveler_id = auth.uid()
  ));

drop policy if exists trip_packing_items_owner_all on trip_packing_items;
create policy trip_packing_items_owner_all on trip_packing_items
  for all using (exists (
    select 1 from trip_plans tp
    where tp.id = trip_packing_items.trip_plan_id and tp.traveler_id = auth.uid()
  )) with check (exists (
    select 1 from trip_plans tp
    where tp.id = trip_packing_items.trip_plan_id and tp.traveler_id = auth.uid()
  ));

-- ============================================================================
--  Proposition — NON appliquée
--  --------------------------
--  La clé étrangère ci-dessous n'a pas de clause `on delete`. Supprimer un
--  établissement encore référencé par une demande est donc impossible, ce qui
--  a bloqué une suppression le 31/08. `set null` correspond à la réalité :
--  quand l'établissement disparaît, le pointeur n'a plus d'objet.
--
--  Décommentez si vous le souhaitez — c'est un changement de comportement,
--  pas un constat.
--
-- alter table partner_requests
--   drop constraint partner_requests_created_establishment_id_fkey,
--   add constraint partner_requests_created_establishment_id_fkey
--     foreign key (created_establishment_id) references establishments(id)
--     on delete set null;
-- ============================================================================
