// Système de design Yaka — palette, rayons, typographie
// Couleurs en valeurs fixes (identité de marque), pas de variables CSS adaptatives :
// l'app a son propre thème clair indépendant du thème système pour la V1.
// Le mode sombre est un chantier séparé, prévu mais pas construit dans cette passe.
//
// Direction artistique "Terre & Fleuve" (phase 1 — design system + homepage) :
// la palette d'origine est conservée telle quelle ; les tons ci-dessous
// (laveDeep, nuit, nuit2, surfaceSunken) ne font qu'approfondir les sections
// sombres et les scrims photo, qui utilisaient jusqu'ici des rgba(0,0,0,x)
// génériques dispersés dans plusieurs écrans (Welcome, Login).

export const colors = {
  lave: '#712B13',
  laveSoft: '#FAECE7',
  laveDeep: '#4A1B0C',
  fleuve: '#0F6E56',
  fleuveDark: '#085041',
  fleuveSoft: '#E1F5EE',
  or: '#854F0B',
  orSoft: '#FAEEDA',
  amber: '#FAC775',
  foret: '#1F4D3A',
  foretSoft: '#DCEEE3',
  cream: '#FAF8F4',
  white: '#FFFFFF',
  ink: '#2C2C2A',
  muted: '#5F5E5A',
  faint: '#888780',
  border: '#E5E3DA',
  borderStrong: '#D3D1C7',
  // Noir de marque (teinté lave), pour les scrims photo et sections sombres —
  // remplace les rgba(0,0,0,x) et hex ad hoc utilisés jusqu'ici.
  nuit: '#1A0A03',
  nuit2: '#2E0F05',
  // Crème légèrement plus soutenu, pour distinguer une bande éditoriale
  // du canevas principal sans sortir de la famille "cream".
  surfaceSunken: '#F2EDE3',
} as const;

export const categoryColors: Record<string, { accent: string; soft: string; label: string }> = {
  hotel: { accent: colors.lave, soft: colors.laveSoft, label: 'Hôtels' },
  furnished_house: { accent: colors.fleuveDark, soft: colors.fleuveSoft, label: 'Maisons meublées' },
  restaurant: { accent: colors.or, soft: colors.orSoft, label: 'Restaurants' },
  site: { accent: colors.foret, soft: colors.foretSoft, label: 'Sites touristiques' },
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// Points de rupture pour l'adaptation desktop/tablette/mobile (lib/responsive.ts).
export const breakpoints = {
  tablet: 768,
  desktop: 1024,
  // Largeur de contenu maximale sur grand écran — au-delà, on centre plutôt
  // que d'étirer la mise en page mobile indéfiniment.
  contentMax: 1200,
} as const;

export const fonts = {
  // Chargées via @expo-google-fonts/playfair-display et @expo-google-fonts/manrope
  // dans app/_layout.tsx.
  // Playfair Display — voix éditoriale : titres, noms d'établissements, citations.
  display: 'PlayfairDisplay_400Regular_Italic',
  displayMedium: 'PlayfairDisplay_500Medium',
  displaySemiBold: 'PlayfairDisplay_600SemiBold',
  displayBoldItalic: 'PlayfairDisplay_700Bold_Italic',
  // Manrope — voix d'interface : navigation, boutons, formulaires, données.
  sans: 'Manrope_400Regular',
  sansMedium: 'Manrope_500Medium',
  sansSemiBold: 'Manrope_600SemiBold',
  sansBold: 'Manrope_700Bold',
} as const;

// Échelle typographique — à composer avec `colors` selon le contexte
// (voir SectionHeading pour un exemple d'utilisation).
export const typography = {
  displayHero: { fontFamily: fonts.displayMedium, fontSize: 40, lineHeight: 44 },
  displayLg: { fontFamily: fonts.displayMedium, fontSize: 28, lineHeight: 33 },
  displayMd: { fontFamily: fonts.displayMedium, fontSize: 21, lineHeight: 26 },
  displaySm: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22 },
  overline: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 1.4 },
  bodyLg: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 12.5, lineHeight: 17 },
  button: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
} as const;
