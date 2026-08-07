create table authorized_users (
  email text primary key,
  role text not null default 'member' check (role in ('admin', 'member')),
  added_by text,
  created_at timestamptz not null default now()
);
