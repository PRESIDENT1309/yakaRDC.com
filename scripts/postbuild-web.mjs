// Prépare le site exporté par `expo export -p web` pour les moteurs de
// recherche et les aperçus de lien.
//
// POURQUOI CE SCRIPT EXISTE
// En mode page unique — le nôtre — Expo produit UN fichier `dist/index.html`,
// sans titre propre, sans description, déclaré en anglais, et le sert pour
// toutes les adresses. Trois conséquences, relevées par l'audit du 26/11/2026 :
//
//  1. Un lien YakaRDC collé dans WhatsApp ou Facebook n'affichait aucun aperçu :
//     ces robots n'exécutent pas JavaScript, ils ne lisent que le HTML reçu.
//  2. Une adresse inexistante répondait « 200 OK » avec la page d'accueil. Pour
//     un moteur, c'est une page valide de plus, vide et dupliquée.
//  3. Chrome lisait `lang="en"`, croyait à de l'anglais et retraduisait une
//     interface déjà française : « Enregistrer » devenait « Économiser ».
//
// CE QU'IL FAIT
//  - corrige la langue et pose titre, description, Open Graph, icônes ;
//  - écrit un fichier HTML par route de `app/`, avec ses propres balises ;
//  - écrit un fichier par établissement publié (nom, description, photo), lu
//    dans Supabase avec la clé publique — celle que le site embarque déjà ;
//  - écrit `404.html`, que Vercel sert avec le vrai statut 404 ;
//  - écrit `sitemap.xml`.
//
// Chaque fichier est le même gabarit, seules les balises changent : c'est
// toujours l'application qui affiche la page une fois le script chargé. Les
// textes viennent de `lib/seo-routes.json`, la table que lit aussi
// `lib/seo.ts` pendant la navigation.
//
// CE QU'IL NE FAIT PAS
// Il ne rend pas le contenu des pages dans le HTML (rendu statique d'Expo).
// Les écrans dépendent de la largeur de la fenêtre dès leur premier rendu ;
// les pré-rendre sans fenêtre demanderait de les reprendre un par un.
//
// On ne pose PAS `notranslate` : un visiteur lingalaphone ou anglophone doit
// pouvoir demander une traduction. On corrige seulement le mensonge sur la
// langue d'origine.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const DIST = 'dist';
const APP = 'app';
const ETIQUETTE = '[postbuild-web]';

const table = JSON.parse(await readFile('lib/seo-routes.json', 'utf8'));
const SITE = table.siteUrl.replace(/\/+$/, '');

// ── Outils ────────────────────────────────────────────────────────────────

