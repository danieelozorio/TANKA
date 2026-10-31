-- Tira todos os bots de teste (personagens, posições na Arena e lutas deles somem junto).
delete from public.personagens where conta_id = '00000000-0000-4000-8000-00000000b075';
select public.arena_compactar(a ->> 'id') from jsonb_array_elements(public.tanka_dados() -> 'ARENA' -> 'arenas') a;
