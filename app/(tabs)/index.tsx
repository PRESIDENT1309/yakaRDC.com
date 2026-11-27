import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import LogoYaka from '../../components/LogoYaka';
import {
  Search,
  Bell,
  SlidersHorizontal,
  MapPin,
  ChevronDown,
  WifiOff,
  Pause,
  Play,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, typography, spacing, radii, breakpoints, cible } from '../../lib/theme';
import { useMouvementReduit } from '../../lib/motion';
import { useZonesSures } from '../../lib/zones';
import { lienVers } from '../../lib/liens';
import { useResponsive } from '../../lib/responsive';
import { useSelectedCity } from '../../lib/city-context';
import { getCitySubdivisions } from '../../lib/geography';
import SectionHeading from '../../components/SectionHeading';
import RiverMotif from '../../components/RiverMotif';
import PhotoScrim from '../../components/PhotoScrim';
import CategoryTexture from '../../components/CategoryTexture';
import ListingCard from '../../components/ListingCard';
import { SkeletonCarte } from '../../components/Skeleton';
import Chip from '../../components/Chip';
import BottomSheet from '../../components/BottomSheet';
import EmptyState from '../../components/EmptyState';
import BoutonIcone from '../../components/BoutonIcone';
import type { Establishment, EstablishmentType } from '../../lib/types';
import { etatBascule } from '../../lib/a11y';

type EstablishmentWithPhoto = Establishment & {
  listing_photos?: { url: string; position: number; offer_id: string | null }[];
  avgRating?: number | null;
  reviewCount?: number;
};

const CATEGORIES: {
  key: EstablishmentType;
  label: string;
  kicker: string;
  tone: string;
  settingKey: string;
}[] = [
  { key: 'hotel', label: 'Hôtels', kicker: 'Séjourner', tone: colors.lave, settingKey: 'home_category_hotel_url' },
  { key: 'furnished_house', label: 'Maisons meublées', kicker: "S'installer", tone: colors.fleuveDark, settingKey: 'home_category_furnished_house_url' },
  { key: 'restaurant', label: 'Restaurants', kicker: 'Se régaler', tone: colors.or, settingKey: 'home_category_restaurant_url' },
  { key: 'site', label: 'Sites touristiques', kicker: 'Découvrir', tone: colors.foret, settingKey: 'home_category_site_url' },
];

const ROTATION_INTERVAL = 4000; // temps d'affichage de chaque photo
const SLIDE_DURATION = 650; // durée du défilement entre deux photos

// Fond des pastilles posées sur la photo du hero (cloche, pause). Blanc à
// 15 % : aucun jeton du thème ne le porte, il ne sert qu'ici.
const VOILE_PASTILLE = 'rgba(255,255,255,0.15)';

// Hauteur de la ligne « Disponible actuellement à… » (Manrope 11 px), d'où le
// surplus à annuler pour que sa zone tactile de 44 px ne décale pas le titre.
const HAUTEUR_REPERE = 15;

// Blason existant (cercle/montagne/vague) + nom en Playfair — la marque telle
// qu'elle existait déjà, sans badge circulaire générique autour du blason.
function LogoLockup() {
  return (
    <View style={styles.logoRow}>
      {/* Seule occurrence sans plaque : le motif est posé à même le bandeau. */}
      <LogoYaka size={22} plate={false} />
      <Text style={styles.logoText}>YakaRDC</Text>
    </View>
  );
}

