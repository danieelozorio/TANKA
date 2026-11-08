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
select pg_temp.igual(jsonb_array_length(public.grupo_estado('pc') -> 'recompensas') between 1 and 2, true, 'joia + talvez 1 pergaminho');
select pg_temp.igual((select count(*) from jsonb_array_elements(public.grupo_estado('pc') -> 'recompensas') with ordinality as x(r, i)
  where i > 1 and not (r -> 'item' ->> 'tipo' = 'pergaminho' and r -> 'item' ->> 'raridade' in ('comum', 'rara', 'epica', 'lendaria')))::int, 0, 'segunda recompensa é pergaminho');
select pg_temp.igual((public.recompensa_resgatar('pc', (public.grupo_estado('pc') -> 'recompensas' -> 0 ->> 'id')::bigint) ->> 'raridade') in ('comum', 'rara', 'epica'), true, 'resgata joia do Ninho');
select public.recompensa_resgatar('pc', (r ->> 'id')::bigint) from jsonb_array_elements(public.grupo_estado('pc') -> 'recompensas') r;
select pg_temp.igual(jsonb_array_length(public.grupo_estado('pc') -> 'recompensas'), 0, 'resgatadas saem da lista');
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

-- Pergaminho da masmorra: cerca de 50% das vitórias, qualidade 70/22/7/1
select pg_temp.igual((select count(*) from generate_series(1, 20000) where public.sortear_raridade_drop() = 'lendaria') between 120 and 290, true, 'lendária ~1%');
select pg_temp.igual((select count(*) from generate_series(1, 20000) where public.sortear_raridade_drop() = 'epica') between 1200 and 1600, true, 'épica ~7%');
select pg_temp.igual((select count(*) from generate_series(1, 20000) where public.sortear_raridade_drop() = 'rara') between 4100 and 4700, true, 'rara ~22%');
select pg_temp.igual((select count(*) from generate_series(1, 20000) where public.sortear_raridade_drop() = 'comum') between 13700 and 14300, true, 'comum ~70%');
select pg_temp.igual((select count(*) from public.recompensas where item ->> 'tipo' in ('colar', 'anel'))::int, 6, '2 vitórias x 3 heróis = 6 joias');
select pg_temp.igual((select count(*) from public.recompensas where item ->> 'tipo' = 'pergaminho')::int between 0 and 6, true, 'pergaminhos: 0 a 6');

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
select pg_temp.falha($$select public.alianca_criar('pd', 'lobos da neve', 'XYZ', '{}')$$, 'Já existe um clã com esse nome');
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
select public.alianca_doar('pd', 3000);
select pg_temp.falha($$select public.alianca_doar('pd', 100)$$, 'Limite de doação: 3000 de ouro por dia');
select pg_temp.igual((public.alianca_estado('pd', null) ->> 'doado_hoje')::int, 3000, 'clã: doação de hoje (limite 3.000 por dia)');
select pg_temp.como('a');
select public.alianca_doar('pa', 2000);
reset role;
update public.aliancas set exp = exp + 50000, tesouro = tesouro + 50000;   -- como se outros dias de doação
set role authenticated; select pg_temp.como('a');
select public.alianca_doar('pa', 1000);
select pg_temp.igual((public.alianca_estado('pa', null) -> 'alianca' ->> 'nivel')::int, 2, '56.000 de exp sobe o clã para o level 2');
select pg_temp.igual((public.alianca_estado('pa', null) -> 'alianca' ->> 'vagas')::int, 18, 'level 2 tem 18 vagas');
select pg_temp.igual((public.alianca_estado('pa', null) -> 'alianca' ->> 'bonus_pct')::int, 6, 'bônus de 6% no level 2');
select public.alianca_bonus('pa', 'exp');
select pg_temp.igual((public.alianca_estado('pa', null) -> 'alianca' ->> 'tesouro')::int, 36000, 'bônus gasta 20.000 do tesouro');
-- Vice-líder: 1 por clã; promove/rebaixa oficiais, compra skills; não mexe no líder
select public.alianca_cargo('pa', 'pb', 'vice');
select pg_temp.igual((select cargo from public.alianca_membros where personagem_id = 'pb'), null::text, 'tabela de membros fechada para leitura');
select pg_temp.como('b');
select pg_temp.igual(public.alianca_estado('pb', null) ->> 'meu_cargo', 'vice', 'vice-líder nomeado pelo líder');
select pg_temp.falha($$select public.alianca_cargo('pb', 'pa', 'membro')$$, 'O vice-líder só promove e rebaixa oficiais');
select pg_temp.falha($$select public.alianca_expulsar('pb', 'pa')$$, 'Você não pode expulsar');
select pg_temp.como('a');
-- Skills do clã: só o líder, com o tesouro, nível <= nível do clã
select pg_temp.falha($$select public.alianca_skill_comprar('pa', 'voar')$$, 'Skill inválida');
select public.alianca_skill_comprar('pa', 'dano');
select pg_temp.igual((public.alianca_estado('pa', null) -> 'alianca' ->> 'tesouro')::int, 11000, 'skill nível 1 custa 25.000 do tesouro');
select pg_temp.falha($$select public.alianca_skill_comprar('pa', 'dano')$$, 'O tesouro não tem ouro suficiente');
reset role; update public.aliancas set tesouro = tesouro + 100000; set role authenticated; select pg_temp.como('a');
select public.alianca_skill_comprar('pa', 'dano');
select pg_temp.igual((public.alianca_estado('pa', null) -> 'skills' ->> 'dano')::int, 2, 'clã nível 2 libera a skill nível 2');
select pg_temp.falha($$select public.alianca_skill_comprar('pa', 'dano')$$, 'Suba o clã para o nível 3');
-- Missões do clã: progresso somado; cumpriu = ouro no tesouro (x1,2 no nível 2)
select public.alianca_missao_registrar('pa', 'monstros', 300), public.alianca_missao_registrar('pa', 'monstros', 300),
  public.alianca_missao_registrar('pa', 'monstros', 300), public.alianca_missao_registrar('pa', 'monstros', 999);
select pg_temp.igual((public.alianca_estado('pa', null) -> 'missoes' -> 'diarias' -> 'monstros' ->> 'progresso')::int, 1200, 'missão: no máximo 300 monstros por envio');
select pg_temp.igual((public.alianca_estado('pa', null) -> 'missoes' -> 'diarias' -> 'monstros' ->> 'concluida')::boolean, true, 'missão diária cumprida');
select pg_temp.igual((public.alianca_estado('pa', null) -> 'alianca' ->> 'tesouro')::int, 11000 + 100000 - 40000 + 3600, 'missão diária: 3.000 x 1,2 no tesouro');
select pg_temp.falha($$select public.alianca_missao_registrar('pa', 'trapaca', 1)$$, 'Missão inválida');
reset role;
update public.alianca_missoes set progresso = 15000, concluida = true where periodo = 'semana' and tipo = 'monstros';
set role authenticated; select pg_temp.como('a');
select pg_temp.igual((public.alianca_estado('pa', null) ->> 'buff_boss')::numeric, 2.5, 'missão semanal: +2,5% de dano contra o boss do clã');
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
select pg_temp.falha($$select public.alianca_criar('pd', 'Outra', 'OUT', '{}')$$, 'Só dá para entrar em outro clã depois');
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
-- Habilidades na Arena (funções internas, rodando como dono do banco)
create function pg_temp.heroi(classe text, nivel int, talentos jsonb) returns jsonb language sql as $$
  select jsonb_build_object('nome', 'X', 'nivel', nivel, 'classe', classe, 'inventario', '[]'::jsonb, 'equipados', '{}'::jsonb,
    'atributos', '{"for":15,"des":20,"res":10,"int":10,"sor":20}'::jsonb, 'atributosIniciais', '{"for":15,"des":20,"res":10,"int":10,"sor":20}'::jsonb,
    'talentos', talentos);
$$;
select pg_temp.igual(public.arena_kit(pg_temp.heroi('arqueiro', 5, null)) -> 0 ->> 'nome', 'Chuva de Flechas', 'arena: antes do 10, a habilidade inicial');
select pg_temp.igual((public.arena_kit(pg_temp.heroi('arqueiro', 5, null)) -> 0 ->> 'mult')::numeric, 150::numeric, 'arena: habilidade inicial em um alvo = 150%');
select pg_temp.igual((select string_agg(x ->> 'nome', ',') from jsonb_array_elements(public.arena_kit(pg_temp.heroi('arqueiro', 11,
  '{"classe2":"assassino","pontos":{"sombra":1,"golpe-fatal":2,"lamina-afiada":1},"ordem":{"arena":["golpe-fatal","sombra","mira-certeira"]}}'))) x),
  'Golpe Fatal,Sombra', 'arena: ordem da Arena, só com ponto');
select pg_temp.igual((public.arena_kit(pg_temp.heroi('arqueiro', 11, '{"classe2":"assassino","pontos":{"golpe-fatal":2},"ordem":{"arena":["golpe-fatal"]}}')) -> 0 ->> 'mult')::numeric,
  160::numeric, 'arena: Golpe Fatal com 2 pontos = 160%');
select pg_temp.igual(jsonb_array_length(public.arena_kit(pg_temp.heroi('arqueiro', 11, '{"classe2":"assassino","pontos":{"golpe-fatal":9},"ordem":{"arena":["golpe-fatal"]}}'))),
  0, 'arena: pontos acima do level não valem');
select pg_temp.igual((public.tanka_status(pg_temp.heroi('cavaleiro', 11, '{"classe2":"paladino","pontos":{"pele-de-ferro":1},"ordem":{}}')) ->> 'hpMax')::numeric,
  round((public.tanka_status(pg_temp.heroi('cavaleiro', 11, null)) ->> 'hpMax')::numeric * 1.11), 'arena: passiva Pele de Ferro +11% de vida');
select pg_temp.igual((select string_agg(x ->> 'nome', ',') from jsonb_array_elements(public.arena_kit(pg_temp.heroi('arqueiro', 11,
  '{"classe2":"assassino","pontos":{"sombra":1,"golpe-fatal":2},"ordem":{"arena":["golpe-fatal","sombra"],"defesa":["sombra"]}}'), 'defesa')) x),
  'Sombra', 'arena: ordem própria de defesa');
