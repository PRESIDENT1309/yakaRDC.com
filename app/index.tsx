import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { colors } from '../lib/theme';

export default function Index() {
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!session?.user) {
      router.replace('/welcome');
      return;
    }

    if (profile?.role === 'admin') { router.replace('/admin'); return; }
    if (profile?.role === 'partner') { router.replace('/pro'); return; }
    router.replace('/(tabs)');
  }, [session, profile, loading]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
      <ActivityIndicator color={colors.lave} accessibilityLabel="Chargement" />
    </View>
  );
}