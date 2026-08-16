import { Building2, Home, UtensilsCrossed, Mountain } from 'lucide-react-native';
import type { EstablishmentType } from '../lib/types';

interface Props {
  type: EstablishmentType;
  size?: number;
  color: string;
}

// Mapping type d'établissement → icône, jusqu'ici recopié dans plusieurs
// écrans. Source unique. Le trait n'est volontairement pas forcé à 1,75 ici :
// cette icône est aussi utilisée par la Homepage (via ListingCard), qui doit
// rester visuellement identique. Le trait fin est appliqué localement dans
// les écrans redessinés (ex. l'état vide de Recherche), pas ici.
export default function CategoryIcon({ type, size = 24, color }: Props) {
  const props = { size, color };
  switch (type) {
    case 'hotel': return <Building2 {...props} />;
    case 'furnished_house': return <Home {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'site': return <Mountain {...props} />;
  }
}
