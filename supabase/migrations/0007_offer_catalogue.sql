-- Catalogue d'offres — Lot B1.
--
-- Met en place le modèle de données et le pont avec `rates`. RIEN ne change
-- côté voyageur : la fiche, la recherche et les formulaires continuent de lire
-- `rates`, qui est désormais alimentée automatiquement par les offres.
--
-- Numérotée 0007 et non 0006 : une tâche parallèle corrige le scan QR et doit
-- créer 0006. Le trou est volontaire, pour éviter une collision de nom.
--
-- Un seul fichier, délibérément : les quatre parties (référentiel, offres,
-- photos, pont) n'ont aucun sens appliquées séparément. Une application
-- partielle laisserait des offres sans catégories, ou un pont sans offres.

-- ═══════════════════════════════════════════
-- 1. Référentiel des catégories
-- ═══════════════════════════════════════════

create table if not exists offer_categories (
  id uuid primary key default uuid_generate_v4(),
  establishment_type text not null
    check (establishment_type in ('hotel','furnished_house','restaurant','site')),
  key text not null,
  label text not null,
  description_hint text,
  position int not null default 0,
  is_active boolean not null default true,
  unique (establishment_type, key)
);

-- Hôtel — ordre = progression de gamme, tirée de l'hôtellerie réelle de
-- Kinshasa (Pullman, Fleuve Congo, Sultani). « Suite Diplomatique » est
-- propre à la place : la Gombe accueille les ambassades et cette clientèle a
-- sa catégorie dédiée, absente des nomenclatures internationales.
insert into offer_categories (establishment_type, key, label, description_hint, position) values
  ('hotel','standard','Standard','Chambre de base, l''essentiel bien fait',1),
  ('hotel','superieure','Supérieure','Plus grande ou mieux située que la Standard',2),
  ('hotel','prestige','Prestige','Finitions soignées, étage ou vue privilégiés',3),
  ('hotel','deluxe','Deluxe','Plus spacieuse, équipements supérieurs',4),
  ('hotel','executive','Exécutive','Pensée pour les séjours d''affaires : bureau, accès salon',5),
  ('hotel','familiale','Familiale','Couchages supplémentaires pour une famille',6),
  ('hotel','junior_suite','Junior Suite','Chambre agrandie avec coin salon, sans cloison',7),
  ('hotel','suite','Suite','Chambre et salon séparés',8),
  ('hotel','suite_prestige','Suite Prestige','Suite haut de gamme, services renforcés',9),
  ('hotel','suite_diplomatique','Suite Diplomatique','Séjours officiels : discrétion et salon de réception',10),
  ('hotel','suite_presidentielle','Suite Présidentielle','La plus vaste de l''établissement',11)
on conflict (establishment_type, key) do nothing;

insert into offer_categories (establishment_type, key, label, description_hint, position) values
  ('furnished_house','logement_entier','Logement entier','Le logement complet est réservé au voyageur seul',1),
  ('furnished_house','chambre_privee','Chambre privée','Une chambre privative, espaces communs partagés',2)
on conflict (establishment_type, key) do nothing;

insert into offer_categories (establishment_type, key, label, description_hint, position) values
  ('restaurant','menu_du_jour','Menu du jour','Proposition qui change régulièrement, à prix fixe',1),
  ('restaurant','formule_dejeuner','Formule déjeuner','Servie le midi, généralement plus rapide',2),
  ('restaurant','formule_diner','Formule dîner','Servie le soir',3),
  ('restaurant','menu_degustation','Menu dégustation','Plusieurs services, l''expérience complète',4),
  ('restaurant','brunch','Brunch','Fin de matinée, le week-end le plus souvent',5)
on conflict (establishment_type, key) do nothing;

insert into offer_categories (establishment_type, key, label, description_hint, position) values
  ('site','billet_adulte','Billet adulte','Tarif plein',1),
  ('site','billet_enfant','Billet enfant','Précisez la tranche d''âge dans la description',2),
  ('site','tarif_resident','Tarif résident','Réservé aux résidents en RDC, sur justificatif',3),
  ('site','visite_guidee','Visite guidée','Accompagnement par un guide — précisez la durée',4),
  ('site','pass_famille','Pass famille','Forfait pour un groupe familial',5),
  ('site','pass_groupe','Pass groupe','À partir d''un nombre de personnes à préciser',6)
on conflict (establishment_type, key) do nothing;

-- ═══════════════════════════════════════════
-- 2. Offres des établissements
-- ═══════════════════════════════════════════

