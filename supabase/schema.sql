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
  bot boolean not null default false,     -- conta dos bots de teste (supabase/bots.sql)
  criado_em timestamptz not null default now()
);
alter table public.contas drop column if exists whatsapp;  -- o cadastro não pede mais WhatsApp
alter table public.contas add column if not exists bot boolean not null default false;
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
  if tg_op = 'INSERT' and not coalesce((select bot from public.contas where id = new.conta_id), false)
     and (select count(*) from public.personagens where conta_id = new.conta_id) >= 3 then
    raise exception 'Limite de 3 personagens por conta.';
  end if;
  if tg_op = 'UPDATE' then new.nome := old.nome; end if;
  -- conversões feitas pelo próprio schema não contam como "jogou agora"
  if tg_op = 'UPDATE' and current_setting('tanka.migracao', true) = '1' then new.atualizado_em := old.atualizado_em; return new; end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists antes_de_salvar_personagem on public.personagens;
create trigger antes_de_salvar_personagem before insert or update on public.personagens
  for each row execute function public.validar_personagem();

-- ---------- Tabelas das alianças (as funções ficam no fim do arquivo) ----------
create table if not exists public.aliancas (
  id bigint generated always as identity primary key,
  nome text not null,
  sigla text not null,
  brasao jsonb not null default '{}'::jsonb,
  nivel int not null default 1,
  exp bigint not null default 0,
  tesouro bigint not null default 0,
  mural text not null default '',
  bonus_exp_ate timestamptz,
  bonus_ouro_ate timestamptz,
  criada_em timestamptz not null default now()
);
create unique index if not exists aliancas_nome_unico on public.aliancas (lower(nome));
create unique index if not exists aliancas_sigla_unica on public.aliancas (upper(sigla));
create table if not exists public.alianca_membros (
  personagem_id text primary key references public.personagens (id) on delete cascade,
  alianca_id bigint not null references public.aliancas (id) on delete cascade,
  cargo text not null default 'membro' check (cargo in ('lider', 'oficial', 'membro')),
  contribuicao bigint not null default 0,
  entrou_em timestamptz not null default now()
);
create index if not exists alianca_membros_alianca on public.alianca_membros (alianca_id);
-- Vice-líder (Daniel, nov/2026): 1 por clã.
alter table public.alianca_membros drop constraint if exists alianca_membros_cargo_check;
alter table public.alianca_membros add constraint alianca_membros_cargo_check check (cargo in ('lider', 'vice', 'oficial', 'membro'));
create table if not exists public.alianca_convites (
  id bigint generated always as identity primary key,
  alianca_id bigint not null references public.aliancas (id) on delete cascade,
  personagem_id text not null references public.personagens (id) on delete cascade,
  tipo text not null check (tipo in ('convite', 'pedido')),
  criado_em timestamptz not null default now(),
  unique (alianca_id, personagem_id)
);
create table if not exists public.alianca_espera (
  personagem_id text primary key references public.personagens (id) on delete cascade,
  ate timestamptz not null
);
create table if not exists public.alianca_mensagens (
  id bigint generated always as identity primary key,
  alianca_id bigint not null references public.aliancas (id) on delete cascade,
  personagem text not null,
  cargo text,
  texto text not null check (char_length(texto) between 1 and 200),
  criado_em timestamptz not null default now()
);
create index if not exists alianca_mensagens_alianca on public.alianca_mensagens (alianca_id, id);
alter table public.aliancas enable row level security;
alter table public.alianca_membros enable row level security;
alter table public.alianca_convites enable row level security;
alter table public.alianca_espera enable row level security;
alter table public.alianca_mensagens enable row level security;

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
alter table public.mensagens add column if not exists sigla text;   -- sigla da aliança de quem escreveu
alter table public.mensagens add column if not exists sexo text;     -- para mostrar a classe no feminino
alter table public.mensagens add column if not exists classe2 text;  -- segunda classe de quem escreveu

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
declare d jsonb; pid text; ate timestamptz;
begin
  -- aviso do sistema (ex.: o Chefe Mundial despertou), gravado só por funções do servidor
  if current_setting('tanka.aviso_sistema', true) = '1' then
    new.conta_id := coalesce(auth.uid(), new.conta_id); new.criado_em := now(); return new;
  end if;
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
  select id, dados into pid, d from public.personagens where conta_id = new.conta_id and lower(nome) = lower(new.personagem);
  if d is null then raise exception 'Personagem inválido.'; end if;
  new.sigla := (select a.sigla from public.alianca_membros m join public.aliancas a on a.id = m.alianca_id where m.personagem_id = pid);
  new.personagem := d ->> 'nome';
  new.classe := d ->> 'classe';
  new.classe2 := d -> 'talentos' ->> 'classe2';
  new.sexo := d ->> 'sexo';
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

-- ---------- Esqueci a senha (Henri, nov/2026) ----------
-- O login usa um e-mail interno, então o e-mail de recuperação do Supabase não chega no jogador.
-- Fluxo: o jogador pede com usuário + e-mail do cadastro (senha_pedir); se conferir, o pedido aparece no painel de admin;
-- o admin gera uma senha temporária (admin_senha_temporaria) e manda para o e-mail cadastrado; no próximo login o jogo
-- obriga a trocar a senha (contas.trocar_senha; a troca é pelo /auth/v1/user e depois senha_trocada()).
create extension if not exists pgcrypto with schema extensions;
alter table public.contas add column if not exists trocar_senha boolean not null default false;
create table if not exists public.pedidos_senha (
  id bigint generated always as identity primary key,
  conta_id uuid not null references public.contas (id) on delete cascade,
  criado_em timestamptz not null default now(),
  situacao text not null default 'pendente',   -- pendente | enviada | recusado
  resolvido_em timestamptz,
  resolvido_por uuid
);
create unique index if not exists pedidos_senha_um_pendente on public.pedidos_senha (conta_id) where situacao = 'pendente';
alter table public.pedidos_senha enable row level security;   -- sem regras: só pelas funções abaixo

-- Não diz se o usuário existe nem se o e-mail confere (a resposta é sempre a mesma).
create or replace function public.senha_pedir(u text, e text) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select id into c from public.contas
    where lower(usuario) = lower(trim(coalesce(u, ''))) and lower(email) = lower(trim(coalesce(e, ''))) and not bot;
  if c is null then return; end if;
  if (select count(*) from public.pedidos_senha where situacao = 'pendente') >= 500 then return; end if;
  insert into public.pedidos_senha (conta_id) values (c) on conflict (conta_id) where situacao = 'pendente' do nothing;
end $$;

create or replace function public.admin_pedidos_senha() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só administradores.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', ps.id, 'usuario', c.usuario, 'email', c.email, 'quando', ps.criado_em,
      'personagens', coalesce((select jsonb_agg(pe.nome order by pe.criado_em) from public.personagens pe where pe.conta_id = c.id), '[]'::jsonb))
      order by ps.criado_em)
    from public.pedidos_senha ps join public.contas c on c.id = ps.conta_id where ps.situacao = 'pendente'), '[]'::jsonb);
end $$;

-- Gera a senha temporária (10 letras/números, sem os que confundem), grava no login e devolve para o admin mandar por e-mail.
create or replace function public.admin_senha_temporaria(pedido bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare cid uuid; us text; em text; nova text := ''; alfa text := 'abcdefghjkmnpqrstuvwxyz23456789'; b bytea; i int;
begin
  if not public.eh_admin() then raise exception 'Só administradores.'; end if;
  select ps.conta_id, c.usuario, c.email into cid, us, em
    from public.pedidos_senha ps join public.contas c on c.id = ps.conta_id where ps.id = pedido and ps.situacao = 'pendente';
  if cid is null then raise exception 'Pedido não encontrado (ou já resolvido).'; end if;
  b := extensions.gen_random_bytes(10);
  for i in 0 .. 9 loop nova := nova || substr(alfa, 1 + get_byte(b, i) % length(alfa), 1); end loop;
  update auth.users set encrypted_password = extensions.crypt(nova, extensions.gen_salt('bf')), updated_at = now() where id = cid;
  update public.contas set trocar_senha = true where id = cid;
  update public.pedidos_senha set situacao = 'enviada', resolvido_em = now(), resolvido_por = auth.uid() where id = pedido;
  return jsonb_build_object('usuario', us, 'email', em, 'senha', nova);
end $$;

create or replace function public.admin_recusar_pedido_senha(pedido bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só administradores.'; end if;
  update public.pedidos_senha set situacao = 'recusado', resolvido_em = now(), resolvido_por = auth.uid()
    where id = pedido and situacao = 'pendente';
end $$;

-- Depois de trocar a senha no /auth/v1/user, o jogo tira o aviso de "senha temporária".
create or replace function public.senha_trocada() returns void
language sql security definer set search_path = public as $$
  update public.contas set trocar_senha = false where id = auth.uid();
$$;

revoke execute on function public.senha_pedir(text, text), public.admin_pedidos_senha(), public.admin_senha_temporaria(bigint),
  public.admin_recusar_pedido_senha(bigint), public.senha_trocada() from public;
grant execute on function public.senha_pedir(text, text) to anon, authenticated;
grant execute on function public.admin_pedidos_senha(), public.admin_senha_temporaria(bigint),
  public.admin_recusar_pedido_senha(bigint), public.senha_trocada() to authenticated;

-- Avisa a API do Supabase que as tabelas mudaram (evita o erro "schema cache").
notify pgrst, 'reload schema';

-- ---------- Ranking ----------
-- Top 100 por level (empate: exp) ou por poder. Contas de administrador ficam de fora.
drop function if exists public.ranking(text);   -- a lista de colunas muda às vezes (sigla da aliança, sexo, segunda classe)
create or replace function public.ranking(tipo text) returns table (nome text, classe text, raca text, nivel int, exp bigint, poder bigint, sigla text, sexo text, classe2 text, id text)
language sql stable security definer set search_path = public as $$
  select p.nome, p.dados ->> 'classe', p.dados ->> 'raca',
         coalesce((p.dados ->> 'nivel')::int, 1), coalesce((p.dados ->> 'exp')::bigint, 0), coalesce((p.dados ->> 'poder')::bigint, 0),
         (select a.sigla from public.alianca_membros m join public.aliancas a on a.id = m.alianca_id where m.personagem_id = p.id),
         p.dados ->> 'sexo', p.dados -> 'talentos' ->> 'classe2', p.id
  from public.personagens p join public.contas c on c.id = p.conta_id
  where not c.admin and not c.bot
  order by
    case when tipo = 'poder' then coalesce((p.dados ->> 'poder')::bigint, 0) else coalesce((p.dados ->> 'nivel')::bigint, 1) end desc,
    case when tipo = 'poder' then coalesce((p.dados ->> 'nivel')::bigint, 1) else coalesce((p.dados ->> 'exp')::bigint, 0) end desc,
    p.criado_em
  limit 100;
$$;
revoke execute on function public.ranking(text) from public, anon;
grant execute on function public.ranking(text) to authenticated;

-- Ranking dos clãs (Daniel, nov/2026): os 50 melhores por level do clã (empate: exp do clã e o poder somado dos membros).
create or replace function public.ranking_clas() returns table (id bigint, nome text, sigla text, brasao jsonb, nivel int, exp bigint, membros int, poder bigint, lider text)
language sql stable security definer set search_path = public as $$
  select a.id, a.nome, a.sigla, a.brasao, a.nivel, a.exp,
         count(m.personagem_id)::int,
         coalesce(sum(coalesce((p.dados ->> 'poder')::bigint, 0)), 0)::bigint,
         max(case when m.cargo = 'lider' then p.nome end)
  from public.aliancas a
  left join public.alianca_membros m on m.alianca_id = a.id
  left join public.personagens p on p.id = m.personagem_id
  group by a.id
  order by a.nivel desc, a.exp desc, 8 desc, a.criada_em
  limit 50;
$$;
revoke execute on function public.ranking_clas() from public, anon;
grant execute on function public.ranking_clas() to authenticated;

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
drop function if exists public.amigos_listar(text);   -- a lista de colunas muda às vezes (sigla da aliança, sexo)
create or replace function public.amigos_listar(meu text)
returns table (pedido bigint, situacao text, id text, nome text, classe text, raca text, nivel int, poder bigint, visto_em timestamptz, sigla text, sexo text, classe2 text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  return query
  select a.id,
         case when a.status = 'aceita' then 'amigo' when a.de = meu then 'enviado' else 'recebido' end,
         p.id, p.nome, p.dados ->> 'classe', p.dados ->> 'raca',
         coalesce((p.dados ->> 'nivel')::int, 1), coalesce((p.dados ->> 'poder')::bigint, 0), p.atualizado_em,
         (select al.sigla from public.alianca_membros m join public.aliancas al on al.id = m.alianca_id where m.personagem_id = p.id),
         p.dados ->> 'sexo', p.dados -> 'talentos' ->> 'classe2'
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

-- ---------- Masmorras em grupo (PT de 3) ----------
-- O grupo é de personagens. A luta é calculada no navegador com a semente sorteada aqui
-- (todos calculam a mesma luta); o servidor controla grupo, entradas e recompensas.
create table if not exists public.grupos (
  id bigint generated always as identity primary key,
  lider text not null references public.personagens (id) on delete cascade,
  masmorra text,
  criado_em timestamptz not null default now()
);
create table if not exists public.grupo_membros (
  personagem_id text primary key references public.personagens (id) on delete cascade,
  grupo_id bigint not null references public.grupos (id) on delete cascade,
  pronto boolean not null default false,
  entrou_em timestamptz not null default now()
);
create index if not exists grupo_membros_grupo on public.grupo_membros (grupo_id);
create table if not exists public.grupo_convites (
  id bigint generated always as identity primary key,
  grupo_id bigint not null references public.grupos (id) on delete cascade,
  de text not null references public.personagens (id) on delete cascade,
  para text not null references public.personagens (id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (grupo_id, para)
);
create table if not exists public.masmorra_runs (
  id bigint generated always as identity primary key,
  grupo_id bigint references public.grupos (id) on delete set null,
  lider text not null,
  masmorra text not null,
  semente bigint not null,
  herois jsonb not null,      -- [{ id, dados }] na ordem do grupo
  membros text[] not null,
  estado text not null default 'andamento' check (estado in ('andamento', 'vitoria', 'derrota', 'abandonada')),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);
create table if not exists public.masmorra_entradas (
  personagem_id text not null references public.personagens (id) on delete cascade,
  dia date not null,
  usadas int not null default 0,
  primary key (personagem_id, dia)
);
create table if not exists public.recompensas (
  id bigint generated always as identity primary key,
  personagem_id text not null references public.personagens (id) on delete cascade,
  item jsonb not null,
  origem text,
  criado_em timestamptz not null default now(),
  resgatada boolean not null default false
);
-- Sem regras de acesso direto: tudo passa pelas funções abaixo.
alter table public.grupos enable row level security;
alter table public.grupo_membros enable row level security;
alter table public.grupo_convites enable row level security;
alter table public.masmorra_runs enable row level security;
alter table public.masmorra_entradas enable row level security;
alter table public.recompensas enable row level security;

-- Dia do reset (meia-noite de Brasília).
create or replace function public.dia_jogo() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date; $$;

create or replace function public.masmorra_nivel_min(m text) returns int
language sql immutable as $$
  select case m when 'toca' then 5 when 'ninho' then 10 when 'catacumbas' then 15 when 'biblioteca' then 20
    when 'tumba' then 25 when 'covil' then 30 when 'coracao' then 35 end;
$$;

-- Entradas de masmorra por dia (igual a MASMORRA.entradasPorDia em js/dados.js). Henri, nov/2026: 2 -> 5.
create or replace function public.masmorra_entradas_dia() returns int
language sql immutable as $$ select 5 $$;

create or replace function public.entradas_usadas(pid text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select usadas from public.masmorra_entradas where personagem_id = pid and dia = public.dia_jogo()), 0);
$$;

-- Raridade da joia pela tabela da masmorra (a melhor primeiro); a Sorte aumenta as chances
-- das raridades melhores (+1% relativo por ponto). Mesmas chances de js/dados.js (masmorras).
-- Raridade dos pergaminhos da masmorra: a mesma qualidade dos drops da caçada
-- (DROPS_CACADA.qualidade em dados.js): 70% comum, 22% rara, 7% épica, 1% lendária.
create or replace function public.sortear_raridade_drop() returns text
language plpgsql volatile as $$
declare r numeric := random() * 100;
begin
  if r < 1 then return 'lendaria'; end if;
  if r < 8 then return 'epica'; end if;
  if r < 30 then return 'rara'; end if;
  return 'comum';
end $$;

create or replace function public.sortear_raridade_joia(m text, sorte int) returns text
language plpgsql volatile as $$
declare
  rar text[]; chances numeric[]; r numeric := random() * 100; acum numeric := 0; i int;
begin
  case m
    when 'toca' then rar := array['rara', 'comum']; chances := array[20, 80];
    when 'ninho' then rar := array['epica', 'rara', 'comum']; chances := array[5, 45, 50];
    when 'catacumbas' then rar := array['epica', 'rara']; chances := array[20, 80];
    when 'biblioteca' then rar := array['lendaria', 'epica', 'rara']; chances := array[2, 48, 50];
    when 'tumba' then rar := array['lendaria', 'epica']; chances := array[10, 90];
    when 'covil' then rar := array['lendaria', 'epica']; chances := array[20, 80];
    else rar := array['lendaria', 'epica']; chances := array[35, 65];
  end case;
  for i in 1 .. array_length(rar, 1) - 1 loop
    acum := acum + chances[i];   -- a Sorte não aumenta mais o drop (parâmetro mantido por compatibilidade)
    if r < acum then return rar[i]; end if;
  end loop;
  return rar[array_length(rar, 1)];
end $$;

create or replace function public.meu_grupo(meu text) returns bigint
language sql stable security definer set search_path = public as $$
  select grupo_id from public.grupo_membros where personagem_id = meu;
$$;

-- Tudo que a tela da masmorra precisa, de uma vez.
create or replace function public.grupo_estado(meu text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare g bigint; resultado jsonb;
begin
  perform public.conferir_dono(meu);
  g := public.meu_grupo(meu);
  select jsonb_build_object(
    'entradas', public.entradas_usadas(meu),
    'convites', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'de', pd.nome,
        'membros', (select count(*) from public.grupo_membros gm where gm.grupo_id = c.grupo_id)) order by c.criado_em)
      from public.grupo_convites c join public.personagens pd on pd.id = c.de where c.para = meu), '[]'::jsonb),
    'grupo', case when g is null then null else (select jsonb_build_object('id', gr.id, 'lider', gr.lider, 'masmorra', gr.masmorra,
        'membros', (select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'classe', p.dados ->> 'classe', 'classe2', p.dados -> 'talentos' ->> 'classe2', 'raca', p.dados ->> 'raca',
            'sexo', p.dados ->> 'sexo', 'nivel', coalesce((p.dados ->> 'nivel')::int, 1), 'pronto', gm.pronto,
            'entradas', public.entradas_usadas(p.id), 'visto_em', p.atualizado_em) order by gm.entrou_em)
          from public.grupo_membros gm join public.personagens p on p.id = gm.personagem_id where gm.grupo_id = gr.id),
        'convidados', coalesce((select jsonb_agg(p.nome) from public.grupo_convites c join public.personagens p on p.id = c.para where c.grupo_id = gr.id), '[]'::jsonb))
      from public.grupos gr where gr.id = g) end,
    -- Fila sem grupo (masmorra, quando entrou, quantos esperam a mesma masmorra).
    'fila', (select jsonb_build_object('masmorra', f.masmorra, 'entrou_em', f.entrou_em, 'agora', now(),
        'jogadores', (select count(*) from public.masmorra_fila x where x.masmorra = f.masmorra))
      from public.masmorra_fila f where f.personagem_id = meu),
    -- Última luta da qual este personagem participou (nos últimos 20 minutos).
    'run', (select jsonb_build_object('id', r.id, 'masmorra', r.masmorra, 'semente', r.semente, 'herois', r.herois,
        'estado', r.estado, 'criado_em', r.criado_em, 'lider', r.lider, 'fila', r.grupo_id is null)
      from public.masmorra_runs r where meu = any (r.membros) and r.criado_em > now() - interval '20 minutes'
      order by r.id desc limit 1),
    'recompensas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'item', x.item, 'origem', x.origem) order by x.id)
      from public.recompensas x where x.personagem_id = meu and not x.resgatada), '[]'::jsonb)
  ) into resultado;
  return resultado;
end $$;

-- Convida um amigo. Quem convida sem grupo cria um e vira o líder.
create or replace function public.grupo_convidar(meu text, amigo text) returns void
language plpgsql security definer set search_path = public as $$
declare g bigint;
begin
  perform public.conferir_dono(meu);
  if not exists (select 1 from public.amizades where status = 'aceita' and ((de = meu and para = amigo) or (de = amigo and para = meu))) then
    raise exception 'Só dá para convidar amigos.';
  end if;
  g := public.meu_grupo(meu);
  if g is null then
    delete from public.masmorra_fila where personagem_id = meu;   -- quem monta grupo sai da fila
    insert into public.grupos (lider) values (meu) returning id into g;
    insert into public.grupo_membros (personagem_id, grupo_id) values (meu, g);
  elsif (select lider from public.grupos where id = g) <> meu then
    raise exception 'Só o líder pode convidar.';
  end if;
  if exists (select 1 from public.grupo_membros where personagem_id = amigo and grupo_id = g) then
    raise exception 'Esse amigo já está no grupo.';
  end if;
  if (select count(*) from public.grupo_membros where grupo_id = g) >= 3 then raise exception 'O grupo já está cheio.'; end if;
  insert into public.grupo_convites (grupo_id, de, para) values (g, meu, amigo) on conflict (grupo_id, para) do nothing;
  if not found then raise exception 'Convite já enviado.'; end if;
end $$;

