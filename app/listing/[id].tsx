import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, Modal,
  ActivityIndicator, Linking, Share,
} from 'react-native';
import { Image } from 'expo-image';
import { Alert } from '../../lib/alert';
import { useLocalSearchParams, router } from 'expo-router';
import { goBack } from '../../lib/navigation';
import Svg, { Circle, Polygon, Path } from 'react-native-svg';
import {
  ArrowLeft, Heart, MapPin, Star, Wifi, Car,
  Wind, Coffee, Plus, Minus, X, Send,
  Phone, Mail, CalendarPlus, AlertCircle, Share2, Navigation, Flag,
  ChevronLeft, ChevronRight, MessageCircle, BadgeCheck, Pencil, Images, BookOpen, ChevronRight as ChevronRightSm,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { ecrire } from '../../lib/db';
import { messageErreur } from '../../lib/erreurs';
import { useSeo, SITE_URL, metaEtablissement } from '../../lib/seo';
import Skeleton from '../../components/Skeleton';
import { cheapestActiveOffer } from '../../lib/offers';
import { slotToTime, timeToSlot } from '../../lib/slots';
import { parseMenu, isMenuEmpty, countMenuItems, menuTitleFor } from '../../lib/menu';
import MenuSheet from '../../components/MenuSheet';
import type { OpeningHours } from '../../lib/opening-hours';
import { useAuth } from '../../lib/auth-context';
import { colors, categoryColors, spacing, typography, radii, cible } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';
import { useZonesSures } from '../../lib/zones';
import { useMouvementReduit } from '../../lib/motion';
import { lienVers } from '../../lib/liens';
import BoutonIcone from '../../components/BoutonIcone';
import { useConfirm } from '../../lib/confirm-context';
import { getOpeningStatus, isOpenOn } from '../../lib/opening-hours';
import FormField from '../../components/FormField';
import Sheet from '../../components/Sheet';
import OfferCard from '../../components/OfferCard';
import StepProgress from '../../components/StepProgress';
import Button from '../../components/Button';
import PhoneField from '../../components/PhoneField';
import DateField from '../../components/DateField';
import TimeField from '../../components/TimeField';
import { DEFAULT_DIAL, findByDial } from '../../lib/countries';
import { titleCase, sameValue, splitFullName, splitPhone, unitLabel } from '../../lib/listing-format';
import { slotStateFor } from '../../lib/booking-slots';
import type { TimeSlot } from '../../lib/booking-slots';
import {
  RESTAURANT_SLOT_STEP_MIN, SITE_SLOT_STEP_MIN, OCCASIONS, PAYMENTS,
} from '../../lib/booking-types';
import type {
  Availability, VenueContext, OfferContext,
  BaseForm, HotelForm, RestaurantForm, SiteForm,
} from '../../lib/booking-types';
import EmptyState from '../../components/EmptyState';
import {
  Counter, SlotPicker, BookingRecap, TicketRow,
  HotelBookingForm, RestaurantBookingForm, SiteBookingForm,
} from '../../components/BookingForms';
import ListingCard from '../../components/ListingCard';
import RiverMotif from '../../components/RiverMotif';
import PhotoScrim from '../../components/PhotoScrim';
import type { Establishment, EstablishmentType, ListingPhoto, Review, EstablishmentOffer, OfferCategory } from '../../lib/types';
import { unitsNeeded, offerLabel } from '../../lib/types';
import { PLANNING_ENABLED } from '../../lib/features';
import { etatBascule } from '../../lib/a11y';

// Établissement suggéré en fin de fiche, enrichi de sa photo et de son tarif
type SimilarEstablishment = Establishment & {
  coverPhoto: string | null;
  priceLabel?: string;
};

// Contact du support YakaRDC pour les signalements de fiche (point « Signaler
// une information incorrecte »). Aucune table de signalement dans ce lot :
// le lien ouvre une conversation pré-remplie.
const SUPPORT_WHATSAPP = '243819745279';

// Photo d'en-tête. 220 px conviennent à un téléphone ; à 1200 px de large,
// la même hauteur ne montrait plus qu'une tranche de 5:1 de la photo. Dès la
// tablette, la hauteur suit donc la largeur, sous un plafond qui laisse le
// début de la fiche visible sans défiler.
const HERO_MOBILE = 220;
const HERO_PROPORTION = 0.36;
const HERO_PLAFOND = 440;

// Pastille des commandes posées sur la photo (retour, partage, favori).
const FOND_COMMANDE = colors.white + 'CC';

// Côté d'une étoile du sélecteur de note.
const ETOILE = 34;
// Surplus d'une zone tactile de 44 px autour d'une ligne de texte `caption` :
// une marge négative de cette valeur agrandit la cible sans rien décaler.
const DEBORD_LIGNE = (cible.min - typography.caption.lineHeight) / 2;

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  'Wifi': <Wifi size={13} color={colors.fleuveDark} />,
  'Parking': <Car size={13} color={colors.fleuveDark} />,
  'Climatisation': <Wind size={13} color={colors.fleuveDark} />,
  'Petit-déjeuner': <Coffee size={13} color={colors.fleuveDark} />,
};

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const { width: heroWidth, isWide, isDesktop, contentWidth } = useResponsive();
  const { haut, bas, insets } = useZonesSures();
  const mouvementReduit = useMouvementReduit();
  const confirm = useConfirm();
  const wide = { maxWidth: contentWidth, width: '100%' as const, alignSelf: 'center' as const };
  const heroHeight = isWide
    ? Math.min(Math.round(heroWidth * HERO_PROPORTION), HERO_PLAFOND)
    : HERO_MOBILE;
  // Au-delà de la largeur de contenu, la photo reste en pleine largeur mais
  // ses commandes et son titre s'alignent sur la colonne centrée du corps,
  // au lieu de partir se coller aux bords de la fenêtre.
  const bordHero = (heroWidth - contentWidth) / 2 + spacing.md;
  const photoScrollRef = useRef<ScrollView>(null);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [offers, setOffers] = useState<EstablishmentOffer[]>([]);
  const [offerCategories, setOfferCategories] = useState<OfferCategory[]>([]);
  // Unités encore libres par offre, aux dates choisies. Vide tant qu'aucune
  // date n'est sélectionnée : on n'annonce pas une disponibilité non calculée.
  const [offerPhotos, setOfferPhotos] = useState<ListingPhoto[]>([]);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [menuPhotos, setMenuPhotos] = useState<ListingPhoto[]>([]);
  // Visionneuse plein écran, partagée entre la galerie principale et le menu.
  // `source` indique quelle collection est ouverte — une seule visionneuse,
  // paramétrée, plutôt qu'une seconde implémentation.
  const [viewer, setViewer] = useState<{ source: 'photos' | 'menu'; index: number } | null>(null);
  const [similar, setSimilar] = useState<SimilarEstablishment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [addingToPlan, setAddingToPlan] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // L'onglet, l'historique et l'aperçu de partage portent le nom de
  // l'établissement dès qu'il est connu, plutôt que « Fiche établissement ».
  // Une fiche suspendue ou non publiée n'est pas proposée aux moteurs.
  //
  // Une fiche introuvable non plus. Le serveur répond 200 à toute adresse
  // « /listing/<quelque chose> » — il sert le même gabarit, sans savoir si
  // l'établissement existe — et ce gabarit se déclare indexable, pour que les
  // fiches créées depuis le dernier déploiement puissent l'être. C'est donc ici
  // qu'une adresse sans établissement doit se retirer de l'index.
  useSeo(establishment ? {
    ...metaEtablissement(establishment, photos[0]?.url),
    index: establishment.status === 'approved' && !establishment.suspended_at,
  } : loadError ? {
    title: 'Établissement introuvable',
    path: `/listing/${id}`,
    index: false,
  } : null);

  // Disponibilités
  const [fullDays, setFullDays] = useState<Set<string>>(new Set());
  const [slotLoads, setSlotLoads] = useState<Record<string, number>>({});
  // Charge par offre et par créneau : { offerId: { '12h00': 4 } }
  const [offerSlotLoad, setOfferSlotLoad] = useState<Record<string, Record<string, number>>>({});

  // Pré-remplissage depuis le profil connecté. `profiles.full_name` existait
  // déjà mais n'était pas utilisé : l'utilisateur retapait son nom à chaque
  // réservation. Le premier mot est traité comme prénom, le reste comme nom —
  // approximation assumée, les champs restent modifiables.
  const prefill = splitFullName(profile?.full_name);
  const prefillPhone = splitPhone(profile?.phone);
  const base = {
    offerId: '',
    firstName: prefill.firstName, lastName: prefill.lastName, postName: '',
    phoneDial: prefillPhone.dial, phone: prefillPhone.number,
    email: profile?.email ?? '',
    notes: '',
  };

  const [hotelForm, setHotelForm] = useState<HotelForm>({
    ...base,
    adults: 1, children: 0, checkIn: '', checkOut: '', arrivalTime: '', paymentMethod: 'cash',
  });
  const [restaurantForm, setRestaurantForm] = useState<RestaurantForm>({
    ...base,
    adults: 2, children: 0, visitDate: '', timeSlot: '', occasion: 'none', allergies: '',
  });
  const [siteForm, setSiteForm] = useState<SiteForm>({
    ...base,
    adults: 1, children: 0, visitDate: '', timeSlot: '', visitType: 'guided', nationality: 'congolaise',
    cart: {},
  });

  // Le profil arrive DEUX tours asynchrones après le montage (getSession puis
  // loadProfile). L'initialiseur de useState ci-dessus n'est lu qu'au premier
  // rendu, quand `profile` vaut encore null : sans cet effet, les champs
  // restent vides pour toujours. C'était déjà le cas du téléphone avant
  // l'ajout des autres champs — le pré-remplissage n'a jamais fonctionné.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !profile) return;
    prefilled.current = true;

    const { firstName, lastName } = splitFullName(profile.full_name);
    const { dial, number } = splitPhone(profile.phone);
    const email = profile.email ?? '';

    // On ne remplit que les champs encore vides : si l'utilisateur a déjà
    // commencé à saisir pendant le chargement, sa frappe n'est pas écrasée.
    function patch<T extends BaseForm>(f: T): T {
      return {
        ...f,
        firstName: f.firstName || firstName,
        lastName: f.lastName || lastName,
        email: f.email || email,
        // L'indicatif ne change que si aucun numéro n'a été saisi, sinon on
        // écraserait un choix délibéré de l'utilisateur.
        phoneDial: f.phone ? f.phoneDial : dial,
        phone: f.phone || number,
      };
    }

    setHotelForm(patch);
    setRestaurantForm(patch);
    setSiteForm(patch);
  }, [profile]);

  const loadEstablishment = useCallback(async () => {
    setLoadError(false);
    const { data, error } = await supabase
      .from('establishments').select('*').eq('id', id).single();

    // Un id inexistant renvoie une erreur PostgREST, pas une donnée nulle
    // silencieuse : sans cette branche, l'écran restait en spinner indéfiniment.
    if (error || !data) { setLoadError(true); return; }
    setEstablishment(data as Establishment);

    // Offres actives + leur catégorie. Remplace la lecture de `rates` : le
    // prix affiché est désormais le minimum des offres, calculé ici.
    supabase.from('establishment_offers')
      .select('*, offer_categories(*)')
      .eq('establishment_id', id).eq('is_active', true)
      .order('price', { ascending: true })
      .then(({ data: o }) => {
        const rows = (o as any[]) ?? [];
        setOffers(rows.map(r => r as EstablishmentOffer));
        setOfferCategories(rows.map(r => r.offer_categories).filter(Boolean) as OfferCategory[]);
      });
    supabase.from('listing_photos').select('*').eq('establishment_id', id).order('position', { ascending: true })
      .then(({ data: p }) => {
        const all = (p as ListingPhoto[]) ?? [];
        // offer_id renseigné = photo d'une offre précise, pas du lieu : exclue
        // de la galerie du hero (elle s'affichera au choix de l'offre, lot B2).
        setPhotos(all.filter(x => !x.offer_id && (!x.category || x.category === 'general')));
        setMenuPhotos(all.filter(x => x.category === 'menu' || x.category === 'pricing'));
        setOfferPhotos(all.filter(x => !!x.offer_id));
      });
    // Compte cette visite pour les statistiques du partenaire (une fois par ouverture)
    supabase.rpc('increment_establishment_views', { p_establishment_id: id });
  }, [id]);

  useEffect(() => { loadEstablishment(); }, [loadEstablishment]);

  // Charge les journées complètes sur 4 mois, à l'ouverture du formulaire
  // Occupation par offre sur quatre mois. Sert à deux choses : griser les
  // journées complètes du calendrier (pour l'offre choisie), et annoncer le
  // restant sur chaque carte de la fiche.
  //
  // Le calcul est par offre, plus par établissement : « Suite complète » ne
  // doit plus empêcher de réserver une Standard. Une offre sans `quantity`
  // déclarée n'est jamais complète.
  const [offerLoad, setOfferLoad] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (offers.length === 0) { setOfferLoad({}); return; }
    const from = new Date();
    const to = new Date();
    to.setMonth(to.getMonth() + 4);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    supabase.rpc('establishment_offer_load', {
      p_establishment_id: id,
      p_from: iso(from),
      p_to: iso(to),
    }).then(({ data, error }) => {
      // La migration 0009 peut ne pas être appliquée : on dégrade en
      // « aucune occupation connue » plutôt que de bloquer la réservation.
      if (error) { setOfferLoad({}); return; }
      const map: Record<string, Record<string, number>> = {};
      ((data as any[]) ?? []).forEach(row => {
        (map[row.offer_id] ??= {})[row.day] = row.units;
      });
      setOfferLoad(map);
    });
  }, [id, offers.length]);

  // Charge la fréquentation par créneau quand la date choisie change
  const selectedVisitDate =
    establishment?.type === 'restaurant' ? restaurantForm.visitDate :
    establishment?.type === 'site' ? siteForm.visitDate : '';

  useEffect(() => {
    if (!selectedVisitDate) { setSlotLoads({}); return; }
    supabase.rpc('establishment_slot_load', {
      p_establishment_id: id,
      p_date: selectedVisitDate,
    }).then(({ data }) => {
      const loads: Record<string, number> = {};
      // Les fonctions SQL renvoient un `time` (« 19:30:00 ») ; les clés de
      // ce dictionnaire sont des libellés d'affichage (« 19h30 »). Sans cette
      // conversion, aucune correspondance n'est jamais trouvée et la charge
      // paraît toujours nulle.
      ((data as any[]) ?? []).forEach(row => { loads[timeToSlot(row.slot)] = row.guests; });
      setSlotLoads(loads);
    });

    // Même charge, mais ventilée par offre : c'est elle qui vaut pour les
    // billets et les formules, dont la capacité est déclarée par créneau.
    supabase.rpc('establishment_offer_slot_load', {
      p_establishment_id: id,
      p_date: selectedVisitDate,
    }).then(({ data, error }) => {
      // Migration 0009 pas encore appliquée : on dégrade en « occupation
      // inconnue » plutôt que de bloquer la réservation.
      if (error) { setOfferSlotLoad({}); return; }
      const map: Record<string, Record<string, number>> = {};
      ((data as any[]) ?? []).forEach(row => {
        (map[row.offer_id] ??= {})[timeToSlot(row.slot)] = row.units;
      });
      setOfferSlotLoad(map);
    });
  }, [selectedVisitDate, id]);

  // Établissements similaires — même type, même commune, hors fiche courante.
  // Chargés après l'établissement, car ils dépendent de son type/commune.
  const [menuOpen, setMenuOpen] = useState(false);

  // La carte écrite est du JSON libre : on la relit défensivement plutôt que
  // de faire confiance à sa forme. Voir lib/menu.ts.
  const menu = useMemo(
    () => parseMenu(establishment?.menu),
    [establishment?.menu],
  );

  /**
   * Jours de fermeture sur la fenêtre de réservation.
   *
   * Bornée à 120 jours : le calendrier n'en montre jamais autant, et calculer
   * l'infini pour griser trois cases serait absurde. Vide tant qu'aucun
   * horaire n'est publié — on ne barre pas des jours qu'on ne connaît pas.
   */
  const closedDays = useMemo(() => {
    const out = new Set<string>();
    const oh = establishment?.opening_hours ?? null;
    if (!oh) return out;
    const start = new Date();
    for (let i = 0; i < 120; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      if (isOpenOn(oh, iso) === false) out.add(iso);
    }
    return out;
  }, [establishment?.opening_hours]);

  useEffect(() => {
    if (!establishment) return;
    let cancelled = false;

    (async () => {
      let q = supabase.from('establishments')
        .select('*, listing_photos(*), establishment_offers(price, currency, unit, is_active)')
        .eq('type', establishment.type)
        .eq('status', 'approved')
        .neq('id', establishment.id)
        .limit(3);
      // Comparaison insensible a la casse : des donnees saisies a la main
      // ont deja contenu « gombe » et « Gombe », ce qui faisait disparaitre
      // les etablissements voisins sans que rien ne le signale.
      q = establishment.commune
        ? q.ilike('commune', establishment.commune.trim())
        : q.ilike('city', establishment.city.trim());

      const { data } = await q;
      if (cancelled) return;

      setSimilar(((data as any[]) ?? []).map(e => {
        const photo = (e.listing_photos ?? [])
          .filter((p: any) => !p.offer_id && (!p.category || p.category === 'general'))
          .sort((a: any, b: any) => a.position - b.position)[0];
        // « À partir de » : l'offre active la moins chère, comme en recherche.
        const r = cheapestActiveOffer(e.establishment_offers as any[]);
        return {
          ...e,
          coverPhoto: photo?.url ?? null,
          priceLabel: r ? `${r.price} ${r.currency} ${unitLabel(r.unit)}`.trim() : 'Tarif sur demande',
        } as SimilarEstablishment;
      }));
    })();

    return () => { cancelled = true; };
  }, [establishment]);

  const fetchReviews = useCallback(async () => {
    const { data } = await supabase.from('reviews').select('*')
      .eq('establishment_id', id)
      .order('created_at', { ascending: false });
    const all = (data as Review[]) ?? [];
    setReviews(all);
    const mine = session?.user ? all.find(r => r.traveler_id === session.user.id) ?? null : null;
    setMyReview(mine);
  }, [id, session?.user?.id]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  // Garde d'authentification commune aux actions réservées aux comptes.
  // Cette fiche est atteignable sans session (lien partagé), donc le cas est
  // fréquent : on redirige vers la connexion en expliquant pourquoi, et on
  // revient ici une fois connecté. Volontairement pas d'Alert.alert : cet
  // écran tourne aussi sur le web, où Alert est dégradé — une alerte muette
  // recréerait l'échec silencieux qu'on corrige.
  function requireAuth(reason: string): boolean {
    if (session?.user) return true;
    router.push({
      pathname: '/(auth)/login',
      params: { redirect: `/listing/${id}`, reason },
    });
    return false;
  }

  // Gardée à l'ouverture, pas seulement à l'envoi : sans cela, un visiteur non
  // connecté remplit tout le formulaire avant de découvrir qu'il lui faut un
  // compte, et perd sa saisie.
  function openBookingForm() {
    if (!requireAuth('Connectez-vous pour réserver dans cet établissement.')) return;
    setShowForm(true);
  }

  function openReviewForm() {
    if (!requireAuth('Connectez-vous pour partager votre avis sur cet établissement.')) return;
    setReviewRating(myReview?.rating ?? 0);
    setReviewComment(myReview?.comment ?? '');
    setShowReviewForm(true);
  }

  async function handleSaveReview() {
    if (!requireAuth('Connectez-vous pour publier votre avis.')) return;
    if (!session?.user || reviewRating === 0) return;
    setSavingReview(true);

    const payload = {
      establishment_id: id,
      traveler_id: session.user.id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    };

    const { error } = myReview
      ? await supabase.from('reviews').update(payload).eq('id', myReview.id)
      : await supabase.from('reviews').insert(payload);

    setSavingReview(false);
    if (error) { Alert.alert('Avis non enregistré', messageErreur(error, "Votre avis n'a pas pu être enregistré. Réessayez dans un instant.")); return; }

    setShowReviewForm(false);
    fetchReviews();
  }

  async function confirmDeleteReview() {
    if (!myReview) return;
    const ok = await confirm({
      title: 'Supprimer mon avis',
      message: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    // L'avis ne quitte l'écran que si la base l'a réellement supprimé.
    const supprime = await ecrire(
      supabase.from('reviews').delete().eq('id', myReview.id),
      "Suppression de l'avis",
    );
    if (!supprime) return;
    setShowReviewForm(false);
    fetchReviews();
  }

  useEffect(() => {
    if (!session?.user) return;
    supabase.from('favorites').select('id')
      .eq('traveler_id', session.user.id).eq('establishment_id', id)
      .maybeSingle()
      .then(({ data }) => setIsFavorited(!!data));
  }, [id, session?.user?.id]);

  async function toggleFavorite() {
    if (!requireAuth('Connectez-vous pour enregistrer cet établissement dans vos favoris.')) return;
    if (!session?.user || favoriteLoading) return;
    setFavoriteLoading(true);
    // Le cœur ne bascule que si la base a suivi : sinon le voyageur croit
    // avoir enregistré la fiche et ne la retrouve pas dans ses favoris.
    if (isFavorited) {
      const retire = await ecrire(
        supabase.from('favorites').delete()
          .eq('traveler_id', session.user.id).eq('establishment_id', id),
        'Retrait des favoris',
      );
      if (retire) setIsFavorited(false);
    } else {
      const ajoute = await ecrire(
        supabase.from('favorites').insert({
          traveler_id: session.user.id,
          establishment_id: id,
        }),
        'Ajout aux favoris',
      );
      if (ajoute) setIsFavorited(true);
    }
    setFavoriteLoading(false);
  }

  async function handleAddToPlanning() {
    if (!requireAuth('Connectez-vous pour ajouter cet établissement à votre planning.')) return;
    if (!session?.user || !establishment) return;
    setAddingToPlan(true);

    const { data: plans } = await supabase.from('trip_plans')
      .select('id').eq('traveler_id', session.user.id)
      .order('created_at', { ascending: false }).limit(1);

    const activeTrip = plans?.[0];
    if (!activeTrip) {
      setAddingToPlan(false);
      Alert.alert(
        'Aucun voyage en cours',
        "Créez d'abord un voyage dans l'onglet Planning, puis revenez ajouter cet établissement.",
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Aller à Planning', onPress: () => router.push('/(tabs)/planner') },
        ]
      );
      return;
    }

    const { count } = await supabase.from('trip_plan_items')
      .select('id', { count: 'exact', head: true })
      .eq('trip_plan_id', activeTrip.id).eq('item_type', 'wishlist');

    const ajoute = await ecrire(
      supabase.from('trip_plan_items').insert({
        trip_plan_id: activeTrip.id,
        establishment_id: establishment.id,
        item_type: 'wishlist',
        title: establishment.name,
        estimated_cost: offers[0]?.price ?? 0,
        position: count ?? 0,
      }),
      'Ajout au planning',
    );

    setAddingToPlan(false);
    // « Ajouté ! » n'a de sens que si l'ajout a eu lieu : l'échec a déjà été
    // annoncé par ecrire(), inutile d'affirmer le contraire par-dessus.
    if (!ajoute) return;
    Alert.alert('Ajouté !', `${establishment.name} a été ajouté à votre planning, dans "Lieux à visiter".`);
  }

  if (loadError) {
    return (
      <View style={styles.loading}>
        <EmptyState
          niveau={1}
          icon={<AlertCircle size={40} color={colors.borderStrong} strokeWidth={1.75} />}
          title="Établissement introuvable"
          description="Cette fiche n'existe plus, ou la connexion a échoué. Vérifiez votre réseau et réessayez."
          actionLabel="Réessayer"
          onAction={loadEstablishment}
        />
        <Pressable style={styles.errorBackLink} accessibilityRole="button" onPress={() => goBack('/(tabs)')}>
          <Text style={styles.errorBackText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (!establishment) {
    // Le disque centré ne disait rien de la fiche à venir, et la page sautait
    // d'un écran vide à une mise en page complète. La silhouette reprend la
    // structure réelle — photo, puis nom, lieu, et le début du texte —
    // pour que le contenu s'installe à la place déjà réservée.
    return (
      <View style={styles.screen}>
        <Skeleton height={heroHeight} radius={0} />
        <View style={[styles.attenteCorps, isWide && wide]}>
          <Skeleton width="68%" height={22} radius={radii.pill} />
          <Skeleton width="42%" height={13} radius={radii.pill} />
          <View style={{ height: spacing.sm }} />
          <Skeleton width="100%" height={12} radius={radii.pill} />
          <Skeleton width="94%" height={12} radius={radii.pill} />
          <Skeleton width="76%" height={12} radius={radii.pill} />
        </View>
      </View>
    );
  }

  const cat = categoryColors[establishment.type];
  const accent = cat?.accent ?? colors.lave;
  const soft = cat?.soft ?? colors.laveSoft;
  const isHotel = establishment.type === 'hotel' || establishment.type === 'furnished_house';
  const isRestaurant = establishment.type === 'restaurant';
  const isSite = establishment.type === 'site';
  const menuSectionTitle = menuTitleFor(establishment.type);

  // Ce que la ligne annonce avant l'ouverture : le voyageur doit savoir s'il
  // va trouver des plats détaillés ou seulement une photo de la carte.
  const menuItemCount = countMenuItems(menu);
  const menuRowMeta = menuItemCount > 0
    ? `${menuItemCount} ${isRestaurant ? (menuItemCount > 1 ? 'plats' : 'plat') : (menuItemCount > 1 ? 'entrées' : 'entrée')}${menuPhotos.length > 0 ? ' · photos de la carte' : ''}`
    : `${menuPhotos.length} photo${menuPhotos.length > 1 ? 's' : ''} de la carte`;
  // Le voyageur ne parle pas d'« offres » : le titre suit le type de lieu.
  const offerSectionTitle = isHotel
    ? (establishment.type === 'furnished_house' ? 'Logements proposés' : 'Chambres proposées')
    : isRestaurant ? 'Formules' : 'Billets';

  const availability: Availability = {
    fullDays,
    slotLoads,
    closedDays,
  };

  // Note moyenne réelle, calculée depuis les avis chargés
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;

  // Filet de sécurité : l'ouverture du formulaire est déjà gardée (openBookingForm),
  // donc ce cas ne devrait pas se produire — mais on ne se repose pas sur le
  // masquage d'un bouton, qui est fragile.
  async function handleSubmit() {
    if (!requireAuth('Connectez-vous pour envoyer votre demande de réservation.')) return;
    if (!session?.user) return;
    setSubmitting(true);
    let payload: any = { establishment_id: id, traveler_id: session.user.id };

    // Champs communs aux trois formulaires. `time_slot` ne figure plus dans
    // metadata : il dupliquait à l'identique la colonne visit_time.
    const common = (f: BaseForm) => ({
      first_name: f.firstName,
      last_name: f.lastName,
      post_name: f.postName.trim() || null,
      contact_phone: f.phone.trim() ? `${f.phoneDial} ${f.phone.trim()}` : null,
      phone_country_code: f.phoneDial,
      contact_email: f.email.trim() || null,
      guests: f.adults,
      children: f.children,
      notes: f.notes || null,
    });

    if (isHotel) {
      const f = hotelForm;
      if (!f.firstName || !f.lastName || !f.checkIn || !f.checkOut) {
        Alert.alert('Champs requis', 'Veuillez remplir prénom, nom et les dates.');
        setSubmitting(false); return;
      }
      payload = { ...payload, ...common(f),
        check_in: f.checkIn, check_out: f.checkOut,
        arrival_time: f.arrivalTime.trim() || null,
        metadata: { payment_method: f.paymentMethod } };
    } else if (isRestaurant) {
      const f = restaurantForm;
      if (!f.firstName || !f.lastName || !f.visitDate || !f.timeSlot) {
        Alert.alert('Champs requis', 'Veuillez remplir prénom, nom, date et créneau.');
        setSubmitting(false); return;
      }
      payload = { ...payload, ...common(f),
        // « 19h30 » est un libellé d'affichage ; la colonne est de type time.
        visit_date: f.visitDate, visit_time: slotToTime(f.timeSlot),
        metadata: { occasion: f.occasion, allergies: f.allergies } };
    } else if (isSite) {
      const f = siteForm;
      if (!f.firstName || !f.lastName || !f.visitDate || !f.timeSlot) {
        Alert.alert('Champs requis', 'Veuillez remplir prénom, nom, date et créneau.');
        setSubmitting(false); return;
      }
      // Avec billetterie, le panier EST la composition du groupe : le nombre
      // de voyageurs doit compter les billets, sinon le partenaire verrait
      // « 1 personne » pour une réservation de six entrées.
      const tickets = Object.values(f.cart).reduce((a, b) => a + b, 0);
      if (offers.length > 0 && tickets === 0) {
        Alert.alert('Aucun billet', 'Choisissez au moins un billet.');
        setSubmitting(false); return;
      }
      payload = { ...payload, ...common(f),
        guests: offers.length > 0 ? tickets : f.adults,
        children: offers.length > 0 ? 0 : f.children,
        visit_date: f.visitDate, visit_time: slotToTime(f.timeSlot),
        metadata: { visit_type: f.visitType, nationality: f.nationality } };
    }

    // L'échafaudage de repli 42703 du lot A a été retiré : la migration 0005
    // est appliquée, les colonnes de contact existent.
    const { data: created, error } = await supabase
      .from('bookings').insert(payload).select('id').single();

    if (error || !created) {
      setSubmitting(false);
      // `messageErreur` restitue le message de nos déclencheurs (« il ne reste
      // que 2 places pour cette date ») et traduit le reste.
      Alert.alert('Réservation impossible', messageErreur(error, "La demande n'a pas pu être enregistrée. Réessayez dans un instant."));
      return;
    }

    // Lignes de réservation : ce qui est réellement réservé, avec le prix gelé.
    // Le panier de billets d'un site en produit plusieurs ; un séjour une seule,
    // dont la quantité est le nombre d'unités occupées.
    const items = buildBookingItems(created.id);
    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('booking_items').insert(items);
      if (itemsError) {
        // La réservation existe mais sans ligne : on l'annule plutôt que de
        // laisser une demande sans contenu, que le partenaire ne saurait pas
        // honorer. Le message porte la cause réelle (souvent : offre complète).
        // Résultat volontairement ignoré : le voyageur voit déjà « Réservation
        // impossible » juste en dessous, avec la cause réelle. Une seconde
        // alerte sur l'échec du nettoyage ne lui apprendrait rien d'actionnable.
        // Le seul risque résiduel est une réservation sans ligne côté partenaire.
        await supabase.from('bookings').delete().eq('id', created.id);
        setSubmitting(false);
        Alert.alert(
          'Réservation impossible',
          messageErreur(itemsError, 'Cette offre ne peut pas être réservée à ces dates.'),
        );
        return;
      }
    }

    setSubmitting(false);
    setShowForm(false);
    setSuccess(true);
  }

  // Prix affiché = le plus bas des offres actives. Les offres sont déjà
  // triées par prix croissant à la requête, donc la première fait foi.
  const cheapestOffer = offers[0] ?? null;
  const priceLabel = cheapestOffer
    ? `${cheapestOffer.price} ${cheapestOffer.currency} ${unitLabel(cheapestOffer.unit)}`.trim()
    : 'Tarif sur demande';

  function categoryOf(offer: EstablishmentOffer) {
    return offerCategories.find(c => c.id === offer.category_id);
  }
  function offerPhotoOf(offerId: string): string | null {
    return offerPhotos.find(p => p.offer_id === offerId)?.url ?? null;
  }

  /**
   * Unités encore libres pour une offre sur une plage de dates.
   * `null` = aucune limite déclarée, donc jamais complet.
   * On retient le MINIMUM sur la plage : une seule nuit saturée suffit à
   * empêcher le séjour entier.
   */
  function remainingFor(offer: EstablishmentOffer, days: string[]): number | null {
    if (offer.quantity == null) return null;
    const load = offerLoad[offer.id] ?? {};
    if (days.length === 0) return offer.quantity;
    return days.reduce(
      (min, d) => Math.min(min, offer.quantity! - (load[d] ?? 0)),
      offer.quantity,
    );
  }

  function remainingForSlot(offer: EstablishmentOffer, date: string, slot: string): number | null {
    if (offer.quantity == null || !date || !slot) return null;
    const used = offerSlotLoad[offer.id]?.[slot] ?? 0;
    return Math.max(0, offer.quantity - used);
  }

  /** Journées complètes pour une offre — grise le calendrier. */
  function fullDaysFor(offer: EstablishmentOffer | null): Set<string> {
    if (!offer || offer.quantity == null) return new Set();
    const load = offerLoad[offer.id] ?? {};
    const full = new Set<string>();
    Object.entries(load).forEach(([day, units]) => {
      if (units >= offer.quantity!) full.add(day);
    });
    return full;
  }

  /** Nuits occupées par un séjour — départ exclu, comme en base. */
  function nightsBetween(checkIn: string, checkOut: string): string[] {
    if (!checkIn || !checkOut) return [];
    const out: string[] = [];
    const cur = new Date(checkIn);
    const last = new Date(checkOut);
    while (cur < last) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  // Photos de carte (restaurant) ou de grille tarifaire (site), consultables
  // depuis le formulaire sans le fermer.
  const venueCtx: VenueContext = {
    openingHours: establishment?.opening_hours ?? null,
  };

  /**
   * Lignes à enregistrer pour une réservation.
   * Hôtel/maison : une ligne, dont la quantité est le nombre d'unités occupées
   * (un groupe plus grand que la capacité d'une chambre en occupe plusieurs).
   * Restaurant : une ligne si une formule a été choisie, aucune sinon — on
   * réserve une table, pas obligatoirement un menu.
   * Site : une ligne par type de billet retenu.
   */
  function buildBookingItems(bookingId: string) {
    const line = (offerId: string, quantity: number) => {
      const o = offers.find(x => x.id === offerId);
      if (!o || quantity <= 0) return null;
      return {
        booking_id: bookingId, offer_id: o.id,
        quantity, unit_price: o.price, currency: o.currency,
      };
    };

    if (isHotel) {
      const o = offers.find(x => x.id === hotelForm.offerId);
      if (!o) return [];
      return [line(o.id, unitsNeeded(o, hotelForm.adults + hotelForm.children))].filter(Boolean) as any[];
    }
    if (isRestaurant) {
      return restaurantForm.offerId ? ([line(restaurantForm.offerId, 1)].filter(Boolean) as any[]) : [];
    }
    // Site : panier de billets
    return Object.entries(siteForm.cart)
      .map(([offerId, qty]) => line(offerId, qty))
      .filter(Boolean) as any[];
  }

  const offerCtx: OfferContext = {
    offers,
    categoryOf,
    photoOf: offerPhotoOf,
    remainingFor,
    remainingForSlot,
    fullDaysFor,
    closedDays,
    nightsBetween,
  };

  // Dates actuellement retenues, selon le type de formulaire. Vide tant que
  // rien n'est choisi — auquel cas aucune disponibilité n'est annoncée.
  const selectedDays: string[] = isHotel
    ? nightsBetween(hotelForm.checkIn, hotelForm.checkOut)
    : isRestaurant
      ? (restaurantForm.visitDate ? [restaurantForm.visitDate] : [])
      : (siteForm.visitDate ? [siteForm.visitDate] : []);

  // URL publique de la fiche — sert au partage et au signalement.
  const listingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/listing/${id}`
    : `${SITE_URL}/listing/${id}`;

  async function handleShare() {
    try {
      await Share.share({
        title: establishment!.name,
        message: `${establishment!.name} — ${listingUrl}`,
        url: listingUrl,
      });
    } catch {
      // Partage annulé ou indisponible : rien à signaler à l'utilisateur.
    }
  }

  // Adresse en texte libre, pour la recherche Google Maps. On ne s'appuie pas
  // sur lat/lng : le formulaire partenaire ne les collecte pas, donc tout
  // nouvel établissement naîtrait sans coordonnées.
  const addressQuery = [
    establishment.name,
    establishment.avenue ? `Avenue ${establishment.avenue}` : null,
    establishment.numero,
    establishment.commune ? titleCase(establishment.commune) : null,
    establishment.city,
  ].filter(Boolean).join(', ');

  function openDirections() {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`);
  }

  function reportListing() {
    const msg = `Bonjour, je signale une information incorrecte sur cette fiche YakaRDC :\n\n${establishment!.name}\n${listingUrl}\n\nProblème constaté : `;
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`);
  }

  // Ligne d'adresse : la commune n'est pas répétée si le quartier porte déjà
  // la même valeur (« Commune de Gombe, Gombe » dans les données actuelles).
  const communeLabel = establishment.commune ? titleCase(establishment.commune) : null;
  const neighborhoodLabel = establishment.neighborhood ? titleCase(establishment.neighborhood) : null;
  const showNeighborhood = neighborhoodLabel && !sameValue(establishment.commune, establishment.neighborhood);

  const streetLine = establishment.avenue
    ? `Avenue ${titleCase(establishment.avenue)}${establishment.numero ? `, n°${establishment.numero}` : ''}`
    : null;
  const areaLine = [communeLabel, showNeighborhood ? neighborhoodLabel : null, establishment.city]
    .filter(Boolean).join(' · ');

  const viewerPhotos = viewer?.source === 'menu' ? menuPhotos : photos;
  const viewerPhoto = viewer ? viewerPhotos[viewer.index] : null;

  // Ligne d'état des horaires. `null` quand la colonne est vide : on n'affiche
  // alors rien, plutôt qu'un « Fermé » par défaut qui serait faux.
  const opening = getOpeningStatus(establishment.opening_hours);
  const openingStatus = opening && {
    label: opening.label,
    tone: opening.state === 'open' ? colors.success
      : opening.state === 'closing_soon' ? colors.warning
      : colors.muted,
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.hero, { height: heroHeight, backgroundColor: soft }]}>
          {photos.length > 0 ? (
            <>
              <ScrollView
                ref={photoScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / heroWidth);
                  setActivePhotoIndex(index);
                }}
              >
                {/* Images nues, sans Pressable : à l'intérieur d'un ScrollView
                    pagingEnabled, le geste de défilement capte le toucher et
                    onPress ne se déclenche pas (confirmé sur appareil). La
                    galerie s'ouvre par le bouton explicite ci-dessous, qui est
                    de toute façon plus découvrable qu'un appui invisible. */}
                {photos.map((photo, i) => (
                  <Image
                    key={photo.id}
                    source={{ uri: photo.url }}
                    style={{ width: heroWidth, height: '100%' }}
                    contentFit="cover"
                    transition={mouvementReduit ? 0 : 220}
                    cachePolicy="memory-disk"
                    // La première photo décide de la première impression de la
                    // fiche : elle est demandée en priorité haute, les suivantes
                    // au régime normal puisqu'il faut défiler pour les voir.
                    priority={i === 0 ? 'high' : 'normal'}
                    recyclingKey={photo.url}
                    accessibilityLabel={`${establishment.name} — photo ${i + 1} sur ${photos.length}`}
                  />
                ))}
              </ScrollView>
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <PhotoScrim from="bottom" intensity={0.5} />
              </View>
              {photos.length > 1 && (
                <View style={styles.photoDots}>
                  {photos.map((_, i) => (
                    <Pressable
                      key={i}
                      style={styles.photoDotZone}
                      accessibilityRole="button"
                      accessibilityLabel={`Photo ${i + 1} sur ${photos.length}`}
                      {...etatBascule(i === activePhotoIndex)}
                      onPress={() => {
                        setActivePhotoIndex(i);
                        photoScrollRef.current?.scrollTo({ x: i * heroWidth, animated: !mouvementReduit });
                      }}
                    >
                      <View style={[styles.photoDot, i === activePhotoIndex && styles.photoDotActive]} />
                    </Pressable>
                  ))}
                </View>
              )}
              {/* Entrée explicite vers la galerie. Hors du ScrollView paginé,
                  donc son toucher n'entre en concurrence avec aucun geste. */}
              <Pressable
                style={[styles.galleryZone, { right: bordHero }]}
                accessibilityRole="button"
                onPress={() => setViewer({ source: 'photos', index: activePhotoIndex })}
              >
                <View style={styles.galleryBtn}>
                  <Images size={13} color={colors.cream} strokeWidth={1.75} />
                  <Text style={styles.galleryBtnText}>
                    {photos.length > 1 ? `Voir les ${photos.length} photos` : 'Voir la photo'}
                  </Text>
                </View>
              </Pressable>
            </>
          ) : (
            // Repli de marque (§06) : plus d'illustration décorative maison,
            // c'est RiverMotif + PhotoScrim, déjà éprouvés sur la Homepage.
            <>
              <RiverMotif width={heroWidth} height={heroHeight} variant="hero" />
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <PhotoScrim from="bottom" intensity={0.45} />
              </View>
            </>
          )}
          <BoutonIcone
            label="Retour"
            taille={32}
            fond={FOND_COMMANDE}
            onPress={() => goBack('/(tabs)')}
            icon={<ArrowLeft size={16} color={colors.ink} strokeWidth={1.75} />}
            style={[styles.backBtn, { top: haut, left: bordHero }]}
          />
          <View style={[styles.heroActions, { top: haut, right: bordHero }]}>
            <BoutonIcone
              label="Partager"
              taille={32}
              fond={FOND_COMMANDE}
              onPress={handleShare}
              icon={<Share2 size={16} color={colors.ink} strokeWidth={1.75} />}
            />
            {/* Pas de `disabled` pendant l'enregistrement : toggleFavorite
                ignore déjà un second appui, et le cœur ne clignote pas. */}
            <BoutonIcone
              label={isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              taille={32}
              fond={FOND_COMMANDE}
              onPress={toggleFavorite}
              icon={
                <Heart
                  size={16}
                  strokeWidth={1.75}
                  color={isFavorited ? colors.danger : colors.ink}
                  fill={isFavorited ? colors.danger : 'transparent'}
                />
              }
            />
          </View>
          <View style={[styles.heroFooter, { left: bordHero, right: bordHero }]}>
            <Text style={styles.heroCategory}>{cat?.label}</Text>
            <Text style={styles.heroName} accessibilityRole="header" aria-level={1}>{establishment.name}</Text>
          </View>
        </View>

        <View style={[styles.body, isWide && wide, isDesktop && styles.bodyDesktopRow]}>
          <View style={isDesktop ? styles.desktopMain : undefined}>
          {/* Ligne méta — du texte avec séparateurs, pas des pastilles :
              une pastille a un rôle de sélection, ici rien n'est cliquable. */}
          <View style={styles.metaRow}>
            <Text style={styles.metaText} numberOfLines={1}>
              {showNeighborhood ? `${neighborhoodLabel}, ` : ''}{establishment.city}
            </Text>
            <Text style={styles.metaSeparator}>·</Text>
            {avgRating != null ? (
              <>
                <Star size={12} color={colors.or} fill={colors.or} strokeWidth={1.75} />
                <Text style={styles.metaStrong}>{avgRating.toFixed(1)}</Text>
                <Text style={styles.metaText}>({reviews.length})</Text>
              </>
            ) : (
              <Text style={styles.metaText}>Nouveau</Text>
            )}
            {openingStatus && (
              <>
                <Text style={styles.metaSeparator}>·</Text>
                <Text style={[styles.metaStrong, { color: openingStatus.tone }]}>{openingStatus.label}</Text>
              </>
            )}
          </View>

          {/* Contact — rangée segmentée, sans cercles colorés. Le libellé porte
              le sens : « @ » pour Instagram et une note de musique pour TikTok
              étaient indevinables. */}
          {(!!establishment.phone || !!establishment.email) && (
            <View style={styles.contactRow}>
              {!!establishment.phone && (
                <Pressable
                  style={styles.contactCell}
                  accessibilityRole="link"
                  accessibilityLabel={`Appeler ${establishment.name}`}
                  onPress={() => Linking.openURL(`tel:${establishment.phone}`)}
                >
                  <Phone size={15} color={accent} strokeWidth={1.75} />
                  <Text style={styles.contactLabel}>Appeler</Text>
                </Pressable>
              )}
              {!!establishment.phone && !!establishment.email && <View style={styles.contactDivider} />}
              {!!establishment.email && (
                <Pressable
                  style={styles.contactCell}
                  accessibilityRole="link"
                  accessibilityLabel={`Écrire un e-mail à ${establishment.name}`}
                  onPress={() => Linking.openURL(`mailto:${establishment.email}`)}
                >
                  <Mail size={15} color={accent} strokeWidth={1.75} />
                  <Text style={styles.contactLabel}>Écrire</Text>
                </Pressable>
              )}
            </View>
          )}

          {(!!establishment.instagram || !!establishment.tiktok) && (
            <View style={styles.followRow}>
              <Text style={styles.followLabel}>Suivre :</Text>
              {/* Un `Text onPress` n'était annoncé ni comme lien ni comme bouton,
                  et n'offrait que la hauteur de sa ligne au doigt. */}
              {!!establishment.instagram && (
                <Pressable
                  style={styles.followZone}
                  accessibilityRole="link"
                  accessibilityLabel={`${establishment.name} sur Instagram`}
                  onPress={() => Linking.openURL(`https://instagram.com/${establishment.instagram!.replace('@', '')}`)}
                >
                  <Text style={[styles.followLink, { color: accent }]}>Instagram</Text>
                </Pressable>
              )}
              {!!establishment.instagram && !!establishment.tiktok && <Text style={styles.followLabel}>·</Text>}
              {!!establishment.tiktok && (
                <Pressable
                  style={styles.followZone}
                  accessibilityRole="link"
                  accessibilityLabel={`${establishment.name} sur TikTok`}
                  onPress={() => Linking.openURL(`https://tiktok.com/@${establishment.tiktok!.replace('@', '')}`)}
                >
                  <Text style={[styles.followLink, { color: accent }]}>TikTok</Text>
                </Pressable>
              )}
            </View>
          )}

          {establishment.amenities?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.amenitiesRow}>
              {establishment.amenities.map(a => (
                <View key={a} style={styles.amenityChip}>
                  {AMENITY_ICONS[a] ?? <Wifi size={13} color={colors.fleuveDark} />}
                  <Text style={styles.amenityText}>{a}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {!!establishment.description && (
            <View style={styles.section}>
              <Text style={styles.sectionKicker} accessibilityRole="header" aria-level={2}>À propos</Text>
              <Text style={styles.description}>{establishment.description}</Text>
            </View>
          )}

          {/* Carte de l'établissement — menu d'un restaurant, grille des
              attractions d'un site. Une ligne cliquable plutôt qu'un carrousel
              de vignettes : c'est ce que le voyageur cherche en priorité, et
              une rangée de miniatures se remarquait à peine.
              Les plats écrits et les photos de carte cohabitent ; la ligne
              n'apparaît que lorsqu'il y a au moins l'un des deux. */}
          {(!isMenuEmpty(menu) || menuPhotos.length > 0) && (
            <View style={styles.section}>
              <Pressable style={styles.menuRow} accessibilityRole="button" onPress={() => setMenuOpen(true)}>
                <BookOpen size={20} color={accent} strokeWidth={1.75} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuRowTitle}>{menuSectionTitle}</Text>
                  <Text style={styles.menuRowMeta}>{menuRowMeta}</Text>
                </View>
                <ChevronRightSm size={17} color={colors.faint} strokeWidth={1.75} />
              </Pressable>
            </View>
          )}

          {/* Catégories proposées — seules les offres actives apparaissent.
              Une offre retirée du catalogue n'est jamais visible ici. */}
          {offers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionKicker} accessibilityRole="header" aria-level={2}>{offerSectionTitle}</Text>
              <View style={{ gap: spacing.sm }}>
                {offers.map(o => (
                  <OfferCard
                    key={o.id}
                    offer={o}
                    category={categoryOf(o)}
                    photoUrl={offerPhotoOf(o.id)}
                    remaining={selectedDays.length ? (remainingFor(o, selectedDays) ?? undefined) : undefined}
                    accent={accent}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Adresse — hiérarchie typographique et filet fin, pas de carte
              blanche bordée. Rue en Playfair, zone en Manrope. */}
          {(!!communeLabel || !!streetLine || !!establishment.reference) && (
            <View style={styles.section}>
              <Text style={styles.sectionKicker} accessibilityRole="header" aria-level={2}>Adresse</Text>
              <View style={styles.addressBlock}>
                {!!streetLine && <Text style={styles.addressStreet}>{streetLine}</Text>}
                {!!areaLine && <Text style={styles.addressArea}>{areaLine}</Text>}
                {!!establishment.reference && (
                  <Text style={styles.addressReference}>Repère : {establishment.reference}</Text>
                )}
                <Pressable style={styles.directionsLink} accessibilityRole="link" onPress={openDirections}>
                  <Navigation size={13} color={accent} strokeWidth={1.75} />
                  <Text style={[styles.directionsText, { color: accent }]}>Ouvrir l'itinéraire</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Avis */}
          <View style={styles.section}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionKicker} accessibilityRole="header" aria-level={2}>
                Avis {reviews.length > 0 ? `(${reviews.length})` : ''}
              </Text>
              {/* Plus conditionné à la session : la garde est dans openReviewForm,
                  masquer le bouton cachait le problème au lieu de le traiter. */}
              <Pressable style={styles.writeReviewBtn} accessibilityRole="button" onPress={openReviewForm}>
                {myReview ? <Pencil size={12} color={accent} strokeWidth={1.75} /> : <Star size={12} color={accent} strokeWidth={1.75} />}
                <Text style={[styles.writeReviewText, { color: accent }]}>
                  {myReview ? 'Modifier mon avis' : 'Donner mon avis'}
                </Text>
              </Pressable>
            </View>

            {reviews.length === 0 ? (
              <EmptyState
                title="Aucun avis pour le moment"
                description="Soyez le premier à partager votre expérience."
              />
            ) : (
              <View style={{ gap: spacing.v12 }}>
                {reviews.slice(0, 3).map(r => (
                  <View key={r.id} style={styles.reviewCard}>
                    <View style={styles.reviewTopRow}>
                      {/* Cinq étoiles dessinées ne se lisent pas : la note est dite en clair. */}
                      <View
                        style={{ flexDirection: 'row', gap: spacing.v2 }}
                        accessible
                        accessibilityRole="image"
                        accessibilityLabel={`Note : ${r.rating} sur 5`}
                      >
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={11} color={colors.or} fill={i <= r.rating ? colors.or : 'transparent'} />
                        ))}
                      </View>
                      {r.is_verified_stay && (
                        <View style={styles.verifiedBadge}>
                          <BadgeCheck size={10} color={colors.fleuve} />
                          <Text style={styles.verifiedText}>Client vérifié</Text>
                        </View>
                      )}
                      <Text style={styles.reviewDate}>
                        {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>

                    {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}

                    {r.partner_reply && (
                      <View style={styles.partnerReplyBox}>
                        <MessageCircle size={11} color={colors.lave} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.partnerReplyLabel}>Réponse de l'établissement</Text>
                          <Text style={styles.partnerReplyText}>{r.partner_reply}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
                {reviews.length > 3 && (
                  <Text style={styles.moreReviewsText}>
                    + {reviews.length - 3} autre{reviews.length - 3 > 1 ? 's' : ''} avis
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Ajouter au planning — masqué pour la V1, réactivé en V2 (lib/features.ts) */}
          {PLANNING_ENABLED && (
            <Button
              label="Ajouter à mon planning"
              variant="secondary"
              onPress={handleAddToPlanning}
              loading={addingToPlan}
              icon={<CalendarPlus size={15} color={colors.lave} strokeWidth={1.75} />}
            />
          )}

          {/* Établissements similaires — évite que la fiche soit un cul-de-sac */}
          {similar.length > 0 && (
            <View style={styles.similarSection}>
              <Text style={styles.sectionKicker} accessibilityRole="header" aria-level={2}>Dans la même commune</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
                {similar.map(s => (
                  <ListingCard
                    key={s.id}
                    type={s.type}
                    name={s.name}
                    location={s.commune ? titleCase(s.commune) : s.city}
                    coverPhotoUrl={s.coverPhoto}
                    priceLabel={s.priceLabel}
                    width={200}
                    href={`/listing/${s.id}`}
                    remplacer
                  />
                ))}
              </ScrollView>
            </View>
          )}

          <Pressable style={styles.reportLink} accessibilityRole="link" onPress={reportListing}>
            <Flag size={12} color={colors.faint} strokeWidth={1.75} />
            <Text style={styles.reportText}>Signaler une information incorrecte</Text>
          </Pressable>
          </View>

          {/* Desktop : la colonne prix reste dans le flux et colle au scroll.
              Sur mobile/tablette, elle est remplacée par la barre fixe. */}
          {isDesktop && (
            <View style={styles.desktopSidebar}>
              <View style={[styles.priceCard, styles.priceCardSticky]}>
                <View>
                  <Text style={styles.priceFrom}>À partir de</Text>
                  <Text style={styles.priceValue}>{priceLabel}</Text>
                </View>
                <Button label="Réserver" onPress={openBookingForm} color={accent} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Barre de réservation fixe — mobile et tablette uniquement */}
      {!isDesktop && (
        <View style={[styles.bookingBar, { paddingBottom: Math.max(insets.bottom, spacing.v12) }]}>
          <View style={styles.bookingBarPrice}>
            <Text style={styles.priceFrom}>À partir de</Text>
            <Text style={styles.priceValue} numberOfLines={1}>{priceLabel}</Text>
          </View>
          <Button label="Réserver" onPress={openBookingForm} color={accent} />
        </View>
      )}

      {success && (
        <View style={styles.successBanner}>
          <Text style={styles.successText} accessibilityRole="alert" accessibilityLiveRegion="polite">
            Demande envoyée. L'établissement vous confirmera sous 24h.
          </Text>
          <Pressable
            style={styles.successZone}
            accessibilityRole="link"
            accessibilityLabel="Voir mes réservations"
            {...lienVers('/bookings', { avant: () => setSuccess(false) })}
          >
            <Text style={styles.successLink}>Voir mes réservations →</Text>
          </Pressable>
        </View>
      )}

      <Sheet
        visible={showForm}
        onClose={() => setShowForm(false)}
        title="Demande de réservation"
        subtitle={`${establishment.name} · ${establishment.neighborhood ?? establishment.city}`}
      >
        {isHotel && (
          <HotelBookingForm
            accent={accent} form={hotelForm} setForm={setHotelForm}
            onSubmit={handleSubmit} loading={submitting}
            offerCtx={offerCtx} isHouse={establishment.type === 'furnished_house'}
          />
        )}
        {isRestaurant && <RestaurantBookingForm accent={accent} form={restaurantForm} setForm={setRestaurantForm} onSubmit={handleSubmit} loading={submitting} availability={availability} offerCtx={offerCtx} venue={venueCtx} />}
        {isSite && <SiteBookingForm accent={accent} form={siteForm} setForm={setSiteForm} onSubmit={handleSubmit} loading={submitting} availability={availability} offerCtx={offerCtx} venue={venueCtx} />}
      </Sheet>

      {/* Formulaire d'avis */}
      <Sheet
        visible={showReviewForm}
        onClose={() => setShowReviewForm(false)}
        title={myReview ? 'Modifier mon avis' : 'Donner mon avis'}
        subtitle={establishment.name}
      >
        <Text style={styles.fieldLabel}>Votre note</Text>
        {/* Une note est un choix unique parmi cinq : c'est ce qu'annonce le
            groupe, là où cinq « boutons » ne disaient pas lequel était retenu. */}
        <View style={styles.starPicker} accessibilityRole="radiogroup" accessibilityLabel="Votre note">
          {[1, 2, 3, 4, 5].map(i => (
            <Pressable
              key={i}
              style={styles.starZone}
              accessibilityRole="radio"
              accessibilityLabel={'Noter ' + i + ' sur 5'}
              aria-checked={i === reviewRating}
              onPress={() => setReviewRating(i)}
            >
              <Star
                size={ETOILE}
                color={colors.or}
                fill={i <= reviewRating ? colors.or : 'transparent'}
              />
            </Pressable>
          ))}
        </View>

        <FormField
          label="Votre commentaire (optionnel)"
          value={reviewComment}
          onChange={setReviewComment}
          placeholder="Qu'avez-vous pensé de votre expérience ?"
          multiline
          lines={3}
        />

        <Button
          label={myReview ? 'Enregistrer' : 'Publier mon avis'}
          onPress={handleSaveReview}
          loading={savingReview}
          disabled={reviewRating === 0}
          color={accent}
          icon={<Send size={15} color={colors.cream} strokeWidth={1.75} />}
        />

        {myReview && (
          <Pressable style={styles.deleteReviewBtn} accessibilityRole="button" onPress={confirmDeleteReview}>
            <Text style={styles.deleteReviewText}>Supprimer mon avis</Text>
          </Pressable>
        )}
      </Sheet>

      <MenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={menuSectionTitle}
        menu={menu}
        photoUrls={menuPhotos.map(ph => ph.url)}
        // Ouvrir une photo depuis la carte ferme la feuille : deux surfaces
        // plein écran superposées n'apporteraient rien de lisible.
        onOpenPhoto={i => { setMenuOpen(false); setViewer({ source: 'menu', index: i }); }}
        accent={accent}
      />

      {/* Visionneuse plein écran — une seule implémentation, paramétrée :
          galerie principale et photos de menu/tarifs. */}
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerOverlay}>
          <View style={[styles.viewerHeader, { paddingTop: haut }]}>
            <Text style={styles.viewerCounter}>
              {viewer ? `${viewer.index + 1} / ${viewerPhotos.length}` : ''}
            </Text>
            <BoutonIcone
              label="Fermer la galerie"
              taille={22}
              onPress={() => setViewer(null)}
              icon={<X size={22} color={colors.white} strokeWidth={1.75} />}
            />
          </View>

          <View style={styles.viewerImageWrap}>
            {viewerPhoto && (
              <Image
                source={{ uri: viewerPhoto.url }}
                style={{ width: '100%', height: '100%' }}
                // `contain` et non `cover` : dans la visionneuse, on regarde la
                // photo entière — c'est le seul endroit de l'app où recadrer
                // serait une perte.
                contentFit="contain"
                transition={mouvementReduit ? 0 : 160}
                cachePolicy="memory-disk"
                priority="high"
                recyclingKey={viewerPhoto.url}
                accessibilityLabel={`${establishment.name} — photo en plein écran`}
              />
            )}
          </View>

          <View style={[styles.viewerFooter, { paddingBottom: bas }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Photo précédente"
              aria-disabled={viewer?.index === 0}
              style={[styles.viewerNavBtn, viewer?.index === 0 && styles.viewerNavBtnDisabled]}
              onPress={() => setViewer(v => (v && v.index > 0 ? { ...v, index: v.index - 1 } : v))}
              disabled={viewer?.index === 0}
              hitSlop={10}
            >
              <ChevronLeft size={22} color={colors.white} strokeWidth={1.75} />
            </Pressable>
            <View style={{ width: 44 }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Photo suivante"
              aria-disabled={viewer !== null && viewer.index === viewerPhotos.length - 1}
              style={[styles.viewerNavBtn, viewer !== null && viewer.index === viewerPhotos.length - 1 && styles.viewerNavBtnDisabled]}
              onPress={() => setViewer(v => (v && v.index < viewerPhotos.length - 1 ? { ...v, index: v.index + 1 } : v))}
              disabled={viewer !== null && viewer.index === viewerPhotos.length - 1}
              hitSlop={10}
            >
              <ChevronRight size={22} color={colors.white} strokeWidth={1.75} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  errorBackLink: {
    alignItems: 'center', justifyContent: 'center', minHeight: cible.min,
    // Le mot « Retour » ne fait que 40 px de large.
    paddingHorizontal: spacing.v12,
    paddingVertical: spacing.v12, marginTop: spacing.sm,
  },
  errorBackText: { ...typography.caption, color: colors.muted, textDecorationLine: 'underline' },
  // La hauteur est posée à l'appel : elle dépend de la largeur d'écran.
  hero: { position: 'relative', overflow: 'hidden' },
  // Même gouttière que le corps de la fiche, pour que les traits d'attente
  // partent de l'abscisse où commencera le texte.
  attenteCorps: { padding: spacing.gutter, gap: spacing.sm },
  photoDots: {
    position: 'absolute', bottom: 0, alignSelf: 'center',
    flexDirection: 'row', zIndex: 2,
  },
  // Zone tactile d'un point. Les points restent à 14 px les uns des autres :
  // la zone ne peut donc pas s'élargir sans recouvrir sa voisine, ni sans
  // pousser la rangée sous le bouton « Voir les photos » dès cinq images. Elle
  // gagne en hauteur — 44 px depuis le bas de la photo — et le point garde sa
  // place, à 14 px du bord, grâce au retrait bas. Sa largeur reste donc sous
  // les 24 px du critère 2.5.8 (WCAG 2.2) : c'est admis ici parce que le bouton
  // « Voir les photos », lui de taille pleine, mène aux mêmes images.
  photoDotZone: {
    height: cible.min, paddingHorizontal: spacing.xs, paddingBottom: 14,
    alignItems: 'center', justifyContent: 'flex-end',
  },
  // borderRadius 3 sur 6px : géométrie de cercle, pas un choix
  // esthétique — hors échelle à dessein (§04).
  photoDot: { width: 6, height: 6, borderRadius: radii.v4, backgroundColor: colors.white + '80' },
  photoDotActive: { backgroundColor: colors.white, width: 18 },
  // Reprend l'emplacement et le repère semi-transparent de l'ancien compteur,
  // mais devient une vraie commande : le nombre de photos y est annoncé, et
  // la position courante reste portée par les points de pagination.
  // La pastille garde sa taille, à 12 px du bas ; c'est la zone qui l'entoure
  // qui atteint 44 px.
  galleryZone: {
    position: 'absolute', bottom: 0, zIndex: 3,
    minHeight: cible.min, justifyContent: 'flex-end', paddingBottom: spacing.v12,
  },
  galleryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.nuit + 'A6', borderRadius: radii.pill,
    paddingHorizontal: spacing.v12, paddingVertical: spacing.sm,
  },
  galleryBtnText: { ...typography.badgeSm, color: colors.cream },
  // Position seulement : la pastille et sa zone de 44 px viennent de
  // BoutonIcone, le haut et le bord de l'appel (zone sûre, largeur d'écran).
  backBtn: { position: 'absolute', zIndex: 3 },
  // Écart de 12 et non de 8 : deux zones de 44 px autour de pastilles de 32
  // se recouvriraient sinon de 4 px.
  heroActions: { position: 'absolute', flexDirection: 'row', gap: spacing.v12, zIndex: 3 },
  heroFooter: { position: 'absolute', bottom: 14 },
  heroCategory: { ...typography.overlineXs, color: colors.cream, textTransform: 'uppercase', marginBottom: spacing.xs, opacity: 0.9 },
  // displayStrong (Playfair 600) — première utilisation dans l'app. Rôle
  // attribué ici : nom d'entité sur un hero photo. displayHero reste réservé
  // au titre de hero éditorial (un par page, déjà pris par la Homepage).
  heroName: { ...typography.displayStrong, color: colors.cream,
    textShadowColor: colors.nuit + '80', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  body: { padding: spacing.gutter },
  // Desktop uniquement (≥1024) : colonne éditoriale flexible + colonne prix
  // étroite et sticky. Tablette/mobile gardent la colonne unique existante
  // (voir `wide` pour le centrage tablette+desktop dans breakpoints.contentMax).
  // alignItems reste au défaut ('stretch', pas 'flex-start') : desktopSidebar
  // doit avoir la même hauteur que desktopMain pour offrir de la place où
  // "coller". Le sticky lui-même va sur priceCard (styles.priceCardSticky),
  // pas sur desktopSidebar : un élément sticky doit rester plus court que son
  // conteneur pour avoir une plage de défilement dans laquelle tenir — le
  // mettre sur le conteneur étiré revient à l'annuler (rien ne "dépasse").
  bodyDesktopRow: { flexDirection: 'row', gap: spacing.xl },
  desktopMain: { flex: 1, minWidth: 0 },
  desktopSidebar: { width: 320 },
  priceCardSticky: Platform.OS === 'web' ? { position: 'sticky' as any, top: spacing.lg } : {},
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.v12, flexWrap: 'wrap' },
  metaText: { ...typography.caption, color: colors.muted },
  metaStrong: { ...typography.caption, color: colors.ink },
  metaSeparator: { ...typography.caption, color: colors.faint },
  // Récapitulatif : filet et hiérarchie typographique, pas une carte blanche
  // bordée de plus (anti-pattern §10).
  // Contact — rangée segmentée, un seul conteneur, séparateurs fins.
  contactRow: {
    flexDirection: 'row', alignItems: 'stretch', marginBottom: spacing.v12,
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.white,
  },
  contactCell: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.v12, minHeight: cible.min,
  },
  contactDivider: { width: 1, backgroundColor: colors.border },
  contactLabel: { ...typography.caption, color: colors.ink },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  followLabel: { ...typography.caption, color: colors.faint },
  followZone: {
    minHeight: cible.min, minWidth: cible.min, alignItems: 'center', justifyContent: 'center',
    marginVertical: -DEBORD_LIGNE,
  },
  followLink: { ...typography.caption, textDecorationLine: 'underline' },
  amenitiesRow: { marginBottom: spacing.md },
  amenityChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.v12, paddingVertical: spacing.sm, marginRight: spacing.sm },
  amenityText: { ...typography.caption, color: colors.ink },
  section: { marginBottom: spacing.md },
  sectionKicker: { ...typography.overline, color: colors.faint, textTransform: 'uppercase', marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.muted },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.md,
  },
  menuRowTitle: { ...typography.cardTitle, color: colors.ink },
  menuRowMeta: { ...typography.caption, color: colors.muted, marginTop: spacing.v2 },
  // Adresse — hiérarchie typographique + filet, pas de carte blanche bordée.
  addressBlock: { gap: spacing.v2, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.v12 },
  addressStreet: { ...typography.cardTitle, color: colors.ink },
  addressArea: { ...typography.caption, color: colors.muted },
  addressReference: { ...typography.caption, color: colors.faint },
  directionsLink: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs,
    minHeight: cible.min, marginTop: spacing.sm - DEBORD_LIGNE, marginBottom: -DEBORD_LIGNE,
  },
  directionsText: { ...typography.caption, textDecorationLine: 'underline' },
  reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  writeReviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    minHeight: cible.min, marginVertical: -DEBORD_LIGNE,
  },
  writeReviewText: { ...typography.caption },
  reviewCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.v12 },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.v2, backgroundColor: colors.fleuveSoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.v2 },
  verifiedText: { ...typography.badgeSm, color: colors.fleuve },
  reviewDate: { ...typography.badgeSm, color: colors.faint, marginLeft: 'auto' },
  reviewComment: { ...typography.caption, color: colors.ink, lineHeight: 18 },
  partnerReplyBox: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.laveSoft, borderRadius: radii.sm, padding: spacing.sm, marginTop: spacing.sm },
  partnerReplyLabel: { ...typography.badgeSm, color: colors.lave, marginBottom: spacing.v2 },
  partnerReplyText: { ...typography.caption, color: colors.ink, lineHeight: 16 },
  moreReviewsText: { ...typography.caption, color: colors.muted, textAlign: 'center', paddingTop: spacing.v2 },
  similarSection: { marginTop: spacing.lg },
  similarRow: { gap: spacing.v12, paddingBottom: spacing.xs },
  reportLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.sm },
  reportText: { ...typography.caption, color: colors.faint, textDecorationLine: 'underline' },
  starPicker: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.md, marginTop: spacing.xs },
  // Chaque étoile occupe 44 px au lieu de 34 : les zones se touchent, ce qui
  // redonne exactement l'écart de 10 px qu'elles avaient. La marge négative
  // rend à la rangée sa hauteur d'origine.
  starZone: {
    width: cible.min, height: cible.min, alignItems: 'center', justifyContent: 'center',
    marginVertical: -(cible.min - ETOILE) / 2,
  },
  deleteReviewBtn: {
    alignItems: 'center', justifyContent: 'center', minHeight: cible.min,
    paddingVertical: spacing.v12, marginTop: spacing.xs,
  },
  deleteReviewText: { ...typography.caption, color: colors.danger },
  priceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  priceFrom: { ...typography.overlineXs, color: colors.muted, textTransform: 'uppercase' },
  priceValue: { ...typography.displayMd, color: colors.ink },
  // Barre de réservation fixe (mobile/tablette) — filet supérieur, pas d'ombre.
  bookingBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border,
    // Le retrait bas est posé à l'appel : il suit la barre de geste réelle.
    paddingHorizontal: spacing.gutter, paddingTop: spacing.v12,
  },
  bookingBarPrice: { flex: 1 },
  successBanner: { position: 'absolute', bottom: 96, left: spacing.md, right: spacing.md,
    backgroundColor: colors.success, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  successText: { ...typography.caption, color: colors.cream },
  successLink: { ...typography.caption, color: colors.amber },
  successZone: {
    alignSelf: 'flex-start', justifyContent: 'center',
    minHeight: cible.min, marginVertical: -DEBORD_LIGNE,
  },
  fieldLabel: { ...typography.caption, color: colors.ink, marginBottom: spacing.xs },

  // Visionneuse plein écran (galerie + menu). Les retraits haut et bas sont
  // posés à l'appel, d'après la zone sûre de l'appareil.
  viewerOverlay: { flex: 1, backgroundColor: colors.nuit + 'F0' },
  viewerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.gutter, paddingBottom: spacing.v12,
  },
  viewerCounter: { ...typography.caption, color: colors.white },
  viewerImageWrap: { flex: 1, paddingHorizontal: spacing.v12 },
  viewerFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.v12,
  },
  viewerNavBtn: {
    width: 44, height: 44, borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  viewerNavBtnDisabled: { opacity: 0.3 },
});