import { useRef, useState, type ReactNode } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, StatusBar, Animated,
  type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ArrowDown, ArrowRight } from 'lucide-react-native';
import { colors, fonts, typography, spacing, radii, cible } from '../../lib/theme';
import { useEntree, useMouvementReduit } from '../../lib/motion';
import { lienVers } from '../../lib/liens';

// Section Culture — V1.
// Pour l'instant : l'introduction et l'invitation finale, reliées à la
// recherche. Les scènes du milieu (peuples, langues, gastronomie, musique,
// traditions, lieux) s'ajoutent dans le tableau SCENES ci-dessous, une par
// une, au fur et à mesure que leur contenu (textes, audio, photos) existe.

// Positionnement explicite (compatible web, cf. règle du projet).
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

// Un bloc qui monte en apparaissant, après `delai` ms. Remplace `FadeInDown`
// de Reanimated : même mouvement, sans la bibliothèque (voir lib/motion.ts).
// `alignItems: 'center'` : le bloc épouse son contenu, comme le faisait le
// texte animé qu'il remplace, au lieu de s'étirer sur toute la largeur.
function Apparition({ delai = 0, children }: { delai?: number; children: ReactNode }) {
  const style = useEntree(delai);
  return <Animated.View style={[{ alignItems: 'center' }, style]}>{children}</Animated.View>;
}

function Soleil() {
  return (
    <Svg width={78} height={78} viewBox="0 0 78 78">
      <Circle cx={39} cy={39} r={39} fill={colors.amber} />
      <Circle cx={39} cy={39} r={28} fill={colors.soleil} />
      <Circle cx={39} cy={39} r={17} fill={colors.braise} />
    </Svg>
  );
}

function SceneIntro({ onNext }: { onNext: () => void }) {
  return (
    <View style={[styles.scene, styles.center, { backgroundColor: colors.lave }]}>
      <Apparition>
        <View style={{ marginBottom: 26 }}><Soleil /></View>
      </Apparition>
      <Apparition delai={300}>
        <Text style={[styles.title, { color: colors.cream }]} accessibilityRole="header" aria-level={1}>
          La RDC ne se visite pas seulement.
        </Text>
      </Apparition>
      <Apparition delai={1000}>
        <Text style={[styles.title, styles.titleBig, { color: colors.amber }]}>Elle se vit.</Text>
      </Apparition>
      <Apparition delai={1700}>
        <Text style={styles.sub}>Une terre. Des centaines de cultures. Une histoire.</Text>
      </Apparition>
      <Apparition delai={2200}>
        {/* Pas le composant `Button` : il impose un libellé crème, illisible
            sur ce fond soleil, et place l'icône avant le texte. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explorer la culture"
          style={[styles.btn, { backgroundColor: colors.soleil }]}
          onPress={onNext}
        >
          <Text style={[styles.btnText, { color: colors.laveDeep }]}>Explorer la culture</Text>
          <ArrowDown size={18} color={colors.laveDeep} />
        </Pressable>
      </Apparition>
    </View>
  );
}

function SceneVoyage() {
  return (
    <View style={[styles.scene, styles.center, { backgroundColor: colors.cream }]}>
      <Apparition>
        <Text
          style={[styles.title, styles.titleBig, { color: colors.lave }]}
          accessibilityRole="header"
          aria-level={2}
        >
          Vous voulez la vivre ?
        </Text>
      </Apparition>
      <Apparition delai={400}>
        <Text style={[styles.sub, { color: colors.muted }]}>
          Hôtels, tables, maisons meublées et lieux à découvrir, sélectionnés avec exigence.
        </Text>
      </Apparition>
      <Apparition delai={800}>
        {/* Un vrai lien sur le web : c'est la sortie de cette page vers le
            catalogue, celle qu'un moteur de recherche doit pouvoir suivre.
            `Button` ne sait pas porter d'adresse : il en ferait un simple bouton. */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Découvrir les expériences"
          style={[styles.btn, { backgroundColor: colors.lave }]}
          {...lienVers('/search')}
        >
          <Text style={[styles.btnText, { color: colors.cream }]}>Découvrir les expériences</Text>
          <ArrowRight size={18} color={colors.cream} />
        </Pressable>
      </Apparition>
    </View>
  );
}

export default function CultureScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [h, setH] = useState(0);
  const [page, setPage] = useState(0);
  // Les entrées en cascade des scènes passent par `useEntree`, qui suit déjà
  // ce réglage ; reste le glissement d'une scène à l'autre, déclenché ici.
  const mouvementReduit = useMouvementReduit();

  // Ajouter ici les scènes du milieu, dans l'ordre d'affichage.
  const SCENES = [
    (next: () => void) => <SceneIntro key="intro" onNext={next} />,
    () => <SceneVoyage key="voyage" />,
  ];

  function onLayout(e: LayoutChangeEvent) {
    setH(e.nativeEvent.layout.height);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!h) return;
    const next = Math.round(e.nativeEvent.contentOffset.y / h);
    if (next !== page) setPage(next);
  }

  function goTo(i: number) {
    scrollRef.current?.scrollTo({ y: i * h, animated: !mouvementReduit });
  }

  return (
    <View style={styles.screen} onLayout={onLayout}>
      <StatusBar barStyle={page === 0 ? 'light-content' : 'dark-content'} />
      {h > 0 && (
        <ScrollView
          ref={scrollRef}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          style={FILL}
        >
          {SCENES.map((render, i) => (
            // La scène n'est montée que lorsqu'elle est à l'écran : ses
            // animations d'entrée se rejouent à chaque visite.
            <View key={i} style={{ height: h }}>
              {(page === i) && render(() => goTo(i + 1))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lave },
  scene: { flex: 1, paddingHorizontal: 28 },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  titleBig: { fontSize: 36, lineHeight: 44, marginBottom: spacing.v12 },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.onBrandMuted,
    marginBottom: 30,
    maxWidth: 320,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: cible.min,
    paddingVertical: spacing.v12,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  btnText: { ...typography.button },
});