create or replace function public.grupo_responder(meu text, convite bigint, aceitar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare g bigint;
begin
  perform public.conferir_dono(meu);
  select grupo_id into g from public.grupo_convites where id = convite and para = meu;
  if g is null then raise exception 'Convite não encontrado.'; end if;
  delete from public.grupo_convites where id = convite;
  if not aceitar then return; end if;
  if public.meu_grupo(meu) is not null then raise exception 'Saia do seu grupo antes de entrar em outro.'; end if;
  if (select count(*) from public.grupo_membros where grupo_id = g) >= 3 then raise exception 'O grupo já está cheio.'; end if;
  insert into public.grupo_membros (personagem_id, grupo_id) values (meu, g);
  update public.grupo_membros set pronto = false where grupo_id = g;
  delete from public.grupo_convites where para = meu;
  delete from public.masmorra_fila where personagem_id = meu;   -- entrou num grupo: sai da fila   -- os outros convites perdem o sentido
end $$;

-- Sai do grupo. Se era o líder, o mais antigo assume; grupo vazio é apagado.
create or replace function public.grupo_sair_de(pid text) returns void
language plpgsql security definer set search_path = public as $$
declare g bigint; novo text;
begin
  g := public.meu_grupo(pid);
  if g is null then return; end if;
  delete from public.grupo_membros where personagem_id = pid;
  select personagem_id into novo from public.grupo_membros where grupo_id = g order by entrou_em limit 1;
  if novo is null then delete from public.grupos where id = g; return; end if;
  update public.grupos set lider = novo where id = g and lider = pid;
  update public.grupo_membros set pronto = false where grupo_id = g;
end $$;
revoke execute on function public.grupo_sair_de(text) from public, anon, authenticated;

create or replace function public.grupo_sair(meu text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  perform public.grupo_sair_de(meu);
end $$;

create or replace function public.grupo_expulsar(meu text, alvo text) returns void
language plpgsql security definer set search_path = public as $$
declare g bigint;
begin
  perform public.conferir_dono(meu);
  g := public.meu_grupo(meu);
  if g is null or (select lider from public.grupos where id = g) <> meu then raise exception 'Só o líder pode expulsar.'; end if;
  if alvo = meu or public.meu_grupo(alvo) is distinct from g then raise exception 'Esse personagem não está no seu grupo.'; end if;
  perform public.grupo_sair_de(alvo);
end $$;

create or replace function public.grupo_pronto(meu text, pronto boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  update public.grupo_membros set pronto = grupo_pronto.pronto where personagem_id = meu;
end $$;

create or replace function public.grupo_escolher(meu text, masmorra text) returns void
language plpgsql security definer set search_path = public as $$
declare g bigint;
begin
  perform public.conferir_dono(meu);
  g := public.meu_grupo(meu);
  if g is null or (select lider from public.grupos where id = g) <> meu then raise exception 'Só o líder escolhe a masmorra.'; end if;
  if public.masmorra_nivel_min(masmorra) is null then raise exception 'Masmorra inválida.'; end if;
  update public.grupos set masmorra = grupo_escolher.masmorra where id = g;
  update public.grupo_membros set pronto = false where grupo_id = g;
end $$;

-- O líder começa: confere grupo, prontos, level e entradas; sorteia a semente e guarda os heróis.
create or replace function public.masmorra_iniciar(meu text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g bigint; gr public.grupos; minimo int; problema text; run public.masmorra_runs;
begin
  perform public.conferir_dono(meu);
  g := public.meu_grupo(meu);
  select * into gr from public.grupos where id = g;
  if gr.id is null or gr.lider <> meu then raise exception 'Só o líder pode começar.'; end if;
  if gr.masmorra is null then raise exception 'Escolha a masmorra.'; end if;
  if (select count(*) from public.grupo_membros where grupo_id = g) <> 3 then raise exception 'O grupo precisa de 3 personagens.'; end if;
  if exists (select 1 from public.grupo_membros where grupo_id = g and not pronto) then raise exception 'Todos precisam estar prontos.'; end if;
  minimo := public.masmorra_nivel_min(gr.masmorra);
  select string_agg(p.nome, ', ') into problema from public.grupo_membros gm join public.personagens p on p.id = gm.personagem_id
    where gm.grupo_id = g and coalesce((p.dados ->> 'nivel')::int, 1) < minimo;
  if problema is not null then raise exception 'Level mínimo % (abaixo: %).', minimo, problema; end if;
  select string_agg(p.nome, ', ') into problema from public.grupo_membros gm join public.personagens p on p.id = gm.personagem_id
    where gm.grupo_id = g and public.entradas_usadas(p.id) >= public.masmorra_entradas_dia();
  if problema is not null then raise exception 'Sem entradas hoje: %.', problema; end if;
  update public.masmorra_runs set estado = 'abandonada', concluido_em = now()
    where grupo_id = g and estado = 'andamento' and criado_em < now() - interval '10 minutes';
  if exists (select 1 from public.masmorra_runs where grupo_id = g and estado = 'andamento') then
    raise exception 'O grupo já está numa masmorra.';
  end if;
  insert into public.masmorra_runs (grupo_id, lider, masmorra, semente, herois, membros)
  select g, meu, gr.masmorra, floor(random() * 2147483647)::bigint,
         jsonb_agg(jsonb_build_object('id', p.id, 'dados', p.dados) order by gm.entrou_em),
         array_agg(p.id order by gm.entrou_em)
  from public.grupo_membros gm join public.personagens p on p.id = gm.personagem_id where gm.grupo_id = g
  returning * into run;
  update public.grupo_membros set pronto = false where grupo_id = g;
  return jsonb_build_object('id', run.id, 'masmorra', run.masmorra, 'semente', run.semente, 'herois', run.herois,
    'estado', run.estado, 'criado_em', run.criado_em);
end $$;

-- O líder informa o resultado. Vitória: gasta 1 entrada de cada um e cada um ganha 1 joia
-- (colar ou anel) e tem a chance de MASMORRA.pergaminho (dados.js, hoje 90%) de ganhar 1 pergaminho de
-- encantamento. Derrota: não gasta entrada e ninguém ganha nada.
create or replace function public.masmorra_concluir(meu text, run_id bigint, vitoria boolean) returns void
language plpgsql security definer set search_path = public as $$
declare run public.masmorra_runs; pid text; sorte int;
begin
  perform public.conferir_dono(meu);
  select * into run from public.masmorra_runs where id = run_id;
  -- Grupo da fila (sem grupo_id): qualquer jogador da luta pode informar (o primeiro vale).
  if run.id is null or (run.lider <> meu and not (run.grupo_id is null and meu = any (run.membros))) then
    raise exception 'Só o líder informa o resultado.'; end if;
  if run.estado <> 'andamento' then raise exception 'Essa masmorra já terminou.'; end if;
  update public.masmorra_runs set estado = case when vitoria then 'vitoria' else 'derrota' end, concluido_em = now() where id = run_id;
  if not vitoria then return; end if;
  foreach pid in array run.membros loop
    insert into public.masmorra_entradas (personagem_id, dia, usadas) values (pid, public.dia_jogo(), 1)
      on conflict (personagem_id, dia) do update set usadas = public.masmorra_entradas.usadas + 1;
    select coalesce((h -> 'dados' -> 'atributos' ->> 'sor')::int, 0) into sorte
      from jsonb_array_elements(run.herois) h where h ->> 'id' = pid;
    insert into public.recompensas (personagem_id, origem, item) values (pid, run.masmorra, jsonb_build_object(
      'id', substr(md5(random()::text || clock_timestamp()::text), 1, 12),
      'tipo', case when random() < 0.5 then 'colar' else 'anel' end,
      'classe', null, 'raridade', public.sortear_raridade_joia(run.masmorra, sorte), 'encanto', 0));
    if random() * 100 < coalesce((public.tanka_dados() -> 'MASMORRA' ->> 'pergaminho')::numeric, 50) then
      insert into public.recompensas (personagem_id, origem, item) values (pid, run.masmorra, jsonb_build_object(
        'tipo', 'pergaminho', 'raridade', public.sortear_raridade_drop()));
    end if;
  end loop;
end $$;

-- ---------- Fila da masmorra (Henri, nov/2026) ----------
-- Quem está sem grupo entra na fila de uma masmorra. A cada consulta (fila_ping, a cada ~4 s enquanto espera):
-- com 3 jogadores na mesma masmorra, eles entram juntos; se o mais antigo já esperou 30 s, entram os que houver
-- e as vagas são completadas por bots: cópias (mesmo poder) dos jogadores do grupo. Bots não ganham prêmio
-- nem gastam entrada (só os jogadores estão em `membros`). Quem fecha o jogo sai da fila em 20 s sem ping.
create table if not exists public.masmorra_fila (
  personagem_id text primary key references public.personagens (id) on delete cascade,
  masmorra text not null,
  entrou_em timestamptz not null default now(),
  visto_em timestamptz not null default now()
);
create index if not exists masmorra_fila_masmorra on public.masmorra_fila (masmorra, entrou_em);
alter table public.masmorra_fila enable row level security;   -- só pelas funções

-- Monta as lutas que já dá para montar nesta masmorra.
create or replace function public.fila_casar(m text) returns void
language plpgsql security definer set search_path = public as $$
declare ids text[]; n int; i int; k int; herois jsonb; d jsonb; minimo int := public.masmorra_nivel_min(m);
  nomes text[] := array['Mercenário Aldo', 'Mercenária Brisa', 'Mercenário Corvo', 'Mercenária Dália', 'Mercenário Ermo', 'Mercenária Faísca'];
begin
  perform pg_advisory_xact_lock(hashtext('masmorra_fila:' || m));
  delete from public.masmorra_fila where masmorra = m and visto_em < now() - interval '20 seconds';
  -- quem não pode mais entrar (subiu outro grupo, sem entradas, level) sai da fila
  delete from public.masmorra_fila f using public.personagens p where f.personagem_id = p.id and f.masmorra = m
    and (public.entradas_usadas(p.id) >= public.masmorra_entradas_dia() or coalesce((p.dados ->> 'nivel')::int, 1) < minimo or public.meu_grupo(p.id) is not null);
  loop
    select array_agg(personagem_id order by entrou_em) into ids
      from (select personagem_id, entrou_em from public.masmorra_fila where masmorra = m order by entrou_em limit 3) x;
    n := coalesce(array_length(ids, 1), 0);
    exit when n = 0;
    exit when n < 3 and (select min(entrou_em) from public.masmorra_fila where masmorra = m) > now() - interval '30 seconds';
    select jsonb_agg(jsonb_build_object('id', p.id, 'dados', p.dados) order by array_position(ids, p.id)) into herois
      from public.personagens p where p.id = any (ids);
    for i in n + 1 .. 3 loop   -- bots: cópia de um jogador do grupo (mesmo poder), com outro nome
      d := (herois -> ((i - 1) % n)) -> 'dados';
      k := 1 + floor(random() * array_length(nomes, 1))::int;
      d := d || jsonb_build_object('id', 'bot-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10),
        'nome', nomes[k], 'sexo', case when nomes[k] like 'Mercenária%' then 'feminino' else 'masculino' end, 'bot', true);
      herois := herois || jsonb_build_array(jsonb_build_object('id', d ->> 'id', 'dados', d, 'bot', true));
    end loop;
    insert into public.masmorra_runs (grupo_id, lider, masmorra, semente, herois, membros)
      values (null, ids[1], m, floor(random() * 2147483647)::bigint, herois, ids);
    delete from public.masmorra_fila where personagem_id = any (ids);
  end loop;
end $$;
revoke execute on function public.fila_casar(text) from public, anon, authenticated;

create or replace function public.fila_entrar(meu text, masmorra text) returns void
language plpgsql security definer set search_path = public as $$
declare nivel int;
begin
  perform public.conferir_dono(meu);
  if public.masmorra_nivel_min(masmorra) is null then raise exception 'Masmorra inválida.'; end if;
  if public.meu_grupo(meu) is not null then raise exception 'Você já está num grupo: saia dele para usar a fila.'; end if;
  select coalesce((dados ->> 'nivel')::int, 1) into nivel from public.personagens where id = meu;
  if nivel < public.masmorra_nivel_min(masmorra) then raise exception 'Level mínimo %.', public.masmorra_nivel_min(masmorra); end if;
  if public.entradas_usadas(meu) >= public.masmorra_entradas_dia() then raise exception 'Sem entradas hoje.'; end if;
  insert into public.masmorra_fila (personagem_id, masmorra) values (meu, fila_entrar.masmorra)
    on conflict (personagem_id) do update set masmorra = excluded.masmorra, entrou_em = now(), visto_em = now();
  perform public.fila_casar(fila_entrar.masmorra);
end $$;

-- Enquanto espera, o jogo chama a cada poucos segundos: marca que está online e tenta montar a luta.
create or replace function public.fila_ping(meu text) returns void
language plpgsql security definer set search_path = public as $$
declare m text;
begin
  perform public.conferir_dono(meu);
  update public.masmorra_fila set visto_em = now() where personagem_id = meu returning masmorra into m;
  if m is not null then perform public.fila_casar(m); end if;
end $$;

create or replace function public.fila_sair(meu text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  delete from public.masmorra_fila where personagem_id = meu;
end $$;
revoke execute on function public.fila_entrar(text, text), public.fila_ping(text), public.fila_sair(text) from public, anon;
grant execute on function public.fila_entrar(text, text), public.fila_ping(text), public.fila_sair(text) to authenticated;

-- ---------- Chefe Mundial: "O Despertar de Ignaroth" (Henri, nov/2026) ----------
-- Todo dia às 20h (Brasília) Ignaroth desperta por 1 hora, com uma vida só para o reino inteiro.
-- Vida = 50 mil por jogador que jogou nos últimos 3 dias. Cada ataque é uma luta no jogo (contra o chefe da área do
-- herói) e o jogo informa o dano (boss_atacar). Ao cair: cada atacante ganha ouro e exp do chefe da área dele x ataques;
-- top 10 de dano: 5% lendário / 30% épico + 1 pergaminho; golpe final: título "Matador de Dragões"; aliança com mais dano:
-- 1% do dano dela em ouro no tesouro. Se não cair: 70% do ouro e exp + 1 pergaminho garantido para quem atacou.
-- Tudo é calculado na hora em que alguém consulta (boss_estado) ou ataca: não precisa de agendador.
create table if not exists public.boss_mundial (
  id bigint generated always as identity primary key,
  dia date unique,                          -- o despertar diário (null = invocado pelo admin)
  inicio timestamptz not null,
  fim timestamptz not null,
  vida_max bigint not null,
  vida bigint not null,
  estado text not null default 'ativo',     -- ativo | derrotado | dormindo
  golpe_final text,
  derrotado_em timestamptz,
  alianca_vencedora bigint,
  bonus_alianca bigint,
  premiado boolean not null default false
);
create table if not exists public.boss_mundial_dano (
  boss_id bigint not null references public.boss_mundial (id) on delete cascade,
  personagem_id text not null references public.personagens (id) on delete cascade,
  alianca_id bigint,
  dano bigint not null default 0,
  ataques int not null default 0,
  chefe text,                               -- chefe da área do herói no último ataque (base do prêmio)
  ultimo_em timestamptz,
  primary key (boss_id, personagem_id)
);
create index if not exists boss_mundial_dano_rank on public.boss_mundial_dano (boss_id, dano desc);
alter table public.boss_mundial enable row level security;        -- só pelas funções
alter table public.boss_mundial_dano enable row level security;

create or replace function public.boss_cfg() returns jsonb
language sql immutable as $$
  select '{"hora": 20, "minutos": 60, "vidaPorJogador": 50000, "diasAtivos": 3, "intervaloSeg": 15, "danoMaximo": 200000, "entradas": 5,
    "lendaria": 5, "epica": 30, "consolacao": 70, "aliancaPct": 1, "titulo": "Matador de Dragões"}'::jsonb
$$;

-- Vida do despertar: 50 mil por jogador (conta) que jogou nos últimos 3 dias, sem bots nem admins.
create or replace function public.boss_vida_inicial() returns bigint
language sql stable security definer set search_path = public as $$
  select greatest(1, (select count(distinct p.conta_id) from public.personagens p join public.contas c on c.id = p.conta_id
    where p.atualizado_em > now() - make_interval(days => (public.boss_cfg() ->> 'diasAtivos')::int) and not c.bot and not c.admin))
    * (public.boss_cfg() ->> 'vidaPorJogador')::bigint
$$;

-- Entrega os prêmios uma vez só (venceu = derrubaram a tempo).
create or replace function public.boss_premiar(bid bigint, venceu boolean) returns void
language plpgsql security definer set search_path = public as $$
declare b public.boss_mundial; r record; cfg jsonb := public.boss_cfg(); sorte numeric; posicao int := 0; al record;
begin
  select * into b from public.boss_mundial where id = bid for update;
  if b.id is null or b.premiado then return; end if;
  update public.boss_mundial set premiado = true where id = bid;
  for r in select * from public.boss_mundial_dano where boss_id = bid and ataques > 0 order by dano desc, ultimo_em loop
    posicao := posicao + 1;
    insert into public.recompensas (personagem_id, item, origem) values (r.personagem_id,
      jsonb_build_object('tipo', 'boss_premio', 'ataques', r.ataques, 'chefe', r.chefe, 'boss', bid,
        'fator', case when venceu then 100 else (cfg ->> 'consolacao')::int end, 'venceu', venceu), 'boss');
    if not venceu then
      insert into public.recompensas (personagem_id, item, origem) values (r.personagem_id,
        jsonb_build_object('tipo', 'pergaminho', 'raridade', public.sortear_raridade_drop()), 'boss');
    elsif posicao <= 10 then
      sorte := random() * 100;
      if sorte < (cfg ->> 'lendaria')::numeric + (cfg ->> 'epica')::numeric then
        insert into public.recompensas (personagem_id, item, origem) values (r.personagem_id,
          jsonb_build_object('tipo', 'boss_item', 'raridade', case when sorte < (cfg ->> 'lendaria')::numeric then 'lendaria' else 'epica' end), 'boss');
      end if;
      insert into public.recompensas (personagem_id, item, origem) values (r.personagem_id,
        jsonb_build_object('tipo', 'pergaminho', 'raridade', public.sortear_raridade_drop()), 'boss');
    end if;
  end loop;
  if venceu then
    if b.golpe_final is not null then
      insert into public.recompensas (personagem_id, item, origem)
        values (b.golpe_final, jsonb_build_object('tipo', 'titulo', 'nome', cfg ->> 'titulo'), 'boss');
    end if;
    select alianca_id, sum(dano) as total into al from public.boss_mundial_dano
      where boss_id = bid and alianca_id is not null group by alianca_id order by sum(dano) desc limit 1;
    if al.alianca_id is not null then
      update public.aliancas set tesouro = tesouro + floor(al.total * (cfg ->> 'aliancaPct')::numeric / 100)
        where id = al.alianca_id;
      update public.boss_mundial set alianca_vencedora = al.alianca_id,
        bonus_alianca = floor(al.total * (cfg ->> 'aliancaPct')::numeric / 100) where id = bid;
    end if;
  end if;
end $$;

-- Cria o despertar de hoje (a partir das 20h) e encerra o que passou da hora.
create or replace function public.boss_garantir() returns void
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.boss_cfg(); ini timestamptz; v bigint; r record;
begin
  ini := (public.dia_jogo()::timestamp + make_interval(hours => (cfg ->> 'hora')::int)) at time zone 'America/Sao_Paulo';
  if now() >= ini and now() < ini + make_interval(mins => (cfg ->> 'minutos')::int)
     and not exists (select 1 from public.boss_mundial where dia = public.dia_jogo()) then
    v := public.boss_vida_inicial();
    insert into public.boss_mundial (dia, inicio, fim, vida_max, vida)
      values (public.dia_jogo(), ini, ini + make_interval(mins => (cfg ->> 'minutos')::int), v, v)
      on conflict (dia) do nothing;
    if found and auth.uid() is not null then
      perform set_config('tanka.aviso_sistema', '1', true);
      insert into public.mensagens (personagem, classe, nivel, texto)
        values ('Eldrin', 'sistema', 0, 'A terra treme… Ignaroth despertou! Todos à Aventura › Chefe Mundial!');
      perform set_config('tanka.aviso_sistema', '', true);
    end if;
  end if;
  for r in select id from public.boss_mundial where estado = 'ativo' and now() >= fim for update skip locked loop
    update public.boss_mundial set estado = 'dormindo' where id = r.id;
    perform public.boss_premiar(r.id, false);
  end loop;
end $$;

-- O que a tela precisa: o chefe mais recente (ativo ou o último), ranking, o meu dano e os meus prêmios.
create or replace function public.boss_estado(meu text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.boss_mundial; cfg jsonb := public.boss_cfg(); prox timestamptz;
begin
  perform public.conferir_dono(meu);
  perform public.boss_garantir();
  select * into b from public.boss_mundial where inicio <= now() order by inicio desc limit 1;
  prox := (public.dia_jogo()::timestamp + make_interval(hours => (cfg ->> 'hora')::int)) at time zone 'America/Sao_Paulo';
  if prox <= now() then prox := prox + interval '1 day'; end if;
  return jsonb_build_object('agora', now(), 'proximo', prox, 'cfg', cfg,
    'boss', case when b.id is null then null else jsonb_build_object('id', b.id, 'vida', b.vida, 'vida_max', b.vida_max,
      'inicio', b.inicio, 'fim', b.fim, 'estado', b.estado, 'derrotado_em', b.derrotado_em,
      'golpe_final', (select nome from public.personagens where id = b.golpe_final),
      'alianca_vencedora', (select nome from public.aliancas where id = b.alianca_vencedora), 'bonus_alianca', b.bonus_alianca) end,
    'top', coalesce((select jsonb_agg(jsonb_build_object('nome', p.nome, 'dano', d.dano, 'ataques', d.ataques,
        'sigla', (select a.sigla from public.aliancas a where a.id = d.alianca_id), 'eu', d.personagem_id = meu) order by d.dano desc, d.ultimo_em)
      from (select * from public.boss_mundial_dano where boss_id = b.id order by dano desc, ultimo_em limit 10) d
      join public.personagens p on p.id = d.personagem_id), '[]'::jsonb),
    'eu', (select jsonb_build_object('dano', d.dano, 'ataques', d.ataques,
        'posicao', 1 + (select count(*) from public.boss_mundial_dano x where x.boss_id = d.boss_id and x.dano > d.dano))
      from public.boss_mundial_dano d where d.boss_id = b.id and d.personagem_id = meu),
    'aliancas', coalesce((select jsonb_agg(jsonb_build_object('nome', a.nome, 'sigla', a.sigla, 'dano', t.total) order by t.total desc)
      from (select alianca_id, sum(dano) as total from public.boss_mundial_dano where boss_id = b.id and alianca_id is not null
            group by alianca_id order by sum(dano) desc limit 5) t join public.aliancas a on a.id = t.alianca_id), '[]'::jsonb),
    'recompensas', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'item', r.item, 'origem', r.origem) order by r.id)
      from public.recompensas r where r.personagem_id = meu and not r.resgatada and r.origem = 'boss'), '[]'::jsonb));
end $$;

-- Um ataque: o jogo lutou contra o chefe da área do herói e informa o dano. O primeiro a zerar a vida dá o golpe final.
create or replace function public.boss_atacar(meu text, dano int, chefe text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.boss_mundial; cfg jsonb := public.boss_cfg(); d int; ult timestamptz; ali bigint; caiu boolean := false;
begin
  perform public.conferir_dono(meu);
  perform public.boss_garantir();
  select * into b from public.boss_mundial where estado = 'ativo' and now() >= inicio and now() < fim order by inicio desc limit 1 for update;
  if b.id is null then raise exception 'Ignaroth não está acordado agora.'; end if;
  -- no máximo `entradas` ataques por despertar (igual à Arena e à masmorra)
  if (select ataques from public.boss_mundial_dano where boss_id = b.id and personagem_id = meu) >= (cfg ->> 'entradas')::int then
    raise exception 'Você já usou os % ataques deste despertar.', (cfg ->> 'entradas')::int; end if;
  select ultimo_em into ult from public.boss_mundial_dano where boss_id = b.id and personagem_id = meu;
  if ult is not null and ult > now() - make_interval(secs => (cfg ->> 'intervaloSeg')::int) then
    raise exception 'Calma! Espere alguns segundos entre um ataque e outro.'; end if;
  d := least(greatest(coalesce(dano, 0), 0), (cfg ->> 'danoMaximo')::int);
  select alianca_id into ali from public.alianca_membros where personagem_id = meu;
  insert into public.boss_mundial_dano (boss_id, personagem_id, alianca_id, dano, ataques, chefe, ultimo_em)
    values (b.id, meu, ali, d, 1, chefe, now())
    on conflict (boss_id, personagem_id) do update set dano = boss_mundial_dano.dano + d, ataques = boss_mundial_dano.ataques + 1,
      alianca_id = excluded.alianca_id, chefe = excluded.chefe, ultimo_em = now();
  update public.boss_mundial set vida = greatest(0, vida - d) where id = b.id returning * into b;
  if b.vida = 0 then
    update public.boss_mundial set estado = 'derrotado', golpe_final = meu, derrotado_em = now() where id = b.id;
    perform public.boss_premiar(b.id, true);
    caiu := true;
  end if;
  return jsonb_build_object('dano', d, 'vida', b.vida, 'vida_max', b.vida_max, 'caiu', caiu, 'golpe_final', caiu);
end $$;

-- Admin: invoca Ignaroth agora (para testar) com a vida pedida (null = a do despertar), por `minutos`.
create or replace function public.admin_boss_invocar(meu text, vida bigint, minutos int) returns void
language plpgsql security definer set search_path = public as $$
declare v bigint := coalesce(vida, public.boss_vida_inicial());
begin
  perform public.conferir_dono(meu);
  if not public.eh_admin() then raise exception 'Só administradores.'; end if;
  update public.boss_mundial set estado = 'dormindo' where estado = 'ativo';
  insert into public.boss_mundial (dia, inicio, fim, vida_max, vida)
    values (null, now(), now() + make_interval(mins => greatest(1, coalesce(minutos, 60))), v, v);
end $$;

revoke execute on function public.boss_cfg(), public.boss_vida_inicial(), public.boss_premiar(bigint, boolean),
  public.boss_garantir() from public, anon, authenticated;
revoke execute on function public.boss_estado(text), public.boss_atacar(text, int, text),
  public.admin_boss_invocar(text, bigint, int) from public, anon;
grant execute on function public.boss_estado(text), public.boss_atacar(text, int, text),
  public.admin_boss_invocar(text, bigint, int) to authenticated;

-- ---------- Caçada no servidor (plano anti-trapaça, etapa 1) ----------
-- Bônus do clã para a Edge Function `cacada`: as skills (para R.bonusCla) e o bônus de 7 dias de exp/ouro, direto do
-- banco (o navegador não escolhe o próprio bônus). Sem clã: { cla: null, exp: 0, ouro: 0 }.
create or replace function public.cacada_bonus(meu text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.aliancas; pct int;
begin
  perform public.conferir_dono(meu);
  select x.* into a from public.alianca_membros m join public.aliancas x on x.id = m.alianca_id where m.personagem_id = meu;
  if a.id is null then return jsonb_build_object('cla', null, 'exp', 0, 'ouro', 0); end if;
  pct := public.alianca_bonus_pct(a.nivel);
  return jsonb_build_object(
    'cla', jsonb_build_object('id', a.id, 'skills', coalesce((select jsonb_object_agg(k.skill, k.nivel) from public.alianca_skills k where k.alianca_id = a.id), '{}'::jsonb)),
    'exp', case when a.bonus_exp_ate > now() then pct else 0 end,
    'ouro', case when a.bonus_ouro_ate > now() then pct else 0 end);
end $$;
revoke execute on function public.cacada_bonus(text) from public, anon;
grant execute on function public.cacada_bonus(text) to authenticated;

-- Pega uma recompensa (o jogo coloca na mochila e salva).
create or replace function public.recompensa_resgatar(meu text, recompensa bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  perform public.conferir_dono(meu);
  update public.recompensas set resgatada = true where id = recompensa and personagem_id = meu and not resgatada returning item into it;
  if it is null then raise exception 'Recompensa não encontrada.'; end if;
  return it;
end $$;

-- Admin: zera as entradas de hoje do próprio personagem.
create or replace function public.masmorra_admin_recarregar(meu text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  if not public.eh_admin() then raise exception 'Só administradores.'; end if;
  delete from public.masmorra_entradas where personagem_id = meu and dia = public.dia_jogo();
end $$;

revoke execute on function public.dia_jogo(), public.masmorra_nivel_min(text), public.entradas_usadas(text),
  public.sortear_raridade_joia(text, int), public.meu_grupo(text) from public, anon;
revoke execute on function public.grupo_estado(text), public.grupo_convidar(text, text), public.grupo_responder(text, bigint, boolean),
  public.grupo_sair(text), public.grupo_expulsar(text, text), public.grupo_pronto(text, boolean), public.grupo_escolher(text, text),
  public.masmorra_iniciar(text), public.masmorra_concluir(text, bigint, boolean), public.recompensa_resgatar(text, bigint),
  public.masmorra_admin_recarregar(text) from public, anon;
grant execute on function public.grupo_estado(text), public.grupo_convidar(text, text), public.grupo_responder(text, bigint, boolean),
  public.grupo_sair(text), public.grupo_expulsar(text, text), public.grupo_pronto(text, boolean), public.grupo_escolher(text, text),
  public.masmorra_iniciar(text), public.masmorra_concluir(text, bigint, boolean), public.recompensa_resgatar(text, bigint),
  public.masmorra_admin_recarregar(text) to authenticated;


-- >>> DADOS DO JOGO (gerado por ferramentas/gerar_dados_sql.js a partir de js/dados.js; não editar à mão)
create or replace function public.tanka_dados() returns jsonb
language sql immutable as $dados$ select '{"HP_INICIAL":100,"HP_POR_NIVEL":10,"HP_POR_RES":3,"RES_SEM_VIDA":10,"VELOCIDADE":{"inicial":15,"porNivel":1.06},"racas":{"humano":{"tracos":{}},"elfo":{"tracos":{"critico":5,"velocidadePct":10,"vidaPct":-10,"danoPct":-10}},"elfoNegro":{"tracos":{"danoCritico":10,"danoPct":5,"vidaPct":-10}},"orc":{"tracos":{"vidaPct":20,"danoPct":10,"critico":-5,"velocidadePct":-10,"evasaoPct":-50}},"anao":{"tracos":{"vidaPct":10,"danoPct":5,"critico":-3,"velocidadePct":-5}}},"classesAtributos":{"cavaleiro":{"for":15,"des":10,"res":20,"int":10,"sor":15},"arqueiro":{"for":15,"des":20,"res":10,"int":10,"sor":15},"mago":{"for":10,"des":15,"res":10,"int":20,"sor":15},"artesao":{"for":15,"des":10,"res":15,"int":10,"sor":20}},"raridades":{"comum":{"danoMin":[1,5],"danoMax":[5,10]},"rara":{"danoMin":[11,15],"danoMax":[16,20]},"epica":{"danoMin":[21,24],"danoMax":[25,30]},"lendaria":{"danoMin":[31,34],"danoMax":[35,40]}},"classes":{"cavaleiro":{"dano":"fisico","atributoDano":"for"},"arqueiro":{"dano":"fisico","atributoDano":"des"},"mago":{"dano":"magico","atributoDano":"int"},"artesao":{"dano":"fisico","atributoDano":"for"}},"PONTOS_POR_DANO":3,"TIPOS_ARMA":{"espada":{"vel":"normal","fator":1},"espada2m":{"vel":"devagar","fator":1.4},"machado":{"vel":"normal","fator":1},"arco":{"vel":"normal","fator":1},"besta":{"vel":"devagar","fator":1.25},"balestra":{"vel":"normal","fator":1.12},"adaga":{"vel":"rapida","fator":0.83},"livro":{"vel":"normal","fator":1},"cajado":{"vel":"devagar","fator":1.4},"varinha":{"vel":"normal","fator":1},"martelo":{"vel":"normal","fator":1},"martelo2m":{"vel":"devagar","fator":1.4},"maca":{"vel":"normal","fator":1},"mangual":{"vel":"normal","fator":1},"machado2m":{"vel":"devagar","fator":1.4},"garra":{"vel":"rapida","fator":0.83},"cetro":{"vel":"normal","fator":1},"foice":{"vel":"rapida","fator":0.83},"picareta":{"vel":"normal","fator":1}},"VELOCIDADE_ARMA":{"devagar":0.8,"normal":1,"rapida":1.2},"ARMA_PADRAO":{"cavaleiro":"espada","arqueiro":"arco","mago":"cajado","artesao":"martelo"},"RARIDADE_ARMA":{"atributo":[0,2,4,6],"pve":[0,0,10,10],"pvp":[0,0,0,10]},"MAO_ESQUERDA":{"escudo":{"bonus":{"defesaPct":[6,10,13,16],"vidaPct":[3,5,7,9]},"encanto":"defesaPct"},"aljava":{"bonus":{"danoPct":[4,7,10,14],"critico":[1,2,3,5]},"encanto":"danoPct"},"orbe":{"bonus":{"danoMagico":[4,7,10,14],"danoCriticoMagico":[5,10,15,20]},"encanto":"danoMagico"},"manopla":{"bonus":{"defesa":[1,3,6,12],"danoPct":[4,7,10,14]},"encanto":"danoPct"},"livro":{"bonus":{"int":[1,2,4,8],"danoMagico":[4,7,10,14]},"encanto":"danoMagico"},"adaga":{"bonus":{"dano":[2,5,10,16],"critico":[1,2,3,5]},"encanto":"dano"},"garra":{"bonus":{"dano":[3,6,12,18]},"encanto":"dano"},"shuriken":{"bonus":{"dano":[1,3,6,10],"critico":[2,4,6,10]},"encanto":"critico"}},"armaduras":{"cavaleiro":{"elmo":{"bonus":{"defesa":[2,5,10,20],"vida":[10,25,60,150]}},"peitoral":{"bonus":{"defesa":[3,8,16,32],"vida":[15,40,100,250]}},"luvas":{"bonus":{"defesa":[1,3,6,12],"for":[1,2,4,8]}},"botas":{"bonus":{"defesa":[1,3,6,12],"res":[1,2,4,8]}}},"arqueiro":{"elmo":{"bonus":{"defesa":[1,3,6,12],"des":[1,2,4,8]}},"peitoral":{"bonus":{"defesa":[2,5,10,20],"vida":[10,25,60,150]}},"luvas":{"bonus":{"defesa":[1,2,4,8],"des":[1,2,4,8]}},"botas":{"bonus":{"defesa":[1,2,4,8],"sor":[1,2,4,8]}}},"mago":{"elmo":{"bonus":{"defesa":[1,3,6,12],"defesaMagica":[2,5,10,20],"int":[1,2,4,8]}},"peitoral":{"bonus":{"defesa":[1,3,6,12],"defesaMagica":[2,5,10,20],"vida":[5,15,40,100]}},"luvas":{"bonus":{"defesa":[1,2,4,8],"int":[1,2,4,8]}},"botas":{"bonus":{"defesa":[1,2,4,8],"des":[1,2,4,8]}}},"artesao":{"elmo":{"bonus":{"defesa":[2,4,8,16],"vida":[5,15,40,100]}},"peitoral":{"bonus":{"defesa":[2,5,10,20],"vida":[10,25,60,150]}},"luvas":{"bonus":{"defesa":[1,2,4,8],"for":[1,2,4,8]}},"botas":{"bonus":{"defesa":[1,2,4,8],"sor":[1,2,4,8]}}}},"joias":{"colar":{"bonus":{"defesaMagica":[1,3,6,12],"vida":[5,15,40,100]}},"anel":{"bonus":{"dano":[1,2,3,4],"defesaMagica":[0,2,4,6],"vida":[0,0,0,30]}}},"bonusPorNivel":{"elmo":"defesa","peitoral":"defesa","luvas":"defesa","botas":"defesa","colar":"defesaMagica","anel":"dano"},"encantoPct":5,"ARENA":{"nivelMin":5,"entradasMax":5,"recargaMinutos":60,"alcanceDesafio":5,"tempoDado":5,"limiteTurnos":200,"reputacaoVitoria":10,"reputacaoTop1Diario":500,"jackpotPorDefesa":100,"top1PorHora":0.1,"dado":[0,0.6,0.7,0.8,0.9,1,1.05,1.1,1.15,1.2,1.25,1.3,1.35,1.4,1.45,1.5,1.55,1.7,1.8,2],"saque":{"ate":30,"minimo":5,"desde":80,"maximo":10,"meio":[5,8]},"arenas":[{"id":"a1","nome":"Arena 5~10","nivel":[5,10],"jackpotPor10min":50},{"id":"a2","nome":"Arena 11~20","nivel":[11,20],"jackpotPor10min":100},{"id":"a3","nome":"Arena 21~30","nivel":[21,30],"jackpotPor10min":150},{"id":"a4","nome":"Arena 30+","nivel":[31,40],"jackpotPor10min":200}]},"ALIANCA":{"nivelMin":10,"custoOuro":6000,"custoReputacao":100,"vagasIniciais":15,"vagasPorNivel":3,"maxOficiais":3,"nivelMax":10,"expProximo":[50000,100000,200000,400000,700000,1000000,1500000,2000000,3000000],"doacaoMinima":100,"esperaHoras":24,"liderSumidoDias":14,"ativoDias":3,"muralMax":300,"bonus":{"custo":20000,"dias":7,"minimo":5,"maximo":15},"doacaoMaxDia":3000,"skillPrecos":[25000,40000,65000,100000,150000,225000,325000,475000,700000,1000000],"skills":[{"id":"exp","nome":"Sabedoria","simbolo":"📖","porNivel":2,"unidade":"% de exp","descricao":"Mais exp na caçada."},{"id":"ouro","nome":"Cofre Cheio","simbolo":"💰","porNivel":2,"unidade":"% de ouro","descricao":"Mais ouro na caçada."},{"id":"dano","nome":"Fúria do Clã","simbolo":"⚔","porNivel":1.5,"unidade":"% de dano","descricao":"Mais dano contra monstros."},{"id":"critico","nome":"Olho de Águia","simbolo":"🎯","porNivel":0.5,"unidade":"% de chance de crítico","descricao":"Mais chance de acerto crítico."},{"id":"danoCritico","nome":"Golpe Brutal","simbolo":"💥","porNivel":3,"unidade":"% de dano crítico","descricao":"Críticos mais fortes."},{"id":"resistencia","nome":"Muralha","simbolo":"🛡","porNivel":2,"unidade":"% de defesa","descricao":"Mais defesa e defesa mágica."},{"id":"vida","nome":"Vigor","simbolo":"❤","porNivel":2,"unidade":"% de vida","descricao":"Mais vida máxima contra monstros."},{"id":"velocidade","nome":"Passo Ligeiro","simbolo":"💨","porNivel":1,"unidade":"% de velocidade","descricao":"Ataca mais vezes."},{"id":"esquiva","nome":"Sombra Ágil","simbolo":"🌀","porNivel":0.5,"unidade":"% de esquiva","descricao":"Desvia de mais golpes."},{"id":"fortuna","nome":"Fortuna","simbolo":"🍀","porNivel":2,"unidade":"% de chance de drop","descricao":"Mais chance de itens caírem."}],"missoesOuroPorNivel":0.2,"missoes":{"diarias":[{"tipo":"monstros","meta":1000,"ouro":3000,"nome":"Caçar 1.000 monstros"},{"tipo":"encantar","meta":50,"ouro":2000,"nome":"Encantar 50 vezes"},{"tipo":"arena","meta":50,"ouro":2000,"nome":"Lutar 50 vezes na Arena"},{"tipo":"masmorra","meta":10,"ouro":2500,"nome":"Vencer 10 masmorras"}],"semanais":[{"tipo":"monstros","meta":15000,"ouro":20000,"buff":2.5,"nome":"Caçar 15.000 monstros"},{"tipo":"encantar","meta":500,"ouro":15000,"buff":2.5,"nome":"Encantar 500 vezes"},{"tipo":"arena","meta":400,"ouro":15000,"buff":2.5,"nome":"Lutar 400 vezes na Arena"},{"tipo":"bossCla","meta":4,"ouro":25000,"buff":2.5,"nome":"Derrotar o boss do clã 4 vezes"}]},"missoesMaxEnvio":{"monstros":300,"encantar":40,"arena":10,"masmorra":5},"brasao":{"formas":["classico","redondo","pontudo","estandarte"],"cores":["#8e1b1b","#1f4f8e","#2d6b34","#5b2a86","#b8860b","#2b2b2b","#7a3e12","#1f6b6b"],"simbolos":["dragao","lobo","coroa","caveira","espada","machado","olho","chama"]}},"CONJUNTOS":{"paladino":{"bonus":{"2":{"defesa":23},"3":{"dano":5},"4":{"vida":30}}},"destruidor":{"bonus":{"2":{"for":5},"3":{"dano":5},"4":{"velocidade":2}}},"cacador":{"bonus":{"2":{"critico":5},"3":{"dano":5},"4":{"velocidade":3}}},"assassino":{"bonus":{"2":{"evasao":5},"3":{"dano":5},"4":{"velocidade":3}}},"bruxo":{"bonus":{"2":{"criticoMagico":5},"3":{"dano":5},"4":{"velocidade":3}}},"curandeiro":{"bonus":{"2":{"criticoMagico":5},"3":{"dano":5},"4":{"velocidade":3}}},"ferreiro":{"bonus":{"2":{"defesa":23},"3":{"dano":5},"4":{"vida":30}}},"coletor":{"bonus":{"2":{"defesa":23},"3":{"dano":5},"4":{"vida":30}}}},"LEILAO":{"nivelMin":10,"duracaoMin":240,"incrementoPct":5,"muitoCurto":[1,4],"fases":[{"id":"muitoLongo","nome":"Muito longo","acimaMin":180},{"id":"longo","nome":"Longo","acimaMin":60},{"id":"medio","nome":"Médio","acimaMin":20},{"id":"curto","nome":"Curto","acimaMin":0}],"nomeMuitoCurto":"Muito curto","minimo":{"comum":1000,"rara":5000,"epica":10000,"lendaria":50000},"pacotePergaminho":{"comum":10,"rara":5,"epica":3,"lendaria":1},"faixas":[{"id":"l1","nome":"Leilão do Mercador","nivel":[10,19],"mult":1,"itemNivel":[18,22],"raridades":{"comum":30,"rara":45,"epica":22,"lendaria":3}},{"id":"l2","nome":"Leilão da Coroa","nivel":[20,29],"mult":10,"itemNivel":[28,32],"raridades":{"comum":15,"rara":45,"epica":32,"lendaria":8}},{"id":"l3","nome":"Leilão dos Reis","nivel":[30,999],"mult":40,"itemNivel":[42,50],"raridades":{"comum":0,"rara":35,"epica":45,"lendaria":20}}]},"MASMORRA":{"pergaminho":90},"DEFESA":{"k":100,"fator":4.5},"TALENTOS":{"nivelSegunda":10,"pontosIniciais":4,"pontosPorNivel":1,"maxPorHabilidade":10,"pontosDepois":{"nivel":20,"porNivel":2},"unico":{"base":150,"porPonto":5},"unicoReduzido":{"base":120,"porPonto":4},"area":{"base":80,"porPonto":3},"areaReduzida":{"base":60,"porPonto":3},"atordoar":{"base":100,"porPonto":5},"multiplo":{"base":100,"porPonto":3},"bonusPorPonto":1,"atordoarChefeMax":1,"curaSoAbaixo":80},"HABILIDADE_INICIAL":{"cavaleiro":{"id":"espada-giratoria","nome":"Espada Giratória","tipo":"unico","recarga":3,"descricao":"Gira a espada e acerta um inimigo com força."},"arqueiro":{"id":"chuva-de-flechas","nome":"Chuva de Flechas","tipo":"unico","recarga":3,"descricao":"Uma chuva de flechas sobre um inimigo."},"mago":{"id":"meteoro","nome":"Meteoro","tipo":"unico","recarga":3,"descricao":"Uma pedra de fogo cai sobre um inimigo."},"artesao":{"id":"tremor","nome":"Tremor","tipo":"unico","recarga":3,"descricao":"Bate no chão e faz a terra tremer sob um inimigo."}},"SEGUNDAS_CLASSES":{"paladino":{"de":"cavaleiro","nome":"Paladino","nomeF":"Paladina","descricao":"Protege o grupo: atordoa, chama os ataques para si e aguenta firme.","habilidades":[{"id":"martelo-sagrado","nome":"Martelo Sagrado","tipo":"area","atordoa":1,"recarga":5,"descricao":"Dano em área e atordoa todos os inimigos."},{"id":"grito-de-desafio","nome":"Grito de Desafio","tipo":"provocar","turnos":2,"defesaPct":10,"recarga":4,"descricao":"Todos os inimigos atacam só você e sua defesa sobe."},{"id":"golpe-justo","nome":"Golpe Justo","tipo":"unico","recarga":2,"descricao":"Um golpe forte em um inimigo."},{"id":"pele-de-ferro","nome":"Pele de Ferro","tipo":"passiva","defesaPct":10,"vidaPct":10,"descricao":"Mais defesa e mais vida, sempre."},{"id":"aura-sagrada","nome":"Aura Sagrada","tipo":"passiva","nivel":20,"foco":"cacada","regenPct":[0.6,0.06],"descricao":"Recupera 0,66% da vida máxima a cada turno. Mais forte na caçada."},{"id":"defesa-suprema","nome":"Defesa Suprema","tipo":"reforco","nivel":30,"foco":"arena","turnos":2,"recarga":5,"defesaPct":[30,2],"reflete":15,"descricao":"+30% a +50% de defesa por 2 turnos e devolve 15% do dano recebido. Mais forte na Arena."}]},"destruidor":{"de":"cavaleiro","nome":"Destruidor","nomeF":"Destruidora","descricao":"Pura força: entra em fúria e derruba tudo.","habilidades":[{"id":"furia","nome":"Fúria","tipo":"reforco","turnos":2,"dano":10,"danoCritico":10,"recarga":4,"descricao":"Mais dano e mais dano crítico."},{"id":"terremoto","nome":"Terremoto","tipo":"area","recarga":3,"descricao":"Dano em área."},{"id":"golpe-pesado","nome":"Golpe Pesado","tipo":"unico","recarga":3,"descricao":"Um golpe muito forte em um inimigo."},{"id":"forca-bruta","nome":"Força Bruta","tipo":"passiva","atributos":{"for":5},"danoCritico":10,"descricao":"+5 de Força e mais dano crítico, sempre."},{"id":"sede-de-sangue","nome":"Sede de Sangue","tipo":"passiva","nivel":20,"foco":"cacada","rouboVida":[4,1],"descricao":"5% do dano que você causa vira vida. Mais forte na caçada."},{"id":"golpe-apocaliptico","nome":"Golpe Apocalíptico","tipo":"unico","nivel":30,"foco":"arena","recarga":5,"mult":[200,5],"vidaFaltando":0.5,"descricao":"Golpe de 200% a 250%, +0,5% de dano para cada 1% de vida que falta. Mais forte na Arena."}]},"cacador":{"de":"arqueiro","nome":"Arqueiro","nomeF":"Arqueira","descricao":"Controla a luta de longe: prende, dispara e corre.","habilidades":[{"id":"flecha-na-perna","nome":"Flecha na Perna","tipo":"atordoar","atordoa":2,"recarga":5,"descricao":"Acerta um inimigo e ele fica parado."},{"id":"saraivada","nome":"Saraivada","tipo":"area","recarga":3,"descricao":"Dano em área."},{"id":"pes-ligeiros","nome":"Double Shot","tipo":"multiplo","flechas":2,"recarga":3,"descricao":"Atira duas flechas no mesmo turno, cada uma com o dano de um ataque básico."},{"id":"reflexo-rapido","nome":"Reflexo Rápido","tipo":"passiva","atributos":{"des":5},"evasao":5,"descricao":"+5 de Destreza e mais esquiva, sempre."},{"id":"flecha-envenenada","nome":"Flecha Envenenada","tipo":"dot","nivel":20,"foco":"cacada","recarga":4,"turnos":3,"dotPct":[90,5],"curaMorte":5,"pula":true,"descricao":"Veneno de 90% a 140% de um ataque por turno, por 3 turnos. Pula para outro monstro; cada monstro morto pelo veneno cura 5%."},{"id":"tiro-silenciador","nome":"Tiro Silenciador","tipo":"unico","nivel":30,"foco":"arena","recarga":6,"mult":[180,0],"ignoraDefesaPct":50,"silencia":1,"descricao":"Golpe de 180% que ignora metade da defesa e cala o oponente por 1 turno. Mais forte na Arena."}]},"assassino":{"de":"arqueiro","nome":"Assassino","nomeF":"Assassina","descricao":"Some nas sombras e volta com golpes críticos.","habilidades":[{"id":"mira-certeira","nome":"Mira Certeira","tipo":"reforco","turnos":2,"critico":5,"danoCritico":5,"recarga":4,"descricao":"Mais chance e mais dano crítico."},{"id":"sombra","nome":"Sombra","tipo":"furtivo","danoCritico":0,"recarga":4,"descricao":"Esquiva do próximo ataque e o seu próximo golpe é crítico."},{"id":"golpe-fatal","nome":"Golpe Fatal","tipo":"unico","recarga":3,"descricao":"Um golpe enorme em um inimigo."},{"id":"lamina-afiada","nome":"Lâmina Afiada","tipo":"passiva","atributos":{"des":5},"critico":10,"descricao":"+5 de Destreza e mais chance de crítico, sempre."},{"id":"corte-vampirico","nome":"Corte Vampírico","tipo":"dot","nivel":20,"foco":"cacada","recarga":4,"turnos":3,"dotPct":[40,4],"curaDot":20,"descricao":"Sangramento de 40% a 80% de um ataque por turno, por 3 turnos; você recupera 20% do que ele tira."},{"id":"execucao","nome":"Execução","tipo":"unico","nivel":30,"foco":"arena","recarga":5,"mult":[250,0],"garantido":true,"semEsquiva":true,"executa":{"abaixo":30,"bonus":50},"descricao":"Golpe de 250%, sempre no máximo do dado, que não pode ser esquivado. +50% se o oponente tiver menos de 30% da vida. Mais forte na Arena."}]},"bruxo":{"de":"mago","nome":"Bruxo","nomeF":"Bruxa","descricao":"Magia de destruição: congela, queima e fulmina.","habilidades":[{"id":"nevasca","nome":"Nevasca","tipo":"area","atordoa":2,"congela":true,"recarga":5,"descricao":"Dano em área e congela todos os inimigos."},{"id":"chuva-de-meteoros","nome":"Chuva de Meteoros","tipo":"area","recarga":3,"descricao":"Dano em área."},{"id":"raio-da-morte","nome":"Raio da Morte","tipo":"unico","recarga":2,"descricao":"Um raio forte em um inimigo."},{"id":"mente-sombria","nome":"Mente Sombria","tipo":"passiva","atributos":{"int":5},"dano":10,"descricao":"+5 de Inteligência e mais dano, sempre."},{"id":"escudo-de-gelo","nome":"Escudo de Gelo","tipo":"escudo","nivel":20,"foco":"cacada","recarga":5,"turnos":3,"escudoPct":[10,1],"congelaChance":30,"descricao":"Escudo que segura dano (10% a 20% da vida) por 3 turnos; quem bate nele tem 30% de chance de congelar."},{"id":"maldicao-de-ignaroth","nome":"Maldição de Ignaroth","tipo":"unico","nivel":30,"foco":"arena","recarga":5,"mult":[200,0],"queima":{"turnos":3,"pct":15},"cortaCura":50,"descricao":"Golpe de 200% que queima por 3 turnos e corta pela metade as curas do oponente. Mais forte na Arena."}]},"curandeiro":{"de":"mago","nome":"Curandeiro","nomeF":"Curandeira","descricao":"Cuida do grupo: cura, fortalece e ainda castiga.","habilidades":[{"id":"luz-que-cura","nome":"Luz que Cura","tipo":"cura","vidaPct":20,"recarga":4,"descricao":"Cura todo o grupo (% da vida máxima). Na caçada, vira dano no monstro."},{"id":"explosao-de-luz","nome":"Explosão de Luz","tipo":"area","recarga":3,"descricao":"Dano em área."},{"id":"bencao","nome":"Bênção","tipo":"reforco","grupo":true,"turnos":2,"vidaPct":20,"precisao":5,"recarga":4,"descricao":"Mais vida máxima e precisão para você e o grupo."},{"id":"fe-profunda","nome":"Fé Profunda","tipo":"passiva","atributos":{"int":5},"danoCriticoMagico":10,"descricao":"+5 de Inteligência e mais dano crítico mágico, sempre."},{"id":"regeneracao","nome":"Regeneração","tipo":"passiva","nivel":20,"foco":"cacada","regenPct":[1,0.1],"descricao":"Recupera 1,1% da vida máxima a cada turno. Mais forte na caçada."},{"id":"milagre","nome":"Milagre","tipo":"passiva","nivel":30,"foco":"arena","milagrePct":[20,1],"descricao":"Uma vez por luta, se cair, volta com 21% da vida. Mais forte na Arena."}]},"ferreiro":{"de":"artesao","nome":"Ferreiro","nomeF":"Ferreira","descricao":"Mão pesada e couro grosso.","habilidades":[{"id":"marretada-no-chao","nome":"Marretada no Chão","tipo":"area","recarga":3,"descricao":"Dano em área."},{"id":"martelada","nome":"Martelada","tipo":"unico","recarga":2,"descricao":"Um golpe forte em um inimigo."},{"id":"pancada-tonta","nome":"Pancada Tonta","tipo":"atordoar","atordoa":2,"recarga":5,"descricao":"Acerta um inimigo e ele fica tonto."},{"id":"couro-grosso","nome":"Couro Grosso","tipo":"passiva","atributos":{"sor":5},"defesaPct":20,"descricao":"+5 de Sorte e mais defesa, sempre."},{"id":"tempera-de-fogo","nome":"Têmpera de Fogo","tipo":"passiva","nivel":20,"foco":"cacada","reducaoDano":[10,1],"danoExtraPct":[20,1.5],"descricao":"Recebe 11% menos dano e causa 21,5% mais dano. Mais forte na caçada."},{"id":"martelo-das-correntes","nome":"Martelo das Correntes","tipo":"unico","nivel":30,"foco":"arena","recarga":5,"mult":[220,0],"atordoa":1,"quebraDefesaPct":30,"descricao":"Golpe de 220% que prende o oponente por 1 turno e tira 30% da defesa dele até o fim da luta. Mais forte na Arena."}]},"coletor":{"de":"artesao","nome":"Coletor","nomeF":"Coletora","descricao":"Bate menos, mas sai de toda luta com o bolso cheio.","habilidades":[{"id":"chuva-de-pedras","nome":"Chuva de Pedras","tipo":"area","reduzido":true,"recarga":3,"descricao":"Dano em área (mais fraco)."},{"id":"pedrada","nome":"Pedrada","tipo":"unico","reduzido":true,"recarga":2,"descricao":"Um golpe em um inimigo (mais fraco)."},{"id":"rede","nome":"Rede","tipo":"atordoar","atordoa":2,"recarga":5,"descricao":"Joga a rede em um inimigo e ele fica preso."},{"id":"bolso-fundo","nome":"Bolso Fundo","tipo":"passiva","recompensa":10,"descricao":"Mais ouro e exp em cada luta da caçada."},{"id":"bolso-de-pocoes","nome":"Bolso de Poções","tipo":"passiva","nivel":20,"foco":"cacada","curaEmergencia":[35,2],"limiar":40,"descricao":"Uma vez por luta, quando a vida cai abaixo de 40%, recupera 37% da vida. Mais forte na caçada."},{"id":"po-nos-olhos","nome":"Pó nos Olhos","tipo":"cegar","nivel":30,"foco":"arena","recarga":6,"turnos":2,"erroPct":30,"descricao":"Por 2 turnos, o oponente tem 30% de chance de errar cada ataque. Mais forte na Arena."}]}},"CRAFT":{"materiais":{"ferro":{"nome":"Minério de Ferro","area":"floresta"},"nevoa":{"nome":"Essência de Névoa","area":"pantano"},"osso":{"nome":"Osso Rúnico","area":"ruinas"},"carmesim":{"nome":"Cristal Carmesim","area":"torre"},"areia":{"nome":"Areia Rubra","area":"areias"},"couro":{"nome":"Couro de Drake","area":"vale"},"brasa":{"nome":"Brasa Vulcânica","area":"cume"},"seiva":{"nome":"Seiva Ancestral","chefe":"velgrath"},"lagrima":{"nome":"Lágrima da Bruxa","chefe":"morgath"},"po":{"nome":"Pó de Lich","chefe":"varnok"},"nucleo":{"nome":"Núcleo Arcano","chefe":"guardiao"},"ouroMaldito":{"nome":"Ouro Amaldiçoado","chefe":"farao"},"escama":{"nome":"Escama de Dragão","chefe":"vharkesh"},"brasaIgnaroth":{"nome":"Brasa do Ignaroth","chefe":"ignaroth"},"gema":{"nome":"Pedra Preciosa","minas":true},"fragmento":{"nome":"Fragmento de Selo","boss":true}},"dropMaterial":[6,8,10],"dropChefe":15,"coletorBonus":50,"minas":{"opcoes":[{"minutos":30,"qtd":[1,3]},{"minutos":60,"qtd":[3,5]},{"minutos":120,"qtd":[6,10]},{"minutos":240,"qtd":[12,18]},{"minutos":480,"qtd":[24,32]},{"minutos":1440,"qtd":[60,84]}],"gemaPct":8,"metadeDesde":50},"receita":{"material":10,"ouro":[500,1500,3000,6000,12000,25000,50000]},"forja":{"material":5,"ouro":[1000,3000,6000,12000,25000,50000,100000],"raridade":[{"raridade":"comum","chance":60},{"raridade":"rara","chance":35},{"raridade":"epica","chance":5}],"extraChefe":{"epica":3,"lendaria":0.5},"extraGema":{"epica":2,"lendaria":0.5},"maxExtra":3,"obraPrima":2,"obraPrimaAnao":1},"oficina":{"taxa":10,"prazoHoras":24,"maxPedidos":5,"servicos":{"encantar":{"nome":"Encantar item","de":"ferreiro"},"forjar":{"nome":"Forjar arma ou armadura","de":"ferreiro"},"reliquia":{"nome":"Relíquia Rúnica","de":"ferreiro"},"receita":{"nome":"Fabricar Receita","de":"coletor"},"protecao":{"nome":"Fabricar Pergaminho de Proteção","de":"coletor"}}},"reliquia":{"nivelMin":30,"encantoMin":7,"base":10,"porSorte":0.05,"maxima":20,"porEncanto":0.25,"materiais":{"escama":3,"brasaIgnaroth":2,"fragmento":1},"runas":[{"id":"furia","nome":"Runa da Fúria","dano":6,"texto":"+6% de dano"},{"id":"colosso","nome":"Runa do Colosso","vida":8,"texto":"+8% de vida"},{"id":"falcao","nome":"Runa do Falcão","critico":4,"texto":"+4% de chance de crítico"},{"id":"tempestade","nome":"Runa da Tempestade","velocidade":6,"texto":"+6% de velocidade"},{"id":"muralha","nome":"Runa da Muralha","defesa":10,"texto":"+10% de defesa"}]},"protecao":{"comum":{"cristal":50,"materiais":{"ferro":10}},"rara":{"cristal":80,"materiais":{"nevoa":10,"osso":5}},"epica":{"cristal":120,"materiais":{"areia":10,"ouroMaldito":3}},"lendaria":{"cristal":200,"materiais":{"escama":2,"brasaIgnaroth":1}}},"areas":[{"id":"floresta","nivelMin":1,"chefe":"velgrath"},{"id":"pantano","nivelMin":5,"chefe":"morgath"},{"id":"ruinas","nivelMin":10,"chefe":"varnok"},{"id":"torre","nivelMin":15,"chefe":"guardiao"},{"id":"areias","nivelMin":20,"chefe":"farao"},{"id":"vale","nivelMin":25,"chefe":"vharkesh"},{"id":"cume","nivelMin":30,"chefe":"ignaroth"}]},"ENCANTO":{"maximo":10,"seguroAte":3,"voltaZeroAte":6,"chances":{"4":70,"5":60,"6":50,"7":40,"8":30,"9":20,"10":10},"teto":{"4":85,"5":75,"6":65,"7":55,"8":42,"9":30,"10":20},"chanceMaxima":95,"cristais":{"7":100,"8":150,"9":200,"10":500}},"BOSS_ALIANCA":{"duracaoMin":60,"grupoMax":4,"vidaPorNivel":1.3,"item":[{"raridade":"lendaria","chance":10},{"raridade":"epica","chance":90}],"niveis":[{"hp":49140,"ouro":2000,"exp":3750,"alianca":4000,"pergaminho":2,"raridade":"comum"},{"hp":63882,"ouro":2500,"exp":4688,"alianca":5000,"pergaminho":2,"raridade":"comum"},{"hp":83047,"ouro":3000,"exp":5625,"alianca":6000,"pergaminho":2,"raridade":"comum"},{"hp":72900,"ouro":10000,"exp":11250,"alianca":20000,"pergaminho":2,"raridade":"rara"},{"hp":94770,"ouro":12500,"exp":14063,"alianca":25000,"pergaminho":2,"raridade":"rara"},{"hp":123201,"ouro":15000,"exp":16875,"alianca":30000,"pergaminho":2,"raridade":"rara"},{"hp":112320,"ouro":30000,"exp":33750,"alianca":60000,"pergaminho":2,"raridade":"rara"},{"hp":146016,"ouro":37500,"exp":42188,"alianca":75000,"pergaminho":2,"raridade":"rara"},{"hp":189821,"ouro":45000,"exp":50625,"alianca":90000,"pergaminho":2,"raridade":"rara"},{"hp":158760,"ouro":90000,"exp":100000,"alianca":180000,"pergaminho":2,"raridade":"epica"},{"hp":206388,"ouro":112500,"exp":125000,"alianca":225000,"pergaminho":2,"raridade":"epica"},{"hp":268304,"ouro":135000,"exp":150000,"alianca":270000,"pergaminho":2,"raridade":"epica"},{"hp":200475,"ouro":270000,"exp":300000,"alianca":540000,"pergaminho":2,"raridade":"epica"},{"hp":260618,"ouro":337500,"exp":375000,"alianca":675000,"pergaminho":2,"raridade":"epica"},{"hp":338803,"ouro":405000,"exp":450000,"alianca":810000,"pergaminho":2,"raridade":"epica"},{"hp":440444,"ouro":472500,"exp":525000,"alianca":945000,"pergaminho":2,"raridade":"epica"},{"hp":572577,"ouro":540000,"exp":600000,"alianca":1080000,"pergaminho":2,"raridade":"epica"},{"hp":744350,"ouro":607500,"exp":675000,"alianca":1215000,"pergaminho":2,"raridade":"epica"},{"hp":967655,"ouro":675000,"exp":750000,"alianca":1350000,"pergaminho":2,"raridade":"epica"},{"hp":1257951,"ouro":742500,"exp":825000,"alianca":1485000,"pergaminho":2,"raridade":"epica"},{"hp":1635336,"ouro":810000,"exp":900000,"alianca":1620000,"pergaminho":2,"raridade":"epica"},{"hp":2125937,"ouro":877500,"exp":975000,"alianca":1755000,"pergaminho":2,"raridade":"epica"},{"hp":2763718,"ouro":945000,"exp":1050000,"alianca":1890000,"pergaminho":2,"raridade":"epica"},{"hp":3592834,"ouro":1012500,"exp":1125000,"alianca":2025000,"pergaminho":2,"raridade":"epica"},{"hp":4670684,"ouro":1080000,"exp":1200000,"alianca":2160000,"pergaminho":2,"raridade":"epica"},{"hp":6071889,"ouro":1147500,"exp":1275000,"alianca":2295000,"pergaminho":2,"raridade":"epica"},{"hp":7893455,"ouro":1215000,"exp":1350000,"alianca":2430000,"pergaminho":2,"raridade":"epica"},{"hp":10261492,"ouro":1282500,"exp":1425000,"alianca":2565000,"pergaminho":2,"raridade":"epica"},{"hp":13339939,"ouro":1350000,"exp":1500000,"alianca":2700000,"pergaminho":2,"raridade":"epica"},{"hp":17341921,"ouro":1417500,"exp":1575000,"alianca":2835000,"pergaminho":2,"raridade":"epica"},{"hp":22544498,"ouro":1485000,"exp":1650000,"alianca":2970000,"pergaminho":2,"raridade":"epica"},{"hp":29307847,"ouro":1552500,"exp":1725000,"alianca":3105000,"pergaminho":2,"raridade":"epica"},{"hp":38100201,"ouro":1620000,"exp":1800000,"alianca":3240000,"pergaminho":2,"raridade":"epica"},{"hp":49530261,"ouro":1687500,"exp":1875000,"alianca":3375000,"pergaminho":2,"raridade":"epica"},{"hp":64389340,"ouro":1755000,"exp":1950000,"alianca":3510000,"pergaminho":2,"raridade":"epica"},{"hp":83706142,"ouro":1822500,"exp":2025000,"alianca":3645000,"pergaminho":2,"raridade":"epica"},{"hp":108817984,"ouro":1890000,"exp":2100000,"alianca":3780000,"pergaminho":2,"raridade":"epica"},{"hp":141463380,"ouro":1957500,"exp":2175000,"alianca":3915000,"pergaminho":2,"raridade":"epica"},{"hp":183902394,"ouro":2025000,"exp":2250000,"alianca":4050000,"pergaminho":2,"raridade":"epica"},{"hp":239073112,"ouro":2092500,"exp":2325000,"alianca":4185000,"pergaminho":2,"raridade":"epica"},{"hp":310795045,"ouro":2160000,"exp":2400000,"alianca":4320000,"pergaminho":2,"raridade":"epica"},{"hp":404033559,"ouro":2227500,"exp":2475000,"alianca":4455000,"pergaminho":2,"raridade":"epica"},{"hp":525243627,"ouro":2295000,"exp":2550000,"alianca":4590000,"pergaminho":2,"raridade":"epica"},{"hp":682816715,"ouro":2362500,"exp":2625000,"alianca":4725000,"pergaminho":2,"raridade":"epica"},{"hp":887661729,"ouro":2430000,"exp":2700000,"alianca":4860000,"pergaminho":2,"raridade":"epica"},{"hp":1153960248,"ouro":2497500,"exp":2775000,"alianca":4995000,"pergaminho":2,"raridade":"epica"},{"hp":1500148322,"ouro":2565000,"exp":2850000,"alianca":5130000,"pergaminho":2,"raridade":"epica"},{"hp":1950192819,"ouro":2632500,"exp":2925000,"alianca":5265000,"pergaminho":2,"raridade":"epica"},{"hp":2535250664,"ouro":2700000,"exp":3000000,"alianca":5400000,"pergaminho":2,"raridade":"epica"},{"hp":3295825864,"ouro":2767500,"exp":3075000,"alianca":5535000,"pergaminho":2,"raridade":"epica"},{"hp":4284573623,"ouro":2835000,"exp":3150000,"alianca":5670000,"pergaminho":2,"raridade":"epica"},{"hp":5569945710,"ouro":2902500,"exp":3225000,"alianca":5805000,"pergaminho":2,"raridade":"epica"},{"hp":7240929422,"ouro":2970000,"exp":3300000,"alianca":5940000,"pergaminho":2,"raridade":"epica"},{"hp":9413208249,"ouro":3037500,"exp":3375000,"alianca":6075000,"pergaminho":2,"raridade":"epica"},{"hp":12237170724,"ouro":3105000,"exp":3450000,"alianca":6210000,"pergaminho":2,"raridade":"epica"},{"hp":15908321941,"ouro":3172500,"exp":3525000,"alianca":6345000,"pergaminho":2,"raridade":"epica"},{"hp":20680818524,"ouro":3240000,"exp":3600000,"alianca":6480000,"pergaminho":2,"raridade":"epica"},{"hp":26885064081,"ouro":3307500,"exp":3675000,"alianca":6615000,"pergaminho":2,"raridade":"epica"},{"hp":34950583305,"ouro":3375000,"exp":3750000,"alianca":6750000,"pergaminho":2,"raridade":"epica"},{"hp":45435758296,"ouro":3442500,"exp":3825000,"alianca":6885000,"pergaminho":2,"raridade":"epica"}]}}'::jsonb; $dados$;
-- <<< DADOS DO JOGO

-- ---------- Arena (PvP) ----------
-- Tudo roda aqui no servidor: força dos personagens, dados (D20), dano, saque de ouro e ranking.
-- Ouro e reputação ganhos ou perdidos viram "créditos" que o jogo de cada um aplica ao entrar.

-- ---------- Habilidades na Arena (mesmas regras de js/regras.js; ver TALENTOS em js/dados.js) ----------
-- Pontos de habilidade válidos: no máximo 10 por habilidade e o total do level. Se passar, nada vale (dados adulterados).
create or replace function public.arena_pontos_ok(p jsonb) returns boolean
language plpgsql immutable as $$
declare T jsonb := public.tanka_dados() -> 'TALENTOS'; nivel int := coalesce((p ->> 'nivel')::int, 1); soma int := 0; v int; maxi int := 0;
begin
  for v in select coalesce((value #>> '{}')::int, 0) from jsonb_each(coalesce(p -> 'talentos' -> 'pontos', '{}'::jsonb)) loop
    soma := soma + v; maxi := greatest(maxi, v);
  end loop;
  -- até o level pontosDepois.nivel: +pontosPorNivel; depois: +pontosDepois.porNivel por level (nov/2026: 14 no 20, 34 no 30)
  return maxi <= (T ->> 'maxPorHabilidade')::int and (soma = 0 or (nivel >= (T ->> 'nivelSegunda')::int
    and soma <= (T ->> 'pontosIniciais')::int
      + (least(nivel, coalesce((T -> 'pontosDepois' ->> 'nivel')::int, nivel)) - (T ->> 'nivelSegunda')::int) * (T ->> 'pontosPorNivel')::int
      + greatest(0, nivel - coalesce((T -> 'pontosDepois' ->> 'nivel')::int, nivel)) * coalesce((T -> 'pontosDepois' ->> 'porNivel')::int, 0)));
end $$;

-- Pontos de habilidade da arma equipada (armas 41+): { id da habilidade: n }, além do limite de 10.
create or replace function public.arena_pontos_arma(p jsonb) returns jsonb
language plpgsql immutable as $$
declare c2 text := p -> 'talentos' ->> 'classe2'; it jsonb; h jsonb;
begin
  if c2 is null then return '{}'::jsonb; end if;
  select x into it from jsonb_array_elements(coalesce(p -> 'inventario', '[]'::jsonb)) x where x ->> 'id' = p -> 'equipados' ->> 'arma' limit 1;
  if it is null or it -> 'extras' -> 'hab' is null then return '{}'::jsonb; end if;
  h := public.tanka_dados() -> 'SEGUNDAS_CLASSES' -> c2 -> 'habilidades' -> ((it -> 'extras' -> 'hab' ->> 'i')::int);
  if h is null then return '{}'::jsonb; end if;
  return jsonb_build_object(h ->> 'id', least(3, greatest(0, (it -> 'extras' -> 'hab' ->> 'n')::int)));
end $$;

-- A passiva da segunda classe com os pontos: { h, pts } ou null.
create or replace function public.arena_passiva(p jsonb) returns jsonb
language plpgsql immutable as $$
declare c2 text := p -> 'talentos' ->> 'classe2'; h jsonb; n int;
begin
  if c2 is null or not public.arena_pontos_ok(p) then return null; end if;
  select x into h from jsonb_array_elements(public.tanka_dados() -> 'SEGUNDAS_CLASSES' -> c2 -> 'habilidades') x
  where x ->> 'tipo' = 'passiva' and not x ? 'nivel' limit 1;
  -- Passivas fixas (nov/2026): sempre ligadas com o valor de 1 ponto (igual a js/regras.js: passiva).
  if h is null then return null; end if;
  return jsonb_build_object('h', h, 'pts', 1);
end $$;

-- Habilidades ativas na ordem da Arena, já com os números: [{ id, nome, tipo, recarga, mult, atordoa, turnos, v: {campo: %} }].
-- modo: 'arena' (quando ataca) ou 'defesa' (quando é desafiado; sem a lista, usa a da Arena).
create or replace function public.arena_kit(p jsonb, modo text) returns jsonb
language plpgsql immutable as $$
declare D jsonb := public.tanka_dados(); TL jsonb := D -> 'TALENTOS'; c2 text := p -> 'talentos' ->> 'classe2';
  kit jsonb := '[]'::jsonb; hid text; h jsonb; n int; tab jsonb; v jsonb; k text;
begin
  if c2 is null then
    h := D -> 'HABILIDADE_INICIAL' -> (p ->> 'classe');
    if h is null then return kit; end if;
    return jsonb_build_array(h || jsonb_build_object('mult', (TL -> (case when h ->> 'tipo' = 'area' then 'area' else 'unico' end) ->> 'base')::numeric, 'v', '{}'::jsonb));
  end if;
  if not public.arena_pontos_ok(p) then return kit; end if;
  for hid in select value #>> '{}' from jsonb_array_elements(coalesce(p -> 'talentos' -> 'ordem' -> modo, p -> 'talentos' -> 'ordem' -> 'arena', '[]'::jsonb)) loop
    select x into h from jsonb_array_elements(D -> 'SEGUNDAS_CLASSES' -> c2 -> 'habilidades') x where x ->> 'id' = hid limit 1;
    n := coalesce((p -> 'talentos' -> 'pontos' ->> hid)::int, 0) + coalesce((public.arena_pontos_arma(p) ->> hid)::int, 0);
    if h is null or n <= 0 or h ->> 'tipo' = 'passiva' then continue; end if;
    -- level 20/30: valem em todo lugar, a partir do level delas
    if coalesce((h ->> 'nivel')::int, 0) > coalesce((p ->> 'nivel')::int, 1) then continue; end if;
    tab := case h ->> 'tipo' when 'atordoar' then TL -> 'atordoar' when 'multiplo' then TL -> 'multiplo'
      when 'area' then case when (h ->> 'reduzido')::boolean then TL -> 'areaReduzida' else TL -> 'area' end
      when 'unico' then case when (h ->> 'reduzido')::boolean then TL -> 'unicoReduzido' else TL -> 'unico' end else null end;
    v := '{}'::jsonb;
    for k in select jsonb_object_keys(h) loop
      if k in ('dano', 'danoCritico', 'critico', 'velocidade', 'precisao', 'vidaPct', 'defesaPct') and jsonb_typeof(h -> k) = 'number' then
        v := jsonb_set(v, array[k], to_jsonb((h ->> k)::numeric + n * (TL ->> 'bonusPorPonto')::numeric));
      end if;
    end loop;
    kit := kit || jsonb_build_array(jsonb_build_object('id', hid, 'nome', h ->> 'nome', 'tipo', h ->> 'tipo', 'recarga', (h ->> 'recarga')::int,
      'mult', case when jsonb_typeof(h -> 'mult') = 'array' then (h -> 'mult' ->> 0)::numeric + (h -> 'mult' ->> 1)::numeric * n
        when tab is null then 100 else (tab ->> 'base')::numeric + (tab ->> 'porPonto')::numeric * n end,
      -- level 30 (nov/2026): defesa [base, por ponto], devolve dano, ignora defesa, cala, sempre 20, sem esquiva, executa,
      -- vida que falta, queima, corta cura, quebra defesa, cega
      'defesaPct2', case when jsonb_typeof(h -> 'defesaPct') = 'array' then (h -> 'defesaPct' ->> 0)::numeric + (h -> 'defesaPct' ->> 1)::numeric * n else 0 end,
      'reflete', coalesce((h ->> 'reflete')::numeric, 0), 'ignoraDefesaPct', coalesce((h ->> 'ignoraDefesaPct')::numeric, 0),
      'silencia', coalesce((h ->> 'silencia')::int, 0), 'garantido', coalesce((h ->> 'garantido')::boolean, false),
      'semEsquiva', coalesce((h ->> 'semEsquiva')::boolean, false), 'executa', h -> 'executa', 'vidaFaltando', coalesce((h ->> 'vidaFaltando')::numeric, 0),
      'queima', h -> 'queima', 'cortaCura', coalesce((h ->> 'cortaCura')::numeric, 0), 'quebraDefesaPct', coalesce((h ->> 'quebraDefesaPct')::numeric, 0),
      'erroPct', coalesce((h ->> 'erroPct')::numeric, 0),
      -- level 20: veneno/sangramento (% do dano médio por vez, cura de quem envenenou) e escudo (% da vida, chance de congelar)
      'dotPct2', case when jsonb_typeof(h -> 'dotPct') = 'array' then (h -> 'dotPct' ->> 0)::numeric + (h -> 'dotPct' ->> 1)::numeric * n else 0 end,
      'curaDot', coalesce((h ->> 'curaDot')::numeric, 0),
      'escudoPct2', case when jsonb_typeof(h -> 'escudoPct') = 'array' then (h -> 'escudoPct' ->> 0)::numeric + (h -> 'escudoPct' ->> 1)::numeric * n else 0 end,
      'congelaChance', coalesce((h ->> 'congelaChance')::numeric, 0),
      'atordoa', coalesce((h ->> 'atordoa')::int, 0), 'congela', coalesce((h ->> 'congela')::boolean, false),
      'turnos', coalesce((h ->> 'turnos')::int, 1), 'flechas', coalesce((h ->> 'flechas')::int, 1), 'v', v));
  end loop;
  return kit;
end $$;
create or replace function public.arena_kit(p jsonb) returns jsonb
language sql immutable as $$ select public.arena_kit(p, 'arena'); $$;

-- Soma de um bônus dos reforços ativos de um lutador.
create or replace function public.arena_buff(f jsonb, campo text) returns numeric
language sql immutable as $$
  select coalesce(sum((b ->> campo)::numeric), 0) from jsonb_array_elements(coalesce(f -> 'buffs', '[]'::jsonb)) b
  where (b ->> 'ate')::int >= (f ->> 'turno')::int and b ? campo;
$$;

-- Milagre: se o lutador caiu e ainda não usou, volta com milagre% da vida (metade com a cura cortada).
create or replace function public.arena_milagre_usar(f jsonb) returns jsonb
language plpgsql immutable as $$
begin
  if (f ->> 'hp')::int > 0 or coalesce((f ->> 'milagre')::numeric, 0) <= 0 or coalesce((f ->> 'milagreUsado')::boolean, false) then return f; end if;
  return f || jsonb_build_object('milagreUsado', true, 'hp', greatest(1, round((f ->> 'hpMax')::numeric * (f ->> 'milagre')::numeric / 100
    * case when coalesce((f ->> 'cortaCura')::int, 0) > 0 then 0.5 else 1 end)));
end $$;

-- Uma vez de um lutador na Arena: conta o turno, tira reforços vencidos, perde a vez se atordoado, usa a 1ª habilidade
-- pronta da ordem (reforço + ataque, cura, ou golpe da habilidade com o dado) e aplica no outro.
-- dado: a face rolada (null = atordoado, sem dado). Retorna { eu, outro, ev }.
create or replace function public.arena_vez(eu jsonb, outro jsonb, dado int) returns jsonb
language plpgsql volatile as $$
declare TL jsonb := public.tanka_dados() -> 'TALENTOS'; turno int := coalesce((eu ->> 'turno')::int, 0) + 1;
  buffs jsonb := '[]'::jsonb; b jsonb; k jsonb := null; item jsonb; ev jsonb := '{}'::jsonb; t text; extra int;
  mult numeric; fator numeric; dmin int; dmax int; base int; dano int := 0; def numeric; garantido boolean := false; cura int;
  flechas int := 1; f int; golpe int; total int := 0; pq numeric; refl int; calado boolean := false;
begin
  eu := jsonb_set(eu, '{turno}', to_jsonb(turno));
  -- Level 30 (nov/2026): a queimadura tira vida no começo da vez; cala, cegueira e corte de cura contam as vezes de quem sofre.
  if coalesce((eu -> 'queima' ->> 'turnos')::int, 0) > 0 then
    golpe := greatest(1, (eu -> 'queima' ->> 'dano')::int);
    eu := jsonb_set(eu, '{hp}', to_jsonb(greatest(0, (eu ->> 'hp')::int - golpe)));
    eu := jsonb_set(eu, '{queima,turnos}', to_jsonb((eu -> 'queima' ->> 'turnos')::int - 1));
    ev := ev || jsonb_build_object('queimou', golpe);
    if (eu ->> 'hp')::int <= 0 then eu := public.arena_milagre_usar(eu); ev := ev || jsonb_build_object('milagreEu', (eu ->> 'hp')::int > 0); end if;
    if (eu ->> 'hp')::int <= 0 then return jsonb_build_object('eu', eu, 'outro', outro, 'ev', ev || jsonb_build_object('dano', 0)); end if;
  end if;
  -- Level 20: regeneração e veneno/sangramento (quem envenenou recupera parte).
  if coalesce((eu -> 'ex' ->> 'regenPct')::numeric, 0) > 0 then
    eu := public.arena_curar(eu, greatest(1, round((eu ->> 'hpMax')::numeric * (eu -> 'ex' ->> 'regenPct')::numeric / 100)));
  end if;
  if coalesce((eu -> 'veneno' ->> 'turnos')::int, 0) > 0 then
    golpe := greatest(1, (eu -> 'veneno' ->> 'dano')::int);
    eu := jsonb_set(eu, '{hp}', to_jsonb(greatest(0, (eu ->> 'hp')::int - golpe)));
    eu := jsonb_set(eu, '{veneno,turnos}', to_jsonb((eu -> 'veneno' ->> 'turnos')::int - 1));
    outro := public.arena_curar(outro, golpe * coalesce((eu -> 'veneno' ->> 'cura')::numeric, 0) / 100);
    ev := ev || jsonb_build_object('envenenado', golpe);
    if (eu ->> 'hp')::int <= 0 then eu := public.arena_milagre_usar(eu); ev := ev || jsonb_build_object('milagreEu', (eu ->> 'hp')::int > 0); end if;
    if (eu ->> 'hp')::int <= 0 then return jsonb_build_object('eu', eu, 'outro', outro, 'ev', ev || jsonb_build_object('dano', 0)); end if;
  end if;
  if coalesce((eu ->> 'silenciado')::int, 0) > 0 then calado := true; eu := jsonb_set(eu, '{silenciado}', to_jsonb((eu ->> 'silenciado')::int - 1)); end if;
  if coalesce((eu ->> 'cortaCura')::int, 0) > 0 then eu := jsonb_set(eu, '{cortaCura}', to_jsonb((eu ->> 'cortaCura')::int - 1)); end if;
  for b in select x from jsonb_array_elements(coalesce(eu -> 'buffs', '[]'::jsonb)) x loop
    if (b ->> 'ate')::int >= turno then buffs := buffs || jsonb_build_array(b);
    elsif b ? 'vidaExtra' then
      eu := jsonb_set(eu, '{hpMax}', to_jsonb((eu ->> 'hpMax')::int - (b ->> 'vidaExtra')::int));
      eu := jsonb_set(eu, '{hp}', to_jsonb(least((eu ->> 'hp')::int, (eu ->> 'hpMax')::int)));
    end if;
  end loop;
  eu := jsonb_set(eu, '{buffs}', buffs);
  eu := jsonb_set(eu, '{vel}', to_jsonb(greatest(1, round((eu ->> 'velBase')::numeric * (1 + public.arena_buff(eu, 'velocidade') / 100)))));
  if coalesce((eu ->> 'atordoado')::int, 0) > 0 then
    eu := jsonb_set(eu, '{atordoado}', to_jsonb((eu ->> 'atordoado')::int - 1));
    if coalesce((eu ->> 'cego')::int, 0) > 0 then eu := jsonb_set(eu, '{cego}', to_jsonb((eu ->> 'cego')::int - 1)); end if;
    return jsonb_build_object('eu', eu, 'outro', outro, 'ev', ev || jsonb_build_object('atordoado', true, 'dano', 0));
  end if;
  -- A 1ª habilidade pronta da ordem (a cura só com menos de 80% da vida). Calado (Tiro Silenciador): só ataque normal.
  if calado then ev := ev || jsonb_build_object('calado', true); end if;
  for item in select x from jsonb_array_elements(case when calado then '[]'::jsonb else coalesce(eu -> 'kit', '[]'::jsonb) end) x loop
    if coalesce((eu -> 'pronto' ->> (item ->> 'id'))::int, 0) > turno then continue; end if;
    if item ->> 'tipo' = 'cura' and (eu ->> 'hp')::numeric * 100 / (eu ->> 'hpMax')::numeric >= (TL ->> 'curaSoAbaixo')::numeric then continue; end if;
    k := item; exit;
  end loop;
  if k is not null then
    eu := jsonb_set(eu, array['pronto', k ->> 'id'], to_jsonb(turno + (k ->> 'recarga')::int));
    ev := ev || jsonb_build_object('hab', k ->> 'nome');
    t := k ->> 'tipo';
    if t = 'furtivo' then
      eu := eu || jsonb_build_object('furtivo', true, 'critEm', turno + 1);
      ev := ev || jsonb_build_object('reforco', true); k := null;
    elsif t = 'provocar' then
      eu := jsonb_set(eu, '{buffs}', (eu -> 'buffs') || jsonb_build_array(jsonb_build_object('ate', turno + (k ->> 'turnos')::int - 1,
        'defesaPct', coalesce((k -> 'v' ->> 'defesaPct')::numeric, 0))));
      ev := ev || jsonb_build_object('reforco', true); k := null;
    elsif t = 'reforco' then
      extra := round((eu ->> 'hpMax')::numeric * coalesce((k -> 'v' ->> 'vidaPct')::numeric, 0) / 100);
      -- Sem crítico na Arena: os bônus de crítico do reforço viram dano.
      b := jsonb_build_object('ate', turno + (k ->> 'turnos')::int - 1,
        'dano', coalesce((k -> 'v' ->> 'dano')::numeric, 0) + coalesce((k -> 'v' ->> 'critico')::numeric, 0) + coalesce((k -> 'v' ->> 'danoCritico')::numeric, 0) / 2,
        'velocidade', coalesce((k -> 'v' ->> 'velocidade')::numeric, 0), 'vidaExtra', extra,
        'defesaPct', coalesce((k ->> 'defesaPct2')::numeric, 0), 'reflete', coalesce((k ->> 'reflete')::numeric, 0));
      eu := jsonb_set(eu, '{buffs}', (eu -> 'buffs') || jsonb_build_array(b));
      if extra > 0 then eu := eu || jsonb_build_object('hpMax', (eu ->> 'hpMax')::int + extra, 'hp', (eu ->> 'hp')::int + extra); end if;
      eu := jsonb_set(eu, '{vel}', to_jsonb(greatest(1, round((eu ->> 'velBase')::numeric * (1 + public.arena_buff(eu, 'velocidade') / 100)))));
      ev := ev || jsonb_build_object('reforco', true); k := null;
    elsif t = 'dot' then
      pq := ((eu -> 'dano' ->> 0)::numeric + (eu -> 'dano' ->> 1)::numeric) / 2 * coalesce((k ->> 'dotPct2')::numeric, 0) / 100;
      outro := outro || jsonb_build_object('veneno', jsonb_build_object('turnos', coalesce((k ->> 'turnos')::int, 3), 'dano', greatest(1, round(pq)),
        'cura', coalesce((k ->> 'curaDot')::numeric, 0)));
      ev := ev || jsonb_build_object('reforco', true, 'envenenou', true); k := null;
    elsif t = 'escudo' then
      eu := eu || jsonb_build_object('escudo', round((eu ->> 'hpMax')::numeric * coalesce((k ->> 'escudoPct2')::numeric, 0) / 100),
        'escudoAte', turno + coalesce((k ->> 'turnos')::int, 3) - 1, 'congelaChance', coalesce((k ->> 'congelaChance')::numeric, 0));
      ev := ev || jsonb_build_object('reforco', true, 'escudo', true); k := null;
    elsif t = 'cegar' then
      -- Pó nos Olhos: o outro erra cada ataque com erroPct% de chance nas próximas vezes dele.
      outro := outro || jsonb_build_object('cego', coalesce((k ->> 'turnos')::int, 2), 'cegoPct', (k ->> 'erroPct')::numeric);
      ev := ev || jsonb_build_object('reforco', true, 'cegou', true); k := null;
    elsif t = 'cura' then
      cura := round((eu ->> 'hpMax')::numeric * coalesce((k -> 'v' ->> 'vidaPct')::numeric, 0) / 100);
      if coalesce((eu ->> 'cortaCura')::int, 0) > 0 then cura := round(cura / 2.0); end if;
      eu := jsonb_set(eu, '{hp}', to_jsonb(least((eu ->> 'hpMax')::int, (eu ->> 'hp')::int + cura)));
      return jsonb_build_object('eu', eu, 'outro', outro, 'ev', ev || jsonb_build_object('cura', cura, 'dano', 0));
    end if;
  end if;
  -- Ataque com o dado (1 erra). Sombra: o golpe seguinte vale pelo menos o 20 do dado.
  mult := (public.tanka_dados() -> 'ARENA' -> 'dado' ->> (dado - 1))::numeric;
  if k is not null and coalesce((k ->> 'garantido')::boolean, false) then
    mult := greatest(mult, (public.tanka_dados() -> 'ARENA' -> 'dado' ->> 19)::numeric); ev := ev || jsonb_build_object('garantido', true);
  end if;
  if coalesce((eu ->> 'critEm')::int, -1) = turno then
    garantido := true; mult := greatest(mult, (public.tanka_dados() -> 'ARENA' -> 'dado' ->> 19)::numeric);
    eu := jsonb_set(eu, '{critEm}', '-1'); ev := ev || jsonb_build_object('garantido', true);
  end if;
  fator := (case when k is null then 100 else (k ->> 'mult')::numeric end) / 100 * (1 + public.arena_buff(eu, 'dano') / 100)
    * (1 + coalesce((eu -> 'ex' ->> 'danoExtraPct')::numeric, 0) / 100);
  if k is not null then
    -- Golpe Apocalíptico: +x% para cada 1% de vida que falta. Execução: +bônus com o outro abaixo de x% da vida.
    fator := fator * (1 + coalesce((k ->> 'vidaFaltando')::numeric, 0) * (100 - (eu ->> 'hp')::numeric * 100 / (eu ->> 'hpMax')::numeric) / 100);
    if k -> 'executa' is not null and jsonb_typeof(k -> 'executa') = 'object'
       and (outro ->> 'hp')::numeric * 100 / (outro ->> 'hpMax')::numeric < (k -> 'executa' ->> 'abaixo')::numeric then
      fator := fator * (1 + (k -> 'executa' ->> 'bonus')::numeric / 100); ev := ev || jsonb_build_object('executou', true);
    end if;
  end if;
  -- Double Shot (tipo 'multiplo'): várias flechas com o mesmo dado; cada uma rola o dano.
  if k is not null and k ->> 'tipo' = 'multiplo' then flechas := greatest(1, coalesce((k ->> 'flechas')::int, 2)); end if;
  for f in 1..flechas loop
    exit when (outro ->> 'hp')::int <= 0;
    golpe := 0;
    if mult > 0 then
      dmin := (eu -> 'dano' ->> 0)::int; dmax := (eu -> 'dano' ->> 1)::int;
      base := dmin + floor(random() * (greatest(dmax, dmin) - dmin + 1));
      def := (case when (eu ->> 'magico')::boolean then outro ->> 'defesaMagica' else outro ->> 'defesa' end)::numeric
        * (1 + public.arena_buff(outro, 'defesaPct') / 100) * (1 - coalesce((outro ->> 'defQuebra')::numeric, 0) / 100)
        * (1 - case when k is null then 0 else coalesce((k ->> 'ignoraDefesaPct')::numeric, 0) end / 100);
      -- defesa em porcentagem (igual aos monstros): x 100 / (100 + defesa)
      golpe := greatest(1, round(base * mult * fator * coalesce((public.tanka_dados() -> 'DEFESA' ->> 'k')::numeric, 100)
        / (coalesce((public.tanka_dados() -> 'DEFESA' ->> 'k')::numeric, 100) + greatest(0, def))));
    end if;
    -- Na Arena quem manda é o dado: só o 1 erra; esquiva e precisão não contam (Henri, nov/2026).
    -- Exceção: a Sombra do Assassino desvia do próximo golpe (e garante o 20 no golpe seguinte dele).
    -- Pó nos Olhos: chance de errar.
    if golpe > 0 and coalesce((eu ->> 'cego')::int, 0) > 0 and random() * 100 < coalesce((eu ->> 'cegoPct')::numeric, 0) then
      golpe := 0; ev := ev || jsonb_build_object('errouCego', true);
    end if;
    if golpe > 0 and coalesce((outro ->> 'furtivo')::boolean, false) and not (k is not null and coalesce((k ->> 'semEsquiva')::boolean, false)) then
      golpe := 0; outro := jsonb_set(outro, '{furtivo}', 'false'); ev := ev || jsonb_build_object('sombra', true);
    end if;
    -- Level 20 de quem apanha: Têmpera (menos dano) e Escudo de Gelo (segura dano; pode congelar quem bate).
    if golpe > 0 and coalesce((outro -> 'ex' ->> 'reducaoDano')::numeric, 0) > 0 then
      golpe := greatest(1, round(golpe * (1 - (outro -> 'ex' ->> 'reducaoDano')::numeric / 100)));
    end if;
    if golpe > 0 and coalesce((outro ->> 'escudo')::int, 0) > 0 and coalesce((outro ->> 'turno')::int, 0) <= coalesce((outro ->> 'escudoAte')::int, -1) then
      refl := least(golpe, (outro ->> 'escudo')::int);
      outro := jsonb_set(outro, '{escudo}', to_jsonb((outro ->> 'escudo')::int - refl)); golpe := golpe - refl;
      ev := ev || jsonb_build_object('escudoSegurou', coalesce((ev ->> 'escudoSegurou')::int, 0) + refl);
      if random() * 100 < coalesce((outro ->> 'congelaChance')::numeric, 0) then
        eu := jsonb_set(eu, '{atordoado}', to_jsonb(greatest(coalesce((eu ->> 'atordoado')::int, 0), 1))); ev := ev || jsonb_build_object('congelouEu', true);
      end if;
    end if;
    outro := jsonb_set(outro, '{hp}', to_jsonb(greatest(0, (outro ->> 'hp')::int - golpe)));
    total := total + golpe;
    -- Sede de Sangue: parte do dano vira vida. Bolso de Poções de quem apanha: uma vez, abaixo do limiar.
    if golpe > 0 and coalesce((eu -> 'ex' ->> 'rouboVida')::numeric, 0) > 0 then
      eu := public.arena_curar(eu, golpe * (eu -> 'ex' ->> 'rouboVida')::numeric / 100);
    end if;
    if coalesce((outro -> 'ex' ->> 'curaEmergencia')::numeric, 0) > 0 and not coalesce((outro ->> 'bolsoUsado')::boolean, false)
       and (outro ->> 'hp')::int > 0 and (outro ->> 'hp')::numeric * 100 < (outro ->> 'hpMax')::numeric * coalesce((outro -> 'ex' ->> 'limiar')::numeric, 40) then
      outro := public.arena_curar(outro || jsonb_build_object('bolsoUsado', true), (outro ->> 'hpMax')::numeric * (outro -> 'ex' ->> 'curaEmergencia')::numeric / 100);
      ev := ev || jsonb_build_object('bolso', true);
    end if;
    -- Defesa Suprema: devolve parte do dano para quem bateu.
    refl := round(golpe * public.arena_buff(outro, 'reflete') / 100);
    if refl > 0 then
      eu := jsonb_set(eu, '{hp}', to_jsonb(greatest(0, (eu ->> 'hp')::int - refl)));
      ev := ev || jsonb_build_object('devolvido', coalesce((ev ->> 'devolvido')::int, 0) + refl);
    end if;
  end loop;
  if coalesce((eu ->> 'cego')::int, 0) > 0 then eu := jsonb_set(eu, '{cego}', to_jsonb((eu ->> 'cego')::int - 1)); end if;
  dano := total;
  -- Efeitos do golpe do level 30 (só se acertou e o outro ainda está de pé).
  if k is not null and dano > 0 and (outro ->> 'hp')::int > 0 then
    if coalesce((k ->> 'silencia')::int, 0) > 0 then outro := jsonb_set(outro, '{silenciado}', to_jsonb((k ->> 'silencia')::int)); ev := ev || jsonb_build_object('calou', true); end if;
    if coalesce((k ->> 'quebraDefesaPct')::numeric, 0) > 0 then
      outro := jsonb_set(outro, '{defQuebra}', to_jsonb(greatest(coalesce((outro ->> 'defQuebra')::numeric, 0), (k ->> 'quebraDefesaPct')::numeric)));
      ev := ev || jsonb_build_object('quebrou', true);
    end if;
    if jsonb_typeof(k -> 'queima') = 'object' then
      pq := ((eu -> 'dano' ->> 0)::numeric + (eu -> 'dano' ->> 1)::numeric) / 2 * (k -> 'queima' ->> 'pct')::numeric / 100;
      outro := outro || jsonb_build_object('queima', jsonb_build_object('turnos', (k -> 'queima' ->> 'turnos')::int, 'dano', greatest(1, round(pq))));
      ev := ev || jsonb_build_object('queimadura', true);
    end if;
    if coalesce((k ->> 'cortaCura')::numeric, 0) > 0 then
      outro := jsonb_set(outro, '{cortaCura}', to_jsonb(coalesce((k -> 'queima' ->> 'turnos')::int, 3)));
    end if;
  end if;
  -- Milagre: quem cai com o Milagre pronto volta (uma vez por luta).
  if (outro ->> 'hp')::int <= 0 then outro := public.arena_milagre_usar(outro); if (outro ->> 'hp')::int > 0 then ev := ev || jsonb_build_object('milagre', true); end if; end if;
  if (eu ->> 'hp')::int <= 0 then eu := public.arena_milagre_usar(eu); if (eu ->> 'hp')::int > 0 then ev := ev || jsonb_build_object('milagreEu', true); end if; end if;
  if flechas > 1 then ev := ev || jsonb_build_object('flechas', flechas); end if;
  if k is not null and dano > 0 and coalesce((k ->> 'atordoa')::int, 0) > 0 and (outro ->> 'hp')::int > 0 then
    outro := jsonb_set(outro, '{atordoado}', to_jsonb(greatest(coalesce((outro ->> 'atordoado')::int, 0), (k ->> 'atordoa')::int)));
    ev := ev || jsonb_build_object('atordoou', (k ->> 'atordoa')::int, 'congelou', (k ->> 'congela')::boolean);
  end if;
  return jsonb_build_object('eu', eu, 'outro', outro, 'ev', ev || jsonb_build_object('dano', dano));
end $$;

-- Força de combate de um personagem a partir dos dados salvos (mesmas fórmulas de js/regras.js: status).
create or replace function public.tanka_status(p jsonb) returns jsonb
language plpgsql stable as $$
declare
  T jsonb := public.tanka_dados();
  raridades text[] := array['comum', 'rara', 'epica', 'lendaria'];
  eq jsonb := '{}'::jsonb; iid text; it jsonb; tipo text; idx int; def jsonb; k text; arr jsonb; enc int; b0 numeric; m numeric; fd numeric;
  fo numeric; de numeric; re numeric; inte numeric; nivel int := coalesce((p ->> 'nivel')::int, 1);
  magico boolean; dmin numeric := 0; dmax numeric := 0; extra numeric; bonus numeric;
  pas jsonb; npas int := 0; pv jsonb := '{}'::jsonb; hp numeric; dfs numeric; dfm numeric; pct numeric;
  tarma jsonb; velarma numeric := 1; fat numeric := 1; pvp numeric := 0; ncj jsonb := '{}'::jsonb; cj jsonb := '{}'::jsonb; cid text; cn int; q int; bq jsonb;
  rc jsonb := '{}'::jsonb;
begin
  -- Passiva da segunda classe (mesmos valores de js/regras.js): atributos fixos e bônus em % (+1 por ponto).
  pas := public.arena_passiva(p);
  if pas is not null then
    npas := (pas ->> 'pts')::int;
    for k in select jsonb_object_keys(pas -> 'h') loop
      if k in ('dano', 'danoCritico', 'critico', 'vidaPct', 'defesaPct', 'evasao', 'danoCriticoMagico') then
        pv := jsonb_set(pv, array[k], to_jsonb((pas -> 'h' ->> k)::numeric + npas * (T -> 'TALENTOS' ->> 'bonusPorPonto')::numeric));
      end if;
    end loop;
  end if;
  for iid in select value #>> '{}' from jsonb_each(coalesce(p -> 'equipados', '{}'::jsonb)) where jsonb_typeof(value) = 'string' loop
    select x into it from jsonb_array_elements(p -> 'inventario') x where x ->> 'id' = iid limit 1;
    if it is null then continue; end if;
    tipo := it ->> 'tipo';
    idx := array_position(raridades, it ->> 'raridade') - 1;
    -- peças de conjunto da segunda classe do herói
    if tipo in ('elmo', 'peitoral', 'luvas', 'botas') and it ? 'conjunto' and split_part(it ->> 'conjunto', '-', 1) = (p -> 'talentos' ->> 'classe2') then
      ncj := jsonb_set(ncj, array[it ->> 'conjunto'], to_jsonb(coalesce((ncj ->> (it ->> 'conjunto'))::int, 0) + 1));
    end if;
    if tipo = 'arma' and jsonb_typeof(it -> 'extras') = 'object' then
      -- arma por nível: atributos sorteados da faixa
      for k, arr in select * from jsonb_each(coalesce(it -> 'extras' -> 'atributos', '{}'::jsonb)) loop
        eq := jsonb_set(eq, array[k], to_jsonb(coalesce((eq ->> k)::numeric, 0) + (arr #>> '{}')::numeric));
      end loop;
      continue;
    end if;
    if tipo = 'arma' then
      -- arma antiga rara ou melhor: + atributo de dano da classe
      k := T -> 'classes' -> (it ->> 'classe') ->> 'atributoDano';
      if k is not null and coalesce((T -> 'RARIDADE_ARMA' -> 'atributo' ->> idx)::numeric, 0) > 0 then
        eq := jsonb_set(eq, array[k], to_jsonb(coalesce((eq ->> k)::numeric, 0) + (T -> 'RARIDADE_ARMA' -> 'atributo' ->> idx)::numeric));
      end if;
      continue;
    end if;
    def := case when tipo in ('colar', 'anel') then T -> 'joias' -> tipo when tipo = 'secundaria' then T -> 'MAO_ESQUERDA' -> (it ->> 'mao')
      else T -> 'armaduras' -> (it ->> 'classe') -> tipo end;
    if def is null then continue; end if;
    if jsonb_typeof(it -> 'bonus') = 'object' then
      -- bônus sorteados quando o item caiu (armaduras novas)
      for k, arr in select * from jsonb_each(it -> 'bonus') loop
        eq := jsonb_set(eq, array[k], to_jsonb(coalesce((eq ->> k)::numeric, 0) + (arr #>> '{}')::numeric));
      end loop;
    else
      for k, arr in select * from jsonb_each(def -> 'bonus') loop
        eq := jsonb_set(eq, array[k], to_jsonb(coalesce((eq ->> k)::numeric, 0) + (arr ->> idx)::numeric));
      end loop;
    end if;
    enc := coalesce((it ->> 'encanto')::int, 0);
    if enc > 0 then
      k := case when tipo = 'secundaria' then def ->> 'encanto' else T -> 'bonusPorNivel' ->> tipo end;
      b0 := case when jsonb_typeof(it -> 'bonus') = 'object' then (it -> 'bonus' ->> k)::numeric else (def -> 'bonus' -> k ->> idx)::numeric end;
      -- encanto: +encantoPct% por nível do bônus principal, arredondado como R.bonusItem
      -- (defesa: arredonda o item já x DEFESA.fator; outros bônus: arredonda o valor)
      m := 1 + enc * coalesce((T ->> 'encantoPct')::numeric, 5) / 100;
      fd := coalesce((T -> 'DEFESA' ->> 'fator')::numeric, 1);
      eq := jsonb_set(eq, array[k], to_jsonb(coalesce((eq ->> k)::numeric, 0) - coalesce(b0, 0)
        + case when k in ('defesa', 'defesaMagica') then round(coalesce(b0, 0) * m * fd) / fd else round(coalesce(b0, 0) * m) end));
    end if;
  end loop;
  -- bônus dos conjuntos (2, 3 e 4 peças com o mesmo nome; somam)
  for cid, cn in select key, (value #>> '{}')::int from jsonb_each(ncj) loop
    foreach q in array array[2, 3, 4] loop
      if cn >= q then
        bq := T -> 'CONJUNTOS' -> split_part(cid, '-', 1) -> 'bonus' -> q::text;
        for k, arr in select * from jsonb_each(coalesce(bq, '{}'::jsonb)) loop
          cj := jsonb_set(cj, array[k], to_jsonb(coalesce((cj ->> k)::numeric, 0) + (arr #>> '{}')::numeric));
        end loop;
      end if;
    end loop;
  end loop;
  fo := coalesce((cj ->> 'for')::numeric, 0) + (p -> 'atributos' ->> 'for')::numeric + coalesce((eq ->> 'for')::numeric, 0) + coalesce((pas -> 'h' -> 'atributos' ->> 'for')::numeric, 0);
  de := (p -> 'atributos' ->> 'des')::numeric + coalesce((eq ->> 'des')::numeric, 0) + coalesce((pas -> 'h' -> 'atributos' ->> 'des')::numeric, 0);
  re := (p -> 'atributos' ->> 'res')::numeric + coalesce((eq ->> 'res')::numeric, 0) + coalesce((pas -> 'h' -> 'atributos' ->> 'res')::numeric, 0);
  inte := (p -> 'atributos' ->> 'int')::numeric + coalesce((eq ->> 'int')::numeric, 0) + coalesce((pas -> 'h' -> 'atributos' ->> 'int')::numeric, 0);
  magico := T -> 'classes' -> (p ->> 'classe') ->> 'dano' = 'magico';
  iid := p -> 'equipados' ->> 'arma';
  select x into it from jsonb_array_elements(p -> 'inventario') x where x ->> 'id' = iid limit 1;
  if it is not null then
    if it ? 'dano' then dmin := (it -> 'dano' ->> 0)::numeric; dmax := (it -> 'dano' ->> 1)::numeric;
    else dmin := (T -> 'raridades' -> (it ->> 'raridade') -> 'danoMin' ->> 0)::numeric; dmax := (T -> 'raridades' -> (it ->> 'raridade') -> 'danoMax' ->> 1)::numeric;
    end if;
    -- encanto: +encantoPct% do dano da arma por nível (igual a R.multEncanto)
    extra := 1 + coalesce((it ->> 'encanto')::int, 0) * coalesce((T ->> 'encantoPct')::numeric, 5) / 100;
    -- tipo da arma: fator de dano (vale para o golpe inteiro, abaixo) e velocidade
    tarma := T -> 'TIPOS_ARMA' -> coalesce(it ->> 'arma', T -> 'ARMA_PADRAO' ->> (it ->> 'classe'));
    fat := coalesce((tarma ->> 'fator')::numeric, 1);
    dmin := dmin * extra; dmax := dmax * extra;
    velarma := coalesce((T -> 'VELOCIDADE_ARMA' ->> (tarma ->> 'vel'))::numeric, 1);
    pvp := case when jsonb_typeof(it -> 'extras') = 'object' then coalesce((it -> 'extras' ->> 'pvp')::numeric, 0)
      else coalesce((T -> 'RARIDADE_ARMA' -> 'pvp' ->> (array_position(raridades, it ->> 'raridade') - 1))::numeric, 0) end;
  end if;
  -- +1 de dano a cada 3 pontos do atributo de dano da classe (Força, Destreza ou Inteligência).
  bonus := floor((case T -> 'classes' -> (p ->> 'classe') ->> 'atributoDano' when 'des' then de when 'int' then inte
    when 'for' then fo else case when magico then inte else fo end end) / coalesce((T ->> 'PONTOS_POR_DANO')::numeric, 5));
  -- o fator do tipo da arma vale para o golpe inteiro (arma + dano do herói + mão esquerda), igual a R.status
  dmin := round((dmin + bonus + coalesce((eq ->> 'dano')::numeric, 0)) * fat); dmax := round((dmax + bonus + coalesce((eq ->> 'dano')::numeric, 0)) * fat);
  -- dano % da mão esquerda: dano mágico (orbe, livro) e dano % (aljava, manopla), igual a R.status (danoComMao)
  extra := (case when magico then coalesce((eq ->> 'danoMagico')::numeric, 0) else 0 end) + coalesce((eq ->> 'danoPct')::numeric, 0);
  if extra > 0 then
    dmin := round(dmin * (1 + extra / 100)); dmax := round(dmax * (1 + extra / 100));
  end if;
  -- toda RES acima de RES_SEM_VIDA dá vida (igual a R.status, nov/2026)
  hp := (T ->> 'HP_INICIAL')::numeric + greatest(0, re - coalesce((T ->> 'RES_SEM_VIDA')::numeric, 10)) * (T ->> 'HP_POR_RES')::numeric
      + (nivel - 1) * (T ->> 'HP_POR_NIVEL')::numeric + coalesce((eq ->> 'vida')::numeric, 0);
  -- vida % do Escudo (igual a R.status)
  if coalesce((eq ->> 'vidaPct')::numeric, 0) > 0 then hp := round(hp * (1 + (eq ->> 'vidaPct')::numeric / 100)); end if;
  -- defesa em porcentagem: RES e itens valem x DEFESA.fator (igual a R.status / R.bonusItem)
  -- cada ponto de RES conta (fator / 10 por ponto)
  dfs := round(re * coalesce((T -> 'DEFESA' ->> 'fator')::numeric, 1) / 10) + round(coalesce((eq ->> 'defesa')::numeric, 0) * coalesce((T -> 'DEFESA' ->> 'fator')::numeric, 1));
  dfm := round(re * coalesce((T -> 'DEFESA' ->> 'fator')::numeric, 1) / 10) + round(coalesce((eq ->> 'defesaMagica')::numeric, 0) * coalesce((T -> 'DEFESA' ->> 'fator')::numeric, 1));
  -- defesa % do Escudo (vale para a defesa e a defesa mágica, igual a R.status)
  if coalesce((eq ->> 'defesaPct')::numeric, 0) > 0 then
    dfs := round(dfs * (1 + (eq ->> 'defesaPct')::numeric / 100)); dfm := round(dfm * (1 + (eq ->> 'defesaPct')::numeric / 100));
  end if;
  if pv ? 'vidaPct' then hp := round(hp * (1 + (pv ->> 'vidaPct')::numeric / 100)); end if;
  if pv ? 'defesaPct' then dfs := round(dfs * (1 + (pv ->> 'defesaPct')::numeric / 100)); dfm := round(dfm * (1 + (pv ->> 'defesaPct')::numeric / 100)); end if;
  -- traços da raça (igual a R.comRaca): vida e dano em %; na Arena o crítico vira dano (como a passiva)
  rc := coalesce(T -> 'racas' -> (p ->> 'raca') -> 'tracos', '{}'::jsonb);
  if rc ? 'vidaPct' then hp := round(hp * (1 + (rc ->> 'vidaPct')::numeric / 100)); end if;
  hp := hp + coalesce((cj ->> 'vida')::numeric, 0);
  dfs := dfs + coalesce((cj ->> 'defesa')::numeric, 0); dfm := dfm + coalesce((cj ->> 'defesa')::numeric, 0);
  -- Na Arena não há crítico: bônus de crítico da passiva e do conjunto viram dano (chance inteira, dano crítico pela metade).
  -- raça: danoPct direto na hora (antes da passiva, como R.comRaca), crítico/dano crítico entram no pct abaixo
  if rc ? 'danoPct' then dmin := greatest(1, round(dmin * (1 + (rc ->> 'danoPct')::numeric / 100))); dmax := greatest(1, round(dmax * (1 + (rc ->> 'danoPct')::numeric / 100))); end if;
  pct := coalesce((rc ->> 'critico')::numeric, 0) + coalesce((rc ->> 'danoCritico')::numeric, 0) / 2
    + coalesce((pv ->> 'dano')::numeric, 0) + coalesce((pv ->> 'critico')::numeric, 0)
    + (coalesce((pv ->> 'danoCritico')::numeric, 0) + coalesce((pv ->> 'danoCriticoMagico')::numeric, 0)) / 2
    + coalesce((cj ->> 'critico')::numeric, 0) + coalesce((cj ->> 'criticoMagico')::numeric, 0);
  if pct > 0 then dmin := round(dmin * (1 + pct / 100)); dmax := round(dmax * (1 + pct / 100)); end if;
  dmin := dmin + coalesce((cj ->> 'dano')::numeric, 0); dmax := dmax + coalesce((cj ->> 'dano')::numeric, 0);
  -- arma lendária: +10% de dano na Arena (PvP)
  if pvp > 0 then dmin := round(dmin * (1 + pvp / 100)); dmax := round(dmax * (1 + pvp / 100)); end if;
  return jsonb_build_object(
    'hpMax', hp, 'dano', jsonb_build_array(dmin, dmax), 'magico', magico, 'defesa', dfs, 'defesaMagica', dfm,
    'esquiva', coalesce((pv ->> 'evasao')::numeric, 0) + coalesce((cj ->> 'evasao')::numeric, 0),
    'velocidade', greatest(1, round(greatest(1, round(round((T -> 'VELOCIDADE' ->> 'inicial')::numeric * power((T -> 'VELOCIDADE' ->> 'porNivel')::numeric, nivel - 1)) * velarma))
      * (1 + coalesce((rc ->> 'velocidadePct')::numeric, 0) / 100))) + coalesce((cj ->> 'velocidade')::numeric, 0));
end $$;

-- Raças e classes rebalanceadas (nov/2026): os atributos iniciais passam a ser só os da classe (70 pontos).
-- Converte uma vez os personagens salvos (igual a R.normalizar): soma a diferença entre o novo inicial e o antigo,
-- mantendo os pontos que o jogador distribuiu. Quem já foi convertido (atributosV2) fica como está.
do $$
declare T jsonb := public.tanka_dados(); r record; novo jsonb; atr jsonb; k text;
begin
  perform set_config('tanka.migracao', '1', true);
  for r in select id, dados from public.personagens
    where not (dados ? 'atributosV2') and jsonb_typeof(dados -> 'atributos') = 'object'
      and jsonb_typeof(dados -> 'atributosIniciais') = 'object' and T -> 'classesAtributos' ? (dados ->> 'classe') loop
    novo := T -> 'classesAtributos' -> (r.dados ->> 'classe');
    atr := r.dados -> 'atributos';
    foreach k in array array['for', 'des', 'res', 'int', 'sor'] loop
      atr := jsonb_set(atr, array[k], to_jsonb(greatest(1, coalesce((atr ->> k)::int, 0) + (novo ->> k)::int
        - coalesce((r.dados -> 'atributosIniciais' ->> k)::int, 0))));
    end loop;
    update public.personagens set dados = dados || jsonb_build_object('atributos', atr, 'atributosIniciais', novo, 'atributosV2', true)
      where id = r.id;
  end loop;
  perform set_config('tanka.migracao', '', true);
end $$;

create table if not exists public.arena_posicoes (
  personagem_id text primary key references public.personagens (id) on delete cascade,
  arena text not null,
  posicao int not null,
  entrou_em timestamptz not null default now()
);
create index if not exists arena_posicoes_arena on public.arena_posicoes (arena, posicao);
create table if not exists public.arena_entradas (
  personagem_id text primary key references public.personagens (id) on delete cascade,
  valor int not null,
  atualizado_em timestamptz not null default now()
);
create table if not exists public.arena_lutas (
  id bigint generated always as identity primary key,
  arena text,
  atacante text references public.personagens (id) on delete set null,
  defensor text references public.personagens (id) on delete set null,
  nome_atacante text not null,
  nome_defensor text not null,
  revanche_de bigint,
  estado jsonb not null,
  eventos jsonb not null default '[]'::jsonb,
  situacao text not null default 'andamento' check (situacao in ('andamento', 'vitoria', 'derrota')),
  saque int not null default 0,
  saque_pct int not null default 0,
  pos_antes int,
  pos_depois int,
  jackpot int not null default 0,
  revanche_usada boolean not null default false,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);
-- tipo: 'escada' (desafio normal, muda posição), 'top5' (do Top 5 para baixo, até o 5º), 'livre' (pelo Ranking),
-- 'revanche'. Só 'escada' mexe na posição e no jackpot. reputacao: o que o atacante ganhou.
alter table public.arena_lutas add column if not exists tipo text not null default 'escada';
alter table public.arena_lutas add column if not exists reputacao int not null default 0;
create index if not exists arena_lutas_atacante on public.arena_lutas (atacante, id desc);
create index if not exists arena_lutas_par on public.arena_lutas (atacante, defensor, criado_em);
create index if not exists arena_lutas_defensor on public.arena_lutas (defensor, id desc);
create table if not exists public.arena_jackpot (
  arena text primary key,
  valor int not null default 0,
  top1 text,
  ultima_soma timestamptz not null default now(),
  ultima_paga timestamptz not null default now(),
  ultimo_dia date not null default public.dia_jogo()
);
create table if not exists public.creditos (
  id bigint generated always as identity primary key,
  personagem_id text not null references public.personagens (id) on delete cascade,
  ouro int not null default 0,
  reputacao int not null default 0,
  motivo text not null,
  aplicado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists creditos_pendentes on public.creditos (personagem_id) where not aplicado;
alter table public.arena_posicoes enable row level security;
alter table public.arena_entradas enable row level security;
alter table public.arena_lutas enable row level security;
alter table public.arena_jackpot enable row level security;
alter table public.creditos enable row level security;

create or replace function public.arena_de_nivel(n int) returns text
language sql stable as $$
  select a ->> 'id' from jsonb_array_elements(public.tanka_dados() -> 'ARENA' -> 'arenas') a
  where n between (a -> 'nivel' ->> 0)::int and (a -> 'nivel' ->> 1)::int limit 1;
$$;

create or replace function public.arena_compactar(ar text) returns void
language sql as $$
  update public.arena_posicoes ap set posicao = r.n
  from (select personagem_id, row_number() over (order by posicao, entrou_em) as n from public.arena_posicoes where arena = ar) r
  where ap.personagem_id = r.personagem_id and ap.posicao <> r.n;
$$;

-- Coloca o personagem na arena do level dele (no último lugar se for novo ou trocou de arena).
create or replace function public.arena_garantir(pid text) returns text
language plpgsql as $$
declare alvo text; atual text;
begin
  alvo := public.arena_de_nivel((select coalesce((dados ->> 'nivel')::int, 1) from public.personagens where id = pid));
  select arena into atual from public.arena_posicoes where personagem_id = pid;
  if atual is not distinct from alvo then return alvo; end if;
  if atual is not null then
    delete from public.arena_posicoes where personagem_id = pid;
    perform public.arena_compactar(atual);
  end if;
  if alvo is not null then
    perform public.arena_compactar(alvo);
    insert into public.arena_posicoes (personagem_id, arena, posicao)
    values (pid, alvo, coalesce((select max(posicao) from public.arena_posicoes where arena = alvo), 0) + 1);
  end if;
  return alvo;
end $$;

-- Entradas: até 5 guardadas, +1 a cada hora. Retorna { valor, proxima_em }.
create or replace function public.arena_entradas_atual(pid text) returns jsonb
language plpgsql as $$
declare cfg jsonb := public.tanka_dados() -> 'ARENA'; maximo int := (cfg ->> 'entradasMax')::int;
  passo interval := make_interval(mins => (cfg ->> 'recargaMinutos')::int); e public.arena_entradas; n int;
begin
  select * into e from public.arena_entradas where personagem_id = pid;
  if e.personagem_id is null then
    insert into public.arena_entradas (personagem_id, valor) values (pid, maximo) returning * into e;
  end if;
  if e.valor < maximo then
    n := floor(extract(epoch from now() - e.atualizado_em) / extract(epoch from passo));
    if n > 0 then
      e.valor := least(maximo, e.valor + n);
      e.atualizado_em := case when e.valor >= maximo then now() else e.atualizado_em + n * passo end;
      update public.arena_entradas set valor = e.valor, atualizado_em = e.atualizado_em where personagem_id = pid;
    end if;
  end if;
  return jsonb_build_object('valor', e.valor, 'maximo', maximo,
    'proxima_em', case when e.valor < maximo then e.atualizado_em + passo end);
end $$;

create or replace function public.arena_gastar_entrada(pid text) returns void
language plpgsql as $$
declare atual int := (public.arena_entradas_atual(pid) ->> 'valor')::int; maximo int := (public.tanka_dados() -> 'ARENA' ->> 'entradasMax')::int;
begin
  if atual <= 0 then raise exception 'Sem entradas na Arena. Recupera 1 por hora.'; end if;
  update public.arena_entradas set valor = valor - 1, atualizado_em = case when atual >= maximo then now() else atualizado_em end
  where personagem_id = pid;
end $$;

create or replace function public.creditar(pid text, ouro int, reputacao int, motivo text) returns void
language sql as $$
  insert into public.creditos (personagem_id, ouro, reputacao, motivo)
  select pid, ouro, reputacao, motivo where pid is not null and (ouro <> 0 or reputacao <> 0);
$$;

-- Ouro de um personagem contando o que ainda não foi aplicado no jogo dele.
create or replace function public.ouro_real(pid text) returns int
language sql stable as $$
  select greatest(0, coalesce((select (dados ->> 'ouro')::int from public.personagens where id = pid), 0)
    + coalesce((select sum(ouro) from public.creditos where personagem_id = pid and not aplicado), 0))::int;
$$;

-- Jackpot: soma por tempo do mesmo Top 1, paga 10% por hora ao Top 1 e entrega tudo às 00:00.
create or replace function public.arena_jackpot_atualizar(ar text) returns public.arena_jackpot
language plpgsql as $$
declare cfg jsonb := public.tanka_dados() -> 'ARENA'; j public.arena_jackpot; top text; n int; pago int;
  por10 int := (select (a ->> 'jackpotPor10min')::int from jsonb_array_elements(cfg -> 'arenas') a where a ->> 'id' = ar);
begin
  insert into public.arena_jackpot (arena) values (ar) on conflict (arena) do nothing;
  select * into j from public.arena_jackpot where arena = ar for update;
  select personagem_id into top from public.arena_posicoes where arena = ar order by posicao limit 1;
  if top is distinct from j.top1 then
    j.top1 := top; j.ultima_soma := now(); j.ultima_paga := now();
  elsif top is not null then
    n := floor(extract(epoch from now() - j.ultima_soma) / 600);
    if n > 0 then j.valor := j.valor + n * por10; j.ultima_soma := j.ultima_soma + n * interval '10 minutes'; end if;
    n := floor(extract(epoch from now() - j.ultima_paga) / 3600);
    for i in 1 .. least(n, 48) loop
      pago := floor(j.valor * (cfg ->> 'top1PorHora')::numeric);
      j.valor := j.valor - pago;
      perform public.creditar(top, pago, 0, 'Jackpot da Arena (1 hora no Top 1)');
    end loop;
    if n > 0 then j.ultima_paga := j.ultima_paga + n * interval '1 hour'; end if;
  end if;
  if j.ultimo_dia < public.dia_jogo() then
    if top is not null then
      perform public.creditar(top, j.valor, (cfg ->> 'reputacaoTop1Diario')::int, 'Prêmio diário do Top 1 da Arena');
      j.valor := 0;
    end if;
    j.ultimo_dia := public.dia_jogo();
  end if;
  update public.arena_jackpot set valor = j.valor, top1 = j.top1, ultima_soma = j.ultima_soma, ultima_paga = j.ultima_paga, ultimo_dia = j.ultimo_dia
  where arena = ar;
  return j;
end $$;

-- Milagre (Curandeiro, level 30): % da vida com que volta uma vez por luta (0 = não tem).
create or replace function public.arena_milagre(p jsonb) returns numeric
language plpgsql immutable as $$
declare c2 text := p -> 'talentos' ->> 'classe2'; h jsonb; n int;
begin
  if c2 is null or not public.arena_pontos_ok(p) then return 0; end if;
  select x into h from jsonb_array_elements(public.tanka_dados() -> 'SEGUNDAS_CLASSES' -> c2 -> 'habilidades') x where x ? 'milagrePct' limit 1;
  if h is null or coalesce((p ->> 'nivel')::int, 1) < coalesce((h ->> 'nivel')::int, 0) then return 0; end if;
  -- passiva fixa: valor de 1 ponto
  return (h -> 'milagrePct' ->> 0)::numeric + (h -> 'milagrePct' ->> 1)::numeric;
end $$;

-- Passivas do level 20 (mesmos valores de js/regras.js: extrasNivel): regenPct, rouboVida, reducaoDano, danoExtraPct,
-- curaEmergencia (+ limiar). Valem também na Arena.
create or replace function public.arena_extras(p jsonb) returns jsonb
language plpgsql immutable as $$
declare c2 text := p -> 'talentos' ->> 'classe2'; h jsonb; n int; k text; x jsonb := '{}'::jsonb;
begin
  if c2 is null or not public.arena_pontos_ok(p) then return x; end if;
  for h in select v from jsonb_array_elements(public.tanka_dados() -> 'SEGUNDAS_CLASSES' -> c2 -> 'habilidades') v
    where v ->> 'tipo' = 'passiva' and v ? 'nivel' and (v ->> 'nivel')::int <= coalesce((p ->> 'nivel')::int, 1) loop
    n := 1;   -- passivas fixas: valor de 1 ponto
    foreach k in array array['regenPct', 'rouboVida', 'reducaoDano', 'danoExtraPct', 'curaEmergencia'] loop
      if jsonb_typeof(h -> k) = 'array' then
        x := jsonb_set(x, array[k], to_jsonb(coalesce((x ->> k)::numeric, 0) + (h -> k ->> 0)::numeric + (h -> k ->> 1)::numeric * n));
      end if;
    end loop;
    if h ? 'limiar' then x := jsonb_set(x, '{limiar}', h -> 'limiar'); end if;
  end loop;
  return x;
end $$;

-- Cura um lutador (sem passar da vida máxima); com a cura cortada (Maldição de Ignaroth), vale a metade.
create or replace function public.arena_curar(f jsonb, x numeric) returns jsonb
language sql immutable as $$
  select case when x <= 0 or (f ->> 'hp')::int <= 0 then f else jsonb_set(f, '{hp}', to_jsonb(least((f ->> 'hpMax')::int,
    (f ->> 'hp')::int + round(x * case when coalesce((f ->> 'cortaCura')::int, 0) > 0 then 0.5 else 1 end)::int))) end;
$$;

-- Lutador da luta a partir dos dados salvos do personagem. modo: 'arena' (atacante) ou 'defesa' (desafiado).
create or replace function public.arena_lutador(pid text, modo text) returns jsonb
language plpgsql stable as $$
declare p public.personagens; s jsonb;
begin
  select * into p from public.personagens where id = pid;
  s := public.tanka_status(p.dados);
  return jsonb_build_object('id', p.id, 'nome', p.nome, 'classe', p.dados ->> 'classe', 'sexo', p.dados ->> 'sexo', 'raca', p.dados ->> 'raca',
    'skin', coalesce(p.dados ->> 'skinDado', 'vermelho'),
    'nivel', coalesce((p.dados ->> 'nivel')::int, 1), 'hp', s -> 'hpMax', 'hpMax', s -> 'hpMax', 'dano', s -> 'dano', 'magico', s -> 'magico',
    'defesa', s -> 'defesa', 'defesaMagica', s -> 'defesaMagica', 'vel', greatest(1, (s ->> 'velocidade')::numeric), 'barra', 0,
    'velBase', greatest(1, (s ->> 'velocidade')::numeric), 'esquiva', coalesce(s -> 'esquiva', '0'::jsonb),
    'classe2', case when public.arena_pontos_ok(p.dados) then p.dados -> 'talentos' -> 'classe2' else 'null'::jsonb end,
    'kit', public.arena_kit(p.dados, modo), 'turno', 0, 'pronto', '{}'::jsonb, 'buffs', '[]'::jsonb, 'atordoado', 0, 'furtivo', false, 'critEm', -1,
    'milagre', public.arena_milagre(p.dados), 'ex', public.arena_extras(p.dados));
end $$;
create or replace function public.arena_lutador(pid text) returns jsonb
language sql stable as $$ select public.arena_lutador(pid, 'arena'); $$;

-- Um golpe com o dado: 1 erra; os outros multiplicam o dano (tabela ARENA.dado); a defesa do alvo corta em % (x 100 / (100 + defesa)).
create or replace function public.arena_golpe(atk jsonb, alvo jsonb, dado int) returns int
language plpgsql volatile as $$
declare mult numeric := (public.tanka_dados() -> 'ARENA' -> 'dado' ->> (dado - 1))::numeric;
  dmin int := (atk -> 'dano' ->> 0)::int; dmax int := (atk -> 'dano' ->> 1)::int; base int;
begin
  if mult = 0 then return 0; end if;
  base := dmin + floor(random() * (greatest(dmax, dmin) - dmin + 1));
  return greatest(1, round(base * mult * 100 / (100 + greatest(0, (case when (atk ->> 'magico')::boolean then alvo ->> 'defesaMagica' else alvo ->> 'defesa' end)::numeric))));
end $$;

-- Termina a luta: saque, reputação, ranking e jackpot.
-- Ordem da arena (a1 = 1, a2 = 2...) para saber se uma está acima da outra.
create or replace function public.arena_indice(ar text) returns int
language sql stable as $$
  select o::int from jsonb_array_elements(public.tanka_dados() -> 'ARENA' -> 'arenas') with ordinality x(a, o) where a ->> 'id' = ar;
$$;
-- Começo da semana do jogo (segunda-feira 00:00 de Brasília): a contagem de ataques repetidos zera aí.
create or replace function public.arena_inicio_semana() returns timestamptz
language sql stable as $$ select date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::timestamp at time zone 'America/Sao_Paulo'; $$;

create or replace function public.arena_finalizar(luta_id bigint, vitoria boolean) returns void
language plpgsql as $$
declare cfg jsonb := public.tanka_dados() -> 'ARENA'; L public.arena_lutas; a jsonb; perda numeric; pct int := 0; valor_saque int := 0;
  pa int; pd int; ar text; j public.arena_jackpot; premio int := 0; depois int;
  repetidos int; fat_ouro numeric := 1; fat_rep numeric := 1; rep int := 0; ar_a text; ar_d text; pos_a int; pos_d int;
begin
  select * into L from public.arena_lutas where id = luta_id for update;
  a := L.estado -> 'a';
  if vitoria then
    perda := ((a ->> 'hpMax')::numeric - greatest(0, (a ->> 'hp')::numeric)) * 100 / (a ->> 'hpMax')::numeric;
    pct := case when perda <= (cfg -> 'saque' ->> 'ate')::numeric then (cfg -> 'saque' ->> 'minimo')::int
                when perda >= (cfg -> 'saque' ->> 'desde')::numeric then (cfg -> 'saque' ->> 'maximo')::int
                else (cfg -> 'saque' -> 'meio' ->> 0)::int + floor(random() * ((cfg -> 'saque' -> 'meio' ->> 1)::int - (cfg -> 'saque' -> 'meio' ->> 0)::int + 1))::int end;
    -- Mesmo atacante contra o mesmo personagem na semana: ouro cheio, metade, um quarto e depois nada (só reputação).
    select count(*) into repetidos from public.arena_lutas
      where atacante = L.atacante and defensor = L.defensor and id <> L.id and criado_em >= public.arena_inicio_semana();
    fat_ouro := case when repetidos = 0 then 1 when repetidos = 1 then 0.5 when repetidos = 2 then 0.25 else 0 end;
    -- Fora da escada (Top 5 para baixo, Ranking, revanche): alvo numa arena abaixo = nada; mesma arena e alvo
    -- em posição inferior = metade da reputação; mesma arena acima ou arena mais forte = tudo.
    if L.tipo <> 'escada' then
      select arena, posicao into ar_a, pos_a from public.arena_posicoes where personagem_id = L.atacante;
      select arena, posicao into ar_d, pos_d from public.arena_posicoes where personagem_id = L.defensor;
      if public.arena_indice(ar_d) < public.arena_indice(ar_a) then fat_rep := 0; fat_ouro := 0;
      elsif ar_d = ar_a and pos_d > pos_a then fat_rep := 0.5;
      end if;
    end if;
    valor_saque := floor(public.ouro_real(L.defensor) * pct / 100.0 * fat_ouro);
    rep := floor((cfg ->> 'reputacaoVitoria')::int * fat_rep);
    perform public.creditar(L.atacante, valor_saque, rep, 'Vitória na Arena contra ' || L.nome_defensor);
    perform public.creditar(L.defensor, -valor_saque, 0, 'Saque na Arena por ' || L.nome_atacante);
  end if;
  select posicao, arena into pa, ar from public.arena_posicoes where personagem_id = L.atacante;
  select posicao into pd from public.arena_posicoes where personagem_id = L.defensor and arena = ar;
  depois := pa;
  if L.tipo = 'escada' and L.revanche_de is null and pd is not null then
    j := public.arena_jackpot_atualizar(ar);
    if vitoria and pa > pd then
      -- Toma a posição do oponente; quem estava entre os dois desce uma.
      update public.arena_posicoes set posicao = posicao + 1 where arena = ar and posicao >= pd and posicao < pa;
      update public.arena_posicoes set posicao = pd where personagem_id = L.atacante;
      depois := pd;
      if pd = 1 and j.valor > 0 then
        premio := j.valor;
        perform public.creditar(L.atacante, premio, 0, 'Jackpot da Arena: derrotou o Top 1');
        update public.arena_jackpot set valor = 0, top1 = L.atacante, ultima_soma = now(), ultima_paga = now() where arena = ar;
      end if;
    elsif not vitoria and pd = 1 then
      update public.arena_jackpot set valor = valor + (cfg ->> 'jackpotPorDefesa')::int where arena = ar;
    end if;
  end if;
  update public.arena_lutas set situacao = case when vitoria then 'vitoria' else 'derrota' end, saque = valor_saque,
    saque_pct = pct, pos_antes = pa, pos_depois = depois, jackpot = premio, reputacao = rep, concluido_em = now(),
    estado = jsonb_set(estado, '{pendente}', 'false')
  where id = luta_id;
end $$;

-- Avança a luta até a próxima vez do atacante (que rola o dado) ou até o fim.
-- O defensor está offline: o servidor rola o dado por ele.
create or replace function public.arena_avancar(luta_id bigint) returns void
language plpgsql as $$
declare L public.arena_lutas; e jsonb; a jsonb; d jsonb; ev jsonb := '[]'::jsonb; dado int; dano int; turnos int; limite int; r jsonb;
begin
  select * into L from public.arena_lutas where id = luta_id for update;
  e := L.estado; a := e -> 'a'; d := e -> 'd'; turnos := (e ->> 'turnos')::int;
  limite := (public.tanka_dados() -> 'ARENA' ->> 'limiteTurnos')::int;
  loop
    if turnos >= limite then
      -- Luta longa demais: vence quem tiver a maior porcentagem de vida.
      update public.arena_lutas set eventos = eventos || ev, estado = jsonb_build_object('a', a, 'd', d, 'turnos', turnos, 'pendente', false) where id = luta_id;
      perform public.arena_finalizar(luta_id, (a ->> 'hp')::numeric / (a ->> 'hpMax')::numeric >= (d ->> 'hp')::numeric / (d ->> 'hpMax')::numeric);
      return;
    end if;
    if (a ->> 'barra')::numeric >= 100 and (a ->> 'barra')::numeric >= (d ->> 'barra')::numeric
       and coalesce((a ->> 'atordoado')::int, 0) > 0 then
      -- O atacante está atordoado: perde a vez sem rolar o dado.
      r := public.arena_vez(a, d, null);
      a := r -> 'eu'; d := r -> 'outro';
      a := jsonb_set(a, '{barra}', to_jsonb((a ->> 'barra')::numeric - 100));
      turnos := turnos + 1;
      ev := ev || ((r -> 'ev') || jsonb_build_object('de', 'a', 'hpA', a -> 'hp', 'hpD', d -> 'hp', 'hpMaxA', a -> 'hpMax', 'hpMaxD', d -> 'hpMax'));
      -- (queimadura do level 30 pode derrubar quem está atordoado)
      if (a ->> 'hp')::int <= 0 or (d ->> 'hp')::int <= 0 then
        update public.arena_lutas set eventos = eventos || ev, estado = jsonb_build_object('a', a, 'd', d, 'turnos', turnos, 'pendente', false) where id = luta_id;
        perform public.arena_finalizar(luta_id, (d ->> 'hp')::int <= 0);
        return;
      end if;
    elsif (a ->> 'barra')::numeric >= 100 and (a ->> 'barra')::numeric >= (d ->> 'barra')::numeric then
      update public.arena_lutas set eventos = eventos || ev, estado = jsonb_build_object('a', a, 'd', d, 'turnos', turnos, 'pendente', true) where id = luta_id;
      return;
    elsif (d ->> 'barra')::numeric >= 100 then
      dado := case when coalesce((d ->> 'atordoado')::int, 0) > 0 then null else 1 + floor(random() * 20)::int end;
      r := public.arena_vez(d, a, dado);
      d := r -> 'eu'; a := r -> 'outro'; dano := (r -> 'ev' ->> 'dano')::int;
      d := jsonb_set(d, '{barra}', to_jsonb((d ->> 'barra')::numeric - 100));
      turnos := turnos + 1;
      ev := ev || ((r -> 'ev') || jsonb_build_object('de', 'd', 'dado', dado, 'hpA', a -> 'hp', 'hpD', d -> 'hp', 'hpMaxA', a -> 'hpMax', 'hpMaxD', d -> 'hpMax'));
      -- (o defensor também pode cair na própria vez: queimadura ou dano devolvido)
      if (a ->> 'hp')::int <= 0 or (d ->> 'hp')::int <= 0 then
        update public.arena_lutas set eventos = eventos || ev, estado = jsonb_build_object('a', a, 'd', d, 'turnos', turnos, 'pendente', false) where id = luta_id;
        perform public.arena_finalizar(luta_id, (a ->> 'hp')::int > 0);
        return;
      end if;
    else
      a := jsonb_set(a, '{barra}', to_jsonb((a ->> 'barra')::numeric + (a ->> 'vel')::numeric));
      d := jsonb_set(d, '{barra}', to_jsonb((d ->> 'barra')::numeric + (d ->> 'vel')::numeric));
    end if;
  end loop;
end $$;

-- O atacante rola o dado (rolar = false: o tempo acabou, ataque normal = face 6).
create or replace function public.arena_jogar(luta_id bigint, rolar boolean) returns void
language plpgsql as $$
declare L public.arena_lutas; e jsonb; a jsonb; d jsonb; dado int; r jsonb;
begin
  select * into L from public.arena_lutas where id = luta_id for update;
  e := L.estado;
  if L.situacao <> 'andamento' or not (e ->> 'pendente')::boolean then raise exception 'Não é a sua vez.'; end if;
  a := e -> 'a'; d := e -> 'd';
  dado := case when rolar then 1 + floor(random() * 20)::int else 6 end;
  r := public.arena_vez(a, d, dado);
  a := r -> 'eu'; d := r -> 'outro';
  a := jsonb_set(a, '{barra}', to_jsonb((a ->> 'barra')::numeric - 100));
  update public.arena_lutas set
    eventos = eventos || jsonb_build_array((r -> 'ev') || jsonb_build_object('de', 'a', 'dado', dado, 'auto', not rolar,
      'hpA', a -> 'hp', 'hpD', d -> 'hp', 'hpMaxA', a -> 'hpMax', 'hpMaxD', d -> 'hpMax')),
    estado = jsonb_build_object('a', a, 'd', d, 'turnos', (e ->> 'turnos')::int + 1, 'pendente', false)
  where id = luta_id;
  if (d ->> 'hp')::int <= 0 then perform public.arena_finalizar(luta_id, true);
  elsif (a ->> 'hp')::int <= 0 then perform public.arena_finalizar(luta_id, false);
  else perform public.arena_avancar(luta_id);
  end if;
end $$;

-- Termina lutas abandonadas (página fechada no meio) com ataques normais.
create or replace function public.arena_encerrar_abandonadas(pid text) returns void
language plpgsql as $$
declare lid bigint;
begin
  for lid in select id from public.arena_lutas where atacante = pid and situacao = 'andamento' loop
    while (select situacao from public.arena_lutas where id = lid) = 'andamento' loop
      perform public.arena_jogar(lid, false);
    end loop;
  end loop;
end $$;

create or replace function public.arena_luta_json(luta_id bigint) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', id, 'arena', arena, 'revanche', revanche_de is not null, 'situacao', situacao, 'estado', estado,
    'eventos', eventos, 'saque', saque, 'saque_pct', saque_pct, 'pos_antes', pos_antes, 'pos_depois', pos_depois, 'jackpot', jackpot)
  from public.arena_lutas where id = luta_id;
$$;

create or replace function public.arena_comecar_tipo(meu text, alvo text, revanche bigint, tipo text) returns jsonb
language plpgsql as $$
declare ar text; lid bigint;
begin
  -- minerando (Aventura › Mineração) o herói está ocupado: não luta na Arena (p.minas.fim em ms)
  if exists (select 1 from public.personagens where id = meu and jsonb_typeof(dados -> 'minas' -> 'fim') = 'number'
      and (dados -> 'minas' ->> 'fim')::numeric > extract(epoch from now()) * 1000) then
    raise exception 'Seu herói está minerando: pare a mineração para lutar na Arena.';
  end if;
  perform public.arena_encerrar_abandonadas(meu);
  perform public.arena_gastar_entrada(meu);
  select arena into ar from public.arena_posicoes where personagem_id = meu;
  insert into public.arena_lutas (arena, atacante, defensor, nome_atacante, nome_defensor, revanche_de, tipo, estado)
  values (ar, meu, alvo, (select nome from public.personagens where id = meu), (select nome from public.personagens where id = alvo), revanche, tipo,
    jsonb_build_object('a', public.arena_lutador(meu, 'arena'), 'd', public.arena_lutador(alvo, 'defesa'), 'turnos', 0, 'pendente', false))
  returning id into lid;
  perform public.arena_avancar(lid);
  return public.arena_luta_json(lid);
end $$;
create or replace function public.arena_comecar(meu text, alvo text, revanche bigint) returns jsonb
language sql as $$ select public.arena_comecar_tipo(meu, alvo, revanche, case when revanche is null then 'escada' else 'revanche' end); $$;

-- ===== Funções chamadas pelo jogo =====

-- Tudo da aba Arena. ver: arena a mostrar (null = a do personagem).
create or replace function public.arena_estado(meu text, ver text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare minha text; pos int; total int; j public.arena_jackpot; cfg jsonb := public.tanka_dados() -> 'ARENA';
begin
  perform public.conferir_dono(meu);
  minha := public.arena_garantir(meu);
  perform public.arena_encerrar_abandonadas(meu);
  ver := coalesce(ver, minha, 'a1');
  j := public.arena_jackpot_atualizar(ver);
  select posicao into pos from public.arena_posicoes where personagem_id = meu and arena = ver;
  select count(*) into total from public.arena_posicoes where arena = ver;
  return jsonb_build_object(
    'minha_arena', minha, 'arena', ver, 'posicao', pos, 'total', total,
    'entradas', public.arena_entradas_atual(meu),
    'reputacao_pendente', coalesce((select sum(reputacao) from public.creditos where personagem_id = meu and not aplicado), 0),
    'jackpot', jsonb_build_object('valor', j.valor, 'top1', (select nome from public.personagens where id = j.top1)),
    'top5', coalesce((select jsonb_agg(jsonb_build_object('posicao', ap.posicao, 'id', p.id, 'nome', p.nome, 'classe', p.dados ->> 'classe', 'classe2', p.dados -> 'talentos' ->> 'classe2', 'sexo', p.dados ->> 'sexo',
        'raca', p.dados ->> 'raca', 'nivel', (p.dados ->> 'nivel')::int, 'poder', coalesce((p.dados ->> 'poder')::int, 0), 'sigla', public.sigla_de(p.id)) order by ap.posicao)
      from public.arena_posicoes ap join public.personagens p on p.id = ap.personagem_id where ap.arena = ver and ap.posicao <= 5), '[]'::jsonb),
    -- Os 5 logo acima (desafiáveis) e você.
    'alvos', case when pos is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('posicao', ap.posicao, 'id', p.id, 'nome', p.nome,
        'classe', p.dados ->> 'classe', 'classe2', p.dados -> 'talentos' ->> 'classe2', 'sexo', p.dados ->> 'sexo', 'raca', p.dados ->> 'raca', 'nivel', (p.dados ->> 'nivel')::int, 'poder', coalesce((p.dados ->> 'poder')::int, 0),
        'conta_minha', p.conta_id = auth.uid(), 'sigla', public.sigla_de(p.id), 'abaixo', ap.posicao > pos) order by ap.posicao)
      from public.arena_posicoes ap join public.personagens p on p.id = ap.personagem_id
      where ap.arena = ver and ((ap.posicao >= pos - (cfg ->> 'alcanceDesafio')::int and ap.posicao <= pos)
        or (pos <= 5 and ap.posicao > pos and ap.posicao <= 5))), '[]'::jsonb) end,
    'historico', coalesce((select jsonb_agg(h order by (h ->> 'id')::bigint desc) from (
        select jsonb_build_object('id', l.id, 'ataquei', l.atacante = meu, 'oponente', case when l.atacante = meu then l.nome_defensor else l.nome_atacante end,
          'venceu_atacante', l.situacao = 'vitoria', 'saque', l.saque, 'revanche', l.revanche_de is not null, 'quando', l.concluido_em,
          'tipo', l.tipo, 'reputacao', l.reputacao,
          'pode_revanche', l.defensor = meu and l.revanche_de is null and not l.revanche_usada and l.atacante is not null) as h
        from public.arena_lutas l where (l.atacante = meu or l.defensor = meu) and l.situacao <> 'andamento' order by l.id desc limit 10) x), '[]'::jsonb),
    'creditos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ouro', ouro, 'reputacao', reputacao, 'motivo', motivo) order by id)
      from public.creditos where personagem_id = meu and not aplicado), '[]'::jsonb));
end $$;

create or replace function public.arena_desafiar(meu text, alvo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pm int; pa int; ar text;
begin
  perform public.conferir_dono(meu);
  ar := public.arena_garantir(meu);
  if ar is null then raise exception 'A Arena abre no level 5.'; end if;
  perform public.arena_encerrar_abandonadas(meu);
  select posicao into pm from public.arena_posicoes where personagem_id = meu;
  select posicao into pa from public.arena_posicoes where personagem_id = alvo and arena = ar;
  if pa is null then raise exception 'Esse oponente não está na sua arena.'; end if;
  if (select conta_id from public.personagens where id = alvo) = auth.uid() then raise exception 'Esse personagem é seu.'; end if;
  if pa < pm and pm - pa <= (public.tanka_dados() -> 'ARENA' ->> 'alcanceDesafio')::int then
    return public.arena_comecar_tipo(meu, alvo, null, 'escada');
  end if;
  -- Top 5: também ataca para baixo até o 5º (só reputação, metade, e ouro; não muda posição)
  if pm <= 5 and pa > pm and pa <= 5 then return public.arena_comecar_tipo(meu, alvo, null, 'top5'); end if;
  raise exception 'Só dá para desafiar os 5 logo acima de você (no Top 5, também os de baixo até o 5º lugar).';
end $$;

-- Ataque pelo Ranking (fora da escada): qualquer personagem que já entrou na Arena (level 5+), de qualquer arena.
-- Não muda posição nem jackpot; recompensa em arena_finalizar (arena abaixo = nada; posição inferior = metade da reputação).
create or replace function public.arena_atacar(meu text, alvo text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  if public.arena_garantir(meu) is null then raise exception 'A Arena abre no level 5.'; end if;
  if alvo = meu or (select conta_id from public.personagens where id = alvo) = auth.uid() then raise exception 'Esse personagem é seu.'; end if;
  if not exists (select 1 from public.personagens p join public.contas c on c.id = p.conta_id where p.id = alvo and not c.admin) then
    raise exception 'Personagem não encontrado.'; end if;
  if public.arena_garantir(alvo) is null then raise exception 'Esse personagem ainda não chegou na Arena (level 5).'; end if;
  perform public.arena_encerrar_abandonadas(meu);
  return public.arena_comecar_tipo(meu, alvo, null, 'livre');
end $$;

create or replace function public.arena_revanche(meu text, luta bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare L public.arena_lutas;
begin
  perform public.conferir_dono(meu);
  select * into L from public.arena_lutas where id = luta for update;
  if L.id is null or L.defensor is distinct from meu or L.situacao = 'andamento' or L.revanche_de is not null or L.atacante is null then
    raise exception 'Revanche indisponível.';
  end if;
  if L.revanche_usada then raise exception 'Você já fez a revanche dessa luta.'; end if;
  if public.arena_garantir(meu) is null then raise exception 'A Arena abre no level 5.'; end if;
  update public.arena_lutas set revanche_usada = true where id = luta;
  return public.arena_comecar_tipo(meu, L.atacante, luta, 'revanche');
end $$;

create or replace function public.arena_rolar(meu text, luta bigint, rolar boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  if (select atacante from public.arena_lutas where id = luta) is distinct from meu then raise exception 'Luta não encontrada.'; end if;
  perform public.arena_jogar(luta, rolar);
  return public.arena_luta_json(luta);
end $$;

-- O jogo aplica o crédito (ouro/reputação) no personagem e avisa que aplicou.
create or replace function public.credito_aplicar(meu text, credito bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.creditos;
begin
  perform public.conferir_dono(meu);
  update public.creditos set aplicado = true where id = credito and personagem_id = meu and not aplicado returning * into c;
  if c.id is null then raise exception 'Crédito não encontrado.'; end if;
  return jsonb_build_object('ouro', c.ouro, 'reputacao', c.reputacao, 'motivo', c.motivo);
end $$;

-- Perfil do adversário (antes de desafiar): equipamentos, atributos, ouro, posição e campanha na Arena.
create or replace function public.arena_perfil(meu text, alvo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.personagens;
begin
  perform public.conferir_dono(meu);
  select * into p from public.personagens where id = alvo;
  if p.id is null then raise exception 'Personagem não encontrado.'; end if;
  return jsonb_build_object('id', p.id, 'nome', p.nome, 'raca', p.dados ->> 'raca', 'classe', p.dados ->> 'classe', 'classe2', p.dados -> 'talentos' ->> 'classe2', 'sexo', p.dados ->> 'sexo',
    'nivel', coalesce((p.dados ->> 'nivel')::int, 1), 'atributos', p.dados -> 'atributos',
    'equipados', coalesce(p.dados -> 'equipados', '{}'::jsonb),
    'itens', coalesce((select jsonb_agg(i) from jsonb_array_elements(coalesce(p.dados -> 'inventario', '[]'::jsonb)) i
      where i ->> 'id' in (select value from jsonb_each_text(coalesce(p.dados -> 'equipados', '{}'::jsonb)))), '[]'::jsonb),
    'ouro', public.ouro_real(p.id), 'reputacao', coalesce((p.dados ->> 'reputacao')::int, 0),
    'alianca', (select jsonb_build_object('nome', a.nome, 'sigla', a.sigla, 'brasao', a.brasao)
      from public.alianca_membros m join public.aliancas a on a.id = m.alianca_id where m.personagem_id = p.id),
    'skin', coalesce(p.dados ->> 'skinDado', 'vermelho'),
    'posicao', (select posicao from public.arena_posicoes where personagem_id = p.id),
    'arena', (select arena from public.arena_posicoes where personagem_id = p.id),
    'vitorias', (select count(*) from public.arena_lutas where (atacante = p.id and situacao = 'vitoria') or (defensor = p.id and situacao = 'derrota')),
    'derrotas', (select count(*) from public.arena_lutas where (atacante = p.id and situacao = 'derrota') or (defensor = p.id and situacao = 'vitoria')));
end $$;

create or replace function public.arena_admin_recarregar(meu text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  if not public.eh_admin() then raise exception 'Só administradores.'; end if;
  insert into public.arena_entradas (personagem_id, valor) values (meu, 5)
  on conflict (personagem_id) do update set valor = 5, atualizado_em = now();
end $$;

revoke execute on function public.arena_estado(text, text), public.arena_desafiar(text, text), public.arena_revanche(text, bigint),
  public.arena_rolar(text, bigint, boolean), public.credito_aplicar(text, bigint), public.arena_admin_recarregar(text), public.arena_perfil(text, text),
  public.arena_atacar(text, text) from public, anon;
grant execute on function public.arena_estado(text, text), public.arena_desafiar(text, text), public.arena_revanche(text, bigint),
  public.arena_rolar(text, bigint, boolean), public.credito_aplicar(text, bigint), public.arena_admin_recarregar(text), public.arena_perfil(text, text),
  public.arena_atacar(text, text) to authenticated;
revoke execute on function public.arena_comecar_tipo(text, text, bigint, text), public.arena_indice(text), public.arena_inicio_semana()
  from public, anon, authenticated;
revoke execute on function public.tanka_status(jsonb), public.arena_de_nivel(int), public.arena_compactar(text), public.arena_garantir(text),
  public.arena_entradas_atual(text), public.arena_gastar_entrada(text), public.creditar(text, int, int, text), public.ouro_real(text),
  public.arena_jackpot_atualizar(text), public.arena_lutador(text), public.arena_golpe(jsonb, jsonb, int), public.arena_finalizar(bigint, boolean),
  public.arena_avancar(bigint), public.arena_jogar(bigint, boolean), public.arena_encerrar_abandonadas(text), public.arena_luta_json(bigint),
  public.arena_comecar(text, text, bigint), public.arena_pontos_ok(jsonb), public.arena_passiva(jsonb), public.arena_kit(jsonb),
  public.arena_buff(jsonb, text), public.arena_vez(jsonb, jsonb, int), public.arena_kit(jsonb, text), public.arena_lutador(text, text),
  public.arena_pontos_arma(jsonb), public.arena_milagre(jsonb), public.arena_milagre_usar(jsonb), public.arena_extras(jsonb),
  public.arena_curar(jsonb, numeric)
  from public, anon, authenticated;

-- ---------- Alianças ----------
-- Tudo passa pelas funções abaixo (sem acesso direto às tabelas). Ouro e reputação gastos saem
-- do personagem pelo sistema de créditos (o jogo aplica na próxima atualização).
-- (as tabelas das alianças ficam lá em cima, junto dos personagens)

create or replace function public.alianca_cfg() returns jsonb
language sql immutable as $$ select public.tanka_dados() -> 'ALIANCA'; $$;

-- Sigla da aliança do personagem (null se não tem).
create or replace function public.sigla_de(pid text) returns text
language sql stable security definer set search_path = public as $$
  select a.sigla from public.alianca_membros m join public.aliancas a on a.id = m.alianca_id where m.personagem_id = pid;
$$;

create or replace function public.reputacao_real(pid text) returns int
language sql stable as $$
  select greatest(0, coalesce((select (dados ->> 'reputacao')::int from public.personagens where id = pid), 0)
    + coalesce((select sum(reputacao) from public.creditos where personagem_id = pid and not aplicado), 0))::int;
$$;

create or replace function public.alianca_vagas(nivel int) returns int
language sql immutable as $$
  select (public.alianca_cfg() ->> 'vagasIniciais')::int + (nivel - 1) * (public.alianca_cfg() ->> 'vagasPorNivel')::int;
$$;

-- % dos bônus: 5 no Lv1 até 15 no Lv10.
create or replace function public.alianca_bonus_pct(nivel int) returns int
language sql immutable as $$
  select floor((public.alianca_cfg() -> 'bonus' ->> 'minimo')::numeric
    + (nivel - 1) * ((public.alianca_cfg() -> 'bonus' ->> 'maximo')::numeric - (public.alianca_cfg() -> 'bonus' ->> 'minimo')::numeric)
      / ((public.alianca_cfg() ->> 'nivelMax')::int - 1))::int;
$$;

-- Membro e cargo de quem chama (erro se não estiver em aliança).
create or replace function public.alianca_minha(meu text) returns public.alianca_membros
language plpgsql stable security definer set search_path = public as $$
declare m public.alianca_membros;
begin
  select * into m from public.alianca_membros where personagem_id = meu;
  if m.personagem_id is null then raise exception 'Você não está em um clã.'; end if;
  return m;
end $$;

create or replace function public.alianca_texto_valido(t text, minimo int, maximo int, oque text) returns text
language plpgsql immutable as $$
begin
  t := btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'));
  if char_length(t) < minimo or char_length(t) > maximo then raise exception '% deve ter de % a % letras.', oque, minimo, maximo; end if;
  if t !~ '^[[:alnum:] À-ÿ''-]+$' then raise exception '% só pode ter letras, números e espaços.', oque; end if;
  return t;
end $$;

-- Se o líder sumiu (14 dias), a liderança passa para o oficial (ou membro) mais antigo que jogou nos últimos 3 dias.
create or replace function public.alianca_conferir_lider(aid bigint) returns void
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.alianca_cfg(); lider_id text; visto timestamptz; novo text;
begin
  select m.personagem_id, p.atualizado_em into lider_id, visto
  from public.alianca_membros m join public.personagens p on p.id = m.personagem_id
  where m.alianca_id = aid and m.cargo = 'lider';
  if lider_id is not null and visto > now() - make_interval(days => (cfg ->> 'liderSumidoDias')::int) then return; end if;
  select m.personagem_id into novo from public.alianca_membros m join public.personagens p on p.id = m.personagem_id
  where m.alianca_id = aid and m.cargo <> 'lider' and p.atualizado_em > now() - make_interval(days => (cfg ->> 'ativoDias')::int)
  order by case m.cargo when 'vice' then 0 when 'oficial' then 1 else 2 end, m.entrou_em limit 1;
  if novo is null then return; end if;
  update public.alianca_membros set cargo = 'membro' where personagem_id = lider_id;
  update public.alianca_membros set cargo = 'lider' where personagem_id = novo;
end $$;

-- Coloca o personagem na aliança (confere vagas, espera de 24 h e se já está em outra).
create or replace function public.alianca_entrar(pid text, aid bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.aliancas; ate timestamptz;
begin
  if exists (select 1 from public.alianca_membros where personagem_id = pid) then raise exception 'Esse personagem já está em um clã.'; end if;
  select e.ate into ate from public.alianca_espera e where personagem_id = pid;
  if ate is not null and ate > now() then
    raise exception 'Só dá para entrar em outro clã depois de %.', to_char(ate at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI');
  end if;
  select * into a from public.aliancas where id = aid for update;
  if a.id is null then raise exception 'Clã não encontrado.'; end if;
  if (select count(*) from public.alianca_membros where alianca_id = aid) >= public.alianca_vagas(a.nivel) then
    raise exception 'O clã está cheio.';
  end if;
  insert into public.alianca_membros (personagem_id, alianca_id) values (pid, aid);
  delete from public.alianca_convites where personagem_id = pid;
end $$;

-- (plpgsql: o boss da aliança é criado mais abaixo no arquivo.)
create or replace function public.alianca_registrar_saida(pid text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.alianca_espera (personagem_id, ate) values (pid, now() + make_interval(hours => (public.alianca_cfg() ->> 'esperaHoras')::int))
  on conflict (personagem_id) do update set ate = excluded.ate;
  perform public.alianca_boss_sala_sair_de(pid);   -- sai do grupo do boss
end $$;

create or replace function public.alianca_resumo(a public.aliancas) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'nome', a.nome, 'sigla', a.sigla, 'brasao', a.brasao, 'nivel', a.nivel,
    'membros', (select count(*) from public.alianca_membros where alianca_id = a.id), 'vagas', public.alianca_vagas(a.nivel),
    'poder', coalesce((select sum(coalesce((p.dados ->> 'poder')::bigint, 0)) from public.alianca_membros m join public.personagens p on p.id = m.personagem_id where m.alianca_id = a.id), 0));
$$;

-- ===== Funções chamadas pelo jogo =====

-- Tudo o que a aba Aliança precisa. busca: filtra a lista de alianças pelo nome ou sigla.
create or replace function public.alianca_estado(meu text, busca text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros; a public.aliancas; pct int;
begin
  perform public.conferir_dono(meu);
  select * into m from public.alianca_membros where personagem_id = meu;
  if m.personagem_id is null then
    return jsonb_build_object('alianca', null,
      'espera_ate', (select ate from public.alianca_espera where personagem_id = meu and ate > now()),
      'convites', coalesce((select jsonb_agg(public.alianca_resumo(x) || jsonb_build_object('convite', c.id) order by c.id desc)
        from public.alianca_convites c join public.aliancas x on x.id = c.alianca_id where c.personagem_id = meu and c.tipo = 'convite'), '[]'::jsonb),
      'pedidos_feitos', coalesce((select jsonb_agg(c.alianca_id) from public.alianca_convites c where c.personagem_id = meu and c.tipo = 'pedido'), '[]'::jsonb),
      'lista', coalesce((select jsonb_agg(r order by (r ->> 'poder')::bigint desc) from (
        select public.alianca_resumo(x) r from public.aliancas x
        where coalesce(btrim(busca), '') = '' or x.nome ilike '%' || btrim(busca) || '%' or x.sigla ilike '%' || btrim(busca) || '%'
        limit 50) t), '[]'::jsonb));
  end if;
  perform public.alianca_conferir_lider(m.alianca_id);
  select * into m from public.alianca_membros where personagem_id = meu;
  select * into a from public.aliancas where id = m.alianca_id;
  pct := public.alianca_bonus_pct(a.nivel);
  return public.alianca_extras(a.id, meu) || jsonb_build_object(
    'alianca', public.alianca_resumo(a) || jsonb_build_object('exp', a.exp, 'tesouro', a.tesouro, 'mural', a.mural,
      'exp_proximo', case when a.nivel >= (public.alianca_cfg() ->> 'nivelMax')::int then null else (public.alianca_cfg() -> 'expProximo' ->> (a.nivel - 1))::bigint end,
      'bonus_pct', pct, 'bonus_exp_ate', case when a.bonus_exp_ate > now() then a.bonus_exp_ate end,
      'bonus_ouro_ate', case when a.bonus_ouro_ate > now() then a.bonus_ouro_ate end),
    'meu_cargo', m.cargo,
    'membros', (select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'cargo', x.cargo, 'classe', p.dados ->> 'classe', 'classe2', p.dados -> 'talentos' ->> 'classe2', 'sexo', p.dados ->> 'sexo', 'raca', p.dados ->> 'raca',
        'nivel', coalesce((p.dados ->> 'nivel')::int, 1), 'poder', coalesce((p.dados ->> 'poder')::bigint, 0),
        'contribuicao', x.contribuicao, 'visto_em', p.atualizado_em)
        order by case x.cargo when 'lider' then 0 when 'vice' then 1 when 'oficial' then 2 else 3 end, x.contribuicao desc, p.nome)
      from public.alianca_membros x join public.personagens p on p.id = x.personagem_id where x.alianca_id = a.id),
    'pedidos', case when m.cargo in ('lider', 'vice', 'oficial') then coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', p.nome,
        'classe', p.dados ->> 'classe', 'classe2', p.dados -> 'talentos' ->> 'classe2', 'sexo', p.dados ->> 'sexo', 'nivel', coalesce((p.dados ->> 'nivel')::int, 1), 'poder', coalesce((p.dados ->> 'poder')::bigint, 0)) order by c.id)
      from public.alianca_convites c join public.personagens p on p.id = c.personagem_id where c.alianca_id = a.id and c.tipo = 'pedido'), '[]'::jsonb) else '[]'::jsonb end);
end $$;

create or replace function public.alianca_criar(meu text, nome text, sigla text, brasao jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.alianca_cfg(); d jsonb; aid bigint;
begin
  perform public.conferir_dono(meu);
  select dados into d from public.personagens where id = meu;
  if coalesce((d ->> 'nivel')::int, 1) < (cfg ->> 'nivelMin')::int then raise exception 'Precisa ser level % para criar um clã.', cfg ->> 'nivelMin'; end if;
  nome := public.alianca_texto_valido(nome, 3, 20, 'O nome');
  sigla := upper(btrim(coalesce(sigla, '')));
  if sigla !~ '^[A-Z0-9]{3,4}$' then raise exception 'A sigla deve ter 3 ou 4 letras ou números, sem espaço.'; end if;
  if exists (select 1 from public.aliancas where lower(aliancas.nome) = lower(alianca_criar.nome)) then raise exception 'Já existe um clã com esse nome.'; end if;
  if exists (select 1 from public.aliancas where upper(aliancas.sigla) = alianca_criar.sigla) then raise exception 'Essa sigla já está em uso.'; end if;
  if public.ouro_real(meu) < (cfg ->> 'custoOuro')::int then raise exception 'Ouro insuficiente (precisa de %).', cfg ->> 'custoOuro'; end if;
  if public.reputacao_real(meu) < (cfg ->> 'custoReputacao')::int then raise exception 'Reputação insuficiente (precisa de %).', cfg ->> 'custoReputacao'; end if;
  if exists (select 1 from public.alianca_membros where personagem_id = meu) then raise exception 'Você já está em um clã.'; end if;
  insert into public.aliancas (nome, sigla, brasao) values (nome, sigla, coalesce(brasao, '{}'::jsonb)) returning id into aid;
  delete from public.alianca_espera where personagem_id = meu;
  perform public.alianca_entrar(meu, aid);
  update public.alianca_membros set cargo = 'lider' where personagem_id = meu;
  perform public.creditar(meu, -(cfg ->> 'custoOuro')::int, -(cfg ->> 'custoReputacao')::int, 'Fundação do clã ' || nome);
end $$;

-- Líder ou oficial convida pelo nome do personagem.
create or replace function public.alianca_convidar(meu text, nome_alvo text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu); alvo public.personagens;
begin
  perform public.conferir_dono(meu);
  if m.cargo = 'membro' then raise exception 'Só o líder e os oficiais convidam.'; end if;
  select * into alvo from public.personagens where lower(nome) = lower(btrim(nome_alvo));
  if alvo.id is null then raise exception 'Nenhum personagem com esse nome.'; end if;
  if exists (select 1 from public.alianca_membros where personagem_id = alvo.id) then raise exception '% já está em um clã.', alvo.nome; end if;
  if exists (select 1 from public.alianca_convites where personagem_id = alvo.id and alianca_id = m.alianca_id and tipo = 'pedido') then
    perform public.alianca_entrar(alvo.id, m.alianca_id);   -- ele já tinha pedido: entra direto
    return;
  end if;
  insert into public.alianca_convites (alianca_id, personagem_id, tipo) values (m.alianca_id, alvo.id, 'convite')
  on conflict (alianca_id, personagem_id) do nothing;
end $$;

-- Quem foi convidado aceita ou recusa.
create or replace function public.alianca_responder(meu text, convite bigint, aceitar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c public.alianca_convites;
begin
  perform public.conferir_dono(meu);
  select * into c from public.alianca_convites where id = convite and personagem_id = meu and tipo = 'convite';
  if c.id is null then raise exception 'Convite não encontrado.'; end if;
  if aceitar then perform public.alianca_entrar(meu, c.alianca_id);
  else delete from public.alianca_convites where id = convite; end if;
end $$;

create or replace function public.alianca_pedir(meu text, aid bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  if exists (select 1 from public.alianca_membros where personagem_id = meu) then raise exception 'Você já está em um clã.'; end if;
  if not exists (select 1 from public.aliancas where id = aid) then raise exception 'Clã não encontrado.'; end if;
  if exists (select 1 from public.alianca_convites where personagem_id = meu and alianca_id = aid and tipo = 'convite') then
    perform public.alianca_entrar(meu, aid);   -- já tinha convite: entra direto
    return;
  end if;
  insert into public.alianca_convites (alianca_id, personagem_id, tipo) values (aid, meu, 'pedido')
  on conflict (alianca_id, personagem_id) do nothing;
end $$;

-- Líder ou oficial aceita ou recusa um pedido para entrar.
create or replace function public.alianca_decidir(meu text, pedido bigint, aceitar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu); c public.alianca_convites;
begin
  perform public.conferir_dono(meu);
  if m.cargo = 'membro' then raise exception 'Só o líder e os oficiais aceitam pedidos.'; end if;
  select * into c from public.alianca_convites where id = pedido and alianca_id = m.alianca_id and tipo = 'pedido';
  if c.id is null then raise exception 'Pedido não encontrado.'; end if;
  if aceitar then perform public.alianca_entrar(c.personagem_id, m.alianca_id);
  else delete from public.alianca_convites where id = pedido; end if;
end $$;

create or replace function public.alianca_sair(meu text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu);
begin
  perform public.conferir_dono(meu);
  if m.cargo = 'lider' then raise exception 'Passe a liderança antes de sair (ou desfaça o clã).'; end if;
  delete from public.alianca_membros where personagem_id = meu;
  perform public.alianca_registrar_saida(meu);
end $$;

create or replace function public.alianca_expulsar(meu text, alvo text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu); x public.alianca_membros;
begin
  perform public.conferir_dono(meu);
  select * into x from public.alianca_membros where personagem_id = alvo and alianca_id = m.alianca_id;
  if x.personagem_id is null then raise exception 'Esse personagem não é do seu clã.'; end if;
  if m.cargo = 'membro' or x.cargo = 'lider' or (m.cargo = 'oficial' and x.cargo <> 'membro') or (m.cargo = 'vice' and x.cargo = 'vice') then
    raise exception 'Você não pode expulsar esse membro.';
  end if;
  delete from public.alianca_membros where personagem_id = alvo;
  perform public.alianca_registrar_saida(alvo);
end $$;

-- Líder: cargo 'vice', 'oficial' ou 'membro' para outro, ou 'lider' para passar a liderança.
-- Vice-líder: só 'oficial' ou 'membro', e só para oficiais e membros.
create or replace function public.alianca_cargo(meu text, alvo text, cargo text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu); x public.alianca_membros;
begin
  perform public.conferir_dono(meu);
  if m.cargo not in ('lider', 'vice') then raise exception 'Só o líder e o vice-líder mudam cargos.'; end if;
  select * into x from public.alianca_membros where personagem_id = alvo and alianca_id = m.alianca_id;
  if x.personagem_id is null or alvo = meu then raise exception 'Membro inválido.'; end if;
  if m.cargo = 'vice' and (cargo not in ('oficial', 'membro') or x.cargo not in ('oficial', 'membro')) then
    raise exception 'O vice-líder só promove e rebaixa oficiais.';
  end if;
  if cargo = 'vice' then
    update public.alianca_membros set cargo = 'oficial' where alianca_id = m.alianca_id and alianca_membros.cargo = 'vice' and personagem_id <> alvo;
    update public.alianca_membros set cargo = 'vice' where personagem_id = alvo;
  elsif cargo = 'oficial' then
    if x.cargo <> 'oficial' and (select count(*) from public.alianca_membros where alianca_id = m.alianca_id and alianca_membros.cargo = 'oficial')
       >= (public.alianca_cfg() ->> 'maxOficiais')::int then raise exception 'Máximo de % oficiais.', public.alianca_cfg() ->> 'maxOficiais'; end if;
    update public.alianca_membros set cargo = 'oficial' where personagem_id = alvo;
  elsif cargo = 'membro' then
    update public.alianca_membros set cargo = 'membro' where personagem_id = alvo;
  elsif cargo = 'lider' then
    update public.alianca_membros set cargo = 'oficial' where personagem_id = meu;
    update public.alianca_membros set cargo = 'lider' where personagem_id = alvo;
  else raise exception 'Cargo inválido.'; end if;
end $$;

create or replace function public.alianca_desfazer(meu text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu);
begin
  perform public.conferir_dono(meu);
  if m.cargo <> 'lider' then raise exception 'Só o líder desfaz o clã.'; end if;
  delete from public.aliancas where id = m.alianca_id;
end $$;

create or replace function public.alianca_mural(meu text, texto text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu);
begin
  perform public.conferir_dono(meu);
  if m.cargo = 'membro' then raise exception 'Só o líder e os oficiais escrevem no mural.'; end if;
  update public.aliancas set mural = left(btrim(coalesce(texto, '')), (public.alianca_cfg() ->> 'muralMax')::int) where id = m.alianca_id;
end $$;

create or replace function public.alianca_brasao(meu text, brasao jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu);
begin
  perform public.conferir_dono(meu);
  if m.cargo not in ('lider', 'vice') then raise exception 'Só o líder e o vice-líder mudam o brasão.'; end if;
  update public.aliancas set brasao = coalesce(alianca_brasao.brasao, '{}'::jsonb) where id = m.alianca_id;
end $$;

-- Doação ao tesouro: vira contribuição do membro e exp da aliança (pode subir de level).
create or replace function public.alianca_doar(meu text, valor int) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu); cfg jsonb := public.alianca_cfg(); a public.aliancas; prox bigint;
  maximo int := coalesce((cfg ->> 'doacaoMaxDia')::int, 2147483647); hoje int;
begin
  perform public.conferir_dono(meu);
  if valor < (cfg ->> 'doacaoMinima')::int then raise exception 'Doação mínima: % de ouro.', cfg ->> 'doacaoMinima'; end if;
  -- Limite por dia (Daniel, nov/2026): cada jogador doa no máximo doacaoMaxDia por dia.
  hoje := coalesce((select d.valor from public.alianca_doacoes d where d.personagem_id = meu and d.dia = public.dia_jogo()), 0);
  if hoje + valor > maximo then
    raise exception 'Limite de doação: % de ouro por dia (hoje você ainda pode doar %).', maximo, greatest(0, maximo - hoje);
  end if;
  if public.ouro_real(meu) < valor then raise exception 'Ouro insuficiente.'; end if;
  perform public.creditar(meu, -valor, 0, 'Doação ao tesouro do clã');
  insert into public.alianca_doacoes (personagem_id, dia, valor) values (meu, public.dia_jogo(), valor)
    on conflict (personagem_id, dia) do update set valor = public.alianca_doacoes.valor + excluded.valor;
  update public.alianca_membros set contribuicao = contribuicao + valor where personagem_id = meu;
  update public.aliancas set tesouro = tesouro + valor, exp = exp + valor where id = m.alianca_id returning * into a;
  loop
    exit when a.nivel >= (cfg ->> 'nivelMax')::int;
    prox := (cfg -> 'expProximo' ->> (a.nivel - 1))::bigint;
    exit when a.exp < prox;
    update public.aliancas set nivel = nivel + 1, exp = exp - prox where id = a.id returning * into a;
  end loop;
end $$;

-- Líder ativa (ou renova por mais 7 dias) um bônus: 'exp' ou 'ouro'.
create or replace function public.alianca_bonus(meu text, tipo text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu); cfg jsonb := public.alianca_cfg(); custo int := (cfg -> 'bonus' ->> 'custo')::int;
  dias interval := make_interval(days => (cfg -> 'bonus' ->> 'dias')::int);
begin
  perform public.conferir_dono(meu);
  if m.cargo <> 'lider' then raise exception 'Só o líder ativa os bônus.'; end if;
  if tipo not in ('exp', 'ouro') then raise exception 'Bônus inválido.'; end if;
  if (select tesouro from public.aliancas where id = m.alianca_id) < custo then raise exception 'O tesouro precisa de % de ouro.', custo; end if;
  update public.aliancas set tesouro = tesouro - custo,
    bonus_exp_ate = case when tipo = 'exp' then greatest(coalesce(bonus_exp_ate, now()), now()) + dias else bonus_exp_ate end,
    bonus_ouro_ate = case when tipo = 'ouro' then greatest(coalesce(bonus_ouro_ate, now()), now()) + dias else bonus_ouro_ate end
  where id = m.alianca_id;
end $$;

-- Chat da aliança: últimas 100 (ou as novas depois de um id) e enviar (1 a cada 3 s).
create or replace function public.alianca_chat(meu text, depois bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu);
begin
  perform public.conferir_dono(meu);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'personagem', personagem, 'cargo', cargo, 'texto', texto, 'criado_em', criado_em) order by id)
    from (select * from public.alianca_mensagens where alianca_id = m.alianca_id and id > coalesce(depois, 0) order by id desc limit 100) t), '[]'::jsonb);
end $$;

create or replace function public.alianca_chat_enviar(meu text, texto text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu); nome text;
begin
  perform public.conferir_dono(meu);
  texto := btrim(coalesce(texto, ''));
  if texto = '' then raise exception 'Mensagem vazia.'; end if;
  select p.nome into nome from public.personagens p where p.id = meu;
  if exists (select 1 from public.alianca_mensagens where alianca_id = m.alianca_id and personagem = nome and criado_em > now() - interval '3 seconds') then
    raise exception 'Calma! Espere 3 segundos entre as mensagens.';
  end if;
  insert into public.alianca_mensagens (alianca_id, personagem, cargo, texto) values (m.alianca_id, nome, m.cargo, left(texto, 200));
  delete from public.alianca_mensagens where criado_em < now() - interval '7 days';
end $$;

-- Admin: lista todas e age sobre uma. acao: 'renomear' (valor = nome novo), 'apagar', 'exp' (valor = quantidade), 'lider' (valor = nome do personagem).
create or replace function public.alianca_admin(meu text, aid bigint, acao text, valor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.alianca_cfg(); a public.aliancas; novo public.personagens; prox bigint;
begin
  perform public.conferir_dono(meu);
  if not public.eh_admin() then raise exception 'Só administradores.'; end if;
  if acao = 'renomear' then
    update public.aliancas set nome = public.alianca_texto_valido(valor, 3, 20, 'O nome') where id = aid;
  elsif acao = 'apagar' then
    delete from public.aliancas where id = aid;
  elsif acao = 'exp' then
    update public.aliancas set exp = greatest(0, exp + valor::bigint) where id = aid returning * into a;
    loop
      exit when a.id is null or a.nivel >= (cfg ->> 'nivelMax')::int;
      prox := (cfg -> 'expProximo' ->> (a.nivel - 1))::bigint;
      exit when a.exp < prox;
      update public.aliancas set nivel = nivel + 1, exp = exp - prox where id = a.id returning * into a;
    end loop;
  elsif acao = 'lider' then
    select p.* into novo from public.personagens p join public.alianca_membros m on m.personagem_id = p.id
    where m.alianca_id = aid and lower(p.nome) = lower(btrim(valor));
    if novo.id is null then raise exception 'Esse personagem não é desse clã.'; end if;
    update public.alianca_membros set cargo = 'oficial' where alianca_id = aid and cargo = 'lider';
    update public.alianca_membros set cargo = 'lider' where personagem_id = novo.id;
  end if;
  return coalesce((select jsonb_agg(public.alianca_resumo(x) || jsonb_build_object('lider',
      (select p.nome from public.alianca_membros m join public.personagens p on p.id = m.personagem_id where m.alianca_id = x.id and m.cargo = 'lider'))
    order by x.nome) from public.aliancas x), '[]'::jsonb);
end $$;

revoke execute on function public.alianca_cfg(), public.reputacao_real(text), public.alianca_vagas(int), public.alianca_bonus_pct(int),
  public.alianca_minha(text), public.alianca_texto_valido(text, int, int, text), public.alianca_conferir_lider(bigint),
  public.alianca_entrar(text, bigint), public.alianca_registrar_saida(text), public.alianca_resumo(public.aliancas), public.sigla_de(text)
  from public, anon, authenticated;
revoke execute on function public.alianca_estado(text, text), public.alianca_criar(text, text, text, jsonb), public.alianca_convidar(text, text),
  public.alianca_responder(text, bigint, boolean), public.alianca_pedir(text, bigint), public.alianca_decidir(text, bigint, boolean),
  public.alianca_sair(text), public.alianca_expulsar(text, text), public.alianca_cargo(text, text, text), public.alianca_desfazer(text),
  public.alianca_mural(text, text), public.alianca_brasao(text, jsonb), public.alianca_doar(text, int), public.alianca_bonus(text, text),
  public.alianca_chat(text, bigint), public.alianca_chat_enviar(text, text), public.alianca_admin(text, bigint, text, text) from public, anon;
grant execute on function public.alianca_estado(text, text), public.alianca_criar(text, text, text, jsonb), public.alianca_convidar(text, text),
  public.alianca_responder(text, bigint, boolean), public.alianca_pedir(text, bigint), public.alianca_decidir(text, bigint, boolean),
  public.alianca_sair(text), public.alianca_expulsar(text, text), public.alianca_cargo(text, text, text), public.alianca_desfazer(text),
  public.alianca_mural(text, text), public.alianca_brasao(text, jsonb), public.alianca_doar(text, int), public.alianca_bonus(text, text),
  public.alianca_chat(text, bigint), public.alianca_chat_enviar(text, text), public.alianca_admin(text, bigint, text, text) to authenticated;

-- ======================================================================
-- ---------- Leilão do servidor (Mercado > Leilão) ----------
-- Números em js/dados.js (LEILAO), copiados para tanka_dados(). Uma rodada por faixa (l1 10–19, l2 20–29, l3 30+),
-- sempre rodando: quando acaba, quem abrir o leilão fecha a rodada (entrega os itens) e abre outra.
-- Ouro: o lance vira um crédito negativo de quem deu o lance e o lance coberto volta como crédito positivo
-- (o jogo aplica os créditos, igual ao saque da Arena). O item vencedor vai para recompensas (como a joia da masmorra)
-- com a semente; o jogo gera o item com R.itemDoLote.
create table if not exists public.leiloes (
  id bigint generated always as identity primary key,
  faixa text not null,
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  muito_curto_em timestamptz not null,   -- quando entra em "Muito curto" (1 a 4 min antes do fim, sorteado)
  fechado boolean not null default false
);
create index if not exists leiloes_abertos on public.leiloes (faixa) where not fechado;
create table if not exists public.leilao_lotes (
  id bigint generated always as identity primary key,
  leilao_id bigint not null references public.leiloes (id) on delete cascade,
  ordem int not null,
  tipo text not null,          -- arma | armadura | joia | pergaminho
  classe text,                 -- classe base (arma e armadura)
  raridade text not null,
  nivel int not null,
  semente bigint not null,
  qtd int not null default 1,  -- pergaminhos do pacote
  minimo bigint not null,
  lance bigint,
  lider text references public.personagens (id) on delete set null,
  lances int not null default 0,
  atualizado_em timestamptz not null default now()
);
create index if not exists leilao_lotes_leilao on public.leilao_lotes (leilao_id, ordem);
alter table public.leiloes enable row level security;
alter table public.leilao_lotes enable row level security;

-- Raridade sorteada pelos pesos da faixa ({ comum, rara, epica, lendaria }); `minima` corta as mais fracas.
create or replace function public.leilao_raridade(pesos jsonb, minima text default 'comum') returns text
language plpgsql volatile as $$
declare ordem text[] := array['comum', 'rara', 'epica', 'lendaria']; total numeric := 0; r numeric; k text; i int;
begin
  for i in array_position(ordem, minima)..4 loop total := total + coalesce((pesos ->> ordem[i])::numeric, 0); end loop;
  if total <= 0 then return minima; end if;
  r := random() * total;
  for i in array_position(ordem, minima)..4 loop
    k := ordem[i];
    r := r - coalesce((pesos ->> k)::numeric, 0);
    if r < 0 then return k; end if;
  end loop;
  return 'lendaria';
end $$;

-- Abre uma rodada nova da faixa com os 12 lotes.
create or replace function public.leilao_criar(fx text) returns bigint
language plpgsql volatile security definer set search_path = public as $$
declare L jsonb := public.tanka_dados() -> 'LEILAO'; cfg jsonb; lid bigint; dur int; mc int; classes text[] := array['cavaleiro', 'arqueiro', 'mago', 'artesao'];
  epArma int := 1 + floor(random() * 4)::int; epArm int := 1 + floor(random() * 4)::int; joiaBoa int := 1 + floor(random() * 2)::int;
  i int; rar text; niv int; ordem int := 0;
begin
  select x into cfg from jsonb_array_elements(L -> 'faixas') x where x ->> 'id' = fx;
  if cfg is null then raise exception 'Faixa de leilão inválida.'; end if;
  dur := (L ->> 'duracaoMin')::int;
  mc := (L -> 'muitoCurto' ->> 0)::int + floor(random() * ((L -> 'muitoCurto' ->> 1)::int - (L -> 'muitoCurto' ->> 0)::int + 1))::int;
  insert into public.leiloes (faixa, fim, muito_curto_em)
    values (fx, now() + make_interval(mins => dur), now() + make_interval(mins => dur) - make_interval(mins => mc)) returning id into lid;
  -- 4 armas e 4 armaduras (uma de cada classe); uma de cada garantida épica (ou lendária)
  for i in 1..8 loop
    rar := case when (i <= 4 and i = epArma) or (i > 4 and i - 4 = epArm) then public.leilao_raridade(cfg -> 'raridades', 'epica')
                else public.leilao_raridade(cfg -> 'raridades') end;
    ordem := ordem + 1;
    insert into public.leilao_lotes (leilao_id, ordem, tipo, classe, raridade, nivel, semente, minimo)
    values (lid, ordem, case when i <= 4 then 'arma' else 'armadura' end, classes[1 + (i - 1) % 4], rar,
      (cfg -> 'itemNivel' ->> 0)::int + floor(random() * ((cfg -> 'itemNivel' ->> 1)::int - (cfg -> 'itemNivel' ->> 0)::int + 1))::int,
      floor(random() * 2147483647)::bigint, (L -> 'minimo' ->> rar)::bigint * (cfg ->> 'mult')::bigint);
  end loop;
  -- 2 joias; uma garantida rara (ou melhor)
  for i in 1..2 loop
    rar := public.leilao_raridade(cfg -> 'raridades', case when i = joiaBoa then 'rara' else 'comum' end);
    ordem := ordem + 1;
    insert into public.leilao_lotes (leilao_id, ordem, tipo, raridade, nivel, semente, minimo)
    values (lid, ordem, 'joia', rar,
      (cfg -> 'itemNivel' ->> 0)::int + floor(random() * ((cfg -> 'itemNivel' ->> 1)::int - (cfg -> 'itemNivel' ->> 0)::int + 1))::int,
      floor(random() * 2147483647)::bigint, (L -> 'minimo' ->> rar)::bigint * (cfg ->> 'mult')::bigint);
  end loop;
  -- 2 pacotes de pergaminho (10 comuns, 5 raros, 3 épicos ou 1 lendário)
  for i in 1..2 loop
    rar := public.leilao_raridade(cfg -> 'raridades');
    ordem := ordem + 1;
    insert into public.leilao_lotes (leilao_id, ordem, tipo, raridade, nivel, semente, qtd, minimo)
    values (lid, ordem, 'pergaminho', rar, 0, floor(random() * 2147483647)::bigint, (L -> 'pacotePergaminho' ->> rar)::int,
      (L -> 'minimo' ->> rar)::bigint * (cfg ->> 'mult')::bigint);
  end loop;
  return lid;
end $$;

-- Fecha as rodadas vencidas da faixa (entrega os itens aos vencedores) e garante uma rodada aberta. Retorna o id dela.
create or replace function public.leilao_garantir(fx text) returns bigint
language plpgsql volatile security definer set search_path = public as $$
declare r public.leiloes; lt public.leilao_lotes; aberto bigint;
begin
  perform pg_advisory_xact_lock(hashtext('leilao:' || fx));
  for r in select * from public.leiloes where faixa = fx and not fechado and fim <= now() for update loop
    for lt in select * from public.leilao_lotes where leilao_id = r.id and lider is not null loop
      insert into public.recompensas (personagem_id, origem, item) values (lt.lider, 'leilao', jsonb_build_object(
        'leilao', true, 'tipo', lt.tipo, 'classe', lt.classe, 'raridade', lt.raridade, 'nivel', lt.nivel,
        'semente', lt.semente, 'qtd', lt.qtd, 'lance', lt.lance));
    end loop;
    update public.leiloes set fechado = true where id = r.id;
  end loop;
  select id into aberto from public.leiloes where faixa = fx and not fechado order by id desc limit 1;
  if aberto is null then aberto := public.leilao_criar(fx); end if;
  return aberto;
end $$;

-- Fase mostrada (nunca o relógio exato).
create or replace function public.leilao_fase(r public.leiloes) returns jsonb
language plpgsql stable as $$
declare L jsonb := public.tanka_dados() -> 'LEILAO'; resta numeric := extract(epoch from (r.fim - now())) / 60; f jsonb;
begin
  if now() >= r.muito_curto_em then return jsonb_build_object('id', 'muitoCurto', 'nome', L ->> 'nomeMuitoCurto'); end if;
  for f in select x from jsonb_array_elements(L -> 'fases') x loop
    if resta > (f ->> 'acimaMin')::numeric then return jsonb_build_object('id', f ->> 'id', 'nome', f ->> 'nome'); end if;
  end loop;
  return jsonb_build_object('id', 'curto', 'nome', 'Curto');
end $$;

create or replace function public.leilao_faixa_de(pid text) returns text
language sql stable as $$
  select f ->> 'id' from public.personagens p, jsonb_array_elements(public.tanka_dados() -> 'LEILAO' -> 'faixas') f
  where p.id = pid and coalesce((p.dados ->> 'nivel')::int, 1) >= (public.tanka_dados() -> 'LEILAO' ->> 'nivelMin')::int
    and coalesce((p.dados ->> 'nivel')::int, 1) between (f -> 'nivel' ->> 0)::int and (f -> 'nivel' ->> 1)::int limit 1;
$$;

-- O leilão da faixa do personagem: fase, lotes (com o lance atual e o próximo lance mínimo), créditos e prêmios pendentes.
create or replace function public.leilao_estado(meu text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare fx text; lid bigint; r public.leiloes; inc numeric := (public.tanka_dados() -> 'LEILAO' ->> 'incrementoPct')::numeric;
begin
  perform public.conferir_dono(meu);
  fx := public.leilao_faixa_de(meu);
  if fx is null then
    return jsonb_build_object('bloqueado', true, 'nivelMin', (public.tanka_dados() -> 'LEILAO' ->> 'nivelMin')::int);
  end if;
  lid := public.leilao_garantir(fx);
  select * into r from public.leiloes where id = lid;
  return jsonb_build_object('id', r.id, 'faixa', fx, 'fase', public.leilao_fase(r), 'ouro', public.ouro_real(meu),
    'lotes', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'ordem', l.ordem, 'tipo', l.tipo, 'classe', l.classe,
        'raridade', l.raridade, 'nivel', l.nivel, 'semente', l.semente, 'qtd', l.qtd, 'minimo', l.minimo, 'lance', l.lance,
        'proximo', case when l.lance is null then l.minimo else ceil(l.lance * (1 + inc / 100))::bigint end,
        'lances', l.lances, 'lider_nome', p.nome, 'sou_lider', l.lider = meu) order by l.ordem)
      from public.leilao_lotes l left join public.personagens p on p.id = l.lider where l.leilao_id = r.id), '[]'::jsonb),
    'creditos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ouro', ouro, 'reputacao', reputacao, 'motivo', motivo) order by id)
      from public.creditos where personagem_id = meu and not aplicado), '[]'::jsonb),
    'recompensas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'item', x.item, 'origem', x.origem) order by x.id)
      from public.recompensas x where x.personagem_id = meu and not x.resgatada), '[]'::jsonb));
end $$;

-- Dá um lance. Confere faixa, rodada aberta, valor mínimo (+5%) e ouro (contando créditos ainda não aplicados).
-- Cobra com um crédito negativo e devolve o lance coberto ao antigo líder.
create or replace function public.leilao_lance(meu text, lote bigint, valor bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare lt public.leilao_lotes; r public.leiloes; minimo bigint; inc numeric := (public.tanka_dados() -> 'LEILAO' ->> 'incrementoPct')::numeric;
begin
  perform public.conferir_dono(meu);
  select * into lt from public.leilao_lotes where id = lote for update;
  if lt.id is null then raise exception 'Lote não encontrado.'; end if;
  select * into r from public.leiloes where id = lt.leilao_id;
  if r.fechado or r.fim <= now() then raise exception 'Este leilão já terminou.'; end if;
  if r.faixa is distinct from public.leilao_faixa_de(meu) then raise exception 'Este leilão não é da sua faixa de level.'; end if;
  if lt.lider = meu then raise exception 'Você já tem o maior lance.'; end if;
  minimo := case when lt.lance is null then lt.minimo else ceil(lt.lance * (1 + inc / 100))::bigint end;
  if valor is null or valor < minimo then raise exception 'O lance mínimo agora é % de ouro.', minimo; end if;
  if valor > 2000000000 then raise exception 'Lance alto demais.'; end if;
  if public.ouro_real(meu) < valor then raise exception 'Ouro insuficiente.'; end if;
  perform public.creditar(meu, -valor::int, 0, 'Lance no leilão');
  if lt.lider is not null then perform public.creditar(lt.lider, lt.lance::int, 0, 'Seu lance foi coberto no leilão (ouro devolvido)'); end if;
  update public.leilao_lotes set lance = valor, lider = meu, lances = lances + 1, atualizado_em = now() where id = lt.id;
  return public.leilao_estado(meu);
end $$;

revoke execute on function public.leilao_raridade(jsonb, text), public.leilao_criar(text), public.leilao_garantir(text),
  public.leilao_fase(public.leiloes), public.leilao_faixa_de(text) from public, anon, authenticated;
revoke execute on function public.leilao_estado(text), public.leilao_lance(text, bigint, bigint) from public, anon;
grant execute on function public.leilao_estado(text), public.leilao_lance(text, bigint, bigint) to authenticated;

-- ---------- Mercado entre jogadores (Henri, nov/2026) ----------
-- O vendedor anuncia um item da mochila (não equipado, não travado) ou pergaminhos por um preço em ouro que ele escolhe.
-- O servidor tira o item do personagem salvo (para não duplicar) e guarda a cópia no anúncio. Na compra: o comprador
-- paga (crédito negativo), o vendedor recebe o preço menos 10% de taxa (crédito) e o item vai para o comprador (recompensa).
-- Cancelar ou passar de 7 dias devolve o item ao vendedor (recompensa).
create table if not exists public.mercado_anuncios (
  id bigint generated always as identity primary key,
  vendedor text not null references public.personagens (id) on delete cascade,
  item jsonb not null,
  categoria text not null,                  -- arma | armadura | joia | pergaminho | craft (material, receita, proteção)
  raridade text not null,
  nivel int not null default 1,
  qtd int not null default 1,
  preco bigint not null check (preco between 1 and 2000000000),
  estado text not null default 'ativo',     -- ativo | vendido | cancelado | expirado
  comprador text,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  fechado_em timestamptz
);
create index if not exists mercado_anuncios_ativos on public.mercado_anuncios (estado, categoria, criado_em desc);
create index if not exists mercado_anuncios_vendedor on public.mercado_anuncios (vendedor, estado);
alter table public.mercado_anuncios enable row level security;   -- só pelas funções

create or replace function public.mercado_cfg() returns jsonb
language sql immutable as $$ select '{"taxa": 10, "dias": 7, "maxAnuncios": 10, "porPagina": 30}'::jsonb $$;

create or replace function public.mercado_raridade_ordem(r text) returns int
language sql immutable as $$ select case r when 'comum' then 1 when 'rara' then 2 when 'epica' then 3 when 'lendaria' then 4 else 0 end $$;

-- Devolve ao vendedor (recompensa) o que estava anunciado.
create or replace function public.mercado_devolver(a public.mercado_anuncios, motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.mercado_anuncios set estado = motivo, fechado_em = now() where id = a.id;
  insert into public.recompensas (personagem_id, item, origem) values (a.vendedor,
    case when a.categoria = 'pergaminho' then jsonb_build_object('tipo', 'pergaminho', 'raridade', a.raridade, 'qtd', a.qtd)
         else a.item end, 'mercado');
end $$;

create or replace function public.mercado_expirar() returns void
language plpgsql security definer set search_path = public as $$
declare a public.mercado_anuncios;
begin
  for a in select * from public.mercado_anuncios where estado = 'ativo' and expira_em <= now() order by id limit 200
    for update skip locked loop
    perform public.mercado_devolver(a, 'expirado');
  end loop;
end $$;

-- Anunciar: item_id (da mochila) ou raridade + qtd de pergaminhos.
create or replace function public.mercado_anunciar(meu text, item_id text, pergaminho text, qtd int, preco bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.mercado_cfg(); d jsonb; it jsonb; cat text; tem int; n int := greatest(1, coalesce(qtd, 1)); ctipo text; crar text;
begin
  perform public.conferir_dono(meu);
  if preco is null or preco < 1 or preco > 2000000000 then raise exception 'Preço inválido (de 1 a 2 bilhões de ouro).'; end if;
  if (select count(*) from public.mercado_anuncios where vendedor = meu and estado = 'ativo') >= (cfg ->> 'maxAnuncios')::int then
    raise exception 'Você já tem % itens à venda. Espere vender ou cancele um.', cfg ->> 'maxAnuncios'; end if;
  select dados into d from public.personagens where id = meu for update;
  if item_id is not null then
    select e into it from jsonb_array_elements(coalesce(d -> 'inventario', '[]'::jsonb)) e where e ->> 'id' = item_id limit 1;
    if it is null then raise exception 'Item não encontrado na mochila (salve o jogo e tente de novo).'; end if;
    if exists (select 1 from jsonb_each_text(coalesce(d -> 'equipados', '{}'::jsonb)) x where x.value = item_id) then
      raise exception 'Tire o item do corpo antes de vender.'; end if;
    if (it ->> 'travado') = 'true' then raise exception 'Destrave o item antes de vender.'; end if;
    cat := case when it ->> 'tipo' = 'arma' then 'arma' when it ->> 'tipo' in ('colar', 'anel') then 'joia' else 'armadura' end;
    d := jsonb_set(d, '{inventario}', coalesce((select jsonb_agg(e) from jsonb_array_elements(d -> 'inventario') e
      where e ->> 'id' <> item_id), '[]'::jsonb));
    n := 1;
  else
    -- Pergaminho ('comum'..'lendaria') ou craft dos Anões ('material:<id>', 'receita:<região>', 'protecao:<raridade>').
    if position(':' in pergaminho) > 0 then
      ctipo := split_part(pergaminho, ':', 1); crar := split_part(pergaminho, ':', 2);
      if ctipo not in ('material', 'receita', 'protecao') or crar = '' then raise exception 'Escolha um item para vender.'; end if;
      cat := 'craft';
    else
      if pergaminho not in ('comum', 'rara', 'epica', 'lendaria') then raise exception 'Escolha um item para vender.'; end if;
      ctipo := 'pergaminho'; crar := pergaminho; cat := 'pergaminho';
    end if;
    select coalesce(sum((e ->> 'qtd')::int), 0) into tem from jsonb_array_elements(coalesce(d -> 'consumiveis', '[]'::jsonb)) e
      where e ->> 'tipo' = ctipo and e ->> 'raridade' = crar;
    if tem < n then raise exception 'Você só tem % desses.', tem; end if;
    it := jsonb_build_object('tipo', ctipo, 'raridade', crar, 'qtd', n);
    d := jsonb_set(d, '{consumiveis}', coalesce((select jsonb_agg(case when e ->> 'tipo' = ctipo and e ->> 'raridade' = crar
        then jsonb_set(e, '{qtd}', to_jsonb((e ->> 'qtd')::int - n)) else e end)
      from jsonb_array_elements(d -> 'consumiveis') e
      where not (e ->> 'tipo' = ctipo and e ->> 'raridade' = crar and (e ->> 'qtd')::int - n <= 0)), '[]'::jsonb));
  end if;
  update public.personagens set dados = d where id = meu;
  insert into public.mercado_anuncios (vendedor, item, categoria, raridade, nivel, qtd, preco, expira_em)
    values (meu, it, cat, case when cat = 'craft' then 'comum' else coalesce(it ->> 'raridade', 'comum') end, coalesce((it ->> 'nivel')::int, 1), n, preco,
      now() + make_interval(days => (cfg ->> 'dias')::int));
  return public.mercado_estado(meu, null, null, 0);
end $$;

create or replace function public.mercado_cancelar(meu text, anuncio bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.mercado_anuncios;
begin
  perform public.conferir_dono(meu);
  select * into a from public.mercado_anuncios where id = anuncio and vendedor = meu for update;
  if a.id is null or a.estado <> 'ativo' then raise exception 'Este anúncio não está mais à venda.'; end if;
  perform public.mercado_devolver(a, 'cancelado');
  return public.mercado_estado(meu, null, null, 0);
end $$;

create or replace function public.mercado_comprar(meu text, anuncio bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.mercado_anuncios; cfg jsonb := public.mercado_cfg(); nome text; recebe bigint;
begin
  perform public.conferir_dono(meu);
  select * into a from public.mercado_anuncios where id = anuncio for update;
  if a.id is null or a.estado <> 'ativo' or a.expira_em <= now() then raise exception 'Este item já foi vendido ou saiu do mercado.'; end if;
  if a.vendedor = meu then raise exception 'Este anúncio é seu.'; end if;
  if public.ouro_real(meu) < a.preco then raise exception 'Ouro insuficiente.'; end if;
  select p.nome into nome from public.personagens p where p.id = meu;
  recebe := floor(a.preco * (100 - (cfg ->> 'taxa')::numeric) / 100);
  perform public.creditar(meu, -a.preco::int, 0, 'Compra no mercado');
  perform public.creditar(a.vendedor, recebe::int, 0, 'Mercado: ' || nome || ' comprou seu item (−' || (cfg ->> 'taxa') || '% de taxa)');
  update public.mercado_anuncios set estado = 'vendido', comprador = meu, fechado_em = now() where id = a.id;
  insert into public.recompensas (personagem_id, item, origem) values (meu,
    case when a.categoria = 'pergaminho' then jsonb_build_object('tipo', 'pergaminho', 'raridade', a.raridade, 'qtd', a.qtd)
         else a.item end, 'mercado');
  return public.mercado_estado(meu, null, null, 0);
end $$;

-- Lista: categoria (null = todas) e ordem (recentes | nivel | raridade | preco | preco_desc), 30 por página.
-- Filtro "só o que a minha classe usa" (Daniel, nov/2026): o jogo manda { classe, armas: [...], maos: [...],
-- padrao: { classe: arma } } (as regras de quem usa o quê vivem em regras.js). Consumíveis e craft passam sempre.
create or replace function public.mercado_serve(item jsonb, filtro jsonb) returns boolean
language sql immutable as $$
  select filtro is null or case item ->> 'tipo'
    when 'arma' then coalesce(item ->> 'arma', filtro -> 'padrao' ->> (item ->> 'classe'), 'espada') in (select jsonb_array_elements_text(filtro -> 'armas'))
    when 'secundaria' then (item ->> 'mao') in (select jsonb_array_elements_text(filtro -> 'maos'))
    when 'elmo' then coalesce(item ->> 'classe', '') in ('', filtro ->> 'classe')
    when 'peitoral' then coalesce(item ->> 'classe', '') in ('', filtro ->> 'classe')
    when 'luvas' then coalesce(item ->> 'classe', '') in ('', filtro ->> 'classe')
    when 'botas' then coalesce(item ->> 'classe', '') in ('', filtro ->> 'classe')
    else true end;
$$;
drop function if exists public.mercado_estado(text, text, text, int);
create or replace function public.mercado_estado(meu text, categoria text, ordem text, pagina int, filtro jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.mercado_cfg(); pp int := (cfg ->> 'porPagina')::int; cat text := nullif(categoria, 'todos');
begin
  perform public.conferir_dono(meu);
  perform public.mercado_expirar();
  return jsonb_build_object('cfg', cfg,
    'total', (select count(*) from public.mercado_anuncios a where a.estado = 'ativo' and (cat is null or a.categoria = cat) and public.mercado_serve(a.item, filtro)),
    'anuncios', coalesce((select jsonb_agg(x.j order by x.n) from (
      select row_number() over (order by
          case when ordem = 'nivel' then a.nivel end desc nulls last,
          case when ordem = 'raridade' then public.mercado_raridade_ordem(a.raridade) end desc nulls last,
          case when ordem = 'preco' then a.preco end asc nulls last,
          case when ordem = 'preco_desc' then a.preco end desc nulls last,
          a.criado_em desc) as n,
        jsonb_build_object('id', a.id, 'item', a.item, 'categoria', a.categoria, 'qtd', a.qtd, 'preco', a.preco,
          'vendedor', p.nome, 'meu', a.vendedor = meu, 'expira_em', a.expira_em) as j
      from public.mercado_anuncios a join public.personagens p on p.id = a.vendedor
      where a.estado = 'ativo' and (cat is null or a.categoria = cat) and public.mercado_serve(a.item, filtro)
      order by n limit pp offset greatest(0, coalesce(pagina, 0)) * pp) x), '[]'::jsonb),
    'meus', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'item', a.item, 'categoria', a.categoria, 'qtd', a.qtd,
        'preco', a.preco, 'expira_em', a.expira_em) order by a.criado_em desc)
      from public.mercado_anuncios a where a.vendedor = meu and a.estado = 'ativo'), '[]'::jsonb),
    'vendas', coalesce((select jsonb_agg(jsonb_build_object('item', a.item, 'qtd', a.qtd, 'preco', a.preco, 'comprador', p.nome,
        'quando', a.fechado_em) order by a.fechado_em desc)
      from (select * from public.mercado_anuncios where vendedor = meu and estado = 'vendido' order by fechado_em desc limit 10) a
      left join public.personagens p on p.id = a.comprador), '[]'::jsonb),
    'creditos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ouro', ouro, 'reputacao', reputacao, 'motivo', motivo) order by id)
      from public.creditos where personagem_id = meu and not aplicado), '[]'::jsonb),
    'recompensas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'item', x.item, 'origem', x.origem) order by x.id)
      from public.recompensas x where x.personagem_id = meu and not x.resgatada), '[]'::jsonb));
end $$;

revoke execute on function public.mercado_cfg(), public.mercado_raridade_ordem(text), public.mercado_devolver(public.mercado_anuncios, text),
  public.mercado_expirar() from public, anon, authenticated;
revoke execute on function public.mercado_anunciar(text, text, text, int, bigint), public.mercado_cancelar(text, bigint),
  public.mercado_comprar(text, bigint), public.mercado_estado(text, text, text, int, jsonb) from public, anon;
grant execute on function public.mercado_anunciar(text, text, text, int, bigint), public.mercado_cancelar(text, bigint),
  public.mercado_comprar(text, bigint), public.mercado_estado(text, text, text, int, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- Conversas privadas entre personagens com amizade aceita.
create table if not exists public.mensagens_privadas (
  id bigint generated always as identity primary key,
  de text not null references public.personagens (id) on delete cascade,
  para text not null references public.personagens (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 300),
  criado_em timestamptz not null default now()
);
create index if not exists mensagens_privadas_conversa on public.mensagens_privadas (de, para, id desc);
alter table public.mensagens_privadas enable row level security;
revoke all on public.mensagens_privadas from public, anon, authenticated;

create or replace function public.conferir_conversa_privada(meu text, alvo text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  if not exists (
    select 1 from public.amizades a where a.status = 'aceita'
    and ((a.de = meu and a.para = alvo) or (a.de = alvo and a.para = meu))
  ) then raise exception 'A conversa privada está disponível entre amigos.'; end if;
end $$;

create or replace function public.privado_listar(meu text, alvo text)
returns table (id bigint, de text, texto text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.conferir_conversa_privada(meu, alvo);
  return query select m.id, m.de, m.texto from (
    select mp.id, mp.de, mp.texto from public.mensagens_privadas mp
    where (mp.de = meu and mp.para = alvo) or (mp.de = alvo and mp.para = meu)
    order by mp.id desc limit 100
  ) m order by m.id;
end $$;

create or replace function public.privado_enviar(meu text, alvo text, mensagem text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_conversa_privada(meu, alvo);
  mensagem := btrim(mensagem);
  if mensagem is null or char_length(mensagem) not between 1 and 300 then
    raise exception 'Escreva uma mensagem de 1 a 300 caracteres.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('privado:' || meu, 0));
  if exists (select 1 from public.mensagens_privadas m where m.de = meu and m.criado_em > now() - interval '1 second') then
    raise exception 'Espere um segundo antes de enviar outra mensagem.';
  end if;
  insert into public.mensagens_privadas (de, para, texto) values (meu, alvo, mensagem);
end $$;

revoke execute on function public.conferir_conversa_privada(text, text), public.privado_listar(text, text), public.privado_enviar(text, text, text) from public, anon;
grant execute on function public.privado_listar(text, text), public.privado_enviar(text, text, text) to authenticated;

-- ---------- Boss da aliança (Daniel, nov/2026) ----------
-- Um boss por dia por aliança. O líder escolhe a hora (0 a 23, Brasília); o boss abre sozinho todo dia nessa hora
-- e fica aberto BOSS_ALIANCA.duracaoMin minutos. Ataques ilimitados, sozinho ou em grupo de até grupoMax membros.
-- A luta é calculada no jogo (regras.js, simularBossAlianca, com a semente daqui) e o dano é informado no fim.
-- Morreu: sobe 1 nível e quem deu dano naquele dia ganha prêmio. Não morreu na hora: amanhã é o mesmo boss, vida cheia.
-- Vida e prêmios de cada nível: tanka_dados() -> 'BOSS_ALIANCA' -> 'niveis' (gerado de js/dados.js).
create table if not exists public.alianca_boss (
  alianca_id bigint primary key references public.aliancas (id) on delete cascade,
  nivel int not null default 1,
  hora int check (hora between 0 and 23),
  dia date,                 -- dia (Brasília) em que abriu pela última vez
  aberto_em timestamptz,
  hp bigint not null default 0,
  estado text not null default 'fechado' check (estado in ('fechado', 'aberto', 'morto', 'falhou')),
  morto_em timestamptz,
  ultimo_golpe text
);
create table if not exists public.alianca_boss_dano (
  alianca_id bigint not null references public.aliancas (id) on delete cascade,
  dia date not null,
  personagem_id text not null references public.personagens (id) on delete cascade,
  dano bigint not null default 0,
  investidas int not null default 0,
  primary key (alianca_id, dia, personagem_id)
);
create table if not exists public.alianca_boss_salas (
  id bigint generated always as identity primary key,
  alianca_id bigint not null references public.aliancas (id) on delete cascade,
  lider text not null references public.personagens (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create table if not exists public.alianca_boss_sala_membros (
  personagem_id text primary key references public.personagens (id) on delete cascade,
  sala_id bigint not null references public.alianca_boss_salas (id) on delete cascade,
  entrou_em timestamptz not null default now()
);
create table if not exists public.alianca_boss_runs (
  id bigint generated always as identity primary key,
  alianca_id bigint not null references public.aliancas (id) on delete cascade,
  dia date not null,
  nivel int not null,
  lider text not null,
  semente bigint not null,
  hp_inicio bigint not null,
  herois jsonb not null,      -- [{ id, dados }]
  membros text[] not null,
  estado text not null default 'andamento' check (estado in ('andamento', 'concluida', 'abandonada')),
  dano bigint,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);
create index if not exists alianca_boss_runs_alianca on public.alianca_boss_runs (alianca_id, criado_em desc);
alter table public.alianca_boss_runs add column if not exists buff numeric not null default 0;   -- % de dano das missões semanais
alter table public.alianca_boss_runs alter column buff type numeric;
alter table public.alianca_boss enable row level security;
alter table public.alianca_boss_dano enable row level security;
alter table public.alianca_boss_salas enable row level security;
alter table public.alianca_boss_sala_membros enable row level security;
alter table public.alianca_boss_runs enable row level security;

create or replace function public.alianca_boss_cfg() returns jsonb
language sql immutable as $$ select public.tanka_dados() -> 'BOSS_ALIANCA'; $$;

-- Vida e prêmios do nível n (depois da tabela, a vida continua crescendo vidaPorNivel por nível).
create or replace function public.alianca_boss_info(n int) returns jsonb
language plpgsql immutable as $$
declare cfg jsonb := public.alianca_boss_cfg(); t int := jsonb_array_length(cfg -> 'niveis'); x jsonb;
begin
  if n <= t then return cfg -> 'niveis' -> (n - 1); end if;
  x := cfg -> 'niveis' -> (t - 1);
  return jsonb_set(x, '{hp}', to_jsonb(round((x ->> 'hp')::numeric * power((cfg ->> 'vidaPorNivel')::numeric, n - t))::bigint));
end $$;

-- Abre ou fecha o boss conforme a hora (chamada por todas as funções do boss). Devolve a linha atualizada.
create or replace function public.alianca_boss_atualizar(aid bigint) returns public.alianca_boss
language plpgsql security definer set search_path = public as $$
declare b public.alianca_boss; hoje date := public.dia_jogo(); inicio timestamptz;
  dur interval := make_interval(mins => (public.alianca_boss_cfg() ->> 'duracaoMin')::int);
begin
  insert into public.alianca_boss (alianca_id) values (aid) on conflict (alianca_id) do nothing;
  select * into b from public.alianca_boss where alianca_id = aid for update;
  if b.estado = 'aberto' and now() >= b.aberto_em + dur then
    update public.alianca_boss set estado = 'falhou' where alianca_id = aid returning * into b;
  end if;
  if b.hora is not null and b.dia is distinct from hoje then
    inicio := (hoje + make_interval(hours => b.hora)) at time zone 'America/Sao_Paulo';
    if now() >= inicio and now() < inicio + dur then
      update public.alianca_boss set dia = hoje, aberto_em = inicio, estado = 'aberto', ultimo_golpe = null, morto_em = null,
        hp = (public.alianca_boss_info(b.nivel) ->> 'hp')::bigint
      where alianca_id = aid returning * into b;
    end if;
  end if;
  return b;
end $$;

-- Sai do grupo do boss (o mais antigo vira líder; grupo vazio é apagado).
create or replace function public.alianca_boss_sala_sair_de(pid text) returns void
language plpgsql security definer set search_path = public as $$
declare s bigint; novo text;
begin
  select sala_id into s from public.alianca_boss_sala_membros where personagem_id = pid;
  if s is null then return; end if;
  delete from public.alianca_boss_sala_membros where personagem_id = pid;
  select personagem_id into novo from public.alianca_boss_sala_membros where sala_id = s order by entrou_em limit 1;
  if novo is null then delete from public.alianca_boss_salas where id = s; return; end if;
  update public.alianca_boss_salas set lider = novo where id = s and lider = pid;
end $$;

-- Prêmios quando o boss morre: ouro (créditos), exp e pergaminhos (recompensas) para quem deu dano no dia;
-- 1 item para quem deu mais dano; exp para a aliança.
create or replace function public.alianca_boss_premiar(aid bigint, d date, n int) returns void
language plpgsql security definer set search_path = public as $$
declare info jsonb := public.alianca_boss_info(n); cfg jsonb := public.alianca_cfg(); x record; top text; r numeric; acum numeric := 0;
  rar text := null; it jsonb; i int; a public.aliancas; prox bigint;
begin
  for x in select bd.personagem_id from public.alianca_boss_dano bd join public.personagens p on p.id = bd.personagem_id
      where bd.alianca_id = aid and bd.dia = d and bd.dano > 0 loop
    perform public.creditar(x.personagem_id, (info ->> 'ouro')::int, 0, 'Boss do clã (nível ' || n || ')');
    insert into public.recompensas (personagem_id, origem, item) values (x.personagem_id, 'boss-alianca',
      jsonb_build_object('tipo', 'exp', 'valor', (info ->> 'exp')::bigint, 'nivelBoss', n));
    for i in 1 .. coalesce((info ->> 'pergaminho')::int, 0) loop
      insert into public.recompensas (personagem_id, origem, item) values (x.personagem_id, 'boss-alianca',
        jsonb_build_object('tipo', 'pergaminho', 'raridade', info ->> 'raridade', 'boss', true));
    end loop;
  end loop;
  select bd.personagem_id into top from public.alianca_boss_dano bd join public.personagens p on p.id = bd.personagem_id
    where bd.alianca_id = aid and bd.dia = d and bd.dano > 0 order by bd.dano desc limit 1;
  if top is not null then
    r := random() * 100;
    for it in select * from jsonb_array_elements(public.alianca_boss_cfg() -> 'item') loop
      acum := acum + (it ->> 'chance')::numeric;
      if rar is null and r < acum then rar := it ->> 'raridade'; end if;
    end loop;
    insert into public.recompensas (personagem_id, origem, item) values (top, 'boss-alianca',
      jsonb_build_object('tipo', 'bossItem', 'raridade', coalesce(rar, 'epica'), 'nivelBoss', n));
    -- Fragmento de Selo (Relíquia Rúnica dos Anões)
    insert into public.recompensas (personagem_id, origem, item) values (top, 'boss-alianca',
      jsonb_build_object('tipo', 'material', 'raridade', 'fragmento', 'qtd', 1));
  end if;
  update public.aliancas set exp = exp + (info ->> 'alianca')::bigint where id = aid returning * into a;
  loop
    exit when a.nivel >= (cfg ->> 'nivelMax')::int;
    prox := (cfg -> 'expProximo' ->> (a.nivel - 1))::bigint;
    exit when a.exp < prox;
    update public.aliancas set nivel = nivel + 1, exp = exp - prox where id = a.id returning * into a;
  end loop;
end $$;

-- Tudo que a tela do boss precisa.
create or replace function public.alianca_boss_estado(meu text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros; b public.alianca_boss; minha bigint; info jsonb;
  dur int := (public.alianca_boss_cfg() ->> 'duracaoMin')::int;
begin
  perform public.conferir_dono(meu);
  m := public.alianca_minha(meu);
  b := public.alianca_boss_atualizar(m.alianca_id);
  info := public.alianca_boss_info(b.nivel);
  select sala_id into minha from public.alianca_boss_sala_membros where personagem_id = meu;
  return jsonb_build_object(
    'agora', now(), 'dia', public.dia_jogo(), 'meu_cargo', m.cargo, 'minha_sala', minha,
    'boss', jsonb_build_object('nivel', b.nivel, 'hora', b.hora, 'estado', b.estado, 'dia', b.dia, 'hp', b.hp,
      'hp_max', case when b.estado in ('aberto', 'morto', 'falhou') and b.dia is not null then (public.alianca_boss_info(
        case when b.estado = 'morto' then b.nivel - 1 else b.nivel end) ->> 'hp')::bigint else (info ->> 'hp')::bigint end,
      'aberto_em', b.aberto_em, 'fecha_em', b.aberto_em + make_interval(mins => dur), 'morto_em', b.morto_em,
      'ultimo_golpe', b.ultimo_golpe),
    -- dano do último dia em que o boss abriu
    'ranking', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'classe', p.dados ->> 'classe',
        'classe2', p.dados -> 'talentos' ->> 'classe2', 'sexo', p.dados ->> 'sexo', 'dano', bd.dano, 'investidas', bd.investidas)
        order by bd.dano desc)
      from public.alianca_boss_dano bd join public.personagens p on p.id = bd.personagem_id
      where bd.alianca_id = m.alianca_id and bd.dia = b.dia), '[]'::jsonb),
    'salas', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'lider', s.lider,
        'membros', (select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'classe', p.dados ->> 'classe',
            'classe2', p.dados -> 'talentos' ->> 'classe2', 'sexo', p.dados ->> 'sexo', 'raca', p.dados ->> 'raca',
            'nivel', coalesce((p.dados ->> 'nivel')::int, 1)) order by sm.entrou_em)
          from public.alianca_boss_sala_membros sm join public.personagens p on p.id = sm.personagem_id where sm.sala_id = s.id))
        order by s.id)
      from public.alianca_boss_salas s where s.alianca_id = m.alianca_id), '[]'::jsonb),
    -- última investida em que estou (para o grupo assistir junto)
    'run', (select jsonb_build_object('id', r.id, 'nivel', r.nivel, 'semente', r.semente, 'hp_inicio', r.hp_inicio, 'buff', r.buff,
        'herois', r.herois, 'estado', r.estado, 'lider', r.lider, 'dano', r.dano, 'criado_em', r.criado_em)
      from public.alianca_boss_runs r where r.alianca_id = m.alianca_id and meu = any (r.membros)
        and r.criado_em > now() - interval '5 minutes' order by r.id desc limit 1),
    'recompensas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'item', x.item) order by x.id)
      from public.recompensas x where x.personagem_id = meu and not x.resgatada), '[]'::jsonb));
