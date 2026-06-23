import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors, radii } from '../../lib/theme';

export default function ProfileScreen() {
  const { profile } = useAuth();

  return (
    <View style={styles.screen}>
      <Text style={styles.name}>{profile?.full_name ?? 'Voyageur'}</Text>
      <Text style={styles.contact}>{profile?.phone ?? profile?.email}</Text>

      <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()}>
        <LogOut color={colors.lave} size={16} />
        <Text style={styles.signOutText}>Se déconnecter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, padding: 24, paddingTop: 60 },
  name: { fontSize: 20, fontWeight: '500', color: colors.ink },
  contact: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 32 },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  signOutText: { color: colors.lave, fontSize: 13, fontWeight: '500' },
});
