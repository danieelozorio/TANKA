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

notify pgrst, 'reload schema';

