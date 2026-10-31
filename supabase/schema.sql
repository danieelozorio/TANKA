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
drop function if exists public.ranking(text);   -- a lista de colunas mudou (sigla da aliança)
create or replace function public.ranking(tipo text) returns table (nome text, classe text, raca text, nivel int, exp bigint, poder bigint, sigla text)
language sql stable security definer set search_path = public as $$
  select p.nome, p.dados ->> 'classe', p.dados ->> 'raca',
         coalesce((p.dados ->> 'nivel')::int, 1), coalesce((p.dados ->> 'exp')::bigint, 0), coalesce((p.dados ->> 'poder')::bigint, 0),
         (select a.sigla from public.alianca_membros m join public.aliancas a on a.id = m.alianca_id where m.personagem_id = p.id)
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
drop function if exists public.amigos_listar(text);   -- a lista de colunas mudou (sigla da aliança)
create or replace function public.amigos_listar(meu text)
returns table (pedido bigint, situacao text, id text, nome text, classe text, raca text, nivel int, poder bigint, visto_em timestamptz, sigla text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.conferir_dono(meu);
  return query
  select a.id,
         case when a.status = 'aceita' then 'amigo' when a.de = meu then 'enviado' else 'recebido' end,
         p.id, p.nome, p.dados ->> 'classe', p.dados ->> 'raca',
         coalesce((p.dados ->> 'nivel')::int, 1), coalesce((p.dados ->> 'poder')::bigint, 0), p.atualizado_em,
         (select al.sigla from public.alianca_membros m join public.aliancas al on al.id = m.alianca_id where m.personagem_id = p.id)
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

create or replace function public.entradas_usadas(pid text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select usadas from public.masmorra_entradas where personagem_id = pid and dia = public.dia_jogo()), 0);
$$;

-- Raridade da joia pela tabela da masmorra (a melhor primeiro); a Sorte aumenta as chances
-- das raridades melhores (+1% relativo por ponto). Mesmas chances de js/dados.js (masmorras).
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
    acum := acum + chances[i] * (1 + greatest(coalesce(sorte, 0), 0) / 100.0);
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
        'membros', (select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'classe', p.dados ->> 'classe', 'raca', p.dados ->> 'raca',
            'sexo', p.dados ->> 'sexo', 'nivel', coalesce((p.dados ->> 'nivel')::int, 1), 'pronto', gm.pronto,
            'entradas', public.entradas_usadas(p.id), 'visto_em', p.atualizado_em) order by gm.entrou_em)
          from public.grupo_membros gm join public.personagens p on p.id = gm.personagem_id where gm.grupo_id = gr.id),
        'convidados', coalesce((select jsonb_agg(p.nome) from public.grupo_convites c join public.personagens p on p.id = c.para where c.grupo_id = gr.id), '[]'::jsonb))
      from public.grupos gr where gr.id = g) end,
    -- Última luta da qual este personagem participou (nos últimos 20 minutos).
    'run', (select jsonb_build_object('id', r.id, 'masmorra', r.masmorra, 'semente', r.semente, 'herois', r.herois,
        'estado', r.estado, 'criado_em', r.criado_em)
      from public.masmorra_runs r where meu = any (r.membros) and r.criado_em > now() - interval '20 minutes'
      order by r.id desc limit 1),
    'recompensas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'item', x.item) order by x.id)
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
  delete from public.grupo_convites where para = meu;   -- os outros convites perdem o sentido
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
    where gm.grupo_id = g and public.entradas_usadas(p.id) >= 2;
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
-- (colar ou anel). Derrota: não gasta entrada e ninguém ganha nada.
create or replace function public.masmorra_concluir(meu text, run_id bigint, vitoria boolean) returns void
language plpgsql security definer set search_path = public as $$
declare run public.masmorra_runs; pid text; sorte int;
begin
  perform public.conferir_dono(meu);
  select * into run from public.masmorra_runs where id = run_id;
  if run.id is null or run.lider <> meu then raise exception 'Só o líder informa o resultado.'; end if;
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
  end loop;
