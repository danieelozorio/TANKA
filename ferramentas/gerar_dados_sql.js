// Copia para o banco (supabase/schema.sql) as tabelas do jogo que o servidor precisa para calcular
// a força dos personagens na Arena: armaduras, joias, encantamento, raridades, classes e ARENA.
// Uso: node ferramentas/gerar_dados_sql.js   (reescreve o bloco entre as marcas no schema)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const raiz = path.join(__dirname, '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz, 'js', 'dados.js'), 'utf8'), ctx);
const D = vm.runInContext('Tanka.dados', ctx);
const dados = {
  HP_INICIAL: D.HP_INICIAL, HP_POR_NIVEL: D.HP_POR_NIVEL, HP_POR_RES: D.HP_POR_RES, VELOCIDADE: D.VELOCIDADE,
  raridades: Object.fromEntries(Object.entries(D.raridades).map(([k, r]) => [k, { danoMin: r.danoMin, danoMax: r.danoMax }])),
  classes: Object.fromEntries(Object.entries(D.classes).map(([k, c]) => [k, { dano: c.dano }])),
  armaduras: Object.fromEntries(Object.entries(D.armaduras).map(([c, t]) => [c, Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { bonus: v.bonus }]))])),
  joias: Object.fromEntries(Object.entries(D.joias).map(([k, v]) => [k, { bonus: v.bonus }])),
  danoPorNivel: D.encantamento.danoPorNivel, bonusPorNivel: D.encantamento.bonusPorNivel,
  ARENA: D.ARENA,
  ALIANCA: D.ALIANCA,
};
const json = JSON.stringify(dados).replace(/'/g, "''");
const bloco = `-- >>> DADOS DO JOGO (gerado por ferramentas/gerar_dados_sql.js a partir de js/dados.js; não editar à mão)
create or replace function public.tanka_dados() returns jsonb
language sql immutable as $dados$ select '${json}'::jsonb; $dados$;
-- <<< DADOS DO JOGO`;
const arq = path.join(raiz, 'supabase', 'schema.sql');
let sql = fs.readFileSync(arq, 'utf8');
const ini = sql.indexOf('-- >>> DADOS DO JOGO'), fim = sql.indexOf('-- <<< DADOS DO JOGO');
if (ini >= 0 && fim > ini) sql = sql.slice(0, ini) + bloco + sql.slice(fim + '-- <<< DADOS DO JOGO'.length);
else sql = sql.trimEnd().replace(/notify pgrst, 'reload schema';\s*$/, '') + '\n' + bloco + "\n\nnotify pgrst, 'reload schema';\n";
fs.writeFileSync(arq, sql);
console.log('schema.sql atualizado (' + json.length + ' caracteres de dados)');
