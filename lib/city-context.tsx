import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useActiveCities } from './cities';
import type { City } from './types';

interface CityContextValue {
  cities: City[];
  loading: boolean;
  /** La liste des villes n'a pas pu être lue (à ne pas confondre avec « aucune ville »). */
  erreur: boolean;
  /** Relance la lecture des villes après un échec. */
  recharger: () => void;
  selectedCity: City | null;
  setSelectedCity: (city: City) => void;
  // Un sélecteur de ville n'a de sens que s'il y a un vrai choix à faire.
  hasMultipleCities: boolean;
}

const CityContext = createContext<CityContextValue>({
  cities: [],
  loading: true,
  erreur: false,
  recharger: () => {},
  selectedCity: null,
  setSelectedCity: () => {},
  hasMultipleCities: false,
});

// Partage la ville actuellement parcourue entre Accueil, Recherche et les
// écrans futurs qui en auront besoin, pour qu'un changement de ville à un
// endroit reste cohérent partout. Se résout automatiquement sur l'unique
// ville active tant qu'il n'y en a qu'une — aucune ville codée en dur ici,
// tout vient de `cities`.
export function CityProvider({ children }: { children: ReactNode }) {
  const { cities, loading, erreur, recharger } = useActiveCities();
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  useEffect(() => {
    if (loading) return;
    setSelectedCity(prev => {
      // Garde la sélection en cours si elle est toujours active ; sinon,
      // retombe sur la première ville active disponible.
      if (prev && cities.some(c => c.id === prev.id)) return prev;
      return cities[0] ?? null;
    });
  }, [cities, loading]);

  return (
    <CityContext.Provider
      value={{ cities, loading, erreur, recharger, selectedCity, setSelectedCity, hasMultipleCities: cities.length > 1 }}
    >
      {children}
    </CityContext.Provider>
  );
}

export function useSelectedCity() {
  return useContext(CityContext);
}