do $$
declare a jsonb; d jsonb; r jsonb; i int := 0;
begin
  a := jsonb_build_object('hp', 500, 'hpMax', 500, 'dano', '[20,20]'::jsonb, 'magico', false, 'defesa', 0, 'defesaMagica', 0, 'velBase', 20, 'vel', 20,
    'esquiva', 0, 'kit', public.arena_kit(pg_temp.heroi('arqueiro', 11, '{"classe2":"assassino","pontos":{"sombra":1,"golpe-fatal":2},"ordem":{"arena":["sombra","golpe-fatal"]}}')),
    'turno', 0, 'pronto', '{}'::jsonb, 'buffs', '[]'::jsonb, 'atordoado', 0, 'furtivo', false, 'critEm', -1);
  d := a || jsonb_build_object('kit', public.arena_kit(pg_temp.heroi('arqueiro', 11, '{"classe2":"cacador","pontos":{"flecha-na-perna":1},"ordem":{"arena":["flecha-na-perna"]}}')));
  r := public.arena_vez(a, d, 10); a := r -> 'eu'; d := r -> 'outro';
  if r -> 'ev' ->> 'hab' <> 'Sombra' then raise exception 'FALHA arena: 1ª vez devia usar Sombra: %', r -> 'ev'; end if;
  r := public.arena_vez(d, a, 10); d := r -> 'eu'; a := r -> 'outro';
  if not (r -> 'ev' ? 'sombra') or (r -> 'ev' ->> 'dano')::int <> 0 then raise exception 'FALHA arena: ataque devia errar na Sombra: %', r -> 'ev'; end if;
  r := public.arena_vez(a, d, 2); a := r -> 'eu'; d := r -> 'outro';
  if r -> 'ev' ->> 'hab' <> 'Golpe Fatal' or not (r -> 'ev' ? 'garantido') or (r -> 'ev' ->> 'dano')::int <> 64 then
    raise exception 'FALHA arena: Golpe Fatal com dado garantido devia dar 20 x 2 x 1,6 = 64: %', r -> 'ev'; end if;
  raise notice 'ok   arena: Sombra faz errar e o golpe seguinte vale o 20 do dado';
  -- Flecha na Perna atordoa: o outro perde a vez sem dado (a 1ª flecha foi gasta na Sombra)
  d := jsonb_set(d, '{pronto}', '{}');
  r := public.arena_vez(d, a, 10); d := r -> 'eu'; a := r -> 'outro';
  if (a ->> 'atordoado')::int <> 2 then raise exception 'FALHA arena: devia atordoar 2: %', r -> 'ev'; end if;
  r := public.arena_vez(a, d, null); a := r -> 'eu'; d := r -> 'outro';
  if not (r -> 'ev' ? 'atordoado') then raise exception 'FALHA arena: devia perder a vez: %', r -> 'ev'; end if;
  raise notice 'ok   arena: atordoado perde a vez';
  -- luta inteira sem erro
  while (a ->> 'hp')::int > 0 and (d ->> 'hp')::int > 0 and i < 400 loop
    r := public.arena_vez(a, d, case when (a ->> 'atordoado')::int > 0 then null else 1 + floor(random() * 20)::int end); a := r -> 'eu'; d := r -> 'outro';
    r := public.arena_vez(d, a, case when (d ->> 'atordoado')::int > 0 then null else 1 + floor(random() * 20)::int end); d := r -> 'eu'; a := r -> 'outro';
    i := i + 1;
  end loop;
  if i >= 400 then raise exception 'FALHA arena: a luta não acabou'; end if;
  raise notice 'ok   arena: luta com habilidades até o fim (% rodadas)', i;
end $$;
-- Double Shot (Arqueiro): 2 flechas com o mesmo dado, cada uma 100% + 3% por ponto
do $$
declare a jsonb; d jsonb; r jsonb;
begin
  a := jsonb_build_object('hp', 500, 'hpMax', 500, 'dano', '[20,20]'::jsonb, 'magico', false, 'defesa', 0, 'defesaMagica', 0, 'velBase', 20, 'vel', 20,
    'esquiva', 0, 'kit', public.arena_kit(pg_temp.heroi('arqueiro', 11, '{"classe2":"cacador","pontos":{"pes-ligeiros":2},"ordem":{"arena":["pes-ligeiros"]}}')),
    'turno', 0, 'pronto', '{}'::jsonb, 'buffs', '[]'::jsonb, 'atordoado', 0, 'furtivo', false, 'critEm', -1);
  if (a -> 'kit' -> 0 ->> 'nome') <> 'Double Shot' or (a -> 'kit' -> 0 ->> 'mult')::numeric <> 106 or (a -> 'kit' -> 0 ->> 'flechas')::int <> 2 then
    raise exception 'FALHA arena: kit do Double Shot: %', a -> 'kit'; end if;
  d := a || jsonb_build_object('kit', '[]'::jsonb);
  r := public.arena_vez(a, d, 10);
  -- dado 10 = x1,2; cada flecha: round(20 x 1,2 x 1,06) = 25; duas = 50
  if r -> 'ev' ->> 'hab' <> 'Double Shot' or (r -> 'ev' ->> 'flechas')::int <> 2 or (r -> 'ev' ->> 'dano')::int <> 50
     or (r -> 'outro' ->> 'hp')::int <> 450 then
    raise exception 'FALHA arena: Double Shot devia dar 2 x 25 = 50: %', r -> 'ev'; end if;
  -- ataque normal continua com 1 golpe
  r := public.arena_vez(r -> 'eu', r -> 'outro', 10);
  if r -> 'ev' ? 'flechas' or (r -> 'ev' ->> 'dano')::int <> 24 then raise exception 'FALHA arena: ataque normal devia ser 24: %', r -> 'ev'; end if;
  raise notice 'ok   arena: Double Shot = 2 flechas de 106%% com 2 pontos';
end $$;
-- Encanto em %: +5% do dano da arma por nível (igual ao jogo)
do $$
declare p jsonb; s0 jsonb; s10 jsonb; d0 int; d10 int;
begin
  p := pg_temp.heroi('cavaleiro', 30, null) || jsonb_build_object('equipados', '{"arma":"w"}'::jsonb);
  s0 := public.tanka_status(p || jsonb_build_object('inventario', '[{"id":"w","tipo":"arma","arma":"espada","classe":"cavaleiro","raridade":"lendaria","encanto":0,"nivel":40,"dano":[100,200]}]'::jsonb));
  s10 := public.tanka_status(p || jsonb_build_object('inventario', '[{"id":"w","tipo":"arma","arma":"espada","classe":"cavaleiro","raridade":"lendaria","encanto":10,"nivel":40,"dano":[100,200]}]'::jsonb));
  d0 := (s0 -> 'dano' ->> 1)::int; d10 := (s10 -> 'dano' ->> 1)::int;
  raise notice 'encanto: % x %', s0 -> 'dano', s10 -> 'dano';
  -- +10 = +50% de 200 = +100 antes dos bônus de PvP
  if d10 - d0 < 100 or d10 - d0 > 115 then
    raise exception 'FALHA servidor: lendária +10 devia somar ~+100 (+50%% de 200): % x %', s0 -> 'dano', s10 -> 'dano'; end if;
  raise notice 'ok   servidor: encanto em %% (+5%% do dano por nível)';
end $$;
-- Encanto na armadura: +5% do bônus principal por nível, mínimo +1
do $$
declare p jsonb; a jsonb; b jsonb;
begin
  p := pg_temp.heroi('cavaleiro', 30, null) || jsonb_build_object('equipados', '{"elmo":"e"}'::jsonb);
  a := public.tanka_status(p || jsonb_build_object('inventario', '[{"id":"e","tipo":"elmo","classe":"cavaleiro","raridade":"rara","encanto":0,"nivel":30,"bonus":{"defesa":100,"vida":10}}]'::jsonb));
  b := public.tanka_status(p || jsonb_build_object('inventario', '[{"id":"e","tipo":"elmo","classe":"cavaleiro","raridade":"rara","encanto":4,"nivel":30,"bonus":{"defesa":100,"vida":10}}]'::jsonb));
  raise notice 'armadura: % x %', a -> 'defesa', b -> 'defesa';
  -- +20 do encanto, x4,5 da defesa em porcentagem = +90 (igual a R.bonusItem)
  if (b ->> 'defesa')::numeric - (a ->> 'defesa')::numeric <> 90 then
    raise exception 'FALHA servidor: elmo +4 com 100 de defesa devia ter +90 (x4,5): % x %', a ->> 'defesa', b ->> 'defesa'; end if;
  raise notice 'ok   servidor: encanto da armadura em %%';
end $$;
-- Defesa em porcentagem na Arena: 100 de defesa = metade do dano; RES x3
do $$
declare a jsonb; d jsonb; r jsonb; p jsonb;
begin
  a := jsonb_build_object('hp', 500, 'hpMax', 500, 'dano', '[20,20]'::jsonb, 'magico', false, 'defesa', 0, 'defesaMagica', 0, 'velBase', 20, 'vel', 20,
    'esquiva', 0, 'kit', '[]'::jsonb, 'turno', 0, 'pronto', '{}'::jsonb, 'buffs', '[]'::jsonb, 'atordoado', 0, 'furtivo', false, 'critEm', -1);
  d := a || jsonb_build_object('defesa', 100);
  r := public.arena_vez(a, d, 6);   -- dado 6 = x1: 20 x 100 / 200 = 10
  if (r -> 'ev' ->> 'dano')::int <> 10 then raise exception 'FALHA arena: 100 de defesa devia cortar metade: %', r -> 'ev'; end if;
  d := a || jsonb_build_object('defesa', 100000);
  r := public.arena_vez(a, d, 6);
  if (r -> 'ev' ->> 'dano')::int <> 1 then raise exception 'FALHA arena: nunca imortal (mínimo 1): %', r -> 'ev'; end if;
  p := pg_temp.heroi('cavaleiro', 10, null);   -- RES 10 = 1 x 4,5 = 5 de defesa (arredondado, igual ao Math.round), sem itens
  if (public.tanka_status(p) ->> 'defesa')::int <> 5 then raise exception 'FALHA servidor: RES 10 = 5 de defesa: %', public.tanka_status(p) ->> 'defesa'; end if;
  raise notice 'ok   arena: defesa em porcentagem (100 = -50%%, mínimo 1) e RES x3';
