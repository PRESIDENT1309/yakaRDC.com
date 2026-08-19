-- Horaires d'ouverture des établissements.
--
-- Forme attendue (voir lib/opening-hours.ts) :
--   {
--     "always_open": false,
--     "days": {
--       "mon": { "from": "08:00", "to": "22:00" },
--       "wed": null,          -- fermé ce jour-là
--       ...
--     }
--   }
--
-- `always_open: true` => ouvert 24h/24, `days` est ignoré.
-- Colonne nullable : tant qu'elle est vide, la fiche n'affiche aucune ligne
-- d'état (surtout pas « Fermé » par défaut, qui serait faux).

alter table establishments
  add column if not exists opening_hours jsonb;
