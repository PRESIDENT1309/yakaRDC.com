import Svg, {
  Defs, LinearGradient, RadialGradient, Stop,
  Rect, Circle, Polygon, Ellipse, Path, ClipPath,
} from 'react-native-svg';

// Illustration de secours (soleil + montagnes + forêt + fleuve) utilisée
// tant qu'aucune image personnalisée n'a été définie par l'admin.
export default function LandscapeIllustration({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 360 700" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#3D1408" />
          <Stop offset="45%" stopColor="#6B2410" />
          <Stop offset="75%" stopColor="#A8451C" />
          <Stop offset="100%" stopColor="#D4762E" />
        </LinearGradient>
        <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFE8B8" />
          <Stop offset="60%" stopColor="#FAC775" />
          <Stop offset="100%" stopColor="#FAC775" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="0" y="0" width="360" height="700" fill="url(#sky)" />

      <Circle cx="180" cy="190" r="95" fill="url(#sunGlow)" />
      <Circle cx="180" cy="190" r="36" fill="#FFEDC7" />

      <Path d="M110,140 Q116,134 122,140 Q128,134 134,140" stroke="#3D1408" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} />
      <Path d="M240,110 Q245,105 250,110 Q255,105 260,110" stroke="#3D1408" strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.5} />

      <Polygon points="0,420 90,290 170,420" fill="#4A1A0C" opacity={0.55} />
      <Polygon points="140,420 230,250 320,420" fill="#3D1408" opacity={0.6} />
      <Polygon points="0,460 110,330 210,460" fill="#3D1408" opacity={0.8} />
      <Polygon points="170,460 260,300 360,460" fill="#2E0F05" opacity={0.85} />

      <Polygon points="0,500 60,420 110,500" fill="#2E0F05" />
      <Polygon points="80,500 130,410 180,500" fill="#240B03" />
      <Polygon points="150,500 210,405 270,500" fill="#2E0F05" />
      <Polygon points="240,500 300,415 360,500" fill="#240B03" />

      <Rect x="0" y="500" width="360" height="130" fill="#1A0803" />
      <Ellipse cx="180" cy="530" rx="70" ry="10" fill="#FAC775" opacity={0.3} />
      <Ellipse cx="180" cy="548" rx="50" ry="6" fill="#FAC775" opacity={0.18} />
      <Ellipse cx="180" cy="562" rx="30" ry="4" fill="#FAC775" opacity={0.1} />

      <Path d="M0,610 Q120,595 180,602 Q250,609 360,595 L360,700 L0,700 Z" fill="#170601" />
    </Svg>
  );
}