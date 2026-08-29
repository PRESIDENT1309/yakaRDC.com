/**
 * Carte écrite d'un établissement — plats d'un restaurant, attractions d'un
 * site touristique.
 *
 * À ne pas confondre avec `establishment_offers` : une offre se réserve et
 * consomme de la capacité, un plat de la carte s'affiche seulement. Voir
 * supabase/migrations/0010_menu.sql.
 *
 * Module volontairement pur (aucun import React/Supabase) pour rester
 * testable isolément.
 */

export interface MenuItem {
  label: string;
  description: string | null;
  /** null toléré en lecture : une carte saisie hors de l'éditeur peut en manquer */
  price: number | null;
  currency: string;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export interface Menu {
  sections: MenuSection[];
}

/** Sections suggérées à la saisie — le partenaire reste libre de les nommer. */
export const MENU_SECTION_SUGGESTIONS: Record<'restaurant' | 'site', string[]> = {
  restaurant: ['Entrées', 'Plats', 'Desserts', 'Boissons'],
  site: ['Attractions', 'Activités', 'Services'],
};

/** Titre de la carte selon le métier — un site ne parle pas de « menu ». */
export function menuTitleFor(type: string): string {
  return type === 'restaurant' ? 'Menu' : 'Tarifs & attractions';
}

/**
 * Lecture défensive : la colonne est du JSON libre, écrit par un éditeur qui
 * peut évoluer. On ne fait jamais confiance à sa forme — un plat sans libellé
 * ou une section sans titre est écarté plutôt que rendu comme une ligne vide.
 */
export function parseMenu(raw: unknown): Menu {
  const sections: MenuSection[] = [];
  const rawSections = (raw as any)?.sections;
  if (!Array.isArray(rawSections)) return { sections };

  for (const s of rawSections) {
    const title = typeof s?.title === 'string' ? s.title.trim() : '';
    if (!title) continue;

    const items: MenuItem[] = [];
    for (const i of Array.isArray(s?.items) ? s.items : []) {
      const label = typeof i?.label === 'string' ? i.label.trim() : '';
      if (!label) continue;
      // `Number(null)` vaut 0 : sans ce filtre, un plat SANS prix devient un
      // plat GRATUIT. La nuance compte — « prix non communiqué » et « offert »
      // ne disent pas la même chose au voyageur.
      const brut = i?.price;
      const price = brut === null || brut === undefined || brut === '' ? NaN : Number(brut);
      items.push({
        label,
        description: typeof i?.description === 'string' && i.description.trim()
          ? i.description.trim()
          : null,
        price: Number.isFinite(price) && price >= 0 ? price : null,
        currency: typeof i?.currency === 'string' && i.currency.trim() ? i.currency.trim() : 'USD',
      });
    }
    // Une section sans plat n'a rien à montrer : on ne l'affiche pas.
    if (items.length > 0) sections.push({ title, items });
  }
  return { sections };
}

/** Une carte vide ne doit pas produire d'entrée « Menu » sur la fiche. */
export function isMenuEmpty(menu: Menu | null | undefined): boolean {
  return !menu || menu.sections.length === 0;
}

/** Nombre total de plats — sert au libellé « 12 plats » sur la fiche. */
export function countMenuItems(menu: Menu | null | undefined): number {
  return (menu?.sections ?? []).reduce((n, s) => n + s.items.length, 0);
}

/** Prix affiché d'un plat. Vide quand le partenaire n'en a pas saisi. */
export function formatMenuPrice(item: MenuItem): string {
  return item.price == null ? '' : `${item.price} ${item.currency}`;
}
