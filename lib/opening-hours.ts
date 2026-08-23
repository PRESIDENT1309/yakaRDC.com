// Horaires d'ouverture — lecture et calcul d'état.
//
// Le calcul se fait TOUJOURS sur l'heure de Kinshasa (UTC+1, sans changement
// saisonnier), jamais sur le fuseau de l'appareil : un utilisateur de la
// diaspora verrait sinon « Fermé » sur un établissement ouvert.
//
// Module volontairement pur (aucun import React/Supabase) pour rester
// testable isolément — les cas limites sont les minuits traversés et les
// jours fermés consécutifs.

export const KINSHASA_UTC_OFFSET_MIN = 60;

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  from: string; // "HH:MM"
  to: string;   // "HH:MM"
}

export interface OpeningHours {
  always_open: boolean;
  // Un jour absent ou à null = fermé ce jour-là.
  days: Partial<Record<DayKey, DayHours | null>>;
}

export type OpeningState = 'open' | 'closing_soon' | 'closed';

export interface OpeningStatus {
  state: OpeningState;
  label: string;
}

// Index 0 = dimanche, pour coller à Date.getDay()
const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES: Record<DayKey, string> = {
  mon: 'lundi', tue: 'mardi', wed: 'mercredi', thu: 'jeudi',
  fri: 'vendredi', sat: 'samedi', sun: 'dimanche',
};

const MINUTES_PER_DAY = 24 * 60;
// En deçà de ce délai avant fermeture, on prévient l'utilisateur.
const CLOSING_SOON_MIN = 30;

/** Heure murale de Kinshasa, quel que soit le fuseau de l'appareil. */
export function kinshasaNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + KINSHASA_UTC_OFFSET_MIN * 60000);
}

