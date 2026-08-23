import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '../lib/theme';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatFrench(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

interface CalendarProps {
  // Date sélectionnée au format ISO (AAAA-MM-JJ)
  value: string | null;
  onSelect: (iso: string) => void;
  // Jours complets, au format ISO — affichés barrés et non cliquables
  fullDays?: Set<string>;
  /**
   * Jours de fermeture de l'établissement. Distincts des jours complets : un
   * jour fermé n'est pas un jour plein, et le dire correctement évite de
   * laisser croire à une affluence là où il n'y a qu'une porte close.
   */
  closedDays?: Set<string>;
  accent?: string;
  // Empêche de choisir une date avant aujourd'hui
  minToday?: boolean;
  // Borne inférieure explicite, au format ISO — les dates antérieures ou
  // égales sont non sélectionnables. Sert au départ d'un séjour, qui doit
  // tomber strictement après l'arrivée.
  minDate?: string;
}

export default function Calendar({
  value,
  onSelect,
  fullDays,
  closedDays,
  accent = colors.lave,
  minToday = true,
  minDate,
}: CalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initial = value ? new Date(value) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  // Premier jour affiché : on cale la grille sur un lundi
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const jsDay = firstOfMonth.getDay(); // 0 = dimanche
  const leadingBlanks = jsDay === 0 ? 6 : jsDay - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function goPrev() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function goNext() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={goPrev} hitSlop={10} style={styles.navBtn}>
          <ChevronLeft size={17} color={colors.ink} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={goNext} hitSlop={10} style={styles.navBtn}>
          <ChevronRight size={17} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((dayNum, i) => {
          if (dayNum === null) {
            return <View key={`blank-${i}`} style={styles.cell} />;
          }

          const cellDate = new Date(viewYear, viewMonth, dayNum);
          const iso = toIsoDate(cellDate);
          const isPast = (minToday && cellDate < today) || (!!minDate && iso <= minDate);
          const isFull = fullDays?.has(iso) ?? false;
          const isClosed = closedDays?.has(iso) ?? false;
          const isSelected = value === iso;
          const disabled = isPast || isFull || isClosed;

          return (
            <Pressable
              key={iso}
              style={styles.cell}
              onPress={() => !disabled && onSelect(iso)}
              disabled={disabled}
            >
              <View style={[
                styles.dayBubble,
                isSelected && { backgroundColor: accent },
                isFull && styles.dayFull,
              ]}>
                <Text style={[
                  styles.dayText,
                  isPast && styles.dayTextPast,
                  isFull && styles.dayTextFull,
                  isClosed && styles.dayTextClosed,
                  isSelected && styles.dayTextSelected,
                ]}>
                  {dayNum}
                </Text>
              </View>
              {isFull && <View style={styles.fullDot} />}
            </Pressable>
          );
        })}
      </View>

      {((fullDays?.size ?? 0) > 0 || (closedDays?.size ?? 0) > 0) && (
        <View style={styles.legend}>
          {(fullDays?.size ?? 0) > 0 && (
            <>
              <View style={styles.fullDot} />
              <Text style={styles.legendText}>Journée complète</Text>
            </>
          )}
          {(closedDays?.size ?? 0) > 0 && (
            <Text style={styles.legendText}>Jour barré : fermé</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F4F0',
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
    textTransform: 'capitalize',
  },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10.5,
    color: colors.faint,
    fontWeight: '500',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTextClosed: { color: colors.faint, textDecorationLine: 'line-through' },
  dayFull: { backgroundColor: '#FFF0F0' },
  dayText: { fontSize: 13, color: colors.ink },
  dayTextPast: { color: '#D8D6CE' },
  dayTextFull: { color: '#C0392B', textDecorationLine: 'line-through' },
  dayTextSelected: { color: '#FAF8F4', fontWeight: '600' },
  fullDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C0392B',
    marginTop: 1,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F4F0',
  },
  legendText: { fontSize: 10.5, color: colors.muted },
});