import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
  ImageBackground, StatusBar, useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import LandscapeIllustration from '../components/LandscapeIllustration';

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
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
        <Text style={styles.title}>Yaka !</Text>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.caption}>
          « Viens » en lingala — une invitation{'\n'}à découvrir le Congo autrement.
        </Text>
        <Pressable style={styles.nextBtn} onPress={() => router.push('/(auth)/login')}>
          <ArrowRight size={22} color="#712B13" />
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
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 8,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#3D1408' },
  veil: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingBottom: 80,
  },
  eyebrow: {
    fontSize: 12, color: 'rgba(255,248,236,0.75)',
    letterSpacing: 3, marginBottom: 8, ...shadow,
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 56,
    color: '#FFF8EC',
    ...shadow,
  },
  bottom: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 50 : 36,
    alignItems: 'center',
    gap: 22,
  },
  caption: {
    fontSize: 13, color: 'rgba(255,248,236,0.85)',
    textAlign: 'center', lineHeight: 20, ...shadow,
  },
  nextBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FAF8F4',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
});