end $$;
-- Arena: Top 5 ataca para baixo, ataque pelo Ranking, repetição na semana e revanche mesmo quando o defensor vence
reset role;
update public.personagens set dados = jsonb_set(dados, '{nivel}', '8') where id = 'pc';
update public.personagens set dados = jsonb_set(dados, '{ouro}', '100000') where id in ('pa', 'pb', 'pc', 'pd');
delete from public.creditos; delete from public.arena_lutas;
do $$
declare l jsonb; r jsonb; c record;
  function_ok boolean;
begin
  perform public.arena_garantir(x) from unnest(array['pa', 'pb', 'pc', 'pd']) x;
  update public.arena_posicoes set posicao = case personagem_id when 'pa' then 1 when 'pb' then 2 when 'pd' then 3 end where personagem_id in ('pa', 'pb', 'pd');
  if (select arena from public.arena_posicoes where personagem_id = 'pc') <> 'a1' or (select arena from public.arena_posicoes where personagem_id = 'pa') <> 'a2' then
    raise exception 'FALHA arena: preparação (pc na a1, pa na a2)'; end if;
  update public.arena_entradas set valor = 50 where personagem_id in ('pa', 'pb', 'pc', 'pd');
  insert into public.arena_entradas (personagem_id, valor) select x, 50 from unnest(array['pa', 'pb', 'pc', 'pd']) x on conflict (personagem_id) do update set valor = 50;

  -- 1º lugar ataca o 2º (para baixo): tipo top5, não muda posição, metade da reputação, ouro do saque
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  if not exists (select 1 from jsonb_array_elements(public.arena_estado('pa', null) -> 'alvos') x where x ->> 'id' = 'pd' and (x ->> 'abaixo')::boolean) then
    raise exception 'FALHA arena: o 1º devia ver o 3º como alvo abaixo'; end if;
  l := public.arena_desafiar('pa', 'pb');
  perform public.arena_finalizar((l ->> 'id')::bigint, true);
  select * into c from public.arena_lutas where id = (l ->> 'id')::bigint;
  if c.tipo <> 'top5' or c.reputacao <> 5 or c.saque <> floor(100000 * c.saque_pct / 100.0) or c.saque <= 0 then
    raise exception 'FALHA arena: top5 (tipo %, reputação %, saque % de %%%)', c.tipo, c.reputacao, c.saque, c.saque_pct; end if;
  if (select posicao from public.arena_posicoes where personagem_id = 'pa') <> 1 or (select posicao from public.arena_posicoes where personagem_id = 'pb') <> 2 then
    raise exception 'FALHA arena: ataque para baixo não muda posição'; end if;
  raise notice 'ok   arena: 1º ataca o 2º (para baixo): metade da reputação (5), saque de ouro, posição igual';

  -- mesma pessoa atacando de novo na semana: ouro x1/2, x1/4 e depois zero (reputação continua)
  for i in 2..4 loop
    l := public.arena_desafiar('pa', 'pb');
    perform public.arena_finalizar((l ->> 'id')::bigint, true);
    select * into c from public.arena_lutas where id = (l ->> 'id')::bigint;
    if c.saque <> floor(public.ouro_real('pb') * 0 + c.saque) then null; end if;
    if (i = 2 and c.saque <> floor((select public.ouro_real('pb') + c.saque) * c.saque_pct / 100.0 * 0.5))
       or (i = 3 and c.saque <> floor((select public.ouro_real('pb') + c.saque) * c.saque_pct / 100.0 * 0.25))
       or (i = 4 and c.saque <> 0) or c.reputacao <> 5 then
      raise exception 'FALHA arena: repetição % (saque %, %%% , reputação %)', i, c.saque, c.saque_pct, c.reputacao; end if;
  end loop;
  -- na semana seguinte volta ao ouro cheio
  update public.arena_lutas set criado_em = criado_em - interval '8 days' where atacante = 'pa' and defensor = 'pb';
  l := public.arena_desafiar('pa', 'pb'); perform public.arena_finalizar((l ->> 'id')::bigint, true);
  select * into c from public.arena_lutas where id = (l ->> 'id')::bigint;
  if c.saque <> floor((public.ouro_real('pb') + c.saque) * c.saque_pct / 100.0) then raise exception 'FALHA arena: semana nova devia ter ouro cheio'; end if;
  raise notice 'ok   arena: mesmo atacante na semana: ouro cheio, metade, um quarto, zero; zera na semana seguinte';

  -- Ranking: arena mais forte (a1 ataca a2) = tudo; arena mais fraca (a2 ataca a1) = nada; mesma arena acima = tudo, abaixo = metade
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
  l := public.arena_atacar('pc', 'pa'); perform public.arena_finalizar((l ->> 'id')::bigint, true);
  select * into c from public.arena_lutas where id = (l ->> 'id')::bigint;
  if c.tipo <> 'livre' or c.reputacao <> 10 or c.saque <= 0 then raise exception 'FALHA arena: a1 atacando a2 devia ganhar tudo (%, %)', c.reputacao, c.saque; end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  l := public.arena_atacar('pa', 'pc'); perform public.arena_finalizar((l ->> 'id')::bigint, true);
  select * into c from public.arena_lutas where id = (l ->> 'id')::bigint;
  if c.reputacao <> 0 or c.saque <> 0 then raise exception 'FALHA arena: a2 atacando a1 não ganha nada (%, %)', c.reputacao, c.saque; end if;
  l := public.arena_atacar('pa', 'pd'); perform public.arena_finalizar((l ->> 'id')::bigint, true);
  select * into c from public.arena_lutas where id = (l ->> 'id')::bigint;
  if c.reputacao <> 5 then raise exception 'FALHA arena: mesma arena, alvo abaixo = metade (%)', c.reputacao; end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
  l := public.arena_atacar('pd', 'pb'); perform public.arena_finalizar((l ->> 'id')::bigint, true);
  select * into c from public.arena_lutas where id = (l ->> 'id')::bigint;
  if c.reputacao <> 10 then raise exception 'FALHA arena: mesma arena, alvo acima = tudo (%)', c.reputacao; end if;
  if (select posicao from public.arena_posicoes where personagem_id = 'pd') <> 3 then raise exception 'FALHA arena: Ranking não muda posição'; end if;
  begin perform public.arena_atacar('pd', 'pd'); raise exception 'X'; exception when others then
    if position('é seu' in sqlerrm) = 0 then raise exception 'FALHA arena: atacar a si mesmo: %', sqlerrm; end if; end;
  raise notice 'ok   arena: ataque pelo Ranking (arena acima: tudo; abaixo: nada; mesma arena abaixo: metade), sem mudar posição';

  -- Revanche mesmo quando o defensor venceu
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  l := public.arena_atacar('pb', 'pa'); perform public.arena_finalizar((l ->> 'id')::bigint, false);   -- Aldric (defensor) venceu
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  r := public.arena_estado('pa', null);
  if not exists (select 1 from jsonb_array_elements(r -> 'historico') h where (h ->> 'id')::bigint = (l ->> 'id')::bigint and (h ->> 'pode_revanche')::boolean) then
    raise exception 'FALHA arena: devia ter revanche mesmo vencendo a defesa'; end if;
  r := public.arena_revanche('pa', (l ->> 'id')::bigint);
  if (select tipo from public.arena_lutas where id = (r ->> 'id')::bigint) <> 'revanche' then raise exception 'FALHA arena: tipo da revanche'; end if;
  perform public.arena_finalizar((r ->> 'id')::bigint, true);
  raise notice 'ok   arena: revanche também depois de vencer a defesa';

  -- Fora do Top 5 não ataca para baixo
  update public.arena_posicoes set posicao = 7 where personagem_id = 'pd';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
  update public.arena_posicoes set posicao = 8 where personagem_id = 'pb';
  begin perform public.arena_desafiar('pd', 'pb'); raise exception 'X'; exception when others then
    if position('5 logo acima' in sqlerrm) = 0 then raise exception 'FALHA arena: 7º não ataca o 8º: %', sqlerrm; end if; end;
  raise notice 'ok   arena: fora do Top 5 só ataca para cima';
end $$;
select pg_temp.igual((select count(*) from public.ranking('nivel') where id is not null)::int > 0, true, 'ranking traz o id para atacar');
reset role;
delete from public.arena_lutas; delete from public.creditos;
-- Leilão do servidor
reset role;
update public.personagens set dados = jsonb_set(dados, '{ouro}', '0') where id in ('pa', 'pb', 'pd');
delete from public.creditos where personagem_id in ('pa', 'pb', 'pd');
delete from public.recompensas where personagem_id in ('pa', 'pb', 'pd');
select pg_temp.como('c');
select pg_temp.igual((public.leilao_estado('pc') ->> 'bloqueado')::boolean, true, 'leilão: antes do level 10 fica bloqueado');
select pg_temp.como('a');
do $$
declare e jsonb := public.leilao_estado('pa'); cfg jsonb := public.tanka_dados() -> 'LEILAO'; ord text[] := array['comum','rara','epica','lendaria'];
begin
  if e ->> 'faixa' <> 'l1' then raise exception 'FALHA leilão: faixa do level 12 devia ser l1: %', e ->> 'faixa'; end if;
  if jsonb_array_length(e -> 'lotes') <> 12 then raise exception 'FALHA leilão: devia ter 12 lotes'; end if;
  if e -> 'fase' ->> 'id' <> 'muitoLongo' then raise exception 'FALHA leilão: começa em Muito longo: %', e -> 'fase'; end if;
  if (select count(*) from jsonb_array_elements(e -> 'lotes') l where l ->> 'tipo' = 'arma') <> 4
     or (select count(distinct l ->> 'classe') from jsonb_array_elements(e -> 'lotes') l where l ->> 'tipo' = 'arma') <> 4
     or (select count(distinct l ->> 'classe') from jsonb_array_elements(e -> 'lotes') l where l ->> 'tipo' = 'armadura') <> 4
     or (select count(*) from jsonb_array_elements(e -> 'lotes') l where l ->> 'tipo' = 'joia') <> 2
     or (select count(*) from jsonb_array_elements(e -> 'lotes') l where l ->> 'tipo' = 'pergaminho') <> 2 then
    raise exception 'FALHA leilão: 4 armas e 4 armaduras (uma por classe), 2 joias, 2 pergaminhos: %', e -> 'lotes'; end if;
  if (select count(*) from jsonb_array_elements(e -> 'lotes') l where l ->> 'tipo' = 'arma' and array_position(ord, l ->> 'raridade') >= 3) < 1
     or (select count(*) from jsonb_array_elements(e -> 'lotes') l where l ->> 'tipo' = 'armadura' and array_position(ord, l ->> 'raridade') >= 3) < 1
     or (select count(*) from jsonb_array_elements(e -> 'lotes') l where l ->> 'tipo' = 'joia' and array_position(ord, l ->> 'raridade') >= 2) < 1 then
    raise exception 'FALHA leilão: garantias (arma épica, armadura épica, joia rara)'; end if;
  if exists (select 1 from jsonb_array_elements(e -> 'lotes') l where (l ->> 'minimo')::bigint <> (cfg -> 'minimo' ->> (l ->> 'raridade'))::bigint
     or (l ->> 'proximo')::bigint <> (l ->> 'minimo')::bigint
     or (l ->> 'tipo' <> 'pergaminho' and (l ->> 'nivel')::int not between 18 and 22)
     or (l ->> 'tipo' = 'pergaminho' and (l ->> 'qtd')::int <> (cfg -> 'pacotePergaminho' ->> (l ->> 'raridade'))::int)) then
    raise exception 'FALHA leilão: mínimo, nível ou pacote errado: %', e -> 'lotes'; end if;
  raise notice 'ok   leilão: rodada nova com 12 lotes e as garantias';
