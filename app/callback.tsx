import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors, spacing } from '../lib/theme';

// Supabase gère automatiquement l'échange PKCE via detectSessionInUrl: true
// On attend juste l'événement SIGNED_IN avant de rediriger
export default function OAuthCallback() {
  useEffect(() => {
    // Vérifie d'abord si la session est déjà là (échange déjà fait)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/');
      }
    });

    // Sinon on écoute l'événement SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe();
          router.replace('/');
        }
      }
    );

    // Filet de sécurité : 8 secondes max
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      router.replace('/');
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cream,
      gap: spacing.v12,
    }}>
      <ActivityIndicator color={colors.lave} size="large" />
      <Text style={{ fontSize: 13, color: colors.muted }}>
        Connexion en cours...
      </Text>
    </View>
  );
}