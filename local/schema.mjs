/**
 * Description des tables de la base de test locale.
 *
 * POURQUOI CE FICHIER EXISTE
 * La base en ligne est du PostgreSQL décrit par `supabase/migrations/*.sql`.
 * La base de test est un fichier SQLite : on ne peut pas y rejouer ces
 * migrations (types, politiques, fonctions PL/pgSQL). On redécrit donc ici,
 * à la main et de façon déclarative, ce que les migrations finissent par
 * produire : colonnes, types, valeurs par défaut, clés, unicités, clés
 * étrangères. Le reste du serveur ne lit que cette description.
 *
 * CE QU'IL FAUT RETENIR
 *  - Quand une migration ajoute une colonne, il faut l'ajouter ici aussi.
 *    Si on l'oublie, rien ne casse : le serveur ajoute la colonne à la volée
 *    à la première écriture et le signale dans sa console (voir `base.mjs`).
 *  - Les types sont les types LOGIQUES (ceux de PostgreSQL, simplifiés). Le
 *    rangement réel dans SQLite est décidé par `typeSqlite` ci-dessous.
 *  - Les règles d'accès ne sont pas ici mais dans `regles.mjs`, les
 *    déclencheurs et les fonctions SQL dans `metier.mjs`.
 */

/** Types logiques acceptés pour une colonne. */
export const TYPES = ['uuid', 'text', 'int', 'num', 'bool', 'json', 'text[]', 'timestamptz', 'date', 'time'];

/** Valeurs par défaut calculées (les autres défauts sont des constantes). */
export const DEFAUT_UUID = '@uuid';
export const DEFAUT_MAINTENANT = '@maintenant';

const TYPES_ETABLISSEMENT = ['hotel', 'furnished_house', 'restaurant', 'site'];

/** Petit raccourci d'écriture : `col('text', { requis: true })`. */
const col = (type, options = {}) => ({ type, ...options });
const identifiant = () => col('uuid', { requis: true, defaut: DEFAUT_UUID });
const creeLe = () => col('timestamptz', { requis: true, defaut: DEFAUT_MAINTENANT });
/** Clé étrangère : `suppression` vaut 'cascade', 'set null' ou rien (refus). */
const ref = (table, suppression, options = {}) => col('uuid', { ref: { table, colonne: 'id', suppression }, ...options });

