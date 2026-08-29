// Choix des clés Supabase côté serveur — socle partagé par les fonctions.
//
// Supabase migre son système de clés : les projets récents reçoivent
// `SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY(S)`, les plus anciens
// `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. Ce module accepte les
// deux jeux et, surtout, VÉRIFIE qu'une clé est exploitable avant de la
// retenir.
//
// Ce dernier point a coûté cher : `SUPABASE_SECRET_KEYS` existait sur le
// projet mais ne contenait pas une clé utilisable. La fonction la prenait
// quand même, ses lectures passaient alors sous les politiques d'accès au lieu
// de les contourner, et une demande bien présente en base ressortait
// « introuvable ». Une clé présente n'est pas une clé valable.

/**
 * Nature d'une clé, sans jamais en révéler la valeur.
 *
 * Le TYPE d'une clé n'est pas un secret : « eyJhbG » est l'en-tête de tout JWT
 * au monde, « sb_secret_ » un préfixe littéral. Savoir qu'une clé commence
 * ainsi ne permet rien — mais savoir qu'elle est PUBLIABLE là où on attendait
 * une clé secrète explique un échec en une ligne.
 */
export function keyKind(v: string | undefined): string {
  if (!v) return 'ABSENTE';
  if (v.startsWith('sb_secret_')) return 'secrete (sb_secret_)';
  if (v.startsWith('sb_publishable_')) return 'PUBLIABLE — insuffisante';
  if (v.startsWith('eyJ')) {
    try {
      const role = JSON.parse(atob(v.split('.')[1])).role;
      return `JWT herite, role ${role}` + (role === 'service_role' ? '' : ' — insuffisante');
    } catch {
      return 'JWT illisible';
    }
  }
  return 'forme inconnue';
}

/** Première variable d'environnement non vide parmi celles proposées. */
export function firstEnv(...names: string[]): string | undefined {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/** Une clé donne-t-elle réellement les droits d'une clé de service ? */
function looksUsable(v: string): boolean {
  if (v.startsWith('sb_secret_')) return true;
  if (v.startsWith('eyJ')) {
    try {
      return JSON.parse(atob(v.split('.')[1])).role === 'service_role';
    } catch {
      return false;
    }
  }
  return false;
}

export interface SecretKey {
  value?: string;
  /** Variable retenue, ou la raison de l'échec */
  source: string;
  /** Inventaire de ce qui a été trouvé, en types seulement */
  found: string[];
}

/**
 * La première clé secrète EXPLOITABLE parmi les variables disponibles.
 *
 * `SUPABASE_SECRET_KEYS` est au pluriel : la rotation en autorise plusieurs,
 * séparées par des virgules. Toutes sont examinées.
 */
export function secretKey(): SecretKey {
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

/** Clé publique, pour interroger le serveur d'authentification. */
export function publishableKey(): string | undefined {
  return firstEnv('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
}
