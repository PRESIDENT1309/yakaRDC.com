import { useEffect } from 'react';
import { Platform } from 'react-native';
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
import { Stack } from 'expo-router';
import { AuthProvider } from '../lib/auth-context';
import { CityProvider } from '../lib/city-context';
import { ConfirmProvider } from '../lib/confirm-context';
import { colors } from '../lib/theme';

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
  // scripts/fix-html-lang.mjs ; ceci couvre le developpement.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'fr';
    }
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
  if (!fontsLoaded) return null;
  return (
    <AuthProvider>
      <CityProvider>
        <ConfirmProvider>
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
        </ConfirmProvider>
      </CityProvider>
    </AuthProvider>
  );
}