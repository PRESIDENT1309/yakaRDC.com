import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Circle, Pattern, Line } from 'react-native-svg';
import { colors } from '../lib/theme';

interface Props {
  width: number;
  height: number;
  // 'hero' : lueur décalée — 'band' : lueur centrée, format bannière.
  variant?: 'hero' | 'band';
}

// Repli visuel de marque — un dégradé de crépuscule, un grain fin, une seule
// ligne d'horizon. Volontairement retenu : ce n'est pas une illustration à
// regarder, c'est une texture de fond pendant qu'aucune photo n'est configurée
// (hero d'accueil, bande "Le Fleuve Congo").
export default function RiverMotif({ width, height, variant = 'hero' }: Props) {
  const glowCx = variant === 'hero' ? width * 0.72 : width * 0.5;
  const glowCy = height * 0.26;
  const glowR = Math.max(width, height) * (variant === 'hero' ? 0.3 : 0.36);
  const horizonY = height * 0.84;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="riverSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.nuit} />
          <Stop offset="55%" stopColor={colors.nuit2} />
          <Stop offset="100%" stopColor={colors.laveDeep} />
        </LinearGradient>
        <RadialGradient id="riverGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.amber} stopOpacity={0.32} />
          <Stop offset="100%" stopColor={colors.amber} stopOpacity={0} />
        </RadialGradient>
        <Pattern id="riverGrain" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <Line x1="0" y1="0" x2="0" y2="6" stroke={colors.cream} strokeOpacity={0.045} strokeWidth={0.6} />
        </Pattern>
      </Defs>

      <Rect x={0} y={0} width={width} height={height} fill="url(#riverSky)" />
      <Circle cx={glowCx} cy={glowCy} r={glowR} fill="url(#riverGlow)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#riverGrain)" />

      {/* Une seule ligne d'horizon — le motif fluvial, très discret */}
      <Path
        d={`M0,${horizonY} Q${width * 0.5},${horizonY - height * 0.035} ${width},${horizonY - height * 0.01}`}
        stroke={colors.amber}
        strokeWidth={1}
        strokeOpacity={0.4}
        fill="none"
      />
    </Svg>
  );
}
