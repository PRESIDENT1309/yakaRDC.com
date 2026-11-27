/**
 * Serveur de la base de test locale.
 *
 * POURQUOI CE FICHIER EXISTE
 * Toute l'application accède à ses données par le client Supabase, donc par
 * HTTP. Quand le projet Supabase en ligne est injoignable, il suffit de
 * donner à l'application une autre adresse qui répond « comme Supabase ».
 * Ce serveur est cette adresse : il imite la partie de l'API dont
 * l'application se sert, et range tout dans un fichier SQLite.
 *
 * CE QU'IL FAIT
 * Il écoute sur 127.0.0.1:54321 et aiguille quatre familles de routes :
 *   /rest/v1/*       tables et fonctions SQL   -> rest.mjs (+ regles.mjs, metier.mjs)
 *   /auth/v1/*       comptes et sessions       -> auth.mjs
 *   /storage/v1/*    fichiers                  -> stockage.mjs
 *   /functions/v1/*  fonctions Edge            -> fonctions.mjs
 * Aucune dépendance à installer : uniquement des modules fournis avec Node 24.
 *
 * CE QU'IL NE FAIT PAS
 * Ce n'est ni PostgreSQL ni Supabase. Les règles d'accès sont une
 * approximation (voir regles.mjs) : cette base sert à faire tourner et à
 * essayer l'application, PAS à valider sa sécurité ni ses migrations.
 * Elle n'a rien à faire sur un serveur public : pas de TLS, clés connues.
 *
 * UTILISATION DIRECTE (le mode d'emploi complet est en tête de demarrer.mjs)
 *   node local/serveur.mjs                    démarre le serveur
 *   node local/serveur.mjs --reinitialiser    efface la base et les fichiers, puis repart des données de départ
 *
 * RÉGLAGES (variables d'environnement, toutes facultatives)
 *   YAKA_LOCAL_PORT        port d'écoute (défaut 54321)
 *   YAKA_LOCAL_HOTE        interface d'écoute (défaut 127.0.0.1 ; 0.0.0.0 pour un téléphone du même réseau)
 *   YAKA_LOCAL_URL         adresse du serveur vue par l'application (défaut http://127.0.0.1:<port>)
 *   YAKA_LOCAL_APP_URL     adresse de l'application, pour les liens de récupération (défaut http://localhost:8081)
 *   YAKA_LOCAL_DONNEES     dossier des données (défaut local/donnees)
 *   YAKA_LOCAL_AVEC_EMAIL  « 1 » : transmet aux fonctions les clés de supabase/functions/.env, donc de
 *                          VRAIS emails peuvent partir. Sans cette variable, aucun email réel ne part.
 *   YAKA_LOCAL_SANS_EMAIL  « 1 » : interdit l'envoi quoi qu'il arrive (l'emporte sur YAKA_LOCAL_AVEC_EMAIL)
 *   YAKA_LOCAL_VERBEUX     « 1 » : écrit chaque requête reçue dans la console
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLE_PUBLIQUE, CLE_SECRETE, creerAuth } from './auth.mjs';
import { Base, ErreurPg } from './base.mjs';
import { creerFonctions } from './fonctions.mjs';
import { COMPTES, MOT_DE_PASSE, semer } from './graine.mjs';
import { brancherMetier } from './metier.mjs';
import { traiterRest } from './rest.mjs';
import { q } from './schema.mjs';
import { creerStockage } from './stockage.mjs';

const ETIQUETTE = '[base-locale]';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const NOM_BASE = 'yakardc-test.db';
/** Marqueur renvoyé par `/` : permet à demarrer.mjs de reconnaître un serveur déjà lancé. */
export const SERVICE = 'yakardc-base-locale';
export const PORT_PAR_DEFAUT = 54321;
export { CLE_PUBLIQUE, CLE_SECRETE };

const TAILLE_MAX_CORPS = 60 * 1024 * 1024;

