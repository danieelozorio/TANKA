-- Testes do banco (supabase/schema.sql) num PostgreSQL comum. Rodar com: sh testes/banco.test.sh
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Três jogadores (contas) com um personagem cada, mais um quarto que não é amigo.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"usuario":"ana","email":"a@t.com"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"usuario":"bia","email":"b@t.com"}'),
  ('00000000-0000-0000-0000-00000000000c', '{"usuario":"caio","email":"c@t.com"}'),
  ('00000000-0000-0000-0000-00000000000d', '{"usuario":"duda","email":"d@t.com"}');
insert into public.personagens (id, conta_id, nome, dados) values
  ('pa', '00000000-0000-0000-0000-00000000000a', 'Aldric', '{"nome":"Aldric","nivel":12,"classe":"cavaleiro","atributos":{"sor":10}}'),
  ('pb', '00000000-0000-0000-0000-00000000000b', 'Bruna', '{"nome":"Bruna","nivel":11,"classe":"arqueiro","atributos":{"sor":20}}'),
  ('pc', '00000000-0000-0000-0000-00000000000c', 'Caio', '{"nome":"Caio","nivel":4,"classe":"mago","atributos":{"sor":10}}'),
  ('pd', '00000000-0000-0000-0000-00000000000d', 'Duda', '{"nome":"Duda","nivel":20,"classe":"artesao","atributos":{"sor":10}}');
insert into public.amizades (de, para, status) values ('pa', 'pb', 'aceita'), ('pc', 'pa', 'aceita');

