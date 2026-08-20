-- Champs de contact enrichis sur les réservations.
--
-- post_name          Postnom — convention congolaise (prénom + nom + postnom).
--                    Nullable : un voyageur étranger n'en a pas.
-- contact_email      Aucun email n'était demandé nulle part. Conditionne
--                    l'envoi de la confirmation et du code de réservation.
-- phone_country_code Le téléphone était un champ libre jamais validé. Une
--                    part des réservations pour Kinshasa vient de la diaspora
--                    (Belgique, France, Afrique du Sud) : supposer +243 les
--                    excluait. Défaut '+243' pour les lignes existantes.
-- arrival_time       Heure d'arrivée — hôtel et maison meublée uniquement.
--                    Pour un restaurant ou un site, visit_time la porte déjà.
--
-- Toutes nullables et additives : aucune lecture existante ne casse, et les
-- réservations déjà enregistrées restent valides avec ces champs vides.

alter table bookings
  add column if not exists post_name          text,
  add column if not exists contact_email      text,
  add column if not exists phone_country_code text default '+243',
  add column if not exists arrival_time       text;
