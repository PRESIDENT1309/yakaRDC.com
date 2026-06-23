import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';

// Écran à construire à l'étape suivante : liste des réservations du voyageur
// (table bookings filtrée sur traveler_id) + accès à l'écran ticket QR pour
// chaque réservation confirmée.
export default function BookingsScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Mes réservations et tickets — prochaine étape</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
