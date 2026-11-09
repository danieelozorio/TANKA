// Eldrin — caçada decidida pelo servidor (plano anti-trapaça, etapa 1, Henri nov/2026).
// Este arquivo roda NO SERVIDOR (Edge Function `cacada`, empacotado por ferramentas/gerar_servidor.js) e, só na versão
// de teste sem servidor (contas-local.js), no navegador. Usa as mesmas regras do jogo (regras.js), com o sorteio e o
// relógio de quem chama (no servidor: Math.random e o relógio do servidor).
//
// O personagem guarda:
//   p.encontro       = { monstro, normal, chefe, em, prontoEm }  monstro encontrado e ainda não enfrentado
//   p.cacadaLivreEm  = quando a próxima busca pode começar (fim da luta anterior, no ritmo mais rápido do jogo)
// Ações: encontro (procura um monstro entre os alvos), lutar (luta inteira, prêmios aplicados), fugir.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.servidorCacada = (function () {
  var D = Tanka.dados, R = Tanka.regras;
  var TOLERANCIA = 400;             // ms de folga (o relógio é sempre o do servidor)
  var MS_TURNO = 275;               // um turno animado no modo rápido (o mais curto que o jogo mostra)
  var PAUSA = 450;                  // pausa entre lutas no modo rápido
  var MAX_PASSOS = 800;             // trava de segurança da simulação

  function erro(msg) { return { erro: msg }; }

  // Procura um monstro: escolhe entre os alvos (só os liberados), sorteia o chefe e guarda o encontro.
  function encontro(p, alvos, agora, rng) {
    rng = rng || Math.random;
    R.atualizarTempo(p, agora);
    if (p.acampado) R.acampar(p, agora, false);   // caçar levanta o acampamento
    if (p.minas && agora < p.minas.fim) return erro('Seu herói está minerando: pare a mineração para caçar.');
    if (!R.vidaParaCacar(p)) return erro('Vida baixa demais: é preciso ter mais de ' + D.CACADA.vidaMinima + '% da vida para caçar.');
    if (p.cacadaLivreEm && agora < p.cacadaLivreEm - TOLERANCIA) return erro('Calma: o herói ainda está se recuperando da última luta.');
    return novoEncontro(p, alvos, agora, rng);
  }
  // Sorteia o encontro a partir de `desde` (sem mexer no relógio da vida).
  function novoEncontro(p, alvos, desde, rng) {
    var lista = (Array.isArray(alvos) ? alvos : []).filter(function (id) {
      return D.monstros[id] && !D.monstros[id].chefe && R.podeCacar(p, id) && R.monstroLiberado(p, id);
    });
    if (!lista.length) return erro('Nenhum dos monstros escolhidos pode ser caçado agora.');
    var id = R.escolherMonstroCacada(p, lista, rng);
    if (!id) return erro('Nenhum dos monstros escolhidos pode ser caçado agora.');
    var chefe = R.sortearChefe(p, id, rng);
    var busca = R.tempoBusca(p, id);
    p.encontro = { monstro: chefe || id, normal: id, chefe: !!chefe, em: desde, prontoEm: desde + Math.round(busca / 2) };
    return { encontro: copiaEncontro(p.encontro), busca: busca };
  }
  function copiaEncontro(e) { return e && { monstro: e.monstro, normal: e.normal, chefe: e.chefe, prontoEm: e.prontoEm }; }

  // Fugiu do encontro. Fugir do chefe zera a chance dele; com trocarPorNormal, o encontro vira o monstro normal
  // (o botão "fugir do chefe" da luta avulsa luta contra o monstro que ia aparecer).
  function fugir(p, agora, trocarPorNormal) {
    var e = p.encontro;
    if (!e) return { ok: true };
    if (e.chefe) R.evitarChefe(p, e.monstro);
    if (trocarPorNormal && e.chefe) {
      p.encontro = { monstro: e.normal, normal: e.normal, chefe: false, em: e.em, prontoEm: e.prontoEm };
      return { encontro: copiaEncontro(p.encontro) };
    }
    delete p.encontro;
    return { ok: true };
  }

  // A luta inteira contra o monstro do encontro. bonus = { exp, ouro } do clã (vem do banco).
  // prefs: { pocao: % da vida para beber poção sozinho }. Retorna os eventos (com a vida/poder depois de cada um),
  // o resultado (como R.concluirBatalha) e, se `alvos` vier, já o próximo encontro.
  function lutar(p, agora, rng, bonus, opcoes) {
    rng = rng || Math.random;
    opcoes = opcoes || {};
    var e = p.encontro;
    if (!e) return erro('Nenhum monstro encontrado: procure de novo.');
    if (agora < e.prontoEm - TOLERANCIA) return erro('Calma: o monstro ainda não apareceu.');
    R.atualizarTempo(p, agora);
    if (p.hpAtual <= 0) { delete p.encontro; return erro('Você está sem vida. Espere a vida voltar, acampe ou use uma poção.'); }
    var primeiraVez = !(p.abates[e.monstro] || 0);
    var b = R.iniciarBatalha(p, e.monstro, rng);
    var pref = Number(opcoes.pocao != null ? opcoes.pocao : (p.prefsCacada && p.prefsCacada.pocao)) || 0;
    var eventos = [];
    for (var n = 0; !b.fim && n < MAX_PASSOS; n++) {
      if (R.precisaPocao(b, pref)) R.beberPocao(b);
      var ev = R.passo(b);
      if (!ev) break;
      eventos.push({ ev: ev, jh: b.jogador.hp, jm: b.jogador.hpMax, mh: b.monstro.hp, po: b.jogador.poder, pc: b.pocoes,
        at: b.monstro.atordoado || 0, tu: b.lutador ? b.lutador.turno : 0, pr: b.lutador ? Object.assign({}, b.lutador.pronto) : null });
    }
    if (!b.fim) b.fim = 'fuga';   // não acabou na trava: conta como fuga (sem prêmio)
    var res = R.concluirBatalha(p, b, agora, bonus || { exp: 0, ouro: 0 });
    var extras = { primeiraVez: primeiraVez, historia: false };
    if (res.resultado === 'vitoria') {
      R.registrarMissao(p, 'abate', 1, agora);
      if (D.monstros[b.monstroId].chefe) R.registrarMissao(p, 'chefe', 1, agora);
      extras.historia = !!R.registrarHistoria(p, 'abate', b.monstroId);
      R.registrarGuia(p, 'abate');
    }
    delete p.encontro;
    p.cacadaLivreEm = agora + eventos.length * MS_TURNO + PAUSA;
    var saida = { monstroId: b.monstroId, normal: e.normal, chefe: e.chefe, eventos: eventos, res: limparRes(res), extras: extras };
    // Caçada contínua: o próximo encontro já vem junto (1 pedido por luta). A busca começa quando a luta acabar.
    if (opcoes.alvos && res.resultado !== 'derrota' && opcoes.continuar !== false) {
      var prox = !R.vidaParaCacar(p) ? erro('Vida baixa: a caçada parou. Espere a vida voltar, acampe ou use uma poção.')
        : novoEncontro(p, opcoes.alvos, p.cacadaLivreEm, rng);
      if (prox.encontro) { saida.proximo = prox.encontro; saida.busca = prox.busca; } else saida.parou = prox.erro;
    }
    return saida;
  }
  // O resultado vai pela internet: só dados (os itens já estão na mochila do personagem devolvido).
  function limparRes(res) { return JSON.parse(JSON.stringify(res)); }

  return { encontro: encontro, lutar: lutar, fugir: fugir, TOLERANCIA: TOLERANCIA };
})();
