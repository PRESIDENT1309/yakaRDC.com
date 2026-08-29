// Demande de réinitialisation de mot de passe.
//
// POURQUOI NOTRE PROPRE ENVOI PLUTÔT QUE `resetPasswordForEmail`
// L'appel intégré de Supabase passe par son SMTP, plafonné à quelques envois
// par heure tant qu'un serveur personnalisé n'est pas configuré — et l'email
// ne ressemble alors à aucun des deux autres que reçoit un partenaire. Ici on
// génère le lien avec l'API Admin et on l'envoie par Resend, déjà en service.
//
// CE QUI EST DÉLIBÉRÉ
//   * la réponse est TOUJOURS un succès, que le compte existe ou non. Dire
//     « cette adresse est inconnue » transformerait ce formulaire en outil
//     pour savoir qui a un compte chez vous ;
//   * la fonction est ouverte aux anonymes : quelqu'un qui a perdu son mot de
//     passe ne peut évidemment pas s'authentifier ;
//   * aucune trace du lien dans les journaux — il vaut connexion.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendEmail, layout, button, notice } from '../_shared/email.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const log = (...parts: unknown[]) => console.log('[request-password-reset]', ...parts);

const json = (body: unknown, status = 200) => {
  if (status >= 400) log('ECHEC', status, JSON.stringify(body).slice(0, 300));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
};

function keyKind(v: string | undefined): string {
  if (!v) return 'ABSENTE';
  if (v.startsWith('sb_secret_')) return 'secrete (sb_secret_)';
  if (v.startsWith('sb_publishable_')) return 'PUBLIABLE — insuffisante';
  if (v.startsWith('eyJ')) {
    try {
      const role = JSON.parse(atob(v.split('.')[1])).role;
      return `JWT herite, role ${role}` + (role === 'service_role' ? '' : ' — insuffisante');
    } catch { return 'JWT illisible'; }
  }
  return 'forme inconnue';
}

function firstEnv(...names: string[]): string | undefined {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/** Voir approve-partner : une clé présente n'est pas une clé valable. */
function looksUsable(v: string): boolean {
  if (v.startsWith('sb_secret_')) return true;
  if (v.startsWith('eyJ')) {
    try { return JSON.parse(atob(v.split('.')[1])).role === 'service_role'; } catch { return false; }
  }
  return false;
}

function secretKeyWithSource(): { value?: string; source: string; found: string[] } {
  const candidates: { value: string; source: string }[] = [];
  const add = (name: string) => {
    const v = Deno.env.get(name)?.trim();
    if (v) candidates.push({ value: v, source: name });
  };
  add('SUPABASE_SECRET_KEY');
  add('SUPABASE_SERVICE_ROLE_KEY');
  const list = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (list) {
    list.split(',').map(v => v.trim()).filter(Boolean).forEach((value, i) => {
      candidates.push({ value, source: `SUPABASE_SECRET_KEYS[${i}]` });
    });
  }
  const found = candidates.map(c => `${c.source} : ${keyKind(c.value)}`);
  const usable = candidates.find(c => looksUsable(c.value));
  return usable
    ? { value: usable.value, source: usable.source, found }
    : { source: 'aucune clé secrète exploitable', found };
}

function resetEmail(params: { lien: string; email: string }) {
  return {
    subject: 'Réinitialiser votre mot de passe YakaRDC',
    html: layout({
      title: 'Nouveau mot de passe',
      body: `
<p>Bonjour,</p>
<p>
  Une réinitialisation du mot de passe a été demandée pour
  <strong>${params.email}</strong>. Le lien ci-dessous vous permet d'en
  choisir un nouveau.
</p>
${button(params.lien, 'Choisir un nouveau mot de passe')}
${notice("Ce lien expire dans une heure et ne fonctionne qu'une fois.")}
<p style="font-size:13px;color:#8A857D">
  Vous n'avez rien demandé ? Ignorez cet email : votre mot de passe actuel
  reste valable, et personne n'a eu accès à votre compte.
</p>`.trim(),
    }),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const SUPABASE_URL = firstEnv('SUPABASE_URL');
  const secret = secretKeyWithSource();
  const SECRET = secret.value;
  const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.yakardc.com';

  if (!SUPABASE_URL || !SECRET) {
    return json({
      error: "Configuration incomplète : la fonction n'a pas toutes ses clés.",
      detail: { SUPABASE_URL: SUPABASE_URL ? 'présente' : 'ABSENTE', variables_trouvees: secret.found },
    }, 500);
  }

  try {
    const { email } = await req.json();
    const adresse = (email ?? '').trim().toLowerCase();
    if (!adresse) return json({ error: 'Adresse email manquante.' }, 400);

    const admin = createClient(SUPABASE_URL, SECRET);

    // `generateLink` échoue si le compte n'existe pas. On ne le dit jamais à
    // l'appelant : la réponse reste identique dans les deux cas.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: adresse,
      options: { redirectTo: `${APP_URL}/reset-password` },
    });

    if (error || !data?.properties?.action_link) {
      log('aucun lien pour cette adresse', error?.message ?? 'compte inexistant');
      return json({ sent: true });
    }

    const mail = resetEmail({ lien: data.properties.action_link, email: adresse });
    const result = await sendEmail({ to: adresse, subject: mail.subject, html: mail.html });

    // On consigne le résultat de l'envoi, jamais le lien : il vaut connexion.
    log(result.sent ? 'email envoye' : 'envoi refuse', result.sent ? '' : result.error);

    return json({ sent: true, email_error: result.error });
  } catch (e) {
    return json({
      error: e instanceof Error ? e.message : 'Erreur inattendue.',
      detail: e instanceof Error ? e.stack?.split('\n').slice(0, 4).join(' | ') : String(e),
    }, 500);
  }
});
