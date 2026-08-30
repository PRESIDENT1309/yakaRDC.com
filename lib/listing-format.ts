import { DEFAULT_DIAL, findByDial } from './countries';

/**
 * Mise en forme des données affichées sur la fiche d'un établissement.
 *
 * Ces fonctions étaient définies au milieu de app/listing/[id].tsx, entre les
 * types et les formulaires. Elles n'ont rien de propre à cet écran : elles ne
 * lisent aucun état, ne rendent rien, et se vérifient en isolation. Les sortir
 * allège la fiche sans rien changer à son comportement.
 */

// ── Affichage de l'adresse ──
// Les données partenaires arrivent telles que saisies (« gombe », « gombe  »).
// On corrige à l'affichage uniquement, jamais en base.
export function titleCase(v: string): string {
  return v.trim().split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function sameValue(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// `profiles.full_name` est un champ libre : on ne peut que deviner la coupure.
// Premier mot = prénom, reste = nom. Les champs restent modifiables, donc une
// mauvaise coupure se corrige — contrairement à ne rien pré-remplir du tout.
export function splitFullName(full?: string | null): { firstName: string; lastName: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// Le téléphone du profil est stocké en un seul champ libre. S'il commence par
// un indicatif connu, on le sépare pour alimenter le sélecteur ; sinon on
// garde le numéro tel quel avec l'indicatif par défaut.
export function splitPhone(raw?: string | null): { dial: string; number: string } {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!v.startsWith('+')) return { dial: DEFAULT_DIAL, number: v };
  // Les indicatifs vont de 1 à 4 caractères après le « + » : on teste du plus
  // long au plus court pour ne pas confondre +1 et +125.
  for (let len = 4; len >= 1; len--) {
    const candidate = '+' + v.slice(1).replace(/\D/g, '').slice(0, len);
    if (findByDial(candidate)) {
      const rest = v.slice(candidate.length).trim();
      return { dial: candidate, number: rest };
    }
  }
  return { dial: DEFAULT_DIAL, number: v };
}

export function unitLabel(unit: string | null): string {
  if (unit === 'night') return '/ nuit';
  if (unit === 'person') return '/ pers.';
  if (unit === 'visit') return '/ visite';
  return '';
}
