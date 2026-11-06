// Copia para o banco (supabase/schema.sql) as tabelas do jogo que o servidor precisa para calcular
// a força dos personagens na Arena: armaduras, joias, encantamento, raridades, classes, ARENA e habilidades.
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
  HP_INICIAL: D.HP_INICIAL, HP_POR_NIVEL: D.HP_POR_NIVEL, HP_POR_RES: D.HP_POR_RES, RES_SEM_VIDA: D.RES_SEM_VIDA, VELOCIDADE: D.VELOCIDADE,
  racas: Object.fromEntries(Object.entries(D.racas).map(([k, r]) => [k, { tracos: r.tracos || {} }])),
  classesAtributos: Object.fromEntries(Object.entries(D.classes).map(([k, c]) => [k, c.atributos])),
  raridades: Object.fromEntries(Object.entries(D.raridades).map(([k, r]) => [k, { danoMin: r.danoMin, danoMax: r.danoMax }])),
  classes: Object.fromEntries(Object.entries(D.classes).map(([k, c]) => [k, { dano: c.dano, atributoDano: c.atributoDano }])),
  PONTOS_POR_DANO: D.PONTOS_POR_DANO,
  TIPOS_ARMA: Object.fromEntries(Object.entries(D.TIPOS_ARMA).map(([k, t]) => [k, { vel: t.vel, fator: t.fator }])),
  VELOCIDADE_ARMA: D.VELOCIDADE_ARMA, ARMA_PADRAO: D.ARMA_PADRAO, RARIDADE_ARMA: D.RARIDADE_ARMA,
  MAO_ESQUERDA: Object.fromEntries(Object.entries(D.MAO_ESQUERDA).map(([k, m]) => [k, { bonus: m.bonus, encanto: m.encanto }])),
  armaduras: Object.fromEntries(Object.entries(D.armaduras).map(([c, t]) => [c, Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { bonus: v.bonus }]))])),
  joias: Object.fromEntries(Object.entries(D.joias).map(([k, v]) => [k, { bonus: v.bonus }])),
  bonusPorNivel: D.encantamento.bonusPorNivel,
  encantoPct: D.encantamento.pctPorNivel,
  ARENA: D.ARENA,
  ALIANCA: D.ALIANCA,
  CONJUNTOS: Object.fromEntries(Object.entries(D.CONJUNTOS).map(([k, c]) => [k, { bonus: c.bonus }])),
  LEILAO: D.LEILAO,
  DEFESA: D.DEFESA,
  TALENTOS: D.TALENTOS, HABILIDADE_INICIAL: D.HABILIDADE_INICIAL, SEGUNDAS_CLASSES: D.SEGUNDAS_CLASSES,
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
