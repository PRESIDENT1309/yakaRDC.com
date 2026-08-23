/**
 * Créneaux horaires : format d'affichage ↔ format Postgres.
 *
 * L'app affiche « 19h30 » — la convention française, celle qu'attend un
 * utilisateur congolais. La colonne `bookings.visit_time` est de type `time`
 * et n'accepte que « 19:30 ». Écrire le libellé tel quel faisait échouer
 * l'insertion avec `invalid input syntax for type time`, ce qui rendait toute
 * réservation de restaurant et de site impossible.
 *
 * Ces deux fonctions sont le seul point de traduction entre les deux mondes :
 * rien d'autre ne doit manipuler ces chaînes à la main.
 */

/** « 19h30 » → « 19:30 ». Renvoie null si la chaîne est vide ou illisible. */
export function slotToTime(slot: string): string | null {
  const m = slot.trim().match(/^(\d{1,2})\s*h\s*(\d{0,2})$/i);
  if (!m) {
    // Déjà au format Postgres ? On laisse passer plutôt que de perdre la donnée.
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(slot.trim()) ? slot.trim() : null;
  }
  const h = m[1].padStart(2, '0');
  const min = (m[2] || '00').padEnd(2, '0');
  return `${h}:${min}`;
}

/** « 19:30:00 » → « 19h30 ». Sert à l'affichage et aux clés de disponibilité. */
export function timeToSlot(time: string | null | undefined): string {
  if (!time) return '';
  const m = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return time.trim();
  return `${m[1].padStart(2, '0')}h${m[2]}`;
}
