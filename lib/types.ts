import type { OpeningHours } from './opening-hours';

// ═══════════════════════════════════════════
// Utilisateurs
// ═══════════════════════════════════════════

export type UserRole = 'traveler' | 'partner' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

// ═══════════════════════════════════════════
// Établissements
// ═══════════════════════════════════════════

export type EstablishmentType = 'hotel' | 'furnished_house' | 'restaurant' | 'site';
export type EstablishmentStatus = 'pending' | 'approved' | 'rejected';

export interface Establishment {
  id: string;
  owner_id: string;
  type: EstablishmentType;
  name: string;
  description: string | null;
  city: string;
  neighborhood: string | null;
  commune: string | null;
  avenue: string | null;
  numero: string | null;
  reference: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  tiktok: string | null;
  logo_url: string | null;
  amenities: string[];
  status: EstablishmentStatus;
  warning_count: number;
  suspended_at: string | null;
  suspension_reason: string | null;
  discount_percent: number | null;
  discount_label: string | null;
  view_count: number;
  // Horaires d'ouverture — voir lib/opening-hours.ts pour la forme et le
  // calcul d'état. null tant que le partenaire ne les a pas saisis.
  opening_hours: OpeningHours | null;
  // Carte écrite : plats d'un restaurant, attractions d'un site (migration
  // 0010). Distincte des offres réservables — voir lib/menu.ts.
  menu: unknown | null;
  created_at: string;
}

// Photo rattachée à une offre plutôt qu'à l'établissement entier.
// Ajouté par la migration 0007 ; null = photo générale, comportement d'avant.

export type PhotoCategory = 'general' | 'menu' | 'pricing';

export interface ListingPhoto {
  id: string;
  establishment_id: string;
  url: string;
  category: PhotoCategory;
  position: number;
  /** Rattachement à une offre (migration 0007). null = photo générale. */
  offer_id: string | null;
  // Pas de created_at : la table n'a pas cette colonne (vérifié en base).
}

// ═══════════════════════════════════════════
// Catalogue d'offres
// ═══════════════════════════════════════════

export type OfferUnit = 'night' | 'person' | 'visit';

// Référentiel partagé : le partenaire pioche dedans, il n'invente pas ses
// catégories. C'est ce qui rend les offres comparables entre établissements.
export interface OfferCategory {
  id: string;
  establishment_type: EstablishmentType;
  key: string;
  label: string;
  description_hint: string | null;
  position: number;
  is_active: boolean;
}

export interface EstablishmentOffer {
  id: string;
  establishment_id: string;
  category_id: string;
  /** Nom propre à l'établissement (« Suite Fleuve ») ; sinon le label de la catégorie */
  custom_label: string | null;
  description: string | null;
  price: number;
  currency: string;
  unit: OfferUnit;
  /** Nombre d'unités de ce type (8 chambres), ou places par créneau. null = illimité */
  quantity: number | null;
  /** Capacité d'UNE unité (2 personnes par chambre). À ne pas confondre avec quantity */
  max_guests: number | null;
  amenities: string[];
  is_active: boolean;
  position: number;
  created_at: string;
}

/** Nom affiché d'une offre : le libellé propre du partenaire prime. */
export function offerLabel(offer: EstablishmentOffer, category?: OfferCategory): string {
  return offer.custom_label?.trim() || category?.label || 'Offre';
}

// Ligne de réservation. Une réservation d'hôtel en a une (la chambre choisie) ;
// un site touristique peut en avoir plusieurs (adulte + enfant + guidée).
export interface BookingItem {
  id: string;
  booking_id: string;
  offer_id: string;
  /** Nombre d'unités : des chambres pour un hôtel, des billets pour un site */
  quantity: number;
  /** Prix gelé à la réservation — donnée comptable, jamais recalculée */
  unit_price: number;
  currency: string;
  created_at: string;
}

/**
 * Nombre d'unités nécessaires pour loger un groupe dans une offre donnée.
 *
 * Choix retenu face à un groupe dépassant `max_guests` : on propose plusieurs
 * unités plutôt que de refuser. Refuser une famille de 5 dans un hôtel qui
 * dispose de huit chambres de 4 serait absurde — réserver deux chambres
 * voisines est la pratique courante. `max_guests` à null = aucune limite,
 * donc une seule unité.
 */