export const TABLES = {
  profiles: {
    colonnes: {
      // Pas de défaut : l'identifiant est celui du compte (auth.users).
      id: col('uuid', { requis: true, ref: { table: 'auth_users', colonne: 'id', suppression: 'cascade' } }),
      email: col('text'),
      phone: col('text'),
      full_name: col('text'),
      avatar_url: col('text'),
      role: col('text', { requis: true, defaut: 'traveler', enum: 'user_role', choix: ['traveler', 'partner', 'admin'] }),
      created_at: creeLe(),
    },
    cle: ['id'],
    uniques: [['phone'], ['email']],
  },

  cities: {
    colonnes: {
      id: identifiant(),
      name: col('text', { requis: true }),
      is_active: col('bool', { requis: true, defaut: true }),
    },
    cle: ['id'],
    uniques: [['name']],
  },

  establishments: {
    colonnes: {
      id: identifiant(),
      owner_id: ref('profiles', 'cascade', { requis: true }),
      type: col('text', { requis: true, enum: 'establishment_type', choix: TYPES_ETABLISSEMENT }),
      name: col('text', { requis: true }),
      description: col('text'),
      city: col('text', { requis: true }),
      neighborhood: col('text'),
      commune: col('text'),
      avenue: col('text'),
      numero: col('text'),
      reference: col('text'),
      address: col('text'),
      lat: col('num'),
      lng: col('num'),
      phone: col('text'),
      email: col('text'),
      instagram: col('text'),
      tiktok: col('text'),
      logo_url: col('text'),
      amenities: col('text[]', { requis: true, defaut: [] }),
      status: col('text', { requis: true, defaut: 'pending', enum: 'establishment_status', choix: ['pending', 'approved', 'rejected'] }),
      warning_count: col('int', { requis: true, defaut: 0 }),
      suspended_at: col('timestamptz'),
      suspension_reason: col('text'),
      discount_percent: col('num'),
      discount_label: col('text'),
      view_count: col('int', { requis: true, defaut: 0 }),
      opening_hours: col('json'),
      menu: col('json'),
      created_at: creeLe(),
    },
    cle: ['id'],
  },

  offer_categories: {
    colonnes: {
      id: identifiant(),
      establishment_type: col('text', { requis: true, choix: TYPES_ETABLISSEMENT }),
      key: col('text', { requis: true }),
      label: col('text', { requis: true }),
      description_hint: col('text'),
      position: col('int', { requis: true, defaut: 0 }),
      is_active: col('bool', { requis: true, defaut: true }),
    },
    cle: ['id'],
    uniques: [['establishment_type', 'key']],
  },

  establishment_offers: {
    colonnes: {
      id: identifiant(),
      establishment_id: ref('establishments', 'cascade', { requis: true }),
      // Sans « on delete » : on ne supprime pas une catégorie encore utilisée.
      category_id: ref('offer_categories', undefined, { requis: true }),
      custom_label: col('text'),
      description: col('text'),
      price: col('num', { requis: true, min: 0 }),
      currency: col('text', { requis: true, defaut: 'USD' }),
      unit: col('text', { requis: true, choix: ['night', 'person', 'visit'] }),
      quantity: col('int', { min: 1 }),
      max_guests: col('int', { min: 1 }),
      amenities: col('text[]', { requis: true, defaut: [] }),
      is_active: col('bool', { requis: true, defaut: true }),
      position: col('int', { requis: true, defaut: 0 }),
      created_at: creeLe(),
    },
    cle: ['id'],
  },

  listing_photos: {
    colonnes: {
      id: identifiant(),
      establishment_id: ref('establishments', 'cascade', { requis: true }),
      url: col('text', { requis: true }),
      category: col('text', { requis: true, defaut: 'general', choix: ['general', 'menu', 'pricing'] }),
      position: col('int', { requis: true, defaut: 0 }),
      offer_id: ref('establishment_offers', 'cascade'),
    },
    cle: ['id'],
  },

  bookings: {
    colonnes: {
      id: identifiant(),
      establishment_id: ref('establishments', 'cascade', { requis: true }),
      traveler_id: ref('profiles', 'cascade', { requis: true }),
      validated_by: ref('profiles'),
      status: col('text', {
        requis: true,
        defaut: 'pending',
        enum: 'booking_status',
        choix: ['pending', 'confirmed', 'rejected', 'checked_in', 'cancelled'],
      }),
      payment_status: col('text', { requis: true, defaut: 'unpaid', enum: 'payment_status', choix: ['unpaid', 'paid', 'refunded'] }),
      first_name: col('text'),
      last_name: col('text'),
      post_name: col('text'),
      contact_phone: col('text'),
      phone_country_code: col('text', { defaut: '+243' }),
      contact_email: col('text'),
      guests: col('int', { defaut: 1 }),
      children: col('int', { defaut: 0 }),
      check_in: col('date'),
      check_out: col('date'),
      arrival_time: col('text'),
      visit_date: col('date'),
      visit_time: col('time'),
      notes: col('text'),
      cancellation_reason: col('text'),
      metadata: col('json', { defaut: {} }),
      // Le code lisible n'existe qu'à partir de la confirmation (déclencheur
      // `generate_booking_code`, repris dans `metier.mjs`).
      unique_code: col('text'),
      qr_token: col('uuid', { requis: true, defaut: DEFAUT_UUID }),
      used_at: col('timestamptz'),
      created_at: creeLe(),
    },
    cle: ['id'],
    uniques: [['unique_code'], ['qr_token']],
  },

  booking_items: {
    colonnes: {
      id: identifiant(),
      booking_id: ref('bookings', 'cascade', { requis: true }),
      offer_id: ref('establishment_offers', undefined, { requis: true }),
      quantity: col('int', { requis: true, min: 1 }),
      unit_price: col('num', { requis: true, min: 0 }),
      currency: col('text', { requis: true }),
      created_at: creeLe(),
    },
    cle: ['id'],
  },

  reviews: {
    colonnes: {
      id: identifiant(),
      establishment_id: ref('establishments', 'cascade', { requis: true }),
      traveler_id: ref('profiles', 'cascade', { requis: true }),
      booking_id: ref('bookings'),
      rating: col('int', { requis: true, min: 1, max: 5 }),
      comment: col('text'),
      is_verified_stay: col('bool', { requis: true, defaut: false }),
      partner_reply: col('text'),
      partner_replied_at: col('timestamptz'),
      created_at: creeLe(),
    },
    cle: ['id'],
  },

  favorites: {
    colonnes: {
      id: identifiant(),
      traveler_id: ref('profiles', 'cascade', { requis: true }),
      establishment_id: ref('establishments', 'cascade', { requis: true }),
      created_at: creeLe(),
    },
    cle: ['id'],
    uniques: [['traveler_id', 'establishment_id']],
  },

  partner_requests: {
    colonnes: {
      id: identifiant(),
      user_id: ref('profiles', 'set null'),
      establishment_type: col('text', { requis: true }),
      establishment_name: col('text', { requis: true }),
      description: col('text'),
      city: col('text', { requis: true, defaut: 'Kinshasa' }),
      commune: col('text'),
      neighborhood: col('text'),
      avenue: col('text'),
      numero: col('text'),
      reference: col('text'),
      contact_name: col('text'),
      contact_phone: col('text'),
      contact_email: col('text'),
      photo_urls: col('text[]', { requis: true, defaut: [] }),
      status: col('text', { requis: true, defaut: 'pending' }),
      rejection_reason: col('text'),
      reviewed_by: ref('profiles'),
      reviewed_at: col('timestamptz'),
      // Sans « on delete » dans la migration 0020 : supprimer l'établissement
      // créé est refusé tant que la demande y fait référence.
      created_establishment_id: ref('establishments'),
      confirmation_sent_at: col('timestamptz'),
      credentials_sent: col('bool'),
      credentials_error: col('text'),
      credentials_sent_at: col('timestamptz'),
      created_at: creeLe(),
    },
    cle: ['id'],
  },

  establishment_warnings: {
    colonnes: {
      id: identifiant(),
      establishment_id: ref('establishments', 'cascade', { requis: true }),
      issued_by: ref('profiles'),
      reason: col('text', { requis: true }),
      created_at: creeLe(),
    },
    cle: ['id'],
  },

  admin_activity_log: {
    colonnes: {
      id: identifiant(),
      actor_id: ref('profiles'),
      action: col('text', { requis: true }),
      target_type: col('text'),
      target_id: col('text'),
      details: col('json', { defaut: {} }),
      created_at: creeLe(),
    },
    cle: ['id'],
  },

  app_settings: {
    colonnes: {
      key: col('text', { requis: true }),
      value: col('text'),
      updated_at: col('timestamptz', { requis: true, defaut: DEFAUT_MAINTENANT }),
    },
    cle: ['key'],
  },

  trip_plans: {
    colonnes: {
      id: identifiant(),
      traveler_id: ref('profiles', 'cascade', { requis: true }),
      title: col('text', { requis: true, defaut: 'Mon voyage' }),
      destination: col('text'),
      start_date: col('date'),
      end_date: col('date'),
      traveler_count: col('int', { requis: true, defaut: 1 }),
      planned_budget: col('num'),
      notes: col('text'),
      created_at: creeLe(),
    },
    cle: ['id'],
  },

  trip_plan_items: {
    colonnes: {
      id: identifiant(),
      trip_plan_id: ref('trip_plans', 'cascade', { requis: true }),
      establishment_id: ref('establishments', 'set null'),
      item_type: col('text', { requis: true, choix: ['itinerary', 'wishlist'] }),
      day_date: col('date'),
      time: col('text'),
      title: col('text', { requis: true }),
      estimated_cost: col('num', { defaut: 0 }),
      actual_cost: col('num'),
      currency: col('text', { defaut: 'USD' }),
      notes: col('text'),
      visited: col('bool', { requis: true, defaut: false }),
      position: col('int', { requis: true, defaut: 0 }),
      created_at: creeLe(),
    },
    cle: ['id'],
  },

  trip_packing_items: {
    colonnes: {
      id: identifiant(),
      trip_plan_id: ref('trip_plans', 'cascade', { requis: true }),
      category: col('text', { requis: true, defaut: 'custom', choix: ['documents', 'clothing', 'personal', 'custom'] }),
      label: col('text', { requis: true }),
      is_checked: col('bool', { requis: true, defaut: false }),
      position: col('int', { requis: true, defaut: 0 }),
      created_at: creeLe(),
    },
    cle: ['id'],
  },
};