/** Tout texte venu de la base ou de la table passe par ici avant d'entrer dans le HTML. */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const absolu = (url) => (/^https?:\/\//i.test(url) ? url : `${SITE}${url.startsWith('/') ? '' : '/'}${url}`);

const titreComplet = (titre) => (titre.includes(table.siteName) ? titre : `${titre} — ${table.siteName}`);

function descriptionCourte(texte, max = 160) {
  const propre = String(texte ?? '').replace(/\s+/g, ' ').trim();
  if (propre.length <= max) return propre;
  const coupe = propre.slice(0, max - 1);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > 80 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

/** Même règle que `metaPourChemin` dans lib/seo.ts : exact, puis préfixe. */
function metaPourChemin(chemin) {
  let entree = table.routes[chemin];
  if (!entree) {
    const prefixe = Object.keys(table.routes)
      .filter((cle) => cle !== '/' && chemin.startsWith(`${cle}/`))
      .sort((a, b) => b.length - a.length)[0];
    if (prefixe) entree = table.routes[prefixe];
  }
  if (!entree) return { title: table.siteName, index: false };
  return { title: entree.title, description: entree.description, index: entree.index !== false };
}

// ── Gabarit ───────────────────────────────────────────────────────────────

let gabarit;
try {
  gabarit = await readFile(path.join(DIST, 'index.html'), 'utf8');
} catch {
  console.error(`${ETIQUETTE} ${DIST}/index.html introuvable : lancez d'abord « expo export -p web ».`);
  process.exit(1);
}

// Bornes du bloc injecté. Elles rendent le script rejouable : relancé sur un
// `dist/` déjà traité, il retire son ancien bloc au lieu d'en empiler un second.
const DEBUT = '<!-- seo:debut -->';
const FIN = '<!-- seo:fin -->';

gabarit = gabarit
  .replace(new RegExp(`\\s*${DEBUT}[\\s\\S]*?${FIN}`), '')
  .replace(/<html lang="en">/, '<html lang="fr">')
  // Le titre et la description du gabarit Expo sont remplacés page par page.
  .replace(/<title>[\s\S]*?<\/title>/i, '')
  .replace(/<meta\s+name="description"[^>]*>/i, '')
  .replace(
    /<noscript>[\s\S]*?<\/noscript>/i,
    '<noscript>YakaRDC a besoin de JavaScript pour fonctionner. Activez-le dans votre navigateur, puis rechargez la page.</noscript>',
  );

if (!gabarit.includes('</head>')) {
  console.error(`${ETIQUETTE} gabarit inattendu : pas de </head> dans ${DIST}/index.html.`);
  process.exit(1);
}

/**
 * @param canonique  `false` pour un gabarit servi à plusieurs adresses (fiche
 *                   générique, 404) : y écrire une adresse canonique fixe
 *                   dirait aux moteurs que toutes ces pages n'en font qu'une.
 *                   L'application pose la bonne une fois chargée.
 */
function tetes({ title, description, chemin, image, index, jsonLd, canonique = true }) {
  const titre = titreComplet(title);
  const desc = description || table.defaultDescription;
  const url = `${SITE}${chemin === '/' ? '/' : chemin}`;
  const img = absolu(image || table.ogImage);
  const lignes = [
    `<title>${esc(titre)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta name="robots" content="${index === false ? 'noindex, nofollow' : 'index, follow'}">`,
    // Même règle que lib/seo.ts : pas d'adresse canonique sur une page non indexée.
    canonique && index !== false ? `<link rel="canonical" href="${esc(url)}">` : null,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(table.siteName)}">`,
    `<meta property="og:locale" content="${esc(table.locale)}">`,
    `<meta property="og:title" content="${esc(titre)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    canonique ? `<meta property="og:url" content="${esc(url)}">` : null,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(titre)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
    `<meta name="theme-color" content="${esc(table.themeColor)}">`,
    // L'application n'a qu'un thème clair : sans cette ligne, Chrome sur
    // Android peut lui appliquer d'office son mode sombre automatique.
    `<meta name="color-scheme" content="light">`,
    `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`,
    `<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
    `<link rel="manifest" href="/site.webmanifest">`,
  ];
  if (jsonLd) {
    // `<` échappé : un « </script> » dans une description fermerait la balise.
    lignes.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`);
  }
  return lignes.filter(Boolean).join('\n    ');
}

const page = (meta) => gabarit.replace('</head>', `    ${DEBUT}\n    ${tetes(meta)}\n    ${FIN}\n  </head>`);

async function ecrire(fichier, contenu) {
  const cible = path.join(DIST, fichier);
  await mkdir(path.dirname(cible), { recursive: true });
  await writeFile(cible, contenu);
}

// ── Routes de app/ ────────────────────────────────────────────────────────

async function fichiersDe(dossier) {
  const sortie = [];
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...(await fichiersDe(chemin)));
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) sortie.push(chemin);
  }
  return sortie;
}

/** `app/(tabs)/search.tsx` → `/search`. `null` pour ce qui n'est pas une page. */
function routeDe(fichier) {
  const segments = path.relative(APP, fichier).replace(/\.(tsx|ts|jsx|js)$/, '').split(path.sep);
  const nom = segments[segments.length - 1];
  // `_layout`, `+html`, `+not-found` : des fichiers de structure, pas des pages.
  if (nom.startsWith('_') || nom.startsWith('+')) return null;
  const visibles = segments
    .filter((s) => !/^\(.*\)$/.test(s)) // les groupes n'apparaissent pas dans l'adresse
    .filter((s, i, tous) => !(s === 'index' && i === tous.length - 1));
  return `/${visibles.join('/')}`;
}

const routes = [...new Set((await fichiersDe(APP)).map(routeDe).filter(Boolean))].sort();
const statiques = routes.filter((r) => !r.includes('['));
const dynamiques = routes.filter((r) => r.includes('['));

for (const chemin of statiques) {
  const meta = metaPourChemin(chemin);
  await ecrire(chemin === '/' ? 'index.html' : `${chemin.slice(1)}/index.html`, page({ ...meta, chemin }));
}

// Une route dynamique n'a pas de fichier à son adresse : c'est une réécriture
// de vercel.json qui lui fait servir son gabarit. Sans elle, la page s'affiche
// quand même (via 404.html, qui charge l'application), mais avec un statut 404.
const vercel = JSON.parse(await readFile('vercel.json', 'utf8'));
const sources = (vercel.rewrites ?? []).map((r) => r.source);
for (const chemin of dynamiques) {
  const base = chemin.slice(0, chemin.indexOf('/['));
  await ecrire(`${base.slice(1)}/_gabarit/index.html`, page({ ...metaPourChemin(`${base}/x`), chemin: base, canonique: false }));
  const attendue = chemin.replace(/\[\.\.\.(\w+)\]/g, ':$1*').replace(/\[(\w+)\]/g, ':$1');
  if (!sources.includes(attendue)) {
    console.warn(`${ETIQUETTE} ATTENTION : aucune réécriture « ${attendue} » dans vercel.json — ces pages répondront 404.`);
  }
}

await ecrire('404.html', page({ title: 'Page introuvable', chemin: '/404', index: false, canonique: false }));

// ── Fiches des établissements publiés ─────────────────────────────────────

// Libellés au singulier et types schema.org, partagés avec `metaEtablissement`
// de lib/seo.ts : le titre livré dans le HTML et celui posé par l'application
// une fois la fiche chargée sont composés de la même façon.
const TYPES = table.typesEtablissement;

async function etablissementsPublies() {
  // En local, les variables vivent dans `.env` ; sur Vercel, dans le projet.
  try { process.loadEnvFile?.(); } catch { /* pas de .env : on lit l'environnement tel quel */ }
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const cle = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !cle) {
    console.warn(`${ETIQUETTE} variables Supabase absentes : fiches non générées (le gabarit générique les couvre).`);
    return [];
  }
  const requete = `${base.replace(/\/+$/, '')}/rest/v1/establishments`
    + '?select=id,name,description,type,city,commune,suspended_at,listing_photos(url,position,offer_id,category)'
    + '&status=eq.approved&order=created_at.desc&limit=2000';
  try {
    const res = await fetch(requete, {
      headers: { apikey: cle, Authorization: `Bearer ${cle}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.warn(`${ETIQUETTE} Supabase a répondu ${res.status} : fiches non générées.`);
      return [];
    }
    const lignes = await res.json();
    // Un établissement suspendu par l'administration ne doit pas être proposé
    // aux moteurs de recherche.
    return Array.isArray(lignes) ? lignes.filter((e) => !e.suspended_at) : [];
  } catch (e) {
    // Une panne réseau au moment de la compilation ne doit pas empêcher de
    // publier le site : les fiches retombent sur le gabarit générique.
    console.warn(`${ETIQUETTE} lecture des établissements impossible (${e?.message ?? e}) : fiches non générées.`);
    return [];
  }
}