end $$;
-- 300 rodadas: as garantias sempre valem e a faixa 30+ não tem comum
do $$
declare i int; lid bigint;
begin
  for i in 1..300 loop
    lid := public.leilao_criar(case when i % 2 = 0 then 'l1' else 'l3' end);
    if (select count(*) from public.leilao_lotes where leilao_id = lid and tipo = 'arma' and raridade in ('epica', 'lendaria')) < 1
       or (select count(*) from public.leilao_lotes where leilao_id = lid and tipo = 'armadura' and raridade in ('epica', 'lendaria')) < 1
       or (select count(*) from public.leilao_lotes where leilao_id = lid and tipo = 'joia' and raridade <> 'comum') < 1 then
      raise exception 'FALHA leilão: garantia quebrada na rodada %', lid; end if;
  end loop;
  if exists (select 1 from public.leilao_lotes l join public.leiloes r on r.id = l.leilao_id where r.faixa = 'l3' and l.raridade = 'comum') then
    raise exception 'FALHA leilão: l3 não tem comum'; end if;
  if (select min(minimo) from public.leilao_lotes l join public.leiloes r on r.id = l.leilao_id where r.faixa = 'l3') <> 5000 * 40 then
    raise exception 'FALHA leilão: mínimo do l3 = rara x40'; end if;
  delete from public.leiloes where id in (select id from public.leiloes where faixa in ('l1', 'l3') order by id desc limit 300);
  raise notice 'ok   leilão: garantias em 300 rodadas; 30+ sem comum e mínimo x40';
end $$;
reset role;
do $$
declare e jsonb; lote bigint; prox bigint; r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  e := public.leilao_estado('pa');
  lote := (e -> 'lotes' -> 0 ->> 'id')::bigint; prox := (e -> 'lotes' -> 0 ->> 'proximo')::bigint;
  begin perform public.leilao_lance('pa', lote, prox); raise exception 'X'; exception when others then
    if position('Ouro insuficiente' in sqlerrm) = 0 then raise exception 'FALHA leilão: sem ouro devia falhar: %', sqlerrm; end if; end;
  update public.personagens set dados = jsonb_set(dados, '{ouro}', '1000000') where id in ('pa', 'pb', 'pd');
  begin perform public.leilao_lance('pa', lote, prox - 1); raise exception 'X'; exception when others then
    if position('lance mínimo' in sqlerrm) = 0 then raise exception 'FALHA leilão: abaixo do mínimo: %', sqlerrm; end if; end;
  r := public.leilao_lance('pa', lote, prox);
  if not (r -> 'lotes' -> 0 ->> 'sou_lider')::boolean or (r -> 'lotes' -> 0 ->> 'lance')::bigint <> prox then raise exception 'FALHA leilão: lance da Ana'; end if;
  if (r ->> 'ouro')::bigint <> 1000000 - prox then raise exception 'FALHA leilão: ouro real da Ana depois do lance: %', r ->> 'ouro'; end if;
  begin perform public.leilao_lance('pa', lote, prox * 2); raise exception 'X'; exception when others then
    if position('já tem o maior lance' in sqlerrm) = 0 then raise exception 'FALHA leilão: lance em cima de si: %', sqlerrm; end if; end;
  -- Bruna cobre com +5%
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
  begin perform public.leilao_lance('pb', lote, prox + 1); raise exception 'X'; exception when others then
    if position('lance mínimo' in sqlerrm) = 0 then raise exception 'FALHA leilão: precisa de +5%%: %', sqlerrm; end if; end;
  r := public.leilao_lance('pb', lote, ceil(prox * 1.05)::bigint);
  if (r -> 'lotes' -> 0 ->> 'lider_nome') <> 'Bruna' or (r -> 'lotes' -> 0 ->> 'lances')::int <> 2 then raise exception 'FALHA leilão: Bruna devia liderar'; end if;
  if public.ouro_real('pa') <> 1000000 then raise exception 'FALHA leilão: a Ana devia receber o ouro de volta: %', public.ouro_real('pa'); end if;
  if (select count(*) from public.creditos where personagem_id = 'pa' and ouro = prox and motivo like 'Seu lance foi coberto%') <> 1 then
    raise exception 'FALHA leilão: crédito de devolução da Ana'; end if;
  -- Duda (level 20, faixa l2) não pode dar lance no leilão da faixa l1
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
  begin perform public.leilao_lance('pd', lote, prox * 3); raise exception 'X'; exception when others then
    if position('não é da sua faixa' in sqlerrm) = 0 then raise exception 'FALHA leilão: faixa errada: %', sqlerrm; end if; end;
  if public.leilao_estado('pd') ->> 'faixa' <> 'l2' then raise exception 'FALHA leilão: level 20 é l2'; end if;
  -- Fases
  update public.leiloes set fim = now() + interval '2 hours', muito_curto_em = now() + interval '2 hours' - interval '3 minutes'
    where id = (e ->> 'id')::bigint;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
  if public.leilao_estado('pa') -> 'fase' ->> 'id' <> 'longo' then raise exception 'FALHA leilão: 2 h = Longo'; end if;
  update public.leiloes set fim = now() + interval '10 minutes', muito_curto_em = now() + interval '7 minutes' where id = (e ->> 'id')::bigint;
  if public.leilao_estado('pa') -> 'fase' ->> 'id' <> 'curto' then raise exception 'FALHA leilão: 10 min = Curto'; end if;
  update public.leiloes set fim = now() + interval '2 minutes', muito_curto_em = now() - interval '1 minute' where id = (e ->> 'id')::bigint;
  if public.leilao_estado('pa') -> 'fase' ->> 'id' <> 'muitoCurto' then raise exception 'FALHA leilão: Muito curto'; end if;
  -- Fim: a Bruna recebe o item; nova rodada abre sozinha
  update public.leiloes set fim = now() - interval '1 second' where id = (e ->> 'id')::bigint;
  r := public.leilao_estado('pa');
  if (r ->> 'id')::bigint = (e ->> 'id')::bigint or not (select fechado from public.leiloes where id = (e ->> 'id')::bigint) then
    raise exception 'FALHA leilão: devia fechar e abrir outra rodada'; end if;
  if (select count(*) from public.recompensas where personagem_id = 'pb' and origem = 'leilao'
      and (item ->> 'semente')::bigint = (e -> 'lotes' -> 0 ->> 'semente')::bigint and (item ->> 'lance')::bigint = ceil(prox * 1.05)::bigint) <> 1 then
    raise exception 'FALHA leilão: a Bruna devia receber o item'; end if;
  if exists (select 1 from public.recompensas where personagem_id = 'pa' and origem = 'leilao') then raise exception 'FALHA leilão: a Ana não ganhou'; end if;
  begin perform public.leilao_lance('pa', lote, prox * 10); raise exception 'X'; exception when others then
    if position('já terminou' in sqlerrm) = 0 then raise exception 'FALHA leilão: lance em rodada fechada: %', sqlerrm; end if; end;
  raise notice 'ok   leilão: lance, +5%%, ouro devolvido a quem foi coberto, faixa, fases e entrega ao vencedor';
end $$;
set role authenticated;
select pg_temp.como('a');
select pg_temp.igual((select count(*) from public.leilao_lotes)::int, 0, 'leilão: tabela fechada para leitura direta');
reset role;

