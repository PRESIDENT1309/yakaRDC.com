import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Circle } from 'react-native-svg';
import { colors } from '../lib/theme';

interface Props {
  width: number;
  height: number;
  // 'hero' : lueur décalée, plus verticale — 'band' : lueur centrée, format bannière.
  variant?: 'hero' | 'band';
}

// Repli visuel de marque — horizon du fleuve au crépuscule, dans la palette
// "Terre & Fleuve" (nuit → lave). Utilisé tant qu'aucune photo réelle n'a été
// renseignée par l'admin (hero d'accueil, bande "Le Fleuve Congo"), et pensé
// pour être présentable en production : un dégradé, une lueur, trois horizons
// superposés — pas une collection de formes décoratives.
export default function RiverMotif({ width, height, variant = 'hero' }: Props) {
  const glowCx = variant === 'hero' ? width * 0.74 : width * 0.5;
  const glowCy = height * 0.3;
  const glowR = Math.max(width, height) * (variant === 'hero' ? 0.34 : 0.4);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="riverSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.nuit} />
          <Stop offset="45%" stopColor={colors.nuit2} />
          <Stop offset="78%" stopColor={colors.laveDeep} />
          <Stop offset="100%" stopColor={colors.lave} />
        </LinearGradient>
        <RadialGradient id="riverGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.amber} stopOpacity={0.5} />
          <Stop offset="100%" stopColor={colors.amber} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Rect x={0} y={0} width={width} height={height} fill="url(#riverSky)" />
      <Circle cx={glowCx} cy={glowCy} r={glowR} fill="url(#riverGlow)" />

      <Path
        d={`M0,${height * 0.66} Q${width * 0.25},${height * 0.58} ${width * 0.5},${height * 0.66} T${width},${height * 0.64} L${width},${height} L0,${height} Z`}
        fill={colors.nuit}
        opacity={0.45}
      />
      <Path
        d={`M0,${height * 0.79} Q${width * 0.3},${height * 0.71} ${width * 0.55},${height * 0.78} T${width},${height * 0.75} L${width},${height} L0,${height} Z`}
        fill={colors.nuit}
        opacity={0.72}
      />
      <Path
        d={`M0,${height * 0.9} Q${width * 0.35},${height * 0.84} ${width * 0.6},${height * 0.89} T${width},${height * 0.87} L${width},${height} L0,${height} Z`}
        fill={colors.nuit}
      />
    </Svg>
  );
}
