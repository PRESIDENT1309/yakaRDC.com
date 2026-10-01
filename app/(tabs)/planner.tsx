import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  CalendarRange, CalendarCheck, Plus, Trash2, X, Check, Edit3,
  FileText, Shirt, Droplet, Package, MapPin, Users, Wallet,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { ecrire } from '../../lib/db';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, typography, radii, spacing } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import { useConfirm } from '../../lib/confirm-context';
import CategoryIcon from '../../components/CategoryIcon';
import StatusBadge from '../../components/StatusBadge';
import Chip from '../../components/Chip';
import DateField from '../../components/DateField';
import EmptyState from '../../components/EmptyState';
import type {
  TripPlan, TripPlanItem, TripPackingItem, Establishment,
  Booking, PackingCategory,
} from '../../lib/types';

/**
 * Planificateur de voyage.
 *
 * ── Ce que cette refonte a changé, et pourquoi ─────────────────────────────
 *
 * L'écran rangeait un voyage dans six onglets — Itinéraire, Budget, Résa.,
 * Lieux, Prépa, Notes — dont deux avaient dû être abrégés faute de place.
 * Mesuré sur un voyage réel de 23 jours : la barre d'onglets faisait 499 px
 * pour 464 disponibles (le sixième était coupé), le sélecteur de jours 1 846 px
 * pour 464 visibles (25 %), et la première ligne de contenu apparaissait à
 * 306 px sur une fenêtre de 588 — plus de la moitié de l'écran en décor.
 *
 * Le geste retenu : rendre le temps à l'écran. Ce qui est daté vit dans une
 * seule colonne (« Voyage »), ce qui ne l'est pas passe dans « Préparatifs ».
 *
 * Deux décisions méritent d'être expliquées, parce qu'elles ne vont pas de soi :
 *
 *  1. Les réservations sont FONDUES dans la journée, à leur heure, au lieu
 *     d'occuper un onglet. Une nuit d'hôtel est un événement du séjour. Le
 *     modèle de données le permettait déjà : `check_in` / `visit_date` étaient
 *     comparés aux dates du voyage pour filtrer — il suffisait de regrouper.
 *
 *  2. Seules les journées PEUPLÉES sont affichées. Une première version de
 *     cette refonte proposait une colonne continue du premier au dernier jour ;
 *     confrontée au voyage réel — 23 jours, zéro activité — elle produisait
 *     vingt-trois en-têtes vides, soit pire que le sélecteur qu'elle
 *     remplaçait. Les jours libres sont désormais résumés en une ligne.
 */

type Tab = 'voyage' | 'preparatifs';

const TABS: { key: Tab; label: string }[] = [
  { key: 'voyage', label: 'Voyage' },
  { key: 'preparatifs', label: 'Préparatifs' },
];

// Icônes lucide plutôt que les émojis d'origine (📄 👕 🧴 ✨) : un émoji ne
// prend pas la couleur de la marque, se dessine différemment selon l'appareil,
// et casse l'alignement typographique.
const PACKING_CATEGORIES: { key: PackingCategory; label: string; Icone: typeof FileText }[] = [
  { key: 'documents', label: 'Documents', Icone: FileText },
  { key: 'clothing', label: 'Vêtements', Icone: Shirt },
  { key: 'personal', label: 'Objets personnels', Icone: Droplet },
  { key: 'custom', label: 'Autres', Icone: Package },
];

type BookingAvecEtab = Booking & { establishment: Establishment };

