-- Accusé de réception d'une demande de partenariat.
--
-- Le déposant reçoit désormais deux emails : celui-ci à l'envoi de sa demande,
-- puis celui de félicitations avec ses identifiants si elle est approuvée.
--
-- POURQUOI UNE COLONNE ET PAS UN SIMPLE ENVOI
-- La fonction `notify-partner-request` est ouverte aux anonymes — un
-- restaurateur dépose sans compte. Sans marqueur, rejouer le même appel
-- enverrait un email à chaque fois : la fonction deviendrait un moyen commode
-- d'inonder une boîte de réception. Cette colonne rend l'appel idempotent.
--
-- Elle est renseignée APRÈS un envoi réussi, jamais avant : marquer d'abord
-- priverait d'une seconde tentative si l'envoi échoue.

alter table partner_requests
  add column if not exists confirmation_sent_at timestamptz;

comment on column partner_requests.confirmation_sent_at is
  'Date d''envoi de l''accusé de réception. null = jamais envoyé. Empêche le renvoi en cas d''appel répété à notify-partner-request.';
