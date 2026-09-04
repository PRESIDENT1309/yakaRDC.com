import type { ReactNode } from 'react';
import { Animated } from 'react-native';
import { useEntreeListe } from '../lib/motion';

/**
 * Enveloppe d'entrée pour un élément de liste.
 *
 * Existe parce qu'un crochet ne peut pas être appelé depuis le `renderItem`
 * d'une `FlatList` : il faut un composant pour porter l'état d'animation de
 * chaque ligne.
 *
 *   renderItem={({ item, index }) => (
 *     <EntreeListe index={index}><ListingCard … /></EntreeListe>
 *   )}
 */
export default function EntreeListe({ index, children }: { index: number; children: ReactNode }) {
  const style = useEntreeListe(index);
  return <Animated.View style={style}>{children}</Animated.View>;
}
