import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  ImageBackground, StatusBar, useWindowDimensions,
} from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import LandscapeIllustration from '../components/LandscapeIllustration';
import { colors, fonts, typography, spacing, radii } from '../lib/theme';
import { useZonesSures } from '../lib/zones';
import { lienVers } from '../lib/liens';

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const { bas } = useZonesSures();
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'auth_background_url').maybeSingle()
      .then(({ data }) => setBgUrl(data?.value ?? null));
  }, []);

  const content = (
    <>
      <StatusBar barStyle="light-content" />
      <View style={styles.veil} pointerEvents="none" />

      <View style={styles.center}>
        <Text style={styles.eyebrow}>BIENVENUE SUR</Text>
        <Text style={styles.title} accessibilityRole="header" aria-level={1}>YakaRDC !</Text>
      </View>

      {/* Le pied suit la barre de geste mesurée. Les 16 px ajoutés redonnent,
          là où elle n'existe pas (web), les 36 px d'origine. */}
      <View style={[styles.bottom, { paddingBottom: bas + spacing.md }]}>
        <Text style={styles.caption}>
          « Viens » en lingala — une invitation{'\n'}à découvrir le Congo autrement.
        </Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Commencer" style={styles.nextBtn} {...lienVers('/login')}>
          <ArrowRight size={22} color={colors.lave} />
        </Pressable>
      </View>
    </>
  );

  if (bgUrl) {
    return (
      <ImageBackground source={{ uri: bgUrl }} style={styles.screen} resizeMode="cover">
        {content}
      </ImageBackground>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <LandscapeIllustration width={width} height={height} />
      </View>
      {content}
    </View>
  );
}

const shadow = {
  textShadowColor: colors.ombreTexte,
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 8,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.nuit3 },
  // Voile très léger (8 %) : le noir de marque, dosé par l'opacité de la vue
  // — `colors.overlay`, prévu pour les modales, assombrirait six fois plus.
  veil: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.nuit, opacity: 0.08,
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingBottom: 80,
  },
  eyebrow: { ...typography.bodyXs, color: colors.onBrandMuted,
    letterSpacing: 3, marginBottom: spacing.sm, ...shadow, },
  title: {
    // Le nom de l'application s'affichait en `serif` générique — soit du Times
    // New Roman sur le web, du Georgia sur iOS. Playfair est pourtant chargée
    // et sert partout ailleurs. C'était le titre le plus vu de l'application.
    // La fonte est déjà italique : pas de `fontStyle`, qui ajouterait une
    // seconde inclinaison par-dessus la vraie.
    fontFamily: fonts.display,
    fontSize: 56,
    color: colors.cream,
    ...shadow,
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.v20,
  },
  caption: { ...typography.bodySm, color: colors.onBrandMuted,
    textAlign: 'center', ...shadow, },
  nextBtn: {
    width: 56, height: 56, borderRadius: radii.pill,
    backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.nuit, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
});