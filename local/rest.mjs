/**
 * Émulation de PostgREST : tout ce qui arrive sur `/rest/v1/*`.
 *
 * POURQUOI CE FICHIER EXISTE
 * L'application ne parle jamais SQL : `supabase.from('x').select(...)` est
 * traduit par le client en requêtes HTTP au format PostgREST (filtres dans
 * l'URL, options dans les en-têtes `Prefer`, `Accept`, `Range`). Ce fichier
 * comprend ce format et y répond comme PostgREST, pour le sous-ensemble dont
 * l'application se sert.
 *
 * CE QUI EST PRIS EN CHARGE
 *  - GET / HEAD / POST / PATCH / DELETE sur une table, POST et GET sur `/rpc/<fonction>`
 *  - `select` avec alias, lectures imbriquées récursives (`parent(*)`,
 *    `enfants(a, b)`, `alias:table(...)`, `table!inner(...)`, `table!colonne(...)`)
 *  - filtres eq, neq, gt, gte, lt, lte, like, ilike, match, imatch, in, is,
 *    cs, cd, ov, leur négation `not.`, et les arbres `or=(…)` / `and=(…)`
 *  - `order` (plusieurs colonnes, asc/desc, nullsfirst/nullslast), `limit`,
 *    `offset`, en-tête `Range`, y compris sur une ressource imbriquée
 *  - `Prefer: return=…`, `count=exact`, `resolution=…` avec `on_conflict`
 *  - `Accept: application/vnd.pgrst.object+json` (406 `PGRST116` sinon une ligne)
 *
 * CE QUI NE L'EST PAS (réponse : erreur explicite, jamais un résultat inventé)
 *  - tri sur une colonne d'une ressource imbriquée (`order=parent(col)`)
 *  - agrégats (`count()`, `sum()`), étalement (`...table`), recherche plein texte
 *  - filtres sur un chemin JSON (`col->>cle=eq.x`), `any`/`all`
 *  - `Prefer: tx=rollback`, `handling=strict`, `max-affected`
 */
import { ErreurPg, convertir, lireTableauPg } from './base.mjs';
import { FONCTIONS } from './metier.mjs';
import { peutDevenir, peutInserer, peutLire, peutModifier, peutSupprimer } from './regles.mjs';
import { liensEntre } from './schema.mjs';

const OPERATEURS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'match', 'imatch', 'in', 'is', 'cs', 'cd', 'ov', 'isdistinct']);
const TYPE_OBJET = 'application/vnd.pgrst.object+json';

const nonGere = (quoi) =>
  new ErreurPg('PGRST100', `Non pris en charge par la base de test locale : ${quoi}`, {
    hint: 'Voir la liste en tête de local/rest.mjs.',
  });

// ---------------------------------------------------------------------------
// Lecture de la syntaxe PostgREST
// ---------------------------------------------------------------------------

/** Découpe sur les virgules de premier niveau, en respectant (), {} et les guillemets. */
function decouper(texte) {
  const morceaux = [];
  let courant = '';
  let niveau = 0;
  let guillemets = false;
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];
    if (guillemets) {
      courant += c;
      if (c === '\\') courant += texte[(i += 1)] ?? '';
      else if (c === '"') guillemets = false;
      continue;
    }
    if (c === '"') guillemets = true;
    else if (c === '(' || c === '{') niveau += 1;
    else if (c === ')' || c === '}') niveau -= 1;
    else if (c === ',' && niveau === 0) {
      morceaux.push(courant);
      courant = '';
      continue;
    }
    courant += c;
  }
  morceaux.push(courant);
  return morceaux;
}

/** Retire les guillemets PostgREST d'une valeur : `"a,b"` -> `a,b`. */
function sansGuillemets(texte) {
  if (texte.length >= 2 && texte.startsWith('"') && texte.endsWith('"')) return texte.slice(1, -1).replace(/\\(.)/g, '$1');
  return texte;
}

const MOTIF_ALIAS = /^(?:([A-Za-z_]\w*):(?!:))?(.+)$/s;

