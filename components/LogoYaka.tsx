import Svg, { Rect, Circle, Polygon, Path } from 'react-native-svg';
import { colors } from '../lib/theme';

/**
 * Le logo YakaRDC : un soleil ambre derrière un relief, sur une plaque lave.
 *
 * Il était redessiné à la main dans cinq fichiers, et il avait dérivé — ce que
 * la recopie finit toujours par produire :
 *
 *  - cinq tailles (22, 26, 28, 40, 48), ce qui est normal et reste réglable ;
 *  - deux rayons de plaque, 20 et 26, sans raison apparente ;
 *  - une plaque peinte en `#993C1D` au lieu du jeton `colors.lave` (#712B13),
 *    soit un brun sensiblement plus clair sur un seul écran ;
 *  - une copie sans plaque du tout, posée à même le fond.
 *
 * La couleur divergente a été ramenée sur `colors.lave` : la plaque n'est donc
 * plus réglable, puisque plus rien ne la règle. Les deux rayons subsistent,
 * faute d'une valeur de charte qui tranche — c'est le dernier écart connu.
 *
 * Les autres différences restent portées par des props explicites aux points
 * d'appel : rassembler le dessin ne doit pas décider à la place du produit.
 */

type Props = {
  /** Côté du logo en points. Le dessin est vectoriel, il ne se dégrade pas. */
  size: number;
  /** Plaque de fond. `false` pose le motif à même le support. */
  plate?: boolean;
  /** Rayon des angles de la plaque, dans le repère 120×120 du dessin. */
  plateRadius?: number;
};

export default function LogoYaka({
  size,
  plate = true,
  plateRadius = 26,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {plate && <Rect width="120" height="120" rx={plateRadius} fill={colors.lave} />}
      <Circle cx="60" cy="48" r="22" fill={colors.amber} />
      <Polygon points="34,80 60,38 86,80" fill={colors.lave} />
      <Path
        d="M28,96 Q60,88 92,96"
        stroke={colors.amber}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}
