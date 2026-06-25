import { useFonts, PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display';
import { Stack } from 'expo-router';
import { AuthProvider } from '../lib/auth-context';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ PlayfairDisplay_400Regular_Italic });
  if (!fontsLoaded) return null;
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FAF8F4' } }} />
    </AuthProvider>
  );
}