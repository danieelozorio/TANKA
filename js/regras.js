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
  // especifico: o tipo da arma (ex.: 'machado') ou do item da mão esquerda (ex.: 'escudo').
  // nivel: nível do item (1 a 60); sem ele, item no modelo antigo (valores fixos da raridade).
  function novoItem(tipo, classe, raridade, rng, especifico, nivel) {
    var joia = TIPOS_JOIA.indexOf(tipo) >= 0 || tipo === 'secundaria';
    var item = { id: novoId(), tipo: tipo, classe: joia ? null : classe, raridade: raridade, encanto: 0 };
    rng = rng || Math.random;
    if (tipo === 'arma') {
      var r = D.raridades[raridade];
      item.arma = especifico || D.ARMA_PADRAO[classe];
      item.classe = D.TIPOS_ARMA[item.arma].classe;
      item.variacao = Math.floor(rng() * (item.arma === D.ARMA_PADRAO[item.classe] ? D.armas[item.classe][raridade] : D.SUFIXOS_ARMA[raridade]).length);
      item.dano = [rolar(r.danoMin, rng), rolar(r.danoMax, rng)];
    }
    if (nivel) {
      item.nivel = Math.max(1, Math.min(D.ITEM_NIVEL.maximo, nivel));
      item.qualidade = sortearQualidade(raridade, rng);
      if (tipo === 'arma') { item.dano = danoDoNivel(item.nivel, item.qualidade); item.extras = sortearExtrasArma(item.nivel, rng); }
    }
    if (tipo === 'secundaria') {
      item.mao = especifico;
      item.variacao = Math.floor(rng() * D.SUFIXOS_ARMA[raridade].length);
    }
    if (tipo !== 'arma') item.bonus = sortearBonus(item, rng);
    return item;
  }
  // ---------- Nível e qualidade dos itens ----------
  var N_ = D.ITEM_NIVEL;
  function limitarNivel(n) { return Math.max(1, Math.min(N_.maximo, n)); }
  // Nível de um drop: o do herói ±3; do level 35 em diante, entre 35 e 60.
  function nivelDoDrop(p, rng) {
    rng = rng || Math.random;
    if (p.nivel >= N_.altoDesde) return N_.altoMin + Math.floor(rng() * (N_.maximo - N_.altoMin + 1));
    return limitarNivel(p.nivel - N_.variacao + Math.floor(rng() * (2 * N_.variacao + 1)));
  }
  function nivelDoMercado(p, rng) {
    return limitarNivel(p.nivel - N_.variacao + Math.floor((rng || Math.random)() * (2 * N_.variacao + 1)));
  }
  function sortearQualidade(raridade, rng) {
    var f = N_.faixaQualidade[raridade] || [0, 1];
    return Math.round((f[0] + (rng || Math.random)() * (f[1] - f[0])) * 1000) / 1000;
  }
  function multQualidade(q) { return N_.qualidadeMult[0] + (N_.qualidadeMult[1] - N_.qualidadeMult[0]) * q; }
  function danoDoNivel(nivel, q) {
    var media = (N_.danoPorNivel * nivel + N_.danoBase) * multQualidade(q);
    return [Math.max(1, Math.round(media * (1 - N_.danoFaixa))), Math.max(1, Math.round(media * (1 + N_.danoFaixa)))];
  }
  // Bônus de armadura/joia/mão esquerda no nível: o valor "raro" da tabela dobra a cada 10 níveis (referência no 15).
  function escalaNivel(nivel) {
    return Math.pow(2, (Math.min(nivel, 40) - N_.bonusReferencia) / N_.bonusDobraA) * (1 + Math.max(0, nivel - 40) * N_.bonusDepois40);
  }
  function bonusDoNivel(valorRaro, nivel, q) {
    return Math.max(1, Math.round(valorRaro * escalaNivel(nivel) * multQualidade(q) / multQualidade(0.55)));
  }
  // Extras da arma pela faixa de nível (EXTRAS_ARMA).
  function sortearExtrasArma(nivel, rng) {
    rng = rng || Math.random;
    var f = D.EXTRAS_ARMA.filter(function (x) { return nivel <= x.ate; })[0] || D.EXTRAS_ARMA[D.EXTRAS_ARMA.length - 1], e = {};
    if (f.atributos) {
      var livres = ATRIBUTOS.slice(); e.atributos = {};
      for (var i = 0; i < f.atributos[0]; i++) {
        var k = livres.splice(Math.floor(rng() * livres.length), 1)[0];
        e.atributos[k] = rolar([f.atributos[1], f.atributos[2]], rng);
      }
    }
    if (f.pve) e.pve = rolar(f.pve, rng);
    if (f.pvp) e.pvp = rolar(f.pvp, rng);
    if (f.hab) e.hab = { i: Math.floor(rng() * 4), n: rolar(f.hab, rng) };
    return e;
  }
  // ---------- Conjuntos das segundas classes ----------
  // id do conjunto: '<segunda classe>-<faixa>' (faixa 1 = níveis 1–10 ... 6 = 51–60).
  function conjuntoPara(p, nivel) {
    var c2 = p.talentos && p.talentos.classe2;
    return c2 && D.CONJUNTOS[c2] ? c2 + '-' + Math.min(6, Math.max(1, Math.ceil(nivel / 10))) : null;
  }
  function infoConjunto(id) {
    var partes = String(id || '').split('-'), c = D.CONJUNTOS[partes[0]], f = Number(partes[1]);
    return c && f ? { classe2: partes[0], faixa: f, nome: c.nomes[f - 1], bonus: c.bonus } : null;
  }
  // Peças equipadas por conjunto (só valem os da segunda classe do herói) e o bônus somado.
  function contarConjuntos(p) {
    var c2 = p.talentos && p.talentos.classe2, n = {};
    TIPOS_ARMADURA.forEach(function (slot) {
      var it = itemNoSlot(p, slot);
      if (it && it.conjunto && it.conjunto.split('-')[0] === c2) n[it.conjunto] = (n[it.conjunto] || 0) + 1;
    });
    return n;
  }
  function bonusConjuntos(p) {
    var n = contarConjuntos(p), b = {};
    Object.keys(n).forEach(function (id) {
      var info = infoConjunto(id);
      if (!info) return;
      [2, 3, 4].forEach(function (q) {
        if (n[id] >= q) Object.keys(info.bonus[q]).forEach(function (k) { b[k] = (b[k] || 0) + info.bonus[q][k]; });
      });
    });
    return b;
  }
  // Peça de armadura nova de quem tem segunda classe vira peça do conjunto da faixa.
  function marcarConjunto(p, item) {
    if (item && TIPOS_ARMADURA.indexOf(item.tipo) >= 0 && item.nivel) {
      var id = conjuntoPara(p, item.nivel);
      if (id) item.conjunto = id;
    }
    return item;
  }

  // Pontos de habilidade que a arma equipada dá (além do limite de 10): { id da habilidade: n }.
  function pontosDaArma(p) {
    var a = armaEquipada(p), c = segundaClasse(p), r = {};
    if (!a || !c || !a.extras || !a.extras.hab) return r;
    var h = c.habilidades[a.extras.hab.i];
    if (h) r[h.id] = a.extras.hab.n;
    return r;
  }
  function precoDoNivel(nivel) { return Math.round(N_.precoBase * Math.pow(N_.precoCresce, Math.max(1, nivel) - 1)); }
  // Joia da masmorra (vem do servidor sem nível): ganha nível de drop e bônus sorteados.
  // ---------- Atividades (Herói > painel da esquerda) ----------
  // Soma o tempo do personagem no jogo e, se estiver caçando, também o tempo de caçada (em segundos).
  function registrarAtividade(p, segundos, cacando) {
    var a = p.atividade || (p.atividade = { logado: 0, cacando: 0 });
    var s = Number(segundos);
    if (!(s > 0)) return a;
    a.logado = (Number(a.logado) || 0) + s;
    if (cacando) a.cacando = (Number(a.cacando) || 0) + s;
    return a;
  }

  function completarItem(p, item, rng) {
    if (!item || item.nivel) return item;
    item.nivel = nivelDoDrop(p, rng);
    item.qualidade = sortearQualidade(item.raridade, rng);
    if (item.tipo === 'arma') item.dano = danoDoNivel(item.nivel, item.qualidade);
    else item.bonus = sortearBonus(item, rng || Math.random);
    return item;
  }
  // Faixa de um bônus (mín., máx.) pela variação de 80% a 120%.
  function faixaBonus(base) {
    var V = D.VARIACAO_ITEM.faixa;
    return base > 0 ? [Math.max(1, Math.round(base * V[0])), Math.max(1, Math.round(base * V[1]))] : [base, base];
  }
  // Bônus sorteados de uma armadura, joia ou item da mão esquerda (+ atributo extra da rara em diante).
  function sortearBonus(item, rng) {
    var def = definicao(item), idx = RARIDADES.indexOf(item.raridade), b = {};
    if (!def) return b;
    if (item.nivel) Object.keys(def.bonus).forEach(function (k) { b[k] = bonusDoNivel(def.bonus[k][1], item.nivel, item.qualidade); });
    else Object.keys(def.bonus).forEach(function (k) { b[k] = rolar(faixaBonus(def.bonus[k][idx]), rng); });
    var extra = D.VARIACAO_ITEM.extra[item.raridade];
    if (extra) {
      var k = ATRIBUTOS[Math.floor(rng() * ATRIBUTOS.length)];
      b[k] = (b[k] || 0) + rolar(extra, rng);
    }
    return b;
  }
  function novaArma(classe, raridade, rng, especifico) { return novoItem('arma', classe, raridade, rng, especifico); }

  // ---------- Tipos de arma e mão esquerda ----------
  // Armas antigas (sem `arma`) são o tipo padrão da classe (espada, arco, cajado, martelo).
  function tipoArmaId(item) { return item.arma || D.ARMA_PADRAO[item.classe] || 'espada'; }
  function tipoArma(item) { return D.TIPOS_ARMA[tipoArmaId(item)]; }
  var DA_BASE = { armas: {}, mao: {} };
  Object.keys(D.classes).forEach(function (k) {
    D.ARMAS_CLASSE[k].armas.forEach(function (a) { DA_BASE.armas[a] = true; });
    D.ARMAS_CLASSE[k].mao.forEach(function (a) { DA_BASE.mao[a] = true; });
  });
  // Tipo só das segundas classes: não existe na raridade comum.
  function soSegundaClasse(id, mao) { return !DA_BASE[mao ? 'mao' : 'armas'][id]; }
  function listaArmas(p) { var c2 = p.talentos && p.talentos.classe2; return D.ARMAS_CLASSE[c2 && D.ARMAS_CLASSE[c2] ? c2 : p.classe]; }
  function armasPermitidas(p) { return listaArmas(p).armas; }
  function maoPermitida(p) { return listaArmas(p).mao; }
  function sortearDaLista(lista, raridade, mao, rng) {
    var l = lista.filter(function (id) { return raridade !== 'comum' || !soSegundaClasse(id, mao); });
    return l.length ? l[Math.floor((rng || Math.random)() * l.length)] : null;
  }
  function sortearTipoArma(p, raridade, rng) { return sortearDaLista(armasPermitidas(p), raridade, false, rng) || D.ARMA_PADRAO[p.classe]; }
  function sortearMao(p, raridade, rng) { return sortearDaLista(maoPermitida(p), raridade, true, rng); }
  // Por que não dá para equipar (texto) ou null.
  function motivoNaoEquipa(p, item) {
    if (!item) return 'Item não encontrado.';
    if (item.tipo === 'arma' && !podeUsar(p, item)) return 'Sua classe não usa ' + tipoArma(item).nome + '.';
    if (item.tipo === 'secundaria') {
      if (!podeUsar(p, item)) return 'Sua classe não usa ' + D.MAO_ESQUERDA[item.mao].nome + ' na mão esquerda.';
      var arma = armaEquipada(p), ta = arma && tipoArma(arma);
      if (ta && ta.duasMaos) return ta.nome + ' ocupa as duas mãos.';
      if (ta && (ta.proibe || []).indexOf(item.mao) >= 0) return D.MAO_ESQUERDA[item.mao].nome + ' não combina com ' + ta.nome + '.';
    }
    if (!podeUsar(p, item)) return 'Esse item não é da sua classe.';
    return null;
  }

  // Definição de armadura/joia nos dados (null para arma).
  function definicao(item) {
    if (item.tipo === 'arma') return null;
    if (item.tipo === 'secundaria') return D.MAO_ESQUERDA[item.mao] || null;
    if (TIPOS_JOIA.indexOf(item.tipo) >= 0) return D.joias[item.tipo];
    return D.armaduras[item.classe][item.tipo];
  }

  function nomeArma(item) {
    var sufixo = item.variacao === undefined ? D.raridades[item.raridade].nome : D.SUFIXOS_ARMA[item.raridade][item.variacao];
    var cj = item.conjunto && infoConjunto(item.conjunto);
    var base = cj ? definicao(item).tipo + ' ' + cj.nome
      : item.tipo === 'secundaria' ? D.MAO_ESQUERDA[item.mao].nome + ' ' + sufixo
      : item.tipo !== 'arma' ? definicao(item).nomes[RARIDADES.indexOf(item.raridade)]
      : tipoArmaId(item) !== D.ARMA_PADRAO[item.classe] ? tipoArma(item).nome + ' ' + sufixo
      : item.variacao === undefined ? D.armas[item.classe].tipo + ' ' + D.raridades[item.raridade].nome   // modelo do mercado
      : D.armas[item.classe][item.raridade][item.variacao];
    return (item.encanto ? '+' + item.encanto + ' ' : '') + base;
  }

  // Bônus de uma armadura/joia, já com o encantamento ({ defesa: 5, vida: 25, ... }).
  function bonusItem(item) {
    var def = definicao(item), b = {};
    var idx = RARIDADES.indexOf(item.raridade);
    if (item.tipo === 'arma') {
      if (item.extras) {   // armas por nível: atributos sorteados da faixa
        Object.keys(item.extras.atributos || {}).forEach(function (k) { b[k] = item.extras.atributos[k]; });
        return b;
      }
      var n = D.RARIDADE_ARMA.atributo[idx], c = D.classes[item.classe];   // armas antigas: rara ou melhor, + atributo
      if (n && c) b[c.atributoDano] = n;
      return b;
    }
    if (!def) return b;
    if (item.bonus) Object.keys(item.bonus).forEach(function (k) { b[k] = item.bonus[k]; });   // sorteados ao cair
    else Object.keys(def.bonus).forEach(function (k) { b[k] = def.bonus[k][idx]; });          // itens antigos: valor fixo
    if (item.encanto) {
      var k = item.tipo === 'secundaria' ? def.encanto : D.encantamento.bonusPorNivel[item.tipo];
      b[k] = (b[k] || 0) + item.encanto;
    }
    return b;
  }

  // Multiplicador do dano do encanto pelo nível da arma (1 até o 20; +5% por nível acima, 3x no 60).
  function multEncanto(item) {
    var E = D.encantamento, n = item && item.nivel;
    if (!n || n <= E.forteDesde) return 1;
    return 1 + (n - E.forteDesde) * E.fortePorNivel / 100;
  }

  // Dano da arma já somando o bônus de encantamento.
  // Sem `dano` (modelo do mercado): mostra a faixa possível inteira.
  function danoArmaComEncanto(item) {
    var r = D.raridades[item.raridade];
    var base = item.dano || [r.danoMin[0], r.danoMax[1]];
    var extra = (item.encanto || 0) * D.encantamento.danoPorNivel[item.raridade] * multEncanto(item);
    var f = item.tipo === 'arma' ? tipoArma(item).fator : 1;   // armas lentas e de duas mãos batem mais forte
    return [Math.round((base[0] + extra) * f), Math.round((base[1] + extra) * f)];
  }

  function precoVenda(item) {
    var enc = 1 + (item.encanto || 0) * D.encantamento.vendaPorNivel;
    if (item.nivel) return Math.max(1, Math.round(precoDoNivel(item.nivel) * N_.vendaPct / 100 * (N_.vendaRaridade[item.raridade] || 1) * enc));
    return Math.round(D.raridades[item.raridade].venda * enc);
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

  function podeUsar(p, item) {
    if (item.tipo === 'arma') return armasPermitidas(p).indexOf(tipoArmaId(item)) >= 0;
    if (item.tipo === 'secundaria') return maoPermitida(p).indexOf(item.mao) >= 0;
    return item.classe === null || item.classe === p.classe;
  }

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
    var b = bonusEquipamentos(p), a = {}, pas = passiva(p), extra = pas ? pas.def.atributos || {} : {}, cj = bonusConjuntos(p);
    ATRIBUTOS.forEach(function (k) { a[k] = p.atributos[k] + b[k] + (extra[k] || 0) + (cj[k] || 0); });
    return a;
  }

  // ---------- Habilidades e segunda classe ----------
  var T = D.TALENTOS;
  function talentos(p) {
    var t = p.talentos || (p.talentos = {});
    if (t.classe2 === undefined) t.classe2 = null;
    if (!t.pontos) t.pontos = {};
    if (!t.ordem) t.ordem = { cacada: [], masmorra: [], arena: [], defesa: [] };
    if (!t.ordem.defesa) t.ordem.defesa = (t.ordem.arena || []).slice();   // personagens de antes: copia a da Arena
    return t;
  }
  function segundaClasse(p) { var t = p.talentos; return t && t.classe2 ? D.SEGUNDAS_CLASSES[t.classe2] : null; }
  function opcoesSegundaClasse(classe) {
    return Object.keys(D.SEGUNDAS_CLASSES).filter(function (k) { return D.SEGUNDAS_CLASSES[k].de === classe; });
  }
  function pontosHabilidadeTotal(p) {
    return p.nivel >= T.nivelSegunda ? T.pontosIniciais + (p.nivel - T.nivelSegunda) * T.pontosPorNivel : 0;
  }
  function pontosHabilidadeLivres(p) {
    var t = talentos(p), gastos = 0;
    Object.keys(t.pontos).forEach(function (k) { gastos += t.pontos[k] || 0; });
    return pontosHabilidadeTotal(p) - gastos;
  }
  // Pontos numa habilidade: os distribuídos + os da arma equipada (que passam do limite de 10).
  function pontosEm(p, id) { return ((p.talentos && p.talentos.pontos[id]) || 0) + (pontosDaArma(p)[id] || 0); }
  function pontosDistribuidos(p, id) { return (p.talentos && p.talentos.pontos[id]) || 0; }
  // A passiva da segunda classe (precisa de 1 ponto).
  function passiva(p) {
    var c = segundaClasse(p);
    if (!c) return null;
    var def = c.habilidades.filter(function (h) { return h.tipo === 'passiva'; })[0], pts = pontosEm(p, def.id);
    return pts > 0 ? { def: def, pts: pts } : null;
  }
  // Valor de um campo em % de um reforço/cura/passiva com N pontos.
  function valorBonus(def, campo, pts) { return def[campo] !== undefined ? def[campo] + pts * T.bonusPorPonto : 0; }
  // Multiplicador (%) de dano de uma habilidade de golpe.
  function multHabilidade(def, pts) {
    var tab = def.tipo === 'atordoar' ? T.atordoar : def.tipo === 'multiplo' ? T.multiplo : def.tipo === 'area' ? (def.reduzido ? T.areaReduzida : T.area)
      : def.tipo === 'unico' ? (def.reduzido ? T.unicoReduzido : T.unico) : null;
    if (!tab) return 0;
    return def.inicial ? tab.base : tab.base + tab.porPonto * pts;
  }
  // Escolhe a segunda classe (level 10+, uma vez; o Pergaminho das Habilidades libera de novo).
  function escolherSegundaClasse(p, id) {
    var c = D.SEGUNDAS_CLASSES[id], t = talentos(p);
    if (p.nivel < T.nivelSegunda) return 'Só a partir do level ' + T.nivelSegunda + '.';
    if (!c || c.de !== p.classe) return 'Classe inválida.';
    if (t.classe2) return 'Você já escolheu a segunda classe.';
    var hpAntes = status(p).hpMax;
    t.classe2 = id;
    t.pontos = {};
    var ativas = c.habilidades.filter(function (h) { return h.tipo !== 'passiva'; }).map(function (h) { return h.id; });
    t.ordem = { cacada: ativas.slice(), masmorra: ativas.slice(), arena: ativas.slice(), defesa: ativas.slice() };
    ajustarVida(p, hpAntes);
    return true;
  }
  // Põe (+1) ou tira (-1) um ponto. Retorna true ou o motivo.
  function mudarPontoHabilidade(p, id, delta) {
    var c = segundaClasse(p), t = talentos(p);
    if (!c || !c.habilidades.some(function (h) { return h.id === id; })) return 'Escolha a segunda classe primeiro.';
    // (o limite de 10 vale só para os pontos distribuídos; a arma soma por fora)
    var atual = t.pontos[id] || 0, novo = atual + delta;
    if (novo < 0) return false;
    if (novo > T.maxPorHabilidade) return 'Máximo de ' + T.maxPorHabilidade + ' pontos por habilidade.';
    if (delta > 0 && pontosHabilidadeLivres(p) < delta) return 'Sem pontos livres.';
    var hpAntes = status(p).hpMax;
    if (novo) t.pontos[id] = novo; else delete t.pontos[id];
    ajustarVida(p, hpAntes);
    return true;
  }
  // Ordem de uso: move uma habilidade para cima/baixo, tira ou põe de volta (modo: cacada, masmorra, arena, defesa).
  // arena = quando o herói ataca na Arena; defesa = quando ele é desafiado (o servidor luta por ele).
  function moverHabilidade(p, modo, id, acao) {
    var t = talentos(p), c = segundaClasse(p), lista = t.ordem[modo];
    if (!c || !lista) return false;
    var i = lista.indexOf(id);
    if (acao === 'tirar') { if (i >= 0) lista.splice(i, 1); return true; }
    if (acao === 'por') { if (i < 0 && c.habilidades.some(function (h) { return h.id === id && h.tipo !== 'passiva'; })) lista.push(id); return true; }
    var j = acao === 'subir' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) return false;
    lista[i] = lista[j]; lista[j] = id;
    return true;
  }
  // Habilidades ativas na ordem do modo, só as que têm ponto. Antes da segunda classe: a habilidade inicial.
  function kitHabilidades(p, modo) {
    var c = segundaClasse(p);
    if (!c) {
      var ini = D.HABILIDADE_INICIAL[p.classe];
      return ini ? [{ def: Object.assign({ inicial: true }, ini), pts: 0 }] : [];
    }
    return (talentos(p).ordem[modo] || []).map(function (id) {
      var def = c.habilidades.filter(function (h) { return h.id === id; })[0];
      return def && def.tipo !== 'passiva' && pontosEm(p, id) > 0 ? { def: def, pts: pontosEm(p, id) } : null;
    }).filter(Boolean);
  }
  // Pergaminho das Habilidades: devolve os pontos e deixa escolher a segunda classe de novo.
  function comprarRecomecoHabilidades(p) {
    var preco = D.RECOMECO_HABILIDADES.precoOuro;
    if ((p.ouro || 0) < preco) return 'Ouro insuficiente.';
    p.ouro -= preco;
    p.recomecosHab = (p.recomecosHab || 0) + 1;
    return true;
  }
  function usarRecomecoHabilidades(p) {
    if (!p.recomecosHab) return 'Você não tem ' + D.RECOMECO_HABILIDADES.nome + '.';
    var hpAntes = status(p).hpMax;
    p.recomecosHab -= 1;
    p.talentos = { classe2: null, pontos: {}, ordem: { cacada: [], masmorra: [], arena: [], defesa: [] } };
    ajustarVida(p, hpAntes);
    p.hpAtual = Math.min(p.hpAtual, status(p).hpMax);
    return true;
  }

  // --- Na luta: estado de um lutador (herói) com as habilidades ---
  function novoLutador(p, modo) {
    return { kit: kitHabilidades(p, modo), turno: 0, pronto: {}, buffs: [], furtivo: false, critEm: -1, provocaAte: -1, vidaExtra: 0 };
  }
  function somaBuff(L, campo) {
    var t = 0;
    if (L) L.buffs.forEach(function (x) { if (x.ate >= L.turno) t += x[campo] || 0; });
    return t;
  }
  // Começo da vez do herói: conta o turno e tira os reforços que acabaram. h: { hp, hpMax, vel, velBase }.
  function inicioVez(L, h) {
    L.turno++;
    L.buffs = L.buffs.filter(function (x) {
      if (x.ate >= L.turno) return true;
      if (x.vidaExtra) { h.hpMax -= x.vidaExtra; h.hp = Math.min(h.hp, h.hpMax); }
      return false;
    });
    if (L.mudaVel) h.vel = Math.max(1, Math.round(h.velBase * (1 + somaBuff(L, 'velocidade') / 100)));
  }
  // A 1ª habilidade pronta da ordem. ctx.grupoFerido: alguém do grupo abaixo do limite (para a cura em grupo).
  function escolherHabilidade(L, ctx) {
    for (var i = 0; i < L.kit.length; i++) {
      var k = L.kit[i];
      if ((L.pronto[k.def.id] || 0) > L.turno) continue;
      if (k.def.tipo === 'cura' && ctx.grupo && !ctx.grupoFerido) continue;
      return k;
    }
    return null;
  }
  function gastarHabilidade(L, k) { L.pronto[k.def.id] = L.turno + (k.def.recarga || 1); }
  function ehReforco(def) { return def.tipo === 'reforco' || def.tipo === 'furtivo' || def.tipo === 'provocar'; }
  // Aplica um reforço no próprio herói (e no grupo, se for de grupo: alvos = [{ L, h }]).
  function aplicarReforco(k, dono, alvos) {
    var def = k.def, pts = k.pts;
    if (def.tipo === 'furtivo') {
      dono.L.furtivo = true;
      dono.L.critEm = dono.L.turno + 1;
      dono.L.buffs.push({ ate: dono.L.turno + 1, danoCritico: valorBonus(def, 'danoCritico', pts) });
      return;
    }
    if (def.tipo === 'provocar') {
      dono.L.provocaAte = dono.L.turno + def.turnos - 1;
      dono.L.buffs.push({ ate: dono.L.turno + def.turnos - 1, defesaPct: valorBonus(def, 'defesaPct', pts) });
      return;
    }
    (def.grupo ? alvos : [dono]).forEach(function (a) {
      var b = { ate: a.L.turno + def.turnos - (a === dono ? 1 : 0) };
      ['dano', 'danoCritico', 'critico', 'velocidade', 'precisao'].forEach(function (c) { if (def[c]) b[c] = valorBonus(def, c, pts); });
      if (def.vidaPct && a.h.hp > 0) {
        b.vidaExtra = Math.round(a.h.hpMax * valorBonus(def, 'vidaPct', pts) / 100);
        a.h.hpMax += b.vidaExtra; a.h.hp += b.vidaExtra;
      }
      a.L.buffs.push(b);
      if (b.velocidade) { a.L.mudaVel = true; a.h.vel = Math.max(1, Math.round(a.h.velBase * (1 + somaBuff(a.L, 'velocidade') / 100))); }
    });
  }
  // Um golpe de herói contra um alvo (monstro). opcoes: mult (%), sempreAcerta, ignoraDefesa.
  function calcularGolpe(s, L, alvo, opcoes, rng) {
    var magico = s.tipoDano === 'magico', g = { acerto: false, critico: false, dano: 0 };
    if (!opcoes.sempreAcerta && rng() * 100 >= limitar(s.precisao + somaBuff(L, 'precisao') - alvo.indiceArea * 3, 5, 95)) return g;
    var defesa = opcoes.ignoraDefesa ? 0 : (magico ? alvo.defesaMagica : alvo.defesa);
    var dano = rolar(s.dano, rng) * (opcoes.mult || 100) / 100 * (1 + somaBuff(L, 'dano') / 100) * (1 + (s.danoPvE || 0) / 100);
    dano = Math.max(1, Math.round(dano * 100 / (100 + defesa)));
    var chance = (magico ? s.chanceCriticoMagico : s.chanceCritico) + (opcoes.bonusCritico || 0) + somaBuff(L, 'critico');
    var garantido = L && L.critEm === L.turno;
    if (garantido || rng() * 100 < chance) {
      g.critico = true;
      dano = Math.floor(dano * ((magico ? s.danoCriticoMagico : s.danoCritico) + somaBuff(L, 'danoCritico')) / 100);
    }
    if (garantido) L.critEm = -1;
    g.acerto = true; g.dano = dano;
    return g;
  }
  // Defesa do herói com os reforços (ex.: Grito de Desafio).
  function defesaHeroi(s, L) { return Math.round(s.defesa * (1 + somaBuff(L, 'defesaPct') / 100)); }

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
    // Atributos rebalanceados (3 pontos = +1 de dano, Destreza para o Caçador): quem já tinha level ganha
    // 1 Pergaminho do Recomeço de presente, uma vez só (1 = ainda não avisou o jogador; 2 = avisado).
    if (!p.recomecoPresente) {
      if (p.nivel > 1) p.recomecos = (p.recomecos || 0) + 1;
      p.recomecoPresente = p.nivel > 1 ? 1 : 2;
    }
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
    if (!('secundaria' in p.equipados)) p.equipados.secundaria = null;   // espaço novo: mão esquerda
    // Itens de antes do nível: viram do nível atual do herói (os status continuam os mesmos).
    p.inventario.forEach(function (i) { if (!i.nivel) i.nivel = Math.max(1, Math.min(D.ITEM_NIVEL.maximo, p.nivel || 1)); });
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
    var ta = arma ? tipoArma(arma) : null, idxArma = arma ? RARIDADES.indexOf(arma.raridade) : 0;
    // +1 de dano a cada 3 pontos do atributo de dano da classe (Força, Destreza ou Inteligência).
    var bonus = Math.floor(a[D.classes[p.classe].atributoDano || (magico ? 'int' : 'for')] / D.PONTOS_POR_DANO);
    return comConjunto(comPassiva({
      hpMax: D.HP_INICIAL
        + Math.max(0, a.res - p.atributosIniciais.res) * D.HP_POR_RES
        + (p.nivel - 1) * D.HP_POR_NIVEL
        + eq.vida,
      tipoDano: magico ? 'magico' : 'fisico',
      danoArma: danoArma,
      ataque: magico ? 0 : bonus,                    // FOR (Cavaleiro/Artesão) ou DES (Caçador)
      ataqueMagico: magico ? bonus : 0,              // INT (Mago)
      dano: danoComMao([danoArma[0] + bonus + (eq.dano || 0), danoArma[1] + bonus + (eq.dano || 0)], magico ? eq.danoMagico : 0),
      defesa: Math.floor(a.res / 10) + eq.defesa,              // RES + armaduras
      defesaMagica: Math.floor(a.res / 10) + eq.defesaMagica,  // RES + armaduras
      precisao: 75 + a.des + (eq.precisao || 0),     // DES (%) + aljava
      evasao: a.des * 0.5,                           // DES (%)
      // 15 no level 1, +6% por level (não depende da DES), vezes a velocidade da arma (devagar 0,8 / rápida 1,2)
      velocidade: Math.max(1, Math.round(velocidadeDoNivel(p.nivel) * (ta ? D.VELOCIDADE_ARMA[ta.vel] : 1))),
      chanceCritico: (a.sor + a.des) * 0.5 + (eq.critico || 0),   // SOR e DES (%) + mão esquerda
      danoCritico: 150 + a.for,                      // FOR (% do dano)
      chanceCriticoMagico: a.sor + (eq.critico || 0),   // SOR (1% por ponto)
      danoCriticoMagico: 150 + a.sor + (eq.danoCriticoMagico || 0),   // SOR (% do dano) + orbe
      chanceCraft: a.sor,                            // SOR (%)
      bonusDrop: a.sor,                              // SOR (% a mais sobre a chance base)
      chanceEncantamento: a.sor,                     // 1% por ponto de SOR
      bonusRecompensa: 0,                            // % a mais de ouro e exp (passiva do Coletor)
      // % a mais contra monstros / na Arena: extras da arma por nível; armas antigas pela raridade (épica/lendária)
      danoPvE: !arma ? 0 : arma.extras ? arma.extras.pve || 0 : D.RARIDADE_ARMA.pve[idxArma],
      danoPvP: !arma ? 0 : arma.extras ? arma.extras.pvp || 0 : D.RARIDADE_ARMA.pvp[idxArma],
    }, p), p);
  }
  // Bônus de conjunto (2/3/4 peças): somados depois da passiva.
  function comConjunto(s, p) {
    var b = bonusConjuntos(p);
    if (b.defesa) { s.defesa += b.defesa; s.defesaMagica += b.defesa; }
    if (b.vida) s.hpMax += b.vida;
    if (b.dano) s.dano = [s.dano[0] + b.dano, s.dano[1] + b.dano];
    if (b.velocidade) s.velocidade += b.velocidade;
    if (b.critico) s.chanceCritico += b.critico;
    if (b.evasao) s.evasao += b.evasao;
    if (b.criticoMagico) s.chanceCriticoMagico += b.criticoMagico;
    return s;
  }
  // Dano mágico % da mão esquerda (orbe, livro), só para quem bate com magia.
  function danoComMao(d, pct) { return pct ? [Math.round(d[0] * (1 + pct / 100)), Math.round(d[1] * (1 + pct / 100))] : d; }
  // Passiva da segunda classe: % a mais em vida, defesa, dano, crítico, esquiva e recompensas.
  function comPassiva(s, p) {
    var pas = passiva(p);
    if (!pas) return s;
    var d = pas.def, n = pas.pts, v = function (c) { return valorBonus(d, c, n); };
    if (d.vidaPct) s.hpMax = Math.round(s.hpMax * (1 + v('vidaPct') / 100));
    if (d.defesaPct) { s.defesa = Math.round(s.defesa * (1 + v('defesaPct') / 100)); s.defesaMagica = Math.round(s.defesaMagica * (1 + v('defesaPct') / 100)); }
    if (d.dano) s.dano = [Math.round(s.dano[0] * (1 + v('dano') / 100)), Math.round(s.dano[1] * (1 + v('dano') / 100))];
    if (d.evasao) s.evasao += v('evasao');
    if (d.critico) s.chanceCritico += v('critico');
    if (d.danoCritico) s.danoCritico += v('danoCritico');
    if (d.danoCriticoMagico) s.danoCriticoMagico += v('danoCriticoMagico');
    if (d.recompensa) s.bonusRecompensa = v('recompensa');
    return s;
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
    return raridade ? novoItem('arma', p.classe, raridade, rng, sortearTipoArma(p, raridade, rng), nivelDoDrop(p, rng)) : null;
  }

  // Item de qualquer tipo das caçadas: arma, uma das 4 armaduras da classe ou item da mão esquerda.
  var TODOS_TIPOS = ['arma'].concat(TIPOS_ARMADURA, ['secundaria']);
  // Armadura ou mão esquerda (se a classe usar alguma); a arma sai com um tipo que o herói pode usar.
  function itemDoTipo(p, tipo, raridade, rng) {
    if (tipo === 'secundaria') {
      var m = sortearMao(p, raridade, rng);
      if (m) return novoItem('secundaria', null, raridade, rng, m, nivelDoDrop(p, rng));
      tipo = TIPOS_ARMADURA[Math.floor(rng() * TIPOS_ARMADURA.length)];
    }
    if (tipo === 'arma') return novoItem('arma', p.classe, raridade, rng, sortearTipoArma(p, raridade, rng), nivelDoDrop(p, rng));
    // 10% das armaduras de quem tem segunda classe vêm de conjunto, na raridade sorteada (comum a lendária).
    var deConjunto = conjuntoPara(p, 1) && rng() < D.CONJUNTO_CHANCE / 100;
    var item = novoItem(tipo, p.classe, raridade, rng, null, nivelDoDrop(p, rng));
    return deConjunto ? marcarConjunto(p, item) : item;
  }
  function itemQualquer(p, raridade, rng) {
    return itemDoTipo(p, TODOS_TIPOS[Math.floor(rng() * TODOS_TIPOS.length)], raridade, rng);
  }
  function rolarDropItem(p, monstroId, rng) {
    var raridade = rolarRaridade(p, D.monstros[monstroId].dropsItem || [], rng);
    return raridade ? itemQualquer(p, raridade, rng) : null;
  }

  // Peça sorteada entre as 4 armaduras da classe (colar e anel só nas masmorras).
  function rolarDropArmadura(p, monstroId, rng) {
    var raridade = rolarRaridade(p, D.monstros[monstroId].dropsArmadura || [], rng);
    if (!raridade) return null;
    var pecas = TIPOS_ARMADURA.concat(['secundaria']);
    return itemDoTipo(p, pecas[Math.floor(rng() * pecas.length)], raridade, rng);
  }

  // ---------- Áreas e chefes ----------

  function areaDoMonstro(monstroId) {
    var area = D.monstros[monstroId].area;
    return D.areas.find(function (a) { return a.id === area; });
  }
  function areaLiberada(p, area) { return p.nivel >= area.nivelMin; }

  // Monstros comuns de áreas liberadas podem ser caçados; chefes só aparecem sozinhos.
  // Ordem das caçadas: cada monstro só libera depois de derrotar o anterior
  // (o 1º de cada área pede o último monstro da área anterior).
  function monstroAnterior(monstroId) {
    var lista = [];
    D.areas.forEach(function (a) { a.monstros.forEach(function (m) { lista.push(m.id); }); });
    var i = lista.indexOf(monstroId);
    return i > 0 ? lista[i - 1] : null;
  }
  function monstroLiberado(p, monstroId) {
    var antes = monstroAnterior(monstroId);
    return !antes || (p.abates[antes] || 0) > 0;
  }
  function podeCacar(p, monstroId) {
    var m = D.monstros[monstroId];
    return !!m && !m.chefe && areaLiberada(p, areaDoMonstro(monstroId)) && monstroLiberado(p, monstroId);
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

  // Fugiu ou evitou o chefe: a chance dele aparecer na área volta a zero (igual a quando é derrotado).
  function evitarChefe(p, monstroId) {
    var m = D.monstros[monstroId], area = m && areaDoMonstro(monstroId);
    if (!m || !m.chefe || !area) return false;
    p.presencaChefe[area.id] = 0;
    return true;
  }

  // Drop do chefe. Com `dropItem`: chance de 1 item de qualquer tipo (pode não vir nada).
  // Sem: sempre 1 arma ou armadura, raridade pela tabela do chefe.
  function dropChefe(p, m, rng) {
    if (m.dropItem) {
      var r = rolarRaridade(p, m.dropItem, rng);
      return r ? itemQualquer(p, r, rng) : null;
    }
    var raridade = rolarRaridade(p, m.dropsChefe, rng) || m.dropPadrao;
    if (rng() < 0.5) return novoItem('arma', p.classe, raridade, rng, sortearTipoArma(p, raridade, rng), nivelDoDrop(p, rng));
    var pecas = TIPOS_ARMADURA.concat(['secundaria']);
    return itemDoTipo(p, pecas[Math.floor(rng() * pecas.length)], raridade, rng);
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
      jogador: { nome: p.nome, hp: p.hpAtual, hpMax: s.hpMax, vel: Math.max(1, s.velocidade), velBase: Math.max(1, s.velocidade), barra: 0, poder: 0 },
      lutador: novoLutador(p, 'cacada'),   // habilidades da caçada (ordem, recargas, reforços)
      chefe: !!m.chefe,
      // O monstro começa com a barra cheia: o primeiro golpe da luta é sempre dele.
      monstro: { nome: m.nome, hp: m.hp, hpMax: m.hp, vel: Math.max(1, m.velocidade), barra: 100,
        atordoado: 0, armaduraQuebrada: false },
      fim: null,
    };
  }

  // Um golpe do jogador. opcoes: mult, sempreAcerta, ignoraDefesa, bonusCritico (%).
  // Precisão menos 3% por área (Floresta 0%, Cume do Fogo -18%); a defesa do monstro reduz o dano em
  // porcentagem: 100 / (100 + defesa). opcoes.mult: multiplicador (1 = normal).
  function golpeJogador(b, opcoes) {
    var m = D.monstros[b.monstroId];
    var g = calcularGolpe(b.s, b.lutador, m, Object.assign({}, opcoes, { mult: (opcoes.mult || 1) * 100 }), b.rng);
    if (!g.acerto) return g;
    var dano = g.dano;
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
    // Sombra (Assassino): o próximo ataque erra.
    if (b.lutador && b.lutador.furtivo) { b.lutador.furtivo = false; ev.sombra = true; return ev; }
    // Acerto do monstro: 80% + 2% por área, menos a evasão do jogador.
    if (rng() * 100 >= limitar(80 + m.indiceArea * 2 - s.evasao, 5, 95)) return ev;
    var dano = Math.max(1, rolar(m.ataque, rng) - defesaHeroi(s, b.lutador));
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
        if (b.lutador) inicioVez(b.lutador, b.jogador);
        if (b.pocaoPendente) {
          b.pocaoPendente = false;
          b.pocoes -= 1;
          var curou = b.jogador.hpMax - b.jogador.hp;
          b.jogador.hp = b.jogador.hpMax;
          return { ator: 'jogador', pocao: true, cura: curou };
        }
        var cheia = b.jogador.poder >= D.PODER.maximo;
        if (D.HABILIDADES_ATIVAS && cheia && (b.habilidadePendente || b.auto)) return usarHabilidade(b);
        return b.lutador ? vezComHabilidades(b) : ataqueJogador(b);
      }
      if (b.monstro.barra >= 100) { b.monstro.barra -= 100; return ataqueMonstro(b); }
      b.jogador.barra += b.jogador.vel;
      b.monstro.barra += b.monstro.vel;
    }
  }

  // Vez do herói na caçada: usa a 1ª habilidade pronta da ordem (reforço + ataque, ou golpe da habilidade).
  function vezComHabilidades(b) {
    var L = b.lutador, k = escolherHabilidade(L, { grupo: false });
    if (!k) return ataqueJogador(b);
    var def = k.def, magico = b.s.tipoDano === 'magico';
    gastarHabilidade(L, k);
    if (ehReforco(def)) {
      aplicarReforco(k, { L: L, h: b.jogador }, null);
      var ev = ataqueJogador(b);
      ev.reforco = def.nome;
      return ev;
    }
    var hab = { ator: 'jogador', habilidade: def.nome, magico: magico, golpes: [], dano: 0 };
    if (def.tipo === 'cura') {
      // Na caçada a cura vira dano: % da vida máxima do herói, sempre acerta.
      var d = Math.max(1, Math.round(b.jogador.hpMax * valorBonus(def, 'vidaPct', k.pts) / 100));
      b.monstro.hp = Math.max(0, b.monstro.hp - d);
      if (b.monstro.hp === 0) b.fim = 'vitoria';
      hab.golpes.push({ acerto: true, critico: false, dano: d });
    } else if (def.tipo === 'multiplo') {
      // Double Shot: várias flechas no mesmo turno, cada uma pode errar ou ser crítica.
      for (var f = 0; f < (def.flechas || 2) && !b.fim; f++) hab.golpes.push(golpeJogador(b, { mult: multHabilidade(def, k.pts) / 100 }));
    } else {
      var g = golpeJogador(b, { mult: multHabilidade(def, k.pts) / 100 });
      hab.golpes.push(g);
      if (g.acerto && def.atordoa && !b.fim) {
        var t = b.chefe ? Math.min(def.atordoa, T.atordoarChefeMax) : def.atordoa;
        b.monstro.atordoado = Math.max(b.monstro.atordoado, t);
        hab.atordoou = t; hab.congelou = !!def.congela;
      }
    }
    hab.golpes.forEach(function (g) { hab.dano += g.dano; });
    hab.acerto = hab.golpes.some(function (g) { return g.acerto; });
    hab.critico = hab.golpes.some(function (g) { return g.critico; });
    return hab;
  }

  // Aplica o resultado no personagem. Derrota: fica com 0 de vida, perde 5% da exp do level
  // (sem descer de level) e só caça de novo quando a vida voltar com o tempo ou com poção.
  // `agora`: a vida com o tempo volta a contar a partir do fim da luta.
  // `bonus`: % a mais de exp e de ouro (bônus da aliança), ex.: { exp: 9, ouro: 9 }.
  function concluirBatalha(p, b, agora, bonus) {
    var res = { resultado: b.fim || 'fuga', exp: 0, ouro: 0, niveis: 0, drop: null };
    p.hpAtual = Math.min(b.jogador.hp, status(p).hpMax);   // a vida extra da Bênção acaba com a luta
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
      if (bonus && bonus.exp) res.exp = Math.floor(res.exp * (1 + bonus.exp / 100));
      if (bonus && bonus.ouro) res.ouro = Math.floor(res.ouro * (1 + bonus.ouro / 100));
      if (b.s.bonusRecompensa) {   // passiva do Coletor
        res.exp = Math.floor(res.exp * (1 + b.s.bonusRecompensa / 100));
        res.ouro = Math.floor(res.ouro * (1 + b.s.bonusRecompensa / 100));
      }
      p.ouro += res.ouro;
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
    } else if (!b.fim) {
      evitarChefe(p, b.monstroId);   // fugiu da luta contra o chefe
    } else if (b.fim === 'derrota') {
      p.hpAtual = 0;
      res.expPerdida = Math.min(p.exp, Math.ceil(expNecessaria(p.nivel) * D.PERDA_EXP_DERROTA / 100));
      if (p.nivel >= D.NIVEL_MAXIMO) res.expPerdida = 0;
      p.exp -= res.expPerdida;
    }
    return res;
  }

  // Vende qualquer item que não esteja equipado nem travado.
  function vender(p, itemId) {
    if (slotDoItem(p, itemId)) return false;
    var i = p.inventario.findIndex(function (x) { return x.id === itemId; });
    if (i < 0 || p.inventario[i].travado) return false;
    p.ouro += precoVenda(p.inventario[i]);
    p.inventario.splice(i, 1);
    return true;
  }

  // Compra no mercado: arma (tipo 'arma') ou armadura da classe. Colar e anel só nas masmorras.
  // Retorna o item, ou um texto com o motivo da falha.
  // especifico: tipo da arma (ex.: 'machado') ou do item da mão esquerda (ex.: 'escudo'); sem ele, o padrão da classe.
  // Mercado novo: comprar(p, tipo, especifico) — item do nível do herói ±3, comum ou raro, pelo preço do nível.
  // O jeito antigo comprar(p, raridade, tipo, especifico) ainda funciona (testes e admin).
  function comprar(p, raridade, tipo, especifico) {
    if (!D.raridades[raridade]) return comprarNoNivel(p, raridade, tipo);
    var r = D.raridades[raridade];
    tipo = tipo || 'arma';
    if (TIPOS_JOIA.indexOf(tipo) >= 0) return 'Colar e anel só nas masmorras.';
    if (!r || ['arma', 'secundaria'].concat(TIPOS_ARMADURA).indexOf(tipo) < 0) return 'Item inválido.';
    if (tipo === 'arma') especifico = especifico || D.ARMA_PADRAO[p.classe];
    if (tipo === 'arma' && armasPermitidas(p).indexOf(especifico) < 0) return 'Sua classe não usa essa arma.';
    if (tipo === 'secundaria' && maoPermitida(p).indexOf(especifico) < 0) return 'Sua classe não usa esse item.';
    if ((tipo === 'arma' || tipo === 'secundaria') && raridade === 'comum' && soSegundaClasse(especifico, tipo === 'secundaria')) return 'Esse item só existe a partir da raridade rara.';
    if (p.ouro < r.compra) return 'Ouro insuficiente.';
    if ((p.reputacao || 0) < (r.compraReputacao || 0)) return 'Reputação insuficiente.';
    if (mochilaCheia(p)) return 'Mochila cheia!';
    p.ouro -= r.compra;
    p.reputacao = (p.reputacao || 0) - (r.compraReputacao || 0);
    var item = novoItem(tipo, p.classe, raridade, null, especifico);
    p.inventario.push(item);
    return item;
  }

  function precoMercado(p) { return precoDoNivel(p.nivel); }
  function comprarNoNivel(p, tipo, especifico, rng) {
    rng = rng || Math.random;
    tipo = tipo || 'arma';
    if (TIPOS_JOIA.indexOf(tipo) >= 0) return 'Colar e anel só nas masmorras.';
    if (['arma', 'secundaria'].concat(TIPOS_ARMADURA).indexOf(tipo) < 0) return 'Item inválido.';
    var raridade = rng() < N_.mercadoRara ? 'rara' : 'comum';
    if (tipo === 'arma') especifico = especifico || D.ARMA_PADRAO[p.classe];
    if (tipo === 'arma' && armasPermitidas(p).indexOf(especifico) < 0) return 'Sua classe não usa essa arma.';
    if (tipo === 'secundaria' && maoPermitida(p).indexOf(especifico) < 0) return 'Sua classe não usa esse item.';
    // tipos da segunda classe não existem comuns: vem rara
    if ((tipo === 'arma' || tipo === 'secundaria') && soSegundaClasse(especifico, tipo === 'secundaria')) raridade = 'rara';
    var preco = precoMercado(p);
    if (p.ouro < preco) return 'Ouro insuficiente.';
    if (mochilaCheia(p)) return 'Mochila cheia!';
    p.ouro -= preco;
    var item = novoItem(tipo, p.classe, raridade, rng, especifico, nivelDoMercado(p, rng));
    p.inventario.push(item);
    return item;
  }

  // ---------- Mochila: força do item, ordenação, filtro, trava e venda em lote ----------
  // Tudo aqui só lê ou muda os dados; a tela decide como mostrar.

  // Força do item: arma = dano médio x10; armadura e joia = soma dos bônus com pesos.
  var PESO_BONUS = { defesa: 8, defesaMagica: 8, vida: 1, for: 6, des: 6, res: 6, int: 6, sor: 6, dano: 10, precisao: 4, critico: 6, danoMagico: 4, danoCriticoMagico: 2 };
  function forcaItem(item) {
    if (item.tipo === 'arma') { var d = danoArmaComEncanto(item); return Math.round((d[0] + d[1]) / 2 * 10); }
    var b = bonusItem(item), total = 0;
    Object.keys(b).forEach(function (k) { total += b[k] * (PESO_BONUS[k] || 1); });
    return Math.round(total);
  }

  // Critérios de ordem com desempate em cascata (o primeiro manda, os outros desempatam).
  var ORDEM_TIPOS = ['arma', 'secundaria'].concat(TIPOS_ARMADURA, TIPOS_JOIA);
  var CRITERIOS = {
    forca: ['forca', 'raridade', 'encanto'],
    raridade: ['raridade', 'forca', 'encanto'],
    encanto: ['encanto', 'forca', 'raridade'],
    tipo: ['tipo', 'raridade', 'forca'],
  };
  function chaveItem(item, k) {
    if (k === 'forca') return forcaItem(item);
    if (k === 'raridade') return RARIDADES.indexOf(item.raridade);
    if (k === 'encanto') return item.encanto || 0;
    return -ORDEM_TIPOS.indexOf(item.tipo);          // tipo: arma primeiro na ordem decrescente
  }
  // Devolve uma lista nova (não mexe na mochila). criterio 'mochila' = ordem atual.
  function ordenarItens(itens, criterio, crescente) {
    var lista = itens.slice(), chaves = CRITERIOS[criterio];
    if (!chaves) return lista;
    var sinal = crescente ? 1 : -1;
    return lista.sort(function (a, b) {
      for (var i = 0; i < chaves.length; i++) {
        var d = chaveItem(a, chaves[i]) - chaveItem(b, chaves[i]);
        if (d) return d * sinal;
      }
      return 0;
    });
  }
  // Filtro de visualização: { raridades: ['rara', ...] (vazio = todas), forcaMin: número }.
  function passaFiltro(item, filtro) {
    if (!filtro) return true;
    if (filtro.raridades && filtro.raridades.length && filtro.raridades.indexOf(item.raridade) < 0) return false;
    return forcaItem(item) >= (filtro.forcaMin || 0);
  }
  // "Organizar": grava a ordem do critério na mochila (os equipados não mudam).
  function organizarMochila(p, criterio, crescente) {
    var equipados = p.inventario.filter(function (i) { return slotDoItem(p, i.id); });
    p.inventario = equipados.concat(ordenarItens(mochila(p), criterio, crescente));
  }
  function travarItem(p, itemId) {
    var item = p.inventario.find(function (x) { return x.id === itemId; });
    if (!item) return false;
    item.travado = !item.travado;
    if (!item.travado) delete item.travado;
    return true;
  }
  function podeVender(p, item) { return !!item && !item.travado && !slotDoItem(p, item.id); }
  // Ids da mochila até uma raridade (ex.: 'rara' = comuns e raras), sem travados e sem peças de conjunto.
  function idsAteRaridade(p, raridade) {
    var limite = RARIDADES.indexOf(raridade);
    return mochila(p).filter(function (i) { return podeVender(p, i) && !i.conjunto && RARIDADES.indexOf(i.raridade) <= limite; })
      .map(function (i) { return i.id; });
  }
  function valorVenda(p, ids) {
    return ids.reduce(function (t, id) {
      var item = p.inventario.find(function (x) { return x.id === id; });
      return t + (podeVender(p, item) ? precoVenda(item) : 0);
    }, 0);
  }
  // Vende de uma vez; travados e equipados ficam. Retorna { vendidos, ouro }.
  function venderVarios(p, ids) {
    var ouro = 0, vendidos = 0;
    ids.forEach(function (id) {
      var item = p.inventario.find(function (x) { return x.id === id; });
      if (!podeVender(p, item)) return;
      ouro += precoVenda(item);
      vendidos++;
      p.inventario.splice(p.inventario.indexOf(item), 1);
    });
    p.ouro += ouro;
    return { vendidos: vendidos, ouro: ouro };
  }

  // ---------- Caçada contínua ----------
  // ---------- Caçada contínua ----------
  // Rastreio = Velocidade + Sorte. Evolução na região (0 a 1): quanto o rastreio passa da referência da região.
  function rastreio(p) { return status(p).velocidade + atributosTotais(p).sor; }
  function evolucaoCacada(p, areaId) {
    var C = D.CACADA, area = D.areas.filter(function (a) { return a.id === areaId; })[0];
    var base = velocidadeDoNivel(area ? area.nivelMin : 1) + C.sorteBase;
    return Math.max(0, Math.min(1, (rastreio(p) / base - 1) / C.faixaEvolucao));
  }
  // Posição do monstro na região: 0 = o mais fraco, 1 = o mais forte.
  function posicaoNaArea(id) {
    var m = D.monstros[id], area = D.areas.filter(function (a) { return a.id === m.area; })[0];
    if (!area || area.monstros.length < 2) return 0;
    var i = area.monstros.map(function (x) { return x.id; }).indexOf(id);
    return i < 0 ? 1 : i / (area.monstros.length - 1);
  }
  // Tempo procurando um monstro: o mais fraco é achado mais rápido; diminui com a evolução na região.
  function tempoBusca(p, id) {
    var C = D.CACADA, f = posicaoNaArea(id), ev = evolucaoCacada(p, D.monstros[id].area);
    var ini = C.tempoInicio[0] + f * (C.tempoInicio[1] - C.tempoInicio[0]);
    var fim = C.tempoFinal[0] + f * (C.tempoFinal[1] - C.tempoFinal[0]);
    return Math.round(ini - ev * (ini - fim));
  }
  // Chance (%) e tempo de cada monstro escolhido (só os liberados): o mais fraco aparece mais; com a evolução
  // na região (Velocidade + Sorte) a chance dos fortes sobe até todos ficarem iguais.
  function chancesCacada(p, ids) {
    var lista = ids.filter(function (id) { return podeCacar(p, id); });
    var pesos = lista.map(function (id) {
      return 1 + (1 - posicaoNaArea(id)) * D.CACADA.pesoFraco * (1 - evolucaoCacada(p, D.monstros[id].area));
    });
    var total = pesos.reduce(function (t, x) { return t + x; }, 0);
    return lista.map(function (id, i) { return { id: id, chance: pesos[i] * 100 / total, tempo: tempoBusca(p, id) }; })
      .sort(function (a, b) { return posicaoNaArea(a.id) - posicaoNaArea(b.id); });
  }
  function escolherMonstroCacada(p, ids, rng) {
    var lista = chancesCacada(p, ids);
    if (!lista.length) return null;
    var r = (rng || Math.random)() * 100;
    for (var i = 0; i < lista.length; i++) { r -= lista[i].chance; if (r < 0) return lista[i].id; }
    return lista[lista.length - 1].id;
  }
  // Para caçar é preciso ter mais que 5% da vida.
  function vidaParaCacar(p) { return p.hpAtual > status(p).hpMax * D.CACADA.vidaMinima / 100; }
  // Poção automática na luta: abaixo do limite (% da vida), se ainda houver poção.
  function precisaPocao(b, limite) {
    return !!limite && !b.fim && b.pocoes > 0 && !b.pocaoPendente && b.jogador.hp > 0 && b.jogador.hp * 100 / b.jogador.hpMax < limite;
  }

  // ---------- Missões diárias e semanais ----------
  // A semana começa na segunda-feira, 00:00 de Brasília.
  function semanaReset(agora) {
    var local = new Date(agora + D.VIDA.fusoReset * 3600000);
    var diaSemana = (local.getUTCDay() + 6) % 7;            // segunda = 0
    return new Date(local.getTime() - diaSemana * 86400000).toISOString().slice(0, 10);
  }
  function msAteSemana(agora) {
    var local = new Date(agora + D.VIDA.fusoReset * 3600000);
    return ((7 - (local.getUTCDay() + 6) % 7) - 1) * 86400000 + msAteReset(agora);
  }
  function garantirMissoes(p, agora) {
    var dia = diaReset(agora), semana = semanaReset(agora);
    var m = p.missoes || (p.missoes = { dia: null, semana: null, d: {}, s: {}, dOk: {}, sOk: {}, bonus: false, runs: [] });
    if (m.dia !== dia) { m.dia = dia; m.d = {}; m.dOk = {}; m.bonus = false; }
    if (m.semana !== semana) { m.semana = semana; m.s = {}; m.sOk = {}; }
    if (!m.runs) m.runs = [];
    return m;
  }
  // Conta progresso: evento 'abate', 'chefe', 'encantar', 'encantoSucesso', 'arena', 'arenaVitoria' ou 'masmorra'.
  function registrarMissao(p, evento, qtd, agora) {
    var m = garantirMissoes(p, agora);
    [['diarias', 'd', 'dOk'], ['semanais', 's', 'sOk']].forEach(function (t) {
      D.MISSOES[t[0]].forEach(function (x) {
        if (x.evento === evento && !m[t[2]][x.id]) m[t[1]][x.id] = Math.min(x.meta, (m[t[1]][x.id] || 0) + (qtd || 1));
      });
    });
  }
  function premioTexto(p, pr) {
    var partes = [];
    if (pr.ouroPorNivel) partes.push((pr.ouroPorNivel * p.nivel).toLocaleString('pt-BR') + ' de ouro');
    if (pr.reputacao) partes.push(pr.reputacao + ' de reputação');
    if (pr.pergaminhoArma) {
      var arma = armaEquipada(p), r = arma ? arma.raridade : 'comum';
      partes.push(pr.pergaminhoArma + ' pergaminho' + (pr.pergaminhoArma > 1 ? 's' : '') + ' ' + D.raridades[r].nome.toLowerCase());
    }
    return partes.join(' + ');
  }
  function darPremio(p, pr) {
    if (pr.ouroPorNivel) p.ouro += pr.ouroPorNivel * p.nivel;
    if (pr.reputacao) p.reputacao = (p.reputacao || 0) + pr.reputacao;
    if (pr.pergaminhoArma) { var arma = armaEquipada(p); p.pergaminhos[arma ? arma.raridade : 'comum'] += pr.pergaminhoArma; }
  }
  // tipo 'diarias' ou 'semanais'. Retorna o texto do prêmio ou null.
  function resgatarMissao(p, tipo, id, agora) {
    var m = garantirMissoes(p, agora), chave = tipo === 'diarias' ? 'd' : 's', ok = chave + 'Ok';
    var x = D.MISSOES[tipo].find(function (y) { return y.id === id; });
    if (!x || m[ok][id] || (m[chave][id] || 0) < x.meta) return null;
    var texto = premioTexto(p, x.premio);
    darPremio(p, x.premio);
    m[ok][id] = true;
    return texto;
  }
  function resgatarBonusDiario(p, agora) {
    var m = garantirMissoes(p, agora);
    if (m.bonus || D.MISSOES.diarias.some(function (x) { return !m.dOk[x.id]; })) return null;
    var texto = premioTexto(p, D.MISSOES.bonusDiario);
    darPremio(p, D.MISSOES.bonusDiario);
    m.bonus = true;
    return texto;
  }
  // Quantas missões (e o bônus) estão prontas para resgatar.
  function missoesProntas(p, agora) {
    var m = garantirMissoes(p, agora), n = 0;
    D.MISSOES.diarias.forEach(function (x) { if (!m.dOk[x.id] && (m.d[x.id] || 0) >= x.meta) n++; });
    D.MISSOES.semanais.forEach(function (x) { if (!m.sOk[x.id] && (m.s[x.id] || 0) >= x.meta) n++; });
    if (!m.bonus && D.MISSOES.diarias.every(function (x) { return m.dOk[x.id]; })) n++;
    return n;
  }

  // ---------- Encantamento ----------

  // Raridade pela tabela de qualidade da caçada (70% comum, 22% rara, 7% épica, 1% lendária).
  function sortearRaridadeDrop(rng) {
    var tabela = D.DROPS_CACADA.qualidade, total = 0;
    tabela.forEach(function (q) { total += q.chance; });
    var r = rng() * total;
    for (var i = 0; i < tabela.length; i++) { r -= tabela[i].chance; if (r < 0) return tabela[i].raridade; }
    return tabela[tabela.length - 1].raridade;
  }

  // Pergaminho dropado: raridade pela qualidade da caçada, fixa do monstro ou a da arma equipada. Sorte aumenta a chance.
  function rolarPergaminho(p, monstroId, rng) {
    var perg = D.monstros[monstroId].pergaminho;
    if (!perg || !perg.chance) return null;
    if (rng() * 100 >= perg.chance * (1 + status(p).bonusDrop / 100)) return null;
    if (perg.qualidade) return sortearRaridadeDrop(rng);
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
      return { nome: p.nome, classe: p.classe, classe2: p.talentos && p.talentos.classe2 || null, raca: p.raca, sexo: p.sexo, s: s, hp: s.hpMax, hpMax: s.hpMax, vel: Math.max(1, s.velocidade),
        velBase: Math.max(1, s.velocidade), barra: 0, L: novoLutador(p, 'masmorra') };
    });
    var salas = salasMasmorra(masmorraId);
    var inicio = {
      herois: hs.map(function (h) { return { nome: h.nome, classe: h.classe, classe2: h.classe2, raca: h.raca, sexo: h.sexo, hpMax: h.hpMax }; }),
      salas: salas.map(function (sala) { return sala.map(function (m) { return { id: m.id, nome: m.nome, hpMax: m.hp, elite: m.elite, chefe: m.chefe }; }); }),
    };
    var eventos = [];
    // Cada evento leva a vida de todos os heróis depois dele (cura, Bênção e golpes).
    function registrar(e) { e.hp = hs.map(function (x) { return x.hp; }); eventos.push(e); }
    function vivos(lista) { return lista.filter(function (x) { return x.hp > 0; }); }
    for (var si = 0; si < salas.length; si++) {
      if (si > 0) registrar({ tipo: 'sala', sala: si });
      var ms = salas[si].map(function (m) { return Object.assign({}, m, { hpMax: m.hp, vel: Math.max(1, m.velocidade), barra: 100, atordoado: 0 }); });
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
          var H = ator, L = H.L;
          inicioVez(L, H);
          var ferido = vivos(hs).some(function (x) { return x.hp * 100 / x.hpMax < T.curaSoAbaixo; });
          var k = escolherHabilidade(L, { grupo: true, grupoFerido: ferido });
          if (k) gastarHabilidade(L, k);
          if (k && ehReforco(k.def)) {
            aplicarReforco(k, { L: L, h: H }, vivos(hs).map(function (x) { return { L: x.L, h: x }; }));
            registrar({ tipo: 'hab', i: ev.i, nome: k.def.nome, reforco: true });
            k = null;   // reforço: ataca normalmente em seguida
          }
          if (k && k.def.tipo === 'cura') {
            var pct = valorBonus(k.def, 'vidaPct', k.pts);
            vivos(hs).forEach(function (x) { x.hp = Math.min(x.hpMax, x.hp + Math.round(x.hpMax * pct / 100)); });
            registrar({ tipo: 'hab', i: ev.i, nome: k.def.nome, cura: true });
            continue;
          }
          var alvos = !k ? [vivos(ms)[0]] : k.def.tipo === 'area' ? vivos(ms) : [vivos(ms)[0]];
          var mult = k ? multHabilidade(k.def, k.pts) : 100;
          if (k) registrar({ tipo: 'hab', i: ev.i, nome: k.def.nome });
          // Double Shot: as flechas seguintes vão no primeiro monstro vivo (o mesmo, ou o próximo se ele caiu).
          if (k && k.def.tipo === 'multiplo') {
            alvos = [];
            for (var fl = 0; fl < (k.def.flechas || 2); fl++) alvos.push(null);
          }
          alvos.forEach(function (alvo, n) {
            if (!alvo) alvo = vivos(ms)[0];
            if (!alvo) return;
            var e = n === 0 ? ev : { tipo: 'golpe', sala: si, de: 'h', i: ev.i, acerto: false, critico: false, dano: 0, caiu: false };
            e.alvo = ms.indexOf(alvo);
            var g = calcularGolpe(H.s, L, alvo, { mult: mult }, rng);
            if (g.acerto) {
              e.acerto = true; e.critico = g.critico; e.dano = g.dano;
              alvo.hp = Math.max(0, alvo.hp - g.dano);
              e.caiu = alvo.hp === 0;
              if (k && k.def.atordoa && alvo.hp > 0) {
                var t = alvo.chefe ? Math.min(k.def.atordoa, T.atordoarChefeMax) : k.def.atordoa;
                alvo.atordoado = Math.max(alvo.atordoado, t);
                e.atordoou = t; e.congelou = !!k.def.congela;
              }
            }
            registrar(e);
          });
          ev = null;
        } else {
          if (ator.atordoado > 0) { ator.atordoado -= 1; ev.atordoado = true; registrar(ev); continue; }
          // Grito de Desafio: os monstros atacam quem provocou.
          var lista = vivos(hs), provocador = lista.filter(function (x) { return x.L.provocaAte >= x.L.turno; })[0];
          var heroi = provocador || lista[Math.floor(rng() * lista.length)];
          ev.alvo = hs.indexOf(heroi);
          if (heroi.L.furtivo) { heroi.L.furtivo = false; ev.sombra = true; }
          else if (rng() * 100 < limitar(80 + ator.indiceArea * 2 - heroi.s.evasao, 5, 95)) {
            var d = Math.max(1, rolar(ator.ataque, rng) - defesaHeroi(heroi.s, heroi.L));
            ev.acerto = true; ev.dano = d;
            heroi.hp = Math.max(0, heroi.hp - d);
            ev.caiu = heroi.hp === 0;
          }
        }
        if (ev) registrar(ev);
      }
      if (!vivos(hs).length) return { vitoria: false, sala: si, inicio: inicio, eventos: eventos };
    }
    return { vitoria: true, sala: salas.length - 1, inicio: inicio, eventos: eventos };
  }

  // ---------- Skins do dado ----------
  // Pergaminho do Recomeço: compra com ouro e usa para redistribuir os atributos.
  // Retornam true ou um texto com o motivo.
  function comprarRecomeco(p) {
    var preco = D.RECOMECO.precoOuro;
    if ((p.ouro || 0) < preco) return 'Ouro insuficiente.';
    p.ouro -= preco;
    p.recomecos = (p.recomecos || 0) + 1;
    return true;
  }
  function usarRecomeco(p) {
    if (!p.recomecos) return 'Você não tem ' + D.RECOMECO.nome + '.';
    p.recomecos -= 1;
    admin.resetarAtributos(p);
    return true;
  }

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
        var item = novoItem('arma', p.classe, k, null, null, p.nivel);
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
        p.inventario.push(marcarConjunto(p, novoItem(tipo, p.classe, raridade, null, null, p.nivel)));
      });
      var m = sortearDaLista(maoPermitida(p), raridade, true, function () { return 0; });
      if (m) p.inventario.push(novoItem('secundaria', null, raridade, null, m, p.nivel));
    },
  };

  // Cura tudo (admin).
  function descansar(p, agora) { p.hpAtual = status(p).hpMax; p.vidaEm = agora || Date.now(); }

  // Equipa no espaço certo; se já houver item lá, ele volta para a mochila.
  // Anel vai para o primeiro espaço de anel livre (ou troca o primeiro).
  function equipar(p, itemId) {
    var item = itemPorId(p, itemId);
    if (!item || motivoNaoEquipa(p, item) || slotDoItem(p, itemId)) return false;
    var slot = item.tipo;
    if (item.tipo === 'anel') slot = !p.equipados.anel1 ? 'anel1' : !p.equipados.anel2 ? 'anel2' : 'anel1';
    // Arma de duas mãos (ou que não combina com o item da mão esquerda): a mão esquerda volta para a mochila.
    var mao = item.tipo === 'arma' && itemNoSlot(p, 'secundaria'), ta = item.tipo === 'arma' && tipoArma(item);
    var tiraMao = mao && (ta.duasMaos || (ta.proibe || []).indexOf(mao.mao) >= 0);
    if (tiraMao && mochilaCheia(p)) return false;
    var hpAntes = status(p).hpMax;
    if (tiraMao) p.equipados.secundaria = null;
    p.equipados[slot] = itemId;
    ajustarVida(p, hpAntes);
    return slot;
  }

  // O item da mochila deixaria o personagem mais forte (mais poder) se fosse equipado no lugar do atual?
  // Anel: compara com os dois espaços de anel. Item de outra classe nunca é "melhor".
  function itemMelhor(p, item) {
    if (!item || motivoNaoEquipa(p, item) || slotDoItem(p, item.id)) return false;
    var slots = item.tipo === 'anel' ? ['anel1', 'anel2'] : [item.tipo];
    if (!(slots[0] in p.equipados)) return false;
    if (slots.some(function (slot) { return !p.equipados[slot]; })) return true;   // espaço vazio: qualquer peça ajuda
    var base = poder(p);
    return slots.some(function (slot) {
      var q = Object.assign({}, p, { equipados: Object.assign({}, p.equipados) });
      q.equipados[slot] = item.id;
      return poder(q) > base;
    });
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
    multEncanto: multEncanto,
    precoVenda: precoVenda,
    forcaItem: forcaItem,
    ordenarItens: ordenarItens,
    passaFiltro: passaFiltro,
    organizarMochila: organizarMochila,
    travarItem: travarItem,
    podeVender: podeVender,
    idsAteRaridade: idsAteRaridade,
    valorVenda: valorVenda,
    venderVarios: venderVarios,
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
    itemMelhor: itemMelhor,
    tipoArmaId: tipoArmaId,
    tipoArma: tipoArma,
    armasPermitidas: armasPermitidas,
    maoPermitida: maoPermitida,
    soSegundaClasse: soSegundaClasse,
    faixaBonus: faixaBonus,
    infoConjunto: infoConjunto,
    contarConjuntos: contarConjuntos,
    bonusConjuntos: bonusConjuntos,
    conjuntoPara: conjuntoPara,
    pontosDaArma: pontosDaArma,
    pontosDistribuidos: pontosDistribuidos,
    sortearExtrasArma: sortearExtrasArma,
    nivelDoDrop: nivelDoDrop,
    nivelDoMercado: nivelDoMercado,
    danoDoNivel: danoDoNivel,
    bonusDoNivel: bonusDoNivel,
    precoDoNivel: precoDoNivel,
    precoMercado: precoMercado,
    completarItem: completarItem,
    registrarAtividade: registrarAtividade,
    novoItem: novoItem,
    motivoNaoEquipa: motivoNaoEquipa,
    talentos: talentos,
    segundaClasse: segundaClasse,
    opcoesSegundaClasse: opcoesSegundaClasse,
    pontosHabilidadeTotal: pontosHabilidadeTotal,
    pontosHabilidadeLivres: pontosHabilidadeLivres,
    pontosEm: pontosEm,
    passiva: passiva,
    valorBonus: valorBonus,
    multHabilidade: multHabilidade,
    escolherSegundaClasse: escolherSegundaClasse,
    mudarPontoHabilidade: mudarPontoHabilidade,
    moverHabilidade: moverHabilidade,
    kitHabilidades: kitHabilidades,
    comprarRecomecoHabilidades: comprarRecomecoHabilidades,
    usarRecomecoHabilidades: usarRecomecoHabilidades,
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
    rolarPergaminho: rolarPergaminho,
    sortearRaridadeDrop: sortearRaridadeDrop,
    novaArma: novaArma,
    velocidadeDoNivel: velocidadeDoNivel,
    nivelHabilidade: nivelHabilidade,
    prepararHabilidade: prepararHabilidade,
    areaDoMonstro: areaDoMonstro,
    areaLiberada: areaLiberada,
    podeCacar: podeCacar,
    tempoBusca: tempoBusca,
    rastreio: rastreio,
    evolucaoCacada: evolucaoCacada,
    chancesCacada: chancesCacada,
    escolherMonstroCacada: escolherMonstroCacada,
    vidaParaCacar: vidaParaCacar,
    precisaPocao: precisaPocao,
    monstroAnterior: monstroAnterior,
    monstroLiberado: monstroLiberado,
    semanaReset: semanaReset,
    msAteSemana: msAteSemana,
    garantirMissoes: garantirMissoes,
    registrarMissao: registrarMissao,
    premioTexto: premioTexto,
    resgatarMissao: resgatarMissao,
    resgatarBonusDiario: resgatarBonusDiario,
    missoesProntas: missoesProntas,
    sortearChefe: sortearChefe,
    evitarChefe: evitarChefe,
    skinsDoPersonagem: skinsDoPersonagem,
    comprarSkin: comprarSkin,
    comprarRecomeco: comprarRecomeco,
    usarRecomeco: usarRecomeco,
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
