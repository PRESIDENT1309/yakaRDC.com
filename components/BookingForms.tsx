import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Minus, Plus, Send, Info } from 'lucide-react-native';
import { colors, spacing, typography, radii, fonts, cible, breakpoints } from '../lib/theme';
import { unitLabel } from '../lib/listing-format';
import { slotStateFor } from '../lib/booking-slots';
import type { TimeSlot } from '../lib/booking-slots';
import {
  RESTAURANT_SLOT_STEP_MIN, SITE_SLOT_STEP_MIN, OCCASIONS, PAYMENTS,
} from '../lib/booking-types';
import type {
  Availability, VenueContext, OfferContext,
  HotelForm, RestaurantForm, SiteForm,
} from '../lib/booking-types';
import { unitsNeeded, offerLabel } from '../lib/types';
import type { EstablishmentOffer, OfferCategory } from '../lib/types';
import FormField from './FormField';
import OfferCard from './OfferCard';
import StepProgress from './StepProgress';
import Button from './Button';
import PhoneField from './PhoneField';
import DateField from './DateField';
import TimeField from './TimeField';

/**
 * Formulaires de demande de réservation — hôtel/maison, restaurant, site.
 *
 * Ils vivaient dans app/listing/[id].tsx, dont ils occupaient 544 lignes sur
 * 2061, alors que leurs styles vivaient 1200 lignes plus bas dans l'unique
 * StyleSheet du fichier. C'est ce couplage à distance, plus que la longueur,
 * qui rendait la fiche pénible à modifier.
 *
 * L'audit a montré une couture nette : 23 styles ne servent qu'ici, un seul
 * (`fieldLabel`) est partagé avec l'écran — il est donc recopié, un libellé de
 * champ étant un détail local et non un contrat.
 *
 * Aucun comportement n'est modifié : ce sont les mêmes composants, les mêmes
 * styles, les mêmes props.
 */

// Côté de la pastille des boutons + et −, et hauteur d'une puce de choix
// (retraits, interligne du libellé, filets). La zone tactile de 44 px déborde
// autour de ces deux dessins sans les grossir ni les déplacer.
const PASTILLE_COMPTEUR = 26;
const HAUTEUR_PUCE = 2 * spacing.sm + typography.caption.lineHeight + 2;
const DEBORD_PUCE = (cible.min - HAUTEUR_PUCE) / 2;

/**
 * Bouton + ou − d'un compteur.
 *
 * La pastille garde ses 26 px ; c'est la zone qui la porte qui en fait 44, la
 * marge négative annulant le surplus. Même principe que `BoutonIcone`, dont la
 * pastille ronde ne convenait pas à ce carré arrondi. `hitSlop`, employé
 * jusqu'ici, n'agrandit rien sur le web.
 */
function BoutonCompteur({ sens, label, onPress, accent, disabled = false }:
  { sens: 'moins' | 'plus'; label: string; onPress: () => void; accent: string; disabled?: boolean }) {
  const plus = sens === 'plus';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      onPress={onPress}
      disabled={disabled}
      style={styles.counterZone}
    >
      <View
        style={[
          styles.counterBtn,
          plus ? { backgroundColor: disabled ? colors.border : accent } : styles.counterBtnMuted,
          !plus && disabled && styles.counterBtnInactif,
        ]}
      >
        {plus
          ? <Plus size={14} color={disabled ? colors.faint : colors.cream} />
          : <Minus size={14} color={colors.muted} />}
      </View>
    </Pressable>
  );
}

/**
 * Valeur d'un compteur. Lue seule, « 2 » ne dit pas ce qu'elle compte : la
 * lecture vocale reçoit « Adultes : 2 », et l'annonce à chaque changement.
 *
 * Le libellé n'est posé que hors du web : un navigateur n'en tient pas compte
 * sur un texte sans rôle. Le chiffre y suffit, annoncé juste après l'appui sur
 * le bouton qui vient de le modifier.
 */
function ValeurCompteur({ value, lecture }: { value: number; lecture: string }) {
  return (
    <Text
      style={styles.counterValue}
      accessibilityLiveRegion="polite"
      accessibilityLabel={Platform.OS === 'web' ? undefined : lecture}
    >
      {value}
    </Text>
  );
}

