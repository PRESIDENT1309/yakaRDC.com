import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { City } from './types';

// `cities` (gérée depuis Admin → Villes & catégories) est la source de
// vérité pour les villes disponibles — aucune ville n'est codée en dur ici.
export function useActiveCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('cities').select('*').eq('is_active', true).order('name', { ascending: true })
      .then(({ data }) => {
        setCities((data as City[]) ?? []);
        setLoading(false);
      });
  }, []);

  return { cities, loading };
}
