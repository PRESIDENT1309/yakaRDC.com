// Système de design Yaka — palette, rayons, typographie
// Couleurs en valeurs fixes (identité de marque), pas de variables CSS adaptatives :
// l'app a son propre thème clair indépendant du thème système pour la V1.
// Le mode sombre est un chantier séparé, prévu mais pas construit dans cette passe.

export const colors = {
  lave: '#712B13',
  laveSoft: '#FAECE7',
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
} as const;

export const fonts = {
  // Chargée via @expo-google-fonts/playfair-display dans app/_layout.tsx
  display: 'PlayfairDisplay_400Regular_Italic',
} as const;
