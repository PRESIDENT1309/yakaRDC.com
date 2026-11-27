import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

/**
 * Vrai quand l'application parle à la base de test de la machine (dossier
 * `local/`, lancée par `npm run web:local`) et non au projet Supabase.
 *
 * Sert à l'afficher à l'écran : les deux se ressemblent trait pour trait, et
 * l'on ne doit jamais se demander dans laquelle on vient de créer un compte
 * ou de valider une demande.
 */
export const BASE_DE_TEST = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL ?? '');
/**
 * Clé publique du client.
 *
 * Supabase remplace les clés héritées (JWT `eyJ…`, role anon) par des clés
 * publiables (`sb_publishable_…`). Sur ce projet, la passerelle des Edge
 * Functions a cessé d'accepter la clé héritée — elle répond
 * INVALID_CREDENTIALS avant même de regarder le jeton — alors que PostgREST
 * la tolère encore. D'où une app à moitié fonctionnelle, difficile à
 * diagnostiquer.
 *
 * On préfère donc la clé publiable dès qu'elle est renseignée, sans casser
 * les installations restées sur l'ancienne.
 */
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// expo-secure-store ne fonctionne pas sur le web — on adapte selon la plateforme
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Sur web : localStorage (undefined = défaut Supabase)
    // Sur mobile : SecureStore
    storage: Platform.OS !== 'web' ? ExpoSecureStoreAdapter : undefined,
    autoRefreshToken: true,
    persistSession: true,
    // CRITIQUE : permet à Supabase de détecter automatiquement le code OAuth
    // dans l'URL de callback et d'échanger le PKCE code_verifier
    detectSessionInUrl: Platform.OS === 'web',
  },
});