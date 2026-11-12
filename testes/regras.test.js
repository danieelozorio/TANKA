// Testes das regras do Tanka. Rodar com: node testes/regras.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = {};
vm.createContext(ctx);
['dados.js', 'historia.js', 'regras.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx));
const { dados: D, regras: R } = vm.runInContext('Tanka', ctx);
D.HABILIDADES_ATIVAS = true; // os testes de habilidade continuam valendo para quando religar

const fixo = (v) => () => v; // rng que sempre devolve v (0 = sucesso, 0.999 = falha)
const fixo0 = fixo(0);
let rngSeed = 42;
function rng() { rngSeed = (rngSeed * 1664525 + 1013904223) % 4294967296; return rngSeed / 4294967296; }

function teste(nome, fn) {
  try { fn(); console.log('ok   ' + nome); } catch (e) { console.log('FALHA ' + nome + '\n     ' + e.message); process.exitCode = 1; }
}

teste('atributos iniciais das classes: todas com 70 pontos (nov/2026)', () => {
  assert.deepStrictEqual({ ...R.atributosIniciais('humano', 'cavaleiro') }, { for: 15, des: 10, res: 20, int: 10, sor: 15 });
  assert.deepStrictEqual({ ...R.atributosIniciais('humano', 'arqueiro') }, { for: 15, des: 20, res: 10, int: 10, sor: 15 });
  assert.deepStrictEqual({ ...R.atributosIniciais('humano', 'mago') }, { for: 10, des: 15, res: 10, int: 20, sor: 15 });
  for (const c of Object.keys(D.classes)) assert.strictEqual(Object.values(D.classes[c].atributos).reduce((a, b) => a + b), 70, c);
  assert.deepStrictEqual({ ...R.atributosIniciais('humano', 'artesao') }, { for: 15, des: 10, res: 15, int: 10, sor: 20 });
});

teste('raças: não mudam os atributos; traços em % (Humano equilibrado)', () => {
  assert.deepStrictEqual({ ...R.atributosIniciais('elfo', 'mago') }, { ...D.classes.mago.atributos });
  const s = (raca) => { const p = R.criarPersonagem('T', 'masculino', raca, 'cavaleiro'); p.nivel = 20; p.atributos.des = 30; return R.status(p); };
  const h = s('humano'), el = s('elfo'), en = s('elfoNegro'), o = s('orc'), an = s('anao');
  assert.ok(el.chanceCritico > h.chanceCritico && el.velocidade > h.velocidade && el.hpMax < h.hpMax && el.dano[1] < h.dano[1], 'elfo');
  assert.ok(en.danoCritico > h.danoCritico && en.dano[1] > h.dano[1] && en.hpMax < h.hpMax, 'elfo negro');
  assert.ok(o.hpMax > h.hpMax && o.dano[1] > h.dano[1] && o.chanceCritico < h.chanceCritico && o.velocidade < h.velocidade && o.evasao < h.evasao, 'orc');
  assert.ok(an.hpMax > h.hpMax && an.hpMax < o.hpMax && an.dano[1] >= h.dano[1] && an.dano[1] <= o.dano[1]
    && an.chanceCritico < h.chanceCritico && an.velocidade < h.velocidade, 'anão');
});

teste('personagem antigo: atributos convertidos para os da classe, pontos distribuídos mantidos (uma vez)', () => {
  const p = R.criarPersonagem('T', 'masculino', 'orc', 'cavaleiro');
  delete p.atributosV2;
  p.atributosIniciais = { for: 18, des: 7, res: 23, int: 7, sor: 10 };
  p.atributos = { for: 38, des: 7, res: 30, int: 7, sor: 10 };   // +20 FOR e +7 RES distribuídos
  R.normalizar(p);
  assert.deepStrictEqual({ ...p.atributos }, { for: 35, des: 10, res: 27, int: 10, sor: 15 });
  R.normalizar(p);
  assert.strictEqual(p.atributos.for, 35, 'só uma vez');
});

teste('personagem novo: level 1, vida 100 + 3 por RES acima de 10, 0 de ouro, arma comum 1-5', () => {
  const p = R.criarPersonagem('Teste', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(p.nivel, 1);
  assert.strictEqual(R.status(p).hpMax, 130);   // RES 20 da classe = +30 de vida
  assert.strictEqual(p.hpAtual, 130);
  assert.strictEqual(R.status(R.criarPersonagem('M', 'masculino', 'humano', 'mago')).hpMax, 100);
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

teste('cobra = 2x lobo, urso = 2x cobra (vida); exp 2, 5 e 10; dano em faixa', () => {
  const { lobo, cobra, urso } = D.monstros;
  for (const [a, b] of [[lobo, cobra], [cobra, urso]]) {
    assert.strictEqual(b.hp, a.hp * 2);
  }
  assert.deepStrictEqual([...lobo.ataque, ...cobra.ataque, ...urso.ataque, ...D.monstros.velgrath.ataque], [3, 5, 4, 6, 5, 8, 8, 10]);
  assert.deepStrictEqual(['sapo', 'aranha', 'troll', 'morgath'].map((m) => [...D.monstros[m].ataque]), [[10, 15], [15, 20], [18, 22], [25, 30]]);
});

teste('velocidade dos monstros: 70/80/90% do herói (arma normal) no level mínimo da área; chefe = 3º; defesa', () => {
  const v = (id) => D.monstros[id].velocidade, d = (id) => D.monstros[id].defesa;
  assert.deepStrictEqual(['lobo', 'cobra', 'urso', 'velgrath'].map(v), [11, 12, 14, 14]);
  assert.deepStrictEqual(['escorpiao', 'lagarto', 'mumia', 'farao'].map(v), [32, 36, 41, 41]);   // Areias (level 20: herói 45)
  // o herói no level mínimo de cada área é sempre mais rápido que qualquer monstro dela (com arma normal)
  D.areas.forEach((a) => { const h = Math.round(15 * Math.pow(1.06, a.nivelMin - 1)); a.monstros.forEach((m) => assert.ok(v(m.id) < h, m.id)); });
  assert.strictEqual(d('lobo'), 1);
  assert.strictEqual(d('velgrath'), d('urso') * 2);
  assert.ok(d('salamandra') > 20 && d('ignaroth') < 100, d('salamandra') + ' ' + d('ignaroth'));
  const urso = D.monstros.urso, chefe = D.monstros.velgrath;
  assert.strictEqual(chefe.hp, urso.hp * 1.5);
  assert.strictEqual(chefe.exp, urso.exp * 5);
});

teste('caçada: o herói acerta pelo menos 95% dos golpes, mesmo sem precisão e na última área', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const b = R.iniciarBatalha(p, 'elemental', rng);
  b.s = Object.assign({}, b.s, { precisao: 0 });
  b.monstro.hp = b.monstro.hpMax = 1e12; b.jogador.hp = b.jogador.hpMax = 1e12;
  let acertos = 0, n = 0;
  while (n < 20000) { const ev = R.passo(b); if (ev && ev.ator === 'jogador') { n++; if (ev.acerto) acertos++; } }
  assert.ok(acertos / n > 0.94 && acertos / n < 0.96, String(acertos / n));
});

teste('exp por level: igual até o 19; depois +30% por level até o 29 e +12% do 30 em diante', () => {
  assert.deepStrictEqual([1, 5, 6, 19].map(R.expNecessaria), [10, 160, 240, 46709]);
  assert.strictEqual(R.expNecessaria(20), Math.round(160 * Math.pow(1.5, 14) * 1.3));
  assert.ok(Math.abs(R.expNecessaria(30) / R.expNecessaria(29) - 1.12) < 0.001);
  // monstros do meio da área para subir: nunca passa de ~420 por level
  const area = (n) => D.areas.filter((a) => a.nivelMin <= n).pop();
  for (let n = 15; n < D.NIVEL_MAXIMO; n++) assert.ok(R.expNecessaria(n) / D.monstros[area(n).monstros[1].id].exp < 420, 'level ' + n);
});

teste('caçada: Curandeiro com Bênção (reforço de grupo) não trava a luta e vale só para ele', () => {
  const p = R.criarPersonagem('C', 'feminino', 'humano', 'mago'); p.nivel = 16; p.atributos.int += 45;
  p.talentos = { classe2: 'curandeiro', pontos: { bencao: 4, 'explosao-de-luz': 10 }, ordem: { cacada: ['bencao', 'explosao-de-luz'], masmorra: [], arena: [], defesa: [] } };
  let vitorias = 0, bencao = 0;
  for (let i = 0; i < 50; i++) {
    p.hpAtual = R.status(p).hpMax;
    const b = R.iniciarBatalha(p, 'golem', rng); b.auto = true;
    let g = 0;
    while (!b.fim && g < 3000) { const ev = R.passo(b); if (ev && ev.reforco === 'Bênção') bencao++; g++; }
    assert.ok(b.fim, 'a luta termina');
    if (b.fim === 'vitoria') vitorias++;
  }
  assert.ok(bencao > 0, 'usou a Bênção');
  assert.ok(vitorias > 40, 'vence o Golem: ' + vitorias);
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
  assert.strictEqual(R.status(p).hpMax, 133);   // +3 de vida por ponto de RES
  assert.strictEqual(p.hpAtual, 133);
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

teste('drops da caçada (a Sorte não muda): 1º monstro 5%, 2º 8%, 3º 10% de arma e de armadura; pergaminho 2%, 4% e 10%', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.atributos.sor = 0;
  const N = 200000, taxa = (fn) => { let n = 0; for (let i = 0; i < N; i++) if (fn()) n++; return n / N * 100; };
  const esperado = [[5, 5, 2], [8, 8, 4], [10, 10, 10]];
  D.areas.forEach((area) => area.monstros.forEach((mm, i) => {
    const m = D.monstros[mm.id];
    assert.strictEqual(m.chanceArma, esperado[i][0], mm.id);
    assert.strictEqual(m.chanceArmadura, esperado[i][1], mm.id);
    assert.strictEqual(m.pergaminho ? m.pergaminho.chance : 0, esperado[i][2], mm.id);
    assert.strictEqual(R.rolarDropItem(p, mm.id, rng), null, 'não existe mais "qualquer item"');
  }));
  for (const [id, arma, perg] of [['lobo', 5, 2], ['aranha', 8, 4], ['urso', 10, 10], ['elemental', 10, 10]]) {
    const t = taxa(() => R.rolarDrop(p, id, rng));
    assert.ok(Math.abs(t - arma) < 0.3, id + ' arma ' + t);
    const ta = taxa(() => R.rolarDropArmadura(p, id, rng));
    assert.ok(Math.abs(ta - arma) < 0.3, id + ' armadura ' + ta);
    const tp = taxa(() => R.rolarPergaminho(p, id, rng));
    assert.ok(Math.abs(tp - perg) < 0.3, id + ' pergaminho ' + tp);
  }
  // A Sorte voltou a aumentar o drop: +0,2% sobre a chance base por ponto (200 de SOR = 5% x 1,4 = 7%)
  p.atributos.sor = 200;
  const comSorte = taxa(() => R.rolarDrop(p, 'lobo', rng));
  assert.ok(Math.abs(comSorte - 7) < 0.3, 'com sorte ' + comSorte);
  assert.ok(Math.abs(taxa(() => R.rolarPergaminho(p, 'urso', rng)) - 10) < 0.3, 'pergaminho com sorte');
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

teste('anel: dano ~15% de uma arma do nível, defesa mágica (rara+), atributos e regen (épica+), vida (lendária); antigo vira novo', () => {
  let x = 1; const rng2 = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  const anel = (rar, n) => R.novoItem('anel', null, rar, rng2, null, n);
  const c = anel('comum', 20), ra = anel('rara', 20), e = anel('epica', 20), l = anel('lendaria', 20);
  assert.deepStrictEqual(Object.keys(c.bonus), ['dano']);
  assert.deepStrictEqual(Object.keys(ra.bonus).sort(), ['dano', 'defesaMagica']);
  const attrs = (b) => Object.keys(b).filter((k) => ['for', 'des', 'res', 'int', 'sor'].includes(k));
  assert.strictEqual(attrs(e.bonus).length, 1); assert.ok(!('regen' in e.bonus)); assert.ok(!e.bonus.vida);
  assert.strictEqual(attrs(l.bonus).length, 2); assert.ok(!('regen' in l.bonus)); assert.ok(l.bonus.vida > 0);
  const arma = R.novoItem('arma', 'cavaleiro', 'rara', rng2, null, 20), media = (arma.dano[0] + arma.dano[1]) / 2;
  assert.ok(ra.bonus.dano >= 2 && ra.bonus.dano <= 4 && ra.bonus.dano < media / 4, ra.bonus.dano + ' vs ' + media);
  // anel de antes com regeneração: perde a regeneração ao carregar (nov/2026)
  const pr = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  pr.inventario.push({ id: 'reg', tipo: 'anel', classe: null, raridade: 'epica', encanto: 0, nivel: 20, bonus: { dano: 3, regen: 1 } });
  R.normalizar(pr);
  assert.ok(!('regen' in pr.inventario.find((i) => i.id === 'reg').bonus));
  // anel antigo (Sorte) vira novo ao carregar o personagem
  const q = R.criarPersonagem('Q', 'masculino', 'humano', 'cavaleiro');
  q.inventario.push({ id: 'velho', tipo: 'anel', classe: null, raridade: 'lendaria', encanto: 3, bonus: { sor: 9 } });
  R.normalizar(q);
  const v = q.inventario.find((i) => i.id === 'velho');
  assert.ok(v.bonus.dano > 0 && !('regen' in v.bonus) && !('sor' in v.bonus && Object.keys(v.bonus).length === 1));
  assert.strictEqual(v.encanto, 3);
});

teste('sorte: 0,5% de encantamento por ponto; não mexe no crítico físico', () => {
  const p = R.criarPersonagem('T', 'masculino', 'anao', 'artesao');
  assert.strictEqual(R.status(p).chanceEncantamento, 10);
  assert.strictEqual(R.status(p).bonusDrop, undefined);
  const q = R.criarPersonagem('T', 'masculino', 'anao', 'artesao'); q.atributos.sor += 50;
  assert.strictEqual(R.status(q).chanceCritico, R.status(p).chanceCritico);
  assert.strictEqual(R.status(q).chanceCriticoMagico, R.status(p).chanceCriticoMagico + 50, 'crítico mágico continua com a Sorte');
});

teste('mago causa dano mágico com INT', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  const s = R.status(p);
  assert.strictEqual(s.tipoDano, 'magico');
  assert.deepStrictEqual([...s.dano], [Math.round((1 + Math.floor(20 / 3)) * 1.4), Math.round((5 + Math.floor(20 / 3)) * 1.4)]);   // (cajado + 1 a cada 3 de INT) x1,4
  assert.strictEqual(s.chanceCriticoMagico, R.atributosTotais(p).sor, 'crítico mágico: 1% por ponto de Sorte');
});

teste('batalha completa contra o lobo termina e aplica resultado', () => {
  let vitorias = 0;
  for (let i = 0; i < 200; i++) {
    const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
    R.atualizarVitalidade(p, Date.now()).pts = 0;   // sem Vitalidade: valores base
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
  assert.strictEqual(D.monstros.velgrath.exp, 50);
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
  R.mudarPergaminho(p, raridade, 5);
  return { p, item };
}

teste('encantamento: +1 a +3 é seguro e gasta 1 pergaminho', () => {
  const { p, item } = comArma('rara', 0);
  for (let i = 0; i < 3; i++) assert.ok(R.encantar(p, 'x', fixo(0.999)).sucesso);
  assert.strictEqual(item.encanto, 3);
  assert.strictEqual(R.qtdPergaminho(p, 'rara'), 2);
});

teste('encantamento: chances por nível, bônus de Sorte e teto por nível (+10 no máximo 20%)', () => {
  const { p, item } = comArma('rara', 3);
  assert.deepStrictEqual([3, 4, 5, 6, 7, 8, 9].map((e) => { item.encanto = e; return R.chanceEncantar(p, item); }), [70, 60, 50, 40, 30, 20, 10]);
  p.atributos.sor = 20; item.encanto = 3;
  assert.strictEqual(R.chanceEncantar(p, item), 80);   // 0,5% por ponto
  p.atributos.sor = 200;
  assert.deepStrictEqual([3, 4, 5, 6, 7, 8, 9].map((e) => { item.encanto = e; return R.chanceEncantar(p, item); }), [85, 75, 65, 55, 42, 30, 20], 'teto de cada nível');
  p.atributos.sor = 0; p.raca = 'anao'; item.encanto = 9;
  assert.strictEqual(R.chanceEncantar(p, item), 10 + D.encantamento.anao, 'Anão: +3%');
});

teste('Pergaminho de Proteção: se falhar, o item não quebra nem volta a +0', () => {
  let { p, item } = comArma('epica', 8);
  p.equipados.arma = 'x';
  R.mudarConsumivel(p, 'protecao', 'epica', 1);
  const r = R.encantar(p, 'x', fixo(0.999), true);
  assert.ok(!r.sucesso && !r.quebrou && r.protegido);
  assert.strictEqual(item.encanto, 8);
  assert.ok(p.inventario.indexOf(item) >= 0, 'continua na mochila');
  assert.strictEqual(R.qtdConsumivel(p, 'protecao', 'epica'), 0, 'gasta a proteção');
  const r2 = R.encantar(p, 'x', fixo(0.999), true);
  assert.ok(r2.quebrou, 'sem proteção na mochila, quebra');
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
  R.mudarPergaminho(p, 'comum', -1000);
  assert.strictEqual(R.encantar(p, 'x', fixo(0)), null);
});

teste('pergaminhos: preço por raridade e drop do urso (10%)', () => {
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
  assert.ok(Math.abs(n / N * 100 - 10) < 0.5, 'taxa ' + n / N * 100);
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
  assert.deepStrictEqual({ ...R.pergaminhos(p) }, { comum: 10, rara: 10, epica: 10, lendaria: 10 });
});

// ---------- Armaduras e equipamento ----------

teste('armaduras: nomes e bônus por classe e raridade', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  const it = (tipo, rar, classe = 'cavaleiro', encanto = 0) => ({ id: tipo + rar, tipo, classe, raridade: rar, encanto });
  assert.strictEqual(R.nomeItem(it('luvas', 'epica')), 'Manoplas do Crepúsculo');
  assert.strictEqual(R.nomeItem(it('elmo', 'lendaria', 'mago', 3)), '+3 Chapéu da Origem');
  assert.strictEqual(R.nomeItem({ tipo: 'anel', classe: null, raridade: 'rara', encanto: 0 }), 'Anel de Prata');
  assert.deepStrictEqual({ ...R.bonusItem(it('peitoral', 'rara')) }, { defesa: Math.round(8 * D.DEFESA.fator), vida: 40 });   // defesa dos itens x4,5
  assert.deepStrictEqual({ ...R.bonusItem(it('peitoral', 'rara', 'mago')) }, { defesa: Math.round(3 * D.DEFESA.fator), defesaMagica: Math.round(5 * D.DEFESA.fator), vida: 15 });
  assert.deepStrictEqual({ ...R.bonusItem(it('botas', 'comum', 'cavaleiro', 4)) }, { defesa: Math.round(1 * 1.2 * D.DEFESA.fator), res: 1 });   // +4 = +20% (sem o mínimo de +1 por nível)
  assert.deepStrictEqual({ ...R.bonusItem({ tipo: 'anel', classe: null, raridade: 'epica', encanto: 2 }) }, { dano: 3, defesaMagica: Math.round(4 * D.DEFESA.fator) });   // reserva sem nível; encanto no dano
  assert.deepStrictEqual({ ...R.bonusItem({ tipo: 'colar', classe: null, raridade: 'comum', encanto: 1 }) }, { defesaMagica: Math.round(1 * 1.05 * D.DEFESA.fator), vida: 5 });
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
  assert.strictEqual(s1.defesa, s0.defesa + Math.round(8 * D.DEFESA.fator) + Math.round(6 * D.DEFESA.fator)
    + Math.round(24 * D.DEFESA.fator / 10) - Math.round(20 * D.DEFESA.fator / 10));   // +4 RES: cada ponto conta
  assert.strictEqual(s1.hpMax, s0.hpMax + 40 + 4 * 3); // vida do peitoral + 4 RES * 3 HP
  assert.strictEqual(R.atributosTotais(p).sor, p.atributos.sor);   // anel não dá mais Sorte
  assert.deepStrictEqual([...s1.dano], [s0.dano[0] + 2, s0.dano[1] + 2]);   // 2 anéis comuns: +1 de dano cada
  assert.strictEqual(s1.chanceCritico, p.atributos.des * 0.5);   // só a Destreza (a Sorte não conta mais)
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
  assert.strictEqual(p.hpAtual, 130 + 250);
  assert.ok(R.desequipar(p, 'peitoral'));
  assert.strictEqual(p.equipados.peitoral, null);
  assert.strictEqual(p.hpAtual, 130);
  assert.ok(!R.vender(p, p.equipados.arma));
});

teste('mochila: limite de 32 bloqueia compra, drop e desequipar', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  p.ouro = 1e6;
  for (let i = 0; i < 32; i++) assert.strictEqual(typeof R.comprar(p, 'comum', 'botas'), 'object');
  assert.ok(R.mochilaCheia(p));
  assert.strictEqual(R.comprar(p, 'comum', 'elmo'), 'Mochila cheia!');
  assert.ok(!R.desequipar(p, 'arma'));
  const b = R.iniciarBatalha(p, 'urso', rng); b.fim = 'vitoria'; b.rng = () => 0.001; // garante drop
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
  R.mudarPergaminho(p, 'rara', 1);
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
      assert.strictEqual(m.hp, Math.round(a.base.hp * 2 ** i * aj)); assert.strictEqual(m.exp, Math.round(a.base.exp * [1, 2.5, 5][i]));
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
  assert.strictEqual(p.reputacao, 100);   // 40 da missão da Arena + 60 do bônus: paga os 2 potes de estamina
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
  assert.ok(!res.pergaminho || res.qtdPergaminhos === 1);   // pergaminho do chefe: 80% de chance de 1
});

teste('drop do chefe (todos iguais): 4% lendário, 20% épico; 80% de 1 pergaminho com a qualidade da caçada, sem depender da arma', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  p.atributos.sor = 0;
  const N = 20000, rodar = (chefe) => {
    const c = { nada: 0, lendaria: 0, epica: 0, rara: 0, comum: 0 }, perg = { nada: 0, comum: 0, rara: 0, epica: 0, lendaria: 0 };
    for (let i = 0; i < N; i++) {
      p.inventario = p.inventario.slice(0, 1);
      p.nivel = 1; p.exp = 0;   // sem subir de level (acima da área não cai nada)
      const b = R.iniciarBatalha(p, chefe, rng); b.fim = 'vitoria';
      const res = R.concluirBatalha(p, b);
      const it = res.drop || res.dropArmadura;
      if (it) { c[it.raridade]++; if (it.tipo === 'secundaria') assert.strictEqual(it.mao, 'orbe'); else assert.strictEqual(it.classe, 'mago'); } else c.nada++;
      if (res.pergaminho) { assert.strictEqual(res.qtdPergaminhos, 1); perg[res.pergaminho]++; } else perg.nada++;
    }
    return { c, perg };
  };
  for (const chefe of ['velgrath', 'guardiao', 'ignaroth']) {
    const { c, perg } = rodar(chefe);
    assert.ok(Math.abs(c.lendaria / N * 100 - 4) < 0.6 && Math.abs(c.epica / N * 100 - 20) < 1.2 && c.rara + c.comum === 0, chefe + ' ' + JSON.stringify(c));
    const tem = N - perg.nada;
    assert.ok(Math.abs(tem / N * 100 - 80) < 1, chefe + ' pergaminho ' + tem);
    assert.ok(Math.abs(perg.comum / tem * 100 - 70) < 3, chefe + ' qualidade ' + JSON.stringify(perg));
  }
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

teste('estamina: 240, enche sozinha em 90 min (acampar desligado), não passa do máximo; vida sempre cheia fora da luta', () => {
  const p = R.criarPersonagem('Regen', 'masculino', 'humano', 'arqueiro');
  R.atualizarTempo(p, T0);
  assert.strictEqual(p.estamina.pts, 240);
  p.estamina.pts = 0; p.estamina.em = T0; p.hpAtual = 3;
  R.atualizarTempo(p, T0 + 9 * 60000);
  assert.strictEqual(p.estamina.pts, 24);   // 240 / 90 por minuto, sem acampar
  assert.strictEqual(p.hpAtual, R.status(p).hpMax);
  assert.strictEqual(R.minutosParaEstaminaCheia(p), 81);
  R.acampar(p, T0 + 9 * 60000, true);       // acampar desligado: não acampa
  assert.strictEqual(p.acampado, false);
  R.atualizarTempo(p, T0 + 19 * 60000);
  assert.strictEqual(p.estamina.pts, 50);
  assert.strictEqual(R.minutosParaEstaminaCheia(p), 72);
  R.atualizarTempo(p, T0 + 600 * 60000);
  assert.strictEqual(p.estamina.pts, 240);
  // meia-noite: cheia de novo, potes do dia zerados, poções de volta
  p.estamina.pts = 5; p.estamina.potes = 2; p.pocoes = 0;
  R.atualizarTempo(p, T0 + 86400000);
  assert.strictEqual(p.estamina.pts, 240); assert.strictEqual(p.estamina.potes, 0); assert.strictEqual(p.pocoes, 2);
});

teste('estamina: custo 1/2/3 e chefe 5 em todas as áreas; a luta gasta (vitória, derrota e fuga); vida cheia em toda luta', () => {
  D.areas.forEach((a) => {
    assert.strictEqual(a.monstros.map((m) => R.custoEstamina(m.id)).join(), '1,2,3');
    assert.strictEqual(R.custoEstamina(a.chefe.id), 5);
    assert.ok(a.monstros.every((m) => D.monstros[m.id].ataqueCacada) && D.monstros[a.chefe.id].ataqueCacada, 'dano da caçada em ' + a.id);
  });
  const p = R.criarPersonagem('E', 'masculino', 'humano', 'cavaleiro');
  R.atualizarTempo(p, T0);
  p.hpAtual = 1;
  let b = R.iniciarBatalha(p, 'urso', rng);
  assert.strictEqual(b.jogador.hp, b.jogador.hpMax, 'começa a luta com a vida cheia');
  assert.strictEqual(b.ataque.join(), D.monstros.urso.ataqueCacada.join());
  b.fim = 'vitoria';
  let r = R.concluirBatalha(p, b, T0);
  assert.strictEqual(r.estamina, 3); assert.strictEqual(p.estamina.pts, 237);
  b = R.iniciarBatalha(p, 'velgrath', rng); b.fim = 'derrota'; b.jogador.hp = 0;
  p.nivel = 6; p.exp = 100;
  r = R.concluirBatalha(p, b, T0);
  assert.strictEqual(p.estamina.pts, 232); assert.strictEqual(r.expPerdida, 12);
  assert.strictEqual(p.hpAtual, R.status(p).hpMax, 'derrota não deixa o herói sem vida');
  b = R.iniciarBatalha(p, 'lobo', rng);
  R.concluirBatalha(p, b, T0);   // fuga
  assert.strictEqual(p.estamina.pts, 231);
  // sem estamina para o monstro
  p.estamina.pts = 2;
  assert.ok(R.estaminaParaCacar(p, ['urso', 'cobra'])); assert.ok(!R.estaminaParaCacar(p, ['urso']));
  p.estamina.pts = 0; assert.ok(!R.estaminaParaCacar(p));
  // Chefe Mundial: dano antigo do chefe, sem poções
  const bm = R.iniciarBatalha(p, 'ignaroth', rng, { mundial: true });
  assert.strictEqual(bm.ataque.join(), D.monstros.ignaroth.ataque.join()); assert.strictEqual(bm.pocoes, 0);
});

teste('pote de estamina: 40 e 60 de reputação, +240, 2 por dia', () => {
  const p = R.criarPersonagem('Pote', 'masculino', 'humano', 'arqueiro');
  R.atualizarTempo(p, T0);
  p.estamina.pts = 10; p.reputacao = 30;
  assert.strictEqual(R.comprarPoteEstamina(p, T0), 'Reputação insuficiente.');
  p.reputacao = 100;
  assert.strictEqual(R.precoPoteEstamina(p), 40);
  assert.strictEqual(R.comprarPoteEstamina(p, T0), true);
  assert.strictEqual(p.estamina.pts, 250); assert.strictEqual(p.reputacao, 60);
  assert.strictEqual(R.precoPoteEstamina(p), 60);
  assert.strictEqual(R.comprarPoteEstamina(p, T0), true);
  assert.strictEqual(p.estamina.pts, 490); assert.strictEqual(p.reputacao, 0);
  p.reputacao = 500;
  assert.ok(/já usou/.test(R.comprarPoteEstamina(p, T0)));
  // acima do máximo não recarrega nem perde
  R.atualizarTempo(p, T0 + 3600000);
  assert.strictEqual(p.estamina.pts, 490);
});

teste('poção de vida: compra com ouro pelo level, guarda no máximo 2 (VIP 4)', () => {
  const p = R.criarPersonagem('Pocao', 'masculino', 'humano', 'arqueiro');
  R.atualizarTempo(p, T0);
  assert.strictEqual(p.pocoes, 2);
  assert.ok(/máximo/.test(R.comprarPocao(p)));
  p.pocoes = 0; p.ouro = 150;
  assert.strictEqual(R.precoPocao(p), 100);
  assert.strictEqual(R.comprarPocao(p), true);
  assert.strictEqual(p.ouro, 50); assert.strictEqual(p.pocoes, 1);
  assert.strictEqual(R.comprarPocao(p), 'Ouro insuficiente.');
  [[9, 100], [10, 500], [19, 500], [20, 5000], [29, 5000], [30, 10000], [40, 10000]].forEach(([n, o]) => { p.nivel = n; assert.strictEqual(R.precoPocao(p), o); });
  assert.strictEqual(R.maxPocoes(Object.assign({}, p, { vip: true })), 4);
});

teste('poção na batalha: gasta a vez do jogador e desconta ao fim da luta', () => {
  const p = R.criarPersonagem('Bebe', 'masculino', 'humano', 'cavaleiro');
  R.atualizarTempo(p, T0);
  const b = R.iniciarBatalha(p, 'lobo', rng);
  b.jogador.hp = 20;
  assert.strictEqual(R.beberPocao(b), true);
  let ev;
  do { ev = R.passo(b); } while (ev.ator !== 'jogador');
  assert.strictEqual(ev.pocao, true);
  assert.strictEqual(b.jogador.hp, b.jogador.hpMax);
  b.fim = 'fuga';
  R.concluirBatalha(p, b, T0);
  assert.strictEqual(p.pocoes, 1);
});

teste('penalidade de área: só com 2 mapas liberados à frente (50%), 3 ou mais 10%, última área nunca', () => {
  const p = R.criarPersonagem('Exp', 'masculino', 'humano', 'cavaleiro');
  // Floresta: Pântano abre no 5, Ruínas no 10, Torre no 15
  p.nivel = 9; assert.strictEqual(R.fatorExp(p, 'lobo'), 100, '1 mapa à frente');
  p.nivel = 10; assert.strictEqual(R.fatorExp(p, 'lobo'), 50, '2 mapas à frente');
  p.nivel = 14; assert.strictEqual(R.fatorExp(p, 'lobo'), 50);
  p.nivel = 15; assert.strictEqual(R.fatorExp(p, 'lobo'), 10, '3 mapas à frente');
  // sempre 2 mapas sem penalidade: o mais alto liberado e o anterior
  for (let n = 1; n <= 40; n++) {
    p.nivel = n;
    const livres = D.areas.filter((a) => n >= a.nivelMin);
    const semPenalidade = livres.filter((a) => R.fatorExp(p, a.monstros[0].id) === 100).map((a) => a.id);
    assert.deepStrictEqual(semPenalidade, livres.slice(-2).map((a) => a.id), 'level ' + n);
  }
  p.nivel = 40; assert.strictEqual(R.fatorExp(p, 'salamandra'), 100);
  p.nivel = 15;
  const b = R.iniciarBatalha(p, 'lobo', rng);
  b.fim = 'vitoria';
  const res = R.concluirBatalha(p, b, T0);
  assert.strictEqual(res.fatorExp, 10);
  assert.strictEqual(res.exp, Math.max(1, Math.floor(D.monstros.lobo.exp / 10)));
});

teste('derrota tira 5% da exp (não desce de level); habilidades desligadas não disparam', () => {
  const p = R.criarPersonagem('Caido', 'masculino', 'humano', 'mago');
  const b = R.iniciarBatalha(p, 'urso', rng);
  b.fim = 'derrota'; b.jogador.hp = 0;
  p.nivel = 6; p.exp = 100; // level 6 pede 240: perde 5% = 12
  const res = R.concluirBatalha(p, b, T0);
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
  assert.strictEqual(R.qtdPergaminho(p, 'rara'), 0);
  R.admin.vida(p, 0); assert.strictEqual(p.estamina.pts, 0);
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
  R.atualizarVitalidade(p, Date.now()).pts = 0;
  const b = R.iniciarBatalha(p, 'lobo'); b.fim = 'vitoria'; b.monstro.hp = 0;
  const m = D2.monstros.lobo;
  const res = R.concluirBatalha(p, b, Date.now(), { exp: 10, ouro: 50 });
  assert.strictEqual(res.ouro, Math.floor(m.ouro * 1.5));
  assert.strictEqual(res.exp, Math.floor(m.exp * 1.1));
});

teste('caçada contínua: tempo e chance por força do monstro e rastreio (velocidade + sorte) e poção automática', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  // tempo: 2 s para todos os monstros (Henri, 11/11/2026), com qualquer rastreio
  assert.deepStrictEqual(['lobo', 'cobra', 'urso'].map(id => R.tempoBusca(p, id)), [2000, 2000, 2000]);
  p.atributos.sor = 200;
  assert.deepStrictEqual(['lobo', 'cobra', 'urso'].map(id => R.tempoBusca(p, id)), [2000, 2000, 2000]);
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
  assert.deepStrictEqual([...chefeToca.ataque, chefeToca.velocidade], [80, 100, 14], 'masmorra: mesmo dano, mais lenta (velocidade era 18)');
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
  const antes = R.status(p).hpMax;
  assert.strictEqual(R.escolherSegundaClasse(p, 'paladino'), true);
  assert.strictEqual(R.kitHabilidades(p, 'cacada').length, 0, 'sem ponto, nenhuma ativa');
  // passiva fixa (nov/2026): já liga com o valor de 1 ponto e não recebe pontos
  assert.strictEqual(R.status(p).hpMax, Math.round(antes * 1.11), 'passiva fixa: 10% + 1%');
  assert.strictEqual(R.mudarPontoHabilidade(p, 'pele-de-ferro', 1), 'Passiva: sempre ligada, não recebe pontos.');
  for (let i = 0; i < 4; i++) R.mudarPontoHabilidade(p, 'golpe-justo', 1);
  assert.strictEqual(R.pontosHabilidadeLivres(p), 0);
  assert.notStrictEqual(R.mudarPontoHabilidade(p, 'golpe-justo', 1), true, 'sem pontos');
  R.admin.subirNivel(p, 10);
  for (let i = 0; i < 10; i++) R.mudarPontoHabilidade(p, 'golpe-justo', 1);
  assert.strictEqual(R.pontosEm(p, 'golpe-justo'), 10, 'máximo 10');
  assert.strictEqual(R.multHabilidade(D.SEGUNDAS_CLASSES.paladino.habilidades[2], 10), 200);
  // ordem
  assert.deepStrictEqual([...R.talentos(p).ordem.cacada], ['defesa-suprema', 'martelo-sagrado', 'grito-de-desafio', 'golpe-justo']);
  R.moverHabilidade(p, 'cacada', 'golpe-justo', 'subir');
  assert.deepStrictEqual([...R.talentos(p).ordem.cacada], ['defesa-suprema', 'martelo-sagrado', 'golpe-justo', 'grito-de-desafio']);
  R.moverHabilidade(p, 'cacada', 'martelo-sagrado', 'tirar');
  assert.deepStrictEqual([...R.talentos(p).ordem.cacada], ['defesa-suprema', 'golpe-justo', 'grito-de-desafio']);
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

teste('atributos: +1 de dano a cada 3 pontos do atributo da classe (Caçador usa Destreza de novo, 11/11/2026)', () => {
  const c = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  assert.strictEqual(D.classes.arqueiro.nome, 'Caçador');
  assert.strictEqual(D.SEGUNDAS_CLASSES.cacador.nome, 'Arqueiro');
  const antes = R.status(c).dano[0], crit = R.status(c).chanceCritico;
  c.atributos.for += 9; assert.strictEqual(R.status(c).dano[0], antes, 'Força não dá dano ao Caçador');
  c.atributos.des += 9; assert.strictEqual(R.status(c).dano[0], antes + 3, 'Destreza dá o dano do Caçador');
  assert.strictEqual(R.status(c).chanceCritico, crit + 4.5, 'Destreza continua dando crítico');
  // Caçador com level ganha 1 Recomeço de presente, uma vez só; outras classes não
  const a = R.criarPersonagem('A', 'masculino', 'humano', 'arqueiro'); a.nivel = 15; a.recomecos = 0; a.recomecoPresente = 2; delete a.presenteForcaCacador; delete a.presenteDestrezaCacador;
  R.normalizar(a); R.normalizar(a);
  assert.strictEqual(a.recomecos, 2);   // um pela Força (03/11) e um pela volta da Destreza (11/11)
  const m = R.criarPersonagem('M', 'masculino', 'humano', 'mago'); m.nivel = 15; m.recomecos = 0; m.recomecoPresente = 2; delete m.presenteForcaCacador; delete m.presenteDestrezaCacador;
  R.normalizar(m); assert.strictEqual(m.recomecos, 0);
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
  // escudo raro: +10% de defesa (+5% do encanto +1 = 10,5 → 11%) e +5% de vida (nov/2026)
  assert.strictEqual(R.status(p).defesa, Math.round(s0.defesa * 1.11), 'escudo raro +10% de defesa, +1 de encanto');
  assert.strictEqual(R.status(p).hpMax, Math.round(s0.hpMax * 1.05), 'escudo raro +5% de vida');
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
    assert.strictEqual(JSON.stringify(R.bonusItem(it)), JSON.stringify(Object.assign({}, b, { defesa: Math.round(b.defesa * D.DEFESA.fator) })));
    p.inventario = [];
  }
  assert.ok(vistos.size > 3, 'varia');
  const comum = R.comprar(p, 'comum', 'elmo');
  assert.ok(Object.keys(comum.bonus).every((k) => k === 'defesa' || k === 'vida'), 'comum sem atributo extra');
  // item antigo (sem bonus salvo) continua com o valor fixo
  assert.strictEqual(R.bonusItem({ tipo: 'elmo', classe: 'cavaleiro', raridade: 'rara', encanto: 0 }).defesa, Math.round(5 * D.DEFESA.fator));
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
  // compara com as mesmas peças sem o conjunto (a passiva fixa do Paladino muda a defesa das peças, não o bônus do conjunto)
  pecas.forEach((it) => { it.conjunto = undefined; }); const s2sem = R.status(p); pecas.forEach((it) => { it.conjunto = 'paladino-2'; });
  assert.ok(s2.defesa - s2sem.defesa === 23, '2 peças: +23 de defesa (' + (s2.defesa - s2sem.defesa) + ')');
  R.equipar(p, pecas[2].id); const s3 = R.status(p);
  assert.strictEqual(s3.dano[0] - s2.dano[0] - Math.floor((R.atributosTotais(p).for) / 3) + Math.floor((R.atributosTotais(p).for - (pecas[2].bonus.for || 0)) / 3), 5, '3 peças: +5 de dano');
  R.equipar(p, pecas[3].id);
  assert.deepStrictEqual(Object.assign({}, R.bonusConjuntos(p)), { defesa: 23, dano: 5, vida: 30 });
  // outra segunda classe não ganha o bônus
  p.talentos.classe2 = 'destruidor';
  assert.deepStrictEqual(Object.assign({}, R.bonusConjuntos(p)), {});
  // Destruidor: 2 peças = +5 de Força
  pecas.forEach((it) => { it.conjunto = 'destruidor-2'; });
  const forSem = p.atributos.for + R.bonusEquipamentos(p).for;
  assert.strictEqual(R.atributosTotais(p).for, forSem + 5 + 5, 'conjunto +5 e a passiva fixa Força Bruta +5');
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
  // armadura: +5% do bônus principal por nível (sem mínimo: +6 de uma raridade ≈ +0 da seguinte)
  const elmo = (encanto, def) => ({ tipo: 'elmo', classe: 'cavaleiro', raridade: 'rara', encanto, nivel: 20, bonus: { defesa: def, vida: 50 } });
  assert.strictEqual(R.bonusItem(elmo(4, 100)).defesa, Math.round(120 * D.DEFESA.fator));
  assert.strictEqual(R.bonusItem(elmo(4, 5)).defesa, Math.round(6 * D.DEFESA.fator), 'sem o mínimo de +1 por nível');
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
    assert.ok(Math.abs(dpt('espada2m', b) / normal - 1.12) < 0.01, 'lenta de duas mãos = +12%');
    assert.ok(Math.abs(dpt('balestra', b) / normal - 1.12) < 0.01, 'balestra (normal de duas mãos) = +12%');
    assert.ok(Math.abs(dpt('martelo', b) / normal - 1) < 0.01, 'martelo (normal) = normal');
  }
  assert.deepStrictEqual([D.TIPOS_ARMA.martelo.vel, D.TIPOS_ARMA.balestra.vel], ['normal', 'normal']);
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  p.inventario.push({ id: 'b', tipo: 'arma', classe: 'arqueiro', arma: 'balestra', raridade: 'comum', variacao: 0, dano: [10, 20], encanto: 0 });
  p.equipados.arma = 'b';
  const bonus = R.status(p).ataque;
  assert.deepStrictEqual([...R.status(p).dano], [Math.round((10 + bonus) * 1.12), Math.round((20 + bonus) * 1.12)]);
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
  const vencer = (id) => { R.atualizarVitalidade(p, Date.now()).pts = 0; const b = R.iniciarBatalha(p, id, rng); b.fim = 'vitoria'; return R.concluirBatalha(p, b); };
  // Floresta: level 9 = só o Pântano à frente: sem penalidade.
  p.nivel = 9;
  let r = vencer('urso');
  assert.deepStrictEqual([r.fatorExp, r.ouro, r.exp, !!r.penalizado], [100, D.monstros.urso.ouro, D.monstros.urso.exp, false]);
  // 2 mapas à frente (Ruínas no 10): 50%
  p.nivel = 10; p.exp = 0;
  r = vencer('urso');
  assert.deepStrictEqual([r.fatorExp, r.ouro, r.exp, r.penalizado], [50, Math.floor(D.monstros.urso.ouro / 2), Math.floor(D.monstros.urso.exp / 2), true]);
  // 3 mapas à frente (Torre no 15): 10%; nada cai em 3.000 vitórias (itens, pergaminhos) nem do chefe
  p.atributos.sor = 200;
  let drops = 0;
  for (let i = 0; i < 3000; i++) { p.nivel = 15; p.exp = 0; r = vencer('urso'); if (r.drop || r.dropArmadura || r.pergaminho) drops++; }
  assert.strictEqual(drops, 0);
  assert.strictEqual(r.fatorExp, 10);
  assert.strictEqual(r.ouro, Math.max(1, Math.floor(D.monstros.urso.ouro / 10)));
  const perg = { ...R.pergaminhos(p) };
  r = vencer('velgrath');
  assert.ok(!r.drop && !r.dropArmadura && !r.pergaminho, 'chefe também não dropa');
  assert.deepStrictEqual({ ...R.pergaminhos(p) }, perg);
});

teste('troca de pergaminhos: 10 comuns = 1 raro, 10 raros = 1 épico, 10 épicos = 1 lendário', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.pergaminhos = { comum: 25, rara: 9, epica: 10, lendaria: 0 };
  assert.strictEqual(R.trocarPergaminho(p, 'comum').para, 'rara');
  assert.deepStrictEqual({ ...R.pergaminhos(p) }, { comum: 15, rara: 10, epica: 10, lendaria: 0 });
  assert.strictEqual(R.trocarPergaminho(p, 'rara').para, 'epica');
  assert.strictEqual(R.trocarPergaminho(p, 'epica').para, 'lendaria');
  assert.deepStrictEqual({ ...R.pergaminhos(p) }, { comum: 15, rara: 0, epica: 1, lendaria: 1 });
  assert.ok(R.trocarPergaminho(p, 'rara').erro, 'sem 10 não troca');
  assert.ok(R.trocarPergaminho(p, 'lendaria').erro, 'lendário não sobe');
  assert.deepStrictEqual({ ...R.pergaminhos(p) }, { comum: 15, rara: 0, epica: 1, lendaria: 1 });
});

teste('consumíveis: pergaminhos viram itens empilhados (contador antigo migra sozinho)', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(p.pergaminhos, undefined);
  assert.deepStrictEqual(Array.from(R.consumiveis(p)), []);
  // personagem salvo antes: só o contador
  p.pergaminhos = { comum: 3, rara: 0, epica: 2, lendaria: 0 };
  R.normalizar(p);
  assert.strictEqual(p.pergaminhos, undefined, 'o contador some');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(R.consumiveis(p).map((c) => [c.id, c.tipo, c.raridade, c.qtd]))),
    [['pergaminho-comum', 'pergaminho', 'comum', 3], ['pergaminho-epica', 'pergaminho', 'epica', 2]]);
  // ganhar e gastar mantém uma pilha por raridade, em ordem; pilha zerada some
  R.mudarPergaminho(p, 'rara', 1);
  assert.deepStrictEqual(Array.from(R.consumiveis(p).map((c) => c.raridade)), ['comum', 'rara', 'epica']);
  R.mudarPergaminho(p, 'comum', -5);
  assert.deepStrictEqual(Array.from(R.consumiveis(p).map((c) => c.raridade)), ['rara', 'epica']);
  assert.deepStrictEqual({ ...R.pergaminhos(p) }, { comum: 0, rara: 1, epica: 2, lendaria: 0 });
  // um jogo antigo (em cache) que grave o contador de novo: soma na pilha, sem perder nada
  p.pergaminhos = { comum: 0, rara: 4, epica: 0, lendaria: 0 };
  assert.strictEqual(R.qtdPergaminho(p, 'rara'), 5);
  assert.strictEqual(R.nomeConsumivel(R.consumiveis(p)[0]), 'Pergaminho de Encantamento Raro');
  // drops e prêmios entram como item
  const q = R.criarPersonagem('T', 'masculino', 'humano', 'mago');
  let r = null;
  for (let i = 0; i < 5000 && !(r && r.pergaminho); i++) { q.nivel = 1; const b = R.iniciarBatalha(q, 'urso', rng); b.fim = 'vitoria'; r = R.concluirBatalha(q, b); }
  assert.strictEqual(R.qtdPergaminho(q, r.pergaminho), 1);
});

teste('cristais: item que quebra na Forja vira cristais da raridade dele (100/150/200/500)', () => {
  for (const [antes, esperado] of [[6, 100], [7, 150], [8, 200], [9, 500]]) {
    for (const rar of ['comum', 'epica']) {
      const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
      p.inventario.push({ id: 'q', tipo: 'arma', arma: 'espada', classe: 'cavaleiro', raridade: rar, encanto: antes, nivel: 10, dano: [5, 9] });
      R.mudarPergaminho(p, rar, 1);
      const r = R.encantar(p, 'q', () => 0.999);
      assert.ok(r.quebrou, 'quebrou');
      assert.strictEqual(r.cristais, esperado, rar + ' +' + (antes + 1));
      assert.strictEqual(R.qtdConsumivel(p, 'cristal', rar), esperado);
      assert.ok(!p.inventario.some((i) => i.id === 'q'));
    }
  }
  // falha que só zera (até o +6) não dá cristal
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  p.inventario.push({ id: 'z', tipo: 'arma', arma: 'espada', classe: 'cavaleiro', raridade: 'rara', encanto: 5, nivel: 10, dano: [5, 9] });
  R.mudarPergaminho(p, 'rara', 1);
  const r = R.encantar(p, 'z', () => 0.999);
  assert.ok(!r.quebrou && !r.cristais);
  assert.strictEqual(R.qtdConsumivel(p, 'cristal', 'rara'), 0);
  // cristais e pergaminhos ficam lado a lado na bolsa, pergaminhos primeiro
  R.mudarConsumivel(p, 'cristal', 'rara', 100); R.mudarPergaminho(p, 'comum', 2);
  assert.deepStrictEqual(Array.from(R.consumiveis(p).map((c) => c.id)), ['pergaminho-comum', 'cristal-rara']);
  assert.strictEqual(R.nomeConsumivel(R.consumiveis(p)[1]), 'Cristal Raro');
});

teste('leilão: faixa por level, item do lote igual para todos (semente) e próximo lance +5%', () => {
  assert.strictEqual(R.faixaLeilao(9), null);
  assert.deepStrictEqual([10, 19, 20, 29, 30, 40].map((n) => R.faixaLeilao(n).id), ['l1', 'l1', 'l2', 'l2', 'l3', 'l3']);
  const lotes = [
    { tipo: 'arma', classe: 'mago', raridade: 'epica', nivel: 20, semente: 123456 },
    { tipo: 'armadura', classe: 'cavaleiro', raridade: 'lendaria', nivel: 45, semente: 99 },
    { tipo: 'joia', raridade: 'rara', nivel: 30, semente: 7 },
  ];
  for (const l of lotes) {
    const a = R.itemDoLote(l), b = R.itemDoLote(l);
    const semId = (x) => JSON.stringify(Object.assign({}, x, { id: '' }));
    assert.strictEqual(semId(a), semId(b), 'mesmo item para a mesma semente');
    assert.notStrictEqual(a.id, b.id, 'ids diferentes');
    assert.strictEqual(a.raridade, l.raridade); assert.strictEqual(a.nivel, l.nivel);
    if (l.tipo === 'arma') { assert.strictEqual(a.tipo, 'arma'); assert.strictEqual(a.classe, 'mago'); assert.ok(D.ARMAS_CLASSE.mago.armas.includes(a.arma)); }
    if (l.tipo === 'armadura') { assert.ok(['elmo', 'peitoral', 'luvas', 'botas'].includes(a.tipo)); assert.strictEqual(a.classe, 'cavaleiro'); }
    if (l.tipo === 'joia') assert.ok(['colar', 'anel'].includes(a.tipo));
  }
  assert.notStrictEqual(JSON.stringify(R.itemDoLote({ ...lotes[0], semente: 1 }).dano) + R.itemDoLote({ ...lotes[0], semente: 1 }).arma,
    'x', 'outra semente gera item');
  const perg = R.itemDoLote({ tipo: 'pergaminho', raridade: 'epica', qtd: 3, semente: 5 });
  assert.deepStrictEqual([perg.tipo, perg.raridade, perg.qtd, perg.consumivel], ['pergaminho', 'epica', 3, true]);
  assert.strictEqual(R.proximoLance({ minimo: 5000, lance: null }), 5000);
  assert.strictEqual(R.proximoLance({ minimo: 5000, lance: 10000 }), 10500);
  assert.strictEqual(R.proximoLance({ minimo: 5000, lance: 10001 }), 10502);
});

teste('defesa do herói em porcentagem: 100 = -50%, nunca imortal, igual na caçada e na masmorra', () => {
  assert.strictEqual(R.danoComDefesa(100, 0), 100);
  assert.strictEqual(R.danoComDefesa(100, 100), 50);
  assert.strictEqual(R.danoComDefesa(100, 300), 25);
  assert.strictEqual(R.danoComDefesa(3, 5000), 1, 'nunca menos que 1');
  assert.deepStrictEqual([0, 100, 200, 300].map(R.cortePct), [0, 50, 67, 75]);
  // RES vale x4,5 na defesa: 10 de RES = 4,5 de defesa (arredondado)
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(R.status(p).defesa, Math.round(Math.floor(R.atributosTotais(p).res / 10) * D.DEFESA.fator));
  // golpe do monstro na caçada usa a %
  p.inventario.push({ id: 'e', tipo: 'elmo', classe: 'cavaleiro', raridade: 'rara', encanto: 0, nivel: 10, bonus: { defesa: 30, vida: 1 } });
  R.equipar(p, 'e');
  const def = R.status(p).defesa;
  const b = R.iniciarBatalha(p, 'urso', () => 0.01);   // acerta sempre e rola o menor dano
  b.jogador.hp = 1e6; b.jogador.barra = 0; b.monstro.barra = 100;
  const ev = R.passo(b);
  assert.strictEqual(ev.ator, 'monstro');
  assert.strictEqual(ev.dano, R.danoComDefesa(D.monstros.urso.ataqueCacada[0], def));
});

teste('história: capítulos com regiões, chefes e masmorras que existem', () => {
  const H = D.HISTORIA;
  assert.strictEqual(H.capitulos.length, 7);
  H.capitulos.forEach((c) => {
    assert.ok(D.areas.some((a) => a.id === c.area), c.id + ' área');
    c.objetivos.forEach((o) => {
      if (o.tipo === 'abate') assert.ok(D.areas.some((a) => a.id === o.area) && o.qtd > 0);
      else if (o.tipo === 'chefe') assert.ok(D.monstros[o.monstro] && D.monstros[o.monstro].chefe, o.monstro);
      else if (o.tipo === 'masmorra') assert.ok(D.masmorras.some((m) => m.id === o.masmorra), o.masmorra);
      else assert.fail('tipo ' + o.tipo);
    });
    c.abertura.concat(c.fechamento).forEach((f) => assert.ok(f.quem === 'narrador' || H.PERSONAGENS[f.quem] || D.monstros[f.quem], f.quem));
  });
});

teste('história: só conta no capítulo atual, chefe e criatura comum separados, prêmio e próximo capítulo', () => {
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'arqueiro');
  let e = R.historiaEstado(p);
  assert.strictEqual(e.indice, 0); assert.ok(e.liberado); assert.ok(!e.completo);
  assert.ok(!R.registrarHistoria(p, 'abate', 'sapo'), 'monstro de outra região não conta');
  assert.ok(R.registrarHistoria(p, 'abate', 'lobo'));
  assert.strictEqual(R.historiaEstado(p).objetivos[0].feito, 1);
  assert.strictEqual(R.historiaEstado(p).objetivos[1].feito, 0, 'criatura comum não conta como chefe');
  for (let i = 0; i < 130; i++) R.registrarHistoria(p, 'abate', 'urso');
  assert.strictEqual(R.historiaEstado(p).objetivos[0].feito, 100, 'não passa da meta');
  R.registrarHistoria(p, 'abate', 'velgrath');
  assert.ok(!R.historiaEstado(p).objetivos[1].ok, 'chefe precisa de 3');
  R.registrarHistoria(p, 'abate', 'velgrath'); R.registrarHistoria(p, 'abate', 'velgrath');
  assert.ok(R.historiaEstado(p).objetivos[1].ok, 'chefe');
  assert.strictEqual(R.concluirCapitulo(p), null, 'falta a masmorra');
  R.registrarHistoria(p, 'masmorra', 'ninho');
  assert.ok(!R.historiaEstado(p).completo, 'masmorra errada não conta');
  R.registrarHistoria(p, 'masmorra', 'toca'); R.registrarHistoria(p, 'masmorra', 'toca');
  assert.ok(!R.historiaEstado(p).completo, 'masmorra precisa de 3');
  R.registrarHistoria(p, 'masmorra', 'toca');
  assert.ok(R.historiaEstado(p).completo);
  const ouro = p.ouro, exp = p.exp, nivel = p.nivel;
  const fim = R.concluirCapitulo(p);
  assert.strictEqual(fim.capitulo.id, 'c1');
  assert.strictEqual(p.ouro, ouro + 500);
  assert.ok(p.exp > exp || p.nivel > nivel, 'ganhou exp');
  e = R.historiaEstado(p);
  assert.strictEqual(e.indice, 1); assert.ok(!e.visto); assert.strictEqual(e.objetivos[0].feito, 0);
  assert.ok(!e.liberado, 'capítulo 2 pede o level do pântano');
  assert.ok(!R.registrarHistoria(p, 'abate', 'sapo'), 'sem o level não conta');
  assert.strictEqual(JSON.stringify(p.historia.lidos), '["c1"]');
});

