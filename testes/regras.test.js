// Testes das regras do Tanka. Rodar com: node testes/regras.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
['dados.js', 'regras.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx));
const { dados: D, regras: R } = vm.runInContext('Tanka', ctx);
D.HABILIDADES_ATIVAS = true; // os testes de habilidade continuam valendo para quando religar

const fixo = (v) => () => v; // rng que sempre devolve v (0 = sucesso, 0.999 = falha)
const fixo0 = fixo(0);
let rngSeed = 42;
function rng() { rngSeed = (rngSeed * 1664525 + 1013904223) % 4294967296; return rngSeed / 4294967296; }

function teste(nome, fn) {
  try { fn(); console.log('ok   ' + nome); } catch (e) { console.log('FALHA ' + nome + '\n     ' + e.message); process.exitCode = 1; }
}

teste('atributos iniciais das classes humanas', () => {
  assert.deepStrictEqual({ ...R.atributosIniciais('humano', 'cavaleiro') }, { for: 15, des: 10, res: 20, int: 10, sor: 10 });
  assert.deepStrictEqual({ ...R.atributosIniciais('humano', 'arqueiro') }, { for: 15, des: 20, res: 10, int: 10, sor: 20 });
  assert.deepStrictEqual({ ...R.atributosIniciais('humano', 'mago') }, { for: 10, des: 15, res: 10, int: 20, sor: 10 });
  assert.deepStrictEqual({ ...R.atributosIniciais('humano', 'artesao') }, { for: 15, des: 10, res: 15, int: 10, sor: 20 });
});

teste('modificadores de raça (+3 / -3)', () => {
  assert.deepStrictEqual({ ...R.atributosIniciais('elfo', 'mago') }, { for: 7, des: 18, res: 7, int: 23, sor: 10 });
  assert.deepStrictEqual({ ...R.atributosIniciais('elfoNegro', 'cavaleiro') }, { for: 18, des: 10, res: 17, int: 13, sor: 7 });
  assert.deepStrictEqual({ ...R.atributosIniciais('orc', 'cavaleiro') }, { for: 18, des: 7, res: 23, int: 7, sor: 10 });
  assert.deepStrictEqual({ ...R.atributosIniciais('anao', 'artesao') }, { for: 15, des: 7, res: 18, int: 7, sor: 23 });
});

teste('personagem novo: level 1, 100 HP, 0 de ouro, arma comum 1-5', () => {
  const p = R.criarPersonagem('Teste', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(p.nivel, 1);
  assert.strictEqual(R.status(p).hpMax, 100);
  assert.strictEqual(p.hpAtual, 100);
  assert.strictEqual(p.ouro, 0);
  assert.strictEqual(p.sexo, 'masculino');
  const arma = R.armaEquipada(p);
  assert.strictEqual(R.nomeArma(arma), 'Espada de Ferro');
  assert.deepStrictEqual([...arma.dano], [1, 5]);
  assert.strictEqual(R.nomeArma(R.armaEquipada(R.criarPersonagem('a', 'masculino', 'humano', 'artesao'))), 'Martelo de Batalha');
});

teste('exp necessária: 10, 20, 40, 80, 160', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(R.expNecessaria), [10, 20, 40, 80, 160]);
});

teste('level up dá 3 pontos e cura; vários levels de uma vez', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.hpAtual = 10;
  assert.strictEqual(R.ganharExp(p, 8), 0);
  assert.strictEqual(R.ganharExp(p, 2), 1);
  assert.strictEqual(p.nivel, 2); assert.strictEqual(p.exp, 0); assert.strictEqual(p.pontosLivres, 3);
  assert.strictEqual(p.hpAtual, R.status(p).hpMax);
  assert.strictEqual(R.ganharExp(p, 20 + 40 + 5), 2);
  assert.strictEqual(p.nivel, 4); assert.strictEqual(p.exp, 5); assert.strictEqual(p.pontosLivres, 9);
});

teste('lobo: 5 lobos (2 exp cada) sobem para o level 2', () => {
  assert.strictEqual(D.monstros.lobo.exp, 2);
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  for (let i = 0; i < 5; i++) R.ganharExp(p, D.monstros.lobo.exp);
  assert.strictEqual(p.nivel, 2);
});

teste('cobra = 2x lobo, urso = 2x cobra (vida e exp); dano em faixa', () => {
  const { lobo, cobra, urso } = D.monstros;
  for (const [a, b] of [[lobo, cobra], [cobra, urso]]) {
    assert.strictEqual(b.hp, a.hp * 2); assert.strictEqual(b.exp, a.exp * 2);
  }
  assert.deepStrictEqual([...lobo.ataque, ...cobra.ataque, ...urso.ataque, ...D.monstros.velgrath.ataque], [3, 5, 4, 6, 5, 8, 8, 10]);
  assert.deepStrictEqual(['sapo', 'aranha', 'troll', 'morgath'].map((m) => [...D.monstros[m].ataque]), [[10, 15], [15, 20], [18, 22], [25, 30]]);
});

teste('velocidade e defesa dos monstros: 15, +10% por monstro, +10% entre áreas; chefe +50% / defesa x2', () => {
  const v = (id) => D.monstros[id].velocidade, d = (id) => D.monstros[id].defesa;
  assert.deepStrictEqual(['lobo', 'cobra', 'urso', 'velgrath'].map(v), [15, 17, 18, 18]);   // chefe: velocidade do 3º monstro
  assert.strictEqual(v('sapo'), Math.round(15 * 1.1 * 1.1 * 1.1));
  assert.strictEqual(d('lobo'), 1);
  assert.strictEqual(d('velgrath'), d('urso') * 2);
  assert.ok(d('salamandra') > 20 && d('ignaroth') < 100, d('salamandra') + ' ' + d('ignaroth'));
  const urso = D.monstros.urso, chefe = D.monstros.velgrath;
  assert.strictEqual(chefe.hp, urso.hp * 1.5);
  assert.strictEqual(chefe.exp, urso.exp * 5);
});

teste('velocidade do personagem: 15 no level 1, +6% por level; não depende da DES', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  assert.strictEqual(R.status(p).velocidade, 15);
  p.atributos.des += 50;
  assert.strictEqual(R.status(p).velocidade, 15);
  assert.deepStrictEqual([10, 20, 30, 40].map(R.velocidadeDoNivel), [25, 45, 81, 146]);
});

teste('o monstro sempre dá o primeiro golpe', () => {
  for (let i = 0; i < 20; i++) {
    const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
    p.nivel = 40;
    const b = R.iniciarBatalha(p, 'lobo', rng);
    assert.strictEqual(R.passo(b).ator, 'monstro');
  }
});

teste('defesa do monstro reduz o dano em porcentagem', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const b = R.iniciarBatalha(p, 'ignaroth', fixo0);
  b.lutador.kit = [];
  b.s = Object.assign({}, b.s, { dano: [100, 100], precisao: 200, chanceCritico: 0 });
  b.monstro.hp = 1e9; b.jogador.barra = 100; b.monstro.barra = 0;
  const ev = R.passo(b);
  assert.strictEqual(ev.dano, Math.round(100 * 100 / (100 + D.monstros.ignaroth.defesa)));
});

teste('distribuir ponto em RES aumenta o HP máximo e atual', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.pontosLivres = 1;
  assert.ok(R.distribuirPonto(p, 'res'));
  assert.strictEqual(p.atributos.res, 21);
  assert.strictEqual(R.status(p).hpMax, 103);   // +3 de vida por ponto de RES
  assert.strictEqual(p.hpAtual, 103);
  assert.ok(!R.distribuirPonto(p, 'res'));
});

teste('velocidade: 30 contra 15 ataca 2x mais', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const b = R.iniciarBatalha(p, 'lobo', rng);
  b.jogador.vel = 30; b.monstro.vel = 15; b.jogador.hp = 1e9; b.monstro.hp = 1e9;
  const conta = { jogador: 0, monstro: 0 };
  for (let i = 0; i < 3000; i++) conta[R.passo(b).ator]++;
  assert.ok(Math.abs(conta.jogador / conta.monstro - 2) < 0.01, JSON.stringify(conta));
});

teste('velocidade 20 vs 10: 2 ataques para 1', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const b = R.iniciarBatalha(p, 'lobo', rng);
  b.jogador.vel = 10; b.monstro.vel = 20; b.jogador.hp = 1e9; b.monstro.hp = 1e9;
  const atores = Array.from({ length: 30 }, () => R.passo(b).ator);
  assert.strictEqual(atores.filter((a) => a === 'monstro').length, 20);
});

teste('drops da caçada (sem sorte): 1º monstro 5%, 2º 8%, 3º 10% de arma e de armadura; pergaminho só no 3º (5%)', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.atributos.sor = 0;
  assert.strictEqual(R.status(p).bonusDrop, 0);
  const N = 200000, taxa = (fn) => { let n = 0; for (let i = 0; i < N; i++) if (fn()) n++; return n / N * 100; };
  const esperado = [[5, 5, 0], [8, 8, 0], [10, 10, 5]];
  D.areas.forEach((area) => area.monstros.forEach((mm, i) => {
    const m = D.monstros[mm.id];
    assert.strictEqual(m.chanceArma, esperado[i][0], mm.id);
    assert.strictEqual(m.chanceArmadura, esperado[i][1], mm.id);
    assert.strictEqual(m.pergaminho ? m.pergaminho.chance : 0, esperado[i][2], mm.id);
    assert.strictEqual(R.rolarDropItem(p, mm.id, rng), null, 'não existe mais "qualquer item"');
  }));
  for (const [id, arma, perg] of [['lobo', 5, 0], ['aranha', 8, 0], ['urso', 10, 5], ['elemental', 10, 5]]) {
    const t = taxa(() => R.rolarDrop(p, id, rng));
    assert.ok(Math.abs(t - arma) < 0.3, id + ' arma ' + t);
    const ta = taxa(() => R.rolarDropArmadura(p, id, rng));
    assert.ok(Math.abs(ta - arma) < 0.3, id + ' armadura ' + ta);
    const tp = taxa(() => R.rolarPergaminho(p, id, rng));
    assert.ok(Math.abs(tp - perg) < 0.3, id + ' pergaminho ' + tp);
  }
  // A Sorte aumenta a chance de cair (20 de SOR = +20%: 5% vira 6%)
  p.atributos.sor = 20;
  const comSorte = taxa(() => R.rolarDrop(p, 'lobo', rng));
  assert.ok(Math.abs(comSorte - 5 * (1 + R.status(p).bonusDrop / 100)) < 0.3, 'com sorte ' + comSorte);
});

teste('qualidade dos drops da caçada: 70% comum, 22% rara, 7% épica, 1% lendária (em qualquer área, a Sorte não muda)', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const contar = (fn, n) => { const c = { comum: 0, rara: 0, epica: 0, lendaria: 0 }; let t = 0;
    while (t < n) { const r = fn(); if (r) { c[r.raridade || r] += 1; t++; } } return c; };
  const pct = (c, n) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / n * 100]));
  const alvo = { comum: 70, rara: 22, epica: 7, lendaria: 1 };
  const confere = (c, n, nome) => { const x = pct(c, n); for (const k in alvo) assert.ok(Math.abs(x[k] - alvo[k]) < 0.8, nome + ' ' + JSON.stringify(x)); };
  const N = 20000;
  p.atributos.sor = 0;
  confere(contar(() => R.rolarDrop(p, 'lobo', rng), N), N, 'arma lobo');
  confere(contar(() => R.rolarDropArmadura(p, 'lobo', rng), N), N, 'armadura lobo');
  p.atributos.sor = 60;
  confere(contar(() => R.rolarDrop(p, 'salamandra', rng), N), N, 'arma salamandra com sorte');
  confere(contar(() => R.rolarPergaminho(p, 'urso', rng), N), N, 'pergaminho urso');
  // lendária já na primeira área
  let lend = null; for (let i = 0; i < 400000 && !lend; i++) { const d = R.rolarDrop(p, 'lobo', rng); if (d && d.raridade === 'lendaria') lend = d; }
  assert.ok(lend && lend.classe === 'cavaleiro', 'arma lendária pode cair do Lobo');
});