/** "HH:MM" → minutes depuis minuit. null si la valeur est mal formée. */
function parseTime(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v?.trim() ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutes → "8h00" (sans zéro initial, comme à l'oral). */
export function formatTime(minutes: number): string {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

function dayAt(offset: number, todayIndex: number): DayKey {
  return DAY_KEYS[(todayIndex + offset + 7) % 7];
}

function hoursFor(oh: OpeningHours, key: DayKey): { from: number; to: number } | null {
  const d = oh.days?.[key];
  if (!d) return null;
  const from = parseTime(d.from);
  const to = parseTime(d.to);
  if (from == null || to == null) return null;
  return { from, to };
}

/**
 * État d'ouverture à l'instant donné.
 * Renvoie null si aucune donnée exploitable — l'appelant n'affiche alors
 * rien du tout, plutôt qu'un « Fermé » par défaut qui serait un mensonge.
 */
export function getOpeningStatus(oh: OpeningHours | null | undefined, now: Date = new Date()): OpeningStatus | null {
  if (!oh) return null;
  if (oh.always_open) return { state: 'open', label: 'Ouvert 24h/24' };
  if (!oh.days || Object.keys(oh.days).length === 0) return null;

  // Au moins un jour doit être exploitable, sinon la colonne est vide de fait.
  const hasAny = DAY_KEYS.some(k => hoursFor(oh, k) !== null);
  if (!hasAny) return null;

  const kin = kinshasaNow(now);
  const todayIndex = kin.getDay();
  const nowMin = kin.getHours() * 60 + kin.getMinutes();

  // 1. Créneau de la veille qui déborde après minuit (ex. 19:00 → 02:00) :
  //    à 01h00 aujourd'hui, l'établissement est encore ouvert.
  const yesterday = hoursFor(oh, dayAt(-1, todayIndex));
  if (yesterday && yesterday.to <= yesterday.from && nowMin < yesterday.to) {
    return openLabel(yesterday.to - nowMin, yesterday.to);
  }

  // 2. Créneau du jour
  const today = hoursFor(oh, dayAt(0, todayIndex));
  if (today) {
    const overnight = today.to <= today.from;
    if (overnight) {
      // Ferme le lendemain : la durée restante traverse minuit.
      if (nowMin >= today.from) {
        return openLabel(today.to + MINUTES_PER_DAY - nowMin, today.to);
      }
    } else if (nowMin >= today.from && nowMin < today.to) {
      return openLabel(today.to - nowMin, today.to);
    }
    // Pas encore ouvert aujourd'hui
    if (nowMin < today.from) {
      return { state: 'closed', label: `Fermé · ouvre à ${formatTime(today.from)}` };
    }
  }

  // 3. Fermé : on cherche la prochaine ouverture, jusqu'à une semaine.
  for (let offset = 1; offset <= 7; offset++) {
    const key = dayAt(offset, todayIndex);
    const next = hoursFor(oh, key);
    if (!next) continue;
    const when = offset === 1 ? 'demain' : DAY_NAMES[key];
    return { state: 'closed', label: `Fermé · ouvre ${when} à ${formatTime(next.from)}` };
  }

  return { state: 'closed', label: 'Fermé' };
}

function openLabel(minutesLeft: number, closesAt: number): OpeningStatus {
  if (minutesLeft <= CLOSING_SOON_MIN) {
    return { state: 'closing_soon', label: `Ferme bientôt · dans ${minutesLeft} min` };
  }
  return { state: 'open', label: `Ouvert · ferme à ${formatTime(closesAt)}` };
}

// ═══════════════════════════════════════════
// Créneaux réservables
// ═══════════════════════════════════════════
//
// Les créneaux étaient jusqu'ici une liste en dur, identique pour tous les
// établissements du pays : un restaurant ouvert 24h/24 proposait exactement
// les mêmes sept horaires qu'un autre ouvert de midi à minuit six jours sur
// sept. Ils découlent désormais des horaires publiés par l'établissement.
//
// Conséquence assumée : sans horaires publiés, aucun créneau n'est proposé.
// Inventer une plage par défaut reviendrait à promettre au voyageur une
// disponibilité que personne n'a déclarée.

/** Jour de la semaine d'une date ISO, sans passer par le fuseau local. */
export function dayKeyOf(iso: string): DayKey | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso?.trim() ?? '');
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return DAY_KEYS[d.getUTCDay()];
}

/**
 * L'établissement est-il ouvert ce jour-là ?
 * `null` = on ne sait pas (aucun horaire publié) — à ne pas confondre avec
 * `false`, qui affirme une fermeture.
 */
export function isOpenOn(oh: OpeningHours | null | undefined, iso: string): boolean | null {
  if (!oh) return null;
  if (oh.always_open) return true;
  if (!oh.days || Object.keys(oh.days).length === 0) return null;
  if (!DAY_KEYS.some(k => hoursFor(oh, k) !== null)) return null;

  const key = dayKeyOf(iso);
  if (!key) return null;
  return hoursFor(oh, key) !== null;
}

/**
 * Créneaux réservables un jour donné, au format d'affichage (« 19h30 »).
 *
 * `stepMin` est le pas : 30 min pour un restaurant, 60 pour un site — un
 * site touristique se visite par tranches, pas au quart d'heure.
 *
 * Le dernier créneau est écarté quand il tombe sur l'heure de fermeture :
 * réserver une table à l'instant où le restaurant ferme n'a pas de sens.
 * Une plage qui traverse minuit (18:00 → 02:00) est déroulée jusqu'au bout.
 *
 * Renvoie [] si l'établissement est fermé ce jour-là OU si rien n'est publié.
 * L'appelant distingue les deux cas avec `isOpenOn`.
 */
export function slotsForDay(
  oh: OpeningHours | null | undefined,
  iso: string,
  stepMin: number,
): string[] {
  if (!oh) return [];

  // Ouvert 24h/24 : on déroule la journée entière au pas demandé. Le pas
  // horaire évite d'aligner 48 puces illisibles pour un restaurant.
  if (oh.always_open) {
    const step = Math.max(stepMin, 60);
    const out: string[] = [];
    for (let m = 0; m < MINUTES_PER_DAY; m += step) out.push(formatTime(m));
    return out;
  }

  const key = dayKeyOf(iso);
  if (!key) return [];
  const range = hoursFor(oh, key);
  if (!range) return [];

  // Une fermeture après minuit est notée `to < from` : on ajoute 24 h pour
  // dérouler la plage d'un seul tenant, puis `formatTime` ramène l'heure
  // dans la journée.
  const end = range.to <= range.from ? range.to + MINUTES_PER_DAY : range.to;
  const out: string[] = [];
  for (let m = range.from; m < end; m += stepMin) out.push(formatTime(m));
  return out;
}
