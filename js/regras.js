// Tanka — regras do jogo: atributos derivados, level, combate por velocidade e drops.
// Funções puras (sem DOM), recebem `rng` para poderem ser testadas.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.regras = (function () {
  var D = Tanka.dados;
  var ATRIBUTOS = ['for', 'des', 'res', 'int', 'sor'];

  function limitar(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function rolar(intervalo, rng) {
    return intervalo[0] + Math.floor(rng() * (intervalo[1] - intervalo[0] + 1));
  }
  function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function atributosIniciais(raca, classe) {
    var base = Object.assign({}, D.classes[classe].atributos);
    var r = D.racas[raca];
    r.elevados.forEach(function (k) { base[k] += D.MODIFICADOR_RACA; });
    r.reduzidos.forEach(function (k) { base[k] -= D.MODIFICADOR_RACA; });
    return base;
  }

  // Exp para passar do `nivel` atual ao próximo: 10, 20, 40, 80...
  function expNecessaria(nivel) { return D.EXP_BASE * Math.pow(2, nivel - 1); }

  function novaArma(classe, raridade) {
    return { id: novoId(), classe: classe, raridade: raridade };
  }
  function nomeArma(item) { return D.armas[item.classe][item.raridade]; }
  function armaEquipada(p) {
    return p.inventario.find(function (i) { return i.id === p.armaEquipada; }) || null;
  }

  function criarPersonagem(nome, raca, classe) {
    var atr = atributosIniciais(raca, classe);
    var arma = novaArma(classe, 'basica');
    return {
      id: novoId(),
      nome: nome,
      raca: raca,
      classe: classe,
      nivel: 1,
      exp: 0,
      atributos: atr,
      atributosIniciais: Object.assign({}, atr),
      pontosLivres: 0,
      hpAtual: D.HP_INICIAL,
      inventario: [arma],
      armaEquipada: arma.id,
      abates: {},
      criadoEm: new Date().toISOString(),
    };
  }

  // Todos os status vêm dos atributos básicos (valores em % onde indicado).
  function status(p) {
    var a = p.atributos;
    var arma = armaEquipada(p);
    var magico = D.classes[p.classe].dano === 'magico';
    var danoArma = arma ? D.raridades[arma.raridade].dano : [0, 0];
    var bonus = magico ? Math.floor(a.int / 5) : Math.floor(a.for / 5);
    return {
      hpMax: D.HP_INICIAL
        + Math.max(0, a.res - p.atributosIniciais.res) * D.HP_POR_RES
        + (p.nivel - 1) * D.HP_POR_NIVEL,
      tipoDano: magico ? 'magico' : 'fisico',
      danoArma: danoArma,
      ataque: Math.floor(a.for / 5),                 // FOR
      ataqueMagico: Math.floor(a.int / 5),           // INT
      dano: [danoArma[0] + bonus, danoArma[1] + bonus],
      defesa: Math.floor(a.res / 10),                // RES
      defesaMagica: Math.floor(a.res / 10),          // RES
      precisao: 75 + a.des,                          // DES (%)
      evasao: a.des * 0.5,                           // DES (%)
      velocidade: a.des,                             // DES: 10 de DES = 10 de velocidade
      chanceCritico: a.sor * 0.5,                    // SOR (%)
      danoCritico: 150 + a.for,                      // FOR (% do dano)
      chanceCriticoMagico: a.des * 0.5,              // DES (%)
      danoCriticoMagico: 150 + a.sor,                // SOR (% do dano)
      chanceCraft: a.sor,                            // SOR (%)
      bonusDrop: a.sor,                              // SOR (% a mais sobre a chance base)
      chanceEncantamento: a.sor,                     // 1% por ponto de SOR
    };
  }

  function distribuirPonto(p, atributo) {
    if (p.pontosLivres <= 0 || ATRIBUTOS.indexOf(atributo) < 0) return false;
    var hpAntes = status(p).hpMax;
    p.atributos[atributo] += 1;
    p.pontosLivres -= 1;
    p.hpAtual += status(p).hpMax - hpAntes;
    return true;
  }

  // Soma exp e processa quantos levels couberem. Retorna os levels ganhos.
  function ganharExp(p, quantidade) {
    var niveis = 0;
    p.exp += quantidade;
    while (p.exp >= expNecessaria(p.nivel)) {
      p.exp -= expNecessaria(p.nivel);
      p.nivel += 1;
      p.pontosLivres += D.PONTOS_POR_NIVEL;
      niveis += 1;
    }
    if (niveis > 0) p.hpAtual = status(p).hpMax;
    return niveis;
  }

  // Uma única rolagem; as chances são cumulativas (ex.: Urso: <10 épica, <40 rara).
  function rolarDrop(p, monstroId, rng) {
    var m = D.monstros[monstroId];
    var mult = 1 + status(p).bonusDrop / 100;
    var r = rng() * 100;
    var acumulado = 0;
    for (var i = 0; i < m.drops.length; i++) {
      acumulado += m.drops[i].chance * mult;
      if (r < acumulado) return novaArma(p.classe, m.drops[i].raridade);
    }
    return null;
  }

  // ---------- Combate ----------
  // Barra de ação: cada lutador soma sua velocidade por tique e age ao chegar a 100.
  // Velocidade 20 contra 10 = duas ações para cada uma do adversário.

  function iniciarBatalha(p, monstroId, rng) {
    var m = D.monstros[monstroId];
    var s = status(p);
    return {
      monstroId: monstroId,
      rng: rng || Math.random,
      s: s,
      jogador: { nome: p.nome, hp: p.hpAtual, hpMax: s.hpMax, vel: Math.max(1, s.velocidade), barra: 0 },
      monstro: { nome: m.nome, hp: m.hp, hpMax: m.hp, vel: Math.max(1, m.velocidade), barra: 0 },
      fim: null,
    };
  }

  function ataqueJogador(b) {
    var s = b.s, m = D.monstros[b.monstroId], rng = b.rng;
    var magico = s.tipoDano === 'magico';
    var evasaoMonstro = m.velocidade * 0.5;
    var ev = { ator: 'jogador', acerto: false, critico: false, dano: 0, magico: magico };
    if (rng() * 100 >= limitar(s.precisao - evasaoMonstro, 5, 95)) return ev;
    var dano = rolar(s.dano, rng) - (magico ? m.defesaMagica : m.defesa);
    dano = Math.max(1, dano);
    var chanceCrit = magico ? s.chanceCriticoMagico : s.chanceCritico;
    if (rng() * 100 < chanceCrit) {
      ev.critico = true;
      dano = Math.floor(dano * (magico ? s.danoCriticoMagico : s.danoCritico) / 100);
    }
    ev.acerto = true;
    ev.dano = dano;
    b.monstro.hp = Math.max(0, b.monstro.hp - dano);
    if (b.monstro.hp === 0) b.fim = 'vitoria';
    return ev;
  }

  function ataqueMonstro(b) {
    var s = b.s, m = D.monstros[b.monstroId], rng = b.rng;
    var ev = { ator: 'monstro', acerto: false, critico: false, dano: 0 };
    if (rng() * 100 >= limitar(75 + m.velocidade - s.evasao, 5, 95)) return ev;
    var dano = Math.max(1, rolar(m.ataque, rng) - s.defesa);
    ev.acerto = true;
    ev.dano = dano;
    b.jogador.hp = Math.max(0, b.jogador.hp - dano);
    if (b.jogador.hp === 0) b.fim = 'derrota';
    return ev;
  }

  // Avança até a próxima ação e a retorna (null se a batalha já acabou).
  function passo(b) {
    if (b.fim) return null;
    for (;;) {
      if (b.jogador.barra >= 100) { b.jogador.barra -= 100; return ataqueJogador(b); }
      if (b.monstro.barra >= 100) { b.monstro.barra -= 100; return ataqueMonstro(b); }
      b.jogador.barra += b.jogador.vel;
      b.monstro.barra += b.monstro.vel;
    }
  }

  // Aplica o resultado no personagem. Derrota: volta com metade do HP, sem perder exp.
  function concluirBatalha(p, b) {
    var res = { resultado: b.fim || 'fuga', exp: 0, niveis: 0, drop: null };
    p.hpAtual = b.jogador.hp;
    if (b.fim === 'vitoria') {
      var m = D.monstros[b.monstroId];
      p.abates[b.monstroId] = (p.abates[b.monstroId] || 0) + 1;
      res.exp = m.exp;
      res.niveis = ganharExp(p, m.exp);
      res.drop = rolarDrop(p, b.monstroId, b.rng);
      if (res.drop) p.inventario.push(res.drop);
    } else if (b.fim === 'derrota') {
      p.hpAtual = Math.ceil(status(p).hpMax / 2);
    }
    return res;
  }

  function descansar(p) { p.hpAtual = status(p).hpMax; }

  function equipar(p, itemId) {
    var item = p.inventario.find(function (i) { return i.id === itemId; });
    if (!item || item.classe !== p.classe) return false;
    p.armaEquipada = itemId;
    return true;
  }

  return {
    ATRIBUTOS: ATRIBUTOS,
    atributosIniciais: atributosIniciais,
    expNecessaria: expNecessaria,
    criarPersonagem: criarPersonagem,
    status: status,
    distribuirPonto: distribuirPonto,
    ganharExp: ganharExp,
    rolarDrop: rolarDrop,
    nomeArma: nomeArma,
    armaEquipada: armaEquipada,
    iniciarBatalha: iniciarBatalha,
    passo: passo,
    concluirBatalha: concluirBatalha,
    descansar: descansar,
    equipar: equipar,
  };
})();
