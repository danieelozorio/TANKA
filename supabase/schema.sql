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

-- ---------- Chat global ----------
alter table public.contas add column if not exists silenciado_ate timestamptz;  -- moderação do chat

create table if not exists public.mensagens (
  id bigint generated always as identity primary key,
  conta_id uuid not null default auth.uid() references public.contas (id) on delete cascade,
  personagem text not null,
  classe text not null,
  nivel int not null,
  texto text not null check (char_length(texto) between 1 and 200),
  criado_em timestamptz not null default now()
);
create index if not exists mensagens_conta on public.mensagens (conta_id, criado_em);

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select admin from public.contas where id = auth.uid()), false);
$$;

alter table public.mensagens enable row level security;
drop policy if exists "chat: logados leem" on public.mensagens;
drop policy if exists "chat: escrever as suas" on public.mensagens;
drop policy if exists "chat: admin apaga" on public.mensagens;
create policy "chat: logados leem" on public.mensagens for select to authenticated using (true);
create policy "chat: escrever as suas" on public.mensagens for insert to authenticated with check (auth.uid() = conta_id);
create policy "chat: admin apaga" on public.mensagens for delete to authenticated using (public.eh_admin());

-- Antes de gravar: silenciado? flood (1 a cada 3 s)? Nome, classe e level vêm do personagem salvo.
create or replace function public.validar_mensagem() returns trigger
language plpgsql security definer set search_path = public as $$
declare d jsonb; ate timestamptz;
begin
  new.conta_id := auth.uid();
  new.texto := btrim(new.texto);
  if new.texto = '' then raise exception 'Mensagem vazia.'; end if;
  select silenciado_ate into ate from public.contas where id = new.conta_id;
  if ate is not null and ate > now() then
    if ate = 'infinity'::timestamptz then raise exception 'Você não pode falar no chat (decisão do administrador).'; end if;
    raise exception 'Você não pode falar no chat até %.', to_char(ate at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI');
  end if;
  if exists (select 1 from public.mensagens where conta_id = new.conta_id and criado_em > now() - interval '3 seconds') then
    raise exception 'Calma! Espere 3 segundos entre as mensagens.';
  end if;
  select dados into d from public.personagens where conta_id = new.conta_id and lower(nome) = lower(new.personagem);
  if d is null then raise exception 'Personagem inválido.'; end if;
  new.personagem := d ->> 'nome';
  new.classe := d ->> 'classe';
  new.nivel := (d ->> 'nivel')::int;
  new.criado_em := now();
  delete from public.mensagens where criado_em < now() - interval '7 days';  -- faxina
  return new;
end $$;
drop trigger if exists antes_de_gravar_mensagem on public.mensagens;
create trigger antes_de_gravar_mensagem before insert on public.mensagens
  for each row execute function public.validar_mensagem();

-- Admin: silenciar o dono de um personagem. horas: null = para sempre, 0 = liberar.
create or replace function public.silenciar(nome_personagem text, horas int) returns void
language plpgsql security definer set search_path = public as $$
declare alvo uuid;
begin
  if not public.eh_admin() then raise exception 'Só administradores.'; end if;
  select conta_id into alvo from public.personagens where lower(nome) = lower(nome_personagem);
  if alvo is null then raise exception 'Personagem não encontrado.'; end if;
  update public.contas set silenciado_ate = case
    when horas is null then 'infinity'::timestamptz
    when horas <= 0 then null
    else now() + make_interval(hours => horas) end
  where id = alvo;
end $$;
revoke execute on function public.silenciar(text, int) from public, anon;
grant execute on function public.silenciar(text, int) to authenticated;

-- Avisa a API do Supabase que as tabelas mudaram (evita o erro "schema cache").
notify pgrst, 'reload schema';

-- ---------- Ranking ----------
-- Top 100 por level (empate: exp) ou por poder. Contas de administrador ficam de fora.
create or replace function public.ranking(tipo text) returns table (nome text, classe text, raca text, nivel int, exp bigint, poder bigint)
language sql stable security definer set search_path = public as $$
  select p.nome, p.dados ->> 'classe', p.dados ->> 'raca',
         coalesce((p.dados ->> 'nivel')::int, 1), coalesce((p.dados ->> 'exp')::bigint, 0), coalesce((p.dados ->> 'poder')::bigint, 0)
  from public.personagens p join public.contas c on c.id = p.conta_id
  where not c.admin
  order by
    case when tipo = 'poder' then coalesce((p.dados ->> 'poder')::bigint, 0) else coalesce((p.dados ->> 'nivel')::bigint, 1) end desc,
    case when tipo = 'poder' then coalesce((p.dados ->> 'nivel')::bigint, 1) else coalesce((p.dados ->> 'exp')::bigint, 0) end desc,
    p.criado_em
  limit 100;
$$;
revoke execute on function public.ranking(text) from public, anon;
grant execute on function public.ranking(text) to authenticated;

-- ---------- Amigos ----------
-- Amizade entre personagens. A tabela não é lida direto: tudo passa pelas funções abaixo,
-- que conferem se o personagem "meu" é mesmo da conta logada.
create table if not exists public.amizades (
  id bigint generated always as identity primary key,
  de text not null references public.personagens (id) on delete cascade,
  para text not null references public.personagens (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceita')),
  criado_em timestamptz not null default now(),
  unique (de, para)
);
create index if not exists amizades_para on public.amizades (para);
alter table public.amizades enable row level security;

create or replace function public.conferir_dono(meu text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.personagens where id = meu and conta_id = auth.uid()) then
    raise exception 'Personagem inválido.';
  end if;
end $$;

-- Amigos, pedidos recebidos e enviados. visto_em = último salvamento do personagem (online se recente).
create or replace function public.amigos_listar(meu text)
returns table (pedido bigint, situacao text, id text, nome text, classe text, raca text, nivel int, poder bigint, visto_em timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  return query
  select a.id,
         case when a.status = 'aceita' then 'amigo' when a.de = meu then 'enviado' else 'recebido' end,
         p.id, p.nome, p.dados ->> 'classe', p.dados ->> 'raca',
         coalesce((p.dados ->> 'nivel')::int, 1), coalesce((p.dados ->> 'poder')::bigint, 0), p.atualizado_em
  from public.amizades a
  join public.personagens p on p.id = case when a.de = meu then a.para else a.de end
  where a.de = meu or a.para = meu
  order by p.atualizado_em desc;
end $$;

-- Pede amizade pelo nome. Se o outro já tinha pedido, vira amizade na hora.
create or replace function public.amigo_pedir(meu text, nome_amigo text) returns text
language plpgsql security definer set search_path = public as $$
declare alvo public.personagens; existente public.amizades;
begin
  perform public.conferir_dono(meu);
  select * into alvo from public.personagens where lower(nome) = lower(btrim(nome_amigo));
  if alvo.id is null then raise exception 'Nenhum personagem com esse nome.'; end if;
  if alvo.conta_id = auth.uid() then raise exception 'Esse personagem é seu.'; end if;
  select * into existente from public.amizades where (de = meu and para = alvo.id) or (de = alvo.id and para = meu);
  if existente.id is not null then
    if existente.status = 'aceita' then raise exception 'Vocês já são amigos.'; end if;
    if existente.de = meu then raise exception 'Pedido já enviado. Espere a resposta.'; end if;
    update public.amizades set status = 'aceita' where id = existente.id;
    return 'aceita';
  end if;
  if (select count(*) from public.amizades where de = meu or para = meu) >= 50 then
    raise exception 'Limite de 50 amigos e pedidos.';
  end if;
  insert into public.amizades (de, para) values (meu, alvo.id);
  return 'enviado';
end $$;

-- Aceitar ou recusar um pedido recebido.
create or replace function public.amigo_responder(meu text, pedido bigint, aceitar boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  if aceitar then
    update public.amizades set status = 'aceita' where id = pedido and para = meu and status = 'pendente';
  else
    delete from public.amizades where id = pedido and para = meu and status = 'pendente';
  end if;
end $$;

-- Remove amigo, cancela pedido enviado ou recusa recebido.
create or replace function public.amigo_remover(meu text, pedido bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  delete from public.amizades where id = pedido and (de = meu or para = meu);
end $$;

revoke execute on function public.conferir_dono(text), public.amigos_listar(text), public.amigo_pedir(text, text),
  public.amigo_responder(text, bigint, boolean), public.amigo_remover(text, bigint) from public, anon;
grant execute on function public.amigos_listar(text), public.amigo_pedir(text, text),
  public.amigo_responder(text, bigint, boolean), public.amigo_remover(text, bigint) to authenticated;

notify pgrst, 'reload schema';
