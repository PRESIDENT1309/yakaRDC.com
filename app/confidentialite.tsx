import PageLegale from '../components/PageLegale';
import type { SectionLegale } from '../lib/legal';

// Ce texte décrit ce que fait réellement l'application. S'il cesse d'être
// vrai — nouveau prestataire, nouvelle donnée collectée, paiement en ligne —
// c'est ici qu'il faut le corriger, et mettre à jour la date dans lib/legal.ts.
const SECTIONS: SectionLegale[] = [
  {
    titre: 'Les données que nous recueillons',
    contenu: [
      "Nous ne recueillons que ce qui est nécessaire pour faire fonctionner le service.",
      "• À la création du compte : votre nom, votre adresse email, votre numéro de téléphone si vous l'indiquez, et votre mot de passe (conservé sous forme chiffrée, que nous ne pouvons pas lire). Si vous vous connectez avec Google, nous recevons votre nom, votre adresse email et votre photo de profil Google.",
      "• Lors d'une réservation : le nom, le téléphone et l'email de la personne qui réserve, les dates ou l'horaire, le nombre de personnes, l'offre choisie et les précisions que vous ajoutez.",
      "• Ce que vous publiez ou enregistrez : vos avis et notes, vos favoris, votre photo de profil.",
      "• Si vous demandez à devenir partenaire : vos coordonnées et les informations de votre établissement (nom, adresse, description, photos, tarifs, horaires).",
      "• Données techniques : les informations que votre navigateur transmet à tout site qu'il visite (adresse IP, type d'appareil), conservées dans les journaux de nos hébergeurs.",
    ],
  },
  {
    titre: 'À quoi elles servent',
    contenu: [
      "• Créer et sécuriser votre compte.",
      "• Transmettre vos demandes de réservation à l'établissement concerné et vous informer de sa réponse.",
      "• Générer votre billet et son code de vérification.",
      "• Afficher vos avis sur les fiches des établissements.",
      "• Vous envoyer les messages liés au service : confirmation, refus, réinitialisation du mot de passe, identifiants partenaire.",
      "• Prévenir les abus et assurer la sécurité du service.",
      "Nous n'utilisons pas vos données pour de la publicité ciblée et nous ne les vendons pas.",
    ],
  },
  {
    titre: 'Avec qui elles sont partagées',
    contenu: [
      "• L'établissement auprès duquel vous réservez reçoit les informations de votre demande (nom, téléphone, email, dates, nombre de personnes, précisions), afin de pouvoir vous accueillir ou vous joindre.",
      "• Vos avis sont publics : ils apparaissent sur la fiche de l'établissement, visibles de tous les visiteurs.",
      "• Nos prestataires techniques, qui traitent les données pour notre compte : Supabase (base de données, authentification, stockage des photos), Vercel (hébergement du site), notre service d'envoi d'emails, et Google si vous choisissez de vous connecter avec votre compte Google.",
      "Ces prestataires peuvent héberger les données en dehors de la République démocratique du Congo.",
    ],
  },
  {
    titre: 'Paiement',
    contenu: [
      "YakaRDC n'encaisse aucun paiement en ligne. Le règlement se fait directement auprès de l'établissement. Nous ne recueillons donc aucune donnée bancaire.",
    ],
  },
  {
    titre: 'Cookies et stockage local',
    contenu: [
      "Nous n'utilisons ni cookies publicitaires ni outils de pistage. Le site enregistre dans votre navigateur ce qui est nécessaire à son fonctionnement : votre session de connexion, pour que vous n'ayez pas à vous identifier à chaque visite.",
    ],
  },
  {
    titre: 'Durée de conservation',
    contenu: [
      "Vos données sont conservées tant que votre compte existe. Les réservations sont conservées après leur date, car elles constituent l'historique de l'établissement comme le vôtre. Lorsque vous demandez la suppression de votre compte, vos données personnelles sont effacées ou rendues anonymes, sauf celles que la loi nous impose de conserver.",
    ],
  },
  {
    titre: 'Vos droits',
    contenu: [
      "Vous pouvez à tout moment :",
      "• consulter et corriger vos informations depuis « Profil » puis « Modifier le profil » ;",
      "• demander une copie des données que nous détenons sur vous ;",
      "• demander la suppression de votre compte et de vos données ;",
      "• vous opposer à un traitement ou en demander la limitation.",
      "Pour exercer ces droits, écrivez-nous aux coordonnées indiquées en bas de page. Nous vous répondrons dans les meilleurs délais. Ces droits s'exercent dans le cadre de la législation congolaise applicable à la protection des données personnelles.",
    ],
  },
  {
    titre: 'Sécurité',
    contenu: [
      "Les échanges avec le site sont chiffrés (HTTPS). L'accès aux données est limité par des règles appliquées au niveau de la base : un voyageur ne voit que ses réservations, un partenaire que celles de ses établissements. Aucun système n'étant infaillible, nous vous informerons si un incident venait à concerner vos données.",
    ],
  },
  {
    titre: 'Mineurs',
    contenu: [
      "Le service s'adresse aux personnes majeures. Nous ne recueillons pas sciemment de données concernant des mineurs.",
    ],
  },
  {
    titre: 'Modifications',
    contenu: [
      "Cette politique peut évoluer avec le service. La date de dernière mise à jour figure en haut de la page ; en cas de changement important, nous vous en informerons par email ou dans l'application.",
    ],
  },
];

export default function ConfidentialiteScreen() {
  return (
    <PageLegale
      titre="Politique de confidentialité"
      chapeau="Cette page explique quelles informations YakaRDC recueille lorsque vous utilisez le site, pourquoi, et ce que vous pouvez en faire."
      sections={SECTIONS}
      autre={{ libelle: "Lire les conditions d'utilisation", href: '/conditions' }}
    />
  );
}
