-- Accueil 2.36 : comptes « collègue » créés par le concepteur, sans adresse e-mail réelle.
-- A lancer une fois dans le SQL Editor du projet Supabase d'Index (relançable sans risque).
--
-- Principe :
--   * le concepteur crée le compte dans Supabase (Authentication > Add user > Auto Confirm User)
--     avec une adresse fictive « prenom.nom@equipe.invalid » ; le collègue se connecte avec « prenom.nom » ;
--   * ces comptes démarrent avec un mot de passe provisoire : à la première connexion, l'Accueil
--     oblige à choisir son mot de passe (et son nom) avant d'ouvrir les applis ;
--   * mot de passe oublié : le concepteur remet un mot de passe provisoire depuis l'Accueil.

-- 1. Drapeau « mot de passe provisoire » sur le profil
alter table public.profiles add column if not exists mdp_provisoire boolean not null default false;

-- 2. Les comptes « @equipe.invalid » démarrent en mot de passe provisoire
create or replace function public.profil_equipe_provisoire()
returns trigger language plpgsql as $$
begin
  if lower(coalesce(new.email, '')) like '%@equipe.invalid' then new.mdp_provisoire := true; end if;
  return new;
end $$;
drop trigger if exists trg_profil_equipe_provisoire on public.profiles;
create trigger trg_profil_equipe_provisoire before insert on public.profiles
  for each row execute function public.profil_equipe_provisoire();

-- Personne ne remet lui-même son drapeau à « provisoire »… ni ne l'efface sans passer par la fonction prévue
create or replace function public.protect_mdp_provisoire()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and new.mdp_provisoire is distinct from old.mdp_provisoire then
    raise exception 'Réservé au concepteur';
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_mdp_provisoire on public.profiles;
create trigger trg_protect_mdp_provisoire before update on public.profiles
  for each row execute function public.protect_mdp_provisoire();

-- 3. Le compte connecté doit-il choisir son mot de passe ?
create or replace function public.mon_mdp_provisoire()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select mdp_provisoire from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.mon_mdp_provisoire() from public;
grant execute on function public.mon_mdp_provisoire() to authenticated;

-- 4. Première connexion terminée : nom enregistré, drapeau retiré
--    (appelée par l'Accueil juste après le changement de mot de passe)
create or replace function public.premiere_connexion_faite(_prenom text, _nom text)
returns void language plpgsql security definer set search_path = public as $$
declare p text := nullif(btrim(coalesce(_prenom, '')), ''); n text := nullif(btrim(coalesce(_nom, '')), '');
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  update public.profiles set
    first_name = coalesce(left(p, 60), first_name),
    last_name = coalesce(left(n, 60), last_name),
    display_name = coalesce(left(nullif(btrim(concat_ws(' ', p, n)), ''), 120), display_name),
    mdp_provisoire = false
  where id = auth.uid();
end $$;
revoke all on function public.premiere_connexion_faite(text, text) from public;
grant execute on function public.premiere_connexion_faite(text, text) to authenticated;

-- 5. Mot de passe oublié : le concepteur remet un mot de passe provisoire
--    (jamais sur le compte du concepteur ; le collègue devra le changer à sa connexion suivante)
create or replace function public.reinitialiser_mdp(_id uuid, _mdp text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_concepteur() then raise exception 'Réservé au concepteur'; end if;
  if _id = auth.uid() then raise exception 'Changez votre propre mot de passe depuis votre compte'; end if;
  if exists (select 1 from public.profiles where id = _id and role = 'concepteur') then raise exception 'Le compte du concepteur ne peut pas être modifié'; end if;
  if length(coalesce(_mdp, '')) < 6 then raise exception 'Mot de passe provisoire trop court (6 caractères minimum)'; end if;
  update auth.users set encrypted_password = extensions.crypt(_mdp, extensions.gen_salt('bf')), updated_at = now() where id = _id;
  if not found then raise exception 'Compte introuvable'; end if;
  update public.profiles set mdp_provisoire = true where id = _id;
end $$;
revoke all on function public.reinitialiser_mdp(uuid, text) from public;
grant execute on function public.reinitialiser_mdp(uuid, text) to authenticated;

-- Contrôle : la colonne existe et les fonctions sont en place
select count(*) filter (where mdp_provisoire) as comptes_en_provisoire, count(*) as comptes from public.profiles;
