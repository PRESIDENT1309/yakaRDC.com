/**
 * Émulation de Supabase Storage : tout ce qui arrive sur `/storage/v1/*`.
 *
 * POURQUOI CE FICHIER EXISTE
 * Les photos d'établissements, logos, avatars et images d'accueil sont
 * envoyées dans le bucket `establishment-photos`, puis affichées par leur
 * adresse publique. Ici, un fichier envoyé est simplement écrit dans
 * `local/donnees/fichiers/<bucket>/<chemin>` et resservi tel quel.
 *
 * CE QUI EST PRIS EN CHARGE
 *  - envoi : POST (création) ou PUT (remplacement) sur `/object/<bucket>/<chemin>`,
 *    en multipart (ce que fait le client avec un Blob) ou en corps brut ;
 *    en-tête `x-upsert` respecté (sans lui, un fichier existant est un conflit)
 *  - suppression : DELETE `/object/<bucket>` avec `{ prefixes: [...] }`
 *  - lecture publique : `/object/public/<bucket>/<chemin>` avec le bon `Content-Type`
 *
 * CE QUI NE L'EST PAS
 *  - listage, déplacement, copie, URL signées, transformation d'image
 *    (`/render/image/…` ressert l'image d'origine, non redimensionnée)
 *  - les politiques d'accès du bucket : elles ne figurent pas dans les
 *    migrations, on ne peut donc pas les reprendre. Règle appliquée ici :
 *    tout le monde lit, tout utilisateur CONNECTÉ peut envoyer et supprimer.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { maintenant } from './base.mjs';

/** Buckets existants. Un envoi dans un autre bucket échoue, comme en ligne. */
export const BUCKETS = ['establishment-photos'];

const TAILLE_MAX = 50 * 1024 * 1024;

const TYPES_PAR_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
};

class ErreurStockage extends Error {
  constructor(statut, erreur, message) {
    super(message);
    this.statut = statut;
    this.erreur = erreur;
  }
}

