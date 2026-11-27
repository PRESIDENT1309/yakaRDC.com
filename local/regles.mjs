/**
 * Règles d'accès de la base de test.
 *
 * ATTENTION — CECI EST UNE APPROXIMATION
 * En ligne, l'accès est tenu par les politiques RLS de PostgreSQL
 * (`supabase/migrations/*.sql`). Ici, on en reprend les GRANDES LIGNES sous
 * une forme lisible, pour que l'application se comporte de façon réaliste
 * (un voyageur ne voit pas les réservations des autres, un refus d'écriture
 * ressemble à un refus RLS). Cette base NE SERT PAS à valider la sécurité :
 * une règle qui passe ici ne prouve rien sur la base en ligne, et l'inverse
 * non plus. Pour la sécurité, la seule référence reste les migrations.
 *
 * COMMENT LIRE CE FICHIER
 * Pour chaque table, quatre listes de règles. Une opération est permise dès
 * qu'UNE règle de la liste dit oui (comme les politiques « permissives »).
 *   lire      : quelles lignes sont visibles
 *   inserer   : quelles nouvelles lignes sont acceptées
 *   modifier  : `quand` porte sur la ligne AVANT (USING), `ensuite` sur la
 *               ligne APRÈS (WITH CHECK). Sans `ensuite`, c'est la même règle.
 *   supprimer : quelles lignes peuvent être supprimées
 *
 * Deux passe-droits valent pour toutes les tables et ne sont pas répétés :
 *   - la clé secrète (`service`) contourne tout, comme `service_role` ;
 *   - un administrateur (profil de rôle `admin`) peut tout lire et écrire.
 *
 * ÉCARTS CONNUS AVEC LES MIGRATIONS (voulus, pour suivre ce que fait l'app)
 *   - profiles : les migrations n'ont AUCUNE politique pour l'administrateur,
 *     alors que les écrans d'administration listent et modifient les profils.
 *     Ici l'administrateur y a accès.
 *   - reviews : les migrations n'ont ni politique de modification ni de
 *     suppression. L'application modifie pourtant un avis (son auteur), y
 *     répond (le partenaire) et en supprime (l'auteur, l'administrateur).
 *     Ici ces trois gestes sont permis.
 *   - stockage : les politiques du bucket ne sont pas dans les migrations ;
 *     voir `stockage.mjs`.
 */

/** `qui` : { role: 'anon' | 'authenticated' | 'service', id: uuid | null, admin: boolean } */

const tous = () => true;
const moi = (colonne) => (ligne, qui) => qui.id !== null && ligne[colonne] === qui.id;

const etablissement = (base, id) => base.parCle('establishments', id);
const possede = (base, qui, etablissementId) => qui.id !== null && etablissement(base, etablissementId)?.owner_id === qui.id;
const proprietaire = (colonne) => (ligne, qui, base) => possede(base, qui, ligne[colonne]);

/** L'établissement est public (approuvé) ou c'est le mien. */
const etablissementVisible = (colonne) => (ligne, qui, base) =>
  etablissement(base, ligne[colonne])?.status === 'approved' || possede(base, qui, ligne[colonne]);

const reservation = (base, id) => base.parCle('bookings', id);
const monPlan = (ligne, qui, base) => qui.id !== null && base.parCle('trip_plans', ligne.trip_plan_id)?.traveler_id === qui.id;

/** Le profil est celui d'un voyageur ayant réservé dans un de mes établissements. */
const estMonClient = (ligne, qui, base) =>
  qui.id !== null &&
  base.lignes('bookings').some((resa) => resa.traveler_id === ligne.id && possede(base, qui, resa.establishment_id));

