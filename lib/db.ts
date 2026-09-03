import { Alert } from './alert';

/**
 * Écritures en base dont l'échec ne doit pas passer inaperçu.
 *
 * Le défaut que cet outil existe pour empêcher : une écriture lancée sans
 * regarder son résultat, suivie d'une mise à jour de l'écran. L'utilisateur
 * voit alors une réussite qui n'a pas eu lieu — sa photo disparaît de la
 * grille mais reste en base, sa réservation semble annulée mais ne l'est pas.
 * Le mensonge ne se découvre qu'au rechargement suivant, longtemps après.
 *
 * Un audit du 31/08/2026 a relevé 53 écritures dans ce cas. 27 étaient sans
 * conséquence — l'écran relisait les données juste après, et l'échec se
 * corrigeait tout seul. Les 26 autres mettaient l'écran à jour sans relire.
 *
 * L'outil ne masque rien : il retourne `false` en cas d'échec, à charge de
 * l'appelant de ne pas poursuivre comme si de rien n'était.
 */

type Resultat = { error: { message?: string; code?: string; hint?: string | null } | null };

/** Rend une erreur PostgREST lisible : message, plus le code quand il éclaire. */
export function messageBase(e: Resultat['error']): string {
  if (!e) return 'erreur inconnue';
  const bouts: string[] = [];
  if (e.message?.trim()) bouts.push(e.message.trim());
  if (e.hint) bouts.push(e.hint);
  // 42501 = violation de politique RLS. Sans cette précision, le message brut
  // de Postgres ne dit pas que c'est une question de droits.
  if (e.code === '42501') bouts.push("(droits insuffisants sur cette donnée)");
  else if (e.code) bouts.push(`(code ${e.code})`);
  return bouts.join(' ') || 'le serveur a refusé sans expliquer pourquoi';
}

/**
 * Exécute une écriture et signale son échec à l'utilisateur.
 *
 * @param requete  l'appel Supabase, non attendu — `supabase.from(…).delete()…`
 * @param action   ce que l'utilisateur croyait faire, à la première personne
 *                 du point de vue de l'app : « Suppression de la photo »
 * @returns        true si l'écriture a abouti
 *
 * Usage :
 *   if (!await ecrire(supabase.from('favorites').delete().eq('id', id),
 *                     'Retrait du favori')) return;
 *   setFavoris(prev => prev.filter(f => f.id !== id));
 */
export async function ecrire(
  requete: PromiseLike<Resultat>,
  action: string,
): Promise<boolean> {
  const { error } = await requete;
  if (!error) return true;
  Alert.alert(`${action} — échec`, messageBase(error));
  return false;
}
