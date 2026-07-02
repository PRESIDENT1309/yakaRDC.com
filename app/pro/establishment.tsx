import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, TextInput, ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Save, Camera, Check, Building2 } from 'lucide-react-native';
import Svg, { Rect, Circle, Polygon, Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';
import type { Establishment } from '../../lib/types';

const ALL_AMENITIES = [
  'Wifi', 'Parking', 'Climatisation', 'Petit-déjeuner',
  'Piscine', 'Salle de conférence', 'Restaurant', 'Bar',
  'Sécurité 24h', 'Générateur', 'Eau chaude', 'TV satellite',
];

function Field({ label, value, onChange, placeholder, multiline = false, keyboardType = 'default' }:
  { label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; multiline?: boolean; keyboardType?: any }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colors.faint} multiline={multiline}
        numberOfLines={multiline ? 4 : 1} keyboardType={keyboardType}
      />
    </View>
  );
}

export default function EstablishmentScreen() {
  const { profile } = useAuth();
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone]             = useState('');
  const [email, setEmail]             = useState('');
  const [instagram, setInstagram]     = useState('');
  const [tiktok, setTiktok]           = useState('');
  const [commune, setCommune]         = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [avenue, setAvenue]           = useState('');
  const [numero, setNumero]           = useState('');
  const [reference, setReference]     = useState('');
  const [amenities, setAmenities]     = useState<string[]>([]);
  const [price, setPrice]             = useState('');
  const [currency, setCurrency]       = useState('USD');
  const [pendingCount, setPendingCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [checkinCount, setCheckinCount] = useState(0);

  const fetchEstablishment = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('establishments').select('*')
      .eq('owner_id', profile.id).limit(1).maybeSingle();

    if (data) {
      const e = data as Establishment;
      setEstablishment(e);
      setName(e.name ?? '');
      setDescription(e.description ?? '');
      setPhone(e.phone ?? '');
      setEmail((e as any).email ?? '');
      setInstagram((e as any).instagram ?? '');
      setTiktok((e as any).tiktok ?? '');
      setCommune((e as any).commune ?? '');
      setNeighborhood(e.neighborhood ?? '');
      setAvenue((e as any).avenue ?? '');
      setNumero((e as any).numero ?? '');
      setReference((e as any).reference ?? '');
      setAmenities(e.amenities ?? []);

      const { data: rate } = await supabase.from('rates').select('*')
        .eq('establishment_id', e.id).maybeSingle();
      if (rate) { setPrice(String(rate.price)); setCurrency(rate.currency); }

      const { data: bookings } = await supabase.from('bookings')
        .select('status').eq('establishment_id', e.id);
      if (bookings) {
        setPendingCount(bookings.filter((b: any) => b.status === 'pending').length);
        setConfirmedCount(bookings.filter((b: any) => b.status === 'confirmed').length);
        setCheckinCount(bookings.filter((b: any) => b.status === 'checked_in').length);
      }
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchEstablishment(); }, [fetchEstablishment]);

  async function handleSave() {
    if (!establishment) return;
    setSaving(true);
    await supabase.from('establishments').update({
      name, description, phone,
      email, instagram, tiktok,
      commune, neighborhood, avenue, numero, reference, amenities,
    }).eq('id', establishment.id);

    if (price) {
      const unit = establishment.type === 'hotel' || establishment.type === 'furnished_house'
        ? 'night' : 'person';
      const { data: existing } = await supabase.from('rates').select('id')
        .eq('establishment_id', establishment.id).maybeSingle();
      if (existing) {
        await supabase.from('rates').update({ price: parseFloat(price), currency, unit })
          .eq('establishment_id', establishment.id);
      } else {
        await supabase.from('rates').insert({
          establishment_id: establishment.id,
          price: parseFloat(price), currency, unit,
        });
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function toggleAmenity(a: string) {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.lave} /></View>;
  if (!establishment) return (
    <View style={styles.loading}>
      <Building2 size={36} color={colors.borderStrong} />
      <Text style={styles.emptyText}>Aucun établissement trouvé.</Text>
    </View>
  );

  const unitLabel = establishment.type === 'hotel' || establishment.type === 'furnished_house'
    ? 'nuit' : 'personne';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Mon établissement</Text>
            <Text style={styles.headerSub}>Modifications visibles par les voyageurs</Text>
          </View>
          <Pressable style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FAF8F4" size="small" /> :
             saved ? <><Check size={14} color="#FAF8F4" /><Text style={styles.saveBtnText}>Sauvegardé ✓</Text></> :
             <><Save size={14} color="#FAF8F4" /><Text style={styles.saveBtnText}>Sauvegarder</Text></>}
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: colors.lave }]}>{pendingCount}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: '#1F4D3A' }]}>{confirmedCount}</Text>
              <Text style={styles.statLabel}>Confirmées</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: colors.ink }]}>{checkinCount}</Text>
              <Text style={styles.statLabel}>Check-ins</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FAEEDA', borderColor: '#F0C070' }]}>
              <Text style={[styles.statVal, { color: '#854F0B', fontSize: 15 }]}>
                {price ? `${price}$` : '—'}
              </Text>
              <Text style={[styles.statLabel, { color: '#854F0B' }]}>/{unitLabel}</Text>
            </View>
          </View>

          {/* Logo + Photos */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🖼️ Logo & Photos</Text>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
              <View style={{ alignItems: 'center', gap: 5 }}>
                <Text style={styles.subLabel}>Logo</Text>
                <Pressable style={styles.logoBox}>
                  <Svg width="40" height="40" viewBox="0 0 120 120">
                    <Rect width="120" height="120" rx="20" fill="#993C1D" />
                    <Circle cx="60" cy="48" r="22" fill="#FAC775" />
                    <Polygon points="34,80 60,38 86,80" fill="#712B13" />
                    <Path d="M28,96 Q60,88 92,96" stroke="#FAC775" strokeWidth="5" fill="none" strokeLinecap="round" />
                  </Svg>
                  <Text style={{ fontSize: 9, color: colors.lave, marginTop: 4 }}>Changer</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subLabel, { marginBottom: 8 }]}>Photos (0/10)</Text>
                <Pressable style={styles.addPhotoBtn}>
                  <Camera size={20} color={colors.faint} />
                  <Text style={{ fontSize: 10, color: colors.faint, marginTop: 4, textAlign: 'center' }}>
                    Ajouter une photo
                  </Text>
                </Pressable>
                <Text style={styles.hint}>JPG, PNG · Max 5 MB · 10 photos max</Text>
              </View>
            </View>
          </View>

          {/* Infos générales */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Informations générales</Text>
            <Field label="Nom de l'établissement" value={name} onChange={setName} placeholder="Ex : Hôtel Wenge" />
            <Field label="Description" value={description} onChange={setDescription}
              placeholder="Décrivez votre établissement en quelques phrases..." multiline />
          </View>

          {/* Contact */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📞 Contact & Réseaux sociaux</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Field label="📱 Téléphone" value={phone} onChange={setPhone} placeholder="+243 8xx xxx xxx" keyboardType="phone-pad" /></View>
              <View style={{ flex: 1 }}><Field label="✉️ Email" value={email} onChange={setEmail} placeholder="contact@exemple.cd" keyboardType="email-address" /></View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Field label="📸 Instagram" value={instagram} onChange={setInstagram} placeholder="@votre_compte" /></View>
              <View style={{ flex: 1 }}><Field label="🎵 TikTok" value={tiktok} onChange={setTiktok} placeholder="@votre_compte" /></View>
            </View>
          </View>

          {/* Adresse */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📍 Adresse complète</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Field label="Commune" value={commune} onChange={setCommune} placeholder="Ex : Gombe" /></View>
              <View style={{ flex: 1 }}><Field label="Quartier" value={neighborhood} onChange={setNeighborhood} placeholder="Ex : Centre-ville" /></View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 2 }}><Field label="Avenue" value={avenue} onChange={setAvenue} placeholder="Ex : Roi Baudouin" /></View>
              <View style={{ flex: 1 }}><Field label="Numéro" value={numero} onChange={setNumero} placeholder="Ex : 14" /></View>
            </View>
            <Field label="Référence / point de repère" value={reference} onChange={setReference}
              placeholder="Ex : En face de la Banque Centrale" />
          </View>

          {/* Équipements */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>✅ Équipements & services</Text>
            <View style={styles.amenitiesGrid}>
              {ALL_AMENITIES.map(a => {
                const active = amenities.includes(a);
                return (
                  <Pressable key={a}
                    style={[styles.amenityChip, active && styles.amenityChipActive]}
                    onPress={() => toggleAmenity(a)}>
                    {active && <Check size={11} color="#1F4D3A" />}
                    <Text style={[styles.amenityText, active && styles.amenityTextActive]}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Tarif */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💰 Tarif</Text>
            <View style={styles.row}>
              <View style={{ flex: 2 }}><Field label={`Prix (par ${unitLabel})`} value={price} onChange={setPrice} placeholder="Ex : 45" keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Devise" value={currency} onChange={setCurrency} placeholder="USD" /></View>
            </View>
          </View>

          <Pressable style={[styles.saveBtnFull, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#FAF8F4" /> :
             <><Save size={16} color="#FAF8F4" /><Text style={styles.saveBtnFullText}>Sauvegarder les modifications</Text></>}
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.cream },
  emptyText: { fontSize: 14, color: colors.muted },
  header: {
    backgroundColor: colors.lave, paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16, paddingHorizontal: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '500', color: '#FAF8F4' },
  headerSub: { fontSize: 11, color: 'rgba(250,248,244,0.7)', marginTop: 2 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  saveBtnText: { fontSize: 12, color: '#FAF8F4', fontWeight: '500' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  statVal: { fontSize: 20, fontWeight: '500' },
  statLabel: { fontSize: 9, color: colors.muted, marginTop: 2 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 13, fontWeight: '500', color: colors.ink, marginBottom: 12 },
  subLabel: { fontSize: 10, color: colors.faint },
  logoBox: { width: 70, height: 70, borderRadius: 12, backgroundColor: colors.laveSoft, borderWidth: 1, borderColor: '#F5C4B3', alignItems: 'center', justifyContent: 'center' },
  addPhotoBtn: { width: 72, height: 72, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 10, color: colors.faint, marginTop: 6 },
  row: { flexDirection: 'row', gap: 10 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '500', color: colors.muted, marginBottom: 4 },
  fieldInput: { backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: colors.ink },
  fieldInputMulti: { height: 80, textAlignVertical: 'top' },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  amenityChipActive: { backgroundColor: '#DCEEE3', borderColor: '#A8D5B5' },
  amenityText: { fontSize: 11, color: colors.muted },
  amenityTextActive: { color: '#1F4D3A', fontWeight: '500' },
  saveBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.lave, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  saveBtnFullText: { fontSize: 15, fontWeight: '500', color: '#FAF8F4' },
});