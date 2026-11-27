import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import {
  Building2, Home, UtensilsCrossed, Mountain,
  CheckCircle, Camera,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { uuidv4 } from '../lib/uuid';
import ScreenHeader from '../components/ScreenHeader';
import LogoYaka from '../components/LogoYaka';
import FormField from '../components/FormField';
import Button from '../components/Button';
import { colors, categoryColors, fonts, typography, breakpoints, radii, spacing, cible } from '../lib/theme';
import { useActiveCities } from '../lib/cities';
import { getCitySubdivisions } from '../lib/geography';
import type { EstablishmentType } from '../lib/types';

const TYPES: { key: EstablishmentType; label: string; icon: (c: string) => React.ReactNode }[] = [
  { key: 'hotel', label: 'Hôtel', icon: c => <Building2 size={20} color={c} /> },
  { key: 'furnished_house', label: 'Maison meublée', icon: c => <Home size={20} color={c} /> },
  { key: 'restaurant', label: 'Restaurant', icon: c => <UtensilsCrossed size={20} color={c} /> },
  { key: 'site', label: 'Site touristique', icon: c => <Mountain size={20} color={c} /> },
];

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
  //
  // JAMAIS pour un administrateur : il remplit ce formulaire pour le compte
  // d'un tiers, pas pour lui-même. Pré-remplir son adresse le rendrait
  // propriétaire de l'établissement sans qu'il s'en aperçoive — et priverait
  // le vrai partenaire de son accès.
  useEffect(() => {
    if (!profile || profile.role === 'admin') return;
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
    // L'email était facultatif ici, et stocké en `null`. Une demande sans
    // adresse est pourtant INAPPROUVABLE : `approve-partner` a besoin d'une
    // adresse pour créer le compte du partenaire et lui transmettre ses accès.
    // Elle restait donc en attente pour toujours, sans que personne ne sache
    // pourquoi — trois demandes du 29/08 étaient dans ce cas.
    // Mieux vaut refuser à la saisie, où l'on peut encore corriger, qu'à
    // l'approbation, où il n'y a plus de recours.
    if (!contactEmail.trim()) {
      setError("Veuillez indiquer votre adresse email : c'est par elle que vous recevrez vos accès une fois la demande approuvée.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setError('Cette adresse email ne semble pas valide.');
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

    // L'identifiant est choisi ICI, avant l'insertion, et non relu après.
    //
    // Relire la ligne qu'on vient d'écrire suppose un `INSERT ... RETURNING`,
    // donc le droit de la LIRE — réservé au propriétaire de la demande, ce
    // qu'un visiteur anonyme n'est pas. L'écriture réussissait, la relecture
    // échouait, et Postgres remontait une erreur de politique qui donnait
    // l'impression que le dépôt était refusé.
    const requestId = uuidv4();

    const { error: insertError } = await supabase.from('partner_requests').insert({
      id: requestId,
      // Rattachement au compte quand le demandeur en a déjà un. Vide sinon :
      // le compte est alors créé à l'approbation, par la fonction serveur.
      //
      // Un administrateur ne se rattache jamais : il dépose pour un tiers.
      // Sans cette exception, il deviendrait propriétaire de l'établissement,
      // et le partenaire n'aurait jamais accès au sien.
      user_id: profile?.role === 'admin' ? null : (session?.user?.id ?? null),
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

    // Accusé de réception, envoyé par le serveur — la clé d'envoi ne peut pas
    // vivre dans l'application.
    //
    // Volontairement sans await bloquant ni gestion d'échec visible : la
    // demande EST enregistrée. Faire dépendre l'écran de confirmation d'un
    // envoi d'email laisserait croire à un échec là où il n'y en a pas.
    // Un envoi manqué se retrouve dans les journaux de la fonction.
    supabase.functions
      .invoke('notify-partner-request', { body: { request_id: requestId } })
      .catch(() => { /* l'accusé n'est pas critique, la demande est enregistrée */ });

    setSuccess(true);
  }

  if (success) {
    return (
      <View style={styles.successScreen}>
        {/* Icône nue : pas de pastille colorée autour (règle du design system). */}
        <CheckCircle size={44} color={colors.success} />
        <Text style={styles.successTitle} accessibilityRole="header" aria-level={1}>Demande envoyée !</Text>
        {/* Le formulaire vient de disparaître : sans annonce, la lecture vocale
            reste muette sur le sort de la demande. */}
        <Text style={styles.successText} accessibilityRole="alert" accessibilityLiveRegion="polite">
          Merci pour votre candidature. Notre équipe va examiner les informations de{' '}
          <Text style={styles.fort}>{name}</Text> et vous répond sous 48h.
          {contactEmail.trim()
            ? <> Un accusé de réception vient de partir à <Text style={styles.fort}>{contactEmail.trim()}</Text>.</>
            : <> Nous vous recontacterons au <Text style={styles.fort}>{contactPhone}</Text>.</>}
        </Text>
        <View style={styles.successBtn}>
          <Button label="Retour à l'accueil" onPress={() => router.replace('/(auth)/login')} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.screen}>
        {/* Dernier en-tête encore écrit à la main. Il souffrait des mêmes
            défauts que les six déjà repris : cible tactile de 34 px, `hitSlop`
            sans effet sur le web, et un retrait haut deviné par plateforme au
            lieu de la zone sûre réelle. Le centre porte la marque et non un
            intitulé, d'où `center`. */}
        <ScreenHeader
          variant="plain"
          bordered
          backFallback="/(tabs)/profile"
          contentMaxWidth={breakpoints.formMax}
          center={
            <View style={styles.logoRow}>
              <LogoYaka size={28} />
              <Text style={styles.logoText}>YakaRDC</Text>
            </View>
          }
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* L'en-tête porte la marque, pas un intitulé : le titre de niveau 1
              de l'écran est donc celui-ci. */}
          <Text style={styles.title} accessibilityRole="header" aria-level={1}>Devenir partenaire</Text>
          <Text style={styles.subtitle}>
            Faites connaître votre établissement aux voyageurs sur YakaRDC. Remplissez ce formulaire, notre équipe examine chaque demande sous 48h.
          </Text>

          {/* Type d'établissement — un seul choix possible : annoncé comme un
              groupe de boutons radio, pas comme quatre boutons sans lien. */}
          <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={2}>Type d'établissement</Text>
          <View style={styles.typeGrid} accessibilityRole="radiogroup" accessibilityLabel="Type d'établissement">
            {TYPES.map(t => {
              const active = type === t.key;
              const cat = categoryColors[t.key];
              return (
                <Pressable
                  key={t.key}
                  style={[styles.typeCard, active && { borderColor: cat?.accent, backgroundColor: cat?.soft }]}
                  onPress={() => setType(t.key)}
                  accessibilityRole="radio"
                  aria-checked={active}
                >
                  {t.icon(active ? (cat?.accent ?? colors.lave) : colors.muted)}
                  <Text style={[styles.typeLabel, active && { color: cat?.accent, fontFamily: fonts.sansMedium }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Infos établissement */}
          <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={2}>Informations générales</Text>
          <FormField label="Nom de l'établissement" value={name} onChange={setName} placeholder="Ex : Hôtel Wenge" />
          <FormField label="Description" value={description} onChange={setDescription}
            placeholder="Décrivez votre établissement en quelques phrases..." multiline lines={3} />

          {/* Ville — ne s'affiche que s'il y a un vrai choix à faire */}
          {activeCities.length > 1 && (
            <>
              <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={2}>Ville</Text>
              <View style={styles.typeGrid} accessibilityRole="radiogroup" accessibilityLabel="Ville">
                {activeCities.map(c => {
                  const active = cityName === c.name;
                  return (
                    <Pressable
                      key={c.id}
                      style={styles.cityChipZone}
                      onPress={() => setCityName(c.name)}
                      accessibilityRole="radio"
                      aria-checked={active}
                    >
                      <View style={[styles.cityChip, active && styles.cityChipActive]}>
                        <Text style={[styles.cityChipText, active && styles.cityChipTextActive]}>{c.name}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Localisation */}
          <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={2}>Localisation</Text>
          {subdivisions && (
            <>
              <Text style={styles.fieldLabel}>Commune</Text>
              <View
                style={[styles.typeGrid, { marginBottom: spacing.xs }]}
                accessibilityRole="radiogroup"
                accessibilityLabel="Commune"
              >
                {subdivisions.all.map(c => {
                  const active = commune === c;
                  return (
                    <Pressable
                      key={c}
                      style={styles.cityChipZone}
                      onPress={() => { setCommune(c); setCommuneError(false); }}
                      accessibilityRole="radio"
                      aria-checked={active}
                    >
                      <View style={[styles.cityChip, active && styles.cityChipActive]}>
                        <Text style={[styles.cityChipText, active && styles.cityChipTextActive]}>{c}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {communeError && (
                <Text style={styles.fieldErrorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
                  Veuillez sélectionner une commune.
                </Text>
              )}
            </>
          )}
          <FormField label="Quartier" value={neighborhood} onChange={setNeighborhood} placeholder="Ex : Centre-ville" />
          <View style={styles.row}>
            <View style={{ flex: 2 }}><FormField label="Avenue" value={avenue} onChange={setAvenue} placeholder="Ex : Roi Baudouin" /></View>
            <View style={{ flex: 1 }}><FormField label="Numéro" value={numero} onChange={setNumero} placeholder="Ex : 14" /></View>
          </View>
          <FormField label="Référence / point de repère" value={reference} onChange={setReference}
            placeholder="Ex : En face de la Banque Centrale" />

          {/* Contact */}
          <Text style={styles.sectionLabel} accessibilityRole="header" aria-level={2}>Vos coordonnées</Text>
          <FormField label="Votre nom complet" value={contactName} onChange={setContactName} placeholder="Jean Mbeki"
            autoComplete="name" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <FormField label="Téléphone" value={contactPhone} onChange={setContactPhone}
                placeholder="+243 8xx xxx xxx" keyboardType="phone-pad" autoComplete="tel" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Email" value={contactEmail} onChange={setContactEmail}
                placeholder="vous@exemple.cd" keyboardType="email-address" autoComplete="email"
                autoCapitalize="none" autoCorrect={false} />
            </View>
          </View>

          {error && (
            <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>
          )}

          <View style={styles.submitBtn}>
            <Button label="Envoyer ma candidature" onPress={handleSubmit} loading={submitting} />
          </View>

          <View style={styles.note}>
            <Camera size={14} color={colors.faint} />
            <Text style={styles.noteText}>
              Vous pourrez ajouter des photos une fois votre candidature approuvée.
            </Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// Hauteur dessinée d'une puce de ville ou de commune : une ligne de texte,
// deux retraits de 8 et deux filets de 1,5.
const HAUTEUR_PUCE = typography.bodyXs.lineHeight + 2 * spacing.sm + 3;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoText: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  content: { padding: spacing.v20, paddingBottom: 50, maxWidth: breakpoints.formMax, width: '100%', alignSelf: 'center' },
  title: { ...typography.titleLg, color: colors.ink, marginBottom: spacing.sm, },
  subtitle: { ...typography.bodySm, color: colors.muted, marginBottom: spacing.v20, },
  sectionLabel: { ...typography.captionMd, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.v12, marginTop: spacing.xs, },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.v20 },
  typeCard: {
    flex: 1, minWidth: 130, alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radii.md, paddingVertical: spacing.v12,
  },
  typeLabel: { ...typography.bodyXs, color: colors.muted, },
  // La puce garde ses 36 px à l'écran ; c'est la zone autour qui en fait 44.
  // La marge négative annule le surplus : les rangées ne s'écartent pas.
  cityChipZone: {
    minHeight: cible.min, justifyContent: 'center',
    marginVertical: -(cible.min - HAUTEUR_PUCE) / 2,
  },
  cityChip: {
    paddingHorizontal: spacing.v12, paddingVertical: spacing.sm, borderRadius: radii.pill,
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
  },
  cityChipActive: { borderColor: colors.lave, backgroundColor: colors.laveSoft },
  cityChipText: { ...typography.bodyXs, color: colors.muted, },
  cityChipTextActive: { color: colors.lave, fontFamily: fonts.sansMedium },
  row: { flexDirection: 'row', gap: spacing.v12 },
  fieldLabel: { ...typography.caption, color: colors.ink, marginBottom: spacing.xs, },
  fieldErrorText: { ...typography.captionSm, color: colors.danger, marginTop: -spacing.v2, marginBottom: spacing.v12, },
  errorText: { ...typography.bodyXs, color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radii.sm, padding: spacing.v12, marginBottom: spacing.v12, textAlign: 'center', },
  submitBtn: { marginTop: spacing.sm },
  note: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.v12,
  },
  noteText: { ...typography.captionSm, color: colors.faint, flexShrink: 1 },
  successScreen: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.v12 },
  successTitle: { ...typography.titleLg, color: colors.ink, },
  successText: { ...typography.body, color: colors.muted, textAlign: 'center', maxWidth: 340, },
  fort: { fontFamily: fonts.sansMedium },
  successBtn: { marginTop: spacing.sm },
});