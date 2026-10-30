-- Retours de l'equipe (idees et bugs) pour toutes les applis : a coller UNE FOIS dans
-- Supabase > projet d'INDEX > SQL Editor > New query > Run. Relancer le script ne casse rien.
--
-- - Envoi SANS compte depuis n'importe quelle appli, par la fonction « retour_envoyer »
--   (controles : longueur, appli connue, 30 retours maximum par heure pour tout le monde, pas de doublon).
-- - Liste lisible par tout le monde (page Retours de l'Accueil) : chacun voit si un bug est deja signale.
-- - « Moi aussi » : +1 sur un retour existant.
-- - Statut et reponse : seulement les ADMINISTRATEURS d'Index (fonction public.is_admin()).

create table if not exists public.retours (
  id uuid primary key default gen_random_uuid(),
  app text not null check (app in ('Access', 'Check', 'Format', 'Index', 'Linear', 'Masse', 'Strate', 'Trame', 'Accueil')),
  type text not null check (type in ('idee', 'bug')),
  texte text not null check (length(trim(texte)) between 5 and 2000),
  nom text not null default '' check (length(nom) <= 60),
  page text not null default '' check (length(page) <= 300),
  version text not null default '' check (length(version) <= 20),
  navigateur text not null default '' check (length(navigateur) <= 200),
  statut text not null default 'nouveau' check (statut in ('nouveau', 'prevu', 'en_cours', 'fait', 'refuse')),
  reponse text not null default '' check (length(reponse) <= 1000),
  moi_aussi int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists retours_date on public.retours (created_at desc);

alter table public.retours enable row level security;
revoke all on public.retours from anon, authenticated;
grant select on public.retours to anon, authenticated;
grant all on public.retours to service_role;
drop policy if exists "retours lecture" on public.retours;
create policy "retours lecture" on public.retours for select to anon, authenticated using (true);

create or replace function public.retour_envoyer(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_texte text := trim(coalesce(p->>'texte', ''));
begin
  if length(v_texte) < 5 then return jsonb_build_object('ok', false, 'error', 'Décrivez un peu plus (5 caractères au moins).'); end if;
  if length(v_texte) > 2000 then return jsonb_build_object('ok', false, 'error', 'Texte trop long (2000 caractères au plus).'); end if;
  if coalesce(p->>'app', '') not in ('Access', 'Check', 'Format', 'Index', 'Linear', 'Masse', 'Strate', 'Trame', 'Accueil') then return jsonb_build_object('ok', false, 'error', 'Appli inconnue.'); end if;
  if coalesce(p->>'type', '') not in ('idee', 'bug') then return jsonb_build_object('ok', false, 'error', 'Type inconnu.'); end if;
  -- Garde-fous anti-spam : debit global et doublons exacts
  if (select count(*) from retours where created_at > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'Beaucoup de retours en ce moment : réessayez dans une heure.');
  end if;
  if exists (select 1 from retours where lower(texte) = lower(v_texte) and created_at > now() - interval '1 day') then
    return jsonb_build_object('ok', false, 'error', 'Ce retour a déjà été envoyé.');
  end if;
  insert into retours (app, type, texte, nom, page, version, navigateur)
  values (p->>'app', p->>'type', v_texte, left(trim(coalesce(p->>'nom', '')), 60), left(coalesce(p->>'page', ''), 300),
          left(coalesce(p->>'version', ''), 20), left(coalesce(p->>'navigateur', ''), 200))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.retour_moi_aussi(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update retours set moi_aussi = moi_aussi + 1 where id = p_id and statut not in ('fait', 'refuse');
  return jsonb_build_object('ok', found);
end $$;

-- Administrateurs d'Index : statut et reponse, ou suppression (spam)
create or replace function public.retour_traiter(p_id uuid, p_statut text, p_reponse text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Réservé aux administrateurs d''Index.'); end if;
  if p_statut not in ('nouveau', 'prevu', 'en_cours', 'fait', 'refuse') then return jsonb_build_object('ok', false, 'error', 'Statut inconnu.'); end if;
  update retours set statut = p_statut, reponse = left(coalesce(p_reponse, ''), 1000), updated_at = now() where id = p_id;
  return jsonb_build_object('ok', found);
end $$;

create or replace function public.retour_supprimer(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Réservé aux administrateurs d''Index.'); end if;
  delete from retours where id = p_id;
  return jsonb_build_object('ok', found);
end $$;

revoke all on function public.retour_envoyer(jsonb), public.retour_moi_aussi(uuid), public.retour_traiter(uuid, text, text), public.retour_supprimer(uuid) from public;
grant execute on function public.retour_envoyer(jsonb), public.retour_moi_aussi(uuid) to anon, authenticated;
grant execute on function public.retour_traiter(uuid, text, text), public.retour_supprimer(uuid) to authenticated;
