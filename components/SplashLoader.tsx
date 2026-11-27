// components/SplashLoader.tsx
// Écran de chargement YakaRDC : lever de soleil (concept B).
//
// Utilisation (app/_layout.tsx) :
//   const { loading } = useAuth();
//   const [splashDone, setSplashDone] = useState(false);
//   ...
//   {!splashDone && (
//     <SplashLoader ready={!loading} onFinish={() => setSplashDone(true)} />
//   )}
//
// ── Ce qui a changé le 26/11/2026, et pourquoi ─────────────────────────────
//
//  1. Plus de durée imposée. L'écran restait 2,6 s au minimum, même quand
//     l'application était prête en 300 ms : chaque visite payait plus de deux
//     secondes d'attente pour laisser une animation se terminer. Il part
//     désormais dès que `ready` passe à vrai ; le lever de soleil se voit en
//     entier sur une connexion lente, et s'interrompt sur une rapide.
//
//  2. API `Animated` de React Native, et non Reanimated. Cet écran et l'onglet
//     Culture étaient les deux seuls à importer Reanimated, ce qui suffisait à
//     l'embarquer dans le paquet web — plusieurs centaines de Ko téléchargés
//     AVANT de pouvoir afficher cet écran d'attente. Voir lib/motion.ts.
//
//  3. Il intercepte les appuis tant qu'il est visible. Avec
//     `pointerEvents="none"`, on pouvait activer à l'aveugle un bouton de
//     l'écran situé dessous, encore invisible.
//
//  4. Il respecte « réduire les animations » : la scène est posée d'emblée.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { useMouvementReduit } from '../lib/motion';
import { colors } from '../lib/theme';

// Couleurs du dessin, prises dans le thème. Attention aux noms, hérités de la
// maquette : l'anneau `amber` du soleil est le jeton `soleil`, et c'est le
// halo `gold` qui correspond au jeton `amber`.
const COLORS = {
  brown: colors.lave,
  // Deux bruns sans jeton équivalent : le sol, entre `lave` et `laveDeep`, et
  // le rail de la barre. `laveDeep` creuserait l'horizon bien plus que prévu ;
  // ils restent donc en dur, propres à cette illustration.
  brownDark: '#5E2410',
  track: '#8A4426',
  gold: colors.amber,
  amber: colors.soleil,
  red: colors.braise,
  cream: colors.cream,
};

// Positionnement explicite (compatible web, cf. règle du projet).
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

// Dimensions du dessin d'origine (viewBox) : l'horizon est à y = 215.
const VB_W = 200;
const HORIZON = 215;
const VB_H = 245;

// Polices système : cet écran s'affiche pendant que Playfair se charge.
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

// Le pilote natif n'existe pas sur le web, où il ne provoque qu'un avertissement.
const NATIF = Platform.OS !== 'web';

/** Durée du fondu de sortie. Courte : à ce stade, l'application est prête. */
const SORTIE_MS = 280;

type Props = {
  /** true quand l'app a fini de charger (auth, profil, données). */
  ready?: boolean;
  /** Progression réelle 0..1, si elle est connue. Sinon la barre avance seule jusqu'à 85 %. */
  progress?: number;
  /**
   * Durée minimale d'affichage en ms. 0 par défaut : l'écran ne retient pas
   * l'utilisateur au-delà du chargement réel.
   */
  minDuration?: number;
  /** Appelé quand l'écran a fini de disparaître : on peut le démonter. */
  onFinish?: () => void;
};

