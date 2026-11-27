/**
 * Moteur de la base de test : un fichier SQLite derrière une interface qui
 * parle « types PostgreSQL ».
 *
 * POURQUOI CE FICHIER EXISTE
 * SQLite ne connaît ni les booléens, ni le JSON, ni les tableaux, ni les
 * dates : tout y est texte, entier ou réel. L'application, elle, attend ce
 * que PostgREST renvoie (true/false, objets, nombres, dates ISO) et les
 * erreurs de PostgreSQL (`23505`, `23503`, `22P02`…). Ce fichier fait la
 * traduction dans les deux sens, et rien d'autre : pas de HTTP, pas de
 * règles d'accès.
 *
 * CHOIX ASSUMÉS
 *  - Les LECTURES chargent la table entière puis filtrent en JavaScript
 *    (quelques centaines de lignes : c'est instantané et bien plus lisible
 *    qu'un traducteur PostgREST -> SQL). Les ÉCRITURES passent par du SQL,
 *    pour que les unicités et les clés étrangères soient réellement tenues
 *    par SQLite.
 *  - Une colonne inconnue reçue en écriture est ajoutée à la volée, avec un
 *    avertissement : la base de test ne doit pas bloquer le développement
 *    parce que `schema.mjs` a un train de retard sur l'application.
 */
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { DEFAUT_MAINTENANT, DEFAUT_UUID, TABLES, VUES, instructionsDeCreation, q, typeSqlite } from './schema.mjs';

/**
 * Erreur au format de PostgreSQL / PostgREST : `{ code, message, details, hint }`.
 * `statut` est le code HTTP que PostgREST associe à ce code d'erreur.
 */
export class ErreurPg extends Error {
  constructor(code, message, { details = null, hint = null, statut = null } = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.hint = hint;
    this.statut = statut ?? statutHttp(code);
  }

  enJson() {
    return { code: this.code, details: this.details, hint: this.hint, message: this.message };
  }
}

/** Correspondance code d'erreur -> statut HTTP, telle que PostgREST la pratique. */
function statutHttp(code) {
  if (code === '23505' || code === '23503') return 409;
  if (code === '42501') return 403;
  if (code === 'PGRST116') return 406;
  if (code === 'PGRST205' || code === 'PGRST202') return 404;
  if (code === 'PGRST201') return 300;
  if (code === 'PGRST301' || code === 'PGRST303') return 401;
  return 400;
}

const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOTIF_NOM = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Date du moment, au format que PostgREST renvoie pour un `timestamptz`. */
export function maintenant() {
  return horodatage(new Date());
}

export function horodatage(date) {
  return date.toISOString().replace('Z', '+00:00');
}

const afficher = (valeur) => (typeof valeur === 'string' ? valeur : JSON.stringify(valeur));

/**
 * Convertit une valeur reçue (JSON de l'application ou texte d'un filtre)
 * vers le type logique de la colonne. Lève l'erreur que PostgreSQL lèverait.
 */
