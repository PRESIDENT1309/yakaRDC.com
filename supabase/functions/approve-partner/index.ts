// Approbation d'une demande de partenariat, avec création du compte.
//
// POURQUOI UNE EDGE FUNCTION
// Créer un compte avec un mot de passe imposé exige l'API Admin de Supabase,
// donc la clé `service_role`. Cette clé donne un accès total à la base et
// contourne toutes les règles d'accès : elle ne doit JAMAIS se trouver dans
// l'application, où n'importe qui pourrait la lire dans le bundle. Elle vit
// ici, en secret côté serveur, et n'en sort pas.
//
// CE QUE LA FONCTION FAIT
//   1. Vérifie que l'appelant est bien un administrateur.
//   2. Crée le compte du partenaire avec un mot de passe généré.
//   3. Rattache la demande à ce compte, puis appelle `approve_partner_request`,
//      qui crée l'établissement, donne le rôle et journalise — la logique
//      métier reste en base, elle n'est pas dupliquée ici.
//   4. Envoie l'email de félicitations contenant les identifiants.
//
// RÉSERVE ASSUMÉE
// Le mot de passe part en clair dans l'email et y restera indéfiniment. C'est
// un choix produit explicite. Il est marqué `must_change_password` dans les
// métadonnées du compte : l'app impose son remplacement à la connexion.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail, layout, button, notice } from '../_shared/email.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const log = (...parts: unknown[]) => console.log('[approve-partner]', ...parts);

const json = (body: unknown, status = 200) => {
  // Toute sortie en erreur laisse une trace lisible dans les logs Supabase.
  // Sans cela, un échec ne se voit que comme un code de statut nu, et la
  // raison reste hors de portée quand l'app tourne sur un autre appareil.
  if (status >= 400) log('ECHEC', status, JSON.stringify(body).slice(0, 500));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
};

/**
 * Mot de passe lisible à voix haute et à recopier.
 *
 * L'alphabet écarte les caractères qu'on confond en lecture (0/O, 1/l/I) :
 * ce mot de passe sera lu dans un email, parfois sur un téléphone, parfois
 * dicté au téléphone. Un caractère ambigu, c'est un partenaire bloqué.
 * `crypto.getRandomValues` et non `Math.random` — un mot de passe prévisible
 * n'en est pas un.
 */
function generatePassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  // Groupé par 4 : bien plus facile à recopier sans erreur.
  return out.match(/.{1,4}/g)!.join('-');
}

function welcomeEmail(params: {
  establishmentName: string;
  contactName: string;
  email: string;
  password: string;
  appUrl: string;
}) {
  const { establishmentName, contactName, email, password, appUrl } = params;
  return {
    subject: `Félicitations — ${establishmentName} est approuvé sur YakaRDC`,
    html: layout({
      title: 'Félicitations !',
      body: `
<p>Bonjour ${contactName},</p>
<p>
  Votre établissement <strong>${establishmentName}</strong> vient d'être approuvé.
  Il est désormais visible par les voyageurs sur YakaRDC.
</p>
<p>Voici vos identifiants de connexion :</p>
<div style="background:#FAF8F4;border:1px solid #E7E2DA;border-radius:10px;padding:16px;margin:16px 0">
  <div style="font-size:12px;color:#8A857D">Adresse email</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:12px">${email}</div>
  <div style="font-size:12px;color:#8A857D">Mot de passe provisoire</div>
  <div style="font-size:18px;font-weight:700;letter-spacing:1px;font-family:monospace">${password}</div>
</div>
${notice("Ce mot de passe est provisoire. Changez-le dès votre première connexion, dans <strong>Profil › Mot de passe</strong>. Supprimez ensuite cet email.")}
${button(`${appUrl}/login`, 'Accéder à mon espace')}
<p style="font-size:12px;color:#8A857D">
  Vous n'êtes pas à l'origine de cette demande ? Répondez à cet email, nous la retirerons.
</p>`.trim(),
    }),
  };
}

/**
 * Première variable d'environnement non vide parmi celles proposées.
 *
 * Supabase migre son système de clés : les projets récents reçoivent
 * `SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY(S)`, les plus anciens
 * `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. Coder en dur l'un des
 * deux jeux revient à ne fonctionner que sur la moitié des projets — et à
 * échouer silencieusement sur l'autre, ce qui est exactement ce qui s'est
 * produit ici.
 */
