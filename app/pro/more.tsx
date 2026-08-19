import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import {
  Star, ChartBar, Settings, LogOut, ChevronRight,
  TrendingUp, Users, Award, Bell, Globe, Shield, HelpCircle,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';
import { Alert } from '../../lib/alert';

type Section = 'menu' | 'reviews' | 'stats' | 'settings';

// Ces réglages n'existent pas encore. Un bouton muet est pire qu'un bouton
// qui dit qu'il n'est pas prêt : l'utilisateur croit que l'app est cassée.
function showComingSoon(feature: string, message?: string) {
  Alert.alert(feature, message ?? 'Cette fonctionnalité arrive bientôt sur YakaRDC.');
}

function MenuRow({ icon, label, onPress, badge }:
  { icon: React.ReactNode; label: string; onPress: () => void; badge?: string }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={styles.menuLabel}>{label}</Text>
      {badge && <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{badge}</Text></View>}
      <ChevronRight size={14} color={colors.borderStrong} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const { profile } = useAuth();
  const [section, setSection] = useState<Section>('menu');

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  if (section === 'reviews') {
    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable onPress={() => setSection('menu')} hitSlop={8}>
            <Text style={styles.backLink}>← Retour</Text>
          </Pressable>
          <Text style={styles.subHeaderTitle}>Avis clients</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.reviewSummary}>
            <Text style={styles.reviewScore}>4.8</Text>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {[1,2,3,4,5].map(i => <Star key={i} size={14} color="#854F0B" fill="#854F0B" />)}
            </View>
            <Text style={styles.reviewCount}>Basé sur 212 avis</Text>
          </View>
          <View style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <Text style={styles.reviewAuthor}>Jean-Paul M.</Text>
              <Text style={styles.reviewStars}>★★★★★</Text>
            </View>
            <Text style={styles.reviewText}>Excellent accueil, chambre propre et confortable. Je recommande !</Text>
            <Text style={styles.reviewDate}>Il y a 3 jours</Text>
          </View>
          <View style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <Text style={styles.reviewAuthor}>Marie K.</Text>
              <Text style={styles.reviewStars}>★★★★☆</Text>
            </View>
            <Text style={styles.reviewText}>Très bon séjour, juste le petit-déjeuner pourrait être plus varié.</Text>
            <Text style={styles.reviewDate}>Il y a 1 semaine</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (section === 'stats') {
    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable onPress={() => setSection('menu')} hitSlop={8}>
            <Text style={styles.backLink}>← Retour</Text>
          </Pressable>
          <Text style={styles.subHeaderTitle}>Statistiques</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statsGrid}>
            <View style={styles.bigStatCard}>
              <TrendingUp size={18} color={colors.lave} />
              <Text style={styles.bigStatValue}>+18%</Text>
              <Text style={styles.bigStatLabel}>Croissance ce mois</Text>
            </View>
            <View style={styles.bigStatCard}>
              <Users size={18} color="#1F4D3A" />
              <Text style={styles.bigStatValue}>47</Text>
              <Text style={styles.bigStatLabel}>Clients ce mois</Text>
            </View>
            <View style={styles.bigStatCard}>
              <Award size={18} color="#854F0B" />
              <Text style={styles.bigStatValue}>4.8</Text>
              <Text style={styles.bigStatLabel}>Note moyenne</Text>
            </View>
            <View style={styles.bigStatCard}>
              <ChartBar size={18} color={colors.ink} />
              <Text style={styles.bigStatValue}>62%</Text>
              <Text style={styles.bigStatLabel}>Taux de confirmation</Text>
            </View>
          </View>
          <Text style={styles.statsNote}>
            📈 Les statistiques avancées (revenus détaillés, comparaison périodes, export) arrivent dans une prochaine mise à jour.
          </Text>
        </ScrollView>
      </View>
    );
  }

  if (section === 'settings') {
    return (
      <View style={styles.screen}>
        <View style={styles.subHeader}>
          <Pressable onPress={() => setSection('menu')} hitSlop={8}>
            <Text style={styles.backLink}>← Retour</Text>
          </Pressable>
          <Text style={styles.subHeaderTitle}>Paramètres</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <MenuRow
              icon={<Bell size={16} color={colors.lave} />}
              label="Notifications"
              onPress={() => router.push('/notifications')}
            />
            <MenuRow
              icon={<Globe size={16} color={colors.lave} />}
              label="Langue"
              badge="Français"
              onPress={() => showComingSoon('Langue', "YakaRDC est disponible en français. D'autres langues arrivent prochainement.")}
            />
            <MenuRow
              icon={<Shield size={16} color={colors.lave} />}
              label="Confidentialité"
              onPress={() => showComingSoon('Confidentialité')}
            />
            <MenuRow
              icon={<HelpCircle size={16} color={colors.lave} />}
              label="Centre d'aide"
              onPress={() => showComingSoon("Centre d'aide")}
            />
          </View>
          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <LogOut size={16} color="#C0392B" />
            <Text style={styles.signOutText}>Se déconnecter</Text>
          </Pressable>
          <Text style={styles.version}>YakaRDC Pro v1.0.0</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Plus</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(profile?.full_name ?? 'P').charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{profile?.full_name ?? 'Partenaire'}</Text>
            <Text style={styles.profileEmail}>{profile?.email}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <MenuRow icon={<Star size={16} color="#854F0B" />} label="Avis clients" badge="212" onPress={() => setSection('reviews')} />
          <MenuRow icon={<ChartBar size={16} color="#1F4D3A" />} label="Statistiques" onPress={() => setSection('stats')} />
          <MenuRow icon={<Settings size={16} color={colors.lave} />} label="Paramètres" onPress={() => setSection('settings')} />
        </View>

        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={16} color="#C0392B" />
          <Text style={styles.signOutText}>Se déconnecter</Text>
        </Pressable>

        <Text style={styles.version}>YakaRDC Pro v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { backgroundColor: colors.lave, paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 18, paddingBottom: 18 },
  headerTitle: { fontSize: 18, fontWeight: '500', color: '#FAF8F4', marginBottom: 14 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '500', color: '#FAF8F4' },
  profileName: { fontSize: 14, fontWeight: '500', color: '#FAF8F4' },
  profileEmail: { fontSize: 11, color: 'rgba(250,248,244,0.7)', marginTop: 2 },
  subHeader: { backgroundColor: colors.lave, paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 18, paddingBottom: 14, gap: 8 },
  backLink: { fontSize: 13, color: 'rgba(250,248,244,0.8)' },
  subHeaderTitle: { fontSize: 18, fontWeight: '500', color: '#FAF8F4' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F4F0' },
  menuIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.laveSoft, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 13, color: colors.ink },
  menuBadge: { backgroundColor: '#F5F4F0', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  menuBadgeText: { fontSize: 11, color: colors.muted },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFD5D5', borderRadius: 12, padding: 14 },
  signOutText: { fontSize: 13, color: '#C0392B', fontWeight: '500' },
  version: { textAlign: 'center', fontSize: 11, color: colors.borderStrong },
  reviewSummary: { alignItems: 'center', gap: 6, paddingVertical: 16 },
  reviewScore: { fontSize: 40, fontWeight: '500', color: colors.ink },
  reviewCount: { fontSize: 12, color: colors.muted },
  reviewCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 10 },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewAuthor: { fontSize: 12, fontWeight: '500', color: colors.ink },
  reviewStars: { fontSize: 11, color: '#854F0B' },
  reviewText: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  reviewDate: { fontSize: 10, color: colors.faint, marginTop: 6 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bigStatCard: { width: '47%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, alignItems: 'center', gap: 6 },
  bigStatValue: { fontSize: 22, fontWeight: '500', color: colors.ink },
  bigStatLabel: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  statsNote: { fontSize: 12, color: colors.muted, lineHeight: 18, backgroundColor: '#F5F4F0', borderRadius: 10, padding: 12, marginTop: 4 },
});