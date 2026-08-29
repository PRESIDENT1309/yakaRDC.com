// Accusé de réception d'une demande de partenariat.
//
// POURQUOI UNE FONCTION
// L'envoi exige la clé Resend, qui ne peut pas vivre dans l'application, et la
// lecture de la demande exige de contourner les politiques d'accès : un
// déposant anonyme ne peut pas relire sa propre demande. Les deux imposent le
// serveur.
//
// POURQUOI ELLE EST OUVERTE AUX ANONYMES
// Un restaurateur dépose sa demande sans compte — c'est le parcours retenu.
// Exiger une authentification ici reviendrait à n'envoyer l'accusé qu'à ceux
// qui n'en ont pas besoin.
//
// CE QUI EMPÊCHE D'EN FAIRE UNE MACHINE À SPAM
//   * elle n'envoie qu'à l'adresse inscrite SUR la demande, jamais à une
//     adresse fournie par l'appelant ;
//   * `confirmation_sent_at` rend l'appel idempotent : rejouer le même
//     identifiant n'envoie rien une seconde fois ;
//   * il faut connaître un identifiant de demande, non devinable.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail, layout, notice } from '../_shared/email.ts';
import { keyKind, firstEnv, secretKey, publishableKey } from '../_shared/keys.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const log = (...parts: unknown[]) => console.log('[notify-partner-request]', ...parts);

const json = (body: unknown, status = 200) => {
  if (status >= 400) log('ECHEC', status, JSON.stringify(body).slice(0, 400));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
};

const TYPE_LABELS: Record<string, string> = {
  hotel: 'Hôtel',
  furnished_house: 'Maison meublée',
  restaurant: 'Restaurant',
  site: 'Site touristique',
};

function confirmationEmail(r: {
  establishment_name: string;
  establishment_type: string;
  contact_name: string;
  city: string;
  commune: string | null;
  contact_phone: string;
}) {
  const lieu = [r.commune, r.city].filter(Boolean).join(' · ');
  return {
    subject: `Demande reçue — ${r.establishment_name}`,
    html: layout({
      title: 'Demande bien reçue',
      body: `
<p>Bonjour ${r.contact_name},</p>
<p>
  Nous avons bien reçu votre demande de partenariat pour
  <strong>${r.establishment_name}</strong>. Notre équipe l'examine et vous
  répond sous 48 heures.
</p>
<div style="background:#FAF8F4;border:1px solid #E7E2DA;border-radius:10px;padding:16px;margin:16px 0">
  <div style="font-size:12px;color:#8A857D">Établissement</div>
  <div style="font-size:15px;font-weight:600;margin-bottom:10px">${r.establishment_name}</div>
  <div style="font-size:12px;color:#8A857D">Type</div>
  <div style="font-size:14px;margin-bottom:10px">${TYPE_LABELS[r.establishment_type] ?? r.establishment_type}</div>
  <div style="font-size:12px;color:#8A857D">Localisation</div>
  <div style="font-size:14px;margin-bottom:10px">${lieu}</div>
  <div style="font-size:12px;color:#8A857D">Téléphone</div>
  <div style="font-size:14px">${r.contact_phone}</div>
</div>
${notice("Une erreur dans ces informations ? Répondez simplement à cet email, nous corrigerons avant l'examen.")}
<p style="font-size:13px;color:#8A857D">
  Vous n'avez pas encore de compte : il sera créé automatiquement si votre
  demande est acceptée, et vous recevrez vos identifiants par email.
</p>`.trim(),
    }),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const SUPABASE_URL = firstEnv('SUPABASE_URL');
  const secret = secretKey();
  const SECRET = secret.value;

  if (!SUPABASE_URL || !SECRET) {
    return json({
      error: "Configuration incomplète : la fonction n'a pas toutes ses clés.",
      detail: {
        SUPABASE_URL: SUPABASE_URL ? 'présente' : 'ABSENTE',
        cle_secrete: SECRET ? 'présente' : 'AUCUNE EXPLOITABLE',
        variables_trouvees: secret.found,
      },
    }, 500);
  }

  try {
    const { request_id } = await req.json();
    if (!request_id) return json({ error: 'request_id manquant.' }, 400);

    log('config', { secrete: keyKind(SECRET), source: secret.source });
    const admin = createClient(SUPABASE_URL, SECRET);
    const { data: request, error } = await admin
      .from('partner_requests').select('*').eq('id', request_id).single();

    if (error || !request) {
      // Une demande « introuvable » a deux causes très différentes : elle
      // n'existe pas, ou la clé employée ne permet pas de la voir. Les
      // confondre a coûté un long détour — on les sépare.
      return json({
        error: 'Demande introuvable.',
        detail: `Clé utilisée : ${secret.source} — ${keyKind(SECRET)}. ` +
          `Variables trouvées : ${secret.found.join(' | ')}. ` +
          "Si cette clé n'est pas secrète, la lecture s'effectue sous les " +
          "politiques d'accès et la demande reste invisible même si elle existe. " +
          (error ? `Erreur : ${error.message}` : 'Aucune ligne renvoyée.'),
      }, 404);
    }

    // Déjà notifiée : on répond succès sans réémettre. Rejouer un appel ne
    // doit pas produire un second email.
    if (request.confirmation_sent_at) {
      log('deja notifiee', request_id);
      return json({ sent: false, already_sent: true });
    }

    const to = (request.contact_email ?? '').trim().toLowerCase();
    if (!to) {
      // Pas une erreur : l'email est facultatif côté formulaire pour les
      // demandeurs qui n'en ont pas. Il n'y a simplement rien à envoyer.
      log('aucune adresse sur la demande', request_id);
      return json({ sent: false, reason: 'aucune adresse email sur la demande' });
    }

    const mail = confirmationEmail(request);
    const result = await sendEmail({ to, subject: mail.subject, html: mail.html });

    if (result.sent) {
      // Marqué APRÈS l'envoi : marquer avant priverait d'un second essai en
      // cas d'échec.
      await admin.from('partner_requests')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', request_id);
      log('accuse envoye a', to);
    } else {
      log('envoi refuse', result.error);
    }

    return json({ sent: result.sent, error: result.error });
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : 'Erreur inattendue.',
      detail: e instanceof Error ? e.stack?.split('\n').slice(0, 4).join(' | ') : String(e),
    }, 500);
  }
});
