import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { goBack } from '../lib/navigation';
import Svg, { Rect, Circle, Polygon, Path } from 'react-native-svg';
import {
  ArrowLeft, Building2, Home, UtensilsCrossed, Mountain,
  CheckCircle, User, Phone, Mail,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { colors, categoryColors } from '../lib/theme';
import { useActiveCities } from '../lib/cities';
import { getCitySubdivisions } from '../lib/geography';
import type { EstablishmentType } from '../lib/types';

const TYPES: { key: EstablishmentType; label: string; icon: (c: string) => React.ReactNode }[] = [
  { key: 'hotel', label: 'Hôtel', icon: c => <Building2 size={20} color={c} /> },
  { key: 'furnished_house', label: 'Maison meublée', icon: c => <Home size={20} color={c} /> },
  { key: 'restaurant', label: 'Restaurant', icon: c => <UtensilsCrossed size={20} color={c} /> },
  { key: 'site', label: 'Site touristique', icon: c => <Mountain size={20} color={c} /> },
];

function Field({ label, value, onChange, placeholder, keyboardType = 'default', multiline = false }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string;
    keyboardType?: any; multiline?: boolean }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

export default function BecomePartnerScreen() {
  // `cities` (Admin → Villes & catégories) est la source de vérité — tant
  // qu'une seule ville est active, elle est choisie automatiquement et
  // aucun sélecteur ne s'affiche.
  const { cities: activeCities } = useActiveCities();
  const [cityName, setCityName] = useState('');
  useEffect(() => {
    if (activeCities.length > 0 && !cityName) setCityName(activeCities[0].name);
  }, [activeCities]);

  // La ville choisie détermine les communes proposées — solution transitoire
  // (lib/geography.ts), pas de table dédiée pour l'instant.
  const subdivisions = getCitySubdivisions(cityName);
  useEffect(() => {
    // Si la ville change pour une ville sans subdivisions connues, on efface
    // une éventuelle commune déjà choisie pour une autre ville.
    if (!subdivisions) { setCommune(''); setCommuneError(false); }
  }, [subdivisions]);

  const [type, setType] = useState<EstablishmentType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [commune, setCommune] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [avenue, setAvenue] = useState('');
  const [numero, setNumero] = useState('');
  const [reference, setReference] = useState('');
  const { session, profile } = useAuth();
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Le profil arrive après le montage : on ne remplit que les champs restés
  // vides, pour ne jamais écraser une saisie en cours.
  useEffect(() => {
    if (!profile) return;
    if (profile.full_name) setContactName(prev => prev || profile.full_name!);
    if (profile.phone) setContactPhone(prev => prev || profile.phone!);
    if (profile.email) setContactEmail(prev => prev || profile.email!);
  }, [profile?.id, profile?.full_name, profile?.phone, profile?.email]);
  const [communeError, setCommuneError] = useState(false);

  async function handleSubmit() {
    setError(null);
    setCommuneError(false);
    if (!type) { setError('Veuillez choisir le type d\'établissement.'); return; }
    if (!name.trim()) { setError('Veuillez indiquer le nom de l\'établissement.'); return; }
    if (!contactName.trim() || !contactPhone.trim()) {
      setError('Veuillez indiquer votre nom et votre téléphone.');
      return;
    }
    if (!cityName) {
      setError('Veuillez choisir une ville.');
      return;
    }
    // Commune obligatoire uniquement si la ville choisie a des subdivisions
    // connues — sinon le champ n'existe même pas dans le formulaire.
    if (subdivisions && !commune) {
      setCommuneError(true);
      setError('Veuillez sélectionner une commune.');
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from('partner_requests').insert({
      // Rattachement au compte quand le demandeur en a déjà un. Vide sinon :
      // le compte est alors créé à l'approbation, par la fonction serveur.
      user_id: session?.user?.id ?? null,
      establishment_type: type,
      establishment_name: name.trim(),
      description: description.trim() || null,
      city: cityName,
      commune: commune.trim() || null,
      neighborhood: neighborhood.trim() || null,
      avenue: avenue.trim() || null,
      numero: numero.trim() || null,
      reference: reference.trim() || null,
      contact_name: contactName.trim(),
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim() || null,
      photo_urls: [],
    });

    setSubmitting(false);
    if (insertError) {
      setError('Une erreur est survenue. Veuillez réessayer.');
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <View style={styles.successScreen}>
        <View style={styles.successIcon}>
          <CheckCircle size={44} color="#1F4D3A" />
        </View>
        <Text style={styles.successTitle}>Demande envoyée !</Text>
        <Text style={styles.successText}>
          Merci pour votre candidature. Notre équipe va examiner les informations de{' '}
          <Text style={{ fontWeight: '500' }}>{name}</Text> et vous recontactera au{' '}
          <Text style={{ fontWeight: '500' }}>{contactPhone}</Text> sous peu.
        </Text>
        <Pressable style={styles.successBtn} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.successBtnText}>Retour à l'accueil</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => goBack('/(tabs)/profile')} hitSlop={8} style={styles.backBtn}>
            <ArrowLeft size={18} color={colors.ink} />
          </Pressable>
          <View style={styles.logoRow}>
            <Svg width="28" height="28" viewBox="0 0 120 120">
              <Rect width="120" height="120" rx="26" fill="#712B13" />
              <Circle cx="60" cy="48" r="22" fill="#FAC775" />
              <Polygon points="34,80 60,38 86,80" fill="#712B13" />
              <Path d="M28,96 Q60,88 92,96" stroke="#FAC775" strokeWidth="5" fill="none" strokeLinecap="round" />
            </Svg>
            <Text style={styles.logoText}>YakaRDC</Text>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Devenir partenaire</Text>
          <Text style={styles.subtitle}>
            Faites connaître votre établissement aux voyageurs sur YakaRDC. Remplissez ce formulaire, notre équipe examine chaque demande sous 48h.
          </Text>

          {/* Type d'établissement */}
          <Text style={styles.sectionLabel}>Type d'établissement</Text>
          <View style={styles.typeGrid}>
            {TYPES.map(t => {
              const active = type === t.key;
              const cat = categoryColors[t.key];
              return (
                <Pressable
                  key={t.key}
                  style={[styles.typeCard, active && { borderColor: cat?.accent, backgroundColor: cat?.soft }]}
                  onPress={() => setType(t.key)}
                >
                  {t.icon(active ? (cat?.accent ?? colors.lave) : colors.muted)}
                  <Text style={[styles.typeLabel, active && { color: cat?.accent, fontWeight: '500' }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Infos établissement */}
          <Text style={styles.sectionLabel}>Informations générales</Text>
          <Field label="Nom de l'établissement" value={name} onChange={setName} placeholder="Ex : Hôtel Wenge" />
          <Field label="Description" value={description} onChange={setDescription}
            placeholder="Décrivez votre établissement en quelques phrases..." multiline />

          {/* Ville — ne s'affiche que s'il y a un vrai choix à faire */}
          {activeCities.length > 1 && (
            <>
              <Text style={styles.sectionLabel}>Ville</Text>
              <View style={styles.typeGrid}>
                {activeCities.map(c => {
                  const active = cityName === c.name;
                  return (
                    <Pressable
                      key={c.id}
                      style={[styles.cityChip, active && styles.cityChipActive]}
                      onPress={() => setCityName(c.name)}
                    >
                      <Text style={[styles.cityChipText, active && styles.cityChipTextActive]}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Localisation */}
          <Text style={styles.sectionLabel}>Localisation</Text>
          {subdivisions && (
            <>
              <Text style={styles.fieldLabel}>Commune</Text>
              <View style={[styles.typeGrid, { marginBottom: 4 }]}>
                {subdivisions.all.map(c => {
                  const active = commune === c;
                  return (
                    <Pressable
                      key={c}
                      style={[styles.cityChip, active && styles.cityChipActive]}
                      onPress={() => { setCommune(c); setCommuneError(false); }}
                    >
                      <Text style={[styles.cityChipText, active && styles.cityChipTextActive]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {communeError && (
                <Text style={styles.fieldErrorText}>Veuillez sélectionner une commune.</Text>
              )}
            </>
          )}
          <Field label="Quartier" value={neighborhood} onChange={setNeighborhood} placeholder="Ex : Centre-ville" />
          <View style={styles.row}>
            <View style={{ flex: 2 }}><Field label="Avenue" value={avenue} onChange={setAvenue} placeholder="Ex : Roi Baudouin" /></View>
            <View style={{ flex: 1 }}><Field label="Numéro" value={numero} onChange={setNumero} placeholder="Ex : 14" /></View>
          </View>
          <Field label="Référence / point de repère" value={reference} onChange={setReference}
            placeholder="Ex : En face de la Banque Centrale" />

          {/* Contact */}
          <Text style={styles.sectionLabel}>Vos coordonnées</Text>
          <Field label="Votre nom complet" value={contactName} onChange={setContactName} placeholder="Jean Mbeki" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Field label="Téléphone" value={contactPhone} onChange={setContactPhone} placeholder="+243 8xx xxx xxx" keyboardType="phone-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Email" value={contactEmail} onChange={setContactEmail} placeholder="vous@exemple.cd" keyboardType="email-address" /></View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#FAF8F4" />
              : <Text style={styles.submitBtnText}>Envoyer ma candidature</Text>
            }
          </Pressable>

          <Text style={styles.note}>
            📷 Vous pourrez ajouter des photos une fois votre candidature approuvée.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: '#FAF8F4',
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logoText: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 17, color: colors.ink },
  content: { padding: 20, paddingBottom: 50, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '500', color: colors.ink, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 22 },
  sectionLabel: { fontSize: 11, fontWeight: '500', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10, marginTop: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeCard: {
    flex: 1, minWidth: 130, alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 12, paddingVertical: 14,
  },
  typeLabel: { fontSize: 12, color: colors.muted },
  cityChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.border,
  },
  cityChipActive: { borderColor: colors.lave, backgroundColor: colors.laveSoft },
  cityChipText: { fontSize: 12.5, color: colors.muted },
  cityChipTextActive: { color: colors.lave, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 10 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.ink, marginBottom: 5 },
  fieldInput: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: colors.ink,
  },
  fieldInputMulti: { height: 76, textAlignVertical: 'top' },
  fieldErrorText: { fontSize: 11.5, color: '#C0392B', marginTop: -2, marginBottom: 14 },
  errorText: { fontSize: 12, color: '#C0392B', backgroundColor: '#FFF0F0', borderRadius: 8, padding: 10, marginBottom: 14, textAlign: 'center' },
  submitBtn: { backgroundColor: colors.lave, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  submitBtnText: { fontSize: 15, fontWeight: '500', color: '#FAF8F4' },
  note: { fontSize: 11.5, color: colors.faint, textAlign: 'center', marginTop: 14, lineHeight: 17 },
  successScreen: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  successIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#DCEEE3', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 20, fontWeight: '500', color: colors.ink },
  successText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21, maxWidth: 340 },
  successBtn: { backgroundColor: colors.lave, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 13, marginTop: 8 },
  successBtnText: { fontSize: 14, fontWeight: '500', color: '#FAF8F4' },
});