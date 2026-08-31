-- ============================================================================
--  Trace durable de l'envoi des identifiants partenaire
-- ============================================================================
--
--  Le problème
--  -----------
--  À l'approbation d'une demande, `approve-partner` renvoie `email_sent` et
--  `email_error` dans sa réponse HTTP. L'écran admin les affiche dans une boîte
--  de dialogue — puis l'information disparaît définitivement.
--
--  Conséquences constatées le 31/08/2026, sur l'approbation de « Zk » :
--    - impossible de savoir si l'email est parti, une fois la boîte fermée ;
--    - impossible de savoir COMBIEN de partenaires attendent des identifiants
--      qui ne sont jamais arrivés ;
--    - le diagnostic a dû se faire en recoupant le tableau de bord Resend, les
--      horodatages de `auth.users` et ceux de `partner_requests` — une heure
--      pour une information que la fonction connaissait et a jetée.
--
--  Un établissement approuvé dont le propriétaire n'a pas reçu ses accès est
--  en ligne et injoignable. C'est un état qui doit être visible, pas déduit.
--
--  Ce que ces colonnes changent
--  ----------------------------
--  L'écran admin peut marquer la demande « identifiants non envoyés », et la
--  question « qui attend encore ? » devient une requête :
--
--    select establishment_name, contact_email, credentials_error
--    from partner_requests
--    where status = 'approved' and credentials_sent is false;
--
--  Nommage : `credentials_*` plutôt que `email_*`, parce que la table porte
--  déjà `confirmation_sent_at` pour l'accusé de réception. Deux emails
--  distincts, deux traces distinctes — les confondre serait pire que rien.
-- ============================================================================

alter table partner_requests
  add column if not exists credentials_sent boolean,
  add column if not exists credentials_error text,
  add column if not exists credentials_sent_at timestamptz;

comment on column partner_requests.credentials_sent is
  'Envoi des identifiants à l''approbation. true = accepté par le service d''envoi, false = refusé, null = demande jamais approuvée (ou antérieure à 0019).';

comment on column partner_requests.credentials_error is
  'Motif exact du refus, tel que renvoyé par le service d''envoi. null quand l''envoi a abouti.';

comment on column partner_requests.credentials_sent_at is
  'Date de la dernière tentative d''envoi, réussie ou non. Permet de distinguer un premier échec d''un renvoi.';

-- Repérage rapide des partenaires approuvés restés sans identifiants.
create index if not exists idx_partner_requests_credentials_ko
  on partner_requests (status)
  where credentials_sent is false;