create table if not exists establishment_offers (
  id uuid primary key default uuid_generate_v4(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  category_id uuid not null references offer_categories(id),
  -- Le partenaire choisit « Suite » dans le référentiel et peut l'appeler
  -- « Suite Fleuve ». La comparabilité vient de category_id, l'identité de
  -- custom_label. L'affichage prend custom_label s'il existe, sinon le label.
  custom_label text,
  description text,
  price numeric not null check (price >= 0),
  currency text not null default 'USD',
  unit text not null check (unit in ('night','person','visit')),
  -- quantity : nombre d'unités de ce type (8 chambres Standard), ou nombre de
  -- places par créneau pour un restaurant/site. null = aucune limite.
  quantity int check (quantity is null or quantity > 0),
  -- max_guests : capacité d'UNE unité (2 personnes par chambre Standard).
  -- Ne pas confondre avec quantity — c'est la distinction qui permettra à B2
  -- de calculer une disponibilité juste.
  max_guests int check (max_guests is null or max_guests > 0),
  amenities text[] not null default '{}',
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_offers_establishment on establishment_offers (establishment_id);

-- ═══════════════════════════════════════════
-- 3. Photos rattachables à une offre
-- ═══════════════════════════════════════════

-- Avec offer_id : la photo appartient à cette offre. Sans : photo générale de
-- l'établissement, comportement inchangé. Les politiques existantes de
-- listing_photos continuent de s'appliquer telles quelles.
alter table listing_photos
  add column if not exists offer_id uuid references establishment_offers(id) on delete cascade;

create index if not exists idx_photos_offer on listing_photos (offer_id);

-- ═══════════════════════════════════════════
-- 4. RLS
-- ═══════════════════════════════════════════

alter table offer_categories enable row level security;
alter table establishment_offers enable row level security;

-- Référentiel : lecture publique, écriture réservée à l'admin.
drop policy if exists "offer_categories_select" on offer_categories;
create policy "offer_categories_select" on offer_categories
  for select using (true);

drop policy if exists "offer_categories_admin" on offer_categories;
create policy "offer_categories_admin" on offer_categories
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Offres : mêmes règles que listing_photos et rates — on reprend le motif
-- `exists (...)` en ligne déjà utilisé partout dans 0001. Il n'existe pas de
-- fonction owns_establishment() dans ce schéma, contrairement à ce qu'on
-- pourrait croire : chaque politique porte sa propre sous-requête.
drop policy if exists "offers_select" on establishment_offers;
create policy "offers_select" on establishment_offers
  for select using (
    exists (
      select 1 from establishments e
      where e.id = establishment_id
        and (e.status = 'approved' or e.owner_id = auth.uid())
    )
    -- Le public ne voit que les offres actives ; le propriétaire voit tout.
    and (
      is_active
      or exists (select 1 from establishments e2 where e2.id = establishment_id and e2.owner_id = auth.uid())
    )
  );

drop policy if exists "offers_manage_owner" on establishment_offers;
create policy "offers_manage_owner" on establishment_offers
  for all using (
    exists (select 1 from establishments e where e.id = establishment_id and e.owner_id = auth.uid())
  );

drop policy if exists "offers_admin_all" on establishment_offers;
create policy "offers_admin_all" on establishment_offers
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ═══════════════════════════════════════════
-- 5. Le pont avec `rates`
-- ═══════════════════════════════════════════

-- `rates` reste la source de vérité pour l'affichage voyageur (fiche,
-- recherche, tableau de bord partenaire) — six fichiers en dépendent et ne
-- changeront qu'au lot B2. Ce trigger y répercute le prix le plus bas parmi
-- les offres actives, pour que le « à partir de » soit juste sans qu'aucun
-- code de lecture ne bouge.
--
-- Détail du schéma qui impose la forme : `rates` n'a AUCUNE contrainte
-- d'unicité sur establishment_id, alors que le code applicatif suppose une
-- ligne unique (.maybeSingle()). On supprime donc systématiquement avant
-- d'insérer, plutôt que de faire un upsert qui pourrait laisser des doublons.
create or replace function sync_rate_from_offers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_establishment uuid;
  v_price   numeric;
  v_currency text;
  v_unit    text;
begin
  v_establishment := coalesce(new.establishment_id, old.establishment_id);

  select o.price, o.currency, o.unit
    into v_price, v_currency, v_unit
  from establishment_offers o
  where o.establishment_id = v_establishment
    and o.is_active
  order by o.price asc
  limit 1;

  delete from rates where establishment_id = v_establishment;

  -- Aucune offre active : l'établissement retombe en « Tarif sur demande ».
  if v_price is not null then
    insert into rates (establishment_id, price, currency, unit)
    values (v_establishment, v_price, v_currency, v_unit::rate_unit);
  end if;

  return null; -- AFTER trigger : la valeur de retour est ignorée
end;
$$;

drop trigger if exists trg_sync_rate_from_offers on establishment_offers;
create trigger trg_sync_rate_from_offers
  after insert or update or delete on establishment_offers
  for each row
  execute function sync_rate_from_offers();

-- ═══════════════════════════════════════════
-- 6. Reprise des tarifs existants
-- ═══════════════════════════════════════════

-- Les établissements qui ont déjà un tarif reçoivent une offre par défaut,
-- rattachée à la catégorie la plus neutre de leur type. Ceux qui n'en ont pas
-- n'en reçoivent aucune et restent en « Tarif sur demande ».
--
-- `on conflict do nothing` sur rien de particulier : la garde est le
-- `not exists`, qui rend la migration rejouable sans créer de doublons.
insert into establishment_offers
  (establishment_id, category_id, price, currency, unit, position)
select
  r.establishment_id,
  c.id,
  r.price,
  r.currency,
  r.unit::text,
  0
from rates r
join establishments e on e.id = r.establishment_id
join offer_categories c
  on c.establishment_type = e.type::text
 and c.key = case e.type::text
       when 'hotel'           then 'standard'
       when 'furnished_house' then 'logement_entier'
       when 'restaurant'      then 'menu_du_jour'
       when 'site'            then 'billet_adulte'
     end
where not exists (
  select 1 from establishment_offers o where o.establishment_id = r.establishment_id
);
