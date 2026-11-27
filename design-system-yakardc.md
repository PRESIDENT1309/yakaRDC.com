# Design System YakaRDC

Référence unique de conformité pour l'ensemble de l'application.

> **Origine** — Extraction du système réel présent dans la Homepage « Terre & Fleuve », réalisée le **16/08/2026** et publiée alors comme artifact.
> **Mise à jour** — **19/08/2026** : report des passes menées depuis (Fondations DS, `Sheet`, Fiche établissement, Réservations, Planner). L'audit d'origine décrivait un état antérieur à ces passes ; une dizaine de constats étaient devenus faux et sont corrigés ici.
> **Mise à jour** — **27/11/2026** : passe « design system, accessibilité, responsive » issue de l'audit `reports.md` (§6 à §8). Le document contredisait le code sur cinq points (valeur de `danger`, nombre de rayons, inventaire des composants, gouttière, `SectionIcons`) : il est réaligné ici. Nouvelle section **13 · Accessibilité**.
> **Statut** — En attente de relecture et de commit. La passe du 27/11 est compilée (`tsc`) ; son rendu reste à relire écran par écran.

Chaque section porte un statut :
**[FAIT]** appliqué et vérifié · **[PARTIEL]** appliqué sur certains écrans seulement · **[À FAIRE]** non entamé · **[À TRANCHER]** décision en attente.

---

## Convention de statut par écran

| Écran | Design system appliqué |
|---|---|
| Homepage (`app/(tabs)/index.tsx`) | **[FAIT]** — écran de référence, ne pas modifier sans raison |
| Recherche (`app/(tabs)/search.tsx`) | **[FAIT]** |
| Réservations (`app/(tabs)/bookings.tsx`) | **[FAIT]** |
| Planner (`app/(tabs)/planner.tsx`) | **[FAIT]** |
| Fiche établissement (`app/listing/[id].tsx`) | **[FAIT — 27/11]** — restent des blancs translucides sans jeton (voir §01) |
| Profil (`app/(tabs)/profile.tsx`) | **[FAIT — 27/11]** |
| Connexion et compte (`(auth)/*`, mots de passe, `edit-profile`) | **[FAIT — 27/11]** — le bouton ambre de la connexion reste local (voir §05) |
| Partner (`become-partner.tsx`, `pro/*`) | **[FAIT — 27/11]** |
| Admin (`admin/*`) | **[FAIT — 27/11]** |

---

## 01 · Couleurs **[FAIT]**

Les tokens vivent dans `lib/theme.ts`. Le problème d'origine n'était pas leur définition mais leur usage : couleurs répétées en littéral plutôt qu'importées, et trois rôles sémantiques absents.

### Palette

| Rôle | Token | Hex |
|---|---|---|
| Brand primary | `lave` | `#712B13` |
| Brand deep | `laveDeep` | `#4A1B0C` |
| Secondary | `fleuve` / `fleuveDark` / `fleuveSoft` | `#0F6E56` / `#085041` / `#E1F5EE` |
| Accent | `or` / `orSoft` / `amber` | `#854F0B` / `#FAEEDA` / `#FAC775` |
| Forêt | `foret` / `foretSoft` | `#1F4D3A` / `#DCEEE3` |
| Fonds | `cream`, `white`, `surfaceSunken`, `nuit`, `nuit2` | — |
| Texte | `ink`, `muted`, `faint` | — |
| Bordures | `border`, `borderStrong` | — |

### Jetons sémantiques **[FAIT — 19/08]**

Les trois rôles manquants ont été créés lors de la passe Fondations DS :

| Rôle | Token | Hex | Origine |
|---|---|---|---|
| Succès | `success` / `successSoft` | `#1F4D3A` / `#DCEEE3` | alias de `foret` / `foretSoft` |
| Alerte | `warning` / `warningSoft` | `#854F0B` / `#FAEEDA` | alias de `or` / `orSoft` |
| Danger | `danger` / `dangerSoft` | `#C0392B` / `#FBEAE5` | valeur déjà en usage dans le code |

> **Correction du document d'origine.** L'audit du 16/08 préconisait un token nommé **`error`**. Le token créé s'appelle **`danger`** — le nom retenu à l'implémentation. **Ne pas créer de token `error`** : il ferait doublon. Toute consigne renvoyant à `error` doit se lire `danger`.