teste('história: item no capítulo 4 (mochila cheia espera), título e skin no fim; skin não se compra', () => {
  const p = R.criarPersonagem('T', 'feminino', 'humano', 'cavaleiro');
  R.admin.subirNivel(p, 35);
  p.historia = { cap: 3, prog: { 0: 9999, 1: 99, 2: 99 }, visto: true, lidos: ['c1', 'c2', 'c3'] };
  for (let i = p.inventario.length; R.mochila(p).length < D.MOCHILA_MAX; i++) p.inventario.push({ id: 'x' + i, tipo: 'anel', classe: null, raridade: 'comum', encanto: 0 });
  assert.ok(R.concluirCapitulo(p).erro, 'mochila cheia');
  p.inventario.pop();
  const fim = R.concluirCapitulo(p);
  assert.ok(fim.item && fim.item.tipo === 'arma' && fim.item.raridade === 'epica' && fim.item.nivel === p.nivel);
  p.historia = { cap: 6, prog: { 0: 9999, 1: 99, 2: 99 }, visto: true, lidos: [] };
  R.concluirCapitulo(p);
  assert.strictEqual(p.titulo, 'Guardiã dos Selos');
  assert.ok(R.skinsDoPersonagem(p).includes('selos'));
  assert.ok(R.historiaEstado(p).fim);
  const q = R.criarPersonagem('Q', 'masculino', 'humano', 'mago');
  q.ouro = 1e6;
  assert.strictEqual(typeof R.comprarSkin(q, 'selos'), 'string');
});

