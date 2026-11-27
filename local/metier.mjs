/**
 * Déclencheurs et fonctions SQL de la base en ligne, réécrits en JavaScript.
 *
 * POURQUOI CE FICHIER EXISTE
 * Une partie du comportement de l'application ne vit pas dans son code mais
 * dans PostgreSQL : le code « YK-… » d'une réservation, le garde-fou de
 * capacité, la validation d'un billet, l'approbation d'un partenaire. SQLite
 * ne peut pas exécuter ce PL/pgSQL. Chaque morceau ci-dessous est une
 * RÉÉCRITURE À LA MAIN de la migration citée en commentaire : si la
 * migration change, il faut reporter le changement ici.
 *
 * CE QUI N'EST PAS REPRIS
 *  - `establishment_daily_load` (migration 0003) : l'application ne l'appelle pas.
 *  - la table `rates` et son déclencheur de synchronisation (0007) : plus lue.
 */
import { randomUUID } from 'node:crypto';

import { ErreurPg, convertir, maintenant } from './base.mjs';

/** Identité utilisée par les fonctions « security definer » : elles écrivent sans règles. */
export const SERVICE = Object.freeze({ role: 'service', id: null, admin: false });

const STATUTS_ACTIFS = ['pending', 'confirmed', 'checked_in'];

const somme = (valeurs) => valeurs.reduce((total, valeur) => total + (valeur ?? 0), 0);

