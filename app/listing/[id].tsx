import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, Modal, TextInput, KeyboardAvoidingView,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Svg, { Circle, Polygon, Path } from 'react-native-svg';
import {
  ArrowLeft, Heart, MapPin, Star, Wifi, Car,
  Wind, Coffee, Plus, Minus, X, Send,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors } from '../../lib/theme';
import type { Establishment, Rate, EstablishmentType, ListingPhoto } from '../../lib/types';

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

function HotelBookingForm({ accent, form, setForm, onSubmit, loading }:
  { accent: string; form: HotelForm; setForm: (f: HotelForm) => void; onSubmit: () => void; loading: boolean }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}><FormField label="Prénom" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} placeholder="Jean" /></View>
        <View style={{ flex: 1 }}><FormField label="Nom" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} placeholder="Mbeki" /></View>
      </View>
      <FormField label="Téléphone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+243 8xx xxx xxx" keyboardType="phone-pad" />
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}><FormField label="Arrivée (JJ/MM/AAAA)" value={form.checkIn} onChange={v => setForm({ ...form, checkIn: v })} placeholder="20/06/2026" /></View>
        <View style={{ flex: 1 }}><FormField label="Départ (JJ/MM/AAAA)" value={form.checkOut} onChange={v => setForm({ ...form, checkOut: v })} placeholder="23/06/2026" /></View>
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

function RestaurantBookingForm({ accent, form, setForm, onSubmit, loading }:
  { accent: string; form: RestaurantForm; setForm: (f: RestaurantForm) => void; onSubmit: () => void; loading: boolean }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}><FormField label="Prénom" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} placeholder="Marie" /></View>
        <View style={{ flex: 1 }}><FormField label="Nom" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} placeholder="Kalala" /></View>
      </View>
      <FormField label="Téléphone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+243 8xx xxx xxx" keyboardType="phone-pad" />
      <FormField label="Date (JJ/MM/AAAA)" value={form.visitDate} onChange={v => setForm({ ...form, visitDate: v })} placeholder="21/06/2026" />
      <Text style={styles.fieldLabel}>Créneau horaire</Text>
      <View style={[styles.formRow, { flexWrap: 'wrap', gap: 6 }]}>
        {RESTAURANT_SLOTS.map(s => (
          <Pressable key={s} style={[styles.chip, form.timeSlot === s && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, timeSlot: s })}>
            <Text style={[styles.chipText, form.timeSlot === s && { color: '#FAF8F4', fontWeight: '500' }]}>{s}</Text>
          </Pressable>
        ))}
      </View>
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

function SiteBookingForm({ accent, form, setForm, onSubmit, loading }:
  { accent: string; form: SiteForm; setForm: (f: SiteForm) => void; onSubmit: () => void; loading: boolean }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}><FormField label="Prénom" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} placeholder="Pierre" /></View>
        <View style={{ flex: 1 }}><FormField label="Nom" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} placeholder="Tshimanga" /></View>
      </View>
      <FormField label="Téléphone (responsable)" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+243 8xx xxx xxx" keyboardType="phone-pad" />
      <FormField label="Date de visite (JJ/MM/AAAA)" value={form.visitDate} onChange={v => setForm({ ...form, visitDate: v })} placeholder="22/06/2026" />
      <Text style={styles.fieldLabel}>Créneau d'entrée</Text>
      <View style={[styles.formRow, { flexWrap: 'wrap', gap: 6 }]}>
        {SITE_SLOTS.map(s => (
          <Pressable key={s} style={[styles.chip, form.timeSlot === s && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, timeSlot: s })}>
            <Text style={[styles.chipText, form.timeSlot === s && { color: '#FAF8F4', fontWeight: '500' }]}>{s}</Text>
          </Pressable>
        ))}
      </View>
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
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [rate, setRate] = useState<Rate | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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
      .then(({ data }) => setPhotos((data as ListingPhoto[]) ?? []));
  }, [id]);

  if (!establishment) {
    return <View style={styles.loading}><ActivityIndicator color={colors.lave} /></View>;
  }

  const cat = categoryColors[establishment.type];
  const accent = cat?.accent ?? colors.lave;
  const soft = cat?.soft ?? '#FAECE7';
  const isHotel = establishment.type === 'hotel' || establishment.type === 'furnished_house';
  const isRestaurant = establishment.type === 'restaurant';
  const isSite = establishment.type === 'site';

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

  const currentPhoto = photos[Math.min(activePhotoIndex, Math.max(photos.length - 1, 0))];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.hero, { backgroundColor: soft }]}>
          {currentPhoto ? (
            <>
              <Image source={{ uri: currentPhoto.url }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
              {photos.length > 1 && (
                <View style={styles.photoDots}>
                  {photos.map((_, i) => (
                    <Pressable key={i} onPress={() => setActivePhotoIndex(i)} hitSlop={6}>
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
          <Pressable style={styles.heartBtn}>
            <Heart size={16} color={colors.ink} />
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
            <View style={styles.ratingRow}>
              <Star size={12} color="#854F0B" fill="#854F0B" />
              <Text style={styles.ratingText}>4.8</Text>
              <Text style={styles.ratingCount}>(212)</Text>
            </View>
          </View>

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
            {isHotel && <HotelBookingForm accent={accent} form={hotelForm} setForm={setHotelForm} onSubmit={handleSubmit} loading={submitting} />}
            {isRestaurant && <RestaurantBookingForm accent={accent} form={restaurantForm} setForm={setRestaurantForm} onSubmit={handleSubmit} loading={submitting} />}
            {isSite && <SiteBookingForm accent={accent} form={siteForm} setForm={setSiteForm} onSubmit={handleSubmit} loading={submitting} />}
          </View>
        </KeyboardAvoidingView>
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
    alignItems: 'center', justifyContent: 'center' },
  heartBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 16, right: 16,
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFFCC',
    alignItems: 'center', justifyContent: 'center' },
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
  amenitiesRow: { marginBottom: 16 },
  amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  amenityText: { fontSize: 11, color: colors.ink },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '500', color: colors.ink, marginBottom: 6 },
  description: { fontSize: 13, color: colors.muted, lineHeight: 20 },
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
});