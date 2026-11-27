// Envoi d'emails transactionnels — socle partagé par les fonctions.
//
// Les dossiers préfixés d'un souligné ne sont pas déployés comme fonctions :
// leur contenu est embarqué dans celles qui l'importent.
//
// La clé du fournisseur et l'adresse d'expédition restent lues ici, jamais
// passées en paramètre : moins il y a d'endroits qui manipulent un secret,
// mieux c'est.
//
// ── Fournisseurs ───────────────────────────────────────────────────────────
//
// Trois services sont pris en charge, tous avec une offre gratuite :
//
//   MailerSend  secret MAILERSEND_API_KEY  (500 emails par mois)
//   Brevo       secret BREVO_API_KEY       (300 par jour)
//   Resend      secret RESEND_API_KEY      (100 par jour, 3 000 par mois)
//
// Celui dont la clé est présente est utilisé. Si plusieurs le sont, l'ordre
// ci-dessus départage, sauf si MAIL_PROVIDER en désigne un. Changer de service
// se fait donc en changeant un secret, sans toucher au code ni aux fonctions.
//
// ── Secrets ────────────────────────────────────────────────────────────────
//
//   MAIL_FROM      expéditeur, « YakaRDC <no-reply@yakardc.com> ». Le domaine
//                  doit avoir été authentifié chez le fournisseur (SPF/DKIM),
//                  sans quoi l'envoi est refusé ou finit en indésirables.
//   MAIL_REPLY_TO  facultatif : adresse qui reçoit les réponses. Utile quand
//                  l'expéditeur est une adresse « no-reply » sans boîte.
//   MAIL_PROVIDER  facultatif : « mailersend », « brevo » ou « resend ».
//   APP_URL        facultatif : adresse du site dans les liens.
//
// En local, ces valeurs se rangent dans supabase/functions/.env (ignoré par
// git) ; en ligne : supabase secrets set --env-file supabase/functions/.env

export interface SendResult {
  sent: boolean;
  error: string | null;
}

/**
 * Adresse publique de l'application, telle qu'elle apparaît dans les liens
 * envoyés par email.
 *
 * Cette valeur était lue séparément dans chaque fonction, avec des replis
 * DIFFÉRENTS : `https://yakardc.app` pour l'approbation partenaire,
 * `https://www.yakardc.com` pour la réinitialisation de mot de passe. Une
 * variable, deux vérités — et rien pour signaler la divergence. Si `APP_URL`
 * n'est pas défini dans les secrets, chaque partenaire approuvé reçoit donc un
 * lien de connexion vers un domaine qui n'est pas celui du site.
 *
 * Un seul endroit décide désormais. Le repli suit le domaine réellement
 * exploité ; `APP_URL` reste prioritaire pour les environnements de test.
 */
export function appUrl(): string {
  return (Deno.env.get('APP_URL') ?? 'https://www.yakardc.com').replace(/\/+$/, '');
}

