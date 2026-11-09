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
    var v = D.EXP_BASE * 16;   // level 5
    for (var n = 6; n <= nivel; n++) {
      var f = D.EXP_FAIXAS.filter(function (x) { return n <= x.ate; })[0];
      v *= f ? f.crescimento : D.EXP_CRESCIMENTO;
    }
    return Math.round(v);
  }

  var RARIDADES = Object.keys(D.raridades);         // comum, rara, epica, lendaria
  var TIPOS_ARMADURA = ['elmo', 'peitoral', 'luvas', 'botas'];
  var TIPOS_JOIA = ['colar', 'anel'];

  // Item: { id, tipo, classe, raridade, encanto }. Joias têm classe null (servem para todos).
  // Arma e armadura também têm `variacao` (qual dos 8 nomes) e `dano` [mín, máx], sorteados nas faixas da raridade.
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
    // Armaduras novas também sorteiam 1 dos 8 finais das armas (ex.: "Elmo do Capitão"); as antigas mantêm o nome.
    if (TIPOS_ARMADURA.indexOf(tipo) >= 0) item.variacao = Math.floor(rng() * D.SUFIXOS_ARMA[raridade].length);
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
  // Qualidade (0 a 1) → força: cada raridade tem a sua faixa em multRaridade (comum 0,7–0,8 ... lendária 1,5–1,6).
  function multQualidade(q) {
    var ks = Object.keys(N_.faixaQualidade), k = ks[ks.length - 1];
    for (var i = 0; i < ks.length; i++) if (q < N_.faixaQualidade[ks[i]][1]) { k = ks[i]; break; }
    var f = N_.faixaQualidade[k], m = N_.multRaridade[k], t = f[1] > f[0] ? Math.min(1, Math.max(0, (q - f[0]) / (f[1] - f[0]))) : 0.5;
    return m[0] + (m[1] - m[0]) * t;
  }
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
  // Anel: dano (fração do dano de uma arma do mesmo nível), defesa mágica, atributos sorteados, regeneração e vida (ANEL).
  function sortearBonusAnel(item, rng) {
    var A = D.ANEL, idx = RARIDADES.indexOf(item.raridade), n = item.nivel || 1, b = {};
    var q = item.qualidade != null ? item.qualidade : sortearQualidade(item.raridade, rng);
    var tem = function (k) { return idx >= RARIDADES.indexOf(A.desde[k]); };
    b.dano = Math.max(1, Math.round((N_.danoPorNivel * n + N_.danoBase) * multQualidade(q) * A.danoPctArma / 100));
    if (tem('defesaMagica')) b.defesaMagica = bonusDoNivel(A.defesaMagica, n, q);
    if (tem('vida')) b.vida = bonusDoNivel(A.vida, n, q);
    if (tem('atributos')) {
      var livres = ATRIBUTOS.slice(), extra = D.VARIACAO_ITEM.extra[item.raridade];
      for (var i = 0; i < (A.atributos[item.raridade] || 0); i++) {
        var k = livres.splice(Math.floor(rng() * livres.length), 1)[0];
        b[k] = rolar(extra, rng);
      }
    }
    if (tem('regen')) b.regen = A.regen;
    return b;
  }
  // Anel antigo (dava Sorte): ganha os bônus novos da raridade e do nível dele.
  function anelAntigo(item) { return item.tipo === 'anel' && !(item.bonus && item.bonus.dano); }
  function sortearBonus(item, rng) {
    var def = definicao(item), idx = RARIDADES.indexOf(item.raridade), b = {};
    if (!def) return b;
    if (item.tipo === 'anel') return sortearBonusAnel(item, rng);
    // bônus em `fixos` (mão esquerda em %) valem pela raridade e não crescem com o nível do item
    if (item.nivel) Object.keys(def.bonus).forEach(function (k) {
      b[k] = (def.fixos || []).indexOf(k) >= 0 ? def.bonus[k][idx] : bonusDoNivel(def.bonus[k][1], item.nivel, item.qualidade);
    });
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
    var base = item.nome ? item.nome   // nome próprio (ex.: presente do Guia)
      : cj ? definicao(item).tipo + ' ' + cj.nome
      : item.tipo === 'secundaria' ? D.MAO_ESQUERDA[item.mao].nome + ' ' + sufixo
      : TIPOS_ARMADURA.indexOf(item.tipo) >= 0 && item.variacao !== undefined ? definicao(item).tipo + ' ' + sufixo
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
    else Object.keys(def.bonus).forEach(function (k) { if (def.bonus[k][idx]) b[k] = def.bonus[k][idx]; });   // itens antigos: valor fixo
    if (item.encanto) {
      var k = item.tipo === 'secundaria' ? def.encanto : D.encantamento.bonusPorNivel[item.tipo];
      b[k] = bonusComEncanto(b[k] || 0, item.encanto);
      if (k !== 'defesa' && k !== 'defesaMagica') b[k] = Math.round(b[k]);   // a defesa arredonda depois do fator
    }
    // Defesa em porcentagem: a defesa dos itens vale x DEFESA.fator (4,5), inclusive nos itens já salvos.
    if (b.defesa) b.defesa = Math.round(b.defesa * D.DEFESA.fator);
    if (b.defesaMagica) b.defesaMagica = Math.round(b.defesaMagica * D.DEFESA.fator);
    return b;
  }
  // Dano que o herói recebe depois da defesa: x 100 / (100 + defesa), nunca menos que 1.
  function danoComDefesa(dano, defesa) { return Math.max(1, Math.round(dano * D.DEFESA.k / (D.DEFESA.k + Math.max(0, defesa)))); }
  // % de dano que a defesa corta (para mostrar).
  function cortePct(defesa) { return Math.round(100 - D.DEFESA.k * 100 / (D.DEFESA.k + Math.max(0, defesa))); }

  // Encanto: cada + dá +5% (pctPorNivel) do próprio item.
  function multEncanto(item) { return 1 + ((item && item.encanto) || 0) * D.encantamento.pctPorNivel / 100; }
  // Bônus principal de armadura/joia/mão esquerda com o encanto: +5% por nível (sem arredondar aqui), igual à arma.
  // Assim comum +6 ≈ rara +0, rara +6 ≈ épica +0 e épica +6 ≈ lendária +0 (o "mínimo +1 por nível" antigo
  // deixava um item +6 de raridade baixa muito acima do +0 da raridade seguinte).
  function bonusComEncanto(valor, encanto) {
    return valor * (1 + encanto * D.encantamento.pctPorNivel / 100);
  }

  // Dano da arma já com o encanto (+5% por nível) e o fator do tipo da arma.
  // Sem `dano` (modelo do mercado): mostra a faixa possível inteira.
  function danoArmaComEncanto(item, semFator) {
    var r = D.raridades[item.raridade];
    var base = item.dano || [r.danoMin[0], r.danoMax[1]];
    var m = multEncanto(item);
    var f = item.tipo === 'arma' && !semFator ? tipoArma(item).fator : 1;   // armas lentas e de duas mãos batem mais forte
    return semFator ? [base[0] * m, base[1] * m] : [Math.round(base[0] * m * f), Math.round(base[1] * m * f)];
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
    // Habilidades do level 20/30 (nov/2026): entram uma vez no começo da ordem de todos os modos (valem em todo lugar).
    if (t.classe2 && !t.ordemNiveis2 && D.SEGUNDAS_CLASSES[t.classe2]) {
      D.SEGUNDAS_CLASSES[t.classe2].habilidades.forEach(function (h) {
        if (!h.nivel || h.tipo === 'passiva') return;
        Object.keys(t.ordem).forEach(function (m) { if (t.ordem[m].indexOf(h.id) < 0) t.ordem[m].unshift(h.id); });
      });
      t.ordemNiveis2 = true;
    }
    return t;
  }
  function segundaClasse(p) { var t = p.talentos; return t && t.classe2 ? D.SEGUNDAS_CLASSES[t.classe2] : null; }
  function opcoesSegundaClasse(classe) {
    return Object.keys(D.SEGUNDAS_CLASSES).filter(function (k) { return D.SEGUNDAS_CLASSES[k].de === classe; });
  }
  function pontosHabilidadeTotal(p) {
    if (p.nivel < T.nivelSegunda) return 0;
    var dp = T.pontosDepois, ate = dp ? Math.min(p.nivel, dp.nivel) : p.nivel;
    return T.pontosIniciais + (ate - T.nivelSegunda) * T.pontosPorNivel + (dp ? Math.max(0, p.nivel - dp.nivel) * dp.porNivel : 0);
  }
  // Habilidades do level 20 (foco: caçada) e do level 30 (foco: Arena); valem em todo lugar. Sem `nivel`: as de sempre.
  function habLiberada(p, def) { return !def.nivel || (p.nivel || 1) >= def.nivel; }
  // Campo [base, por ponto] das habilidades novas (ou número fixo).
  function valorNivel(v, pts) { return Array.isArray(v) ? Math.round((v[0] + v[1] * pts) * 100) / 100 : (v || 0); }
  // Passivas do level 20/30 somadas: regenPct, rouboVida, reducaoDano, danoExtraPct, curaEmergencia, limiar, milagrePct.
  function extrasNivel(p) {
    var c = segundaClasse(p), x = {};
    if (!c) return x;
    c.habilidades.forEach(function (h) {
      if (h.tipo !== 'passiva' || !h.nivel || !habLiberada(p, h)) return;
      var n = pontosEm(p, h.id);
      if (n <= 0) return;
      ['regenPct', 'rouboVida', 'reducaoDano', 'danoExtraPct', 'curaEmergencia', 'milagrePct'].forEach(function (k) { if (h[k]) x[k] = (x[k] || 0) + valorNivel(h[k], n); });
      if (h.limiar) x.limiar = h.limiar;
    });
    return x;
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
    var def = c.habilidades.filter(function (h) { return h.tipo === 'passiva' && !h.nivel; })[0], pts = pontosEm(p, def.id);
    return pts > 0 ? { def: def, pts: pts } : null;
  }
  // Valor de um campo em % de um reforço/cura/passiva com N pontos.
  function valorBonus(def, campo, pts) { return def[campo] !== undefined ? def[campo] + pts * T.bonusPorPonto : 0; }
  // Multiplicador (%) de dano de uma habilidade de golpe.
  function multHabilidade(def, pts) {
    if (Array.isArray(def.mult)) return valorNivel(def.mult, pts);   // golpes do level 30
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
    // as do level 20/30 vêm primeiro (veneno e escudo não gastam a vez; as da Arena têm recarga longa)
    var ativas = c.habilidades.filter(function (h) { return h.tipo !== 'passiva' && h.nivel; })
      .concat(c.habilidades.filter(function (h) { return h.tipo !== 'passiva' && !h.nivel; }));
    var ids = ativas.map(function (h) { return h.id; });
    t.ordem = { cacada: ids.slice(), masmorra: ids.slice(), arena: ids.slice(), defesa: ids.slice() };
    t.ordemNiveis2 = true;
    ajustarVida(p, hpAntes);
    return true;
  }
  // Põe (+1) ou tira (-1) um ponto. Retorna true ou o motivo.
  function mudarPontoHabilidade(p, id, delta) {
    var c = segundaClasse(p), t = talentos(p);
    if (!c || !c.habilidades.some(function (h) { return h.id === id; })) return 'Escolha a segunda classe primeiro.';
    var hd = c.habilidades.filter(function (h) { return h.id === id; })[0];
    if (delta > 0 && !habLiberada(p, hd)) return 'Libera no level ' + hd.nivel + '.';
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
      return def && def.tipo !== 'passiva' && habLiberada(p, def) && pontosEm(p, id) > 0 ? { def: def, pts: pontosEm(p, id) } : null;
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
    return { kit: kitHabilidades(p, modo), turno: 0, pronto: {}, buffs: [], furtivo: false, critEm: -1, provocaAte: -1, vidaExtra: 0,
      ex: extrasNivel(p), milagreUsado: false, dot: null, escudo: 0, escudoAte: -1, congelaChance: 0, bolsoUsado: false };
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
    if (L.ex && L.ex.regenPct && h.hp > 0) h.hp = Math.min(h.hpMax, h.hp + Math.max(1, Math.round(h.hpMax * L.ex.regenPct / 100)));
  }
  // ----- Level 20 contra monstros: veneno/sangramento, escudo, roubo de vida, menos dano e Bolso de Poções -----
  // Veneno no começo da vez do herói. alvoAtual(): o monstro da vez (o veneno que pula vai para ele se o alvo caiu).
  // Retorna { alvo, dano, caiu } ou null.
  function tickDot(L, h, alvoAtual) {
    var d = L.dot;
    if (!d || d.turnos <= 0) return null;
    if (!d.alvo || d.alvo.hp <= 0) { if (d.alvo && !d.pula) { L.dot = null; return null; } d.alvo = alvoAtual(); }
    if (!d.alvo) return null;
    var dano = Math.max(1, Math.round(d.dano));
    d.alvo.hp = Math.max(0, d.alvo.hp - dano);
    d.turnos--;
    if (d.cura && h.hp > 0) h.hp = Math.min(h.hpMax, h.hp + Math.round(dano * d.cura / 100));
    var caiu = d.alvo.hp === 0;
    if (caiu && d.curaMorte && h.hp > 0) h.hp = Math.min(h.hpMax, h.hp + Math.round(h.hpMax * d.curaMorte / 100));
    return { alvo: d.alvo, dano: dano, caiu: caiu, nome: d.nome };
  }
  // Opções de golpe dos golpes do level 30 contra monstros (h: { hp, hpMax } do herói).
  function opcoesNivel(def, h, alvo) {
    var o = {};
    if (def.ignoraDefesaPct) o.ignoraDefesaPct = def.ignoraDefesaPct;
    if (def.garantido) o.critGarantido = true;
    var f = 1;
    if (def.vidaFaltando && h) f *= 1 + def.vidaFaltando * (100 - h.hp * 100 / h.hpMax) / 100;
    if (def.executa && alvo && alvo.hp * 100 < (alvo.hpMax || alvo.hp) * def.executa.abaixo) f *= 1 + def.executa.bonus / 100;
    if (f !== 1) o.fator = f;
    return o;
  }
  // Depois de acertar um golpe do level 30: quebra a defesa e queima (dano médio do herói x pct, no começo da vez do monstro).
  function depoisDoGolpeNivel(def, alvo, s) {
    if (!def || !alvo || alvo.hp <= 0) return;
    if (def.quebraDefesaPct) alvo.defQuebra = Math.max(alvo.defQuebra || 0, def.quebraDefesaPct);
    if (def.queima) alvo.queima = { turnos: def.queima.turnos, dano: Math.max(1, Math.round((s.dano[0] + s.dano[1]) / 2 * def.queima.pct / 100)) };
  }
  // Queimadura no começo da vez do monstro. Retorna o dano (0 se não queimou).
  function tickQueima(m) {
    if (!m.queima || m.queima.turnos <= 0 || m.hp <= 0) return 0;
    var d = Math.min(m.hp, m.queima.dano);
    m.hp -= d; m.queima.turnos--;
    return d;
  }
  // Dano causado pelo herói num monstro: roubo de vida.
  function aoCausar(L, h, dano) {
    if (L && L.ex && L.ex.rouboVida && dano > 0 && h.hp > 0) h.hp = Math.min(h.hpMax, h.hp + Math.round(dano * L.ex.rouboVida / 100));
  }
  // Dano que o herói vai receber de um monstro: menos dano (Têmpera) e o escudo (que pode congelar quem bate).
  function aoReceber(L, dano, atacante, rng) {
    if (!L || dano <= 0) return dano;
    // Pó nos Olhos (level 30): o monstro cego erra com erroPct% de chance.
    if (atacante && atacante.cego > 0) { atacante.cego--; if (rng() * 100 < (atacante.cegoPct || 0)) { L.errouCego = true; return 0; } }
    if (L.ex && L.ex.reducaoDano) dano = Math.max(1, Math.round(dano * (1 - L.ex.reducaoDano / 100)));
    if (L.escudo > 0 && L.turno <= L.escudoAte) {
      var a = Math.min(L.escudo, dano);
      L.escudo -= a; dano -= a;
      if (atacante && L.congelaChance && rng() * 100 < L.congelaChance) atacante.atordoado = Math.max(atacante.atordoado || 0, 1);
    }
    // Defesa Suprema (level 30): devolve parte do dano para quem bateu.
    var rf = somaBuff(L, 'reflete');
    if (atacante && rf && dano > 0 && atacante.hp > 0) atacante.hp = Math.max(0, atacante.hp - Math.round(dano * rf / 100));
    return dano;
  }
  // Depois de levar dano: Bolso de Poções (uma vez por luta, abaixo do limiar).
  function depoisDeReceber(L, h) {
    var x = L && L.ex;
    // Milagre (level 30): uma vez por luta, quem cai volta.
    if (x && x.milagrePct && h.hp <= 0 && !L.milagreUsado) { L.milagreUsado = true; h.hp = Math.max(1, Math.round(h.hpMax * x.milagrePct / 100)); return 'milagre'; }
    if (!x || !x.curaEmergencia || L.bolsoUsado || h.hp <= 0 || h.hp * 100 >= h.hpMax * (x.limiar || 40)) return false;
    L.bolsoUsado = true;
    h.hp = Math.min(h.hpMax, h.hp + Math.round(h.hpMax * x.curaEmergencia / 100));
    return true;
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
  function ehReforco(def) { return def.tipo === 'reforco' || def.tipo === 'furtivo' || def.tipo === 'provocar' || def.tipo === 'dot' || def.tipo === 'escudo' || def.tipo === 'cegar'; }
  // Aplica um reforço no próprio herói (e no grupo, se for de grupo: alvos = [{ L, h }]).
  function aplicarReforco(k, dono, alvos) {
    var def = k.def, pts = k.pts;
    // Veneno/sangramento: marca o alvo do próximo golpe (o dano por turno é % do dano médio do herói, sem defesa).
    if (def.tipo === 'dot') {
      var md = dono.s ? (dono.s.dano[0] + dono.s.dano[1]) / 2 : 0;
      dono.L.dot = { nome: def.nome, alvo: dono.alvo || null, dano: md * valorNivel(def.dotPct, pts) / 100, turnos: def.turnos || 3,
        cura: def.curaDot || 0, curaMorte: def.curaMorte || 0, pula: !!def.pula };
      return;
    }
    if (def.tipo === 'cegar') {
      if (dono.alvo) { dono.alvo.cego = def.turnos || 2; dono.alvo.cegoPct = def.erroPct || 0; }
      return;
    }
    if (def.tipo === 'escudo') {
      dono.L.escudo = Math.round(dono.h.hpMax * valorNivel(def.escudoPct, pts) / 100);
      dono.L.escudoAte = dono.L.turno + (def.turnos || 3) - 1;
      dono.L.congelaChance = def.congelaChance || 0;
      return;
    }
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
    // Reforço de grupo sozinho (caçada: sem `alvos`) vale só para o próprio herói.
    (def.grupo && alvos ? alvos : [dono]).forEach(function (a) {
      var b = { ate: a.L.turno + def.turnos - (a === dono ? 1 : 0) };
      ['dano', 'danoCritico', 'critico', 'velocidade', 'precisao'].forEach(function (c) { if (def[c]) b[c] = valorBonus(def, c, pts); });
      if (Array.isArray(def.defesaPct)) b.defesaPct = valorNivel(def.defesaPct, pts);   // Defesa Suprema (level 30)
      if (def.reflete) b.reflete = def.reflete;
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
    // Contra monstros (caçada e masmorra) o herói acerta pelo menos 95% (errar é coisa da Arena, que tem regra própria no servidor).
    if (!opcoes.sempreAcerta && rng() * 100 >= limitar(s.precisao + somaBuff(L, 'precisao') - alvo.indiceArea * 3, D.ACERTO_PVE_MINIMO, 100)) return g;
    var defesa = opcoes.ignoraDefesa ? 0 : (magico ? alvo.defesaMagica : alvo.defesa);
    var dano = rolar(s.dano, rng) * (opcoes.mult || 100) / 100 * (1 + somaBuff(L, 'dano') / 100) * (1 + (s.danoPvE || 0) / 100) * (1 + (L && L.ex && L.ex.danoExtraPct || 0) / 100) * (opcoes.fator || 1);
    // level 30: a defesa quebrada (Martelo das Correntes) e o golpe que ignora parte dela (Tiro Silenciador)
    defesa = defesa * (1 - (alvo.defQuebra || 0) / 100) * (1 - (opcoes.ignoraDefesaPct || 0) / 100);
    dano = Math.max(1, Math.round(dano * 100 / (100 + defesa)));
    var chance = (magico ? s.chanceCriticoMagico : s.chanceCritico) + (opcoes.bonusCritico || 0) + somaBuff(L, 'critico');
    var garantido = (L && L.critEm === L.turno) || opcoes.critGarantido;
    if (garantido || rng() * 100 < chance) {
      g.critico = true;
      dano = Math.floor(dano * ((magico ? s.danoCriticoMagico : s.danoCritico) + somaBuff(L, 'danoCritico')) / 100);
    }
    if (garantido && L && L.critEm === L.turno) L.critEm = -1;
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

  // ---------- Consumíveis (pergaminhos e, no futuro, cristais e outros) ----------
  // Ficam em p.consumiveis como itens empilhados: { id, tipo, raridade, qtd }. Personagens antigos tinham só o contador
  // p.pergaminhos { comum, rara, epica, lendaria }: ele vira item aqui (e some), inclusive se um jogo antigo gravar de novo.
  function consumiveis(p) {
    if (!Array.isArray(p.consumiveis)) p.consumiveis = [];
    if (p.pergaminhos && typeof p.pergaminhos === 'object') {
      var velho = p.pergaminhos;
      delete p.pergaminhos;
      Object.keys(velho).forEach(function (r) { if (velho[r] > 0) mudarConsumivel(p, 'pergaminho', r, velho[r]); });
    }
    return p.consumiveis;
  }
  function pilhaConsumivel(p, tipo, raridade) {
    return consumiveis(p).filter(function (c) { return c.tipo === tipo && c.raridade === raridade; })[0] || null;
  }
  function qtdConsumivel(p, tipo, raridade) {
    var c = pilhaConsumivel(p, tipo, raridade);
    return c ? c.qtd : 0;
  }
  // Soma (ou tira, com delta negativo) da pilha. Nunca fica negativo; pilha zerada some. Retorna a quantidade nova.
  function mudarConsumivel(p, tipo, raridade, delta) {
    var lista = consumiveis(p), c = pilhaConsumivel(p, tipo, raridade);
    var novo = Math.max(0, (c ? c.qtd : 0) + Math.round(delta || 0));
    if (!c && novo > 0) {
      c = { id: tipo + '-' + raridade, tipo: tipo, raridade: raridade, qtd: 0 };
      lista.push(c);
      // ordem fixa: tipo, depois raridade
      var ordemTipo = Object.keys(D.CONSUMIVEIS);
      lista.sort(function (a, b) {
        return (ordemTipo.indexOf(a.tipo) - ordemTipo.indexOf(b.tipo)) || (RARIDADES.indexOf(a.raridade) - RARIDADES.indexOf(b.raridade));
      });
    }
    if (c) c.qtd = novo;
    if (c && novo === 0) lista.splice(lista.indexOf(c), 1);
    return novo;
  }
  function qtdPergaminho(p, raridade) { return qtdConsumivel(p, 'pergaminho', raridade); }
  function mudarPergaminho(p, raridade, delta) { return mudarConsumivel(p, 'pergaminho', raridade, delta); }
  // { comum, rara, epica, lendaria } com a quantidade de pergaminhos (só leitura).
  function pergaminhos(p) {
    var r = {};
    RARIDADES.forEach(function (k) { r[k] = qtdPergaminho(p, k); });
    return r;
  }
  var RARIDADE_M = { comum: 'Comum', rara: 'Raro', epica: 'Épico', lendaria: 'Lendário' };
  function nomeConsumivel(c) {
    var def = D.CONSUMIVEIS[c.tipo];
    if (c.tipo === 'material') return (D.CRAFT.materiais[c.raridade] || {}).nome || c.raridade;
    if (c.tipo === 'receita') { var ar = D.areas.filter(function (a) { return a.id === c.raridade; })[0]; return 'Receita: ' + (ar ? ar.nome : c.raridade); }
    var MF = { comum: 'Comum', rara: 'Rara', epica: 'Épica', lendaria: 'Lendária' };   // nomes femininos (Proteção)
    return (def ? def.nome : c.tipo) + ' ' + ((c.tipo === 'protecao' ? MF : RARIDADE_M)[c.raridade] || '');
  }

  // ---------- Craft dos Anões (D.CRAFT; Daniel, nov/2026) ----------
  function classe2(p) { return p.talentos && p.talentos.classe2 || null; }
  function ehColetor(p) { return classe2(p) === 'coletor'; }
  function ehFerreiro(p) { return classe2(p) === 'ferreiro'; }
  function materialDaArea(areaId) {
    return Object.keys(D.CRAFT.materiais).filter(function (k) { return D.CRAFT.materiais[k].area === areaId; })[0] || null;
  }
  function materialDoChefe(chefeId) {
    return Object.keys(D.CRAFT.materiais).filter(function (k) { return D.CRAFT.materiais[k].chefe === chefeId; })[0] || null;
  }
  function qtdMaterial(p, id) { return qtdConsumivel(p, 'material', id); }
  // Material que cai do monstro (ou null): o chefe sempre deixa 1 do material dele; os outros, a chance pela posição.
  function rolarMaterial(p, monstroId, rng) {
    var m = D.monstros[monstroId], area = areaDoMonstro(monstroId), C = D.CRAFT;
    if (!m || !area) return null;
    var extra = ehColetor(p) ? 1 + C.coletorBonus / 100 : 1;
    if (m.chefe) { var mc = materialDoChefe(monstroId); return mc && rng() * 100 < C.dropChefe * extra ? { id: mc, qtd: 1 } : null; }
    var pos = area.monstros.map(function (x) { return x.id; }).indexOf(monstroId);
    var id = materialDaArea(area.id);
    return id && rng() * 100 < (C.dropMaterial[pos] || 0) * extra ? { id: id, qtd: 1 } : null;
  }
  // Região mais alta liberada pelo level (as Minas mineram o material dela).
  function areaDasMinas(p) { return D.areas.filter(function (a) { return p.nivel >= a.nivelMin; }).pop() || D.areas[0]; }
  // Começa a mineração (opção = índice em CRAFT.minas.opcoes; areaId = região escolhida, já liberada pelo level;
  // sem região, a mais alta). p.minas = { inicio, fim, opcao, area }.
  function iniciarMinas(p, opcao, agora, areaId) {
    var o = D.CRAFT.minas.opcoes[opcao], a = areaId ? D.areas[indiceArea(areaId)] : areaDasMinas(p);
    if (!o) return 'Opção inválida.';
    if (!a || p.nivel < a.nivelMin) return 'Região ainda não liberada.';
    if (p.minas) return 'Você já está minerando.';
    // guarda a faixa de quantidade no começo (mudar a tabela depois não muda uma mineração em andamento)
    p.minas = { inicio: agora, fim: agora + o.minutos * 60000, opcao: opcao, area: a.id, minutos: o.minutos, qtd: o.qtd.slice() };
    return true;
  }
  // Ocupado minerando (não pode caçar nem lutar na Arena) até o tempo acabar.
  function minerando(p, agora) { return !!(p.minas && agora < p.minas.fim); }
  // Média esperada de uma opção numa região: { qtd, gemas } (com o bônus do Coletor).
  function mediaMinas(p, opcao) {
    var C = D.CRAFT, o = C.minas.opcoes[opcao];
    if (!o) return null;
    var q = (o.qtd[0] + o.qtd[1]) / 2 * (ehColetor(p) ? 1 + C.coletorBonus / 100 : 1);
    return { qtd: Math.round(q * (1 - C.minas.gemaPct / 100) * 10) / 10, gemas: Math.round(q * C.minas.gemaPct / 100 * 10) / 10 };
  }
  // Entrega o minerado: inteiro no fim; parando antes, metade com 50% do tempo ou mais, nada antes disso.
  // Guarda no histórico por região (minutos minerados, minério e pedras). Retorna { material, qtd, gemas, parcial } ou o motivo.
  function entregarMinas(p, agora, rng, parar) {
    rng = rng || Math.random;
    var mi = p.minas, C = D.CRAFT;
    if (!mi) return 'Você não está minerando.';
    if (!parar && agora < mi.fim) return 'Ainda minerando.';
    var total = mi.fim - mi.inicio, feito = Math.max(0, Math.min(total, agora - mi.inicio));
    var frac = feito >= total ? 1 : feito * 100 / total >= C.minas.metadeDesde ? 0.5 : 0;
    var faixa = mi.qtd || (C.minas.opcoes[mi.opcao] || C.minas.opcoes[0]).qtd;
    var q = faixa[0] + Math.floor(rng() * (faixa[1] - faixa[0] + 1));
    if (ehColetor(p)) q = Math.round(q * (1 + C.coletorBonus / 100));
    q = Math.floor(q * frac);
    var gemas = 0;
    for (var i = 0; i < q; i++) if (rng() * 100 < C.minas.gemaPct) gemas++;
    var id = materialDaArea(mi.area);
    if (q - gemas) mudarConsumivel(p, 'material', id, q - gemas);
    if (gemas) mudarConsumivel(p, 'material', 'gema', gemas);
    var h = p.historicoMinas || (p.historicoMinas = {}), r = h[mi.area] || (h[mi.area] = { minutos: 0, qtd: 0, gemas: 0, vezes: 0 });
    r.minutos += Math.round(feito / 60000); r.qtd += q - gemas; r.gemas += gemas; r.vezes++;
    delete p.minas;
    return { material: id, qtd: q - gemas, gemas: gemas, parcial: frac < 1, metade: frac === 0.5 };
  }
  // Recolhe o que foi minerado (quando o tempo acabou).
  function recolherMinas(p, agora, rng) { return entregarMinas(p, agora, rng, false); }
  // Para antes da hora (ou recolhe, se já acabou).
  function pararMinas(p, agora, rng) { return entregarMinas(p, agora, rng, true); }
  function indiceArea(areaId) { return D.areas.map(function (a) { return a.id; }).indexOf(areaId); }
  // O que falta para fabricar/forjar: lista de { nome, tem, precisa } (vazia = pode).
  function faltando(p, custos) {
    return custos.filter(function (c) { return c.tem < c.precisa; });
  }
  function custoReceita(p, areaId) {
    var i = indiceArea(areaId), mat = materialDaArea(areaId), C = D.CRAFT.receita;
    return [{ tipo: 'material', id: mat, nome: D.CRAFT.materiais[mat].nome, tem: qtdMaterial(p, mat), precisa: C.material },
      { tipo: 'ouro', nome: 'ouro', tem: p.ouro, precisa: C.ouro[i] }];
  }
  function custoProtecao(p, raridade) {
    var r = D.CRAFT.protecao[raridade], lista = [{ tipo: 'cristal', id: raridade, nome: 'Cristal ' + RARIDADE_M[raridade], tem: qtdConsumivel(p, 'cristal', raridade), precisa: r.cristal }];
    Object.keys(r.materiais).forEach(function (k) { lista.push({ tipo: 'material', id: k, nome: D.CRAFT.materiais[k].nome, tem: qtdMaterial(p, k), precisa: r.materiais[k] }); });
    return lista;
  }
  function custoForja(p, areaId) {
    var i = indiceArea(areaId), mat = materialDaArea(areaId), C = D.CRAFT.forja;
    return [{ tipo: 'receita', id: areaId, nome: 'Receita', tem: qtdConsumivel(p, 'receita', areaId), precisa: 1 },
      { tipo: 'material', id: mat, nome: D.CRAFT.materiais[mat].nome, tem: qtdMaterial(p, mat), precisa: C.material },
      { tipo: 'ouro', nome: 'ouro', tem: p.ouro, precisa: C.ouro[i] }];
  }
  function pagar(p, custos) {
    custos.forEach(function (c) {
      if (c.tipo === 'ouro') p.ouro -= c.precisa;
      else if (c.tipo === 'material') mudarConsumivel(p, 'material', c.id, -c.precisa);
      else if (c.tipo === 'cristal') mudarConsumivel(p, 'cristal', c.id, -c.precisa);
      else if (c.tipo === 'receita') mudarConsumivel(p, 'receita', c.id, -c.precisa);
    });
  }
  // Coletor fabrica 1 Receita da região (só regiões já liberadas pelo level).
  function fabricarReceita(p, areaId) {
    var a = D.areas[indiceArea(areaId)];
    if (!ehColetor(p)) return 'Só o Coletor fabrica receitas.';
    if (!a || p.nivel < a.nivelMin) return 'Região ainda não liberada.';
    var c = custoReceita(p, areaId);
    if (faltando(p, c).length) return 'Faltam materiais ou ouro.';
    pagar(p, c);
    mudarConsumivel(p, 'receita', areaId, 1);
    return true;
  }
  function fabricarProtecao(p, raridade) {
    if (!ehColetor(p)) return 'Só o Coletor fabrica o Pergaminho de Proteção.';
    if (!D.CRAFT.protecao[raridade]) return 'Raridade inválida.';
    var c = custoProtecao(p, raridade);
    if (faltando(p, c).length) return 'Faltam cristais ou materiais.';
    pagar(p, c);
    mudarConsumivel(p, 'protecao', raridade, 1);
    return true;
  }
  // Chances de raridade da forja com os ingredientes extras (chefe e gema: quantidades de 0 a maxExtra).
  function chancesForja(p, areaId, chefe, gemas) {
    var F = D.CRAFT.forja, ch = Math.min(F.maxExtra, chefe || 0), ge = Math.min(F.maxExtra, gemas || 0);
    var t = {}; F.raridade.forEach(function (x) { t[x.raridade] = x.chance; });
    t.lendaria = (t.lendaria || 0) + ch * F.extraChefe.lendaria + ge * F.extraGema.lendaria;
    t.epica = (t.epica || 0) + ch * F.extraChefe.epica + ge * F.extraGema.epica;
    var resto = 100 - t.lendaria - t.epica - (t.rara || 0);
    t.comum = Math.max(0, resto);
    return { comum: t.comum, rara: t.rara, epica: t.epica, lendaria: t.lendaria,
      obraPrima: F.obraPrima + (p.raca === 'anao' ? F.obraPrimaAnao : 0) };
  }
  // Item forjado a partir do que o servidor sorteou (serviço da Oficina): mesma semente = mesmo item.
  // spec = { classe, tipo, raridade, area, semente, forjadoPor, obraPrima }
  function itemForjado(spec) {
    var a = D.areas[indiceArea(spec.area)] || D.areas[0], rng = rngSemente(Number(spec.semente) || 1), nivel = a.nivelMin + 2;
    var falso = { classe: spec.classe, talentos: null, nivel: nivel, raca: 'humano', inventario: [], equipados: {} };
    var item = spec.tipo === 'arma' ? novoItem('arma', spec.classe, spec.raridade, rng, sortearTipoArma(falso, spec.raridade, rng), nivel)
      : itemDoTipo(falso, spec.tipo, spec.raridade, rng);
    if (!item) return null;
    item.nivel = item.nivel || nivel;
    item.forjadoPor = spec.forjadoPor;
    if (spec.obraPrima) item.obraPrima = true;
    return item;
  }

  // Ferreiro forja 1 item (arma ou peça: tipo = 'arma' | elmo | peitoral | luvas | botas | 'secundaria') para a classe escolhida.
  function forjar(p, areaId, classe, tipo, chefe, gemas, rng) {
    rng = rng || Math.random;
    var a = D.areas[indiceArea(areaId)], F = D.CRAFT.forja;
    if (!ehFerreiro(p)) return 'Só o Ferreiro forja.';
    if (!a || p.nivel < a.nivelMin) return 'Região ainda não liberada.';
    if (!D.classes[classe]) return 'Classe inválida.';
    chefe = Math.min(F.maxExtra, chefe || 0); gemas = Math.min(F.maxExtra, gemas || 0);
    var mc = materialDoChefe(a.chefe.id);
    var c = custoForja(p, areaId);
    if (chefe) c.push({ tipo: 'material', id: mc, nome: D.CRAFT.materiais[mc].nome, tem: qtdMaterial(p, mc), precisa: chefe });
    if (gemas) c.push({ tipo: 'material', id: 'gema', nome: D.CRAFT.materiais.gema.nome, tem: qtdMaterial(p, 'gema'), precisa: gemas });
    if (faltando(p, c).length) return 'Faltam materiais ou ouro.';
    if (mochilaCheia(p)) return 'Mochila cheia.';
    var ch = chancesForja(p, areaId, chefe, gemas), r = rng() * 100, rar = 'comum';
    if (r < ch.lendaria) rar = 'lendaria'; else if (r < ch.lendaria + ch.epica) rar = 'epica'; else if (r < ch.lendaria + ch.epica + ch.rara) rar = 'rara';
    var obra = rng() * 100 < ch.obraPrima && rar !== 'lendaria';
    if (obra) rar = RARIDADES[RARIDADES.indexOf(rar) + 1];
    pagar(p, c);
    var nivel = a.nivelMin + 2, item;
    // o item é da classe base escolhida (sem a segunda classe do Ferreiro), para vender ou dar
    var falso = Object.assign({}, p, { classe: classe, talentos: null });
    if (tipo === 'arma') item = novoItem('arma', classe, rar, rng, sortearTipoArma(falso, rar, rng), nivel);
    else item = itemDoTipo(falso, tipo, rar, rng);
    if (!item) return 'Esse tipo de item não existe para essa classe.';
    item.nivel = item.nivel || nivel;
    item.forjadoPor = p.nome;
    if (obra) item.obraPrima = true;
    p.inventario.push(item);
    return { item: item, obraPrima: obra };
  }

  function criarPersonagem(nome, sexo, raca, classe) {
    var atr = atributosIniciais(raca, classe);
    var arma = novaArma(classe, 'comum');
    arma.variacao = 0;                                  // arma clássica da classe
    arma.dano = D.ARMA_INICIAL_DANO.slice();
    var p = {
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
      consumiveis: [],
      hpAtual: D.HP_INICIAL,
      inventario: [arma],
      equipados: Object.assign(equipamentosVazios(), { arma: arma.id }),
      abates: {},
      presencaChefe: {},   // por área: % acumulada de o chefe aparecer (o jogador não vê)
      pocoes: D.VIDA.pocoesPorDia,
      ultimoReset: null,   // dia (AAAA-MM-DD, Brasília) do último reset diário
      vidaEm: null,        // momento (ms) até onde a vida com o tempo já foi contada
      acampado: false,
      guia: { passo: 0, abates: 0 },   // Guia do Aventureiro (só personagens novos)
      criadoEm: new Date().toISOString(),
      atributosV2: true,   // já nasce com os atributos de nov/2026
    };
    p.hpAtual = status(p).hpMax;   // a RES da classe e a raça já mudam a vida inicial
    return p;
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
    // Caçador passou a usar Força no ataque (nov/2026): quem já tinha level ganha 1 Recomeço para mudar os pontos, uma vez só.
    if (!p.presenteForcaCacador) {
      var ganha = p.classe === 'arqueiro' && p.nivel > 1;
      if (ganha) p.recomecos = (p.recomecos || 0) + 1;
      p.presenteForcaCacador = ganha ? 1 : 2;
    }
    // Raças e classes rebalanceadas (nov/2026): os atributos iniciais passam a ser só os da classe (70 pontos);
    // os pontos que o jogador distribuiu continuam os mesmos.
    if (!p.atributosV2 && p.atributos && p.atributosIniciais && D.classes[p.classe]) {
      var novos = atributosIniciais(p.raca, p.classe);
      ATRIBUTOS.forEach(function (k) {
        p.atributos[k] = Math.max(1, (p.atributos[k] || 0) + novos[k] - (p.atributosIniciais[k] || 0));
      });
      p.atributosIniciais = novos;
      p.atributosV2 = true;
    }
    if (typeof p.ouro !== 'number') p.ouro = 0;
    consumiveis(p);   // pergaminhos antigos (contador) viram itens
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
    // Anéis antigos (Sorte) viram anéis novos, com os bônus da raridade e do nível deles.
    p.inventario.forEach(function (i) {
      if (!anelAntigo(i)) return;
      if (i.qualidade == null) i.qualidade = sortearQualidade(i.raridade);
      i.bonus = sortearBonusAnel(i, Math.random);
    });
    return p;
  }

  function velocidadeDoNivel(nivel) {
    return Math.round(D.VELOCIDADE.inicial * Math.pow(D.VELOCIDADE.porNivel, nivel - 1));
  }

  // Status vêm dos atributos (básicos + equipamentos) e dos bônus diretos das armaduras.
  // pve = true: soma as skills de combate do clã (só contra monstros: caçada, masmorra e bosses; nunca na Arena).
  function status(p, pve) {
    var s = statusBase(p);
    return pve ? comRunas(comCla(s, p), p) : s;
  }
  // Runas das Relíquias equipadas (só contra monstros).
  function comRunas(s, p) {
    Object.keys(p.equipados || {}).forEach(function (slot) {
      var it = p.equipados[slot] && p.inventario.filter(function (i) { return i.id === p.equipados[slot]; })[0], r = bonusRuna(it);
      if (!r) return;
      var pct = function (v, x) { return Math.round(v * (1 + x / 100)); };
      if (r.dano) s.dano = [pct(s.dano[0], r.dano), pct(s.dano[1], r.dano)];
      if (r.vida) s.hpMax = pct(s.hpMax, r.vida);
      if (r.critico) { s.chanceCritico += r.critico; s.chanceCriticoMagico += r.critico; }
      if (r.velocidade) s.velocidade = Math.max(1, pct(s.velocidade, r.velocidade));
      if (r.defesa) { s.defesa = pct(s.defesa, r.defesa); s.defesaMagica = pct(s.defesaMagica, r.defesa); }
    });
    return s;
  }
  function statusBase(p) {
    var a = atributosTotais(p);
    var eq = bonusEquipamentos(p);
    var arma = armaEquipada(p);
    var magico = D.classes[p.classe].dano === 'magico';
    var danoArma = arma ? danoArmaComEncanto(arma) : [0, 0];
    var ta = arma ? tipoArma(arma) : null, idxArma = arma ? RARIDADES.indexOf(arma.raridade) : 0;
    var danoBase = arma ? danoArmaComEncanto(arma, true) : [0, 0], fat = ta ? ta.fator : 1;
    // +1 de dano a cada 3 pontos do atributo de dano da classe (Força, Destreza ou Inteligência).
    var bonus = Math.floor(a[D.classes[p.classe].atributoDano || (magico ? 'int' : 'for')] / D.PONTOS_POR_DANO);
    var pctItem = function (v, k) { return eq[k] ? Math.round(v * (1 + eq[k] / 100)) : v; };   // % da mão esquerda
    return comConjunto(comRaca(comPassiva({
      hpMax: pctItem(D.HP_INICIAL
        + Math.max(0, a.res - D.RES_SEM_VIDA) * D.HP_POR_RES   // toda RES acima de 10 dá vida (nov/2026)
        + (p.nivel - 1) * D.HP_POR_NIVEL
        + eq.vida, 'vidaPct'),
      tipoDano: magico ? 'magico' : 'fisico',
      danoArma: danoArma,
      ataque: magico ? 0 : bonus,                    // FOR (Cavaleiro/Artesão) ou DES (Caçador)
      ataqueMagico: magico ? bonus : 0,              // INT (Mago)
      // o fator do tipo da arma vale para o golpe inteiro: arma + dano do herói + mão esquerda
      dano: danoComMao([Math.round((danoBase[0] + bonus + (eq.dano || 0)) * fat), Math.round((danoBase[1] + bonus + (eq.dano || 0)) * fat)],
        (magico ? eq.danoMagico || 0 : 0) + (eq.danoPct || 0)),
      // cada ponto de RES conta: 0,45 de defesa por ponto (antes só a cada 10) + armaduras (já x4,5)
      defesa: pctItem(Math.round(a.res * D.DEFESA.fator / 10) + eq.defesa, 'defesaPct'),
      defesaMagica: pctItem(Math.round(a.res * D.DEFESA.fator / 10) + eq.defesaMagica, 'defesaPct'),
      precisao: 75 + a.des + (eq.precisao || 0),     // DES (%) + aljava
      evasao: a.des * 0.5,                           // DES (%)
      // 15 no level 1, +6% por level (não depende da DES), vezes a velocidade da arma (devagar 0,8 / rápida 1,2)
      velocidade: Math.max(1, Math.round(velocidadeDoNivel(p.nivel) * (ta ? D.VELOCIDADE_ARMA[ta.vel] : 1))),
      chanceCritico: a.des * 0.5 + (eq.critico || 0),   // DES (0,5% por ponto) + mão esquerda (a Sorte não conta mais)
      danoCritico: 150 + a.for,                      // FOR (% do dano)
      chanceCriticoMagico: a.sor + (eq.critico || 0),   // SOR (1% por ponto)
      danoCriticoMagico: 150 + a.sor + (eq.danoCriticoMagico || 0),   // SOR (% do dano) + orbe
      chanceCraft: a.sor,                            // SOR (%)
      chanceEncantamento: a.sor * D.SORTE.encanto,   // 0,5% por ponto de SOR
      bonusRecompensa: 0,                            // % a mais de ouro e exp (passiva do Coletor)
      // % a mais contra monstros / na Arena: extras da arma por nível; armas antigas pela raridade (épica/lendária)
      danoPvE: !arma ? 0 : arma.extras ? arma.extras.pve || 0 : D.RARIDADE_ARMA.pve[idxArma],
      danoPvP: !arma ? 0 : arma.extras ? arma.extras.pvp || 0 : D.RARIDADE_ARMA.pvp[idxArma],
    }, p), p), p);
  }
  // ---------- Skills do clã (Daniel, nov/2026) ----------
  // p.cla = { id, skills: { exp: 2, dano: 1, ... } }: cópia que o jogo guarda ao abrir o clã (vai junto nos dados do
  // personagem, então a masmorra e o boss calculam igual em todos os aparelhos).
  function skillCla(p, id) { return Math.max(0, Math.floor((p.cla && p.cla.skills && p.cla.skills[id]) || 0)); }
  function defSkillCla(id) { return D.ALIANCA.skills.filter(function (k) { return k.id === id; })[0] || null; }
  function bonusCla(p, id) { var d = defSkillCla(id); return d ? skillCla(p, id) * d.porNivel : 0; }
  function precoSkillCla(nivel) { return D.ALIANCA.skillPrecos[nivel - 1] || null; }
  function comCla(s, p) {
    if (!p.cla) return s;
    var pct = function (v, x) { return Math.round(v * (1 + x / 100)); }, b = function (id) { return bonusCla(p, id); };
    if (b('vida')) s.hpMax = pct(s.hpMax, b('vida'));
    if (b('dano')) s.dano = [pct(s.dano[0], b('dano')), pct(s.dano[1], b('dano'))];
    if (b('critico')) { s.chanceCritico += b('critico'); s.chanceCriticoMagico += b('critico'); }
    if (b('danoCritico')) { s.danoCritico += b('danoCritico'); s.danoCriticoMagico += b('danoCritico'); }
    if (b('resistencia')) { s.defesa = pct(s.defesa, b('resistencia')); s.defesaMagica = pct(s.defesaMagica, b('resistencia')); }
    if (b('velocidade')) s.velocidade = Math.max(1, pct(s.velocidade, b('velocidade')));
    if (b('esquiva')) s.evasao += b('esquiva');
    return s;
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
  // Traços da raça (D.racas[x].tracos): % de vida, dano e velocidade, pontos de crítico e dano crítico, % da esquiva.
  function tracosRaca(p) { return (D.racas[p.raca] && D.racas[p.raca].tracos) || {}; }
  function comRaca(s, p) {
    var t = tracosRaca(p), pct = function (v, x) { return Math.round(v * (1 + x / 100)); };
    if (t.vidaPct) s.hpMax = pct(s.hpMax, t.vidaPct);
    if (t.danoPct) s.dano = [Math.max(1, pct(s.dano[0], t.danoPct)), Math.max(1, pct(s.dano[1], t.danoPct))];
    if (t.velocidadePct) s.velocidade = Math.max(1, pct(s.velocidade, t.velocidadePct));
    if (t.critico) { s.chanceCritico = Math.max(0, s.chanceCritico + t.critico); s.chanceCriticoMagico = Math.max(0, s.chanceCriticoMagico + t.critico); }
    if (t.danoCritico) { s.danoCritico += t.danoCritico; s.danoCriticoMagico += t.danoCritico; }
    if (t.evasaoPct) s.evasao = Math.max(0, s.evasao * (1 + t.evasaoPct / 100));
    return s;
  }
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
    var resistencia = s.hpMax * (1 + (s.defesa + s.defesaMagica) / (20 * D.DEFESA.fator)) * (1 + Math.min(50, s.evasao) / 100);
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
    var mult = (1 + atributosTotais(p).sor * D.SORTE.drop / 100)   // Sorte: +0,2% sobre a chance base por ponto (nov/2026)
      * (1 + bonusCla(p, 'fortuna') / 100);                         // skill Fortuna do clã
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

  // % da exp (e do ouro) que o personagem ganha na área do monstro (100, 50 ou 10). Abaixo de 100: sem drops.
  function fatorExp(p, monstroId) {
    var area = areaDoMonstro(monstroId);
    // mapas depois desta área que o herói já liberou pelo level
    var aFrente = D.areas.slice(D.areas.indexOf(area) + 1).filter(function (a) { return p.nivel >= a.nivelMin; }).length;
    var faixa = D.EXP_REDUZIDA.find(function (f) { return aFrente >= f.mapasAFrente; });
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
    // base + anéis (épico e lendário: +1% cada), tudo multiplicado no acampamento
    return status(p).hpMax * (D.VIDA.regenPorMinuto + (bonusEquipamentos(p).regen || 0)) * (p.acampado ? D.VIDA.acampamento : 1) / 100;
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

  // Drop do chefe (todos iguais, D.chefe.drop): 2% lendário, 10% épico; senão nada.
  // O item é 1 arma ou 1 armadura/mão esquerda da classe.
  function dropChefe(p, m, rng) {
    var raridade = rolarRaridade(p, D.chefe.drop, rng);
    if (!raridade) return null;
    if (rng() < 0.5) return novoItem('arma', p.classe, raridade, rng, sortearTipoArma(p, raridade, rng), nivelDoDrop(p, rng));
    var pecas = TIPOS_ARMADURA.concat(['secundaria']);
    return itemDoTipo(p, pecas[Math.floor(rng() * pecas.length)], raridade, rng);
  }

  // Item do boss da aliança (quem deu mais dano): 1 arma ou 1 armadura/mão esquerda da classe, na raridade sorteada no servidor.
  function itemBossAlianca(p, raridade, rng) {
    rng = rng || Math.random;
    if (!D.raridades[raridade]) raridade = 'epica';
    if (rng() < 0.5) return novoItem('arma', p.classe, raridade, rng, sortearTipoArma(p, raridade, rng), nivelDoDrop(p, rng));
    var pecas = TIPOS_ARMADURA.concat(['secundaria']);
    return itemDoTipo(p, pecas[Math.floor(rng() * pecas.length)], raridade, rng);
  }

  // ---------- Chefe Mundial (Ignaroth) ----------
  // Cada herói luta contra o chefe da área mais alta liberada pelo level (mesmo dano e defesa); a vida é a do reino.
  function chefeDoNivel(p) {
    var area = D.areas.filter(function (a) { return p.nivel >= a.nivelMin; }).pop() || D.areas[0];
    return area.chefe.id;
  }
  // Prêmio do Chefe Mundial: ouro e exp do chefe da área do herói x ataques (fator 100 = caiu; 70 = consolação).
  function premioChefeMundial(p, rec) {
    var m = D.monstros[rec.chefe] || D.monstros[chefeDoNivel(p)];
    var vezes = Math.max(0, Math.floor(rec.ataques || 0)), fator = Math.max(0, Math.min(100, rec.fator || 0)) / 100;
    var res = { ouro: Math.floor(m.ouro * vezes * fator), exp: Math.floor(m.exp * vezes * fator) };
    p.ouro += res.ouro;
    res.niveis = ganharExp(p, res.exp);
    return res;
  }
  // Item do top 10: épico ou lendário, arma (50%) ou peça de armadura/secundária, como o drop de chefe.
  function itemDoChefeMundial(p, raridade, rng) {
    rng = rng || Math.random;
    if (!D.raridades[raridade]) raridade = 'epica';
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
    var s = status(p, true);   // contra monstro: com as skills do clã
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
    aoCausar(b.lutador, b.jogador, dano);
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
    var qm = tickQueima(b.monstro);
    if (qm) { ev.queimou = qm; if (b.monstro.hp <= 0) { b.fim = 'vitoria'; return ev; } }
    if (b.monstro.atordoado > 0) {
      b.monstro.atordoado -= 1;
      ev.atordoado = true;
      return ev;
    }
    // Sombra (Assassino): o próximo ataque erra.
    if (b.lutador && b.lutador.furtivo) { b.lutador.furtivo = false; ev.sombra = true; return ev; }
    // Acerto do monstro: 80% + 2% por área, menos a evasão do jogador.
    if (rng() * 100 >= limitar(80 + m.indiceArea * 2 - s.evasao, 5, 95)) return ev;
    var dano = aoReceber(b.lutador, danoComDefesa(rolar(m.ataque, rng), defesaHeroi(s, b.lutador)), b.monstro, rng);
    ev.acerto = true;
    ev.dano = dano;
    b.jogador.hp = Math.max(0, b.jogador.hp - dano);
    var dr = depoisDeReceber(b.lutador, b.jogador);
    if (dr === 'milagre') ev.milagre = true; else if (dr) ev.bolso = true;
    if (b.lutador && b.lutador.errouCego) { b.lutador.errouCego = false; ev.cego = true; ev.acerto = false; }
    if (b.monstro.hp <= 0) { b.fim = 'vitoria'; return ev; }   // dano devolvido derrubou o monstro
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
        if (b.lutador) {
          inicioVez(b.lutador, b.jogador);
          var tk = tickDot(b.lutador, b.jogador, function () { return b.monstro.hp > 0 ? b.monstro : null; });
          if (tk && tk.caiu) { b.fim = 'vitoria'; return { ator: 'jogador', habilidade: tk.nome, golpes: [{ acerto: true, critico: false, dano: tk.dano }], dano: tk.dano, acerto: true, dot: true }; }
        }
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
      aplicarReforco(k, { L: L, h: b.jogador, s: b.s, alvo: b.monstro }, null);
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
      var g = golpeJogador(b, Object.assign({ mult: multHabilidade(def, k.pts) / 100 }, def.nivel ? opcoesNivel(def, b.jogador, b.monstro) : {}));
      hab.golpes.push(g);
      if (g.acerto && def.nivel) depoisDoGolpeNivel(def, b.monstro, b.s);
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
      // Área abaixo do nível do herói: o ouro cai na mesma proporção da exp e não cai nenhum drop.
      res.penalizado = res.fatorExp < 100;
      res.ouro = res.penalizado ? Math.max(1, Math.floor(m.ouro * res.fatorExp / 100)) : m.ouro;
      if (bonus && bonus.exp) res.exp = Math.floor(res.exp * (1 + bonus.exp / 100));
      if (bonus && bonus.ouro) res.ouro = Math.floor(res.ouro * (1 + bonus.ouro / 100));
      if (b.s.bonusRecompensa) {   // passiva do Coletor
        res.exp = Math.floor(res.exp * (1 + b.s.bonusRecompensa / 100));
        res.ouro = Math.floor(res.ouro * (1 + b.s.bonusRecompensa / 100));
      }
      p.ouro += res.ouro;
      res.niveis = ganharExp(p, res.exp);
      if (res.penalizado) {
        // sem itens nem pergaminhos
      } else if (m.chefe) {
        var premio = dropChefe(p, m, b.rng);
        if (premio && premio.tipo === 'arma') res.drop = premio; else if (premio) res.dropArmadura = premio;
        // 20% de chance de 1 pergaminho, raridade pela qualidade da caçada (não depende da arma)
        if (b.rng() * 100 < D.chefe.pergaminho) {
          res.pergaminho = sortearRaridadeDrop(b.rng);
          res.qtdPergaminhos = 1;
          mudarPergaminho(p, res.pergaminho, 1);
        }
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
      if (!m.chefe && !res.penalizado) {
        res.pergaminho = rolarPergaminho(p, b.monstroId, b.rng);
        if (res.pergaminho) { mudarPergaminho(p, res.pergaminho, 1); res.qtdPergaminhos = 1; }
      }
      {   // material cai mesmo em região abaixo do level (para farmar os materiais das primeiras regiões)
        res.material = rolarMaterial(p, b.monstroId, b.rng);
        if (res.material) mudarConsumivel(p, 'material', res.material.id, res.material.qtd);
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
  var PESO_BONUS = { defesa: 8 / D.DEFESA.fator, defesaMagica: 8 / D.DEFESA.fator, vida: 1, regen: 20, for: 6, des: 6, res: 6, int: 6, sor: 6, dano: 10, precisao: 4, critico: 6, danoMagico: 4, danoCriticoMagico: 2, danoPct: 12, vidaPct: 10, defesaPct: 6 };
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
    if (pr.pergaminhoArma) { var arma = armaEquipada(p); mudarPergaminho(p, arma ? arma.raridade : 'comum', pr.pergaminhoArma); }
  }
  // tipo 'diarias' ou 'semanais'. Retorna o texto do prêmio ou null.
  // ---------- Guia do Aventureiro (tutorial dos personagens novos; texto em js/historia.js) ----------
  // p.guia = { passo, abates, loja, arena, item: id do presente, fim, pulou }. Sem p.guia (personagens antigos): sem guia.
  function guiaEstado(p) {
    var G = D.GUIA, g = p.guia;
    if (!G || !g || g.fim) return null;
    var passo = G.passos[g.passo];
    return passo ? { indice: g.passo, total: G.passos.length, passo: passo, abates: g.abates || 0 } : null;
  }
  // Eventos: 'abate' (venceu na caçada), 'aba' (alvo = aba aberta), 'arena' (lutou na Arena).
  function registrarGuia(p, evento, alvo) {
    var g = p.guia;
    if (!g || g.fim) return;
    if (evento === 'abate') g.abates = (g.abates || 0) + 1;
    if (evento === 'aba' && alvo === 'mercado') g.loja = true;
    if (evento === 'arena') g.arena = true;
  }
  function passoGuiaFeito(p, id) {
    var g = p.guia, G = D.GUIA;
    if (id === 'cacar') return (g.abates || 0) >= (G.passos[1].meta || 1);
    if (id === 'equipar') return !g.item || !!slotDoItem(p, g.item) || !itemPorId(p, g.item);
    if (id === 'loja') return !!g.loja;
    if (id === 'historia') return !!(p.historia && (p.historia.visto || (p.historia.lidos || []).length));
    if (id === 'arena') return !!g.arena;
    return false;
  }
  // Ao entrar num passo: o de equipar põe o presente na mochila (se couber).
  function entrarPassoGuia(p) {
    var g = p.guia, passo = D.GUIA.passos[g.passo];
    if (passo && passo.id === 'equipar' && !g.item && !mochilaCheia(p)) {
      var pr = D.GUIA.presenteItem, item = novoItem(pr.tipo, p.classe, pr.raridade, null, null, p.nivel);
      item.nome = pr.nome;
      p.inventario.push(item);
      g.item = item.id;
    }
  }
  // Confere o passo atual e avança quantos estiverem feitos. Retorna { avancou, fim, premio (texto) } ou null.
  function verificarGuia(p) {
    var g = p.guia;
    if (!g || g.fim || !D.GUIA) return null;
    var avancou = false;
    while (!g.fim && g.passo > 0 && passoGuiaFeito(p, D.GUIA.passos[g.passo].id)) {
      g.passo += 1; avancou = true;
      if (g.passo >= D.GUIA.passos.length) {
        g.fim = true;
        var pr = D.GUIA.premioFinal;
        if (pr.ouro) p.ouro += pr.ouro;
        if (pr.pergaminho) mudarPergaminho(p, pr.pergaminho.raridade, pr.pergaminho.qtd);
        return { avancou: true, fim: true, premio: premioHistoriaTexto(p, pr) };
      }
      entrarPassoGuia(p);
    }
    return avancou ? { avancou: true, fim: false } : null;
  }
  function comecarGuia(p) { if (p.guia && !p.guia.fim && p.guia.passo === 0) { p.guia.passo = 1; entrarPassoGuia(p); verificarGuia(p); } }
  function pularGuia(p) { if (p.guia) { p.guia.fim = true; p.guia.pulou = true; } }

  // ---------- História (Aventura > História): "A Crônica de Eldrin" (texto em js/historia.js) ----------
  // p.historia = { cap: índice do capítulo atual, prog: { índice do objetivo: quantos }, visto: abertura já lida, lidos: [ids] }.
  // Não trava regiões: o capítulo só pede o level da região dele.
  function historiaDados(p) {
    var h = p.historia || (p.historia = { cap: 0, prog: {}, visto: false, lidos: [] });
    if (!h.prog) h.prog = {};
    if (!h.lidos) h.lidos = [];
    return h;
  }
  function nivelCapitulo(c) {
    var a = D.areas.filter(function (x) { return x.id === c.area; })[0];
    return a ? a.nivelMin : 1;
  }
  function metaObjetivo(o) { return o.qtd || 1; }
  // Situação do capítulo atual (ou { fim: true } quando a crônica acabou).
  function historiaEstado(p) {
    var H = D.HISTORIA;
    if (!H) return null;
    var h = historiaDados(p), c = H.capitulos[h.cap];
    if (!c) return { fim: true, total: H.capitulos.length };
    var nivel = nivelCapitulo(c), liberado = p.nivel >= nivel;
    var objetivos = c.objetivos.map(function (o, i) {
      var meta = metaObjetivo(o), feito = Math.min(meta, h.prog[i] || 0);
      return { objetivo: o, feito: feito, meta: meta, ok: feito >= meta };
    });
    return { fim: false, indice: h.cap, total: H.capitulos.length, capitulo: c, nivel: nivel, liberado: liberado,
      objetivos: objetivos, completo: liberado && objetivos.every(function (x) { return x.ok; }), visto: !!h.visto };
  }
  // evento 'abate' (alvo = id do monstro vencido na caçada) ou 'masmorra' (alvo = id da masmorra vencida).
  // Só conta no capítulo atual e com o level da região. Retorna true se algum objetivo andou.
  function registrarHistoria(p, evento, alvo) {
    var e = historiaEstado(p);
    if (!e || e.fim || !e.liberado) return false;
    var h = historiaDados(p), mudou = false;
    e.capitulo.objetivos.forEach(function (o, i) {
      var conta = false, m = D.monstros[alvo];
      if (evento === 'abate' && m) conta = o.tipo === 'abate' ? m.area === o.area && !m.chefe : o.tipo === 'chefe' && o.monstro === alvo;
      if (evento === 'masmorra') conta = o.tipo === 'masmorra' && o.masmorra === alvo;
      if (conta && (h.prog[i] || 0) < metaObjetivo(o)) { h.prog[i] = (h.prog[i] || 0) + 1; mudou = true; }
    });
    return mudou;
  }
  function premioHistoriaTexto(p, pr) {
    var partes = [];
    if (pr.ouro) partes.push(pr.ouro.toLocaleString('pt-BR') + ' de ouro');
    if (pr.expPct) partes.push(pr.expPct + '% da exp do level');
    if (pr.pergaminho) partes.push(pr.pergaminho.qtd + ' pergaminho' + (pr.pergaminho.qtd > 1 ? 's' : '') + ' ' + D.raridades[pr.pergaminho.raridade].nome.toLowerCase());
    if (pr.item) partes.push('1 ' + (pr.item.tipo === 'arma' ? 'arma' : pr.item.tipo) + ' ' + D.raridades[pr.item.raridade].nome.toLowerCase() + ' do seu level');
    if (pr.titulo) partes.push('o título "' + ((p.sexo === 'feminino' && pr.tituloF) || pr.titulo) + '"');
    if (pr.skin) { var sk = D.SKINS_DADO.filter(function (x) { return x.id === pr.skin; })[0]; partes.push('a skin de dado "' + (sk ? sk.nome : pr.skin) + '"'); }
    return partes.join(' + ');
  }
  // Recebe o prêmio do capítulo completo e passa para o próximo.
  // Retorna { capitulo, premio (texto), item } ou { erro } (mochila cheia quando o prêmio tem item) ou null.
  function concluirCapitulo(p, rng) {
    var e = historiaEstado(p);
    if (!e || !e.completo) return null;
    var pr = e.capitulo.premio || {}, item = null;
    if (pr.item && mochilaCheia(p)) return { erro: 'Mochila cheia! Libere um espaço para receber o prêmio do capítulo.' };
    var texto = premioHistoriaTexto(p, pr);
    if (pr.ouro) p.ouro += pr.ouro;
    if (pr.expPct && p.nivel < D.NIVEL_MAXIMO) ganharExp(p, Math.max(1, Math.round(expNecessaria(p.nivel) * pr.expPct / 100)));
    if (pr.pergaminho) mudarPergaminho(p, pr.pergaminho.raridade, pr.pergaminho.qtd);
    if (pr.item) {
      var atual = armaEquipada(p), esp = pr.item.tipo === 'arma' && atual && atual.arma && podeUsar(p, atual) ? atual.arma : null;
      item = novoItem(pr.item.tipo, p.classe, pr.item.raridade, rng, esp, p.nivel);
      p.inventario.push(item);
    }
    if (pr.titulo) p.titulo = (p.sexo === 'feminino' && pr.tituloF) || pr.titulo;
    if (pr.skin && skinsDoPersonagem(p).indexOf(pr.skin) < 0) p.skinsDado = skinsDoPersonagem(p).concat(pr.skin);
    var h = historiaDados(p);
    h.lidos = h.lidos.concat(e.capitulo.id);
    h.cap += 1; h.prog = {}; h.visto = false;
    return { capitulo: e.capitulo, premio: texto, item: item };
  }
  function marcarHistoriaVista(p) { historiaDados(p).visto = true; }

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
    if (rng() * 100 >= perg.chance) return null;
    if (perg.qualidade) return sortearRaridadeDrop(rng);
    if (perg.raridade) return perg.raridade;
    var arma = armaEquipada(p);
    return arma ? arma.raridade : 'comum';
  }

  // Troca de pergaminhos: 10 de uma raridade viram 1 da raridade seguinte. Retorna a raridade ganha ou um motivo.
  function proximaRaridade(raridade) {
    var i = RARIDADES.indexOf(raridade);
    return i >= 0 && i < RARIDADES.length - 1 ? RARIDADES[i + 1] : null;
  }
  function trocarPergaminho(p, de) {
    var para = proximaRaridade(de), q = D.TROCA_PERGAMINHO.quantidade;
    if (!para) return { erro: 'Esse pergaminho não pode ser trocado.' };
    if (qtdPergaminho(p, de) < q) return { erro: 'São precisos ' + q + ' pergaminhos para trocar.' };
    mudarPergaminho(p, de, -q);
    mudarPergaminho(p, para, 1);
    return { para: para };
  }

  // ---------- Leilão ----------
  // Faixa do leilão do herói (null antes do level 10).
  function faixaLeilao(nivel) {
    var L = D.LEILAO;
    if (nivel < L.nivelMin) return null;
    return L.faixas.filter(function (f) { return nivel >= f.nivel[0] && nivel <= f.nivel[1]; })[0] || null;
  }
  // Gerador de números a partir de uma semente (o mesmo para todos os jogadores).
  function rngSemente(semente) {
    var s = (Number(semente) >>> 0) || 1;
    return function () { s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 7), 61 | t) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // O item de um lote do leilão (sempre o mesmo para a mesma semente). Lote: { tipo, classe, raridade, nivel, semente, qtd }.
  // tipo 'pergaminho' devolve { tipo: 'pergaminho', raridade, qtd, consumivel: true }.
  function itemDoLote(l) {
    if (l.tipo === 'pergaminho') return { tipo: 'pergaminho', classe: null, raridade: l.raridade, encanto: 0, qtd: l.qtd || 1, consumivel: true };
    var rng = rngSemente(l.semente), item;
    if (l.tipo === 'arma') {
      var lista = D.ARMAS_CLASSE[l.classe].armas;
      item = novoItem('arma', l.classe, l.raridade, rng, lista[Math.floor(rng() * lista.length)], l.nivel);
    } else if (l.tipo === 'armadura') {
      item = novoItem(TIPOS_ARMADURA[Math.floor(rng() * TIPOS_ARMADURA.length)], l.classe, l.raridade, rng, null, l.nivel);
    } else {
      item = novoItem(rng() < 0.5 ? 'colar' : 'anel', null, l.raridade, rng, null, l.nivel);
    }
    item.id = 'leilao-' + (l.semente >>> 0).toString(36) + '-' + novoId();
    return item;
  }
  // Menor lance aceito agora: o mínimo do lote ou o lance atual + 5%.
  function proximoLance(l) {
    return l.lance ? Math.ceil(l.lance * (1 + D.LEILAO.incrementoPct / 100)) : l.minimo;
  }

  function comprarPergaminho(p, raridade) {
    var preco = D.encantamento.precoPergaminho[raridade];
    if (preco === undefined || p.ouro < preco) return false;
    p.ouro -= preco;
    mudarPergaminho(p, raridade, 1);
    return true;
  }

  // Chance (%) de levar a arma ao próximo nível.
  // Chance de encantar: chance do nível + Sorte de quem encanta + bônus do Anão, nunca acima do teto do nível.
  function chanceEncantar(p, item) { return chanceEncantarCom(bonusEncanto(p), item); }
  // Quanto quem encanta soma na chance (Sorte + Anão). As Oficinas guardam isto do artesão.
  function bonusEncanto(p) { return atributosTotais(p).sor * D.SORTE.encanto + (p.raca === 'anao' ? (D.encantamento.anao || 0) : 0); }
  function chanceEncantarCom(bonus, item) {
    var E = D.encantamento, alvo = item.encanto + 1;
    if (alvo <= E.seguroAte) return 100;
    return Math.min(E.chanceMaxima, (E.teto && E.teto[alvo]) || 100, E.chances[alvo] + (bonus || 0));
  }
  // Relíquia Rúnica: chance do Ferreiro (base + Sorte x porSorte, até maxima).
  function chanceReliquia(p) { var Q = D.CRAFT.reliquia; return Math.min(Q.maxima, Q.base + atributosTotais(p).sor * Q.porSorte); }
  function podeReliquia(p) {
    var Q = D.CRAFT.reliquia;
    if (!ehFerreiro(p) || p.raca !== 'anao') return 'Só um Anão Ferreiro forja relíquias.';
    if (p.nivel < Q.nivelMin) return 'Precisa ser level ' + Q.nivelMin + '.';
    return true;
  }
  function runa(id) { return D.CRAFT.reliquia.runas.filter(function (r) { return r.id === id; })[0] || null; }
  // Força da runa pelo encanto do item: +7 = 1; cada + a mais soma porEncanto.
  function forcaRuna(item) { var Q = D.CRAFT.reliquia; return 1 + Q.porEncanto * Math.max(0, (item.encanto || 0) - Q.encantoMin); }
  // Bônus da runa deste item: { dano, vida, critico, velocidade, defesa } já com a força.
  function bonusRuna(item) {
    var r = item && item.runa && runa(item.runa), f = r ? forcaRuna(item) : 0, b = {};
    if (!r) return null;
    ['dano', 'vida', 'critico', 'velocidade', 'defesa'].forEach(function (k) { if (r[k]) b[k] = Math.round(r[k] * f * 10) / 10; });
    return b;
  }
  var NOME_BONUS_RUNA = { dano: '% de dano', vida: '% de vida', critico: '% de chance de crítico', velocidade: '% de velocidade', defesa: '% de defesa' };
  function textoRuna(item) {
    var b = bonusRuna(item);
    return b ? Object.keys(b).map(function (k) { return '+' + String(b[k]).replace('.', ',') + NOME_BONUS_RUNA[k]; }).join(', ') : '';
  }

  // O que acontece se falhar: 'nada', 'zera' ou 'quebra'.
  function riscoEncantar(item) {
    var E = D.encantamento, alvo = item.encanto + 1;
    if (alvo <= E.seguroAte) return 'nada';
    return alvo <= E.voltaZeroAte ? 'zera' : 'quebra';
  }

  // Tenta encantar. Retorna { sucesso, quebrou, nivel } ou null se não puder tentar.
  // protecao = true: gasta 1 Pergaminho de Proteção da raridade do item; se falhar, o item fica como estava.
  function encantar(p, itemId, rng, protecao) {
    var item = p.inventario.find(function (i) { return i.id === itemId; });
    if (!item || item.runa || item.encanto >= D.encantamento.maximo || qtdPergaminho(p, item.raridade) <= 0) return null;   // relíquia: encanto travado
    var chance = chanceEncantar(p, item);
    var risco = riscoEncantar(item);
    var protegido = !!protecao && risco !== 'nada' && qtdConsumivel(p, 'protecao', item.raridade) > 0;
    if (protegido) { mudarConsumivel(p, 'protecao', item.raridade, -1); risco = 'nada'; }
    var hpAntes = status(p).hpMax;
    var nivelAntes = item.encanto;
    var res;
    mudarPergaminho(p, item.raridade, -1);
    if ((rng || Math.random)() * 100 < chance) {
      item.encanto += 1;
      res = { sucesso: true, quebrou: false, nivel: item.encanto, item: item };
    } else if (risco === 'quebra') {
      var slot = slotDoItem(p, item.id);
      if (slot) p.equipados[slot] = null;
      p.inventario.splice(p.inventario.indexOf(item), 1);
      res = { sucesso: false, quebrou: true, nivel: nivelAntes, item: item };
      // O item quebrado vira cristais da raridade dele (100/150/200/500 tentando o +7/+8/+9/+10).
      var cristais = D.CRISTAIS_QUEBRA[nivelAntes + 1] || 0;
      if (cristais) { mudarConsumivel(p, 'cristal', item.raridade, cristais); res.cristais = cristais; }
    } else {
      if (risco === 'zera') item.encanto = 0;
      res = { sucesso: false, quebrou: false, nivel: item.encanto, item: item };
    }
    if (protegido) res.protegido = true;
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
    return simularSalas(herois, salasMasmorra(masmorraId), semente);
  }

  // Motor da luta em grupo (masmorra e boss da aliança). salas: listas de monstros (hp, ataque, velocidade,
  // defesa, defesaMagica, indiceArea, chefe). opc.limiteAtaques: a luta acaba quando os monstros atacarem
  // esse número de vezes (boss da aliança: o "fôlego" de cada investida); o resultado vem com `tempo: true`.
  function simularSalas(herois, salas, semente, opc) {
    opc = opc || {};
    var rng = rngSemente(semente);
    var hs = herois.map(function (dados) {
      var p = normalizar(JSON.parse(JSON.stringify(dados)));
      var s = status(p, true);   // com as skills do clã
      return { nome: p.nome, classe: p.classe, classe2: p.talentos && p.talentos.classe2 || null, raca: p.raca, sexo: p.sexo, s: s, hp: s.hpMax, hpMax: s.hpMax, vel: Math.max(1, s.velocidade),
        velBase: Math.max(1, s.velocidade), barra: 0, L: novoLutador(p, 'masmorra') };
    });
    var ataquesMonstro = 0;
    var inicio = {
      herois: hs.map(function (h) { return { nome: h.nome, classe: h.classe, classe2: h.classe2, raca: h.raca, sexo: h.sexo, hpMax: h.hpMax }; }),
      salas: salas.map(function (sala) { return sala.map(function (m) { return { id: m.id, nome: m.nome, hpMax: m.hpMax || m.hp, hp: m.hp, elite: m.elite, chefe: m.chefe }; }); }),
    };
    var eventos = [];
    // Cada evento leva a vida de todos os heróis depois dele (cura, Bênção e golpes).
    function registrar(e) { e.hp = hs.map(function (x) { return x.hp; }); eventos.push(e); }
    function vivos(lista) { return lista.filter(function (x) { return x.hp > 0; }); }
    for (var si = 0; si < salas.length; si++) {
      if (si > 0) registrar({ tipo: 'sala', sala: si });
      var ms = salas[si].map(function (m) { return Object.assign({}, m, { hpMax: m.hpMax || m.hp, vel: Math.max(1, m.velocidade), barra: 100, atordoado: 0 }); });
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
          var tk = tickDot(L, H, function () { return vivos(ms)[0] || null; });
          if (tk) {
            registrar({ tipo: 'golpe', sala: si, de: 'h', i: hs.indexOf(H), alvo: ms.indexOf(tk.alvo), acerto: true, critico: false, dano: tk.dano, caiu: tk.caiu, dot: true });
            if (!vivos(ms).length) continue;
          }
          var ferido = vivos(hs).some(function (x) { return x.hp * 100 / x.hpMax < T.curaSoAbaixo; });
          var k = escolherHabilidade(L, { grupo: true, grupoFerido: ferido });
          if (k) gastarHabilidade(L, k);
          if (k && ehReforco(k.def)) {
            aplicarReforco(k, { L: L, h: H, s: H.s, alvo: vivos(ms)[0] }, vivos(hs).map(function (x) { return { L: x.L, h: x }; }));
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
            var g = calcularGolpe(H.s, L, alvo, Object.assign({ mult: mult * (1 + (opc.buffDano || 0) / 100) }, k && k.def.nivel ? opcoesNivel(k.def, H, alvo) : {}), rng);
            if (g.acerto) {
              e.acerto = true; e.critico = g.critico; e.dano = g.dano;
              alvo.hp = Math.max(0, alvo.hp - g.dano);
              aoCausar(L, H, g.dano);
              if (k && k.def.nivel) depoisDoGolpeNivel(k.def, alvo, H.s);
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
          if (opc.limiteAtaques && ++ataquesMonstro > opc.limiteAtaques) {
            return { vitoria: false, tempo: true, sala: si, inicio: inicio, eventos: eventos };
          }
          var qm = tickQueima(ator);
          if (qm) { registrar({ tipo: 'golpe', sala: si, de: 'h', i: 0, alvo: ms.indexOf(ator), acerto: true, critico: false, dano: qm, caiu: ator.hp <= 0, queima: true }); if (ator.hp <= 0) continue; }
          if (ator.atordoado > 0) { ator.atordoado -= 1; ev.atordoado = true; registrar(ev); continue; }
          // Dano em área (bosses da aliança): a cada `area.cada` ataques, acerta todos os heróis vivos e tira `area.vidaPct`%
          // da vida máxima de cada um (a defesa não reduz; a esquiva e a Sombra evitam).
          ator.nAtaques = (ator.nAtaques || 0) + 1;
          if (ator.area && ator.nAtaques % ator.area.cada === 0) {
            var mi = ms.indexOf(ator);
            registrar({ tipo: 'habM', i: mi, nome: ator.area.nome });
            vivos(hs).forEach(function (h) {
              var e = { tipo: 'golpe', sala: si, de: 'm', i: mi, alvo: hs.indexOf(h), acerto: false, critico: false, dano: 0, caiu: false, area: true };
              if (h.L.furtivo) { h.L.furtivo = false; e.sombra = true; }
              else if (rng() * 100 < limitar(80 + ator.indiceArea * 2 - h.s.evasao, 5, 95)) {
                var da = aoReceber(h.L, Math.max(1, Math.round(h.hpMax * ator.area.vidaPct / 100)), ator, rng);
                e.acerto = true; e.dano = da;
                h.hp = Math.max(0, h.hp - da);
                var dr = depoisDeReceber(h.L, h);
                if (dr === 'milagre') e.milagre = true; else if (dr) e.bolso = true;
                e.caiu = h.hp === 0;
              }
              registrar(e);
            });
            continue;
          }
          // Grito de Desafio: os monstros atacam quem provocou.
          var lista = vivos(hs), provocador = lista.filter(function (x) { return x.L.provocaAte >= x.L.turno; })[0];
          var heroi = provocador || lista[Math.floor(rng() * lista.length)];
          ev.alvo = hs.indexOf(heroi);
          if (heroi.L.furtivo) { heroi.L.furtivo = false; ev.sombra = true; }
          else if (rng() * 100 < limitar(80 + ator.indiceArea * 2 - heroi.s.evasao, 5, 95)) {
            var d = aoReceber(heroi.L, danoComDefesa(rolar(ator.ataque, rng), defesaHeroi(heroi.s, heroi.L)), ator, rng);
            ev.acerto = !heroi.L.errouCego; ev.dano = d; heroi.L.errouCego = false;
            heroi.hp = Math.max(0, heroi.hp - d);
            var dr2 = depoisDeReceber(heroi.L, heroi);
            if (dr2 === 'milagre') ev.milagre = true; else if (dr2) ev.bolso = true;
            ev.caiu = heroi.hp === 0;
            ev.caiu = heroi.hp === 0;
          }
        }
        if (ev) registrar(ev);
      }
      if (!vivos(hs).length) return { vitoria: false, sala: si, inicio: inicio, eventos: eventos };
    }
    return { vitoria: true, sala: salas.length - 1, inicio: inicio, eventos: eventos };
  }

  // ---------- Boss da aliança ----------
  // O boss no nível n: { id, nome, hp (vida cheia), ataque, velocidade, defesa, defesaMagica, indiceArea, chefe }.
  function bossAlianca(nivel) {
    var B = D.BOSS_ALIANCA, n = Math.max(1, Math.floor(nivel || 1));
    var ultimo = B.chefes.length - 1, ic = Math.min(Math.floor((n - 1) / B.niveisPorChefe), ultimo);
    var k = n - 1 - ic * B.niveisPorChefe;   // nível dentro do chefe (no último chefe não para de crescer)
    var m = D.monstros[B.chefes[ic]];   // números
    var quem = B.bosses && B.bosses[ic] ? D.monstros[B.bosses[ic].id] : m;   // nome, imagem e descrição
    var extra = Math.max(0, k - (B.niveisPorChefe - 1));
    var fa = B.ataque * (1 + B.ataquePorNivelExtra * extra);
    var titulo = B.titulos[Math.min(k, B.titulos.length - 1)] || '';
    var nomeBase = quem.nome.split(',')[0];
    var P = B.premio, fp = 1 + P.porNivel * k, ouro = Math.round(m.ouro * P.ouro * fp);
    return { id: B.bosses && B.bosses[ic] ? B.bosses[ic].id : B.chefes[ic], indiceChefe: ic, nivel: n,
      nome: nomeBase + (titulo ? ' ' + (B.bosses && B.bosses[ic] && B.bosses[ic].feminino ? titulo.replace(/o$/, 'a') : titulo) : ''),
      nomeCompleto: quem.nome, descricao: quem.descricao, area: B.bosses && B.bosses[ic] && B.bosses[ic].area || null,
      premio: { ouro: ouro, exp: Math.round(m.exp * P.exp * fp), alianca: ouro * P.alianca,
        pergaminho: P.pergaminho.qtd, raridadePergaminho: P.pergaminho.raridade[ic] },
      hp: Math.round(m.hp * B.vida * Math.pow(B.vidaPorNivel, k)),
      ataque: [Math.round(m.ataque[0] * fa), Math.round(m.ataque[1] * fa)],
      velocidade: m.velocidade, defesa: m.defesa, defesaMagica: m.defesaMagica, indiceArea: m.indiceArea, chefe: true };
  }

  // Uma investida contra o boss. hpAtual: vida que o boss ainda tem. Retorna o resultado do motor
  // (vitoria = o boss morreu) com `danos` (dano de cada herói, na ordem) e `dano` (total).
  // buff: % a mais de dano (missões semanais do clã; vem do servidor junto com a investida).
  function simularBossAlianca(herois, nivel, hpAtual, semente, buff) {
    var b = bossAlianca(nivel);
    var boss = Object.assign({}, b, { hpMax: b.hp, hp: Math.max(1, Math.min(b.hp, Math.round(hpAtual))) });
    var r = simularSalas(herois, [[boss]], semente, { limiteAtaques: D.BOSS_ALIANCA.limiteAtaques, buffDano: buff || 0 });
    r.danos = herois.map(function () { return 0; });
    r.eventos.forEach(function (e) { if (e.tipo === 'golpe' && e.de === 'h' && e.acerto) r.danos[e.i] += e.dano; });
    var total = r.danos.reduce(function (a, x) { return a + x; }, 0);
    // o último golpe pode passar da vida que faltava: conta só o que faltava
    if (total > boss.hp) {
      var sobra = total - boss.hp;
      for (var i = r.danos.length - 1; i >= 0 && sobra > 0; i--) { var t = Math.min(sobra, r.danos[i]); r.danos[i] -= t; sobra -= t; }
      total = boss.hp;
    }
    r.dano = total;
    r.boss = b;
    return r;
  }

  // Prêmio de um herói quando o boss morre: { ouro, exp } (exp limitada a expMaxPct% da exp do level do herói).
  function premioBossAlianca(p, nivelBoss) {
    var pr = bossAlianca(nivelBoss).premio;
    return { ouro: pr.ouro, exp: Math.min(pr.exp, Math.floor(expNecessaria(p.nivel) * D.BOSS_ALIANCA.premio.expMaxPct / 100)) };
  }

  // Tabela dos níveis do boss para o servidor (ferramentas/gerar_dados_sql.js): vida cheia e prêmios.
  function tabelaBossAlianca(ate) {
    var t = [];
    for (var n = 1; n <= ate; n++) {
      var b = bossAlianca(n);
      t.push({ hp: b.hp, ouro: b.premio.ouro, exp: b.premio.exp, alianca: b.premio.alianca,
        pergaminho: b.premio.pergaminho, raridade: b.premio.raridadePergaminho });
    }
    return t;
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
    if (skin.historia) return 'Esta skin é prêmio da História (Aventura > História).';
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
      RARIDADES.forEach(function (k) { mudarPergaminho(p, k, quantidade); });
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
    danoComDefesa: danoComDefesa,
    cortePct: cortePct,
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
    trocarPergaminho: trocarPergaminho,
    faixaLeilao: faixaLeilao,
    itemDoLote: itemDoLote,
    proximoLance: proximoLance,
    consumiveis: consumiveis,
    qtdConsumivel: qtdConsumivel,
    mudarConsumivel: mudarConsumivel,
    qtdPergaminho: qtdPergaminho,
    mudarPergaminho: mudarPergaminho,
    pergaminhos: pergaminhos,
    nomeConsumivel: nomeConsumivel,
    proximaRaridade: proximaRaridade,
    chanceEncantar: chanceEncantar,
    riscoEncantar: riscoEncantar,
    encantar: encantar,
    admin: admin,
    status: status,
    poder: poder,
    tracosRaca: tracosRaca,
    distribuirPonto: distribuirPonto,
    ganharExp: ganharExp,
    chefeDoNivel: chefeDoNivel,
    premioChefeMundial: premioChefeMundial,
    itemDoChefeMundial: itemDoChefeMundial,
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
    historiaEstado: historiaEstado, registrarHistoria: registrarHistoria, concluirCapitulo: concluirCapitulo,
    premioHistoriaTexto: premioHistoriaTexto, marcarHistoriaVista: marcarHistoriaVista,
    guiaEstado: guiaEstado, registrarGuia: registrarGuia, verificarGuia: verificarGuia, comecarGuia: comecarGuia, pularGuia: pularGuia,
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
    habLiberada: habLiberada, valorNivel: valorNivel, extrasNivel: extrasNivel, aoReceber: aoReceber, depoisDeReceber: depoisDeReceber,
    novoLutador: novoLutador, kitHabilidades: kitHabilidades, passiva: passiva,
    simularSalas: simularSalas,
    bossAlianca: bossAlianca,
    simularBossAlianca: simularBossAlianca,
    premioBossAlianca: premioBossAlianca,
    skillCla: skillCla, defSkillCla: defSkillCla, bonusCla: bonusCla, precoSkillCla: precoSkillCla,
    ehColetor: ehColetor, ehFerreiro: ehFerreiro, materialDaArea: materialDaArea, materialDoChefe: materialDoChefe, qtdMaterial: qtdMaterial,
    rolarMaterial: rolarMaterial, areaDasMinas: areaDasMinas, iniciarMinas: iniciarMinas, recolherMinas: recolherMinas,
    pararMinas: pararMinas, minerando: minerando, mediaMinas: mediaMinas,
    custoReceita: custoReceita, custoProtecao: custoProtecao, custoForja: custoForja, faltando: faltando,
    fabricarReceita: fabricarReceita, fabricarProtecao: fabricarProtecao, chancesForja: chancesForja, forjar: forjar,
    bonusEncanto: bonusEncanto, chanceEncantarCom: chanceEncantarCom, chanceReliquia: chanceReliquia, podeReliquia: podeReliquia,
    runa: runa, itemForjado: itemForjado, forcaRuna: forcaRuna, bonusRuna: bonusRuna, textoRuna: textoRuna,
    tabelaBossAlianca: tabelaBossAlianca,
    itemBossAlianca: itemBossAlianca,
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