teste('guia: só personagem novo; caçar, equipar o presente, loja, história, arena e prêmio final', () => {
  const velho = R.criarPersonagem('V', 'masculino', 'humano', 'mago'); delete velho.guia;
  assert.strictEqual(R.guiaEstado(velho), null, 'personagem antigo não tem guia');
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(R.guiaEstado(p).passo.id, 'boas-vindas');
  R.comecarGuia(p);
  assert.strictEqual(R.guiaEstado(p).passo.id, 'cacar');
  R.registrarGuia(p, 'abate'); R.registrarGuia(p, 'abate');
  assert.strictEqual(R.verificarGuia(p), null);
  R.registrarGuia(p, 'abate');
  assert.ok(R.verificarGuia(p).avancou);
  assert.strictEqual(R.guiaEstado(p).passo.id, 'equipar');
  const presente = p.inventario.find((i) => i.id === p.guia.item);
  assert.ok(presente && presente.tipo === 'elmo' && R.nomeItem(presente) === 'Elmo do Aprendiz');
  R.registrarGuia(p, 'aba', 'mercado');   // fora de ordem: fica guardado
  R.equipar(p, presente.id);
  R.verificarGuia(p);
  assert.strictEqual(R.guiaEstado(p).passo.id, 'historia', 'equipou e a loja já tinha sido vista');
  R.marcarHistoriaVista(p);
  R.verificarGuia(p);
  assert.strictEqual(R.guiaEstado(p).passo.id, 'arena');
  const ouro = p.ouro;
  R.registrarGuia(p, 'arena');
  const fim = R.verificarGuia(p);
  assert.ok(fim.fim && /1\.000 de ouro/.test(fim.premio));
  assert.strictEqual(p.ouro, ouro + 1000);
  assert.strictEqual(R.guiaEstado(p), null);
  const q = R.criarPersonagem('Q', 'masculino', 'humano', 'cavaleiro');
  R.pularGuia(q);
  assert.strictEqual(R.guiaEstado(q), null);
});

