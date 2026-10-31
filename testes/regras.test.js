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
  assert.deepStrictEqual([...lobo.ataque, ...cobra.ataque, ...urso.ataque, ...D.monstros.velgrath.ataque], [5, 10, 7, 12, 10, 15, 15, 20]);
  assert.deepStrictEqual(['sapo', 'aranha', 'troll', 'morgath'].map((m) => [...D.monstros[m].ataque]), [[10, 15], [15, 20], [18, 22], [25, 30]]);
});

teste('velocidade e defesa dos monstros: 15, +10% por monstro, +10% entre áreas; chefe +50% / defesa x2', () => {
  const v = (id) => D.monstros[id].velocidade, d = (id) => D.monstros[id].defesa;
  assert.deepStrictEqual(['lobo', 'cobra', 'urso', 'velgrath'].map(v), [15, 17, 18, 27]);
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
  assert.strictEqual(R.status(p).hpMax, 105);
  assert.strictEqual(p.hpAtual, 105);
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

teste('chances de drop (sem sorte): lobo 10% arma comum; cobra 15%; urso 15% item comum de qualquer tipo', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.atributos.sor = 0;
  const N = 100000, taxa = (fn) => { let n = 0; for (let i = 0; i < N; i++) if (fn()) n++; return n / N * 100; };
  assert.ok(Math.abs(taxa(() => R.rolarDrop(p, 'lobo', rng)) - 10) < 0.5);
  assert.ok(Math.abs(taxa(() => R.rolarDrop(p, 'cobra', rng)) - 15) < 0.5);
  assert.strictEqual(R.rolarDrop(p, 'urso', rng), null);
  const tipos = new Set(), rar = new Set();
  const t = taxa(() => { const d = R.rolarDropItem(p, 'urso', rng); if (d) { tipos.add(d.tipo); rar.add(d.raridade); } return d; });
  assert.ok(Math.abs(t - 15) < 0.5, t);
  assert.deepStrictEqual([...tipos].sort(), ['arma', 'botas', 'elmo', 'luvas', 'peitoral']); // sem colar/anel
  assert.deepStrictEqual([...rar], ['comum']);
});

teste('drop de arma é sempre da classe, com variação e dano sorteados na faixa', () => {
  for (const classe of ['cavaleiro', 'arqueiro', 'mago', 'artesao']) {
    const p = R.criarPersonagem('T', 'masculino', 'humano', classe);
    let d = null;
    while (!d) d = R.rolarDrop(p, 'gargula', rng);
    assert.strictEqual(d.classe, classe);
    assert.strictEqual(d.raridade, 'rara');
    assert.ok(d.dano[0] >= 11 && d.dano[0] <= 15 && d.dano[1] >= 16 && d.dano[1] <= 20, d.dano);
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
  assert.deepStrictEqual([...s.dano], [1 + Math.floor(23 / 5), 5 + Math.floor(23 / 5)]);
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
  assert.deepStrictEqual([...R.status(p).danoArma], [1, 5]);
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

teste('encantamento: dano extra por nível e venda +20% por nível', () => {
  assert.deepStrictEqual([...R.danoArma({ tipo: 'arma', classe: 'arqueiro', raridade: 'rara', encanto: 5, dano: [12, 18] })], [22, 28]);
  assert.deepStrictEqual([...R.danoArma({ tipo: 'arma', classe: 'arqueiro', raridade: 'lendaria', encanto: 10, dano: [33, 39] })], [83, 89]);
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
  assert.strictEqual(s1.hpMax, s0.hpMax + 40 + 4 * 5); // vida do peitoral + 4 RES * 5 HP
  assert.strictEqual(R.atributosTotais(p).sor, p.atributos.sor + 2);
  assert.strictEqual(s1.chanceCritico, (p.atributos.sor + 2) * 0.5);
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

teste('drops de armadura: lobo 10% comum; cobra 15% comum', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'artesao');
  p.atributos.sor = 0;
  const N = 200000, conta = (m) => { const c = {}; for (let i = 0; i < N; i++) { const d = R.rolarDropArmadura(p, m, rng); if (d) c[d.raridade] = (c[d.raridade] || 0) + 1; } return c; };
  const lobo = conta('lobo'), cobra = conta('cobra');
  assert.ok(Math.abs(lobo.comum / N * 100 - 10) < 0.4, JSON.stringify(lobo));
  assert.ok(Math.abs(cobra.comum / N * 100 - 15) < 0.4 && !cobra.rara, JSON.stringify(cobra));
  const tipos = new Set(); for (let i = 0; i < 2000; i++) { const d = R.rolarDropArmadura(p, 'cobra', rng); if (d) { tipos.add(d.tipo); if (d.tipo !== 'colar' && d.tipo !== 'anel') assert.strictEqual(d.classe, 'artesao'); } }
  assert.deepStrictEqual([...tipos].sort(), ['botas', 'elmo', 'luvas', 'peitoral']);
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
    assert.strictEqual(m1.hp, a.base.hp); assert.strictEqual(m1.exp, a.base.exp);
    const cr = a.crescimento || D.crescimento;
    [m1, m2, m3].forEach((m, i) => {
      assert.strictEqual(m.hp, a.base.hp * 2 ** i); assert.strictEqual(m.exp, a.base.exp * 2 ** i);
      assert.ok(m.ataque[0] < m.ataque[1], 'dano em faixa');
    });
    assert.ok(m1.velocidade < m2.velocidade && m2.velocidade < m3.velocidade);
    const c = D.monstros[a.chefe.id];
    assert.ok(c.chefe);
    assert.strictEqual(c.hp, Math.round(m3.hp * 1.5)); assert.ok(c.ataque[0] > m3.ataque[0]);
    assert.ok(Math.abs(c.velocidade - m3.velocidade * 1.5) <= 1); assert.strictEqual(c.exp, a.chefe.exp != null ? a.chefe.exp : m3.exp * 5);
    assert.strictEqual(c.ouro, a.chefe.ouro != null ? a.chefe.ouro : m3.ouro * 5);
  }
  assert.deepStrictEqual(['sapo', 'troll', 'elemental'].map((k) => D.monstros[k].hp), [70, 280, 2200]);
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
      const b = R.iniciarBatalha(p, chefe, rng); b.fim = 'vitoria';
      const res = R.concluirBatalha(p, b);
      const it = res.drop || res.dropArmadura;
      if (it) { c[it.raridade]++; if (it.tipo !== 'colar' && it.tipo !== 'anel') assert.strictEqual(it.classe, 'mago'); } else c.nada++;
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

teste('Pergaminho do Recomeço: compra com 500 de reputação e devolve os pontos', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  R.admin.subirNivel(p, 4);
  const livres = p.pontosLivres;
  R.distribuirPonto(p, 'for'); R.distribuirPonto(p, 'for');
  assert.strictEqual(R.usarRecomeco(p), 'Você não tem Pergaminho do Recomeço.');
  p.reputacao = 499;
  assert.strictEqual(R.comprarRecomeco(p), 'Reputação insuficiente.');
  p.reputacao = 600;
  assert.strictEqual(R.comprarRecomeco(p), true);
  assert.deepStrictEqual([p.reputacao, p.recomecos], [100, 1]);
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