> **Correction du 27/11.** Ce document fixait `danger` à `#A23B2B`, plus terreux. Le code, lui, a retenu **`#C0392B`** — la valeur déjà écrite en dur dans une vingtaine de fichiers — pour éviter un changement visuel général (`lib/theme.ts`). Les deux passent AA. **C'est le code qui fait foi** ; revenir à `#A23B2B` reste possible, mais c'est une décision de design, pas une retokénisation.

### Jetons ajoutés le 27/11

| Rôle | Token | Valeur | Remplace |
|---|---|---|---|
| Contour d'un champ de saisie | `borderField` | `#8F8B82` | `border` sur les champs : 1,29:1 sur blanc, sous le seuil de 3:1 (WCAG 1.4.11) |
| Voile de modale | `overlay` | `rgba(26,10,3,0.45)` | quatre variantes de `rgba(0,0,0,…)` |
| Ombre d'un texte posé sur une photo | `ombreTexte` | `rgba(26,10,3,0.45)` | `rgba(0,0,0,0.35…0.5)` |
| Texte crème atténué sur fond de marque | `onBrandMuted` | `rgba(250,248,244,0.78)` | une quinzaine de `rgba(250,248,244,0.7…0.85)` |
| Erreur sur fond sombre | `dangerOnDark` | `#FFB4A8` | littéral de la connexion |
| Soleil du logo animé | `soleil` / `braise` | `#F0A042` / `#D85A30` | palette cachée de `culture.tsx` et `SplashLoader.tsx` |

### Littéraux restants

État au 27/11 : plus aucun `shadowColor: '#000'`, plus de voile ni de crème atténué en littéral, plus de palette cachée. Restent, **faute de jeton** :

| Littéral | Où | Pourquoi il reste |
|---|---|---|
| `rgba(255,255,255,0.1 … 0.3)` | pastilles posées sur une photo ou un fond sombre (`index`, `listing/[id]`, `pro/establishment`, `pro/more`, `admin/_layout`) | quatre opacités différentes : un jeton unique changerait le rendu. À trancher : une ou deux valeurs officielles |
| `rgba(250,248,244,0.5)` et `0.22` | bordure du profil, piste de jauge du planning | même raison |
| `rgba(0,0,0,0.6)` | pastille de numéro, `admin/appearance.tsx` | idem |
| `#5E2410`, `#8A4426` | `SplashLoader.tsx` | bruns du dessin, entre `lave` et `laveDeep` |
| couleurs du logo Google | `login.tsx` | marque tierce |

**Sans correspondance exacte — ne pas forcer d'approximation** : `#F5F4F0` (fonds neutres, `surfaceSunken` vaut `#F2EDE3`), `#F5D5D5`, `#F0EEE4`. Les signaler plutôt que les tordre.

---

## 02 · Typographie **[FAIT — 27/11]**

Playfair Display (4 graisses) et Manrope (4 graisses) sont chargées globalement dans `app/_layout.tsx`. L'échelle `typography.*` compte ~20 entrées et est complète.