export function convertir(type, valeur) {
  if (valeur === null || valeur === undefined) return null;
  switch (type) {
    case 'uuid':
      if (typeof valeur === 'string' && MOTIF_UUID.test(valeur)) return valeur.toLowerCase();
      throw new ErreurPg('22P02', `invalid input syntax for type uuid: "${afficher(valeur)}"`);
    case 'text':
      return typeof valeur === 'string' ? valeur : afficher(valeur);
    case 'int': {
      const nombre = typeof valeur === 'string' && valeur.trim() !== '' ? Number(valeur) : valeur;
      if (typeof nombre === 'number' && Number.isInteger(nombre)) return nombre;
      throw new ErreurPg('22P02', `invalid input syntax for type integer: "${afficher(valeur)}"`);
    }
    case 'num': {
      const nombre = typeof valeur === 'string' && valeur.trim() !== '' ? Number(valeur) : valeur;
      if (typeof nombre === 'number' && Number.isFinite(nombre)) return nombre;
      throw new ErreurPg('22P02', `invalid input syntax for type numeric: "${afficher(valeur)}"`);
    }
    case 'bool':
      if (typeof valeur === 'boolean') return valeur;
      if (valeur === 'true' || valeur === 't') return true;
      if (valeur === 'false' || valeur === 'f') return false;
      throw new ErreurPg('22P02', `invalid input syntax for type boolean: "${afficher(valeur)}"`);
    case 'json':
      return valeur;
    case 'text[]':
      if (Array.isArray(valeur)) return valeur.map((element) => (element === null ? null : String(element)));
      if (typeof valeur === 'string' && valeur.startsWith('{') && valeur.endsWith('}')) return lireTableauPg(valeur);
      throw new ErreurPg('22P02', `malformed array literal: "${afficher(valeur)}"`);
    case 'timestamptz': {
      // Sans fuseau, PostgreSQL lit l'heure dans le fuseau du serveur : UTC chez Supabase.
      let texte = valeur instanceof Date ? valeur.toISOString() : String(valeur).trim();
      if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(texte) && !/(Z|[+-]\d{2}(:?\d{2})?)$/i.test(texte)) texte += 'Z';
      const date = new Date(texte.replace(' ', 'T'));
      if (!Number.isNaN(date.getTime())) return horodatage(date);
      throw new ErreurPg('22007', `invalid input syntax for type timestamp with time zone: "${afficher(valeur)}"`);
    }
    case 'date': {
      const texte = String(valeur).trim();
      const trouve = /^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/.exec(texte);
      if (trouve && !Number.isNaN(new Date(`${trouve[1]}-${trouve[2]}-${trouve[3]}T00:00:00Z`).getTime())) {
        return `${trouve[1]}-${trouve[2]}-${trouve[3]}`;
      }
      throw new ErreurPg('22007', `invalid input syntax for type date: "${afficher(valeur)}"`);
    }
    case 'time': {
      const trouve = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(valeur).trim());
      if (trouve && Number(trouve[1]) < 24 && Number(trouve[2]) < 60) {
        return `${trouve[1].padStart(2, '0')}:${trouve[2]}:${trouve[3] ?? '00'}`;
      }
      throw new ErreurPg('22007', `invalid input syntax for type time: "${afficher(valeur)}"`);
    }
    default:
      return valeur;
  }
}

/** Lit un tableau au format texte de PostgreSQL : `{a,"b c",d}`. */
export function lireTableauPg(texte) {
  const interieur = texte.slice(1, -1);
  if (interieur.trim() === '') return [];
  const elements = [];
  let courant = '';
  let entreGuillemets = false;
  for (let i = 0; i < interieur.length; i += 1) {
    const c = interieur[i];
    if (entreGuillemets) {
      if (c === '\\') courant += interieur[(i += 1)] ?? '';
      else if (c === '"') entreGuillemets = false;
      else courant += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === ',') {
      elements.push(courant);
      courant = '';
    } else courant += c;
  }
  elements.push(courant);
  return elements;
}

function versSqlite(type, valeur) {
  if (valeur === null || valeur === undefined) return null;
  if (type === 'bool') return valeur ? 1 : 0;
  if (type === 'json' || type === 'text[]') return JSON.stringify(valeur);
  return valeur;
}

function depuisSqlite(type, valeur) {
  if (valeur === null || valeur === undefined) return null;
  if (type === 'bool') return valeur === 1 || valeur === true;
  if (type === 'json' || type === 'text[]') {
    try {
      return JSON.parse(valeur);
    } catch {
      return valeur;
    }
  }
  if (type === 'int' || type === 'num') return Number(valeur);
  return valeur;
}

/** Type deviné pour une colonne ajoutée à la volée, d'après la première valeur reçue. */
function devinerType(valeur) {
  if (typeof valeur === 'boolean') return 'bool';
  if (typeof valeur === 'number') return 'num';
  if (valeur !== null && typeof valeur === 'object') return 'json';
  return 'text';
}

export class Base {
  /**
   * @param {string} fichier chemin du fichier SQLite (créé s'il n'existe pas)
   * @param {(message: string) => void} avertir sortie des avertissements
   */
  constructor(fichier, avertir = () => {}) {
    this.avertir = avertir;
    this.sql = new DatabaseSync(fichier);
    this.sql.exec('pragma foreign_keys = on');
    // `normal` : on accepte de perdre la dernière écriture en cas de coupure
    // de courant, en échange d'écritures nettement plus rapides sous Windows.
    this.sql.exec('pragma synchronous = normal');

    // Copie modifiable de la description : les colonnes ajoutées à la volée s'y greffent.
    this.tables = structuredClone(TABLES);
    this.vues = structuredClone(VUES);
    /** Déclencheurs branchés par `metier.mjs` : { table: { avantInsertion, … } }. */
    this.declencheurs = {};
    this.cache = new Map();
    this.profondeur = 0;

    for (const instruction of instructionsDeCreation()) this.sql.exec(instruction);
    this.#alignerColonnes();
  }

