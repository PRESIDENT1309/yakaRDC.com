-- ═══════════════════════════════════════════════════════════════════
-- REMISE À ZÉRO DES COMPTES ET DES ÉTABLISSEMENTS
-- ═══════════════════════════════════════════════════════════════════
--
-- Script à usage unique, à lancer À LA MAIN dans l'éditeur SQL Supabase.
-- Il n'est PAS dans supabase/migrations/ volontairement : une migration se
-- rejoue à chaque déploiement, et celle-ci effacerait la base à chaque fois.
--
-- CE QU'IL DÉTRUIT — DÉFINITIVEMENT, SANS RETOUR ARRIÈRE
--   * tous les établissements, et par cascade : offres, photos, réservations,
--     lignes de réservation, avis, avertissements
--   * toutes les demandes de partenariat
--   * tous les comptes NON administrateurs, côté auth ET côté profils
--
-- CE QU'IL PRÉSERVE
--   * tous les comptes de rôle `admin` — sans eux tu ne peux plus te
--     connecter, et la base devient inaccessible depuis l'app
--   * les référentiels : villes, catégories d'offres, réglages
--
-- MODE D'EMPLOI
--   1. Lance d'abord la SECTION 1 seule, et lis ce qu'elle annonce.
--   2. Si le compte lisible dans « admins_preserves » est bien le tien,
--      lance la SECTION 2.
--   3. Ne lance jamais la section 2 sans avoir lu la section 1.


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 1 — APERÇU. Ne supprime rien.
-- ═══════════════════════════════════════════════════════════════════

select 'etablissements a supprimer' as quoi, count(*)::text as combien from establishments
union all
select 'demandes de partenariat', count(*)::text from partner_requests
union all
select 'reservations', count(*)::text from bookings
union all
select 'avis', count(*)::text from reviews
union all
select 'comptes a supprimer', count(*)::text from profiles where role <> 'admin'
union all
select 'admins_preserves', string_agg(email, ', ') from profiles where role = 'admin';


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2 — SUPPRESSION. Irréversible.
-- ═══════════════════════════════════════════════════════════════════
-- Décommente le bloc ci-dessous pour l'exécuter.
--
-- Tout est dans une transaction : si une étape échoue, rien n'est supprimé.
-- Remplace `commit` par `rollback` pour un essai à blanc — tu verras les
-- décomptes sans rien détruire.

/*
begin;

  -- Les établissements en premier : la cascade emporte offres, photos,
  -- réservations, lignes, avis et avertissements. Les supprimer après les
  -- comptes laisserait des lignes orphelines si une clé étrangère est en
  -- `set null` plutôt qu'en `cascade`.
  delete from establishments;

  delete from partner_requests;

  -- Les comptes non administrateurs. On passe par `auth.users` : c'est la
  -- table maîtresse, `profiles` suit par cascade. Supprimer `profiles` seul
  -- laisserait des comptes fantômes capables de se connecter.
  delete from auth.users u
  using profiles p
  where p.id = u.id
    and p.role <> 'admin';

  -- Filet : un profil dont le compte auth a disparu autrement.
  delete from profiles p
  where p.role <> 'admin'
    and not exists (select 1 from auth.users u where u.id = p.id);

  -- Vérification avant de valider — tout doit être à 0 sauf les admins.
  select 'restants' as quoi,
         (select count(*) from establishments)   as etablissements,
         (select count(*) from partner_requests) as demandes,
         (select count(*) from profiles where role <> 'admin') as comptes_non_admin,
         (select count(*) from profiles where role = 'admin')  as admins;

commit;
*/
