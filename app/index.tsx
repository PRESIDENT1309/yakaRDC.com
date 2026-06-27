import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../lib/auth-context';

export default function Index() {
  const { session, profile, loading } = useAuth();

  // Attend que la session ET le profil soient chargés
  if (loading || (session && profile === null)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF8F4' }}>
        <ActivityIndicator color="#712B13" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  if (profile?.role === 'partner' || profile?.role === 'admin') {
    return <Redirect href="/pro" />;
  }

  return <Redirect href="/(tabs)" />;
}