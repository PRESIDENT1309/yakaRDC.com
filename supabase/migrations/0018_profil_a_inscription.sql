-- ============================================================================
--  PROPOSITION — NE PAS EXÉCUTER SANS DÉCISION EXPLICITE
-- ============================================================================
--
--  Problème constaté
--  -----------------
--  `profiles` a RLS activée (0001_init.sql, ligne 162) avec trois politiques :
--    - profiles_select_own
--    - profiles_select_for_partner_bookings
--    - profiles_update_own
--  Aucune politique `insert`, dans aucune des 17 migrations. Aucun déclencheur
--  non plus sur auth.users.
--
--  Conséquence : à l'inscription d'un voyageur, `supabase.auth.signUp` crée le
--  compte d'authentification, puis l'écriture cliente dans `profiles` est
--  refusée. L'utilisateur obtient un compte d'accès SANS profil. Comme toute
--  l'application se fie à `profile`, elle le considère comme non connecté.
--  L'inscription voyageur n'a donc jamais pu aboutir.
--
--  Les comptes existants ne passaient pas par là :
--    - l'administrateur a été créé à la main en SQL ;
--    - les partenaires le sont par supabase/functions/approve-partner, qui
--      écrit avec la clé de service et contourne donc RLS.
--
--  Pourquoi un déclencheur plutôt qu'une politique `insert`
--  --------------------------------------------------------
--  Une politique `insert with check (auth.uid() = id)` suffirait SI la
--  confirmation par email est désactivée. Si elle est active, `signUp` ne
--  renvoie pas de session : `auth.uid()` vaut null au moment de l'écriture, et
--  l'insertion échouerait quand même. Le déclencheur, lui, s'exécute côté
--  serveur et fonctionne dans les deux cas.
--
--  Compatibilité avec l'approbation des partenaires — vérifiée
--  -----------------------------------------------------------
--  approve-partner appelle `auth.admin.createUser`, ce qui déclenchera aussi
--  cette fonction : un profil `traveler` sera créé. La fonction fait ensuite un
--  `upsert` (donc un update sur conflit de clé primaire) qui écrase les bonnes
--  valeurs, puis 0012 passe le rôle à `partner`. L'ordre reste correct — c'est
--  d'ailleurs exactement ce que 0012 suppose, puisqu'il écrit
--  `set role = 'partner' ... where role = 'traveler'`.
--
--  Après application
--  -----------------
--  app/(auth)/register.tsx peut cesser d'écrire lui-même dans `profiles` : il
--  gère déjà le cas (il vérifie que le profil existe avant de signaler une
--  erreur), mais l'appel devient inutile.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    'traveler'
  )
  on conflict (id) do nothing;

  return new;

exception
  when others then
    -- `profiles.email` et `profiles.phone` sont uniques. Une collision ferait
    -- échouer l'INSERT, et comme ce déclencheur s'exécute dans la transaction
    -- de création du compte, elle ferait échouer TOUTE l'inscription.
    -- Un profil manquant se répare ; une inscription impossible bloque
    -- l'utilisateur dehors. On laisse donc le compte se créer et on trace.
    raise warning 'handle_new_user : profil non créé pour % — %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
--  Réparation des comptes déjà créés sans profil
--  --------------------------------------------
--  À exécuter une seule fois, APRÈS le déclencheur, pour rattraper les comptes
--  d'authentification restés orphelins lors des tentatives d'inscription.
--  Décommentez seulement après avoir vérifié ce que la requête renvoie :
--
--    select u.id, u.email, u.created_at
--    from auth.users u
--    left join public.profiles p on p.id = u.id
--    where p.id is null;
--
-- insert into public.profiles (id, full_name, email, phone, role)
-- select
--   u.id,
--   nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
--   u.email,
--   nullif(trim(coalesce(u.raw_user_meta_data ->> 'phone', '')), ''),
--   'traveler'
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- where p.id is null
-- on conflict (id) do nothing;
-- ============================================================================
