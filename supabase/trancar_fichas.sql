-- Etapa 5 do plano "tudo no servidor" (Henri, nov/2026): o jogador não grava mais a ficha (personagens.dados) direto.
-- Tudo passa pelas funções do servidor (`cacada` e `acao`), que gravam com a chave secreta do projeto.
-- Rodar no SQL Editor do projeto cwlcdeqvwzpveduzhaol SÓ DEPOIS de conferir que as funções já gravam com a chave:
--   select * from public.gravacoes_papel;   -- precisa ter a linha service_role com "ultima" recente (alguém jogou)
-- Para desfazer (se o jogo parar de salvar): rodar supabase/destrancar_fichas.sql.
insert into public.ajustes (chave, valor) values ('fichas_trancadas', 'true') on conflict (chave) do update set valor = 'true';
drop policy if exists "personagem: salvar os seus" on public.personagens;
drop policy if exists "personagem: admin salva os seus" on public.personagens;
-- administradores (painel de testes) continuam gravando os próprios personagens
create policy "personagem: admin salva os seus" on public.personagens for update
  using (auth.uid() = conta_id and public.eh_admin()) with check (auth.uid() = conta_id and public.eh_admin());
select 'Fichas trancadas: só as funções do servidor gravam.' as resultado;