end $$;

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
language sql immutable as $dados$ select '{"HP_INICIAL":100,"HP_POR_NIVEL":10,"HP_POR_RES":5,"VELOCIDADE":{"inicial":15,"porNivel":1.06},"raridades":{"comum":{"danoMin":[1,5],"danoMax":[5,10]},"rara":{"danoMin":[11,15],"danoMax":[16,20]},"epica":{"danoMin":[21,24],"danoMax":[25,30]},"lendaria":{"danoMin":[31,34],"danoMax":[35,40]}},"classes":{"cavaleiro":{"dano":"fisico"},"arqueiro":{"dano":"fisico"},"mago":{"dano":"magico"},"artesao":{"dano":"fisico"}},"armaduras":{"cavaleiro":{"elmo":{"bonus":{"defesa":[2,5,10,20],"vida":[10,25,60,150]}},"peitoral":{"bonus":{"defesa":[3,8,16,32],"vida":[15,40,100,250]}},"luvas":{"bonus":{"defesa":[1,3,6,12],"for":[1,2,4,8]}},"botas":{"bonus":{"defesa":[1,3,6,12],"res":[1,2,4,8]}}},"arqueiro":{"elmo":{"bonus":{"defesa":[1,3,6,12],"des":[1,2,4,8]}},"peitoral":{"bonus":{"defesa":[2,5,10,20],"vida":[10,25,60,150]}},"luvas":{"bonus":{"defesa":[1,2,4,8],"des":[1,2,4,8]}},"botas":{"bonus":{"defesa":[1,2,4,8],"sor":[1,2,4,8]}}},"mago":{"elmo":{"bonus":{"defesaMagica":[2,5,10,20],"int":[1,2,4,8]}},"peitoral":{"bonus":{"defesa":[1,3,6,12],"defesaMagica":[2,5,10,20],"vida":[5,15,40,100]}},"luvas":{"bonus":{"defesa":[1,2,4,8],"int":[1,2,4,8]}},"botas":{"bonus":{"defesa":[1,2,4,8],"des":[1,2,4,8]}}},"artesao":{"elmo":{"bonus":{"defesa":[2,4,8,16],"vida":[5,15,40,100]}},"peitoral":{"bonus":{"defesa":[2,5,10,20],"vida":[10,25,60,150]}},"luvas":{"bonus":{"defesa":[1,2,4,8],"for":[1,2,4,8]}},"botas":{"bonus":{"defesa":[1,2,4,8],"sor":[1,2,4,8]}}}},"joias":{"colar":{"bonus":{"defesaMagica":[1,3,6,12],"vida":[5,15,40,100]}},"anel":{"bonus":{"sor":[1,2,4,8]}}},"danoPorNivel":{"comum":1,"rara":2,"epica":3,"lendaria":5},"bonusPorNivel":{"elmo":"defesa","peitoral":"defesa","luvas":"defesa","botas":"defesa","colar":"defesaMagica","anel":"sor"},"ARENA":{"nivelMin":5,"entradasMax":5,"recargaMinutos":60,"alcanceDesafio":5,"tempoDado":5,"limiteTurnos":200,"reputacaoVitoria":10,"reputacaoTop1Diario":500,"jackpotPorDefesa":100,"top1PorHora":0.1,"dado":[0,0.6,0.7,0.8,0.9,1,1.05,1.1,1.15,1.2,1.25,1.3,1.35,1.4,1.45,1.5,1.55,1.7,1.8,2],"saque":{"ate":30,"minimo":5,"desde":80,"maximo":10,"meio":[5,8]},"arenas":[{"id":"a1","nome":"Arena 5~10","nivel":[5,10],"jackpotPor10min":50},{"id":"a2","nome":"Arena 11~20","nivel":[11,20],"jackpotPor10min":100},{"id":"a3","nome":"Arena 21~30","nivel":[21,30],"jackpotPor10min":150},{"id":"a4","nome":"Arena 30+","nivel":[31,40],"jackpotPor10min":200}]},"ALIANCA":{"nivelMin":10,"custoOuro":10000,"custoReputacao":300,"vagasIniciais":15,"vagasPorNivel":3,"maxOficiais":3,"nivelMax":10,"expProximo":[50000,100000,200000,400000,700000,1000000,1500000,2000000,3000000],"doacaoMinima":100,"esperaHoras":24,"liderSumidoDias":14,"ativoDias":3,"muralMax":300,"bonus":{"custo":20000,"dias":7,"minimo":5,"maximo":15},"brasao":{"formas":["classico","redondo","pontudo","estandarte"],"cores":["#8e1b1b","#1f4f8e","#2d6b34","#5b2a86","#b8860b","#2b2b2b","#7a3e12","#1f6b6b"],"simbolos":["dragao","lobo","coroa","caveira","espada","machado","olho","chama"]}}}'::jsonb; $dados$;
-- <<< DADOS DO JOGO

