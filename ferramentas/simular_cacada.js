// Simulação da caçada (vida cheia a cada luta): 3 perfis de herói (fraco, típico, forte) x 8 segundas classes contra os
// 4 monstros de cada área. Mostra a mediana de vitórias (e a 2ª pior classe) e da vida perdida por luta.
// Usado para acertar o `danoCacada` dos monstros (alvo: típico perde ~60% da vida no 3º monstro; forte ~55% no chefe).
// Uso: node ferramentas/simular_cacada.js [lutas por classe, padrão 60]
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.join(__dirname, '..');
function carregar() {
  const ctx = { console }; vm.createContext(ctx);
  ['dados', 'historia', 'regras'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(raiz, 'js', f + '.js'), 'utf8'), ctx));
  return vm.runInContext('Tanka', ctx);
}
const T = carregar(), D = T.dados, R = T.regras;
let s = 12345; const rng = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const PRINCIPAL = { cavaleiro: ['for', 'res'], arqueiro: ['for', 'des'], mago: ['int', 'res'], artesao: ['for', 'sor'] };
// perfis por área: [raridade, encanto, joias?]
const PERFIL = {
  fraco:  { dn: 0, rar: ['comum', 'comum', 'comum', 'comum', 'rara', 'rara', 'epica'], enc: [0, 0, 1, 2, 2, 3, 3], joias: false, pecas: [1, 3, 5, 5, 5, 5, 5] },
  tipico: { dn: 2, rar: ['comum', 'comum', 'rara', 'rara', 'rara', 'epica', 'epica'], enc: [0, 2, 3, 3, 4, 4, 5], joias: true, pecas: [3, 5, 6, 6, 6, 6, 6] },
  forte:  { dn: 4, rar: ['comum', 'rara', 'rara', 'epica', 'epica', 'epica', 'lendaria'], enc: [2, 3, 4, 4, 5, 6, 6], joias: true, pecas: [5, 6, 6, 6, 6, 6, 6] },
};
function heroi(classe, classe2, ia, perfil) {
  const P = PERFIL[perfil], area = D.areas[ia];
  const p = R.criarPersonagem('S', 'masculino', 'humano', classe);
  R.admin.subirNivel(p, area.nivelMin + P.dn - 1);
  let k = 0; while (p.pontosLivres > 0) { R.distribuirPonto(p, PRINCIPAL[classe][k % 3 === 2 ? 1 : 0]); k++; }
  if (classe2 && p.nivel >= 10) {
    R.escolherSegundaClasse(p, classe2);
    const hs = D.SEGUNDAS_CLASSES[classe2].habilidades.filter((h) => h.tipo !== 'passiva' && (!h.nivel || p.nivel >= h.nivel));
    let g = 0, i = 0; while (R.pontosHabilidadeLivres(p) > 0 && g++ < 200) { R.mudarPontoHabilidade(p, hs[i++ % hs.length].id, 1); }
  }
  const inicial = p.inventario.slice();
  p.inventario = []; Object.keys(p.equipados).forEach((x) => { p.equipados[x] = null; });
  R.admin.conjunto(p, P.rar[ia]);
  // ordem: arma, elmo, peitoral, luvas, botas, colar, anel, anel, secundaria
  let itens = p.inventario.slice();
  const arma = itens[0], arm = itens.slice(1, 5), joias = itens.slice(5, 8), sec = itens[8];
  let usar = [arma].concat(arm.slice(0, Math.max(0, P.pecas[ia] - 1)));
  if (P.pecas[ia] >= 6 && sec) usar.push(sec);
  if (P.joias && ia >= 1) usar = usar.concat(joias);
  p.inventario = usar;
  if (ia === 0 && perfil === 'fraco') { p.inventario = inicial; }
  p.inventario.forEach((it) => { it.encanto = P.enc[ia]; R.equipar(p, it.id); });
  p.hpAtual = R.status(p).hpMax;
  return p;
}
function lutar(p, id, pocoes) {
  p.hpAtual = R.status(p).hpMax; p.pocoes = pocoes || 0;
  const b = R.iniciarBatalha(p, id, rng);
  let k = 0; while (!b.fim && k++ < 800) { if (pocoes && R.precisaPocao(b, 30)) R.beberPocao(b); R.passo(b); }
  return { venceu: b.fim === 'vitoria', perdido: 1 - Math.max(0, b.jogador.hp) / b.jogador.hpMax, turnos: k };
}
function medir(p, id, n, pocoes) {
  let v = 0, perda = 0, t = 0;
  for (let i = 0; i < n; i++) { const r = lutar(p, id, pocoes); v += r.venceu; perda += Math.min(1, r.perdido); t += r.turnos; }
  return { vit: v / n, perda: perda / n, turnos: t / n };
}
const CLASSES = [['cavaleiro', 'paladino'], ['cavaleiro', 'destruidor'], ['arqueiro', 'cacador'], ['arqueiro', 'assassino'], ['mago', 'bruxo'], ['mago', 'curandeiro'], ['artesao', 'ferreiro'], ['artesao', 'coletor']];
module.exports = { D, R, heroi, medir, CLASSES, PERFIL, rng };
if (require.main === module) {
  const N = Number(process.argv[2]) || 60;
  D.areas.forEach((area, ia) => {
    const ids = area.monstros.map((m) => m.id).concat([area.chefe.id]);
    console.log('\n== ' + area.nome + ' (nv ' + area.nivelMin + ')  dano: ' + ids.map((id) => (D.monstros[id].ataqueCacada || D.monstros[id].ataque).join('-')).join(' | '));
    ['fraco', 'tipico', 'forte'].forEach((perfil) => {
      const linhas = ids.map((id) => {
        const rs = CLASSES.map(([c, c2]) => medir(heroi(c, c2, ia, perfil), id, N));
        const ps = rs.map((r) => r.perda).sort((a, b) => a - b), vs = rs.map((r) => r.vit).sort((a, b) => a - b);
        return Math.round((vs[3] + vs[4]) / 2 * 100) + '%v(min ' + Math.round(vs[1] * 100) + ') ' + Math.round((ps[3] + ps[4]) / 2 * 100) + '%hp';
      });
      const h = heroi('cavaleiro', 'paladino', ia, perfil);
      console.log(perfil.padEnd(7) + 'nv' + String(h.nivel).padEnd(3) + 'hp' + String(R.status(h).hpMax).padEnd(6) + linhas.join(' | '));
    });
  });
}
