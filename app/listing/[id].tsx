import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, Modal, TextInput,
  ActivityIndicator, Image, useWindowDimensions, Linking, Share,
} from 'react-native';
import { Alert } from '../../lib/alert';
import { useLocalSearchParams, router } from 'expo-router';
import Svg, { Circle, Polygon, Path } from 'react-native-svg';
import {
  ArrowLeft, Heart, MapPin, Star, Wifi, Car,
  Wind, Coffee, Plus, Minus, X, Send,
  Phone, Mail, CalendarPlus, AlertCircle, Share2, Navigation, Flag,
  ChevronLeft, ChevronRight, MessageCircle, BadgeCheck, Pencil,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, spacing, typography, radii } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import { useConfirm } from '../../lib/confirm-context';
import { getOpeningStatus } from '../../lib/opening-hours';
import Calendar, { formatFrench } from '../../components/Calendar';
import FormField from '../../components/FormField';
import Sheet from '../../components/Sheet';
import Button from '../../components/Button';
import PhoneField from '../../components/PhoneField';
import { DEFAULT_DIAL, findByDial } from '../../lib/countries';
import EmptyState from '../../components/EmptyState';
import ListingCard from '../../components/ListingCard';
import RiverMotif from '../../components/RiverMotif';
import PhotoScrim from '../../components/PhotoScrim';
import type { Establishment, Rate, EstablishmentType, ListingPhoto, Review } from '../../lib/types';

// Établissement suggéré en fin de fiche, enrichi de sa photo et de son tarif
type SimilarEstablishment = Establishment & {
  coverPhoto: string | null;
  priceLabel?: string;
};

// Contact du support YakaRDC pour les signalements de fiche (point « Signaler
// une information incorrecte »). Aucune table de signalement dans ce lot :
// le lien ouvre une conversation pré-remplie.
const SUPPORT_WHATSAPP = '243999000000';

