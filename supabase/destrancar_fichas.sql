-- Desfaz supabase/trancar_fichas.sql: o jogo volta a poder gravar a ficha direto (a trava de saltos impossíveis continua).
insert into public.ajustes (chave, valor) values ('fichas_trancadas', 'false') on conflict (chave) do update set valor = 'false';
drop policy if exists "personagem: admin salva os seus" on public.personagens;
drop policy if exists "personagem: salvar os seus" on public.personagens;
create policy "personagem: salvar os seus" on public.personagens for update using (auth.uid() = conta_id) with check (auth.uid() = conta_id);
select 'Fichas destrancadas.' as resultado;