export function Counter({ label, value, onDec, onInc, accent, min, decLabel, incLabel }:
  { label: string; value: number; onDec: () => void; onInc: () => void; accent: string;
    /** Plancher : une fois atteint, le bouton − est annoncé et montré inactif. */
    min?: number;
    /** Ce que font les boutons, dit en clair (« Retirer un adulte »). */
    decLabel?: string; incLabel?: string }) {
  return (
    <View style={styles.counter}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterRow}>
        <BoutonCompteur
          sens="moins" label={decLabel ?? 'Diminuer : ' + label} accent={accent}
          onPress={onDec} disabled={min !== undefined && value <= min}
        />
        <ValeurCompteur value={value} lecture={`${label} : ${value}`} />
        <BoutonCompteur sens="plus" label={incLabel ?? 'Augmenter : ' + label} accent={accent} onPress={onInc} />
      </View>
    </View>
  );
}

/**
 * Option d'un choix unique : créneau, paiement, occasion, type de visite.
 *
 * Annoncée comme un bouton radio, coché ou non — la couleur portait seule le
 * choix en cours.
 *
 * La puce fait 35 px de haut ; la zone qui la porte en fait 44, le surplus
 * étant repris sur ses marges pour ne rien décaler.
 */
function Choix({ label, actif, onPress, accent, etire = false }:
  { label: string; actif: boolean; onPress: () => void; accent: string;
    /** Prend toute la largeur offerte, libellé centré : choix à deux options. */
    etire?: boolean }) {
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={actif}
      onPress={onPress}
      style={[styles.chipZone, etire && styles.chipZoneEtiree]}
    >
      <View style={[styles.chip, actif && { backgroundColor: accent, borderColor: accent }]}>
        <Text style={[styles.chipText, etire && styles.chipTextCentre, actif && styles.chipTextActif]}>{label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Indication sous un champ, annoncée quand elle apparaît ou change : sans
 * cela, choisir une date où l'établissement est fermé ne produisait aucun
 * retour pour qui ne voit pas l'écran. `alerte` la signale comme un
 * empêchement plutôt que comme une simple précision.
 */
function Indication({ children, alerte = false }: { children: ReactNode; alerte?: boolean }) {
  return (
    <Text
      style={styles.slotHint}
      accessibilityRole={alerte ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      {children}
    </Text>
  );
}

// Sélecteur de créneau qui grise les horaires complets
/**
 * Choix du créneau.
 *
 * Ce composant grisait les horaires complets d'après `establishments.capacity`
 * — une valeur unique pour tout l'établissement, jamais renseignée nulle part.
 * Le mécanisme n'a donc jamais rien grisé, et il reposait de toute façon sur
 * une notion trop grossière : un restaurant n'a pas « une capacité », il a des
 * places par service et par formule.
 *
 * La disponibilité réelle passe désormais par les offres, calculée par
 * `remainingForSlot` et affichée sur chaque carte. Ce composant ne fait plus
 * que ce qu'il sait faire : présenter les créneaux ouverts.
 */
export function SlotPicker({ slots, selected, onSelect, accent, label = 'Créneau horaire' }:
  { slots: TimeSlot[]; selected: string; onSelect: (s: string) => void; accent: string;
    /** Nom du groupe pour la lecture vocale. */
    label?: string }) {
  return (
    <View style={styles.choix} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {slots.map(s => (
        <Choix key={s} label={s} actif={selected === s} onPress={() => onSelect(s)} accent={accent} />
      ))}
    </View>
  );
}

export function HotelBookingForm({ accent, form, setForm, onSubmit, loading, offerCtx, isHouse }:
  { accent: string; form: HotelForm; setForm: (f: HotelForm) => void; onSubmit: () => void;
    loading: boolean; offerCtx: OfferContext; isHouse: boolean }) {
  // Un seul type de logement : l'étape de choix n'apporte rien, on la saute.
  const skipChoice = offerCtx.offers.length <= 1;
  const [step, setStep] = useState(skipChoice ? 1 : 0);

  const selected = offerCtx.offers.find(o => o.id === form.offerId) ?? null;
  const nights = offerCtx.nightsBetween(form.checkIn, form.checkOut);
  const guests = form.adults + form.children;
  const units = selected ? unitsNeeded(selected, guests) : 1;

  // Avec une offre unique, elle est retenue d'office.
  useEffect(() => {
    if (skipChoice && offerCtx.offers[0] && form.offerId !== offerCtx.offers[0].id) {
      setForm({ ...form, offerId: offerCtx.offers[0].id });
    }
  }, [skipChoice, offerCtx.offers.length]);

  function handleSelectCheckIn(iso: string) {
    const nextOut = form.checkOut && form.checkOut <= iso ? '' : form.checkOut;
    setForm({ ...form, checkIn: iso, checkOut: nextOut });
  }

  const labels = skipChoice
    ? ['Séjour', 'Vos informations']
    : [isHouse ? 'Logement' : 'Chambre', 'Séjour', 'Vos informations'];
  const shown = skipChoice ? step - 1 : step;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.corps}>
      <StepProgress labels={labels} current={shown} accent={accent} onGoBack={i => setStep(skipChoice ? i + 1 : i)} />

      {step === 0 && (
        <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel={isHouse ? 'Logement' : 'Chambre'}>
          {offerCtx.offers.map(o => {
            const rest = offerCtx.remainingFor(o, nights);
            return (
              <OfferCard
                key={o.id}
                offer={o}
                category={offerCtx.categoryOf(o)}
                photoUrl={offerCtx.photoOf(o.id)}
                remaining={nights.length && rest !== null ? rest : undefined}
                selected={form.offerId === o.id}
                accent={accent}
                accessibilityRole="radio"
                onPress={() => { setForm({ ...form, offerId: o.id }); setStep(1); }}
              />
            );
          })}
        </View>
      )}

      {step === 1 && (
        <>
          <Text style={styles.fieldLabel}>Dates du séjour</Text>
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <DateField
                label="Arrivée" sheetTitle="Date d'arrivée"
                value={form.checkIn} onChange={handleSelectCheckIn}
                fullDays={offerCtx.fullDaysFor(selected)}
                closedDays={offerCtx.closedDays} accent={accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DateField
                label="Départ" sheetTitle="Date de départ"
                value={form.checkOut} onChange={iso => setForm({ ...form, checkOut: iso })}
                fullDays={offerCtx.fullDaysFor(selected)}
                closedDays={offerCtx.closedDays}
                minDate={form.checkIn || undefined} accent={accent}
              />
            </View>
          </View>

          <TimeField
            label="Heure d'arrivée prévue (facultatif)"
            value={form.arrivalTime}
            onChange={v => setForm({ ...form, arrivalTime: v })}
            accent={accent}
          />

          <Text style={styles.fieldLabel}>Voyageurs</Text>
          <View style={styles.formRow}>
            <Counter label="Adultes" value={form.adults} accent={accent} min={1} decLabel="Retirer un adulte" incLabel="Ajouter un adulte" onDec={() => setForm({ ...form, adults: Math.max(1, form.adults - 1) })} onInc={() => setForm({ ...form, adults: form.adults + 1 })} />
            <Counter label="Enfants" value={form.children} accent={accent} min={0} decLabel="Retirer un enfant" incLabel="Ajouter un enfant" onDec={() => setForm({ ...form, children: Math.max(0, form.children - 1) })} onInc={() => setForm({ ...form, children: form.children + 1 })} />
          </View>

          {/* Un groupe plus grand que la capacité d'une unité en occupe
              plusieurs — on le dit avant l'envoi plutôt que de refuser. */}
          {selected?.max_guests != null && units > 1 && (
            <Indication>
              {guests} personnes pour {selected.max_guests} par {isHouse ? 'logement' : 'chambre'} :
              {' '}{units} {isHouse ? 'logements seront réservés' : 'chambres seront réservées'}.
            </Indication>
          )}

          <Button
            label="Continuer"
            onPress={() => setStep(2)}
            color={accent}
            disabled={!form.checkIn || !form.checkOut}
          />
        </>
      )}

      {step === 2 && (
        <>
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}><FormField label="Prénom" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} autoComplete="given-name" placeholder="Jean" /></View>
            <View style={{ flex: 1 }}><FormField label="Nom" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} autoComplete="family-name" placeholder="Mbeki" /></View>
          </View>
          <FormField label="Postnom (facultatif)" value={form.postName} onChange={v => setForm({ ...form, postName: v })} autoComplete="additional-name" placeholder="Kabasele" />
          <PhoneField
            label="Téléphone" dial={form.phoneDial}
            onDialChange={v => setForm({ ...form, phoneDial: v })}
            value={form.phone} onChange={v => setForm({ ...form, phone: v })}
          />
          <FormField label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="jean@exemple.cd" keyboardType="email-address" autoComplete="email" />

          <Text style={styles.fieldLabel}>Mode de paiement</Text>
          <View style={styles.choix} accessibilityRole="radiogroup" accessibilityLabel="Mode de paiement">
            {PAYMENTS.map(p => (
              <Choix key={p.key} label={p.label} actif={form.paymentMethod === p.key} accent={accent} onPress={() => setForm({ ...form, paymentMethod: p.key as any })} />
            ))}
          </View>
          <FormField label="Demandes spéciales (optionnel)" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Chambre calme, lit king size..." multiline />

          <BookingRecap
            lines={selected ? [{
              label: offerLabel(selected, offerCtx.categoryOf(selected)),
              detail: `${selected.price} ${selected.currency} × ${nights.length} nuit${nights.length > 1 ? 's' : ''}${units > 1 ? ` × ${units}` : ''}`,
              amount: selected.price * nights.length * units,
            }] : []}
            currency={selected?.currency ?? 'USD'}
          />

          <Button label="Envoyer la demande" onPress={onSubmit} loading={loading} color={accent} icon={<Send size={15} color={colors.cream} strokeWidth={1.75} />} />
        </>
      )}
    </ScrollView>
  );
}