function lireCorps(requete) {
  return new Promise((resoudre, rejeter) => {
    const morceaux = [];
    let taille = 0;
    requete.on('data', (morceau) => {
      taille += morceau.length;
      if (taille > TAILLE_MAX_CORPS) {
        rejeter(Object.assign(new Error('Corps de requête trop volumineux'), { statut: 413 }));
        requete.destroy();
        return;
      }
      morceaux.push(morceau);
    });
    requete.on('end', () => resoudre(Buffer.concat(morceaux)));
    requete.on('error', rejeter);
  });
}

/**
 * Si l'adresse publique a changé depuis le dernier lancement (autre port),
 * les adresses d'images déjà enregistrées pointent dans le vide. On les
 * réécrit, dans toutes les colonnes de texte.
 */
function suivreUrlPublique(base, urlPublique, annoncer) {
  const ancienne = base.meta('url_publique');
  if (ancienne && ancienne !== urlPublique) {
    for (const [nom, table] of Object.entries(base.tables)) {
      for (const [colonne, def] of Object.entries(table.colonnes)) {
        if (!['text', 'text[]', 'json'].includes(def.type)) continue;
        base.sql
          .prepare(`update ${q(nom)} set ${q(colonne)} = replace(${q(colonne)}, ?, ?) where ${q(colonne)} like ?`)
          .run(`${ancienne}/`, `${urlPublique}/`, `%${ancienne}/%`);
      }
    }
    base.cache.clear();
    annoncer(`adresse du serveur changée (${ancienne} -> ${urlPublique}) : adresses d'images mises à jour`);
  }
  base.ecrireMeta('url_publique', urlPublique);
}

/**
 * Démarre le serveur. Rend { url, port, dossierDonnees, arreter }.
 *
 * @param options.port            port d'écoute ; 0 = un port libre choisi par le système
 * @param options.dossierDonnees  dossier de la base et des fichiers
 * @param options.reinitialiser   vrai : efface tout avant de démarrer
 * @param options.sansEmail       vrai : les fonctions ne reçoivent aucune clé d'envoi d'email
 * @param options.urlApp          adresse de l'application
 */