/**
 * Vues en lecture seule. `establishment_ratings` reprend la vue de la
 * migration 0020 : une ligne par établissement, même sans avis.
 */
export const VUES = {
  establishment_ratings: {
    colonnes: {
      establishment_id: col('uuid'),
      review_count: col('int'),
      avg_rating: col('num'),
    },
    sql: `
      select e.id as establishment_id,
             count(r.id) as review_count,
             round(avg(r.rating), 1) as avg_rating
        from establishments e
        left join reviews r on r.establishment_id = e.id
       group by e.id`,
  },
};

/**
 * Tables internes du serveur : comptes, sessions, fichiers. Elles ne sont
 * jamais exposées par `/rest/v1` (comme le schéma `auth` de Supabase).
 */
const SQL_INTERNE = [
  `create table if not exists auth_users (
     id text primary key,
     email text unique,
     mot_de_passe text,
     user_metadata text not null default '{}',
     app_metadata text not null default '{}',
     email_confirmed_at text,
     last_sign_in_at text,
     created_at text not null,
     updated_at text not null
   )`,
  `create table if not exists auth_sessions (
     id text primary key,
     user_id text not null references auth_users(id) on delete cascade,
     methode text not null,
     created_at text not null
   )`,
  `create table if not exists auth_jetons (
     jeton text primary key,
     session_id text not null references auth_sessions(id) on delete cascade,
     remplace_le text,
     created_at text not null
   )`,
  `create table if not exists auth_liens (
     jeton text primary key,
     user_id text not null references auth_users(id) on delete cascade,
     type text not null,
     code text,
     expire_le text not null,
     utilise_le text
   )`,
  `create table if not exists stockage_objets (
     bucket text not null,
     chemin text not null,
     type_mime text not null,
     taille integer not null,
     created_at text not null,
     primary key (bucket, chemin)
   )`,
  `create table if not exists _yaka_meta (cle text primary key, valeur text)`,
  `create table if not exists _yaka_colonnes (
     nom_table text not null,
     colonne text not null,
     type text not null,
     primary key (nom_table, colonne)
   )`,
];

