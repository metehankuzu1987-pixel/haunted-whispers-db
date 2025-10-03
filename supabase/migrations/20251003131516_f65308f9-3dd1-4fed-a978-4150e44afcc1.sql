-- Add admin role for the initial admin user
insert into public.user_roles (user_id, role)
select id, 'admin'::app_role
from auth.users
where email = 'iletisim@tabirly.com'
on conflict (user_id, role) do nothing;