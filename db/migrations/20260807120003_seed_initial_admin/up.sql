-- Bootstrap admin so the app is usable before anyone can use the admin UI
-- to add authorized users. Additional admins can promote further users
-- from here on.
insert into authorized_users (email, role, added_by)
values ('aleks@rutins.com', 'admin', 'system')
on conflict (email) do nothing;
