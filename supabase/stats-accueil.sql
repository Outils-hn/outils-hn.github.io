-- Accueil 1.8 : statistiques, reservees au concepteur. Aucune donnee personnelle : seulement des totaux.
-- (Sans ce script l'onglet « Statistiques » reste simplement cache.)
create or replace function public.stats_accueil() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  j30 timestamptz := now() - interval '30 days';
  r jsonb;
begin
  if not public.is_concepteur() then raise exception 'Reserve au concepteur'; end if;
  select jsonb_build_object(
    'comptes', jsonb_build_object(
      'total', (select count(*) from profiles),
      'valides', (select count(*) from profiles where approved),
      'attente', (select count(*) from profiles where not approved),
      'concepteur', (select count(*) from profiles where approved and role = 'concepteur'),
      'administrateur', (select count(*) from profiles where approved and role = 'administrateur'),
      'dessinateur', (select count(*) from profiles where approved and role = 'dessinateur')),
    'derniers', coalesce((select jsonb_agg(jsonb_build_object('email', email, 'le', created_at) order by created_at desc)
                          from (select email, created_at from profiles order by created_at desc limit 3) x), '[]'::jsonb),
    'retours', jsonb_build_object(
      'total', (select count(*) from retours),
      'nouveaux', (select count(*) from retours where statut = 'nouveau')),
    'applis', jsonb_build_array(
      jsonb_build_object('nom', 'Index', 'total', (select count(*) from products where deleted_at is null),
        'mois', (select count(*) from products where deleted_at is null and created_at >= j30),
        'a_verifier', (select count(*) from products where deleted_at is null and coalesce(verified_at, updated_at) < now() - interval '12 months')),
      jsonb_build_object('nom', 'Access', 'total', (select count(*) from access_fournisseurs),
        'mois', (select count(*) from access_fournisseurs where updated_at >= j30)),
      jsonb_build_object('nom', 'Check', 'total', (select count(*) from check_notes where supprime_le is null),
        'mois', (select count(*) from check_notes where supprime_le is null and created_at >= j30)),
      jsonb_build_object('nom', 'Masse', 'total', (select count(*) from materials where deleted_at is null) + (select count(*) from elements where deleted_at is null),
        'mois', (select count(*) from materials where deleted_at is null and created_at >= j30) + (select count(*) from elements where deleted_at is null and created_at >= j30)),
      jsonb_build_object('nom', 'Format', 'total', (select count(*) from format_materiaux where deleted_at is null),
        'mois', (select count(*) from format_materiaux where deleted_at is null and updated_at >= j30)),
      jsonb_build_object('nom', 'Strate', 'total', (select count(*) from strate_catalogue where deleted_at is null),
        'mois', (select count(*) from strate_catalogue where deleted_at is null and updated_at >= j30)))
  ) into r;
  return r;
end $$;
revoke all on function public.stats_accueil() from public;
grant execute on function public.stats_accueil() to authenticated;
