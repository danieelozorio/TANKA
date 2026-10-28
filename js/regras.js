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

  // Exp para passar do `nivel` atual ao próximo: dobra até o level 5 (10, 20, 40, 80, 160)
  // e depois cresce 50% por level (240, 360, 540...).
  function expNecessaria(nivel) {
    if (nivel <= 5) return D.EXP_BASE * Math.pow(2, nivel - 1);
    return Math.round(D.EXP_BASE * 16 * Math.pow(D.EXP_CRESCIMENTO, nivel - 5));
  }

  var RARIDADES = Object.keys(D.raridades);         // comum, rara, epica, lendaria
  var TIPOS_ARMADURA = ['elmo', 'peitoral', 'luvas', 'botas'];
  var TIPOS_JOIA = ['colar', 'anel'];

  // Item: { id, tipo, classe, raridade, encanto }. Joias têm classe null (servem para todos).
  function novoItem(tipo, classe, raridade) {
    var joia = TIPOS_JOIA.indexOf(tipo) >= 0;
    return { id: novoId(), tipo: tipo, classe: joia ? null : classe, raridade: raridade, encanto: 0 };
  }
  function novaArma(classe, raridade) { return novoItem('arma', classe, raridade); }

  // Definição de armadura/joia nos dados (null para arma).
  function definicao(item) {
    if (item.tipo === 'arma') return null;
    if (TIPOS_JOIA.indexOf(item.tipo) >= 0) return D.joias[item.tipo];
    return D.armaduras[item.classe][item.tipo];
  }

  function nomeArma(item) {
    var base = item.tipo === 'arma'
      ? D.armas[item.classe][item.raridade]
      : definicao(item).nomes[RARIDADES.indexOf(item.raridade)];
    return (item.encanto ? '+' + item.encanto + ' ' : '') + base;
  }

  // Bônus de uma armadura/joia, já com o encantamento ({ defesa: 5, vida: 25, ... }).
  function bonusItem(item) {
    var def = definicao(item), b = {};
    if (!def) return b;
    var idx = RARIDADES.indexOf(item.raridade);
    Object.keys(def.bonus).forEach(function (k) { b[k] = def.bonus[k][idx]; });
    if (item.encanto) {
      var k = D.encantamento.bonusPorNivel[item.tipo];
      b[k] = (b[k] || 0) + item.encanto;
    }
    return b;
  }

  // Dano da arma já somando o bônus de encantamento.
  function danoArmaComEncanto(item) {
    var base = D.raridades[item.raridade].dano;
    var extra = (item.encanto || 0) * D.encantamento.danoPorNivel[item.raridade];
    return [base[0] + extra, base[1] + extra];
  }

  function precoVenda(item) {
    return Math.round(D.raridades[item.raridade].venda * (1 + (item.encanto || 0) * D.encantamento.vendaPorNivel));
  }
  // ---------- Equipamento e mochila ----------

  function equipamentosVazios() {
    var e = {};
    Object.keys(D.slots).forEach(function (k) { e[k] = null; });
    return e;
  }
  function itemPorId(p, id) {
    return p.inventario.find(function (i) { return i.id === id; }) || null;
  }
  function itemNoSlot(p, slot) { return p.equipados[slot] ? itemPorId(p, p.equipados[slot]) : null; }
  function armaEquipada(p) { return itemNoSlot(p, 'arma'); }
  function slotDoItem(p, itemId) {
    return Object.keys(p.equipados).find(function (k) { return p.equipados[k] === itemId; }) || null;
  }
  function mochila(p) {
    return p.inventario.filter(function (i) { return !slotDoItem(p, i.id); });
  }
  function mochilaCheia(p) { return mochila(p).length >= D.MOCHILA_MAX; }

  // Põe um item novo na mochila; falha se estiver cheia.
  function guardar(p, item) {
    if (mochilaCheia(p)) return false;
    p.inventario.push(item);
    return true;
  }

  function podeUsar(p, item) { return item.classe === null || item.classe === p.classe; }

  // Soma dos bônus de todas as armaduras e joias equipadas.
  function bonusEquipamentos(p) {
    var total = {};
    Object.keys(D.bonus).forEach(function (k) { total[k] = 0; });
    Object.keys(p.equipados).forEach(function (slot) {
      var item = itemNoSlot(p, slot);
      if (!item) return;
      var b = bonusItem(item);
      Object.keys(b).forEach(function (k) { total[k] += b[k]; });
    });
    return total;
  }

  // Atributos básicos + bônus dos equipamentos (valem para tudo que o atributo influencia).
  function atributosTotais(p) {
    var b = bonusEquipamentos(p), a = {};
    ATRIBUTOS.forEach(function (k) { a[k] = p.atributos[k] + b[k]; });
    return a;
  }

  // Mantém a vida coerente quando o HP máximo muda (equipar, desequipar, distribuir ponto).
  function ajustarVida(p, hpMaxAntes) {
    var hpMax = status(p).hpMax;
    p.hpAtual = Math.max(1, Math.min(hpMax, p.hpAtual + hpMax - hpMaxAntes));
  }

  function criarPersonagem(nome, sexo, raca, classe) {
    var atr = atributosIniciais(raca, classe);
    var arma = novaArma(classe, 'comum');
    return {
      id: novoId(),
      nome: nome,
      sexo: sexo,
      raca: raca,
      classe: classe,
      nivel: 1,
      exp: 0,
      atributos: atr,
      atributosIniciais: Object.assign({}, atr),
      pontosLivres: 0,
      ouro: 0,
      pergaminhos: { comum: 0, rara: 0, epica: 0, lendaria: 0 },
      hpAtual: D.HP_INICIAL,
      inventario: [arma],
      equipados: Object.assign(equipamentosVazios(), { arma: arma.id }),
      abates: {},
      presencaChefe: {},   // por área: % acumulada de o chefe aparecer (o jogador não vê)
      criadoEm: new Date().toISOString(),
    };
  }

  // Atualiza personagens salvos em versões antigas do jogo.
  function normalizar(p) {
    if (!p.sexo) p.sexo = 'masculino';
    if (typeof p.ouro !== 'number') p.ouro = 0;
    if (!p.pergaminhos) p.pergaminhos = { comum: 0, rara: 0, epica: 0, lendaria: 0 };
    p.inventario.forEach(function (i) {
      if (i.raridade === 'basica') i.raridade = 'comum';
      if (typeof i.encanto !== 'number') i.encanto = 0;
      if (!i.tipo) i.tipo = 'arma';
    });
    if (!p.presencaChefe) p.presencaChefe = {};
    if (p.abates.grakk) { p.abates.velgrath = (p.abates.velgrath || 0) + p.abates.grakk; delete p.abates.grakk; } // chefe renomeado
    if (!p.equipados) {
      p.equipados = Object.assign(equipamentosVazios(), { arma: p.armaEquipada || null });
      delete p.armaEquipada;
    }
    return p;
  }

  // Status vêm dos atributos (básicos + equipamentos) e dos bônus diretos das armaduras.
  function status(p) {
    var a = atributosTotais(p);
    var eq = bonusEquipamentos(p);
    var arma = armaEquipada(p);
    var magico = D.classes[p.classe].dano === 'magico';
    var danoArma = arma ? danoArmaComEncanto(arma) : [0, 0];
    var bonus = magico ? Math.floor(a.int / 5) : Math.floor(a.for / 5);
    return {
      hpMax: D.HP_INICIAL
        + Math.max(0, a.res - p.atributosIniciais.res) * D.HP_POR_RES
        + (p.nivel - 1) * D.HP_POR_NIVEL
        + eq.vida,
      tipoDano: magico ? 'magico' : 'fisico',
      danoArma: danoArma,
      ataque: Math.floor(a.for / 5),                 // FOR
      ataqueMagico: Math.floor(a.int / 5),           // INT
      dano: [danoArma[0] + bonus, danoArma[1] + bonus],
      defesa: Math.floor(a.res / 10) + eq.defesa,              // RES + armaduras
      defesaMagica: Math.floor(a.res / 10) + eq.defesaMagica,  // RES + armaduras
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
    ajustarVida(p, hpAntes);
    return true;
  }

  // Soma exp e processa quantos levels couberem. Retorna os levels ganhos.
  function ganharExp(p, quantidade) {
    var niveis = 0;
    p.exp += quantidade;
    while (p.nivel < D.NIVEL_MAXIMO && p.exp >= expNecessaria(p.nivel)) {
      p.exp -= expNecessaria(p.nivel);
      p.nivel += 1;
      p.pontosLivres += D.PONTOS_POR_NIVEL;
      niveis += 1;
    }
    if (p.nivel >= D.NIVEL_MAXIMO) p.exp = 0;
    if (niveis > 0) p.hpAtual = status(p).hpMax;
    return niveis;
  }

  // Uma única rolagem; as chances são cumulativas (ex.: Urso: <10 épica, <40 rara).
  function rolarRaridade(p, tabela, rng) {
    var mult = 1 + status(p).bonusDrop / 100;
    var r = rng() * 100;
    var acumulado = 0;
    for (var i = 0; i < tabela.length; i++) {
      acumulado += tabela[i].chance * mult;
      if (r < acumulado) return tabela[i].raridade;
    }
    return null;
  }

  function rolarDrop(p, monstroId, rng) {
    var raridade = rolarRaridade(p, D.monstros[monstroId].drops, rng);
    return raridade ? novaArma(p.classe, raridade) : null;
  }

  // Peça sorteada entre as 4 armaduras da classe, o colar e o anel.
  function rolarDropArmadura(p, monstroId, rng) {
    var raridade = rolarRaridade(p, D.monstros[monstroId].dropsArmadura || [], rng);
    if (!raridade) return null;
    var tipos = TIPOS_ARMADURA.concat(TIPOS_JOIA);
    return novoItem(tipos[Math.floor(rng() * tipos.length)], p.classe, raridade);
  }

  // ---------- Áreas e chefes ----------

  function areaDoMonstro(monstroId) {
    var area = D.monstros[monstroId].area;
    return D.areas.find(function (a) { return a.id === area; });
  }
  function areaLiberada(p, area) { return p.nivel >= area.nivelMin; }

  // Monstros comuns de áreas liberadas podem ser caçados; chefes só aparecem sozinhos.
  function podeCacar(p, monstroId) {
    var m = D.monstros[monstroId];
    return !!m && !m.chefe && areaLiberada(p, areaDoMonstro(monstroId));
  }

  // Ao clicar em Caçar: sorteia se o chefe da área aparece no lugar do monstro.
  function sortearChefe(p, monstroId, rng) {
    var area = areaDoMonstro(monstroId);
    var chance = p.presencaChefe[area.id] || 0;
    return (rng || Math.random)() * 100 < chance ? area.chefe.id : null;
  }

  // Drop garantido do chefe: arma ou armadura, raridade pela tabela do chefe.
  function dropChefe(p, m, rng) {
    var raridade = rolarRaridade(p, m.dropsChefe, rng) || m.dropPadrao;
    if (rng() < 0.5) return novaArma(p.classe, raridade);
    var tipos = TIPOS_ARMADURA.concat(TIPOS_JOIA);
    return novoItem(tipos[Math.floor(rng() * tipos.length)], p.classe, raridade);
  }

  // ---------- Combate ----------
  // Barra de ação: cada lutador soma sua velocidade por tique e age ao chegar a 100.
  // Velocidade 20 contra 10 = duas ações para cada uma do adversário.

  // Nível da habilidade (1 a 4) conforme o level do personagem.
  function nivelHabilidade(p) {
    return D.niveisHabilidade.filter(function (n) { return p.nivel >= n; }).length;
  }

  function iniciarBatalha(p, monstroId, rng) {
    var m = D.monstros[monstroId];
    var s = status(p);
    return {
      monstroId: monstroId,
      rng: rng || Math.random,
      s: s,
      classe: p.classe,
      nivelHab: nivelHabilidade(p),
      sorte: atributosTotais(p).sor,
      auto: !!p.habilidadeAuto,          // usa a habilidade sozinha quando carregar
      habilidadePendente: false,          // o jogador clicou: usa no próximo ataque
      jogador: { nome: p.nome, hp: p.hpAtual, hpMax: s.hpMax, vel: Math.max(1, s.velocidade), barra: 0, poder: 0 },
      monstro: { nome: m.nome, hp: m.hp, hpMax: m.hp, vel: Math.max(1, m.velocidade), barra: 0,
        atordoado: 0, armaduraQuebrada: false },
      fim: null,
    };
  }

  // Um golpe do jogador. opcoes: mult, sempreAcerta, ignoraDefesa, bonusCritico (%).
  function golpeJogador(b, opcoes) {
    var s = b.s, m = D.monstros[b.monstroId], rng = b.rng;
    var magico = s.tipoDano === 'magico';
    var g = { acerto: false, critico: false, dano: 0 };
    if (!opcoes.sempreAcerta && rng() * 100 >= limitar(s.precisao - m.velocidade * 0.5, 5, 95)) return g;
    var defesa = opcoes.ignoraDefesa ? 0 : (magico ? m.defesaMagica : m.defesa);
    var dano = Math.max(1, Math.round(rolar(s.dano, rng) * (opcoes.mult || 1)) - defesa);
    if (rng() * 100 < (magico ? s.chanceCriticoMagico : s.chanceCritico) + (opcoes.bonusCritico || 0)) {
      g.critico = true;
      dano = Math.floor(dano * (magico ? s.danoCriticoMagico : s.danoCritico) / 100);
    }
    if (b.monstro.armaduraQuebrada) dano = Math.round(dano * D.habilidades.artesao.danoArmaduraQuebrada);
    g.acerto = true;
    g.dano = dano;
    b.monstro.hp = Math.max(0, b.monstro.hp - dano);
    if (b.monstro.hp === 0) b.fim = 'vitoria';
    return g;
  }

  function ganharPoder(b, quanto) {
    b.jogador.poder = Math.min(D.PODER.maximo, b.jogador.poder + quanto);
  }

  function ataqueJogador(b) {
    var magico = b.s.tipoDano === 'magico';
    var g = golpeJogador(b, {});
    if (g.acerto) ganharPoder(b, D.habilidades[b.classe].poderPorAcerto || D.PODER.porAcerto);
    return { ator: 'jogador', acerto: g.acerto, critico: g.critico, dano: g.dano, magico: magico };
  }

  // Usa a habilidade da classe. Gasta toda a barra de Poder.
  function usarHabilidade(b) {
    var H = D.habilidades[b.classe], i = b.nivelHab - 1;
    var ev = { ator: 'jogador', habilidade: H.nome, magico: b.s.tipoDano === 'magico', golpes: [], dano: 0 };
    b.jogador.poder = 0;
    b.habilidadePendente = false;
    if (b.classe === 'cavaleiro') {
      ev.golpes.push(golpeJogador(b, { mult: H.multiplicador[i] }));
      if (ev.golpes[0].acerto && !b.fim) { b.monstro.atordoado += H.atordoa[i]; ev.atordoou = H.atordoa[i]; }
    } else if (b.classe === 'arqueiro') {
      for (var f = 0; f < H.flechas[i] && !b.fim; f++) ev.golpes.push(golpeJogador(b, { bonusCritico: H.bonusCritico[i] }));
    } else if (b.classe === 'mago') {
      ev.golpes.push(golpeJogador(b, { mult: H.multiplicador[i], sempreAcerta: true, ignoraDefesa: true }));
    } else {
      ev.golpes.push(golpeJogador(b, { mult: H.multiplicador[i], ignoraDefesa: true }));
      if (ev.golpes[0].acerto && !b.monstro.armaduraQuebrada && b.rng() * 100 < H.quebraArmadura[i] + b.sorte) {
        b.monstro.armaduraQuebrada = true;
        ev.quebrouArmadura = true;
      }
    }
    ev.golpes.forEach(function (g) { ev.dano += g.dano; });
    ev.acerto = ev.golpes.some(function (g) { return g.acerto; });
    ev.critico = ev.golpes.some(function (g) { return g.critico; });
    return ev;
  }

  // O jogador pede a habilidade (só com a barra cheia); ela sai no próximo ataque dele.
  function prepararHabilidade(b) {
    if (b.fim || b.jogador.poder < D.PODER.maximo) return false;
    b.habilidadePendente = true;
    return true;
  }

  function ataqueMonstro(b) {
    var s = b.s, m = D.monstros[b.monstroId], rng = b.rng;
    var ev = { ator: 'monstro', acerto: false, critico: false, dano: 0 };
    if (b.monstro.atordoado > 0) {
      b.monstro.atordoado -= 1;
      ev.atordoado = true;
      return ev;
    }
    if (rng() * 100 >= limitar(75 + m.velocidade - s.evasao, 5, 95)) return ev;
    var dano = Math.max(1, rolar(m.ataque, rng) - s.defesa);
    ev.acerto = true;
    ev.dano = dano;
    b.jogador.hp = Math.max(0, b.jogador.hp - dano);
    ganharPoder(b, D.PODER.porGolpeRecebido);
    if (b.jogador.hp === 0) b.fim = 'derrota';
    return ev;
  }

  // Avança até a próxima ação e a retorna (null se a batalha já acabou).
  function passo(b) {
    if (b.fim) return null;
    for (;;) {
      if (b.jogador.barra >= 100) {
        b.jogador.barra -= 100;
        var cheia = b.jogador.poder >= D.PODER.maximo;
        return cheia && (b.habilidadePendente || b.auto) ? usarHabilidade(b) : ataqueJogador(b);
      }
      if (b.monstro.barra >= 100) { b.monstro.barra -= 100; return ataqueMonstro(b); }
      b.jogador.barra += b.jogador.vel;
      b.monstro.barra += b.monstro.vel;
    }
  }

  // Aplica o resultado no personagem. Derrota: volta com metade do HP, sem perder exp.
  function concluirBatalha(p, b) {
    var res = { resultado: b.fim || 'fuga', exp: 0, ouro: 0, niveis: 0, drop: null };
    p.hpAtual = b.jogador.hp;
    if (b.fim === 'vitoria') {
      var m = D.monstros[b.monstroId];
      var area = areaDoMonstro(b.monstroId);
      p.abates[b.monstroId] = (p.abates[b.monstroId] || 0) + 1;
      if (m.chefe) {
        p.presencaChefe[area.id] = 0;
      } else {
        var presenca = (p.presencaChefe[area.id] || 0) + area.chanceChefe;
        p.presencaChefe[area.id] = Math.min(100, Math.round(presenca * 100) / 100);
      }
      res.exp = m.exp;
      res.ouro = m.ouro;
      p.ouro += m.ouro;
      res.niveis = ganharExp(p, m.exp);
      if (m.chefe) {
        var premio = dropChefe(p, m, b.rng);
        if (premio.tipo === 'arma') res.drop = premio; else res.dropArmadura = premio;
        var arma = armaEquipada(p);
        var faixa = D.chefe.pergaminhos;
        res.pergaminho = arma ? arma.raridade : 'comum';
        res.qtdPergaminhos = faixa[0] + Math.floor(b.rng() * (faixa[1] - faixa[0] + 1));
        p.pergaminhos[res.pergaminho] += res.qtdPergaminhos;
      } else {
        res.drop = rolarDrop(p, b.monstroId, b.rng);
        res.dropArmadura = rolarDropArmadura(p, b.monstroId, b.rng);
      }
      // Mochila cheia: o item se perde e o jogador é avisado.
      if (res.drop && !guardar(p, res.drop)) { res.drop = null; res.mochilaCheia = true; }
      if (res.dropArmadura && !guardar(p, res.dropArmadura)) { res.dropArmadura = null; res.mochilaCheia = true; }
      if (!m.chefe) {
        res.pergaminho = rolarPergaminho(p, b.monstroId, b.rng);
        if (res.pergaminho) { p.pergaminhos[res.pergaminho] += 1; res.qtdPergaminhos = 1; }
      }
    } else if (b.fim === 'derrota') {
      p.hpAtual = Math.ceil(status(p).hpMax / 2);
    }
    return res;
  }

  // Vende qualquer item que não esteja equipado.
  function vender(p, itemId) {
    if (slotDoItem(p, itemId)) return false;
    var i = p.inventario.findIndex(function (x) { return x.id === itemId; });
    if (i < 0) return false;
    p.ouro += precoVenda(p.inventario[i]);
    p.inventario.splice(i, 1);
    return true;
  }

  // Compra no mercado: arma (tipo 'arma'), armadura da classe ou joia.
  // Retorna o item, ou um texto com o motivo da falha.
  function comprar(p, raridade, tipo) {
    var r = D.raridades[raridade];
    tipo = tipo || 'arma';
    if (!r || ['arma'].concat(TIPOS_ARMADURA, TIPOS_JOIA).indexOf(tipo) < 0) return 'Item inválido.';
    if (p.ouro < r.compra) return 'Ouro insuficiente.';
    if (mochilaCheia(p)) return 'Mochila cheia!';
    p.ouro -= r.compra;
    var item = novoItem(tipo, p.classe, raridade);
    p.inventario.push(item);
    return item;
  }

  // ---------- Encantamento ----------

  // Pergaminho dropado: da mesma raridade da arma equipada. Sorte aumenta a chance.
  function rolarPergaminho(p, monstroId, rng) {
    var chance = D.monstros[monstroId].chancePergaminho;
    if (!chance) return null;
    if (rng() * 100 >= chance * (1 + status(p).bonusDrop / 100)) return null;
    var arma = armaEquipada(p);
    return arma ? arma.raridade : 'comum';
  }

  function comprarPergaminho(p, raridade) {
    var preco = D.encantamento.precoPergaminho[raridade];
    if (preco === undefined || p.ouro < preco) return false;
    p.ouro -= preco;
    p.pergaminhos[raridade] += 1;
    return true;
  }

  // Chance (%) de levar a arma ao próximo nível.
  function chanceEncantar(p, item) {
    var E = D.encantamento, alvo = item.encanto + 1;
    if (alvo <= E.seguroAte) return 100;
    return Math.min(E.chanceMaxima, E.chances[alvo] + atributosTotais(p).sor);
  }

  // O que acontece se falhar: 'nada', 'zera' ou 'quebra'.
  function riscoEncantar(item) {
    var E = D.encantamento, alvo = item.encanto + 1;
    if (alvo <= E.seguroAte) return 'nada';
    return alvo <= E.voltaZeroAte ? 'zera' : 'quebra';
  }

  // Tenta encantar. Retorna { sucesso, quebrou, nivel } ou null se não puder tentar.
  function encantar(p, itemId, rng) {
    var item = p.inventario.find(function (i) { return i.id === itemId; });
    if (!item || item.encanto >= D.encantamento.maximo || p.pergaminhos[item.raridade] <= 0) return null;
    var chance = chanceEncantar(p, item);
    var risco = riscoEncantar(item);
    var hpAntes = status(p).hpMax;
    var nivelAntes = item.encanto;
    var res;
    p.pergaminhos[item.raridade] -= 1;
    if ((rng || Math.random)() * 100 < chance) {
      item.encanto += 1;
      res = { sucesso: true, quebrou: false, nivel: item.encanto, item: item };
    } else if (risco === 'quebra') {
      var slot = slotDoItem(p, item.id);
      if (slot) p.equipados[slot] = null;
      p.inventario.splice(p.inventario.indexOf(item), 1);
      res = { sucesso: false, quebrou: true, nivel: nivelAntes, item: item };
    } else {
      if (risco === 'zera') item.encanto = 0;
      res = { sucesso: false, quebrou: false, nivel: nivelAntes, item: item };
    }
    ajustarVida(p, hpAntes);
    return res;
  }

  // ---------- Ferramentas de administrador (para testes) ----------
  var admin = {
    ouro: function (p, quantidade) { p.ouro += quantidade; },
    subirNivel: function (p, niveis) {
      for (var i = 0; i < niveis && p.nivel < D.NIVEL_MAXIMO; i++) ganharExp(p, expNecessaria(p.nivel) - p.exp);
    },
    // Uma arma de cada raridade da classe, já com o encantamento escolhido.
    armas: function (p, encanto) {
      Object.keys(D.raridades).forEach(function (k) {
        var item = novaArma(p.classe, k);
        item.encanto = encanto || 0;
        p.inventario.push(item);
      });
    },
    pergaminhos: function (p, quantidade) {
      Object.keys(p.pergaminhos).forEach(function (k) { p.pergaminhos[k] += quantidade; });
    },
    // Conjunto completo de uma raridade: arma, 4 armaduras da classe, colar e 2 anéis.
    conjunto: function (p, raridade) {
      ['arma'].concat(TIPOS_ARMADURA, ['colar', 'anel', 'anel']).forEach(function (tipo) {
        p.inventario.push(novoItem(tipo, p.classe, raridade));
      });
    },
  };

  function descansar(p) { p.hpAtual = status(p).hpMax; }

  // Equipa no espaço certo; se já houver item lá, ele volta para a mochila.
  // Anel vai para o primeiro espaço de anel livre (ou troca o primeiro).
  function equipar(p, itemId) {
    var item = itemPorId(p, itemId);
    if (!item || !podeUsar(p, item) || slotDoItem(p, itemId)) return false;
    var slot = item.tipo;
    if (item.tipo === 'anel') slot = !p.equipados.anel1 ? 'anel1' : !p.equipados.anel2 ? 'anel2' : 'anel1';
    var hpAntes = status(p).hpMax;
    p.equipados[slot] = itemId;
    ajustarVida(p, hpAntes);
    return slot;
  }

  // Desequipa e manda para a mochila (precisa de espaço).
  function desequipar(p, slot) {
    if (!p.equipados[slot] || mochilaCheia(p)) return false;
    var hpAntes = status(p).hpMax;
    p.equipados[slot] = null;
    ajustarVida(p, hpAntes);
    return true;
  }

  return {
    ATRIBUTOS: ATRIBUTOS,
    atributosIniciais: atributosIniciais,
    expNecessaria: expNecessaria,
    criarPersonagem: criarPersonagem,
    normalizar: normalizar,
    vender: vender,
    comprar: comprar,
    danoArma: danoArmaComEncanto,
    precoVenda: precoVenda,
    comprarPergaminho: comprarPergaminho,
    chanceEncantar: chanceEncantar,
    riscoEncantar: riscoEncantar,
    encantar: encantar,
    admin: admin,
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
    desequipar: desequipar,
    RARIDADES: RARIDADES,
    TIPOS_ARMADURA: TIPOS_ARMADURA,
    TIPOS_JOIA: TIPOS_JOIA,
    nomeItem: nomeArma,
    bonusItem: bonusItem,
    definicao: definicao,
    bonusEquipamentos: bonusEquipamentos,
    atributosTotais: atributosTotais,
    itemNoSlot: itemNoSlot,
    slotDoItem: slotDoItem,
    mochila: mochila,
    mochilaCheia: mochilaCheia,
    podeUsar: podeUsar,
    rolarDropArmadura: rolarDropArmadura,
    nivelHabilidade: nivelHabilidade,
    prepararHabilidade: prepararHabilidade,
    areaDoMonstro: areaDoMonstro,
    areaLiberada: areaLiberada,
    podeCacar: podeCacar,
    sortearChefe: sortearChefe,
  };
})();
