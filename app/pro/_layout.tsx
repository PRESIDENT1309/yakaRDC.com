import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Tabs, router } from 'expo-router';
import { LayoutDashboard, CalendarCheck, QrCode } from 'lucide-react-native';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';

export default function PartnerLayout() {
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!profile) { router.replace('/(auth)/login'); return; }
    if (profile.role !== 'partner' && profile.role !== 'admin') {
      router.replace('/(tabs)');
    }
  }, [profile, loading]);

  if (loading || !profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.lave} />
      </View>
    );
  }

  if (profile.role !== 'partner' && profile.role !== 'admin') return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lave,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tableau de bord',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Réservations',
          tabBarIcon: ({ color, size }) => <CalendarCheck color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, size }) => <QrCode color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
});