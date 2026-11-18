// Ações do herói decididas no servidor (plano "tudo no servidor", Henri, nov/2026).
// O jogo manda { acao, args } para a Edge Function `acao`; ela carrega o personagem do banco, roda AQUI a mesma regra
// do jogo (Tanka.regras) e grava o resultado. O navegador não grava mais a ficha inteira para estas ações.
// Cada ação: função (p, args, ctx) que muda o personagem e devolve true, ou um texto com o motivo de não poder.
// Só o que estiver nesta lista é aceito. Usado também pela prévia sem servidor (contas-local.js).
Tanka.servidorAcoes = (function () {
  var R = Tanka.regras, D = Tanka.dados;

  var ITEM_RARIDADE = { comum: 'comum', rara: 'raro', epica: 'épico', lendaria: 'lendário' };
  var TIPOS_CRAFT = ['material', 'receita', 'protecao'];
  function nomeRaridadeItem(item) { return D.raridades[item.raridade].nome + (item.conjunto ? ' · Conjunto' : ''); }
  function nomeDrop(it) { return it.consumivel ? (it.qtd > 1 ? it.qtd + 'x ' : '') + R.nomeConsumivel(it) : R.nomeItem(it); }
  function origemCaixa(o) { return { boss: 'boss', leilao: 'leilao', mercado: 'mercado', oficina: 'oficina', 'boss-alianca': 'cla', torre: 'torre' }[o] || 'masmorra'; }
  function origemCredito(m) {
    m = m || '';
    if (/^Torre/.test(m)) return 'torre';
    return /Arena/.test(m) ? 'arena' : /leilão/.test(m) ? 'leilao' : /^Mercado/.test(m) ? 'mercado' : /clã/.test(m) ? 'cla' : /^Oficina/.test(m) ? 'oficina' : 'arena';
  }

  // Prêmios guardados no servidor (tabela recompensas: masmorra, leilão, mercado, Oficina, chefes): a lista vem do BANCO
  // (a função `acao` busca), nunca do navegador. Aplica no personagem e devolve { entregues: [ids para marcar], avisos }.
  // Item que não cabe na mochila fica guardado (não entra em `entregues`). p.recebidas evita entregar duas vezes.
  function entregarRecompensas(p, lista, rng) {
    var entregues = [], avisos = [], avisouCheia = false;
    var aviso = function (rec, texto, tipo, semCaixa) { avisos.push({ texto: texto, tipo: tipo || '', origem: semCaixa ? null : origemCaixa(rec && rec.origem) }); };
    var cheia = function (rec, texto) { if (!avisouCheia) aviso(rec, texto, '', true); avisouCheia = true; };
    var pegar = function (rec) {
      entregues.push(rec.id);
      p.recebidas = (p.recebidas || []).concat(rec.id).slice(-200);
      return JSON.parse(JSON.stringify(rec.item));
    };
    (Array.isArray(lista) ? lista : []).forEach(function (rec) {
      if (!rec || rec.id == null || !rec.item) return;
      if (p.recebidas && p.recebidas.indexOf(rec.id) >= 0) { entregues.push(rec.id); return; }   // já entregue: só falta marcar
      var it = rec.item;
      if (it.leilao) {   // lote ganho no leilão: gerado da semente (igual ao que todos viram)
        var ganho = R.itemDoLote(it);
        if (ganho.consumivel) { pegar(rec); R.mudarPergaminho(p, ganho.raridade, ganho.qtd); aviso(rec, 'Você venceu o leilão: ' + nomeDrop(ganho) + '! (Mochila › Consumíveis)', 'item'); return; }
        if (R.mochilaCheia(p)) { cheia(rec, 'Mochila cheia! Seu item do leilão está guardado: libere espaço para recebê-lo.'); return; }
        pegar(rec); p.inventario.push(ganho);
        aviso(rec, 'Você venceu o leilão: ' + R.nomeItem(ganho) + ' (' + nomeRaridadeItem(ganho) + ')!', 'item');
        return;
      }
      if (it.tipo === 'boss_premio') {   // Chefe Mundial: ouro e exp
        var bp = pegar(rec), gb = R.premioChefeMundial(p, bp);
        aviso(rec, '🐉 Chefe Mundial' + (bp.venceu ? '' : ' (consolação)') + ': +' + gb.ouro.toLocaleString('pt-BR') + ' de ouro e +' + gb.exp.toLocaleString('pt-BR') + ' de exp!', 'vitoria');
        if (gb.niveis) aviso(rec, 'Level up! Level ' + p.nivel, 'nivel');
        return;
      }
      if (it.tipo === 'titulo') {
        var tit = pegar(rec);
        p.titulos = p.titulos || [];
        if (p.titulos.indexOf(tit.nome) < 0) p.titulos.push(tit.nome);
        p.titulo = tit.nome;
        aviso(rec, '🐉 Novo título: "' + tit.nome + '"!', 'nivel');
        return;
      }
      if (it.tipo === 'pergaminho') {
        var perg = pegar(rec);
        if (!D.raridades[perg.raridade]) return;
        var nPerg = Math.max(1, Math.floor(perg.qtd || 1));
        R.mudarPergaminho(p, perg.raridade, nPerg);
        aviso(rec, (nPerg > 1 ? nPerg + ' Pergaminhos' : 'Um Pergaminho') + ' para item ' + ITEM_RARIDADE[perg.raridade]
          + (perg.boss ? ' do boss do clã!' : rec.origem === 'torre' ? ' da Torre do Eclipse!' : rec.origem === 'boss' ? ' do Chefe Mundial!' : rec.origem === 'mercado' ? ' do mercado chegou!' : ' na masmorra!'), 'item');
        return;
      }
      if (it.tipo === 'forjado') {   // item da Oficina de um Ferreiro, montado com a semente do servidor
        if (R.mochilaCheia(p)) { cheia(rec, 'Mochila cheia! Seu item da Oficina está guardado: libere espaço.'); return; }
        var ifo = R.itemForjado(pegar(rec).spec);
        if (ifo) { p.inventario.push(ifo); aviso(rec, (ifo.obraPrima ? '✨ OBRA-PRIMA! ' : '🔨 ') + 'A Oficina entregou ' + R.nomeItem(ifo) + ' (' + nomeRaridadeItem(ifo) + ')!', 'item'); }
        return;
      }
      if (TIPOS_CRAFT.indexOf(it.tipo) >= 0 || it.tipo === 'cristal') {
        var rcf = pegar(rec), ncf = Math.max(1, Math.floor(rcf.qtd || 1));
        R.mudarConsumivel(p, rcf.tipo, rcf.raridade, ncf);
        aviso(rec, ncf + 'x ' + R.nomeConsumivel({ tipo: rcf.tipo, raridade: rcf.raridade }) + (rec.origem === 'mercado' ? ' do mercado chegou!' : rec.origem === 'oficina' ? ' (Oficina)' : '!'), 'item');
        return;
      }
      if (it.tipo === 'bau') {   // Baú da conta: consumível retirado (Henri, 18/11/2026)
        var rb = pegar(rec), nb = Math.max(1, Math.floor(rb.qtd || 1));
        if (!D.CONSUMIVEIS[rb.ctipo]) return;
        R.mudarConsumivel(p, rb.ctipo, rb.raridade, nb);
        aviso(rec, nb + 'x ' + R.nomeConsumivel({ tipo: rb.ctipo, raridade: rb.raridade }) + ' retirado do Baú da conta.', 'item', true);
        return;
      }
      if (it.tipo === 'exp') {   // boss do clã: exp limitada a uma parte da exp do level
        var rx = pegar(rec);
        var xp = Math.min(Number(rx.valor) || 0, Math.floor(R.expNecessaria(p.nivel) * D.BOSS_ALIANCA.premio.expMaxPct / 100));
        var subiu = R.ganharExp(p, xp);
        aviso(rec, 'Boss do clã derrotado! +' + xp.toLocaleString('pt-BR') + ' de exp.' + (subiu ? ' Você subiu de level!' : ''), 'nivel');
        return;
      }
      if (it.tipo === 'bossItem') {
        if (R.mochilaCheia(p)) { cheia(rec, 'Mochila cheia! Seu item do boss do clã está guardado: libere espaço para recebê-lo.'); return; }
        var ib = R.itemBossAlianca(p, pegar(rec).raridade, rng);
        p.inventario.push(ib);
        aviso(rec, 'Maior dano no boss do clã! Você ganhou ' + R.nomeItem(ib) + ' (' + nomeRaridadeItem(ib) + ')!', 'item');
        return;
      }
      if (R.mochilaCheia(p)) {
        cheia(rec, 'Mochila cheia! Seu item (' + ({ boss: 'Chefe Mundial', mercado: 'mercado', oficina: 'Oficina' }[rec.origem] || 'masmorra') + ') está guardado: libere espaço para recebê-lo.');
        return;
      }
      var bruto = pegar(rec);
      var item = bruto && bruto.tipo === 'boss_item' ? R.itemDoChefeMundial(p, bruto.raridade) : R.completarItem(p, bruto);
      p.inventario.push(item);
      aviso(rec, (rec.origem === 'mercado' ? 'Chegou do mercado: ' : rec.origem === 'oficina' ? 'A Oficina devolveu: ' : 'Você ganhou ') + R.nomeItem(item) + ' (' + nomeRaridadeItem(item) + ')!', 'item');
    });
    return { entregues: entregues, avisos: avisos };
  }
  // Créditos de ouro/reputação (Arena, leilão, mercado, clã, Oficina), também lidos do banco. p.creditosRecebidos evita
  // aplicar duas vezes (grava antes, marca depois).
  function aplicarCreditos(p, lista) {
    var aplicados = [], avisos = [];
    (Array.isArray(lista) ? lista : []).forEach(function (c) {
      if (!c || c.id == null) return;
      aplicados.push(c.id);
      if (p.creditosRecebidos && p.creditosRecebidos.indexOf(c.id) >= 0) return;
      p.creditosRecebidos = (p.creditosRecebidos || []).concat(c.id).slice(-200);
      var ouro = Math.round(Number(c.ouro) || 0), rep = Math.round(Number(c.reputacao) || 0), exp = Math.max(0, Math.round(Number(c.exp) || 0));
      p.ouro = Math.max(0, (p.ouro || 0) + ouro);
      p.reputacao = Math.max(0, (p.reputacao || 0) + rep);
      if (exp) R.ganharExp(p, exp);   // prêmios da Torre
      var partes = [];
      if (ouro) partes.push((ouro > 0 ? '+' : '−') + Math.abs(ouro).toLocaleString('pt-BR') + ' de ouro');
      if (rep) partes.push('+' + rep + ' de reputação');
      if (exp) partes.push('+' + exp.toLocaleString('pt-BR') + ' de EXP');
      var semCaixa = /^(Lance no leilão|Compra no mercado|Fundação do clã|Doação ao tesouro|Oficina: serviço pedido)/.test(c.motivo || '');
      // Mensagem do admin (crédito sem ouro nem reputação, criado pelo SQL Editor): só o texto, na caixa como "Mensagem do Reino".
      if (!ouro && !rep && !exp) { avisos.push({ texto: String(c.motivo || '').replace(/^Mensagem( do Reino)?:\s*/i, ''), tipo: 'nivel', origem: 'admin' }); return; }
      avisos.push({ texto: (c.motivo || 'Crédito') + ': ' + partes.join(' e ') + '.', tipo: '', origem: semCaixa ? null : origemCredito(c.motivo) });
    });
    return { aplicados: aplicados, avisos: avisos };
  }

  function ok(v, padrao) { return v === true ? true : (typeof v === 'string' ? v : padrao); }
  function texto(v) { return typeof v === 'string' ? v : String(v == null ? '' : v); }

  var ACOES = {
    // { for: 2, des: 1, ... }: distribui os pontos de atributo livres
    atributos: function (p, a) {
      a = a && typeof a === 'object' ? a : {};
      var total = 0;
      for (var i = 0; i < R.ATRIBUTOS.length; i++) {
        var k = R.ATRIBUTOS[i], n = Math.floor(Number(a[k]) || 0);
        if (n < 0 || n > 1000) return 'Pedido inválido.';
        total += n;
      }
      if (!total) return 'Nada para distribuir.';
      if (total > (p.pontosLivres || 0)) return 'Sem pontos livres.';
      R.ATRIBUTOS.forEach(function (k) { for (var j = 0; j < (Math.floor(Number(a[k]) || 0)); j++) R.distribuirPonto(p, k); });
      return true;
    },
    // segunda classe (id)
    segundaClasse: function (p, a) { return ok(R.escolherSegundaClasse(p, texto(a)), 'Classe inválida.'); },
    // { idHabilidade: pontos a mais, ... }: confirma pontos de habilidade
    pontosHabilidade: function (p, a) {
      a = a && typeof a === 'object' ? a : {};
      var ids = Object.keys(a);
      if (!ids.length) return 'Nada para confirmar.';
      for (var i = 0; i < ids.length; i++) {
        var n = Math.floor(Number(a[ids[i]]) || 0);
        if (n < 1 || n > D.TALENTOS.maxPorHabilidade) return 'Pedido inválido.';
        for (var j = 0; j < n; j++) {
          var r = R.mudarPontoHabilidade(p, ids[i], 1);
          if (r !== true) return ok(r, 'Não foi possível colocar o ponto.');
        }
      }
      return true;
    },
    // [ids]: pega pontos do Pacto de Ascensão, na ordem (cada um ligado aos anteriores)
    ascensao: function (p, a) {
      a = Array.isArray(a) ? a : [];
      if (!a.length || a.length > 200) return 'Pedido inválido.';
      for (var i = 0; i < a.length; i++) {
        var r = R.comprarAscensao(p, texto(a[i]));
        if (r !== true) return ok(r, 'Não foi possível pegar o ponto.');
      }
      return true;
    },
    refazerAscensao: function (p) { return ok(R.refazerAscensao(p), 'Não foi possível.'); },
    // [modo, id, op]: ordem de uso das habilidades
    ordemHabilidade: function (p, a) {
      a = Array.isArray(a) ? a : [];
      if (['cacada', 'masmorra', 'arena', 'defesa'].indexOf(a[0]) < 0 || ['subir', 'descer', 'tirar', 'por'].indexOf(a[2]) < 0) return 'Pedido inválido.';
      return R.moverHabilidade(p, a[0], texto(a[1]), a[2]) ? true : 'Não foi possível mover.';
    },
    habilidadeAuto: function (p, a) { p.habilidadeAuto = !!a; return true; },
    equipar: function (p, a) {
      var id = texto(a), item = (p.inventario || []).find(function (i) { return i.id === id; });
      if (!item) return 'Item não encontrado.';
      return R.equipar(p, id) ? true : (R.motivoNaoEquipa(p, item) || 'Não foi possível equipar (mochila cheia?).');
    },
    desequipar: function (p, a) {
      var slot = texto(a);
      if (!p.equipados || !Object.prototype.hasOwnProperty.call(p.equipados, slot)) return 'Pedido inválido.';
      return R.desequipar(p, slot) ? true : 'Mochila cheia! Venda algo antes de desequipar.';
    },
    usarSkin: function (p, a) { return R.usarSkin(p, texto(a)) ? true : 'Skin inválida.'; },
    usarRecomeco: function (p) { return ok(R.usarRecomeco(p), 'Não foi possível.'); },
    usarRecomecoHabilidades: function (p) { return ok(R.usarRecomecoHabilidades(p), 'Não foi possível.'); },

    // ---- Etapa 2: Mochila e Mercado ----
    vender: function (p, a) {
      var id = texto(a);
      if (!(p.inventario || []).some(function (i) { return i.id === id; })) return 'Item não encontrado.';
      return R.vender(p, id) ? true : 'Não dá para vender esse item (equipado ou travado?).';
    },
    // [ids]: venda em lote
    venderVarios: function (p, a) {
      if (!Array.isArray(a) || !a.length || a.length > 200) return 'Pedido inválido.';
      var r = R.venderVarios(p, a.map(texto));
      return r && r.vendidos ? true : 'Nenhum item vendido.';
    },
    travarItem: function (p, a) {
      var id = texto(a);
      if (!(p.inventario || []).some(function (i) { return i.id === id; })) return 'Item não encontrado.';
      R.travarItem(p, id);
      return true;
    },
    // [critério, crescente]
    organizarMochila: function (p, a) {
      a = Array.isArray(a) ? a : [];
      if (typeof a[0] !== 'string' || a[0].length > 20) return 'Pedido inválido.';
      R.organizarMochila(p, a[0], !!a[1]);   // critério desconhecido: só não muda a ordem
      return true;
    },
    // { raridade?, tipo, especifico? }: compra no Mercado (o item é sorteado aqui, no servidor)
    comprar: function (p, a) {
      a = a && typeof a === 'object' ? a : {};
      var r = a.raridade ? R.comprar(p, texto(a.raridade), texto(a.tipo), a.especifico ? texto(a.especifico) : undefined)
        : R.comprar(p, texto(a.tipo), a.especifico ? texto(a.especifico) : undefined);
      return typeof r === 'string' ? r : (r ? true : 'Não foi possível comprar.');
    },
    comprarPocao: function (p) { return ok(R.comprarPocao(p), 'Não foi possível comprar.'); },
    comprarPoteEstamina: function (p, a, ctx) { return ok(R.comprarPoteEstamina(p, ctx.agora || Date.now()), 'Não foi possível comprar.'); },
    trocarPergaminho: function (p, a) {
      var r = R.trocarPergaminho(p, texto(a));
      return r && r.erro ? r.erro : true;
    },
    comprarSkin: function (p, a) { return ok(R.comprarSkin(p, texto(a)), 'Skin inválida.'); },
    comprarRecomeco: function (p) { return ok(R.comprarRecomeco(p), 'Não foi possível comprar.'); },
    comprarRecomecoHabilidades: function (p) { return ok(R.comprarRecomecoHabilidades(p), 'Não foi possível comprar.'); },

    // ---- Etapa 3: Forja, Oficina e Minas (sorteios feitos aqui; o resultado volta para a tela animar) ----
    // [itemId, usarProtecao]
    encantar: function (p, a, ctx) {
      a = Array.isArray(a) ? a : [];
      var t = R.encantar(p, texto(a[0]), ctx.rng, !!a[1]);
      if (!t) return 'Não dá para encantar esse item.';
      R.registrarMissao(p, 'encantar', 1, ctx.agora);
      if (t.sucesso) R.registrarMissao(p, 'encantoSucesso', 1, ctx.agora);
      return { resultado: t };
    },
    // { area, classe, tipo, chefe, gemas }
    forjar: function (p, a, ctx) {
      a = a && typeof a === 'object' ? a : {};
      var n = function (v) { return Math.max(0, Math.floor(Number(v) || 0)); };
      var r = R.forjar(p, texto(a.area), texto(a.classe), texto(a.tipo), n(a.chefe), n(a.gemas), ctx.rng);
      return typeof r === 'string' ? r : { resultado: { item: r.item, obraPrima: !!r.obraPrima } };
    },
    fabricarReceita: function (p, a) { return ok(R.fabricarReceita(p, texto(a)), 'Não foi possível fabricar.'); },
    fabricarProtecao: function (p, a) { return ok(R.fabricarProtecao(p, texto(a)), 'Não foi possível fabricar.'); },
    // [opção de tempo, área]
    iniciarMinas: function (p, a, ctx) {
      a = Array.isArray(a) ? a : [];
      return ok(R.iniciarMinas(p, Math.floor(Number(a[0]) || 0), ctx.agora, texto(a[1])), 'Não foi possível minerar.');
    },
    pararMinas: function (p, a, ctx) { var r = R.pararMinas(p, ctx.agora, ctx.rng); return typeof r === 'string' ? r : { resultado: r }; },
    recolherMinas: function (p, a, ctx) { var r = R.recolherMinas(p, ctx.agora, ctx.rng); return typeof r === 'string' ? r : { resultado: r }; },

    // ---- Etapa 4: prêmios e progresso ----
    // Prêmios e créditos guardados no banco: a lista vem de ctx.pendentes (a função `acao` lê do banco; o que o
    // navegador mandar é ignorado). Depois de gravar, a função marca os entregues como recebidos.
    // Baú da conta (Henri, 18/11/2026): só ouro e consumíveis. Tira da ficha e põe na fila bauSaida; a função `acao`
    // manda para o banco (bau_guardar) depois de gravar.
    bauDepositar: function (p, a, ctx) {
      a = a || {};
      var ouro = Math.floor(Number(a.ouro) || 0), qtd = Math.floor(Number(a.qtd) || 0), tipo = texto(a.tipo), rar = texto(a.raridade);
      if (ouro < 0 || qtd < 0) return 'Quantidade inválida.';
      if (!ouro && !qtd) return 'Escolha o que guardar.';
      if (ouro > (p.ouro || 0)) return 'Ouro insuficiente.';
      if (qtd) {
        if (!D.CONSUMIVEIS[tipo] || !rar) return 'Só ouro e consumíveis vão para o baú.';
        if (R.qtdConsumivel(p, tipo, rar) < qtd) return 'Você não tem essa quantidade.';
      }
      p.ouro -= ouro;
      if (qtd) R.mudarConsumivel(p, tipo, rar, -qtd);
      var mov = { id: 'd' + ctx.agora + '-' + Math.floor(ctx.rng() * 1e9), ouro: ouro, tipo: qtd ? tipo : null, raridade: qtd ? rar : null, qtd: qtd };
      p.bauSaida = (Array.isArray(p.bauSaida) ? p.bauSaida : []).concat(mov).slice(-50);
      return { resultado: { deposito: mov } };
    },
    receber: function (p, a, ctx) {
      var pd = ctx.pendentes || {};
      var rec = entregarRecompensas(p, pd.recompensas, ctx.rng), cr = aplicarCreditos(p, pd.creditos);
      return { resultado: { entregues: rec.entregues, creditos: cr.aplicados, avisos: cr.avisos.concat(rec.avisos) } };
    },
    // skills do clã: ctx.cla vem do banco (cacada_bonus)
    sincronizarCla: function (p, a, ctx) {
      if (ctx.cla === undefined) return 'Clã indisponível.';
      if (ctx.cla) p.cla = ctx.cla; else delete p.cla;
      return true;
    },
    // [tipo: 'diarias'|'semanais', id]
    missao: function (p, a, ctx) {
      a = Array.isArray(a) ? a : [];
      var pr = R.resgatarMissao(p, texto(a[0]), texto(a[1]), ctx.agora);
      return pr ? { resultado: pr } : 'Missão ainda não concluída.';
    },
    bauDiario: function (p, a, ctx) { var pr = R.resgatarBonusDiario(p, ctx.agora); return pr ? { resultado: pr } : 'Baú indisponível.'; },
    pegarLogin: function (p, a, ctx) {
      var r = R.pegarLogin(p, ctx.agora, ctx.rng);
      if (!r) return 'Prêmio de hoje já pego.';
      return r.erro ? r.erro : { resultado: r };
    },
    comecarGuia: function (p) { R.comecarGuia(p); return true; },
    pularGuia: function (p) { R.pularGuia(p); return true; },
    // aba aberta (o passo "visite a Loja"); confere o guia
    guiaAba: function (p, a) { R.registrarGuia(p, 'aba', texto(a)); return { resultado: R.verificarGuia(p) }; },
    verificarGuia: function (p) { return { resultado: R.verificarGuia(p) }; },
    historiaVista: function (p) { R.marcarHistoriaVista(p); return true; },
    concluirCapitulo: function (p, a, ctx) {
      var f = R.concluirCapitulo(p, ctx.rng);
      if (!f) return 'Capítulo ainda não concluído.';
      return f.erro ? f.erro : { resultado: f };
    },
    acampar: function (p, a, ctx) { R.acampar(p, ctx.agora, !!a); return true; },
    // Luta da Arena ou masmorra terminou: conta nas missões, no guia e na História. { tipo, luta (Arena) | run (masmorra) }
    // Segurança (nov/2026): o resultado NÃO vem do navegador. A função `acao` confere a luta no banco e passa em
    // ctx.luta = { id, vitoria } (Arena: o herói foi o atacante e a luta acabou) ou { id, masmorra } (masmorra
    // vencida em que ele estava). Sem a luta conferida, não conta. Cada luta conta uma vez só.
    eventoJogo: function (p, a, ctx) {
      a = a && typeof a === 'object' ? a : {};
      var tipo = texto(a.tipo), L = ctx.luta;
      if (tipo !== 'arena' && tipo !== 'masmorra') return 'Pedido inválido.';
      if (!L || !L.id) return { resultado: { ignorado: true } };
      p.eventos = p.eventos || {};
      var vistos = Array.isArray(p.eventos[tipo + 'Ids']) ? p.eventos[tipo + 'Ids'] : [], chave = String(L.id);
      if (vistos.indexOf(chave) >= 0) return { resultado: { ignorado: true } };
      p.eventos[tipo + 'Ids'] = vistos.concat(chave).slice(-30);
      var historia = false;
      if (tipo === 'arena') {
        R.registrarMissao(p, 'arena', 1, ctx.agora);
        if (L.vitoria) R.registrarMissao(p, 'arenaVitoria', 1, ctx.agora);
        R.registrarGuia(p, 'arena');
      } else {
        var mis = R.garantirMissoes(p, ctx.agora);
        if (mis.runs.indexOf(chave) >= 0) return { resultado: { ignorado: true } };
        mis.runs = mis.runs.concat(chave).slice(-20);
        R.registrarMissao(p, 'masmorra', 1, ctx.agora);
        historia = !!R.registrarHistoria(p, 'masmorra', texto(L.masmorra));
      }
      return { resultado: { guia: R.verificarGuia(p), historia: historia } };
    },
    // O que não vale nada (preferências, caixa de entrada, tempo jogado, título já ganho): o resto da ficha é ignorado.
    preferencias: function (p, a) {
      a = a && typeof a === 'object' ? a : {};
      if (a.prefsCacada && typeof a.prefsCacada === 'object') {
        var pc = a.prefsCacada;
        p.prefsCacada = { lutarSempre: !!pc.lutarSempre, pocao: Math.max(0, Math.min(100, Number(pc.pocao) || 0)),
          chefe: ['perguntar', 'lutar', 'fugir'].indexOf(pc.chefe) >= 0 ? pc.chefe : 'perguntar' };
      }
      if (Array.isArray(a.caixa)) p.caixa = a.caixa.slice(0, 60).map(function (c) {
        return { t: Number(c && c.t) || 0, o: texto(c && c.o).slice(0, 20), x: texto(c && c.x).slice(0, 300) };
      });
      if (a.caixaVista != null) p.caixaVista = Number(a.caixaVista) || 0;
      if (a.atividade && typeof a.atividade === 'object') {
        var at = p.atividade || (p.atividade = { logado: 0, cacando: 0 });
        ['logado', 'cacando'].forEach(function (k) { var v = Number(a.atividade[k]); if (v > (at[k] || 0)) at[k] = v; });
      }
      if (a.pactoVisto === true) p.pactoVisto = true;   // já viu o tutorial do Pacto de Ascensão
      if (a.titulo !== undefined) { if (!a.titulo) delete p.titulo; else if ((p.titulos || []).indexOf(a.titulo) >= 0) p.titulo = a.titulo; }
      ['recomecoPresente', 'presenteForcaCacador', 'presenteDestrezaCacador', 'presenteAtributos3'].forEach(function (k) { if (a[k] === 2 && p[k] === 1) p[k] = 2; });   // só "já avisei"
      return true;
    },
  };

  // Roda uma ação no personagem `p` (já carregado e normalizado). Devolve {} ou { erro }.
  // Devolve {} (ou { resultado } nas ações sorteadas) ou { erro }. rng: sorteio de quem chama (servidor: Math.random).
  // extra: o que a função do servidor leu do banco (pendentes, cla).
  function executar(p, acao, args, agora, rng, extra) {
    if (!Object.prototype.hasOwnProperty.call(ACOES, acao)) return { erro: 'Ação desconhecida.' };
    agora = agora || Date.now();
    R.atualizarTempo(p, agora);
    var r;
    var ctx = Object.assign({}, extra || {}, { agora: agora, rng: rng || Math.random });
    try { r = ACOES[acao](p, args, ctx); } catch (e) { r = 'Pedido inválido.'; }
    if (r !== true && !(r && typeof r === 'object' && 'resultado' in r)) return { erro: typeof r === 'string' ? r : 'Não foi possível.' };
    p.poder = R.poder(p);
    return r === true ? {} : { resultado: r.resultado };
  }

  return { executar: executar, acoes: Object.keys(ACOES) };
})();
