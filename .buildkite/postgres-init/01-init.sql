-- Runs once when the CI Postgres container first starts (see
-- docker-entrypoint-initdb.d in the official postgres image). Creates the
-- second "data" database and seeds it with a tiny `pacuare_raw` table so
-- app/data/data-source.test.ts and app/data/docker/provision.test.ts have
-- something real to read.
create database pacuare_data_test;

\c pacuare_data_test

create table pacuare_raw (
  id text,
  date text,
  year integer,
  turtle_species text
);

insert into pacuare_raw (id, date, year, turtle_species) values
  ('1', '2024-01-01', 2024, 'Leatherback'),
  ('2', '2024-01-02', 2024, 'Green');