-- Esqueci a senha: pedido com usuário + e-mail, admin gera senha temporária, troca obrigatória.
update auth.users set encrypted_password = extensions.crypt('antiga1', extensions.gen_salt('bf'));
set role anon;
select public.senha_pedir('BIA', ' B@T.com ');
select public.senha_pedir('bia', 'b@t.com');            -- repetido: continua um pedido só
select public.senha_pedir('bia', 'errado@t.com');       -- e-mail não confere: nada (e sem erro)
select public.senha_pedir('ninguem', 'x@t.com');
reset role;
select pg_temp.igual((select count(*) from public.pedidos_senha)::int, 1, 'senha: pedido só quando usuário e e-mail conferem, um por conta');
set role authenticated;
select pg_temp.como('b');
select pg_temp.falha($$select public.admin_pedidos_senha()$$, 'Só administradores');
select pg_temp.falha($$select public.admin_senha_temporaria(1)$$, 'Só administradores');
select pg_temp.igual((select count(*) from public.pedidos_senha)::int, 0, 'senha: jogador não lê os pedidos direto');
reset role;
update public.contas set admin = true where usuario = 'duda';
set role authenticated;
select pg_temp.como('d');
select pg_temp.igual((select public.admin_pedidos_senha() -> 0 ->> 'email'), 'b@t.com', 'senha: admin vê o pedido com o e-mail do cadastro');
select pg_temp.igual((select public.admin_pedidos_senha() -> 0 -> 'personagens' ->> 0), 'Bruna', 'senha: admin vê os personagens da conta');
create temp table nova_senha as select public.admin_senha_temporaria((select (public.admin_pedidos_senha() -> 0 ->> 'id')::bigint)) as r;
select pg_temp.igual(length((select r ->> 'senha' from nova_senha)), 10, 'senha: temporária com 10 caracteres');
select pg_temp.falha($$select public.admin_senha_temporaria((select min(id) from public.pedidos_senha))$$, 'já resolvido');
select pg_temp.igual(jsonb_array_length(public.admin_pedidos_senha()), 0, 'senha: pedido resolvido some da lista');
reset role;
select pg_temp.igual((select encrypted_password = extensions.crypt((select r ->> 'senha' from nova_senha), encrypted_password)
  from auth.users where id = '00000000-0000-0000-0000-00000000000b'), true, 'senha: login da Bia passa a aceitar a temporária');
select pg_temp.igual((select encrypted_password = extensions.crypt('antiga1', encrypted_password)
  from auth.users where id = '00000000-0000-0000-0000-00000000000a'), true, 'senha: as outras contas não mudam');
select pg_temp.igual((select trocar_senha from public.contas where usuario = 'bia'), true, 'senha: Bia tem que trocar a senha');
set role authenticated;
select pg_temp.como('b');
select public.senha_trocada();
reset role;
select pg_temp.igual((select trocar_senha from public.contas where usuario = 'bia'), false, 'senha: depois de trocar, o aviso some');
set role anon;
select public.senha_pedir('caio', 'c@t.com');
reset role;
set role authenticated;
select pg_temp.como('d');
select public.admin_recusar_pedido_senha((select (public.admin_pedidos_senha() -> 0 ->> 'id')::bigint));
select pg_temp.igual(jsonb_array_length(public.admin_pedidos_senha()), 0, 'senha: pedido recusado some da lista');
reset role;
update public.contas set admin = false where usuario = 'duda';

-- Fila da masmorra: 3 jogadores entram juntos; sozinho por 30 s, completa com bots (cópias); bots sem prêmio.
reset role;
delete from public.grupo_membros; delete from public.grupos; delete from public.masmorra_entradas; delete from public.masmorra_runs;
delete from public.recompensas;
update public.personagens set dados = jsonb_set(dados, '{nivel}', '12') where id = 'pc';
set role authenticated;
select pg_temp.como('a'); select public.fila_entrar('pa', 'toca');
select pg_temp.como('b'); select public.fila_entrar('pb', 'toca');
select pg_temp.igual((select (public.grupo_estado('pb') -> 'fila' ->> 'jogadores')::int), 2, 'fila: dois esperando a mesma masmorra');
select pg_temp.como('c'); select pg_temp.falha($$select public.fila_entrar('pc', 'covil')$$, 'Level mínimo');
select public.fila_entrar('pc', 'toca');
reset role;
select pg_temp.igual((select count(*) from public.masmorra_fila)::int, 0, 'fila: com 3 jogadores a luta começa e a fila esvazia');
select pg_temp.igual((select array_length(membros, 1) || '/' || jsonb_array_length(herois) || '/' || lider || '/' || (grupo_id is null)
  from public.masmorra_runs order by id desc limit 1), '3/3/pa/true', 'fila: luta com os 3 jogadores e o mais antigo como líder');
set role authenticated;
select pg_temp.como('d'); select public.fila_entrar('pd', 'toca');
select public.fila_ping('pd');
reset role;
select pg_temp.igual((select count(*) from public.masmorra_fila)::int, 1, 'fila: sozinho, espera os 30 segundos');
update public.masmorra_fila set entrou_em = now() - interval '31 seconds';
set role authenticated;
select pg_temp.como('d'); select public.fila_ping('pd');
reset role;
select pg_temp.igual((select array_length(membros, 1) || '/' || jsonb_array_length(herois)
  from public.masmorra_runs order by id desc limit 1), '1/3', 'fila: depois de 30 s, 2 bots completam o grupo');
select pg_temp.igual((select (herois -> 1 -> 'dados' -> 'atributos') = (herois -> 0 -> 'dados' -> 'atributos') and (herois -> 1 ->> 'bot')::boolean
    and herois -> 1 -> 'dados' ->> 'nome' <> 'Duda'
  from public.masmorra_runs order by id desc limit 1), true, 'fila: bot é cópia do jogador (mesmo poder), com outro nome');
select max(id) as run_fila from public.masmorra_runs \gset
set role authenticated;
select pg_temp.como('d');
select public.masmorra_concluir('pd', :run_fila, true);
reset role;
select pg_temp.igual((select count(*) from public.recompensas where item ->> 'tipo' in ('colar', 'anel'))::int, 1, 'fila: só o jogador ganha a joia (bots não)');
select pg_temp.igual(public.entradas_usadas('pd'), 1, 'fila: gasta 1 entrada do jogador');
-- quem fecha o jogo sai da fila; quem entra num grupo também
set role authenticated;
select pg_temp.como('a'); select public.fila_entrar('pa', 'toca');
reset role;
update public.masmorra_fila set visto_em = now() - interval '25 seconds';
set role authenticated;
select pg_temp.como('b'); select public.fila_entrar('pb', 'ninho');
reset role;
select pg_temp.igual((select count(*) from public.masmorra_fila where masmorra = 'toca')::int, 1, 'fila: outra masmorra não mexe na fila da toca');
set role authenticated;
select pg_temp.como('d'); select public.fila_entrar('pd', 'toca');
reset role;
select pg_temp.igual((select string_agg(personagem_id, ',' order by personagem_id) from public.masmorra_fila where masmorra = 'toca'), 'pd', 'fila: sem ping há 20 s, sai da fila');
set role authenticated;
select pg_temp.como('d'); select pg_temp.falha('select public.masmorra_concluir(''pd'', ' || :run_fila || ', true)', 'já terminou');
select pg_temp.como('a'); select pg_temp.falha('select public.masmorra_concluir(''pa'', ' || :run_fila || ', true)', 'Só o líder');
select public.fila_sair('pa');
select pg_temp.como('d'); select public.fila_sair('pd');
reset role;
update public.personagens set dados = jsonb_set(dados, '{nivel}', '4') where id = 'pc';
delete from public.masmorra_fila;

-- Masmorra: 5 entradas por dia (antes 2).
reset role;
select pg_temp.igual(public.masmorra_entradas_dia(), 5, 'masmorra: 5 entradas por dia');
insert into public.masmorra_entradas (personagem_id, dia, usadas) values ('pa', public.dia_jogo(), 4)
  on conflict (personagem_id, dia) do update set usadas = 4;
set role authenticated;
select pg_temp.como('a'); select public.fila_entrar('pa', 'toca'); select public.fila_sair('pa');
reset role;
update public.masmorra_entradas set usadas = 5 where personagem_id = 'pa' and dia = public.dia_jogo();
set role authenticated;
select pg_temp.como('a'); select pg_temp.falha($$select public.fila_entrar('pa', 'toca')$$, 'Sem entradas');
reset role;
delete from public.masmorra_entradas; delete from public.masmorra_fila;
-- Boss da aliança (Daniel, nov/2026)
reset role;
delete from public.alianca_espera; delete from public.recompensas;   -- prêmios que sobraram de outros testes
insert into public.aliancas (nome, sigla) values ('Guardiões', 'GUA');
insert into public.alianca_membros (personagem_id, alianca_id, cargo)
  select x.pid, a.id, x.cargo from public.aliancas a, (values ('pa', 'lider'), ('pb', 'membro'), ('pd', 'membro')) x(pid, cargo) where a.sigla = 'GUA';
set role authenticated;
select pg_temp.como('a');
select pg_temp.igual(public.alianca_boss_estado('pa') -> 'boss' ->> 'estado', 'fechado', 'boss: sem hora, fica fechado');
select pg_temp.como('b');
select pg_temp.falha($$select public.alianca_boss_hora('pb', 20)$$, 'Só o líder e o vice-líder escolhem');
select pg_temp.falha($$select public.alianca_boss_atacar('pb')$$, 'não está aberto');
select pg_temp.como('a');
select pg_temp.falha($$select public.alianca_boss_hora('pa', 24)$$, 'Hora inválida');
select public.alianca_boss_hora('pa', extract(hour from now() at time zone 'America/Sao_Paulo')::int);
select pg_temp.igual(public.alianca_boss_estado('pa') -> 'boss' ->> 'estado', 'aberto', 'boss: abre sozinho na hora do líder');
select pg_temp.igual((public.alianca_boss_estado('pa') -> 'boss' ->> 'hp')::bigint, (public.tanka_dados() -> 'BOSS_ALIANCA' -> 'niveis' -> 0 ->> 'hp')::bigint, 'boss: nível 1 com a vida cheia');
select pg_temp.falha($$select public.alianca_boss_hora('pa', 3)$$, 'Espere o boss de hoje terminar');
-- grupo de até 4
select pg_temp.como('b'); select public.alianca_boss_sala_criar('pb');
select pg_temp.como('d'); select public.alianca_boss_sala_entrar('pd', (public.alianca_boss_estado('pd') -> 'salas' -> 0 ->> 'id')::bigint);
select pg_temp.igual(jsonb_array_length(public.alianca_boss_estado('pd') -> 'salas' -> 0 -> 'membros'), 2, 'boss: grupo com 2 membros');
select pg_temp.falha($$select public.alianca_boss_atacar('pd')$$, 'Só o líder do grupo');
select pg_temp.como('b');
select (public.alianca_boss_atacar('pb') ->> 'id')::bigint as run_boss \gset
reset role;
select pg_temp.igual((select count(*) from public.alianca_boss_runs where id = :run_boss and membros = array['pb', 'pd'])::int, 1, 'boss: investida leva o grupo todo');
set role authenticated; select pg_temp.como('b');
select pg_temp.falha($$select public.alianca_boss_atacar('pb')$$, 'ainda está numa investida');
select pg_temp.igual((public.alianca_boss_concluir('pb', :run_boss, array[1000, 500]::bigint[]) ->> 'dano')::bigint, 1500::bigint, 'boss: dano do grupo somado');
select pg_temp.falha('select public.alianca_boss_concluir(''pb'', ' || :run_boss || ', array[1]::bigint[])', 'já terminou');
select pg_temp.igual((public.alianca_boss_estado('pb') -> 'boss' ->> 'hp')::bigint,
  (public.tanka_dados() -> 'BOSS_ALIANCA' -> 'niveis' -> 0 ->> 'hp')::bigint - 1500, 'boss: vida de todos diminui');