/** Gabarit commun — bandeau lave, corps blanc, pied discret. */
export function layout(params: { title: string; body: string }): string {
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#2C2C2A">
  <div style="background:#712B13;padding:28px 24px;border-radius:14px 14px 0 0">
    <div style="color:#FAC775;font-size:13px;letter-spacing:1.5px">YAKARDC</div>
    <div style="color:#FAF8F4;font-size:22px;font-weight:600;margin-top:6px">${params.title}</div>
  </div>
  <div style="background:#FFFFFF;padding:24px;border:1px solid #E7E2DA;border-top:none;border-radius:0 0 14px 14px">
    ${params.body}
  </div>
</div>`.trim();
}

/** Bouton d'action, centré. */
export function button(href: string, label: string): string {
  return `
<p style="text-align:center;margin:24px 0">
  <a href="${href}" style="background:#712B13;color:#FAF8F4;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:600;display:inline-block">
    ${label}
  </a>
</p>`.trim();
}

/** Encadré d'avertissement, ton chaud. */
export function notice(text: string): string {
  return `<p style="background:#FAEEDA;border-radius:10px;padding:12px;font-size:13px;color:#854F0B">${text}</p>`;
}

export type Fournisseur = 'mailersend' | 'brevo' | 'resend';

/** Nom du secret qui porte la clé de chaque service, dans l'ordre de préférence. */
const SERVICES: { nom: Fournisseur; secret: string; libelle: string }[] = [
  { nom: 'mailersend', secret: 'MAILERSEND_API_KEY', libelle: 'MailerSend' },
  { nom: 'brevo', secret: 'BREVO_API_KEY', libelle: 'Brevo' },
  { nom: 'resend', secret: 'RESEND_API_KEY', libelle: 'Resend' },
];

/** Adresse de démonstration de Resend : elle ne livre qu'au titulaire du compte. */
const EXPEDITEUR_ESSAI_RESEND = 'YakaRDC <onboarding@resend.dev>';

/** Le service à utiliser, d'après les secrets présents. `null` : aucun n'est configuré. */
function fournisseur(): Fournisseur | null {
  const configures = SERVICES.filter(s => !!Deno.env.get(s.secret)).map(s => s.nom);
  const force = Deno.env.get('MAIL_PROVIDER')?.trim().toLowerCase();
  // Un MAIL_PROVIDER qui désigne un service sans clé est ignoré : mieux vaut
  // envoyer par le service configuré que ne rien envoyer du tout.
  return configures.find(nom => nom === force) ?? configures[0] ?? null;
}

/**
 * « YakaRDC <no-reply@yakardc.com> » → nom et adresse séparés.
 *
 * Resend accepte la forme complète ; MailerSend et Brevo veulent les deux
 * morceaux. Une adresse seule est acceptée aussi, le nom du site sert alors de
 * nom d'expéditeur.
 */
function decouper(expediteur: string): { name: string; email: string } | null {
  const complet = expediteur.match(/^\s*"?([^"<]*?)"?\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (complet) return { name: complet[1].trim() || 'YakaRDC', email: complet[2] };
  const seule = expediteur.trim();
  return /^[^<>\s@]+@[^<>\s@]+$/.test(seule) ? { name: 'YakaRDC', email: seule } : null;
}

/**
 * État de la configuration, pour les journaux : quel service, quel expéditeur.
 * Jamais la valeur d'une clé.
 */
export function etatEmail(): { fournisseur: Fournisseur | null; expediteur: string | null; reponse_a: string | null } {
  const service = fournisseur();
  return {
    fournisseur: service,
    expediteur: Deno.env.get('MAIL_FROM') ?? (service === 'resend' ? EXPEDITEUR_ESSAI_RESEND : null),
    reponse_a: Deno.env.get('MAIL_REPLY_TO') ?? null,
  };
}

/**
 * Envoie un email et renvoie TOUJOURS un résultat, sans jamais lever.
 *
 * Un envoi qui échoue ne doit pas faire échouer l'opération métier qui
 * l'entoure : une demande enregistrée reste enregistrée même si l'accusé de
 * réception n'est pas parti, et une approbation reste valide même sans email.
 * L'appelant décide quoi faire de l'échec — le signaler, pas l'ignorer.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const { fournisseur: service, expediteur, reponse_a } = etatEmail();

  if (!service) {
    return {
      sent: false,
      error: `Aucun service d'envoi configuré : définissez ${SERVICES.map(s => s.secret).join(', ')} (un seul suffit) dans les secrets.`,
    };
  }
  if (!expediteur) {
    // Pas de repli possible ici : une adresse d'un domaine non authentifié
    // serait refusée, et le message d'erreur parlerait de tout autre chose.
    return { sent: false, error: 'MAIL_FROM absent : indiquez l\'expéditeur, par exemple « YakaRDC <no-reply@yakardc.com> ».' };
  }

  // MailerSend et Brevo attendent le nom et l'adresse séparés.
  const sender = decouper(expediteur);
  if (service !== 'resend' && !sender) {
    return { sent: false, error: `MAIL_FROM illisible (« ${expediteur} ») : attendu « Nom <adresse@domaine> ».` };
  }
  const cle = Deno.env.get(SERVICES.find(s => s.nom === service)!.secret)!;

  try {
    let res: Response;

    if (service === 'mailersend') {
      res = await fetch('https://api.mailersend.com/v1/email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          from: sender,
          to: [{ email: params.to }],
          subject: params.subject,
          html: params.html,
          ...(reponse_a ? { reply_to: { email: reponse_a } } : {}),
        }),
      });
    } else if (service === 'brevo') {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender,
          to: [{ email: params.to }],
          subject: params.subject,
          htmlContent: params.html,
          ...(reponse_a ? { replyTo: { email: reponse_a } } : {}),
        }),
      });
    } else {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: expediteur,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          ...(reponse_a ? { reply_to: reponse_a } : {}),
        }),
      });
    }

    // MailerSend répond 202 sans corps, Brevo 201, Resend 200 : `ok` les couvre.
    if (res.ok) return { sent: true, error: null };
    return {
      sent: false,
      error: `${SERVICES.find(s => s.nom === service)!.libelle} a répondu ${res.status} : ${(await res.text()).slice(0, 300)}`,
    };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Envoi impossible.' };
  }
}
