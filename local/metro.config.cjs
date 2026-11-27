/**
 * Configuration Metro utilisée UNIQUEMENT quand l'application est lancée sur
 * la base de test locale (par `local/demarrer.mjs`, via la variable
 * `EXPO_OVERRIDE_METRO_CONFIG`). Les lancements habituels (`npm run web`,
 * `npm start`, `npm run build:web`) ne passent jamais par ce fichier.
 *
 * POURQUOI CE FICHIER EXISTE
 * Le lanceur donne à Expo l'adresse et la clé de la base locale par des
 * variables d'environnement. Pour une construction (`expo export`), cela
 * suffit : une vraie variable d'environnement l'emporte sur le fichier
 * `.env`. Mais en développement (`expo start`), Expo fait l'inverse dans le
 * code envoyé au navigateur : il relit `.env` en direct, pour le
 * rechargement à chaud, et ses valeurs écrasent celles de l'environnement.
 * Sans précaution, `npm run web:local` parlerait donc toujours à la base en
 * ligne. On ne veut pas toucher à `.env` : on demande simplement à Metro de
 * ne pas voir les fichiers `.env*`, ce qui le fait retomber sur les
 * variables d'environnement — celles de la base locale.
 *
 * CE QU'IL FAIT D'AUTRE
 * Il donne au cache de Metro un nom distinct. Une construction locale inscrit
 * l'adresse 127.0.0.1 en dur dans le code compilé ; avec un cache commun, une
 * construction normale faite ensuite pourrait resservir ces morceaux.
 */
const fs = require('node:fs');
const path = require('node:path');

const racine = path.resolve(__dirname, '..');

// Si le projet se dote un jour de son propre metro.config.js, on part de lui.
const configProjet = path.join(racine, 'metro.config.js');
const config = fs.existsSync(configProjet) ? require(configProjet) : require('expo/metro-config').getDefaultConfig(racine);

const fichiersEnv = /[\\/]\.env(\.[\w.-]+)?$/;
const dejaExclus = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(dejaExclus) ? dejaExclus : dejaExclus ? [dejaExclus] : []), fichiersEnv];

config.cacheVersion = `${config.cacheVersion ?? ''}-yakardc-base-locale`;

module.exports = config;
