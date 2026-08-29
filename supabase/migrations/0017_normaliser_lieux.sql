-- Normalisation des noms de lieux.
--
-- CONSTAT
-- Des valeurs saisies à la main ont contenu « gombe » avec un espace final là
-- où les autres portaient « Gombe ». Le rapprochement « dans la même commune »
-- comparait à l'identique : les établissements voisins disparaissaient de la
-- fiche sans qu'aucune erreur ne le signale. Une donnée sale ne casse rien
-- bruyamment — elle fait juste disparaître des choses.
--
-- CE QUE FAIT CETTE MIGRATION
--   1. nettoie les espaces autour des valeurs existantes ;
--   2. pose un déclencheur qui le fera à chaque écriture, quelle qu'en soit
--      la provenance — formulaire, éditeur SQL, import.
--
-- On ne touche PAS à la casse : « N'Sele » et « Nsele » sont deux graphies
-- défendables, et en imposer une reviendrait à réécrire ce que le partenaire
-- a saisi. Le rapprochement côté application est devenu insensible à la casse,
-- ce qui règle le problème sans altérer la donnée.

-- ═══════════════════════════════════════════
-- 1. Nettoyage de l'existant
-- ═══════════════════════════════════════════

update establishments
set commune = nullif(trim(commune), ''),
    city = trim(city),
    neighborhood = nullif(trim(neighborhood), ''),
    avenue = nullif(trim(avenue), ''),
    numero = nullif(trim(numero), ''),
    reference = nullif(trim(reference), '')
where commune is distinct from nullif(trim(commune), '')
   or city is distinct from trim(city)
   or neighborhood is distinct from nullif(trim(neighborhood), '')
   or avenue is distinct from nullif(trim(avenue), '')
   or numero is distinct from nullif(trim(numero), '')
   or reference is distinct from nullif(trim(reference), '');

update partner_requests
set commune = nullif(trim(commune), ''),
    city = trim(city)
where commune is distinct from nullif(trim(commune), '')
   or city is distinct from trim(city);

update cities
set name = trim(name)
where name is distinct from trim(name);

-- ═══════════════════════════════════════════
-- 2. Le déclencheur, pour que ça ne revienne pas
-- ═══════════════════════════════════════════

create or replace function trim_lieux()
returns trigger
language plpgsql
as $$
begin
  new.city := trim(new.city);
  new.commune := nullif(trim(new.commune), '');
  -- Ces colonnes n'existent que sur `establishments` ; le déclencheur est posé
  -- sur les deux tables, d'où le test de présence via to_jsonb.
  if to_jsonb(new) ? 'neighborhood' then
    new.neighborhood := nullif(trim(new.neighborhood), '');
    new.avenue := nullif(trim(new.avenue), '');
    new.numero := nullif(trim(new.numero), '');
    new.reference := nullif(trim(new.reference), '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trim_lieux_establishments on establishments;
create trigger trg_trim_lieux_establishments
  before insert or update on establishments
  for each row execute function trim_lieux();

drop trigger if exists trg_trim_lieux_partner_requests on partner_requests;
create trigger trg_trim_lieux_partner_requests
  before insert or update on partner_requests
  for each row execute function trim_lieux();

comment on function trim_lieux() is
  'Retire les espaces autour des noms de lieux à chaque écriture. La casse est laissée telle quelle : le rapprochement applicatif en tient compte.';