teste('drop de arma é sempre da classe, com variação e dano sorteados na faixa', () => {
  for (const classe of ['cavaleiro', 'arqueiro', 'mago', 'artesao']) {
    const p = R.criarPersonagem('T', 'masculino', 'humano', classe);
    let d = null;
    while (!d || d.raridade !== 'rara') d = R.rolarDrop(p, 'gargula', rng);
    assert.strictEqual(d.classe, classe);
    assert.strictEqual(d.raridade, 'rara');
    assert.ok(d.nivel >= 1 && d.nivel <= 4, 'nível do herói (1) até +3');
    assert.ok(d.qualidade >= 0.4 && d.qualidade <= 0.7, 'rara: qualidade de 40% a 70%');
    assert.strictEqual(JSON.stringify(d.dano), JSON.stringify(R.danoDoNivel(d.nivel, d.qualidade)));
    assert.ok(D.armas[classe].rara[d.variacao]);
  }
  const nomes = new Set();
  for (let i = 0; i < 400; i++) nomes.add(R.nomeArma(R.novaArma('mago', 'lendaria')));
  assert.strictEqual(nomes.size, 8);
});

teste('sorte: 1% de encantamento por ponto', () => {
  const p = R.criarPersonagem('T', 'masculino', 'anao', 'artesao');
  assert.strictEqual(R.status(p).chanceEncantamento, 23);
});

teste('mago causa dano mágico com INT', () => {
  const p = R.criarPersonagem('T', 'masculino', 'elfo', 'mago');
  const s = R.status(p);
  assert.strictEqual(s.tipoDano, 'magico');
  assert.deepStrictEqual([...s.dano], [Math.round((1 + Math.floor(23 / 3)) * 1.4), Math.round((5 + Math.floor(23 / 3)) * 1.4)]);   // (cajado + 1 a cada 3 de INT) x1,4
  assert.strictEqual(s.chanceCriticoMagico, R.atributosTotais(p).sor, 'crítico mágico: 1% por ponto de Sorte');
});

teste('batalha completa contra o lobo termina e aplica resultado', () => {
  let vitorias = 0;
  for (let i = 0; i < 200; i++) {
    const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
    const b = R.iniciarBatalha(p, 'lobo', rng);
    let passos = 0;
    while (!b.fim) { R.passo(b); passos++; assert.ok(passos < 10000); }
    const r = R.concluirBatalha(p, b);
    if (r.resultado === 'vitoria') { vitorias++; assert.strictEqual(p.exp, 2); assert.strictEqual(p.ouro, 2); assert.strictEqual(r.ouro, 2); assert.strictEqual(p.abates.lobo, 1); }
    if (r.drop) assert.strictEqual(r.drop.classe, 'cavaleiro');
  }
  assert.ok(vitorias > 190, 'vitórias: ' + vitorias);
});

teste('equipar só aceita arma da própria classe', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  p.inventario.push({ id: 'x', tipo: 'arma', classe: 'cavaleiro', raridade: 'epica' });
  assert.ok(!R.equipar(p, 'x'));
  p.inventario.push({ id: 'y', tipo: 'arma', classe: 'mago', raridade: 'rara' });
  assert.ok(R.equipar(p, 'y'));
});

teste('raridades: faixas de dano e preços de compra e venda', () => {
  const tab = (k) => [...D.raridades[k].danoMin, ...D.raridades[k].danoMax, D.raridades[k].venda, D.raridades[k].compra];
  assert.deepStrictEqual(tab('comum'), [1, 5, 5, 10, 20, 100]);
  assert.deepStrictEqual(tab('rara'), [11, 15, 16, 20, 200, 1000]);
  assert.deepStrictEqual(tab('epica'), [21, 24, 25, 30, 1000, 5000]);
  assert.deepStrictEqual(tab('lendaria'), [31, 34, 35, 40, 2000, 10000]);
  for (const c of Object.keys(D.classes)) for (const r of Object.keys(D.raridades)) assert.strictEqual(D.armas[c][r].length, 8, c + ' ' + r);
});

teste('ouro dos monstros e dos chefes com valor próprio', () => {
  const ouro = (ids) => ids.map((m) => D.monstros[m].ouro);
  assert.deepStrictEqual(ouro(['lobo', 'cobra', 'urso', 'velgrath']), [2, 5, 8, 20]);
  assert.deepStrictEqual(ouro(['sapo', 'aranha', 'troll']), [12, 20, 30]);
  assert.deepStrictEqual(ouro(['esqueleto', 'goblin', 'gargula', 'varnok']), [40, 60, 80, 200]);
  assert.deepStrictEqual(ouro(['golem', 'cultista', 'espectro']), [100, 150, 200]);
  assert.strictEqual(D.monstros.velgrath.exp, 40);
});

teste('vender: dá ouro e remove o item; arma equipada não pode', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  assert.ok(!R.vender(p, p.equipados.arma));
  p.inventario.push({ id: 'e', tipo: 'arma', classe: 'arqueiro', raridade: 'epica' });
  assert.ok(R.vender(p, 'e'));
  assert.strictEqual(p.ouro, 1000);
  assert.strictEqual(p.inventario.length, 1);
});

teste('comprar: desconta o ouro e só com saldo suficiente', () => {
  const p = R.criarPersonagem('T', 'feminino', 'elfo', 'arqueiro');
  p.ouro = 1090;
  const item = R.comprar(p, 'rara');
  assert.strictEqual(typeof item, 'object');
  assert.strictEqual(item.classe, 'arqueiro');
  assert.ok(D.armas.arqueiro.rara.includes(R.nomeArma(item)));
  assert.ok(item.dano[0] >= 11 && item.dano[1] <= 20);
  assert.strictEqual(p.ouro, 90);
  assert.strictEqual(R.comprar(p, 'comum'), 'Ouro insuficiente.');
  assert.strictEqual(p.ouro, 90);
});

teste('comprar lendário: pede 10.000 de ouro e 300 de reputação', () => {
  const p = R.criarPersonagem('T', 'feminino', 'elfo', 'arqueiro');
  p.ouro = 10000; p.reputacao = 299;
  assert.strictEqual(R.comprar(p, 'lendaria'), 'Reputação insuficiente.');
  assert.deepStrictEqual([p.ouro, p.reputacao], [10000, 299]);
  p.reputacao = 350;
  assert.strictEqual(typeof R.comprar(p, 'lendaria', 'elmo'), 'object');
  assert.deepStrictEqual([p.ouro, p.reputacao], [0, 50]);
});

teste('personagem antigo (sem ouro/sexo, arma "basica") é convertido', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  delete p.ouro; delete p.sexo; p.inventario[0].raridade = 'basica';
  R.normalizar(p);
  assert.strictEqual(p.ouro, 0);
  assert.strictEqual(p.sexo, 'masculino');
  assert.strictEqual(p.inventario[0].raridade, 'comum');
  assert.deepStrictEqual([...R.status(p).danoArma], [1, 7]);   // cajado: duas mãos, dano x1,4
  // arma antiga sem dano sorteado: nome clássico e dano no meio das faixas
  p.inventario.push({ id: 'velha', tipo: 'arma', classe: 'mago', raridade: 'epica', encanto: 0 });
  R.normalizar(p);
  const velha = p.inventario.find((i) => i.id === 'velha');
  assert.strictEqual(R.nomeArma(velha), 'Cajado do Vazio Estelar');
  assert.deepStrictEqual([...velha.dano], [23, 28]);
});

// ---------- Encantamento ----------
function comArma(raridade, encanto) {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  p.atributos.sor = 0;
  const item = { id: 'x', tipo: 'arma', classe: 'arqueiro', raridade, encanto };
  p.inventario.push(item);
  p.pergaminhos[raridade] = 5;
  return { p, item };
}

teste('encantamento: +1 a +3 é seguro e gasta 1 pergaminho', () => {
  const { p, item } = comArma('rara', 0);
  for (let i = 0; i < 3; i++) assert.ok(R.encantar(p, 'x', fixo(0.999)).sucesso);
  assert.strictEqual(item.encanto, 3);
  assert.strictEqual(p.pergaminhos.rara, 2);
});

teste('encantamento: chances por nível e bônus de Sorte com teto de 95%', () => {
  const { p, item } = comArma('rara', 3);
  assert.deepStrictEqual([3, 4, 5, 6, 7, 8, 9].map((e) => { item.encanto = e; return R.chanceEncantar(p, item); }), [70, 60, 50, 40, 30, 20, 10]);
  p.atributos.sor = 20; item.encanto = 3;
  assert.strictEqual(R.chanceEncantar(p, item), 90);
  p.atributos.sor = 50;
  assert.strictEqual(R.chanceEncantar(p, item), 95);
});

teste('encantamento: falha até +6 volta para +0; do +7 em diante quebra', () => {
  let { p, item } = comArma('epica', 5);
  const r1 = R.encantar(p, 'x', fixo(0.999));
  assert.ok(!r1.sucesso && !r1.quebrou); assert.strictEqual(item.encanto, 0);
  ({ p, item } = comArma('epica', 6));
  p.equipados.arma = 'x';
  const r2 = R.encantar(p, 'x', fixo(0.999));
  assert.ok(r2.quebrou);
  assert.ok(!p.inventario.some((i) => i.id === 'x'));
  assert.strictEqual(p.equipados.arma, null);
});

teste('encantamento: +5% de dano por nível e venda +20% por nível', () => {
  assert.deepStrictEqual([...R.danoArma({ tipo: 'arma', classe: 'arqueiro', raridade: 'rara', encanto: 5, dano: [12, 18] })], [15, 23]);
  assert.deepStrictEqual([...R.danoArma({ tipo: 'arma', classe: 'arqueiro', raridade: 'lendaria', encanto: 10, dano: [33, 39] })], [50, 59]);
  assert.strictEqual(R.precoVenda({ tipo: 'arma', classe: 'arqueiro', raridade: 'epica', encanto: 5 }), 2000);
  assert.strictEqual(R.nomeArma({ tipo: 'arma', classe: 'arqueiro', raridade: 'rara', encanto: 5, variacao: 0 }), '+5 Arco Élfico');
});

teste('encantamento: sem pergaminho ou no +10 não tenta', () => {
  let { p } = comArma('comum', 10);
  assert.strictEqual(R.encantar(p, 'x', fixo(0)), null);
  ({ p } = comArma('comum', 0));
  p.pergaminhos.comum = 0;
  assert.strictEqual(R.encantar(p, 'x', fixo(0)), null);
});

teste('pergaminhos: preço por raridade e drop do urso (5%)', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  p.ouro = 1050;
  assert.ok(R.comprarPergaminho(p, 'rara')); assert.strictEqual(p.ouro, 50);
  assert.ok(!R.comprarPergaminho(p, 'rara'));
  p.atributos.sor = 0;
  let n = 0; const N = 100000;
  for (let i = 0; i < N; i++) {
    p.nivel = 1; p.exp = 0;   // sem subir de level (acima da área não cai nada)
    const b = R.iniciarBatalha(p, 'urso', rng); b.fim = 'vitoria';
    if (R.concluirBatalha(p, b).pergaminho) n++;
  }
  assert.ok(Math.abs(n / N * 100 - 5) < 0.4, 'taxa ' + n / N * 100);
});