end $$;

-- Líder escolhe a hora do boss (0 a 23, Brasília). Vale a partir do próximo dia em que ainda não abriu.
create or replace function public.alianca_boss_hora(meu text, hora int) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros; b public.alianca_boss;
begin
  perform public.conferir_dono(meu);
  m := public.alianca_minha(meu);
  if m.cargo not in ('lider', 'vice') then raise exception 'Só o líder e o vice-líder escolhem a hora do boss.'; end if;
  if hora is null or hora < 0 or hora > 23 then raise exception 'Hora inválida.'; end if;
  b := public.alianca_boss_atualizar(m.alianca_id);
  if b.estado = 'aberto' then raise exception 'Espere o boss de hoje terminar para mudar a hora.'; end if;
  update public.alianca_boss set hora = alianca_boss_hora.hora where alianca_id = m.alianca_id;
  perform public.alianca_boss_atualizar(m.alianca_id);
end $$;

create or replace function public.alianca_boss_sala_criar(meu text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros; s bigint;
begin
  perform public.conferir_dono(meu);
  m := public.alianca_minha(meu);
  perform public.alianca_boss_sala_sair_de(meu);
  insert into public.alianca_boss_salas (alianca_id, lider) values (m.alianca_id, meu) returning id into s;
  insert into public.alianca_boss_sala_membros (personagem_id, sala_id) values (meu, s);
end $$;

create or replace function public.alianca_boss_sala_entrar(meu text, sala bigint) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros; aid bigint;
begin
  perform public.conferir_dono(meu);
  m := public.alianca_minha(meu);
  select alianca_id into aid from public.alianca_boss_salas where id = sala for update;
  if aid is null or aid <> m.alianca_id then raise exception 'Grupo não encontrado.'; end if;
  if exists (select 1 from public.alianca_boss_sala_membros where personagem_id = meu and sala_id = sala) then return; end if;
  if (select count(*) from public.alianca_boss_sala_membros where sala_id = sala) >= (public.alianca_boss_cfg() ->> 'grupoMax')::int then
    raise exception 'O grupo já está cheio.';
  end if;
  perform public.alianca_boss_sala_sair_de(meu);
  insert into public.alianca_boss_sala_membros (personagem_id, sala_id) values (meu, sala);
end $$;

create or replace function public.alianca_boss_sala_sair(meu text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  perform public.alianca_boss_sala_sair_de(meu);
end $$;

-- Começa uma investida (sozinho, ou o líder do grupo leva o grupo todo). Devolve a semente e os heróis.
create or replace function public.alianca_boss_atacar(meu text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros; b public.alianca_boss; s bigint; lider text; ids text[]; run public.alianca_boss_runs;
begin
  perform public.conferir_dono(meu);
  m := public.alianca_minha(meu);
  b := public.alianca_boss_atualizar(m.alianca_id);
  if b.estado <> 'aberto' then raise exception 'O boss não está aberto agora.'; end if;
  select sala_id into s from public.alianca_boss_sala_membros where personagem_id = meu;
  if s is null then
    ids := array[meu];
  else
    select x.lider into lider from public.alianca_boss_salas x where x.id = s;
    if lider <> meu then raise exception 'Só o líder do grupo começa a investida.'; end if;
    select array_agg(sm.personagem_id order by sm.entrou_em) into ids from public.alianca_boss_sala_membros sm
      join public.alianca_membros am on am.personagem_id = sm.personagem_id and am.alianca_id = m.alianca_id
      where sm.sala_id = s;
  end if;
  update public.alianca_boss_runs set estado = 'abandonada', concluido_em = now()
    where alianca_id = m.alianca_id and estado = 'andamento' and criado_em < now() - interval '5 minutes';
  if exists (select 1 from public.alianca_boss_runs where alianca_id = m.alianca_id and estado = 'andamento' and membros && ids) then
    raise exception 'Alguém do grupo ainda está numa investida.';
  end if;
  insert into public.alianca_boss_runs (alianca_id, dia, nivel, lider, semente, hp_inicio, herois, membros, buff)
  select m.alianca_id, b.dia, b.nivel, meu, floor(random() * 2147483647)::bigint, b.hp,
         jsonb_agg(jsonb_build_object('id', p.id, 'dados', p.dados) order by array_position(ids, p.id)), ids,
         public.alianca_boss_buff(m.alianca_id)
  from public.personagens p where p.id = any (ids)
  returning * into run;
  return jsonb_build_object('id', run.id, 'nivel', run.nivel, 'semente', run.semente, 'hp_inicio', run.hp_inicio, 'buff', run.buff,
    'herois', run.herois, 'estado', run.estado, 'lider', run.lider, 'criado_em', run.criado_em);
end $$;

-- Fim da investida: danos = dano de cada herói, na ordem de `membros`. O dano conta só se o boss ainda estiver
-- aberto no mesmo dia e nível; nunca passa da vida que ele ainda tem (outros grupos podem ter batido antes).
create or replace function public.alianca_boss_concluir(meu text, run_id bigint, danos bigint[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare run public.alianca_boss_runs; b public.alianca_boss; total bigint := 0; resto bigint; d bigint; i int; nome text; morreu boolean := false;
begin
  perform public.conferir_dono(meu);
  select * into run from public.alianca_boss_runs where id = run_id for update;
  if run.id is null or run.lider <> meu then raise exception 'Investida não encontrada.'; end if;
  if run.estado <> 'andamento' then raise exception 'Essa investida já terminou.'; end if;
  b := public.alianca_boss_atualizar(run.alianca_id);
  if b.estado <> 'aberto' or b.dia <> run.dia or b.nivel <> run.nivel then
    update public.alianca_boss_runs set estado = 'concluida', dano = 0, concluido_em = now() where id = run_id;
    return jsonb_build_object('dano', 0, 'hp', b.hp, 'morreu', false, 'estado', b.estado);
  end if;
  resto := least(b.hp, run.hp_inicio);
  for i in 1 .. array_length(run.membros, 1) loop
    d := greatest(0, least(coalesce(danos[i], 0), resto));
    resto := resto - d;
    total := total + d;
    begin
      insert into public.alianca_boss_dano (alianca_id, dia, personagem_id, dano, investidas)
      values (run.alianca_id, run.dia, run.membros[i], d, 1)
      on conflict (alianca_id, dia, personagem_id) do update
        set dano = public.alianca_boss_dano.dano + excluded.dano, investidas = public.alianca_boss_dano.investidas + 1;
    end;
  end loop;
  update public.alianca_boss_runs set estado = 'concluida', dano = total, concluido_em = now() where id = run_id;
  update public.alianca_boss set hp = hp - total where alianca_id = run.alianca_id returning * into b;
  if b.hp <= 0 then
    morreu := true;
    select p.nome into nome from public.personagens p where p.id = meu;
    update public.alianca_boss set hp = 0, estado = 'morto', morto_em = now(), ultimo_golpe = nome, nivel = nivel + 1
      where alianca_id = run.alianca_id returning * into b;
    perform public.alianca_boss_premiar(run.alianca_id, run.dia, run.nivel);
    perform public.alianca_missao_progresso(run.alianca_id, 'bossCla', 1);
  end if;
  return jsonb_build_object('dano', total, 'hp', b.hp, 'morreu', morreu, 'estado', b.estado);
end $$;

revoke execute on function public.alianca_boss_cfg(), public.alianca_boss_info(int), public.alianca_boss_atualizar(bigint),
  public.alianca_boss_sala_sair_de(text), public.alianca_boss_premiar(bigint, date, int) from public, anon, authenticated;
revoke execute on function public.alianca_boss_estado(text), public.alianca_boss_hora(text, int), public.alianca_boss_sala_criar(text),
  public.alianca_boss_sala_entrar(text, bigint), public.alianca_boss_sala_sair(text), public.alianca_boss_atacar(text),
  public.alianca_boss_concluir(text, bigint, bigint[]) from public, anon;
grant execute on function public.alianca_boss_estado(text), public.alianca_boss_hora(text, int), public.alianca_boss_sala_criar(text),
  public.alianca_boss_sala_entrar(text, bigint), public.alianca_boss_sala_sair(text), public.alianca_boss_atacar(text),
  public.alianca_boss_concluir(text, bigint, bigint[]) to authenticated;

-- ---------- Clã: skills, doação por dia e missões (Daniel, nov/2026) ----------
-- Skills: compradas pelo líder com o tesouro, permanentes; nível da skill <= nível do clã; preços em ALIANCA.skillPrecos.
-- Missões: progresso somado de todos os membros (o jogo manda em lotes, alianca_missao_registrar); cumpriu = ouro no
-- tesouro (mais com o nível do clã); semanais dão buff% de dano contra o boss do clã até o fim da semana.
create table if not exists public.alianca_skills (
  alianca_id bigint not null references public.aliancas (id) on delete cascade,
  skill text not null,
  nivel int not null default 0,
  primary key (alianca_id, skill)
);
create table if not exists public.alianca_doacoes (
  personagem_id text not null references public.personagens (id) on delete cascade,
  dia date not null,
  valor int not null default 0,
  primary key (personagem_id, dia)
);
create table if not exists public.alianca_missoes (
  alianca_id bigint not null references public.aliancas (id) on delete cascade,
  periodo text not null check (periodo in ('dia', 'semana')),
  chave date not null,
  tipo text not null,
  progresso bigint not null default 0,
  concluida boolean not null default false,
  primary key (alianca_id, periodo, chave, tipo)
);
alter table public.alianca_skills enable row level security;
alter table public.alianca_doacoes enable row level security;
alter table public.alianca_missoes enable row level security;

-- Começo da semana do clã (segunda 00:00, Brasília), como data.
create or replace function public.alianca_semana() returns date
language sql stable as $$ select (public.arena_inicio_semana() at time zone 'America/Sao_Paulo')::date; $$;

create or replace function public.alianca_missao_def(periodo text, tipo text) returns jsonb
language sql immutable as $$
  select x from jsonb_array_elements(public.alianca_cfg() -> 'missoes' -> (case when periodo = 'dia' then 'diarias' else 'semanais' end)) x
  where x ->> 'tipo' = tipo limit 1;
$$;

-- Soma progresso numa missão (diária e semanal do mesmo tipo); quem completa põe o ouro no tesouro.
create or replace function public.alianca_missao_progresso(aid bigint, tipo text, qtd int) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare per text; def jsonb; ch date; x public.alianca_missoes; nivel int; ouro bigint;
begin
  if qtd is null or qtd <= 0 then return; end if;
  select a.nivel into nivel from public.aliancas a where a.id = aid;
  foreach per in array array['dia', 'semana'] loop
    def := public.alianca_missao_def(per, alianca_missao_progresso.tipo);
    continue when def is null;
    ch := case when per = 'dia' then public.dia_jogo() else public.alianca_semana() end;
    insert into public.alianca_missoes (alianca_id, periodo, chave, tipo, progresso) values (aid, per, ch, alianca_missao_progresso.tipo, qtd)
      on conflict (alianca_id, periodo, chave, tipo) do update set progresso = public.alianca_missoes.progresso + excluded.progresso
      returning * into x;
    if not x.concluida and x.progresso >= (def ->> 'meta')::bigint then
      update public.alianca_missoes set concluida = true
        where alianca_id = aid and periodo = per and chave = ch and alianca_missoes.tipo = alianca_missao_progresso.tipo;
      ouro := round((def ->> 'ouro')::numeric * (1 + (public.alianca_cfg() ->> 'missoesOuroPorNivel')::numeric * (nivel - 1)));
      update public.aliancas set tesouro = tesouro + ouro where id = aid;
    end if;
  end loop;
end $$;

-- O jogo manda o progresso do personagem em lotes (limitados por envio).
create or replace function public.alianca_missao_registrar(meu text, tipo text, qtd int) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros; maximo int;
begin
  perform public.conferir_dono(meu);
  select * into m from public.alianca_membros where personagem_id = meu;
  if m.personagem_id is null then return; end if;
  maximo := (public.alianca_cfg() -> 'missoesMaxEnvio' ->> tipo)::int;
  if maximo is null then raise exception 'Missão inválida.'; end if;
  perform public.alianca_missao_progresso(m.alianca_id, tipo, least(greatest(coalesce(qtd, 0), 0), maximo));
end $$;

-- % de dano contra o boss do clã nesta semana (missões semanais cumpridas).
drop function if exists public.alianca_boss_buff(bigint);
create or replace function public.alianca_boss_buff(aid bigint) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum((public.alianca_missao_def('semana', x.tipo) ->> 'buff')::numeric), 0)
  from public.alianca_missoes x where x.alianca_id = aid and x.periodo = 'semana' and x.chave = public.alianca_semana() and x.concluida;
$$;

-- Skills, doação de hoje, missões e buff (junto do alianca_estado).
create or replace function public.alianca_extras(aid bigint, meu text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'skills', coalesce((select jsonb_object_agg(k.skill, k.nivel) from public.alianca_skills k where k.alianca_id = aid), '{}'::jsonb),
    'doado_hoje', coalesce((select d.valor from public.alianca_doacoes d where d.personagem_id = meu and d.dia = public.dia_jogo()), 0),
    'missoes', jsonb_build_object(
      'diarias', coalesce((select jsonb_object_agg(x.tipo, jsonb_build_object('progresso', x.progresso, 'concluida', x.concluida))
        from public.alianca_missoes x where x.alianca_id = aid and x.periodo = 'dia' and x.chave = public.dia_jogo()), '{}'::jsonb),
      'semanais', coalesce((select jsonb_object_agg(x.tipo, jsonb_build_object('progresso', x.progresso, 'concluida', x.concluida))
        from public.alianca_missoes x where x.alianca_id = aid and x.periodo = 'semana' and x.chave = public.alianca_semana()), '{}'::jsonb),
      'fim_semana', public.arena_inicio_semana() + interval '7 days'),
    'buff_boss', public.alianca_boss_buff(aid));
$$;

-- Líder compra o próximo nível de uma skill com o ouro do tesouro.
create or replace function public.alianca_skill_comprar(meu text, skill text) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare m public.alianca_membros := public.alianca_minha(meu); cfg jsonb := public.alianca_cfg(); a public.aliancas;
  atual int; novo int; preco bigint;
begin
  perform public.conferir_dono(meu);
  if m.cargo not in ('lider', 'vice') then raise exception 'Só o líder e o vice-líder compram as skills do clã.'; end if;
  if not exists (select 1 from jsonb_array_elements(cfg -> 'skills') x where x ->> 'id' = alianca_skill_comprar.skill) then raise exception 'Skill inválida.'; end if;
  select * into a from public.aliancas where id = m.alianca_id for update;
  atual := coalesce((select k.nivel from public.alianca_skills k where k.alianca_id = a.id and k.skill = alianca_skill_comprar.skill), 0);
  novo := atual + 1;
  if novo > jsonb_array_length(cfg -> 'skillPrecos') then raise exception 'Essa skill já está no nível máximo.'; end if;
  if novo > a.nivel then raise exception 'Suba o clã para o nível % para liberar o nível % das skills.', novo, novo; end if;
  preco := (cfg -> 'skillPrecos' ->> (novo - 1))::bigint;
  if a.tesouro < preco then raise exception 'O tesouro não tem ouro suficiente (precisa de %).', preco; end if;
  update public.aliancas set tesouro = tesouro - preco where id = a.id;
  insert into public.alianca_skills (alianca_id, skill, nivel) values (a.id, alianca_skill_comprar.skill, novo)
    on conflict (alianca_id, skill) do update set nivel = excluded.nivel;
end $$;

revoke execute on function public.alianca_semana(), public.alianca_missao_def(text, text), public.alianca_missao_progresso(bigint, text, int),
  public.alianca_boss_buff(bigint), public.alianca_extras(bigint, text) from public, anon, authenticated;
revoke execute on function public.alianca_missao_registrar(text, text, int), public.alianca_skill_comprar(text, text) from public, anon;
grant execute on function public.alianca_missao_registrar(text, text, int), public.alianca_skill_comprar(text, text) to authenticated;

-- ---------- Oficinas e Relíquia Rúnica (Daniel, nov/2026; etapas 4 e 5 do PDF dos Anões) ----------
-- O Artesão (Ferreiro ou Coletor) abre a oficina com os preços. O cliente pede: o servidor tira do personagem SALVO o item
-- e os insumos (pergaminhos, proteção, receita, materiais, cristais) e cobra o preço (+ o ouro da receita/forja, que some).
-- O artesão faz: a sorte é jogada AQUI, com a Sorte/raça guardadas da oficina; o resultado vai ao cliente por recompensa e
-- o artesão recebe o preço menos a taxa. Sem fazer no prazo, ou cancelado pelo cliente, tudo volta.
create table if not exists public.oficinas (
  personagem_id text primary key references public.personagens (id) on delete cascade,
  servicos jsonb not null default '{}'::jsonb,     -- { encantar: preço, forjar: preço, ... } só os oferecidos
  bonus_encanto numeric not null default 0,       -- Sorte x 0,5 + Anão (o jogo do artesão manda)
  sorte int not null default 0,
  atualizado_em timestamptz not null default now()
);
create table if not exists public.oficina_pedidos (
  id bigint generated always as identity primary key,
  artesao text not null references public.personagens (id) on delete cascade,
  cliente text not null references public.personagens (id) on delete cascade,
  tipo text not null,
  preco bigint not null,
  ouro_extra bigint not null default 0,
  item jsonb,
  insumos jsonb not null default '[]'::jsonb,     -- [{ tipo, raridade, qtd }]
  opcoes jsonb not null default '{}'::jsonb,
  estado text not null default 'pendente' check (estado in ('pendente', 'feito', 'cancelado', 'expirado')),
  resultado jsonb,
  criado_em timestamptz not null default now(),
  feito_em timestamptz
);
create index if not exists oficina_pedidos_artesao on public.oficina_pedidos (artesao, estado);
create index if not exists oficina_pedidos_cliente on public.oficina_pedidos (cliente, criado_em desc);
create table if not exists public.reliquias (
  nome_chave text primary key,
  nome text not null,
  dono text,
  forjada_por text,
  criada_em timestamptz not null default now()
);
alter table public.oficinas enable row level security;
alter table public.oficina_pedidos enable row level security;
alter table public.reliquias enable row level security;

create or replace function public.craft_cfg() returns jsonb
language sql immutable as $$ select public.tanka_dados() -> 'CRAFT'; $$;
create or replace function public.encanto_cfg() returns jsonb
language sql immutable as $$ select public.tanka_dados() -> 'ENCANTO'; $$;

-- Material da região / do chefe da região (CRAFT.materiais).
create or replace function public.craft_material_area(area text) returns text
language sql immutable as $$ select k from jsonb_each(public.craft_cfg() -> 'materiais') m(k, v) where v ->> 'area' = area limit 1; $$;
create or replace function public.craft_material_chefe(area text) returns text
language sql immutable as $$
  select k from jsonb_each(public.craft_cfg() -> 'materiais') m(k, v)
  where v ->> 'chefe' = (select a ->> 'chefe' from jsonb_array_elements(public.craft_cfg() -> 'areas') a where a ->> 'id' = area) limit 1;
$$;
create or replace function public.craft_area_idx(area text) returns int
language sql immutable as $$ select (i - 1)::int from jsonb_array_elements(public.craft_cfg() -> 'areas') with ordinality x(a, i) where a ->> 'id' = area; $$;

-- O que o cliente entrega para cada serviço: [{ tipo, raridade, qtd }]. Erro se as opções forem inválidas.
create or replace function public.oficina_insumos(tipo text, item jsonb, opcoes jsonb) returns jsonb
language plpgsql immutable as $$
declare cfg jsonb := public.craft_cfg(); l jsonb := '[]'::jsonb; area text := opcoes ->> 'area'; n int; k text; v jsonb;
begin
  if tipo = 'encantar' then
    l := l || jsonb_build_array(jsonb_build_object('tipo', 'pergaminho', 'raridade', item ->> 'raridade', 'qtd', 1));
    if coalesce((opcoes ->> 'protecao')::boolean, false) then
      l := l || jsonb_build_array(jsonb_build_object('tipo', 'protecao', 'raridade', item ->> 'raridade', 'qtd', 1));
    end if;
  elsif tipo in ('forjar', 'receita') then
    if public.craft_area_idx(area) is null then raise exception 'Região inválida.'; end if;
    if tipo = 'receita' then
      l := jsonb_build_array(jsonb_build_object('tipo', 'material', 'raridade', public.craft_material_area(area), 'qtd', (cfg -> 'receita' ->> 'material')::int));
    else
      if (opcoes ->> 'classe') not in ('cavaleiro', 'arqueiro', 'mago', 'artesao') then raise exception 'Classe inválida.'; end if;
      if (opcoes ->> 'tipo') not in ('arma', 'elmo', 'peitoral', 'luvas', 'botas', 'secundaria') then raise exception 'Item inválido.'; end if;
      l := jsonb_build_array(jsonb_build_object('tipo', 'receita', 'raridade', area, 'qtd', 1),
        jsonb_build_object('tipo', 'material', 'raridade', public.craft_material_area(area), 'qtd', (cfg -> 'forja' ->> 'material')::int));
      n := least(greatest(coalesce((opcoes ->> 'chefe')::int, 0), 0), (cfg -> 'forja' ->> 'maxExtra')::int);
      if n > 0 then l := l || jsonb_build_array(jsonb_build_object('tipo', 'material', 'raridade', public.craft_material_chefe(area), 'qtd', n)); end if;
      n := least(greatest(coalesce((opcoes ->> 'gemas')::int, 0), 0), (cfg -> 'forja' ->> 'maxExtra')::int);
      if n > 0 then l := l || jsonb_build_array(jsonb_build_object('tipo', 'material', 'raridade', 'gema', 'qtd', n)); end if;
    end if;
  elsif tipo = 'protecao' then
    v := cfg -> 'protecao' -> (opcoes ->> 'raridade');
    if v is null then raise exception 'Raridade inválida.'; end if;
    l := jsonb_build_array(jsonb_build_object('tipo', 'cristal', 'raridade', opcoes ->> 'raridade', 'qtd', (v ->> 'cristal')::int));
    for k in select jsonb_object_keys(v -> 'materiais') loop
      l := l || jsonb_build_array(jsonb_build_object('tipo', 'material', 'raridade', k, 'qtd', (v -> 'materiais' ->> k)::int));
    end loop;
  elsif tipo = 'reliquia' then
    for k in select jsonb_object_keys(cfg -> 'reliquia' -> 'materiais') loop
      l := l || jsonb_build_array(jsonb_build_object('tipo', 'material', 'raridade', k, 'qtd', (cfg -> 'reliquia' -> 'materiais' ->> k)::int));
    end loop;
  else raise exception 'Serviço inválido.'; end if;
  return l;
end $$;

-- Ouro que some (o da receita/forja), além do preço do artesão.
create or replace function public.oficina_ouro_extra(tipo text, opcoes jsonb) returns bigint
language sql immutable as $$
  select case tipo when 'forjar' then (public.craft_cfg() -> 'forja' -> 'ouro' ->> public.craft_area_idx(opcoes ->> 'area'))::bigint
    when 'receita' then (public.craft_cfg() -> 'receita' -> 'ouro' ->> public.craft_area_idx(opcoes ->> 'area'))::bigint else 0 end;
$$;

create or replace function public.oficina_semana_reliquias(artesao text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.oficina_pedidos where oficina_pedidos.artesao = oficina_semana_reliquias.artesao
    and tipo = 'reliquia' and estado = 'feito' and feito_em >= public.arena_inicio_semana();
$$;

-- Devolve tudo ao cliente (cancelado ou expirado).
create or replace function public.oficina_devolver(pid bigint, motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare x public.oficina_pedidos; i jsonb;
begin
  select * into x from public.oficina_pedidos where id = pid for update;
  if x.estado <> 'pendente' then return; end if;
  update public.oficina_pedidos set estado = motivo, feito_em = now() where id = pid;
  if x.item is not null then insert into public.recompensas (personagem_id, item, origem) values (x.cliente, x.item, 'oficina'); end if;
  for i in select * from jsonb_array_elements(x.insumos) loop
    insert into public.recompensas (personagem_id, item, origem) values (x.cliente, i, 'oficina');
  end loop;
  perform public.creditar(x.cliente, (x.preco + x.ouro_extra)::int, 0, 'Oficina: pedido ' || case motivo when 'cancelado' then 'cancelado' else 'não feito a tempo' end);
end $$;

create or replace function public.oficina_expirar() returns void
language plpgsql security definer set search_path = public as $$
declare x record;
begin
  for x in select id from public.oficina_pedidos where estado = 'pendente'
      and criado_em < now() - make_interval(hours => (public.craft_cfg() -> 'oficina' ->> 'prazoHoras')::int) loop
    perform public.oficina_devolver(x.id, 'expirado');
  end loop;
end $$;

-- Tudo que a tela das Oficinas precisa.
create or replace function public.oficina_estado(meu text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  perform public.oficina_expirar();
  return jsonb_build_object(
    'minha', (select jsonb_build_object('servicos', o.servicos, 'bonus_encanto', o.bonus_encanto) from public.oficinas o where o.personagem_id = meu),
    'lista', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'raca', p.dados ->> 'raca', 'sexo', p.dados ->> 'sexo',
        'classe2', p.dados -> 'talentos' ->> 'classe2', 'nivel', coalesce((p.dados ->> 'nivel')::int, 1), 'servicos', o.servicos,
        'bonus_encanto', o.bonus_encanto, 'sorte', o.sorte, 'visto_em', p.atualizado_em,
        'encantos', (select count(*) from public.oficina_pedidos x where x.artesao = p.id and x.tipo = 'encantar' and x.estado = 'feito'),
        'acertos', (select count(*) from public.oficina_pedidos x where x.artesao = p.id and x.tipo = 'encantar' and x.estado = 'feito' and (x.resultado ->> 'sucesso')::boolean),
        'tent10', (select count(*) from public.oficina_pedidos x where x.artesao = p.id and x.tipo = 'encantar' and x.estado = 'feito' and (x.resultado ->> 'alvo')::int = 10),
        'acertos10', (select count(*) from public.oficina_pedidos x where x.artesao = p.id and x.tipo = 'encantar' and x.estado = 'feito' and (x.resultado ->> 'alvo')::int = 10 and (x.resultado ->> 'sucesso')::boolean),
        'feitos', (select count(*) from public.oficina_pedidos x where x.artesao = p.id and x.estado = 'feito'),
        'fila', (select count(*) from public.oficina_pedidos x where x.artesao = p.id and x.estado = 'pendente'),
        'reliquia_semana', public.oficina_semana_reliquias(p.id))
        order by (select count(*) from public.oficina_pedidos x where x.artesao = p.id and x.estado = 'feito') desc, p.nome)
      from public.oficinas o join public.personagens p on p.id = o.personagem_id where o.servicos <> '{}'::jsonb), '[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'tipo', x.tipo, 'preco', x.preco, 'item', x.item, 'opcoes', x.opcoes,
        'estado', x.estado, 'resultado', x.resultado, 'criado_em', x.criado_em, 'artesao', pa.nome) order by x.id desc)
      from (select * from public.oficina_pedidos where cliente = meu order by id desc limit 20) x join public.personagens pa on pa.id = x.artesao), '[]'::jsonb),
    'fazer', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'tipo', x.tipo, 'preco', x.preco, 'item', x.item, 'opcoes', x.opcoes,
        'insumos', x.insumos, 'criado_em', x.criado_em, 'cliente', pc.nome) order by x.id)
      from public.oficina_pedidos x join public.personagens pc on pc.id = x.cliente where x.artesao = meu and x.estado = 'pendente'), '[]'::jsonb),
    'agora', now(),
    'recompensas', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'item', r.item, 'origem', r.origem) order by r.id)
      from public.recompensas r where r.personagem_id = meu and not r.resgatada), '[]'::jsonb));
