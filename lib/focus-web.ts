import { Platform } from 'react-native';
import { colors } from './theme';

const ID = 'yaka-focus';
const BOITE = 'data-yaka-champ';

/** Hauteur au-delà de laquelle un ancêtre est une carte ou un écran, plus un champ. */
const HAUTEUR_MAX_BOITE = 72;

const ANNEAU = `
  outline: 2px solid ${colors.lave} !important;
  outline-offset: 0 !important;
  box-shadow: 0 0 0 4px ${colors.cream} !important;`;

function estDessine(style: CSSStyleDeclaration): boolean {
  const fond = style.backgroundColor;
  return parseFloat(style.borderTopWidth) > 0 || (fond !== 'transparent' && fond !== 'rgba(0, 0, 0, 0)');
}

/**
 * La boîte qui, à l'œil, EST le champ.
 *
 * Beaucoup de champs de l'application sont une saisie nue posée dans une barre
 * qui porte le fond, le filet et l'arrondi (recherche, connexion, mot de
 * passe avec son œil). L'anneau dessiné sur la saisie y traçait un rectangle
 * à l'intérieur de la barre arrondie. On le reporte donc sur le premier
 * ancêtre dessiné — s'il a bien la taille d'un champ.
 *
 * Renvoie `null` quand la saisie porte elle-même son contour (`FormField`) ou
 * qu'aucune barre ne l'entoure : l'anneau reste alors sur la saisie.
 */
function boiteDuChamp(champ: HTMLElement): HTMLElement | null {
  if (estDessine(getComputedStyle(champ))) return null;
  let ancetre = champ.parentElement;
  for (let n = 0; n < 3 && ancetre; n++, ancetre = ancetre.parentElement) {
    if (estDessine(getComputedStyle(ancetre))) {
      return ancetre.getBoundingClientRect().height <= HAUTEUR_MAX_BOITE ? ancetre : null;
    }
  }
  return null;
}

function estSaisie(cible: EventTarget | null): cible is HTMLInputElement | HTMLTextAreaElement {
  if (cible instanceof HTMLTextAreaElement) return true;
  return cible instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'file'].includes(cible.type);
}

/**
 * Un clic dans la barre d'un champ, hors de la saisie, y place le curseur.
 *
 * La saisie nue ne mesure que sa ligne de texte (21 px) ; le reste de la barre
 * — son retrait, son icône — ne réagissait pas. La cible réelle du champ était
 * donc deux fois plus basse que ce que l'on voit.
 */
function viserLaSaisie(evenement: MouseEvent): void {
  const cible = evenement.target;
  if (!(cible instanceof Element)) return;
  // Un bouton logé dans la barre (œil du mot de passe, croix) garde son rôle.
  if (cible.closest('input, textarea, button, a, [role="button"], [role="link"]')) return;

  let ancetre: Element | null = cible;
  for (let n = 0; n < 3 && ancetre; n++, ancetre = ancetre.parentElement) {
    const saisies = ancetre.querySelectorAll('input, textarea');
    if (saisies.length > 1) return;
    const saisie = saisies[0];
    if (saisie && estSaisie(saisie) && boiteDuChamp(saisie) === ancetre) {
      saisie.focus();
      return;
    }
  }
}

/**
 * Anneau de focus pour la navigation au clavier, sur le web.
 *
 * Sans lui, l'anneau est celui du navigateur : un bleu étranger à la palette,
 * presque invisible sur le bandeau lave, et absent des éléments dont le style
 * retire le contour. Qui parcourt le site à la touche Tab doit toujours savoir
 * où il se trouve (WCAG 2.4.7).
 *
 * Deux anneaux concentriques, l'un lave, l'autre crème, pour rester visible
 * sur les fonds clairs comme sur les fonds sombres : l'un des deux contraste
 * toujours. Liens et boutons les portent crème dedans, lave dehors ; les
 * champs, l'inverse, pour que le trait lave touche le champ.
 *
 * `:focus-visible` ne s'applique, pour un lien ou un bouton, qu'au focus venu
 * du clavier : un clic à la souris n'y dessine rien. Un champ de saisie, lui,
 * le reçoit aussi au clic — c'est la règle des navigateurs, et c'était déjà le
 * cas de leur anneau par défaut.
 *
 * Posé à l'exécution et non dans un fichier HTML : le site est exporté en page
 * unique, où `app/+html.tsx` n'a aucun effet, et ceci vaut aussi en
 * développement.
 */
export function installerStyleFocus(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(ID)) return;

  const style = document.createElement('style');
  style.id = ID;
  style.textContent = `
:focus-visible {
  outline: 2px solid ${colors.cream} !important;
  outline-offset: 0 !important;
  box-shadow: 0 0 0 4px ${colors.lave} !important;
}
input:focus-visible, textarea:focus-visible {${ANNEAU}
}
/* Saisie nue dans une barre : l'anneau passe sur la barre (voir boiteDuChamp). */
[${BOITE}] {${ANNEAU}
}
[${BOITE}] input:focus-visible, [${BOITE}] textarea:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
`;
  document.head.appendChild(style);

  document.addEventListener('focusin', evenement => {
    if (!estSaisie(evenement.target)) return;
    boiteDuChamp(evenement.target)?.setAttribute(BOITE, '');
  });
  document.addEventListener('focusout', () => {
    document.querySelectorAll(`[${BOITE}]`).forEach(boite => boite.removeAttribute(BOITE));
  });
  document.addEventListener('click', viserLaSaisie);
}