teste('boss da aliança: começa fraco, cresce por nível e troca de chefe', () => {
  const B = D.BOSS_ALIANCA;
  const b1 = R.bossAlianca(1), b2 = R.bossAlianca(2), b4 = R.bossAlianca(B.niveisPorChefe + 1);
  assert.strictEqual(b1.id, B.bosses[0].id);
  assert.strictEqual(b4.id, B.bosses[1].id, 'depois de niveisPorChefe níveis vira o próximo boss');
  assert.strictEqual(b1.hp, Math.round(D.monstros[B.chefes[0]].hp * B.vida), 'números do chefe da caçada da fase');
  assert.ok(D.monstros[b1.id].imagem.indexOf(b1.id) >= 0, 'imagem própria');
  assert.strictEqual(R.bossAlianca(5).nome, 'Nyxara Desperta');
  assert.ok(b2.hp > b1.hp && b4.hp > b1.hp);
  const ultimo = (B.chefes.length - 1) * B.niveisPorChefe + 1;
  const u1 = R.bossAlianca(ultimo + 5), u2 = R.bossAlianca(ultimo + 6);
  assert.strictEqual(u1.id, B.bosses[B.bosses.length - 1].id);
  assert.ok(u2.hp > u1.hp && u2.ataque[1] >= u1.ataque[1], 'depois do último chefe continua crescendo');
  assert.ok(R.bossAlianca(4).premio.ouro > b1.premio.ouro);
  const t = R.tabelaBossAlianca(5);
  assert.strictEqual(t.length, 5);
  assert.strictEqual(t[0].hp, b1.hp);
});

