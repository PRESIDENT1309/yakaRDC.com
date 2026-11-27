/**
 * Données de départ de la base de test.
 *
 * POURQUOI CE FICHIER EXISTE
 * Une base vide ne permet de tester aucun écran : pas d'établissement à
 * afficher, pas de compte pour se connecter. Ce fichier remplit la base
 * UNE SEULE FOIS, à sa création (ou après `--reinitialiser`), avec un jeu de
 * données plausible pour Kinshasa. Ce qui est créé ensuite pendant les
 * essais n'est jamais écrasé.
 *
 * CE QU'IL FAUT SAVOIR
 *  - TOUT EST INVENTÉ : noms, adresses, téléphones, avis. Aucun établissement
 *    réel n'est décrit ici.
 *  - Les photos sont des images SVG générées sur place (dégradés de la
 *    palette de `lib/theme.ts`) : aucune ressource n'est téléchargée.
 *  - Les dates sont calculées par rapport au jour de création, pour qu'il y
 *    ait toujours des réservations « à venir » et « passées ».
 *  - Les trois comptes de test partagent le mot de passe `MOT_DE_PASSE`.
 */
import { horodatage } from './base.mjs';
import { SERVICE } from './metier.mjs';
import { BUCKETS } from './stockage.mjs';

export const MOT_DE_PASSE = 'Yaka-test-2026';
export const COMPTES = {
  admin: 'admin@yakardc.test',
  partenaire: 'partenaire@yakardc.test',
  voyageur: 'voyageur@yakardc.test',
};

/** Palette du projet (reprise de `lib/theme.ts`, pour ne rien importer de l'application). */
const PALETTE = {
  lave: '#712B13',
  laveDeep: '#4A1B0C',
  fleuve: '#0F6E56',
  fleuveDark: '#085041',
  fleuveSoft: '#E1F5EE',
  or: '#854F0B',
  amber: '#FAC775',
  foret: '#1F4D3A',
  foretSoft: '#DCEEE3',
  nuit: '#1A0A03',
  nuit3: '#3D1408',
  soleil: '#F0A042',
  braise: '#D85A30',
};

/** Couleurs d'une image selon le métier : [haut, bas, astre, relief]. */
const TEINTES = {
  hotel: [PALETTE.lave, PALETTE.laveDeep, PALETTE.amber, PALETTE.nuit],
  furnished_house: [PALETTE.fleuve, PALETTE.fleuveDark, PALETTE.fleuveSoft, PALETTE.nuit],
  restaurant: [PALETTE.braise, PALETTE.or, PALETTE.amber, PALETTE.nuit3],
  site: [PALETTE.fleuve, PALETTE.foret, PALETTE.soleil, PALETTE.nuit],
  accueil: [PALETTE.nuit3, PALETTE.lave, PALETTE.soleil, PALETTE.nuit],
};

/**
 * Image sobre : un dégradé, un astre, deux reliefs. `variante` déplace les
 * éléments pour que deux photos ne soient pas identiques. Aucun texte.
 */
function imagePaysage([haut, bas, astre, relief], variante) {
  const alea = (n) => ((variante * 37 + n * 53) % 100) / 100;
  const colline = (niveau, hauteur, decalage) =>
    `M0 ${niveau} C ${300 + decalage} ${niveau - hauteur}, ${650 + decalage} ${niveau + hauteur * 0.6}, 1200 ${niveau - hauteur * 0.4} L1200 800 L0 800 Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="${(0.25 + alea(4) * 0.75).toFixed(2)}" y2="1">
      <stop offset="0" stop-color="${haut}"/>
      <stop offset="1" stop-color="${bas}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#fond)"/>
  <circle cx="${Math.round(220 + alea(1) * 760)}" cy="${Math.round(170 + alea(2) * 180)}" r="${Math.round(70 + alea(3) * 60)}" fill="${astre}" opacity="0.5"/>
  <path d="${colline(Math.round(520 + alea(5) * 80), 90, Math.round(alea(6) * 200))}" fill="${relief}" opacity="0.3"/>
  <path d="${colline(Math.round(650 + alea(7) * 50), 60, -Math.round(alea(8) * 150))}" fill="${relief}" opacity="0.5"/>
</svg>
`;
}