teste('admin: ouro, level, armas e pergaminhos', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  R.admin.ouro(p, 10000);
  assert.strictEqual(p.ouro, 10000);
  R.admin.subirNivel(p, 5);
  assert.strictEqual(p.nivel, 6); assert.strictEqual(p.exp, 0); assert.strictEqual(p.pontosLivres, 15);
  R.admin.armas(p, 7);
  assert.strictEqual(p.inventario.length, 5);
  assert.ok(p.inventario.slice(1).every((i) => i.classe === 'cavaleiro' && i.encanto === 7));
  R.admin.pergaminhos(p, 10);
  assert.deepStrictEqual({ ...p.pergaminhos }, { comum: 10, rara: 10, epica: 10, lendaria: 10 });
});

// ---------- Armaduras e equipamento ----------

teste('armaduras: nomes e bônus por classe e raridade', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const it = (tipo, rar, classe = 'cavaleiro', encanto = 0) => ({ id: tipo + rar, tipo, classe, raridade: rar, encanto });
  assert.strictEqual(R.nomeItem(it('luvas', 'epica')), 'Manoplas do Crepúsculo');
  assert.strictEqual(R.nomeItem(it('elmo', 'lendaria', 'mago', 3)), '+3 Chapéu da Origem');
  assert.strictEqual(R.nomeItem({ tipo: 'anel', classe: null, raridade: 'rara', encanto: 0 }), 'Anel de Prata');
  assert.deepStrictEqual({ ...R.bonusItem(it('peitoral', 'rara')) }, { defesa: 8, vida: 40 });
  assert.deepStrictEqual({ ...R.bonusItem(it('peitoral', 'rara', 'mago')) }, { defesa: 3, defesaMagica: 5, vida: 15 });
  assert.deepStrictEqual({ ...R.bonusItem(it('botas', 'comum', 'cavaleiro', 4)) }, { defesa: 5, res: 1 });
  assert.deepStrictEqual({ ...R.bonusItem({ tipo: 'anel', classe: null, raridade: 'epica', encanto: 2 }) }, { sor: 6 });
  assert.deepStrictEqual({ ...R.bonusItem({ tipo: 'colar', classe: null, raridade: 'comum', encanto: 1 }) }, { defesaMagica: 2, vida: 5 });
});

teste('equipar armaduras soma defesa, vida e atributos no status', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const s0 = R.status(p);
  const add = (tipo, rar, classe = 'cavaleiro') => { const i = { id: tipo + rar + Math.random(), tipo, classe, raridade: rar, encanto: 0 }; p.inventario.push(i); return i; };
  assert.strictEqual(R.equipar(p, add('peitoral', 'rara').id), 'peitoral');
  assert.strictEqual(R.equipar(p, add('botas', 'epica').id), 'botas'); // Grevas: +6 def, +4 RES
  assert.strictEqual(R.equipar(p, add('anel', 'comum', null).id), 'anel1');
  assert.strictEqual(R.equipar(p, add('anel', 'comum', null).id), 'anel2');
  const s1 = R.status(p);
  assert.strictEqual(s1.defesa, s0.defesa + 8 + 6);
  assert.strictEqual(s1.hpMax, s0.hpMax + 40 + 4 * 3); // vida do peitoral + 4 RES * 3 HP
  assert.strictEqual(R.atributosTotais(p).sor, p.atributos.sor + 2);
  assert.strictEqual(s1.chanceCritico, (p.atributos.sor + 2 + p.atributos.des) * 0.5);   // Sorte e Destreza
});

teste('equipar: só armadura da própria classe; joia serve para todos', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  p.inventario.push({ id: 'a', tipo: 'elmo', classe: 'cavaleiro', raridade: 'comum', encanto: 0 });
  p.inventario.push({ id: 'b', tipo: 'colar', classe: null, raridade: 'comum', encanto: 0 });
  assert.strictEqual(R.equipar(p, 'a'), false);
  assert.strictEqual(R.equipar(p, 'b'), 'colar');
});

teste('trocar e desequipar: item volta para a mochila; vida se ajusta', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.inventario.push({ id: 'p1', tipo: 'peitoral', classe: 'cavaleiro', raridade: 'comum', encanto: 0 });
  p.inventario.push({ id: 'p2', tipo: 'peitoral', classe: 'cavaleiro', raridade: 'lendaria', encanto: 0 });
  R.equipar(p, 'p1');
  R.equipar(p, 'p2');
  assert.strictEqual(p.equipados.peitoral, 'p2');
  assert.ok(R.mochila(p).some((i) => i.id === 'p1'));
  assert.strictEqual(p.hpAtual, 100 + 250);
  assert.ok(R.desequipar(p, 'peitoral'));
  assert.strictEqual(p.equipados.peitoral, null);
  assert.strictEqual(p.hpAtual, 100);
  assert.ok(!R.vender(p, p.equipados.arma));
});

teste('mochila: limite de 32 bloqueia compra, drop e desequipar', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  p.ouro = 1e6;
  for (let i = 0; i < 32; i++) assert.strictEqual(typeof R.comprar(p, 'comum', 'botas'), 'object');
  assert.ok(R.mochilaCheia(p));
  assert.strictEqual(R.comprar(p, 'comum', 'elmo'), 'Mochila cheia!');
  assert.ok(!R.desequipar(p, 'arma'));
  p.atributos.sor = 1000; // garante drop
  const b = R.iniciarBatalha(p, 'urso', rng); b.fim = 'vitoria';
  const res = R.concluirBatalha(p, b);
  assert.ok(res.mochilaCheia);
  assert.strictEqual(R.mochila(p).length, 32);
});

teste('drops de armadura: peças da classe ou a mão esquerda (sem colar e anel)', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'artesao');
  const tipos = new Set(); for (let i = 0; i < 20000; i++) { const d = R.rolarDropArmadura(p, 'cobra', rng); if (d) { tipos.add(d.tipo); if (d.tipo === 'secundaria') assert.strictEqual(d.mao, 'manopla'); else assert.strictEqual(d.classe, 'artesao'); } }
  assert.deepStrictEqual([...tipos].sort(), ['botas', 'elmo', 'luvas', 'peitoral', 'secundaria']);
});

teste('encantar armadura equipada que quebra libera o espaço', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.inventario.push({ id: 'e', tipo: 'elmo', classe: 'cavaleiro', raridade: 'rara', encanto: 6 });
  R.equipar(p, 'e');
  p.pergaminhos.rara = 1;
  assert.ok(R.encantar(p, 'e', () => 0.999).quebrou);
  assert.strictEqual(p.equipados.elmo, null);
  assert.ok(p.hpAtual <= R.status(p).hpMax);
});

teste('personagem antigo com armaEquipada vira equipados.arma', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  p.armaEquipada = p.equipados.arma; delete p.equipados; delete p.inventario[0].tipo;
  R.normalizar(p);
  assert.strictEqual(p.equipados.arma, p.inventario[0].id);
  assert.strictEqual(p.inventario[0].tipo, 'arma');
  assert.ok(!('armaEquipada' in p));
});

// ---------- Áreas, chefes e curva de level ----------

teste('curva de level: dobra até o 5, depois +50% por level; máximo 40', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 10].map(R.expNecessaria), [10, 20, 40, 80, 160, 240, 360, 540, 1215]);
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  R.admin.subirNivel(p, 100);
  assert.strictEqual(p.nivel, D.NIVEL_MAXIMO);
  R.ganharExp(p, 1e12);
  assert.strictEqual(p.nivel, 40); assert.strictEqual(p.exp, 0);
});

teste('áreas: 7 áreas, vida e exp dobram (Floresta dobra o ataque), chefe pela regra', () => {
  assert.strictEqual(D.areas.length, 7);
  for (const a of D.areas) {
    const [m1, m2, m3] = a.monstros.map((m) => D.monstros[m.id]);
    const aj = a.ajusteVida || 1;
    assert.strictEqual(m1.hp, Math.round(a.base.hp * aj)); assert.strictEqual(m1.exp, a.base.exp);
    const cr = a.crescimento || D.crescimento;
    [m1, m2, m3].forEach((m, i) => {
      assert.strictEqual(m.hp, Math.round(a.base.hp * 2 ** i * aj)); assert.strictEqual(m.exp, a.base.exp * 2 ** i);
      assert.ok(m.ataque[0] < m.ataque[1], 'dano em faixa');
    });
    assert.ok(m1.velocidade < m2.velocidade && m2.velocidade < m3.velocidade);
    const c = D.monstros[a.chefe.id];
    assert.ok(c.chefe);
    assert.strictEqual(c.hp, Math.round(m3.hp * 1.5)); assert.ok(c.ataque[0] > m3.ataque[0]);
    assert.ok(Math.abs(c.velocidade - m3.velocidade) <= 1); assert.strictEqual(c.exp, a.chefe.exp != null ? a.chefe.exp : m3.exp * 5);
    assert.strictEqual(c.ouro, a.chefe.ouro != null ? a.chefe.ouro : m3.ouro * 5);
  }
  assert.deepStrictEqual(['sapo', 'troll', 'elemental'].map((k) => D.monstros[k].hp), [112, 448, 2970]);   // com o ajusteVida da área
  assert.deepStrictEqual(['sapo', 'aranha', 'troll'].map((k) => D.monstros[k].ataque[0]), [10, 15, 18]);
  assert.deepStrictEqual([...D.areas.map((a) => a.chanceChefe)], [1, 0.7, 0.5, 0.3, 0.2, 0.15, 0.1]);
});

teste('áreas bloqueadas por level; chefe não pode ser caçado direto', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  assert.ok(R.podeCacar(p, 'lobo'));
  assert.ok(!R.podeCacar(p, 'sapo'));
  assert.ok(!R.podeCacar(p, 'velgrath'));
  R.admin.subirNivel(p, 4);
  assert.strictEqual(p.nivel, 5);
  assert.ok(!R.podeCacar(p, 'sapo'), 'precisa derrotar o urso antes');
  p.abates.urso = 1;
  assert.ok(R.podeCacar(p, 'sapo'));
  assert.ok(!R.podeCacar(p, 'esqueleto'));
});

teste('caçadas em sequência: cada monstro libera o próximo', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  assert.ok(R.podeCacar(p, 'lobo') && !R.podeCacar(p, 'cobra'));
  p.abates.lobo = 1;
  assert.ok(R.podeCacar(p, 'cobra') && !R.podeCacar(p, 'urso'));
  assert.strictEqual(R.monstroAnterior('sapo'), 'urso');
});

teste('missões: progresso, resgate, bônus diário e reset do dia/semana', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  R.admin.subirNivel(p, 9);
  const seg = Date.UTC(2026, 10, 2, 15);      // segunda-feira, 12h em Brasília
  p.ouro = 0; p.reputacao = 0;
  R.registrarMissao(p, 'abate', 14, seg);
  assert.strictEqual(R.resgatarMissao(p, 'diarias', 'd-cacar', seg), null);
  R.registrarMissao(p, 'abate', 5, seg);
  assert.strictEqual(p.missoes.d['d-cacar'], 15);
  assert.strictEqual(R.missoesProntas(p, seg), 1);
  assert.strictEqual(R.resgatarMissao(p, 'diarias', 'd-cacar', seg), '300 de ouro');
  assert.strictEqual(p.ouro, 300);
  assert.strictEqual(R.resgatarMissao(p, 'diarias', 'd-cacar', seg), null, 'não resgata duas vezes');
  R.registrarMissao(p, 'encantar', 3, seg); R.registrarMissao(p, 'arena', 2, seg); R.registrarMissao(p, 'masmorra', 1, seg);
  ['d-encantar', 'd-arena', 'd-masmorra'].forEach((id) => assert.ok(R.resgatarMissao(p, 'diarias', id, seg)));
  assert.ok(R.resgatarBonusDiario(p, seg));
  assert.strictEqual(p.reputacao, 40);
  assert.strictEqual(p.missoes.s['s-cacar'], 19);
  const terca = seg + 86400000;
  R.garantirMissoes(p, terca);
  assert.strictEqual(p.missoes.d['d-cacar'], undefined, 'diárias renovam no dia seguinte');
  assert.strictEqual(p.missoes.s['s-cacar'], 19, 'semanais continuam na mesma semana');
  R.garantirMissoes(p, seg + 7 * 86400000);
  assert.strictEqual(p.missoes.s['s-cacar'], undefined, 'semanais renovam na segunda');
});

