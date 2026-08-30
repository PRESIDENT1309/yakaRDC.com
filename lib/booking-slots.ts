import { slotsForDay, isOpenOn } from './opening-hours';
import type { OpeningHours } from './opening-hours';

export type TimeSlot = string;

/**
 * Créneaux proposés un jour donné, et pourquoi il n'y en a pas.
 *
 * On distingue trois situations que l'app confondait jusqu'ici : horaires non
 * publiés, jour de fermeture, et journée ouverte. Afficher les mêmes sept
 * créneaux partout revenait à promettre une disponibilité inconnue.
 *
 * Le message fait partie du résultat, et non de l'écran : c'est lui qui porte
 * la distinction. Un appelant qui ne recevrait qu'une liste vide ne saurait pas
 * s'il doit dire « fermé ce jour-là » ou « contactez l'établissement ».
 */
export function slotStateFor(
  oh: OpeningHours | null,
  date: string,
  stepMin: number,
): { slots: TimeSlot[]; message: string | null } {
  if (!date) return { slots: [], message: "Choisissez d'abord une date." };

  const open = isOpenOn(oh, date);
  if (open === null) {
    return {
      slots: [],
      message:
        "Cet établissement n'a pas encore publié ses horaires. Contactez-le directement pour convenir d'une heure.",
    };
  }
  if (open === false) {
    return { slots: [], message: 'Fermé ce jour-là. Choisissez une autre date.' };
  }

  const slots = slotsForDay(oh, date, stepMin);
  return { slots, message: slots.length ? null : 'Aucun créneau disponible ce jour-là.' };
}
