-- ─── Seed directo: insertar Carlos, Laura, Miguel en "Pakinhos Prueba" ───
-- IDs conocidos de auth.users:
-- Carlos: 53b8c507-d0d9-498b-9d14-ceb2a932e523
-- Laura:  9e22a6cf-c88f-477f-888d-b60404335de9
-- Miguel: 624f213e-bf0d-4bfa-904e-ed555efea03a

-- Paso 1: Asegurar perfiles
insert into public.profiles (id, display_name, created_at, updated_at)
values
  ('53b8c507-d0d9-498b-9d14-ceb2a932e523', 'Carlos', now(), now()),
  ('9e22a6cf-c88f-477f-888d-b60404335de9', 'Laura',  now(), now()),
  ('624f213e-bf0d-4bfa-904e-ed555efea03a', 'Miguel', now(), now())
on conflict (id) do update set display_name = excluded.display_name;

-- Paso 2: Insertar como miembros activos en TODOS los grupos que contengan "pakinhos prueba"
insert into public.group_members (group_id, user_id, role, status, joined_at, created_at)
select g.id, u.id, 'member', 'active', now(), now()
from public.groups g
cross join (
  values
    ('53b8c507-d0d9-498b-9d14-ceb2a932e523'::uuid),
    ('9e22a6cf-c88f-477f-888d-b60404335de9'::uuid),
    ('624f213e-bf0d-4bfa-904e-ed555efea03a'::uuid)
) as u(id)
where lower(g.name) like '%pakinhos prueba%'
on conflict (group_id, user_id) do nothing;

-- Paso 3: Verificar resultado
select gm.id as member_id, g.name as grupo, p.display_name, gm.status
from public.group_members gm
join public.groups g on g.id = gm.group_id
left join public.profiles p on p.id = gm.user_id
where lower(g.name) like '%pakinhos prueba%'
order by p.display_name;