teste('presença do chefe: soma por abate na área, sorteio e zera ao derrotar', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const vencer = (id) => { const b = R.iniciarBatalha(p, id, rng); b.fim = 'vitoria'; return R.concluirBatalha(p, b); };
  for (let i = 0; i < 30; i++) vencer('lobo');
  assert.strictEqual(p.presencaChefe.floresta, 30);
  R.admin.subirNivel(p, 10);
  for (let i = 0; i < 3; i++) vencer('sapo');
  assert.strictEqual(p.presencaChefe.pantano, 2.1);
  assert.strictEqual(R.sortearChefe(p, 'cobra', () => 0.29), 'velgrath');
  assert.strictEqual(R.sortearChefe(p, 'cobra', () => 0.31), null);
  for (let i = 0; i < 200; i++) vencer('urso');
  assert.strictEqual(p.presencaChefe.floresta, 100);
  p.inventario = p.inventario.filter((i) => R.slotDoItem(p, i.id)); // esvazia a mochila
  p.nivel = 5;   // dentro da faixa da Floresta (acima dela o chefe não dropa)
  const res = vencer('velgrath');
  assert.strictEqual(p.presencaChefe.floresta, 0);
  assert.strictEqual(p.presencaChefe.pantano, 2.1);
  assert.strictEqual(res.pergaminho, 'comum');
  assert.ok(res.qtdPergaminhos >= 1 && res.qtdPergaminhos <= 3);
});

teste('drop do chefe: Velgrath 15% item raro + 1 a 3 pergaminhos comuns; Varnok 2 a 5 raros; Guardião sempre dropa', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  p.atributos.sor = 0;
  const N = 20000, rodar = (chefe) => {
    const c = { nada: 0, lendaria: 0, epica: 0, rara: 0, comum: 0 }, perg = new Set();
    for (let i = 0; i < N; i++) {
      p.inventario = p.inventario.slice(0, 1);
      p.nivel = 1; p.exp = 0;   // sem subir de level (acima da área não cai nada)
      const b = R.iniciarBatalha(p, chefe, rng); b.fim = 'vitoria';
      const res = R.concluirBatalha(p, b);
      const it = res.drop || res.dropArmadura;
      if (it) { c[it.raridade]++; if (it.tipo === 'secundaria') assert.strictEqual(it.mao, 'orbe'); else if (it.tipo !== 'colar' && it.tipo !== 'anel') assert.strictEqual(it.classe, 'mago'); } else c.nada++;
      perg.add(res.pergaminho + res.qtdPergaminhos);
    }
    return { c, perg: [...perg].sort() };
  };
  const v = rodar('velgrath');
  assert.ok(Math.abs(v.c.rara / N * 100 - 15) < 1 && v.c.rara + v.c.nada === N, JSON.stringify(v.c));
  assert.deepStrictEqual(v.perg, ['comum1', 'comum2', 'comum3']);
  assert.deepStrictEqual(rodar('varnok').perg, ['rara2', 'rara3', 'rara4', 'rara5']);
  const g = rodar('guardiao');
  assert.strictEqual(g.c.nada, 0);
  assert.ok(Math.abs(g.c.lendaria / N * 100 - 20) < 1.2, JSON.stringify(g.c));
});

// ---------- Habilidades especiais ----------

function batalhaTeste(classe, nivel, monstro = 'urso') {
  const p = R.criarPersonagem('T', 'masculino', 'humano', classe);
  R.admin.subirNivel(p, nivel - 1);
  const b = R.iniciarBatalha(p, monstro, rng);
  b.monstro.hp = b.monstro.hpMax = 1e6;
  b.jogador.hp = b.jogador.hpMax = 1e6;
  b.monstro.barra = 0; // sem o primeiro golpe garantido do monstro, para medir a habilidade
  b.lutador.kit = [];  // sem as habilidades novas (aba Habilidades): mede só a barra de Poder antiga
  return { p, b };
}

teste('habilidade: nível 1 a 4 nos levels 1, 10, 20 e 30', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  const niveis = [];
  for (const lv of [1, 9, 10, 19, 20, 29, 30, 40]) { R.admin.subirNivel(p, lv - p.nivel); niveis.push(R.nivelHabilidade(p)); }
  assert.deepStrictEqual(niveis, [1, 1, 2, 2, 3, 3, 4, 4]);
});

teste('poder: +25 por acerto (Mago +34), +10 por golpe recebido, máximo 100', () => {
  const { b } = batalhaTeste('cavaleiro', 1);
  b.s.precisao = 1000; // sempre acerta
  while (b.jogador.poder < 100) {
    const antes = b.jogador.poder, ev = R.passo(b);
    if (ev.ator === 'jogador' && ev.acerto) assert.strictEqual(b.jogador.poder, Math.min(100, antes + 25));
    else if (ev.acerto) assert.strictEqual(b.jogador.poder, Math.min(100, antes + 10));
  }
  const { b: bm } = batalhaTeste('mago', 1, 'lobo');
  bm.s.precisao = 1000; bm.monstro.vel = 1;
  R.passo(bm);
  assert.strictEqual(bm.jogador.poder, 34);
});

teste('habilidade só com a barra cheia; sai no próximo ataque e zera o poder', () => {
  const { b } = batalhaTeste('mago', 1, 'lobo');
  b.monstro.vel = 1;
  assert.ok(!R.prepararHabilidade(b));
  b.jogador.poder = 100;
  assert.ok(R.prepararHabilidade(b));
  const ev = R.passo(b);
  assert.strictEqual(ev.habilidade, 'Bola de Fogo');
  assert.strictEqual(b.jogador.poder, 0);
});

teste('Golpe de Escudo atordoa: o monstro perde as próximas ações', () => {
  const { b } = batalhaTeste('cavaleiro', 30);
  b.s.precisao = 1000; b.jogador.poder = 100; b.habilidadePendente = true; // uma vez só (o level 30 é rápido e recarregaria)
  b.rng = fixo0;                                                         // o golpe sempre acerta
  let ev; do { ev = R.passo(b); } while (ev.ator !== 'jogador');
  assert.strictEqual(ev.atordoou, 3);
  let perdidas = 0;
  for (let i = 0; i < 40 && perdidas < 3; i++) { const e = R.passo(b); if (e.ator === 'monstro') { assert.ok(e.atordoado); perdidas++; } }
  assert.strictEqual(perdidas, 3);
  let e; do { e = R.passo(b); } while (e.ator !== 'monstro');
  assert.ok(!e.atordoado);
});

teste('Chuva de Flechas: 2/3/3/4 golpes conforme o nível', () => {
  for (const [lv, n] of [[1, 2], [10, 3], [20, 3], [30, 4]]) {
    const { b } = batalhaTeste('arqueiro', lv);
    b.jogador.poder = 100; b.auto = true;
    let ev; do { ev = R.passo(b); } while (ev.ator !== 'jogador');
    assert.strictEqual(ev.golpes.length, n);
  }
});

teste('Bola de Fogo sempre acerta, mesmo com precisão zero', () => {
  for (let i = 0; i < 50; i++) {
    const { b } = batalhaTeste('mago', 20);
    b.s.precisao = -1000; b.jogador.poder = 100; b.auto = true;
    let ev; do { ev = R.passo(b); } while (ev.ator !== 'jogador');
    assert.ok(ev.golpes[0].acerto);
  }
});

teste('Martelada Sísmica: quebra a armadura e o monstro passa a levar +25%', () => {
  const { b } = batalhaTeste('artesao', 1);
  b.s.precisao = 1000; b.sorte = 1000; b.jogador.poder = 100; b.auto = true;
  b.s.chanceCritico = 0; b.s.dano = [10, 10];
  b.rng = () => 0.01;   // sempre acerta (a precisão máxima é 95%)
  let ev; do { ev = R.passo(b); } while (ev.ator !== 'jogador');
  assert.ok(ev.quebrouArmadura && b.monstro.armaduraQuebrada);
  assert.strictEqual(ev.dano, 20); // a armadura quebra depois deste golpe
  b.auto = false;
  do { ev = R.passo(b); } while (ev.ator !== 'jogador');
  assert.strictEqual(ev.dano, Math.round(10 * 1.25));
});

// ---------- Vida com o tempo, poções e exp reduzida ----------
const T0 = Date.UTC(2026, 9, 28, 15, 0, 0); // 12h de Brasília