select pg_temp.igual(public.alianca_boss_estado('pb') -> 'ranking' -> 0 ->> 'nome', 'Bruna', 'boss: ranking de dano');
-- o líder da aliança mata o boss sozinho (dano maior que a vida conta só a vida que falta)
select pg_temp.como('a');
select (public.alianca_boss_atacar('pa') ->> 'id')::bigint as run_boss2 \gset
select pg_temp.igual((public.alianca_boss_concluir('pa', :run_boss2, array[999999999]::bigint[]) ->> 'morreu')::boolean, true, 'boss: morreu');
select pg_temp.igual(public.alianca_boss_estado('pa') -> 'boss' ->> 'estado', 'morto', 'boss: fica morto até amanhã');
select pg_temp.igual((public.alianca_boss_estado('pa') -> 'boss' ->> 'nivel')::int, 2, 'boss: sobe para o nível 2');
select pg_temp.igual(public.alianca_boss_estado('pa') -> 'boss' ->> 'ultimo_golpe', 'Aldric', 'boss: quem deu o último golpe');
select pg_temp.falha($$select public.alianca_boss_atacar('pa')$$, 'não está aberto');
select pg_temp.igual((select count(*) from jsonb_array_elements(public.alianca_boss_estado('pa') -> 'recompensas') r where r -> 'item' ->> 'tipo' = 'bossItem')::int, 1, 'boss: maior dano ganha o item');
select pg_temp.como('d');
select pg_temp.igual((select count(*) from jsonb_array_elements(public.alianca_boss_estado('pd') -> 'recompensas') r where r -> 'item' ->> 'tipo' in ('exp', 'pergaminho'))::int, 3, 'boss: exp e 2 pergaminhos para quem deu dano');
reset role;
select pg_temp.igual((select count(*) from public.creditos where motivo like 'Boss do clã%')::int, 3, 'boss: ouro para os 3 que deram dano');
select pg_temp.igual((select exp from public.aliancas where sigla = 'GUA'), (public.tanka_dados() -> 'BOSS_ALIANCA' -> 'niveis' -> 0 ->> 'alianca')::bigint, 'boss: exp para a aliança');
select pg_temp.igual((select progresso from public.alianca_missoes x join public.aliancas a on a.id = x.alianca_id
  where a.sigla = 'GUA' and x.periodo = 'semana' and x.tipo = 'bossCla')::int, 1, 'boss: conta na missão semanal do clã');
-- não matou a tempo: no outro dia, o mesmo boss com a vida cheia
update public.alianca_boss set estado = 'aberto', hp = 10, aberto_em = now() - interval '61 minutes'
  where alianca_id = (select id from public.aliancas where sigla = 'GUA');
set role authenticated;
select pg_temp.como('a');
select pg_temp.igual(public.alianca_boss_estado('pa') -> 'boss' ->> 'estado', 'falhou', 'boss: passou 1 hora, falhou');
reset role;
update public.alianca_boss set dia = public.dia_jogo() - 1 where alianca_id = (select id from public.aliancas where sigla = 'GUA');
set role authenticated;
select pg_temp.igual(public.alianca_boss_estado('pa') -> 'boss' ->> 'estado', 'aberto', 'boss: abre de novo no dia seguinte');
select pg_temp.igual((public.alianca_boss_estado('pa') -> 'boss' ->> 'hp')::bigint, (public.tanka_dados() -> 'BOSS_ALIANCA' -> 'niveis' -> 1 ->> 'hp')::bigint, 'boss: mesmo nível, vida cheia');
-- quem sai da aliança sai do grupo do boss
select public.alianca_expulsar('pa', 'pd');
select pg_temp.igual(jsonb_array_length(public.alianca_boss_estado('pa') -> 'salas' -> 0 -> 'membros'), 1, 'boss: expulso sai do grupo do boss');
select pg_temp.como('b'); select public.alianca_boss_sala_sair('pb');
select pg_temp.igual(public.alianca_boss_estado('pb') -> 'salas', '[]'::jsonb, 'boss: grupo vazio some');
reset role;
delete from public.aliancas where sigla = 'GUA'; delete from public.alianca_espera; delete from public.recompensas; delete from public.creditos where motivo like 'Boss%';

-- Chefe Mundial (Ignaroth)
reset role;
delete from public.alianca_membros; delete from public.recompensas; delete from public.mensagens;
update public.personagens set atualizado_em = now();
update public.contas set admin = false, bot = false;
select pg_temp.igual(public.boss_vida_inicial(), 200000::bigint, 'boss: 50 mil por jogador ativo (4 contas)');
update public.contas set bot = true where usuario = 'caio';
select pg_temp.igual(public.boss_vida_inicial(), 150000::bigint, 'boss: bots não contam');
update public.contas set bot = false where usuario = 'caio';
insert into public.aliancas (nome, sigla, tesouro) values ('Boss Teste A', 'BTA', 0), ('Boss Teste B', 'BTB', 0);
insert into public.alianca_membros (personagem_id, alianca_id) values
  ('pa', (select id from public.aliancas where sigla = 'BTA')), ('pb', (select id from public.aliancas where sigla = 'BTB')),
  ('pc', (select id from public.aliancas where sigla = 'BTB'));
-- despertar diário às 20h: cria (se já passou das 20h) e anuncia no chat
delete from public.boss_mundial;
set role authenticated;
select pg_temp.como('a'); select public.boss_estado('pa') is not null;
reset role;
select pg_temp.igual((select count(*) from public.boss_mundial)::int,
  case when now() >= (public.dia_jogo()::timestamp + interval '20 hours') at time zone 'America/Sao_Paulo'
        and now() < (public.dia_jogo()::timestamp + interval '21 hours') at time zone 'America/Sao_Paulo' then 1 else 0 end,
  'boss: só desperta entre 20h e 21h');
select pg_temp.igual((select count(*) from public.mensagens where classe = 'sistema')::int,
  (select count(*) from public.boss_mundial)::int, 'boss: anúncio no chat quando desperta');
delete from public.boss_mundial; delete from public.mensagens;
-- fora do horário não dá para atacar
set role authenticated;
select pg_temp.como('a'); select pg_temp.falha($$select public.boss_atacar('pa', 100, 'rei_goblin')$$, 'não está acordado');
select pg_temp.falha($$select public.admin_boss_invocar('pa', 1000, 60)$$, 'Só administradores');
reset role;
update public.contas set admin = true where usuario = 'duda';
set role authenticated;
select pg_temp.como('d'); select public.admin_boss_invocar('pd', 1000, 60);
select pg_temp.como('a'); select public.boss_atacar('pa', 300, 'rei_goblin');
select pg_temp.falha($$select public.boss_atacar('pa', 300, 'rei_goblin')$$, 'Espere alguns segundos');
select pg_temp.falha($$select public.boss_atacar('pb', 300, 'x')$$, 'Personagem inválido');
select pg_temp.como('b'); select public.boss_atacar('pb', 250, 'rainha_aranha');
select pg_temp.como('c'); select public.boss_atacar('pc', 200, 'rei_goblin');
reset role;
update public.boss_mundial_dano set ultimo_em = now() - interval '20 seconds';
set role authenticated;
select pg_temp.como('a');
select pg_temp.igual((public.boss_estado('pa') -> 'boss' ->> 'vida')::int, 250, 'boss: a vida é de todos (1000 - 750)');
select pg_temp.igual((public.boss_estado('pa') -> 'eu' ->> 'posicao')::int, 1, 'boss: posição no ranking');
select pg_temp.igual((public.boss_estado('pa') -> 'aliancas' -> 0 ->> 'sigla'), 'BTB', 'boss: ranking de alianças (BTB 450)');
select pg_temp.igual((public.boss_atacar('pa', 999999, 'rei_goblin') ->> 'caiu')::boolean, true, 'boss: o golpe que zera derruba');
reset role;
select pg_temp.igual((select estado from public.boss_mundial order by id desc limit 1), 'derrotado', 'boss: derrotado');
select pg_temp.igual((select golpe_final from public.boss_mundial order by id desc limit 1), 'pa', 'boss: golpe final de quem zerou');
select pg_temp.igual((select dano from public.boss_mundial_dano where personagem_id = 'pa'), 200300::bigint, 'boss: dano por ataque limitado a 200 mil');
select pg_temp.igual((select count(*) from public.recompensas where item ->> 'tipo' = 'boss_premio' and (item ->> 'fator')::int = 100)::int, 3, 'boss: prêmio cheio para os 3 atacantes');
select pg_temp.igual((select (item ->> 'ataques')::int from public.recompensas where personagem_id = 'pa' and item ->> 'tipo' = 'boss_premio'), 2, 'boss: prêmio conta os ataques');
select pg_temp.igual((select count(*) from public.recompensas where item ->> 'tipo' = 'pergaminho' and origem = 'boss')::int, 3, 'boss: top 10 ganha 1 pergaminho');
select pg_temp.igual((select item ->> 'nome' from public.recompensas where item ->> 'tipo' = 'titulo'), 'Matador de Dragões', 'boss: título do golpe final');
select pg_temp.igual((select personagem_id from public.recompensas where item ->> 'tipo' = 'titulo'), 'pa', 'boss: título vai para quem deu o golpe final');
select pg_temp.igual((select tesouro from public.aliancas where sigla = 'BTA'), 2003::bigint, 'boss: aliança com mais dano ganha 1% em ouro');
select pg_temp.igual((select tesouro from public.aliancas where sigla = 'BTB'), 0::bigint, 'boss: só a primeira aliança ganha');
select pg_temp.igual((select count(*) from public.recompensas where item ->> 'tipo' = 'boss_item' and item ->> 'raridade' not in ('epica', 'lendaria'))::int, 0, 'boss: item só épico ou lendário');
set role authenticated;
select pg_temp.como('a');
select pg_temp.igual(jsonb_array_length(public.boss_estado('pa') -> 'recompensas') >= 3, true, 'boss: prêmios aparecem no estado');
select pg_temp.falha($$select public.boss_atacar('pa', 10, 'rei_goblin')$$, 'não está acordado');
-- não caiu a tempo: 70% + 1 pergaminho para quem atacou
select pg_temp.como('d'); select public.admin_boss_invocar('pd', 5000, 60);
select pg_temp.como('b'); select public.boss_atacar('pb', 100, 'rainha_aranha');
reset role;
delete from public.recompensas;
update public.boss_mundial set fim = now() - interval '1 second' where estado = 'ativo';
set role authenticated;
select pg_temp.como('a'); select public.boss_estado('pa') is not null;
reset role;
select pg_temp.igual((select estado from public.boss_mundial order by id desc limit 1), 'dormindo', 'boss: passou da hora, volta a dormir');
select pg_temp.igual((select (item ->> 'fator')::int from public.recompensas where item ->> 'tipo' = 'boss_premio'), 70, 'boss: consolação de 70%');
select pg_temp.igual((select count(*) from public.recompensas where item ->> 'tipo' = 'pergaminho')::int, 1, 'boss: consolação com 1 pergaminho');
select pg_temp.igual((select count(*) from public.recompensas)::int, 2, 'boss: só quem atacou ganha a consolação');
select public.boss_premiar((select id from public.boss_mundial order by id desc limit 1), false);
select pg_temp.igual((select count(*) from public.recompensas)::int, 2, 'boss: prêmio é entregue uma vez só');
update public.contas set admin = false where usuario = 'duda';
delete from public.recompensas; delete from public.boss_mundial; delete from public.alianca_membros;
delete from public.aliancas where sigla in ('BTA', 'BTB');

