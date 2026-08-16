// Subdivisions par ville — SOLUTION TRANSITOIRE, codée en dur, uniquement
// pour Kinshasa pour le moment. `cities` reste la seule source de vérité
// pour les villes elles-mêmes ; ceci ne fait que décrire leurs communes le
// temps qu'une vraie structure de données liée à `cities` soit nécessaire.
//
// Ne pas étendre cette table à d'autres villes : dès qu'une deuxième ville
// a besoin de ses propres subdivisions, migrer vers une table dédiée liée à
// `cities` plutôt que d'ajouter une entrée ici.
interface CitySubdivisions {
  // Sous-ensemble mis en avant (accueil)
  featured: string[];
  // Liste complète utilisée par le filtre de recherche
  all: string[];
}

const CITY_SUBDIVISIONS: Record<string, CitySubdivisions> = {
  Kinshasa: {
    featured: ['Gombe', 'Limete', 'Bandal', "N'Sele", 'Ngaliema'],
    all: [
      'Gombe', 'Limete', 'Bandal', 'Ngaliema', "N'Sele",
      'Kintambo', 'Lemba', 'Kalamu', 'Ngiri-Ngiri', 'Barumbu',
    ],
  },
};

// Retourne null si la ville n'a pas de subdivisions configurées — c'est ce
// qui permet aux écrans d'appel de masquer le filtre Commune automatiquement.
export function getCitySubdivisions(cityName: string | undefined | null): CitySubdivisions | null {
  if (!cityName) return null;
  return CITY_SUBDIVISIONS[cityName] ?? null;
}