export async function demarrerServeur(options = {}) {
  const env = process.env;
  const portDemande = options.port ?? Number(env.YAKA_LOCAL_PORT ?? PORT_PAR_DEFAUT);
  const hote = options.hote ?? env.YAKA_LOCAL_HOTE ?? '127.0.0.1';
  const dossierDonnees = path.resolve(options.dossierDonnees ?? env.YAKA_LOCAL_DONNEES ?? path.join(ICI, 'donnees'));
  const urlApp = (options.urlApp ?? env.YAKA_LOCAL_APP_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
  // Par défaut, aucun email réel : une base de test ne doit pas pouvoir écrire
  // à de vraies personnes parce qu'on a oublié une variable. L'envoi se demande
  // explicitement (YAKA_LOCAL_AVEC_EMAIL=1), et YAKA_LOCAL_SANS_EMAIL=1 le
  // refuse même dans ce cas.
  const sansEmail = options.sansEmail ?? (env.YAKA_LOCAL_SANS_EMAIL === '1' || env.YAKA_LOCAL_AVEC_EMAIL !== '1');
  const verbeux = options.verbeux ?? env.YAKA_LOCAL_VERBEUX === '1';

  const annoncer = (message) => console.log(`${ETIQUETTE} ${message}`);
  const dejaAverti = new Set();
  const avertir = (message) => {
    // Un même avertissement n'est écrit qu'une fois par lancement : une colonne
    // inconnue lue par un écran reviendrait sinon à chaque rafraîchissement.
    if (dejaAverti.has(message)) return;
    dejaAverti.add(message);
    console.warn(`${ETIQUETTE} AVERTISSEMENT : ${message}`);
  };

  // Les services ne peuvent être créés qu'une fois le port connu (les
  // adresses d'images le contiennent) : on écoute d'abord, on prépare ensuite.
  let services = null;

  const serveur = http.createServer((requete, reponse) => {
    const debut = Date.now();
    repondre(requete, reponse)
      .catch((erreur) => {
        console.error(`${ETIQUETTE} ERREUR interne sur ${requete.method} ${requete.url} :`, erreur);
        if (!reponse.headersSent) reponse.writeHead(erreur?.statut ?? 500, { 'Content-Type': 'application/json; charset=utf-8' });
        reponse.end(JSON.stringify({ code: 'XX000', message: `Erreur interne de la base de test : ${erreur?.message ?? erreur}`, details: null, hint: null }));
      })
      .finally(() => {
        if (verbeux) annoncer(`${requete.method} ${requete.url} -> ${reponse.statusCode} (${Date.now() - debut} ms)`);
      });
  });

  async function repondre(requete, reponse) {
    // CORS : l'application web (localhost:8081) appelle une autre origine.
    // Tout est permis : ce serveur ne contient que des données de test.
    reponse.setHeader('Access-Control-Allow-Origin', '*');
    reponse.setHeader('Access-Control-Expose-Headers', 'Content-Range, Range, Location, X-Supabase-Api-Version, x-total-count, x-relay-error');
    if (requete.method === 'OPTIONS') {
      reponse.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': requete.headers['access-control-request-headers'] ?? '*',
        'Access-Control-Allow-Private-Network': 'true',
        'Access-Control-Max-Age': '3600',
      });
      reponse.end();
      return;
    }

    const url = new URL(requete.url, 'http://local');
    if (!services) {
      reponse.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '1' });
      reponse.end(JSON.stringify({ message: 'La base de test démarre, réessayez dans un instant.' }));
      return;
    }
    if (url.pathname === '/' || url.pathname === '/sante') {
      reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      reponse.end(JSON.stringify({ service: SERVICE, url: services.urlPublique, sans_email: sansEmail }));
      return;
    }

    const prefixe = ['/rest/v1', '/auth/v1', '/storage/v1', '/functions/v1'].find((debut) => url.pathname === debut || url.pathname.startsWith(`${debut}/`));
    if (!prefixe) {
      reponse.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      reponse.end(JSON.stringify({ message: `Route inconnue de la base de test : ${url.pathname}` }));
      return;
    }

    const appel = {
      methode: requete.method,
      chemin: url.pathname.slice(prefixe.length),
      params: url.searchParams,
      entetes: requete.headers,
      corps: await lireCorps(requete),
    };

    let resultat;
    let qui = null;
    try {
      if (prefixe === '/rest/v1') {
        qui = services.auth.identifier(appel.entetes);
        resultat = traiterRest(services.base, appel, qui);
      } else if (prefixe === '/auth/v1') {
        resultat = services.auth.traiter(appel);
      } else if (prefixe === '/storage/v1') {
        resultat = await services.stockage.traiter(appel, () => services.auth.identifier(appel.entetes));
      } else {
        resultat = await services.fonctions.traiter(appel);
      }
    } catch (erreur) {
      if (!(erreur instanceof ErreurPg)) throw erreur;
      // Un refus d'accès pour un visiteur non connecté est un 401, comme PostgREST.
      const statut = erreur.code === '42501' && qui?.role === 'anon' ? 401 : erreur.statut;
      resultat = { statut, entetes: { 'Content-Type': 'application/json; charset=utf-8' }, corps: JSON.stringify(erreur.enJson()) };
    }

    for (const [nom, valeur] of Object.entries(resultat.entetes ?? {})) {
      // Les longueurs et encodages viennent d'une autre réponse (fonction Edge) : Node recalcule.
      if (['content-length', 'transfer-encoding', 'content-encoding', 'connection'].includes(nom.toLowerCase())) continue;
      if (nom.toLowerCase().startsWith('access-control-allow-origin')) continue;
      reponse.setHeader(nom, valeur);
    }
    reponse.statusCode = resultat.statut;
    reponse.end(requete.method === 'HEAD' || resultat.corps === null || resultat.corps === undefined ? undefined : resultat.corps);
  }

  await new Promise((resoudre, rejeter) => {
    serveur.once('error', (erreur) => {
      if (erreur.code === 'EADDRINUSE') {
        rejeter(new Error(`le port ${portDemande} est déjà utilisé. Une base de test tourne peut-être déjà ; sinon choisissez un autre port avec YAKA_LOCAL_PORT.`));
      } else rejeter(erreur);
    });
    serveur.listen(portDemande, hote, resoudre);
  });

  const port = serveur.address().port;
  const urlInterne = `http://127.0.0.1:${port}`;
  const urlPublique = (options.urlPublique ?? env.YAKA_LOCAL_URL ?? urlInterne).replace(/\/+$/, '');
  let base = null;

  try {
    const fichierBase = path.join(dossierDonnees, NOM_BASE);
    const dossierFichiers = path.join(dossierDonnees, 'fichiers');
    if (options.reinitialiser) {
      // On n'efface que ce que ce serveur a lui-même créé, nommément.
      for (const suffixe of ['', '-journal', '-wal', '-shm']) rmSync(`${fichierBase}${suffixe}`, { force: true });
      rmSync(dossierFichiers, { recursive: true, force: true });
      annoncer('base et fichiers effacés (--reinitialiser)');
    }
    mkdirSync(dossierFichiers, { recursive: true });
    const nouvelle = !existsSync(fichierBase);

    base = new Base(fichierBase, avertir);
    brancherMetier(base);
    suivreUrlPublique(base, urlPublique, annoncer);
    const auth = creerAuth({ base, urlPublique, urlApp, annoncer });
    const stockage = creerStockage({ base, dossierFichiers, urlPublique });
    const fonctions = creerFonctions({ racine: RACINE, urlInterne, urlApp, sansEmail, annoncer });

    // Données de départ : seulement sur une base vide. Ce qui a été créé
    // pendant les essais survit donc aux redémarrages.
    if (!base.meta('graine')) {
      const resume = semer({ base, auth, stockage });
      base.ecrireMeta('graine', new Date().toISOString());
      annoncer(`${nouvelle ? 'nouvelle base' : 'base vide'} : ${resume.etablissements} établissements et leurs données de départ créés`);
      annoncer(`billet à valider côté partenaire (écran de scan) : ${resume.billetAValider}`);
    }
    services = { base, auth, stockage, fonctions, urlPublique };
  } catch (erreur) {
    base?.fermer();
    await new Promise((resoudre) => serveur.close(resoudre));
    throw erreur;
  }

  annoncer(`prête sur ${urlPublique} (données : ${dossierDonnees})`);
  annoncer(`comptes de test, mot de passe ${MOT_DE_PASSE} : ${Object.values(COMPTES).join(', ')}`);

  let arrete = false;
  return {
    url: urlPublique,
    port,
    dossierDonnees,
    /** Ferme les connexions puis le fichier de base. Sans danger si appelé deux fois. */
    async arreter() {
      if (arrete) return;
      arrete = true;
      serveur.closeAllConnections();
      await new Promise((resoudre) => serveur.close(resoudre));
      base.fermer();
    },
  };
}

/** Un serveur de base locale répond-il déjà à cette adresse ? */
export async function serveurDejaLance(url) {
  try {
    const reponse = await fetch(`${url}/sante`, { signal: AbortSignal.timeout(1500) });
    return reponse.ok && (await reponse.json()).service === SERVICE;
  } catch {
    return false;
  }
}

// --- Lancement direct : `node local/serveur.mjs [--reinitialiser]` ---
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inconnus = process.argv.slice(2).filter((arg) => arg !== '--reinitialiser');
  if (inconnus.length > 0) {
    console.error(`${ETIQUETTE} option inconnue : ${inconnus.join(' ')}. Seule option : --reinitialiser`);
    process.exit(2);
  }
  try {
    const serveur = await demarrerServeur({ reinitialiser: process.argv.includes('--reinitialiser') });
    console.log(`${ETIQUETTE} Ctrl+C pour arrêter.`);
    const arreter = () => serveur.arreter().then(() => process.exit(0));
    process.on('SIGINT', arreter);
    process.on('SIGTERM', arreter);
  } catch (erreur) {
    console.error(`${ETIQUETTE} démarrage impossible : ${erreur.message}`);
    process.exit(1);
  }
}
