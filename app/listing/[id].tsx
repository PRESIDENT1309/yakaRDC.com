import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, Modal, TextInput, KeyboardAvoidingView,
  ActivityIndicator, Alert, Image, useWindowDimensions, Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Svg, { Circle, Polygon, Path } from 'react-native-svg';
import {
  ArrowLeft, Heart, MapPin, Star, Wifi, Car,
  Wind, Coffee, Plus, Minus, X, Send,
  Phone, Mail, AtSign, Music2, CalendarPlus,
  ChevronLeft, ChevronRight, MessageCircle, BadgeCheck, Pencil,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors } from '../../lib/theme';
import Calendar, { formatFrench } from '../../components/Calendar';
import type { Establishment, Rate, EstablishmentType, ListingPhoto, Review } from '../../lib/types';

// Disponibilités transmises aux formulaires de réservation
interface Availability {
  fullDays: Set<string>;
  slotLoads: Record<string, number>;
  capacity: number | null;
}

type TimeSlot = string;

interface BaseForm {
  firstName: string; lastName: string; phone: string;
  adults: number; children: number; notes: string;
}
interface HotelForm extends BaseForm {
  checkIn: string; checkOut: string;
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
  { key: 'birthday', label: 'Anniversaire 🎂' },
  { key: 'business', label: 'Business 💼' },
  { key: 'romantic', label: 'Romantique 💑' },
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

function HeroIllustration({ type, accent, soft }: { type: EstablishmentType; accent: string; soft: string }) {
  return (
    <Svg width="100%" height="220" viewBox="0 0 390 220" preserveAspectRatio="xMidYMid slice">
      <Circle cx="320" cy="70" r="60" fill={soft} opacity={0.8} />
      <Circle cx="320" cy="70" r="44" fill={accent} opacity={0.3} />
      <Circle cx="320" cy="70" r="30" fill={accent} opacity={0.5} />
      {type === 'hotel' || type === 'furnished_house' ? (
        <>
          <Polygon points="80,220 130,120 180,220" fill={accent} opacity={0.25} />
          <Polygon points="140,220 200,90 260,220" fill={accent} opacity={0.35} />
          <Polygon points="230,220 280,140 330,220" fill={accent} opacity={0.2} />
        </>
      ) : type === 'restaurant' ? (
        <>
          <Circle cx="80" cy="160" r="50" fill={accent} opacity={0.15} />
          <Circle cx="180" cy="180" r="65" fill={accent} opacity={0.1} />
          <Circle cx="290" cy="155" r="45" fill={accent} opacity={0.15} />
        </>
      ) : (
        <>
          <Polygon points="30,220 90,100 150,220" fill={accent} opacity={0.2} />
          <Polygon points="120,220 200,60 280,220" fill={accent} opacity={0.3} />
          <Path d="M200,60 C198,45 208,38 203,22" stroke={soft} strokeWidth="3" fill="none" opacity={0.6} strokeLinecap="round" />
          <Polygon points="260,220 310,140 360,220" fill={accent} opacity={0.2} />
        </>
      )}
    </Svg>
  );
}

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
          <Plus size={14} color="#FAF8F4" />
        </Pressable>
      </View>
    </View>
  );
}

