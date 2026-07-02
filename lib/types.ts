// Types miroir du schéma Supabase défini dans supabase/migrations/0001_init.sql

export type UserRole = 'traveler' | 'partner' | 'admin';
export type EstablishmentType = 'hotel' | 'furnished_house' | 'restaurant' | 'site';
export type EstablishmentStatus = 'pending' | 'approved' | 'rejected';
export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'checked_in' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type RateUnit = 'night' | 'person' | 'visit';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  created_at: string;
}

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
  created_at: string;
}

export interface TripPlan {
  id: string;
  traveler_id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface TripPlanItem {
  id: string;
  trip_plan_id: string;
  establishment_id: string | null;
  day_date: string;
  title: string;
  estimated_cost: number;
  currency: string;
  notes: string | null;
  position: number;
  created_at: string;
}

export interface EstablishmentWarning {
  id: string;
  establishment_id: string;
  issued_by: string | null;
  reason: string;
  created_at: string;
}

export interface ListingPhoto {
  id: string;
  establishment_id: string;
  url: string;
  position: number;
}

export interface Rate {
  id: string;
  establishment_id: string;
  price: number;
  unit: RateUnit;
  currency: string;
}

export interface Booking {
  id: string;
  establishment_id: string;
  traveler_id: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  check_in: string | null;
  check_out: string | null;
  guests: number | null;
  children: number;
  visit_date: string | null;
  visit_time: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  unique_code: string | null;
  qr_token: string;
  used_at: string | null;
  validated_by: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  establishment_id: string;
  traveler_id: string;
  booking_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface City {
  id: string;
  name: string;
  is_active: boolean;
}

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
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_establishment_id: string | null;
  created_at: string;
}

export interface AdminActivityLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
}