import PageLegale from '../components/PageLegale';
import type { SectionLegale } from '../lib/legal';

// Ce texte décrit le fonctionnement réel du service. S'il change — paiement en
// ligne, frais, règles d'annulation — c'est ici qu'il faut le corriger, et
// mettre à jour la date dans lib/legal.ts.
const SECTIONS: SectionLegale[] = [
  {
    titre: 'Le service',
    contenu: [
      "YakaRDC est une plateforme qui présente des hôtels, des maisons meublées, des restaurants et des sites touristiques en République démocratique du Congo, et qui permet d'adresser à ces établissements des demandes de réservation.",
      "YakaRDC met en relation voyageurs et établissements. Les prestations (hébergement, repas, visite) sont fournies par l'établissement, qui en est seul responsable.",
    ],
  },
  {
    titre: 'Votre compte',
    contenu: [
      "Un compte est nécessaire pour réserver, enregistrer des favoris ou publier un avis.",
      "Vous vous engagez à fournir des informations exactes et à garder votre mot de passe confidentiel. Vous êtes responsable de l'usage fait de votre compte. Prévenez-nous sans attendre si vous pensez qu'un tiers y a eu accès.",
    ],
  },
  {
    titre: 'Réservations',
    contenu: [
      "Une réservation faite sur YakaRDC est une demande : elle n'est acquise qu'une fois confirmée par l'établissement. Celui-ci peut la refuser, notamment s'il n'a plus de disponibilité.",
      "Une fois la demande confirmée, vous recevez un billet muni d'un code à usage unique, à présenter à l'arrivée.",
      "Tant qu'une demande est en attente, vous pouvez l'annuler depuis « Mes réservations ». Une fois confirmée, toute modification ou annulation se règle directement avec l'établissement, selon ses propres conditions.",
    ],
  },
  {
    titre: 'Prix et paiement',
    contenu: [
      "Les prix sont fixés et communiqués par les établissements. Le total affiché lors d'une demande est une estimation.",
      "YakaRDC n'encaisse aucun paiement : le règlement se fait directement auprès de l'établissement, selon les moyens qu'il accepte.",
    ],
  },
  {
    titre: 'Avis',
    contenu: [
      "Les avis doivent refléter une expérience réelle et rester respectueux. Sont notamment interdits les propos injurieux, diffamatoires ou discriminatoires, les contenus publicitaires et les faux avis.",
      "Nous pouvons retirer un avis qui ne respecte pas ces règles.",
    ],
  },
  {
    titre: 'Établissements partenaires',
    contenu: [
      "Chaque établissement est responsable de l'exactitude des informations qu'il publie (description, photos, tarifs, horaires, disponibilités) et s'engage à honorer les réservations qu'il a confirmées.",
      "Il garantit détenir les droits sur les photos qu'il met en ligne.",
      "Nous pouvons suspendre ou retirer une fiche en cas d'informations trompeuses, de plaintes répétées ou de manquement aux présentes conditions.",
    ],
  },
  {
    titre: 'Usage du site',
    contenu: [
      "Vous vous engagez à ne pas détourner le service de sa finalité : pas de réservations fictives, pas de collecte automatisée des données du site, pas de tentative d'accès aux comptes ou aux données d'autrui.",
      "Nous pouvons suspendre un compte en cas d'abus.",
    ],
  },
  {
    titre: 'Responsabilité',
    contenu: [
      "Nous nous efforçons de présenter des informations exactes et de maintenir le service disponible, sans pouvoir le garantir en permanence.",
      "YakaRDC n'est pas partie au contrat conclu entre le voyageur et l'établissement. Notre responsabilité ne saurait être engagée pour l'exécution de la prestation, ni pour les informations fournies par les établissements. En cas de difficulté, contactez-nous : nous ferons de notre mieux pour vous aider à la résoudre.",
    ],
  },
  {
    titre: 'Propriété intellectuelle',
    contenu: [
      "La marque YakaRDC, son logo et l'interface du site nous appartiennent. Les contenus des fiches appartiennent aux établissements qui les publient. Ils ne peuvent être réutilisés sans autorisation.",
    ],
  },
  {
    titre: 'Données personnelles',
    contenu: [
      "Le traitement de vos données est décrit dans notre politique de confidentialité, accessible en bas de cette page.",
    ],
  },
  {
    titre: 'Évolution et droit applicable',
    contenu: [
      "Ces conditions peuvent évoluer avec le service ; la date de dernière mise à jour figure en haut de la page. Continuer à utiliser le site après une modification vaut acceptation des nouvelles conditions.",
      "Elles sont soumises au droit de la République démocratique du Congo.",
    ],
  },
];

export default function ConditionsScreen() {
  return (
    <PageLegale
      titre="Conditions d'utilisation"
      chapeau="Ces conditions encadrent l'utilisation de YakaRDC par les voyageurs et par les établissements partenaires."
      sections={SECTIONS}
      autre={{ libelle: 'Lire la politique de confidentialité', href: '/confidentialite' }}
    />
  );
}
