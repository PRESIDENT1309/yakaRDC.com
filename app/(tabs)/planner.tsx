import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, TextInput, ActivityIndicator, Modal, Alert,
} from 'react-native';
import {
  CalendarRange, Plus, Tag, Trash2, Wallet, X,
  Building2, Home, UtensilsCrossed, Mountain, MapPin,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors } from '../../lib/theme';
import type { TripPlan, TripPlanItem, Establishment, EstablishmentType } from '../../lib/types';

function TypeIcon({ type, size = 14 }: { type: EstablishmentType; size?: number }) {
  const cat = categoryColors[type];
  const props = { size, color: cat?.accent ?? colors.lave };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}

// Génère la liste des dates (JJ/MM/AAAA) entre deux bornes incluses
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

function formatDayLabel(iso: string): { weekday: string; day: string } {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
    day: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
  };
}

export default function PlannerScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [items, setItems] = useState<TripPlanItem[]>([]);
  const [promoted, setPromoted] = useState<Establishment[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Création de voyage
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('Mon voyage à Kinshasa');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Ajout d'un élément
  const [addModal, setAddModal] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemCost, setItemCost] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [itemEstablishmentId, setItemEstablishmentId] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);

    const { data: plans } = await supabase
      .from('trip_plans')
      .select('*')
      .eq('traveler_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const currentPlan = (plans?.[0] as TripPlan) ?? null;
    setPlan(currentPlan);

    if (currentPlan) {
      const { data: planItems } = await supabase
        .from('trip_plan_items')
        .select('*')
        .eq('trip_plan_id', currentPlan.id)
        .order('day_date', { ascending: true })
        .order('position', { ascending: true });
      setItems((planItems as TripPlanItem[]) ?? []);
      setSelectedDay(prev => prev ?? currentPlan.start_date);
    }

    const { data: promos } = await supabase
      .from('establishments')
      .select('*')
      .eq('status', 'approved')
      .not('discount_percent', 'is', null)
      .limit(10);
    setPromoted((promos as Establishment[]) ?? []);

    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  async function handleCreatePlan() {
    setFormError(null);
    if (!title.trim() || !startDate.trim() || !endDate.trim()) {
      setFormError('Veuillez remplir le titre et les deux dates (JJ/MM/AAAA).');
      return;
    }
    // Convertit JJ/MM/AAAA -> AAAA-MM-JJ
    const toIso = (v: string) => {
      const [d, m, y] = v.split('/');
      if (!d || !m || !y) return null;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };
    const isoStart = toIso(startDate);
    const isoEnd = toIso(endDate);
    if (!isoStart || !isoEnd) {
      setFormError('Format de date invalide. Utilisez JJ/MM/AAAA.');
      return;
    }
    if (isoEnd < isoStart) {
      setFormError('La date de fin doit être après la date de départ.');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('trip_plans')
      .insert({ traveler_id: session!.user.id, title: title.trim(), start_date: isoStart, end_date: isoEnd })
      .select()
      .single();
    setSaving(false);

    if (error) { setFormError('Une erreur est survenue.'); return; }
    setPlan(data as TripPlan);
    setSelectedDay(isoStart);
    setCreating(false);
  }

  async function handleAddItem() {
    if (!plan || !selectedDay || !itemTitle.trim()) return;
    const { error } = await supabase.from('trip_plan_items').insert({
      trip_plan_id: plan.id,
      establishment_id: itemEstablishmentId,
      day_date: selectedDay,
      title: itemTitle.trim(),
      estimated_cost: parseFloat(itemCost) || 0,
      notes: itemNotes.trim() || null,
      position: items.filter(i => i.day_date === selectedDay).length,
    });
    if (!error) {
      setAddModal(false);
      setItemTitle(''); setItemCost(''); setItemNotes(''); setItemEstablishmentId(null);
      fetchPlan();
    }
  }

  function addPromoToDay(estab: Establishment) {
    if (!selectedDay) return;
    setItemTitle(estab.name);
    setItemEstablishmentId(estab.id);
    setItemCost('');
    setAddModal(true);
  }

  async function deleteItem(id: string) {
    await supabase.from('trip_plan_items').delete().eq('id', id);
    fetchPlan();
  }

  function confirmDeletePlan() {
    if (!plan) return;
    Alert.alert('Supprimer ce voyage', 'Toutes les activités planifiées seront supprimées.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('trip_plans').delete().eq('id', plan.id);
        setPlan(null); setItems([]); setSelectedDay(null);
      }},
    ]);
  }

  // ── État : aucun voyage encore créé ──
  if (!loading && !plan && !creating) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}><Text style={styles.headerTitle}>Mon planning</Text></View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><CalendarRange size={36} color={colors.lave} /></View>
          <Text style={styles.emptyTitle}>Planifiez votre séjour</Text>
          <Text style={styles.emptyText}>
            Organisez vos journées, ajoutez des activités et gardez un œil sur votre budget. Vous seul pouvez voir ce planning.
          </Text>
          <Pressable style={styles.createBtn} onPress={() => setCreating(true)}>
            <Plus size={16} color="#FAF8F4" />
            <Text style={styles.createBtnText}>Créer mon voyage</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Formulaire de création ──
  if (creating) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => setCreating(false)} hitSlop={8}><X size={18} color={colors.ink} /></Pressable>
          <Text style={styles.headerTitle}>Nouveau voyage</Text>
          <View style={{ width: 18 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Titre du voyage</Text>
            <TextInput style={styles.fieldInput} value={title} onChangeText={setTitle} placeholder="Mon voyage à Kinshasa" placeholderTextColor={colors.faint} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Date de départ</Text>
              <TextInput style={styles.fieldInput} value={startDate} onChangeText={setStartDate} placeholder="20/07/2026" placeholderTextColor={colors.faint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Date de retour</Text>
              <TextInput style={styles.fieldInput} value={endDate} onChangeText={setEndDate} placeholder="25/07/2026" placeholderTextColor={colors.faint} />
            </View>
          </View>
          {formError && <Text style={styles.errorText}>{formError}</Text>}
          <Pressable style={[styles.createBtn, saving && { opacity: 0.7 }]} onPress={handleCreatePlan} disabled={saving}>
            {saving ? <ActivityIndicator color="#FAF8F4" /> : <Text style={styles.createBtnText}>Créer le voyage</Text>}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (loading || !plan) {
    return <View style={styles.loading}><ActivityIndicator color={colors.lave} /></View>;
  }

  const days = dateRange(plan.start_date, plan.end_date);
  const dayItems = items.filter(i => i.day_date === selectedDay);
  const dayTotal = dayItems.reduce((s, i) => s + Number(i.estimated_cost), 0);
  const tripTotal = items.reduce((s, i) => s + Number(i.estimated_cost), 0);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{plan.title}</Text>
          <Text style={styles.headerSub}>
            {new Date(plan.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — {new Date(plan.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <Pressable onPress={confirmDeletePlan} hitSlop={8}>
          <Trash2 size={16} color={colors.faint} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Budget total */}
        <View style={styles.budgetCard}>
          <View style={styles.budgetIcon}><Wallet size={18} color={colors.lave} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.budgetLabel}>Budget estimé du voyage</Text>
            <Text style={styles.budgetValue}>{tripTotal.toFixed(2)} $</Text>
          </View>
        </View>

        {/* Sélecteur de jour */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysRow} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
          {days.map(d => {
            const { weekday, day } = formatDayLabel(d);
            const active = d === selectedDay;
            return (
              <Pressable key={d} style={[styles.dayChip, active && styles.dayChipActive]} onPress={() => setSelectedDay(d)}>
                <Text style={[styles.dayWeekday, active && styles.dayTextActive]}>{weekday}</Text>
                <Text style={[styles.dayNumber, active && styles.dayTextActive]}>{day}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Promotions du jour */}
        {promoted.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Tag size={14} color="#854F0B" />
              <Text style={styles.sectionTitle}>Promotions du jour</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 18, gap: 10 }}>
              {promoted.map(e => (
                <View key={e.id} style={styles.promoCard}>
                  <View style={[styles.promoIcon, { backgroundColor: categoryColors[e.type]?.soft ?? '#FAEEDA' }]}>
                    <TypeIcon type={e.type} size={18} />
                  </View>
                  <Text style={styles.promoName} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.promoDiscount}>
                    {e.discount_label ?? `-${e.discount_percent}%`}
                  </Text>
                  <Pressable style={styles.promoAddBtn} onPress={() => addPromoToDay(e)}>
                    <Plus size={12} color="#FAF8F4" />
                    <Text style={styles.promoAddText}>Ajouter</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Activités du jour */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Activités — {selectedDay && formatDayLabel(selectedDay).day}
            </Text>
            <Text style={styles.dayTotalText}>{dayTotal.toFixed(2)} $</Text>
          </View>

          {dayItems.length === 0 ? (
            <Text style={styles.emptyDayText}>Aucune activité prévue pour ce jour.</Text>
          ) : (
            <View style={{ gap: 8, paddingHorizontal: 18 }}>
              {dayItems.map(item => (
                <View key={item.id} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
                  </View>
                  <Text style={styles.itemCost}>{Number(item.estimated_cost).toFixed(2)} $</Text>
                  <Pressable onPress={() => deleteItem(item.id)} hitSlop={8}>
                    <Trash2 size={14} color={colors.faint} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Pressable
            style={styles.addItemBtn}
            onPress={() => { setItemTitle(''); setItemEstablishmentId(null); setAddModal(true); }}
          >
            <Plus size={15} color={colors.lave} />
            <Text style={styles.addItemBtnText}>Ajouter une activité</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal ajout d'activité */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Ajouter une activité</Text>

            <Text style={styles.fieldLabel}>Nom de l'activité</Text>
            <TextInput
              style={styles.fieldInput}
              value={itemTitle}
              onChangeText={setItemTitle}
              placeholder="Ex : Visite du marché central"
              placeholderTextColor={colors.faint}
            />

            <Text style={styles.fieldLabel}>Coût estimé ($)</Text>
            <TextInput
              style={styles.fieldInput}
              value={itemCost}
              onChangeText={setItemCost}
              placeholder="0"
              placeholderTextColor={colors.faint}
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>Notes (optionnel)</Text>
            <TextInput
              style={[styles.fieldInput, { height: 60, textAlignVertical: 'top' }]}
              value={itemNotes}
              onChangeText={setItemNotes}
              placeholder="Ex : réserver à l'avance"
              placeholderTextColor={colors.faint}
              multiline
            />

            <Pressable
              style={[styles.createBtn, !itemTitle.trim() && { opacity: 0.5 }]}
              onPress={handleAddItem}
              disabled={!itemTitle.trim()}
            >
              <Text style={styles.createBtnText}>Ajouter au planning</Text>
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
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FAF8F4',
  },
  headerTitle: { fontSize: 17, fontWeight: '500', color: colors.ink },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  content: { padding: 20, gap: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.laveSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '500', color: colors.ink },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.lave, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, marginTop: 8 },
  createBtnText: { fontSize: 14, fontWeight: '500', color: '#FAF8F4' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.ink, marginBottom: 6, marginTop: 4 },
  fieldInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: colors.ink, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  errorText: { fontSize: 12, color: '#C0392B', backgroundColor: '#FFF0F0', borderRadius: 8, padding: 10, marginVertical: 10, textAlign: 'center' },
  budgetCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginHorizontal: 18, marginTop: 16, marginBottom: 14 },
  budgetIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.laveSoft, alignItems: 'center', justifyContent: 'center' },
  budgetLabel: { fontSize: 11, color: colors.muted },
  budgetValue: { fontSize: 22, fontWeight: '500', color: colors.ink, marginTop: 2 },
  daysRow: { marginBottom: 18 },
  dayChip: { alignItems: 'center', gap: 2, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, minWidth: 56 },
  dayChipActive: { backgroundColor: colors.lave, borderColor: colors.lave },
  dayWeekday: { fontSize: 10, color: colors.faint, textTransform: 'capitalize' },
  dayNumber: { fontSize: 12, fontWeight: '500', color: colors.ink },
  dayTextActive: { color: '#FAF8F4' },
  section: { marginBottom: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, marginBottom: 10 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.ink },
  dayTotalText: { fontSize: 13, fontWeight: '500', color: colors.lave },
  promoCard: { width: 140, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 4 },
  promoIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  promoName: { fontSize: 12, fontWeight: '500', color: colors.ink },
  promoDiscount: { fontSize: 11, color: '#854F0B', fontWeight: '500' },
  promoAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.lave, borderRadius: 7, paddingVertical: 6, marginTop: 4 },
  promoAddText: { fontSize: 10.5, color: '#FAF8F4', fontWeight: '500' },
  emptyDayText: { fontSize: 12, color: colors.muted, paddingHorizontal: 18, marginBottom: 10 },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12 },
  itemTitle: { fontSize: 13, fontWeight: '500', color: colors.ink },
  itemNotes: { fontSize: 11, color: colors.muted, marginTop: 2 },
  itemCost: { fontSize: 12, fontWeight: '500', color: colors.ink },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginHorizontal: 18, marginTop: 10, backgroundColor: colors.laveSoft, borderRadius: 10, paddingVertical: 11 },
  addItemBtnText: { fontSize: 12.5, color: colors.lave, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FAF8F4', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '500', color: colors.ink, marginBottom: 10 },
});