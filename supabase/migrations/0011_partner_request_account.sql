-- Rattache une demande de partenariat au compte qui la dépose.
--
-- LE PROBLÈME
-- « Devenir partenaire » n'exigeait aucun compte : la demande ne portait qu'un
-- nom, un téléphone et un email facultatif. À l'approbation, il n'existait donc
-- aucun identifiant à qui donner l'accès — et une fonction SQL ne peut ni créer
-- un compte Supabase Auth ni poser un mot de passe. Conséquence : un partenaire
-- approuvé n'avait littéralement aucun moyen de se connecter.
--
-- LE CHOIX RETENU
-- Le demandeur crée d'abord son compte normalement (il choisit son mot de
-- passe), puis dépose sa demande, qui garde son identifiant. À l'approbation,
-- son rôle passe à `partner` et l'établissement lui est rattaché. Aucun mot de
-- passe n'est jamais transmis par email ou par message — il n'y en a pas à
-- transmettre.
--
-- Colonne nullable : les demandes déjà en base n'ont pas de compte associé et
-- doivent rester traitables à la main.

alter table partner_requests
  add column if not exists user_id uuid references profiles(id) on delete set null;

create index if not exists idx_partner_requests_user on partner_requests (user_id);

comment on column partner_requests.user_id is
  'Compte du demandeur. À l''approbation, ce compte devient partner et propriétaire de l''établissement créé. null = demande antérieure à la migration 0011, à rattacher manuellement.';

-- Le demandeur doit pouvoir suivre sa propre demande : sans cela, il dépose un
-- dossier et n'en a plus jamais de nouvelles depuis l'app.
drop policy if exists "partner_requests_select_own" on partner_requests;
create policy "partner_requests_select_own" on partner_requests
  for select using (user_id = auth.uid());
