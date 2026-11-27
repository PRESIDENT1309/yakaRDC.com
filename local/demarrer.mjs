/**
 * Lance l'application sur la BASE DE TEST LOCALE.
 *
 * ===========================================================================
 * MODE D'EMPLOI
 * ===========================================================================
 *
 * POURQUOI
 * Toute l'application lit et écrit ses données chez Supabase. Quand le projet
 * Supabase en ligne est injoignable, plus rien ne s'affiche. Ce dossier
 * `local/` fournit un remplaçant qui tourne sur votre machine, pour continuer
 * à développer et à essayer l'application. Rien n'est à installer : il ne se
 * sert que de Node (version 24 ou plus).
 *
 * LES COMMANDES
 *   npm run web:local         l'application web sur la base locale
 *   npm run start:local       idem pour `expo start` (voir « Téléphone » plus bas)
 *   npm run build:web:local   construit `dist/` sur la base locale (voir l'avertissement)
 *   npm run local:serveur     la base locale seule, sans l'application
 *   npm run local:reset       efface la base locale et la recrée avec ses données de départ
 *   npm run local:essai       auto-test de la base locale (ne touche pas à vos données)
 *
 * Pour revenir à la base en ligne : arrêtez tout (Ctrl+C) et relancez comme
 * d'habitude (`npm run web`, `npm start`, `npm run build:web`). Il n'y a rien
 * à défaire : ni `.env`, ni `lib/supabase.ts`, ni aucun fichier de
 * l'application ne sont modifiés par le mode local.
 *
 * LES COMPTES DE TEST (mot de passe commun : Yaka-test-2026)
 *   admin@yakardc.test        administrateur
 *   partenaire@yakardc.test   partenaire, propriétaire de « Hôtel Rive Congo »
 *   voyageur@yakardc.test     voyageur, avec une réservation dans chaque statut
 * L'inscription fonctionne aussi : un nouveau compte est utilisable tout de
 * suite, sans email de confirmation.
 *
 * COMMENT LA BASCULE FONCTIONNE
 * Ce script démarre le serveur local (local/serveur.mjs, sur
 * http://127.0.0.1:54321), puis lance Expo en lui donnant, par des variables
 * d'environnement, l'adresse et la clé de ce serveur :
 *   EXPO_PUBLIC_SUPABASE_URL              = http://127.0.0.1:54321
 *   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY  = sb_publishable_local_test
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY         = sb_publishable_local_test
 * Elles ne valent que pour ce lancement. Pour qu'elles l'emportent aussi en
 * développement, Expo est lancé avec `local/metro.config.cjs`, qui lui cache
 * les fichiers `.env*` (l'explication détaillée est en tête de ce fichier).
 * Quand Expo s'arrête, le serveur local s'arrête proprement.
 *
 * OÙ SONT LES DONNÉES
 * Dans `local/donnees/` (ignoré par git) : la base `yakardc-test.db` et les
 * fichiers envoyés, dans `fichiers/`. Les données de départ ne sont créées
 * que si la base est vide : ce que vous créez pendant vos essais est
 * conservé d'un lancement à l'autre. `npm run local:reset` remet tout à neuf.
 *
 * EMAILS
 * Les fonctions Edge (approbation d'un partenaire, mot de passe oublié,
 * accusé de réception) sont exécutées avec leur vrai code, mais SANS les clés
 * d'envoi : par défaut, aucun email réel ne part. Le lien de réinitialisation
 * d'un mot de passe est écrit dans la console du serveur, et le mot de passe
 * provisoire d'un partenaire approuvé s'affiche à l'écran d'administration.
 * Les adresses en `@yakardc.test` n'existent pas.
 *
 * Pour essayer l'envoi réel (les clés de `supabase/functions/.env` sont alors
 * transmises aux fonctions, et de VRAIS emails partent aux adresses saisies) :
 *   PowerShell :  $env:YAKA_LOCAL_AVEC_EMAIL='1'; npm run web:local
 * Fermer ce terminal, ou `Remove-Item Env:YAKA_LOCAL_AVEC_EMAIL`, pour revenir
 * au comportement par défaut. YAKA_LOCAL_SANS_EMAIL=1 interdit l'envoi quoi
 * qu'il arrive.
 *
 * AVERTISSEMENTS
 *  - `npm run build:web:local` écrit dans `dist/` un site qui parle à
 *    127.0.0.1. NE JAMAIS LE DÉPLOYER. Avant une mise en ligne, reconstruire
 *    avec `npm run build:web`.
 *  - La base locale IMITE Supabase pour ce dont l'application se sert. Ses
 *    règles d'accès sont approximatives (local/regles.mjs) : elle ne permet
 *    de valider ni la sécurité, ni les migrations SQL.
 *  - La connexion avec Google n'existe pas en local (une page l'explique).
 *
 * TÉLÉPHONE (non vérifié : aucun essai sur appareil n'a été fait)
 * 127.0.0.1 désigne le téléphone lui-même. Pour un appareil du même réseau,
 * il faut que le serveur écoute sur le réseau et annonce l'adresse du PC :
 *   $env:YAKA_LOCAL_HOTE='0.0.0.0'; $env:YAKA_LOCAL_URL='http://<adresse-ip-du-pc>:54321'; npm run start:local
 *
 * RÉGLAGES
 * Voir la liste des variables YAKA_LOCAL_* en tête de local/serveur.mjs.
 * Tout argument ajouté après `--` est transmis à Expo, par exemple :
 *   npm run web:local -- --port 8082
 * ===========================================================================
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLE_PUBLIQUE, PORT_PAR_DEFAUT, demarrerServeur, serveurDejaLance } from './serveur.mjs';

const ETIQUETTE = '[local]';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');

/** Ce que chaque mode exécute, dans l'ordre. `expo` : arguments de la CLI Expo ; `node` : script à lancer. */
const MODES = {
  web: [{ expo: ['start', '--web'] }],
  start: [{ expo: ['start'] }],
  build: [{ expo: ['export', '-p', 'web', '--clear'] }, { node: ['scripts/postbuild-web.mjs'] }],
};