export function unitsNeeded(offer: EstablishmentOffer, guests: number): number {
  if (!offer.max_guests || offer.max_guests <= 0) return 1;
  return Math.max(1, Math.ceil(guests / offer.max_guests));
}

export interface EstablishmentWarning {
  id: string;
  establishment_id: string;
  issued_by: string | null;
  reason: string;
  created_at: string;
}

// ═══════════════════════════════════════════
// Réservations
// ═══════════════════════════════════════════

export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'checked_in' | 'cancelled';

export interface Booking {
  id: string;
  establishment_id: string;
  traveler_id: string;
  validated_by: string | null;
  status: BookingStatus;
  first_name: string | null;
  last_name: string | null;
  contact_phone: string | null;
  guests: number | null;
  children: number | null;
  check_in: string | null;
  check_out: string | null;
  visit_date: string | null;
  visit_time: string | null;
  notes: string | null;
  /** Motif d'annulation, renseigné quand elle vient du partenaire (migration 0008) */
  cancellation_reason: string | null;
  metadata: any;
  unique_code: string;
  qr_token: string;
  created_at: string;
}

// ═══════════════════════════════════════════
// Avis
// ═══════════════════════════════════════════

export interface Review {
  id: string;
  establishment_id: string;
  traveler_id: string;
  rating: number;
  comment: string | null;
  is_verified_stay: boolean;
  partner_reply: string | null;
  partner_replied_at: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════
// Villes
// ═══════════════════════════════════════════

export interface City {
  id: string;
  name: string;
  is_active: boolean;
  // Pas de created_at : la table n'a pas cette colonne (vérifié en base).
}

// ═══════════════════════════════════════════
// Demandes de partenariat
// ═══════════════════════════════════════════

export type PartnerRequestStatus = 'pending' | 'approved' | 'rejected';

export interface PartnerRequest {
  id: string;
  /** Compte du demandeur (migration 0011). null = demande antérieure, à rattacher à la main */
  user_id: string | null;
  establishment_type: EstablishmentType;
  establishment_name: string;
  description: string | null;
  city: string;
  commune: string | null;
  neighborhood: string | null;
  avenue: string | null;
  numero: string | null;
  reference: string | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  photo_urls: string[];
  status: PartnerRequestStatus;
  rejection_reason: string | null;
  // Champs renseignés à l'examen par approve_partner_request (migration 0012)
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_establishment_id: string | null;
  // Envoi des identifiants à l'approbation (migration 0019). Ces champs
  // existent parce que l'information ne vivait auparavant que dans une boîte
  // de dialogue : une fois fermée, savoir si un partenaire avait reçu ses
  // accès devenait impossible.
  /** true = accepté par le service d'envoi, false = refusé, null = jamais approuvé */
  credentials_sent: boolean | null;
  /** Motif exact du refus, tel que renvoyé par le service d'envoi */
  credentials_error: string | null;
  credentials_sent_at: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════
// Administration
// ═══════════════════════════════════════════

export interface AdminActivityLog {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: any;
  created_at: string;
}

// ═══════════════════════════════════════════
// Favoris
// ═══════════════════════════════════════════

export interface Favorite {
  id: string;
  traveler_id: string;
  establishment_id: string;
  created_at: string;
}

// ═══════════════════════════════════════════
// Réglages généraux de l'app
// ═══════════════════════════════════════════

export interface AppSetting {
  key: string;
  value: string | null;
  updated_at: string;
}

// ═══════════════════════════════════════════
// Planning de voyage
// ═══════════════════════════════════════════

export interface TripPlan {
  id: string;
  traveler_id: string;
  title: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  traveler_count: number;
  planned_budget: number | null;
  notes: string | null;
  created_at: string;
}

export type TripItemType = 'itinerary' | 'wishlist';

export interface TripPlanItem {
  id: string;
  trip_plan_id: string;
  establishment_id: string | null;
  item_type: TripItemType;
  day_date: string | null;
  time: string | null;
  title: string;
  estimated_cost: number;
  actual_cost: number | null;
  currency: string;
  notes: string | null;
  visited: boolean;
  position: number;
  created_at: string;
}

export type PackingCategory = 'documents' | 'clothing' | 'personal' | 'custom';

export interface TripPackingItem {
  id: string;
  trip_plan_id: string;
  category: PackingCategory;
  label: string;
  is_checked: boolean;
  position: number;
  created_at: string;
}