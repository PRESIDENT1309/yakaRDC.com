import { router } from 'expo-router';

/**
 * Retour arrière avec destination de repli.
 *
 * `router.back()` est un no-op silencieux quand rien ne précède dans la pile
 * de navigation. Ce n'est pas un cas rare : il se produit dès qu'un écran est
 * le premier chargé — lien de fiche partagé sur WhatsApp, QR d'un ticket, et
 * surtout un simple rafraîchissement de page sur le web. La flèche est alors
 * visible et inerte, ce qui donne l'impression que l'app est bloquée.
 *
 * On retombe donc sur un parent raisonnable plutôt que de ne rien faire.
 * `replace` et non `push` : le repli n'est pas une étape de plus dans
 * l'historique, c'est la correction d'un historique manquant.
 */
export function goBack(fallback: string = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback as any);
}