**Règle** : Playfair = identité et émotion (titres, noms d'établissement, citations). Manrope = interface et fonction (libellés, boutons, métadonnées, overlines).

| Token | Police | Usage |
|---|---|---|
| `displayHero` / `heroTitle` | Playfair 500 | Titre de hero, un par page maximum |
| `displayLg` | Playfair 500 | Titres de section (`SectionHeading`) |
| `displayMd` / `tileTitle` / `cardTitle` | Playfair 500 | Noms d'établissement, titres de carte |
| `displaySm` | Playfair 400 italique | Citations, moments éditoriaux courts |
| `editorialTitle` | Playfair 700 italique | Un seul moment fort par page |
| `displayStrong` | Playfair 600 | Hiérarchie forte — **chargée, toujours inutilisée** |
| `sheetTitle` | Playfair 500 | Titre de feuille |
| `overline` / `overlineSm` / `overlineXs` | Manrope 600 | Kickers, étiquettes de catégorie |
| `bodyLg` / `body` | Manrope 400 | Corps de texte, descriptions |
| `caption` / `pillLabel` / `sheetOption` | Manrope 500 | Métadonnées, pastilles, options |
| `button` / `buttonStrong` | Manrope 600 / 700 | Boutons — `buttonStrong` toujours inutilisée |

### Trois règles ajoutées le 27/11

- **Jamais de `fontWeight`.** Avec expo-font, chaque graisse est une famille distincte : `fontWeight` ne choisit pas une graisse, il épaissit artificiellement celle qui est chargée (faux gras sur le web). Écrire `fontFamily: fonts.sansSemiBold`, `fonts.sansBold`… Une seule exception : `SplashLoader`, affiché avant le chargement des polices, donc en police système.
- **Jamais de nom de police en dur** (`'Manrope_600SemiBold'`) : passer par `fonts.*`.
- **Rien sous 11 px.** `badgeSm`, `overlineSm`, `overlineXs` et les libellés d'onglets, qui descendaient à 9,5 et 10,5 px, ont été remontés à 11.

### Adoption réelle au 27/11

Tous les écrans et composants passent par `typography.*` ou `fonts.*`. Il ne reste aucun `fontWeight` hors l'exception ci-dessus.

> **Nuance importante, issue des passes menées.** L'échelle ne couvre pas tout. `listing/[id].tsx` emploie 15 tailles distinctes (9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 18, 20) dont plusieurs n'ont aucun équivalent. **Ne pas viser zéro littéral mécaniquement** : convertir les correspondances défendables, laisser le reste et le signaler. Confondre taille et rôle (mapper vers « la taille la plus proche ») est un anti-pattern en soi — `overline` porte un `letterSpacing` pensé pour un kicker, pas pour une date.

---

## 03 · Spacing **[FAIT — tranché]**

| Token | Valeur | Usage |
|---|---|---|
| `spacing.xs` | 4 | Gaps internes (icône + texte) |
| `spacing.sm` | 8 | Gaps de rangée |
| `spacing.md` | 16 | Padding de carte |
| `spacing.lg` | 24 | Marges de section |
| `spacing.xl` / `xxl` / `xxxl` | 32 / 48 / 64 | Respiration éditoriale |

**Question non tranchée depuis le 16/08, et aggravée.** La valeur `18` (`paddingHorizontal: 18`) est la gouttière d'écran de facto — jamais 16 ni 20. L'audit d'origine la relevait sur 4 écrans ; elle est aujourd'hui présente dans **15 fichiers** : `index`, `search`, `bookings`, `planner`, `listing/[id]`, `become-partner`, `edit-profile`, `favorites`, `notifications`, `admin/_layout`, `pro/bookings`, `pro/establishment`, `pro/index`, `pro/more`, `pro/pro-reviews`.

**Tranché : `spacing.gutter = 18` est officiel** (`lib/theme.ts`). Depuis le 27/11, plus aucun écran n'écrit `spacing.md + 2` ni `18` pour la gouttière. Les autres valeurs calculées (`spacing.md + 4`, `spacing.xs + 2`…) ont été ramenées au palier voisin ; l'échelle fine `spacing.v2` / `v12` / `v20` couvre les intermédiaires.

---

## 04 · Border radius **[PARTIEL]**

Échelle autorisée — **sept paliers, aucun autre** :

| Palier | Valeur | Usage |
|---|---|---|
| carré | `0` | séparateurs, photo plein cadre |
| `radii.v4` | 4 | très petites pastilles, poignée de feuille |
| `radii.sm` | 8 | |
| `radii.md` | 12 | cartes, champs, boutons |
| `radii.v16` | 16 | grandes surfaces |
| `radii.lg` | 20 | coins hauts des feuilles (`Sheet`, `BottomSheet` — c'était un `24` littéral) |
| `radii.pill` | 999 | |

> **Correction du 27/11.** Ce document annonçait « cinq paliers » alors que `lib/theme.ts` en porte sept depuis le resserrement de l'échelle (`v4` et `v16`).

Le radius `0` est un choix légitime : séparateurs, bords de photo plein cadre n'ont pas à être arrondis. Un radius « presque mais pas tout à fait » (13, 17) n'est jamais un choix, c'est un oubli.

> **Exception documentée, ajoutée le 19/08.** Un rayon égal à la moitié de la largeur d'un élément carré n'est pas un choix esthétique mais **de la géométrie de cercle** : `borderRadius: 16` sur un bouton de 32px, `21` sur 42px, `22` sur 44px, `3` sur un point de 6px. Les normaliser casserait la forme ronde. **Ces cas sont conformes et ne doivent pas être « corrigés ».** Ne comptabiliser comme écart que les rayons appliqués à des éléments non circulaires.

**Écarts réels restants dans `listing/[id].tsx`** : `10` (×4), `14` (×2), `7` (×1).

---

## 05 · Composants **[PARTIEL]**

### Composants partagés existants

| Composant | Rôle |
|---|---|
| `SectionHeading` | Kicker + titre Playfair + « voir tout » optionnel |
| `PhotoScrim`, `RiverMotif`, `CategoryTexture` | Primitives visuelles (Homepage) |
| `LandscapeIllustration` | Illustration Welcome |
| `SelecteurDate` | Sélecteur de date à trois colonnes — a remplacé `Calendar` |
| `CategoryIcon` **[créé 16/08]** | Type d'établissement → icône lucide |
| `ListingCard` **[fusionné 16/08]** | Carte d'établissement — source unique |
| `Chip` **[créé 16/08]** | Pastille sélectionnable, variantes `selectable` / `filter` |
| `BottomSheet` **[créé 16/08]** | Feuille de sélection à choix unique |
| `Sheet` **[créé 16/08]** | Chrome de feuille à contenu libre (formulaires) |
| `EmptyState` **[créé 16/08]** | État vide, icône optionnelle |
| `FormField` **[créé 16/08, étendu 27/11]** | Libellé relié à la saisie, aide, erreur annoncée ; accepte toutes les props de `TextInput` |
| `Button` | Bouton primaire / secondaire — source unique |
| `BoutonIcone` **[créé 27/11]** | Bouton réduit à une icône : libellé obligatoire, zone tactile de 44 px sans grossir le dessin |
| `StatCard` **[créé 27/11]** | Chiffre + libellé + période, variantes `clair` / `plein` |
| `BarreBureau` **[créé 27/11]** | Navigation en haut de page sur ordinateur (voir §07) |
| `ScreenHeader`, `ConfirmDialog`, `DateField`, `TimeField`, `PhoneField` | En-tête d'écran, confirmation, champs spécialisés |
| `StatusBadge` **[partagé 16/08]** | Statut de réservation, 5 états |

> **Correction du document d'origine.** L'audit du 16/08 décrivait `ListingCard` comme « 3 implémentations divergentes dont une orpheline », `EmptyState` et `BottomSheet` comme « à créer », `Chip` comme « 6 variantes locales », `StatusBadge` comme « local à bookings.tsx ». **Tout cela est résolu.** `components/CategoryPill.tsx`, orphelin, a été supprimé. Aucun composant de `components/` n'est aujourd'hui sans importeur.

### Doublons résolus le 27/11

- **`Field`** : les deux copies locales (`become-partner.tsx`, `pro/establishment.tsx`) sont supprimées au profit de `FormField`.
- **`Button`** : adopté dans `register`, `verify`, `edit-profile`, `become-partner`, `pro/establishment`, `pro/scan`, `planner`, `EmptyState`, `DateField`.
- **`StatCard`** : adopté dans `pro/index`, `pro/establishment`, `admin/index`, `admin/establishments`.

### Restés locaux, à raison ou faute de variante

| Élément | Où | Ce qui manque au composant officiel |
|---|---|---|
| Bouton ambre « Se connecter » | `login.tsx` | `Button` écrit son libellé en crème, illisible sur ambre : il faudrait une variante à libellé sombre |
| Boutons-liens (Culture, page 404) | `culture.tsx`, `+not-found.tsx` | `Button` ne porte pas d'adresse (`href`) ni d'icône après le libellé |
| Champs à icône ou à œil | `register`, `forgot-password`, `reset-password`, `change-password` | `FormField` n'a pas d'emplacement en tête ni en fin de champ |
| Cartes de statistiques | `pro/more`, `admin/stats`, carte de prix de `pro/establishment`, compteurs du profil | `StatCard` fixe la taille du chiffre et l'ordre chiffre / libellé |

Ces quatre lignes sont la liste des prochaines extensions de composants, pas des oublis.

### Composants à ne pas créer

- **Pas de second lightbox** : la visionneuse plein écran de `listing/[id].tsx` doit être paramétrée, pas dupliquée.
- **`Sheet` n'absorbe pas `BottomSheet`** : contenu libre vs liste d'options à choix unique. Les deux coexistent volontairement.
- **Ne pas créer un composant pour économiser quelques lignes.** Une ressemblance superficielle n'est pas une duplication : `dayChip` (Planner) ressemble à `Chip` mais empile trois lignes de texte dans un rectangle — il reste local, à raison.

---

## 06 · Imagerie

| Type | Quand | Repli |
|---|---|---|
| Photographie immersive | Un seul moment héros par page | `RiverMotif` + `PhotoScrim` |
| Photographie de carte | `ListingCard`, `CategoryTile` — contenue, `cover`, jamais pleine largeur | Aplat de teinte de catégorie + icône — **jamais `RiverMotif`**, réservé au niveau marque |
| Illustration | Évitée depuis la refonte | — |
| Texture | Uniquement comme repli — jamais en surcouche sur une vraie photo | — |
| Motif géographique | Un seul trait d'horizon discret, jamais une scène (voir §12) | — |
| Icône | Navigation, statut, action — jamais comme contenu principal | — |

---

## 07 · Responsive **[FAIT — 27/11]**

`lib/responsive.ts` : mobile < 768, tablette < 1024, desktop ≥ 1024, contenu max **1200px**.

- **Mobile** : défilement vertical, un agencement, pleine largeur.
- **Tablette** : mobile élargi sauf besoin explicite.
- **Desktop** : composition dédiée obligatoire — **jamais un mobile étiré**. Largeur contenue à 1200px, centrée.

### Navigation selon la largeur **[27/11]**

| Largeur | Navigation |
|---|---|
| Mobile et tablette | Barre d'onglets en bas |
| Desktop (≥ 1024) | `BarreBureau` en haut : marque à gauche, destinations en vrais liens |

Jusqu'au 27/11, la barre d'onglets restait en bas sur ordinateur, recentrée sur 460 px — exactement le « mobile étiré » interdit ci-dessus. Vaut pour l'espace voyageur (`(tabs)/_layout.tsx`) et l'espace partenaire (`pro/_layout.tsx`). L'administration garde sa barre latérale.

### Zones sûres **[27/11]**

`useZonesSures()` (`lib/zones.ts`) donne les marges haute et basse réelles de l'appareil. **Ne plus écrire `Platform.OS === 'ios' ? 56 : 20`** : cette valeur ignorait les encoches Android et les iPhone sans encoche.

### Adoption réelle au 19/08

> **Correction du document d'origine**, qui indiquait « utilisé seulement sur la Homepage ».

| Écran | Composition |
|---|---|
| Homepage | Grille desktop |
| Recherche | Grille 2 colonnes (mobile/tablette) → 4 colonnes (desktop) |
| Réservations | 1 colonne (mobile) → grille 2 colonnes (tablette/desktop) |
| Planner | Colonne unique centrée à tous les breakpoints — les onglets (chronologie, budget, checklist) ne se découpent pas en grille |
| Fiche établissement | Colonne unique (mobile/tablette) → deux colonnes + colonne prix `sticky` (desktop) |
| Profil, Favoris, Notifications | Colonne centrée (`breakpoints.panelMax`) |
| Partner (`pro/*`) | Colonne centrée ; barre du haut sur ordinateur |
| Admin | Barre latérale + contenu centré (`panelMax` ou `dashboardMax`) ; tiroir en `Modal` sur mobile |

**Choisir la composition d'après la structure réelle du contenu** : une grille convient à des cartes courtes et homogènes, pas à du contenu éditorial dense ni à une chronologie.

> **Piège vérifié en conditions réelles.** Un élément `position: sticky` doit rester **plus court que son conteneur** pour disposer d'une plage de défilement. Le poser sur un conteneur étiré à la hauteur de la colonne principale l'annule silencieusement — le style est présent, l'effet inexistant. Poser le `sticky` sur la carte elle-même, pas sur sa colonne.

---

## 08 · Motion

**Autorisé** : glissement horizontal des photos hero (pas de fondu), transitions de navigation natives, retour de pression discret, ouverture/fermeture de feuille (slide natif).

**À éviter** : parallax, rebond, apparition en cascade, animation d'entrée systématique, toute transition sans précédent déjà construit dans le code.

> **[À TRANCHER] — le code dément cette règle.** `lib/motion.ts` fournit `useEntreeListe` / `useEntree` (apparition en cascade), utilisés par la Recherche et par Culture. Soit la règle s'assouplit (« cascade tolérée si elle est courte »), soit ces entrées disparaissent. Non tranché le 27/11 : c'est un choix de direction artistique.

**Obligatoire depuis le 27/11** : toute animation respecte `useMouvementReduit()` (`lib/motion.ts`), et tout défilement automatique peut être mis en pause (le carrousel de l'accueil a un bouton pause / lecture).

---

## 09 · Iconographie **[PARTIEL]**

**`lucide-react-native` exclusivement.** Aucune autre librairie d'icônes. Pas de logo de marque dessiné à la main.

**Trait fin `strokeWidth={1.75}`** = standard, à généraliser à chaque refonte d'écran.

Adopté : `index.tsx`, `search.tsx`, `Chip`, `BottomSheet`.
Non adopté : partout ailleurs — notamment `listing/[id].tsx`, où **aucune icône** ne porte le trait fin.

> **Exception documentée.** `CategoryIcon` ne force volontairement pas `strokeWidth`, pour rester au défaut lucide : il est consommé par `ListingCard`, donc par la Homepage, qui doit rester visuellement figée. Le trait fin s'applique localement à l'appel, pas dans le composant.

### `components/SectionIcons.tsx` — supprimé **[FAIT]**

Cette seconde bibliothèque d'icônes maison n'existe plus. **Ne pas la recréer, ne pas réintroduire d'emoji.**

---

## 10 · Anti-patterns — interdits

Chaque point est observé quelque part dans ce code. Ce ne sont pas des risques hypothétiques.

### Emojis fonctionnels
Interdits comme icône ou repère de section. **État au 27/11 : plus aucun emoji dans `app/`, `components/` ni `lib/`** — y compris dans les placeholders, où un lecteur d'écran les lisait à voix haute. Les constats ci-dessous sont conservés pour mémoire.
*Constaté* : `planner.tsx` (`📄👕🧴` catégories de préparation), `pro/establishment.tsx` (`📱✉️📸🎵` libellés de champ), `admin` (titres de section), **`listing/[id].tsx`** (`🎂💼💑` occasions, `🎒🗺️` type de visite, `📍` référence, `✅` bannière de succès).

> **Cas limite à arbitrer** : `🇨🇩 Congolaise` / `🌍 Étrangère` dans `listing/[id].tsx`. Ici le drapeau porte une information qu'aucune icône lucide ne rend. Si le remplacement dégrade la compréhension, le conserver et le documenter vaut mieux qu'une conformité aveugle.

### Icône dans un cercle coloré
Retiré du logo de la Homepage — ne doit pas revenir comme réflexe par défaut.
*Constaté* : `listing/[id].tsx` `contactIconBtn` (cercles de 42px, quatre icônes de contact), `pro/index.tsx` `statIconBadge`, avatar de la sidebar admin, `SectionIcons.IconBadge`, logo de `become-partner.tsx`.

### Rayons incohérents
Toute valeur hors des cinq paliers, **hors géométrie de cercle** (voir §04).

### Ombres génériques
`shadowColor: '#000'` interdit — utiliser `colors.nuit`.
*Constaté* : `profile.tsx`, `pro/index.tsx`, `pro/pro-reviews.tsx`, `welcome.tsx`.

### Cartes toutes identiques
Une liste ne doit pas systématiquement devenir une pile de cartes blanches bordées interchangeables.
*Constaté* : `planner.tsx` (`itemCard`, `reservationCard`, `wishlistCard`), `listing/[id].tsx` (avis, prix, compteurs, adresse — même recette `white` + `borderWidth: 1` + `borderColor: border` répétée cinq fois).

### Pills en excès
**Un chip a un rôle de sélection, pas de décoration.** Ne pas envelopper un libellé dans une pastille par réflexe. Une ligne méta (localisation · statut · disponibilité) est du texte avec séparateurs, pas trois pastilles.
*Constaté* : `listing/[id].tsx` ligne méta — note et « Nouveau » en `borderRadius: 999` alors qu'aucun n'est sélectionnable.

### Dashboard générique
Grille « icône badge + gros chiffre + libellé » en couleurs pleines.
*Constaté* : `admin/index.tsx` `statsGrid`.

### Sections répétitives
« En-tête → rangée de pastilles → pile de cartes » ne doit pas être le squelette par défaut de chaque écran.

### Gradients décoratifs et glassmorphism
Aucun cas trouvé — à garder ainsi. Les fonds translucides existants restent fonctionnels et minimaux.

---

## 11 · Architecture

| Emplacement | Contenu |
|---|---|
| `lib/theme.ts` | Couleurs, jetons sémantiques, `radii`, `spacing`, `breakpoints`, `fonts`, `typography`. **[À trancher]** `spacing.gutter` (§03) |
| `lib/responsive.ts` | `useResponsive()` — breakpoints, `contentWidth` |
| `lib/city-context.tsx`, `lib/cities.ts` | Ville courante, source de vérité `cities` |
| `lib/geography.ts` | Subdivisions — **transitoire, Kinshasa uniquement.** Ne pas étendre : une vraie table DB est le déclencheur de migration |
| `components/` | 34 composants partagés (§05) |
| `lib/zones.ts` **[27/11]** | `useZonesSures()` — marges haute et basse réelles |
| `lib/a11y.ts` **[27/11]** | `etatBascule()`, `etatCourant()` — états d'accessibilité qui diffèrent entre web et natif (§13) |
| `lib/focus-web.ts` **[27/11]** | Anneau de focus clavier du site |
| `lib/liens.ts` | `lienVers()` — vrais liens `<a href>` sur le web |

Le dossier `src/` (gabarit Expo, second fichier de thème, jamais importé) a été supprimé le 27/11.

---

## 12 · Règle fondamentale — un système national

**YakaRDC est une plateforme nationale, pas un « design Kinshasa ».**

`RiverMotif` et `CategoryTexture` sont construits comme une **méthode** (dégradé + lueur + grain + un seul trait), pas comme du contenu fluvial : seuls le tracé de l'horizon et le nom du composant le sont. Quand une deuxième région aura réellement besoin de son motif (forêt, savane, relief), généraliser l'API existante — **pas créer un système parallèle**.

Ne pas construire cette famille avant qu'un besoin réel n'existe, exactement comme pour `lib/geography.ts`.

---

## 13 · Accessibilité **[27/11]**

Règles appliquées à tous les écrans lors de la passe du 27/11. Elles valent pour tout nouvel écran.

### États : `aria-*`, jamais `accessibilityState`

**react-native-web 0.21 ne transmet pas `accessibilityState` ni `accessibilityValue` au navigateur.** Un état écrit ainsi existe sur téléphone et disparaît sur le site. React Native comprend les `aria-*` en natif : on n'écrit donc que ceux-là.

| État | Écriture |
|---|---|
| Coché (radio, case, interrupteur) | `aria-checked={…}` |
| Occupé, ouvert, désactivé | `aria-busy`, `aria-expanded`, `aria-disabled` |
| Onglet choisi (`accessibilityRole="tab"`) | `aria-selected={…}` |
| Bouton à deux positions (filtre, favori) | `{...etatBascule(actif)}` — `aria-pressed` sur le web, « sélectionné » en natif |
| Lien vers la page affichée | `{...etatCourant(actif)}` — `aria-current="page"` sur le web |

### Structure

- **Un titre de niveau 1 par écran** (`accessibilityRole="header"` + `aria-level={1}`). `ScreenHeader` le fournit ; `SectionHeading` et `EmptyState` sont au niveau 2 par défaut (prop `niveau`).
- **Tout élément pressable a un rôle** (`button`, `link`, `tab`, `radio`, `checkbox`, `switch`). Un lien interne passe par `lienVers()`.
- **Un bouton sans texte a un libellé** : utiliser `BoutonIcone`, qui le rend obligatoire.

### Formulaires

- Le libellé est **relié** au champ (`accessibilityLabel`, ou `FormField` qui le fait). Un placeholder n'est pas un libellé.
- `autoComplete` sur e-mail, mot de passe, nom, téléphone, code à usage unique.
- Une erreur affichée est **annoncée** : `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`.
- Contour des champs en `borderField`, pas en `border`.

### Zones tactiles

**44 px minimum** (`cible.min`). **`hitSlop` ne compte pas** : react-native-web l'ignore. La technique est celle de `BoutonIcone` et de `Chip` : une zone de 44 px qui reçoit le doigt, un dessin plus petit à l'intérieur, et une marge négative qui reprend le surplus pour ne rien décaler.

Exceptions connues, où 44 px feraient se chevaucher des cibles voisines : points de pagination du carrousel de la fiche (14 px de large), lignes de la valise du planning (27 px de haut), champs de recherche de l'administration (35 px). À arbitrer.

### Clavier

`lib/focus-web.ts` pose un anneau de focus visible (`:focus-visible`) sur tout le site. Le tiroir de l'administration, la boîte de confirmation et les feuilles sont des `Modal`, tous munis de `onRequestClose` : la touche Échap les referme (constaté au navigateur sur le tiroir et la boîte de confirmation ; pour les feuilles, déduit du code).

### Non couvert

Aucun essai au lecteur d'écran (VoiceOver, TalkBack, NVDA) n'a été mené : les rôles et libellés sont établis à la lecture du code et du HTML produit.

---

## Synthèse A–K

| | Sujet | État |
|---|---|---|
| **A** | Design tokens | **[FAIT]** — `success` / `warning` / `danger` créés |
| **B** | Échelle typographique | **[FAIT — 27/11]** — plus de `fontWeight`, plancher à 11 px |
| **C** | Échelle de spacing | **[FAIT]** — `spacing.gutter = 18` officiel |
| **D** | Échelle de radius | **[FAIT]** — sept paliers ; exception géométrie de cercle documentée |
| **E** | Inventaire composants | **[FAIT — 27/11]** — 34 partagés ; `Field` résolu ; extensions à prévoir listées au §05 |
| **F** | Règles responsive | **[FAIT — 27/11]** — barre du haut sur ordinateur, zones sûres, admin centré |
| **G** | Règles de motion | **[À TRANCHER]** — les entrées en cascade contredisent la règle (§08) |
| **H** | Règles d'imagerie | **[FAIT]** |
| **I** | Règles d'iconographie | **[PARTIEL]** — `SectionIcons` supprimé ; trait fin non généralisé |
| **J** | Anti-patterns | **[PARTIEL]** — emoji, ombres `#000` et la plupart des icônes en pastille retirés le 27/11 ; cartes identiques et tableau de bord générique non traités |
| **L** | Accessibilité | **[FAIT — 27/11]**, hors essai au lecteur d'écran (§13) |
| **K** | Plan de refonte | Voir ci-dessous |

---

## K · Plan de refonte

| # | Écran | Statut | Motif |
|---|---|---|---|
| 1 | Recherche | **[FAIT]** | Banc d'essai de `ListingCard`, `Chip`, `BottomSheet` |
| 2 | Fiche établissement | **[FAIT — 27/11]** | Trafic direct ; logique métier la plus riche |
| 3 | Réservations | **[FAIT]** | A introduit `StatusBadge` et les jetons sémantiques |
| 4 | Planner | **[FAIT]** | Le plus gros écran en volume |
| 5 | Profil | **[FAIT — 27/11]** | Écran simple, faible risque |
| 6 | Partner (`become-partner` + `pro/*`) | **[FAIT — 27/11]** | `Field` résolu, emoji retirés |
| 7 | Admin | **[FAIT — 27/11]** | Outil interne. La barre latérale a rejoint les jetons ; tiroir mobile en `Modal` |

---

## Méthode de travail

Chaque passe suit strictement cet ordre :

**Audit (lecture seule) → plan précis → validation du périmètre → implémentation → TypeScript → build → recherche des duplications → vérification des régressions.**

Règles transverses :

- **Le comportement fonctionnel existant reste intact**, sauf amélioration explicitement décidée. L'objectif n'est pas de faire disparaître les hexadécimaux, c'est de supprimer la dérive réelle.
- **Ne jamais toucher** au schéma Supabase, aux politiques RLS, à l'authentification, au paiement ni à la logique de réservation sans autorisation explicite. Aucune table nouvelle sans validation préalable.
- **Ne pas normaliser mécaniquement.** Certaines valeurs sont justifiées par leur rôle ou leur géométrie ; les signaler vaut mieux que les tordre.
- **Signaler ce que le code dément.** Un rapport qui confirme toutes les hypothèses de départ n'a aucune valeur.