/** `select=a,b:alias,table(c,autre(*))` -> arbre de nœuds. */
function analyserSelect(texte) {
  if (texte === null || texte === undefined || texte.trim() === '') return [{ genre: 'etoile' }];
  return decouper(texte)
    .map((morceau) => morceau.trim())
    .filter((morceau) => morceau !== '')
    .map((element) => {
      if (element.startsWith('...')) throw nonGere(`étalement « ${element} »`);
      const ouverture = element.indexOf('(');
      if (ouverture === -1) {
        if (element === '*') return { genre: 'etoile' };
        const [, alias, reste] = MOTIF_ALIAS.exec(element);
        const [expression, transtypage] = reste.split('::');
        const chemin = expression.split(/->>?/);
        return {
          genre: 'colonne',
          nom: chemin[0],
          chemin: chemin.slice(1),
          enTexte: expression.includes('->>') || transtypage === 'text',
          alias: alias ?? chemin.at(-1),
        };
      }
      if (!element.endsWith(')')) throw new ErreurPg('PGRST100', `"failed to parse select parameter (${texte})"`);
      const [, alias, tete] = MOTIF_ALIAS.exec(element.slice(0, ouverture));
      const [nom, ...modificateurs] = tete.split('!');
      return {
        genre: 'lien',
        nom,
        alias: alias ?? nom,
        indice: modificateurs.find((mot) => mot !== 'inner' && mot !== 'left') ?? null,
        interne: modificateurs.includes('inner'),
        enfants: analyserSelect(element.slice(ouverture + 1, -1)),
      };
    });
}

/** `eq.5`, `not.in.(a,b)`, `is.null` -> { negation, operateur, valeur } */
function analyserOperation(texte) {
  let reste = texte;
  let negation = false;
  if (reste.startsWith('not.')) {
    negation = true;
    reste = reste.slice(4);
  }
  const point = reste.indexOf('.');
  const operateur = point === -1 ? reste : reste.slice(0, point);
  if (point === -1 || !OPERATEURS.has(operateur)) {
    if (/^(fts|plfts|phfts|wfts|sl|sr|nxl|nxr|adj)\b/.test(operateur)) throw nonGere(`opérateur « ${operateur} »`);
    throw new ErreurPg('PGRST100', `"failed to parse filter (${texte})"`);
  }
  return { negation, operateur, valeur: reste.slice(point + 1) };
}

/** `(a.eq.1,and(b.gt.2,c.is.null))` -> arbre logique. */
function analyserLogique(texte, genre, negation) {
  const contenu = texte.trim();
  if (!contenu.startsWith('(') || !contenu.endsWith(')')) throw new ErreurPg('PGRST100', `"failed to parse logic tree (${texte})"`);
  const membres = decouper(contenu.slice(1, -1))
    .map((membre) => membre.trim())
    .filter((membre) => membre !== '')
    .map((membre) => {
      const groupe = /^(not\.)?(and|or)(\(.*\))$/s.exec(membre);
      if (groupe) return analyserLogique(groupe[3], groupe[2], Boolean(groupe[1]));
      const point = membre.indexOf('.');
      if (point === -1) throw new ErreurPg('PGRST100', `"failed to parse logic tree (${texte})"`);
      return { genre: 'test', colonne: membre.slice(0, point), ...analyserOperation(membre.slice(point + 1)) };
    });
  return { genre: genre === 'or' ? 'ou' : 'et', negation, membres };
}

function analyserOrdre(texte) {
  return decouper(texte)
    .map((morceau) => morceau.trim())
    .filter((morceau) => morceau !== '')
    .map((morceau) => {
      if (morceau.includes('(')) throw nonGere(`tri sur une ressource imbriquée « ${morceau} »`);
      const [colonne, ...options] = morceau.split('.');
      const descendant = options.includes('desc');
      // Par défaut, PostgreSQL place les nuls en dernier en ordre croissant, en premier en décroissant.
      const nulsEnPremier = options.includes('nullsfirst') || (descendant && !options.includes('nullslast'));
      return { colonne, descendant, nulsEnPremier };
    });
}

