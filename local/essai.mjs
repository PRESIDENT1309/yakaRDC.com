/**
 * Auto-test de la base de test locale.
 *
 * POURQUOI CE SCRIPT EXISTE
 * Le serveur local IMITE Supabase : rien ne garantit qu'il l'imite bien. Ce
 * script rejoue, avec le VRAI client `@supabase/supabase-js` (celui de
 * l'application), les formes de requêtes que l'application envoie, écran par
 * écran, et vérifie les réponses. Si un cas échoue, c'est l'émulation qui est
 * fausse ou incomplète — à corriger avant de s'en servir.
 *
 * CE QU'IL FAIT
 *  - démarre un serveur à part : port libre choisi au hasard, dossier de
 *    données temporaire (jamais `local/donnees/`), et
 *    `YAKA_LOCAL_SANS_EMAIL=1` pour qu'AUCUN email réel ne parte ;
 *  - exécute les cas dans l'ordre, affiche OK ou ECHEC pour chacun ;
 *  - arrête le serveur, efface le dossier temporaire ;
 *  - sort avec un code non nul s'il y a au moins un échec.
 *
 * CE QU'IL NE PROUVE PAS
 * Que la base en ligne se comporte de la même façon. Il vérifie le serveur
 * local contre ce que l'on SAIT de Supabase, pas contre Supabase lui-même.
 *
 * LANCEMENT
 *   npm run local:essai          (ajouter `-- --verbeux` pour voir la console du serveur)
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const ETIQUETTE = '[essai]';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const VERBEUX = process.argv.includes('--verbeux');
const CLE_PUBLIQUE = 'sb_publishable_local_test';
const CLE_SECRETE = 'sb_secret_local_test';
const MOT_DE_PASSE = 'Yaka-test-2026';
const BUCKET = 'establishment-photos';

// ---------------------------------------------------------------------------
// Serveur à part
// ---------------------------------------------------------------------------

function portLibre() {
  return new Promise((resoudre, rejeter) => {
    const sonde = net.createServer();
    sonde.once('error', rejeter);
    sonde.listen(0, '127.0.0.1', () => {
      const { port } = sonde.address();
      sonde.close(() => resoudre(port));
    });
  });
}

const dossierTemporaire = mkdtempSync(path.join(os.tmpdir(), 'yakardc-essai-'));
const port = await portLibre();
const URL_SERVEUR = `http://127.0.0.1:${port}`;
let processus = null;
/** Promesse tenue quand le processus du serveur est terminé. */
let finServeur = null;
let consoleServeur = '';