/** Un événement daté : une étape saisie, ou une réservation venue du catalogue. */
type Evenement =
  | { genre: 'etape'; heure: string | null; etape: TripPlanItem }
  | { genre: 'reservation'; heure: string | null; resa: BookingAvecEtab; role: 'Arrivée' | 'Départ' | 'Visite' };

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatDayLabel(iso: string) {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
    day: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    full: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

/** « 14:30:00 » → « 14:30 ». Les secondes n'apprennent rien à un voyageur. */
function heureCourte(h: string | null | undefined): string | null {
  if (!h) return null;
  return h.slice(0, 5);
}

export default function PlannerScreen() {
  const { session } = useAuth();
  const confirm = useConfirm();
  const { isWide, contentWidth } = useResponsive();
  // Zone sûre réelle, au lieu du `Platform.OS === 'ios' ? 56 : 20` codé en dur
  // qui ignorait les encoches Android.
  const insets = useSafeAreaInsets();
  const wide = { maxWidth: contentWidth, width: '100%' as const, alignSelf: 'center' as const };

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [items, setItems] = useState<TripPlanItem[]>([]);
  const [packingItems, setPackingItems] = useState<TripPackingItem[]>([]);
  const [bookings, setBookings] = useState<BookingAvecEtab[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('voyage');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Formulaire voyage
  const [showTripForm, setShowTripForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState(false);
  const [title, setTitle] = useState('Mon voyage à Kinshasa');
  const [destination, setDestination] = useState('Kinshasa, RDC');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelerCount, setTravelerCount] = useState('1');
  const [plannedBudget, setPlannedBudget] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Ajout d'étape / de lieu
  const [addModal, setAddModal] = useState<'itinerary' | 'wishlist' | null>(null);
  const [itemTitle, setItemTitle] = useState('');
  const [itemTime, setItemTime] = useState('');
  const [itemCost, setItemCost] = useState('');
  const [itemNotes, setItemNotes] = useState('');

  // Valise
  const [packingModal, setPackingModal] = useState(false);
  const [packingLabel, setPackingLabel] = useState('');
  const [packingCategory, setPackingCategory] = useState<PackingCategory>('documents');

  // Notes
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Détail du budget, ouvert depuis la jauge
  const [budgetModal, setBudgetModal] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!session?.user) { setLoading(false); return; }
    setLoading(true);

    const { data: plans } = await supabase.from('trip_plans')
      .select('*').eq('traveler_id', session.user.id)
      .order('created_at', { ascending: false }).limit(1);

    const currentPlan = (plans?.[0] as TripPlan | undefined) ?? null;
    setPlan(currentPlan);
    setNotesDraft(currentPlan?.notes ?? '');

    if (currentPlan) {
      const [{ data: planItems }, { data: packing }, { data: bookingsData }] = await Promise.all([
        supabase.from('trip_plan_items').select('*')
          .eq('trip_plan_id', currentPlan.id)
          .order('day_date', { ascending: true }).order('position', { ascending: true }),
        supabase.from('trip_packing_items').select('*')
          .eq('trip_plan_id', currentPlan.id)
          .order('category', { ascending: true }).order('position', { ascending: true }),
        supabase.from('bookings').select('*, establishment:establishments(*)')
          .eq('traveler_id', session.user.id),
      ]);
      setItems((planItems as TripPlanItem[]) ?? []);
      setPackingItems((packing as TripPackingItem[]) ?? []);

      // Réservations dont la date tombe dans la période du voyage
      const allBookings = (bookingsData as any[]) ?? [];
      const inRange = allBookings.filter(b => {
        const d = b.check_in || b.visit_date;
        if (!d) return false;
        return d >= currentPlan.start_date && d <= currentPlan.end_date;
      });
      setBookings(inRange);
      setSelectedDay(prev => prev ?? currentPlan.start_date);
    } else {
      setItems([]); setPackingItems([]); setBookings([]);
    }

    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openTripForm(editing: boolean) {
    if (editing && plan) {
      setTitle(plan.title);
      setDestination(plan.destination ?? '');
      setStartDate(plan.start_date);
      setEndDate(plan.end_date);
      setTravelerCount(String(plan.traveler_count));
      setPlannedBudget(plan.planned_budget != null ? String(plan.planned_budget) : '');
    } else {
      setTitle('Mon voyage à Kinshasa');
      setDestination('Kinshasa, RDC');
      setStartDate(''); setEndDate('');
      setTravelerCount('1'); setPlannedBudget('');
    }
    setEditingTrip(editing);
    setFormError(null);
    setShowTripForm(true);
  }

  async function handleSaveTrip() {
    setFormError(null);
    if (!title.trim() || !startDate || !endDate) {
      setFormError('Titre et dates sont obligatoires.');
      return;
    }
    // Les dates arrivent déjà en ISO du sélecteur : il n'y a plus de format à
    // valider, seulement leur ordre — que le champ « Retour » empêche déjà,
    // mais qu'on revérifie ici parce qu'une garde d'interface n'est pas une
    // garde de données.
    const isoStart = startDate;
    const isoEnd = endDate;
    if (isoEnd < isoStart) { setFormError('La date de retour doit suivre le départ.'); return; }

    setSaving(true);
    const payload = {
      title: title.trim(),
      destination: destination.trim() || null,
      start_date: isoStart,
      end_date: isoEnd,
      traveler_count: parseInt(travelerCount, 10) || 1,
      planned_budget: plannedBudget ? parseFloat(plannedBudget) : null,
    };

    if (editingTrip && plan) {
      await supabase.from('trip_plans').update(payload).eq('id', plan.id);
    } else {
      await supabase.from('trip_plans').insert({ traveler_id: session!.user.id, ...payload });
    }
    setSaving(false);
    setShowTripForm(false);
    fetchAll();
  }

  async function confirmDeleteTrip() {
    if (!plan) return;
    const ok = await confirm({
      title: 'Supprimer ce voyage',
      message: 'Tout son contenu sera supprimé définitivement.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    // Vider l'écran alors que le voyage existe encore donnerait au voyageur
    // la certitude d'avoir tout perdu — puis tout réapparaîtrait au retour.
    const supprime = await ecrire(
      supabase.from('trip_plans').delete().eq('id', plan.id),
      'Suppression du voyage',
    );
    if (!supprime) return;
    setShowTripForm(false);
    setPlan(null); setItems([]); setPackingItems([]); setBookings([]);
  }

  async function handleAddItem() {
    if (!plan || !itemTitle.trim() || !addModal) return;
    await supabase.from('trip_plan_items').insert({
      trip_plan_id: plan.id,
      item_type: addModal,
      day_date: addModal === 'itinerary' ? selectedDay : null,
      time: addModal === 'itinerary' ? (itemTime.trim() || null) : null,
      title: itemTitle.trim(),
      estimated_cost: parseFloat(itemCost) || 0,
      notes: itemNotes.trim() || null,
      position: items.filter(i => i.item_type === addModal && i.day_date === selectedDay).length,
    });
    setAddModal(null);
    setItemTitle(''); setItemTime(''); setItemCost(''); setItemNotes('');
    fetchAll();
  }

  async function toggleVisited(item: TripPlanItem) {
    // La coche ne bascule que si la base l'a suivie : une case cochée qui se
    // décoche au retour sur l'écran est pire qu'un refus annoncé tout de suite.
    const bascule = await ecrire(
      supabase.from('trip_plan_items').update({ visited: !item.visited }).eq('id', item.id),
      'Mise à jour de l’étape',
    );
    if (!bascule) return;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, visited: !i.visited } : i));
  }

  async function deleteItem(id: string) {
    const supprime = await ecrire(
      supabase.from('trip_plan_items').delete().eq('id', id),
      'Suppression de l’étape',
    );
    if (!supprime) return;
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function handleAddPacking() {
    if (!plan || !packingLabel.trim()) return;
    const { data } = await supabase.from('trip_packing_items').insert({
      trip_plan_id: plan.id,
      category: packingCategory,
      label: packingLabel.trim(),
      position: packingItems.filter(p => p.category === packingCategory).length,
    }).select().single();
    if (data) setPackingItems(prev => [...prev, data as TripPackingItem]);
    setPackingModal(false);
    setPackingLabel('');
  }

  async function togglePacking(item: TripPackingItem) {
    const bascule = await ecrire(
      supabase.from('trip_packing_items').update({ is_checked: !item.is_checked }).eq('id', item.id),
      'Mise à jour de la valise',
    );
    if (!bascule) return;
    setPackingItems(prev => prev.map(p => p.id === item.id ? { ...p, is_checked: !p.is_checked } : p));
  }

  async function deletePacking(id: string) {
    const supprime = await ecrire(
      supabase.from('trip_packing_items').delete().eq('id', id),
      'Suppression de l’article',
    );
    if (!supprime) return;
    setPackingItems(prev => prev.filter(p => p.id !== id));
  }

  async function handleSaveNotes() {
    if (!plan) return;
    setSavingNotes(true);
    // Le cas le plus coûteux du planificateur : le voyageur a écrit du texte,
    // l'indicateur d'enregistrement s'éteint, et les notes n'ont jamais quitté
    // l'appareil. Un échec silencieux ici, c'est de la saisie perdue.
    await ecrire(
      supabase.from('trip_plans').update({ notes: notesDraft.trim() || null }).eq('id', plan.id),
      'Enregistrement des notes',
    );
    setSavingNotes(false);
  }

  // ── Calculs budget ──
  const itineraryItems = items.filter(i => i.item_type === 'itinerary');
  const wishlistItems = items.filter(i => i.item_type === 'wishlist');
  const estimatedTotal = itineraryItems.reduce((s, i) => s + Number(i.estimated_cost), 0);
  const actualTotal = itineraryItems.reduce((s, i) => s + Number(i.actual_cost ?? i.estimated_cost), 0);
  const remaining = plan?.planned_budget != null ? plan.planned_budget - actualTotal : null;

  const days = plan ? dateRange(plan.start_date, plan.end_date) : [];

  /**
   * Le cœur de la refonte : une seule liste de journées peuplées, où les étapes
   * saisies et les réservations se mêlent dans l'ordre des heures.
   *
   * Une réservation d'hôtel produit deux événements — l'arrivée et le départ —
   * parce que ce sont deux moments distincts du séjour, et qu'un voyageur qui
   * regarde son dernier jour doit y voir qu'il quitte l'hôtel.
   */
  const journees = useMemo(() => {
    const parJour = new Map<string, Evenement[]>();
    const pousse = (date: string | null | undefined, e: Evenement) => {
      if (!date || date < (plan?.start_date ?? '') || date > (plan?.end_date ?? '')) return;
      const liste = parJour.get(date) ?? [];
      liste.push(e);
      parJour.set(date, liste);
    };

    itineraryItems.forEach(it => pousse(it.day_date, {
      genre: 'etape', heure: heureCourte(it.time), etape: it,
    }));

    bookings.forEach(b => {
      if (b.check_in) {
        pousse(b.check_in, { genre: 'reservation', heure: null, resa: b, role: 'Arrivée' });
        if (b.check_out) pousse(b.check_out, { genre: 'reservation', heure: null, resa: b, role: 'Départ' });
      } else {
        pousse(b.visit_date, {
          genre: 'reservation', heure: heureCourte(b.visit_time), resa: b, role: 'Visite',
        });
      }
    });

    return days
      .filter(d => (parJour.get(d)?.length ?? 0) > 0)
      .map(d => {
        const evenements = (parJour.get(d) ?? []).sort((a, b) => {
          // Sans heure, l'événement remonte en tête de journée : mieux vaut
          // « quelque part dans la journée » en premier qu'enfoui à la fin.
          if (!a.heure && !b.heure) return 0;
          if (!a.heure) return -1;
          if (!b.heure) return 1;
          return a.heure.localeCompare(b.heure);
        });
        const total = evenements.reduce(
          (s, e) => s + (e.genre === 'etape' ? Number(e.etape.estimated_cost) : 0), 0,
        );
        return { date: d, evenements, total };
      });
  }, [days, itineraryItems, bookings, plan?.start_date, plan?.end_date]);

  /**
   * Nombre de jours libres ENTRE deux journées peuplées.
   *
   * Rien avant la première : sur un voyage réel commencé le 1ᵉʳ février dont
   * la première réservation tombait le 1ᵉʳ septembre, la version initiale
   * affichait « 212 jours libres » en tête de colonne. Le chiffre était exact
   * et sans usage — les dates du séjour sont déjà dans le billet, et personne
   * ne compte les jours qui précèdent son premier rendez-vous. Un écart entre
   * deux événements, lui, se lit : il dit qu'on a sauté du temps.
   */
  function joursLibresAvant(index: number): number {
    if (index === 0) return 0;
    const precedent = days.indexOf(journees[index - 1].date);
    return days.indexOf(journees[index].date) - precedent - 1;
  }

  function ouvrirAjoutEtape(jour: string | null) {
    setSelectedDay(jour ?? plan?.start_date ?? null);
    setItemTitle(''); setItemTime(''); setItemCost(''); setItemNotes('');
    setAddModal('itinerary');
  }

  // ── État : pas de compte ──
  // Placé avant « aucun voyage » à dessein : ce dernier propose « Créer mon
  // voyage », qui ouvrirait le formulaire puis échouerait à l'enregistrement
  // faute de session. Mieux vaut demander la connexion d'abord.
  if (!loading && !session?.user) {
    return (
      <View style={styles.screen}>
        <View style={[styles.entete, { paddingTop: Math.max(insets.top, 20) }]}>
          <Text style={styles.enteteTitre}>Mon planning</Text>
        </View>
        <EmptyState
          icon={<CalendarRange size={44} color={colors.borderStrong} strokeWidth={1.75} />}
          title="Planifiez votre séjour"
          description="Connectez-vous pour composer votre itinéraire, suivre votre budget et retrouver vos réservations."
          actionLabel="Se connecter"
          onAction={() => router.push({
            pathname: '/(auth)/login',
            params: { redirect: '/(tabs)/planner', reason: 'Connectez-vous pour planifier votre voyage.' },
          })}
        />
      </View>
    );
  }

  // ── État : aucun voyage ──
  if (!loading && !plan && !showTripForm) {
    return (
      <View style={styles.screen}>
        <View style={[styles.entete, { paddingTop: Math.max(insets.top, 20) }]}>
          <Text style={styles.enteteTitre}>Mon planning</Text>
        </View>
        <EmptyState
          icon={<CalendarRange size={44} color={colors.borderStrong} strokeWidth={1.75} />}
          title="Planifiez votre séjour"
          description="Itinéraire, budget, réservations, lieux à visiter et valise — tout au même endroit."
          actionLabel="Créer mon voyage"
          onAction={() => openTripForm(false)}
        />
      </View>
    );
  }

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.lave} /></View>;
  }

  const partBudget = plan?.planned_budget && plan.planned_budget > 0
    ? Math.min(100, (actualTotal / plan.planned_budget) * 100)
    : null;

  return (
    <View style={styles.screen}>

      {/* ── Le billet : une seule rangée, budget compris ──────────────────
          Remplace trois rangées empilées (bandeau de chiffres à émojis, carte
          du voyage, onglets) qui consommaient 306 px avant tout contenu. */}
      <View style={[styles.billet, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={isWide ? wide : undefined}>
          <Pressable
            style={styles.billetHaut}
            onPress={() => openTripForm(true)}
            accessibilityRole="button"
            accessibilityLabel="Modifier le voyage"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.billetTitre} numberOfLines={1}>{plan?.title}</Text>
              <View style={styles.billetMetaRangee}>
                {!!plan?.destination && (
                  <View style={styles.billetMetaItem}>
                    <MapPin size={11} color={CREAM_ATTENUE} strokeWidth={2} />
                    <Text style={styles.billetMeta}>{plan.destination}</Text>
                  </View>
                )}
                <View style={styles.billetMetaItem}>
                  <CalendarRange size={11} color={CREAM_ATTENUE} strokeWidth={2} />
                  <Text style={styles.billetMeta}>
                    {plan && `${formatDayLabel(plan.start_date).day} → ${formatDayLabel(plan.end_date).day}`}
                  </Text>
                </View>
                <View style={styles.billetMetaItem}>
                  <Users size={11} color={CREAM_ATTENUE} strokeWidth={2} />
                  <Text style={styles.billetMeta}>{plan?.traveler_count}</Text>
                </View>
              </View>
            </View>
            <Edit3 size={15} color={CREAM_ATTENUE} />
          </Pressable>

          {/* La jauge remplace l'onglet Budget : on voit l'effet d'un ajout au
              moment où on l'ajoute, plus deux écrans plus loin. */}
          <Pressable
            style={styles.jauge}
            onPress={() => setBudgetModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Voir le détail du budget"
          >
            <View style={styles.jaugePiste}>
              {partBudget != null && <View style={[styles.jaugePart, { width: `${partBudget}%` }]} />}
            </View>
            <View style={styles.jaugeTexte}>
              <Text style={styles.billetMeta}>{estimatedTotal.toFixed(0)} $ engagés</Text>
              <Text style={styles.billetMeta}>
                {plan?.planned_budget != null ? `sur ${plan.planned_budget.toFixed(0)} $` : 'budget non défini'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* ── Deux onglets, en pleine largeur : plus rien à faire défiler ── */}
      <View style={styles.onglets}>
        <View style={[styles.ongletsRangee, isWide && wide]}>
          {TABS.map(t => (
            <Pressable
              key={t.key}
              style={[styles.onglet, activeTab === t.key && styles.ongletActif]}
              onPress={() => setActiveTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === t.key }}
            >
              <Text style={[styles.ongletTexte, activeTab === t.key && styles.ongletTexteActif]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.corps, isWide && wide]}>

        {/* ══ VOYAGE : la colonne du temps ══ */}
        {activeTab === 'voyage' && (
          journees.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck size={44} color={colors.borderStrong} strokeWidth={1.75} />}
              title="Rien de prévu pour l'instant"
              description={`Vos activités et vos réservations apparaîtront ici, jour par jour, sur les ${days.length} jours du séjour.`}
              actionLabel="Ajouter une activité"
              onAction={() => ouvrirAjoutEtape(plan?.start_date ?? null)}
            />
          ) : (
            <View>
              {journees.map((j, index) => {
                const libres = joursLibresAvant(index);
                return (
                  <View key={j.date}>
                    {libres > 0 && (
                      <Text style={styles.saut}>
                        {libres === 1 ? '1 jour libre' : `${libres} jours libres`}
                      </Text>
                    )}

                    <View style={styles.jourTitre}>
                      <Text style={styles.jourTitreTexte}>{formatDayLabel(j.date).full}</Text>
                      <View style={styles.jourTitreDroite}>
                        {/* Un total nul ne se dit pas : sur le voyage observé,
                            vingt-trois pastilles répétaient « 0 $ ». */}
                        {j.total > 0 && <Text style={styles.jourTotal}>{j.total.toFixed(0)} $</Text>}
                        <Pressable
                          onPress={() => ouvrirAjoutEtape(j.date)}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={`Ajouter une activité au ${formatDayLabel(j.date).full}`}
                        >
                          <Plus size={15} color={colors.lave} />
                        </Pressable>
                      </View>
                    </View>

                    {j.evenements.map((e, i) => (
                      <View key={e.genre === 'etape' ? e.etape.id : `${e.resa.id}-${e.role}`} style={styles.evenement}>
                        <Text style={styles.evenementHeure}>{e.heure ?? '—'}</Text>
                        <View style={styles.evenementColonne}>
                          {i < j.evenements.length - 1 && <View style={styles.evenementFil} />}

                          {e.genre === 'etape' ? (
                            <View style={styles.carteEtape}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.evenementTitre}>{e.etape.title}</Text>
                                {!!e.etape.notes && <Text style={styles.evenementNote}>{e.etape.notes}</Text>}
                              </View>
                              {Number(e.etape.estimated_cost) > 0 && (
                                <Text style={styles.evenementCout}>{Number(e.etape.estimated_cost).toFixed(0)} $</Text>
                              )}
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Supprimer cette étape"
                                onPress={() => deleteItem(e.etape.id)}
                                hitSlop={10}
                              >
                                <Trash2 size={13} color={colors.faint} />
                              </Pressable>
                            </View>
                          ) : (
                            /* Une réservation se lit mais ne se modifie pas ici :
                               elle vient du catalogue. La teinte fleuve et la
                               pastille disent cette différence sans l'écrire. */
                            <View style={styles.carteResa}>
                              <View style={[styles.resaIcone, { backgroundColor: categoryColors[e.resa.establishment?.type]?.soft ?? colors.laveSoft }]}>
                                <CategoryIcon
                                  type={e.resa.establishment?.type}
                                  size={15}
                                  color={categoryColors[e.resa.establishment?.type]?.accent ?? colors.lave}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.evenementTitre} numberOfLines={1}>
                                  {e.resa.establishment?.name}
                                </Text>
                                <Text style={styles.evenementNote}>{e.role}</Text>
                              </View>
                              <StatusBadge status={e.resa.status} />
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })}

              <Pressable style={styles.boutonAjout} onPress={() => ouvrirAjoutEtape(null)}>
                <Plus size={15} color={colors.lave} />
                <Text style={styles.boutonAjoutTexte}>Ajouter à une journée</Text>
              </Pressable>
            </View>
          )
        )}

        {/* ══ PRÉPARATIFS : tout ce qui n'a pas de date ══ */}
        {activeTab === 'preparatifs' && (
          <View>
            {/* — Lieux à visiter — */}
            <Text style={styles.blocTitre}>Lieux à visiter</Text>
            {wishlistItems.length === 0 ? (
              <Text style={styles.blocVide}>Aucun lieu enregistré pour l'instant.</Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {wishlistItems.map(item => (
                  <View key={item.id} style={styles.ligneLieu}>
                    <Pressable
                      hitSlop={11}
                      accessibilityRole="button"
                      accessibilityLabel={item.visited ? 'Marquer comme non visité' : 'Marquer comme visité'}
                      onPress={() => toggleVisited(item)}
                      style={[styles.cercle, item.visited && styles.cercleActif]}
                    >
                      {item.visited && <Check size={12} color={colors.white} />}
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.evenementTitre, item.visited && styles.texteFait]}>{item.title}</Text>
                      {Number(item.estimated_cost) > 0 && (
                        <Text style={styles.evenementNote}>{Number(item.estimated_cost).toFixed(0)} $</Text>
                      )}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Retirer de la liste d'envies"
                      onPress={() => deleteItem(item.id)}
                      hitSlop={10}
                    >
                      <Trash2 size={13} color={colors.faint} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <Pressable
              style={styles.boutonAjout}
              onPress={() => { setItemTitle(''); setItemCost(''); setAddModal('wishlist'); }}
            >
              <Plus size={15} color={colors.lave} />
              <Text style={styles.boutonAjoutTexte}>Ajouter un lieu</Text>
            </Pressable>

            {/* — Valise — */}
            <Text style={[styles.blocTitre, { marginTop: spacing.lg }]}>Valise</Text>
            {PACKING_CATEGORIES.map(cat => {
              const catItems = packingItems.filter(p => p.category === cat.key);
              if (catItems.length === 0) return null;
              const Icone = cat.Icone;
              return (
                <View key={cat.key} style={{ marginBottom: spacing.v12 }}>
                  <View style={styles.categorieRangee}>
                    <Icone size={13} color={colors.faint} strokeWidth={1.75} />
                    <Text style={styles.categorieTexte}>{cat.label}</Text>
                  </View>
                  <View style={{ gap: spacing.sm }}>
                    {catItems.map(item => (
                      <View key={item.id} style={styles.ligneValise}>
                        <Pressable
                          hitSlop={13}
                          accessibilityRole="button"
                          accessibilityLabel={item.is_checked ? `Décocher ${item.label}` : `Cocher ${item.label}`}
                          onPress={() => togglePacking(item)}
                          style={[styles.carre, item.is_checked && styles.carreActif]}
                        >
                          {item.is_checked && <Check size={11} color={colors.white} />}
                        </Pressable>
                        <Text style={[styles.valiseTexte, item.is_checked && styles.texteFait]}>{item.label}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Supprimer de la valise"
                          onPress={() => deletePacking(item.id)}
                          hitSlop={10}
                        >
                          <Trash2 size={12} color={colors.faint} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
            {packingItems.length === 0 && (
              <Text style={styles.blocVide}>Votre valise est vide.</Text>
            )}
            <Pressable
              style={styles.boutonAjout}
              onPress={() => { setPackingLabel(''); setPackingCategory('documents'); setPackingModal(true); }}
            >
              <Plus size={15} color={colors.lave} />
              <Text style={styles.boutonAjoutTexte}>Ajouter un élément</Text>
            </Pressable>

            {/* — Notes — */}
            <Text style={[styles.blocTitre, { marginTop: spacing.lg }]}>Notes</Text>
            <TextInput
              style={styles.champNotes}
              value={notesDraft}
              onChangeText={setNotesDraft}
              placeholder="Réserver le taxi à l'avance, prévenir l'hôtel d'une arrivée tardive, numéro d'urgence..."
              placeholderTextColor={colors.faint}
              multiline
              textAlignVertical="top"
            />
            <Pressable style={styles.boutonPlein} onPress={handleSaveNotes} disabled={savingNotes}>
              {savingNotes
                ? <ActivityIndicator color={colors.cream} />
                : <Text style={styles.boutonPleinTexte}>Enregistrer les notes</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ── Détail du budget ── */}
      <Modal visible={budgetModal} transparent animationType="slide" onRequestClose={() => setBudgetModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Budget</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setBudgetModal(false)} hitSlop={10}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView>
              <View style={styles.budgetGrille}>
                <View style={styles.budgetBoite}>
                  <Text style={styles.budgetLabel}>Estimé</Text>
                  <Text style={styles.budgetValeur}>{estimatedTotal.toFixed(0)} $</Text>
                </View>
                <View style={styles.budgetBoite}>
                  <Text style={styles.budgetLabel}>Dépensé réel</Text>
                  <Text style={[styles.budgetValeur, { color: colors.success }]}>{actualTotal.toFixed(0)} $</Text>
                </View>
                <View style={styles.budgetBoite}>
                  <Text style={styles.budgetLabel}>Reste</Text>
                  <Text style={[styles.budgetValeur, remaining != null && remaining < 0 && { color: colors.danger }]}>
                    {remaining != null ? `${remaining.toFixed(0)} $` : '—'}
                  </Text>
                </View>
              </View>

              {journees.filter(j => j.total > 0).length === 0 ? (
                <Text style={styles.blocVide}>Aucune dépense saisie pour l'instant.</Text>
              ) : (
                journees.filter(j => j.total > 0).map(j => (
                  <View key={j.date} style={styles.budgetLigne}>
                    <Text style={styles.budgetLigneLabel}>{formatDayLabel(j.date).full}</Text>
                    <Text style={styles.budgetLigneValeur}>{j.total.toFixed(0)} $</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Création / édition du voyage ── */}
      <Modal visible={showTripForm} transparent animationType="slide" onRequestClose={() => setShowTripForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{editingTrip ? 'Modifier le voyage' : 'Nouveau voyage'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setShowTripForm(false)} hitSlop={10}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Nom du voyage</Text>
              <TextInput style={styles.fieldInput} value={title} onChangeText={setTitle} placeholder="Mon voyage à Kinshasa" placeholderTextColor={colors.faint} />

              <Text style={styles.fieldLabel}>Destination</Text>
              <TextInput style={styles.fieldInput} value={destination} onChangeText={setDestination} placeholder="Kinshasa, RDC" placeholderTextColor={colors.faint} />

              {/* Les dates se saisissaient à la main, au format JJ/MM/AAAA, avec
                  un simple contrôle après coup. C'est ainsi qu'un voyage a fini
                  par partir du 1ᵉʳ février pour une réservation de septembre :
                  rien n'empêchait la faute de frappe. Le sélecteur la rend
                  impossible, et le retour ne peut pas précéder le départ. */}
              <DateField
                label="Départ"
                value={startDate}
                onChange={setStartDate}
                sheetTitle="Date de départ"
              />
              <DateField
                label="Retour"
                value={endDate}
                onChange={setEndDate}
                sheetTitle="Date de retour"
                minDate={startDate || undefined}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Voyageurs</Text>
                  <TextInput style={styles.fieldInput} value={travelerCount} onChangeText={setTravelerCount} placeholder="1" keyboardType="number-pad" placeholderTextColor={colors.faint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Budget prévu ($)</Text>
                  <TextInput style={styles.fieldInput} value={plannedBudget} onChangeText={setPlannedBudget} placeholder="200" keyboardType="decimal-pad" placeholderTextColor={colors.faint} />
                </View>
              </View>

              {formError && <Text style={styles.errorText}>{formError}</Text>}

              <Pressable style={[styles.boutonPlein, saving && { opacity: 0.7 }]} onPress={handleSaveTrip} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={colors.cream} />
                  : <Text style={styles.boutonPleinTexte}>{editingTrip ? 'Enregistrer' : 'Créer le voyage'}</Text>}
              </Pressable>

              {/* La suppression rejoint le formulaire d'édition : au fil du
                  contenu, une action destructrice n'attend qu'un faux geste. */}
              {editingTrip && (
                <Pressable onPress={confirmDeleteTrip} style={styles.lienDanger}>
                  <Trash2 size={13} color={colors.danger} />
                  <Text style={styles.lienDangerTexte}>Supprimer ce voyage</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Ajout activité / lieu ── */}
      <Modal visible={!!addModal} transparent animationType="slide" onRequestClose={() => setAddModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {addModal === 'itinerary' ? 'Ajouter une activité' : 'Ajouter un lieu à visiter'}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setAddModal(null)} hitSlop={10}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Le choix du jour vit ici, au moment où on en a besoin, plutôt
                  qu'en permanence en haut de l'écran où il occupait 1 846 px
                  pour n'en montrer que 464. */}
              {addModal === 'itinerary' && (
                <>
                  <Text style={styles.fieldLabel}>Jour</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.v12 }}
                  >
                    {days.map(d => (
                      <Chip
                        key={d}
                        label={formatDayLabel(d).day}
                        active={selectedDay === d}
                        onPress={() => setSelectedDay(d)}
                      />
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.fieldLabel}>Nom</Text>
              <TextInput style={styles.fieldInput} value={itemTitle} onChangeText={setItemTitle} placeholder="Ex : Visite du marché central" placeholderTextColor={colors.faint} />

              {addModal === 'itinerary' && (
                <>
                  <Text style={styles.fieldLabel}>Heure</Text>
                  <TextInput style={styles.fieldInput} value={itemTime} onChangeText={setItemTime} placeholder="09:00" placeholderTextColor={colors.faint} />
                </>
              )}

              <Text style={styles.fieldLabel}>Coût estimé ($)</Text>
              <TextInput style={styles.fieldInput} value={itemCost} onChangeText={setItemCost} placeholder="0" keyboardType="decimal-pad" placeholderTextColor={colors.faint} />

              {addModal === 'itinerary' && (
                <>
                  <Text style={styles.fieldLabel}>Notes (optionnel)</Text>
                  <TextInput style={[styles.fieldInput, { height: 60, textAlignVertical: 'top' }]} value={itemNotes} onChangeText={setItemNotes} placeholder="Réserver à l'avance..." placeholderTextColor={colors.faint} multiline />
                </>
              )}

              <Pressable style={[styles.boutonPlein, !itemTitle.trim() && { opacity: 0.5 }]} onPress={handleAddItem} disabled={!itemTitle.trim()}>
                <Text style={styles.boutonPleinTexte}>Ajouter</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Ajout élément de valise ── */}
      <Modal visible={packingModal} transparent animationType="slide" onRequestClose={() => setPackingModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Ajouter un élément</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setPackingModal(false)} hitSlop={10}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Catégorie</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.v12 }}>
              {PACKING_CATEGORIES.map(c => (
                <Chip
                  key={c.key}
                  label={c.label}
                  active={packingCategory === c.key}
                  onPress={() => setPackingCategory(c.key)}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Élément</Text>
            <TextInput style={styles.fieldInput} value={packingLabel} onChangeText={setPackingLabel} placeholder="Ex : Passeport" placeholderTextColor={colors.faint} />

            <Pressable style={[styles.boutonPlein, !packingLabel.trim() && { opacity: 0.5 }]} onPress={handleAddPacking} disabled={!packingLabel.trim()}>
              <Text style={styles.boutonPleinTexte}>Ajouter</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Cream atténué — texte secondaire posé sur le bandeau de marque. Même valeur
// que dans ScreenHeader, où elle a la même fonction.
const CREAM_ATTENUE = 'rgba(250,248,244,0.72)';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },

  entete: { paddingBottom: spacing.v12, paddingHorizontal: spacing.gutter, backgroundColor: colors.cream },
  enteteTitre: { ...typography.titleSm, color: colors.ink },

  // ── Billet ──
  billet: { backgroundColor: colors.lave, paddingHorizontal: spacing.gutter, paddingBottom: spacing.v12 },
  billetHaut: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12 },
  billetTitre: { ...typography.displayMd, color: colors.cream },
  billetMetaRangee: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.v12, marginTop: spacing.xs },
  billetMetaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  billetMeta: { ...typography.captionSm, color: CREAM_ATTENUE },

  jauge: { marginTop: spacing.v12 },
  jaugePiste: { height: 5, backgroundColor: 'rgba(250,248,244,0.22)', borderRadius: radii.pill, overflow: 'hidden' },
  jaugePart: { height: '100%', backgroundColor: colors.amber },
  jaugeTexte: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },

  // ── Onglets ──
  onglets: { backgroundColor: colors.cream, borderBottomWidth: 1, borderBottomColor: colors.border },
  ongletsRangee: { flexDirection: 'row' },
  onglet: { flex: 1, alignItems: 'center', paddingVertical: spacing.v12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  ongletActif: { borderBottomColor: colors.lave },
  ongletTexte: { ...typography.labelMd, color: colors.faint },
  ongletTexteActif: { color: colors.lave },

  corps: { padding: spacing.gutter, paddingBottom: 100 },

  // ── Journée ──
  saut: {
    ...typography.captionSm, color: colors.faint, fontStyle: 'italic',
    textAlign: 'center', paddingVertical: spacing.v12,
  },
  jourTitre: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: spacing.sm, marginBottom: spacing.v12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  jourTitreTexte: {
    ...typography.captionMd, color: colors.ink,
    textTransform: 'uppercase', letterSpacing: 0.6, flex: 1,
  },
  jourTitreDroite: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12 },
  jourTotal: { ...typography.captionMd, color: colors.faint },

  evenement: { flexDirection: 'row', gap: spacing.v12, paddingBottom: spacing.v12 },
  evenementHeure: {
    ...typography.captionSm, color: colors.faint, fontWeight: '700',
    width: 38, textAlign: 'right', paddingTop: spacing.v12,
  },
  evenementColonne: { flex: 1, position: 'relative' },
  // Le fil vertical relie les événements d'une même journée : c'est lui qui
  // fait lire la colonne comme un déroulé plutôt que comme une pile de cartes.
  evenementFil: {
    position: 'absolute', left: -spacing.sm, top: spacing.lg, bottom: -spacing.v12,
    width: 1, backgroundColor: colors.border,
  },
  carteEtape: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.v12,
  },
  carteResa: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    backgroundColor: colors.fleuveSoft, borderWidth: 1, borderColor: colors.fleuve,
    borderRadius: radii.md, padding: spacing.v12,
  },
  resaIcone: { width: 30, height: 30, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  evenementTitre: { ...typography.labelMd, color: colors.ink },
  evenementNote: { ...typography.captionSm, color: colors.faint, marginTop: spacing.v2 },
  evenementCout: { ...typography.captionMd, color: colors.lave },

  // ── Préparatifs ──
  blocTitre: { ...typography.displaySm, color: colors.ink, marginBottom: spacing.v12 },
  blocVide: { ...typography.bodySm, color: colors.faint, paddingVertical: spacing.sm },
  categorieRangee: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  categorieTexte: { ...typography.captionMd, color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4 },

  ligneLieu: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.v12,
  },
  ligneValise: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12 },
  valiseTexte: { ...typography.bodySm, color: colors.ink, flex: 1 },
  texteFait: { color: colors.faint, textDecorationLine: 'line-through' },

  cercle: {
    width: 22, height: 22, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  cercleActif: { backgroundColor: colors.success, borderColor: colors.success },
  carre: {
    width: 19, height: 19, borderRadius: radii.v4, borderWidth: 1.5, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  carreActif: { backgroundColor: colors.success, borderColor: colors.success },

  champNotes: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.v12, minHeight: 120,
    ...typography.bodySm, color: colors.ink,
  },

  // ── Boutons ──
  boutonAjout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.laveSoft, borderRadius: radii.md,
    paddingVertical: spacing.v12, marginTop: spacing.v12,
  },
  boutonAjoutTexte: { ...typography.labelMd, color: colors.lave },
  boutonPlein: {
    backgroundColor: colors.lave, borderRadius: radii.md,
    paddingVertical: spacing.v12, alignItems: 'center', marginTop: spacing.v12,
  },
  boutonPleinTexte: { ...typography.button, color: colors.cream },
  lienDanger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, marginTop: spacing.xs,
  },
  lienDangerTexte: { ...typography.bodySm, color: colors.danger },

  // ── Budget ──
  budgetGrille: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  budgetBoite: {
    flex: 1, backgroundColor: colors.surfaceSunken, borderRadius: radii.md,
    padding: spacing.v12, alignItems: 'center',
  },
  budgetLabel: { ...typography.captionSm, color: colors.faint },
  budgetValeur: { ...typography.titleMd, color: colors.ink, marginTop: spacing.v2 },
  budgetLigne: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  budgetLigneLabel: { ...typography.bodySm, color: colors.muted },
  budgetLigneValeur: { ...typography.captionMd, color: colors.ink },

  // ── Modales ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,10,3,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.cream, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg,
    padding: spacing.gutter, maxHeight: '88%',
  },
  modalHandle: {
    width: 36, height: 4, backgroundColor: colors.borderStrong, borderRadius: radii.v4,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  modalHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.v12,
  },
  modalTitle: { ...typography.displaySm, color: colors.ink },

  fieldLabel: { ...typography.captionMd, color: colors.muted, marginBottom: spacing.xs, marginTop: spacing.sm },
  fieldInput: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: spacing.v12, paddingVertical: spacing.v12,
    ...typography.bodySm, color: colors.ink,
  },
  row: { flexDirection: 'row', gap: spacing.v12 },
  errorText: { ...typography.captionSm, color: colors.danger, marginTop: spacing.sm },
});
