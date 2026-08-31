import type { OpeningHours } from './opening-hours';
import type { TimeSlot } from './booking-slots';
import type { EstablishmentOffer, OfferCategory } from './types';

/**
 * Contrats partagés entre la fiche d'établissement et ses formulaires de
 * réservation.
 *
 * Ces définitions vivaient au milieu de app/listing/[id].tsx, entre les
 * fonctions utilitaires et les composants. Elles décrivent ce que l'écran
 * parent transmet aux formulaires — c'est-à-dire une frontière, et une
 * frontière gagne à être lisible d'un seul endroit plutôt que noyée dans un
 * fichier de deux mille lignes.
 *
 * Rien ici n'existe à l'exécution : ce sont des types, plus quatre constantes
 * de données. Aucun comportement n'est déplacé.
 */

/** Disponibilités transmises aux formulaires de réservation. */
export interface Availability {
  fullDays: Set<string>;
  /**
   * Charge par créneau, tous services confondus. Conservée pour le seul
   * `establishment_slot_load`, qui alimente encore le compteur global — la
   * disponibilité qui compte, elle, est calculée par offre.
   */
  slotLoads: Record<string, number>;
  /** Jours où l'établissement est fermé — à ne pas confondre avec complet. */
  closedDays: Set<string>;
}

/**
 * Ce qu'un formulaire doit savoir du lieu au-delà des offres : ses horaires,
 * et de quoi consulter sa carte sans quitter la réservation.
 */
export interface VenueContext {
  openingHours: OpeningHours | null;
}

/**
 * Contexte des offres, passé aux formulaires : ils ont besoin de la liste, des
 * photos, et du calcul de disponibilité, tous détenus par l'écran parent.
 */
export interface OfferContext {
  offers: EstablishmentOffer[];
  categoryOf: (o: EstablishmentOffer) => OfferCategory | undefined;
  photoOf: (offerId: string) => string | null;
  remainingFor: (o: EstablishmentOffer, days: string[]) => number | null;
  /**
   * Restant sur un créneau précis. Pour un restaurant ou un site, `quantity`
   * compte des places PAR CRÉNEAU : la comparer à la charge de toute la
   * journée afficherait « complet » bien avant que ce soit vrai.
   * `null` = inconnu (offre sans limite, ou créneau pas encore choisi).
   */
  remainingForSlot: (o: EstablishmentOffer, date: string, slot: string) => number | null;
  fullDaysFor: (o: EstablishmentOffer | null) => Set<string>;
  closedDays: Set<string>;
  nightsBetween: (checkIn: string, checkOut: string) => string[];
}

export interface BaseForm {
  /** Offre choisie. Vide tant que l'étape de choix n'est pas franchie. */
  offerId: string;
  firstName: string; lastName: string;
  // Postnom — convention congolaise (prénom + nom + postnom). Facultatif :
  // un voyageur étranger n'en a pas, bloquer l'envoi pour ça serait absurde.
  postName: string;
  // Indicatif séparé du numéro : beaucoup de réservations sont faites depuis
  // la diaspora, un champ supposant le +243 les exclurait.
  phoneDial: string; phone: string;
  email: string;
  adults: number; children: number; notes: string;
}

export interface HotelForm extends BaseForm {
  checkIn: string; checkOut: string;
  // Heure d'arrivée — hôtel et maison meublée uniquement. Pour un restaurant
  // ou un site, le créneau EST déjà l'heure d'arrivée. Pour une maison sans
  // réception, le propriétaire doit être là pour remettre les clés.
  arrivalTime: string;
  paymentMethod: 'cash' | 'mobile_money' | 'card';
}

export interface RestaurantForm extends BaseForm {
  visitDate: string; timeSlot: TimeSlot;
  occasion: 'none' | 'birthday' | 'business' | 'romantic' | 'other';
  allergies: string;
}

export interface SiteForm extends BaseForm {
  visitDate: string; timeSlot: TimeSlot;
  // Panier : quantité par offre de billet. offerId de BaseForm n'est pas
  // utilisé ici — une visite peut mêler plusieurs types d'entrée.
  cart: Record<string, number>;
  visitType: 'guided' | 'free';
  nationality: 'congolaise' | 'etrangere';
}

// Pas de découpage des créneaux. Un restaurant se réserve à la demi-heure ;
// un site touristique se visite par tranches, l'heure suffit.
export const RESTAURANT_SLOT_STEP_MIN = 30;
export const SITE_SLOT_STEP_MIN = 60;

export const OCCASIONS = [
  { key: 'none', label: 'Aucune' },
  { key: 'birthday', label: 'Anniversaire' },
  { key: 'business', label: 'Business' },
  { key: 'romantic', label: 'Romantique' },
  { key: 'other', label: 'Autre' },
];

export const PAYMENTS = [
  { key: 'cash', label: 'Sur place' },
  { key: 'mobile_money', label: 'Mobile money' },
  { key: 'card', label: 'Carte' },
];
