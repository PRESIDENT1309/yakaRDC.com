import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function OAuthCallback() {
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