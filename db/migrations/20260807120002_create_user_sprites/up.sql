create table user_sprites (
  id serial primary key,
  user_id integer not null references users (id) on delete cascade,
  name text not null unique,
  status text not null default 'provisioning'
    check (status in ('provisioning', 'ready', 'error', 'deleted')),
  notebook_url text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index user_sprites_user_id_idx on user_sprites (user_id);