// Récapitulatif chiffré. « Estimé » est délibéré : rien n'est payé en ligne et
// le partenaire doit encore confirmer la demande.
export function BookingRecap({ lines, currency }: { lines: { label: string; detail: string; amount: number }[]; currency: string }) {
  if (lines.length === 0) return null;
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <View style={styles.recap}>
      {lines.map(l => (
        <View key={l.label} style={styles.recapRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recapLabel}>{l.label}</Text>
            <Text style={styles.recapDetail}>{l.detail}</Text>
          </View>
          <Text style={styles.recapAmount}>{l.amount} {currency}</Text>
        </View>
      ))}
      <View style={styles.recapTotalRow}>
        <Text style={styles.recapTotalLabel}>Total estimé</Text>
        <Text style={styles.recapTotal}>{total} {currency}</Text>
      </View>
    </View>
  );
}

export function RestaurantBookingForm({ accent, form, setForm, onSubmit, loading, availability, offerCtx, venue }:
  { accent: string; form: RestaurantForm; setForm: (f: RestaurantForm) => void; onSubmit: () => void;
    loading: boolean; availability: Availability; offerCtx: OfferContext; venue: VenueContext }) {
  const [step, setStep] = useState(0);
  const selected = offerCtx.offers.find(o => o.id === form.offerId) ?? null;
  const covers = form.adults + form.children;
  const slotState = slotStateFor(venue.openingHours, form.visitDate, RESTAURANT_SLOT_STEP_MIN);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.corps}>
      <StepProgress
        labels={['Votre table', 'Vos informations']}
        current={step} accent={accent} onGoBack={setStep}
      />

      {step === 0 && (
        <>
          <DateField
            label="Date"
            sheetTitle="Date de la réservation"
            value={form.visitDate}
            // Changer de date invalide le créneau : sa disponibilité dépend du jour.
            onChange={iso => setForm({ ...form, visitDate: iso, timeSlot: '' })}
            fullDays={availability.fullDays}
            closedDays={availability.closedDays}
            accent={accent}
          />

          <Text style={styles.fieldLabel}>Créneau horaire</Text>
          {/* Les créneaux découlent des horaires publiés par l'établissement :
              un restaurant ouvert 24h/24 n'a pas la même disponibilité qu'un
              autre ouvert de midi à 15h six jours sur sept. */}
          {slotState.message ? (
            // Tant qu'aucune date n'est choisie, le message est une consigne ;
            // ensuite, il dit pourquoi aucun créneau n'est proposé.
            <Indication alerte={!!form.visitDate}>{slotState.message}</Indication>
          ) : (
            <SlotPicker
              slots={slotState.slots}
              selected={form.timeSlot}
              onSelect={s => setForm({ ...form, timeSlot: s })}
              accent={accent}
              label="Créneau horaire"
            />
          )}

          <Text style={styles.fieldLabel}>Couverts</Text>
          <View style={styles.formRow}>
            <Counter label="Adultes" value={form.adults} accent={accent} min={1} decLabel="Retirer un adulte" incLabel="Ajouter un adulte" onDec={() => setForm({ ...form, adults: Math.max(1, form.adults - 1) })} onInc={() => setForm({ ...form, adults: form.adults + 1 })} />
            <Counter label="Enfants" value={form.children} accent={accent} min={0} decLabel="Retirer un enfant" incLabel="Ajouter un enfant" onDec={() => setForm({ ...form, children: Math.max(0, form.children - 1) })} onInc={() => setForm({ ...form, children: form.children + 1 })} />
          </View>

          {/* Formule facultative : on réserve une table, pas un menu. « À la
              carte » n'est pas une offre du catalogue, c'est son absence.
              La carte reste consultable ici : choisir une formule sans pouvoir
              la lire n'a pas de sens. */}
          {offerCtx.offers.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Formule (facultatif)</Text>
              <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup" accessibilityLabel="Formule">
                <Choix label="À la carte" actif={!form.offerId} accent={accent} onPress={() => setForm({ ...form, offerId: '' })} />
                {offerCtx.offers.map(o => (
                  <OfferCard
                    key={o.id}
                    offer={o}
                    category={offerCtx.categoryOf(o)}
                    photoUrl={offerCtx.photoOf(o.id)}
                    selected={form.offerId === o.id}
                    accent={accent}
                    accessibilityRole="radio"
                    onPress={() => setForm({ ...form, offerId: o.id })}
                  />
                ))}
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>Occasion</Text>
          <View style={styles.choix} accessibilityRole="radiogroup" accessibilityLabel="Occasion">
            {OCCASIONS.map(o => (
              <Choix key={o.key} label={o.label} actif={form.occasion === o.key} accent={accent} onPress={() => setForm({ ...form, occasion: o.key as any })} />
            ))}
          </View>

          <Button
            label="Continuer" onPress={() => setStep(1)} color={accent}
            disabled={!form.visitDate || !form.timeSlot}
          />
        </>
      )}

      {step === 1 && (
        <>
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}><FormField label="Prénom" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} autoComplete="given-name" placeholder="Marie" /></View>
            <View style={{ flex: 1 }}><FormField label="Nom" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} autoComplete="family-name" placeholder="Kalala" /></View>
          </View>
          <FormField label="Postnom (facultatif)" value={form.postName} onChange={v => setForm({ ...form, postName: v })} autoComplete="additional-name" placeholder="Kabasele" />
          <PhoneField
            label="Téléphone"
            dial={form.phoneDial}
            onDialChange={v => setForm({ ...form, phoneDial: v })}
            value={form.phone}
            onChange={v => setForm({ ...form, phone: v })}
          />
          <FormField label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="marie@exemple.cd" keyboardType="email-address" autoComplete="email" />
          <FormField label="Allergies / régimes (optionnel)" value={form.allergies} onChange={v => setForm({ ...form, allergies: v })} placeholder="Sans gluten, végétarien..." multiline />

          {/* Une formule se compte par personne : le total suit les couverts. */}
          <BookingRecap
            lines={selected ? [{
              label: offerLabel(selected, offerCtx.categoryOf(selected)),
              detail: `${selected.price} ${selected.currency} × ${covers} couvert${covers > 1 ? 's' : ''}`,
              amount: selected.price * covers,
            }] : []}
            currency={selected?.currency ?? 'USD'}
          />

          <Button label="Réserver la table" onPress={onSubmit} loading={loading} color={accent} icon={<Send size={15} color={colors.cream} strokeWidth={1.75} />} />
        </>
      )}
    </ScrollView>
  );
}

