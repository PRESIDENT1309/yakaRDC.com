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
  // Assombri depuis #888780, qui donnait 3,40 de contraste sur cream et 3,61
  // sur blanc — sous le seuil de 4,5 exigé pour du texte courant. Il porte
  // pourtant 170 usages : légendes, indications de saisie, prix secondaires.
  // À 4,73 et 5,02, ces textes redeviennent lisibles en plein soleil sur un
  // téléphone d'entrée de gamme, et  reste distinctement plus sombre :
  // la hiérarchie à trois niveaux tient toujours.
  faint: '#726F67',
  border: '#E5E3DA',
  borderStrong: '#D3D1C7',
  // Noir de marque (teinté lave), pour les scrims photo et sections sombres —
  // remplace les rgba(0,0,0,x) et hex ad hoc utilisés jusqu'ici.
  nuit: '#1A0A03',
  nuit2: '#2E0F05',
  // Crème légèrement plus soutenu, pour distinguer une bande éditoriale
  // du canevas principal sans sortir de la famille "cream".
  surfaceSunken: '#F2EDE3',

  // Jetons sémantiques (statuts, alertes) — alignés sur la palette "Terre &
  // Fleuve" existante plutôt que sur un rouge/vert/jaune générique.
  // success reprend exactement foret/foretSoft (déjà la couleur "site
  // touristique validé" de l'app) ; warning reprend or/orSoft (déjà utilisé
  // pour les notes/étoiles). danger est la seule teinte réellement nouvelle
  // ici : un rouge terracotta de la même famille chaude que lave, mais
  // distinct pour ne pas se confondre avec les états actifs/primaires.
  success: '#1F4D3A',
  successSoft: '#DCEEE3',
  warning: '#854F0B',
  warningSoft: '#FAEEDA',
  // Aligné sur #C0392B, déjà écrit en dur dans 20 fichiers. Adopter la valeur
  // en usage plutôt que la mienne évite un changement visuel dans toute
  // l'application pour un gain de contraste marginal — les deux passent AA.
  danger: '#C0392B',
  dangerSoft: '#FBEAE5',

  // ── Bordures assorties aux fonds `…Soft` ────────────────────────────────
  // Chaque fond doux appelle un filet de la même famille. Le système ne les
  // avait jamais nommés, alors chaque écran les a réécrits en dur : 15 usages
  // répartis sur admin/ et pro/, tous avec la même valeur. Ils sont repris ici
  // tels quels — les nommer ne change rien à l'écran, seulement à qui décide.
  // Note : leur contraste sur leur propre fond est faible (1,1 à 1,5). Ce sont
  // des filets décoratifs, jamais porteurs d'information ; les renforcer serait
  // un choix visuel à part, pas une unification.
  laveBorder: '#F5C4B3',
  successBorder: '#A8D5B5',
  warningBorder: '#F0C070',
  dangerBorder: '#FFD5D5',

  // ── Surfaces sombres et texte posé dessus ───────────────────────────────
  // `nuit` et `nuit2` couvraient les fonds sombres, mais rien ne nommait le
  // texte qu'on y pose. D'où trois gris inventés sur place dans admin/ et
  // (auth)/. Un seul suffit : il tient AA sur les deux fonds (6,9 et 6,4).
  nuit3: '#3D1408',        // brun de marque, fond plein de welcome et login
  chrome: '#1F1A16',       // gris très sombre, barre latérale de l'admin
  onDarkMuted: '#A8A39A',  // texte secondaire sur nuit3 ou chrome
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

  // ── Graduations intermédiaires ──────────────────────────────────────────
  // Nommées par leur valeur, faute de rôle sémantique : ce ne sont pas des
  // intentions de design, ce sont les pas que le produit emploie réellement.
  //
  // Les nommer ne rend pas le dessin meilleur — cela ferme l'ensemble. Tant
  // que la seule façon d'écrire 10 était `borderRadius: 10`, rien ne
  // distinguait une valeur voulue d'une valeur tapée au hasard. Désormais,
  // écrire 13 se voit : aucun jeton ne le porte.
  //
  // Constat au passage : `v10` est le rayon le plus fréquent du produit (62
  // occurrences), devant `sm` et `md`. L'échelle sémantique ne décrivait donc
  // même pas son propre défaut le plus courant.
  v4: 4,
  v6: 6,
  v10: 10,
  v14: 14,
  v16: 16,
} as const;