-- ---------- Arena (PvP) ----------
-- Tudo roda aqui no servidor: força dos personagens, dados (D20), dano, saque de ouro e ranking.
-- Ouro e reputação ganhos ou perdidos viram "créditos" que o jogo de cada um aplica ao entrar.

-- Força de combate de um personagem a partir dos dados salvos (mesmas fórmulas de js/regras.js: status).
create or replace function public.tanka_status(p jsonb) returns jsonb
language plpgsql stable as $$
declare
  T jsonb := public.tanka_dados();
  raridades text[] := array['comum', 'rara', 'epica', 'lendaria'];
  eq jsonb := '{}'::jsonb; iid text; it jsonb; tipo text; idx int; def jsonb; k text; arr jsonb; enc int;
  fo numeric; de numeric; re numeric; inte numeric; nivel int := coalesce((p ->> 'nivel')::int, 1);
  magico boolean; dmin numeric := 0; dmax numeric := 0; extra numeric; bonus numeric;
begin
  for iid in select value #>> '{}' from jsonb_each(coalesce(p -> 'equipados', '{}'::jsonb)) where jsonb_typeof(value) = 'string' loop
    select x into it from jsonb_array_elements(p -> 'inventario') x where x ->> 'id' = iid limit 1;
    if it is null or it ->> 'tipo' = 'arma' then continue; end if;
    tipo := it ->> 'tipo';
    idx := array_position(raridades, it ->> 'raridade') - 1;
    def := case when tipo in ('colar', 'anel') then T -> 'joias' -> tipo else T -> 'armaduras' -> (it ->> 'classe') -> tipo end;
    if def is null then continue; end if;
    for k, arr in select * from jsonb_each(def -> 'bonus') loop
      eq := jsonb_set(eq, array[k], to_jsonb(coalesce((eq ->> k)::numeric, 0) + (arr ->> idx)::numeric));
    end loop;
    enc := coalesce((it ->> 'encanto')::int, 0);
    if enc > 0 then
      k := T -> 'bonusPorNivel' ->> tipo;
      eq := jsonb_set(eq, array[k], to_jsonb(coalesce((eq ->> k)::numeric, 0) + enc));
    end if;
  end loop;
  fo := (p -> 'atributos' ->> 'for')::numeric + coalesce((eq ->> 'for')::numeric, 0);
  de := (p -> 'atributos' ->> 'des')::numeric + coalesce((eq ->> 'des')::numeric, 0);
  re := (p -> 'atributos' ->> 'res')::numeric + coalesce((eq ->> 'res')::numeric, 0);
  inte := (p -> 'atributos' ->> 'int')::numeric + coalesce((eq ->> 'int')::numeric, 0);
  magico := T -> 'classes' -> (p ->> 'classe') ->> 'dano' = 'magico';
  iid := p -> 'equipados' ->> 'arma';
  select x into it from jsonb_array_elements(p -> 'inventario') x where x ->> 'id' = iid limit 1;
  if it is not null then
    if it ? 'dano' then dmin := (it -> 'dano' ->> 0)::numeric; dmax := (it -> 'dano' ->> 1)::numeric;
    else dmin := (T -> 'raridades' -> (it ->> 'raridade') -> 'danoMin' ->> 0)::numeric; dmax := (T -> 'raridades' -> (it ->> 'raridade') -> 'danoMax' ->> 1)::numeric;
    end if;
    extra := coalesce((it ->> 'encanto')::int, 0) * (T -> 'danoPorNivel' ->> (it ->> 'raridade'))::numeric;
    dmin := dmin + extra; dmax := dmax + extra;
  end if;
  bonus := floor((case when magico then inte else fo end) / 5);
  return jsonb_build_object(
    'hpMax', (T ->> 'HP_INICIAL')::numeric + greatest(0, re - (p -> 'atributosIniciais' ->> 'res')::numeric) * (T ->> 'HP_POR_RES')::numeric
      + (nivel - 1) * (T ->> 'HP_POR_NIVEL')::numeric + coalesce((eq ->> 'vida')::numeric, 0),
    'dano', jsonb_build_array(dmin + bonus, dmax + bonus), 'magico', magico,
    'defesa', floor(re / 10) + coalesce((eq ->> 'defesa')::numeric, 0),
    'defesaMagica', floor(re / 10) + coalesce((eq ->> 'defesaMagica')::numeric, 0),
    'velocidade', round((T -> 'VELOCIDADE' ->> 'inicial')::numeric * power((T -> 'VELOCIDADE' ->> 'porNivel')::numeric, nivel - 1)));
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
create index if not exists arena_lutas_atacante on public.arena_lutas (atacante, id desc);
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

