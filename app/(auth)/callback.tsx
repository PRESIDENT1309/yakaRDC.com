import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

// Google (et tout futur fournisseur OAuth) redirige ici après connexion.
// On échange le code reçu dans l'URL contre une vraie session, puis on
// renvoie vers l'accueil — app/index.tsx s'occupe ensuite de rediriger
// vers le bon espace (voyageur, partenaire, admin) selon le rôle.
export default function AuthCallback() {
  useEffect(() => {
    async function handleExchange() {
      if (typeof window !== 'undefined') {
        await supabase.auth.exchangeCodeForSession(window.location.href);
      }
      router.replace('/');
    }
    handleExchange();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
      <ActivityIndicator color={colors.lave} />
    </View>
  );
}