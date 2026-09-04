import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Minus, Plus, Send, Info } from 'lucide-react-native';
import { colors, spacing, typography, radii } from '../lib/theme';
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

export function Counter({ label, value, onDec, onInc, accent }:
  { label: string; value: number; onDec: () => void; onInc: () => void; accent: string }) {
  return (
    <View style={styles.counter}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={'Diminuer : ' + label} style={[styles.counterBtn, styles.counterBtnMuted]} onPress={onDec} hitSlop={9}>
          <Minus size={14} color={colors.muted} />
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={'Augmenter : ' + label} style={[styles.counterBtn, { backgroundColor: accent }]} onPress={onInc} hitSlop={9}>
          <Plus size={14} color={colors.cream} />
        </Pressable>
      </View>
    </View>
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
export function SlotPicker({ slots, selected, onSelect, accent }:
  { slots: TimeSlot[]; selected: string; onSelect: (s: string) => void; accent: string }) {
  return (
    <View style={[styles.formRow, { flexWrap: 'wrap', gap: spacing.v6 }]}>
      {slots.map(s => {
        const isSelected = selected === s;
        return (
          <Pressable
            key={s}
            style={[styles.chip, isSelected && { backgroundColor: accent, borderColor: accent }]}
            onPress={() => onSelect(s)}
          >
            <Text style={[styles.chipText, isSelected && { color: colors.cream, fontWeight: '500' }]}>
              {s}
            </Text>
          </Pressable>
        );
      })}
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
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
      <StepProgress labels={labels} current={shown} accent={accent} onGoBack={i => setStep(skipChoice ? i + 1 : i)} />

      {step === 0 && (
        <View style={{ gap: spacing.sm }}>
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
            <Counter label="Adultes" value={form.adults} accent={accent} onDec={() => setForm({ ...form, adults: Math.max(1, form.adults - 1) })} onInc={() => setForm({ ...form, adults: form.adults + 1 })} />
            <Counter label="Enfants" value={form.children} accent={accent} onDec={() => setForm({ ...form, children: Math.max(0, form.children - 1) })} onInc={() => setForm({ ...form, children: form.children + 1 })} />
          </View>

          {/* Un groupe plus grand que la capacité d'une unité en occupe
              plusieurs — on le dit avant l'envoi plutôt que de refuser. */}
          {selected?.max_guests != null && units > 1 && (
            <Text style={styles.slotHint}>
              {guests} personnes pour {selected.max_guests} par {isHouse ? 'logement' : 'chambre'} :
              {' '}{units} {isHouse ? 'logements seront réservés' : 'chambres seront réservées'}.
            </Text>
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
            <View style={{ flex: 1 }}><FormField label="Prénom" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} placeholder="Jean" /></View>
            <View style={{ flex: 1 }}><FormField label="Nom" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} placeholder="Mbeki" /></View>
          </View>
          <FormField label="Postnom (facultatif)" value={form.postName} onChange={v => setForm({ ...form, postName: v })} placeholder="Kabasele" />
          <PhoneField
            label="Téléphone" dial={form.phoneDial}
            onDialChange={v => setForm({ ...form, phoneDial: v })}
            value={form.phone} onChange={v => setForm({ ...form, phone: v })}
          />
          <FormField label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="jean@exemple.cd" keyboardType="email-address" />

          <Text style={styles.fieldLabel}>Mode de paiement</Text>
          <View style={[styles.formRow, { flexWrap: 'wrap', gap: spacing.v6 }]}>
            {PAYMENTS.map(p => (
              <Pressable key={p.key} style={[styles.chip, form.paymentMethod === p.key && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, paymentMethod: p.key as any })}>
                <Text style={[styles.chipText, form.paymentMethod === p.key && { color: colors.cream, fontWeight: '500' }]}>{p.label}</Text>
              </Pressable>
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
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
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
            <Text style={styles.slotHint}>{slotState.message}</Text>
          ) : (
            <SlotPicker
              slots={slotState.slots}
              selected={form.timeSlot}
              onSelect={s => setForm({ ...form, timeSlot: s })}
              accent={accent}
            />
          )}

          <Text style={styles.fieldLabel}>Couverts</Text>
          <View style={styles.formRow}>
            <Counter label="Adultes" value={form.adults} accent={accent} onDec={() => setForm({ ...form, adults: Math.max(1, form.adults - 1) })} onInc={() => setForm({ ...form, adults: form.adults + 1 })} />
            <Counter label="Enfants" value={form.children} accent={accent} onDec={() => setForm({ ...form, children: Math.max(0, form.children - 1) })} onInc={() => setForm({ ...form, children: form.children + 1 })} />
          </View>

          {/* Formule facultative : on réserve une table, pas un menu. « À la
              carte » n'est pas une offre du catalogue, c'est son absence.
              La carte reste consultable ici : choisir une formule sans pouvoir
              la lire n'a pas de sens. */}
          {offerCtx.offers.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Formule (facultatif)</Text>
              <View style={{ gap: spacing.sm }}>
                <Pressable
                  style={[styles.chip, !form.offerId && { backgroundColor: accent, borderColor: accent }]}
                  onPress={() => setForm({ ...form, offerId: '' })}
                >
                  <Text style={[styles.chipText, !form.offerId && { color: colors.cream, fontWeight: '500' }]}>
                    À la carte
                  </Text>
                </Pressable>
                {offerCtx.offers.map(o => (
                  <OfferCard
                    key={o.id}
                    offer={o}
                    category={offerCtx.categoryOf(o)}
                    photoUrl={offerCtx.photoOf(o.id)}
                    selected={form.offerId === o.id}
                    accent={accent}
                    onPress={() => setForm({ ...form, offerId: o.id })}
                  />
                ))}
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>Occasion</Text>
          <View style={[styles.formRow, { flexWrap: 'wrap', gap: spacing.v6 }]}>
            {OCCASIONS.map(o => (
              <Pressable key={o.key} style={[styles.chip, form.occasion === o.key && { backgroundColor: accent, borderColor: accent }]} onPress={() => setForm({ ...form, occasion: o.key as any })}>
                <Text style={[styles.chipText, form.occasion === o.key && { color: colors.cream, fontWeight: '500' }]}>{o.label}</Text>
              </Pressable>
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
  return (
    <View style={styles.ticketRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.ticketLabel}>{offerLabel(offer, category)}</Text>
        {!!offer.description && <Text style={styles.ticketDesc} numberOfLines={2}>{offer.description}</Text>}
        <Text style={[styles.ticketPrice, { color: accent }]}>{offer.price} {offer.currency}</Text>
        {full && <Text style={styles.ticketFull}>Complet à cette date</Text>}
      </View>
      <View style={styles.counterRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Diminuer la quantité" style={[styles.counterBtn, styles.counterBtnMuted]} onPress={() => onChange(Math.max(0, quantity - 1))} hitSlop={9}>
          <Minus size={14} color={colors.muted} />
        </Pressable>
        <Text style={styles.counterValue}>{quantity}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Augmenter la quantité"
          style={[styles.counterBtn, { backgroundColor: atMax ? colors.border : accent }]}
          onPress={() => { if (!atMax) onChange(quantity + 1); }}
          hitSlop={9}
        >
          <Plus size={14} color={atMax ? colors.faint : colors.cream} />
        </Pressable>
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
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
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
            <Text style={styles.slotHint}>{slotState.message}</Text>
          ) : (
            <SlotPicker
              slots={slotState.slots}
              selected={form.timeSlot}
              onSelect={s => setForm({ ...form, timeSlot: s })}
              accent={accent}
            />
          )}

          {/* Sans billetterie, la composition du groupe reste saisie ici. */}
          {!hasTickets && (
            <>
              <Text style={styles.fieldLabel}>Composition du groupe</Text>
              <View style={styles.formRow}>
                <Counter label="Adultes" value={form.adults} accent={accent} onDec={() => setForm({ ...form, adults: Math.max(1, form.adults - 1) })} onInc={() => setForm({ ...form, adults: form.adults + 1 })} />
                <Counter label="Enfants" value={form.children} accent={accent} onDec={() => setForm({ ...form, children: Math.max(0, form.children - 1) })} onInc={() => setForm({ ...form, children: form.children + 1 })} />
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
            <Text style={styles.slotHint}>
              Certains billets ne sont plus disponibles en quantité suffisante sur ce créneau.
              Revenez à l'étape « Billets » pour ajuster.
            </Text>
          )}

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

          <Button
            label="Continuer" onPress={() => setStep(2)} color={accent}
            disabled={!form.visitDate || !form.timeSlot}
          />
        </>
      )}

      {step === 2 && (
        <>
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
          <FormField label="Remarques (optionnel)" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="Accessibilité PMR, équipement spécial..." multiline />

          <BookingRecap lines={cartLines} currency={offerCtx.offers[0]?.currency ?? 'USD'} />

          <Button label="Réserver la visite" onPress={onSubmit} loading={loading} color={accent} icon={<Send size={15} color={colors.cream} strokeWidth={1.75} />} />
        </>
      )}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  chip: { paddingHorizontal: spacing.v12, paddingVertical: 7, borderRadius: radii.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.v12 },
  chipText: { ...typography.caption, color: colors.muted },
  counter: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.sm, padding: spacing.v10, gap: spacing.xs, marginBottom: spacing.v12 },
  counterBtn: { width: 26, height: 26, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  counterBtnMuted: { backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border },
  counterLabel: { ...typography.overlineXs, color: colors.muted },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterValue: { ...typography.sheetOption, color: colors.ink },
  formRow: { flexDirection: 'row', gap: spacing.sm + 2 },
  recap: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm, gap: spacing.v6,
  },
  recapAmount: { ...typography.caption, color: colors.ink },
  recapDetail: { ...typography.badgeSm, color: colors.faint, marginTop: 1 },
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
  ticketPrice: { ...typography.caption, fontWeight: '600', marginTop: 3 },
  ticketRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.white, padding: spacing.sm,
  },
  fieldLabel: { ...typography.caption, color: colors.ink, marginBottom: 5 },
});