function entierPositif(texte, nom) {
  if (!/^\d+$/.test(texte)) throw new ErreurPg('PGRST100', `"failed to parse ${nom} parameter (${texte})"`);
  return Number(texte);
}

/**
 * Range tous les paramètres d'URL par ressource : '' pour la table demandée,
 * 'booking_items' ou 'a.b' pour une ressource imbriquée.
 */
function analyserParametres(params) {
  const groupes = new Map();
  const groupe = (chemin) => {
    if (!groupes.has(chemin)) groupes.set(chemin, { filtres: [], ordre: null, limite: null, decalage: null });
    return groupes.get(chemin);
  };
  groupe('');
  for (const [cle, valeur] of params) {
    if (cle === 'select' || cle === 'on_conflict' || cle === 'columns') continue;
    if (cle.includes('->')) throw nonGere(`filtre sur un chemin JSON « ${cle} »`);
    const morceaux = cle.split('.');
    const dernier = morceaux.pop();
    let negation = false;
    if ((dernier === 'or' || dernier === 'and') && morceaux.at(-1) === 'not') {
      morceaux.pop();
      negation = true;
    }
    const cible = groupe(morceaux.join('.'));
    if (dernier === 'order') cible.ordre = analyserOrdre(valeur);
    else if (dernier === 'limit') cible.limite = entierPositif(valeur, 'limit');
    else if (dernier === 'offset') cible.decalage = entierPositif(valeur, 'offset');
    else if (dernier === 'or' || dernier === 'and') cible.filtres.push(analyserLogique(valeur, dernier, negation));
    else cible.filtres.push({ genre: 'test', colonne: dernier, ...analyserOperation(valeur) });
  }
  return groupes;
}

function lirePreferences(entete) {
  const preferences = {};
  for (const morceau of String(entete ?? '').split(',')) {
    const [cle, valeur] = morceau.trim().split('=');
    if (cle) preferences[cle] = valeur ?? '';
  }
  return preferences;
}

// ---------------------------------------------------------------------------
// Évaluation des filtres (logique à trois valeurs de SQL : vrai, faux, inconnu)
// ---------------------------------------------------------------------------