// Ligne de billet : un type d'entrée, son prix, son compteur.
export function TicketRow({ offer, category, accent, quantity, onChange, remaining }:
  { offer: EstablishmentOffer; category?: OfferCategory; accent: string;
    quantity: number; onChange: (n: number) => void; remaining: number | null }) {
  const full = remaining !== null && remaining <= 0;
  const atMax = remaining !== null && quantity >= remaining;
  // Les boutons de chaque ligne se ressemblent tous : sans le nom du billet,
  // la lecture vocale enchaînerait « Ajouter » autant de fois qu'il y a de tarifs.
  const titre = offerLabel(offer, category);
  return (
    <View style={styles.ticketRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.ticketLabel}>{titre}</Text>
        {!!offer.description && <Text style={styles.ticketDesc} numberOfLines={2}>{offer.description}</Text>}
        <Text style={[styles.ticketPrice, { color: accent }]}>{offer.price} {offer.currency}</Text>
        {full && <Text style={styles.ticketFull}>Complet à cette date</Text>}
      </View>
      <View style={styles.counterRow}>
        <BoutonCompteur
          sens="moins" label={`Retirer un billet : ${titre}`} accent={accent}
          onPress={() => onChange(Math.max(0, quantity - 1))} disabled={quantity <= 0}
        />
        <ValeurCompteur value={quantity} lecture={`${titre} : ${quantity}`} />
        <BoutonCompteur
          sens="plus" label={`Ajouter un billet : ${titre}`} accent={accent}
          onPress={() => { if (!atMax) onChange(quantity + 1); }} disabled={atMax}
        />
      </View>
    </View>
  );
}

