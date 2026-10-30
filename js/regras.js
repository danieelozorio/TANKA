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
  // Arma também tem `variacao` (qual dos 8 nomes) e `dano` [mín, máx], sorteados nas faixas da raridade.
  function novoItem(tipo, classe, raridade, rng) {
    var joia = TIPOS_JOIA.indexOf(tipo) >= 0;
    var item = { id: novoId(), tipo: tipo, classe: joia ? null : classe, raridade: raridade, encanto: 0 };
    if (tipo === 'arma') {
      rng = rng || Math.random;
      var r = D.raridades[raridade];
      item.variacao = Math.floor(rng() * D.armas[classe][raridade].length);
      item.dano = [rolar(r.danoMin, rng), rolar(r.danoMax, rng)];
    }
    return item;
  }
  function novaArma(classe, raridade, rng) { return novoItem('arma', classe, raridade, rng); }

  // Definição de armadura/joia nos dados (null para arma).
  function definicao(item) {
    if (item.tipo === 'arma') return null;
    if (TIPOS_JOIA.indexOf(item.tipo) >= 0) return D.joias[item.tipo];
    return D.armaduras[item.classe][item.tipo];
  }

  function nomeArma(item) {
    var base = item.tipo !== 'arma' ? definicao(item).nomes[RARIDADES.indexOf(item.raridade)]
      : item.variacao === undefined ? D.armas[item.classe].tipo + ' ' + D.raridades[item.raridade].nome   // modelo do mercado
      : D.armas[item.classe][item.raridade][item.variacao];
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
  // Sem `dano` (modelo do mercado): mostra a faixa possível inteira.
  function danoArmaComEncanto(item) {
    var r = D.raridades[item.raridade];
    var base = item.dano || [r.danoMin[0], r.danoMax[1]];
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
    p.hpAtual = Math.max(p.hpAtual > 0 ? 1 : 0, Math.min(hpMax, p.hpAtual + hpMax - hpMaxAntes));
  }

  function criarPersonagem(nome, sexo, raca, classe) {
    var atr = atributosIniciais(raca, classe);
    var arma = novaArma(classe, 'comum');
    arma.variacao = 0;                                  // arma clássica da classe
    arma.dano = D.ARMA_INICIAL_DANO.slice();
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
      pocoes: D.VIDA.pocoesPorDia,
      ultimoReset: null,   // dia (AAAA-MM-DD, Brasília) do último reset diário
      vidaEm: null,        // momento (ms) até onde a vida com o tempo já foi contada
      acampado: false,
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
      // Armas de antes do dano sorteado: nome clássico e dano no meio das faixas.
      if (i.tipo === 'arma' && !i.dano) {
        var r = D.raridades[i.raridade];
        i.variacao = 0;
        i.dano = [Math.round((r.danoMin[0] + r.danoMin[1]) / 2), Math.round((r.danoMax[0] + r.danoMax[1]) / 2)];
      }
    });
    if (!p.presencaChefe) p.presencaChefe = {};
    if (typeof p.pocoes !== 'number') { p.pocoes = D.VIDA.pocoesPorDia; p.ultimoReset = null; p.vidaEm = null; p.acampado = false; }
    if (p.abates.grakk) { p.abates.velgrath = (p.abates.velgrath || 0) + p.abates.grakk; delete p.abates.grakk; } // chefe renomeado
    if (!p.equipados) {
      p.equipados = Object.assign(equipamentosVazios(), { arma: p.armaEquipada || null });
      delete p.armaEquipada;
    }
    return p;
  }

  function velocidadeDoNivel(nivel) {
    return Math.round(D.VELOCIDADE.inicial * Math.pow(D.VELOCIDADE.porNivel, nivel - 1));
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
      velocidade: velocidadeDoNivel(p.nivel),        // 15 no level 1, +6% por level (não depende da DES)
      chanceCritico: a.sor * 0.5,                    // SOR (%)
      danoCritico: 150 + a.for,                      // FOR (% do dano)
      chanceCriticoMagico: a.des * 0.5,              // DES (%)
      danoCriticoMagico: 150 + a.sor,                // SOR (% do dano)
      chanceCraft: a.sor,                            // SOR (%)
      bonusDrop: a.sor,                              // SOR (% a mais sobre a chance base)
      chanceEncantamento: a.sor,                     // 1% por ponto de SOR
    };
  }

  // Poder: nota de força para o ranking (ataque por tempo + resistência).
  // Ataque = dano médio x crítico esperado x precisão x velocidade; resistência = vida x defesas x evasão.
  function poder(p) {
    var s = status(p);
    var magico = s.tipoDano === 'magico';
    var chanceCrit = Math.min(100, magico ? s.chanceCriticoMagico : s.chanceCritico) / 100;
    var multCrit = (magico ? s.danoCriticoMagico : s.danoCritico) / 100;
    var ataque = (s.dano[0] + s.dano[1]) / 2 * (1 + chanceCrit * (multCrit - 1))
      * Math.min(95, s.precisao) / 100 * s.velocidade / 10;
    var resistencia = s.hpMax * (1 + (s.defesa + s.defesaMagica) / 20) * (1 + Math.min(50, s.evasao) / 100);
    return Math.round(ataque * 10 + resistencia / 2);
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
    return raridade ? novaArma(p.classe, raridade, rng) : null;
  }

  // Item de qualquer tipo das caçadas: arma ou uma das 4 armaduras da classe.
  var TODOS_TIPOS = ['arma'].concat(TIPOS_ARMADURA);
  function itemQualquer(p, raridade, rng) {
    return novoItem(TODOS_TIPOS[Math.floor(rng() * TODOS_TIPOS.length)], p.classe, raridade, rng);
  }
  function rolarDropItem(p, monstroId, rng) {
    var raridade = rolarRaridade(p, D.monstros[monstroId].dropsItem || [], rng);
    return raridade ? itemQualquer(p, raridade, rng) : null;
  }

  // Peça sorteada entre as 4 armaduras da classe (colar e anel só nas masmorras).
  function rolarDropArmadura(p, monstroId, rng) {
    var raridade = rolarRaridade(p, D.monstros[monstroId].dropsArmadura || [], rng);
    if (!raridade) return null;
    return novoItem(TIPOS_ARMADURA[Math.floor(rng() * TIPOS_ARMADURA.length)], p.classe, raridade);
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

  // % da exp que o personagem ganha na área do monstro (100, 50 ou 10).
  function fatorExp(p, monstroId) {
    var area = areaDoMonstro(monstroId);
    var proxima = D.areas[D.areas.indexOf(area) + 1];
    if (!proxima) return 100;
    var acima = p.nivel - proxima.nivelMin;
    var faixa = D.EXP_REDUZIDA.find(function (f) { return acima >= f.acima; });
    return faixa ? faixa.pct : 100;
  }

  // ---------- Vida com o tempo, poções e reset diário ----------
  // `agora` em ms (Date.now()). O dia do reset é contado no horário de Brasília.
  function diaReset(agora) {
    return new Date(agora + D.VIDA.fusoReset * 3600000).toISOString().slice(0, 10);
  }
  function msAteReset(agora) {
    var local = agora + D.VIDA.fusoReset * 3600000;
    return 86400000 - (local % 86400000);
  }
  function regenPorMinuto(p) {
    return status(p).hpMax * D.VIDA.regenPorMinuto * (p.acampado ? D.VIDA.acampamento : 1) / 100;
  }

  // Aplica o reset diário e a vida recuperada desde a última conta. Não chamar durante a batalha.
  // Retorna true se algo mudou.
  function atualizarTempo(p, agora) {
    var hpMax = status(p).hpMax;
    var dia = diaReset(agora);
    if (p.ultimoReset !== dia) {
      p.ultimoReset = dia;
      p.hpAtual = hpMax;
      p.pocoes = D.VIDA.pocoesPorDia;
      p.vidaEm = agora;
      return true;
    }
    if (!p.vidaEm || p.hpAtual >= hpMax || agora < p.vidaEm) { p.vidaEm = agora; return false; }
    var porMin = regenPorMinuto(p);
    var ganho = Math.floor((agora - p.vidaEm) / 60000 * porMin);
    if (ganho <= 0) return false;
    p.hpAtual = Math.min(hpMax, p.hpAtual + ganho);
    // Guarda a sobra de tempo que ainda não virou 1 de vida.
    p.vidaEm = p.hpAtual >= hpMax ? agora : p.vidaEm + ganho / porMin * 60000;
    return true;
  }

  // Minutos até a vida encher (0 se já está cheia).
  function minutosParaVidaCheia(p) {
    var falta = status(p).hpMax - p.hpAtual;
    return falta > 0 ? Math.ceil(falta / regenPorMinuto(p)) : 0;
  }

  function acampar(p, agora, sim) {
    atualizarTempo(p, agora);
    p.acampado = !!sim;
  }

  // Poção fora da batalha: cura 100%. Retorna false sem poção ou com a vida cheia.
  function usarPocao(p, agora) {
    atualizarTempo(p, agora);
    if (p.pocoes <= 0 || p.hpAtual >= status(p).hpMax) return false;
    p.pocoes -= 1;
    p.hpAtual = status(p).hpMax;
    p.vidaEm = agora;
    return true;
  }

  // Ao clicar em Caçar: sorteia se o chefe da área aparece no lugar do monstro.
  function sortearChefe(p, monstroId, rng) {
    var area = areaDoMonstro(monstroId);
    var chance = p.presencaChefe[area.id] || 0;
    return (rng || Math.random)() * 100 < chance ? area.chefe.id : null;
  }

  // Drop do chefe. Com `dropItem`: chance de 1 item de qualquer tipo (pode não vir nada).
  // Sem: sempre 1 arma ou armadura, raridade pela tabela do chefe.
  function dropChefe(p, m, rng) {
    if (m.dropItem) {
      var r = rolarRaridade(p, m.dropItem, rng);
      return r ? itemQualquer(p, r, rng) : null;
    }
    var raridade = rolarRaridade(p, m.dropsChefe, rng) || m.dropPadrao;
    if (rng() < 0.5) return novaArma(p.classe, raridade, rng);
    return novoItem(TIPOS_ARMADURA[Math.floor(rng() * TIPOS_ARMADURA.length)], p.classe, raridade);
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
      pocoes: p.pocoes,                   // poções disponíveis na luta
      pocaoPendente: false,               // bebe na próxima vez do jogador
      jogador: { nome: p.nome, hp: p.hpAtual, hpMax: s.hpMax, vel: Math.max(1, s.velocidade), barra: 0, poder: 0 },
      // O monstro começa com a barra cheia: o primeiro golpe da luta é sempre dele.
      monstro: { nome: m.nome, hp: m.hp, hpMax: m.hp, vel: Math.max(1, m.velocidade), barra: 100,
        atordoado: 0, armaduraQuebrada: false },
      fim: null,
    };
  }

  // Um golpe do jogador. opcoes: mult, sempreAcerta, ignoraDefesa, bonusCritico (%).
  function golpeJogador(b, opcoes) {
    var s = b.s, m = D.monstros[b.monstroId], rng = b.rng;
    var magico = s.tipoDano === 'magico';
    var g = { acerto: false, critico: false, dano: 0 };
    // Precisão menos 3% por área (Floresta 0%, Cume do Fogo -18%).
    if (!opcoes.sempreAcerta && rng() * 100 >= limitar(s.precisao - m.indiceArea * 3, 5, 95)) return g;
    var defesa = opcoes.ignoraDefesa ? 0 : (magico ? m.defesaMagica : m.defesa);
    // A defesa do monstro reduz em porcentagem: 100 / (100 + defesa).
    var dano = Math.max(1, Math.round(rolar(s.dano, rng) * (opcoes.mult || 1) * 100 / (100 + defesa)));
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
    if (!D.HABILIDADES_ATIVAS || b.fim || b.jogador.poder < D.PODER.maximo) return false;
    b.habilidadePendente = true;
    return true;
  }

  // Pede a poção na batalha: o jogador bebe na próxima vez dele (gasta a vez).
  function beberPocao(b) {
    if (b.fim || b.pocoes <= 0 || b.pocaoPendente || b.jogador.hp >= b.jogador.hpMax) return false;
    b.pocaoPendente = true;
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
    // Acerto do monstro: 80% + 2% por área, menos a evasão do jogador.
    if (rng() * 100 >= limitar(80 + m.indiceArea * 2 - s.evasao, 5, 95)) return ev;
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
        if (b.pocaoPendente) {
          b.pocaoPendente = false;
          b.pocoes -= 1;
          var curou = b.jogador.hpMax - b.jogador.hp;
          b.jogador.hp = b.jogador.hpMax;
          return { ator: 'jogador', pocao: true, cura: curou };
        }
        var cheia = b.jogador.poder >= D.PODER.maximo;
        return D.HABILIDADES_ATIVAS && cheia && (b.habilidadePendente || b.auto) ? usarHabilidade(b) : ataqueJogador(b);
      }
      if (b.monstro.barra >= 100) { b.monstro.barra -= 100; return ataqueMonstro(b); }
      b.jogador.barra += b.jogador.vel;
      b.monstro.barra += b.monstro.vel;
    }
  }

  // Aplica o resultado no personagem. Derrota: fica com 0 de vida, perde 5% da exp do level
  // (sem descer de level) e só caça de novo quando a vida voltar com o tempo ou com poção.
  // `agora`: a vida com o tempo volta a contar a partir do fim da luta.
  function concluirBatalha(p, b, agora) {
    var res = { resultado: b.fim || 'fuga', exp: 0, ouro: 0, niveis: 0, drop: null };
    p.hpAtual = b.jogador.hp;
    p.pocoes = b.pocoes;
    p.vidaEm = agora || Date.now();
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
      res.fatorExp = fatorExp(p, b.monstroId);
      res.exp = res.fatorExp < 100 ? Math.max(1, Math.floor(m.exp * res.fatorExp / 100)) : m.exp;
      res.ouro = m.ouro;
      p.ouro += m.ouro;
      res.niveis = ganharExp(p, res.exp);
      if (m.chefe) {
        var premio = dropChefe(p, m, b.rng);
        if (premio && premio.tipo === 'arma') res.drop = premio; else if (premio) res.dropArmadura = premio;
        var arma = armaEquipada(p);
        var perg = m.pergaminhosChefe;
        var faixa = perg ? perg.qtd : D.chefe.pergaminhos;
        res.pergaminho = perg ? perg.raridade : arma ? arma.raridade : 'comum';
        res.qtdPergaminhos = faixa[0] + Math.floor(b.rng() * (faixa[1] - faixa[0] + 1));
        p.pergaminhos[res.pergaminho] += res.qtdPergaminhos;
      } else {
        res.drop = rolarDrop(p, b.monstroId, b.rng);
        res.dropArmadura = rolarDropArmadura(p, b.monstroId, b.rng);
        var qualquer = rolarDropItem(p, b.monstroId, b.rng);
        if (qualquer && qualquer.tipo === 'arma' && !res.drop) res.drop = qualquer;
        else if (qualquer && !res.dropArmadura) res.dropArmadura = qualquer;
      }
      // Mochila cheia: o item se perde e o jogador é avisado.
      if (res.drop && !guardar(p, res.drop)) { res.drop = null; res.mochilaCheia = true; }
      if (res.dropArmadura && !guardar(p, res.dropArmadura)) { res.dropArmadura = null; res.mochilaCheia = true; }
      if (!m.chefe) {
        res.pergaminho = rolarPergaminho(p, b.monstroId, b.rng);
        if (res.pergaminho) { p.pergaminhos[res.pergaminho] += 1; res.qtdPergaminhos = 1; }
      }
    } else if (b.fim === 'derrota') {
      p.hpAtual = 0;
      res.expPerdida = Math.min(p.exp, Math.ceil(expNecessaria(p.nivel) * D.PERDA_EXP_DERROTA / 100));
      if (p.nivel >= D.NIVEL_MAXIMO) res.expPerdida = 0;
      p.exp -= res.expPerdida;
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

  // Compra no mercado: arma (tipo 'arma') ou armadura da classe. Colar e anel só nas masmorras.
  // Retorna o item, ou um texto com o motivo da falha.
  function comprar(p, raridade, tipo) {
    var r = D.raridades[raridade];
    tipo = tipo || 'arma';
    if (TIPOS_JOIA.indexOf(tipo) >= 0) return 'Colar e anel só nas masmorras.';
    if (!r || ['arma'].concat(TIPOS_ARMADURA).indexOf(tipo) < 0) return 'Item inválido.';
    if (p.ouro < r.compra) return 'Ouro insuficiente.';
    if (mochilaCheia(p)) return 'Mochila cheia!';
    p.ouro -= r.compra;
    var item = novoItem(tipo, p.classe, raridade);
    p.inventario.push(item);
    return item;
  }

  // ---------- Encantamento ----------

  // Pergaminho dropado: raridade fixa do monstro ou, sem ela, a da arma equipada. Sorte aumenta a chance.
  function rolarPergaminho(p, monstroId, rng) {
    var perg = D.monstros[monstroId].pergaminho;
    if (!perg || !perg.chance) return null;
    if (rng() * 100 >= perg.chance * (1 + status(p).bonusDrop / 100)) return null;
    if (perg.raridade) return perg.raridade;
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

  // ---------- Masmorras ----------
  // A luta é automática e determinística: com a mesma semente e os mesmos heróis, todo
  // navegador calcula exatamente a mesma luta (o líder envia o resultado ao servidor).

  // Gerador de números com semente (mulberry32).
  function rngSemente(semente) {
    var a = semente >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function masmorra(id) { return D.masmorras.find(function (m) { return m.id === id; }) || null; }

  // As 3 salas, cada uma com a lista de monstros (cópias com vida/ataque já ajustados).
  function salasMasmorra(id) {
    var mm = masmorra(id), area = D.areas.find(function (a) { return a.id === mm.area; }), M = D.MASMORRA;
    var f = mm.forca || { vida: 1, ataque: 1 };   // ajuste de dificuldade da masmorra
    function copia(monstroId, nome, vida, ataque) {
      var m = D.monstros[monstroId], fv = (vida || 1) * f.vida, fa = (ataque || 1) * f.ataque;
      return { id: monstroId, nome: nome || m.nome, hp: Math.round(m.hp * fv),
        ataque: [Math.round(m.ataque[0] * fa), Math.round(m.ataque[1] * fa)],
        velocidade: m.velocidade, defesa: m.defesa, defesaMagica: m.defesaMagica, indiceArea: m.indiceArea,
        elite: !!nome && vida === M.elite.vida, chefe: vida === M.chefe.vida };
    }
    var ids = area.monstros.map(function (m) { return m.id; });
    return [
      ids.map(function (k) { return copia(k); }),
      [copia(ids[2]), copia(ids[2]), copia(ids[2], mm.elite, M.elite.vida, M.elite.ataque)],
      [copia(area.chefe.id, mm.chefe, M.chefe.vida, M.chefe.ataque)],
    ];
  }

  // herois: dados dos personagens (cópias). Retorna { vitoria, sala (onde terminou), inicio, eventos }.
  // Evento: { tipo: 'golpe', sala, de: 'h'|'m', i, alvo, acerto, critico, dano, caiu } ou { tipo: 'sala', sala }.
  function simularMasmorra(herois, masmorraId, semente) {
    var rng = rngSemente(semente);
    var hs = herois.map(function (dados) {
      var p = normalizar(JSON.parse(JSON.stringify(dados)));
      var s = status(p);
      return { nome: p.nome, classe: p.classe, raca: p.raca, sexo: p.sexo, s: s, hp: s.hpMax, hpMax: s.hpMax, vel: Math.max(1, s.velocidade), barra: 0 };
    });
    var salas = salasMasmorra(masmorraId);
    var inicio = {
      herois: hs.map(function (h) { return { nome: h.nome, classe: h.classe, raca: h.raca, sexo: h.sexo, hpMax: h.hpMax }; }),
      salas: salas.map(function (sala) { return sala.map(function (m) { return { id: m.id, nome: m.nome, hpMax: m.hp, elite: m.elite, chefe: m.chefe }; }); }),
    };
    var eventos = [];
    function vivos(lista) { return lista.filter(function (x) { return x.hp > 0; }); }
    for (var si = 0; si < salas.length; si++) {
      if (si > 0) eventos.push({ tipo: 'sala', sala: si });
      var ms = salas[si].map(function (m) { return Object.assign({}, m, { hpMax: m.hp, vel: Math.max(1, m.velocidade), barra: 100 }); });
      var tiques = 0;
      while (vivos(ms).length && vivos(hs).length) {
        if (++tiques > 200000) return { vitoria: false, sala: si, inicio: inicio, eventos: eventos };
        // Quem tiver a barra cheia age (monstros primeiro no empate); senão todos enchem a barra.
        var ator = null, ehHeroi = false;
        ms.forEach(function (m) { if (m.hp > 0 && m.barra >= 100 && (!ator || m.barra > ator.barra)) ator = m; });
        hs.forEach(function (h) { if (h.hp > 0 && h.barra >= 100 && (!ator || h.barra > ator.barra)) { ator = h; ehHeroi = true; } });
        if (!ator) {
          ms.forEach(function (m) { if (m.hp > 0) m.barra += m.vel; });
          hs.forEach(function (h) { if (h.hp > 0) h.barra += h.vel; });
          continue;
        }
        ator.barra -= 100;
        var ev = { tipo: 'golpe', sala: si, de: ehHeroi ? 'h' : 'm', i: ehHeroi ? hs.indexOf(ator) : ms.indexOf(ator), acerto: false, critico: false, dano: 0, caiu: false };
        if (ehHeroi) {
          var alvo = vivos(ms)[0], s = ator.s, magico = s.tipoDano === 'magico';
          ev.alvo = ms.indexOf(alvo);
          if (rng() * 100 < limitar(s.precisao - alvo.indiceArea * 3, 5, 95)) {
            var def = magico ? alvo.defesaMagica : alvo.defesa;
            var dano = Math.max(1, Math.round(rolar(s.dano, rng) * 100 / (100 + def)));
            if (rng() * 100 < (magico ? s.chanceCriticoMagico : s.chanceCritico)) {
              ev.critico = true;
              dano = Math.floor(dano * (magico ? s.danoCriticoMagico : s.danoCritico) / 100);
            }
            ev.acerto = true; ev.dano = dano;
            alvo.hp = Math.max(0, alvo.hp - dano);
            ev.caiu = alvo.hp === 0;
          }
        } else {
          var lista = vivos(hs), heroi = lista[Math.floor(rng() * lista.length)];
          ev.alvo = hs.indexOf(heroi);
          if (rng() * 100 < limitar(80 + ator.indiceArea * 2 - heroi.s.evasao, 5, 95)) {
            var d = Math.max(1, rolar(ator.ataque, rng) - heroi.s.defesa);
            ev.acerto = true; ev.dano = d;
            heroi.hp = Math.max(0, heroi.hp - d);
            ev.caiu = heroi.hp === 0;
          }
        }
        eventos.push(ev);
      }
      if (!vivos(hs).length) return { vitoria: false, sala: si, inicio: inicio, eventos: eventos };
    }
    return { vitoria: true, sala: salas.length - 1, inicio: inicio, eventos: eventos };
  }

  // ---------- Skins do dado ----------
  function skinsDoPersonagem(p) { return p.skinsDado || ['vermelho']; }
  // Compra uma skin. Retorna true ou um texto com o motivo.
  function comprarSkin(p, id) {
    var skin = D.SKINS_DADO.find(function (s) { return s.id === id; });
    if (!skin) return 'Skin inválida.';
    if (skinsDoPersonagem(p).indexOf(id) >= 0) return 'Você já tem essa skin.';
    if (p.ouro < skin.preco) return 'Ouro insuficiente.';
    p.ouro -= skin.preco;
    p.skinsDado = skinsDoPersonagem(p).concat([id]);
    p.skinDado = id;
    return true;
  }
  function usarSkin(p, id) {
    if (skinsDoPersonagem(p).indexOf(id) < 0) return false;
    p.skinDado = id;
    return true;
  }

  // ---------- Ferramentas de administrador (para testes) ----------
  var admin = {
    // Quantidades negativas tiram (sem ficar abaixo de 0).
    ouro: function (p, quantidade) { p.ouro = Math.max(0, p.ouro + quantidade); },
    zerarOuro: function (p) { p.ouro = 0; },
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
    // Desce de level: zera a exp e devolve todos os pontos para distribuir de novo.
    baixarNivel: function (p, niveis) {
      p.nivel = Math.max(1, p.nivel - niveis);
      p.exp = 0;
      admin.resetarAtributos(p);
    },
    resetarAtributos: function (p) {
      var hpAntes = status(p).hpMax;
      p.atributos = Object.assign({}, p.atributosIniciais);
      p.pontosLivres = (p.nivel - 1) * D.PONTOS_POR_NIVEL;
      ajustarVida(p, hpAntes);
      p.hpAtual = Math.min(p.hpAtual, status(p).hpMax);
    },
    // % da exp do level atual (negativo tira). Somar pode subir de level.
    exp: function (p, pct) {
      if (p.nivel >= D.NIVEL_MAXIMO) return;
      var qtd = Math.round(expNecessaria(p.nivel) * pct / 100);
      if (qtd >= 0) ganharExp(p, qtd); else p.exp = Math.max(0, p.exp + qtd);
    },
    pergaminhos: function (p, quantidade) {
      Object.keys(p.pergaminhos).forEach(function (k) { p.pergaminhos[k] = Math.max(0, p.pergaminhos[k] + quantidade); });
    },
    // Deixa a vida em X% da máxima (0 = sem vida).
    vida: function (p, pct) { p.hpAtual = Math.floor(status(p).hpMax * pct / 100); },
    zerarPocoes: function (p) { p.pocoes = 0; },
    // Tira da mochila tudo que não está equipado.
    esvaziarMochila: function (p) {
      p.inventario = p.inventario.filter(function (i) { return slotDoItem(p, i.id); });
    },
    // Conjunto completo de uma raridade: arma, 4 armaduras da classe, colar e 2 anéis.
    recarregarPocoes: function (p) { p.pocoes = D.VIDA.pocoesPorDia; },
    resetDiario: function (p, agora) { p.ultimoReset = null; atualizarTempo(p, agora); },
    conjunto: function (p, raridade) {
      ['arma'].concat(TIPOS_ARMADURA, ['colar', 'anel', 'anel']).forEach(function (tipo) {
        p.inventario.push(novoItem(tipo, p.classe, raridade));
      });
    },
  };

  // Cura tudo (admin).
  function descansar(p, agora) { p.hpAtual = status(p).hpMax; p.vidaEm = agora || Date.now(); }

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
    poder: poder,
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
    rolarDropItem: rolarDropItem,
    novaArma: novaArma,
    velocidadeDoNivel: velocidadeDoNivel,
    nivelHabilidade: nivelHabilidade,
    prepararHabilidade: prepararHabilidade,
    areaDoMonstro: areaDoMonstro,
    areaLiberada: areaLiberada,
    podeCacar: podeCacar,
    sortearChefe: sortearChefe,
    skinsDoPersonagem: skinsDoPersonagem,
    comprarSkin: comprarSkin,
    usarSkin: usarSkin,
    masmorra: masmorra,
    salasMasmorra: salasMasmorra,
    simularMasmorra: simularMasmorra,
    fatorExp: fatorExp,
    diaReset: diaReset,
    msAteReset: msAteReset,
    atualizarTempo: atualizarTempo,
    minutosParaVidaCheia: minutosParaVidaCheia,
    acampar: acampar,
    usarPocao: usarPocao,
    beberPocao: beberPocao,
  };
})();
