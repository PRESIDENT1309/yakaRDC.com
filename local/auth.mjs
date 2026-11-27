/**
 * Émulation de GoTrue (Supabase Auth) : tout ce qui arrive sur `/auth/v1/*`.
 *
 * POURQUOI CE FICHIER EXISTE
 * Inscription, connexion, session, changement et récupération de mot de
 * passe passent par ce service. Sans lui, impossible de se connecter à
 * l'application, donc de tester quoi que ce soit derrière un compte.
 *
 * CE QUI EST RÉEL
 *  - Les mots de passe sont hachés (scrypt), jamais stockés en clair.
 *  - Les jetons d'accès sont de vrais JWT HS256, signés avec un secret
 *    propre à CETTE base (tiré au hasard à la création, rangé dans le fichier
 *    de données). Ils expirent au bout d'une heure et se renouvellent avec un
 *    jeton de rafraîchissement à usage unique, comme en ligne.
 *
 * CE QUI EST SIMPLIFIÉ
 *  - Aucune confirmation par email : un compte est utilisable tout de suite.
 *  - Aucun email ni SMS n'est envoyé par ce service. Les liens et codes qui
 *    devraient partir par email sont ÉCRITS DANS LA CONSOLE du serveur.
 *  - Google (OAuth) n'existe pas : `/authorize` affiche une page d'explication.
 *  - Pas de limitation de débit, de captcha, de MFA, de PKCE.
 *  - Changer de mot de passe exige `current_password`, sauf dans une session
 *    ouverte par un lien de récupération. C'est le réglage que le code de
 *    l'application suppose activé en ligne (voir `app/reset-password.tsx`) ;
 *    les libellés d'erreur exacts de GoTrue pour ce cas sont approximés.
 */