/** Motif `like` -> expression régulière. PostgREST accepte `*` à la place de `%`. */
function motifLike(motif, insensible) {
  const source = [...motif]
    .map((c) => (c === '%' || c === '*' ? '.*' : c === '_' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${source}$`, insensible ? 'is' : 's');
}

function comparer(type, a, b) {
  if (type === 'int' || type === 'num') return a - b;
  if (type === 'bool') return Number(a) - Number(b);
  // Le texte libre est trié comme le fait la base en ligne (sans distinguer
  // majuscules et accents en premier lieu) ; les autres chaînes (uuid, dates
  // normalisées) se comparent caractère par caractère.
  if (type === 'text') return String(a).localeCompare(String(b), 'en');
  const [x, y] = type === 'json' || type === 'text[]' ? [JSON.stringify(a), JSON.stringify(b)] : [a, b];
  return x < y ? -1 : x > y ? 1 : 0;
}

const egal = (type, a, b) => (type === 'json' || type === 'text[]' ? JSON.stringify(a) === JSON.stringify(b) : a === b);

/** Convertit une fois pour toutes la valeur d'un filtre vers le type de sa colonne. */
function preparer(base, table, test) {
  const def = base.colonnes(table)[test.colonne];
  if (!def) {
    base.avertir(`filtre sur la colonne inconnue ${table}.${test.colonne} : elle est traitée comme toujours nulle`);
  }
  const type = def?.type ?? 'text';
  const scalaire = (texte) => {
    const brut = sansGuillemets(texte);
    if (type === 'json') {
      try {
        return JSON.parse(brut);
      } catch {
        return brut;
      }
    }
    return convertir(type, brut);
  };
  const prepare = { type, inconnue: !def };
  switch (test.operateur) {
    case 'in': {
      if (!test.valeur.startsWith('(') || !test.valeur.endsWith(')')) throw new ErreurPg('PGRST100', `"failed to parse filter (in.${test.valeur})"`);
      const interieur = test.valeur.slice(1, -1);
      prepare.liste = interieur === '' ? [] : decouper(interieur).map(scalaire);
      break;
    }
    case 'is':
      if (!['null', 'not_null', 'true', 'false', 'unknown'].includes(test.valeur.toLowerCase())) {
        throw new ErreurPg('PGRST100', `"failed to parse filter (is.${test.valeur})"`);
      }
      prepare.mot = test.valeur.toLowerCase();
      break;
    case 'like':
    case 'ilike':
      prepare.motif = motifLike(sansGuillemets(test.valeur), test.operateur === 'ilike');
      break;
    case 'match':
    case 'imatch':
      prepare.motif = new RegExp(sansGuillemets(test.valeur), test.operateur === 'imatch' ? 'i' : '');
      break;
    case 'cs':
    case 'cd':
    case 'ov':
      prepare.ensemble = type === 'json' ? JSON.parse(test.valeur) : lireTableauPg(test.valeur);
      break;
    default:
      prepare.valeur = scalaire(test.valeur);
  }
  return prepare;
}

/** Inclusion JSON à la manière de l'opérateur `@>` de PostgreSQL. */
function contient(grand, petit) {
  if (Array.isArray(petit)) return Array.isArray(grand) && petit.every((element) => grand.some((autre) => contient(autre, element)));
  if (petit !== null && typeof petit === 'object') {
    return grand !== null && typeof grand === 'object' && Object.entries(petit).every(([cle, valeur]) => contient(grand[cle], valeur));
  }
  return grand === petit;
}

function evaluerTest(base, table, ligne, test) {
  test.prepare ??= preparer(base, table, test);
  const { type, inconnue, liste, mot, motif, ensemble, valeur } = test.prepare;
  const champ = inconnue ? null : ligne[test.colonne];
  let resultat;
  if (test.operateur === 'is') {
    if (mot === 'null') resultat = champ === null;
    else if (mot === 'not_null') resultat = champ !== null;
    else if (mot === 'unknown') resultat = champ === null;
    else resultat = champ === (mot === 'true');
  } else if (test.operateur === 'isdistinct') {
    resultat = !(champ === null ? valeur === null : valeur !== null && egal(type, champ, valeur));
  } else if (champ === null) {
    resultat = null;
  } else {
    switch (test.operateur) {
      case 'eq':
        resultat = egal(type, champ, valeur);
        break;
      case 'neq':
        resultat = !egal(type, champ, valeur);
        break;
      case 'gt':
        resultat = comparer(type, champ, valeur) > 0;
        break;
      case 'gte':
        resultat = comparer(type, champ, valeur) >= 0;
        break;
      case 'lt':
        resultat = comparer(type, champ, valeur) < 0;
        break;
      case 'lte':
        resultat = comparer(type, champ, valeur) <= 0;
        break;
      case 'in':
        resultat = liste.some((element) => egal(type, champ, element));
        break;
      case 'like':
      case 'ilike':
      case 'match':
      case 'imatch':
        resultat = motif.test(typeof champ === 'string' ? champ : JSON.stringify(champ));
        break;
      case 'cs':
        resultat = contient(champ, ensemble);
        break;
      case 'cd':
        resultat = contient(ensemble, champ);
        break;
      case 'ov':
        resultat = Array.isArray(champ) && champ.some((element) => ensemble.includes(element));
        break;
      default:
        resultat = null;
    }
  }
  return test.negation && resultat !== null ? !resultat : resultat;
}

function evaluer(base, table, ligne, noeud) {
  if (noeud.genre === 'test') return evaluerTest(base, table, ligne, noeud);
  const resultats = noeud.membres.map((membre) => evaluer(base, table, ligne, membre));
  let resultat;
  if (noeud.genre === 'ou') resultat = resultats.includes(true) ? true : resultats.includes(null) ? null : false;
  else resultat = resultats.includes(false) ? false : resultats.includes(null) ? null : true;
  return noeud.negation && resultat !== null ? !resultat : resultat;
}

const passeFiltres = (base, table, ligne, filtres) => filtres.every((filtre) => evaluer(base, table, ligne, filtre) === true);

function trier(base, table, lignes, ordre) {
  if (!ordre) return lignes;
  const criteres = ordre.filter(({ colonne }) => {
    if (base.colonnes(table)[colonne]) return true;
    base.avertir(`tri sur la colonne inconnue ${table}.${colonne} : ignoré`);
    return false;
  });
  return [...lignes].sort((a, b) => {
    for (const { colonne, descendant, nulsEnPremier } of criteres) {
      const [x, y] = [a[colonne], b[colonne]];
      if (x === null && y === null) continue;
      if (x === null) return nulsEnPremier ? -1 : 1;
      if (y === null) return nulsEnPremier ? 1 : -1;
      const ecart = comparer(base.colonnes(table)[colonne].type, x, y);
      if (ecart !== 0) return descendant ? -ecart : ecart;
    }
    return 0;
  });
}

const fenetre = (lignes, decalage, limite) =>
  decalage === null && limite === null ? lignes : lignes.slice(decalage ?? 0, limite === null ? undefined : (decalage ?? 0) + limite);

// ---------------------------------------------------------------------------
// Lectures imbriquées
// ---------------------------------------------------------------------------

/** Trouve la clé étrangère qui relie `table` à la ressource demandée dans le `select`. */
function resoudreLien(base, table, noeud) {
  let cible = noeud.nom;
  let liens;
  if (base.tables[cible]) {
    liens = liensEntre(base.tables, table, cible);
    if (noeud.indice) {
      liens = liens.filter((lien) => {
        const porteuse = lien.genre === 'parent' ? table : cible;
        return lien.colonne === noeud.indice || `${porteuse}_${lien.colonne}_fkey` === noeud.indice;
      });
    }
  } else if (base.tables[table]?.colonnes[cible]?.ref) {
    // `select=owner_id(*)` : on peut aussi désigner le parent par la colonne qui le référence.
    const def = base.tables[table].colonnes[cible];
    liens = [{ genre: 'parent', colonne: cible, cible: def.ref.colonne }];
    cible = def.ref.table;
  } else {
    liens = [];
  }
  if (liens.length === 0) {
    throw new ErreurPg('PGRST200', `Could not find a relationship between '${table}' and '${noeud.nom}' in the schema cache`, {
      details: `Searched for a foreign key relationship between '${table}' and '${noeud.nom}' in the schema 'public', but no matches were found.`,
    });
  }
  if (liens.length > 1) {
    throw new ErreurPg('PGRST201', `Could not embed because more than one relationship was found for '${table}' and '${noeud.nom}'`, {
      hint: `Try changing '${noeud.nom}' to one of the following: ${liens.map((lien) => `'${noeud.nom}!${lien.colonne}'`).join(', ')}.`,
    });
  }
  return { ...liens[0], table: cible };
}

/**
 * Construit l'objet JSON d'une ligne selon l'arbre du `select`.
 * Rend `null` si une jointure `!inner` n'a aucune ligne : le parent doit alors disparaître.
 */
function composer(base, table, ligne, noeuds, requete, chemin) {
  const colonnes = base.colonnes(table);
  const sortie = {};
  for (const noeud of noeuds) {
    if (noeud.genre === 'etoile') {
      for (const colonne of Object.keys(colonnes)) sortie[colonne] = ligne[colonne];
    } else if (noeud.genre === 'colonne') {
      if (!colonnes[noeud.nom]) {
        base.avertir(`lecture de la colonne inconnue ${table}.${noeud.nom} : null est renvoyé`);
        sortie[noeud.alias] = null;
        continue;
      }
      let valeur = ligne[noeud.nom];
      for (const cle of noeud.chemin) valeur = valeur?.[cle] ?? null;
      if (noeud.enTexte && valeur !== null && typeof valeur !== 'string') valeur = JSON.stringify(valeur);
      sortie[noeud.alias] = valeur;
    } else {
      noeud.lien ??= resoudreLien(base, table, noeud);
      const { lien } = noeud;
      const sousChemin = chemin === '' ? noeud.alias : `${chemin}.${noeud.alias}`;
      const groupe = requete.groupes.get(sousChemin) ?? requete.groupes.get(chemin === '' ? noeud.nom : `${chemin}.${noeud.nom}`);
      requete.cheminsVus.add(sousChemin).add(chemin === '' ? noeud.nom : `${chemin}.${noeud.nom}`);

      let liees =
        lien.genre === 'parent'
          ? [base.parCle(lien.table, ligne[lien.colonne])].filter(Boolean)
          : base.lignes(lien.table).filter((autre) => autre[lien.colonne] === ligne[lien.cible]);
      // Les règles d'accès valent aussi pour ce qui est lu « à travers » une autre table.
      liees = liees.filter((autre) => peutLire(base, lien.table, autre, requete.qui));
      if (groupe) {
        liees = liees.filter((autre) => passeFiltres(base, lien.table, autre, groupe.filtres));
        liees = fenetre(trier(base, lien.table, liees, groupe.ordre), groupe.decalage, groupe.limite);
      }
      const sorties = liees.map((autre) => composer(base, lien.table, autre, noeud.enfants, requete, sousChemin)).filter((objet) => objet !== null);
      if (noeud.interne && sorties.length === 0) return null;
      sortie[noeud.alias] = lien.genre === 'parent' ? (sorties[0] ?? null) : sorties;
    }
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// Réponses
// ---------------------------------------------------------------------------

const JSON_UTF8 = 'application/json; charset=utf-8';

function reponse(statut, corps, entetes = {}) {
  return { statut, entetes: { 'Content-Type': JSON_UTF8, ...entetes }, corps: corps === undefined ? null : JSON.stringify(corps) };
}

const vide = (statut, entetes = {}) => ({ statut, entetes, corps: null });

/** `Accept: application/vnd.pgrst.object+json` : exactement une ligne, sinon 406. */
function objetSeul(objets) {
  if (objets.length !== 1) {
    throw new ErreurPg('PGRST116', 'Cannot coerce the result to a single JSON object', {
      details: `The result contains ${objets.length} rows`,
    });
  }
  return objets[0];
}

function lireCorpsJson(corps) {
  if (!corps || corps.length === 0) return {};
  try {
    return JSON.parse(corps.toString('utf8'));
  } catch {
    throw new ErreurPg('PGRST102', 'Empty or invalid json');
  }
}

/** Refus d'écriture au format RLS. */
const refusRls = (table) => new ErreurPg('42501', `new row violates row-level security policy for table "${table}"`);

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

/**
 * @param base    la base ouverte
 * @param appel   { methode, chemin, params: URLSearchParams, entetes, corps: Buffer }
 * @param qui     identité de l'appelant (voir `regles.mjs`)
 * @returns       { statut, entetes, corps }
 */
export function traiterRest(base, appel, qui) {
  const segments = appel.chemin.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments.length === 0) return reponse(200, { info: 'Base de test locale YakaRDC : émulation partielle de PostgREST.' });
  const preferences = lirePreferences(appel.entetes.prefer);
  const veutObjet = String(appel.entetes.accept ?? '').includes(TYPE_OBJET);
  const typeReponse = veutObjet ? `${TYPE_OBJET}; charset=utf-8` : JSON_UTF8;

  if (segments[0] === 'rpc') return appelerFonction(base, appel, qui, segments[1], veutObjet, typeReponse);

  const table = segments[0];
  if (segments.length !== 1 || !base.existe(table)) {
    throw new ErreurPg('PGRST205', `Could not find the table 'public.${segments.join('/')}' in the schema cache`);
  }

  const requete = {
    qui,
    groupes: analyserParametres(appel.params),
    cheminsVus: new Set(['']),
    select: analyserSelect(appel.params.get('select')),
  };
  const racine = requete.groupes.get('');
  const compter = 'count' in preferences;
  const visibles = () => base.lignes(table).filter((ligne) => peutLire(base, table, ligne, qui));

  /** Lignes -> objets JSON, puis vérifie qu'aucun filtre ne vise une ressource absente du `select`. */
  const composerTout = (lignes) => {
    const objets = lignes.map((ligne) => composer(base, table, ligne, requete.select, requete, '')).filter((objet) => objet !== null);
    for (const chemin of requete.groupes.keys()) {
      if (!requete.cheminsVus.has(chemin) && lignes.length > 0) {
        throw new ErreurPg('PGRST108', `'${chemin}' is not an embedded resource in this request`, {
          hint: `Verify that '${chemin}' is included in the 'select' query parameter.`,
        });
      }
    }
    return objets;
  };

  if (appel.methode === 'GET' || appel.methode === 'HEAD') {
    const triees = trier(base, table, visibles().filter((ligne) => passeFiltres(base, table, ligne, racine.filtres)), racine.ordre);
    const objets = composerTout(triees);
    const total = objets.length;

    let { decalage, limite } = racine;
    const plage = /^(\d+)-(\d*)$/.exec(String(appel.entetes.range ?? ''));
    if (plage && decalage === null && limite === null) {
      decalage = Number(plage[1]);
      limite = plage[2] === '' ? null : Number(plage[2]) - decalage + 1;
    }
    const page = fenetre(objets, decalage, limite);
    const debut = decalage ?? 0;
    const etendue = page.length === 0 ? '*' : `${debut}-${debut + page.length - 1}`;
    const entetes = { 'Content-Type': typeReponse, 'Content-Range': `${etendue}/${compter ? total : '*'}` };
    const partiel = compter && page.length < total;

    const corps = veutObjet ? objetSeul(page) : page;
    if (appel.methode === 'HEAD') return vide(partiel ? 206 : 200, entetes);
    return { statut: partiel ? 206 : 200, entetes, corps: JSON.stringify(corps) };
  }

  if (!base.tables[table]) throw new ErreurPg('42809', `cannot modify "${table}": it is a view`, { statut: 405 });
  const retour = preferences.return ?? 'minimal';

  /** Fin commune des écritures : représentation demandée ou réponse vide. */
  const conclure = (statut, lignes, objetsDejaPrets) => {
    const entetes = compter ? { 'Content-Range': `*/${lignes.length}` } : {};
    if (retour !== 'representation') return vide(statut === 200 ? 204 : statut, entetes);
    const objets = objetsDejaPrets ?? composerTout(lignes);
    return { statut, entetes: { ...entetes, 'Content-Type': typeReponse }, corps: JSON.stringify(veutObjet ? objetSeul(objets) : objets) };
  };

  if (appel.methode === 'POST') {
    const corps = lireCorpsJson(appel.corps);
    const charges = Array.isArray(corps) ? corps : [corps];
    const colonnesVoulues = appel.params.get('columns')?.split(',').map((nom) => sansGuillemets(nom.trim()));
    const resolution = preferences.resolution ?? null;
    const colonnesConflit = appel.params.get('on_conflict')?.split(',').map((nom) => nom.trim()) ?? base.tables[table].cle;

    return base.transaction(() => {
      const ecrites = [];
      for (const charge of charges) {
        if (charge === null || typeof charge !== 'object' || Array.isArray(charge)) throw new ErreurPg('PGRST102', 'Empty or invalid json');
        const valeurs = colonnesVoulues ? Object.fromEntries(colonnesVoulues.filter((nom) => nom in charge).map((nom) => [nom, charge[nom]])) : charge;

        // Upsert : la ligne existe-t-elle déjà sur les colonnes de conflit ?
        let existante = null;
        if (resolution && colonnesConflit.every((colonne) => valeurs[colonne] !== undefined && valeurs[colonne] !== null)) {
          const cles = colonnesConflit.map((colonne) => convertir(base.colonnes(table)[colonne]?.type ?? 'text', valeurs[colonne]));
          existante = base.lignes(table).find((ligne) => colonnesConflit.every((colonne, i) => ligne[colonne] === cles[i])) ?? null;
        }

        if (!existante) {
          // Comme sous RLS : la ligne (après déclencheurs « avant ») doit être
          // permise, et visible si on demande à la relire.
          const controle = (ligne) => {
            if (!peutInserer(base, table, ligne, qui)) throw refusRls(table);
            if (retour === 'representation' && !peutLire(base, table, ligne, qui)) throw refusRls(table);
          };
          ecrites.push(base.inserer(table, valeurs, { qui, controle }));
          continue;
        }

        // INSERT … ON CONFLICT vérifie d'abord la politique d'insertion sur la
        // ligne proposée, même si elle existe déjà : c'est ce qui fait échouer
        // en ligne un `upsert` sur `profiles` par un simple utilisateur.
        if (!peutInserer(base, table, { ...existante, ...valeurs }, qui)) throw refusRls(table);
        if (resolution === 'ignore-duplicates') continue;
        if (!peutLire(base, table, existante, qui) || !peutModifier(base, table, existante, qui)) throw refusRls(table);
        const controle = (nouvelle) => {
          if (!peutDevenir(base, table, nouvelle, qui)) throw refusRls(table);
        };
        ecrites.push(base.modifier(table, existante, valeurs, { qui, controle }));
      }
      return conclure(201, ecrites);
    });
  }

  if (appel.methode === 'PATCH' || appel.methode === 'DELETE') {
    // Supabase active `pg-safeupdate` : une écriture de masse sans filtre est refusée.
    if (racine.filtres.length === 0) {
      throw new ErreurPg('21000', `${appel.methode === 'PATCH' ? 'UPDATE' : 'DELETE'} requires a WHERE clause`);
    }
    const ciblees = visibles().filter((ligne) => passeFiltres(base, table, ligne, racine.filtres));

    if (appel.methode === 'DELETE') {
      // Une ligne qu'on n'a pas le droit de supprimer est simplement ignorée : 0 ligne, pas d'erreur.
      const supprimables = ciblees.filter((ligne) => peutSupprimer(base, table, ligne, qui));
      return base.transaction(() => {
        const objets = retour === 'representation' ? composerTout(supprimables) : null;
        for (const ligne of supprimables) base.supprimer(table, ligne);
        return conclure(200, supprimables, objets);
      });
    }

    const changements = lireCorpsJson(appel.corps);
    if (changements === null || typeof changements !== 'object' || Array.isArray(changements)) throw new ErreurPg('PGRST102', 'Empty or invalid json');
    // Idem : une ligne qu'on n'a pas le droit de modifier est ignorée en silence.
    const modifiables = ciblees.filter((ligne) => peutModifier(base, table, ligne, qui));
    return base.transaction(() => {
      // En revanche, une ligne modifiable qui deviendrait interdite est une erreur (WITH CHECK).
      const controle = (nouvelle) => {
        if (!peutDevenir(base, table, nouvelle, qui) || !peutLire(base, table, nouvelle, qui)) throw refusRls(table);
      };
      return conclure(200, modifiables.map((ligne) => base.modifier(table, ligne, changements, { qui, controle })));
    });
  }

  throw new ErreurPg('PGRST117', `Unsupported HTTP method: ${appel.methode}`, { statut: 405 });
}

function appelerFonction(base, appel, qui, nom, veutObjet, typeReponse) {
  const fonction = Object.hasOwn(FONCTIONS, nom ?? '') ? FONCTIONS[nom] : null;
  if (!fonction) {
    throw new ErreurPg('PGRST202', `Could not find the function public.${nom} in the schema cache`, {
      hint: 'Fonction absente de local/metier.mjs : la base de test ne la connaît pas.',
    });
  }
  const args = appel.methode === 'POST' ? lireCorpsJson(appel.corps) : Object.fromEntries(appel.params);
  const resultat = base.transaction(() => fonction(base, args ?? {}, qui));
  if (resultat === undefined) return vide(204);
  if (veutObjet) return { statut: 200, entetes: { 'Content-Type': typeReponse }, corps: JSON.stringify(objetSeul(Array.isArray(resultat) ? resultat : [resultat])) };
  return reponse(200, resultat);
}