create function pg_temp.como(conta text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || conta, false);
$$;
create function pg_temp.falha(sql text, esperado text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FALHA: deveria dar erro "%": %', esperado, sql;
exception when others then
  if position(esperado in sqlerrm) = 0 then raise exception 'FALHA: erro "%" em vez de "%"', sqlerrm, esperado; end if;
end $$;
create function pg_temp.igual(a anyelement, b anyelement, oque text) returns void language plpgsql as $$
begin
  if a is distinct from b then raise exception 'FALHA %: % <> %', oque, a, b; end if;
  raise notice 'ok   %', oque;
end $$;
grant execute on all functions in schema pg_temp to authenticated;
set client_min_messages = notice;
set role authenticated;

-- Convites
select pg_temp.como('a');
select pg_temp.falha($$select public.grupo_convidar('pa', 'pd')$$, 'Só dá para convidar amigos');
select pg_temp.falha($$select public.grupo_convidar('pb', 'pa')$$, 'Personagem inválido');
select public.grupo_convidar('pa', 'pb');
select public.grupo_convidar('pa', 'pc');
select pg_temp.falha($$select public.grupo_convidar('pa', 'pb')$$, 'Convite já enviado');
select pg_temp.igual((public.grupo_estado('pa') -> 'grupo' ->> 'lider'), 'pa', 'quem convida vira líder');
select pg_temp.como('b');
select pg_temp.igual(jsonb_array_length(public.grupo_estado('pb') -> 'convites'), 1, 'convite chega para a Bruna');
select public.grupo_responder('pb', (public.grupo_estado('pb') -> 'convites' -> 0 ->> 'id')::bigint, true);
select pg_temp.como('c');
select public.grupo_responder('pc', (public.grupo_estado('pc') -> 'convites' -> 0 ->> 'id')::bigint, true);
select pg_temp.igual(jsonb_array_length(public.grupo_estado('pc') -> 'grupo' -> 'membros'), 3, 'grupo com 3');

-- Começar: escolher masmorra, prontos, level e entradas
select pg_temp.falha($$select public.grupo_escolher('pc', 'ninho')$$, 'Só o líder');
select pg_temp.como('a');
select pg_temp.falha($$select public.masmorra_iniciar('pa')$$, 'Escolha a masmorra');
select public.grupo_escolher('pa', 'ninho');
select pg_temp.falha($$select public.masmorra_iniciar('pa')$$, 'Todos precisam estar prontos');
select public.grupo_pronto('pa', true);
select pg_temp.como('b'); select public.grupo_pronto('pb', true);
select pg_temp.como('c'); select public.grupo_pronto('pc', true);
select pg_temp.como('a');
select pg_temp.falha($$select public.masmorra_iniciar('pa')$$, 'Level mínimo 10 (abaixo: Caio)');
reset role;
update public.personagens set dados = jsonb_set(dados, '{nivel}', '10') where id = 'pc';
set role authenticated;
select pg_temp.como('a');
select pg_temp.igual((public.masmorra_iniciar('pa') ->> 'estado'), 'andamento', 'masmorra começa');
select pg_temp.falha($$select public.masmorra_iniciar('pa')$$, 'Todos precisam estar prontos');
select pg_temp.como('b');
select pg_temp.igual((public.grupo_estado('pb') -> 'run' ->> 'masmorra'), 'ninho', 'Bruna vê a luta começar');
select pg_temp.igual(jsonb_array_length(public.grupo_estado('pb') -> 'run' -> 'herois'), 3, 'luta com os 3 heróis');
select pg_temp.falha($$select public.masmorra_concluir('pb', (public.grupo_estado('pb') -> 'run' ->> 'id')::bigint, true)$$, 'Só o líder');

-- Derrota não gasta entrada
select pg_temp.como('a');
select public.masmorra_concluir('pa', (public.grupo_estado('pa') -> 'run' ->> 'id')::bigint, false);
select pg_temp.igual((public.grupo_estado('pa') ->> 'entradas')::int, 0, 'derrota não gasta entrada');
select pg_temp.igual(jsonb_array_length(public.grupo_estado('pa') -> 'recompensas'), 0, 'derrota não dá recompensa');

-- Vitória: todos ganham 1 joia e gastam 1 entrada
select public.grupo_pronto('pa', true);
select pg_temp.como('b'); select public.grupo_pronto('pb', true);
select pg_temp.como('c'); select public.grupo_pronto('pc', true);
select pg_temp.como('a');
select public.masmorra_iniciar('pa');
select public.masmorra_concluir('pa', (public.grupo_estado('pa') -> 'run' ->> 'id')::bigint, true);
select pg_temp.falha($$select public.masmorra_concluir('pa', (public.grupo_estado('pa') -> 'run' ->> 'id')::bigint, true)$$, 'já terminou');
select pg_temp.igual((public.grupo_estado('pa') ->> 'entradas')::int, 1, 'vitória gasta 1 entrada');
select pg_temp.como('c');
select pg_temp.igual((public.grupo_estado('pc') ->> 'entradas')::int, 1, 'entrada gasta também para o Caio');
select pg_temp.igual((public.grupo_estado('pc') -> 'recompensas' -> 0 -> 'item' ->> 'tipo') in ('colar', 'anel'), true, 'Caio ganhou colar ou anel');
select pg_temp.igual((public.recompensa_resgatar('pc', (public.grupo_estado('pc') -> 'recompensas' -> 0 ->> 'id')::bigint) ->> 'raridade') in ('comum', 'rara', 'epica'), true, 'resgata joia do Ninho');
select pg_temp.igual(jsonb_array_length(public.grupo_estado('pc') -> 'recompensas'), 0, 'resgatada sai da lista');
select pg_temp.como('b');
select pg_temp.falha($$select public.recompensa_resgatar('pb', (select id from public.recompensas where personagem_id = 'pc' limit 1))$$, 'não encontrada');

-- Segunda vitória esgota as entradas
select pg_temp.como('a'); select public.grupo_pronto('pa', true);
select pg_temp.como('b'); select public.grupo_pronto('pb', true);
select pg_temp.como('c'); select public.grupo_pronto('pc', true);
select pg_temp.como('a');
select public.masmorra_iniciar('pa');
select public.masmorra_concluir('pa', (public.grupo_estado('pa') -> 'run' ->> 'id')::bigint, true);
select public.grupo_pronto('pa', true);
select pg_temp.como('b'); select public.grupo_pronto('pb', true);
select pg_temp.como('c'); select public.grupo_pronto('pc', true);
select pg_temp.como('a');
select pg_temp.falha($$select public.masmorra_iniciar('pa')$$, 'Sem entradas hoje');
select pg_temp.falha($$select public.masmorra_admin_recarregar('pa')$$, 'Só administradores');

-- Sair, expulsar e líder novo
select pg_temp.falha($$select public.grupo_expulsar('pa', 'pd')$$, 'não está no seu grupo');
select public.grupo_expulsar('pa', 'pc');
select pg_temp.igual(jsonb_array_length(public.grupo_estado('pa') -> 'grupo' -> 'membros'), 2, 'expulsou o Caio');
select public.grupo_sair('pa');
select pg_temp.como('b');
select pg_temp.igual((public.grupo_estado('pb') -> 'grupo' ->> 'lider'), 'pb', 'Bruna vira líder quando o Aldric sai');
select public.grupo_sair('pb');
select pg_temp.igual(public.grupo_estado('pb') -> 'grupo', 'null'::jsonb, 'grupo vazio some');
reset role;
select pg_temp.igual((select count(*) from public.grupos)::int, 0, 'nenhum grupo sobrando');

-- Acesso direto às tabelas é bloqueado
set role authenticated;
select pg_temp.como('a');
select pg_temp.igual((select count(*) from public.recompensas)::int, 0, 'tabela de recompensas fechada para leitura direta');
reset role;

-- ---------- Alianças ----------
-- Aldric (lv 12) cria; Bruna entra por convite; Duda pede e é aceito; Caio (lv 4) não pode criar.
update public.personagens set dados = dados || '{"ouro": 50000, "reputacao": 1000}' where id in ('pa', 'pd');
update public.personagens set dados = dados || '{"ouro": 500, "reputacao": 0}' where id = 'pb';
update public.personagens set dados = dados || '{"nivel": 4}' where id = 'pc';
set role authenticated;
select pg_temp.como('c');
select pg_temp.falha($$select public.alianca_criar('pc', 'Lobos', 'LOB', '{}')$$, 'Precisa ser level 10');
select pg_temp.como('b');
select pg_temp.falha($$select public.alianca_criar('pb', 'Lobos', 'LOB', '{}')$$, 'Ouro insuficiente');
select pg_temp.como('a');
select pg_temp.falha($$select public.alianca_criar('pa', 'Lobos', 'L O', '{}')$$, 'A sigla deve ter');
select pg_temp.falha($$select public.alianca_criar('pa', 'X', 'LOB', '{}')$$, 'O nome deve ter de 3 a 20');
select public.alianca_criar('pa', 'Lobos da Neve', 'lob', '{"forma":"classico","cor":"#1f4f8e","simbolo":"lobo"}');
select pg_temp.igual(public.alianca_estado('pa', null) -> 'alianca' ->> 'sigla', 'LOB', 'aliança criada com a sigla em maiúsculas');
select pg_temp.igual(public.alianca_estado('pa', null) ->> 'meu_cargo', 'lider', 'quem cria vira líder');
reset role;
select pg_temp.igual(public.ouro_real('pa'), 40000, 'criar cobra 10.000 de ouro');
select pg_temp.igual(public.reputacao_real('pa'), 700, 'criar cobra 300 de reputação');
set role authenticated;
select pg_temp.como('d');
select pg_temp.falha($$select public.alianca_criar('pd', 'lobos da neve', 'XYZ', '{}')$$, 'Já existe uma aliança com esse nome');
select pg_temp.falha($$select public.alianca_criar('pd', 'Outra', 'LOB', '{}')$$, 'Essa sigla já está em uso');
select public.alianca_pedir('pd', (public.alianca_estado('pd', 'neve') -> 'lista' -> 0 ->> 'id')::bigint);
select pg_temp.como('a');
select public.alianca_convidar('pa', 'Bruna');
select pg_temp.igual(jsonb_array_length(public.alianca_estado('pa', null) -> 'pedidos'), 1, 'líder vê o pedido do Duda');
select public.alianca_decidir('pa', (public.alianca_estado('pa', null) -> 'pedidos' -> 0 ->> 'id')::bigint, true);
select pg_temp.como('b');
select public.alianca_responder('pb', (public.alianca_estado('pb', null) -> 'convites' -> 0 ->> 'convite')::bigint, true);
select pg_temp.igual((public.alianca_estado('pb', null) -> 'alianca' ->> 'membros')::int, 3, 'aliança com 3 membros');
select pg_temp.falha($$select public.alianca_convidar('pb', 'Caio')$$, 'Só o líder e os oficiais convidam');
select pg_temp.falha($$select public.alianca_expulsar('pb', 'pd')$$, 'Você não pode expulsar');
-- Cargos, doação, level e bônus
select pg_temp.como('a');
select public.alianca_cargo('pa', 'pb', 'oficial');
select pg_temp.como('b');
select public.alianca_mural('pb', 'Caçada às 20h!');
select pg_temp.como('d');
select pg_temp.falha($$select public.alianca_doar('pd', 50)$$, 'Doação mínima');
select public.alianca_doar('pd', 30000);
select pg_temp.como('a');
select public.alianca_doar('pa', 25000);
select pg_temp.igual((public.alianca_estado('pa', null) -> 'alianca' ->> 'nivel')::int, 2, '55.000 de exp sobe a aliança para o level 2');
select pg_temp.igual((public.alianca_estado('pa', null) -> 'alianca' ->> 'vagas')::int, 18, 'level 2 tem 18 vagas');
select pg_temp.igual((public.alianca_estado('pa', null) -> 'alianca' ->> 'bonus_pct')::int, 6, 'bônus de 6% no level 2');
select public.alianca_bonus('pa', 'exp');
select pg_temp.igual((public.alianca_estado('pa', null) -> 'alianca' ->> 'tesouro')::int, 35000, 'bônus gasta 20.000 do tesouro');
select pg_temp.igual(public.alianca_estado('pa', null) -> 'alianca' ->> 'bonus_exp_ate' is not null, true, 'bônus de exp ativo');
select pg_temp.como('b');
select pg_temp.falha($$select public.alianca_bonus('pb', 'ouro')$$, 'Só o líder ativa os bônus');
select pg_temp.igual(public.alianca_estado('pb', null) -> 'alianca' ->> 'mural', 'Caçada às 20h!', 'mural escrito pela oficial');
-- Chat da aliança e sigla no chat global e no ranking
select public.alianca_chat_enviar('pb', 'Bora!');
select pg_temp.igual(public.alianca_chat('pb', 0) -> 0 ->> 'texto', 'Bora!', 'chat da aliança');
select pg_temp.igual((select sigla from public.ranking('nivel') where nome = 'Bruna'), 'LOB', 'sigla aparece no ranking');
-- Sair, expulsar, espera de 24 h, passar liderança e desfazer
select pg_temp.como('a');
select pg_temp.falha($$select public.alianca_sair('pa')$$, 'Passe a liderança');
select public.alianca_expulsar('pa', 'pd');
select pg_temp.como('d');
select pg_temp.falha($$select public.alianca_criar('pd', 'Outra', 'OUT', '{}')$$, 'Só dá para entrar em outra aliança depois');
select pg_temp.como('a');
select public.alianca_cargo('pa', 'pb', 'lider');
select pg_temp.igual(public.alianca_estado('pa', null) ->> 'meu_cargo', 'oficial', 'antigo líder vira oficial');
select public.alianca_sair('pa');
select pg_temp.como('b');
select public.alianca_desfazer('pb');
select pg_temp.igual(public.alianca_estado('pb', null) -> 'alianca', 'null'::jsonb, 'aliança desfeita');
select pg_temp.igual((select count(*) from public.aliancas)::int, 0, 'tabela de alianças fechada para leitura direta');
reset role;
select pg_temp.igual((select count(*) from public.aliancas)::int, 0, 'aliança apagada de verdade');
\echo TODOS OS TESTES DO BANCO PASSARAM