teste('boss da aliança: investida tem fim, dano por herói e não passa da vida que falta', () => {
  const herois = ['cavaleiro', 'mago'].map((c) => {
    const p = R.criarPersonagem('B' + c, 'masculino', 'humano', c);
    R.admin.subirNivel(p, 14);
    R.admin.conjunto(p, 'rara');
    p.inventario.slice().forEach((it) => R.equipar(p, it.id));
    return p;
  });
  const a = R.simularBossAlianca(herois, 1, 1e9, 7), b = R.simularBossAlianca(herois, 1, 1e9, 7);
  assert.strictEqual(a.dano, b.dano, 'mesma semente, mesma luta');
  assert.ok(!a.vitoria && a.dano > 0);
  assert.strictEqual(a.danos.length, 2);
  assert.strictEqual(a.danos[0] + a.danos[1], a.dano);
  const golpesBoss = a.eventos.filter((e) => e.tipo === 'golpe' && e.de === 'm').length;
  assert.ok(golpesBoss <= D.BOSS_ALIANCA.limiteAtaques, 'o boss ataca no máximo limiteAtaques vezes');
  const fim = R.simularBossAlianca(herois, 1, 50, 7);
  assert.ok(fim.vitoria, 'com pouca vida o boss morre');
  assert.strictEqual(fim.dano, 50, 'conta só a vida que faltava');
  assert.strictEqual(fim.inicio.salas[0][0].hpMax, R.bossAlianca(1).hp);
  assert.strictEqual(fim.inicio.salas[0][0].hp, 50);
  const pr = R.premioBossAlianca(herois[0], 1);
  assert.ok(pr.ouro > 0 && pr.exp > 0 && pr.exp <= R.expNecessaria(herois[0].nivel) * D.BOSS_ALIANCA.premio.expMaxPct / 100);
});