import { createHmac, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

import { ErreurPg, maintenant } from './base.mjs';
import { creerProfilDuCompte } from './metier.mjs';

/** Clés de la base de test. Elles n'ouvrent rien d'autre que ce serveur local. */
export const CLE_PUBLIQUE = 'sb_publishable_local_test';
export const CLE_SECRETE = 'sb_secret_local_test';

const DUREE_SESSION = 3600;
const DUREE_LIEN_MS = 60 * 60 * 1000;
/** Un jeton de rafraîchissement déjà échangé reste accepté ce court délai (requêtes concurrentes). */
const TOLERANCE_REUTILISATION_MS = 10_000;
const LONGUEUR_MIN_MOT_DE_PASSE = 6;
const VERSION_API = '2024-01-01';

class ErreurAuth extends Error {
  constructor(statut, code, message) {
    super(message);
    this.statut = statut;
    this.code = code;
  }
}

const base64url = (objet) => Buffer.from(JSON.stringify(objet)).toString('base64url');

function hacher(motDePasse) {
  const sel = randomBytes(16);
  return `scrypt$${sel.toString('hex')}$${scryptSync(motDePasse, sel, 64).toString('hex')}`;
}

function motDePasseCorrect(motDePasse, empreinte) {
  if (typeof motDePasse !== 'string' || !empreinte) return false;
  const [, sel, attendu] = empreinte.split('$');
  const calcule = scryptSync(motDePasse, Buffer.from(sel, 'hex'), 64);
  return timingSafeEqual(calcule, Buffer.from(attendu, 'hex'));
}

const normaliserEmail = (email) => String(email ?? '').trim().toLowerCase();
const EMAIL_PLAUSIBLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const echapperHtml = (texte) => String(texte).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * @param options.base         la base ouverte
 * @param options.urlPublique  adresse du serveur vue par l'application (sert aux liens)
 * @param options.urlApp       adresse de l'application (retour après un lien)
 * @param options.annoncer     écrit une ligne dans la console du serveur
 */
export function creerAuth({ base, urlPublique, urlApp, annoncer }) {
  const { sql } = base;

  let secret = base.meta('secret_jwt');
  if (!secret) {
    secret = randomBytes(48).toString('base64url');
    base.ecrireMeta('secret_jwt', secret);
  }

  // --- Jetons d'accès (JWT HS256) ---

  function signer(charge) {
    const debut = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(charge)}`;
    return `${debut}.${createHmac('sha256', secret).update(debut).digest('base64url')}`;
  }

  /** Rend la charge du jeton, ou { erreur: 'invalide' | 'expire' }. */
  function lireJeton(jeton) {
    const morceaux = String(jeton ?? '').split('.');
    if (morceaux.length !== 3) return { erreur: 'invalide' };
    const attendue = createHmac('sha256', secret).update(`${morceaux[0]}.${morceaux[1]}`).digest();
    const recue = Buffer.from(morceaux[2], 'base64url');
    if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return { erreur: 'invalide' };
    try {
      const charge = JSON.parse(Buffer.from(morceaux[1], 'base64url').toString('utf8'));
      if (typeof charge.exp !== 'number' || charge.exp * 1000 < Date.now()) return { erreur: 'expire' };
      return { charge };
    } catch {
      return { erreur: 'invalide' };
    }
  }

  // --- Comptes ---

  const lireJson = (texte) => {
    try {
      return JSON.parse(texte ?? '{}') ?? {};
    } catch {
      return {};
    }
  };

  function versCompte(brut) {
    if (!brut) return null;
    return { ...brut, user_metadata: lireJson(brut.user_metadata), app_metadata: lireJson(brut.app_metadata) };
  }

  const compteParId = (id) => versCompte(sql.prepare('select * from auth_users where id = ?').get(String(id ?? '')));
  const compteParEmail = (email) => versCompte(sql.prepare('select * from auth_users where email = ?').get(normaliserEmail(email)));

  /** Le compte tel que GoTrue le renvoie (jamais l'empreinte du mot de passe). */
  function compteEnJson(compte) {
    return {
      id: compte.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: compte.email,
      email_confirmed_at: compte.email_confirmed_at,
      confirmed_at: compte.email_confirmed_at,
      phone: '',
      last_sign_in_at: compte.last_sign_in_at,
      app_metadata: { provider: 'email', providers: ['email'], ...compte.app_metadata },
      user_metadata: compte.user_metadata,
      identities: [
        {
          identity_id: compte.id,
          id: compte.id,
          user_id: compte.id,
          identity_data: { email: compte.email, email_verified: true, phone_verified: false, sub: compte.id },
          provider: 'email',
          last_sign_in_at: compte.last_sign_in_at,
          created_at: compte.created_at,
          updated_at: compte.updated_at,
          email: compte.email,
        },
      ],
      created_at: compte.created_at,
      updated_at: compte.updated_at,
      is_anonymous: false,
    };
  }

  function verifierMotDePasse(motDePasse) {
    if (typeof motDePasse !== 'string' || motDePasse === '') throw new ErreurAuth(400, 'validation_failed', 'Signup requires a valid password');
    if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
      throw new ErreurAuth(422, 'weak_password', `Password should be at least ${LONGUEUR_MIN_MOT_DE_PASSE} characters.`);
    }
  }

  /**
   * Crée un compte et, comme le déclencheur `handle_new_user` en ligne, son
   * profil de voyageur. `motDePasse` peut être nul (compte créé par lien).
   */
  function creerCompte({ email, motDePasse = null, metadonnees = {}, metadonneesApp = {}, codeSiExiste = 'user_already_exists' }) {
    const adresse = normaliserEmail(email);
    if (!EMAIL_PLAUSIBLE.test(adresse)) throw new ErreurAuth(400, 'validation_failed', 'Unable to validate email address: invalid format');
    if (motDePasse !== null) verifierMotDePasse(motDePasse);
    if (compteParEmail(adresse)) {
      throw codeSiExiste === 'email_exists'
        ? new ErreurAuth(422, 'email_exists', 'A user with this email address has already been registered')
        : new ErreurAuth(422, 'user_already_exists', 'User already registered');
    }
    const instant = maintenant();
    const id = randomUUID();
    return base.transaction(() => {
      sql
        .prepare(
          `insert into auth_users (id, email, mot_de_passe, user_metadata, app_metadata, email_confirmed_at, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, adresse, motDePasse === null ? null : hacher(motDePasse), JSON.stringify(metadonnees ?? {}), JSON.stringify(metadonneesApp ?? {}), instant, instant, instant);
      const compte = compteParId(id);
      creerProfilDuCompte(base, compte);
      return compte;
    });
  }

  /** Applique des changements à un compte et rend le compte à jour. */
  function modifierCompte(compte, { email, motDePasse, metadonnees, metadonneesApp }) {
    const suivant = { ...compte };
    if (email !== undefined && normaliserEmail(email) !== compte.email) {
      const adresse = normaliserEmail(email);
      if (!EMAIL_PLAUSIBLE.test(adresse)) throw new ErreurAuth(400, 'validation_failed', 'Unable to validate email address: invalid format');
      if (compteParEmail(adresse)) throw new ErreurAuth(422, 'email_exists', 'A user with this email address has already been registered');
      suivant.email = adresse;
    }
    if (motDePasse !== undefined) {
      verifierMotDePasse(motDePasse);
      suivant.mot_de_passe = hacher(motDePasse);
    }
    // Comme GoTrue : les métadonnées sont fusionnées, une clé à null est retirée.
    const fusionner = (anciennes, nouvelles) =>
      Object.fromEntries(Object.entries({ ...anciennes, ...nouvelles }).filter(([, valeur]) => valeur !== null));
    if (metadonnees) suivant.user_metadata = fusionner(compte.user_metadata, metadonnees);
    if (metadonneesApp) suivant.app_metadata = fusionner(compte.app_metadata, metadonneesApp);
    sql
      .prepare('update auth_users set email = ?, mot_de_passe = ?, user_metadata = ?, app_metadata = ?, updated_at = ? where id = ?')
      .run(suivant.email, suivant.mot_de_passe, JSON.stringify(suivant.user_metadata), JSON.stringify(suivant.app_metadata), maintenant(), compte.id);
    return compteParId(compte.id);
  }

  // --- Sessions ---

  function nouveauJetonDeRafraichissement(idSession) {
    const jeton = randomBytes(9).toString('base64url');
    sql.prepare('insert into auth_jetons (jeton, session_id, created_at) values (?, ?, ?)').run(jeton, idSession, maintenant());
    return jeton;
  }

  function reponseSession(compte, idSession, methode) {
    const emis = Math.floor(Date.now() / 1000);
    const jetonAcces = signer({
      iss: `${urlPublique}/auth/v1`,
      sub: compte.id,
      aud: 'authenticated',
      exp: emis + DUREE_SESSION,
      iat: emis,
      email: compte.email,
      phone: '',
      app_metadata: { provider: 'email', providers: ['email'], ...compte.app_metadata },
      user_metadata: compte.user_metadata,
      role: 'authenticated',
      aal: 'aal1',
      amr: [{ method: methode, timestamp: emis }],
      session_id: idSession,
      is_anonymous: false,
    });
    return {
      access_token: jetonAcces,
      token_type: 'bearer',
      expires_in: DUREE_SESSION,
      expires_at: emis + DUREE_SESSION,
      refresh_token: nouveauJetonDeRafraichissement(idSession),
      user: compteEnJson(compte),
    };
  }

  /** Ouvre une session : `methode` vaut 'password', 'recovery' ou 'otp'. */
  function ouvrirSession(compte, methode) {
    const idSession = randomUUID();
    const instant = maintenant();
    sql.prepare('insert into auth_sessions (id, user_id, methode, created_at) values (?, ?, ?, ?)').run(idSession, compte.id, methode, instant);
    sql.prepare('update auth_users set last_sign_in_at = ? where id = ?').run(instant, compte.id);
    return reponseSession(compteParId(compte.id), idSession, methode);
  }

  function rafraichir(jeton) {
    const ligne = sql.prepare('select * from auth_jetons where jeton = ?').get(String(jeton ?? ''));
    if (!ligne) throw new ErreurAuth(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
    const session = sql.prepare('select * from auth_sessions where id = ?').get(ligne.session_id);
    if (ligne.remplace_le && Date.now() - Date.parse(ligne.remplace_le) > TOLERANCE_REUTILISATION_MS) {
      // Un jeton rejoué longtemps après : on ferme la session par prudence, comme GoTrue.
      sql.prepare('delete from auth_sessions where id = ?').run(ligne.session_id);
      throw new ErreurAuth(400, 'refresh_token_already_used', 'Invalid Refresh Token: Already Used');
    }
    const compte = compteParId(session.user_id);
    if (!ligne.remplace_le) sql.prepare('update auth_jetons set remplace_le = ? where jeton = ?').run(maintenant(), ligne.jeton);
    return reponseSession(compte, session.id, session.methode);
  }

  /** Session et compte derrière un jeton d'accès, ou erreur GoTrue. */
  function sessionCourante(entetes) {
    const porteur = /^Bearer\s+(.+)$/i.exec(String(entetes.authorization ?? ''))?.[1];
    if (!porteur) throw new ErreurAuth(401, 'no_authorization', 'This endpoint requires a valid Bearer token');
    const { charge, erreur } = lireJeton(porteur);
    if (erreur === 'expire') throw new ErreurAuth(403, 'bad_jwt', 'invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired');
    if (erreur || !charge.sub) throw new ErreurAuth(403, 'bad_jwt', 'invalid JWT: unable to parse or verify signature, token is malformed or has no sub claim');
    const session = sql.prepare('select * from auth_sessions where id = ?').get(String(charge.session_id ?? ''));
    if (!session) throw new ErreurAuth(403, 'session_not_found', 'Session from session_id claim in JWT does not exist');
    const compte = compteParId(charge.sub);
    if (!compte) throw new ErreurAuth(403, 'user_not_found', 'User from sub claim in JWT does not exist');
    return { compte, session };
  }

  // --- Liens et codes à usage unique (récupération, code de vérification) ---

  function creerLien(compte, type) {
    const jeton = randomBytes(28).toString('hex');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    sql
      .prepare('insert into auth_liens (jeton, user_id, type, code, expire_le) values (?, ?, ?, ?, ?)')
      .run(jeton, compte.id, type, code, new Date(Date.now() + DUREE_LIEN_MS).toISOString());
    return { jeton, code };
  }

  /** Consomme un lien ou un code ; rend le compte, ou null s'il est inconnu, périmé ou déjà utilisé. */
  function consommerLien({ jeton, code, email }) {
    let ligne = null;
    if (jeton) ligne = sql.prepare('select * from auth_liens where jeton = ?').get(String(jeton));
    else if (code && email) {
      const compte = compteParEmail(email);
      if (compte) ligne = sql.prepare('select * from auth_liens where user_id = ? and code = ? order by expire_le desc').get(compte.id, String(code));
    }
    if (!ligne || ligne.utilise_le || Date.parse(ligne.expire_le) < Date.now()) return null;
    sql.prepare('update auth_liens set utilise_le = ? where jeton = ?').run(maintenant(), ligne.jeton);
    return { compte: compteParId(ligne.user_id), type: ligne.type };
  }

  /**
   * Adresse de retour acceptée après un lien. On ne renvoie que vers
   * l'application locale (ou un lien profond d'application mobile), jamais
   * vers un site quelconque fourni dans l'URL.
   */
  function retourSur(demande) {
    try {
      const cible = new URL(demande);
      const locale = ['localhost', '127.0.0.1', '[::1]'].includes(cible.hostname) || cible.origin === new URL(urlApp).origin;
      const lienProfond = !['http:', 'https:'].includes(cible.protocol);
      if (locale || lienProfond || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(cible.hostname)) return cible.toString();
    } catch {
      // adresse absente ou illisible : on retombe sur l'application
    }
    return urlApp;
  }

  function lienDAction(jeton, type, retour) {
    return `${urlPublique}/auth/v1/verify?token=${jeton}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(retour)}`;
  }

  // --- Réponses HTTP ---

  const json = (statut, corps) => ({ statut, entetes: { 'Content-Type': 'application/json; charset=utf-8' }, corps: JSON.stringify(corps) });
  const rediriger = (adresse) => ({ statut: 303, entetes: { Location: adresse }, corps: null });

  function lireCorps(corps) {
    if (!corps || corps.length === 0) return {};
    try {
      return JSON.parse(corps.toString('utf8')) ?? {};
    } catch {
      throw new ErreurAuth(400, 'bad_json', 'Could not parse request body as JSON');
    }
  }

  function exigerCleSecrete(entetes) {
    const porteur = /^Bearer\s+(.+)$/i.exec(String(entetes.authorization ?? ''))?.[1];
    if (porteur !== CLE_SECRETE) throw new ErreurAuth(403, 'not_admin', 'User not allowed');
  }

  function pageGoogleIndisponible(params) {
    let retour = urlApp;
    try {
      retour = new URL(retourSur(params.get('redirect_to') ?? urlApp)).origin;
    } catch {
      // lien profond sans origine : on garde l'adresse de l'application
    }
    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connexion Google indisponible</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #FAF8F4; color: #1A0A03; font-family: system-ui, sans-serif; }
  main { max-width: 30rem; margin: 1.5rem; padding: 2rem; background: #fff; border-radius: 16px; border: 1px solid #FAECE7; }
  h1 { font-size: 1.25rem; margin: 0 0 .75rem; color: #712B13; }
  p { line-height: 1.5; margin: 0 0 1rem; }
  code { background: #FAEEDA; padding: .1rem .35rem; border-radius: 4px; }
  a { display: inline-block; padding: .7rem 1.1rem; border-radius: 10px; background: #712B13; color: #fff; text-decoration: none; }
</style>
</head>
<body>
<main>
  <h1>Connexion avec Google indisponible</h1>
  <p>Vous utilisez la <strong>base de test locale</strong> de YakaRDC. Elle ne peut pas joindre Google : la connexion par compte Google n'y existe pas.</p>
  <p>Connectez-vous avec une adresse email et un mot de passe, par exemple <code>voyageur@yakardc.test</code> et <code>Yaka-test-2026</code>.</p>
  <a href="${echapperHtml(`${retour}/login`)}">Revenir à la connexion</a>
</main>
</body>
</html>`;
    return { statut: 200, entetes: { 'Content-Type': 'text/html; charset=utf-8' }, corps: html };
  }

  // --- Routes ---

  function router({ methode, chemin, params, entetes, corps }) {
    const segments = chemin.split('/').filter(Boolean);
    const route = `${methode} /${segments.join('/')}`;

    if (route === 'GET /health') return json(200, { name: 'GoTrue (émulation locale YakaRDC)', version: 'local' });
    if (route === 'GET /settings') {
      return json(200, { external: { email: true, phone: false, google: false }, disable_signup: false, mailer_autoconfirm: true, phone_autoconfirm: false });
    }
    if (route === 'GET /authorize') return pageGoogleIndisponible(params);

    if (route === 'POST /signup') {
      const { email, password, data } = lireCorps(corps);
      if (!email) throw new ErreurAuth(400, 'phone_provider_disabled', 'Phone signups are disabled');
      const compte = creerCompte({ email, motDePasse: password ?? '', metadonnees: data ?? {} });
      return json(200, ouvrirSession(compte, 'password'));
    }

    if (route === 'POST /token') {
      const demande = lireCorps(corps);
      const type = params.get('grant_type');
      if (type === 'password') {
        const compte = demande.email ? compteParEmail(demande.email) : null;
        if (!compte || !motDePasseCorrect(demande.password, compte.mot_de_passe)) {
          throw new ErreurAuth(400, 'invalid_credentials', 'Invalid login credentials');
        }
        return json(200, ouvrirSession(compte, 'password'));
      }
      if (type === 'refresh_token') return json(200, rafraichir(demande.refresh_token));
      throw new ErreurAuth(400, 'invalid_request', `unsupported_grant_type : « ${type} » n'est pas pris en charge par la base de test`);
    }

    if (route === 'GET /user') return json(200, compteEnJson(sessionCourante(entetes).compte));

    if (route === 'PUT /user') {
      const { compte, session } = sessionCourante(entetes);
      const demande = lireCorps(corps);
      const changements = { metadonnees: demande.data, email: demande.email };
      if (demande.password !== undefined && demande.password !== null) {
        verifierMotDePasse(demande.password);
        if (session.methode !== 'recovery') {
          if (!demande.current_password) throw new ErreurAuth(400, 'current_password_required', 'Current password required when setting new password.');
          if (!motDePasseCorrect(demande.current_password, compte.mot_de_passe)) {
            throw new ErreurAuth(400, 'current_password_mismatch', 'Current password is incorrect.');
          }
        }
        if (motDePasseCorrect(demande.password, compte.mot_de_passe)) {
          throw new ErreurAuth(422, 'same_password', 'New password should be different from the old password.');
        }
        changements.motDePasse = demande.password;
      }
      return json(200, compteEnJson(modifierCompte(compte, changements)));
    }

    if (route === 'POST /logout') {
      const { compte, session } = sessionCourante(entetes);
      const portee = params.get('scope') ?? 'global';
      if (portee === 'local') sql.prepare('delete from auth_sessions where id = ?').run(session.id);
      else if (portee === 'others') sql.prepare('delete from auth_sessions where user_id = ? and id <> ?').run(compte.id, session.id);
      else sql.prepare('delete from auth_sessions where user_id = ?').run(compte.id);
      return { statut: 204, entetes: {}, corps: null };
    }

    if (route === 'POST /verify') {
      const demande = lireCorps(corps);
      const trouve = consommerLien({ jeton: demande.token_hash, code: demande.token, email: demande.email });
      if (!trouve) throw new ErreurAuth(403, 'otp_expired', 'Token has expired or is invalid');
      return json(200, ouvrirSession(trouve.compte, trouve.type === 'recovery' ? 'recovery' : 'otp'));
    }

    if (route === 'GET /verify') {
      // Lien cliqué depuis un email : on renvoie vers l'application avec la
      // session dans le fragment d'URL, que le client Supabase sait lire.
      const retour = new URL(retourSur(params.get('redirect_to') ?? urlApp));
      const trouve = consommerLien({ jeton: params.get('token') ?? params.get('token_hash') });
      if (!trouve) {
        retour.hash = new URLSearchParams({ error: 'access_denied', error_code: 'otp_expired', error_description: 'Email link is invalid or has expired' }).toString();
        return rediriger(retour.toString());
      }
      const type = params.get('type') ?? trouve.type;
      const session = ouvrirSession(trouve.compte, type === 'recovery' ? 'recovery' : 'otp');
      retour.hash = new URLSearchParams({
        access_token: session.access_token,
        expires_at: String(session.expires_at),
        expires_in: String(session.expires_in),
        refresh_token: session.refresh_token,
        token_type: 'bearer',
        type,
      }).toString();
      return rediriger(retour.toString());
    }

    if (route === 'POST /recover' || route === 'POST /otp' || route === 'POST /magiclink' || route === 'POST /resend') {
      // En ligne, ces routes envoient un email. Ici rien ne part : on écrit
      // le lien et le code dans la console pour qu'un essai reste possible.
      const demande = lireCorps(corps);
      const compte = demande.email ? compteParEmail(demande.email) : null;
      if (compte) {
        const type = route === 'POST /recover' ? 'recovery' : 'magiclink';
        const { jeton, code } = creerLien(compte, type);
        const retour = retourSur(params.get('redirect_to') ?? urlApp);
        annoncer(`aucun email n'est envoyé par la base de test. Pour ${compte.email} : code ${code}, lien ${lienDAction(jeton, type, retour)}`);
      } else {
        annoncer(`demande « ${segments[0]} » pour ${demande.email ?? demande.phone ?? 'un destinataire inconnu'} : aucun compte, rien à envoyer`);
      }
      return json(200, {});
    }

    // --- API d'administration (clé secrète uniquement) ---

    if (segments[0] === 'admin') {
      exigerCleSecrete(entetes);

      if (route === 'POST /admin/users') {
        const demande = lireCorps(corps);
        const compte = creerCompte({
          email: demande.email,
          motDePasse: demande.password ?? null,
          metadonnees: demande.user_metadata ?? {},
          metadonneesApp: demande.app_metadata ?? {},
          codeSiExiste: 'email_exists',
        });
        return json(200, compteEnJson(compte));
      }

      if (route === 'GET /admin/users') {
        const comptes = sql.prepare('select * from auth_users order by created_at').all().map(versCompte);
        const parPage = Number(params.get('per_page') ?? 50);
        const page = Number(params.get('page') ?? 1);
        const reponse = json(200, { users: comptes.slice((page - 1) * parPage, page * parPage).map(compteEnJson), aud: 'authenticated' });
        reponse.entetes['x-total-count'] = String(comptes.length);
        return reponse;
      }

      if (segments[1] === 'users' && segments[2] && segments.length === 3) {
        const compte = compteParId(segments[2]);
        if (!compte) throw new ErreurAuth(404, 'user_not_found', 'User not found');
        if (methode === 'GET') return json(200, compteEnJson(compte));
        if (methode === 'PUT') {
          const demande = lireCorps(corps);
          const suivant = modifierCompte(compte, {
            email: demande.email,
            motDePasse: demande.password ?? undefined,
            metadonnees: demande.user_metadata,
            metadonneesApp: demande.app_metadata,
          });
          return json(200, compteEnJson(suivant));
        }
        if (methode === 'DELETE') {
          try {
            sql.prepare('delete from auth_users where id = ?').run(compte.id);
          } catch {
            // Même comportement qu'en ligne quand une clé étrangère sans cascade retient le compte.
            throw new ErreurAuth(500, 'unexpected_failure', 'Database error deleting user');
          } finally {
            base.cache.clear();
          }
          return json(200, compteEnJson(compte));
        }
      }

      if (route === 'POST /admin/generate_link') {
        const demande = lireCorps(corps);
        const type = demande.type;
        let compte = compteParEmail(demande.email);
        if (type === 'signup' || type === 'invite') {
          if (compte) throw new ErreurAuth(422, 'email_exists', 'A user with this email address has already been registered');
          compte = creerCompte({ email: demande.email, motDePasse: demande.password ?? null, metadonnees: demande.data ?? {} });
        } else if (type !== 'recovery' && type !== 'magiclink') {
          throw new ErreurAuth(400, 'validation_failed', `Type de lien « ${type} » non pris en charge par la base de test`);
        }
        if (!compte) throw new ErreurAuth(404, 'user_not_found', 'User with this email not found');
        const { jeton, code } = creerLien(compte, type);
        const retour = retourSur(demande.redirect_to ?? params.get('redirect_to') ?? urlApp);
        const lien = lienDAction(jeton, type, retour);
        annoncer(`lien « ${type} » généré pour ${compte.email} (valable une heure, une seule fois) : ${lien}`);
        return json(200, { ...compteEnJson(compte), action_link: lien, email_otp: code, hashed_token: jeton, redirect_to: retour, verification_type: type });
      }
    }

    throw new ErreurAuth(404, 'not_found', `Route d'authentification non prise en charge par la base de test : ${route}`);
  }

  /** Point d'entrée HTTP : rend toujours une réponse, y compris pour les erreurs. */
  function traiter(appel) {
    // Le client récent annonce sa version d'API et attend alors `{ code, message }` ;
    // sans cette annonce (appel direct par `fetch`), GoTrue répond à l'ancien format.
    const nouveauFormat = String(appel.entetes['x-supabase-api-version'] ?? '') >= VERSION_API;
    try {
      const reponse = router(appel);
      if (nouveauFormat) reponse.entetes['X-Supabase-Api-Version'] = VERSION_API;
      return reponse;
    } catch (erreur) {
      if (!(erreur instanceof ErreurAuth)) throw erreur;
      const reponse = nouveauFormat
        ? json(erreur.statut, { code: erreur.code, message: erreur.message })
        : json(erreur.statut, { code: erreur.statut, error_code: erreur.code, msg: erreur.message });
      if (nouveauFormat) reponse.entetes['X-Supabase-Api-Version'] = VERSION_API;
      return reponse;
    }
  }

  /**
   * Identité d'un appel à `/rest/v1` ou `/storage/v1`, d'après ses en-têtes.
   * La clé publique seule donne un anonyme, la clé secrète le rôle de
   * service, un jeton d'accès valide l'utilisateur connecté.
   */
  function identifier(entetes) {
    const cle = entetes.apikey ?? null;
    const porteur = /^Bearer\s+(.+)$/i.exec(String(entetes.authorization ?? ''))?.[1] ?? null;
    if (cle !== null && cle !== CLE_PUBLIQUE && cle !== CLE_SECRETE) {
      throw new ErreurPg('PGRST301', 'Invalid API key', {
        statut: 401,
        hint: "Clé inconnue de la base de test locale : l'application a sans doute été lancée avec les clés de la base en ligne.",
      });
    }
    const jeton = porteur ?? cle;
    if (jeton === null) throw new ErreurPg('PGRST301', 'No API key found in request', { statut: 401, hint: 'No `apikey` request header or url param was found.' });
    if (jeton === CLE_SECRETE) return { role: 'service', id: null, admin: false };
    if (jeton === CLE_PUBLIQUE) return { role: 'anon', id: null, admin: false };
    const { charge, erreur } = lireJeton(jeton);
    if (erreur === 'expire') throw new ErreurPg('PGRST303', 'JWT expired', { statut: 401 });
    if (erreur || !charge.sub) throw new ErreurPg('PGRST301', 'JWSError JWSInvalidSignature', { statut: 401 });
    return { role: 'authenticated', id: charge.sub, admin: base.parCle('profiles', charge.sub)?.role === 'admin' };
  }

  return { traiter, identifier, creerCompte, compteParEmail, ouvrirSession };
}
