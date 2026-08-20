// Indicatifs téléphoniques — pour le sélecteur des formulaires de réservation.
//
// Pas de drapeaux : illisibles à petite taille, et le design system interdit
// les emoji fonctionnels. Le nom du pays et l'indicatif suffisent à choisir.
//
// L'ordre n'est pas alphabétique en tête de liste : la RDC d'abord, puis les
// pays voisins et ceux de la diaspora congolaise (Belgique, France, Afrique
// du Sud), d'où proviennent une grande partie des réservations faites pour
// des proches. Le reste suit par ordre alphabétique et se trouve à la
// recherche.

export interface Country {
  /** Code ISO 3166-1 alpha-2, sert de clé stable */
  code: string;
  name: string;
  /** Indicatif au format international, avec le + */
  dial: string;
}

export const DEFAULT_DIAL = '+243';

/** Épinglés en tête : RDC, voisins, puis diaspora. */
const PINNED: Country[] = [
  { code: 'CD', name: 'RD Congo', dial: '+243' },
  { code: 'CG', name: 'Congo-Brazzaville', dial: '+242' },
  { code: 'AO', name: 'Angola', dial: '+244' },
  { code: 'RW', name: 'Rwanda', dial: '+250' },
  { code: 'BI', name: 'Burundi', dial: '+257' },
  { code: 'BE', name: 'Belgique', dial: '+32' },
  { code: 'FR', name: 'France', dial: '+33' },
  { code: 'ZA', name: 'Afrique du Sud', dial: '+27' },
];

const OTHERS: Country[] = [
  { code: 'DZ', name: 'Algérie', dial: '+213' },
  { code: 'DE', name: 'Allemagne', dial: '+49' },
  { code: 'SA', name: 'Arabie saoudite', dial: '+966' },
  { code: 'AU', name: 'Australie', dial: '+61' },
  { code: 'BJ', name: 'Bénin', dial: '+229' },
  { code: 'BR', name: 'Brésil', dial: '+55' },
  { code: 'CM', name: 'Cameroun', dial: '+237' },
  { code: 'CA', name: 'Canada', dial: '+1' },
  { code: 'CF', name: 'Centrafrique', dial: '+236' },
  { code: 'CN', name: 'Chine', dial: '+86' },
  { code: 'CI', name: "Côte d'Ivoire", dial: '+225' },
  { code: 'EG', name: 'Égypte', dial: '+20' },
  { code: 'AE', name: 'Émirats arabes unis', dial: '+971' },
  { code: 'ES', name: 'Espagne', dial: '+34' },
  { code: 'US', name: 'États-Unis', dial: '+1' },
  { code: 'ET', name: 'Éthiopie', dial: '+251' },
  { code: 'GA', name: 'Gabon', dial: '+241' },
  { code: 'GH', name: 'Ghana', dial: '+233' },
  { code: 'GN', name: 'Guinée', dial: '+224' },
  { code: 'IN', name: 'Inde', dial: '+91' },
  { code: 'IT', name: 'Italie', dial: '+39' },
  { code: 'JP', name: 'Japon', dial: '+81' },
  { code: 'KE', name: 'Kenya', dial: '+254' },
  { code: 'LB', name: 'Liban', dial: '+961' },
  { code: 'MG', name: 'Madagascar', dial: '+261' },
  { code: 'ML', name: 'Mali', dial: '+223' },
  { code: 'MA', name: 'Maroc', dial: '+212' },
  { code: 'MU', name: 'Maurice', dial: '+230' },
  { code: 'MZ', name: 'Mozambique', dial: '+258' },
  { code: 'NA', name: 'Namibie', dial: '+264' },
  { code: 'NG', name: 'Nigeria', dial: '+234' },
  { code: 'NL', name: 'Pays-Bas', dial: '+31' },
  { code: 'PT', name: 'Portugal', dial: '+351' },
  { code: 'GB', name: 'Royaume-Uni', dial: '+44' },
  { code: 'SN', name: 'Sénégal', dial: '+221' },
  { code: 'CH', name: 'Suisse', dial: '+41' },
  { code: 'TZ', name: 'Tanzanie', dial: '+255' },
  { code: 'TD', name: 'Tchad', dial: '+235' },
  { code: 'TG', name: 'Togo', dial: '+228' },
  { code: 'TN', name: 'Tunisie', dial: '+216' },
  { code: 'TR', name: 'Turquie', dial: '+90' },
  { code: 'UG', name: 'Ouganda', dial: '+256' },
  { code: 'ZM', name: 'Zambie', dial: '+260' },
  { code: 'ZW', name: 'Zimbabwe', dial: '+263' },
];

export const COUNTRIES: Country[] = [...PINNED, ...OTHERS];

/** Nombre de pays épinglés — l'appelant peut y insérer un séparateur. */
export const PINNED_COUNT = PINNED.length;

/**
 * Recherche insensible à la casse et aux accents, sur le nom comme sur
 * l'indicatif : taper « 243 », « +243 », « congo » ou « rd » doit fonctionner.
 * Une requête vide renvoie la liste complète, ordre d'épinglage conservé.
 */
export function searchCountries(query: string): Country[] {
  const q = normalize(query);
  if (!q) return COUNTRIES;
  return COUNTRIES.filter(c =>
    normalize(c.name).includes(q) || c.dial.replace('+', '').includes(q.replace('+', ''))
  );
}

export function findByDial(dial: string): Country | undefined {
  return COUNTRIES.find(c => c.dial === dial);
}

function normalize(v: string): string {
  return v.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