  /**
   * Met la base existante au niveau de la description : colonnes ajoutées à
   * la volée lors d'un lancement précédent, et colonnes apparues depuis dans
   * `schema.mjs`. On n'enlève jamais rien.
   */
  #alignerColonnes() {
    for (const { nom_table, colonne, type } of this.sql.prepare('select * from _yaka_colonnes').all()) {
      if (this.tables[nom_table] && !this.tables[nom_table].colonnes[colonne]) {
        this.tables[nom_table].colonnes[colonne] = { type, ajoutee: true };
      }
    }
    for (const [nom, table] of Object.entries(this.tables)) {
      const presentes = new Set(this.sql.prepare(`pragma table_info(${q(nom)})`).all().map((info) => info.name));
      for (const [colonne, def] of Object.entries(table.colonnes)) {
        if (presentes.has(colonne)) continue;
        this.sql.exec(`alter table ${q(nom)} add column ${q(colonne)} ${typeSqlite(def.type)}`);
        this.avertir(`colonne ${nom}.${colonne} ajoutée à la base existante (nouvelle dans local/schema.mjs)`);
      }
    }
  }

  fermer() {
    this.sql.close();
  }

  // --- Petites valeurs de service (secret des jetons, URL publique…) ---

  meta(cle) {
    return this.sql.prepare('select valeur from _yaka_meta where cle = ?').get(cle)?.valeur ?? null;
  }

  ecrireMeta(cle, valeur) {
    this.sql
      .prepare('insert into _yaka_meta (cle, valeur) values (?, ?) on conflict (cle) do update set valeur = excluded.valeur')
      .run(cle, valeur);
  }

  // --- Description ---

  existe(nom) {
    return Boolean(this.tables[nom] || this.vues[nom]);
  }

  colonnes(nom) {
    return (this.tables[nom] ?? this.vues[nom])?.colonnes ?? {};
  }

  /**
   * Ajoute une colonne absente de la description. C'est une tolérance de la
   * base de test, pas un comportement de PostgreSQL (qui refuserait).
   */
  ajouterColonne(nom, colonne, exemple) {
    if (!MOTIF_NOM.test(colonne)) {
      throw new ErreurPg('PGRST204', `Could not find the '${colonne}' column of '${nom}' in the schema cache`);
    }
    const type = devinerType(exemple);
    this.sql.exec(`alter table ${q(nom)} add column ${q(colonne)} ${typeSqlite(type)}`);
    this.sql.prepare('insert or replace into _yaka_colonnes (nom_table, colonne, type) values (?, ?, ?)').run(nom, colonne, type);
    this.tables[nom].colonnes[colonne] = { type, ajoutee: true };
    this.cache.clear();
    this.avertir(
      `colonne inconnue ${nom}.${colonne} ajoutée à la volée (type ${type}). ` +
        `Si elle existe vraiment en ligne, déclarez-la dans local/schema.mjs ; sinon c'est une erreur de l'application.`,
    );
  }

  // --- Lectures ---

  /** Toutes les lignes d'une table ou d'une vue, typées. Ne pas modifier les objets rendus. */
  lignes(nom) {
    let entree = this.cache.get(nom);
    if (!entree) {
      const colonnes = Object.entries(this.colonnes(nom));
      const lignes = this.sql.prepare(`select * from ${q(nom)}`).all().map((brute) => {
        const ligne = {};
        for (const [colonne, def] of colonnes) ligne[colonne] = depuisSqlite(def.type, brute[colonne]);
        return ligne;
      });
      entree = { lignes, index: null };
      this.cache.set(nom, entree);
    }
    return entree.lignes;
  }

  /** Une ligne par sa clé primaire simple (toutes les tables sauf rares exceptions ont `id`). */
  parCle(nom, valeur) {
    if (valeur === null || valeur === undefined) return null;
    const lignes = this.lignes(nom);
    const entree = this.cache.get(nom);
    if (!entree.index) {
      const cle = this.tables[nom].cle[0];
      entree.index = new Map(lignes.map((ligne) => [ligne[cle], ligne]));
    }
    return entree.index.get(valeur) ?? null;
  }

  // --- Écritures ---

  #defaut(def) {
    if (def.defaut === undefined) return null;
    if (def.defaut === DEFAUT_UUID) return randomUUID();
    if (def.defaut === DEFAUT_MAINTENANT) return maintenant();
    return structuredClone(def.defaut);
  }

  /** Contraintes de la ligne complète : NOT NULL, énumérations, CHECK. */
  #verifier(nom, ligne) {
    for (const [colonne, def] of Object.entries(this.tables[nom].colonnes)) {
      const valeur = ligne[colonne];
      if (valeur === null || valeur === undefined) {
        if (def.requis) {
          throw new ErreurPg('23502', `null value in column "${colonne}" of relation "${nom}" violates not-null constraint`);
        }
        continue;
      }
      if (def.choix && !def.choix.includes(valeur)) {
        if (def.enum) throw new ErreurPg('22P02', `invalid input value for enum ${def.enum}: "${valeur}"`);
        throw new ErreurPg('23514', `new row for relation "${nom}" violates check constraint "${nom}_${colonne}_check"`);
      }
      if ((def.min !== undefined && valeur < def.min) || (def.max !== undefined && valeur > def.max)) {
        throw new ErreurPg('23514', `new row for relation "${nom}" violates check constraint "${nom}_${colonne}_check"`);
      }
    }
  }

  #condition(nom, ligne) {
    const cle = this.tables[nom].cle;
    return { texte: cle.map((colonne) => `${q(colonne)} = ?`).join(' and '), valeurs: cle.map((colonne) => ligne[colonne]) };
  }

  #executer(nom, ligne, action, fonction) {
    try {
      fonction();
    } catch (erreur) {
      throw this.#traduire(erreur, nom, ligne, action);
    } finally {
      this.cache.clear();
    }
  }

  /**
   * Insère une ligne. `contexte.qui` (qui écrit) est transmis aux déclencheurs ;
   * `contexte.controle`, s'il existe, reçoit la ligne prête à être écrite et
   * peut la refuser en levant une erreur (c'est là que passent les règles d'accès).
   * Une clé absente prend la valeur par défaut ; un `null` explicite reste nul.
   */
  inserer(nom, valeurs, contexte = {}) {
    const table = this.tables[nom];
    if (!table) throw new ErreurPg('PGRST205', `Could not find the table 'public.${nom}' in the schema cache`);
    for (const colonne of Object.keys(valeurs)) {
      if (!table.colonnes[colonne]) this.ajouterColonne(nom, colonne, valeurs[colonne]);
    }
    const ligne = {};
    for (const [colonne, def] of Object.entries(table.colonnes)) {
      ligne[colonne] = valeurs[colonne] === undefined ? this.#defaut(def) : convertir(def.type, valeurs[colonne]);
    }
    return this.transaction(() => {
      this.declencheurs[nom]?.avantInsertion?.(ligne, contexte);
      // Même ordre que PostgreSQL : déclencheurs « avant », puis règles
      // d'accès, puis contraintes. Un refus d'accès masque donc un doublon.
      contexte.controle?.(ligne);
      this.#verifier(nom, ligne);
      const colonnes = Object.keys(table.colonnes);
      this.#executer(nom, ligne, 'insertion', () => {
        this.sql
          .prepare(`insert into ${q(nom)} (${colonnes.map(q).join(', ')}) values (${colonnes.map(() => '?').join(', ')})`)
          .run(...colonnes.map((colonne) => versSqlite(table.colonnes[colonne].type, ligne[colonne])));
      });
      this.declencheurs[nom]?.apresInsertion?.(ligne, contexte);
      return ligne;
    });
  }

  /** Modifie une ligne existante (telle que rendue par `lignes`) et rend la nouvelle. */
  modifier(nom, ancienne, changements, contexte = {}) {
    const table = this.tables[nom];
    for (const colonne of Object.keys(changements)) {
      if (!table.colonnes[colonne]) this.ajouterColonne(nom, colonne, changements[colonne]);
    }
    const nouvelle = { ...ancienne };
    for (const [colonne, valeur] of Object.entries(changements)) {
      nouvelle[colonne] = convertir(table.colonnes[colonne].type, valeur);
    }
    return this.transaction(() => {
      this.declencheurs[nom]?.avantModification?.(ancienne, nouvelle, contexte);
      contexte.controle?.(nouvelle);
      this.#verifier(nom, nouvelle);
      const colonnes = Object.keys(table.colonnes);
      const condition = this.#condition(nom, ancienne);
      this.#executer(nom, nouvelle, 'modification', () => {
        this.sql
          .prepare(`update ${q(nom)} set ${colonnes.map((colonne) => `${q(colonne)} = ?`).join(', ')} where ${condition.texte}`)
          .run(...colonnes.map((colonne) => versSqlite(table.colonnes[colonne].type, nouvelle[colonne])), ...condition.valeurs);
      });
      this.declencheurs[nom]?.apresModification?.(ancienne, nouvelle, contexte);
      return nouvelle;
    });
  }

  supprimer(nom, ligne) {
    const condition = this.#condition(nom, ligne);
    this.#executer(nom, ligne, 'suppression', () => {
      this.sql.prepare(`delete from ${q(nom)} where ${condition.texte}`).run(...condition.valeurs);
    });
  }

  /**
   * Tout ou rien. Les transactions s'emboîtent (points de sauvegarde) : une
   * fonction métier appelée depuis une requête reste dans la même unité.
   */
  transaction(fonction) {
    const point = `p${this.profondeur}`;
    this.sql.exec(`savepoint ${point}`);
    this.profondeur += 1;
    try {
      const resultat = fonction();
      this.sql.exec(`release ${point}`);
      return resultat;
    } catch (erreur) {
      this.sql.exec(`rollback to ${point}`);
      this.sql.exec(`release ${point}`);
      this.cache.clear();
      throw erreur;
    } finally {
      this.profondeur -= 1;
    }
  }

  /** Traduit une erreur de contrainte SQLite en erreur PostgreSQL équivalente. */
  #traduire(erreur, nom, ligne, action) {
    if (erreur instanceof ErreurPg) return erreur;
    const message = String(erreur?.message ?? erreur);

    const unicite = /UNIQUE constraint failed: (.+)$/.exec(message);
    if (unicite) {
      const colonnes = unicite[1].split(',').map((morceau) => morceau.trim().split('.').pop());
      const estCle = colonnes.join() === this.tables[nom].cle.join();
      const contrainte = estCle ? `${nom}_pkey` : `${nom}_${colonnes.join('_')}_key`;
      return new ErreurPg('23505', `duplicate key value violates unique constraint "${contrainte}"`, {
        details: `Key (${colonnes.join(', ')})=(${colonnes.map((colonne) => ligne[colonne]).join(', ')}) already exists.`,
      });
    }

    if (message.includes('FOREIGN KEY constraint failed')) {
      if (action !== 'suppression') {
        // SQLite ne dit pas quelle clé a échoué : on cherche la référence absente.
        for (const [colonne, def] of Object.entries(this.tables[nom].colonnes)) {
          if (!def.ref || ligne[colonne] === null) continue;
          const presente = this.sql
            .prepare(`select 1 as present from ${q(def.ref.table)} where ${q(def.ref.colonne)} = ?`)
            .get(ligne[colonne]);
          if (!presente) {
            return new ErreurPg('23503', `insert or update on table "${nom}" violates foreign key constraint "${nom}_${colonne}_fkey"`, {
              details: `Key (${colonne})=(${ligne[colonne]}) is not present in table "${def.ref.table}".`,
            });
          }
        }
      }
      for (const [autre, table] of Object.entries(this.tables)) {
        for (const [colonne, def] of Object.entries(table.colonnes)) {
          if (def.ref?.table !== nom || def.ref.suppression) continue;
          const reference = this.sql.prepare(`select 1 as present from ${q(autre)} where ${q(colonne)} = ?`).get(ligne[def.ref.colonne]);
          if (reference) {
            return new ErreurPg('23503', `update or delete on table "${nom}" violates foreign key constraint "${autre}_${colonne}_fkey" on table "${autre}"`, {
              details: `Key (${def.ref.colonne})=(${ligne[def.ref.colonne]}) is still referenced from table "${autre}".`,
            });
          }
        }
      }
      return new ErreurPg('23503', `insert or update on table "${nom}" violates a foreign key constraint`);
    }

    const requis = /NOT NULL constraint failed: (?:.+\.)?(.+)$/.exec(message);
    if (requis) {
      return new ErreurPg('23502', `null value in column "${requis[1]}" of relation "${nom}" violates not-null constraint`);
    }
    return erreur;
  }
}
