# Design System YakaRDC

Référence unique de conformité pour l'ensemble de l'application.

> **Origine** — Extraction du système réel présent dans la Homepage « Terre & Fleuve », réalisée le **16/08/2026** et publiée alors comme artifact.
> **Mise à jour** — **19/08/2026** : report des passes menées depuis (Fondations DS, `Sheet`, Fiche établissement, Réservations, Planner). L'audit d'origine décrivait un état antérieur à ces passes ; une dizaine de constats étaient devenus faux et sont corrigés ici.
> **Statut** — En attente de relecture et de commit.

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
| Fiche établissement (`app/listing/[id].tsx`) | **[PARTIEL]** — responsive et `Sheet` faits ; typographie et couleurs non traitées |
| Profil (`app/(tabs)/profile.tsx`) | **[À FAIRE]** |
| Partner (`become-partner.tsx`, `pro/*`) | **[À FAIRE]** |
| Admin (`admin/*`) | **[À FAIRE]** |

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
| Danger | `danger` / `dangerSoft` | `#A23B2B` / `#FBEAE5` | seule teinte réellement nouvelle |

> **Correction du document d'origine.** L'audit du 16/08 préconisait un token nommé **`error`**. Le token créé s'appelle **`danger`** — le nom retenu à l'implémentation. **Ne pas créer de token `error`** : il ferait doublon. Toute consigne renvoyant à `error` doit se lire `danger`.

`danger` (`#A23B2B`) est volontairement plus terreux que le `#C0392B` littéral qu'il remplace : rouge de la même famille chaude que `lave`, distinct des états actifs. **Le substituer est donc un changement visuel assumé, pas une simple retokénisation.**

### Littéraux restants

| Littéral | Devrait être | Où |
|---|---|---|
| `#C0392B` / `#FFF0F0` | `danger` / `dangerSoft` | `listing/[id].tsx`, `bookings.tsx` (`cancelBtnText`), `planner.tsx` (`errorText`), `Calendar.tsx` |
| `#FAF8F4` | `cream` | `listing/[id].tsx` (16 occurrences), en-têtes de plusieurs écrans |
| `#FFFFFF` | `white` | `listing/[id].tsx` (13 occurrences) |
| `#0F6E56` / `#E1F5EE` | `fleuve` / `fleuveSoft` | `listing/[id].tsx` (badge « Client vérifié ») |
| `shadowColor: '#000'` | `nuit` | `profile.tsx`, `pro/index.tsx`, `pro/pro-reviews.tsx`, `welcome.tsx` |

**Sans correspondance exacte — ne pas forcer d'approximation** : `#F5F4F0` (fonds neutres, `surfaceSunken` vaut `#F2EDE3`), `#F5D5D5`, `#F0EEE4`. Les signaler plutôt que les tordre.

---

## 02 · Typographie **[PARTIEL]**

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

### Adoption réelle au 19/08

**Adopté** : `index.tsx`, `search.tsx`, et 7 composants partagés (`SectionHeading`, `ListingCard`, `Chip`, `BottomSheet`, `Sheet`, `EmptyState`, `FormField`).

**Non adopté** : `listing/[id].tsx` (**36 `fontSize` littéraux, zéro `typography.*`** — la page tourne intégralement en police système, sans Playfair ni Manrope), `bookings.tsx`, `planner.tsx`, `profile.tsx`, `pro/*`, `admin/*`.

> **Nuance importante, issue des passes menées.** L'échelle ne couvre pas tout. `listing/[id].tsx` emploie 15 tailles distinctes (9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 18, 20) dont plusieurs n'ont aucun équivalent. **Ne pas viser zéro littéral mécaniquement** : convertir les correspondances défendables, laisser le reste et le signaler. Confondre taille et rôle (mapper vers « la taille la plus proche ») est un anti-pattern en soi — `overline` porte un `letterSpacing` pensé pour un kicker, pas pour une date.

---

