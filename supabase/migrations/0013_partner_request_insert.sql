-- Dépôt d'une demande de partenariat par un visiteur non connecté.
--
-- CONSTAT
-- L'insertion dans `partner_requests` est refusée en anonyme :
--   42501 — new row violates row-level security policy
-- Or le parcours retenu veut qu'un établissement dépose sa demande SANS
-- compte : le compte naît à l'approbation, et le mot de passe part par email.
-- Sans politique d'insertion, le formulaire « Devenir partenaire » ne peut
-- rien écrire, et le parcours n'a pas de point de départ.
--
-- CE QUE CETTE POLITIQUE AUTORISE, ET RIEN DE PLUS
-- Insérer une ligne, et seulement une ligne en attente. Trois verrous :
--   * `status` doit valoir 'pending' — personne ne s'auto-approuve ;
--   * `user_id` doit être vide ou correspondre au compte connecté — on ne
--     dépose pas une demande au nom d'un tiers ;
--   * `reviewed_by`, `reviewed_at` et `created_establishment_id` doivent être
--     vides — ce sont des champs d'instruction, remplis par l'approbation.
-- La lecture reste fermée : le déposant ne voit que sa propre demande
-- (politique de la migration 0011), l'administrateur les voit toutes.
--
-- POURQUOI OUVRIR À `anon`
-- C'est une boîte aux lettres publique, comme un formulaire de contact. Le
-- risque est le dépôt en masse, pas la fuite de données : rien n'est lisible,
-- rien n'est approuvé sans l'intervention d'un administrateur. Si le spam
-- devient un problème, la réponse est une limitation de débit, pas la
-- fermeture de la porte.

drop policy if exists "partner_requests_insert_public" on partner_requests;
create policy "partner_requests_insert_public" on partner_requests
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and (user_id is null or user_id = auth.uid())
    and reviewed_by is null
    and reviewed_at is null
    and created_establishment_id is null
  );