teste('chefe mundial: luta contra o chefe da área do level e prêmio x ataques', () => {
  const p = R.criarPersonagem('W', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(R.chefeDoNivel(p), 'velgrath');
  p.nivel = 12;
  const esperado = D.areas.filter(a => a.nivelMin <= 12).pop().chefe.id;
  assert.strictEqual(R.chefeDoNivel(p), esperado);
  assert.ok(D.monstros[esperado].chefe);
  p.nivel = 1; p.exp = 0; p.ouro = 0;
  const m = D.monstros.velgrath;
  const r = R.premioChefeMundial(p, { chefe: 'velgrath', ataques: 3, fator: 100 });
  assert.strictEqual(r.ouro, m.ouro * 3);
  assert.strictEqual(r.exp, m.exp * 3);
  assert.strictEqual(p.ouro, m.ouro * 3);
  const q = R.criarPersonagem('X', 'masculino', 'humano', 'cavaleiro'); q.ouro = 0;
  const c = R.premioChefeMundial(q, { chefe: 'velgrath', ataques: 3, fator: 70 });
  assert.strictEqual(c.ouro, Math.floor(m.ouro * 3 * 0.7));
  for (let i = 0; i < 20; i++) {
    const it = R.itemDoChefeMundial(p, i % 2 ? 'lendaria' : 'epica');
    assert.strictEqual(it.raridade, i % 2 ? 'lendaria' : 'epica');
  }
});

teste('poder dos itens: +6 de uma raridade ≈ +0 da raridade seguinte (arma e armadura)', () => {
  const meio = { comum: 0.2, rara: 0.55, epica: 0.8, lendaria: 0.95 }, rs = ['comum', 'rara', 'epica', 'lendaria'];
  const arma = (r, n, e) => { const d = R.danoArma({ tipo: 'arma', arma: 'espada', classe: 'cavaleiro', raridade: r, encanto: e, dano: R.danoDoNivel(n, meio[r]) }); return d[0] + d[1]; };
  const peito = (r, n, e) => R.bonusItem({ tipo: 'peitoral', classe: 'cavaleiro', raridade: r, encanto: e, nivel: n,
    bonus: { defesa: R.bonusDoNivel(D.armaduras.cavaleiro.peitoral.bonus.defesa[1], n, meio[r]) } }).defesa;
  for (const n of [15, 30, 50]) for (let i = 0; i < 3; i++) {
    const a6 = arma(rs[i], n, 6), a0 = arma(rs[i + 1], n, 0), p6 = peito(rs[i], n, 6), p0 = peito(rs[i + 1], n, 0);
    assert.ok(Math.abs(a6 / a0 - 1) <= 0.1, 'arma nível ' + n + ' ' + rs[i] + '+6=' + a6 + ' x ' + rs[i + 1] + '+0=' + a0);
    assert.ok(Math.abs(p6 / p0 - 1) <= 0.12, 'peitoral nível ' + n + ' ' + rs[i] + '+6=' + p6 + ' x ' + rs[i + 1] + '+0=' + p0);
  }
});

teste('boss da aliança: do 2º boss em diante, golpe em área tira % da vida de todo o grupo', () => {
  const B = D.BOSS_ALIANCA;
  assert.ok(!R.bossAlianca(1).area, 'o 1º boss não tem golpe em área');
  const n = B.niveisPorChefe + 1, area = R.bossAlianca(n).area;
  assert.ok(area && area.cada > 0 && area.vidaPct > 0);
  const herois = ['cavaleiro', 'arqueiro'].map((c) => { const p = R.criarPersonagem('A' + c, 'masculino', 'humano', c); R.admin.subirNivel(p, 16); return p; });
  const r = R.simularBossAlianca(herois, n, 1e9, 5);
  const hab = r.eventos.findIndex((e) => e.tipo === 'habM');
  assert.ok(hab >= 0, 'o boss usa o golpe em área');
  const golpes = r.eventos.slice(hab + 1, hab + 3);
  assert.ok(golpes.every((e) => e.tipo === 'golpe' && e.de === 'm' && e.area), 'acerta cada herói vivo');
  const hpMax = r.inicio.herois.map((h) => h.hpMax);
  golpes.filter((e) => e.acerto).forEach((e) => assert.strictEqual(e.dano, Math.max(1, Math.round(hpMax[e.alvo] * area.vidaPct / 100))));
});

teste('skills do clã: valem contra monstros (status pve), não no status normal', () => {
  const p = R.criarPersonagem('C', 'masculino', 'humano', 'cavaleiro');
  R.admin.subirNivel(p, 14);
  const antes = R.status(p), semCla = R.status(p, true);
  assert.deepStrictEqual(semCla.dano, antes.dano, 'sem clã, igual');
  p.cla = { id: 1, skills: { dano: 2, vida: 3, critico: 4, resistencia: 1, velocidade: 2, esquiva: 2, danoCritico: 1, fortuna: 5 } };
  const s = R.status(p, true), n = R.status(p);
  assert.deepStrictEqual(n.dano, antes.dano, 'fora do combate contra monstros (Arena, poder) não muda');
  assert.strictEqual(R.poder(p), R.poder(Object.assign({}, p, { cla: undefined })));
  assert.strictEqual(s.hpMax, Math.round(antes.hpMax * (1 + 3 * 2 / 100)));
  assert.strictEqual(s.dano[1], Math.round(antes.dano[1] * (1 + 2 * 1.5 / 100)));
  assert.strictEqual(s.chanceCritico, antes.chanceCritico + 4 * 0.5);
  assert.strictEqual(s.evasao, antes.evasao + 2 * 0.5);
  assert.strictEqual(R.bonusCla(p, 'exp'), 0);
  assert.strictEqual(R.precoSkillCla(1), D.ALIANCA.skillPrecos[0]);
  const b = R.iniciarBatalha(p, 'lobo');
  assert.strictEqual(b.jogador.hpMax, s.hpMax, 'a caçada usa as skills do clã');
});

teste('craft: materiais caem dos monstros (Coletor acha mais), chefe sempre deixa o dele', () => {
  const p = R.criarPersonagem('M', 'masculino', 'humano', 'artesao');
  R.admin.subirNivel(p, 12);
  assert.deepStrictEqual({ ...R.rolarMaterial(p, 'lobo', fixo(0)) }, { id: 'ferro', qtd: 1 });
  assert.strictEqual(R.rolarMaterial(p, 'lobo', fixo(0.07)), null, '6% no 1º monstro');
  assert.deepStrictEqual({ ...R.rolarMaterial(p, 'velgrath', fixo(0.1)) }, { id: 'seiva', qtd: 1 });
  assert.strictEqual(R.rolarMaterial(p, 'velgrath', fixo(0.2)), null, 'chefe: 15%');
  R.escolherSegundaClasse(p, 'coletor');
  assert.deepStrictEqual({ ...R.rolarMaterial(p, 'lobo', fixo(0.08)) }, { id: 'ferro', qtd: 1 }, 'Coletor: 9%');
});

teste('craft: Minas, receita do Coletor, proteção e forja do Ferreiro', () => {
  const col = R.criarPersonagem('Col', 'masculino', 'anao', 'artesao');
  R.admin.subirNivel(col, 12); R.escolherSegundaClasse(col, 'coletor');
  assert.notStrictEqual(R.iniciarMinas(col, 0, 1000, 'cume'), true, 'região não liberada');
  assert.strictEqual(R.iniciarMinas(col, 0, 1000, 'floresta'), true, 'pode minerar numa região baixa');
  assert.strictEqual(col.minas.area, 'floresta');
  delete col.minas;
  assert.strictEqual(R.iniciarMinas(col, 1, 1000), true);   // 1 h
  assert.notStrictEqual(R.iniciarMinas(col, 1, 1000), true, 'uma mineração por vez');
  assert.ok(typeof R.recolherMinas(col, 2000) === 'string', 'ainda minerando');
  const m = R.recolherMinas(col, 1000 + 61 * 60000, fixo(0.5));
  assert.strictEqual(m.material, R.materialDaArea(R.areaDasMinas(col).id));
  assert.ok(m.qtd + m.gemas >= 4, 'Coletor minera +50%');
  col.ouro = 100000;
  R.mudarConsumivel(col, 'material', 'nevoa', 10);
  assert.strictEqual(R.fabricarReceita(col, 'pantano'), true);
  assert.strictEqual(R.qtdConsumivel(col, 'receita', 'pantano'), 1);
  assert.notStrictEqual(R.fabricarReceita(col, 'cume'), true, 'região não liberada');
  R.mudarConsumivel(col, 'cristal', 'comum', 50); R.mudarConsumivel(col, 'material', 'ferro', 10);
  assert.strictEqual(R.fabricarProtecao(col, 'comum'), true);
  assert.strictEqual(R.qtdConsumivel(col, 'protecao', 'comum'), 1);
  const fer = R.criarPersonagem('Fer', 'masculino', 'humano', 'artesao');
  R.admin.subirNivel(fer, 12); R.escolherSegundaClasse(fer, 'ferreiro');
  assert.notStrictEqual(R.fabricarReceita(fer, 'pantano'), true, 'só o Coletor faz receita');
  fer.ouro = 100000; fer.inventario = [];
  R.mudarConsumivel(fer, 'receita', 'pantano', 1); R.mudarConsumivel(fer, 'material', 'nevoa', 5); R.mudarConsumivel(fer, 'material', 'lagrima', 3);
  const ch = R.chancesForja(fer, 'pantano', 3, 0);
  assert.ok(ch.epica > R.chancesForja(fer, 'pantano', 0, 0).epica && ch.lendaria > 0, 'material do chefe melhora a raridade');
  const f = R.forjar(fer, 'pantano', 'mago', 'arma', 3, 0, fixo(0.001));
  assert.ok(f.item && f.item.raridade === 'lendaria' && f.item.forjadoPor === 'Fer');
  assert.strictEqual(f.item.classe, 'mago', 'item da classe escolhida');
  assert.ok(D.ARMAS_CLASSE.mago.armas.indexOf(f.item.arma) >= 0, 'arma de mago');
  assert.strictEqual(R.qtdConsumivel(fer, 'receita', 'pantano'), 0);
  assert.strictEqual(R.qtdMaterial(fer, 'lagrima'), 0);
  assert.notStrictEqual(R.forjar(fer, 'pantano', 'mago', 'arma', 0, 0), true, 'sem receita');
});

teste('oficinas: chance com o bônus do artesão, item forjado pela semente e runas só contra monstros', () => {
  assert.strictEqual(R.chanceEncantarCom(50, { encanto: 9 }), D.encantamento.teto[10], 'teto do +10');
  assert.strictEqual(R.chanceEncantarCom(0, { encanto: 9 }), 10);
  const spec = { classe: 'arqueiro', tipo: 'arma', raridade: 'epica', area: 'ruinas', semente: 1234, forjadoPor: 'Grimbold', obraPrima: true };
  const a = R.itemForjado(spec), b = R.itemForjado(spec);
  assert.strictEqual(JSON.stringify(Object.assign({}, a, { id: 0 })), JSON.stringify(Object.assign({}, b, { id: 0 })), 'mesma semente, mesmo item');
  assert.ok(a.classe === 'arqueiro' && a.raridade === 'epica' && a.forjadoPor === 'Grimbold' && a.obraPrima);
  const p = R.criarPersonagem('R', 'masculino', 'anao', 'artesao');
  R.admin.subirNivel(p, 29); R.escolherSegundaClasse(p, 'ferreiro');
  assert.strictEqual(R.podeReliquia(p), true);
  assert.ok(R.chanceReliquia(p) >= D.CRAFT.reliquia.base && R.chanceReliquia(p) <= D.CRAFT.reliquia.maxima);
  const arma = R.mochila(p).concat(Object.values(p.equipados).map((id) => p.inventario.find((i) => i.id === id)).filter(Boolean))[0];
  const antes = R.status(p, true).dano[1], fora = R.status(p).dano[1];
  arma.runa = 'furia';
  if (!R.slotDoItem(p, arma.id)) R.equipar(p, arma.id);
  assert.ok(R.status(p, true).dano[1] > antes, 'runa da fúria: mais dano contra monstros');
  assert.strictEqual(R.status(p).dano[1], fora, 'fora disso (Arena, poder) não muda');
  const q = { runa: 'furia', encanto: 7 };
  assert.strictEqual(R.forcaRuna(q), 1);
  assert.strictEqual(R.bonusRuna({ runa: 'furia', encanto: 10 }).dano, 10.5, '+10 = 175% da runa');
  assert.ok(R.bonusRuna({ runa: 'furia', encanto: 9 }).dano > R.bonusRuna({ runa: 'furia', encanto: 8 }).dano);
  arma.encanto = 8; R.mudarPergaminho(p, arma.raridade, 1);
  assert.strictEqual(R.encantar(p, arma.id, () => 0), null, 'relíquia não pode mais ser encantada');
  assert.strictEqual(arma.encanto, 8);
});


teste('mão esquerda: % fixos pela raridade (não crescem com o nível) e valem tanto quanto a arma de duas mãos', () => {
  for (const n of [15, 45]) {
    const it = R.novoItem('secundaria', null, 'epica', () => 0.5, 'aljava', n);
    assert.strictEqual(it.bonus.danoPct, 10, 'aljava épica +10% de dano no nível ' + n);
    assert.strictEqual(it.bonus.critico, 3);
    assert.ok(!('precisao' in it.bonus), 'aljava sem precisão');
    const o = R.novoItem('secundaria', null, 'lendaria', () => 0.5, 'orbe', n);
    assert.strictEqual(o.bonus.danoMagico, 14);
    assert.strictEqual(o.bonus.danoCriticoMagico, 20);
  }
  const p = R.criarPersonagem('T', 'masculino', 'humano', 'artesao'); p.nivel = 30; p.inventario = []; p.equipados = { arma: null, secundaria: null };
  const m = R.novoItem('arma', 'artesao', 'epica', () => 0.5, 'martelo', 30); p.inventario.push(m); R.equipar(p, m.id);
  const d0 = R.status(p).dano;
  const mp = R.novoItem('secundaria', null, 'epica', () => 0.5, 'manopla', 30); delete mp.bonus.for; delete mp.bonus.res; delete mp.bonus.des; delete mp.bonus.int; delete mp.bonus.sor;
  p.inventario.push(mp); R.equipar(p, mp.id);
  assert.deepStrictEqual([...R.status(p).dano], [Math.round(d0[0] * 1.1), Math.round(d0[1] * 1.1)], 'manopla épica +10% de dano');
});

teste('mineração: 30 min a 24 h, parar com 50% dá metade, antes disso nada; histórico por região', () => {
  const p = R.criarPersonagem('M', 'masculino', 'humano', 'cavaleiro'); R.admin.subirNivel(p, 12);
  assert.strictEqual(D.CRAFT.minas.opcoes.map((o) => o.minutos).join(), '30,60,120,240,480,1440');
  const T = 1000, H = 3600000;
  assert.strictEqual(R.iniciarMinas(p, 3, T, 'ruinas'), true);   // 4 h
  assert.ok(R.minerando(p, T + H) && !R.minerando(p, T + 4 * H), 'ocupado só até o fim');
  // parou com 25%: nada
  let r = R.pararMinas(p, T + H, () => 0.99);
  assert.strictEqual(r.qtd + r.gemas, 0); assert.ok(!p.minas);
  // parou com 50%: metade (faixa 12–18, sorteio no máximo = 18 → 9)
  R.iniciarMinas(p, 3, T, 'ruinas');
  r = R.pararMinas(p, T + 2 * H, () => 0.99);
  assert.strictEqual(r.qtd + r.gemas, 9); assert.ok(r.metade);
  // até o fim: inteiro
  R.iniciarMinas(p, 3, T, 'ruinas');
  r = R.recolherMinas(p, T + 4 * H, () => 0.99);
  assert.strictEqual(r.qtd + r.gemas, 18); assert.ok(!r.parcial);
  const h = p.historicoMinas.ruinas;
  assert.strictEqual(h.minutos, 60 + 120 + 240); assert.strictEqual(h.qtd + h.gemas, 27); assert.strictEqual(h.vezes, 3);
  assert.ok(R.mediaMinas(p, 5).qtd > R.mediaMinas(p, 4).qtd);
});

teste('habilidades do level 20/30: pontos +2 do 21, liberam no level e valem em todo lugar', () => {
  const mk = (classe, c2, nivel) => {
    const p = R.criarPersonagem('N', 'masculino', 'humano', classe);
    R.admin.subirNivel(p, nivel - 1); R.escolherSegundaClasse(p, c2); return p;
  };
  assert.strictEqual(R.pontosHabilidadeTotal(mk('cavaleiro', 'paladino', 20)), 14);
  assert.strictEqual(R.pontosHabilidadeTotal(mk('cavaleiro', 'paladino', 21)), 16);
  assert.strictEqual(R.pontosHabilidadeTotal(mk('cavaleiro', 'paladino', 30)), 34);
  const p = mk('arqueiro', 'cacador', 19);
  assert.strictEqual(R.mudarPontoHabilidade(p, 'flecha-envenenada', 1), 'Libera no level 20.');
  R.admin.subirNivel(p, 1);
  assert.strictEqual(R.mudarPontoHabilidade(p, 'flecha-envenenada', 1), true);
  assert.strictEqual(R.mudarPontoHabilidade(p, 'tiro-silenciador', 1), 'Libera no level 30.');
  R.admin.subirNivel(p, 10);
  assert.strictEqual(R.mudarPontoHabilidade(p, 'tiro-silenciador', 1), true);
  const ids = (m) => R.kitHabilidades(p, m).map((k) => k.def.id);
  assert.ok(ids('cacada').includes('flecha-envenenada') && ids('cacada').includes('tiro-silenciador'));
  assert.ok(ids('arena').includes('tiro-silenciador') && ids('arena').includes('flecha-envenenada'));
  // personagem antigo (ordem sem as novas): elas entram uma vez, em todos os modos
  const v = mk('mago', 'bruxo', 30); delete v.talentos.ordemNiveis2;
  Object.keys(v.talentos.ordem).forEach((m) => { v.talentos.ordem[m] = v.talentos.ordem[m].filter((id) => !D.SEGUNDAS_CLASSES.bruxo.habilidades.find((h) => h.id === id).nivel); });
  const t = R.talentos(v);
  assert.ok(t.ordem.cacada.includes('escudo-de-gelo') && t.ordem.arena.includes('escudo-de-gelo'));
  assert.ok(t.ordem.defesa.includes('maldicao-de-ignaroth') && t.ordem.masmorra.includes('maldicao-de-ignaroth'));
  // a passiva de sempre continua sendo a 1ª (status), as novas não mexem nos atributos
  R.mudarPontoHabilidade(v, 'mente-sombria', 1);
  assert.strictEqual(R.passiva(v).def.id, 'mente-sombria');
});

teste('level 20 na caçada: regeneração, roubo de vida, Têmpera, escudo, veneno e Bolso de Poções', () => {
  const mk = (classe, c2, hab) => {
    const p = R.criarPersonagem('N', 'masculino', 'humano', classe);
    R.admin.subirNivel(p, 19); R.escolherSegundaClasse(p, c2);   // (passivas: fixas, os pontos não entram)
    for (let i = 0; i < 10; i++) R.mudarPontoHabilidade(p, hab, 1);
    p.hpAtual = R.status(p).hpMax; return p;
  };
  const x = (c, c2, h) => R.extrasNivel(mk(c, c2, h));
  // passivas fixas: valor de 1 ponto; Sede de Sangue 5%
  assert.deepStrictEqual({ ...x('cavaleiro', 'paladino', 'aura-sagrada') }, { regenPct: 0.66 });
  assert.deepStrictEqual({ ...x('cavaleiro', 'destruidor', 'sede-de-sangue') }, { rouboVida: 5 });
  assert.deepStrictEqual({ ...x('artesao', 'ferreiro', 'tempera-de-fogo') }, { reducaoDano: 11, danoExtraPct: 21.5 });
  assert.deepStrictEqual({ ...x('artesao', 'coletor', 'bolso-de-pocoes') }, { curaEmergencia: 37, limiar: 40 });
  // vale em todo lugar (o lutador da Arena também leva)
  assert.deepStrictEqual({ ...R.novoLutador(mk('mago', 'curandeiro', 'regeneracao'), 'arena').ex }, { regenPct: 1.1 });
  // luta de verdade: o veneno do Arqueiro tira vida a cada vez e o Bolso cura uma vez
  let s = 3; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const a = mk('arqueiro', 'cacador', 'flecha-envenenada');
  const b = R.iniciarBatalha(a, 'mumia', rnd);
  let venenos = 0, n = 0;
  while (!b.fim && n++ < 500) { const e = R.passo(b); if (e && b.lutador.dot && b.lutador.dot.turnos < 3) venenos++; }
  assert.ok(venenos > 0, 'o veneno agiu');
  const c = mk('artesao', 'coletor', 'bolso-de-pocoes');
  const bc = R.iniciarBatalha(c, 'farao', rnd);
  let bolso = 0; n = 0;
  while (!bc.fim && n++ < 2000) { const e = R.passo(bc); if (e && e.bolso) bolso++; }
  assert.ok(bolso <= 1, 'Bolso de Poções só uma vez por luta');
  // escudo segura dano
  const L = R.novoLutador(mk('mago', 'bruxo', 'escudo-de-gelo'), 'cacada');
  L.turno = 1; L.escudo = 50; L.escudoAte = 3; L.congelaChance = 30;
  const m = { atordoado: 0 };
  assert.strictEqual(R.aoReceber(L, 80, m, () => 0), 30);
  assert.strictEqual(L.escudo, 0);
  assert.strictEqual(m.atordoado, 1, 'quem bate no escudo pode congelar');
});

teste('level 30 contra monstros: Milagre, Martelo das Correntes, Maldição, Pó nos Olhos e Defesa Suprema', () => {
  const mk = (classe, c2, hab) => {
    const p = R.criarPersonagem('N', 'masculino', 'humano', classe);
    R.admin.subirNivel(p, 29); R.escolherSegundaClasse(p, c2);
    for (let i = 0; i < 10; i++) R.mudarPontoHabilidade(p, hab, 1);
    p.hpAtual = R.status(p).hpMax; return p;
  };
  // Milagre: uma vez por luta, na caçada também
  const cu = mk('mago', 'curandeiro', 'milagre');
  const L = R.novoLutador(cu, 'cacada'), h = { hp: 0, hpMax: 1000 };
  assert.strictEqual(R.depoisDeReceber(L, h), 'milagre');
  assert.strictEqual(h.hp, 210, 'Milagre fixo: 21%');
  h.hp = 0; assert.strictEqual(R.depoisDeReceber(L, h), false, 'só uma vez');
  // Martelo das Correntes e Maldição: golpe com quebra de defesa / queimadura no monstro
  let s = 5; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  for (const [c, c2, hab, campo] of [['artesao', 'ferreiro', 'martelo-das-correntes', 'defQuebra'], ['mago', 'bruxo', 'maldicao-de-ignaroth', 'queima']]) {
    const p = mk(c, c2, hab); const b = R.iniciarBatalha(p, 'farao', rnd);
    let n = 0, viu = false; while (!b.fim && n++ < 400) { R.passo(b); if (b.monstro[campo]) viu = true; }
    assert.ok(viu, hab + ' marcou o monstro');
  }
  // Pó nos Olhos: o monstro cego erra (com 100% de chance)
  const L2 = R.novoLutador(mk('artesao', 'coletor', 'po-nos-olhos'), 'cacada');
  const m = { cego: 2, cegoPct: 100, hp: 100 };
  assert.strictEqual(R.aoReceber(L2, 50, m, () => 0.5), 0);
  assert.strictEqual(m.cego, 1);
  // Defesa Suprema devolve dano para o monstro
  const L3 = R.novoLutador(mk('cavaleiro', 'paladino', 'defesa-suprema'), 'cacada');
  L3.turno = 1; L3.buffs.push({ ate: 2, reflete: 15 });
  const m2 = { hp: 100 };
  R.aoReceber(L3, 100, m2, () => 0.5);
  assert.strictEqual(m2.hp, 85);
});

// ---- Caçada decidida pelo servidor (anti-trapaça, etapa 1) ----
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'servidor-cacada.js'), 'utf8'), ctx);
const SC = vm.runInContext('Tanka.servidorCacada', ctx);
teste('servidor da caçada: ritmo, monstros válidos, luta inteira e próximo encontro', () => {
  const p = R.criarPersonagem('S', 'masculino', 'humano', 'cavaleiro');
  let t = 1.8e12;
  assert.ok(SC.lutar(p, t, rng).erro, 'sem encontro não luta');
  assert.ok(SC.encontro(p, ['chefe-inexistente', 'lobo-gigante-xyz'], t, rng).erro, 'alvos inválidos');
  const e = SC.encontro(p, ['lobo'], t, rng);
  assert.strictEqual(e.encontro.normal, 'lobo');
  assert.ok(SC.lutar(p, t + 10, rng).erro, 'antes do monstro aparecer');
  t = e.encontro.prontoEm;
  const ouro0 = p.ouro;
  const s = SC.lutar(p, t, rng, { exp: 0, ouro: 0 }, { alvos: ['lobo'] });
  assert.ok(s.eventos.length > 0 && s.res.resultado, 'lutou');
  if (s.res.resultado === 'vitoria') { assert.ok(p.ouro >= ouro0 && p.abates.lobo === 1); assert.ok(s.proximo && p.encontro); }
  assert.ok(p.cacadaLivreEm > t, 'ritmo guardado');
  assert.ok(SC.lutar(p, t + 1, rng).erro, 'próxima luta só depois do ritmo');
  delete p.encontro;
  assert.ok(SC.encontro(p, ['lobo'], t + 1, rng).erro, 'nova busca só depois do ritmo');
});
teste('servidor da caçada: mineração e falta de estamina bloqueiam; fugir do chefe', () => {
  const p = R.criarPersonagem('S', 'masculino', 'humano', 'cavaleiro');
  const t = 1.8e12;
  p.minas = { fim: t + 60000 };
  assert.ok(/minerando/.test(SC.encontro(p, ['lobo'], t, rng).erro));
  delete p.minas;
  R.atualizarTempo(p, t);
  p.estamina.pts = 0;
  assert.ok(/Sem estamina/.test(SC.encontro(p, ['lobo'], t, rng).erro));
  p.estamina.pts = 2; p.abates.lobo = 1; p.abates.cobra = 1;
  assert.ok(/Sem estamina/.test(SC.encontro(p, ['urso'], t, rng).erro), 'não paga o urso (3)');
  assert.strictEqual(SC.encontro(p, ['urso', 'lobo'], t, rng).encontro.normal, 'lobo', 'só sorteia o que a estamina paga');
  delete p.encontro; delete p.cacadaLivreEm;
  p.estamina.pts = 240;
  p.encontro = { monstro: 'x', normal: 'lobo', chefe: true, em: t, prontoEm: t };
  const f = SC.fugir(p, t, true);
  assert.strictEqual(f.encontro.monstro, 'lobo');
  assert.strictEqual(p.encontro.chefe, false);
  SC.fugir(p, t);
  assert.ok(!p.encontro);
});
teste('servidor da caçada: pedir de novo não sorteia outro monstro; fugir não acelera', () => {
  const p = R.criarPersonagem('S', 'masculino', 'humano', 'cavaleiro');
  const t = 1.8e12;
  const e1 = SC.encontro(p, ['lobo'], t, rng).encontro;
  const e2 = SC.encontro(p, ['lobo'], t + 50, rng).encontro;
  assert.deepStrictEqual(JSON.stringify(e1), JSON.stringify(e2));
  SC.fugir(p, t + 60);
  assert.ok(SC.encontro(p, ['lobo'], t + 70, rng).erro, 'depois de fugir espera o tempo do monstro');
  assert.ok(SC.encontro(p, ['lobo'], e1.prontoEm, rng).encontro);
});
teste('servidor da caçada: luta em etapas (prêmio só no fim, poção na hora, luta largada termina sozinha)', () => {
  const novo = () => { const p = R.criarPersonagem('E', 'masculino', 'humano', 'cavaleiro'); p.pocoes = 2; return p; };
  // mesma semente = mesma luta
  const s1 = SC.sorteioSemente(42), s2 = SC.sorteioSemente(42);
  assert.strictEqual(s1(), s2());
  let p = novo(), t = 1.8e12;
  const e = SC.encontro(p, ['lobo'], t, rng).encontro;
  t = e.prontoEm;
  const exp0 = p.exp, est0 = R.estamina(p).pts;
  const l = SC.lutar(p, t, rng, { exp: 0, ouro: 0 }, { alvos: ['lobo'], etapas: true });
  assert.ok(l.etapas && l.eventos.length > 0 && !l.res, 'começou sem resultado');
  assert.ok(p.luta && !p.encontro, 'luta guardada');
  assert.strictEqual(p.exp, exp0, 'sem exp no começo');
  assert.strictEqual(R.estamina(p).pts, est0, 'estamina só no fim');
  assert.ok(SC.fim(p, t + 1, rng).espera, 'fim antes do tempo da luta: espera');
  const f = SC.fim(p, t + l.eventos.length * 275 + 10, rng, { alvos: ['lobo'] });
  assert.ok(f.res && f.res.resultado, 'resultado no fim');
  assert.ok(!p.luta, 'luta fechada');
  if (f.res.resultado === 'vitoria') assert.ok(p.exp > exp0 || p.nivel > 1, 'exp no fim');
  assert.ok(R.estamina(p).pts < est0, 'gastou estamina no fim');
  // poção: a luta é refeita igual até o turno da poção e a poção entra depois
  p = novo(); t = 1.9e12;
  p.abates.lobo = 1; p.abates.cobra = 1;
  const e2 = SC.encontro(p, ['urso'], t, rng).encontro;
  t = e2.prontoEm;
  const l2 = SC.lutar(p, t, rng, { exp: 0, ouro: 0 }, { etapas: true });
  const ferido = l2.eventos.findIndex((x) => x.jh < x.jm);
  assert.ok(ferido >= 0, 'o herói apanhou');
  const turnoP = ferido + 1;
  assert.ok(SC.pocao(p, t, 0).erro, 'vida cheia no começo: não bebe');
  const pc = SC.pocao(p, t + 100, turnoP);
  assert.ok(!pc.erro, 'bebeu: ' + pc.erro);
  assert.deepStrictEqual(JSON.stringify(pc.eventos.slice(0, turnoP)), JSON.stringify(l2.eventos.slice(0, turnoP)), 'igual até a poção');
  assert.ok(pc.eventos.slice(turnoP).some((x) => x.ev.pocao), 'a poção aparece depois');
  assert.ok(SC.pocao(p, t + 200, turnoP).erro, 'não volta no tempo');
  // largou a luta: a próxima ação da caçada termina a luta sozinha e aplica o resultado
  assert.ok(SC.encontro(p, ['urso'], t + 10, rng).espera, 'antes do fim da luta: espera');
  const depois = t + pc.eventos.length * 275 + 1000;
  SC.encontro(p, ['lobo'], depois, rng);
  assert.ok(!p.luta, 'luta largada fechada');
  assert.strictEqual(p.pocoes, 1, 'gastou a poção bebida');
});
teste('monstro ataca primeiro só nas 2 primeiras zonas', () => {
  const p = R.criarPersonagem('Z', 'masculino', 'humano', 'cavaleiro');
  assert.strictEqual(R.iniciarBatalha(p, 'lobo').monstro.barra, 100);
  assert.strictEqual(R.iniciarBatalha(p, 'sapo').monstro.barra, 100);
  assert.strictEqual(R.iniciarBatalha(p, 'esqueleto').monstro.barra, 0);
});