end $$;

-- O artesão abre/atualiza a oficina: servicos = { tipo: preço } (0 ou vazio = não oferece).
create or replace function public.oficina_configurar(meu text, servicos jsonb, bonus numeric, sorte int) returns void
language plpgsql security definer set search_path = public as $$
declare d jsonb; c2 text; k text; v bigint; ok jsonb := '{}'::jsonb; cfg jsonb := public.craft_cfg() -> 'oficina' -> 'servicos';
begin
  perform public.conferir_dono(meu);
  select dados into d from public.personagens where id = meu;
  c2 := d -> 'talentos' ->> 'classe2';
  if c2 not in ('ferreiro', 'coletor') then raise exception 'Só Ferreiros e Coletores abrem uma oficina.'; end if;
  for k in select jsonb_object_keys(coalesce(servicos, '{}'::jsonb)) loop
    v := floor(coalesce((servicos ->> k)::numeric, 0));
    continue when v <= 0 or cfg -> k is null;
    if cfg -> k ->> 'de' <> c2 then raise exception '% não oferece "%".', initcap(c2), cfg -> k ->> 'nome'; end if;
    if v > 2000000000 then raise exception 'Preço muito alto.'; end if;
    ok := ok || jsonb_build_object(k, v);
  end loop;
  insert into public.oficinas (personagem_id, servicos, bonus_encanto, sorte, atualizado_em)
    values (meu, ok, least(greatest(coalesce(bonus, 0), 0), 100), greatest(coalesce(sorte, 0), 0), now())
  on conflict (personagem_id) do update set servicos = excluded.servicos, bonus_encanto = excluded.bonus_encanto,
    sorte = excluded.sorte, atualizado_em = now();