// Photos de fond en rotation automatique, défilement horizontal droite→gauche
// (la photo suivante entre par la droite) — retombe sur le motif de marque
// (fleuve au crépuscule) tant qu'aucune photo n'est renseignée.
// `defile` passe à faux quand le visiteur met le diaporama en pause ou que le
// réglage système « réduire les animations » est actif : la photo en cours reste.
function RotatingHero({
  photos, width, height, defile,
}: { photos: string[]; width: number; height: number; defile: boolean }) {
  const [index, setIndex] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (photos.length < 2 || !defile) return;
    const timer = setInterval(() => {
      // Onglet en arrière-plan : personne ne regarde. Sans ce garde, le
      // carrousel continuait de décoder une photo toutes les quatre secondes.
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return;
      Animated.timing(translateX, { toValue: -width, duration: SLIDE_DURATION, useNativeDriver: true }).start(() => {
        setIndex(prev => (prev + 1) % photos.length);
        translateX.setValue(0);
      });
    }, ROTATION_INTERVAL);
    return () => clearInterval(timer);
  }, [photos.length, width, defile]);

  if (photos.length === 0) {
    return <RiverMotif width={width} height={height} variant="hero" />;
  }

  const nextIndex = (index + 1) % photos.length;

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Animated.View style={{ flexDirection: 'row', width: width * 2, height, transform: [{ translateX }] }}>
        {/* Pas de `transition` sur le carrousel : le fondu de l'image se
            superposerait au glissement du bandeau et brouillerait les deux.
            Le cache, lui, compte double ici — ces photos reviennent à chaque
            tour de boucle. */}
        <Image
          source={{ uri: photos[index] }}
          style={{ width, height }}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          recyclingKey={photos[index]}
          accessibilityLabel="Vue de la République démocratique du Congo"
        />
        <Image
          source={{ uri: photos[nextIndex] }}
          style={{ width, height }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={photos[nextIndex]}
          // Image suivante du carrousel : elle double celle qui est visible et
          // n'apporte rien à la lecture vocale. Étiquette vide, à dessein.
          accessibilityLabel=""
        />
      </Animated.View>
    </View>
  );
}

