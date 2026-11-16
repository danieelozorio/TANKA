// Reino do Pesadelo (Henri, nov/2026): mede quantas lutas de 10 um herói vence contra cada chefe do Pesadelo.
// Herói no level do chefe, com TUDO épico +5 do mesmo level (arma, 4 armaduras, mão esquerda, colar e 2 anéis),
// atributos no principal da classe, pontos de habilidade espalhados e 2 poções (bebe com 30% da vida).
// Alvo (pedido do Henri): ~5 de 10 (média das 4 segundas classes do meio; as mais fortes ganham mais). Ajustar `vida`/`dano` em D.PESADELO.chefes.
// Uso: node ferramentas/simular_pesadelo.js [lutas por classe, padrão 80] [raridade] [encanto]
const { D, R, medir, CLASSES } = require('./simular_cacada.js');
const PRINCIPAL = { cavaleiro: ['for', 'res'], arqueiro: ['des', 'res'], mago: ['int', 'res'], artesao: ['for', 'res'] };   // 16/11/2026: atributo da classe + RES

function heroi(classe, classe2, nivel, raridade, encanto) {
  const p = R.criarPersonagem('S', 'masculino', 'humano', classe);
  R.admin.subirNivel(p, nivel - 1);
  let k = 0; while (p.pontosLivres > 0) { R.distribuirPonto(p, PRINCIPAL[classe][k % 3 === 2 ? 1 : 0]); k++; }
  R.escolherSegundaClasse(p, classe2);
  const hs = D.SEGUNDAS_CLASSES[classe2].habilidades.filter((h) => h.tipo !== 'passiva' && (!h.nivel || p.nivel >= h.nivel));
  let g = 0, i = 0; while (R.pontosHabilidadeLivres(p) > 0 && g++ < 400) { R.mudarPontoHabilidade(p, hs[i++ % hs.length].id, 1); }
  p.inventario = []; Object.keys(p.equipados).forEach((x) => { p.equipados[x] = null; });
  R.admin.conjunto(p, raridade);   // conjunto completo do level do herói (como o simular_cacada.js)
  // arma que a segunda classe usa (o Destruidor não usa Espada, por exemplo)
  // (a de duas mãos/própria da segunda classe, se houver: é a que ela foi feita para usar)
  const propria = (D.ARMAS_CLASSE[classe2] || {}).armas || [];
  if (propria.length) p.inventario[0] = R.novoItem('arma', p.classe, raridade, null, propria[0], nivel);
  p.inventario.forEach((it) => { it.encanto = encanto; R.equipar(p, it.id); });
  // arma de duas mãos: a mão esquerda tira a arma; nesse caso fica a arma
  const arma = p.inventario.find((it) => it.tipo === 'arma');
  if (arma && !Object.values(p.equipados).some((e) => e && e.id === arma.id)) R.equipar(p, arma.id);
  p.hpAtual = R.status(p).hpMax;
  return p;
}
module.exports = { heroi };
if (require.main === module) {
  const N = Number(process.argv[2]) || 80, rar = process.argv[3] || 'epica', enc = process.argv[4] != null ? Number(process.argv[4]) : 5;
  D.PESADELO.chefes.forEach((c) => {
    const m = D.monstros[c.id];
    const vs = CLASSES.map(([cl, c2]) => ({ c: c2, r: medir(heroi(cl, c2, c.nivel, rar, enc), c.id, N, 2) }));
    const ord = vs.map((x) => x.r.vit).sort((a, b) => a - b);
    console.log((m.nome + ' (lv ' + c.nivel + ')').padEnd(34) + 'vence ' + Math.round((ord[2] + ord[3] + ord[4] + ord[5]) / 4 * 100) + '%  '
      + vs.map((x) => x.c.slice(0, 5) + ' ' + Math.round(x.r.vit * 100)).join(' ') + '   hp ' + m.hp + ' dano ' + m.ataqueCacada.join('-'));
  });
}
