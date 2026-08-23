-- Carte écrite d'un établissement — menu d'un restaurant, grille des
-- attractions d'un site touristique.
--
-- POURQUOI UNE COLONNE ET PAS UNE TABLE
-- Un menu se lit toujours en entier, jamais plat par plat : il arrive avec la
-- fiche, sans requête supplémentaire, et hérite des politiques d'accès déjà
-- posées sur `establishments`. C'est le même choix que `opening_hours`.
-- Contrepartie assumée : on ne peut pas interroger un plat précis à travers
-- les établissements. Le jour où « où manger du poulet moambe » devient un
-- besoin, il faudra une table.
--
-- CE QUE CE N'EST PAS
-- À ne pas confondre avec `establishment_offers`. Une offre se réserve et
-- consomme de la capacité (« Menu du jour, 15 USD, 20 couverts par service ») ;
-- un plat de la carte ne se réserve pas (« Poulet moambe, 12 USD »). Les
-- mélanger ferait apparaître chaque plat dans le formulaire de réservation.
--
-- Forme attendue (voir lib/menu.ts) :
--   {
--     "sections": [
--       {
--         "title": "Plats",
--         "items": [
--           { "label": "Poulet moambe",
--             "description": "Sauce de noix de palme, riz",
--             "price": 12,
--             "currency": "USD" }
--         ]
--       }
--     ]
--   }
--
-- Colonne nullable : tant qu'elle est vide, la fiche n'affiche aucune entrée
-- « Menu » — plutôt qu'une section vide qui laisserait croire à un oubli.

alter table establishments
  add column if not exists menu jsonb;

comment on column establishments.menu is
  'Carte écrite (plats ou attractions). Voir lib/menu.ts. Distinct de establishment_offers, qui porte les offres réservables.';
