/**
 * Exécution des fonctions Edge : tout ce qui arrive sur `/functions/v1/<nom>`.
 *
 * POURQUOI CE FICHIER EXISTE
 * Trois traitements de l'application vivent côté serveur, dans
 * `supabase/functions/<nom>/index.ts` : approuver un partenaire, demander un
 * nouveau mot de passe, accuser réception d'une demande. Plutôt que de les
 * réécrire (et de tester autre chose que le vrai code), on exécute ICI LE
 * VRAI FICHIER, sans le modifier.
 *
 * COMMENT
 * Ces fichiers sont écrits pour Deno. Trois choses seulement les empêchent de
 * tourner sous Node, et on les fournit :
 *  1. le TypeScript : Node 24 retire les types tout seul à l'import ;
 *  2. `import … from 'jsr:@supabase/supabase-js@2'` : un crochet de
 *     résolution redirige cet import vers le paquet déjà présent dans
 *     `node_modules` ;
 *  3. l'objet global `Deno` : on en fournit une version minimale, avec
 *     `Deno.env.get` (variables ci-dessous) et `Deno.serve`, qui se contente
 *     de retenir la fonction de traitement au lieu d'ouvrir un port.
 *
 * LIMITES (à connaître avant de conclure qu'une fonction « marche »)
 *  - Ce n'est pas le moteur Deno : une API propre à Deno autre que
 *    `Deno.env` et `Deno.serve`, ou une syntaxe TypeScript non effaçable
 *    (enum, namespace), ferait échouer le chargement. L'échec est alors
 *    signalé tel quel (réponse 500 + console), jamais maquillé.
 *  - La passerelle de Supabase (vérification du JWT avant la fonction,
 *    `verify_jwt` de `config.toml`) n'est pas reproduite.
 *  - Une fonction est chargée une fois : après l'avoir modifiée, relancer le serveur.
 */
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

import { CLE_PUBLIQUE, CLE_SECRETE } from './auth.mjs';

const SERVICES_EMAIL = ['MAILERSEND_API_KEY', 'BREVO_API_KEY', 'RESEND_API_KEY'];

let crochetInstalle = false;
/** Fonction passée à `Deno.serve` par le module en cours de chargement. */
let capture = null;
/** Variables vues par `Deno.env.get`. Une seule base par processus. */
let environnement = new Map();

function installerCrochets() {
  if (crochetInstalle) return;
  crochetInstalle = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      // `jsr:@supabase/supabase-js@2` (Deno) -> `@supabase/supabase-js` (node_modules).
      if (specifier.startsWith('jsr:@supabase/supabase-js') || specifier.startsWith('npm:@supabase/supabase-js')) {
        return nextResolve('@supabase/supabase-js', context);
      }
      return nextResolve(specifier, context);
    },
  });
  globalThis.Deno = {
    env: {
      get: (nom) => environnement.get(nom),
      has: (nom) => environnement.has(nom),
      toObject: () => Object.fromEntries(environnement),
    },
    serve(...args) {
      const gestionnaire = args.find((arg) => typeof arg === 'function') ?? args.find((arg) => typeof arg?.handler === 'function')?.handler;
      capture = gestionnaire ?? null;
      return { finished: Promise.resolve(), shutdown: async () => {}, ref() {}, unref() {} };
    },
  };
}

/**
 * @param options.racine      racine du dépôt
 * @param options.urlInterne  adresse du serveur local (les fonctions le rappellent)
 * @param options.urlApp      adresse de l'application (liens dans les emails)
 * @param options.sansEmail   vrai (cas par défaut du serveur) : ne lit pas `supabase/functions/.env`, donc aucun email réel
 * @param options.annoncer    écrit une ligne dans la console du serveur
 */
