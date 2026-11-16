// Ações do herói decididas no servidor (plano "tudo no servidor", Henri, nov/2026).
// O jogo manda { acao, args } para a Edge Function `acao`; ela carrega o personagem do banco, roda AQUI a mesma regra
// do jogo (Tanka.regras) e grava o resultado. O navegador não grava mais a ficha inteira para estas ações.
// Cada ação: função (p, args, ctx) que muda o personagem e devolve true, ou um texto com o motivo de não poder.
// Só o que estiver nesta lista é aceito. Usado também pela prévia sem servidor (contas-local.js).
Tanka.servidorAcoes = (function () {
  var R = Tanka.regras, D = Tanka.dados;

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
  };

  // Roda uma ação no personagem `p` (já carregado e normalizado). Devolve {} ou { erro }.
  function executar(p, acao, args, agora) {
    if (!Object.prototype.hasOwnProperty.call(ACOES, acao)) return { erro: 'Ação desconhecida.' };
    if (agora) R.atualizarTempo(p, agora);
    var r;
    try { r = ACOES[acao](p, args, { agora: agora }); } catch (e) { r = 'Pedido inválido.'; }
    if (r !== true) return { erro: typeof r === 'string' ? r : 'Não foi possível.' };
    p.poder = R.poder(p);
    return {};
  }

  return { executar: executar, acoes: Object.keys(ACOES) };
})();