function FormField({ label, value, onChange, placeholder, keyboardType = 'default', multiline = false }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string;
    keyboardType?: any; multiline?: boolean }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colors.faint} keyboardType={keyboardType}
        multiline={multiline} numberOfLines={multiline ? 3 : 1}
      />
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
              isSelected && { color: '#FAF8F4', fontWeight: '500' },
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
      <FormField label="Téléphone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+243 8xx xxx xxx" keyboardType="phone-pad" />

      <Text style={styles.fieldLabel}>Dates du séjour</Text>
      <View style={styles.dateTabs}>
        <Pressable
          style={[styles.dateTab, dateMode === 'in' && { borderColor: accent, backgroundColor: '#FFFFFF' }]}
          onPress={() => setDateMode('in')}
        >
          <Text style={styles.dateTabLabel}>Arrivée</Text>
          <Text style={[styles.dateTabValue, !form.checkIn && styles.dateTabPlaceholder]}>
            {form.checkIn ? formatFrench(form.checkIn) : 'Choisir'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.dateTab, dateMode === 'out' && { borderColor: accent, backgroundColor: '#FFFFFF' }]}
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

      <Text style={styles.fieldLabel}>Voyageurs</Text>
      <View style={styles.formRow}>
        <Counter label="Adultes" value={form.adults} accent={accent} onDec={() => setForm({ ...form, adults: Math.max(1, form.adults - 1) })} onInc={() => setForm({ ...form, adults: form.adults + 1 })} />
        <Counter label="Enfants" value={form.children} accent={accent} onDec={() => setForm({ ...form, children: Math.max(0, form.children - 1) })} onInc={() => setForm({ ...form, children: form.children + 1 })} />
      </View>
      <Text style={styles.fieldLabel}>Mode de paiement</Text>
      <View style={[styles.formRow, { flexWrap: 'wrap', gap: 6 }]}>
        {PAYMENTS.map(p => (
          <Pressable key={p.key} style={[styles.chip, form.paymentMethod === p.key && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, paymentMethod: p.key as any })}>
            <Text style={[styles.chipText, form.paymentMethod === p.key && { color: '#FAF8F4', fontWeight: '500' }]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <FormField label="Demandes spéciales (optionnel)" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Chambre calme, lit king size..." multiline />
      <Pressable style={[styles.submitBtn, { backgroundColor: accent }]} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FAF8F4" /> : <><Send size={15} color="#FAF8F4" /><Text style={styles.submitBtnText}>Envoyer la demande</Text></>}
      </Pressable>
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
      <FormField label="Téléphone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+243 8xx xxx xxx" keyboardType="phone-pad" />

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
            <Text style={[styles.chipText, form.occasion === o.key && { color: '#FAF8F4', fontWeight: '500' }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      <FormField label="Allergies / régimes (optionnel)" value={form.allergies} onChange={v => setForm({ ...form, allergies: v })} placeholder="Sans gluten, végétarien..." multiline />
      <Pressable style={[styles.submitBtn, { backgroundColor: accent }]} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FAF8F4" /> : <><Send size={15} color="#FAF8F4" /><Text style={styles.submitBtnText}>Réserver la table</Text></>}
      </Pressable>
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
      <FormField label="Téléphone (responsable)" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+243 8xx xxx xxx" keyboardType="phone-pad" />

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
        {[{ key: 'guided', label: 'Guidée 🎒' }, { key: 'free', label: 'Libre 🗺️' }].map(v => (
          <Pressable key={v.key} style={[styles.chip, { flex: 1 }, form.visitType === v.key && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, visitType: v.key as any })}>
            <Text style={[styles.chipText, { textAlign: 'center' }, form.visitType === v.key && { color: '#FAF8F4', fontWeight: '500' }]}>{v.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.fieldLabel}>Nationalité</Text>
      <View style={styles.formRow}>
        {[{ key: 'congolaise', label: '🇨🇩 Congolaise' }, { key: 'etrangere', label: '🌍 Étrangère' }].map(n => (
          <Pressable key={n.key} style={[styles.chip, { flex: 1 }, form.nationality === n.key && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, nationality: n.key as any })}>
            <Text style={[styles.chipText, { textAlign: 'center' }, form.nationality === n.key && { color: '#FAF8F4', fontWeight: '500' }]}>{n.label}</Text>
          </Pressable>
        ))}
      </View>
      <FormField label="Remarques (optionnel)" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Accessibilité PMR, équipement spécial..." multiline />
      <Pressable style={[styles.submitBtn, { backgroundColor: accent }]} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FAF8F4" /> : <><Send size={15} color="#FAF8F4" /><Text style={styles.submitBtnText}>Réserver la visite</Text></>}
      </Pressable>
    </ScrollView>
  );
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const { width: heroWidth } = useWindowDimensions();
  const photoScrollRef = useRef<ScrollView>(null);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [rate, setRate] = useState<Rate | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [menuPhotos, setMenuPhotos] = useState<ListingPhoto[]>([]);
  const [menuViewerIndex, setMenuViewerIndex] = useState<number | null>(null);
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

  const [hotelForm, setHotelForm] = useState<HotelForm>({
    firstName: '', lastName: '', phone: profile?.phone ?? '',
    adults: 1, children: 0, checkIn: '', checkOut: '', paymentMethod: 'cash', notes: '',
  });
  const [restaurantForm, setRestaurantForm] = useState<RestaurantForm>({
    firstName: '', lastName: '', phone: profile?.phone ?? '',
    adults: 2, children: 0, visitDate: '', timeSlot: '', occasion: 'none', allergies: '', notes: '',
  });
  const [siteForm, setSiteForm] = useState<SiteForm>({
    firstName: '', lastName: '', phone: profile?.phone ?? '',
    adults: 1, children: 0, visitDate: '', timeSlot: '', visitType: 'guided', nationality: 'congolaise', notes: '',
  });

  useEffect(() => {
    supabase.from('establishments').select('*').eq('id', id).single()
      .then(({ data }) => setEstablishment(data as Establishment));
    supabase.from('rates').select('*').eq('establishment_id', id).limit(1).maybeSingle()
      .then(({ data }) => setRate(data as Rate | null));
    supabase.from('listing_photos').select('*').eq('establishment_id', id).order('position', { ascending: true })
      .then(({ data }) => {
        const all = (data as ListingPhoto[]) ?? [];
        setPhotos(all.filter(p => !p.category || p.category === 'general'));
        setMenuPhotos(all.filter(p => p.category === 'menu' || p.category === 'pricing'));
      });
    // Compte cette visite pour les statistiques du partenaire (une fois par ouverture)
    supabase.rpc('increment_establishment_views', { p_establishment_id: id });
  }, [id]);

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

  function openReviewForm() {
    setReviewRating(myReview?.rating ?? 0);
    setReviewComment(myReview?.comment ?? '');
    setShowReviewForm(true);
  }

  async function handleSaveReview() {
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

  function confirmDeleteReview() {
    if (!myReview) return;
    Alert.alert('Supprimer mon avis', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('reviews').delete().eq('id', myReview.id);
        setShowReviewForm(false);
        fetchReviews();
      }},
    ]);
  }

  useEffect(() => {
    if (!session?.user) return;
    supabase.from('favorites').select('id')
      .eq('traveler_id', session.user.id).eq('establishment_id', id)
      .maybeSingle()
      .then(({ data }) => setIsFavorited(!!data));
  }, [id, session?.user?.id]);

  async function toggleFavorite() {
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

  if (!establishment) {
    return <View style={styles.loading}><ActivityIndicator color={colors.lave} /></View>;
  }

  const cat = categoryColors[establishment.type];
  const accent = cat?.accent ?? colors.lave;
  const soft = cat?.soft ?? '#FAECE7';
  const isHotel = establishment.type === 'hotel' || establishment.type === 'furnished_house';
  const isRestaurant = establishment.type === 'restaurant';
  const isSite = establishment.type === 'site';
  const menuSectionTitle = isRestaurant ? 'Menu' : 'Tarifs des attractions';
  const currentMenuPhoto = menuViewerIndex !== null ? menuPhotos[menuViewerIndex] : null;

  const availability: Availability = {
    fullDays,
    slotLoads,
    capacity: establishment.capacity ?? null,
  };

  // Note moyenne réelle, calculée depuis les avis chargés
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;

  async function handleSubmit() {
    if (!session?.user) return;
    setSubmitting(true);
    let payload: any = { establishment_id: id, traveler_id: session.user.id };

    if (isHotel) {
      const f = hotelForm;
      if (!f.firstName || !f.lastName || !f.checkIn || !f.checkOut) {
        Alert.alert('Champs requis', 'Veuillez remplir prénom, nom et les dates.');
        setSubmitting(false); return;
      }
      payload = { ...payload, first_name: f.firstName, last_name: f.lastName,
        contact_phone: f.phone, guests: f.adults, children: f.children,
        check_in: f.checkIn, check_out: f.checkOut, notes: f.notes || null,
        metadata: { payment_method: f.paymentMethod } };
    } else if (isRestaurant) {
      const f = restaurantForm;
      if (!f.firstName || !f.lastName || !f.visitDate || !f.timeSlot) {
        Alert.alert('Champs requis', 'Veuillez remplir prénom, nom, date et créneau.');
        setSubmitting(false); return;
      }
      payload = { ...payload, first_name: f.firstName, last_name: f.lastName,
        contact_phone: f.phone, guests: f.adults, children: f.children,
        visit_date: f.visitDate, visit_time: f.timeSlot, notes: f.notes || null,
        metadata: { time_slot: f.timeSlot, occasion: f.occasion, allergies: f.allergies } };
    } else if (isSite) {
      const f = siteForm;
      if (!f.firstName || !f.lastName || !f.visitDate || !f.timeSlot) {
        Alert.alert('Champs requis', 'Veuillez remplir prénom, nom, date et créneau.');
        setSubmitting(false); return;
      }
      payload = { ...payload, first_name: f.firstName, last_name: f.lastName,
        contact_phone: f.phone, guests: f.adults, children: f.children,
        visit_date: f.visitDate, visit_time: f.timeSlot, notes: f.notes || null,
        metadata: { time_slot: f.timeSlot, visit_type: f.visitType, nationality: f.nationality } };
    }

    const { error } = await supabase.from('bookings').insert(payload);
    setSubmitting(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    setShowForm(false);
    setSuccess(true);
  }

  const priceLabel = rate
    ? `${rate.price} ${rate.currency} / ${rate.unit === 'night' ? 'nuit' : rate.unit === 'person' ? 'pers.' : 'visite'}`
    : 'Tarif sur demande';

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
                {photos.map((photo) => (
                  <Image
                    key={photo.id}
                    source={{ uri: photo.url }}
                    style={{ width: heroWidth, height: '100%' }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]}
              />
              {photos.length > 1 && (
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
              )}
            </>
          ) : (
            <>
              <HeroIllustration type={establishment.type} accent={accent} soft={soft} />
              <View style={StyleSheet.absoluteFill}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />
              </View>
            </>
          )}
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={16} color={colors.ink} />
          </Pressable>
          <Pressable style={styles.heartBtn} onPress={toggleFavorite} disabled={favoriteLoading}>
            <Heart size={16} color={isFavorited ? '#C0392B' : colors.ink} fill={isFavorited ? '#C0392B' : 'transparent'} />
          </Pressable>
          <View style={styles.heroFooter}>
            <View style={[styles.typeBadge, { backgroundColor: accent }]}>
              <Text style={styles.typeBadgeText}>{cat?.label}</Text>
            </View>
            <Text style={styles.heroName}>{establishment.name}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.metaRow}>
            <View style={styles.locationRow}>
              <MapPin size={13} color={colors.faint} />
              <Text style={styles.locationText}>
                {establishment.neighborhood ? `${establishment.neighborhood}, ` : ''}{establishment.city}
              </Text>
            </View>
            {avgRating != null ? (
              <View style={styles.ratingRow}>
                <Star size={12} color="#854F0B" fill="#854F0B" />
                <Text style={styles.ratingText}>{avgRating.toFixed(1)}</Text>
                <Text style={styles.ratingCount}>({reviews.length})</Text>
              </View>
            ) : (
              <View style={styles.newRow}>
                <Text style={styles.newRowText}>Nouveau</Text>
              </View>
            )}
          </View>

          {/* Contact — rangée compacte d'icônes rondes */}
          {(establishment.phone || establishment.email || establishment.instagram || establishment.tiktok) && (
            <View style={styles.contactIconsRow}>
              {establishment.phone && (
                <Pressable style={[styles.contactIconBtn, { backgroundColor: soft }]} onPress={() => Linking.openURL(`tel:${establishment.phone}`)}>
                  <Phone size={17} color={accent} />
                </Pressable>
              )}
              {establishment.email && (
                <Pressable style={[styles.contactIconBtn, { backgroundColor: soft }]} onPress={() => Linking.openURL(`mailto:${establishment.email}`)}>
                  <Mail size={17} color={accent} />
                </Pressable>
              )}
              {establishment.instagram && (
                <Pressable
                  style={[styles.contactIconBtn, { backgroundColor: soft }]}
                  onPress={() => Linking.openURL(`https://instagram.com/${establishment.instagram!.replace('@', '')}`)}
                >
                  <AtSign size={17} color={accent} />
                </Pressable>
              )}
              {establishment.tiktok && (
                <Pressable
                  style={[styles.contactIconBtn, { backgroundColor: soft }]}
                  onPress={() => Linking.openURL(`https://tiktok.com/@${establishment.tiktok!.replace('@', '')}`)}
                >
                  <Music2 size={17} color={accent} />
                </Pressable>
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
              <Text style={styles.sectionTitle}>À propos</Text>
              <Text style={styles.description}>{establishment.description}</Text>
            </View>
          )}

          {/* Menu (restaurant) ou Tarifs (site) */}
          {menuPhotos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{menuSectionTitle}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {menuPhotos.map((photo, i) => (
                  <Pressable key={photo.id} onPress={() => setMenuViewerIndex(i)}>
                    <Image source={{ uri: photo.url }} style={styles.menuThumb} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Adresse complète */}
          {(establishment.commune || establishment.avenue || establishment.reference) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Adresse</Text>
              <View style={styles.addressBox}>
                {establishment.commune && (
                  <View style={styles.addressRow}>
                    <MapPin size={13} color={colors.faint} />
                    <Text style={styles.addressText}>
                      Commune de {establishment.commune}
                      {establishment.neighborhood ? `, ${establishment.neighborhood}` : ''}
                    </Text>
                  </View>
                )}
                {establishment.avenue && (
                  <Text style={styles.addressSubText}>
                    Avenue {establishment.avenue}{establishment.numero ? `, n°${establishment.numero}` : ''}
                  </Text>
                )}
                {establishment.reference && (
                  <Text style={styles.addressSubText}>📍 {establishment.reference}</Text>
                )}
              </View>
            </View>
          )}

          {/* Avis */}
          <View style={styles.section}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>
                Avis {reviews.length > 0 ? `(${reviews.length})` : ''}
              </Text>
              {session?.user && (
                <Pressable style={styles.writeReviewBtn} onPress={openReviewForm}>
                  {myReview ? <Pencil size={12} color={accent} /> : <Star size={12} color={accent} />}
                  <Text style={[styles.writeReviewText, { color: accent }]}>
                    {myReview ? 'Modifier mon avis' : 'Donner mon avis'}
                  </Text>
                </Pressable>
              )}
            </View>

            {reviews.length === 0 ? (
              <Text style={styles.noReviewsText}>
                Aucun avis pour le moment. Soyez le premier à partager votre expérience.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {reviews.slice(0, 3).map(r => (
                  <View key={r.id} style={styles.reviewCard}>
                    <View style={styles.reviewTopRow}>
                      <View style={{ flexDirection: 'row', gap: 1 }}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={11} color="#854F0B" fill={i <= r.rating ? '#854F0B' : 'transparent'} />
                        ))}
                      </View>
                      {r.is_verified_stay && (
                        <View style={styles.verifiedBadge}>
                          <BadgeCheck size={10} color="#0F6E56" />
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
          <Pressable style={styles.planBtn} onPress={handleAddToPlanning} disabled={addingToPlan}>
            {addingToPlan ? (
              <ActivityIndicator color={colors.lave} size="small" />
            ) : (
              <>
                <CalendarPlus size={15} color={colors.lave} />
                <Text style={styles.planBtnText}>Ajouter à mon planning</Text>
              </>
            )}
          </Pressable>

          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceFrom}>À partir de</Text>
              <Text style={styles.priceValue}>{priceLabel}</Text>
            </View>
            <Pressable style={[styles.bookBtn, { backgroundColor: accent }]} onPress={() => setShowForm(true)}>
              <Text style={styles.bookBtnText}>Réserver</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {success && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✅ Demande envoyée ! L'établissement vous confirmera sous 24h.</Text>
          <Pressable onPress={() => { setSuccess(false); router.push('/(tabs)/bookings'); }}>
            <Text style={styles.successLink}>Voir mes réservations →</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowForm(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Demande de réservation</Text>
                <Text style={styles.modalSub}>{establishment.name} · {establishment.neighborhood ?? establishment.city}</Text>
              </View>
              <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>
            {isHotel && <HotelBookingForm accent={accent} form={hotelForm} setForm={setHotelForm} onSubmit={handleSubmit} loading={submitting} availability={availability} />}
            {isRestaurant && <RestaurantBookingForm accent={accent} form={restaurantForm} setForm={setRestaurantForm} onSubmit={handleSubmit} loading={submitting} availability={availability} />}
            {isSite && <SiteBookingForm accent={accent} form={siteForm} setForm={setSiteForm} onSubmit={handleSubmit} loading={submitting} availability={availability} />}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Formulaire d'avis */}
      <Modal visible={showReviewForm} transparent animationType="slide" onRequestClose={() => setShowReviewForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowReviewForm(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{myReview ? 'Modifier mon avis' : 'Donner mon avis'}</Text>
                <Text style={styles.modalSub}>{establishment.name}</Text>
              </View>
              <Pressable onPress={() => setShowReviewForm(false)} hitSlop={8}>
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Votre note</Text>
            <View style={styles.starPicker}>
              {[1, 2, 3, 4, 5].map(i => (
                <Pressable key={i} onPress={() => setReviewRating(i)} hitSlop={6}>
                  <Star
                    size={34}
                    color="#854F0B"
                    fill={i <= reviewRating ? '#854F0B' : 'transparent'}
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

            <Pressable
              style={[styles.submitBtn, { backgroundColor: accent }, (reviewRating === 0 || savingReview) && { opacity: 0.5 }]}
              onPress={handleSaveReview}
              disabled={reviewRating === 0 || savingReview}
            >
              {savingReview
                ? <ActivityIndicator color="#FAF8F4" />
                : <><Send size={15} color="#FAF8F4" /><Text style={styles.submitBtnText}>{myReview ? 'Enregistrer' : 'Publier mon avis'}</Text></>}
            </Pressable>

            {myReview && (
              <Pressable style={styles.deleteReviewBtn} onPress={confirmDeleteReview}>
                <Text style={styles.deleteReviewText}>Supprimer mon avis</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Visionneuse plein écran : Menu / Tarifs */}
      <Modal visible={menuViewerIndex !== null} transparent animationType="fade" onRequestClose={() => setMenuViewerIndex(null)}>
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerCounter}>
              {menuViewerIndex !== null ? `${menuViewerIndex + 1} / ${menuPhotos.length}` : ''}
            </Text>
            <Pressable onPress={() => setMenuViewerIndex(null)} hitSlop={12}>
              <X size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.viewerImageWrap}>
            {currentMenuPhoto && (
              <Image
                source={{ uri: currentMenuPhoto.url }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            )}
          </View>

          <View style={styles.viewerFooter}>
            <Pressable
              style={[styles.viewerNavBtn, menuViewerIndex === 0 && styles.viewerNavBtnDisabled]}
              onPress={() => setMenuViewerIndex(i => (i !== null && i > 0 ? i - 1 : i))}
              disabled={menuViewerIndex === 0}
              hitSlop={10}
            >
              <ChevronLeft size={22} color="#FFFFFF" />
            </Pressable>
            <View style={{ width: 44 }} />
            <Pressable
              style={[styles.viewerNavBtn, menuViewerIndex === menuPhotos.length - 1 && styles.viewerNavBtnDisabled]}
              onPress={() => setMenuViewerIndex(i => (i !== null && i < menuPhotos.length - 1 ? i + 1 : i))}
              disabled={menuViewerIndex === menuPhotos.length - 1}
              hitSlop={10}
            >
              <ChevronRight size={22} color="#FFFFFF" />
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
  hero: { height: 220, position: 'relative', overflow: 'hidden' },
  photoDots: {
    position: 'absolute', bottom: 14, alignSelf: 'center',
    flexDirection: 'row', gap: 6, zIndex: 2,
  },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  photoDotActive: { backgroundColor: '#FFFFFF', width: 18 },
  backBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 16, left: 16,
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFFCC',
    alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  heartBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 16, right: 16,
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFFCC',
    alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  heroFooter: { position: 'absolute', bottom: 14, left: 16 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginBottom: 4 },
  typeBadgeText: { fontSize: 10, fontWeight: '500', color: '#FAF8F4' },
  heroName: { fontSize: 20, fontWeight: '500', color: '#FAF8F4',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  body: { padding: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 13, color: colors.muted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FAEEDA', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  ratingText: { fontSize: 12, color: '#854F0B', fontWeight: '500' },
  ratingCount: { fontSize: 11, color: colors.muted },
  newRow: { backgroundColor: '#E1F5EE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  newRowText: { fontSize: 11, color: '#0F6E56', fontWeight: '600' },
  dateTabs: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dateTab: {
    flex: 1, backgroundColor: '#F5F4F0', borderWidth: 1.5, borderColor: 'transparent',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  dateTabLabel: { fontSize: 10, color: colors.muted, marginBottom: 2 },
  dateTabValue: { fontSize: 12.5, fontWeight: '500', color: colors.ink },
  dateTabPlaceholder: { color: colors.faint, fontWeight: '400' },
  slotHint: { fontSize: 12, color: colors.faint, marginBottom: 12 },
  chipFull: { backgroundColor: '#FFF0F0', borderColor: '#F5D5D5' },
  chipTextFull: { color: '#C0392B', textDecorationLine: 'line-through' },
  contactIconsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  contactIconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  amenitiesRow: { marginBottom: 16 },
  amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  amenityText: { fontSize: 11, color: colors.ink },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '500', color: colors.ink, marginBottom: 6 },
  description: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  menuThumb: { width: 130, height: 170, borderRadius: 12, backgroundColor: '#F5F4F0', marginRight: 4 },
  addressBox: { gap: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressText: { fontSize: 13, color: colors.ink },
  addressSubText: { fontSize: 12, color: colors.muted, marginLeft: 19 },
  planBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.lave, borderRadius: 12, paddingVertical: 13, marginBottom: 14, backgroundColor: colors.laveSoft },
  planBtnText: { fontSize: 13.5, fontWeight: '500', color: colors.lave },
  reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  writeReviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  writeReviewText: { fontSize: 11.5, fontWeight: '600' },
  noReviewsText: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  reviewCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E1F5EE', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  verifiedText: { fontSize: 9, color: '#0F6E56', fontWeight: '600' },
  reviewDate: { fontSize: 10, color: colors.faint, marginLeft: 'auto' },
  reviewComment: { fontSize: 12.5, color: colors.ink, lineHeight: 18 },
  partnerReplyBox: { flexDirection: 'row', gap: 7, backgroundColor: colors.laveSoft, borderRadius: 8, padding: 9, marginTop: 9 },
  partnerReplyLabel: { fontSize: 9.5, color: colors.lave, fontWeight: '600', marginBottom: 2 },
  partnerReplyText: { fontSize: 11.5, color: colors.ink, lineHeight: 16 },
  moreReviewsText: { fontSize: 11.5, color: colors.muted, textAlign: 'center', paddingTop: 2 },
  starPicker: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16, marginTop: 4 },
  deleteReviewBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  deleteReviewText: { fontSize: 12, color: '#C0392B' },
  priceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  priceFrom: { fontSize: 11, color: colors.muted },
  priceValue: { fontSize: 18, fontWeight: '500', color: colors.ink },
  bookBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  bookBtnText: { fontSize: 14, fontWeight: '500', color: '#FAF8F4' },
  successBanner: { position: 'absolute', bottom: 90, left: 16, right: 16,
    backgroundColor: '#1F4D3A', borderRadius: 14, padding: 14, gap: 6 },
  successText: { fontSize: 13, color: '#FAF8F4' },
  successLink: { fontSize: 13, color: '#FAC775', fontWeight: '500' },
  modalOverlay: { flex: 1 },
  modalSheet: { backgroundColor: '#FAF8F4', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, maxHeight: '90%' },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.borderStrong, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalTitle: { fontSize: 17, fontWeight: '500', color: colors.ink },
  modalSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  formRow: { flexDirection: 'row', gap: 10 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.ink, marginBottom: 5 },
  fieldInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink },
  fieldInputMulti: { height: 70, textAlignVertical: 'top' },
  counter: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 10, gap: 4, marginBottom: 12 },
  counterLabel: { fontSize: 10, color: colors.muted },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterBtn: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  counterBtnMuted: { backgroundColor: '#F5F4F0', borderWidth: 1, borderColor: colors.border },
  counterValue: { fontSize: 16, fontWeight: '500', color: colors.ink },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  chipText: { fontSize: 12, color: colors.muted },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  submitBtnText: { fontSize: 15, fontWeight: '500', color: '#FAF8F4' },

  // Visionneuse Menu / Tarifs
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  viewerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 18, paddingBottom: 12,
  },
  viewerCounter: { fontSize: 13, color: '#FFFFFF', fontWeight: '500' },
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