export function creerFonctions({ racine, urlInterne, urlApp, sansEmail, annoncer }) {
  const dossier = path.join(racine, 'supabase', 'functions');

  environnement = new Map();
  let emailsReels = false;
  const fichierEnv = path.join(dossier, '.env');
  if (sansEmail) {
    annoncer('fonctions : supabase/functions/.env est ignoré, aucun email réel ne peut partir (pour en envoyer : YAKA_LOCAL_AVEC_EMAIL=1)');
  } else if (existsSync(fichierEnv)) {
    // Lu pour être transmis aux fonctions, jamais affiché : ni noms, ni valeurs.
    const variables = parseEnv(readFileSync(fichierEnv, 'utf8'));
    let retenues = 0;
    for (const [nom, valeur] of Object.entries(variables)) {
      // Les adresses et clés Supabase du fichier désignent la base EN LIGNE :
      // les laisser passer enverrait les fonctions écrire là-bas. `APP_URL`
      // désigne le site en ligne : les liens des emails doivent revenir ici.
      if (nom.startsWith('SUPABASE_') || nom === 'APP_URL') continue;
      environnement.set(nom, valeur);
      retenues += 1;
    }
    emailsReels = SERVICES_EMAIL.some((nom) => Boolean(environnement.get(nom)));
    annoncer(`fonctions : ${retenues} variable(s) reprise(s) de supabase/functions/.env (contenu non affiché)`);
    if (emailsReels) {
      annoncer('ATTENTION : YAKA_LOCAL_AVEC_EMAIL=1 et un service d\'envoi est configuré, les fonctions enverront de VRAIS emails aux adresses saisies');
    }
  } else {
    annoncer('fonctions : pas de supabase/functions/.env, aucun service d\'email configuré');
  }
  // Les valeurs locales s'imposent toujours.
  for (const [nom, valeur] of Object.entries({
    SUPABASE_URL: urlInterne,
    SUPABASE_ANON_KEY: CLE_PUBLIQUE,
    SUPABASE_PUBLISHABLE_KEY: CLE_PUBLIQUE,
    SUPABASE_SERVICE_ROLE_KEY: CLE_SECRETE,
    SUPABASE_SECRET_KEY: CLE_SECRETE,
    APP_URL: urlApp,
  })) {
    environnement.set(nom, valeur);
  }

  const gestionnaires = new Map();
  let file = Promise.resolve();

  /** Charge une fonction une seule fois. Les chargements se suivent : `capture` est global. */
  function charger(nom) {
    if (!gestionnaires.has(nom)) {
      const chargement = file.then(async () => {
        installerCrochets();
        capture = null;
        await import(pathToFileURL(path.join(dossier, nom, 'index.ts')).href);
        const gestionnaire = capture;
        capture = null;
        if (!gestionnaire) throw new Error(`supabase/functions/${nom}/index.ts n'a pas appelé Deno.serve(...)`);
        return gestionnaire;
      });
      file = chargement.catch(() => {});
      gestionnaires.set(nom, chargement);
      // Un chargement raté n'est pas retenu : on réessaiera au prochain appel.
      chargement.catch(() => gestionnaires.delete(nom));
    }
    return gestionnaires.get(nom);
  }

  const json = (statut, corps) => ({ statut, entetes: { 'Content-Type': 'application/json; charset=utf-8' }, corps: JSON.stringify(corps) });

  async function traiter(appel) {
    const nom = appel.chemin.split('/').filter(Boolean)[0] ?? '';
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(nom) || !existsSync(path.join(dossier, nom, 'index.ts'))) {
      return json(404, { code: 'NOT_FOUND', message: 'Requested function was not found' });
    }

    let gestionnaire;
    try {
      gestionnaire = await charger(nom);
    } catch (erreur) {
      annoncer(`fonction ${nom} : le vrai code ne peut pas être chargé sous Node : ${erreur?.stack ?? erreur}`);
      return json(500, {
        code: 'BOOT_ERROR',
        message: `La base de test ne peut pas exécuter supabase/functions/${nom}/index.ts : ${erreur?.message ?? erreur}`,
      });
    }

    const entetes = new Headers();
    for (const [cle, valeur] of Object.entries(appel.entetes)) {
      if (['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive'].includes(cle)) continue;
      entetes.set(cle, Array.isArray(valeur) ? valeur.join(', ') : String(valeur));
    }
    const avecCorps = appel.methode !== 'GET' && appel.methode !== 'HEAD';
    const requete = new Request(`${urlInterne}/functions/v1/${nom}`, {
      method: appel.methode,
      headers: entetes,
      body: avecCorps ? appel.corps : undefined,
    });

    try {
      const reponse = await gestionnaire(requete);
      return { statut: reponse.status, entetes: Object.fromEntries(reponse.headers), corps: Buffer.from(await reponse.arrayBuffer()) };
    } catch (erreur) {
      annoncer(`fonction ${nom} : exception non rattrapée : ${erreur?.stack ?? erreur}`);
      return json(500, { code: 'UNCAUGHT_EXCEPTION', message: String(erreur?.message ?? erreur) });
    }
  }

  return { traiter, emailsReels };
}