// Rapports d'image — direction photographique.
//
// L'audit du 03/09/2026 n'a trouvé que cinq `aspectRatio` dans toute
// l'application, dont trois pour des aperçus d'administration. Les photos de
// contenu, elles, étaient posées dans des boîtes de hauteur fixe : la carte
// d'établissement imposait 130 px quelle que soit sa largeur, si bien que le
// recadrage changeait d'un écran à l'autre sans que personne l'ait décidé.
//
// Trois rapports suffisent, et trois seulement : au-delà, la contrainte cesse
// d'en être une. Ils valent pour les photos de contenu ; les vignettes carrées
// d'administration gardent leur dimension fixe, qui n'est pas une photo mais
// une pastille.
export const ratios = {
  carte: 3 / 2,     // photo de carte : assez haute pour situer un lieu
  bandeau: 16 / 9,  // bande pleine largeur, hero
  carre: 1,         // vignette, avatar
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  // Gouttière d'écran — 18, officialisée d'après la Homepage (écran de
  // référence), qui l'exprimait jusqu'ici en `spacing.md + 2`. Arithmétiquement
  // étrangère à l'échelle par doublement ci-dessus, mais c'est la valeur
  // réellement en place sur 15 fichiers : la nommer vaut mieux que la laisser
  // se propager en littéral. Ne pas l'utiliser pour autre chose qu'une
  // gouttière horizontale d'écran.
  gutter: 18,

  // ── Graduations intermédiaires ──────────────────────────────────────────
  // Même principe que pour `radii`, et même constat, en plus net : l'échelle
  // ci-dessus progresse par doublement (4, 8, 16, 24, 32…) alors que le
  // produit travaille sur une grille de 2 px. Les six pas ci-dessous couvrent
  // 545 écarts écrits à la main — soit la majorité de ce qui restait.
  //
  // Ils ne portent pas de nom sémantique parce qu'ils n'ont pas de rôle : `v12`
  // n'est pas « l'espacement de carte », c'est douze points. Prétendre le
  // contraire inventerait une intention qui n'existe pas dans le code.
  //
  // Ce que ces jetons apportent n'est donc pas du sens mais une frontière :
  // l'ensemble des écarts autorisés devient énumérable. C'est la condition
  // pour, un jour, le resserrer — un ensemble ouvert ne se resserre pas.
  //
  // Restent volontairement sans jeton les valeurs impaires (3, 5, 7, 9, 11 —
  // une centaine d'occurrences). Elles sortent de la grille de 2 px : les
  // nommer les légitimerait, alors que leur écriture littérale signale
  // justement qu'elles sont hors système.
  v2: 2,
  v6: 6,
  v10: 10,
  v12: 12,
  v14: 14,
  v20: 20,
} as const;