teste('reset diário: vida cheia e 2 poções; só uma vez por dia (meia-noite de Brasília)', () => {
  const p = R.criarPersonagem('Tempo', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(R.atualizarTempo(p, T0), true);
  p.hpAtual = 10; p.pocoes = 0;
  R.atualizarTempo(p, T0 + 1000);
  assert.strictEqual(p.pocoes, 0);
  assert.strictEqual(R.diaReset(Date.UTC(2026, 9, 29, 2, 59)), '2026-10-28'); // 23h59 em Brasília
  R.atualizarTempo(p, Date.UTC(2026, 9, 29, 3, 0)); // meia-noite em Brasília
  assert.strictEqual(p.hpAtual, R.status(p).hpMax);
  assert.strictEqual(p.pocoes, 2);
  assert.strictEqual(R.msAteReset(Date.UTC(2026, 9, 29, 2, 0)), 3600000);
});

teste('vida volta 2% por minuto (6% acampado) e não passa do máximo', () => {
  const p = R.criarPersonagem('Regen', 'masculino', 'humano', 'cavaleiro');
  R.atualizarTempo(p, T0);
  p.hpAtual = 10; p.vidaEm = T0;
  R.atualizarTempo(p, T0 + 10 * 60000);
  assert.strictEqual(p.hpAtual, 30);
  assert.strictEqual(R.minutosParaVidaCheia(p), 35);
  R.acampar(p, T0 + 10 * 60000, true);
  R.atualizarTempo(p, T0 + 20 * 60000);
  assert.strictEqual(p.hpAtual, 90);
  R.atualizarTempo(p, T0 + 600 * 60000);
  assert.strictEqual(p.hpAtual, 100);
});

teste('poção: cura 100%, gasta 1, não usa com a vida cheia nem sem poção', () => {
  const p = R.criarPersonagem('Pocao', 'masculino', 'humano', 'cavaleiro');
  R.atualizarTempo(p, T0);
  assert.strictEqual(R.usarPocao(p, T0), false);
  p.hpAtual = 5;
  assert.strictEqual(R.usarPocao(p, T0), true);
  assert.strictEqual(p.hpAtual, 100);
  assert.strictEqual(p.pocoes, 1);
  p.hpAtual = 5; R.usarPocao(p, T0);
  p.hpAtual = 5;
  assert.strictEqual(R.usarPocao(p, T0), false);
});

teste('poção na batalha: gasta a vez do jogador e desconta ao fim da luta', () => {
  const p = R.criarPersonagem('Bebe', 'masculino', 'humano', 'cavaleiro');
  R.atualizarTempo(p, T0);
  p.hpAtual = 20;
  const b = R.iniciarBatalha(p, 'lobo', rng);
  assert.strictEqual(R.beberPocao(b), true);
  let ev;
  do { ev = R.passo(b); } while (ev.ator !== 'jogador');
  assert.strictEqual(ev.pocao, true);
  assert.strictEqual(b.jogador.hp, b.jogador.hpMax);
  b.fim = 'fuga';
  R.concluirBatalha(p, b, T0);
  assert.strictEqual(p.pocoes, 1);
});

teste('exp reduzida: 50% de 3 a 7 levels acima da faixa, 10% com 8+, última área nunca', () => {
  const p = R.criarPersonagem('Exp', 'masculino', 'humano', 'cavaleiro');
  p.nivel = 7; assert.strictEqual(R.fatorExp(p, 'lobo'), 100);
  p.nivel = 8; assert.strictEqual(R.fatorExp(p, 'lobo'), 50);
  p.nivel = 12; assert.strictEqual(R.fatorExp(p, 'lobo'), 50);
  p.nivel = 13; assert.strictEqual(R.fatorExp(p, 'lobo'), 10);
  p.nivel = 40; assert.strictEqual(R.fatorExp(p, 'salamandra'), 100);
  p.nivel = 13;
  const b = R.iniciarBatalha(p, 'lobo', rng);
  b.fim = 'vitoria';
  const res = R.concluirBatalha(p, b, T0);
  assert.strictEqual(res.fatorExp, 10);
  assert.strictEqual(res.exp, Math.max(1, Math.floor(D.monstros.lobo.exp / 10)));
});

teste('derrota deixa 0 de vida; habilidades desligadas não disparam', () => {
  const p = R.criarPersonagem('Caido', 'masculino', 'humano', 'mago');
  const b = R.iniciarBatalha(p, 'urso', rng);
  b.fim = 'derrota'; b.jogador.hp = 0;
  p.nivel = 6; p.exp = 100; // level 6 pede 240: perde 5% = 12
  const res = R.concluirBatalha(p, b, T0);
  assert.strictEqual(p.hpAtual, 0);
  assert.strictEqual(res.expPerdida, 12);
  assert.strictEqual(p.exp, 88);
  p.exp = 5;
  R.concluirBatalha(p, Object.assign(R.iniciarBatalha(p, 'urso', rng), { fim: 'derrota' }), T0);
  assert.strictEqual(p.exp, 0); // não desce de level
  assert.strictEqual(p.nivel, 6);
  D.HABILIDADES_ATIVAS = false;
  const b2 = R.iniciarBatalha(R.criarPersonagem('Sem', 'masculino', 'humano', 'mago'), 'lobo', rng);
  b2.lutador.kit = [];
  b2.jogador.poder = 100; b2.auto = true;
  assert.strictEqual(R.prepararHabilidade(b2), false);
  for (let i = 0; i < 50 && !b2.fim; i++) assert.ok(!R.passo(b2).habilidade);
  D.HABILIDADES_ATIVAS = true;
});

teste('poder: cresce com level e equipamento', () => {
  const p = R.criarPersonagem('Forte', 'masculino', 'humano', 'cavaleiro');
  const inicial = R.poder(p);
  assert.ok(inicial > 0);
  R.admin.subirNivel(p, 9);
  const nivel10 = R.poder(p);
  assert.ok(nivel10 > inicial);
  R.admin.conjunto(p, 'rara');
  p.inventario.slice(1).forEach((i) => R.equipar(p, i.id));
  assert.ok(R.poder(p) > nivel10);
});

teste('admin: tirar ouro, baixar level, exp, pergaminhos, vida e mochila', () => {
  const p = R.criarPersonagem('Adm', 'masculino', 'humano', 'cavaleiro');
  R.admin.ouro(p, 500); R.admin.ouro(p, -1000);
  assert.strictEqual(p.ouro, 0);
  R.admin.subirNivel(p, 9);
  R.distribuirPonto(p, 'for');
  R.admin.baixarNivel(p, 5);
  assert.strictEqual(p.nivel, 5);
  assert.strictEqual(p.exp, 0);
  assert.strictEqual(p.pontosLivres, 12);
  assert.strictEqual(p.atributos.for, p.atributosIniciais.for);
  assert.ok(p.hpAtual <= R.status(p).hpMax);
  R.admin.baixarNivel(p, 99);
  assert.strictEqual(p.nivel, 1);
  R.admin.exp(p, 50); assert.strictEqual(p.exp, 5);
  R.admin.exp(p, -100); assert.strictEqual(p.exp, 0);
  R.admin.pergaminhos(p, 3); R.admin.pergaminhos(p, -10);
  assert.strictEqual(p.pergaminhos.rara, 0);
  R.admin.vida(p, 0); assert.strictEqual(p.hpAtual, 0);
  R.admin.conjunto(p, 'rara');
  R.admin.esvaziarMochila(p);
  assert.strictEqual(p.inventario.length, 1); // só a arma equipada
});

teste('colar e anel não caem nas caçadas nem são vendidos no mercado', () => {
  const p = R.criarPersonagem('J', 'masculino', 'humano', 'arqueiro');
  p.ouro = 1e6;
  assert.strictEqual(R.comprar(p, 'rara', 'anel'), 'Colar e anel só nas masmorras.');
  assert.strictEqual(R.comprar(p, 'rara', 'colar'), 'Colar e anel só nas masmorras.');
  for (const chefe of ['velgrath', 'guardiao', 'ignaroth']) {
    for (let i = 0; i < 300; i++) {
      p.inventario = p.inventario.slice(0, 1);
      const b = R.iniciarBatalha(p, chefe, rng); b.fim = 'vitoria';
      const res = R.concluirBatalha(p, b);
      for (const it of [res.drop, res.dropArmadura]) if (it) assert.ok(it.tipo !== 'colar' && it.tipo !== 'anel', chefe + ' ' + it.tipo);
    }
  }
});

teste('masmorra: 3 salas (monstros da área, Elite, Chefe da Masmorra) e luta determinística', () => {
  const salas = R.salasMasmorra('ninho');
  assert.deepStrictEqual([...salas.map((s) => s.length)], [3, 3, 1]);
  assert.deepStrictEqual([...salas[0].map((m) => m.id)], ['sapo', 'aranha', 'troll']);
  const f = R.masmorra('ninho').forca;
  assert.strictEqual(salas[1][2].nome, 'Troll Ancião do Lodo');
  assert.strictEqual(salas[1][2].hp, Math.round(D.monstros.troll.hp * 2 * f.vida));
  assert.strictEqual(salas[2][0].nome, 'Morgath, Mãe da Névoa');
  assert.strictEqual(salas[2][0].hp, Math.round(D.monstros.morgath.hp * 3 * f.vida));
  const herois = ['cavaleiro', 'arqueiro', 'mago'].map((c) => { const p = R.criarPersonagem(c, 'masculino', 'humano', c); R.admin.subirNivel(p, 14); return p; });
  const a = R.simularMasmorra(herois, 'ninho', 123), b = R.simularMasmorra(herois, 'ninho', 123);
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
  assert.strictEqual(a.eventos[0].de, 'm', 'o monstro dá o primeiro golpe');
  assert.ok(herois.every((p) => p.hpAtual === R.status(p).hpMax), 'a luta não mexe na vida de fora');
});

teste('skins do dado: comprar com ouro, usar e não comprar duas vezes', () => {
  const p = R.criarPersonagem('Skin', 'masculino', 'humano', 'mago');
  assert.deepStrictEqual([...R.skinsDoPersonagem(p)], ['vermelho']);
  assert.strictEqual(R.comprarSkin(p, 'azul'), 'Ouro insuficiente.');
  p.ouro = 600;
  assert.strictEqual(R.comprarSkin(p, 'azul'), true);
  assert.strictEqual(p.ouro, 100); assert.strictEqual(p.skinDado, 'azul');
  assert.strictEqual(R.comprarSkin(p, 'azul'), 'Você já tem essa skin.');
  assert.strictEqual(R.usarSkin(p, 'vermelho'), true); assert.strictEqual(p.skinDado, 'vermelho');
  assert.strictEqual(R.usarSkin(p, 'obsidiana'), false);
});

teste('mochila: força do item, ordem com desempate e filtro', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const a = { id: 'a', tipo: 'arma', classe: 'cavaleiro', raridade: 'rara', encanto: 0, dano: [12, 18] };
  const b = { id: 'b', tipo: 'arma', classe: 'cavaleiro', raridade: 'comum', encanto: 0, dano: [12, 18] };
  const c = { id: 'c', tipo: 'elmo', classe: 'cavaleiro', raridade: 'lendaria', encanto: 0 };
  assert.strictEqual(R.forcaItem(a), 150);
  assert.strictEqual(R.forcaItem(c), 20 * 8 + 150);
  assert.deepStrictEqual([...R.ordenarItens([b, a, c], 'raridade').map((x) => x.id)], ['c', 'a', 'b']);
  assert.deepStrictEqual([...R.ordenarItens([a, b, c], 'forca').map((x) => x.id)], ['c', 'a', 'b']);   // empate a/b: raridade desempata
  assert.deepStrictEqual([...R.ordenarItens([a, b, c], 'forca', true).map((x) => x.id)], ['b', 'a', 'c']);
  assert.ok(R.passaFiltro(a, { raridades: ['rara'] }) && !R.passaFiltro(b, { raridades: ['rara'] }));
  assert.ok(!R.passaFiltro(a, { forcaMin: 200 }) && R.passaFiltro(c, { forcaMin: 200 }));
  p.inventario.push(b, a, c);
  R.organizarMochila(p, 'raridade');
  assert.deepStrictEqual([...R.mochila(p).map((x) => x.id)], ['c', 'a', 'b']);
  assert.ok(R.slotDoItem(p, p.equipados.arma));      // a arma equipada continua equipada
});

teste('mochila: trava e venda em lote', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.ouro = 0;
  p.inventario.push({ id: 'x', tipo: 'elmo', classe: 'cavaleiro', raridade: 'comum', encanto: 0 },
    { id: 'y', tipo: 'elmo', classe: 'cavaleiro', raridade: 'rara', encanto: 0 },
    { id: 'z', tipo: 'elmo', classe: 'cavaleiro', raridade: 'epica', encanto: 0 });
  R.travarItem(p, 'y');
  assert.ok(!R.vender(p, 'y'));
  assert.deepStrictEqual([...R.idsAteRaridade(p, 'rara')], ['x']);
  const todos = ['x', 'y', 'z', p.equipados.arma];
  assert.strictEqual(R.valorVenda(p, todos), 20 + 1000);
  assert.deepStrictEqual({ ...R.venderVarios(p, todos) }, { vendidos: 2, ouro: 1020 });
  assert.strictEqual(p.ouro, 1020);
  assert.deepStrictEqual([...R.mochila(p).map((x) => x.id)], ['y']);
  R.travarItem(p, 'y');
  assert.ok(R.vender(p, 'y'));
});

teste('Pergaminho do Recomeço: compra com 2.000 de ouro e devolve os pontos', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  R.admin.subirNivel(p, 4);
  const livres = p.pontosLivres;
  R.distribuirPonto(p, 'for'); R.distribuirPonto(p, 'for');
  assert.strictEqual(R.usarRecomeco(p), 'Você não tem Pergaminho do Recomeço.');
  p.ouro = 1999; p.reputacao = 5000;
  assert.strictEqual(R.comprarRecomeco(p), 'Ouro insuficiente.');
  p.ouro = 2500;
  assert.strictEqual(R.comprarRecomeco(p), true);
  assert.deepStrictEqual([p.ouro, p.reputacao, p.recomecos], [500, 5000, 1]);
  assert.strictEqual(R.usarRecomeco(p), true);
  assert.deepStrictEqual([p.pontosLivres, p.recomecos, p.atributos.for], [livres, 0, p.atributosIniciais.for]);
});