-- Lutador da luta a partir dos dados salvos do personagem.
create or replace function public.arena_lutador(pid text) returns jsonb
language plpgsql stable as $$
declare p public.personagens; s jsonb;
begin
  select * into p from public.personagens where id = pid;
  s := public.tanka_status(p.dados);
  return jsonb_build_object('id', p.id, 'nome', p.nome, 'classe', p.dados ->> 'classe', 'raca', p.dados ->> 'raca', 'sexo', p.dados ->> 'sexo',
    'skin', coalesce(p.dados ->> 'skinDado', 'vermelho'),
    'nivel', coalesce((p.dados ->> 'nivel')::int, 1), 'hp', s -> 'hpMax', 'hpMax', s -> 'hpMax', 'dano', s -> 'dano', 'magico', s -> 'magico',
    'defesa', s -> 'defesa', 'defesaMagica', s -> 'defesaMagica', 'vel', greatest(1, (s ->> 'velocidade')::numeric), 'barra', 0);
end $$;

-- Um golpe com o dado: 1 erra; os outros multiplicam o dano (tabela ARENA.dado); a defesa do alvo é descontada.
create or replace function public.arena_golpe(atk jsonb, alvo jsonb, dado int) returns int
language plpgsql volatile as $$
declare mult numeric := (public.tanka_dados() -> 'ARENA' -> 'dado' ->> (dado - 1))::numeric;
  dmin int := (atk -> 'dano' ->> 0)::int; dmax int := (atk -> 'dano' ->> 1)::int; base int;
begin
  if mult = 0 then return 0; end if;
  base := dmin + floor(random() * (greatest(dmax, dmin) - dmin + 1));
  return greatest(1, round(base * mult) - (case when (atk ->> 'magico')::boolean then alvo ->> 'defesaMagica' else alvo ->> 'defesa' end)::int);
end $$;

-- Termina a luta: saque, reputação, ranking e jackpot.
create or replace function public.arena_finalizar(luta_id bigint, vitoria boolean) returns void
language plpgsql as $$
declare cfg jsonb := public.tanka_dados() -> 'ARENA'; L public.arena_lutas; a jsonb; perda numeric; pct int := 0; valor_saque int := 0;
  pa int; pd int; ar text; j public.arena_jackpot; premio int := 0; depois int;
begin
  select * into L from public.arena_lutas where id = luta_id for update;
  a := L.estado -> 'a';
  if vitoria then
    perda := ((a ->> 'hpMax')::numeric - greatest(0, (a ->> 'hp')::numeric)) * 100 / (a ->> 'hpMax')::numeric;
    pct := case when perda <= (cfg -> 'saque' ->> 'ate')::numeric then (cfg -> 'saque' ->> 'minimo')::int
                when perda >= (cfg -> 'saque' ->> 'desde')::numeric then (cfg -> 'saque' ->> 'maximo')::int
                else (cfg -> 'saque' -> 'meio' ->> 0)::int + floor(random() * ((cfg -> 'saque' -> 'meio' ->> 1)::int - (cfg -> 'saque' -> 'meio' ->> 0)::int + 1))::int end;
    valor_saque := floor(public.ouro_real(L.defensor) * pct / 100.0);
    perform public.creditar(L.atacante, valor_saque, (cfg ->> 'reputacaoVitoria')::int, 'Vitória na Arena contra ' || L.nome_defensor);
    perform public.creditar(L.defensor, -valor_saque, 0, 'Saque na Arena por ' || L.nome_atacante);
  end if;
  select posicao, arena into pa, ar from public.arena_posicoes where personagem_id = L.atacante;
  select posicao into pd from public.arena_posicoes where personagem_id = L.defensor and arena = ar;
  depois := pa;
  if L.revanche_de is null and pd is not null then
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
    saque_pct = pct, pos_antes = pa, pos_depois = depois, jackpot = premio, concluido_em = now(),
    estado = jsonb_set(estado, '{pendente}', 'false')
  where id = luta_id;
