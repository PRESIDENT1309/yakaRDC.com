/**
 * Helpers partagés du catalogue d'offres (lot B2).
 *
 * Ces trois calculs apparaissaient à l'identique dans cinq écrans après le
 * branchement de la réservation. Les laisser dupliqués, c'est garantir qu'une
 * correction future n'en atteindra que trois sur cinq — et les deux qui
 * comptent sont comptables.
 */

/** Ligne d'offre telle qu'embarquée dans une requête PostgREST. */
export interface OfferPriceRow {
  price: number | string;
  currency?: string | null;
  unit?: string | null;
  is_active?: boolean | null;
}

/**
 * L'offre active la moins chère — le « à partir de » affiché partout.
 * `null` si l'établissement n'a aucune offre active : le prix est alors
 * inconnu, pas nul. Ne jamais le remplacer par 0.
 */
export function cheapestActiveOffer<T extends OfferPriceRow>(rows: T[] | null | undefined): T | null {
  return (rows ?? [])
    .filter(o => o.is_active !== false)
    .reduce<T | null>(
      (best, o) => (best === null || Number(o.price) < Number(best.price) ? o : best),
      null,
    );
}

/** Ligne de réservation avec son offre et sa catégorie embarquées. */
export interface BookingItemLike {
  quantity: number;
  unit_price: number | string;
  currency: string;
  establishment_offers?: {
    custom_label?: string | null;
    offer_categories?: { label: string } | null;
  } | null;
}

/** Nom lisible d'une ligne : le libellé propre du partenaire prime. */
export function bookingItemLabel(item: BookingItemLike): string {
  return item.establishment_offers?.custom_label?.trim()
    || item.establishment_offers?.offer_categories?.label
    || 'Offre';
}

/** « Suite Fleuve Congo » ou « Adulte × 2 · Enfant × 1 ». Vide si aucune ligne. */
export function bookingItemsSummary(items: BookingItemLike[] | null | undefined): string {
  return (items ?? [])
    .map(i => (i.quantity > 1 ? `${bookingItemLabel(i)} × ${i.quantity}` : bookingItemLabel(i)))
    .join(' · ');
}

/**
 * Nombre de nuits facturées. Un billet ou un repas n'a pas de durée : 1.
 * La nuit du départ n'est pas facturée — d'où la différence brute, pas +1.
 */
export function billedNights(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 1;
  return Math.max(1, Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000,
  ));
}

/**
 * Montant d'une réservation d'après ses lignes : prix gelé × unités × nuits.
 * `null` quand elle n'a aucune ligne — les réservations antérieures au
 * catalogue n'ont jamais eu de montant, leur en inventer un serait faux.
 */
export function bookingTotal(
  items: BookingItemLike[] | null | undefined,
  checkIn: string | null,
  checkOut: string | null,
): { amount: number; currency: string } | null {
  const rows = items ?? [];
  if (rows.length === 0) return null;
  const nights = billedNights(checkIn, checkOut);
  return {
    amount: rows.reduce((t, i) => t + Number(i.unit_price) * i.quantity * nights, 0),
    currency: rows[0].currency,
  };
}