const [mode, ...supplements] = process.argv.slice(2);
if (!Object.hasOwn(MODES, mode ?? '')) {
  console.error(`${ETIQUETTE} usage : node local/demarrer.mjs <web|start|build> [arguments pour Expo]`);
  process.exit(2);
}

// La CLI Expo du projet, lancée directement par Node : c'est ce que ferait
// `npx expo`, sans passer par un interpréteur de commandes ni rien télécharger.
const cliExpo = createRequire(path.join(RACINE, 'package.json')).resolve('expo/bin/cli');

/** Lance une commande dans le terminal courant et rend son code de sortie. */
let enfant = null;
function executer(args, env) {
  return new Promise((resoudre, rejeter) => {
    enfant = spawn(process.execPath, args, { cwd: RACINE, env, stdio: 'inherit' });
    enfant.once('error', rejeter);
    enfant.once('exit', (code, signal) => {
      enfant = null;
      resoudre(code ?? (signal ? 1 : 0));
    });
  });
}

const port = Number(process.env.YAKA_LOCAL_PORT ?? PORT_PAR_DEFAUT);
const urlAttendue = (process.env.YAKA_LOCAL_URL ?? `http://127.0.0.1:${port}`).replace(/\/+$/, '');

let serveur = null;
let code = 1;
try {
  if (await serveurDejaLance(`http://127.0.0.1:${port}`)) {
    // `npm run local:serveur` tourne déjà dans un autre terminal : on s'en sert, et on le laisse en vie.
    console.log(`${ETIQUETTE} une base locale tourne déjà sur le port ${port} : elle est réutilisée`);
  } else {
    serveur = await demarrerServeur();
  }

  const env = {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL: serveur?.url ?? urlAttendue,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CLE_PUBLIQUE,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: CLE_PUBLIQUE,
    EXPO_OVERRIDE_METRO_CONFIG: path.join(ICI, 'metro.config.cjs'),
  };
  console.log(`${ETIQUETTE} l'application va utiliser la base locale ${env.EXPO_PUBLIC_SUPABASE_URL} (le fichier .env n'est pas modifié)`);
  if (mode === 'build') {
    console.log(`${ETIQUETTE} ATTENTION : le dossier dist/ produit parlera à la base locale. Ne pas le déployer.`);
  }

  // Ctrl+C atteint aussi Expo, qui s'arrête de lui-même : on attend qu'il ait
  // fini pour fermer la base, au lieu de couper le serveur sous ses pieds.
  process.on('SIGINT', () => {});
  process.on('SIGTERM', () => enfant?.kill());

  code = 0;
  for (const etape of MODES[mode]) {
    const args = etape.expo ? [cliExpo, ...etape.expo, ...supplements] : etape.node;
    code = await executer(args, env);
    if (code !== 0) break;
  }
} catch (erreur) {
  console.error(`${ETIQUETTE} ${erreur.message}`);
  code = 1;
} finally {
  if (serveur) {
    await serveur.arreter();
    console.log(`${ETIQUETTE} base locale arrêtée`);
  }
}
process.exit(code);