export function creerStockage({ base, dossierFichiers, urlPublique }) {
  const { sql } = base;

  /** Chemin sur le disque, après avoir refusé tout ce qui sortirait du dossier. */
  function cheminDisque(bucket, chemin) {
    if (!BUCKETS.includes(bucket)) throw new ErreurStockage(404, 'Bucket not found', 'Bucket not found');
    const segments = chemin.split('/');
    const interdit = (segment) =>
      segment === '' || segment === '.' || segment === '..' || segment.length > 200 || /[<>:"|?*\\\u0000-\u001f]/.test(segment) || /[. ]$/.test(segment);
    if (segments.length === 0 || segments.some(interdit)) {
      throw new ErreurStockage(400, 'InvalidKey', `Invalid key: ${chemin}`);
    }
    return path.join(dossierFichiers, bucket, ...segments);
  }

  const urlDe = (bucket, chemin) => `${urlPublique}/storage/v1/object/public/${bucket}/${chemin.split('/').map(encodeURIComponent).join('/')}`;

  /** Écrit un fichier et sa fiche. Sert aux envois HTTP comme aux données de départ. */
  function ecrire(bucket, chemin, contenu, typeMime) {
    const fichier = cheminDisque(bucket, chemin);
    mkdirSync(path.dirname(fichier), { recursive: true });
    writeFileSync(fichier, contenu);
    sql
      .prepare(
        `insert into stockage_objets (bucket, chemin, type_mime, taille, created_at) values (?, ?, ?, ?, ?)
         on conflict (bucket, chemin) do update set type_mime = excluded.type_mime, taille = excluded.taille`,
      )
      .run(bucket, chemin, typeMime, contenu.length, maintenant());
    return urlDe(bucket, chemin);
  }

  const fiche = (bucket, chemin) => sql.prepare('select * from stockage_objets where bucket = ? and chemin = ?').get(bucket, chemin);

  function supprimer(bucket, chemin) {
    const fichier = cheminDisque(bucket, chemin);
    const connue = fiche(bucket, chemin);
    if (!connue && !existsSync(fichier)) return null;
    rmSync(fichier, { force: true });
    sql.prepare('delete from stockage_objets where bucket = ? and chemin = ?').run(bucket, chemin);
    return { name: chemin, bucket_id: bucket, created_at: connue?.created_at ?? null, metadata: { size: connue?.taille ?? null, mimetype: connue?.type_mime ?? null } };
  }

  const json = (statut, corps) => ({ statut, entetes: { 'Content-Type': 'application/json; charset=utf-8' }, corps: JSON.stringify(corps) });

  /** Sépare `<bucket>/<chemin…>` à partir de segments d'URL déjà décodés. */
  const cible = (segments) => ({ bucket: segments[0] ?? '', chemin: segments.slice(1).join('/') });

  async function envoyer(appel, segments, qui) {
    // Approximation assumée : voir l'en-tête de ce fichier.
    if (qui.role === 'anon') throw new ErreurStockage(403, 'Unauthorized', 'new row violates row-level security policy');
    const { bucket, chemin } = cible(segments);
    const fichier = cheminDisque(bucket, chemin);
    const remplacer = appel.methode === 'PUT' || String(appel.entetes['x-upsert'] ?? '').toLowerCase() === 'true';
    if (!remplacer && existsSync(fichier)) throw new ErreurStockage(409, 'Duplicate', 'The resource already exists');

    let contenu = appel.corps;
    let typeMime = String(appel.entetes['content-type'] ?? '').split(';')[0].trim();
    if (typeMime === 'multipart/form-data') {
      // Le client envoie un Blob dans un formulaire : champ `cacheControl`, puis
      // le fichier dans un champ au nom vide. On laisse Node lire le multipart.
      const formulaire = await new Request('http://local/', {
        method: 'POST',
        headers: { 'content-type': appel.entetes['content-type'] },
        body: appel.corps,
      }).formData();
      const piece = [...formulaire.values()].find((valeur) => typeof valeur !== 'string');
      if (!piece) throw new ErreurStockage(400, 'InvalidRequest', 'Aucun fichier dans le formulaire envoyé');
      contenu = Buffer.from(await piece.arrayBuffer());
      typeMime = piece.type;
    }
    if (contenu.length > TAILLE_MAX) throw new ErreurStockage(413, 'Payload too large', 'The object exceeded the maximum allowed size');
    if (!typeMime || typeMime === 'application/octet-stream') {
      typeMime = TYPES_PAR_EXTENSION[path.extname(chemin).toLowerCase()] ?? 'application/octet-stream';
    }
    ecrire(bucket, chemin, contenu, typeMime);
    return json(200, { Id: randomUUID(), Key: `${bucket}/${chemin}` });
  }

  function lire(appel, segments) {
    const { bucket, chemin } = cible(segments);
    const fichier = cheminDisque(bucket, chemin);
    if (!existsSync(fichier) || !statSync(fichier).isFile()) throw new ErreurStockage(404, 'not_found', 'Object not found');
    const contenu = readFileSync(fichier);
    const entetes = {
      'Content-Type': fiche(bucket, chemin)?.type_mime ?? TYPES_PAR_EXTENSION[path.extname(chemin).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': String(contenu.length),
      // Pas de mise en cache longue : en test, on remplace souvent une image sous le même nom.
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    };
    return { statut: 200, entetes, corps: appel.methode === 'HEAD' ? null : contenu };
  }

  /**
   * @param appel  { methode, chemin, params, entetes, corps: Buffer }
   * @param identifier  fonction rendant l'identité de l'appelant (paresseuse :
   *                    une lecture publique n'a besoin d'aucune clé)
   */
  async function traiter(appel, identifier) {
    try {
      const segments = appel.chemin.split('/').filter(Boolean).map(decodeURIComponent);
      const lecture = appel.methode === 'GET' || appel.methode === 'HEAD';

      if (lecture && segments[0] === 'object' && segments[1] === 'public') return lire(appel, segments.slice(2));
      if (lecture && segments[0] === 'render' && segments[1] === 'image' && segments[2] === 'public') return lire(appel, segments.slice(3));
      if (lecture && segments[0] === 'object') {
        identifier();
        return lire(appel, segments[1] === 'authenticated' ? segments.slice(2) : segments.slice(1));
      }

      if ((appel.methode === 'POST' || appel.methode === 'PUT') && segments[0] === 'object' && segments.length >= 3 && !['list', 'move', 'copy', 'sign', 'upload'].includes(segments[1])) {
        return await envoyer(appel, segments.slice(1), identifier());
      }

      if (appel.methode === 'DELETE' && segments[0] === 'object' && segments.length >= 2) {
        const qui = identifier();
        if (qui.role === 'anon') return json(200, []);
        const { bucket, chemin } = cible(segments.slice(1));
        if (chemin !== '') {
          if (!supprimer(bucket, chemin)) throw new ErreurStockage(404, 'not_found', 'Object not found');
          return json(200, { message: 'Successfully deleted' });
        }
        let demande = {};
        try {
          demande = JSON.parse(appel.corps.toString('utf8') || '{}');
        } catch {
          throw new ErreurStockage(400, 'InvalidRequest', 'Corps JSON illisible');
        }
        if (!Array.isArray(demande.prefixes)) throw new ErreurStockage(400, 'InvalidRequest', 'body must have required property \'prefixes\'');
        // Comme en ligne : un chemin inexistant est ignoré, seuls les fichiers réellement supprimés sont rendus.
        return json(200, demande.prefixes.map((prefixe) => supprimer(bucket, String(prefixe))).filter(Boolean));
      }

      throw new ErreurStockage(404, 'not_found', `Route de stockage non prise en charge par la base de test : ${appel.methode} /${segments.join('/')}`);
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage)) throw erreur;
      // L'API de stockage répond 400 et place le vrai code dans le corps ; on garde 4xx/5xx parlants.
      return json(erreur.statut, { statusCode: String(erreur.statut), error: erreur.erreur, message: erreur.message });
    }
  }

  return { traiter, ecrire, urlDe };
}
