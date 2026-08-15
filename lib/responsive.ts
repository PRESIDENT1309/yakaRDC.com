import { useWindowDimensions } from 'react-native';
import { breakpoints } from './theme';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function toBreakpoint(width: number): Breakpoint {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
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