end $$;

-- Avança a luta até a próxima vez do atacante (que rola o dado) ou até o fim.
-- O defensor está offline: o servidor rola o dado por ele.
create or replace function public.arena_avancar(luta_id bigint) returns void
language plpgsql as $$
declare L public.arena_lutas; e jsonb; a jsonb; d jsonb; ev jsonb := '[]'::jsonb; dado int; dano int; turnos int; limite int;
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
    if (a ->> 'barra')::numeric >= 100 and (a ->> 'barra')::numeric >= (d ->> 'barra')::numeric then
      update public.arena_lutas set eventos = eventos || ev, estado = jsonb_build_object('a', a, 'd', d, 'turnos', turnos, 'pendente', true) where id = luta_id;
      return;
    elsif (d ->> 'barra')::numeric >= 100 then
      dado := 1 + floor(random() * 20)::int;
      dano := public.arena_golpe(d, a, dado);
      a := jsonb_set(a, '{hp}', to_jsonb(greatest(0, (a ->> 'hp')::int - dano)));
      d := jsonb_set(d, '{barra}', to_jsonb((d ->> 'barra')::numeric - 100));
      turnos := turnos + 1;
      ev := ev || jsonb_build_object('de', 'd', 'dado', dado, 'dano', dano, 'hpA', a -> 'hp', 'hpD', d -> 'hp');
      if (a ->> 'hp')::int <= 0 then
        update public.arena_lutas set eventos = eventos || ev, estado = jsonb_build_object('a', a, 'd', d, 'turnos', turnos, 'pendente', false) where id = luta_id;
        perform public.arena_finalizar(luta_id, false);
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
declare L public.arena_lutas; e jsonb; a jsonb; d jsonb; dado int; dano int;
begin
  select * into L from public.arena_lutas where id = luta_id for update;
  e := L.estado;
  if L.situacao <> 'andamento' or not (e ->> 'pendente')::boolean then raise exception 'Não é a sua vez.'; end if;
  a := e -> 'a'; d := e -> 'd';
  dado := case when rolar then 1 + floor(random() * 20)::int else 6 end;
  dano := public.arena_golpe(a, d, dado);
  d := jsonb_set(d, '{hp}', to_jsonb(greatest(0, (d ->> 'hp')::int - dano)));
  a := jsonb_set(a, '{barra}', to_jsonb((a ->> 'barra')::numeric - 100));
  update public.arena_lutas set
    eventos = eventos || jsonb_build_array(jsonb_build_object('de', 'a', 'dado', dado, 'dano', dano, 'auto', not rolar, 'hpA', a -> 'hp', 'hpD', d -> 'hp')),
    estado = jsonb_build_object('a', a, 'd', d, 'turnos', (e ->> 'turnos')::int + 1, 'pendente', false)
  where id = luta_id;
  if (d ->> 'hp')::int <= 0 then perform public.arena_finalizar(luta_id, true);
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

create or replace function public.arena_comecar(meu text, alvo text, revanche bigint) returns jsonb
language plpgsql as $$
declare ar text; lid bigint;
begin
  perform public.arena_encerrar_abandonadas(meu);
  perform public.arena_gastar_entrada(meu);
  select arena into ar from public.arena_posicoes where personagem_id = meu;
  insert into public.arena_lutas (arena, atacante, defensor, nome_atacante, nome_defensor, revanche_de, estado)
  values (ar, meu, alvo, (select nome from public.personagens where id = meu), (select nome from public.personagens where id = alvo), revanche,
    jsonb_build_object('a', public.arena_lutador(meu), 'd', public.arena_lutador(alvo), 'turnos', 0, 'pendente', false))
  returning id into lid;
  perform public.arena_avancar(lid);
  return public.arena_luta_json(lid);
