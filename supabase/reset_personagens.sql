-- RESET DE PERSONAGENS (Henri, nov/2026). Apaga TODOS os personagens dos jogadores e tudo o que era deles,
-- para todo mundo começar do zero. NÃO TEM VOLTA: faça antes um backup (Supabase › Database › Backups).
--
-- O que FICA: as contas (login e senha), quem é admin, e os bots de teste da Arena (se quiser apagar os bots
-- também, troque `and not c.bot` por nada na linha marcada abaixo).
-- O que SAI: personagens dos jogadores e, junto, ranking e lutas da Arena, jackpot, clãs (com tesouro, chefe,
-- skills e missões), leilões, mercado, chat (global e privado), amizades, grupos e masmorras, Chefe Mundial,
-- oficinas e relíquias, créditos e prêmios a receber.
--
-- Como rodar: cole tudo no SQL Editor do Supabase e clique em Run. No fim aparece quantos personagens sobraram.

begin;

-- 1) Personagens dos jogadores (apaga em cascata: posições da Arena, membros de clã, amizades, grupos, masmorras,
--    recompensas, anúncios do mercado, mensagens privadas, oficinas, dano no Chefe Mundial etc.)
delete from public.personagens p
  using public.contas c
  where c.id = p.conta_id
    and not c.bot;          -- <- tire esta linha para apagar os bots também

-- 2) O "mundo" do jogo que não é apagado junto com os personagens
truncate public.arena_lutas, public.arena_jackpot, public.creditos, public.recompensas,
  public.mensagens, public.mensagens_privadas, public.reliquias, public.pedidos_senha
  restart identity;
truncate public.aliancas restart identity cascade;        -- clãs: membros, convites, mural, chefe, skills, missões
truncate public.leiloes restart identity cascade;         -- leilões e lotes (o jogo cria novos sozinho)
truncate public.boss_mundial restart identity cascade;    -- Chefe Mundial e o ranking de dano
truncate public.mercado_anuncios restart identity;
truncate public.oficinas, public.oficina_pedidos restart identity cascade;

commit;

-- Conferência: quantos personagens sobraram (só bots, se você manteve)
select (select count(*) from public.personagens) as personagens_restantes,
       (select count(*) from public.contas) as contas;
