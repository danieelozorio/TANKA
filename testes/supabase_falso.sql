-- Imita o mínimo do Supabase para testar supabase/schema.sql num PostgreSQL comum.
-- Uso (ver testes/banco.test.sh): cria os papéis anon/authenticated, auth.users e auth.uid().
drop schema if exists auth cascade;
drop schema if exists public cascade;
create schema public;
grant all on schema public to public;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb,
  encrypted_password text, updated_at timestamptz, instance_id uuid, aud text, role text, email text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, created_at timestamptz default now(),
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text);
create table auth.identities (id uuid primary key default gen_random_uuid(), provider_id text not null, user_id uuid not null
  references auth.users (id), identity_data jsonb not null, provider text not null, last_sign_in_at timestamptz,
  created_at timestamptz, updated_at timestamptz, unique (provider_id, provider));
-- No Supabase o pgcrypto fica no esquema extensions.
drop schema if exists extensions cascade;
create schema extensions;
grant usage on schema extensions to anon, authenticated;
-- auth.uid(): quem está "logado" vem de uma configuração da sessão.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated;
