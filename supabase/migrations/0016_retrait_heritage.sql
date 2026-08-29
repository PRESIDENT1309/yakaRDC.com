-- Retrait de l'héritage du modèle tarifaire — clôture du lot B2.
--
-- ⚠️  IRRÉVERSIBLE. À n'appliquer qu'après la vérification complète du
-- catalogue d'offres, faite le 29 août 2026 : réservation avec ligne et prix
-- gelé, contrainte de capacité par offre, garde-fou de suppression, annulation
-- avec motif, revenu partenaire calculé sur les lignes.
--
-- CE QUI PART, ET POURQUOI
--
-- `rates` — remplacée par `establishment_offers`. Elle portait UN prix par
-- établissement, ce qui ne permettait ni plusieurs chambres, ni plusieurs
-- formules, ni plusieurs billets. Les six écrans qui la lisaient ont été
-- basculés ; elle est vide et n'a plus aucun lecteur dans le dépôt.
--
-- `establishments.capacity` — une capacité unique pour tout l'établissement.
-- Elle était nulle sur la totalité des établissements depuis toujours, donc
-- le blocage des dates complètes qu'elle était censée alimenter n'a jamais
-- fonctionné. La disponibilité se calcule désormais offre par offre, avec la
-- distinction qui manquait : `quantity` (nombre d'unités) contre `max_guests`
-- (capacité d'une unité).
--
-- CE QUI RESTE
-- Les fonctions `establishment_daily_load` et `establishment_slot_load` sont
-- conservées : la seconde alimente encore le compteur de charge par créneau.
-- Elles ne dépendent pas des objets supprimés ici.

-- ═══════════════════════════════════════════
-- APERÇU — lancer seul d'abord
-- ═══════════════════════════════════════════

select 'lignes dans rates' as quoi, count(*)::text as valeur from rates
union all
select 'etablissements avec une capacite', count(*)::text from establishments where capacity is not null
union all
select 'offres actives (le remplacement)', count(*)::text from establishment_offers where is_active
union all
select 'lignes de reservation', count(*)::text from booking_items;

-- Si « lignes dans rates » et « etablissements avec une capacite » valent
-- tous deux 0, la suppression n'emporte aucune donnée vivante.

-- ═══════════════════════════════════════════
-- SUPPRESSION — décommenter pour appliquer
-- ═══════════════════════════════════════════

/*
begin;

  -- Le déclencheur de synchronisation du lot B1 recopiait l'offre la moins
  -- chère dans `rates`, le temps que les écrans basculent. Il n'a plus d'objet
  -- et doit partir AVANT la table, sinon il échouerait à la prochaine écriture
  -- sur les offres.
  drop trigger if exists trg_sync_rate_from_offers on establishment_offers;
  drop function if exists sync_rate_from_offers() cascade;

  drop table if exists rates;

  alter table establishments drop column if exists capacity;

commit;
*/
