// Testes das regras do Tanka. Rodar com: node testes/regras.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
['dados.js', 'regras.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx));
const { dados: D, regras: R } = vm.runInContext('Tanka', ctx);

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

teste('personagem novo: level 1, 100 HP, 0 de ouro, arma comum 1-1', () => {
  const p = R.criarPersonagem('Teste', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(p.nivel, 1);
  assert.strictEqual(R.status(p).hpMax, 100);
  assert.strictEqual(p.hpAtual, 100);
  assert.strictEqual(p.ouro, 0);
  assert.strictEqual(p.sexo, 'masculino');
  const arma = R.armaEquipada(p);
  assert.strictEqual(R.nomeArma(arma), 'Espada de Ferro');
  assert.deepStrictEqual([...D.raridades[arma.raridade].dano], [1, 1]);
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

teste('cobra = 2x lobo, urso = 2x cobra', () => {
  const { lobo, cobra, urso } = D.monstros;
  for (const [a, b] of [[lobo, cobra], [cobra, urso]]) {
    assert.strictEqual(b.hp, a.hp * 2); assert.strictEqual(b.velocidade, a.velocidade * 2);
    assert.strictEqual(b.ataque[0], a.ataque[0] * 2); assert.strictEqual(b.exp, a.exp * 2);
  }
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

teste('velocidade: monstro com o dobro ataca 2x mais', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro'); // DES 10 -> velocidade 10
  p.hpAtual = 1e9; p.atributosIniciais.res = -1e9;            // aguenta a luta toda
  const b = R.iniciarBatalha(p, 'urso', rng);                  // velocidade 32
  b.monstro.hp = 1e9;
  const conta = { jogador: 0, monstro: 0 };
  for (let i = 0; i < 4200; i++) conta[R.passo(b).ator]++;
  const razao = conta.monstro / conta.jogador;
  assert.ok(Math.abs(razao - 3.2) < 0.05, 'razão ' + razao);
});

teste('velocidade 20 vs 10: 2 ataques para 1', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const b = R.iniciarBatalha(p, 'lobo', rng);
  b.jogador.vel = 10; b.monstro.vel = 20; b.jogador.hp = 1e9; b.monstro.hp = 1e9;
  const atores = Array.from({ length: 30 }, () => R.passo(b).ator);
  assert.strictEqual(atores.filter((a) => a === 'monstro').length, 20);
});

teste('chances de drop (sem sorte): cobra 10% rara; urso 10% épica e 30% rara', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.atributos.sor = 0;
  const N = 200000, cont = (id) => {
    const c = { rara: 0, epica: 0 };
    for (let i = 0; i < N; i++) { const d = R.rolarDrop(p, id, rng); if (d) c[d.raridade]++; }
    return { rara: c.rara / N * 100, epica: c.epica / N * 100 };
  };
  const cobra = cont('cobra'), urso = cont('urso');
  assert.ok(Math.abs(cobra.rara - 10) < 0.5 && cobra.epica === 0, JSON.stringify(cobra));
  assert.ok(Math.abs(urso.epica - 10) < 0.5 && Math.abs(urso.rara - 30) < 0.6, JSON.stringify(urso));
  assert.strictEqual(R.rolarDrop(p, 'lobo', rng), null);
});

teste('drop é sempre a arma da classe', () => {
  for (const classe of ['cavaleiro', 'arqueiro', 'mago', 'artesao']) {
    const p = R.criarPersonagem('T', 'masculino', 'humano', classe);
    let d = null;
    while (!d) d = R.rolarDrop(p, 'urso', rng);
    assert.strictEqual(d.classe, classe);
  }
});

teste('sorte: 1% de encantamento por ponto', () => {
  const p = R.criarPersonagem('T', 'masculino', 'anao', 'artesao');
  assert.strictEqual(R.status(p).chanceEncantamento, 23);
});

teste('mago causa dano mágico com INT', () => {
  const p = R.criarPersonagem('T', 'masculino', 'elfo', 'mago');
  const s = R.status(p);
  assert.strictEqual(s.tipoDano, 'magico');
  assert.deepStrictEqual([...s.dano], [1 + Math.floor(23 / 5), 1 + Math.floor(23 / 5)]);
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

teste('raridades: dano e preços de compra e venda', () => {
  const tab = (k) => [...D.raridades[k].dano, D.raridades[k].venda, D.raridades[k].compra];
  assert.deepStrictEqual(tab('comum'), [1, 1, 10, 10]);
  assert.deepStrictEqual(tab('rara'), [3, 5, 20, 100]);
  assert.deepStrictEqual(tab('epica'), [10, 15, 50, 1000]);
  assert.deepStrictEqual(tab('lendaria'), [30, 55, 100, 10000]);
  for (const c of Object.keys(D.classes)) for (const r of Object.keys(D.raridades)) assert.ok(D.armas[c][r], c + ' ' + r);
});

teste('ouro dos monstros: lobo 2, cobra 5, urso 20', () => {
  assert.deepStrictEqual(['lobo', 'cobra', 'urso'].map((m) => D.monstros[m].ouro), [2, 5, 20]);
});

teste('vender: dá ouro e remove o item; arma equipada não pode', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  assert.ok(!R.vender(p, p.equipados.arma));
  p.inventario.push({ id: 'e', tipo: 'arma', classe: 'arqueiro', raridade: 'epica' });
  assert.ok(R.vender(p, 'e'));
  assert.strictEqual(p.ouro, 50);
  assert.strictEqual(p.inventario.length, 1);
});

teste('comprar: desconta o ouro e só com saldo suficiente', () => {
  const p = R.criarPersonagem('T', 'feminino', 'elfo', 'arqueiro');
  p.ouro = 109;
  const item = R.comprar(p, 'rara');
  assert.strictEqual(typeof item, 'object');
  assert.strictEqual(item.classe, 'arqueiro');
  assert.strictEqual(R.nomeArma(item), 'Arco Élfico');
  assert.strictEqual(p.ouro, 9);
  assert.strictEqual(R.comprar(p, 'comum'), 'Ouro insuficiente.');
  assert.strictEqual(p.ouro, 9);
});

teste('personagem antigo (sem ouro/sexo, arma "basica") é convertido', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  delete p.ouro; delete p.sexo; p.inventario[0].raridade = 'basica';
  R.normalizar(p);
  assert.strictEqual(p.ouro, 0);
  assert.strictEqual(p.sexo, 'masculino');
  assert.strictEqual(p.inventario[0].raridade, 'comum');
  assert.deepStrictEqual([...R.status(p).danoArma], [1, 1]);
});

// ---------- Encantamento ----------
const fixo = (v) => () => v; // rng que sempre devolve v (0 = sucesso, 0.999 = falha)
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
  assert.deepStrictEqual([...R.danoArma({ tipo: 'arma', classe: 'arqueiro', raridade: 'rara', encanto: 5 })], [13, 15]);
  assert.deepStrictEqual([...R.danoArma({ tipo: 'arma', classe: 'arqueiro', raridade: 'lendaria', encanto: 10 })], [80, 105]);
  assert.strictEqual(R.precoVenda({ tipo: 'arma', classe: 'arqueiro', raridade: 'epica', encanto: 5 }), 100);
  assert.strictEqual(R.nomeArma({ tipo: 'arma', classe: 'arqueiro', raridade: 'rara', encanto: 5 }), '+5 Arco Élfico');
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
  p.ouro = 60;
  assert.ok(R.comprarPergaminho(p, 'rara')); assert.strictEqual(p.ouro, 10);
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
  for (let i = 0; i < 32; i++) assert.strictEqual(typeof R.comprar(p, 'comum', 'anel'), 'object');
  assert.ok(R.mochilaCheia(p));
  assert.strictEqual(R.comprar(p, 'comum', 'elmo'), 'Mochila cheia!');
  assert.ok(!R.desequipar(p, 'arma'));
  p.atributos.sor = 1000; // garante drop
  const b = R.iniciarBatalha(p, 'urso', rng); b.fim = 'vitoria';
  const res = R.concluirBatalha(p, b);
  assert.ok(res.mochilaCheia);
  assert.strictEqual(R.mochila(p).length, 32);
});

teste('drops de armadura: lobo 10% comum; urso 10% rara e 3% épica', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'artesao');
  p.atributos.sor = 0;
  const N = 200000, conta = (m) => { const c = {}; for (let i = 0; i < N; i++) { const d = R.rolarDropArmadura(p, m, rng); if (d) c[d.raridade] = (c[d.raridade] || 0) + 1; } return c; };
  const lobo = conta('lobo'), urso = conta('urso');
  assert.ok(Math.abs(lobo.comum / N * 100 - 10) < 0.4, JSON.stringify(lobo));
  assert.ok(Math.abs(urso.rara / N * 100 - 10) < 0.4 && Math.abs(urso.epica / N * 100 - 3) < 0.3, JSON.stringify(urso));
  const tipos = new Set(); for (let i = 0; i < 2000; i++) { const d = R.rolarDropArmadura(p, 'cobra', rng); if (d) { tipos.add(d.tipo); if (d.tipo !== 'colar' && d.tipo !== 'anel') assert.strictEqual(d.classe, 'artesao'); } }
  assert.deepStrictEqual([...tipos].sort(), ['anel', 'botas', 'colar', 'elmo', 'luvas', 'peitoral']);
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

teste('áreas: 7 áreas, vida e exp dobram (Floresta dobra tudo), chefe pela regra', () => {
  assert.strictEqual(D.areas.length, 7);
  for (const a of D.areas) {
    const [m1, m2, m3] = a.monstros.map((m) => D.monstros[m.id]);
    assert.strictEqual(m1.hp, a.base.hp); assert.strictEqual(m1.exp, a.base.exp);
    const cr = a.crescimento || D.crescimento;
    [m1, m2, m3].forEach((m, i) => {
      assert.strictEqual(m.hp, a.base.hp * 2 ** i); assert.strictEqual(m.exp, a.base.exp * 2 ** i);
      assert.strictEqual(m.ataque[0], Math.round(a.base.ataque * cr.ataque ** i));
      assert.strictEqual(m.velocidade, Math.round(a.base.velocidade * cr.velocidade ** i));
    });
    const c = D.monstros[a.chefe.id];
    assert.ok(c.chefe);
    assert.strictEqual(c.hp, m3.hp * 3); assert.strictEqual(c.ataque[0], Math.round(m3.ataque[0] * 1.5));
    assert.strictEqual(c.velocidade, m2.velocidade); assert.strictEqual(c.exp, m3.exp * 5); assert.strictEqual(c.ouro, m3.ouro * 5);
  }
  assert.deepStrictEqual(['sapo', 'troll', 'elemental'].map((k) => D.monstros[k].hp), [70, 280, 2200]);
  assert.deepStrictEqual(['sapo', 'aranha', 'troll'].map((k) => D.monstros[k].ataque[0]), [8, 12, 18]);
  assert.deepStrictEqual(['sapo', 'aranha', 'troll'].map((k) => D.monstros[k].velocidade), [9, 11, 14]);
  assert.deepStrictEqual([...D.areas.map((a) => a.chanceChefe)], [1, 0.7, 0.5, 0.3, 0.2, 0.15, 0.1]);
});

teste('áreas bloqueadas por level; chefe não pode ser caçado direto', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  assert.ok(R.podeCacar(p, 'lobo'));
  assert.ok(!R.podeCacar(p, 'sapo'));
  assert.ok(!R.podeCacar(p, 'grakk'));
  R.admin.subirNivel(p, 4);
  assert.strictEqual(p.nivel, 5);
  assert.ok(R.podeCacar(p, 'sapo'));
  assert.ok(!R.podeCacar(p, 'esqueleto'));
});

