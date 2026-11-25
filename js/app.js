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
    desenharMissoes(false); desenharGrupo(false);
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
    var rastro = '', extra = '';
    if (chave) {
      var antes = larguras[chave];
      larguras[chave] = pct;
      if (antes !== undefined && antes > pct) { rastro = '<s style="--de:' + antes + '%;--ate:' + pct + '%"></s>'; extra += ' levou-dano'; }
    }
    // Vida baixa (até 25%) do herói: o visual Arcane pisca a barra em vermelho. Só a classe; cada tema decide o estilo.
    if (classe === 'hp' && chave !== 'monstro' && max > 0 && atual > 0 && pct <= 25) extra += ' vida-baixa';
    return '<div class="barra ' + classe + extra + '">' + rastro + '<i style="width:' + pct + '%"></i><b>' + texto + '</b></div>';
  }
  function fmt(n) { return Number.isInteger(n) ? n : n.toFixed(1); }
  function dano(d) { return d[0] === d[1] ? d[0] : d[0] + '–' + d[1]; }
  // Dano de monstro para mostrar: x R.fatorVida do herói (os monstros batem mais desde a vida por level maior, 21/11/2026).
  function danoMonstro(d) {
    var f = estado.personagem ? R.fatorVida(estado.personagem) : 1;
    return dano([Math.max(1, Math.round(d[0] * f)), Math.max(1, Math.round(d[1] * f))]);
  }

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
    // grupo e arma preferida (16/11/2026)
    var pg = estado.personagem, ga = D.TIPOS_ARMA[R.tipoArmaId(item)];
    if (ga) l.push('Grupo ' + D.GRUPOS_ITEM.nomes[R.grupoDaClasse(ga.classe)]);
    if (pg && R.podeUsar(pg, item) && R.armasPreferidas(pg).indexOf(R.tipoArmaId(item)) < 0)
      l.push('Não é arma preferida da sua classe: habilidades com ' + D.GRUPOS_ITEM.foraPreferida + '% do dano');
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

  // Etapa 5 do plano "tudo no servidor": o jogo não grava mais a ficha inteira. O que vale algo já foi gravado pela
  // ação do servidor; aqui só vão as preferências (o servidor ignora o resto). Administradores e o jeito antigo (sem a
  // função `acao`) ainda gravam direto.
  function salvar() {
    if (typeof ACAO_SERVIDOR !== 'undefined' && ACAO_SERVIDOR && !ehAdmin()) { salvarPreferencias(); return; }
    salvarFichaDireto();
  }
  function salvarFichaDireto() {
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

  // Cronômetro da abertura dos cadastros (Henri, 25/11/2026): até 25/11 18:00 de Brasília o "Cadastrar" mostra a contagem.
  var ABRE_CADASTRO = Date.parse('2026-11-25T18:00:00-03:00');
  function textoContagem(ate) {
    var s = Math.max(0, Math.floor((ate - Date.now()) / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    var dd = function (n) { return (n < 10 ? '0' : '') + n; };
    return s ? '<span><b>' + dd(h) + '</b><small>horas</small></span><i>:</i><span><b>' + dd(m) + '</b><small>min</small></span><i>:</i><span><b>' + dd(ss) + '</b><small>seg</small></span>'
      : '<span class="abriu">Abriu! Toque em Cadastrar.</span>';
  }
  setInterval(function () {
    Array.prototype.forEach.call(document.querySelectorAll('.contagem-abertura'), function (el) {
      var ate = Number(el.getAttribute('data-ate'));
      el.innerHTML = textoContagem(ate);
      if (Date.now() >= ate && !el.dataset.abriu) {   // zerou: troca pelo formulário de cadastro
        el.dataset.abriu = '1';
        var b = document.querySelector('[data-acao=auth][data-modo=cadastro]');
        if (b) setTimeout(function () { b.click(); }, 800);
      }
    });
  }, 1000);
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
      : cadastro && Date.now() < ABRE_CADASTRO
      // Cadastros fechados até a nova rodada (Henri, 25/11/2026, anúncio no Instagram): mostra o cronômetro.
      ? '<div class="abertura"><p class="abertura-titulo">⏳ O Beta aberto começa hoje às 18h</p>'
        + '<div class="contagem-abertura" data-ate="' + ABRE_CADASTRO + '">' + textoContagem(ABRE_CADASTRO) + '</div>'
        + '<p class="suave">Os cadastros abrem quando o cronômetro zerar. Volte aqui às 18h para criar sua conta e começar sua lenda!</p>'
        + '<a class="btn secundario largo" href="https://discord.gg/85ZFvz6ye" target="_blank" rel="noopener">Entrar no Discord enquanto espera</a></div>'
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

  // Aviso do reset da rodada de teste (Henri, 25/11/2026): faixa no topo + janela 1 vez ao entrar. Na hora marcada o
  // jogo pede o reset (reserva do pg_cron) e recarrega a página.
  var resetInfo = null, resetRelogio = null, resetPerguntado = false;
  function conferirReset() {
    if (resetPerguntado || !C.resetRodada) { if (resetInfo) mostrarReset(); return; }
    resetPerguntado = true;   // pergunta ao servidor 1 vez por sessão (telaJogo chama isto a cada desenho)
    C.resetRodada().then(function (r) { if (r && r.em && !r.feito) { resetInfo = r; mostrarReset(true); } }, function () {});
  }
  function mostrarReset(primeiraVez) {
    if (!resetInfo || resetInfo.feito) return;
    var fim = Date.parse(resetInfo.em), hora = new Date(fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    var faixa = document.getElementById('faixa-reset');
    if (!faixa) { faixa = document.createElement('div'); faixa.id = 'faixa-reset'; faixa.setAttribute('role', 'alert'); document.body.appendChild(faixa); }
    var pinta = function () {
      var falta = Math.max(0, Math.round((fim - Date.now()) / 60000));
      faixa.textContent = '⚠️ Última rodada de teste: hoje às ' + hora + ' todos os personagens e clãs serão excluídos'
        + (falta > 0 ? ' (faltam ' + (falta >= 60 ? Math.floor(falta / 60) + ' h ' : '') + (falta % 60) + ' min).' : '.');
      if (Date.now() >= fim && !resetInfo.pedido) {
        resetInfo.pedido = true;
        faixa.textContent = '⏳ Excluindo os personagens da rodada de teste…';
        C.resetRodada().catch(function () {}).then(function () { setTimeout(function () { location.reload(); }, 2500); });
      }
    };
    pinta();
    if (!resetRelogio) resetRelogio = setInterval(pinta, 30000);
    if (primeiraVez && Date.now() < fim) {
      var j = document.createElement('div');
      j.className = 'zoom-fundo aviso-reset-fundo';
      j.innerHTML = '<div class="zoom-janela aviso-reset"><h3>⚠️ Última rodada de teste</h3><p>Hoje, às <strong>' + hora + '</strong>, <strong>todos os personagens e clãs serão excluídos</strong>'
        + ' (e também o baú, o Éter e os recordes) para começarmos a última rodada de teste.</p><p class="suave">Aproveite até lá! Depois é só criar um personagem novo.</p>'
        + '<div class="botoes"><button class="btn" type="button">Entendi</button></div></div>';
      j.querySelector('button').onclick = function () { j.remove(); };
      document.body.appendChild(j);
    }
  }
  function telaPersonagens() {
    chatVisivel(false);
    conferirReset();
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
    if (atividade.desdeSalvar >= 60) { atividade.desdeSalvar = 0; salvarPreferencias(); }
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
    salvarPreferencias();
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
    if (window.EldrinNativo) EldrinNativo.entrou(estado.personagem);   // notificações do app (19/11/2026)
    estado.loja = null; estado.lojaErro = null; estado.lojaConfirma = null;
    guardarVip(!!estado.personagem.vip); conferirArcane();
    if (ACAO_SERVIDOR) { carregarLoja(); carregarVips(); }
    // Créditos e mensagens do Reino (SQL Editor): busca ao entrar e a cada 2 min (fora de luta).
    clearInterval(estado.timerPendentes);
    setTimeout(function () { if (ACAO_SERVIDOR && estado.personagem) receberPendentes(); }, 4000);
    estado.timerPendentes = setInterval(function () {
      if (ACAO_SERVIDOR && estado.personagem && !estado.luta && !estado.batalha && !estado.lutaArena && document.visibilityState !== 'hidden') receberPendentes();
    }, 120000);
    var presente = estado.personagem.recomecoPresente === 1, presenteForca = estado.personagem.presenteForcaCacador === 1;
    var presenteDes = estado.personagem.presenteDestrezaCacador === 1, qtdDes = presenteForca ? 2 : 1;
    var presenteA3 = estado.personagem.presenteAtributos3 === 1;
    if (presenteA3) estado.personagem.presenteAtributos3 = 2;
    if (estado.personagem.avisoPactoV2 === 1) {   // Pacto v2 (20/11/2026): os pontos voltaram de graça
      estado.personagem.avisoPactoV2 = 2;
      setTimeout(function () { avisar('🔮 O Pacto de Ascensão mudou! Seus pontos voltaram de graça: escolha o caminho de novo (Herói › Pacto).', 'nivel'); }, 1600);
    }
    if (presente) estado.personagem.recomecoPresente = 2;
    if (presenteForca) estado.personagem.presenteForcaCacador = 2;
    if (presenteDes) { estado.personagem.presenteDestrezaCacador = 2; presenteForca = false; }
    salvarPreferencias();   // também marca o personagem como online para os amigos
    if (presenteA3) setTimeout(function () {
      avisar('🎁 Os atributos mudaram! Agora o atributo da sua classe (Força, Destreza ou Inteligência) dá +1% de dano por ponto, a Sorte cuida de encanto e drop e a Resistência da vida. Você ganhou 1 ' + D.RECOMECO.nome + ' para redistribuir seus pontos (Herói > Atributos).', 'item');
    }, 800);
    else if (presente) setTimeout(function () {
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
      : min === null ? 'Sem acampar a estamina não volta (só com pote).'
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
    trade: svg('<path d="M7 7h11l-3-3M17 17H6l3 3"/>'),   // Trade (25/11/2026): duas setas trocando
    personagem: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    bau: svg('<rect x="3" y="9" width="18" height="11" rx="1"/><path d="M3 13h18M5 9V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2"/><rect x="10.5" y="11.5" width="3" height="3" rx=".5"/>'),
    encantar: svg('<path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M18 6l-2.5 2.5m-7 7L6 18"/>'),
    torre: svg('<path d="M7 21V9l-2-2V3h3v2h2V3h4v2h2V3h3v4l-2 2v12Z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4M11 11h2"/>'),
    eventos: svg('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><circle cx="7" cy="7" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="18.5" cy="18.5" r="1"/><path d="M14 4h3l3 3v3M10 20H7l-3-3v-3"/>'),
    habilidades: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>'),
    ascensao: svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="3.5" r="1.6"/><circle cx="19.4" cy="16.2" r="1.6"/><circle cx="4.6" cy="16.2" r="1.6"/><path d="M12 9V5.1m2.6 8.4 3.4 2m-8.6-2-3.4 2"/>'),
    cacar: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>'),
    masmorra: svg('<path d="M4 21V10a8 8 0 0 1 16 0v11Z"/><path d="M8 21v-7m4 7v-8m4 8v-7M4 14h16"/>'),
    historia: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>'),
    social: svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0m1-5a5 5 0 0 1 5 5"/>'),
    ranking: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5a3 3 0 0 0 3 4m8-4h3a3 3 0 0 1-3 4M12 13v4m-4 4h8m-6-4h4"/>'),
    alianca: svg('<path d="M6 3v18M6 4h11l-3 4 3 4H6"/>'),
    oficina: svg('<path d="M3 21h18M6 21v-4h12v4M9 17V9l-4-4 3-2 5 5h2v9"/><path d="m14 8 5-5 2 2-5 5"/>'),
    mercadoNegro: svg('<path d="M4 10c0-3 3.6-6 8-6s8 3 8 6v1H4Z"/><path d="M6 11v9h12v-9M10 20v-5h4v5"/>'),
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
    aventura: svg('<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3z"/><path d="M12 3v1.6M12 19.4V21M3 12h1.6M19.4 12H21"/>'),   // bússola (19/11/2026)
    leilao: svg('<path d="m8 4 8 8m-6-10 8 8m-7-1-7 7m9 3h8m-8 3h8"/>'),
    loja: svg('<path d="M12 2 19 9 12 22 5 9Z"/><path d="M5 9h14M9.5 9 12 2l2.5 7L12 22Z"/>'),
    mercado: svg('<path d="M4 7.5h16l-1.3 12.3a1.8 1.8 0 0 1-1.8 1.7H7.1a1.8 1.8 0 0 1-1.8-1.7z"/><path d="M8.5 10V6a3.5 3.5 0 0 1 7 0v4"/>'),   // sacola
    oficinas: svg('<path d="M3 21h18M5 21V11l7-5 7 5v10"/><path d="m10 14 4 4m0-4-4 4"/>'),
    social: svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.8 14.5c2.3.2 3.9 1.9 4.4 4.6"/>'),
    cadeado: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10V7.5a5 5 0 0 1 10 0V10h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7.5a3 3 0 0 0-6 0z"/></svg>',
    admin: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  };

  // Barra fixa no alto: ouro, reputação, poções do dia e entradas da Arena.
  // Números curtos (Henri, nov/2026): 52.459 → 52.4k · 2.495.382 → 2.495M · 1.250.000.000 → 1.25B (corta, não arredonda).
  // Na barra de recursos da Arcane; o número inteiro aparece ao passar o mouse (title).
  function numCurto(n) {
    n = Math.floor(Number(n) || 0);
    var a = Math.abs(n), corta = function (v, casas) { var f = Math.pow(10, casas); return String(Math.floor(v * f) / f); };
    if (a < 1000) return String(n);
    var t = a >= 1e9 ? corta(a / 1e9, 3) + 'B' : a >= 1e6 ? corta(a / 1e6, 3) + 'M' : corta(a / 1e3, 1) + 'k';
    return (n < 0 ? '-' : '') + t;
  }
  function numRecurso(n) { return temaAtual() === 'arcane' ? numCurto(n) : Number(n || 0).toLocaleString('pt-BR'); }
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
    return '<div class="barra-recursos" id="recursos">' + (estado.subTopo ? '<div class="sub-linha">' + subAbasHtml() + '</div>' : '') + '<div class="recursos-dentro">'
      + recurso('r-vida r-estamina', 'Estamina: cada luta da caçada gasta. Enche com o tempo, acampando ou com potes (Mercado)', ICONES.estamina || '⚡', 'Estamina', '<span id="rec-estamina">' + R.estamina(p).pts + '</span>/' + D.ESTAMINA.maximo)
      + recurso('r-ouro', 'Ouro: ' + p.ouro.toLocaleString('pt-BR'), ICONES.ouro, 'Ouro', numRecurso(p.ouro))
      + recurso('r-reputacao', 'Reputação: ' + (p.reputacao || 0).toLocaleString('pt-BR'), ICONES.reputacao, 'Reputação', numRecurso(p.reputacao || 0))
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
    cla: ['🛡', 'Clã'], masmorra: ['🗝', 'Masmorra'], oficina: ['⚒', 'Oficina'], admin: ['📜', 'Mensagem do Reino'], torre: ['🗼', 'Torre'] };
  function origemCaixa(o) {
    return { boss: 'boss', leilao: 'leilao', mercado: 'mercado', oficina: 'oficina', 'boss-alianca': 'cla', torre: 'torre' }[o] || 'masmorra';
  }
  function origemCredito(m) {
    m = m || '';
    if (/^Torre/.test(m)) return 'torre';
    return /Arena/.test(m) ? 'arena' : /leilão/.test(m) ? 'leilao' : /^Mercado/.test(m) ? 'mercado' : /clã/.test(m) ? 'cla' : /^Oficina/.test(m) ? 'oficina' : 'arena';
  }
  function caixaRegistrar(origem, texto) {
    var p = estado.personagem;
    if (!p || /^Mochila cheia/.test(texto)) return;
    p.caixa = p.caixa || [];
    p.caixa.unshift({ t: C.agora(), o: origem, x: texto });
    if (p.caixa.length > 80) p.caixa.length = 80;
    salvarPreferencias();
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
      salvarPreferencias();
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
    // Anel (Henri, 21/11/2026): com os dois anéis equipados, o balão mostra os dois ao lado do novo, e cada um tem
    // o botão de trocar só aquele.
    var a1 = R.itemNoSlot(p, 'anel1'), a2 = R.itemNoSlot(p, 'anel2');
    if (!estado.fichaHover && it.tipo === 'anel' && !R.slotDoItem(p, it.id) && a1 && a2) {
      var lado = function (x, rot, sl) {
        return '<div class="comparar-lado comparar-equipado"><p class="comparar-rotulo">' + rot + '</p>' + fichaItemHtml(x, true)
          + (R.podeUsar(p, it) ? '<div class="botoes"><button class="btn btn-pequeno" data-acao="equipar" data-id="' + it.id + '" data-espaco="' + sl + '">⇄ Trocar este anel</button></div>' : '') + '</div>';
      };
      return '<div class="comparar-duas comparar-tres">' + lado(a1, 'Anel equipado (1)', 'anel1') + lado(a2, 'Anel equipado (2)', 'anel2')
        + '<div class="comparar-lado"><p class="comparar-rotulo">Na mochila</p>' + fichaItemHtml(it) + '</div></div>';
    }
    // Clique num item desequipado (Henri, 12/11/2026): a ficha abre com o equipado do mesmo lugar ao lado, para comparar.
    var eq = !estado.fichaHover && !R.slotDoItem(p, it.id) && (it.tipo === 'anel'
      ? (R.itemNoSlot(p, 'anel1') || R.itemNoSlot(p, 'anel2')) : (it.tipo in p.equipados ? R.itemNoSlot(p, it.tipo) : null));
    if (eq) return '<div class="comparar-duas"><div class="comparar-lado comparar-equipado"><p class="comparar-rotulo">Equipado</p>' + fichaItemHtml(eq, true)
      + '</div><div class="comparar-lado"><p class="comparar-rotulo">Na mochila</p>' + fichaItemHtml(it, false, true) + '</div></div>';
    return fichaItemHtml(it, false, true);
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
  // Arrastar um item da mochila para o personagem equipa (Henri, 21/11/2026). Mouse: segurar e arrastar. Dedo:
  // segurar parado um instante (para não atrapalhar a rolagem) e arrastar. Soltar num espaço do mesmo tipo (no anel,
  // no anel escolhido) ou em cima do retrato equipa; em outro lugar, nada acontece.
  var arrasto = null, arrastoFim = 0;
  function espacosDoItem(it) { return Object.keys(D.slots).filter(function (k) { return D.slots[k].tipo === it.tipo; }); }
  function comecarArrasto() {
    var a = arrasto, p = estado.personagem, it = a && p && p.inventario.find(function (i) { return i.id === a.id; });
    if (!it) { arrasto = null; return; }
    a.ativo = true; a.item = it;
    fecharFlutuante();
    var g = document.createElement('div');
    g.className = 'fantasma-arrasto borda-' + corItem(it);
    g.innerHTML = F.icone(it);
    document.body.appendChild(g); a.g = g;
    a.espacos = espacosDoItem(it);
    a.espacos.forEach(function (k) { var e = document.querySelector('.espaco-' + k); if (e) e.classList.add('pode-soltar'); });
    var b = document.querySelector('.boneco'); if (b) b.classList.add('arrastando-item');
    moverArrasto(a.x, a.y);
  }
  function alvoArrasto(x, y) {
    var el = document.elementFromPoint(x, y), a = arrasto;
    if (!el || !a) return null;
    var esp = el.closest('[class*="espaco-"]');
    if (esp) { var k = (esp.className.match(/espaco-(\w+)/) || [])[1]; return a.espacos.indexOf(k) >= 0 ? { slot: k, el: esp } : null; }
    var ret = el.closest('.retrato-central, .boneco');
    return ret ? { slot: null, el: ret } : null;
  }
  function moverArrasto(x, y) {
    var a = arrasto;
    if (!a || !a.g) return;
    a.g.style.left = x + 'px'; a.g.style.top = y + 'px';
    var alvo = alvoArrasto(x, y);
    document.querySelectorAll('.alvo-arrasto').forEach(function (e) { e.classList.remove('alvo-arrasto'); });
    if (alvo) alvo.el.classList.add('alvo-arrasto');
    a.alvo = alvo;
  }
  function acabarArrasto(soltar) {
    var a = arrasto;
    arrasto = null;
    if (!a) return;
    clearTimeout(a.timer);
    if (a.g) a.g.remove();
    document.querySelectorAll('.pode-soltar, .alvo-arrasto, .arrastando-item').forEach(function (e) { e.classList.remove('pode-soltar', 'alvo-arrasto', 'arrastando-item'); });
    if (!a.ativo) return;
    arrastoFim = Date.now();
    if (!soltar || !a.alvo) return;
    var p = estado.personagem, slot = a.alvo.slot && a.alvo.slot.indexOf('anel') === 0 ? a.alvo.slot : null;
    if (R.equipar(p, a.id, slot)) {
      estado.vendaPendente = null; estado.itemFoco = null;
      acaoServidor('equipar', slot ? { id: a.id, slot: slot } : a.id);
      telaJogo();
    } else avisar(R.motivoNaoEquipa(p, a.item) || 'Não foi possível equipar (mochila cheia?).');
  }
  app.addEventListener('pointerdown', function (e) {
    var cel = e.target.closest && e.target.closest('.pg-mochila .mochila [data-acao="item"]');
    if (!cel || estado.vendaLote || (e.pointerType === 'mouse' && e.button !== 0)) return;
    arrasto = { id: cel.dataset.id, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, ativo: false, toque: e.pointerType !== 'mouse' };
    if (arrasto.toque) { var a0 = arrasto; a0.timer = setTimeout(function () { if (arrasto === a0) comecarArrasto(); }, 350); }
  });
  window.addEventListener('pointermove', function (e) {
    var a = arrasto;
    if (!a) return;
    a.x = e.clientX; a.y = e.clientY;
    var d = Math.abs(a.x - a.x0) + Math.abs(a.y - a.y0);
    if (!a.ativo) {
      if (a.toque) { if (d > 10) acabarArrasto(false); }   // mexeu antes de segurar: é rolagem
      else if (d > 6) comecarArrasto();
      return;
    }
    moverArrasto(a.x, a.y);
  });
  window.addEventListener('pointerup', function () { acabarArrasto(true); });
  window.addEventListener('pointercancel', function () { acabarArrasto(false); });
  // durante o arrasto com o dedo, a tela não rola
  document.addEventListener('touchmove', function (e) { if (arrasto && arrasto.ativo) e.preventDefault(); }, { passive: false });
  // o clique que vem logo depois de soltar não conta (não equipa de novo nem abre a ficha)
  document.addEventListener('click', function (e) { if (Date.now() - arrastoFim < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', function (e) { if (arrasto && arrasto.ativo) e.preventDefault(); }, true);
  app.addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('.pg-mochila .mochila')) e.preventDefault(); });   // sem o arrasto nativo da imagem

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
      // Arcane no celular: os atributos também ficam na aba Personagem
      var pa = document.querySelector('.pg-atributos');
      if (pa && estado.personagem) {
        var p = estado.personagem, n = document.createElement('div');
        n.innerHTML = atributosAbaHtml(p);
        if (n.firstChild) pa.replaceWith(n.firstChild);
      }
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
  // Campos de preço da oficina: a tela se redesenha sozinha (ex.: a cada carga do servidor) e apagava o que o
  // jogador estava digitando. Guarda o que foi mudado e devolve depois de redesenhar (Daniel, 19/11/2026).
  // Ganhos com "peso" na Zealot (Daniel, 20/11/2026): depois de cada desenho compara ouro, exp, level e itens com o
  // desenho anterior e avisa o js/zealot-efeitos.js (evento "eldrin:ganho"), que mostra o +ouro/+exp flutuando, a cena
  // de level up e o brilho do drop lendário. Trocar de personagem só zera a base (sem efeito).
  var ganhoAntes = null;
  function verGanhos() {
    var p = estado.personagem;
    if (!p) { ganhoAntes = null; return; }
    var ids = {};
    (p.inventario || []).forEach(function (it) { if (it && it.id) ids[it.id] = 1; });
    Object.keys(p.equipados || {}).forEach(function (k) { var v = p.equipados[k]; if (v) ids[typeof v === 'object' ? v.id : v] = 1; });
    var agora = { id: p.id, ouro: Number(p.ouro) || 0, exp: Number(p.exp) || 0, nivel: p.nivel || 1, ids: ids };
    var a = ganhoAntes;
    ganhoAntes = agora;
    if (!a || a.id !== p.id || interfaceAtual() !== 'zealot') return;
    var d = { ouro: agora.ouro - a.ouro, exp: agora.nivel === a.nivel ? agora.exp - a.exp : 0, nivel: agora.nivel > a.nivel ? agora.nivel : 0, lendarios: [] };
    (p.inventario || []).forEach(function (it) { if (it && it.id && !a.ids[it.id] && it.raridade === 'lendaria') d.lendarios.push({ nome: R.nomeItem(it), ico: F.icone(it) }); });
    if (d.ouro > 0 || d.exp > 0 || d.nivel || d.lendarios.length) {
      try { window.dispatchEvent(new CustomEvent('eldrin:ganho', { detail: d })); } catch (e) { /* navegador antigo */ }
    }
  }
  function manterRolagem(desenhar) {
    var desenharBase = desenhar;
    desenhar = function () { desenharBase(); verGanhos(); };
    var campos = Array.prototype.filter.call(app.querySelectorAll('input[id^="of-"]'), function (c) { return c.value !== c.defaultValue; })
      .map(function (c) { return { id: c.id, v: c.value, foco: document.activeElement === c }; });
    if (campos.length) {
      var desenharSo = desenhar;
      desenhar = function () {
        desenharSo();
        campos.forEach(function (x) {
          var c = document.getElementById(x.id);
          if (c && c.value === c.defaultValue) { c.value = x.v; if (x.foco) c.focus({ preventScroll: true }); }
        });
      };
    }
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
    { id: 'heroi', nome: 'Herói', abas: ['personagem', 'encantar', 'oficina', 'habilidades', 'ascensao'] },   // Baú da conta: aba da Mochila (Henri, 19/11/2026)
    { id: 'aventura', nome: 'Aventura', abas: ['cacar', 'eventos', 'masmorra', 'torre', 'mineracao', 'mundial', 'historia'] },   // Eventos: só com evento aberto
    { id: 'arena', nome: 'Arena', abas: ['arena'] },
    { id: 'mercado', nome: 'Mercado', abas: ['mercado', 'mercadoNegro', 'oficinas'] },   // Mercado Negro: comércio entre jogadores (Henri, 13/11/2026)
    { id: 'social', nome: 'Social', abas: ['alianca', 'ranking', 'social', 'trade'] },   // Trade: Henri, 25/11/2026   // Daniel: Clã primeiro, depois Ranking e Amigos
    { id: 'leilao', nome: 'Leilão', abas: ['leilao'] },   // Henri, 19/11/2026: Social à esquerda do Leilão e a Loja à direita
    { id: 'loja', nome: 'Loja', abas: ['loja'] },   // Loja de Éter (VIP, boosts, Starter Pack, skins)
  ];
  var NOME_ABA = { loja: 'Loja de Éter', bau: 'Baú', oficinas: 'Oficinas', mercado: 'Mercado', mercadoNegro: 'Mercado Negro', leilao: 'Leilão', personagem: 'Personagem', encantar: 'Encantar', oficina: 'Oficina', habilidades: 'Habilidades', ascensao: 'Pacto', cacar: 'Caçar', masmorra: 'Masmorra', torre: 'Torre', eventos: 'Evento', mineracao: 'Mineração', mundial: 'Chefe Mundial', historia: 'História', social: 'Amigos', ranking: 'Ranking', alianca: 'Clã', trade: 'Trade' };
  // Casca do celular (Daniel, nov/2026): ligada no começo da página (data-celular). Telas e barras próprias, sobre o
  // tema Zealot; as regras e o servidor são os mesmos. Estilo em css/celular.css.
  var CELULAR = document.documentElement.hasAttribute('data-celular');
  if (CELULAR) {
    GRUPOS = GRUPOS.filter(function (g) { return g.id !== 'leilao'; });
    GRUPOS.filter(function (g) { return g.id === 'mercado'; })[0].abas.push('leilao');
  }
  // Zealot (Daniel, 20/11/2026): o Evento ganha ícone próprio na barra, fora da Aventura (só aparece com evento aberto).
  if (document.documentElement.getAttribute('data-interface') === 'zealot') {
    var gAv = GRUPOS.filter(function (g) { return g.id === 'aventura'; })[0];
    gAv.abas = gAv.abas.filter(function (a) { return a !== 'eventos'; });
    GRUPOS.splice(GRUPOS.indexOf(gAv) + 1, 0, { id: 'evento', nome: 'Evento', abas: ['eventos'] });
    ICONES.evento = ICONES_SUB.eventos;
  }
  function grupoDaAba(aba) { return GRUPOS.filter(function (g) { return g.abas.indexOf(aba) >= 0; })[0]; }
  // Abas que o jogador vê: o Pacto de Ascensão só aparece a partir do level 40 (antes ele nem sabe que existe).
  function abaVisivel(a) {
    var n = estado.personagem ? estado.personagem.nivel : 0;
    if (a === 'ascensao') return n >= D.ASCENSAO.nivelInicio;
    if (a === 'torre') return ehAdmin() || (n >= D.TORRE.nivelMin && D.TORRE.ligada);
    if (a === 'eventos') return ehAdmin() || !!(estado.eventoAtual || (estado.personagem && estado.personagem.altar && estado.personagem.altar.partida));   // evento aberto (ou partida por terminar)   // Torre do Eclipse: level 40+ (o admin vê sempre, para testar)
    return true;
  }
  function abasDe(g) { return g.abas.filter(abaVisivel); }
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
  function seloDaAba(aba) { return aba === 'habilidades' ? seloHabilidades() : aba === 'ascensao' ? seloAscensao() : aba === 'masmorra' ? seloMasmorra() : aba === 'historia' ? seloHistoria() : aba === 'arena' ? seloArena() : aba === 'social' ? seloPedidos() : aba === 'alianca' ? seloAlianca() : aba === 'trade' ? seloTrade() : ''; }
  // Topo da casca do celular: retrato (vai para o Herói), nome, level e exp; chat, missões e menu em ícones
  // (no lugar dos botões que flutuavam por cima do jogo).
  // Level 60 (Henri, 20/11/2026): a exp passa a encher o próximo ponto do Pacto; mostra "(PACTO)". null = Pacto no limite.
  // Botão X2 (Henri, 21/11/2026): em todo lugar que acelera a luta. Clicou, fica aceso (2x); clicou de novo, apaga (normal).
  function botaoX2(acao, ligado) {
    return '<button class="btn-x2' + (ligado ? ' ligado' : '') + '" data-acao="' + acao + '" aria-pressed="' + !!ligado + '" title="'
      + (ligado ? 'Velocidade 2x ligada (clique para voltar ao normal)' : 'Acelerar a luta (2x)') + '">X2</button>';
  }
  function expPacto(p) {
    if (!p || p.nivel < D.NIVEL_MAXIMO || R.pontosAscensaoTotal(p) >= D.ASCENSAO.limitePontos) return null;
    var prec = R.expPorPontoAscensao(), ex = Math.min(prec, (p.ascensao && p.ascensao.exp) || 0);
    // n/rotulo (Henri, 21/11/2026): quantos pontos do Pacto já tem, ex.: "(PACTO 23)"
    var n = R.pontosAscensaoTotal(p);
    return { pct: Math.max(0, Math.min(100, ex * 100 / prec)), n: n, rotulo: '(PACTO ' + n + ')' };
  }
  function cascaTopoHtml(menu) {
    var p = estado.personagem, precisa = R.expNecessaria(p.nivel), maximo = p.nivel >= D.NIVEL_MAXIMO, ep = expPacto(p);
    var pct = ep ? ep.pct : maximo ? 100 : Math.max(0, Math.min(100, p.exp / precisa * 100));
    var prontas = avisosMissoes(p, C.agora());
    return '<header class="topo casca-topo"><button class="casca-eu" data-acao="aba" data-aba="personagem" aria-label="Meu herói">'
      + '<span class="casca-retrato">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</span>'
      + '<span class="casca-nome"><span class="casca-linha-nome"><strong>' + esc(p.nome) + '</strong><b class="casca-poder" title="Poder">⚔ '
      + R.poder(p).toLocaleString('pt-BR') + '</b></span><small>Lv ' + p.nivel + ' · ' + esc(nomeClasseP(p)) + '</small>' + tagsBoostHtml(p)
      + '<i class="casca-exp' + (ep ? ' pacto' : '') + '" title="' + (ep ? 'Exp ' + Math.floor(pct) + '% ' + ep.rotulo : maximo ? 'Pacto completo (' + D.ASCENSAO.limitePontos + ')' : 'Exp ' + Math.floor(pct) + '%') + '"><b style="width:' + pct + '%"></b></i></span></button>'
      + '<div class="casca-icones">'
      + '<button class="casca-ico" data-acao="casca-chat" aria-label="Chat">💬<span class="casca-selo" id="casca-chat-selo"' + (chat.naoLidas ? '' : ' hidden') + '>' + (chat.naoLidas > 99 ? '99+' : chat.naoLidas || '') + '</span></button>'
      + '<button class="casca-ico" data-acao="casca-grupo" aria-label="Grupo">👥<span class="casca-selo" id="casca-grupo-selo" hidden></span></button>'
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
      + item('data-acao="casca-grupo"', '👥', 'Grupo', estado.gm && estado.gm.convites && estado.gm.convites.length ? seloNumero(estado.gm.convites.length) : '')
      + item('id="btn-caixa" data-acao="painel-topo" data-valor="caixa"', ICONE_CARTA, 'Caixa de entrada', seloNumero(cx))
      + item('id="btn-sino" data-acao="painel-topo" data-valor="sino"', ICONE_SINO, 'Avisos', seloNumero(nn)) + '</div>'
      + '<div class="menu-cel-grupo menu-cel-grade"><small>Configurações</small>'
      + item('data-acao="menu-config"', ICONES.config || '⚙', 'Interface, som e tela') + '</div>'
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
    var nav = '<nav class="abas-jogo" id="abas-jogo">' + GRUPOS.filter(function (g) { return abasDe(g).length; }).map(function (g) {
      var alvo = abaDoGuia(), guiaAqui = alvo && abasDe(g).indexOf(alvo) >= 0 && estado.aba !== alvo;
      var destino = guiaAqui ? alvo : estado.subAba[g.id] || abasDe(g)[0];
      return '<button data-acao="aba" data-aba="' + destino + '" class="' + (atual === g ? 'ativa' : '') + (guiaAqui ? ' guia-alvo' : '') + '">'
        + '<span class="aba-ico">' + ICONES[g.id] + abasDe(g).map(seloDaAba).join('') + '</span><span class="aba-nome">' + g.nome + '</span></button>';
    }).join('') + '</nav>';
    return nav;
  }
  function subAbasHtml() {
    var atual = grupoDaAba(estado.aba);
    return atual && abasDe(atual).length > 1 ? '<nav class="sub-abas" id="sub-abas">' + abasDe(atual).map(function (a) {
      return '<button data-acao="aba" data-aba="' + a + '" class="' + (estado.aba === a ? 'ativa' : '') + (a === abaDoGuia() && estado.aba !== a ? ' guia-alvo' : '') + '">' + (ICONES_SUB[a] ? '<span class="sub-ico">' + ICONES_SUB[a] + '</span>' : '') + NOME_ABA[a] + seloDaAba(a) + '</button>';
    }).join('') + '</nav>' : '';
  }
  // Menu em cascata da Arcane no celular (Henri, nov/2026): um botão mostra onde o jogador está (grupo › aba) e abre a
  // lista dos grupos, cada um com ícone e nome; tocar num grupo abre as abas dele embaixo (ícone + nome).
  // Só existe no tema Arcane; o css/tema-arcane.css mostra a cascata nas telas estreitas e esconde as abas normais.
  function cascataHtml() {
    if (temaAtual() !== 'arcane') return '';
    var g0 = grupoDaAba(estado.aba) || GRUPOS[0], aberto = !!estado.cascata, exp = estado.cascataGrupo || g0.id;
    var selos = function (g) { return abasDe(g).map(seloDaAba).join(''); };
    var h = '<div class="cascata' + (aberto ? ' aberta' : '') + '"><button type="button" class="cascata-botao" data-acao="cascata" aria-expanded="' + aberto + '">'
      + '<span class="cascata-ico">' + ICONES[g0.id] + '</span><span class="cascata-onde"><b>' + g0.nome + '</b>'
      + (abasDe(g0).length > 1 && NOME_ABA[estado.aba] ? '<small>' + (ICONES_SUB[estado.aba] ? '<span class="sub-ico">' + ICONES_SUB[estado.aba] + '</span>' : '') + NOME_ABA[estado.aba] + '</small>' : '')
      + '</span><span class="cascata-seta" aria-hidden="true">▾</span></button>';
    if (aberto) {
      h += '<div class="cascata-painel" role="menu">' + GRUPOS.map(function (g) {
        var varias = abasDe(g).length > 1, expandido = varias && exp === g.id;
        var botao = '<button type="button" role="menuitem" class="cascata-grupo' + (g === g0 ? ' atual' : '') + (expandido ? ' expandido' : '') + '" '
          + (varias ? 'data-acao="cascata-grupo" data-valor="' + g.id + '" aria-expanded="' + expandido + '"' : 'data-acao="aba" data-aba="' + abasDe(g)[0] + '"') + '>'
          + '<span class="cascata-ico">' + ICONES[g.id] + '</span><span class="cascata-nome">' + g.nome + '</span>' + selos(g)
          + (varias ? '<span class="cascata-seta" aria-hidden="true">›</span>' : '') + '</button>';
        var subs = expandido ? '<div class="cascata-subs">' + abasDe(g).map(function (a) {
          return '<button type="button" role="menuitem" class="cascata-sub' + (estado.aba === a ? ' atual' : '') + '" data-acao="aba" data-aba="' + a + '">'
            + '<span class="sub-ico">' + (ICONES_SUB[a] || '') + '</span><span class="cascata-nome">' + NOME_ABA[a] + '</span>' + seloDaAba(a) + '</button>';
        }).join('') + '</div>' : '';
        return botao + subs;
      }).join('')
        // Missões por último (Henri, nov/2026): no celular a aba flutuante some e o painel abre por aqui
        + (function () { var pr = avisosMissoes(estado.personagem, C.agora());
          return '<button type="button" role="menuitem" class="cascata-grupo cascata-missoes" data-acao="cascata-missoes"><span class="cascata-ico">📜</span>'
            + '<span class="cascata-nome">Missões</span>' + (pr ? seloNumero(pr) : '') + '</button>'; })()
        + '</div>';
    }
    return h + '</div>';
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

  // Atributos (com + e −), habilidade, raça e status: na ficha ("Atributos e status") e, na Arcane do celular, também
  // na aba Personagem (lá a ficha fica compacta e escondia isso; Henri, 16/11/2026).
  function fichaDetalhesHtml(p, s, emBatalha) {
    var eq = R.bonusEquipamentos(p);
    // Pontos escolhidos mas ainda não confirmados: aparecem em verde e mudam a prévia dos status.
    var pend = pontosPendentes(), usados = totalPendentes(), restam = p.pontosLivres - usados;
    // De 10 em 10 (Henri, 20/11/2026): com 10 pontos ou mais (ex.: depois do Recomeço), o jogador escolhe o passo do + e do −.
    var dez = p.pontosLivres >= 10 && !emBatalha, passo = dez && estado.passoPontos === 10 ? 10 : 1;
    var sNovo = usados ? R.status(comPendentes(p, pend)) : s;
    var atrs = R.ATRIBUTOS.map(function (k) {
      var botoes = p.pontosLivres > 0 && !emBatalha
        ? '<button class="btn mini" data-acao="ponto-menos" data-valor="' + passo + '" data-atributo="' + k + '" title="Tirar ' + (passo > 1 ? passo + ' pontos' : 'ponto') + '"' + (pend[k] ? '' : ' disabled') + '>−</button>'
          + '<button class="btn mini" data-acao="ponto" data-valor="' + passo + '" data-atributo="' + k + '" title="Pôr ' + (passo > 1 ? passo + ' pontos' : 'ponto') + ' em ' + D.atributos[k].nome + '"' + (restam > 0 ? '' : ' disabled') + '>+</button>'
        : '<span></span>';
      return '<div class="linha-atr"><span class="dica" tabindex="0">' + D.atributos[k].nome + ' <i class="dica-i">?</i>' + dicaAtributo(p, k, pend) + '</span>'
        + '<span class="valor">' + (p.atributos[k] + eq[k] + (pend[k] || 0)) + (eq[k] ? ' <small class="mais">(+' + eq[k] + ')</small>' : '')
        + (pend[k] ? ' <small class="pendente">+' + pend[k] + '</small>' : '') + '</span><span class="atr-botoes">' + botoes + '</span></div>';
    }).join('');
    if (dez) {
      atrs = '<div class="atr-passo"><span class="suave pequeno">Adicionar de:</span>'
        + [1, 10].map(function (n) {
          return '<button class="btn mini' + (passo === n ? '' : ' secundario') + '" data-acao="pontos-passo" data-valor="' + n + '" aria-pressed="' + (passo === n) + '">' + n + ' em ' + n + '</button>';
        }).join('') + '</div>' + atrs;
    }
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
    // O Pacto de Ascensão e as skills do clã já estão nos status (valem também na Arena). As runas só contra monstros.
    var sPve = R.status(p, true);
    function pve(a, b, texto) {
      return a === b ? '' : ' <small class="mais" title="Com as runas: vale contra monstros (caçada, masmorra e chefes), não na Arena.">(contra monstros: ' + texto(b) + ')</small>';
    }
    var status = [
      ['Poder', '<strong class="cor-ouro">' + R.poder(p).toLocaleString('pt-BR') + '</strong>' + (usados ? ' <span class="mais">→ ' + R.poder(comPendentes(p, pend)).toLocaleString('pt-BR') + '</span>' : ''), 'Força geral do personagem: ataque e resistência somados.'],
      ['Vida máxima', mudanca(s.hpMax, sNovo.hpMax, String) + pve(s.hpMax, sPve.hpMax, String), 'Vida cheia do personagem, já com o Pacto de Ascensão e as skills do clã. Contra monstros, soma também as runas.'],
      ['Dano por golpe', mudanca(dano(s.dano), dano(sNovo.dano), String) + (magico ? ' (mágico)' : '') + pve(dano(s.dano), dano(sPve.dano), String), 'Quanto cada golpe tira, antes da defesa do inimigo.'],
      [magico ? 'Ataque mágico' : 'Ataque', mudanca(magico ? s.ataqueMagico : s.ataque, magico ? sNovo.ataqueMagico : sNovo.ataque, function (v) { return '+' + v; }), 'Somado ao dano da arma em cada golpe.'],
      ['Defesa', mudanca(s.defesa, sNovo.defesa, String) + ' <small class="suave">(−' + R.cortePct(sNovo.defesa) + '% de dano)</small>' + pve(s.defesa, sPve.defesa, String), 'Diminui em porcentagem o dano físico que você recebe: 100 de defesa = −50%, 200 = −67%, 300 = −75%.'],
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

    return '<div class="secao"><h3>Atributos' + (p.pontosLivres > 0 ? ' <span class="pontos">' + restam + ' ponto(s) livre(s)</span>' : '') + '</h3>'
      + '<p class="suave pequeno dica-texto">Passe o mouse (ou toque) no nome para ver o que cada atributo faz.</p>' + atrs + '</div>'
      + (!D.HABILIDADES_ATIVAS ? '' : '<div class="secao"><h3>Habilidade <span class="pontos">Nível ' + R.nivelHabilidade(p) + '</span></h3>'
      + '<div class="nome-habilidade">⚡ ' + D.habilidades[p.classe].nome + '</div>'
      + '<p class="suave pequeno">' + D.habilidades[p.classe].descricao + ' ' + textoHabilidade(p.classe, R.nivelHabilidade(p)) + '</p></div>')
      + '<div class="secao"><h3>Raça: ' + nomeRaca(p.raca, p.sexo) + '</h3><p class="pequeno tracos-raca">' + tracosRacaHtml(p.raca) + '</p></div>'
      + '<div class="secao"><h3>Status</h3><dl class="status">' + status + '</dl></div>';
  }

  function atributosAbaHtml(p) {
    return '<div class="pg-atributos"><h3 class="subtitulo">Atributos e status' + (p.pontosLivres > 0 ? ' <span class="pontos">' + p.pontosLivres + ' ponto(s)</span>' : '') + '</h3>'
      + fichaDetalhesHtml(p, R.status(p), !!estado.batalha) + '</div>';
  }

  function fichaHtml() {
    var p = estado.personagem, s = R.status(p);
    var sV = R.status(p, true);   // a barra de vida mostra a vida contra monstros (com as runas)
    var precisa = R.expNecessaria(p.nivel);
    var arma = R.armaEquipada(p);
    var emBatalha = !!estado.batalha;
    return '<aside class="caixa ficha">'
      + '<div class="cabeca"><div class="moldura">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</div><div>'
      + '<h2>' + esc(p.nome) + '</h2>' + (p.titulo ? '<div class="titulo-heroi">' + esc(p.titulo) + '</div>' : '')
      + '<div class="suave">' + nomeRaca(p.raca, p.sexo) + ' · ' + nomeClasseP(p) + '</div>'
      + '<div class="nivel">Level ' + p.nivel + '</div>' + tagsBoostHtml(p) + '</div></div>'
      + '<div class="suave">Vida</div><div id="ficha-hp">' + barra('hp', emBatalha ? estado.batalha.jogador.hp : sV.hpMax, emBatalha ? estado.batalha.jogador.hpMax : sV.hpMax, (emBatalha ? estado.batalha.jogador.hp : sV.hpMax) + ' / ' + (emBatalha ? estado.batalha.jogador.hpMax : sV.hpMax), 'ficha') + '</div>'
      + estaminaHtml(p)
      + '<div class="suave">Experiência' + (expPacto(p) ? ' <b class="exp-pacto">' + expPacto(p).rotulo + '</b>' : '') + '</div><div id="ficha-exp">' + (p.nivel >= D.NIVEL_MAXIMO
        ? (expPacto(p) ? barra('exp pacto', expPacto(p).pct, 100, Math.floor(expPacto(p).pct) + '% ' + expPacto(p).rotulo) : barra('exp maximo', 1, 1, 'Pacto completo (' + D.ASCENSAO.limitePontos + ')'))
        : barra('exp', p.exp, precisa, Math.floor(Math.min(100, p.exp * 100 / precisa)) + '%')) + '</div>'
      + vitalidadeHtml(p)
      + vidaTempoHtml(p, s, emBatalha)
      + poderHtml(p) + bonusFichaHtml()
      + '<div class="secao"><h3>Arma</h3>' + armaFichaHtml(p, arma, s) + '</div>'
      + '<button class="ficha-sanfona' + (estado.fichaAberta ? ' aberta' : '') + '" data-acao="ficha-status" aria-expanded="' + !!estado.fichaAberta + '">'
      + '<span>Atributos e status</span>' + (p.pontosLivres > 0 ? '<span class="pontos">' + p.pontosLivres + ' ponto(s)</span>' : '') + '<i aria-hidden="true">▾</i></button>'
      + (!estado.fichaAberta ? '' : '<div class="ficha-detalhes">' + fichaDetalhesHtml(p, s, emBatalha) + '</div>')
      + atividadesHtml(p)
      + '</aside>';
  }

  // ----- Pontos de atributo: escolher com + e −, conferir a prévia e só então confirmar -----
  var DESCRICAO_ATRIBUTO = {
    for: 'Cavaleiro e Artesão: dano e precisão. Todos: dano dos golpes críticos.',
    des: 'Caçador: dano, precisão, crítico e evasão. Outras classes: só 30% do crítico, da evasão e da precisão.',
    res: 'Aumenta a vida (acima de 10), a defesa e a defesa mágica.',
    int: 'Mago: dano, precisão, crítico mágico e dano crítico mágico.',
    sor: 'Aumenta a chance de drop, de encantamento e de craft.',
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
    var dano = D.classes[p.classe].atributoDano, n = D.PONTOS_POR_DANO, AC = D.ATRIBUTOS_COMBATE;
    var dp = '+' + fmtDec(AC.danoPct) + '% de dano por ponto acima de ' + AC.danoDesde, f = dano === 'des' ? 1 : AC.desOutros;
    var principal = function (a) { return dano === a ? [dp, '+1 de Ataque a cada ' + n + ' pontos', '+1 de precisão por ponto'] : []; };
    return {
      for: { ganhos: principal('for').concat(['+1% de dano crítico por ponto']), degrau: dano === 'for' ? [n, 'Ataque'] : null },
      des: { ganhos: principal('des').concat([
          '+' + fmtDec(AC.desCritico * f) + '% de chance de crítico por ponto', '+' + fmtDec(AC.desEvasao * f) + '% de evasão por ponto']
          .concat(dano === 'des' ? [] : ['+' + fmtDec(f) + ' de precisão por ponto'])), degrau: dano === 'des' ? [n, 'Ataque'] : null },
      res: { ganhos: ['+' + D.HP_POR_RES + ' de vida por ponto acima de ' + D.RES_SEM_VIDA, '+' + fmtDec(D.DEFESA.fator / 10) + ' de defesa e +' + fmtDec(D.DEFESA.fator / 10) + ' de defesa mágica por ponto'] },
      int: { ganhos: dano === 'int' ? principal('int').concat(['+' + fmtDec(AC.intCritico) + '% de chance de crítico mágico por ponto', '+' + fmtDec(AC.intDanoCritico) + '% de dano crítico mágico por ponto'])
          : ['Não ajuda a sua classe na luta'], degrau: dano === 'int' ? [n, 'Ataque mágico'] : null },
      sor: { ganhos: ['+' + fmtDec(D.SORTE.encanto) + '% de encantamento por ponto', '+' + fmtDec(D.SORTE.drop) + '% na chance de drop por ponto (sobre a chance de cada drop)',
        '+1% de craft por ponto'] },
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
      + ' <span class="suave pequeno">' + R.tipoArma(arma).nome + ' · ' + D.NOME_VELOCIDADE[R.tipoArma(arma).vel] + (R.tipoArma(arma).duasMaos ? ' · duas mãos' : '')
      + (R.fatorArmaHab(estado.personagem) < 1 ? ' · <span class="menos">habilidades ' + D.GRUPOS_ITEM.foraPreferida + '%</span>' : '') + '</span></div></div></div>'
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

  // Objetivo da História neste monstro (22/11/2026): "Objetivo: Y/X monstros" em cima da imagem.
  function objetivoHistoriaHtml(id) {
    var e = R.historiaEstado(estado.personagem);
    if (!e || e.fim || !e.liberado) return '';
    var x = e.objetivos.filter(function (o) { return o.objetivo.monstro === id; })[0];
    if (!x) return '';
    return '<div class="objetivo-hist' + (x.ok ? ' ok' : '') + '" title="História: ' + esc(e.capitulo.titulo) + '">' + (x.ok ? '✔ ' : '📜 ')
      + 'Objetivo: ' + x.feito + '/' + x.meta + (x.meta === 1 && D.monstros[id].chefe ? ' chefe' : ' monstros') + '</div>';
  }
  function cartaMonstro(id, selecionado) {
    var p = estado.personagem, s = R.status(p), m = D.monstros[id];
    var ritmo = m.velocidade / Math.max(1, s.velocidade);
    var fator = R.fatorExp(p, id);
    // celular: carta deitada com o resumo (estamina, exp, ouro, vida, dano); a ficha completa fica em "Ver detalhes".
    // Também na Arcane em tela estreita (Henri, nov/2026).
    var curto = CELULAR || (temaAtual() === 'arcane' && window.innerWidth <= 760);
    var resumo = curto ? '<div class="monstro-resumo"><span title="Estamina por luta">⚡ ' + R.custoEstamina(id) + '</span><span title="Exp por vitória, em % do seu level">✦ ' + expPct(estado.personagem, m.exp) + '</span>'
      + '<span>◎ ' + m.ouro.toLocaleString('pt-BR') + '</span><span>❤ ' + m.hp.toLocaleString('pt-BR') + '</span><span>⚔ ' + danoMonstro(m.ataque) + '</span></div>' : '';
    return '<article class="monstro' + (R.monstroLiberado(p, id) ? '' : ' monstro-bloqueado') + (selecionado ? ' monstro-escolhido' : '') + '"><div class="moldura">' + F.imagemMonstro(id) + objetivoHistoriaHtml(id) + '</div><div class="corpo">'
      + '<h3>' + m.nome + '</h3>' + (curto ? resumo + '<details class="monstro-detalhes"><summary>Ver detalhes</summary><p class="suave">' + m.descricao + '</p>' : '<p class="suave">' + m.descricao + '</p>')
      + '<dl class="ficha-monstro"><dt>Vida</dt><dd>' + m.hp.toLocaleString('pt-BR') + '</dd><dt title="Dano de cada golpe (a sua defesa diminui)">Dano</dt><dd>' + danoMonstro(m.ataque) + '</dd>'
      + '<dt title="Reduz o seu dano em porcentagem">Defesa</dt><dd>' + m.defesa + ' <small class="suave">(−' + Math.round(100 - 10000 / (100 + m.defesa)) + '% de dano)</small></dd>'
      + '<dt>Velocidade</dt><dd>' + m.velocidade + '</dd><dt title="Quantas vezes o monstro ataca para cada ataque seu">Ataques/turno</dt><dd>' + fmt(ritmo) + '</dd>'
      + '<dt>Experiência</dt><dd>' + m.exp.toLocaleString('pt-BR') + '</dd><dt>Ouro</dt><dd>' + m.ouro.toLocaleString('pt-BR') + '</dd>'
      + '<dt title="Estamina gasta em cada luta contra este monstro">Estamina</dt><dd>⚡ ' + R.custoEstamina(id) + '</dd>'
      + (m.chanceArma ? '<dt>Armas</dt><dd>' + m.chanceArma + '%</dd>' : '')
      + (m.chanceArmadura ? '<dt>Armaduras</dt><dd>' + m.chanceArmadura + '%</dd>' : '')
      + (m.pergaminho ? '<dt>Pergaminho</dt><dd>' + m.pergaminho.chance + '%</dd>' : '')
      + '<dt>Abatidos</dt><dd>' + (p.abates[id] || 0) + '</dd></dl>' + (curto ? '</details>' : '')
      + (fator < 100 ? '<p class="menos pequeno">Esta área está abaixo do seu nível: exp e ouro a ' + fator + '% e nenhum drop.</p>' : '')
      + (R.monstroLiberado(p, id) ? '<button class="btn largo' + (selecionado ? '' : ' secundario') + '" data-acao="cacada-alvo" data-monstro="' + id + '">'
          + (selecionado ? '✔ Na caçada' : 'Adicionar à caçada') + '</button>'
        : '<button class="btn largo" disabled>🔒 Derrote ' + esc(D.monstros[R.monstroAnterior(id)].nome) + ' primeiro</button>') + '</div></article>';
  }

  // Carta do chefe: sem números, só o mistério.
  function cartaChefe(area) {
    var p = estado.personagem, id = area.chefe.id, m = D.monstros[id];
    var abatidos = p.abates[id] || 0;
    return '<article class="monstro chefe"><div class="moldura">' + F.imagemMonstro(id) + objetivoHistoriaHtml(id) + '</div><div class="corpo">'
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
    if (estado.reinoPesadelo && R.reinoPesadeloAberto(p)) return estado.pesadeloChefe && R.ehPesadelo(estado.pesadeloChefe) ? pesadeloChefeHtml(estado.pesadeloChefe) : pesadeloMapaHtml();
    var area = estado.areaAberta && D.areas.find(function (a) { return a.id === estado.areaAberta; });
    return area && R.areaLiberada(p, area) ? regiaoHtml(area) : mapaHtml();
  }
  function mapaHtml() {
    var p = estado.personagem;
    var nos = D.areas.map(function (a, i) {
      var e = estiloArea(a, i), livre = R.areaLiberada(p, a), proxima = D.areas[i + 1], porHistoria = !livre && p.nivel >= a.nivelMin;
      var faixa = 'Lv ' + a.nivelMin + '–' + (proxima ? proxima.nivelMin : D.PESADELO.mapaNivelExp);   // o último mapa vai até o 40 (depois: Reino do Pesadelo)
      return '<button class="mapa-no' + (livre ? '' : ' bloqueada') + '" style="left:' + e.x + '%;top:' + e.y + '%;--cor:' + e.cor + '"'
        + (livre ? ' data-acao="area" data-valor="' + a.id + '"' : porHistoria ? ' data-acao="area-fechada" data-valor="' + a.id + '"' : ' disabled') + ' title="' + esc(a.descricao) + '">'
        + '<span class="mapa-icone' + (livre && ESTILO_AREA[a.id] ? ' com-arte' : '') + '">' + (livre ? iconeArea(a, 'arte') : '🔒') + '</span>'
        + '<span class="mapa-nome">' + a.nome + '</span><span class="mapa-nivel">' + (livre ? faixa : porHistoria ? '📜 Conclua a História' : 'Libera no level ' + a.nivelMin) + '</span></button>';
    }).join('');
    return '<h3 class="subtitulo">Mapa do Reino</h3><p class="suave pequeno">Escolha uma região para caçar. As regiões abrem com o seu level e a História da região anterior concluída.'
      + (p.nivel >= D.PESADELO.mapaNivelExp ? ' <strong class="menos">No level ' + D.PESADELO.mapaNivelExp + '+ o Mapa do Reino dá só ' + D.PESADELO.mapaExpPct + '% da exp (o ouro continua). Itens só até o level ' + D.PESADELO.mapaNivelItem + '.</strong>' : '') + '</p>'
      + portalPesadeloHtml(p) + '<div class="mapa-mundo">' + nos + '</div>';
  }

  // ---------------- Reino do Pesadelo (Henri, nov/2026): os 7 chefes em versão Pesadelo, level 40 a 60 ----------------
  // Cada região tem só o chefe dela. A exp para subir do 40 ao 60 e os itens 40+ vêm daqui.
  function portalPesadeloHtml(p) {
    var aberto = R.reinoPesadeloAberto(p), n1 = D.PESADELO.chefes[0].nivel;
    return '<button class="portal-pesadelo' + (aberto ? '' : ' bloqueada') + '"' + (aberto ? ' data-acao="reino-pesadelo"' : ' disabled') + '>'
      + '<span class="portal-icone">' + (aberto ? '🌑' : '🔒') + '</span><span><strong>Reino do Pesadelo</strong>'
      + '<small>' + (aberto ? 'Os chefes do reino, mais fortes do que nunca. Level ' + n1 + ' a ' + D.NIVEL_MAXIMO + '.' : 'Abre no level ' + n1 + '.') + '</small></span>'
      + (aberto ? '<span class="portal-seta">Entrar →</span>' : '') + '</button>';
  }
  function pesadeloMapaHtml() {
    var p = estado.personagem;
    var nos = D.PESADELO.chefes.map(function (c) {
      var m = D.monstros[c.id], livre = R.podePesadelo(p, c.id), v = p.abates[c.id] || 0;
      return '<button class="mapa-no no-pesadelo' + (livre ? '' : ' bloqueada') + '" style="left:' + c.x + '%;top:' + c.y + '%"'
        + (livre ? ' data-acao="pesadelo-chefe" data-valor="' + c.id + '"' : ' disabled') + ' title="' + esc(m.nome) + '">'
        + '<span class="mapa-icone com-arte"><img class="arte" src="' + m.imagem + '" alt=""></span>'
        + '<span class="mapa-nome">' + esc(m.nome.replace(' · Pesadelo', '')) + '</span>'
        + '<span class="mapa-nivel">' + (livre ? 'Lv ' + m.nivel + (v ? ' · ✔ ' + v : '') : '🔒 Libera no level ' + m.nivel) + '</span></button>';
    }).join('');
    return '<div class="regiao-topo topo-pesadelo"><button class="btn secundario btn-pequeno" data-acao="reino-normal">← Mapa do Reino</button>'
      + '<div><h3>🌑 Reino do Pesadelo</h3><p class="suave pequeno">Cada região tem só o seu chefe, agora muito mais forte. Cada luta custa '
      + D.PESADELO.estamina + ' de estamina. Daqui vem a exp para chegar ao level ' + D.NIVEL_MAXIMO + ' e os itens acima do level ' + D.PESADELO.mapaNivelItem + '.</p></div></div>'
      + '<div class="mapa-mundo mapa-pesadelo">' + nos + '</div>';
  }
  function pesadeloChefeHtml(id) {
    var p = estado.personagem, m = D.monstros[id], livre = R.podePesadelo(p, id), custo = R.custoEstamina(id);
    var mat = R.materialDoChefe(m.base), nomeMat = mat && D.CRAFT.materiais[mat] ? D.CRAFT.materiais[mat].nome : null;
    var tem = R.estamina(p).pts >= custo, v = p.abates[id] || 0;
    var linhas = [
      ['Level', m.nivel], ['Vida', m.hp.toLocaleString('pt-BR')], ['Dano', danoMonstro(m.ataqueCacada || m.ataque)],
      ['Estamina', custo + ' por luta'], ['Exp', '+' + m.exp.toLocaleString('pt-BR')], ['Ouro', '+' + m.ouro.toLocaleString('pt-BR')],
    ].map(function (x) { return '<li><span>' + x[0] + '</span><strong>' + x[1] + '</strong></li>'; }).join('');
    return '<div class="regiao-topo topo-pesadelo"><button class="btn secundario btn-pequeno" data-acao="pesadelo-mapa">← Reino do Pesadelo</button>'
      + '<div><h3>🌑 ' + esc(m.nome) + '</h3><p class="suave pequeno">' + esc(m.descricao) + '</p></div></div>'
      + '<article class="chefe-pesadelo"><div class="moldura">' + F.imagemMonstro(id) + '</div><div class="corpo">'
      + '<div class="selo-chefe">Chefe do Pesadelo</div><ul class="pesadelo-numeros">' + linhas + '</ul>'
      + '<p class="pequeno"><strong>Prêmios:</strong> o mesmo dos chefes da caçada: chance de arma ou armadura <span class="raridade-epica">épica</span> ou '
      + '<span class="raridade-lendaria">lendária</span> da sua classe (level ' + m.nivel + ' a ' + Math.min(D.NIVEL_MAXIMO, m.nivel + D.PESADELO.nivelDropExtra) + '), pergaminho'
      + (nomeMat ? ' e ' + esc(nomeMat) : '') + '.</p>'
      + (m.magia ? '<p class="suave pequeno">Magia: ' + esc(m.magia.nome) + '</p>' : '')
      + (v ? '<p class="mais pequeno">Derrotado ' + v + ' vez(es).</p>' : '')
      + '<div class="botoes"><button class="btn perigo btn-iniciar" data-acao="pesadelo-lutar" data-valor="' + id + '"' + (livre && tem ? '' : ' disabled') + '>⚔ ENFRENTAR</button></div>'
      + (!livre ? '<p class="menos pequeno">Abre no level ' + m.nivel + '.</p>' : !tem ? '<p class="menos pequeno">Precisa de ' + custo + ' de estamina: acampe, espere ou use um pote de estamina (Mercado).</p>' : '')
      + '</div></article>';
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
      + '<div><h3>' + iconeArea(area) + ' ' + area.nome + '</h3><p class="suave pequeno">' + area.descricao + ' Armas e armaduras que caem são do seu grupo (Pesado, Leve ou Mágico).'
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


  function fichaItemHtml(item, soVer, comparar) {
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
        : '<span class="menos">' + esc(R.motivoNaoEquipa(p, item) || 'Não é do seu grupo') + '</span>';
      acoes += item.travado ? '' : estado.vendaPendente === item.id
        ? '<button class="btn perigo" data-acao="vender" data-id="' + item.id + '">Confirmar venda</button>'
        : '<button class="btn secundario" data-acao="pedir-venda" data-id="' + item.id + '" title="Vender por ' + R.precoVenda(item) + ' de ouro">💰 Vender ' + R.precoVenda(item) + '</button>';
    }
    // Travar (Henri, 21/11/2026): item travado não pode ser vendido, quebrado na Oficina nem anunciado.
    if (!soVer) acoes += '<button class="btn secundario btn-travar' + (item.travado ? ' travado' : '') + '" data-acao="item-travar" data-id="' + item.id + '" title="'
      + (item.travado ? 'Destravar: volta a poder vender e quebrar' : 'Travar: não pode ser vendido nem quebrado') + '">' + (item.travado ? '🔓 Destravar' : '🔒 Travar') + '</button>';
    // Botões arrumados (Henri, 21/11/2026, "Exemplo A"): Equipar largo em cima; Vender, Travar e Comparar numa linha embaixo.
    if (!soVer && comparar) acoes += '<button class="btn secundario" data-acao="item-comparar" data-id="' + item.id + '" title="Comparar com outro item">⚖ Comparar</button>';
    return '<div class="ficha-item-topo"><div class="icone-grande borda-' + corItem(item) + aura(item) + '">' + F.icone(item) + '</div>'
      + '<div><div class="ficha-item-nome">' + nomeItemHtml(item) + '</div>'
      + '<div class="suave"><span class="ficha-item-tipo">' + tipoItem(item) + ' · <span class="raridade-' + corItem(item) + '">' + nomeRaridadeItem(item) + '</span>' + (item.nivel ? ' · ' : '') + '</span>'
      + (item.nivel ? '<span class="ficha-item-nivel">nível ' + item.nivel + (item.qualidade !== undefined ? ' · qualidade ' + Math.round(item.qualidade * 100) + '%' : '') + '</span>' : '')
      + (slot ? '<span class="ficha-item-eq"> · equipado</span>' : '') + '</div></div></div>'
      + fichaPoderHtml(p, item, slot)
      + '<ul class="ficha-item-bonus">' + linhas + '</ul>' + conjuntoHtml(p, item) + craftItemHtml(item)
      + (alvo ? '<p class="suave ficha-comparado">Comparado com ' + nomeItemHtml(alvo) + ((item.encanto || alvo.encanto) ? ' <span class="suave">(sem encanto)</span>' : '') + '</p>'
 : '')
      + '<div class="item-acoes' + (soVer ? '' : ' acoes-item') + '">' + acoes + '</div>';
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
      + (slot ? ' <span class="suave ficha-item-eq">· equipado</span>' : '') + '</p>';
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
    // Anel com os dois espaços ocupados (Henri, 21/11/2026): mostra os dois e um botão para trocar cada um.
    var anelOutro = !slot && item.tipo === 'anel' && R.itemNoSlot(p, 'anel1') && R.itemNoSlot(p, 'anel2') ? R.itemNoSlot(p, 'anel2') : null;
    var acoes = '';
    if (soVer) acoes = '';
    else if (slot) {
      acoes = '<button class="btn" data-acao="desequipar" data-slot="' + slot + '"' + (R.mochilaCheia(p) ? ' disabled title="Mochila cheia"' : '') + '>Desequipar</button>';
    } else {
      acoes = (R.podeUsar(p, item) ? (anelOutro ? '<button class="btn" data-acao="equipar" data-id="' + item.id + '" data-espaco="anel1">⇄ Trocar pelo anel 1</button>'
            + '<button class="btn" data-acao="equipar" data-id="' + item.id + '" data-espaco="anel2">⇄ Trocar pelo anel 2</button>'
            : '<button class="btn" data-acao="equipar" data-id="' + item.id + '">' + (outro ? 'Trocar pelo equipado' : 'Equipar') + '</button>')
          : '<span class="menos">' + esc(R.motivoNaoEquipa(estado.personagem, item) || 'Não é do seu grupo') + '</span>')
        + (item.travado ? '' : estado.vendaPendente === item.id
          ? '<button class="btn perigo" data-acao="vender" data-id="' + item.id + '">Confirmar venda</button>'
          : '<button class="btn secundario" data-acao="pedir-venda" data-id="' + item.id + '">Vender</button>');
    }
    if (!soVer) acoes += '<button class="btn secundario btn-travar' + (item.travado ? ' travado' : '') + '" data-acao="item-travar" data-id="' + item.id + '">' + (item.travado ? '🔓 Destravar' : '🔒 Travar') + '</button>';
    return '<div class="zoom-fundo" data-acao="zoom-fechar"><div class="zoom-janela" role="dialog" aria-label="Item ampliado">'
      + '<button class="zoom-x" data-acao="zoom-fechar" title="Fechar">✕</button>'
      + '<div class="zoom-cartas' + (anelOutro ? ' dupla tripla' : outro ? ' dupla' : '') + '">'
      + cartaZoom(outro ? semEncanto(item) : item, semEncanto(outro), (slot ? 'Equipado' : 'Este item') + (semEnc ? ' · sem encanto' : ''), item)
      + (outro ? cartaZoom(semEncanto(outro), null, 'Equipado agora' + (semEnc ? ' · sem encanto' : ''), outro) : '')
      + (anelOutro ? cartaZoom(semEncanto(anelOutro), null, 'Outro anel equipado', anelOutro) : '')
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
    var consumiveis = R.consumiveis(p), naConsumiveis = estado.mochilaAba === 'consumiveis', naBau = estado.mochilaAba === 'bau';
    var cFoco = naConsumiveis && estado.consumivelFoco ? consumiveis.filter(function (c) { return c.id === estado.consumivelFoco; })[0] : null;
    var abas = '<div class="mochila-abas" role="tablist">'
      + '<button role="tab" aria-selected="' + !(naConsumiveis || naBau) + '" class="' + (naConsumiveis || naBau ? '' : 'ativa') + '" data-acao="mochila-aba" data-valor="equipamentos">' + ICONES_MOCHILA.equipamentos
      + 'Equipamentos <span class="suave">(' + mochila.length + '/' + D.MOCHILA_MAX + ')</span></button>'
      + '<button role="tab" aria-selected="' + naConsumiveis + '" class="' + (naConsumiveis ? 'ativa' : '') + '" data-acao="mochila-aba" data-valor="consumiveis">' + ICONES_MOCHILA.consumiveis
      + 'Consumíveis <span class="suave">(' + consumiveis.reduce(function (t, c) { return t + c.qtd; }, 0) + ')</span></button>'
      + '<button role="tab" aria-selected="' + naBau + '" class="' + (naBau ? 'ativa' : '') + '" data-acao="mochila-aba" data-valor="bau">' + ICONES_MOCHILA.bau + 'Baú</button></div>';
    var baixo = naBau ? bauMochilaHtml(p) : naConsumiveis ? consumiveisHtml(consumiveis)
      : barraMochilaHtml() + '<div class="mochila' + (estado.vendaLote ? ' modo-venda' : '') + '">' + celulas.join('') + '</div>';
    return '<div class="personagem-grade"><div class="pg-equipamento"><div class="personagem-tela"><div class="boneco">' + slots
      + '<div class="retrato-central">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</div></div>'
      + '<div class="lateral"><div class="caixa-interna"><h3>Bônus dos equipamentos</h3>'
      + (resumo ? '<dl class="status">' + resumo + '</dl>' : '<p class="suave">Nenhuma armadura equipada.</p>') + '</div></div></div>'
      + (temaAtual() === 'arcane' ? atributosAbaHtml(p) : '')
      + '</div><div class="pg-mochila"><h3 class="subtitulo">Mochila</h3>' + abas
      + (naBau ? '' : '<p class="suave pequeno dica-mochila">' + (temMouse ? 'Passe o mouse num item para ver a ficha; o botão direito equipa.' : 'Toque num item para ver a ficha e equipar.') + '</p>')
      + baixo + '</div></div>';
  }

  // ----- Consumíveis: pergaminhos (e, no futuro, cristais e outros), empilhados com a quantidade -----
  function itemConsumivel(c) { return { tipo: c.tipo, classe: null, raridade: c.raridade, encanto: 0 }; }
  // Craft (materiais, receitas, proteções): cor pela importância e ícone simples (sem arte ainda).
  function corConsumivel(c) {
    if (c.tipo === 'material') { var m = D.CRAFT.materiais[c.raridade] || {}; return m.chefe ? 'epica' : m.minas ? 'rara' : 'comum'; }
    if (c.tipo === 'receita') return 'rara';
    if (c.tipo === 'trade') return 'epica';
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
  // ---------------- Baú da conta (Henri, 18/11/2026) ----------------
  // Ouro e consumíveis guardados pela conta: qualquer personagem dela guarda e retira. Itens não entram.
  // ---------------- Loja de Éter (Henri, 19/11/2026) ----------------
  // Éter: moeda comprada com dinheiro (1 Éter = R$ 1), guardada no servidor por conta. Aqui: VIP, boosts, Starter Pack
  // e skins de dado. No beta não há compra com dinheiro: o admin dá Éter (aba Admin). Preços em D.LOJA e D.SKINS_DADO.
  var ETER_IMG = '<img class="eter-ico" src="assets/eter.webp" alt="Éter">';
  function ehVip() {
    var l = estado.loja;
    if (l && estado.personagem && l.pid === estado.personagem.id) return !!(l.vip_ate && Date.parse(l.vip_ate) > C.agora());
    return !!(estado.personagem && estado.personagem.vip);
  }
  function guardarVip(v) { guardar('eldrin.vip', v ? '1' : '0'); }
  function vipGuardado() { try { return localStorage.getItem('eldrin.vip') === '1' || ehAdmin(); } catch (e) { return ehVip() || ehAdmin(); } }
  // Arcane é do VIP: sem VIP volta para a Clássica (no celular, a Zealot).
  function conferirArcane() {
    if (temaAtual() !== 'arcane' || ehVip() || ehAdmin()) return;
    var t = ehCelularAparelho() ? 'zealot' : 'classica';
    guardar('eldrin.interface', t);
    try { document.cookie = 'eldrin_interface=' + t + '; path=/; max-age=31536000; SameSite=Lax'; } catch (e) { /* ignora */ }
    avisar('👑 A interface Arcane agora é exclusiva do VIP. Voltando para a ' + (t === 'zealot' ? 'Zealot' : 'Clássica') + '…');
    setTimeout(function () { location.reload(); }, 2500);
  }
  function carregarLoja() {
    var p = estado.personagem;
    if (!p || estado.lojaCarregando || !C.loja) return;
    estado.lojaCarregando = true;
    C.loja.estado(p.id).then(function (l) {
      estado.lojaCarregando = false;
      if (estado.personagem !== p) return;
      l.pid = p.id; estado.loja = l; estado.lojaErro = null;
      p.vip = !!(l.vip_ate && Date.parse(l.vip_ate) > C.agora());
      guardarVip(p.vip); conferirArcane();
      if (estado.aba === 'loja' || Object.keys(l.ativos || {}).length) telaJogo();   // tags dos boosts no topo
    }, function (e) {
      estado.lojaCarregando = false; estado.lojaErro = (e && e.message) || 'Não foi possível abrir a loja.';
      if (estado.aba === 'loja') telaJogo();
    });
  }
  function precoEter(n) { return '<span class="preco-eter">' + ETER_IMG + '<b>' + n + '</b></span>'; }
  // Botão de compra em 2 toques: o 1º pede confirmação (mostra o preço), o 2º compra.
  function botaoCompra(item, preco, texto, desligado) {
    var conf = estado.lojaConfirma === item, l = estado.loja, falta = l && l.saldo < preco;
    if (desligado) return '<button class="btn" disabled>' + texto + '</button>';
    if (conf) return '<button class="btn btn-confirmar" data-acao="loja-comprar" data-valor="' + item + '">Confirmar: gastar ' + preco + ' Éter</button>'
      + '<button class="btn secundario" data-acao="loja-cancelar">Cancelar</button>';
    return '<button class="btn" data-acao="loja-pedir" data-valor="' + item + '"' + (falta ? ' title="Éter insuficiente"' : '') + '>' + texto + ' · ' + precoEter(preco) + '</button>';
  }
  // Compra de Éter com dinheiro no site (Mercado Pago, Henri 22/11/2026). Só no navegador: no app da Play Store a
  // compra tem que ser pelo Google, e o app não pode mostrar nem indicar outro jeito de pagar.
  function noAppNativo() { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }
  function podeComprarEter(l) { return !!(l && l.venda && !noAppNativo() && C.loja && C.loja.pagar); }
  function cartaComprarEter(l) {
    if (!podeComprarEter(l)) return '';
    var botoes = (D.LOJA.pacotes || []).map(function (k) {
      return '<button class="btn" data-acao="eter-comprar" data-valor="' + k.id + '"' + (estado.eterPagando ? ' disabled' : '') + '>'
        + ETER_IMG + '<b>' + k.eter + ' Éter</b> · R$ ' + k.reais.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '</button>';
    }).join('');
    return '<div class="caixa-interna loja-carta loja-comprar-eter"><h3>Comprar Éter</h3>'
      + '<p class="suave pequeno">Pagamento pelo Mercado Pago (Pix, cartão ou boleto). O Éter entra na conta assim que o pagamento é aprovado.</p>'
      + '<div class="item-acoes">' + botoes + '</div></div>';
  }
  function comprarEter(pacote) {
    if (estado.eterPagando) return;
    estado.eterPagando = true; telaJogo();
    C.loja.pagar(pacote).then(function (r) {
      if (r && r.url) { location.href = r.url; return; }
      throw new Error((r && r.erro) || 'Não foi possível abrir o pagamento.');
    }).catch(function (e) {
      estado.eterPagando = false; avisar((e && e.message) || 'Não foi possível abrir o pagamento.'); telaJogo();
    });
  }
  // Volta do Mercado Pago (?pagamento=ok|pendente|falhou): avisa e confere o saldo algumas vezes (o aviso do
  // Mercado Pago pode chegar uns segundos depois).
  function voltaDoPagamento() {
    var m = /[?&]pagamento=(ok|pendente|falhou)/.exec(location.search);
    if (!m) return;
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignora */ }
    var msg = { ok: '✅ Pagamento aprovado! O Éter entra na sua conta em instantes.',
      pendente: '⏳ Pagamento em análise. O Éter entra assim que o Mercado Pago aprovar.',
      falhou: 'O pagamento não foi concluído. Nenhum valor foi cobrado.' }[m[1]];
    setTimeout(function () { avisar(msg, m[1] === 'ok' ? 'item' : undefined); }, 1500);
    if (m[1] === 'falhou') return;
    [4000, 12000, 30000].forEach(function (t) {
      setTimeout(function () { if (estado.personagem) { estado.loja = null; carregarLoja(); } }, t);
    });
  }
  function abaLoja() {
    var p = estado.personagem, l = estado.loja && estado.loja.pid === p.id ? estado.loja : null, L = D.LOJA;
    if (!l && !estado.lojaErro) carregarLoja();
    var tit = '<div class="loja-topo">' + '<img class="eter-grande" src="assets/eter.webp" alt="">'
      + '<div><h2>Loja de Éter</h2><p class="suave">O Éter é a moeda especial do Reino. Vale para a <strong>conta toda</strong> (todos os seus personagens).</p></div></div>';
    if (!ACAO_SERVIDOR || !C.loja) return '<section class="caixa loja">' + tit + '<p class="suave">A loja precisa do servidor do jogo.</p></section>';
    if (estado.lojaErro) return '<section class="caixa loja">' + tit + '<p class="erro">' + esc(estado.lojaErro) + '</p>'
      + '<button class="btn" data-acao="loja-recarregar">Tentar de novo</button></section>';
    if (!l) return '<section class="caixa loja">' + tit + '<p class="suave">Abrindo a loja…</p></section>';
    var vip = ehVip(), agora = C.agora();
    var saldo = '<div class="loja-saldo">' + ETER_IMG + '<span>Seu Éter: <strong>' + Number(l.saldo || 0).toLocaleString('pt-BR') + '</strong></span>'
      + (podeComprarEter(l) ? '' : '<span class="suave pequeno">' + (l.beta ? 'Beta: a compra de Éter com dinheiro ainda não abriu.' : 'Comprar Éter: em breve.') + '</span>') + '</div>'
      + cartaComprarEter(l);
    var V = L.vip;
    var cartaVip = '<div class="caixa-interna loja-carta loja-vip' + (vip ? ' ativo' : '') + '"><h3>👑 VIP mensal</h3>'
      + (vip ? '<p class="online"><strong>VIP ativo até ' + dataCurta(l.vip_ate) + '</strong></p>' : '')
      + '<ul class="eter-lista">'
      + '<li>Interface <strong>Arcane</strong> no computador e no celular</li>'
      + '<li>Estamina cheia em <strong>' + V.estaminaMinutos + ' min</strong> (sem VIP: ' + D.ESTAMINA.minutosSemAcampar + ' min)</li>'
      + '<li><strong>+' + V.arenaExtra + '</strong> entradas na Arena e <strong>+' + V.masmorraExtra + '</strong> entradas na masmorra por dia</li>'
      + '<li>Oficina: <strong>qualquer</strong> Coletor ou Ferreiro faz o seu pedido na hora, sem ser amigo</li>'
      + '<li>Doação ao clã: até <strong>' + V.doacaoMult + 'x</strong> o limite do dia</li>'
      + '<li>Nome em destaque em todo o jogo: <span class="nome-vip vip-m">Nevasca</span> (herói) ou <span class="nome-vip vip-f">Rosa</span> (heroína)</li>'
      + '</ul><p class="suave pequeno">Vale ' + V.dias + ' dias a partir da compra, para a conta toda. Comprar de novo soma mais ' + V.dias + ' dias.</p>'
      + '<div class="item-acoes">' + botaoCompra('vip', V.preco, vip ? 'Renovar VIP' : 'Tornar-se VIP') + '</div></div>';
    var cartaPasse = '<div class="caixa-interna loja-carta"><h3>🎖 Passe de Batalha</h3><p class="suave">Em breve: uma temporada por mês (do dia 1 ao último dia), '
      + 'com pontos por tudo o que você faz no jogo e prêmios do lado Grátis e do Premium.</p></div>';
    var boosts = Object.keys(L.boosts).map(function (k) {
      var b = L.boosts[k], tem = Number((l.boosts || {})[k]) || 0, ate = (l.ativos || {})[k], ativo = ate && Date.parse(ate) > agora;
      return '<div class="caixa-interna loja-carta"><h3>' + (k === 'exp' ? '✨ ' : '💰 ') + b.nome + '</h3>'
        + '<p>+' + b.pct + '% de ' + (k === 'exp' ? 'exp' : 'ouro') + ' na caçada por ' + (b.minutos >= 60 ? (b.minutos / 60) + ' hora' + (b.minutos > 60 ? 's' : '') : b.minutos + ' min')
        + ', no personagem que usar. Usar de novo soma o tempo.</p>'
        + (ativo ? '<p class="online pequeno">Ativo em ' + esc(p.nome) + ' até ' + dataCurta(ate) + '</p>' : '')
        + '<p class="suave pequeno">Na conta: <strong>' + tem + '</strong></p>'
        + '<div class="item-acoes">' + botaoCompra('boost:' + k, b.preco, 'Comprar')
        + '<button class="btn secundario" data-acao="loja-usar-boost" data-valor="' + k + '"' + (tem ? '' : ' disabled') + '>Usar em ' + esc(p.nome) + '</button></div></div>';
    }).join('');
    var TL = L.trade, nTL = pergTrade(p);
    var cartaTrade = TL ? '<div class="caixa-interna loja-carta"><h3>' + iconeConsumivel({ tipo: 'trade', raridade: 'unico' }) + ' ' + TL.nome + '</h3>'
      + '<p>Abre uma negociação com outro jogador em <strong>Social › Trade</strong>: itens, consumíveis e ouro. Só quem pede precisa de 1; ele é gasto quando o outro aceita o pedido.</p>'
      + '<p class="suave pequeno">Na mochila de ' + esc(p.nome) + ': <strong>' + nTL + '</strong></p>'
      + '<div class="item-acoes">' + botaoCompra('trade', TL.preco, 'Comprar') + '</div></div>' : '';
    var S = L.starter;
    var cartaStarter = '<div class="caixa-interna loja-carta loja-starter"><h3>🎁 ' + S.nome + '</h3><ul class="eter-lista">'
      + '<li>' + S.boostsExp + ' Boosts de EXP e ' + S.boostsOuro + ' Boosts de Ouro</li>'
      + '<li>Arma e armadura completa ' + D.raridades[S.raridade].nome.toLowerCase() + 's, level ' + S.nivelItens + ' (qualidade ' + S.qualidadePct + '%)</li>'
      + '<li>Colar e anel ' + D.raridades[S.raridade].nome.toLowerCase() + 's, level ' + S.nivelJoias + '</li>'
      + '<li><strong>VIP por ' + S.vipDias + ' dias</strong></li></ul>'
      + '<p class="suave pequeno">1 por conta. Os itens vão para a mochila de ' + esc(p.nome) + ' (precisa de 7 espaços livres).</p>'
      + '<div class="item-acoes">' + (l.starter ? '<span class="suave">Esta conta já comprou.</span>' : botaoCompra('starter', S.preco, 'Comprar')) + '</div></div>';
    var skins = '<div class="caixa-interna loja-carta loja-skins-caixa"><h3>🎲 Skins do Dado (Arena)</h3>'
      + '<p class="suave">Mudam a cor do seu D20 na Arena. O oponente vê o dado com a sua skin. A skin fica com o personagem que comprou.</p><div class="skins">'
      + D.SKINS_DADO.map(function (k) {
        var tem = R.skinsDoPersonagem(p).indexOf(k.id) >= 0, uso = (p.skinDado || 'vermelho') === k.id;
        var botao = uso ? '<span class="online pequeno">✔ Em uso</span>'
          : tem ? '<button class="btn secundario" data-acao="skin-usar" data-valor="' + k.id + '">Usar</button>'
          : k.historia ? '<span class="suave pequeno">Prêmio da História</span>'
          : k.eter ? botaoCompra('skin:' + k.id, k.eter, 'Comprar') : '';
        return '<div class="skin-carta' + (uso ? ' em-uso' : '') + '">' + d20Bonito(20, k.id) + '<strong>' + k.nome + '</strong>'
          + '<span class="suave pequeno">' + (k.historia ? 'A Crônica de Eldrin' : k.eter ? k.eter + ' Éter' : 'Grátis') + '</span>' + botao + '</div>';
      }).join('') + '</div></div>';
    var hist = (l.historico || []).map(function (h) {
      return '<li><span class="' + (h.valor > 0 ? 'online' : '') + '">' + (h.valor > 0 ? '+' : '−') + Math.abs(h.valor) + ' Éter</span> · ' + esc(h.motivo)
        + ' <span class="suave">· ' + dataCurta(h.criado_em) + '</span></li>';
    }).join('');
    return '<section class="caixa loja">' + tit + saldo + '<div class="loja-grade">' + cartaVip + cartaStarter + boosts + cartaTrade + cartaPasse + '</div>' + skins
      + (hist ? '<div class="caixa-interna cla-secao"><h3>Seu Éter: últimas movimentações</h3><ul class="bau-historico">' + hist + '</ul></div>' : '') + '</section>';
  }
  // Tags dos boosts ativos embaixo do level (Henri, 21/11/2026): passar o mouse mostra o bônus e até quando vale.
  function tagsBoostHtml(p) {
    var l = estado.loja && estado.loja.pid === p.id ? estado.loja : null, agora = C.agora();
    if (!l || !l.ativos) return '';
    var h = Object.keys(D.LOJA.boosts).map(function (k) {
      var ate = l.ativos[k], fim = ate && Date.parse(ate);
      if (!fim || fim <= agora) return '';
      var b = D.LOJA.boosts[k], min = Math.ceil((fim - agora) / 60000), nome = k === 'exp' ? 'EXP' : 'OURO';
      return '<span class="tag-boost tag-boost-' + k + '" tabindex="0" data-acao="tag-boost" title="' + esc(b.nome + ': +' + b.pct + '% de ' + (k === 'exp' ? 'experiência' : 'ouro')
        + ' na caçada. Vale até ' + dataCurta(ate) + ' (falta' + (min === 1 ? '' : 'm') + ' ' + min + ' min).') + '">'
        + (k === 'exp' ? '✨ ' : '💰 ') + nome + ' +' + b.pct + '%</span>';
    }).join('');
    return h ? '<span class="tags-boost">' + h + '</span>' : '';
  }
  // Inspecionar (só ADMIN; Henri, 24/11/2026): no ranking, abre a ficha de outro personagem em 3 abas.
  function botaoInspecionar(x) {
    return ehAdmin() && x.id ? '<button class="btn secundario mini-opcao" data-acao="ranking-inspecionar" data-id="' + esc(x.id) + '" title="Ver itens, Pacto e atributos (só admin)">🔍 Inspecionar</button>' : '';
  }
  // "De onde vem a vida" (Henri, 24/11/2026): cada parte da vida máxima, na ordem do cálculo, com a barra do tamanho do ganho.
  function origemVidaHtml(a) {
    var o = R.origemVida(a), max = Math.max.apply(null, o.linhas.map(function (l) { return Math.abs(l.ganho); }).concat([1]));
    return '<h4 class="insp-vida-titulo">❤ De onde vem a vida <small class="suave">(' + o.total.toLocaleString('pt-BR') + ')</small></h4><table class="insp-vida">'
      + o.linhas.map(function (l) {
        return '<tr><td>' + esc(l.nome) + '</td><td class="insp-vida-txt">' + l.txt + '</td><td class="insp-vida-ganho ' + (l.ganho < 0 ? 'menos' : '') + '">' + (l.ganho > 0 ? '+' : '') + l.ganho.toLocaleString('pt-BR')
          + ' <small class="suave">(' + Math.round(l.ganho * 100 / o.total) + '%)</small></td><td class="insp-vida-barra"><i style="width:' + Math.round(Math.abs(l.ganho) * 100 / max) + '%"></i></td></tr>';
      }).join('') + '</table>';
  }
  var INSP_SLOTS = [['arma', 'Arma'], ['secundaria', 'Mão esquerda'], ['elmo', 'Elmo'], ['peitoral', 'Peitoral'], ['luvas', 'Luvas'], ['botas', 'Botas'],
    ['colar', 'Colar'], ['anel1', 'Anel 1'], ['anel2', 'Anel 2']];
  function inspecaoHtml() {
    var I = estado.inspecao, a = I.p, corpo;
    var abas = [['itens', '🛡 Itens equipados'], ['pacto', '✦ Pactos'], ['atributos', '📊 Atributos']].map(function (b) {
      return '<button class="' + (I.aba === b[0] ? 'ativa' : '') + '" data-acao="insp-aba" data-valor="' + b[0] + '">' + b[1] + '</button>';
    }).join('');
    if (I.erro) corpo = '<p class="menos">' + esc(I.erro) + '</p>';
    else if (!a) corpo = '<p class="suave">Carregando…</p>';
    else {
      var eu = estado.personagem;
      estado.personagem = a;   // as fichas de item comparam com o "personagem atual": aqui, o inspecionado
      try {
        if (I.aba === 'itens') {
          corpo = '<div class="insp-itens">' + INSP_SLOTS.map(function (sl) {
            var it = R.itemNoSlot(a, sl[0]);
            return '<div class="insp-slot"><div class="insp-rotulo">' + sl[1] + '</div>'
              + (it ? '<div class="insp-ficha">' + fichaItemHtml(it, true) + '</div>' : '<p class="suave pequeno">— vazio —</p>') + '</div>';
          }).join('') + '</div>';
        } else if (I.aba === 'pacto') {
          var AS = D.ASCENSAO, A = R.arvoreAscensao(), nos = R.nosAscensao(a), total = R.pontosAscensaoTotal(a), gastos = R.custoNosAscensao(nos);
          if (a.nivel < AS.nivelInicio) corpo = '<p class="suave">O Pacto abre no level ' + AS.nivelInicio + '. Este personagem está no level ' + a.nivel + '.</p>';
          else {
            var porDom = AS.dominios.map(function (d) {
              var meus = nos.filter(function (id) { return A[id] && A[id].dom === d.id; });
              if (!meus.length) return '';
              var nomes = meus.filter(function (id) { return A[id].tipo === 'notavel' || A[id].tipo === 'pedra'; }).map(function (id) {
                var tr = d.trilhas[A[id].trilha];
                return A[id].tipo === 'pedra' ? '💎 ' + tr.pedra.nome : '★ ' + tr.notavel.nome;
              });
              return '<li style="--cor-dom:' + d.cor + '"><b class="insp-dom">' + d.nome + '</b> · ' + meus.length + ' ponto' + (meus.length > 1 ? 's' : '')
                + (nomes.length ? '<div class="pequeno">' + nomes.join(' · ') + '</div>' : '') + '</li>';
            }).join('');
            corpo = '<p><strong>' + gastos + '</strong> de <strong>' + total + '</strong> pontos usados' + (total - gastos > 0 ? ' <span class="suave">(' + (total - gastos) + ' livres)</span>' : '') + '</p>'
              + (porDom ? '<ul class="insp-dominios">' + porDom + '</ul>' + pactoResumo(a).replace('<details class="pacto-resumo"', '<details class="pacto-resumo" open') : '<p class="suave">Nenhum ponto do Pacto pego ainda.</p>');
          }
        } else {
          var s = R.status(a), eq = R.bonusEquipamentos(a), magico = s.tipoDano === 'magico', pc = function (v) { return fmt(v) + '%'; };
          var atrs = R.ATRIBUTOS.map(function (k) {
            return '<dt>' + D.atributos[k].nome + '</dt><dd>' + (a.atributos[k] + (eq[k] || 0)) + ' <small class="suave">(' + a.atributos[k] + ' base' + (eq[k] ? ' + ' + eq[k] + ' itens' : '') + ')</small></dd>';
          }).join('');
          var st = [['Poder', '<strong class="cor-ouro">' + R.poder(a).toLocaleString('pt-BR') + '</strong>'], ['Vida máxima', s.hpMax],
            ['Dano por golpe', dano(s.dano) + (magico ? ' (mágico)' : '')], ['Defesa', s.defesa + ' <small class="suave">(−' + R.cortePct(s.defesa) + '%)</small>'],
            ['Defesa mágica', s.defesaMagica + ' <small class="suave">(−' + R.cortePct(s.defesaMagica) + '%)</small>'], ['Velocidade', s.velocidade],
            ['Precisão', pc(s.precisao)], ['Evasão', pc(s.evasao)],
            [magico ? 'Crítico mágico' : 'Chance de crítico', pc(magico ? s.chanceCriticoMagico : s.chanceCritico)],
            [magico ? 'Dano crítico mágico' : 'Dano crítico', pc(magico ? s.danoCriticoMagico : s.danoCritico)]].map(function (l) { return '<dt>' + l[0] + '</dt><dd>' + l[1] + '</dd>'; }).join('');
          corpo = '<div class="insp-atributos"><div><h4>Atributos</h4><dl class="status">' + atrs + '</dl>'
            + (a.pontosLivres ? '<p class="suave pequeno">' + a.pontosLivres + ' ponto(s) sem usar</p>' : '') + '</div><div><h4>Status</h4><dl class="status">' + st + '</dl></div></div>'
            + origemVidaHtml(a);
        }
      } catch (e) { corpo = '<p class="menos">Não deu para mostrar: ' + esc(e.message) + '</p>'; }
      finally { estado.personagem = eu; }
    }
    return '<div class="zoom-fundo insp-fundo"><div class="zoom-janela insp-janela" role="dialog" aria-label="Inspecionar">'
      + '<button class="zoom-x insp-x" data-acao="insp-fechar" aria-label="Fechar">✕</button>'
      + '<h3 class="subtitulo">🔍 ' + (a ? esc(a.nome) + ' <small class="suave">· Lv ' + a.nivel + ' · ' + esc(nomeClasseP(a)) + '</small>' : 'Inspecionar') + '</h3>'
      + '<div class="sub-abas insp-abas">' + abas + '</div><div class="insp-corpo">' + corpo + '</div></div></div>';
  }
  // ---------- Trade entre jogadores (Henri, 25/11/2026): Social › Trade. Regras no servidor (trade_* no schema.sql). ----------
  function pergTrade(p) { var c = R.pilhaConsumivel(p, 'trade', 'unico'); return c ? c.qtd : 0; }
  function carregarTrade(silencioso) {
    var p = estado.personagem;
    if (!p || !C.trade || (estado.trade && estado.trade.carregando)) return;
    var T = estado.trade || (estado.trade = {});
    T.carregando = true;
    C.trade.estado(p.id).then(function (r) {
      T.carregando = false;
      if (estado.personagem !== p) return;
      T.dados = r; T.erro = null;
      if (estado.aba === 'trade' && !estado.batalha && !estado.luta && !estado.lutaArena && !(silencioso && estado.tradeDigitando)) telaJogo();
    }, function (e) { T.carregando = false; T.erro = e.message; if (estado.aba === 'trade' && !silencioso) telaJogo(); });
  }
  // Quantas negociações esperam por mim (pedido para mim, ou o outro aceitou e eu não).
  function tradesMeus() {
    var p = estado.personagem, d = estado.trade && estado.trade.dados;
    if (!p || !d || !d.abertos) return 0;
    return d.abertos.filter(function (t) {
      var souA = t.a === p.id;
      return (t.estado === 'pedido' && !souA) || (t.estado === 'aberto' && (souA ? t.aceite_b && !t.aceite_a : t.aceite_a && !t.aceite_b));
    }).length;
  }
  function seloTrade() { var n = tradesMeus(); return n ? ' <span class="selo-pedidos">' + n + '</span>' : ''; }
  function entradaTradeHtml(e, minha, tid) {
    var tirar = minha ? '<button class="trade-tirar" data-acao="trade-tirar" data-id="' + tid + '" data-k="' + esc(e.k) + '" title="Tirar da negociação">✕</button>' : '';
    if (e.tipo === 'consumivel') {
      var c = { tipo: e.ctipo, raridade: e.raridade, qtd: e.qtd };
      return '<div class="trade-entrada"><span class="celula borda-' + corConsumivel(c) + '">' + iconeConsumivel(c) + '<span class="qtd-consumivel">' + e.qtd + '</span></span>'
        + '<span class="trade-nome">' + e.qtd + 'x ' + esc(R.nomeConsumivel(c)) + '</span>' + tirar + '</div>';
    }
    var it = e.item || {};
    return '<div class="trade-entrada"><button class="celula borda-' + it.raridade + '" data-acao="trade-ver" data-id="' + tid + '" data-k="' + esc(e.k) + '" title="Ver o item">' + F.icone(it)
      + (it.encanto ? '<span class="qtd-consumivel">+' + it.encanto + '</span>' : '') + '</button>'
      + '<span class="trade-nome"><span class="cor-' + it.raridade + '">' + esc(R.nomeItem(it)) + '</span><small class="suave"> · Lv ' + (it.nivel || 1) + '</small></span>' + tirar + '</div>';
  }
  function ladoTradeHtml(t, lado, eu) {
    var nome = lado === 'a' ? t.nome_a : t.nome_b, itens = lado === 'a' ? t.itens_a : t.itens_b, ouro = Number(lado === 'a' ? t.ouro_a : t.ouro_b) || 0;
    var aceite = lado === 'a' ? t.aceite_a : t.aceite_b, minha = (lado === 'a') === (t.a === eu);
    return '<div class="trade-lado' + (minha ? ' trade-meu' : '') + (aceite ? ' trade-aceitou' : '') + '"><h4>' + esc(nome) + (minha ? ' <small class="suave">(você)</small>' : '')
      + '<small class="trade-papel">' + (lado === 'a' ? 'pediu o trade' : 'aceitou o pedido') + '</small></h4>'
      + (itens.length || ouro ? '' : '<p class="suave pequeno">Ainda não colocou nada.</p>')
      + itens.map(function (e) { return entradaTradeHtml(e, minha, t.id); }).join('')
      + (ouro ? '<div class="trade-entrada"><span class="trade-ouro">💰</span><span class="trade-nome cor-ouro">' + ouro.toLocaleString('pt-BR') + ' de ouro</span>'
        + (minha ? '<button class="trade-tirar" data-acao="trade-tirar" data-id="' + t.id + '" data-k="ouro" title="Tirar o ouro">✕</button>' : '') + '</div>' : '')
      + '<p class="trade-status ' + (aceite ? 'online' : 'suave') + '">' + (aceite ? '✔ Aceitou a troca' : '⏳ Ainda não aceitou') + '</p></div>';
  }
  function abaTrade() {
    var p = estado.personagem, T = estado.trade || {}, d = T.dados, n = pergTrade(p);
    if (!d && !T.carregando) carregarTrade();
    var h = '<section class="caixa trade"><h2>🤝 Trade</h2>'
      + '<p class="suave">Troque itens, consumíveis e ouro com outro jogador. Para <strong>pedir</strong> um trade você precisa de 1 <strong>Pergaminho de Trade</strong> (Loja de Éter): '
      + 'ele só é gasto quando o outro aceita o pedido. Quem recebe o pedido não precisa de pergaminho. A negociação não tem prazo: cada um põe o que quiser e, quando os dois aceitarem, a troca acontece.</p>'
      + '<div class="caixa-interna trade-novo"><span class="trade-perg">' + iconeConsumivel({ tipo: 'trade', raridade: 'unico' }) + ' Você tem <strong>' + n + '</strong> Pergaminho' + (n === 1 ? '' : 's') + ' de Trade</span>'
      + '<form class="trade-pedir" data-form="trade-pedir"><input name="nome" placeholder="Nome do jogador" maxlength="24" autocomplete="off">'
      + '<button class="btn" type="submit"' + (n ? '' : ' disabled') + '>Pedir trade</button></form>'
      + (n ? '' : '<button class="btn secundario btn-pequeno" data-acao="aba" data-aba="loja">Comprar na Loja de Éter</button>') + '</div>';
    if (T.erro && !d) return h + '<p class="menos">' + esc(T.erro) + '</p></section>';
    if (!d) return h + '<p class="suave">Carregando…</p></section>';
    if (d.local) return h + '<p class="suave">O Trade precisa do servidor: jogue pelo site do Eldrin.</p></section>';
    var abertos = (d.abertos || []).slice().sort(function (x, y) { return (x.estado === 'pedido' ? 0 : 1) - (y.estado === 'pedido' ? 0 : 1) || y.id - x.id; });
    h += '<h3 class="subtitulo">Negociações em aberto</h3>';
    if (!abertos.length) h += '<p class="suave">Nenhuma negociação aberta.</p>';
    abertos.forEach(function (t) {
      var souA = t.a === p.id, outro = souA ? t.nome_b : t.nome_a;
      if (t.estado === 'pedido') {
        h += '<div class="caixa-interna trade-pedido">' + (souA
          ? '<span>⏳ Esperando <strong>' + esc(outro) + '</strong> aceitar o seu pedido de trade.</span><button class="btn secundario btn-pequeno" data-acao="trade-cancelar" data-id="' + t.id + '">Cancelar pedido</button>'
          : '<span>📜 <strong>' + esc(outro) + '</strong> quer negociar com você.</span><span class="botoes"><button class="btn" data-acao="trade-responder" data-id="' + t.id + '" data-valor="1">Aceitar</button>'
            + '<button class="btn secundario" data-acao="trade-responder" data-id="' + t.id + '" data-valor="0">Recusar</button></span>') + '</div>';
        return;
      }
      var meuAceite = souA ? t.aceite_a : t.aceite_b, aberto = T.sel === t.id || abertos.filter(function (x) { return x.estado === 'aberto'; }).length === 1;
      h += '<div class="caixa-interna trade-negocio"><div class="trade-cabeca"><strong>Negociação com ' + esc(outro) + '</strong>'
        + '<small class="suave">aberta ' + dataCurta(t.aberto_em) + '</small>'
        + (aberto ? '' : '<button class="btn secundario btn-pequeno" data-acao="trade-sel" data-id="' + t.id + '">Abrir</button>') + '</div>';
      if (aberto) {
        // Em cima: o que eu posso pôr; embaixo: a mesa com os itens que vão ser trocados (Henri)
        h += tradeEscolherHtml(t) + '<h4 class="trade-mesa-titulo">Itens a trocar</h4><div class="trade-mesa">' + ladoTradeHtml(t, 'a', p.id) + '<div class="trade-seta" aria-hidden="true">⇄</div>' + ladoTradeHtml(t, 'b', p.id) + '</div>'
          + '<div class="botoes">' + (meuAceite
            ? '<button class="btn secundario" data-acao="trade-aceitar" data-id="' + t.id + '" data-valor="0">Desfazer meu aceite</button>'
            : '<button class="btn" data-acao="trade-aceitar" data-id="' + t.id + '" data-valor="1">✔ Aceitar a troca</button>')
          + '<button class="btn perigo" data-acao="trade-cancelar" data-id="' + t.id + '">Cancelar negociação</button></div>'
          + '<p class="suave pequeno">Se alguém mudar o que está na mesa, os dois precisam aceitar de novo. Cancelar devolve o que cada um pôs; o pergaminho de quem pediu não volta.</p>';
      }
      h += '</div>';
    });
    var hist = d.historico || [];
    if (hist.length) {
      h += '<h3 class="subtitulo">Histórico</h3><ul class="trade-historico">' + hist.map(function (t) {
        var souA = t.a === p.id, outro = souA ? t.nome_b : t.nome_a;
        var resumo = function (itens, ouro) {
          var l = (itens || []).map(function (e) { return e.tipo === 'consumivel' ? e.qtd + 'x ' + R.nomeConsumivel({ tipo: e.ctipo, raridade: e.raridade }) : R.nomeItem(e.item || {}); });
          if (Number(ouro)) l.push(Number(ouro).toLocaleString('pt-BR') + ' de ouro');
          return l.length ? esc(l.join(', ')) : 'nada';
        };
        return '<li>' + (t.estado === 'feito' ? '✔ Trade com <strong>' + esc(outro) + '</strong>: você deu ' + resumo(souA ? t.itens_a : t.itens_b, souA ? t.ouro_a : t.ouro_b)
          + ' e recebeu ' + resumo(souA ? t.itens_b : t.itens_a, souA ? t.ouro_b : t.ouro_a)
          : '✖ ' + (t.estado === 'recusado' ? 'Pedido recusado' : 'Cancelado') + ' com <strong>' + esc(outro) + '</strong>') + ' <span class="suave">· ' + dataCurta(t.fechado_em) + '</span></li>';
      }).join('') + '</ul>';
    }
    return h + '</section>';
  }
  // Parte de cima da mesa: escolher o que pôr (mochila, consumíveis ou ouro).
  function tradeEscolherHtml(t) {
    var p = estado.personagem, livres = R.mochila(p).filter(function (i) { return !i.travado; });
    var cons = R.consumiveis(p).filter(function (c) { return c.tipo !== 'trade' && c.qtd > 0; });
    return '<div class="trade-escolher"><h4>Escolha o que colocar <small class="suave">(toque no item)</small></h4>'
      + (livres.length ? '<div class="mochila trade-grade">' + livres.map(function (i) {
        return quadroItem(i, 'celula').replace('data-acao="item"', 'data-acao="trade-por-item" data-trade="' + t.id + '"');
      }).join('') + '</div>' : '<p class="suave pequeno">Nada na mochila para trocar (itens equipados e travados 🔒 não entram).</p>')
      + (cons.length ? '<div class="trade-consumiveis">' + cons.map(function (c) {
        return '<div class="trade-cons"><span class="celula borda-' + corConsumivel(c) + '">' + iconeConsumivel(c) + '<span class="qtd-consumivel">' + c.qtd + '</span></span>'
          + '<span class="trade-nome">' + esc(R.nomeConsumivel(c)) + '</span>'
          + '<input type="number" min="1" max="' + c.qtd + '" value="1" class="trade-qtd" data-cons="' + esc(c.tipo + ':' + c.raridade) + '">'
          + '<button class="btn secundario btn-pequeno" data-acao="trade-por-cons" data-trade="' + t.id + '" data-cons="' + esc(c.tipo + ':' + c.raridade) + '">Pôr</button></div>';
      }).join('') + '</div>' : '')
      + '<form class="trade-ouro-form" data-form="trade-ouro" data-trade="' + t.id + '"><span>💰</span><input name="ouro" type="number" min="1" max="' + (p.ouro || 0) + '" placeholder="Ouro (você tem ' + (p.ouro || 0).toLocaleString('pt-BR') + ')">'
      + '<button class="btn secundario btn-pequeno" type="submit">Pôr ouro</button></form></div>';
  }
  // Chamada do Trade que mexe na ficha: grava antes, chama, tira do jogo o que saiu e puxa a ficha/créditos de novo.
  async function tradeChamar(fazer, local, msg) {
    var p = estado.personagem, T = estado.trade || (estado.trade = {});
    if (T.ocupado) return;
    T.ocupado = true;
    try {
      await gravarAntesDoBanco(p);
      var r = await fazer();
      if (local) local(p);
      T.dados = r;
      await sincronizarFicha();
      if (msg) avisar(msg, 'item');
      receberPendentes();
    } catch (e) { avisar((e && e.message) || 'Não foi possível concluir.'); carregarTrade(true); }
    T.ocupado = false;
    telaJogo();
  }
  function lojaChamar(prom, msg) {
    var p = estado.personagem;
    if (estado.lojaOcupado) return;
    estado.lojaOcupado = true; estado.lojaConfirma = null;
    prom.then(function (l) {
      estado.lojaOcupado = false;
      if (estado.personagem !== p) return;
      l.pid = p.id; estado.loja = l;
      p.vip = !!(l.vip_ate && Date.parse(l.vip_ate) > C.agora()); guardarVip(p.vip);
      avisar(msg, 'item');
      carregarVips();
      return receberPendentes();
    }, function (e) { estado.lojaOcupado = false; avisar((e && e.message) || 'Não foi possível concluir.'); })
      .then(function () { if (estado.aba === 'loja') telaJogo(); });
  }

  // Nome em destaque do VIP (Henri, 19/11/2026): em todo lugar onde aparece o nome de um personagem VIP, ele ganha o
  // brilho (azul "Nevasca" para herói, rosa para heroína). A lista de nomes vem do servidor (loja_vips) e um observador
  // pinta os textos da página sempre que ela muda.
  var VIPS = { nomes: {}, re: null, pintando: false, pedido: false };
  function carregarVips() {
    if (!C.loja || !C.loja.vips) return;
    C.loja.vips().then(function (m) {
      VIPS.nomes = m || {};
      var ks = Object.keys(VIPS.nomes).filter(function (n) { return n && n.length >= 2; }).sort(function (a, b) { return b.length - a.length; });
      VIPS.re = ks.length ? new RegExp('(^|[^\\p{L}\\p{N}_])(' + ks.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?=$|[^\\p{L}\\p{N}_])', 'gu') : null;
      pintarVips();
    }, function () { /* sem lista: nomes normais */ });
  }
  setInterval(function () { if (estado.personagem && document.visibilityState !== 'hidden') carregarVips(); }, 5 * 60000);
  function pintarVips() {
    if (!VIPS.re || VIPS.pintando || !document.body) return;
    VIPS.pintando = true;
    try {
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        var pai = n.parentNode;
        if (!pai || !n.nodeValue || n.nodeValue.length < 2) return NodeFilter.FILTER_REJECT;
        if (pai.closest && pai.closest('.nome-vip, script, style, textarea, input, select, option, title, canvas, svg')) return NodeFilter.FILTER_REJECT;
        VIPS.re.lastIndex = 0;
        return VIPS.re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      } });
      var lista = [];
      while (w.nextNode()) lista.push(w.currentNode);
      lista.forEach(function (n) {
        var txt = n.nodeValue, frag = document.createDocumentFragment(), ult = 0, m;
        VIPS.re.lastIndex = 0;
        while ((m = VIPS.re.exec(txt))) {
          var ini = m.index + m[1].length;
          if (ini > ult) frag.appendChild(document.createTextNode(txt.slice(ult, ini)));
          var sp = document.createElement('span');
          sp.className = 'nome-vip ' + (VIPS.nomes[m[2]] === 'feminino' ? 'vip-f' : 'vip-m');
          sp.textContent = m[2];
          frag.appendChild(sp);
          ult = ini + m[2].length;
        }
        if (ult < txt.length) frag.appendChild(document.createTextNode(txt.slice(ult)));
        n.parentNode.replaceChild(frag, n);
      });
    } catch (e) { /* navegador sem \p{L}: fica sem brilho */ }
    VIPS.pintando = false;
  }
  if (window.MutationObserver) new MutationObserver(function () {
    if (!VIPS.re || VIPS.pintando || VIPS.pedido) return;
    VIPS.pedido = true;
    requestAnimationFrame(function () { VIPS.pedido = false; pintarVips(); });
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  function carregarBau() {
    var p = estado.personagem;
    if (!p || estado.bauCarregando) return;
    estado.bauCarregando = true;
    C.bau.estado(p.id).then(function (b) {
      estado.bauCarregando = false; estado.bau = b; estado.bauErro = null;
      if (vendoBau()) telaJogo();
    }, function (e) {
      estado.bauCarregando = false; estado.bauErro = (e && e.message) || 'Não foi possível abrir o baú.';
      if (vendoBau()) telaJogo();
    });
  }
  function abaBau() {
    var p = estado.personagem, b = estado.bau;
    if (!b && !estado.bauErro) carregarBau();
    var tit = '<h2>Baú da conta</h2><p class="suave">Compartilhado pelos personagens da sua conta. Guarde e retire <strong>ouro</strong> e '
      + '<strong>consumíveis</strong> (pergaminhos, cristais, materiais, receitas). Itens equipáveis não entram.</p>';
    if (!ACAO_SERVIDOR) return '<section class="caixa">' + tit + '<p class="suave">O baú precisa do servidor do jogo.</p></section>';
    if (estado.bauErro) return '<section class="caixa">' + tit + '<p class="erro">' + esc(estado.bauErro) + '</p>'
      + '<button class="btn" data-acao="bau-recarregar">Tentar de novo</button></section>';
    if (!b) return '<section class="caixa">' + tit + '<p class="suave">Abrindo o baú…</p></section>';
    var ouroBau = Number(b.ouro) || 0, cons = b.consumiveis || {};
    var ouro = '<div class="caixa-interna cla-secao"><h3>Ouro</h3>'
      + '<p>No baú: <strong class="cor-ouro">' + ouroBau.toLocaleString('pt-BR') + '</strong> · com ' + esc(p.nome) + ': <strong class="cor-ouro">'
      + (p.ouro || 0).toLocaleString('pt-BR') + '</strong></p>'
      + '<div class="linha-form"><input id="bau-ouro" type="number" min="1" inputmode="numeric" placeholder="Quanto ouro">'
      + '<button class="btn" data-acao="bau-guardar-ouro">Guardar</button><button class="btn secundario" data-acao="bau-retirar-ouro">Retirar</button></div></div>';
    var linha = function (tipo, rar, qtd, onde) {
      var c = { tipo: tipo, raridade: rar, qtd: qtd };
      return '<div class="bau-linha"><span class="bau-ico borda-' + corConsumivel(c) + '">' + iconeConsumivel(c) + '</span>'
        + '<span class="bau-nome">' + esc(R.nomeConsumivel(c)) + ' <span class="suave">× ' + qtd.toLocaleString('pt-BR') + '</span></span>'
        + '<input type="number" min="1" max="' + qtd + '" value="' + qtd + '" id="bau-q-' + onde + '-' + tipo + '-' + rar + '" aria-label="Quantidade">'
        + '<button class="btn btn-pequeno' + (onde === 'eu' ? '' : ' secundario') + '" data-acao="' + (onde === 'eu' ? 'bau-guardar-item' : 'bau-retirar-item')
        + '" data-tipo="' + tipo + '" data-raridade="' + rar + '">' + (onde === 'eu' ? 'Guardar' : 'Retirar') + '</button></div>';
    };
    var meus = R.consumiveis(p).filter(function (c) { return c.qtd > 0 && D.CONSUMIVEIS[c.tipo]; })
      .map(function (c) { return linha(c.tipo, c.raridade, c.qtd, 'eu'); }).join('');
    var noBau = Object.keys(cons).filter(function (k) { return cons[k] > 0; }).sort().map(function (k) {
      var x = k.split(':'); return linha(x[0], x[1], Number(cons[k]), 'bau');
    }).join('');
    var itens = '<div class="caixa-interna cla-secao"><h3>Consumíveis no baú</h3>' + (noBau || '<p class="suave">Nada guardado ainda.</p>') + '</div>'
      + '<div class="caixa-interna cla-secao"><h3>Consumíveis de ' + esc(p.nome) + '</h3>' + (meus || '<p class="suave">Este personagem não tem consumíveis.</p>') + '</div>';
    var hist = (b.historico || []).map(function (h) {
      var o = []; if (Number(h.ouro)) o.push(Number(h.ouro).toLocaleString('pt-BR') + ' de ouro');
      if (h.item && h.qtd) { var x = h.item.split(':'); o.push(h.qtd + 'x ' + R.nomeConsumivel({ tipo: x[0], raridade: x[1] })); }
      return '<li>' + (h.tipo === 'deposito' ? '⬇️ ' : '⬆️ ') + esc(h.nome || '?') + (h.tipo === 'deposito' ? ' guardou ' : ' retirou ') + o.join(' e ')
        + ' <span class="suave">· ' + new Date(h.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</span></li>';
    }).join('');
    return '<section class="caixa bau-conta">' + tit + ouro + itens
      + (hist ? '<div class="caixa-interna cla-secao"><h3>Últimas movimentações</h3><ul class="bau-historico">' + hist + '</ul></div>' : '') + '</section>';
  }
  function bauDepositar(args, msg) {
    if (estado.bauOcupado) return;
    estado.bauOcupado = true;
    acaoServidor('bauDepositar', args).then(function (r) {
      estado.bauOcupado = false;
      if (r && !r.erro) { avisar(msg, 'item'); estado.bau = null; carregarBau(); }
      else if (vendoBau()) telaJogo();
    });
  }
  function bauRetirar(ouro, item, qtd, msg) {
    var p = estado.personagem;
    if (estado.bauOcupado) return;
    estado.bauOcupado = true;
    C.bau.retirar(p.id, ouro, item, qtd).then(function (b) {
      estado.bauOcupado = false; estado.bau = b;
      avisar(msg, 'item');
      return receberPendentes();
    }, function (e) { estado.bauOcupado = false; avisar((e && e.message) || 'Não foi possível retirar.'); })
      .then(function () { if (vendoBau()) telaJogo(); });
  }
  // O baú agora fica na Mochila (Herói › Personagem › Baú, Henri, 19/11/2026).
  function vendoBau() { return estado.aba === 'bau' || (estado.aba === 'personagem' && estado.mochilaAba === 'bau'); }
  // Baú na mochila: à esquerda o que o personagem pode guardar, à direita o que está no baú. Botão direito move tudo;
  // o esquerdo abre a escolha da quantidade.
  // Ícones das abas da Mochila (Henri, 19/11/2026): mochila marrom, pergaminho comum e baú de madeira com ferro.
  var ICONES_MOCHILA = {
    equipamentos: '<svg class="ico-mochila" viewBox="0 0 24 24" aria-hidden="true">'
      + '<path d="M9 5.5C9 3.6 10.3 2.5 12 2.5s3 1.1 3 3" fill="none" stroke="#5a3a1e" stroke-width="1.6"/>'
      + '<rect x="4.5" y="5" width="15" height="16.5" rx="4" fill="#8b5a2b" stroke="#3e2512" stroke-width="1.1"/>'
      + '<path d="M4.5 10.5h15" stroke="#3e2512" stroke-width="1"/>'
      + '<rect x="7.5" y="12.5" width="9" height="6.5" rx="1.6" fill="#a8713a" stroke="#3e2512" stroke-width="1"/>'
      + '<path d="M7.5 15h9" stroke="#3e2512" stroke-width=".9"/><rect x="11" y="14" width="2" height="2.2" rx=".4" fill="#d9b25a"/>'
      + '<path d="M6.5 6.5c1.5-.6 3-.8 5.5-.8" stroke="#b98451" stroke-width=".9" fill="none" opacity=".7"/></svg>',
    consumiveis: '<svg class="ico-mochila" viewBox="0 0 24 24" aria-hidden="true">'
      + '<path d="M6 6.5h11.5v11c0 1.7-1.2 3-2.8 3H6.2" fill="#ead7a8" stroke="#6b5230" stroke-width="1.1"/>'
      + '<path d="M6 6.5a2.2 2.2 0 1 0 0 4.4h1.6V6.5" fill="#d8c08a" stroke="#6b5230" stroke-width="1.1"/>'
      + '<path d="M6.2 20.5a2.3 2.3 0 0 1 0-4.6H17.5" fill="#d8c08a" stroke="#6b5230" stroke-width="1.1"/>'
      + '<path d="M9.5 9.6h5.5M9.5 11.8h5.5M9.5 14h4" stroke="#8a6d43" stroke-width=".9" stroke-linecap="round"/></svg>',
    bau: '<svg class="ico-mochila" viewBox="0 0 24 24" aria-hidden="true">'
      + '<path d="M3.5 10.5V9a5 4.5 0 0 1 5-4.5h7a5 4.5 0 0 1 5 4.5v1.5Z" fill="#9a6532" stroke="#3a240f" stroke-width="1.1"/>'
      + '<rect x="3.5" y="10.5" width="17" height="9.5" rx="1" fill="#8a5728" stroke="#3a240f" stroke-width="1.1"/>'
      + '<path d="M3.5 14.5h17M3.5 7.8h17" stroke="#5b3a1a" stroke-width=".8" opacity=".8"/>'
      + '<path d="M7 4.9V20M17 4.9V20" stroke="#5f6670" stroke-width="1.8"/>'
      + '<path d="M3.5 10.5h17" stroke="#5f6670" stroke-width="1.6"/>'
      + '<rect x="10.4" y="9.6" width="3.2" height="4.2" rx=".6" fill="#7d858f" stroke="#2f3338" stroke-width=".8"/>'
      + '<circle cx="12" cy="11.4" r=".55" fill="#1d1f22"/><path d="M12 11.8v1" stroke="#1d1f22" stroke-width=".6"/>'
      + '<circle cx="7" cy="17.5" r=".5" fill="#c9ced4"/><circle cx="17" cy="17.5" r=".5" fill="#c9ced4"/><circle cx="7" cy="7" r=".5" fill="#c9ced4"/><circle cx="17" cy="7" r=".5" fill="#c9ced4"/></svg>',
  };
  function bauMochilaHtml(p) {
    var b = estado.bau;
    if (!ACAO_SERVIDOR) return '<p class="suave">O baú precisa do servidor do jogo.</p>';
    if (!b && !estado.bauErro) carregarBau();
    if (estado.bauErro) return '<p class="erro">' + esc(estado.bauErro) + '</p><button class="btn" data-acao="bau-recarregar">Tentar de novo</button>';
    if (!b) return '<p class="suave">Abrindo o baú…</p>';
    var cons = b.consumiveis || {}, esc_ = estado.bauEscolha;
    var celula = function (lado, tipo, rar, qtd) {
      var c = { tipo: tipo, raridade: rar, qtd: qtd }, sel = esc_ && esc_.lado === lado && esc_.tipo === tipo && esc_.raridade === rar;
      return '<button class="celula borda-' + corConsumivel(c) + (sel ? ' focado' : '') + '" data-acao="bau-cel" data-lado="' + lado + '" data-tipo="' + tipo
        + '" data-raridade="' + rar + '" data-qtd="' + qtd + '" title="' + esc(R.nomeConsumivel(c)) + ' · ' + qtd + '">' + iconeConsumivel(c)
        + '<span class="qtd-consumivel">' + qtd.toLocaleString('pt-BR') + '</span></button>';
    };
    var grade = function (cels) {
      for (var n = cels.length; n < 8; n++) cels.push('<div class="celula vazia"></div>');
      return '<div class="mochila consumiveis bau-grade">' + cels.join('') + '</div>';
    };
    var meus = R.consumiveis(p).filter(function (c) { return c.qtd > 0 && D.CONSUMIVEIS[c.tipo]; })
      .map(function (c) { return celula('eu', c.tipo, c.raridade, c.qtd); });
    var noBau = Object.keys(cons).filter(function (k) { return cons[k] > 0; }).sort()
      .map(function (k) { var x = k.split(':'); return celula('bau', x[0], x[1], Number(cons[k])); });
    var escolha = '';
    if (esc_) {
      var nomeE = R.nomeConsumivel({ tipo: esc_.tipo, raridade: esc_.raridade }), eu = esc_.lado === 'eu';
      escolha = '<div class="bau-escolha caixa-interna"><span>' + (eu ? 'Guardar no baú' : 'Retirar do baú') + ': <strong>' + esc(nomeE) + '</strong> <span class="suave">(tem ' + esc_.qtd + ')</span></span>'
        + '<input id="bau-escolha-qtd" type="number" min="1" max="' + esc_.qtd + '" value="' + esc_.qtd + '" inputmode="numeric" aria-label="Quantidade">'
        + '<button class="btn btn-pequeno" data-acao="bau-mover">' + (eu ? 'Guardar' : 'Retirar') + '</button>'
        + '<button class="btn btn-pequeno secundario" data-acao="bau-mover" data-valor="tudo">Tudo</button>'
        + '<button class="btn btn-pequeno secundario" data-acao="bau-escolha-fechar">✕</button></div>';
    }
    var hist = (b.historico || []).slice(0, 10).map(function (h) {
      var o = []; if (Number(h.ouro)) o.push(Number(h.ouro).toLocaleString('pt-BR') + ' de ouro');
      if (h.item && h.qtd) { var x = h.item.split(':'); o.push(h.qtd + 'x ' + R.nomeConsumivel({ tipo: x[0], raridade: x[1] })); }
      return '<li>' + (h.tipo === 'deposito' ? '⬇️ ' : '⬆️ ') + esc(h.nome || '?') + (h.tipo === 'deposito' ? ' guardou ' : ' retirou ') + o.join(' e ')
        + ' <span class="suave">· ' + dataCurta(h.criado_em) + '</span></li>';
    }).join('');
    return '<p class="suave pequeno">Baú da conta: os seus personagens guardam e retiram ouro e consumíveis (itens não entram). '
      + (temMouse ? '<strong>Botão direito</strong> move tudo; o <strong>esquerdo</strong> escolhe a quantidade.' : 'Toque num consumível para escolher a quantidade.') + '</p>'
      + '<div class="bau-ouro linha-form">' + ICONES.ouro + '<span>Baú: <strong class="cor-ouro">' + (Number(b.ouro) || 0).toLocaleString('pt-BR') + '</strong></span>'
      + '<input id="bau-ouro" type="number" min="1" inputmode="numeric" placeholder="Quanto ouro">'
      + '<button class="btn btn-pequeno" data-acao="bau-guardar-ouro">Guardar</button><button class="btn btn-pequeno secundario" data-acao="bau-retirar-ouro">Retirar</button></div>'
      + escolha
      + '<div class="bau-duplo"><div><h4>Com ' + esc(p.nome) + '</h4>' + grade(meus) + '</div>'
      + '<div><h4>No baú</h4>' + grade(noBau) + '</div></div>'
      + (hist ? '<details class="bau-hist"><summary>Últimas movimentações</summary><ul class="bau-historico">' + hist + '</ul></details>' : '');
  }
  // Move do personagem para o baú (lado 'eu') ou do baú para o personagem.
  function bauMover(lado, tipo, rar, qtd) {
    var nome = qtd + 'x ' + R.nomeConsumivel({ tipo: tipo, raridade: rar });
    estado.bauEscolha = null;
    if (lado === 'eu') bauDepositar({ tipo: tipo, raridade: rar, qtd: qtd }, nome + ' guardado no baú.');
    else bauRetirar(0, tipo + ':' + rar, qtd, nome + ' retirado do baú.');
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
      + (def.curaDot ? '; você recupera ' + def.curaDot + '% do que ele tira' : '') + (def.pula ? '; pula para outro monstro' + (def.curaMorte ? '; cada monstro morto pelo veneno cura ' + def.curaMorte + '%' : '') : ''));
    if (def.escudoPct) x.push('escudo que segura <b>' + v('escudoPct') + '%</b> da vida por ' + def.turnos + ' turnos; quem bate tem ' + def.congelaChance + '% de chance de congelar');
    if (def.mult) x.push('golpe de <b>' + v('mult') + '%</b>' + (def.ignoraDefesaPct ? (def.ignoraDefesaPct >= 100 ? ' que ignora a defesa' : ' que ignora ' + def.ignoraDefesaPct + '% da defesa') : ''));
    if (def.vidaFaltando) x.push('+' + String(def.vidaFaltando).replace('.', ',') + '% de dano para cada 1% de vida que falta');
    if (def.silencia) x.push('o oponente fica ' + def.silencia + ' vez sem habilidades');
    if (def.garantido) x.push('sempre vale o 20 do dado e não pode ser esquivado');
    if (def.executa) x.push('<b>+' + def.executa.bonus + '%</b> se o oponente tiver menos de ' + def.executa.abaixo + '% da vida');
    if (def.queima) x.push('queima por ' + def.queima.turnos + ' vezes (<b>' + String(R.valorNivel(def.queima.pct, n)).replace('.', ',') + '%</b> do seu dano) e corta as curas pela metade');
    if (def.quebraDefesaPct) x.push((def.atordoa ? 'prende por ' + def.atordoa + ' vez e ' : '') + 'tira <b>' + v('quebraDefesaPct') + '%</b> da defesa '
      + (def.quebraTurnos ? 'por ' + def.quebraTurnos + ' turnos' : 'até o fim da luta'));
    if (def.erroPct) x.push('por ' + def.turnos + ' vezes, o oponente tem <b>' + v('erroPct') + '%</b> de chance de errar');
    if (def.milagrePct) x.push('uma vez por luta, se cair, volta com <b>' + v('milagrePct') + '%</b> da vida');
    if (Array.isArray(def.defesaPct)) x.push('<b>+' + v('defesaPct') + '%</b> de defesa por ' + def.turnos + ' vezes e devolve ' + def.reflete + '% do dano recebido');
    var t = x.join('; ');
    return t.charAt(0).toUpperCase() + t.slice(1) + '.';
  }
  var CAMPO_HAB = { dano: 'dano', danoCritico: 'dano crítico', critico: 'chance de crítico', velocidade: 'velocidade', precisao: 'precisão',
    vidaPct: 'vida máxima', defesaPct: 'defesa', evasao: 'esquiva', danoCriticoMagico: 'dano crítico mágico', recompensa: 'ouro e exp',
    espinhosPvE: 'Armadura de Espinhos (devolve o dano dos monstros; não vale na Arena)' };
  var NOME_ATR = { for: 'Força', des: 'Destreza', res: 'Resistência', int: 'Inteligência', sor: 'Sorte' };
  // O que a habilidade faz com N pontos (com 0 pontos mostra como fica com 1).
  function efeitoHabilidade(def, pts) {
    var n = def.inicial ? 0 : Math.max(1, pts), T = D.TALENTOS;
    if (def.nivel) return efeitoNivel(def, n);
    var bonus = function () {
      return Object.keys(CAMPO_HAB).filter(function (c) { return def[c]; }).map(function (c) {
        return CAMPO_HAB[c] + ' +' + String(R.valorBonus(def, c, n)).replace('.', ',') + '%';
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
        // passivas de sempre com efeito por ponto (Sede de Caça: roubo de vida 1% a 10%) também aparecem
        var ext = ['regenPct', 'rouboVida', 'reducaoDano', 'danoExtraPct'].some(function (c) { return def[c]; }) ? ' ' + efeitoNivel(def, n) : '';
        return 'Sempre: <b>' + atr.concat(bonus()).join(', ') + '</b>.' + ext;
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
    // passivas: sempre ligadas (1 ponto de graça) + os pontos colocados (Henri, 13/11/2026)
    if (def.tipo === 'passiva') total = trancada ? 0 : 1 + total;
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
  // ---------- Pacto de Ascensão (Daniel, nov/2026): árvore depois do level 40 ----------
  // estado.ascPend: pontos escolhidos e ainda não confirmados; estado.ascSel: ponto tocado (mostra o detalhe embaixo).
  var NOME_EF_ASC = {
    dano: ['%', 'de dano'], danoChefe: ['%', 'de dano contra chefes'], danoMeiaVida: ['%', 'de dano em quem tem menos da metade da vida'],
    danoCacada: ['%', 'de dano contra monstros da caçada'], critico: ['', 'de chance de crítico'], danoCritico: ['%', 'de dano crítico'],
    precisao: ['', 'de precisão'], defesa: ['%', 'de defesa'], defesaMagica: ['%', 'de defesa mágica'], vida: ['%', 'de vida'],
    velocidade: ['%', 'de velocidade'], evasao: ['', 'de esquiva'], rouboVida: ['%', 'de roubo de vida'], danoHab: ['%', 'de dano das habilidades'],
    ouro: ['%', 'de ouro'], exp: ['%', 'de exp'], drop: ['%', 'de chance de drop'],
    velocidadePts: ['', 'de velocidade'], danoHibrido: ['%', 'de dano híbrido'],
  };
  function efAscTexto(ef) {
    return Object.keys(ef).map(function (k) {
      var v = ef[k];
      if (k === 'reflete') return 'Devolve ' + fmtDec(v) + '% do dano recebido';
      if (k === 'reducaoDano') return '−' + v + '% de dano recebido';
      if (k === 'recargaPct') return 'Habilidades recarregam ' + v + '% mais rápido (nunca menos de 2 turnos)';
      if (k === 'eruditoExp') return '+' + v + '% de exp (com os pontos no limite, vira +' + fmtDec(Math.round(v / 3 * 10) / 10) + '% de drop)';
      if (k === 'curaHab') return 'Cura ' + String(v).replace('.', ',') + '% da vida ao usar uma habilidade';
      if (k === 'recargaMenos') return 'A cada ' + (D.ASCENSAO.focoCada || 4) + ' turnos, as habilidades recarregam ' + v + ' turno' + (v > 1 ? 's' : '') + ' mais rápido';
      if (k === 'danoVidaAtual') return '+' + fmtDec(v) + '% da vida atual do alvo em cada golpe';
      if (k === 'danoHibrido') return '+' + fmtDec(v) + '% de dano híbrido (vai contra a defesa oposta)';
      var n = NOME_EF_ASC[k];
      return n ? (v > 0 ? '+' : '−') + fmtDec(Math.abs(v)) + n[0] + ' ' + n[1] : '';
    }).filter(Boolean).join(' · ');
  }
  function pendAsc() { return estado.ascPend || (estado.ascPend = []); }
  function seloAscensao() {
    var p = estado.personagem;
    if (!p || p.nivel < D.ASCENSAO.nivelInicio + 1) return '';
    var n = R.pontosAscensaoLivres(p);
    return n > 0 ? ' <span class="selo-pedidos">' + n + '</span>' : '';
  }
  // Desenho da árvore (mesmo desenho da proposta): 6 domínios em volta do centro, 2 trilhas cada, pontes entre vizinhos.
  var GEO_ASC = null;
  function geoAscensao() {
    if (GEO_ASC) return GEO_ASC;
    var W = 1520, C = W / 2, n = D.ASCENSAO.dominios.length, pos = {};
    var pt = function (r, g) { var a = g * Math.PI / 180; return [Math.round((C + r * Math.cos(a)) * 10) / 10, Math.round((C + r * Math.sin(a)) * 10) / 10]; };
    var RT = [150, 205], RL = [265, 330, 390, 450, 510], ABRE = 15, doms = [];
    D.ASCENSAO.dominios.forEach(function (d, i) {
      var ang = -90 + i * 360 / n;
      pos[d.id + '-t0'] = pt(RT[0], ang); pos[d.id + '-t1'] = pt(RT[1], ang);
      [-1, 1].forEach(function (lado, t) {
        RL.forEach(function (r, k) { pos[d.id + '-' + t + '-' + k] = pt(r, ang + lado * (ABRE + (k % 2 ? 2.5 : 0))); });
        pos[d.id + '-' + t + '-p'] = pt(590, ang + lado * (ABRE + 2));
      });
      doms.push({ d: d, ang: ang });
    });
    var curvas = {};
    doms.forEach(function (g, i) {
      var h = doms[(i + 1) % n];
      [1].forEach(function (k, q) {   // Pacto v2: uma ponte por par (a de fora saiu)
        var id = 'ponte-' + g.d.id + '-' + h.d.id + '-' + q, a = pos[g.d.id + '-1-' + k], b = pos[h.d.id + '-0-' + k];
        var meio = pt(q ? 470 : 345, (g.ang + h.ang) / 2 + (i === n - 1 ? 180 : 0));
        curvas[id] = { a: a, b: b, meio: meio, cores: [g.d.cor, h.d.cor] };
        pos[id] = [Math.round((a[0] + 2 * meio[0] + b[0]) / 4 * 10) / 10, Math.round((a[1] + 2 * meio[1] + b[1]) / 4 * 10) / 10];
      });
    });
    return (GEO_ASC = { W: W, C: C, pos: pos, pt: pt, doms: doms, curvas: curvas });
  }
  function pactoSvg(p, lista, pend) {
    var G = geoAscensao(), A = R.arvoreAscensao(), AS = D.ASCENSAO, pos = G.pos, C = G.C, sel = estado.ascSel;
    var total = R.pontosAscensaoTotal(p), aberto = p.nivel >= AS.nivelInicio;
    var tem = function (id) { return lista.indexOf(id) >= 0; };
    var podeId = function (id) { return aberto && !tem(id) && !R.motivoAscensao(lista, id, total); };
    var caminho = sel && aberto && !tem(sel) ? R.caminhoAscensao(lista, sel) || [] : [];   // caminho até o ponto tocado
    var travada = function (id) { return A[id].tipo === 'pedra' && !tem(id) && lista.some(function (x) { return A[x].tipo === 'pedra' && A[x].dom === A[id].dom; }); };
    var cor = function (id) { var no = A[id]; return no.dom ? D.ASCENSAO.dominios.filter(function (d) { return d.id === no.dom; })[0].cor : '#e6cf9c'; };
    var L = function (a, b, c, op, w, extra) { return '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="' + c + '" stroke-opacity="' + op + '" stroke-width="' + w + '"' + (extra || '') + '/>'; };
    var ligado = function (a, b) { return tem(a) && tem(b); };
    var s = '', defs = '';
    [200, 330, 450, 570].forEach(function (r) { s += '<circle cx="' + C + '" cy="' + C + '" r="' + r + '" fill="none" stroke="#d4a24c" stroke-opacity=".08" stroke-width="1.5"/>'; });
    // pontes
    Object.keys(G.curvas).forEach(function (id, i) {
      var c = G.curvas[id], on = tem(id);
      defs += '<linearGradient id="asc-g' + i + '" gradientUnits="userSpaceOnUse" x1="' + c.a[0] + '" y1="' + c.a[1] + '" x2="' + c.b[0] + '" y2="' + c.b[1] + '"><stop offset="0" stop-color="' + c.cores[0] + '"/><stop offset="1" stop-color="' + c.cores[1] + '"/></linearGradient>';
      s += '<path d="M' + c.a[0] + ' ' + c.a[1] + ' Q' + c.meio[0] + ' ' + c.meio[1] + ' ' + c.b[0] + ' ' + c.b[1] + '" stroke="url(#asc-g' + i + ')" stroke-width="' + (on ? 4 : 2.2) + '" stroke-opacity="' + (on ? 1 : .5) + '" fill="none"/>';
    });
    G.doms.forEach(function (g) {
      var d = g.d, c = d.cor, b0 = d.id + '-0-', b1 = d.id + '-1-';
      s += L(pos[b0 + 2], pos[b1 + 2], c, ligado(b0 + 2, b1 + 2) ? .9 : .35, 1.8, ' stroke-dasharray="4 5"');
      var mm = G.pt(594, g.ang);
      s += L(pos[b0 + 'p'], mm, '#c0392b', .8, 2, ' stroke-dasharray="4 4"') + L(pos[b1 + 'p'], mm, '#c0392b', .8, 2, ' stroke-dasharray="4 4"');
      s += '<circle cx="' + mm[0] + '" cy="' + mm[1] + '" r="10" fill="#2a0e0a" stroke="#c0392b" stroke-width="2"/><text x="' + mm[0] + '" y="' + (mm[1] + 4.5) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#ff8a7a">✕</text>';
      var ini = G.pt(120, g.ang);
      s += L(ini, pos[d.id + '-t0'], c, tem(d.id + '-t0') ? 1 : .6, 3) + L(pos[d.id + '-t0'], pos[d.id + '-t1'], c, ligado(d.id + '-t0', d.id + '-t1') ? 1 : .6, ligado(d.id + '-t0', d.id + '-t1') ? 4.5 : 3);
      [0, 1].forEach(function (t) {
        var b = d.id + '-' + t + '-';
        s += L(pos[d.id + '-t1'], pos[b + 0], c, ligado(d.id + '-t1', b + 0) ? 1 : .6, ligado(d.id + '-t1', b + 0) ? 4.5 : 3);
        for (var k = 1; k < 5; k++) s += L(pos[b + (k - 1)], pos[b + k], c, ligado(b + (k - 1), b + k) ? 1 : .6, ligado(b + (k - 1), b + k) ? 4.5 : 3);
        s += L(pos[b + 4], pos[b + 'p'], c, ligado(b + 4, b + 'p') ? 1 : .6, ligado(b + 4, b + 'p') ? 4.5 : 3);
      });
      var lab = G.pt(300, g.ang);
      s += '<image href="assets/ascensao/dominio-' + d.id + '.webp" x="' + (lab[0] - 30) + '" y="' + (lab[1] - 30) + '" width="60" height="60"/>';
      var lab2 = G.pt(232, g.ang + 9);
      s += '<text x="' + lab2[0] + '" y="' + (lab2[1] + 5) + '" text-anchor="middle" font-size="15" fill="' + c + '" font-family="Georgia,serif" font-weight="700" letter-spacing="2">' + d.nome.toUpperCase() + '</text>';
    });
    // pontos (clicáveis)
    Object.keys(A).forEach(function (id) {
      var no = A[id], xy = pos[id], c = cor(id), on = tem(id), pd = pend.indexOf(id) >= 0, livre = podeId(id), off = travada(id);
      var cls = 'asc-no' + (on ? ' on' : '') + (livre ? ' livre' : '') + (sel === id ? ' sel' : '') + (caminho.indexOf(id) >= 0 && sel !== id ? ' caminho' : '');
      var g = '<g class="' + cls + '" data-acao="asc-sel" data-id="' + id + '">';
      if (no.tipo === 'pedra') {
        var nm = AS.dominios.filter(function (d) { return d.id === no.dom; })[0].trilhas[no.trilha];
        g += '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="47" fill="#0d0b09" stroke="' + (off ? '#3a3028' : c) + '" stroke-width="' + (on ? 5 : 2.5) + '"' + (on ? ' filter="url(#asc-luz)"' : ' stroke-opacity=".75"') + (pd ? ' stroke-dasharray="7 5"' : '') + '/>'
          + '<image href="assets/ascensao/medalhao-' + nm.pedra.id + '.webp" x="' + (xy[0] - 44) + '" y="' + (xy[1] - 44) + '" width="88" height="88"' + (on ? '' : off ? ' filter="url(#asc-cinza)" opacity=".35"' : ' opacity=".6"') + '/>';
        if (off) g += '<text x="' + (xy[0] + 30) + '" y="' + (xy[1] - 28) + '" text-anchor="middle" font-size="16">🔒</text>';
        var lb = G.pt(662, Math.atan2(xy[1] - C, xy[0] - C) * 180 / Math.PI);
        if (Math.abs(xy[1] - C) < 330) lb = [xy[0], xy[1] + 66];
        g += '<text x="' + lb[0] + '" y="' + lb[1] + '" text-anchor="middle" font-size="16" fill="' + (off ? '#6a5a4a' : c) + '" font-family="Georgia,serif" font-weight="700">' + nm.pedra.nome + '</text>'
          + '<text x="' + lb[0] + '" y="' + (lb[1] + 17) + '" text-anchor="middle" font-size="12" fill="#b9a98a" font-family="Georgia,serif">' + nm.nome + '</text>';
      } else if (no.tipo === 'ponte') {
        g += '<rect x="' + (xy[0] - 12) + '" y="' + (xy[1] - 12) + '" width="24" height="24" rx="4" transform="rotate(45 ' + xy[0] + ' ' + xy[1] + ')" fill="' + (on ? '#f3e3bd' : '#120f0c') + '" stroke="' + (on ? '#fff' : '#d9c7a3') + '" stroke-width="2.6"' + (pd ? ' stroke-dasharray="5 4"' : '') + (on ? ' filter="url(#asc-luz)"' : '') + '/>'
          + '<text x="' + xy[0] + '" y="' + (xy[1] + 4.5) + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + (on ? '#140f0a' : '#d9c7a3') + '">⇄</text>';
      } else {
        var r = no.tipo === 'notavel' ? 16 : 12;
        g += '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="' + r + '" fill="' + (on ? c : '#120f0c') + '" stroke="' + c + '" stroke-width="2.8"' + (on ? ' filter="url(#asc-luz)"' : ' stroke-opacity=".8"') + (pd ? ' stroke-dasharray="5 4"' : '') + '/>'
          + '<text x="' + xy[0] + '" y="' + (xy[1] + 4) + '" text-anchor="middle" font-size="' + (r > 12 ? 13 : 11) + '" font-weight="700" fill="' + (on ? '#140f0a' : c) + '" font-family="Georgia,serif">' + (no.tipo === 'notavel' ? '★' : '+') + '</text>';
      }
      g += '<circle class="asc-alvo" cx="' + xy[0] + '" cy="' + xy[1] + '" r="' + (no.tipo === 'pedra' ? 50 : 24) + '" fill="transparent"/></g>';
      s += g;
    });
    // centro: Pacto de Ascensão
    G.doms.forEach(function (g) {
      var a0 = (g.ang - 27) * Math.PI / 180, a1 = (g.ang + 27) * Math.PI / 180;
      s += '<path d="M' + (C + 110 * Math.cos(a0)) + ' ' + (C + 110 * Math.sin(a0)) + ' A110 110 0 0 1 ' + (C + 110 * Math.cos(a1)) + ' ' + (C + 110 * Math.sin(a1)) + '" stroke="' + g.d.cor + '" stroke-width="16" fill="none" filter="url(#asc-luz)"/>';
    });
    var livres = total - R.custoNosAscensao(lista);
    s += '<circle cx="' + C + '" cy="' + C + '" r="92" fill="#0d0b09" stroke="#5a4528" stroke-width="2"/>'
      + '<text x="' + C + '" y="' + (C - 18) + '" text-anchor="middle" font-size="26" fill="#f0c56a" font-family="Georgia,serif" font-weight="700">Pacto</text>'
      + '<text x="' + C + '" y="' + (C + 8) + '" text-anchor="middle" font-size="17" fill="#f0c56a" font-family="Georgia,serif" font-weight="700">de Ascensão</text>'
      + '<text x="' + C + '" y="' + (C + 38) + '" text-anchor="middle" font-size="14" fill="#b9a98a" font-family="Georgia,serif">' + (aberto ? livres + ' ponto' + (livres === 1 ? '' : 's') + ' livre' + (livres === 1 ? '' : 's') : 'level ' + AS.nivelInicio) + '</text>';
    return '<svg class="pacto-svg" viewBox="0 0 ' + G.W + ' ' + G.W + '" xmlns="http://www.w3.org/2000/svg"><defs>' + defs
      + '<radialGradient id="asc-brilho"><stop offset="0" stop-color="#3a2a14" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
      + '<filter id="asc-cinza"><feColorMatrix type="saturate" values="0"/></filter><filter id="asc-luz" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
      + '<rect width="' + G.W + '" height="' + G.W + '" fill="#0a0806"/><circle cx="' + C + '" cy="' + C + '" r="660" fill="url(#asc-brilho)"/>' + s + '</svg>';
  }
  // Detalhe do ponto tocado (nome, efeito, custo e o botão).
  function pactoDetalhe(p, lista, pend) {
    var id = estado.ascSel, A = R.arvoreAscensao(), AS = D.ASCENSAO;
    if (!id || !A[id]) return '<p class="suave pequeno pacto-dica">Toque num ponto da árvore para ver o que ele dá.</p>';
    var no = A[id], dom = no.dom && AS.dominios.filter(function (d) { return d.id === no.dom; })[0], tr = dom && no.trilha != null ? dom.trilhas[no.trilha] : null;
    var titulo, texto, extra = '';
    if (no.tipo === 'pedra') {
      titulo = tr.pedra.nome; texto = tr.pedra.txt; extra = '<div class="menos pequeno">Custo: ' + tr.pedra.custo + '</div>'
        + '<div class="suave pequeno pacto-regra">As 2 Pedras Angulares do domínio se excluem · no máximo ' + AS.maxPedras + ' Pedras</div>';
    } else if (no.tipo === 'ponte') {
      var dd = no.doms.map(function (x) { return AS.dominios.filter(function (d) { return d.id === x; })[0].nome; });
      titulo = 'Ponte ' + dd.join(' ⇄ '); texto = efAscTexto(no.ef);
      extra = '<div class="suave pequeno pacto-regra">Liga os dois domínios: dá para seguir para o outro lado sem passar pelo começo dele.</div>';
    } else {
      titulo = no.tipo === 'notavel' ? no.nome : (tr ? tr.nome : dom.nome); texto = efAscTexto(no.ef);
    }
    var tipoNome = { pequeno: 'Ponto', notavel: 'Notável', ponte: 'Ponte', pedra: 'Pedra Angular' }[no.tipo];
    var tem = lista.indexOf(id) >= 0, pd = pend.indexOf(id) >= 0, total = R.pontosAscensaoTotal(p), motivo = tem ? null : R.motivoAscensao(lista, id, total);
    // Pacto v2: ponto longe = pega o caminho mais barato até ele de uma vez (Henri, 20/11/2026)
    var cam = !tem && motivo && /ligado/.test(motivo) && p.nivel >= AS.nivelInicio ? R.caminhoAscensao(lista, id) : null;
    var camOk = cam && R.ordenarAscensao(lista.concat(cam), total);
    var custoCam = cam ? R.custoNosAscensao(cam) : 0, livres = total - R.custoNosAscensao(lista);
    var botao = pd ? '<button class="btn secundario btn-pequeno" data-acao="asc-tirar" data-id="' + id + '">Tirar</button>'
      : tem ? '<span class="mais pequeno">✔ Já é seu</span>'
      : cam && camOk ? '<button class="btn btn-pequeno" data-acao="asc-caminho" data-id="' + id + '">Pegar o caminho (' + cam.length + ' pontos · ' + custoCam + ' de custo)</button>'
      : cam && custoCam > livres ? '<span class="suave pequeno">O caminho custa ' + custoCam + ' pontos; você tem ' + livres + '.</span>'
      : motivo ? '<span class="suave pequeno">' + motivo + '</span>'
      : '<button class="btn btn-pequeno" data-acao="asc-pegar" data-id="' + id + '">Pegar (' + no.custo + ' ponto' + (no.custo > 1 ? 's' : '') + ')</button>';
    return '<div class="pacto-detalhe" style="--cor-dom:' + (dom ? dom.cor : '#e6cf9c') + '"><button class="pacto-fechar" data-acao="asc-sel-fechar" aria-label="Fechar">✕</button>'
      + (no.tipo === 'pedra' ? '<img class="pacto-medalhao" src="assets/ascensao/medalhao-' + tr.pedra.id + '.webp" alt="">' : dom ? '<img class="pacto-medalhao" src="assets/ascensao/dominio-' + dom.id + '.webp" alt="">' : '')
      + '<div class="pacto-detalhe-txt"><div class="suave pequeno">' + tipoNome + (dom ? '<span class="pacto-caminho"> · ' + dom.nome + (tr ? ' › ' + tr.nome : '') + '</span>' : '') + ' · ' + no.custo + ' ponto' + (no.custo > 1 ? 's' : '') + '</div>'
      + '<strong>' + titulo + '</strong><div>' + texto + '</div>' + extra + '</div><div class="pacto-detalhe-acao">' + botao + '</div></div>';
  }
  function pactoResumo(p) {
    var x = R.efeitosAscensao(p), ks = Object.keys(x);
    if (!ks.length) return '';
    var AS = D.ASCENSAO, A = R.arvoreAscensao();
    var pedras = R.nosAscensao(p).filter(function (id) { return A[id] && A[id].tipo === 'pedra'; }).map(function (id) {
      var tr = AS.dominios.filter(function (d) { return d.id === A[id].dom; })[0].trilhas[A[id].trilha];
      return '<li><b>' + tr.pedra.nome + ':</b> ' + tr.pedra.txt + ' <span class="menos">(' + tr.pedra.custo + ')</span></li>';
    }).join('');
    var simples = {};
    ks.forEach(function (k) { if (NOME_EF_ASC[k] || ['reflete', 'reducaoDano', 'recargaPct', 'recargaMenos', 'danoVidaAtual', 'curaHab'].indexOf(k) >= 0) simples[k] = x[k]; });
    return '<details class="pacto-resumo"' + (CELULAR ? '' : ' open') + '><summary>O que o seu Pacto dá</summary>'
      + '<p>' + (efAscTexto(simples) || '—') + '</p>' + (pedras ? '<ul>' + pedras + '</ul>' : '') + '</details>';
  }
  function pactoHtml() {
    var p = estado.personagem, AS = D.ASCENSAO, pend = pendAsc(), lista = R.nosAscensao(p).concat(pend);
    var total = R.pontosAscensaoTotal(p), livres = total - R.custoNosAscensao(lista), aberto = p.nivel >= AS.nivelInicio;
    var h = '<div class="pacto-topo"><div><h3 class="subtitulo">' + AS.nome + '</h3><p class="suave pequeno">'
      + (aberto ? 'Escolha o seu caminho: os pontos não dão para tudo.'
        : 'Abre no level ' + AS.nivelInicio + '. Do 41 ao ' + D.NIVEL_MAXIMO + ', 1 ponto por level; no ' + D.NIVEL_MAXIMO + ', mais pontos com a exp.') + '</p></div>'
      + (aberto ? '<div class="pacto-pontos"><b>' + livres + '</b> livre' + (livres === 1 ? '' : 's') + '<small>' + R.custoNosAscensao(lista) + ' de ' + total + ' usados · máx. ' + AS.limitePontos + '</small></div>' : '') + '</div>';
    if (aberto && p.nivel >= D.NIVEL_MAXIMO && total < AS.limitePontos) {
      var a = p.ascensao || {}, prec = R.expPorPontoAscensao(), ex = Math.min(prec, a.exp || 0);
      h += '<div class="pacto-exp"><span class="suave pequeno">Exp para o próximo ponto: ' + ex.toLocaleString('pt-BR') + ' / ' + prec.toLocaleString('pt-BR') + '</span>'
        + '<div class="barra"><div class="barra-preenchida" style="width:' + Math.round(ex * 100 / prec) + '%"></div></div></div>';
    }
    if (pend.length) h += '<div class="botoes pacto-confirmar"><button class="btn" data-acao="asc-confirmar">Confirmar ' + R.custoNosAscensao(pend) + ' ponto' + (R.custoNosAscensao(pend) > 1 ? 's' : '') + '</button>'
      + '<button class="btn secundario" data-acao="asc-cancelar">Cancelar</button></div>';
    h += '<div class="pacto-mapa' + (estado.ascZoom ? ' zoom' : '') + '">' + pactoSvg(p, lista, pend) + '</div>'
      + '<div class="pacto-legenda suave pequeno"><span><b>+</b> ponto · 1</span><span><b>★</b> notável · 2</span><span><b>⇄</b> ponte · ' + AS.custo.ponte + '</span><span><b>◯</b> Pedra Angular · 4</span>'
      + '<button class="btn-mini" data-acao="asc-zoom">' + (estado.ascZoom ? '− Diminuir' : '+ Aumentar') + '</button></div>'
      + '<div id="pacto-detalhe">' + pactoDetalhe(p, lista, pend) + '</div>' + pactoResumo(p);
    var precoZ = R.precoRefazerAscensao(p, C.agora());
    if (R.nosAscensao(p).length) h += '<p class="suave pequeno pacto-refazer">Quer mudar o caminho? Zere o Pacto por ' + precoZ.toLocaleString('pt-BR') + ' de ouro (os pontos voltam' + (AS.precoRefazerMais ? '; cada vez na mesma semana custa +'
      + AS.precoRefazerMais.toLocaleString('pt-BR') : '') + '). <button class="btn secundario btn-pequeno" data-acao="asc-refazer-pedir">Zerar o Pacto</button></p>';
    // Balão de confirmação no meio da tela (Henri, 20/11/2026)
    if (estado.ascRefazer) h += '<div class="zoom-fundo login-fundo"><div class="zoom-janela login-janela pacto-zerar" role="dialog" aria-label="Zerar o Pacto">'
      + '<button class="zoom-x" data-acao="asc-refazer-nao" aria-label="Fechar">✕</button><h3>Zerar o Pacto?</h3>'
      + '<p>Todos os pontos voltam para você escolher de novo.</p><p>Custa <strong class="cor-ouro">' + precoZ.toLocaleString('pt-BR') + ' de ouro</strong>'
      + ' <span class="suave">(você tem ' + (p.ouro || 0).toLocaleString('pt-BR') + ')</span>.</p>'
      + (AS.precoRefazerMais ? '<p class="suave pequeno">A próxima vez nesta semana custa ' + (precoZ + AS.precoRefazerMais).toLocaleString('pt-BR') + '. O preço volta a ' + AS.precoRefazer.toLocaleString('pt-BR') + ' na segunda-feira.</p>' : '')
      + '<div class="botoes"><button class="btn perigo" data-acao="asc-refazer">Zerar</button><button class="btn secundario" data-acao="asc-refazer-nao">Cancelar</button></div></div></div>';
    return h;
  }
  // Tutorial do Pacto: aparece uma vez, quando o herói chega no level 40 (p.pactoVisto marca que já viu).
  function pactoNovo() { var p = estado.personagem; return !!(p && p.nivel >= D.ASCENSAO.nivelInicio && !p.pactoVisto && !(p.guia && !p.guia.fim)); }
  function pactoTutorialHtml() {
    var AS = D.ASCENSAO;
    return '<div class="zoom-fundo login-fundo"><div class="zoom-janela login-janela pacto-tutorial" role="dialog" aria-label="' + AS.nome + '">'
      + '<button class="zoom-x" data-acao="pacto-tutorial-fechar" aria-label="Fechar">✕</button>'
      + '<div class="pacto-tut-topo"><img src="assets/ascensao/medalhao-sabedoria.webp" alt=""><div><small>Novo · level ' + AS.nivelInicio + '</small><h3>' + AS.nome + '</h3></div></div>'
      + '<p>Uma árvore de poderes só sua, em <b>Herói › Pacto</b>.</p>'
      + '<ol class="pacto-tut-passos">'
      + '<li><b>1 ponto por level</b> do 41 ao ' + D.NIVEL_MAXIMO + '. No ' + D.NIVEL_MAXIMO + ', a exp vira ponto.</li>'
      + '<li><b>Comece no centro</b> e siga as linhas para fora.</li>'
      + '<li><b>Pedra Angular</b> no fim de cada trilha: forte, mas com um custo (máx. ' + AS.maxPedras + ').</li>'
      + '<li><b>Não dá para pegar tudo:</b> escolha o seu caminho.</li>'
      + '</ol><p class="suave pequeno">Vale contra monstros e na Arena.</p>'
      + '<div class="botoes"><button class="btn" data-acao="pacto-tutorial-ir">Abrir o Pacto</button><button class="btn secundario" data-acao="pacto-tutorial-fechar">Depois</button></div>'
      + '</div></div>';
  }
  function abaAscensao() { setTimeout(prepararMapaPacto, 0); return '<section class="caixa pacto" id="pacto">' + pactoHtml() + '</section>'; }
  // O mapa rola (celular ou aumentado): abre no centro e depois volta para onde o jogador estava.
  function prepararMapaPacto() {
    var m = document.querySelector('#pacto .pacto-mapa');
    if (!m) return;
    var r = estado.ascRolagem;
    if (r && r.zoom === !!estado.ascZoom) { m.scrollLeft = r.x; m.scrollTop = r.y; }
    else { m.scrollLeft = (m.scrollWidth - m.clientWidth) / 2; m.scrollTop = (m.scrollHeight - m.clientHeight) / 2; }
    m.onscroll = function () { estado.ascRolagem = { x: m.scrollLeft, y: m.scrollTop, zoom: !!estado.ascZoom }; };
    // Arrastar com o mouse para andar pelo mapa (Henri, 20/11/2026); com o dedo, a rolagem do próprio navegador.
    // Um arrasto de mais de 5px não conta como toque no ponto.
    var arr = null;
    m.onpointerdown = function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      arr = { x: e.clientX, y: e.clientY, sl: m.scrollLeft, st: m.scrollTop, mexeu: false };
    };
    m.onpointermove = function (e) {
      if (!arr) return;
      var dx = e.clientX - arr.x, dy = e.clientY - arr.y;
      if (!arr.mexeu && Math.abs(dx) + Math.abs(dy) > 5) { arr.mexeu = true; m.classList.add('arrastando'); try { m.setPointerCapture(e.pointerId); } catch (x) { /* ignora */ } }
      if (arr.mexeu) { m.scrollLeft = arr.sl - dx; m.scrollTop = arr.st - dy; }
    };
    m.onpointerup = m.onpointercancel = function () {
      if (arr && arr.mexeu) { m.classList.remove('arrastando'); m.dataset.arrastou = '1'; setTimeout(function () { delete m.dataset.arrastou; }, 0); }
      arr = null;
    };
    m.addEventListener('click', function (e) { if (m.dataset.arrastou) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  // Redesenha só o Pacto, guardando a rolagem do mapa.
  function redesenharPacto() {
    var caixa = document.getElementById('pacto');
    if (!caixa) { telaJogo(); return; }
    caixa.innerHTML = pactoHtml();
    prepararMapaPacto();
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
        + 'As passivas ficam sempre ligadas (com 1 ponto de graça) e também recebem pontos. Você ganha +' + T.pontosPorNivel + ' ponto a cada level' + (T.pontosDepois ? ' (+' + T.pontosDepois.porNivel + ' a partir do level ' + (T.pontosDepois.nivel + 1) + ')' : '') + (T.pontosAteNivel ? ', até o level ' + T.pontosAteNivel + '. Depois disso, os pontos vêm do Pacto de Ascensão' : '') + '.</p>' + (CELULAR ? '</details>' : '')
        + '<div class="grade-hab">' + c.habilidades.map(function (x) { return cartaHabilidade(x, R.pontosDistribuidos(p, x.id), pd[x.id] || 0, true, R.pontosDaArma(p)[x.id] || 0); }).join('') + '</div>'
        + (totalPendHab() ? '<div class="botoes"><button class="btn" data-acao="hab-confirmar">Confirmar pontos</button><button class="btn secundario" data-acao="hab-cancelar">Cancelar</button></div>' : '');
      var ativas = c.habilidades.filter(function (x) { return x.tipo !== 'passiva'; });
      h += '<h3 class="subtitulo">Ordem de uso</h3>' + (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '') + '<p class="suave pequeno">Na luta, a cada vez do herói, ele usa a primeira habilidade pronta desta lista. '
        + 'Se nenhuma estiver pronta, ataca normalmente. <b>Arena · Defesa</b> é a ordem usada quando outro jogador desafia você.</p><p class="suave pequeno">Na Arena não existe crítico: os bônus de crítico viram dano, '
        + 'a Sombra (só com 18, 19 ou 20 no dado) desvia do próximo golpe e faz o seguinte valer o 20 do dado. Fora isso, esquiva e precisão não contam: só o 1 do dado erra.</p>' + (CELULAR ? '</details>' : '') + '<div class="ordem-hab">'
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
  var SECOES_LOJA = [['reino', '⚔ Loja do Reino'], ['pocoes', '🧪 Poções'], ['especiais', '📜 Especiais']];   // skins: Loja de Éter (19/11/2026)
  function abaMercado() {
    var p = estado.personagem;
    if (CELULAR) {
      var sec = estado.lojaSecao && estado.lojaSecao !== 'jogadores' ? estado.lojaSecao : 'reino', partes = mercadoPartes(p);
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
      + R.mochila(p).length + '/' + D.MOCHILA_MAX + '.</p>' + x.reino + x.pocoes + x.especiais + x.troca;
  }

  // ---------------- Mercado Negro (Mercado > Mercado Negro): comércio entre jogadores ----------------
  // Faixa de nível igual à do Leilão (Henri, 13/11/2026): cada herói só vê e compra itens até o nível máximo da faixa dele.
  function nivelMaxMercadoNegro(nivel) {
    var L = D.LEILAO, f = R.faixaLeilao(nivel), ult = L.faixas[L.faixas.length - 1];
    if (!f) return L.nivelMin + 2;           // antes do level do Leilão: itens até o nível 12
    if (f === ult && nivel >= (L.mercadoSemLimite || 0)) return null;   // level 40+: sem limite
    return f.itemNivel[1];   // até o item mais alto do leilão da faixa (10–20: 22; 21–39: 40)
  }
  function abaMercadoNegro() {
    var p = estado.personagem, lim = nivelMaxMercadoNegro(p.nivel);
    return '<p class="suave">Você tem <strong class="cor-ouro">' + p.ouro.toLocaleString('pt-BR') + ' de ouro</strong> · mochila '
      + R.mochila(p).length + '/' + D.MOCHILA_MAX + '. '
      + (lim ? 'No seu level você vê e compra itens até o <strong>nível ' + lim + '</strong> (a faixa sobe com o seu level, como no Leilão).' : 'No seu level não há limite de nível dos itens.') + '</p>'
      + '<h3 class="subtitulo">Itens dos jogadores</h3><div id="mercado-jogadores">' + mercadoJogadoresHtml() + '</div>';
  }

  // ---------------- Mercado dos jogadores (agora no Mercado Negro) ----------------
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
    var filtro = f.soClasse ? { classe: p.classe, armas: R.armasPermitidas(p), maos: R.maoPermitida(p), padrao: D.ARMA_PADRAO,
      classes: Object.keys(D.GRUPOS_ITEM.classes).filter(function (c) { return R.grupoDaClasse(c) === R.grupoDe(p); }) } : null;
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
    if (el && estado.aba === 'mercadoNegro') el.innerHTML = mercadoJogadoresHtml();
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
      + '<label class="mercado-so-classe"><input type="checkbox" data-acao="mercado-so-classe"' + (f.soClasse ? ' checked' : '') + '> Só o que o meu grupo usa</label>'
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
      await gravarAntesDoBanco(p);              // o servidor tira o item do personagem salvo
      var r = await C.mercado.anunciar(p.id, id, perg, qtd, preco);
      if (id) p.inventario = p.inventario.filter(function (i) { return i.id !== id; });
      else R.mudarConsumivel(p, ctipo, crar, -qtd);
      sincronizarFicha();
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
      await gravarAntesDoBanco(p);              // o servidor confere o ouro salvo
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
      + '<p class="suave">Junte ' + q + ' pergaminhos de uma raridade e pague o ouro para trocar por 1 da raridade seguinte.</p><div class="itens">'
      + R.RARIDADES.filter(function (k) { return R.proximaRaridade(k); }).map(function (k) {
        var para = R.proximaRaridade(k), tem = R.qtdPergaminho(p, k), falta = q - tem, preco = R.precoTrocaPergaminho(k), semOuro = (p.ouro || 0) < preco;
        return '<div class="item"><div>'
          + '<div>' + q + ' <span class="raridade-' + k + '">' + D.raridades[k].nome + '</span> + ' + preco.toLocaleString('pt-BR') + ' de ouro → 1 <span class="raridade-' + para + '">' + D.raridades[para].nome + '</span></div>'
          + '<div class="suave">Pergaminhos para item ' + ITEM_RARIDADE[k] + ': você tem ' + tem + ' · para item ' + ITEM_RARIDADE[para] + ': ' + R.qtdPergaminho(p, para) + '</div></div>'
          + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta + '</span>' : semOuro ? '<span class="suave">Falta ouro</span>' : '')
          + '<button class="btn" data-acao="trocar-pergaminho" data-raridade="' + k + '"' + (falta > 0 || semOuro ? ' disabled' : '') + '>Trocar</button></div></div>';
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
  // Lotes em que este personagem deu lance (guardado neste navegador): sobem para o topo da lista (Daniel, nov/2026).
  function lancesLeilao(p) {
    try { var x = JSON.parse(localStorage.getItem('eldrin.leilaoLances') || '{}'); return Array.isArray(x[p.id]) ? x[p.id] : []; } catch (e) { return []; }
  }
  function marcarLanceLeilao(p, id) {
    try {
      var x = JSON.parse(localStorage.getItem('eldrin.leilaoLances') || '{}'), l = Array.isArray(x[p.id]) ? x[p.id] : [];
      if (l.indexOf(String(id)) < 0) l.push(String(id));
      x[p.id] = l.slice(-40);
      localStorage.setItem('eldrin.leilaoLances', JSON.stringify(x));
    } catch (e) { /* sem armazenamento: só não ordena */ }
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
    // Ordem: te cobriram (dá para reagir) > você lidera > o resto (na ordem do leilão)
    var meus = lancesLeilao(p), peso = function (l) { return l.sou_lider ? 1 : meus.indexOf(String(l.id)) >= 0 ? 0 : 2; };
    var ordenados = r.lotes.map(function (l, i) { return { l: l, i: i }; }).sort(function (a, b) { return peso(a.l) - peso(b.l) || a.i - b.i; }).map(function (x) { return x.l; });
    var lotes = '<div class="leilao-lotes">' + ordenados.map(function (l) {
      var it = l.item, prox = l.proximo, usa = it.consumivel || R.podeUsar(p, it);
      var lance = l.lance ? '<div>Lance atual: <strong class="cor-ouro">' + ouroTxt(l.lance) + '</strong>'
          + (l.sou_lider ? ' <span class="leilao-lider">Você lidera</span>' : (meus.indexOf(String(l.id)) >= 0 ? ' <span class="leilao-coberto">Te cobriram!</span>' : '') + ' <span class="suave">· ' + esc(l.lider_nome || '?') + '</span>') + '</div>'
        : '<div class="suave">Sem lances · mínimo <strong class="cor-ouro">' + ouroTxt(l.minimo) + '</strong></div>';
      var acao = l.sou_lider ? '<div class="suave pequeno">Espere alguém cobrir para dar outro lance.</div>'
        : '<div class="leilao-acao"><input class="lance-valor" id="lance-' + l.id + '" type="number" inputmode="numeric" min="' + prox + '" step="1" value="' + prox + '"'
          + ' aria-label="Valor do lance">'
          + '<button class="btn" data-acao="leilao-lance" data-id="' + l.id + '"' + (p.ouro < prox ? ' disabled title="Ouro insuficiente"' : '') + '>Dar lance</button></div>';
      return '<div class="leilao-lote carta-' + l.raridade + (l.sou_lider ? ' liderando' : meus.indexOf(String(l.id)) >= 0 ? ' coberto' : '') + '">'
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
    var outroGrupo = l.classe && R.grupoDaClasse(l.classe) !== R.grupoDe(estado.personagem);
    var p = estado.personagem, outro = outroGrupo ? null : itemParaComparar(p, l.item);
    return '<div class="zoom-fundo leilao-zoom" data-acao="leilao-fechar"><div class="zoom-janela" role="dialog" aria-label="Lote do leilão">'
      + '<button class="zoom-x" data-acao="leilao-fechar" title="Fechar">✕</button>'
      + '<div class="zoom-cartas">' + cartaZoom(l.item, outro, 'Lote do leilão') + (outro ? cartaZoom(outro, null, 'Equipado') : '') + '</div>'
      + (outroGrupo ? '<p class="menos pequeno">Item do grupo ' + D.GRUPOS_ITEM.nomes[R.grupoDaClasse(l.classe)] + ': só esse grupo usa.</p>' : '')
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
      await gravarAntesDoBanco(p);           // o servidor confere o ouro salvo
      var r = await C.leilao.lance(p.id, Number(id), valor);
      marcarLanceLeilao(p, id);
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
  // Onde conseguir um ingrediente da Oficina (Henri, nov/2026): texto do balão que abre ao tocar/clicar num item que falta.
  // Os números vêm de D.CRAFT, então o balão acompanha qualquer mudança de chance.
  function ondeConseguir(c) {
    var C = D.CRAFT, pct = function (v) { return fmtDec(v) + '%'; }, linhas = [];
    var areaDe = function (id) { return D.areas.filter(function (a) { return a.id === id; })[0]; };
    if (c.tipo === 'material') {
      var m = C.materiais[c.id] || {};
      if (m.area) {
        var a = areaDe(m.area), dm = C.dropMaterial;
        linhas.push('<b>Drop:</b> monstros de ' + esc(a ? a.nome : m.area) + ' (' + pct(dm[0]) + ', ' + pct(dm[1]) + ' e ' + pct(dm[2]) + ' de chance)');
        linhas.push('<b>Mineração:</b> em ' + esc(a ? a.nome : m.area));
      } else if (m.chefe) {
        var ac = D.areas.filter(function (x) { return x.chefe && x.chefe.id === m.chefe; })[0];
        linhas.push('<b>Drop:</b> ' + esc(ac ? ac.chefe.nome : m.chefe) + ' ' + pct(C.dropChefe) + ' de chance' + (ac ? ' (' + esc(ac.nome) + ')' : ''));
      } else if (m.minas) {
        linhas.push('<b>Mineração:</b> em qualquer região, ' + pct(C.minas.gemaPct) + ' de chance a cada unidade minerada');
      } else if (m.boss) {
        linhas.push('<b>Boss do clã:</b> quem dá mais dano no dia ganha 1');
      }
      if (m.area || m.chefe || m.minas) linhas.push('<em>Coletor: +' + C.coletorBonus + '% de chance' + (m.chefe ? '' : ' e +' + C.coletorBonus + '% na Mineração') + '.</em>');
    } else if (c.tipo === 'cristal') {
      var Q = D.CRISTAIS_QUEBRA;
      linhas.push('<b>Forja:</b> quando um item de raridade ' + esc((D.raridades[c.id] || {}).nome || '') + ' quebra ao encantar, ele vira cristais da mesma raridade');
      linhas.push('<em>' + Object.keys(Q).map(function (k) { return '+' + k + ' = ' + Q[k]; }).join(' · ') + ' cristais</em>');
    } else if (c.tipo === 'receita') {
      var ar = areaDe(c.id), mr = ar && C.materiais[R.materialDaArea(ar.id)];
      linhas.push('<b>Coletor:</b> fabrica na Oficina' + (mr ? ' com ' + C.receita.material + ' ' + esc(mr.nome) + ' + ouro' : ''));
      linhas.push('<b>Mercado:</b> aba Craft');
    }
    return linhas.length ? '<strong>' + esc(c.nome) + '</strong><span>' + linhas.join('<br>') + '</span>' : '';
  }
  function custoChips(lista) {
    return '<div class="custo-chips">' + lista.map(function (c) {
      var ok = c.tem >= c.precisa, fmt = function (v) { return Number(v).toLocaleString('pt-BR'); };
      var txt = c.tipo === 'ouro' ? fmt(c.precisa) : fmt(Math.min(c.tem, c.precisa)) + '/' + fmt(c.precisa);
      var onde = ok ? '' : ondeConseguir(c);
      var corpo = '<i>' + iconeCusto(c) + '</i><b>' + txt + '</b><small>' + esc(c.tipo === 'ouro' ? 'ouro' : c.nome) + '</small>';
      if (onde) return '<span class="custo-chip falta dica dica-custo" tabindex="0" role="button" aria-label="' + esc(c.nome + ': onde conseguir') + '">'
        + corpo + '<span class="dica-balao" role="tooltip">' + onde + '<em>Você tem ' + fmt(c.tem) + ', precisa de ' + fmt(c.precisa) + '.</em></span></span>';
      return '<span class="custo-chip ' + (ok ? 'ok' : 'falta') + '" title="' + esc(c.nome + ': você tem ' + fmt(c.tem) + ', precisa de ' + fmt(c.precisa)) + '">' + corpo + '</span>';
    }).join('') + '</div>';
  }
  // Toque/clique abre e fecha o balão do item que falta (no celular o :hover não existe); clicar fora fecha.
  document.addEventListener('click', function (e) {
    var chip = e.target.closest && e.target.closest('.dica-custo');
    if (chip && e.target.closest('.dica-balao')) return;
    document.querySelectorAll('.dica-custo.aberta').forEach(function (el) { if (el !== chip) { el.classList.remove('aberta'); el.blur(); } });
    if (!chip) return;
    if (!chip.classList.toggle('aberta')) { chip.blur(); return; }
    chip.focus();
    // não deixar o balão sair pela borda da tela (item no canto direito, celular)
    var bal = chip.querySelector('.dica-balao'); bal.style.left = '';
    var r = bal.getBoundingClientRect(), sobra = r.right - (window.innerWidth - 8);
    if (sobra > 0) bal.style.left = -Math.min(sobra, r.left - 8) + 'px';
  });
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
    var chances = R.chancesForja(p, f.area, f.chefe, f.gemas, p.nivel), pct = function (v) { return fmtDec(Math.round(v * 10) / 10) + '%'; };
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
          + iconeArea(a) + '<span>' + esc(a.nome) + '<small>item level ' + (function (fx) { return fx[0] === fx[1] ? fx[0] : fx[0] + '–' + fx[1]; })(R.nivelForja(a.id, p.nivel)) + (temR ? ' · 📜' : '') + '</small></span></button>';
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
    if (x.tipo === 'quebrar') return 'Quebrar ' + (it ? R.nomeItem(it) + ' (Lv ' + (it.nivel || 1) + ')' : 'item');
    return x.tipo;
  }
  function textoResultado(x) {
    var r = x.resultado || {};
    if (x.estado === 'pendente') return '<span class="suave">esperando o artesão</span>';
    if (x.estado !== 'feito') return '<span class="suave">' + (x.estado === 'cancelado' ? 'cancelado (tudo devolvido)' : 'não feito a tempo (tudo devolvido)') + '</span>';
    if (x.tipo === 'encantar') return r.sucesso ? '<span class="mais">SUCESSO! foi para +' + r.alvo + '</span>'
      : r.protegido ? '<span class="suave">falhou, a Proteção segurou</span>' : r.zerou ? '<span class="menos">falhou: voltou a +0</span>' : '<span class="menos">QUEBROU (' + (r.cristais || 0) + ' cristais)</span>';
    if (x.tipo === 'forjar') return '<span class="raridade-' + r.raridade + '">' + (r.obraPrima ? '✨ obra-prima ' : '') + (D.raridades[r.raridade] || {}).nome + '</span>';
    if (x.tipo === 'quebrar') return '<span class="mais">virou ' + (r.cristais || 0) + ' cristais ' + (CRISTAIS_NOME[r.raridade] || '') + '</span>';
    if (x.tipo === 'reliquia') return r.sucesso ? '<span class="cor-ouro">✨ RELÍQUIA FORJADA! ' + esc((R.runa(r.runa) || {}).nome || '') + '</span>' : '<span class="menos">a forja falhou (materiais perdidos)</span>';
    return '<span class="mais">pronto</span>';
  }
  var CRISTAIS_NOME = { comum: 'comuns', rara: 'raros', epica: 'épicos', lendaria: 'lendários' };   // "10 cristais raros"
  var ICONE_SERVICO = { encantar: '✨', forjar: '🔨', reliquia: '💠', receita: '📜', protecao: '🛡', quebrar: '⚒' };
  // preço mostrado do serviço: o de "quebrar" é por level do item
  // Encantar pode ter preço por nível do encanto (Daniel, 19/11/2026): { 1: preço do +1, ..., 10: preço do +10 }.
  function precoEncantar(v, nivel) { return v && typeof v === 'object' ? (Number(v[String(nivel)]) || null) : (Number(v) || null); }
  function precoServicoTxt(k, v) {
    if (v && typeof v === 'object') {
      var ns = Object.keys(v).map(Number).sort(function (a, b) { return a - b; }), vs = ns.map(function (n) { return Number(v[n]); });
      if (!ns.length) return '—';
      var mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
      return (mn === mx ? ouroTxt(mn) : ouroTxt(mn) + ' a ' + ouroTxt(mx)) + ' (+' + ns[0] + (ns.length > 1 ? ' ao +' + ns[ns.length - 1] : '') + ')';
    }
    return ouroTxt(v) + (OF.servicos[k] && OF.servicos[k].porNivel ? ' por level' : '');
  }
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
      + 'A sorte é a <strong>do artesão</strong>. Se ele não fizer em ' + OF.prazoHoras + ' h, tudo volta para você. '
      + '🤝 Artesão que é seu <strong>amigo</strong> faz <strong>na hora</strong>, sem precisar aceitar. Quem não entra no jogo há ' + (OF.sumirHoras || 24) + ' h sai da lista.</p></div></div>';
    // Oficinas abertas (para o comprador), com filtro por serviço
    var lista = (st.lista || []).filter(function (x) { return x.id !== p.id; }), filtro = estado.ofFiltro || 'todos';
    var visiveis = lista.filter(function (x) { return filtro === 'todos' || x.servicos[filtro]; });
    html += '<h3 class="subtitulo">⚒ Oficinas abertas <span class="suave pequeno">(' + lista.length + ')</span></h3>'
      + '<div class="loja-filtros">' + [['todos', 'Todos']].concat(Object.keys(OF.servicos).map(function (k) { return [k, ICONE_SERVICO[k] + ' ' + OF.servicos[k].nome.replace(/^Fabricar /, '')]; })).map(function (o) {
        return '<button type="button" class="btn btn-pequeno' + (o[0] === filtro ? ' sel' : ' secundario') + '" data-acao="of-filtro" data-valor="' + o[0] + '">' + o[1] + '</button>';
      }).join('') + '</div>';
    html += visiveis.length ? '<div class="loja-lista">' + visiveis.map(function (x) { return cartaOficina(x); }).join('') + '</div>'
      : '<p class="suave">' + (lista.length ? 'Nenhuma oficina oferece esse serviço agora.' : 'Nenhuma oficina aberta agora.') + '</p>';
    // Meus pedidos (depois das oficinas abertas: pedido do Henri, 21/11/2026)
    if ((st.pedidos || []).length) {
      // Abas Esperando / Prontos e "Ver mais" (Henri, 21/11/2026): a lista inteira ficava gigante na tela.
      var pend = st.pedidos.filter(function (x) { return x.estado === 'pendente'; }).length, prontosN = st.pedidos.length - pend;
      var abaP = estado.pedidosAba || (pend ? 'pendente' : 'prontos'), verP = estado.pedidosVer || 5;
      var listaP = st.pedidos.filter(function (x) { return (x.estado === 'pendente') === (abaP === 'pendente'); });
      var maisP = abaP === 'prontos' && listaP.length > verP ? listaP.length - verP : 0;
      if (abaP === 'prontos') listaP = listaP.slice(0, verP);
      html += '<h3 class="subtitulo">🧾 Meus pedidos</h3><div class="sub-abas pedidos-abas">'
        + '<button class="sub-aba' + (abaP === 'pendente' ? ' ativa' : '') + '" data-acao="pedidos-aba" data-valor="pendente">⏳ Esperando (' + pend + ')</button>'
        + '<button class="sub-aba' + (abaP === 'prontos' ? ' ativa' : '') + '" data-acao="pedidos-aba" data-valor="prontos">✔ Prontos (' + prontosN + ')</button></div>'
        + (listaP.length ? '' : '<p class="suave">' + (abaP === 'pendente' ? 'Nenhum pedido esperando.' : 'Nenhum pedido pronto ainda.') + '</p>')
        + '<div class="loja-pedidos">' + listaP.map(function (x) {
        return '<div class="loja-pedido"><span class="loja-pedido-ico">' + (x.item ? '<span class="icone-pequeno borda-' + corItem(x.item) + '">' + F.icone(x.item) + '</span>' : ICONE_SERVICO[x.tipo] || '⚒') + '</span>'
          + '<div class="loja-pedido-texto"><strong>' + esc(textoPedido(x)) + '</strong><small class="suave">' + esc(x.artesao) + ' · ' + ICONES.ouro + ' ' + ouroTxt(x.preco) + '</small>' + seloPedido(x) + '</div>'
          + (x.estado === 'pendente' ? '<button class="btn secundario btn-pequeno" data-acao="of-cancelar" data-id="' + x.id + '">Cancelar</button>' : '') + '</div>';
      }).join('') + '</div>'
        + (maisP ? '<div class="botoes"><button class="btn secundario btn-pequeno" data-acao="pedidos-mais">Ver mais (' + maisP + ')</button></div>' : '');
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
          if (k === 'encantar') {   // um preço para cada nível (+1 ao +10)
            var pe = precos.encantar;
            return '<div class="loja-preco loja-preco-niveis"><span class="loja-preco-nome">' + ICONE_SERVICO[k] + ' ' + OF.servicos[k].nome
              + '<small class="suave">um preço para cada nível (deixe em branco o nível que não quer fazer)</small></span><div class="loja-niveis">'
              + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) {
                var val = pe && typeof pe === 'object' ? pe[String(n)] : pe;
                return '<label><b>+' + n + '</b><input type="number" min="0" step="1" inputmode="numeric" id="of-enc-' + n + '" value="' + (val || '') + '" placeholder="—"></label>';
              }).join('') + '</div></div>';
          }
          return '<label class="loja-preco' + (off ? ' off' : '') + '"><span class="loja-preco-nome">' + ICONE_SERVICO[k] + ' ' + OF.servicos[k].nome
            + (off ? '<small class="suave">' + esc(R.podeReliquia(p)) + '</small>' : '') + '</span>'
            + (OF.servicos[k].porNivel ? '<small class="suave">por level do item (um item level 30 custa 30x)</small>' : '')
            + '<span class="loja-preco-campo">' + ICONES.ouro + '<input type="number" min="0" step="1" inputmode="numeric" id="of-preco-' + k + '" value="' + (precos[k] || '') + '" placeholder="' + (OF.servicos[k].porNivel ? 'Por level' : 'Preço') + '"' + (off ? ' disabled' : '') + '></span></label>';
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
      + '<div class="loja-selos">' + (x.amigo ? '<span class="selo-forja selo-amigo">🤝 Amigo · faz na hora</span>' : '') + (x.raca === 'anao' ? '<span class="selo-forja">⛰ Forja da Montanha</span>' : '') + (x.feitos >= 100 ? '<span class="selo-forja">🏅 Mestre</span>' : '') + '</div>'
      + '</div></div>' + statsLoja(x)
      + '<div class="loja-servicos">' + Object.keys(x.servicos).map(function (k) {
        var sel = aberto && estado.contratar.tipo === k;
        return '<button type="button" class="loja-servico' + (sel ? ' sel' : '') + '" data-acao="of-contratar" data-id="' + x.id + '" data-valor="' + k + '">'
          + '<span class="loja-servico-ico">' + ICONE_SERVICO[k] + '</span><span>' + OF.servicos[k].nome + '<b>' + ICONES.ouro + ' ' + precoServicoTxt(k, x.servicos[k]) + '</b></span></button>';
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
    // Escolher o item num quadrado com os itens da mochila (Henri, 21/11/2026), no lugar da lista.
    var grade = function (lista, atual, varios) {
      var v = visaoMochila(), marcado = function (i) { return varios ? varios.indexOf(i.id) >= 0 : i.id === atual.id; };
      var cels = '<div class="mochila contratar-grade">' + R.ordenarItens(lista, v.ordem, v.crescente).map(function (i) {
        return quadroItem(i, 'celula' + (marcado(i) ? ' escolhido' : ''), ' aria-pressed="' + marcado(i) + '"').replace('data-acao="item"', 'data-acao="of-item"');
      }).join('') + '</div>';
      // Quebrar vários de uma vez (Henri, 21/11/2026): toca para marcar/desmarcar.
      if (varios) return '<div class="contratar-escolha"><div class="contratar-escolha-topo"><span class="suave pequeno">Toque nos itens para marcar (' + varios.length + ' marcado' + (varios.length === 1 ? '' : 's') + '):</span>'
        + '<button class="btn secundario btn-pequeno" data-acao="of-itens-todos">Marcar todos</button>' + (varios.length ? '<button class="btn secundario btn-pequeno" data-acao="of-itens-limpar">Limpar</button>' : '') + '</div>' + cels + '</div>';
      return '<div class="contratar-escolha"><span class="suave pequeno">Escolha o item:</span>' + cels + '<p class="contratar-escolhido"><span class="icone-pequeno borda-' + corItem(atual) + '">' + F.icone(atual) + '</span> <strong>' + esc(R.nomeItem(atual)) + '</strong>'
        + ' <span class="suave pequeno">· Lv ' + (atual.nivel || 1) + ' · ' + D.raridades[atual.raridade].nome + (atual.encanto ? ' · +' + atual.encanto : '') + '</span></p></div>';
    };
    var h = '<div class="contratar">', aviso = '', pode = true;
    if (tipo === 'encantar') {
      var itens = livres.filter(function (i) { return i.encanto < E.maximo && !i.runa; });
      if (!itens.length) return h + '<p class="suave">Nenhum item na mochila para encantar (tire do corpo e destrave antes).</p></div>';
      var it = itens.filter(function (i) { return i.id === f.item; })[0] || itens[0];
      var chance = R.chanceEncantarCom(Number(x.bonus_encanto), it), risco = R.riscoEncantar(it);
      var temProt = R.qtdConsumivel(p, 'protecao', it.raridade) > 0, prot = !!f.protecao && temProt, temPerg = R.qtdPergaminho(p, it.raridade) > 0;
      h += grade(itens, it)
        + '<label class="linha-check"><input type="checkbox" data-contratar="protecao"' + (prot ? ' checked' : '') + (temProt ? '' : ' disabled') + '> 🛡 Usar Pergaminho de Proteção '
        + '<span class="suave pequeno">(' + (temProt ? 'você tem ' + R.qtdConsumivel(p, 'protecao', it.raridade) : 'você não tem da raridade ' + D.raridades[it.raridade].nome) + ')</span></label>'
        + (temPerg ? '' : '<p class="menos pequeno">Você precisa de 1 Pergaminho ' + D.raridades[it.raridade].nome + ' para entregar.</p>');
      pode = temPerg;
      preco = precoEncantar(x.servicos.encantar, it.encanto + 1);
      if (!preco) { pode = false; h += '<p class="menos pequeno">Este Ferreiro não encanta para o +' + (it.encanto + 1) + '. Escolha outro item ou outro Ferreiro.</p>'; preco = 0; }
      aviso = 'Preço para o +' + (it.encanto + 1) + ': <strong>' + ouroTxt(preco) + '</strong>. Chance deste artesão: <strong>' + fmtDec(chance) + '%</strong> para o +' + (it.encanto + 1) + '. '
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
      var extra = D.CRAFT.forja.ouro[D.areas.indexOf(ar)], chs = R.chancesForja({ raca: x.raca }, ar.id, ch, ge, p.nivel), nf = R.nivelForja(ar.id, p.nivel), pc = function (v) { return fmtDec(Math.round(v * 10) / 10) + '%'; };
      h += '<div class="forja-opcoes"><label>Receita ' + sel('area', comReceita.map(function (a) { return [a.id, a.nome]; }), ar.id) + '</label>'
        + '<label>Classe ' + sel('classe', Object.keys(D.classes).map(function (k) { return [k, D.classes[k].nome]; }), cls) + '</label>'
        + '<label>Peça ' + sel('peca', PECAS_FORJA, tp) + '</label>'
        + '<label>+ ' + esc(D.CRAFT.materiais[mc].nome) + ' ' + sel('chefe', nums, ch) + '</label><label>+ Pedra Preciosa ' + sel('gemas', nums, ge) + '</label></div>'
        + '<h4>Você entrega</h4>' + custoChips(custo.concat([{ tipo: 'ouro', nome: 'ouro da forja', tem: p.ouro, precisa: extra }]));
      pode = !R.faltando(p, custo).length;
      preco += extra;
      aviso = 'Item level <strong>' + (nf[0] === nf[1] ? nf[0] : nf[0] + ' a ' + nf[1]) + '</strong>, com atributos bons (' + D.CRAFT.forja.qualidadeMin + '% a 100%). '
        + 'Chances: ' + ['comum', 'rara', 'epica', 'lendaria'].filter(function (r) { return chs[r] > 0; }).map(function (r) { return D.raridades[r].nome + ' ' + pc(chs[r]); }).join(' · ')
        + ' · obra-prima ' + pc(chs.obraPrima) + '.';
    } else if (tipo === 'receita') {
      // Quantidade (Henri, 22/11/2026): +1 vai somando; trocar a região volta para 1. Vira um pedido para cada receita.
      var qr = Math.max(1, Math.floor(Number(f.qtd) || 1));
      var ar2 = D.areas.filter(function (a) { return a.id === f.area; })[0] || D.areas[0];
      var cr = R.custoReceita(p, ar2.id).map(function (c) { return Object.assign({}, c, { precisa: c.precisa * qr }); }), mat = cr.filter(function (c) { return c.tipo !== 'ouro'; });
      h += '<label>Região ' + sel('area', D.areas.map(function (a) { return [a.id, a.nome]; }), ar2.id) + '</label>'
        + '<div class="contratar-qtd"><span>Quantidade: <strong>' + qr + '</strong></span><button class="btn secundario btn-pequeno" data-acao="of-qtd-mais">+1</button></div>'
        + '<h4>Você entrega</h4>' + custoChips(cr);
      pode = !R.faltando(p, mat).length; preco = (preco + cr[1].precisa / qr) * qr;
    } else if (tipo === 'protecao') {
      var rr = D.CRAFT.protecao[f.raridade] ? f.raridade : 'comum', cp = R.custoProtecao(p, rr);
      h += '<label>Raridade ' + sel('raridade', Object.keys(D.CRAFT.protecao).map(function (k) { return [k, D.raridades[k].nome]; }), rr) + '</label><h4>Você entrega</h4>' + custoChips(cp);
      pode = !R.faltando(p, cp).length;
    } else if (tipo === 'quebrar') {
      var qb = livres.filter(function (i) { return !i.runa && D.CRAFT.protecao[i.raridade]; });
      if (!qb.length) return h + '<p class="suave">Nenhum item na mochila para quebrar (tire do corpo e destrave antes).</p></div>';
      if (!f.itens) f.itens = f.item ? [f.item] : [];   // começa sem nada marcado
      f.itens = f.itens.filter(function (id) { return qb.some(function (i) { return i.id === id; }); });
      var marcados = qb.filter(function (i) { return f.itens.indexOf(i.id) >= 0; }), soma = {};
      marcados.forEach(function (i) { soma[i.raridade] = (soma[i.raridade] || 0) + R.cristaisQuebrar(i); });
      h += grade(qb, null, f.itens)
        + '<h4>Você recebe</h4>' + (marcados.length ? '<p class="quebrar-recebe">' + Object.keys(CRISTAIS_NOME).filter(function (r) { return soma[r]; }).map(function (r) {
          return '<span class="icone-pequeno borda-' + r + '">' + iconeCusto({ tipo: 'cristal', id: r }) + '</span> <strong>' + soma[r] + ' cristais ' + CRISTAIS_NOME[r] + '</strong>';
        }).join(' · ') + '</p>' : '<p class="suave">Marque pelo menos 1 item.</p>');
      preco = marcados.reduce(function (t, i) { return t + R.precoServico('quebrar', x.servicos[tipo], i); }, 0);
      pode = marcados.length > 0;
      aviso = (marcados.length > 1 ? 'Os <strong>' + marcados.length + ' itens somem</strong>' : 'O item <strong>some</strong>') + ' e viram cristais (quanto maior o level, mais cristais). '
        + 'Preço: ' + ouroTxt(x.servicos[tipo]) + ' x o level de cada item.';
    } else if (tipo === 'reliquia') {
      var Q = D.CRAFT.reliquia, lend = livres.filter(function (i) { return i.raridade === 'lendaria' && i.encanto >= Q.encantoMin && !i.runa; });
      if (!lend.length) return h + '<p class="suave">Você precisa de um item lendário +' + Q.encantoMin + ' ou mais na mochila (fora do corpo e destravado).</p></div>';
      var il = lend.filter(function (i) { return i.id === f.item; })[0] || lend[0];
      var cm = Object.keys(Q.materiais).map(function (k) { return { tipo: 'material', id: k, nome: D.CRAFT.materiais[k].nome, tem: R.qtdMaterial(p, k), precisa: Q.materiais[k] }; });
      var chR = Math.min(Q.maxima, Q.base + Number(x.sorte) * Q.porSorte);
      h += grade(lend, il)
        + '<label>Nome da relíquia <input type="text" maxlength="24" data-contratar="nome" value="' + esc(f.nome || '') + '" placeholder="Ex.: Fúria de Thorin"></label>'
        + '<h4>Você entrega</h4>' + custoChips(cm)
        + (x.reliquia_semana ? '<p class="menos pequeno">Este Ferreiro já forjou a relíquia da semana.</p>' : '');
      pode = !R.faltando(p, cm).length && !x.reliquia_semana;
      aviso = 'Chance deste anão: <strong>' + fmtDec(Math.round(chR * 10) / 10) + '%</strong>. Se der certo, o item vira uma relíquia ÚNICA com o nome escolhido e uma runa sorteada '
        + '(' + Q.runas.map(function (r) { return r.texto; }).join(', ') + ' no +' + Q.encantoMin + '; o seu item +' + il.encanto + ' deixa a runa com <strong>'
        + Math.round(R.forcaRuna(il) * 100) + '%</strong> da força; só contra monstros). Depois disso o item <strong>não pode mais ser encantado</strong>. Se falhar, os materiais se perdem e o item volta igual.';
    }
    h += (aviso ? '<p class="aviso-contratar">' + aviso + '</p>' : '')
      + (x.amigo ? '<p class="mais pequeno">🤝 ' + esc(x.nome) + ' é seu amigo: o serviço é feito <strong>na hora</strong>.</p>' : '')
      + '<div class="botoes"><button class="btn" data-acao="of-pedir"' + (pode && p.ouro >= preco ? '' : ' disabled') + '>' + (tipo === 'quebrar' ? 'Quebrar' + (f.itens && f.itens.length > 1 ? ' ' + f.itens.length + ' itens' : '') : tipo === 'encantar' || tipo === 'reliquia' ? 'Confio! Contratar' : 'Contratar' + (tipo === 'receita' && Number(f.qtd) > 1 ? ' ' + Number(f.qtd) + ' receitas' : ''))
      + ' · ' + ouroTxt(preco) + '</button><button class="btn secundario" data-acao="of-contratar-fechar">Fechar</button></div></div>';
    return h;
  }
  async function quebrarVarios(x, itens) {
    var p = estado.personagem, feitos = 0, erro = null, soma = {}, naHora = false;
    estado.oficinaOcupado = true;
    avisar('⚒ Mandando ' + itens.length + ' itens para ' + x.nome + '…');
    try {
      await gravarAntesDoBanco(p);
      for (var k = 0; k < itens.length; k++) {
        try {
          var r = await C.oficina.pedir(p.id, x.id, 'quebrar', itens[k].id, {});
          if (r.item_id) p.inventario = p.inventario.filter(function (i) { return i.id !== r.item_id; });
          feitos++; naHora = naHora || !!r.feito; soma[itens[k].raridade] = (soma[itens[k].raridade] || 0) + R.cristaisQuebrar(itens[k]);
        } catch (e) { erro = e.message; break; }
      }
    } catch (e) { erro = e.message; }
    sincronizarFicha();
    estado.contratar = null;
    if (feitos) avisar((naHora ? '🤝 ' + x.nome + ' quebrou na hora ' : 'Pedido enviado: ' + x.nome + ' vai quebrar ') + feitos + ' ite' + (feitos === 1 ? 'm' : 'ns') + ' → '
      + Object.keys(soma).map(function (r) { return soma[r] + ' cristais ' + CRISTAIS_NOME[r]; }).join(', ') + (naHora ? '. Chega já já na mochila.' : '. Veja em "Meus pedidos".'), 'item');
    if (erro) avisar((feitos ? 'Parou no ' + (feitos + 1) + 'º item: ' : '') + erro);
    carregarArena(); carregarOficinas();
    estado.oficinaOcupado = false;
  }
  // Várias receitas iguais (Henri, 22/11/2026): um pedido para cada, um depois do outro; o servidor confere cada um.
  async function pedirVarias(x, tipo, op, n) {
    var p = estado.personagem, feitos = 0, erro = null, naHora = false;
    estado.oficinaOcupado = true;
    avisar('⚒ Mandando ' + n + ' pedidos para ' + x.nome + '…');
    try {
      await gravarAntesDoBanco(p);
      for (var k = 0; k < n; k++) {
        try { var r = await C.oficina.pedir(p.id, x.id, tipo, null, op); feitos++; naHora = naHora || !!r.feito; }
        catch (e) { erro = e.message; break; }
      }
    } catch (e) { erro = e.message; }
    sincronizarFicha();
    estado.contratar = null;
    if (feitos) avisar((naHora ? '🤝 ' + x.nome + ' fez na hora ' : 'Pedido enviado: ' + x.nome + ' vai fazer ') + feitos + ' receita' + (feitos === 1 ? '' : 's')
      + (naHora ? '. Chegam já já na mochila.' : '. Veja em "Meus pedidos".'), 'item');
    if (erro) avisar((feitos ? 'Parou na ' + (feitos + 1) + 'ª receita: ' : '') + erro);
    carregarArena(); carregarOficinas();
    estado.oficinaOcupado = false;
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
    if (tipo === 'receita') {
      op.area = f.area || D.areas[0].id;
      if (Number(f.qtd) > 1) return pedirVarias(x, tipo, op, Math.floor(Number(f.qtd)));
    }
    if (tipo === 'quebrar') {   // vários de uma vez (Henri, 21/11/2026): um pedido para cada item marcado
      var iqs = livres.filter(function (i) { return !i.runa && D.CRAFT.protecao[i.raridade] && (f.itens || []).indexOf(i.id) >= 0; });
      if (!iqs.length) return avisar('Marque pelo menos 1 item.');
      if (iqs.length > 1) return quebrarVarios(x, iqs);
      itemId = iqs[0].id;
    }
    if (tipo === 'protecao') op.raridade = D.CRAFT.protecao[f.raridade] ? f.raridade : 'comum';
    if (tipo === 'reliquia') { var Q = D.CRAFT.reliquia, lend = livres.filter(function (i) { return i.raridade === 'lendaria' && i.encanto >= Q.encantoMin && !i.runa; });
      itemId = (lend.filter(function (i) { return i.id === f.item; })[0] || lend[0]).id; op.nome = (f.nome || '').trim(); }
    estado.oficinaOcupado = true;
    try {
      await gravarAntesDoBanco(p);                // o servidor tira do personagem salvo
      var r = await C.oficina.pedir(p.id, x.id, tipo, itemId, op);
      if (r.item_id) p.inventario = p.inventario.filter(function (i) { return i.id !== r.item_id; });
      (r.insumos || []).forEach(function (i) { R.mudarConsumivel(p, i.tipo, i.raridade, -i.qtd); });
      sincronizarFicha();
      estado.contratar = null;
      if (r.feito) avisar('🤝 ' + x.nome + ' fez na hora: ' + resultadoCurto(tipo, r.resultado || {}) + ' Chega já já na mochila.', (r.resultado || {}).sucesso === false ? '' : 'item');
      else avisar('Pedido enviado para ' + x.nome + '! Você vê o resultado em "Meus pedidos".', 'item');
      carregarArena();   // ouro gasto (créditos)
      carregarOficinas();
    } catch (e) { avisar(e.message); }
    estado.oficinaOcupado = false;
  }
  // Resultado em uma frase (pedido feito na hora por um amigo).
  function resultadoCurto(tipo, r) {
    if (tipo === 'quebrar') return 'virou ' + r.cristais + ' cristais ' + (CRISTAIS_NOME[r.raridade] || '') + '.';
    if (tipo === 'encantar') return r.sucesso ? 'SUCESSO! foi para +' + r.alvo + '.' : r.protegido ? 'falhou, a Proteção segurou.' : r.zerou ? 'falhou, voltou a +0.' : 'QUEBROU (' + (r.cristais || 0) + ' cristais).';
    if (tipo === 'forjar') return (r.obraPrima ? 'obra-prima ' : '') + ((D.raridades[r.raridade] || {}).nome || '') + '!';
    if (tipo === 'reliquia') return r.sucesso ? 'RELÍQUIA FORJADA!' : 'a forja falhou.';
    return 'pronto!';
  }
  function cliqueOficinas(acao, el) {
    var p = estado.personagem;
    switch (acao) {
      case 'of-salvar': {
        var sv = {};
        servicosDe(p).forEach(function (k) {
          if (k === 'encantar') {
            var en = {};
            for (var n = 1; n <= 10; n++) { var ce = document.getElementById('of-enc-' + n), ve = ce && Math.floor(Number(ce.value)); if (ve > 0) en[n] = ve; }
            if (Object.keys(en).length) sv.encantar = en;
            return;
          }
          var c = document.getElementById('of-preco-' + k), v = c && Math.floor(Number(c.value)); if (v > 0) sv[k] = v;
        });
        configurarOficina(sv);
        return true;
      }
      case 'of-fechar': configurarOficina({}); return true;
      case 'of-contratar': estado.contratar = { artesao: el.dataset.id, tipo: el.dataset.valor }; telaJogo(); return true;
      case 'of-contratar-fechar': estado.contratar = null; telaJogo(); return true;
      case 'of-item':
        if (estado.contratar && estado.contratar.tipo === 'quebrar') {   // quebrar: marca/desmarca vários
          var fi = estado.contratar.itens || (estado.contratar.itens = []), ki = fi.indexOf(el.dataset.id);
          if (ki >= 0) fi.splice(ki, 1); else fi.push(el.dataset.id);
          telaJogo();
        } else if (estado.contratar) { estado.contratar.item = el.dataset.id; telaJogo(); }
        return true;
      case 'of-qtd-mais': {
        // Até o limite de pedidos esperando (CRAFT.oficina.maxPedidos), menos os que já esperam; amigo faz na hora: sem limite.
        var fq = estado.contratar, so = estado.oficinas || {}, xo = fq && (so.lista || []).filter(function (o) { return o.id === fq.artesao; })[0];
        if (!fq) break;
        var esperando = (so.pedidos || []).filter(function (x) { return x.estado === 'pendente'; }).length;
        var limQ = xo && xo.amigo ? 99 : Math.max(1, D.CRAFT.oficina.maxPedidos - esperando);
        if ((Number(fq.qtd) || 1) >= limQ) { avisar('Dá para ter no máximo ' + D.CRAFT.oficina.maxPedidos + ' pedidos esperando ao mesmo tempo.'); break; }
        fq.qtd = (Number(fq.qtd) || 1) + 1; telaJogo();
        break;
      }
      case 'of-itens-todos':
        if (estado.contratar) estado.contratar.itens = R.mochila(p).filter(function (i) { return !i.travado && !i.runa && D.CRAFT.protecao[i.raridade]; }).map(function (i) { return i.id; });
        telaJogo(); return true;
      case 'of-itens-limpar': if (estado.contratar) estado.contratar.itens = []; telaJogo(); return true;
      case 'of-filtro': estado.ofFiltro = el.dataset.valor; estado.contratar = null; telaJogo(); return true;
      case 'of-pedir': pedirOficina(); return true;
      case 'of-cancelar':
        C.oficina.cancelar(p.id, Number(el.dataset.id)).then(function () { avisar('Pedido cancelado: tudo volta para você.'); carregarArena(); carregarOficinas(); }, function (e) { avisar(e.message); });
        return true;
      case 'of-fazer':
        el.disabled = true;
        C.oficina.fazer(p.id, Number(el.dataset.id)).then(function (r) {
          var t = r.cristais && r.sucesso ? 'Quebrado: ' + r.cristais + ' cristais.' : r.sucesso === true ? 'SUCESSO!' : r.raridade ? 'Forjado: ' + D.raridades[r.raridade].nome + (r.obraPrima ? ' (obra-prima!)' : '') : r.sucesso === false ? 'Falhou…' : 'Pronto!';
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
      // Enquanto o dedo/mouse está apertado no painel, não redesenha (senão o botão some no meio do clique).
      missoesUI.el.addEventListener('pointerdown', function () { missoesUI.apertado = true; });
      document.addEventListener('pointerup', function () {
        if (!missoesUI.apertado) return;
        missoesUI.apertado = false;
        if (missoesUI.pendente) setTimeout(function () { missoesUI.pendente = false; desenharMissoes(); }, 0);
      });
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
    if (!missoesUI.aberto) { missoesUI.el.className = ''; missoesUI.el.innerHTML = aba; missoesUI.html = null; return; }
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
    var html = aba + '<div class="missoes-painel" role="dialog" aria-label="Missões"><div class="missoes-titulo"><span>📜 Missões</span>'
      + '<button data-missao="painel" title="Fechar">✕</button></div>' + cartaoLogin
      + secao('diarias', 'Diárias', 'renova em ' + tempoTexto(R.msAteReset(agora)), M.diarias, bau)
      + secao('semanais', 'Semanais', 'renova em ' + (dias ? dias + 'd ' : '') + tempoTexto(R.msAteSemana(agora) % 86400000), M.semanais) + '</div>';
    // Painel aberto durante a caçada (Daniel, nov/2026): a tela redesenha a cada luta; só refaz o painel quando algo
    // mudou, guarda a rolagem e espera o clique terminar.
    if (missoesUI.el.className === 'aberto' && missoesUI.html === html) return;
    if (missoesUI.apertado) { missoesUI.pendente = true; return; }
    var antigo = missoesUI.el.className === 'aberto' && missoesUI.el.querySelector('.missoes-painel');
    missoesUI.html = html;
    if (antigo) {
      // Já aberto: troca só o que está DENTRO da caixa (recriar a caixa repetia a animação de abrir: "fecha e abre").
      var molde = document.createElement('div'); molde.innerHTML = html;
      var rolagem = antigo.scrollTop, abaVelha = missoesUI.el.querySelector('.missoes-aba'), abaNova = molde.querySelector('.missoes-aba');
      if (abaVelha && abaNova && abaVelha.outerHTML !== abaNova.outerHTML) abaVelha.replaceWith(abaNova);
      antigo.innerHTML = molde.querySelector('.missoes-painel').innerHTML;
      antigo.scrollTop = rolagem;
      return;
    }
    missoesUI.el.className = 'aberto';
    missoesUI.el.innerHTML = html;
  }
  function cliqueMissoes(e) {
    var el = e.target.closest('[data-missao]'), p = estado.personagem;
    if (!el || !p) return;
    var acao = el.dataset.missao;
    if (acao === 'painel') { missoesUI.aberto = !missoesUI.aberto; if (missoesUI.aberto && grupoUI.aberto) { grupoUI.aberto = false; desenharGrupo(); } }
    else if (acao === 'login') { missoesUI.aberto = false; estado.loginAberto = true; estado.loginResultado = null; telaJogo(); }
    else if (acao === 'secao') missoesUI[el.dataset.tipo] = !missoesUI[el.dataset.tipo];
    else if (acao === 'resgatar' || acao === 'bau') {
      var premioLocal = null, ehBau = acao === 'bau', tipoM = el.dataset.tipo, idM = el.dataset.id;
      acaoServidor(ehBau ? 'bauDiario' : 'missao', ehBau ? null : [tipoM, idM], function () {
        premioLocal = ehBau ? R.resgatarBonusDiario(p, C.agora()) : R.resgatarMissao(p, tipoM, idM, C.agora());
      }).then(function (r) {
        var premio = r ? r.resultado : premioLocal;
        if (premio) { atualizarFicha(); desenharMissoes(); avisar((ehBau ? 'Baú do dia: ' : 'Missão concluída: ') + premio + '!', ehBau ? 'item' : 'nivel'); }
      });
    }
    desenharMissoes();
  }

  // ----- Painel do Grupo (Daniel, 18/11/2026) -----
  // Aba fixa na direita (abaixo de Missões) que abre o grupo de qualquer tela: convites, membros, pronto, sair,
  // convidar amigos e para que o grupo serve (Masmorra 3 / Torre 4). Fica fora do #app, como as Missões.
  var grupoUI = { el: null, aberto: false, sair: false };
  var OBJETIVOS_GRUPO = [
    { id: 'masmorra', nome: 'Masmorra', ico: '🏰', max: 3, aba: 'masmorra' },
    { id: 'torre', nome: 'Torre do Eclipse', ico: '🗼', max: D.TORRE.grupo, aba: 'torre' },
  ];
  function objetivoGrupo(id) { return OBJETIVOS_GRUPO.filter(function (o) { return o.id === id; })[0] || null; }
  function estaOnline(visto) { return visto && C.agora() - Date.parse(visto) < ONLINE_MS; }
  function desenharGrupo(visivel) {
    var p = estado.personagem;
    if (!grupoUI.el) {
      grupoUI.el = document.createElement('div');
      grupoUI.el.id = 'painel-grupo';
      grupoUI.el.addEventListener('click', cliqueGrupo);
      grupoUI.el.addEventListener('pointerdown', function () { grupoUI.apertado = true; });
      document.addEventListener('pointerup', function () {
        if (!grupoUI.apertado) return;
        grupoUI.apertado = false;
        if (grupoUI.pendente) setTimeout(function () { grupoUI.pendente = false; desenharGrupo(); }, 0);
      });
      document.body.appendChild(grupoUI.el);
    }
    if (visivel === false || !p) { grupoUI.el.hidden = true; return; }
    grupoUI.el.hidden = false;
    var g = estado.gm, gr = g && g.grupo, nConv = g && g.convites ? g.convites.length : 0;
    var seloG = document.getElementById('casca-grupo-selo');
    if (seloG) { seloG.hidden = !nConv; seloG.textContent = nConv || ''; }
    var aba = '<button class="missoes-aba grupo-aba" data-grupo="painel" aria-expanded="' + grupoUI.aberto + '" title="Grupo">'
      + '<span class="missoes-aba-ico">👥</span><span class="missoes-aba-txt">Grupo' + (gr ? ' ' + gr.membros.length : '') + '</span>'
      + (nConv ? '<span class="selo-pedidos">' + nConv + '</span>' : '') + '</button>';
    if (!grupoUI.aberto) { grupoUI.el.className = ''; grupoUI.el.innerHTML = aba; grupoUI.html = null; return; }
    if (!g && !estado.gmCarregando) carregarGrupo();
    var social = socialAtual();
    if (!social && !estado.socialCarregando) carregarSocial();
    var h = '';
    if (nConv) h += '<section class="grupo-bloco"><h4>📨 Convites</h4>' + g.convites.map(function (c) {
      return '<div class="grupo-convite"><span><b>' + esc(c.de) + '</b> chamou você <span class="suave pequeno">(' + c.membros + ' no grupo)</span></span>'
        + '<span><button class="btn btn-pequeno" data-grupo="aceitar" data-convite="' + c.id + '">Entrar</button>'
        + '<button class="btn btn-pequeno secundario" data-grupo="recusar" data-convite="' + c.id + '">✕</button></span></div>';
    }).join('') + '</section>';
    var souLider = gr && gr.lider === p.id, obj = gr && objetivoGrupo(gr.objetivo), max = obj ? obj.max : D.TORRE.grupo;
    if (!g) h += '<p class="suave">Carregando…</p>';
    else if (g.local) h += '<p class="suave">Grupos precisam do servidor: jogue pelo site do ' + D.NOME_JOGO + '.</p>';
    else if (!gr) h += '<section class="grupo-bloco"><p class="suave">Você está sem grupo. Convide um amigo aqui embaixo: quem convida vira o líder 👑 e escolhe para que o grupo serve.</p></section>';
    else {
      // para que serve
      h += '<section class="grupo-bloco"><h4>🎯 Para que é o grupo?</h4><div class="grupo-objetivos">' + OBJETIVOS_GRUPO.map(function (o) {
        var sel = gr.objetivo === o.id, cheio = o.max < gr.membros.length;
        return '<button class="grupo-obj' + (sel ? ' sel' : '') + '" data-grupo="objetivo" data-valor="' + o.id + '"' + (!souLider || cheio ? ' disabled' : '')
          + (cheio ? ' title="O grupo tem gente demais para isso"' : '') + '><span>' + o.ico + '</span><b>' + o.nome + '</b><small>' + o.max + ' jogadores</small></button>';
      }).join('') + '<div class="grupo-obj breve"><span>✨</span><b>Mais conteúdos</b><small>em breve</small></div></div>'
        + (obj ? '<button class="btn grupo-ir" data-grupo="ir">' + obj.ico + ' Ir para a ' + obj.nome + ' ›</button>'
          : '<p class="suave pequeno">' + (souLider ? 'Escolha acima para onde o grupo vai.' : 'O líder 👑 ainda não escolheu para onde o grupo vai.') + '</p>')
        + '</section>';
      // membros
      h += '<section class="grupo-bloco"><h4>👥 Membros <span class="suave pequeno">' + gr.membros.length + '/' + max + '</span></h4>' + gr.membros.map(function (m) {
        return '<div class="grupo-membro' + (m.pronto ? ' pronto' : '') + '"><span class="grupo-rosto">' + F.personagem(m.raca, classeRetrato(m), m.sexo) + '</span>'
          + '<span class="grupo-info"><b>' + (m.id === gr.lider ? '👑 ' : '') + esc(m.nome) + (m.id === p.id ? ' <small class="suave">(você)</small>' : '') + '</b>'
          + '<small>' + nomeClasseX(m) + ' · Lv ' + m.nivel + ' · ' + (estaOnline(m.visto_em) ? '<span class="online">● online</span>' : '<span class="suave">○ offline</span>') + '</small></span>'
          + '<span class="grupo-estado">' + (m.pronto ? '<span class="online">✔ Pronto</span>' : '<span class="suave">Aguardando</span>')
          + (souLider && m.id !== p.id ? '<button class="grupo-x" data-grupo="expulsar" data-id="' + esc(m.id) + '" title="Tirar do grupo">✕</button>' : '') + '</span></div>';
      }).join('')
        + (gr.convidados && gr.convidados.length ? '<p class="suave pequeno">Convidados: ' + gr.convidados.map(esc).join(', ') + '</p>' : '');
      var eu = gr.membros.filter(function (m) { return m.id === p.id; })[0] || {};
      h += '<div class="grupo-botoes">' + (eu.pronto ? '<button class="btn secundario" data-grupo="pronto" data-valor="nao">Não estou pronto</button>'
          : '<button class="btn" data-grupo="pronto" data-valor="sim">✔ Estou pronto</button>')
        + (grupoUI.sair ? '<button class="btn perigo" data-grupo="sair-sim">Confirmar saída</button><button class="btn secundario" data-grupo="sair-nao">Cancelar</button>'
          : '<button class="btn secundario" data-grupo="sair">Sair do grupo</button>') + '</div></section>';
    }
    // convidar amigos (sem grupo: qualquer um; em grupo: o líder, se tiver vaga)
    if (g && !g.local && (!gr || (souLider && gr.membros.length < max))) {
      var noGrupo = gr ? gr.membros.map(function (m) { return m.id; }) : [], convidados = gr ? gr.convidados || [] : [];
      var amigos = social && social.lista ? social.lista.filter(function (x) { return x.situacao === 'amigo' && noGrupo.indexOf(x.id) < 0; }) : null;
      if (amigos) amigos.sort(function (a, b) { return (estaOnline(b.visto_em) ? 1 : 0) - (estaOnline(a.visto_em) ? 1 : 0) || Date.parse(b.visto_em || 0) - Date.parse(a.visto_em || 0); });
      h += '<section class="grupo-bloco"><h4>➕ Convidar amigos' + (gr ? ' <span class="suave pequeno">' + (max - gr.membros.length) + ' vaga(s)</span>' : '') + '</h4>'
        + (!amigos ? '<p class="suave">Carregando amigos…</p>' : !amigos.length ? '<p class="suave pequeno">Sem amigos para chamar. Adicione na aba Social.</p>'
          : amigos.map(function (x) {
            var ja = convidados.indexOf(x.nome) >= 0;
            return '<div class="grupo-amigo"><span><b>' + esc(x.nome) + '</b> <small class="suave">Lv ' + x.nivel + '</small> ' + (estaOnline(x.visto_em) ? '<small class="online">● online</small>' : '') + '</span>'
              + (ja ? '<small class="suave">convidado</small>' : '<button class="btn btn-pequeno" data-grupo="convidar" data-id="' + esc(x.id) + '" data-nome="' + esc(x.nome) + '">Convidar</button>') + '</div>';
          }).join('')) + '</section>';
    }
    var html = aba + '<div class="missoes-painel grupo-painel" role="dialog" aria-label="Grupo"><div class="missoes-titulo"><span>👥 Grupo</span>'
      + '<button data-grupo="painel" title="Fechar">✕</button></div>' + h + '</div>';
    if (grupoUI.el.className === 'aberto' && grupoUI.html === html) return;
    if (grupoUI.apertado) { grupoUI.pendente = true; return; }
    var antigo = grupoUI.el.className === 'aberto' && grupoUI.el.querySelector('.grupo-painel');
    grupoUI.html = html;
    if (antigo) {
      var molde = document.createElement('div'); molde.innerHTML = html;
      var rolagem = antigo.scrollTop;
      antigo.innerHTML = molde.querySelector('.grupo-painel').innerHTML;
      antigo.scrollTop = rolagem;
      return;
    }
    grupoUI.el.className = 'aberto';
    grupoUI.el.innerHTML = html;
  }
  function cliqueGrupo(e) {
    var el = e.target.closest('[data-grupo]'), p = estado.personagem;
    if (!el || !p || el.disabled) return;
    var a = el.dataset.grupo, feito = function () { desenharGrupo(); };
    if (a === 'painel') {
      grupoUI.aberto = !grupoUI.aberto; grupoUI.sair = false;
      if (grupoUI.aberto) { missoesUI.aberto = false; desenharMissoes(); carregarGrupo(); carregarSocial(); }
    }
    else if (a === 'aceitar') acaoGrupo(function () { return C.grupo.responder(p.id, Number(el.dataset.convite), true); }, 'Você entrou no grupo!');
    else if (a === 'recusar') acaoGrupo(function () { return C.grupo.responder(p.id, Number(el.dataset.convite), false); });
    else if (a === 'convidar') acaoGrupo(function () { return C.grupo.convidar(p.id, el.dataset.id); }, 'Convite enviado para ' + el.dataset.nome + '.');
    else if (a === 'expulsar') acaoGrupo(function () { return C.grupo.expulsar(p.id, el.dataset.id); });
    else if (a === 'pronto') acaoGrupo(function () { return C.grupo.pronto(p.id, el.dataset.valor === 'sim'); });
    else if (a === 'objetivo') {
      var gr = estado.gm && estado.gm.grupo, novo = gr && gr.objetivo === el.dataset.valor ? null : el.dataset.valor;
      acaoGrupo(function () { return C.grupo.objetivo(p.id, novo); });
    }
    else if (a === 'sair') grupoUI.sair = true;
    else if (a === 'sair-nao') grupoUI.sair = false;
    else if (a === 'sair-sim') { grupoUI.sair = false; acaoGrupo(function () { return C.grupo.sair(p.id); }, 'Você saiu do grupo.'); }
    else if (a === 'ir') {
      var o = objetivoGrupo(estado.gm && estado.gm.grupo && estado.gm.grupo.objetivo);
      if (o && abaVisivel(o.aba)) { grupoUI.aberto = false; estado.aba = o.aba; telaJogo(); }
      else if (o) avisar(o.id === 'torre' ? 'A Torre abre no level ' + D.TORRE.nivelMin + '.' : 'Essa área ainda não está liberada para você.');
    }
    feito();
  }

  // ----- Forja: a barra do encantamento enche; no sucesso chega a 100%, na falha para no meio e racha -----
  // Uma tentativa de encantar: sorteia, salva e abre a Forja.
  // rapido = veio do botão +1 da Forja: sem a barra, já mostra o sucesso ou a falha (Henri, 13/11/2026).
  function tentarEncantar(id, rapido) {
    var p = estado.personagem;
    var alvoEnc = p.inventario.find(function (i) { return i.id === id; });
    var antesEnc = alvoEnc && Object.assign({}, alvoEnc);
    var chanceEnc = alvoEnc && R.chanceEncantar(p, alvoEnc), riscoEnc = alvoEnc && R.riscoEncantar(alvoEnc);
    // O resultado é sorteado e gravado NO SERVIDOR antes da animação (recarregar a página no meio não muda nada).
    if (!alvoEnc || estado.encantando) return;
    estado.encantando = true;
    estado.encantoPendente = null;
    var local = null;
    acaoServidor('encantar', [id, !!estado.usarProtecao], function () {   // jeito antigo (sem a função no servidor)
      local = R.encantar(p, id, null, !!estado.usarProtecao);
      if (local) {
        R.registrarMissao(p, 'encantar', 1, C.agora());
        if (local.sucesso) R.registrarMissao(p, 'encantoSucesso', 1, C.agora());
      }
    }).then(function (r) {
      estado.encantando = false;
      var tentativa = r ? r.resultado : local;
      if (!tentativa) { telaJogo(); return; }
      if (tentativa.protegido) riscoEnc = 'protegido';
      missaoCla('encantar', 1);
      abrirForja(antesEnc, tentativa, chanceEnc, riscoEnc, rapido);
    });
  }

  function abrirForja(item, res, chance, risco, rapido) {
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
    if (rapido) {   // +1: a barra já aparece onde parou e o resultado vem na hora
      fill.style.transition = 'none';
      fill.style.width = parada + '%';
      pct.textContent = Math.floor(parada) + '%';
      terminar();
    } else {
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
    }
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
        tentarEncantar(item.id, true);
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
    function ruido(ini, dur, vol, corte, tipoFiltro) {
      var c = ac(); if (!c) return;
      var buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = buf; f.type = tipoFiltro || 'highpass'; f.frequency.value = corte || 1200; g.gain.value = vol || 0.3;
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
      // Sons de interface da Zealot (Daniel, 20/11/2026): pedra, moedas, baú e golpe.
      clique: function () { ruido(0, 0.07, 0.22, 900, 'lowpass'); nota(140, 0, 0.08, 'sine', 0.12, 80); },
      moedas: function () {
        for (var i = 0; i < 4; i++) { var t = i * 0.055 + Math.random() * 0.02, f = 2400 + Math.random() * 1400; nota(f, t, 0.16, 'sine', 0.05); nota(f * 1.5, t, 0.1, 'sine', 0.025); }
      },
      bau: function () {
        nota(180, 0, 0.35, 'sawtooth', 0.025, 260); ruido(0.05, 0.25, 0.12, 600, 'lowpass');
        nota(95, 0.32, 0.25, 'sine', 0.22, 55); ruido(0.32, 0.12, 0.18, 400, 'lowpass');
        [1047, 1319, 1568].forEach(function (f, i) { nota(f, 0.45 + i * 0.07, 0.4, 'triangle', 0.05); });
      },
      golpe: function (forte) { ruido(0, forte ? 0.16 : 0.09, forte ? 0.3 : 0.18, 700, 'lowpass'); nota(forte ? 70 : 110, 0, 0.12, 'sine', forte ? 0.25 : 0.14, 45); },
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
      return linhaRanking(Object.assign({}, x, { posicao: i + 1, id: meu ? eu.id : x.id }), (possoAtacar && x.id && x.nivel >= 5 && !meu
        ? '<button class="btn" data-acao="ranking-atacar" data-id="' + esc(x.id) + '">⚔ Atacar</button>' : '') + botaoInspecionar(x));
    }).join('') + '</div>';
    else corpo = '<table class="ranking"><thead><tr><th>#</th><th>Personagem</th><th>Classe</th><th>Level</th><th>Poder</th>' + (possoAtacar || ehAdmin() ? '<th></th>' : '') + '</tr></thead><tbody>'
      + r.lista.map(function (x, i) {
        var pos = i + 1;
        var medalha = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
        return '<tr class="' + (meus.indexOf(String(x.nome).toLowerCase()) >= 0 ? 'meu' : '') + '"><td class="pos">' + medalha + '</td>'
          + '<td>' + siglaHtml(x.sigla) + '<strong>' + esc(x.nome) + '</strong><div class="suave pequeno">' + nomeRaca(x.raca, x.sexo) + '</div></td>'
          + '<td>' + nomeClasseX(x) + '</td>'
          + '<td>' + x.nivel + (x.pacto ? '<div class="exp-pacto pequeno" title="Pontos do Pacto de Ascensão">Pacto ' + x.pacto + '</div>' : '') + '</td><td>' + Number(x.poder || 0).toLocaleString('pt-BR') + '</td>'
          + (possoAtacar || ehAdmin() ? '<td class="ranking-acoes">' + (possoAtacar && x.id && x.nivel >= 5 && meus.indexOf(String(x.nome).toLowerCase()) < 0
            ? '<button class="btn mini-opcao" data-acao="ranking-atacar" data-id="' + esc(x.id) + '" title="Luta da Arena fora da escada: gasta 1 entrada, não muda posição">⚔ Atacar</button>' : '') + botaoInspecionar(x) + '</td>' : '')
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
      if (grupoUI.aberto) desenharGrupo();
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
      + grupo('Éter (beta)', 'Dá Éter para a conta de um personagem (pelo nome). Valor negativo tira. Só funciona durante o beta.',
        '<input id="admin-eter-nome" type="text" placeholder="Nome do personagem" value="' + esc(estado.personagem.nome) + '">'
        + '<input id="admin-eter-valor" type="number" placeholder="Éter" value="100" style="max-width:6em">'
        + '<button class="btn" data-acao="admin-dar-eter">Dar Éter</button>')
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
      + grupo('Level', 'Subir dá os pontos de atributo. Descer zera a exp e devolve os pontos para distribuir de novo. Do level ' + D.ASCENSAO.nivelInicio + ' em diante: +1/−1 ponto do Pacto (tirar pode soltar os últimos nós pegos).',
        botoes('nivel', [1, 5, 10], function (v) { return '+' + v; })
        + botoes('baixar-nivel', [1, 5], function (v) { return '−' + v; }, 'menos')
        + botoes('baixar-nivel', [99], function () { return 'Voltar ao 1'; }, 'menos')
        + (estado.personagem.nivel >= D.ASCENSAO.nivelInicio ? '<span class="admin-pacto">Pacto ' + R.pontosAscensaoTotal(estado.personagem) + ':</span>'
          + botoes('pacto', [1], function () { return '+1 Pacto'; }) + botoes('pacto', [-1], function () { return '−1 Pacto'; }, 'menos') : ''))
      + grupo('Experiência', '% da exp do level atual.', botoes('exp', [10, 50], function (v) { return '+' + v + '%'; })
        + botoes('exp', [-10, -50, -100], function (v) { return v === -100 ? 'Zerar' : '−' + (-v) + '%'; }, 'menos'))
      + grupo('Atributos', 'Volta os atributos aos da raça e classe e devolve todos os pontos.', botoes('resetar-atributos', [0], function () { return 'Resetar pontos'; }, 'menos'))
      + grupo('Encanto dos equipados', 'Sobe ou desce o encanto de todos os itens equipados de uma vez (de +0 a +' + D.encantamento.maximo + ').',
        botoes('encanto', [1], function () { return '+1'; }) + botoes('encanto', [-1], function () { return '−1'; }, 'menos')
        + botoes('encanto', [99], function () { return 'Todos +' + D.encantamento.maximo; }) + botoes('encanto', [-99], function () { return 'Zerar'; }, 'menos'))
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
      return '<div class="resultado' + (m.chefe ? ' vitoria-chefe' : '') + '"><h2>' + (m.chefe ? 'CHEFE DERROTADO!' : 'Vitória!') + '</h2><p>Você derrotou ' + m.nome + ' e ganhou <strong>' + expPct(estado.personagem, r.exp) + ' de exp</strong> e <strong class="cor-ouro">' + r.ouro + ' de ouro</strong>' + (r.fatorExp < 100 ? ' <span class="suave">(reduzidos e sem drops: área abaixo do seu nível)</span>' : '') + '.</p>'
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
      return '<div class="resultado derrota"><h2>Derrota</h2><p>' + m.nome + ' foi mais forte. Você perde a estamina da luta' + (r.expPerdida ? ' e <strong class="menos">' + expPct(estado.personagem, r.expPerdida) + ' de exp</strong>' : '') + '. Cuidado com monstros difíceis demais!</p>'
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
      + (em ? '<div class="botoes">' + botaoX2('velocidade', estado.rapido)
        + '<button class="btn perigo" data-acao="fugir">Fugir</button></div>' : '');
  }

  function telaJogo() {
    if (!abaVisivel(estado.aba)) estado.aba = 'personagem';
    guardarJogo();
    if (!resetPerguntado) conferirReset();   // aviso do reset da rodada de teste (25/11/2026)
    conferirGuia();
    var grupo = grupoDaAba(estado.aba);
    if (grupo) estado.subAba[grupo.id] = estado.aba;
    var atual = history.state;
    if (atual && atual.eldrin === estado.personagem.id && atual.aba !== estado.aba) {
      history.pushState({ eldrin: estado.personagem.id, aba: estado.aba }, '');
    }
    var painel, navegacao = '', abasTopo = '';
    var zealot = interfaceAtual() === 'zealot';
    estado.subTopo = false;
    if (estado.lutaArena) {
      painel = lutaArenaHtml();
    } else if (estado.luta) {
      painel = lutaMasmorraHtml();
    } else if (estado.mas) {
      painel = masmorraCaminhosHtml();
    } else if (estado.cacada) {
      painel = cacadaHtml();
    } else if (estado.chefeAviso) {
      painel = avisoChefeHtml();
    } else if (estado.batalha || estado.resultado) {
      painel = resultadoHtml() + batalhaHtml();
    } else {
      navegacao = navHtml();
      var subAbas = subAbasHtml();
      // Zealot no PC (Daniel, 20/11/2026): as abas ficam sempre à vista no topo; as sub-abas vão para a linha dos recursos.
      if (zealot && !CELULAR) { abasTopo = navegacao.replace('class="abas-jogo"', 'class="abas-jogo abas-topo"'); estado.subTopo = !!subAbas; }
      painel = (zealot ? '' : cascataHtml() + navegacao + subAbas)
        + (({ personagem: abaPersonagem, bau: abaBau, loja: abaLoja, habilidades: abaHabilidades, ascensao: abaAscensao, oficina: abaOficina, cacar: abaCacar, mercado: abaMercado, mercadoNegro: abaMercadoNegro, oficinas: abaOficinas, leilao: abaLeilao, encantar: abaEncantar, ranking: abaRanking, social: abaSocial, trade: abaTrade, masmorra: abaMasmorra, torre: abaTorre, eventos: abaEventos, mineracao: abaMineracao, mundial: abaMundial, historia: abaHistoria, arena: abaArena, admin: abaAdmin, alianca: abaAlianca })[estado.aba] || abaCacar)();
    }
    var livre = !(estado.batalha || estado.luta || estado.lutaArena || (estado.cacada && estado.cacada.ativa));
    // Arcane e Clássica (Henri, nov/2026): caçando no servidor, "Trocar personagem" continua ao lado de Sair, como no menu do Zealot
    // (a caçada segue sozinha no servidor e volta ao entrar de novo).
    // Clássica também (Henri, 16/11/2026).
    var afkArcane = (temaAtual() === 'arcane' || temaAtual() === 'classica') && CACA_SERVIDOR && !!estado.cacada && !estado.lutaArena && !estado.luta;
    var trocar = !livre && afkArcane ? '<button class="btn secundario" data-acao="voltar-personagens">Trocar personagem</button>'
      : !livre ? '' : (ehAdmin() ? '<button class="btn-icone' + (estado.aba === 'admin' ? ' ativa' : '') + '" data-acao="aba" data-aba="admin" title="Admin" aria-label="Admin">' + ICONES.admin + '</button>' : '')
      + '<button class="btn secundario" data-acao="voltar-personagens">' + (zealot ? ICONES.trocarPersonagem : '') + 'Trocar personagem</button>'
      + '<button class="btn secundario" data-acao="menu-config">⚙ Configurações</button>';
    var menuTopo = '';
    if (zealot) {
      var menuAnterior = document.getElementById('menu-jogo');
      menuTopo = '<button class="btn menu-config-btn" data-acao="menu-config" title="Configurações" aria-label="Configurações">' + (ICONES.config || '⚙') + '</button>'
        + '<details class="menu-jogo" id="menu-jogo"' + (menuAnterior && menuAnterior.open ? ' open' : '')
        + '><summary class="btn' + (abaDoGuia() && abaDoGuia() !== estado.aba ? ' guia-alvo' : '') + '" aria-label="Menu do jogo">' + ICONES.menu + '<span class="menu-rotulo">Menu</span></summary>'
        + '<div class="menu-jogo-painel"><div class="menu-jogo-acoes">' + trocar
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
      + (estado.tradeVer && estado.aba === 'trade' ? '<div class="zoom-fundo"><div class="zoom-janela insp-janela"><button class="zoom-x insp-x" data-acao="trade-ver-fechar" aria-label="Fechar">✕</button>'
        + (function () { var eu = estado.personagem; try { return fichaItemHtml(estado.tradeVer, true); } finally { estado.personagem = eu; } })() + '</div></div>' : '')
      + (estado.inspecao && ehAdmin() && !estado.batalha && !estado.luta && !estado.lutaArena ? inspecaoHtml() : '')
      + (estado.historiaCena && estado.aba === 'historia' && !estado.batalha && !estado.luta ? historiaCenaHtml() : '')
      + (estado.loginAberto && !estado.batalha && !estado.luta && !estado.lutaArena ? loginHtml() : '')
      + (!estado.loginAberto && pactoNovo() && !estado.batalha && !estado.luta && !estado.lutaArena ? pactoTutorialHtml() : '')
      + (estado.desafio && (estado.aba === 'arena' || estado.aba === 'ranking' || (estado.aba === 'social' && estado.desafio.tipo === 'perfil')) && !estado.lutaArena ? desafioHtml() : '')
      + (estado.resumoArena && estado.aba === 'arena' && !estado.lutaArena ? resumoArenaHtml() : '');
    if (estado.lutaArena) atualizarJanelaDado();
    var reg = document.getElementById('registro');
    if (reg) reg.scrollTop = reg.scrollHeight;
    chatVisivel(true);
    desenharMissoes(true);
    desenharGrupo(true);
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
        if (ev.curou) linha('cura', '💚 ' + nomeJ + ' recupera <strong>' + ev.curou + '</strong> de vida com a luz.');
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
      var magiaM = ev.magia ? '🔮 ' + nomeM + ' usa <strong>' + esc(ev.magia) + '</strong>' : '';
      if (!ev.acerto) linha('errou', (magiaM ? magiaM + ', mas ' : nomeM + ' ataca, mas ') + nomeJ + ' se esquiva.');
      else {
        linha('dano-recebido', magiaM ? magiaM + ' e causa <strong>' + ev.dano + '</strong> de dano mágico.' : nomeM + ' ataca e causa <strong>' + ev.dano + '</strong> de dano.');
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
      if (res.resultado === 'vitoria') linha('destaque', 'Vitória! +' + expPct(estado.personagem, res.exp) + ' de exp e +' + res.ouro + ' de ouro' + (res.vitalidade ? ' (Vitalidade x2)' : '') + '.' + (res.estamina ? ' −' + res.estamina + ' de estamina.' : '')
        + (res.material ? ' ⛏ +' + res.material.qtd + ' ' + esc(D.CRAFT.materiais[res.material.id].nome) + '.' : ''));
      if (res.material && estado.cacada) estado.cacada.materiais = (estado.cacada.materiais || 0) + res.material.qtd;
      if (res.resultado === 'vitoria') { /* já escreveu acima */ } else if (res.resultado === 'derrota') linha('dano-recebido', esc(estado.personagem.nome) + ' caiu em batalha.' + (res.expPerdida ? ' −' + expPct(estado.personagem, res.expPerdida) + ' de exp.' : '') + (res.estamina ? ' −' + res.estamina + ' de estamina.' : ''));
      else linha('errou', esc(estado.personagem.nome) + ' fugiu.');
      fimLutaCacada(res, b, primeiraVez);
      return;
    }
    var nivelHab = R.nivelHabilidade(estado.personagem);
    if (D.HABILIDADES_ATIVAS && nivelHab > b.nivelHab) res.habilidadeEvoluiu = nivelHab;
    res.monstroId = b.monstroId;
    res.escolhido = estado.escolhido;
    if (res.resultado === 'vitoria') {
      linha('destaque', 'Vitória! +' + expPct(estado.personagem, res.exp) + ' de exp' + (res.fatorExp < 100 ? ' (exp e ouro reduzidos, sem drops: área abaixo do seu nível)' : '') + '.');
      if (res.niveis) linha('destaque', 'Level up! Agora você é level ' + estado.personagem.nivel + '.');
      if (res.habilidadeEvoluiu) linha('habilidade-usada', '⚡ Sua habilidade evoluiu para o nível ' + res.habilidadeEvoluiu + '!');
      if (res.drop) linha('destaque', 'Drop: ' + R.nomeItem(res.drop) + ' (' + nomeRaridadeItem(res.drop) + ')!');
      if (res.dropArmadura) linha('destaque', 'Drop: ' + R.nomeItem(res.dropArmadura) + ' (' + nomeRaridadeItem(res.dropArmadura) + ')!');
      if (res.mochilaCheia) linha('dano-recebido', 'Mochila cheia! Um item se perdeu.');
      if (res.pergaminho) linha('destaque', 'Drop: ' + (res.qtdPergaminhos > 1 ? res.qtdPergaminhos + ' Pergaminhos' : 'Pergaminho') + ' para item ' + ITEM_RARIDADE[res.pergaminho] + '!');
      if (res.material) linha('destaque', '⛏ Material: ' + res.material.qtd + ' ' + esc(D.CRAFT.materiais[res.material.id].nome) + ' (Oficina).');
    } else if (res.resultado === 'derrota') {
      linha('dano-recebido', esc(estado.personagem.nome) + ' caiu em batalha' + (res.expPerdida ? ' e perdeu ' + expPct(estado.personagem, res.expPerdida) + ' de exp' : '') + '.');
    } else {
      linha('errou', esc(estado.personagem.nome) + ' fugiu.');
    }
    estado.ultimaBatalha = b;
    estado.batalha = null;
    estado.resultado = res;
    salvar();
    telaJogo();
    if (res.resultado === 'vitoria') {
      avisar('Vitória! +' + expPct(estado.personagem, res.exp) + ' de exp', 'vitoria');
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
    var pr = p.prefsCacada || (p.prefsCacada = { lutarSempre: false, pocao: 0, chefe: 'perguntar' });
    if (pr.pocao && D.CACADA.pocaoAuto.indexOf(Number(pr.pocao)) < 0) pr.pocao = D.CACADA.pocaoAuto[0];   // opção que saiu (5%) → 10%
    return pr;
  }
  function iniciarCacada(areaId, soEstes) {
    if (bloqueadoMinerando('caçar')) return;
    var p = estado.personagem, area = D.areas.find(function (a) { return a.id === areaId; });
    var alvos = soEstes ? soEstes.slice() : area ? selecaoArea(area).slice() : [];
    if (!alvos.length) { avisar('Escolha pelo menos um monstro.'); return; }
    R.atualizarTempo(p, C.agora());   // (o servidor recalcula a estamina sozinho em cada ação)
    if (p.acampado) { R.acampar(p, C.agora(), false); acaoServidor('acampar', false); avisar('Acampamento levantado. Boa caçada!'); }   // caçar levanta o acampamento sozinho
    if (!R.estaminaParaCacar(p, alvos)) { avisar('Sem estamina: acampe, espere encher ou use um pote de estamina (Mercado).'); return; }
    pararTimersCacada();
    estado.resultado = null;
    estado.ultimaBatalha = null;
    estado.cacada = { area: areaId, alvos: alvos, pesadelo: R.ehPesadelo(alvos[0]), ativa: true, fase: 'buscando', inicio: Date.now(), mortos: 0, exp: 0, ouro: 0,
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
    R.atualizarTempo(p, C.agora());   // (o servidor recalcula a estamina sozinho em cada ação)
    if (!R.estaminaParaCacar(p, c.alvos)) { pararCacada('Sem estamina: acampe, espere encher ou use um pote de estamina (Mercado).'); return; }
    c.fase = 'buscando';
    c.encontro = null;
    c.prazo = null;
    if (CACA_SERVIDOR) { procurarNoServidor(); return; }
    // O monstro é sorteado já no começo: o mais forte demora mais para ser achado.
    c.proximo = c.pesadelo ? (R.podePesadelo(p, c.alvos[0]) && R.custoEstamina(c.alvos[0]) <= R.estamina(p).pts ? c.alvos[0] : null)
      : R.escolherMonstroCacada(p, c.alvos.filter(function (id) { return R.custoEstamina(id) <= R.estamina(p).pts; }));
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
    var id = c.proximo && (R.podeCacar(p, c.proximo) || R.podePesadelo(p, c.proximo)) ? c.proximo : R.escolherMonstroCacada(p, c.alvos);
    if (!id) { pararCacada('Nenhum dos monstros escolhidos pode ser caçado agora.'); return; }
    var areaCh = D.areas[D.monstros[id].indiceArea];   // o chefe só aparece se a estamina paga a luta contra ele
    chefe = !R.ehPesadelo(id) && areaCh && R.custoEstamina(areaCh.chefe.id) <= R.estamina(p).pts ? R.sortearChefe(p, id) : null;
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
    if (res.resultado === 'derrota') { pararCacada(esc(p.nome) + ' caiu em batalha: perdeu a estamina da luta' + (res.expPerdida ? ' e ' + expPct(p, res.expPerdida) + ' de exp' : '') + '. A caçada parou.'); return; }
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
  // ---- Ações do herói decididas pelo servidor (plano "tudo no servidor", etapa 1, Henri nov/2026) ----
  // A regra roda aqui na hora (a tela responde sem esperar) e na função `acao` do servidor, que grava; a resposta do
  // servidor substitui o personagem (se o servidor recusar, volta ao que está no banco). Sem a função publicada (404),
  // grava do jeito antigo.
  var ACAO_SERVIDOR = typeof C.acao === 'function', ACAO_RESPONDEU = false;
  // local: quando a ação é sorteada no servidor (comprar), a tela não aplica antes; `local` é o jeito antigo, usado
  // só se a função não existir. Devolve uma promessa com a resposta do servidor (null no jeito antigo ou com erro).
  function acaoServidor(nome, args, local) {
    var p = estado.personagem;
    var antigo = function () { if (local) local(); p.poder = R.poder(p); salvarFichaDireto(); return null; };
    if (!ACAO_SERVIDOR) return Promise.resolve(antigo());
    p.poder = R.poder(p);
    return C.acao(p.id, nome, args).then(function (r) {
      ACAO_RESPONDEU = true;
      if (!estado.personagem || estado.personagem.id !== p.id) return null;
      if (r && r.personagem) adotarPersonagem(r.personagem);
      if (r && r.erro) {
        avisar(r.erro);
        if (!estado.luta && !estado.batalha && !estado.lutaArena) telaJogo();
        return null;
      }
      return r;
    }, function (e) {
      if (e && e.conflito) return null;   // o jogo já recarrega o personagem
      if (e && (e.status === 404 || (!e.status && !ACAO_RESPONDEU))) { ACAO_SERVIDOR = false; return antigo(); }
      avisar('Não foi possível salvar: ' + ((e && e.message) || e));
      return null;
    });
  }
  // O que não vale nada (preferências, caixa de entrada, tempo jogado...) vai pela ação `preferencias`: o servidor só
  // aceita esses campos. Junta vários pedidos seguidos num só.
  var prefsTimer = null;
  function prefsAtuais() {
    var p = estado.personagem;
    return { prefsCacada: p.prefsCacada, caixa: (p.caixa || []).slice(0, 60), caixaVista: p.caixaVista,
      atividade: p.atividade, titulo: p.titulo || null, recomecoPresente: p.recomecoPresente,
      presenteForcaCacador: p.presenteForcaCacador, presenteDestrezaCacador: p.presenteDestrezaCacador, presenteAtributos3: p.presenteAtributos3, avisoPactoV2: p.avisoPactoV2, pactoVisto: !!p.pactoVisto };
  }
  function salvarPreferencias() {
    if (!ACAO_SERVIDOR) { salvarFichaDireto(); return; }
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(function () { if (estado.personagem) acaoServidor('preferencias', prefsAtuais()); }, 400);
  }
  // Depois de uma função do banco mexer na ficha (Mercado, leilão, Oficina): busca a ficha do servidor (e grava as
  // preferências junto). No jeito antigo, grava a ficha como antes.
  function sincronizarFicha() {
    if (!ACAO_SERVIDOR) { salvarFichaDireto(); return Promise.resolve(); }
    clearTimeout(prefsTimer);
    return acaoServidor('preferencias', prefsAtuais());
  }
  // Antes de uma função do banco ler a ficha: no jeito antigo, grava primeiro (no novo, o servidor já tem tudo).
  function gravarAntesDoBanco(p) {
    p.poder = R.poder(p);
    return ACAO_SERVIDOR ? Promise.resolve() : C.salvarPersonagem(p);
  }
  // Prêmios (recompensas) e créditos (ouro/reputação) guardados no servidor: o servidor entrega e marca.
  var avisoCheiaEm = 0;
  function receberPendentes() {
    var p = estado.personagem, g = estado.gm;
    if (!p || estado.resgatando) return Promise.resolve();
    // Masmorra/luta do grupo na tela (Henri, 21/11/2026): os prêmios só chegam depois que o chefe cai na tela e o
    // jogador fecha (masFechar / fim da luta chamam de novo). Assim nada aparece antes da hora.
    if (estado.mas || estado.luta) return Promise.resolve();
    estado.resgatando = true;
    return acaoServidor('receber').then(function (r) {
      estado.resgatando = false;
      if (g) g.recompensas = [];
      var av = r && r.resultado ? r.resultado.avisos : [];
      av.forEach(function (a) {
        if (/^Mochila cheia/.test(a.texto)) {   // não repete o aviso a cada atualização
          if (avisoCheiaEm && Date.now() - avisoCheiaEm < 60000) return;
          avisoCheiaEm = Date.now();
        }
        avisar(a.texto, a.tipo);
        if (a.origem) caixaRegistrar(a.origem, a.texto);
      });
      if (!estado.luta && !estado.batalha && !estado.resultado && !estado.chefeAviso && !estado.lutaArena) telaJogo();
    });
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
    if (window.EldrinNativo && estado.personagem) EldrinNativo.cacadaFundo(estado.personagem);   // avisa quando a estamina acabar
  }
  function retomarCacada() {
    var p = estado.personagem, velho = estado.cacada;
    if (!CACA_SERVIDOR || !p || estado.retomando) return;
    if (velho && !velho.fora) return;
    if (!velho && !p.cacadaAuto) return;
    if (window.EldrinNativo) EldrinNativo.cacadaVoltou();
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
          + ', +' + expPct(estado.personagem, s.exp || 0) + ' de exp e +' + (s.ouro || 0).toLocaleString('pt-BR') + ' de ouro'
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
  // Exp em % do level atual (Henri, 18/11/2026): o jogador vê só a porcentagem; os números ficam para o servidor.
  function expPct(p, valor) {
    if (!p || p.nivel >= D.NIVEL_MAXIMO) return Math.round(Number(valor) || 0).toLocaleString('pt-BR');
    var v = (Number(valor) || 0) * 100 / R.expNecessaria(p.nivel);
    var casas = v >= 10 ? 0 : v >= 1 ? 1 : 2;
    v = Math.max(v > 0 ? 0.01 : 0, Number(v.toFixed(casas)));
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas }) + '%';
  }
  // Barrinha fina de experiência embaixo da vida, na caçada (só para ter uma noção de quanto falta para o level).
  function expFinaHtml(p) {
    var maximo = p.nivel >= D.NIVEL_MAXIMO, precisa = R.expNecessaria(p.nivel), ep = expPacto(p);
    var pct = ep ? ep.pct : maximo ? 100 : Math.max(0, Math.min(100, p.exp / precisa * 100));
    var texto = ep ? 'Experiência: ' + Math.floor(pct) + '% ' + ep.rotulo : maximo ? 'Pacto completo (' + D.ASCENSAO.limitePontos + ')' : 'Experiência: ' + Math.floor(pct) + '%';
    var numero = ep ? '✦ ' + Math.floor(pct) + '% ' + ep.rotulo : maximo ? 'Pacto completo (' + D.ASCENSAO.limitePontos + ')' : '✦ ' + Math.floor(pct) + '%';
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
        + '<div class="suave pequeno">Vida ' + m.hp.toLocaleString('pt-BR') + ' · Dano ' + danoMonstro(m.ataque) + '</div>'
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
        + '<button class="btn secundario" data-acao="cacada-fechar">' + (c.pesadelo ? 'Voltar ao Pesadelo' : 'Voltar à região') + '</button></div>'
        + (R.estaminaParaCacar(p, c.alvos) ? '' : '<p class="suave pequeno">Sem estamina para estes monstros. Acampe, espere ou use um pote de estamina (Mercado).</p>') + '</div>';
    }
    var ativa = c.ativa;
    var topo = '<div class="cacada-topo" style="--cor:' + (c.pesadelo ? '#5b1a2e' : e.cor) + '"><div><h3>' + (c.pesadelo ? '🌑 Reino do Pesadelo' : iconeArea(area) + ' Caçada · ' + area.nome) + '</h3>'
      + '<span class="suave pequeno">' + c.alvos.map(function (id) { return D.monstros[id].nome; }).join(', ') + '</span></div>'
      + '<div class="botoes">' + (ativa ? botaoX2('velocidade', estado.rapido)
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
      if (h.resultado === 'vitoria') return '<p class="mais">✔ ' + nome + ' <span class="suave">+' + expPct(estado.personagem, h.exp) + ' exp · +' + h.ouro + ' ouro'
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
    if (aba === 'bau') { aba = 'personagem'; estado.mochilaAba = 'bau'; estado.bau = null; estado.bauErro = null; }   // o baú agora fica na Mochila
    if (estado.personagem) {
      var gAntes = estado.personagem.guia && !estado.personagem.guia.fim && !estado.personagem.guia.loja;
      R.registrarGuia(estado.personagem, 'aba', aba);
      if (gAntes && estado.personagem.guia.loja) acaoServidor('guiaAba', aba);
    }
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
    if (aba === 'mercadoNegro') carregarMercado();
    if (aba === 'trade') carregarTrade();
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

  // Trade (25/11/2026): atualiza a cada 20 s na aba (e a cada minuto fora dela, para o selo), sem apagar o que se digita.
  app.addEventListener('focusin', function (e) { if (e.target.closest && e.target.closest('.trade')) estado.tradeDigitando = true; });
  app.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('.trade')) estado.tradeDigitando = false; });
  setInterval(function () {
    if (!estado.personagem || document.hidden || !C.trade) return;
    var agoraT = Date.now();
    if (estado.aba === 'trade' || agoraT - (estado.tradeLido || 0) > 60000) { estado.tradeLido = agoraT; carregarTrade(true); }
  }, 20000);

  app.addEventListener('submit', async function (e) {
    e.preventDefault();
    var form = e.target;
    if (form.dataset.form === 'trade-pedir') {   // Trade (Henri, 25/11/2026)
      var nomeT = form.nome.value.trim(), pT = estado.personagem;
      if (!nomeT || !pT) return;
      if (nomeT.toLowerCase() === pT.nome.toLowerCase()) { avisar('Escolha outro jogador.'); return; }
      tradeChamar(function () { return C.trade.pedir(pT.id, nomeT); }, function (pp) { R.mudarConsumivel(pp, 'trade', 'unico', -1); },
        '📜 Pedido de trade enviado para ' + nomeT + '. O pergaminho fica guardado até ele responder.');
      return;
    }
    if (form.dataset.form === 'trade-ouro') {
      var oT = Math.floor(Number(form.ouro.value) || 0), idO = form.dataset.trade;
      if (oT < 1) return;
      if (oT > (estado.personagem.ouro || 0)) { avisar('Ouro insuficiente.'); return; }
      tradeChamar(function () { return C.trade.por(estado.personagem.id, idO, null, null, 1, oT); }, null, null);
      return;
    }
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
    if (e.target.id === 'al-boss-hora') estado.bossHoraEscolhida = parseInt(e.target.value, 10);
    if (e.target.id === 'mercado-ordem') { var fo = filtroMercado(); fo.ordem = e.target.value; fo.pagina = 0; carregarMercado(); }
    if (e.target.dataset && e.target.dataset.contratar && estado.contratar) {
      estado.contratar[e.target.dataset.contratar] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (e.target.dataset.contratar === 'area') estado.contratar.qtd = 1;   // trocou a receita: a quantidade volta para 1
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
    if (el.dataset.acao.indexOf('altar-') === 0 && cliqueAltar(el.dataset.acao, el)) return;
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
        fecharMenuJogo(); missoesUI.aberto = !missoesUI.aberto; if (missoesUI.aberto) grupoUI.aberto = false; desenharGrupo(true); desenharMissoes(true);
        break;
      case 'casca-grupo':
        fecharMenuJogo(); grupoUI.aberto = !grupoUI.aberto; grupoUI.sair = false;
        if (grupoUI.aberto) { missoesUI.aberto = false; desenharMissoes(true); carregarGrupo(); carregarSocial(); }
        desenharGrupo(true);
        break;
      case 'menu-config': case 'menu-interface': case 'menu-som':   // um painel só: Interface, Resolução e Som (Daniel, 20/11/2026)
        if (document.getElementById('menu-jogo')) document.getElementById('menu-jogo').open = false;
        tocarMusica();
        alternarPainel(!!musica.painel);
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
      case 'pacto-tutorial-ir': case 'pacto-tutorial-fechar':
        p.pactoVisto = true; salvarPreferencias();
        if (el.dataset.acao === 'pacto-tutorial-ir') estado.aba = 'ascensao';
        telaJogo();
        break;
      case 'login-fechar': estado.loginAberto = false; estado.loginResultado = null; telaJogo(); break;
      case 'login-pegar': {
        var loginLocal = null;
        el.disabled = true;
        acaoServidor('pegarLogin', null, function () { loginLocal = R.pegarLogin(estado.personagem, C.agora()); }).then(function (r) {
          var rl = r ? r.resultado : loginLocal;
          el.disabled = false;
          if (!rl) return;
          if (rl.erro) { avisar(rl.erro); return; }
          estado.loginResultado = rl;
          atualizarFicha(); desenharMissoes();
          rl.itens.forEach(avisarItem);
          avisar('🎁 Prêmio de login: ' + rl.partes.map(function (x) { return x.texto; }).join(' + '), 'item');
          telaJogo();
        });
        break;
      }
      case 'aba': estado.cascata = false; estado.cascataGrupo = null; abrirAba(el.dataset.aba); break;
      case 'cascata': estado.cascata = !estado.cascata; estado.cascataGrupo = null; telaJogo(); break;
      case 'cascata-grupo': estado.cascataGrupo = el.dataset.valor; telaJogo(); break;
      case 'cascata-missoes': estado.cascata = false; estado.cascataGrupo = null; missoesUI.aberto = true; telaJogo(); desenharMissoes(true); break;
      case 'bau-recarregar': estado.bau = null; estado.bauErro = null; carregarBau(); telaJogo(); break;
      case 'eter-comprar': comprarEter(el.dataset.valor); break;
      case 'loja-recarregar': estado.loja = null; estado.lojaErro = null; carregarLoja(); telaJogo(); break;
      case 'loja-pedir': estado.lojaConfirma = el.dataset.valor; telaJogo(); break;
      case 'loja-cancelar': estado.lojaConfirma = null; telaJogo(); break;
      case 'loja-comprar': {
        var itL = el.dataset.valor, nomeL = itL === 'vip' ? 'VIP ativado! 👑' : itL === 'starter' ? 'Starter Pack comprado! 🎁' : itL === 'trade' ? 'Pergaminho de Trade comprado! 📜'
          : /^boost:/.test(itL) ? D.LOJA.boosts[itL.split(':')[1]].nome + ' comprado: use quando quiser.' : 'Skin comprada e em uso no seu D20! 🎲';
        lojaChamar(C.loja.comprar(p.id, itL), nomeL);
        break;
      }
      case 'tag-boost': avisar(el.title); break;
      case 'trade-sel': if (estado.trade) { estado.trade.sel = Number(el.dataset.id); telaJogo(); } break;
      case 'trade-responder': {
        var simT = el.dataset.valor === '1', idT = el.dataset.id;
        tradeChamar(function () { return C.trade.responder(p.id, idT, simT); },
          null,
          simT ? '🤝 Negociação aberta! Coloque o que quer trocar.' : 'Pedido recusado.');
        if (simT && estado.trade) estado.trade.sel = Number(idT);
        break;
      }
      case 'trade-cancelar': {
        var idC = el.dataset.id;
        tradeChamar(function () { return C.trade.cancelar(p.id, idC); }, null, 'Negociação cancelada: o que estava na mesa volta para cada um.');
        break;
      }
      case 'trade-aceitar': {
        var idA = el.dataset.id, simA = el.dataset.valor === '1';
        tradeChamar(function () { return C.trade.aceitar(p.id, idA, simA); }, null, null).then(function () {
          var t = ((estado.trade.dados || {}).historico || []).filter(function (x) { return String(x.id) === String(idA) && x.estado === 'feito'; })[0];
          avisar(t ? '🤝 Trade feito! O que você recebeu chega na mochila.' : simA ? '✔ Você aceitou. Agora é a vez do outro jogador.' : 'Aceite desfeito.', 'item');
          if (t) receberPendentes();
        });
        break;
      }
      case 'trade-tirar': {
        var idX = el.dataset.id, kX = el.dataset.k;
        tradeChamar(function () { return C.trade.tirar(p.id, idX, kX); }, null, 'Voltou para você.');
        break;
      }
      case 'trade-por-item': {
        var idI = el.dataset.trade, itI = el.dataset.id;
        tradeChamar(function () { return C.trade.por(p.id, idI, itI, null, 1, 0); },
          function (pp) { pp.inventario = pp.inventario.filter(function (i) { return i.id !== itI; }); }, null);
        break;
      }
      case 'trade-por-cons': {
        var idK = el.dataset.trade, cK = el.dataset.cons, inp = el.parentNode.querySelector('.trade-qtd');
        var pil = cK.split(':'), mx = (R.pilhaConsumivel(p, pil[0], pil[1]) || { qtd: 0 }).qtd, nK = Math.max(1, Math.min(mx, Math.floor(Number(inp && inp.value) || 1)));
        tradeChamar(function () { return C.trade.por(p.id, idK, null, cK, nK, 0); },
          function (pp) { R.mudarConsumivel(pp, pil[0], pil[1], -nK); }, null);
        break;
      }
      case 'trade-ver': {
        var tv = ((estado.trade.dados || {}).abertos || []).filter(function (x) { return String(x.id) === el.dataset.id; })[0], ev = null;
        if (tv) ev = tv.itens_a.concat(tv.itens_b).filter(function (e) { return e.k === el.dataset.k; })[0];
        if (ev && ev.item) { estado.tradeVer = ev.item; telaJogo(); }
        break;
      }
      case 'trade-ver-fechar': estado.tradeVer = null; telaJogo(); break;
      case 'ranking-inspecionar': {
        if (!ehAdmin()) break;
        var ins = estado.inspecao = { aba: (estado.inspecao && estado.inspecao.aba) || 'itens', p: null };
        telaJogo();
        C.senha.adminInspecionar(el.dataset.id).then(function (d) {
          if (estado.inspecao !== ins) return;
          try { R.normalizar(d); } catch (e) { /* ficha antiga: mostra como veio */ }
          ins.p = d; telaJogo();
        }, function (e) { if (estado.inspecao === ins) { ins.erro = e.message; telaJogo(); } });
        break;
      }
      case 'insp-aba': if (estado.inspecao) { estado.inspecao.aba = el.dataset.valor; telaJogo(); } break;
      case 'insp-fechar': estado.inspecao = null; telaJogo(); break;
      case 'pedidos-aba': estado.pedidosAba = el.dataset.valor; estado.pedidosVer = 5; telaJogo(); break;
      case 'pedidos-mais': estado.pedidosVer = (estado.pedidosVer || 5) + 10; telaJogo(); break;   // no celular não tem "passar o mouse": o toque mostra o bônus
      case 'loja-usar-boost': {
        var bL = D.LOJA.boosts[el.dataset.valor];
        lojaChamar(C.loja.usarBoost(p.id, el.dataset.valor), bL.nome + ' ativado em ' + p.nome + ': +' + bL.pct + '% por ' + bL.minutos + ' min na caçada!');
        break;
      }
      case 'admin-dar-eter': {
        var nE = (document.getElementById('admin-eter-nome') || {}).value, vE = parseInt((document.getElementById('admin-eter-valor') || {}).value, 10);
        if (!nE || !vE) { avisar('Escreva o nome e o valor.'); break; }
        C.loja.darEter(nE, vE).then(function (r) {
          avisar((vE > 0 ? '+' : '') + vE + ' Éter para ' + r.nome + ' (saldo: ' + r.saldo + ').', 'item');
          estado.loja = null; carregarLoja();
        }, function (e) { avisar((e && e.message) || 'Não foi possível.'); });
        break;
      }
      case 'bau-guardar-ouro': case 'bau-retirar-ouro': {
        var vo = parseInt((document.getElementById('bau-ouro') || {}).value, 10);
        if (!(vo > 0)) { avisar('Digite quanto ouro.'); break; }
        if (el.dataset.acao === 'bau-guardar-ouro') {
          if (vo > estado.personagem.ouro) { avisar('Você não tem esse ouro.'); break; }
          bauDepositar({ ouro: vo }, vo.toLocaleString('pt-BR') + ' de ouro guardado no baú.');
        } else {
          if (vo > Number((estado.bau || {}).ouro || 0)) { avisar('O baú não tem esse ouro.'); break; }
          bauRetirar(vo, null, 0, vo.toLocaleString('pt-BR') + ' de ouro retirado do baú.');
        }
        break;
      }
      case 'bau-cel':
        estado.bauEscolha = { lado: el.dataset.lado, tipo: el.dataset.tipo, raridade: el.dataset.raridade, qtd: parseInt(el.dataset.qtd, 10) || 1 };
        telaJogo();
        setTimeout(function () { var q = document.getElementById('bau-escolha-qtd'); if (q && temMouse) { q.focus(); q.select(); } }, 30);
        break;
      case 'bau-escolha-fechar': estado.bauEscolha = null; telaJogo(); break;
      case 'bau-mover': {
        var eb = estado.bauEscolha;
        if (!eb) break;
        var qm = el.dataset.valor === 'tudo' ? eb.qtd : parseInt((document.getElementById('bau-escolha-qtd') || {}).value, 10);
        if (!(qm > 0)) { avisar('Digite a quantidade.'); break; }
        bauMover(eb.lado, eb.tipo, eb.raridade, Math.min(qm, eb.qtd));
        break;
      }
      case 'bau-guardar-item': case 'bau-retirar-item': {
        var eu = el.dataset.acao === 'bau-guardar-item', tb = el.dataset.tipo, rb = el.dataset.raridade;
        var qb = parseInt((document.getElementById('bau-q-' + (eu ? 'eu' : 'bau') + '-' + tb + '-' + rb) || {}).value, 10);
        if (!(qb > 0)) { avisar('Digite a quantidade.'); break; }
        var nomeB = qb + 'x ' + R.nomeConsumivel({ tipo: tb, raridade: rb });
        if (eu) bauDepositar({ tipo: tb, raridade: rb, qtd: qb }, nomeB + ' guardado no baú.');
        else bauRetirar(0, tb + ':' + rb, qb, nomeB + ' retirado do baú.');
        break;
      }
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
        if (R.desequipar(p, el.dataset.slot)) { estado.zoom = null; acaoServidor('desequipar', el.dataset.slot); telaJogo(); }
        else avisar('Mochila cheia! Venda algo antes de desequipar.');
        break;
      case 'trocar-pergaminho': {
        var troca = R.trocarPergaminho(p, el.dataset.raridade);
        if (troca.erro) { avisar(troca.erro); break; }
        acaoServidor('trocarPergaminho', el.dataset.raridade);
        avisar('Troca feita! +1 Pergaminho para item ' + ITEM_RARIDADE[troca.para] + '.', 'item');
        telaJogo();
        break;
      }
      case 'skin-comprar': {
        var r = R.comprarSkin(p, el.dataset.valor);
        if (r !== true) { avisar(r); break; }
        acaoServidor('comprarSkin', el.dataset.valor);
        avisar('Skin comprada e em uso no seu D20!');
        telaJogo();
        break;
      }
      case 'skin-usar':
        if (R.usarSkin(p, el.dataset.valor)) { acaoServidor('usarSkin', el.dataset.valor); telaJogo(); }
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
        var lutaRevanche = estado.desafio && estado.desafio.tipo === 'revanche' ? estado.desafio.luta : null;
        if (!alvoDesafio) break;
        if (lutaRevanche) {
          if (bloqueadoMinerando('lutar na Arena')) { estado.desafio = null; telaJogo(); break; }
          estado.desafio = null; telaJogo();
          comecarLutaArena(function () { return C.arena.revanche(p.id, lutaRevanche); });
          break;
        }
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
      case 'arena-resumo': {
        // Resumo (Henri, 17/11/2026): a luta já terminada, lance a lance, e o relatório (também de quando te atacaram).
        var idLuta = Number(el.dataset.luta);
        estado.resumoArena = { id: idLuta };
        telaJogo();
        C.arena.resumo(p.id, idLuta).then(function (l) {
          if (!estado.resumoArena || estado.resumoArena.id !== idLuta) return;
          estado.resumoArena.luta = l; telaJogo();
        }, function (e2) { if (estado.resumoArena && estado.resumoArena.id === idLuta) { estado.resumoArena.erro = e2.message; telaJogo(); } });
        break;
      }
      case 'resumo-fechar':
        if (el.classList.contains('zoom-fundo') && e.target !== el) break;
        estado.resumoArena = null;
        telaJogo();
        break;
      case 'arena-revanche':
        if (bloqueadoMinerando('lutar na Arena')) break;
        // Revanche (Henri, nov/2026): primeiro a tela de confirmação com o perfil do adversário, como no Desafiar.
        if (el.dataset.id) { abrirDesafio(el.dataset.id, 'revanche'); estado.desafio.luta = Number(el.dataset.luta); break; }
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
      case 'guia-comecar': R.comecarGuia(estado.personagem); acaoServidor('comecarGuia'); telaJogo(); break;
      case 'guia-pular':
        if (estado.guiaPularConfirma) { R.pularGuia(estado.personagem); estado.guiaPularConfirma = false; acaoServidor('pularGuia'); telaJogo(); }
        else { estado.guiaPularConfirma = true; avisar('Clique de novo para fechar o guia. Sem o guia, você não ganha o presente do final.'); setTimeout(function () { estado.guiaPularConfirma = false; }, 6000); }
        break;
      case 'historia-ver': {
        var eh = R.historiaEstado(estado.personagem);
        if (!eh || eh.fim) break;
        estado.historiaCena = { rotulo: 'Capítulo ' + (eh.indice + 1) + ' · ' + nomeArea(eh.capitulo.area), titulo: eh.capitulo.titulo,
          falas: eh.capitulo.abertura, botao: eh.visto ? 'Fechar' : 'Aceitar a missão' };
        if (!eh.visto) { R.marcarHistoriaVista(estado.personagem); acaoServidor('historiaVista'); }
        telaJogo(); break;
      }
      case 'historia-concluir': {
        var fimLocal = null;
        el.disabled = true;
        acaoServidor('concluirCapitulo', null, function () { fimLocal = R.concluirCapitulo(estado.personagem); }).then(function (r) {
          var fim = r ? r.resultado : fimLocal;
          el.disabled = false;
          if (!fim) return;
          if (fim.erro) { avisar(fim.erro); return; }
          estado.historiaCena = { rotulo: 'Fim do capítulo', titulo: fim.capitulo.titulo, falas: fim.capitulo.fechamento, premio: fim.premio };
          telaJogo();
        });
        break;
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
        estado.mochilaAba = el.dataset.valor === 'consumiveis' || el.dataset.valor === 'bau' ? el.dataset.valor : 'equipamentos';
        if (estado.mochilaAba === 'bau') { estado.bau = null; estado.bauErro = null; estado.bauEscolha = null; }   // abre com o baú atualizado
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
        var critOrg = vm.ordem === 'mochila' ? 'raridade' : vm.ordem, cresOrg = vm.ordem === 'mochila' ? false : vm.crescente;
        R.organizarMochila(p, critOrg, cresOrg);
        vm.ordem = 'mochila';
        acaoServidor('organizarMochila', [critOrg, cresOrg]);
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
        if (vendeu.vendidos) acaoServidor('venderVarios', idsLote);
        telaJogo();
        atualizarTotalLote();
        avisar('Vendidos ' + vendeu.vendidos + ' item(ns): +' + vendeu.ouro.toLocaleString('pt-BR') + ' de ouro', 'item');
        break;
      }
      case 'item-travar':
        R.travarItem(p, el.dataset.id);
        estado.vendaPendente = null;
        var itT = p.inventario.filter(function (i) { return i.id === el.dataset.id; })[0];
        if (itT) avisar(itT.travado ? '🔒 ' + R.nomeItem(itT) + ' travado: não pode ser vendido nem quebrado.' : '🔓 ' + R.nomeItem(itT) + ' destravado.');
        acaoServidor('travarItem', el.dataset.id);
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
      case 'torre-acao': { var te = torreEst().esc || (torreEst().esc = {}); te.acao = el.dataset.valor; te.hab = el.dataset.hab || null; marcarEscolhaTorre(); break; }
      case 'torre-alvo': torreEst().esc.alvo = Number(el.dataset.valor); marcarEscolhaTorre(); break;
      case 'torre-ordem': torreEst().esc.ordem = Number(el.dataset.valor); marcarEscolhaTorre(); break;
      case 'torre-confirmar': torreConfirmar(); break;
      case 'torre-casa': {
        var gc = estado.gm && estado.gm.grupo, eu = gc && gc.membros.filter(function (m) { return m.id === p.id; })[0], casa = Number(el.dataset.valor);
        if (!gc) { estado.torreCasaSolo = estado.torreCasaSolo === casa ? null : casa; redesenharTorre(true); break; }   // sozinho (admin): só guarda na tela
        if (!eu) break;
        var nova = eu.posicao === casa ? null : casa;
        C.torre.posicao(p.id, nova).then(function () { eu.posicao = nova; redesenharTorre(true); carregarGrupo(); }, function (er) { avisar(er.message); carregarGrupo(); });
        break;
      }
      case 'torre-auto': torreAutoMudar(!torreAuto()); torreEst().autoFeito = null; redesenharTorre(true); autoTorre(); break;
      case 'torre-subir':
        C.torre.iniciar(p.id, estado.gm && estado.gm.grupo ? null : estado.torreCasaSolo).then(function () { torreEst().esc = null; avisar('🗼 A subida começou!', 'nivel'); carregarTorre(); }, function (er) { avisar(er.message); });
        break;
      case 'torre-desistir-pedir': estado.torreDesistir = true; redesenharTorre(true); break;
      case 'torre-desistir-nao': estado.torreDesistir = false; redesenharTorre(true); break;
      case 'torre-desistir': {
        var rd = runTorre(); estado.torreDesistir = false;
        if (rd) C.torre.desistir(p.id, rd.id).then(carregarTorre, function (er) { avisar(er.message); });
        break;
      }
      case 'torre-sair': if (torreEst().st) torreEst().st.run = null; torreEst().esc = null; telaJogo(); break;
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
        relogioLuta(estado.luta);   // o tempo até aqui conta na velocidade antiga
        estado.luta.rapido = !estado.luta.rapido;
        redesenharLuta();
        break;
      case 'mas-votar': masVotar(el.dataset.opcao); break;
      case 'mas-fechar': masFechar(); break;
      case 'luta-fechar': {
        var eraBoss = estado.luta && estado.luta.boss;
        clearTimeout(estado.luta.timer);
        estado.luta = null;
        if (eraBoss) { estado.aba = 'alianca'; estado.aliancaVista = 'boss'; telaJogo(); carregarBossAl(); if (ACAO_SERVIDOR) receberPendentes(); break; }
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
        pp[ka] = (pp[ka] || 0) + Math.min(parseInt(el.dataset.valor, 10) || 1, p.pontosLivres - totalPendentes());
        atualizarFicha();
        break;
      }
      case 'pontos-passo': estado.passoPontos = el.dataset.valor === '10' ? 10 : 1; atualizarFicha(); break;
      case 'ponto-menos': {
        var pm = pontosPendentes(), km = el.dataset.atributo;
        if (pm[km]) pm[km] = Math.max(0, pm[km] - (parseInt(el.dataset.valor, 10) || 1));
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
        if (ru === true) { acaoServidor('usarRecomeco'); telaJogo(); avisar('Atributos resetados: ' + p.pontosLivres + ' pontos para distribuir!', 'nivel'); }
        else { avisar(ru); atualizarFicha(); }
        break;
      }
      case 'hab-classe': {
        var sc = D.SEGUNDAS_CLASSES[el.dataset.valor];
        if (!sc || !confirm('Virar ' + ((p.sexo === 'feminino' && sc.nomeF) || sc.nome) + '? Só dá para trocar com o ' + D.RECOMECO_HABILIDADES.nome + '.')) break;
        var rcl = R.escolherSegundaClasse(p, el.dataset.valor);
        if (rcl === true) { estado.habPend = {}; acaoServidor('segundaClasse', el.dataset.valor); telaJogo(); avisar('Agora você é ' + ((p.sexo === 'feminino' && sc.nomeF) || sc.nome) + '! Distribua os seus pontos.', 'nivel'); }
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
      case 'asc-sel': estado.ascSel = el.dataset.id; redesenharPacto(); break;
      case 'asc-sel-fechar': estado.ascSel = null; redesenharPacto(); break;
      case 'asc-zoom': estado.ascZoom = !estado.ascZoom; redesenharPacto(); break;
      case 'asc-pegar': {
        var lpg = R.nosAscensao(p).concat(pendAsc()), mpg = R.motivoAscensao(lpg, el.dataset.id, R.pontosAscensaoTotal(p));
        if (mpg) { avisar(mpg); break; }
        pendAsc().push(el.dataset.id);
        redesenharPacto();
        break;
      }
      case 'asc-caminho': {   // Pacto v2: o caminho inteiro até o ponto, de uma vez (confirma tudo no fim)
        var lcm = R.nosAscensao(p).concat(pendAsc()), cm = R.caminhoAscensao(lcm, el.dataset.id);
        if (!cm || !R.ordenarAscensao(lcm.concat(cm), R.pontosAscensaoTotal(p))) { avisar('Não dá para chegar nesse ponto agora.'); break; }
        cm.forEach(function (x) { pendAsc().push(x); });
        redesenharPacto();
        break;
      }
      case 'asc-tirar': {
        // tira o ponto e os que dependiam dele (os que não ficam mais ligados)
        var resto = pendAsc().filter(function (x) { return x !== el.dataset.id; }), base = R.nosAscensao(p), tot = R.pontosAscensaoTotal(p), ok = [];
        resto.forEach(function (x) { if (!R.motivoAscensao(base.concat(ok), x, tot)) ok.push(x); });
        var mudou = true;
        while (mudou) { mudou = false; resto.forEach(function (x) { if (ok.indexOf(x) < 0 && !R.motivoAscensao(base.concat(ok), x, tot)) { ok.push(x); mudou = true; } }); }
        estado.ascPend = ok;
        redesenharPacto();
        break;
      }
      case 'asc-cancelar': estado.ascPend = []; redesenharPacto(); break;
      case 'asc-confirmar': {
        var feitosAsc = [];
        pendAsc().forEach(function (x) { if (R.comprarAscensao(p, x) === true) feitosAsc.push(x); });
        estado.ascPend = [];
        if (feitosAsc.length) acaoServidor('ascensao', feitosAsc);
        telaJogo(); avisar('Pacto de Ascensão fortalecido!', 'nivel');
        break;
      }
      case 'asc-refazer-pedir': estado.ascRefazer = true; redesenharPacto(); break;
      case 'asc-refazer-nao': estado.ascRefazer = false; redesenharPacto(); break;
      case 'asc-refazer': {
        estado.ascRefazer = false;
        var rz = R.refazerAscensao(p, C.agora());
        if (rz === true) { estado.ascPend = []; acaoServidor('refazerAscensao'); telaJogo(); avisar('Pacto zerado: escolha o caminho de novo.', 'nivel'); }
        else { avisar(rz); redesenharPacto(); }
        break;
      }
      case 'hab-confirmar': {
        var pdc = pendHab();
        var feitosHab = {};
        Object.keys(pdc).forEach(function (k) { for (var i = 0; i < pdc[k]; i++) if (R.mudarPontoHabilidade(p, k, 1) === true) feitosHab[k] = (feitosHab[k] || 0) + 1; });
        estado.habPend = {};
        if (Object.keys(feitosHab).length) acaoServidor('pontosHabilidade', feitosHab);
        telaJogo(); avisar('Pontos de habilidade confirmados!');
        break;
      }
      case 'hab-ordem':
        if (R.moverHabilidade(p, el.dataset.modo, el.dataset.id, el.dataset.op)) acaoServidor('ordemHabilidade', [el.dataset.modo, el.dataset.id, el.dataset.op]);
        telaJogo();
        break;
      case 'hab-pergaminho-comprar': {
        var rh = R.comprarRecomecoHabilidades(p);
        if (rh === true) { acaoServidor('comprarRecomecoHabilidades'); telaJogo(); avisar('Você comprou o ' + D.RECOMECO_HABILIDADES.nome + '!', 'item'); }
        else avisar(rh);
        break;
      }
      case 'hab-pergaminho-usar': {
        if (!confirm('Usar o ' + D.RECOMECO_HABILIDADES.nome + '? Os pontos voltam e você escolhe a segunda classe de novo.')) break;
        var uh = R.usarRecomecoHabilidades(p);
        if (uh === true) { estado.habPend = {}; acaoServidor('usarRecomecoHabilidades'); telaJogo(); avisar('Habilidades zeradas: escolha a segunda classe de novo.', 'nivel'); }
        else avisar(uh);
        break;
      }
      case 'recomeco-comprar': {
        var rc = R.comprarRecomeco(p);
        if (rc === true) { acaoServidor('comprarRecomeco'); telaJogo(); avisar('Você comprou o ' + D.RECOMECO.nome + '!', 'item'); }
        else avisar(rc);
        break;
      }
      case 'pontos-desfazer':
        estado.pontosPend = null;
        atualizarFicha();
        break;
      case 'pontos-confirmar': {
        var pc = pontosPendentes(), dados = 0, feitos = {};
        R.ATRIBUTOS.forEach(function (k) { while (pc[k] > 0 && R.distribuirPonto(p, k)) { pc[k] -= 1; dados++; feitos[k] = (feitos[k] || 0) + 1; } });
        estado.pontosPend = null;
        if (dados) acaoServidor('atributos', feitos);
        telaJogo();
        if (dados) avisar(dados + ' ponto(s) de atributo distribuído(s)!', 'nivel');
        break;
      }
      case 'acampar':
        R.acampar(p, C.agora(), true);
        acaoServidor('acampar', true);
        avisar(p.nome + ' monta acampamento junto à fogueira. A estamina enche em ' + (D.ESTAMINA.minutosAcampado / 60) + ' h.');
        telaJogo();
        break;
      case 'levantar':
        R.acampar(p, C.agora(), false);
        acaoServidor('acampar', false);
        telaJogo();
        break;
      case 'pocao-comprar': {
        var rp = R.comprarPocao(p);
        if (rp === true) { acaoServidor('comprarPocao'); avisar('Poção de vida comprada.', 'vitoria'); } else avisar(rp);
        telaJogo();
        break;
      }
      case 'pote-estamina': {
        var re = R.comprarPoteEstamina(p, C.agora());
        if (re === true) { acaoServidor('comprarPoteEstamina'); avisar('Você bebe o pote: +' + D.ESTAMINA.pote.enche + ' de estamina.', 'vitoria'); } else avisar(re);
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
        if (R.equipar(p, el.dataset.id, el.dataset.espaco)) { estado.vendaPendente = null; estado.zoom = null; fecharFlutuante(); acaoServidor('equipar', el.dataset.espaco ? { id: el.dataset.id, slot: el.dataset.espaco } : el.dataset.id); telaJogo(); }
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
          acaoServidor('vender', item.id);
          avisar('Você vendeu ' + R.nomeItem(item) + ' por ' + valor + ' de ouro.');
          estado.itemFoco = null;
          estado.zoom = null;
        }
        estado.vendaPendente = null;
        telaJogo();
        break;
      }
      case 'comprar': {
        // o item é sorteado no servidor: a tela espera a resposta (no jeito antigo, sorteia aqui)
        var pedidoCompra = { raridade: el.dataset.raridade || null, tipo: el.dataset.tipo, especifico: el.dataset.especifico || null };
        var avisarCompra = function (it) {
          if (!it) return;
          avisar('Você comprou ' + R.nomeItem(it) + ' (nível ' + (it.nivel || 1) + ', ' + D.raridades[it.raridade].nome + ')! Está na mochila.');
          telaJogo();
        };
        var compraLocal = null, idsAntes = p.inventario.map(function (i) { return i.id; });
        el.disabled = true;
        acaoServidor('comprar', pedidoCompra, function () {
          compraLocal = pedidoCompra.raridade ? R.comprar(p, pedidoCompra.raridade, pedidoCompra.tipo, pedidoCompra.especifico || undefined)
            : R.comprar(p, pedidoCompra.tipo, pedidoCompra.especifico || undefined);
          if (typeof compraLocal === 'string') { avisar(compraLocal); compraLocal = null; }
        }).then(function (r) {
          el.disabled = false;
          var novo = r ? estado.personagem.inventario.filter(function (i) { return idsAntes.indexOf(i.id) < 0; }).pop() : compraLocal;
          avisarCompra(novo);
        });
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
        var opMinas = estado.minasTempo == null ? 1 : estado.minasTempo;
        var rm = R.iniciarMinas(p, opMinas, C.agora(), estado.minasArea);
        if (rm !== true) avisar(rm); else { acaoServidor('iniciarMinas', [opMinas, estado.minasArea]); avisar('⛏ Mineração começou! Volte quando terminar.'); }
        telaJogo();
        break;
      }
      case 'minas-parar':
      case 'minas-recolher': {
        // a quantidade minerada é sorteada no servidor
        var parouMinas = el.dataset.acao === 'minas-parar', minasLocal = null;
        el.disabled = true;
        acaoServidor(parouMinas ? 'pararMinas' : 'recolherMinas', null, function () {
          minasLocal = parouMinas ? R.pararMinas(p, C.agora()) : R.recolherMinas(p, C.agora());
        }).then(function (r) {
          var rmin = r ? r.resultado : minasLocal;
          if (rmin) avisoMinas(rmin, parouMinas);
          telaJogo();
        });
        break;
      }
      case 'craft-receita': {
        var rr = R.fabricarReceita(p, el.dataset.id);
        if (rr !== true) avisar(rr); else { acaoServidor('fabricarReceita', el.dataset.id); avisar('📜 Receita fabricada!', 'item'); }
        telaJogo();
        break;
      }
      case 'craft-protecao': {
        var rp = R.fabricarProtecao(p, el.dataset.id);
        if (rp !== true) avisar(rp); else { acaoServidor('fabricarProtecao', el.dataset.id); avisar('🛡 Pergaminho de Proteção fabricado!', 'item'); }
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
        var forjaLocal = null;
        el.disabled = true;
        acaoServidor('forjar', { area: fa.area, classe: fa.classe, tipo: fa.tipo, chefe: fa.chefe, gemas: fa.gemas }, function () {
          forjaLocal = R.forjar(p, fa.area, fa.classe, fa.tipo, fa.chefe, fa.gemas);
          if (typeof forjaLocal === 'string') { avisar(forjaLocal); forjaLocal = null; }
        }).then(function (r) {
          var rf = r ? r.resultado : forjaLocal;
          if (rf && rf.item) avisar((rf.obraPrima ? '✨ OBRA-PRIMA! ' : '🔨 ') + 'Você forjou ' + R.nomeItem(rf.item) + ' (' + nomeRaridadeItem(rf.item) + ')!', 'item raridade-' + rf.item.raridade);
          telaJogo();
        });
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
        else if (op === 'pacto') { if (!R.admin.pacto(p, v)) { avisar(p.nivel < D.ASCENSAO.nivelInicio ? 'O Pacto abre no level ' + D.ASCENSAO.nivelInicio + '.' : v > 0 ? 'Já está no limite de ' + D.ASCENSAO.limitePontos + ' pontos.' : 'Não tem ponto extra para tirar (os do level ficam).'); break; } }
        else if (op === 'encanto') { var nEnc = R.admin.encantoEquipados(p, v); if (!nEnc) { avisar(v > 0 ? 'Todos os equipados já estão no máximo.' : 'Todos os equipados já estão em +0.'); break; } }
        if (op === 'pedir-esvaziar') { estado.adminConfirmar = 'mochila'; telaJogo(); break; }
        estado.adminConfirmar = null;
        if (op === 'cancelar') { telaJogo(); break; }
        salvar();
        avisar({ ouro: (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('pt-BR') + ' de ouro. Agora: ' + p.ouro.toLocaleString('pt-BR') + '.',
          'zerar-ouro': 'Ouro zerado.', nivel: 'Agora no level ' + p.nivel + '.', 'baixar-nivel': 'Agora no level ' + p.nivel + '. Distribua os pontos de novo.',
          exp: 'Exp agora: ' + p.exp.toLocaleString('pt-BR') + ' (level ' + p.nivel + ').', 'resetar-atributos': 'Atributos resetados: ' + p.pontosLivres + ' pontos para distribuir.',
          pacto: 'Pacto: ' + R.pontosAscensaoTotal(p) + ' pontos (' + R.pontosAscensaoLivres(p) + ' livres).',
          encanto: 'Encanto dos equipados ' + (v > 0 ? 'subiu' : 'desceu') + ' (' + Object.keys(p.equipados || {}).map(function (sl) { var it = R.itemNoSlot(p, sl); return it ? '+' + (it.encanto || 0) : ''; }).filter(Boolean).join(' ') + ').',
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
        acaoServidor('habilidadeAuto', el.checked);
        break;
      case 'cacar': {
        var alvo = el.dataset.monstro;
        if (!R.monstroLiberado(p, alvo)) { avisar('Derrote ' + D.monstros[R.monstroAnterior(alvo)].nome + ' primeiro.'); break; }
        if (!R.podeCacar(p, alvo)) { avisar('Essa área ainda não foi liberada.'); break; }
        R.atualizarTempo(p, C.agora());   // (o servidor recalcula a estamina sozinho em cada ação)
        estado.resultado = null; iniciarCacada(D.monstros[alvo].area, [alvo]);   // luta avulsa virou caçada de um monstro só
        break;
        if (p.acampado) { R.acampar(p, C.agora(), false); acaoServidor('acampar', false); avisar('Acampamento levantado. Boa caçada!'); }   // caçar levanta o acampamento sozinho
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
      case 'area-fechada': {   // região fechada pela História (Henri, 22/11/2026)
        var af = D.areas.filter(function (x) { return x.id === el.dataset.valor; })[0];
        avisar('📜 ' + (af ? R.motivoAreaFechada(estado.personagem, af) : 'Conclua a História antes de avançar.') + ' Veja em Aventura › História.');
        break;
      }
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
        el.classList.toggle('ligado', estado.rapido); el.setAttribute('aria-pressed', estado.rapido); el.title = estado.rapido ? 'Velocidade 2x ligada (clique para voltar ao normal)' : 'Acelerar a luta (2x)';
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
      case 'cacada-continuar': if (estado.cacada) { var areaC = estado.cacada.area; iniciarCacada(areaC, estado.cacada.pesadelo ? estado.cacada.alvos : null); } break;
      case 'reino-pesadelo': estado.reinoPesadelo = true; estado.pesadeloChefe = null; estado.areaAberta = null; telaJogo(); break;
      case 'reino-normal': estado.reinoPesadelo = false; estado.pesadeloChefe = null; telaJogo(); break;
      case 'pesadelo-chefe': estado.pesadeloChefe = el.dataset.valor; telaJogo(); break;
      case 'pesadelo-mapa': estado.pesadeloChefe = null; telaJogo(); break;
      case 'pesadelo-lutar': iniciarCacada(areaDoAlvo(el.dataset.valor), [el.dataset.valor]); break;
      case 'cacada-fechar': fecharCacada(); break;
      case 'cacada-opcao': {
        var prefO = prefsCacada();
        if (el.dataset.campo === 'pocao') prefO.pocao = Number(el.dataset.valor) || 0;
        else prefO.chefe = el.dataset.valor;
        salvarPreferencias();
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
        salvarPreferencias();
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
    salvarPreferencias();
  });
  // Dentro do jogo o botão direito não abre o menu do navegador: num item da mochila ele equipa (Daniel, nov/2026).
  // Os dois cliques não equipam mais (equipavam sem querer); passar o mouse mostra a ficha.
  // (Nos campos de texto, como o chat, o menu continua para copiar e colar.)
  document.addEventListener('contextmenu', function (e) {
    if (!estado.personagem || !document.querySelector('.jogo')) return;
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    e.preventDefault();
    var cb = e.target.closest && e.target.closest('[data-acao="bau-cel"]');   // Baú: o botão direito move tudo
    if (cb) { if (!estado.bauOcupado) bauMover(cb.dataset.lado, cb.dataset.tipo, cb.dataset.raridade, parseInt(cb.dataset.qtd, 10) || 1); return; }
    var el = e.target.closest && e.target.closest('[data-acao="item"]');
    var p = estado.personagem;
    if (!el || estado.vendaLote || R.slotDoItem(p, el.dataset.id)) return;
    var it = p.inventario.find(function (i) { return i.id === el.dataset.id; });
    if (!R.equipar(p, el.dataset.id)) { avisar(R.motivoNaoEquipa(p, it) || 'Não foi possível equipar (mochila cheia?).'); return; }
    fecharFlutuante();
    estado.zoom = null;
    estado.vendaPendente = null;
    acaoServidor('equipar', el.dataset.id);
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
    salvarPreferencias();   // também marca o personagem como online para os amigos
    carregarSocial();
    carregarAlianca();
  }, 60000);

  // ---------------- Masmorras em grupo ----------------
  // estado.gm: o que o servidor diz do grupo (grupo_estado). estado.luta: a luta sendo assistida.
  // A luta é calculada aqui com a semente do servidor; todo mundo do grupo calcula a mesma.
  var vistas = {};   // lutas (run.id) que este navegador já mostrou
  var NOMES_SALA = ['Sala 1', 'Sala 2', 'Sala 3 · Chefe'];

  // ---------------- Masmorra com caminhos (Henri, 16/11/2026) ----------------
  // O servidor avança tudo (lutas automáticas, votações de 10 s, efeitos e prêmios: ação `masmorraAvancar`). Aqui só
  // mostra: resumo de cada luta, os 3 caminhos para votar e, no fim, os prêmios. estado.mas = { run, etapa, versao, ... }.
  var NOMES_PASSO = { luta1: 'Luta 1', luta2: 'Luta 2', elite: 'Elite', chefe: 'Chefe', corredor: 'Corredor escuro', voto: 'Caminho' };
  var masFechadas = {};
  function agoraMas() { var m = estado.mas; return Date.now() + (m && m.desvio || 0); }
  function abrirMasmorra(run) {
    if (!run || !run.etapa || masFechadas[run.id]) return;
    if (estado.mas && estado.mas.run.id === run.id) { atualizarMas(run.etapa, run.versao, run.estado, run.agora); return; }
    vistas[run.id] = true;
    clearInterval(estado.mas && estado.mas.relogio);
    estado.mas = { run: run, etapa: run.etapa, versao: run.versao || 0, estado: run.estado, mm: R.masmorra(run.masmorra),
      desvio: run.agora ? Number(run.agora) - Date.now() : 0, vistas: {}, ultimoAvanco: 0, ultimaBusca: Date.now() };
    estado.mas.relogio = setInterval(tiqueMas, 350);   // o replay troca de lance a cada 0,7 s
    estado.chefeAviso = null;
    telaJogo();
    tiqueMas();
  }
  function atualizarMas(etapa, versao, est, agora) {
    var m = estado.mas;
    if (!m || versao == null || versao < m.versao) return false;
    if (agora) m.desvio = Number(agora) - Date.now();
    var mudou = versao > m.versao || est !== m.estado;
    m.etapa = etapa; m.versao = versao; m.estado = est;
    return mudou;
  }
  // A cada segundo: conta o tempo da votação; pede ao servidor para avançar quando precisa; busca o estado a cada 2 s.
  function tiqueMas() {
    var m = estado.mas, p = estado.personagem;
    if (!m || !p) return;
    var e = m.etapa || {}, agora = agoraMas(), membros = m.run.membros || [];
    var votaram = Object.keys(e.votos || {}).filter(function (k) { return membros.indexOf(k) >= 0; }).length;
    var precisa = m.estado === 'andamento' && (!e.fim && (!e.prazo || agora >= e.prazo || votaram >= membros.length) || (e.fim && !e.premios));
    if (precisa && !m.avancando && Date.now() - m.ultimoAvanco > 1500) {
      m.avancando = true; m.ultimoAvanco = Date.now();
      C.acao(p.id, 'masmorraAvancar', { run: m.run.id }).then(function (r) {
        m.avancando = false;
        if (estado.mas !== m) return;
        if (r && r.erro) { m.erro = r.erro; }
        else if (r && r.resultado) { m.erro = null; atualizarMas(r.resultado.etapa, r.resultado.versao, r.resultado.estado, r.resultado.agora); }
        redesenharMas();
      }, function (er) { m.avancando = false; m.erro = er.message; });
    } else if (!m.buscando && Date.now() - m.ultimaBusca > 2000 && m.estado === 'andamento') {
      m.buscando = true; m.ultimaBusca = Date.now();
      C.grupo.estado(p.id).then(function (g) {
        m.buscando = false;
        if (estado.mas !== m) return;
        var run = g && g.run;
        if (run && run.id === m.run.id) atualizarMas(run.etapa, run.versao, run.estado, run.agora);
        redesenharMas();
      }, function () { m.buscando = false; });
    }
    redesenharMas();
  }
  // Redesenha só quando algo mudou (o resumo da luta não recomeça a animação); senão só atualiza o relógio.
  function chaveMas() {
    var m = estado.mas, e = m.etapa || {}, agora = agoraMas(), r = replayMas();
    return [m.versao, m.estado, m.meuVoto && m.meuVoto.opcao, m.erro, e.prazo && agora >= e.abre ? 'v' : 'n', JSON.stringify(e.votos || {}),
      r ? r.n + ':' + r.q : '-', r ? r.fimLuta : ''].join('|');
  }
  // Qual luta está passando agora (replay de destaques pelo relógio do servidor) e em que lance. Lutas que ainda vão
  // passar (o servidor já calculou) ficam escondidas até a vez delas.
  function replayMas() {
    var m = estado.mas, e = m && m.etapa || {}, agora = agoraMas(), Q = D.MASMORRA.quadroMs || 700, r = null;
    (e.log || []).forEach(function (l, n) {
      if (r || l.tipo !== 'luta' || !l.quadros || !l.quadros.length || l.inicio == null) return;
      if (agora >= l.inicio && agora < l.inicio + l.dur) {
        var q = Math.min(l.quadros.length - 1, Math.floor((agora - l.inicio) / Q));
        r = { l: l, n: n, q: q, fimLuta: agora >= l.inicio + l.quadros.length * Q };
      }
    });
    return r;
  }
  function escondidaMas(l) { return l.tipo === 'luta' && l.inicio != null && agoraMas() < l.inicio; }
  function arenaReplayHtml(r) {
    var m = estado.mas, run = m.run, l = r.l, q = l.quadros[r.q], alvo = q.a || '';
    var dano = function (lado, i) {
      if (alvo !== lado + i || r.fimLuta) return '';
      if (q.x === 'erro') return '<span class="mas-dano erro">errou</span>';
      if (q.x === 'cura') return '<span class="mas-dano cura">✚</span>';
      return q.d ? '<span class="mas-dano' + (q.c ? ' critico' : '') + '">−' + q.d.toLocaleString('pt-BR') + '</span>' : '';
    };
    var herois = run.herois.map(function (h, i) {
      var d = h.dados, max = (l.herois[i] || {}).hpMax || 1, v = q.hh[i] != null ? q.hh[i] : max;
      var dh = q.dh ? q.dh[i] : 0, top = q.dh && dh > 0 && dh === Math.max.apply(null, q.dh);
      return '<div class="mas-lutador' + (v > 0 ? '' : ' caido') + (alvo === 'h' + i && !r.fimLuta ? ' mas-alvo' : '') + '"><div class="moldura">' + retratoMas(i) + dano('h', i) + '</div>'
        + '<div class="mas-nome">' + esc(d.nome) + ' <span class="mas-dano-total' + (top ? ' top' : '') + '">' + fmtDano(dh) + '</span></div>' + barra('hp', v, max, v + ' / ' + max, 'masr-h' + i) + '</div>';
    }).join('');
    var monstros = l.monstros.map(function (x, i) {
      var max = x.hpMax || 1, v = q.mh[i] != null ? q.mh[i] : max;
      return '<div class="mas-lutador' + (v > 0 ? '' : ' caido') + (x.chefe ? ' mas-chefe' : '') + (alvo === 'm' + i && !r.fimLuta ? ' mas-alvo' : '') + '"><div class="moldura">' + F.imagemMonstro(x.id) + dano('m', i) + '</div>'
        + '<div class="mas-nome">' + (x.chefe ? '<span class="selo-chefe">Chefe</span> ' : x.elite ? '<span class="selo-elite">Elite</span> ' : '') + esc(x.nome) + '</div>'
        + barra('hp', v, max, v.toLocaleString('pt-BR') + ' / ' + max.toLocaleString('pt-BR'), 'masr-m' + r.n + '-' + i) + '</div>';
    }).join('');
    var linhas = l.quadros.slice(Math.max(0, r.q - 4), r.q + 1).map(function (x, k, arr) {
      return '<p class="' + (k === arr.length - 1 ? 'mas-lance-atual ' : '') + (x.c ? 'critico' : x.x === 'cura' ? 'cura' : x.x === 'caiu' ? 'destaque' : x.x === 'erro' ? 'errou' : '') + '">' + esc(x.t) + '</p>';
    }).join('');
    var fim = r.fimLuta ? '<div class="mas-fim-luta ' + (l.vitoria ? 'vitoria' : 'derrota') + '">' + (l.vitoria ? 'VITÓRIA!' : 'O grupo caiu…') + '</div>' : '';
    return '<div class="mas-replay"><h4>⚔ ' + (NOMES_PASSO[l.sala] || 'Luta') + ' <span class="suave pequeno">lance ' + (r.q + 1) + '/' + l.quadros.length + '</span></h4>'
      + '<div class="mas-arena"><div class="mas-grupo">' + herois + '</div><div class="vs">VS</div><div class="mas-grupo">' + monstros + '</div></div>'
      + fim + '<div class="registro mas-lances">' + linhas + '</div></div>';
  }
  function redesenharMas() {
    var painel = document.querySelector('.jogo > section'), m = estado.mas;
    if (!painel || !m || estado.batalha || estado.luta) return;
    var tela = painel.querySelector('.mas-tela'), chave = chaveMas();
    if (tela && m.chave === chave) {
      var e = m.etapa || {}, agora = agoraMas();
      var t = painel.querySelector('.mas-tempo'); if (t && e.prazo) t.textContent = Math.max(0, Math.ceil((e.prazo - agora) / 1000)) + ' s';
      var w = painel.querySelector('.mas-espera b'); if (w && e.abre) w.textContent = Math.max(1, Math.ceil((e.abre - agora) / 1000));
      return;
    }
    m.chave = chave;
    painel.innerHTML = masmorraCaminhosHtml();
  }
  function masVotar(opcao) {
    var m = estado.mas, p = estado.personagem;
    if (!m || !p) return;
    m.meuVoto = { prazo: m.etapa.prazo, opcao: opcao };   // vale só para esta votação
    m.etapa.votos = Object.assign({}, m.etapa.votos || {}); m.etapa.votos[p.id] = opcao;
    redesenharMas();
    C.grupo.votar(p.id, m.run.id, opcao).then(function () { m.ultimoAvanco = 0; tiqueMas(); }, function (e) { avisar(e.message); });
  }
  function masFechar() {
    var m = estado.mas;
    if (!m) return;
    clearInterval(m.relogio);
    masFechadas[m.run.id] = true;
    var venceu = m.etapa && m.etapa.fim === 'vitoria', run = m.run;
    estado.mas = null;
    if (venceu) {   // missão e História (o servidor confere pelo evento)
      var mis = R.garantirMissoes(estado.personagem, C.agora());
      if (mis.runs.indexOf(String(run.id)) < 0) {
        mis.runs = mis.runs.concat(String(run.id)).slice(-20);
        R.registrarMissao(estado.personagem, 'masmorra', 1, C.agora());
        if (R.registrarHistoria(estado.personagem, 'masmorra', run.masmorra)) avisoHistoria();
        acaoServidor('eventoJogo', { tipo: 'masmorra', vitoria: true, alvo: run.masmorra, run: String(run.id) });
      }
    }
    estado.aba = 'masmorra';
    telaJogo();
    resgatarRecompensas();   // os prêmios vão para a mochila
    carregarGrupo();
  }
  // Retrato de um herói da masmorra: a classe que lutou (o bot da fila vira a classe que faltava no grupo).
  function retratoMas(i) {
    var m = estado.mas, log = (m.etapa && m.etapa.log) || [], d = m.run.herois[i].dados, x = null;
    for (var k = log.length - 1; k >= 0 && !x; k--) if (log[k].tipo === 'luta' && log[k].herois && log[k].herois[i] && log[k].herois[i].classe) x = log[k].herois[i];
    if (!x && d.bot && d.botClasse2 && D.SEGUNDAS_CLASSES[d.botClasse2]) x = { raca: d.raca, sexo: d.sexo, classe: D.SEGUNDAS_CLASSES[d.botClasse2].de, classe2: d.botClasse2 };
    x = x || d;
    return F.personagem(x.raca || d.raca, classeRetrato(x), x.sexo || d.sexo);
  }
  // Dano de cada herói: numa luta (último lance) ou somado nas lutas já mostradas.
  function danoLuta(l) { var q = l && l.quadros && l.quadros[l.quadros.length - 1]; return q && q.dh ? q.dh : null; }
  function danoTotalMas(lutas) {
    var t = null;
    lutas.forEach(function (l) { var d = l.tipo === 'luta' && danoLuta(l); if (d) { t = t || d.map(function () { return 0; }); d.forEach(function (v, i) { t[i] += v; }); } });
    return t;
  }
  function fmtDano(v) { return '⚔ ' + Math.round(v || 0).toLocaleString('pt-BR'); }
  function nomeHeroiRun(run, pid) { var h = run.herois.filter(function (x) { return x.id === pid; })[0]; return h ? h.dados.nome : '?'; }
  function masmorraCaminhosHtml() {
    var m = estado.mas, e = m.etapa || {}, run = m.run, M = D.MASMORRA, agora = agoraMas(), meu = estado.personagem.id;
    var rp = replayMas(), oculto = -1;
    (e.log || []).forEach(function (l, i) { if (oculto < 0 && escondidaMas(l)) oculto = i; });
    var logVisivel = oculto < 0 ? (e.log || []) : e.log.slice(0, oculto);
    if (rp) logVisivel = logVisivel.slice(0, rp.n);   // a luta que está passando aparece no replay, não no diário
    var passando = !!rp || oculto >= 0;
    var roteiro = M.roteiro.map(function (k, i) {
      return '<span class="mas-passo' + (i < (e.fase || 0) || (e.fim === 'vitoria') ? ' feito' : i === (e.fase || 0) && !e.fim ? ' atual' : '') + '">' + NOMES_PASSO[k] + '</span>';
    }).join('<span class="mas-seta">›</span>');
    // vida atual de cada herói
    var hpMax = e.hpMax || [], hp = e.hp || hpMax;
    var totalDano = danoTotalMas(logVisivel);
    var herois = run.herois.map(function (h, i) {
      var d = h.dados, max = hpMax[i] || 1, v = hp[i] != null ? hp[i] : max;
      return '<div class="mas-lutador' + (v > 0 ? '' : ' caido') + '"><div class="moldura">' + retratoMas(i) + '</div>'
        + '<div class="mas-nome">' + esc(d.nome) + (h.bot ? ' <span class="suave pequeno">(bot)</span>' : '') + (h.id === run.lider ? ' 👑' : '')
        + (totalDano ? ' <span class="mas-dano-total">' + fmtDano(totalDano[i]) + '</span>' : '') + '</div>'
        + (hpMax[i] ? barra('hp', v, max, v + ' / ' + max, 'masc' + i) : '') + '</div>';
    }).join('');
    // diário: lutas e caminhos (o mais novo em cima)
    var diario = logVisivel.map(function (l, i) {
      if (l.tipo === 'luta') {
        var mons = l.monstros.map(function (x) { return (x.chefe ? '<span class="selo-chefe">Chefe</span> ' : x.elite ? '<span class="selo-elite">Elite</span> ' : '') + esc(x.nome); }).join(', ');
        var nova = !m.vistas[i]; m.vistas[i] = true;
        return '<div class="mas-diario-luta' + (l.vitoria ? '' : ' derrota') + (nova ? ' nova' : '') + '"><h4>⚔ ' + (NOMES_PASSO[l.sala] || 'Luta') + ' <span class="suave pequeno">' + mons + '</span></h4>'
          + l.linhas.map(function (t, k) { return '<p style="animation-delay:' + (k * 0.6) + 's">' + esc(t) + '</p>'; }).join('')
          + (danoLuta(l) ? '<p class="suave pequeno">Dano: ' + danoLuta(l).map(function (v, k) { return esc((run.herois[k] || {}).dados ? run.herois[k].dados.nome : '?') + ' ' + Math.round(v).toLocaleString('pt-BR'); }).join(' · ') + '</p>' : '') + '</div>';
      }
      var C = M.caminhos[l.escolha] || {}, quem = Object.keys(l.votos || {}).map(function (k) { return esc(nomeHeroiRun(run, k)) + ': ' + (M.caminhos[l.votos[k]] || {}).nome; }).join(' · ');
      var res = l.escolha === 'porta' ? (l.bau ? '🎁 Um baú! Cada um vai levar uma joia e um pergaminho.' : '💥 Armadilha! Todos perderam ' + M.caminhos.porta.armadilhaVidaPct + '% da vida.')
        : l.escolha === 'fonte' ? '💧 A fonte curou todo o grupo (−' + -M.caminhos.fonte.dropPct + '% de chance nos drops).'
        : '🕯 O grupo entra no corredor escuro…';
      return '<div class="mas-diario-caminho"><h4><img src="assets/masmorra/' + l.escolha + '.webp" alt=""> ' + esc(C.nome || l.escolha) + (l.empate ? ' <span class="suave pequeno">(empate: decidiu o líder)</span>' : '') + '</h4>'
        + '<p>' + res + '</p>' + (quem ? '<p class="suave pequeno">Votos: ' + quem + '</p>' : '<p class="suave pequeno">Ninguém votou: o caminho foi sorteado.</p>') + '</div>';
    }).reverse().join('');
    // votação
    var voto = '';
    if (passando) voto = '';
    else if (!e.fim && e.prazo) {
      var meuVoto = (e.votos || {})[meu] || (m.meuVoto && m.meuVoto.prazo === e.prazo ? m.meuVoto.opcao : null), falta = Math.max(0, Math.ceil((e.prazo - agora) / 1000));
      if (agora < e.abre) voto = '<p class="mas-espera">Escolham o próximo caminho em <b>' + Math.max(1, Math.ceil((e.abre - agora) / 1000)) + '</b> s…</p>';
      else voto = '<div class="mas-votacao"><h3>Escolham o caminho · <span class="mas-tempo">' + falta + ' s</span></h3><div class="mas-caminhos">'
        + ['porta', 'corredor', 'fonte'].map(function (k) {
          var C = M.caminhos[k], quem = Object.keys(e.votos || {}).filter(function (x) { return e.votos[x] === k; }).map(function (x) { return esc(nomeHeroiRun(run, x)); });
          return '<button class="mas-caminho' + (meuVoto === k ? ' escolhido' : '') + '" data-acao="mas-votar" data-opcao="' + k + '"' + (run.membros.indexOf(meu) < 0 ? ' disabled' : '') + '>'
            + '<img src="assets/masmorra/' + k + '.webp" alt=""><strong>' + C.nome + '</strong><span class="pequeno">' + C.texto + '</span>'
            + '<span class="mas-votos">' + (quem.length ? '🗳 ' + quem.join(', ') : '&nbsp;') + '</span></button>';
        }).join('') + '</div><p class="suave pequeno">Quem não votar em ' + M.votoSeg + ' s perde o voto. Empate: vale o voto do líder 👑.</p></div>';
    } else if (!e.fim && m.estado === 'andamento') voto = '<p class="mas-espera">⚔ O grupo avança…</p>';
    // fim e prêmios
    var fim = '';
    if (e.fim && !passando) {
      var meus = (e.premios || []).filter(function (x) { return x.pid === meu; });
      var itens = meus.filter(function (x) { return x.item.tipo !== 'pergaminho'; }).map(function (x) {
        return '<div class="mas-premio">' + (x.bau ? '<span class="selo-elite">Baú</span>' : '') + fichaItemHtml(x.item, true) + '</div>';
      }).join('');
      var pergs = {};
      meus.filter(function (x) { return x.item.tipo === 'pergaminho'; }).forEach(function (x) { pergs[x.item.raridade] = (pergs[x.item.raridade] || 0) + 1; });
      var lp = Object.keys(pergs).map(function (r) { return pergs[r] + 'x Pergaminho para item ' + D.raridades[r].nome.toLowerCase(); }).join(' · ');
      var ef = e.efeitos || {};
      fim = e.fim === 'vitoria'
        ? '<div class="resultado vitoria-chefe"><h2>VITÓRIA!</h2><p>O grupo venceu ' + esc(m.mm.nome) + '.'
          + (totalDano ? '</p><p class="suave">Dano na masmorra: ' + run.herois.map(function (h, k) { return esc(h.dados.nome) + ' ' + Math.round(totalDano[k] || 0).toLocaleString('pt-BR'); }).join(' · ') + '.' : '')
          + (ef.corredores ? ' Corredores vencidos: ' + ef.corredores + '.' : '') + (ef.baus ? ' Baús: ' + ef.baus + '.' : '') + (ef.fontes ? ' Fontes: ' + ef.fontes + ' (−' + ef.fontes * -M.caminhos.fonte.dropPct + '% nos drops).' : '') + '</p>'
          + (meus.length ? '<h3>Seus prêmios</h3><div class="mas-premios">' + itens + '</div>' + (lp ? '<p>📜 ' + lp + '</p>' : '') : '<p class="suave">Sem prêmios desta vez.</p>')
          + '<p class="suave pequeno">Ao fechar, os itens vão para a mochila e os pergaminhos para os Consumíveis.</p>'
        : '<div class="resultado derrota"><h2>Derrota</h2><p>O grupo caiu em ' + esc(m.mm.nome) + '. Ninguém perdeu nada e a entrada não foi gasta.</p>';
      fim += '<div class="botoes"><button class="btn" data-acao="mas-fechar">' + (e.fim === 'vitoria' ? 'Guardar e voltar' : 'Voltar') + '</button></div></div>';
    }
    m.chave = chaveMas();
    return '<div class="mas-tela">' + fim + '<h3 class="subtitulo">' + esc(m.mm.nome) + '</h3><div class="mas-roteiro">' + roteiro + '</div>'
      + (rp ? arenaReplayHtml(rp) : '<div class="mas-grupo mas-grupo-linha">' + herois + '</div>') + voto
      + (m.erro ? '<p class="aviso-nivel">' + esc(m.erro) + '</p>' : '')
      + '<div class="mas-diario">' + diario + '</div></div>';
  }

  function seloMasmorra() {
    var g = estado.gm;
    var n = g && g.convites ? g.convites.length : 0;
    return n ? ' <span class="selo-pedidos">' + n + '</span>' : '';
  }

  var torreAvisadas = {};
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
      if (grupoUI.el) desenharGrupo();
      // Torre: grupo de 4 e alguém começou a subida fora da aba: avisa e leva para a Torre (fora de luta).
      if (g.grupo && g.grupo.membros.length === D.TORRE.grupo && estado.aba !== 'torre' && abaVisivel('torre')) {
        C.torre.estado(p.id).then(function (st) {
          var rt = st && st.run;
          if (!rt || rt.estado !== 'andamento' || torreAvisadas[rt.id] || estado.personagem !== p) return;
          torreAvisadas[rt.id] = true; torreEst().st = st;
          avisar('🗼 Seu grupo está subindo a Torre do Eclipse!', 'nivel');
          if (!estado.luta && !estado.batalha && !estado.lutaArena && !estado.resultado) { estado.aba = 'torre'; telaJogo(); }
        }, function () {});
      }
      var run = g.run;
      // Masmorra com caminhos: abre a tela enquanto ela estiver andando (ou acabou de terminar).
      if (run && run.etapa && !masFechadas[run.id] && !estado.luta && !estado.batalha && (run.estado === 'andamento' || C.agora() - Date.parse(run.criado_em) < 600000)) {
        abrirMasmorra(run);
        return;
      }
      // Luta nova do grupo (começou há menos de 3 minutos): todos assistem.
      if (run && !run.etapa && !vistas[run.id] && !estado.luta && !estado.batalha && C.agora() - Date.parse(run.criado_em) < 180000) {
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
    var l = lista || (estado.gm && estado.gm.recompensas);
    if (!l || !l.length) return;
    if (ACAO_SERVIDOR) return receberPendentes();   // o servidor lê a lista do banco e entrega
    return resgatarRecompensasAntigo(lista);
  }
  async function resgatarRecompensasAntigo(lista) {
    // os prêmios recebidos também ficam na caixa de entrada (origem da recompensa)
    var avisarCaixa = function (msg, tipo) { avisar(msg, tipo); caixaRegistrar(origemCaixa(rec && rec.origem), msg); };
    // Masmorra e pergaminhos ganhos: só no sininho, não na caixa de entrada (pedido do Henri, 16/11/2026).
    var avisarSemMasmorra = function (msg, tipo) { if (origemCaixa(rec && rec.origem) === 'masmorra') avisar(msg, tipo); else avisarCaixa(msg, tipo); };
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
            + expPct(estado.personagem, ganhoBoss.exp) + ' de exp!', 'vitoria');
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
          avisar((nPerg > 1 ? nPerg + ' Pergaminhos' : 'Um Pergaminho') + ' para item ' + ITEM_RARIDADE[perg.raridade]
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
          avisarCaixa('Boss do clã derrotado! +' + expPct(p, xp) + ' de exp.' + (subiu ? ' Você subiu de level!' : ''), 'nivel');
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
          if (!avisouCheia) avisarSemMasmorra('Mochila cheia! Seu item (' + ({ boss: 'Chefe Mundial', mercado: 'mercado', oficina: 'Oficina' }[rec.origem] || 'masmorra') + ') está guardado: libere espaço para recebê-lo.');
          avisouCheia = true;
          continue;
        }
        var bruto = await pegar(rec);
        var item = bruto && bruto.tipo === 'boss_item' ? R.itemDoChefeMundial(p, bruto.raridade) : R.completarItem(p, bruto);
        p.inventario.push(item);
        salvar();
        avisarSemMasmorra((rec.origem === 'mercado' ? 'Chegou do mercado: ' : rec.origem === 'oficina' ? 'A Oficina devolveu: ' : 'Você ganhou ') + R.nomeItem(item) + ' (' + nomeRaridadeItem(item) + ')!');
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
      if (run.etapa) { abrirMasmorra(run); return; }
      var sim = R.simularMasmorra(run.herois.map(function (h) { return h.dados; }), run.masmorra, run.semente);
      // O líder já registra o resultado (vale mesmo se fechar a página no meio da luta).
      registrarMasmorra(run, sim).catch(function (e) { avisar('Erro ao registrar o resultado: ' + e.message); });
      assistirLuta(run, sim);
    } catch (e) {
      avisar(e.message);
      botao.disabled = false;
    }
  }

  // Quem decide o resultado é o servidor (refaz a luta com a mesma semente); o jeito antigo só sem a função `acao`.
  function registrarMasmorra(run, sim) {
    var p = estado.personagem;
    if (!ACAO_SERVIDOR) return C.grupo.concluir(p.id, run.id, sim.vitoria);
    return C.acao(p.id, 'masmorraConcluir', { run: run.id }).then(function (r) { if (r && r.erro) throw new Error(r.erro); return r; });
  }

  function assistirLuta(run, sim) {
    vistas[run.id] = true;
    sim = sim || R.simularMasmorra(run.herois.map(function (h) { return h.dados; }), run.masmorra, run.semente);
    // Luta da fila: qualquer jogador registra o resultado (o primeiro vale; os outros recebem "já terminou").
    if (run.fila && run.estado === 'andamento') registrarMasmorra(run, sim).catch(function () {});
    // Missão: cada masmorra vencida conta uma vez por personagem.
    var mis = R.garantirMissoes(estado.personagem, C.agora());
    if (sim.vitoria && mis.runs.indexOf(String(run.id)) < 0 && mis.runs.indexOf(run.id) < 0) {
      mis.runs = mis.runs.concat(String(run.id)).slice(-20);
      R.registrarMissao(estado.personagem, 'masmorra', 1, C.agora());
      missaoCla('masmorra', 1);
      if (R.registrarHistoria(estado.personagem, 'masmorra', run.masmorra)) avisoHistoria();
      acaoServidor('eventoJogo', { tipo: 'masmorra', vitoria: true, alvo: run.masmorra, run: String(run.id) });
    }
    estado.luta = {
      run: run, sim: sim, mm: R.masmorra(run.masmorra), idx: 0, sala: 0, fim: false, rapido: false, registro: [],
      hpH: sim.inicio.herois.map(function (h) { return h.hpMax; }),
      hpM: sim.inicio.salas[0].map(function (m) { return m.hpMax; }),
      // Toda luta dura no máximo uns 75 segundos na velocidade normal.
      atraso: Math.max(30, Math.min(350, Math.round(75000 / Math.max(1, sim.eventos.length)))),
      // começou no servidor em criado_em: recarregando a página, a luta segue do ponto certo
      acum: Math.max(0, C.agora() - Date.parse(run.criado_em)) || 0,
    };
    estado.luta.registro.push('<p class="destaque">O grupo entra em ' + esc(estado.luta.mm.nome) + '!</p>');
    estado.chefeAviso = null;
    telaJogo();
    mostrarPainel();
    agendarLuta();
  }

  // A luta da masmorra/boss do clã anda pelo relógio, como a caçada (Henri, nov/2026): se o jogador troca de aba/app
  // (o navegador quase para os timers) ou recarrega a página, ela continua de onde devia estar. `L.acum` = tempo de
  // luta já "passado" (em ms de velocidade normal); cada evento vale `L.atraso`.
  function relogioLuta(L) {
    var agora = Date.now();
    if (L.ultimo == null) L.ultimo = agora;
    L.acum = (L.acum || 0) + (agora - L.ultimo) * (L.rapido ? 2 : 1);   // Daniel: acelerar é 2x (era 4x)
    L.ultimo = agora;
    var alvo = Math.floor(L.acum / L.atraso), andou = false;
    while (!L.fim && L.idx < alvo) { passoLuta(L.idx < alvo - 1); andou = true; }
    if (!L.fim && L.idx >= L.sim.eventos.length && L.idx <= alvo) { passoLuta(false); andou = true; }
    return andou;
  }
  function agendarLuta() {
    var L = estado.luta;
    if (!L || L.fim) return;
    clearTimeout(L.timer);
    L.timer = setTimeout(function () {
      if (estado.luta !== L) return;
      if (relogioLuta(L)) redesenharLuta();
      agendarLuta();
    }, L.rapido ? Math.max(10, Math.round(L.atraso / 2)) : L.atraso);
  }
  document.addEventListener('visibilitychange', function () {
    var L = estado.luta;
    if (document.hidden || !L || L.fim || !L.sim) return;
    if (relogioLuta(L)) redesenharLuta();   // voltou para o jogo: a luta já está onde devia
    agendarLuta();
  });

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
      + (L.fim ? '' : '<div class="botoes">' + botaoX2('luta-velocidade', L.rapido) + '</div>');
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
    acaoServidor('verificarGuia');   // o servidor confere o mesmo passo (e dá o presente do fim)
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
    return e && !e.fim && e.liberado && e.completo ? ' <span class="selo-pedidos">!</span>' : '';   // a História começa sozinha (22/11/2026)
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
    if (o.tipo === 'monstro') return 'Vença ' + o.qtd + 'x ' + esc(D.monstros[o.monstro].nome);
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
        : e.completo ? '<button class="btn hist-concluir" data-acao="historia-concluir">Concluir capítulo e receber o prêmio</button>'
        : '<button class="btn secundario" data-acao="historia-ver">📜 ' + (e.visto ? 'Reler' : 'Ler') + ' a abertura do capítulo</button>';
      corpo = '<div class="hist-capitulo"><div class="suave pequeno">Capítulo ' + (e.indice + 1) + ' de ' + e.total + ' · ' + nomeArea(c.area) + '</div>'
        + '<h3>' + c.titulo + '</h3>'
        + falaHtml(c.abertura[c.abertura.length - 1])
        + (e.liberado ? '<h4>Objetivos</h4><ul class="hist-objetivos">' + objetivos + '</ul>' : '')
        + '<p class="suave pequeno">Prêmio: ' + R.premioHistoriaTexto(p, c.premio || {}, c) + '</p>'
        + '<div class="botoes">' + acao + '</div></div>';
    }
    var lidos = (h.lidos || []).map(function (id) {
      var i = H.capitulos.map(function (c) { return c.id; }).indexOf(id), c = H.capitulos[i];
      return c ? '<button class="btn secundario btn-mini" data-acao="historia-reler" data-valor="' + i + '">' + (i + 1) + '. ' + c.titulo + '</button>' : '';
    }).join('');
    return topo + corpo + (lidos ? '<h3 class="subtitulo">Capítulos concluídos</h3><div class="hist-lidos">' + lidos + '</div>' : '')
      + '<p class="suave pequeno">Cada capítulo libera a região seguinte para caçar: sem concluir a História da região, não dá para avançar. Os objetivos só contam no capítulo atual.</p>';
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

  // ---------- Torre do Eclipse (Daniel, nov/2026): tela (etapa 3) ----------
  // estado.torre = { st: torre_estado (run, recorde, agora), dif: relógio do servidor − daqui, esc: escolha em montagem,
  //   narr: { chave, inicio } (narração do turno), timer }. O turno é resolvido pelo servidor (torreAvancar).
  var TR_ = D.TORRE;
  function torreEst() { return estado.torre || (estado.torre = { st: null, esc: null, narr: null }); }
  function agoraServ() { return Date.now() + (torreEst().dif || 0); }
  function runTorre() { var s = torreEst().st; return s && s.run; }
  function torreAndando() { var r = runTorre(); return !!(r && r.estado === 'andamento'); }
  function carregarTorre() {
    var p = estado.personagem, T = torreEst();
    if (!p || T.carregando) return Promise.resolve();
    T.carregando = true;
    return C.torre.estado(p.id).then(function (st) {
      T.carregando = false; T.erro = null;
      if (estado.personagem !== p) return;
      T.st = st; if (st && st.agora) T.dif = st.agora - Date.now();
      return avancarTorreSePreciso();
    }, function (e) { T.carregando = false; T.erro = e.message; }).then(function () { redesenharTorre(); autoTorre(); agendarTorre(); });
  }
  // Pede ao servidor para andar: monta o andar, resolve o turno (todos escolheram ou acabou o prazo) ou sai da narração.
  function avancarTorreSePreciso() {
    var r = runTorre(), p = estado.personagem;
    if (!r || r.estado !== 'andamento') return Promise.resolve();
    var t = r.torre, agora = agoraServ(), precisa = !t;
    if (t && t.fase === 'narrando') precisa = agora >= r.prazo;
    if (t && t.fase === 'escolha') {
      var vivos = t.herois.filter(function (h) { return h.hp > 0; });
      precisa = agora >= r.prazo || vivos.every(function (h) { return r.escolhas && r.escolhas[h.id]; });
    }
    if (!precisa) return Promise.resolve();
    return C.acao(p.id, 'torreAvancar', { run: r.id }).then(function (x) {
      var res = x && x.resultado;
      if (!res) return;
      var antes = r.torre;
      Object.assign(r, res);
      if (res.agora) torreEst().dif = res.agora - Date.now();
      // andar vencido: busca os prêmios logo
      if (antes && antes.fase === 'escolha' && r.torre && r.torre.fim === 'vitoria' && ACAO_SERVIDOR) setTimeout(receberPendentes, 2500);
    }, function () {});
  }
  function agendarTorre() {
    var T = torreEst();
    clearTimeout(T.timer);
    if (estado.aba !== 'torre' || !estado.personagem) return;
    var r = runTorre(), espera = 5000;
    if (torreAndando()) espera = r.torre && r.prazo ? Math.max(300, Math.min(1500, r.prazo - agoraServ() + 150)) : 800;
    T.timer = setTimeout(carregarTorre, espera);
  }
  // Só redesenha quando algo mudou (sem piscar as imagens); o relógio e a narração andam pelo pulso (250 ms).
  function assinaturaTorre() {
    var T = torreEst(), st = T.st, r = st && st.run, g = estado.gm && estado.gm.grupo;
    return JSON.stringify([st ? 1 : 0, T.erro, torreAuto(), r && [r.id, r.versao, r.estado, r.escolhas, r.torre && r.torre.fase], T.esc, estado.torreDesistir,
      st && st.recorde, g && g.membros.map(function (m) { return m.id + (m.pronto ? 1 : 0) + ':' + m.posicao; })]);
  }
  // Toque num botão da ação: só troca a marcação (sem redesenhar a tela inteira).
  function marcarEscolhaTorre() {
    var caixa = document.getElementById('torre'), e = torreEst().esc;
    if (!caixa || !e) return;
    caixa.querySelectorAll('[data-acao="torre-acao"]').forEach(function (b) { b.classList.toggle('sel', b.dataset.valor === e.acao && (e.acao !== 'habilidade' || b.dataset.hab === e.hab)); });
    caixa.querySelectorAll('[data-acao="torre-alvo"]').forEach(function (b) { b.classList.toggle('sel', Number(b.dataset.valor) === e.alvo); });
    caixa.querySelectorAll('[data-acao="torre-ordem"]').forEach(function (b) { b.classList.toggle('sel', Number(b.dataset.valor) === e.ordem); });
    var alvos = caixa.querySelector('.torre-alvos');
    if (alvos) alvos.hidden = !(e.acao === 'atacar' || e.acao === 'habilidade');
    torreEst().sig = assinaturaTorre();   // a escolha já está na tela
  }
  function redesenharTorre(forcar) {
    var caixa = document.getElementById('torre'), T = torreEst();
    if (!caixa) return;
    // dedo na tela: espera soltar para não trocar o botão no meio do toque
    if (T.apertado) { T.pendente = true; if (forcar) T.pendenteForcar = true; return; }
    var sig = assinaturaTorre();
    if (!forcar && sig === T.sig) { pulsoTorre(); return; }
    T.sig = sig;
    caixa.innerHTML = torreConteudo();
    pulsoTorre();
  }
  function pulsoTorre() {
    var caixa = document.getElementById('torre'), T = torreEst(), r = runTorre();
    if (!caixa) { clearInterval(T.pulso); T.pulso = null; return; }
    var rel = caixa.querySelector('.torre-relogio');
    if (rel && r) { var resta = Math.max(0, Math.ceil((r.prazo - agoraServ()) / 1000)); rel.textContent = resta + 's'; rel.classList.toggle('fim', resta <= 5); }
    var linhas = caixa.querySelectorAll('.torre-narracao p.oculta');
    if (linhas.length && T.narr) {
      var N = TR_.narracao, n = 1 + Math.floor((Date.now() - T.narr.inicio) / N.porLinha), mudou = false;
      linhas.forEach(function (l) { var li = Number(l.dataset.i); if (li < n) { l.classList.remove('oculta'); mudou = true; if (r && r.torre && r.torre.log && r.torre.log[li]) efeitoCenaTorre(caixa, r.torre.log[li]); } });
      var reg = caixa.querySelector('.torre-narracao');
      if (mudou && reg) reg.scrollTop = reg.scrollHeight;
      if (mudou && r && r.torre && r.torre.log) {
        var vis = Math.min(r.torre.log.length, n), ev = r.torre.log[vis - 1];
        if (vis >= r.torre.log.length) ev = { hp: r.torre.herois.map(function (h) { return h.hp; }), hpI: r.torre.inimigos.map(function (m) { return m.hp; }) };
        if (ev && ev.hp && ev.hpI) atualizarBarrasTorre(caixa, ev);
      }
    }
  }
  document.addEventListener('pointerdown', function (ev) {
    if (ev.target.closest && ev.target.closest('#torre')) torreEst().apertado = true;
  }, true);
  ['pointerup', 'pointercancel'].forEach(function (tipo) {
    document.addEventListener(tipo, function () {
      var T = torreEst();
      if (!T.apertado) return;
      setTimeout(function () { T.apertado = false; if (T.pendente) { var f = T.pendenteForcar; T.pendente = false; T.pendenteForcar = false; redesenharTorre(f); } }, 120);
    }, true);
  });
  // Dica dos botões da Torre: parar o mouse ~1,5 s em cima (ou segurar o dedo) mostra o que a habilidade faz.
  var dicaTorre = { timer: null, el: null };
  function mostrarDica(btn) {
    esconderDica();
    var d = document.createElement('div'); d.className = 'dica-torre'; d.innerHTML = btn.dataset.dica; document.body.appendChild(d);
    var r = btn.getBoundingClientRect(), w = d.offsetWidth, x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    var y = r.top - d.offsetHeight - 8; if (y < 8) y = r.bottom + 8;
    d.style.left = x + 'px'; d.style.top = y + 'px'; dicaTorre.el = d;
  }
  function esconderDica() { clearTimeout(dicaTorre.timer); if (dicaTorre.el) { dicaTorre.el.remove(); dicaTorre.el = null; } }
  document.addEventListener('mouseover', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-dica]');
    if (!b) return;
    if (b.contains(ev.relatedTarget)) return;
    esconderDica(); dicaTorre.timer = setTimeout(function () { if (document.body.contains(b)) mostrarDica(b); }, 1500);
  });
  document.addEventListener('mouseout', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-dica]');
    if (b && !b.contains(ev.relatedTarget)) esconderDica();
  });
  document.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType === 'mouse') { esconderDica(); return; }
    var b = ev.target.closest && ev.target.closest('[data-dica]');
    esconderDica();
    if (b) dicaTorre.timer = setTimeout(function () { mostrarDica(b); setTimeout(esconderDica, 3500); }, 550);
  });
  ['pointerup', 'pointercancel'].forEach(function (tipo) { document.addEventListener(tipo, function (ev) { if (ev.pointerType !== 'mouse' && !dicaTorre.el) clearTimeout(dicaTorre.timer); }); });
  function abaTorre() {
    var T = torreEst();
    setTimeout(function () { if (!T.st) carregarTorre(); else agendarTorre(); }, 0);
    clearInterval(T.pulso); T.pulso = setInterval(pulsoTorre, 250);
    T.sig = assinaturaTorre();
    return '<section class="caixa torre" id="torre">' + torreConteudo() + '</section>';
  }
  function vidaBarra(hp, max, cls, chave) {
    var pc = Math.max(0, Math.min(100, Math.round(hp * 100 / Math.max(1, max))));
    return '<div class="torre-vida ' + (cls || '') + '"' + (chave ? ' data-vida="' + chave + '" data-max="' + max + '"' : '') + '><i style="width:' + pc + '%"></i><span>'
      + Number(Math.max(0, hp)).toLocaleString('pt-BR') + ' / ' + Number(max).toLocaleString('pt-BR') + '</span></div>';
  }
  // Durante a narração, a vida mostrada é a da última linha já contada (cada linha guarda a vida de todos naquele momento).
  function vidaNaNarracao(t, n) {
    var log = t.log || [];
    if (!log.length || n >= log.length) return null;
    var ev = log[Math.max(0, n - 1)];
    return ev && ev.hp && ev.hpI ? ev : null;
  }
  function atualizarBarrasTorre(caixa, ev) {
    caixa.querySelectorAll('.torre-vida[data-vida]').forEach(function (b) {
      var k = b.dataset.vida, idx = Number(k.slice(1)), hp = k[0] === 'h' ? ev.hp[idx] : ev.hpI[idx], max = Number(b.dataset.max);
      if (hp == null) return;
      b.querySelector('i').style.width = Math.max(0, Math.min(100, Math.round(hp * 100 / Math.max(1, max)))) + '%';
      b.querySelector('span').textContent = Number(Math.max(0, hp)).toLocaleString('pt-BR') + ' / ' + max.toLocaleString('pt-BR');
    });
  }
  var ICO_ACAO = { atacar: '⚔', habilidade: '✨', desviar: '💨', pocao: '🧪' };
  // Uma cor para cada jogador (posição no grupo): cartão, narração e prêmios.
  var CORES_TORRE = ['#f0c56a', '#6fb7ff', '#7fdc94', '#e88ae8'];
  function torreAuto() { try { return localStorage.getItem('eldrin.torreAuto') === '1'; } catch (e) { return false; } }
  function torreAutoMudar(v) { try { localStorage.setItem('eldrin.torreAuto', v ? '1' : '0'); } catch (e) { /* sem armazenamento */ } }
  // Ordens já tomadas pelos outros: { 2: 'Lyra', ... }
  function ordensTomadas(r, meuId) {
    var t = r.torre, x = {};
    Object.keys(r.escolhas || {}).forEach(function (id) {
      if (id === meuId) return;
      var h = t.herois.filter(function (y) { return y.id === id; })[0];
      x[r.escolhas[id].ordem] = h ? h.nome : '?';
    });
    return x;
  }
  function ordemLivre(r, meuId, quer) {
    var tom = ordensTomadas(r, meuId);
    if (!tom[quer]) return quer;
    for (var o = 1; o <= 4; o++) if (!tom[o]) return o;
    return quer;
  }
  // Automático: escolhe sozinho (a mesma lógica dos bots) assim que abre a escolha.
  function autoTorre() {
    var p = estado.personagem, r = runTorre(), T = torreEst();
    if (!torreAuto() || !r || r.estado !== 'andamento' || !r.torre || r.torre.fase !== 'escolha') return;
    var t = r.torre, i = t.herois.map(function (h) { return h.id; }).indexOf(p.id);
    if (i < 0 || t.herois[i].hp <= 0 || (r.escolhas && r.escolhas[p.id])) return;
    var chave = r.id + ':' + t.andar + ':' + t.turno;
    if (T.autoFeito === chave) return;
    T.autoFeito = chave;
    var e = R.escolhaAutoTorre(t, i);
    e.ordem = ordemLivre(r, p.id, e.ordem || 4);
    T.esc = { acao: e.acao, hab: e.hab || null, alvo: e.alvo || 0, ordem: e.ordem };
    torreConfirmar();
  }
  // Pinta os nomes dos heróis na narração com a cor de cada um.
  function pintarNomes(texto, herois) {
    var h = esc(texto);
    herois.forEach(function (x, i) {
      var n = esc(x.nome);
      if (n) h = h.split(n).join('<b style="color:' + CORES_TORRE[i % 4] + '">' + n + '</b>');
    });
    return h;
  }
  function torreConteudo() {
    var p = estado.personagem, T = torreEst(), st = T.st;
    if (!st) return '<p class="suave">' + (T.erro ? esc(T.erro) : 'Abrindo os portões da Torre…') + '</p>';
    if (st.local) return '<p class="suave">A Torre é em grupo de 4 e precisa do servidor: jogue pelo site do ' + D.NOME_JOGO + '.</p>';
    var r = st.run;
    if (r && r.torre && (r.estado === 'andamento' || r.torre.fim)) return torreLuta(r);
    return torreSaguao(st);
  }
  function torreSaguao(st) {
    var p = estado.personagem, g = estado.gm, rec = st.recorde || { melhor: 0, semana: 0 };
    if (!g) carregarGrupo();
    var h = '<div class="torre-topo"><img src="assets/monstros/guardiao-da-torre-pesadelo.jpg" alt=""><div><h3 class="subtitulo">🗼 ' + TR_.nome + '</h3>'
      + '<p class="suave pequeno">Torre sem fim para um grupo de ' + TR_.grupo + '. Cada andar é uma luta por turnos: os ' + TR_.grupo + ' escolhem juntos, '
      + 'o chefe avisa os golpes fortes antes. A cada ' + TR_.chefeCada + ' andares, um chefe. Ilimitada: suba quantas vezes quiser.</p>'
      + '<div class="torre-recordes"><span>Seu recorde <b>' + rec.melhor + '</b></span><span>Esta semana <b>' + rec.semana + '</b></span></div></div></div>';
    h += '<details class="regras-celular torre-regras"' + (CELULAR ? '' : ' open') + '><summary>Como funciona</summary><ul>'
      + '<li><b>⚔ Atacar</b>, <b>✨ Habilidade</b> (com recarga), <b>💨 Desviar</b> (só do golpe avisado; chance pelo seu maior atributo) ou <b>🧪 Poção</b>.</li>'
      + '<li>Cada um escolhe a <b>ordem</b> (1º a 4º): o tanque provoca primeiro, o curandeiro cura por último.</li>'
      + '<li>⚠ Quando o chefe avisa um golpe, <b>desvie</b> ou use um <b>stun</b> logo antes: o chefe atordoado perde o golpe.</li>'
      + '<li>Os efeitos (stun, corte de cura...) pegam com <b>100% − a resistência</b> do inimigo, que sobe a cada andar.</li>'
      + '<li>Salva andar por andar: a subida começa depois do <b>menor recorde</b> do grupo.</li>'
      + '<li><b>Prêmios por andar:</b> andar novo = ouro e EXP (' + TR_.premios.base.toLocaleString('pt-BR') + ' no andar 1, +' + TR_.premios.porAndar.toLocaleString('pt-BR')
      + ' por andar); pergaminho nos andares 5, 15, 25…; andar repetido = ' + TR_.premios.repetidoPct + '% do ouro e da EXP.</li></ul></details>';
    var r = st.run;
    if (r && r.estado !== 'andamento' && r.torre) h += '<p class="aviso-nivel">Última subida: o grupo chegou ao andar <b>' + r.torre.andar + '</b>.</p>';
    if (!g) return h + '<p class="suave">Carregando o grupo…</p>';
    var gr = g.grupo;
    if (!gr) return h + '<div class="secao"><p>Você precisa de um <b>grupo de ' + TR_.grupo + '</b>. Na aba <b>Social</b>, use <b>"Convidar para o grupo"</b> nos seus amigos '
      + '(level ' + TR_.nivelMin + '+). Quem convida vira o líder 👑.</p>'
      + (ehAdmin() ? gradeFormacao({ membros: [Object.assign({}, p, { posicao: estado.torreCasaSolo })] }, p)
        + '<div class="botoes"><button class="btn" data-acao="torre-subir">🗼 Subir sozinho (teste do admin)</button></div>' : '') + '</div>';
    var souLider = gr.lider === p.id, eu = gr.membros.filter(function (m) { return m.id === p.id; })[0] || {};
    h += '<h3 class="subtitulo">Seu grupo (' + gr.membros.length + '/' + TR_.grupo + ')</h3><div class="torre-grupo">' + gr.membros.map(function (m) {
      return '<div class="torre-membro' + (m.pronto ? ' pronto' : '') + '"><div class="moldura">' + F.personagem(m.raca, classeRetrato(m), m.sexo) + '</div>'
        + '<strong>' + (m.id === gr.lider ? '👑 ' : '') + esc(m.nome) + '</strong><span class="suave pequeno">' + nomeClasseX(m) + ' · Lv ' + m.nivel + '</span>'
        + '<span class="pequeno ' + (m.pronto ? 'online' : 'suave') + '">' + (m.pronto ? '✔ Pronto' : 'Aguardando') + '</span>'
        + (m.nivel < TR_.nivelMin ? '<span class="menos pequeno">Precisa do level ' + TR_.nivelMin + '</span>' : '') + '</div>';
    }).join('') + '</div>';
    if (gr.membros.length < TR_.grupo) h += '<p class="suave pequeno">Faltam ' + (TR_.grupo - gr.membros.length) + ': convide pela aba Social.</p>';
    h += gradeFormacao(gr, p);
    h += '<div class="botoes">' + (eu.pronto ? '<button class="btn secundario" data-acao="grupo-pronto" data-valor="nao">Não estou pronto</button>'
        : '<button class="btn" data-acao="grupo-pronto" data-valor="sim">Estou pronto</button>')
      + (souLider ? '<button class="btn" data-acao="torre-subir"' + (gr.membros.length !== TR_.grupo && !ehAdmin() ? ' disabled' : '') + '>🗼 Subir a Torre'
        + (gr.membros.length !== TR_.grupo && ehAdmin() ? ' (teste do admin, ' + gr.membros.length + ')' : '') + '</button>' : '<span class="suave pequeno">O líder começa a subida.</span>')
      + '</div>';
    return h;
  }
  // Formação: grade de hexágonos 2-3-2. Toque numa casa livre para pôr seu herói; toque na sua para tirar.
  function gradeFormacao(gr, p) {
    var F = TR_.formacao, dono = {};
    gr.membros.forEach(function (m, i) { if (typeof m.posicao === 'number') dono[m.posicao] = { m: m, cor: CORES_TORRE[i % 4] }; });
    var h = '<h3 class="subtitulo">Formação</h3><p class="suave pequeno">Toque numa casa para pôr seu herói. O golpe normal do chefe só pega a fileira da <b>frente</b> (a de cima) '
      + '(se ela cair, o meio, depois trás). Quem está atrás só leva <b>dano em área</b>. Quem não escolher, o jogo põe sozinho (mais defesa na frente).</p><div class="torre-grade">';
    F.fileiras.forEach(function (casas, f) {
      h += '<div class="torre-fileira"><div class="torre-hexes">' + casas.map(function (c) {
        var d = dono[c], minha = d && d.m.id === p.id;
        return '<button class="torre-hex' + (d ? ' ocupada' : '') + (minha ? ' minha' : '') + '" data-acao="torre-casa" data-valor="' + c + '"' + (d && !minha ? ' disabled' : '')
          + (d ? ' style="--cor:' + d.cor + '"' : '') + ' title="' + (d ? esc(d.m.nome) : 'Casa livre') + '">'
          + (d ? '<span class="torre-hex-rosto">' + F_personagemMini(d.m) + '</span><small>' + esc(d.m.nome) + '</small>' : '<span class="torre-hex-livre">+</span>') + '</button>';
      }).join('') + '</div></div>';
    });
    return h + '</div>';
  }
  function F_personagemMini(m) { return F.personagem(m.raca, classeRetrato(m), m.sexo); }
  // Ícones das habilidades dos chefes (assets/torre/mecanicas/<id>.webp). Sem a arte, mostra o emoji.
  var EMOJI_MEC = { mortal: '⚔', chuva: '☄', marca: '💀', escudo: '🦴', invocar: '🌀', pele: '🪨', teia: '🕸', eclipse: '🌑', espelho: '🪞',
    drenar: '🩸', silencio: '🔇', lentidao: '🐌', carregar: '⚡', iniciativa: '⏩', selo: '🔒', parasita: '🦠', corrupcao: '☠', camadas: '🔰',
    vinculo: '🔗', colapso: '💀', despertar: '🔥', rapido: '💨', area: '💥', resistencia: '🛡', furia: '😡' };
  var DICA_MEC = { despertar: 'Abaixo de ' + TR_.despertar.vidaPct + '% da vida, bate ' + TR_.despertar.danoPct + '% mais forte.',
    rapido: 'Mais chance de agir antes do grupo (+' + TR_.velocidade.rapido + '%).', area: 'O golpe normal pega o grupo todo (' + TR_.golpeAreaPct + '% em cada um).',
    resistencia: 'Chance de resistir a stun e outros efeitos. Cada stun que pega deixa ele +' + TR_.resistencia.porStun + '% resistente.',
    furia: 'Depois do turno ' + TR_.furia.desde + ', bate ' + TR_.furia.porTurno + '% mais forte a cada turno.',
    colapso: 'Falso Colapso: ao cair pela 1ª vez, levanta com ' + TR_.colapso.vidaPct + '% da vida, limpa os efeitos e passa a bater em área.' };
  function dicaMec(id) {
    var M = TR_.mecanicas[id];
    return '<strong>' + (M ? M.nome : ({ despertar: 'Despertar', rapido: 'Rápido', area: 'Golpe em área', resistencia: 'Resistência', furia: 'Fúria', colapso: 'Falso Colapso' })[id] || id) + '</strong>'
      + '<span>' + (M ? M.texto.replace(/\{alvo\}/g, 'um herói') + (M.turnos ? '. Aviso ' + M.turnos + ' turno' + (M.turnos > 1 ? 's' : '') + ' antes.' : '') : DICA_MEC[id] || '') + '</span>';
  }
  var mecSemIcone = {};
  function icoMec(id, cls) {
    var dica = cls === 'cena-sabe' ? ' data-dica="' + esc(dicaMec(id)) + '"' : '';
    if (mecSemIcone[id]) return '<span class="mec-ico mec-emoji' + (cls ? ' ' + cls : '') + '"' + dica + '>' + (EMOJI_MEC[id] || '•') + '</span>';
    return '<img class="mec-ico' + (cls ? ' ' + cls : '') + '" data-mec="' + id + '" src="assets/torre/mecanicas/' + id + '.webp" alt="' + (EMOJI_MEC[id] || '•') + '"'
      + dica + '>';
  }
  function textoAviso(t, a) {
    var M = TR_.mecanicas[a.mec], quem = a.alvo != null && t.herois[a.alvo] ? ' em ' + esc(t.herois[a.alvo].nome) : '';
    return icoMec(a.mec, 'aviso-ico') + '<b>' + M.nome + '</b>' + quem + ' — ' + (a.em <= 1 ? '<b>NESTE TURNO!</b>' : 'em ' + a.em + ' turnos');
  }
  function torreLuta(r) {
    var p = estado.personagem, T = torreEst(), t = r.torre, eu = t.herois.map(function (h) { return h.id; }).indexOf(p.id), me = t.herois[eu];
    var agora = agoraServ(), resta = Math.max(0, Math.ceil((r.prazo - agora) / 1000));
    // A narração segue o relógio da tela: se o servidor já passou para a escolha antes de a tela terminar de contar,
    // continua contando (senão a vida pulava para o fim antes das linhas dos golpes).
    var lg = t.log || [], sigLog = lg.length + ':' + (lg[0] ? lg[0].t : '') + ':' + (lg.length ? lg[lg.length - 1].t : '');
    if (t.fase === 'narrando' && (!T.narr || T.narr.chave !== sigLog)) T.narr = { chave: sigLog, inicio: Date.now() };
    var nVis = T.narr && T.narr.chave === sigLog && r.estado === 'andamento' ? Math.min(lg.length, 1 + Math.floor((Date.now() - T.narr.inicio) / TR_.narracao.porLinha)) : lg.length;
    var vn = vidaNaNarracao(t, nVis);
    var chefe = R.ehChefeTorre(t.andar);
    var h = '<div class="torre-cab"><div><small>' + TR_.nome + '</small><strong>Andar ' + t.andar + (chefe ? ' · Chefe' : '') + '</strong></div>'
      + '<div class="torre-turno">Turno ' + (t.turno + (t.fase === 'escolha' ? 1 : 0)) + (t.fase === 'escolha' && r.estado === 'andamento' ? '<b class="torre-relogio' + (resta <= 5 ? ' fim' : '') + '">' + resta + 's</b>' : '') + '</div></div>';
    h += cenaTorre(r, t, vn);
    // narração do último turno (aparece uma linha por segundo)
    var log = t.log || [], n = nVis;
    if (log.length) h += '<div class="torre-narracao">' + log.map(function (ev, i) {
      return '<p data-i="' + i + '" class="' + (i >= n ? 'oculta ' : '') + (ev.premio ? 'n-premio' : ev.aviso ? 'n-aviso' : ev.mec ? 'n-mec' : ev.caiuH || ev.derrota ? 'n-ruim' : ev.vitoria || ev.caiu || ev.interrompeu || ev.desviou ? 'n-bom' : '') + '">' + pintarNomes(ev.t, t.herois) + '</p>';
    }).join('') + '</div>';
    // fim
    if (r.estado !== 'andamento' || t.fim === 'derrota') {
      return h + '<div class="resultado derrota"><h2>' + (r.estado === 'abandonada' ? 'Subida encerrada' : 'O grupo caiu') + '</h2><p>Vocês chegaram ao andar <b>' + t.andar
        + '</b>. Cada andar vencido ficou no recorde.</p><div class="botoes"><button class="btn" data-acao="torre-sair">Voltar</button></div></div>';
    }
    if (t.fase === 'narrando') return h + '<p class="suave torre-espera">' + (t.fim === 'vitoria' ? '🏆 Andar vencido! Subindo para o andar ' + (t.andar + 1) + '…' : 'O turno está acontecendo…') + '</p>' + torreDesistir(r);
    // escolha
    if (!me || me.hp <= 0) return h + '<p class="suave torre-espera">Você caiu neste andar. Volta no próximo, com a vida cheia.</p>' + torreDesistir(r);
    return h + torrePainel(r, t, me) + torreDesistir(r);
  }
  // Cena da luta: fundo da torre, inimigos em cima e o grupo embaixo na formação (hexágonos 2-3-2).
  function cenaTorre(r, t, vn) {
    var p = estado.personagem, vz = t.vezInimigos || 5, F = TR_.formacao;
    var hpI = function (i) { return vn && vn.hpI[i] != null ? vn.hpI[i] : t.inimigos[i].hp; };
    var hpH = function (i) { return vn && vn.hp[i] != null ? vn.hp[i] : t.herois[i].hp; };
    var h = '<div class="torre-cena">';
    // avisos
    h += '<div class="cena-avisos">' + (t.avisos || []).map(function (a) { return '<div class="torre-aviso' + (a.em <= 1 ? ' agora' : '') + '">⚠ ' + textoAviso(t, a) + '</div>'; }).join('') + '</div>';
    // inimigos: o principal grande no centro, lacaios menores dos lados
    var lista = t.inimigos.map(function (m, i) { return { m: m, i: i }; });
    var principal = lista.filter(function (x) { return x.m.chefe || x.m.tipo === 'elite'; })[0] || null;   // bando: todos do mesmo tamanho
    var lac = lista.filter(function (x) { return x !== principal; });
    var prox = t.turno + (t.fase === 'escolha' ? 1 : 0);
    var inimigo = function (x, grande) {
      var m = x.m, marcas = [];
      // vermelho = ruim para o inimigo (debuff); verde = bom para ele (buff)
      // [tipo, ícone (assets/torre/mecanicas/<id>.webp), texto]; vermelho = ruim para o inimigo, verde = bom para ele
      if (grande && m.res) marcas.push(['buff', 'resistencia', 'Resist. stun ' + Math.min(95, m.res.stun) + '%']);
      if (m.golpeArea) marcas.push(['buff', 'area', 'Golpe em área']);
      if (m.escudoOssos > 0) marcas.push(['buff', 'escudo', 'Barreira ' + Number(m.escudoOssos).toLocaleString('pt-BR')]);
      if (m.peleAte >= prox && m.hp > 0) marcas.push(['buff', 'pele', 'Pele de Pedra']);
      if (m.espelhoAte === prox && m.hp > 0) marcas.push(['buff', 'espelho', 'Espelho']);
      if (m.desperto) marcas.push(['buff', 'despertar', 'Desperto']);
      if (m.rapido) marcas.push(['buff', 'rapido', 'Rápido']);
      if (m.camadas > 0 && m.hp > 0) marcas.push(['buff', 'camadas', 'Camadas ' + m.camadas]);
      if (m.duasVezes === prox && m.hp > 0) marcas.push(['buff', 'iniciativa', 'Age 2x']);
      if (m.buffDano && m.buffDano.ate >= prox) marcas.push(['buff', 'parasita', '+' + m.buffDano.pct + '% dano']);
      if (m.fase2) marcas.push(['buff', 'colapso', 'Fase 2']);
      if (m.vinculo && m.vinculo.ate === prox && t.herois[m.vinculo.h]) marcas.push(['buff', 'vinculo', t.herois[m.vinculo.h].nome]);
      if (m.chefe && t.turno >= TR_.furia.desde) marcas.push(['buff', 'furia', 'Fúria']);
      if (m.atordoado > 0 && m.hp > 0) marcas.push(['debuff', null, '💫 Atordoado']);
      if (m.cortaCura && m.cortaCura.ate >= t.turno) marcas.push(['debuff', null, '🩸 Cura −' + m.cortaCura.pct + '%']);
      if (m.queima && m.queima.turnos > 0) marcas.push(['debuff', null, '🔥 Sangrando']);
      if (m.cego > 0) marcas.push(['debuff', null, '🌑 Cego']);
      if (m.defQuebra || m.quebraTemp) marcas.push(['debuff', null, '🛡 Defesa quebrada']);
      // as mecânicas que ele sabe usar (ícones pequenos, com a explicação ao parar o mouse)
      var sabe = grande && m.hp > 0 ? (m.mecanicas || []).map(function (id) { return icoMec(id, 'cena-sabe'); }).join('') : '';
      return '<div class="cena-inimigo' + (grande ? ' grande' : '') + (m.chefe ? ' chefe' : '') + (hpI(x.i) <= 0 ? ' caido' : '') + (m.atordoado > 0 ? ' tonto' : '') + '" data-alvo="i' + x.i + '">'
        + '<div class="cena-retrato">' + (m.imagem ? '<img src="' + m.imagem + '" alt=""' + (m.reserva ? ' data-reserva="' + m.reserva + '"' : '') + '>' : '') + (m.atordoado > 0 && m.hp > 0 ? '<span class="cena-tonto">💫</span>' : '') + '</div>'
        + '<strong>' + esc(m.nome) + (grande && m.chefe ? ' <small class="cena-tag">CHEFE</small>' : '') + '</strong>'
        + vidaBarra(hpI(x.i), m.hpMax, 'inimigo', 'i' + x.i)
        + (marcas.length ? '<div class="cena-marcas">' + marcas.map(function (k) {
          return '<span class="' + k[0] + '"' + (k[1] ? ' data-dica="' + esc(dicaMec(k[1])) + '"' : '') + '>' + (k[1] ? icoMec(k[1]) : '') + k[2] + '</span>';
        }).join('') + '</div>' : '') + (sabe ? '<div class="cena-sabe-lista" title="Habilidades dele">' + sabe + '</div>' : '') + '</div>';
    };
    h += '<div class="cena-inimigos">' + lac.slice(0, Math.ceil(lac.length / 2)).map(function (x) { return inimigo(x, false); }).join('')
      + (principal ? inimigo(principal, true) : '') + lac.slice(Math.ceil(lac.length / 2)).map(function (x) { return inimigo(x, false); }).join('') + '</div>';
    if (t.fase === 'escolha' && !t.fim) h += '<div class="cena-vez">' + (vz < 5 ? '⚡ Rápido: age antes do <b>' + vz + 'º</b>' : '🐢 Age por último') + '</div>';
    // grupo na formação
    var porCasa = {};
    t.herois.forEach(function (x, xi) { porCasa[typeof x.pos === 'number' ? x.pos : xi] = xi; });
    h += '<div class="cena-grupo">' + F.fileiras.map(function (casas, f) {
      return '<div class="cena-fileira"><div class="cena-casas">' + casas.map(function (c) {
        var xi = porCasa[c];
        if (xi == null) return '<div class="cena-casa vazia"><div class="cena-hex"></div></div>';
        var x = t.herois[xi], cor = CORES_TORRE[xi % 4], e = r.escolhas && r.escolhas[x.id], vivo = hpH(xi) > 0;
        var males = (x.presoAte === prox ? icoMec('teia') : '') + (x.cegoAte === prox ? icoMec('eclipse') : '') + (x.silencioAte === prox ? icoMec('silencio') : '')
          + (x.corrompidoDe <= prox && x.corrompidoAte >= prox ? icoMec('corrupcao') : '') + (t.inimigos.some(function (m) { return m.vinculo && m.vinculo.ate === prox && t.herois[m.vinculo.h] === x; }) ? icoMec('vinculo') : '');
        var estadoTxt = !vivo ? '<span class="menos">caído</span>' : males && t.fase === 'escolha' ? '<span class="menos" title="Preso / cego / em silêncio neste turno">' + males + '</span>' : t.fase === 'escolha' ? (e ? '<span class="online">✔ ' + ICO_ACAO[e.acao] + ' ' + e.ordem + 'º</span>' : '<span class="suave">…</span>') : '';
        return '<div class="cena-casa' + (vivo ? '' : ' caido') + (x.id === p.id ? ' eu' : '') + '" style="--cor:' + cor + '" data-alvo="h' + xi + '">'
          + '<div class="cena-hex"><span class="torre-hex-rosto">' + F_personagemMini(x) + '</span></div>'
          + '<div class="cena-info"><strong>' + esc(x.nome) + '</strong>' + vidaBarra(hpH(xi), x.hpMax, 'mini', 'h' + xi)
          + '<span class="cena-estado">🧪' + x.pocoes + (estadoTxt ? ' · ' + estadoTxt : '') + '</span></div></div>';
      }).join('') + '</div></div>';
    }).join('') + '</div></div>';
    return h;
  }
  // Arte própria da Torre ainda não feita: troca pela reserva (arte do jogo).
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img && img.tagName === 'IMG' && img.dataset && img.dataset.reserva && img.src.indexOf(img.dataset.reserva) < 0) { img.src = img.dataset.reserva; }
    if (img && img.tagName === 'IMG' && img.classList.contains('mec-ico')) {   // sem a arte do ícone: fica o emoji
      if (img.dataset.mec) mecSemIcone[img.dataset.mec] = true;
      var sp = document.createElement('span'); sp.className = img.className + ' mec-emoji'; sp.textContent = img.alt;
      if (img.dataset.dica) sp.dataset.dica = img.dataset.dica;
      img.replaceWith(sp);
    }
  }, true);
  // Durante a narração: número de dano/cura saltando sobre quem levou, e quem age dá um brilho.
  function efeitoCenaTorre(caixa, ev) {
    var num = function (chave, txt, cls) {
      var alvo = caixa.querySelector('[data-alvo="' + chave + '"]');
      if (!alvo) return;
      var n = document.createElement('span'); n.className = 'cena-num ' + cls; n.textContent = txt; alvo.appendChild(n);
      setTimeout(function () { n.remove(); }, 1300);
      if (cls.indexOf('dano') >= 0) { alvo.classList.remove('apanha'); void alvo.offsetWidth; alvo.classList.add('apanha'); }
    };
    var fmt = function (v) { return Number(Math.round(v)).toLocaleString('pt-BR'); };
    if (ev.de === 'h' && ev.i != null) { var q = caixa.querySelector('[data-alvo="h' + ev.i + '"]'); if (q) { q.classList.remove('age'); void q.offsetWidth; q.classList.add('age'); } }
    if (ev.de === 'h' && ev.dano) num('i' + (ev.ai != null ? ev.ai : 0), '−' + fmt(ev.dano), 'dano' + (ev.critico ? ' crit' : ''));
    if (ev.de === 'm' && ev.dano != null && ev.alvo != null) num('h' + ev.alvo, '−' + fmt(ev.dano), 'dano');
    if (ev.cura && ev.i != null) num('h' + ev.i, '+' + fmt(ev.cura), 'cura');
    if (ev.curaGrupo) caixa.querySelectorAll('.cena-casa[data-alvo]:not(.caido)').forEach(function (c) { num(c.dataset.alvo, '+' + Math.round(ev.curaGrupo) + '%', 'cura'); });
    if (ev.desviou && ev.alvo != null) num('h' + ev.alvo, 'Desviou!', 'desvio');
    if (ev.stun) num('i' + (ev.ai != null ? ev.ai : 0), '💫', 'desvio');
  }
  function torreDesistir(r) {
    var p = estado.personagem;
    if (r.lider !== p.id || r.estado !== 'andamento') return '';
    return '<p class="torre-desistir">' + (estado.torreDesistir ? '<button class="btn perigo btn-pequeno" data-acao="torre-desistir">Confirmar: desistir da subida</button> '
      + '<button class="btn secundario btn-pequeno" data-acao="torre-desistir-nao">Cancelar</button>' : '<button class="btn secundario btn-pequeno" data-acao="torre-desistir-pedir">Desistir da subida</button>') + '</p>';
  }
  function torrePainel(r, t, me) {
    var T = torreEst(), vivos = t.inimigos.map(function (m, i) { return { m: m, i: i }; }).filter(function (x) { return x.m.hp > 0; });
    var minha = r.escolhas && r.escolhas[me.id];
    var e = T.esc || (T.esc = { acao: 'atacar', hab: null, alvo: vivos.length ? vivos[0].i : 0, ordem: me.L && me.L.kit.some(function (k) { return k.def.tipo === 'provocar'; }) ? 1 : me.classe2 === 'curandeiro' ? 4 : 2 });
    if (!vivos.some(function (x) { return x.i === e.alvo; }) && vivos.length) e.alvo = vivos[0].i;
    var prontas = R.habilidadesTorre(me, t);
    var podeDesv = R.podeDesviar(t, me), faltaDesv = Math.max(0, (me.desviarEm || 0) - (t.turno + 1));
    if ((e.acao === 'habilidade' && prontas.indexOf(e.hab) < 0) || (e.acao === 'pocao' && me.pocoes <= 0) || (e.acao === 'desviar' && !podeDesv)) { e.acao = 'atacar'; e.hab = null; }   // turno novo: o que não dá mais vira ataque
    var btn = function (acao, rot, extra, desab, dica) {
      return '<button class="torre-op' + (dica ? ' com-dica' : '') + (e.acao === acao && (acao !== 'habilidade' || e.hab === extra) ? ' sel' : '') + '" data-acao="torre-acao" data-valor="' + acao + '"'
        + (extra ? ' data-hab="' + esc(extra) + '"' : '') + (dica ? ' data-dica="' + esc(dica) + '"' : '') + (desab ? ' disabled' : '') + '>' + rot + '</button>';
    };
    var habs = (me.L ? me.L.kit : []).map(function (k) {
      var pronta = prontas.indexOf(k.def.id) >= 0, falta = Math.max(0, (me.L.pronto[k.def.id] || 0) - (me.L.turno + 1));
      var dica = '<strong>' + esc(k.def.nome) + '</strong><span>' + efeitoHabilidade(k.def, k.pts || 0) + '</span><em>Recarga: ' + (k.def.recarga || 1) + ' turno' + ((k.def.recarga || 1) > 1 ? 's' : '')
        + (pronta ? '' : ' · pronta em ' + falta) + '</em>';
      return btn('habilidade', (iconeHab(k.def, 'torre-hab-ico') || '✨ ') + '<span>' + esc(k.def.nome) + '</span>' + (pronta ? '' : ' <small>(' + falta + ')</small>'), k.def.id, !pronta, dica);
    }).join('');
    var tomadas = ordensTomadas(r, me.id);
    if (tomadas[e.ordem] && !(minha && minha.ordem === e.ordem)) e.ordem = ordemLivre(r, me.id, e.ordem);
    var auto = torreAuto();
    var h = '<div class="torre-painel"><div class="torre-painel-cab"><h4>Sua ação' + (minha ? ' <span class="online pequeno">✔ enviada: ' + ICO_ACAO[minha.acao] + ' ' + minha.ordem + 'º' + (auto ? '' : ' (pode trocar)') + '</span>' : '') + '</h4>'
      + '<button class="torre-op mini' + (auto ? ' sel' : '') + '" data-acao="torre-auto">🤖 Automático ' + (auto ? 'ligado' : 'desligado') + '</button></div>';
    if (auto) return h + '<p class="suave pequeno">O jogo escolhe sozinho a cada turno: desvia do golpe avisado, bebe poção com pouca vida, cura o grupo e usa a melhor habilidade pronta.</p></div>';
    h += ''
      + '<div class="torre-ops">' + btn('atacar', '⚔ Atacar') + btn('desviar', '💨 Desviar <small>' + (podeDesv ? R.chanceDesviar(me) + '%' : '(' + faltaDesv + ')') + '</small>', null, !podeDesv,
        '<strong>Desviar</strong><span>Tenta escapar do golpe avisado (⚠) deste turno: ' + R.chanceDesviar(me) + '% de chance, pelo seu maior atributo.</span><em>Recarga: ' + (TR_.desviar.recarga || 0) + ' turnos'
        + (podeDesv ? '' : ' · pronto em ' + faltaDesv) + '</em>')
      + btn('pocao', '🧪 Poção <small>' + me.pocoes + '</small>', null, me.pocoes <= 0) + '</div>'
      + (habs ? '<div class="torre-ops habs">' + habs + '</div>' : '');
    if (vivos.length > 1) h += '<div class="torre-linha torre-alvos"' + (e.acao === 'atacar' || e.acao === 'habilidade' ? '' : ' hidden') + '><span class="suave pequeno">Alvo:</span>' + vivos.map(function (x) {
      return '<button class="torre-op mini' + (e.alvo === x.i ? ' sel' : '') + '" data-acao="torre-alvo" data-valor="' + x.i + '">' + esc(x.m.nome) + '</button>';
    }).join('') + '</div>';
    var vz = t.vezInimigos || 5;
    if (me.presoAte === t.turno + 1) h += '<p class="torre-vez pequeno menos">🕸 Você está preso na teia: perde a vez neste turno.</p>';
    if (me.cegoAte === t.turno + 1) h += '<p class="torre-vez pequeno menos">🌑 Você está cego: metade dos seus golpes erra neste turno.</p>';
    if (me.silencioAte === t.turno + 1) h += '<p class="torre-vez pequeno menos">🔇 Silêncio: sem habilidades neste turno.</p>';
    if (me.corrompidoDe <= t.turno + 1 && me.corrompidoAte >= t.turno + 1) h += '<p class="torre-vez pequeno menos">☠ Corrompido: cura e poção viram dano em você neste turno.</p>';
    h += '<p class="torre-vez pequeno">' + (vz < 5 ? '⚡ Neste turno o inimigo é <b>rápido</b>: age antes do <b>' + vz + 'º</b>. Quem quer atordoar ou proteger precisa vir antes.'
      : '🐢 Neste turno o inimigo age <b>por último</b>.') + '</p>';
    h += '<div class="torre-linha"><span class="suave pequeno">Ordem:</span>' + [1, 2, 3, 4].map(function (o) {
      var dono = tomadas[o];
      return '<button class="torre-op mini' + (e.ordem === o ? ' sel' : '') + (dono ? ' tomada' : '') + '" data-acao="torre-ordem" data-valor="' + o + '"' + (dono ? ' disabled title="Já é de ' + esc(dono) + '"' : '') + '>'
        + o + 'º' + (dono ? ' <small>' + esc(dono) + '</small>' : '') + '</button>' + (vz === o ? '<span class="torre-vez-marca" title="O inimigo age aqui">⚡</span>' : '');
    }).join('') + (vz === 5 ? '<span class="torre-vez-marca" title="O inimigo age aqui">🐢</span>' : '') + '</div>'
      + '<div class="botoes"><button class="btn" data-acao="torre-confirmar">' + (minha ? 'Trocar ação' : 'Confirmar') + '</button></div></div>';
    return h;
  }
  function torreConfirmar() {
    var p = estado.personagem, r = runTorre(), T = torreEst(), e = T.esc;
    if (!r || !e) return;
    var esc2 = { acao: e.acao, hab: e.hab || '', alvo: e.alvo || 0, ordem: e.ordem || 4 };
    C.torre.escolher(p.id, r.id, esc2).then(function () {
      r.escolhas = Object.assign({}, r.escolhas || {}); r.escolhas[p.id] = esc2;
      redesenharTorre(); clearTimeout(T.timer); T.timer = setTimeout(carregarTorre, 300);
    }, function (er) { avisar(er.message); T.autoFeito = null; carregarTorre(); });
  }
  function abaMasmorra() {
    var g = estado.gm, p = estado.personagem;
    if (!g) { carregarGrupo(); return '<p class="suave">' + (estado.gmErro ? esc(estado.gmErro) : 'Carregando…') + '</p>'; }
    if (g.local) return '<p class="suave">As masmorras são em grupo de 3 e precisam do servidor: jogue pelo site do ' + D.NOME_JOGO + ' para entrar com seus amigos.</p>';
    var M = Object.assign({}, D.MASMORRA, { entradasPorDia: D.MASMORRA.entradasPorDia + (ehVip() ? D.LOJA.vip.masmorraExtra : 0) }), restam = M.entradasPorDia - g.entradas;
    var html = (CELULAR ? '<details class="regras-celular"><summary>Como funciona</summary>' : '') + '<p class="suave">Grupo de 3. As lutas são automáticas e, entre elas, o grupo <strong>vota o caminho</strong> ('
      + M.votoSeg + ' s; empate: vale o líder 👑): <strong>Porta selada</strong> (baú ou armadilha), <strong>Corredor escuro</strong> (luta a mais, mais prêmio) ou '
      + '<strong>Fonte antiga</strong> (cura o grupo, menos drop). A vida passa de uma luta para a outra; a da masmorra é separada da sua. '
      + 'Vitória: cada um ganha um <strong>colar ou anel</strong> (nível −3 a +10 do seu) e tem ' + M.pergaminho
      + '% de chance de um <strong>pergaminho de encantamento</strong>. Derrota não gasta entrada.</p>' + (CELULAR ? '</details>' : '')
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
    for (var i = 0; i < Math.max(M.tamanhoGrupo, gr.membros.length); i++) {   // grupo de 4 (Torre): mostra todos
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
    html += '<h3 class="subtitulo">Seu grupo (' + gr.membros.length + '/' + M.tamanhoGrupo + ')</h3>'
      + (gr.membros.length > M.tamanhoGrupo ? '<p class="menos pequeno">A masmorra é para ' + M.tamanhoGrupo + ': com ' + gr.membros.length + ' no grupo, ' + (abaVisivel('torre') ? 'só a Torre do Eclipse.' : 'alguém precisa sair do grupo.') + '</p>' : '')
      + '<div class="mas-vagas">' + vagas.join('') + '</div>'
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
        + (mm.poderRecomendado ? '<div class="pequeno">⚔ Poder recomendado: <strong>' + mm.poderRecomendado.toLocaleString('pt-BR') + '</strong> por herói' + (R.poder(p) < mm.poderRecomendado ? ' <span class="suave">(o seu: ' + R.poder(p).toLocaleString('pt-BR') + ')</span>' : '') + '</div>' : '')
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
    if (estado.aba === 'masmorra' || emGrupo || grupoUI.aberto || ciclosGrupo % 8 === 0) carregarGrupo();
    if (estado.eventoAtual === undefined || ciclosGrupo % 60 === 1) carregarEvento();   // evento aberto: a cada 4 min
    // Boss da aliança: a cada 4 s na tela dele ou com o boss aberto; senão a cada 32 s (aviso e prêmios).
    if (estado.aba === 'oficinas' && ciclosGrupo % 2 === 0 && !estado.contratar) carregarOficinas();
    var bossAberto = estado.bossAl && estado.bossAl.boss && estado.bossAl.boss.estado === 'aberto';
    if ((estado.aba === 'alianca' && estado.aliancaVista === 'boss') || bossAberto || ciclosGrupo % 8 === 6) carregarBossAl();
    if (!estado.lutaArena && (ciclosGrupo % 8 === 4 || (estado.aba === 'arena' && ciclosGrupo % 3 === 0))) carregarArena();
  }, 4000);

  // ---------------- Aventura › Evento: Altar dos Elementos (Daniel, 18/11/2026) ----------------
  // Mesa 3x3 de montes; a carta do topo pede elementos. Toque num monte que dá para pagar e o jogo usa os elementos certos.
  // Marque elementos para guardar ao rolar, ou marque 2 para trocar por 1. A partida e os sorteios são do servidor.
  var EVA_ = D.EVENTO_ALTAR;
  function elAltar(id) { return EVA_.elementos.filter(function (e) { return e.id === id; })[0] || { ico: '?', nome: id, cor: '#888' }; }
  function carregarEvento() {
    var p = estado.personagem;
    if (!p || estado.eventoCarregando) return;
    estado.eventoCarregando = true;
    C.evento.atual().then(function (ev) {
      estado.eventoCarregando = false;
      var mudou = JSON.stringify(ev || null) !== JSON.stringify(estado.eventoAtual || null);
      estado.eventoAtual = ev || null;
      if (mudou && !estado.batalha && !estado.luta && !estado.lutaArena) atualizarNav();
    }, function () { estado.eventoCarregando = false; if (estado.eventoAtual === undefined) estado.eventoAtual = null; });
  }
  function carregarRankingEvento() {
    var p = estado.personagem;
    if (!p) return;
    C.evento.ranking(p.id).then(function (r) { estado.eventoRanking = r; if (estado.aba === 'eventos') telaJogo(); }, function () {});
  }
  // índices dos dados que pagam a carta (ou null)
  function dadosParaCarta(dados, custo) {
    var usados = [], ok = Object.keys(custo).every(function (el) {
      var falta = custo[el];
      for (var i = 0; i < dados.length && falta; i++) if (dados[i] === el && usados.indexOf(i) < 0) { usados.push(i); falta--; }
      return !falta;
    });
    return ok ? usados : null;
  }
  // arte dos elementos (assets/eventos/altar/el-<id>.webp); o emoji fica no alt
  function imgEl(id, cls) { var e = elAltar(id); return '<img class="' + (cls || 'altar-el') + '" src="assets/eventos/altar/el-' + id + '.webp" alt="' + e.ico + '" title="' + e.nome + '">'; }
  // a carta mostra a quantidade em bolinhas, como num dado: 1 no meio, 2 lado a lado, 3 na diagonal (Daniel)
  function custoHtml(custo) {
    return Object.keys(custo).map(function (el) {
      var n = Math.max(1, Math.min(3, custo[el])), h = '';
      for (var i = 0; i < n; i++) h += imgEl(el, 'altar-pip');
      return '<span class="altar-pips q' + n + '">' + h + '</span>';
    }).join('');
  }
  function abaEventos() {
    var p = estado.personagem, ev = estado.eventoAtual, al = p.altar, pt = al && al.partida;
    if (!estado.eventoRankingEm || Date.now() - estado.eventoRankingEm > 60000) { estado.eventoRankingEm = Date.now(); carregarRankingEvento(); }
    var hojeOk = al && ev && al.ev === ev.id && al.dia === R.diaReset(C.agora()), usadas = hojeOk ? al.entradas : 0;
    var h = '<section class="caixa altar"><div class="altar-topo"><div><small>Evento</small><h3 class="subtitulo">' + EVA_.nome + '</h3>'
      + (ev ? '<p class="suave pequeno">' + (ev.fim ? 'Acaba em ' + tempoTexto(Math.max(0, Date.parse(ev.fim) - C.agora())) : 'Aberto') + '</p>' : '<p class="menos pequeno">Nenhum evento aberto agora.</p>')
      + '</div><div class="altar-placar"><span>Partidas hoje <b>' + usadas + '/' + EVA_.entradasDia + '</b></span><span>Seus pontos <b>' + Number((al && ev && al.ev === ev.id ? al.total : 0) || 0).toLocaleString('pt-BR') + '</b></span></div></div>';
    h += '<details class="regras-celular"' + (CELULAR ? '' : ' open') + '><summary>Como jogar</summary><ul>'
      + '<li>Cada partida tem <b>' + EVA_.rolagens + ' rolagens</b> de ' + EVA_.dados + ' elementos: ' + EVA_.elementos.map(function (e) { return e.ico + ' ' + e.nome; }).join(', ') + '.</li>'
      + '<li>Cada carta pede <b>1 a 3 do mesmo elemento</b> (ex.: 2 💧). Toque num <b>monte</b> que brilha para pegar a carta do topo (' + EVA_.pontos.porElemento + ' pontos por elemento).</li>'
      + '<li>Os elementos <b>não se gastam</b>: ficam na mão para a próxima carta. Cada carta seguida antes de rolar é <b>combo</b> (+' + EVA_.pontos.combo + ' pontos por carta já pega nessa mão).</li>'
      + '<li>Marque elementos e <b>role</b>: os marcados ficam, os outros mudam. Marque <b>2</b> para <b>trocar por 1</b> que você escolher (' + (EVA_.trocasPorPartida || 2) + ' trocas por partida).</li>'
      + '<li>Monte zerado +' + EVA_.pontos.monte + ', <b>coluna completa +' + EVA_.pontos.coluna + '</b>, linha ou diagonal completa +' + EVA_.pontos.linha + ', mesa toda +' + EVA_.pontos.mesa + ' (e vem uma mesa nova).</li>'
      + '<li><b>' + EVA_.entradasDia + ' partidas por dia</b>. Os pontos de todas somam no <b>ranking</b>; no fim do evento os melhores ganham prêmios.</li></ul></details>';
    if (!pt) {
      h += '<div class="botoes"><button class="btn" data-acao="altar-entrar"' + (!ev || usadas >= EVA_.entradasDia ? ' disabled' : '') + '>🎲 Começar partida</button></div>'
        + (usadas >= EVA_.entradasDia ? '<p class="suave pequeno">Suas partidas de hoje acabaram. Volte amanhã!</p>' : '');
    } else {
      var sel = estado.altarSel || [];
      h += '<div class="altar-status"><span>⭐ <b>' + pt.pontos.toLocaleString('pt-BR') + '</b> pontos</span><span>🎲 <b>' + pt.rolagens + '</b> rolagens</span>' + (pt.combo ? '<span class="altar-combo">🔥 Combo x' + pt.combo + '</span>' : '') + (pt.mesas ? '<span>🏆 ' + pt.mesas + ' mesa(s)</span>' : '') + '</div>';
      // mesa 4x4 (arte assets/eventos/altar/mesa.webp): cada carta em cima de um encaixe
      var lado = EVA_.lado || 3, cx = [21.3, 40.4, 59.6, 78.8], cy = [20.8, 40.3, 59.8, 79.6];
      if (lado !== 4) { cx = []; for (var ci = 0; ci < lado; ci++) cx.push(Math.round((100 / lado) * (ci + 0.5) * 10) / 10); cy = cx; }
      h += '<div class="altar-mesa">' + pt.mesa.map(function (monte, i) {
        var pos = ' style="left:' + cx[i % lado] + '%;top:' + cy[Math.floor(i / lado)] + '%;--tam:' + (lado === 4 ? 17.6 : 92 / lado) + '%"';
        if (!monte.length) return '<div class="altar-monte vazio"' + pos + '><span>✔</span></div>';
        if (estado.altarMesaNova) return '<div class="altar-monte pilha-3"' + pos + '></div>';
        var topo = monte[monte.length - 1], paga = dadosParaCarta(pt.dados, topo.custo);
        return '<button class="altar-monte pilha-' + Math.min(3, monte.length) + (paga ? ' paga' : '') + '"' + pos + ' data-acao="altar-pagar" data-valor="' + i + '"' + (paga ? '' : ' aria-disabled="true"') + '>'
          + '<span class="altar-face"><span class="altar-pilha">' + monte.length + '</span><span class="altar-carta">' + custoHtml(topo.custo) + '</span></span></button>';
      }).join('') + '</div>';
      h += '<div class="altar-dados">' + pt.dados.map(function (d, i) {
        var e = elAltar(d);
        return '<button class="altar-dado' + (sel.indexOf(i) >= 0 ? ' sel' : '') + '" style="--cor:' + e.cor + '" data-acao="altar-dado" data-valor="' + i + '" title="' + e.nome + '">' + imgEl(d, 'altar-dado-img') + '</button>';
      }).join('') + new Array((estado.altarBloq && estado.altarGirando) || 0).fill('<span class="altar-dado girando">🎲</span>').join('') + (!pt.dados.length && !estado.altarGirando ? '<span class="suave pequeno">Sem elementos: role de novo.</span>' : '') + '</div>';
      if (estado.altarTroca && sel.length === 2) h += '<div class="altar-troca"><span class="suave pequeno">Trocar os 2 marcados por:</span>' + EVA_.elementos.map(function (e) {
        return '<button class="altar-dado" style="--cor:' + e.cor + '" data-acao="altar-trocar" data-valor="' + e.id + '" title="' + e.nome + '">' + imgEl(e.id, 'altar-dado-img') + '</button>';
      }).join('') + '<button class="btn secundario btn-pequeno" data-acao="altar-troca-nao">Cancelar</button></div>';
      h += '<div class="botoes altar-botoes"><button class="btn" data-acao="altar-rolar"' + (pt.rolagens > 0 ? '' : ' disabled') + '>🎲 Rolar' + (sel.length ? ' (guarda ' + sel.length + ')' : '') + '</button>'
        + (function () { var resta = Math.max(0, (EVA_.trocasPorPartida || 99) - (pt.trocas || 0));
          return '<button class="btn secundario" data-acao="altar-troca"' + (sel.length === 2 && resta > 0 ? '' : ' disabled') + ' title="' + (resta > 0 ? 'Marque 2 elementos' : 'Acabaram as trocas desta partida') + '">🔁 Trocar 2 → 1 (' + resta + ')</button>'; })()
        + (estado.altarFim ? '<button class="btn perigo" data-acao="altar-encerrar">Confirmar: encerrar</button><button class="btn secundario" data-acao="altar-fim-nao">Voltar</button>'
          : '<button class="btn secundario" data-acao="altar-fim">Encerrar partida</button>') + '</div>';
      if (estado.altarFim && (pt.rolagens > 0 || pt.mesa.some(function (m) { return m.length && dadosParaCarta(pt.dados, m[m.length - 1].custo); })))
        h += '<p class="menos pequeno">Você ainda tem jogadas. Encerrando, os pontos desta partida (' + pt.pontos + ') vão para o ranking.</p>';
    }
    // ranking
    var rk = estado.eventoRanking;
    h += '<h3 class="subtitulo">🏆 Ranking do evento</h3>';
    if (!rk) h += '<p class="suave">Carregando…</p>';
    else if (!rk.top || !rk.top.length) h += '<p class="suave pequeno">Ninguém pontuou ainda.</p>';
    else h += '<ol class="altar-ranking">' + rk.top.slice(0, estado.altarRankTudo ? 50 : 10).map(function (x) {
      return '<li' + (x.nome === p.nome ? ' class="eu"' : '') + '><span>' + x.pos + 'º</span><b>' + esc(x.nome) + '</b><small class="suave">Lv ' + x.nivel + '</small><em>' + Number(x.pontos).toLocaleString('pt-BR') + '</em></li>';
    }).join('') + '</ol>' + (rk.top.length > 10 ? '<button class="btn secundario btn-pequeno" data-acao="altar-rank-tudo">' + (estado.altarRankTudo ? 'Ver menos' : 'Ver os ' + rk.top.length) + '</button>' : '');
    if (rk && rk.eu) h += '<p class="pequeno">Você: <b>' + rk.eu.pos + 'º</b> com ' + Number(rk.eu.pontos).toLocaleString('pt-BR') + ' pontos em ' + rk.eu.partidas + ' partida(s).</p>';
    h += '<p class="suave pequeno">Prêmios no fim: ' + EVA_.premios.map(function (x, i) {
      var de = i ? EVA_.premios[i - 1].ate + 1 : 1;
      return (de === x.ate ? x.ate + 'º' : de + 'º–' + x.ate + 'º') + ' ' + x.ouro.toLocaleString('pt-BR') + ' de ouro + ' + x.qtd + ' pergaminho' + (x.qtd > 1 ? 's' : '') + ' ' + ({ rara: 'raro', epica: 'épico', lendaria: 'lendário' }[x.pergaminho] || x.pergaminho) + (x.qtd > 1 ? 's' : '');
    }).join(' · ') + '.</p>';
    if (ehAdmin()) h += '<div class="secao altar-admin"><h4>👑 Admin do evento</h4><p class="suave pequeno">' + (ev ? 'Aberto' + (ev.fim ? ' até ' + new Date(ev.fim).toLocaleString('pt-BR') : ' (sem data de fim)') : 'Fechado') + '.</p>'
      + '<div class="botoes"><label class="pequeno">Dias <input type="number" id="altar-dias" min="1" max="60" value="7" style="width:4rem"></label>'
      + '<button class="btn" data-acao="altar-admin" data-valor="ligar">' + (ev ? 'Mudar o fim' : 'Ligar evento') + '</button>'
      + '<button class="btn secundario" data-acao="altar-admin" data-valor="ligar-sem">' + (ev ? 'Tirar a data de fim' : 'Ligar sem data') + '</button>'
      + (ev ? '<button class="btn secundario" data-acao="altar-admin" data-valor="desligar">Desligar</button>' : '<button class="btn secundario" data-acao="altar-admin" data-valor="religar">Religar o último</button>')
      + (estado.altarPremiar ? '<button class="btn perigo" data-acao="altar-admin" data-valor="premiar">Confirmar: dar prêmios e encerrar</button>'
        : '<button class="btn secundario" data-acao="altar-premiar-pedir">Dar os prêmios…</button>') + '</div></div>';
    return h + '</section>';
  }
  // Jogadas do Altar sem esperar o servidor (Daniel, 19/11/2026: as cartas demoravam a responder). A jogada vale na
  // tela na hora e vai para uma fila que manda uma por vez; cada resposta do servidor substitui a partida e as jogadas
  // que ainda estão na fila são refeitas por cima. O que é sorteado (rolar, mesa nova) trava a mesa até a resposta.
  // Altar (Henri, 21/11/2026): as jogadas redesenham só a caixa do evento, não a tela inteira (a tela mexia a cada toque).
  function redesenharAltar() {
    var cx = document.querySelector('section.altar');
    if (!cx || estado.aba !== 'eventos' || estado.batalha || estado.luta || estado.mas || estado.lutaArena || estado.cacada) return telaJogo();
    var y = window.scrollY, tmp = document.createElement('div');
    tmp.innerHTML = abaEventos();
    var novo = tmp.querySelector('section.altar');
    if (!novo) return telaJogo();
    cx.replaceWith(novo);
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  }
  var altarFila = [], altarEnviando = false;
  function altarJogada(nome, args, aplicar, trava, aviso) {
    var p = estado.personagem, pt = p.altar && p.altar.partida;
    if (!pt) return;
    var res = aplicar(pt);
    if (aviso) aviso(res);
    if (trava) estado.altarBloq = true;
    altarFila.push({ nome: nome, args: args, aplicar: aplicar });
    redesenharAltar();
    altarEnviar();
  }
  function altarEnviar() {
    if (altarEnviando || !altarFila.length) return;
    altarEnviando = true;
    var op = altarFila[0], p = estado.personagem;
    acaoServidor(op.nome, op.args, function () { /* já aplicada na tela */ }).then(function (r) {
      altarEnviando = false;
      altarFila.shift();
      if (estado.personagem !== p) { altarFila = []; return; }
      if (!r) { altarFila = []; sincronizarFicha().then(function () { if (estado.personagem === p) redesenharAltar(); }); }   // recusada ou sem rede: volta ao que está no servidor
      else {
        var pt = p.altar && p.altar.partida;
        if (pt) altarFila.forEach(function (o) { o.aplicar(pt); });   // refaz por cima as que ainda vão
      }
      if (!altarFila.length) { estado.altarBloq = false; estado.altarGirando = 0; estado.altarMesaNova = false; }
      redesenharAltar();
      altarEnviar();
    });
  }
  function cliqueAltar(acao, el) {
    var p = estado.personagem, pt = p.altar && p.altar.partida, depois = function () { redesenharAltar(); };
    var local = function (fn) { return function () { fn(); }; };
    switch (acao) {
      case 'altar-entrar':
        estado.altarSel = []; estado.altarTroca = false; estado.altarFim = false;
        acaoServidor('altarEntrar', null, local(function () { var a = R.altarDoDia(p, 'local', C.agora()); a.entradas++; a.n = (a.n || 0) + 1; a.partida = R.novaPartidaAltar(Math.random); })).then(depois);
        return true;
      case 'altar-dado': {
        if (estado.altarBloq) return true;
        var i = Number(el.dataset.valor), sel = estado.altarSel || (estado.altarSel = []), k = sel.indexOf(i);
        if (k >= 0) sel.splice(k, 1); else sel.push(i);
        if (sel.length !== 2) estado.altarTroca = false;
        // Marcar um elemento não redesenha a tela (Henri, 21/11/2026: a tela mexia a cada toque): só troca o
        // destaque e os botões que dependem da seleção.
        var caixaA = document.querySelector('section.altar'), rolarA = caixaA && caixaA.querySelector('[data-acao="altar-rolar"]');
        if (caixaA && rolarA && !caixaA.querySelector('.altar-troca')) {
          el.classList.toggle('sel', sel.indexOf(i) >= 0);
          if (!rolarA.disabled) rolarA.textContent = '🎲 Rolar' + (sel.length ? ' (guarda ' + sel.length + ')' : '');
          var trocaA = caixaA.querySelector('[data-acao="altar-troca"]'), restaA = Math.max(0, (EVA_.trocasPorPartida || 99) - ((pt && pt.trocas) || 0));
          if (trocaA) trocaA.disabled = !(sel.length === 2 && restaA > 0);
          return true;
        }
        redesenharAltar(); return true;
      }
      case 'altar-pagar': {
        if (!pt || estado.altarBloq) return true;
        var m = Number(el.dataset.valor), monte = pt.mesa[m], idx = monte && monte.length && dadosParaCarta(pt.dados, monte[monte.length - 1].custo);
        if (!idx) { avisar('Seus elementos não pagam essa carta.'); return true; }
        estado.altarSel = []; estado.altarTroca = false;
        // na hora (sem esperar o servidor): a carta sai e os pontos sobem; mesa toda = mesa nova sorteada no servidor
        var vazias = pt.mesa.filter(function (x) { return !x.length; }).length + (monte.length === 1 ? 1 : 0);
        var mesaToda = vazias === pt.mesa.length;
        if (mesaToda) estado.altarMesaNova = true;   // a mesa nova vem do servidor: fica virada até ele responder
        altarJogada('altarPagar', { monte: m, dados: idx }, function (q) { return R.pagarAltar(q, m, idx, Math.random); }, mesaToda, function (res) {
          if (res && res.extras && res.extras.length) avisar((res.extras.indexOf('mesa') >= 0 ? '🏆 Mesa toda! ' : res.extras.indexOf('linha') >= 0 ? '✨ Linha completa! ' : res.extras.indexOf('monte') >= 0 ? '✔ Monte completo! ' : '')
            + (res.extras.indexOf('coluna') >= 0 ? '🏛 Coluna completa! ' : '') + (res.combo > 1 ? '🔥 Combo x' + res.combo + '! ' : '') + '+' + res.ganho, 'nivel');
        });
        return true;
      }
      case 'altar-rolar': {
        if (!pt || estado.altarBloq || pt.rolagens <= 0) return true;
        var manter = (estado.altarSel || []).slice();
        // os guardados continuam marcados depois de rolar (o servidor põe eles no começo da mão)
        estado.altarSel = manter.map(function (x, k) { return k; }); estado.altarTroca = false;
        // na hora: os guardados ficam e os outros giram até o servidor mandar o sorteio
        altarJogada('altarRolar', { manter: manter }, function (q) {
          q.dados = manter.map(function (i) { return q.dados[i]; }); q.rolagens--; q.combo = 0;
          estado.altarGirando = Math.max(0, (EVA_.dados || 5) - q.dados.length);
        }, true);
        return true;
      }
      case 'altar-troca': if (pt && (pt.trocas || 0) >= (EVA_.trocasPorPartida || 99)) { avisar('Você já usou as trocas desta partida.'); return true; } estado.altarTroca = true; redesenharAltar(); return true;
      case 'altar-troca-nao': estado.altarTroca = false; redesenharAltar(); return true;
      case 'altar-trocar': {
        if (!pt || estado.altarBloq) return true;
        var dois = (estado.altarSel || []).slice(), elx = el.dataset.valor;
        estado.altarSel = []; estado.altarTroca = false;
        altarJogada('altarTrocar', { dados: dois, elemento: elx }, function (q) { return R.trocarAltar(q, dois, elx); }, false);
        return true;
      }
      case 'altar-fim': if (altarFila.length) return true; estado.altarFim = true; redesenharAltar(); return true;
      case 'altar-fim-nao': estado.altarFim = false; redesenharAltar(); return true;
      case 'altar-encerrar':
        if (altarFila.length) { avisar('Espere a última jogada terminar.'); return true; }
        estado.altarFim = false; estado.altarSel = [];
        acaoServidor('altarEncerrar', null, local(function () { var a = p.altar; a.total = (a.total || 0) + a.partida.pontos; a.partida = null; })).then(function (r) {
          var res = r && r.resultado;
          if (res) avisar('Partida encerrada: ' + res.pontos.toLocaleString('pt-BR') + ' pontos (total ' + res.total.toLocaleString('pt-BR') + ').', 'nivel');
          setTimeout(carregarRankingEvento, 1500);
          depois();
        });
        return true;
      case 'altar-rank-tudo': estado.altarRankTudo = !estado.altarRankTudo; redesenharAltar(); return true;
      case 'altar-premiar-pedir': estado.altarPremiar = true; redesenharAltar(); return true;
      case 'altar-admin': {
        var v = el.dataset.valor, campo = document.getElementById('altar-dias'), dias = campo ? Math.max(1, Math.min(60, Number(campo.value) || 7)) : 7;
        var acaoA = v === 'ligar-sem' ? 'ligar' : v, d = v === 'ligar' || v === 'religar' ? dias : null;
        estado.altarPremiar = false;
        C.evento.admin(p.id, acaoA, d).then(function (r) {
          avisar(v === 'premiar' ? 'Prêmios entregues para ' + (r && r.premiados || 0) + ' jogadores.' : 'Evento atualizado.', 'nivel');
          estado.eventoAtual = undefined; carregarEvento(); carregarRankingEvento();
        }, function (e) { avisar(e.message); redesenharAltar(); });
        return true;
      }
    }
    return false;
  }

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
    var b = e.boss, ativo = bossAtivo(), chefe = D.monstros[R.lutaChefeMundial(p)], cfg = e.cfg || {};
    var entradasBoss = cfg.entradas || CM.entradas, usadas = ativo && e.eu ? e.eu.ataques : 0;
    var h = '<div class="boss-cabeca"><div class="moldura boss-arte">' + F.imagemMonstro('ignaroth-mundial') + '</div><div>'
      + '<h2>O Despertar de Ignaroth</h2>' + (CELULAR ? '<div class="boss-hora">🕗 Todo dia às ' + cfg.hora + 'h · 1 hora · ' + entradasBoss + ' ataques</div><details class="regras-celular"><summary>Como funciona</summary>' : '')
      + '<p class="suave">Todo dia às ' + cfg.hora + 'h (Brasília), por 1 hora, Ignaroth desperta com uma vida só '
      + 'para o reino inteiro. Cada ataque é uma luta contra a força de <strong>' + chefe.nome + '</strong> ('
      + (chefe.pesadelo ? 'o chefe Pesadelo do seu level, com metade do dano' : 'o chefe da sua área') + '), '
      + 'com até ' + CM.acoesPorAtaque + ' ações suas. Você tem <strong>' + entradasBoss + ' ataques</strong> por despertar; a vida começa cheia em cada um e não dá para usar poção. '
      + 'Cada ataque tira no máximo ' + (cfg.danoMaximoPct || 3) + '% da vida dele: ninguém derruba sozinho.</p>' + (CELULAR ? '</details>' : '') + '</div></div>';
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
      + '<li>Top 10 de dano: sempre 1 item (arma ou armadura, de 3 a 10 levels acima do seu): ' + cfg.lendaria + '% lendário, ' + cfg.epica + '% épico, '
      + Math.max(0, 100 - cfg.lendaria - cfg.epica) + '% raro; e 1 pergaminho.</li>'
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
    if (ACAO_SERVIDOR) {   // a luta é feita no servidor; aqui só mostra (Henri, nov/2026)
      if (estado.bossAtacando) return;
      estado.bossAtacando = true;
      estado.bossEnvio = Date.now();
      C.acao(p.id, 'bossMundial', {}).then(function (r) {
        estado.bossAtacando = false;
        if (!r || r.erro) { avisar((r && r.erro) || 'Não foi possível atacar.'); carregarBoss(); return; }
        if (estado.batalha || estado.cacada) return;
        comecarMundial(p, bs, r.luta || r.chefe || chefeId, r);
      }, function (e) { estado.bossAtacando = false; avisar(e.message); });
      return;
    }
    comecarMundial(p, bs, R.lutaChefeMundial(p), null);
  }
  function comecarMundial(p, bs, chefeId, srv) {
    var b = R.iniciarBatalha(p, chefeId, null, { mundial: true });   // vida cheia, sem poção, não gasta estamina
    b.mundial = { bossId: bs.id, vidaInicial: bs.vida, chefe: chefeId, acoes: 0 };
    b.imagemId = 'ignaroth-mundial';
    b.monstro.nome = 'Ignaroth (Chefe Mundial)';
    b.monstro.hp = srv ? srv.vidaInicial : bs.vida;
    b.monstro.hpMax = bs.vida_max;
    if (srv) {
      b.mundial.vidaInicial = srv.vidaInicial;
      b.replay = { eventos: srv.eventos || [], i: 0, res: { resultado: srv.fim }, extras: {}, servidor: srv.resultado };
    }
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
    salvarPreferencias();
    telaJogo();
    var envio = b.replay && b.replay.servidor ? Promise.resolve(b.replay.servidor) : C.boss.atacar(p.id, dano, b.mundial.chefe);
    envio.then(function (r) {
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
    if (ACAO_SERVIDOR) return receberPendentes();   // o servidor lê os créditos do banco e aplica
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
    // segunda classe, Pacto e clã (24/11/2026): sem eles a prévia mostrava menos vida do que a luta de verdade
    if (pf.talentos) x.talentos = pf.talentos;
    if (pf.ascensao) x.ascensao = pf.ascensao;
    if (pf.cla) x.cla = pf.cla;
    return x;
  }
  // O que o ataque vale (o servidor confere): escada = posição + saque + reputação; Top 5 para baixo e Ranking não mudam posição.
  // Alvo numa arena abaixo = nada; mesma arena e alvo abaixo de você = metade da reputação; o ouro cai a cada repetição na semana.
  function recompensaDesafioHtml(pf, tipo, ouro, saque) {
    var ar = estado.arena, rep = A.reputacaoVitoria, minha = ar && ar.minha_arena, minhaPos = ar && ar.posicao;
    var ia = A.arenas.map(function (a) { return a.id; }).indexOf(minha), id = A.arenas.map(function (a) { return a.id; }).indexOf(pf.arena);
    var mesma = minha && pf.arena === minha, abaixo = mesma && minhaPos && pf.posicao > minhaPos;
    var escada = tipo !== 'livre' && tipo !== 'revanche' && mesma && !abaixo;
    var nada = !escada && minha && id >= 0 && ia >= 0 && id < ia;
    var repTxt = nada ? 0 : abaixo ? Math.floor(rep / 2) : rep;
    var linhas = [];
    if (nada) linhas.push('<span class="menos">Ele está numa arena abaixo da sua: vencendo, você <strong>não ganha reputação nem ouro</strong>.</span>');
    else {
      linhas.push('Ouro dele: <strong class="cor-ouro">' + ouro.toLocaleString('pt-BR') + '</strong> · se vencer, saque de <strong class="cor-ouro">' + saque + ' de ouro</strong>'
        + ' e <strong>+' + repTxt + ' de reputação</strong>' + (abaixo ? ' (metade: ele está abaixo de você)' : '')
        + (escada && pf.posicao === 1 ? ' e o <strong class="cor-ouro">jackpot</strong>' : '') + '.');
      linhas.push('<span class="suave pequeno">Atacar o mesmo personagem de novo na semana: o ouro cai pela metade a cada vez, até zerar (a reputação continua). Se ele te atacar e vencer, a conta zera e o ouro volta cheio.</span>');
    }
    linhas.push('<span class="suave pequeno">' + (tipo === 'revanche' ? 'Revanche: não muda a sua posição na Arena e ele não pode revidar.'
      : (escada ? 'Vencendo, você toma a posição dele.' : 'Este ataque não muda a sua posição na Arena.') + ' Ele poderá revidar com uma revanche.') + '</span>');
    return '<p class="desafio-ouro">' + linhas.join('<br>') + '</p>';
  }

  function desafioHtml() {
    var d = estado.desafio, p = estado.personagem, pf = d.perfil, corpo;
    if (d.erro) corpo = '<p class="menos">' + esc(d.erro) + '</p>';
    else if (!pf) corpo = '<p class="suave centro">Carregando o perfil…</p>';
    else {
      // Na Arena compara a Ameaça (a força na Arena, calculada no servidor); no perfil de amigo, o Poder.
      var arena = d.tipo !== 'perfil' && pf.ameaca != null;
      var x = personagemDoPerfil(pf), sx = R.status(x), sp = R.status(p);
      var px = arena ? pf.ameaca : R.poder(x), pp = arena ? (pf.minha_ameaca || 0) : R.poder(p);
      var razao = px / Math.max(1, pp);
      var veredito = razao > 1.15 ? ['menos', 'Mais forte que você'] : razao < 0.87 ? ['mais', 'Mais fraco que você'] : ['cor-ouro', 'Força parecida com a sua'];
      function linhaComp(nome, a, b, txtA, txtB) {
        var cls = a > b ? 'menos' : a < b ? 'mais' : '';
        return '<tr><th>' + nome + '</th><td class="' + cls + '">' + (txtA || a) + '</td><td>' + (txtB || b) + '</td></tr>';
      }
      var mediaX = (sx.dano[0] + sx.dano[1]) / 2, mediaP = (sp.dano[0] + sp.dano[1]) / 2;
      var tabela = '<table class="comparar-tabela"><tr><th></th><th>' + esc(pf.nome) + '</th><th>Você</th></tr>'
        + linhaComp(arena ? '☠ Ameaça' : 'Poder', px, pp, px.toLocaleString('pt-BR'), pp.toLocaleString('pt-BR'))
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
      + '<div class="zoom-rotulo">' + (d.tipo === 'revanche' ? 'Revanche?' : d.tipo === 'livre' ? 'Atacar pelo Ranking?' : 'Desafiar na Arena?') + '</div>' + corpo
      + '<div class="botoes"><button class="btn btn-rolar" data-acao="desafio-confirmar"' + (!pf || semEntrada ? ' disabled' : '') + '>' + (d.tipo === 'revanche' ? '⚔ Revanche' : d.tipo === 'livre' ? '⚔ Atacar' : '⚔ Desafiar')
      + (entradas ? ' <small>(gasta 1 de ' + entradas.valor + ' entradas)</small>' : '') + '</button>'
      + '<button class="btn secundario" data-acao="desafio-cancelar">Cancelar</button></div></div></div>';
  }

  function linhaRanking(x, botao) {
    return '<div class="item arena-linha' + (x.id === estado.personagem.id ? ' meu' : '') + '"><div class="arena-pos">' + trofeu(x.posicao) + '</div>'
      + (CELULAR && x.raca ? '<span class="arena-retrato">' + F.personagem(x.raca, classeRetrato(x), x.sexo) + '</span>' : '')
      + '<div class="amigo-info">' + siglaHtml(x.sigla) + '<strong>' + esc(x.nome) + '</strong><div class="suave pequeno">' + nomeClasseX(x)
      + ' · Lv ' + x.nivel + (x.ameaca != null ? ' · <span title="Ameaça: a força na Arena">☠ Ameaça ' + Number(x.ameaca).toLocaleString('pt-BR') + '</span>'
        : ' · Poder ' + Number(x.poder || 0).toLocaleString('pt-BR')) + '</div></div>'
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
      var botao = '<button class="btn secundario" data-acao="arena-resumo" data-luta="' + h.id + '" title="Ver como foi a luta">📜 Resumo</button>'
        + (h.pode_revanche ? '<button class="btn" data-acao="arena-revanche" data-luta="' + h.id + '" data-id="' + esc(h.oponente_id || '') + '"' + (e.valor <= 0 ? ' disabled' : '') + '>Revanche</button>' : '');
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
    // Cura (Luz que Cura): o dado decide quanto cura, então ele aparece no histórico (Henri, 14/11/2026). Com 1, cura 0.
    var cura = ev.hab && ev.cura !== undefined && ev.cura !== null && !ev.dano;
    if (ev.hab) L.registro.push('<p class="habilidade-usada">' + (cura ? '💚 ' : ev.reforco ? '✨ ' : '⚡ ') + (cura && ev.dado ? '🎲 <strong>' + ev.dado + '</strong> ' : '')
      + esc(atk.nome) + ' usa <strong>' + esc(ev.hab) + '</strong>'
      + (cura ? (ev.cura > 0 ? ' e recupera <strong>' + ev.cura + '</strong> de vida' : ' e não cura nada') : '') + '!</p>');
    // Level 30 (nov/2026): queimadura, cala, cegueira, Milagre e dano devolvido.
    if (ev.queimou) L.registro.push('<p class="dano-recebido">🔥 ' + esc(atk.nome) + ' queima e perde <strong>' + ev.queimou + '</strong>.</p>');
    if (ev.envenenado) L.registro.push('<p class="dano-recebido">☠️ ' + esc(atk.nome) + ' sangra/está envenenado e perde <strong>' + ev.envenenado + '</strong>.</p>');
    if (ev.milagreEu) L.registro.push('<p class="cura">✨ Milagre! ' + esc(atk.nome) + ' volta à luta.</p>');
    if (ev.calado) L.registro.push('<p class="errou">🤐 ' + esc(atk.nome) + ' está calado: sem habilidades nesta vez.</p>');
    if (ev.atordoado) {
      L.registro.push('<p class="errou">' + esc(atk.nome) + (atk.sexo === 'feminino' ? ' está atordoada' : ' está atordoado') + ' e perde a vez.</p>');
      if (!L.tudo && L.registro.length > 60) L.registro.splice(0, L.registro.length - 60);
      return;
    }
    if (cura) { L.ultimo = { numero: ev.dado, quem: ev.de, texto: ev.hab + ': +' + ev.cura + ' de vida' }; if (!L.tudo && L.registro.length > 60) L.registro.splice(0, L.registro.length - 60); return; }
    L.ultimo = { numero: ev.dado, quem: ev.de, texto: efeitoDado(ev.dado) + (ev.garantido ? ' (Sombra: vale o 20)' : '') + (ev.dano ? ' → ' + ev.dano + ' de dano' : '') };
    if (ev.sombra) L.registro.push('<p class="errou">' + esc(alvo.nome) + ' está nas sombras: o golpe passa direto.</p>');
    if (ev.sombraFalhou) L.registro.push('<p class="suave">🌑 ' + (ev.dado ? '🎲 <strong>' + ev.dado + '</strong> ' : '') + esc(atk.nome)
      + ' não conseguiu sumir nas sombras (precisa de ' + (D.ARENA.sombraDado || 18) + ' ou mais): só o ataque.</p>');
    if (ev.esquiva) L.registro.push('<p class="errou">' + esc(alvo.nome) + ' se esquiva!</p>');
    L.registro.push('<p class="' + (ev.dado === 1 ? 'errou' : ev.dado >= 18 ? 'critico' : ev.de === 'a' ? '' : 'dano-recebido') + '">🎲 <strong>' + ev.dado + '</strong> '
      + esc(atk.nome) + (ev.auto ? ' (tempo esgotado)' : '') + ': ' + efeitoDado(ev.dado) + (ev.garantido ? (ev.hab ? ' (vale o 20!)' : ' (Sombra: vale o 20!)') : '') + (ev.dano ? ' — ' + esc(alvo.nome) + ' perde <strong>' + ev.dano + '</strong>' : '') + '.</p>');
    if (ev.errouCego) L.registro.push('<p class="errou">🌫️ ' + esc(atk.nome) + ' está com pó nos olhos e erra!</p>');
    if (ev.executou) L.registro.push('<p class="critico">💀 Execução! ' + esc(alvo.nome) + ' estava fraco.</p>');
    if (ev.devolvido) L.registro.push('<p class="dano-recebido">🛡️ ' + esc(alvo.nome) + ' devolve <strong>' + ev.devolvido + '</strong> de dano.</p>');
    if (ev.calou) L.registro.push('<p class="destaque">🤐 ' + esc(alvo.nome) + ' fica sem habilidades na próxima vez.</p>');
    if (ev.curou) L.registro.push('<p class="cura">💚 ' + esc(atk.nome) + ' recupera <strong>' + ev.curou + '</strong> de vida com a luz.</p>');
    if (ev.quebrou) L.registro.push('<p class="destaque">⛓️ A defesa de ' + esc(alvo.nome) + ' quebrou (−' + (ev.quebraPct || 30) + '%'
      + (ev.quebraTurnos ? ' por ' + ev.quebraTurnos + ' turnos' : '') + ').</p>');
    // Veneno/sangramento/queimadura: o D20 decide o dano (18/11/2026); 1 = falha.
    var dadoEf = ev.dado ? '🎲 <strong>' + ev.dado + '</strong> ' : '';
    if (ev.queimadura) L.registro.push('<p class="destaque">🔥 ' + dadoEf + esc(alvo.nome) + ' está queimando'
      + (ev.efeitoDano ? ' (<strong>' + ev.efeitoDano + '</strong> por vez)' : '') + ' e as curas dele caem pela metade.</p>');
    if (ev.envenenou) L.registro.push('<p class="destaque">☠️ ' + dadoEf + esc(alvo.nome) + ' foi envenenado'
      + (ev.efeitoDano ? ' (<strong>' + ev.efeitoDano + '</strong> por vez)' : '') + '.</p>');
    if (ev.efeitoFalhou) L.registro.push('<p class="suave">☠️ ' + dadoEf + 'O efeito de ' + esc(ev.hab || 'habilidade') + ' falhou.</p>');
    if (ev.escudo) L.registro.push('<p class="destaque">🧊 ' + esc(atk.nome) + ' levanta um escudo de gelo.</p>');
    if (ev.escudoSegurou) L.registro.push('<p class="suave">🧊 O escudo de ' + esc(alvo.nome) + ' segura <strong>' + ev.escudoSegurou + '</strong>.</p>');
    if (ev.congelouEu) L.registro.push('<p class="destaque">🧊 ' + esc(atk.nome) + ' congela ao bater no escudo!</p>');
    if (ev.bolso) L.registro.push('<p class="cura">🧪 ' + esc(alvo.nome) + ' usa o Bolso de Poções.</p>');
    if (ev.cegou) L.registro.push('<p class="destaque">🌫️ ' + esc(alvo.nome) + ' leva pó nos olhos.</p>');
    if (ev.milagre) L.registro.push('<p class="cura">✨ Milagre! ' + esc(alvo.nome) + ' volta à luta.</p>');
    if (ev.atordoou) L.registro.push('<p class="destaque">' + esc(alvo.nome) + (alvo.sexo === 'feminino' ? (ev.congelou ? ' está congelada' : ' está atordoada') : (ev.congelou ? ' está congelado' : ' está atordoado')) + ' por ' + ev.atordoou + (ev.atordoou > 1 ? ' turnos!' : ' turno!') + '</p>');
    if (!L.tudo && L.registro.length > 60) L.registro.splice(0, L.registro.length - 60);
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
      acaoServidor('eventoJogo', { tipo: 'arena', luta: L.luta.id });   // o servidor confere a luta no banco
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

  // Relatório do fim da luta (Henri, 13/11/2026): dano, cura e dados de cada lado, a partir dos eventos da luta.
  function relatorioArenaHtml(luta) {
    var est = luta.estado, evs = luta.eventos || [];
    var R0 = function () { return { golpes: 0, efeitos: 0, devolvido: 0, cura: 0, maior: 0, turnos: 0, dados: 0, somaDado: 0, criticos: 0, erros: 0, atordoou: 0, segurou: 0 }; };
    var r = { a: R0(), d: R0() }, hp = { a: est.a.hpMax, d: est.d.hpMax };
    var outro = function (x) { return x === 'a' ? 'd' : 'a'; };
    evs.forEach(function (ev) {
      var x = ev.de, o = outro(x);
      if (!r[x]) return;
      var eu = r[x], ele = r[o], tomou = { a: 0, d: 0 };
      eu.turnos++;
      if (ev.dado) { eu.dados++; eu.somaDado += ev.dado; if (ev.dado >= 18) eu.criticos++; if (ev.dado === 1) eu.erros++; }
      var d = Number(ev.dano) || 0;
      if (d) { eu.golpes += d; eu.maior = Math.max(eu.maior, d); tomou[o] += d; }
      var dot = (Number(ev.queimou) || 0) + (Number(ev.envenenado) || 0);
      if (dot) { ele.efeitos += dot; tomou[x] += dot; }
      if (ev.devolvido) { ele.devolvido += Number(ev.devolvido); tomou[x] += Number(ev.devolvido); }
      if (ev.escudoSegurou) ele.segurou += Number(ev.escudoSegurou);
      if (ev.atordoou) eu.atordoou += Number(ev.atordoou);
      // cura = o quanto a vida subiu além do dano que levou (cura, Luz Punitiva, roubo de vida, regeneração, Milagre)
      ['a', 'd'].forEach(function (k) {
        var agora = Number(ev['hp' + k.toUpperCase()]);
        if (isNaN(agora)) return;
        var subiu = agora - hp[k] + tomou[k];
        if (subiu > 0) r[k].cura += subiu;
        hp[k] = agora;
      });
    });
    var f = function (v) { return Math.round(v).toLocaleString('pt-BR'); };
    var linha = function (rot, va, vd, dica) {
      return '<tr' + (dica ? ' title="' + dica + '"' : '') + '><th>' + rot + '</th><td>' + va + '</td><td>' + vd + '</td></tr>';
    };
    var A = r.a, Dd = r.d;
    return '<details class="relatorio-arena" open><summary>📜 Relatório da batalha</summary><table class="tabela-relatorio">'
      + '<tr><th></th><th>' + esc(est.a.nome) + '</th><th>' + esc(est.d.nome) + '</th></tr>'
      + linha('Dano total causado', '<b>' + f(A.golpes + A.efeitos + A.devolvido) + '</b>', '<b>' + f(Dd.golpes + Dd.efeitos + Dd.devolvido) + '</b>')
      + linha('· em golpes', f(A.golpes), f(Dd.golpes))
      + ((A.efeitos || Dd.efeitos) ? linha('· queimadura / veneno', f(A.efeitos), f(Dd.efeitos)) : '')
      + ((A.devolvido || Dd.devolvido) ? linha('· dano devolvido', f(A.devolvido), f(Dd.devolvido)) : '')
      + linha('Maior golpe', f(A.maior), f(Dd.maior))
      + linha('Vida recuperada', f(A.cura), f(Dd.cura), 'Cura, roubo de vida, regeneração e Milagre')
      + ((A.segurou || Dd.segurou) ? linha('Dano segurado pelo escudo', f(A.segurou), f(Dd.segurou)) : '')
      + ((A.atordoou || Dd.atordoou) ? linha('Turnos de atordoamento causados', f(A.atordoou), f(Dd.atordoou)) : '')
      + linha('Vezes que agiu', A.turnos, Dd.turnos)
      + linha('Média do dado', A.dados ? (A.somaDado / A.dados).toFixed(1).replace('.', ',') : '—', Dd.dados ? (Dd.somaDado / Dd.dados).toFixed(1).replace('.', ',') : '—')
      + linha('Críticos (18 a 20)', A.criticos, Dd.criticos)
      + linha('Erros (1)', A.erros, Dd.erros)
      + linha('Vida no fim', f(Math.max(0, hp.a)) + ' / ' + f(est.a.hpMax), f(Math.max(0, hp.d)) + ' / ' + f(est.d.hpMax))
      + '</table></details>';
  }

  // Janela do Resumo: quem venceu, o relatório e todos os lances (o mesmo texto da luta ao vivo).
  function resumoArenaHtml() {
    var R0 = estado.resumoArena, l = R0.luta, corpo;
    if (R0.erro) corpo = '<p class="menos">' + esc(R0.erro) + '</p>';
    else if (!l) corpo = '<p class="suave centro">Carregando a luta…</p>';
    else {
      var est = l.estado, venceu = l.situacao === 'vitoria' ? est.a : est.d;
      var antes = estado.lutaArena, L = { luta: l, registro: [], tudo: true, hpA: est.a.hpMax, hpD: est.d.hpMax };
      var hpMax = { a: est.a.hpMax, d: est.d.hpMax };
      estado.lutaArena = L;
      try { (l.eventos || []).forEach(function (ev) { aplicarEventoArena(ev); }); } finally { estado.lutaArena = antes; }
      est.a.hpMax = hpMax.a; est.d.hpMax = hpMax.d;   // o resumo não muda a vida máxima guardada
      corpo = '<h3 class="subtitulo">' + esc(est.a.nome) + ' atacou ' + esc(est.d.nome) + '</h3>'
        + '<p class="destaque centro">🏆 ' + esc(venceu.nome) + ' venceu' + (l.saque ? ' · saque de <strong class="cor-ouro">' + l.saque.toLocaleString('pt-BR') + ' de ouro</strong>' : '') + '</p>'
        + relatorioArenaHtml(l)
        + '<details class="resumo-lances"><summary>🎲 Lance a lance (' + L.registro.length + ')</summary><div class="registro">' + L.registro.join('') + '</div></details>';
    }
    return '<div class="zoom-fundo" data-acao="resumo-fechar"><div class="zoom-janela desafio-janela" role="dialog" aria-label="Resumo da luta">'
      + '<button class="zoom-x" data-acao="resumo-fechar" title="Fechar">✕</button><div class="zoom-rotulo">Resumo da luta</div>' + corpo
      + '<div class="botoes"><button class="btn secundario" data-acao="resumo-fechar">Fechar</button></div></div></div>';
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
      fim += relatorioArenaHtml(L.luta);
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
    acaoServidor('sincronizarCla');   // o servidor lê as skills do banco
    atualizarFicha();
  }
  function iconeSkillCla(k) {
    return '<span class="skill-cla-ico"><img src="assets/cla/skill-' + k.id + '.webp" alt="" onerror="this.remove()"><span>' + k.simbolo + '</span></span>';
  }
  function skillsClaHtml(st) {
    var a = st.alianca, chefe = st.meu_cargo === 'lider' || st.meu_cargo === 'vice', sk = st.skills || {}, max = AL.skillPrecos.length;
    var html = '<div class="caixa-interna"><h3>Skills do clã</h3><p class="suave pequeno">Compradas pelo líder ou pelo vice-líder com o ouro do tesouro (<span class="cor-ouro">'
      + Number(a.tesouro).toLocaleString('pt-BR') + '</span>). Valem para todos os membros, para sempre: as de combate (dano, vida, resistência e velocidade) valem também na Arena; '
      + 'crítico e esquiva, só contra monstros. O nível de cada skill vai até o nível do clã (agora ' + a.nivel + ').</p></div><div class="skills-cla">';
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
    if (ACAO_SERVIDOR) { filaMissaoCla = {}; return; }   // o servidor conta sozinho (masmorra, Arena, encanto, monstros)
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
    html += '<div class="caixa-interna cla-secao"><h3>Mural</h3>' + (a.mural ? '<p class="alianca-mural">' + esc(a.mural) + '</p>' : '<p class="suave">Nenhum aviso.</p>')
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
    html += '<div class="caixa-interna cla-secao"><h3>Tesouro: <span class="cor-ouro">' + Number(a.tesouro).toLocaleString('pt-BR') + ' de ouro</span></h3>'
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
      html += '<div class="caixa-interna cla-secao"><h3>Convidar</h3><div class="linha-form"><input id="al-convidar" maxlength="16" placeholder="Nome do personagem" autocomplete="off">'
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
      // Menu em cascata (Henri, 13/11/2026): Adicionar amigo + as ações do cargo, num botão só.
      if (!eu) {
        var abertoMenu = estado.aliancaConfirmar && estado.aliancaConfirmar.split(':')[1] === x.id;
        acoes = '<details class="menu-cascata"' + (abertoMenu ? ' open' : '') + '><summary class="btn secundario btn-pequeno">Ações ▾</summary><div class="menu-cascata-itens">'
          + '<button class="btn secundario btn-pequeno" data-acao="al-amigo" data-nome="' + esc(x.nome) + '">➕ Adicionar amigo</button>' + acoes + '</div></details>';
      }
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
        estado.bossHoraEscolhida = null;
        acaoBossAl(A2.boss.hora(p.id, h), 'Boss marcado para as ' + h + 'h (horário de Brasília), todos os dias.');
        return true;
      }
      case 'al-amigo':
        C.amigos.pedir(p.id, el.dataset.nome).then(function () { avisar('Pedido de amizade enviado para ' + el.dataset.nome + '.'); }, function (e) { avisar(e.message); });
        return true;
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
      if (window.EldrinNativo) EldrinNativo.bossCla(st);
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
      // a tela do boss se redesenha sozinha: a hora escolhida (ainda sem salvar) fica guardada para não voltar
      var horaEsc = estado.bossHoraEscolhida != null ? estado.bossHoraEscolhida : Number(b.hora) || 0;
      var opcoes = '';
      for (var h = 0; h < 24; h++) opcoes += '<option value="' + h + '"' + (horaEsc === h ? ' selected' : '') + '>' + h + 'h</option>';
      html += '<div class="boss-al-hora"><label class="mercado-ordem">Hora do boss (Brasília) <select id="al-boss-hora"' + (aberto ? ' disabled' : '') + '>' + opcoes + '</select></label>'
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
      acum: Math.max(0, agoraBossAl() - Date.parse(run.criado_em)) || 0,
    };
    L.mm = { nome: L.boss.nome };
    estado.luta = L;
    // Quem começou a investida já informa o dano (vale mesmo se fechar a página no meio).
    if (run.lider === p.id && run.estado === 'andamento') {
      (ACAO_SERVIDOR
        ? C.acao(p.id, 'bossClaConcluir', { run: run.id }).then(function (x) { if (x && x.erro) throw new Error(x.erro); return x && x.resultado; })
        : C.alianca.boss.concluir(p.id, run.id, sim.danos)).then(function (r) {
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
    canal: 'global', al: { pid: null, mensagens: [], ultimoId: 0 },   // canal 'alianca': chat só dos membros
    // Sussurro (Henri, 13/11/2026): uma aba por jogador ({ nome, mensagens, ultimo, naoLidas, fechadoAte }); canal 'sus:<chave>'.
    sus: {}, susPid: null };
  function chaveSus(nome) { return String(nome || '').toLowerCase(); }
  function abaSus(nome) {
    var k = chaveSus(nome);
    if (!chat.sus[k]) chat.sus[k] = { nome: nome, mensagens: [], ultimo: 0, naoLidas: 0, fechadoAte: 0, aberta: true };
    chat.sus[k].aberta = true;
    return chat.sus[k];
  }

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
    if (m.classe === 'sistema') {   // aviso do reino (ex.: Ignaroth despertou); nivel 1 = recado do admin (SQL Editor)
      return '<p class="chat-msg chat-sistema"><span class="chat-hora">' + hora + '</span> ' + (m.nivel === 1 ? '📢 <strong>' + esc(m.personagem || 'Eldrin') + ':</strong> <strong>' : '🐉 <strong>') + esc(m.texto) + '</strong></p>';
    }
    var classe = nomeClasseX(m);
    var acoes = ehAdmin()
      ? '<span class="chat-admin"><button data-chat="apagar" data-id="' + m.id + '" title="Apagar mensagem">🗑</button>'
        + '<button data-chat="silenciar" data-nome="' + esc(m.personagem) + '" title="Silenciar jogador">🔇</button></span>'
      : '';
    // celular: balão de conversa (o meu à direita), com nome e hora em cima
    var nomeAttr = estado.personagem && m.personagem === estado.personagem.nome ? '' : ' data-chat-nome="' + esc(m.personagem) + '" title="Botão direito: amigo, clã, sussurrar"';
    if (CELULAR) return '<div class="chat-msg chat-balao' + (estado.personagem && m.personagem === estado.personagem.nome ? ' minha' : '') + '"><div class="chat-cab">'
      + siglaHtml(m.sigla) + '<strong class="chat-nome classe-' + esc(m.classe) + '"' + nomeAttr + '>' + esc(m.personagem) + '</strong> <span class="chat-info">' + classe + ' Lv ' + m.nivel + '</span>'
      + '<span class="chat-hora">' + hora + '</span></div><div class="chat-texto">' + esc(m.texto) + '</div>' + acoes + '</div>';
    return '<p class="chat-msg"><span class="chat-hora">' + hora + '</span> ' + siglaHtml(m.sigla) + '<strong class="chat-nome classe-' + esc(m.classe) + '"' + nomeAttr + '>'
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
  function linhaSussurro(nome, m) {
    var hora = new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (CELULAR) return '<div class="chat-msg chat-balao' + (m.minha ? ' minha' : '') + '"><div class="chat-cab"><strong class="chat-nome">' + (m.minha ? 'Você' : esc(nome))
      + '</strong><span class="chat-hora">' + hora + '</span></div><div class="chat-texto">' + esc(m.texto) + '</div></div>';
    return '<p class="chat-msg chat-sussurro"><span class="chat-hora">' + hora + '</span> <strong class="chat-nome">' + (m.minha ? 'Você' : esc(nome)) + '</strong>: ' + esc(m.texto) + '</p>';
  }

  // Botãozinho do Discord ao lado do Chat (Henri, 16/11/2026): discreto, na cor do Discord, abre o nosso servidor.
  var DISCORD_URL = 'https://discord.gg/85ZFvz6ye';
  function discordBotaoHtml() {
    return '<a class="chat-discord" href="' + DISCORD_URL + '" target="_blank" rel="noopener" title="Entre no Discord do ' + D.NOME_JOGO + '" aria-label="Discord do ' + D.NOME_JOGO + '">'
      + '<svg viewBox="0 0 127.14 96.36" aria-hidden="true"><path fill="currentColor" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"/></svg></a>';
  }

  function desenharChat() {
    var seloC = document.getElementById('casca-chat-selo');
    if (seloC) { seloC.hidden = !chat.naoLidas || chat.aberto; seloC.textContent = chat.naoLidas > 99 ? '99+' : chat.naoLidas; }
    if (!chat.aberto) {
      chat.el.innerHTML = '<button class="chat-botao" data-chat="abrir">💬 Chat'
        + (chat.naoLidas ? ' <span class="chat-badge">' + (chat.naoLidas > 99 ? '99+' : chat.naoLidas) + '</span>' : '') + '</button>'
        + discordBotaoHtml();
      return;
    }
    var texto = document.getElementById('chat-texto');
    var rascunho = texto ? texto.value : '';
    var focado = texto && document.activeElement === texto;
    if (chat.canal === 'alianca' && !chatDaAlianca()) chat.canal = 'global';
    var susAtual = chat.canal.indexOf('sus:') === 0 ? chat.sus[chat.canal.slice(4)] : null;
    if (chat.canal.indexOf('sus:') === 0 && (!susAtual || !susAtual.aberta)) { chat.canal = 'global'; susAtual = null; }
    var daAlianca = chat.canal === 'alianca', lista = susAtual ? susAtual.mensagens : daAlianca ? chat.al.mensagens : chat.mensagens;
    var abasSus = Object.keys(chat.sus).filter(function (k) { return chat.sus[k].aberta; });
    var titulo = chatDaAlianca() || abasSus.length
      ? '<span class="chat-canais"><button data-chat="canal" data-canal="global" class="' + (chat.canal === 'global' ? 'ativo' : '') + '">Global</button>'
        + (chatDaAlianca() ? '<button data-chat="canal" data-canal="alianca" class="' + (daAlianca ? 'ativo' : '') + '">Clã</button>' : '')
        + abasSus.map(function (k) {
          var t = chat.sus[k];
          return '<span class="chat-aba-sus' + (chat.canal === 'sus:' + k ? ' ativo' : '') + '"><button data-chat="canal" data-canal="sus:' + esc(k) + '" title="Sussurro com ' + esc(t.nome) + '">🤫 ' + esc(t.nome)
            + (t.naoLidas ? ' <span class="chat-badge">' + t.naoLidas + '</span>' : '') + '</button><button data-chat="sus-fechar" data-chave="' + esc(k) + '" title="Fechar a conversa" aria-label="Fechar a conversa com ' + esc(t.nome) + '">×</button></span>';
        }).join('') + '</span>'
      : '<strong>Chat Global</strong>';
    chat.el.innerHTML = '<div class="chat-janela"><div class="chat-topo">' + titulo
      + '<button data-chat="fechar" title="Fechar">✕</button></div>'
      + '<div class="chat-lista" id="chat-lista">' + (lista.length ? lista.map(susAtual ? function (m) { return linhaSussurro(susAtual.nome, m); } : daAlianca ? linhaChatAlianca : linhaChat).join('')
        : '<p class="suave pequeno">' + (susAtual ? 'Conversa só entre você e ' + esc(susAtual.nome) + '.' : 'Nenhuma mensagem ainda. Diga olá!') + '</p>') + '</div>'
      + '<div class="chat-envio"><input id="chat-texto" maxlength="200" placeholder="' + (susAtual ? 'Sussurrar para ' + esc(susAtual.nome) : 'Escreva como ' + esc(estado.personagem ? estado.personagem.nome : '')) + '…" autocomplete="off">'
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
      // A cada 30 s busca tudo de novo (para sumir o que o admin apagou), só com o chat aberto: fechado, só as novas
      // (gasta menos internet do Supabase; ao abrir, busca tudo).
      if (completa || (chat.aberto && C.agora() - chat.ultimaCompleta > 30000)) {
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
      if (C.sussurro && estado.personagem) await buscarSussurros();
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

  // Sussurros: abre a aba de quem mandou mensagem nova (24 h) e atualiza a conversa aberta.
  async function buscarSussurros() {
    var pid = estado.personagem.id;
    if (chat.susPid !== pid) { chat.sus = {}; chat.susPid = pid; if (chat.canal.indexOf('sus:') === 0) chat.canal = 'global'; }
    var conversas = await C.sussurro.conversas(pid);
    (conversas || []).forEach(function (c) {
      var k = chaveSus(c.nome), t = chat.sus[k], vendo = chat.aberto && chat.canal === 'sus:' + k;
      if (!t) {
        if (!c.dele) return;
        t = chat.sus[k] = { nome: c.nome, mensagens: [], ultimo: Number(c.ultimo), naoLidas: vendo ? 0 : 1, fechadoAte: 0, aberta: true };
        if (!vendo) chat.naoLidas++;
        return;
      }
      if (Number(c.ultimo) > t.ultimo) {
        if (c.dele && !vendo) { t.naoLidas++; if (!chat.aberto) chat.naoLidas++; }
        if (c.dele && !t.aberta && Number(c.ultimo) > t.fechadoAte) t.aberta = true;
        t.ultimo = Number(c.ultimo);
      }
    });
    if (chat.aberto && chat.canal.indexOf('sus:') === 0) {
      var tab = chat.sus[chat.canal.slice(4)];
      if (tab) {
        tab.mensagens = await C.sussurro.listar(pid, tab.nome) || [];
        if (tab.mensagens.length) tab.ultimo = Math.max(tab.ultimo, Number(tab.mensagens[tab.mensagens.length - 1].id));
        tab.naoLidas = 0;
      }
    }
  }
  // Menu do nome no chat global (botão direito; no celular, toque): amigo, convidar para o clã, sussurrar.
  function abrirMenuChat(nome, x, y) {
    fecharMenuChat();
    var m = document.createElement('div');
    m.className = 'chat-menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = '<p class="chat-menu-nome">' + esc(nome) + '</p>'
      + '<button role="menuitem" data-chat="m-amigo" data-nome="' + esc(nome) + '">➕ Adicionar como amigo</button>'
      + (chatDaAlianca() ? '<button role="menuitem" data-chat="m-cla" data-nome="' + esc(nome) + '">🛡️ Convidar para o clã</button>' : '')
      + '<button role="menuitem" data-chat="m-sussurrar" data-nome="' + esc(nome) + '">🤫 Sussurrar</button>';
    document.body.appendChild(m);
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
    m.addEventListener('click', cliqueChat);
    var b = m.querySelector('button'); if (b) b.focus();
    chat.menu = m;
  }
  function fecharMenuChat() { if (chat.menu) { chat.menu.remove(); chat.menu = null; } }
  document.addEventListener('click', function (e) { if (chat.menu && !chat.menu.contains(e.target)) fecharMenuChat(); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharMenuChat(); });
  document.addEventListener('contextmenu', function (e) {
    var n = e.target.closest && e.target.closest('#chat [data-chat-nome]');
    if (!n) return;
    e.preventDefault();
    abrirMenuChat(n.dataset.chatNome, e.clientX, e.clientY);
  });

  async function enviarChat() {
    var campo = document.getElementById('chat-texto');
    var texto = campo.value.trim();
    if (!texto || !estado.personagem) return;
    try {
      if (chat.canal.indexOf('sus:') === 0 && C.sussurro) {
        var tabE = chat.sus[chat.canal.slice(4)];
        if (tabE) await C.sussurro.enviar(estado.personagem.id, tabE.nome, texto);
      } else if (chat.canal === 'alianca') await C.alianca.chatEnviar(estado.personagem.id, texto);
      else await C.chat.enviar(estado.personagem.nome, texto);
      campo.value = '';
      buscarChat();
    } catch (e) { avisar(e.message); }
  }

  async function cliqueChat(e) {
    var nomeEl = CELULAR && e.target.closest('[data-chat-nome]');
    if (nomeEl) { var r0 = nomeEl.getBoundingClientRect(); abrirMenuChat(nomeEl.dataset.chatNome, r0.left, r0.bottom + 4); return; }
    var el = e.target.closest('[data-chat]');
    if (!el) return;
    var acao = el.dataset.chat;
    if (acao.indexOf('m-') === 0) fecharMenuChat();
    if (acao === 'm-amigo') {
      try { await C.amigos.pedir(estado.personagem.id, el.dataset.nome); avisar('Pedido de amizade enviado para ' + el.dataset.nome + '.'); } catch (erro) { avisar(erro.message); }
      return;
    }
    if (acao === 'm-cla') {
      try { await C.alianca.convidar(estado.personagem.id, el.dataset.nome); avisar('Convite do clã enviado para ' + el.dataset.nome + '.'); } catch (erro) { avisar(erro.message); }
      return;
    }
    if (acao === 'm-sussurrar') {
      if (!C.sussurro) { avisar('O sussurro precisa do servidor.'); return; }
      var t = abaSus(el.dataset.nome);
      t.naoLidas = 0;
      chat.canal = 'sus:' + chaveSus(el.dataset.nome);
      chat.aberto = true;
      desenharChat();
      var cx = document.getElementById('chat-texto'); if (cx) cx.focus();
      buscarChat();
      return;
    }
    if (acao === 'sus-fechar') {
      var tf = chat.sus[el.dataset.chave];
      if (tf) { tf.aberta = false; tf.fechadoAte = tf.ultimo; tf.naoLidas = 0; }
      if (chat.canal === 'sus:' + el.dataset.chave) chat.canal = 'global';
      desenharChat();
      return;
    }
    if (acao === 'abrir' || acao === 'fechar') {
      chat.aberto = acao === 'abrir';
      chat.naoLidas = 0;
      desenharChat();
      if (chat.aberto) { document.getElementById('chat-texto').focus(); buscarChat(true); }
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
  function jaInstalado() { return (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) || (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function ehIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function ehCelular() { return ehIOS() || /android|mobi/i.test(navigator.userAgent); }
  // No celular aparece sempre (se ainda não instalou); no computador, só quando o navegador deixa instalar.
  function podeInstalar() { return !jaInstalado() && (!!instalacao.evento || ehCelular()); }
  // App Android (APK) para baixar direto do site; some no iPhone e dentro do próprio app.
  function botaoInstalar() {
    return '<button class="btn largo btn-instalar" data-acao="instalar-app"' + (podeInstalar() ? '' : ' hidden') + '>📲 Instalar para celular</button>'
      + (jaInstalado() || ehIOS() ? '' : '<a class="btn secundario largo btn-apk" href="https://github.com/danieelozorio/TANKA/releases/download/app-android/Eldrin-app.apk">🤖 Baixar app Android (APK)</a>'
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
  // Tema escolhido na ⚙ (classica, zealot ou arcane). A Arcane usa as telas da Clássica, só muda o visual (css/tema-arcane.css).
  // Aparelho de toque com tela pequena (o mesmo teste do jogar/index.html), mesmo quando o jogador escolheu a Arcane.
  function ehCelularAparelho() { return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 820); }
  function temaAtual() { var t = document.documentElement.getAttribute('data-interface'); return t === 'zealot' || t === 'arcane' ? t : 'classica'; }
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
  // Trocar de app ou esconder a aba (Henri, nov/2026): a música para na hora e volta quando o jogo aparecer de novo.
  // Pausa direto (sem sumir aos poucos): com o app no fundo os relógios do navegador quase não rodam.
  function musicaParaFundo() {
    var a = musica.atual;
    if (a && a.audio && !a.audio.paused) { a.audio.pause(); musica.pausadaNoFundo = true; desenharBotaoMusica(); }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { musicaParaFundo(); return; }
    if (musica.pausadaNoFundo) { musica.pausadaNoFundo = false; tocarMusica(); }
  });
  window.addEventListener('pagehide', musicaParaFundo);
  window.addEventListener('blur', function () { if (document.hidden) musicaParaFundo(); });
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
        if (b.dataset.interface === temaAtual()) return;
        if (b.dataset.interface === 'arcane' && !vipGuardado()) { avisar('👑 A interface Arcane é exclusiva do VIP. Veja na aba Loja.'); return; }
        guardar('eldrin.interface', b.dataset.interface);
        try { document.cookie = 'eldrin_interface=' + b.dataset.interface + '; path=/; max-age=31536000; SameSite=Lax'; } catch (e) { /* ignora */ }
        setTimeout(function () { location.reload(); }, 150);   // dá tempo de gravar (iPhone)
      });
    });
  }
  // Configurações (Daniel, 20/11/2026): um painel só, pelo ⚙ e pelo menu, com Interface (tema), Resolução (tamanho
  // da tela, só no computador) e Som (música e efeitos).
  var ESCALAS = [[0.8, '80%'], [0.9, '90%'], [1, '100%'], [1.1, '110%'], [1.25, '125%']];
  function escalaAtual() { var z = parseFloat(document.documentElement.style.getPropertyValue('--escala')); return z > 0 ? z : 1; }
  function aplicarEscala(z) {
    var h = document.documentElement;
    h.style.zoom = z === 1 ? '' : String(z);
    if (z === 1) h.style.removeProperty('--escala'); else h.style.setProperty('--escala', String(z));
    guardar('eldrin.escala', String(z));
    window.dispatchEvent(new Event('resize'));
  }
  function alternarPainel(fechar) {
    if (musica.painel || fechar) {
      if (musica.painel) { musica.painel.remove(); musica.painel = null; }
      return;
    }
    var p = musica.painel = document.createElement('div');
    p.id = 'config-painel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Configurações');
    var temas = ehCelularAparelho() ? [['zealot', 'Zealot'], ['arcane', '👑 Arcane']] : [['classica', 'Clássica'], ['zealot', 'Zealot'], ['arcane', '👑 Arcane']];
    var opcoes = function (lista, ativa, attr, rotulo) {
      return '<div class="config-interface" role="radiogroup" aria-label="' + rotulo + '">' + lista.map(function (x) {
        var sel = x[0] === ativa;
        return '<button type="button" role="radio" aria-checked="' + sel + '" class="btn mini-opcao' + (sel ? '' : ' secundario') + '" ' + attr + '="' + x[0] + '">' + (sel ? '✔ ' : '') + x[1] + '</button>';
      }).join('') + '</div>';
    };
    p.innerHTML = '<div class="config-topo"><strong>⚙ Configurações</strong><button class="config-fechar" aria-label="Fechar">✕</button></div>'
      + '<h4 class="config-secao">🎨 Interface</h4><div class="config-faixa">' + opcoes(temas, temaAtual(), 'data-interface', 'Tema') + '</div>'
      + (ehCelularAparelho() ? '' : '<h4 class="config-secao">🖥 Resolução</h4><div class="config-faixa"><span class="suave pequeno">Tamanho da tela do jogo</span>'
        + opcoes(ESCALAS, escalaAtual(), 'data-escala', 'Resolução') + '</div>')
      + '<h4 class="config-secao">🔊 Som</h4>'
      + '<label class="config-linha"><span>Música</span><input type="checkbox" id="config-musica"' + (musica.ligada ? ' checked' : '') + '></label>'
      + '<label class="config-faixa"><span>Volume da música <b id="config-vol-txt">' + musica.volume + '%</b></span>'
      + '<input type="range" id="config-volume" min="0" max="100" step="5" value="' + musica.volume + '"></label>'
      + '<label class="config-faixa"><span>Volume dos efeitos <b id="config-efe-txt">' + musica.efeitos + '%</b></span>'
      + '<input type="range" id="config-efeitos" min="0" max="100" step="5" value="' + musica.efeitos + '"></label>'
      + '<p class="config-tocando suave pequeno"></p>' + botaoInstalar();
    ligarPainelInterface(p);
    p.querySelectorAll('[data-escala]').forEach(function (b) {
      b.addEventListener('click', function () { aplicarEscala(parseFloat(b.dataset.escala)); alternarPainel(true); alternarPainel(); });
    });
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
    if (musica.painel && !e.target.closest('#config-painel') && !e.target.closest('#botao-musica, [data-acao="menu-som"], [data-acao="menu-interface"], [data-acao="menu-config"]')) alternarPainel(true);
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

  // Ícones pintados da Zealot (Daniel, 20/11/2026; artes em assets/interface/icones, folhas em .../originais).
  // Trocam os desenhos de linha das abas, sub-abas, recursos e botões só nesta interface.
  if (interfaceAtual() === 'zealot') (function () {
    var pintado = function (n) { return '<img class="ico-pintado" src="assets/interface/icones/' + n + '.webp" alt="" aria-hidden="true" draggable="false">'; };
    ['heroi', 'aventura', 'evento', 'arena', 'mercado', 'social', 'leilao', 'loja', 'menu', 'sair', 'admin', 'som', 'ouro', 'reputacao', 'estamina', 'config']
      .forEach(function (k) { ICONES[k] = pintado(k); });
    ICONES.trocarPersonagem = pintado('trocar');
    ['personagem', 'bau', 'encantar', 'torre', 'eventos', 'habilidades', 'ascensao', 'cacar', 'masmorra', 'historia', 'ranking', 'alianca',
      'oficina', 'mercadoNegro', 'mineracao', 'mundial', 'oficinas'].forEach(function (k) { ICONES_SUB[k] = pintado(k); });
    ICONES_SUB.social = pintado('amigos');
    ICONES_SUB.mercado = pintado('mercado');
    ICONES_SUB.leilao = pintado('leilao');
    ICONES_SUB.loja = pintado('loja');
    ICONE_POCAO = pintado('pocao');
    ICONE_CARTA = pintado('carta');
    ICONE_SINO = pintado('sino');
  })();

  // "Sensação de jogo" na Zealot (Daniel, 20/11/2026): troca de aba com a pedra deslizando, sons de interface
  // (clique de pedra nas abas, moedas no ganho de ouro, baú abrindo) e golpe na caçada (evento do zealot-efeitos.js).
  if (interfaceAtual() === 'zealot') (function () {
    var telaAntes = telaJogo, abaAntes = null, trocouEm = 0, ultimaMoeda = 0, ultimoGolpe = 0;
    telaJogo = function () {
      var r = telaAntes.apply(this, arguments), a = estado.aba + '|' + (estado.cacada ? 1 : 0) + '|' + (estado.luta || estado.lutaArena ? 1 : 0);
      if (abaAntes !== null && a !== abaAntes) trocouEm = Date.now();
      abaAntes = a;
      // a aba nova costuma redesenhar logo depois (dados chegando): a animação continua de onde estava
      var passou = Date.now() - trocouEm, c = passou < 300 && document.querySelector('.jogo > section.caixa');
      if (c && !c.classList.contains('aba-entrou')) { c.style.animationDelay = (-passou) + 'ms'; c.classList.add('aba-entrou'); }
      return r;
    };
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      if (t.closest('[data-acao="login-pegar"], [data-acao="mochila-aba"][data-valor="bau"]')) Sons.bau();
      else if (t.closest('[data-acao="aba"], .sub-abas button, [data-acao="mochila-aba"], .menu-config-btn, .menu-jogo > summary')) Sons.clique();
    }, true);
    window.addEventListener('eldrin:ganho', function (e) {
      var d = e.detail || {};
      if (d.ouro > 0 && Date.now() - ultimaMoeda > 600) { ultimaMoeda = Date.now(); Sons.moedas(); }
      if (d.nivel || (d.lendarios && d.lendarios.length)) Sons.sucesso();
    });
    window.addEventListener('eldrin:golpe', function (e) {
      if (Date.now() - ultimoGolpe < 140) return;
      ultimoGolpe = Date.now();
      Sons.golpe(e.detail && e.detail.forte);
    });
  })();

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

  voltaDoPagamento();
  // Voltou da página do Mercado Pago pelo botão "voltar" (página guardada pelo navegador): libera os botões de compra.
  window.addEventListener('pageshow', function (e) { if (e.persisted && estado.eterPagando) { estado.eterPagando = false; if (estado.aba === 'loja') telaJogo(); } });
  C.iniciar().then(function (conta) {
    estado.conta = conta;
    if (conta) { if (!retomarJogo()) depoisDeEntrar(); } else telaAuth('entrar');
  });
})();