const fiches = [];
for (const e of await etablissementsPublies()) {
  // L'identifiant devient un nom de dossier : on n'accepte qu'un UUID.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(e.id))) continue;
  if (!e.name) continue;

  const type = TYPES[e.type] ?? { label: 'Établissement', schema: 'LocalBusiness' };
  const lieu = [e.commune, e.city].filter(Boolean).join(', ');
  const couverture = (e.listing_photos ?? [])
    .filter((p) => !p.offer_id && (!p.category || p.category === 'general'))
    .sort((a, b) => a.position - b.position)[0]?.url;
  const description = e.description?.trim()
    ? descriptionCourte(e.description)
    : `${type.label}${lieu ? ` à ${lieu}` : ''}. Photos, tarifs, horaires et réservation en ligne sur YakaRDC.`;
  const chemin = `/listing/${e.id}`;

  await ecrire(`listing/${e.id}/index.html`, page({
    title: `${e.name} — ${type.label}${e.city ? ` à ${e.city}` : ''}`,
    description,
    chemin,
    image: couverture,
    index: true,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': type.schema,
      name: e.name,
      description,
      url: `${SITE}${chemin}`,
      ...(couverture ? { image: couverture } : {}),
      address: {
        '@type': 'PostalAddress',
        ...(lieu ? { addressLocality: lieu } : {}),
        addressCountry: 'CD',
      },
    },
  }));
  fiches.push(chemin);
}

// ── Plan du site ──────────────────────────────────────────────────────────

const indexables = [
  ...statiques.filter((r) => metaPourChemin(r).index !== false),
  ...fiches,
];
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...indexables.map((r) => `  <url><loc>${esc(`${SITE}${r}`)}</loc></url>`),
  '</urlset>',
  '',
].join('\n');
await ecrire('sitemap.xml', sitemap);

console.log(
  `${ETIQUETTE} ${statiques.length} pages, ${fiches.length} fiches d'établissement, `
  + `${indexables.length} adresses dans sitemap.xml, 404.html.`,
);