/** Liste des jours `AAAA-MM-JJ` de `debut` à `fin`, bornes selon `finIncluse`. */
function joursEntre(debut, fin, finIncluse) {
  const jours = [];
  const curseur = new Date(`${debut}T00:00:00Z`);
  const limite = new Date(`${fin}T00:00:00Z`);
  // Garde-fou : une plage absurde ne doit pas figer le serveur.
  while ((finIncluse ? curseur <= limite : curseur < limite) && jours.length < 1100) {
    jours.push(curseur.toISOString().slice(0, 10));
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return jours;
}

const nullSiVide = (valeur) => (typeof valeur === 'string' && valeur.trim() !== '' ? valeur.trim() : null);

/** Migration 0017, `trim_lieux` : pas d'espaces parasites dans les lieux. */
function nettoyerLieux(ligne) {
  if (typeof ligne.city === 'string') ligne.city = ligne.city.trim();
  for (const colonne of ['commune', 'neighborhood', 'avenue', 'numero', 'reference']) ligne[colonne] = nullSiVide(ligne[colonne]);
}

/**
 * Migration 0009, `check_offer_capacity` : refuse la ligne de réservation
 * qui ferait dépasser le stock de l'offre. Appelé APRÈS l'insertion ; l'erreur
 * annule la transaction, donc la ligne.
 */
function verifierCapacite(base, ligne) {
  const offre = base.parCle('establishment_offers', ligne.offer_id);
  if (!offre || offre.quantity === null) return;
  const reservation = base.parCle('bookings', ligne.booking_id);
  if (!reservation || ['cancelled', 'rejected'].includes(reservation.status)) return;

  const concurrentes = base
    .lignes('booking_items')
    .filter((autre) => autre.offer_id === ligne.offer_id && autre.id !== ligne.id)
    .map((autre) => ({ quantite: autre.quantity, resa: base.parCle('bookings', autre.booking_id) }))
    .filter(({ resa }) => resa && STATUTS_ACTIFS.includes(resa.status));

  if (reservation.visit_date !== null) {
    const prises = somme(
      concurrentes
        .filter(({ resa }) => resa.visit_date === reservation.visit_date)
        .filter(({ resa }) => reservation.visit_time === null || resa.visit_time === reservation.visit_time)
        .map(({ quantite }) => quantite),
    );
    if (prises + ligne.quantity > offre.quantity) {
      throw new ErreurPg('23514', `OFFER_FULL: il ne reste que ${Math.max(offre.quantity - prises, 0)} place(s) pour cette date.`);
    }
    return;
  }

  if (reservation.check_in !== null && reservation.check_out !== null) {
    for (const nuit of joursEntre(reservation.check_in, reservation.check_out, false)) {
      const prises = somme(
        concurrentes
          .filter(({ resa }) => resa.check_in !== null && resa.check_out !== null && resa.check_in <= nuit && nuit < resa.check_out)
          .map(({ quantite }) => quantite),
      );
      if (prises + ligne.quantity > offre.quantity) {
        const [annee, mois, jour] = nuit.split('-');
        throw new ErreurPg(
          '23514',
          `OFFER_FULL: la nuit du ${jour}/${mois}/${annee} est complète (${Math.max(offre.quantity - prises, 0)} unité(s) restante(s)).`,
        );
      }
    }
  }
}

/** Code lisible d'une réservation : « YK- » suivi de 7 chiffres hexadécimaux en majuscules. */
export function nouveauCodeReservation(base) {
  for (;;) {
    const code = `YK-${randomUUID().replaceAll('-', '').slice(0, 7).toUpperCase()}`;
    if (!base.lignes('bookings').some((resa) => resa.unique_code === code)) return code;
  }
}

/** Branche les déclencheurs sur la base. À appeler une fois à l'ouverture. */
export function brancherMetier(base) {
  base.declencheurs = {
    bookings: {
      // Migration 0001, `generate_booking_code` : le code naît à la confirmation.
      avantModification(ancienne, nouvelle) {
        if (nouvelle.status === 'confirmed' && ancienne.status !== 'confirmed' && nouvelle.unique_code === null) {
          nouvelle.unique_code = nouveauCodeReservation(base);
        }
      },
    },
    booking_items: {
      apresInsertion: (ligne) => verifierCapacite(base, ligne),
    },
    establishments: {
      avantInsertion: nettoyerLieux,
      avantModification: (_ancienne, nouvelle) => nettoyerLieux(nouvelle),
    },
    partner_requests: {
      // Migration 0015, `sanitize_partner_request` : le formulaire est public,
      // donc on n'accepte du demandeur ni statut, ni relecture, ni identité.
      avantInsertion(ligne, contexte) {
        ligne.status = 'pending';
        ligne.reviewed_by = null;
        ligne.reviewed_at = null;
        ligne.created_establishment_id = null;
        ligne.rejection_reason = null;
        ligne.confirmation_sent_at = null;
        ligne.user_id = contexte.qui?.id ?? null;
        nettoyerLieux(ligne);
      },
      avantModification: (_ancienne, nouvelle) => nettoyerLieux(nouvelle),
    },
  };
}

/**
 * Migration 0018, `handle_new_user` : chaque compte reçoit son profil de
 * voyageur. Comme en ligne, un échec ici ne doit jamais empêcher l'inscription.
 */
export function creerProfilDuCompte(base, compte) {
  try {
    if (base.parCle('profiles', compte.id)) return;
    base.inserer(
      'profiles',
      {
        id: compte.id,
        email: compte.email,
        full_name: nullSiVide(compte.user_metadata?.full_name),
        phone: nullSiVide(compte.user_metadata?.phone),
        role: 'traveler',
      },
      { qui: SERVICE },
    );
  } catch (erreur) {
    base.avertir(`profil non créé pour ${compte.email} : ${erreur.message}`);
  }
}

/** Lit un argument de fonction et le convertit, ou signale la fonction comme introuvable. */
function argument(nom, args, cle, type) {
  if (args[cle] === undefined) {
    throw new ErreurPg('PGRST202', `Could not find the function public.${nom}(${Object.keys(args).join(', ')}) in the schema cache`, {
      hint: `Argument attendu : ${cle}`,
    });
  }
  return convertir(type, args[cle]);
}

/**
 * Fonctions appelables par `/rest/v1/rpc/<nom>`. Chacune reçoit la base, les
 * arguments JSON et l'identité de l'appelant, et rend ce que PostgREST
 * sérialiserait : un tableau pour `returns table`, une valeur sinon,
 * `undefined` pour `returns void`.
 *
 * Comme en ligne, elles sont appelables par n'importe qui : PostgreSQL
 * accorde EXECUTE à tous par défaut et aucune migration ne le retire.
 */
export const FONCTIONS = {
  /** Migration 0020. */
  is_admin(_base, _args, qui) {
    return qui.admin === true;
  },

  /** Migration 0020 : compteur de vues, incrémenté même par un visiteur anonyme. */
  increment_establishment_views(base, args) {
    const id = argument('increment_establishment_views', args, 'p_establishment_id', 'uuid');
    const etablissement = base.parCle('establishments', id);
    if (etablissement) base.modifier('establishments', etablissement, { view_count: (etablissement.view_count ?? 0) + 1 }, { qui: SERVICE });
    return undefined;
  },

  /** Migration 0003 : personnes déjà attendues par créneau, pour un jour donné. */
  establishment_slot_load(base, args) {
    const id = argument('establishment_slot_load', args, 'p_establishment_id', 'uuid');
    const jour = argument('establishment_slot_load', args, 'p_date', 'date');
    const parCreneau = new Map();
    for (const resa of base.lignes('bookings')) {
      if (resa.establishment_id !== id || resa.visit_date !== jour || resa.visit_time === null) continue;
      if (!STATUTS_ACTIFS.includes(resa.status)) continue;
      parCreneau.set(resa.visit_time, (parCreneau.get(resa.visit_time) ?? 0) + (resa.guests ?? 0) + (resa.children ?? 0));
    }
    return [...parCreneau].sort(([a], [b]) => a.localeCompare(b)).map(([slot, guests]) => ({ slot, guests }));
  },

  /**
   * Migration 0009 : unités d'une offre déjà prises, jour par jour.
   * On reproduit jusqu'à la bizarrerie de la requête d'origine : une offre
   * jamais réservée donne une ligne à 0 pour chaque jour, alors qu'une offre
   * déjà réservée ne donne de ligne que pour les jours réellement occupés.
   */
  establishment_offer_load(base, args) {
    const id = argument('establishment_offer_load', args, 'p_establishment_id', 'uuid');
    const debut = argument('establishment_offer_load', args, 'p_from', 'date');
    const fin = argument('establishment_offer_load', args, 'p_to', 'date');
    const jours = joursEntre(debut, fin, true);
    const resultat = [];
    const offres = base
      .lignes('establishment_offers')
      .filter((offre) => offre.establishment_id === id && offre.is_active)
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const offre of offres) {
      const lignes = base.lignes('booking_items').filter((ligne) => ligne.offer_id === offre.id);
      for (const jour of jours) {
        if (lignes.length === 0) {
          resultat.push({ offer_id: offre.id, day: jour, units: 0 });
          continue;
        }
        const occupees = lignes.filter((ligne) => {
          const resa = base.parCle('bookings', ligne.booking_id);
          if (!resa || !STATUTS_ACTIFS.includes(resa.status)) return false;
          const sejour = resa.check_in !== null && resa.check_out !== null && resa.check_in <= jour && jour < resa.check_out;
          return sejour || (resa.visit_date !== null && resa.visit_date === jour);
        });
        if (occupees.length > 0) resultat.push({ offer_id: offre.id, day: jour, units: somme(occupees.map((ligne) => ligne.quantity)) });
      }
    }
    return resultat;
  },

  /** Migration 0009 : unités d'une offre déjà prises par créneau, pour un jour donné. */
  establishment_offer_slot_load(base, args) {
    const id = argument('establishment_offer_slot_load', args, 'p_establishment_id', 'uuid');
    const jour = argument('establishment_offer_slot_load', args, 'p_date', 'date');
    const groupes = new Map();
    for (const ligne of base.lignes('booking_items')) {
      const offre = base.parCle('establishment_offers', ligne.offer_id);
      const resa = base.parCle('bookings', ligne.booking_id);
      if (!offre || !resa || offre.establishment_id !== id) continue;
      if (resa.visit_date !== jour || resa.visit_time === null || !STATUTS_ACTIFS.includes(resa.status)) continue;
      const cle = `${ligne.offer_id} ${resa.visit_time}`;
      const groupe = groupes.get(cle) ?? { offer_id: ligne.offer_id, slot: resa.visit_time, units: 0 };
      groupe.units += ligne.quantity;
      groupes.set(cle, groupe);
    }
    return [...groupes.values()].sort((a, b) => a.slot.localeCompare(b.slot));
  },

  /**
   * Migration 0006 : validation d'un billet à l'entrée, par code « YK-… » ou
   * par jeton de QR code. Comme en ligne, la fonction ne vérifie ni que
   * `p_validator` est l'appelant, ni le statut de la réservation.
   */
  validate_ticket(base, args) {
    const code = String(argument('validate_ticket', args, 'p_code', 'text') ?? '');
    const validateur = argument('validate_ticket', args, 'p_validator', 'uuid');
    const reservation = base
      .lignes('bookings')
      .find((resa) => resa.unique_code === code.toUpperCase() || resa.qr_token === code.toLowerCase());
    if (!reservation) throw new ErreurPg('P0001', 'Code introuvable');
    const etablissement = base.parCle('establishments', reservation.establishment_id);
    if (!etablissement || etablissement.owner_id !== validateur) {
      throw new ErreurPg('P0001', "Ce code n'appartient pas à un de vos établissements");
    }
    if (reservation.used_at !== null) {
      return [{ booking_id: reservation.id, already_used: true, used_at: reservation.used_at }];
    }
    const instant = maintenant();
    base.modifier('bookings', reservation, { status: 'checked_in', used_at: instant, validated_by: validateur }, { qui: SERVICE });
    return [{ booking_id: reservation.id, already_used: false, used_at: instant }];
  },

  /**
   * Migration 0012 : transforme une demande de partenariat en établissement
   * approuvé, promeut le demandeur en partenaire et trace l'opération.
   */
  approve_partner_request(base, args) {
    const idDemande = argument('approve_partner_request', args, 'p_request_id', 'uuid');
    const idAdmin = argument('approve_partner_request', args, 'p_admin_id', 'uuid');
    return base.transaction(() => {
      const demande = base.parCle('partner_requests', idDemande);
      if (!demande) throw new ErreurPg('P0001', 'Demande introuvable');
      if (demande.status === 'approved') throw new ErreurPg('P0001', 'Cette demande a déjà été approuvée.');

      const normaliser = (email) => (email ?? '').trim().toLowerCase();
      const proprietaire =
        demande.user_id ??
        base.lignes('profiles').find((profil) => profil.email !== null && normaliser(profil.email) === normaliser(demande.contact_email))?.id ??
        null;
      if (!proprietaire) {
        throw new ErreurPg(
          'P0001',
          `Aucun compte ne correspond à cette demande (email : ${demande.contact_email ?? 'non renseigné'}). ` +
            'Le demandeur doit créer un compte avec cet email, puis relancer sa demande.',
        );
      }

      const etablissement = base.inserer(
        'establishments',
        {
          owner_id: proprietaire,
          type: demande.establishment_type,
          name: demande.establishment_name,
          description: demande.description,
          city: demande.city,
          commune: demande.commune,
          neighborhood: demande.neighborhood,
          avenue: demande.avenue,
          numero: demande.numero,
          reference: demande.reference,
          phone: demande.contact_phone,
          email: demande.contact_email,
          status: 'approved',
        },
        { qui: SERVICE },
      );

      const profil = base.parCle('profiles', proprietaire);
      if (profil?.role === 'traveler') base.modifier('profiles', profil, { role: 'partner' }, { qui: SERVICE });

      base.modifier(
        'partner_requests',
        base.parCle('partner_requests', idDemande),
        { status: 'approved', reviewed_by: idAdmin, reviewed_at: maintenant(), created_establishment_id: etablissement.id },
        { qui: SERVICE },
      );
      base.inserer(
        'admin_activity_log',
        {
          actor_id: idAdmin,
          action: 'partner_request_approved',
          target_type: 'partner_request',
          target_id: idDemande,
          details: { establishment_name: demande.establishment_name, establishment_id: etablissement.id, owner_id: proprietaire },
        },
        { qui: SERVICE },
      );
      return etablissement.id;
    });
  },
};
