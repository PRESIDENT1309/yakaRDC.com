import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function OAuthCallback() {
  useEffect(() => {
    async function handleCallback() {
      if (typeof window === 'undefined') return;

      // Échange le code OAuth (PKCE flow) contre une vraie session
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(window.location.href);
      }

      // Cas du flow implicite : les tokens sont dans le hash (#access_token=...)
      // Supabase JS les détecte automatiquement, on attend juste la session
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/');
        return;
      }

      // Si toujours pas de session après l'échange,
      // on écoute l'événement SIGNED_IN plutôt que de supposer un timing
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === 'SIGNED_IN' && session) {
            subscription.unsubscribe();
            router.replace('/');
          }
          // Si TOKEN_REFRESHED ou autre événement sans session, on renvoie au login
          if (event === 'SIGNED_OUT') {
            subscription.unsubscribe();
            router.replace('/(auth)/login');
          }
        }
      );

      // Filet de sécurité : si rien ne se passe après 5 secondes, on renvoie au login
      setTimeout(() => {
        subscription.unsubscribe();
        router.replace('/(auth)/login');
      }, 5000);
    }

    handleCallback();
  }, []);

  return (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cream,
      gap: 14,
    }}>
      <ActivityIndicator color={colors.lave} size="large" />
      <Text style={{ fontSize: 13, color: colors.muted }}>
        Connexion en cours...
      </Text>
    </View>
  );
}