import Svg, { Path, Rect, Circle, Polygon, Line } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

// Icônes dessinées pour YakaRDC, en remplacement des emoji.
// Chacune s'affiche dans une pastille colorée, à la manière des sections
// de l'espace partenaire.

interface IconProps {
  size?: number;
  color?: string;
}

export function PhotoIcon({ size = 14, color = colors.lave }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x="2" y="4" width="16" height="12" rx="2.5" fill="none" stroke={color} strokeWidth={1.6} />
      <Circle cx="6.5" cy="8.5" r="1.6" fill={color} />
      <Path d="M2.5,14 L7,9.5 L10.5,12.5 L13.5,10 L17.5,14" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

export function InfoIcon({ size = 14, color = colors.lave }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x="4" y="2.5" width="12" height="15" rx="2" fill="none" stroke={color} strokeWidth={1.6} />
      <Line x1="7" y1="7" x2="13" y2="7" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1="7" y1="10" x2="13" y2="10" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1="7" y1="13" x2="10.5" y2="13" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function ContactIcon({ size = 14, color = colors.lave }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path
        d="M6,3 Q4,3 4,5 v1.2 Q4,14 12,17 h1.2 Q15,17 15,15 v-2 l-4,-2 -1.6,2 Q6.6,12.4 5.6,9 L7.6,7.4 Z"
        fill={color}
      />
    </Svg>
  );
}

export function LocationIcon({ size = 14, color = colors.lave }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path
        d="M10,2 C6.7,2 4,4.7 4,8 c0,4.5 6,10 6,10 s6,-5.5 6,-10 c0,-3.3 -2.7,-6 -6,-6 z"
        fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round"
      />
      <Circle cx="10" cy="8" r="2.2" fill={color} />
    </Svg>
  );
}

export function AmenityIcon({ size = 14, color = colors.lave }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Polygon points="10,2.5 17.5,10 10,17.5 2.5,10" fill="none" stroke={color} strokeWidth={1.5} />
      <Path d="M6.8,10 L9,12.2 L13.2,7.6" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PromoIcon({ size = 14, color = colors.lave }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path
        d="M10.5,2.5 H16 a1.5,1.5 0 0,1 1.5,1.5 v5.5 L9,18 a1.4,1.4 0 0,1 -2,0 L2,13 a1.4,1.4 0 0,1 0,-2 Z"
        fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round"
      />
      <Circle cx="13.6" cy="6.4" r="1.5" fill={color} />
    </Svg>
  );
}

export function PriceIcon({ size = 14, color = colors.lave }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx="10" cy="10" r="7.5" fill="none" stroke={color} strokeWidth={1.6} />
      <Path
        d="M12.2,7.4 Q11,6 9.6,6 Q7.6,6 7.6,7.6 Q7.6,9 9.8,9.4 Q12.4,9.9 12.4,11.6 Q12.4,13.4 10.2,13.4 Q8.6,13.4 7.6,12"
        fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"
      />
      <Line x1="10" y1="4.6" x2="10" y2="15.4" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function MenuIcon({ size = 14, color = colors.lave }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx="10" cy="10.5" r="5.5" fill="none" stroke={color} strokeWidth={1.6} />
      <Circle cx="10" cy="10.5" r="2.2" fill={color} />
      <Line x1="3" y1="3" x2="3" y2="17" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1="17" y1="3" x2="17" y2="17" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function TicketIcon({ size = 14, color = colors.lave }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path
        d="M2.5,6 h15 v3 a1.6,1.6 0 0,0 0,3.2 v2.8 h-15 v-2.8 a1.6,1.6 0 0,0 0,-3.2 z"
        fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"
      />
      <Line x1="8" y1="7.5" x2="8" y2="13.5" stroke={color} strokeWidth={1.3} strokeDasharray="1.6,1.6" />
    </Svg>
  );
}

// Pastille colorée qui entoure l'icône, comme dans les titres de section
export function IconBadge({
  children,
  bg = colors.laveSoft,
  size = 26,
}: {
  children: React.ReactNode;
  bg?: string;
  size?: number;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg, width: size, height: size, borderRadius: size / 3.2 }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});