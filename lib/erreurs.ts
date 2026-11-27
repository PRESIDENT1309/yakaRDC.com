/**
 * Erreurs techniques → phrases que l'utilisateur peut lire et sur lesquelles
 * il peut agir.
 *
 * L'audit du 26/11/2026 a relevé une vingtaine d'écrans qui affichaient
 * `error.message` tel quel : de l'anglais de Postgres ou de Supabase (« new
 * row violates row-level security policy for table "bookings" ») dans une
 * application française, adressé à quelqu'un qui n'a aucun moyen d'en faire
 * quoi que ce soit.
 *
 * Deux fonctions, deux publics :
 *  - `messageErreur`   : pour l'utilisateur. Toujours une phrase française.
 *  - `detailTechnique` : pour le support. Ce que le serveur a réellement dit,
 *    à n'afficher que là où l'on demande explicitement de le transmettre.
 */

type ErreurBrute = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  name?: unknown;
} | null | undefined;

const REPLI = "Une erreur est survenue. Réessayez dans un instant.";

/** Motif reconnu dans le message brut → phrase. Le premier qui correspond l'emporte. */
const PAR_MOTIF: [RegExp, string][] = [
  // Réseau — de loin le cas le plus fréquent sur une connexion mobile.
  [/failed to fetch|network request failed|networkerror|fetch failed|load failed|timeout|timed out/i,
    "Connexion impossible. Vérifiez votre réseau, puis réessayez."],

  // Session
  [/jwt expired|invalid jwt|session.*(expired|missing|not found)|refresh token/i,
    "Votre session a expiré. Reconnectez-vous, puis réessayez."],

  // Authentification
  [/invalid login credentials/i, "Adresse email ou mot de passe incorrect."],
  [/email not confirmed/i, "Votre adresse email n'est pas encore confirmée. Ouvrez le message que nous vous avons envoyé."],
  [/user already registered|already been registered/i, "Un compte existe déjà avec cette adresse email."],
  [/token has expired|otp.*expired|invalid.*otp|token.*invalid/i, "Ce code est incorrect ou a expiré. Demandez-en un nouveau."],
  [/rate limit|too many requests|for security purposes, you can only request/i,
    "Trop de tentatives. Patientez quelques instants avant de réessayer."],
  [/password should be at least|weak.?password/i, "Ce mot de passe est trop court ou trop simple."],
  [/should be different from the old password|same.?password/i, "Le nouveau mot de passe doit être différent de l'ancien."],
  [/unable to validate email|invalid email|email address.*invalid/i, "Cette adresse email n'est pas valide."],
  [/signups? (not allowed|disabled)/i, "Les inscriptions sont momentanément fermées."],

  // Fichiers
  [/payload too large|maximum allowed size|file size|too large/i, "Ce fichier est trop volumineux."],
  [/mime type|invalid file type|not supported/i, "Ce format de fichier n'est pas accepté."],

  // Base de données, quand le code n'a pas suffi
  [/row-level security|permission denied|not authorized|unauthorized/i,
    "Vous n'avez pas les droits nécessaires pour cette action."],
  [/duplicate key|already exists/i, "Cet élément existe déjà."],
  [/foreign key/i, "Cet élément est encore utilisé ailleurs : il ne peut pas être modifié ou supprimé."],
];

/** Code Postgres / PostgREST → phrase. Plus fiable que le texte, donc consulté d'abord. */
const PAR_CODE: Record<string, string> = {
  '42501': "Vous n'avez pas les droits nécessaires pour cette action.",
  '23505': "Cet élément existe déjà.",
  '23503': "Cet élément est encore utilisé ailleurs : il ne peut pas être modifié ou supprimé.",
  '23502': "Une information obligatoire est manquante.",
  '23514': "Une des valeurs saisies n'est pas acceptée.",
  '22001': "Un des textes saisis est trop long.",
  '22P02': "Une des valeurs saisies n'a pas le bon format.",
  'PGRST116': "Cet élément est introuvable. Il a peut-être été supprimé.",
  'PGRST301': "Votre session a expiré. Reconnectez-vous, puis réessayez.",
};

const texte = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Phrase française pour l'utilisateur.
 *
 * @param e      l'erreur reçue (Supabase, fetch, exception)
 * @param repli  phrase employée quand l'erreur n'est pas reconnue — à préciser
 *               selon le contexte : « La photo n'a pas pu être envoyée. »
 *
 * Une erreur non reconnue garde son code entre parenthèses : il ne dit rien à
 * l'utilisateur, mais suffit au support pour la retrouver.
 */
export function messageErreur(e: unknown, repli: string = REPLI): string {
  const err = (e ?? null) as ErreurBrute;
  if (!err) return repli;

  const code = texte(err.code) || (typeof err.code === 'number' ? String(err.code) : '');
  const brut = texte(err.message) || (typeof e === 'string' ? e.trim() : '');

  // Nos propres déclencheurs parlent déjà français et disent précisément ce
  // qui bloque (« OFFER_FULL: il ne reste que 2 place(s) pour cette date. »).
  // Ils passent AVANT la table des codes : certains sont levés avec le code
  // générique 23514, dont la phrase toute faite effacerait cette précision.
  const maison = brut.match(/^[A-Z][A-Z_]{2,}:\s*(.+)$/s);
  if (maison) return maison[1].charAt(0).toUpperCase() + maison[1].slice(1);
  // P0001 : `raise exception` sans code particulier — là encore, un message
  // écrit par nous (« Code introuvable »).
  if (code === 'P0001' && brut) return brut;

  if (code && PAR_CODE[code]) return PAR_CODE[code];

  const statut = Number(err.status ?? err.statusCode);
  if (statut === 429) return "Trop de tentatives. Patientez quelques instants avant de réessayer.";
  if (statut === 413) return "Ce fichier est trop volumineux.";

  for (const [motif, phrase] of PAR_MOTIF) {
    if (motif.test(brut)) return phrase;
  }

  // Trace pour le développement : la phrase générique ne doit pas faire
  // disparaître la cause réelle.
  if (__DEV__) console.warn('[erreur non traduite]', detailTechnique(e));

  return code ? `${repli} (réf. ${code})` : repli;
}

/**
 * Ce que le serveur a réellement répondu, pour un message destiné au support.
 *
 * `error.message` n'est pas toujours une phrase : selon la réponse, il peut
 * arriver vide ou contenir le corps JSON brut — d'où un « {} » affiché tel
 * quel. On assemble donc ce qui est réellement présent (message, statut HTTP,
 * code) et, à défaut, on l'annonce franchement.
 */
export function detailTechnique(e: unknown): string {
  if (!e) return 'erreur inconnue';
  if (typeof e === 'string') return e;
  const err = e as NonNullable<ErreurBrute>;
  const bouts: string[] = [];

  const m = texte(err.message);
  if (m && m !== '{}' && m !== '[object Object]') bouts.push(m);
  if (err.status) bouts.push(`HTTP ${String(err.status)}`);
  if (err.code) bouts.push(`code ${String(err.code)}`);
  if (!bouts.length && err.name) bouts.push(String(err.name));

  if (!bouts.length) {
    try {
      const brut = JSON.stringify(e);
      if (brut && brut !== '{}') bouts.push(brut.slice(0, 200));
    } catch { /* objet non sérialisable : on laisse le repli ci-dessous */ }
  }

  return bouts.length ? bouts.join(' · ') : 'le serveur a répondu sans expliquer pourquoi';
}