end $$;

-- O cliente pede um serviço. Devolve o pedido (com os insumos, para o jogo tirar igual na memória).
create or replace function public.oficina_pedir(meu text, artesao text, tipo text, item_id text, opcoes jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare o public.oficinas; d jsonb; da jsonb; it jsonb := null; ins jsonb; i jsonb; tem int; preco bigint; extra bigint;
  cfg jsonb := public.craft_cfg(); e jsonb := public.encanto_cfg(); x public.oficina_pedidos; v_nome text;
begin
  perform public.conferir_dono(meu);
  opcoes := coalesce(opcoes, '{}'::jsonb);
  select * into o from public.oficinas where personagem_id = artesao;
  preco := (o.servicos ->> tipo)::bigint;
  if o.personagem_id is null or preco is null then raise exception 'Essa oficina não oferece esse serviço.'; end if;
  if (select count(*) from public.oficina_pedidos where cliente = meu and estado = 'pendente') >= (cfg -> 'oficina' ->> 'maxPedidos')::int then
    raise exception 'Você já tem % pedidos esperando. Espere ficarem prontos.', cfg -> 'oficina' ->> 'maxPedidos'; end if;
  select dados into da from public.personagens where id = artesao;
  select dados into d from public.personagens where id = meu for update;
  if tipo in ('encantar', 'reliquia') then
    select e2 into it from jsonb_array_elements(coalesce(d -> 'inventario', '[]'::jsonb)) e2 where e2 ->> 'id' = item_id limit 1;
    if it is null then raise exception 'Item não encontrado na mochila (salve o jogo e tente de novo).'; end if;
    if exists (select 1 from jsonb_each_text(coalesce(d -> 'equipados', '{}'::jsonb)) q where q.value = item_id) then raise exception 'Tire o item do corpo antes.'; end if;
    if (it ->> 'travado') = 'true' then raise exception 'Destrave o item antes.'; end if;
    if tipo = 'encantar' and coalesce((it ->> 'encanto')::int, 0) >= (e ->> 'maximo')::int then raise exception 'Esse item já está no máximo.'; end if;
    if tipo = 'encantar' and it ? 'runa' then raise exception 'Relíquias não podem mais ser encantadas.'; end if;
    if tipo = 'reliquia' then
      if it ->> 'raridade' <> 'lendaria' or coalesce((it ->> 'encanto')::int, 0) < (cfg -> 'reliquia' ->> 'encantoMin')::int then
        raise exception 'A relíquia precisa de um item lendário +% ou mais.', cfg -> 'reliquia' ->> 'encantoMin'; end if;
      if it ? 'runa' then raise exception 'Esse item já é uma relíquia.'; end if;
      v_nome := btrim(opcoes ->> 'nome');
      if v_nome is null or char_length(v_nome) not between 3 and 24 then raise exception 'Escolha um nome de 3 a 24 letras para a relíquia.'; end if;
      if exists (select 1 from public.reliquias where nome_chave = lower(v_nome))
         or exists (select 1 from public.oficina_pedidos where tipo = 'reliquia' and estado = 'pendente' and lower(opcoes ->> 'nome') = lower(v_nome)) then
        raise exception 'Já existe uma relíquia com esse nome.'; end if;
      if da ->> 'raca' <> 'anao' or coalesce((da ->> 'nivel')::int, 1) < (cfg -> 'reliquia' ->> 'nivelMin')::int then
        raise exception 'Só um Anão Ferreiro level % forja relíquias.', cfg -> 'reliquia' ->> 'nivelMin'; end if;
      if public.oficina_semana_reliquias(artesao) >= 1 then raise exception 'Esse Ferreiro já forjou a relíquia da semana.'; end if;
    end if;
    d := jsonb_set(d, '{inventario}', coalesce((select jsonb_agg(q) from jsonb_array_elements(d -> 'inventario') q where q ->> 'id' <> item_id), '[]'::jsonb));
  end if;
  if tipo = 'protecao' then opcoes := jsonb_build_object('raridade', opcoes ->> 'raridade'); end if;
  ins := public.oficina_insumos(tipo, it, opcoes);
  for i in select * from jsonb_array_elements(ins) loop
    select coalesce(sum((c ->> 'qtd')::int), 0) into tem from jsonb_array_elements(coalesce(d -> 'consumiveis', '[]'::jsonb)) c
      where c ->> 'tipo' = i ->> 'tipo' and c ->> 'raridade' = i ->> 'raridade';
    if tem < (i ->> 'qtd')::int then raise exception 'Faltam materiais: você tem % de % (precisa de %).', tem, i ->> 'raridade', i ->> 'qtd'; end if;
    d := jsonb_set(d, '{consumiveis}', coalesce((select jsonb_agg(case when c ->> 'tipo' = i ->> 'tipo' and c ->> 'raridade' = i ->> 'raridade'
        then jsonb_set(c, '{qtd}', to_jsonb((c ->> 'qtd')::int - (i ->> 'qtd')::int)) else c end)
      from jsonb_array_elements(d -> 'consumiveis') c
      where not (c ->> 'tipo' = i ->> 'tipo' and c ->> 'raridade' = i ->> 'raridade' and (c ->> 'qtd')::int - (i ->> 'qtd')::int <= 0)), '[]'::jsonb));
  end loop;
  extra := coalesce(public.oficina_ouro_extra(tipo, opcoes), 0);
  if public.ouro_real(meu) < preco + extra then raise exception 'Ouro insuficiente (precisa de %).', preco + extra; end if;
  update public.personagens set dados = d where id = meu;
  perform public.creditar(meu, -(preco + extra)::int, 0, 'Oficina: serviço pedido');
  insert into public.oficina_pedidos (artesao, cliente, tipo, preco, ouro_extra, item, insumos, opcoes)
    values (artesao, meu, tipo, preco, extra, it, ins, opcoes) returning * into x;
  return jsonb_build_object('id', x.id, 'insumos', x.insumos, 'item_id', item_id);
end $$;

create or replace function public.oficina_cancelar(meu text, pedido bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  if not exists (select 1 from public.oficina_pedidos where id = pedido and cliente = meu and estado = 'pendente') then
    raise exception 'Esse pedido não está mais esperando.'; end if;
  perform public.oficina_devolver(pedido, 'cancelado');
end $$;

-- O artesão faz o serviço. A sorte é jogada aqui.
create or replace function public.oficina_fazer(meu text, pedido bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x public.oficina_pedidos; o public.oficinas; da jsonb; cfg jsonb := public.craft_cfg(); e jsonb := public.encanto_cfg();
  alvo int; chance numeric; r numeric; res jsonb; it jsonb; protegido boolean; area text; ch int; ge int; t jsonb; rar text;
  ordem text[] := array['comum', 'rara', 'epica', 'lendaria']; obra boolean; cr int; runas jsonb; ru jsonb; nome_art text; taxa int;
begin
  perform public.conferir_dono(meu);
  select * into x from public.oficina_pedidos where id = pedido for update;
  if x.id is null or x.artesao <> meu then raise exception 'Pedido não encontrado.'; end if;
  if x.estado <> 'pendente' then raise exception 'Esse pedido não está mais esperando.'; end if;
  select * into o from public.oficinas where personagem_id = meu;
  select dados into da from public.personagens where id = meu;
  nome_art := da ->> 'nome';
  if x.tipo = 'encantar' then
    it := x.item; alvo := coalesce((it ->> 'encanto')::int, 0) + 1;
    chance := case when alvo <= (e ->> 'seguroAte')::int then 100
      else least((e ->> 'chanceMaxima')::numeric, coalesce((e -> 'teto' ->> alvo::text)::numeric, 100), (e -> 'chances' ->> alvo::text)::numeric + o.bonus_encanto) end;
    protegido := exists (select 1 from jsonb_array_elements(x.insumos) q where q ->> 'tipo' = 'protecao');
    r := random() * 100;
    if r < chance then
      it := jsonb_set(it, '{encanto}', to_jsonb(alvo));
      res := jsonb_build_object('sucesso', true, 'alvo', alvo, 'chance', chance);
      insert into public.recompensas (personagem_id, item, origem) values (x.cliente, it, 'oficina');
    elsif protegido or alvo <= (e ->> 'seguroAte')::int then
      res := jsonb_build_object('sucesso', false, 'alvo', alvo, 'chance', chance, 'protegido', true);
      insert into public.recompensas (personagem_id, item, origem) values (x.cliente, it, 'oficina');
    elsif alvo <= (e ->> 'voltaZeroAte')::int then
      it := jsonb_set(it, '{encanto}', to_jsonb(0));
      res := jsonb_build_object('sucesso', false, 'alvo', alvo, 'chance', chance, 'zerou', true);
      insert into public.recompensas (personagem_id, item, origem) values (x.cliente, it, 'oficina');
    else
      cr := coalesce((e -> 'cristais' ->> alvo::text)::int, 0);
      res := jsonb_build_object('sucesso', false, 'alvo', alvo, 'chance', chance, 'quebrou', true, 'cristais', cr);
      if cr > 0 then insert into public.recompensas (personagem_id, item, origem) values (x.cliente,
        jsonb_build_object('tipo', 'cristal', 'raridade', it ->> 'raridade', 'qtd', cr), 'oficina'); end if;
    end if;
  elsif x.tipo = 'forjar' then
    area := x.opcoes ->> 'area';
    ch := least(greatest(coalesce((x.opcoes ->> 'chefe')::int, 0), 0), (cfg -> 'forja' ->> 'maxExtra')::int);
    ge := least(greatest(coalesce((x.opcoes ->> 'gemas')::int, 0), 0), (cfg -> 'forja' ->> 'maxExtra')::int);
    t := jsonb_build_object('lendaria', ch * (cfg -> 'forja' -> 'extraChefe' ->> 'lendaria')::numeric + ge * (cfg -> 'forja' -> 'extraGema' ->> 'lendaria')::numeric,
      'epica', 5 + ch * (cfg -> 'forja' -> 'extraChefe' ->> 'epica')::numeric + ge * (cfg -> 'forja' -> 'extraGema' ->> 'epica')::numeric, 'rara', 35);
    r := random() * 100;
    rar := case when r < (t ->> 'lendaria')::numeric then 'lendaria'
      when r < (t ->> 'lendaria')::numeric + (t ->> 'epica')::numeric then 'epica'
      when r < (t ->> 'lendaria')::numeric + (t ->> 'epica')::numeric + 35 then 'rara' else 'comum' end;
    obra := rar <> 'lendaria' and random() * 100 < (cfg -> 'forja' ->> 'obraPrima')::numeric
      + case when da ->> 'raca' = 'anao' then (cfg -> 'forja' ->> 'obraPrimaAnao')::numeric else 0 end;
    if obra then rar := ordem[array_position(ordem, rar) + 1]; end if;
    res := jsonb_build_object('raridade', rar, 'obraPrima', obra);
    insert into public.recompensas (personagem_id, item, origem) values (x.cliente, jsonb_build_object('tipo', 'forjado',
      'spec', jsonb_build_object('classe', x.opcoes ->> 'classe', 'tipo', x.opcoes ->> 'tipo', 'raridade', rar, 'area', area,
        'semente', floor(random() * 2147483647)::bigint, 'forjadoPor', nome_art, 'obraPrima', obra)), 'oficina');
  elsif x.tipo = 'receita' then
    res := jsonb_build_object('sucesso', true);
    insert into public.recompensas (personagem_id, item, origem) values (x.cliente,
      jsonb_build_object('tipo', 'receita', 'raridade', x.opcoes ->> 'area', 'qtd', 1), 'oficina');
  elsif x.tipo = 'protecao' then
    res := jsonb_build_object('sucesso', true);
    insert into public.recompensas (personagem_id, item, origem) values (x.cliente,
      jsonb_build_object('tipo', 'protecao', 'raridade', x.opcoes ->> 'raridade', 'qtd', 1), 'oficina');
  elsif x.tipo = 'reliquia' then
    if public.oficina_semana_reliquias(meu) >= 1 then raise exception 'Você já forjou a relíquia desta semana.'; end if;
    chance := least((cfg -> 'reliquia' ->> 'maxima')::numeric, (cfg -> 'reliquia' ->> 'base')::numeric + o.sorte * (cfg -> 'reliquia' ->> 'porSorte')::numeric);
    it := x.item;
    if random() * 100 < chance then
      runas := cfg -> 'reliquia' -> 'runas';
      ru := runas -> floor(random() * jsonb_array_length(runas))::int;
      it := it || jsonb_build_object('nome', x.opcoes ->> 'nome', 'runa', ru ->> 'id', 'reliquia', true, 'forjadoPor', nome_art);
      insert into public.reliquias (nome_chave, nome, dono, forjada_por) values (lower(x.opcoes ->> 'nome'), x.opcoes ->> 'nome', x.cliente, meu);
      res := jsonb_build_object('sucesso', true, 'chance', chance, 'runa', ru ->> 'id');
    else
      res := jsonb_build_object('sucesso', false, 'chance', chance);
    end if;
    insert into public.recompensas (personagem_id, item, origem) values (x.cliente, it, 'oficina');
  end if;
  update public.oficina_pedidos set estado = 'feito', resultado = res, feito_em = now() where id = pedido;
  taxa := (cfg -> 'oficina' ->> 'taxa')::int;
  perform public.creditar(meu, floor(x.preco * (100 - taxa) / 100.0)::int, 0, 'Oficina: serviço feito (−' || taxa || '% de taxa)');
  return res;
end $$;

revoke execute on function public.craft_cfg(), public.encanto_cfg(), public.craft_material_area(text), public.craft_material_chefe(text),
  public.craft_area_idx(text), public.oficina_insumos(text, jsonb, jsonb), public.oficina_ouro_extra(text, jsonb),
  public.oficina_semana_reliquias(text), public.oficina_devolver(bigint, text), public.oficina_expirar() from public, anon, authenticated;
revoke execute on function public.oficina_estado(text), public.oficina_configurar(text, jsonb, numeric, int),
  public.oficina_pedir(text, text, text, text, jsonb), public.oficina_cancelar(text, bigint), public.oficina_fazer(text, bigint) from public, anon;
grant execute on function public.oficina_estado(text), public.oficina_configurar(text, jsonb, numeric, int),
  public.oficina_pedir(text, text, text, text, jsonb), public.oficina_cancelar(text, bigint), public.oficina_fazer(text, bigint) to authenticated;

notify pgrst, 'reload schema';
