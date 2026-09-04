import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Plus, Trash2, GripVertical } from 'lucide-react-native';
import { colors, typography, radii, spacing } from '../lib/theme';
import { MENU_SECTION_SUGGESTIONS } from '../lib/menu';
import type { Menu, MenuSection, MenuItem } from '../lib/menu';
import Chip from './Chip';

export interface MenuEditorProps {
  value: Menu;
  onChange: (menu: Menu) => void;
  establishmentType: 'restaurant' | 'site';
  accent?: string;
}

const EMPTY_ITEM: MenuItem = { label: '', description: null, price: null, currency: 'USD' };

/**
 * Saisie de la carte écrite.
 *
 * Le partenaire compose des sections (« Entrées », « Plats ») contenant des
 * lignes. Les suggestions couvrent le cas courant sans enfermer : un
 * établissement peut nommer ses sections comme il l'entend.
 *
 * Ce n'est pas l'éditeur d'offres : ce qui est saisi ici s'affiche, mais ne se
 * réserve pas et ne consomme aucune capacité.
 */
export default function MenuEditor({
  value, onChange, establishmentType, accent = colors.lave,
}: MenuEditorProps) {
  const sections = value.sections;
  const suggestions = MENU_SECTION_SUGGESTIONS[establishmentType];
  const used = new Set(sections.map(s => s.title.trim().toLowerCase()));

  const patch = (next: MenuSection[]) => onChange({ sections: next });

  function addSection(title: string) {
    if (!title.trim()) return;
    patch([...sections, { title: title.trim(), items: [{ ...EMPTY_ITEM }] }]);
  }

  function setSectionTitle(idx: number, title: string) {
    patch(sections.map((s, i) => (i === idx ? { ...s, title } : s)));
  }

  function removeSection(idx: number) {
    patch(sections.filter((_, i) => i !== idx));
  }

  function addItem(sIdx: number) {
    patch(sections.map((s, i) =>
      i === sIdx ? { ...s, items: [...s.items, { ...EMPTY_ITEM }] } : s));
  }

  function setItem(sIdx: number, iIdx: number, field: keyof MenuItem, raw: string) {
    patch(sections.map((s, i) => {
      if (i !== sIdx) return s;
      return {
        ...s,
        items: s.items.map((it, j) => {
          if (j !== iIdx) return it;
          if (field === 'price') {
            // Le prix reste un nombre en base : une saisie vide vaut « pas de
            // prix affiché », pas zéro — offrir un plat et ne pas annoncer son
            // prix sont deux choses différentes.
            const cleaned = raw.replace(/[^\d.]/g, '');
            return { ...it, price: cleaned === '' ? null : Number(cleaned) };
          }
          if (field === 'description') return { ...it, description: raw || null };
          return { ...it, [field]: raw } as MenuItem;
        }),
      };
    }));
  }

  function removeItem(sIdx: number, iIdx: number) {
    patch(sections.map((s, i) =>
      i === sIdx ? { ...s, items: s.items.filter((_, j) => j !== iIdx) } : s));
  }

  return (
    <View style={{ gap: spacing.md }}>
      {sections.length === 0 && (
        <Text style={styles.empty}>
          {establishmentType === 'restaurant'
            ? "Aucun plat saisi. Ajoutez une section pour composer votre carte — les voyageurs la verront sur votre fiche."
            : "Aucune attraction saisie. Ajoutez une section pour publier vos tarifs."}
        </Text>
      )}

      {sections.map((section, sIdx) => (
        <View key={sIdx} style={styles.section}>
          <View style={styles.sectionHeader}>
            <GripVertical size={14} color={colors.faint} strokeWidth={1.75} />
            <TextInput
              style={styles.sectionTitle}
              value={section.title}
              onChangeText={v => setSectionTitle(sIdx, v)}
              placeholder="Nom de la section"
              placeholderTextColor={colors.faint}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Supprimer cette section du menu" onPress={() => removeSection(sIdx)} hitSlop={8}>
              <Trash2 size={15} color={colors.danger} strokeWidth={1.75} />
            </Pressable>
          </View>

          {section.items.map((item, iIdx) => (
            <View key={iIdx} style={styles.item}>
              <View style={styles.itemTop}>
                <TextInput
                  style={styles.itemLabel}
                  value={item.label}
                  onChangeText={v => setItem(sIdx, iIdx, 'label', v)}
                  placeholder={establishmentType === 'restaurant' ? 'Poulet moambe' : 'Grande cascade'}
                  placeholderTextColor={colors.faint}
                />
                <TextInput
                  style={styles.itemPrice}
                  value={item.price == null ? '' : String(item.price)}
                  onChangeText={v => setItem(sIdx, iIdx, 'price', v)}
                  placeholder="12"
                  placeholderTextColor={colors.faint}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.currency}>{item.currency}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Supprimer ce plat" onPress={() => removeItem(sIdx, iIdx)} hitSlop={8}>
                  <Trash2 size={13} color={colors.faint} strokeWidth={1.75} />
                </Pressable>
              </View>
              <TextInput
                style={styles.itemDescription}
                value={item.description ?? ''}
                onChangeText={v => setItem(sIdx, iIdx, 'description', v)}
                placeholder="Description (facultatif)"
                placeholderTextColor={colors.faint}
              />
            </View>
          ))}

          <Pressable style={styles.addItem} onPress={() => addItem(sIdx)}>
            <Plus size={13} color={accent} strokeWidth={2} />
            <Text style={[styles.addItemText, { color: accent }]}>
              {establishmentType === 'restaurant' ? 'Ajouter un plat' : 'Ajouter une ligne'}
            </Text>
          </Pressable>
        </View>
      ))}

      <View>
        <Text style={styles.addSectionLabel}>Ajouter une section</Text>
        <View style={styles.suggestions}>
          {suggestions.filter(t => !used.has(t.toLowerCase())).map(t => (
            <Chip key={t} label={t} onPress={() => addSection(t)} />
          ))}
          <Chip label="Autre…" onPress={() => addSection('Nouvelle section')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { ...typography.caption, color: colors.muted, lineHeight: 18 },
  section: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.white,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sectionTitle: { flex: 1, ...typography.cardTitle, color: colors.ink, paddingVertical: spacing.xs },
  item: { paddingVertical: spacing.xs, gap: spacing.v2 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemLabel: { flex: 1, ...typography.body, color: colors.ink, paddingVertical: 3 },
  itemPrice: {
    width: 58, ...typography.body, color: colors.ink, textAlign: 'right',
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 3,
  },
  currency: { ...typography.caption, color: colors.faint },
  itemDescription: { ...typography.caption, color: colors.muted, paddingVertical: spacing.v2 },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: spacing.xs },
  addItemText: { ...typography.caption, fontWeight: '600' },
  addSectionLabel: { ...typography.badgeSm, color: colors.faint, marginBottom: spacing.v6 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.v6 },
});
