import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Tabs, router } from 'expo-router';
import { LayoutDashboard, CalendarCheck, QrCode, Building2, MoreHorizontal } from 'lucide-react-native';
import { useAuth } from '../../lib/auth-context';
import { colors, typography } from '../../lib/theme';

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
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.cream,
          height: Platform.OS === 'web' ? 60 : undefined,
        },
        tabBarLabelStyle: { ...typography.captionSm, },
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
        name="establishment"
        options={{
          title: 'Établissement',
          tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, size }) => <QrCode color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Plus',
          tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} />,
        }}
      />
      {/*
        `pro-reviews` est une route atteinte depuis « Plus », pas un onglet.
        Faute d'être déclarée ici, Expo Router l'ajoutait d'office à la barre —
        elle s'y affichait sous son nom de fichier, « pro-reviews », avec
        l'icône par défaut. `href: null` la retire de la barre sans toucher à
        la navigation : le lien depuis « Plus » continue de fonctionner.
      */}
      <Tabs.Screen name="pro-reviews" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
});