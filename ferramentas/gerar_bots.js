// Gera supabase/bots.sql: 10 bots por arena (level da faixa e itens da raridade da faixa),
// já colocados na escada da Arena, para testar sem outros jogadores.
// Uso: node ferramentas/gerar_bots.js   (depois rode supabase/bots.sql no SQL Editor)
// Para tirar os bots: supabase/remover_bots.sql
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
['dados', 'regras'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(raiz, 'js', f + '.js'), 'utf8'), ctx));
const { dados: D, regras: R } = vm.runInContext('Tanka', ctx);

let semente = 7;
const rng = () => { semente = (semente * 1664525 + 1013904223) % 4294967296; return semente / 4294967296; };
const sortear = (lista) => lista[Math.floor(rng() * lista.length)];
const NOMES = ['Kaelor', 'Mirena', 'Torvik', 'Selune', 'Draven', 'Ysolde', 'Brannoc', 'Lyria', 'Garrik', 'Nessa', 'Orwin', 'Talia', 'Fenris', 'Isolda',
  'Corvin', 'Aelith', 'Rurik', 'Maeve', 'Thoren', 'Elowen', 'Vargas', 'Sylas', 'Brienne', 'Halvar', 'Liora', 'Ragnar', 'Seraph', 'Joren', 'Kira', 'Doran',
  'Ayla', 'Bjorn', 'Cassia', 'Eldric', 'Freya', 'Gideon', 'Hilda', 'Ivar', 'Juna', 'Lucan'];
const PRINCIPAL = { cavaleiro: ['for', 'res'], arqueiro: ['for', 'des'], mago: ['int', 'res'], artesao: ['for', 'sor'] };
const RARIDADE = { a1: 'comum', a2: 'rara', a3: 'epica', a4: 'lendaria' };
const ENCANTO = { a1: 2, a2: 3, a3: 4, a4: 6 };
const OURO = { a1: [100, 600], a2: [500, 3000], a3: [2000, 12000], a4: [8000, 40000] };
const CONTA = '00000000-0000-4000-8000-00000000b075';

const linhas = [];
let n = 0;
D.ARENA.arenas.forEach((arena) => {
  for (let i = 0; i < 10; i++) {
    const nome = 'Bot' + NOMES[n++];
    const classe = sortear(Object.keys(D.classes));
    const racas = Object.keys(D.racas).filter((r) => D.racas[r].classes.indexOf(classe) >= 0);
    const p = R.criarPersonagem(nome, rng() < 0.5 ? 'masculino' : 'feminino', sortear(racas), classe);
    p.id = 'bot-' + arena.id + '-' + String(i + 1).padStart(2, '0');
    const nivel = arena.nivel[0] + Math.floor(rng() * (arena.nivel[1] - arena.nivel[0] + 1));
    R.admin.subirNivel(p, nivel - 1);
    let k = 0;
    while (p.pontosLivres > 0) { R.distribuirPonto(p, PRINCIPAL[classe][k % 3 === 2 ? 1 : 0]); k++; }
    p.inventario = []; Object.keys(p.equipados).forEach((s) => { p.equipados[s] = null; });
    R.admin.conjunto(p, RARIDADE[arena.id]);
    p.inventario.forEach((it) => { it.encanto = Math.floor(rng() * (ENCANTO[arena.id] + 1)); R.equipar(p, it.id); });
    p.hpAtual = R.status(p).hpMax;
    p.ouro = OURO[arena.id][0] + Math.floor(rng() * (OURO[arena.id][1] - OURO[arena.id][0]));
    p.poder = R.poder(p);
    p.skinDado = sortear(D.SKINS_DADO).id;
    p.bot = true;
    const json = JSON.stringify(p).replace(/'/g, "''");
    linhas.push(`  ('${p.id}', '${nome}', '${json}'::jsonb, '${arena.id}', ${i + 1})`);
  }
});

const sql = `-- Bots de teste da Arena: 10 por arena, gerados por ferramentas/gerar_bots.js.
-- Rode no SQL Editor do Supabase DEPOIS do schema.sql. Rodar de novo recria os bots do zero.
-- Para tirar todos os bots: supabase/remover_bots.sql
do $$ begin
  if not exists (select 1 from auth.users where id = '${CONTA}') then
    insert into auth.users (id, raw_user_meta_data) values ('${CONTA}', '{"usuario":"bots","email":"bots@tanka.invalid"}');
  end if;
end $$;
update public.contas set bot = true where id = '${CONTA}';
delete from public.personagens where conta_id = '${CONTA}';
with novos (id, nome, dados, arena, posicao) as (values
${linhas.join(',\n')}
), inseridos as (
  insert into public.personagens (id, conta_id, nome, dados) select id, '${CONTA}', nome, dados from novos returning id
)
insert into public.arena_posicoes (personagem_id, arena, posicao, entrou_em)
select n.id, n.arena, n.posicao, now() - interval '1 day' + n.posicao * interval '1 second' from novos n join inseridos i on i.id = n.id;
-- Os bots ficam nas primeiras posições; quem já estava desce para depois deles.
update public.arena_posicoes set posicao = posicao + 1000 where personagem_id not like 'bot-%';
select public.arena_compactar(a ->> 'id') from jsonb_array_elements(public.tanka_dados() -> 'ARENA' -> 'arenas') a;
notify pgrst, 'reload schema';
`;
fs.writeFileSync(path.join(raiz, 'supabase', 'bots.sql'), sql);
fs.writeFileSync(path.join(raiz, 'supabase', 'remover_bots.sql'), `-- Tira todos os bots de teste (personagens, posições na Arena e lutas deles somem junto).
delete from public.personagens where conta_id = '${CONTA}';
select public.arena_compactar(a ->> 'id') from jsonb_array_elements(public.tanka_dados() -> 'ARENA' -> 'arenas') a;
`);
console.log('supabase/bots.sql com ' + linhas.length + ' bots');