function CategoryTile({
  cat,
  active,
  onPress,
  style,
  photoUrl,
}: {
  cat: (typeof CATEGORIES)[number];
  active: boolean;
  onPress: () => void;
  style?: any;
  photoUrl: string | null;
}) {
  return (
    <Pressable
      style={[styles.tile, active && styles.tileActive, style]}
      onPress={onPress}
      // La tuile filtre la sélection « Recommandés » : un bouton à état, dont
      // l'état n'était dit que par un filet clair autour de la photo.
      accessibilityRole="button"
      {...etatBascule(active)}
      accessibilityLabel={`Catégorie ${cat.label}`}
    >
      {photoUrl ? (
        <>
          <Image
            source={{ uri: photoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
            recyclingKey={photoUrl}
            // `accessibilityLabel` et non `alt` : la documentation les donne
            // pour équivalents, mais vérifié dans le DOM, seul le premier pose
            // l'attribut `alt` sur le web. Un `<img>` sans `alt` est annoncé
            // par son URL, ce qui est pire que rien.
            accessibilityLabel={cat.kicker}
          />
          <PhotoScrim from="bottom" intensity={0.68} />
        </>
      ) : (
        <CategoryTexture tone={cat.tone} />
      )}
      <View style={styles.tileTextWrap}>
        <Text style={styles.tileKicker}>{cat.kicker}</Text>
        <Text style={styles.tileLabel}>{cat.label}</Text>
      </View>
    </Pressable>
  );
}

// Le composant partagé reçoit une URL déjà résolue — cet écran garde ses
// photos non triées (listing_photos brut), donc le tri/choix de la couverture
// reste ici plutôt que dans le composant.
function coverPhotoOf(item: EstablishmentWithPhoto): string | null {
  // Une photo rattachée à une offre décrit une chambre précise, pas le lieu :
  // elle ne peut pas servir de couverture à l'établissement.
  const sorted = [...(item.listing_photos ?? [])]
    .filter(p => !p.offer_id)
    .sort((a, b) => a.position - b.position);
  return sorted[0]?.url ?? null;
}

// Déclaré au niveau du module, pas dans HomeScreen : un composant défini
// pendant le rendu change d'identité à chaque passage, et React démonte puis
// remonte alors tout son sous-arbre au lieu de le mettre à jour.
function AvailabilityMarker({
  ville, selectionnable, onPress,
}: { ville: string | undefined; selectionnable: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={styles.availabilityRow}
      disabled={!selectionnable}
      onPress={onPress}
      accessibilityRole={selectionnable ? 'button' : undefined}
      accessibilityLabel={selectionnable ? `Ville : ${ville ?? ''}. Changer de ville` : undefined}
    >
      <Text style={styles.locationText}>
        Disponible actuellement à {ville ?? '…'}
      </Text>
      {selectionnable && <ChevronDown size={12} color={colors.onBrandMuted} />}
    </Pressable>
  );
}

export default function HomeScreen() {
  const { width, isDesktop, isWide, contentWidth } = useResponsive();
  const {
    selectedCity, cities, setSelectedCity, hasMultipleCities,
    loading: villesEnCours, erreur: erreurVilles, recharger: rechargerVilles,
  } = useSelectedCity();

  const [listings, setListings] = useState<EstablishmentWithPhoto[]>([]);
  const [activeCategory, setActiveCategory] = useState<EstablishmentType>('hotel');
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  // Incrémenté par « Réessayer » : relance le chargement sans changer de filtre.
  const [tentative, setTentative] = useState(0);
  const [heroPhotos, setHeroPhotos] = useState<string[]>([]);
  const [storyPhoto, setStoryPhoto] = useState<string | null>(null);
  const [categoryPhotos, setCategoryPhotos] = useState<Record<string, string | null>>({});
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const { haut } = useZonesSures();
  // Un défilement automatique est exactement ce que le réglage système
  // « réduire les animations » demande d'arrêter : la première photo reste.
  const mouvementReduit = useMouvementReduit();
  // Et ce que le visiteur doit pouvoir arrêter lui-même (WCAG 2.2.2) : la
  // pause tient jusqu'à ce qu'il relance, pas seulement le temps d'un survol.
  const [diaporamaEnPause, setDiaporamaEnPause] = useState(false);
  const diaporamaDefile = !mouvementReduit && !diaporamaEnPause;
  // Avec une seule photo, ou le mouvement déjà coupé par le système, il n'y a
  // rien à mettre en pause : le bouton ne s'affiche pas.
  const pauseUtile = heroPhotos.length > 1 && !mouvementReduit;

  const subdivisions = getCitySubdivisions(selectedCity?.name);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'home_hero_image_url').maybeSingle()
      .then(({ data }) => {
        try { setHeroPhotos(data?.value ? JSON.parse(data.value) : []); }
        catch { setHeroPhotos([]); }
      });
    supabase.from('app_settings').select('value').eq('key', 'home_story_image_url').maybeSingle()
      .then(({ data }) => setStoryPhoto(data?.value ?? null));
    // Photos de catégories — choisies à la main depuis l'admin (Apparence),
    // jamais dérivées automatiquement des établissements. Même mécanisme
    // (app_settings, clé/valeur) que le hero et la bande Fleuve Congo.
    supabase.from('app_settings').select('key, value')
      .in('key', CATEGORIES.map(c => c.settingKey))
      .then(({ data }) => {
        const map: Record<string, string | null> = {};
        (data ?? []).forEach((row: any) => { map[row.key] = row.value; });
        setCategoryPhotos(map);
      });
  }, []);

  useEffect(() => {
    if (!selectedCity) return;
    // Changer de catégorie deux fois de suite lance deux requêtes : sans ce
    // drapeau, la plus lente des deux écrasait la plus récente à son arrivée.
    let annule = false;
    setLoading(true);
    setErreur(false);

    (async () => {
      const { data, error } = await supabase
        .from('establishments')
        .select('*, listing_photos(*)')
        .eq('status', 'approved')
        .eq('type', activeCategory)
        .eq('city', selectedCity.name)
        .limit(10);
      if (annule) return;

      if (error) {
        // Une panne n'est pas une liste vide : dire « aucun établissement »
        // à quelqu'un dont le réseau vient de tomber, c'est lui mentir.
        setListings([]);
        setErreur(true);
        setLoading(false);
        return;
      }

      const lignes = (data as EstablishmentWithPhoto[]) ?? [];
      // Les notes des seuls établissements affichés. La requête lisait
      // auparavant la vue entière — tout le catalogue — pour dix cartes.
      const ids = lignes.map(e => e.id);
      const { data: ratings } = ids.length
        ? await supabase.from('establishment_ratings').select('*').in('establishment_id', ids)
        : { data: [] };
      if (annule) return;

      // Des notes manquantes ne bloquent pas l'affichage : les cartes
      // apparaissent sans note plutôt que pas du tout.
      const ratingMap = new Map<string, { avg_rating: number | null; review_count: number }>();
      (ratings ?? []).forEach((r: any) => {
        ratingMap.set(r.establishment_id, { avg_rating: r.avg_rating, review_count: r.review_count });
      });
      setListings(lignes.map(e => {
        const rating = ratingMap.get(e.id);
        return {
          ...e,
          avgRating: rating?.avg_rating != null ? Number(rating.avg_rating) : null,
          reviewCount: rating?.review_count ?? 0,
        };
      }));
      setLoading(false);
    })();

    return () => { annule = true; };
  }, [activeCategory, selectedCity, tentative]);

  // Rien n'est demandé tant qu'aucune ville n'est connue (voir l'effet
  // ci-dessus) : l'état affiché doit donc tenir compte des villes aussi. Sans
  // cela, une liste de villes illisible — ou vide — laissait `loading` à vrai
  // pour toujours, et les silhouettes de chargement ne partaient jamais.
  const enCours = villesEnCours || (!!selectedCity && loading);
  const enPanne = erreurVilles || erreur;
  const reessayer = () => {
    if (erreurVilles) rechargerVilles();
    else setTentative(t => t + 1);
  };

  const storyHeight = isDesktop ? 420 : isWide ? 380 : 320;
  // Colonne de contenu, gouttières déduites. Elle valait `contentWidth`, soit
  // toute la fenêtre sous 1 200 px : sur tablette et petit ordinateur, où les
  // titres de section n'avaient plus de retrait, le texte touchait le bord.
  // Sur téléphone et au-delà de 1 236 px, le résultat est le même qu'avant.
  const largeurColonne = Math.min(width - 2 * spacing.gutter, breakpoints.contentMax);
  const desktopColumns = 4;
  const desktopGap = spacing.md;
  const desktopCardWidth = isDesktop
    ? (largeurColonne - desktopGap * (desktopColumns - 1)) / desktopColumns
    : undefined;

  const wide = { maxWidth: largeurColonne, width: '100%' as const, alignSelf: 'center' as const };

  const marqueurVille = (
    <AvailabilityMarker
      ville={selectedCity?.name}
      selectionnable={hasMultipleCities}
      onPress={() => setCityPickerOpen(true)}
    />
  );

  // Cloche et pause du diaporama : les mêmes pastilles dans les deux mises en
  // page. Un bouton libellé plutôt qu'une pause au survol, qui n'existe ni au
  // clavier ni au doigt.
  const actionsHero = (
    <View style={styles.heroActions}>
      {pauseUtile && (
        <BoutonIcone
          label={diaporamaEnPause ? 'Relancer le défilement des photos' : 'Mettre en pause le défilement des photos'}
          fond={VOILE_PASTILLE}
          onPress={() => setDiaporamaEnPause(enPause => !enPause)}
          icon={diaporamaEnPause
            ? <Play size={15} color={colors.cream} strokeWidth={1.75} />
            : <Pause size={15} color={colors.cream} strokeWidth={1.75} />}
        />
      )}
      <BoutonIcone
        label="Notifications"
        fond={VOILE_PASTILLE}
        onPress={() => router.push('/notifications')}
        icon={<Bell size={17} color={colors.cream} strokeWidth={1.75} />}
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>

        {/* ── Hero ── */}
        {isDesktop ? (
          // Desktop : composition en deux panneaux — la photo est cadrée,
          // pas étirée bord à bord, et le texte vit sur un fond uni séparé.
          <View style={styles.heroDesktopOuter}>
            <View style={[wide, styles.heroDesktopRow]}>
              <View style={styles.heroPhotoPanel}>
                <RotatingHero photos={heroPhotos} width={contentWidth * 0.62} height={560} defile={diaporamaDefile} />
              </View>
              <View style={styles.heroContentPanel}>
                {/* Pas de logo ici : sur ordinateur, la barre de navigation du
                    haut (components/BarreBureau) porte déjà la marque, quelques
                    pixels au-dessus. */}
                <View style={styles.heroPanelTop}>
                  {actionsHero}
                </View>
                <View>
                  {marqueurVille}
                  <Text
                    accessibilityRole="header"
                    aria-level={1}
                    style={[styles.heroTitle, { fontSize: 44, lineHeight: 48, marginTop: spacing.v12 }]}
                  >
                    Découvrez la RDC{'\n'}autrement.
                  </Text>
                </View>
                <Pressable style={styles.searchBar} accessibilityRole="link" accessibilityLabel="Rechercher un hôtel, un restaurant ou un site" {...lienVers('/search')}>
                  <Search size={16} color={colors.faint} />
                  <Text style={styles.searchPlaceholder}>Hôtel, restaurant, site…</Text>
                  <View style={styles.filterBtn}>
                    <SlidersHorizontal size={14} color={colors.cream} />
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          // Mobile / tablette : la photo remonte jusqu'au niveau du titre —
          // le repère de lieu et le titre vivent dans l'image, pas sur un
          // fond de couleur séparé. La recherche reprend juste après, sur le
          // canevas crème normal de la page.
          <View style={[styles.heroPhotoZone, { height: isWide ? 460 : 400 }]}>
            <RotatingHero photos={heroPhotos} width={width} height={isWide ? 460 : 400} defile={diaporamaDefile} />
            <PhotoScrim from="top" intensity={0.4} />
            <PhotoScrim from="bottom" intensity={0.65} />
            <View style={[styles.topBarFloating, { top: haut }]}>
              <LogoLockup />
              {actionsHero}
            </View>
            <View style={styles.heroContentOverlay}>
              {marqueurVille}
              <Text
                accessibilityRole="header"
                aria-level={1}
                style={[styles.heroTitle, { fontSize: isWide ? 38 : 30, lineHeight: isWide ? 44 : 36, marginTop: spacing.v12 }]}
              >
                Découvrez la RDC{'\n'}autrement.
              </Text>
            </View>
          </View>
        )}

        {!isDesktop && (
          <View style={styles.searchZone}>
            <Pressable style={styles.searchBar} accessibilityRole="link" accessibilityLabel="Rechercher un hôtel, un restaurant ou un site" {...lienVers('/search')}>
              <Search size={16} color={colors.faint} />
              <Text style={styles.searchPlaceholder}>Hôtel, restaurant, site…</Text>
              <View style={styles.filterBtn}>
                <SlidersHorizontal size={14} color={colors.cream} />
              </View>
            </Pressable>
          </View>
        )}

        {/* ── Catégories ── */}
        <View style={styles.section}>
          <View style={wide}>
            <SectionHeading kicker="Explorez" title="Quatre façons de découvrir la RDC" />
          </View>
          <View style={{ marginTop: spacing.v12 }}>
            {isDesktop ? (
              <View style={[wide, styles.tilesRow]}>
                {CATEGORIES.map((cat, i) => (
                  <CategoryTile
                    key={cat.key}
                    cat={cat}
                    active={activeCategory === cat.key}
                    onPress={() => setActiveCategory(cat.key)}
                    photoUrl={categoryPhotos[cat.settingKey] ?? null}
                    style={{ flex: i === 0 ? 1.7 : 1, height: 260 }}
                  />
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.gutter, gap: spacing.v12 }}
              >
                {CATEGORIES.map((cat, i) => (
                  <CategoryTile
                    key={cat.key}
                    cat={cat}
                    active={activeCategory === cat.key}
                    onPress={() => setActiveCategory(cat.key)}
                    photoUrl={categoryPhotos[cat.settingKey] ?? null}
                    style={{ width: i === 0 ? 188 : 148, height: 220 }}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {/* ── Recommandés ── */}
        <View style={styles.section}>
          <View style={wide}>
            <SectionHeading
              kicker="Sélection"
              title={`Recommandés à ${selectedCity?.name ?? '…'}`}
              onSeeAll={() => router.push('/(tabs)/search')}
            />
          </View>

          {enCours ? (
            /* « Chargement... » en texte gris ne préparait à rien : la section
               restait haute d'une ligne, puis sautait à la hauteur des cartes.
               Les silhouettes reprennent la géométrie exacte des deux mises en
               page — grille au bureau, file horizontale sur mobile — donc
               l'arrivée des données ne fait plus bouger la page. */
            isDesktop ? (
              <View style={[wide, styles.desktopGrid]}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <View key={i} style={{ width: desktopCardWidth }}>
                    <SkeletonCarte />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.fileAttente}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <View key={i} style={{ width: 190 }}>
                    <SkeletonCarte />
                  </View>
                ))}
              </View>
            )
          ) : enPanne ? (
            <EmptyState
              icon={<WifiOff size={26} color={colors.faint} />}
              title="Chargement impossible"
              description="Les établissements n'ont pas pu être chargés. Vérifiez votre connexion, puis réessayez."
              actionLabel="Réessayer"
              onAction={reessayer}
            />
          ) : listings.length === 0 ? (
            <View style={wide}>
              <Text style={styles.emptyText}>
                Aucun établissement disponible dans cette catégorie pour le moment.
              </Text>
              <Text style={styles.emptySubtext}>
                Les établissements apparaîtront ici une fois approuvés.
              </Text>
            </View>
          ) : isDesktop ? (
            <View style={[wide, styles.desktopGrid]}>
              {listings.map(item => (
                <ListingCard
                  key={item.id}
                  type={item.type}
                  name={item.name}
                  location={item.neighborhood ?? item.city}
                  coverPhotoUrl={coverPhotoOf(item)}
                  avgRating={item.avgRating}
                  reviewCount={item.reviewCount}
                  width={desktopCardWidth}
                  href={`/listing/${item.id}`}
                />
              ))}
            </View>
          ) : (
            <FlatList
              data={listings}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ListingCard
                  type={item.type}
                  name={item.name}
                  location={item.neighborhood ?? item.city}
                  coverPhotoUrl={coverPhotoOf(item)}
                  avgRating={item.avgRating}
                  reviewCount={item.reviewCount}
                  width={190}
                  href={`/listing/${item.id}`}
                />
              )}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: spacing.gutter, paddingRight: spacing.sm }}
              ItemSeparatorComponent={() => <View style={{ width: spacing.v12 }} />}
              scrollEnabled
              nestedScrollEnabled
            />
          )}
        </View>

        {/* ── Bande "Le Fleuve Congo" ── */}
        <View style={[styles.storyBand, { height: storyHeight }]}>
          <View style={StyleSheet.absoluteFill}>
            {storyPhoto ? (
              <Image
            source={{ uri: storyPhoto }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
            recyclingKey={storyPhoto}
            accessibilityLabel="Le fleuve Congo"
          />
            ) : (
              <RiverMotif width={width} height={storyHeight} variant="band" />
            )}
          </View>
          {storyPhoto && <PhotoScrim from="bottom" intensity={0.5} />}
          <View style={[styles.storyContent, isWide && { maxWidth: 560, alignItems: 'flex-start' }]}>
            <Text style={styles.storyKicker}>Le fleuve Congo</Text>
            <View style={[styles.storyRule, isWide && { alignSelf: 'flex-start' }]} />
            <Text
              accessibilityRole="header"
              aria-level={2}
              style={[styles.storyTitle, isWide && { fontSize: 34, lineHeight: 40, textAlign: 'left' }]}
            >
              Il traverse la RDC de part en part.
            </Text>
            <Text style={[styles.storySub, isWide && { textAlign: 'left' }]}>
              Chaque adresse YakaRDC porte une part de cette histoire — des rives du
              fleuve aux collines et avenues qui font le pays.
            </Text>
          </View>
        </View>

        {/* ── Communes — seulement si la ville sélectionnée en a de configurées ── */}
        {subdivisions && (
          <View style={styles.section}>
            <View style={wide}>
              <SectionHeading kicker="À proximité" title={`Communes de ${selectedCity?.name}`} />
            </View>
            {/* Sur ordinateur, la file s'aligne sur la colonne centrée : elle
                partait du bord gauche de la fenêtre, loin sous son propre titre. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={isDesktop ? wide : undefined}
              contentContainerStyle={{ paddingHorizontal: isDesktop ? 0 : spacing.gutter, gap: spacing.v12, marginTop: spacing.v12 }}
            >
              {subdivisions.featured.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  icon={<MapPin size={12} color={colors.lave} />}
                  onPress={() => router.push({ pathname: '/(tabs)/search', params: { commune: c } })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Bande éditoriale ──
            Placée en fin de parcours plutôt qu'en tête : elle dit ce qu'est
            YakaRDC, ce qui intéresse le visiteur une fois qu'il a vu les
            adresses — pas avant d'avoir rien vu. Elle ferme la page au lieu
            de retarder son contenu. */}
        <View style={styles.introBand}>
          <Text style={[styles.introText, isWide && { fontSize: 20, lineHeight: 30, maxWidth: 620 }]}>
            YakaRDC réunit les adresses qui font la richesse de la RDC — hôtels, tables,
            maisons meublées et lieux à découvrir, sélectionnés avec exigence.
          </Text>
        </View>

        {hasMultipleCities && (
          <BottomSheet
            visible={cityPickerOpen}
            title="Choisir une ville"
            options={cities.map(c => c.name)}
            selected={selectedCity?.name ?? ''}
            onSelect={(name) => {
              const city = cities.find(c => c.name === name);
              if (city) setSelectedCity(city);
            }}
            onClose={() => setCityPickerOpen(false)}
          />
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },

  // Logo & top bar
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoText: {
    ...typography.brand, color: colors.cream,
    textShadowColor: colors.ombreTexte, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  // Écart de 12 et non de 8 : chaque pastille de 34 porte une zone tactile de
  // 44, et deux zones voisines ne doivent pas se recouvrir.
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.v12 },

  // Hero — mobile/tablette : la photo remonte jusqu'au titre, le texte vit dedans
  heroPhotoZone: { backgroundColor: colors.nuit, overflow: 'hidden', position: 'relative' },
  // `top` vient de la zone sûre mesurée (voir lib/zones), posé à l'appel.
  topBarFloating: {
    position: 'absolute',
    left: spacing.gutter, right: spacing.gutter,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    zIndex: 2,
  },
  heroContentOverlay: {
    position: 'absolute', left: spacing.v20, right: spacing.v20, bottom: 26, zIndex: 2,
  },
  searchZone: { backgroundColor: colors.cream, paddingHorizontal: spacing.v20, paddingTop: spacing.v20 },
  availabilityRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start',
    // Zone tactile de 44 px autour d'une ligne de 15 : les marges négatives
    // rendent le surplus, le repère reste à sa place au-dessus du titre.
    minHeight: cible.min, marginVertical: -(cible.min - HAUTEUR_REPERE) / 2,
  },
  locationText: {
    ...typography.overline, color: colors.onBrandMuted, letterSpacing: 0.6, textTransform: 'uppercase',
    textShadowColor: colors.ombreTexte, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  heroTitle: {
    ...typography.heroTitle, color: colors.cream,
    textShadowColor: colors.ombreTexte, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },

  // Hero — desktop (deux panneaux)
  heroDesktopOuter: { paddingTop: spacing.v20, paddingHorizontal: spacing.v20 },
  heroDesktopRow: { flexDirection: 'row', gap: spacing.xs, height: 560 },
  heroPhotoPanel: { flex: 1.6, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.nuit },
  heroContentPanel: {
    flex: 1, backgroundColor: colors.nuit, borderRadius: radii.lg,
    padding: spacing.xl, justifyContent: 'space-between',
  },
  heroPanelTop: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.v12,
    backgroundColor: colors.white, borderRadius: radii.md,
    paddingLeft: spacing.v12, paddingRight: spacing.sm, paddingVertical: spacing.v12,
  },
  searchPlaceholder: { flex: 1, ...typography.body, color: colors.faint },
  filterBtn: {
    width: 32, height: 32, borderRadius: radii.sm,
    backgroundColor: colors.lave, alignItems: 'center', justifyContent: 'center',
  },

  // Intro band
  introBand: {
    backgroundColor: colors.surfaceSunken,
    paddingVertical: 26, paddingHorizontal: spacing.xl, alignItems: 'center',
  },
  introText: {
    ...typography.displaySm,
    color: colors.laveDeep, textAlign: 'center', maxWidth: 520,
  },

  // Sections
  section: { marginTop: 26 },

  // Category tiles
  tilesRow: { flexDirection: 'row', gap: spacing.v12, paddingHorizontal: 0 },
  tile: {
    borderRadius: radii.lg, justifyContent: 'flex-end', overflow: 'hidden', position: 'relative',
  },
  tileActive: { borderWidth: 2, borderColor: colors.cream },
  tileTextWrap: { padding: spacing.md },
  tileKicker: {
    ...typography.overlineSm,
    textTransform: 'uppercase', color: colors.onBrandMuted, marginBottom: spacing.xs,
  },
  tileLabel: { ...typography.tileTitle, color: colors.cream },

  desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // Reprend la gouttière et l'écart de la file horizontale de cartes, pour
  // que les silhouettes tombent aux mêmes abscisses que les résultats.
  fileAttente: { flexDirection: 'row', gap: spacing.v12, paddingLeft: spacing.gutter, paddingRight: spacing.sm, overflow: 'hidden' },

  emptyText: { ...typography.body, color: colors.muted, paddingHorizontal: spacing.gutter },
  emptySubtext: { ...typography.caption, color: colors.faint, marginTop: spacing.xs, paddingHorizontal: spacing.gutter },

  // Story band
  storyBand: { marginTop: 30, position: 'relative', overflow: 'hidden' },
  storyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  storyKicker: { ...typography.overline, color: colors.amber, textTransform: 'uppercase' },
  storyRule: { width: 40, height: 1.5, backgroundColor: colors.amber, opacity: 0.6, marginTop: spacing.v12, marginBottom: spacing.md },
  storyTitle: {
    ...typography.editorialTitle,
    color: colors.cream, textAlign: 'center', marginBottom: spacing.v12,
  },
  storySub: {
    ...typography.body, color: colors.onBrandMuted, textAlign: 'center', maxWidth: 420,
  },

});
