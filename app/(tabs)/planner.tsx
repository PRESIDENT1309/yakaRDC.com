import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, TextInput, ActivityIndicator, Modal, } from 'react-native';
import { Alert } from '../../lib/alert';
import {
  CalendarRange, Plus, Trash2, X,
  Check, Edit3,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import { useConfirm } from '../../lib/confirm-context';
import CategoryIcon from '../../components/CategoryIcon';
import StatusBadge from '../../components/StatusBadge';
import Chip from '../../components/Chip';
import type {
  TripPlan, TripPlanItem, TripPackingItem, Establishment,
  Booking, PackingCategory,
} from '../../lib/types';

type Tab = 'itineraire' | 'budget' | 'reservations' | 'lieux' | 'prepa' | 'notes';

const TABS: { key: Tab; label: string }[] = [
  { key: 'itineraire', label: 'Itinéraire' },
  { key: 'budget', label: 'Budget' },
  { key: 'reservations', label: 'Résa.' },
  { key: 'lieux', label: 'Lieux' },
  { key: 'prepa', label: 'Prépa' },
  { key: 'notes', label: 'Notes' },
];

const PACKING_CATEGORIES: { key: PackingCategory; label: string }[] = [
  { key: 'documents', label: '📄 Documents' },
  { key: 'clothing', label: '👕 Vêtements' },
  { key: 'personal', label: '🧴 Objets personnels' },
  { key: 'custom', label: '✨ Autres' },
];

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

function toIso(v: string): string | null {
  const [d, m, y] = v.split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function toFr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function PlannerScreen() {
  const { session } = useAuth();
  const { isWide, contentWidth } = useResponsive();
  const confirm = useConfirm();
  // Contenu plafonné et centré dans contentMax dès la tablette — pas de
  // grille : les onglets (chronologie, tableau de bord, checklist) ne se
  // découpent pas naturellement en cartes, contrairement à Réservations.
  const wide = { maxWidth: contentWidth, width: '100%' as const, alignSelf: 'center' as const };
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [items, setItems] = useState<TripPlanItem[]>([]);
  const [packingItems, setPackingItems] = useState<TripPackingItem[]>([]);
  const [bookings, setBookings] = useState<(Booking & { establishment: Establishment })[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('itineraire');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Création / édition du voyage
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

  // Ajout d'un élément (itinéraire ou lieu)
  const [addModal, setAddModal] = useState<'itinerary' | 'wishlist' | null>(null);
  const [itemTitle, setItemTitle] = useState('');
  const [itemTime, setItemTime] = useState('');
  const [itemCost, setItemCost] = useState('');
  const [itemNotes, setItemNotes] = useState('');

  // Ajout d'un élément de préparation
  const [packingModal, setPackingModal] = useState(false);
  const [packingLabel, setPackingLabel] = useState('');
  const [packingCategory, setPackingCategory] = useState<PackingCategory>('documents');

  // Notes
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);

    const { data: plans } = await supabase
      .from('trip_plans').select('*')
      .eq('traveler_id', session.user.id)
      .order('created_at', { ascending: false }).limit(1);

    const currentPlan = (plans?.[0] as TripPlan) ?? null;
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
    }

    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openTripForm(editing: boolean) {
    if (editing && plan) {
      setTitle(plan.title);
      setDestination(plan.destination ?? '');
      setStartDate(toFr(plan.start_date));
      setEndDate(toFr(plan.end_date));
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
    if (!title.trim() || !startDate.trim() || !endDate.trim()) {
      setFormError('Titre et dates sont obligatoires.');
      return;
    }
    const isoStart = toIso(startDate);
    const isoEnd = toIso(endDate);
    if (!isoStart || !isoEnd) { setFormError('Format de date invalide (JJ/MM/AAAA).'); return; }
    if (isoEnd < isoStart) { setFormError('La date de fin doit être après le départ.'); return; }

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
    await supabase.from('trip_plans').delete().eq('id', plan.id);
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
    await supabase.from('trip_plan_items').update({ visited: !item.visited }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, visited: !i.visited } : i));
  }

  async function deleteItem(id: string) {
    await supabase.from('trip_plan_items').delete().eq('id', id);
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
    await supabase.from('trip_packing_items').update({ is_checked: !item.is_checked }).eq('id', item.id);
    setPackingItems(prev => prev.map(p => p.id === item.id ? { ...p, is_checked: !p.is_checked } : p));
  }

  async function deletePacking(id: string) {
    await supabase.from('trip_packing_items').delete().eq('id', id);
    setPackingItems(prev => prev.filter(p => p.id !== id));
  }

  async function handleSaveNotes() {
    if (!plan) return;
    setSavingNotes(true);
    await supabase.from('trip_plans').update({ notes: notesDraft.trim() || null }).eq('id', plan.id);
    setSavingNotes(false);
  }

  // ── Calculs budget ──
  const itineraryItems = items.filter(i => i.item_type === 'itinerary');
  const wishlistItems = items.filter(i => i.item_type === 'wishlist');
  const estimatedTotal = itineraryItems.reduce((s, i) => s + Number(i.estimated_cost), 0);
  const actualTotal = itineraryItems.reduce((s, i) => s + Number(i.actual_cost ?? i.estimated_cost), 0);
  const remaining = plan?.planned_budget != null ? plan.planned_budget - actualTotal : null;

  // ── État : aucun voyage ──
  if (!loading && !plan && !showTripForm) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}><Text style={styles.headerTitle}>Mon planning</Text></View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><CalendarRange size={36} color={colors.lave} /></View>
          <Text style={styles.emptyTitle}>Planifiez votre séjour</Text>
          <Text style={styles.emptyText}>
            Itinéraire heure par heure, budget, réservations, lieux à visiter et checklist — tout au même endroit.
          </Text>
          <Pressable style={styles.createBtn} onPress={() => openTripForm(false)}>
            <Plus size={16} color="#FAF8F4" />
            <Text style={styles.createBtnText}>Créer mon voyage</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.lave} /></View>;
  }

  const days = plan ? dateRange(plan.start_date, plan.end_date) : [];
  const dayItems = itineraryItems.filter(i => i.day_date === selectedDay);
  const dayTotal = dayItems.reduce((s, i) => s + Number(i.estimated_cost), 0);

  return (
    <View style={styles.screen}>
      {/* ── En-tête fixe ── */}
      <View style={styles.header}>
        <View style={[styles.headerInner, isWide && wide]}>
          <View style={styles.dashboardRow}>
            <Text style={styles.dashItem}>📍 {plan?.destination ?? '—'}</Text>
            <Text style={styles.dashItem}>📅 {days.length}j</Text>
            <Text style={[styles.dashItem, { color: colors.amber }]}>💰 {estimatedTotal.toFixed(0)}$</Text>
            <Text style={styles.dashItem}>🎯 {itineraryItems.length}</Text>
            <Text style={styles.dashItem}>🏨 {bookings.length}</Text>
          </View>

          <Pressable style={styles.tripCard} onPress={() => openTripForm(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripTitle}>{plan?.title}</Text>
              <Text style={styles.tripMeta}>
                {plan && `${formatDayLabel(plan.start_date).day} → ${formatDayLabel(plan.end_date).day} · ${plan.traveler_count} voyageur${plan.traveler_count > 1 ? 's' : ''}`}
              </Text>
            </View>
            <Edit3 size={14} color={colors.lave} />
          </Pressable>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingLeft: 18 }}>
            {TABS.map(t => (
              <Chip
                key={t.key}
                label={t.label}
                active={activeTab === t.key}
                onPress={() => setActiveTab(t.key)}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      {/* ── Contenu défilant selon l'onglet ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[{ paddingBottom: 100 }, isWide && wide]}>

        {/* ITINÉRAIRE */}
        {activeTab === 'itineraire' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
              {days.map(d => {
                const { weekday, day } = formatDayLabel(d);
                const active = d === selectedDay;
                const total = itineraryItems.filter(i => i.day_date === d).reduce((s, i) => s + Number(i.estimated_cost), 0);
                return (
                  <Pressable key={d} style={[styles.dayChip, active && styles.dayChipActive]} onPress={() => setSelectedDay(d)}>
                    <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>{weekday}</Text>
                    <Text style={[styles.dayNumber, active && styles.dayTextActive]}>{day}</Text>
                    <Text style={[styles.dayBudget, active && styles.dayTextActive]}>{total.toFixed(0)}$</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {selectedDay && formatDayLabel(selectedDay).full}
                </Text>
                <Text style={styles.dayTotalText}>{dayTotal.toFixed(2)} $</Text>
              </View>

              {dayItems.length === 0 ? (
                <Text style={styles.emptyDayText}>Aucune activité prévue pour ce jour.</Text>
              ) : (
                <View style={{ paddingHorizontal: 18 }}>
                  {dayItems.map((item, idx) => (
                    <View key={item.id} style={styles.timelineRow}>
                      <View style={styles.timelineTrack}>
                        <View style={styles.timelineDot} />
                        {idx < dayItems.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        {item.time && <Text style={styles.itemTime}>{item.time}</Text>}
                        <View style={styles.itemCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
                          </View>
                          <Text style={styles.itemCost}>{Number(item.estimated_cost).toFixed(0)} $</Text>
                          <Pressable onPress={() => deleteItem(item.id)} hitSlop={8}>
                            <Trash2 size={13} color={colors.faint} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                style={styles.addItemBtn}
                onPress={() => { setItemTitle(''); setItemTime(''); setItemCost(''); setItemNotes(''); setAddModal('itinerary'); }}
              >
                <Plus size={15} color={colors.lave} />
                <Text style={styles.addItemBtnText}>Ajouter une activité</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* BUDGET */}
        {activeTab === 'budget' && (
          <View style={styles.section}>
            <View style={styles.budgetHero}>
              <Text style={styles.budgetHeroLabel}>Reste du budget</Text>
              <Text style={styles.budgetHeroValue}>
                {remaining != null ? `${remaining.toFixed(0)} $` : '—'}
              </Text>
              {plan?.planned_budget != null && (
                <Text style={styles.budgetHeroSub}>sur {plan.planned_budget.toFixed(0)} $ prévu</Text>
              )}
            </View>

            <View style={styles.budgetGrid}>
              <View style={styles.budgetBox}>
                <Text style={styles.budgetBoxLabel}>Estimé</Text>
                <Text style={styles.budgetBoxValue}>{estimatedTotal.toFixed(0)} $</Text>
              </View>
              <View style={styles.budgetBox}>
                <Text style={styles.budgetBoxLabel}>Dépensé réel</Text>
                <Text style={[styles.budgetBoxValue, { color: colors.success }]}>{actualTotal.toFixed(0)} $</Text>
              </View>
            </View>

            {plan?.planned_budget != null && plan.planned_budget > 0 && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, (actualTotal / plan.planned_budget) * 100)}%` }]} />
              </View>
            )}

            <Text style={styles.sectionTitle2}>Par jour</Text>
            {days.map(d => {
              const total = itineraryItems.filter(i => i.day_date === d).reduce((s, i) => s + Number(i.estimated_cost), 0);
              return (
                <View key={d} style={styles.budgetDayRow}>
                  <Text style={styles.budgetDayLabel}>{formatDayLabel(d).full}</Text>
                  <Text style={styles.budgetDayValue}>{total.toFixed(0)} $</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* RÉSERVATIONS */}
        {activeTab === 'reservations' && (
          <View style={styles.section}>
            {bookings.length === 0 ? (
              <Text style={styles.emptyDayText}>
                Aucune réservation liée à ce voyage pour l'instant. Réservez un établissement depuis l'app — il apparaîtra ici automatiquement si sa date tombe dans votre période de voyage.
              </Text>
            ) : (
              <View style={{ gap: 8, paddingHorizontal: 18 }}>
                {bookings.map(b => (
                  <View key={b.id} style={styles.reservationCard}>
                    <View style={[styles.reservationIcon, { backgroundColor: categoryColors[b.establishment?.type]?.soft ?? colors.laveSoft }]}>
                      <CategoryIcon type={b.establishment?.type} size={16} color={categoryColors[b.establishment?.type]?.accent ?? colors.lave} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reservationName}>{b.establishment?.name}</Text>
                      <Text style={styles.reservationDate}>
                        {b.check_in ? `${b.check_in} → ${b.check_out}` : b.visit_date}
                      </Text>
                    </View>
                    <StatusBadge status={b.status} />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* LIEUX À VISITER */}
        {activeTab === 'lieux' && (
          <View style={styles.section}>
            {wishlistItems.length === 0 ? (
              <Text style={styles.emptyDayText}>Aucun lieu enregistré. Ajoutez les endroits que vous voulez visiter.</Text>
            ) : (
              <View style={{ gap: 8, paddingHorizontal: 18 }}>
                {wishlistItems.map(item => (
                  <View key={item.id} style={styles.wishlistCard}>
                    <Pressable onPress={() => toggleVisited(item)} style={[styles.checkCircle, item.visited && styles.checkCircleActive]}>
                      {item.visited && <Check size={12} color={colors.white} />}
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, item.visited && styles.itemTitleDone]}>{item.title}</Text>
                      <Text style={styles.itemNotes}>{Number(item.estimated_cost).toFixed(0)} $</Text>
                    </View>
                    <View style={[styles.wishlistBadge, item.visited ? { backgroundColor: colors.successSoft } : { backgroundColor: colors.warningSoft }]}>
                      <Text style={[styles.wishlistBadgeText, item.visited ? { color: colors.success } : { color: colors.warning }]}>
                        {item.visited ? 'Visité' : 'À visiter'}
                      </Text>
                    </View>
                    <Pressable onPress={() => deleteItem(item.id)} hitSlop={8}>
                      <Trash2 size={13} color={colors.faint} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <Pressable
              style={styles.addItemBtn}
              onPress={() => { setItemTitle(''); setItemCost(''); setAddModal('wishlist'); }}
            >
              <Plus size={15} color={colors.lave} />
              <Text style={styles.addItemBtnText}>Ajouter un lieu</Text>
            </Pressable>
          </View>
        )}

        {/* PRÉPARATION */}
        {activeTab === 'prepa' && (
          <View style={styles.section}>
            {PACKING_CATEGORIES.map(cat => {
              const catItems = packingItems.filter(p => p.category === cat.key);
              return (
                <View key={cat.key} style={{ marginBottom: 16 }}>
                  <Text style={styles.sectionTitle2}>{cat.label}</Text>
                  {catItems.length === 0 ? (
                    <Text style={styles.emptyDayText}>Rien pour l'instant.</Text>
                  ) : (
                    <View style={{ paddingHorizontal: 18, gap: 6 }}>
                      {catItems.map(item => (
                        <View key={item.id} style={styles.packingRow}>
                          <Pressable onPress={() => togglePacking(item)} style={[styles.checkSquare, item.is_checked && styles.checkSquareActive]}>
                            {item.is_checked && <Check size={11} color={colors.white} />}
                          </Pressable>
                          <Text style={[styles.packingLabel, item.is_checked && styles.packingLabelDone]}>{item.label}</Text>
                          <Pressable onPress={() => deletePacking(item.id)} hitSlop={8}>
                            <Trash2 size={12} color={colors.faint} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            <Pressable
              style={styles.addItemBtn}
              onPress={() => { setPackingLabel(''); setPackingCategory('documents'); setPackingModal(true); }}
            >
              <Plus size={15} color={colors.lave} />
              <Text style={styles.addItemBtnText}>Ajouter un élément</Text>
            </Pressable>
          </View>
        )}

        {/* NOTES */}
        {activeTab === 'notes' && (
          <View style={styles.section}>
            <TextInput
              style={styles.notesInput}
              value={notesDraft}
              onChangeText={setNotesDraft}
              placeholder="Réserver le taxi à l'avance, prévenir l'hôtel d'une arrivée tardive, numéro d'urgence..."
              placeholderTextColor={colors.faint}
              multiline
              textAlignVertical="top"
            />
            <Pressable style={[styles.createBtn, { marginHorizontal: 18 }]} onPress={handleSaveNotes} disabled={savingNotes}>
              {savingNotes ? <ActivityIndicator color="#FAF8F4" /> : <Text style={styles.createBtnText}>Enregistrer les notes</Text>}
            </Pressable>
          </View>
        )}

        <Pressable onPress={confirmDeleteTrip} style={{ alignSelf: 'center', marginTop: 20 }}>
          <Text style={{ fontSize: 11.5, color: colors.faint }}>Supprimer ce voyage</Text>
        </Pressable>
      </ScrollView>

      {/* ── Modal création/édition du voyage ── */}
      <Modal visible={showTripForm} transparent animationType="slide" onRequestClose={() => setShowTripForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{editingTrip ? 'Modifier le voyage' : 'Nouveau voyage'}</Text>
              <Pressable onPress={() => setShowTripForm(false)} hitSlop={8}><X size={18} color={colors.muted} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Nom du voyage</Text>
              <TextInput style={styles.fieldInput} value={title} onChangeText={setTitle} placeholder="Mon voyage à Kinshasa" placeholderTextColor={colors.faint} />

              <Text style={styles.fieldLabel}>Destination</Text>
              <TextInput style={styles.fieldInput} value={destination} onChangeText={setDestination} placeholder="Kinshasa, RDC" placeholderTextColor={colors.faint} />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Départ</Text>
                  <TextInput style={styles.fieldInput} value={startDate} onChangeText={setStartDate} placeholder="20/07/2026" placeholderTextColor={colors.faint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Retour</Text>
                  <TextInput style={styles.fieldInput} value={endDate} onChangeText={setEndDate} placeholder="25/07/2026" placeholderTextColor={colors.faint} />
                </View>
              </View>

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

              <Pressable style={[styles.createBtn, saving && { opacity: 0.7 }]} onPress={handleSaveTrip} disabled={saving}>
                {saving ? <ActivityIndicator color="#FAF8F4" /> : <Text style={styles.createBtnText}>{editingTrip ? 'Enregistrer' : 'Créer le voyage'}</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal ajout activité / lieu ── */}
      <Modal visible={!!addModal} transparent animationType="slide" onRequestClose={() => setAddModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {addModal === 'itinerary' ? 'Ajouter une activité' : 'Ajouter un lieu à visiter'}
            </Text>

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

            <Pressable style={[styles.createBtn, !itemTitle.trim() && { opacity: 0.5 }]} onPress={handleAddItem} disabled={!itemTitle.trim()}>
              <Text style={styles.createBtnText}>Ajouter</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Modal ajout élément de préparation ── */}
      <Modal visible={packingModal} transparent animationType="slide" onRequestClose={() => setPackingModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Ajouter un élément</Text>

            <Text style={styles.fieldLabel}>Catégorie</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
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

            <Pressable style={[styles.createBtn, !packingLabel.trim() && { opacity: 0.5 }]} onPress={handleAddPacking} disabled={!packingLabel.trim()}>
              <Text style={styles.createBtnText}>Ajouter</Text>
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
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12,
    backgroundColor: '#FAF8F4',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerInner: { gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '500', color: colors.ink, paddingHorizontal: 18 },
  dashboardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 18, backgroundColor: colors.lave, paddingVertical: 8, marginTop: Platform.OS === 'ios' ? -56 : -20, marginBottom: 4,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
  },
  dashItem: { fontSize: 10.5, color: '#FAF8F4', fontWeight: '500' },
  tripCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 18, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12,
  },
  tripTitle: { fontSize: 14, fontWeight: '500', color: colors.ink },
  tripMeta: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.laveSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '500', color: colors.ink },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.lave, borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  createBtnText: { fontSize: 14, fontWeight: '500', color: '#FAF8F4' },
  section: { marginTop: 18, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 10 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.ink, textTransform: 'capitalize' },
  sectionTitle2: { fontSize: 12, fontWeight: '500', color: colors.muted, paddingHorizontal: 18, marginBottom: 8, marginTop: 4 },
  dayTotalText: { fontSize: 13, fontWeight: '500', color: colors.lave },
  dayChip: { alignItems: 'center', gap: 2, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, minWidth: 58 },
  dayChipActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  dayWeekday: { fontSize: 10, color: colors.faint, textTransform: 'capitalize' },
  dayNumber: { fontSize: 12, fontWeight: '500', color: colors.ink },
  dayBudget: { fontSize: 9, color: colors.faint },
  dayTextActive: { color: '#FAF8F4' },
  emptyDayText: { fontSize: 12, color: colors.muted, paddingHorizontal: 18, marginBottom: 10, lineHeight: 18 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineTrack: { alignItems: 'center', width: 14 },
  timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.lave, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2, marginBottom: -2 },
  itemTime: { fontSize: 10.5, fontWeight: '600', color: colors.lave, marginBottom: 4 },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 11, marginBottom: 14 },
  itemTitle: { fontSize: 12.5, fontWeight: '500', color: colors.ink },
  itemTitleDone: { textDecorationLine: 'line-through', color: colors.faint },
  itemNotes: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  itemCost: { fontSize: 11.5, fontWeight: '500', color: colors.ink },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginHorizontal: 18, marginTop: 6, backgroundColor: colors.laveSoft, borderRadius: 10, paddingVertical: 11 },
  addItemBtnText: { fontSize: 12.5, color: colors.lave, fontWeight: '500' },
  budgetHero: { alignItems: 'center', backgroundColor: colors.lave, marginHorizontal: 18, borderRadius: 16, padding: 20, marginBottom: 14 },
  budgetHeroLabel: { fontSize: 11, color: colors.cream + 'B3' },
  budgetHeroValue: { fontSize: 30, fontWeight: '600', color: colors.amber, marginTop: 4 },
  budgetHeroSub: { fontSize: 10.5, color: colors.cream + '99', marginTop: 2 },
  budgetGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginBottom: 14 },
  budgetBox: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  budgetBoxLabel: { fontSize: 10.5, color: colors.muted },
  budgetBoxValue: { fontSize: 18, fontWeight: '500', color: colors.ink, marginTop: 3 },
  progressTrack: { height: 8, backgroundColor: '#F0EEE4', borderRadius: 4, marginHorizontal: 18, marginBottom: 18, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  budgetDayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EEE4' },
  budgetDayLabel: { fontSize: 12, color: colors.ink, textTransform: 'capitalize' },
  budgetDayValue: { fontSize: 12, fontWeight: '500', color: colors.lave },
  reservationCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  reservationIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  reservationName: { fontSize: 12.5, fontWeight: '500', color: colors.ink },
  reservationDate: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  wishlistCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkCircleActive: { backgroundColor: colors.success, borderColor: colors.success },
  wishlistBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  wishlistBadgeText: { fontSize: 9, fontWeight: '500' },
  packingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  checkSquare: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkSquareActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  packingLabel: { flex: 1, fontSize: 12.5, color: colors.ink },
  packingLabelDone: { textDecorationLine: 'line-through', color: colors.faint },
  notesInput: { minHeight: 160, marginHorizontal: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 13, color: colors.ink, marginBottom: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FAF8F4', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '85%' },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 16, fontWeight: '500', color: colors.ink, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.ink, marginBottom: 6, marginTop: 10 },
  fieldInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: colors.ink },
  row: { flexDirection: 'row', gap: 10 },
  errorText: { fontSize: 12, color: '#C0392B', backgroundColor: '#FFF0F0', borderRadius: 8, padding: 10, marginTop: 12, textAlign: 'center' },
});