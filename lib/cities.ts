import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { City } from './types';

// `cities` (gérée depuis Admin → Villes & catégories) est la source de
// vérité pour les villes disponibles — aucune ville n'est codée en dur ici.
//
// `erreur` distingue « la liste n'a pas pu être lue » de « aucune ville
// active ». Les deux donnaient jusqu'ici une liste vide, et comme l'accueil et
// la recherche attendent une ville avant d'interroger quoi que ce soit, une
// panne à cet endroit les laissait sans rien à dire : silhouettes de
// chargement sans fin d'un côté, « 0 résultat » de l'autre.
export function useActiveCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [tentative, setTentative] = useState(0);

  useEffect(() => {
    let annule = false;
    setLoading(true);
    setErreur(false);
    supabase.from('cities').select('*').eq('is_active', true).order('name', { ascending: true })
      .then(({ data, error }) => {
        if (annule) return;
        if (error) setErreur(true);
        else setCities((data as City[]) ?? []);
        setLoading(false);
      });
    return () => { annule = true; };
  }, [tentative]);

  /** Relit la liste — branché sur les boutons « Réessayer ». */
  const recharger = useCallback(() => setTentative(t => t + 1), []);

  return { cities, loading, erreur, recharger };
}
