-- Approbation d'une demande de partenariat — réécriture.
--
-- La version précédente (créée hors migrations, retrouvée via pg_proc) avait
-- trois défauts qui, ensemble, rendaient l'accès partenaire inatteignable :
--
-- 1. ELLE NE DONNAIT JAMAIS LE RÔLE.
--    `profiles.role` restait `traveler`. Même quand le propriétaire était
--    correctement identifié, il n'avait accès à aucun écran professionnel.
--    C'est la cause directe du symptôme « on ne reçoit pas de quoi se
--    connecter » : le compte existait parfois, mais ne servait à rien.
--
-- 2. ELLE ATTRIBUAIT L'ÉTABLISSEMENT À L'ADMINISTRATEUR EN CAS D'ÉCHEC.
--    `coalesce(v_owner_id, p_admin_id)` : sans profil correspondant, l'admin
--    devenait propriétaire. Son tableau de bord se remplissait d'établissements
--    qui ne sont pas les siens, et le vrai partenaire ne pouvait plus les
--    récupérer — `owner_id` n'est modifiable nulle part dans l'app.
--    On refuse désormais l'approbation plutôt que de créer une donnée fausse :
--    un échec visible vaut mieux qu'un succès trompeur.
--
-- 3. ELLE IDENTIFIAIT LE PROPRIÉTAIRE PAR EMAIL.
--    Rapprochement fragile : email absent (le champ était facultatif), casse
--    différente, ou simple faute de frappe, et le lien était manqué.
--    `partner_requests.user_id` (migration 0011) porte maintenant le compte du
--    demandeur. Le rapprochement par email est conservé en repli pour les
--    demandes antérieures, mais insensible à la casse et aux espaces.
--
-- Tout le reste est repris à l'identique : création de l'établissement avec
-- les mêmes champs, passage de la demande à `approved` avec
-- `created_establishment_id`, trace dans `admin_activity_log`, et retour de
-- l'identifiant de l'établissement créé.

create or replace function approve_partner_request(
  p_request_id uuid,
  p_admin_id   uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request         partner_requests%rowtype;
  v_owner_id        uuid;
  v_establishment_id uuid;
begin
  select * into v_request from partner_requests where id = p_request_id;
  if not found then
    raise exception 'Demande introuvable';
  end if;

  if v_request.status = 'approved' then
    raise exception 'Cette demande a déjà été approuvée.';
  end if;

  -- Le compte du demandeur fait foi. À défaut (demandes antérieures à la
  -- migration 0011), on retombe sur l'email, comparé sans tenir compte de la
  -- casse ni des espaces.
  v_owner_id := v_request.user_id;

  if v_owner_id is null and v_request.contact_email is not null then
    select id into v_owner_id
    from profiles
    where lower(trim(email)) = lower(trim(v_request.contact_email))
    limit 1;
  end if;

  -- Plus de repli sur l'administrateur : sans propriétaire identifiable, la
  -- demande n'est pas approuvable. Le message dit quoi faire.
  if v_owner_id is null then
    raise exception
      'Aucun compte ne correspond à cette demande (email : %). Le demandeur doit créer un compte avec cet email, puis relancer sa demande.',
      coalesce(v_request.contact_email, 'non renseigné');
  end if;

  insert into establishments (
    owner_id, type, name, description, city, commune, neighborhood,
    avenue, numero, reference, phone, email, status
  ) values (
    v_owner_id,
    v_request.establishment_type, v_request.establishment_name, v_request.description,
    v_request.city, v_request.commune, v_request.neighborhood,
    v_request.avenue, v_request.numero, v_request.reference,
    v_request.contact_phone, v_request.contact_email, 'approved'
  ) returning id into v_establishment_id;

  -- Le rôle, qui manquait entièrement. Restreint à `traveler` : approuver la
  -- demande d'un administrateur ne doit pas lui retirer ses droits.
  update profiles
  set role = 'partner'
  where id = v_owner_id
    and role = 'traveler';

  update partner_requests
  set status = 'approved',
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      created_establishment_id = v_establishment_id
  where id = p_request_id;

  insert into admin_activity_log (actor_id, action, target_type, target_id, details)
  values (
    p_admin_id, 'partner_request_approved', 'partner_request', p_request_id,
    jsonb_build_object(
      'establishment_name', v_request.establishment_name,
      'establishment_id', v_establishment_id,
      'owner_id', v_owner_id
    )
  );

  return v_establishment_id;
end;
$$;
