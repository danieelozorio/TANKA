// Tanka — interface: telas de login, personagens, criação e jogo.
(function () {
  var D = Tanka.dados, R = Tanka.regras, C = Tanka.contas, F = Tanka.retratos;
  var app = document.getElementById('app');
  var aviso = document.getElementById('aviso');

  var estado = {
    conta: null,
    personagem: null,
    aba: 'cacar',
    subAba: {},          // última sub-aba aberta em cada grupo (Herói, Aventura, Social)
    criacao: null,       // { nome, raca, classe }
    batalha: null,
    registro: [],
    resultado: null,
    timer: null,
    rapido: false,
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Avisos: selos que entram pelo canto e somem sozinhos (não empurram a tela).
  // tipo: '' (aviso), 'vitoria', 'nivel', 'item' ou 'ruim'.
  // Vibração curta no celular (golpes fortes, level up). Navegadores sem suporte ignoram.
  function vibrar(padrao) { try { if (navigator.vibrate) navigator.vibrate(padrao); } catch (e) { /* sem vibração */ } }
  function avisar(msg, tipo) {
    if (tipo === 'nivel' && document.documentElement.hasAttribute('data-celular')) vibrar([40, 60, 90]);
    guardarNotificacao(msg, tipo);
    aviso.hidden = false;
    var selo = document.createElement('div');
    selo.className = 'selo-aviso' + (tipo ? ' selo-' + tipo : '');
    selo.textContent = msg;
    aviso.appendChild(selo);
    while (aviso.children.length > 4) aviso.firstChild.remove();
    setTimeout(function () { selo.classList.add('saindo'); }, 3400);
    setTimeout(function () { selo.remove(); if (!aviso.children.length) aviso.hidden = true; }, 3900);
  }

  function marca() {
    return '<header class="marca"><h1><img class="logo-marca" src="assets/logo-eldrin.webp" alt="' + D.NOME_JOGO + ' — ' + D.SUBTITULO + '"></h1></header>';
  }
  // Fundo da tela de entrada: vídeo pintado (céu, ruínas, pinheiros e névoa) com brasas subindo por cima.
  // O cenário fica fora do #app: trocar entre Entrar e Cadastrar não recomeça o vídeo.
  var cenarioEl = null;
  function mostrarCenario(sim) {
    desenharMissoes(false);
    if (sim && !cenarioEl) {
      var tmp = document.createElement('div');
      tmp.innerHTML = cenarioEntrada();
      cenarioEl = tmp.firstChild;
      document.body.insertBefore(cenarioEl, document.body.firstChild);
    } else if (!sim && cenarioEl) {
      cenarioEl.remove();   // fora da entrada o vídeo não fica rodando à toa
      cenarioEl = null;
    }
  }
  function cenarioEntrada() {
    var brasas = '';
    for (var i = 0; i < 18; i++) {
      brasas += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;animation-delay:-' + (Math.random() * 9).toFixed(1) + 's;animation-duration:'
        + (6 + Math.random() * 6).toFixed(1) + 's;--deriva:' + Math.round(Math.random() * 80 - 40) + 'px;--tam:' + (2 + Math.random() * 3).toFixed(1) + 'px"></i>';
    }
    // Vídeo pintado (repete sem emenda); sem vídeo ou com "menos animação", fica a imagem parada.
    var video = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? ''
      : '<video class="video-fundo" autoplay muted loop playsinline preload="auto" poster="assets/fundo-entrada.webp?v=2">'
        + '<source src="assets/fundo-entrada.webm?v=2" type="video/webm"><source src="assets/fundo-entrada.mp4?v=2" type="video/mp4"></video>';
    return '<div class="cenario" aria-hidden="true">' + video
      + '<div class="nevoa"></div><div class="brasas-entrada">' + brasas + '</div></div>';
  }
  function rodape() {
    return '<footer class="rodape">' + D.DOMINIO + '</footer>';
  }
  function topo(extra, abas, menu) {
    return '<header class="topo"><span class="logo">' + D.NOME_JOGO.toUpperCase() + '</span>'
      + (abas || '') + '<div class="acoes"><span class="suave">' + esc(estado.conta.usuario) + '</span>'
      + (ehAdmin() ? '<span class="selo selo-admin">ADMIN</span>' : '') + (extra || '')
      + (menu || '<button class="btn secundario" data-acao="sair">Sair</button>') + '</div></header>';
  }
  // `chave` lembra a largura anterior da barra: quando a vida cai, um rastro claro some devagar até o valor novo.
  var larguras = {};
  function barra(classe, atual, max, texto, chave) {
    var pct = max > 0 ? Math.max(0, Math.min(100, (atual / max) * 100)) : 0;
    var rastro = '';
    if (chave) {
      var antes = larguras[chave];
      larguras[chave] = pct;
      if (antes !== undefined && antes > pct) rastro = '<s style="--de:' + antes + '%;--ate:' + pct + '%"></s>';
    }
    return '<div class="barra ' + classe + '">' + rastro + '<i style="width:' + pct + '%"></i><b>' + texto + '</b></div>';
  }
  function fmt(n) { return Number.isInteger(n) ? n : n.toFixed(1); }
  function dano(d) { return d[0] === d[1] ? d[0] : d[0] + '–' + d[1]; }

  // Faixa de brilho do encantamento: +4 a +6 azul, +7 a +9 roxo, +10 dourado.
  // Classe do brilho da borda do quadro: um tom por nível (+1 a +10).
  // Cor do item: sempre a da raridade (a peça de conjunto também). O nome da raridade ganha "· Conjunto".
  function corItem(item) { return item.raridade; }
  function nomeRaridadeItem(item) { return D.raridades[item.raridade].nome + (item.conjunto ? ' · Conjunto' : ''); }
  function aura(item) {
    var e = item.encanto || 0;
    return e > 0 ? ' aura-e' + Math.min(10, e) : '';
  }

  function brilho(item) {
    var e = item.encanto || 0;
    return e >= 10 ? 'dourado' : e >= 7 ? 'roxo' : e >= 4 ? 'azul' : e >= 1 ? 'prata' : '';
  }

  // Nome do item com cor da raridade e brilho do encantamento.
  function nomeItemHtml(item) {
    var b = brilho(item);
    return '<span class="raridade-' + corItem(item) + (b ? ' brilho-' + b : '') + '">' + esc(R.nomeItem(item)) + '</span>';
  }

  // "Pergaminho para item raro/épico..." (concorda com "item").
  var ITEM_RARIDADE = { comum: 'comum', rara: 'raro', epica: 'épico', lendaria: 'lendário' };

  function tipoItem(item) {
    if (item.tipo === 'arma') return R.tipoArma(item).nome;
    if (item.tipo === 'secundaria') return 'Mão esquerda · ' + D.MAO_ESQUERDA[item.mao].nome;
    return R.definicao(item).tipo;
  }
  // Linhas extras da arma: mãos, velocidade e o que a raridade dá (atributo, PvE, PvP).
  function extrasArma(item) {
    var t = R.tipoArma(item), i = Object.keys(D.raridades).indexOf(item.raridade), RA = D.RARIDADE_ARMA;
    var atr = D.classes[item.classe] && D.classes[item.classe].atributoDano;
    var l = [t.duasMaos ? 'Duas mãos (ocupa a mão esquerda)' : 'Uma mão', 'Velocidade: ' + D.NOME_VELOCIDADE[t.vel]
      + (t.fator !== 1 ? ' · dano x' + String(t.fator).replace('.', ',') : '')];
    var e = item.extras;
    if (e) {   // arma por nível: extras da faixa
      Object.keys(e.atributos || {}).forEach(function (k) { l.push('+' + e.atributos[k] + ' de ' + D.atributos[k].nome); });
      if (e.pve) l.push('+' + e.pve + '% de dano contra monstros');
      if (e.pvp) l.push('+' + e.pvp + '% de dano na Arena');
      if (e.hab) {
        var c2 = R.segundaClasse(estado.personagem), h = c2 && c2.habilidades[e.hab.i];
        l.push('+' + e.hab.n + ' ponto' + (e.hab.n > 1 ? 's' : '') + ' em ' + (h ? h.nome : 'habilidade nº ' + (e.hab.i + 1) + ' da segunda classe') + ' (passa do limite de 10)');
      }
    } else {
      if (RA.atributo[i]) l.push('+' + RA.atributo[i] + ' de ' + D.atributos[atr].nome);
      if (RA.pve[i]) l.push('+' + RA.pve[i] + '% de dano contra monstros');
      if (RA.pvp[i]) l.push('+' + RA.pvp[i] + '% de dano na Arena');
    }
    if (t.proibe) l.push('Não combina com: ' + t.proibe.map(function (m) { return D.MAO_ESQUERDA[m].nome; }).join(', '));
    return l;
  }

  // Resumo do que o item dá: "Dano 3–5" ou "Defesa +5 · Vida +25".
  function descricaoItem(item) {
    if (item.tipo === 'arma') {
      var t = R.tipoArma(item);
      return 'Dano ' + dano(R.danoArma(item)) + (item.variacao === undefined ? ' (sorteado)' : '') + ' · ' + D.NOME_VELOCIDADE[t.vel] + (t.duasMaos ? ' · duas mãos' : '');
    }
    // Modelo do Mercado (ainda não sorteado): mostra a faixa de cada bônus e o atributo extra.
    if (!item.id && R.definicao(item)) {
      var idx = Object.keys(D.raridades).indexOf(item.raridade), def = R.definicao(item), ex = D.VARIACAO_ITEM.extra[item.raridade];
      return Object.keys(def.bonus).map(function (k) {
        var f = (def.fixos || []).indexOf(k) >= 0 ? [def.bonus[k][idx], def.bonus[k][idx]] : R.faixaBonus(def.bonus[k][idx]);
        return D.bonus[k] + ' +' + (f[0] === f[1] ? f[0] : f[0] + '–' + f[1]);
      }).concat(ex ? ['+1 atributo sorteado (+' + ex[0] + '–' + ex[1] + ')'] : []).join(' · ');
    }
    var b = R.bonusItem(item);
    return Object.keys(b).map(function (k) { return D.bonus[k] + ' +' + b[k]; }).join(' · ');
  }

  // Quadradinho com ícone, borda da raridade, brilho do encantamento e "+N".
  function quadroItem(item, classe, atributos) {
    var b = brilho(item);
    return '<button class="' + classe + ' borda-' + corItem(item) + aura(item)
      + (estado.itemFoco === item.id ? ' focado' : '') + '" data-acao="item" data-id="' + item.id + '"'
      + ' title="' + esc(R.nomeItem(item)) + '"' + (atributos || '') + '>'
      + F.icone(item) + (item.encanto ? '<span class="nivel-encanto">+' + item.encanto + '</span>' : '')
      + (item.travado ? '<span class="cadeado" title="Travado">' + ICONES.cadeado + '</span>' : '') + '</button>';
  }

  // Dispositivo com mouse: clicar equipa e passar o mouse mostra a ficha. No toque, tocar mostra a ficha.
  var temMouse = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);

  // Texto da habilidade com os valores do nível atual (1 a 4).
  function textoHabilidade(classe, nivel) {
    var H = D.habilidades[classe], i = nivel - 1;
    if (classe === 'cavaleiro') return 'Dano x' + fmtDec(H.multiplicador[i]) + ' e atordoa o monstro por ' + H.atordoa[i] + ' ação(ões).';
    if (classe === 'arqueiro') return H.flechas[i] + ' flechas seguidas, cada uma com +' + H.bonusCritico[i] + '% de chance de crítico.';
    if (classe === 'mago') return 'Dano x' + fmtDec(H.multiplicador[i]) + ', sempre acerta e ignora a defesa mágica.';
    return 'Dano x' + fmtDec(H.multiplicador[i]) + ' ignorando a defesa; ' + H.quebraArmadura[i] + '% (+Sorte) de quebrar a armadura (+25% de dano até o fim da luta).';
  }
  function fmtDec(n) { return String(n).replace('.', ','); }

  function ehAdmin() {
    return !!estado.conta && !!estado.conta.admin;
  }

  function salvar() {
    estado.personagem.poder = R.poder(estado.personagem);   // vai junto para o ranking
    try {
      C.salvarPersonagem(estado.personagem).catch(function (e) { if (!e.conflito) avisar('Não foi possível salvar: ' + e.message); });
    } catch (e) { avisar(e.message); }
  }
  // Outra aba ou aparelho salvou este personagem depois desta aba: em vez de gravar a cópia velha por cima,
  // avisa e recarrega a página, que busca o progresso mais novo no servidor.
  if (C.aoConflito) C.aoConflito(function () {
    var recarregar = function () {
      avisar('Este personagem foi jogado em outra aba ou aparelho. Carregando o progresso mais novo...');
      setTimeout(function () { location.reload(); }, 2500);
    };
    if (!C.sessaoVale) return recarregar();
    C.sessaoVale().then(function (vale) {   // a conta foi aberta em outro aparelho: logout em vez de recarregar
      if (vale) recarregar(); else sairDaConta('Sua conta foi aberta em outro dispositivo. Entre de novo para jogar aqui.');
    }, recarregar);
  });

  // ---------------- Uma sessão por conta (Henri, 13/11/2026) ----------------
  // Entrar com a senha num aparelho tira a conta dos outros: a cada 30 s (e ao voltar para a aba) o jogo pergunta ao
  // servidor se este navegador ainda é o da conta; se não for, faz logout e volta para o login.
  function sairDaConta(motivo) {
    clearTimeout(estado.timer);
    if (estado.cacada) { pararTimersCacada(); estado.cacada = null; }
    encerrarAtividade();
    C.sair();
    estado = Object.assign(estado, { conta: null, personagem: null, batalha: null, resultado: null });
    guardarJogo();
    telaAuth('entrar', motivo);
  }
  var conferindoSessao = false;
  function conferirSessao() {
    if (!C.sessaoVale || !estado.conta || conferindoSessao || document.visibilityState === 'hidden') return;
    conferindoSessao = true;
    C.sessaoVale().then(function (vale) {
      conferindoSessao = false;
      if (!vale && estado.conta) sairDaConta('Sua conta foi aberta em outro dispositivo. Entre de novo para jogar aqui.');
    }, function () { conferindoSessao = false; });
  }
  setInterval(conferirSessao, 30000);
  setTimeout(conferirSessao, 4000);   // ao abrir a página com a sessão guardada
  document.addEventListener('visibilitychange', conferirSessao);

  // ---------------- Login / cadastro ----------------

  function telaAuth(modo, erro) {
    chatVisivel(false);
    var cadastro = modo === 'cadastro', esqueci = modo === 'esqueci';
    var nomeForm = cadastro ? 'cadastro' : esqueci ? 'esqueci' : 'entrar';
    var form = esqueci
      ? '<form data-form="esqueci" novalidate><p class="suave pequeno">Informe o usuário e o e-mail do cadastro. Um administrador vai mandar uma senha temporária para esse e-mail; ao entrar com ela, você cria uma senha nova.</p>'
        + '<label>Nome de usuário<input name="usuario" autocomplete="username" required></label>'
        + '<label>E-mail do cadastro<input name="email" type="email" autocomplete="email" required></label>'
        + '<p class="erro">' + esc(erro || '') + '</p>'
        + '<button class="btn largo" type="submit">Pedir nova senha</button>'
        + '<button class="link-senha" type="button" data-acao="auth" data-modo="entrar">Voltar para entrar</button></form>'
      : cadastro
      ? '<form data-form="cadastro" novalidate>'
        + '<label>Nome de usuário<input name="usuario" autocomplete="username" required maxlength="16" pattern="[A-Za-z0-9_]{3,16}" data-so-usuario autocapitalize="none" spellcheck="false"></label>'
        + '<p class="suave pequeno">De 3 a 16 caracteres: letras, números ou _ (sem espaços, pontos ou acentos).</p>'
        + '<label>Senha<input name="senha" type="password" autocomplete="new-password" required></label>'
        + '<label>Confirmar senha<input name="confirmar" type="password" autocomplete="new-password" required></label>'
        + '<label>E-mail<input name="email" type="email" autocomplete="email" required></label>'
        + '<p class="erro">' + esc(erro || '') + '</p>'
        + '<button class="btn largo" type="submit">Criar conta</button></form>'
      : '<form data-form="entrar" novalidate>'
        + '<label>Nome de usuário<input name="usuario" autocomplete="username" required></label>'
        + '<label>Senha<input name="senha" type="password" autocomplete="current-password" required></label>'
        + '<p class="erro">' + esc(erro || '') + '</p>'
        + '<button class="btn largo" type="submit">Entrar</button>'
        + '<button class="link-senha" type="button" data-acao="auth" data-modo="esqueci">Esqueci a senha</button></form>';
    mostrarCenario(true);
    areaMusica(true);
    // Já está na entrada: troca só o formulário (com fade e a caixa crescendo devagar), sem redesenhar logo e moldura.
    var caixa = app.querySelector('.tela-entrada .moldura-runica'), atual = caixa && caixa.querySelector('form');
    if (atual) {
      var trocou = atual.dataset.form !== nomeForm;
      app.querySelector('.tela-entrada').classList.toggle('modo-cadastro', cadastro);
      caixa.querySelectorAll('.abas button').forEach(function (b) { b.classList.toggle('ativa', (b.dataset.modo === 'cadastro') === cadastro); });
      var antes = caixa.offsetHeight, tmp = document.createElement('div');
      tmp.innerHTML = form;
      var novo = tmp.firstChild;
      if (trocou) novo.classList.add('form-entra');
      atual.replaceWith(novo);
      if (trocou) {
        var depois = caixa.offsetHeight;
        caixa.style.height = antes + 'px';
        void caixa.offsetHeight;            // aplica a altura antiga antes de animar
        caixa.style.transition = 'height .3s ease';
        caixa.style.height = depois + 'px';
        setTimeout(function () { caixa.style.height = ''; caixa.style.transition = ''; }, 320);
      }
      var campo = novo.querySelector('input');
      if (campo) campo.focus({ preventScroll: true });
      return;
    }
    app.innerHTML = '<div class="tela-entrada' + (cadastro ? ' modo-cadastro' : '') + '">' + marca()
      + '<section class="auth"><div class="caixa moldura-runica">'
      + '<i class="canto c1"></i><i class="canto c2"></i><i class="canto c3"></i><i class="canto c4"></i>'
      + '<div class="runas runas-topo">ᚠᚱᛗᚾᚨ ◆ ᚱᚲᛗᚨ</div><div class="runas runas-base">ᛟᛞᚾ ◆ ᛗᛁᚱ</div>'
      + '<div class="abas"><button data-acao="auth" data-modo="entrar" class="' + (cadastro ? '' : 'ativa') + '">Entrar</button>'
      + '<button data-acao="auth" data-modo="cadastro" class="' + (cadastro ? 'ativa' : '') + '">Cadastrar</button></div>'
      + form + '</div>' + botaoInstalar() + '</section>' + rodape() + '</div>';
    var primeiro = app.querySelector('input');
    if (primeiro) primeiro.focus();
  }

  // Depois de entrar: com senha temporária, primeiro cria a senha nova.
  function depoisDeEntrar() {
    if (estado.conta && estado.conta.trocar_senha) telaTrocarSenha(true);
    else telaPersonagens();
  }

  function retomarJogo() {
    if (estado.conta.trocar_senha) return false;
    try {
      var sessao = JSON.parse(sessionStorage.getItem('eldrin.jogo'));
      if (!sessao || !estado.conta.personagens.some(function (p) { return p.id === sessao.id; })) return false;
    } catch (e) { return false; }
    abrirJogo(sessao.id, sessao.aba);
    return true;
  }

  function guardarJogo() {
    try {
      if (estado.personagem) sessionStorage.setItem('eldrin.jogo', JSON.stringify({ id: estado.personagem.id, aba: estado.aba }));
      else sessionStorage.removeItem('eldrin.jogo');
    } catch (e) { /* armazenamento indisponível */ }
  }
  // Trocar a senha (obrigatório depois de entrar com a senha temporária do admin).
  function telaTrocarSenha(obrigatorio, erro) {
    chatVisivel(false);
    mostrarCenario(false);
    app.innerHTML = topo() + '<div class="conteudo"><section class="auth"><div class="caixa">'
      + '<h2>' + (obrigatorio ? 'Crie uma senha nova' : 'Trocar senha') + '</h2>'
      + (obrigatorio ? '<p class="suave">Você entrou com uma senha temporária. Escolha uma senha nova para continuar.</p>' : '')
      + '<form data-form="trocar-senha" novalidate>'
      + '<label>Senha nova<input name="senha" type="password" autocomplete="new-password" required></label>'
      + '<label>Confirmar senha nova<input name="confirmar" type="password" autocomplete="new-password" required></label>'
      + '<p class="erro">' + esc(erro || '') + '</p>'
      + '<button class="btn largo" type="submit">Salvar senha</button>'
      + (obrigatorio ? '' : '<button class="btn secundario largo" type="button" data-acao="voltar-personagens">Cancelar</button>')
      + '</form></div></section></div>' + rodape();
    var c = app.querySelector('input');
    if (c) c.focus();
  }

  // ---------------- Seleção de personagens ----------------

  function telaPersonagens() {
    chatVisivel(false);
    var lista = estado.conta.personagens;
    var cartas = lista.map(function (p) {
      var topoCarta = '<div class="carta"><div class="moldura">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</div>'
        + '<div class="nome">' + esc(p.nome) + '</div>'
        + '<div class="detalhe">' + nomeRaca(p.raca, p.sexo) + ' · ' + nomeClasseP(p) + ' · Lv ' + p.nivel + '</div>';
      // Excluir pede o nome do personagem digitado, para não apagar sem querer.
      if (estado.excluir === p.id) {
        return topoCarta + '<div class="excluir-confirma"><p class="menos pequeno">Isso apaga ' + esc(p.nome) + ' para sempre: level, itens, ouro e amigos. Não dá para desfazer.</p>'
          + '<label class="pequeno" for="confirmar-exclusao">Digite <strong>' + esc(p.nome) + '</strong> para confirmar</label>'
          + '<input id="confirmar-exclusao" autocomplete="off" data-nome="' + esc(p.nome) + '">'
          + '<p class="erro pequeno" id="erro-exclusao"></p>'
          + '<button class="btn perigo largo" data-acao="excluir-confirmar" data-id="' + p.id + '" disabled>Excluir para sempre</button>'
          + '<button class="btn secundario largo" data-acao="excluir-cancelar">Cancelar</button></div></div>';
      }
      return topoCarta + '<button class="btn largo" data-acao="jogar" data-id="' + p.id + '">Jogar</button>'
        + '<button class="btn secundario largo btn-excluir" data-acao="excluir-pedir" data-id="' + p.id + '">Excluir</button></div>';
    }).join('');
    if (lista.length < D.MAX_PERSONAGENS) {
      cartas += '<button class="carta nova" data-acao="nova-criacao"><span>+</span><div class="nome">Criar personagem</div>'
        + '<div class="detalhe">' + (D.MAX_PERSONAGENS - lista.length) + ' vaga(s) livre(s)</div></button>';
    }
    mostrarCenario(false);
    areaMusica(true);
    app.innerHTML = topo('<button class="btn secundario" data-acao="trocar-senha">Trocar senha</button>') + '<div class="conteudo"><h2>Seus personagens</h2>'
      + '<div class="lista-personagens">' + cartas + '</div></div>' + rodape();
  }

  // ---------------- Criação de personagem ----------------

  function telaCriacao() {
    var c = estado.criacao;
    var sexos = Object.keys(D.sexos).map(function (k) {
      return '<button class="opcao' + (c.sexo === k ? ' selecionada' : '') + '" data-acao="escolher-sexo" data-valor="' + k + '">' + D.sexos[k].nome + '</button>';
    }).join('');
    var racas = Object.keys(D.racas).map(function (k) {
      var r = D.racas[k];
      return '<button class="carta' + (c.raca === k ? ' selecionada' : '') + '" data-acao="escolher-raca" data-valor="' + k + '">'
        + '<div class="moldura">' + F.imagemRaca(k, c.sexo) + '</div><div class="nome">' + nomeRaca(k, c.sexo) + '</div></button>';
    }).join('');
    var classesPermitidas = D.racas[c.raca].classes;
    var classes = classesPermitidas.map(function (k) {
      return '<button class="carta' + (c.classe === k ? ' selecionada' : '') + '" data-acao="escolher-classe" data-valor="' + k + '">'
        + '<div class="moldura">' + F.personagem(c.raca, k, c.sexo) + '</div><div class="nome">' + nomeClasse(k, c.sexo) + '</div>'
        + '<div class="detalhe">' + D.ARMAS_CLASSE[k].armas.map(function (a) { return D.TIPOS_ARMA[a].nome; }).join(' · ') + '</div></button>';
    }).join('');

    var final = R.atributosIniciais(c.raca, c.classe);
    var linhas = R.ATRIBUTOS.map(function (k) {
      return '<tr><td>' + D.atributos[k].nome + '</td><td><strong>' + final[k] + '</strong></td></tr>';
    }).join('');
    var tracos = tracosRacaHtml(c.raca);
    var previa = R.status(R.criarPersonagem('x', c.sexo, c.raca, c.classe));

    mostrarCenario(false);
    areaMusica(true);
    app.innerHTML = topo('<button class="btn secundario" data-acao="voltar-personagens">Voltar</button>')
      + '<div class="conteudo"><div class="criacao"><div>'
      + '<section class="etapa"><h2>1. Nome</h2><label>Nome do personagem'
      + '<input id="nome-personagem" maxlength="16" value="' + esc(c.nome) + '" placeholder="Ex.: Aldric"></label></section>'
      + '<section class="etapa"><h2>2. Sexo</h2><div class="opcoes">' + sexos + '</div></section>'
      + '<section class="etapa"><h2>3. Raça <small>— ' + esc(D.racas[c.raca].descricao) + '</small></h2><div class="grade">' + racas + '</div>'
      + (D.racas[c.raca].lore ? (CELULAR ? '<details class="lore-celular"><summary>📖 A história da raça</summary>' : '')
        + '<p class="lore-raca"><strong>' + esc(D.racas[c.raca].lema) + '.</strong> ' + esc(D.racas[c.raca].lore) + '</p>' + (CELULAR ? '</details>' : '') : '') + '</section>'
      + '<section class="etapa"><h2>4. Classe <small>— ' + esc(D.classes[c.classe].descricao) + '</small></h2><div class="grade">' + classes + '</div></section>'
      + '</div><aside class="caixa previa"><div class="moldura">' + F.personagem(c.raca, c.classe, c.sexo) + '</div>'
      + '<h3 class="centro">' + nomeRaca(c.raca, c.sexo) + ' ' + nomeClasse(c.classe, c.sexo) + ' · ' + D.sexos[c.sexo].nome + '</h3>'
      + '<table class="atributos"><thead><tr><th>Atributo</th><th>Classe</th></tr></thead><tbody>' + linhas + '</tbody></table>'
      + '<div class="tracos-raca"><strong>' + nomeRaca(c.raca, c.sexo) + ':</strong> ' + tracos + '</div>'
      + '<p class="suave" style="margin-top:.8em">Começa no level 1 com ' + previa.hpMax + ' HP e ' + D.armas[c.classe].comum[0] + ' (dano ' + D.ARMA_INICIAL_DANO.join('–') + ').</p>'
      + '<p class="erro" id="erro-criacao"></p>'
      + '<button class="btn largo" data-acao="criar-personagem">Criar personagem</button></aside></div></div>' + rodape();
  }

  async function criarPersonagem() {
    var c = estado.criacao;
    var nome = c.nome.trim();
    var erro = document.getElementById('erro-criacao');
    if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]{2,15}$/.test(nome)) {
      erro.textContent = 'O nome deve ter de 3 a 16 letras ou números, começando com letra, sem espaços.';
      return;
    }
    var botao = document.querySelector('[data-acao="criar-personagem"]');
    if (botao) botao.disabled = true;
    var p = R.criarPersonagem(nome, c.sexo, c.raca, c.classe);
    p.poder = R.poder(p);
    try {
      if (!(await C.nomePersonagemLivre(nome))) throw new Error('Esse nome já está em uso em ' + D.NOME_JOGO + '.');
      await C.criarPersonagem(p);
    } catch (e) {
      erro.textContent = e.message;
      if (botao) botao.disabled = false;
      return;
    }
    estado.personagem = p;
    estado.conta = C.contaAtual();
    estado.criacao = null;
    avisar('Bem-vindo a ' + D.NOME_JOGO + ', ' + nome + '!');
    abrirJogo(p.id);
  }

  // ---------------- Jogo ----------------

  // ----- Atividades: tempo logado e tempo caçando de cada personagem -----
  // Conta de segundo em segundo enquanto o personagem está no jogo e salva a cada minuto.
  // Um intervalo grande demais (computador dormindo) não conta.
  var atividade = { relogio: null, ultimo: 0, desdeSalvar: 0 };
  function iniciarAtividade() {
    clearInterval(atividade.relogio);
    atividade.ultimo = Date.now();
    atividade.desdeSalvar = 0;
    atividade.relogio = setInterval(tiqueAtividade, 1000);
  }
  function tiqueAtividade() {
    var p = estado.personagem;
    if (!p) { clearInterval(atividade.relogio); atividade.relogio = null; return; }
    var agora = Date.now(), seg = (agora - atividade.ultimo) / 1000;
    atividade.ultimo = agora;
    if (seg > 120) return;
    var c = estado.cacada;
    R.registrarAtividade(p, seg, !!(c && c.fase !== 'parada'));
    atividade.desdeSalvar += seg;
    if (atividade.desdeSalvar >= 60) { atividade.desdeSalvar = 0; salvar(); }
    var l = document.getElementById('atividade-logado'), k = document.getElementById('atividade-cacando');
    if (l) l.textContent = tempoAtividade(p.atividade.logado);
    if (k) k.textContent = tempoAtividade(p.atividade.cacando);
  }
  // Fecha a conta do tempo e salva (ao trocar de personagem ou sair).
  function encerrarAtividade() {
    if (!atividade.relogio || !estado.personagem) return;
    tiqueAtividade();
    clearInterval(atividade.relogio);
    atividade.relogio = null;
    salvar();
  }
  function tempoAtividade(segundos) {
    var s = Math.floor(Number(segundos) || 0), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
    if (s < 60) return s ? 'menos de 1 min' : '—';
    return (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + m + 'min';
  }
  function atividadesHtml(p) {
    var a = p.atividade || {};
    return '<div class="secao atividades"><h3>Atividades</h3><dl class="status">'
      + '<dt title="Tempo total com este personagem dentro do jogo.">⏱ Tempo logado</dt><dd id="atividade-logado">' + tempoAtividade(a.logado) + '</dd>'
      + '<dt title="Tempo total em Aventura > Caçar com a caçada em andamento.">⚔ Tempo caçando</dt><dd id="atividade-cacando">' + tempoAtividade(a.cacando) + '</dd>'
      + '</dl></div>';
  }

  function abrirJogo(id, aba) {
    estado.personagem = R.normalizar(estado.conta.personagens.find(function (p) { return p.id === id; }));
    estado.aba = (grupoDaAba(aba) || (aba === 'admin' && ehAdmin())) ? aba : 'personagem';
    estado.subAba = {};
    estado.amigoAberto = estado.removerAmigo = null;
    iniciarHistoricoJogo();
    estado.chefeAviso = null;
    estado.area = D.areas.filter(function (a) { return R.areaLiberada(estado.personagem, a); }).pop().id;
    estado.vendaPendente = null;
    estado.itemFoco = null;
    estado.mercadoRaridade = 'comum';
    estado.resultado = null;
    R.atualizarTempo(estado.personagem, C.agora());
    estado.loginAberto = R.loginEstado(estado.personagem, C.agora()).pode && !(estado.personagem.guia && !estado.personagem.guia.fim);
    estado.loginResultado = null;
    iniciarAtividade();
    var presente = estado.personagem.recomecoPresente === 1, presenteForca = estado.personagem.presenteForcaCacador === 1;
    var presenteDes = estado.personagem.presenteDestrezaCacador === 1, qtdDes = presenteForca ? 2 : 1;
    if (presente) estado.personagem.recomecoPresente = 2;
    if (presenteForca) estado.personagem.presenteForcaCacador = 2;
    if (presenteDes) { estado.personagem.presenteDestrezaCacador = 2; presenteForca = false; }
    salvar();   // também marca o personagem como online para os amigos
    if (presente) setTimeout(function () {
      avisar('🎁 Os atributos mudaram! Você ganhou 1 ' + D.RECOMECO.nome + ' para redistribuir seus pontos (Herói > Atributos).', 'item');
    }, 800);
    else if (presenteDes) setTimeout(function () {
      avisar('🎁 O ataque do Caçador voltou a vir da Destreza. Você ganhou ' + qtdDes + ' ' + D.RECOMECO.nome + ' para redistribuir seus pontos (Herói > Atributos).', 'item');
    }, 800);
    else if (presenteForca) setTimeout(function () {
      avisar('🎁 O ataque do Caçador agora vem da Força (a Destreza continua dando crítico, precisão e evasão). Você ganhou 1 ' + D.RECOMECO.nome + ' para redistribuir seus pontos (Herói > Atributos).', 'item');
    }, 800);
    estado.social = null;
    estado.gm = null;
    estado.luta = null;
    if (estado.cacada) { clearTimeout(estado.cacada.timer); clearInterval(estado.cacada.relogio); }
    estado.cacada = null;
    estado.areaAberta = null;
    estado.retomando = false;
    telaJogo();
    if (estado.personagem.cacadaAuto) setTimeout(retomarCacada, 300);   // caçada que ficou ligada com o jogo fechado
    carregarSocial();
    carregarGrupo();
    estado.arena = null;
    estado.lutaArena = null;
    carregarArena();
    estado.alianca = null;
    estado.aliancaCriar = estado.aliancaBrasao = estado.aliancaConfirmar = null;
    estado.bossAl = null; estado.aliancaVista = null;
    carregarAlianca();
  }

  function tempoTexto(ms) {
    var min = Math.ceil(ms / 60000);
    return min >= 60 ? Math.floor(min / 60) + 'h ' + (min % 60) + 'min' : min + ' min';
  }

  // Estamina: barra, tempo até encher e acampamento (a vida começa cheia em toda luta).
  function textoEstamina(p) {
    var E = D.ESTAMINA;
    return 'Cada luta da caçada gasta estamina: ' + E.custo.join(', ') + ' (1º, 2º e 3º monstro da área) e ' + E.custoChefe
      + ' o chefe. ' + (E.acampar === false ? 'Enche sozinha em ' + E.minutosSemAcampar + ' min'
        : E.minutosSemAcampar > 0 ? 'Enche sozinha em ' + E.minutosSemAcampar + ' min, acampado em ' + E.minutosAcampado + ' min'
        : 'Só recupera acampado (enche em ' + (E.minutosAcampado / 60) + ' h)') + ', e fica cheia à meia-noite. '
      + 'Potes de estamina no Mercado (reputação).';
  }
  function estaminaHtml(p) {
    var e = R.estamina(p), max = D.ESTAMINA.maximo;
    return '<div class="suave dica" tabindex="0">Estamina <i class="dica-i">?</i><span class="dica-balao" role="tooltip"><strong>Estamina</strong><span>'
      + esc(textoEstamina(p)) + '</span></span></div><div id="ficha-estamina">' + barra('estamina', Math.min(e.pts, max), max, e.pts + ' / ' + max) + '</div>';
  }
  function estaminaFinaHtml(p) {
    var e = R.estamina(p), max = D.ESTAMINA.maximo;
    return '<div class="est-fina" role="progressbar" aria-label="Estamina ' + e.pts + ' de ' + max + '" title="Estamina ' + e.pts + ' / ' + max
      + '" aria-valuenow="' + e.pts + '" aria-valuemin="0" aria-valuemax="' + max + '"><i style="width:' + Math.min(100, e.pts / max * 100) + '%"></i><b>⚡ ' + e.pts + ' / ' + max + '</b></div>';
  }
  function vidaTempoHtml(p, s, emBatalha) {
    var min = R.minutosParaEstaminaCheia(p), cheia = R.estamina(p).pts >= D.ESTAMINA.maximo;
    var texto = emBatalha ? 'Em batalha: a estamina não volta.'
      : min === null ? 'Sem acampar a estamina não volta (só à meia-noite).'
      : min ? 'Estamina cheia em ' + tempoTexto(min * 60000) + (p.acampado && D.ESTAMINA.acampar !== false ? ' (acampado)' : '') : 'Estamina cheia';
    var acampar = D.ESTAMINA.acampar === false ? '' : p.acampado
      ? '<button class="btn largo" data-acao="levantar"' + (emBatalha ? ' disabled' : '') + '>Levantar acampamento</button>'
      : '<button class="btn secundario largo" data-acao="acampar"' + (emBatalha || cheia ? ' disabled' : '') + '>Acampar (recupera a estamina)</button>';
    return '<div class="suave pequeno vida-tempo">' + texto + '</div>' + acampar;
  }

  // Ícones (traço dourado) da barra de recursos e das abas.
  function svg(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; }
  // Ícones das abas de cima (sub-abas de cada grupo).
  var ICONES_SUB = {
    personagem: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    encantar: svg('<path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M18 6l-2.5 2.5m-7 7L6 18"/>'),
    habilidades: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>'),
    cacar: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>'),
    masmorra: svg('<path d="M4 21V10a8 8 0 0 1 16 0v11Z"/><path d="M8 21v-7m4 7v-8m4 8v-7M4 14h16"/>'),
    historia: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>'),
    social: svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0m1-5a5 5 0 0 1 5 5"/>'),
    ranking: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5a3 3 0 0 0 3 4m8-4h3a3 3 0 0 1-3 4M12 13v4m-4 4h8m-6-4h4"/>'),
    alianca: svg('<path d="M6 3v18M6 4h11l-3 4 3 4H6"/>'),
    oficina: svg('<path d="M3 21h18M6 21v-4h12v4M9 17V9l-4-4 3-2 5 5h2v9"/><path d="m14 8 5-5 2 2-5 5"/>'),
  };
  var ICONES = {
    menu: svg('<path d="M12 2 21 6v5c0 5-3.5 8.5-9 11-5.5-2.5-9-6-9-11V6Z" fill="#302014"/><path d="M7.5 8h9m-9 4h9m-7 4h5"/><path d="m12 4 1 1-1 1-1-1Z" fill="currentColor" stroke="none"/>'),
    trocarPersonagem: svg('<circle cx="9" cy="7" r="3"/><path d="M3 19v-2a6 6 0 0 1 9-5m2 3h7m-2-2 2 2-2 2m1 3h-7m2-2-2 2 2 2"/>'),
    som: svg('<path d="M4 9h4l5-4v14l-5-4H4Zm12 0a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/>'),
    sair: svg('<path d="M10 4H5v16h5m2-8h9m-3-3 3 3-3 3"/>'),
    ouro: svg('<circle cx="12" cy="12" r="9" fill="#a86c24" stroke="#f3cf79"/><circle cx="12" cy="12" r="6.2" fill="#d3993c" stroke="#694317"/><path d="M12 8.5 14.5 12 12 15.5 9.5 12Z" fill="#ffe1a0" stroke="#694317" stroke-width="1"/>'),
    reputacao: svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
    pocao: svg('<path d="M9.5 3h5M10.5 3v5L6 15.5A3.5 3.5 0 0 0 9 21h6a3.5 3.5 0 0 0 3-5.5L13.5 8V3"/><path d="M7.5 14h9"/>'),
    arena: svg('<path d="M4 4l9 9M4 4v3.5M4 4h3.5M20 4l-9 9M20 4v3.5M20 4h-3.5M7 15l-3 3 2 2 3-3M17 15l3 3-2 2-3-3"/>'),
    heroi: svg('<path d="M12 3l7 3v5.5c0 4.3-3 8-7 9.5-4-1.5-7-5.2-7-9.5V6z"/><path d="M12 8v8M9 11h6"/>'),
    aventura: svg('<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12 7l5 5"/>'),
    leilao: svg('<path d="m8 4 8 8m-6-10 8 8m-7-1-7 7m9 3h8m-8 3h8"/>'),
    mercado: svg('<path d="M5 8h14l-1.2 11.5a1.5 1.5 0 0 1-1.5 1.5H7.7a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
    oficinas: svg('<path d="M3 21h18M5 21V11l7-5 7 5v10"/><path d="m10 14 4 4m0-4-4 4"/>'),
    social: svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.8 14.5c2.3.2 3.9 1.9 4.4 4.6"/>'),
    cadeado: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10V7.5a5 5 0 0 1 10 0V10h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7.5a3 3 0 0 0-6 0z"/></svg>',
    admin: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  };

  // Barra fixa no alto: ouro, reputação, poções do dia e entradas da Arena.
  function recursosHtml() {
    var p = estado.personagem, s = R.status(p), emBatalha = !!estado.batalha;
    var e = estado.arena && estado.arena.entradas, arena, arenaRotulo = 'Arena';
    if (p.nivel < A.nivelMin) arena = 'Lv ' + A.nivelMin;
    else if (!e) arena = '…';
    else {
      arena = e.valor + '/' + e.maximo;
      if (e.proxima_em) arenaRotulo = '+1 em ' + tempoTexto(Math.max(60000, Date.parse(e.proxima_em) - C.agora()));
    }
    function recurso(classe, titulo, icone, rotulo, valor, extra) {
      return '<div class="recurso ' + classe + '" title="' + titulo + '"><span class="rec-ico">' + icone + '</span>'
        + '<span class="rec-txt"><small>' + rotulo + '</small><strong>' + valor + '</strong></span>' + (extra || '') + '</div>';
    }
    return '<div class="barra-recursos" id="recursos"><div class="recursos-dentro">'
      + recurso('r-vida r-estamina', 'Estamina: cada luta da caçada gasta. Enche com o tempo, acampando ou com potes (Mercado)', '⚡', 'Estamina', '<span id="rec-estamina">' + R.estamina(p).pts + '</span>/' + D.ESTAMINA.maximo)
      + recurso('r-ouro', 'Ouro', ICONES.ouro, 'Ouro', p.ouro.toLocaleString('pt-BR'))
      + recurso('r-reputacao', 'Reputação', ICONES.reputacao, 'Reputação', (p.reputacao || 0).toLocaleString('pt-BR'))
      + recurso('r-pocao', 'Poções de vida (só na caçada) · reset em ' + tempoTexto(R.msAteReset(C.agora())) + ' (estamina cheia e 2 poções). Mais poções no Mercado.', (interfaceAtual() === 'zealot' ? ICONE_POCAO : ICONES.pocao), 'Poções',
        '<span id="ficha-pocoes">' + (emBatalha ? estado.batalha.pocoes : p.pocoes) + '/' + R.maxPocoes(p) + '</span>')
      + recurso('r-arena', 'Entradas da Arena', ICONES.arena, arenaRotulo, arena)
      + (CELULAR ? '' : botoesAvisosHtml())
      + '</div></div>';
  }

  // ---------------- Caixa de entrada (carta) e sininho (Henri, nov/2026) ----------------
  // Caixa: o que o personagem RECEBEU (Chefe Mundial, Arena, leilão, mercado, clã, masmorra, oficina), salvo no
  // personagem (p.caixa, mais novo primeiro, até 80; p.caixaVista = quando abriu). Sininho: todos os balões de aviso
  // (até 60, guardados neste navegador).
  var ICONE_CARTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.4V17h16V7.4l-8 5.3zM5.2 7 12 11.5 18.8 7z"/></svg>';
  var ICONE_SINO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a6 6 0 0 1 6 6v3.5l1.8 3.3A1 1 0 0 1 19 16H5a1 1 0 0 1-.9-1.2L6 11.5V8a6 6 0 0 1 6-6zm-2.5 15h5a2.5 2.5 0 0 1-5 0z"/></svg>';
  var ORIGENS_CAIXA = { boss: ['🐉', 'Chefe Mundial'], arena: ['⚔', 'Arena'], leilao: ['🔨', 'Leilão'], mercado: ['💰', 'Mercado'],
    cla: ['🛡', 'Clã'], masmorra: ['🗝', 'Masmorra'], oficina: ['⚒', 'Oficina'] };
  function origemCaixa(o) {
    return { boss: 'boss', leilao: 'leilao', mercado: 'mercado', oficina: 'oficina', 'boss-alianca': 'cla' }[o] || 'masmorra';
  }
  function origemCredito(m) {
    m = m || '';
    return /Arena/.test(m) ? 'arena' : /leilão/.test(m) ? 'leilao' : /^Mercado/.test(m) ? 'mercado' : /clã/.test(m) ? 'cla' : /^Oficina/.test(m) ? 'oficina' : 'arena';
  }
  function caixaRegistrar(origem, texto) {
    var p = estado.personagem;
    if (!p || /^Mochila cheia/.test(texto)) return;
    p.caixa = p.caixa || [];
    p.caixa.unshift({ t: C.agora(), o: origem, x: texto });
    if (p.caixa.length > 80) p.caixa.length = 80;
    salvar();
    atualizarSelos();
  }
  function caixaNaoLidas(p) {
    return (p.caixa || []).filter(function (c) { return c.t > (p.caixaVista || 0); }).length;
  }
  var notificacoes = null;
  function chaveNotif() { return 'eldrin.notificacoes.' + ((estado.personagem && estado.personagem.id) || 'geral'); }
  function lerNotificacoes() {
    if (notificacoes && notificacoes.chave === chaveNotif()) return notificacoes;
    var dados = null;
    try { dados = JSON.parse(localStorage.getItem(chaveNotif()) || 'null'); } catch (e) { dados = null; }
    notificacoes = { chave: chaveNotif(), lista: (dados && dados.lista) || [], vista: (dados && dados.vista) || 0 };
    return notificacoes;
  }
  function gravarNotificacoes() {
    try { localStorage.setItem(notificacoes.chave, JSON.stringify({ lista: notificacoes.lista, vista: notificacoes.vista })); } catch (e) { /* sem armazenamento */ }
  }
  // Aviso de item novo na cor da raridade (roxo para épico, dourado para lendário...). Peça de conjunto também vai
  // pela raridade (o conjunto pode vir em qualquer uma); o texto diz "(conjunto)".
  function avisarItem(it) {
    avisar('Item novo: ' + R.nomeItem(it) + (it.conjunto ? ' (conjunto)' : ''), 'item raridade-' + it.raridade);
  }
  function guardarNotificacao(msg, tipo) {
    if (typeof estado === 'undefined' || !estado.personagem) return;
    var n = lerNotificacoes();
    n.lista.unshift({ t: Date.now(), x: String(msg), k: tipo || '' });
    if (n.lista.length > 60) n.lista.length = 60;
    gravarNotificacoes();
    atualizarSelos();
  }
  function seloNumero(n) { return n ? '<span class="selo-num">' + (n > 99 ? '99+' : n) + '</span>' : ''; }
  function botoesAvisosHtml() {
    var p = estado.personagem, n = lerNotificacoes();
    var nn = n.lista.filter(function (x) { return x.t > n.vista; }).length;
    return '<div class="avisos-topo">'
      + '<button class="btn-aviso" id="btn-caixa" data-acao="painel-topo" data-valor="caixa" title="Caixa de entrada: o que você recebeu" aria-label="Caixa de entrada">'
      + ICONE_CARTA + seloNumero(caixaNaoLidas(p)) + '</button>'
      + '<button class="btn-aviso" id="btn-sino" data-acao="painel-topo" data-valor="sino" title="Notificações" aria-label="Notificações">'
      + ICONE_SINO + seloNumero(nn) + '</button></div>';
  }
  function atualizarSelos() {
    var p = estado.personagem;
    if (!p) return;
    var bc = document.getElementById('btn-caixa'), bs = document.getElementById('btn-sino'), n = lerNotificacoes();
    var trocar = function (b, qtd) {
      if (!b) return;
      var velho = b.querySelector('.selo-num');
      if (velho) velho.remove();
      if (qtd) b.insertAdjacentHTML('beforeend', seloNumero(qtd));
    };
    trocar(bc, estado.painelTopo === 'caixa' ? 0 : caixaNaoLidas(p));
    trocar(bs, estado.painelTopo === 'sino' ? 0 : n.lista.filter(function (x) { return x.t > n.vista; }).length);
    var ponto = document.getElementById('menu-cel-ponto');
    if (ponto) ponto.hidden = !((bc && bc.querySelector('.selo-num')) || (bs && bs.querySelector('.selo-num')) || chat.naoLidas || avisosMissoes(p, C.agora()));
    if (estado.painelTopo) desenharPainelTopo();
  }
  function quandoTexto(t) {
    var d = new Date(t), hoje = new Date();
    var hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === hoje.toDateString() ? hora : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hora;
  }
  function desenharPainelTopo() {
    var el = document.getElementById('painel-topo'), p = estado.personagem, tipo = estado.painelTopo;
    if (!tipo || !p) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'painel-topo'; document.body.appendChild(el); }
    var h;
    if (tipo === 'caixa') {
      var lista = p.caixa || [];
      h = '<div class="painel-topo-cab"><strong>✉ Caixa de entrada</strong><button class="btn-x" data-acao="painel-topo" data-valor="" aria-label="Fechar">✕</button></div>'
        + '<p class="suave pequeno">O que seu herói recebeu: Chefe Mundial, Arena, leilão, mercado, clã, masmorra e oficina.</p>'
        + (lista.length ? '<ul class="painel-lista">' + lista.map(function (c) {
          var o = ORIGENS_CAIXA[c.o] || ['•', ''];
          return '<li' + (c.t > (estado.caixaVistaAntes || 0) ? ' class="nova"' : '') + '><span class="pl-ico">' + o[0] + '</span><div><small>' + o[1] + ' · ' + quandoTexto(c.t) + '</small><div>' + esc(c.x) + '</div></div></li>';
        }).join('') + '</ul>' : '<p class="suave">Nada recebido ainda.</p>');
    } else {
      var n = lerNotificacoes();
      h = '<div class="painel-topo-cab"><strong>🔔 Notificações</strong><span>'
        + (n.lista.length ? '<button class="btn secundario btn-pequeno" data-acao="notificacoes-limpar">Limpar</button>' : '')
        + '<button class="btn-x" data-acao="painel-topo" data-valor="" aria-label="Fechar">✕</button></span></div>'
        + (n.lista.length ? '<ul class="painel-lista">' + n.lista.map(function (x) {
          var rar = /raridade-(\w+)/.exec(x.k || '');
          return '<li' + (x.t > (estado.sinoVistoAntes || 0) ? ' class="nova"' : '') + '><span class="pl-ico">•</span><div><small>' + quandoTexto(x.t) + '</small><div'
            + (rar ? ' class="raridade-' + rar[1] + '"' : '') + '>' + esc(x.x) + '</div></div></li>';
        }).join('') + '</ul>' : '<p class="suave">Nenhuma notificação.</p>');
    }
    el.innerHTML = '<div class="painel-topo-caixa" role="dialog">' + h + '</div>';
  }
  function abrirPainelTopo(tipo) {
    var p = estado.personagem;
    estado.painelTopo = estado.painelTopo === tipo || !tipo ? null : tipo;
    if (estado.painelTopo === 'caixa') {
      estado.caixaVistaAntes = p.caixaVista || 0;
      p.caixaVista = C.agora();
      salvar();
    } else if (estado.painelTopo === 'sino') {
      var n = lerNotificacoes();
      estado.sinoVistoAntes = n.vista;
      n.vista = Date.now();
      gravarNotificacoes();
    }
    desenharPainelTopo();
    atualizarSelos();
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    var botao = t.closest && t.closest('[data-acao="painel-topo"], [data-acao="notificacoes-limpar"]');
    if (botao && botao.closest('#painel-topo')) {
      e.preventDefault();
      if (botao.dataset.acao === 'notificacoes-limpar') { var n = lerNotificacoes(); n.lista = []; gravarNotificacoes(); desenharPainelTopo(); }
      else abrirPainelTopo(null);
      return;
    }
    if (estado.painelTopo && !(t.closest && (t.closest('#painel-topo') || t.closest('.avisos-topo') || t.closest('.menu-cel')))) abrirPainelTopo(null);
  });

  // ---------------- Ficha flutuante do item (Henri, nov/2026) ----------------
  // Um clique num item (ou consumível) abre a ficha numa janelinha presa a ele, por cima da tela: nada mais muda
  // de lugar. Fecha clicando fora, no ✕, no mesmo item ou com Esc. Depois de redesenhar a tela, volta a se prender ao item.
  function fichaFlutuanteConteudo() {
    var p = estado.personagem;
    if (!p) return null;
    if (estado.consumivelFoco) {
      var c = R.consumiveis(p).filter(function (x) { return x.id === estado.consumivelFoco; })[0];
      return c ? fichaConsumivelHtml(c) : null;
    }
    if (estado.dropFoco) {
      var dr = dropsCacada[estado.dropFoco];
      if (!dr) return null;
      var naMochila = p.inventario.some(function (i) { return i.id === dr.id; });
      return fichaItemHtml(dr, true) + '<p class="suave pequeno">' + (naMochila ? 'Está na sua mochila: equipe ou venda pela aba Herói.' : 'Este item não está mais na mochila.') + '</p>';
    }
    var it = estado.itemFoco && p.inventario.find(function (i) { return i.id === estado.itemFoco; });
    if (!it) return null;
    var cmp = estado.comparando && estado.comparando[1] === it.id && p.inventario.find(function (i) { return i.id === estado.comparando[0]; });
    if (cmp) return '<div class="comparar-duas"><div class="comparar-lado">' + fichaItemHtml(cmp) + '</div><div class="comparar-lado">' + fichaItemHtml(it) + '</div></div>';
    // Clique num item desequipado (Henri, 12/11/2026): a ficha abre com o equipado do mesmo lugar ao lado, para comparar.
    var eq = !estado.fichaHover && !R.slotDoItem(p, it.id) && (it.tipo === 'anel'
      ? (R.itemNoSlot(p, 'anel1') || R.itemNoSlot(p, 'anel2')) : (it.tipo in p.equipados ? R.itemNoSlot(p, it.tipo) : null));
    if (eq) return '<div class="comparar-duas"><div class="comparar-lado comparar-equipado"><p class="comparar-rotulo">Equipado</p>' + fichaItemHtml(eq, true)
      + '</div><div class="comparar-lado"><p class="comparar-rotulo">Na mochila</p>' + fichaItemHtml(it) + '</div></div>'
      + '<div class="botoes"><button class="btn secundario btn-pequeno" data-acao="item-comparar" data-id="' + it.id + '">⚖ Comparar com outro</button></div>';
    return fichaItemHtml(it) + '<div class="botoes"><button class="btn secundario btn-pequeno" data-acao="item-comparar" data-id="' + it.id + '">⚖ Comparar com outro</button></div>';
  }
  function fecharFlutuante() {
    var f = document.getElementById('ficha-flutuante');
    if (f) f.remove();
    estado.itemFoco = null;
    estado.consumivelFoco = null;
    estado.dropFoco = null;
    estado.vendaPendente = null;
    estado.comparando = null;
    estado.compararCom = null;
    estado.fichaHover = false;
    document.querySelectorAll('.focado[data-acao="item"], .focado[data-acao="consumivel"], .focado[data-acao="drop-ver"]').forEach(function (x) { x.classList.remove('focado'); });
  }
  function desenharFlutuante(ancora) {
    var html = fichaFlutuanteConteudo();
    var f = document.getElementById('ficha-flutuante');
    if (!html) { if (f) f.remove(); return; }
    if (!ancora || !ancora.isConnected) {
      var id = estado.consumivelFoco || estado.itemFoco || estado.dropFoco;
      ancora = document.querySelector('[data-acao="' + (estado.consumivelFoco ? 'consumivel' : estado.dropFoco ? 'drop-ver' : 'item') + '"][data-id="' + id + '"]');
    }
    if (!ancora) { if (f) f.remove(); return; }
    if (!f) { f = document.createElement('div'); f.id = 'ficha-flutuante'; f.setAttribute('role', 'dialog'); app.appendChild(f); }
    f.innerHTML = '<button class="btn-x ficha-flutuante-x" data-acao="ficha-fechar" aria-label="Fechar">✕</button>' + html;
    f.classList.toggle('comparando', html.indexOf('comparar-duas') >= 0);
    f.classList.toggle('hover', !!estado.fichaHover);
    document.querySelectorAll('.focado[data-acao="item"], .focado[data-acao="consumivel"], .focado[data-acao="drop-ver"]').forEach(function (x) { x.classList.remove('focado'); });
    ancora.classList.add('focado');
    // posição: ao lado do item (direita; se não couber, esquerda), dentro da tela
    var r = ancora.getBoundingClientRect(), larg = f.offsetWidth, alt = f.offsetHeight, m = 8;
    var x = r.right + m + larg <= window.innerWidth - m ? r.right + m : Math.max(m, r.left - m - larg);
    if (window.innerWidth < 600) x = Math.max(m, (window.innerWidth - larg) / 2);
    var y = Math.min(Math.max(m, r.top), Math.max(m, window.innerHeight - alt - m));
    f.style.left = x + 'px';
    f.style.top = y + 'px';
  }
  // Computador: passar o mouse num item da mochila/equipamento mostra a ficha na hora (sem clicar). Clicar fixa.
  function fixarFichaHover() {
    estado.fichaHover = false;
    var f = document.getElementById('ficha-flutuante');
    if (f) f.classList.remove('hover');
  }
  if (temMouse) {
    app.addEventListener('mouseover', function (e) {
      var el = e.target.closest && e.target.closest('[data-acao="item"]');
      if (!el || estado.vendaLote || estado.compararCom) return;
      var f = document.getElementById('ficha-flutuante');
      if (f && !estado.fichaHover) return;   // há uma ficha fixa: não troca sozinha
      if (estado.itemFoco === el.dataset.id && f) return;
      estado.itemFoco = el.dataset.id;
      estado.consumivelFoco = estado.dropFoco = null;
      estado.comparando = null;
      estado.fichaHover = true;
      desenharFlutuante(el);
    });
    app.addEventListener('mouseout', function (e) {
      if (!estado.fichaHover) return;
      var para = e.relatedTarget;
      if (para && para.closest && (para.closest('#ficha-flutuante') || para.closest('[data-acao="item"][data-id="' + estado.itemFoco + '"]'))) return;
      if (e.target.closest && (e.target.closest('[data-acao="item"]') || e.target.closest('#ficha-flutuante'))) fecharFlutuante();
    });
  }
  document.addEventListener('mousedown', function (e) {
    var f = document.getElementById('ficha-flutuante');
    if (!f || f.contains(e.target)) return;
    if (e.target.closest && e.target.closest('[data-acao="item"], [data-acao="consumivel"], [data-acao="drop-ver"]')) return;
    fecharFlutuante();
  });
  window.addEventListener('resize', function () { if (document.getElementById('ficha-flutuante')) desenharFlutuante(); });
  document.addEventListener('scroll', function () { if (document.getElementById('ficha-flutuante')) desenharFlutuante(); }, true);

  // Redesenha a ficha e a barra de recursos sem mexer no resto da tela.
  function atualizarFicha() {
    manterRolagem(function () {
      [['.ficha', fichaHtml], ['#recursos', recursosHtml]].forEach(function (x) {
        var velho = document.querySelector(x[0]);
        if (!velho) return;
        var nova = document.createElement('div');
        nova.innerHTML = x[1]();
        velho.replaceWith(nova.firstChild);
      });
    });
  }

  // Redesenhar a tela não pode mexer no que o jogador está olhando (no celular a tela "subia sozinha" a cada toque ou
  // monstro achado): marca um elemento visível (o último tocado, se ainda estiver na tela), redesenha e rola a página
  // para ele voltar ao mesmo lugar. A altura da página fica presa até as imagens novas carregarem.
  var rolagemVez = 0, ultimoToque = null;
  document.addEventListener('pointerdown', function (e) { ultimoToque = e.target; }, true);
  function chaveElemento(el) {
    for (; el && el !== app; el = el.parentElement) {
      var sel = el.id ? '#' + CSS.escape(el.id)
        : el.dataset && el.dataset.acao ? '[data-acao="' + el.dataset.acao + '"]' + ['valor', 'atributo', 'monstro', 'aba', 'id'].map(function (k) {
          return el.dataset[k] ? '[data-' + k + '="' + CSS.escape(el.dataset[k]) + '"]' : '';
        }).join('') : null;
      if (sel) return { sel: sel, i: Array.prototype.indexOf.call(app.querySelectorAll(sel), el) };
    }
    return null;
  }
  function naTela(el) {
    if (!el || !app.contains(el)) return false;
    var r = el.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }
  function ancoraRolagem() {
    var alvo = naTela(document.activeElement) && document.activeElement !== document.body ? document.activeElement
      : naTela(ultimoToque) ? ultimoToque : null;
    if (!alvo) {
      var lista = app.querySelectorAll('[id], [data-acao]');
      for (var i = 0; i < lista.length && !alvo; i++) {
        var r = lista[i].getBoundingClientRect();
        if (r.height > 0 && r.top >= 0 && r.top < window.innerHeight && getComputedStyle(lista[i]).position !== 'fixed') alvo = lista[i];
      }
    }
    var chave = alvo && chaveElemento(alvo);
    if (!chave) return null;
    chave.top = app.querySelectorAll(chave.sel)[chave.i].getBoundingClientRect().top;
    return chave;
  }
  function voltarAncora(chave, y) {
    var el = chave && app.querySelectorAll(chave.sel)[chave.i];
    if (el) {
      var d = el.getBoundingClientRect().top - chave.top;
      if (Math.abs(d) > 1) window.scrollTo(0, window.scrollY + d);
    } else if (window.scrollY !== y) window.scrollTo(0, y);
  }
  // Caixas com rolagem própria (ex.: a caçada na interface Zealot) também voltavam ao topo: guarda e devolve.
  function caminhoAte(el) {
    var c = [];
    for (; el && el !== app; el = el.parentElement) c.unshift(Array.prototype.indexOf.call(el.parentElement.children, el));
    return c;
  }
  function rolagensInternas() {
    var lista = [];
    Array.prototype.forEach.call(app.querySelectorAll('*'), function (el) {
      if (el.scrollTop > 0 && el.id !== 'registro' && el.scrollHeight > el.clientHeight) lista.push({ c: caminhoAte(el), cls: el.className, top: el.scrollTop });
    });
    return lista;
  }
  function voltarRolagensInternas(lista) {
    lista.forEach(function (r) {
      var el = app;
      for (var i = 0; el && i < r.c.length; i++) el = el.children[r.c[i]];
      if (el && el.className === r.cls) el.scrollTop = r.top;
    });
  }
  function manterRolagem(desenhar) {
    var y = window.scrollY, vez = ++rolagemVez, internas = rolagensInternas();
    if (!y) { desenhar(); voltarRolagensInternas(internas); return; }
    var chave = ancoraRolagem();
    app.style.minHeight = app.offsetHeight + 'px';
    desenhar();
    voltarRolagensInternas(internas);
    voltarAncora(chave, y);
    var imgs = Array.prototype.filter.call(app.querySelectorAll('img'), function (i) { return !i.complete; });
    var soltar = function () {
      if (vez !== rolagemVez) return;
      var c = ancoraRolagem(), y2 = window.scrollY;
      app.style.minHeight = '';
      if (c) voltarAncora(c, y2); else if (window.scrollY !== y2) window.scrollTo(0, y2);
    };
    if (!imgs.length) { requestAnimationFrame(soltar); return; }
    Promise.race([
      Promise.all(imgs.map(function (i) { return new Promise(function (ok) { i.addEventListener('load', ok); i.addEventListener('error', ok); }); })),
      new Promise(function (ok) { setTimeout(ok, 1500); }),
    ]).then(soltar);
  }

  // As abas em 5 grupos (no celular viram a barra de baixo).
  var GRUPOS = [
    { id: 'heroi', nome: 'Herói', abas: ['personagem', 'encantar', 'oficina', 'habilidades'] },
    { id: 'aventura', nome: 'Aventura', abas: ['cacar', 'masmorra', 'mineracao', 'mundial', 'historia'] },
    { id: 'arena', nome: 'Arena', abas: ['arena'] },
    { id: 'mercado', nome: 'Mercado', abas: ['mercado', 'oficinas'] },
    { id: 'leilao', nome: 'Leilão', abas: ['leilao'] },
    { id: 'social', nome: 'Social', abas: ['alianca', 'ranking', 'social'] },   // Daniel: Clã primeiro, depois Ranking e Amigos
  ];
  var NOME_ABA = { oficinas: 'Oficinas', mercado: 'Loja', leilao: 'Leilão', personagem: 'Personagem', encantar: 'Encantar', oficina: 'Oficina', habilidades: 'Habilidades', cacar: 'Caçar', masmorra: 'Masmorra', mineracao: 'Mineração', mundial: 'Chefe Mundial', historia: 'História', social: 'Amigos', ranking: 'Ranking', alianca: 'Clã' };
  // Casca do celular (Daniel, nov/2026): ligada no começo da página (data-celular). Telas e barras próprias, sobre o
  // tema Zealot; as regras e o servidor são os mesmos. Estilo em css/celular.css.
  var CELULAR = document.documentElement.hasAttribute('data-celular');
  if (CELULAR) {
    GRUPOS = GRUPOS.filter(function (g) { return g.id !== 'leilao'; });
    GRUPOS.filter(function (g) { return g.id === 'mercado'; })[0].abas.push('leilao');
  }
  function grupoDaAba(aba) { return GRUPOS.filter(function (g) { return g.abas.indexOf(aba) >= 0; })[0]; }
  // Raça e classe concordam com o gênero da personagem (sem o sexo, fica no masculino).
  // Traços da raça em texto: "+10% de velocidade · −10% de vida".
  var NOME_TRACO = { vidaPct: ['%', 'de vida'], danoPct: ['%', 'de dano'], velocidadePct: ['%', 'de velocidade'],
    critico: ['%', 'de chance de crítico'], danoCritico: ['%', 'de dano crítico'], evasaoPct: ['%', 'de esquiva'] };
  function tracosRacaHtml(raca) {
    var t = R.tracosRaca({ raca: raca }), ks = Object.keys(t);
    if (!ks.length) return '<span class="suave">equilibrado, sem pontos fortes nem fracos.</span>';
    return ks.map(function (k) {
      var n = NOME_TRACO[k] || ['', k];
      return '<span class="' + (t[k] > 0 ? 'mais' : 'menos') + '">' + (t[k] > 0 ? '+' : '−') + Math.abs(t[k]) + n[0] + ' ' + n[1] + '</span>';
    }).join(' · ');
  }
  function nomeRaca(r, sexo) { var x = D.racas[r]; return x ? (sexo === 'feminino' && x.nomeF || x.nome) : ''; }
  function nomeClasse(k, sexo) { var x = D.classes[k]; return x ? (sexo === 'feminino' && x.nomeF || x.nome) : ''; }
  // Retrato: o da segunda classe quando já escolheu (assets/personagens/<raca>-<segunda classe>[-f].jpg).
  function classeRetrato(x) { var c2 = x.classe2 || (x.talentos && x.talentos.classe2); return c2 && D.SEGUNDAS_CLASSES[c2] ? c2 : x.classe; }
  // Classe de um lutador vindo do servidor (com a segunda classe, quando tiver).
  function nomeClasseX(x) { var c = x.classe2 && D.SEGUNDAS_CLASSES[x.classe2]; return c ? (x.sexo === 'feminino' && c.nomeF || c.nome) : nomeClasse(x.classe, x.sexo); }
  // Classe do próprio personagem: mostra a segunda classe quando já escolheu (ex.: Paladina).
  function nomeClasseP(p) { var c = R.segundaClasse(p); return c ? (p.sexo === 'feminino' && c.nomeF || c.nome) : nomeClasse(p.classe, p.sexo); }
  function seloDaAba(aba) { return aba === 'habilidades' ? seloHabilidades() : aba === 'masmorra' ? seloMasmorra() : aba === 'historia' ? seloHistoria() : aba === 'arena' ? seloArena() : aba === 'social' ? seloPedidos() : aba === 'alianca' ? seloAlianca() : ''; }
  // Topo da casca do celular: retrato (vai para o Herói), nome, level e exp; chat, missões e menu em ícones
  // (no lugar dos botões que flutuavam por cima do jogo).
  function cascaTopoHtml(menu) {
    var p = estado.personagem, precisa = R.expNecessaria(p.nivel), maximo = p.nivel >= D.NIVEL_MAXIMO;
    var pct = maximo ? 100 : Math.max(0, Math.min(100, p.exp / precisa * 100));
    var prontas = avisosMissoes(p, C.agora());
    return '<header class="topo casca-topo"><button class="casca-eu" data-acao="aba" data-aba="personagem" aria-label="Meu herói">'
      + '<span class="casca-retrato">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</span>'
      + '<span class="casca-nome"><span class="casca-linha-nome"><strong>' + esc(p.nome) + '</strong><b class="casca-poder" title="Poder">⚔ '
      + R.poder(p).toLocaleString('pt-BR') + '</b></span><small>Lv ' + p.nivel + ' · ' + esc(nomeClasseP(p)) + '</small>'
      + '<i class="casca-exp" title="' + (maximo ? 'Level máximo' : 'Exp ' + Math.floor(pct) + '%') + '"><b style="width:' + pct + '%"></b></i></span></button>'
      + '<div class="casca-icones">'
      + '<button class="casca-ico" data-acao="casca-chat" aria-label="Chat">💬<span class="casca-selo" id="casca-chat-selo"' + (chat.naoLidas ? '' : ' hidden') + '>' + (chat.naoLidas > 99 ? '99+' : chat.naoLidas || '') + '</span></button>'
      + '<button class="casca-ico" data-acao="casca-missoes" aria-label="Missões">📜<span class="casca-selo" id="casca-missoes-selo"' + (prontas ? '' : ' hidden') + '>' + (prontas || '') + '</span></button>'
      + (menu || '') + '</div></header>';
  }
  // Menu do escudo no celular (Daniel, nov/2026): painel que desce do topo com o herói em cima e três grupos
  // (Jogo, Configurações, Conta). Caixa de entrada e Avisos saíram da barra de recursos e vieram para cá
  // (mesmos ids btn-caixa/btn-sino, então os números continuam se atualizando sozinhos).
  function menuCelularHtml(livre) {
    var p = estado.personagem, n = lerNotificacoes(), prontas = avisosMissoes(p, C.agora());
    var nn = n.lista.filter(function (x) { return x.t > n.vista; }).length, cx = caixaNaoLidas(p);
    var item = function (attrs, ico, nome, selo, extra) {
      return '<button class="menu-cel-item' + (extra || '') + '" ' + attrs + '><span class="menu-cel-ico">' + ico + '</span><span class="menu-cel-nome">' + nome + '</span>'
        + (selo != null ? selo : '') + '<span class="menu-cel-seta">›</span></button>';
    };
    var anterior = document.getElementById('menu-jogo'), aviso = cx || nn || prontas || chat.naoLidas;
    var cacandoAfk = !livre && CACA_SERVIDOR && !!estado.cacada && !estado.lutaArena && !estado.luta;
    return '<details class="menu-jogo menu-cel" id="menu-jogo"' + (anterior && anterior.open ? ' open' : '') + '>'
      + '<summary class="btn' + (abaDoGuia() && abaDoGuia() !== estado.aba ? ' guia-alvo' : '') + '" aria-label="Menu do jogo">' + ICONES.menu
      + '<span class="menu-cel-ponto" id="menu-cel-ponto"' + (aviso ? '' : ' hidden') + '></span></summary>'
      + '<div class="menu-jogo-painel menu-cel-painel">'
      + '<div class="menu-cel-cab"><span class="menu-cel-retrato">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</span><div><strong>' + esc(p.nome) + '</strong>'
      + '<small>Lv ' + p.nivel + ' · ' + esc(nomeClasseP(p)) + '</small><b>⚔ ' + R.poder(p).toLocaleString('pt-BR') + '</b></div></div>'
      + '<div class="menu-cel-grupo menu-cel-grade"><small>Jogo</small>'
      + item('data-acao="casca-missoes"', '📜', 'Missões', prontas ? seloNumero(prontas) : '')
      + item('data-acao="casca-chat"', '💬', 'Chat', chat.naoLidas ? seloNumero(chat.naoLidas) : '')
      + item('id="btn-caixa" data-acao="painel-topo" data-valor="caixa"', ICONE_CARTA, 'Caixa de entrada', seloNumero(cx))
      + item('id="btn-sino" data-acao="painel-topo" data-valor="sino"', ICONE_SINO, 'Avisos', seloNumero(nn)) + '</div>'
      + '<div class="menu-cel-grupo menu-cel-grade"><small>Configurações</small>'
      + item('data-acao="menu-interface"', '🎨', 'Interface') + item('data-acao="menu-som"', ICONES.som, 'Som e música') + '</div>'
      // Caçando dá para trocar de herói ou sair: a caçada segue sozinha no servidor (farm AFK) e volta ao entrar de novo.
      + (livre || cacandoAfk ? '<div class="menu-cel-grupo"><small>Conta</small>'
        + (livre && ehAdmin() ? item('data-acao="aba" data-aba="admin"', ICONES.admin, 'Admin') : '')
        + item('data-acao="voltar-personagens"', ICONES.trocarPersonagem, 'Trocar personagem')
        + item('data-acao="sair"', ICONES.sair, 'Sair', '', ' perigo') + '</div>' : '')
      + '</div></details>';
  }
  // Número no ícone de Missões: missões prontas para resgatar + o prêmio de login do dia, se ainda não pego.
  function avisosMissoes(p, agora) { return R.missoesProntas(p, agora) + (R.loginEstado(p, agora).pode ? 1 : 0); }
  function fecharMenuJogo() { var m = document.getElementById('menu-jogo'); if (m) m.open = false; }
  // Zealot no celular: a mesma barra de ícones da Clássica, embaixo da tela (o menu de cima fica só com Trocar/Som/Sair).
  function navBaixoHtml() {
    return navHtml().replace('id="abas-jogo"', 'id="abas-baixo"').replace('class="abas-jogo"', 'class="abas-jogo abas-baixo"');
  }
  function navHtml() {
    var atual = grupoDaAba(estado.aba);
    var nav = '<nav class="abas-jogo" id="abas-jogo">' + GRUPOS.map(function (g) {
      var alvo = abaDoGuia(), guiaAqui = alvo && g.abas.indexOf(alvo) >= 0 && estado.aba !== alvo;
      var destino = guiaAqui ? alvo : estado.subAba[g.id] || g.abas[0];
      return '<button data-acao="aba" data-aba="' + destino + '" class="' + (atual === g ? 'ativa' : '') + (guiaAqui ? ' guia-alvo' : '') + '">'
        + '<span class="aba-ico">' + ICONES[g.id] + g.abas.map(seloDaAba).join('') + '</span><span class="aba-nome">' + g.nome + '</span></button>';
    }).join('') + '</nav>';
    return nav;
  }
  function subAbasHtml() {
    var atual = grupoDaAba(estado.aba);
    return atual && atual.abas.length > 1 ? '<nav class="sub-abas" id="sub-abas">' + atual.abas.map(function (a) {
      return '<button data-acao="aba" data-aba="' + a + '" class="' + (estado.aba === a ? 'ativa' : '') + (a === abaDoGuia() && estado.aba !== a ? ' guia-alvo' : '') + '">' + (ICONES_SUB[a] ? '<span class="sub-ico">' + ICONES_SUB[a] + '</span>' : '') + NOME_ABA[a] + seloDaAba(a) + '</button>';
    }).join('') + '</nav>' : '';
  }
  // Atualiza só os selos das abas (pedidos de amizade, convites, ataques na Arena).
  function atualizarNav() {
    var nav = document.getElementById('abas-jogo');
    if (!nav) return;
    var sub = document.getElementById('sub-abas'), baixo = document.getElementById('abas-baixo');
    var tmp = document.createElement('div');
    tmp.innerHTML = navHtml() + subAbasHtml() + (baixo ? navBaixoHtml() : '');
    nav.replaceWith(tmp.querySelector('#abas-jogo'));
    if (baixo) baixo.replaceWith(tmp.querySelector('#abas-baixo'));
    if (sub && tmp.querySelector('#sub-abas')) sub.replaceWith(tmp.querySelector('#sub-abas'));
  }

  function fichaHtml() {
    var p = estado.personagem, s = R.status(p);
    var precisa = R.expNecessaria(p.nivel);
    var arma = R.armaEquipada(p);
    var emBatalha = !!estado.batalha;
    var eq = R.bonusEquipamentos(p);
    // Pontos escolhidos mas ainda não confirmados: aparecem em verde e mudam a prévia dos status.
    var pend = pontosPendentes(), usados = totalPendentes(), restam = p.pontosLivres - usados;
    var sNovo = usados ? R.status(comPendentes(p, pend)) : s;
    var atrs = R.ATRIBUTOS.map(function (k) {
      var botoes = p.pontosLivres > 0 && !emBatalha
        ? '<button class="btn mini" data-acao="ponto-menos" data-atributo="' + k + '" title="Tirar ponto"' + (pend[k] ? '' : ' disabled') + '>−</button>'
          + '<button class="btn mini" data-acao="ponto" data-atributo="' + k + '" title="Pôr ponto em ' + D.atributos[k].nome + '"' + (restam > 0 ? '' : ' disabled') + '>+</button>'
        : '<span></span>';
      return '<div class="linha-atr"><span class="dica" tabindex="0">' + D.atributos[k].nome + ' <i class="dica-i">?</i>' + dicaAtributo(p, k, pend) + '</span>'
        + '<span class="valor">' + (p.atributos[k] + eq[k] + (pend[k] || 0)) + (eq[k] ? ' <small class="mais">(+' + eq[k] + ')</small>' : '')
        + (pend[k] ? ' <small class="pendente">+' + pend[k] + '</small>' : '') + '</span><span class="atr-botoes">' + botoes + '</span></div>';
    }).join('');
    if (usados) {
      atrs += '<div class="atr-confirmar"><button class="btn" data-acao="pontos-confirmar">Confirmar ' + usados + ' ponto(s)</button>'
        + '<button class="btn secundario" data-acao="pontos-desfazer">Cancelar</button></div>'
        + '<p class="suave pequeno">Depois de confirmar não dá para voltar atrás: só com o ' + D.RECOMECO.nome + ' (Mercado).</p>';
    }
    if (p.recomecos && !emBatalha) {
      atrs += '<div class="recomeco-ficha"><span>📜 ' + D.RECOMECO.nome + ': <strong>' + p.recomecos + '</strong></span>'
        + (estado.recomecoPendente
          ? '<button class="btn perigo btn-pequeno" data-acao="recomeco-usar">Confirmar: resetar</button>'
          : '<button class="btn secundario btn-pequeno" data-acao="recomeco-pedir">Usar</button>') + '</div>';
    }
    var magico = s.tipoDano === 'magico';
    // Mostra "atual → novo" quando há pontos para confirmar.
    function mudanca(a, b, texto) { return a === b ? texto(a) : texto(a) + ' <span class="mais">→ ' + texto(b) + '</span>'; }
    function pct(v) { return fmt(v) + '%'; }
    var status = [
      ['Poder', '<strong class="cor-ouro">' + R.poder(p).toLocaleString('pt-BR') + '</strong>' + (usados ? ' <span class="mais">→ ' + R.poder(comPendentes(p, pend)).toLocaleString('pt-BR') + '</span>' : ''), 'Força geral do personagem: ataque e resistência somados.'],
      ['Vida máxima', mudanca(s.hpMax, sNovo.hpMax, String), 'Vida cheia do personagem.'],
      ['Dano por golpe', mudanca(dano(s.dano), dano(sNovo.dano), String) + (magico ? ' (mágico)' : ''), 'Quanto cada golpe tira, antes da defesa do inimigo.'],
      [magico ? 'Ataque mágico' : 'Ataque', mudanca(magico ? s.ataqueMagico : s.ataque, magico ? sNovo.ataqueMagico : sNovo.ataque, function (v) { return '+' + v; }), 'Somado ao dano da arma em cada golpe.'],
      ['Defesa', mudanca(s.defesa, sNovo.defesa, String) + ' <small class="suave">(−' + R.cortePct(sNovo.defesa) + '% de dano)</small>', 'Diminui em porcentagem o dano físico que você recebe: 100 de defesa = −50%, 200 = −67%, 300 = −75%.'],
      ['Defesa mágica', mudanca(s.defesaMagica, sNovo.defesaMagica, String) + ' <small class="suave">(−' + R.cortePct(sNovo.defesaMagica) + '% de dano)</small>', 'Diminui em porcentagem o dano mágico que você recebe (na Arena): 100 = −50%.'],
      ['Velocidade', mudanca(s.velocidade, sNovo.velocidade, String), 'Quem é mais rápido ataca mais vezes. Sobe com o level.'],
      ['Precisão', mudanca(s.precisao, sNovo.precisao, pct), 'Chance de acertar o golpe.'],
      ['Evasão', mudanca(s.evasao, sNovo.evasao, pct), 'Chance de desviar de um ataque.'],
      ['Chance de crítico', mudanca(s.chanceCritico, sNovo.chanceCritico, pct), 'Chance de um golpe físico ser crítico.'],
      ['Dano crítico', mudanca(s.danoCritico, sNovo.danoCritico, pct), 'Quanto o golpe crítico físico causa (150% = 1,5x).'],
      ['Crítico mágico', mudanca(s.chanceCriticoMagico, sNovo.chanceCriticoMagico, pct), 'Chance de uma magia ser crítica.'],
      ['Dano crítico mágico', mudanca(s.danoCriticoMagico, sNovo.danoCriticoMagico, pct), 'Quanto a magia crítica causa.'],
      ['Sucesso no craft', mudanca(s.chanceCraft, sNovo.chanceCraft, pct), 'Chance de sucesso ao fabricar itens (em breve).'],
      ['Encantamento', mudanca(s.chanceEncantamento, sNovo.chanceEncantamento, pct), 'Bônus na chance de sucesso ao encantar.'],
    ].map(function (l) { return '<dt title="' + l[2] + '">' + l[0] + '</dt><dd>' + l[1] + '</dd>'; }).join('');

    return '<aside class="caixa ficha">'
      + '<div class="cabeca"><div class="moldura">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</div><div>'
      + '<h2>' + esc(p.nome) + '</h2>' + (p.titulo ? '<div class="titulo-heroi">' + esc(p.titulo) + '</div>' : '')
      + '<div class="suave">' + nomeRaca(p.raca, p.sexo) + ' · ' + nomeClasseP(p) + '</div>'
      + '<div class="nivel">Level ' + p.nivel + '</div></div></div>'
      + '<div class="suave">Vida</div><div id="ficha-hp">' + barra('hp', emBatalha ? estado.batalha.jogador.hp : s.hpMax, emBatalha ? estado.batalha.jogador.hpMax : s.hpMax, (emBatalha ? estado.batalha.jogador.hp : s.hpMax) + ' / ' + (emBatalha ? estado.batalha.jogador.hpMax : s.hpMax), 'ficha') + '</div>'
      + estaminaHtml(p)
      + '<div class="suave">Experiência</div>' + (p.nivel >= D.NIVEL_MAXIMO
        ? barra('exp', 1, 1, 'Level máximo')
        : barra('exp', p.exp, precisa, p.exp.toLocaleString('pt-BR') + ' / ' + precisa.toLocaleString('pt-BR')))
      + vitalidadeHtml(p)
      + vidaTempoHtml(p, s, emBatalha)
      + poderHtml(p) + bonusFichaHtml()
      + '<div class="secao"><h3>Arma</h3>' + armaFichaHtml(p, arma, s) + '</div>'
      + '<button class="ficha-sanfona' + (estado.fichaAberta ? ' aberta' : '') + '" data-acao="ficha-status" aria-expanded="' + !!estado.fichaAberta + '">'
      + '<span>Atributos e status</span>' + (p.pontosLivres > 0 ? '<span class="pontos">' + p.pontosLivres + ' ponto(s)</span>' : '') + '<i aria-hidden="true">▾</i></button>'
      + (!estado.fichaAberta ? '' : '<div class="ficha-detalhes">'
      + '<div class="secao"><h3>Atributos' + (p.pontosLivres > 0 ? ' <span class="pontos">' + restam + ' ponto(s) livre(s)</span>' : '') + '</h3>'
      + '<p class="suave pequeno dica-texto">Passe o mouse (ou toque) no nome para ver o que cada atributo faz.</p>' + atrs + '</div>'
      + (!D.HABILIDADES_ATIVAS ? '' : '<div class="secao"><h3>Habilidade <span class="pontos">Nível ' + R.nivelHabilidade(p) + '</span></h3>'
      + '<div class="nome-habilidade">⚡ ' + D.habilidades[p.classe].nome + '</div>'
      + '<p class="suave pequeno">' + D.habilidades[p.classe].descricao + ' ' + textoHabilidade(p.classe, R.nivelHabilidade(p)) + '</p></div>')
      + '<div class="secao"><h3>Raça: ' + nomeRaca(p.raca, p.sexo) + '</h3><p class="pequeno tracos-raca">' + tracosRacaHtml(p.raca) + '</p></div>'
      + '<div class="secao"><h3>Status</h3><dl class="status">' + status + '</dl></div></div>')
      + atividadesHtml(p)
      + '</aside>';
  }

  // ----- Pontos de atributo: escolher com + e −, conferir a prévia e só então confirmar -----
  var DESCRICAO_ATRIBUTO = {
    for: 'Aumenta o ataque físico e o dano dos golpes críticos.',
    des: 'Aumenta a precisão, a evasão e a chance de crítico.',
    res: 'Aumenta a vida (acima de 10), a defesa e a defesa mágica.',
    int: 'Aumenta o ataque mágico (dano dos magos).',
    sor: 'Aumenta a chance de drop, o crítico mágico, o dano crítico mágico, o encantamento e o craft.',
  };
  function pontosPendentes() {
    var p = estado.personagem;
    if (!estado.pontosPend || estado.pontosPend.id !== p.id) estado.pontosPend = { id: p.id, pontos: {} };
    return estado.pontosPend.pontos;
  }
  function totalPendentes() {
    var pend = pontosPendentes();
    return R.ATRIBUTOS.reduce(function (t, k) { return t + (pend[k] || 0); }, 0);
  }
  // Cópia do personagem com os pontos pendentes já somados (só para calcular a prévia).
  function comPendentes(p, pend) {
    var c = JSON.parse(JSON.stringify(p));
    R.ATRIBUTOS.forEach(function (k) { c.atributos[k] += pend[k] || 0; });
    return c;
  }
  // Balão do atributo: o que ele faz, quanto cada ponto vale e quanto falta para o próximo degrau.
  // O que cada ponto vale, conforme a classe (o atributo de dano é FOR, DES ou INT).
  function regrasAtributo(p) {
    var dano = D.classes[p.classe].atributoDano, n = D.PONTOS_POR_DANO;
    return {
      for: { ganhos: (dano === 'for' ? ['+1 de Ataque a cada ' + n + ' pontos (soma no dano dos golpes)'] : []).concat(['+1% de dano crítico por ponto']),
        degrau: dano === 'for' ? [n, 'Ataque'] : null },
      des: { ganhos: (dano === 'des' ? ['+1 de Ataque a cada ' + n + ' pontos (soma no dano dos golpes)'] : [])
        .concat(['+0,5% de chance de crítico por ponto', '+1% de precisão por ponto', '+0,5% de evasão por ponto']), degrau: dano === 'des' ? [n, 'Ataque'] : null },
      res: { ganhos: ['+' + D.HP_POR_RES + ' de vida por ponto acima de ' + D.RES_SEM_VIDA, '+' + fmtDec(D.DEFESA.fator / 10) + ' de defesa e +' + fmtDec(D.DEFESA.fator / 10) + ' de defesa mágica por ponto'] },
      int: { ganhos: dano === 'int' ? ['+1 de Ataque mágico a cada ' + n + ' pontos (soma no dano das magias)'] : ['Não ajuda a sua classe na luta'],
        degrau: dano === 'int' ? [n, 'Ataque mágico'] : null },
      sor: { ganhos: ['+' + fmtDec(D.SORTE.drop) + '% na chance de drop por ponto (sobre a chance de cada drop)', '+1% de chance de crítico mágico por ponto', '+1% de dano crítico mágico por ponto',
        '+0,5% de encantamento por ponto', '+1% de craft por ponto'] },
    };
  }
  function dicaAtributo(p, k, pend) {
    var r = regrasAtributo(p)[k], total = p.atributos[k] + R.bonusEquipamentos(p)[k] + (pend[k] || 0);
    var falta = r.degrau ? r.degrau[0] - (total % r.degrau[0]) : 0;
    return '<span class="dica-balao" role="tooltip"><strong>' + D.atributos[k].nome + '</strong><span>' + DESCRICAO_ATRIBUTO[k] + '</span>'
      + '<em>Cada ponto vale:</em><ul>' + r.ganhos.map(function (g) { return '<li>' + g + '</li>'; }).join('') + '</ul>'
      + (r.degrau ? '<em class="mais">Faltam ' + falta + ' ponto(s) para o próximo +1 de ' + r.degrau[1] + '.</em>' : '') + '</span>';
  }

  // Poder em destaque: medalhão dourado com o número grande.
  function poderHtml(p) {
    return '<div class="poder-destaque" title="Poder: ataque e resistência do personagem somados">'
      + '<span class="poder-ico">' + ICONES.arena + '</span><span class="poder-txt"><small>Poder</small>'
      + '<strong>' + R.poder(p).toLocaleString('pt-BR') + '</strong></span></div>';
  }
  // Carta da arma equipada: ícone, nome, raridade e os números que importam.
  function armaFichaHtml(p, arma, s) {
    if (!arma) return '<div class="suave">Nenhuma</div>';
    var dArma = R.danoArma(arma), magico = s.tipoDano === 'magico';
    var semEnc = R.danoArma(Object.assign({}, arma, { encanto: 0 }));
    var extra = Math.round(((dArma[0] + dArma[1]) - (semEnc[0] + semEnc[1])) / 2);
    var chance = magico ? s.chanceCriticoMagico : s.chanceCritico, mult = magico ? s.danoCriticoMagico : s.danoCritico;
    function stat(rotulo, valor, dica) {
      return '<div class="arma-stat"' + (dica ? ' title="' + dica + '"' : '') + '><small>' + rotulo + '</small><strong>' + valor + '</strong></div>';
    }
    return '<div class="arma-carta carta-' + arma.raridade + '">'
      + '<div class="arma-topo"><div class="icone-pequeno arma-icone borda-' + arma.raridade + aura(arma) + '">' + F.icone(arma)
      + (arma.encanto ? '<span class="nivel-encanto">+' + arma.encanto + '</span>' : '') + '</div><div class="arma-nome">' + nomeItemHtml(arma)
      + '<div><span class="selo raridade-' + arma.raridade + '">' + D.raridades[arma.raridade].nome + '</span>'
      + ' <span class="suave pequeno">' + R.tipoArma(arma).nome + ' · ' + D.NOME_VELOCIDADE[R.tipoArma(arma).vel] + (R.tipoArma(arma).duasMaos ? ' · duas mãos' : '') + '</span></div></div></div>'
      + '<div class="arma-stats">'
      + stat('Dano da arma', dano(dArma), extra ? 'Inclui +' + extra + ' do encanto' : '')
      + stat('Por golpe', dano(s.dano), 'Com os seus atributos')
      + stat('Crítico · dano', fmt(chance) + '% · ' + mult + '%', 'Chance de crítico e dano do crítico')
      + stat('Encanto', arma.encanto ? '+' + arma.encanto + ' <small class="mais">(+' + extra + ')</small>' : '—')
      + '</div></div>';
  }

  function textoDrops(lista) {
    if (!lista || !lista.length) return 'Nenhum';
    return lista.map(function (d) {
      return '<span class="raridade-' + d.raridade + '">' + D.raridades[d.raridade].nome + ' ' + d.chance + '%</span>';
    }).join(', ');
  }

  function cartaMonstro(id, selecionado) {
    var p = estado.personagem, s = R.status(p), m = D.monstros[id];
    var ritmo = m.velocidade / Math.max(1, s.velocidade);
    var fator = R.fatorExp(p, id);
    // celular: carta deitada com o resumo (estamina, exp, ouro, vida, dano); a ficha completa fica em "Ver detalhes"
    var resumo = CELULAR ? '<div class="monstro-resumo"><span title="Estamina por luta">⚡ ' + R.custoEstamina(id) + '</span><span>✦ ' + m.exp.toLocaleString('pt-BR') + ' exp</span>'
      + '<span>◎ ' + m.ouro.toLocaleString('pt-BR') + '</span><span>❤ ' + m.hp.toLocaleString('pt-BR') + '</span><span>⚔ ' + dano(m.ataque) + '</span></div>' : '';
    return '<article class="monstro' + (R.monstroLiberado(p, id) ? '' : ' monstro-bloqueado') + (selecionado ? ' monstro-escolhido' : '') + '"><div class="moldura">' + F.imagemMonstro(id) + '</div><div class="corpo">'
      + '<h3>' + m.nome + '</h3>' + (CELULAR ? resumo + '<details class="monstro-detalhes"><summary>Ver detalhes</summary><p class="suave">' + m.descricao + '</p>' : '<p class="suave">' + m.descricao + '</p>')
      + '<dl class="ficha-monstro"><dt>Vida</dt><dd>' + m.hp.toLocaleString('pt-BR') + '</dd><dt title="Dano de cada golpe (a sua defesa diminui)">Dano</dt><dd>' + dano(m.ataque) + '</dd>'
      + '<dt title="Reduz o seu dano em porcentagem">Defesa</dt><dd>' + m.defesa + ' <small class="suave">(−' + Math.round(100 - 10000 / (100 + m.defesa)) + '% de dano)</small></dd>'
      + '<dt>Velocidade</dt><dd>' + m.velocidade + '</dd><dt title="Quantas vezes o monstro ataca para cada ataque seu">Ataques/turno</dt><dd>' + fmt(ritmo) + '</dd>'
      + '<dt>Experiência</dt><dd>' + m.exp.toLocaleString('pt-BR') + '</dd><dt>Ouro</dt><dd>' + m.ouro.toLocaleString('pt-BR') + '</dd>'
      + '<dt title="Estamina gasta em cada luta contra este monstro">Estamina</dt><dd>⚡ ' + R.custoEstamina(id) + '</dd>'
      + (m.chanceArma ? '<dt>Armas</dt><dd>' + m.chanceArma + '%</dd>' : '')
      + (m.chanceArmadura ? '<dt>Armaduras</dt><dd>' + m.chanceArmadura + '%</dd>' : '')
      + (m.pergaminho ? '<dt>Pergaminho</dt><dd>' + m.pergaminho.chance + '%</dd>' : '')
      + '<dt>Abatidos</dt><dd>' + (p.abates[id] || 0) + '</dd></dl>' + (CELULAR ? '</details>' : '')
      + (fator < 100 ? '<p class="menos pequeno">Esta área está abaixo do seu nível: exp e ouro a ' + fator + '% e nenhum drop.</p>' : '')
      + (R.monstroLiberado(p, id) ? '<button class="btn largo' + (selecionado ? '' : ' secundario') + '" data-acao="cacada-alvo" data-monstro="' + id + '">'
          + (selecionado ? '✔ Na caçada' : 'Adicionar à caçada') + '</button>'
        : '<button class="btn largo" disabled>🔒 Derrote ' + esc(D.monstros[R.monstroAnterior(id)].nome) + ' primeiro</button>') + '</div></article>';
  }

  // Carta do chefe: sem números, só o mistério.
  function cartaChefe(area) {
    var p = estado.personagem, id = area.chefe.id, m = D.monstros[id];
    var abatidos = p.abates[id] || 0;
    return '<article class="monstro chefe"><div class="moldura">' + F.imagemMonstro(id) + '</div><div class="corpo">'
      + '<div class="selo-chefe">Chefe</div><h3>' + m.nome + '</h3><p class="suave">' + m.descricao + '</p>'
      + '<p class="misterio">Ronda esta área. Ninguém sabe quando vai aparecer… mas dizem que quanto mais sangue se derrama aqui, mais perto ele fica.</p>'
      + (abatidos ? '<p class="mais">Derrotado ' + abatidos + ' vez(es).</p>' : '')
      + '</div></article>';
  }

  // ---------------- Caçar: mapa mundial → região (escolher monstros) → caçada contínua ----------------
  var ESTILO_AREA = {
    // x/y = clareira de cada região na imagem assets/mapa-reino.webp (em %)
    floresta: { icone: '🌲', cor: '#2f6b3a', x: 16, y: 80.5 }, pantano: { icone: '🌫️', cor: '#3c6a66', x: 21.5, y: 36 },
    ruinas: { icone: '🏛️', cor: '#6b6250', x: 44.3, y: 69.5 }, torre: { icone: '🗼', cor: '#7a2a3a', x: 48.5, y: 32 },
    areias: { icone: '🏜️', cor: '#a8742c', x: 66.5, y: 76 }, vale: { icone: '🐉', cor: '#4a5f86', x: 75.7, y: 28 },
    cume: { icone: '🌋', cor: '#a33a1c', x: 89.3, y: 64.5 },
  };
  // Arte da região (medalhão e fundo da caçada) em assets/regioes/; regiões sem arte usam o emoji.
  function iconeArea(a, classe) {
    return ESTILO_AREA[a.id] ? '<img class="' + (classe || 'icone-area') + '" src="assets/regioes/icone-' + a.id + '.webp" alt="">' : estiloArea(a, D.areas.indexOf(a)).icone;
  }
  function estiloArea(a, i) { return ESTILO_AREA[a.id] || { icone: '⚔', cor: '#555', x: 10 + i * 13, y: i % 2 ? 40 : 70 }; }
  function abaCacar() {
    var p = estado.personagem;
    var area = estado.areaAberta && D.areas.find(function (a) { return a.id === estado.areaAberta; });
    return area && R.areaLiberada(p, area) ? regiaoHtml(area) : mapaHtml();
  }
  function mapaHtml() {
    var p = estado.personagem;
    var nos = D.areas.map(function (a, i) {
      var e = estiloArea(a, i), livre = R.areaLiberada(p, a), proxima = D.areas[i + 1];
      var faixa = proxima ? 'Lv ' + a.nivelMin + '–' + proxima.nivelMin : 'Lv ' + a.nivelMin + '+';
      return '<button class="mapa-no' + (livre ? '' : ' bloqueada') + '" style="left:' + e.x + '%;top:' + e.y + '%;--cor:' + e.cor + '"'
        + (livre ? ' data-acao="area" data-valor="' + a.id + '"' : ' disabled') + ' title="' + esc(a.descricao) + '">'
        + '<span class="mapa-icone' + (livre && ESTILO_AREA[a.id] ? ' com-arte' : '') + '">' + (livre ? iconeArea(a, 'arte') : '🔒') + '</span>'
        + '<span class="mapa-nome">' + a.nome + '</span><span class="mapa-nivel">' + (livre ? faixa : 'Libera no level ' + a.nivelMin) + '</span></button>';
    }).join('');
    return '<h3 class="subtitulo">Mapa do Reino</h3><p class="suave pequeno">Escolha uma região para caçar. As regiões abrem conforme o seu level.</p>'
      + '<div class="mapa-mundo">' + nos + '</div>';
  }
  function selecaoArea(area) {
    var p = estado.personagem, sel = estado.cacaSel || (estado.cacaSel = {});
    var livres = area.monstros.map(function (m) { return m.id; }).filter(function (id) { return R.monstroLiberado(p, id); });
    if (!sel[area.id]) sel[area.id] = livres.slice();
    sel[area.id] = sel[area.id].filter(function (id) { return livres.indexOf(id) >= 0; });
    return sel[area.id];
  }
  function regiaoHtml(area) {
    var p = estado.personagem, s = R.status(p), sel = selecaoArea(area), e = estiloArea(area, D.areas.indexOf(area));
    var livres = area.monstros.filter(function (m) { return R.monstroLiberado(p, m.id); }).length;
    return '<div class="regiao-topo" style="--cor:' + e.cor + '"><button class="btn secundario btn-pequeno" data-acao="mapa">← Mapa</button>'
      + '<div><h3>' + iconeArea(area) + ' ' + area.nome + '</h3><p class="suave pequeno">' + area.descricao + ' Armas e armaduras que caem são da sua classe.'
      + (R.mochilaCheia(p) ? ' <strong class="menos">Mochila cheia: venda itens para receber drops.</strong>' : '') + '</p></div></div>'
      + '<div class="cacada-escolha"><span>Monstros da caçada: <strong>' + sel.length + '</strong> de ' + livres + '</span>'
      + '<button class="btn secundario btn-pequeno" data-acao="cacada-todos" data-valor="' + area.id + '">' + (sel.length === livres ? 'Limpar' : 'Selecionar todos') + '</button>'
      + '<button class="btn btn-iniciar" data-acao="cacada-iniciar" data-valor="' + area.id + '"' + (sel.length ? '' : ' disabled') + '>⚔ INICIAR CAÇADA</button></div>'
      + '<div class="monstros">' + area.monstros.map(function (m) { return cartaMonstro(m.id, sel.indexOf(m.id) >= 0); }).join('') + cartaChefe(area) + '</div>';
  }

  // Aviso antes da luta contra o chefe.
  function avisoChefeHtml() {
    var a = estado.chefeAviso, m = D.monstros[a.chefe];
    return '<div class="aviso-chefe"><div class="moldura">' + F.imagemMonstro(a.chefe) + '</div><div>'
      + '<p class="rugido">Um rugido ecoa pela área…</p><h2>' + m.nome + ' está por perto!</h2>'
      + '<p class="suave">' + m.descricao + '</p>'
      + '<div class="botoes"><button class="btn perigo" data-acao="enfrentar-chefe">Enfrentar</button>'
      + '<button class="btn secundario" data-acao="fugir-chefe">Fugir</button></div>'
      + '<p class="suave pequeno">Fugir: você escapa e caça ' + D.monstros[a.monstro].nome + ' normalmente.</p></div></div>';
  }

  // Ficha do item em foco, com comparação ao que está equipado no mesmo espaço.
  // Comparar sem encanto: os dois itens viram +0 só na conta (para ver qual é melhor de base).
  // A comparação é sempre sem encanto (Daniel, nov/2026): mostra a diferença das peças em si; o botão saiu.
  function semEncanto(item) { return item && item.encanto ? Object.assign({}, item, { encanto: 0 }) : item; }


  function fichaItemHtml(item, soVer) {
    var p = estado.personagem;
    if (!item) {
      return '<p class="suave">' + (temMouse ? 'Passe o mouse num item para ver a ficha. Um clique amplia e compara; dois cliques equipam ou desequipam; o botão direito equipa. A seta verde ▲ mostra o que é melhor que o equipado.'
        : 'Toque num item para ampliar e comparar. Dois toques equipam ou desequipam.') + '</p>';
    }
    var slot = R.slotDoItem(p, item.id);
    var alvo = null;
    if (!slot) alvo = R.itemNoSlot(p, item.tipo === 'anel' ? 'anel1' : item.tipo);
    var linhas, itemC = alvo ? semEncanto(item) : item, alvoC = semEncanto(alvo);
    if (item.tipo === 'arma') {
      var d = R.danoArma(itemC), media = (d[0] + d[1]) / 2;
      var comp = '';
      if (alvo) {
        var da = R.danoArma(alvoC), diff = media - (da[0] + da[1]) / 2;
        if (diff) comp = ' <span class="' + (diff > 0 ? 'mais' : 'menos') + '">(' + (diff > 0 ? '+' : '') + fmt(diff) + ' de média)</span>';
      }
      linhas = '<li>Dano ' + dano(d) + comp + '</li>' + extrasArma(item).map(function (x) { return '<li class="suave">' + x + '</li>'; }).join('');
    } else {
      var b = R.bonusItem(itemC), ba = alvo ? R.bonusItem(alvoC) : {};
      var chaves = Object.keys(D.bonus).filter(function (k) { return b[k] || ba[k]; });
      linhas = chaves.map(function (k) {
        var v = b[k] || 0, dif = v - (ba[k] || 0);
        var cmp = alvo && dif ? ' <span class="' + (dif > 0 ? 'mais' : 'menos') + '">(' + (dif > 0 ? '+' : '') + dif + ')</span>' : '';
        return '<li' + (v ? '' : ' class="suave"') + '>' + D.bonus[k] + ' +' + v + cmp + '</li>';
      }).join('');
    }
    var acoes = '';
    if (soVer) acoes = '';
    else if (slot) {
      acoes += '<button class="btn" data-acao="desequipar" data-slot="' + slot + '"' + (R.mochilaCheia(p) ? ' disabled title="Mochila cheia"' : '') + '>Desequipar</button>';
    } else {
      acoes += R.podeUsar(p, item)
        ? '<button class="btn" data-acao="equipar" data-id="' + item.id + '">Equipar</button>'
        : '<span class="menos">' + esc(R.motivoNaoEquipa(p, item) || 'Não é da sua classe') + '</span>';
      acoes += item.travado ? '<span class="suave pequeno">🔒 Travado</span>' : estado.vendaPendente === item.id
        ? '<button class="btn perigo" data-acao="vender" data-id="' + item.id + '">Confirmar venda</button>'
        : '<button class="btn secundario" data-acao="pedir-venda" data-id="' + item.id + '">Vender (+' + R.precoVenda(item) + ' ouro)</button>';
    }
    return '<div class="ficha-item-topo"><div class="icone-grande borda-' + corItem(item) + aura(item) + '">' + F.icone(item) + '</div>'
      + '<div><div class="ficha-item-nome">' + nomeItemHtml(item) + '</div>'
      + '<div class="suave">' + tipoItem(item) + ' · <span class="raridade-' + corItem(item) + '">' + nomeRaridadeItem(item) + '</span>'
      + (item.nivel ? ' · nível ' + item.nivel + (item.qualidade !== undefined ? ' · qualidade ' + Math.round(item.qualidade * 100) + '%' : '') : '')
      + (slot ? ' · equipado' : '') + '</div></div></div>'
      + fichaPoderHtml(p, item, slot)
      + '<ul class="ficha-item-bonus">' + linhas + '</ul>' + conjuntoHtml(p, item) + craftItemHtml(item)
      + (alvo ? '<p class="suave">Comparado com ' + nomeItemHtml(alvo) + ((item.encanto || alvo.encanto) ? ' <span class="suave">(sem encanto)</span>' : '') + '</p>'
 : '')
      + '<div class="item-acoes">' + acoes + '</div>';
  }

  // Relíquia Rúnica (runa, só contra monstros) e assinatura de quem forjou.
  function craftItemHtml(item) {
    var ru = item.runa && R.runa(item.runa), h = '';
    if (ru) h += '<p class="cor-ouro">✨ Relíquia Rúnica · <strong>' + esc(ru.nome) + '</strong>: ' + esc(R.textoRuna(item)) + ' <span class="suave pequeno">(só contra monstros; +'
      + (item.encanto || 0) + ' = ' + Math.round(R.forcaRuna(item) * 100) + '% da runa; o encanto não muda mais)</span></p>';
    if (item.forjadoPor) h += '<p class="suave pequeno">' + (item.obraPrima ? '✨ Obra-prima · ' : '') + 'Forjad' + (item.tipo === 'luvas' || item.tipo === 'botas' ? 'as' : 'o') + ' por <strong>' + esc(item.forjadoPor) + '</strong></p>';
    return h;
  }
  // Conjunto da peça: nome, peças equipadas e o bônus de 2/3/4 (aceso quando ativo).
  function conjuntoHtml(p, item) {
    var info = item.conjunto && R.infoConjunto(item.conjunto);
    if (!info) return '';
    var sc = D.SEGUNDAS_CLASSES[info.classe2], meu = p.talentos && p.talentos.classe2 === info.classe2;
    var n = meu ? (R.contarConjuntos(p)[item.conjunto] || 0) : 0;
    return '<div class="conjunto-ficha"><strong>Conjunto ' + info.nome + '</strong> <span class="suave pequeno">(' + ((p.sexo === 'feminino' && sc.nomeF) || sc.nome)
      + (meu ? ' · ' + n + '/4 equipados' : ' · só vale para essa segunda classe') + ')</span><ul>'
      + [2, 3, 4].map(function (q) {
        var b = info.bonus[q];
        return '<li class="' + (n >= q ? 'ativo' : 'suave') + '">(' + q + ') ' + Object.keys(b).map(function (k) { return '+' + b[k] + ' ' + D.NOME_BONUS_CONJUNTO[k]; }).join(', ') + '</li>';
      }).join('') + '</ul></div>';
  }

  // ---------- Zoom do item: o item ampliado, lado a lado com o equipado no mesmo espaço ----------
  // Poder do item e, do lado, quanto o ⚔ Poder do herói muda se equipar (Daniel, nov/2026). A seta verde é por isso.
  function fichaPoderHtml(p, item, slot) {
    if (!item || item.consumivel) return '';
    var v, g = null;
    try { v = R.poderItem(p, item); if (!slot) g = R.ganhoPoder(p, item); } catch (e) { v = null; }
    if (v === null || v === undefined) return '';
    var dif = g === null ? '' : ' <span class="' + (g > 0 ? 'mais' : g < 0 ? 'menos' : 'suave') + '">(' + (g > 0 ? '+' : g < 0 ? '−' : '±') + Math.abs(g).toLocaleString('pt-BR') + ')</span>';
    return '<p class="ficha-poder' + (g > 0 ? ' mais' : g < 0 ? ' menos' : '') + '">⚔ Poder do item: <strong>' + v.toLocaleString('pt-BR') + '</strong>' + dif
      + (slot ? ' <span class="suave">· equipado</span>' : '') + '</p>';
  }
  function itemParaComparar(p, item) {
    if (R.slotDoItem(p, item.id)) return null;
    if (item.tipo === 'anel') return R.itemNoSlot(p, 'anel1') || R.itemNoSlot(p, 'anel2');
    return R.itemNoSlot(p, item.tipo);
  }

  function diferenca(v, outro, sufixo) {
    var d = Math.round((v - outro) * 10) / 10;
    return d ? ' <span class="' + (d > 0 ? 'mais' : 'menos') + '">(' + (d > 0 ? '+' : '') + fmt(d) + (sufixo || '') + ')</span>' : '';
  }

  // Carta grande de um item; `outro` (opcional) é o item com que ele é comparado.
  // `orig`: o item de verdade (nome, ícone, encanto e venda) quando `item` é a cópia sem encanto da comparação.
  function cartaZoom(item, outro, rotulo, orig) {
    var linhas = [];
    orig = orig || item;
    if (item.tipo === 'arma') {
      var d = R.danoArma(item), m = (d[0] + d[1]) / 2;
      var mo = outro ? (R.danoArma(outro)[0] + R.danoArma(outro)[1]) / 2 : null;
      linhas.push('<li><span>Dano</span><strong>' + dano(d) + '</strong></li>');
      linhas.push('<li><span>Dano médio</span><strong>' + fmt(m) + (outro ? diferenca(m, mo) : '') + '</strong></li>');
      extrasArma(item).forEach(function (x) { linhas.push('<li class="suave"><span>' + x + '</span></li>'); });
    } else {
      var b = R.bonusItem(item), bo = outro ? R.bonusItem(outro) : {};
      Object.keys(D.bonus).filter(function (k) { return b[k] || bo[k]; }).forEach(function (k) {
        linhas.push('<li' + (b[k] ? '' : ' class="suave"') + '><span>' + D.bonus[k] + '</span><strong>+' + (b[k] || 0) + (outro ? diferenca(b[k] || 0, bo[k] || 0) : '') + '</strong></li>');
      });
    }
    linhas.push('<li><span>Encantamento</span><strong>+' + (orig.encanto || 0) + (orig !== item ? ' <span class="suave">(fora da conta)</span>' : '') + '</strong></li>');
    linhas.push('<li><span>Venda</span><strong class="cor-ouro">' + R.precoVenda(orig).toLocaleString('pt-BR') + ' de ouro</strong></li>');
    return '<div class="zoom-carta"><div class="zoom-rotulo">' + rotulo + '</div>'
      + '<div class="icone-zoom borda-' + corItem(orig) + aura(orig) + '">' + F.icone(orig) + (orig.encanto ? '<span class="nivel-encanto">+' + orig.encanto + '</span>' : '') + '</div>'
      + '<div class="ficha-item-nome">' + nomeItemHtml(orig) + '</div>'
      + '<div class="suave">' + tipoItem(item) + ' · <span class="raridade-' + corItem(item) + '">' + nomeRaridadeItem(item) + '</span>'
      + (item.nivel ? ' · nível ' + item.nivel : '') + '</div>'
      + '<ul class="zoom-atributos">' + linhas.join('') + '</ul></div>';
  }

  function zoomHtml() {
    var p = estado.personagem;
    var item = estado.zoom && p.inventario.find(function (i) { return i.id === estado.zoom; });
    if (!item) return '';
    var slot = R.slotDoItem(p, item.id), outro = itemParaComparar(p, item);
    var semEnc = outro && (item.encanto || outro.encanto);
    var acoes = '';
    if (soVer) acoes = '';
    else if (slot) {
      acoes = '<button class="btn" data-acao="desequipar" data-slot="' + slot + '"' + (R.mochilaCheia(p) ? ' disabled title="Mochila cheia"' : '') + '>Desequipar</button>';
    } else {
      acoes = (R.podeUsar(p, item) ? '<button class="btn" data-acao="equipar" data-id="' + item.id + '">' + (outro ? 'Trocar pelo equipado' : 'Equipar') + '</button>'
          : '<span class="menos">' + esc(R.motivoNaoEquipa(estado.personagem, item) || 'Não é da sua classe') + '</span>')
        + (item.travado ? '' : estado.vendaPendente === item.id
          ? '<button class="btn perigo" data-acao="vender" data-id="' + item.id + '">Confirmar venda</button>'
          : '<button class="btn secundario" data-acao="pedir-venda" data-id="' + item.id + '">Vender</button>');
    }
    acoes += '<button class="btn secundario" data-acao="item-travar" data-id="' + item.id + '">' + (item.travado ? 'Destravar' : 'Travar') + '</button>';
    return '<div class="zoom-fundo" data-acao="zoom-fechar"><div class="zoom-janela" role="dialog" aria-label="Item ampliado">'
      + '<button class="zoom-x" data-acao="zoom-fechar" title="Fechar">✕</button>'
      + '<div class="zoom-cartas' + (outro ? ' dupla' : '') + '">'
      + cartaZoom(outro ? semEncanto(item) : item, semEncanto(outro), (slot ? 'Equipado' : 'Este item') + (semEnc ? ' · sem encanto' : ''), item)
      + (outro ? cartaZoom(semEncanto(outro), null, 'Equipado agora' + (semEnc ? ' · sem encanto' : ''), outro) : '')
      + '</div><div class="botoes">' + acoes + '<button class="btn secundario" data-acao="zoom-fechar">Fechar</button></div></div></div>';
  }

  function abaPersonagem() {
    var p = estado.personagem;
    var slots = Object.keys(D.slots).map(function (k) {
      var item = R.itemNoSlot(p, k);
      if (item) return '<div class="espaco espaco-' + k + '">' + quadroItem(item, 'slot', ' data-slot="' + k + '"') + '</div>';
      // Arma de duas mãos: a mão esquerda mostra a mesma arma, apagada (passar o mouse mostra a ficha dela).
      var arma = k === 'secundaria' && R.itemNoSlot(p, 'arma');
      if (arma && R.tipoArma(arma).duasMaos) return '<div class="espaco espaco-' + k + '">'
        + quadroItem(arma, 'slot fantasma', ' data-slot="arma"') + '</div>';
      return '<div class="espaco espaco-' + k + '"><div class="slot vazio" title="' + D.slots[k].nome + '">'
        + F.silhueta(D.slots[k].tipo, p.classe) + '</div></div>';
    }).join('');
    var eq = R.bonusEquipamentos(p);
    var resumo = Object.keys(D.bonus).filter(function (k) { return eq[k]; }).map(function (k) {
      return '<dt>' + D.bonus[k] + '</dt><dd class="mais">+' + eq[k] + '</dd>';
    }).join('');
    var cjB = R.bonusConjuntos(p);
    resumo += Object.keys(cjB).map(function (k) { return '<dt class="conjunto-dt">Conjunto</dt><dd class="mais">+' + cjB[k] + ' ' + D.NOME_BONUS_CONJUNTO[k] + '</dd>'; }).join('');
    var mochila = R.mochila(p), v = visaoMochila();
    var celulas = R.ordenarItens(mochila, v.ordem, v.crescente).map(celulaMochila);
    for (var n = mochila.length; n < D.MOCHILA_MAX; n++) celulas.push('<div class="celula vazia"></div>');
    var foco = estado.itemFoco ? p.inventario.find(function (i) { return i.id === estado.itemFoco; }) : null;
    var consumiveis = R.consumiveis(p), naConsumiveis = estado.mochilaAba === 'consumiveis';
    var cFoco = naConsumiveis && estado.consumivelFoco ? consumiveis.filter(function (c) { return c.id === estado.consumivelFoco; })[0] : null;
    var abas = '<div class="mochila-abas" role="tablist">'
      + '<button role="tab" aria-selected="' + !naConsumiveis + '" class="' + (naConsumiveis ? '' : 'ativa') + '" data-acao="mochila-aba" data-valor="equipamentos">'
      + 'Equipamentos <span class="suave">(' + mochila.length + '/' + D.MOCHILA_MAX + ')</span></button>'
      + '<button role="tab" aria-selected="' + naConsumiveis + '" class="' + (naConsumiveis ? 'ativa' : '') + '" data-acao="mochila-aba" data-valor="consumiveis">'
      + 'Consumíveis <span class="suave">(' + consumiveis.reduce(function (t, c) { return t + c.qtd; }, 0) + ')</span></button></div>';
    var baixo = naConsumiveis ? consumiveisHtml(consumiveis)
      : barraMochilaHtml() + '<div class="mochila' + (estado.vendaLote ? ' modo-venda' : '') + '">' + celulas.join('') + '</div>';
    return '<div class="personagem-grade"><div class="pg-equipamento"><div class="personagem-tela"><div class="boneco">' + slots
      + '<div class="retrato-central">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</div></div>'
      + '<div class="lateral"><div class="caixa-interna"><h3>Bônus dos equipamentos</h3>'
      + (resumo ? '<dl class="status">' + resumo + '</dl>' : '<p class="suave">Nenhuma armadura equipada.</p>') + '</div></div></div>'
      + '</div><div class="pg-mochila"><h3 class="subtitulo">Mochila</h3>' + abas
      + '<p class="suave pequeno dica-mochila">' + (temMouse ? 'Passe o mouse num item para ver a ficha; o botão direito equipa.' : 'Toque num item para ver a ficha e equipar.') + '</p>'
      + baixo + '</div></div>';
  }

  // ----- Consumíveis: pergaminhos (e, no futuro, cristais e outros), empilhados com a quantidade -----
  function itemConsumivel(c) { return { tipo: c.tipo, classe: null, raridade: c.raridade, encanto: 0 }; }
  // Craft (materiais, receitas, proteções): cor pela importância e ícone simples (sem arte ainda).
  function corConsumivel(c) {
    if (c.tipo === 'material') { var m = D.CRAFT.materiais[c.raridade] || {}; return m.chefe ? 'epica' : m.minas ? 'rara' : 'comum'; }
    if (c.tipo === 'receita') return 'rara';
    return D.raridades[c.raridade] ? c.raridade : 'comum';
  }
  var ICONE_CRAFT = { material: '⛏', receita: '📜', protecao: '🛡' };
  function iconeConsumivel(c) {
    // Arte (Daniel, Gemini): assets/itens/material-<id>.webp, receita.webp e protecao.webp.
    var arte = c.tipo === 'material' ? 'material-' + c.raridade : c.tipo === 'receita' || c.tipo === 'protecao' ? c.tipo : null;
    if (arte) return '<img class="icone-craft-img" src="assets/itens/' + arte + '.webp" alt="">';
    if (c.tipo === 'material' && c.raridade === 'gema') return '<span class="icone-craft">💎</span>';
    if (c.tipo === 'material' && (D.CRAFT.materiais[c.raridade] || {}).chefe) return '<span class="icone-craft">🔥</span>';
    return ICONE_CRAFT[c.tipo] ? '<span class="icone-craft">' + ICONE_CRAFT[c.tipo] + '</span>' : F.icone(itemConsumivel(c));
  }
  function consumiveisHtml(lista) {
    if (!lista.length) return '<p class="suave">Nenhum consumível. Pergaminhos de encantamento caem dos monstros da caçada (mais no 3º de cada área), dos chefes, '
      + 'das masmorras e vêm das missões. Cristais sobram quando um item quebra na Forja.</p>';
    var celulas = lista.map(function (c) {
      return '<button class="celula borda-' + corConsumivel(c) + (estado.consumivelFoco === c.id ? ' focado' : '') + '" data-acao="consumivel" data-id="' + c.id + '"'
        + ' title="' + esc(R.nomeConsumivel(c)) + ' · ' + c.qtd + '">' + iconeConsumivel(c)
        + '<span class="qtd-consumivel">' + c.qtd.toLocaleString('pt-BR') + '</span></button>';
    });
    for (var n = lista.length; n < 8; n++) celulas.push('<div class="celula vazia"></div>');
    return '<p class="suave pequeno">Clique num consumível para ver para que serve. Não ocupam espaço na mochila.</p>'
      + '<div class="mochila consumiveis">' + celulas.join('') + '</div>';
  }
  function fichaConsumivelHtml(c) {
    var def = D.CONSUMIVEIS[c.tipo] || {};
    var cor = corConsumivel(c), craft = !!ICONE_CRAFT[c.tipo];
    var acoes = c.tipo === 'pergaminho'
      ? '<button class="btn" data-acao="aba" data-aba="encantar">Ir para Encantar</button>'
        + (R.proximaRaridade(c.raridade) ? '<button class="btn secundario" data-acao="aba" data-aba="mercado">Trocar no Mercado</button>' : '')
      : craft ? '<button class="btn" data-acao="aba" data-aba="oficina">Ir para a Oficina</button>' : '';
    return '<div class="ficha-item-topo"><div class="icone-grande borda-' + cor + '">' + iconeConsumivel(c) + '</div>'
      + '<div><div class="ficha-item-nome raridade-' + cor + '">' + esc(R.nomeConsumivel(c)) + '</div>'
      + '<div class="suave">' + (craft ? 'Craft' : 'Consumível') + ' · <span class="raridade-' + cor + '">' + D.raridades[cor].nome + '</span>'
      + ' · você tem <strong>' + c.qtd.toLocaleString('pt-BR') + '</strong></div></div></div>'
      + '<p class="suave">' + (c.tipo === 'pergaminho' ? 'Para encantar itens de raridade ' + D.raridades[c.raridade].nome.toLowerCase() + '. ' : '') + (def.descricao || '') + '</p>'
      + '<div class="item-acoes">' + acoes + '</div>';
  }

  // ----- Mochila: ordem, filtro, trava e venda em lote -----
  // A ordem e o filtro só mudam a visão (os dados do personagem ficam iguais); "Organizar" grava a ordem.
  // Marcar itens e mudar o filtro só trocam classes e a posição dos quadros, sem redesenhar a tela.
  var ORDENS = [['mochila', 'Ordem da mochila'], ['forca', 'Força'], ['raridade', 'Raridade'], ['encanto', 'Encanto'], ['tipo', 'Tipo']];
  function visaoMochila() {
    return estado.mochilaVisao || (estado.mochilaVisao = { ordem: 'mochila', crescente: false, raridades: [], forcaMin: 0 });
  }
  var SETA_MELHOR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 14 9H10v5H6V9H2z" fill="currentColor"/></svg>';
  function celulaMochila(item) {
    var v = visaoMochila(), lote = estado.vendaLote;
    var html = quadroItem(item, 'celula' + (R.passaFiltro(item, v) ? '' : ' apagado') + (lote && lote.ids[item.id] ? ' marcado' : ''),
      ' data-forca="' + R.forcaItem(item) + '"');
    // Seta verde: equipar este item deixaria o herói mais forte que o equipado agora.
    if (R.itemMelhor(estado.personagem, item)) html = html.replace('>' + F.icone(item), '>' + F.icone(item) + '<span class="seta-melhor" title="Melhor que o equipado">' + SETA_MELHOR + '</span>');
    return lote ? html.replace('data-acao="item"', 'data-acao="marcar"') : html;
  }
  function barraMochilaHtml() {
    var v = visaoMochila(), lote = estado.vendaLote;
    var botaoLote = '<button class="btn btn-pequeno' + (lote ? ' perigo' : ' secundario') + '" data-acao="mochila-lote">' + (lote ? 'Sair da venda' : '💰 Vender vários') + '</button>';
    var html = '<div class="mochila-barra">' + (CELULAR ? '<div class="mochila-celular-topo"><details class="mochila-ferramentas"' + (estado.mochilaFerramentas ? ' open' : '')
      + '><summary data-acao="mochila-ferramentas">⚙ Ordenar e filtrar</summary>' : '') + '<div class="mochila-linha">'
      + '<label class="mochila-campo">Ordenar <select id="ordem-mochila">' + ORDENS.map(function (o) {
        return '<option value="' + o[0] + '"' + (v.ordem === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>'
      + '<button class="btn secundario btn-pequeno" data-acao="mochila-direcao"' + (v.ordem === 'mochila' ? ' disabled' : '') + '>'
      + (v.crescente ? '↑ Crescente' : '↓ Decrescente') + '</button>'
      + '<button class="btn secundario btn-pequeno" data-acao="mochila-organizar" title="Grava esta ordem na mochila">Organizar</button>'
      + (CELULAR ? '' : botaoLote) + '</div>'
      + '<div class="mochila-linha"><span class="suave pequeno">Mostrar:</span>' + R.RARIDADES.map(function (k) {
        return '<button class="chip-raridade raridade-' + k + (v.raridades.indexOf(k) >= 0 ? ' ativa' : '') + '" data-acao="mochila-filtro" data-valor="' + k + '">' + D.raridades[k].nome + '</button>';
      }).join('')
      + '<label class="mochila-campo">Força mín. <input id="forca-min" type="number" min="0" step="10" inputmode="numeric" value="' + (v.forcaMin || '') + '" placeholder="0"></label></div>'
      + (CELULAR ? '</details>' + botaoLote + '</div>' : '');
    if (lote) {
      html += '<div class="venda-lote"><span class="suave pequeno">Selecionar:</span>'
        + [['comum', 'Comuns'], ['rara', 'Até Raras'], ['epica', 'Até Épicas']].map(function (x) {
          return '<button class="chip-raridade raridade-' + x[0] + '" data-acao="lote-ate" data-valor="' + x[0] + '">' + x[1] + '</button>';
        }).join('') + '<button class="chip-raridade" data-acao="lote-limpar">Limpar</button>'
        + '<span class="lote-total" id="lote-total"></span>'
        + '<button class="btn perigo btn-pequeno" id="lote-vender" data-acao="lote-vender"></button>'
        + '<p class="suave pequeno lote-dica">Toque nos itens para marcar. Itens com cadeado não podem ser vendidos.</p></div>';
    }
    return html + '</div>';
  }
  function aplicarVisaoMochila() {
    var grade = document.querySelector('.mochila');
    if (!grade) return;
    var p = estado.personagem, v = visaoMochila(), lote = estado.vendaLote;
    var celulas = {};
    grade.querySelectorAll('[data-id]').forEach(function (el) { celulas[el.dataset.id] = el; });
    var vazias = grade.querySelectorAll('.celula.vazia');
    R.ordenarItens(R.mochila(p), v.ordem, v.crescente).forEach(function (it) {
      var el = celulas[it.id];
      if (!el) return;
      el.classList.toggle('apagado', !R.passaFiltro(it, v));
      el.classList.toggle('marcado', !!(lote && lote.ids[it.id]));
      grade.appendChild(el);
    });
    vazias.forEach(function (el) { grade.appendChild(el); });
    atualizarTotalLote();
  }
  function atualizarTotalLote() {
    var lote = estado.vendaLote, total = document.getElementById('lote-total'), botao = document.getElementById('lote-vender');
    if (!lote || !total || !botao) return;
    var ids = Object.keys(lote.ids), ouro = R.valorVenda(estado.personagem, ids);
    total.innerHTML = ids.length + ' item(ns) · <strong class="cor-ouro">+' + ouro.toLocaleString('pt-BR') + ' de ouro</strong>';
    botao.disabled = !ids.length;
    botao.textContent = lote.confirmar ? 'Confirmar: vender ' + ids.length : 'Vender selecionados';
    botao.classList.toggle('confirmar', !!lote.confirmar);
  }

  // Linha do Mercado por tipo: preço do level do herói; o item vem com nível ±3 e qualidade comum ou rara.
  function linhaMercadoNivel(modelo, especifico) {
    var p = estado.personagem, preco = R.precoMercado(p), falta = preco - p.ouro;
    var n0 = Math.max(1, p.nivel - D.ITEM_NIVEL.variacao), n1 = Math.min(D.ITEM_NIVEL.maximo, p.nivel + D.ITEM_NIVEL.variacao), desc;
    if (modelo.tipo === 'arma') {
      var t = R.tipoArma(modelo), a = R.danoDoNivel(n0, 0), b = R.danoDoNivel(n1, 0.7);
      desc = 'Dano ' + Math.round(a[0] * t.fator) + '–' + Math.round(b[1] * t.fator) + ' · ' + D.NOME_VELOCIDADE[t.vel] + (t.duasMaos ? ' · duas mãos' : '');
    } else {
      var def = R.definicao(modelo);
      desc = Object.keys(def.bonus).map(function (k) { return D.bonus[k] + ' +' + R.bonusDoNivel(def.bonus[k][1], n0, 0) + '–' + R.bonusDoNivel(def.bonus[k][1], n1, 0.7); }).join(' · ');
    }
    var nome = modelo.tipo === 'arma' ? R.tipoArma(modelo).nome : modelo.tipo === 'secundaria' ? D.MAO_ESQUERDA[modelo.mao].nome : R.definicao(modelo).tipo;
    return '<div class="item item-com-icone carta-rara"><div class="icone-pequeno borda-rara">' + F.icone(modelo) + '</div>'
      + '<div class="item-texto"><div><strong>' + nome + '</strong> <span class="suave pequeno">nível ' + n0 + '–' + n1 + '</span></div>'
      + '<div class="suave">' + desc + ' · ' + preco.toLocaleString('pt-BR') + ' de ouro</div></div>'
      + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta.toLocaleString('pt-BR') + ' de ouro</span>' : '')
      + '<button class="btn" data-acao="comprar" data-tipo="' + modelo.tipo + '" data-especifico="' + (especifico || '') + '"' + (falta > 0 ? ' disabled' : '') + '>Comprar</button></div></div>';
  }
  function linhaMercado(modelo) {
    var p = estado.personagem, r = D.raridades[modelo.raridade], preco = r.compra, rep = r.compraReputacao || 0;
    var falta = preco - p.ouro, faltaRep = rep - (p.reputacao || 0), faltas = [];
    if (falta > 0) faltas.push(falta.toLocaleString('pt-BR') + ' de ouro');
    if (faltaRep > 0) faltas.push(faltaRep.toLocaleString('pt-BR') + ' de reputação');
    return '<div class="item item-com-icone carta-' + modelo.raridade + '"><div class="icone-pequeno borda-' + modelo.raridade + '">' + F.icone(modelo) + '</div>'
      + '<div class="item-texto"><div>' + nomeItemHtml(modelo) + ' <span class="selo raridade-' + modelo.raridade + '">' + r.nome + '</span></div>'
      + '<div class="suave">' + descricaoItem(modelo) + ' · ' + preco.toLocaleString('pt-BR') + ' de ouro'
      + (rep ? ' + ' + rep.toLocaleString('pt-BR') + ' de reputação' : '') + '</div></div>'
      + '<div class="item-acoes">' + (faltas.length ? '<span class="suave">Faltam ' + faltas.join(' e ') + '</span>' : '')
      + '<button class="btn" data-acao="comprar" data-tipo="' + modelo.tipo + '" data-raridade="' + modelo.raridade + '" data-especifico="' + (modelo.arma || modelo.mao || '') + '"'
      + (faltas.length ? ' disabled' : '') + '>Comprar</button></div></div>';
  }

  // Arte dos itens da Loja que não são equipamento (Daniel, Gemini, nov/2026): assets/itens/<nome>.webp
  function arteLoja(nome) { return '<img class="icone-arte-loja" src="assets/itens/' + nome + '.webp" alt="">'; }
  function linhaRecomecoHab(p) {
    var R2 = D.RECOMECO_HABILIDADES, falta = R2.precoOuro - (p.ouro || 0);
    return '<div class="item item-com-icone carta-lendaria"><div class="icone-pequeno borda-lendaria icone-recomeco">' + arteLoja('recomeco-habilidades') + '</div>'
      + '<div class="item-texto"><div><span class="raridade-lendaria">' + R2.nome + '</span></div>'
      + '<div class="suave">Devolve os pontos de habilidade e deixa escolher a segunda classe de novo · '
      + R2.precoOuro.toLocaleString('pt-BR') + ' de ouro · você tem ' + (p.recomecosHab || 0) + '</div></div>'
      + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta.toLocaleString('pt-BR') + ' de ouro</span>' : '')
      + '<button class="btn" data-acao="hab-pergaminho-comprar"' + (falta > 0 ? ' disabled' : '') + '>Comprar</button></div></div>';
  }

  // ----- Aba Habilidades: habilidade inicial, segunda classe, pontos e ordem de uso -----
  var TIPO_HAB = { unico: 'Golpe', multiplo: 'Golpe duplo', area: 'Área', atordoar: 'Atordoar', reforco: 'Reforço', furtivo: 'Reforço', provocar: 'Reforço', cura: 'Cura', passiva: 'Passiva',
    dot: 'Veneno', escudo: 'Escudo', cegar: 'Cegueira' };
  // Habilidades do level 20 (caçada e masmorra) e do level 30 (Arena): o efeito com N pontos.
  function efeitoNivel(def, n) {
    var v = function (c) { return String(R.valorNivel(def[c], n)).replace('.', ','); };
    var x = [];
    if (def.regenPct) x.push('recupera <b>' + v('regenPct') + '%</b> da vida a cada turno');
    if (def.rouboVida) x.push('<b>' + v('rouboVida') + '%</b> do dano que você causa vira vida');
    if (def.reducaoDano) x.push('recebe <b>' + v('reducaoDano') + '%</b> menos dano');
    if (def.danoExtraPct) x.push('causa <b>+' + v('danoExtraPct') + '%</b> de dano');
    if (def.curaEmergencia) x.push('uma vez por luta, abaixo de ' + def.limiar + '% da vida, recupera <b>' + v('curaEmergencia') + '%</b>');
    if (def.dotPct) x.push((def.curaDot ? 'sangramento' : 'veneno') + ' de <b>' + v('dotPct') + '%</b> do seu dano por turno, por ' + def.turnos + ' turnos'
      + (def.curaDot ? '; você recupera ' + def.curaDot + '% do que ele tira' : '') + (def.pula ? '; pula para outro monstro; cada monstro morto pelo veneno cura ' + def.curaMorte + '%' : ''));
    if (def.escudoPct) x.push('escudo que segura <b>' + v('escudoPct') + '%</b> da vida por ' + def.turnos + ' turnos; quem bate tem ' + def.congelaChance + '% de chance de congelar');
    if (def.mult) x.push('golpe de <b>' + v('mult') + '%</b>' + (def.ignoraDefesaPct ? ' que ignora ' + def.ignoraDefesaPct + '% da defesa' : ''));
    if (def.vidaFaltando) x.push('+' + String(def.vidaFaltando).replace('.', ',') + '% de dano para cada 1% de vida que falta');
    if (def.silencia) x.push('o oponente fica ' + def.silencia + ' vez sem habilidades');
    if (def.garantido) x.push('sempre vale o 20 do dado e não pode ser esquivado');
    if (def.executa) x.push('<b>+' + def.executa.bonus + '%</b> se o oponente tiver menos de ' + def.executa.abaixo + '% da vida');
    if (def.queima) x.push('queima por ' + def.queima.turnos + ' vezes (' + def.queima.pct + '% do seu dano) e corta as curas pela metade');
    if (def.quebraDefesaPct) x.push('prende por ' + def.atordoa + ' vez e tira ' + def.quebraDefesaPct + '% da defesa até o fim da luta');
    if (def.erroPct) x.push('por ' + def.turnos + ' vezes, o oponente tem ' + def.erroPct + '% de chance de errar');
    if (def.milagrePct) x.push('uma vez por luta, se cair, volta com <b>' + v('milagrePct') + '%</b> da vida');
    if (Array.isArray(def.defesaPct)) x.push('<b>+' + v('defesaPct') + '%</b> de defesa por ' + def.turnos + ' vezes e devolve ' + def.reflete + '% do dano recebido');
    var t = x.join('; ');
    return t.charAt(0).toUpperCase() + t.slice(1) + '.';
  }
  var CAMPO_HAB = { dano: 'dano', danoCritico: 'dano crítico', critico: 'chance de crítico', velocidade: 'velocidade', precisao: 'precisão',
    vidaPct: 'vida máxima', defesaPct: 'defesa', evasao: 'esquiva', danoCriticoMagico: 'dano crítico mágico', recompensa: 'ouro e exp' };
  var NOME_ATR = { for: 'Força', des: 'Destreza', res: 'Resistência', int: 'Inteligência', sor: 'Sorte' };
  // O que a habilidade faz com N pontos (com 0 pontos mostra como fica com 1).
  function efeitoHabilidade(def, pts) {
    var n = def.inicial ? 0 : Math.max(1, pts), T = D.TALENTOS;
    if (def.nivel) return efeitoNivel(def, n);
    var bonus = function () {
      return Object.keys(CAMPO_HAB).filter(function (c) { return def[c]; }).map(function (c) {
        return CAMPO_HAB[c] + ' +' + R.valorBonus(def, c, n) + '%';
      });
    };
    var turnos = function (t) { return t + (t === 1 ? ' turno' : ' turnos'); };
    switch (def.tipo) {
      case 'unico': return 'Golpe de <b>' + R.multHabilidade(def, n) + '%</b> do seu dano em um inimigo.';
      case 'multiplo': return '<b>' + (def.flechas || 2) + ' flechas</b> no mesmo turno, cada uma com <b>' + R.multHabilidade(def, n) + '%</b> do seu dano.';
      case 'area': return '<b>' + R.multHabilidade(def, n) + '%</b> do seu dano em cada inimigo'
        + (def.atordoa ? ' e ' + (def.congela ? 'congela' : 'atordoa') + ' todos por ' + turnos(def.atordoa) + ' (chefe: 1)' : '') + '.';
      case 'atordoar': return 'Golpe de <b>' + R.multHabilidade(def, n) + '%</b> e o inimigo fica parado por ' + turnos(def.atordoa) + ' (chefe: ' + T.atordoarChefeMax + ').';
      case 'reforco': return (def.grupo ? 'Você e o grupo: ' : '') + '<b>' + bonus().join(', ') + '</b> por ' + turnos(def.turnos) + '.';
      case 'furtivo': return 'Esquiva do próximo ataque e o seu próximo golpe é <b>crítico</b>' + (R.valorBonus(def, 'danoCritico', n) > 0 ? ' (+' + R.valorBonus(def, 'danoCritico', n) + '% de dano crítico)' : '') + '.';
      case 'provocar': return 'Os inimigos atacam só você por ' + turnos(def.turnos) + ' e a sua defesa sobe <b>' + R.valorBonus(def, 'defesaPct', n) + '%</b>.';
      case 'cura': return 'Cura <b>' + R.valorBonus(def, 'vidaPct', n) + '%</b> da vida máxima de todo o grupo. Na caçada vira dano no monstro.';
      case 'passiva': {
        var atr = def.atributos ? Object.keys(def.atributos).map(function (k) { return '+' + def.atributos[k] + ' de ' + NOME_ATR[k]; }) : [];
        return 'Sempre: <b>' + atr.concat(bonus()).join(', ') + '</b>.';
      }
    }
    return def.descricao || '';
  }
  function emGrupo(def) { return def.tipo === 'provocar' || def.tipo === 'cura' || def.grupo || (def.tipo === 'area'); }
  // pts: distribuídos; arma: pontos extras da arma equipada (passam do limite de 10).
  // Ícone da habilidade: assets/habilidades/<id>.webp (quadrado, com fundo). Sem a arte, não mostra nada.
  var habSemIcone = {};
  function iconeHab(def, cls) {
    if (!def || !def.id || habSemIcone[def.id]) return '';
    return '<img class="hab-ico' + (cls ? ' ' + cls : '') + '" src="assets/habilidades/' + def.id + '.webp" alt="" data-hab="' + def.id + '">';
  }
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img && img.tagName === 'IMG' && img.classList.contains('hab-ico')) { habSemIcone[img.dataset.hab] = true; img.remove(); }
  }, true);
  function cartaHabilidade(def, pts, pend, editavel, arma) {
    var dist = pts + (pend || 0), total = dist + (arma || 0), max = D.TALENTOS.maxPorHabilidade;
    var trancada = def.nivel && !R.habLiberada(estado.personagem, def);
    // passivas fixas (nov/2026): sempre ligadas com o valor de 1 ponto, sem botões
    if (def.tipo === 'passiva') { total = trancada ? 0 : 1; editavel = false; }
    return '<div class="carta-hab' + (def.tipo === 'passiva' ? ' passiva' : '') + (total ? '' : ' sem-ponto') + (trancada ? ' trancada' : '') + '">'
      + '<div class="hab-topo"><span class="hab-titulo">' + iconeHab(def) + '<strong>' + def.nome + '</strong></span><span class="hab-tipo">' + TIPO_HAB[def.tipo] + '</span></div>'
      + (def.nivel ? '<p class="hab-nivel">' + (trancada ? '🔒 Libera no level ' + def.nivel : 'Level ' + def.nivel) + ' · ' + (def.foco === 'cacada' ? 'mais forte na caçada' : 'mais forte na Arena') + '</p>' : '')
      + '<p class="hab-efeito">' + efeitoHabilidade(def, total) + '</p>'
      + '<p class="suave pequeno">' + (def.recarga ? 'Recarga: ' + def.recarga + ' turnos' : 'Sempre ligada') + (emGrupo(def) && def.tipo !== 'passiva' ? ' · melhor em grupo' : '')
      + (def.tipo === 'reforco' || def.tipo === 'furtivo' || def.tipo === 'provocar' || def.tipo === 'dot' || def.tipo === 'escudo' || def.tipo === 'cegar' ? ' · não gasta a vez' : '') + '</p>'
      + (editavel && !trancada ? '<div class="hab-pontos"><button class="btn-mini" data-acao="hab-menos" data-id="' + def.id + '"' + (pend ? '' : ' disabled') + '>−</button>'
        + '<span><b>' + dist + '</b>/' + max + (pend ? ' <em class="mais">(+' + pend + ')</em>' : '') + (arma ? ' <em class="raridade-lendaria" title="Pontos da arma equipada">+' + arma + ' da arma</em>' : '') + '</span>'
        + '<button class="btn-mini" data-acao="hab-mais" data-id="' + def.id + '"' + (dist >= max ? ' disabled' : '') + '>+</button></div>' : '')
      + '</div>';
  }
  function pendHab() { return estado.habPend || (estado.habPend = {}); }
  function totalPendHab() { var t = 0, pd = pendHab(); Object.keys(pd).forEach(function (k) { t += pd[k]; }); return t; }
  function seloHabilidades() {
    var p = estado.personagem;
    if (!p || p.nivel < D.TALENTOS.nivelSegunda) return '';
    var n = R.segundaClasse(p) ? R.pontosHabilidadeLivres(p) : 1;
    return n > 0 ? ' <span class="selo-pedidos">' + (R.segundaClasse(p) ? n : '!') + '</span>' : '';
  }
  function abaHabilidades() {
    var p = estado.personagem, T = D.TALENTOS, c = R.segundaClasse(p), fem = p.sexo === 'feminino';
    var h = '';
    if (!c) {
      var ini = D.HABILIDADE_INICIAL[p.classe];
      h += '<h3 class="subtitulo">Habilidade de ' + nomeClasse(p.classe, p.sexo) + '</h3><div class="grade-hab">'
        + cartaHabilidade(Object.assign({ inicial: true }, ini), 0, 0, false) + '</div>'
        + '<p class="suave pequeno">Usada sozinha na luta sempre que estiver pronta.</p>';
      var opcoes = R.opcoesSegundaClasse(p.classe), pode = p.nivel >= T.nivelSegunda;
      // A escolha da segunda classe só aparece a partir do level 10.
      if (pode) h += '<h3 class="subtitulo">Segunda classe ' + (pode ? '— escolha a sua' : '<span class="suave">— libera no level ' + T.nivelSegunda + '</span>') + '</h3>'
        + (pode ? '<p class="suave pequeno">Escolha com calma: só dá para trocar com o ' + D.RECOMECO_HABILIDADES.nome + ' (Mercado). Você ganha '
          + T.pontosIniciais + ' pontos agora e +' + T.pontosPorNivel + ' a cada level.</p>' : '')
        + '<div class="escolha-classe2">' + opcoes.map(function (id) {
          var sc = D.SEGUNDAS_CLASSES[id];
          return '<div class="classe2"><div class="classe2-retrato moldura">' + F.personagem(p.raca, id, p.sexo) + '</div>'
            + '<h4>' + (fem && sc.nomeF || sc.nome) + '</h4><p class="suave">' + sc.descricao + '</p>'
            + (CELULAR ? '<details class="classe2-habs"><summary>Ver as ' + sc.habilidades.length + ' habilidades</summary>' : '') + '<ul>' + sc.habilidades.map(function (x) { return '<li><b>' + x.nome + '</b> <span class="hab-tipo">' + TIPO_HAB[x.tipo] + '</span>' + (x.nivel ? ' <span class="suave pequeno">(level ' + x.nivel + ')</span>' : '') + '<br><span class="suave pequeno">' + x.descricao + '</span></li>'; }).join('') + '</ul>' + (CELULAR ? '</details>' : '')
            + (pode ? '<button class="btn" data-acao="hab-classe" data-valor="' + id + '">Ser ' + (fem && sc.nomeF || sc.nome) + '</button>' : '') + '</div>';
        }).join('') + '</div>';
    } else {
      var livres = R.pontosHabilidadeLivres(p) - totalPendHab(), pd = pendHab();
      h += '<div class="hab-cabeca"><div><h3 class="subtitulo">' + (fem && c.nomeF || c.nome) + '</h3><p class="suave pequeno">' + c.descricao + '</p></div>'
        + '<div class="hab-livres">Pontos livres <b>' + livres + '</b></div></div>'
        + (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '') + '<p class="suave pequeno">Cada habilidade precisa de pelo menos 1 ponto para ser usada (máximo ' + T.maxPorHabilidade + '). '
        + 'As passivas ficam sempre ligadas e não recebem pontos. Você ganha +' + T.pontosPorNivel + ' ponto a cada level' + (T.pontosDepois ? ' (+' + T.pontosDepois.porNivel + ' a partir do level ' + (T.pontosDepois.nivel + 1) + ')' : '') + '.</p>' + (CELULAR ? '</details>' : '')
        + '<div class="grade-hab">' + c.habilidades.map(function (x) { return cartaHabilidade(x, R.pontosDistribuidos(p, x.id), pd[x.id] || 0, true, R.pontosDaArma(p)[x.id] || 0); }).join('') + '</div>'
        + (totalPendHab() ? '<div class="botoes"><button class="btn" data-acao="hab-confirmar">Confirmar pontos</button><button class="btn secundario" data-acao="hab-cancelar">Cancelar</button></div>' : '');
      var ativas = c.habilidades.filter(function (x) { return x.tipo !== 'passiva'; });
      h += '<h3 class="subtitulo">Ordem de uso</h3>' + (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '') + '<p class="suave pequeno">Na luta, a cada vez do herói, ele usa a primeira habilidade pronta desta lista. '
        + 'Se nenhuma estiver pronta, ataca normalmente. <b>Arena · Defesa</b> é a ordem usada quando outro jogador desafia você.</p><p class="suave pequeno">Na Arena não existe crítico: os bônus de crítico viram dano, '
        + 'a Sombra desvia do próximo golpe e faz o seguinte valer o 20 do dado. Fora isso, esquiva e precisão não contam: só o 1 do dado erra.</p>' + (CELULAR ? '</details>' : '') + '<div class="ordem-hab">'
        + [['cacada', 'Caçada'], ['masmorra', 'Masmorra'], ['arena', 'Arena · Ataque'], ['defesa', 'Arena · Defesa']].map(function (m) {
          var lista = R.talentos(p).ordem[m[0]], fora = ativas.filter(function (x) { return lista.indexOf(x.id) < 0; });
          return '<div class="ordem-col"><h4>' + m[1] + '' + '</h4><ol>'
            + lista.map(function (id, i) {
              var x = ativas.filter(function (a) { return a.id === id; })[0];
              if (!x) return '';
              var b = function (op, txt, off) { return '<button class="btn-mini" data-acao="hab-ordem" data-modo="' + m[0] + '" data-id="' + id + '" data-op="' + op + '"' + (off ? ' disabled' : '') + ' title="' + op + '">' + txt + '</button>'; };
              return '<li' + (R.pontosEm(p, id) ? '' : ' class="sem-ponto"') + '><span><b class="ordem-n">' + (i + 1) + '.</b> ' + x.nome + (R.pontosEm(p, id) ? '' : ' <em class="suave">(sem ponto)</em>') + '</span>'
                + b('subir', '↑', i === 0) + b('descer', '↓', i === lista.length - 1) + b('tirar', '✕') + '</li>';
            }).join('') + '</ol>'
            + (fora.length ? '<div class="ordem-fora">' + fora.map(function (x) {
              return '<button class="btn-mini largo" data-acao="hab-ordem" data-modo="' + m[0] + '" data-id="' + x.id + '" data-op="por">+ ' + x.nome + '</button>';
            }).join('') + '</div>' : '') + '</div>';
        }).join('') + '</div>';
    }
    if (p.recomecosHab) h += '<div class="recomeco-ficha"><span>📘 ' + D.RECOMECO_HABILIDADES.nome + ': <strong>' + p.recomecosHab + '</strong></span>'
      + (c ? '<button class="btn secundario btn-pequeno" data-acao="hab-pergaminho-usar">Usar</button>' : '') + '</div>';
    return h;
  }

  // Poção de vida (ouro, preço pelo level) e pote de estamina (reputação, 2 por dia).
  function linhaPocaoVida(p) {
    var preco = R.precoPocao(p), max = R.maxPocoes(p), cheio = (p.pocoes || 0) >= max, falta = preco - (p.ouro || 0);
    return '<div class="item item-com-icone"><div class="icone-pequeno icone-recomeco">' + arteLoja('pocao-vida') + '</div>'
      + '<div class="item-texto"><div><strong>Poção de vida</strong></div>'
      + '<div class="suave">Enche a vida no meio de uma luta da caçada (não vale na Arena, masmorra nem Chefe Mundial) · '
      + preco.toLocaleString('pt-BR') + ' de ouro · você tem ' + (p.pocoes || 0) + '/' + max + ' (2 de graça todo dia)</div></div>'
      + '<div class="item-acoes">' + (cheio ? '<span class="suave">Máximo guardado</span>' : falta > 0 ? '<span class="suave">Faltam ' + falta.toLocaleString('pt-BR') + ' de ouro</span>' : '')
      + '<button class="btn" data-acao="pocao-comprar"' + (cheio || falta > 0 ? ' disabled' : '') + '>Comprar</button></div></div>';
  }
  function linhaPoteEstamina(p) {
    var preco = R.precoPoteEstamina(p), E = D.ESTAMINA, usados = R.estamina(p).potes || 0, falta = preco == null ? 0 : preco - (p.reputacao || 0);
    return '<div class="item item-com-icone"><div class="icone-pequeno icone-recomeco">' + arteLoja('pote-estamina') + '</div>'
      + '<div class="item-texto"><div><strong>Pote de estamina</strong></div>'
      + '<div class="suave">+' + E.pote.enche + ' de estamina na hora · ' + (preco == null ? 'os ' + E.pote.precos.length + ' de hoje já foram' : preco + ' de reputação')
      + ' · ' + usados + '/' + E.pote.precos.length + ' hoje (1º ' + E.pote.precos[0] + ', 2º ' + E.pote.precos[1] + ' de reputação) · você tem '
      + (p.reputacao || 0).toLocaleString('pt-BR') + ' de reputação</div></div>'
      + '<div class="item-acoes">' + (preco == null ? '<span class="suave">Volta amanhã</span>' : falta > 0 ? '<span class="suave">Faltam ' + falta + ' de reputação</span>' : '')
      + '<button class="btn" data-acao="pote-estamina"' + (preco == null || falta > 0 ? ' disabled' : '') + '>Beber</button></div></div>';
  }
  function linhaRecomeco(p) {
    var preco = D.RECOMECO.precoOuro, falta = preco - (p.ouro || 0);
    return '<div class="item item-com-icone carta-lendaria"><div class="icone-pequeno borda-lendaria icone-recomeco">' + arteLoja('recomeco') + '</div>'
      + '<div class="item-texto"><div><span class="raridade-lendaria">' + D.RECOMECO.nome + '</span></div>'
      + '<div class="suave">Devolve todos os pontos de atributo para você distribuir de novo · '
      + preco.toLocaleString('pt-BR') + ' de ouro · você tem ' + (p.recomecos || 0) + '</div></div>'
      + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta.toLocaleString('pt-BR') + ' de ouro</span>' : '')
      + '<button class="btn" data-acao="recomeco-comprar"' + (falta > 0 ? ' disabled' : '') + '>Comprar</button></div></div>';
  }

  // Celular: a Loja vira seções (fichas no topo) em vez de uma página comprida.
  var SECOES_LOJA = [['jogadores', '🤝 Jogadores'], ['reino', '⚔ Loja do Reino'], ['pocoes', '🧪 Poções'], ['skins', '🎲 Skins'], ['especiais', '📜 Especiais']];
  function abaMercado() {
    var p = estado.personagem;
    if (CELULAR) {
      var sec = estado.lojaSecao || 'jogadores', partes = mercadoPartes(p);
      return '<div class="loja-secoes">' + SECOES_LOJA.map(function (x) {
        return '<button class="btn btn-pequeno' + (x[0] === sec ? ' sel' : ' secundario') + '" data-acao="loja-secao" data-valor="' + x[0] + '">' + x[1] + '</button>';
      }).join('') + '</div>' + '<p class="suave pequeno loja-ouro">' + ICONES.ouro + ' <strong class="cor-ouro">' + p.ouro.toLocaleString('pt-BR') + '</strong> · mochila ' + R.mochila(p).length + '/' + D.MOCHILA_MAX + '</p>'
        + partes[sec] + (sec === 'especiais' ? partes.troca : '');
    }
    return mercadoPartesTudo(p);
  }
  // A Loja em partes: no computador vão todas juntas; no celular, uma por vez (fichas no topo).
  function mercadoPartes(p) {
    var nivelTxt = '<strong>' + Math.max(1, p.nivel - D.ITEM_NIVEL.variacao) + ' e ' + Math.min(D.ITEM_NIVEL.maximo, p.nivel + D.ITEM_NIVEL.variacao) + '</strong>';
    return {
      jogadores: '<h3 class="subtitulo">Itens dos jogadores</h3><div id="mercado-jogadores">' + mercadoJogadoresHtml() + '</div>',
      reino: '<p class="suave pequeno">Cada compra vem com nível sorteado entre ' + nivelTxt
        + ' (o seu level ±' + D.ITEM_NIVEL.variacao + ') e qualidade <span class="raridade-comum">Comum</span> ou <span class="raridade-rara">Rara</span>. '
        + 'Itens Épicos e Lendários só caem dos monstros (ou de outros jogadores).</p>'
        + '<h3 class="subtitulo">Armas de ' + nomeClasseP(p) + '</h3><div class="itens">'
        + R.armasPermitidas(p).map(function (a) { return linhaMercadoNivel({ tipo: 'arma', classe: D.TIPOS_ARMA[a].classe, arma: a, raridade: 'rara', encanto: 0 }, a); }).join('') + '</div>'
        + (R.maoPermitida(p).length ? '<h3 class="subtitulo">Mão esquerda</h3><div class="itens">' + R.maoPermitida(p).map(function (m) {
          return linhaMercadoNivel({ tipo: 'secundaria', classe: null, mao: m, raridade: 'rara', encanto: 0 }, m);
        }).join('') + '</div>' : '')
        + '<h3 class="subtitulo">Armaduras</h3><p class="suave pequeno">Colar e anel só nas masmorras.</p><div class="itens">'
        + R.TIPOS_ARMADURA.map(function (tipo) { return linhaMercadoNivel({ tipo: tipo, classe: p.classe, raridade: 'rara', encanto: 0 }, ''); }).join('') + '</div>',
      pocoes: '<h3 class="subtitulo">Poções</h3><div class="itens">' + linhaPocaoVida(p) + linhaPoteEstamina(p) + '</div>',
      especiais: '<h3 class="subtitulo">Itens especiais</h3><div class="itens">' + linhaRecomeco(p) + linhaRecomecoHab(p) + '</div>',
      troca: trocaPergaminhosHtml(p),
      skins: '<h3 class="subtitulo">Skins do Dado (Arena)</h3>'
        + '<p class="suave">Mudam a cor do seu D20 na Arena. O oponente vê o dado com a sua skin.</p><div class="skins">'
        + D.SKINS_DADO.map(function (k) {
          var tem = R.skinsDoPersonagem(p).indexOf(k.id) >= 0, uso = (p.skinDado || 'vermelho') === k.id;
          var botao = uso ? '<span class="online pequeno">✔ Em uso</span>'
            : tem ? '<button class="btn secundario" data-acao="skin-usar" data-valor="' + k.id + '">Usar</button>'
            : k.historia ? '<span class="suave pequeno">Prêmio da História</span>'
            : '<button class="btn" data-acao="skin-comprar" data-valor="' + k.id + '"' + (p.ouro < k.preco ? ' disabled' : '') + '>Comprar · ' + k.preco.toLocaleString('pt-BR') + ' de ouro</button>';
          return '<div class="skin-carta' + (uso ? ' em-uso' : '') + '">' + d20Bonito(20, k.id) + '<strong>' + k.nome + '</strong>'
            + '<span class="suave pequeno">' + (k.historia ? 'A Crônica de Eldrin' : k.preco ? k.preco.toLocaleString('pt-BR') + ' de ouro' : 'Grátis') + '</span>' + botao + '</div>';
        }).join('') + '</div>',
    };
  }
  function mercadoPartesTudo(p) {
    var x = mercadoPartes(p);
    return '<p class="suave">Você tem <strong class="cor-ouro">' + p.ouro.toLocaleString('pt-BR') + ' de ouro</strong> · mochila '
      + R.mochila(p).length + '/' + D.MOCHILA_MAX + '.</p>' + x.jogadores + x.reino + x.pocoes + x.especiais + x.skins + x.troca;
  }

  // ---------------- Mercado dos jogadores (Mercado > Loja) ----------------
  // O vendedor escolhe o preço; quem compra paga e o vendedor recebe o preço menos a taxa (10%). Tudo no servidor.
  var CATEGORIAS_MERCADO = [['todos', 'Tudo'], ['arma', 'Armas'], ['armadura', 'Armaduras'], ['joia', 'Joias'], ['pergaminho', 'Pergaminhos'], ['craft', 'Craft']];
  var TIPOS_CRAFT = ['material', 'receita', 'protecao'];
  var ORDENS_MERCADO = [['recentes', 'Mais novos'], ['nivel', 'Nível'], ['raridade', 'Raridade'], ['preco', 'Menor preço'], ['preco_desc', 'Maior preço']];
  function filtroMercado() { return estado.mercadoFiltro || (estado.mercadoFiltro = { categoria: 'todos', ordem: 'recentes', pagina: 0 }); }
  function itemAnuncio(a) {
    var it = a.item;
    if (TIPOS_CRAFT.indexOf(it.tipo) >= 0) {
      var cc = { tipo: it.tipo, classe: null, raridade: it.raridade, encanto: 0, qtd: a.qtd || it.qtd || 1, consumivel: true, craft: true };
      cc.cor = corConsumivel(cc);
      return cc;
    }
    return it.tipo === 'pergaminho' ? { tipo: 'pergaminho', classe: null, raridade: it.raridade, encanto: 0, qtd: a.qtd || it.qtd || 1, consumivel: true } : it;
  }
  function carregarMercado() {
    var p = estado.personagem;
    if (!p || estado.mercadoCarregando) return;
    var f = filtroMercado();
    estado.mercadoCarregando = true;
    // Só o que a minha classe usa: o servidor filtra com as regras daqui (armas, mão esquerda e armaduras da classe).
    var filtro = f.soClasse ? { classe: p.classe, armas: R.armasPermitidas(p), maos: R.maoPermitida(p), padrao: D.ARMA_PADRAO } : null;
    C.mercado.estado(p.id, f.categoria, f.ordem, f.pagina, filtro).then(function (r) {
      estado.mercadoCarregando = false;
      if (estado.personagem !== p) return;
      receberMercado(r);
    }, function (e) { estado.mercadoCarregando = false; estado.mercadoErro = e.message; redesenharMercado(); });
  }
  function receberMercado(r) {
    estado.mercado = r;
    estado.mercadoErro = null;
    if (r && !r.local) {
      aplicarCreditos(r.creditos || []);
      if (r.recompensas && r.recompensas.length && !estado.batalha) resgatarRecompensas(r.recompensas);
    }
    redesenharMercado();
  }
  function redesenharMercado() {
    var el = document.getElementById('mercado-jogadores');
    if (el && estado.aba === 'mercado') el.innerHTML = mercadoJogadoresHtml();
  }
  function cartaAnuncio(a, meu) {
    var p = estado.personagem, it = itemAnuncio(a), r = it.cor || it.raridade;
    var usa = it.consumivel || R.podeUsar(p, it);
    var nome = it.consumivel ? nomeDrop(it) : R.nomeItem(it);
    var resumo = it.consumivel ? 'Vai para Mochila › Consumíveis' : resumoLote({ item: it });
    var acao = meu ? '<button class="btn secundario" data-acao="mercado-cancelar" data-id="' + a.id + '">Cancelar venda</button>'
      : a.meu ? '<span class="suave pequeno">Seu anúncio</span>'
      : '<button class="btn" data-acao="mercado-comprar" data-id="' + a.id + '"' + (p.ouro < a.preco ? ' disabled title="Ouro insuficiente"' : '') + '>Comprar</button>';
    return '<div class="leilao-lote carta-' + r + '">'
      + '<div class="leilao-cab"><button class="icone-pequeno borda-' + r + aura(it) + '" data-acao="mercado-ver" data-id="' + a.id + '" title="Ver o item">'
      + (it.craft ? iconeConsumivel(it) : F.icone(it)) + (it.consumivel && it.qtd > 1 ? '<span class="qtd-consumivel">' + it.qtd + '</span>' : '') + '</button>'
      + '<div><div class="leilao-nome raridade-' + r + '">' + esc(nome) + '</div>'
      + '<div class="suave pequeno">' + D.raridades[r].nome + (it.nivel ? ' · nível ' + it.nivel : '') + (it.encanto ? ' · +' + it.encanto : '') + '</div>'
      + '<div class="suave pequeno">' + esc(resumo || '') + '</div>'
      + (usa ? '' : '<div class="menos pequeno">Sua classe não usa este item</div>')
      + (!meu && !it.consumivel && usa && dropMelhor(it) ? '<div class="mais pequeno">▲ Melhor que o seu equipado</div>' : '') + '</div></div>'
      + '<div>Preço: <strong class="cor-ouro">' + ouroTxt(a.preco) + '</strong></div>'
      + (a.vendedor ? '<div class="suave pequeno">Vendedor: <strong>' + esc(a.vendedor) + '</strong></div>' : '')
      + '<div class="suave pequeno">Sai do mercado em ' + tempoAnuncio(Date.parse(a.expira_em) - Date.now()) + '</div>'
      + '<div class="leilao-acao">' + acao + '</div></div>';
  }
  function tempoAnuncio(ms) {
    var h = Math.max(0, Math.floor(ms / 3600000));
    return h >= 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h' : relogioBoss(ms);
  }
  function mercadoJogadoresHtml() {
    var r = estado.mercado, f = filtroMercado(), p = estado.personagem;
    if (!r) { carregarMercado(); return '<p class="suave">Carregando os itens dos jogadores…</p>'; }
    if (r.local) return '<p class="suave">O mercado entre jogadores precisa do servidor: jogue pelo site do Eldrin.</p>';
    var taxa = r.cfg.taxa;
    var h = (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '') + '<p class="suave">Itens à venda por outros jogadores. Quem vende escolhe o preço e recebe o valor menos '
      + taxa + '% de taxa do mercado. Anúncios ficam ' + r.cfg.dias + ' dias; se ninguém comprar, o item volta para a mochila.</p>' + (CELULAR ? '</details>' : '')
      + '<div class="mercado-filtros">'
      + '<div class="mercado-cats">' + CATEGORIAS_MERCADO.map(function (c) {
        return '<button class="btn secundario btn-pequeno" data-acao="mercado-categoria" data-valor="' + c[0] + '" aria-pressed="' + (f.categoria === c[0]) + '">' + c[1] + '</button>';
      }).join('') + '</div>'
      + '<label class="mercado-ordem">Ordenar por <select id="mercado-ordem">' + ORDENS_MERCADO.map(function (o) {
        return '<option value="' + o[0] + '"' + (f.ordem === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>'
      + '<label class="mercado-so-classe"><input type="checkbox" data-acao="mercado-so-classe"' + (f.soClasse ? ' checked' : '') + '> Só o que a minha classe usa</label>'
      + '<button class="btn secundario btn-pequeno" data-acao="mercado-atualizar">Atualizar</button>'
      + '<button class="btn" data-acao="mercado-vender-abrir">Vender</button></div>';
    if (estado.mercadoErro) h += '<p class="menos">' + esc(estado.mercadoErro) + '</p>';
    if (estado.mercadoVender) h += vendaMercadoHtml(r);
    var lista = r.anuncios || [];
    h += lista.length ? '<div class="leilao-lotes">' + lista.map(function (a) { return cartaAnuncio(a, false); }).join('') + '</div>'
      : '<p class="suave">Nenhum item à venda' + (f.categoria !== 'todos' ? ' nesta categoria' : '') + ' agora.</p>';
    var paginas = Math.ceil((r.total || 0) / r.cfg.porPagina);
    if (paginas > 1) {
      h += '<div class="botoes"><button class="btn secundario btn-pequeno" data-acao="mercado-pagina" data-valor="-1"' + (f.pagina ? '' : ' disabled') + '>‹ Anterior</button>'
        + '<span class="suave">Página ' + (f.pagina + 1) + ' de ' + paginas + '</span>'
        + '<button class="btn secundario btn-pequeno" data-acao="mercado-pagina" data-valor="1"' + (f.pagina + 1 < paginas ? '' : ' disabled') + '>Próxima ›</button></div>';
    }
    if ((r.meus || []).length) {
      h += '<h3 class="subtitulo">Meus itens à venda (' + r.meus.length + '/' + r.cfg.maxAnuncios + ')</h3><div class="leilao-lotes">'
        + r.meus.map(function (a) { return cartaAnuncio(a, true); }).join('') + '</div>';
    }
    if ((r.vendas || []).length) {
      h += '<h3 class="subtitulo">Minhas últimas vendas</h3><ul class="mercado-vendas">' + r.vendas.map(function (v) {
        var it = itemAnuncio(v);
        return '<li>' + esc(it.consumivel ? nomeDrop(it) : R.nomeItem(it)) + ' → <strong>' + esc(v.comprador || '?') + '</strong> por <span class="cor-ouro">'
          + ouroTxt(v.preco) + '</span> (você recebeu ' + ouroTxt(Math.floor(v.preco * (100 - taxa) / 100)) + ')</li>';
      }).join('') + '</ul>';
    }
    return h + mercadoZoomHtml();
  }
  // Painel de venda: itens da mochila (não equipados, não travados) e pergaminhos.
  function vendaMercadoHtml(r) {
    var p = estado.personagem, taxa = r.cfg.taxa;
    var itens = R.mochila(p).filter(function (i) { return !i.travado; });
    var perg = R.RARIDADES.filter(function (k) { return R.qtdPergaminho(p, k) > 0; });
    var craft = R.consumiveis(p).filter(function (c) { return TIPOS_CRAFT.indexOf(c.tipo) >= 0; });
    function campoPreco(chave) {
      return '<input class="lance-valor venda-preco" id="venda-preco-' + chave + '" type="number" inputmode="numeric" min="1" step="1" placeholder="Preço" aria-label="Preço em ouro">'
        + '<span class="suave pequeno venda-recebe" id="venda-recebe-' + chave + '"></span>';
    }
    var h = '<div class="mercado-venda"><div class="mercado-venda-topo"><h3>Vender no mercado</h3>'
      + '<button class="btn secundario btn-pequeno" data-acao="mercado-vender-fechar">Fechar</button></div>'
      + '<p class="suave pequeno">Escolha o preço em ouro. Quando alguém comprar, você recebe o valor menos ' + taxa + '% de taxa. '
      + 'Itens equipados ou travados não aparecem aqui. Você pode ter até ' + r.cfg.maxAnuncios + ' itens à venda.</p>';
    if (!itens.length && !perg.length && !craft.length) return h + '<p class="suave">Nada para vender na mochila.</p></div>';
    h += '<div class="itens">' + itens.map(function (i) {
      return '<div class="item item-com-icone carta-' + i.raridade + '"><div class="icone-pequeno borda-' + i.raridade + aura(i) + '">' + F.icone(i) + '</div>'
        + '<div class="item-texto"><div>' + nomeItemHtml(i) + ' <span class="suave pequeno">' + D.raridades[i.raridade].nome + (i.nivel ? ' · nível ' + i.nivel : '') + '</span></div>'
        + '<div class="suave">' + esc(descricaoItem(i) || '') + '</div></div>'
        + '<div class="item-acoes">' + campoPreco(i.id) + '<button class="btn" data-acao="mercado-anunciar" data-id="' + esc(i.id) + '">Anunciar</button></div></div>';
    }).join('') + perg.map(function (k) {
      var it = { tipo: 'pergaminho', classe: null, raridade: k, encanto: 0, qtd: R.qtdPergaminho(p, k), consumivel: true };
      return '<div class="item item-com-icone carta-' + k + '"><div class="icone-pequeno borda-' + k + '">' + F.icone(it) + '</div>'
        + '<div class="item-texto"><div class="raridade-' + k + '">' + esc(R.nomeConsumivel(it)) + '</div><div class="suave">Você tem ' + it.qtd + '</div></div>'
        + '<div class="item-acoes"><input class="lance-valor" id="venda-qtd-' + k + '" type="number" inputmode="numeric" min="1" max="' + it.qtd + '" step="1" value="1" aria-label="Quantidade">'
        + campoPreco('perg-' + k) + '<button class="btn" data-acao="mercado-anunciar" data-pergaminho="' + k + '">Anunciar</button></div></div>';
    }).join('') + craft.map(function (c) {
      var k = c.tipo + ':' + c.raridade, cor = corConsumivel(c);
      return '<div class="item item-com-icone carta-' + cor + '"><div class="icone-pequeno borda-' + cor + '">' + iconeConsumivel(c) + '</div>'
        + '<div class="item-texto"><div class="raridade-' + cor + '">' + esc(R.nomeConsumivel(c)) + '</div><div class="suave">Você tem ' + c.qtd + '</div></div>'
        + '<div class="item-acoes"><input class="lance-valor" id="venda-qtd-' + k + '" type="number" inputmode="numeric" min="1" max="' + c.qtd + '" step="1" value="1" aria-label="Quantidade">'
        + campoPreco('perg-' + k) + '<button class="btn" data-acao="mercado-anunciar" data-pergaminho="' + k + '">Anunciar</button></div></div>';
    }).join('') + '</div></div>';
    return h;
  }
  function mercadoZoomHtml() {
    var r = estado.mercado, id = estado.mercadoVer;
    var a = r && [].concat(r.anuncios || [], r.meus || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!a || a.item.tipo === 'pergaminho' || TIPOS_CRAFT.indexOf(a.item.tipo) >= 0) return '';
    var p = estado.personagem, it = a.item, outro = R.podeUsar(p, it) ? itemParaComparar(p, it) : null;
    return '<div class="zoom-fundo leilao-zoom" data-acao="mercado-fechar"><div class="zoom-janela" role="dialog" aria-label="Item à venda">'
      + '<button class="zoom-x" data-acao="mercado-fechar" title="Fechar">✕</button>'
      + '<div class="zoom-cartas">' + cartaZoom(it, outro, 'À venda por ' + (a.vendedor || 'você')) + (outro ? cartaZoom(outro, null, 'Equipado') : '') + '</div>'
      + '<div class="botoes"><button class="btn secundario" data-acao="mercado-fechar">Fechar</button></div></div></div>';
  }
  async function anunciarMercado(el) {
    var p = estado.personagem, id = el.dataset.id || null, perg = el.dataset.pergaminho || null;
    var chave = id || 'perg-' + perg;
    var preco = Math.floor(Number((document.getElementById('venda-preco-' + chave) || {}).value));
    var qtd = perg ? Math.floor(Number((document.getElementById('venda-qtd-' + perg) || {}).value)) : 1;
    if (!(preco >= 1)) { avisar('Digite o preço em ouro.'); return; }
    var ctipo = perg && perg.indexOf(':') > 0 ? perg.split(':')[0] : 'pergaminho', crar = perg && perg.indexOf(':') > 0 ? perg.split(':')[1] : perg;
    if (perg && !(qtd >= 1 && qtd <= R.qtdConsumivel(p, ctipo, crar))) { avisar('Quantidade inválida.'); return; }
    if (estado.mercadoOcupado) return;
    estado.mercadoOcupado = true;
    try {
      p.poder = R.poder(p);
      await C.salvarPersonagem(p);              // o servidor tira o item do personagem salvo
      var r = await C.mercado.anunciar(p.id, id, perg, qtd, preco);
      if (id) p.inventario = p.inventario.filter(function (i) { return i.id !== id; });
      else R.mudarConsumivel(p, ctipo, crar, -qtd);
      salvar();
      avisar('Anunciado no mercado por ' + ouroTxt(preco) + ' de ouro.', 'item');
      receberMercado(r);
      atualizarFicha();
    } catch (e) { avisar(e.message); }
    estado.mercadoOcupado = false;
  }
  async function comprarMercado(id) {
    var p = estado.personagem, a = estado.mercado && (estado.mercado.anuncios || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!a || estado.mercadoOcupado) return;
    if (p.ouro < a.preco) { avisar('Ouro insuficiente.'); return; }
    if (a.item.tipo !== 'pergaminho' && TIPOS_CRAFT.indexOf(a.item.tipo) < 0 && R.mochilaCheia(p)) { avisar('Mochila cheia! Libere espaço antes de comprar.'); return; }
    estado.mercadoOcupado = true;
    try {
      p.poder = R.poder(p);
      await C.salvarPersonagem(p);              // o servidor confere o ouro salvo
      var r = await C.mercado.comprar(p.id, id);
      avisar('Compra feita! O item vai para a sua mochila.', 'item');
      receberMercado(r);
    } catch (e) { avisar(e.message); carregarMercado(); }
    estado.mercadoOcupado = false;
  }
  async function cancelarMercado(id) {
    var p = estado.personagem;
    if (estado.mercadoOcupado) return;
    estado.mercadoOcupado = true;
    try {
      var r = await C.mercado.cancelar(p.id, id);
      avisar('Anúncio cancelado: o item volta para a sua mochila.');
      receberMercado(r);
    } catch (e) { avisar(e.message); }
    estado.mercadoOcupado = false;
  }

  // Troca de pergaminhos de encantamento: 10 de uma raridade = 1 da seguinte.
  function trocaPergaminhosHtml(p) {
    var q = D.TROCA_PERGAMINHO.quantidade;
    return '<h3 class="subtitulo">Troca de Pergaminhos de Encantamento</h3>'
      + '<p class="suave">Junte ' + q + ' pergaminhos de uma raridade e troque por 1 da raridade seguinte.</p><div class="itens">'
      + R.RARIDADES.filter(function (k) { return R.proximaRaridade(k); }).map(function (k) {
        var para = R.proximaRaridade(k), tem = R.qtdPergaminho(p, k), falta = q - tem;
        return '<div class="item"><div>'
          + '<div>' + q + ' <span class="raridade-' + k + '">' + D.raridades[k].nome + '</span> → 1 <span class="raridade-' + para + '">' + D.raridades[para].nome + '</span></div>'
          + '<div class="suave">Pergaminhos para item ' + ITEM_RARIDADE[k] + ': você tem ' + tem + ' · para item ' + ITEM_RARIDADE[para] + ': ' + R.qtdPergaminho(p, para) + '</div></div>'
          + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta + '</span>' : '')
          + '<button class="btn" data-acao="trocar-pergaminho" data-raridade="' + k + '"' + (falta > 0 ? ' disabled' : '') + '>Trocar</button></div></div>';
      }).join('') + '</div>';
  }

  // ---------------- Leilão (Mercado > Leilão): servidor leiloa 12 lotes por faixa de level ----------------
  var NOME_CLASSE_LOTE = { cavaleiro: 'Cavaleiro', arqueiro: 'Caçador', mago: 'Mago', artesao: 'Artesão' };
  function ouroTxt(v) { return Number(v || 0).toLocaleString('pt-BR'); }
  function carregarLeilao() {
    var p = estado.personagem;
    if (!p || estado.leilaoCarregando) return;
    estado.leilaoCarregando = true;
    clearTimeout(estado.leilaoTimer);
    C.leilao.estado(p.id).then(function (r) {
      estado.leilaoCarregando = false;
      if (estado.personagem !== p) return;
      // itens do lote gerados uma vez (pela semente)
      (r.lotes || []).forEach(function (l) { l.item = R.itemDoLote(l); });
      estado.leilao = r;
      estado.leilaoErro = null;
      aplicarCreditos(r.creditos || []);
      if (r.recompensas && r.recompensas.length) resgatarRecompensas(r.recompensas);
      redesenharLeilao();
    }, function (e) {
      estado.leilaoCarregando = false;
      estado.leilaoErro = e.message;
      redesenharLeilao();
    });
  }
  // Redesenha só se o jogador está no leilão e não está digitando um lance; atualiza sozinho a cada 20 s.
  function redesenharLeilao() {
    clearTimeout(estado.leilaoTimer);
    if (estado.aba !== 'leilao') return;
    // atualiza sozinho: a cada 20 s, e a cada 5 s no Curto e no Muito curto (o fim está perto)
    var fase = estado.leilao && estado.leilao.fase && estado.leilao.fase.id;
    var espera = fase === 'curto' || fase === 'muitoCurto' ? 5000 : 20000;
    estado.leilaoTimer = setTimeout(function () { if (estado.aba === 'leilao' && estado.personagem) carregarLeilao(); }, espera);
    var ativo = document.activeElement;
    if (ativo && ativo.classList && ativo.classList.contains('lance-valor')) return;
    if (!estado.batalha && !estado.resultado && !estado.chefeAviso && !estado.luta && !estado.lutaArena && !estado.cacada) telaJogo();
  }
  function nomeLote(l) { return l.item.consumivel ? 'Pacote: ' + nomeDrop(l.item) : R.nomeItem(l.item); }
  function resumoLote(l) {
    var it = l.item;
    if (it.consumivel) return 'Vai para Mochila › Consumíveis';
    if (it.tipo === 'arma') { var d = R.danoArma(it); return R.tipoArma(it).nome + ' · dano ' + d[0] + '–' + d[1]; }
    var b = R.bonusItem(it);
    return Object.keys(b).filter(function (k) { return b[k] && D.bonus[k]; }).slice(0, 2).map(function (k) { return D.bonus[k] + ' +' + b[k]; }).join(' · ');
  }
  function abaLeilao() {
    var p = estado.personagem, L = D.LEILAO, r = estado.leilao;
    if (p.nivel < L.nivelMin) return '<p class="suave">O Leilão abre no level ' + L.nivelMin + '.</p>';
    if (!r) { carregarLeilao(); return '<p class="suave">' + (estado.leilaoErro ? esc(estado.leilaoErro) : 'Carregando o leilão…') + '</p>'; }
    if (r.local) return '<p class="suave">O Leilão é do servidor (todos os jogadores no mesmo leilão): jogue pelo site do ' + D.NOME_JOGO + '.</p>';
    if (r.bloqueado) return '<p class="suave">O Leilão abre no level ' + r.nivelMin + '.</p>';
    var FX = L.faixas.filter(function (f) { return f.id === r.faixa; })[0] || {};
    var faixaTxt = FX.nivel ? (FX.nivel[1] > 100 ? 'level ' + FX.nivel[0] + '+' : 'level ' + FX.nivel[0] + ' a ' + FX.nivel[1]) : '';
    var topo = '<div class="leilao-topo"><div><h3>⚖ ' + esc(FX.nome || 'Leilão') + ' <span class="suave pequeno">(' + faixaTxt + ')</span></h3>'
      + (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '')
      + '<p class="suave pequeno">O Reino leiloa 12 lotes por vez. Cada lance novo precisa ser pelo menos ' + L.incrementoPct + '% maior. '
      + 'O ouro do lance sai na hora; se alguém cobrir, ele volta para você. Quem tiver o maior lance no fim leva o item. '
      + 'Quando acaba, outro leilão começa com itens novos.</p>' + (CELULAR ? '</details>' : '') + '</div>'
      + '<div class="leilao-tempo fase-' + r.fase.id + '" title="Tempo que falta (o fim exato é secreto: em Muito curto pode acabar a qualquer momento)">'
      + '<small>Tempo</small><strong>' + esc(r.fase.nome) + '</strong></div></div>'
      + '<div class="leilao-barra"><span>Seu ouro: <strong class="cor-ouro">' + ouroTxt(p.ouro) + '</strong></span>'
      + '<button class="btn secundario btn-pequeno" data-acao="leilao-atualizar">Atualizar</button></div>';
    var lotes = '<div class="leilao-lotes">' + r.lotes.map(function (l) {
      var it = l.item, prox = l.proximo, usa = it.consumivel || R.podeUsar(p, it);
      var lance = l.lance ? '<div>Lance atual: <strong class="cor-ouro">' + ouroTxt(l.lance) + '</strong>'
          + (l.sou_lider ? ' <span class="leilao-lider">Você lidera</span>' : ' <span class="suave">· ' + esc(l.lider_nome || '?') + '</span>') + '</div>'
        : '<div class="suave">Sem lances · mínimo <strong class="cor-ouro">' + ouroTxt(l.minimo) + '</strong></div>';
      var acao = l.sou_lider ? '<div class="suave pequeno">Espere alguém cobrir para dar outro lance.</div>'
        : '<div class="leilao-acao"><input class="lance-valor" id="lance-' + l.id + '" type="number" inputmode="numeric" min="' + prox + '" step="1" value="' + prox + '"'
          + ' aria-label="Valor do lance">'
          + '<button class="btn" data-acao="leilao-lance" data-id="' + l.id + '"' + (p.ouro < prox ? ' disabled title="Ouro insuficiente"' : '') + '>Dar lance</button></div>';
      return '<div class="leilao-lote carta-' + l.raridade + (l.sou_lider ? ' liderando' : '') + '">'
        + '<div class="leilao-cab"><button class="icone-pequeno borda-' + l.raridade + aura(it) + '" data-acao="leilao-ver" data-id="' + l.id + '" title="Ver o item">'
        + F.icone(it) + (it.consumivel && it.qtd > 1 ? '<span class="qtd-consumivel">' + it.qtd + '</span>' : '') + '</button>'
        + '<div><div class="leilao-nome raridade-' + l.raridade + '">' + esc(nomeLote(l))
          + (usa ? '' : ' <span class="menos" title="Sua classe não usa este item" aria-label="Sua classe não usa este item">✖</span>') + '</div>'
        + '<div class="suave pequeno">' + D.raridades[l.raridade].nome + (l.classe ? ' · ' + NOME_CLASSE_LOTE[l.classe] : '')
        + (it.nivel ? ' · nível ' + it.nivel : '') + '</div>'
        + '<div class="suave pequeno">' + esc(resumoLote(l)) + '</div>'
        + (usa ? '' : '<div class="menos pequeno">Sua classe não usa este item</div>')
          + (!it.consumivel && usa && dropMelhor(it) ? '<div class="mais pequeno">▲ Melhor que o seu equipado</div>' : '') + '</div></div>'
        + lance + '<div class="suave pequeno">Próximo lance: ' + ouroTxt(prox) + (l.lances ? ' · ' + l.lances + ' lance(s)' : '') + '</div>' + acao + '</div>';
    }).join('') + '</div>';
    return topo + lotes + leilaoZoomHtml();
  }
  function leilaoZoomHtml() {
    var r = estado.leilao, id = estado.leilaoVer;
    var l = r && r.lotes && r.lotes.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!l || l.item.consumivel) return '';
    var p = estado.personagem, outro = l.classe && l.classe !== p.classe ? null : itemParaComparar(p, l.item);
    return '<div class="zoom-fundo leilao-zoom" data-acao="leilao-fechar"><div class="zoom-janela" role="dialog" aria-label="Lote do leilão">'
      + '<button class="zoom-x" data-acao="leilao-fechar" title="Fechar">✕</button>'
      + '<div class="zoom-cartas">' + cartaZoom(l.item, outro, 'Lote do leilão') + (outro ? cartaZoom(outro, null, 'Equipado') : '') + '</div>'
      + (l.classe && l.classe !== p.classe ? '<p class="menos pequeno">Item de ' + NOME_CLASSE_LOTE[l.classe] + ': só essa classe usa.</p>' : '')
      + '<div class="botoes"><button class="btn secundario" data-acao="leilao-fechar">Fechar</button></div></div></div>';
  }
  async function darLance(id) {
    var p = estado.personagem, campo = document.getElementById('lance-' + id);
    var valor = Math.floor(Number(campo && campo.value));
    if (!(valor > 0)) { avisar('Digite o valor do lance.'); return; }
    if (valor > p.ouro) { avisar('Ouro insuficiente.'); return; }
    if (estado.leilaoLance) return;
    estado.leilaoLance = true;
    try {
      p.poder = R.poder(p);
      await C.salvarPersonagem(p);           // o servidor confere o ouro salvo
      var r = await C.leilao.lance(p.id, Number(id), valor);
      (r.lotes || []).forEach(function (l) { l.item = R.itemDoLote(l); });
      estado.leilao = r;
      if (campo) campo.blur();
      await aplicarCreditos(r.creditos || []);
      avisar('Lance de ' + ouroTxt(valor) + ' de ouro dado! Se alguém cobrir, o ouro volta para você.');
    } catch (e) {
      avisar(e.message);
      estado.leilao = null;
    }
    estado.leilaoLance = false;
    if (campo) campo.blur();
    redesenharLeilao();
  }

  function abaEncantar() {
    var p = estado.personagem, E = D.encantamento;
    var u = estado.ultimoEncanto;
    var aviso = '';
    if (u) {
      var nome = esc(R.nomeItem(Object.assign({}, u.item, { encanto: 0 })));
      var texto = u.sucesso ? 'SUCESSO! ' + nome + ' agora é +' + u.nivel + '!'
        : u.quebrou ? 'FALHOU! ' + nome + ' +' + u.nivel + ' se despedaçou...' + (u.cristais ? ' Sobraram ' + u.cristais + ' cristais.' : '')
        : u.protegido ? 'FALHOU, mas a Proteção segurou: ' + nome + ' continua +' + u.nivel + '.'
        : 'FALHOU! ' + nome + ' +' + u.nivel + ' voltou para +0.';
      aviso = '<div class="encanto-resultado ' + (u.sucesso ? 'sucesso' : 'falha') + '" role="status">' + texto + '</div>';
    }
    var cont = Object.keys(D.raridades).map(function (k) {
      return '<span class="raridade-' + k + '">' + D.raridades[k].nome + ': ' + R.qtdPergaminho(p, k) + '</span>';
    }).join(' · ');
    var ordem = Object.keys(D.raridades).reverse();
    var itens = p.inventario.slice().sort(function (a, b) {
      return ordem.indexOf(a.raridade) - ordem.indexOf(b.raridade) || b.encanto - a.encanto;
    });
    var lista = itens.map(function (i) {
      var acao, info;
      if (i.runa) {
        info = 'Relíquia Rúnica: o encanto não muda mais';
        acao = '<span class="suave">✨ +' + i.encanto + '</span>';
      } else if (i.encanto >= E.maximo) {
        info = 'Nível máximo';
        acao = '<span class="suave">+' + E.maximo + '</span>';
      } else {
        var chance = R.chanceEncantar(p, i), risco = R.riscoEncantar(i);
        // Pergaminho de Proteção ligado e na mochila: se falhar, o item só não sobe
        if (risco !== 'nada' && estado.usarProtecao && R.qtdConsumivel(p, 'protecao', i.raridade) > 0) risco = 'protegido';
        var falha = { nada: 'sem risco', protegido: '🛡 protegido: se falhar, fica como está', zera: 'se falhar, volta para +0',
          quebra: 'se falhar, o item QUEBRA e vira ' + (D.CRISTAIS_QUEBRA[i.encanto + 1] || 0) + ' cristais' }[risco];
        info = '+' + i.encanto + ' → +' + (i.encanto + 1) + ' · chance <strong>' + fmtDec(chance) + '%</strong> · <span class="' + (risco === 'quebra' ? 'menos' : '') + '">' + falha + '</span>';
        var semPergaminho = R.qtdPergaminho(p, i.raridade) <= 0;
        acao = risco === 'quebra' && estado.encantoPendente === i.id
          ? '<button class="btn perigo" data-acao="encantar" data-id="' + i.id + '">Arriscar mesmo assim</button>'
          : '<button class="btn" data-acao="' + (risco === 'quebra' ? 'pedir-encanto' : 'encantar') + '" data-id="' + i.id + '"' + (semPergaminho ? ' disabled' : '') + '>Encantar</button>';
        if (semPergaminho) acao = '<span class="suave">Sem pergaminho</span>' + acao;
      }
      var equipado = !!R.slotDoItem(p, i.id);
      return '<div class="item item-com-icone' + (equipado ? ' equipado' : '') + '"><div class="icone-pequeno borda-' + corItem(i) + aura(i) + '">' + F.icone(i) + '</div>'
        + '<div class="item-texto"><div>' + nomeItemHtml(i) + (equipado ? ' <span class="suave">(equipado)</span>' : '') + '</div>'
        + '<div class="suave"><span class="enc-desc">' + descricaoItem(i) + ' · </span>' + info + '</div></div>'
        + '<div class="item-acoes">' + acao + '</div></div>';
    }).join('');
    if (CELULAR) {   // celular: pergaminhos em fichinhas, explicação numa gaveta, Proteção como chave e itens compactos
      var chips = Object.keys(D.raridades).map(function (k) {
        return '<span class="enc-chip borda-' + k + '"><i>' + F.icone(itemConsumivel({ tipo: 'pergaminho', raridade: k })) + '</i><b class="raridade-' + k + '">' + R.qtdPergaminho(p, k) + '</b></span>';
      }).join('');
      var protC = Object.keys(D.raridades).filter(function (k) { return R.qtdConsumivel(p, 'protecao', k); }).map(function (k) {
        return '<span class="raridade-' + k + '">' + D.raridades[k].nome + ' ' + R.qtdConsumivel(p, 'protecao', k) + '</span>';
      });
      return aviso + '<div class="enc-topo"><span class="suave pequeno">Pergaminhos</span><div class="enc-chips">' + chips + '</div></div>'
        + '<details class="regras-celular"><summary>Como funciona</summary><p class="suave pequeno">Consiga pergaminhos nas caçadas (o 3º monstro de cada área dá mais), nas masmorras e nas missões. '
        + 'Sua Sorte soma +' + fmtDec(R.atributosTotais(p).sor * D.SORTE.encanto) + '% na chance a partir do +' + (E.seguroAte + 1)
        + (p.raca === 'anao' ? ' e, por ser ' + (p.sexo === 'feminino' ? 'Anã' : 'Anão') + ', +' + E.anao + '%' : '') + ' (o +10 vai no máximo a ' + E.teto[10] + '%).</p></details>'
        + '<label class="enc-protecao"><input type="checkbox" data-acao="usar-protecao"' + (estado.usarProtecao ? ' checked' : '') + '><span>🛡 Usar Pergaminho de Proteção'
        + '<small class="suave">' + (protC.length ? 'Você tem: ' + protC.join(' · ') : 'Você não tem: o Coletor fabrica na Oficina') + '</small></span></label>'
        + '<div class="itens enc-lista">' + lista + '</div>';
    }
    var prot = Object.keys(D.raridades).map(function (k) { return R.qtdConsumivel(p, 'protecao', k) ? '<span class="raridade-' + k + '">' + D.raridades[k].nome + ': ' + R.qtdConsumivel(p, 'protecao', k) + '</span>' : ''; }).filter(Boolean);
    return aviso + '<p class="suave">Pergaminhos: ' + cont + '. Consiga mais nas caçadas (todos os monstros; o 3º de cada área dá mais), nas masmorras e nas missões. Sua Sorte soma +' + fmtDec(R.atributosTotais(p).sor * D.SORTE.encanto) + '% na chance a partir do +4'
      + (p.raca === 'anao' ? ' e, por ser ' + (p.sexo === 'feminino' ? 'Anã' : 'Anão') + ', +' + E.anao + '%' : '') + ' (cada nível tem um limite: o +10 vai no máximo a ' + E.teto[10] + '%).</p>'
      + '<label class="linha-check"><input type="checkbox" data-acao="usar-protecao"' + (estado.usarProtecao ? ' checked' : '') + '> 🛡 Usar Pergaminho de Proteção '
      + '<span class="suave pequeno">(' + (prot.length ? 'você tem ' + prot.join(' · ') : 'você não tem nenhum: o Coletor fabrica na Oficina') + ')</span></label>'
      + '<div class="itens">' + lista + '</div>';
  }

  // ----- Oficina (craft dos Anões; regras em regras.js, números em D.CRAFT) -----

  // ----- Herói › Oficina: Forja do Ferreiro e Bancada do Coletor (Daniel, nov/2026: com retrato e passo a passo) -----
  var PECAS_FORJA = [['arma', 'Arma'], ['elmo', 'Elmo'], ['peitoral', 'Peitoral'], ['luvas', 'Luvas'], ['botas', 'Botas'], ['secundaria', 'Mão esquerda']];
  // Escolhas da forja (região, classe, peça e reforços), com os mesmos padrões na tela e no botão Forjar.
  function forjaAtual(p) {
    var liberadas = D.areas.filter(function (a) { return p.nivel >= a.nivelMin; }), fj = estado.forja || {};
    var area = liberadas.some(function (a) { return a.id === fj.area; }) ? fj.area : liberadas[liberadas.length - 1].id;
    var lim = function (v) { return Math.max(0, Math.min(3, Number(v) || 0)); };
    return { area: area, classe: D.classes[fj.classe] ? fj.classe : p.classe, tipo: fj.tipo || 'arma', chefe: lim(fj.chefe), gemas: lim(fj.gemas), liberadas: liberadas };
  }
  // Ícone de um custo (material, receita, cristal ou ouro).
  function iconeCusto(c) {
    if (c.tipo === 'ouro') return ICONES.ouro;
    return iconeConsumivel({ tipo: c.tipo, raridade: c.id });
  }
  // Custos como fichinhas: ícone, quanto tem / quanto precisa (verde quando dá, vermelho quando falta).
  function custoChips(lista) {
    return '<div class="custo-chips">' + lista.map(function (c) {
      var ok = c.tem >= c.precisa, fmt = function (v) { return Number(v).toLocaleString('pt-BR'); };
      var txt = c.tipo === 'ouro' ? fmt(c.precisa) : fmt(Math.min(c.tem, c.precisa)) + '/' + fmt(c.precisa);
      return '<span class="custo-chip ' + (ok ? 'ok' : 'falta') + '" title="' + esc(c.nome + ': você tem ' + fmt(c.tem) + ', precisa de ' + fmt(c.precisa)) + '">'
        + '<i>' + iconeCusto(c) + '</i><b>' + txt + '</b><small>' + esc(c.tipo === 'ouro' ? 'ouro' : c.nome) + '</small></span>';
    }).join('') + '</div>';
  }
  // Retrato do artesão: o do próprio herói quando ele é dessa classe; senão o mestre anão dela.
  function retratoArtesao(p, c2) {
    var meu = (p.talentos && p.talentos.classe2) === c2;
    return F.personagem(meu ? p.raca : 'anao', c2, p.sexo);
  }
  function abaOficina() {
    var p = estado.personagem, C = D.CRAFT;   // (C aqui = D.CRAFT; o relógio vem de C_agora)
    var fer = R.ehFerreiro(p), col = R.ehColetor(p);
    var vista = estado.oficinaVista || (col ? 'coletor' : 'forja');
    var nomeC2 = function (c2) { var x = D.SEGUNDAS_CLASSES[c2]; return p.sexo === 'feminino' && x.nomeF || x.nome; };
    // Seletor: as duas bancadas, com o retrato de cada artesão
    var cartao = function (id, c2, titulo, texto, meu) {
      return '<button type="button" class="oficina-cartao' + (vista === id ? ' ativo' : '') + '" data-acao="oficina-vista" data-valor="' + id + '">'
        + '<span class="oficina-retrato">' + retratoArtesao(p, c2) + '</span><span class="oficina-cartao-texto"><strong>' + titulo + '</strong>'
        + '<small>' + texto + '</small>' + (meu ? '<em class="selo-forja">Você é ' + esc(nomeC2(c2)) + '</em>' : '') + '</span></button>';
    };
    var html = '<div class="oficina-cartoes">'
      + cartao('forja', 'ferreiro', '🔨 Forja', 'Armas e armaduras novas', fer)
      + cartao('coletor', 'coletor', '📜 Bancada', 'Receitas e Proteções', col) + '</div>';
    // Seus materiais (fechado: os custos de cada receita já mostram o que você tem)
    var meus = R.consumiveis(p).filter(function (c) { return ['material', 'receita', 'protecao', 'cristal'].indexOf(c.tipo) >= 0; });
    html += '<details class="caixa-interna oficina-materiais"' + (estado.oficinaMateriais ? ' open' : '') + '><summary data-acao="oficina-materiais">🎒 Seus materiais (' + meus.length + ')</summary>'
      + (meus.length ? '<div class="materiais-lista">' + meus.map(function (c) {
        return '<span class="material-chip borda-' + corConsumivel(c) + '">' + iconeConsumivel(c) + ' ' + esc(R.nomeConsumivel(c)) + ' <strong>' + c.qtd.toLocaleString('pt-BR') + '</strong></span>';
      }).join('') + '</div>' : '<p class="suave">Nenhum ainda. Materiais caem dos monstros da caçada (cada região tem o seu; o chefe deixa um raro) e vêm das Minas.</p>')
      + '<p class="suave pequeno">Também dá para comprar e vender materiais, receitas e proteções no Mercado.</p></details>';
    var semClasse = function (c2, oQue) {
      return '<div class="oficina-aviso"><p>Só ' + (p.sexo === 'feminino' ? 'a ' : 'o ') + '<strong>' + esc(nomeC2(c2)) + '</strong> (segunda classe do Artesão) ' + oQue + '. '
        + 'Você pode ver os custos aqui e contratar um artesão de outro jogador.</p>'
        + '<button class="btn secundario btn-pequeno" data-acao="aba" data-aba="oficinas">Contratar no Mercado › Oficinas</button></div>';
    };
    if (vista === 'coletor') {
      var liberadas = D.areas.filter(function (a) { return p.nivel >= a.nivelMin; });
      html += '<div class="caixa-interna oficina-bancada"><div class="oficina-fala"><span class="oficina-retrato grande">' + retratoArtesao(p, 'coletor') + '</span>'
        + '<p>' + (col ? 'Receitas abrem a forja de uma região. Proteções salvam o item quando o encanto falha.' : 'Receitas e Pergaminhos de Proteção saem da bancada do Coletor.') + '</p></div>'
        + (col ? '' : semClasse('coletor', 'fabrica'))
        + '<h4>📜 Receitas <span class="suave pequeno">· 1 por forja, da região do item</span></h4><div class="oficina-grade">' + liberadas.map(function (a) {
          var c = R.custoReceita(p, a.id), pode = col && !R.faltando(p, c).length, tem = R.qtdConsumivel(p, 'receita', a.id);
          return '<div class="oficina-receita"><div class="oficina-receita-topo">' + iconeArea(a) + '<div><strong>' + esc(a.nome) + '</strong>'
            + '<small class="suave">Você tem ' + tem + '</small></div></div>' + custoChips(c)
            + (col ? '<button class="btn btn-pequeno" data-acao="craft-receita" data-id="' + a.id + '"' + (pode ? '' : ' disabled') + '>Fabricar</button>' : '') + '</div>';
        }).join('') + '</div><h4>🛡 Pergaminhos de Proteção <span class="suave pequeno">· se o encanto falhar, o item não quebra nem zera</span></h4><div class="oficina-grade">'
        + Object.keys(C.protecao).map(function (r) {
          var c = R.custoProtecao(p, r), pode = col && !R.faltando(p, c).length, tem = R.qtdConsumivel(p, 'protecao', r);
          return '<div class="oficina-receita borda-' + r + '"><div class="oficina-receita-topo"><span class="icone-pequeno borda-' + r + '">' + iconeConsumivel({ tipo: 'protecao', raridade: r }) + '</span>'
            + '<div><strong class="raridade-' + r + '">Proteção ' + D.raridades[r].nome + '</strong><small class="suave">Você tem ' + tem + '</small></div></div>' + custoChips(c)
            + (col ? '<button class="btn btn-pequeno" data-acao="craft-protecao" data-id="' + r + '"' + (pode ? '' : ' disabled') + '>Fabricar</button>' : '') + '</div>';
        }).join('') + '</div></div>';
      return html;
    }
    // Forja do Ferreiro, em 4 passos
    var f = forjaAtual(p), areaF = D.areas.filter(function (a) { return a.id === f.area; })[0], mcF = R.materialDoChefe(areaF.chefe.id);
    var custoF = R.custoForja(p, f.area);
    if (f.chefe) custoF.push({ tipo: 'material', id: mcF, nome: C.materiais[mcF].nome, tem: R.qtdMaterial(p, mcF), precisa: f.chefe });
    if (f.gemas) custoF.push({ tipo: 'material', id: 'gema', nome: C.materiais.gema.nome, tem: R.qtdMaterial(p, 'gema'), precisa: f.gemas });
    var chances = R.chancesForja(p, f.area, f.chefe, f.gemas), pct = function (v) { return fmtDec(Math.round(v * 10) / 10) + '%'; };
    var botoes = function (campo, lista, atual) {
      return '<div class="forja-botoes">' + lista.map(function (o) {
        return '<button type="button" class="btn btn-pequeno' + (String(o[0]) === String(atual) ? ' sel' : ' secundario') + '" data-acao="forja-op" data-campo="' + campo + '" data-valor="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div>';
    };
    var reforco = function (campo, c, info) {
      var v = f[campo];
      return '<div class="forja-reforco"><span class="forja-reforco-ico">' + iconeConsumivel({ tipo: 'material', raridade: c }) + '</span><div><strong>' + esc(C.materiais[c].nome) + '</strong>'
        + '<small class="suave">' + info + ' · você tem ' + R.qtdMaterial(p, c) + '</small></div>'
        + '<div class="passo-qtd"><button type="button" class="btn btn-pequeno secundario" data-acao="forja-qtd" data-campo="' + campo + '" data-valor="-1"' + (v <= 0 ? ' disabled' : '') + ' aria-label="Menos">−</button>'
        + '<b>' + v + '</b><button type="button" class="btn btn-pequeno secundario" data-acao="forja-qtd" data-campo="' + campo + '" data-valor="1"' + (v >= 3 ? ' disabled' : '') + ' aria-label="Mais">+</button></div></div>';
    };
    var falta = R.faltando(p, custoF), cheia = R.mochilaCheia(p);
    var barraCh = ['comum', 'rara', 'epica', 'lendaria'].map(function (r) {
      return chances[r] > 0 ? '<i class="fundo-' + r + '" style="width:' + chances[r] + '%" title="' + D.raridades[r].nome + ' ' + pct(chances[r]) + '"></i>' : '';
    }).join('');
    html += '<div class="caixa-interna oficina-bancada"><div class="oficina-fala"><span class="oficina-retrato grande">' + retratoArtesao(p, 'ferreiro') + '</span>'
      + '<p>' + (fer ? 'Escolha a região, a peça e os reforços. O martelo faz o resto.' : 'Armas e armaduras novas saem da forja do Ferreiro, com uma Receita do Coletor.') + '</p></div>'
      + (fer ? '' : semClasse('ferreiro', 'forja'))
      + '<ol class="forja-passos">'
      + '<li><h4>Região <span class="suave pequeno">· define o level do item</span></h4><div class="forja-botoes">' + f.liberadas.map(function (a) {
        var temR = R.qtdConsumivel(p, 'receita', a.id) > 0;
        return '<button type="button" class="btn btn-pequeno forja-regiao' + (a.id === f.area ? ' sel' : ' secundario') + '" data-acao="forja-op" data-campo="area" data-valor="' + a.id + '">'
          + iconeArea(a) + '<span>' + esc(a.nome) + '<small>item level ' + (a.nivelMin + 2) + (temR ? ' · 📜' : '') + '</small></span></button>';
      }).join('') + '</div></li>'
      + '<li><h4>Para a classe</h4>' + botoes('classe', Object.keys(D.classes).map(function (k) { return [k, D.classes[k].nome]; }), f.classe) + '</li>'
      + '<li><h4>Peça</h4><div class="forja-botoes">' + PECAS_FORJA.map(function (o) {
        return '<button type="button" class="btn btn-pequeno forja-peca' + (o[0] === f.tipo ? ' sel' : ' secundario') + '" data-acao="forja-op" data-campo="tipo" data-valor="' + o[0] + '">'
          + '<span class="icone-pequeno">' + F.icone({ tipo: o[0], classe: f.classe, raridade: 'comum', encanto: 0 }) + '</span>' + o[1] + '</button>';
      }).join('') + '</div></li>'
      + '<li><h4>Reforços <span class="suave pequeno">· opcional: sobem a chance de raridade alta</span></h4>'
      + reforco('chefe', mcF, 'do chefe da região') + reforco('gemas', 'gema', 'das Minas') + '</li></ol>'
      + '<div class="forja-resumo"><h4>Chance de sair</h4><div class="forja-chance">' + barraCh + '</div>'
      + '<p class="pequeno"><span class="raridade-comum">Comum ' + pct(chances.comum) + '</span> · <span class="raridade-rara">Rara ' + pct(chances.rara) + '</span> · '
      + '<span class="raridade-epica">Épica ' + pct(chances.epica) + '</span> · <span class="raridade-lendaria">Lendária ' + pct(chances.lendaria) + '</span>'
      + ' · ✨ obra-prima (uma raridade acima) ' + pct(chances.obraPrima) + (p.raca === 'anao' ? ' <span class="mais">(+1% por ser anão)</span>' : '') + '</p>'
      + '<h4>Você gasta</h4>' + custoChips(custoF)
      + (fer ? '<button class="btn largo forja-botao" data-acao="forjar"' + (falta.length || cheia ? ' disabled' : '') + '>🔨 Forjar</button>'
        + (falta.length ? '<p class="menos pequeno">Falta: ' + falta.map(function (c) { return esc(c.nome); }).join(', ') + '.</p>' : cheia ? '<p class="menos pequeno">Mochila cheia: libere um espaço.</p>' : '') : '')
      + '</div></div>';
    return html;
  }
  function C_agora() { return C.agora(); }

  // ----- Mercado › Oficinas (serviços dos Anões; servidor: oficina_*) -----
  var OF = D.CRAFT.oficina;
  function carregarOficinas() {
    var p = estado.personagem;
    if (!p || estado.oficinasCarregando) return;
    estado.oficinasCarregando = true;
    C.oficina.estado(p.id).then(function (r) {
      estado.oficinasCarregando = false;
      if (estado.personagem !== p) return;
      estado.oficinas = r;
      // A oficina guarda a Sorte do artesão: atualiza quando mudar (itens, pontos).
      if (r.minha && (Math.abs(Number(r.minha.bonus_encanto) - R.bonusEncanto(p)) > 0.01)) configurarOficina(r.minha.servicos, true);
      if (r.recompensas && r.recompensas.length) resgatarRecompensas(r.recompensas);
      if (estado.aba === 'oficinas' && !estado.batalha && !estado.luta) telaJogo();
    }, function (e) {
      estado.oficinasCarregando = false;
      estado.oficinas = { erro: e.message };
      if (estado.aba === 'oficinas') telaJogo();
    });
  }
  function configurarOficina(servicos, quieto) {
    var p = estado.personagem;
    return C.oficina.configurar(p.id, servicos, R.bonusEncanto(p), Math.round(R.atributosTotais(p).sor)).then(function () {
      if (!quieto) avisar(Object.keys(servicos).length ? 'Oficina aberta! Os jogadores já podem contratar.' : 'Oficina fechada.');
      if (!quieto) carregarOficinas();
    }, function (e) { avisar(e.message); });
  }
  function servicosDe(p) {
    var c2 = R.ehFerreiro(p) ? 'ferreiro' : R.ehColetor(p) ? 'coletor' : null;
    return Object.keys(OF.servicos).filter(function (k) { return OF.servicos[k].de === c2; });
  }
  function nomeRacaCurto(x) { return x.raca === 'anao' ? (x.sexo === 'feminino' ? 'Anã' : 'Anão') : (D.racas[x.raca] || {}).nome || ''; }
  function textoPedido(x) {
    var o = x.opcoes || {}, it = x.item;
    if (x.tipo === 'encantar') return 'Encantar ' + (it ? R.nomeItem(it) : '') + (o.protecao ? ' (com Proteção)' : '');
    if (x.tipo === 'forjar') return 'Forjar ' + ({ arma: 'arma', elmo: 'elmo', peitoral: 'peitoral', luvas: 'luvas', botas: 'botas', secundaria: 'mão esquerda' })[o.tipo] + ' de ' + (D.classes[o.classe] || {}).nome + ' (' + nomeArea(o.area) + ')';
    if (x.tipo === 'receita') return 'Receita: ' + nomeArea(o.area);
    if (x.tipo === 'protecao') return 'Pergaminho de Proteção ' + (D.raridades[o.raridade] || {}).nome;
    if (x.tipo === 'reliquia') return 'Relíquia Rúnica "' + (o.nome || '') + '"' + (it ? ' (' + R.nomeItem(it) + ')' : '');
    return x.tipo;
  }
  function textoResultado(x) {
    var r = x.resultado || {};
    if (x.estado === 'pendente') return '<span class="suave">esperando o artesão</span>';
    if (x.estado !== 'feito') return '<span class="suave">' + (x.estado === 'cancelado' ? 'cancelado (tudo devolvido)' : 'não feito a tempo (tudo devolvido)') + '</span>';
    if (x.tipo === 'encantar') return r.sucesso ? '<span class="mais">SUCESSO! foi para +' + r.alvo + '</span>'
      : r.protegido ? '<span class="suave">falhou, a Proteção segurou</span>' : r.zerou ? '<span class="menos">falhou: voltou a +0</span>' : '<span class="menos">QUEBROU (' + (r.cristais || 0) + ' cristais)</span>';
    if (x.tipo === 'forjar') return '<span class="raridade-' + r.raridade + '">' + (r.obraPrima ? '✨ obra-prima ' : '') + (D.raridades[r.raridade] || {}).nome + '</span>';
    if (x.tipo === 'reliquia') return r.sucesso ? '<span class="cor-ouro">✨ RELÍQUIA FORJADA! ' + esc((R.runa(r.runa) || {}).nome || '') + '</span>' : '<span class="menos">a forja falhou (materiais perdidos)</span>';
    return '<span class="mais">pronto</span>';
  }
  var ICONE_SERVICO = { encantar: '✨', forjar: '🔨', reliquia: '💠', receita: '📜', protecao: '🛡' };
  // Situação de um pedido, como selo colorido.
  function seloPedido(x) {
    var r = x.resultado || {};
    if (x.estado === 'pendente') return '<span class="selo-pedido espera">⏳ Esperando o artesão</span>';
    if (x.estado !== 'feito') return '<span class="selo-pedido devolvido">↩ ' + (x.estado === 'cancelado' ? 'Cancelado' : 'Não feito a tempo') + ' · tudo devolvido</span>';
    var ruim = (x.tipo === 'encantar' && !r.sucesso && !r.protegido) || (x.tipo === 'reliquia' && !r.sucesso);
    return '<span class="selo-pedido ' + (ruim ? 'ruim' : 'bom') + '">' + textoResultado(x) + '</span>';
  }
  function retratoOficina(x) { return '<span class="loja-retrato">' + F.personagem(x.raca || 'anao', x.classe2 || 'ferreiro', x.sexo) + '</span>'; }
  function abaOficinas() {
    var p = estado.personagem, st = estado.oficinas;
    if (!st) { carregarOficinas(); return '<p class="suave">Carregando…</p>'; }
    if (st.local) return '<p class="suave">As Oficinas juntam vários jogadores e precisam do servidor.</p>';
    if (st.erro) return '<p class="menos">' + esc(st.erro) + '</p><p class="suave pequeno">Se for a primeira vez, rode o supabase/schema.sql de novo no Supabase.</p>';
    var html = '<div class="loja-topo"><span class="loja-retrato grande">' + F.personagem('anao', 'ferreiro', p.sexo) + '</span><div><h3>⚒ Oficinas dos Artesãos</h3>'
      + '<p class="suave pequeno">Contrate um Ferreiro ou um Coletor de outro jogador. Você entrega o item, os materiais e o pagamento; o jogo guarda tudo até ele fazer. '
      + 'A sorte é a <strong>do artesão</strong>. Se ele não fizer em ' + OF.prazoHoras + ' h, tudo volta para você.</p></div></div>';
    // Meus pedidos (primeiro: é o que o comprador quer acompanhar)
    if ((st.pedidos || []).length) {
      var pend = st.pedidos.filter(function (x) { return x.estado === 'pendente'; }).length;
      html += '<h3 class="subtitulo">🧾 Meus pedidos' + (pend ? ' <span class="contador-loja">' + pend + ' esperando</span>' : '') + '</h3><div class="loja-pedidos">' + st.pedidos.map(function (x) {
        return '<div class="loja-pedido"><span class="loja-pedido-ico">' + (x.item ? '<span class="icone-pequeno borda-' + corItem(x.item) + '">' + F.icone(x.item) + '</span>' : ICONE_SERVICO[x.tipo] || '⚒') + '</span>'
          + '<div class="loja-pedido-texto"><strong>' + esc(textoPedido(x)) + '</strong><small class="suave">' + esc(x.artesao) + ' · ' + ICONES.ouro + ' ' + ouroTxt(x.preco) + '</small>' + seloPedido(x) + '</div>'
          + (x.estado === 'pendente' ? '<button class="btn secundario btn-pequeno" data-acao="of-cancelar" data-id="' + x.id + '">Cancelar</button>' : '') + '</div>';
      }).join('') + '</div>';
    }
    // Minha oficina (para o artesão)
    var meus = servicosDe(p);
    if (meus.length) {
      var precos = (st.minha && st.minha.servicos) || {}, aberta = st.minha && Object.keys(precos).length, eu = (st.lista || []).filter(function (x) { return x.id === p.id; })[0];
      var c2p = R.ehFerreiro(p) ? 'ferreiro' : 'coletor';
      html += '<div class="caixa-interna loja-minha"><div class="loja-minha-topo"><span class="loja-retrato grande">' + F.personagem(p.raca, c2p, p.sexo) + '</span><div>'
        + '<h3>🏪 Minha oficina <span class="selo-pedido ' + (aberta ? 'bom' : 'devolvido') + '">' + (aberta ? '● Aberta' : '○ Fechada') + '</span></h3>'
        + '<p class="suave pequeno">Você recebe o preço menos ' + OF.taxa + '% de taxa, acertando ou não. Sua chance de encanto: <strong>+' + fmtDec(Math.round(R.bonusEncanto(p) * 10) / 10) + '%</strong> (Sorte' + (p.raca === 'anao' ? ' + Anão' : '') + ').</p></div></div>'
        + (eu ? statsLoja(eu) : '')
        + '<h4>Seus preços <span class="suave pequeno">· deixe em branco o que não quer oferecer</span></h4><div class="loja-precos">' + meus.map(function (k) {
          var off = k === 'reliquia' && R.podeReliquia(p) !== true;
          return '<label class="loja-preco' + (off ? ' off' : '') + '"><span class="loja-preco-nome">' + ICONE_SERVICO[k] + ' ' + OF.servicos[k].nome
            + (off ? '<small class="suave">' + esc(R.podeReliquia(p)) + '</small>' : '') + '</span>'
            + '<span class="loja-preco-campo">' + ICONES.ouro + '<input type="number" min="0" step="1" inputmode="numeric" id="of-preco-' + k + '" value="' + (precos[k] || '') + '" placeholder="Preço"' + (off ? ' disabled' : '') + '></span></label>';
        }).join('') + '</div><div class="botoes"><button class="btn" data-acao="of-salvar">' + (aberta ? 'Salvar preços' : 'Abrir minha oficina') + '</button>'
        + (aberta ? '<button class="btn secundario" data-acao="of-fechar">Fechar oficina</button>' : '') + '</div>';
      var fazer = st.fazer || [];
      html += '<h4>📥 Pedidos para fazer' + (fazer.length ? ' <span class="contador-loja">' + fazer.length + '</span>' : '') + '</h4>' + (fazer.length ? '<div class="loja-pedidos">' + fazer.map(function (x) {
        return '<div class="loja-pedido"><span class="loja-pedido-ico">' + (x.item ? '<span class="icone-pequeno borda-' + corItem(x.item) + '">' + F.icone(x.item) + '</span>' : ICONE_SERVICO[x.tipo] || '⚒') + '</span>'
          + '<div class="loja-pedido-texto"><strong>' + esc(textoPedido(x)) + '</strong><small class="suave">Cliente: ' + esc(x.cliente) + ' · você recebe ' + ICONES.ouro + ' '
          + ouroTxt(Math.floor(x.preco * (100 - OF.taxa) / 100)) + '</small></div>'
          + '<button class="btn btn-pequeno" data-acao="of-fazer" data-id="' + x.id + '">' + (x.tipo === 'encantar' || x.tipo === 'reliquia' ? '🎲 Jogar a sorte' : '⚒ Fazer') + '</button></div>';
      }).join('') + '</div>' : '<p class="suave">Nenhum pedido esperando.</p>') + '</div>';
    }
    // Oficinas abertas (para o comprador), com filtro por serviço
    var lista = (st.lista || []).filter(function (x) { return x.id !== p.id; }), filtro = estado.ofFiltro || 'todos';
    var visiveis = lista.filter(function (x) { return filtro === 'todos' || x.servicos[filtro]; });
    html += '<h3 class="subtitulo">⚒ Oficinas abertas <span class="suave pequeno">(' + lista.length + ')</span></h3>'
      + '<div class="loja-filtros">' + [['todos', 'Todos']].concat(Object.keys(OF.servicos).map(function (k) { return [k, ICONE_SERVICO[k] + ' ' + OF.servicos[k].nome.replace(/^Fabricar /, '')]; })).map(function (o) {
        return '<button type="button" class="btn btn-pequeno' + (o[0] === filtro ? ' sel' : ' secundario') + '" data-acao="of-filtro" data-valor="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div>';
    html += visiveis.length ? '<div class="loja-lista">' + visiveis.map(function (x) { return cartaOficina(x); }).join('') + '</div>'
      : '<p class="suave">' + (lista.length ? 'Nenhuma oficina oferece esse serviço agora.' : 'Nenhuma oficina aberta agora.') + '</p>';
    return html;
  }
  function statsOficina(x) {
    var pct = x.encantos ? Math.round(100 * x.acertos / x.encantos) : 0;
    return 'Encantos: ' + x.encantos + ' · Acertos: ' + x.acertos + (x.encantos ? ' (' + pct + '%)' : '') + ' · Acertos no +10: ' + x.acertos10 + ' de ' + x.tent10 + ' · Serviços feitos: ' + x.feitos;
  }
  // Números do artesão em quadrinhos (taxa de acerto, +10, serviços feitos, fila).
  function statsLoja(x) {
    var pct = x.encantos ? Math.round(100 * x.acertos / x.encantos) + '%' : '—', fer = x.classe2 === 'ferreiro';
    return '<div class="loja-stats">'
      + (fer ? '<span><b>' + pct + '</b><small>acerto no encanto' + (x.encantos ? ' (' + x.acertos + ' de ' + x.encantos + ')' : '') + '</small></span>'
        + '<span><b>' + x.acertos10 + '/' + x.tent10 + '</b><small>acertos no +10</small></span>' : '')
      + '<span><b>' + x.feitos + '</b><small>serviços feitos</small></span>'
      + (x.fila != null ? '<span><b>' + (x.fila || 0) + '</b><small>na fila</small></span>' : '') + '</div>';
  }
  function cartaOficina(x) {
    var c2 = D.SEGUNDAS_CLASSES[x.classe2] || {}, aberto = estado.contratar && estado.contratar.artesao === x.id;
    var html = '<div class="loja-carta' + (aberto ? ' aberta' : '') + '"><div class="loja-carta-topo">' + retratoOficina(x) + '<div class="loja-carta-info">'
      + '<div><strong>' + esc(x.nome) + '</strong> <span class="pequeno">' + vistoTexto(x.visto_em) + '</span></div>'
      + '<div class="suave pequeno">' + esc(nomeRacaCurto(x)) + ' · ' + esc(x.sexo === 'feminino' && c2.nomeF || c2.nome || '') + ' · Lv ' + x.nivel + '</div>'
      + '<div class="loja-selos">' + (x.raca === 'anao' ? '<span class="selo-forja">⛰ Forja da Montanha</span>' : '') + (x.feitos >= 100 ? '<span class="selo-forja">🏅 Mestre</span>' : '') + '</div>'
      + '</div></div>' + statsLoja(x)
      + '<div class="loja-servicos">' + Object.keys(x.servicos).map(function (k) {
        var sel = aberto && estado.contratar.tipo === k;
        return '<button type="button" class="loja-servico' + (sel ? ' sel' : '') + '" data-acao="of-contratar" data-id="' + x.id + '" data-valor="' + k + '">'
          + '<span class="loja-servico-ico">' + ICONE_SERVICO[k] + '</span><span>' + OF.servicos[k].nome + '<b>' + ICONES.ouro + ' ' + ouroTxt(x.servicos[k]) + '</b></span></button>';
      }).join('') + '</div>'
      + (aberto ? formContratar(x, estado.contratar.tipo) : '') + '</div>';
    return html;
  }
  function formContratar(x, tipo) {
    var p = estado.personagem, f = estado.contratar, E = D.encantamento, preco = x.servicos[tipo];
    var livres = R.mochila(p).filter(function (i) { return !i.travado; });
    var sel = function (campo, lista, atual) {
      return '<select data-contratar="' + campo + '">' + lista.map(function (o) { return '<option value="' + esc(String(o[0])) + '"' + (String(o[0]) === String(atual) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    };
    var h = '<div class="contratar">', aviso = '', pode = true;
    if (tipo === 'encantar') {
      var itens = livres.filter(function (i) { return i.encanto < E.maximo && !i.runa; });
      if (!itens.length) return h + '<p class="suave">Nenhum item na mochila para encantar (tire do corpo e destrave antes).</p></div>';
      var it = itens.filter(function (i) { return i.id === f.item; })[0] || itens[0];
      var chance = R.chanceEncantarCom(Number(x.bonus_encanto), it), risco = R.riscoEncantar(it);
      var temProt = R.qtdConsumivel(p, 'protecao', it.raridade) > 0, prot = !!f.protecao && temProt, temPerg = R.qtdPergaminho(p, it.raridade) > 0;
      h += '<label>Item ' + sel('item', itens.map(function (i) { return [i.id, R.nomeItem(i) + ' (' + D.raridades[i.raridade].nome + ')']; }), it.id) + '</label>'
        + '<label class="linha-check"><input type="checkbox" data-contratar="protecao"' + (prot ? ' checked' : '') + (temProt ? '' : ' disabled') + '> 🛡 Usar Pergaminho de Proteção '
        + '<span class="suave pequeno">(' + (temProt ? 'você tem ' + R.qtdConsumivel(p, 'protecao', it.raridade) : 'você não tem da raridade ' + D.raridades[it.raridade].nome) + ')</span></label>'
        + (temPerg ? '' : '<p class="menos pequeno">Você precisa de 1 Pergaminho ' + D.raridades[it.raridade].nome + ' para entregar.</p>');
      pode = temPerg;
      aviso = 'Chance deste artesão: <strong>' + fmtDec(chance) + '%</strong> para o +' + (it.encanto + 1) + '. '
        + (risco === 'nada' ? 'Sem risco.' : prot ? 'Com Proteção: se falhar, o item fica como está.' : risco === 'zera' ? 'Se falhar, o item <strong>volta a +0</strong>.' : 'Se falhar, o item <strong>QUEBRA</strong>.')
        + ' Você confia na sorte d' + (x.sexo === 'feminino' ? 'a ' : 'o ') + esc(nomeRacaCurto(x).toLowerCase() || 'artesão') + '?';
    } else if (tipo === 'forjar') {
      var comReceita = D.areas.filter(function (a) { return R.qtdConsumivel(p, 'receita', a.id) > 0; });
      if (!comReceita.length) return h + '<p class="suave">Você precisa de uma Receita (o Coletor fabrica; também tem no Mercado › Craft).</p></div>';
      var ar = comReceita.filter(function (a) { return a.id === f.area; })[0] || comReceita[0];
      var cls = f.classe || p.classe, tp = f.peca || 'arma', ch = Number(f.chefe) || 0, ge = Number(f.gemas) || 0, nums = [0, 1, 2, 3].map(function (n) { return [n, String(n)]; });
      var mc = R.materialDoChefe(ar.chefe.id), custo = R.custoForja(p, ar.id).filter(function (c) { return c.tipo !== 'ouro'; });
      if (ch) custo.push({ tipo: 'material', id: mc, nome: D.CRAFT.materiais[mc].nome, tem: R.qtdMaterial(p, mc), precisa: ch });
      if (ge) custo.push({ tipo: 'material', id: 'gema', nome: 'Pedra Preciosa', tem: R.qtdMaterial(p, 'gema'), precisa: ge });
      var extra = D.CRAFT.forja.ouro[D.areas.indexOf(ar)], chs = R.chancesForja({ raca: x.raca }, ar.id, ch, ge), pc = function (v) { return fmtDec(Math.round(v * 10) / 10) + '%'; };
      h += '<div class="forja-opcoes"><label>Receita ' + sel('area', comReceita.map(function (a) { return [a.id, a.nome]; }), ar.id) + '</label>'
        + '<label>Classe ' + sel('classe', Object.keys(D.classes).map(function (k) { return [k, D.classes[k].nome]; }), cls) + '</label>'
        + '<label>Peça ' + sel('peca', PECAS_FORJA, tp) + '</label>'
        + '<label>+ ' + esc(D.CRAFT.materiais[mc].nome) + ' ' + sel('chefe', nums, ch) + '</label><label>+ Pedra Preciosa ' + sel('gemas', nums, ge) + '</label></div>'
        + '<h4>Você entrega</h4>' + custoChips(custo.concat([{ tipo: 'ouro', nome: 'ouro da forja', tem: p.ouro, precisa: extra }]));
      pode = !R.faltando(p, custo).length;
      preco += extra;
      aviso = 'Chances: Comum ' + pc(chs.comum) + ' · Rara ' + pc(chs.rara) + ' · Épica ' + pc(chs.epica) + ' · Lendária ' + pc(chs.lendaria) + ' · obra-prima ' + pc(chs.obraPrima) + '.';
    } else if (tipo === 'receita') {
      var ar2 = D.areas.filter(function (a) { return a.id === f.area; })[0] || D.areas[0], cr = R.custoReceita(p, ar2.id), mat = cr.filter(function (c) { return c.tipo !== 'ouro'; });
      h += '<label>Região ' + sel('area', D.areas.map(function (a) { return [a.id, a.nome]; }), ar2.id) + '</label><h4>Você entrega</h4>' + custoChips(cr);
      pode = !R.faltando(p, mat).length; preco += cr[1].precisa;
    } else if (tipo === 'protecao') {
      var rr = D.CRAFT.protecao[f.raridade] ? f.raridade : 'comum', cp = R.custoProtecao(p, rr);
      h += '<label>Raridade ' + sel('raridade', Object.keys(D.CRAFT.protecao).map(function (k) { return [k, D.raridades[k].nome]; }), rr) + '</label><h4>Você entrega</h4>' + custoChips(cp);
      pode = !R.faltando(p, cp).length;
    } else if (tipo === 'reliquia') {
      var Q = D.CRAFT.reliquia, lend = livres.filter(function (i) { return i.raridade === 'lendaria' && i.encanto >= Q.encantoMin && !i.runa; });
      if (!lend.length) return h + '<p class="suave">Você precisa de um item lendário +' + Q.encantoMin + ' ou mais na mochila (fora do corpo e destravado).</p></div>';
      var il = lend.filter(function (i) { return i.id === f.item; })[0] || lend[0];
      var cm = Object.keys(Q.materiais).map(function (k) { return { tipo: 'material', id: k, nome: D.CRAFT.materiais[k].nome, tem: R.qtdMaterial(p, k), precisa: Q.materiais[k] }; });
      var chR = Math.min(Q.maxima, Q.base + Number(x.sorte) * Q.porSorte);
      h += '<label>Item ' + sel('item', lend.map(function (i) { return [i.id, R.nomeItem(i)]; }), il.id) + '</label>'
        + '<label>Nome da relíquia <input type="text" maxlength="24" data-contratar="nome" value="' + esc(f.nome || '') + '" placeholder="Ex.: Fúria de Thorin"></label>'
        + '<h4>Você entrega</h4>' + custoChips(cm)
        + (x.reliquia_semana ? '<p class="menos pequeno">Este Ferreiro já forjou a relíquia da semana.</p>' : '');
      pode = !R.faltando(p, cm).length && !x.reliquia_semana;
      aviso = 'Chance deste anão: <strong>' + fmtDec(Math.round(chR * 10) / 10) + '%</strong>. Se der certo, o item vira uma relíquia ÚNICA com o nome escolhido e uma runa sorteada '
        + '(' + Q.runas.map(function (r) { return r.texto; }).join(', ') + ' no +' + Q.encantoMin + '; o seu item +' + il.encanto + ' deixa a runa com <strong>'
        + Math.round(R.forcaRuna(il) * 100) + '%</strong> da força; só contra monstros). Depois disso o item <strong>não pode mais ser encantado</strong>. Se falhar, os materiais se perdem e o item volta igual.';
    }
    h += (aviso ? '<p class="aviso-contratar">' + aviso + '</p>' : '')
      + '<div class="botoes"><button class="btn" data-acao="of-pedir"' + (pode && p.ouro >= preco ? '' : ' disabled') + '>' + (tipo === 'encantar' || tipo === 'reliquia' ? 'Confio! Contratar' : 'Contratar')
      + ' · ' + ouroTxt(preco) + '</button><button class="btn secundario" data-acao="of-contratar-fechar">Fechar</button></div></div>';
    return h;
  }
  async function pedirOficina() {
    var p = estado.personagem, f = estado.contratar, st = estado.oficinas;
    var x = st && (st.lista || []).filter(function (o) { return o.id === f.artesao; })[0];
    if (!x || estado.oficinaOcupado) return;
    var tipo = f.tipo, itemId = null, op = {}, livres = R.mochila(p).filter(function (i) { return !i.travado; });
    if (tipo === 'encantar') { var ie = livres.filter(function (i) { return i.encanto < D.encantamento.maximo && !i.runa; }); itemId = (ie.filter(function (i) { return i.id === f.item; })[0] || ie[0]).id;
      var itE = p.inventario.filter(function (i) { return i.id === itemId; })[0]; op.protecao = !!f.protecao && R.qtdConsumivel(p, 'protecao', itE.raridade) > 0; }
    if (tipo === 'forjar') { var cr = D.areas.filter(function (a) { return R.qtdConsumivel(p, 'receita', a.id) > 0; }); op.area = (cr.filter(function (a) { return a.id === f.area; })[0] || cr[0]).id;
      op.classe = f.classe || p.classe; op.tipo = f.peca || 'arma'; op.chefe = Number(f.chefe) || 0; op.gemas = Number(f.gemas) || 0; }
    if (tipo === 'receita') op.area = f.area || D.areas[0].id;
    if (tipo === 'protecao') op.raridade = D.CRAFT.protecao[f.raridade] ? f.raridade : 'comum';
    if (tipo === 'reliquia') { var Q = D.CRAFT.reliquia, lend = livres.filter(function (i) { return i.raridade === 'lendaria' && i.encanto >= Q.encantoMin && !i.runa; });
      itemId = (lend.filter(function (i) { return i.id === f.item; })[0] || lend[0]).id; op.nome = (f.nome || '').trim(); }
    estado.oficinaOcupado = true;
    try {
      p.poder = R.poder(p);
      await C.salvarPersonagem(p);                // o servidor tira do personagem salvo
      var r = await C.oficina.pedir(p.id, x.id, tipo, itemId, op);
      if (r.item_id) p.inventario = p.inventario.filter(function (i) { return i.id !== r.item_id; });
      (r.insumos || []).forEach(function (i) { R.mudarConsumivel(p, i.tipo, i.raridade, -i.qtd); });
      salvar();
      estado.contratar = null;
      avisar('Pedido enviado para ' + x.nome + '! Você vê o resultado em "Meus pedidos".', 'item');
      carregarArena();   // ouro gasto (créditos)
      carregarOficinas();
    } catch (e) { avisar(e.message); }
    estado.oficinaOcupado = false;
  }
  function cliqueOficinas(acao, el) {
    var p = estado.personagem;
    switch (acao) {
      case 'of-salvar': {
        var sv = {};
        servicosDe(p).forEach(function (k) { var c = document.getElementById('of-preco-' + k), v = c && Math.floor(Number(c.value)); if (v > 0) sv[k] = v; });
        configurarOficina(sv);
        return true;
      }
      case 'of-fechar': configurarOficina({}); return true;
      case 'of-contratar': estado.contratar = { artesao: el.dataset.id, tipo: el.dataset.valor }; telaJogo(); return true;
      case 'of-contratar-fechar': estado.contratar = null; telaJogo(); return true;
      case 'of-filtro': estado.ofFiltro = el.dataset.valor; estado.contratar = null; telaJogo(); return true;
      case 'of-pedir': pedirOficina(); return true;
      case 'of-cancelar':
        C.oficina.cancelar(p.id, Number(el.dataset.id)).then(function () { avisar('Pedido cancelado: tudo volta para você.'); carregarArena(); carregarOficinas(); }, function (e) { avisar(e.message); });
        return true;
      case 'of-fazer':
        el.disabled = true;
        C.oficina.fazer(p.id, Number(el.dataset.id)).then(function (r) {
          var t = r.sucesso === true ? 'SUCESSO!' : r.raridade ? 'Forjado: ' + D.raridades[r.raridade].nome + (r.obraPrima ? ' (obra-prima!)' : '') : r.sucesso === false ? 'Falhou…' : 'Pronto!';
          avisar('🔨 ' + t + ' O pagamento chega já já.', r.sucesso === false ? '' : 'item');
          carregarArena(); carregarOficinas();
        }, function (e) { avisar(e.message); el.disabled = false; });
        return true;
    }
    return false;
  }

  // ----- Missões diárias e semanais -----
  // Painel de missões: aba fixa na direita da tela que abre um painel com as Diárias e as Semanais
  // (cada uma abre e fecha). Fica fora do #app, como o chat.
  var missoesUI = { el: null, aberto: false, diarias: true, semanais: false };
  function desenharMissoes(visivel) {
    var p = estado.personagem;
    if (!missoesUI.el) {
      missoesUI.el = document.createElement('div');
      missoesUI.el.id = 'painel-missoes';
      missoesUI.el.addEventListener('click', cliqueMissoes);
      document.body.appendChild(missoesUI.el);
    }
    if (visivel === false || !p) { missoesUI.el.hidden = true; return; }
    missoesUI.el.hidden = false;
    var agora = C.agora(), m = R.garantirMissoes(p, agora), M = D.MISSOES, prontas = avisosMissoes(p, agora);
    var seloM = document.getElementById('casca-missoes-selo');
    if (seloM) { seloM.hidden = !prontas; seloM.textContent = prontas || ''; }
    var aba = '<button class="missoes-aba" data-missao="painel" aria-expanded="' + missoesUI.aberto + '" title="Missões">'
      + '<span class="missoes-aba-ico">📜</span><span class="missoes-aba-txt">Missões</span>'
      + (prontas ? '<span class="selo-pedidos">' + prontas + '</span>' : '') + '</button>';
    if (!missoesUI.aberto) { missoesUI.el.className = ''; missoesUI.el.innerHTML = aba; return; }
    function carta(tipo, x) {
      var chave = tipo === 'diarias' ? 'd' : 's', feito = m[chave + 'Ok'][x.id], prog = m[chave][x.id] || 0, pronto = !feito && prog >= x.meta;
      return '<div class="missao-carta' + (feito ? ' feita' : pronto ? ' pronta' : '') + '">'
        + '<div class="missao-topo"><strong>' + x.nome + '</strong><span class="missao-num">' + prog + '/' + x.meta + '</span></div>'
        + '<div class="missao-texto">' + x.texto + '</div>'
        + '<div class="missao-barra"><i style="width:' + Math.min(100, prog / x.meta * 100) + '%"></i></div>'
        + '<div class="missao-pe"><span class="cor-ouro">' + R.premioTexto(p, x.premio) + '</span>'
        + (feito ? '<span class="mais">✔</span>' : pronto ? '<button class="btn btn-pequeno" data-missao="resgatar" data-tipo="' + tipo + '" data-id="' + x.id + '">Resgatar</button>' : '')
        + '</div></div>';
    }
    function secao(tipo, titulo, renova, lista, extra) {
      var chave = tipo === 'diarias' ? 'dOk' : 'sOk', feitas = lista.filter(function (x) { return m[chave][x.id]; }).length;
      var aberta = missoesUI[tipo];
      return '<section class="missoes-secao' + (aberta ? ' aberta' : '') + '"><button class="missoes-cabeca" data-missao="secao" data-tipo="' + tipo + '" aria-expanded="' + aberta + '">'
        + '<span>' + titulo + '</span><span class="suave pequeno">' + feitas + '/' + lista.length + ' · ' + renova + '</span><i aria-hidden="true">▾</i></button>'
        + (aberta ? '<div class="missoes-lista">' + lista.map(function (x) { return carta(tipo, x); }).join('') + (extra || '') + '</div>' : '') + '</section>';
    }
    var todas = M.diarias.every(function (x) { return m.dOk[x.id]; });
    // Baú do dia: a missão final das diárias, em destaque (baú grande, quantas faltam e barra)
    var feitas = M.diarias.filter(function (x) { return m.dOk[x.id]; }).length;
    var bau = '<div class="missao-carta missao-bau' + (m.bonus ? ' feita' : todas ? ' pronta' : '') + '"><span class="missao-bau-ico"><img src="assets/itens/' + (m.bonus ? 'bau-diario-aberto' : 'bau-diario') + '.webp" alt=""></span><div class="missao-bau-corpo">'
      + '<div class="missao-topo"><strong>Baú do dia</strong><span class="missao-num">' + feitas + '/' + M.diarias.length + '</span></div>'
      + '<div class="missao-texto">' + (m.bonus ? 'Aberto! Volta amanhã.' : todas ? 'Todas as diárias feitas: abra o baú!' : 'Resgate todas as diárias para abrir') + '</div>'
      + '<div class="missao-barra"><i style="width:' + Math.round(feitas * 100 / M.diarias.length) + '%"></i></div>'
      + '<div class="missao-pe"><span class="cor-ouro">' + R.premioTexto(p, M.bonusDiario) + '</span>'
      + (m.bonus ? '<span class="mais">✔</span>' : todas ? '<button class="btn btn-pequeno" data-missao="bau">Abrir</button>' : '') + '</div></div></div>';
    var le = R.loginEstado(p, agora);
    var cartaoLogin = '<div class="missao-carta missao-login' + (le.pode ? ' pronta' : ' feita') + '"><span class="missao-bau-ico">🗓</span><div class="missao-bau-corpo">'
      + '<div class="missao-topo"><strong>Prêmio de login</strong><span class="missao-num">' + (le.boasVindas ? 'Boas-vindas ' + (le.pode ? le.proxSemana : le.semana) + '/7 · ' : '') + (le.pode ? le.proxTrinta : le.trinta || 1) + '/30</span></div>'
      + '<div class="missao-texto">' + (le.pode ? 'Seu prêmio de hoje está esperando!' : 'Pego hoje. Volte amanhã: os dias não precisam ser seguidos.') + '</div>'
      + '<div class="missao-pe"><span></span><button class="btn btn-pequeno' + (le.pode ? '' : ' secundario') + '" data-missao="login">' + (le.pode ? 'Pegar' : 'Ver') + '</button></div></div></div>';
    var dias = Math.floor(R.msAteSemana(agora) / 86400000);
    missoesUI.el.className = 'aberto';
    missoesUI.el.innerHTML = aba + '<div class="missoes-painel" role="dialog" aria-label="Missões"><div class="missoes-titulo"><span>📜 Missões</span>'
      + '<button data-missao="painel" title="Fechar">✕</button></div>' + cartaoLogin
      + secao('diarias', 'Diárias', 'renova em ' + tempoTexto(R.msAteReset(agora)), M.diarias, bau)
      + secao('semanais', 'Semanais', 'renova em ' + (dias ? dias + 'd ' : '') + tempoTexto(R.msAteSemana(agora) % 86400000), M.semanais) + '</div>';
  }
  function cliqueMissoes(e) {
    var el = e.target.closest('[data-missao]'), p = estado.personagem;
    if (!el || !p) return;
    var acao = el.dataset.missao;
    if (acao === 'painel') missoesUI.aberto = !missoesUI.aberto;
    else if (acao === 'login') { missoesUI.aberto = false; estado.loginAberto = true; estado.loginResultado = null; telaJogo(); }
    else if (acao === 'secao') missoesUI[el.dataset.tipo] = !missoesUI[el.dataset.tipo];
    else if (acao === 'resgatar' || acao === 'bau') {
      var premio = acao === 'bau' ? R.resgatarBonusDiario(p, C.agora()) : R.resgatarMissao(p, el.dataset.tipo, el.dataset.id, C.agora());
      if (premio) { salvar(); atualizarFicha(); avisar((acao === 'bau' ? 'Baú do dia: ' : 'Missão concluída: ') + premio + '!', acao === 'bau' ? 'item' : 'nivel'); }
    }
    desenharMissoes();
  }

  // ----- Forja: a barra do encantamento enche; no sucesso chega a 100%, na falha para no meio e racha -----
  // Uma tentativa de encantar: sorteia, salva e abre a Forja.
  function tentarEncantar(id) {
    var p = estado.personagem;
    var alvoEnc = p.inventario.find(function (i) { return i.id === id; });
    var antesEnc = alvoEnc && Object.assign({}, alvoEnc);
    var chanceEnc = alvoEnc && R.chanceEncantar(p, alvoEnc), riscoEnc = alvoEnc && R.riscoEncantar(alvoEnc);
    // O resultado é sorteado e salvo antes da animação (recarregar a página no meio não muda nada).
    var tentativa = R.encantar(p, id, null, !!estado.usarProtecao);
    if (tentativa && tentativa.protegido) riscoEnc = 'protegido';
    estado.encantoPendente = null;
    if (tentativa) {
      R.registrarMissao(p, 'encantar', 1, C.agora());
      missaoCla('encantar', 1);
      if (tentativa.sucesso) R.registrarMissao(p, 'encantoSucesso', 1, C.agora());
      salvar();
      abrirForja(antesEnc, tentativa, chanceEnc, riscoEnc);
    }
  }

  function abrirForja(item, res, chance, risco) {
    var tipo = res.sucesso ? 'sucesso' : res.quebrou ? 'quebra' : risco === 'zera' ? 'zera' : 'falha';
    var parada = res.sucesso ? 100 : 18 + Math.random() * 74;          // onde a barra para na falha
    var duracao = 2600 * parada / 100 + 300;
    var nome = esc(R.nomeItem(Object.assign({}, item, { encanto: 0 })));
    var ov = document.createElement('div');
    ov.className = 'zoom-fundo forja-fundo';
    ov.innerHTML = '<div class="zoom-janela forja-janela" role="dialog" aria-label="Encantamento">'
      + '<div class="zoom-rotulo">Forja de encantamento</div>'
      + '<div class="forja-item"><div class="icone-grande borda-' + corItem(item) + aura(item) + '">' + F.icone(item) + '</div>'
      + '<div><div class="forja-nome raridade-' + corItem(item) + '">' + nome + '</div>'
      + '<div class="suave">+' + item.encanto + ' → <strong class="cor-ouro">+' + (item.encanto + 1) + '</strong> · chance ' + fmtDec(chance) + '%</div></div></div>'
      + '<div class="forja-barra"><i></i><span class="forja-pct">0%</span></div>'
      + '<div class="forja-resultado" aria-live="assertive">Encantando…</div>'
      + '<div class="botoes"><button class="btn" data-forja="ok" disabled>Continuar</button></div></div>';
    document.body.appendChild(ov);
    var barra = ov.querySelector('.forja-barra'), fill = barra.querySelector('i'), pct = barra.querySelector('.forja-pct');
    var parar = Sons.carregar(duracao / 1000);
    var inicio = performance.now();
    (function passo(agora) {
      var k = Math.min(1, (agora - inicio) / duracao);
      // enche rápido no começo e vai ficando tenso no fim
      var v = parada * (1 - Math.pow(1 - k, 1.6));
      fill.style.width = v + '%';
      pct.textContent = Math.floor(v) + '%';
      if (k < 1) { requestAnimationFrame(passo); return; }
      parar();
      terminar();
    })(inicio);
    function terminar() {
      var r = ov.querySelector('.forja-resultado');
      barra.classList.add(res.sucesso ? 'cheia' : 'rachou');
      ov.querySelector('.forja-janela').classList.add('forja-' + tipo);
      r.className = 'forja-resultado ' + tipo;
      r.innerHTML = {
        sucesso: 'SUCESSO! <span>' + nome + ' agora é +' + res.nivel + '!</span>',
        falha: 'FALHOU! <span>O pergaminho se perdeu, mas o item continua +' + res.nivel + '.</span>',
        zera: 'FALHOU! <span>' + nome + ' voltou para +0.</span>',
        quebra: 'QUEBROU! <span>' + nome + ' +' + res.nivel + ' se despedaçou…</span>'
          + (res.cristais ? '<span class="forja-cristais">Sobraram <strong class="raridade-' + item.raridade + '">' + res.cristais + ' '
            + 'Cristais ' + { comum: 'Comuns', rara: 'Raros', epica: 'Épicos', lendaria: 'Lendários' }[item.raridade]
            + '</strong> (Mochila › Consumíveis).</span>' : ''),
      }[tipo];
      Sons[tipo]();
      var ok = ov.querySelector('[data-forja="ok"]');
      ok.disabled = false;
      // Depois do sucesso: botão +1 para encantar de novo o mesmo item, se ainda tiver pergaminho.
      var p = estado.personagem, atual = res.sucesso && p.inventario.find(function (i) { return i.id === item.id; });
      if (atual && atual.encanto < D.encantamento.maximo && R.qtdPergaminho(p, atual.raridade) > 0) {
        var mais = document.createElement('button');
        mais.className = 'btn forja-mais';
        mais.dataset.forja = 'mais';
        mais.innerHTML = '+1 <small>(+' + atual.encanto + ' → +' + (atual.encanto + 1) + ' · ' + fmtDec(R.chanceEncantar(p, atual)) + '%)</small>';
        mais.title = 'Encantar de novo · você tem ' + R.qtdPergaminho(p, atual.raridade) + ' pergaminho(s) para item ' + ITEM_RARIDADE[atual.raridade];
        ok.parentNode.insertBefore(mais, ok);
        mais.focus();
      } else ok.focus();
    }
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-forja]');
      if (!b || b.disabled) return;
      ov.remove();
      estado.ultimoEncanto = res;
      if (b.dataset.forja === 'mais') {
        var atual = estado.personagem.inventario.find(function (i) { return i.id === item.id; });
        // Se o próximo + pode quebrar o item, pede a confirmação de sempre na aba Encantar.
        if (atual && R.riscoEncantar(atual) === 'quebra') {
          estado.encantoPendente = atual.id;
          estado.ultimoEncanto = null;
          telaJogo();
          return;
        }
        tentarEncantar(item.id);
        return;
      }
      telaJogo();
    });
  }

  // ----- Sons do jogo (criados no navegador, sem arquivos) -----
  var Sons = (function () {
    var ctx = null, geral = null, volumeGeral = 1;
    function ac() {
      var A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      if (!ctx) { ctx = new A(); geral = ctx.createGain(); geral.gain.value = volumeGeral; geral.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    // Todos os efeitos passam por aqui: o volume dos efeitos das configurações.
    function saida() { return geral; }
    function nota(freq, ini, dur, tipo, vol, freqFim) {
      var c = ac(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + ini;
      o.type = tipo || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (freqFim) o.frequency.exponentialRampToValueAtTime(freqFim, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(saida());
      o.start(t); o.stop(t + dur + 0.05);
    }
    function ruido(ini, dur, vol, corte) {
      var c = ac(); if (!c) return;
      var buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = buf; f.type = 'highpass'; f.frequency.value = corte || 1200; g.gain.value = vol || 0.3;
      s.connect(f); f.connect(g); g.connect(saida());
      s.start(c.currentTime + ini);
    }
    return {
      volume: function (v) { volumeGeral = v; if (geral) geral.gain.value = v; },
      // forja enquanto a barra enche: marteladas na bigorna acelerando e o fogo roncando por baixo.
      // Devolve a função que corta tudo na hora em que a barra para.
      carregar: function (seg) {
        var c = ac(); if (!c) return function () {};
        var mestre = c.createGain(), t0 = c.currentTime;
        mestre.gain.value = 1;
        mestre.connect(saida());
        // ronco do fogo: ruído grave filtrado que cresce
        var buf = c.createBuffer(1, Math.floor(c.sampleRate * (seg + 0.5)), c.sampleRate), d = buf.getChannelData(0);
        for (var n = 0; n < d.length; n++) d[n] = Math.random() * 2 - 1;
        var fogo = c.createBufferSource(), lp = c.createBiquadFilter(), gf = c.createGain();
        fogo.buffer = buf; lp.type = 'lowpass'; lp.frequency.setValueAtTime(220, t0); lp.frequency.linearRampToValueAtTime(700, t0 + seg);
        gf.gain.setValueAtTime(0.0001, t0); gf.gain.exponentialRampToValueAtTime(0.12, t0 + seg);
        fogo.connect(lp); lp.connect(gf); gf.connect(mestre); fogo.start(t0);
        // marteladas: intervalo cai de 0,42 s para 0,11 s
        var t = 0.05;
        while (t < seg) {
          var k = t / seg, forte = 0.12 + 0.1 * k;
          [[880, 1], [1320, 0.5], [2280, 0.3]].forEach(function (h) {      // metal: parciais desafinados
            var o = c.createOscillator(), g = c.createGain(), ini = t0 + t;
            o.type = 'square'; o.frequency.value = h[0] * (1 + k * 0.15);
            g.gain.setValueAtTime(forte * h[1], ini); g.gain.exponentialRampToValueAtTime(0.0001, ini + 0.18);
            o.connect(g); g.connect(mestre); o.start(ini); o.stop(ini + 0.2);
          });
          var o2 = c.createOscillator(), g2 = c.createGain(), ini2 = t0 + t;        // pancada grave
          o2.type = 'sine'; o2.frequency.setValueAtTime(140, ini2); o2.frequency.exponentialRampToValueAtTime(60, ini2 + 0.12);
          g2.gain.setValueAtTime(0.25, ini2); g2.gain.exponentialRampToValueAtTime(0.0001, ini2 + 0.15);
          o2.connect(g2); g2.connect(mestre); o2.start(ini2); o2.stop(ini2 + 0.16);
          t += 0.42 - 0.31 * k;
        }
        return function () {
          var agora = c.currentTime;
          mestre.gain.cancelScheduledValues(agora); mestre.gain.setValueAtTime(mestre.gain.value, agora);
          mestre.gain.linearRampToValueAtTime(0, agora + 0.05);
          setTimeout(function () { mestre.disconnect(); try { fogo.stop(); } catch (e) { /* já parou */ } }, 120);
        };
      },
      sucesso: function () {
        [523, 659, 784, 1047].forEach(function (f, i) { nota(f, i * 0.09, 0.5, 'triangle', 0.16); });
        nota(1568, 0.36, 0.9, 'sine', 0.08); nota(2093, 0.42, 1.1, 'sine', 0.05);
      },
      falha: function () { nota(220, 0, 0.25, 'square', 0.06, 180); nota(165, 0.22, 0.45, 'square', 0.06, 110); },
      zera: function () { nota(660, 0, 0.9, 'sawtooth', 0.07, 90); nota(440, 0.05, 0.8, 'triangle', 0.06, 70); },
      quebra: function () {
        ruido(0, 0.35, 0.35, 1500); nota(90, 0, 0.35, 'sine', 0.3, 45);
        for (var i = 0; i < 7; i++) nota(2200 + Math.random() * 2600, 0.05 + Math.random() * 0.4, 0.18, 'sine', 0.05);
      },
    };
  })();

  // Ranking: busca no servidor ao abrir a aba (e no botão Atualizar).
  function abaRanking() {
    var tipo = estado.rankingTipo || 'nivel';
    var r = estado.ranking;
    if (!r || r.tipo !== tipo) {
      carregarRanking(tipo);
      r = null;
    }
    var botoes = [['nivel', 'Level'], ['poder', 'Poder'], ['clas', 'Clãs']].map(function (t) {
      return '<button class="btn mini-opcao' + (t[0] === tipo ? '' : ' secundario') + '" data-acao="ranking-tipo" data-valor="' + t[0] + '">' + t[1] + '</button>';
    }).join('');
    var meus = (estado.conta.personagens || []).map(function (x) { return x.nome.toLowerCase(); });
    var corpo, eu = estado.personagem, possoAtacar = eu && eu.nivel >= 5;
    if (!r) corpo = '<p class="suave">Carregando…</p>';
    else if (r.erro) corpo = '<p class="menos">' + esc(r.erro) + '</p>' + (tipo === 'clas' ? '<p class="suave pequeno">Se for a primeira vez, rode o supabase/schema.sql de novo no Supabase.</p>' : '');
    else if (!r.lista.length) corpo = '<p class="suave">' + (tipo === 'clas' ? 'Nenhum clã ainda.' : 'Ninguém no ranking ainda.') + '</p>';
    else if (tipo === 'clas') corpo = rankingClasHtml(r.lista);
    else if (CELULAR) corpo = '<div class="itens">' + r.lista.map(function (x, i) {   // celular: cartões com retrato, sem tabela
      var meu = meus.indexOf(String(x.nome).toLowerCase()) >= 0;
      return linhaRanking(Object.assign({}, x, { posicao: i + 1, id: meu ? eu.id : x.id }), possoAtacar && x.id && x.nivel >= 5 && !meu
        ? '<button class="btn" data-acao="ranking-atacar" data-id="' + esc(x.id) + '">⚔ Atacar</button>' : '');
    }).join('') + '</div>';
    else corpo = '<table class="ranking"><thead><tr><th>#</th><th>Personagem</th><th>Classe</th><th>Level</th><th>Poder</th>' + (possoAtacar ? '<th></th>' : '') + '</tr></thead><tbody>'
      + r.lista.map(function (x, i) {
        var pos = i + 1;
        var medalha = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
        return '<tr class="' + (meus.indexOf(String(x.nome).toLowerCase()) >= 0 ? 'meu' : '') + '"><td class="pos">' + medalha + '</td>'
          + '<td>' + siglaHtml(x.sigla) + '<strong>' + esc(x.nome) + '</strong><div class="suave pequeno">' + nomeRaca(x.raca, x.sexo) + '</div></td>'
          + '<td>' + nomeClasseX(x) + '</td>'
          + '<td>' + x.nivel + '</td><td>' + Number(x.poder || 0).toLocaleString('pt-BR') + '</td>'
          + (possoAtacar ? '<td>' + (x.id && x.nivel >= 5 && meus.indexOf(String(x.nome).toLowerCase()) < 0
            ? '<button class="btn mini-opcao" data-acao="ranking-atacar" data-id="' + esc(x.id) + '" title="Luta da Arena fora da escada: gasta 1 entrada, não muda posição">⚔ Atacar</button>' : '') + '</td>' : '')
          + '</tr>';
      }).join('') + '</tbody></table>';
    return '<div class="ranking-topo"><div class="botoes">' + botoes + '</div>'
      + '<button class="btn secundario mini-opcao" data-acao="ranking-atualizar">Atualizar</button></div>'
      + (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '')
      + '<p class="suave pequeno">' + (tipo === 'clas' ? 'Os 50 melhores clãs por level do clã (empate: exp do clã e o poder somado dos membros).'
        : 'Os 100 melhores de ' + D.NOME_JOGO + (tipo === 'nivel' ? ' por level (empate: quem tem mais exp).' : ' por poder, a força calculada pelos status e equipamentos.')
        + ' Seus personagens aparecem destacados. Contas de administrador não entram.'
        + (possoAtacar ? ' Em "Atacar" você luta com qualquer um da Arena (level 5+): gasta 1 entrada e não muda a posição.' : '')) + '</p>'
      + (CELULAR ? '</details>' : '') + corpo;
  }
  // Ranking dos clãs: brasão, sigla e nome, level, membros, poder somado e líder. O meu clã fica destacado.
  function rankingClasHtml(lista) {
    var meuCla = (aliancaAtual() || {}).alianca;
    return '<div class="itens">' + lista.map(function (x, i) {
      var meu = meuCla && Number(meuCla.id) === Number(x.id);
      return '<div class="item arena-linha cla-linha' + (meu ? ' meu' : '') + '"><div class="arena-pos">' + trofeu(i + 1) + '</div>'
        + '<span class="cla-brasao">' + brasaoSvg(x.brasao || {}) + '</span>'
        + '<div class="amigo-info"><strong>[' + esc(x.sigla) + '] ' + esc(x.nome) + '</strong><div class="suave pequeno">Lv ' + x.nivel + ' · ' + x.membros
        + (x.membros === 1 ? ' membro' : ' membros') + ' · Poder ' + Number(x.poder || 0).toLocaleString('pt-BR') + (x.lider ? ' · 👑 ' + esc(x.lider) : '') + '</div></div>'
        + '<div class="item-acoes"></div></div>';
    }).join('') + '</div>';
  }

  // ---------------- Social: amigos ----------------
  // A lista vem do servidor ao abrir a aba e a cada minuto (junto com o "estou online").
  var ONLINE_MS = 3 * 60000;

  function socialAtual() {
    var s = estado.social;
    return s && estado.personagem && s.id === estado.personagem.id ? s : null;
  }
  function seloPedidos() {
    var s = socialAtual();
    var n = s && s.lista ? s.lista.filter(function (x) { return x.situacao === 'recebido'; }).length : 0;
    return n ? ' <span class="selo-pedidos">' + n + '</span>' : '';
  }

  function carregarSocial() {
    var p = estado.personagem;
    if (!p || estado.socialCarregando) return;
    estado.socialCarregando = true;
    C.amigos.listar(p.id).then(function (lista) {
      return { id: p.id, lista: lista };
    }, function (e) {
      return { id: p.id, erro: 'Não foi possível carregar os amigos: ' + e.message };
    }).then(function (r) {
      estado.socialCarregando = false;
      estado.social = r;
      if (estado.personagem !== p || estado.batalha || estado.resultado || estado.chefeAviso) return;
      if (estado.aba === 'social') telaJogo();
      else {
        atualizarNav();
      }
    });
  }

  function vistoTexto(visto) {
    if (!visto || !Number.isFinite(Date.parse(visto))) return '<span class="suave">○ Offline</span>';
    var ms = C.agora() - Date.parse(visto);
    if (ms < ONLINE_MS) return '<span class="online">● Online</span>';
    var min = Math.floor(ms / 60000);
    var quando = min < 60 ? min + ' min' : min < 1440 ? Math.floor(min / 60) + ' h' : Math.floor(min / 1440) + ' dia(s)';
    return '<span class="suave">○ Offline · visto há ' + quando + '</span>';
  }

  function linhaAmigo(x, botoes) {
    var aberto = estado.amigoAberto === Number(x.pedido);
    var info = '<span>' + siglaHtml(x.sigla) + '<strong>' + esc(x.nome) + '</strong> ' + vistoTexto(x.visto_em) + '</span>'
      + '<span class="suave">' + nomeRaca(x.raca, x.sexo) + ' · ' + nomeClasseX(x)
      + ' · Level ' + x.nivel + ' · Poder ' + Number(x.poder || 0).toLocaleString('pt-BR') + '</span>';
    return '<div class="item amigo"><div class="amigo-info">'
      + (x.situacao === 'amigo' ? '<button class="amigo-toggle" data-acao="amigo-abrir" data-pedido="' + x.pedido
        + '" aria-expanded="' + aberto + '">' + info + '</button>' : info) + '</div>'
      + (botoes ? '<div class="item-acoes">' + botoes + '</div>' : '') + '</div>';
  }

  function abaSocial() {
    var s = socialAtual();
    if (!s) carregarSocial();
    var form = '<form class="form-amigo" data-form="amigo" novalidate>'
      + '<label for="nome-amigo">Adicionar amigo</label><div class="linha-form">'
      + '<input id="nome-amigo" name="nome" maxlength="16" placeholder="Nome do personagem" autocomplete="off" required>'
      + '<button class="btn" type="submit">Enviar pedido</button></div><p class="erro"></p></form>';
    if (!s) return form + '<p class="suave">Carregando…</p>';
    if (s.erro) return form + '<p class="menos">' + esc(s.erro) + '</p>';
    var por = function (sit) { return s.lista.filter(function (x) { return x.situacao === sit; }); };
    var recebidos = por('recebido'), amigos = por('amigo'), enviados = por('enviado');
    amigos.sort(function (a, b) { return Date.parse(b.visto_em || 0) - Date.parse(a.visto_em || 0); });
    var online = amigos.filter(function (x) { return x.visto_em && C.agora() - Date.parse(x.visto_em) < ONLINE_MS; }).length;
    function bt(acao, x, texto, classe) {
      return '<button class="btn ' + (classe || '') + '" data-acao="' + acao + '" data-pedido="' + x.pedido + '">' + texto + '</button>';
    }
    var html = form;
    if (recebidos.length) html += '<h3 class="subtitulo">Pedidos recebidos (' + recebidos.length + ')</h3><div class="itens">'
      + recebidos.map(function (x) { return linhaAmigo(x, bt('amigo-aceitar', x, 'Aceitar') + bt('amigo-recusar', x, 'Recusar', 'secundario')); }).join('') + '</div>';
    html += '<h3 class="subtitulo">Amigos (' + amigos.length + ')' + (online ? ' <span class="online pequeno">' + online + ' online</span>' : '') + '</h3>'
      + (amigos.length ? '<div class="itens">' + amigos.map(function (x) {
        return linhaAmigo(x, estado.amigoAberto !== Number(x.pedido) ? '' : estado.removerAmigo === x.pedido
          ? bt('amigo-remover', x, 'Confirmar', 'perigo') + '<button class="btn secundario" data-acao="amigo-manter">Cancelar</button>'
          : '<button class="btn" data-acao="grupo-convidar" data-id="' + esc(x.id) + '" data-nome="' + esc(x.nome) + '">Convidar para o grupo</button>'
              + '<button class="btn secundario" data-acao="amigo-alianca" data-nome="' + esc(x.nome) + '">Convidar para o clã</button>'
            + '<button class="btn secundario" data-acao="amigo-privado" data-id="' + esc(x.id) + '" data-nome="' + esc(x.nome) + '">Privado</button>'
            + '<button class="btn secundario" data-acao="amigo-perfil" data-id="' + esc(x.id) + '">Perfil</button>'
            + bt('amigo-pedir-remover', x, 'Excluir', 'secundario'));
      }).join('') + '</div>' : '<p class="suave">Você ainda não tem amigos. Adicione pelo nome do personagem (dá para ver os nomes no chat e no ranking).</p>');
    if (enviados.length) html += '<h3 class="subtitulo">Pedidos enviados (' + enviados.length + ')</h3><div class="itens">'
      + enviados.map(function (x) { return linhaAmigo(x, '<span class="suave pequeno">Aguardando</span>' + bt('amigo-remover', x, 'Cancelar', 'secundario')); }).join('') + '</div>';
    return html + '<div class="botoes"><button class="btn secundario" data-acao="social-atualizar">Atualizar</button></div>';
  }

  function abrirPrivado(id, nome) {
    var meu = estado.personagem.id;
    var painel = document.createElement('dialog');
    painel.className = 'caixa conversa-privada';
    painel.innerHTML = '<h3>Privado · ' + esc(nome) + '</h3><div class="conversa-mensagens" role="log"></div>'
      + '<p class="erro" role="status"></p><form class="linha-form"><input aria-label="Mensagem" maxlength="300" required>'
      + '<button class="btn" type="submit">Enviar</button><button class="btn secundario" type="button">Fechar</button></form>';
    var lista = painel.querySelector('[role="log"]'), erro = painel.querySelector('.erro');
    var campo = painel.querySelector('input'), enviar = painel.querySelector('[type="submit"]');
    var ocupado = false;
    async function atualizar() {
      if (ocupado || !painel.open) return;
      if (!estado.personagem || estado.personagem.id !== meu) { painel.close(); return; }
      ocupado = true;
      try {
        var mensagens = await C.privado.listar(meu, id);
        var ultima = mensagens.length ? mensagens[mensagens.length - 1].id : null;
        if (!lista.childNodes.length || lista.dataset.ultima !== String(ultima)) {
          lista.innerHTML = mensagens.length ? mensagens.map(function (m) {
            return '<p><strong>' + (m.de === meu ? 'Você' : esc(nome)) + ':</strong> ' + esc(m.texto) + '</p>';
          }).join('') : '<p class="suave">Nenhuma mensagem ainda.</p>';
          lista.dataset.ultima = ultima;
          lista.scrollTop = lista.scrollHeight;
        }
      } catch (e) { erro.textContent = e.message; }
      finally { ocupado = false; }
    }
    painel.querySelector('form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var texto = campo.value.trim();
      if (!texto || enviar.disabled) return;
      enviar.disabled = true;
      try {
        await C.privado.enviar(meu, id, texto);
        campo.value = '';
        erro.textContent = '';
        atualizar();
      } catch (err) { erro.textContent = err.message; }
      finally { enviar.disabled = false; }
    });
    painel.querySelector('[type="button"]').onclick = function () { painel.close(); };
    painel.addEventListener('close', function () { clearInterval(timer); painel.remove(); });
    document.body.appendChild(painel);
    painel.showModal();
    var timer = setInterval(atualizar, 4000);
    atualizar();
  }

  async function acaoAmigo(fn, msg) {
    try {
      await fn();
      if (msg) avisar(msg);
    } catch (e) { avisar(e.message); }
    estado.removerAmigo = null;
    estado.social = null;
    carregarSocial();
  }

  function carregarRanking(tipo) {
    if (estado.rankingCarregando === tipo) return;
    estado.rankingCarregando = tipo;
    (tipo === 'clas' ? C.rankingClas() : C.ranking(tipo)).then(function (lista) {
      return { tipo: tipo, lista: lista };
    }, function (e) {
      return { tipo: tipo, erro: 'Não foi possível carregar o ranking: ' + e.message };
    }).then(function (r) {
      estado.rankingCarregando = null;
      estado.ranking = r;
      if (estado.aba === 'ranking' && !estado.batalha && !estado.resultado && !estado.chefeAviso) telaJogo();
    });
  }

  // Pedidos de "Esqueci a senha" e a senha temporária recém-gerada (com o e-mail pronto para mandar).
  function adminSenhasHtml() {
    var g = estado.adminSenhaGerada, html = '';
    if (g) {
      var corpo = 'Olá, ' + g.usuario + '!\n\nSua senha temporária do ' + D.NOME_JOGO + ' é: ' + g.senha
        + '\n\nEntre com o seu usuário (' + g.usuario + ') e essa senha. O jogo vai pedir para você criar uma senha nova.\n\nSe não foi você que pediu, responda este e-mail.';
      var link = 'mailto:' + g.email.replace(/[^\w.+@-]/g, '') + '?subject=' + encodeURIComponent(D.NOME_JOGO + ' - sua senha temporária') + '&body=' + encodeURIComponent(corpo);
      html += '<div class="item destaque-senha"><div><div>Senha temporária de <strong>' + esc(g.usuario) + '</strong>: <strong class="cor-ouro">' + esc(g.senha) + '</strong></div>'
        + '<div class="suave">Mande só para o e-mail do cadastro: ' + esc(g.email) + '. Ela não aparece de novo depois de fechar.</div></div>'
        + '<div class="item-acoes"><a class="btn" href="' + link + '">Abrir e-mail</a>'
        + '<button class="btn secundario" data-acao="senha-gerada-fechar">Fechar</button></div></div>';
    }
    if (estado.adminSenhas) {
      html += estado.adminSenhas.length ? estado.adminSenhas.map(function (x) {
        return '<div class="item"><div><div><strong>' + esc(x.usuario) + '</strong> · ' + esc(x.email) + '</div>'
          + '<div class="suave pequeno">Personagens: ' + (x.personagens.length ? x.personagens.map(esc).join(', ') : 'nenhum') + ' · pedido em ' + new Date(x.quando).toLocaleString('pt-BR') + '</div></div>'
          + '<div class="item-acoes"><button class="btn" data-acao="senha-gerar" data-id="' + x.id + '" data-usuario="' + esc(x.usuario) + '">Gerar senha temporária</button>'
          + '<button class="btn secundario" data-acao="senha-recusar" data-id="' + x.id + '" data-usuario="' + esc(x.usuario) + '">Recusar</button></div></div>';
      }).join('') : '<p class="suave">Nenhum pedido de senha.</p>';
    }
    return html ? '<div class="itens">' + html + '</div>' : '';
  }

  function abaAdmin() {
    if (!ehAdmin()) return '';
    function botoes(op, valores, rotulo, estilo) {
      return valores.map(function (v) {
        return '<button class="btn' + (estilo ? ' admin-' + estilo : '') + '" data-acao="admin" data-op="' + op + '" data-valor="' + v + '">' + rotulo(v) + '</button>';
      }).join('');
    }
    function grupo(titulo, descricao, conteudo) {
      return '<div class="item"><div><div>' + titulo + '</div><div class="suave">' + descricao + '</div></div>'
        + '<div class="item-acoes">' + conteudo + '</div></div>';
    }
    return '<p class="suave">Ferramentas de teste. Valem só para este personagem e ficam salvas como qualquer progresso.</p>'
      + '<div class="itens">'
      + grupo('Chefe Mundial', 'Invoca Ignaroth agora por 1 hora (para testar). Vida: a do despertar (50 mil por jogador ativo) ou um valor.',
        '<button class="btn" data-acao="boss-invocar" data-valor="0">Invocar</button>'
        + '<button class="btn" data-acao="boss-invocar" data-valor="5000">Vida 5 mil</button>'
        + '<button class="btn" data-acao="boss-invocar" data-valor="1000000">Vida 1 milhão</button>')
      + grupo('Ouro', 'Soma ou tira ouro do personagem.', botoes('ouro', [1000, 10000, 100000], function (v) { return '+' + v.toLocaleString('pt-BR'); })
        + botoes('ouro', [-1000, -10000], function (v) { return '−' + (-v).toLocaleString('pt-BR'); }, 'menos')
        + botoes('zerar-ouro', [0], function () { return 'Zerar'; }, 'menos'))
      + grupo('Reputação', 'Soma ou tira reputação do personagem (Arena, clãs e itens especiais).',
        botoes('reputacao', [100, 1000, 10000], function (v) { return '+' + v.toLocaleString('pt-BR'); })
        + botoes('reputacao', [-100, -1000], function (v) { return '−' + (-v).toLocaleString('pt-BR'); }, 'menos')
        + botoes('reputacao', [-1000000], function () { return 'Zerar'; }, 'menos'))
      + grupo('Level', 'Subir dá os pontos de atributo. Descer zera a exp e devolve os pontos para distribuir de novo.',
        botoes('nivel', [1, 5, 10], function (v) { return '+' + v; })
        + botoes('baixar-nivel', [1, 5], function (v) { return '−' + v; }, 'menos')
        + botoes('baixar-nivel', [99], function () { return 'Voltar ao 1'; }, 'menos'))
      + grupo('Experiência', '% da exp do level atual.', botoes('exp', [10, 50], function (v) { return '+' + v + '%'; })
        + botoes('exp', [-10, -50, -100], function (v) { return v === -100 ? 'Zerar' : '−' + (-v) + '%'; }, 'menos'))
      + grupo('Atributos', 'Volta os atributos aos da raça e classe e devolve todos os pontos.', botoes('resetar-atributos', [0], function () { return 'Resetar pontos'; }, 'menos'))
      + grupo('Armas', 'Uma arma de cada raridade da classe.', botoes('armas', [0, 7, 10], function (v) { return 'Todas +' + v; }))
      + grupo('Conjunto completo', 'Arma, 4 armaduras da classe, colar e 2 anéis.', R.RARIDADES.map(function (k) {
        return '<button class="btn" data-acao="admin" data-op="conjunto" data-valor="' + k + '">' + D.raridades[k].nome + '</button>';
      }).join(''))
      + grupo('Pergaminhos', 'De todas as raridades.', botoes('pergaminhos', [10, 100], function (v) { return '+' + v + ' de cada'; })
        + botoes('pergaminhos', [-10], function (v) { return v + ' de cada'; }, 'menos')
        + botoes('pergaminhos', [-1000000], function () { return 'Zerar'; }, 'menos'))
      + grupo('Arena', 'Recarrega as 5 entradas da Arena.',
        '<button class="btn" data-acao="admin-arena-entradas">Recarregar entradas</button>')
      + grupo('Masmorra', 'Zera as entradas de hoje ou dá uma joia (colar ou anel sorteado) da raridade.',
        '<button class="btn" data-acao="admin-masmorra-entradas">Recarregar entradas</button>'
        + R.RARIDADES.map(function (k) { return '<button class="btn" data-acao="admin" data-op="joia" data-valor="' + k + '">Joia ' + D.raridades[k].nome.toLowerCase() + '</button>'; }).join(''))
      + grupo('Mochila', 'Apaga todos os itens que não estão equipados.', estado.adminConfirmar === 'mochila'
        ? '<button class="btn perigo" data-acao="admin" data-op="esvaziar-mochila" data-valor="0">Confirmar: apagar tudo</button>'
          + '<button class="btn secundario" data-acao="admin" data-op="cancelar" data-valor="0">Cancelar</button>'
        : botoes('pedir-esvaziar', [0], function () { return 'Esvaziar mochila'; }, 'menos'))
      + grupo('Estamina e poções', 'Enche a estamina, devolve as poções do dia ou simula o reset da meia-noite.',
        '<button class="btn" data-acao="admin" data-op="curar" data-valor="0">Encher estamina</button>'
        + '<button class="btn" data-acao="admin" data-op="pocoes" data-valor="0">Recarregar poções</button>'
        + '<button class="btn" data-acao="admin" data-op="reset" data-valor="0">Simular reset diário</button>'
        + botoes('vida', [50, 10, 0], function (v) { return v ? 'Estamina em ' + v + '%' : 'Zerar estamina'; }, 'menos')
        + botoes('zerar-pocoes', [0], function () { return 'Zerar poções'; }, 'menos'))
      + grupo('Pedidos de senha', 'Jogadores que clicaram em "Esqueci a senha" com usuário e e-mail certos. Gere a senha temporária e mande para o e-mail do cadastro.',
        '<button class="btn" data-acao="senha-pedidos">' + (estado.adminSenhas ? 'Atualizar pedidos' : 'Ver pedidos') + '</button>')
      + '</div>' + adminSenhasHtml() + '<div class="itens">'
      + grupo('Clãs', 'Todos os clãs do jogo: renomear, dar exp, trocar o líder ou apagar.',
        '<button class="btn" data-acao="al-admin-listar">' + (estado.adminAliancas ? 'Atualizar lista' : 'Ver clãs') + '</button>')
      + '</div>'
      + (estado.adminAliancas ? '<div class="itens">' + (estado.adminAliancas.length ? estado.adminAliancas.map(function (a) {
        return cartaAlianca(a, '<span class="suave pequeno">Líder: ' + esc(a.lider || '—') + '</span>'
          + ['renomear:Renomear', 'exp:+50.000 exp', 'lider:Trocar líder', 'apagar:Apagar'].map(function (o) {
            var x = o.split(':');
            return '<button class="btn btn-pequeno' + (x[0] === 'apagar' ? ' perigo' : ' secundario') + '" data-acao="al-admin" data-op="' + x[0] + '" data-id="' + a.id + '">' + x[1] + '</button>';
          }).join(''));
      }).join('') : '<p class="suave">Nenhum clã.</p>') + '</div>' : '');
  }

  function resultadoHtml() {
    var r = estado.resultado;
    if (!r) return '';
    var m = D.monstros[r.monstroId];
    var cacarDeNovo = r.escolhido ? '<button class="btn" data-acao="cacar" data-monstro="' + r.escolhido + '">Caçar de novo</button>' : '';
    if (r.resultado === 'vitoria') {
      return '<div class="resultado' + (m.chefe ? ' vitoria-chefe' : '') + '"><h2>' + (m.chefe ? 'CHEFE DERROTADO!' : 'Vitória!') + '</h2><p>Você derrotou ' + m.nome + ' e ganhou <strong>' + r.exp + ' de exp</strong> e <strong class="cor-ouro">' + r.ouro + ' de ouro</strong>' + (r.fatorExp < 100 ? ' <span class="suave">(reduzidos e sem drops: área abaixo do seu nível)</span>' : '') + '.</p>'
        + (r.niveis ? '<p class="destaque">Subiu para o level ' + estado.personagem.nivel + '! +' + r.niveis * D.PONTOS_POR_NIVEL + ' pontos de atributo.</p>' : '')
        + (r.habilidadeEvoluiu ? '<p class="habilidade-usada">⚡ Sua habilidade evoluiu para o nível ' + r.habilidadeEvoluiu + '!</p>' : '')
        + (r.drop ? '<p>Drop: ' + dropHtml(r.drop, false) + '</p>' : '')
        + (r.dropArmadura ? '<p>Drop: ' + dropHtml(r.dropArmadura, false) + '</p>' : '')
        + (r.mochilaCheia ? '<p class="menos">Mochila cheia! Um item caiu e se perdeu. Venda itens na aba Personagem.</p>' : '')
        + (r.pergaminho ? '<p>Drop: ' + dropHtml(dropPergaminho(r), false) + '</p>' : '')
        + '<div class="botoes">' + cacarDeNovo
        + '<button class="btn secundario" data-acao="fechar-resultado">Voltar</button></div></div>';
    }
    if (r.resultado === 'derrota') {
      return '<div class="resultado derrota"><h2>Derrota</h2><p>' + m.nome + ' foi mais forte. Você perde a estamina da luta' + (r.expPerdida ? ' e <strong class="menos">' + r.expPerdida.toLocaleString('pt-BR') + ' de exp</strong>' : '') + '. Cuidado com monstros difíceis demais!</p>'
        + '<div class="botoes">' + cacarDeNovo + '<button class="btn secundario" data-acao="fechar-resultado">Voltar</button></div></div>';
    }
    return '<div class="resultado"><p>Você fugiu de ' + m.nome + '.</p><div class="botoes">' + cacarDeNovo + '<button class="btn secundario" data-acao="fechar-resultado">Voltar</button></div></div>';
  }

  function barraPoder(b) {
    return '<div class="barra poder' + (b.jogador.poder >= D.PODER.maximo ? ' cheia' : '') + '"><i style="width:' + b.jogador.poder + '%"></i><b>Poder ' + b.jogador.poder + '</b></div>';
  }

  // Pode beber agora? Na luta que veio pronta do servidor (jogo antigo) não; na luta em etapas sim, até o último golpe.
  function podeBeberPocao(b) {
    if (b.pocaoPendente || b.pocaoNaFila || b.fim || b.pocoes <= 0 || b.jogador.hp >= b.jogador.hpMax) return false;
    return !b.replay || (b.replay.etapas && b.replay.i < b.replay.eventos.length);
  }
  var ICONE_POCAO = '<svg class="icone-pocao" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    + '<path d="M9 5V9C5.5 10.5 4 13 4 16a8 6 0 0 0 16 0c0-3-1.5-5.5-5-7V5Z" fill="#302026" stroke="#d5aa76" stroke-width="1.3"/>'
    + '<path d="M5.5 15c4 1.5 8-2 13-.5 1 4-2.5 6-6.5 6s-7-2-6.5-5.5Z" fill="#b83e48"/>'
    + '<path d="M7.5 14.5a4 4 0 0 1 2-2.7" fill="none" stroke="#f1b2a4" stroke-linecap="round"/>'
    + '<rect x="8" y="2.5" width="8" height="4" rx="1" fill="#b5814d" stroke="#e2bd83"/>'
    + '</svg>';

  function controleHabilidade(b) {
    if (interfaceAtual() === 'zealot' && b.lutador) {
      var lutador = b.lutador;
      var habilidades = lutador.kit.map(function (habilidade) {
        var def = habilidade.def;
        var recarga = Math.max(0, (lutador.pronto[def.id] || 0) - lutador.turno - 1);
        var status = recarga ? recarga + (recarga === 1 ? ' turno' : ' turnos') : 'Pronta';
        return '<span class="cacada-habilidade" role="img" aria-label="' + esc(def.nome + ': ' + status)
          + '" title="' + esc(def.nome + ': ' + status) + '">'
          + '<span class="cacada-habilidade-simbolo" aria-hidden="true">✦</span>' + iconeHab(def)
          + '<small aria-hidden="true">' + (recarga || '✓') + '</small></span>';
      }).join('');
      var podeBeber = podeBeberPocao(b);
      return '<div class="cacada-acoes">' + habilidades
        + '<button class="btn cacada-pocao" data-acao="beber-pocao" title="Beber poção"'
        + (podeBeber ? '' : ' disabled') + '>' + ICONE_POCAO + ' Poção (' + b.pocoes + ')'
        + (b.pocaoPendente ? '…' : '') + '</button></div>';
    }
    var cheia = b.jogador.poder >= D.PODER.maximo;
    var nome = D.habilidades[b.classe].nome;
    var botao = b.habilidadePendente
      ? '<button class="btn btn-habilidade preparada" disabled>⚡ ' + nome + ': preparada!</button>'
      : '<button class="btn btn-habilidade' + (cheia ? ' pronta' : '') + '" data-acao="habilidade"' + (cheia ? '' : ' disabled') + '>⚡ ' + nome + '</button>';
    var pocao = b.pocaoPendente
      ? '<button class="btn btn-pocao" disabled>' + ICONE_POCAO + ' Bebendo…</button>'
      : '<button class="btn btn-pocao" data-acao="beber-pocao"' + (podeBeberPocao(b) ? '' : ' disabled') + '>' + ICONE_POCAO + ' Beber poção (' + b.pocoes + ')</button>';
    if (!D.HABILIDADES_ATIVAS) return pocao;
    return botao + pocao + '<label class="auto-habilidade"><input type="checkbox" id="auto-habilidade" data-acao="auto-habilidade"' + (b.auto ? ' checked' : '') + '> Usar automaticamente</label>';
  }

  function batalhaHtml() {
    var b = estado.batalha || estado.ultimaBatalha;
    var p = estado.personagem;
    var em = !!estado.batalha;
    return '<div class="arena">'
      + '<div class="lutador" id="lutador-jogador"><div class="moldura">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</div><h3>' + esc(p.nome) + '</h3>'
      + '<div id="hp-jogador">' + barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax, 'jogador') + '</div>'
      + (D.HABILIDADES_ATIVAS ? '<div id="poder-jogador">' + barraPoder(b) + '</div>' : '')
      + '<div class="suave">Velocidade ' + b.jogador.vel + '</div>'
      + (em ? '<div id="controle-habilidade">' + controleHabilidade(b) + '</div>' : '') + '</div>'
      + '<div class="vs">VS</div>'
      + '<div class="lutador" id="lutador-monstro"><div class="moldura">' + F.imagemMonstro(b.imagemId || b.monstroId) + '</div><h3>' + b.monstro.nome + '</h3>'
      + '<div id="hp-monstro">' + barra('hp', b.monstro.hp, b.monstro.hpMax, b.monstro.hp + ' / ' + b.monstro.hpMax, 'monstro') + '</div>'
      + '<div class="suave">Velocidade ' + b.monstro.vel + '</div></div></div>'
      + '<div class="registro" id="registro">' + estado.registro.join('') + '</div>'
      + (em ? '<div class="botoes"><button class="btn secundario" data-acao="velocidade">' + (estado.rapido ? 'Velocidade normal' : 'Acelerar 2x') + '</button>'
        + '<button class="btn perigo" data-acao="fugir">Fugir</button></div>' : '');
  }

  function telaJogo() {
    guardarJogo();
    conferirGuia();
    var grupo = grupoDaAba(estado.aba);
    if (grupo) estado.subAba[grupo.id] = estado.aba;
    var atual = history.state;
    if (atual && atual.eldrin === estado.personagem.id && atual.aba !== estado.aba) {
      history.pushState({ eldrin: estado.personagem.id, aba: estado.aba }, '');
    }
    var painel, navegacao = '', abasTopo = '';
    var zealot = interfaceAtual() === 'zealot';
    if (estado.lutaArena) {
      painel = lutaArenaHtml();
    } else if (estado.luta) {
      painel = lutaMasmorraHtml();
    } else if (estado.cacada) {
      painel = cacadaHtml();
    } else if (estado.chefeAviso) {
      painel = avisoChefeHtml();
    } else if (estado.batalha || estado.resultado) {
      painel = resultadoHtml() + batalhaHtml();
    } else {
      navegacao = navHtml();
      var subAbas = subAbasHtml();
      if (zealot && !CELULAR) abasTopo = subAbas;
      painel = (zealot ? '' : navegacao + subAbas)
        + (({ personagem: abaPersonagem, habilidades: abaHabilidades, oficina: abaOficina, cacar: abaCacar, mercado: abaMercado, oficinas: abaOficinas, leilao: abaLeilao, encantar: abaEncantar, ranking: abaRanking, social: abaSocial, masmorra: abaMasmorra, mineracao: abaMineracao, mundial: abaMundial, historia: abaHistoria, arena: abaArena, admin: abaAdmin, alianca: abaAlianca })[estado.aba] || abaCacar)();
    }
    var livre = !(estado.batalha || estado.luta || estado.lutaArena || (estado.cacada && estado.cacada.ativa));
    var trocar = !livre ? '' : (ehAdmin() ? '<button class="btn-icone' + (estado.aba === 'admin' ? ' ativa' : '') + '" data-acao="aba" data-aba="admin" title="Admin" aria-label="Admin">' + ICONES.admin + '</button>' : '')
      + '<button class="btn secundario" data-acao="voltar-personagens">' + (zealot ? ICONES.trocarPersonagem : '') + 'Trocar personagem</button>'
      + '<button class="btn secundario" data-acao="menu-interface">🎨 Interface</button>';
    var menuTopo = '';
    if (zealot) {
      var menuAnterior = document.getElementById('menu-jogo');
      menuTopo = '<details class="menu-jogo" id="menu-jogo"' + (menuAnterior && menuAnterior.open ? ' open' : '')
        + '><summary class="btn' + (abaDoGuia() && abaDoGuia() !== estado.aba ? ' guia-alvo' : '') + '" aria-label="Menu do jogo">' + ICONES.menu + '<span class="menu-rotulo">Menu</span></summary>'
        + '<div class="menu-jogo-painel">' + navegacao + '<div class="menu-jogo-acoes">' + trocar
        + '<button class="btn secundario" data-acao="menu-som">' + ICONES.som + 'Som</button>'
        + '<button class="btn secundario" data-acao="sair">' + ICONES.sair + 'Sair</button></div></div></details>';
    }
    if (CELULAR) menuTopo = menuCelularHtml(livre);
    var personagemCompacto = zealot && estado.aba === 'personagem' && !!navegacao;
    var vista = estado.vistaPersonagem || 'equipamento';
    var vistas = personagemCompacto ? '<div class="personagem-vistas" aria-label="Painéis do personagem">'
      + [['equipamento', 'Equipado'], ['mochila', 'Mochila'], ['atributos', 'Atributos']].map(function (x) {
        return '<button class="btn secundario" data-acao="personagem-vista" data-valor="' + x[0]
          + '" aria-pressed="' + (vista === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' : '';
    mostrarCenario(false);
    atualizarMusica();
    app.innerHTML = (CELULAR ? cascaTopoHtml(menuTopo) : topo(zealot ? '' : trocar, abasTopo, menuTopo)) + recursosHtml()
      + (CELULAR && navegacao ? '<div class="casca-subabas">' + subAbasHtml() + '</div>' : '') + '<div id="boss-barra">' + bossBarraHtml() + '</div><div class="conteudo"><div class="jogo"'
      + (personagemCompacto ? ' data-personagem-vista="' + vista + '"' : zealot && estado.cacada ? ' data-cacada-compacta' : '')
      + '>' + vistas + fichaHtml()
      + '<section class="caixa">' + guiaHtml() + painel + '</section></div></div>' + rodape()
      + (zealot && navegacao ? navBaixoHtml() : '')
      + (estado.zoom && estado.aba === 'personagem' && !estado.batalha && !estado.luta ? zoomHtml() : '')
      + (estado.historiaCena && estado.aba === 'historia' && !estado.batalha && !estado.luta ? historiaCenaHtml() : '')
      + (estado.loginAberto && !estado.batalha && !estado.luta && !estado.lutaArena ? loginHtml() : '')
      + (estado.desafio && (estado.aba === 'arena' || estado.aba === 'ranking' || (estado.aba === 'social' && estado.desafio.tipo === 'perfil')) && !estado.lutaArena ? desafioHtml() : '');
    if (estado.lutaArena) atualizarJanelaDado();
    var reg = document.getElementById('registro');
    if (reg) reg.scrollTop = reg.scrollHeight;
    chatVisivel(true);
    desenharMissoes(true);
  }
  // Depois de redesenhar, a ficha flutuante (se aberta) volta a se prender ao item; some se o item saiu da tela.
  var telaJogoSemFicha = telaJogo;
  telaJogo = function () {
    var args = arguments, ctx = this;
    manterRolagem(function () {
      telaJogoSemFicha.apply(ctx, args);
      // Sub-abas que rolam de lado (celular): a escolhida fica à vista.
      var sub = document.getElementById('sub-abas'), ativa = sub && sub.querySelector('.ativa');
      if (ativa && sub.scrollWidth > sub.clientWidth) sub.scrollLeft = Math.max(0, ativa.getBoundingClientRect().left - sub.getBoundingClientRect().left + sub.scrollLeft - (sub.clientWidth - ativa.offsetWidth) / 2);
      // Celular: fileiras que deslizam de lado abrem mostrando o item escolhido.
      if (CELULAR) document.querySelectorAll('.casca-subabas .sub-abas, .forja-passos > li:first-child .forja-botoes, .loja-secoes, .arena-abas, .alianca-vistas, .mercado-cats').forEach(function (fila) {
        var esc2 = fila.querySelector('.ativa, .sel, .selecionada, [aria-pressed="true"]');
        if (esc2 && fila.scrollWidth > fila.clientWidth) fila.scrollLeft = Math.max(0, esc2.offsetLeft - fila.offsetLeft - (fila.clientWidth - esc2.offsetWidth) / 2);
      });
      // A caixa da caçada (procurando / monstro achado / luta) fica com a maior altura que já teve: nada abaixo dela pula.
      var c = estado.cacada, arena = c && document.querySelector('.cacada-arena');
      if (arena) {
        c.alturaArena = Math.max(c.alturaArena || 0, arena.offsetHeight);
        arena.style.minHeight = c.alturaArena + 'px';
      }
    });
    if (estado.itemFoco || estado.consumivelFoco || estado.dropFoco) desenharFlutuante();
  };

  // Leva a tela até o painel (aviso do chefe e batalha aparecem no topo dele).
  function mostrarPainel() {
    var painel = document.querySelector('.jogo > section');
    if (painel && painel.getBoundingClientRect().top < 0) window.scrollTo(0, window.scrollY + painel.getBoundingClientRect().top - 8);
  }

  // ---------------- Batalha ----------------

  function linha(classe, texto) {
    estado.registro.push('<p class="' + classe + '">' + texto + '</p>');
  }

  // `escolhido` é o monstro que o jogador clicou (para "Caçar de novo" depois de um chefe).
  function iniciarCaca(monstroId, escolhido) {
    var p = estado.personagem;
    estado.resultado = null;
    estado.chefeAviso = null;
    estado.escolhido = escolhido || monstroId;
    estado.batalha = R.iniciarBatalha(p, monstroId);
    estado.registro = [];
    linha('destaque', D.monstros[monstroId].chefe
      ? esc(p.nome) + ' enfrenta ' + D.monstros[monstroId].nome + '!'
      : esc(p.nome) + ' encontra ' + D.monstros[monstroId].nome + '!');
    telaJogo();
    mostrarPainel();
    agendar();
  }

  function agendar() {
    clearTimeout(estado.timer);
    estado.timer = setTimeout(turno, estado.rapido ? 275 : 550);
  }

  function golpe(id, forte) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('golpeado', 'golpe-forte');
    void el.offsetWidth;
    el.classList.add(forte ? 'golpe-forte' : 'golpeado');
    if (CELULAR && forte) vibrar(25);
  }

  function turno() {
    var b = estado.batalha;
    if (!b) return;
    var linhasAntes = estado.registro.length;
    var ev;
    if (b.replay) {   // luta que o servidor já decidiu: só mostra os eventos, um por turno
      if (b.pocaoPendente) return;   // esperando o servidor confirmar a poção
      var x = b.replay.eventos[b.replay.i++];
      if (!x) { if (b.replay.etapas && !b.replay.res) { fimNoServidor(); return; } b.fim = b.replay.res.resultado || 'fuga'; encerrar(); return; }
      ev = x.ev;
      if (ev.pocao) b.pocaoNaFila = false;
      b.jogador.hp = x.jh; b.jogador.hpMax = x.jm; b.monstro.hp = x.mh; b.jogador.poder = x.po; b.pocoes = x.pc;
      b.monstro.atordoado = x.at;
      if (b.lutador) { b.lutador.turno = x.tu; if (x.pr) b.lutador.pronto = x.pr; }
      if (b.replay.i >= b.replay.eventos.length && b.replay.res) b.fim = b.replay.res.resultado || 'fuga';
    } else {
      if (estado.cacada && R.precisaPocao(b, prefsCacada().pocao)) R.beberPocao(b);
      ev = R.passo(b);
    }
    var nomeJ = esc(b.jogador.nome), nomeM = b.monstro.nome;
    if (ev.queimou) linha('habilidade-usada', '🔥 ' + nomeM + ' queima e perde <strong>' + ev.queimou + '</strong>.');
    if (ev.queimou && b.fim) { /* morreu queimado: só a linha acima */ } else if (ev.pocao) {
      linha('cura', ICONE_POCAO + ' ' + nomeJ + ' bebe uma poção e recupera <strong>' + ev.cura + '</strong> de vida.');
    } else if (ev.dot) {
      linha('habilidade-usada', '☠️ ' + esc(ev.habilidade) + ': ' + nomeM + ' perde <strong>' + ev.dano + '</strong> de vida.');
    } else if (ev.habilidade) {
      if (!ev.acerto) linha('errou', '⚡ ' + ev.habilidade.toUpperCase() + '! Mas ' + nomeJ + ' erra o golpe.');
      else {
        var golpes = ev.golpes.length > 1 ? ' em ' + ev.golpes.filter(function (g) { return g.acerto; }).length + ' golpes' : '';
        linha('habilidade-usada', '⚡ ' + ev.habilidade.toUpperCase() + '! ' + nomeJ + ' causa <strong>' + ev.dano + '</strong> de dano' + golpes
          + (ev.critico ? ' (com crítico!)' : '') + '.');
        if (ev.atordoou) linha('destaque', nomeM + (ev.congelou ? ' está congelado!' : ' está atordoado!'));
        if (ev.quebrouArmadura) linha('destaque', 'A armadura de ' + nomeM + ' rachou! Ele recebe +25% de dano.');
        golpe('lutador-monstro', true);
      }
    } else if (ev.cego) {
      linha('errou', '🌫️ ' + nomeM + ' está com pó nos olhos e erra.');
    } else if (ev.atordoado) {
      linha('errou', nomeM + ' está atordoado e perde a vez.');
    } else if (ev.sombra) {
      linha('errou', nomeM + ' ataca, mas ' + nomeJ + ' está nas sombras e o golpe passa direto.');
    } else if (ev.ator === 'jogador') {
      if (ev.reforco) linha('habilidade-usada', '✨ ' + ev.reforco.toUpperCase() + '! ' + nomeJ + ' usa ' + ev.reforco + '.');
      if (!ev.acerto) linha('errou', nomeJ + ' erra o ' + (ev.magico ? 'feitiço' : 'golpe') + '.');
      else {
        linha(ev.critico ? 'critico' : '', (ev.critico ? 'CRÍTICO! ' : '') + nomeJ + (ev.magico ? ' lança um feitiço' : ' ataca')
          + ' e causa <strong>' + ev.dano + '</strong> de dano.');
        golpe('lutador-monstro');
      }
    } else {
      if (!ev.acerto) linha('errou', nomeM + ' ataca, mas ' + nomeJ + ' se esquiva.');
      else {
        linha('dano-recebido', nomeM + ' ataca e causa <strong>' + ev.dano + '</strong> de dano.');
        if (ev.bolso) linha('cura', '🧪 Bolso de Poções! ' + nomeJ + ' bebe um gole e recupera vida.');
        if (ev.milagre) linha('cura', '✨ Milagre! ' + nomeJ + ' volta à luta.');
        golpe('lutador-jogador');
      }
    }
    document.getElementById('hp-jogador').innerHTML = barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax, 'jogador');
    document.getElementById('hp-monstro').innerHTML = barra('hp', b.monstro.hp, b.monstro.hpMax, b.monstro.hp + ' / ' + b.monstro.hpMax, 'monstro');
    document.getElementById('ficha-hp').innerHTML = barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax, 'ficha');
    document.getElementById('ficha-pocoes').textContent = b.pocoes + '/' + R.maxPocoes(estado.personagem);
    if (D.HABILIDADES_ATIVAS) document.getElementById('poder-jogador').innerHTML = barraPoder(b);
    document.getElementById('controle-habilidade').innerHTML = controleHabilidade(b);
    var reg = document.getElementById('registro');
    reg.insertAdjacentHTML('beforeend', estado.registro.slice(linhasAntes).join(''));
    reg.scrollTop = reg.scrollHeight;

    if (b.mundial && (ev.ator === 'jogador' || ev.habilidade) && ++b.mundial.acoes >= D.CHEFE_MUNDIAL.acoesPorAtaque && !b.fim) {
      b.fim = 'tempo';
      linha('destaque', 'Ignaroth ruge e afasta ' + nomeJ + ' com uma onda de chamas! Fim do ataque.');
      reg.insertAdjacentHTML('beforeend', estado.registro.slice(-1).join(''));
    }
    if (b.fim) setTimeout(function () { encerrar(); }, 500);
    else if (b.replay && b.replay.etapas && b.replay.i >= b.replay.eventos.length) setTimeout(fimNoServidor, 500);
    else agendar();
  }

  function encerrar() {
    var b = estado.batalha;
    if (!b) return;
    clearTimeout(estado.timer);
    if (b.mundial) { encerrarMundial(b); return; }
    var primeiraVez, res;
    if (b.replay) {   // o servidor já aplicou tudo (prêmios, missões, história): só conta para a missão do clã
      res = b.replay.res;
      primeiraVez = b.replay.extras && b.replay.extras.primeiraVez;
      if (res.resultado === 'vitoria') missaoCla('monstros', 1);
      if (b.replay.extras && b.replay.extras.historia) avisoHistoria();
    } else {
    primeiraVez = !(estado.personagem.abates[b.monstroId] || 0);
    res = R.concluirBatalha(estado.personagem, b, C.agora(), bonusAlianca());
    if (res.resultado === 'vitoria') {
      R.registrarMissao(estado.personagem, 'abate', 1, C.agora());
      missaoCla('monstros', 1);
      if (D.monstros[b.monstroId].chefe) R.registrarMissao(estado.personagem, 'chefe', 1, C.agora());
      if (R.registrarHistoria(estado.personagem, 'abate', b.monstroId)) avisoHistoria();
      R.registrarGuia(estado.personagem, 'abate');
    }
    }
    if (estado.cacada) {
      if (res.resultado === 'vitoria') linha('destaque', 'Vitória! +' + res.exp + ' de exp e +' + res.ouro + ' de ouro' + (res.vitalidade ? ' (Vitalidade x2)' : '') + '.' + (res.estamina ? ' −' + res.estamina + ' de estamina.' : '')
        + (res.material ? ' ⛏ +' + res.material.qtd + ' ' + esc(D.CRAFT.materiais[res.material.id].nome) + '.' : ''));
      if (res.material && estado.cacada) estado.cacada.materiais = (estado.cacada.materiais || 0) + res.material.qtd;
      if (res.resultado === 'vitoria') { /* já escreveu acima */ } else if (res.resultado === 'derrota') linha('dano-recebido', esc(estado.personagem.nome) + ' caiu em batalha.' + (res.expPerdida ? ' −' + res.expPerdida + ' de exp.' : '') + (res.estamina ? ' −' + res.estamina + ' de estamina.' : ''));
      else linha('errou', esc(estado.personagem.nome) + ' fugiu.');
      fimLutaCacada(res, b, primeiraVez);
      return;
    }
    var nivelHab = R.nivelHabilidade(estado.personagem);
    if (D.HABILIDADES_ATIVAS && nivelHab > b.nivelHab) res.habilidadeEvoluiu = nivelHab;
    res.monstroId = b.monstroId;
    res.escolhido = estado.escolhido;
    if (res.resultado === 'vitoria') {
      linha('destaque', 'Vitória! +' + res.exp + ' de exp' + (res.fatorExp < 100 ? ' (exp e ouro reduzidos, sem drops: área abaixo do seu nível)' : '') + '.');
      if (res.niveis) linha('destaque', 'Level up! Agora você é level ' + estado.personagem.nivel + '.');
      if (res.habilidadeEvoluiu) linha('habilidade-usada', '⚡ Sua habilidade evoluiu para o nível ' + res.habilidadeEvoluiu + '!');
      if (res.drop) linha('destaque', 'Drop: ' + R.nomeItem(res.drop) + ' (' + nomeRaridadeItem(res.drop) + ')!');
      if (res.dropArmadura) linha('destaque', 'Drop: ' + R.nomeItem(res.dropArmadura) + ' (' + nomeRaridadeItem(res.dropArmadura) + ')!');
      if (res.mochilaCheia) linha('dano-recebido', 'Mochila cheia! Um item se perdeu.');
      if (res.pergaminho) linha('destaque', 'Drop: ' + (res.qtdPergaminhos > 1 ? res.qtdPergaminhos + ' Pergaminhos' : 'Pergaminho') + ' para item ' + ITEM_RARIDADE[res.pergaminho] + '!');
      if (res.material) linha('destaque', '⛏ Material: ' + res.material.qtd + ' ' + esc(D.CRAFT.materiais[res.material.id].nome) + ' (Oficina).');
    } else if (res.resultado === 'derrota') {
      linha('dano-recebido', esc(estado.personagem.nome) + ' caiu em batalha' + (res.expPerdida ? ' e perdeu ' + res.expPerdida + ' de exp' : '') + '.');
    } else {
      linha('errou', esc(estado.personagem.nome) + ' fugiu.');
    }
    estado.ultimaBatalha = b;
    estado.batalha = null;
    estado.resultado = res;
    salvar();
    telaJogo();
    if (res.resultado === 'vitoria') {
      avisar('Vitória! +' + res.exp + ' de exp', 'vitoria');
      if (res.niveis) avisar('Level up! Level ' + estado.personagem.nivel, 'nivel');
      var proximo = primeiraVez && Object.keys(D.monstros).filter(function (k) { return R.monstroAnterior(k) === b.monstroId; })[0];
      if (proximo) avisar('Nova caçada liberada: ' + D.monstros[proximo].nome + '!', 'nivel');
      [res.drop, res.dropArmadura].forEach(function (it) { if (it) avisarItem(it); });
      if (res.pergaminho) avisar('Pergaminho ' + ITEM_RARIDADE[res.pergaminho] + '!', 'item raridade-' + res.pergaminho);
    } else if (res.resultado === 'derrota') avisar('Derrota…', 'ruim');
  }

  // ---------------- Caçada contínua ----------------
  // Ciclo: procurando → encontrou (Lutar/Fugir; luta sozinho em 3 s, chefe sempre pergunta) → luta (o mesmo combate
  // de sempre) → resultado entra no resumo → procura de novo. Para com a vida em ≤5% ou quando o jogador para.
  function prefsCacada() {
    var p = estado.personagem;
    return p.prefsCacada || (p.prefsCacada = { lutarSempre: false, pocao: 0, chefe: 'perguntar' });
  }
  function iniciarCacada(areaId, soEstes) {
    if (bloqueadoMinerando('caçar')) return;
    var p = estado.personagem, area = D.areas.find(function (a) { return a.id === areaId; });
    var alvos = soEstes ? soEstes.slice() : area ? selecaoArea(area).slice() : [];
    if (!alvos.length) { avisar('Escolha pelo menos um monstro.'); return; }
    if (R.atualizarTempo(p, C.agora())) salvar();
    if (p.acampado) { R.acampar(p, C.agora(), false); salvar(); avisar('Acampamento levantado. Boa caçada!'); }   // caçar levanta o acampamento sozinho
    if (!R.estaminaParaCacar(p, alvos)) { avisar('Sem estamina: acampe, espere encher ou use um pote de estamina (Mercado).'); return; }
    pararTimersCacada();
    estado.resultado = null;
    estado.ultimaBatalha = null;
    estado.cacada = { area: areaId, alvos: alvos, ativa: true, fase: 'buscando', inicio: Date.now(), mortos: 0, exp: 0, ouro: 0,
      itens: [], historico: [], encontro: null, motivo: '', timer: null, relogio: null };
    estado.cacada.relogio = setInterval(tiqueCacada, 250);
    procurarMonstro();
    mostrarPainel();
  }
  function pararTimersCacada() {
    var c = estado.cacada;
    if (!c) return;
    clearTimeout(c.timer);
    clearInterval(c.relogio);
  }
  // Relógio da tela: tempo de caçada e contagem do encontro (sem redesenhar tudo).
  function tiqueCacada() {
    var c = estado.cacada;
    if (!c) return;
    var t = document.getElementById('cacada-tempo');
    if (t) t.textContent = duracaoTexto(Date.now() - c.inicio);
    var k = document.getElementById('cacada-contagem');
    if (k && c.prazo) k.textContent = Math.max(0, Math.ceil((c.prazo - Date.now()) / 1000));
  }
  function duracaoTexto(ms) {
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return (h ? h + 'h ' : '') + (h || m ? m + 'min ' : '') + (s % 60) + 's';
  }
  function procurarMonstro() {
    var c = estado.cacada, p = estado.personagem;
    if (!c || !c.ativa) return;
    if (R.atualizarTempo(p, C.agora())) salvar();
    if (!R.estaminaParaCacar(p, c.alvos)) { pararCacada('Sem estamina: acampe, espere encher ou use um pote de estamina (Mercado).'); return; }
    c.fase = 'buscando';
    c.encontro = null;
    c.prazo = null;
    if (CACA_SERVIDOR) { procurarNoServidor(); return; }
    // O monstro é sorteado já no começo: o mais forte demora mais para ser achado.
    c.proximo = R.escolherMonstroCacada(p, c.alvos.filter(function (id) { return R.custoEstamina(id) <= R.estamina(p).pts; }));
    if (!c.proximo) { pararCacada('Nenhum dos monstros escolhidos pode ser caçado agora.'); return; }
    c.busca = Math.round(R.tempoBusca(p, c.proximo) / (estado.rapido ? 2 : 1));
    telaJogo();
    clearTimeout(c.timer);
    c.timer = setTimeout(encontrarMonstro, c.busca);
  }
  function encontrarMonstro() {
    var c = estado.cacada, p = estado.personagem;
    if (!c || !c.ativa) return;
    var chefe;
    if (CACA_SERVIDOR) {   // o monstro (e o chefe) foi sorteado pelo servidor
      if (!c.servEncontro) { procurarMonstro(); return; }
      c.encontro = { monstro: c.servEncontro.monstro, normal: c.servEncontro.normal, chefe: !!c.servEncontro.chefe };
      chefe = c.encontro.chefe;
    } else {
    var id = c.proximo && R.podeCacar(p, c.proximo) ? c.proximo : R.escolherMonstroCacada(p, c.alvos);
    if (!id) { pararCacada('Nenhum dos monstros escolhidos pode ser caçado agora.'); return; }
    var areaCh = D.areas[D.monstros[id].indiceArea];   // o chefe só aparece se a estamina paga a luta contra ele
    chefe = areaCh && R.custoEstamina(areaCh.chefe.id) <= R.estamina(p).pts ? R.sortearChefe(p, id) : null;
    c.encontro = { monstro: chefe || id, normal: id, chefe: !!chefe };
    }
    c.fase = 'encontrou';
    if (!chefe && prefsCacada().lutarSempre) { lutarCacada(); return; }
    // Chefe: o jogador escolhe nas opções se sempre pergunta, sempre foge ou sempre luta.
    if (chefe && prefsCacada().chefe === 'lutar') { lutarCacada(); return; }
    if (chefe && prefsCacada().chefe === 'fugir') { fugirEncontro(); return; }
    c.prazo = chefe ? null : Date.now() + D.CACADA.contagem * 1000;
    telaJogo();
    clearTimeout(c.timer);
    if (!chefe) c.timer = setTimeout(lutarCacada, D.CACADA.contagem * 1000);
  }
  function lutarCacada() {
    var c = estado.cacada, p = estado.personagem;
    if (!c || !c.ativa || !c.encontro) return;
    clearTimeout(c.timer);
    c.prazo = null;
    if (CACA_SERVIDOR) { lutarNoServidor(); return; }
    c.fase = 'lutando';
    estado.escolhido = c.encontro.normal;
    estado.batalha = R.iniciarBatalha(p, c.encontro.monstro);
    estado.registro = [];
    linha('destaque', esc(p.nome) + (c.encontro.chefe ? ' enfrenta ' : ' encontra ') + D.monstros[c.encontro.monstro].nome + '!');
    telaJogo();
    agendar();
  }
  function fugirEncontro() {
    var c = estado.cacada;
    if (!c || c.fase !== 'encontrou') return;
    clearTimeout(c.timer);
    if (CACA_SERVIDOR) {
      c.servEncontro = null;
      c.fase = 'buscando';
      C.cacada('fugir', { personagem: estado.personagem.id }).then(function (r) {
        adotarPersonagem(r.personagem);
        if (estado.cacada === c && c.ativa) procurarMonstro();
      }).catch(erroCacada);
    } else if (c.encontro.chefe && R.evitarChefe(estado.personagem, c.encontro.monstro)) salvar();   // evitou o chefe: a chance zera
    c.historico.unshift({ monstro: c.encontro.monstro, resultado: 'evitou' });
    c.historico = c.historico.slice(0, D.CACADA.historico);
    if (!CACA_SERVIDOR) procurarMonstro();
  }
  function pararCacada(motivo) {
    var c = estado.cacada;
    if (!c) return;
    c.ativa = false;
    clearTimeout(c.timer);
    c.prazo = null;
    c.motivo = motivo || 'Você parou a caçada.';
    if (estado.batalha && estado.batalha.replay && estado.batalha.replay.etapas && !estado.batalha.fim) {   // luta em etapas: termina e para
      linha('destaque', 'A caçada para quando esta luta acabar.');
      var regP = document.getElementById('registro');
      if (regP) { regP.insertAdjacentHTML('beforeend', estado.registro.slice(-1).join('')); regP.scrollTop = regP.scrollHeight; }
      var topoP = document.querySelector('[data-acao="cacada-parar"]');
      if (topoP) topoP.disabled = true;
      return;
    }
    if (estado.batalha) { encerrar(); return; }        // parar no meio da luta = fugir dela
    if (CACA_SERVIDOR && estado.personagem && estado.personagem.cacadaAuto) {   // desliga a caçada com o jogo fechado
      C.cacada('parar', { personagem: estado.personagem.id }).then(function (r) { adotarPersonagem(r.personagem); }).catch(function () {});
    }
    if (CACA_SERVIDOR) {
      if (c.fase === 'encontrou' && c.encontro && c.encontro.chefe) {   // parou com o chefe na frente: fugiu dele
        C.cacada('fugir', { personagem: estado.personagem.id }).then(function (r) { adotarPersonagem(r.personagem); }).catch(function () {});
      }
    } else if (c.fase === 'encontrou' && c.encontro && c.encontro.chefe && R.evitarChefe(estado.personagem, c.encontro.monstro)) salvar();   // parou com o chefe na frente
    c.fase = 'parada';
    clearInterval(c.relogio);
    telaJogo();
  }
  // Nome de um drop da caçada: equipável ou consumível (pergaminho, com a quantidade).
  function nomeDrop(it) {
    if (!it.consumivel) return R.nomeItem(it);
    return (it.qtd > 1 ? it.qtd + 'x ' : '') + R.nomeConsumivel(it);
  }
  function dropPergaminho(resultado) {
    return { tipo: 'pergaminho', classe: null, raridade: resultado.pergaminho, encanto: 0, qtd: resultado.qtdPergaminhos || 1, consumivel: true };
  }

  function detalhesDrop(it) {
    if (it.consumivel) return 'Quantidade: ' + (it.qtd || 1) + ' · Usado na Forja para encantar itens.';
    return [nomeRaridadeItem(it), descricaoItem(it)].concat(it.tipo === 'arma' ? extrasArma(it) : []).join(' · ');
  }

  // Drop da caçada. Pergaminho mostra só o texto; arma/armadura abre a ficha completa, igual à da mochila (só para ver),
  // com a seta verde quando é melhor que o equipado.
  var dropsCacada = {};
  function comDrop(p, it) {
    return p.inventario.some(function (x) { return x.id === it.id; }) ? p : Object.assign({}, p, { inventario: p.inventario.concat([it]) });
  }
  function dropMelhor(it) {
    var p = estado.personagem;
    try { return !!(p && it.id && R.itemMelhor(comDrop(p, it), it)); } catch (e) { return false; }
  }
  function dropHtml(it, icone) {
    if (!it.consumivel && it.id) {
      dropsCacada[it.id] = it;
      var seta = icone && dropMelhor(it) ? '<span class="seta-melhor" title="Melhor que o equipado">' + SETA_MELHOR + '</span>' : '';
      return '<span class="drop-cacada"><button type="button" data-acao="drop-ver" data-id="' + it.id + '" class="' + (icone ? 'icone-pequeno borda-' : 'drop-nome raridade-')
        + corItem(it) + (icone ? aura(it) : '') + '" aria-label="' + esc(nomeDrop(it)) + (dropMelhor(it) ? ' (melhor que o equipado)' : '') + '">'
        + (icone ? F.icone(it) + seta : esc(nomeDrop(it)) + (dropMelhor(it) ? ' <span class="mais" title="Melhor que o equipado">▲</span>' : '')) + '</button></span>';
    }
    return '<span class="drop-cacada"><button type="button" class="' + (icone ? 'icone-pequeno borda-' : 'drop-nome raridade-')
      + corItem(it) + '" aria-expanded="false" aria-label="' + esc(nomeDrop(it)) + '">'
      + (icone ? F.icone(it) : esc(nomeDrop(it)))
      + (icone && it.consumivel && it.qtd > 1 ? '<span class="qtd-consumivel">' + it.qtd + '</span>' : '') + '</button>'
      + '<span class="drop-ficha"><strong>' + esc(nomeDrop(it)) + '</strong><br>' + esc(detalhesDrop(it)) + '</span></span>';
  }

  // Chamado pelo encerrar(): soma no resumo e segue para o próximo monstro (ou para).
  function fimLutaCacada(res, b, primeiraVez) {
    var c = estado.cacada, p = estado.personagem;
    var itens = [res.drop, res.dropArmadura].filter(Boolean);
    // Pergaminho também é item: entra na lista de drops junto com os equipáveis (chefe pode dar vários de uma vez).
    if (res.pergaminho) itens.push(dropPergaminho(res));
    if (res.resultado === 'vitoria') { c.mortos++; c.exp += res.exp; c.ouro += res.ouro; c.itens = itens.concat(c.itens).slice(0, 30); }
    c.historico.unshift({ monstro: b.monstroId, resultado: res.resultado, exp: res.exp, ouro: res.ouro, itens: itens });
    c.historico = c.historico.slice(0, D.CACADA.historico);
    estado.ultimaBatalha = b;
    estado.batalha = null;
    if (!b.replay) salvar();   // a do servidor já foi gravada por ele
    if (res.niveis) avisar('Level up! Level ' + p.nivel, 'nivel');
    var proximo = res.resultado === 'vitoria' && primeiraVez && Object.keys(D.monstros).filter(function (k) { return R.monstroAnterior(k) === b.monstroId; })[0];
    if (proximo) avisar('Nova caçada liberada: ' + D.monstros[proximo].nome + '!', 'nivel');
    itens.forEach(function (it) { if (!it.consumivel) avisarItem(it); });   // pergaminho tem aviso próprio
    if (res.resultado === 'derrota') { pararCacada(esc(p.nome) + ' caiu em batalha: perdeu a estamina da luta' + (res.expPerdida ? ' e ' + res.expPerdida + ' de exp' : '') + '. A caçada parou.'); return; }
    if (!c.ativa) { c.fase = 'parada'; clearInterval(c.relogio); telaJogo(); return; }
    if (b.replay && b.replay.parou) { pararCacada(b.replay.parou); return; }
    c.fase = 'pausa';
    telaJogo();
    clearTimeout(c.timer);
    c.timer = setTimeout(procurarMonstro, estado.rapido ? 450 : 900);
  }
  // ---- Caçada decidida pelo servidor (plano anti-trapaça, etapa 1) ----
  // O servidor sorteia o monstro e o chefe, faz a luta inteira e aplica os prêmios; aqui só mostramos.
  // Um pedido por luta: a resposta da luta já traz o próximo monstro encontrado.
  var CACA_SERVIDOR = typeof C.cacada === 'function';
  var CACA_RESPONDEU = false;   // a função da caçada já respondeu nesta sessão
  function adotarPersonagem(novo) {
    var p = estado.personagem;
    if (!novo || novo === p || novo.id !== p.id) return;
    Object.keys(p).forEach(function (k) { delete p[k]; });
    Object.assign(p, novo);
  }
  function erroCacada(e) {
    var c = estado.cacada;
    if (e && e.conflito) return;   // o jogo já recarrega o personagem
    // A função ainda não foi enviada ao Supabase: enquanto isso, a caçada segue no jeito antigo. O navegador às vezes não
    // vê o 404 (a resposta vem sem CORS e o fetch falha como "sem conexão"); se a função nunca respondeu, vale o mesmo.
    if (e && (e.status === 404 || (!e.status && !CACA_RESPONDEU)) && CACA_SERVIDOR) {
      CACA_SERVIDOR = false;
      if (c && c.ativa) { c.lutando = false; c.servEncontro = c.servProximo = null; procurarMonstro(); }
      return;
    }
    if (c) { c.lutando = false; pararCacada((e && e.message) || 'Sem conexão com o servidor.'); }
  }
  // Espera o monstro aparecer: o tempo da busca, nunca antes do que o servidor marcou.
  function esperarEncontro(c, e, busca, diferenca) {
    c.servEncontro = e;
    var pronto = e.prontoEm - (diferenca || 0) + 150;   // no relógio do aparelho
    c.busca = Math.max(pronto - Date.now(), Math.round((busca || 0) / (estado.rapido ? 2 : 1)), 300);
    telaJogo();
    clearTimeout(c.timer);
    c.timer = setTimeout(encontrarMonstro, c.busca);
  }
  function procurarNoServidor() {
    var c = estado.cacada, p = estado.personagem;
    if (c.servProximo) { var e = c.servProximo; c.servProximo = null; esperarEncontro(c, e, c.servBusca, c.servDiferenca); return; }
    c.servEncontro = null;
    C.cacada('encontro', { personagem: p.id, alvos: c.alvos, auto: autoCacada() }).then(function (r) {
      CACA_RESPONDEU = true;
      adotarPersonagem(r.personagem);
      if (estado.cacada !== c || !c.ativa) return;
      if (r.erro) {
        if (r.espera) { clearTimeout(c.timer); c.timer = setTimeout(procurarMonstro, r.espera + 200); return; }
        pararCacada(r.erro); return;
      }
      esperarEncontro(c, r.encontro, r.busca, r.diferenca);
    }).catch(erroCacada);
  }
  function lutarNoServidor() {
    var c = estado.cacada, p = estado.personagem;
    if (c.lutando) return;
    c.lutando = true;
    var antes = JSON.parse(JSON.stringify(p));   // a luta é mostrada a partir do herói de antes dela
    var enc = c.encontro;
    C.cacada('lutar', { personagem: p.id, alvos: c.alvos, pocao: prefsCacada().pocao, etapas: true }).then(function (r) {
      CACA_RESPONDEU = true;
      c.lutando = false;
      adotarPersonagem(r.personagem);
      if (estado.cacada !== c) return;
      if (r.erro) {
        if (r.espera && c.ativa) { clearTimeout(c.timer); c.timer = setTimeout(lutarCacada, r.espera + 200); return; }
        pararCacada(r.erro); return;
      }
      c.servEncontro = null;
      c.servProximo = r.proximo || null;
      c.servBusca = r.busca;
      c.servDiferenca = r.diferenca;
      antes = R.normalizar(antes);
      var b = R.iniciarBatalha(antes, r.monstroId);
      // etapas: o servidor ainda não deu o prêmio (vem no fim, em fimNoServidor). Sem etapas: função antiga, já veio tudo.
      b.replay = { eventos: r.eventos || [], i: 0, res: r.etapas ? null : r.res, extras: r.extras || {}, parou: r.parou, antes: antes, etapas: !!r.etapas };
      c.fase = 'lutando';
      estado.escolhido = r.normal;
      estado.batalha = b;
      estado.registro = [];
      linha('destaque', esc(p.nome) + (enc && enc.chefe ? ' enfrenta ' : ' encontra ') + D.monstros[r.monstroId].nome + '!');
      if (!c.ativa && !b.replay.etapas) { encerrar(); return; }   // parou enquanto o servidor lutava: mostra só o resultado
      telaJogo();
      agendar();
    }).catch(erroCacada);
  }

  // ---- Caçada com o jogo fechado / no fundo (Henri, 11/11/2026) ----
  // Enquanto a caçada está ligada, o servidor guarda p.cacadaAuto. Com a aba escondida o jogo para de pedir lutas;
  // ao voltar (ou ao entrar no jogo de novo), `retomar` faz no servidor as lutas que caberiam no tempo fora.
  function autoCacada() {
    var pr = prefsCacada();
    return { chefe: pr.chefe, lutarSempre: !!pr.lutarSempre, pocao: pr.pocao || 0 };
  }
  function areaDoAlvo(id) { var m = D.monstros[id]; return m && D.areas[m.indiceArea] ? D.areas[m.indiceArea].id : null; }
  function cacadaParaFundo() {
    var c = estado.cacada;
    if (!CACA_SERVIDOR || !c || !c.ativa) return;
    c.fora = true;
    clearTimeout(c.timer);
    clearTimeout(estado.timer);
  }
  function retomarCacada() {
    var p = estado.personagem, velho = estado.cacada;
    if (!CACA_SERVIDOR || !p || estado.retomando) return;
    if (velho && !velho.fora) return;
    if (!velho && !p.cacadaAuto) return;
    var c = null;
    if (velho) {
      // Troca o objeto da caçada: respostas atrasadas da aba escondida não mexem mais na tela.
      clearTimeout(velho.timer); clearInterval(velho.relogio); clearTimeout(estado.timer);
      if (estado.batalha && estado.batalha.replay) { estado.batalha = null; }
      c = Object.assign({}, velho, { fora: false, timer: null, relogio: null, lutando: false, encontro: null,
        servEncontro: null, servProximo: null, prazo: null, fase: 'buscando' });
      estado.cacada = c;
      c.relogio = setInterval(tiqueCacada, 250);
      telaJogo();
    }
    estado.retomando = true;
    C.cacada('retomar', { personagem: p.id }).then(function (r) {
      estado.retomando = false;
      adotarPersonagem(r.personagem);
      var s = r.ausente || {};
      if (s.lutas || s.fugas) {
        avisar('⚔ Enquanto você esteve fora: ' + s.lutas + ' luta' + (s.lutas === 1 ? '' : 's') + ', ' + (s.vitorias || 0) + ' vitória' + (s.vitorias === 1 ? '' : 's')
          + ', +' + (s.exp || 0).toLocaleString('pt-BR') + ' de exp e +' + (s.ouro || 0).toLocaleString('pt-BR') + ' de ouro'
          + ((s.itens || []).length ? ', ' + s.itens.length + ' ' + (s.itens.length === 1 ? 'item' : 'itens') : '')
          + (s.niveis ? '. Level up! Level ' + estado.personagem.nivel : '') + '.', s.niveis ? 'nivel' : 'item');
      }
      if (!c && estado.personagem.cacadaAuto && !estado.cacada && !estado.lutaArena && !estado.luta) {   // entrou de novo: a caçada continua na tela
        var A = estado.personagem.cacadaAuto;
        iniciarCacada(areaDoAlvo(A.alvos[0]), A.alvos);
        c = estado.cacada;
      }
      if (c && (s.lutas || s.fugas)) {
        c.mortos += s.vitorias || 0; c.exp += s.exp || 0; c.ouro += s.ouro || 0;
        c.itens = (s.itens || []).concat(c.itens).slice(0, 30);
      }
      if (!c || estado.cacada !== c) { if (s.lutas) telaJogo(); return; }
      if (!estado.personagem.cacadaAuto) { pararCacada(s.parou || 'A caçada parou.'); return; }
      if (c.ativa && c.fase === 'buscando' && !c.timer) procurarMonstro();
      else telaJogo();
    }).catch(function (e) {
      estado.retomando = false;
      if (c && estado.cacada === c) erroCacada(e);
    });
  }

  // Luta em etapas: o jogador bebeu uma poção. A luta para na tela até o servidor refazê-la com a poção nesse turno.
  function beberNoServidor() {
    var b = estado.batalha, c = estado.cacada, p = estado.personagem;
    if (!b || !b.replay || !podeBeberPocao(b)) return;
    var turnoP = b.replay.i;
    b.pocaoPendente = true;
    clearTimeout(estado.timer);
    var ctl = document.getElementById('controle-habilidade');
    if (ctl) ctl.innerHTML = controleHabilidade(b);
    C.cacada('pocao', { personagem: p.id, turno: turnoP }).then(function (r) {
      if (estado.batalha !== b) return;
      b.pocaoPendente = false;
      if (r.erro) avisar(r.erro);
      else {
        adotarPersonagem(r.personagem);
        b.replay.eventos = b.replay.eventos.slice(0, turnoP).concat((r.eventos || []).slice(turnoP));
        b.pocaoNaFila = true;   // confirmada: o botão espera o herói beber (na próxima vez dele)
      }
      var ctl2 = document.getElementById('controle-habilidade');
      if (ctl2) ctl2.innerHTML = controleHabilidade(b);
      agendar();
    }).catch(function (e) {
      if (estado.batalha !== b) return;
      b.pocaoPendente = false;
      avisar((e && e.message) || 'Sem conexão com o servidor.');
      agendar();
    });
  }
  // Luta em etapas: a animação acabou. Agora o servidor aplica o resultado (exp, ouro, itens) e manda o próximo monstro.
  function fimNoServidor() {
    var b = estado.batalha, c = estado.cacada, p = estado.personagem;
    if (!b || !b.replay || b.replay.res || b.replay.pedindoFim) return;
    b.replay.pedindoFim = true;
    C.cacada('fim', { personagem: p.id, alvos: c && c.alvos, continuar: !!(c && c.ativa), auto: c && c.ativa ? autoCacada() : null }).then(function (r) {
      CACA_RESPONDEU = true;
      if (estado.batalha !== b) return;
      b.replay.pedindoFim = false;
      if (r.erro) {
        if (r.espera) { setTimeout(fimNoServidor, r.espera + 200); return; }
        adotarPersonagem(r.personagem);
        if (c) pararCacada(r.erro); return;
      }
      adotarPersonagem(r.personagem);
      b.replay.res = r.res;
      b.replay.extras = r.extras || {};
      b.replay.parou = r.parou;
      if (c) { c.servProximo = r.proximo || null; c.servBusca = r.busca; c.servDiferenca = r.diferenca; }
      b.fim = r.res.resultado || 'fuga';
      encerrar();
    }).catch(function (e) {
      if (estado.batalha !== b) return;
      b.replay.pedindoFim = false;
      erroCacada(e);
    });
  }

  function fecharCacada() {
    if (estado.cacada && estado.cacada.ativa) pararCacada();
    pararTimersCacada();
    estado.cacada = null;
    estado.ultimaBatalha = null;
    telaJogo();
  }

  var ICONE_ACAMPAMENTO = '<svg viewBox="0 0 48 48" width="1em" height="1em" style="display:block;margin:auto" aria-hidden="true" focusable="false">'
    + '<path d="M39 7a7 7 0 0 0 4 11 7 7 0 1 1-4-11Z" fill="#e7c484"/>'
    + '<path d="M5 38 22 13l20 25Z" fill="#442b20" stroke="#c69b63" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="m22 13 5 25H5Z" fill="#a76d44" stroke="#c69b63" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<path d="m17 38 5-13 5 13Z" fill="#221714"/>'
    + '<path d="M3 39h42" stroke="#c69b63" stroke-width="2" stroke-linecap="round"/>'
    + '</svg>';

  // Vitalidade: barra branca embaixo da experiência (exp e ouro x2 na caçada enquanto tiver pontos).
  function textoVitalidade(p) {
    var v = R.atualizarVitalidade(p, C.agora()), max = R.maxVitalidade(p), min = R.proximaVitalidade(p, C.agora());
    return 'Vitalidade ' + v.pts + ' / ' + max + ': cada vitória na caçada gasta 1 e dá exp e ouro em dobro. '
      + (min ? '+' + D.VITALIDADE.porHora + ' em ' + (min >= 60 ? '1 h' : min + ' min') + '. ' : '') + 'Enche à meia-noite.';
  }
  function vitalidadeHtml(p) {
    if (!D.VITALIDADE.ligada) return '';
    var v = R.atualizarVitalidade(p, C.agora()), max = R.maxVitalidade(p);
    return '<div class="suave dica" tabindex="0">Vitalidade <i class="dica-i">?</i><span class="dica-balao" role="tooltip"><strong>Vitalidade</strong><span>' + esc(textoVitalidade(p)) + '</span></span></div>'
      + barra('vitalidade', v.pts, max, v.pts + ' / ' + max + (v.pts ? ' · exp e ouro x2' : ''));
  }
  function vitFinaHtml(p) {
    if (!D.VITALIDADE.ligada) return '';
    var v = R.atualizarVitalidade(p, C.agora()), max = R.maxVitalidade(p), texto = textoVitalidade(p);
    return '<div class="vit-fina" role="progressbar" aria-label="' + esc(texto) + '" title="' + esc(texto) + '" aria-valuenow="' + v.pts
      + '" aria-valuemin="0" aria-valuemax="' + max + '"><i style="width:' + (v.pts / max * 100) + '%"></i></div>';
  }
  // Barrinha fina de experiência embaixo da vida, na caçada (só para ter uma noção de quanto falta para o level).
  function expFinaHtml(p) {
    var maximo = p.nivel >= D.NIVEL_MAXIMO, precisa = R.expNecessaria(p.nivel);
    var pct = maximo ? 100 : Math.max(0, Math.min(100, p.exp / precisa * 100));
    var texto = maximo ? 'Level máximo' : 'Experiência: ' + p.exp.toLocaleString('pt-BR') + ' / ' + precisa.toLocaleString('pt-BR') + ' (' + Math.floor(pct) + '%)';
    var numero = maximo ? 'Level máximo' : '✦ ' + p.exp.toLocaleString('pt-BR') + ' / ' + precisa.toLocaleString('pt-BR') + ' (' + Math.floor(pct) + '%)';
    return '<div class="exp-fina" id="exp-jogador" role="progressbar" aria-label="' + texto + '" title="' + texto + '" aria-valuenow="' + Math.floor(pct)
      + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i><b>' + numero + '</b></div>';
  }
  // Opções da caçada em botões de toque (antes eram listas que se fechavam sozinhas no celular a cada monstro achado).
  function opcoesCacadaHtml() {
    var pref = prefsCacada();
    function grupo(nome, campo, atual, opcoes) {
      return '<div class="cacada-opcao"><span>' + nome + '</span><div class="opcao-botoes" role="group" aria-label="' + nome + '">'
        + opcoes.map(function (o) {
          return '<button type="button" data-acao="cacada-opcao" data-campo="' + campo + '" data-valor="' + o[0] + '" aria-pressed="' + (String(atual) === String(o[0])) + '">' + o[1] + '</button>';
        }).join('') + '</div></div>';
    }
    return '<div class="cacada-opcoes"><label><input type="checkbox" data-acao="cacada-sempre"' + (pref.lutarSempre ? ' checked' : '') + '> Lutar sempre sem perguntar</label>'
      + grupo('Chefes', 'chefe', pref.chefe || 'perguntar', [['perguntar', 'Perguntar'], ['fugir', 'Fugir'], ['lutar', 'Lutar']])
      + grupo('Poção automática', 'pocao', pref.pocao || 0, [[0, 'Desligada']].concat(D.CACADA.pocaoAuto.map(function (v) { return [v, 'Abaixo de ' + v + '%']; })))
      + '</div>';
  }
  // Pegadas da caçada (no lugar da lupa): o herói caminhando até achar o monstro.
  var PEGADA = '<svg viewBox="0 0 24 48" focusable="false"><path d="M12 2C18 2 21 8 20.3 15c-.5 5-3 8.5-3.4 12.5H7.2C6.6 23 3.8 20 3.8 14 3.8 7 7 2 12 2Z" fill="currentColor"/>'
    + '<rect x="7" y="31" width="10.5" height="14" rx="5" fill="currentColor"/></svg>';
  var PASSOS_HTML = [0, 1, 2, 3, 4, 5].map(function (i) {
    return '<span class="passo ' + (i % 2 ? 'dir' : 'esq') + '" style="animation-delay:' + (i * 0.3).toFixed(1) + 's">' + PEGADA + '</span>';
  }).join('');
  function cacadaHtml() {
    var c = estado.cacada, p = estado.personagem, b = estado.batalha, s = R.status(p), pref = prefsCacada();
    var area = D.areas.find(function (a) { return a.id === c.area; }), e = estiloArea(area, D.areas.indexOf(area));
    var emLuta = c.fase === 'lutando' && b;
    var hpJ = emLuta ? b.jogador.hp : p.hpAtual, hpMaxJ = emLuta ? b.jogador.hpMax : s.hpMax;
    var jogador = '<div class="lutador" id="lutador-jogador"><div class="moldura">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</div><h3>' + esc(p.nome) + '</h3>'
      + '<div id="hp-jogador">' + barra('hp', hpJ, hpMaxJ, hpJ + ' / ' + hpMaxJ, 'jogador') + '</div>' + estaminaFinaHtml(p) + expFinaHtml(emLuta && b.replay && b.replay.antes || p) + vitFinaHtml(p)
      + (emLuta ? '<div id="controle-habilidade">' + controleHabilidade(b) + '</div>' : '') + '</div>';
    var direita;
    if (c.fase === 'buscando' || c.fase === 'pausa') {
      direita = '<div class="cacada-busca"><div class="busca-passos" aria-hidden="true">' + PASSOS_HTML + '</div><div class="busca-txt">' + (c.fase === 'pausa' ? 'Recuperando o fôlego…' : 'Caçada em andamento…') + '</div>'
        + '<div class="busca-barra"><i style="animation-duration:' + (c.fase === 'pausa' ? 900 : c.busca) + 'ms"></i></div>'
        + '</div>';
    } else if (c.fase === 'encontrou') {
      var m = D.monstros[c.encontro.monstro];
      direita = '<div class="lutador cacada-encontro' + (c.encontro.chefe ? ' chefe' : '') + '" id="lutador-monstro"><div class="moldura">' + F.imagemMonstro(c.encontro.monstro) + '</div>'
        + (c.encontro.chefe ? '<div class="selo-chefe">Chefe</div>' : '') + '<h3>' + m.nome + '</h3>'
        + '<div class="suave pequeno">Vida ' + m.hp.toLocaleString('pt-BR') + ' · Dano ' + dano(m.ataque) + '</div>'
        + '<div class="botoes"><button class="btn' + (c.encontro.chefe ? ' perigo' : '') + '" data-acao="cacada-lutar">⚔ Lutar</button>'
        + '<button class="btn secundario" data-acao="cacada-fugir">Fugir</button></div>'
        + (c.encontro.chefe ? '<p class="destaque pequeno">Um chefe! Você decide.</p>'
          : '<p class="suave pequeno">Luta sozinho em <strong id="cacada-contagem">' + D.CACADA.contagem + '</strong> s</p>') + '</div>';
    } else if (emLuta) {
      direita = '<div class="lutador" id="lutador-monstro"><div class="moldura">' + F.imagemMonstro(b.imagemId || b.monstroId) + '</div><h3>' + b.monstro.nome + '</h3>'
        + '<div id="hp-monstro">' + barra('hp', b.monstro.hp, b.monstro.hpMax, b.monstro.hp + ' / ' + b.monstro.hpMax, 'monstro') + '</div></div>';
    } else {
      direita = '<div class="cacada-busca parada"><div class="busca-icone">' + ICONE_ACAMPAMENTO + '</div><div class="busca-txt">Caçada encerrada</div><p class="suave">' + c.motivo + '</p>'
        + '<div class="botoes"><button class="btn" data-acao="cacada-continuar"' + (R.estaminaParaCacar(p, c.alvos) ? '' : ' disabled') + '>Continuar caçada</button>'
        + '<button class="btn secundario" data-acao="cacada-fechar">Voltar à região</button></div>'
        + (R.estaminaParaCacar(p, c.alvos) ? '' : '<p class="suave pequeno">Sem estamina para estes monstros. Acampe, espere ou use um pote de estamina (Mercado).</p>') + '</div>';
    }
    var ativa = c.ativa;
    var topo = '<div class="cacada-topo" style="--cor:' + e.cor + '"><div><h3>' + iconeArea(area) + ' Caçada · ' + area.nome + '</h3>'
      + '<span class="suave pequeno">' + c.alvos.map(function (id) { return D.monstros[id].nome; }).join(', ') + '</span></div>'
      + '<div class="botoes">' + (ativa ? '<button class="btn secundario btn-pequeno" data-acao="velocidade">' + (estado.rapido ? 'Velocidade 2x' : 'Velocidade normal') + '</button>'
        + '<button class="btn perigo btn-pequeno" data-acao="cacada-parar">■ Parar caçada</button>' : '') + '</div></div>';
    var opcoes = opcoesCacadaHtml();
    var resumo = '<div class="cacada-resumo">'
      + [['⚔', 'Derrotados', c.mortos], ['✦', 'Exp', c.exp.toLocaleString('pt-BR')], ['◎', 'Ouro', c.ouro.toLocaleString('pt-BR')], ['🎒', 'Itens', c.itens.reduce(function (t, it) { return t + (it.qtd || 1); }, 0)],
        ['⏱', 'Tempo', '<span id="cacada-tempo">' + duracaoTexto(Date.now() - c.inicio) + '</span>']].map(function (x) {
        return '<div class="cacada-num"><small>' + x[0] + ' ' + x[1] + '</small><strong>' + x[2] + '</strong></div>';
      }).join('') + '</div>';
    var itens = c.itens.length ? '<div class="cacada-itens">' + c.itens.map(function (it) {
      return dropHtml(it, true);
    }).join('') + '</div>' : '';
    var historico = '<div class="cacada-historico"><h4>Últimos combates</h4>' + (c.historico.length ? c.historico.map(function (h) {
      var nome = D.monstros[h.monstro].nome;
      if (h.resultado === 'vitoria') return '<p class="mais">✔ ' + nome + ' <span class="suave">+' + h.exp + ' exp · +' + h.ouro + ' ouro'
        + (h.itens.length ? ' · ' + h.itens.map(function (it) { return dropHtml(it, false); }).join(', ') : '') + '</span></p>';
      if (h.resultado === 'derrota') return '<p class="menos">✖ ' + nome + ' <span class="suave">derrota</span></p>';
      return '<p class="suave">↷ ' + nome + ' <span>' + (h.resultado === 'evitou' ? 'evitado' : 'fugiu') + '</span></p>';
    }).join('') : '<p class="suave pequeno">Nenhum combate ainda.</p>') + '</div>';
    var fundo = ESTILO_AREA[area.id] ? ' style="background-image:radial-gradient(ellipse at center, rgba(8,10,14,.25), rgba(8,10,14,.8)),url(assets/regioes/fundo-' + area.id + '.webp)"' : '';
    var zealot = interfaceAtual() === 'zealot';
    var detalhes = opcoes + itens + historico;
    if (zealot) {
      var aberto = document.getElementById('cacada-detalhes');
      detalhes = '<details class="cacada-detalhes" id="cacada-detalhes"' + (aberto && aberto.open ? ' open' : '')
        + '><summary>Opções, drops e histórico</summary>' + detalhes + '</details>';
    }
    return topo + '<div class="arena cacada-arena"' + fundo + '>' + jogador + '<div class="vs">' + (emLuta ? 'VS' : '') + '</div>' + direita + '</div>'
      + '<div class="registro" id="registro">' + estado.registro.join('') + '</div>'   // sempre aqui: a tela não pula quando a luta começa
      + (zealot ? resumo + detalhes : opcoes + resumo + itens + historico);
  }

  function iniciarHistoricoJogo() {
    var id = estado.personagem.id;
    var atual = history.state;
    if (atual && atual.eldrin === id && !atual.base) return;
    history.replaceState({ eldrin: id, base: true }, '');
    history.pushState({ eldrin: id, aba: estado.aba }, '');
  }

  function abrirAba(aba) {
    if (estado.personagem) R.registrarGuia(estado.personagem, 'aba', aba);
    var menu = document.getElementById('menu-jogo');
    if (menu) menu.open = false;
    estado.aba = aba;
    estado.vendaPendente = estado.encantoPendente = estado.ultimoEncanto = estado.itemFoco = estado.dropFoco = null;
    estado.zoom = estado.desafio = null;
    estado.vendaLote = null;
    if (aba !== 'social') estado.amigoAberto = estado.removerAmigo = null;
    if (aba === 'leilao') estado.leilao = null;   // sempre pega a fase do servidor ao abrir (nunca a guardada de antes)
    telaJogo();
    if (aba === 'social') carregarSocial();
    if (aba === 'masmorra') carregarGrupo();
    if (aba === 'arena') { carregarArena(); marcarAtaquesVistos(); }
    if (aba === 'alianca') carregarAlianca();
    if (aba === 'mundial') carregarBoss();
    if (aba === 'mercado') carregarMercado();
    if (aba === 'oficinas') carregarOficinas();
  }

  function podeVoltarAba() {
    return !estado.batalha && !estado.luta && !estado.lutaArena && !(estado.cacada && estado.cacada.ativa);
  }

  window.addEventListener('popstate', function (e) {
    if (!estado.personagem) return;
    var destino = e.state, id = estado.personagem.id;
    if (!destino || destino.eldrin !== id || destino.base || !podeVoltarAba()) {
      history.pushState({ eldrin: id, aba: estado.aba }, '');
      return;
    }
    if (grupoDaAba(destino.aba) || (destino.aba === 'admin' && ehAdmin())) {
      estado.cacada = estado.resultado = estado.chefeAviso = null;
      abrirAba(destino.aba);
    }
  });

  document.addEventListener('click', function (e) {
    var menu = document.getElementById('menu-jogo');
    if (menu && menu.open && !menu.contains(e.target)) menu.open = false;
  }, true);
  document.addEventListener('keydown', function (e) {
    var menu = document.getElementById('menu-jogo');
    if (e.key === 'Escape' && menu && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });

  var inicioGesto;
  app.addEventListener('touchstart', function (e) {
    inicioGesto = null;
    if (!estado.personagem || interfaceAtual() === 'zealot' || !podeVoltarAba() || e.touches.length !== 1
      || e.target.closest('input, textarea, select, .zoom-fundo')) return;
    inicioGesto = e.touches[0];
  }, { passive: true });
  app.addEventListener('touchcancel', function () { inicioGesto = null; });
  app.addEventListener('touchend', function (e) {
    if (!inicioGesto || !estado.personagem || !podeVoltarAba()) { inicioGesto = null; return; }
    var fim = e.changedTouches[0], dx = fim.clientX - inicioGesto.clientX, dy = fim.clientY - inicioGesto.clientY;
    inicioGesto = null;
    if (dx > 65 && dx > 2 * Math.abs(dy) && history.state && history.state.eldrin === estado.personagem.id) history.back();
  }, { passive: true });

  app.addEventListener('click', function (e) {
    var alvo = e.target.closest('.drop-cacada > button');
    app.querySelectorAll('.drop-cacada > button[aria-expanded="true"]').forEach(function (botao) {
      if (botao !== alvo) botao.setAttribute('aria-expanded', 'false');
    });
    if (alvo) alvo.setAttribute('aria-expanded', alvo.getAttribute('aria-expanded') !== 'true');
  });

  // ---------------- Eventos ----------------

  app.addEventListener('submit', async function (e) {
    e.preventDefault();
    var form = e.target;
    if (form.dataset.form === 'amigo') {
      var nome = form.nome.value.trim();
      var erroAmigo = form.querySelector('.erro');
      if (!nome || !estado.personagem) return;
      if (nome.toLowerCase() === estado.personagem.nome.toLowerCase()) { erroAmigo.textContent = 'Esse é você.'; return; }
      try {
        var r = await C.amigos.pedir(estado.personagem.id, nome);
        avisar(r === 'aceita' ? 'Agora você e ' + nome + ' são amigos!' : 'Pedido enviado para ' + nome + '.');
        estado.social = null;
        carregarSocial();
      } catch (err) { erroAmigo.textContent = err.message; }
      return;
    }
    var dados = Object.fromEntries(new FormData(form));
    var botao = form.querySelector('button[type=submit]');
    botao.disabled = true;
    try {
      if (form.dataset.form === 'cadastro') {
        await C.registrar(dados);
        telaAuth('entrar');
        avisar('Conta criada! Agora entre com seu usuário e senha.');
      } else if (form.dataset.form === 'esqueci') {
        if (!dados.usuario.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) throw new Error('Preencha o usuário e um e-mail válido.');
        await C.senha.pedir(dados.usuario.trim(), dados.email.trim());
        telaAuth('entrar');
        avisar('Pedido enviado! Se o usuário e o e-mail conferirem, você vai receber uma senha temporária nesse e-mail.');
      } else if (form.dataset.form === 'trocar-senha') {
        if (dados.senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
        if (dados.senha !== dados.confirmar) throw new Error('As senhas não conferem.');
        await C.senha.trocar(dados.senha);
        estado.conta.trocar_senha = false;
        telaPersonagens();
        avisar('Senha trocada!');
      } else {
        estado.conta = await C.entrar(dados.usuario, dados.senha);
        depoisDeEntrar();
      }
    } catch (err) {
      form.querySelector('.erro').textContent = err.message;
      botao.disabled = false;
    }
  });

  app.addEventListener('change', function (e) {
    if (e.target.id === 'mercado-ordem') { var fo = filtroMercado(); fo.ordem = e.target.value; fo.pagina = 0; carregarMercado(); }
    if (e.target.dataset && e.target.dataset.contratar && estado.contratar) {
      estado.contratar[e.target.dataset.contratar] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (e.target.dataset.contratar !== 'nome') telaJogo();
    }
    if (e.target.dataset && e.target.dataset.forja) { estado.forja = estado.forja || {}; estado.forja[e.target.dataset.forja] = e.target.value; telaJogo(); }
    if (e.target.id === 'ordem-mochila') {
      visaoMochila().ordem = e.target.value;
      var dir = document.querySelector('[data-acao="mochila-direcao"]');
      if (dir) dir.disabled = e.target.value === 'mochila';
      aplicarVisaoMochila();
    }
  });

  app.addEventListener('input', function (e) {
    // Cadastro: o nome de usuário só aceita letras, números e _ (espaço, ponto e acento nem entram no campo).
    if (e.target.hasAttribute && e.target.hasAttribute('data-so-usuario')) {
      var limpo = e.target.value.replace(/[^A-Za-z0-9_]/g, '');
      if (limpo !== e.target.value) {
        var pos = Math.max(0, (e.target.selectionStart || 0) - (e.target.value.length - limpo.length));
        e.target.value = limpo;
        try { e.target.setSelectionRange(pos, pos); } catch (err) { /* campo sem cursor */ }
      }
    }
    if (e.target.classList.contains('venda-preco') && estado.mercado && estado.mercado.cfg) {
      var vp = Math.floor(Number(e.target.value)), alvo = document.getElementById(e.target.id.replace('venda-preco-', 'venda-recebe-'));
      if (alvo) alvo.textContent = vp >= 1 ? 'Você recebe ' + ouroTxt(Math.floor(vp * (100 - estado.mercado.cfg.taxa) / 100)) : '';
    }
    if (e.target.id === 'nome-personagem' && estado.criacao) estado.criacao.nome = e.target.value;
    if (e.target.id === 'forca-min') { visaoMochila().forcaMin = Number(e.target.value) || 0; aplicarVisaoMochila(); }
    if (e.target.id === 'confirmar-exclusao') {
      var certo = e.target.value.trim().toLowerCase() === e.target.dataset.nome.toLowerCase();
      document.querySelector('[data-acao="excluir-confirmar"]').disabled = !certo;
    }
  });

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-acao]');
    if (!el) return;
    var p = estado.personagem;
    if (el.dataset.acao.indexOf('al-') === 0 && cliqueAlianca(el.dataset.acao, el)) return;
    if (el.dataset.acao.indexOf('of-') === 0 && cliqueOficinas(el.dataset.acao, el)) return;
    switch (el.dataset.acao) {
      case 'auth': telaAuth(el.dataset.modo); break;
      case 'trocar-senha': telaTrocarSenha(false); break;
      case 'fila-entrar':
        if (estado.cacada && estado.cacada.ativa) { avisar('Pare a caçada antes de entrar na fila da masmorra.'); break; }
        if (estado.lutaArena) { avisar('Termine a luta na Arena antes de entrar na fila da masmorra.'); break; }
        if (R.minerando(p, C.agora())) { avisar('⛏ Pare a mineração (Aventura › Mineração) antes de entrar na fila da masmorra.'); break; }
        acaoGrupo(function () { return C.grupo.filaEntrar(p.id, el.dataset.valor); }, 'Você entrou na fila de ' + R.masmorra(el.dataset.valor).nome + '.');
        break;
      case 'fila-sair':
        acaoGrupo(function () { return C.grupo.filaSair(p.id); }, 'Você saiu da fila.');
        break;
      case 'senha-pedidos':
        C.senha.adminPedidos().then(function (l) { estado.adminSenhas = l; telaJogo(); }, function (e2) { avisar(e2.message); });
        break;
      case 'senha-gerar': {
        var pedidoId = Number(el.dataset.id);
        if (!window.confirm('Gerar uma senha temporária para ' + el.dataset.usuario + '? A senha atual dele deixa de funcionar.')) break;
        C.senha.adminGerar(pedidoId).then(function (r) {
          estado.adminSenhaGerada = r;
          return C.senha.adminPedidos().then(function (l) { estado.adminSenhas = l; telaJogo(); });
        }, function (e2) { avisar(e2.message); });
        break;
      }
      case 'senha-recusar':
        if (!window.confirm('Recusar o pedido de ' + el.dataset.usuario + '?')) break;
        C.senha.adminRecusar(Number(el.dataset.id)).then(function () { return C.senha.adminPedidos(); })
          .then(function (l) { estado.adminSenhas = l; telaJogo(); }, function (e2) { avisar(e2.message); });
        break;
      case 'senha-gerada-fechar': estado.adminSenhaGerada = null; telaJogo(); break;
      case 'casca-chat':   // casca do celular: o chat abre pelo ícone do topo
        fecharMenuJogo(); chat.aberto = true; chat.naoLidas = 0; desenharChat();
        break;
      case 'casca-missoes':
        fecharMenuJogo(); missoesUI.aberto = !missoesUI.aberto; desenharMissoes(true);
        break;
      case 'menu-interface':
        if (document.getElementById('menu-jogo')) document.getElementById('menu-jogo').open = false;
        alternarPainel(musica.painel && musica.painelTipo === 'interface', 'interface');
        break;
      case 'menu-som':
        document.getElementById('menu-jogo').open = false;
        tocarMusica();
        alternarPainel();
        break;
      case 'sair':
        sairDaConta();
        break;
      case 'voltar-personagens':
        // Caçando: só para os relógios desta tela; no servidor a caçada continua (farm AFK) e volta ao entrar de novo.
        clearTimeout(estado.timer);
        if (estado.cacada) { pararTimersCacada(); estado.cacada = null; estado.batalha = null; }
        encerrarAtividade();
        estado.conta = C.contaAtual();
        estado.personagem = null;
        guardarJogo();
        estado.resultado = null;
        telaPersonagens();
        break;
      case 'excluir-pedir':
        estado.excluir = el.dataset.id;
        telaPersonagens();
        document.getElementById('confirmar-exclusao').focus();
        break;
      case 'excluir-cancelar':
        estado.excluir = null;
        telaPersonagens();
        break;
      case 'excluir-confirmar': {
        var campo = document.getElementById('confirmar-exclusao');
        if (campo.value.trim().toLowerCase() !== campo.dataset.nome.toLowerCase()) break;
        el.disabled = true;
        var nomeExcluido = campo.dataset.nome;
        C.excluirPersonagem(el.dataset.id).then(function () {
          estado.excluir = null;
          estado.conta = C.contaAtual();
          telaPersonagens();
          avisar('O personagem ' + nomeExcluido + ' foi excluído.');
        }, function (erro) {
          document.getElementById('erro-exclusao').textContent = 'Não foi possível excluir: ' + erro.message;
          el.disabled = false;
        });
        break;
      }
      case 'nova-criacao':
        estado.criacao = { nome: '', sexo: 'masculino', raca: 'humano', classe: 'cavaleiro' };
        telaCriacao();
        break;
      case 'escolher-raca':
        estado.criacao.raca = el.dataset.valor;
        if (D.racas[estado.criacao.raca].classes.indexOf(estado.criacao.classe) < 0) {
          estado.criacao.classe = D.racas[estado.criacao.raca].classes[0];
        }
        telaCriacao();
        break;
      case 'escolher-sexo':
        estado.criacao.sexo = el.dataset.valor;
        telaCriacao();
        break;
      case 'escolher-classe':
        estado.criacao.classe = el.dataset.valor;
        telaCriacao();
        break;
      case 'criar-personagem': criarPersonagem(); break;
      case 'jogar': abrirJogo(el.dataset.id); break;
      case 'login-fechar': estado.loginAberto = false; estado.loginResultado = null; telaJogo(); break;
      case 'login-pegar': {
        var rl = R.pegarLogin(estado.personagem, C.agora());
        if (!rl) break;
        if (rl.erro) { avisar(rl.erro); break; }
        estado.loginResultado = rl;
        salvar(); atualizarFicha(); desenharMissoes();
        rl.itens.forEach(avisarItem);
        avisar('🎁 Prêmio de login: ' + rl.partes.map(function (x) { return x.texto; }).join(' + '), 'item');
        telaJogo();
        break;
      }
      case 'aba': abrirAba(el.dataset.aba); break;
      case 'personagem-vista':
        estado.vistaPersonagem = el.dataset.valor;
        telaJogo();
        app.querySelector('.personagem-vistas [aria-pressed="true"]').focus();
        break;
      case 'item': {
        // Um clique abre a ficha (equipar só pelo botão da ficha: dois cliques e o botão direito não equipam mais).
        var alvoId = el.dataset.id;
        estado.vendaPendente = null;
        estado.consumivelFoco = null;
        estado.dropFoco = null;
        if (estado.compararCom && estado.compararCom !== alvoId) {   // segundo item da comparação
          estado.comparando = [estado.compararCom, alvoId];
          estado.compararCom = null;
          estado.itemFoco = alvoId;
          estado.fichaHover = false;
          desenharFlutuante(el);
          break;
        }
        if (estado.fichaHover && estado.itemFoco === alvoId) { fixarFichaHover(); desenharFlutuante(el); break; }   // vinha do mouse por cima: fixa (e abre a comparação)
        if (estado.itemFoco === alvoId && document.getElementById('ficha-flutuante')) { fecharFlutuante(); break; }
        estado.comparando = null;
        estado.itemFoco = alvoId;
        estado.fichaHover = false;
        desenharFlutuante(el);
        break;
      }
      case 'item-comparar':   // "Comparar com outro": o próximo item tocado abre lado a lado
        fecharFlutuante();
        estado.compararCom = el.dataset.id;
        avisar('Agora toque no outro item para comparar os dois lado a lado.');
        break;
      case 'drop-ver': {
        var dropId = el.dataset.id;
        if (estado.dropFoco === dropId && document.getElementById('ficha-flutuante')) { fecharFlutuante(); break; }
        estado.itemFoco = estado.consumivelFoco = null;
        estado.dropFoco = dropId;
        desenharFlutuante(el);
        break;
      }
      case 'zoom-fechar':
        if (el.classList.contains('zoom-fundo') && e.target !== el) break;   // clique dentro da janela
        estado.zoom = null;
        estado.vendaPendente = null;
        telaJogo();
        break;
      case 'desequipar':
        if (R.desequipar(p, el.dataset.slot)) { estado.zoom = null; salvar(); telaJogo(); }
        else avisar('Mochila cheia! Venda algo antes de desequipar.');
        break;
      case 'trocar-pergaminho': {
        var troca = R.trocarPergaminho(p, el.dataset.raridade);
        if (troca.erro) { avisar(troca.erro); break; }
        salvar();
        avisar('Troca feita! +1 Pergaminho para item ' + ITEM_RARIDADE[troca.para] + '.', 'item');
        telaJogo();
        break;
      }
      case 'skin-comprar': {
        var r = R.comprarSkin(p, el.dataset.valor);
        if (r !== true) { avisar(r); break; }
        salvar();
        avisar('Skin comprada e em uso no seu D20!');
        telaJogo();
        break;
      }
      case 'skin-usar':
        if (R.usarSkin(p, el.dataset.valor)) { salvar(); telaJogo(); }
        break;
      case 'arena-ver':
        estado.arenaVer = el.dataset.valor;
        estado.arena = null;
        telaJogo();
        break;
      case 'arena-desafiar':
        abrirDesafio(el.dataset.id, 'escada');
        break;
      case 'ranking-atacar':
        abrirDesafio(el.dataset.id, 'livre');
        break;
      case 'desafio-confirmar': {
        var alvoDesafio = estado.desafio && estado.desafio.id, livre = estado.desafio && estado.desafio.tipo === 'livre';
        if (!alvoDesafio) break;
        if (bloqueadoMinerando('lutar na Arena')) { estado.desafio = null; telaJogo(); break; }
        estado.desafio = null;
        if (livre) estado.aba = 'arena';   // a luta e o resultado aparecem na Arena
        telaJogo();
        comecarLutaArena(function () { return livre ? C.arena.atacar(p.id, alvoDesafio) : C.arena.desafiar(p.id, alvoDesafio); });
        break;
      }
      case 'desafio-cancelar':
        if (el.classList.contains('zoom-fundo') && e.target !== el) break;   // clique dentro da janela
        estado.desafio = null;
        telaJogo();
        break;
      case 'arena-revanche':
        if (bloqueadoMinerando('lutar na Arena')) break;
        comecarLutaArena(function () { return C.arena.revanche(p.id, Number(el.dataset.luta)); }, el);
        break;
      case 'marcar': {
        var lote = estado.vendaLote, alvo = p.inventario.find(function (i) { return i.id === el.dataset.id; });
        if (!lote || !alvo) break;
        if (!R.podeVender(p, alvo)) { avisar('Item travado: destrave para vender.'); break; }
        if (lote.ids[alvo.id]) delete lote.ids[alvo.id]; else lote.ids[alvo.id] = true;
        lote.confirmar = false;
        el.classList.toggle('marcado', !!lote.ids[alvo.id]);
        atualizarTotalLote();
        break;
      }
      case 'mochila-direcao':
        visaoMochila().crescente = !visaoMochila().crescente;
        el.textContent = visaoMochila().crescente ? '↑ Crescente' : '↓ Decrescente';
        aplicarVisaoMochila();
        break;
      case 'leilao-lance': darLance(el.dataset.id); break;
      case 'mercado-categoria': filtroMercado().categoria = el.dataset.valor; filtroMercado().pagina = 0; carregarMercado(); redesenharMercado(); break;
      case 'mercado-pagina': filtroMercado().pagina = Math.max(0, filtroMercado().pagina + Number(el.dataset.valor)); carregarMercado(); break;
      case 'mercado-atualizar': carregarMercado(); break;
      case 'mercado-so-classe': filtroMercado().soClasse = !!el.checked; filtroMercado().pagina = 0; carregarMercado(); break;
      case 'mercado-vender-abrir': estado.mercadoVender = true; redesenharMercado(); break;
      case 'mercado-vender-fechar': estado.mercadoVender = false; redesenharMercado(); break;
      case 'mercado-anunciar': anunciarMercado(el); break;
      case 'mercado-comprar': comprarMercado(el.dataset.id); break;
      case 'mercado-cancelar': cancelarMercado(el.dataset.id); break;
      case 'mercado-ver': estado.mercadoVer = el.dataset.id; redesenharMercado(); break;
      case 'mercado-fechar':
        if (e && e.target && e.target.closest('.zoom-janela') && !e.target.closest('[data-acao="mercado-fechar"].btn, .zoom-x')) break;
        estado.mercadoVer = null; redesenharMercado(); break;
      case 'leilao-atualizar': estado.leilao = null; carregarLeilao(); telaJogo(); break;
      case 'leilao-ver': estado.leilaoVer = el.dataset.id; telaJogo(); break;
      case 'leilao-fechar':
        if (e && e.target && e.target.closest('.zoom-janela') && !e.target.closest('[data-acao="leilao-fechar"].btn, .zoom-x')) break;
        estado.leilaoVer = null; telaJogo(); break;
      case 'guia-comecar': R.comecarGuia(estado.personagem); salvar(); telaJogo(); break;
      case 'guia-pular':
        if (estado.guiaPularConfirma) { R.pularGuia(estado.personagem); estado.guiaPularConfirma = false; salvar(); telaJogo(); }
        else { estado.guiaPularConfirma = true; avisar('Clique de novo para fechar o guia. Sem o guia, você não ganha o presente do final.'); setTimeout(function () { estado.guiaPularConfirma = false; }, 6000); }
        break;
      case 'historia-ver': {
        var eh = R.historiaEstado(estado.personagem);
        if (!eh || eh.fim) break;
        estado.historiaCena = { rotulo: 'Capítulo ' + (eh.indice + 1) + ' · ' + nomeArea(eh.capitulo.area), titulo: eh.capitulo.titulo,
          falas: eh.capitulo.abertura, botao: eh.visto ? 'Fechar' : 'Aceitar a missão' };
        if (!eh.visto) { R.marcarHistoriaVista(estado.personagem); salvar(); }
        telaJogo(); break;
      }
      case 'historia-concluir': {
        var fim = R.concluirCapitulo(estado.personagem);
        if (!fim) break;
        if (fim.erro) { avisar(fim.erro); break; }
        estado.historiaCena = { rotulo: 'Fim do capítulo', titulo: fim.capitulo.titulo, falas: fim.capitulo.fechamento, premio: fim.premio };
        salvar(); telaJogo(); break;
      }
      case 'historia-reler': {
        var cr = D.HISTORIA.capitulos[Number(el.dataset.valor)];
        if (!cr) break;
        estado.historiaCena = { rotulo: 'Relendo', titulo: cr.titulo, falas: cr.abertura.concat(cr.fechamento), botao: 'Fechar' };
        telaJogo(); break;
      }
      case 'historia-fechar':
        estado.historiaCena = null; telaJogo(); break;
      case 'mochila-aba':
        estado.mochilaAba = el.dataset.valor === 'consumiveis' ? 'consumiveis' : 'equipamentos';
        estado.vendaLote = null;
        telaJogo();
        break;
      case 'consumivel':
        if (estado.consumivelFoco === el.dataset.id && document.getElementById('ficha-flutuante')) { fecharFlutuante(); break; }
        estado.consumivelFoco = el.dataset.id;
        estado.itemFoco = estado.dropFoco = null;
        desenharFlutuante(el);
        break;
      case 'item-ampliar':
        estado.zoom = el.dataset.id;
        fecharFlutuante();
        telaJogo();
        break;
      case 'mochila-filtro': {
        var rs = visaoMochila().raridades, k = el.dataset.valor;
        if (rs.indexOf(k) >= 0) rs.splice(rs.indexOf(k), 1); else rs.push(k);
        el.classList.toggle('ativa', rs.indexOf(k) >= 0);
        aplicarVisaoMochila();
        break;
      }
      case 'mochila-organizar': {
        var vm = visaoMochila();
        R.organizarMochila(p, vm.ordem === 'mochila' ? 'raridade' : vm.ordem, vm.ordem === 'mochila' ? false : vm.crescente);
        vm.ordem = 'mochila';
        salvar();
        telaJogo();
        avisar('Mochila organizada.');
        break;
      }
      case 'mochila-lote':
        estado.vendaLote = estado.vendaLote ? null : { ids: {}, confirmar: false };
        estado.zoom = null;
        telaJogo();
        atualizarTotalLote();
        break;
      case 'lote-ate':
        estado.vendaLote.ids = {};
        R.idsAteRaridade(p, el.dataset.valor).forEach(function (id) { estado.vendaLote.ids[id] = true; });
        estado.vendaLote.confirmar = false;
        aplicarVisaoMochila();
        break;
      case 'lote-limpar':
        estado.vendaLote.ids = {};
        estado.vendaLote.confirmar = false;
        aplicarVisaoMochila();
        break;
      case 'lote-vender': {
        var lt = estado.vendaLote, idsLote = Object.keys(lt.ids);
        if (!idsLote.length) break;
        if (!lt.confirmar) { lt.confirmar = true; atualizarTotalLote(); break; }
        var vendeu = R.venderVarios(p, idsLote);
        estado.vendaLote = { ids: {}, confirmar: false };
        salvar();
        telaJogo();
        atualizarTotalLote();
        avisar('Vendidos ' + vendeu.vendidos + ' item(ns): +' + vendeu.ouro.toLocaleString('pt-BR') + ' de ouro', 'item');
        break;
      }
      case 'item-travar':
        R.travarItem(p, el.dataset.id);
        estado.vendaPendente = null;
        salvar();
        telaJogo();
        break;
      case 'ficha-status':
        estado.fichaAberta = !estado.fichaAberta;
        atualizarFicha();
        break;
      case 'arena-rolar':
        rolarDadoArena(true);
        break;
      case 'arena-fechar':
        clearTimeout(estado.lutaArena.timer);
        clearInterval(estado.lutaArena.relogio);
        clearInterval(estado.lutaArena.giro);
        fecharDado3d();
        estado.lutaArena = null;
        estado.aba = 'arena';
        estado.arena = null;
        telaJogo();
        carregarArena();
        break;
      case 'admin-arena-entradas':
        C.arena.adminRecarregar(p.id).then(function () { avisar('Entradas da Arena recarregadas.'); estado.arena = null; carregarArena(); }, function (e2) { avisar(e2.message); });
        break;
      case 'grupo-convidar':
        acaoGrupo(function () { return C.grupo.convidar(p.id, el.dataset.id); }, 'Convite enviado para ' + el.dataset.nome + '.');
        break;
      case 'grupo-aceitar':
        acaoGrupo(function () { return C.grupo.responder(p.id, Number(el.dataset.convite), true); }, 'Você entrou no grupo!');
        break;
      case 'grupo-recusar':
        acaoGrupo(function () { return C.grupo.responder(p.id, Number(el.dataset.convite), false); });
        break;
      case 'grupo-pronto':
        acaoGrupo(function () { return C.grupo.pronto(p.id, el.dataset.valor === 'sim'); });
        break;
      case 'grupo-sair':
        acaoGrupo(function () { return C.grupo.sair(p.id); }, 'Você saiu do grupo.');
        break;
      case 'grupo-expulsar':
        acaoGrupo(function () { return C.grupo.expulsar(p.id, el.dataset.id); });
        break;
      case 'grupo-escolher':
        acaoGrupo(function () { return C.grupo.escolher(p.id, el.dataset.valor); });
        break;
      case 'masmorra-entrar':
        entrarMasmorra(el);
        break;
      case 'luta-velocidade':
        estado.luta.rapido = !estado.luta.rapido;
        redesenharLuta();
        break;
      case 'luta-fechar': {
        var eraBoss = estado.luta && estado.luta.boss;
        clearTimeout(estado.luta.timer);
        estado.luta = null;
        if (eraBoss) { estado.aba = 'alianca'; estado.aliancaVista = 'boss'; telaJogo(); carregarBossAl(); break; }
        estado.aba = 'masmorra';
        telaJogo();
        resgatarRecompensas();
        break;
      }
      case 'admin-masmorra-entradas':
        acaoGrupo(function () { return C.grupo.adminRecarregar(p.id); }, 'Entradas da masmorra recarregadas.');
        break;
      case 'amigo-abrir':
        estado.amigoAberto = estado.amigoAberto === Number(el.dataset.pedido) ? null : Number(el.dataset.pedido);
        estado.removerAmigo = null;
        telaJogo();
        break;
      case 'amigo-perfil': abrirDesafio(el.dataset.id, 'perfil'); break;
      case 'amigo-alianca':
        acaoAlianca(C.alianca.convidar(p.id, el.dataset.nome), 'Convite enviado para ' + el.dataset.nome + '.');
        break;
      case 'amigo-privado': abrirPrivado(el.dataset.id, el.dataset.nome); break;
      case 'amigo-aceitar':
        acaoAmigo(function () { return C.amigos.responder(p.id, Number(el.dataset.pedido), true); }, 'Pedido aceito!');
        break;
      case 'amigo-recusar':
        acaoAmigo(function () { return C.amigos.responder(p.id, Number(el.dataset.pedido), false); });
        break;
      case 'amigo-pedir-remover':
        estado.removerAmigo = Number(el.dataset.pedido);
        telaJogo();
        break;
      case 'amigo-manter':
        estado.removerAmigo = null;
        telaJogo();
        break;
      case 'amigo-remover':
        acaoAmigo(function () { return C.amigos.remover(p.id, Number(el.dataset.pedido)); });
        break;
      case 'social-atualizar':
        estado.social = null;
        telaJogo();
        break;
      case 'ranking-tipo':
        estado.rankingTipo = el.dataset.valor;
        telaJogo();
        break;
      case 'ranking-atualizar':
        estado.ranking = null;
        telaJogo();
        break;
      case 'mercado-raridade':
        estado.mercadoRaridade = el.dataset.valor;
        telaJogo();
        break;
      case 'ponto': {
        var pp = pontosPendentes(), ka = el.dataset.atributo;
        if (totalPendentes() >= p.pontosLivres || R.ATRIBUTOS.indexOf(ka) < 0) break;
        pp[ka] = (pp[ka] || 0) + 1;
        atualizarFicha();
        break;
      }
      case 'ponto-menos': {
        var pm = pontosPendentes(), km = el.dataset.atributo;
        if (pm[km]) pm[km] -= 1;
        atualizarFicha();
        break;
      }
      case 'recomeco-pedir':
        estado.recomecoPendente = true;
        atualizarFicha();
        break;
      case 'recomeco-usar': {
        var ru = R.usarRecomeco(p);
        estado.recomecoPendente = false;
        estado.pontosPend = null;
        if (ru === true) { salvar(); telaJogo(); avisar('Atributos resetados: ' + p.pontosLivres + ' pontos para distribuir!', 'nivel'); }
        else { avisar(ru); atualizarFicha(); }
        break;
      }
      case 'hab-classe': {
        var sc = D.SEGUNDAS_CLASSES[el.dataset.valor];
        if (!sc || !confirm('Virar ' + ((p.sexo === 'feminino' && sc.nomeF) || sc.nome) + '? Só dá para trocar com o ' + D.RECOMECO_HABILIDADES.nome + '.')) break;
        var rcl = R.escolherSegundaClasse(p, el.dataset.valor);
        if (rcl === true) { estado.habPend = {}; salvar(); telaJogo(); avisar('Agora você é ' + ((p.sexo === 'feminino' && sc.nomeF) || sc.nome) + '! Distribua os seus pontos.', 'nivel'); }
        else avisar(rcl);
        break;
      }
      case 'hab-mais': {
        var idm = el.dataset.id, pdm = pendHab();
        if (R.pontosHabilidadeLivres(p) - totalPendHab() <= 0) { avisar('Sem pontos livres.'); break; }
        if (R.pontosDistribuidos(p, idm) + (pdm[idm] || 0) >= D.TALENTOS.maxPorHabilidade) break;
        pdm[idm] = (pdm[idm] || 0) + 1;
        telaJogo();
        break;
      }
      case 'hab-menos': {
        var pdn = pendHab();
        if (pdn[el.dataset.id]) { pdn[el.dataset.id]--; if (!pdn[el.dataset.id]) delete pdn[el.dataset.id]; }
        telaJogo();
        break;
      }
      case 'hab-cancelar': estado.habPend = {}; telaJogo(); break;
      case 'hab-confirmar': {
        var pdc = pendHab();
        Object.keys(pdc).forEach(function (k) { for (var i = 0; i < pdc[k]; i++) R.mudarPontoHabilidade(p, k, 1); });
        estado.habPend = {};
        salvar(); telaJogo(); avisar('Pontos de habilidade confirmados!');
        break;
      }
      case 'hab-ordem':
        R.moverHabilidade(p, el.dataset.modo, el.dataset.id, el.dataset.op);
        salvar(); telaJogo();
        break;
      case 'hab-pergaminho-comprar': {
        var rh = R.comprarRecomecoHabilidades(p);
        if (rh === true) { salvar(); telaJogo(); avisar('Você comprou o ' + D.RECOMECO_HABILIDADES.nome + '!', 'item'); }
        else avisar(rh);
        break;
      }
      case 'hab-pergaminho-usar': {
        if (!confirm('Usar o ' + D.RECOMECO_HABILIDADES.nome + '? Os pontos voltam e você escolhe a segunda classe de novo.')) break;
        var uh = R.usarRecomecoHabilidades(p);
        if (uh === true) { estado.habPend = {}; salvar(); telaJogo(); avisar('Habilidades zeradas: escolha a segunda classe de novo.', 'nivel'); }
        else avisar(uh);
        break;
      }
      case 'recomeco-comprar': {
        var rc = R.comprarRecomeco(p);
        if (rc === true) { salvar(); telaJogo(); avisar('Você comprou o ' + D.RECOMECO.nome + '!', 'item'); }
        else avisar(rc);
        break;
      }
      case 'pontos-desfazer':
        estado.pontosPend = null;
        atualizarFicha();
        break;
      case 'pontos-confirmar': {
        var pc = pontosPendentes(), dados = 0;
        R.ATRIBUTOS.forEach(function (k) { while (pc[k] > 0 && R.distribuirPonto(p, k)) { pc[k] -= 1; dados++; } });
        estado.pontosPend = null;
        salvar();
        telaJogo();
        if (dados) avisar(dados + ' ponto(s) de atributo distribuído(s)!', 'nivel');
        break;
      }
      case 'acampar':
        R.acampar(p, C.agora(), true);
        salvar();
        avisar(p.nome + ' monta acampamento junto à fogueira. A estamina enche em ' + (D.ESTAMINA.minutosAcampado / 60) + ' h.');
        telaJogo();
        break;
      case 'levantar':
        R.acampar(p, C.agora(), false);
        salvar();
        telaJogo();
        break;
      case 'pocao-comprar': {
        var rp = R.comprarPocao(p);
        if (rp === true) { salvar(); avisar('Poção de vida comprada.', 'vitoria'); } else avisar(rp);
        telaJogo();
        break;
      }
      case 'pote-estamina': {
        var re = R.comprarPoteEstamina(p, C.agora());
        if (re === true) { salvar(); avisar('Você bebe o pote: +' + D.ESTAMINA.pote.enche + ' de estamina.', 'vitoria'); } else avisar(re);
        telaJogo();
        break;
      }
      case 'beber-pocao':
        if (estado.batalha && estado.batalha.replay) { beberNoServidor(); break; }
        if (estado.batalha && R.beberPocao(estado.batalha)) {
          document.getElementById('controle-habilidade').innerHTML = controleHabilidade(estado.batalha);
        }
        break;
      case 'equipar':
        if (R.equipar(p, el.dataset.id)) { estado.vendaPendente = null; estado.zoom = null; salvar(); telaJogo(); }
        else avisar(R.motivoNaoEquipa(p, p.inventario.find(function (i) { return i.id === el.dataset.id; })) || 'Não foi possível equipar (mochila cheia?).');
        break;
      case 'pedir-venda':
        estado.vendaPendente = el.dataset.id;
        telaJogo();
        break;
      case 'vender': {
        var item = p.inventario.find(function (i) { return i.id === el.dataset.id; });
        var valor = item ? R.precoVenda(item) : 0;
        if (item && R.vender(p, item.id)) {
          salvar();
          avisar('Você vendeu ' + R.nomeItem(item) + ' por ' + valor + ' de ouro.');
          estado.itemFoco = null;
          estado.zoom = null;
        }
        estado.vendaPendente = null;
        telaJogo();
        break;
      }
      case 'comprar': {
        var comprado = el.dataset.raridade ? R.comprar(p, el.dataset.raridade, el.dataset.tipo, el.dataset.especifico || undefined)
          : R.comprar(p, el.dataset.tipo, el.dataset.especifico || undefined);
        if (typeof comprado === 'string') { avisar(comprado); break; }
        salvar();
        avisar('Você comprou ' + R.nomeItem(comprado) + ' (nível ' + comprado.nivel + ', ' + D.raridades[comprado.raridade].nome + ')! Está na mochila.');
        telaJogo();
        break;
      }
      case 'pedir-encanto':
        estado.encantoPendente = el.dataset.id;
        estado.ultimoEncanto = null;
        telaJogo();
        break;
      case 'minas-tempo': estado.minasTempo = Number(el.dataset.valor); telaJogo(); break;
      case 'minas-area': estado.minasArea = el.dataset.valor; telaJogo(); break;
      case 'minas-fechar': estado.minasArea = null; telaJogo(); break;
      case 'minas-iniciar': {
        if (estado.cacada || estado.batalha || estado.lutaArena) { avisar('Termine a caçada ou a luta antes de minerar.'); break; }
        if (naFilaMasmorra('minerar')) break;
        var rm = R.iniciarMinas(p, estado.minasTempo == null ? 1 : estado.minasTempo, C.agora(), estado.minasArea);
        if (rm !== true) avisar(rm); else { salvar(); avisar('⛏ Mineração começou! Volte quando terminar.'); }
        telaJogo();
        break;
      }
      case 'minas-parar': {
        var rp2 = R.pararMinas(p, C.agora());
        if (typeof rp2 !== 'string') salvar();
        avisoMinas(rp2, true);
        telaJogo();
        break;
      }
      case 'minas-recolher': {
        var rc = R.recolherMinas(p, C.agora());
        if (typeof rc !== 'string') salvar();
        avisoMinas(rc, false);
        telaJogo();
        break;
      }
      case 'craft-receita': {
        var rr = R.fabricarReceita(p, el.dataset.id);
        if (rr !== true) avisar(rr); else { salvar(); avisar('📜 Receita fabricada!', 'item'); }
        telaJogo();
        break;
      }
      case 'craft-protecao': {
        var rp = R.fabricarProtecao(p, el.dataset.id);
        if (rp !== true) avisar(rp); else { salvar(); avisar('🛡 Pergaminho de Proteção fabricado!', 'item'); }
        telaJogo();
        break;
      }
      case 'oficina-vista':
        estado.oficinaVista = el.dataset.valor;
        telaJogo();
        break;
      case 'loja-secao':   // celular: qual parte da Loja aparece
        estado.lojaSecao = el.dataset.valor;
        telaJogo();
        break;
      case 'mochila-ferramentas':   // celular: lembra se a gaveta de ordenar/filtrar está aberta
        estado.mochilaFerramentas = !el.parentNode.open;
        break;
      case 'oficina-materiais':
        estado.oficinaMateriais = !el.parentNode.open;   // o <details> abre sozinho; só lembra para o próximo redesenho
        break;
      case 'forja-op':
        estado.forja = estado.forja || {};
        estado.forja[el.dataset.campo] = el.dataset.valor;
        telaJogo();
        break;
      case 'forja-qtd': {
        var fq = forjaAtual(p);
        estado.forja = estado.forja || {};
        estado.forja[el.dataset.campo] = Math.max(0, Math.min(3, fq[el.dataset.campo] + Number(el.dataset.valor)));
        telaJogo();
        break;
      }
      case 'forjar': {
        var fa = forjaAtual(p);   // as mesmas escolhas que a tela mostra
        var rf = R.forjar(p, fa.area, fa.classe, fa.tipo, fa.chefe, fa.gemas);
        if (typeof rf === 'string') avisar(rf);
        else { salvar(); avisar((rf.obraPrima ? '✨ OBRA-PRIMA! ' : '🔨 ') + 'Você forjou ' + R.nomeItem(rf.item) + ' (' + nomeRaridadeItem(rf.item) + ')!', 'item raridade-' + rf.item.raridade); }
        telaJogo();
        break;
      }
      case 'usar-protecao':
        estado.usarProtecao = !!el.checked;
        telaJogo();
        break;
      case 'encantar':
        tentarEncantar(el.dataset.id);
        break;
      case 'admin': {
        if (!ehAdmin()) break;
        var op = el.dataset.op;
        var v = op === 'conjunto' || op === 'joia' ? el.dataset.valor : Number(el.dataset.valor);
        if (op === 'joia') {
          if (R.mochilaCheia(p)) { avisar('Mochila cheia!'); break; }
          var joia = R.completarItem(p, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tipo: Math.random() < 0.5 ? 'colar' : 'anel', classe: null, raridade: v, encanto: 0 });
          p.inventario.push(joia);
          salvar();
          avisar('Você ganhou ' + R.nomeItem(joia) + '.');
          telaJogo();
          break;
        }
        if (op === 'ouro') R.admin.ouro(p, v);
        else if (op === 'nivel') R.admin.subirNivel(p, v);
        else if (op === 'armas') R.admin.armas(p, v);
        else if (op === 'pergaminhos') R.admin.pergaminhos(p, v);
        else if (op === 'conjunto') R.admin.conjunto(p, v);
        else if (op === 'curar') R.descansar(p, C.agora());
        else if (op === 'pocoes') R.admin.recarregarPocoes(p);
        else if (op === 'reset') R.admin.resetDiario(p, C.agora());
        else if (op === 'zerar-ouro') R.admin.zerarOuro(p);
        else if (op === 'baixar-nivel') R.admin.baixarNivel(p, v);
        else if (op === 'exp') R.admin.exp(p, v);
        else if (op === 'resetar-atributos') R.admin.resetarAtributos(p);
        else if (op === 'vida') { R.admin.vida(p, v); p.vidaEm = C.agora(); }
        else if (op === 'zerar-pocoes') R.admin.zerarPocoes(p);
        else if (op === 'esvaziar-mochila') R.admin.esvaziarMochila(p);
        else if (op === 'reputacao') p.reputacao = Math.max(0, (p.reputacao || 0) + v);
        if (op === 'pedir-esvaziar') { estado.adminConfirmar = 'mochila'; telaJogo(); break; }
        estado.adminConfirmar = null;
        if (op === 'cancelar') { telaJogo(); break; }
        salvar();
        avisar({ ouro: (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('pt-BR') + ' de ouro. Agora: ' + p.ouro.toLocaleString('pt-BR') + '.',
          'zerar-ouro': 'Ouro zerado.', nivel: 'Agora no level ' + p.nivel + '.', 'baixar-nivel': 'Agora no level ' + p.nivel + '. Distribua os pontos de novo.',
          exp: 'Exp agora: ' + p.exp.toLocaleString('pt-BR') + ' (level ' + p.nivel + ').', 'resetar-atributos': 'Atributos resetados: ' + p.pontosLivres + ' pontos para distribuir.',
          armas: 'Armas +' + v + ' adicionadas à mochila.', conjunto: 'Conjunto adicionado à mochila.',
          pergaminhos: v > 0 ? '+' + v + ' pergaminhos de cada raridade.' : 'Pergaminhos removidos.',
          curar: 'Estamina cheia.', pocoes: 'Poções recarregadas.', reset: 'Reset diário: estamina cheia e poções do dia.',
          vida: 'Estamina em ' + R.estamina(p).pts + '.', 'zerar-pocoes': 'Poções zeradas.', 'esvaziar-mochila': 'Mochila esvaziada.', reputacao: 'Reputação: ' + (p.reputacao || 0) + '.' }[op]);
        telaJogo();
        break;
      }
      case 'habilidade':
        if (estado.batalha && !estado.batalha.replay && R.prepararHabilidade(estado.batalha)) {
          document.getElementById('controle-habilidade').innerHTML = controleHabilidade(estado.batalha);
        }
        break;
      case 'auto-habilidade':
        p.habilidadeAuto = el.checked;
        if (estado.batalha) estado.batalha.auto = el.checked;
        salvar();
        break;
      case 'cacar': {
        var alvo = el.dataset.monstro;
        if (!R.monstroLiberado(p, alvo)) { avisar('Derrote ' + D.monstros[R.monstroAnterior(alvo)].nome + ' primeiro.'); break; }
        if (!R.podeCacar(p, alvo)) { avisar('Essa área ainda não foi liberada.'); break; }
        if (R.atualizarTempo(p, C.agora())) salvar();
        estado.resultado = null; iniciarCacada(D.monstros[alvo].area, [alvo]);   // luta avulsa virou caçada de um monstro só
        break;
        if (p.acampado) { R.acampar(p, C.agora(), false); salvar(); avisar('Acampamento levantado. Boa caçada!'); }   // caçar levanta o acampamento sozinho
        var chefe = R.sortearChefe(p, alvo);
        if (chefe) {
          clearTimeout(estado.timer);
          estado.resultado = null;
          estado.chefeAviso = { chefe: chefe, monstro: alvo };
          telaJogo();
          mostrarPainel();
        } else {
          iniciarCaca(alvo);
        }
        break;
      }
      case 'enfrentar-chefe':
        if (estado.chefeAviso) iniciarCaca(estado.chefeAviso.chefe, estado.chefeAviso.monstro);
        break;
      case 'fugir-chefe':
        if (estado.chefeAviso) {
          avisar('Você escapou do chefe... por enquanto.');
          iniciarCaca(estado.chefeAviso.monstro);
        }
        break;
      case 'area':
        estado.area = estado.areaAberta = el.dataset.valor;
        telaJogo();
        mostrarPainel();
        break;
      case 'fugir': encerrar(); break;
      case 'ficha-fechar': fecharFlutuante(); break;
      case 'painel-topo': fecharMenuJogo(); abrirPainelTopo(el.dataset.valor); break;
      case 'boss-atacar': atacarMundial(); break;
      case 'boss-invocar':
        C.boss.adminInvocar(estado.personagem.id, Number(el.dataset.valor) || null, 60)
          .then(function () { avisar('Ignaroth foi invocado (1 hora).'); carregarBoss(); }, function (e) { avisar(e.message); });
        break;
      case 'velocidade':
        estado.rapido = !estado.rapido;
        el.textContent = estado.cacada ? (estado.rapido ? 'Velocidade 2x' : 'Velocidade normal') : (estado.rapido ? 'Velocidade normal' : 'Acelerar 2x');
        break;
      case 'mapa':
        estado.areaAberta = null;
        telaJogo();
        break;
      case 'cacada-alvo': {
        var areaAlvo = D.monstros[el.dataset.monstro].area, selA = selecaoArea(D.areas.find(function (a) { return a.id === areaAlvo; }));
        var posA = selA.indexOf(el.dataset.monstro);
        if (posA >= 0) selA.splice(posA, 1); else selA.push(el.dataset.monstro);
        telaJogo();
        break;
      }
      case 'cacada-todos': {
        var areaT = D.areas.find(function (a) { return a.id === el.dataset.valor; }), selT = selecaoArea(areaT);
        var livresT = areaT.monstros.map(function (m) { return m.id; }).filter(function (id) { return R.monstroLiberado(p, id); });
        estado.cacaSel[areaT.id] = selT.length === livresT.length ? [] : livresT;
        telaJogo();
        break;
      }
      case 'cacada-iniciar': iniciarCacada(el.dataset.valor); break;
      case 'cacada-lutar': lutarCacada(); break;
      case 'cacada-fugir': fugirEncontro(); break;
      case 'cacada-parar': pararCacada(); break;
      case 'cacada-continuar': if (estado.cacada) { var areaC = estado.cacada.area; iniciarCacada(areaC); } break;
      case 'cacada-fechar': fecharCacada(); break;
      case 'cacada-opcao': {
        var prefO = prefsCacada();
        if (el.dataset.campo === 'pocao') prefO.pocao = Number(el.dataset.valor) || 0;
        else prefO.chefe = el.dataset.valor;
        salvar();
        var blocoO = document.querySelector('.cacada-opcoes');
        if (blocoO) { var tmpO = document.createElement('div'); tmpO.innerHTML = opcoesCacadaHtml(); blocoO.replaceWith(tmpO.firstChild); }
        var cc = estado.cacada;   // chefe esperando resposta agora: já aplica a escolha
        if (el.dataset.campo === 'chefe' && cc && cc.fase === 'encontrou' && cc.encontro.chefe) {
          if (el.dataset.valor === 'lutar') lutarCacada(); else if (el.dataset.valor === 'fugir') fugirEncontro();
        }
        break;
      }
      case 'cacada-sempre':
        prefsCacada().lutarSempre = el.checked;
        salvar();
        if (el.checked && estado.cacada && estado.cacada.fase === 'encontrou' && !estado.cacada.encontro.chefe) lutarCacada();
        break;
      case 'fechar-resultado':
        estado.resultado = null;
        estado.ultimaBatalha = null;
        telaJogo();
        break;
    }
  });

  // Caçada com a aba escondida / app no fundo: para de pedir lutas e, ao voltar, o servidor faz as que faltaram.
  document.addEventListener('visibilitychange', function () {
    if (!estado.personagem) return;
    if (document.visibilityState === 'hidden') cacadaParaFundo(); else retomarCacada();
  });
  // Ao esconder a aba ou fechar o jogo, guarda o tempo de atividade contado até agora.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'hidden' || !estado.personagem || !atividade.relogio) return;
    tiqueAtividade();
    atividade.desdeSalvar = 0;
    salvar();
  });
  // Dentro do jogo o botão direito não abre o menu do navegador: num item da mochila ele equipa (Daniel, nov/2026).
  // Os dois cliques não equipam mais (equipavam sem querer); passar o mouse mostra a ficha.
  // (Nos campos de texto, como o chat, o menu continua para copiar e colar.)
  document.addEventListener('contextmenu', function (e) {
    if (!estado.personagem || !document.querySelector('.jogo')) return;
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    e.preventDefault();
    var el = e.target.closest && e.target.closest('[data-acao="item"]');
    var p = estado.personagem;
    if (!el || estado.vendaLote || R.slotDoItem(p, el.dataset.id)) return;
    var it = p.inventario.find(function (i) { return i.id === el.dataset.id; });
    if (!R.equipar(p, el.dataset.id)) { avisar(R.motivoNaoEquipa(p, it) || 'Não foi possível equipar (mochila cheia?).'); return; }
    fecharFlutuante();
    estado.zoom = null;
    estado.vendaPendente = null;
    salvar();
    telaJogo();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('ficha-flutuante')) fecharFlutuante();
    if (e.key === 'Escape' && estado.zoom) { estado.zoom = null; telaJogo(); }
    if (e.key === 'Escape' && estado.desafio) { estado.desafio = null; telaJogo(); }
  });

  // A estamina volta com o tempo: atualiza a ficha a cada 20 s (fora da batalha). Não precisa gravar: a conta sai
  // do relógio (p.estamina.em), e o próximo salvamento leva o valor certo.
  setInterval(function () {
    var p = estado.personagem;
    if (!p || estado.batalha || !document.querySelector('.ficha')) return;
    R.atualizarTempo(p, C.agora());
    atualizarFicha();
  }, 20000);

  // A cada minuto: avisa o servidor que está jogando (online para os amigos) e procura pedidos novos.
  setInterval(function () {
    if (!estado.personagem || estado.batalha || !document.querySelector('.ficha') || document.hidden) return;
    salvar();
    carregarSocial();
    carregarAlianca();
  }, 60000);

  // ---------------- Masmorras em grupo ----------------
  // estado.gm: o que o servidor diz do grupo (grupo_estado). estado.luta: a luta sendo assistida.
  // A luta é calculada aqui com a semente do servidor; todo mundo do grupo calcula a mesma.
  var vistas = {};   // lutas (run.id) que este navegador já mostrou
  var NOMES_SALA = ['Sala 1', 'Sala 2', 'Sala 3 · Chefe'];

  function seloMasmorra() {
    var g = estado.gm;
    var n = g && g.convites ? g.convites.length : 0;
    return n ? ' <span class="selo-pedidos">' + n + '</span>' : '';
  }

  function carregarGrupo() {
    var p = estado.personagem;
    if (!p || estado.gmCarregando) return;
    estado.gmCarregando = true;
    // Na fila: avisa que está esperando (e o servidor tenta montar a luta) antes de buscar o estado.
    var ping = estado.gm && estado.gm.fila ? C.grupo.filaPing(p.id).catch(function () {}) : Promise.resolve();
    ping.then(function () { return C.grupo.estado(p.id); }).then(function (g) {
      estado.gmCarregando = false;
      if (estado.personagem !== p) return;
      estado.gm = g;
      estado.gmErro = null;
      var run = g.run;
      // Luta nova do grupo (começou há menos de 3 minutos): todos assistem.
      if (run && !vistas[run.id] && !estado.luta && !estado.batalha && C.agora() - Date.parse(run.criado_em) < 180000) {
        assistirLuta(run, null);
        return;
      }
      if (!estado.luta) resgatarRecompensas();
      if (estado.luta || estado.batalha || estado.resultado || estado.chefeAviso) return;
      if (estado.aba === 'masmorra') telaJogo();
      else {
        atualizarNav();
      }
    }, function (e) {
      estado.gmCarregando = false;
      estado.gmErro = e.message;
      if (estado.aba === 'masmorra' && !estado.luta && !estado.batalha) telaJogo();
    });
  }

  async function acaoGrupo(fn, msg) {
    try {
      await fn();
      if (msg) avisar(msg);
    } catch (e) { avisar(e.message); }
    carregarGrupo();
  }

  // Prêmios da masmorra: joias entram na mochila (se couber); pergaminhos vão para os Consumíveis.
  async function resgatarRecompensas(lista) {
    // os prêmios recebidos também ficam na caixa de entrada (origem da recompensa)
    var avisarCaixa = function (msg, tipo) { avisar(msg, tipo); caixaRegistrar(origemCaixa(rec && rec.origem), msg); };
    var p = estado.personagem, g = estado.gm;
    lista = lista || (g && g.recompensas);
    if (!p || !lista || !lista.length || estado.resgatando) return;
    estado.resgatando = true;
    // Entrega segura (nov/2026): antes o prêmio era marcado como recebido no servidor ANTES de o personagem ser gravado;
    // se a gravação falhasse (ex.: "jogado em outra aba"), o item sumia. Agora: aplica no personagem, guarda o id em
    // p.recebidas, grava, e só depois marca no servidor. Se a gravação falhar, o prêmio continua lá e volta depois;
    // se a marcação falhar, p.recebidas impede de entregar duas vezes.
    var entregues = [];
    var pegar = async function (rec) {
      entregues.push(rec.id);
      p.recebidas = (p.recebidas || []).concat(rec.id).slice(-200);
      return JSON.parse(JSON.stringify(rec.item));
    };
    try {
      var avisouCheia = false;
      for (var i = 0; i < lista.length; i++) {
        var rec = lista[i];
        if (p.recebidas && p.recebidas.indexOf(rec.id) >= 0) { entregues.push(rec.id); continue; }   // já entregue: só falta marcar
        // Lote ganho no leilão: o item é gerado da semente (igual ao que todos viram no leilão).
        if (rec.item && rec.item.leilao) {
          var ganho = R.itemDoLote(rec.item);
          if (ganho.consumivel) {
            await pegar(rec);
            R.mudarPergaminho(p, ganho.raridade, ganho.qtd);
            salvar();
            avisarCaixa('Você venceu o leilão: ' + nomeDrop(ganho) + '! (Mochila › Consumíveis)', 'item');
            continue;
          }
          if (R.mochilaCheia(p)) {
            if (!avisouCheia) avisarCaixa('Mochila cheia! Seu item do leilão está guardado: libere espaço para recebê-lo.');
            avisouCheia = true;
            continue;
          }
          await pegar(rec);
          p.inventario.push(ganho);
          salvar();
          avisarCaixa('Você venceu o leilão: ' + R.nomeItem(ganho) + ' (' + nomeRaridadeItem(ganho) + ')!', 'item');
          continue;
        }
        // Chefe Mundial: ouro e exp (x ataques) e o título do golpe final.
        if (rec.item && rec.item.tipo === 'boss_premio') {
          var bp = await pegar(rec);
          var ganhoBoss = R.premioChefeMundial(p, bp);
          salvar();
          avisarCaixa('🐉 Chefe Mundial' + (bp.venceu ? '' : ' (consolação)') + ': +' + ganhoBoss.ouro.toLocaleString('pt-BR') + ' de ouro e +'
            + ganhoBoss.exp.toLocaleString('pt-BR') + ' de exp!', 'vitoria');
          if (ganhoBoss.niveis) avisarCaixa('Level up! Level ' + p.nivel, 'nivel');
          continue;
        }
        if (rec.item && rec.item.tipo === 'titulo') {
          var tit = await pegar(rec);
          p.titulos = p.titulos || [];
          if (p.titulos.indexOf(tit.nome) < 0) p.titulos.push(tit.nome);
          p.titulo = tit.nome;
          salvar();
          avisarCaixa('🐉 Novo título: "' + tit.nome + '"!', 'nivel');
          continue;
        }
        // Pergaminho de encantamento: não ocupa a mochila.
        if (rec.item && rec.item.tipo === 'pergaminho') {
          var perg = await pegar(rec);
          if (!D.raridades[perg.raridade]) continue;
          var nPerg = Math.max(1, Math.floor(perg.qtd || 1));
          R.mudarPergaminho(p, perg.raridade, nPerg);
          salvar();
          avisarCaixa((nPerg > 1 ? nPerg + ' Pergaminhos' : 'Um Pergaminho') + ' para item ' + ITEM_RARIDADE[perg.raridade]
            + (perg.boss ? ' do boss do clã!' : rec.origem === 'boss' ? ' do Chefe Mundial!' : rec.origem === 'mercado' ? ' do mercado chegou!' : ' na masmorra!'), 'item');
          continue;
        }
        // Item forjado na Oficina de um Ferreiro: o jogo monta o item com a semente do servidor.
        if (rec.item && rec.item.tipo === 'forjado') {
          if (R.mochilaCheia(p)) { if (!avisouCheia) avisarCaixa('Mochila cheia! Seu item da Oficina está guardado: libere espaço.'); avisouCheia = true; continue; }
          var rfo = await pegar(rec), ifo = R.itemForjado(rfo.spec);
          if (ifo) { p.inventario.push(ifo); salvar(); avisarCaixa((ifo.obraPrima ? '✨ OBRA-PRIMA! ' : '🔨 ') + 'A Oficina entregou ' + R.nomeItem(ifo) + ' (' + nomeRaridadeItem(ifo) + ')!', 'item'); }
          continue;
        }
        // Craft (material, receita, proteção, cristal) do mercado ou da Oficina: vai para os Consumíveis.
        if (rec.item && (TIPOS_CRAFT.indexOf(rec.item.tipo) >= 0 || rec.item.tipo === 'cristal')) {
          var rcf = await pegar(rec);
          var ncf = Math.max(1, Math.floor(rcf.qtd || 1));
          R.mudarConsumivel(p, rcf.tipo, rcf.raridade, ncf);
          salvar();
          avisarCaixa(ncf + 'x ' + R.nomeConsumivel({ tipo: rcf.tipo, raridade: rcf.raridade }) + (rec.origem === 'mercado' ? ' do mercado chegou!' : rec.origem === 'oficina' ? ' (Oficina)' : '!'), 'item');
          continue;
        }
        // Boss da aliança: exp (limitada a uma parte da exp do level) e o item de quem deu mais dano.
        if (rec.item && rec.item.tipo === 'exp') {
          var rx = await pegar(rec);
          var xp = Math.min(Number(rx.valor) || 0, Math.floor(R.expNecessaria(p.nivel) * D.BOSS_ALIANCA.premio.expMaxPct / 100));
          var subiu = R.ganharExp(p, xp);
          salvar();
          avisarCaixa('Boss do clã derrotado! +' + xp.toLocaleString('pt-BR') + ' de exp.' + (subiu ? ' Você subiu de level!' : ''), 'nivel');
          continue;
        }
        if (rec.item && rec.item.tipo === 'bossItem') {
          if (R.mochilaCheia(p)) {
            if (!avisouCheia) avisarCaixa('Mochila cheia! Seu item do boss do clã está guardado: libere espaço para recebê-lo.');
            avisouCheia = true;
            continue;
          }
          var rb = await pegar(rec);
          var ib = R.itemBossAlianca(p, rb.raridade);
          p.inventario.push(ib);
          salvar();
          avisarCaixa('Maior dano no boss do clã! Você ganhou ' + R.nomeItem(ib) + ' (' + nomeRaridadeItem(ib) + ')!', 'item');
          continue;
        }
        if (R.mochilaCheia(p)) {
          if (!avisouCheia) avisarCaixa('Mochila cheia! Seu item (' + ({ boss: 'Chefe Mundial', mercado: 'mercado', oficina: 'Oficina' }[rec.origem] || 'masmorra') + ') está guardado: libere espaço para recebê-lo.');
          avisouCheia = true;
          continue;
        }
        var bruto = await pegar(rec);
        var item = bruto && bruto.tipo === 'boss_item' ? R.itemDoChefeMundial(p, bruto.raridade) : R.completarItem(p, bruto);
        p.inventario.push(item);
        salvar();
        avisarCaixa((rec.origem === 'mercado' ? 'Chegou do mercado: ' : rec.origem === 'oficina' ? 'A Oficina devolveu: ' : 'Você ganhou ') + R.nomeItem(item) + ' (' + nomeRaridadeItem(item) + ')!');
      }
      if (entregues.length) {
        p.poder = R.poder(p);
        await C.salvarPersonagem(p);   // grava o personagem com os prêmios...
        for (var k = 0; k < entregues.length; k++) await C.grupo.resgatar(p.id, entregues[k]).catch(function () {});   // ...e só então marca
      }
    } catch (e) { if (!e.conflito) avisarCaixa(e.message); }
    estado.resgatando = false;
    if (g && lista === g.recompensas) g.recompensas = [];
    if (!estado.luta && !estado.batalha && !estado.resultado && !estado.chefeAviso) telaJogo();
  }

  async function entrarMasmorra(botao) {
    var p = estado.personagem;
    botao.disabled = true;
    try {
      var run = await C.grupo.iniciar(p.id);
      var sim = R.simularMasmorra(run.herois.map(function (h) { return h.dados; }), run.masmorra, run.semente);
      // O líder já registra o resultado (vale mesmo se fechar a página no meio da luta).
      C.grupo.concluir(p.id, run.id, sim.vitoria).catch(function (e) { avisar('Erro ao registrar o resultado: ' + e.message); });
      assistirLuta(run, sim);
    } catch (e) {
      avisar(e.message);
      botao.disabled = false;
    }
  }

  function assistirLuta(run, sim) {
    vistas[run.id] = true;
    sim = sim || R.simularMasmorra(run.herois.map(function (h) { return h.dados; }), run.masmorra, run.semente);
    // Luta da fila: qualquer jogador registra o resultado (o primeiro vale; os outros recebem "já terminou").
    if (run.fila && run.estado === 'andamento') C.grupo.concluir(estado.personagem.id, run.id, sim.vitoria).catch(function () {});
    // Missão: cada masmorra vencida conta uma vez por personagem.
    var mis = R.garantirMissoes(estado.personagem, C.agora());
    if (sim.vitoria && mis.runs.indexOf(run.id) < 0) {
      mis.runs = mis.runs.concat(run.id).slice(-20);
      R.registrarMissao(estado.personagem, 'masmorra', 1, C.agora());
      missaoCla('masmorra', 1);
      if (R.registrarHistoria(estado.personagem, 'masmorra', run.masmorra)) avisoHistoria();
      salvar();
    }
    estado.luta = {
      run: run, sim: sim, mm: R.masmorra(run.masmorra), idx: 0, sala: 0, fim: false, rapido: false, registro: [],
      hpH: sim.inicio.herois.map(function (h) { return h.hpMax; }),
      hpM: sim.inicio.salas[0].map(function (m) { return m.hpMax; }),
      // Toda luta dura no máximo uns 75 segundos na velocidade normal.
      atraso: Math.max(30, Math.min(350, Math.round(75000 / Math.max(1, sim.eventos.length)))),
    };
    estado.luta.registro.push('<p class="destaque">O grupo entra em ' + esc(estado.luta.mm.nome) + '!</p>');
    estado.chefeAviso = null;
    telaJogo();
    mostrarPainel();
    agendarLuta();
  }

  function agendarLuta() {
    var L = estado.luta;
    if (!L || L.fim) return;
    clearTimeout(L.timer);
    L.timer = setTimeout(function () {
      if (estado.luta !== L) return;
      passoLuta(false);
      redesenharLuta();
      agendarLuta();
    }, L.rapido ? Math.max(10, Math.round(L.atraso / 2)) : L.atraso);   // Daniel: acelerar é 2x (era 4x)
  }

  function passoLuta(silencioso) {
    var L = estado.luta, ev = L.sim.eventos[L.idx++];
    if (!ev) {
      L.fim = true;
      if (L.boss) {
        L.registro.push(L.sim.vitoria ? '<p class="habilidade-usada">O BOSS CAIU! ' + esc(L.boss.nome) + ' foi derrotado!</p>'
          : '<p class="destaque">Fim da investida: ' + L.sim.dano.toLocaleString('pt-BR') + ' de dano' + (L.sim.tempo ? ' (o boss recuou para recuperar o fôlego).' : '.') + '</p>');
        return;
      }
      var s = L.sim.inicio;
      L.registro.push(L.sim.vitoria
        ? '<p class="habilidade-usada">VITÓRIA! ' + esc(s.salas[2][0].nome) + ' caiu!</p>'
        : '<p class="dano-recebido">O grupo caiu na ' + NOMES_SALA[L.sim.sala].toLowerCase() + '.</p>');
      return;
    }
    var herois = L.sim.inicio.herois, monstros = L.sim.inicio.salas[L.sala];
    if (ev.tipo === 'sala') {
      L.sala = ev.sala;
      L.hpM = L.sim.inicio.salas[L.sala].map(function (m) { return m.hp != null ? m.hp : m.hpMax; });
      L.registro.push('<p class="destaque">— ' + NOMES_SALA[L.sala] + ' —</p>');
      atualizarMusica();
    } else if (ev.tipo === 'habM') {
      L.registro.push('<p class="dano-recebido">💥 ' + esc(monstros[ev.i].nome) + ' usa <strong>' + esc(ev.nome) + '</strong> em todo o grupo!</p>');
    } else if (ev.tipo === 'hab') {
      L.registro.push('<p class="habilidade-usada">' + (ev.cura ? '💚 ' : ev.reforco ? '✨ ' : '⚡ ') + esc(herois[ev.i].nome) + ' usa <strong>' + esc(ev.nome) + '</strong>'
        + (ev.cura ? ' e cura o grupo' : '') + '!</p>');
    } else if (ev.atordoado) {
      L.registro.push('<p class="errou">' + esc(monstros[ev.i].nome) + ' está atordoado e perde a vez.</p>');
    } else if (ev.sombra) {
      L.registro.push('<p class="errou">' + esc(monstros[ev.i].nome) + ' ataca ' + esc(herois[ev.alvo].nome) + ', que está nas sombras.</p>');
    } else if (ev.de === 'h') {
      var h = herois[ev.i], m = monstros[ev.alvo];
      if (!ev.acerto) L.registro.push('<p class="errou">' + esc(h.nome) + ' erra ' + esc(m.nome) + '.</p>');
      else {
        L.hpM[ev.alvo] = Math.max(0, L.hpM[ev.alvo] - ev.dano);
        L.registro.push(ev.queima ? '<p class="habilidade-usada">🔥 ' + esc(m.nome) + ' queima e perde <strong>' + ev.dano + '</strong>.</p>'
          : ev.dot ? '<p class="habilidade-usada">☠️ ' + esc(m.nome) + ' perde <strong>' + ev.dano + '</strong> (veneno de ' + esc(h.nome) + ').</p>'
          : '<p class="' + (ev.critico ? 'critico' : '') + '">' + (ev.critico ? 'CRÍTICO! ' : '') + esc(h.nome) + ' acerta ' + esc(m.nome) + ': <strong>' + ev.dano + '</strong>.</p>');
        if (ev.caiu) L.registro.push('<p class="destaque">' + esc(m.nome) + ' caiu!</p>');
        else if (ev.atordoou) L.registro.push('<p class="destaque">' + esc(m.nome) + (ev.congelou ? ' está congelado!' : ' está atordoado!') + '</p>');
      }
    } else {
      var mo = monstros[ev.i], alvo = herois[ev.alvo];
      if (!ev.acerto) L.registro.push('<p class="errou">' + esc(mo.nome) + ' ataca ' + esc(alvo.nome) + ', que se esquiva.</p>');
      else {
        L.hpH[ev.alvo] = Math.max(0, L.hpH[ev.alvo] - ev.dano);
        L.registro.push('<p class="dano-recebido">' + esc(mo.nome) + ' acerta ' + esc(alvo.nome) + ': <strong>' + ev.dano + '</strong>.</p>');
        if (ev.bolso) L.registro.push('<p class="cura">🧪 ' + esc(alvo.nome) + ' usa o Bolso de Poções e recupera vida.</p>');
        if (ev.milagre) L.registro.push('<p class="cura">✨ Milagre! ' + esc(alvo.nome) + ' volta à luta.</p>');
        if (ev.caiu) L.registro.push('<p class="dano-recebido"><strong>' + esc(alvo.nome) + ' caiu!</strong></p>');
      }
    }
    if (ev.hp) L.hpH = ev.hp.slice();   // vida certa de todos (cura, Bênção)
    if (L.registro.length > 80) L.registro.splice(0, L.registro.length - 80);
  }

  function redesenharLuta() {
    var painel = document.querySelector('.jogo > section');
    if (!painel || !estado.luta) return;
    painel.innerHTML = lutaMasmorraHtml();
    var reg = document.getElementById('registro');
    if (reg) reg.scrollTop = reg.scrollHeight;
  }

  function lutaMasmorraHtml() {
    var L = estado.luta, ini = L.sim.inicio;
    var herois = ini.herois.map(function (h, i) {
      return '<div class="mas-lutador' + (L.hpH[i] ? '' : ' caido') + '"><div class="moldura">' + F.personagem(h.raca, classeRetrato(h), h.sexo) + '</div>'
        + '<div class="mas-nome">' + esc(h.nome) + '</div>' + barra('hp', L.hpH[i], h.hpMax, L.hpH[i] + ' / ' + h.hpMax, 'heroi' + i) + '</div>';
    }).join('');
    var monstros = ini.salas[L.sala].map(function (m, i) {
      return '<div class="mas-lutador' + (L.hpM[i] ? '' : ' caido') + (m.chefe ? ' mas-chefe' : '') + '"><div class="moldura">' + F.imagemMonstro(m.id) + '</div>'
        + '<div class="mas-nome">' + (m.chefe ? '<span class="selo-chefe">Chefe</span> ' : m.elite ? '<span class="selo-elite">Elite</span> ' : '') + esc(m.nome) + '</div>'
        + barra('hp', L.hpM[i], m.hpMax, L.hpM[i].toLocaleString('pt-BR') + ' / ' + m.hpMax.toLocaleString('pt-BR'), 'mas' + i) + '</div>';
    }).join('');
    var fim = '';
    if (L.fim && L.boss) {
      var sv = L.servidor, caiu = sv ? sv.morreu : L.sim.vitoria, danoTotal = sv ? Number(sv.dano) : L.sim.dano;
      var aindaAberto = !caiu && !(sv && sv.estado && sv.estado !== 'aberto');
      var podeAtacar = aindaAberto && L.run.lider === estado.personagem.id;
      fim = '<div class="resultado ' + (caiu ? 'vitoria-chefe' : 'vitoria') + '"><h2>' + (caiu ? 'O BOSS CAIU!' : 'Investida concluída') + '</h2>'
        + '<p>' + (caiu ? 'O clã derrotou ' + esc(L.boss.nome) + '! Todos que deram dano hoje recebem o prêmio (chega sozinho). Amanhã ele volta mais forte.'
          : 'Dano desta investida: <strong>' + danoTotal.toLocaleString('pt-BR') + '</strong>.' + (sv && Number(sv.dano) < L.sim.dano ? ' (Outro grupo bateu ao mesmo tempo: contou só a vida que faltava.)' : '')
            + (sv && sv.estado && sv.estado !== 'aberto' && !caiu ? ' O boss já tinha fechado: este dano não contou.' : ''))
        + '</p><p class="suave pequeno">' + L.sim.inicio.herois.map(function (h, i) { return esc(h.nome) + ': ' + L.sim.danos[i].toLocaleString('pt-BR'); }).join(' · ') + '</p>'
        + '<div class="botoes">' + (podeAtacar ? '<button class="btn" data-acao="al-boss-atacar">⚔ Atacar de novo</button>' : '')
        + '<button class="btn' + (podeAtacar ? ' secundario' : '') + '" data-acao="luta-fechar">Voltar</button></div></div>';
    } else if (L.fim) {
      fim = L.sim.vitoria
        ? '<div class="resultado vitoria-chefe"><h2>VITÓRIA!</h2><p>O grupo venceu ' + esc(L.mm.nome) + '. Cada um ganhou um colar ou anel (vai para a mochila) e tem ' + D.MASMORRA.pergaminho + '% de chance de ganhar um pergaminho de encantamento.</p>'
        : '<div class="resultado derrota"><h2>Derrota</h2><p>O grupo caiu na ' + NOMES_SALA[L.sim.sala].toLowerCase() + '. Ninguém perdeu nada e a entrada não foi gasta.</p>';
      fim += '<div class="botoes"><button class="btn" data-acao="luta-fechar">Voltar</button></div></div>';
    }
    return fim + '<h3 class="subtitulo">' + esc(L.mm.nome) + ' · ' + (L.boss ? 'Boss do clã · Nível ' + L.run.nivel : NOMES_SALA[L.sala]) + '</h3>'
      + '<div class="mas-arena"><div class="mas-grupo">' + herois + '</div><div class="vs">VS</div><div class="mas-grupo">' + monstros + '</div></div>'
      + '<div class="registro" id="registro">' + L.registro.join('') + '</div>'
      + (L.fim ? '' : '<div class="botoes"><button class="btn secundario" data-acao="luta-velocidade">' + (L.rapido ? 'Velocidade normal' : 'Acelerar 2x') + '</button></div>');
  }

  // ---------------- Guia do Aventureiro (tutorial dos personagens novos; regras em regras.js, texto em historia.js) ----------------
  function abaDoGuia() {
    var g = estado.personagem && R.guiaEstado(estado.personagem);
    return g && g.passo.aba && !(g.passo.id === 'arena' && estado.personagem.nivel < D.ARENA.nivelMin) ? g.passo.aba : null;
  }
  function conferirGuia() {
    var p = estado.personagem, r = p && R.verificarGuia(p);
    if (!r) return;
    if (r.fim) avisar('🎁 Guia concluído! Mestre Aldric te deu: ' + r.premio + '. Boa jornada, aventureiro!');
    else { var g = R.guiaEstado(p); if (g) avisar('🧭 Guia: ' + g.passo.titulo + '. ' + g.passo.texto); }
    salvar();
  }
  function guiaHtml() {
    var p = estado.personagem, g = p && R.guiaEstado(p);
    if (!g || estado.batalha || estado.luta || estado.lutaArena) return '';
    var passo = g.passo, extra = '';
    if (passo.id === 'cacar') extra = ' <span class="guia-num">' + Math.min(g.abates, passo.meta) + '/' + passo.meta + '</span>';
    if (passo.id === 'arena' && p.nivel < D.ARENA.nivelMin) extra = ' <span class="guia-num">level ' + p.nivel + '/' + D.ARENA.nivelMin + '</span>';
    var ir = passo.aba && passo.aba !== estado.aba && !(passo.id === 'arena' && p.nivel < D.ARENA.nivelMin)
      ? '<button class="btn btn-mini" data-acao="aba" data-aba="' + passo.aba + '">Ir</button>' : '';
    var botoes = g.indice === 0
      ? '<button class="btn btn-mini" data-acao="guia-comecar">Começar</button><button class="btn secundario btn-mini" data-acao="guia-pular">Pular guia</button>'
      : ir + '<button class="btn secundario btn-mini" data-acao="guia-pular" title="Fechar o guia (sem o presente)">✕</button>';
    return '<div class="guia-cartao" role="status"><div class="guia-retrato"><img src="assets/historia/aldric.webp" alt=""></div>'
      + '<div class="guia-texto"><div class="guia-titulo">🧭 Guia ' + (g.indice ? g.indice + '/' + (g.total - 1) + ' · ' : '') + passo.titulo + extra + '</div>'
      + '<div>' + passo.texto + '</div></div><div class="guia-botoes">' + botoes + '</div></div>';
  }

  // ---------------- História: "A Crônica de Eldrin" (texto em js/historia.js, regras em regras.js) ----------------
  function seloHistoria() {
    var e = estado.personagem && R.historiaEstado(estado.personagem);
    return e && !e.fim && e.liberado && (e.completo || !e.visto) ? ' <span class="selo-pedidos">!</span>' : '';
  }
  var avisouHistoria = null;
  function avisoHistoria() {
    var e = R.historiaEstado(estado.personagem);
    if (e && e.completo && avisouHistoria !== e.capitulo.id) {
      avisouHistoria = e.capitulo.id;
      avisar('📜 História: "' + e.capitulo.titulo + '" completo! Receba o prêmio em Aventura > História.');
    }
  }
  function nomeArea(id) { var a = D.areas.filter(function (x) { return x.id === id; })[0]; return a ? a.nome : id; }
  function textoObjetivo(o) {
    if (o.tipo === 'abate') return 'Vença ' + o.qtd + ' criaturas em ' + nomeArea(o.area);
    var vezes = o.qtd > 1 ? ' ' + o.qtd + ' vezes' : '';
    if (o.tipo === 'chefe') return 'Derrote ' + D.monstros[o.monstro].nome + vezes + ' <span class="suave pequeno">(chefe da região, aparece na caçada)</span>';
    var m = D.masmorras.filter(function (x) { return x.id === o.masmorra; })[0];
    return 'Vença a masmorra ' + (m ? m.nome + vezes + ' <span class="suave pequeno">(level ' + m.nivelMin + ')</span>' : o.masmorra + vezes);
  }
  // Uma fala: retrato (personagem da história, monstro ou o livro do narrador), nome e texto.
  function falaHtml(f) {
    var H = D.HISTORIA, pers = H.PERSONAGENS[f.quem], monstro = D.monstros[f.quem], nome, retrato;
    if (f.quem === 'narrador') { nome = 'Narrador'; retrato = '<span class="fala-livro">📜</span>'; }
    else if (pers) {
      nome = pers.nome;
      retrato = '<img src="assets/historia/' + f.quem + '.webp" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'fala-inicial\',textContent:\'' + pers.nome.replace(/^(Mestre |O Homem de )/, '').charAt(0) + '\'}))">';
    } else if (monstro) { nome = monstro.nome; retrato = F.imagemMonstro(f.quem); }
    else { nome = f.quem; retrato = ''; }
    return '<div class="fala' + (f.quem === 'narrador' ? ' fala-narrador' : '') + '"><div class="fala-retrato">' + retrato + '</div>'
      + '<div class="fala-texto"><strong>' + esc(nome) + '</strong><p>' + esc(f.texto) + '</p></div></div>';
  }
  function abaHistoria() {
    var p = estado.personagem, H = D.HISTORIA, e = R.historiaEstado(p), h = p.historia || {};
    var marcas = H.capitulos.map(function (c, i) {
      var cl = i < (e.fim ? H.capitulos.length : e.indice) ? 'feito' : !e.fim && i === e.indice ? 'atual' : '';
      return '<span class="hist-marca ' + cl + '" title="' + (i + 1) + '. ' + c.titulo + '">' + (i + 1) + '</span>';
    }).join('');
    var topo = '<div class="hist-topo"><div><h2>' + H.nome + '</h2><p class="suave">' + H.subtitulo + '</p></div>'
      + '<div class="hist-marcas">' + marcas + '</div></div>';
    var corpo;
    if (e.fim) {
      corpo = '<div class="hist-capitulo"><h3>A Crônica terminou</h3><p>Os sete selos estão fechados e Eldrin descansa… por enquanto.'
        + ' Uma oitava marca brilha no mapa, além do mar.</p>' + (p.titulo ? '<p>Seu título: <span class="titulo-heroi">' + esc(p.titulo) + '</span></p>' : '') + '</div>';
    } else {
      var c = e.capitulo;
      var objetivos = e.objetivos.map(function (x) {
        return '<li class="' + (x.ok ? 'ok' : '') + '"><span class="hist-check">' + (x.ok ? '✔' : '') + '</span><span>' + textoObjetivo(x.objetivo) + '</span>'
          + '<span class="hist-num">' + x.feito + '/' + x.meta + '</span>'
          + '<span class="hist-barra"><i style="width:' + Math.round(100 * x.feito / x.meta) + '%"></i></span></li>';
      }).join('');
      var acao = !e.liberado ? '<p class="aviso-nivel">🔒 Este capítulo começa no level ' + e.nivel + ' (quando ' + nomeArea(c.area) + ' liberar). Continue caçando!</p>'
        : !e.visto ? '<button class="btn" data-acao="historia-ver">📜 Ler a abertura do capítulo</button>'
        : e.completo ? '<button class="btn hist-concluir" data-acao="historia-concluir">Concluir capítulo e receber o prêmio</button>'
        : '<button class="btn secundario" data-acao="historia-ver">Reler a abertura</button>';
      corpo = '<div class="hist-capitulo"><div class="suave pequeno">Capítulo ' + (e.indice + 1) + ' de ' + e.total + ' · ' + nomeArea(c.area) + '</div>'
        + '<h3>' + c.titulo + '</h3>'
        + (e.visto ? falaHtml(c.abertura[c.abertura.length - 1]) : '<p class="suave">Um novo capítulo espera por você.</p>')
        + (e.liberado && e.visto ? '<h4>Objetivos</h4><ul class="hist-objetivos">' + objetivos + '</ul>' : '')
        + '<p class="suave pequeno">Prêmio: ' + R.premioHistoriaTexto(p, c.premio || {}) + '</p>'
        + '<div class="botoes">' + acao + '</div></div>';
    }
    var lidos = (h.lidos || []).map(function (id) {
      var i = H.capitulos.map(function (c) { return c.id; }).indexOf(id), c = H.capitulos[i];
      return c ? '<button class="btn secundario btn-mini" data-acao="historia-reler" data-valor="' + i + '">' + (i + 1) + '. ' + c.titulo + '</button>' : '';
    }).join('');
    return topo + corpo + (lidos ? '<h3 class="subtitulo">Capítulos concluídos</h3><div class="hist-lidos">' + lidos + '</div>' : '')
      + '<p class="suave pequeno">A História não trava nada: as regiões continuam liberando pelo level. Os objetivos só contam no capítulo atual.</p>';
  }
  // Prêmios de login (D.LOGIN): a semana de boas-vindas (7, só uma vez) e a trilha de 30 dias, com o botão de pegar o do dia.
  function loginHtml() {
    var p = estado.personagem, L = D.LOGIN, e = R.loginEstado(p, C.agora()), res = estado.loginResultado;
    var icone = function (pr, d) { return pr.item ? '⚔' : d === 7 ? '🎁' : pr.pergaminho ? '📜' : pr.reputacao ? '⭐' : '🪙'; };
    var semana = '';
    if (e.boasVindas || (res && res.semana)) {
      var hojeS = e.pode ? e.proxSemana : 0;
      semana = '<h3>Semana de boas-vindas <span class="suave pequeno">' + e.semana + '/7 · só uma vez</span></h3><div class="login-roda">' + L.semana.map(function (pr, i) {
        var d = i + 1, cl = d === hojeS ? ' hoje' : d <= e.semana ? ' feito' : '';
        return '<div class="login-dia' + cl + (d === 7 ? ' grande' : '') + '"><small>Dia ' + d + '</small><span class="login-dia-ico">' + (cl === ' feito' ? '✔' : icone(pr, d)) + '</span>'
          + '<span class="login-dia-premio">' + esc(R.premioLoginTexto(p, pr)) + '</span></div>';
      }).join('') + '</div>';
    } else semana = '<p class="suave pequeno">✔ Semana de boas-vindas concluída.</p>';
    var trinta = e.pode && e.trinta === 30 ? 0 : e.trinta, marcos = Object.keys(L.trinta).map(Number);
    var trilha = '<div class="login-trilha"><div class="login-trilha-barra"><i style="width:' + Math.round(trinta * 100 / 30) + '%"></i>'
      + marcos.map(function (d) {
        return '<span class="login-marco' + (d <= trinta ? ' feito' : '') + (e.pode && d === e.proxTrinta ? ' hoje' : '') + '" style="left:' + (d * 100 / 30) + '%">' + d + '</span>';
      }).join('') + '</div></div>';
    var prox = marcos.filter(function (d) { return d > trinta; })[0] || 30;
    var rotulo = { semana: 'Boas-vindas · dia ', diario: 'Trilha · dia ', marco: 'Marco de ' };
    var h = '<div class="zoom-fundo login-fundo"><div class="zoom-janela login-janela" role="dialog" aria-label="Prêmios de login">'
      + '<button class="zoom-x" data-acao="login-fechar" title="Fechar">✕</button>'
      + '<h2>🗓 Prêmios de login</h2><p class="suave pequeno">Entre um dia, ganhe um prêmio. Os dias não precisam ser seguidos: pulou um, continua de onde parou.</p>'
      + semana
      + '<h3>Trilha de 30 dias <span class="suave pequeno">' + trinta + '/30 · recomeça no fim</span></h3>' + trilha
      + '<p class="login-prox">Todo login: <strong>' + esc(R.premioLoginTexto(p, L.diario)) + '</strong><br>Próximo marco: <strong>dia ' + prox + '</strong> · ' + esc(R.premioLoginTexto(p, L.trinta[prox])) + '</p>';
    if (res) h += '<div class="login-ganhou"><strong>Você recebeu:</strong>' + res.partes.map(function (x) {
      return '<div>' + rotulo[x.de] + x.dia + (x.de === 'marco' ? ' dias' : '') + ': <b>' + esc(x.texto) + '</b></div>';
    }).join('') + '</div>';
    h += '<div class="botoes">' + (e.pode ? '<button class="btn btn-iniciar" data-acao="login-pegar">🎁 Pegar o prêmio de hoje</button>'
      : '<button class="btn secundario" data-acao="login-fechar">Volte em ' + tempoTexto(R.msAteReset(C.agora())) + '</button>') + '</div></div></div>';
    return h;
  }
  function historiaCenaHtml() {
    var c = estado.historiaCena;
    return '<div class="zoom-fundo hist-fundo"><div class="zoom-janela hist-janela" role="dialog" aria-label="' + esc(c.titulo) + '">'
      + '<div class="suave pequeno">' + esc(c.rotulo || '') + '</div><h2>' + esc(c.titulo) + '</h2>'
      + '<div class="hist-falas">' + c.falas.map(falaHtml).join('') + '</div>'
      + (c.premio ? '<p class="hist-premio">🎁 Você recebeu: ' + esc(c.premio) + '</p>' : '')
      + '<div class="botoes"><button class="btn" data-acao="historia-fechar">' + (c.botao || 'Continuar') + '</button></div></div></div>';
  }

  function abaMasmorra() {
    var g = estado.gm, p = estado.personagem;
    if (!g) { carregarGrupo(); return '<p class="suave">' + (estado.gmErro ? esc(estado.gmErro) : 'Carregando…') + '</p>'; }
    if (g.local) return '<p class="suave">As masmorras são em grupo de 3 e precisam do servidor: jogue pelo site do ' + D.NOME_JOGO + ' para entrar com seus amigos.</p>';
    var M = D.MASMORRA, restam = M.entradasPorDia - g.entradas;
    var html = (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '') + '<p class="suave">Grupo de 3, luta automática. A vida da masmorra é separada: morrer lá não tira vida nem exp. '
      + 'Vitória: cada um ganha um <strong>colar ou anel</strong>, a única forma de conseguir joias, e tem ' + M.pergaminho
      + '% de chance de ganhar um <strong>pergaminho de encantamento</strong>. Derrota não gasta entrada.</p>' + (CELULAR ? '</details>' : '')
      + '<div class="secao ouro entradas-masmorra"><span>Entradas hoje</span><strong>' + restam + '/' + M.entradasPorDia + '</strong></div>';
    if (g.convites.length) html += '<h3 class="subtitulo">Convites para grupo</h3><div class="itens">' + g.convites.map(function (c) {
      return '<div class="item"><div><strong>' + esc(c.de) + '</strong> convidou você <span class="suave">(' + c.membros + '/3 no grupo)</span></div>'
        + '<div class="item-acoes"><button class="btn" data-acao="grupo-aceitar" data-convite="' + c.id + '">Aceitar</button>'
        + '<button class="btn secundario" data-acao="grupo-recusar" data-convite="' + c.id + '">Recusar</button></div></div>';
    }).join('') + '</div>';
    var gr = g.grupo;
    if (!gr && g.fila) {
      var fm = R.masmorra(g.fila.masmorra), espera = Math.max(0, Math.round((Date.parse(g.fila.agora) - Date.parse(g.fila.entrou_em)) / 1000));
      return html + '<div class="secao fila-masmorra"><h3 class="subtitulo">Na fila: ' + esc(fm.nome) + '</h3>'
        + '<p>Esperando há <strong>' + espera + ' s</strong> · <strong>' + g.fila.jogadores + '/' + M.tamanhoGrupo + '</strong> jogadores nesta masmorra.</p>'
        + '<p class="suave pequeno">' + (espera < 30 ? 'Se em 30 s não aparecerem 3 jogadores, mercenários (bots com o mesmo poder do grupo) completam as vagas.'
          : 'Chamando mercenários para completar o grupo…') + ' Os mercenários não ganham prêmio nem gastam entrada.</p>'
        + '<div class="botoes"><button class="btn perigo" data-acao="fila-sair">Sair da fila</button></div></div>' + listaMasmorras(null, false);
    }
    if (!gr) return html + '<p class="suave">Você não está num grupo. Entre na <strong>fila</strong> de uma masmorra abaixo para jogar com outros jogadores sem grupo '
      + '(em 30 s sem completar, mercenários entram junto), ou na aba <strong>Social</strong> use "Convidar para o grupo" num amigo.</p>'
      + listaMasmorras(null, false, restam > 0);
    var souLider = gr.lider === p.id, eu = gr.membros.find(function (m) { return m.id === p.id; }) || {};
    var vagas = [];
    for (var i = 0; i < M.tamanhoGrupo; i++) {
      var m = gr.membros[i];
      if (!m) { vagas.push('<div class="mas-vaga vazia">Vaga livre' + (gr.convidados[i - gr.membros.length] ? '<div class="suave pequeno">Convidado: ' + esc(gr.convidados[i - gr.membros.length]) + '</div>' : '') + '</div>'); continue; }
      vagas.push('<div class="mas-vaga' + (m.pronto ? ' pronto' : '') + '"><div class="moldura">' + F.personagem(m.raca, classeRetrato(m), m.sexo) + '</div>'
        + '<div><strong>' + (m.id === gr.lider ? '👑 ' : '') + esc(m.nome) + '</strong></div>'
        + '<div class="suave pequeno">' + nomeClasseX(m) + ' · Lv ' + m.nivel + ' · entradas ' + (M.entradasPorDia - m.entradas) + '/' + M.entradasPorDia + '</div>'
        + '<div class="' + (m.pronto ? 'online' : 'suave') + ' pequeno">' + (m.pronto ? '✔ Pronto' : 'Aguardando') + '</div>'
        + (souLider && m.id !== p.id ? '<button class="btn secundario mini-opcao" data-acao="grupo-expulsar" data-id="' + esc(m.id) + '">Expulsar</button>' : '') + '</div>');
    }
    var mm = gr.masmorra ? R.masmorra(gr.masmorra) : null;
    var todosProntos = gr.membros.length === M.tamanhoGrupo && gr.membros.every(function (m) { return m.pronto; });
    html += '<h3 class="subtitulo">Seu grupo (' + gr.membros.length + '/' + M.tamanhoGrupo + ')</h3><div class="mas-vagas">' + vagas.join('') + '</div>'
      + '<div class="botoes">' + (eu.pronto
        ? '<button class="btn secundario" data-acao="grupo-pronto" data-valor="nao">Não estou pronto</button>'
        : '<button class="btn" data-acao="grupo-pronto" data-valor="sim"' + (mm ? '' : ' disabled title="O líder precisa escolher a masmorra"') + '>Estou pronto</button>')
      + (souLider ? '<button class="btn" data-acao="masmorra-entrar"' + (mm && todosProntos ? '' : ' disabled') + '>Entrar na masmorra</button>' : '')
      + '<button class="btn perigo" data-acao="grupo-sair">Sair do grupo</button></div>'
      + '<p class="suave pequeno">' + (!mm ? (souLider ? 'Escolha a masmorra abaixo.' : 'Esperando o líder escolher a masmorra.')
        : !todosProntos ? 'Masmorra: <strong>' + esc(mm.nome) + '</strong>. Faltam todos ficarem prontos (3/3).'
        : souLider ? 'Tudo pronto! Clique em "Entrar na masmorra".' : 'Tudo pronto! Esperando o líder entrar.') + '</p>';
    return html + listaMasmorras(gr.masmorra, souLider);
  }

  // fila: mostra "Entrar na fila" nas masmorras liberadas (quem está sem grupo e com entrada).
  function listaMasmorras(escolhida, souLider, fila) {
    var p = estado.personagem;
    return '<h3 class="subtitulo">Masmorras</h3><div class="mas-lista">' + D.masmorras.map(function (mm) {
      var area = D.areas.find(function (a) { return a.id === mm.area; });
      var bloqueada = p.nivel < mm.nivelMin;
      return '<div class="mas-card' + (mm.id === escolhida ? ' selecionada' : '') + (bloqueada ? ' bloqueada' : '') + '">'
        + '<div class="mas-card-topo"><strong>' + (bloqueada ? '🔒 ' : '') + esc(mm.nome) + '</strong><span class="suave">Level ' + mm.nivelMin + '+</span></div>'
        + '<div class="suave pequeno">' + area.monstros.map(function (m) { return m.nome; }).join(', ') + ' · Elite: ' + esc(mm.elite) + ' · Chefe: ' + esc(mm.chefe) + '</div>'
        + '<div class="pequeno">Joia: ' + textoDrops(mm.joias) + ' · Pergaminho: ' + D.MASMORRA.pergaminho + '%</div>'
        + (souLider ? (mm.id === escolhida ? '<div class="online pequeno">✔ Escolhida</div>'
          : '<button class="btn secundario mini-opcao" data-acao="grupo-escolher" data-valor="' + mm.id + '">Escolher</button>') : '')
        + (fila && !bloqueada ? '<button class="btn mini-opcao" data-acao="fila-entrar" data-valor="' + mm.id + '">Entrar na fila</button>' : '')
        + '</div>';
    }).join('') + '</div>';
  }

  // Atualiza o grupo: a cada 4 s na aba Masmorra ou em grupo; senão a cada 30 s (convites).
  var ciclosGrupo = 0;
  setInterval(function () {
    if (!estado.personagem || estado.batalha || estado.luta || estado.lutaArena || document.hidden) return;
    ciclosGrupo++;
    var emGrupo = estado.gm && (estado.gm.grupo || estado.gm.fila);
    if (estado.aba === 'masmorra' || emGrupo || ciclosGrupo % 8 === 0) carregarGrupo();
    // Boss da aliança: a cada 4 s na tela dele ou com o boss aberto; senão a cada 32 s (aviso e prêmios).
    if (estado.aba === 'oficinas' && ciclosGrupo % 2 === 0 && !estado.contratar) carregarOficinas();
    var bossAberto = estado.bossAl && estado.bossAl.boss && estado.bossAl.boss.estado === 'aberto';
    if ((estado.aba === 'alianca' && estado.aliancaVista === 'boss') || bossAberto || ciclosGrupo % 8 === 6) carregarBossAl();
    if (!estado.lutaArena && (ciclosGrupo % 8 === 4 || (estado.aba === 'arena' && ciclosGrupo % 3 === 0))) carregarArena();
  }, 4000);

  // ---------------- Aventura › Mineração (Henri, nov/2026) ----------------
  // Escolhe o tempo e a mina no mapa (janelinha com o drop e a média), Minerar / Parar de Minerar e histórico.
  // Minerando, o herói não caça nem luta na Arena (R.minerando).
  function tempoMinas(min) { return min >= 60 ? (min / 60) + ' h' : min + ' min'; }
  function bloqueadoMinerando(acao) {
    var p = estado.personagem;
    if (!p) return false;
    if (naFilaMasmorra(acao)) return true;
    if (!R.minerando(p, C.agora())) return false;
    avisar('⛏ Seu herói está minerando: pare a mineração (Aventura › Mineração) para ' + acao + '.');
    return true;
  }
  // Na fila da masmorra não dá para caçar, minerar nem lutar na Arena: tem que sair da fila antes (Henri, 13/11/2026).
  function naFilaMasmorra(acao) {
    var f = estado.gm && estado.gm.fila;
    if (!f) return false;
    var m = R.masmorra(f.masmorra);
    avisar('⏳ Você está na fila' + (m ? ' de ' + m.nome : ' da masmorra') + ': saia da fila (Aventura › Masmorra) para ' + acao + '.');
    return true;
  }
  function janelaMinaHtml(area, e) {
    var p = estado.personagem, CR = D.CRAFT, mat = CR.materiais[R.materialDaArea(area.id)], op = estado.minasTempo;
    var md = R.mediaMinas(p, op), o = CR.minas.opcoes[op];
    var x = Math.max(16, Math.min(84, e.x)), baixo = e.y < 45;
    return '<div class="mina-janela' + (baixo ? ' baixo' : ' cima') + '" style="left:' + x + '%;top:' + e.y + '%">'
      + '<button class="mina-fechar" data-acao="minas-fechar" aria-label="Fechar">✕</button>'
      + '<div class="mina-titulo">' + esc(area.nome) + '</div>'
      + '<div class="mina-drop">' + iconeConsumivel({ tipo: 'material', raridade: R.materialDaArea(area.id) }) + ' ' + esc(mat.nome) + '</div>'
      + '<div class="mina-drop">' + iconeConsumivel({ tipo: 'material', raridade: 'gema' }) + ' Pedra Preciosa <span class="suave">(' + CR.minas.gemaPct + '% de cada unidade)</span></div>'
      + '<div class="mina-media">Em ' + tempoMinas(o.minutos) + ', em média: <strong>' + md.qtd.toLocaleString('pt-BR') + '</strong> ' + esc(mat.nome)
      + ' e <strong>' + md.gemas.toLocaleString('pt-BR') + '</strong> Pedra Preciosa' + (R.ehColetor(p) ? ' <span class="mais">(+' + CR.coletorBonus + '% Coletor)</span>' : '') + '</div></div>';
  }
  function abaMineracao() {
    var p = estado.personagem, CR = D.CRAFT, agora = C.agora(), mi = p.minas;
    if (estado.minasTempo == null) estado.minasTempo = 1;
    var h = '<h3 class="subtitulo">⛏ Mineração</h3>' + (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '')
      + '<p class="suave pequeno">Escolha quanto tempo minerar e a mina no mapa. '
      + 'Enquanto minera, seu herói não pode caçar nem lutar na Arena. Parar antes do fim: com ' + CR.minas.metadeDesde
      + '% do tempo ou mais, você leva metade do prêmio; antes disso, nada.</p>' + (CELULAR ? '</details>' : '');
    if (mi) {
      var area = D.areas.filter(function (a) { return a.id === mi.area; })[0], mat = CR.materiais[R.materialDaArea(mi.area)];
      var total = mi.fim - mi.inicio, feito = Math.min(total, Math.max(0, agora - mi.inicio)), pct = Math.round(feito * 100 / total);
      var acabou = agora >= mi.fim;
      h += '<div class="caixa-interna mina-andamento"><div><strong>' + (acabou ? 'Mineração terminou!' : 'Minerando') + '</strong> ' + esc(mat.nome) + ' em '
        + esc(area ? area.nome : mi.area) + ' · ' + tempoMinas(mi.minutos || Math.round(total / 60000)) + '</div>'
        + barra('exp', feito, total, acabou ? 'Pronto' : '<span id="minas-relogio">' + relogioTexto(mi.fim - agora) + '</span>')
        + (acabou ? '' : '<p class="pequeno ' + (pct >= CR.minas.metadeDesde ? 'mais' : 'menos') + '">'
          + (pct >= CR.minas.metadeDesde ? 'Se parar agora, leva metade do prêmio.' : 'Se parar agora, não leva nada (ainda não chegou a ' + CR.minas.metadeDesde + '% do tempo).') + '</p>')
        + (acabou ? '<div class="botoes"><button class="btn" data-acao="minas-recolher">Recolher</button></div>' : '') + '</div>';
    }
    var soAndamento = CELULAR && mi;   // no celular, minerando: só o andamento e o "Parar" (o resto fica apagado mesmo)
    if (!soAndamento) h += (CELULAR ? '<div class="minas-rotulo">⏳ Quanto tempo</div>' : '') + '<div class="minas-tempos">' + CR.minas.opcoes.map(function (o, i) {
      return '<button class="btn secundario btn-pequeno" data-acao="minas-tempo" data-valor="' + i + '" aria-pressed="' + (estado.minasTempo === i) + '"'
        + (mi ? ' disabled' : '') + '>' + tempoMinas(o.minutos) + '</button>';
    }).join('') + '</div>';
    var janela = '';
    var nos = D.areas.map(function (a, i) {
      var e = estiloArea(a, i), livre = p.nivel >= a.nivelMin, esc_ = estado.minasArea === a.id;
      if (esc_ && livre) janela = janelaMinaHtml(a, e);
      var depois = CELULAR && esc_ && livre ? janela : '';
      return '<button class="mapa-no' + (livre ? '' : ' bloqueada') + (esc_ ? ' escolhida' : '') + '" style="left:' + e.x + '%;top:' + e.y + '%;--cor:' + e.cor + '"'
        + (livre ? ' data-acao="minas-area" data-valor="' + a.id + '"' : ' disabled') + ' title="' + esc(CR.materiais[R.materialDaArea(a.id)].nome) + '">'
        + '<span class="mapa-icone' + (livre && ESTILO_AREA[a.id] ? ' com-arte' : '') + '">' + (livre ? iconeArea(a, 'arte') : '🔒') + '</span>'
        + '<span class="mapa-nome">' + a.nome + '</span><span class="mapa-nivel">' + (livre ? esc(CR.materiais[R.materialDaArea(a.id)].nome) : 'Libera no level ' + a.nivelMin) + '</span></button>' + depois;
    }).join('');
    if (!soAndamento) h += (CELULAR ? '<div class="minas-rotulo">⛰ Onde minerar</div>' : '') + '<div class="mapa-mundo mapa-minas">' + nos + (CELULAR ? '' : janela) + '</div>';
    var escolhida = D.areas.filter(function (a) { return a.id === estado.minasArea && p.nivel >= a.nivelMin; })[0];
    if (!(soAndamento && agora >= mi.fim)) h += '<div class="botoes minas-acoes">' + (soAndamento ? '' : '<button class="btn btn-iniciar" data-acao="minas-iniciar"' + (mi || !escolhida ? ' disabled' : '') + '>⛏ Minerar'
      + (escolhida ? ' em ' + esc(escolhida.nome) + ' (' + tempoMinas(CR.minas.opcoes[estado.minasTempo].minutos) + ')' : '') + '</button>')
      + (CELULAR && !(mi && agora < mi.fim) ? '' : '<button class="btn perigo" data-acao="minas-parar"' + (mi && agora < mi.fim ? '' : ' disabled') + '>Parar de Minerar</button>') + '</div>'
      + (escolhida || mi ? '' : '<p class="suave pequeno">' + (CELULAR ? 'Toque' : 'Clique') + ' numa mina do mapa para escolher onde minerar.</p>');
    var hist = p.historicoMinas || {}, linhas = D.areas.filter(function (a) { return hist[a.id]; }).map(function (a) {
      var r = hist[a.id];
      return '<tr><td>' + esc(a.nome) + '</td><td>' + (r.minutos / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h</td><td>'
        + r.qtd.toLocaleString('pt-BR') + ' ' + esc(CR.materiais[R.materialDaArea(a.id)].nome) + '</td><td>' + r.gemas.toLocaleString('pt-BR') + '</td><td>' + r.vezes + '</td></tr>';
    }).join('');
    if (CELULAR && linhas) linhas = '<div class="minas-hist">' + D.areas.filter(function (a) { return hist[a.id]; }).map(function (a) {
      var r = hist[a.id], m = CR.materiais[R.materialDaArea(a.id)];
      return '<div class="minas-hist-linha">' + iconeConsumivel({ tipo: 'material', raridade: R.materialDaArea(a.id) }) + '<div><strong>' + esc(a.nome) + '</strong>'
        + '<small class="suave">' + (r.minutos / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h · ' + r.vezes + (r.vezes === 1 ? ' vez' : ' vezes') + '</small></div>'
        + '<div class="minas-hist-ganho"><span>' + r.qtd.toLocaleString('pt-BR') + ' ' + esc(m.nome) + '</span><small>💎 ' + r.gemas.toLocaleString('pt-BR') + ' Pedra(s)</small></div></div>';
    }).join('') + '</div>';
    h += '<h3 class="subtitulo">Histórico de mineração</h3>' + (CELULAR && linhas ? linhas : linhas
      ? '<table class="boss-rank"><tr><th>Mina</th><th>Tempo minerado</th><th>Minério recebido</th><th>Pedras Preciosas</th><th>Vezes</th></tr>' + linhas + '</table>'
      : '<p class="suave">Você ainda não minerou.</p>');
    return h;
  }
  function avisoMinas(rc, parou) {
    if (typeof rc === 'string') { avisar(rc); return; }
    var nome = D.CRAFT.materiais[rc.material].nome;
    if (parou && rc.parcial && !rc.metade) { avisar('Mineração interrompida antes da metade: nada foi minerado.'); return; }
    avisar('⛏ ' + (rc.metade ? 'Você parou na metade e levou metade: ' : 'Você minerou ') + rc.qtd + ' ' + nome
      + (rc.gemas ? ' e ' + rc.gemas + ' Pedra(s) Preciosa(s)!' : '!'), 'item');
  }
  // Relógio da mineração (1 s) e aviso quando termina.
  setInterval(function () {
    var p = estado.personagem;
    if (!p || !p.minas) return;
    var falta = p.minas.fim - C.agora(), r = document.getElementById('minas-relogio');
    if (r) r.textContent = relogioTexto(falta);
    if (falta <= 0 && estado.minasAvisada !== p.minas.fim) {
      estado.minasAvisada = p.minas.fim;
      avisar('⛏ A mineração terminou! Recolha em Aventura › Mineração.', 'item');
      if (estado.aba === 'mineracao' && !estado.batalha) telaJogo();
    }
  }, 1000);

  // ---------------- Chefe Mundial: "O Despertar de Ignaroth" ----------------
  // Todo dia às 20h por 1 hora. A vida é uma só para o reino (servidor). Cada ataque é uma luta normal contra o chefe
  // da área do herói (mesmo dano e defesa), com no máximo D.CHEFE_MUNDIAL.acoesPorAtaque ações; o dano vai ao servidor.
  function bossAgora() { return Date.now() + (estado.bossDif || 0); }
  function bossAtivo() {
    var e = estado.boss, b = e && e.boss;
    return !!(b && b.estado === 'ativo' && bossAgora() < Date.parse(b.fim) && bossAgora() >= Date.parse(b.inicio));
  }
  function relogioBoss(ms) {
    var t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sg = t % 60;
    return (h ? h + 'h ' : '') + (h || m ? m + 'min ' : '') + (h ? '' : sg + 's');
  }
  function carregarBoss() {
    var p = estado.personagem;
    if (!p || estado.bossCarregando) return;
    estado.bossCarregando = true;
    C.boss.estado(p.id).then(function (r) {
      estado.bossCarregando = false;
      if (estado.personagem !== p) return;
      if (!r || r.local) { estado.boss = r; atualizarBoss(); return; }
      var antes = estado.boss && estado.boss.boss;
      if (r.agora) estado.bossDif = Date.parse(r.agora) - Date.now();
      estado.boss = r;
      if (antes !== undefined && r.boss && (!antes || antes.id !== r.boss.id) && bossAtivo()) avisar('🐉 A terra treme… Ignaroth despertou!', 'nivel');
      if (r.recompensas && r.recompensas.length && !estado.batalha) resgatarRecompensas(r.recompensas);
      atualizarBoss();
    }, function (e) { estado.bossCarregando = false; estado.bossErro = e.message; });
  }
  // Atualiza só a barra do topo e o painel (sem redesenhar a tela, para não atrapalhar uma luta).
  function atualizarBoss() {
    var topoEl = document.getElementById('boss-barra');
    if (topoEl) topoEl.innerHTML = bossBarraHtml();
    var painel = document.getElementById('boss-painel');
    if (painel && estado.aba === 'mundial' && !estado.batalha) painel.innerHTML = bossPainelHtml();
  }
  function vidaBossTexto(b) { return Number(b.vida).toLocaleString('pt-BR') + ' / ' + Number(b.vida_max).toLocaleString('pt-BR'); }
  function bossBarraHtml() {
    if (!bossAtivo() || (estado.aba === 'mundial' && !estado.batalha)) return '';
    var b = estado.boss.boss;
    return '<button class="boss-topo" data-acao="aba" data-aba="mundial" title="Abrir Chefe Mundial">'
      + '<span class="boss-topo-nome">🐉 Ignaroth despertou!</span>'
      + barra('hp boss', b.vida, b.vida_max, vidaBossTexto(b))
      + '<span class="boss-topo-tempo">' + relogioBoss(Date.parse(b.fim) - bossAgora()) + '</span></button>';
  }
  function abaMundial() {
    if (!estado.boss) carregarBoss();
    return '<div id="boss-painel">' + bossPainelHtml() + '</div>';
  }
  function bossPainelHtml() {
    var e = estado.boss, p = estado.personagem, CM = D.CHEFE_MUNDIAL;
    if (!e) return '<p class="suave">Procurando sinais de Ignaroth…</p>';
    if (e.local) return '<p class="suave">O Chefe Mundial precisa do servidor: jogue pelo site do Eldrin.</p>';
    var b = e.boss, ativo = bossAtivo(), chefe = D.monstros[R.chefeDoNivel(p)], cfg = e.cfg || {};
    var entradasBoss = cfg.entradas || CM.entradas, usadas = ativo && e.eu ? e.eu.ataques : 0;
    var h = '<div class="boss-cabeca"><div class="moldura boss-arte">' + F.imagemMonstro('ignaroth-mundial') + '</div><div>'
      + '<h2>O Despertar de Ignaroth</h2>' + (CELULAR ? '<div class="boss-hora">🕗 Todo dia às ' + cfg.hora + 'h · 1 hora · ' + entradasBoss + ' ataques</div><details class="regras-celular"><summary>Como funciona</summary>' : '')
      + '<p class="suave">Todo dia às ' + cfg.hora + 'h (Brasília), por 1 hora, Ignaroth desperta com uma vida só '
      + 'para o reino inteiro. Cada ataque é uma luta contra a força de <strong>' + chefe.nome + '</strong> (o chefe da sua área), '
      + 'com até ' + CM.acoesPorAtaque + ' ações suas. Você tem <strong>' + entradasBoss + ' ataques</strong> por despertar; a vida começa cheia em cada um e não dá para usar poção.</p>' + (CELULAR ? '</details>' : '') + '</div></div>';
    if (ativo) {
      var podeAtacar = !estado.cacada && usadas < entradasBoss;
      h += '<div class="boss-vida">' + barra('hp boss', b.vida, b.vida_max, vidaBossTexto(b))
        + '<div class="suave">Volta a dormir em <strong>' + relogioBoss(Date.parse(b.fim) - bossAgora()) + '</strong></div></div>'
        + '<div class="botoes"><button class="btn perigo" data-acao="boss-atacar"' + (podeAtacar ? '' : ' disabled') + '>⚔ Atacar Ignaroth (' + Math.max(0, entradasBoss - usadas) + '/' + entradasBoss + ')</button></div>'
        + (estado.cacada ? '<p class="menos">Pare a caçada para atacar.</p>' : !podeAtacar ? '<p class="menos">Você já usou os ' + entradasBoss + ' ataques deste despertar.</p>' : '');
    } else if (b && b.estado === 'derrotado') {
      h += '<div class="resultado vitoria-chefe"><h3>Ignaroth caiu!</h3><p>Golpe final: <strong>' + esc(b.golpe_final || '?') + '</strong> (título "' + esc(cfg.titulo) + '").'
        + (b.alianca_vencedora ? ' O clã <strong>' + esc(b.alianca_vencedora) + '</strong> ganhou ' + Number(b.bonus_alianca || 0).toLocaleString('pt-BR') + ' de ouro no tesouro.' : '')
        + '</p></div>';
    } else if (b && b.estado === 'dormindo') {
      h += '<div class="resultado derrota"><h3>Ignaroth voltou a dormir</h3><p>O reino não conseguiu derrubá-lo a tempo. Quem atacou ganhou o prêmio de consolação.</p></div>';
    }
    if (CELULAR && !ativo && e.proximo) h += '<div class="boss-proximo"><small>Próximo despertar em</small><strong>' + relogioBoss(Date.parse(e.proximo) - bossAgora()) + '</strong></div>';
    else if (!ativo && e.proximo) h += '<p class="destaque">Próximo despertar em <strong>' + relogioBoss(Date.parse(e.proximo) - bossAgora()) + '</strong>.</p>';
    if (estado.bossUltimo) {
      var u = estado.bossUltimo;
      h += '<p class="' + (u.erro ? 'menos' : 'destaque') + '">' + (u.erro ? esc(u.erro) : 'Seu último ataque: <strong>' + Number(u.dano).toLocaleString('pt-BR') + '</strong> de dano'
        + (u.golpeFinal ? ' — <strong>GOLPE FINAL!</strong> Você é o novo "' + esc(cfg.titulo) + '"!' : '.')) + '</p>';
    }
    if (CELULAR && e.eu) h += '<div class="boss-eu"><span><b>' + Number(e.eu.dano).toLocaleString('pt-BR') + '</b><small>seu dano</small></span><span><b>' + e.eu.posicao + 'º</b><small>lugar</small></span>'
      + '<span><b>' + e.eu.ataques + '/' + entradasBoss + '</b><small>ataques</small></span></div>';
    else if (e.eu) h += '<p>Seu dano: <strong>' + Number(e.eu.dano).toLocaleString('pt-BR') + '</strong> em ' + e.eu.ataques + ' ataque(s) · ' + e.eu.posicao + 'º lugar</p>';
    var linhas = (e.top || []).map(function (t, i) {
      return '<tr' + (t.eu ? ' class="eu"' : '') + '><td>' + (i + 1) + 'º</td><td>' + siglaHtml(t.sigla) + esc(t.nome) + '</td><td>'
        + Number(t.dano).toLocaleString('pt-BR') + '</td><td>' + t.ataques + '</td></tr>';
    }).join('');
    if (CELULAR) linhas = (e.top || []).map(function (t, i) {
      return '<div class="boss-linha' + (t.eu ? ' eu' : '') + (i < 3 ? ' top' + (i + 1) : '') + '"><span class="boss-pos">' + (i + 1) + 'º</span><span class="boss-nome"><span>' + siglaHtml(t.sigla) + esc(t.nome) + '</span>'
        + '<small class="suave">' + t.ataques + ' ataque(s)</small></span><b>' + Number(t.dano).toLocaleString('pt-BR') + '</b></div>';
    }).join('');
    if (CELULAR) h += '<h3>Ranking de dano (top 10)</h3>' + (linhas ? '<div class="boss-lista">' + linhas + '</div>' : '<p class="suave">Ninguém atacou ainda.</p>');
    else h += '<h3>Ranking de dano (top 10)</h3>' + (linhas ? '<table class="boss-rank"><tr><th></th><th>Herói</th><th>Dano</th><th>Ataques</th></tr>' + linhas + '</table>'
      : '<p class="suave">Ninguém atacou ainda.</p>');
    var al = (e.aliancas || []).map(function (a, i) {
      return '<tr><td>' + (i + 1) + 'º</td><td>' + siglaHtml(a.sigla) + esc(a.nome) + '</td><td>' + Number(a.dano).toLocaleString('pt-BR') + '</td></tr>';
    }).join('');
    if (CELULAR) al = (e.aliancas || []).map(function (a, i) {
      return '<div class="boss-linha"><span class="boss-pos">' + (i + 1) + 'º</span><span class="boss-nome"><span>' + siglaHtml(a.sigla) + esc(a.nome) + '</span></span><b>' + Number(a.dano).toLocaleString('pt-BR') + '</b></div>';
    }).join('');
    if (CELULAR && al) h += '<h3>Clãs</h3><div class="boss-lista">' + al + '</div>';
    else if (al) h += '<h3>Clãs</h3><table class="boss-rank"><tr><th></th><th>Clã</th><th>Dano</th></tr>' + al + '</table>';
    h += (CELULAR ? '<details class="regras-celular boss-premios-gaveta"><summary>🏆 Prêmios</summary>' : '<h3>Prêmios</h3>') + '<ul class="boss-premios">'
      + '<li>Se cair a tempo: todos que atacaram ganham o ouro e a exp de ' + esc(chefe.nome) + ' × número de ataques.</li>'
      + '<li>Top 10 de dano: ' + cfg.epica + '% de chance de item épico ou ' + cfg.lendaria + '% de lendário, e 1 pergaminho.</li>'
      + '<li>Golpe final: o título "' + esc(cfg.titulo) + '".</li>'
      + '<li>Clã com mais dano: ' + cfg.aliancaPct + '% do dano dele em ouro no tesouro.</li>'
      + '<li>Se não cair: ' + cfg.consolacao + '% do ouro e da exp e 1 pergaminho para quem atacou.</li></ul>' + (CELULAR ? '</details>' : '');
    return h;
  }
  function atacarMundial() {
    var p = estado.personagem;
    if (!bossAtivo() || estado.batalha || estado.cacada) return;
    var maxBoss = (estado.boss.cfg || {}).entradas || D.CHEFE_MUNDIAL.entradas;
    if (estado.boss.eu && estado.boss.eu.ataques >= maxBoss) { avisar('Você já usou os ' + maxBoss + ' ataques deste despertar.'); return; }
    var espera = (estado.bossEnvio || 0) + ((estado.boss.cfg || {}).intervaloSeg || 15) * 1000 - Date.now();
    if (espera > 0) { avisar('Recupere o fôlego: ataque de novo em ' + Math.ceil(espera / 1000) + 's.'); return; }
    var bs = estado.boss.boss, chefeId = R.chefeDoNivel(p);
    var b = R.iniciarBatalha(p, chefeId, null, { mundial: true });   // vida cheia, sem poção, não gasta estamina
    b.mundial = { bossId: bs.id, vidaInicial: bs.vida, chefe: chefeId, acoes: 0 };
    b.imagemId = 'ignaroth-mundial';
    b.monstro.nome = 'Ignaroth (Chefe Mundial)';
    b.monstro.hp = bs.vida;
    b.monstro.hpMax = bs.vida_max;
    estado.resultado = null;
    estado.bossUltimo = null;
    estado.batalha = b;
    estado.registro = [];
    linha('destaque', esc(p.nome) + ' avança contra Ignaroth!');
    telaJogo();
    mostrarPainel();
    agendar();
  }
  function encerrarMundial(b) {
    var p = estado.personagem;
    var dano = Math.max(0, b.mundial.vidaInicial - Math.max(0, b.monstro.hp));
    // cair aqui não tira exp, estamina nem poção
    estado.ultimaBatalha = b;
    estado.batalha = null;
    estado.aba = 'mundial';
    estado.bossUltimo = { dano: dano, enviando: true };
    estado.bossEnvio = Date.now();
    salvar();
    telaJogo();
    C.boss.atacar(p.id, dano, b.mundial.chefe).then(function (r) {
      estado.bossUltimo = { dano: r.dano, golpeFinal: r.golpe_final };
      if (r.golpe_final) avisar('🐉 GOLPE FINAL! Ignaroth caiu pelas suas mãos!', 'nivel');
      else avisar('Você causou ' + Number(r.dano).toLocaleString('pt-BR') + ' de dano em Ignaroth.', 'vitoria');
      carregarBoss();
      if (estado.aba === 'mundial' && !estado.batalha) telaJogo();
    }, function (e) {
      estado.bossUltimo = { erro: e.message };
      carregarBoss();
      if (estado.aba === 'mundial' && !estado.batalha) telaJogo();
    });
  }
  // A cada 5 s com Ignaroth acordado (ou na aba); senão a cada minuto. O relógio da barra anda a cada segundo.
  var ciclosBoss = 0;
  setInterval(function () {
    if (!estado.personagem || document.hidden || !document.querySelector('.ficha')) return;
    ciclosBoss++;
    var acordado = bossAtivo();
    if ((ciclosBoss % 5 === 0 && (acordado || estado.aba === 'mundial')) || ciclosBoss % 60 === 1) { carregarBoss(); return; }
    var bs = estado.boss && estado.boss.boss;
    if (!bs) return;
    if (bs.estado === 'ativo' && bossAgora() >= Date.parse(bs.fim)) { atualizarBoss(); return; }
    var t = document.querySelector('.boss-topo-tempo');
    if (t) t.textContent = relogioBoss(Date.parse(bs.fim) - bossAgora());
  }, 1000);

  // ---------------- Arena (PvP com D20) ----------------
  // O servidor calcula tudo (dados, dano, saque, ranking). Aqui só mostramos e animamos o D20.
  var A = D.ARENA;
  var TROFEU = { 1: 'ouro', 2: 'prata', 3: 'bronze' };

  function nomeArena(id) { var a = A.arenas.find(function (x) { return x.id === id; }); return a ? a.nome : ''; }
  function chaveVisto() { return 'tanka.arenaVisto.' + (estado.personagem ? estado.personagem.id : ''); }
  function vistoAte() { try { return Number(localStorage.getItem(chaveVisto())) || 0; } catch (e) { return 0; } }
  function ataquesNovos() {
    var ar = estado.arena;
    if (!ar || !ar.historico) return 0;
    var v = vistoAte();
    return ar.historico.filter(function (h) { return !h.ataquei && h.id > v; }).length;
  }
  function marcarAtaquesVistos() {
    var ar = estado.arena;
    if (!ar || !ar.historico || !ar.historico.length) return;
    try { localStorage.setItem(chaveVisto(), String(Math.max.apply(null, ar.historico.map(function (h) { return h.id; })))); } catch (e) { /* sem armazenamento */ }
  }
  function seloArena() { var n = ataquesNovos(); return n ? ' <span class="selo-pedidos">' + n + '</span>' : ''; }

  function carregarArena() {
    var p = estado.personagem;
    if (!p || estado.arenaCarregando) return;
    estado.arenaCarregando = true;
    C.arena.estado(p.id, estado.arenaVer).then(function (r) {
      estado.arenaCarregando = false;
      if (estado.personagem !== p) return;
      estado.arena = r;
      estado.arenaErro = null;
      if (!estado.arenaVer && r.minha_arena) estado.arenaVer = r.minha_arena;
      aplicarCreditos(r.creditos || []);
      if (estado.aba === 'arena') marcarAtaquesVistos();
      if (estado.batalha || estado.resultado || estado.chefeAviso || estado.luta || estado.lutaArena) return;
      if (estado.aba === 'arena') telaJogo();
      else {
        atualizarNav();
        atualizarFicha();
      }
    }, function (e) {
      estado.arenaCarregando = false;
      estado.arenaErro = e.message;
      if (estado.aba === 'arena' && !estado.lutaArena) telaJogo();
    });
  }

  // Ouro e reputação ganhos ou perdidos (Arena, jackpot) entram no personagem e o jogo salva.
  async function aplicarCreditos(lista) {
    var p = estado.personagem;
    if (!p || !lista.length || estado.aplicandoCreditos) return;
    estado.aplicandoCreditos = true;
    try {
      for (var i = 0; i < lista.length; i++) {
        var c = await C.arena.aplicarCredito(p.id, lista[i].id);
        p.ouro = Math.max(0, p.ouro + c.ouro);
        p.reputacao = Math.max(0, (p.reputacao || 0) + c.reputacao);
        salvar();
        var partes = [];
        if (c.ouro) partes.push((c.ouro > 0 ? '+' : '−') + Math.abs(c.ouro).toLocaleString('pt-BR') + ' de ouro');
        if (c.reputacao) partes.push('+' + c.reputacao + ' de reputação');
        avisar(c.motivo + ': ' + partes.join(' e ') + '.');
        if (!/^(Lance no leilão|Compra no mercado|Fundação do clã|Doação ao tesouro|Oficina: serviço pedido)/.test(c.motivo || '')) {
          caixaRegistrar(origemCredito(c.motivo), c.motivo + ': ' + partes.join(' e ') + '.');
        }
      }
    } catch (e) { /* tenta de novo na próxima atualização */ }
    estado.aplicandoCreditos = false;
    if (!estado.batalha && !estado.luta && !estado.lutaArena) {
      atualizarFicha();
    }
  }

  function trofeu(pos) {
    var cor = TROFEU[pos];
    if (!cor) return '<span class="pos-numero">' + pos + '</span>';
    return '<svg class="trofeu trofeu-' + cor + '" viewBox="0 0 24 24" aria-label="Trofeu de ' + cor + '"><path d="M7 3h10v3h3v2a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.6 13 5 5 0 0 1 4 8V6h3zM6 8a3 3 0 0 0 1.4 2.5A7 7 0 0 1 7 8zm11 0a7 7 0 0 1-.4 2.5A3 3 0 0 0 18 8z"/></svg>';
  }

  // ----- Perfil do adversário antes de desafiar -----
  // tipo: 'escada' (lista da Arena; o servidor decide se é para cima ou Top 5 para baixo) ou 'livre' (pelo Ranking).
  function abrirDesafio(id, tipo) {
    var p = estado.personagem;
    estado.desafio = { id: id, perfil: null, erro: null, tipo: tipo || 'escada' };
    if (tipo !== 'perfil' && !estado.arena) carregarArena();   // entradas e a minha posição (para mostrar a recompensa)
    telaJogo();
    C.arena.perfil(p.id, id).then(function (pf) {
      if (!estado.desafio || estado.desafio.id !== id) return;
      estado.desafio.perfil = pf;
      telaJogo();
    }, function (e) {
      if (!estado.desafio || estado.desafio.id !== id) return;
      estado.desafio.erro = e.message;
      telaJogo();
    });
  }
  // Monta um personagem com os dados do perfil para calcular os status com as mesmas regras do jogo.
  function personagemDoPerfil(pf) {
    var x = R.criarPersonagem(pf.nome, pf.sexo || 'masculino', pf.raca, pf.classe);
    x.nivel = pf.nivel;
    if (pf.atributos) x.atributos = pf.atributos;
    x.inventario = pf.itens || [];
    x.equipados = pf.equipados || {};
    return x;
  }
  // O que o ataque vale (o servidor confere): escada = posição + saque + reputação; Top 5 para baixo e Ranking não mudam posição.
  // Alvo numa arena abaixo = nada; mesma arena e alvo abaixo de você = metade da reputação; o ouro cai a cada repetição na semana.
  function recompensaDesafioHtml(pf, tipo, ouro, saque) {
    var ar = estado.arena, rep = A.reputacaoVitoria, minha = ar && ar.minha_arena, minhaPos = ar && ar.posicao;
    var ia = A.arenas.map(function (a) { return a.id; }).indexOf(minha), id = A.arenas.map(function (a) { return a.id; }).indexOf(pf.arena);
    var mesma = minha && pf.arena === minha, abaixo = mesma && minhaPos && pf.posicao > minhaPos;
    var escada = tipo !== 'livre' && mesma && !abaixo;
    var nada = !escada && minha && id >= 0 && ia >= 0 && id < ia;
    var repTxt = nada ? 0 : abaixo ? Math.floor(rep / 2) : rep;
    var linhas = [];
    if (nada) linhas.push('<span class="menos">Ele está numa arena abaixo da sua: vencendo, você <strong>não ganha reputação nem ouro</strong>.</span>');
    else {
      linhas.push('Ouro dele: <strong class="cor-ouro">' + ouro.toLocaleString('pt-BR') + '</strong> · se vencer, saque de <strong class="cor-ouro">' + saque + ' de ouro</strong>'
        + ' e <strong>+' + repTxt + ' de reputação</strong>' + (abaixo ? ' (metade: ele está abaixo de você)' : '')
        + (escada && pf.posicao === 1 ? ' e o <strong class="cor-ouro">jackpot</strong>' : '') + '.');
      linhas.push('<span class="suave pequeno">Atacar o mesmo personagem de novo na semana: o ouro cai pela metade a cada vez, até zerar (a reputação continua).</span>');
    }
    linhas.push('<span class="suave pequeno">' + (escada ? 'Vencendo, você toma a posição dele.' : 'Este ataque não muda a sua posição na Arena.')
      + ' Ele poderá revidar com uma revanche.</span>');
    return '<p class="desafio-ouro">' + linhas.join('<br>') + '</p>';
  }

  function desafioHtml() {
    var d = estado.desafio, p = estado.personagem, pf = d.perfil, corpo;
    if (d.erro) corpo = '<p class="menos">' + esc(d.erro) + '</p>';
    else if (!pf) corpo = '<p class="suave centro">Carregando o perfil…</p>';
    else {
      var x = personagemDoPerfil(pf), sx = R.status(x), sp = R.status(p), px = R.poder(x), pp = R.poder(p);
      var razao = px / Math.max(1, pp);
      var veredito = razao > 1.15 ? ['menos', 'Mais forte que você'] : razao < 0.87 ? ['mais', 'Mais fraco que você'] : ['cor-ouro', 'Força parecida com a sua'];
      function linhaComp(nome, a, b, txtA, txtB) {
        var cls = a > b ? 'menos' : a < b ? 'mais' : '';
        return '<tr><th>' + nome + '</th><td class="' + cls + '">' + (txtA || a) + '</td><td>' + (txtB || b) + '</td></tr>';
      }
      var mediaX = (sx.dano[0] + sx.dano[1]) / 2, mediaP = (sp.dano[0] + sp.dano[1]) / 2;
      var tabela = '<table class="comparar-tabela"><tr><th></th><th>' + esc(pf.nome) + '</th><th>Você</th></tr>'
        + linhaComp('Poder', px, pp, px.toLocaleString('pt-BR'), pp.toLocaleString('pt-BR'))
        + linhaComp('Vida', sx.hpMax, sp.hpMax)
        + linhaComp('Dano por golpe', mediaX, mediaP, dano(sx.dano), dano(sp.dano))
        + linhaComp('Defesa', sx.defesa, sp.defesa)
        + linhaComp('Defesa mágica', sx.defesaMagica, sp.defesaMagica)
        + linhaComp('Velocidade', sx.velocidade, sp.velocidade) + '</table>';
      var equip = Object.keys(D.slots).map(function (k) {
        var it = R.itemNoSlot(x, k);
        return it ? '<div class="icone-pequeno borda-' + corItem(it) + aura(it) + '" title="' + esc(R.nomeItem(it)) + ' (' + nomeRaridadeItem(it) + ')">'
          + F.icone(it) + (it.encanto ? '<span class="nivel-encanto">+' + it.encanto + '</span>' : '') + '</div>'
          : '<div class="icone-pequeno vazio" title="' + D.slots[k].nome + ' vazio"></div>';
      }).join('');
      var sq = A.saque, ouro = pf.ouro || 0;
      var saque = Math.floor(ouro * sq.minimo / 100).toLocaleString('pt-BR') + ' a ' + Math.floor(ouro * sq.maximo / 100).toLocaleString('pt-BR');
      corpo = '<div class="desafio-topo"><div class="moldura">' + F.personagem(pf.raca, classeRetrato(pf), pf.sexo) + '</div><div>'
        + '<h2>' + esc(pf.nome) + '</h2><div class="suave">' + nomeRaca(pf.raca, pf.sexo) + ' · ' + nomeClasseX(pf) + ' · Level ' + pf.nivel + '</div>'
        + (pf.alianca ? '<div class="desafio-alianca">' + brasaoSvg(pf.alianca.brasao) + '<span>' + esc(pf.alianca.nome) + ' ' + siglaHtml(pf.alianca.sigla) + '</span></div>' : '')
        + '<div class="desafio-selos">' + (pf.posicao ? '<span class="selo-pos">#' + pf.posicao + ' · ' + esc(nomeArena(pf.arena)) + '</span>' : '')
        + '<span class="selo-pos">' + pf.vitorias + ' V · ' + pf.derrotas + ' D</span></div>'
        + '<div class="veredito ' + veredito[0] + '">' + veredito[1] + '</div></div></div>'
        + '<h3 class="subtitulo">Equipamentos</h3><div class="desafio-equip">' + equip + '</div>'
        + tabela
        + (d.tipo === 'perfil' ? '' : recompensaDesafioHtml(pf, d.tipo, ouro, saque));
    }
    if (d.tipo === 'perfil') return '<div class="zoom-fundo" data-acao="desafio-cancelar"><div class="zoom-janela desafio-janela" role="dialog" aria-label="Perfil do amigo">'
      + '<button class="zoom-x" data-acao="desafio-cancelar" aria-label="Fechar">✕</button><div class="zoom-rotulo">Perfil do amigo</div>' + corpo + '</div></div>';
    var entradas = estado.arena && estado.arena.entradas;
    var semEntrada = entradas && entradas.valor <= 0;
    return '<div class="zoom-fundo" data-acao="desafio-cancelar"><div class="zoom-janela desafio-janela" role="dialog" aria-label="Perfil do adversário">'
      + '<button class="zoom-x" data-acao="desafio-cancelar" title="Fechar">✕</button>'
      + '<div class="zoom-rotulo">' + (d.tipo === 'livre' ? 'Atacar pelo Ranking?' : 'Desafiar na Arena?') + '</div>' + corpo
      + '<div class="botoes"><button class="btn btn-rolar" data-acao="desafio-confirmar"' + (!pf || semEntrada ? ' disabled' : '') + '>' + (d.tipo === 'livre' ? '⚔ Atacar' : '⚔ Desafiar')
      + (entradas ? ' <small>(gasta 1 de ' + entradas.valor + ' entradas)</small>' : '') + '</button>'
      + '<button class="btn secundario" data-acao="desafio-cancelar">Cancelar</button></div></div></div>';
  }

  function linhaRanking(x, botao) {
    return '<div class="item arena-linha' + (x.id === estado.personagem.id ? ' meu' : '') + '"><div class="arena-pos">' + trofeu(x.posicao) + '</div>'
      + (CELULAR && x.raca ? '<span class="arena-retrato">' + F.personagem(x.raca, classeRetrato(x), x.sexo) + '</span>' : '')
      + '<div class="amigo-info">' + siglaHtml(x.sigla) + '<strong>' + esc(x.nome) + '</strong><div class="suave pequeno">' + nomeClasseX(x)
      + ' · Lv ' + x.nivel + ' · Poder ' + Number(x.poder || 0).toLocaleString('pt-BR') + '</div></div>'
      + '<div class="item-acoes">' + (botao || '') + '</div></div>';
  }

  function abaArena() {
    var p = estado.personagem, ar = estado.arena;
    if (!ar) { carregarArena(); return '<p class="suave">' + (estado.arenaErro ? esc(estado.arenaErro) : 'Carregando…') + '</p>'; }
    if (ar.local) return '<p class="suave">A Arena é contra outros jogadores e precisa do servidor: jogue pelo site do ' + D.NOME_JOGO + '.</p>';
    var abas = '<div class="opcoes arena-abas">' + A.arenas.map(function (a) {
      var minha = a.id === ar.minha_arena;
      return '<button class="opcao mini-opcao' + (a.id === ar.arena ? ' selecionada' : '') + '" data-acao="arena-ver" data-valor="' + a.id + '">'
        + a.nome + (minha ? ' ★' : '') + '</button>';
    }).join('') + '</div>';
    var html = abas;
    if (p.nivel < A.nivelMin) return html + '<p class="suave">A Arena abre no level ' + A.nivelMin + '. Você entra no último lugar da Arena 5~10.</p>';
    var e = ar.entradas;
    html += '<div class="arena-topo"><div class="secao ouro"><span>Entradas</span><strong>' + e.valor + '/' + e.maximo + '</strong></div>'
      + '<div class="secao ouro"><span>🏆 Jackpot</span><strong>' + ar.jackpot.valor.toLocaleString('pt-BR') + '</strong></div></div>'
      + (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '')
      + '<p class="suave pequeno">Derrote o Top 1 para levar o jackpot. Ele cresce a cada 10 minutos com o mesmo Top 1 e é entregue ao Top 1 às 00:00. '
      + 'Na Arena só o D20 decide: 1 erra, 18 a 20 são críticos.</p>' + (CELULAR ? '</details>' : '');
    html += '<h3 class="subtitulo">Top 5 · ' + esc(nomeArena(ar.arena)) + '</h3><div class="itens">'
      + (ar.top5.length ? ar.top5.map(function (x) { return linhaRanking(x); }).join('') : '<p class="suave">Ninguém nesta arena ainda.</p>') + '</div>';
    if (ar.arena === ar.minha_arena && ar.posicao) {
      var semEntrada = e.valor <= 0;
      html += '<h3 class="subtitulo">Sua posição: #' + ar.posicao + ' de ' + ar.total + '</h3>' + (CELULAR ? '<details class="regras-celular"><summary>Quem posso desafiar?</summary>' : '') + '<p class="suave pequeno">Você pode desafiar os 5 logo acima de você. Vencendo, toma a posição dele e saqueia parte do ouro.'
        + (ar.posicao < 5 ? ' No Top 5 você também ataca os de baixo até o 5º lugar: não muda a posição, vale o saque e metade da reputação.' : '')
        + ' Pelo Ranking (Social) dá para atacar jogadores de qualquer arena.</p>' + (CELULAR ? '</details>' : '') + '<div class="itens">'
        + ar.alvos.map(function (x) {
          if (x.id === p.id) return linhaRanking(x, '<span class="suave pequeno">Você</span>');
          var bloq = semEntrada ? ' disabled title="Sem entradas"' : x.conta_minha ? ' disabled title="Personagem seu"' : '';
          return linhaRanking(x, '<button class="btn' + (x.abaixo ? ' secundario' : '') + '" data-acao="arena-desafiar" data-id="' + esc(x.id) + '"' + bloq
            + (x.abaixo ? ' title="Não muda a posição: saque e metade da reputação"' : '') + '>' + (x.abaixo ? 'Atacar' : 'Desafiar') + '</button>');
        }).join('') + '</div>';
      if (ar.posicao === 1) html += '<p class="destaque">Você é o Top 1! Defenda a posição.</p>';
    } else if (ar.arena !== ar.minha_arena) {
      html += '<p class="suave">Você só luta na ' + esc(nomeArena(ar.minha_arena)) + ' (pelo seu level). Esta arena é só para ver.</p>';
    }
    html += '<h3 class="subtitulo">Histórico</h3>' + (ar.historico.length ? '<div class="itens">' + ar.historico.map(function (h) {
      var texto = h.ataquei
        ? (h.venceu_atacante ? 'Você venceu <strong>' + esc(h.oponente) + '</strong>' : 'Você perdeu para <strong>' + esc(h.oponente) + '</strong>')
        : (h.venceu_atacante ? '<strong>' + esc(h.oponente) + '</strong> te atacou e venceu' : '<strong>' + esc(h.oponente) + '</strong> te atacou e perdeu');
      var ouro = h.saque ? ' <span class="' + (h.ataquei === h.venceu_atacante ? 'mais' : 'menos') + '">(' + (h.ataquei === h.venceu_atacante ? '+' : '−') + h.saque.toLocaleString('pt-BR') + ' de ouro)</span>' : '';
      var botao = h.pode_revanche ? '<button class="btn" data-acao="arena-revanche" data-luta="' + h.id + '"' + (e.valor <= 0 ? ' disabled' : '') + '>Revanche</button>' : '';
      var rep = h.ataquei && h.venceu_atacante && h.reputacao ? ' <span class="mais">(+' + h.reputacao + ' de reputação)</span>' : '';
      var tipo = h.revanche ? 'Revanche · ' : h.tipo === 'livre' ? 'Pelo Ranking · ' : h.tipo === 'top5' ? 'Top 5 · ' : '';
      return '<div class="item"><div>' + (tipo ? '<span class="suave pequeno">' + tipo + '</span>' : '') + texto + ouro + rep
        + '<div class="suave pequeno">' + (h.quando ? new Date(h.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') + '</div></div>'
        + '<div class="item-acoes">' + botao + '</div></div>';
    }).join('') + '</div>' : '<p class="suave">Nenhuma luta ainda.</p>');
    return html;
  }

  // ----- A luta -----
  function efeitoDado(n) {
    var m = A.dado[n - 1];
    if (n === 1) return 'ERROU!';
    var pct = Math.round((m - 1) * 100);
    return (n >= 18 ? 'CRÍTICO ' : '') + (pct === 0 ? 'ataque normal' : (pct > 0 ? '+' : '') + pct + '% de dano');
  }

  async function comecarLutaArena(fn, botao) {
    if (botao) botao.disabled = true;
    try {
      var usar3d = Tanka.dado3d && Tanka.dado3d.temWebgl()
        ? await Promise.race([Tanka.dado3d.carregar(), new Promise(function (ok) { setTimeout(function () { ok(false); }, 5000); })]) : false;
      var luta = await fn();
      var est = luta.estado;
      var ent = estado.arena && estado.arena.entradas;
      if (ent && ent.valor > 0) ent.valor -= 1;      // a barra de cima já mostra a entrada gasta
      fecharDado3d();
      estado.lutaArena = { luta: luta, idx: 0, hpA: est.a.hpMax, hpD: est.d.hpMax, modal: null, ultimo: null, fase: 'animando', registro: [], usar3d: usar3d };
      estado.lutaArena.registro.push('<p class="destaque">' + esc(est.a.nome) + ' desafia ' + esc(est.d.nome) + '!</p>');
      telaJogo();
      mostrarPainel();
      tocarEventosArena();
    } catch (e) {
      avisar(e.message);
      if (botao) botao.disabled = false;
    }
  }

  function redesenharArena() {
    var painel = document.querySelector('.jogo > section');
    if (!painel || !estado.lutaArena) return;
    painel.innerHTML = lutaArenaHtml();
    atualizarJanelaDado();
    var reg = document.getElementById('registro');
    if (reg) reg.scrollTop = reg.scrollHeight;
  }

  // D20 vermelho translúcido (vista de frente, como um dado de verdade): a face do meio mostra o número.
  var FACES_D20 = [
    ['50,24 23,68 77,68', 'c'], ['50,4 9,28 50,24', 't'], ['50,4 91,28 50,24', 't'], ['9,28 50,24 23,68', 'l'], ['91,28 50,24 77,68', 'l'],
    ['23,68 77,68 50,96', 'b'], ['9,28 23,68 9,72', 's'], ['91,28 77,68 91,72', 's'], ['9,72 23,68 50,96', 'e'], ['91,72 77,68 50,96', 'e'],
  ];
  // skin: classe de cores do dado (hoje só 'vermelho'; skins novas = novas classes .skin-* no CSS).
  function d20Bonito(numero, skin) {
    var n = Number(numero) || 20;
    var viz = [(n + 6) % 20 + 1, (n + 12) % 20 + 1, (n + 3) % 20 + 1, (n + 16) % 20 + 1];
    var faces = FACES_D20.map(function (f) { return '<polygon class="f f-' + f[1] + '" points="' + f[0] + '"/>'; }).join('');
    return '<svg class="d20g skin-' + (skin || 'vermelho') + '" viewBox="0 0 100 100" aria-label="D20 mostrando ' + numero + '">'
      + '<defs><radialGradient id="d20brilho" cx="35%" cy="25%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
      + faces + '<polygon points="50,4 91,28 91,72 50,96 9,72 9,28" fill="url(#d20brilho)" stroke="rgba(255,255,255,.35)" stroke-width="1"/>'
      + '<text class="n n-centro" x="50" y="57">' + numero + '</text>'
      + '<text class="n n-lado" x="29" y="44" transform="rotate(-58 29 44)">' + viz[0] + '</text>'
      + '<text class="n n-lado" x="71" y="44" transform="rotate(58 71 44)">' + viz[1] + '</text>'
      + '<text class="n n-lado" x="50" y="85" transform="rotate(180 50 82)">' + viz[2] + '</text>'
      + '<text class="n n-topo" x="50" y="18">' + viz[3] + '</text></svg>';
  }

  // Janela do dado: o D20 cai na mesa, gira e para no resultado (3D; sem WebGL, o desenho em SVG).
  function animarDado(final, quem, depois, jaCaindo) {
    var L = estado.lutaArena;
    function terminar() {
      var especial = final === 20 ? 2600 : final >= 18 || final === 1 ? 1700 : 1300;
      L.modal = { modo: 'pousou', quem: quem, numero: final, texto: efeitoDado(final) };
      atualizarJanelaDado();
      L.timer = setTimeout(function () { L.modal = null; depois(); }, especial);
    }
    function pousar() {
      clearInterval(L.giro);
      if (L.dado3d) {
        L.modal = { modo: 'pousando', quem: quem, numero: final };
        atualizarJanelaDado();
        L.dado3d.pousar(final, terminar);
      } else terminar();
    }
    if (jaCaindo) { pousar(); return; }
    L.modal = { modo: 'caindo', quem: quem, numero: '?' };
    atualizarJanelaDado();
    if (!L.dado3d) girarNumeros();
    L.timer = setTimeout(pousar, L.dado3d ? 750 : 1500);
  }
  function girarNumeros() {
    var L = estado.lutaArena;
    clearInterval(L.giro);
    L.giro = setInterval(function () {
      var el = document.querySelector('#dado-overlay .n-centro');
      if (el) el.textContent = 1 + Math.floor(Math.random() * 20);
    }, 80);
  }

  // A mesa do dado fica no meio da luta, entre os dois lutadores (as barras de vida continuam à vista).
  // O elemento é criado uma vez e só muda de lugar quando o painel é redesenhado, para o 3D não reiniciar.
  function atualizarJanelaDado() {
    var L = estado.lutaArena;
    var vaga = L && document.querySelector('.vaga-dado');
    if (!vaga) return;
    var ov = L.mesaEl;
    // Sem dado rolando: o dado fica parado mostrando o último número.
    var m = L.modal || { modo: 'parado', quem: L.ultimo ? L.ultimo.quem : 'a', numero: L.ultimo ? L.ultimo.numero : 20 };
    var est = L.luta.estado;
    if (!ov) {
      ov = L.mesaEl = document.createElement('div');
      ov.id = 'dado-overlay';
      ov.innerHTML = '<div class="dado-janela" aria-label="Dado"><div class="zoom-rotulo"></div>'
        + '<div class="mesa-madeira"><div class="raios-20"></div><div class="sombra-dado"></div><div class="dado-palco"></div><div class="faiscas"></div>'
        + '<div class="selo-dado"></div></div><div class="dado-baixo"></div></div>';
    }
    if (ov.parentNode !== vaga) vaga.appendChild(ov);
    var janela = ov.querySelector('.dado-janela'), mesa = ov.querySelector('.mesa-madeira'), palco = ov.querySelector('.dado-palco');
    var skin = (m.quem === 'd' ? est.d.skin : est.a.skin || estado.personagem.skinDado) || 'vermelho';
    janela.classList.toggle('do-oponente', m.quem === 'd');
    var n = m.numero, pousou = m.modo === 'pousou';
    mesa.className = 'mesa-madeira ' + m.modo + (pousou ? (n === 20 ? ' nat20 critico' : n === 1 ? ' falha' : '') : '') + (L.dado3d ? ' em3d' : '');
    janela.classList.toggle('treme', pousou && n === 20);
    ov.querySelector('.zoom-rotulo').textContent = m.modo === 'parado' ? (L.ultimo ? 'Último dado · ' + (m.quem === 'd' ? est.d.nome : est.a.nome) : 'Prepare-se!')
      : m.quem === 'd' ? 'Dado de ' + est.d.nome : 'Seu ataque';
    ov.querySelector('.selo-dado').textContent = '';
    // O dado: 3D (troca se mudou a skin) ou SVG.
    if (L.dado3d && L.dado3dSkin !== skin) { L.dado3d.destruir(); L.dado3d = null; }
    if (!L.dado3d && L.usar3d) {
      palco.innerHTML = '';
      try { L.dado3d = Tanka.dado3d.criar(palco, skin); L.dado3dSkin = skin; } catch (e) { L.usar3d = false; }
    }
    if (L.dado3d) {
      if (m.modo !== L.modoMostrado) {
        if (m.modo === 'rolar' || m.modo === 'parado') L.dado3d.parado(m.modo === 'rolar' ? 20 : n);
        if (m.modo === 'caindo') L.dado3d.cair(m.quem === 'd' ? -1 : 1);
      }
      L.dado3d.brilho(pousou ? (n === 20 ? 'ouro' : n === 1 ? 'falha' : null) : null);
    } else {
      palco.innerHTML = d20Bonito(n, skin);
    }
    if (pousou && n === 20 && L.modoMostrado !== 'pousou') soltarFaiscas(ov.querySelector('.faiscas'));
    L.modoMostrado = m.modo;
    var baixo = '';
    if (m.modo === 'rolar') {
      baixo = '<button class="btn btn-rolar" data-acao="arena-rolar">🎲 ROLAR DADO</button>'
        + '<div class="tempo-dado"><i style="width:100%"></i></div><div class="suave pequeno">Sem rolar em ' + A.tempoDado + ' s: ataque normal.</div>';
    } else if (m.modo === 'parado') {
      baixo = L.ultimo ? resultadoDado(n, L.ultimo.texto)
        : '<div class="suave">⚔ VS ⚔</div>';
    } else if (!pousou) {
      baixo = '<div class="dado-resultado suave">Rolando…</div>';
    } else {
      baixo = resultadoDado(n, m.texto);
    }
    ov.querySelector('.dado-baixo').innerHTML = baixo;
  }

  // Número grande embaixo do dado: 20 = CRÍTICO! dourado brilhando, 1 = FALHA! acinzentado, o resto em dourado.
  function resultadoDado(n, texto) {
    var tipo = n === 20 ? 'res-critico' : n === 1 ? 'res-falha' : '';
    return '<div class="dado-resultado ' + tipo + '"><div class="res-numero">' + n + '</div>'
      + (n === 20 ? '<div class="res-selo">CRÍTICO!</div>' : n === 1 ? '<div class="res-selo">FALHA!</div>' : '')
      + '<div class="res-efeito">' + esc(n === 1 ? 'errou o golpe' : String(texto).replace(/^CRÍTICO /, '')) + '</div></div>';
  }

  function soltarFaiscas(onde) {
    var html = '';
    for (var i = 0; i < 28; i++) {
      var ang = Math.random() * 360, dist = 90 + Math.random() * 120, atraso = Math.random() * 0.25, tam = 4 + Math.random() * 6;
      html += '<i style="--ang:' + ang + 'deg;--dist:' + dist + 'px;animation-delay:' + atraso + 's;width:' + tam + 'px;height:' + tam + 'px"></i>';
    }
    onde.innerHTML = html;
  }

  function fecharDado3d() {
    var L = estado.lutaArena;
    if (L && L.dado3d) { L.dado3d.destruir(); L.dado3d = null; }
    if (L && L.mesaEl) { L.mesaEl.remove(); L.mesaEl = null; }
  }

  function aplicarEventoArena(ev) {
    var L = estado.lutaArena, est = L.luta.estado;
    var atk = ev.de === 'a' ? est.a : est.d, alvo = ev.de === 'a' ? est.d : est.a;
    L.hpA = ev.hpA; L.hpD = ev.hpD;
    if (ev.hpMaxA) est.a.hpMax = ev.hpMaxA;   // a Bênção aumenta a vida máxima por 2 turnos
    if (ev.hpMaxD) est.d.hpMax = ev.hpMaxD;
    // Habilidades: o nome antes do dado; atordoado e cura não têm golpe.
    if (ev.hab) L.registro.push('<p class="habilidade-usada">' + (ev.cura ? '💚 ' : ev.reforco ? '✨ ' : '⚡ ') + esc(atk.nome) + ' usa <strong>' + esc(ev.hab) + '</strong>'
      + (ev.cura ? ' e recupera <strong>' + ev.cura + '</strong> de vida' : '') + '!</p>');
    // Level 30 (nov/2026): queimadura, cala, cegueira, Milagre e dano devolvido.
    if (ev.queimou) L.registro.push('<p class="dano-recebido">🔥 ' + esc(atk.nome) + ' queima e perde <strong>' + ev.queimou + '</strong>.</p>');
    if (ev.envenenado) L.registro.push('<p class="dano-recebido">☠️ ' + esc(atk.nome) + ' sangra/está envenenado e perde <strong>' + ev.envenenado + '</strong>.</p>');
    if (ev.milagreEu) L.registro.push('<p class="cura">✨ Milagre! ' + esc(atk.nome) + ' volta à luta.</p>');
    if (ev.calado) L.registro.push('<p class="errou">🤐 ' + esc(atk.nome) + ' está calado: sem habilidades nesta vez.</p>');
    if (ev.atordoado) {
      L.registro.push('<p class="errou">' + esc(atk.nome) + (atk.sexo === 'feminino' ? ' está atordoada' : ' está atordoado') + ' e perde a vez.</p>');
      if (L.registro.length > 60) L.registro.splice(0, L.registro.length - 60);
      return;
    }
    if (ev.cura) { L.ultimo = { numero: ev.dado, quem: ev.de, texto: ev.hab + ': +' + ev.cura + ' de vida' }; return; }
    L.ultimo = { numero: ev.dado, quem: ev.de, texto: efeitoDado(ev.dado) + (ev.garantido ? ' (Sombra: vale o 20)' : '') + (ev.dano ? ' → ' + ev.dano + ' de dano' : '') };
    if (ev.sombra) L.registro.push('<p class="errou">' + esc(alvo.nome) + ' está nas sombras: o golpe passa direto.</p>');
    if (ev.esquiva) L.registro.push('<p class="errou">' + esc(alvo.nome) + ' se esquiva!</p>');
    L.registro.push('<p class="' + (ev.dado === 1 ? 'errou' : ev.dado >= 18 ? 'critico' : ev.de === 'a' ? '' : 'dano-recebido') + '">🎲 <strong>' + ev.dado + '</strong> '
      + esc(atk.nome) + (ev.auto ? ' (tempo esgotado)' : '') + ': ' + efeitoDado(ev.dado) + (ev.garantido ? (ev.hab ? ' (vale o 20!)' : ' (Sombra: vale o 20!)') : '') + (ev.dano ? ' — ' + esc(alvo.nome) + ' perde <strong>' + ev.dano + '</strong>' : '') + '.</p>');
    if (ev.errouCego) L.registro.push('<p class="errou">🌫️ ' + esc(atk.nome) + ' está com pó nos olhos e erra!</p>');
    if (ev.executou) L.registro.push('<p class="critico">💀 Execução! ' + esc(alvo.nome) + ' estava fraco.</p>');
    if (ev.devolvido) L.registro.push('<p class="dano-recebido">🛡️ ' + esc(alvo.nome) + ' devolve <strong>' + ev.devolvido + '</strong> de dano.</p>');
    if (ev.calou) L.registro.push('<p class="destaque">🤐 ' + esc(alvo.nome) + ' fica sem habilidades na próxima vez.</p>');
    if (ev.quebrou) L.registro.push('<p class="destaque">⛓️ A defesa de ' + esc(alvo.nome) + ' quebrou (−30%).</p>');
    if (ev.queimadura) L.registro.push('<p class="destaque">🔥 ' + esc(alvo.nome) + ' está queimando e as curas dele caem pela metade.</p>');
    if (ev.envenenou) L.registro.push('<p class="destaque">☠️ ' + esc(alvo.nome) + ' foi envenenado.</p>');
    if (ev.escudo) L.registro.push('<p class="destaque">🧊 ' + esc(atk.nome) + ' levanta um escudo de gelo.</p>');
    if (ev.escudoSegurou) L.registro.push('<p class="suave">🧊 O escudo de ' + esc(alvo.nome) + ' segura <strong>' + ev.escudoSegurou + '</strong>.</p>');
    if (ev.congelouEu) L.registro.push('<p class="destaque">🧊 ' + esc(atk.nome) + ' congela ao bater no escudo!</p>');
    if (ev.bolso) L.registro.push('<p class="cura">🧪 ' + esc(alvo.nome) + ' usa o Bolso de Poções.</p>');
    if (ev.cegou) L.registro.push('<p class="destaque">🌫️ ' + esc(alvo.nome) + ' leva pó nos olhos.</p>');
    if (ev.milagre) L.registro.push('<p class="cura">✨ Milagre! ' + esc(alvo.nome) + ' volta à luta.</p>');
    if (ev.atordoou) L.registro.push('<p class="destaque">' + esc(alvo.nome) + (alvo.sexo === 'feminino' ? (ev.congelou ? ' está congelada' : ' está atordoada') : (ev.congelou ? ' está congelado' : ' está atordoado')) + ' por ' + ev.atordoou + (ev.atordoou > 1 ? ' turnos!' : ' turno!') + '</p>');
    if (L.registro.length > 60) L.registro.splice(0, L.registro.length - 60);
  }

  // Mostra os eventos novos um a um (o dado do oponente também cai na mesa) e depois espera o jogador.
  function tocarEventosArena() {
    var L = estado.lutaArena;
    if (!L) return;
    var ev = L.luta.eventos[L.idx];
    if (ev) {
      L.idx++;
      L.fase = 'animando';
      var jaCaindo = L.jaCaindo && ev.de === 'a';
      L.jaCaindo = false;
      if (!ev.dado) {   // atordoado: perde a vez, sem dado na mesa
        aplicarEventoArena(ev);
        redesenharArena();
        L.timer = setTimeout(tocarEventosArena, 700);
        return;
      }
      animarDado(ev.dado, ev.de, function () {
        aplicarEventoArena(ev);
        redesenharArena();
        L.timer = setTimeout(tocarEventosArena, 350);
      }, jaCaindo);
      return;
    }
    if (L.luta.situacao !== 'andamento') {
      L.fase = 'fim'; L.modal = null;
      R.registrarMissao(estado.personagem, 'arena', 1, C.agora());
      missaoCla('arena', 1);
      R.registrarGuia(estado.personagem, 'arena');
      if (L.luta.situacao === 'vitoria') R.registrarMissao(estado.personagem, 'arenaVitoria', 1, C.agora());
      salvar();
      fecharDado3d(); redesenharArena(); carregarArena(); return;
    }
    // Sua vez: a janela com o D20, o botão e 5 segundos.
    L.fase = 'esperando';
    L.prazo = Date.now() + A.tempoDado * 1000;
    L.modal = { modo: 'rolar', quem: 'a', numero: 20 };
    redesenharArena();
    atualizarJanelaDado();
    clearInterval(L.relogio);
    L.relogio = setInterval(function () {
      var resta = Math.max(0, L.prazo - Date.now());
      var barra = document.querySelector('.tempo-dado i');
      if (barra) barra.style.width = (resta / (A.tempoDado * 10)) + '%';
      if (resta <= 0) rolarDadoArena(false);
    }, 100);
  }

  async function rolarDadoArena(rolar) {
    var L = estado.lutaArena;
    if (!L || L.fase !== 'esperando') return;
    clearInterval(L.relogio);
    L.fase = 'rolando';
    var inicio = Date.now();
    if (rolar) {
      // O dado já começa a cair enquanto o servidor sorteia o número.
      L.modal = { modo: 'caindo', quem: 'a', numero: '?' };
      atualizarJanelaDado();
      if (!L.dado3d) girarNumeros();
    }
    try {
      L.luta = await C.arena.rolar(estado.personagem.id, L.luta.id, rolar);
    } catch (e) {
      clearInterval(L.giro);
      avisar(e.message);
      L.fase = 'esperando';
      return;
    }
    if (rolar) {
      L.jaCaindo = true;
      L.timer = setTimeout(tocarEventosArena, Math.max(0, (L.dado3d ? 750 : 1500) - (Date.now() - inicio)));
    } else tocarEventosArena();
  }

  function lutaArenaHtml() {
    var L = estado.lutaArena, est = L.luta.estado, a = est.a, d = est.d;
    function lutador(x, hp, lado) {
      return '<div class="lutador arena-lutador" id="lutador-' + lado + '"><div class="moldura">' + F.personagem(x.raca, classeRetrato(x), x.sexo) + '</div>'
        + '<h3>' + esc(x.nome) + '</h3><div class="suave pequeno">' + nomeClasseX(x) + ' · Lv ' + x.nivel + '</div>'
        + barra('hp', hp, x.hpMax, hp + ' / ' + x.hpMax, 'arena-' + lado) + '</div>';
    }
    var mesa = L.fase === 'fim' ? '' : '<div class="vaga-dado"></div>';
    var controles = '';
    var fim = '';
    if (L.fase === 'fim') {
      var lt = L.luta;
      if (lt.situacao === 'vitoria') {
        fim = '<div class="resultado vitoria-chefe"><h2>VITÓRIA!</h2><p>Você derrotou ' + esc(d.nome) + '.'
          + (lt.revanche ? ' Revanche: a posição não muda.' : lt.pos_depois !== lt.pos_antes ? ' Agora você está em <strong>#' + lt.pos_depois + '</strong>.' : '') + '</p>'
          + '<p>Saque: <strong class="cor-ouro">' + lt.saque.toLocaleString('pt-BR') + ' de ouro</strong> (' + lt.saque_pct + '% do ouro do oponente) e <strong>+' + A.reputacaoVitoria + ' de reputação</strong>.</p>'
          + (lt.jackpot ? '<p class="destaque">🏆 JACKPOT! +' + lt.jackpot.toLocaleString('pt-BR') + ' de ouro!</p>' : '');
      } else {
        fim = '<div class="resultado derrota"><h2>Derrota</h2><p>' + esc(d.nome) + ' venceu. Você continua na mesma posição e não perde nada.</p>';
      }
      fim += '<div class="botoes"><button class="btn" data-acao="arena-fechar">Voltar à Arena</button></div></div>';
    }
    return fim + '<h3 class="subtitulo">' + esc(nomeArena(L.luta.arena)) + (L.luta.revanche ? ' · Revanche' : '') + '</h3>'
      + '<div class="arena arena-pvp">' + lutador(a, L.hpA, 'jogador') + '<div class="arena-centro">' + mesa + controles + '</div>' + lutador(d, L.hpD, 'monstro') + '</div>'
      + '<div class="registro" id="registro">' + L.registro.join('') + '</div>';
  }

  // ---------------- Alianças ----------------
  // estado.alianca: o que o servidor diz (alianca_estado) para o personagem aberto (pid).
  var AL = D.ALIANCA;
  var NOME_FORMA = { classico: 'Clássico', redondo: 'Redondo', pontudo: 'Pontudo', estandarte: 'Estandarte' };
  var NOME_SIMBOLO = { dragao: 'Dragão', lobo: 'Lobo', coroa: 'Coroa', caveira: 'Caveira', espada: 'Espada', machado: 'Machado', olho: 'Olho', chama: 'Chama' };
  // Brasão pintado (assets/aliancas/): moldura do escudo, miolo pintado com a cor escolhida e o símbolo dourado por cima.
  // CAMPO_BRASAO: onde fica o miolo de cada escudo (em % da imagem), para centralizar o símbolo.
  var CAMPO_BRASAO = {
    classico: { x: 27, y: 18.8, w: 45.7, h: 62.5 }, redondo: { x: 17.6, y: 18, w: 63.7, h: 64.1 },
    pontudo: { x: 28.1, y: 21.1, w: 43.4, h: 64.5 }, estandarte: { x: 31.2, y: 22.7, w: 37.1, h: 63.3 },
  };
  function brasaoSvg(b, classe) {
    b = b || {};
    var forma = CAMPO_BRASAO[b.forma] ? b.forma : 'classico', campo = CAMPO_BRASAO[forma];
    var cor = /^#[0-9a-f]{6}$/i.test(b.cor || '') ? b.cor : AL.brasao.cores[0];
    var simbolo = AL.brasao.simbolos.indexOf(b.simbolo) >= 0 ? b.simbolo : 'dragao';
    var pasta = 'assets/aliancas/';
    return '<span class="brasao ' + (classe || '') + '" style="--cor:' + cor + '" aria-hidden="true">'
      + '<i class="brasao-campo" style="-webkit-mask-image:url(' + pasta + 'campo-' + forma + '.png);mask-image:url(' + pasta + 'campo-' + forma + '.png)"></i>'
      + '<img class="brasao-moldura" src="' + pasta + 'escudo-' + forma + '.webp" alt="">'
      + '<img class="brasao-simbolo" src="' + pasta + 'simbolo-' + simbolo + '.webp" alt="" style="left:' + (campo.x - campo.w * 0.1) + '%;top:' + (campo.y - campo.h * 0.04)
      + '%;width:' + campo.w * 1.2 + '%;height:' + campo.h * 1.08 + '%">'
      + '</span>';
  }
  // Na ficha: aliança e bônus ativos.
  function bonusFichaHtml() {
    var st = aliancaAtual(), a = st && st.alianca;
    if (!a) return '';
    var sk = st.skills || {}, n = Object.keys(sk).filter(function (k) { return sk[k] > 0; }).length;
    return '<div class="ficha-alianca">' + brasaoSvg(a.brasao) + '<div><strong>' + esc(a.nome) + '</strong> ' + siglaHtml(a.sigla)
      + '<div class="suave pequeno">' + (n ? '<span class="mais">' + n + (n === 1 ? ' skill do clã ativa' : ' skills do clã ativas') + '</span>' : 'Nenhuma skill do clã ainda') + '</div></div></div>';
  }
  var NOME_CARGO = { lider: 'Líder', vice: 'Vice-líder', oficial: 'Oficial', membro: 'Membro' };
  function siglaHtml(sigla) { return sigla ? '<span class="sigla">[' + esc(sigla) + ']</span> ' : ''; }

  // ---------------- Skills e missões do clã (Daniel, nov/2026) ----------------
  // As skills ficam salvas no personagem (p.cla) para valerem na caçada, na masmorra e nos bosses (regras.js, comCla).
  function sincronizarCla(p, st) {
    if (st.local || st.erro) return;
    var novo = st.alianca ? { id: st.alianca.id, skills: st.skills || {} } : null;
    if (JSON.stringify(novo) === JSON.stringify(p.cla || null)) return;
    if (novo) p.cla = novo; else delete p.cla;
    salvar();
    atualizarFicha();
  }
  function iconeSkillCla(k) {
    return '<span class="skill-cla-ico"><img src="assets/cla/skill-' + k.id + '.webp" alt="" onerror="this.remove()"><span>' + k.simbolo + '</span></span>';
  }
  function skillsClaHtml(st) {
    var a = st.alianca, chefe = st.meu_cargo === 'lider' || st.meu_cargo === 'vice', sk = st.skills || {}, max = AL.skillPrecos.length;
    var html = '<div class="caixa-interna"><h3>Skills do clã</h3><p class="suave pequeno">Compradas pelo líder ou pelo vice-líder com o ouro do tesouro (<span class="cor-ouro">'
      + Number(a.tesouro).toLocaleString('pt-BR') + '</span>). Valem para todos os membros, para sempre, contra monstros, masmorras e bosses '
      + '(não valem na Arena). O nível de cada skill vai até o nível do clã (agora ' + a.nivel + ').</p></div><div class="skills-cla">';
    html += AL.skills.map(function (k) {
      var n = sk[k.id] || 0, prox = n + 1, preco = AL.skillPrecos[n], fmt = function (v) { return (Math.round(v * 10) / 10).toLocaleString('pt-BR'); };
      var botao = '';
      if (n >= max) botao = '<span class="cor-ouro pequeno">Nível máximo</span>';
      else if (prox > a.nivel) botao = '<span class="suave pequeno">Nível ' + prox + ' libera com o clã nível ' + prox + '</span>';
      else if (chefe) botao = '<button class="btn btn-pequeno" data-acao="al-skill" data-id="' + k.id + '"' + (a.tesouro < preco ? ' disabled' : '') + '>Nível ' + prox + ' · '
        + preco.toLocaleString('pt-BR') + '</button>';
      else botao = '<span class="suave pequeno">Nível ' + prox + ': ' + preco.toLocaleString('pt-BR') + ' de ouro</span>';
      return '<div class="skill-cla' + (n ? ' ativa' : '') + '">' + iconeSkillCla(k) + '<div class="skill-cla-texto"><strong>' + esc(k.nome) + '</strong> <span class="suave pequeno">nível ' + n + '/' + max + '</span>'
        + '<div class="pequeno">' + (n ? '<span class="mais">+' + fmt(n * k.porNivel) + k.unidade + '</span>' : '<span class="suave">' + esc(k.descricao) + '</span>')
        + (n < max ? ' <span class="suave">(próximo: +' + fmt(prox * k.porNivel) + k.unidade + ')</span>' : '') + '</div>' + botao + '</div></div>';
    }).join('') + '</div>';
    return html;
  }
  function ouroMissaoCla(def, nivel) { return Math.round(def.ouro * (1 + AL.missoesOuroPorNivel * (nivel - 1))); }
  function seloMissoesCla(st) {
    var m = st && st.missoes;
    if (!m) return '';
    var feitas = AL.missoes.diarias.filter(function (d) { return m.diarias[d.tipo] && m.diarias[d.tipo].concluida; }).length;
    return feitas ? ' <span class="pequeno">' + feitas + '/' + AL.missoes.diarias.length + '</span>' : '';
  }
  function missoesClaHtml(st) {
    var a = st.alianca, m = st.missoes || { diarias: {}, semanais: {} };
    function lista(defs, prog, semanal) {
      return '<div class="itens">' + defs.map(function (d) {
        var x = prog[d.tipo] || { progresso: 0, concluida: false }, v = Math.min(Number(x.progresso), d.meta);
        return '<div class="item missao-cla' + (x.concluida ? ' feita' : '') + '"><div class="item-texto"><div><strong>' + (x.concluida ? '✅ ' : '') + esc(d.nome) + '</strong></div>'
          + barra('exp', v, d.meta, v.toLocaleString('pt-BR') + ' / ' + d.meta.toLocaleString('pt-BR'))
          + '<div class="suave pequeno">Prêmio: <span class="cor-ouro">' + ouroMissaoCla(d, a.nivel).toLocaleString('pt-BR') + ' de ouro</span> no tesouro'
          + (semanal && d.buff ? ' + <span class="mais">' + d.buff.toLocaleString('pt-BR') + '% de dano contra o boss do clã</span> até o fim da semana' : '') + '</div></div></div>';
      }).join('') + '</div>';
    }
    return '<div class="caixa-interna"><h3>Missões do clã</h3><p class="suave pequeno">O progresso é a soma de todos os membros. Cada missão cumprida põe ouro no tesouro '
      + '(mais ouro quanto maior o nível do clã). As diárias recomeçam à meia-noite; as semanais, na segunda-feira (Brasília).</p>'
      + (Number(st.buff_boss) ? '<p class="mais"><strong>Buff da semana: +' + Number(st.buff_boss).toLocaleString('pt-BR') + '% de dano contra o boss do clã!</strong></p>' : '') + '</div>'
      + '<h3 class="subtitulo">Diárias</h3>' + lista(AL.missoes.diarias, m.diarias || {}, false)
      + '<h3 class="subtitulo">Semanais</h3>' + lista(AL.missoes.semanais, m.semanais || {}, true);
  }
  // Progresso das missões: junta aqui e manda a cada 30 s (no máximo `missoesMaxEnvio` por envio; o resto fica para o próximo).
  var filaMissaoCla = {};
  function missaoCla(tipo, qtd) {
    var st = aliancaAtual();
    if (!st || !st.alianca || !AL.missoesMaxEnvio[tipo]) return;
    filaMissaoCla[tipo] = (filaMissaoCla[tipo] || 0) + (qtd || 1);
  }
  function enviarMissoesCla() {
    var p = estado.personagem;
    if (!p) return;
    Object.keys(filaMissaoCla).forEach(function (tipo) {
      var q = Math.min(filaMissaoCla[tipo], AL.missoesMaxEnvio[tipo]);
      if (q <= 0) return;
      filaMissaoCla[tipo] -= q;
      C.alianca.missaoRegistrar(p.id, tipo, q).catch(function () { filaMissaoCla[tipo] = (filaMissaoCla[tipo] || 0) + q; });
    });
  }
  setInterval(enviarMissoesCla, 30000);

  function aliancaAtual() {
    var st = estado.alianca;
    return st && estado.personagem && st.pid === estado.personagem.id ? st : null;
  }
  // Bônus de exp e ouro ativos para as caçadas (0 se não tem).
  function bonusAlianca() {
    var st = aliancaAtual(), a = st && st.alianca, agora = C.agora();
    if (!a) return { exp: 0, ouro: 0 };
    var p = estado.personagem;   // skills do clã (permanentes) + bônus antigo de 7 dias, se ainda estiver ativo
    return { exp: R.bonusCla(p, 'exp') + (a.bonus_exp_ate && Date.parse(a.bonus_exp_ate) > agora ? a.bonus_pct : 0),
      ouro: R.bonusCla(p, 'ouro') + (a.bonus_ouro_ate && Date.parse(a.bonus_ouro_ate) > agora ? a.bonus_pct : 0) };
  }
  function seloAlianca() {
    var st = aliancaAtual();
    if (!st || st.local) return '';
    var n = st.alianca ? (st.pedidos || []).length : (st.convites || []).length;
    return n ? ' <span class="selo-pedidos">' + n + '</span>' : (st.alianca ? seloBossAl() : '');
  }
  function carregarAlianca() {
    var p = estado.personagem;
    if (!p || estado.aliancaCarregando) return;
    estado.aliancaCarregando = true;
    C.alianca.estado(p.id, estado.aliancaBusca).then(function (st) {
      estado.aliancaCarregando = false;
      if (estado.personagem !== p) return;
      st.pid = p.id;
      estado.alianca = st;
      sincronizarCla(p, st);
      if (estado.batalha || estado.resultado || estado.chefeAviso || estado.luta || estado.lutaArena) return;
      if (estado.aba === 'alianca') telaJogo();
      else { atualizarNav(); atualizarFicha(); }
    }, function (e) {
      estado.aliancaCarregando = false;
      estado.alianca = { pid: p.id, erro: e.message };
      if (estado.aba === 'alianca') telaJogo();
    });
  }
  // Faz uma ação no servidor, recarrega a aliança e aplica o ouro/reputação gastos (créditos).
  function acaoAlianca(promessa, mensagem, tipo) {
    estado.aliancaConfirmar = null;
    return promessa.then(function () {
      if (mensagem) avisar(mensagem, tipo);
      carregarAlianca();
      carregarArena();
    }, function (e) { avisar(e.message); });
  }
  function dataCurta(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function confirmar(chave, rotulo, rotuloConfirmar, extra) {
    return estado.aliancaConfirmar === chave
      ? '<button class="btn perigo btn-pequeno" data-acao="al-confirmado" data-chave="' + chave + '"' + (extra || '') + '>' + rotuloConfirmar + '</button>'
        + '<button class="btn secundario btn-pequeno" data-acao="al-cancelar">Cancelar</button>'
      : '<button class="btn secundario btn-pequeno" data-acao="al-pedir-confirmar" data-chave="' + chave + '">' + rotulo + '</button>';
  }

  function cartaAlianca(a, botoes) {
    return '<div class="item alianca-carta"><div class="alianca-brasao-mini">' + brasaoSvg(a.brasao) + '</div>'
      + '<div class="item-texto"><div><strong>' + esc(a.nome) + '</strong> ' + siglaHtml(a.sigla) + '</div>'
      + '<div class="suave pequeno">Level ' + a.nivel + ' · ' + a.membros + '/' + a.vagas + ' membros · Poder ' + Number(a.poder || 0).toLocaleString('pt-BR') + '</div></div>'
      + '<div class="item-acoes">' + botoes + '</div></div>';
  }

  function editorBrasao(b, titulo) {
    function opcoes(lista, campo, desenho) {
      return '<div class="brasao-opcoes">' + lista.map(function (v) {
        return '<button class="brasao-opcao' + (b[campo] === v ? ' ativa' : '') + '" data-acao="al-brasao-opcao" data-campo="' + campo + '" data-valor="' + v + '" title="' + esc(desenho(v)[1]) + '">' + desenho(v)[0] + '</button>';
      }).join('') + '</div>';
    }
    return '<div class="brasao-editor"><div class="brasao-previa">' + brasaoSvg(b, 'grande') + '</div><div>'
      + (titulo ? '<h3>' + titulo + '</h3>' : '')
      + '<div class="suave pequeno">Escudo</div>' + opcoes(AL.brasao.formas, 'forma', function (v) { return [brasaoSvg({ forma: v, cor: b.cor, simbolo: b.simbolo }), NOME_FORMA[v]]; })
      + '<div class="suave pequeno">Cor</div>' + opcoes(AL.brasao.cores, 'cor', function (v) { return ['<i class="cor-amostra" style="background:' + v + '"></i>', v]; })
      + '<div class="suave pequeno">Símbolo</div>' + opcoes(AL.brasao.simbolos, 'simbolo', function (v) { return [brasaoSvg({ forma: b.forma, cor: b.cor, simbolo: v }), NOME_SIMBOLO[v]]; })
      + '</div></div>';
  }

  function abaAlianca() {
    var st = aliancaAtual();
    if (!st) { carregarAlianca(); return '<p class="suave">Carregando…</p>'; }
    if (st.local) return '<p class="suave">Os clãs juntam vários jogadores e precisam do servidor: jogue pelo site do ' + D.NOME_JOGO + '.</p>';
    if (st.erro) return '<p class="menos">' + esc(st.erro) + '</p><p class="suave pequeno">Se for a primeira vez, rode o supabase/schema.sql de novo no Supabase.</p>';
    return st.alianca ? telaMinhaAlianca(st) : telaSemAlianca(st);
  }

  function telaSemAlianca(st) {
    var p = estado.personagem, html = '';
    if (st.espera_ate) html += '<p class="menos">Você saiu de um clã: só pode entrar em outro depois de ' + dataCurta(st.espera_ate) + '.</p>';
    if (st.convites.length) {
      html += '<h3 class="subtitulo">Convites recebidos</h3><div class="itens">' + st.convites.map(function (a) {
        return cartaAlianca(a, '<button class="btn btn-pequeno" data-acao="al-responder" data-id="' + a.convite + '" data-sim="1">Aceitar</button>'
          + '<button class="btn secundario btn-pequeno" data-acao="al-responder" data-id="' + a.convite + '">Recusar</button>');
      }).join('') + '</div>';
    }
    var cria = estado.aliancaCriar;
    if (p.nivel < AL.nivelMin) {
      html += '<div class="caixa-interna"><h3>Criar um clã</h3><p class="suave">Abre no level ' + AL.nivelMin + '. Até lá, você pode entrar num clã que já existe.</p></div>';
    } else if (!cria) {
      html += '<div class="caixa-interna alianca-chamada"><div><h3>Funde o seu clã</h3><p class="suave">' + AL.custoOuro.toLocaleString('pt-BR') + ' de ouro + '
        + AL.custoReputacao + ' de reputação. Você vira o líder.</p></div><button class="btn" data-acao="al-criar-abrir">Criar clã</button></div>';
    } else {
      var faltaOuro = AL.custoOuro - p.ouro, faltaRep = AL.custoReputacao - (p.reputacao || 0);
      html += '<div class="caixa-interna"><h3>Novo clã</h3>'
        + '<div class="alianca-form"><label>Nome (3 a 20 letras)<input id="al-nome" maxlength="20" value="' + esc(cria.nome) + '" autocomplete="off"></label>'
        + '<label>Sigla (3 ou 4 letras)<input id="al-sigla" maxlength="4" value="' + esc(cria.sigla) + '" autocomplete="off" style="text-transform:uppercase"></label></div>'
        + editorBrasao(cria.brasao)
        + '<div class="botoes"><button class="btn" data-acao="al-criar"' + (faltaOuro > 0 || faltaRep > 0 ? ' disabled' : '') + '>Fundar · '
        + AL.custoOuro.toLocaleString('pt-BR') + ' de ouro + ' + AL.custoReputacao + ' de reputação</button>'
        + '<button class="btn secundario" data-acao="al-criar-fechar">Cancelar</button></div>'
        + (faltaOuro > 0 || faltaRep > 0 ? '<p class="menos pequeno centro">Faltam ' + [faltaOuro > 0 ? faltaOuro.toLocaleString('pt-BR') + ' de ouro' : '', faltaRep > 0 ? faltaRep + ' de reputação' : ''].filter(Boolean).join(' e ') + '.</p>' : '')
        + '</div>';
    }
    html += '<h3 class="subtitulo">Clãs</h3><div class="linha-form"><input id="al-busca" placeholder="Buscar por nome ou sigla" value="' + esc(estado.aliancaBusca || '') + '" autocomplete="off">'
      + '<button class="btn secundario" data-acao="al-buscar">Buscar</button></div><div class="itens">'
      + (st.lista.length ? st.lista.map(function (a) {
        var pedido = st.pedidos_feitos.indexOf(a.id) >= 0, cheia = a.membros >= a.vagas;
        return cartaAlianca(a, pedido ? '<span class="suave pequeno">Pedido enviado</span>'
          : '<button class="btn btn-pequeno" data-acao="al-pedir" data-id="' + a.id + '"' + (cheia || st.espera_ate ? ' disabled' : '') + '>' + (cheia ? 'Cheia' : 'Pedir para entrar') + '</button>');
      }).join('') : '<p class="suave">Nenhum clã encontrado.</p>') + '</div>';
    return html;
  }

  function telaMinhaAlianca(st) {
    // chefe = líder; comanda = líder ou vice-líder (skills, hora do boss, brasão, oficiais)
    var p = estado.personagem, a = st.alianca, cargo = st.meu_cargo, chefe = cargo === 'lider', comanda = chefe || cargo === 'vice', manda = cargo !== 'membro';
    var html = '<div class="alianca-topo">' + brasaoSvg(a.brasao, 'grande') + '<div class="alianca-titulo">'
      + '<h2>' + esc(a.nome) + ' ' + siglaHtml(a.sigla) + '</h2>'
      + '<div class="suave">Level ' + a.nivel + ' · ' + a.membros + '/' + a.vagas + ' membros · Poder ' + Number(a.poder).toLocaleString('pt-BR') + '</div>'
      + (a.exp_proximo ? barra('exp', a.exp, a.exp_proximo, Number(a.exp).toLocaleString('pt-BR') + ' / ' + Number(a.exp_proximo).toLocaleString('pt-BR') + ' de exp')
        : '<div class="cor-ouro">Level máximo!</div>')
      + '<div class="suave pequeno">Você é <strong>' + NOME_CARGO[cargo] + '</strong></div></div>'
      + (comanda ? '<button class="btn secundario btn-pequeno" data-acao="al-brasao-abrir">Mudar brasão</button>' : '') + '</div>';
    if (comanda && estado.aliancaBrasao) {
      html += '<div class="caixa-interna">' + editorBrasao(estado.aliancaBrasao, 'Novo brasão')
        + '<div class="botoes"><button class="btn" data-acao="al-brasao-salvar">Salvar brasão</button><button class="btn secundario" data-acao="al-brasao-fechar">Cancelar</button></div></div>';
    }
    var vista = estado.aliancaVista || 'geral', botaoVista = function (id, rotulo) {
      return '<button class="btn btn-pequeno' + (vista === id ? '' : ' secundario') + '" data-acao="al-vista" data-valor="' + id + '">' + rotulo + '</button>';
    };
    html += '<div class="botoes alianca-vistas">' + botaoVista('geral', 'Clã') + botaoVista('skills', '✦ Skills')
      + botaoVista('missoes', '📜 Missões' + seloMissoesCla(st)) + botaoVista('boss', '⚔ Boss do clã' + seloBossAl()) + '</div>';
    if (vista === 'boss') return html + bossAliancaHtml();
    if (vista === 'skills') return html + skillsClaHtml(st);
    if (vista === 'missoes') return html + missoesClaHtml(st);
    // Mural
    html += '<div class="caixa-interna"><h3>Mural</h3>' + (a.mural ? '<p class="alianca-mural">' + esc(a.mural) + '</p>' : '<p class="suave">Nenhum aviso.</p>')
      + (manda ? '<div class="linha-form"><input id="al-mural" maxlength="' + AL.muralMax + '" placeholder="Escreva um aviso para todos" value="' + esc(a.mural) + '">'
        + '<button class="btn secundario" data-acao="al-mural">Salvar</button></div>' : '') + '</div>';
    // Tesouro e bônus
    var agora = C.agora();
    function cartaBonus(tipo, nome, ate) {
      var ativo = ate && Date.parse(ate) > agora;
      return '<div class="bonus-carta' + (ativo ? ' ativo' : '') + '"><strong>+' + a.bonus_pct + '% ' + nome + '</strong>'
        + '<span class="suave pequeno">' + (ativo ? 'Ativo até ' + dataCurta(ate) : 'Desligado') + '</span>'
        + '</div>';
    }
    var doado = Number(st.doado_hoje || 0), resta = Math.max(0, AL.doacaoMaxDia - doado);
    html += '<div class="caixa-interna"><h3>Tesouro: <span class="cor-ouro">' + Number(a.tesouro).toLocaleString('pt-BR') + ' de ouro</span></h3>'
      + (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '')
      + '<p class="suave pequeno">Cada ouro doado vira exp do clã e conta como sua contribuição. O líder usa o tesouro para comprar as '
      + '<strong>skills do clã</strong>, que valem para todos os membros para sempre.</p>' + (CELULAR ? '</details>' : '')
      + '<p class="pequeno">Você doou hoje: <strong>' + doado.toLocaleString('pt-BR') + ' / ' + AL.doacaoMaxDia.toLocaleString('pt-BR') + '</strong> de ouro</p>'
      + (resta ? '<div class="linha-form"><input id="al-doar" type="number" min="' + AL.doacaoMinima + '" max="' + resta + '" step="100" inputmode="numeric" placeholder="Quanto doar (mín. ' + AL.doacaoMinima + ', até ' + resta.toLocaleString('pt-BR') + ')">'
        + '<button class="btn" data-acao="al-doar">Doar ouro</button></div>' : '<p class="suave pequeno">Limite de hoje atingido. Volte amanhã!</p>')
      + ((a.bonus_exp_ate && Date.parse(a.bonus_exp_ate) > agora) || (a.bonus_ouro_ate && Date.parse(a.bonus_ouro_ate) > agora)
        ? '<div class="bonus-lista">' + cartaBonus('exp', 'de exp nas caçadas', a.bonus_exp_ate) + cartaBonus('ouro', 'de ouro dos monstros', a.bonus_ouro_ate) + '</div>' : '')
      + '</div>';
    // Convidar e pedidos
    if (manda) {
      html += '<div class="caixa-interna"><h3>Convidar</h3><div class="linha-form"><input id="al-convidar" maxlength="16" placeholder="Nome do personagem" autocomplete="off">'
        + '<button class="btn" data-acao="al-convidar">Convidar</button></div>'
        + (st.pedidos.length ? '<h3 class="subtitulo">Pedidos para entrar</h3><div class="itens">' + st.pedidos.map(function (x) {
          return '<div class="item"><div><strong>' + esc(x.nome) + '</strong><div class="suave pequeno">' + nomeClasseX(x) + ' · Lv ' + x.nivel
            + ' · Poder ' + Number(x.poder).toLocaleString('pt-BR') + '</div></div><div class="item-acoes">'
            + '<button class="btn btn-pequeno" data-acao="al-decidir" data-id="' + x.id + '" data-sim="1">Aceitar</button>'
            + '<button class="btn secundario btn-pequeno" data-acao="al-decidir" data-id="' + x.id + '">Recusar</button></div></div>';
        }).join('') + '</div>' : '') + '</div>';
    }
    // Membros
    html += '<h3 class="subtitulo">Membros (' + a.membros + '/' + a.vagas + ')</h3><div class="itens">' + st.membros.map(function (x) {
      var eu = x.id === p.id, acoes = '';
      var bt = function (valor, rotulo) { return '<button class="btn secundario btn-pequeno" data-acao="al-cargo" data-id="' + x.id + '" data-valor="' + valor + '">' + rotulo + '</button>'; };
      if (!eu && chefe) {
        if (x.cargo !== 'vice') acoes += bt('vice', 'Tornar vice-líder');
        acoes += x.cargo === 'membro' ? bt('oficial', 'Promover a oficial') : bt('membro', 'Rebaixar');
        acoes += confirmar('lider:' + x.id, 'Passar liderança', 'Confirmar: passar');
      } else if (!eu && cargo === 'vice' && (x.cargo === 'oficial' || x.cargo === 'membro')) {
        acoes += x.cargo === 'oficial' ? bt('membro', 'Rebaixar') : bt('oficial', 'Promover a oficial');
      }
      if (!eu && (chefe || (cargo === 'vice' && (x.cargo === 'oficial' || x.cargo === 'membro')) || (cargo === 'oficial' && x.cargo === 'membro'))) acoes += confirmar('expulsar:' + x.id, 'Expulsar', 'Confirmar: expulsar');
      var icone = x.cargo === 'lider' ? '👑 ' : x.cargo === 'vice' ? '🛡️ ' : x.cargo === 'oficial' ? '⭐ ' : '';
      return '<div class="item alianca-membro' + (eu ? ' meu' : '') + '">' + (CELULAR && x.raca ? '<span class="arena-retrato">' + F.personagem(x.raca, classeRetrato(x), x.sexo) + '</span>' : '')
        + '<div class="item-texto"><div>' + icone + '<strong>' + esc(x.nome) + '</strong> ' + vistoTexto(x.visto_em) + '</div>'
        + '<div class="suave pequeno">' + NOME_CARGO[x.cargo] + ' · ' + nomeClasseX(x)
        + ' · Lv ' + x.nivel + ' · Poder ' + Number(x.poder).toLocaleString('pt-BR') + ' · Contribuição <span class="cor-ouro">' + Number(x.contribuicao).toLocaleString('pt-BR') + '</span></div></div>'
        + '<div class="item-acoes">' + acoes + '</div></div>';
    }).join('') + '</div>';
    html += '<div class="botoes alianca-sair">' + (chefe ? confirmar('desfazer', 'Desfazer o clã', 'Confirmar: desfazer para sempre')
      : confirmar('sair', 'Sair do clã', 'Confirmar: sair (' + AL.esperaHoras + ' h sem poder entrar em outro)')) + '</div>';
    return html;
  }

  // Cliques da aba Aliança (retorna true se tratou).
  function cliqueAlianca(acao, el) {
    var p = estado.personagem, A2 = C.alianca;
    function valor(id) { var c = document.getElementById(id); return c ? c.value.trim() : ''; }
    switch (acao) {
      case 'al-criar-abrir':
        estado.aliancaCriar = { nome: '', sigla: '', brasao: { forma: 'classico', cor: AL.brasao.cores[0], simbolo: 'dragao' } };
        telaJogo(); return true;
      case 'al-criar-fechar': estado.aliancaCriar = null; telaJogo(); return true;
      case 'al-brasao-opcao': {
        var alvo = estado.aliancaBrasao || (estado.aliancaCriar && estado.aliancaCriar.brasao);
        if (!alvo) return true;
        if (estado.aliancaCriar) { estado.aliancaCriar.nome = valor('al-nome'); estado.aliancaCriar.sigla = valor('al-sigla'); }
        alvo[el.dataset.campo] = el.dataset.valor;
        telaJogo(); return true;
      }
      case 'al-criar': {
        var b = estado.aliancaCriar.brasao;
        A2.criar(p.id, valor('al-nome'), valor('al-sigla').toUpperCase(), b).then(function () {
          estado.aliancaCriar = null;
          avisar('Clã fundado! Você é o líder.', 'nivel');
          carregarAlianca(); carregarArena();
        }, function (e) { avisar(e.message); });
        return true;
      }
      case 'al-buscar': estado.aliancaBusca = valor('al-busca'); carregarAlianca(); return true;
      case 'al-pedir': acaoAlianca(A2.pedir(p.id, Number(el.dataset.id)), 'Pedido enviado. Espere o líder ou um oficial aceitar.'); return true;
      case 'al-responder': acaoAlianca(A2.responder(p.id, Number(el.dataset.id), !!el.dataset.sim), el.dataset.sim ? 'Bem-vindo ao clã!' : 'Convite recusado.', el.dataset.sim ? 'nivel' : ''); return true;
      case 'al-decidir': acaoAlianca(A2.decidir(p.id, Number(el.dataset.id), !!el.dataset.sim), el.dataset.sim ? 'Novo membro no clã!' : 'Pedido recusado.'); return true;
      case 'al-convidar': {
        var nome = valor('al-convidar');
        if (nome) acaoAlianca(A2.convidar(p.id, nome), 'Convite enviado para ' + nome + '.');
        return true;
      }
      case 'al-mural': acaoAlianca(A2.mural(p.id, valor('al-mural')), 'Mural atualizado.'); return true;
      case 'al-doar': {
        var qtd = parseInt(valor('al-doar'), 10);
        if (!(qtd >= AL.doacaoMinima)) { avisar('Doação mínima: ' + AL.doacaoMinima + ' de ouro.'); return true; }
        if (qtd > p.ouro) { avisar('Você não tem esse ouro.'); return true; }
        var restaHoje = AL.doacaoMaxDia - Number((aliancaAtual() || {}).doado_hoje || 0);
        if (qtd > restaHoje) { avisar('Limite de doação: ' + AL.doacaoMaxDia.toLocaleString('pt-BR') + ' de ouro por dia (hoje você ainda pode doar ' + Math.max(0, restaHoje).toLocaleString('pt-BR') + ').'); return true; }
        acaoAlianca(A2.doar(p.id, qtd), 'Você doou ' + qtd.toLocaleString('pt-BR') + ' de ouro ao tesouro!', 'item');
        return true;
      }
      case 'al-bonus': acaoAlianca(A2.bonus(p.id, el.dataset.valor), 'Bônus ativado por ' + AL.bonus.dias + ' dias para todos!', 'nivel'); return true;
      case 'al-cargo': acaoAlianca(A2.cargo(p.id, el.dataset.id, el.dataset.valor), ({ vice: 'Agora é o vice-líder do clã.', oficial: 'Promovido a oficial.' })[el.dataset.valor] || 'Rebaixado a membro.'); return true;
      case 'al-brasao-abrir': {
        var atual = aliancaAtual().alianca.brasao || {};
        estado.aliancaBrasao = { forma: atual.forma || 'classico', cor: atual.cor || AL.brasao.cores[0], simbolo: atual.simbolo || 'dragao' };
        telaJogo(); return true;
      }
      case 'al-brasao-fechar': estado.aliancaBrasao = null; telaJogo(); return true;
      case 'al-brasao-salvar': {
        var nb = estado.aliancaBrasao;
        estado.aliancaBrasao = null;
        acaoAlianca(A2.brasao(p.id, nb), 'Brasão atualizado.');
        return true;
      }
      case 'al-vista':
        estado.aliancaVista = ['boss', 'skills', 'missoes'].indexOf(el.dataset.valor) >= 0 ? el.dataset.valor : null;
        telaJogo();
        if (estado.aliancaVista === 'boss') carregarBossAl(); else { enviarMissoesCla(); carregarAlianca(); }
        return true;
      case 'al-skill': acaoAlianca(A2.skillComprar(p.id, el.dataset.id), 'Skill do clã comprada! Já vale para todos os membros.', 'nivel'); return true;
      case 'al-boss-hora': {
        var h = parseInt(valor('al-boss-hora'), 10);
        acaoBossAl(A2.boss.hora(p.id, h), 'Boss marcado para as ' + h + 'h (horário de Brasília), todos os dias.');
        return true;
      }
      case 'al-boss-sala-criar': acaoBossAl(A2.boss.salaCriar(p.id), 'Grupo criado. Chame até ' + (D.BOSS_ALIANCA.grupoMax - 1) + ' membros para entrar.'); return true;
      case 'al-boss-sala-entrar': acaoBossAl(A2.boss.salaEntrar(p.id, Number(el.dataset.id)), 'Você entrou no grupo.'); return true;
      case 'al-boss-sala-sair': acaoBossAl(A2.boss.salaSair(p.id), 'Você saiu do grupo.'); return true;
      case 'al-boss-atacar': atacarBossAl(el); return true;
      case 'al-pedir-confirmar': estado.aliancaConfirmar = el.dataset.chave; telaJogo(); return true;
      case 'al-cancelar': estado.aliancaConfirmar = null; telaJogo(); return true;
      case 'al-confirmado': {
        var partes = el.dataset.chave.split(':');
        if (partes[0] === 'lider') acaoAlianca(A2.cargo(p.id, partes[1], 'lider'), 'Liderança passada. Agora você é oficial.');
        else if (partes[0] === 'expulsar') acaoAlianca(A2.expulsar(p.id, partes[1]), 'Membro expulso.');
        else if (partes[0] === 'sair') acaoAlianca(A2.sair(p.id), 'Você saiu do clã.');
        else if (partes[0] === 'desfazer') acaoAlianca(A2.desfazer(p.id), 'O clã foi desfeito.');
        return true;
      }
      case 'al-admin-listar':
        A2.admin(p.id, null, 'listar', null).then(function (l) { estado.adminAliancas = l; telaJogo(); }, function (e) { avisar(e.message); });
        return true;
      case 'al-admin': {
        var op = el.dataset.op, id = Number(el.dataset.id), v = null;
        if (op === 'renomear') { v = window.prompt('Novo nome do clã:'); if (!v) return true; }
        if (op === 'lider') { v = window.prompt('Nome do personagem que vira líder:'); if (!v) return true; }
        if (op === 'exp') v = 50000;
        if (op === 'apagar' && !window.confirm('Apagar o clã para sempre?')) return true;
        A2.admin(p.id, id, op, v).then(function (l) { estado.adminAliancas = l; avisar('Feito.'); telaJogo(); carregarAlianca(); }, function (e) { avisar(e.message); });
        return true;
      }
    }
    return false;
  }

  // ---------------- Boss da aliança (Daniel, nov/2026) ----------------
  // estado.bossAl: o que o servidor diz (alianca_boss_estado). A investida é calculada aqui (R.simularBossAlianca)
  // com a semente do servidor; o líder do grupo (ou quem ataca sozinho) informa o dano no fim.
  var BA = D.BOSS_ALIANCA;
  function agoraBossAl() { var st = estado.bossAl; return Date.now() + (st && st.desvio || 0); }
  function seloBossAl() {
    var st = estado.bossAl;
    return st && st.boss && st.boss.estado === 'aberto' ? ' <span class="selo-pedidos">!</span>' : '';
  }
  function carregarBossAl() {
    var p = estado.personagem, al = aliancaAtual();
    if (!p || estado.bossAlCarregando || !al || !al.alianca) return;
    estado.bossAlCarregando = true;
    C.alianca.boss.estado(p.id).then(function (st) {
      estado.bossAlCarregando = false;
      if (estado.personagem !== p) return;
      st.desvio = Date.parse(st.agora) - Date.now();
      var antes = estado.bossAl;
      estado.bossAl = st;
      estado.bossAlErro = null;
      var run = st.run;
      // Investida nova do meu grupo (começada por outro membro): assisto junto.
      // (o líder registra o dano logo no começo, então a investida pode já aparecer como concluída)
      if (run && run.lider !== p.id && !vistas['b' + run.id] && !estado.luta && !estado.batalha && !estado.lutaArena
        && agoraBossAl() - Date.parse(run.criado_em) < 90000) {
        assistirBoss(run, null);
        return;
      }
      if (!estado.luta && st.recompensas && st.recompensas.length) resgatarRecompensas(st.recompensas);
      if (estado.batalha || estado.resultado || estado.chefeAviso || estado.luta || estado.lutaArena) return;
      if (estado.aba === 'alianca') telaJogo();
      else if (!antes || (antes.boss && antes.boss.estado) !== st.boss.estado) atualizarNav();
    }, function (e) {
      estado.bossAlCarregando = false;
      estado.bossAlErro = e.message;
      if (estado.aba === 'alianca' && estado.aliancaVista === 'boss' && !estado.luta) telaJogo();
    });
  }
  function acaoBossAl(promessa, mensagem) {
    return promessa.then(function () { if (mensagem) avisar(mensagem); carregarBossAl(); }, function (e) { avisar(e.message); });
  }
  function relogioTexto(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
    return (h ? h + 'h ' : '') + (h || m ? m + 'min ' : '') + (h ? '' : x + 's');
  }
  // Quando o boss abre de novo (texto) e quanto falta (ms), pela hora do líder (Brasília, UTC-3).
  function proximoBossAl(st) {
    var b = st.boss;
    if (b.hora == null) return null;
    var hh = (b.hora < 10 ? '0' : '') + b.hora;
    var inicio = Date.parse(st.dia + 'T' + hh + ':00:00-03:00'), agora = agoraBossAl();
    if (b.dia !== st.dia && agora < inicio) return { texto: 'hoje às ' + b.hora + 'h', falta: inicio - agora };
    return { texto: 'amanhã às ' + b.hora + 'h', falta: inicio + 86400000 - agora };
  }
  function bossAliancaHtml() {
    var st = estado.bossAl, p = estado.personagem;
    if (!st) {
      carregarBossAl();
      return '<p class="suave">' + (estado.bossAlErro ? esc(estado.bossAlErro) + '<br><span class="pequeno">Se for a primeira vez, rode o supabase/schema.sql de novo no Supabase.</span>' : 'Carregando…') + '</p>';
    }
    var b = st.boss, aberto = b.estado === 'aberto', lider = st.meu_cargo === 'lider' || st.meu_cargo === 'vice';
    var nivelMostrado = b.estado === 'morto' && b.dia === st.dia ? b.nivel - 1 : b.nivel;
    var info = R.bossAlianca(nivelMostrado), prox = proximoBossAl(st);
    // Situação
    var situacao;
    if (aberto) situacao = '<p class="cor-ouro"><strong>O boss está aberto!</strong> Fecha em <span id="boss-relogio" data-fim="' + Date.parse(b.fecha_em) + '">'
      + relogioTexto(Date.parse(b.fecha_em) - agoraBossAl()) + '</span>.</p>';
    else if (b.hora == null) situacao = '<p class="suave">' + (lider ? 'Escolha abaixo a hora do boss: ele abre sozinho todo dia nessa hora.' : 'O líder ainda não escolheu a hora do boss.') + '</p>';
    else if (b.estado === 'morto' && b.dia === st.dia) situacao = '<p class="mais"><strong>Derrotado!</strong>' + (b.ultimo_golpe ? ' Último golpe de ' + esc(b.ultimo_golpe) + '.' : '')
      + ' O próximo boss (nível ' + b.nivel + ') abre ' + prox.texto + '.</p>';
    else if (b.estado === 'falhou' && b.dia === st.dia) situacao = '<p class="menos"><strong>O boss escapou.</strong> ' + prox.texto.charAt(0).toUpperCase() + prox.texto.slice(1)
      + ' vocês enfrentam o mesmo boss, com a vida cheia.</p>';
    else situacao = '<p>Abre <strong>' + prox.texto + '</strong> (em <span id="boss-relogio" data-fim="' + (agoraBossAl() + prox.falta) + '">' + relogioTexto(prox.falta) + '</span>) e fica '
      + BA.duracaoMin + ' minutos aberto.</p>';
    var hpMax = Number(b.hp_max), hp = aberto || (b.dia === st.dia && b.estado !== 'fechado') ? Math.max(0, Number(b.hp)) : hpMax;
    var html = '<div class="caixa-interna boss-al"><div class="boss-al-topo"><div class="moldura">' + F.imagemMonstro(info.id) + '</div><div class="boss-al-info">'
      + '<div class="suave pequeno">Boss do clã · Nível ' + nivelMostrado + '</div><h3>' + esc(info.nome) + '</h3>'
      + (info.descricao ? '<p class="suave pequeno boss-al-desc">' + esc(info.descricao) + '</p>' : '')
      + barra('hp', hp, hpMax, hp.toLocaleString('pt-BR') + ' / ' + hpMax.toLocaleString('pt-BR'), 'boss-al') + situacao + '</div></div>';
    // Prêmio
    var infoPr = R.bossAlianca(b.nivel), pr = R.premioBossAlianca(p, b.nivel);
    html += '<p class="suave pequeno">Prêmio do nível ' + b.nivel + ': quem deu dano ganha <span class="cor-ouro">' + pr.ouro.toLocaleString('pt-BR') + ' de ouro</span>, '
      + pr.exp.toLocaleString('pt-BR') + ' de exp e ' + infoPr.premio.pergaminho + ' pergaminhos para item ' + ITEM_RARIDADE[infoPr.premio.raridadePergaminho]
      + '; o maior dano ganha 1 item épico ou lendário; o clã ganha ' + infoPr.premio.alianca.toLocaleString('pt-BR') + ' de exp. '
      + 'A cada vitória ele volta mais forte no dia seguinte.</p>';
    // Ataque
    var minha = st.salas.filter(function (x) { return x.id === st.minha_sala; })[0];
    if (aberto) {
      var investida = st.run && st.run.estado === 'andamento' && agoraBossAl() - Date.parse(st.run.criado_em) < 300000;
      if (minha && minha.lider !== p.id) html += '<p class="suave">Espere o líder do seu grupo começar a investida: você assiste junto.</p>';
      else html += '<div class="botoes"><button class="btn" data-acao="al-boss-atacar"' + (investida ? ' disabled' : '') + '>'
        + (minha ? '⚔ Atacar com o grupo (' + minha.membros.length + ')' : '⚔ Atacar sozinho') + '</button></div>';
      html += '<p class="suave pequeno">Ataques ilimitados até fechar. Cada investida termina quando o grupo cai ou depois de '
        + BA.limiteAtaques + ' ataques do boss. Em grupo de até ' + BA.grupoMax + ' o dano é muito maior.</p>';
    }
    if (lider) {
      var opcoes = '';
      for (var h = 0; h < 24; h++) opcoes += '<option value="' + h + '"' + (b.hora === h ? ' selected' : '') + '>' + h + 'h</option>';
      html += '<div class="linha-form boss-al-hora"><label>Hora do boss (Brasília) <select id="al-boss-hora"' + (aberto ? ' disabled' : '') + '>' + opcoes + '</select></label>'
        + '<button class="btn secundario btn-pequeno" data-acao="al-boss-hora"' + (aberto ? ' disabled' : '') + '>Salvar</button></div>';
    }
    html += '</div>';
    // Grupos
    html += '<h3 class="subtitulo">Grupos (até ' + BA.grupoMax + ')</h3>';
    if (st.salas.length) html += '<div class="itens">' + st.salas.map(function (x) {
      var meu = x.id === st.minha_sala, cheio = x.membros.length >= BA.grupoMax;
      return '<div class="item' + (meu ? ' meu' : '') + '"><div class="item-texto">' + x.membros.map(function (m) {
          return (m.id === x.lider ? '👑 ' : '') + '<strong>' + esc(m.nome) + '</strong> <span class="suave pequeno">' + nomeClasseX(m) + ' · Lv ' + m.nivel + '</span>';
        }).join('<br>') + '</div><div class="item-acoes">'
        + (meu ? '<button class="btn secundario btn-pequeno" data-acao="al-boss-sala-sair">Sair</button>'
          : '<button class="btn btn-pequeno" data-acao="al-boss-sala-entrar" data-id="' + x.id + '"' + (cheio ? ' disabled' : '') + '>' + (cheio ? 'Cheio' : 'Entrar') + '</button>')
        + '</div></div>';
    }).join('') + '</div>';
    else html += '<p class="suave">Nenhum grupo ainda.</p>';
    if (!minha) html += '<div class="botoes"><button class="btn secundario" data-acao="al-boss-sala-criar">Criar grupo</button></div>';
    // Ranking do dia
    html += '<h3 class="subtitulo">Dano ' + (b.dia === st.dia ? 'de hoje' : 'do último boss') + '</h3>';
    html += st.ranking.length ? '<div class="itens">' + st.ranking.map(function (x, i) {
      return '<div class="item' + (x.id === p.id ? ' meu' : '') + '"><div class="item-texto"><div>' + (i === 0 ? '🏆 ' : (i + 1) + '. ') + '<strong>' + esc(x.nome) + '</strong></div>'
        + '<div class="suave pequeno">' + nomeClasseX(x) + ' · ' + x.investidas + (x.investidas === 1 ? ' investida' : ' investidas') + '</div></div>'
        + '<div class="cor-ouro"><strong>' + Number(x.dano).toLocaleString('pt-BR') + '</strong></div></div>';
    }).join('') + '</div>' : '<p class="suave">Ninguém atacou ainda.</p>';
    return html;
  }
  // Relógio do boss (a cada segundo, só o texto).
  setInterval(function () {
    var el = document.getElementById('boss-relogio');
    if (!el) return;
    var falta = Number(el.dataset.fim) - agoraBossAl();
    if (falta <= 0) { el.removeAttribute('id'); carregarBossAl(); return; }
    el.textContent = relogioTexto(falta);
  }, 1000);

  async function atacarBossAl(botao) {
    var p = estado.personagem;
    if (botao) botao.disabled = true;
    try {
      var run = await C.alianca.boss.atacar(p.id);
      if (estado.luta) { clearTimeout(estado.luta.timer); estado.luta = null; }
      assistirBoss(run, null);
    } catch (e) {
      avisar(e.message);
      if (botao) botao.disabled = false;
      carregarBossAl();
    }
  }
  function assistirBoss(run, sim) {
    vistas['b' + run.id] = true;
    var p = estado.personagem;
    sim = sim || R.simularBossAlianca(run.herois.map(function (h) { return h.dados; }), run.nivel, Number(run.hp_inicio), run.semente, Number(run.buff) || 0);
    var L = {
      run: run, sim: sim, boss: R.bossAlianca(run.nivel), idx: 0, sala: 0, fim: false, rapido: false, registro: [], servidor: null,
      hpH: sim.inicio.herois.map(function (h) { return h.hpMax; }),
      hpM: sim.inicio.salas[0].map(function (m) { return m.hp != null ? m.hp : m.hpMax; }),
      atraso: Math.max(30, Math.min(350, Math.round(45000 / Math.max(1, sim.eventos.length)))),
    };
    L.mm = { nome: L.boss.nome };
    estado.luta = L;
    // Quem começou a investida já informa o dano (vale mesmo se fechar a página no meio).
    if (run.lider === p.id && run.estado === 'andamento') {
      C.alianca.boss.concluir(p.id, run.id, sim.danos).then(function (r) {
        L.servidor = r;
        if (r && r.morreu) carregarAlianca();   // exp nova da aliança
        if (estado.luta === L && L.fim) redesenharLuta();
      }, function (e) { avisar('Erro ao registrar o dano: ' + e.message); });
    }
    L.registro.push('<p class="destaque">' + (run.herois.length > 1 ? 'O grupo avança' : esc(run.herois[0].dados.nome) + ' avança') + ' contra ' + esc(L.boss.nome) + '!</p>');
    estado.chefeAviso = null;
    telaJogo();
    mostrarPainel();
    agendarLuta();
  }

  // ---------------- Chat global ----------------
  // Fica fora do #app para não sumir quando a tela é redesenhada.
  // Atualiza a cada 4 s com a janela aberta e a cada 20 s fechada (para o contador de novas).
  var chat = { el: null, aberto: false, mensagens: [], ultimoId: 0, naoLidas: 0, timer: null, ativo: false, ultimaCompleta: 0,
    canal: 'global', al: { pid: null, mensagens: [], ultimoId: 0 } };   // canal 'alianca': chat só dos membros

  function chatVisivel(sim) {
    if (!chat.el) {
      chat.el = document.createElement('div');
      chat.el.id = 'chat';
      document.body.appendChild(chat.el);
      chat.el.addEventListener('click', cliqueChat);
      chat.el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.id === 'chat-texto') { e.preventDefault(); enviarChat(); }
      });
    }
    if (sim === chat.ativo) return;
    chat.ativo = sim;
    chat.el.hidden = !sim;
    clearTimeout(chat.timer);
    if (sim) {
      chat.mensagens = []; chat.ultimoId = 0; chat.naoLidas = 0;
      desenharChat();
      buscarChat(true);
    }
  }

  function linhaChat(m) {
    var hora = new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (m.classe === 'sistema') {   // aviso do reino (ex.: Ignaroth despertou)
      return '<p class="chat-msg chat-sistema"><span class="chat-hora">' + hora + '</span> 🐉 <strong>' + esc(m.texto) + '</strong></p>';
    }
    var classe = nomeClasseX(m);
    var acoes = ehAdmin()
      ? '<span class="chat-admin"><button data-chat="apagar" data-id="' + m.id + '" title="Apagar mensagem">🗑</button>'
        + '<button data-chat="silenciar" data-nome="' + esc(m.personagem) + '" title="Silenciar jogador">🔇</button></span>'
      : '';
    // celular: balão de conversa (o meu à direita), com nome e hora em cima
    if (CELULAR) return '<div class="chat-msg chat-balao' + (estado.personagem && m.personagem === estado.personagem.nome ? ' minha' : '') + '"><div class="chat-cab">'
      + siglaHtml(m.sigla) + '<strong class="chat-nome classe-' + esc(m.classe) + '">' + esc(m.personagem) + '</strong> <span class="chat-info">' + classe + ' Lv ' + m.nivel + '</span>'
      + '<span class="chat-hora">' + hora + '</span></div><div class="chat-texto">' + esc(m.texto) + '</div>' + acoes + '</div>';
    return '<p class="chat-msg"><span class="chat-hora">' + hora + '</span> ' + siglaHtml(m.sigla) + '<strong class="chat-nome classe-' + esc(m.classe) + '">'
      + esc(m.personagem) + '</strong> <span class="chat-info">' + classe + ' Lv ' + m.nivel + '</span>: '
      + esc(m.texto) + acoes + '</p>';
  }

  function linhaChatAlianca(m) {
    var hora = new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    var cargo = m.cargo === 'lider' ? '👑 ' : m.cargo === 'vice' ? '🛡️ ' : m.cargo === 'oficial' ? '⭐ ' : '';
    if (CELULAR) return '<div class="chat-msg chat-balao' + (estado.personagem && m.personagem === estado.personagem.nome ? ' minha' : '') + '"><div class="chat-cab">' + cargo
      + '<strong class="chat-nome">' + esc(m.personagem) + '</strong><span class="chat-hora">' + hora + '</span></div><div class="chat-texto">' + esc(m.texto) + '</div></div>';
    return '<p class="chat-msg"><span class="chat-hora">' + hora + '</span> ' + (m.cargo === 'lider' ? '👑 ' : m.cargo === 'vice' ? '🛡️ ' : m.cargo === 'oficial' ? '⭐ ' : '')
      + '<strong class="chat-nome">' + esc(m.personagem) + '</strong>: ' + esc(m.texto) + '</p>';
  }
  function chatDaAlianca() { var st = aliancaAtual(); return !!(st && st.alianca); }

  function desenharChat() {
    var seloC = document.getElementById('casca-chat-selo');
    if (seloC) { seloC.hidden = !chat.naoLidas || chat.aberto; seloC.textContent = chat.naoLidas > 99 ? '99+' : chat.naoLidas; }
    if (!chat.aberto) {
      chat.el.innerHTML = '<button class="chat-botao" data-chat="abrir">💬 Chat'
        + (chat.naoLidas ? ' <span class="chat-badge">' + (chat.naoLidas > 99 ? '99+' : chat.naoLidas) + '</span>' : '') + '</button>';
      return;
    }
    var texto = document.getElementById('chat-texto');
    var rascunho = texto ? texto.value : '';
    var focado = texto && document.activeElement === texto;
    if (chat.canal === 'alianca' && !chatDaAlianca()) chat.canal = 'global';
    var daAlianca = chat.canal === 'alianca', lista = daAlianca ? chat.al.mensagens : chat.mensagens;
    var titulo = chatDaAlianca()
      ? '<span class="chat-canais"><button data-chat="canal" data-canal="global" class="' + (daAlianca ? '' : 'ativo') + '">Global</button>'
        + '<button data-chat="canal" data-canal="alianca" class="' + (daAlianca ? 'ativo' : '') + '">Clã</button></span>'
      : '<strong>Chat Global</strong>';
    chat.el.innerHTML = '<div class="chat-janela"><div class="chat-topo">' + titulo
      + '<button data-chat="fechar" title="Fechar">✕</button></div>'
      + '<div class="chat-lista" id="chat-lista">' + (lista.length ? lista.map(daAlianca ? linhaChatAlianca : linhaChat).join('')
        : '<p class="suave pequeno">Nenhuma mensagem ainda. Diga olá!</p>') + '</div>'
      + '<div class="chat-envio"><input id="chat-texto" maxlength="200" placeholder="Escreva como ' + esc(estado.personagem ? estado.personagem.nome : '') + '…" autocomplete="off">'
      + '<button class="btn" data-chat="enviar">Enviar</button></div></div>';
    var novo = document.getElementById('chat-texto');
    novo.value = rascunho;
    if (focado) novo.focus();
    var lista = document.getElementById('chat-lista');
    lista.scrollTop = lista.scrollHeight;
  }

  async function buscarChat(completa) {
    clearTimeout(chat.timer);
    if (!chat.ativo) return;
    try {
      // A cada 30 s busca tudo de novo (para sumir o que o admin apagou).
      if (completa || C.agora() - chat.ultimaCompleta > 30000) {
        var todas = await C.chat.recentes();
        chat.ultimaCompleta = C.agora();
        var novasQtd = todas.filter(function (m) { return m.id > chat.ultimoId; }).length;
        if (chat.ultimoId && !chat.aberto) chat.naoLidas += novasQtd;
        chat.mensagens = todas;
      } else {
        var novas = await C.chat.novas(chat.ultimoId);
        if (!chat.aberto) chat.naoLidas += novas.length;
        chat.mensagens = chat.mensagens.concat(novas).slice(-100);
      }
      if (chat.mensagens.length) chat.ultimoId = Math.max(chat.ultimoId, chat.mensagens[chat.mensagens.length - 1].id);
      if (chat.aberto && chat.canal === 'alianca' && chatDaAlianca()) {
        var pid = estado.personagem.id;
        if (chat.al.pid !== pid) chat.al = { pid: pid, mensagens: [], ultimoId: 0 };
        var novasAl = await C.alianca.chat(pid, chat.al.ultimoId);
        chat.al.mensagens = chat.al.mensagens.concat(novasAl).slice(-100);
        if (chat.al.mensagens.length) chat.al.ultimoId = chat.al.mensagens[chat.al.mensagens.length - 1].id;
      }
      if (chat.ativo) desenharChat();
    } catch (e) { /* sem conexão: tenta de novo no próximo ciclo */ }
    if (chat.ativo) chat.timer = setTimeout(buscarChat, document.hidden ? 60000 : chat.aberto ? 4000 : 20000);
  }

  async function enviarChat() {
    var campo = document.getElementById('chat-texto');
    var texto = campo.value.trim();
    if (!texto || !estado.personagem) return;
    try {
      if (chat.canal === 'alianca') await C.alianca.chatEnviar(estado.personagem.id, texto);
      else await C.chat.enviar(estado.personagem.nome, texto);
      campo.value = '';
      buscarChat();
    } catch (e) { avisar(e.message); }
  }

  async function cliqueChat(e) {
    var el = e.target.closest('[data-chat]');
    if (!el) return;
    var acao = el.dataset.chat;
    if (acao === 'abrir' || acao === 'fechar') {
      chat.aberto = acao === 'abrir';
      chat.naoLidas = 0;
      desenharChat();
      if (chat.aberto) { document.getElementById('chat-texto').focus(); buscarChat(); }
    } else if (acao === 'enviar') {
      enviarChat();
    } else if (acao === 'canal') {
      chat.canal = el.dataset.canal;
      desenharChat();
      buscarChat();
    } else if (acao === 'apagar' && ehAdmin()) {
      try { await C.chat.apagar(Number(el.dataset.id)); buscarChat(true); } catch (erro) { avisar(erro.message); }
    } else if (acao === 'silenciar' && ehAdmin()) {
      var nome = el.dataset.nome;
      var resp = window.prompt('Silenciar ' + nome + ' por quantas horas?\n(ex.: 1, 24 · "sempre" = para sempre · 0 = liberar)', '1');
      if (resp === null || resp.trim() === '') return;
      var horas = /^sempre$/i.test(resp.trim()) ? null : parseInt(resp, 10);
      if (horas !== null && isNaN(horas)) { avisar('Valor inválido.'); return; }
      try {
        await C.chat.silenciar(nome, horas);
        avisar(horas === 0 ? nome + ' pode falar de novo.' : nome + (horas === null ? ' não pode mais falar no chat.' : ' não pode falar no chat por ' + horas + 'h.'));
      } catch (erro) { avisar(erro.message); }
    }
  }

  // ---------------- Instalar o jogo na tela inicial (app) ----------------
  // Android/Chrome: o navegador avisa que dá para instalar (beforeinstallprompt) e o botão abre a janela de instalar.
  // iPhone: não existe essa janela; o botão explica o caminho pelo Safari. Já instalado: o botão some.
  var instalacao = { evento: null };
  function jaInstalado() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function ehIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function ehCelular() { return ehIOS() || /android|mobi/i.test(navigator.userAgent); }
  // No celular aparece sempre (se ainda não instalou); no computador, só quando o navegador deixa instalar.
  function podeInstalar() { return !jaInstalado() && (!!instalacao.evento || ehCelular()); }
  // App Android (APK) para baixar direto do site; some no iPhone e dentro do próprio app.
  function botaoInstalar() {
    return '<button class="btn largo btn-instalar" data-acao="instalar-app"' + (podeInstalar() ? '' : ' hidden') + '>📲 Instalar para celular</button>'
      + (jaInstalado() || ehIOS() ? '' : '<a class="btn secundario largo btn-apk" href="baixar/Eldrin.apk" download="Eldrin.apk">🤖 Baixar app Android (APK)</a>'
        + '<p class="suave pequeno dica-apk">Depois de baixar, toque no arquivo e permita "instalar de fontes desconhecidas".</p>');
  }
  function atualizarBotoesInstalar() {
    document.querySelectorAll('[data-acao="instalar-app"]').forEach(function (b) { b.hidden = !podeInstalar(); });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); instalacao.evento = e; atualizarBotoesInstalar(); });
  window.addEventListener('appinstalled', function () { instalacao.evento = null; atualizarBotoesInstalar(); avisar('Eldrin instalado! Procure o ícone na tela inicial. 🎉'); });
  function instalarApp() {
    if (instalacao.evento) {
      var ev = instalacao.evento;
      ev.prompt();
      (ev.userChoice || Promise.resolve()).then(function () { instalacao.evento = null; atualizarBotoesInstalar(); });
      return;
    }
    if (ehIOS()) avisar('No iPhone: toque em Compartilhar (quadrado com a seta) e depois em "Adicionar à Tela de Início".');
    else avisar('Abra o menu ⋮ do navegador e toque em "Instalar app" ou "Adicionar à tela inicial".');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-acao="instalar-app"]');
    if (b) { e.preventDefault(); e.stopPropagation(); instalarApp(); }
  }, true);

  // ---------------- Música de fundo e configurações ----------------
  // Interface escolhida (index.html já carregou o tema certo antes de desenhar): 'classica' ou 'zealot'.
  function interfaceAtual() { return document.documentElement.getAttribute('data-interface') === 'zealot' ? 'zealot' : 'classica'; }
  // Cada cena tem a sua música: entrada (login, personagens, criação), jogo (as duas célticas se revezando),
  // masmorra, arena e chefe. Ao trocar de cena uma música some aos poucos e a outra entra.
  // Os navegadores não deixam tocar som sozinho: a música começa no primeiro clique ou tecla.
  // O botão ⚙ abre as configurações (música ligada, volume da música e dos efeitos), guardadas neste aparelho.
  var FAIXAS = {
    entrada: [{ nome: 'Arena & Glória (tema)', arquivo: 'tema-eldrin.mp3' }],
    jogo: [{ nome: 'Brumas do Reino', arquivo: 'brumas-do-reino.mp3' }, { nome: 'Luz das Brumas', arquivo: 'luz-das-brumas.mp3' }],
    masmorra: [{ nome: 'Halls Below', arquivo: 'masmorra-halls-below.mp3' }],
    arena: [{ nome: 'Eldrin — Arena e Glória', arquivo: 'arena-e-gloria.mp3' }],
    chefe: [{ nome: 'Eldrin of Fate', arquivo: 'chefe-eldrin-of-fate.mp3' }],
  };
  var musica = { ligada: true, volume: 35, efeitos: 100, cena: null, atual: null, faixa: 0, botao: null, painel: null };
  try {
    musica.ligada = localStorage.getItem('eldrin.musica') !== 'off';
    var vGuardado = parseInt(localStorage.getItem('eldrin.volume'), 10), eGuardado = parseInt(localStorage.getItem('eldrin.efeitos'), 10);
    if (!isNaN(vGuardado)) musica.volume = Math.max(0, Math.min(100, vGuardado));
    if (!isNaN(eGuardado)) musica.efeitos = Math.max(0, Math.min(100, eGuardado));
  } catch (e) { /* sem armazenamento: usa o padrão */ }
  Sons.volume(musica.efeitos / 100);
  function guardar(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* ignora */ } }
  function volumeAlvo() { return musica.volume / 100; }
  // Some com um áudio aos poucos (~1,2 s) e pausa. No iPhone/iPad o volume não muda por código (fica sempre 1):
  // por isso a pausa vem por tempo, senão a música velha nunca parava e tocava junto com a nova.
  var audios = [];   // todos os áudios de música criados (para desligar de verdade)
  function sumir(audio) {
    if (!audio) return;
    var passos = 0;
    var t = setInterval(function () {
      var v = audio.volume - 0.04;
      if (v <= 0.01 || audio.paused || ++passos >= 25) { clearInterval(t); audio.pause(); } else audio.volume = v;
    }, 50);
  }
  function pararTodas() { audios.forEach(function (a) { a.pause(); }); }
  function entrar(audio) {
    audio.volume = 0;
    var t = setInterval(function () {
      var alvo = volumeAlvo(), v = Math.min(alvo, audio.volume + 0.03);
      audio.volume = v;
      if (v >= alvo || audio !== (musica.atual && musica.atual.audio)) clearInterval(t);
    }, 50);
  }
  function novaFaixa(cena) {
    var lista = FAIXAS[cena], i = cena === 'jogo' ? musica.faixa % lista.length : 0, f = lista[i];
    var audio = new Audio('assets/musica/' + f.arquivo + '?v=1');
    audios = audios.filter(function (a) { return !a.paused; });   // as pausadas já pararam
    audios.push(audio);
    audio.muted = musica.volume === 0;   // no iPhone, volume 0 só funciona como "mudo"
    audio.loop = lista.length === 1;
    audio.addEventListener('ended', function () {   // playlist do jogo: passa para a próxima
      if (musica.atual && musica.atual.audio === audio) { musica.faixa++; musica.atual = null; tocarMusica(); }
    });
    return { cena: cena, nome: f.nome, audio: audio };
  }
  function tocarMusica() {
    if (!musica.ligada || !musica.cena) return;
    var a = musica.atual;
    if (a && a.cena !== musica.cena) { sumir(a.audio); a = musica.atual = null; }
    if (!a) a = musica.atual = novaFaixa(musica.cena);
    if (!a.audio.paused) return;
    var p = a.audio.play();
    entrar(a.audio);
    if (p && p.then) p.then(function () { desenharBotaoMusica(); }, function () { desenharBotaoMusica(); /* sem toque ainda: tenta no próximo */ });
    desenharBotaoMusica();
  }
  function cenaMusica(cena) {
    if (musica.cena === cena) return;
    musica.cena = cena;
    if (!cena) { if (musica.atual) sumir(musica.atual.audio); musica.atual = null; }
    else tocarMusica();
    desenharBotaoMusica();
  }
  // Compat: telas de entrada chamam areaMusica(true).
  function areaMusica(sim) { cenaMusica(sim ? 'entrada' : 'jogo'); }
  // Qual música combina com o que está na tela do jogo.
  function cenaDoJogo() {
    var c = estado.cacada, b = estado.batalha, L = estado.luta;
    if (c && c.ativa && c.encontro && c.encontro.chefe && (c.fase === 'encontrou' || c.fase === 'lutando')) return 'chefe';
    if (b && !b.fim && D.monstros[b.monstroId] && D.monstros[b.monstroId].chefe) return 'chefe';
    if (L && L.sim && L.sim.inicio.salas[L.sala] && L.sim.inicio.salas[L.sala].some(function (m) { return m.chefe; })) return 'chefe';
    if (estado.lutaArena || estado.aba === 'arena') return 'arena';
    if (L || estado.aba === 'masmorra') return 'masmorra';
    return 'jogo';
  }
  function atualizarMusica() { cenaMusica(cenaDoJogo()); }

  function desenharBotaoMusica() {
    if (!musica.botao) {
      musica.botao = document.createElement('button');
      musica.botao.id = 'botao-musica';
      musica.botao.textContent = '⚙';
      musica.botao.addEventListener('click', function (e) { e.stopPropagation(); tocarMusica(); alternarPainel(); });
      document.body.appendChild(musica.botao);
    }
    // Ligada mas ainda sem tocar (o navegador espera um toque): o botão pisca chamando.
    var esperando = musica.ligada && !!musica.cena && (!musica.atual || musica.atual.audio.paused);
    musica.botao.classList.toggle('esperando', esperando);
    musica.botao.title = esperando ? 'Configurações (toque para a música começar)' : 'Configurações';
    musica.botao.setAttribute('aria-label', 'Configurações');
    if (musica.painel) {
      var t = musica.painel.querySelector('.config-tocando');
      if (t) t.textContent = !musica.ligada ? 'Música desligada' : musica.atual && !musica.atual.audio.paused ? '♪ ' + musica.atual.nome : '♪ —';
    }
  }
  // Botões da tela de Interface: Tema (eldrin.interface), só no computador; no celular é sempre a casca
  // (Daniel, nov/2026). Guarda neste aparelho e recarrega a página (o tema entra antes de desenhar).
  function ligarPainelInterface(p) {
    p.querySelectorAll('[data-interface]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.interface === interfaceAtual()) return;
        guardar('eldrin.interface', b.dataset.interface);
        try { document.cookie = 'eldrin_interface=' + b.dataset.interface + '; path=/; max-age=31536000; SameSite=Lax'; } catch (e) { /* ignora */ }
        setTimeout(function () { location.reload(); }, 150);   // dá tempo de gravar (iPhone)
      });
    });
  }
  // tipo: 'interface' abre a tela de Interface (tema e tela); sem tipo, a de Som (música e efeitos).
  function alternarPainel(fechar, tipo) {
    tipo = tipo || 'som';
    if (musica.painel || fechar) {
      var outro = musica.painel && musica.painelTipo !== tipo && !fechar;
      if (musica.painel) { musica.painel.remove(); musica.painel = null; }
      if (!outro) return;
    }
    var p = musica.painel = document.createElement('div');
    musica.painelTipo = tipo;
    p.id = 'config-painel';
    p.setAttribute('role', 'dialog');
    if (tipo === 'interface') {
      p.setAttribute('aria-label', 'Interface');
      p.innerHTML = '<div class="config-topo"><strong>🎨 Interface</strong><button class="config-fechar" aria-label="Fechar">✕</button></div>'
        + (document.documentElement.hasAttribute('data-celular') ? '<p class="suave pequeno">No celular o jogo usa sempre a tela própria do celular. As interfaces Clássica e Zealot são para o computador.</p>'
          : '<div class="config-faixa"><span>Tema</span><div class="config-interface" role="radiogroup" aria-label="Tema">'
          + [['classica', 'Clássica'], ['zealot', 'Zealot']].map(function (x) {
            var ativa = interfaceAtual() === x[0];
            return '<button type="button" role="radio" aria-checked="' + ativa + '" class="btn mini-opcao' + (ativa ? '' : ' secundario') + '" data-interface="' + x[0] + '">' + (ativa ? '✔ ' : '') + x[1] + '</button>';
          }).join('') + '</div></div>');
      ligarPainelInterface(p);
      p.addEventListener('click', function (e) { e.stopPropagation(); });
      p.querySelector('.config-fechar').addEventListener('click', function () { alternarPainel(true); });
      document.body.appendChild(p);
      return;
    }
    p.setAttribute('aria-label', 'Som');
    p.innerHTML = '<div class="config-topo"><strong>Configurações</strong><button class="config-fechar" aria-label="Fechar">✕</button></div>'
      + '<label class="config-linha"><span>Música</span><input type="checkbox" id="config-musica"' + (musica.ligada ? ' checked' : '') + '></label>'
      + '<label class="config-faixa"><span>Volume da música <b id="config-vol-txt">' + musica.volume + '%</b></span>'
      + '<input type="range" id="config-volume" min="0" max="100" step="5" value="' + musica.volume + '"></label>'
      + '<label class="config-faixa"><span>Volume dos efeitos <b id="config-efe-txt">' + musica.efeitos + '%</b></span>'
      + '<input type="range" id="config-efeitos" min="0" max="100" step="5" value="' + musica.efeitos + '"></label>'
      + '<p class="config-tocando suave pequeno"></p>' + botaoInstalar();
    p.addEventListener('click', function (e) { e.stopPropagation(); });
    p.querySelector('.config-fechar').addEventListener('click', function () { alternarPainel(true); });
    p.querySelector('#config-musica').addEventListener('change', function (e) {
      musica.ligada = e.target.checked;
      guardar('eldrin.musica', musica.ligada ? 'on' : 'off');
      if (musica.ligada) tocarMusica(); else pararTodas();
      desenharBotaoMusica();
    });
    p.querySelector('#config-volume').addEventListener('input', function (e) {
      musica.volume = parseInt(e.target.value, 10);
      p.querySelector('#config-vol-txt').textContent = musica.volume + '%';
      if (musica.atual) { musica.atual.audio.volume = volumeAlvo(); musica.atual.audio.muted = musica.volume === 0; }
      guardar('eldrin.volume', musica.volume);
    });
    p.querySelector('#config-efeitos').addEventListener('input', function (e) {
      musica.efeitos = parseInt(e.target.value, 10);
      p.querySelector('#config-efe-txt').textContent = musica.efeitos + '%';
      Sons.volume(musica.efeitos / 100);
      guardar('eldrin.efeitos', musica.efeitos);
    });
    p.querySelector('#config-efeitos').addEventListener('change', function () { Sons.sucesso && Sons.sucesso(); });
    document.body.appendChild(p);
    desenharBotaoMusica();
  }
  document.addEventListener('click', function (e) {
    if (musica.painel && !e.target.closest('#config-painel') && !e.target.closest('#botao-musica, [data-acao="menu-som"], [data-acao="menu-interface"]')) alternarPainel(true);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && musica.painel) alternarPainel(true); });
  // Eventos que o navegador aceita como "o jogador interagiu" (no celular o toque conta no fim: touchend/click).
  var TOQUES = ['click', 'touchend', 'keydown'];
  function primeiroToque(e) {
    if (e && e.target && e.target.closest && e.target.closest('#botao-musica')) return;   // o próprio botão cuida
    if (!musica.ligada || (musica.atual && !musica.atual.audio.paused)) return;
    tocarMusica();
  }
  TOQUES.forEach(function (ev) { document.addEventListener(ev, primeiroToque, true); });
  desenharBotaoMusica();

  // ---------------- Início ----------------
  app.innerHTML = '<p class="carregando">Conectando ao servidor…</p>';
  // ---- Versão nova publicada: atualiza a página sozinho (Henri, nov/2026) ----
  // A cada 2 min (e ao voltar para a aba) baixa a página do jogo sem cache e compara os ?v= dos scripts e estilos
  // com os desta página. Mudou = alguém publicou: avisa e recarrega, esperando acabar a luta que estiver na tela.
  function assinaturaVersao(texto) { return (texto.match(/\.(?:js|css)\?v=\d+/g) || []).sort().join(','); }
  var versaoCarregada = assinaturaVersao(Array.prototype.map.call(document.querySelectorAll('script[src],link[rel=stylesheet][href]'),
    function (e) { return e.getAttribute('src') || e.getAttribute('href'); }).join(' '));
  var atualizando = false;
  // DESLIGADO (Henri, 10/11/2026): causou problema (provável: o GitHub Pages guarda a página por até 10 min, então o
  // recarregar abria a versão velha de novo e o jogo recarregava em loop). Para ligar: true (e resolver esse cache antes).
  var ATUALIZAR_SOZINHO = false;
  function ocupadoParaAtualizar() { return !!(estado.batalha || estado.luta || estado.lutaArena || (estado.cacada && estado.cacada.lutando)); }
  function recarregarQuandoLivre() {
    if (ocupadoParaAtualizar()) { setTimeout(recarregarQuandoLivre, 3000); return; }
    location.reload();
  }
  function conferirVersao() {
    if (!ATUALIZAR_SOZINHO || atualizando || !versaoCarregada || location.protocol === 'file:' || !/\/jogar\/?/.test(location.pathname)) return;
    fetch(location.pathname + '?nova=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
      var nova = assinaturaVersao(html);
      if (!nova || nova === versaoCarregada || atualizando) return;
      atualizando = true;
      avisar('✨ Saiu uma versão nova do Eldrin! Atualizando o jogo…', 'nivel');
      setTimeout(recarregarQuandoLivre, 4000);
    }).catch(function () {});
  }
  setInterval(conferirVersao, 120000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) conferirVersao(); });

  C.iniciar().then(function (conta) {
    estado.conta = conta;
    if (conta) { if (!retomarJogo()) depoisDeEntrar(); } else telaAuth('entrar');
  });
})();
