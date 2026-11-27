import { useEffect } from 'react';
import { Platform } from 'react-native';
import table from './seo-routes.json';

/**
 * Métadonnées des pages web : titre d'onglet, description, aperçu de partage.
 *
 * ── Pourquoi deux mécanismes ───────────────────────────────────────────────
 *
 * Le site est exporté en page unique : un seul gabarit HTML, dont le contenu
 * est entièrement écrit par JavaScript. Or les robots qui fabriquent les
 * aperçus de lien (WhatsApp, Facebook, X) n'exécutent pas JavaScript — ils ne
 * lisent que les balises présentes dans le HTML reçu.
 *
 *  1. `scripts/postbuild-web.mjs` écrit donc, à la compilation, un fichier HTML
 *     par page avec ses balises définitives. C'est ce que lisent les robots.
 *  2. Ce module-ci tient les mêmes balises à jour pendant la navigation, pour
 *     l'onglet du navigateur, l'historique et Google (qui, lui, exécute le
 *     script).
 *
 * Les deux lisent la MÊME table, `lib/seo-routes.json` : un titre ne peut pas
 * dire une chose dans le HTML livré et une autre une fois l'application
 * démarrée.
 *
 * ── Pourquoi pas `expo-router/head` ────────────────────────────────────────
 *
 * Son composant `<Head>` est lié au focus d'un écran (il appelle
 * `useIsFocused`) : il se pose écran par écran, soit une trentaine d'ajouts
 * ici, là où une table lue depuis le layout racine couvre toutes les routes
 * d'un coup. Et en page unique, il n'écrit de toute façon rien dans le HTML
 * initial. Quelques lignes de DOM font le même travail, à un seul endroit.
 */

export const SITE_URL = table.siteUrl;
export const SITE_NAME = table.siteName;

export interface PageMeta {
  title: string;
  description?: string;
  /** Chemin canonique, sans domaine : « /search ». */
  path?: string;
  /** Image d'aperçu : URL absolue, ou chemin du dossier `public/`. */
  image?: string | null;
  /** `false` : page privée ou sans intérêt pour un moteur de recherche. */
  index?: boolean;
}

type Entree = { title: string; description?: string; index?: boolean };
const ROUTES = table.routes as Record<string, Entree>;

/**
 * Métadonnées d'un chemin.
 *
 * Correspondance exacte d'abord, puis par préfixe : « /admin/users » hérite de
 * « /admin », « /listing/<id> » de « /listing ». Un chemin inconnu n'est pas
 * indexé — mieux vaut taire une page que la présenter sous un titre générique.
 */
export function metaPourChemin(pathname: string): PageMeta {
  const chemin = pathname.replace(/\/+$/, '') || '/';
  let entree: Entree | undefined = ROUTES[chemin];

  if (!entree) {
    const prefixe = Object.keys(ROUTES)
      .filter(cle => cle !== '/' && chemin.startsWith(cle + '/'))
      .sort((a, b) => b.length - a.length)[0];
    if (prefixe) entree = ROUTES[prefixe];
  }

  if (!entree) return { title: SITE_NAME, path: chemin, index: false };
  return {
    title: entree.title,
    description: entree.description,
    path: chemin,
    index: entree.index !== false,
  };
}

/** « Rechercher » → « Rechercher — YakaRDC ». Le nom n'est pas répété s'il y est déjà. */
export function titreComplet(title: string): string {
  return title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
}

/** Ramène une description à une longueur que les moteurs n'amputent pas. */
export function descriptionCourte(texte: string, max = 160): string {
  const propre = texte.replace(/\s+/g, ' ').trim();
  if (propre.length <= max) return propre;
  const coupe = propre.slice(0, max - 1);
  const dernierEspace = coupe.lastIndexOf(' ');
  return `${(dernierEspace > 80 ? coupe.slice(0, dernierEspace) : coupe).trimEnd()}…`;
}

