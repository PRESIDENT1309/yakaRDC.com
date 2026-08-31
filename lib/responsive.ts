import { useWindowDimensions } from 'react-native';
import { breakpoints } from './theme';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function toBreakpoint(width: number): Breakpoint {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
}

/**
 * Largeur de la barre latérale de l'administration (app/admin/_layout.tsx),
 * affichée dès `breakpoints.tablet`.
 */
const ADMIN_SIDEBAR = 220;

/**
 * Adaptation des écrans d'administration.
 *
 * Les écrans maître-détail de l'admin calculaient `isMobile` sur la largeur de
 * la FENÊTRE, en ignorant la barre latérale. À 800 px, celle-ci est affichée et
 * ne laisse que 580 px : l'écran se croyait sur bureau et gardait sa liste de
 * 320 px, réduisant le panneau de détail à un filet où le titre s'affichait une
 * lettre par ligne.
 *
 * Ce qui compte pour la mise en page, c'est la place réellement disponible.
 */
export function useAdminResponsive() {
  const { width } = useWindowDimensions();
  const barreVisible = width >= breakpoints.tablet;
  const disponible = width - (barreVisible ? ADMIN_SIDEBAR : 0);
  return {
    width,
    /** Largeur utile, barre latérale déduite. */
    disponible,
    /** Vrai quand la place restante ne suffit plus à une vue maître-détail. */
    isMobile: disponible < breakpoints.tablet,
  };
}

// Hook responsive partagé — la mise en page n'a jusqu'ici jamais varié
// selon la largeur d'écran (voir audit), alors que l'app tourne aussi sur le web.
export function useResponsive() {
  const { width } = useWindowDimensions();
  const breakpoint = toBreakpoint(width);
  return {
    width,
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    // >= tablette : utile pour les mises en page qui ne distinguent pas
    // tablette et desktop (ex. grilles à colonnes multiples).
    isWide: breakpoint !== 'mobile',
    contentWidth: Math.min(width, breakpoints.contentMax),
  };
}
