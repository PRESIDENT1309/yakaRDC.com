import { installerStyleFocus } from '../lib/focus-web';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { Stack, usePathname } from 'expo-router';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { appliquerMetaDeRoute } from '../lib/seo';
import { CityProvider } from '../lib/city-context';
import { ConfirmProvider } from '../lib/confirm-context';
import { colors, typography, spacing } from '../lib/theme';
import { BASE_DE_TEST } from '../lib/supabase';
import SplashLoader from '../components/SplashLoader';

// Ce composant vit DANS les providers : useAuth() ne fonctionne pas dans
// RootLayout, qui est au-dessus d'AuthProvider.
function AppShell({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  // Titre d'onglet, description et balises de partage suivent la navigation.
  // Posé ici plutôt que dans chaque écran : une seule ligne couvre toutes les
  // routes, y compris celles qu'on ajoutera sans y penser. Sans effet hors web.
  const pathname = usePathname();
  useEffect(() => {
    appliquerMetaDeRoute(pathname);
  }, [pathname]);

  return (
    <View style={{ flex: 1 }}>
      {/* Bandeau de la base de test : absent dès que l'app parle à Supabase. */}
      {BASE_DE_TEST && (
        <View style={{ backgroundColor: colors.nuit, paddingVertical: spacing.xs, paddingHorizontal: spacing.v12 }}>
          <Text style={{ ...typography.captionSm, color: colors.cream, textAlign: 'center' }}>
            Base de test locale — rien de ce qui est fait ici ne touche Supabase
          </Text>
        </View>
      )}
      {/* Les écrans n'apparaissent qu'une fois les polices prêtes, comme avant. */}
      {fontsLoaded && (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.cream },
            // Continuité plutôt que coupure : une fiche ouverte depuis une
            // liste glisse depuis la droite, et le retour la renvoie d'où
            // elle vient. Le geste de l'utilisateur et le déplacement à
            // l'écran racontent alors la même chose.
            //
            // Neutralisé sur le web : react-native-screens n'y applique pas
            // ces transitions natives, et les imiter en JavaScript coûterait
            // plus qu'elles ne rapportent sur un onglet de navigateur, où le
            // bouton « précédent » porte déjà le sens du retour.
            animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
          }}
        />
      )}

      {/* L'écran de chargement reste tant que les polices ET le profil
          (loading de l'auth) ne sont pas prêts, puis disparaît en fondu. */}
      {!splashDone && (
        <SplashLoader
          ready={fontsLoaded && !loading}
          onFinish={() => setSplashDone(true)}
        />
      )}
    </View>
  );
}

export default function RootLayout() {
  // Playfair Display (voix éditoriale) + Manrope (interface) — direction
  // "Terre & Fleuve". Les graisses supplémentaires sont additives : les écrans
  // qui n'utilisent encore que PlayfairDisplay_400Regular_Italic continuent
  // de fonctionner sans changement.
  // Le serveur de developpement sert un gabarit HTML fige sur lang="en",
  // qu'aucun fichier du projet ne controle. Chrome croit alors lire de
  // l'anglais et retraduit une interface deja francaise, en la deformant :
  // « Enregistrer » devient « Economiser », et les messages d'erreur
  // deviennent illisibles. La compilation est corrigee par
  // scripts/postbuild-web.mjs ; ceci couvre le developpement.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'fr';
    }
    installerStyleFocus();
  }, []);

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  // Plus de `if (!fontsLoaded) return null;` : l'écran blanc de départ est
  // remplacé par SplashLoader, qui n'a besoin d'aucune police personnalisée.
  return (
    <AuthProvider>
      <CityProvider>
        <ConfirmProvider>
          <AppShell fontsLoaded={fontsLoaded} />
        </ConfirmProvider>
      </CityProvider>
    </AuthProvider>
  );
}