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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

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
    html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#2C2C2A">
  <div style="background:#712B13;padding:28px 24px;border-radius:14px 14px 0 0">
    <div style="color:#FAC775;font-size:13px;letter-spacing:1.5px">YAKARDC</div>
    <div style="color:#FAF8F4;font-size:22px;font-weight:600;margin-top:6px">Félicitations !</div>
  </div>
  <div style="background:#FFFFFF;padding:24px;border:1px solid #E7E2DA;border-top:none;border-radius:0 0 14px 14px">
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
    <p style="background:#FAEEDA;border-radius:10px;padding:12px;font-size:13px;color:#854F0B">
      Ce mot de passe est provisoire. Changez-le dès votre première connexion,
      dans <strong>Profil › Mot de passe</strong>. Supprimez ensuite cet email.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="${appUrl}/login" style="background:#712B13;color:#FAF8F4;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:600;display:inline-block">
        Accéder à mon espace
      </a>
    </p>
    <p style="font-size:12px;color:#8A857D">
      Vous n'êtes pas à l'origine de cette demande ? Répondez à cet email, nous la retirerons.
    </p>
  </div>
</div>`.trim(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'YakaRDC <onboarding@resend.dev>';
  const APP_URL = Deno.env.get('APP_URL') ?? 'https://yakardc.app';

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentification requise.' }, 401);

    // ── 1. L'appelant est-il administrateur ? ────────────────────────────
    // Vérifié avec SON jeton, pas avec la clé de service : la question est
    // « qui appelle », pas « que peut faire le serveur ».
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await asCaller.auth.getUser();
    if (!caller) return json({ error: 'Session invalide.' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: callerProfile } = await admin
      .from('profiles').select('role').eq('id', caller.id).single();
    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Réservé aux administrateurs.' }, 403);
    }

    const { request_id } = await req.json();
    if (!request_id) return json({ error: 'request_id manquant.' }, 400);

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
          return json({ error: `Création du compte impossible : ${createError?.message}` }, 500);
        }
        ownerId = created.user.id;

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
    const { data: establishmentId, error: rpcError } = await admin.rpc(
      'approve_partner_request',
      { p_request_id: request_id, p_admin_id: caller.id },
    );
    if (rpcError) return json({ error: rpcError.message }, 500);

    // ── 5. L'email ───────────────────────────────────────────────────────
    // Envoyé en dernier : l'approbation ne doit pas échouer parce que le
    // service d'envoi est indisponible. On signale l'échec sans annuler.
    let emailSent = false;
    let emailError: string | null = null;

    if (!password) {
      emailError = "Le partenaire avait déjà un compte : aucun mot de passe n'a été envoyé.";
    } else if (!RESEND_API_KEY) {
      emailError = "RESEND_API_KEY absent : l'email n'a pas pu être envoyé.";
    } else {
      const mail = welcomeEmail({
        establishmentName: request.establishment_name,
        contactName: request.contact_name,
        email,
        password,
        appUrl: APP_URL,
      });
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: MAIL_FROM, to: [email], ...mail }),
      });
      if (res.ok) emailSent = true;
      else emailError = `Envoi refusé (${res.status}) : ${(await res.text()).slice(0, 200)}`;
    }

    return json({
      establishment_id: establishmentId,
      owner_id: ownerId,
      account_created: password !== null,
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erreur inattendue.' }, 500);
  }
});
