/**
 * Informations légales affichées sur `/confidentialite` et `/conditions`.
 *
 * ── À COMPLÉTER PAR L'ÉDITEUR ──────────────────────────────────────────────
 *
 * Les champs à `null` ne sont pas affichés : mieux vaut une ligne absente
 * qu'une raison sociale ou une adresse inventée dans un document qui engage.
 * Dès qu'ils sont renseignés ici, ils apparaissent sur les deux pages.
 *
 * Les textes eux-mêmes décrivent ce que fait réellement l'application au
 * 26/11/2026 (données collectées, prestataires, absence de paiement en ligne).
 * Ils ont été rédigés avec soin mais ne remplacent pas la relecture d'un
 * juriste : à faire valider avant de s'en prévaloir.
 */
export const EDITEUR: {
  raisonSociale: string | null;
  formeEtNumero: string | null;
  adresse: string | null;
  email: string | null;
  whatsapp: string | null;
} = {
  /** Nom de la société ou de la personne qui exploite YakaRDC. */
  raisonSociale: null,
  /** Forme juridique et numéros d'immatriculation (RCCM, Id. Nat., NIF). */
  formeEtNumero: null,
  /** Adresse postale du siège. */
  adresse: null,
  /** Adresse de contact pour les demandes relatives aux données. */
  email: null,
  /** Numéro WhatsApp du support, au format international sans « + ». */
  whatsapp: '243819745279',
};

/** Date de dernière modification des textes, affichée en tête de page. */
export const DERNIERE_MISE_A_JOUR = '2026-11-26';

export interface SectionLegale {
  titre: string;
  /** Paragraphes ; une chaîne commençant par « • » est rendue en puce. */
  contenu: string[];
}