export default function SplashLoader({
  ready = true,
  progress,
  minDuration = 0,
  onFinish,
}: Props) {
  const { width, height } = useWindowDimensions();
  const reduit = useMouvementReduit();
  const [minElapsed, setMinElapsed] = useState(minDuration <= 0);
  const [sortie, setSortie] = useState(false);
  // Doublon de `sortie` lisible sans attendre un rendu, pour l'effet de la barre.
  const enSortie = useRef(false);
  // Dernière version de `onFinish` : l'appelant passe une fonction recréée à
  // chaque rendu, qu'on ne veut pas voir relancer la sortie.
  const finir = useRef(onFinish);
  finir.current = onFinish;

  // Échelle du dessin selon la largeur de l'écran.
  const sceneW = Math.min(width * 0.8, 320);
  const s = sceneW / VB_W;
  const sceneH = VB_H * s;
  const horizonY = HORIZON * s;
  const groundTop = height * 0.5; // position de l'horizon à l'écran
  const sceneTop = groundTop - horizonY;

  // 0 → 1 : le soleil monte, le nom et la ligne apparaissent.
  const lever = useRef(new Animated.Value(0)).current;
  const nom = useRef(new Animated.Value(0)).current;
  const ligne = useRef(new Animated.Value(0)).current;
  const remplissage = useRef(new Animated.Value(0)).current;
  const opaciteEcran = useRef(new Animated.Value(1)).current;

  // Entrée : le soleil monte, puis la ligne, puis le nom.
  useEffect(() => {
    if (reduit) {
      lever.setValue(1); nom.setValue(1); ligne.setValue(1);
      return;
    }
    const entree = Animated.parallel([
      Animated.timing(lever, { toValue: 1, duration: 2000, easing: Easing.out(Easing.cubic), useNativeDriver: NATIF }),
      Animated.timing(ligne, { toValue: 1, duration: 400, delay: 600, useNativeDriver: NATIF }),
      Animated.timing(nom, { toValue: 1, duration: 700, delay: 900, easing: Easing.out(Easing.cubic), useNativeDriver: NATIF }),
    ]);
    entree.start();
    return () => entree.stop();
  }, [reduit, lever, nom, ligne]);

  useEffect(() => {
    if (minDuration <= 0) return;
    const t = setTimeout(() => setMinElapsed(true), minDuration);
    return () => clearTimeout(t);
  }, [minDuration]);

  // Barre : progression réelle si fournie, sinon avance lente jusqu'à 85 %.
  // `width` ne passe pas par le pilote natif : c'est une propriété de mise en page.
  //
  // Pas d'arrêt au nettoyage, à dessein : lancer une nouvelle animation sur la
  // même valeur remplace déjà la précédente, et une fois la sortie engagée
  // (`enSortie`) cet effet ne touche plus à la barre.
  useEffect(() => {
    if (enSortie.current) return;
    // Animations réduites : la barre n'avance pas. Elle est posée à sa valeur
    // réelle si elle est connue, entière sinon — elle ne mesure alors rien et
    // n'est plus qu'un trait sous le nom, comme le reste de la scène, posée
    // d'emblée. `setValue` interrompt aussi l'avance déjà lancée quand le
    // réglage, lu de façon asynchrone, arrive après le premier rendu.
    if (reduit) {
      remplissage.setValue(progress !== undefined ? Math.min(Math.max(progress, 0), 1) : 1);
      return;
    }
    if (progress !== undefined) {
      Animated.timing(remplissage, { toValue: Math.min(Math.max(progress, 0), 1), duration: 300, useNativeDriver: false }).start();
    } else {
      Animated.timing(remplissage, { toValue: 0.85, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
    }
  }, [progress, remplissage, reduit]);

  // Sortie : dès que tout est prêt. La barre se complète, l'écran s'efface.
  useEffect(() => {
    if (!(ready && minElapsed)) return;
    enSortie.current = true;
    setSortie(true);

    let termine = false;
    const terminer = () => {
      if (termine) return;
      termine = true;
      finir.current?.();
    };

    Animated.timing(remplissage, { toValue: 1, duration: 160, useNativeDriver: false }).start();
    // `terminer` est appelé que le fondu soit allé au bout ou non : à ce
    // stade l'application est prête, rien ne justifie de la masquer encore.
    Animated.timing(opaciteEcran, { toValue: 0, duration: SORTIE_MS, delay: 120, useNativeDriver: NATIF }).start(terminer);

    // Filet de sécurité. Sur le web, les animations avancent au rythme de
    // l'affichage (requestAnimationFrame), que le navigateur suspend dans un
    // onglet en arrière-plan : le fondu ne s'y termine pas. Le minuteur, lui,
    // continue de tourner et retire l'écran même si personne ne regarde.
    const filet = setTimeout(terminer, 120 + SORTIE_MS + 250);
    return () => clearTimeout(filet);
  }, [ready, minElapsed, remplissage, opaciteEcran]);

  return (
    <Animated.View
      style={[styles.root, { opacity: opaciteEcran }]}
      // Tant qu'il est visible, l'écran retient les appuis ; dès qu'il
      // commence à s'effacer, il les laisse passer vers l'application.
      pointerEvents={sortie ? 'none' : 'auto'}
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
        <Animated.View
          style={{
            width: sceneW,
            height: sceneH,
            transform: [{ translateY: lever.interpolate({ inputRange: [0, 1], outputRange: [100 * s, 0] }) }],
          }}
        >
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
      <Animated.View
        style={[
          styles.wordWrap,
          { top: groundTop + 56 * s },
          {
            opacity: nom,
            transform: [{ translateY: nom.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          },
        ]}
      >
        <Text style={styles.word}>
          <Text style={{ color: COLORS.cream }}>Yaka</Text>
          <Text style={{ color: COLORS.gold }}>RDC</Text>
        </Text>
      </Animated.View>

      {/* Ligne de progression */}
      <Animated.View style={[styles.lineWrap, { opacity: ligne }]}>
        <Animated.View
          style={[
            styles.lineFill,
            { width: remplissage.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
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
    // Graisse laissée en chiffres, à dessein : `SERIF` est une police du
    // système, qui possède un vrai gras. Le faux gras que l'on évite ailleurs
    // ne touche que les familles chargées par expo-font, une par graisse.
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
