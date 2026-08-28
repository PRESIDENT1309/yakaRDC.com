// Envoi d'emails transactionnels — socle partagé par les fonctions.
//
// Les dossiers préfixés d'un souligné ne sont pas déployés comme fonctions :
// leur contenu est embarqué dans celles qui l'importent.
//
// La clé Resend et l'adresse d'expédition restent lues ici, jamais passées en
// paramètre : moins il y a d'endroits qui manipulent un secret, mieux c'est.

export interface SendResult {
  sent: boolean;
  error: string | null;
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
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM') ?? 'YakaRDC <onboarding@resend.dev>';

  if (!key) {
    return { sent: false, error: "RESEND_API_KEY absent : aucun email ne peut être envoyé." };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [params.to], subject: params.subject, html: params.html }),
    });
    if (res.ok) return { sent: true, error: null };
    return {
      sent: false,
      error: `Resend a répondu ${res.status} : ${(await res.text()).slice(0, 300)}`,
    };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Envoi impossible.' };
  }
}
