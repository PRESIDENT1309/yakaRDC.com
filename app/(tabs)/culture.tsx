import { useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, StatusBar,
  type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ArrowDown, ArrowRight } from 'lucide-react-native';
import { fonts } from '../../lib/theme';

// Section Culture — V1.
// Pour l'instant : l'introduction et l'invitation finale, reliées à la
// recherche. Les scènes du milieu (peuples, langues, gastronomie, musique,
// traditions, lieux) s'ajoutent dans le tableau SCENES ci-dessous, une par
// une, au fur et à mesure que leur contenu (textes, audio, photos) existe.

const BROWN = '#702B12';
const GOLD = '#FAC775';
const AMBER = '#F0A042';
const RED = '#D85A30';
const CREAM = '#FFF8EE';

// Positionnement explicite (compatible web, cf. règle du projet).
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

function Soleil() {
  return (
    <Svg width={78} height={78} viewBox="0 0 78 78">
      <Circle cx={39} cy={39} r={39} fill={GOLD} />
      <Circle cx={39} cy={39} r={28} fill={AMBER} />
      <Circle cx={39} cy={39} r={17} fill={RED} />
    </Svg>
  );
}

function SceneIntro({ onNext }: { onNext: () => void }) {
  return (
    <View style={[styles.scene, styles.center, { backgroundColor: BROWN }]}>
      <Animated.View entering={FadeInDown.duration(700)} style={{ marginBottom: 26 }}>
        <Soleil />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(300).duration(700)} style={[styles.title, { color: CREAM }]}>
        La RDC ne se visite pas seulement.
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(1000).duration(700)} style={[styles.title, styles.titleBig, { color: GOLD }]}>
        Elle se vit.
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(1700).duration(700)} style={styles.sub}>
        Une terre. Des centaines de cultures. Une histoire.
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(2200).duration(700)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explorer la culture"
          style={[styles.btn, { backgroundColor: AMBER }]}
          onPress={onNext}
        >
          <Text style={[styles.btnText, { color: '#4A1C0C' }]}>Explorer la culture</Text>
          <ArrowDown size={18} color="#4A1C0C" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function SceneVoyage() {
  return (
    <View style={[styles.scene, styles.center, { backgroundColor: CREAM }]}>
      <Animated.Text entering={FadeInDown.duration(700)} style={[styles.title, styles.titleBig, { color: BROWN }]}>
        Vous voulez la vivre ?
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(400).duration(700)} style={[styles.sub, { color: '#5A4A40' }]}>
        Hôtels, tables, maisons meublées et lieux à découvrir, sélectionnés avec exigence.
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(800).duration(700)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Découvrir les expériences"
          style={[styles.btn, { backgroundColor: BROWN }]}
          onPress={() => router.push('/(tabs)/search')}
        >
          <Text style={[styles.btnText, { color: CREAM }]}>Découvrir les expériences</Text>
          <ArrowRight size={18} color={CREAM} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function CultureScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [h, setH] = useState(0);
  const [page, setPage] = useState(0);

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
    scrollRef.current?.scrollTo({ y: i * h, animated: true });
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
  screen: { flex: 1, backgroundColor: BROWN },
  scene: { flex: 1, paddingHorizontal: 28 },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    marginBottom: 6,
  },
  titleBig: { fontSize: 36, lineHeight: 44, marginBottom: 14 },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#EBCDB4',
    marginBottom: 30,
    maxWidth: 320,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  btnText: { fontSize: 15, fontWeight: '600' },
});