teste('bônus da aliança: +% de exp e de ouro na caçada', () => {
  const D2 = D, p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const b = R.iniciarBatalha(p, 'lobo'); b.fim = 'vitoria'; b.monstro.hp = 0;
  const m = D2.monstros.lobo;
  const res = R.concluirBatalha(p, b, Date.now(), { exp: 10, ouro: 50 });
  assert.strictEqual(res.ouro, Math.floor(m.ouro * 1.5));
  assert.strictEqual(res.exp, Math.floor(m.exp * 1.1));
});

teste('caçada contínua: tempo e chance por força do monstro e rastreio (velocidade + sorte), vida mínima e poção automática', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  // tempo: 3 s o mais fraco, 4 s o do meio, 5 s o mais forte no começo da região
  assert.deepStrictEqual(['lobo', 'cobra', 'urso'].map(id => R.tempoBusca(p, id)), [3000, 4000, 5000]);
  // com Velocidade + Sorte bem acima da referência da região: 2 s, 2,5 s e 3 s
  p.atributos.sor = 200;
  assert.deepStrictEqual(['lobo', 'cobra', 'urso'].map(id => R.tempoBusca(p, id)), [2000, 2500, 3000]);
  // na região seguinte começa de novo (referência maior)
  const r = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro'); R.admin.subirNivel(r, 4); r.atributos.sor = 25;
  assert.ok(R.evolucaoCacada(r, 'pantano') < R.evolucaoCacada(r, 'floresta'));
  // só sorteia monstros liberados
  const q = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  for (let i = 0; i < 50; i++) assert.strictEqual(R.escolherMonstroCacada(q, ['lobo', 'cobra', 'urso']), 'lobo');
  q.abates.lobo = 1; q.abates.cobra = 1;
  // no começo: o mais fraco 3x mais fácil que o mais forte (50% / 33% / 17%)
  q.atributos.sor = 0;
  const ch = R.chancesCacada(q, ['urso', 'lobo', 'cobra']).map(x => Math.round(x.chance));
  assert.deepStrictEqual(ch, [50, 33, 17]);
  const conta = (sor) => { q.atributos.sor = sor; let urso = 0; for (let i = 0; i < 4000; i++) if (R.escolherMonstroCacada(q, ['lobo', 'cobra', 'urso']) === 'urso') urso++; return urso / 4000; };
  assert.ok(conta(100) > conta(0) + 0.1, 'mais Velocidade + Sorte, mais monstros fortes');
  q.atributos.sor = 200;
  assert.deepStrictEqual(R.chancesCacada(q, ['lobo', 'cobra', 'urso']).map(x => Math.round(x.chance)), [33, 33, 33]);
  assert.strictEqual(R.escolherMonstroCacada(q, ['sapo']), null);
  // vida mínima: mais que 5%
  const hpMax = R.status(q).hpMax;
  q.hpAtual = Math.floor(hpMax * 0.05); assert.ok(!R.vidaParaCacar(q));
  q.hpAtual = Math.floor(hpMax * 0.05) + 1; assert.ok(R.vidaParaCacar(q));
  // poção automática
  const b = { fim: null, pocoes: 1, pocaoPendente: false, jogador: { hp: 9, hpMax: 100 } };
  assert.ok(R.precisaPocao(b, 10)); assert.ok(!R.precisaPocao(b, 5)); assert.ok(!R.precisaPocao(b, 0));
  b.pocoes = 0; assert.ok(!R.precisaPocao(b, 10));
});

teste('seta verde: item da mochila melhor que o equipado; outra classe nunca', () => {
  const p = R.criarPersonagem('T', 'feminino', 'humano', 'cavaleiro');
  const arma = (id, classe, raridade, dano) => ({ id, tipo: 'arma', classe, raridade, encanto: 0, variacao: 0, dano });
  const fraca = arma('fraca', 'cavaleiro', 'comum', [1, 2]);
  const forte = arma('forte', 'cavaleiro', 'lendaria', [60, 90]);
  const outra = arma('outra', 'mago', 'lendaria', [60, 90]);
  [fraca, forte, outra].forEach((i) => p.inventario.push(i));
  assert.ok(R.itemMelhor(p, forte));
  assert.ok(!R.itemMelhor(p, outra));
  R.equipar(p, forte.id);
  assert.ok(!R.itemMelhor(p, fraca));
  assert.ok(!R.itemMelhor(p, forte), 'o equipado não ganha seta');
  // Floresta com metade do dano; a masmorra da Floresta continua com o mesmo dano de antes
  assert.deepStrictEqual([...D.monstros.lobo.ataque], [3, 5]);
  const chefeToca = R.salasMasmorra('toca')[2][0];
  assert.deepStrictEqual([...chefeToca.ataque], [80, 100], 'masmorra quase igual (era 75–100)');
});

teste('habilidades: inicial antes do 10, segunda classe, pontos (máx. 10), passiva no status e recomeço', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(R.kitHabilidades(p, 'cacada')[0].def.nome, 'Espada Giratória');
  assert.strictEqual(R.multHabilidade(R.kitHabilidades(p, 'cacada')[0].def, 0), 150, 'inicial: golpe de 150% em um alvo');
  assert.strictEqual(R.pontosHabilidadeTotal(p), 0);
  assert.notStrictEqual(R.escolherSegundaClasse(p, 'paladino'), true);
  R.admin.subirNivel(p, 9);
  assert.strictEqual(R.pontosHabilidadeTotal(p), 4);
  assert.notStrictEqual(R.escolherSegundaClasse(p, 'assassino'), true, 'só as da própria classe');
  assert.strictEqual(R.escolherSegundaClasse(p, 'paladino'), true);
  assert.strictEqual(R.kitHabilidades(p, 'cacada').length, 0, 'sem ponto, nenhuma ativa');
  const antes = R.status(p).hpMax;
  assert.strictEqual(R.mudarPontoHabilidade(p, 'pele-de-ferro', 1), true);
  assert.strictEqual(R.status(p).hpMax, Math.round(antes * 1.11), 'passiva 10% + 1% por ponto');
  for (let i = 0; i < 3; i++) R.mudarPontoHabilidade(p, 'golpe-justo', 1);
  assert.strictEqual(R.pontosHabilidadeLivres(p), 0);
  assert.notStrictEqual(R.mudarPontoHabilidade(p, 'golpe-justo', 1), true, 'sem pontos');
  R.admin.subirNivel(p, 10);
  for (let i = 0; i < 10; i++) R.mudarPontoHabilidade(p, 'golpe-justo', 1);
  assert.strictEqual(R.pontosEm(p, 'golpe-justo'), 10, 'máximo 10');
  assert.strictEqual(R.multHabilidade(D.SEGUNDAS_CLASSES.paladino.habilidades[2], 10), 200);
  // ordem
  assert.deepStrictEqual([...R.talentos(p).ordem.cacada], ['martelo-sagrado', 'grito-de-desafio', 'golpe-justo']);
  R.moverHabilidade(p, 'cacada', 'golpe-justo', 'subir');
  assert.deepStrictEqual([...R.talentos(p).ordem.cacada], ['martelo-sagrado', 'golpe-justo', 'grito-de-desafio']);
  R.moverHabilidade(p, 'cacada', 'martelo-sagrado', 'tirar');
  assert.deepStrictEqual([...R.talentos(p).ordem.cacada], ['golpe-justo', 'grito-de-desafio']);
  // recomeço das habilidades
  p.ouro = 1999;
  assert.strictEqual(R.comprarRecomecoHabilidades(p), 'Ouro insuficiente.');
  p.ouro = 2000;
  assert.strictEqual(R.comprarRecomecoHabilidades(p), true);
  assert.strictEqual(p.ouro, 0);
  assert.strictEqual(R.usarRecomecoHabilidades(p), true);
  assert.strictEqual(R.segundaClasse(p), null);
  assert.strictEqual(R.status(p).hpMax, antes + 10 * D.HP_POR_NIVEL);
});

teste('habilidades na caçada: Sombra faz o monstro errar e o próximo golpe ser crítico; chefe atordoado só 1 turno', () => {
  const p = R.criarPersonagem('T', 'feminino', 'humano', 'arqueiro');
  R.admin.subirNivel(p, 9);
  R.escolherSegundaClasse(p, 'assassino');
  R.mudarPontoHabilidade(p, 'sombra', 1); R.mudarPontoHabilidade(p, 'golpe-fatal', 2);
  R.talentos(p).ordem.cacada = ['sombra', 'golpe-fatal'];
  const b = R.iniciarBatalha(p, 'aranha', rng);
  b.s.precisao = 1000; b.monstro.hp = b.monstro.hpMax = 1e6; b.jogador.hp = b.jogador.hpMax = 1e6;
  b.monstro.barra = 0; b.jogador.barra = 100;
  const e1 = R.passo(b);
  assert.strictEqual(e1.reforco, 'Sombra');
  const evs = []; for (let i = 0; i < 4; i++) evs.push(R.passo(b));
  const m1 = evs.find((e) => e.ator === 'monstro');
  assert.ok(m1.sombra && !m1.acerto, 'o monstro erra');
  const fatal = evs.find((e) => e.habilidade === 'Golpe Fatal');
  assert.ok(fatal && fatal.critico, 'na vez seguinte: Golpe Fatal com crítico garantido');
  // chefe: atordoar dura no máximo 1
  const q = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  R.admin.subirNivel(q, 9); R.escolherSegundaClasse(q, 'cacador'); R.mudarPontoHabilidade(q, 'flecha-na-perna', 1);
  const c = R.iniciarBatalha(q, 'velgrath', rng);
  c.s.precisao = 1000; c.monstro.hp = 1e6; c.monstro.barra = 0; c.jogador.barra = 100;
  c.rng = () => 0.01;   // sempre acerta
  const ev = R.passo(c);
  assert.strictEqual(ev.habilidade, 'Flecha na Perna');
  assert.strictEqual(c.monstro.atordoado, 1);
});

teste('habilidades na masmorra: mesma semente, mesma luta; cura e área aparecem', () => {
  const grupo = ['curandeiro', 'paladino', 'bruxo'].map((sc) => {
    const p = R.criarPersonagem(sc, 'masculino', 'humano', D.SEGUNDAS_CLASSES[sc].de);
    R.admin.subirNivel(p, 14);
    R.escolherSegundaClasse(p, sc);
    D.SEGUNDAS_CLASSES[sc].habilidades.forEach((h) => { R.mudarPontoHabilidade(p, h.id, 2); });
    return p;
  });
  const a = R.simularMasmorra(grupo, 'toca', 'semente-1'), b = R.simularMasmorra(grupo, 'toca', 'semente-1');
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
  const nomes = new Set(a.eventos.filter((e) => e.tipo === 'hab').map((e) => e.nome));
  assert.ok(nomes.has('Martelo Sagrado') || nomes.has('Nevasca'), 'usa habilidade de área');
  assert.ok(a.eventos.every((e) => Array.isArray(e.hp)));
});

teste('fugir ou evitar o chefe zera a chance dele aparecer na área', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.presencaChefe.floresta = 37;
  const b = R.iniciarBatalha(p, 'velgrath', rng);
  R.concluirBatalha(p, b, T0);           // fugiu (sem fim)
  assert.strictEqual(p.presencaChefe.floresta, 0);
  p.presencaChefe.floresta = 12;
  assert.ok(R.evitarChefe(p, 'velgrath'));
  assert.strictEqual(p.presencaChefe.floresta, 0);
  p.presencaChefe.floresta = 12;
  assert.ok(!R.evitarChefe(p, 'lobo'), 'monstro comum não mexe');
  assert.strictEqual(p.presencaChefe.floresta, 12);
});

