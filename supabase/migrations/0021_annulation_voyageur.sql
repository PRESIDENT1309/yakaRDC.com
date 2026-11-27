-- ============================================================================
--  Le voyageur peut annuler sa propre demande, tant qu'elle est en attente
-- ============================================================================
--
--  Constat (audit du 26/11/2026)
--  -----------------------------
--  L'onglet « Mes réservations » propose un bouton « Annuler » sur les demandes
--  en attente. Or les migrations ne donnent le droit de modifier une
--  réservation qu'au partenaire (`bookings_update_partner`) et à
--  l'administration (`bookings_admin_all`). Pour le voyageur, la mise à jour
--  est donc filtrée par RLS : Postgres ne renvoie pas d'erreur, il modifie
--  zéro ligne. L'écran rechargeait la liste et la réservation restait « en
--  attente », sans un mot.
--
--  L'écran vérifie désormais le résultat et annonce l'échec. Cette migration
--  rend l'annulation réellement possible.
--
--  Ce que la politique autorise — et rien d'autre
--  ----------------------------------------------
--  `using`      : la ligne doit appartenir au voyageur ET être encore en
--                 attente. Une réservation confirmée, refusée, utilisée ou
--                 déjà annulée ne peut plus être touchée par lui.
--  `with check` : la ligne modifiée doit toujours lui appartenir ET porter le
--                 statut `cancelled`. Il ne peut donc ni se confirmer lui-même,
--                 ni réattribuer la réservation à un autre compte.
--
--  Sans `with check` explicite, Postgres réappliquerait `using` à la nouvelle
--  ligne — qui exigerait `pending` — et refuserait précisément l'annulation.
--
--  Idempotent : peut être rejoué sans effet.
-- ============================================================================

drop policy if exists "bookings_cancel_traveler" on bookings;

create policy "bookings_cancel_traveler" on bookings
  for update
  using (traveler_id = auth.uid() and status = 'pending')
  with check (traveler_id = auth.uid() and status = 'cancelled');