-- Mercado entre jogadores
reset role;
delete from public.recompensas; delete from public.creditos; delete from public.mercado_anuncios;
update public.personagens set dados = dados || '{"ouro": 1000, "inventario": [{"id":"esp1","tipo":"arma","raridade":"epica","nivel":12},
  {"id":"elmo1","tipo":"elmo","raridade":"rara","nivel":10},{"id":"anel1","tipo":"anel","raridade":"lendaria","nivel":15},
  {"id":"trav1","tipo":"botas","raridade":"comum","travado":true}], "equipados": {"elmo":"elmo1"},
  "consumiveis": [{"id":"pergaminho-rara","tipo":"pergaminho","raridade":"rara","qtd":5}]}'::jsonb where id = 'pa';
update public.personagens set dados = dados || '{"ouro": 500}'::jsonb where id = 'pb';
set role authenticated;
select pg_temp.como('a');
select pg_temp.falha($$select public.mercado_anunciar('pa', 'elmo1', null, 1, 100)$$, 'Tire o item do corpo');
select pg_temp.falha($$select public.mercado_anunciar('pa', 'trav1', null, 1, 100)$$, 'Destrave o item');
select pg_temp.falha($$select public.mercado_anunciar('pa', 'naoexiste', null, 1, 100)$$, 'não encontrado');
select pg_temp.falha($$select public.mercado_anunciar('pa', 'esp1', null, 1, 0)$$, 'Preço inválido');
select pg_temp.falha($$select public.mercado_anunciar('pa', null, 'rara', 9, 100)$$, 'só tem 5');
select public.mercado_anunciar('pa', 'esp1', null, 1, 300) is not null;
select public.mercado_anunciar('pa', 'anel1', null, 1, 50) is not null;
select public.mercado_anunciar('pa', null, 'rara', 2, 40) is not null;
select pg_temp.falha($$select public.mercado_anunciar('pa', 'esp1', null, 1, 300)$$, 'não encontrado');
reset role;
select pg_temp.igual((select jsonb_array_length(dados -> 'inventario') from public.personagens where id = 'pa'), 2, 'mercado: item sai da mochila salva');
select pg_temp.igual((select (dados -> 'consumiveis' -> 0 ->> 'qtd')::int from public.personagens where id = 'pa'), 3, 'mercado: pergaminhos saem da pilha');
select pg_temp.igual((select categoria from public.mercado_anuncios where item ->> 'id' = 'anel1'), 'joia', 'mercado: anel é joia');
set role authenticated;
select pg_temp.como('b');
select pg_temp.igual(jsonb_array_length(public.mercado_estado('pb', null, null, 0) -> 'anuncios'), 3, 'mercado: todos veem os anúncios');
select pg_temp.igual(jsonb_array_length(public.mercado_estado('pb', 'arma', null, 0) -> 'anuncios'), 1, 'mercado: filtro de categoria');
select pg_temp.igual(public.mercado_estado('pb', null, 'raridade', 0) -> 'anuncios' -> 0 -> 'item' ->> 'raridade', 'lendaria', 'mercado: ordenar por raridade');
select pg_temp.igual(public.mercado_estado('pb', null, 'nivel', 0) -> 'anuncios' -> 0 -> 'item' ->> 'id', 'anel1', 'mercado: ordenar por nível');
select pg_temp.igual(public.mercado_estado('pb', null, null, 0) -> 'anuncios' -> 0 ->> 'vendedor', 'Aldric', 'mercado: mostra o nome do vendedor');
select pg_temp.falha(format('select public.mercado_comprar(%L, %s)', 'pb', (select id from public.mercado_anuncios where item ->> 'id' = 'esp1')), 'já foi vendido') where false;
reset role;
select id as an_esp from public.mercado_anuncios where item ->> 'id' = 'esp1' \gset
select id as an_perg from public.mercado_anuncios where categoria = 'pergaminho' \gset
select id as an_anel from public.mercado_anuncios where item ->> 'id' = 'anel1' \gset
set role authenticated;
select pg_temp.como('a'); select pg_temp.falha('select public.mercado_comprar(''pa'', ' || :an_esp || ')', 'é seu');
select pg_temp.como('b');
select public.mercado_comprar('pb', :an_esp) is not null;
select pg_temp.falha('select public.mercado_comprar(''pb'', ' || :an_esp || ')', 'já foi vendido');
select pg_temp.falha('select public.mercado_comprar(''pb'', ' || :an_perg || ') from (select 1) x where public.mercado_comprar(''pb'', ' || :an_anel || ') is not null and false', 'xx') where false;
reset role;
update public.mercado_anuncios set preco = 300 where id = :an_perg;
set role authenticated;
select pg_temp.como('b'); select pg_temp.falha('select public.mercado_comprar(''pb'', ' || :an_perg || ')', 'Ouro insuficiente');
reset role;
select pg_temp.igual((select sum(ouro)::int from public.creditos where personagem_id = 'pb'), -300, 'mercado: comprador paga o preço');
select pg_temp.igual((select sum(ouro)::int from public.creditos where personagem_id = 'pa'), 270, 'mercado: vendedor recebe com 10% de taxa');
select pg_temp.igual((select item ->> 'id' from public.recompensas where personagem_id = 'pb'), 'esp1', 'mercado: item vai para o comprador');
set role authenticated;
select pg_temp.como('a'); select public.mercado_cancelar('pa', :an_anel) is not null;
select pg_temp.falha('select public.mercado_cancelar(''pa'', ' || :an_anel || ')', 'não está mais');
reset role;
select pg_temp.igual((select item ->> 'id' from public.recompensas where personagem_id = 'pa'), 'anel1', 'mercado: cancelar devolve o item');
update public.mercado_anuncios set expira_em = now() - interval '1 second' where id = :an_perg;
set role authenticated;
select pg_temp.como('b'); select public.mercado_estado('pb', null, null, 0) is not null;
reset role;
select pg_temp.igual((select (item ->> 'qtd')::int from public.recompensas where personagem_id = 'pa' and item ->> 'tipo' = 'pergaminho'), 2, 'mercado: vencido devolve os pergaminhos');
select pg_temp.igual((select count(*) from public.mercado_anuncios where estado = 'ativo')::int, 0, 'mercado: nada mais à venda');
delete from public.recompensas; delete from public.creditos; delete from public.mercado_anuncios;
-- Mercado: craft dos Anões (materiais, receitas, proteções)
reset role;
delete from public.recompensas; delete from public.creditos; delete from public.mercado_anuncios;
update public.personagens set dados = dados || '{"consumiveis": [{"id":"material-nevoa","tipo":"material","raridade":"nevoa","qtd":5}]}'::jsonb where id = 'pa';
update public.personagens set dados = dados || '{"ouro": 500}'::jsonb where id = 'pb';
set role authenticated;
select pg_temp.como('a');
select pg_temp.falha($$select public.mercado_anunciar('pa', null, 'ouro:muito', 1, 10)$$, 'Escolha um item');
select pg_temp.falha($$select public.mercado_anunciar('pa', null, 'material:nevoa', 9, 10)$$, 'só tem 5');
select public.mercado_anunciar('pa', null, 'material:nevoa', 3, 30) is not null;
reset role;
select pg_temp.igual((select categoria from public.mercado_anuncios where item ->> 'tipo' = 'material'), 'craft', 'mercado: material é da categoria craft');
select pg_temp.igual((select (dados -> 'consumiveis' -> 0 ->> 'qtd')::int from public.personagens where id = 'pa'), 2, 'mercado: material sai da pilha');
select id as an_mat from public.mercado_anuncios where item ->> 'tipo' = 'material' \gset
set role authenticated;
select pg_temp.como('b'); select public.mercado_comprar('pb', :an_mat) is not null;
reset role;
select pg_temp.igual((select (item ->> 'qtd')::int from public.recompensas where personagem_id = 'pb' and item ->> 'tipo' = 'material'), 3, 'mercado: comprador recebe os materiais');
delete from public.recompensas; delete from public.creditos; delete from public.mercado_anuncios;
-- Oficinas e Relíquia Rúnica (Anões, etapas 4 e 5)
reset role;
delete from public.recompensas; delete from public.creditos;
update public.personagens set dados = dados || '{"nivel": 30, "raca": "anao", "talentos": {"classe2": "ferreiro"}}'::jsonb where id = 'pd';
update public.personagens set dados = dados || '{"talentos": {"classe2": "coletor"}}'::jsonb where id = 'pb';
update public.personagens set dados = dados || '{"ouro": 100000, "equipados": {}, "inventario": [{"id":"esp9","tipo":"arma","raridade":"epica","encanto":3,"nivel":20},
  {"id":"len9","tipo":"arma","raridade":"lendaria","encanto":7,"nivel":30}],
  "consumiveis": [{"id":"pergaminho-epica","tipo":"pergaminho","raridade":"epica","qtd":2},{"id":"protecao-epica","tipo":"protecao","raridade":"epica","qtd":1},
  {"id":"material-ferro","tipo":"material","raridade":"ferro","qtd":10},{"id":"material-escama","tipo":"material","raridade":"escama","qtd":3},
  {"id":"material-brasaIgnaroth","tipo":"material","raridade":"brasaIgnaroth","qtd":2},{"id":"material-fragmento","tipo":"material","raridade":"fragmento","qtd":1}]}'::jsonb where id = 'pa';
