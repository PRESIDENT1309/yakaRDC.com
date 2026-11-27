import { useMemo, useRef, useEffect, useId } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii, fonts, cible } from '../lib/theme';
import {
  MOIS, MOIS_COURTS, joursDansMois, composerIso, decomposerIso, toIsoDate,
} from '../lib/dates';

/**
 * Sélecteur de date en trois colonnes : jour, mois, année.
 *
 * Remplace le calendrier mensuel dans toute l'application. Un calendrier
 * impose de naviguer de mois en mois pour atteindre une date éloignée ; trois
 * colonnes y mènent en trois gestes, et se lisent de la même façon partout.
 *
 * ── Ce que ce composant DOIT conserver du calendrier ──────────────────────
 *
 * Le calendrier ne dessinait pas seulement des cases : il portait une règle
 * métier. Il barrait les jours complets et les jours de fermeture, et
 * interdisait de les choisir. Un sélecteur qui perdrait cette information
 * laisserait un voyageur réserver une date indisponible — le formulaire
 * échouerait plus loin, sans qu'il comprenne pourquoi.
 *
 * La colonne des jours reprend donc ces marques : un jour indisponible est
 * barré, atténué, et ne réagit pas au toucher. La raison est dite sous les
 * colonnes plutôt que devinée.
 */

// Hauteur de la pastille visible d'une ligne, et pas d'une ligne à la suivante.
// La pastille garde ses 38 px ; la ligne qui la porte en occupe 44, pour que
// chaque valeur offre une cible tactile entière. La colonne, elle, ne grandit
// pas : elle montre un peu plus de quatre lignes au lieu d'un peu moins de cinq.
const HAUTEUR_LIGNE = 38;
const PAS_LIGNE = cible.min;
const HAUTEUR_COLONNE = HAUTEUR_LIGNE * 5;

const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

export interface SelecteurDateProps {
  /** Date au format ISO (AAAA-MM-JJ), ou '' si rien n'est choisi. */
  value: string;
  onChange: (iso: string) => void;
  /** Jours complets — barrés et non sélectionnables. */
  fullDays?: Set<string>;
  /** Jours de fermeture de l'établissement — distincts des jours complets. */
  closedDays?: Set<string>;
  /** Borne basse stricte : les dates antérieures ou égales sont refusées. */
  minDate?: string;
  /** Interdit toute date passée. Vrai par défaut : on ne réserve pas hier. */
  minToday?: boolean;
  accent?: string;
  /** Nombre d'années proposées à partir de l'année courante. */
  anneesProposees?: number;
}

type Motif = 'complet' | 'ferme' | 'passe' | null;

// Ce que la lecture vocale ajoute après une valeur refusée. `passe` couvre
// aussi une date antérieure à l'arrivée, et un mois ou une année sans aucun
// jour libre : « indisponible » reste exact dans les trois cas.
const RAISON: Record<Exclude<Motif, null>, string> = {
  complet: 'complet',
  ferme: 'fermé',
  passe: 'indisponible',
};