// ── Affichage de l'adresse ──
// Les données partenaires arrivent telles que saisies (« gombe », « gombe  »).
// On corrige à l'affichage uniquement, jamais en base.
function titleCase(v: string): string {
  return v.trim().split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function sameValue(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// `profiles.full_name` est un champ libre : on ne peut que deviner la coupure.
// Premier mot = prénom, reste = nom. Les champs restent modifiables, donc une
// mauvaise coupure se corrige — contrairement à ne rien pré-remplir du tout.
function splitFullName(full?: string | null): { firstName: string; lastName: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// Le téléphone du profil est stocké en un seul champ libre. S'il commence par
// un indicatif connu, on le sépare pour alimenter le sélecteur ; sinon on
// garde le numéro tel quel avec l'indicatif par défaut.
function splitPhone(raw?: string | null): { dial: string; number: string } {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!v.startsWith('+')) return { dial: DEFAULT_DIAL, number: v };
  // Les indicatifs vont de 1 à 4 caractères après le « + » : on teste du plus
  // long au plus court pour ne pas confondre +1 et +125.
  for (let len = 4; len >= 1; len--) {
    const candidate = '+' + v.slice(1).replace(/\D/g, '').slice(0, len);
    if (findByDial(candidate)) {
      const rest = v.slice(candidate.length).trim();
      return { dial: candidate, number: rest };
    }
  }
  return { dial: DEFAULT_DIAL, number: v };
}

function unitLabel(unit: string | null): string {
  if (unit === 'night') return '/ nuit';
  if (unit === 'person') return '/ pers.';
  if (unit === 'visit') return '/ visite';
  return '';
}

// Disponibilités transmises aux formulaires de réservation
interface Availability {
  fullDays: Set<string>;
  slotLoads: Record<string, number>;
  capacity: number | null;
}

type TimeSlot = string;

interface BaseForm {
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
interface HotelForm extends BaseForm {
  checkIn: string; checkOut: string;
  // Heure d'arrivée — hôtel et maison meublée uniquement. Pour un restaurant
  // ou un site, le créneau EST déjà l'heure d'arrivée. Pour une maison sans
  // réception, le propriétaire doit être là pour remettre les clés.
  arrivalTime: string;
  paymentMethod: 'cash' | 'mobile_money' | 'card';
}
interface RestaurantForm extends BaseForm {
  visitDate: string; timeSlot: TimeSlot;
  occasion: 'none' | 'birthday' | 'business' | 'romantic' | 'other';
  allergies: string;
}
interface SiteForm extends BaseForm {
  visitDate: string; timeSlot: TimeSlot;
  visitType: 'guided' | 'free';
  nationality: 'congolaise' | 'etrangere';
}

const RESTAURANT_SLOTS: TimeSlot[] = ['12h00','12h30','13h00','19h00','19h30','20h00','20h30'];
const SITE_SLOTS: TimeSlot[] = ['09h00','11h00','14h00','16h00'];
const OCCASIONS = [
  { key: 'none', label: 'Aucune' },
  { key: 'birthday', label: 'Anniversaire' },
  { key: 'business', label: 'Business' },
  { key: 'romantic', label: 'Romantique' },
  { key: 'other', label: 'Autre' },
];
const PAYMENTS = [
  { key: 'cash', label: 'Sur place' },
  { key: 'mobile_money', label: 'Mobile money' },
  { key: 'card', label: 'Carte' },
];
const AMENITY_ICONS: Record<string, React.ReactNode> = {
  'Wifi': <Wifi size={13} color={colors.fleuveDark} />,
  'Parking': <Car size={13} color={colors.fleuveDark} />,
  'Climatisation': <Wind size={13} color={colors.fleuveDark} />,
  'Petit-déjeuner': <Coffee size={13} color={colors.fleuveDark} />,
};

function Counter({ label, value, onDec, onInc, accent }:
  { label: string; value: number; onDec: () => void; onInc: () => void; accent: string }) {
  return (
    <View style={styles.counter}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterRow}>
        <Pressable style={[styles.counterBtn, styles.counterBtnMuted]} onPress={onDec} hitSlop={8}>
          <Minus size={14} color={colors.muted} />
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable style={[styles.counterBtn, { backgroundColor: accent }]} onPress={onInc} hitSlop={8}>
          <Plus size={14} color={colors.cream} />
        </Pressable>
      </View>
    </View>
  );
}

// Sélecteur de créneau qui grise les horaires complets
function SlotPicker({ slots, selected, onSelect, accent, slotLoads, capacity, partySize }:
  { slots: TimeSlot[]; selected: string; onSelect: (s: string) => void; accent: string;
    slotLoads: Record<string, number>; capacity: number | null; partySize: number }) {
  return (
    <View style={[styles.formRow, { flexWrap: 'wrap', gap: 6 }]}>
      {slots.map(s => {
        const taken = slotLoads[s] ?? 0;
        const isFull = capacity != null && taken + partySize > capacity;
        const isSelected = selected === s;
        return (
          <Pressable
            key={s}
            style={[
              styles.chip,
              isSelected && { backgroundColor: accent, borderColor: accent },
              isFull && styles.chipFull,
            ]}
            onPress={() => !isFull && onSelect(s)}
            disabled={isFull}
          >
            <Text style={[
              styles.chipText,
              isSelected && { color: colors.cream, fontWeight: '500' },
              isFull && styles.chipTextFull,
            ]}>
              {s}{isFull ? ' · complet' : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function HotelBookingForm({ accent, form, setForm, onSubmit, loading, availability }:
  { accent: string; form: HotelForm; setForm: (f: HotelForm) => void; onSubmit: () => void;
    loading: boolean; availability: Availability }) {
  const [dateMode, setDateMode] = useState<'in' | 'out'>('in');

  function handleSelectDate(iso: string) {
    if (dateMode === 'in') {
      const nextOut = form.checkOut && form.checkOut <= iso ? '' : form.checkOut;
      setForm({ ...form, checkIn: iso, checkOut: nextOut });
      setDateMode('out');
    } else {
      if (form.checkIn && iso <= form.checkIn) {
        Alert.alert('Date invalide', "Le départ doit être après l'arrivée.");
        return;
      }
      setForm({ ...form, checkOut: iso });
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}><FormField label="Prénom" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} placeholder="Jean" /></View>
        <View style={{ flex: 1 }}><FormField label="Nom" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} placeholder="Mbeki" /></View>
      </View>
      <FormField label="Postnom (facultatif)" value={form.postName} onChange={v => setForm({ ...form, postName: v })} placeholder="Kabasele" />
      <PhoneField
        label="Téléphone"
        dial={form.phoneDial}
        onDialChange={v => setForm({ ...form, phoneDial: v })}
        value={form.phone}
        onChange={v => setForm({ ...form, phone: v })}
      />
      <FormField label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="jean@exemple.cd" keyboardType="email-address" />

      <Text style={styles.fieldLabel}>Dates du séjour</Text>
      <View style={styles.dateTabs}>
        <Pressable
          style={[styles.dateTab, dateMode === 'in' && { borderColor: accent, backgroundColor: colors.white }]}
          onPress={() => setDateMode('in')}
        >
          <Text style={styles.dateTabLabel}>Arrivée</Text>
          <Text style={[styles.dateTabValue, !form.checkIn && styles.dateTabPlaceholder]}>
            {form.checkIn ? formatFrench(form.checkIn) : 'Choisir'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.dateTab, dateMode === 'out' && { borderColor: accent, backgroundColor: colors.white }]}
          onPress={() => setDateMode('out')}
        >
          <Text style={styles.dateTabLabel}>Départ</Text>
          <Text style={[styles.dateTabValue, !form.checkOut && styles.dateTabPlaceholder]}>
            {form.checkOut ? formatFrench(form.checkOut) : 'Choisir'}
          </Text>
        </Pressable>
      </View>

      <View style={{ marginBottom: 12 }}>
        <Calendar
          value={dateMode === 'in' ? form.checkIn || null : form.checkOut || null}
          onSelect={handleSelectDate}
          fullDays={availability.fullDays}
          accent={accent}
        />
      </View>

      <FormField label="Heure d'arrivée prévue (facultatif)" value={form.arrivalTime} onChange={v => setForm({ ...form, arrivalTime: v })} placeholder="Ex : 18:00" />

      <Text style={styles.fieldLabel}>Voyageurs</Text>
      <View style={styles.formRow}>
        <Counter label="Adultes" value={form.adults} accent={accent} onDec={() => setForm({ ...form, adults: Math.max(1, form.adults - 1) })} onInc={() => setForm({ ...form, adults: form.adults + 1 })} />
        <Counter label="Enfants" value={form.children} accent={accent} onDec={() => setForm({ ...form, children: Math.max(0, form.children - 1) })} onInc={() => setForm({ ...form, children: form.children + 1 })} />
      </View>
      <Text style={styles.fieldLabel}>Mode de paiement</Text>
      <View style={[styles.formRow, { flexWrap: 'wrap', gap: 6 }]}>
        {PAYMENTS.map(p => (
          <Pressable key={p.key} style={[styles.chip, form.paymentMethod === p.key && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, paymentMethod: p.key as any })}>
            <Text style={[styles.chipText, form.paymentMethod === p.key && { color: colors.cream, fontWeight: '500' }]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <FormField label="Demandes spéciales (optionnel)" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Chambre calme, lit king size..." multiline />
      <Button label="Envoyer la demande" onPress={onSubmit} loading={loading} color={accent} icon={<Send size={15} color={colors.cream} strokeWidth={1.75} />} />
    </ScrollView>
  );
}

function RestaurantBookingForm({ accent, form, setForm, onSubmit, loading, availability }:
  { accent: string; form: RestaurantForm; setForm: (f: RestaurantForm) => void; onSubmit: () => void;
    loading: boolean; availability: Availability }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}><FormField label="Prénom" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} placeholder="Marie" /></View>
        <View style={{ flex: 1 }}><FormField label="Nom" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} placeholder="Kalala" /></View>
      </View>
      <FormField label="Postnom (facultatif)" value={form.postName} onChange={v => setForm({ ...form, postName: v })} placeholder="Kabasele" />
      <PhoneField
        label="Téléphone"
        dial={form.phoneDial}
        onDialChange={v => setForm({ ...form, phoneDial: v })}
        value={form.phone}
        onChange={v => setForm({ ...form, phone: v })}
      />
      <FormField label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="marie@exemple.cd" keyboardType="email-address" />

      <Text style={styles.fieldLabel}>
        Date{form.visitDate ? ` — ${formatFrench(form.visitDate)}` : ''}
      </Text>
      <View style={{ marginBottom: 12 }}>
        <Calendar
          value={form.visitDate || null}
          onSelect={iso => setForm({ ...form, visitDate: iso, timeSlot: '' })}
          fullDays={availability.fullDays}
          accent={accent}
        />
      </View>

      <Text style={styles.fieldLabel}>Créneau horaire</Text>
      {!form.visitDate ? (
        <Text style={styles.slotHint}>Choisissez d'abord une date.</Text>
      ) : (
        <SlotPicker
          slots={RESTAURANT_SLOTS}
          selected={form.timeSlot}
          onSelect={s => setForm({ ...form, timeSlot: s })}
          accent={accent}
          slotLoads={availability.slotLoads}
          capacity={availability.capacity}
          partySize={form.adults + form.children}
        />
      )}

      <Text style={styles.fieldLabel}>Couverts</Text>
      <View style={styles.formRow}>
        <Counter label="Adultes" value={form.adults} accent={accent} onDec={() => setForm({ ...form, adults: Math.max(1, form.adults - 1) })} onInc={() => setForm({ ...form, adults: form.adults + 1 })} />
        <Counter label="Enfants" value={form.children} accent={accent} onDec={() => setForm({ ...form, children: Math.max(0, form.children - 1) })} onInc={() => setForm({ ...form, children: form.children + 1 })} />
      </View>
      <Text style={styles.fieldLabel}>Occasion</Text>
      <View style={[styles.formRow, { flexWrap: 'wrap', gap: 6 }]}>
        {OCCASIONS.map(o => (
          <Pressable key={o.key} style={[styles.chip, form.occasion === o.key && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, occasion: o.key as any })}>
            <Text style={[styles.chipText, form.occasion === o.key && { color: colors.cream, fontWeight: '500' }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      <FormField label="Allergies / régimes (optionnel)" value={form.allergies} onChange={v => setForm({ ...form, allergies: v })} placeholder="Sans gluten, végétarien..." multiline />
      <Button label="Réserver la table" onPress={onSubmit} loading={loading} color={accent} icon={<Send size={15} color={colors.cream} strokeWidth={1.75} />} />
    </ScrollView>
  );
}

function SiteBookingForm({ accent, form, setForm, onSubmit, loading, availability }:
  { accent: string; form: SiteForm; setForm: (f: SiteForm) => void; onSubmit: () => void;
    loading: boolean; availability: Availability }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}><FormField label="Prénom" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} placeholder="Pierre" /></View>
        <View style={{ flex: 1 }}><FormField label="Nom" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} placeholder="Tshimanga" /></View>
      </View>
      <FormField label="Postnom (facultatif)" value={form.postName} onChange={v => setForm({ ...form, postName: v })} placeholder="Kabasele" />
      <PhoneField
        label="Téléphone (responsable)"
        dial={form.phoneDial}
        onDialChange={v => setForm({ ...form, phoneDial: v })}
        value={form.phone}
        onChange={v => setForm({ ...form, phone: v })}
      />
      <FormField label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="pierre@exemple.cd" keyboardType="email-address" />

      <Text style={styles.fieldLabel}>
        Date de visite{form.visitDate ? ` — ${formatFrench(form.visitDate)}` : ''}
      </Text>
      <View style={{ marginBottom: 12 }}>
        <Calendar
          value={form.visitDate || null}
          onSelect={iso => setForm({ ...form, visitDate: iso, timeSlot: '' })}
          fullDays={availability.fullDays}
          accent={accent}
        />
      </View>

      <Text style={styles.fieldLabel}>Créneau d'entrée</Text>
      {!form.visitDate ? (
        <Text style={styles.slotHint}>Choisissez d'abord une date.</Text>
      ) : (
        <SlotPicker
          slots={SITE_SLOTS}
          selected={form.timeSlot}
          onSelect={s => setForm({ ...form, timeSlot: s })}
          accent={accent}
          slotLoads={availability.slotLoads}
          capacity={availability.capacity}
          partySize={form.adults + form.children}
        />
      )}

      <Text style={styles.fieldLabel}>Composition du groupe</Text>
      <View style={styles.formRow}>
        <Counter label="Adultes" value={form.adults} accent={accent} onDec={() => setForm({ ...form, adults: Math.max(1, form.adults - 1) })} onInc={() => setForm({ ...form, adults: form.adults + 1 })} />
        <Counter label="Enfants" value={form.children} accent={accent} onDec={() => setForm({ ...form, children: Math.max(0, form.children - 1) })} onInc={() => setForm({ ...form, children: form.children + 1 })} />
      </View>
      <Text style={styles.fieldLabel}>Type de visite</Text>
      <View style={styles.formRow}>
        {[{ key: 'guided', label: 'Guidée' }, { key: 'free', label: 'Libre' }].map(v => (
          <Pressable key={v.key} style={[styles.chip, { flex: 1 }, form.visitType === v.key && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, visitType: v.key as any })}>
            <Text style={[styles.chipText, { textAlign: 'center' }, form.visitType === v.key && { color: colors.cream, fontWeight: '500' }]}>{v.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.fieldLabel}>Nationalité</Text>
      <View style={styles.formRow}>
        {[{ key: 'congolaise', label: 'Congolaise' }, { key: 'etrangere', label: 'Étrangère' }].map(n => (
          <Pressable key={n.key} style={[styles.chip, { flex: 1 }, form.nationality === n.key && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, nationality: n.key as any })}>
            <Text style={[styles.chipText, { textAlign: 'center' }, form.nationality === n.key && { color: colors.cream, fontWeight: '500' }]}>{n.label}</Text>
          </Pressable>
        ))}
      </View>
      <FormField label="Remarques (optionnel)" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Accessibilité PMR, équipement spécial..." multiline />
      <Button label="Réserver la visite" onPress={onSubmit} loading={loading} color={accent} icon={<Send size={15} color={colors.cream} strokeWidth={1.75} />} />
    </ScrollView>
  );
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const { width: heroWidth } = useWindowDimensions();
  const { isWide, isDesktop, contentWidth } = useResponsive();
  const confirm = useConfirm();
  const wide = { maxWidth: contentWidth, width: '100%' as const, alignSelf: 'center' as const };
  const photoScrollRef = useRef<ScrollView>(null);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rate, setRate] = useState<Rate | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [menuPhotos, setMenuPhotos] = useState<ListingPhoto[]>([]);
  // Visionneuse plein écran, partagée entre la galerie principale et le menu.
  // `source` indique quelle collection est ouverte — une seule visionneuse,
  // paramétrée, plutôt qu'une seconde implémentation.
  const [viewer, setViewer] = useState<{ source: 'photos' | 'menu'; index: number } | null>(null);
  const [similar, setSimilar] = useState<SimilarEstablishment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [addingToPlan, setAddingToPlan] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Disponibilités
  const [fullDays, setFullDays] = useState<Set<string>>(new Set());
  const [slotLoads, setSlotLoads] = useState<Record<string, number>>({});

  // Pré-remplissage depuis le profil connecté. `profiles.full_name` existait
  // déjà mais n'était pas utilisé : l'utilisateur retapait son nom à chaque
  // réservation. Le premier mot est traité comme prénom, le reste comme nom —
  // approximation assumée, les champs restent modifiables.
  const prefill = splitFullName(profile?.full_name);
  const prefillPhone = splitPhone(profile?.phone);
  const base = {
    firstName: prefill.firstName, lastName: prefill.lastName, postName: '',
    phoneDial: prefillPhone.dial, phone: prefillPhone.number,
    email: profile?.email ?? '',
    notes: '',
  };

  const [hotelForm, setHotelForm] = useState<HotelForm>({
    ...base,
    adults: 1, children: 0, checkIn: '', checkOut: '', arrivalTime: '', paymentMethod: 'cash',
  });
  const [restaurantForm, setRestaurantForm] = useState<RestaurantForm>({
    ...base,
    adults: 2, children: 0, visitDate: '', timeSlot: '', occasion: 'none', allergies: '',
  });
  const [siteForm, setSiteForm] = useState<SiteForm>({
    ...base,
    adults: 1, children: 0, visitDate: '', timeSlot: '', visitType: 'guided', nationality: 'congolaise',
  });

  // Le profil arrive DEUX tours asynchrones après le montage (getSession puis
  // loadProfile). L'initialiseur de useState ci-dessus n'est lu qu'au premier
  // rendu, quand `profile` vaut encore null : sans cet effet, les champs
  // restent vides pour toujours. C'était déjà le cas du téléphone avant
  // l'ajout des autres champs — le pré-remplissage n'a jamais fonctionné.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !profile) return;
    prefilled.current = true;

    const { firstName, lastName } = splitFullName(profile.full_name);
    const { dial, number } = splitPhone(profile.phone);
    const email = profile.email ?? '';

    // On ne remplit que les champs encore vides : si l'utilisateur a déjà
    // commencé à saisir pendant le chargement, sa frappe n'est pas écrasée.
    function patch<T extends BaseForm>(f: T): T {
      return {
        ...f,
        firstName: f.firstName || firstName,
        lastName: f.lastName || lastName,
        email: f.email || email,
        // L'indicatif ne change que si aucun numéro n'a été saisi, sinon on
        // écraserait un choix délibéré de l'utilisateur.
        phoneDial: f.phone ? f.phoneDial : dial,
        phone: f.phone || number,
      };
    }

    setHotelForm(patch);
    setRestaurantForm(patch);
    setSiteForm(patch);
  }, [profile]);

  const loadEstablishment = useCallback(async () => {
    setLoadError(false);
    const { data, error } = await supabase
      .from('establishments').select('*').eq('id', id).single();

    // Un id inexistant renvoie une erreur PostgREST, pas une donnée nulle
    // silencieuse : sans cette branche, l'écran restait en spinner indéfiniment.
    if (error || !data) { setLoadError(true); return; }
    setEstablishment(data as Establishment);

    supabase.from('rates').select('*').eq('establishment_id', id).limit(1).maybeSingle()
      .then(({ data: r }) => setRate(r as Rate | null));
    supabase.from('listing_photos').select('*').eq('establishment_id', id).order('position', { ascending: true })
      .then(({ data: p }) => {
        const all = (p as ListingPhoto[]) ?? [];
        setPhotos(all.filter(x => !x.category || x.category === 'general'));
        setMenuPhotos(all.filter(x => x.category === 'menu' || x.category === 'pricing'));
      });
    // Compte cette visite pour les statistiques du partenaire (une fois par ouverture)
    supabase.rpc('increment_establishment_views', { p_establishment_id: id });
  }, [id]);

  useEffect(() => { loadEstablishment(); }, [loadEstablishment]);

  // Charge les journées complètes sur 4 mois, à l'ouverture du formulaire
  useEffect(() => {
    if (!showForm || !establishment?.capacity) { setFullDays(new Set()); return; }

    const from = new Date();
    const to = new Date();
    to.setMonth(to.getMonth() + 4);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    supabase.rpc('establishment_daily_load', {
      p_establishment_id: id,
      p_from: iso(from),
      p_to: iso(to),
    }).then(({ data }) => {
      const capacity = establishment.capacity!;
      const full = new Set<string>();
      ((data as any[]) ?? []).forEach(row => {
        if (row.guests >= capacity) full.add(row.day);
      });
      setFullDays(full);
    });
  }, [showForm, id, establishment?.capacity]);

  // Charge la fréquentation par créneau quand la date choisie change
  const selectedVisitDate =
    establishment?.type === 'restaurant' ? restaurantForm.visitDate :
    establishment?.type === 'site' ? siteForm.visitDate : '';

  useEffect(() => {
    if (!selectedVisitDate) { setSlotLoads({}); return; }
    supabase.rpc('establishment_slot_load', {
      p_establishment_id: id,
      p_date: selectedVisitDate,
    }).then(({ data }) => {
      const loads: Record<string, number> = {};
      ((data as any[]) ?? []).forEach(row => { loads[row.slot] = row.guests; });
      setSlotLoads(loads);
    });
  }, [selectedVisitDate, id]);

  // Établissements similaires — même type, même commune, hors fiche courante.
  // Chargés après l'établissement, car ils dépendent de son type/commune.
  useEffect(() => {
    if (!establishment) return;
    let cancelled = false;

    (async () => {
      let q = supabase.from('establishments')
        .select('*, listing_photos(url, category, position), rates(price, currency, unit)')
        .eq('type', establishment.type)
        .eq('status', 'approved')
        .neq('id', establishment.id)
        .limit(3);
      q = establishment.commune ? q.eq('commune', establishment.commune) : q.eq('city', establishment.city);

      const { data } = await q;
      if (cancelled) return;

      setSimilar(((data as any[]) ?? []).map(e => {
        const photo = (e.listing_photos ?? [])
          .filter((p: any) => !p.category || p.category === 'general')
          .sort((a: any, b: any) => a.position - b.position)[0];
        const r = (e.rates ?? [])[0];
        return {
          ...e,
          coverPhoto: photo?.url ?? null,
          priceLabel: r ? `${r.price} ${r.currency} ${unitLabel(r.unit)}`.trim() : 'Tarif sur demande',
        } as SimilarEstablishment;
      }));
    })();

    return () => { cancelled = true; };
  }, [establishment]);

  const fetchReviews = useCallback(async () => {
    const { data } = await supabase.from('reviews').select('*')
      .eq('establishment_id', id)
      .order('created_at', { ascending: false });
    const all = (data as Review[]) ?? [];
    setReviews(all);
    const mine = session?.user ? all.find(r => r.traveler_id === session.user.id) ?? null : null;
    setMyReview(mine);
  }, [id, session?.user?.id]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  // Garde d'authentification commune aux actions réservées aux comptes.
  // Cette fiche est atteignable sans session (lien partagé), donc le cas est
  // fréquent : on redirige vers la connexion en expliquant pourquoi, et on
  // revient ici une fois connecté. Volontairement pas d'Alert.alert : cet
  // écran tourne aussi sur le web, où Alert est dégradé — une alerte muette
  // recréerait l'échec silencieux qu'on corrige.
  function requireAuth(reason: string): boolean {
    if (session?.user) return true;
    router.push({
      pathname: '/(auth)/login',
      params: { redirect: `/listing/${id}`, reason },
    });
    return false;
  }

  // Gardée à l'ouverture, pas seulement à l'envoi : sans cela, un visiteur non
  // connecté remplit tout le formulaire avant de découvrir qu'il lui faut un
  // compte, et perd sa saisie.
  function openBookingForm() {
    if (!requireAuth('Connectez-vous pour réserver dans cet établissement.')) return;
    setShowForm(true);
  }

  function openReviewForm() {
    if (!requireAuth('Connectez-vous pour partager votre avis sur cet établissement.')) return;
    setReviewRating(myReview?.rating ?? 0);
    setReviewComment(myReview?.comment ?? '');
    setShowReviewForm(true);
  }

  async function handleSaveReview() {
    if (!requireAuth('Connectez-vous pour publier votre avis.')) return;
    if (!session?.user || reviewRating === 0) return;
    setSavingReview(true);

    const payload = {
      establishment_id: id,
      traveler_id: session.user.id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    };

    const { error } = myReview
      ? await supabase.from('reviews').update(payload).eq('id', myReview.id)
      : await supabase.from('reviews').insert(payload);

    setSavingReview(false);
    if (error) { Alert.alert('Erreur', error.message); return; }

    setShowReviewForm(false);
    fetchReviews();
  }

  async function confirmDeleteReview() {
    if (!myReview) return;
    const ok = await confirm({
      title: 'Supprimer mon avis',
      message: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    await supabase.from('reviews').delete().eq('id', myReview.id);
    setShowReviewForm(false);
    fetchReviews();
  }

  useEffect(() => {
    if (!session?.user) return;
    supabase.from('favorites').select('id')
      .eq('traveler_id', session.user.id).eq('establishment_id', id)
      .maybeSingle()
      .then(({ data }) => setIsFavorited(!!data));
  }, [id, session?.user?.id]);

  async function toggleFavorite() {
    if (!requireAuth('Connectez-vous pour enregistrer cet établissement dans vos favoris.')) return;
    if (!session?.user || favoriteLoading) return;
    setFavoriteLoading(true);
    if (isFavorited) {
      await supabase.from('favorites').delete()
        .eq('traveler_id', session.user.id).eq('establishment_id', id);
      setIsFavorited(false);
    } else {
      await supabase.from('favorites').insert({
        traveler_id: session.user.id,
        establishment_id: id,
      });
      setIsFavorited(true);
    }
    setFavoriteLoading(false);
  }

  async function handleAddToPlanning() {
    if (!requireAuth('Connectez-vous pour ajouter cet établissement à votre planning.')) return;
    if (!session?.user || !establishment) return;
    setAddingToPlan(true);

    const { data: plans } = await supabase.from('trip_plans')
      .select('id').eq('traveler_id', session.user.id)
      .order('created_at', { ascending: false }).limit(1);

    const activeTrip = plans?.[0];
    if (!activeTrip) {
      setAddingToPlan(false);
      Alert.alert(
        'Aucun voyage en cours',
        "Créez d'abord un voyage dans l'onglet Planning, puis revenez ajouter cet établissement.",
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Aller à Planning', onPress: () => router.push('/(tabs)/planner') },
        ]
      );
      return;
    }

    const { count } = await supabase.from('trip_plan_items')
      .select('id', { count: 'exact', head: true })
      .eq('trip_plan_id', activeTrip.id).eq('item_type', 'wishlist');

    await supabase.from('trip_plan_items').insert({
      trip_plan_id: activeTrip.id,
      establishment_id: establishment.id,
      item_type: 'wishlist',
      title: establishment.name,
      estimated_cost: rate?.price ?? 0,
      position: count ?? 0,
    });

    setAddingToPlan(false);
    Alert.alert('Ajouté !', `${establishment.name} a été ajouté à votre planning, dans "Lieux à visiter".`);
  }

  if (loadError) {
    return (
      <View style={styles.loading}>
        <EmptyState
          icon={<AlertCircle size={40} color={colors.borderStrong} strokeWidth={1.75} />}
          title="Établissement introuvable"
          description="Cette fiche n'existe plus, ou la connexion a échoué. Vérifiez votre réseau et réessayez."
          actionLabel="Réessayer"
          onAction={loadEstablishment}
        />
        <Pressable style={styles.errorBackLink} onPress={() => router.back()}>
          <Text style={styles.errorBackText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (!establishment) {
    return <View style={styles.loading}><ActivityIndicator color={colors.lave} /></View>;
  }

  const cat = categoryColors[establishment.type];
  const accent = cat?.accent ?? colors.lave;
  const soft = cat?.soft ?? colors.laveSoft;
  const isHotel = establishment.type === 'hotel' || establishment.type === 'furnished_house';
  const isRestaurant = establishment.type === 'restaurant';
  const isSite = establishment.type === 'site';
  const menuSectionTitle = isRestaurant ? 'Menu' : 'Tarifs des attractions';

  const availability: Availability = {
    fullDays,
    slotLoads,
    capacity: establishment.capacity ?? null,
  };

  // Note moyenne réelle, calculée depuis les avis chargés
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;

  // Filet de sécurité : l'ouverture du formulaire est déjà gardée (openBookingForm),
  // donc ce cas ne devrait pas se produire — mais on ne se repose pas sur le
  // masquage d'un bouton, qui est fragile.
  async function handleSubmit() {
    if (!requireAuth('Connectez-vous pour envoyer votre demande de réservation.')) return;
    if (!session?.user) return;
    setSubmitting(true);
    let payload: any = { establishment_id: id, traveler_id: session.user.id };

    // Champs communs aux trois formulaires. `time_slot` ne figure plus dans
    // metadata : il dupliquait à l'identique la colonne visit_time.
    const common = (f: BaseForm) => ({
      first_name: f.firstName,
      last_name: f.lastName,
      post_name: f.postName.trim() || null,
      contact_phone: f.phone.trim() ? `${f.phoneDial} ${f.phone.trim()}` : null,
      phone_country_code: f.phoneDial,
      contact_email: f.email.trim() || null,
      guests: f.adults,
      children: f.children,
      notes: f.notes || null,
    });

    if (isHotel) {
      const f = hotelForm;
      if (!f.firstName || !f.lastName || !f.checkIn || !f.checkOut) {
        Alert.alert('Champs requis', 'Veuillez remplir prénom, nom et les dates.');
        setSubmitting(false); return;
      }
      payload = { ...payload, ...common(f),
        check_in: f.checkIn, check_out: f.checkOut,
        arrival_time: f.arrivalTime.trim() || null,
        metadata: { payment_method: f.paymentMethod } };
    } else if (isRestaurant) {
      const f = restaurantForm;
      if (!f.firstName || !f.lastName || !f.visitDate || !f.timeSlot) {
        Alert.alert('Champs requis', 'Veuillez remplir prénom, nom, date et créneau.');
        setSubmitting(false); return;
      }
      payload = { ...payload, ...common(f),
        visit_date: f.visitDate, visit_time: f.timeSlot,
        metadata: { occasion: f.occasion, allergies: f.allergies } };
    } else if (isSite) {
      const f = siteForm;
      if (!f.firstName || !f.lastName || !f.visitDate || !f.timeSlot) {
        Alert.alert('Champs requis', 'Veuillez remplir prénom, nom, date et créneau.');
        setSubmitting(false); return;
      }
      payload = { ...payload, ...common(f),
        visit_date: f.visitDate, visit_time: f.timeSlot,
        metadata: { visit_type: f.visitType, nationality: f.nationality } };
    }

    let { error } = await supabase.from('bookings').insert(payload);

    // Repli temporaire : si la migration 0003 n'a pas encore été appliquée,
    // Postgres renvoie 42703 (colonne inexistante). Plutôt que de bloquer
    // TOUTE réservation — le parcours le plus critique de l'app — on réessaie
    // sans les nouveaux champs et on prévient. À SUPPRIMER une fois la
    // migration passée : voir supabase/migrations/0003_booking_contact.sql.
    if (error && (error as any).code === '42703') {
      const { post_name, phone_country_code, contact_email, arrival_time, ...legacy } = payload;
      const retry = await supabase.from('bookings').insert(legacy);
      error = retry.error;
      if (!error) {
        Alert.alert(
          'Réservation enregistrée',
          "Votre demande est bien partie. Certaines informations (postnom, email, heure d'arrivée) n'ont pas pu être conservées : la base n'est pas encore à jour.",
        );
      }
    }

    setSubmitting(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    setShowForm(false);
    setSuccess(true);
  }

  const priceLabel = rate
    ? `${rate.price} ${rate.currency} / ${rate.unit === 'night' ? 'nuit' : rate.unit === 'person' ? 'pers.' : 'visite'}`
    : 'Tarif sur demande';

  // URL publique de la fiche — sert au partage et au signalement.
  const listingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/listing/${id}`
    : `https://yakardc.com/listing/${id}`;

  async function handleShare() {
    try {
      await Share.share({
        title: establishment!.name,
        message: `${establishment!.name} — ${listingUrl}`,
        url: listingUrl,
      });
    } catch {
      // Partage annulé ou indisponible : rien à signaler à l'utilisateur.
    }
  }

  // Adresse en texte libre, pour la recherche Google Maps. On ne s'appuie pas
  // sur lat/lng : le formulaire partenaire ne les collecte pas, donc tout
  // nouvel établissement naîtrait sans coordonnées.
  const addressQuery = [
    establishment.name,
    establishment.avenue ? `Avenue ${establishment.avenue}` : null,
    establishment.numero,
    establishment.commune ? titleCase(establishment.commune) : null,
    establishment.city,
  ].filter(Boolean).join(', ');

  function openDirections() {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`);
  }

  function reportListing() {
    const msg = `Bonjour, je signale une information incorrecte sur cette fiche YakaRDC :\n\n${establishment!.name}\n${listingUrl}\n\nProblème constaté : `;
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`);
  }

  // Ligne d'adresse : la commune n'est pas répétée si le quartier porte déjà
  // la même valeur (« Commune de Gombe, Gombe » dans les données actuelles).
  const communeLabel = establishment.commune ? titleCase(establishment.commune) : null;
  const neighborhoodLabel = establishment.neighborhood ? titleCase(establishment.neighborhood) : null;
  const showNeighborhood = neighborhoodLabel && !sameValue(establishment.commune, establishment.neighborhood);

  const streetLine = establishment.avenue
    ? `Avenue ${titleCase(establishment.avenue)}${establishment.numero ? `, n°${establishment.numero}` : ''}`
    : null;
  const areaLine = [communeLabel, showNeighborhood ? neighborhoodLabel : null, establishment.city]
    .filter(Boolean).join(' · ');

  const viewerPhotos = viewer?.source === 'menu' ? menuPhotos : photos;
  const viewerPhoto = viewer ? viewerPhotos[viewer.index] : null;

  // Ligne d'état des horaires. `null` quand la colonne est vide : on n'affiche
  // alors rien, plutôt qu'un « Fermé » par défaut qui serait faux.
  const opening = getOpeningStatus(establishment.opening_hours);
  const openingStatus = opening && {
    label: opening.label,
    tone: opening.state === 'open' ? colors.success
      : opening.state === 'closing_soon' ? colors.warning
      : colors.muted,
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.hero, { backgroundColor: soft }]}>
          {photos.length > 0 ? (
            <>
              <ScrollView
                ref={photoScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / heroWidth);
                  setActivePhotoIndex(index);
                }}
              >
                {photos.map((photo, i) => (
                  <Pressable key={photo.id} onPress={() => setViewer({ source: 'photos', index: i })}>
                    <Image
                      source={{ uri: photo.url }}
                      style={{ width: heroWidth, height: '100%' }}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <PhotoScrim from="bottom" intensity={0.5} />
              </View>
              {photos.length > 1 && (
                <>
                  <View style={styles.photoDots}>
                    {photos.map((_, i) => (
                      <Pressable
                        key={i}
                        onPress={() => {
                          setActivePhotoIndex(i);
                          photoScrollRef.current?.scrollTo({ x: i * heroWidth, animated: true });
                        }}
                        hitSlop={6}
                      >
                        <View style={[styles.photoDot, i === activePhotoIndex && styles.photoDotActive]} />
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.photoCounter}>
                    <Text style={styles.photoCounterText}>{activePhotoIndex + 1} / {photos.length}</Text>
                  </View>
                </>
              )}
            </>
          ) : (
            // Repli de marque (§06) : plus d'illustration décorative maison,
            // c'est RiverMotif + PhotoScrim, déjà éprouvés sur la Homepage.
            <>
              <RiverMotif width={heroWidth} height={220} variant="hero" />
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <PhotoScrim from="bottom" intensity={0.45} />
              </View>
            </>
          )}
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={16} color={colors.ink} strokeWidth={1.75} />
          </Pressable>
          <View style={styles.heroActions}>
            <Pressable style={styles.heroActionBtn} onPress={handleShare}>
              <Share2 size={16} color={colors.ink} strokeWidth={1.75} />
            </Pressable>
            <Pressable style={styles.heroActionBtn} onPress={toggleFavorite} disabled={favoriteLoading}>
              <Heart
                size={16}
                strokeWidth={1.75}
                color={isFavorited ? colors.danger : colors.ink}
                fill={isFavorited ? colors.danger : 'transparent'}
              />
            </Pressable>
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.heroCategory}>{cat?.label}</Text>
            <Text style={styles.heroName}>{establishment.name}</Text>
          </View>
        </View>

        <View style={[styles.body, isWide && wide, isDesktop && styles.bodyDesktopRow]}>
          <View style={isDesktop ? styles.desktopMain : undefined}>
          {/* Ligne méta — du texte avec séparateurs, pas des pastilles :
              une pastille a un rôle de sélection, ici rien n'est cliquable. */}
          <View style={styles.metaRow}>
            <Text style={styles.metaText} numberOfLines={1}>
              {showNeighborhood ? `${neighborhoodLabel}, ` : ''}{establishment.city}
            </Text>
            <Text style={styles.metaSeparator}>·</Text>
            {avgRating != null ? (
              <>
                <Star size={12} color={colors.or} fill={colors.or} strokeWidth={1.75} />
                <Text style={styles.metaStrong}>{avgRating.toFixed(1)}</Text>
                <Text style={styles.metaText}>({reviews.length})</Text>
              </>
            ) : (
              <Text style={styles.metaText}>Nouveau</Text>
            )}
            {openingStatus && (
              <>
                <Text style={styles.metaSeparator}>·</Text>
                <Text style={[styles.metaStrong, { color: openingStatus.tone }]}>{openingStatus.label}</Text>
              </>
            )}
          </View>

          {/* Contact — rangée segmentée, sans cercles colorés. Le libellé porte
              le sens : « @ » pour Instagram et une note de musique pour TikTok
              étaient indevinables. */}
          {(establishment.phone || establishment.email) && (
            <View style={styles.contactRow}>
              {establishment.phone && (
                <Pressable style={styles.contactCell} onPress={() => Linking.openURL(`tel:${establishment.phone}`)}>
                  <Phone size={15} color={accent} strokeWidth={1.75} />
                  <Text style={styles.contactLabel}>Appeler</Text>
                </Pressable>
              )}
              {establishment.phone && establishment.email && <View style={styles.contactDivider} />}
              {establishment.email && (
                <Pressable style={styles.contactCell} onPress={() => Linking.openURL(`mailto:${establishment.email}`)}>
                  <Mail size={15} color={accent} strokeWidth={1.75} />
                  <Text style={styles.contactLabel}>Écrire</Text>
                </Pressable>
              )}
            </View>
          )}

          {(establishment.instagram || establishment.tiktok) && (
            <View style={styles.followRow}>
              <Text style={styles.followLabel}>Suivre :</Text>
              {establishment.instagram && (
                <Text
                  style={[styles.followLink, { color: accent }]}
                  onPress={() => Linking.openURL(`https://instagram.com/${establishment.instagram!.replace('@', '')}`)}
                >
                  Instagram
                </Text>
              )}
              {establishment.instagram && establishment.tiktok && <Text style={styles.followLabel}>·</Text>}
              {establishment.tiktok && (
                <Text
                  style={[styles.followLink, { color: accent }]}
                  onPress={() => Linking.openURL(`https://tiktok.com/@${establishment.tiktok!.replace('@', '')}`)}
                >
                  TikTok
                </Text>
              )}
            </View>
          )}

          {establishment.amenities?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.amenitiesRow}>
              {establishment.amenities.map(a => (
                <View key={a} style={styles.amenityChip}>
                  {AMENITY_ICONS[a] ?? <Wifi size={13} color={colors.fleuveDark} />}
                  <Text style={styles.amenityText}>{a}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {establishment.description && (
            <View style={styles.section}>
              <Text style={styles.sectionKicker}>À propos</Text>
              <Text style={styles.description}>{establishment.description}</Text>
            </View>
          )}

          {/* Menu (restaurant) ou Tarifs (site) */}
          {menuPhotos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionKicker}>{menuSectionTitle}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {menuPhotos.map((photo, i) => (
                  <Pressable key={photo.id} onPress={() => setViewer({ source: 'menu', index: i })}>
                    <Image source={{ uri: photo.url }} style={styles.menuThumb} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Adresse — hiérarchie typographique et filet fin, pas de carte
              blanche bordée. Rue en Playfair, zone en Manrope. */}
          {(communeLabel || streetLine || establishment.reference) && (
            <View style={styles.section}>
              <Text style={styles.sectionKicker}>Adresse</Text>
              <View style={styles.addressBlock}>
                {streetLine && <Text style={styles.addressStreet}>{streetLine}</Text>}
                {!!areaLine && <Text style={styles.addressArea}>{areaLine}</Text>}
                {establishment.reference && (
                  <Text style={styles.addressReference}>Repère : {establishment.reference}</Text>
                )}
                <Pressable style={styles.directionsLink} onPress={openDirections}>
                  <Navigation size={13} color={accent} strokeWidth={1.75} />
                  <Text style={[styles.directionsText, { color: accent }]}>Ouvrir l'itinéraire</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Avis */}
          <View style={styles.section}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionKicker}>
                Avis {reviews.length > 0 ? `(${reviews.length})` : ''}
              </Text>
              {/* Plus conditionné à la session : la garde est dans openReviewForm,
                  masquer le bouton cachait le problème au lieu de le traiter. */}
              <Pressable style={styles.writeReviewBtn} onPress={openReviewForm}>
                {myReview ? <Pencil size={12} color={accent} strokeWidth={1.75} /> : <Star size={12} color={accent} strokeWidth={1.75} />}
                <Text style={[styles.writeReviewText, { color: accent }]}>
                  {myReview ? 'Modifier mon avis' : 'Donner mon avis'}
                </Text>
              </Pressable>
            </View>

            {reviews.length === 0 ? (
              <EmptyState
                title="Aucun avis pour le moment"
                description="Soyez le premier à partager votre expérience."
              />
            ) : (
              <View style={{ gap: 10 }}>
                {reviews.slice(0, 3).map(r => (
                  <View key={r.id} style={styles.reviewCard}>
                    <View style={styles.reviewTopRow}>
                      <View style={{ flexDirection: 'row', gap: 1 }}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={11} color={colors.or} fill={i <= r.rating ? colors.or : 'transparent'} />
                        ))}
                      </View>
                      {r.is_verified_stay && (
                        <View style={styles.verifiedBadge}>
                          <BadgeCheck size={10} color={colors.fleuve} />
                          <Text style={styles.verifiedText}>Client vérifié</Text>
                        </View>
                      )}
                      <Text style={styles.reviewDate}>
                        {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>

                    {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}

                    {r.partner_reply && (
                      <View style={styles.partnerReplyBox}>
                        <MessageCircle size={11} color={colors.lave} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.partnerReplyLabel}>Réponse de l'établissement</Text>
                          <Text style={styles.partnerReplyText}>{r.partner_reply}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
                {reviews.length > 3 && (
                  <Text style={styles.moreReviewsText}>
                    + {reviews.length - 3} autre{reviews.length - 3 > 1 ? 's' : ''} avis
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Ajouter au planning */}
          <Button
            label="Ajouter à mon planning"
            variant="secondary"
            onPress={handleAddToPlanning}
            loading={addingToPlan}
            icon={<CalendarPlus size={15} color={colors.lave} strokeWidth={1.75} />}
          />

          {/* Établissements similaires — évite que la fiche soit un cul-de-sac */}
          {similar.length > 0 && (
            <View style={styles.similarSection}>
              <Text style={styles.sectionKicker}>Dans la même commune</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
                {similar.map(s => (
                  <ListingCard
                    key={s.id}
                    type={s.type}
                    name={s.name}
                    location={s.commune ? titleCase(s.commune) : s.city}
                    coverPhotoUrl={s.coverPhoto}
                    priceLabel={s.priceLabel}
                    width={200}
                    onPress={() => router.replace(`/listing/${s.id}`)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          <Pressable style={styles.reportLink} onPress={reportListing}>
            <Flag size={12} color={colors.faint} strokeWidth={1.75} />
            <Text style={styles.reportText}>Signaler une information incorrecte</Text>
          </Pressable>
          </View>

          {/* Desktop : la colonne prix reste dans le flux et colle au scroll.
              Sur mobile/tablette, elle est remplacée par la barre fixe. */}
          {isDesktop && (
            <View style={styles.desktopSidebar}>
              <View style={[styles.priceCard, styles.priceCardSticky]}>
                <View>
                  <Text style={styles.priceFrom}>À partir de</Text>
                  <Text style={styles.priceValue}>{priceLabel}</Text>
                </View>
                <Button label="Réserver" onPress={openBookingForm} color={accent} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Barre de réservation fixe — mobile et tablette uniquement */}
      {!isDesktop && (
        <View style={styles.bookingBar}>
          <View style={styles.bookingBarPrice}>
            <Text style={styles.priceFrom}>À partir de</Text>
            <Text style={styles.priceValue} numberOfLines={1}>{priceLabel}</Text>
          </View>
          <Button label="Réserver" onPress={openBookingForm} color={accent} />
        </View>
      )}

      {success && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>Demande envoyée. L'établissement vous confirmera sous 24h.</Text>
          <Pressable onPress={() => { setSuccess(false); router.push('/(tabs)/bookings'); }}>
            <Text style={styles.successLink}>Voir mes réservations →</Text>
          </Pressable>
        </View>
      )}

      <Sheet
        visible={showForm}
        onClose={() => setShowForm(false)}
        title="Demande de réservation"
        subtitle={`${establishment.name} · ${establishment.neighborhood ?? establishment.city}`}
      >
        {isHotel && <HotelBookingForm accent={accent} form={hotelForm} setForm={setHotelForm} onSubmit={handleSubmit} loading={submitting} availability={availability} />}
        {isRestaurant && <RestaurantBookingForm accent={accent} form={restaurantForm} setForm={setRestaurantForm} onSubmit={handleSubmit} loading={submitting} availability={availability} />}
        {isSite && <SiteBookingForm accent={accent} form={siteForm} setForm={setSiteForm} onSubmit={handleSubmit} loading={submitting} availability={availability} />}
      </Sheet>

      {/* Formulaire d'avis */}
      <Sheet
        visible={showReviewForm}
        onClose={() => setShowReviewForm(false)}
        title={myReview ? 'Modifier mon avis' : 'Donner mon avis'}
        subtitle={establishment.name}
      >
        <Text style={styles.fieldLabel}>Votre note</Text>
        <View style={styles.starPicker}>
          {[1, 2, 3, 4, 5].map(i => (
            <Pressable key={i} onPress={() => setReviewRating(i)} hitSlop={6}>
              <Star
                size={34}
                color={colors.or}
                fill={i <= reviewRating ? colors.or : 'transparent'}
              />
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Votre commentaire (optionnel)</Text>
        <TextInput
          style={[styles.fieldInput, { height: 100, textAlignVertical: 'top' }]}
          value={reviewComment}
          onChangeText={setReviewComment}
          placeholder="Qu'avez-vous pensé de votre expérience ?"
          placeholderTextColor={colors.faint}
          multiline
        />

        <Button
          label={myReview ? 'Enregistrer' : 'Publier mon avis'}
          onPress={handleSaveReview}
          loading={savingReview}
          disabled={reviewRating === 0}
          color={accent}
          icon={<Send size={15} color={colors.cream} strokeWidth={1.75} />}
        />

        {myReview && (
          <Pressable style={styles.deleteReviewBtn} onPress={confirmDeleteReview}>
            <Text style={styles.deleteReviewText}>Supprimer mon avis</Text>
          </Pressable>
        )}
      </Sheet>

      {/* Visionneuse plein écran — une seule implémentation, paramétrée :
          galerie principale et photos de menu/tarifs. */}
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerCounter}>
              {viewer ? `${viewer.index + 1} / ${viewerPhotos.length}` : ''}
            </Text>
            <Pressable onPress={() => setViewer(null)} hitSlop={12}>
              <X size={22} color={colors.white} strokeWidth={1.75} />
            </Pressable>
          </View>

          <View style={styles.viewerImageWrap}>
            {viewerPhoto && (
              <Image
                source={{ uri: viewerPhoto.url }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            )}
          </View>

          <View style={styles.viewerFooter}>
            <Pressable
              style={[styles.viewerNavBtn, viewer?.index === 0 && styles.viewerNavBtnDisabled]}
              onPress={() => setViewer(v => (v && v.index > 0 ? { ...v, index: v.index - 1 } : v))}
              disabled={viewer?.index === 0}
              hitSlop={10}
            >
              <ChevronLeft size={22} color={colors.white} strokeWidth={1.75} />
            </Pressable>
            <View style={{ width: 44 }} />
            <Pressable
              style={[styles.viewerNavBtn, viewer !== null && viewer.index === viewerPhotos.length - 1 && styles.viewerNavBtnDisabled]}
              onPress={() => setViewer(v => (v && v.index < viewerPhotos.length - 1 ? { ...v, index: v.index + 1 } : v))}
              disabled={viewer !== null && viewer.index === viewerPhotos.length - 1}
              hitSlop={10}
            >
              <ChevronRight size={22} color={colors.white} strokeWidth={1.75} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  errorBackLink: { alignItems: 'center', paddingVertical: 12, marginTop: spacing.sm },
  errorBackText: { ...typography.caption, color: colors.muted, textDecorationLine: 'underline' },
  hero: { height: 220, position: 'relative', overflow: 'hidden' },
  photoDots: {
    position: 'absolute', bottom: 14, alignSelf: 'center',
    flexDirection: 'row', gap: 6, zIndex: 2,
  },
  // borderRadius 3 sur 6px, 16 sur 32px : géométrie de cercle, pas un choix
  // esthétique — hors échelle à dessein (§04).
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white + '80' },
  photoDotActive: { backgroundColor: colors.white, width: 18 },
  photoCounter: {
    position: 'absolute', bottom: 12, right: spacing.md, zIndex: 2,
    backgroundColor: colors.nuit + 'A6', borderRadius: radii.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  photoCounterText: { ...typography.badgeSm, color: colors.cream },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 16, left: spacing.md,
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white + 'CC',
    alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  heroActions: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 16, right: spacing.md,
    flexDirection: 'row', gap: spacing.sm, zIndex: 3,
  },
  heroActionBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white + 'CC',
    alignItems: 'center', justifyContent: 'center',
  },
  heroFooter: { position: 'absolute', bottom: 14, left: spacing.md, right: spacing.md },
  heroCategory: { ...typography.overlineXs, color: colors.cream, textTransform: 'uppercase', marginBottom: 4, opacity: 0.9 },
  // displayStrong (Playfair 600) — première utilisation dans l'app. Rôle
  // attribué ici : nom d'entité sur un hero photo. displayHero reste réservé
  // au titre de hero éditorial (un par page, déjà pris par la Homepage).
  heroName: { ...typography.displayStrong, color: colors.cream,
    textShadowColor: colors.nuit + '80', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  body: { padding: spacing.gutter },
  // Desktop uniquement (≥1024) : colonne éditoriale flexible + colonne prix
  // étroite et sticky. Tablette/mobile gardent la colonne unique existante
  // (voir `wide` pour le centrage tablette+desktop dans breakpoints.contentMax).
  // alignItems reste au défaut ('stretch', pas 'flex-start') : desktopSidebar
  // doit avoir la même hauteur que desktopMain pour offrir de la place où
  // "coller". Le sticky lui-même va sur priceCard (styles.priceCardSticky),
  // pas sur desktopSidebar : un élément sticky doit rester plus court que son
  // conteneur pour avoir une plage de défilement dans laquelle tenir — le
  // mettre sur le conteneur étiré revient à l'annuler (rien ne "dépasse").
  bodyDesktopRow: { flexDirection: 'row', gap: spacing.xl },
  desktopMain: { flex: 1, minWidth: 0 },
  desktopSidebar: { width: 320 },
  priceCardSticky: Platform.OS === 'web' ? { position: 'sticky' as any, top: spacing.lg } : {},
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12, flexWrap: 'wrap' },
  metaText: { ...typography.caption, color: colors.muted },
  metaStrong: { ...typography.caption, color: colors.ink },
  metaSeparator: { ...typography.caption, color: colors.faint },
  dateTabs: { flexDirection: 'row', gap: spacing.sm + 2, marginBottom: spacing.sm + 2 },
  dateTab: {
    flex: 1, backgroundColor: colors.surfaceSunken, borderWidth: 1.5, borderColor: 'transparent',
    borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 9,
  },
  dateTabLabel: { ...typography.overlineXs, color: colors.muted, marginBottom: 2 },
  dateTabValue: { ...typography.caption, color: colors.ink },
  dateTabPlaceholder: { color: colors.faint },
  slotHint: { ...typography.caption, color: colors.faint, marginBottom: 12 },
  chipFull: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  chipTextFull: { color: colors.danger, textDecorationLine: 'line-through' },
  // Contact — rangée segmentée, un seul conteneur, séparateurs fins.
  contactRow: {
    flexDirection: 'row', alignItems: 'stretch', marginBottom: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.white,
  },
  contactCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  contactDivider: { width: 1, backgroundColor: colors.border },
  contactLabel: { ...typography.caption, color: colors.ink },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  followLabel: { ...typography.caption, color: colors.faint },
  followLink: { ...typography.caption, textDecorationLine: 'underline' },
  amenitiesRow: { marginBottom: spacing.md },
  amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6, marginRight: spacing.sm },
  amenityText: { ...typography.caption, color: colors.ink },
  section: { marginBottom: spacing.md },
  sectionKicker: { ...typography.overline, color: colors.faint, textTransform: 'uppercase', marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.muted },
  menuThumb: { width: 130, height: 170, borderRadius: radii.md, backgroundColor: colors.surfaceSunken },
  // Adresse — hiérarchie typographique + filet, pas de carte blanche bordée.
  addressBlock: { gap: 3, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 12 },
  addressStreet: { ...typography.cardTitle, color: colors.ink },
  addressArea: { ...typography.caption, color: colors.muted },
  addressReference: { ...typography.caption, color: colors.faint },
  directionsLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  directionsText: { ...typography.caption, textDecorationLine: 'underline' },
  reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  writeReviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  writeReviewText: { ...typography.caption },
  reviewCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 12 },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 7 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.fleuveSoft, borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 2 },
  verifiedText: { ...typography.badgeSm, color: colors.fleuve },
  reviewDate: { ...typography.badgeSm, color: colors.faint, marginLeft: 'auto' },
  reviewComment: { ...typography.caption, color: colors.ink, lineHeight: 18 },
  partnerReplyBox: { flexDirection: 'row', gap: 7, backgroundColor: colors.laveSoft, borderRadius: radii.sm, padding: 9, marginTop: 9 },
  partnerReplyLabel: { ...typography.badgeSm, color: colors.lave, marginBottom: 2 },
  partnerReplyText: { ...typography.caption, color: colors.ink, lineHeight: 16 },
  moreReviewsText: { ...typography.caption, color: colors.muted, textAlign: 'center', paddingTop: 2 },
  similarSection: { marginTop: spacing.lg },
  similarRow: { gap: 12, paddingBottom: spacing.xs },
  reportLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, marginTop: spacing.sm },
  reportText: { ...typography.caption, color: colors.faint, textDecorationLine: 'underline' },
  starPicker: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm + 2, marginBottom: spacing.md, marginTop: spacing.xs },
  deleteReviewBtn: { alignItems: 'center', paddingVertical: 12, marginTop: spacing.xs },
  deleteReviewText: { ...typography.caption, color: colors.danger },
  priceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  priceFrom: { ...typography.overlineXs, color: colors.muted, textTransform: 'uppercase' },
  priceValue: { ...typography.displayMd, color: colors.ink },
  // Barre de réservation fixe (mobile/tablette) — filet supérieur, pas d'ombre.
  bookingBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  bookingBarPrice: { flex: 1 },
  successBanner: { position: 'absolute', bottom: 96, left: spacing.md, right: spacing.md,
    backgroundColor: colors.success, borderRadius: radii.md, padding: spacing.md, gap: 6 },
  successText: { ...typography.caption, color: colors.cream },
  successLink: { ...typography.caption, color: colors.amber },
  formRow: { flexDirection: 'row', gap: spacing.sm + 2 },
  fieldLabel: { ...typography.caption, color: colors.ink, marginBottom: 5 },
  fieldInput: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, ...typography.body, color: colors.ink },
  counter: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.sm, padding: 10, gap: spacing.xs, marginBottom: 12 },
  counterLabel: { ...typography.overlineXs, color: colors.muted },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // 26px carré, rayon 8 (radii.sm) : pas un cercle, valeur d'échelle.
  counterBtn: { width: 26, height: 26, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  counterBtnMuted: { backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border },
  counterValue: { ...typography.sheetOption, color: colors.ink },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  chipText: { ...typography.caption, color: colors.muted },

  // Visionneuse plein écran (galerie + menu)
  viewerOverlay: { flex: 1, backgroundColor: colors.nuit + 'F0' },
  viewerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : spacing.lg, paddingHorizontal: spacing.gutter, paddingBottom: 12,
  },
  viewerCounter: { ...typography.caption, color: colors.white },
  viewerImageWrap: { flex: 1, paddingHorizontal: 10 },
  viewerFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 12,
  },
  viewerNavBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  viewerNavBtnDisabled: { opacity: 0.3 },
});