-- Tanka: banco de dados no Supabase.
-- Como usar: no painel do Supabase, abra SQL Editor > New query, cole este arquivo inteiro e clique em Run.
-- Pode rodar de novo sem problema (não apaga dados).

-- ---------- Contas ----------
-- O login usa o Supabase Auth com um e-mail interno (<usuario>@jogador.tankaarena.com);
-- o e-mail real fica aqui, visível só para o dono da conta.
create table if not exists public.contas (
  id uuid primary key references auth.users (id) on delete cascade,
  usuario text not null,
  email text not null,
  admin boolean not null default false,   -- só muda pelo SQL Editor
  criado_em timestamptz not null default now()
);
alter table public.contas drop column if exists whatsapp;  -- o cadastro não pede mais WhatsApp
create unique index if not exists contas_usuario_unico on public.contas (lower(usuario));
create unique index if not exists contas_email_unico on public.contas (lower(email));

alter table public.contas enable row level security;
drop policy if exists "conta: ler a propria" on public.contas;
create policy "conta: ler a propria" on public.contas for select using (auth.uid() = id);

-- Cria a linha da conta junto com o usuário do Auth (dados vêm do cadastro).
create or replace function public.criar_conta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.contas (id, usuario, email)
  values (new.id, new.raw_user_meta_data ->> 'usuario', lower(new.raw_user_meta_data ->> 'email'));
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_conta();

-- ---------- Personagens ----------
create table if not exists public.personagens (
  id text primary key,
  conta_id uuid not null default auth.uid() references public.contas (id) on delete cascade,
  nome text not null,
  dados jsonb not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists personagens_nome_unico on public.personagens (lower(nome));
create index if not exists personagens_conta on public.personagens (conta_id);

alter table public.personagens enable row level security;
drop policy if exists "personagem: ler os seus" on public.personagens;
drop policy if exists "personagem: criar os seus" on public.personagens;
drop policy if exists "personagem: salvar os seus" on public.personagens;
drop policy if exists "personagem: apagar os seus" on public.personagens;
create policy "personagem: ler os seus" on public.personagens for select using (auth.uid() = conta_id);
create policy "personagem: criar os seus" on public.personagens for insert with check (auth.uid() = conta_id);
create policy "personagem: salvar os seus" on public.personagens for update using (auth.uid() = conta_id) with check (auth.uid() = conta_id);
create policy "personagem: apagar os seus" on public.personagens for delete using (auth.uid() = conta_id);

-- Máximo de 3 personagens por conta; o nome não muda depois de criado.
create or replace function public.validar_personagem() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.personagens where conta_id = new.conta_id) >= 3 then
    raise exception 'Limite de 3 personagens por conta.';
  end if;
  if tg_op = 'UPDATE' then new.nome := old.nome; end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists antes_de_salvar_personagem on public.personagens;
create trigger antes_de_salvar_personagem before insert or update on public.personagens
  for each row execute function public.validar_personagem();

-- ---------- Funções públicas ----------
create or replace function public.usuario_livre(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.contas where lower(usuario) = lower(u));
$$;
create or replace function public.email_livre(e text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.contas where lower(email) = lower(e));
$$;
create or replace function public.nome_personagem_livre(n text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.personagens where lower(nome) = lower(n));
$$;
-- Relógio do servidor (vida com o tempo e reset diário não dependem do relógio do aparelho).
create or replace function public.agora() returns timestamptz
language sql stable as $$ select now(); $$;

grant execute on function public.usuario_livre(text), public.email_livre(text),
  public.nome_personagem_livre(text), public.agora() to anon, authenticated;
