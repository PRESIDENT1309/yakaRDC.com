import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet, type ColorValue } from 'react-native';
import { Home, Search, CalendarRange, CalendarCheck, User } from 'lucide-react-native';
import { colors } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';

// Barre à 5 destinations inchangées (Accueil, Recherche, Planning,
// Réservations, Profil) — seule la présentation est affinée : hauteur,
// séparation avec le contenu, état actif (pastille discrète derrière
// l'icône plutôt qu'un simple changement de couleur), libellés en Manrope.
// Le mécanisme de navigation (Tabs d'expo-router) reste identique.

function TabIcon(Icon: typeof Home) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Icon color={color as string} size={20} strokeWidth={1.8} />
    </View>
  );
}

function tabLabel(title: string) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Text style={[styles.label, focused && styles.labelActive, { color }]}>{title}</Text>
  );
}

export default function TabsLayout() {
  const { width, isDesktop } = useResponsive();
  const railPadding = isDesktop ? Math.max(24, (width - 460) / 2) : 20;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lave,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: colors.cream,
          height: Platform.OS === 'web' ? 68 : 62,
          paddingTop: 10,
          paddingHorizontal: railPadding,
          // Séparation nette avec le contenu qui défile en dessous, sans
          // dépendre d'un simple filet — se voit pendant le scroll aussi.
          shadowColor: colors.nuit,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Accueil', tabBarIcon: TabIcon(Home), tabBarLabel: tabLabel('Accueil') }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Recherche', tabBarIcon: TabIcon(Search), tabBarLabel: tabLabel('Recherche') }}
      />
      <Tabs.Screen
        name="planner"
        options={{ title: 'Planning', tabBarIcon: TabIcon(CalendarRange), tabBarLabel: tabLabel('Planning') }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: 'Réservations', tabBarIcon: TabIcon(CalendarCheck), tabBarLabel: tabLabel('Réservations') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: TabIcon(User), tabBarLabel: tabLabel('Profil') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 34, height: 26, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.laveSoft },
  label: { fontFamily: 'Manrope_500Medium', fontSize: 10.5, marginTop: 3 },
  labelActive: { fontFamily: 'Manrope_600SemiBold' },
});
