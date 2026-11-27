# Diagnostic complet — YakaRDC

> Audit réalisé le 26 novembre 2026, en lecture seule (aucun fichier de code modifié, `.env` non ouvert).
> Périmètre : application Expo Router (SDK 56, React 19, React Native 0.85, react-native-web) + Supabase (migrations, edge functions), déployée en web sur Vercel (yakardc.com).
>
> **Limite importante :** seul le dépôt a été audité, pas la base de production. Quand une politique RLS est dite « absente », cela signifie « absente des migrations ». Plusieurs éléments (politiques de stockage, politiques de mise à jour des avis, colonnes) existent manifestement en production sans être versionnés : il faut les vérifier dans le tableau de bord Supabase (`select * from pg_policies where schemaname in ('public','storage');`).

---

## Sommaire

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Vérifications automatiques](#2-vérifications-automatiques)
3. [Sécurité](#3-sécurité)
4. [Pages et fonctionnalités](#4-pages-et-fonctionnalités)
5. [Bugs fonctionnels](#5-bugs-fonctionnels)
6. [Design et conformité au design system](#6-design-et-conformité-au-design-system)
7. [Accessibilité](#7-accessibilité)
8. [Responsive web](#8-responsive-web)
9. [SEO et web](#9-seo-et-web)
10. [Performance](#10-performance)
11. [UX et contenus](#11-ux-et-contenus)
12. [Dette technique et code mort](#12-dette-technique-et-code-mort)
13. [Fonctionnalités manquantes](#13-fonctionnalités-manquantes)
14. [Points forts](#14-points-forts)
15. [Plan d'action priorisé](#15-plan-daction-priorisé)

---

## 1. Résumé exécutif

Le parcours voyageur (accueil, recherche, fiche, réservation, billets) et les espaces Pro et Admin sont en place et le code est soigné et bien documenté. **Mais la base de données comporte des failles critiques qui rendent aujourd'hui les protections admin/pro inopérantes** : les règles RLS contrôlent les lignes, jamais les colonnes, et deux fonctions `SECURITY DEFINER` font confiance à un identifiant fourni par le client.

| Domaine | État | Constats majeurs |
|---|---|---|
| Sécurité | 🔴 Critique | Auto-promotion admin, auto-approbation partenaire, vol de données personnelles, relais de phishing par email |
| Fonctionnalités | 🟠 Partiel | Réservation non atomique, suspension admin sans effet, annulation voyageur qui échoue en silence, auth natif cassé |
| Design | 🟡 Correct | Palette conforme et contrastée, mais design system périmé, seconde palette cachée, faux gras |
| Accessibilité | 🟠 Faible | Aucun titre sémantique, libellés non reliés aux champs, zones tactiles < 44 px |
| SEO / Web | 🔴 Absent | Aucune balise title/meta/Open Graph, aucun lien `<a href>`, pas de favicon, robots, sitemap |
| Performance | 🟠 Moyen | Écran de chargement imposé ≥ 2,6 s, photos non redimensionnées, 1,1 Mo de polices TTF |
| Qualité / outillage | 🟠 Faible | Pas d'ESLint, pas de tests, pas de CI, commits tous nommés « maj », 30 vulnérabilités npm |

**Décompte :** 4 failles critiques, 5 élevées, 10 moyennes, 13 faibles côté sécurité ; une trentaine de bugs fonctionnels ; une cinquantaine de constats design/accessibilité/SEO/performance.

---

## 2. Vérifications automatiques

### 2.1 TypeScript (`npx tsc --noEmit`)

2 erreurs, toutes deux dans `src/`, un reste du template Expo **jamais importé** par l'application :

```
src/components/animated-icon.web.tsx(5,21): error TS2307: Cannot find module './animated-icon.module.css'
src/constants/theme.ts(6,8): error TS2882: Cannot find module or type declarations for side-effect import of '@/global.css'
```

→ Supprimer `src/` (et l'alias `@/*` de `tsconfig.json` s'il ne sert qu'à lui) fait passer `tsc` à zéro erreur. En revanche, de nombreux `as any` masquent des écarts entre `lib/types.ts` et le schéma réel (voir §12).

### 2.2 Lint

Le script `npm run lint` (`expo lint`) existe mais **aucune configuration ESLint ni dépendance** n'est installée. Aucun lint n'est donc exécuté.

### 2.3 Dépendances (`npm audit --omit=dev`)

**30 vulnérabilités : 1 critique, 15 élevées, 14 modérées.** Principales :

| Paquet | Sévérité | Problème |
|---|---|---|
| `shell-quote` ≤ 1.10.0 | Critique | Injection de commande via `quote()`, DoS sur `parse()` |
| `source-map-js` | Élevée | DoS de la boucle d'événements |
| `zod` < 4.6.6 | Élevée | Épuisement mémoire |
| `postcss` | Modérée | Traversée de chemin via `sourceMappingURL` |
| `uuid` < 11.1.1 | Modérée | Via `xcode` / `expo-splash-screen` (correctif cassant) |

Ces paquets sont essentiellement des dépendances d'outillage (Metro, build) et non du code exécuté dans le navigateur, d'où un risque réel modéré. → `npm audit fix` (sans `--force`) corrige la majorité sans rupture.

### 2.4 Secrets et historique git

- `.env*` est bien ignoré par `.gitignore`, et la clé `service_role` n'apparaît que côté serveur (edge functions).
- ⚠️ Le fichier `.env` **a été commité dans l'historique** (commits `3e19388` et `7399bc7`). Il ne contenait que `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` et `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, des clés **publiques par conception** (déjà embarquées dans le bundle web). Risque faible, mais cela signifie que toute la sécurité repose sur la RLS — d'où la gravité des failles ci-dessous.
- L'historique ne contient que des commits « maj » : impossible de retracer quand une régression a été introduite.

---

## 3. Sécurité

> Rappels Postgres utilisés dans cette section :
> - une fonction créée sans `revoke` est exécutable par `PUBLIC`, donc par `anon` et `authenticated` via `/rest/v1/rpc/…`. **Aucune migration ne contient de `revoke`** ;
> - une politique `FOR UPDATE USING (…)` sans `WITH CHECK` **ne restreint aucune colonne**.

### Synthèse

| # | Sévérité | Titre |
|---|---|---|
| C1 | 🔴 Critique | Auto-promotion admin via `profiles.role` |
| C2 | 🔴 Critique | RPC `approve_partner_request` appelable par n'importe qui |
| C3 | 🔴 Critique | Récupération de l'email et du téléphone de n'importe quel utilisateur |
| C4 | 🔴 Critique | Captation d'une demande de partenariat d'un tiers via `profiles.email` |
| E1 | 🟠 Élevée | Établissement publié sans modération, levée de sa propre suspension |
| E2 | 🟠 Élevée | `validate_ticket` : validateur falsifiable, appelable en anonyme, sans contrôle de statut |
| E3 | 🟠 Élevée | `notify-partner-request` : relais d'emails + injection HTML (phishing) |
| E4 | 🟠 Élevée | `request-password-reset` : énumération des comptes et bombardement d'emails |
| E5 | 🟠 Élevée | Réservation insérée directement en `confirmed` / `paid` |
| M1–M10 | 🟡 Moyenne | En-têtes HTTP, prix client, capacité, faux avis, `search_path`, stockage, mot de passe provisoire, fuites d'infos, migrations, identifiants exposés |
| F1–F13 | ⚪ Faible | Voir détail |

### 🔴 C1 — Auto-promotion admin

- **Où :** `supabase/migrations/0001_init.sql` L184-185.
  ```sql
  create policy "profiles_update_own" on profiles
    for update using (auth.uid() = id);
  ```
- **Attaque :** depuis la console du navigateur, n'importe quel compte connecté exécute
  `await supabase.from('profiles').update({ role: 'admin' }).eq('id', monId)`.
  Toutes les politiques `*_admin_all` et `is_admin()` s'appliquent alors : lecture/écriture de toutes les réservations (données personnelles), modération, apparence du site, etc. Le même trou permet de changer `profiles.email` (voir C4).
- **Correctif :**
  ```sql
  revoke update on public.profiles from anon, authenticated;
  grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

  create or replace function public.guard_profiles() returns trigger
  language plpgsql security definer set search_path = public as $$
  begin
    if current_user in ('anon','authenticated') and not public.is_admin()
       and (new.role is distinct from old.role
            or new.email is distinct from old.email
            or new.id is distinct from old.id) then
      raise exception 'Modification non autorisée';
    end if;
    return new;
  end $$;
  create trigger trg_guard_profiles before update on public.profiles
    for each row execute function public.guard_profiles();
  ```

### 🔴 C2 — `approve_partner_request` appelable par tous

- **Où :** `0012_approve_partner_request.sql` L32-113. Fonction `SECURITY DEFINER`, aucun contrôle de rôle ; `p_admin_id` est un simple paramètre.
- **Attaque :** un utilisateur dépose une demande de partenariat, relit son identifiant (`partner_requests_select_own`), puis appelle `rpc('approve_partner_request', { p_request_id, p_admin_id: <uuid quelconque> })`. Résultat : établissement créé en `approved`, rôle `partner` attribué, faux auteur dans le journal admin.
- **Correctif :**
  ```sql
  revoke execute on function public.approve_partner_request(uuid, uuid) from public, anon, authenticated;
  grant execute on function public.approve_partner_request(uuid, uuid) to service_role;
  ```
  L'edge function `approve-partner` utilise déjà la clé de service. Si un appel direct par un admin est souhaité : ajouter `if not public.is_admin() then raise exception ...` et utiliser `auth.uid()` au lieu de `p_admin_id`.

### 🔴 C3 — Vol de l'email et du téléphone de n'importe quel utilisateur

- **Où :** `0001_init.sql` L191-192 (création d'établissement ouverte), L232-233 (réservation), **L235-238** (`bookings_update_partner` sans restriction de colonnes), L175-182 (`profiles_select_for_partner_bookings`), L246-247 (avis publics exposant `traveler_id`).
- **Attaque (avec un simple compte voyageur) :**
  1. créer un établissement à son nom (même en `pending`, on en est propriétaire) ;
  2. y réserver pour soi-même ;
  3. `update bookings set traveler_id = '<uuid victime>' where id = <ma résa>` ;
  4. `select full_name, email, phone from profiles where id = '<uuid victime>'` est alors autorisé.

  Les UUID des victimes se récupèrent en masse via `reviews.traveler_id` (lecture publique). Le même `UPDATE` permet aussi de réécrire `qr_token`, `unique_code`, `used_at`, `payment_status`.
- **Correctif :**
  ```sql
  revoke update on public.bookings from authenticated;
  grant update (status, cancellation_reason) on public.bookings to authenticated;
  drop policy "bookings_update_partner" on bookings;
  create policy "bookings_update_partner" on bookings for update
    using (exists (select 1 from establishments e where e.id = establishment_id and e.owner_id = auth.uid()))
    with check (exists (select 1 from establishments e where e.id = establishment_id and e.owner_id = auth.uid())
                and status in ('confirmed','rejected','cancelled'));
  ```
  Et limiter la création d'établissements aux rôles `partner`/`admin` (voir E1).

### 🔴 C4 — Captation d'une demande de partenariat

- **Où :** `supabase/functions/approve-partner/index.ts` L257-268 et `0012` L59-65 : si la demande n'a pas de `user_id` (cas nominal d'une demande anonyme depuis `become-partner.tsx`), le propriétaire est cherché **par `profiles.email`**, que l'utilisateur peut modifier (C1).
- **Attaque :** un restaurateur dépose une demande avec `resto@exemple.cd`. Un attaquant inscrit fait `update profiles set email='resto@exemple.cd'`. À l'approbation, l'établissement et le rôle `partner` lui sont attribués : il reçoit les réservations et les données des voyageurs.
- **Correctif :** corriger C1 ; supprimer le repli par email (ou le faire sur `auth.users.email` avec `email_confirmed_at is not null`) ; si un compte existant ne correspond pas à `request.user_id`, refuser l'approbation automatique.

### 🟠 E1 — Établissement publié sans modération

- **Où :** `0001_init.sql` L191-192 (`with check (owner_id = auth.uid())`, sans contrôle de `status`) et L194-195 (`establishments_update_owner` : toutes colonnes modifiables).
- **Risque :** n'importe quel compte peut insérer un établissement directement en `approved` (fausses annonces, arnaques par téléphone). Un propriétaire suspendu peut faire `set status='approved', suspended_at=null`, changer `owner_id` ou gonfler `view_count`.
- **Correctif :** trigger `before insert or update` qui force `status := 'pending'` à l'insertion et fige `status`, `owner_id`, `suspended_at`, `suspension_reason`, `view_count` pour les non-admins ; restreindre l'insertion aux rôles `partner`/`admin`.

### 🟠 E2 — `validate_ticket` falsifiable

- **Où :** `0006_validate_ticket_case.sql` L11-50 ; appel client `app/pro/scan.tsx` L55-58.
- **Problèmes :**
  - la fonction vérifie que `p_validator` possède l'établissement, **pas que l'appelant est `p_validator`**. `owner_id` étant public, n'importe qui (même anonyme) peut « valider » le ticket d'un autre → le client se voit refuser l'entrée (« ticket déjà utilisé ») ;
  - messages d'erreur distincts (« Code introuvable » / « n'appartient pas… ») = oracle d'existence des codes, sans limite de débit ; le code court ne fait que 28 bits (`YK-` + 7 hexa) ;
  - **aucun contrôle de statut** : un billet `pending`, `rejected` ou `cancelled` est validable ;
  - pas de `set search_path`.
- **Correctif :** nouvelle signature `validate_ticket(p_code text)` utilisant `auth.uid()`, jointure sur `establishments.owner_id = auth.uid()`, message d'erreur unique, `status = 'confirmed'` exigé, `set search_path = public`, `revoke ... from public, anon`. Adapter `scan.tsx`.

### 🟠 E3 — Relais d'emails et injection HTML

- **Où :** `supabase/functions/notify-partner-request/index.ts` L48-84 (valeurs `contact_name`, `establishment_name`, `contact_phone` interpolées sans échappement), L135-144 (destinataire = `contact_email` de la demande), CORS `*` ; insertion dans `partner_requests` ouverte à tous (`0020` L270-272). Même injection dans `approve-partner/index.ts` L65-141 et `_shared/email.ts` L38, L50.
- **Attaque :** un anonyme insère une demande avec `contact_email = victime@…` et `establishment_name = '<a href="https://phish">Vérifier votre compte</a>'`, puis appelle la fonction. Un email au contenu contrôlé part depuis le domaine YakaRDC, sans limite (chaque nouvelle demande = un nouvel email). Conséquences : phishing crédible, spam, réputation du domaine d'envoi détruite, quota Resend épuisé.
- **Correctif :** échapper toutes les valeurs (`&<>"'`), captcha (Turnstile/hCaptcha) à l'insertion, limite de débit par IP et par adresse, contraintes de longueur `check (char_length(...) < N)`, CORS restreint à `https://www.yakardc.com`.

### 🟠 E4 — Réinitialisation de mot de passe : énumération et bombardement

- **Où :** `supabase/functions/request-password-reset/index.ts` L89-92 (compte inexistant → `{ sent: true }`) contre L100 (compte existant → `{ sent: true, email_error: … }`).
- **Risque :** la présence de la clé `email_error` (même `null`) **révèle si le compte existe**, contrairement à ce qu'affirme le commentaire L10-12 ; le temps de réponse aussi. `auth.admin.generateLink` contourne les limites intégrées de Supabase : envoi illimité d'emails à une victime.
- **Correctif :** toujours répondre exactement `{ sent: true }` avec un délai constant (envoi en tâche de fond), limite de débit (ex. 3/heure par adresse et par IP), captcha, ne jamais renvoyer `email_error`.

### 🟠 E5 — Réservation insérée avec un statut arbitraire

- **Où :** `0001_init.sql` L232-233 (seul `traveler_id = auth.uid()` est vérifié).
- **Risque :** un voyageur peut insérer `status: 'confirmed'`/`'checked_in'`, `payment_status: 'paid'`, un `unique_code` choisi, et réserver sur un établissement non approuvé. Statistiques et chiffre d'affaires faussés.
- **Correctif :** trigger `before insert` qui force `status='pending'`, `payment_status='unpaid'`, vide les champs de validation et vérifie `establishments.status = 'approved'` ; idéalement une RPC `create_booking(...)` transactionnelle.

### 🟡 Sévérité moyenne

| # | Titre | Où | Risque | Correctif |
|---|---|---|---|---|
| M1 | Aucun en-tête de sécurité HTTP ; session web en `localStorage` | `vercel.json` (aucune clé `headers`), `lib/supabase.ts` L34 | Sans CSP, une XSS vole les jetons ; sans `X-Frame-Options`, clickjacking possible sur la console admin | Ajouter HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP (à ajuster après test du bundle) |
| M2 | Prix et offre fournis par le client dans `booking_items` | `0008_booking_items.sql` L56-60, `app/listing/[id].tsx` L663-665 | `unit_price: 0` accepté, `offer_id` d'un autre établissement accepté (blocage de la capacité d'un concurrent) | Trigger qui impose prix/devise depuis `establishment_offers` et vérifie l'établissement |
| M3 | Capacité contournable et sujette aux accès concurrents | `0009_offer_availability.sql` L96-161 | Surréservation en cas de requêtes simultanées ; réservation sans items jamais contrôlée | `select … for update` / `pg_advisory_xact_lock` ; RPC atomique ; contrôle aussi au changement de statut |
| M4 | Avis publiables sans réservation, en nombre illimité | `0001_init.sql` L249-250 | Faux avis, dénigrement, note manipulée | Exiger une réservation `checked_in` liée, `unique (booking_id)` |
| M5 | `SECURITY DEFINER` sans `set search_path` | `validate_ticket` (0001, 0006), `increment_establishment_views` (0020 L72-76) | Détournement de résolution d'objets | `alter function … set search_path = public` |
| M6 | Stockage : bucket unique public, aucune politique versionnée, aucun contrôle type/taille | `lib/photo-upload.ts` L30-37 (`upsert: true`), avatars dans `establishment-photos`, `app-assets/` | Écrasement des images d'un concurrent ou de l'apparence du site ; hébergement de HTML/SVG arbitraire | `allowed_mime_types`, `file_size_limit`, politiques par préfixe (`avatars/<uid>/`, `app-assets/` admin) en migration, buckets séparés |
| M7 | Mot de passe provisoire envoyé en clair, changement forcé côté client seulement | `approve-partner/index.ts` L80-90, `(auth)/login.tsx` L63-66, `pro/_layout.tsx` | Mot de passe qui dort dans la boîte mail ; obligation contournable (relance de l'app, ou `updateUser({ data: { must_change_password: false } })`) | Lien d'invitation à usage unique (`generateLink({ type: 'invite' })`) ; drapeau dans `app_metadata` vérifié dans les layouts |
| M8 | Fuites d'informations dans les réponses des edge functions | `approve-partner` L160-174, L395-400 ; `notify-partner-request` L117-125, L159-162 ; `request-password-reset` L68-71 | Noms des variables d'env, type des clés, piles d'appels renvoyés à des anonymes | Réponses génériques, détails uniquement dans les logs serveur |
| M9 | Migrations incohérentes et non rejouables | voir §12.3 | La sécurité réelle de production n'est pas connue du dépôt ; une base reconstruite n'aurait pas les mêmes protections (ex. `partner_requests_insert_public with check (true)` sans le trigger de nettoyage) | `supabase db pull`/`db diff` pour versionner l'état réel |
| M10 | Identifiants internes publics (`owner_id`, `traveler_id`) | `0001` L188-189, L246-247 | Point d'entrée de C3 et E2 | Vue publique sans ces colonnes (`security_invoker = true`) ou `GRANT` par colonne |

### ⚪ Sévérité faible

- **F1 —** `increment_establishment_views` ouverte à tous et appelée à chaque chargement (`listing/[id].tsx` L215) : compteur gonflable à volonté, y compris sur fiches non approuvées.
- **F2 —** Vue `establishment_ratings` sans `security_invoker` (`0020` L205-213) : contourne la RLS et révèle les identifiants des fiches en attente/suspendues.
- **F3 —** Fonctions de charge (`establishment_daily_load`, `establishment_offer_load`, …) exécutables par `anon` sur tout établissement, publié ou non (`0003` L86-87, `0009` L82-83).
- **F4 —** Inscription : message « Un compte existe déjà avec cet email » (`register.tsx` L91-93, L112-116) = énumération ; minimum 6 caractères contre 8 ailleurs.
- **F5 —** `safeRedirect` (`login.tsx` L20-24) accepte `/\evil.tld` ; le paramètre `reason` affiche un texte arbitraire issu de l'URL (usurpation de contenu, pas de XSS).
- **F6 —** `/reset-password` accepte n'importe quelle session sans vérifier l'événement `PASSWORD_RECOVERY` (`reset-password.tsx` L41-48).
- **F7 —** Le client envoie lui-même `role` à la création du profil (`lib/auth-context.tsx` L39-51) : sans danger aujourd'hui, piège pour l'avenir.
- **F8 —** Routes admin/pro protégées côté client uniquement (`admin/_layout.tsx`, `pro/_layout.tsx`) : normal pour une SPA, mais la RLS est aujourd'hui insuffisante.
- **F9 —** Données personnelles (emails) dans les logs des edge functions et `console.log` d'objets d'erreur complets côté client.
- **F10 —** Une demande déposée par un admin pour un tiers est rattachée à l'admin par le trigger `sanitize_partner_request` (`0015` L51-53), contrairement à l'intention de `become-partner.tsx` L150-154.
- **F11 —** `handle_new_user` (`0018` L61) copie un téléphone non vérifié depuis `raw_user_meta_data` avec contrainte d'unicité : un attaquant peut bloquer l'inscription d'une victime.
- **F12 —** CORS `*` sur les trois edge functions.
- **F13 —** Code court de billet à 28 bits seulement (`0001` L106).
- **Info —** `config.toml` ne déclare que `approve-partner` ; `notify-partner-request` et `request-password-reset` sont donc en `verify_jwt = true` par défaut, ce qui contredit leurs commentaires : soit elles ne marchent pas, soit elles ont été déployées avec `--no-verify-jwt` hors configuration versionnée.
- **Info —** Aucune limite de débit nulle part (edge functions, `partner_requests`, `reviews`, `bookings`, RPC).

---

## 4. Pages et fonctionnalités

| Route | Rôle | État |
|---|---|---|
| `app/index.tsx` | Redirection selon le rôle | ✅ Fonctionnelle (ne vérifie pas `must_change_password`) |
| `welcome` | Écran d'accueil | ✅ Fonctionnelle |
| `callback` | Retour OAuth | 🟠 Partielle : web uniquement |
| `(auth)/login` | Connexion email + Google | 🟠 Partielle : Google cassé sur natif (`window.location`) |
| `(auth)/register` | Inscription | ✅ Fonctionnelle |
| `(auth)/verify` | Code OTP | ⚪ Orpheline : aucun écran n'y mène |
| `forgot-password` | Demande de réinitialisation | ✅ Fonctionnelle |
| `reset-password` | Nouveau mot de passe | 🟠 Partielle : web uniquement |
| `change-password` | Changement de mot de passe | ✅ Fonctionnelle |
| `become-partner` | Demande de partenariat | ✅ Fonctionnelle, avec bugs |
| `(tabs)/index` | Accueil | ✅ Fonctionnelle, avec bugs |
| `(tabs)/search` | Recherche | 🟠 Partielle : filtre de prix faux, pas de pagination |
| `(tabs)/culture` | Culture | ⚪ Placeholder (2 scènes animées) |
| `(tabs)/bookings` | Mes réservations | 🔴 L'annulation échoue en silence (aucune politique RLS) |
| `(tabs)/profile` | Profil | 🟠 Partielle : 3 entrées « bientôt disponible » |
| `(tabs)/planner` | Planificateur | ⚪ Masqué par un drapeau, mais accessible par URL |
| `listing/[id]` | Fiche + réservation | 🟠 Fonctionnelle, bugs graves (atomicité, prix, calendrier) |
| `notifications` | Notifications | ⚪ Factice (dérivée des réservations) |
| `favorites` | Favoris | 🟠 Plantage possible |
| `edit-profile` | Modifier le profil | 🟠 Affiche « Enregistré » même en cas d'échec |
| `pro/index` | Tableau de bord partenaire | ✅ Fonctionnelle |
| `pro/bookings` | Réservations reçues | ✅ Fonctionnelle, sans gestion d'erreur |
| `pro/scan` | Validation des billets | ✅ Fonctionnelle (mais voir E2) |
| `pro/establishment` | Fiche établissement, offres, menu | ✅ Fonctionnelle |
| `pro/more` | Statistiques et réglages | 🟠 Partielle : 3 placeholders |
| `pro/pro-reviews` | Réponses aux avis | ✅ Fonctionnelle |
| `admin/index` | Vue d'ensemble | ✅ Fonctionnelle (champ de recherche factice) |
| `admin/establishments` | Modération | 🔴 La suspension n'a aucun effet public |
| `admin/stats` | Statistiques | 🟠 Tronquées au-delà de 1000 lignes |
| `admin/users` | Utilisateurs | 🟠 Bouton « Suspendre » factice |
| `admin/partner-requests` | Demandes de partenariat | ✅ Fonctionnelle |
| `admin/history` | Journal d'activité | ✅ Fonctionnelle (libellés incomplets) |
| `admin/reviews` | Modération des avis | ✅ Fonctionnelle |
| `admin/cities` | Villes et catégories | ✅ Fonctionnelle, sans gestion d'erreur |
| `admin/appearance` | Images de l'application | ✅ Fonctionnelle |
| `admin/admin-appearance` | — | ⚪ Doublon mort mais route accessible |
| *(404)* | — | 🔴 Absente : pas de `app/+not-found.tsx` |

---

## 5. Bugs fonctionnels

### 🔴 Critique

- **La suspension admin ne cache rien aux voyageurs.** `admin/establishments.tsx` L164 écrit `suspended_at`, mais aucune requête publique ne filtre dessus (`(tabs)/index.tsx` L220-222, `(tabs)/search.tsx` L107-109, `listing/[id].tsx` L187 et L326) et la politique de lecture publique ne regarde que `status`. L'établissement suspendu reste visible **et réservable**. → Ajouter `suspended_at is null` dans la politique RLS de lecture publique.
- **L'annulation d'une réservation par le voyageur échoue en silence.** `(tabs)/bookings.tsx` L277-283 : aucune politique RLS ne l'autorise, aucune erreur n'est vérifiée, aucune confirmation n'est demandée.

### 🟠 Élevée

- **Réservation non atomique.** `listing/[id].tsx` L651-683 insère la réservation puis ses items ; si les items échouent, le `delete` de nettoyage (L674) est refusé par la RLS sans bruit. La réservation orpheline consomme de la capacité. → RPC `create_booking` transactionnelle.
- **Surréservation possible** en cas de réservations simultanées (`check_offer_capacity` sans verrou, `0009` L96).
- **Prix des formules restaurant sous-évalué.** L'item est enregistré avec `quantity: 1` (`listing/[id].tsx` L780-781) alors que le récapitulatif affiche prix × couverts (`BookingForms.tsx` L380-384) : total stocké faux, capacité comptée par réservation et non par couvert.
- **Changement de mot de passe imposé contournable** : vérifié uniquement dans `(auth)/login.tsx` L63 ; relancer l'app suffit.
- **Authentification cassée sur mobile natif** : `login.tsx` L71-75 utilise `window.location` (inexistant en React Native) ; `callback.tsx` ne fait jamais l'échange PKCE sur natif ; `reset-password.tsx` ne reçoit pas de session sur natif.
- **Chargement du profil bloquant.** `lib/auth-context.tsx` L25-55 : sans `try/catch`, une exception laisse `loading` à `true` indéfiniment ; course entre session et profil (L77-81).
- **Favoris qui plantent** : `favorites.tsx` L109, un établissement devenu invisible revient `null` et `e.id` lève une exception.

### 🟡 Moyenne

- **Calendrier de la fiche :** `fullDays` jamais alimenté (`listing/[id].tsx` L117), donc les jours complets ne sont pas grisés ; `slotLoads` chargé mais jamais utilisé (L118, L258-271) ; les créneaux déjà passés du jour restent proposés (`lib/opening-hours.ts`).
- **Dates en UTC au lieu de l'heure de Kinshasa** : `listing/[id].tsx` L230-251 et L308-319, `pro/index.tsx` L63-70, `OfferManager.tsx` L184.
- **Nombre de nuits faux au changement d'heure** (`listing/[id].tsx` L739-749) : prix faux pour la diaspora en Europe.
- **Hôtel :** la date de départ grise des jours complets alors que la nuit de départ n'est pas occupée (`BookingForms.tsx` L164).
- **Faux succès / erreurs ignorées :** `edit-profile.tsx` L24-30 ; `pro/bookings.tsx` L81-96 ; `pro/index.tsx` L144 ; `pro-reviews` ; `admin/cities.tsx` L57-77 ; `pro/establishment.tsx` L271-275 (photo orpheline dans le stockage) ; `OfferManager.tsx` L300-311 (ancien fichier supprimé même si la mise à jour échoue) ; `admin/appearance.tsx` L68-73 (fichier supprimé avant l'écriture en base).
- **Recherche :** filtre de prix en $ qui ignore la devise et s'applique après `limit(50)` (`search.tsx` L145-159) ; filtre par commune sensible à la casse (L113).
- **Accueil :** courses entre requêtes et squelette de chargement infini si aucune ville n'est active (`(tabs)/index.tsx` L215-244).
- **Avatar :** rangé dans le bucket des établissements, anciens fichiers jamais supprimés, erreur ignorée (`profile.tsx` L112-149).
- **Promotion :** `discount_percent` non borné (négatif ou > 100 % accepté, `pro/establishment.tsx` L376), jamais affichée ni appliquée côté voyageur ; texte d'aide (L773) qui renvoie au planificateur désactivé.
- **Devise :** `pro/establishment.tsx` L569 affiche `${price}$` quelle que soit la devise.
- **Promesse non tenue :** `OfferManager.tsx` L226 annonce « les voyageurs en seront informés » alors qu'aucune notification n'existe.
- **Admin :** stats tronquées à 1000 lignes (`admin/stats.tsx` L52-53) ; recherche utilisateurs qui casse sur une virgule ou une parenthèse (`.or()` construit depuis la saisie, `admin/users.tsx` L31) ; un admin peut se retirer son propre rôle (L49-68).

### ⚪ Faible

- Indice « YK-4F9X2A » dans `pro/scan` (6 caractères alors que le code en a 7).
- « Retour à l'accueil » de `become-partner` mène à la connexion.
- Champ de recherche factice (`admin/index.tsx` L99-102) ; « + N autres avis » non cliquable (`listing/[id].tsx` L1171) ; liens CGU/confidentialité non cliquables (`register.tsx` L286-288).
- Journal admin : `review_deleted`, `establishment_warned`, `establishment_suspended`, `establishment_reactivated` affichés en code brut (`admin/history.tsx` L9-30).
- Badge de demandes en attente chargé une seule fois (`admin/_layout.tsx` L53-60).
- `BottomSheet.tsx` L21-22 : appuyer dans la feuille hors des options la ferme.
- `admin/establishments.tsx` : en cliquant vite, les stats du précédent établissement peuvent écraser le nouveau.
- `.ilike` sans échappement de `%`/`_` ; `MediaTypeOptions` déprécié ; `fetch(uri).blob()` peut produire des fichiers vides sur RN.

---

## 6. Design et conformité au design system

### 6.1 Le document `design-system-yakardc.md` est périmé

- 🟠 **Contradiction sur `danger`** : le document fixe `#A23B2B` (L50-58), le code utilise `#C0392B` (`lib/theme.ts` L56-59).
- 🟡 « Cinq paliers de rayon, aucun autre » (L122-131) alors que `theme.ts` ajoute `v4` et `v16`, et que les feuilles utilisent `24`.
- 🟡 Inventaire dépassé : `Calendar` cité mais remplacé par `SelecteurDate` ; `Button` marqué « À FAIRE » alors qu'il existe et sert dans 7 fichiers ; `SectionIcons` « à supprimer » déjà supprimé ; « 15 composants » alors que `components/` en contient 31 ; compte de `fontSize` littéraux et emojis de la fiche obsolètes.
- 🟡 Le document interdit les apparitions en cascade (L230) mais `lib/motion.ts` L132-161 (`useEntreeListe`, utilisé dans `search.tsx`) et `culture.tsx` L40-76 (`FadeInDown` jusqu'à 2,2 s) en font.

### 6.2 Couleurs codées en dur

- 🟡 **Seconde palette cachée** dans `(tabs)/culture.tsx` et `components/SplashLoader.tsx` : `#702B12` (quasi-copie de `lave` `#712B13`), `#FFF8EE` (au lieu de `cream`), `#F0A042`, `#D85A30`, `#4A1C0C`, `#5A4A40`, `#EBCDB4`.
- ⚪ `shadowColor: '#000'` (interdit par le §10) : `welcome.tsx` L101, `profile.tsx` L416, `pro/index.tsx` L403/454/470, `pro-reviews.tsx` L134.
- ⚪ Voile de modale en **4 variantes** (`rgba(0,0,0,0.4)`, `0.45`, `0.5`, `rgba(26,10,3,0.45)`) → jeton `overlay`.
- ⚪ Crème atténué réécrit ~15 fois en `rgba(250,248,244,0.7…0.85)` → jeton `onBrandMuted` ; `#FFB4A8` pour les erreurs du login → jeton `dangerOnDark` ; `rgba(192,57,43,0.9)` = `danger` en littéral.

### 6.3 Typographie

Manrope et Playfair Display sont correctement chargées (`app/_layout.tsx` L80-89).

- 🟡 **Faux gras** : une quarantaine de `fontWeight` sur une police personnalisée (`BottomSheet.tsx` L52, `SectionHeading.tsx` L60, `ListingCard.tsx` L145, `BookingForms.tsx` à 7 endroits, `SelecteurDate.tsx` L251, `admin/_layout.tsx` L216…). Avec expo-font, chaque graisse est une famille distincte : il faut `fonts.sansSemiBold`/`fonts.sansBold`, sinon gras synthétique sur le web.
- 🟡 `typography.badgeSm` à 9,5 px (`theme.ts` L245) malgré la règle « rien sous 11 px » (L270-273) ; libellés d'onglets à 10,5 px.
- ⚪ Noms de police en dur au lieu de `fonts.*` (`(tabs)/_layout.tsx`, `pro/index.tsx`, `admin/_layout.tsx`, `become-partner.tsx`) ; textes sans `fontFamily` (`culture.tsx` L153-169, `callback.tsx` L49) ; `ListingCard.tsx` L128 étale deux styles dont le second écrase le premier.

### 6.4 Espacements et rayons

- ⚪ Gouttière écrite `spacing.md + 2` ou `18` au lieu de `spacing.gutter` dans une quinzaine d'endroits (`index.tsx`, `search.tsx`, `bookings.tsx`, `admin/_layout.tsx`, `pro/*`).
- ⚪ Valeurs hors échelle calculées (`spacing.md + 4`, `spacing.xs + 2`…), rayons hors échelle (26 dans `profile.tsx`, `radii.lg` sur le bouton de `verify.tsx`).

### 6.5 Doublons de composants

- 🟡 **Deux fichiers de thème** : `src/constants/theme.ts` (gabarit Expo, palette noir/blanc, `MaxContentWidth = 800`, police `Spline Sans`) contre `lib/theme.ts`. Tout `src/` est mort.
- 🟡 `FormField` en 3 exemplaires (`components/FormField.tsx`, `become-partner.tsx` L28, `pro/establishment.tsx` L69).
- 🟡 Boutons primaires locaux malgré `Button` (login, verify, become-partner, edit-profile, establishment, EmptyState, DateField, culture), avec des rayons variés.
- ⚪ `StatCard` réimplémenté 6 fois ; liste d'options réécrite 3 fois (`BottomSheet`, `TimeField`, `PhoneField`) ; `BottomSheet` sans bouton Fermer contrairement à `Sheet`.
- ⚪ Deux dessins de marque (`LogoYaka` vs soleil à trois disques du splash/culture) ; deux noms (`app.json` : « Yaka », interface : « YakaRDC »).

### 6.6 Anti-patterns encore présents

- 🟡 Emojis fonctionnels : `pro/scan.tsx` L195-215 (✅ ⚠️ ⛔ ❌), `admin/index.tsx` (📅 🏢 🆕), `pro/index.tsx` (👋), placeholders du login (✉ 🔒, lus par les lecteurs d'écran), 💡 📷 📈 ailleurs.
- ⚪ Icônes dans un carré coloré : `profile.tsx`, `favorites.tsx`, `bookings.tsx`, `pro/index.tsx`, `listing/[id].tsx`.

### 6.7 Mode sombre

Non supporté, et c'est assumé (`app.json` : `"userInterfaceStyle": "light"`). Il manque toutefois `<meta name="color-scheme" content="light">` pour éviter le mode sombre forcé de Chrome Android.

---

## 7. Accessibilité

### 7.1 Sémantique

- 🟠 **Aucun `accessibilityRole="header"`** dans tout le projet : pas de `h1`/`h2` sur le web, aucune structure pour les lecteurs d'écran ni pour le SEO.
- 🟠 **Composants partagés sans rôle ni état** : `Button` (pas de rôle, `disabled`/`busy` non exposés), `Chip` (état sélectionné invisible), `ListingCard`, `EmptyState`, `SectionHeading`, `DateField`, `TimeField`, `PhoneField`, options de `BottomSheet`. Sur ~201 éléments pressables, seuls 69 ont un rôle et 2 fichiers utilisent `accessibilityState`.
- 🟡 Boutons icône sans libellé : cœur des favoris (de plus imbriqué dans un autre Pressable), points de pagination, avatar modifiable, photos cliquables, tuiles de catégorie.
- 🟡 Liens faits avec `<Text onPress>` (`login.tsx` L166-168, `listing/[id].tsx` L1018-1033) ; aucun `Link` d'expo-router.
- 🟡 Navigation admin sans état sélectionné ; tiroir mobile sans piège de focus ni fermeture par Échap.

### 7.2 Formulaires

- 🟠 **Libellés non reliés aux champs** (aucun `accessibilityLabel` sur les `TextInput`) : `FormField.tsx` L23-29, `register.tsx`, `edit-profile.tsx`, `search.tsx`, et `login.tsx` où seul le placeholder porte le sens.
- 🟡 Erreurs non annoncées (aucun `accessibilityLiveRegion` ni `role="alert"`).
- ⚪ `autoComplete` absent du login et de l'inscription : les gestionnaires de mots de passe fonctionnent mal.

### 7.3 Zones tactiles < 44 px

| Élément | Taille | Fichier |
|---|---|---|
| Retour / partager / favori de la fiche | 32 px | `listing/[id].tsx` L1412-1422 |
| Points de pagination | 6 px | `listing/[id].tsx` L1400 |
| Boutons +/− | 26 px | `BookingForms.tsx` L592 |
| « Annuler » une réservation | ~24 px | `bookings.tsx` L455-461 |
| Supprimer un avis | 28 px | `admin/reviews.tsx` L130 |
| Cœur des favoris | 18 px | `favorites.tsx` L121 |
| Cloche, paramètres, menu admin, X des feuilles | 20–34 px | `index.tsx`, `profile.tsx`, `admin/_layout.tsx`, `Sheet.tsx` |

Bon exemple à suivre : `ScreenHeader.tsx` L186-193 porte sa cible à 44 px.

### 7.4 Contrastes WCAG (calculés)

| Texte / fond | Usage | Ratio | AA (4,5:1) |
|---|---|---|---|
| `ink` / `cream` | Corps de texte | 13,19 | ✅ |
| `muted` / `cream` | Descriptions | 6,12 | ✅ |
| `faint` / `cream` | Onglets inactifs, légendes | 4,73 | ✅ |
| **`faint` / `surfaceSunken`** | Badge « Annulée » 11 px | **4,30** | ❌ |
| `lave` / `cream` | Bouton primaire, en-tête | 9,62 | ✅ |
| `fleuve` / `fleuveSoft` | « Client vérifié » | 5,46 | ✅ |
| `or` / `white` | Note | 6,73 | ✅ |
| `danger` / `dangerSoft` | « Refusée » | 4,66 | ✅ (juste) |
| `laveDeep` / `amber` | Bouton de connexion | 9,28 | ✅ |
| **`border` / `white`** | Contour des champs (seuil 3:1) | **1,29** | ❌ (WCAG 1.4.11) |

- 🟡 Contours de champs quasi invisibles → utiliser `borderStrong` ou plus sombre.
- 🟡 Texte crème du login posé sur une photo choisie par l'admin avec seulement 10 % de voile : contraste non garanti → ajouter un `PhotoScrim`.

### 7.5 Mouvement

- 🟡 Carrousel de l'accueil qui défile toutes les 4 s sans pause ni respect de « réduire les animations » (`index.tsx` L78-87, WCAG 2.2.2).
- 🟡 `culture.tsx` et `SplashLoader.tsx` ignorent `useMouvementReduit` pourtant fourni par `lib/motion.ts`.
- ⚪ Aucun style de focus clavier défini pour le web (à vérifier en navigateur).

---

## 8. Responsive web

- 🟡 **La barre d'onglets reste en bas sur desktop**, simplement recentrée sur 460 px (`(tabs)/_layout.tsx` L30-53, `pro/_layout.tsx` L35-40) : c'est le « mobile étiré » que le design system interdit.
- ⚪ Écrans admin collés à gauche sur grand écran (largeurs littérales non centrées dans `users`, `stats`, `reviews`, `history`, `appearance`, `cities`).
- ⚪ Marges hautes codées en dur (`Platform.OS === 'ios' ? 56 : 20`) au lieu des zones sûres : encoches Android ignorées (`search.tsx`, `bookings.tsx`, `index.tsx`, `listing/[id].tsx`, `profile.tsx`, `admin/_layout.tsx`).
- ⚪ Hero de la fiche à 220 px de haut même sur un écran de 1200 px (recadrage très panoramique).
- ✅ Bon point : `useResponsive` bien adopté sur les écrans voyageurs (grille 2 → 4 colonnes, colonne prix `sticky` sur desktop).

---

## 9. SEO et web

- 🔴 **Aucune balise `title`, meta description, Open Graph, Twitter ni canonical** (`expo-router/head` jamais utilisé). Un partage de fiche sur WhatsApp/Facebook n'affiche aucun aperçu.
- 🔴 **Aucune section `web` dans `app.json`** : rendu en page unique (SPA). Conséquence : `app/+html.tsx` est **inerte en production** (son `lang`, son CSS ne s'appliquent pas — d'où le script `fix-html-lang.mjs`), et tout le contenu dépend du JavaScript. → `web.output: "static"` + `generateStaticParams` pour les fiches, ou au minimum `<Head>` par page.
- 🔴 **Aucun lien `<a href>`** : toute la navigation passe par `router.push`. Les fiches ne sont pas explorables par les moteurs ; clic du milieu et « ouvrir dans un onglet » ne fonctionnent pas. → Envelopper `ListingCard` et les liens dans `<Link href asChild>`.
- 🟡 Aucun favicon ni icône configuré : `assets/images/favicon.png` et `icon.png` ne sont référencés nulle part.
- 🟡 Pas de dossier `public/` : ni `robots.txt`, ni `sitemap.xml`, ni manifest, ni `theme-color`.
- 🟡 `vercel.json` réécrit tout vers `index.html` sans `+not-found.tsx` : une URL inconnue renvoie 200 (faux 404 pour Google) et l'écran par défaut d'Expo Router, en anglais.
- 🟡 `app.json` : `"name": "Yaka"` alors que la marque est « YakaRDC ».

---

## 10. Performance

- 🟠 **Écran de chargement imposé** : `SplashLoader.tsx` L60, L104-111 impose au moins 2,6 s + 0,85 s de fondu à chaque chargement, même si tout est prêt (≥ 3,4 s avant le premier contenu sur le web). Il laisse en plus cliquer l'interface masquée (`pointerEvents="none"`) et ignore « réduire les animations ».
- 🟠 **Photos servies en taille d'origine** : minimum 1000 px, aucun maximum, `quality: 0.7` puis `getPublicUrl` (`lib/images.ts` L19, `lib/photo-upload.ts` L20-24). Des vignettes de 190 px téléchargent des originaux de plusieurs mégapixels, sur des réseaux mobiles congolais. → Transformation d'image Supabase (`?width=`) ou redimensionnement à l'envoi.
- 🟡 **Reanimated importé** par `SplashLoader.tsx` et `culture.tsx`, alors que `lib/motion.ts` L11-20 documente l'avoir écarté pour +700 Ko.
- 🟡 **~1,1 Mo de polices TTF** bloquantes ; Playfair 600 ne sert qu'une fois. → WOFF2, sous-ensembles, moins de graisses.
- 🟡 **Vue `establishment_ratings` téléchargée entièrement** à chaque changement de catégorie (`index.tsx` L226) et à chaque frappe en recherche (`search.tsx` L118). → Filtrer par `establishment_id`.
- ⚪ Composants déclarés dans le rendu (remontés à chaque rendu) : `AvailabilityMarker` (`index.tsx` L255), `NavList` (`admin/_layout.tsx` L76, perd le défilement).
- ⚪ Listes non virtualisées (`ScrollView` + `map`) : réservations, favoris, listes admin/pro, notifications ; aucune pagination.
- ⚪ Carrousel dont le `setInterval` tourne même onglet masqué.
- ⚪ **~1,5 Mo d'images inutilisées** dans `assets/images` (reliquats du gabarit : `icon.png` 780 Ko, `logo-glow.png` 324 Ko, `login-bg.jpg` 99 Ko, icônes Android, `react-logo*`, `expo-badge*`, `tutorial-web.png`, `tabIcons/`…). Non embarquées dans le bundle, mais elles encombrent le dépôt et masquent l'absence d'icône configurée.

---

## 11. UX et contenus

- 🟠 **Annulation de réservation sans confirmation**, sans vérification d'erreur ni retour (`bookings.tsx` L221-223, L277-283). → `useConfirm({ destructive: true })` + `ecrire()` de `lib/db.ts`.
- 🟠 **Erreurs réseau affichées comme des listes vides** : accueil (« Aucun établissement »), recherche (« Aucun résultat »), réservations, favoris, compteurs du profil. Hors ligne, l'utilisateur croit le catalogue vide. → État d'erreur avec « Réessayer », comme déjà fait dans `listing/[id].tsx` L518-531.
- 🟡 **Messages Supabase bruts, souvent en anglais**, montrés à l'utilisateur (`verify.tsx`, `listing/[id].tsx`, `admin/cities.tsx`, `admin/appearance.tsx`, `profile.tsx`, `OfferManager.tsx`, `lib/db.ts` qui ajoute « (code 42501) »). → Table de traduction (`register.tsx` a déjà `messageLisible`).
- 🟡 Deux systèmes de confirmation : `ConfirmDialog` (conforme) et `Alert.alert`, qui devient un `window.confirm` natif sur le web pour les suppressions admin.
- 🟡 Bouton « Suspendre » d'utilisateur factice affichant un message de développeur (« Edge Function avec service_role… », `admin/users.tsx` L72-79).
- 🟡 Visiteur non connecté sur le profil : voit « Utilisateur » et « Se déconnecter » (`profile.tsx` L90-91, L299).
- 🟡 **Pas de politique de confidentialité** ni de CGU (entrées « bientôt disponible »), alors que le site collecte noms, téléphones et emails.
- 🟡 Dates affichées au format ISO brut (`2026-11-26`) sur les cartes et billets (`bookings.tsx` L75-79, L174-178) alors que `formatFrench` existe.
- ⚪ Tutoiement (« découvre », « Entre le code reçu ») mêlé au vouvoiement ; erreur de `verify.tsx` en `lave` au lieu de `danger` ; `...` et `…` mélangés ; retrait de favori sans annulation possible.
- ⚪ Coquilles : `admin/appearance.tsx` L288 annonce un « fondu » alors que le carrousel glisse ; `lib/theme.ts` L32 « et  reste » (mot manquant) ; commentaire périmé dans `FormField.tsx` L14-19.

---

## 12. Dette technique et code mort

### 12.1 Restes du template Expo

- Dossier `src/` entier (11 fichiers + `global.css`), jamais importé, source des 2 erreurs `tsc`.
- `scripts/reset-project.js`, nom `"yaka-app-temp"` dans `package.json`, `README.md` générique du template.
- Images inutilisées (voir §10).

### 12.2 Code dupliqué ou orphelin

- Routes orphelines : `app/admin/admin-appearance.tsx` (doublon d'`appearance`), `app/(auth)/verify.tsx`.
- `pickImage`/`uploadToStorage` recopiés dans 5 écrans alors que `lib/photo-upload.ts` existe.
- `TypeIcon`/`TYPE_LABELS` dans 3 écrans admin alors que `CategoryIcon` existe ; `unitLabel` dupliqué (`search.tsx` vs `lib/listing-format.ts`).
- Fichiers trop gros : `listing/[id].tsx` (~1545 lignes), `pro/establishment.tsx` (~1116), `BookingForms.tsx` (573).
- Nombreux `as any` car `lib/types.ts` ne correspond pas au schéma → générer les types avec `supabase gen types typescript`.
- Table `rates` plus lue ; planificateur désactivé mais livré.

### 12.3 Migrations Supabase incohérentes

- **Colonnes utilisées mais jamais créées** par aucune migration : `bookings.children`, `bookings.metadata`, `establishments.capacity`, `commune`, `avenue`, `numero`, `reference`, `email`, `logo_url`, `suspended_at`, `view_count`, `discount_*`, `profiles.avatar_url`, `reviews.partner_reply`.
- **Ordre impossible** : `0011`, `0014`, `0015`, `0017`, `0019` modifient `partner_requests`, créée seulement en `0020` ; `0003` échoue (colonne `children` absente).
- `0018` est titrée « PROPOSITION — NE PAS EXÉCUTER » mais n'est pas commentée : `supabase db push` l'appliquerait.
- `0013` « périmée, NE PAS REJOUER » est toujours dans `migrations/`.
- Politiques nécessaires à l'app mais absentes du dépôt : lecture admin de `profiles`, `UPDATE` des avis, `storage.objects`, `DELETE` sur `bookings` et `favorites`, écriture des villes.

→ **Une base reconstruite depuis le dépôt ne fonctionnerait pas** et n'aurait pas les mêmes protections. Faire un `supabase db pull` pour versionner l'état réel.

### 12.4 Outillage

- Pas d'ESLint configuré, aucun test, aucune CI.
- Historique git uniquement en « maj » : impossible de relire ou d'annuler une modification précise.
- `app.json` incomplet : aucune icône, splash sans image, icône adaptative Android sans premier plan, aucun `plugins` (caméra, photos, secure-store → messages de permission en anglais), pas de section `web`, pas de `buildNumber`/`versionCode`.

---

## 13. Fonctionnalités manquantes

- **Suppression de compte** : introuvable, alors qu'elle est **obligatoire sur l'App Store et le Play Store**.
- **Politique de confidentialité et CGU** (obligation légale vu les données collectées).
- **Notifications** : pas de push (`expo-notifications` absent), pas de table dédiée, pas de lu/non lu. Le voyageur n'est pas prévenu quand le partenaire confirme, refuse ou annule.
- **Annulation** d'une réservation confirmée côté voyageur ; gestion des no-show côté partenaire ; expiration des réservations `pending` passées.
- **Paiement** : aucun.
- **Remises** : saisies par le partenaire mais jamais affichées ni appliquées.
- **Plusieurs établissements par partenaire** : impossible (`limit(1)` partout).
- **Suspension d'un compte utilisateur** par l'admin (placeholder) ; création/modification d'établissement par l'admin.
- **Avertissements admin** jamais visibles par le partenaire.
- **Placeholders** : écran Culture, Paramètres, Aide, Confidentialité, Langue.
- **Liens profonds** : schéma `yaka` déclaré mais aucun lien universel (`associatedDomains`, `intentFilters`) ; les liens envoyés par email ouvrent le site web, et les écrans natifs de retour ne fonctionnent pas.
- **Page 404** personnalisée.

---

## 14. Points forts

**Sécurité**
- Clé `service_role` strictement côté serveur ; le client n'utilise que la clé publiable.
- `approve-partner` vérifie correctement l'identité et le rôle admin de l'appelant.
- Mot de passe provisoire généré avec `crypto.getRandomValues` (~80 bits), jamais loggé.
- Liens de récupération construits côté serveur depuis `APP_URL` : pas d'open redirect.
- Trigger `sanitize_partner_request` qui corrige les champs sensibles plutôt que de refuser.
- RLS activée sur toutes les tables versionnées ; politiques correctes sur favoris, planificateur, journal admin, `app_settings`.
- Session mobile dans `expo-secure-store` ; PKCE sur le web ; mot de passe actuel exigé pour un changement ordinaire.
- Validation de billet verrouillée (`for update`) et à usage unique.

**Design et code**
- Palette « Terre & Fleuve » lisible : presque tous les couples texte/fond dépassent 4,5:1.
- Échelle typographique sémantique adoptée à grande échelle (> 500 usages de `typography.*`).
- Composants partagés de qualité : `ScreenHeader`, `SelecteurDate`, `ConfirmDialog`/`useConfirm`, `Skeleton`, `ListingCard`.
- Jetons de mouvement centralisés et argumentés (`lib/motion.ts`).
- Responsive réfléchi sur les écrans voyageurs.
- Code très bien commenté en français, décisions justifiées.
- Corrections web concrètes (langue `fr` forcée, `lib/alert.ts`).
- Squelettes de chargement et états vides contextualisés.

---

## 15. Plan d'action priorisé

### 🔴 Urgent (cette semaine) — sécurité de la base

1. **Migration de durcissement** unique :
   - `GRANT UPDATE` par colonne sur `profiles`, `bookings`, `establishments` + triggers de garde (C1, C3, E1) ;
   - `revoke execute` sur `approve_partner_request` (C2) ;
   - nouvelle `validate_ticket(p_code)` basée sur `auth.uid()` avec contrôle de statut (E2) ;
   - trigger `before insert` sur `bookings` et `booking_items` (E5, M2) ;
   - `suspended_at is null` dans la lecture publique des établissements.
2. **Auditer la production** : vérifier en base si `role` a déjà été modifié par un non-admin (`select id, email, role, updated_at from profiles where role in ('admin','partner')`) et si des établissements `approved` n'ont pas été créés par l'admin.
3. **Edge functions** : échappement HTML, réponses génériques, `{ sent: true }` constant, CORS restreint (E3, E4, M8).

### 🟠 Court terme (2–3 semaines)

4. RPC `create_booking` transactionnelle avec verrou de capacité (M3, réservation non atomique, prix restaurant).
5. Politique RLS + confirmation pour l'annulation voyageur ; états d'erreur « Réessayer » sur les listes.
6. En-têtes de sécurité dans `vercel.json` ; politiques et limites du bucket de stockage (M1, M6).
7. Captcha et limites de débit sur `partner_requests`, reset de mot de passe, avis.
8. `supabase db pull` pour versionner le schéma réel ; supprimer/commenter `0013` et `0018` ; `supabase gen types`.
9. Politique de confidentialité, CGU, suppression de compte.

### 🟡 Moyen terme (1–2 mois)

10. SEO : `web.output: "static"`, `<Head>` par page (title, description, Open Graph), `<Link>` partout, favicon, `robots.txt`, `sitemap.xml`, `+not-found.tsx`.
11. Performance : supprimer le délai minimal du splash, redimensionnement des images, retirer Reanimated, polices WOFF2.
12. Accessibilité : rôles/états dans `Button`, `Chip`, `ListingCard` ; `accessibilityRole="header"` ; `accessibilityLabel` des champs ; zones tactiles ≥ 44 px ; contour des champs.
13. Dates en fuseau `Africa/Kinshasa` ; corriger calendrier (`fullDays`, créneaux passés, nuits).
14. Auth native (expo-web-browser pour Google, callback PKCE, liens universels) si l'app mobile est publiée.

### ⚪ Fond (continu)

15. Supprimer `src/`, `scripts/reset-project.js`, images inutilisées, `admin-appearance.tsx` ; renommer le paquet.
16. ESLint (`eslint-config-expo`), tests `jest-expo` sur `lib/` (`opening-hours`, `offers`, `dates`, `booking-slots`), tests pgTAP sur la RLS, CI (tsc + lint + tests), Sentry.
17. Mettre à jour `design-system-yakardc.md` ; jetons `overlay`, `onBrandMuted`, `dangerOnDark` ; remplacer `fontWeight` par les familles ; factoriser `FormField`, `StatCard`, `Button`.
18. `npm audit fix` ; messages de commit explicites.
