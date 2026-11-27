import { Platform } from 'react-native';
import { router, type Href } from 'expo-router';

interface OptionsLien {
  /** Appelé juste avant la navigation (fermer un menu, noter un clic…). */
  avant?: () => void;
  /** Remplace l'écran courant au lieu d'en empiler un nouveau. */
  remplacer?: boolean;
}

/**
 * Fait d'un élément pressable un vrai lien sur le web.
 *
 *   <Pressable {...lienVers(`/listing/${id}`)} />
 *
 * ── Pourquoi ───────────────────────────────────────────────────────────────
 *
 * Un `Pressable` qui appelle `router.push()` produit sur le web un `<div>`.
 * L'audit du 26/11/2026 en a tiré trois défauts : impossible d'ouvrir une
 * fiche dans un nouvel onglet ou de copier son adresse, aucun lien à suivre
 * pour un moteur de recherche, et un lecteur d'écran qui n'annonce pas un lien.
 *
 * Avec `href`, react-native-web rend un `<a href>`. Le clic simple reste une
 * navigation interne, sans rechargement ; Ctrl, Cmd ou Maj + clic, le clic
 * molette et le menu contextuel sont laissés au navigateur.
 *
 * ── Pourquoi pas `<Link asChild>` d'expo-router ────────────────────────────
 *
 * Sur le web, `Link` transmet son gestionnaire à l'enfant sous le nom
 * `onClick`. Or `Pressable` (react-native-web 0.21) écrase tout `onClick` reçu
 * par le sien : la navigation interne n'a pas lieu et le `<a>` recharge la page
 * entière. Passer par `onPress`, que `Pressable` honore, évite le piège.
 *
 * Hors du web, `href` n'existe pas : seul `onPress` est renvoyé.
 */
export function lienVers(href: string, options: OptionsLien = {}) {
  const aller = () => {
    options.avant?.();
    if (options.remplacer) router.replace(href as Href);
    else router.push(href as Href);
  };

  if (Platform.OS !== 'web') return { onPress: aller };

  return {
    href,
    onPress: (e?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; preventDefault?: () => void }) => {
      // Nouvel onglet ou nouvelle fenêtre demandés : c'est au navigateur de répondre.
      if (e?.metaKey || e?.ctrlKey || e?.shiftKey) return;
      e?.preventDefault?.();
      aller();
    },
  // `href` est compris par react-native-web mais absent des types de React
  // Native : le type de retour le masque pour que l'appelant n'ait rien à forcer.
  } as { onPress: () => void };
}