export const REGLES = {
  profiles: {
    lire: [moi('id'), estMonClient],
    // Aucune politique d'insertion en ligne : le profil naît avec le compte
    // (déclencheur `handle_new_user`, repris dans `auth.mjs`).
    inserer: [],
    modifier: [{ quand: moi('id') }],
    supprimer: [],
  },

  cities: { lire: [tous], inserer: [], modifier: [], supprimer: [] },
  offer_categories: { lire: [tous], inserer: [], modifier: [], supprimer: [] },
  app_settings: { lire: [tous], inserer: [], modifier: [], supprimer: [] },
  establishment_ratings: { lire: [tous], inserer: [], modifier: [], supprimer: [] },
  admin_activity_log: { lire: [], inserer: [], modifier: [], supprimer: [] },

  establishments: {
    lire: [(ligne) => ligne.status === 'approved', moi('owner_id')],
    inserer: [moi('owner_id')],
    modifier: [{ quand: moi('owner_id') }],
    supprimer: [],
  },

  listing_photos: {
    lire: [etablissementVisible('establishment_id')],
    inserer: [proprietaire('establishment_id')],
    modifier: [{ quand: proprietaire('establishment_id') }],
    supprimer: [proprietaire('establishment_id')],
  },

  establishment_offers: {
    lire: [
      (ligne, qui, base) =>
        etablissementVisible('establishment_id')(ligne, qui, base) && (ligne.is_active || possede(base, qui, ligne.establishment_id)),
    ],
    inserer: [proprietaire('establishment_id')],
    modifier: [{ quand: proprietaire('establishment_id') }],
    supprimer: [proprietaire('establishment_id')],
  },

  bookings: {
    lire: [moi('traveler_id'), proprietaire('establishment_id')],
    inserer: [moi('traveler_id')],
    modifier: [
      // Le partenaire confirme, refuse, annule les réservations de son établissement.
      { quand: proprietaire('establishment_id') },
      // Politique `bookings_cancel_traveler` (migration 0021) : le voyageur ne
      // peut toucher qu'à SA réservation encore en attente, et uniquement
      // pour la passer à « annulée ».
      {
        quand: (ligne, qui) => moi('traveler_id')(ligne, qui) && ligne.status === 'pending',
        ensuite: (ligne, qui) => moi('traveler_id')(ligne, qui) && ligne.status === 'cancelled',
      },
    ],
    // Pas de politique de suppression pour le voyageur ni le partenaire.
    supprimer: [],
  },

  booking_items: {
    lire: [
      (ligne, qui, base) => {
        const resa = reservation(base, ligne.booking_id);
        return Boolean(resa) && (moi('traveler_id')(resa, qui) || possede(base, qui, resa.establishment_id));
      },
    ],
    inserer: [(ligne, qui, base) => moi('traveler_id')(reservation(base, ligne.booking_id) ?? {}, qui)],
    modifier: [],
    supprimer: [],
  },

  reviews: {
    lire: [tous],
    inserer: [moi('traveler_id')],
    // Écart assumé (voir l'en-tête) : absent des migrations.
    modifier: [{ quand: moi('traveler_id') }, { quand: proprietaire('establishment_id') }],
    supprimer: [moi('traveler_id')],
  },

  favorites: {
    lire: [moi('traveler_id')],
    inserer: [moi('traveler_id')],
    modifier: [{ quand: moi('traveler_id') }],
    supprimer: [moi('traveler_id')],
  },

  trip_plans: {
    lire: [moi('traveler_id')],
    inserer: [moi('traveler_id')],
    modifier: [{ quand: moi('traveler_id') }],
    supprimer: [moi('traveler_id')],
  },
  trip_plan_items: { lire: [monPlan], inserer: [monPlan], modifier: [{ quand: monPlan }], supprimer: [monPlan] },
  trip_packing_items: { lire: [monPlan], inserer: [monPlan], modifier: [{ quand: monPlan }], supprimer: [monPlan] },

  partner_requests: {
    lire: [moi('user_id')],
    // Formulaire public : tout le monde peut déposer une demande (le
    // déclencheur `sanitize_partner_request` neutralise les champs sensibles).
    inserer: [tous],
    modifier: [],
    supprimer: [],
  },

  establishment_warnings: {
    lire: [proprietaire('establishment_id')],
    inserer: [],
    modifier: [],
    supprimer: [],
  },
};

const passeDroit = (qui) => qui.role === 'service' || qui.admin === true;
const uneRegle = (regles, ligne, qui, base) => (regles ?? []).some((regle) => regle(ligne, qui, base));

export const peutLire = (base, table, ligne, qui) => passeDroit(qui) || uneRegle(REGLES[table]?.lire, ligne, qui, base);

export const peutInserer = (base, table, ligne, qui) => passeDroit(qui) || uneRegle(REGLES[table]?.inserer, ligne, qui, base);

export const peutSupprimer = (base, table, ligne, qui) => passeDroit(qui) || uneRegle(REGLES[table]?.supprimer, ligne, qui, base);

/** La ligne existante peut-elle être modifiée par `qui` ? (clause USING) */
export const peutModifier = (base, table, ligne, qui) =>
  passeDroit(qui) || (REGLES[table]?.modifier ?? []).some((regle) => regle.quand(ligne, qui, base));

/** La ligne modifiée est-elle acceptable ? (clause WITH CHECK) */
export const peutDevenir = (base, table, ligne, qui) =>
  passeDroit(qui) || (REGLES[table]?.modifier ?? []).some((regle) => (regle.ensuite ?? regle.quand)(ligne, qui, base));
