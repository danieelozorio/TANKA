// Eldrin — caçada decidida pelo servidor (plano anti-trapaça, etapa 1, Henri nov/2026).
// Este arquivo roda NO SERVIDOR (Edge Function `cacada`, empacotado por ferramentas/gerar_servidor.js) e, só na versão
// de teste sem servidor (contas-local.js), no navegador. Usa as mesmas regras do jogo (regras.js), com o sorteio e o
// relógio de quem chama (no servidor: Math.random e o relógio do servidor).
//
// O personagem guarda:
//   p.encontro       = { monstro, normal, chefe, em, prontoEm }  monstro encontrado e ainda não enfrentado
//   p.estamina       = { pts, em, potes }  cada luta gasta a estamina do monstro (R.custoEstamina); a vida começa cheia
//   p.cacadaLivreEm  = quando a próxima busca pode começar (fim da luta anterior, no ritmo mais rápido do jogo)
//   p.luta           = luta em andamento (luta em etapas, Daniel nov/2026): { monstro, normal, chefe, semente, inicio,
//                      pocoes: [turnos em que o jogador bebeu], auto, bonus, heroi (cópia do herói no começo), primeiraVez }
// Ações: encontro (procura um monstro entre os alvos), lutar, pocao, fim, fugir.
// Luta em etapas (`opcoes.etapas`): `lutar` começa a luta e devolve os eventos SEM dar prêmio; `pocao` bebe uma poção num
// turno (a luta é refeita com a mesma semente, então tudo antes dele é igual); `fim` aplica o resultado, só depois do
// tempo da luta. Luta largada no meio é terminada sozinha (com a poção automática) na próxima ação da caçada.
// Sem `etapas` (jogo antigo, ainda no cache): a luta inteira com os prêmios de uma vez, como antes.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.servidorCacada = (function () {
  var D = Tanka.dados, R = Tanka.regras;
  var TOLERANCIA = 400;             // ms de folga (o relógio é sempre o do servidor)
  var MS_TURNO = 275;               // um turno animado no modo rápido (o mais curto que o jogo mostra)
  var PAUSA = 450;                  // pausa entre lutas no modo rápido
  var MAX_PASSOS = 800;             // trava de segurança da simulação

  var SEM_ESTAMINA = 'Sem estamina: acampe, espere encher ou use um pote de estamina (Mercado).';
  // Sorteio com semente (mulberry32): a mesma semente refaz a mesma luta.
  function sorteioSemente(semente) {
    var a = semente >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function erro(msg, espera) { var e = { erro: msg }; if (espera > 0) e.espera = Math.ceil(espera); return e; }

  // Procura um monstro: escolhe entre os alvos (só os liberados), sorteia o chefe e guarda o encontro.
  function encontro(p, alvos, agora, rng) {
    rng = rng || Math.random;
    var pend = fecharPendente(p, agora);
    if (pend) return pend;
    R.atualizarTempo(p, agora);
    if (p.acampado) R.acampar(p, agora, false);   // caçar levanta o acampamento
    if (p.minas && agora < p.minas.fim) return erro('Seu herói está minerando: pare a mineração para caçar.');
    if (!R.estaminaParaCacar(p)) return erro(SEM_ESTAMINA);
    if (p.cacadaLivreEm && agora < p.cacadaLivreEm - TOLERANCIA) return erro('Calma: o herói ainda está se recuperando da última luta.', p.cacadaLivreEm - agora);
    // Já tem um monstro encontrado entre esses alvos: é o mesmo (pedir de novo não sorteia outro chefe).
    var e = p.encontro;
    if (e && D.monstros[e.monstro] && R.custoEstamina(e.monstro) > R.estamina(p).pts) { delete p.encontro; e = null; }   // a estamina não paga mais
    if (e && Array.isArray(alvos) && alvos.indexOf(e.normal) >= 0 && D.monstros[e.monstro]) {
      return { encontro: copiaEncontro(e), busca: R.tempoBusca(p, e.normal) };
    }
    if (e && agora < e.prontoEm - TOLERANCIA) return erro('Calma: o herói ainda está procurando.', e.prontoEm - agora);
    return novoEncontro(p, alvos, agora, rng);
  }
  // Sorteia o encontro a partir de `desde` (sem mexer no relógio da vida).
  function novoEncontro(p, alvos, desde, rng) {
    var lista = (Array.isArray(alvos) ? alvos : []).filter(function (id) {
      return D.monstros[id] && !D.monstros[id].chefe && R.podeCacar(p, id) && R.monstroLiberado(p, id);
    });
    if (!lista.length) return erro('Nenhum dos monstros escolhidos pode ser caçado agora.');
    // só os monstros que a estamina paga
    var pts = R.estamina(p).pts;
    lista = lista.filter(function (id) { return R.custoEstamina(id) <= pts; });
    if (!lista.length) return erro(SEM_ESTAMINA);
    var id = R.escolherMonstroCacada(p, lista, rng);
    if (!id) return erro('Nenhum dos monstros escolhidos pode ser caçado agora.');
    var area = D.areas[D.monstros[id].indiceArea];
    // o chefe só aparece se a estamina paga a luta contra ele
    var chefe = area && R.custoEstamina(area.chefe.id) <= pts ? R.sortearChefe(p, id, rng) : null;
    var busca = R.tempoBusca(p, id);
    p.encontro = { monstro: chefe || id, normal: id, chefe: !!chefe, em: desde, prontoEm: desde + Math.round(busca / 2) };
    return { encontro: copiaEncontro(p.encontro), busca: busca };
  }
  function copiaEncontro(e) { return e && { monstro: e.monstro, normal: e.normal, chefe: e.chefe, prontoEm: e.prontoEm }; }

  // Fugiu do encontro. Fugir do chefe zera a chance dele; com trocarPorNormal, o encontro vira o monstro normal
  // (o botão "fugir do chefe" da luta avulsa luta contra o monstro que ia aparecer).
  function fugir(p, agora, trocarPorNormal) {
    var pend = fecharPendente(p, agora);
    if (pend) return pend;
    var e = p.encontro;
    if (!e) return { ok: true };
    if (e.chefe) R.evitarChefe(p, e.monstro);
    // Fugir não acelera a caçada: a próxima busca só começa quando este monstro apareceria.
    p.cacadaLivreEm = Math.max(p.cacadaLivreEm || 0, e.prontoEm);
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
    var pend = fecharPendente(p, agora);
    if (pend) return pend;
    var e = p.encontro;
    if (!e) return erro('Nenhum monstro encontrado: procure de novo.');
    if (agora < e.prontoEm - TOLERANCIA) return erro('Calma: o monstro ainda não apareceu.', e.prontoEm - agora);
    R.atualizarTempo(p, agora);
    if (R.estamina(p).pts < R.custoEstamina(e.monstro)) { delete p.encontro; return erro(SEM_ESTAMINA); }
    var pref = Number(opcoes.pocao != null ? opcoes.pocao : (p.prefsCacada && p.prefsCacada.pocao)) || 0;
    if (opcoes.etapas) return comecarLuta(p, e, agora, rng, bonus, pref);
    var primeiraVez = !(p.abates[e.monstro] || 0);
    var b = R.iniciarBatalha(p, e.monstro, rng);
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
      var prox = novoEncontro(p, opcoes.alvos, p.cacadaLivreEm, rng);
      if (prox.encontro) { saida.proximo = prox.encontro; saida.busca = prox.busca; } else saida.parou = prox.erro;
    }
    return saida;
  }
  // ---- Luta em etapas ----
  // Cópia do herói no começo da luta (a luta é refeita a partir dela; trocar de equipamento no meio não muda nada).
  function copiaHeroi(p) {
    var ids = Object.keys(p.equipados || {}).map(function (k) { return p.equipados[k]; }).filter(Boolean);
    var h = {};
    Object.keys(p).forEach(function (k) { if (k !== 'luta' && k !== 'encontro' && k !== 'inventario') h[k] = p[k]; });
    h.inventario = (p.inventario || []).filter(function (it) { return ids.indexOf(it.id) >= 0; });
    return JSON.parse(JSON.stringify(h));
  }
  // Refaz a luta: mesma semente, poção automática e as poções que o jogador bebeu (cada uma antes do evento do turno).
  // extra: turno de uma poção nova (para conferir se dá para beber nele).
  function simular(luta, extra) {
    var b = R.iniciarBatalha(JSON.parse(JSON.stringify(luta.heroi)), luta.monstro, sorteioSemente(luta.semente));
    var manuais = (luta.pocoes || []).slice();
    if (extra != null) manuais.push(extra);
    var eventos = [], falhou = false;
    for (var n = 0; !b.fim && n < MAX_PASSOS; n++) {
      if (R.precisaPocao(b, luta.auto)) R.beberPocao(b);
      if (manuais.indexOf(n) >= 0) {
        if (b.pocaoPendente || !R.beberPocao(b)) { if (n === extra) falhou = true; }   // já bebendo, vida cheia ou sem poção
      }
      var ev = R.passo(b);
      if (!ev) break;
      eventos.push({ ev: ev, jh: b.jogador.hp, jm: b.jogador.hpMax, mh: b.monstro.hp, po: b.jogador.poder, pc: b.pocoes,
        at: b.monstro.atordoado || 0, tu: b.lutador ? b.lutador.turno : 0, pr: b.lutador ? Object.assign({}, b.lutador.pronto) : null });
    }
    if (extra != null && extra >= eventos.length) falhou = true;
    if (!b.fim) b.fim = 'fuga';   // não acabou na trava: conta como fuga (sem prêmio)
    return { b: b, eventos: eventos, falhou: falhou };
  }
  function comecarLuta(p, e, agora, rng, bonus, pref) {
    var luta = { monstro: e.monstro, normal: e.normal, chefe: !!e.chefe, semente: Math.floor(rng() * 4294967296),
      inicio: agora, pocoes: [], auto: pref, bonus: bonus || { exp: 0, ouro: 0 }, heroi: copiaHeroi(p),
      primeiraVez: !(p.abates[e.monstro] || 0) };
    var sim = simular(luta);
    luta.total = sim.eventos.length;
    p.luta = luta;
    delete p.encontro;
    p.cacadaLivreEm = agora + sim.eventos.length * MS_TURNO + PAUSA;
    return { monstroId: luta.monstro, normal: luta.normal, chefe: luta.chefe, eventos: sim.eventos, etapas: true };
  }
  // O jogador bebeu uma poção no turno `turno` (índice do próximo evento que ia aparecer na tela).
  function pocao(p, agora, turno) {
    var luta = p.luta;
    if (!luta) return erro('Nenhuma luta em andamento.');
    turno = Number(turno);
    if (!(turno >= 0) || Math.floor(turno) !== turno) return erro('Pedido inválido.');
    var ultimo = (luta.pocoes || []).length ? luta.pocoes[luta.pocoes.length - 1] : -1;
    if (turno <= ultimo) return erro('Você acabou de beber uma poção.');
    var sim = simular(luta, turno);
    if (sim.falhou) return erro('Não dá para beber agora (vida cheia, sem poções ou a luta já acabou).');
    luta.pocoes = (luta.pocoes || []).concat([turno]);
    luta.total = sim.eventos.length;
    p.cacadaLivreEm = luta.inicio + sim.eventos.length * MS_TURNO + PAUSA;
    return { eventos: sim.eventos, turno: turno };
  }
  // Aplica o resultado da luta em andamento (só depois do tempo dela, no ritmo mais rápido do jogo).
  function terminarLuta(p, agora) {
    var luta = p.luta;
    var sim = simular(luta);
    var fim = luta.inicio + sim.eventos.length * MS_TURNO;
    if (agora < fim - TOLERANCIA) return erro('A luta ainda não acabou.', fim - agora);
    R.atualizarTempo(p, agora);
    var pocoesAgora = Number(p.pocoes) || 0, usadas = Math.max(0, (Number(luta.heroi.pocoes) || 0) - sim.b.pocoes);
    var res = R.concluirBatalha(p, sim.b, agora, luta.bonus);
    p.pocoes = Math.max(0, pocoesAgora - usadas);   // comprou poção no meio da luta: não perde
    var extras = { primeiraVez: luta.primeiraVez, historia: false };
    if (res.resultado === 'vitoria') {
      R.registrarMissao(p, 'abate', 1, agora);
      if (D.monstros[luta.monstro].chefe) R.registrarMissao(p, 'chefe', 1, agora);
      extras.historia = !!R.registrarHistoria(p, 'abate', luta.monstro);
      R.registrarGuia(p, 'abate');
    }
    delete p.luta;
    p.cacadaLivreEm = fim + PAUSA;
    return { monstroId: luta.monstro, normal: luta.normal, chefe: luta.chefe, res: limparRes(res), extras: extras };
  }
  // Fim da luta pedido pelo jogo: o resultado e, se a caçada continua, o próximo encontro.
  function fim(p, agora, rng, opcoes) {
    opcoes = opcoes || {};
    rng = rng || Math.random;
    if (!p.luta) return erro('Nenhuma luta em andamento.');
    var saida = terminarLuta(p, agora);
    if (saida.erro) return saida;
    if (opcoes.alvos && saida.res.resultado !== 'derrota' && opcoes.continuar !== false) {
      var prox = novoEncontro(p, opcoes.alvos, Math.max(agora, p.cacadaLivreEm), rng);
      if (prox.encontro) { saida.proximo = prox.encontro; saida.busca = prox.busca; } else saida.parou = prox.erro;
    }
    return saida;
  }
  // Luta largada no meio (fechou o jogo, parou a caçada): termina sozinha antes de qualquer outra ação da caçada.
  function fecharPendente(p, agora) {
    if (!p.luta) return null;
    var r = terminarLuta(p, agora);
    return r.erro ? r : null;
  }

  // O resultado vai pela internet: só dados (os itens já estão na mochila do personagem devolvido).
  function limparRes(res) { return JSON.parse(JSON.stringify(res)); }

  return { encontro: encontro, lutar: lutar, pocao: pocao, fim: fim, fugir: fugir, sorteioSemente: sorteioSemente, TOLERANCIA: TOLERANCIA };
})();