function absolu(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Pose une balise, en la créant si le HTML livré ne la contenait pas. */
function poser(selecteur: string, creer: () => HTMLElement, attribut: string, valeur: string) {
  let el = document.head.querySelector<HTMLElement>(selecteur);
  if (!el) { el = creer(); document.head.appendChild(el); }
  el.setAttribute(attribut, valeur);
}

function meta(cle: 'name' | 'property', nom: string, contenu: string) {
  poser(`meta[${cle}="${nom}"]`, () => {
    const el = document.createElement('meta');
    el.setAttribute(cle, nom);
    return el;
  }, 'content', contenu);
}

/** Écrit les balises de la page courante. Sans effet hors du web. */
export function appliquerMeta(page: PageMeta): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const titre = titreComplet(page.title);
  const description = page.description ?? table.defaultDescription;
  const url = absolu(page.path ?? window.location.pathname);
  const image = absolu(page.image || table.ogImage);

  document.title = titre;
  meta('name', 'description', description);
  meta('name', 'robots', page.index === false ? 'noindex, nofollow' : 'index, follow');
  // Pas d'adresse canonique sur une page qu'on demande de ne pas indexer :
  // « voici l'adresse de référence » et « ne retenez pas cette page » se
  // contredisent. C'est aussi ce qui évitait à la page 404 de déclarer comme
  // référence l'adresse erronée qu'on venait de saisir.
  if (page.index === false) {
    document.head.querySelector('link[rel="canonical"]')?.remove();
  } else {
    poser('link[rel="canonical"]', () => {
      const el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      return el;
    }, 'href', url);
  }

  meta('property', 'og:title', titre);
  meta('property', 'og:description', description);
  meta('property', 'og:url', url);
  meta('property', 'og:image', image);
  meta('name', 'twitter:title', titre);
  meta('name', 'twitter:description', description);
  meta('name', 'twitter:image', image);
}

/**
 * Métadonnées d'une fiche d'établissement.
 *
 * `scripts/postbuild-web.mjs` compose les mêmes à la compilation, pour le HTML
 * que lisent les robots : toute modification ici doit y être reportée.
 */
export function metaEtablissement(
  e: { id: string; name: string; type: string; description?: string | null; city?: string | null; commune?: string | null },
  couverture?: string | null,
): PageMeta & { path: string } {
  const types = table.typesEtablissement as Record<string, { label: string }>;
  const type = types[e.type]?.label ?? 'Établissement';
  const lieu = [e.commune, e.city].filter(Boolean).join(', ');
  return {
    title: `${e.name} — ${type}${e.city ? ` à ${e.city}` : ''}`,
    description: e.description?.trim()
      ? descriptionCourte(e.description)
      : `${type}${lieu ? ` à ${lieu}` : ''}. Photos, tarifs, horaires et réservation en ligne sur YakaRDC.`,
    path: `/listing/${e.id}`,
    image: couverture,
    index: true,
  };
}

const normaliser = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

/**
 * Métadonnées déclarées par les écrans montés, par chemin.
 *
 * Une fiche reste montée dans la pile quand on ouvre un autre écran par-dessus.
 * Au retour, c'est le layout racine qui réécrit les balises : sans ce registre,
 * il reposerait le titre générique de la table et le nom de l'établissement
 * disparaîtrait de l'onglet.
 */
const surcharges = new Map<string, PageMeta>();

/** Balises de la route courante. Appelé par le layout racine à chaque navigation. */
export function appliquerMetaDeRoute(pathname: string): void {
  const chemin = normaliser(pathname);
  appliquerMeta(surcharges.get(chemin) ?? metaPourChemin(chemin));
}

/**
 * Métadonnées propres à un écran, quand elles dépendent de données chargées :
 * la fiche d'un établissement porte son nom, pas « Fiche établissement ».
 *
 * `null` tant que les données ne sont pas là : les balises de la route, posées
 * par le layout racine, restent alors en place.
 */
export function useSeo(page: (PageMeta & { path: string }) | null): void {
  const { title, description, path, image, index } = page ?? ({} as Partial<PageMeta>);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!title || !path) return;
    const chemin = normaliser(path);
    const meta: PageMeta = { title, description, path: chemin, image, index };
    surcharges.set(chemin, meta);
    // L'écran peut finir de charger alors qu'on l'a déjà quitté : on ne touche
    // aux balises que si c'est bien lui qui est affiché.
    if (normaliser(window.location.pathname) === chemin) appliquerMeta(meta);
    return () => { surcharges.delete(chemin); };
  }, [title, description, path, image, index]);
}
