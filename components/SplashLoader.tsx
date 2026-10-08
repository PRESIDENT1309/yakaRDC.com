// components/SplashLoader.tsx
// Écran de chargement YakaRDC : lever de soleil (concept B).
//
// Dépendances :
//   npx expo install react-native-svg react-native-reanimated
//
// Utilisation (ex. app/_layout.tsx) :
//   const { loading } = useAuth();
//   const [splashDone, setSplashDone] = useState(false);
//   ...
//   {!splashDone && (
//     <SplashLoader ready={!loading} onFinish={() => setSplashDone(true)} />
//   )}

import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

const COLORS = {
  brown: '#702B12',
  brownDark: '#5E2410',
  track: '#8A4426',
  gold: '#FAC775',
  amber: '#F0A042',
  red: '#D85A30',
  cream: '#FFF8EE',
};

// Positionnement explicite (compatible web, cf. règle du projet).
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

// Dimensions du dessin d'origine (viewBox) : l'horizon est à y = 215.
const VB_W = 200;
const HORIZON = 215;
const VB_H = 245;

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

type Props = {
  /** true quand l'app a fini de charger (auth, profil, données). */
  ready?: boolean;
  /** Progression réelle 0..1, si tu la connais. Sinon la barre avance seule jusqu'à 85 %. */
  progress?: number;
  /** Durée minimale d'affichage en ms, pour que l'animation ne soit pas coupée. */
  minDuration?: number;
  /** Appelé quand l'écran a fini de disparaître : on peut le démonter. */
  onFinish?: () => void;
};

export default function SplashLoader({
  ready = true,
  progress,
  minDuration = 2600,
  onFinish,
}: Props) {
  const { width, height } = useWindowDimensions();
  const [minElapsed, setMinElapsed] = useState(false);

  // Échelle du dessin selon la largeur de l'écran.
  const sceneW = Math.min(width * 0.8, 320);
  const s = sceneW / VB_W;
  const sceneH = VB_H * s;
  const horizonY = HORIZON * s;
  const groundTop = height * 0.5; // position de l'horizon à l'écran
  const sceneTop = groundTop - horizonY;

  const sunY = useSharedValue(100 * s); // le soleil démarre sous l'horizon
  const wordOpacity = useSharedValue(0);
  const wordShift = useSharedValue(8);
  const lineOpacity = useSharedValue(0);
  const fill = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  // Entrée : le soleil monte, puis le nom, puis la ligne.
  useEffect(() => {
    sunY.value = withTiming(0, { duration: 2000, easing: Easing.out(Easing.cubic) });
    wordOpacity.value = withDelay(900, withTiming(1, { duration: 700 }));
    wordShift.value = withDelay(900, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));
    lineOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));

    const t = setTimeout(() => setMinElapsed(true), minDuration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Barre : progression réelle si fournie, sinon avance lente jusqu'à 85 %.
  useEffect(() => {
    if (progress !== undefined) {
      fill.value = withTiming(Math.min(Math.max(progress, 0), 1), { duration: 300 });
    } else {
      fill.value = withTiming(0.85, { duration: 3000, easing: Easing.inOut(Easing.quad) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  // Sortie : quand tout est prêt ET que la durée minimale est passée.
  useEffect(() => {
    if (!(ready && minElapsed)) return;
    fill.value = withTiming(1, { duration: 300 });
    screenOpacity.value = withDelay(400, withTiming(0, { duration: 400 }));
    const t = setTimeout(() => onFinish?.(), 850);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, minElapsed]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const sunStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sunY.value }] }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordShift.value }],
  }));
  const lineWrapStyle = useAnimatedStyle(() => ({ opacity: lineOpacity.value }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <Animated.View
      style={[styles.root, screenStyle]}
      pointerEvents="none"
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement de YakaRDC"
    >
      {/* Sol */}
      <View style={[styles.ground, { top: groundTop }]} />

      {/* Soleil : masqué sous l'horizon, il monte derrière les montagnes */}
      <View
        style={{
          position: 'absolute',
          top: sceneTop,
          left: (width - sceneW) / 2,
          width: sceneW,
          height: horizonY,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[{ width: sceneW, height: sceneH }, sunStyle]}>
          <Svg width={sceneW} height={sceneH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <Circle cx={100} cy={150} r={34} fill={COLORS.gold} />
            <Circle cx={100} cy={150} r={25} fill={COLORS.amber} />
            <Circle cx={100} cy={150} r={16} fill={COLORS.red} />
          </Svg>
        </Animated.View>
      </View>

      {/* Montagnes et vagues, par-dessus le soleil */}
      <View
        style={{
          position: 'absolute',
          top: sceneTop,
          left: (width - sceneW) / 2,
          width: sceneW,
          height: sceneH,
        }}
      >
        <Svg width={sceneW} height={sceneH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <Polygon points="14,215 56,150 98,215" fill={COLORS.brownDark} />
          <Polygon points="102,215 144,150 186,215" fill={COLORS.brownDark} />
          <Polygon points="62,215 100,130 138,215" fill={COLORS.brown} />
          <Path
            d="M30 226 Q65 218 100 226 T170 226"
            fill="none"
            stroke={COLORS.gold}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </Svg>
      </View>

      {/* Nom */}
      <Animated.View style={[styles.wordWrap, { top: groundTop + 56 * s }, wordStyle]}>
        <Text style={styles.word}>
          <Text style={{ color: COLORS.cream }}>Yaka</Text>
          <Text style={{ color: COLORS.gold }}>RDC</Text>
        </Text>
      </Animated.View>

      {/* Ligne de progression */}
      <Animated.View style={[styles.lineWrap, lineWrapStyle]}>
        <Animated.View style={[styles.lineFill, fillStyle]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...FILL,
    backgroundColor: COLORS.brown,
    zIndex: 1000,
    elevation: 1000,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.brownDark,
  },
  wordWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  word: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontWeight: '600',
    fontSize: 34,
    lineHeight: 40,
  },
  lineWrap: {
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: 48,
    height: 2,
    backgroundColor: COLORS.track,
    overflow: 'hidden',
  },
  lineFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
  },
});