function firstEnv(...names: string[]): string | undefined {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * `SUPABASE_SECRET_KEYS` est au pluriel : la rotation de clés en autorise
 * plusieurs, séparées par des virgules. La première active fait foi.
 */
function secretKey(): string | undefined {
  const single = firstEnv('SUPABASE_SECRET_KEY');
  if (single) return single;
  const list = Deno.env.get('SUPABASE_SECRET_KEYS');
  const first = list?.split(',').map(v => v.trim()).filter(Boolean)[0];
  return first ?? firstEnv('SUPABASE_SERVICE_ROLE_KEY');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const SUPABASE_URL = firstEnv('SUPABASE_URL');
  const SECRET = secretKey();
  const PUBLISHABLE = firstEnv('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
  // RESEND_API_KEY et MAIL_FROM ne servent plus qu'a la ligne de diagnostic
  // ci-dessous : l'envoi lui-meme les relit dans _shared/email.ts, seul
  // endroit ou la cle est manipulee.
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'YakaRDC <onboarding@resend.dev>';
  const APP_URL = Deno.env.get('APP_URL') ?? 'https://yakardc.app';

  // Une clé manquante donnait un client cassé, puis un 401 muet qui laissait
  // croire à un problème d'authentification. On le dit franchement, en
  // signalant quelles clés sont présentes — jamais leur valeur.
  if (!SUPABASE_URL || !PUBLISHABLE || !SECRET) {
    return json({
      error: "Configuration incomplète : la fonction n'a pas toutes ses clés.",
      detail: {
        SUPABASE_URL: SUPABASE_URL ? 'présente' : 'ABSENTE',
        cle_publique: PUBLISHABLE
          ? 'présente'
          : 'ABSENTE — attendue dans SUPABASE_PUBLISHABLE_KEY ou SUPABASE_ANON_KEY',
        cle_secrete: SECRET
          ? 'présente'
          : 'ABSENTE — attendue dans SUPABASE_SECRET_KEY, SUPABASE_SECRET_KEYS ou SUPABASE_SERVICE_ROLE_KEY',
      },
    }, 500);
  }

  log('config', {
    url: !!SUPABASE_URL,
    publiable: !!PUBLISHABLE,
    secrete: !!SECRET,
    resend: !!RESEND_API_KEY,
    mail_from: MAIL_FROM,
  });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentification requise.' }, 401);

    // ── 1. L'appelant est-il administrateur ? ────────────────────────────
    // Vérifié avec SON jeton, pas avec la clé de service : la question est
    // « qui appelle », pas « que peut faire le serveur ».
    //
    // On interroge le serveur d'authentification DIRECTEMENT, sans passer par
    // supabase-js. Ce projet signe les jetons utilisateur en ES256 (clés
    // asymétriques) ; les versions récentes de la bibliothèque tentent alors
    // une vérification locale via JWKS, qui échoue dans cet environnement et
    // renvoie un « pas d'utilisateur » indiscernable d'un vrai refus.
    // Un simple appel REST ne dépend d'aucune version et donne un statut et
    // un corps exploitables quand il échoue.
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: PUBLISHABLE },
    });

    if (!authRes.ok) {
      return json({
        error: 'Session invalide.',
        detail: `Le serveur d'authentification a répondu ${authRes.status} : ${(await authRes.text()).slice(0, 200)}`,
      }, 401);
    }

    const caller = await authRes.json() as { id?: string; email?: string };
    if (!caller?.id) {
      return json({
        error: 'Session invalide.',
        detail: "Le jeton est accepté mais ne désigne aucun utilisateur.",
      }, 401);
    }

    log('appelant', caller.id, caller.email);
    const admin = createClient(SUPABASE_URL, SECRET);

    const { data: callerProfile, error: profileError } = await admin
      .from('profiles').select('role').eq('id', caller.id).maybeSingle();
    if (profileError) {
      return json({
        error: "Impossible de vérifier votre rôle.",
        detail: profileError.message,
      }, 500);
    }
    if (callerProfile?.role !== 'admin') {
      return json({
        error: 'Réservé aux administrateurs.',
        detail: `Rôle du compte ${caller.id} : ${callerProfile?.role ?? 'aucun profil trouvé'}.`,
      }, 403);
    }

    const { request_id } = await req.json();
    if (!request_id) return json({ error: 'request_id manquant.' }, 400);
    log('demande', request_id);

    // ── 2. La demande ────────────────────────────────────────────────────
    const { data: request, error: reqError } = await admin
      .from('partner_requests').select('*').eq('id', request_id).single();
    if (reqError || !request) return json({ error: 'Demande introuvable.' }, 404);
    if (request.status === 'approved') {
      return json({ error: 'Cette demande a déjà été approuvée.' }, 409);
    }

    const email = (request.contact_email ?? '').trim().toLowerCase();
    if (!email) {
      return json({
        error: "Cette demande n'a pas d'adresse email : impossible de créer un compte ni d'envoyer les identifiants.",
      }, 422);
    }

    // ── 3. Le compte ─────────────────────────────────────────────────────
    let ownerId = request.user_id as string | null;
    let password: string | null = null;

    if (!ownerId) {
      // Un compte existe peut-être déjà avec cet email — le demandeur s'était
      // inscrit avant. On le réutilise SANS toucher à son mot de passe :
      // réinitialiser celui de quelqu'un qui n'a rien demandé serait abusif.
      const { data: existing } = await admin
        .from('profiles').select('id').eq('email', email).maybeSingle();

      if (existing) {
        ownerId = existing.id;
      } else {
        password = generatePassword();
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // pas de double validation : l'admin a déjà validé
          user_metadata: {
            full_name: request.contact_name,
            // L'app s'appuie dessus pour imposer le changement à la connexion.
            must_change_password: true,
          },
        });
        if (createError || !created?.user) {
          return json({
            error: 'Création du compte impossible.',
            detail: `${createError?.message ?? 'aucun utilisateur renvoyé'} (email : ${email})`,
          }, 500);
        }
        ownerId = created.user.id;
        log('compte cree', ownerId, '(mot de passe genere, non consigne)');

        await admin.from('profiles').upsert({
          id: ownerId,
          email,
          full_name: request.contact_name,
          phone: request.contact_phone,
          role: 'traveler', // approve_partner_request le passera à partner
        });
      }

      await admin.from('partner_requests').update({ user_id: ownerId }).eq('id', request_id);
    }

    // ── 4. La logique métier reste en base ───────────────────────────────
    log('appel approve_partner_request', { request_id, owner: ownerId });
    const { data: establishmentId, error: rpcError } = await admin.rpc(
      'approve_partner_request',
      { p_request_id: request_id, p_admin_id: caller.id },
    );
    if (rpcError) {
      return json({
        error: "La création de l'établissement a échoué.",
        detail: `${rpcError.message}${rpcError.hint ? ' — ' + rpcError.hint : ''} (code ${rpcError.code ?? '?'})`,
      }, 500);
    }
    log('etablissement cree', establishmentId);

    // ── 5. L'email ───────────────────────────────────────────────────────
    // Envoyé en dernier : l'approbation ne doit pas échouer parce que le
    // service d'envoi est indisponible. On signale l'échec sans annuler.
    let emailSent = false;
    let emailError: string | null = null;

    if (!password) {
      emailError = "Le partenaire avait déjà un compte : aucun mot de passe n'a été envoyé.";
    } else {
      const mail = welcomeEmail({
        establishmentName: request.establishment_name,
        contactName: request.contact_name,
        email,
        password,
        appUrl: APP_URL,
      });
      const result = await sendEmail({ to: email, subject: mail.subject, html: mail.html });
      emailSent = result.sent;
      emailError = result.error;
      log(result.sent ? 'email envoye a' : 'envoi refuse', result.sent ? email : result.error);
    }

    return json({
      establishment_id: establishmentId,
      owner_id: ownerId,
      account_created: password !== null,
      email_sent: emailSent,
      email_error: emailError,
      // Filet de secours : quand l'email n'est pas parti, le partenaire a un
      // compte auquel il ne peut pas accéder. Le mot de passe est alors rendu
      // à l'administrateur — lui seul, il vient d'approuver — pour qu'il le
      // transmette. Jamais renvoyé quand l'email est bien parti : il n'aurait
      // aucune raison de circuler une seconde fois.
      temporary_password: !emailSent && password ? password : undefined,
    });
  } catch (e) {
    // La pile est renvoyée : sans elle, une erreur ici reste indéchiffrable
    // depuis l'app, et les logs Supabase ne montrent qu'un code de statut.
    return json({
      error: e instanceof Error ? e.message : 'Erreur inattendue.',
      detail: e instanceof Error ? e.stack?.split('\n').slice(0, 4).join(' | ') : String(e),
    }, 500);
  }
});
