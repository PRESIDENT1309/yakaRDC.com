import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

interface Props {
  // 'bottom' : sombre en bas, transparent en haut — légende posée sur une photo.
  // 'top' : sombre en haut, transparent en bas — navigation flottante sur une photo.
  from?: 'top' | 'bottom';
  intensity?: number; // opacité maximale du voile, 0–1
}

// Voile en dégradé réel (pas un aplat rgba plat) pour poser du texte sur une
// photo tout en la laissant respirer. Un seul mécanisme, réutilisé partout où
// c'est nécessaire (hero, tuiles catégories, bande Fleuve Congo) au lieu de
// dégradés/overlays ad hoc par section.
export default function PhotoScrim({ from = 'bottom', intensity = 0.55 }: Props) {
  const [y1, y2] = from === 'bottom' ? ['0%', '100%'] : ['100%', '0%'];
  // Un identifiant par voile. Ils s'appelaient tous « scrim » : sur le web,
  // où le SVG vit dans la page, `url(#scrim)` désigne le premier dégradé du
  // document — deux voiles de sens ou d'intensité différents dessinaient le même.
  const id = `scrim${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={id} x1="0" y1={y1} x2="0" y2={y2}>
          <Stop offset="0%" stopColor={colors.nuit} stopOpacity={0} />
          <Stop offset="100%" stopColor={colors.nuit} stopOpacity={intensity} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