set role authenticated;
select pg_temp.como('a');
select pg_temp.falha($$select public.oficina_configurar('pa', '{"encantar": 10}', 0, 0)$$, 'Só Ferreiros e Coletores');
select pg_temp.como('d');
select pg_temp.falha($$select public.oficina_configurar('pd', '{"receita": 10}', 0, 0)$$, 'não oferece');
select public.oficina_configurar('pd', '{"encantar": 500, "forjar": 1000, "reliquia": 5000}', 30, 100);
select pg_temp.como('b'); select public.oficina_configurar('pb', '{"receita": 100}', 0, 0);
select pg_temp.como('a');
select pg_temp.igual(jsonb_array_length(public.oficina_estado('pa') -> 'lista'), 2, 'oficinas: lista com as abertas');
select pg_temp.falha($$select public.oficina_pedir('pa', 'pb', 'encantar', 'esp9', '{}')$$, 'não oferece');
select (public.oficina_pedir('pa', 'pd', 'encantar', 'esp9', '{"protecao": true}') ->> 'id')::bigint as ped1 \gset
reset role;
select pg_temp.igual((select jsonb_array_length(dados -> 'inventario') from public.personagens where id = 'pa'), 1, 'oficina: item guardado (sai da mochila)');
select pg_temp.igual((select count(*) from public.personagens, jsonb_array_elements(dados -> 'consumiveis') c where id = 'pa' and c ->> 'tipo' = 'protecao')::int, 0, 'oficina: proteção guardada');
select pg_temp.igual((select sum(ouro)::int from public.creditos where personagem_id = 'pa'), -500, 'oficina: cliente paga o preço');
set role authenticated;
select pg_temp.como('d');
select pg_temp.igual(jsonb_array_length(public.oficina_estado('pd') -> 'fazer'), 1, 'oficina: artesão vê o pedido');
select pg_temp.como('a'); select pg_temp.falha('select public.oficina_fazer(''pa'', ' || :ped1 || ')', 'Pedido não encontrado');
select pg_temp.como('d');
select (public.oficina_fazer('pd', :ped1) ->> 'alvo')::int = 4;
reset role;
select pg_temp.igual((select item ->> 'id' from public.recompensas where personagem_id = 'pa' and item ->> 'id' = 'esp9'), 'esp9', 'oficina: item volta ao cliente (protegido: nunca quebra)');
select pg_temp.igual((select sum(ouro)::int from public.creditos where personagem_id = 'pd'), 450, 'oficina: artesão recebe com 10% de taxa');
-- cancelar devolve tudo
delete from public.recompensas; delete from public.creditos;
set role authenticated; select pg_temp.como('a');
select (public.oficina_pedir('pa', 'pb', 'receita', null, '{"area": "floresta"}') ->> 'id')::bigint as ped2 \gset
select public.oficina_cancelar('pa', :ped2);
select pg_temp.falha('select public.oficina_cancelar(''pa'', ' || :ped2 || ')', 'não está mais esperando');
reset role;
select pg_temp.igual((select (item ->> 'qtd')::int from public.recompensas where personagem_id = 'pa' and item ->> 'raridade' = 'ferro'), 10, 'oficina: cancelar devolve os materiais');
select pg_temp.igual((select sum(ouro)::int from public.creditos where personagem_id = 'pa'), 0, 'oficina: cancelar devolve o ouro (preço + receita)');
-- receita do Coletor
update public.personagens set dados = jsonb_set(dados, '{consumiveis}', (dados -> 'consumiveis') || '[{"id":"material-ferro","tipo":"material","raridade":"ferro","qtd":10}]'::jsonb) where id = 'pa';
delete from public.recompensas;
set role authenticated; select pg_temp.como('a');
select (public.oficina_pedir('pa', 'pb', 'receita', null, '{"area": "floresta"}') ->> 'id')::bigint as ped3 \gset
select pg_temp.como('b'); select public.oficina_fazer('pb', :ped3) is not null;
reset role;
select pg_temp.igual((select item ->> 'tipo' from public.recompensas where personagem_id = 'pa'), 'receita', 'oficina: Coletor entrega a receita');
-- Relíquia Rúnica
delete from public.recompensas;
set role authenticated; select pg_temp.como('a');
select pg_temp.falha($$select public.oficina_pedir('pa', 'pd', 'reliquia', 'len9', '{"nome": "X"}')$$, 'nome de 3 a 24');
select (public.oficina_pedir('pa', 'pd', 'reliquia', 'len9', '{"nome": "Fúria de Thorin"}') ->> 'id')::bigint as ped4 \gset
select pg_temp.como('d'); select public.oficina_fazer('pd', :ped4) is not null;
select pg_temp.igual((public.oficina_estado('pd') -> 'lista' -> 0 ->> 'reliquia_semana')::int, 1, 'relíquia: 1 por semana por Ferreiro');
reset role;
select pg_temp.igual((select count(*) from public.recompensas where personagem_id = 'pa' and item ->> 'id' = 'len9')::int, 1, 'relíquia: o item volta (relíquia ou igual)');
update public.personagens set dados = jsonb_set(dados, '{inventario}', '[{"id":"rel1","tipo":"arma","raridade":"lendaria","encanto":8,"runa":"furia"}]')
  || '{"consumiveis": [{"id":"pergaminho-lendaria","tipo":"pergaminho","raridade":"lendaria","qtd":1}]}'::jsonb where id = 'pa';
set role authenticated; select pg_temp.como('a');
select pg_temp.falha($$select public.oficina_pedir('pa', 'pd', 'encantar', 'rel1', '{}')$$, 'Relíquias não podem mais ser encantadas');
reset role;
select pg_temp.igual((select count(*) from public.recompensas where personagem_id = 'pa' and item ->> 'id' = 'len9' and item ? 'runa')::int,
  (select count(*) from public.reliquias where nome_chave = 'fúria de thorin')::int, 'relíquia: nome único guardado quando dá certo');
-- prazo de 24 h
update public.personagens set dados = jsonb_set(dados, '{consumiveis}', (dados -> 'consumiveis') || '[{"id":"material-ferro","tipo":"material","raridade":"ferro","qtd":10}]'::jsonb) where id = 'pa';
delete from public.recompensas; delete from public.creditos;
set role authenticated; select pg_temp.como('a');
select (public.oficina_pedir('pa', 'pb', 'receita', null, '{"area": "floresta"}') ->> 'id')::bigint as ped5 \gset
reset role; update public.oficina_pedidos set criado_em = now() - interval '25 hours' where id = :ped5;
set role authenticated; select pg_temp.como('a'); select public.oficina_estado('pa') is not null;
reset role;
select pg_temp.igual((select estado from public.oficina_pedidos where id = :ped5), 'expirado', 'oficina: sem fazer em 24 h, volta tudo');
delete from public.recompensas; delete from public.creditos; delete from public.oficina_pedidos; delete from public.oficinas; delete from public.reliquias;
-- Arena: esquiva não conta, só o 1 do dado erra
do $$
declare a jsonb; d jsonb; r jsonb; i int; erros int := 0;
begin
  a := jsonb_build_object('hp', 100000, 'hpMax', 100000, 'dano', '[20,20]'::jsonb, 'magico', true, 'defesa', 0, 'defesaMagica', 0, 'velBase', 20, 'vel', 20,
    'esquiva', 0, 'kit', '[]'::jsonb, 'turno', 0, 'pronto', '{}'::jsonb, 'buffs', '[]'::jsonb, 'atordoado', 0, 'furtivo', false, 'critEm', -1);
  d := a || jsonb_build_object('esquiva', 100, 'magico', false);
  for i in 1..50 loop
    r := public.arena_vez(a, d, 2 + (i % 19)); d := r -> 'outro';
    if (r -> 'ev' ->> 'dano')::int <= 0 then erros := erros + 1; end if;
  end loop;
  if erros > 0 then raise exception 'FALHA arena: com 100%% de esquiva, dados de 2 a 20 erraram % vezes', erros; end if;
  r := public.arena_vez(a, d, 1);
  if (r -> 'ev' ->> 'dano')::int <> 0 then raise exception 'FALHA arena: o 1 do dado devia errar: %', r -> 'ev'; end if;
  raise notice 'ok   arena: esquiva não conta; só o 1 do dado erra';
end $$;
-- Mineração: quem está minerando não luta na Arena
do $$
begin
  update public.personagens set dados = dados || jsonb_build_object('minas', jsonb_build_object('fim', extract(epoch from now()) * 1000 + 3600000)) where id = 'pa';
  begin
    perform public.arena_comecar_tipo('pa', 'pb', null, 'livre');
    raise exception 'FALHA mineração: devia barrar a Arena';
  exception when others then
    if sqlerrm not like '%minerando%' then raise; end if;
  end;
  update public.personagens set dados = dados - 'minas' where id = 'pa';
  raise notice 'ok   mineração: quem está minerando não luta na Arena';
end $$;
\echo TODOS OS TESTES DO BANCO PASSARAM