teste('atributos: +1 de dano a cada 3 pontos do atributo da classe (Caçador usa Destreza)', () => {
  const c = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  assert.strictEqual(D.classes.arqueiro.nome, 'Caçador');
  assert.strictEqual(D.SEGUNDAS_CLASSES.cacador.nome, 'Arqueiro');
  const antes = R.status(c).dano[0];
  c.atributos.for += 9; assert.strictEqual(R.status(c).dano[0], antes, 'Força não dá dano ao Caçador');
  c.atributos.des += 3; assert.strictEqual(R.status(c).dano[0], antes + 1);
  const k = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro'), d0 = R.status(k).dano[0];
  k.atributos.for += 3; assert.strictEqual(R.status(k).dano[0], d0 + 1);
  // presente: 1 Pergaminho do Recomeço para quem já tinha level
  const v = R.criarPersonagem('V', 'masculino', 'humano', 'cavaleiro'); v.nivel = 8; delete v.recomecoPresente; v.recomecos = 0;
  R.normalizar(v); R.normalizar(v);
  assert.strictEqual(v.recomecos, 1);
});

teste('armas: tipos, velocidade, duas mãos, mão esquerda e segunda classe', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const s0 = R.status(p);
  const add = (it) => { p.inventario.push(it); return it; };
  // espada2m: devagar (0,8) e dano x1,4
  const e2 = add({ id: 'e2', tipo: 'arma', classe: 'cavaleiro', arma: 'espada2m', raridade: 'comum', variacao: 0, dano: [4, 8], encanto: 0 });
  const esc = add({ id: 'esc', tipo: 'secundaria', classe: null, mao: 'escudo', raridade: 'rara', variacao: 0, encanto: 1 });
  assert.strictEqual(R.equipar(p, 'esc'), 'secundaria');
  assert.strictEqual(R.status(p).defesa, s0.defesa + 6 + 1, 'escudo raro +6 de defesa, +1 do encanto');
  assert.strictEqual(R.equipar(p, 'e2'), 'arma');
  assert.strictEqual(p.equipados.secundaria, null, 'duas mãos tira o escudo');
  const s1 = R.status(p);
  assert.deepStrictEqual([...s1.danoArma], [6, 11]);
  assert.strictEqual(s1.velocidade, Math.round(15 * 0.8));
  assert.ok(R.motivoNaoEquipa(p, esc).includes('duas mãos'));
  // nome do tipo novo: "<tipo> <sufixo>"
  assert.strictEqual(R.nomeItem(e2), 'Espada de Duas Mãos de Ferro');
  // arma de rara: +2 no atributo de dano da classe (Força)
  const rara = add({ id: 'r', tipo: 'arma', classe: 'cavaleiro', arma: 'machado', raridade: 'rara', variacao: 0, dano: [12, 18], encanto: 0 });
  R.equipar(p, 'r');
  assert.strictEqual(R.atributosTotais(p).for, p.atributos.for + 2);
  // comum não existe para arma de segunda classe
  for (let i = 0; i < 200; i++) assert.ok(!R.soSegundaClasse(R.rolarDrop(Object.assign(p, {}), 'lobo', Math.random)?.arma || 'espada'));
  p.ouro = 1e6;
  assert.notStrictEqual(typeof R.comprar(p, 'comum', 'arma', 'mangual'), 'object');
  // segunda classe: Destruidor só usa armas de duas mãos; a espada equipada continua até trocar
  R.admin.subirNivel(p, 9); p.equipados.arma = 'e2'; R.equipar(p, 'r');
  assert.strictEqual(R.escolherSegundaClasse(p, 'destruidor'), true);
  assert.strictEqual(p.equipados.arma, 'r', 'arma incompatível continua equipada');
  R.desequipar(p, 'arma');
  assert.ok(!R.equipar(p, 'r'), 'mas não dá para equipar de novo');
  assert.ok(R.equipar(p, 'e2'));
  assert.strictEqual(typeof R.comprar(p, 'rara', 'arma', 'machado2m'), 'object');
  // Caçador: aljava não com balestra nem com adaga
  const c = R.criarPersonagem('C', 'feminino', 'humano', 'arqueiro');
  c.inventario.push({ id: 'al', tipo: 'secundaria', classe: null, mao: 'aljava', raridade: 'comum', variacao: 0, encanto: 0 },
    { id: 'ad', tipo: 'arma', classe: 'arqueiro', arma: 'adaga', raridade: 'comum', variacao: 0, dano: [2, 6], encanto: 0 });
  assert.strictEqual(R.equipar(c, 'al'), 'secundaria');
  assert.strictEqual(R.equipar(c, 'ad'), 'arma');
  assert.strictEqual(c.equipados.secundaria, null, 'adaga tira a aljava');
  assert.strictEqual(R.status(c).velocidade, Math.round(15 * 1.2), 'adaga é rápida');
});

teste('armaduras sorteadas: bônus entre 80% e 120% e atributo extra da rara em diante', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const vistos = new Set();
  for (let i = 0; i < 300; i++) {
    const it = R.comprar(Object.assign(p, { ouro: 1e9, reputacao: 1e9 }), 'epica', 'peitoral');
    const b = it.bonus;   // peitoral épico: defesa 16 (13–19), vida 100 (80–120)
    assert.ok(b.defesa >= 13 && b.defesa <= 19 && b.vida >= 80 && b.vida <= 120, JSON.stringify(b));
    const extras = Object.keys(b).filter((k) => ['for', 'des', 'res', 'int', 'sor'].includes(k));
    assert.strictEqual(extras.length, 1); assert.ok(b[extras[0]] >= 2 && b[extras[0]] <= 4);
    vistos.add(b.defesa);
    assert.strictEqual(JSON.stringify(R.bonusItem(it)), JSON.stringify(b));
    p.inventario = [];
  }
  assert.ok(vistos.size > 3, 'varia');
  const comum = R.comprar(p, 'comum', 'elmo');
  assert.ok(Object.keys(comum.bonus).every((k) => k === 'defesa' || k === 'vida'), 'comum sem atributo extra');
  // item antigo (sem bonus salvo) continua com o valor fixo
  assert.strictEqual(R.bonusItem({ tipo: 'elmo', classe: 'cavaleiro', raridade: 'rara', encanto: 0 }).defesa, 5);
});

teste('itens por nível: drop ±3 (35+ vai de 35 a 60), qualidade pela raridade, Mercado comum/rara e venda a 10%', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  R.admin.subirNivel(p, 19);   // level 20
  for (let i = 0; i < 300; i++) { const n = R.nivelDoDrop(p, Math.random); assert.ok(n >= 17 && n <= 23, n); }
  R.admin.subirNivel(p, 20);   // level 40
  const vistos = new Set(); for (let i = 0; i < 2000; i++) { const n = R.nivelDoDrop(p, Math.random); assert.ok(n >= 35 && n <= 60); vistos.add(n); }
  assert.strictEqual(vistos.size, 26);
  // mesmo nível: lendária mais forte que comum; nível maior mais forte
  const m = (n, q) => { const d = R.danoDoNivel(n, q); return (d[0] + d[1]) / 2; };
  assert.ok(m(10, 1) > m(10, 0.6) && m(10, 0.1) < m(10, 0.55) && m(30, 0.5) > m(10, 0.5));
  assert.ok(R.bonusDoNivel(5, 40, 0.5) > R.bonusDoNivel(5, 15, 0.5));
  // Mercado: nível do herói ±3, comum ou rara, preço do nível
  const c = R.criarPersonagem('C', 'masculino', 'humano', 'cavaleiro'); R.admin.subirNivel(c, 9); c.ouro = 1e9;
  const rars = new Set();
  for (let i = 0; i < 100; i++) {
    const it = R.comprar(c, 'peitoral'); rars.add(it.raridade);
    assert.ok(it.nivel >= 7 && it.nivel <= 13); assert.ok(it.bonus.defesa >= 1);
    c.inventario = c.inventario.filter((x) => x.id !== it.id);
  }
  assert.deepStrictEqual([...rars].sort(), ['comum', 'rara']);
  const ouro = c.ouro; R.comprar(c, 'arma', 'machado'); assert.strictEqual(ouro - c.ouro, R.precoDoNivel(10));
  // venda: 10% do preço do nível do item (comum)
  const it = R.novoItem('elmo', 'cavaleiro', 'comum', Math.random, null, 10);
  assert.strictEqual(R.precoVenda(it), Math.round(R.precoDoNivel(10) * 0.1));
  // item antigo vira do nível do herói
  const v = R.criarPersonagem('V', 'masculino', 'humano', 'cavaleiro'); v.nivel = 12; delete v.inventario[0].nivel; R.normalizar(v);
  assert.strictEqual(v.inventario[0].nivel, 12);
});

teste('armas por nível: extras por faixa (atributos, PvE, PvP e pontos de habilidade além de 10)', () => {
  const faixa = (n) => { const e = R.sortearExtrasArma(n, Math.random); return e; };
  assert.deepStrictEqual(JSON.stringify(faixa(8)), '{}');
  for (let i = 0; i < 50; i++) {
    const a = faixa(15).atributos; const k = Object.keys(a); assert.strictEqual(k.length, 1); assert.ok(a[k[0]] >= 1 && a[k[0]] <= 2);
    const b = faixa(35).atributos; assert.ok(Object.values(b)[0] >= 5 && Object.values(b)[0] <= 8);
    const c = faixa(45); assert.strictEqual(Object.keys(c.atributos).length, 2); assert.ok(c.pve >= 5 && c.pve <= 10 && !c.pvp && c.hab.n === 1);
    const d = faixa(58); assert.ok(d.pvp >= 5 && d.pvp <= 10 && d.hab.n >= 2 && d.hab.n <= 3);
  }
  // arma 51+: pontos na habilidade da segunda classe, além do limite de 10
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  R.admin.subirNivel(p, 39); R.escolherSegundaClasse(p, 'assassino');
  for (let i = 0; i < 10; i++) R.mudarPontoHabilidade(p, 'golpe-fatal', 1);
  const arma = R.novoItem('arma', 'arqueiro', 'lendaria', Math.random, 'adaga', 55);
  arma.extras.hab = { i: 2, n: 3 };   // Golpe Fatal é a 3ª habilidade do Assassino
  p.inventario.push(arma); R.equipar(p, arma.id);
  assert.strictEqual(R.pontosEm(p, 'golpe-fatal'), 13);
  assert.strictEqual(R.pontosDistribuidos(p, 'golpe-fatal'), 10);
  assert.ok(R.status(p).danoPvP >= 5 && R.status(p).danoPvE >= 5);
  const atr = arma.extras.atributos, k = Object.keys(atr)[0];
  const sem = R.atributosTotais(p)[k]; R.desequipar(p, 'arma');
  assert.strictEqual(R.atributosTotais(p)[k], sem - atr[k]);
  assert.strictEqual(R.pontosEm(p, 'golpe-fatal'), 10);
});

teste('conjuntos das segundas classes: peças com o mesmo nome dão bônus de 2, 3 e 4 peças', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  R.admin.subirNivel(p, 14); R.escolherSegundaClasse(p, 'paladino');
  const pecas = ['elmo', 'peitoral', 'luvas', 'botas'].map((t) => R.comprar(Object.assign(p, { ouro: 1e9 }), t));
  pecas.forEach((it) => assert.strictEqual(it.conjunto, undefined, 'o Mercado não vende peça de conjunto'));
  // força todas no mesmo conjunto (mesmo nome)
  pecas.forEach((it) => { it.conjunto = 'paladino-2'; });
  assert.ok(R.nomeItem(pecas[0]).endsWith('do Juramento'), R.nomeItem(pecas[0]));
  const s0 = R.status(p);
  R.equipar(p, pecas[0].id); const s1 = R.status(p);
  R.equipar(p, pecas[1].id); const s2 = R.status(p);
  const semSet = (pecas[0].bonus.defesa || 0) + (pecas[1].bonus.defesa || 0);
  assert.strictEqual(s2.defesa, s0.defesa + semSet + 5, '2 peças: +5 de defesa');
  R.equipar(p, pecas[2].id); const s3 = R.status(p);
  assert.strictEqual(s3.dano[0] - s2.dano[0] - Math.floor((R.atributosTotais(p).for) / 3) + Math.floor((R.atributosTotais(p).for - (pecas[2].bonus.for || 0)) / 3), 5, '3 peças: +5 de dano');
  R.equipar(p, pecas[3].id);
  assert.deepStrictEqual(Object.assign({}, R.bonusConjuntos(p)), { defesa: 5, dano: 5, vida: 30 });
  // outra segunda classe não ganha o bônus
  p.talentos.classe2 = 'destruidor';
  assert.deepStrictEqual(Object.assign({}, R.bonusConjuntos(p)), {});
  // Destruidor: 2 peças = +5 de Força
  pecas.forEach((it) => { it.conjunto = 'destruidor-2'; });
  const forSem = p.atributos.for + R.bonusEquipamentos(p).for;
  assert.strictEqual(R.atributosTotais(p).for, forSem + 5);
});