async function lancerServeur() {
  processus = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(ICI, 'serveur.mjs')], {
    env: {
      ...process.env,
      YAKA_LOCAL_PORT: String(port),
      YAKA_LOCAL_HOTE: '127.0.0.1',
      YAKA_LOCAL_URL: URL_SERVEUR,
      YAKA_LOCAL_DONNEES: dossierTemporaire,
      YAKA_LOCAL_APP_URL: 'http://localhost:8081',
      // Aucun email réel pendant l'auto-test, même si le terminal qui le lance
      // a demandé l'envoi (YAKA_LOCAL_AVEC_EMAIL=1) : l'interdiction l'emporte.
      YAKA_LOCAL_SANS_EMAIL: '1',
      YAKA_LOCAL_AVEC_EMAIL: '',
      YAKA_LOCAL_VERBEUX: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const noter = (morceau) => {
    consoleServeur += morceau.toString('utf8');
    if (VERBEUX) process.stdout.write(morceau);
  };
  processus.stdout.on('data', noter);
  processus.stderr.on('data', noter);
  finServeur = new Promise((resoudre) => processus.once('exit', resoudre));

  for (let essai = 0; essai < 100; essai += 1) {
    if (processus.exitCode !== null) break;
    try {
      const reponse = await fetch(`${URL_SERVEUR}/sante`);
      if (reponse.ok) return;
    } catch {
      // pas encore prêt
    }
    await new Promise((resoudre) => setTimeout(resoudre, 100));
  }
  throw new Error(`le serveur de test n'a pas démarré.\n${consoleServeur}`);
}

async function arreterServeur() {
  if (!processus || processus.exitCode !== null) return;
  processus.kill();
  await finServeur;
}

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

const client = (cle = CLE_PUBLIQUE) =>
  createClient(URL_SERVEUR, cle, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

async function connecte(email, motDePasse = MOT_DE_PASSE) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
  if (error) throw new Error(`connexion de ${email} impossible : ${error.message}`);
  return { supabase, id: data.user.id, session: data.session };
}

/** Rend `data` ou lève l'erreur renvoyée : la plupart des cas attendent un succès. */
function reussi({ data, error }, contexte = '') {
  if (error) throw new Error(`${contexte} erreur inattendue ${error.code ?? ''} ${error.message}`.trim());
  return data;
}

/** Vérifie qu'une requête a échoué avec ce code d'erreur. */
function refuse({ error }, code, contexte = '') {
  assert.ok(error, `${contexte} une erreur ${code} était attendue, la requête a réussi`.trim());
  assert.equal(error.code, code, `${contexte} code d'erreur (${error.message})`.trim());
  return error;
}

const jourRelatif = (ecart) => {
  const date = new Date();
  date.setDate(date.getDate() + ecart);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_ABSENT = '00000000-0000-4000-8000-000000000000';
/** Un PNG d'un pixel : de quoi vérifier qu'un fichier binaire ressort intact. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let total = 0;
const echecs = [];

async function cas(nom, fonction) {
  total += 1;
  try {
    await fonction();
    console.log(`OK     ${nom}`);
  } catch (erreur) {
    echecs.push(nom);
    console.log(`ECHEC  ${nom}`);
    console.log(`         ${String(erreur?.message ?? erreur).split('\n').join('\n         ')}`);
  }
}

// ---------------------------------------------------------------------------
// Cas
// ---------------------------------------------------------------------------

await lancerServeur();
console.log(`${ETIQUETTE} serveur de test sur ${URL_SERVEUR}, données dans ${dossierTemporaire}`);

const anonyme = client();
const service = client(CLE_SECRETE);
let voyageur;
let partenaire;
let admin;
/** Identifiants repérés au fil des cas et réutilisés par les suivants. */
const repere = {};

try {
  // ----- Démarrage et connexion -----

  await cas('démarrage : le serveur répond et a bien ignoré le fichier des secrets d\'email', async () => {
    const sante = await (await fetch(`${URL_SERVEUR}/sante`)).json();
    assert.equal(sante.service, 'yakardc-base-locale');
    assert.equal(sante.sans_email, true);
    assert.match(consoleServeur, /supabase\/functions\/\.env est ignoré, aucun email réel ne peut partir/);
  });

  await cas('connexion : les trois comptes de test ouvrent une session', async () => {
    voyageur = await connecte('voyageur@yakardc.test');
    partenaire = await connecte('partenaire@yakardc.test');
    admin = await connecte('admin@yakardc.test');
    assert.match(voyageur.id, UUID);
    assert.ok(voyageur.session.access_token.split('.').length === 3, 'le jeton d\'accès est un JWT');
    assert.ok(voyageur.session.refresh_token);
  });

  await cas('connexion : mauvais mot de passe refusé avec le message de Supabase', async () => {
    const { data, error } = await client().auth.signInWithPassword({ email: 'voyageur@yakardc.test', password: 'faux-mot-de-passe' });
    assert.equal(data.session, null);
    assert.equal(error.message, 'Invalid login credentials');
    assert.equal(error.code, 'invalid_credentials');
    assert.equal(error.status, 400);
  });

  // ----- Accueil (visiteur non connecté) -----

  await cas('accueil : images de tête lues dans app_settings et réellement servies', async () => {
    const ligne = reussi(await anonyme.from('app_settings').select('value').eq('key', 'home_hero_image_url').maybeSingle());
    const images = JSON.parse(ligne.value);
    assert.equal(images.length, 3);
    const reponse = await fetch(images[0]);
    assert.equal(reponse.status, 200);
    assert.equal(reponse.headers.get('content-type'), 'image/svg+xml');
    assert.match(await reponse.text(), /^<svg /);
  });

  await cas('accueil : photos de catégories (filtre in) et image de récit', async () => {
    const cles = ['home_category_hotel_url', 'home_category_furnished_house_url', 'home_category_restaurant_url', 'home_category_site_url'];
    const lignes = reussi(await anonyme.from('app_settings').select('key, value').in('key', cles));
    assert.deepEqual(lignes.map((ligne) => ligne.key).sort(), [...cles].sort());
    assert.deepEqual(Object.keys(lignes[0]), ['key', 'value']);
    const recit = reussi(await anonyme.from('app_settings').select('value').eq('key', 'home_story_image_url').maybeSingle());
    assert.match(recit.value, /^http:\/\/127\.0\.0\.1:\d+\/storage\/v1\/object\/public\//);
    assert.equal(reussi(await anonyme.from('app_settings').select('value').eq('key', 'cle_absente').maybeSingle()), null);
  });

  await cas('accueil : villes actives triées', async () => {
    const villes = reussi(await anonyme.from('cities').select('*').eq('is_active', true).order('name'));
    assert.deepEqual(villes.map((ville) => ville.name), ['Kinshasa']);
    assert.equal(villes[0].is_active, true);
  });

  await cas('accueil : établissements d\'une catégorie avec leurs photos, types JSON corrects', async () => {
    for (const [type, attendus] of [['hotel', 3], ['furnished_house', 3], ['restaurant', 4], ['site', 3]]) {
      const lignes = reussi(await anonyme.from('establishments').select('*, listing_photos(*)').eq('status', 'approved').eq('type', type).eq('city', 'Kinshasa').limit(10));
      assert.equal(lignes.length, attendus, `nombre de ${type}`);
      for (const ligne of lignes) {
        assert.ok(Array.isArray(ligne.listing_photos) && ligne.listing_photos.length >= 3, 'photos imbriquées');
        assert.ok(Array.isArray(ligne.amenities), 'amenities est un tableau');
        assert.equal(typeof ligne.view_count, 'number');
        assert.equal(typeof ligne.lat, 'number');
        assert.ok(!Number.isNaN(Date.parse(ligne.created_at)), 'created_at est une date ISO');
        assert.match(ligne.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    }
    const hotel = reussi(await anonyme.from('establishments').select('*').eq('name', 'Hôtel Rive Congo').single());
    repere.hotel = hotel.id;
    assert.deepEqual(hotel.opening_hours, { always_open: true, days: {} });
    assert.equal(hotel.discount_percent, 10);
  });

  await cas('accueil : notes moyennes (vue establishment_ratings)', async () => {
    const notes = reussi(await anonyme.from('establishment_ratings').select('*').in('establishment_id', [repere.hotel]));
    assert.deepEqual(notes, [{ establishment_id: repere.hotel, review_count: 3, avg_rating: 4 }]);
  });

  await cas('accueil : un visiteur ne voit ni l\'établissement en attente ni les réservations', async () => {
    assert.deepEqual(reussi(await anonyme.from('establishments').select('id').eq('status', 'pending')), []);
    assert.deepEqual(reussi(await anonyme.from('bookings').select('id')), []);
    assert.deepEqual(reussi(await anonyme.from('profiles').select('id')), []);
    const { count } = await anonyme.from('establishments').select('id', { count: 'exact', head: true });
    assert.equal(count, 13, '12 approuvés + 1 approuvé mais suspendu');
  });

  // ----- Recherche -----

  await cas('recherche : filtres type + nom (ilike), offres et photos imbriquées', async () => {
    const lignes = reussi(
      await anonyme
        .from('establishments')
        .select('*, establishment_offers(price, currency, unit, is_active), listing_photos(*)')
        .eq('status', 'approved')
        .eq('city', 'Kinshasa')
        .eq('type', 'restaurant')
        .ilike('name', '%FLEUVE%')
        .limit(50),
    );
    assert.deepEqual(lignes.map((ligne) => ligne.name), ['La Terrasse du Fleuve']);
    repere.restaurant = lignes[0].id;
    assert.deepEqual(Object.keys(lignes[0].establishment_offers[0]), ['price', 'currency', 'unit', 'is_active']);
    assert.equal(typeof lignes[0].establishment_offers[0].price, 'number');
    assert.equal(lignes[0].establishment_offers[0].is_active, true);
  });

  await cas('recherche : filtre par commune avec apostrophe (N\'Sele)', async () => {
    const lignes = reussi(await anonyme.from('establishments').select('id, name, commune').eq('status', 'approved').eq('city', 'Kinshasa').eq('commune', "N'Sele").limit(50));
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].commune, "N'Sele");
    repere.site = lignes[0].id;
  });

  // ----- Fiche d'un établissement -----

  await cas('fiche : lecture par identifiant (single), identifiant inconnu -> PGRST116, mal formé -> 22P02', async () => {
    const fiche = reussi(await anonyme.from('establishments').select('*').eq('id', repere.hotel).single());
    assert.equal(fiche.name, 'Hôtel Rive Congo');
    const absent = await anonyme.from('establishments').select('*').eq('id', UUID_ABSENT).single();
    refuse(absent, 'PGRST116');
    assert.equal(absent.status, 406);
    const malForme = await anonyme.from('establishments').select('*').eq('id', 'pas-un-uuid').single();
    refuse(malForme, '22P02');
    assert.equal(malForme.status, 400);
  });

  await cas('fiche : offres actives triées par prix avec leur catégorie (parent imbriqué = objet)', async () => {
    const offres = reussi(await anonyme.from('establishment_offers').select('*, offer_categories(*)').eq('establishment_id', repere.hotel).eq('is_active', true).order('price'));
    assert.deepEqual(offres.map((offre) => offre.price), [85, 120, 210]);
    assert.deepEqual(offres.map((offre) => offre.offer_categories.label), ['Standard', 'Supérieure', 'Suite']);
    assert.equal(offres[0].unit, 'night');
    repere.offres = Object.fromEntries(offres.map((offre) => [offre.offer_categories.key, offre]));
  });

  await cas('fiche : photos triées par position', async () => {
    const photos = reussi(await anonyme.from('listing_photos').select('*').eq('establishment_id', repere.hotel).order('position'));
    assert.equal(photos.length, 4);
    assert.deepEqual(photos.map((photo) => photo.position), [0, 0, 1, 2]);
    assert.equal(photos.filter((photo) => photo.offer_id !== null).length, 1);
  });

  await cas('fiche : compteur de vues (rpc increment_establishment_views)', async () => {
    const avant = reussi(await anonyme.from('establishments').select('view_count').eq('id', repere.hotel).single()).view_count;
    const { data, error } = await anonyme.rpc('increment_establishment_views', { p_establishment_id: repere.hotel });
    assert.equal(error, null);
    assert.equal(data, null);
    const apres = reussi(await anonyme.from('establishments').select('view_count').eq('id', repere.hotel).single()).view_count;
    assert.equal(apres, avant + 1);
  });

  await cas('fiche : disponibilités par jour (rpc establishment_offer_load)', async () => {
    const lignes = reussi(await anonyme.rpc('establishment_offer_load', { p_establishment_id: repere.hotel, p_from: jourRelatif(10), p_to: jourRelatif(13) }));
    const standard = lignes.filter((ligne) => ligne.offer_id === repere.offres.standard.id);
    // Réservation de départ du voyageur : 1 chambre standard, nuits J+10 à J+12 (départ J+13).
    assert.deepEqual(standard.map((ligne) => [ligne.day, ligne.units]), [[jourRelatif(10), 1], [jourRelatif(11), 1], [jourRelatif(12), 1]]);
  });

  await cas('fiche : charge par créneau (rpc establishment_slot_load et establishment_offer_slot_load)', async () => {
    const creneaux = reussi(await anonyme.rpc('establishment_slot_load', { p_establishment_id: repere.restaurant, p_date: jourRelatif(3) }));
    assert.deepEqual(creneaux, [{ slot: '19:30:00', guests: 2 }]);
    const parOffre = reussi(await anonyme.rpc('establishment_offer_slot_load', { p_establishment_id: repere.restaurant, p_date: jourRelatif(3) }));
    assert.equal(parOffre.length, 1);
    assert.equal(parOffre[0].slot, '19:30:00');
    assert.equal(parOffre[0].units, 2);
    refuse(await anonyme.rpc('fonction_inexistante', {}), 'PGRST202');
  });

  await cas('fiche : établissements similaires (neq + ilike sur la commune)', async () => {
    const lignes = reussi(
      await anonyme
        .from('establishments')
        .select('*, listing_photos(*), establishment_offers(price, currency, unit, is_active)')
        .eq('type', 'hotel')
        .eq('status', 'approved')
        .neq('id', repere.hotel)
        .ilike('commune', 'ngaliema')
        .limit(3),
    );
    assert.deepEqual(lignes.map((ligne) => ligne.name), ['Résidence Mont-Ngaliema']);
  });

  await cas('fiche : avis du plus récent au plus ancien', async () => {
    const avis = reussi(await anonyme.from('reviews').select('*').eq('establishment_id', repere.hotel).order('created_at', { ascending: false }));
    assert.equal(avis.length, 3);
    assert.ok(avis[0].created_at > avis[1].created_at && avis[1].created_at > avis[2].created_at);
    assert.equal(typeof avis[0].rating, 'number');
    assert.equal(avis[0].is_verified_stay, false);
    repere.avisARepondre = avis.find((ligne) => ligne.partner_reply === null).id;
  });

  // ----- Réservation -----

  const chargeHotel = () => ({
    establishment_id: repere.hotel,
    traveler_id: voyageur.id,
    first_name: 'Grâce',
    last_name: 'Mbuyi',
    post_name: null,
    contact_phone: '810000003',
    phone_country_code: '+243',
    contact_email: 'voyageur@yakardc.test',
    guests: 2,
    children: 0,
    notes: null,
    check_in: jourRelatif(40),
    check_out: jourRelatif(42),
    arrival_time: '16:00',
    metadata: { payment_method: 'on_site' },
  });

  await cas('réservation : hôtel, création puis lignes de réservation (insertion d\'un tableau)', async () => {
    const creee = reussi(await voyageur.supabase.from('bookings').insert(chargeHotel()).select('id').single());
    assert.match(creee.id, UUID);
    repere.reservation = creee.id;
    const { error } = await voyageur.supabase.from('booking_items').insert([
      { booking_id: creee.id, offer_id: repere.offres.standard.id, quantity: 1, unit_price: 85, currency: 'USD' },
      { booking_id: creee.id, offer_id: repere.offres.superieure.id, quantity: 1, unit_price: 120, currency: 'USD' },
    ]);
    assert.equal(error, null);
    const relue = reussi(await voyageur.supabase.from('bookings').select('*, booking_items(quantity, unit_price, currency)').eq('id', creee.id).single());
    assert.equal(relue.status, 'pending');
    assert.equal(relue.payment_status, 'unpaid');
    assert.equal(relue.unique_code, null, 'pas de code avant la confirmation');
    assert.match(relue.qr_token, UUID);
    assert.deepEqual(relue.metadata, { payment_method: 'on_site' });
    assert.equal(relue.check_in, jourRelatif(40));
    assert.equal(relue.booking_items.length, 2);
  });

  await cas('réservation : garde-fou de capacité (OFFER_FULL, 23514) et nettoyage sans effet côté voyageur', async () => {
    const creee = reussi(await voyageur.supabase.from('bookings').insert(chargeHotel()).select('id').single());
    // La suite n'existe qu'en 2 exemplaires : en demander 3 doit échouer.
    const erreur = refuse(
      await voyageur.supabase.from('booking_items').insert([{ booking_id: creee.id, offer_id: repere.offres.suite.id, quantity: 3, unit_price: 210, currency: 'USD' }]),
      '23514',
    );
    assert.match(erreur.message, /^OFFER_FULL: la nuit du \d{2}\/\d{2}\/\d{4} est complète \(2 unité\(s\) restante\(s\)\)\.$/);
    // L'application tente alors de supprimer la réservation : aucune règle ne
    // le permet au voyageur, la requête « réussit » sans rien supprimer.
    const { error } = await voyageur.supabase.from('bookings').delete().eq('id', creee.id);
    assert.equal(error, null);
    const restante = reussi(await service.from('bookings').select('id, booking_items(id)').eq('id', creee.id).single());
    assert.deepEqual(restante.booking_items, [], 'la réservation orpheline reste en base, sans ligne');
    reussi(await service.from('bookings').delete().eq('id', creee.id));
  });

  await cas('réservation : restaurant avec créneau, l\'heure revient au format HH:MM:SS', async () => {
    const creee = reussi(
      await voyageur.supabase
        .from('bookings')
        .insert({ establishment_id: repere.restaurant, traveler_id: voyageur.id, first_name: 'Grâce', last_name: 'Mbuyi', guests: 3, children: 1, visit_date: jourRelatif(6), visit_time: '20:00', metadata: { occasion: 'Dîner', allergies: 'Arachides' } })
        .select('id, visit_time, visit_date, guests, children')
        .single(),
    );
    assert.deepEqual({ ...creee, id: null }, { id: null, visit_time: '20:00:00', visit_date: jourRelatif(6), guests: 3, children: 1 });
    const creneaux = reussi(await anonyme.rpc('establishment_slot_load', { p_establishment_id: repere.restaurant, p_date: jourRelatif(6) }));
    assert.deepEqual(creneaux, [{ slot: '20:00:00', guests: 4 }]);
  });

  await cas('réservation : impossible au nom d\'un autre (42501) ou sans être connecté (401)', async () => {
    const pourAutrui = await voyageur.supabase.from('bookings').insert({ ...chargeHotel(), traveler_id: partenaire.id }).select('id').single();
    refuse(pourAutrui, '42501');
    assert.equal(pourAutrui.status, 403);
    const sansCompte = await anonyme.from('bookings').insert({ ...chargeHotel() });
    refuse(sansCompte, '42501');
    assert.equal(sansCompte.status, 401);
    const enumInconnue = await voyageur.supabase.from('bookings').insert({ ...chargeHotel(), status: 'inconnu' });
    refuse(enumInconnue, '22P02');
  });

  // ----- Mes réservations -----

  await cas('mes réservations : liste complète avec établissement et lignes imbriquées sur trois niveaux', async () => {
    const lignes = reussi(
      await voyageur.supabase
        .from('bookings')
        .select('*, establishment:establishments(*), booking_items(quantity, unit_price, currency, establishment_offers(custom_label, offer_categories(label)))')
        .eq('traveler_id', voyageur.id)
        .order('created_at', { ascending: false }),
    );
    const statuts = new Set(lignes.map((ligne) => ligne.status));
    assert.deepEqual([...statuts].sort(), ['cancelled', 'checked_in', 'confirmed', 'pending', 'rejected']);
    for (let i = 1; i < lignes.length; i += 1) assert.ok(lignes[i - 1].created_at >= lignes[i].created_at, 'tri décroissant');
    const recente = lignes.find((ligne) => ligne.id === repere.reservation);
    assert.equal(recente.establishment.name, 'Hôtel Rive Congo');
    assert.equal(recente.booking_items[1].establishment_offers.custom_label, 'Supérieure vue fleuve');
    assert.equal(recente.booking_items[0].establishment_offers.offer_categories.label, 'Standard');
    const confirmee = lignes.find((ligne) => ligne.status === 'confirmed' && ligne.establishment_id === repere.hotel);
    assert.match(confirmee.unique_code, /^YK-[0-9A-F]{7}$/);
    repere.billet = confirmee.unique_code;
    repere.confirmee = confirmee.id;
    assert.ok(lignes.every((ligne) => ligne.traveler_id === voyageur.id));
  });

  await cas('mes réservations : le voyageur ne lit que les siennes, même sans filtre', async () => {
    const lignes = reussi(await voyageur.supabase.from('bookings').select('id, traveler_id'));
    assert.ok(lignes.length >= 6);
    assert.ok(lignes.every((ligne) => ligne.traveler_id === voyageur.id));
    const toutes = reussi(await service.from('bookings').select('id'));
    assert.ok(toutes.length > lignes.length, 'la clé secrète voit aussi celles des autres');
  });

  await cas('annulation : le voyageur annule sa réservation en attente', async () => {
    const modifiees = reussi(await voyageur.supabase.from('bookings').update({ status: 'cancelled' }).eq('id', repere.reservation).eq('status', 'pending').select('id'));
    assert.deepEqual(modifiees, [{ id: repere.reservation }]);
    const relue = reussi(await voyageur.supabase.from('bookings').select('status').eq('id', repere.reservation).single());
    assert.equal(relue.status, 'cancelled');
  });

  await cas('annulation : politique bookings_cancel_traveler (rien d\'autre que « en attente » -> « annulée »)', async () => {
    // Une réservation confirmée n'est pas modifiable par le voyageur : 0 ligne, pas d'erreur.
    assert.deepEqual(reussi(await voyageur.supabase.from('bookings').update({ status: 'cancelled' }).eq('id', repere.confirmee).select('id')), []);
    // Une réservation en attente ne peut pas être « confirmée » par le voyageur : la ligne
    // est bien visée, mais le résultat est interdit -> erreur RLS.
    const enAttente = reussi(await voyageur.supabase.from('bookings').select('id').eq('status', 'pending').eq('establishment_id', repere.hotel).limit(1).single());
    refuse(await voyageur.supabase.from('bookings').update({ status: 'confirmed' }).eq('id', enAttente.id).select('id'), '42501');
    refuse(await voyageur.supabase.from('bookings').update({ notes: 'retouche' }).eq('id', enAttente.id), '42501');
    assert.equal(reussi(await service.from('bookings').select('status').eq('id', enAttente.id).single()).status, 'pending', 'rien n\'a été écrit');
    // La réservation d'un autre voyageur n'est même pas visible.
    const autre = reussi(await service.from('bookings').select('id').neq('traveler_id', voyageur.id).eq('status', 'pending').limit(1).single());
    assert.deepEqual(reussi(await voyageur.supabase.from('bookings').update({ status: 'cancelled' }).eq('id', autre.id).select('id')), []);
    repere.reservationEnAttente = enAttente.id;
  });

  // ----- Favoris -----

  await cas('favoris : liste, ajout, doublon refusé (23505), retrait', async () => {
    const liste = reussi(await voyageur.supabase.from('favorites').select('*, establishment:establishments(*)').eq('traveler_id', voyageur.id).order('created_at', { ascending: false }));
    assert.equal(liste.length, 3);
    assert.equal(typeof liste[0].establishment.name, 'string');
    assert.equal(reussi(await voyageur.supabase.from('favorites').select('id').eq('traveler_id', voyageur.id).eq('establishment_id', repere.hotel).maybeSingle()), null);
    assert.equal((await voyageur.supabase.from('favorites').insert({ traveler_id: voyageur.id, establishment_id: repere.hotel })).error, null);
    const doublon = await voyageur.supabase.from('favorites').insert({ traveler_id: voyageur.id, establishment_id: repere.hotel });
    refuse(doublon, '23505');
    assert.equal(doublon.status, 409);
    const { count } = await voyageur.supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('traveler_id', voyageur.id);
    assert.equal(count, 4);
    assert.equal((await voyageur.supabase.from('favorites').delete().eq('traveler_id', voyageur.id).eq('establishment_id', repere.hotel)).error, null);
    assert.equal((await voyageur.supabase.from('favorites').delete().eq('id', liste[0].id)).error, null);
    assert.equal(reussi(await voyageur.supabase.from('favorites').select('id')).length, 2);
    assert.deepEqual(reussi(await partenaire.supabase.from('favorites').select('id')), [], 'les favoris d\'un autre sont invisibles');
  });

  await cas('notifications : dernières réservations avec limite', async () => {
    const lignes = reussi(await voyageur.supabase.from('bookings').select('*, establishment:establishments(*)').eq('traveler_id', voyageur.id).order('created_at', { ascending: false }).limit(3));
    assert.equal(lignes.length, 3);
  });

  // ----- Profil -----

  await cas('profil : lecture, compteurs, modification du sien uniquement', async () => {
    const profil = reussi(await voyageur.supabase.from('profiles').select('*').eq('id', voyageur.id).single());
    assert.equal(profil.role, 'traveler');
    assert.equal(profil.full_name, 'Grâce Mbuyi');
    for (const table of ['bookings', 'favorites', 'reviews']) {
      const { count, error } = await voyageur.supabase.from(table).select('id', { count: 'exact', head: true }).eq('traveler_id', voyageur.id);
      assert.equal(error, null);
      assert.equal(typeof count, 'number', `compteur ${table}`);
    }
    assert.equal((await voyageur.supabase.from('profiles').update({ full_name: 'Grâce Mbuyi Kalonji', phone: '+243810000033' }).eq('id', voyageur.id)).error, null);
    assert.equal((await voyageur.supabase.from('profiles').update({ avatar_url: `${URL_SERVEUR}/storage/v1/object/public/${BUCKET}/avatars/x.png` }).eq('id', voyageur.id)).error, null);
    assert.equal(reussi(await voyageur.supabase.from('profiles').select('full_name').eq('id', voyageur.id).single()).full_name, 'Grâce Mbuyi Kalonji');
    // Le profil d'un autre : ni visible, ni modifiable (0 ligne, pas d'erreur).
    assert.deepEqual(reussi(await voyageur.supabase.from('profiles').update({ full_name: 'Piraté' }).eq('id', admin.id).select('id')), []);
    assert.equal(reussi(await service.from('profiles').select('full_name').eq('id', admin.id).single()).full_name, 'Administration YakaRDC');
    // Téléphone déjà pris par un autre profil : unicité.
    refuse(await voyageur.supabase.from('profiles').update({ phone: '+243810000001' }).eq('id', voyageur.id), '23505');
  });

  await cas('carnet de voyage : plan, étapes, liste de bagages, suppression en cascade', async () => {
    const dernier = reussi(await voyageur.supabase.from('trip_plans').select('id').eq('traveler_id', voyageur.id).order('created_at', { ascending: false }).limit(1));
    assert.equal(dernier.length, 1);
    const plan = reussi(await voyageur.supabase.from('trip_plans').insert({ traveler_id: voyageur.id, destination: 'Kinshasa', start_date: jourRelatif(5), end_date: jourRelatif(8), planned_budget: 300 }).select().single());
    assert.equal(plan.title, 'Mon voyage', 'titre par défaut');
    assert.equal(plan.traveler_count, 1);
    reussi(await voyageur.supabase.from('trip_plan_items').insert({ trip_plan_id: plan.id, establishment_id: repere.hotel, item_type: 'wishlist', title: 'Hôtel Rive Congo', estimated_cost: 85, position: 0 }));
    reussi(await voyageur.supabase.from('trip_plan_items').insert({ trip_plan_id: plan.id, item_type: 'itinerary', day_date: jourRelatif(6), time: '09:00', title: 'Marché', estimated_cost: 10, notes: null, position: 1 }));
    reussi(await voyageur.supabase.from('trip_plan_items').insert({ trip_plan_id: plan.id, item_type: 'itinerary', day_date: jourRelatif(5), time: '14:00', title: 'Arrivée', estimated_cost: 0, notes: null, position: 0 }));
    const etapes = reussi(await voyageur.supabase.from('trip_plan_items').select('*').eq('trip_plan_id', plan.id).order('day_date').order('position'));
    // Tri croissant : les dates nulles (liste d'envies) viennent en dernier, comme sous PostgreSQL.
    assert.deepEqual(etapes.map((etape) => etape.title), ['Arrivée', 'Marché', 'Hôtel Rive Congo']);
    assert.equal(etapes[0].visited, false);
    const { count } = await voyageur.supabase.from('trip_plan_items').select('id', { count: 'exact', head: true }).eq('trip_plan_id', plan.id).eq('item_type', 'wishlist');
    assert.equal(count, 1);
    assert.equal((await voyageur.supabase.from('trip_plan_items').update({ visited: true }).eq('id', etapes[0].id)).error, null);
    const bagage = reussi(await voyageur.supabase.from('trip_packing_items').insert({ trip_plan_id: plan.id, category: 'documents', label: 'Passeport', position: 0 }).select().single());
    assert.equal(bagage.is_checked, false);
    assert.equal((await voyageur.supabase.from('trip_packing_items').update({ is_checked: true }).eq('id', bagage.id)).error, null);
    assert.equal(reussi(await voyageur.supabase.from('trip_packing_items').select('*').eq('trip_plan_id', plan.id).order('category').order('position'))[0].is_checked, true);
    refuse(await partenaire.supabase.from('trip_plan_items').insert({ trip_plan_id: plan.id, item_type: 'wishlist', title: 'Intrus' }), '42501');
    assert.equal((await voyageur.supabase.from('trip_plans').update({ title: 'Mission' }).eq('id', plan.id)).error, null);
    assert.equal((await voyageur.supabase.from('trip_plans').delete().eq('id', plan.id)).error, null);
    assert.deepEqual(reussi(await service.from('trip_plan_items').select('id').eq('trip_plan_id', plan.id)), [], 'étapes supprimées avec le plan');
  });

  await cas('avis : le voyageur publie, modifie et supprime son avis', async () => {
    const { error } = await voyageur.supabase.from('reviews').insert({ establishment_id: repere.hotel, traveler_id: voyageur.id, rating: 4, comment: 'Très bon séjour.' });
    assert.equal(error, null);
    const mien = reussi(await voyageur.supabase.from('reviews').select('*').eq('establishment_id', repere.hotel).eq('traveler_id', voyageur.id).single());
    assert.equal((await voyageur.supabase.from('reviews').update({ establishment_id: repere.hotel, traveler_id: voyageur.id, rating: 5, comment: 'Excellent.' }).eq('id', mien.id)).error, null);
    assert.deepEqual(reussi(await anonyme.from('establishment_ratings').select('review_count, avg_rating').eq('establishment_id', repere.hotel).single()), { review_count: 4, avg_rating: 4.3 });
    refuse(await voyageur.supabase.from('reviews').insert({ establishment_id: repere.hotel, traveler_id: voyageur.id, rating: 9 }), '23514');
    assert.equal((await voyageur.supabase.from('reviews').delete().eq('id', mien.id)).error, null);
    assert.equal(reussi(await anonyme.from('reviews').select('id').eq('establishment_id', repere.hotel)).length, 3);
  });

  // ----- Espace partenaire -----

  await cas('espace pro : mon établissement, réservations du mois et du jour', async () => {
    const mien = reussi(await partenaire.supabase.from('establishments').select('*').eq('owner_id', partenaire.id).limit(1).maybeSingle());
    assert.equal(mien.id, repere.hotel);
    const duMois = reussi(await partenaire.supabase.from('bookings').select('*, booking_items(quantity, unit_price)').eq('establishment_id', mien.id).gte('created_at', jourRelatif(-45)));
    assert.ok(duMois.length >= 5);
    assert.ok(duMois.every((ligne) => Array.isArray(ligne.booking_items)));
    assert.equal(typeof duMois[0].booking_items[0].unit_price, 'number');
    const enAttente = reussi(await partenaire.supabase.from('bookings').select('id').eq('establishment_id', mien.id).eq('status', 'pending'));
    assert.ok(enAttente.length >= 2);
    const aujourdhui = jourRelatif(0);
    const duJour = reussi(
      await partenaire.supabase
        .from('bookings')
        .select('id, first_name, last_name, guests, visit_time, status, check_in')
        .eq('establishment_id', mien.id)
        .in('status', ['pending', 'confirmed', 'checked_in'])
        .or(`visit_date.eq.${aujourdhui},check_in.eq.${aujourdhui}`)
        .order('visit_time', { ascending: true, nullsFirst: false }),
    );
    assert.deepEqual(duJour.map((ligne) => [ligne.status, ligne.check_in]), [['confirmed', aujourdhui]]);
    const { count } = await partenaire.supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('establishment_id', mien.id).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
    assert.ok(count >= 5);
    const statistiques = reussi(await partenaire.supabase.from('bookings').select('status, created_at').eq('establishment_id', mien.id).gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString()));
    assert.deepEqual(Object.keys(statistiques[0]), ['status', 'created_at']);
  });

  await cas('espace pro : liste des réservations de mes établissements, sans voir celles des autres', async () => {
    const ids = reussi(await partenaire.supabase.from('establishments').select('id').eq('owner_id', partenaire.id)).map((ligne) => ligne.id);
    const lignes = reussi(
      await partenaire.supabase
        .from('bookings')
        .select('*, establishment:establishments(*), booking_items(quantity, unit_price, currency, establishment_offers(custom_label, offer_categories(label)))')
        .in('establishment_id', ids)
        .order('created_at', { ascending: false }),
    );
    assert.ok(lignes.length >= 5);
    const toutes = reussi(await partenaire.supabase.from('bookings').select('establishment_id'));
    assert.ok(toutes.every((ligne) => ligne.establishment_id === repere.hotel));
    // Le partenaire voit le profil de ses clients, pas celui d'un inconnu.
    assert.equal(reussi(await partenaire.supabase.from('profiles').select('id').eq('id', voyageur.id)).length, 1);
    assert.equal(reussi(await partenaire.supabase.from('profiles').select('id').eq('id', admin.id)).length, 0);
  });

  await cas('espace pro : confirmer génère le code YK-XXXXXXX, refuser n\'en génère pas', async () => {
    assert.equal((await partenaire.supabase.from('bookings').update({ status: 'confirmed' }).eq('id', repere.reservationEnAttente)).error, null);
    const confirmee = reussi(await partenaire.supabase.from('bookings').select('status, unique_code, qr_token').eq('id', repere.reservationEnAttente).single());
    assert.equal(confirmee.status, 'confirmed');
    assert.match(confirmee.unique_code, /^YK-[0-9A-F]{7}$/);
    repere.jetonQr = confirmee.qr_token;
    const autre = reussi(await partenaire.supabase.from('bookings').select('id').eq('establishment_id', repere.hotel).eq('status', 'pending').limit(1).single());
    assert.equal((await partenaire.supabase.from('bookings').update({ status: 'rejected' }).eq('id', autre.id)).error, null);
    assert.equal(reussi(await partenaire.supabase.from('bookings').select('unique_code').eq('id', autre.id).single()).unique_code, null);
  });

  await cas('validation d\'un billet : code, QR, déjà utilisé, introuvable, autre établissement', async () => {
    const premiere = reussi(await partenaire.supabase.rpc('validate_ticket', { p_code: repere.billet.toLowerCase(), p_validator: partenaire.id }));
    assert.equal(premiere.length, 1);
    assert.equal(premiere[0].already_used, false);
    assert.equal(premiere[0].booking_id, repere.confirmee);
    const seconde = reussi(await partenaire.supabase.rpc('validate_ticket', { p_code: repere.billet, p_validator: partenaire.id }));
    assert.equal(seconde[0].already_used, true);
    assert.equal(seconde[0].used_at, premiere[0].used_at);
    const relue = reussi(await partenaire.supabase.from('bookings').select('status, used_at, validated_by').eq('id', repere.confirmee).single());
    assert.deepEqual([relue.status, relue.validated_by], ['checked_in', partenaire.id]);
    const parQr = reussi(await partenaire.supabase.rpc('validate_ticket', { p_code: repere.jetonQr.toUpperCase(), p_validator: partenaire.id }));
    assert.equal(parQr[0].already_used, false);
    const introuvable = await partenaire.supabase.rpc('validate_ticket', { p_code: 'YK-FFFFFFF', p_validator: partenaire.id });
    refuse(introuvable, 'P0001');
    assert.equal(introuvable.error.message, 'Code introuvable');
    assert.equal(introuvable.status, 400);
    const ailleurs = reussi(await service.from('bookings').select('unique_code').eq('establishment_id', repere.restaurant).eq('status', 'confirmed').limit(1).single());
    const pasLeMien = await partenaire.supabase.rpc('validate_ticket', { p_code: ailleurs.unique_code, p_validator: partenaire.id });
    assert.equal(pasLeMien.error.message, "Ce code n'appartient pas à un de vos établissements");
  });

  await cas('espace pro : répondre à un avis', async () => {
    const instant = new Date().toISOString();
    assert.equal((await partenaire.supabase.from('reviews').update({ partner_reply: 'Merci pour votre visite.', partner_replied_at: instant }).eq('id', repere.avisARepondre)).error, null);
    const relu = reussi(await anonyme.from('reviews').select('partner_reply, partner_replied_at').eq('id', repere.avisARepondre).single());
    assert.equal(relu.partner_reply, 'Merci pour votre visite.');
    assert.equal(Date.parse(relu.partner_replied_at), Date.parse(instant));
    const notes = reussi(await partenaire.supabase.from('reviews').select('rating').eq('establishment_id', repere.hotel));
    assert.equal(notes.length, 3);
  });

  await cas('espace pro : modifier sa fiche (tableaux, JSON, nettoyage des lieux), pas celle d\'un autre', async () => {
    const horaires = { always_open: false, days: { mon: { from: '07:00', to: '22:00' }, sun: null } };
    const { error } = await partenaire.supabase
      .from('establishments')
      .update({ name: 'Hôtel Rive Congo', description: 'Description mise à jour.', phone: '+243820001001', email: 'accueil@rive-congo.yakardc.test', instagram: null, tiktok: null, commune: '  Gombe ', neighborhood: 'Quartier du Fleuve', avenue: 'Avenue des Berges', numero: '12', reference: '   ', amenities: ['Wifi', 'Piscine'], discount_percent: null, discount_label: null, opening_hours: horaires, menu: null })
      .eq('id', repere.hotel);
    assert.equal(error, null);
    const relue = reussi(await partenaire.supabase.from('establishments').select('*').eq('id', repere.hotel).single());
    assert.deepEqual(relue.amenities, ['Wifi', 'Piscine']);
    assert.deepEqual(relue.opening_hours, horaires);
    assert.equal(relue.commune, 'Gombe', 'espaces retirés (déclencheur trim_lieux)');
    assert.equal(relue.reference, null, 'chaîne vide ramenée à null');
    assert.equal(relue.discount_percent, null);
    assert.equal((await partenaire.supabase.from('establishments').update({ logo_url: null }).eq('id', repere.hotel)).error, null);
    assert.deepEqual(reussi(await partenaire.supabase.from('establishments').update({ name: 'Détourné' }).eq('id', repere.restaurant).select('id')), []);
    const moinsChere = reussi(await partenaire.supabase.from('establishment_offers').select('price, currency').eq('establishment_id', repere.hotel).eq('is_active', true).order('price').limit(1).maybeSingle());
    assert.deepEqual(moinsChere, { price: 85, currency: 'USD' });
    assert.ok(reussi(await partenaire.supabase.from('bookings').select('status').eq('establishment_id', repere.hotel)).length >= 5);
  });

  await cas('espace pro : gestion des offres (catalogue, création, réservations liées, désactivation, suppression)', async () => {
    const catalogue = reussi(await partenaire.supabase.from('offer_categories').select('*').eq('establishment_type', 'hotel').eq('is_active', true).order('position'));
    assert.equal(catalogue.length, 11);
    assert.deepEqual(catalogue.slice(0, 2).map((categorie) => categorie.key), ['standard', 'superieure']);
    const offres = reussi(await partenaire.supabase.from('establishment_offers').select('*').eq('establishment_id', repere.hotel).order('position').order('price'));
    assert.equal(offres.length, 3);
    const deluxe = catalogue.find((categorie) => categorie.key === 'deluxe');
    const { error } = await partenaire.supabase
      .from('establishment_offers')
      .insert({ establishment_id: repere.hotel, category_id: deluxe.id, custom_label: null, description: 'Chambre d\'angle', price: 160, currency: 'USD', unit: 'night', quantity: 2, max_guests: 2, amenities: ['Wifi'], position: 3 });
    assert.equal(error, null);
    const creee = reussi(await partenaire.supabase.from('establishment_offers').select('*').eq('establishment_id', repere.hotel).eq('category_id', deluxe.id).single());
    assert.equal((await partenaire.supabase.from('establishment_offers').update({ price: 165, quantity: null }).eq('id', creee.id)).error, null);

    // Réservations encore actives sur une offre : jointure interne filtrée sur la table jointe.
    const liees = reussi(
      await partenaire.supabase.from('booking_items').select('booking_id, bookings!inner(id, status, check_out, visit_date)').eq('offer_id', repere.offres.suite.id).in('bookings.status', ['pending', 'confirmed']),
    );
    assert.equal(liees.length, 1);
    assert.equal(liees[0].bookings.status, 'confirmed');
    assert.equal(liees[0].bookings.id, liees[0].booking_id);
    const aucune = reussi(await partenaire.supabase.from('booking_items').select('booking_id, bookings!inner(id, status)').eq('offer_id', repere.offres.suite.id).in('bookings.status', ['rejected']));
    assert.deepEqual(aucune, [], 'la jointure interne écarte les lignes sans réservation correspondante');

    assert.equal((await partenaire.supabase.from('bookings').update({ status: 'cancelled', cancellation_reason: 'Offre retirée par l\'établissement.' }).in('id', liees.map((ligne) => ligne.booking_id))).error, null);
    assert.equal((await partenaire.supabase.from('establishment_offers').update({ is_active: false }).eq('id', repere.offres.suite.id)).error, null);
    assert.equal(reussi(await anonyme.from('establishment_offers').select('id').eq('establishment_id', repere.hotel)).length, 3, 'le public ne voit plus l\'offre désactivée');
    assert.equal(reussi(await partenaire.supabase.from('establishment_offers').select('id').eq('establishment_id', repere.hotel)).length, 4, 'son propriétaire la voit toujours');

    const { count } = await partenaire.supabase.from('booking_items').select('id', { count: 'exact', head: true }).eq('offer_id', repere.offres.suite.id);
    assert.ok(count >= 1);
    // Une offre déjà réservée ne peut pas être supprimée (clé étrangère sans cascade).
    const refus = await partenaire.supabase.from('establishment_offers').delete().eq('id', repere.offres.suite.id);
    refuse(refus, '23503');
    assert.equal(refus.status, 409);
    assert.equal((await partenaire.supabase.from('establishment_offers').delete().eq('id', creee.id)).error, null);
    refuse(await voyageur.supabase.from('establishment_offers').insert({ establishment_id: repere.hotel, category_id: deluxe.id, price: 1, unit: 'night' }), '42501');
  });

  await cas('photos : envoi (multipart et corps brut), lecture publique, x-upsert, suppression', async () => {
    const chemin = `${repere.hotel}/essai-${Date.now()}.png`;
    const envoi = await partenaire.supabase.storage.from(BUCKET).upload(chemin, new Blob([PNG], { type: 'image/png' }), { contentType: 'image/png', upsert: true, cacheControl: '31536000' });
    assert.equal(envoi.error, null);
    assert.equal(envoi.data.path, chemin);
    const adresse = partenaire.supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
    assert.equal(adresse, `${URL_SERVEUR}/storage/v1/object/public/${BUCKET}/${chemin}`);
    const lue = await fetch(adresse);
    assert.equal(lue.status, 200);
    assert.equal(lue.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await lue.arrayBuffer()), PNG, 'le fichier ressort octet pour octet');

    // Sans `upsert`, renvoyer le même chemin est un conflit ; avec, c'est un remplacement.
    const conflit = await partenaire.supabase.storage.from(BUCKET).upload(chemin, new Blob([PNG], { type: 'image/png' }));
    assert.equal(conflit.error?.message, 'The resource already exists');
    const brut = `${repere.hotel}/essai-brut-${Date.now()}.webp`;
    const envoiBrut = await partenaire.supabase.storage.from(BUCKET).upload(brut, PNG, { contentType: 'image/webp', upsert: true });
    assert.equal(envoiBrut.error, null);
    assert.equal((await fetch(`${URL_SERVEUR}/storage/v1/object/public/${BUCKET}/${brut}`)).headers.get('content-type'), 'image/webp');

    const photo = reussi(await partenaire.supabase.from('listing_photos').insert({ establishment_id: repere.hotel, url: adresse, position: 9, category: 'general' }).select().single());
    assert.equal(photo.url, adresse);
    assert.equal(photo.offer_id, null);
    assert.equal((await partenaire.supabase.from('listing_photos').update({ url: adresse }).eq('id', photo.id)).error, null);
    reussi(await partenaire.supabase.from('listing_photos').insert({ establishment_id: repere.hotel, offer_id: repere.offres.standard.id, url: adresse, position: 0, category: 'general' }));
    assert.equal((await partenaire.supabase.from('listing_photos').delete().eq('id', photo.id)).error, null);

    // Le chemin de suppression est déduit de l'adresse, comme dans l'application.
    const supprime = await partenaire.supabase.storage.from(BUCKET).remove([adresse.split(`/${BUCKET}/`)[1], brut]);
    assert.equal(supprime.error, null);
    assert.equal(supprime.data.length, 2);
    assert.notEqual((await fetch(adresse)).status, 200);

    const anonymeEnvoi = await anonyme.storage.from(BUCKET).upload(`intrus-${Date.now()}.png`, new Blob([PNG], { type: 'image/png' }));
    assert.ok(anonymeEnvoi.error, 'un visiteur non connecté ne peut pas envoyer de fichier');
    const mauvaisBucket = await partenaire.supabase.storage.from('bucket-inconnu').upload('x.png', new Blob([PNG], { type: 'image/png' }));
    assert.equal(mauvaisBucket.error?.message, 'Bucket not found');
    const evasion = await fetch(`${URL_SERVEUR}/storage/v1/object/public/${BUCKET}/..%2F..%2Fyakardc-test.db`);
    assert.notEqual(evasion.status, 200, 'impossible de sortir du dossier des fichiers');
  });

  // ----- Administration -----

  await cas('admin : tableau de bord (compteurs, réservations récentes, demandes en attente)', async () => {
    const compter = async (requete) => {
      const { count, error } = await requete;
      assert.equal(error, null);
      return count;
    };
    assert.equal(await compter(admin.supabase.from('establishments').select('id', { count: 'exact', head: true }).eq('status', 'approved')), 13);
    assert.equal(await compter(admin.supabase.from('profiles').select('id', { count: 'exact', head: true })), 7);
    assert.equal(await compter(admin.supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString())), 7);
    assert.equal(await compter(admin.supabase.from('partner_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')), 1);
    assert.equal(reussi(await admin.supabase.from('establishments').select('*').eq('status', 'approved')).length, 13);
    const recentes = reussi(await admin.supabase.from('bookings').select('*, establishment:establishments(*)').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()));
    assert.ok(recentes.length >= 9);
    const parType = reussi(await admin.supabase.from('bookings').select('status, establishment:establishments(type)').gte('created_at', new Date(Date.now() - 365 * 86400000).toISOString()));
    assert.deepEqual(Object.keys(parType[0]), ['status', 'establishment']);
    assert.equal(typeof parType[0].establishment.type, 'string');
    const demandes = reussi(await admin.supabase.from('partner_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(3));
    assert.equal(demandes.length, 1);
    assert.deepEqual(demandes[0].photo_urls, []);
    repere.demande = demandes[0].id;
  });

  await cas('admin : établissements (tous statuts), propriétaire, avertissement, suspension', async () => {
    const tous = reussi(await admin.supabase.from('establishments').select('*').order('created_at', { ascending: false }));
    assert.equal(tous.length, 14);
    const enAttente = reussi(await admin.supabase.from('establishments').select('*').order('created_at', { ascending: false }).eq('type', 'hotel').ilike('name', '%étoile%'));
    assert.equal(enAttente[0].status, 'pending');
    const suspendu = tous.find((ligne) => ligne.suspended_at !== null);
    assert.equal(suspendu.warning_count, 2);
    const proprietaire = reussi(await admin.supabase.from('profiles').select('*').eq('id', suspendu.owner_id).maybeSingle());
    assert.equal(proprietaire.role, 'partner');
    assert.equal(reussi(await admin.supabase.from('establishment_warnings').select('*').eq('establishment_id', suspendu.id).order('created_at', { ascending: false })).length, 2);
    assert.equal((await admin.supabase.from('establishment_warnings').insert({ establishment_id: repere.restaurant, issued_by: admin.id, reason: 'Essai d\'avertissement.' })).error, null);
    assert.equal((await admin.supabase.from('establishments').update({ warning_count: 1 }).eq('id', repere.restaurant)).error, null);
    assert.equal((await admin.supabase.from('establishments').update({ suspended_at: new Date().toISOString(), suspension_reason: 'Essai.' }).eq('id', repere.restaurant)).error, null);
    assert.ok(reussi(await anonyme.from('establishments').select('suspended_at').eq('id', repere.restaurant).single()).suspended_at);
    assert.equal((await admin.supabase.from('establishments').update({ suspended_at: null, suspension_reason: null }).eq('id', repere.restaurant)).error, null);
    assert.equal((await admin.supabase.from('establishments').update({ status: 'approved' }).eq('id', enAttente[0].id)).error, null);
    assert.equal(reussi(await admin.supabase.from('bookings').select('status').eq('establishment_id', repere.restaurant)).length, 2);
    // Le partenaire ne peut ni émettre un avertissement ni lire ceux des autres.
    refuse(await partenaire.supabase.from('establishment_warnings').insert({ establishment_id: repere.hotel, issued_by: partenaire.id, reason: 'x' }), '42501');
    assert.deepEqual(reussi(await partenaire.supabase.from('establishment_warnings').select('id')), []);
  });

  await cas('admin : utilisateurs (recherche or/ilike, changement de rôle, journal)', async () => {
    const liste = reussi(await admin.supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100));
    assert.equal(liste.length, 7);
    const terme = 'mukendi';
    const trouves = reussi(await admin.supabase.from('profiles').select('*').order('created_at', { ascending: false }).or(`full_name.ilike.%${terme}%,email.ilike.%${terme}%,phone.ilike.%${terme}%`).limit(100));
    assert.deepEqual(trouves.map((profil) => profil.full_name), ['Didier Mukendi']);
    assert.equal((await admin.supabase.from('profiles').update({ role: 'partner' }).eq('id', trouves[0].id)).error, null);
    assert.equal((await admin.supabase.from('admin_activity_log').insert({ actor_id: admin.id, action: 'role_changed', target_type: 'profile', target_id: trouves[0].id, details: { from: 'traveler', to: 'partner' } })).error, null);
    const journal = reussi(await admin.supabase.from('admin_activity_log').select('*').order('created_at', { ascending: false }).limit(100));
    assert.deepEqual(journal[0].details, { from: 'traveler', to: 'partner' });
    assert.equal(journal[0].target_id, trouves[0].id);
    assert.equal((await admin.supabase.from('profiles').update({ role: 'traveler' }).eq('id', trouves[0].id)).error, null);
    assert.deepEqual(reussi(await voyageur.supabase.from('admin_activity_log').select('id')), [], 'le journal est réservé à l\'administration');
    refuse(await voyageur.supabase.from('admin_activity_log').insert({ actor_id: voyageur.id, action: 'x' }), '42501');
  });

  await cas('admin : villes et catégories d\'offres (ajout, doublon 23505, activation, suppression)', async () => {
    assert.equal(reussi(await admin.supabase.from('cities').select('*').order('name')).length, 3);
    assert.equal((await admin.supabase.from('cities').insert({ name: 'Matadi', is_active: true })).error, null);
    refuse(await admin.supabase.from('cities').insert({ name: 'Matadi', is_active: true }), '23505');
    const matadi = reussi(await admin.supabase.from('cities').select('*').eq('name', 'Matadi').single());
    assert.equal((await admin.supabase.from('cities').update({ is_active: false }).eq('id', matadi.id)).error, null);
    assert.deepEqual(reussi(await anonyme.from('cities').select('name').eq('is_active', true).order('name')), [{ name: 'Kinshasa' }]);
    assert.equal((await admin.supabase.from('cities').delete().eq('id', matadi.id)).error, null);
    refuse(await voyageur.supabase.from('cities').insert({ name: 'Boma', is_active: true }), '42501');

    const categories = reussi(await admin.supabase.from('offer_categories').select('*').order('establishment_type').order('position'));
    assert.equal(categories.length, 24);
    assert.equal(categories[0].establishment_type, 'furnished_house');
    assert.equal((await admin.supabase.from('offer_categories').insert({ establishment_type: 'site', key: 'pass_annuel', label: 'Pass annuel', position: 7, is_active: true })).error, null);
    refuse(await admin.supabase.from('offer_categories').insert({ establishment_type: 'site', key: 'pass_annuel', label: 'Doublon', position: 8, is_active: true }), '23505');
    const ajoutee = reussi(await admin.supabase.from('offer_categories').select('id').eq('key', 'pass_annuel').single());
    assert.equal((await admin.supabase.from('offer_categories').update({ is_active: false }).eq('id', ajoutee.id)).error, null);
  });

  await cas('admin : apparence (upsert sur app_settings, envoi d\'image), modération des avis', async () => {
    const chemin = `app-assets/home_story_image_url-${Date.now()}.jpg`;
    assert.equal((await admin.supabase.storage.from(BUCKET).upload(chemin, new Blob([PNG], { type: 'image/jpeg' }), { contentType: 'image/jpeg', upsert: true })).error, null);
    const adresse = admin.supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
    const ancienne = reussi(await anonyme.from('app_settings').select('value').eq('key', 'home_story_image_url').maybeSingle()).value;
    // Deux upserts de suite sur la même clé : une seule ligne, mise à jour.
    assert.equal((await admin.supabase.from('app_settings').upsert({ key: 'home_story_image_url', value: 'provisoire', updated_at: new Date().toISOString() })).error, null);
    assert.equal((await admin.supabase.from('app_settings').upsert({ key: 'home_story_image_url', value: adresse, updated_at: new Date().toISOString() })).error, null);
    const lignes = reussi(await anonyme.from('app_settings').select('key, value').eq('key', 'home_story_image_url'));
    assert.deepEqual(lignes, [{ key: 'home_story_image_url', value: adresse }]);
    assert.equal((await admin.supabase.from('app_settings').upsert({ key: 'cle_nouvelle', value: 'x', updated_at: new Date().toISOString() })).error, null);
    assert.equal((await admin.supabase.storage.from(BUCKET).remove([ancienne.split(`/${BUCKET}/`)[1]])).error, null);
    refuse(await voyageur.supabase.from('app_settings').upsert({ key: 'home_story_image_url', value: 'piraté', updated_at: new Date().toISOString() }), '42501');

    const avis = reussi(await admin.supabase.from('reviews').select('*, establishment:establishments(*)').order('created_at', { ascending: false }).limit(100));
    assert.equal(avis.length, 17);
    assert.equal(typeof avis[0].establishment.name, 'string');
    assert.equal((await admin.supabase.from('reviews').delete().eq('id', avis.at(-1).id)).error, null);
    assert.equal(reussi(await admin.supabase.from('reviews').select('id')).length, 16);
  });

  // ----- Authentification -----

  const emailNouveau = `nouveau.${Date.now()}@yakardc.test`;
  await cas('inscription : session immédiate, profil de voyageur créé d\'office, doublon refusé', async () => {
    const supabase = client();
    const { data, error } = await supabase.auth.signUp({ email: emailNouveau, password: 'Secret-initial-1', options: { data: { full_name: '  Nadine Kasongo ', phone: '+243990000111' } } });
    assert.equal(error, null);
    assert.ok(data.session, 'pas de confirmation par email : la session est ouverte tout de suite');
    assert.equal(data.user.email, emailNouveau);
    assert.equal(data.user.user_metadata.phone, '+243990000111');
    repere.nouveau = { supabase, id: data.user.id };
    // L'écran d'inscription tente ensuite un upsert du profil : en ligne comme ici,
    // aucune règle ne permet l'insertion -> erreur, puis il vérifie que le profil existe.
    refuse(await supabase.from('profiles').upsert({ id: data.user.id, full_name: 'Nadine Kasongo', email: emailNouveau, phone: '+243990000111', role: 'traveler' }), '42501');
    assert.deepEqual(reussi(await supabase.from('profiles').select('id').eq('id', data.user.id).maybeSingle()), { id: data.user.id });
    const profil = reussi(await supabase.from('profiles').select('*').eq('id', data.user.id).single());
    assert.deepEqual([profil.full_name, profil.phone, profil.role, profil.email], ['Nadine Kasongo', '+243990000111', 'traveler', emailNouveau]);
    refuse(await supabase.from('profiles').insert({ id: data.user.id, email: emailNouveau, full_name: 'x', role: 'traveler' }).select().single(), '42501');

    const doublon = await client().auth.signUp({ email: emailNouveau.toUpperCase(), password: 'Autre-secret-2' });
    assert.equal(doublon.error?.message, 'User already registered');
    const tropCourt = await client().auth.signUp({ email: `court.${Date.now()}@yakardc.test`, password: '123' });
    assert.equal(tropCourt.error?.code, 'weak_password');
  });

  await cas('session : getUser, renouvellement du jeton, déconnexion', async () => {
    const { supabase } = repere.nouveau;
    const utilisateur = reussi({ data: (await supabase.auth.getUser()).data.user, error: (await supabase.auth.getUser()).error });
    assert.equal(utilisateur.email, emailNouveau);
    const avant = (await supabase.auth.getSession()).data.session;
    const renouvelee = await supabase.auth.refreshSession();
    assert.equal(renouvelee.error, null);
    assert.notEqual(renouvelee.data.session.refresh_token, avant.refresh_token, 'le jeton de rafraîchissement tourne');
    assert.equal(reussi(await supabase.from('profiles').select('id').eq('id', repere.nouveau.id)).length, 1, 'le nouveau jeton d\'accès fonctionne');
    const jetonFaux = await fetch(`${URL_SERVEUR}/rest/v1/cities?select=id`, { headers: { apikey: CLE_PUBLIQUE, Authorization: `Bearer ${avant.access_token.slice(0, -4)}AAAA` } });
    assert.equal(jetonFaux.status, 401, 'un jeton à la signature fausse est refusé');
    const cleFausse = await fetch(`${URL_SERVEUR}/rest/v1/cities?select=id`, { headers: { apikey: 'cle-de-la-base-en-ligne' } });
    assert.equal(cleFausse.status, 401, 'une clé inconnue est refusée');
  });

  await cas('changement de mot de passe : actuel exigé, identique refusé, puis effectif', async () => {
    const { supabase } = repere.nouveau;
    const faux = await supabase.auth.updateUser({ current_password: 'pas-le-bon', password: 'Nouveau-secret-2', data: { must_change_password: false } });
    assert.match(faux.error.message.toLowerCase(), /current password/);
    const identique = await supabase.auth.updateUser({ current_password: 'Secret-initial-1', password: 'Secret-initial-1', data: { must_change_password: false } });
    assert.match(identique.error.message.toLowerCase(), /should be different/);
    const bon = await supabase.auth.updateUser({ current_password: 'Secret-initial-1', password: 'Nouveau-secret-2', data: { must_change_password: false } });
    assert.equal(bon.error, null);
    assert.equal(bon.data.user.user_metadata.must_change_password, false);
    assert.equal(bon.data.user.user_metadata.full_name, '  Nadine Kasongo ', 'les autres métadonnées sont conservées');
    assert.equal((await client().auth.signInWithPassword({ email: emailNouveau, password: 'Secret-initial-1' })).error?.message, 'Invalid login credentials');
    assert.equal((await client().auth.signInWithPassword({ email: emailNouveau, password: 'Nouveau-secret-2' })).error, null);

    const jeton = (await supabase.auth.getSession()).data.session.access_token;
    assert.equal((await supabase.auth.signOut()).error, null);
    const apres = await fetch(`${URL_SERVEUR}/auth/v1/user`, { headers: { apikey: CLE_PUBLIQUE, Authorization: `Bearer ${jeton}` } });
    assert.equal(apres.status, 403, 'après déconnexion, la session n\'existe plus côté serveur');
  });

  await cas('connexion Google et code de vérification : réponses explicites, pas de faux succès', async () => {
    const lien = await client().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'http://localhost:8081/callback', skipBrowserRedirect: true } });
    assert.equal(lien.error, null);
    const page = await fetch(lien.data.url);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const html = await page.text();
    assert.match(html, /base de test locale/);
    assert.match(html, /href="http:&#47;&#47;localhost:8081&#47;login"|href="http:\/\/localhost:8081\/login"/);
    const code = await client().auth.verifyOtp({ email: 'voyageur@yakardc.test', token: '000000', type: 'email' });
    assert.equal(code.error?.code, 'otp_expired');
  });

  // ----- Fonctions Edge (vrai code de supabase/functions, sans email) -----

  await cas('devenir partenaire : dépôt anonyme puis fonction notify-partner-request (vrai code)', async () => {
    const id = crypto.randomUUID();
    const { error } = await anonyme.from('partner_requests').insert({
      id,
      user_id: null,
      establishment_type: 'restaurant',
      establishment_name: 'Table d\'Essai',
      description: 'Demande déposée par l\'auto-test.',
      city: ' Kinshasa ',
      commune: 'Lemba',
      neighborhood: '',
      avenue: 'Avenue de l\'Essai',
      numero: '1',
      reference: null,
      contact_name: 'Testeur',
      contact_phone: '+243990000222',
      contact_email: 'demandeur.anonyme@yakardc.test',
      photo_urls: [],
      // Champs que le formulaire public n'a pas le droit de fixer : le déclencheur les neutralise.
      status: 'approved',
      reviewed_by: admin.id,
    });
    assert.equal(error, null);
    assert.deepEqual(reussi(await anonyme.from('partner_requests').select('id').eq('id', id)), [], 'le déposant anonyme ne peut pas relire sa demande');
    const deposee = reussi(await admin.supabase.from('partner_requests').select('*').eq('id', id).single());
    assert.deepEqual([deposee.status, deposee.reviewed_by, deposee.user_id, deposee.city, deposee.neighborhood], ['pending', null, null, 'Kinshasa', null]);

    const reponse = await anonyme.functions.invoke('notify-partner-request', { body: { request_id: id } });
    assert.equal(reponse.error, null);
    assert.equal(reponse.data.sent, false);
    assert.match(reponse.data.error, /Aucun service d'envoi configuré/);
    assert.equal(reussi(await admin.supabase.from('partner_requests').select('confirmation_sent_at').eq('id', id).single()).confirmation_sent_at, null);
    const absente = await anonyme.functions.invoke('notify-partner-request', { body: { request_id: UUID_ABSENT } });
    assert.equal(absente.error?.context?.status, 404);
    repere.demandeAnonyme = id;
  });

  await cas('mot de passe oublié : fonction request-password-reset (vrai code), lien, nouvelle session, nouveau mot de passe', async () => {
    const reponse = await anonyme.functions.invoke('request-password-reset', { body: { email: emailNouveau } });
    assert.equal(reponse.error, null);
    assert.equal(reponse.data.sent, true);
    assert.match(reponse.data.email_error, /Aucun service d'envoi configuré/);
    const inconnu = await anonyme.functions.invoke('request-password-reset', { body: { email: 'personne@yakardc.test' } });
    assert.deepEqual(inconnu.data, { sent: true }, 'une adresse inconnue ne se distingue pas');
    const sansEmail = await anonyme.functions.invoke('request-password-reset', { body: {} });
    assert.equal(sansEmail.error?.context?.status, 400);

    // Aucun email ne part : le lien est écrit dans la console du serveur.
    const liens = [...consoleServeur.matchAll(/lien « recovery » généré pour (\S+) [^\n]*: (http\S+)/g)].filter((trouve) => trouve[1] === emailNouveau);
    assert.equal(liens.length, 1, 'le lien de récupération apparaît dans la console du serveur');
    const lien = liens[0][2];
    assert.ok(lien.startsWith(`${URL_SERVEUR}/auth/v1/verify?token=`));

    const redirection = await fetch(lien, { redirect: 'manual' });
    assert.equal(redirection.status, 303);
    const retour = new URL(redirection.headers.get('location'));
    assert.equal(`${retour.origin}${retour.pathname}`, 'http://localhost:8081/reset-password');
    const fragment = new URLSearchParams(retour.hash.slice(1));
    assert.equal(fragment.get('type'), 'recovery');
    assert.equal(fragment.get('token_type'), 'bearer');
    assert.ok(fragment.get('access_token') && fragment.get('refresh_token') && fragment.get('expires_in'));

    // L'écran de réinitialisation : session issue du lien, puis nouveau mot de passe SANS l'actuel.
    const supabase = client();
    const session = await supabase.auth.setSession({ access_token: fragment.get('access_token'), refresh_token: fragment.get('refresh_token') });
    assert.equal(session.error, null);
    assert.equal(session.data.user.email, emailNouveau);
    const change = await supabase.auth.updateUser({ password: 'Recupere-secret-3', data: { must_change_password: false } });
    assert.equal(change.error, null);
    assert.equal((await client().auth.signInWithPassword({ email: emailNouveau, password: 'Recupere-secret-3' })).error, null);

    // Le lien ne sert qu'une fois.
    const rejoue = await fetch(lien, { redirect: 'manual' });
    assert.match(new URL(rejoue.headers.get('location')).hash, /error=access_denied/);
    // Hors session de récupération, le mot de passe actuel reste exigé.
    const { supabase: normal } = await connecte(emailNouveau, 'Recupere-secret-3');
    const sansActuel = await normal.auth.updateUser({ password: 'Encore-un-autre-4' });
    assert.match(sansActuel.error.message.toLowerCase(), /current password/);
  });

  await cas('approbation d\'un partenaire : fonction approve-partner (vrai code), compte créé, mot de passe provisoire', async () => {
    const interdit = await voyageur.supabase.functions.invoke('approve-partner', { body: { request_id: repere.demande } });
    assert.equal(interdit.error?.context?.status, 403, 'réservé à l\'administration');

    const reponse = await admin.supabase.functions.invoke('approve-partner', { body: { request_id: repere.demande } });
    assert.equal(reponse.error, null, reponse.error ? await reponse.error.context?.text?.() : '');
    const resultat = reponse.data;
    assert.match(resultat.establishment_id, UUID);
    assert.match(resultat.owner_id, UUID);
    assert.equal(resultat.account_created, true);
    assert.equal(resultat.email_sent, false);
    assert.match(resultat.email_error, /Aucun service d'envoi configuré/);
    assert.match(resultat.temporary_password, /^[^\s-]{1,4}(-[^\s-]{1,4})+$/, 'mot de passe provisoire rendu à l\'administrateur faute d\'email');

    const etablissement = reussi(await anonyme.from('establishments').select('*').eq('id', resultat.establishment_id).single());
    assert.deepEqual([etablissement.name, etablissement.status, etablissement.owner_id, etablissement.type], ['Auberge du Pool Malebo', 'approved', resultat.owner_id, 'hotel']);
    const profil = reussi(await admin.supabase.from('profiles').select('*').eq('id', resultat.owner_id).single());
    assert.deepEqual([profil.role, profil.email, profil.full_name], ['partner', 'candidat@yakardc.test', 'Marie Nsimba']);
    const demande = reussi(await admin.supabase.from('partner_requests').select('*').eq('id', repere.demande).single());
    assert.deepEqual([demande.status, demande.reviewed_by, demande.created_establishment_id, demande.user_id, demande.credentials_sent], ['approved', admin.id, resultat.establishment_id, resultat.owner_id, false]);
    assert.match(demande.credentials_error, /Aucun service d'envoi configuré/);
    const journal = reussi(await admin.supabase.from('admin_activity_log').select('*').eq('action', 'partner_request_approved').eq('target_id', repere.demande).single());
    assert.equal(journal.details.establishment_id, resultat.establishment_id);

    // Le nouveau partenaire se connecte avec le mot de passe provisoire et doit en changer.
    const nouveau = await client().auth.signInWithPassword({ email: 'candidat@yakardc.test', password: resultat.temporary_password });
    assert.equal(nouveau.error, null);
    assert.equal(nouveau.data.user.user_metadata.must_change_password, true);

    const deuxFois = await admin.supabase.functions.invoke('approve-partner', { body: { request_id: repere.demande } });
    assert.equal(deuxFois.error?.context?.status, 409, 'une demande déjà approuvée est refusée');
    const restantes = await admin.supabase.from('partner_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved').or('credentials_sent.is.null,credentials_sent.is.false');
    assert.equal(restantes.count, 1, 'compteur des identifiants non remis');
  });

  await cas('approbation d\'un partenaire : demandeur déjà inscrit (lien de récupération au lieu d\'un compte)', async () => {
    const id = crypto.randomUUID();
    const { supabase, id: idCompte } = await connecte(emailNouveau, 'Recupere-secret-3');
    const { error } = await supabase.from('partner_requests').insert({ id, user_id: UUID_ABSENT, establishment_type: 'site', establishment_name: 'Site d\'Essai', description: null, city: 'Kinshasa', commune: 'Gombe', contact_name: 'Nadine Kasongo', contact_phone: '+243990000111', contact_email: emailNouveau, photo_urls: [] });
    assert.equal(error, null);
    const mienne = reussi(await supabase.from('partner_requests').select('user_id, status').eq('id', id).single());
    assert.equal(mienne.user_id, idCompte, 'l\'identité du demandeur est celle de sa session, pas celle envoyée');

    const reponse = await admin.supabase.functions.invoke('approve-partner', { body: { request_id: id } });
    assert.equal(reponse.error, null, reponse.error ? await reponse.error.context?.text?.() : '');
    assert.equal(reponse.data.account_created, false);
    assert.equal(reponse.data.owner_id, idCompte);
    assert.equal(reponse.data.temporary_password, undefined);
    assert.equal(reussi(await supabase.from('profiles').select('role').eq('id', idCompte).single()).role, 'partner');
    assert.equal(reussi(await supabase.from('establishments').select('name').eq('owner_id', idCompte).single()).name, 'Site d\'Essai');

    // Refus d'une autre demande et relance des identifiants, comme sur l'écran d'administration.
    assert.equal((await admin.supabase.from('partner_requests').update({ status: 'rejected', rejection_reason: 'Essai de refus.', reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq('id', repere.demandeAnonyme)).error, null);
    assert.equal((await admin.supabase.from('partner_requests').update({ credentials_sent: true, credentials_error: null, credentials_sent_at: new Date().toISOString() }).eq('id', id)).error, null);
    const inconnue = await admin.supabase.functions.invoke('fonction-inexistante', { body: {} });
    assert.equal(inconnue.error?.context?.status, 404);
  });

  // ----- Fidélité du protocole -----

  await cas('protocole : colonne inconnue lue -> null avec avertissement ; écrite -> ajoutée à la volée', async () => {
    const lue = reussi(await anonyme.from('cities').select('name, colonne_fantome').limit(1));
    assert.deepEqual(Object.keys(lue[0]), ['name', 'colonne_fantome']);
    assert.equal(lue[0].colonne_fantome, null);
    assert.match(consoleServeur, /AVERTISSEMENT : lecture de la colonne inconnue cities\.colonne_fantome/);
    const creee = reussi(await voyageur.supabase.from('trip_plans').insert({ traveler_id: voyageur.id, title: 'Avec colonne nouvelle', colonne_nouvelle: { a: 1 } }).select().single());
    assert.deepEqual(creee.colonne_nouvelle, { a: 1 });
    assert.match(consoleServeur, /AVERTISSEMENT : colonne inconnue trip_plans\.colonne_nouvelle ajoutée à la volée/);
    repere.planTemoin = creee.id;
  });

  await cas('protocole : table inconnue, pagination, comptage, écriture sans filtre, relation ambiguë', async () => {
    const inconnue = await anonyme.from('table_inexistante').select('*');
    refuse(inconnue, 'PGRST205');
    assert.equal(inconnue.status, 404);
    const page = await anonyme.from('establishments').select('name', { count: 'exact' }).order('name').range(2, 4);
    assert.equal(page.error, null);
    assert.equal(page.data.length, 3);
    assert.ok(page.count > 3);
    const tous = reussi(await anonyme.from('establishments').select('name').order('name'));
    assert.deepEqual(page.data, tous.slice(2, 5));
    refuse(await service.from('cities').update({ is_active: true }), '21000');
    // bookings référence profiles deux fois (voyageur et validateur) : il faut préciser laquelle.
    refuse(await service.from('bookings').select('id, profiles(*)').limit(1), 'PGRST201');
    const precise = reussi(await service.from('bookings').select('id, voyageur:profiles!traveler_id(full_name)').limit(1));
    assert.equal(typeof precise[0].voyageur.full_name, 'string');
    refuse(await service.from('cities').select('id, bookings(*)').limit(1), 'PGRST200');
    const trie = reussi(await service.from('bookings').select('visit_time').order('visit_time', { ascending: false, nullsFirst: false }).limit(1));
    assert.notEqual(trie[0].visit_time, null, 'nullslast respecté en ordre décroissant');
    const negation = reussi(await service.from('bookings').select('id, status').not('status', 'in', '(pending,confirmed)').is('visit_date', null));
    assert.ok(negation.length > 0 && negation.every((ligne) => !['pending', 'confirmed'].includes(ligne.status)));
  });

  await cas('protocole : requête du script de construction web (scripts/postbuild-web.mjs)', async () => {
    const adresse = `${URL_SERVEUR}/rest/v1/establishments?select=id,name,description,type,city,commune,suspended_at,listing_photos(url,position,offer_id,category)&status=eq.approved&order=created_at.desc&limit=2000`;
    const reponse = await fetch(adresse, { headers: { apikey: CLE_PUBLIQUE, Authorization: `Bearer ${CLE_PUBLIQUE}` } });
    assert.equal(reponse.status, 200);
    const lignes = await reponse.json();
    assert.ok(lignes.length >= 14);
    assert.deepEqual(Object.keys(lignes[0]), ['id', 'name', 'description', 'type', 'city', 'commune', 'suspended_at', 'listing_photos']);
    assert.ok(lignes.some((ligne) => ligne.listing_photos.length > 0));
    assert.deepEqual(Object.keys(lignes.find((ligne) => ligne.listing_photos.length > 0).listing_photos[0]), ['url', 'position', 'offer_id', 'category']);
  });

  // ----- Persistance -----

  await cas('persistance : après redémarrage, les données créées sont là et rien n\'est ressemé', async () => {
    await arreterServeur();
    const avant = consoleServeur.length;
    await lancerServeur();
    const depuis = consoleServeur.slice(avant);
    assert.doesNotMatch(depuis, /données de départ créés/, 'pas de nouvelles données de départ');
    assert.equal(reussi(await service.from('trip_plans').select('title, colonne_nouvelle').eq('id', repere.planTemoin).single()).title, 'Avec colonne nouvelle');
    assert.equal(reussi(await service.from('establishments').select('id')).length, 16);
    // Les sessions aussi survivent : le voyageur n'a pas à se reconnecter.
    assert.ok(reussi(await voyageur.supabase.from('bookings').select('id')).length >= 6);
    assert.equal((await client().auth.signInWithPassword({ email: 'voyageur@yakardc.test', password: MOT_DE_PASSE })).error, null);
  });
} finally {
  await arreterServeur();
  rmSync(dossierTemporaire, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

console.log('');
if (echecs.length > 0) {
  console.log(`${ETIQUETTE} ${total} cas, ${echecs.length} ECHEC(S) :`);
  for (const nom of echecs) console.log(`${ETIQUETTE}   - ${nom}`);
  if (!VERBEUX) console.log(`${ETIQUETTE} relancer avec « -- --verbeux » pour voir la console du serveur.`);
  process.exit(1);
}
console.log(`${ETIQUETTE} ${total} cas, 0 échec.`);
