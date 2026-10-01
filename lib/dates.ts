/**
 * Dates : conversions et libellés français.
 *
 * Ces fonctions vivaient dans `components/Calendar.tsx`, qui a été remplacé par
 * un sélecteur jour/mois/année. Les loger dans `lib/` les rend indépendantes du
 * composant qui les affiche — c'est ce qui a permis de supprimer le calendrier
 * sans rien casser ailleurs.
 */

export const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

/** Abrégés pour les colonnes étroites du sélecteur. */
export const MOIS_COURTS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
] as const;

/** `Date` → « AAAA-MM-JJ ». Construit à la main, sans `toISOString()` : ce
 *  dernier passe par UTC et décale la date d'un jour selon le fuseau. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** « 2026-09-01 » → « 1 septembre 2026 ». */
export function formatFrench(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MOIS[m - 1]} ${y}`;
}

/** Nombre de jours d'un mois donné (mois 0-indexé, comme `Date`). */
export function joursDansMois(annee: number, mois: number): number {
  return new Date(annee, mois + 1, 0).getDate();
}

/** Compose une date ISO à partir de ses trois parties. */
export function composerIso(annee: number, mois: number, jour: number): string {
  return `${annee}-${String(mois + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

/** Décompose une date ISO. Retourne `null` si la chaîne est vide ou invalide. */
export function decomposerIso(iso: string | null | undefined):
  { annee: number; mois: number; jour: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { annee: y, mois: m - 1, jour: d };
}

/** « JJ/MM/AAAA » → « AAAA-MM-JJ », ou `null` si la saisie est incomplète. */
export function frVersIso(v: string): string | null {
  const [d, m, y] = v.split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** « AAAA-MM-JJ » → « JJ/MM/AAAA ». */
export function isoVersFr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