export function SiteBookingForm({ accent, form, setForm, onSubmit, loading, availability, offerCtx, venue }:
  { accent: string; form: SiteForm; setForm: (f: SiteForm) => void; onSubmit: () => void;
    loading: boolean; availability: Availability; offerCtx: OfferContext; venue: VenueContext }) {
  const hasTickets = offerCtx.offers.length > 0;
  // Sans catalogue de billets, l'étape panier n'a rien à montrer : on l'ignore.
  const [step, setStep] = useState(hasTickets ? 0 : 1);

  // Les places d'un site se comptent par créneau. Tant qu'aucun créneau n'est
  // choisi, on ne sait rien de la disponibilité — et on ne prétend rien.
  const ticketsLeft = (o: EstablishmentOffer) =>
    offerCtx.remainingForSlot(o, form.visitDate, form.timeSlot);
  const cartCount = Object.values(form.cart).reduce((s, n) => s + n, 0);
  const cartLines = offerCtx.offers
    .filter(o => (form.cart[o.id] ?? 0) > 0)
    .map(o => ({
      label: offerLabel(o, offerCtx.categoryOf(o)),
      detail: `${o.price} ${o.currency} × ${form.cart[o.id]}`,
      amount: o.price * form.cart[o.id],
    }));

  const labels = hasTickets ? ['Billets', 'Date', 'Vos informations'] : ['Date', 'Vos informations'];
  const shown = hasTickets ? step : step - 1;
  const slotState = slotStateFor(venue.openingHours, form.visitDate, SITE_SLOT_STEP_MIN);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.corps}>
      <StepProgress
        labels={labels} current={shown} accent={accent}
        onGoBack={i => setStep(hasTickets ? i : i + 1)}
      />

      {step === 0 && (
        <>
          <Text style={styles.fieldLabel}>Vos billets</Text>
          {/* Le panier se compose avant la date : le voyageur sait d'abord ce
              qu'il veut voir. La disponibilité par billet n'est donc annoncée
              qu'une fois la date choisie, à l'étape suivante. */}
          <View style={{ gap: spacing.sm }}>
            {offerCtx.offers.map(o => (
              <TicketRow
                key={o.id}
                offer={o}
                category={offerCtx.categoryOf(o)}
                accent={accent}
                quantity={form.cart[o.id] ?? 0}
                remaining={ticketsLeft(o)}
                onChange={n => setForm({ ...form, cart: { ...form.cart, [o.id]: n } })}
              />
            ))}
          </View>

          <BookingRecap lines={cartLines} currency={offerCtx.offers[0]?.currency ?? 'USD'} />

          <Button
            label="Continuer" onPress={() => setStep(1)} color={accent}
            disabled={cartCount === 0}
          />
        </>
      )}

      {step === 1 && (
        <>
          <DateField
            label="Date de visite"
            sheetTitle="Date de la visite"
            value={form.visitDate}
            onChange={iso => setForm({ ...form, visitDate: iso, timeSlot: '' })}
            fullDays={availability.fullDays}
            closedDays={availability.closedDays}
            accent={accent}
          />

          <Text style={styles.fieldLabel}>Créneau d'entrée</Text>
          {slotState.message ? (
            <Indication alerte={!!form.visitDate}>{slotState.message}</Indication>
          ) : (
            <SlotPicker
              slots={slotState.slots}
              selected={form.timeSlot}
              onSelect={s => setForm({ ...form, timeSlot: s })}
              accent={accent}
              label="Créneau d'entrée"
            />
          )}

          {/* Sans billetterie, la composition du groupe reste saisie ici. */}
          {!hasTickets && (
            <>
              <Text style={styles.fieldLabel}>Composition du groupe</Text>
              <View style={styles.formRow}>
                <Counter label="Adultes" value={form.adults} accent={accent} min={1} decLabel="Retirer un adulte" incLabel="Ajouter un adulte" onDec={() => setForm({ ...form, adults: Math.max(1, form.adults - 1) })} onInc={() => setForm({ ...form, adults: form.adults + 1 })} />
                <Counter label="Enfants" value={form.children} accent={accent} min={0} decLabel="Retirer un enfant" incLabel="Ajouter un enfant" onDec={() => setForm({ ...form, children: Math.max(0, form.children - 1) })} onInc={() => setForm({ ...form, children: form.children + 1 })} />
              </View>
            </>
          )}

          {/* Un billet devenu indisponible à la date retenue doit se voir avant
              l'envoi, pas au retour du serveur. */}
          {!!form.timeSlot && offerCtx.offers.some(o => {
            const want = form.cart[o.id] ?? 0;
            const rest = ticketsLeft(o);
            return want > 0 && rest !== null && rest < want;
          }) && (
            <Indication alerte>
              Certains billets ne sont plus disponibles en quantité suffisante sur ce créneau.
              Revenez à l'étape « Billets » pour ajuster.
            </Indication>
          )}

          <Text style={styles.fieldLabel}>Type de visite</Text>
          <View style={styles.formRow} accessibilityRole="radiogroup" accessibilityLabel="Type de visite">
            {[{ key: 'guided', label: 'Guidée' }, { key: 'free', label: 'Libre' }].map(v => (
              <Choix key={v.key} label={v.label} actif={form.visitType === v.key} accent={accent} etire onPress={() => setForm({ ...form, visitType: v.key as any })} />
            ))}
          </View>
          <Text style={styles.fieldLabel}>Nationalité</Text>
          <View style={styles.formRow} accessibilityRole="radiogroup" accessibilityLabel="Nationalité">
            {[{ key: 'congolaise', label: 'Congolaise' }, { key: 'etrangere', label: 'Étrangère' }].map(n => (
              <Choix key={n.key} label={n.label} actif={form.nationality === n.key} accent={accent} etire onPress={() => setForm({ ...form, nationality: n.key as any })} />
            ))}
          </View>

          <Button
            label="Continuer" onPress={() => setStep(2)} color={accent}
            disabled={!form.visitDate || !form.timeSlot}
          />
        </>
      )}

      {step === 2 && (
        <>
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}><FormField label="Prénom" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} autoComplete="given-name" placeholder="Pierre" /></View>
            <View style={{ flex: 1 }}><FormField label="Nom" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} autoComplete="family-name" placeholder="Tshimanga" /></View>
          </View>
          <FormField label="Postnom (facultatif)" value={form.postName} onChange={v => setForm({ ...form, postName: v })} autoComplete="additional-name" placeholder="Kabasele" />
          <PhoneField
            label="Téléphone (responsable)"
            dial={form.phoneDial}
            onDialChange={v => setForm({ ...form, phoneDial: v })}
            value={form.phone}
            onChange={v => setForm({ ...form, phone: v })}
          />
          <FormField label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="pierre@exemple.cd" keyboardType="email-address" autoComplete="email" />
          <FormField label="Remarques (optionnel)" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Accessibilité PMR, équipement spécial..." multiline />

          <BookingRecap lines={cartLines} currency={offerCtx.offers[0]?.currency ?? 'USD'} />

          <Button label="Réserver la visite" onPress={onSubmit} loading={loading} color={accent} icon={<Send size={15} color={colors.cream} strokeWidth={1.75} />} />
        </>
      )}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  // Sur grand écran, la feuille occupe toute la largeur de la fenêtre : sans
  // limite, un champ de prénom s'étirerait sur plus de mille pixels.
  corps: { paddingBottom: spacing.lg, width: '100%', maxWidth: breakpoints.formMax, alignSelf: 'center' },
  chip: { paddingHorizontal: spacing.v12, paddingVertical: spacing.sm, borderRadius: radii.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chipText: { ...typography.caption, color: colors.muted },
  chipTextActif: { color: colors.cream },
  chipTextCentre: { textAlign: 'center' },
  // L'écart de 12 sous la puce est conservé : la zone en reprend sa part.
  chipZone: { minHeight: cible.min, minWidth: cible.min, justifyContent: 'center',
    marginTop: -DEBORD_PUCE, marginBottom: spacing.v12 - DEBORD_PUCE },
  chipZoneEtiree: { flex: 1 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  counter: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.sm, padding: spacing.v12, gap: spacing.xs, marginBottom: spacing.v12 },
  counterBtn: { width: PASTILLE_COMPTEUR, height: PASTILLE_COMPTEUR, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  counterBtnInactif: { opacity: 0.5 },
  counterBtnMuted: { backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border },
  counterLabel: { ...typography.overlineXs, color: colors.muted },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Largeur plancher : sur une ligne de billet, où rien d'autre ne sépare les
  // deux boutons, c'est elle qui empêche leurs zones tactiles de se recouvrir.
  counterValue: { ...typography.sheetOption, color: colors.ink, minWidth: cible.min - PASTILLE_COMPTEUR, textAlign: 'center' },
  counterZone: {
    width: cible.min, height: cible.min, margin: -(cible.min - PASTILLE_COMPTEUR) / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  formRow: { flexDirection: 'row', gap: spacing.v12 },
  recap: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm, gap: spacing.sm,
  },
  recapAmount: { ...typography.caption, color: colors.ink },
  recapDetail: { ...typography.badgeSm, color: colors.faint, marginTop: spacing.v2 },
  recapLabel: { ...typography.caption, color: colors.ink },
  recapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  recapTotal: { ...typography.cardTitle, color: colors.ink },
  recapTotalLabel: { ...typography.caption, color: colors.muted },
  recapTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.v2,
  },
  slotHint: { ...typography.caption, color: colors.faint, marginBottom: spacing.v12 },
  ticketDesc: { ...typography.caption, color: colors.muted, marginTop: spacing.v2 },
  ticketFull: { ...typography.badgeSm, color: colors.danger, marginTop: spacing.v2 },
  ticketLabel: { ...typography.cardTitle, color: colors.ink },
  ticketPrice: { ...typography.caption, fontFamily: fonts.sansSemiBold, marginTop: spacing.v2 },
  ticketRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.white, padding: spacing.sm,
  },
  fieldLabel: { ...typography.caption, color: colors.ink, marginBottom: spacing.xs },
});
