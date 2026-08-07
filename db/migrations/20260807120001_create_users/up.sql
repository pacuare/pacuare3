create table users (
  id serial primary key,
  email text not null unique,
  google_sub text not null unique,
  name text not null,
  picture_url text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