teste('Vitalidade: x2 na exp e no ouro, gasta 1, recarrega 5/h e enche no dia seguinte', () => {
  const ligada = D.VITALIDADE.ligada; D.VITALIDADE.ligada = true;
  try {
  const p = R.criarPersonagem('V', 'masculino', 'humano', 'cavaleiro');
  const t = Date.UTC(2026, 10, 10, 15, 0, 0);   // 12h em Brasília
  assert.strictEqual(R.atualizarVitalidade(p, t).pts, 100);
  const b = R.iniciarBatalha(p, 'lobo', rng); b.fim = 'vitoria';
  const r = R.concluirBatalha(p, b, t);
  assert.ok(r.vitalidade); assert.strictEqual(r.exp, D.monstros.lobo.exp * 2); assert.strictEqual(r.ouro, D.monstros.lobo.ouro * 2);
  assert.strictEqual(p.vitalidade.pts, 99);
  p.vitalidade.pts = 0; p.vitalidade.em = t;
  assert.strictEqual(R.atualizarVitalidade(p, t + 2.5 * 3600000).pts, 10);   // 2 horas cheias
  const b2 = R.iniciarBatalha(p, 'lobo', rng); b2.fim = 'vitoria'; p.vitalidade.pts = 0;
  assert.ok(!R.concluirBatalha(p, b2, t + 2.5 * 3600000).vitalidade, 'sem pontos, sem bônus');
  assert.strictEqual(R.atualizarVitalidade(p, Date.UTC(2026, 10, 11, 3, 1)).pts, 100, 'meia-noite em Brasília (03:01 UTC): cheia');
  assert.strictEqual(R.maxVitalidade(Object.assign({}, p, { vip: true })), 200);
  } finally { D.VITALIDADE.ligada = ligada; }
});
teste('chapéu do mago dá defesa (novo e antigo)', () => {
  const p = R.criarPersonagem('M', 'masculino', 'humano', 'mago');
  const it = R.completarItem(p, R.novoItem('elmo', 'mago', 'rara', rng), rng);
  assert.ok(it.bonus.defesa > 0 && R.bonusItem(it).defesa > 0);
  delete it.bonus.defesa; p.inventario.push(it);
  R.normalizar(p);
  assert.ok(it.bonus.defesa > 0, 'chapéu antigo ganhou defesa');
});

teste('Vitalidade desligada: sem x2 e sem gastar pontos', () => {
  if (D.VITALIDADE.ligada) return;
  const p = R.criarPersonagem('V', 'masculino', 'humano', 'cavaleiro');
  const b = R.iniciarBatalha(p, 'lobo', rng); b.fim = 'vitoria';
  const r = R.concluirBatalha(p, b, Date.now());
  assert.ok(!r.vitalidade); assert.strictEqual(r.exp, D.monstros.lobo.exp);
});