## 03 · Spacing **[À TRANCHER]**

| Token | Valeur | Usage |
|---|---|---|
| `spacing.xs` | 4 | Gaps internes (icône + texte) |
| `spacing.sm` | 8 | Gaps de rangée |
| `spacing.md` | 16 | Padding de carte |
| `spacing.lg` | 24 | Marges de section |
| `spacing.xl` / `xxl` / `xxxl` | 32 / 48 / 64 | Respiration éditoriale |

**Question non tranchée depuis le 16/08, et aggravée.** La valeur `18` (`paddingHorizontal: 18`) est la gouttière d'écran de facto — jamais 16 ni 20. L'audit d'origine la relevait sur 4 écrans ; elle est aujourd'hui présente dans **15 fichiers** : `index`, `search`, `bookings`, `planner`, `listing/[id]`, `become-partner`, `edit-profile`, `favorites`, `notifications`, `admin/_layout`, `pro/bookings`, `pro/establishment`, `pro/index`, `pro/more`, `pro/pro-reviews`.

Deux options : officialiser `spacing.gutter = 18` (c'est déjà la norme réelle), ou migrer vers `spacing.md`. **À trancher avant la refonte de Partner**, faute de quoi une troisième échelle continue de se propager.

---

## 04 · Border radius **[PARTIEL]**

Échelle autorisée — **cinq paliers, aucun autre** :

| Palier | Valeur |
|---|---|
| carré | `0` |
| `radii.sm` | 8 |
| `radii.md` | 12 |
| `radii.lg` | 20 |
| `radii.pill` | 999 |

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
| `Calendar` | Sélecteur de date (+ `formatFrench`, `toIsoDate`) |
| `CategoryIcon` **[créé 16/08]** | Type d'établissement → icône lucide |
| `ListingCard` **[fusionné 16/08]** | Carte d'établissement — source unique |
| `Chip` **[créé 16/08]** | Pastille sélectionnable, variantes `selectable` / `filter` |
| `BottomSheet` **[créé 16/08]** | Feuille de sélection à choix unique |
| `Sheet` **[créé 16/08]** | Chrome de feuille à contenu libre (formulaires) |
| `EmptyState` **[créé 16/08]** | État vide, icône optionnelle |
| `FormField` **[créé 16/08]** | Label + saisie |
| `StatusBadge` **[partagé 16/08]** | Statut de réservation, 5 états |

> **Correction du document d'origine.** L'audit du 16/08 décrivait `ListingCard` comme « 3 implémentations divergentes dont une orpheline », `EmptyState` et `BottomSheet` comme « à créer », `Chip` comme « 6 variantes locales », `StatusBadge` comme « local à bookings.tsx ». **Tout cela est résolu.** `components/CategoryPill.tsx`, orphelin, a été supprimé. Aucun composant de `components/` n'est aujourd'hui sans importeur.

### Restant à créer

| Composant | État | Priorité |
|---|---|---|
| `Button` | **[À FAIRE]** — style primaire redéfini dans **9 endroits** : `login` (`primaryBtn`), `bookings` (`actionBtn`), `planner` (`createBtn`), `become-partner` (`submitBtn`), `edit-profile` (`saveBtn`), `pro/establishment` (`saveBtn`), et **3 fois dans `listing/[id]`** (`submitBtn`, `bookBtn`, `planBtn`) | Haute — duplication la plus étendue du projet |
| `StatCard` | **[À FAIRE]** — 2 implémentations (`pro/index`, `admin/index`) | Basse — à traiter avec Admin |

### Point de vigilance — `Field` a régressé

L'audit d'origine relevait `Field` dupliqué dans `become-partner.tsx` et `pro/establishment.tsx`. La passe Fiche établissement a créé `components/FormField.tsx`… **sans supprimer les deux copies locales.** Il y a donc aujourd'hui **trois** implémentations au lieu de deux :

- `components/FormField.tsx` (partagée, utilisée par `listing/[id].tsx`)
- `become-partner.tsx:25` `function Field`
- `pro/establishment.tsx:39` `function Field`

**À résoudre lors de la passe Partner** : migrer les deux locales vers `FormField`.

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

## 07 · Responsive **[PARTIEL]**

`lib/responsive.ts` : mobile < 768, tablette < 1024, desktop ≥ 1024, contenu max **1200px**.

- **Mobile** : défilement vertical, un agencement, pleine largeur.
- **Tablette** : mobile élargi sauf besoin explicite.
- **Desktop** : composition dédiée obligatoire — **jamais un mobile étiré**. Largeur contenue à 1200px, centrée.

### Adoption réelle au 19/08

> **Correction du document d'origine**, qui indiquait « utilisé seulement sur la Homepage ».

| Écran | Composition |
|---|---|
| Homepage | Grille desktop |
| Recherche | Grille 2 colonnes (mobile/tablette) → 4 colonnes (desktop) |
| Réservations | 1 colonne (mobile) → grille 2 colonnes (tablette/desktop) |
| Planner | Colonne unique centrée à tous les breakpoints — les onglets (chronologie, budget, checklist) ne se découpent pas en grille |
| Fiche établissement | Colonne unique (mobile/tablette) → deux colonnes + colonne prix `sticky` (desktop) |
| Profil, Partner, Admin | **[À FAIRE]** |

**Choisir la composition d'après la structure réelle du contenu** : une grille convient à des cartes courtes et homogènes, pas à du contenu éditorial dense ni à une chronologie.

> **Piège vérifié en conditions réelles.** Un élément `position: sticky` doit rester **plus court que son conteneur** pour disposer d'une plage de défilement. Le poser sur un conteneur étiré à la hauteur de la colonne principale l'annule silencieusement — le style est présent, l'effet inexistant. Poser le `sticky` sur la carte elle-même, pas sur sa colonne.

---

## 08 · Motion

**Autorisé** : glissement horizontal des photos hero (pas de fondu), transitions de navigation natives, retour de pression discret, ouverture/fermeture de feuille (slide natif).

**À éviter** : parallax, rebond, apparition en cascade, animation d'entrée systématique, toute transition sans précédent déjà construit dans le code.

---

## 09 · Iconographie **[PARTIEL]**

**`lucide-react-native` exclusivement.** Aucune autre librairie d'icônes. Pas de logo de marque dessiné à la main.

**Trait fin `strokeWidth={1.75}`** = standard, à généraliser à chaque refonte d'écran.

Adopté : `index.tsx`, `search.tsx`, `Chip`, `BottomSheet`.
Non adopté : partout ailleurs — notamment `listing/[id].tsx`, où **aucune icône** ne porte le trait fin.

> **Exception documentée.** `CategoryIcon` ne force volontairement pas `strokeWidth`, pour rester au défaut lucide : il est consommé par `ListingCard`, donc par la Homepage, qui doit rester visuellement figée. Le trait fin s'applique localement à l'appel, pas dans le composant.

### `components/SectionIcons.tsx` — à supprimer **[À FAIRE]**

Seconde bibliothèque d'icônes SVG maison, en infraction avec cette section. Un seul importeur : `app/pro/establishment.tsx` (L19-20), **8 appels à `CardTitle`**, qui enveloppe chaque icône dans `IconBadge` — soit l'anti-pattern « icône en cercle coloré » du §10.

À supprimer lors de la passe Partner, en remplaçant par des icônes lucide sans pastille. **Ne pas réintroduire d'emoji** : leur retrait reste acquis, c'est la méthode de remplacement qui était mauvaise.

---

## 10 · Anti-patterns — interdits

Chaque point est observé quelque part dans ce code. Ce ne sont pas des risques hypothétiques.

### Emojis fonctionnels
Interdits comme icône ou repère de section.
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
| `components/` | 15 composants partagés (§05) |

Aucun nouveau fichier `lib/` identifié comme nécessaire.

---

## 12 · Règle fondamentale — un système national

**YakaRDC est une plateforme nationale, pas un « design Kinshasa ».**

`RiverMotif` et `CategoryTexture` sont construits comme une **méthode** (dégradé + lueur + grain + un seul trait), pas comme du contenu fluvial : seuls le tracé de l'horizon et le nom du composant le sont. Quand une deuxième région aura réellement besoin de son motif (forêt, savane, relief), généraliser l'API existante — **pas créer un système parallèle**.

Ne pas construire cette famille avant qu'un besoin réel n'existe, exactement comme pour `lib/geography.ts`.

---

## Synthèse A–K

| | Sujet | État |
|---|---|---|
| **A** | Design tokens | **[FAIT]** — `success` / `warning` / `danger` créés |
| **B** | Échelle typographique | **[PARTIEL]** — 2 écrans + 7 composants ; `displayStrong` et `buttonStrong` toujours inutilisées |
| **C** | Échelle de spacing | **[À TRANCHER]** — le « 18 » s'est propagé à 15 fichiers |
| **D** | Échelle de radius | **[PARTIEL]** — exception géométrie de cercle documentée |
| **E** | Inventaire composants | **[PARTIEL]** — 12 partagés ; reste `Button`, `StatCard` ; `Field` a régressé à 3 implémentations |
| **F** | Règles responsive | **[PARTIEL]** — 5 écrans sur 8 |
| **G** | Règles de motion | **[FAIT]** — aucune dérive constatée |
| **H** | Règles d'imagerie | **[FAIT]** |
| **I** | Règles d'iconographie | **[PARTIEL]** — trait fin sur 4 fichiers ; `SectionIcons` à supprimer |
| **J** | Anti-patterns | **[PARTIEL]** — emoji, cercles colorés, ombres génériques subsistent hors écrans traités |
| **K** | Plan de refonte | Voir ci-dessous |

---

## K · Plan de refonte

| # | Écran | Statut | Motif |
|---|---|---|---|
| 1 | Recherche | **[FAIT]** | Banc d'essai de `ListingCard`, `Chip`, `BottomSheet` |
| 2 | Fiche établissement | **[PARTIEL]** | Trafic direct ; logique métier la plus riche. Responsive et `Sheet` faits — typographie, couleurs et fonctionnalités du Lot 1 restants |
| 3 | Réservations | **[FAIT]** | A introduit `StatusBadge` et les jetons sémantiques |
| 4 | Planner | **[FAIT]** | Le plus gros écran en volume |
| 5 | Profil | **[À FAIRE]** | Écran simple, faible risque |
| 6 | Partner (`become-partner` + `pro/*`) | **[À FAIRE]** | Doit résoudre `Field` (×3), supprimer `SectionIcons`, traiter les emoji de libellés |
| 7 | Admin | **[À FAIRE]** | Outil interne. Ne pas forcer les composants voyageurs sur les tableaux ; la sidebar doit rejoindre les tokens |

---

## Méthode de travail

Chaque passe suit strictement cet ordre :

**Audit (lecture seule) → plan précis → validation du périmètre → implémentation → TypeScript → build → recherche des duplications → vérification des régressions.**

Règles transverses :

- **Le comportement fonctionnel existant reste intact**, sauf amélioration explicitement décidée. L'objectif n'est pas de faire disparaître les hexadécimaux, c'est de supprimer la dérive réelle.
- **Ne jamais toucher** au schéma Supabase, aux politiques RLS, à l'authentification, au paiement ni à la logique de réservation sans autorisation explicite. Aucune table nouvelle sans validation préalable.
- **Ne pas normaliser mécaniquement.** Certaines valeurs sont justifiées par leur rôle ou leur géométrie ; les signaler vaut mieux que les tordre.
- **Signaler ce que le code dément.** Un rapport qui confirme toutes les hypothèses de départ n'a aucune valeur.
