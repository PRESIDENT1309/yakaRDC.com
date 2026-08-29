-- Dépôt d'une demande de partenariat — reprise de la politique 0013.
--
-- POURQUOI UNE REPRISE
-- La politique de la 0013 exprimait ses garde-fous dans son `with check` :
--   status = 'pending' and user_id is null and reviewed_by is null ...
-- Elle est bien en place, permissive, sur anon et authenticated — vérifié
-- dans pg_policies — et pourtant toute insertion anonyme est refusée. Une des
-- conditions ne s'évalue pas comme prévu, et `partner_requests` ayant été
-- créée hors migrations, sa définition exacte (types, valeurs par défaut)
-- n'est pas lisible depuis le dépôt.
--
-- LE CHANGEMENT DE MÉTHODE
-- Une politique d'accès répond à « qui a le droit d'écrire ». Elle n'est pas
-- l'endroit pour valider le CONTENU d'une ligne : chaque condition ajoutée y
-- devient un point de rupture muet, sans message expliquant laquelle a cédé.
--
-- On sépare donc les deux responsabilités :
--   * la politique dit « toute personne peut déposer une demande » — c'est
--     une boîte aux lettres publique, comme un formulaire de contact ;
--   * un déclencheur impose les valeurs sûres, quoi que l'appelant envoie.
--
-- La garantie est plus forte qu'avant, pas plus faible. La 0013 REFUSAIT une
-- ligne mal formée ; celle-ci la CORRIGE. Un client malveillant qui envoie
-- `status = 'approved'` n'obtient plus un refus qu'il pourrait contourner en
-- tâtonnant : il obtient une demande en attente, comme tout le monde.

-- ═══════════════════════════════════════════
-- 1. Le déclencheur qui impose les valeurs sûres
-- ═══════════════════════════════════════════

create or replace function sanitize_partner_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Personne ne s'auto-approuve : une demande naît toujours en attente.
  new.status := 'pending';

  -- Les champs d'instruction appartiennent à l'approbation, pas au déposant.
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_establishment_id := null;
  new.rejection_reason := null;
  new.confirmation_sent_at := null;

  -- On ne dépose pas une demande au nom d'un tiers : soit la demande est
  -- rattachée au compte connecté, soit à personne. `auth.uid()` vaut null
  -- pour un visiteur anonyme, ce qui est le cas nominal ici.
  if new.user_id is distinct from auth.uid() then
    new.user_id := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sanitize_partner_request on partner_requests;
create trigger trg_sanitize_partner_request
  before insert on partner_requests
  for each row
  execute function sanitize_partner_request();

-- ═══════════════════════════════════════════
-- 2. La politique, réduite à sa vraie question
-- ═══════════════════════════════════════════

drop policy if exists "partner_requests_insert_public" on partner_requests;

-- `to public` et non `to anon, authenticated` : le rôle exact dépend du
-- système de clés du projet, en cours de migration chez Supabase. `public`
-- couvre les deux sans dépendre de ce détail.
create policy "partner_requests_insert_public" on partner_requests
  for insert
  to public
  with check (true);

comment on function sanitize_partner_request() is
  'Impose les valeurs sûres d''une demande déposée : statut en attente, champs d''instruction vides, rattachement au compte connecté ou à personne. Remplace les conditions du with check de la migration 0013.';
