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

export default function RootLayout() {
  // Playfair Display (voix éditoriale) + Manrope (interface) — direction
  // "Terre & Fleuve". Les graisses supplémentaires sont additives : les écrans
  // qui n'utilisent encore que PlayfairDisplay_400Regular_Italic continuent
  // de fonctionner sans changement.
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
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FAF8F4' } }} />
        </ConfirmProvider>
      </CityProvider>
    </AuthProvider>
  );
}