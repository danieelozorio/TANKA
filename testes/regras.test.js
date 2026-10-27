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
  p.inventario.push({ id: 'x', classe: 'cavaleiro', raridade: 'epica' });
  assert.ok(!R.equipar(p, 'x'));
  p.inventario.push({ id: 'y', classe: 'mago', raridade: 'rara' });
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
  assert.ok(!R.vender(p, p.armaEquipada));
  p.inventario.push({ id: 'e', classe: 'arqueiro', raridade: 'epica' });
  assert.ok(R.vender(p, 'e'));
  assert.strictEqual(p.ouro, 50);
  assert.strictEqual(p.inventario.length, 1);
});

teste('comprar: desconta o ouro e só com saldo suficiente', () => {
  const p = R.criarPersonagem('T', 'feminino', 'elfo', 'arqueiro');
  p.ouro = 109;
  const item = R.comprar(p, 'rara');
  assert.ok(item);
  assert.strictEqual(item.classe, 'arqueiro');
  assert.strictEqual(R.nomeArma(item), 'Arco Élfico');
  assert.strictEqual(p.ouro, 9);
  assert.strictEqual(R.comprar(p, 'comum'), null);
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
