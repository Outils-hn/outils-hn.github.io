-- Accueil 2.28 : liste de tous les fichiers stockes (reservee au concepteur), pour le zip de sauvegarde.
-- Le dossier des PDF n'est pas listable (securite) : cette fonction donne la liste sans l'ouvrir a tout le monde.
create or replace function public.liste_fichiers() returns table (seau text, chemin text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_concepteur() then raise exception 'Reserve au concepteur'; end if;
  return query select o.bucket_id::text, o.name::text from storage.objects o where o.name is not null order by 1, 2;
end $$;
revoke all on function public.liste_fichiers() from public;
grant execute on function public.liste_fichiers() to authenticated;
