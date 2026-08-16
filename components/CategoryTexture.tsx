import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Pattern, Line } from 'react-native-svg';
import { colors } from '../lib/theme';

interface Props {
  tone: string;
}

// Repli d'une tuile catégorie tant qu'aucune photo n'a été choisie depuis
// l'admin : un dégradé de la teinte de catégorie vers le noir de marque, plus
// un grain fin en diagonale — une composition typographique + texture,
// jamais une icône seule sur un aplat de couleur.
export default function CategoryTexture({ tone }: Props) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="tileTone" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={tone} stopOpacity={1} />
          <Stop offset="100%" stopColor={colors.nuit} stopOpacity={0.92} />
        </LinearGradient>
        <Pattern id="tileGrain" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <Line x1="0" y1="0" x2="0" y2="6" stroke={colors.cream} strokeOpacity={0.06} strokeWidth={0.6} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#tileTone)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#tileGrain)" />
    </Svg>
  );
}
