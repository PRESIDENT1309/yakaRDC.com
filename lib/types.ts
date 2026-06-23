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
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  amenities: string[];
  status: EstablishmentStatus;
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
  visit_date: string | null;
  visit_time: string | null;
  notes: string | null;
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