export default function SelecteurDate({
  value, onChange, fullDays, closedDays, minDate,
  minToday = true, accent = colors.lave, anneesProposees = 3,
}: SelecteurDateProps) {
  const aujourdhui = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const isoAujourdhui = toIsoDate(aujourdhui);

  // Sans valeur, on ouvre sur aujourd'hui : c'est la date la plus probable,
  // et cela évite une colonne vide qui ne dit pas par où commencer.
  const courant = decomposerIso(value) ?? {
    annee: aujourdhui.getFullYear(), mois: aujourdhui.getMonth(), jour: aujourdhui.getDate(),
  };

  const annees = useMemo(() => {
    const base = aujourdhui.getFullYear();
    const liste: number[] = [];
    for (let i = 0; i < anneesProposees; i++) liste.push(base + i);
    // Une date déjà enregistrée hors de la plage doit rester visible, sinon la
    // colonne prétendrait que la valeur en cours n'existe pas.
    if (!liste.includes(courant.annee)) liste.push(courant.annee);
    return liste.sort((a, b) => a - b);
  }, [aujourdhui, anneesProposees, courant.annee]);

  const nbJours = joursDansMois(courant.annee, courant.mois);
  const jours = useMemo(() => Array.from({ length: nbJours }, (_, i) => i + 1), [nbJours]);

  /** Pourquoi une date ne peut pas être choisie — ou `null` si elle le peut. */
  function motifRefus(annee: number, mois: number, jour: number): Motif {
    const iso = composerIso(annee, mois, jour);
    if (minToday && iso < isoAujourdhui) return 'passe';
    if (minDate && iso <= minDate) return 'passe';
    if (fullDays?.has(iso)) return 'complet';
    if (closedDays?.has(iso)) return 'ferme';
    return null;
  }

  /** Un mois entier est refusé quand aucun de ses jours n'est disponible. */
  function moisIndisponible(mois: number): boolean {
    const n = joursDansMois(courant.annee, mois);
    for (let j = 1; j <= n; j++) if (!motifRefus(courant.annee, mois, j)) return false;
    return true;
  }

  function anneeIndisponible(annee: number): boolean {
    for (let m = 0; m < 12; m++) {
      const n = joursDansMois(annee, m);
      for (let j = 1; j <= n; j++) if (!motifRefus(annee, m, j)) return false;
    }
    return true;
  }

  /**
   * Applique un changement de partie. Le jour est ramené dans le mois quand il
   * n'y existe pas — passer du 31 janvier à février doit donner le 28 ou le 29,
   * pas une date inexistante.
   */
  function changer(partie: 'jour' | 'mois' | 'annee', valeur: number) {
    const prochain = { ...courant, [partie]: valeur };
    const max = joursDansMois(prochain.annee, prochain.mois);
    if (prochain.jour > max) prochain.jour = max;

    // Si le jour retenu n'est pas disponible dans le nouveau mois, on avance au
    // premier jour libre plutôt que de renvoyer une date que le formulaire
    // refusera ensuite sans explication.
    if (motifRefus(prochain.annee, prochain.mois, prochain.jour)) {
      const libre = Array.from({ length: max }, (_, i) => i + 1)
        .find(j => !motifRefus(prochain.annee, prochain.mois, j));
      if (libre) prochain.jour = libre;
      else { onChange(''); return; }   // mois entièrement indisponible
    }
    onChange(composerIso(prochain.annee, prochain.mois, prochain.jour));
  }

  const motifCourant = motifRefus(courant.annee, courant.mois, courant.jour);

  return (
    <View>
      <View style={styles.colonnes}>
        <Colonne
          libelle="Jour"
          valeurs={jours}
          rendu={j => String(j)}
          // « 3 » seul ne dit ni le jour de la semaine ni le mois en cours.
          lecture={j => `${JOURS_SEMAINE[new Date(courant.annee, courant.mois, j).getDay()]} ${j} ${MOIS[courant.mois]} ${courant.annee}`}
          actif={courant.jour}
          refuse={j => motifRefus(courant.annee, courant.mois, j)}
          onChoisir={j => changer('jour', j)}
          accent={accent}
        />
        <Colonne
          libelle="Mois"
          valeurs={Array.from({ length: 12 }, (_, i) => i)}
          rendu={m => MOIS_COURTS[m]}
          lecture={m => `${MOIS[m]} ${courant.annee}`}
          actif={courant.mois}
          refuse={m => (moisIndisponible(m) ? 'passe' : null)}
          onChoisir={m => changer('mois', m)}
          accent={accent}
        />
        <Colonne
          libelle="Année"
          valeurs={annees}
          rendu={a => String(a)}
          lecture={a => String(a)}
          actif={courant.annee}
          refuse={a => (anneeIndisponible(a) ? 'passe' : null)}
          onChoisir={a => changer('annee', a)}
          accent={accent}
        />
      </View>

      {/* La raison d'un refus se lit, elle ne se devine pas. */}
      {motifCourant && (
        <Text style={styles.avertissement} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {motifCourant === 'complet' && 'Cette date est complète — choisissez-en une autre.'}
          {motifCourant === 'ferme' && "L'établissement est fermé ce jour-là."}
          {motifCourant === 'passe' && 'Cette date est déjà passée.'}
        </Text>
      )}

      {(fullDays?.size || closedDays?.size) ? (
        <View style={styles.legende}>
          <Text style={styles.legendeTexte}>Les jours barrés sont complets ou fermés.</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Une colonne défilante. Extraite pour que les trois se comportent pareil. */
function Colonne<T extends number>({
  libelle, valeurs, rendu, lecture, actif, refuse, onChoisir, accent,
}: {
  libelle: string;
  valeurs: T[];
  rendu: (v: T) => string;
  /** Valeur dite en entier pour la lecture vocale (« mardi 3 décembre 2026 »). */
  lecture: (v: T) => string;
  actif: T;
  refuse: (v: T) => Motif;
  onChoisir: (v: T) => void;
  accent: string;
}) {
  const ref = useRef<ScrollView>(null);
  // Relie le titre de la colonne à son groupe d'options.
  const idTitre = useId();

  // La valeur choisie est amenée sous les yeux à l'ouverture : sans cela, une
  // date en fin de mois s'ouvrirait hors écran, et l'utilisateur croirait que
  // rien n'est sélectionné.
  useEffect(() => {
    const index = valeurs.indexOf(actif);
    if (index < 0) return;
    const y = Math.max(0, spacing.xs + index * PAS_LIGNE - HAUTEUR_COLONNE / 2 + PAS_LIGNE / 2);
    const t = setTimeout(() => ref.current?.scrollTo({ y, animated: false }), 40);
    return () => clearTimeout(t);
  }, [actif, valeurs]);

  return (
    // Chaque colonne est un choix unique : ses lignes sont des boutons radio,
    // comme les créneaux de TimeField — la valeur retenue n'était portée que
    // par la couleur.
    <View style={styles.colonne} accessibilityRole="radiogroup" aria-labelledby={idTitre}>
      <Text nativeID={idTitre} style={styles.colonneTitre}>{libelle}</Text>
      <ScrollView
        ref={ref}
        style={{ height: HAUTEUR_COLONNE }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: spacing.xs }}
      >
        {valeurs.map(v => {
          const motif = refuse(v);
          const choisi = v === actif;
          return (
            <Pressable
              key={String(v)}
              onPress={() => { if (!motif) onChoisir(v); }}
              disabled={!!motif}
              accessibilityRole="radio"
              aria-checked={choisi}
              accessibilityLabel={motif ? `${lecture(v)}, ${RAISON[motif]}` : lecture(v)}
              style={styles.ligne}
            >
              <View style={[styles.pastille, choisi && { backgroundColor: accent }]}>
                <Text
                  style={[
                    styles.ligneTexte,
                    choisi && styles.ligneTexteChoisi,
                    !!motif && styles.ligneTexteRefusee,
                  ]}
                >
                  {rendu(v)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  colonnes: { flexDirection: 'row', gap: spacing.sm },
  colonne: { flex: 1 },
  colonneTitre: {
    ...typography.captionSm, color: colors.faint, textAlign: 'center',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.xs,
  },
  ligne: { height: PAS_LIGNE, justifyContent: 'center' },
  pastille: {
    height: HAUTEUR_LIGNE, alignItems: 'center', justifyContent: 'center',
    borderRadius: radii.sm,
  },
  ligneTexte: { ...typography.bodySm, color: colors.ink },
  ligneTexteChoisi: { color: colors.cream, fontFamily: fonts.sansBold },
  ligneTexteRefusee: { color: colors.borderStrong, textDecorationLine: 'line-through' },
  avertissement: {
    ...typography.captionSm, color: colors.danger,
    textAlign: 'center', marginTop: spacing.v12,
  },
  legende: { marginTop: spacing.sm, alignItems: 'center' },
  legendeTexte: { ...typography.captionSm, color: colors.faint },
});