end $$;

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
    'top5', coalesce((select jsonb_agg(jsonb_build_object('posicao', ap.posicao, 'id', p.id, 'nome', p.nome, 'classe', p.dados ->> 'classe',
        'raca', p.dados ->> 'raca', 'nivel', (p.dados ->> 'nivel')::int, 'poder', coalesce((p.dados ->> 'poder')::int, 0), 'sigla', public.sigla_de(p.id)) order by ap.posicao)
      from public.arena_posicoes ap join public.personagens p on p.id = ap.personagem_id where ap.arena = ver and ap.posicao <= 5), '[]'::jsonb),
    -- Os 5 logo acima (desafiáveis) e você.
    'alvos', case when pos is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('posicao', ap.posicao, 'id', p.id, 'nome', p.nome,
        'classe', p.dados ->> 'classe', 'raca', p.dados ->> 'raca', 'nivel', (p.dados ->> 'nivel')::int, 'poder', coalesce((p.dados ->> 'poder')::int, 0),
        'conta_minha', p.conta_id = auth.uid(), 'sigla', public.sigla_de(p.id)) order by ap.posicao)
      from public.arena_posicoes ap join public.personagens p on p.id = ap.personagem_id
      where ap.arena = ver and ap.posicao >= pos - (cfg ->> 'alcanceDesafio')::int and ap.posicao <= pos), '[]'::jsonb) end,
    'historico', coalesce((select jsonb_agg(h order by (h ->> 'id')::bigint desc) from (
        select jsonb_build_object('id', l.id, 'ataquei', l.atacante = meu, 'oponente', case when l.atacante = meu then l.nome_defensor else l.nome_atacante end,
          'venceu_atacante', l.situacao = 'vitoria', 'saque', l.saque, 'revanche', l.revanche_de is not null, 'quando', l.concluido_em,
          'pode_revanche', l.defensor = meu and l.situacao = 'vitoria' and l.revanche_de is null and not l.revanche_usada and l.atacante is not null) as h
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
  if pa >= pm or pm - pa > (public.tanka_dados() -> 'ARENA' ->> 'alcanceDesafio')::int then
    raise exception 'Só dá para desafiar os 5 logo acima de você.';
  end if;
  if (select conta_id from public.personagens where id = alvo) = auth.uid() then raise exception 'Esse personagem é seu.'; end if;
  return public.arena_comecar(meu, alvo, null);
end $$;

create or replace function public.arena_revanche(meu text, luta bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare L public.arena_lutas;
begin
  perform public.conferir_dono(meu);
  select * into L from public.arena_lutas where id = luta for update;
  if L.id is null or L.defensor is distinct from meu or L.situacao <> 'vitoria' or L.revanche_de is not null or L.atacante is null then
    raise exception 'Revanche indisponível.';
  end if;
  if L.revanche_usada then raise exception 'Você já fez a revanche dessa luta.'; end if;
  update public.arena_lutas set revanche_usada = true where id = luta;
  return public.arena_comecar(meu, L.atacante, luta);
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
  return jsonb_build_object('id', p.id, 'nome', p.nome, 'raca', p.dados ->> 'raca', 'classe', p.dados ->> 'classe', 'sexo', p.dados ->> 'sexo',
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
  public.arena_rolar(text, bigint, boolean), public.credito_aplicar(text, bigint), public.arena_admin_recarregar(text), public.arena_perfil(text, text) from public, anon;
grant execute on function public.arena_estado(text, text), public.arena_desafiar(text, text), public.arena_revanche(text, bigint),
  public.arena_rolar(text, bigint, boolean), public.credito_aplicar(text, bigint), public.arena_admin_recarregar(text), public.arena_perfil(text, text) to authenticated;
revoke execute on function public.tanka_status(jsonb), public.arena_de_nivel(int), public.arena_compactar(text), public.arena_garantir(text),
  public.arena_entradas_atual(text), public.arena_gastar_entrada(text), public.creditar(text, int, int, text), public.ouro_real(text),
  public.arena_jackpot_atualizar(text), public.arena_lutador(text), public.arena_golpe(jsonb, jsonb, int), public.arena_finalizar(bigint, boolean),
  public.arena_avancar(bigint), public.arena_jogar(bigint, boolean), public.arena_encerrar_abandonadas(text), public.arena_luta_json(bigint),
  public.arena_comecar(text, text, bigint) from public, anon, authenticated;

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
  if m.personagem_id is null then raise exception 'Você não está em uma aliança.'; end if;
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
  order by (m.cargo = 'oficial') desc, m.entrou_em limit 1;
  if novo is null then return; end if;
  update public.alianca_membros set cargo = 'membro' where personagem_id = lider_id;
  update public.alianca_membros set cargo = 'lider' where personagem_id = novo;
end $$;

-- Coloca o personagem na aliança (confere vagas, espera de 24 h e se já está em outra).
create or replace function public.alianca_entrar(pid text, aid bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.aliancas; ate timestamptz;
begin
  if exists (select 1 from public.alianca_membros where personagem_id = pid) then raise exception 'Esse personagem já está em uma aliança.'; end if;
  select e.ate into ate from public.alianca_espera e where personagem_id = pid;
  if ate is not null and ate > now() then
    raise exception 'Só dá para entrar em outra aliança depois de %.', to_char(ate at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI');
  end if;
  select * into a from public.aliancas where id = aid for update;
  if a.id is null then raise exception 'Aliança não encontrada.'; end if;
  if (select count(*) from public.alianca_membros where alianca_id = aid) >= public.alianca_vagas(a.nivel) then
    raise exception 'A aliança está cheia.';
  end if;
  insert into public.alianca_membros (personagem_id, alianca_id) values (pid, aid);
  delete from public.alianca_convites where personagem_id = pid;
end $$;

create or replace function public.alianca_registrar_saida(pid text) returns void
language sql security definer set search_path = public as $$
  insert into public.alianca_espera (personagem_id, ate) values (pid, now() + make_interval(hours => (public.alianca_cfg() ->> 'esperaHoras')::int))
  on conflict (personagem_id) do update set ate = excluded.ate;
$$;

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
  return jsonb_build_object(
    'alianca', public.alianca_resumo(a) || jsonb_build_object('exp', a.exp, 'tesouro', a.tesouro, 'mural', a.mural,
      'exp_proximo', case when a.nivel >= (public.alianca_cfg() ->> 'nivelMax')::int then null else (public.alianca_cfg() -> 'expProximo' ->> (a.nivel - 1))::bigint end,
      'bonus_pct', pct, 'bonus_exp_ate', case when a.bonus_exp_ate > now() then a.bonus_exp_ate end,
      'bonus_ouro_ate', case when a.bonus_ouro_ate > now() then a.bonus_ouro_ate end),
    'meu_cargo', m.cargo,
    'membros', (select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'cargo', x.cargo, 'classe', p.dados ->> 'classe',
        'nivel', coalesce((p.dados ->> 'nivel')::int, 1), 'poder', coalesce((p.dados ->> 'poder')::bigint, 0),
        'contribuicao', x.contribuicao, 'visto_em', p.atualizado_em)
        order by case x.cargo when 'lider' then 0 when 'oficial' then 1 else 2 end, x.contribuicao desc, p.nome)
      from public.alianca_membros x join public.personagens p on p.id = x.personagem_id where x.alianca_id = a.id),
    'pedidos', case when m.cargo in ('lider', 'oficial') then coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', p.nome,
        'classe', p.dados ->> 'classe', 'nivel', coalesce((p.dados ->> 'nivel')::int, 1), 'poder', coalesce((p.dados ->> 'poder')::bigint, 0)) order by c.id)
      from public.alianca_convites c join public.personagens p on p.id = c.personagem_id where c.alianca_id = a.id and c.tipo = 'pedido'), '[]'::jsonb) else '[]'::jsonb end);
end $$;

create or replace function public.alianca_criar(meu text, nome text, sigla text, brasao jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.alianca_cfg(); d jsonb; aid bigint;
begin
  perform public.conferir_dono(meu);
  select dados into d from public.personagens where id = meu;
  if coalesce((d ->> 'nivel')::int, 1) < (cfg ->> 'nivelMin')::int then raise exception 'Precisa ser level % para criar uma aliança.', cfg ->> 'nivelMin'; end if;
  nome := public.alianca_texto_valido(nome, 3, 20, 'O nome');
  sigla := upper(btrim(coalesce(sigla, '')));
  if sigla !~ '^[A-Z0-9]{3,4}$' then raise exception 'A sigla deve ter 3 ou 4 letras ou números, sem espaço.'; end if;
  if exists (select 1 from public.aliancas where lower(aliancas.nome) = lower(alianca_criar.nome)) then raise exception 'Já existe uma aliança com esse nome.'; end if;
  if exists (select 1 from public.aliancas where upper(aliancas.sigla) = alianca_criar.sigla) then raise exception 'Essa sigla já está em uso.'; end if;
  if public.ouro_real(meu) < (cfg ->> 'custoOuro')::int then raise exception 'Ouro insuficiente (precisa de %).', cfg ->> 'custoOuro'; end if;
  if public.reputacao_real(meu) < (cfg ->> 'custoReputacao')::int then raise exception 'Reputação insuficiente (precisa de %).', cfg ->> 'custoReputacao'; end if;
  if exists (select 1 from public.alianca_membros where personagem_id = meu) then raise exception 'Você já está em uma aliança.'; end if;
  insert into public.aliancas (nome, sigla, brasao) values (nome, sigla, coalesce(brasao, '{}'::jsonb)) returning id into aid;
  delete from public.alianca_espera where personagem_id = meu;
  perform public.alianca_entrar(meu, aid);
  update public.alianca_membros set cargo = 'lider' where personagem_id = meu;
  perform public.creditar(meu, -(cfg ->> 'custoOuro')::int, -(cfg ->> 'custoReputacao')::int, 'Fundação da aliança ' || nome);
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
  if exists (select 1 from public.alianca_membros where personagem_id = alvo.id) then raise exception '% já está em uma aliança.', alvo.nome; end if;
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
  if exists (select 1 from public.alianca_membros where personagem_id = meu) then raise exception 'Você já está em uma aliança.'; end if;
  if not exists (select 1 from public.aliancas where id = aid) then raise exception 'Aliança não encontrada.'; end if;
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
  if m.cargo = 'lider' then raise exception 'Passe a liderança antes de sair (ou desfaça a aliança).'; end if;
  delete from public.alianca_membros where personagem_id = meu;
  perform public.alianca_registrar_saida(meu);
end $$;

create or replace function public.alianca_expulsar(meu text, alvo text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu); x public.alianca_membros;
begin
  perform public.conferir_dono(meu);
  select * into x from public.alianca_membros where personagem_id = alvo and alianca_id = m.alianca_id;
  if x.personagem_id is null then raise exception 'Esse personagem não é da sua aliança.'; end if;
  if m.cargo = 'membro' or x.cargo = 'lider' or (m.cargo = 'oficial' and x.cargo <> 'membro') then
    raise exception 'Você não pode expulsar esse membro.';
  end if;
  delete from public.alianca_membros where personagem_id = alvo;
  perform public.alianca_registrar_saida(alvo);
end $$;

-- Líder: cargo 'oficial' ou 'membro' para outro, ou 'lider' para passar a liderança.
create or replace function public.alianca_cargo(meu text, alvo text, cargo text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu); x public.alianca_membros;
begin
  perform public.conferir_dono(meu);
  if m.cargo <> 'lider' then raise exception 'Só o líder muda cargos.'; end if;
  select * into x from public.alianca_membros where personagem_id = alvo and alianca_id = m.alianca_id;
  if x.personagem_id is null or alvo = meu then raise exception 'Membro inválido.'; end if;
  if cargo = 'oficial' then
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
  if m.cargo <> 'lider' then raise exception 'Só o líder desfaz a aliança.'; end if;
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
  if m.cargo <> 'lider' then raise exception 'Só o líder muda o brasão.'; end if;
  update public.aliancas set brasao = coalesce(alianca_brasao.brasao, '{}'::jsonb) where id = m.alianca_id;
end $$;

-- Doação ao tesouro: vira contribuição do membro e exp da aliança (pode subir de level).
create or replace function public.alianca_doar(meu text, valor int) returns void
language plpgsql security definer set search_path = public as $$
declare m public.alianca_membros := public.alianca_minha(meu); cfg jsonb := public.alianca_cfg(); a public.aliancas; prox bigint;
begin
  perform public.conferir_dono(meu);
  if valor < (cfg ->> 'doacaoMinima')::int then raise exception 'Doação mínima: % de ouro.', cfg ->> 'doacaoMinima'; end if;
  if public.ouro_real(meu) < valor then raise exception 'Ouro insuficiente.'; end if;
  perform public.creditar(meu, -valor, 0, 'Doação ao tesouro da aliança');
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
    if novo.id is null then raise exception 'Esse personagem não é dessa aliança.'; end if;
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

notify pgrst, 'reload schema';
