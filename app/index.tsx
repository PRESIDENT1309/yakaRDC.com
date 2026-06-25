import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../lib/auth-context';

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF8F4' }}>
        <ActivityIndicator color="#712B13" />
      </View>
    );
  }
  return <Redirect href={session ? '/(tabs)' : '/(auth)/login'} />;
}