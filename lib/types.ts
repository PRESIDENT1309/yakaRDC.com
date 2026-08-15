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
  created_at: string;
}

export type PhotoCategory = 'general' | 'menu' | 'pricing';

export interface ListingPhoto {
  id: string;
  establishment_id: string;
  url: string;
  category: PhotoCategory;
  position: number;
  created_at: string;
}

export interface Rate {
  id: string;
  establishment_id: string;
  price: number;
  currency: string;
  unit: 'night' | 'person' | 'visit';
  created_at: string;
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
  created_at: string;
}

// ═══════════════════════════════════════════
// Demandes de partenariat
// ═══════════════════════════════════════════

export type PartnerRequestStatus = 'pending' | 'approved' | 'rejected';

export interface PartnerRequest {
  id: string;
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