teste('presença do chefe: soma por abate na área, sorteio e zera ao derrotar', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const vencer = (id) => { const b = R.iniciarBatalha(p, id, rng); b.fim = 'vitoria'; return R.concluirBatalha(p, b); };
  for (let i = 0; i < 30; i++) vencer('lobo');
  assert.strictEqual(p.presencaChefe.floresta, 30);
  R.admin.subirNivel(p, 10);
  for (let i = 0; i < 3; i++) vencer('sapo');
  assert.strictEqual(p.presencaChefe.pantano, 2.1);
  assert.strictEqual(R.sortearChefe(p, 'cobra', () => 0.29), 'grakk');
  assert.strictEqual(R.sortearChefe(p, 'cobra', () => 0.31), null);
  for (let i = 0; i < 200; i++) vencer('urso');
  assert.strictEqual(p.presencaChefe.floresta, 100);
  p.inventario = p.inventario.filter((i) => R.slotDoItem(p, i.id)); // esvazia a mochila
  const res = vencer('grakk');
  assert.strictEqual(p.presencaChefe.floresta, 0);
  assert.strictEqual(p.presencaChefe.pantano, 2.1);
  assert.ok(res.drop || res.dropArmadura, 'chefe sempre dropa');
  assert.ok(res.qtdPergaminhos >= 1 && res.qtdPergaminhos <= 3);
});

teste('drop do chefe: raridades pela tabela (Floresta: lend. 5%, épica 25%, senão rara)', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  p.atributos.sor = 0;
  const c = { lendaria: 0, epica: 0, rara: 0 }, N = 20000;
  for (let i = 0; i < N; i++) {
    p.inventario = p.inventario.slice(0, 1);
    const b = R.iniciarBatalha(p, 'grakk', rng); b.fim = 'vitoria';
    const res = R.concluirBatalha(p, b);
    const it = res.drop || res.dropArmadura;
    c[it.raridade]++;
    if (it.tipo !== 'colar' && it.tipo !== 'anel') assert.strictEqual(it.classe, 'mago');
  }
  assert.ok(Math.abs(c.lendaria / N * 100 - 5) < 0.8 && Math.abs(c.epica / N * 100 - 25) < 1.5, JSON.stringify(c));
});