/** Rangement SQLite d'un type logique (on évite l'affinité NUMERIC, qui convertit). */
export function typeSqlite(type) {
  if (type === 'int' || type === 'bool') return 'integer';
  if (type === 'num') return 'real';
  return 'text';
}

/** Guillemets SQL autour d'un nom (certaines colonnes s'appellent `key`, `time`…). */
export const q = (nom) => `"${String(nom).replaceAll('"', '""')}"`;

function sqlCreation(nom, table) {
  const lignes = [];
  for (const [colonne, def] of Object.entries(table.colonnes)) {
    let ligne = `${q(colonne)} ${typeSqlite(def.type)}`;
    if (def.requis) ligne += ' not null';
    if (def.ref) {
      ligne += ` references ${q(def.ref.table)}(${q(def.ref.colonne)})`;
      if (def.ref.suppression) ligne += ` on delete ${def.ref.suppression}`;
    }
    lignes.push(ligne);
  }
  lignes.push(`primary key (${table.cle.map(q).join(', ')})`);
  for (const unique of table.uniques ?? []) lignes.push(`unique (${unique.map(q).join(', ')})`);
  return `create table if not exists ${q(nom)} (\n  ${lignes.join(',\n  ')}\n)`;
}

/** Toutes les instructions à exécuter sur une base vide, dans l'ordre. */
export function instructionsDeCreation() {
  const instructions = [...SQL_INTERNE];
  for (const [nom, table] of Object.entries(TABLES)) instructions.push(sqlCreation(nom, table));
  for (const [nom, vue] of Object.entries(VUES)) {
    instructions.push(`drop view if exists ${q(nom)}`);
    instructions.push(`create view ${q(nom)} as ${vue.sql}`);
  }
  return instructions;
}

/**
 * Liens entre tables déduits des clés étrangères. Sert aux lectures
 * imbriquées de PostgREST : `bookings -> establishments` est un parent (un
 * objet), `establishments -> bookings` des enfants (un tableau).
 */
export function liensEntre(tables, depuis, vers) {
  const liens = [];
  for (const [colonne, def] of Object.entries(tables[depuis]?.colonnes ?? {})) {
    if (def.ref?.table === vers) liens.push({ genre: 'parent', colonne, cible: def.ref.colonne });
  }
  for (const [colonne, def] of Object.entries(tables[vers]?.colonnes ?? {})) {
    if (def.ref?.table === depuis) liens.push({ genre: 'enfants', colonne, cible: def.ref.colonne });
  }
  return liens;
}