/** Logo sans texte : deux cercles sur un dégradé. */
function imageLogo([haut, bas, astre]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${haut}"/>
      <stop offset="1" stop-color="${bas}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#fond)"/>
  <circle cx="200" cy="200" r="110" fill="none" stroke="${astre}" stroke-width="18" opacity="0.9"/>
  <circle cx="200" cy="200" r="42" fill="${astre}"/>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Contenu
// ---------------------------------------------------------------------------

/** Catalogue des catégories d'offres (migration 0007). */
const CATEGORIES = {
  hotel: [
    ['standard', 'Standard', 'Chambre confortable, équipements essentiels'],
    ['superieure', 'Supérieure', 'Plus spacieuse, meilleure vue ou équipements'],
    ['prestige', 'Prestige', 'Finitions haut de gamme'],
    ['deluxe', 'Deluxe', 'Grand confort, espace détente'],
    ['executive', 'Exécutive', 'Pensée pour le voyage d\'affaires'],
    ['familiale', 'Familiale', 'Plusieurs couchages pour une famille'],
    ['junior_suite', 'Junior Suite', 'Chambre avec coin salon'],
    ['suite', 'Suite', 'Chambre et salon séparés'],
    ['suite_prestige', 'Suite Prestige', 'Suite aux prestations supérieures'],
    ['suite_diplomatique', 'Suite Diplomatique', 'Grande suite de représentation'],
    ['suite_presidentielle', 'Suite Présidentielle', 'La plus belle suite de l\'établissement'],
  ],
  furnished_house: [
    ['logement_entier', 'Logement entier', 'Le logement est réservé à vous seuls'],
    ['chambre_privee', 'Chambre privée', 'Une chambre dans un logement partagé'],
  ],
  restaurant: [
    ['menu_du_jour', 'Menu du jour', 'Entrée, plat ou dessert du jour'],
    ['formule_dejeuner', 'Formule déjeuner', 'Servie le midi'],
    ['formule_diner', 'Formule dîner', 'Servie le soir'],
    ['menu_degustation', 'Menu dégustation', 'Plusieurs services, choix du chef'],
    ['brunch', 'Brunch', 'Servi en fin de matinée'],
  ],
  site: [
    ['billet_adulte', 'Billet adulte', 'Entrée plein tarif'],
    ['billet_enfant', 'Billet enfant', 'Entrée pour les moins de 12 ans'],
    ['tarif_resident', 'Tarif résident', 'Sur présentation d\'une pièce d\'identité'],
    ['visite_guidee', 'Visite guidée', 'Avec un guide du site'],
    ['pass_famille', 'Pass famille', 'Deux adultes et deux enfants'],
    ['pass_groupe', 'Pass groupe', 'À partir de dix personnes'],
  ],
};

const OUVERT_TOUJOURS = { always_open: true, days: {} };
const horaires = (semaine, samedi = semaine, dimanche = null) => {
  const plage = (texte) => (texte ? { from: texte.split('-')[0], to: texte.split('-')[1] } : null);
  return {
    always_open: false,
    days: { mon: plage(semaine), tue: plage(semaine), wed: plage(semaine), thu: plage(semaine), fri: plage(semaine), sat: plage(samedi), sun: plage(dimanche) },
  };
};

const plat = (label, price, description = null) => ({ label, description, price, currency: 'USD' });

/**
 * Les établissements. `proprietaire` : 'partenaire' (le compte de test) ou
 * 'hote' (un compte figurant qui possède tous les autres).
 * `offres` : [clé de catégorie, prix USD, stock, personnes max, libellé libre].
 */
const ETABLISSEMENTS = [
  {
    cle: 'rive-congo',
    proprietaire: 'partenaire',
    type: 'hotel',
    name: 'Hôtel Rive Congo',
    commune: 'Gombe',
    neighborhood: 'Quartier du Fleuve',
    avenue: 'Avenue des Berges',
    numero: '12',
    reference: 'À deux rues du boulevard, côté fleuve',
    description:
      'Un hôtel calme au cœur de la Gombe, à quelques minutes des ministères et des ambassades. Chambres climatisées, groupe électrogène, petit-déjeuner servi en terrasse face au fleuve.',
    amenities: ['Wifi', 'Parking', 'Climatisation', 'Petit-déjeuner', 'Restaurant', 'Sécurité 24h', 'Générateur', 'Eau chaude'],
    opening_hours: OUVERT_TOUJOURS,
    lat: -4.3015,
    lng: 15.3105,
    discount_percent: 10,
    discount_label: 'Offre de lancement',
    logo: true,
    offres: [
      ['standard', 85, 6, 2, null],
      ['superieure', 120, 4, 2, 'Supérieure vue fleuve'],
      ['suite', 210, 2, 3, null],
    ],
  },
  {
    cle: 'mont-ngaliema',
    proprietaire: 'hote',
    type: 'hotel',
    name: 'Résidence Mont-Ngaliema',
    commune: 'Ngaliema',
    neighborhood: 'Ma Campagne',
    avenue: 'Avenue des Collines',
    numero: '48',
    reference: 'Après le rond-point, portail vert',
    description:
      'Sur les hauteurs de Ngaliema, une résidence hôtelière entourée de jardins. Piscine, salle de conférence et navette vers le centre-ville sur demande.',
    amenities: ['Wifi', 'Parking', 'Climatisation', 'Piscine', 'Salle de conférence', 'Bar', 'Sécurité 24h', 'Générateur', 'TV satellite'],
    opening_hours: OUVERT_TOUJOURS,
    lat: -4.3402,
    lng: 15.2581,
    logo: true,
    offres: [
      ['standard', 70, 8, 2, null],
      ['deluxe', 140, 4, 2, null],
      ['suite_prestige', 260, 1, 4, null],
    ],
  },
  {
    cle: 'jardins-limete',
    proprietaire: 'hote',
    type: 'hotel',
    name: 'Hôtel Les Jardins de Limete',
    commune: 'Limete',
    neighborhood: 'Résidentiel',
    avenue: '7e Rue',
    numero: '21',
    reference: 'Proche de l\'échangeur',
    description:
      'Adresse familiale et abordable, pratique pour rejoindre l\'aéroport de N\'Djili. Chambres simples et propres, cour ombragée, cuisine congolaise le soir.',
    amenities: ['Wifi', 'Parking', 'Climatisation', 'Petit-déjeuner', 'Générateur'],
    opening_hours: OUVERT_TOUJOURS,
    lat: -4.3706,
    lng: 15.3449,
    offres: [
      ['standard', 55, 10, 2, null],
      ['familiale', 95, 3, 5, null],
    ],
  },
  {
    cle: 'villa-bougainvilliers',
    proprietaire: 'hote',
    type: 'furnished_house',
    name: 'Villa Bougainvilliers',
    commune: 'Ngaliema',
    neighborhood: 'Binza Pigeon',
    avenue: 'Avenue des Manguiers',
    numero: '5',
    reference: 'Maison blanche au fond de l\'impasse',
    description:
      'Villa de trois chambres avec jardin clos et terrasse couverte. Idéale pour une famille ou une équipe en mission : cuisine équipée, gardien, linge fourni.',
    amenities: ['Wifi', 'Parking', 'Climatisation', 'Sécurité 24h', 'Générateur', 'Eau chaude', 'TV satellite'],
    opening_hours: null,
    lat: -4.3655,
    lng: 15.2462,
    offres: [['logement_entier', 150, 1, 6, 'Villa entière, 3 chambres']],
  },
  {
    cle: 'appartements-kintambo',
    proprietaire: 'hote',
    type: 'furnished_house',
    name: 'Appartements Kintambo Magasin',
    commune: 'Kintambo',
    neighborhood: 'Magasin',
    avenue: 'Avenue du Marché',
    numero: '33',
    reference: 'Immeuble de quatre étages, face à la pharmacie',
    description:
      'Appartements meublés d\'une ou deux chambres, au-dessus d\'un quartier commerçant animé. Ascenseur, eau chaude et connexion fibre.',
    amenities: ['Wifi', 'Climatisation', 'Générateur', 'Eau chaude', 'TV satellite'],
    opening_hours: null,
    lat: -4.3276,
    lng: 15.2743,
    discount_percent: 15,
    discount_label: 'Séjour longue durée',
    offres: [
      ['logement_entier', 80, 3, 4, 'Appartement 2 chambres'],
      ['chambre_privee', 35, 2, 2, null],
    ],
  },
  {
    cle: 'maison-bandal',
    proprietaire: 'hote',
    type: 'furnished_house',
    name: 'Maison d\'hôtes Bandal Bisengo',
    commune: 'Bandal',
    neighborhood: 'Bisengo',
    avenue: 'Avenue Kimbondo',
    numero: '17',
    reference: 'Deux parcelles après le terrain de basket',
    description:
      'Une maison d\'hôtes conviviale dans un quartier vivant, réputé pour ses terrasses. Chambres privées avec salle d\'eau, salon et cuisine partagés.',
    amenities: ['Wifi', 'Climatisation', 'Petit-déjeuner', 'Eau chaude'],
    opening_hours: null,
    lat: -4.3441,
    lng: 15.2836,
    offres: [
      ['chambre_privee', 30, 4, 2, null],
      ['logement_entier', 110, 1, 8, 'Maison entière'],
    ],
  },
  {
    cle: 'maman-colette',
    proprietaire: 'hote',
    type: 'restaurant',
    name: 'Chez Maman Colette',
    commune: 'Bandal',
    neighborhood: 'Moulaert',
    avenue: 'Avenue Inga',
    numero: '9',
    reference: 'Terrasse couverte, à côté du salon de coiffure',
    description:
      'Cuisine congolaise de famille : pondu, poulet à la moambe, poisson braisé et chikwangue. Portions généreuses, service sans chichis.',
    amenities: ['Parking', 'Bar', 'Générateur'],
    opening_hours: horaires('11:00-22:00', '11:00-23:30', '12:00-21:00'),
    lat: -4.3398,
    lng: 15.2871,
    menu: {
      sections: [
        { title: 'Plats', items: [plat('Poulet à la moambe', 12, 'Riz ou chikwangue'), plat('Poisson braisé', 15, 'Capitaine du fleuve, bananes plantains'), plat('Pondu au poisson fumé', 9)] },
        { title: 'Boissons', items: [plat('Jus de gingembre maison', 3), plat('Bière locale', 3)] },
      ],
    },
    offres: [
      ['menu_du_jour', 12, 40, null, null],
      ['formule_dejeuner', 18, 30, null, 'Formule déjeuner complète'],
    ],
  },
  {
    cle: 'terrasse-fleuve',
    proprietaire: 'hote',
    type: 'restaurant',
    name: 'La Terrasse du Fleuve',
    commune: 'Gombe',
    neighborhood: 'Quartier du Fleuve',
    avenue: 'Avenue des Berges',
    numero: '2',
    reference: 'Au bord de l\'eau, entrée par le parking',
    description:
      'Table soignée avec vue sur le fleuve Congo et Brazzaville en face. Poissons grillés, cuisine d\'inspiration congolaise et française, belle carte de jus frais.',
    amenities: ['Wifi', 'Parking', 'Climatisation', 'Bar', 'Sécurité 24h', 'Générateur'],
    opening_hours: horaires('12:00-23:00', '12:00-23:59', '11:00-17:00'),
    lat: -4.2978,
    lng: 15.3052,
    logo: true,
    menu: {
      sections: [
        { title: 'Entrées', items: [plat('Samoussas de capitaine', 9), plat('Salade d\'avocat et crevettes', 11)] },
        { title: 'Plats', items: [plat('Capitaine grillé', 26, 'Sauce pili-pili, légumes du jour'), plat('Cabri braisé', 24), plat('Liboke de poisson', 22, 'Cuit en feuilles')] },
        { title: 'Desserts', items: [plat('Ananas rôti', 7), plat('Fondant au chocolat', 8)] },
      ],
    },
    offres: [
      ['formule_diner', 35, 24, null, null],
      ['menu_degustation', 60, 12, null, 'Dégustation cinq services'],
      ['brunch', 28, 30, null, 'Brunch du dimanche'],
    ],
  },
  {
    cle: 'liboke-mboka',
    proprietaire: 'hote',
    type: 'restaurant',
    name: 'Liboke na Mboka',
    commune: 'Kalamu',
    neighborhood: 'Matonge',
    avenue: 'Avenue de la Victoire',
    numero: '64',
    reference: 'Près du rond-point, enseigne rouge',
    description:
      'Le rendez-vous des amateurs de liboke et de grillades, au cœur de Matonge. Ambiance musicale le week-end, service tardif.',
    amenities: ['Bar', 'Générateur'],
    opening_hours: horaires('12:00-23:30', '12:00-23:59', '13:00-23:00'),
    lat: -4.3352,
    lng: 15.3151,
    menu: {
      sections: [
        { title: 'Plats', items: [plat('Liboke de poulet', 11), plat('Brochettes de chèvre', 8, 'Par six'), plat('Makayabu aux légumes', 10)] },
        { title: 'Boissons', items: [plat('Jus de bissap', 2), plat('Eau minérale', 1)] },
      ],
    },
    offres: [
      ['menu_du_jour', 10, 50, null, null],
      ['formule_diner', 22, 30, null, null],
    ],
  },
  {
    cle: 'vallee-nsele',
    proprietaire: 'hote',
    type: 'site',
    name: 'Parc de la Vallée de la N\'Sele',
    commune: 'N\'Sele',
    neighborhood: 'Kinkole',
    avenue: 'Route de la Vallée',
    numero: null,
    reference: 'À la sortie est de la ville, suivre les panneaux',
    description:
      'Un grand parc naturel à une heure du centre : savane, étangs, sentiers balisés et aires de pique-nique. Visites guidées pour observer les oiseaux et la faune.',
    amenities: ['Parking', 'Restaurant', 'Sécurité 24h'],
    opening_hours: horaires('08:00-17:30', '08:00-18:00', '08:00-18:00'),
    lat: -4.2584,
    lng: 15.6102,
    logo: true,
    menu: {
      sections: [
        { title: 'Attractions', items: [plat('Sentier des étangs', null, 'Boucle de 3 km'), plat('Observatoire des oiseaux', null)] },
        { title: 'Services', items: [plat('Location de vélo', 5, 'L\'heure'), plat('Panier pique-nique', 12)] },
      ],
    },
    offres: [
      ['billet_adulte', 10, 200, null, null],
      ['billet_enfant', 5, 200, null, null],
      ['visite_guidee', 25, 20, null, 'Visite guidée de deux heures'],
      ['pass_famille', 30, 40, null, null],
    ],
  },
  {
    cle: 'jardin-orchidees',
    proprietaire: 'hote',
    type: 'site',
    name: 'Jardin des Orchidées de Kintambo',
    commune: 'Kintambo',
    neighborhood: 'Jamaïque',
    avenue: 'Avenue du Jardin',
    numero: '1',
    reference: 'Entrée par la grille en fer forgé',
    description:
      'Un jardin tropical au calme, à l\'écart de la circulation : collection d\'orchidées, serre, allées ombragées et salon de thé.',
    amenities: ['Parking', 'Bar'],
    opening_hours: horaires('09:00-17:00', '09:00-18:00', '10:00-18:00'),
    lat: -4.3219,
    lng: 15.2702,
    offres: [
      ['billet_adulte', 5, 150, null, null],
      ['billet_enfant', 2, 150, null, null],
      ['tarif_resident', 3, 150, null, null],
    ],
  },
  {
    cle: 'belvedere-rapides',
    proprietaire: 'hote',
    type: 'site',
    name: 'Belvédère des Rapides',
    commune: 'Ngaliema',
    neighborhood: 'Kinsuka',
    avenue: 'Route des Pêcheurs',
    numero: null,
    reference: 'Au bout de la piste, après le village de pêcheurs',
    description:
      'Point de vue aménagé sur les rapides du fleuve Congo. Coucher de soleil remarquable, guides locaux, restauration légère sur place.',
    amenities: ['Parking', 'Restaurant'],
    opening_hours: horaires('08:00-18:30', '08:00-19:00', '08:00-19:00'),
    lat: -4.3331,
    lng: 15.2251,
    offres: [
      ['billet_adulte', 4, 300, null, null],
      ['visite_guidee', 15, 15, null, null],
      ['pass_groupe', 60, 10, null, 'Groupe jusqu\'à 20 personnes'],
    ],
  },
  // Les deux suivants ne doivent PAS apparaître côté public tels quels :
  // l'un attend sa validation, l'autre est suspendu par l'administration.
  {
    cle: 'etoile-lemba',
    proprietaire: 'hote',
    type: 'hotel',
    status: 'pending',
    name: 'Hôtel Étoile de Lemba',
    commune: 'Lemba',
    neighborhood: 'Salongo',
    avenue: 'Avenue de l\'Université',
    numero: '110',
    reference: 'Non loin du campus',
    description: 'Petit hôtel récent proche de l\'université, en attente de validation par l\'administration.',
    amenities: ['Wifi', 'Climatisation', 'Générateur'],
    opening_hours: OUVERT_TOUJOURS,
    lat: -4.3997,
    lng: 15.3201,
    offres: [['standard', 45, 12, 2, null]],
  },
  {
    cle: 'le-carrefour',
    proprietaire: 'hote',
    type: 'restaurant',
    suspendu: 'Plusieurs réservations confirmées puis non honorées.',
    name: 'Bar-Restaurant Le Carrefour',
    commune: 'Barumbu',
    neighborhood: 'Kapinga',
    avenue: 'Avenue Kabambare',
    numero: '77',
    reference: 'Au croisement, côté station-service',
    description: 'Grillades et boissons fraîches à toute heure. Établissement actuellement suspendu.',
    amenities: ['Bar'],
    opening_hours: horaires('10:00-23:59'),
    lat: -4.3189,
    lng: 15.3272,
    offres: [['menu_du_jour', 8, 30, null, null]],
  },
];

/** Avis : [clé d'établissement, auteur, note, commentaire, réponse du partenaire]. */
const AVIS = [
  ['rive-congo', 'voyageur2', 5, 'Accueil impeccable et chambre très propre. Le petit-déjeuner en terrasse vaut le détour.', 'Merci pour votre confiance, au plaisir de vous revoir.'],
  ['rive-congo', 'voyageur3', 4, 'Très bien situé. Une coupure de courant d\'une minute, vite relayée par le groupe.', null],
  ['rive-congo', 'voyageur4', 3, 'Correct, mais le wifi était lent le soir.', 'Nous avons depuis doublé le débit. Merci du retour.'],
  ['mont-ngaliema', 'voyageur', 5, 'Cadre magnifique, piscine propre, personnel aux petits soins.', null],
  ['mont-ngaliema', 'voyageur2', 4, 'Un peu loin du centre mais très reposant.', null],
  ['jardins-limete', 'voyageur3', 3, 'Simple et pratique avant un vol matinal.', null],
  ['villa-bougainvilliers', 'voyageur4', 5, 'Villa parfaite pour notre équipe, gardien très serviable.', null],
  ['appartements-kintambo', 'voyageur2', 2, 'Appartement bruyant côté rue, sinon bien équipé.', null],
  ['maman-colette', 'voyageur', 5, 'La meilleure moambe que j\'ai mangée à Kinshasa.', null],
  ['maman-colette', 'voyageur3', 4, 'Copieux et pas cher. Un peu d\'attente le samedi.', null],
  ['terrasse-fleuve', 'voyageur2', 5, 'Vue superbe au coucher du soleil, capitaine grillé excellent.', null],
  ['terrasse-fleuve', 'voyageur4', 4, 'Très bon, addition un peu élevée.', null],
  ['liboke-mboka', 'voyageur3', 4, 'Ambiance garantie le vendredi soir.', null],
  ['vallee-nsele', 'voyageur', 4, 'Belle sortie en famille. Prévoir de l\'eau et un chapeau.', null],
  ['vallee-nsele', 'voyageur4', 5, 'Le guide connaissait tous les oiseaux. Journée mémorable.', null],
  ['jardin-orchidees', 'voyageur2', 3, 'Joli jardin, mais on en fait vite le tour.', null],
  ['belvedere-rapides', 'voyageur3', 5, 'Spectaculaire en fin de journée.', null],
];

// ---------------------------------------------------------------------------
// Remplissage
// ---------------------------------------------------------------------------

const jourRelatif = (ecart) => {
  const date = new Date();
  date.setDate(date.getDate() + ecart);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const ilYA = (jours, heures = 0) => horodatage(new Date(Date.now() - (jours * 24 + heures) * 3600 * 1000));

/**
 * Remplit une base vide. Tout passe par le moteur avec l'identité de
 * service : mêmes contrôles (types, unicités, clés étrangères, capacité)
 * que pour une écriture venue de l'application.
 *
 * @returns un court résumé, affiché par le serveur
 */
export function semer({ base, auth, stockage }) {
  const service = { qui: SERVICE };
  const bucket = BUCKETS[0];
  const inserer = (table, valeurs) => base.inserer(table, valeurs, service);

  return base.transaction(() => {
    // --- Comptes ---
    const compte = (email, nom, telephone, role) => {
      const cree = auth.creerCompte({ email, motDePasse: MOT_DE_PASSE, metadonnees: { full_name: nom, phone: telephone } });
      if (role !== 'traveler') base.modifier('profiles', base.parCle('profiles', cree.id), { role }, service);
      return cree.id;
    };
    const ids = {
      admin: compte(COMPTES.admin, 'Administration YakaRDC', '+243810000001', 'admin'),
      partenaire: compte(COMPTES.partenaire, 'Patrick Ilunga', '+243810000002', 'partner'),
      voyageur: compte(COMPTES.voyageur, 'Grâce Mbuyi', '+243810000003', 'traveler'),
      // Figurants : ils peuplent la base (autres établissements, avis) mais ne servent pas à se connecter.
      hote: compte('hote.figurant@yakardc.test', 'Jeanne Kabongo', '+243810000004', 'partner'),
      voyageur2: compte('voyageur2.figurant@yakardc.test', 'Didier Mukendi', '+243810000005', 'traveler'),
      voyageur3: compte('voyageur3.figurant@yakardc.test', 'Sarah Lumbala', '+243810000006', 'traveler'),
      voyageur4: compte('voyageur4.figurant@yakardc.test', 'Olivier Tshibangu', '+243810000007', 'traveler'),
    };

    // --- Villes (les communes de Kinshasa viennent de `lib/geography.ts`, côté application) ---
    inserer('cities', { name: 'Kinshasa', is_active: true });
    inserer('cities', { name: 'Lubumbashi', is_active: false });
    inserer('cities', { name: 'Goma', is_active: false });

    // --- Catalogue des offres ---
    const categories = {};
    for (const [type, liste] of Object.entries(CATEGORIES)) {
      liste.forEach(([key, label, description_hint], index) => {
        categories[`${type}/${key}`] = inserer('offer_categories', { establishment_type: type, key, label, description_hint, position: index + 1 }).id;
      });
    }

    // --- Images d'accueil et réglages lus par l'écran d'accueil ---
    const image = (chemin, contenu) => stockage.ecrire(bucket, chemin, Buffer.from(contenu, 'utf8'), 'image/svg+xml');
    const heros = [1, 2, 3].map((n) => image(`app-assets/graine-accueil-${n}.svg`, imagePaysage(TEINTES.accueil, n * 3)));
    const reglages = {
      home_hero_image_url: JSON.stringify(heros),
      home_story_image_url: image('app-assets/graine-recit.svg', imagePaysage(TEINTES.site, 11)),
      home_category_hotel_url: image('app-assets/graine-categorie-hotel.svg', imagePaysage(TEINTES.hotel, 21)),
      home_category_furnished_house_url: image('app-assets/graine-categorie-maison.svg', imagePaysage(TEINTES.furnished_house, 22)),
      home_category_restaurant_url: image('app-assets/graine-categorie-restaurant.svg', imagePaysage(TEINTES.restaurant, 23)),
      home_category_site_url: image('app-assets/graine-categorie-site.svg', imagePaysage(TEINTES.site, 24)),
      auth_background_url: image('app-assets/graine-connexion.svg', imagePaysage(TEINTES.accueil, 31)),
    };
    for (const [key, value] of Object.entries(reglages)) inserer('app_settings', { key, value });

    // --- Établissements, offres, photos ---
    const etablissements = {};
    const offres = {};
    ETABLISSEMENTS.forEach((fiche, rang) => {
      const teintes = TEINTES[fiche.type];
      const dossier = `graine/${fiche.cle}`;
      const etablissement = inserer('establishments', {
        owner_id: ids[fiche.proprietaire],
        type: fiche.type,
        name: fiche.name,
        description: fiche.description,
        city: 'Kinshasa',
        commune: fiche.commune,
        neighborhood: fiche.neighborhood,
        avenue: fiche.avenue,
        numero: fiche.numero,
        reference: fiche.reference,
        address: [fiche.numero, fiche.avenue, fiche.neighborhood, fiche.commune].filter(Boolean).join(', '),
        lat: fiche.lat,
        lng: fiche.lng,
        phone: `+2438200010${String(rang + 1).padStart(2, '0')}`,
        email: `contact@${fiche.cle}.yakardc.test`,
        instagram: fiche.logo ? `${fiche.cle.replaceAll('-', '')}_kin` : null,
        logo_url: fiche.logo ? image(`${dossier}/logo.svg`, imageLogo(teintes)) : null,
        amenities: fiche.amenities,
        status: fiche.status ?? 'approved',
        warning_count: fiche.suspendu ? 2 : 0,
        suspended_at: fiche.suspendu ? ilYA(4) : null,
        suspension_reason: fiche.suspendu ?? null,
        discount_percent: fiche.discount_percent ?? null,
        discount_label: fiche.discount_label ?? null,
        view_count: 40 + ((rang * 67) % 300),
        opening_hours: fiche.opening_hours,
        menu: fiche.menu ?? null,
        created_at: ilYA(90 - rang * 5),
      });
      etablissements[fiche.cle] = etablissement.id;

      fiche.offres.forEach(([cle, prix, stock, personnes, libelle], index) => {
        const offre = inserer('establishment_offers', {
          establishment_id: etablissement.id,
          category_id: categories[`${fiche.type}/${cle}`],
          custom_label: libelle,
          description: null,
          price: prix,
          currency: 'USD',
          unit: fiche.type === 'hotel' || fiche.type === 'furnished_house' ? 'night' : 'person',
          quantity: stock,
          max_guests: personnes,
          amenities: fiche.type === 'hotel' ? fiche.amenities.slice(0, 3) : [],
          position: index,
        });
        offres[`${fiche.cle}/${cle}`] = offre;
        // Une photo propre à la première offre de chaque hébergement.
        if (index === 0 && (fiche.type === 'hotel' || fiche.type === 'furnished_house')) {
          inserer('listing_photos', {
            establishment_id: etablissement.id,
            offer_id: offre.id,
            url: image(`${dossier}/offre-${cle}.svg`, imagePaysage(teintes, rang * 7 + 5)),
            category: 'general',
            position: 0,
          });
        }
      });

      [0, 1, 2].forEach((position) => {
        inserer('listing_photos', {
          establishment_id: etablissement.id,
          url: image(`${dossier}/photo-${position + 1}.svg`, imagePaysage(teintes, rang * 7 + position)),
          category: 'general',
          position,
        });
      });
      if (fiche.type === 'restaurant' || fiche.type === 'site') {
        inserer('listing_photos', {
          establishment_id: etablissement.id,
          url: image(`${dossier}/carte.svg`, imagePaysage(teintes, rang * 7 + 4)),
          category: fiche.type === 'restaurant' ? 'menu' : 'pricing',
          position: 0,
        });
      }
    });

    for (const raison of ['Annulation tardive signalée par un client.', 'Deuxième réservation confirmée non honorée.']) {
      inserer('establishment_warnings', { establishment_id: etablissements['le-carrefour'], issued_by: ids.admin, reason: raison, created_at: ilYA(6) });
    }

    // --- Réservations ---
    // `lignes` : [clé d'offre, quantité]. Le prix unitaire est celui de l'offre au moment de la réservation.
    let numero = 0;
    const reserver = ({ etablissement, voyageur, nom, statut, lignes, ancienneteJours, ...reste }) => {
      numero += 1;
      const [prenom, ...famille] = nom.split(' ');
      const aUnCode = statut === 'confirmed' || statut === 'checked_in';
      const reservation = inserer('bookings', {
        establishment_id: etablissements[etablissement],
        traveler_id: ids[voyageur],
        status: statut,
        first_name: prenom,
        last_name: famille.join(' '),
        contact_phone: `81000000${String(numero).padStart(2, '0')}`,
        contact_email: `${voyageur}@yakardc.test`,
        // Codes fixes et lisibles : pratique pour essayer la validation d'un billet à la main.
        unique_code: aUnCode ? `YK-00000${numero.toString(16).toUpperCase().padStart(2, '0')}` : null,
        used_at: statut === 'checked_in' ? ilYA(Math.max(ancienneteJours - 1, 0)) : null,
        validated_by: statut === 'checked_in' ? ids[ETABLISSEMENTS.find((fiche) => fiche.cle === etablissement).proprietaire] : null,
        created_at: ilYA(ancienneteJours),
        ...reste,
      });
      for (const [cle, quantite] of lignes) {
        const offre = offres[`${etablissement}/${cle}`];
        inserer('booking_items', { booking_id: reservation.id, offer_id: offre.id, quantity: quantite, unit_price: offre.price, currency: 'USD', created_at: reservation.created_at });
      }
      return reservation;
    };

    // Le voyageur de test a une réservation dans chaque statut.
    reserver({ etablissement: 'rive-congo', voyageur: 'voyageur', nom: 'Grâce Mbuyi', statut: 'pending', ancienneteJours: 0, guests: 2, check_in: jourRelatif(10), check_out: jourRelatif(13), arrival_time: '15:00', metadata: { payment_method: 'on_site' }, lignes: [['standard', 1]] });
    const aValider = reserver({ etablissement: 'rive-congo', voyageur: 'voyageur', nom: 'Grâce Mbuyi', statut: 'confirmed', ancienneteJours: 2, guests: 2, check_in: jourRelatif(0), check_out: jourRelatif(2), arrival_time: '18:00', metadata: { payment_method: 'on_site' }, lignes: [['superieure', 1]] });
    reserver({ etablissement: 'terrasse-fleuve', voyageur: 'voyageur', nom: 'Grâce Mbuyi', statut: 'confirmed', ancienneteJours: 1, guests: 2, visit_date: jourRelatif(3), visit_time: '19:30', metadata: { occasion: 'Anniversaire', allergies: null }, lignes: [['formule_diner', 2]] });
    const sejourFait = reserver({ etablissement: 'vallee-nsele', voyageur: 'voyageur', nom: 'Grâce Mbuyi', statut: 'checked_in', ancienneteJours: 9, guests: 2, children: 2, visit_date: jourRelatif(-7), visit_time: '10:00', metadata: { visit_type: 'Famille', nationality: 'Congolaise' }, lignes: [['pass_famille', 1]] });
    reserver({ etablissement: 'villa-bougainvilliers', voyageur: 'voyageur', nom: 'Grâce Mbuyi', statut: 'rejected', ancienneteJours: 5, guests: 5, check_in: jourRelatif(20), check_out: jourRelatif(22), metadata: {}, lignes: [['logement_entier', 1]] });
    reserver({ etablissement: 'mont-ngaliema', voyageur: 'voyageur', nom: 'Grâce Mbuyi', statut: 'cancelled', ancienneteJours: 30, guests: 1, check_in: jourRelatif(-20), check_out: jourRelatif(-18), cancellation_reason: 'Changement de programme.', metadata: {}, lignes: [['standard', 1]] });

    // De quoi remplir l'espace du partenaire de test.
    reserver({ etablissement: 'rive-congo', voyageur: 'voyageur2', nom: 'Didier Mukendi', statut: 'pending', ancienneteJours: 0, guests: 1, check_in: jourRelatif(4), check_out: jourRelatif(6), metadata: {}, lignes: [['standard', 1]] });
    reserver({ etablissement: 'rive-congo', voyageur: 'voyageur3', nom: 'Sarah Lumbala', statut: 'confirmed', ancienneteJours: 3, guests: 3, check_in: jourRelatif(1), check_out: jourRelatif(5), metadata: {}, lignes: [['suite', 1]] });
    reserver({ etablissement: 'rive-congo', voyageur: 'voyageur4', nom: 'Olivier Tshibangu', statut: 'checked_in', ancienneteJours: 14, guests: 2, check_in: jourRelatif(-12), check_out: jourRelatif(-9), metadata: {}, lignes: [['standard', 2]] });
    reserver({ etablissement: 'maman-colette', voyageur: 'voyageur2', nom: 'Didier Mukendi', statut: 'confirmed', ancienneteJours: 1, guests: 4, visit_date: jourRelatif(1), visit_time: '13:00', metadata: {}, lignes: [['menu_du_jour', 4]] });

    // --- Avis ---
    AVIS.forEach(([cle, auteur, note, commentaire, reponse], index) => {
      const verifie = cle === 'vallee-nsele' && auteur === 'voyageur';
      inserer('reviews', {
        establishment_id: etablissements[cle],
        traveler_id: ids[auteur],
        booking_id: verifie ? sejourFait.id : null,
        rating: note,
        comment: commentaire,
        is_verified_stay: verifie,
        partner_reply: reponse,
        partner_replied_at: reponse ? ilYA(index) : null,
        created_at: ilYA(index + 2),
      });
    });

    // --- Favoris, carnet de voyage ---
    ['terrasse-fleuve', 'vallee-nsele', 'villa-bougainvilliers'].forEach((cle, index) => {
      inserer('favorites', { traveler_id: ids.voyageur, establishment_id: etablissements[cle], created_at: ilYA(index + 1) });
    });
    const plan = inserer('trip_plans', {
      traveler_id: ids.voyageur,
      title: 'Week-end à Kinshasa',
      destination: 'Kinshasa',
      start_date: jourRelatif(10),
      end_date: jourRelatif(13),
      traveler_count: 2,
      planned_budget: 600,
      notes: 'Arrivée par le vol du matin.',
    });
    inserer('trip_plan_items', { trip_plan_id: plan.id, establishment_id: etablissements['rive-congo'], item_type: 'itinerary', day_date: jourRelatif(10), time: '15:00', title: 'Installation à l\'hôtel', estimated_cost: 255, position: 0 });
    inserer('trip_plan_items', { trip_plan_id: plan.id, establishment_id: etablissements['terrasse-fleuve'], item_type: 'itinerary', day_date: jourRelatif(11), time: '19:30', title: 'Dîner au bord du fleuve', estimated_cost: 70, position: 0 });
    inserer('trip_plan_items', { trip_plan_id: plan.id, establishment_id: etablissements['belvedere-rapides'], item_type: 'wishlist', title: 'Belvédère des Rapides', estimated_cost: 8, position: 0 });
    [['documents', 'Passeport et visa'], ['documents', 'Carnet de vaccination'], ['clothing', 'Vêtements légers'], ['personal', 'Crème solaire']].forEach(([category, label], position) => {
      inserer('trip_packing_items', { trip_plan_id: plan.id, category, label, position, is_checked: position === 0 });
    });

    // --- Demandes de partenariat ---
    // Celle-ci attend une décision : l'approuver crée le compte du demandeur.
    inserer('partner_requests', {
      establishment_type: 'hotel',
      establishment_name: 'Auberge du Pool Malebo',
      description: 'Auberge de douze chambres avec vue sur le fleuve, ouverte depuis peu.',
      city: 'Kinshasa',
      commune: 'Gombe',
      neighborhood: 'Quartier du Fleuve',
      avenue: 'Avenue des Berges',
      numero: '40',
      reference: 'Bâtiment ocre',
      contact_name: 'Marie Nsimba',
      contact_phone: '+243820009901',
      contact_email: 'candidat@yakardc.test',
      created_at: ilYA(1),
    });
    const refusee = inserer('partner_requests', {
      establishment_type: 'restaurant',
      establishment_name: 'Snack Express Lemba',
      description: 'Restauration rapide à emporter.',
      city: 'Kinshasa',
      commune: 'Lemba',
      contact_name: 'Joseph Kalala',
      contact_phone: '+243820009902',
      contact_email: 'refuse@yakardc.test',
      created_at: ilYA(12),
    });
    // Le déclencheur de la table force « en attente » à l'insertion : le refus se fait donc après coup.
    base.modifier('partner_requests', refusee, { status: 'rejected', rejection_reason: 'Dossier incomplet : aucune photo ni adresse précise.', reviewed_by: ids.admin, reviewed_at: ilYA(10) }, service);

    // --- Journal d'administration ---
    inserer('admin_activity_log', { actor_id: ids.admin, action: 'establishment_suspended', target_type: 'establishment', target_id: etablissements['le-carrefour'], details: { name: 'Bar-Restaurant Le Carrefour' }, created_at: ilYA(4) });
    inserer('admin_activity_log', { actor_id: ids.admin, action: 'partner_request_rejected', target_type: 'partner_request', target_id: refusee.id, details: { establishment_name: 'Snack Express Lemba' }, created_at: ilYA(10) });

    return {
      etablissements: ETABLISSEMENTS.length,
      billetAValider: aValider.unique_code,
    };
  });
}