teste('conjunto: 10% das armaduras da caçada, na raridade sorteada; fora da venda em lote', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  R.admin.subirNivel(p, 24);
  const monstro = Object.keys(D.monstros).find((m) => (D.monstros[m].dropsArmadura || []).length);
  const sortear = () => { const r = []; for (let i = 0; i < 40000; i++) { const it = R.rolarDropArmadura(p, monstro, Math.random); if (it && it.tipo !== 'secundaria') r.push(it); } return r; };
  assert.ok(sortear().every((it) => !it.conjunto), 'sem segunda classe não vem conjunto');
  R.escolherSegundaClasse(p, 'paladino');
  const itens = sortear(), verdes = itens.filter((it) => it.conjunto);
  const pct = verdes.length / itens.length * 100;
  assert.ok(pct > 6 && pct < 14, 'cerca de 10%: ' + pct.toFixed(1));
  verdes.forEach((it) => assert.strictEqual(it.conjunto, 'paladino-' + Math.ceil(it.nivel / 10)));
  const rars = new Set(verdes.map((it) => it.raridade));
  assert.ok(rars.size >= 2, 'conjunto vem em mais de uma raridade: ' + [...rars].join(','));
  p.inventario = p.inventario.concat([verdes[0], itens.find((it) => !it.conjunto)]);
  const ids = R.idsAteRaridade(p, 'lendaria');
  assert.ok(ids.indexOf(verdes[0].id) < 0, 'peça de conjunto não entra no "vender vários"');
  assert.ok(ids.length >= 1);
});

teste('armaduras novas sorteiam 1 dos 8 finais das armas; antigas e de conjunto mantêm o nome', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const nomes = new Set();
  for (let i = 0; i < 400; i++) nomes.add(R.nomeItem(R.novoItem('elmo', 'cavaleiro', 'rara', Math.random, null, 10)));
  assert.strictEqual(nomes.size, 8, [...nomes].join(', '));
  D.SUFIXOS_ARMA.rara.forEach((s) => assert.ok(nomes.has('Elmo ' + s), 'Elmo ' + s));
  const antiga = { id: 'x', tipo: 'elmo', classe: 'cavaleiro', raridade: 'rara', encanto: 0 };
  assert.strictEqual(R.nomeItem(antiga), 'Elmo de Aço');
  R.admin.subirNivel(p, 14); R.escolherSegundaClasse(p, 'paladino');
  const cj = Object.assign(R.novoItem('elmo', 'cavaleiro', 'epica', Math.random, null, 15), { conjunto: 'paladino-2' });
  assert.strictEqual(R.nomeItem(cj), 'Elmo do Juramento');
});

teste('atividades: soma o tempo logado e, só quando caça, o tempo caçando', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(p.atividade, undefined, 'personagem antigo/novo começa sem registro');
  R.registrarAtividade(p, 30, false);
  R.registrarAtividade(p, 90, true);
  R.registrarAtividade(p, 0, true);
  R.registrarAtividade(p, -5, true);
  R.registrarAtividade(p, NaN, true);
  assert.deepStrictEqual(Object.assign({}, p.atividade), { logado: 120, cacando: 90 });
});

teste('encanto em %: +5% do item por nível; roxo +0 ganha de azul +4 do mesmo nível', () => {
  const arma = (raridade, encanto) => ({ tipo: 'arma', arma: 'espada', classe: 'cavaleiro', raridade, encanto, nivel: 20, dano: [20, 40] });
  assert.deepStrictEqual(Array.from(R.danoArma(arma('rara', 0))), [20, 40]);
  assert.deepStrictEqual(Array.from(R.danoArma(arma('rara', 4))), [24, 48]);
  assert.deepStrictEqual(Array.from(R.danoArma(arma('lendaria', 10))), [30, 60]);
  assert.strictEqual(R.multEncanto({ encanto: 0 }), 1);
  // armadura: +5% do bônus principal por nível, mínimo +1 por nível
  const elmo = (encanto, def) => ({ tipo: 'elmo', classe: 'cavaleiro', raridade: 'rara', encanto, nivel: 20, bonus: { defesa: def, vida: 50 } });
  assert.strictEqual(R.bonusItem(elmo(4, 100)).defesa, 120);
  assert.strictEqual(R.bonusItem(elmo(4, 5)).defesa, 9, 'mínimo +1 por nível');
  assert.strictEqual(R.bonusItem(elmo(4, 100)).vida, 50, 'só o bônus principal');
  // mesma arma, mesmo nível: a pior épica (+0) ganha da melhor rara +4
  for (const nivel of [5, 12, 20, 40, 60]) {
    const ep = R.danoDoNivel(nivel, D.ITEM_NIVEL.faixaQualidade.epica[0]);
    const ra = R.danoDoNivel(nivel, D.ITEM_NIVEL.faixaQualidade.rara[1] - 0.001);
    const mRa = R.danoArma({ tipo: 'arma', arma: 'espada', classe: 'cavaleiro', raridade: 'rara', encanto: 4, dano: ra });
    const mEp = R.danoArma({ tipo: 'arma', arma: 'espada', classe: 'cavaleiro', raridade: 'epica', encanto: 0, dano: ep });
    assert.ok(mEp[0] + mEp[1] >= mRa[0] + mRa[1], 'nível ' + nivel + ': épica ' + mEp + ' x rara+4 ' + mRa);
  }
  // cada raridade ~25–35% acima da anterior
  const m = (q) => R.danoDoNivel(40, q).reduce((a, b) => a + b);
  assert.ok(m(0.8) / m(0.55) > 1.2 && m(0.8) / m(0.55) < 1.4, 'épica/rara ' + (m(0.8) / m(0.55)).toFixed(2));
});

teste('tipos de arma equilibrados: o fator vale para o golpe inteiro (arma + herói)', () => {
  const dpt = (tipo, bonusHeroi) => { const t = D.TIPOS_ARMA[tipo]; return (20 + bonusHeroi) * t.fator * D.VELOCIDADE_ARMA[t.vel]; };
  for (const b of [0, 10, 40]) {
    const normal = dpt('arco', b);
    assert.ok(Math.abs(dpt('adaga', b) / normal - 1) < 0.01, 'rápida = normal');
    assert.ok(Math.abs(dpt('besta', b) / normal - 1) < 0.01, 'lenta de uma mão = normal');
    assert.ok(Math.abs(dpt('balestra', b) / normal - 1.12) < 0.01, 'lenta de duas mãos = +12%');
  }
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  p.inventario.push({ id: 'b', tipo: 'arma', classe: 'arqueiro', arma: 'balestra', raridade: 'comum', variacao: 0, dano: [10, 20], encanto: 0 });
  p.equipados.arma = 'b';
  const bonus = R.status(p).ataque;
  assert.deepStrictEqual([...R.status(p).dano], [Math.round((10 + bonus) * 1.4), Math.round((20 + bonus) * 1.4)]);
});

teste('Double Shot (Arqueiro): 2 flechas de 100% (+3% por ponto) no mesmo turno, na caçada e na masmorra', () => {
  const def = D.SEGUNDAS_CLASSES.cacador.habilidades.find((h) => h.id === 'pes-ligeiros');
  assert.strictEqual(def.nome, 'Double Shot');
  assert.strictEqual(def.tipo, 'multiplo');
  assert.strictEqual(R.multHabilidade(def, 1), 103);
  assert.strictEqual(R.multHabilidade(def, 10), 130);
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  R.admin.subirNivel(p, 14); R.escolherSegundaClasse(p, 'cacador');
  for (let i = 0; i < 4; i++) R.mudarPontoHabilidade(p, 'pes-ligeiros', 1);
  R.talentos(p).ordem.cacada = ['pes-ligeiros'];
  const b = R.iniciarBatalha(p, 'lobo', rng);
  b.monstro.hp = 1e9; b.monstro.hpMax = 1e9; b.jogador.hp = 1e9;
  let ev = null;
  for (let i = 0; i < 50 && !ev; i++) { const e = R.passo(b); if (e && e.habilidade === 'Double Shot') ev = e; }
  assert.ok(ev, 'usou o Double Shot');
  assert.strictEqual(ev.golpes.length, 2, 'duas flechas');
  // masmorra: duas flechas aparecem como dois golpes logo depois do nome da habilidade
  const herois = [p, p, p].map((x) => JSON.parse(JSON.stringify(x)));
  herois.forEach((h) => { R.talentos(h).ordem.masmorra = ['pes-ligeiros']; });
  const sim = R.simularMasmorra(herois, 'toca', 123);
  const lista = sim.eventos || sim.log || sim;
  const arr = Array.isArray(lista) ? lista : [];
  const i = arr.findIndex((e) => e.tipo === 'hab' && e.nome === 'Double Shot');
  assert.ok(i >= 0, 'usou na masmorra');
  assert.ok(arr[i + 1].tipo === 'golpe' && arr[i + 2].tipo === 'golpe' && arr[i + 1].i === arr[i].i && arr[i + 2].i === arr[i].i, 'duas flechas do mesmo herói');
});

teste('área abaixo do nível: exp e ouro reduzidos juntos e nenhum drop (item, pergaminho, chefe)', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const vencer = (id) => { const b = R.iniciarBatalha(p, id, rng); b.fim = 'vitoria'; return R.concluirBatalha(p, b); };
  // Floresta: a próxima área (Pântano) abre no 5. Level 7 = 2 acima: sem penalidade.
  p.nivel = 7;
  let r = vencer('urso');
  assert.deepStrictEqual([r.fatorExp, r.ouro, r.exp, !!r.penalizado], [100, D.monstros.urso.ouro, D.monstros.urso.exp, false]);
  // 3 a 7 acima: 50%
  p.nivel = 8; p.exp = 0;
  r = vencer('urso');
  assert.deepStrictEqual([r.fatorExp, r.ouro, r.exp, r.penalizado], [50, Math.floor(D.monstros.urso.ouro / 2), Math.floor(D.monstros.urso.exp / 2), true]);
  // 8 ou mais acima: 10%; nada cai em 3.000 vitórias (itens, pergaminhos) nem do chefe
  p.atributos.sor = 200;
  let drops = 0;
  for (let i = 0; i < 3000; i++) { p.nivel = 13; p.exp = 0; r = vencer('urso'); if (r.drop || r.dropArmadura || r.pergaminho) drops++; }
  assert.strictEqual(drops, 0);
  assert.strictEqual(r.fatorExp, 10);
  assert.strictEqual(r.ouro, Math.max(1, Math.floor(D.monstros.urso.ouro / 10)));
  const perg = { ...p.pergaminhos };
  r = vencer('velgrath');
  assert.ok(!r.drop && !r.dropArmadura && !r.pergaminho, 'chefe também não dropa');
  assert.deepStrictEqual({ ...p.pergaminhos }, perg);
});
