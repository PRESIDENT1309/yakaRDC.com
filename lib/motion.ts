import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, AccessibilityInfo } from 'react-native';

/**
 * Jetons de mouvement — durées et courbes, au même titre que les couleurs.
 *
 * L'audit du 03/09/2026 a compté quatre animations réparties dans un seul
 * fichier sur soixante-sept. Le manque n'était pas technique : il n'existait
 * aucune décision commune sur la vitesse à laquelle cette application bouge.
 *
 * ── Pourquoi l'API `Animated` de React Native et non Reanimated ────────────
 *
 * Reanimated 4 est déclaré en dépendance et offre une API plus confortable.
 * Il était cependant élagué à la compilation, faute d'être importé : s'en
 * servir a fait passer le paquet web de 3,9 à 4,6 Mo, soit +700 Ko pour un
 * retour à l'appui et une cascade d'entrée. Sur les réseaux visés par
 * l'application, ce prix ne se justifiait pas — d'autant que l'API `Animated`,
 * déjà employée par le carrousel de l'accueil, suffit largement à ces deux
 * mouvements. « Déjà installé » n'est pas « gratuit ».
 *
 * Conséquence assumée : pas de `useReducedMotion` fourni par la bibliothèque.
 * On lit donc le réglage système via `AccessibilityInfo`, ce que fait déjà
 * `components/Skeleton.tsx`, et ce que ce fichier centralise désormais.
 *
 * ── Principe d'emploi ──────────────────────────────────────────────────────
 *
 * Le mouvement doit porter une information : « votre geste a été reçu »,
 * « ceci vient d'arriver », ou « ces deux écrans sont liés ». Une animation
 * qui ne dit rien de cela est un ornement, et l'ornement animé est ce qui
 * fait paraître une interface bricolée plutôt que soignée.
 *
 * Explicitement écartés : parallaxe, boucles d'ambiance, révélations au
 * défilement, rebonds décoratifs.
 */

export const duree = {
  /** Retour à l'appui. Sous 100 ms le geste paraît ignoré ; au-delà de 150, mou. */
  immediat: 120,
  /** Changement d'état visible : bascule, apparition d'image, ouverture. */
  standard: 220,
  /** Entrée en scène d'un contenu qui vient d'arriver. */
  entree: 380,
} as const;

export const courbe = {
  /** Ce qui arrive : rapide d'abord, puis se pose. Le défaut. */
  sortie: Easing.out(Easing.quad),
  /** Ce qui va et revient : symétrique. Pour les pulsations et allers-retours. */
  symetrique: Easing.inOut(Easing.quad),
} as const;

/**
 * Échelle appliquée à un élément pressé. 0,98 est délibérément discret : à
 * 0,95 l'effet devient un jouet, à 0,99 il ne se voit plus.
 */
export const ECHELLE_APPUI = 0.98;

/**
 * Nombre d'éléments qui participent à la cascade d'entrée.
 *
 * Au-delà, le retard cesserait de se lire comme un enchaînement pour devenir
 * une attente : le douzième résultat d'une recherche apparaîtrait une demi-
 * seconde après le premier, sans que ce délai n'apprenne quoi que ce soit.
 */
const CASCADE_MAX = 5;
const PAS_CASCADE = 45;
/** Hauteur dont un élément monte en entrant. Assez pour se voir, pas pour sauter. */
const MONTEE_ENTREE = 12;

/**
 * Réglage système « réduire les animations ».
 *
 * Lu une fois au montage puis suivi : un utilisateur peut l'activer pendant
 * que l'application tourne, et une interface qui continuerait de bouger après
 * coup contredirait le réglage qu'il vient de poser.
 */
export function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(false);

  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (vivant) setReduit(v); });
    const abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduit);
    return () => { vivant = false; abonnement.remove(); };
  }, []);

  return reduit;
}

/**
 * Retour à l'appui : l'élément se rétracte légèrement sous le doigt, puis
 * reprend sa taille. C'est le mouvement le plus utile de l'application —
 * celui qui dit « votre geste a été reçu » avant même que l'écran ne change.
 * Sur une connexion lente, c'est parfois le seul signe pendant une seconde.
 *
 *   const appui = useAppuiAnime();
 *   <Animated.View style={[styles.base, appui.style]} {...appui.gestes} />
 */
export function useAppuiAnime() {
  const echelle = useRef(new Animated.Value(1)).current;
  const reduit = useMouvementReduit();

  const versEchelle = (cible: number) => {
    if (reduit) return;
    Animated.timing(echelle, {
      toValue: cible,
      duration: duree.immediat,
      easing: courbe.sortie,
      useNativeDriver: true,
    }).start();
  };

  return {
    style: { transform: [{ scale: echelle }] },
    gestes: {
      onPressIn: () => versEchelle(ECHELLE_APPUI),
      onPressOut: () => versEchelle(1),
    },
  };
}

/**
 * Entrée en scène d'un élément de liste : il monte de quelques points en
 * apparaissant, avec un léger retard selon son rang. Le mouvement dit « ces
 * contenus viennent d'arriver », ce qu'une liste qui surgit d'un coup ne dit
 * pas.
 *
 * Retourne un style à poser sur un `Animated.View`. Voir `components/
 * EntreeListe.tsx`, qui l'enveloppe — un crochet ne peut pas être appelé
 * depuis le `renderItem` d'une liste.
 */
export function useEntreeListe(index: number) {
  const reduit = useMouvementReduit();
  const progression = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduit) {
      progression.setValue(1);
      return;
    }
    const animation = Animated.timing(progression, {
      toValue: 1,
      duration: duree.entree,
      delay: Math.min(index, CASCADE_MAX) * PAS_CASCADE,
      easing: courbe.sortie,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduit, index, progression]);

  return {
    opacity: progression,
    transform: [{
      translateY: progression.interpolate({
        inputRange: [0, 1],
        outputRange: [MONTEE_ENTREE, 0],
      }),
    }],
  };
}