// Points de rupture pour l'adaptation desktop/tablette/mobile (lib/responsive.ts).
export const breakpoints = {
  tablet: 768,
  desktop: 1024,
  // Largeur de contenu maximale sur grand écran — au-delà, on centre plutôt
  // que d'étirer la mise en page mobile indéfiniment.
  contentMax: 1200,
  // Largeur maximale d'un formulaire ou d'un texte suivi. `contentMax` convient
  // à une grille de cartes ; appliqué à un champ de saisie, il donne un champ de
  // mot de passe de 1200 px, que l'œil ne sait plus parcourir. 480 correspond à
  // la mesure de lecture confortable (environ 65 signes) et à la largeur d'un
  // formulaire à une colonne.
  formMax: 480,
  // Deux largeurs intermédiaires, qui ne sont pas inventées : ce sont celles
  // déjà en place côté admin, où 700 revient quatre fois et 900 une. Les nommer
  // permet aux écrans pro — qui n'avaient aucune limite et s'étiraient d'un
  // bord à l'autre — de rejoindre la même échelle plutôt que d'en créer une.
  panelMax: 700,      // liste ou panneau à une colonne
  dashboardMax: 900,  // tableau de bord à plusieurs colonnes
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

// Échelle typographique — source de vérité unique pour toute l'application.
// (voir SectionHeading pour un exemple d'utilisation).
//
// Harmonisation (généralisation post-Homepage) : les entrées ci-dessous sous
// "styles homepage généralisés" reprennent exactement les valeurs littérales
// qui vivaient jusqu'ici dans app/(tabs)/index.tsx — mêmes graisses, mêmes
// tailles, mêmes interlignages (ou absence d'interlignage) qu'avant. Aucune
// n'a été ajustée pour "faire joli" : le but de cette passe est zéro
// changement visuel, seulement un nommage propre.
export const typography = {
  // Échelle display existante
  displayHero: { fontFamily: fonts.displayMedium, fontSize: 40, lineHeight: 44 },
  displayLg: { fontFamily: fonts.displayMedium, fontSize: 28, lineHeight: 33 },
  displayMd: { fontFamily: fonts.displayMedium, fontSize: 21, lineHeight: 26 },
  // Interligne corrigé à 25 (au lieu de 22) pour refléter la vraie valeur
  // utilisée par la citation de la bande éditoriale — cette entrée n'était
  // utilisée nulle part ailleurs, la correction ne change donc rien de plus.
  displaySm: { fontFamily: fonts.display, fontSize: 17, lineHeight: 25 },

  // Échelle sans/overline existante
  overline: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 1.4 },
  bodyLg: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 12.5, lineHeight: 17 },
  button: { fontFamily: fonts.sansSemiBold, fontSize: 15 },

  // Styles homepage généralisés — noms sémantiques (par rôle), pas par taille
  brand: { fontFamily: fonts.displayMedium, fontSize: 21 }, // logo / nom de marque
  heroTitle: { fontFamily: fonts.displayMedium }, // titre du hero — taille responsive gérée à l'appel
  tileTitle: { fontFamily: fonts.displayMedium, fontSize: 19 }, // libellé de tuile catégorie
  cardTitle: { fontFamily: fonts.displayMedium, fontSize: 15.5 }, // nom d'établissement (carte)
  editorialTitle: { fontFamily: fonts.displayBoldItalic, fontSize: 27, lineHeight: 33 }, // moment fort (ex. bande Fleuve Congo)
  overlineSm: { fontFamily: fonts.sansSemiBold, fontSize: 10.5, letterSpacing: 1 }, // kicker sur photo (tuile)
  overlineXs: { fontFamily: fonts.sansSemiBold, fontSize: 10, letterSpacing: 0.5 }, // étiquette de catégorie (carte)
  badgeSm: { fontFamily: fonts.sansSemiBold, fontSize: 9.5 }, // texte de pastille ("Nouveau")
  pillLabel: { fontFamily: fonts.sansMedium, fontSize: 13 }, // libellé de pastille (commune, filtre)
  sheetTitle: { fontFamily: fonts.displayMedium, fontSize: 17 }, // titre de bottom-sheet
  sheetOption: { fontFamily: fonts.sansMedium, fontSize: 15 }, // option de bottom-sheet

  // Graisses SemiBold/Bold — chargées mais pas encore consommées par la
  // Homepage (qui doit rester pixel-identique). Prêtes pour Recherche et
  // les écrans suivants, là où une hiérarchie plus marquée sera utile.
  displayStrong: { fontFamily: fonts.displaySemiBold, fontSize: 24, lineHeight: 29 },
  buttonStrong: { fontFamily: fonts.sansBold, fontSize: 15 },

  // ── Voix d'interface : les rôles qui manquaient ─────────────────────────
  // Constat mesuré : 359 styles sur 370 écrivent une taille en dur sans
  // `fontFamily`. Ils ne rendent donc PAS en Manrope — ils retombent sur la
  // police du système. Vérifié dans le DOM : sur le seul écran Profil, 23
  // éléments s'affichent en -apple-system à côté de textes en Manrope.
  //
  // La cause n'est pas la négligence : l'échelle ci-dessus fusionne taille,
  // graisse et police sous un seul nom. Elle sait dire « caption » (Medium
  // 12,5) mais pas « 13 px en Regular ». Les écrans admin et pro, qui ont
  // besoin de texte courant dense, n'avaient donc rien à quoi se raccrocher
  // et ont écrit leurs tailles à la main.
  //
  // Ces cinq entrées comblent ce manque. Elles ne sont pas décoratives : chaque
  // taille reprend une signature réellement présente dans le code.
  // Règle de reprise : aucune taille existante ne se déplace de plus de 0,5 px.
  // Seule exception, assumée — les textes écrits sous 10 px (jusqu'à 8,5)
  // remontent à 11. Leur petitesse était un défaut relevé par l'audit, pas une
  // intention de dessin.
  titleLg: { fontFamily: fonts.sansSemiBold, fontSize: 22 },              // titre d'écran (admin, pro)
  titleMd: { fontFamily: fonts.sansSemiBold, fontSize: 19 },              // valeur de statistique, sous-titre
  titleSm: { fontFamily: fonts.sansSemiBold, fontSize: 16 },              // titre de carte ou de fenêtre
  labelMd: { fontFamily: fonts.sansMedium, fontSize: 14 },                // libellé de formulaire, action secondaire
  captionMd: { fontFamily: fonts.sansMedium, fontSize: 11 },              // étiquette dense en demi-gras
  bodySm: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19 },       // texte courant dense (listes admin)
  bodyXs: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17 },       // texte courant très dense
  captionSm: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 15 },    // légende, métadonnée
} as const;
