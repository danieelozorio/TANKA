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
  function avisar(msg, tipo) {
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
    return '<header class="marca"><h1>' + D.NOME_JOGO.toUpperCase() + '</h1><p>Arena medieval mística</p></header>';
  }
  function rodape() {
    return '<footer class="rodape">' + D.DOMINIO + '</footer>';
  }
  function topo(extra) {
    return '<header class="topo"><span class="logo">' + D.NOME_JOGO.toUpperCase() + '</span>'
      + '<div class="acoes"><span class="suave">' + esc(estado.conta.usuario) + '</span>'
      + (ehAdmin() ? '<span class="selo selo-admin">ADMIN</span>' : '') + (extra || '')
      + '<button class="btn secundario" data-acao="sair">Sair</button></div></header>';
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
    return '<span class="raridade-' + item.raridade + (b ? ' brilho-' + b : '') + '">' + esc(R.nomeItem(item)) + '</span>';
  }

  // "Pergaminho para item raro/épico..." (concorda com "item").
  var ITEM_RARIDADE = { comum: 'comum', rara: 'raro', epica: 'épico', lendaria: 'lendário' };

  function tipoItem(item) {
    return item.tipo === 'arma' ? D.armas[item.classe].tipo : R.definicao(item).tipo;
  }

  // Resumo do que o item dá: "Dano 3–5" ou "Defesa +5 · Vida +25".
  function descricaoItem(item) {
    if (item.tipo === 'arma') return 'Dano ' + dano(R.danoArma(item)) + (item.variacao === undefined ? ' (sorteado)' : '');
    var b = R.bonusItem(item);
    return Object.keys(b).map(function (k) { return D.bonus[k] + ' +' + b[k]; }).join(' · ');
  }

  // Quadradinho com ícone, borda da raridade, brilho do encantamento e "+N".
  function quadroItem(item, classe, atributos) {
    var b = brilho(item);
    return '<button class="' + classe + ' borda-' + item.raridade + aura(item)
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
      C.salvarPersonagem(estado.personagem).catch(function (e) { avisar('Não foi possível salvar: ' + e.message); });
    } catch (e) { avisar(e.message); }
  }

  // ---------------- Login / cadastro ----------------

  function telaAuth(modo, erro) {
    chatVisivel(false);
    var cadastro = modo === 'cadastro';
    var form = cadastro
      ? '<form data-form="cadastro" novalidate>'
        + '<label>Nome de usuário<input name="usuario" autocomplete="username" required maxlength="16"></label>'
        + '<label>Senha<input name="senha" type="password" autocomplete="new-password" required></label>'
        + '<label>Confirmar senha<input name="confirmar" type="password" autocomplete="new-password" required></label>'
        + '<label>E-mail<input name="email" type="email" autocomplete="email" required></label>'
        + '<p class="erro">' + esc(erro || '') + '</p>'
        + '<button class="btn largo" type="submit">Criar conta</button></form>'
      : '<form data-form="entrar" novalidate>'
        + '<label>Nome de usuário<input name="usuario" autocomplete="username" required></label>'
        + '<label>Senha<input name="senha" type="password" autocomplete="current-password" required></label>'
        + '<p class="erro">' + esc(erro || '') + '</p>'
        + '<button class="btn largo" type="submit">Entrar</button></form>';
    app.innerHTML = marca()
      + '<section class="auth"><div class="caixa">'
      + '<div class="abas"><button data-acao="auth" data-modo="entrar" class="' + (cadastro ? '' : 'ativa') + '">Entrar</button>'
      + '<button data-acao="auth" data-modo="cadastro" class="' + (cadastro ? 'ativa' : '') + '">Cadastrar</button></div>'
      + form + '</div></section>' + rodape();
    var primeiro = app.querySelector('input');
    if (primeiro) primeiro.focus();
  }

  // ---------------- Seleção de personagens ----------------

  function telaPersonagens() {
    chatVisivel(false);
    var lista = estado.conta.personagens;
    var cartas = lista.map(function (p) {
      var topoCarta = '<div class="carta"><div class="moldura">' + F.personagem(p.raca, p.classe, p.sexo) + '</div>'
        + '<div class="nome">' + esc(p.nome) + '</div>'
        + '<div class="detalhe">' + D.racas[p.raca].nome + ' · ' + D.classes[p.classe].nome + ' · Lv ' + p.nivel + '</div>';
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
    app.innerHTML = topo() + '<div class="conteudo"><h2>Seus personagens</h2>'
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
        + '<div class="moldura">' + F.imagemRaca(k, c.sexo) + '</div><div class="nome">' + r.nome + '</div></button>';
    }).join('');
    var classesPermitidas = D.racas[c.raca].classes;
    var classes = classesPermitidas.map(function (k) {
      return '<button class="carta' + (c.classe === k ? ' selecionada' : '') + '" data-acao="escolher-classe" data-valor="' + k + '">'
        + '<div class="moldura">' + F.personagem(c.raca, k, c.sexo) + '</div><div class="nome">' + D.classes[k].nome + '</div>'
        + '<div class="detalhe">' + D.armas[k].tipo + '</div></button>';
    }).join('');

    var base = D.classes[c.classe].atributos;
    var final = R.atributosIniciais(c.raca, c.classe);
    var linhas = R.ATRIBUTOS.map(function (k) {
      var mod = final[k] - base[k];
      var modTxt = mod > 0 ? '<span class="mais">+' + mod + '</span>' : mod < 0 ? '<span class="menos">' + mod + '</span>' : '—';
      return '<tr><td>' + D.atributos[k].nome + '</td><td>' + base[k] + '</td><td>' + modTxt + '</td><td><strong>' + final[k] + '</strong></td></tr>';
    }).join('');

    app.innerHTML = topo('<button class="btn secundario" data-acao="voltar-personagens">Voltar</button>')
      + '<div class="conteudo"><div class="criacao"><div>'
      + '<section class="etapa"><h2>1. Nome</h2><label>Nome do personagem'
      + '<input id="nome-personagem" maxlength="16" value="' + esc(c.nome) + '" placeholder="Ex.: Aldric"></label></section>'
      + '<section class="etapa"><h2>2. Sexo</h2><div class="opcoes">' + sexos + '</div></section>'
      + '<section class="etapa"><h2>3. Raça <small>— ' + esc(D.racas[c.raca].descricao) + '</small></h2><div class="grade">' + racas + '</div></section>'
      + '<section class="etapa"><h2>4. Classe <small>— ' + esc(D.classes[c.classe].descricao) + '</small></h2><div class="grade">' + classes + '</div></section>'
      + '</div><aside class="caixa previa"><div class="moldura">' + F.personagem(c.raca, c.classe, c.sexo) + '</div>'
      + '<h3 class="centro">' + D.racas[c.raca].nome + ' ' + D.classes[c.classe].nome + ' · ' + D.sexos[c.sexo].nome + '</h3>'
      + '<table class="atributos"><thead><tr><th>Atributo</th><th>Classe</th><th>Raça</th><th>Total</th></tr></thead><tbody>' + linhas + '</tbody></table>'
      + '<p class="suave" style="margin-top:.8em">Começa no level 1 com ' + D.HP_INICIAL + ' HP e ' + D.armas[c.classe].comum[0] + ' (dano ' + D.ARMA_INICIAL_DANO.join('–') + ').</p>'
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
      if (!(await C.nomePersonagemLivre(nome))) throw new Error('Esse nome já está em uso em Tanka.');
      await C.criarPersonagem(p);
    } catch (e) {
      erro.textContent = e.message;
      if (botao) botao.disabled = false;
      return;
    }
    estado.personagem = p;
    estado.conta = C.contaAtual();
    estado.criacao = null;
    avisar('Bem-vindo a Tanka, ' + nome + '!');
    abrirJogo(p.id);
  }

  // ---------------- Jogo ----------------

  function abrirJogo(id) {
    estado.personagem = R.normalizar(estado.conta.personagens.find(function (p) { return p.id === id; }));
    estado.aba = 'personagem';
    estado.chefeAviso = null;
    estado.area = D.areas.filter(function (a) { return R.areaLiberada(estado.personagem, a); }).pop().id;
    estado.vendaPendente = null;
    estado.itemFoco = null;
    estado.mercadoRaridade = 'comum';
    estado.resultado = null;
    R.atualizarTempo(estado.personagem, C.agora());
    salvar();   // também marca o personagem como online para os amigos
    estado.social = null;
    estado.gm = null;
    estado.luta = null;
    telaJogo();
    carregarSocial();
    carregarGrupo();
    estado.arena = null;
    estado.lutaArena = null;
    carregarArena();
    estado.alianca = null;
    estado.aliancaCriar = estado.aliancaBrasao = estado.aliancaConfirmar = null;
    carregarAlianca();
  }

  function tempoTexto(ms) {
    var min = Math.ceil(ms / 60000);
    return min >= 60 ? Math.floor(min / 60) + 'h ' + (min % 60) + 'min' : min + ' min';
  }

  // Vida com o tempo, acampamento, poções do dia e contagem até o reset.
  function vidaTempoHtml(p, s, emBatalha) {
    var min = R.minutosParaVidaCheia(p);
    var texto = emBatalha ? 'Em batalha: a vida não volta.'
      : min ? 'Vida cheia em ' + tempoTexto(min * 60000) + (p.acampado ? ' (acampado)' : '') : 'Vida cheia';
    var acampar = p.acampado
      ? '<button class="btn largo" data-acao="levantar"' + (emBatalha ? ' disabled' : '') + '>Levantar acampamento</button>'
      : '<button class="btn secundario largo" data-acao="acampar"' + (emBatalha || p.hpAtual >= s.hpMax ? ' disabled' : '') + '>Acampar (vida 3x mais rápido)</button>';
    return '<div class="suave pequeno vida-tempo">' + texto + '</div>' + acampar;
  }

  // Ícones (traço dourado) da barra de recursos e das abas.
  function svg(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; }
  var ICONES = {
    ouro: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>'),
    reputacao: svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
    pocao: svg('<path d="M9.5 3h5M10.5 3v5L6 15.5A3.5 3.5 0 0 0 9 21h6a3.5 3.5 0 0 0 3-5.5L13.5 8V3"/><path d="M7.5 14h9"/>'),
    arena: svg('<path d="M4 4l9 9M4 4v3.5M4 4h3.5M20 4l-9 9M20 4v3.5M20 4h-3.5M7 15l-3 3 2 2 3-3M17 15l3 3-2 2-3-3"/>'),
    heroi: svg('<path d="M12 3l7 3v5.5c0 4.3-3 8-7 9.5-4-1.5-7-5.2-7-9.5V6z"/><path d="M12 8v8M9 11h6"/>'),
    aventura: svg('<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12 7l5 5"/>'),
    mercado: svg('<path d="M5 8h14l-1.2 11.5a1.5 1.5 0 0 1-1.5 1.5H7.7a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
    social: svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.8 14.5c2.3.2 3.9 1.9 4.4 4.6"/>'),
    cadeado: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10V7.5a5 5 0 0 1 10 0V10h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7.5a3 3 0 0 0-6 0z"/></svg>',
    admin: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  };

  // Barra fixa no alto: ouro, reputação, poções do dia e entradas da Arena.
  function recursosHtml() {
    var p = estado.personagem, s = R.status(p), emBatalha = !!estado.batalha;
    var podeUsar = !emBatalha && p.pocoes > 0 && p.hpAtual < s.hpMax;
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
      + recurso('r-vida', 'Vida', '♥', 'Vida', p.hpAtual + '/' + s.hpMax)
      + recurso('r-ouro', 'Ouro', ICONES.ouro, 'Ouro', p.ouro.toLocaleString('pt-BR'))
      + recurso('r-reputacao', 'Reputação', ICONES.reputacao, 'Reputação', (p.reputacao || 0).toLocaleString('pt-BR'))
      + recurso('r-pocao', 'Poções do dia · reset em ' + tempoTexto(R.msAteReset(C.agora())) + ' (vida cheia e 2 poções)', ICONES.pocao, 'Poções',
        '<span id="ficha-pocoes">' + (emBatalha ? estado.batalha.pocoes : p.pocoes) + '/' + D.VIDA.pocoesPorDia + '</span>',
        '<button class="rec-usar" data-acao="usar-pocao"' + (podeUsar ? '' : ' disabled') + ' title="Beber uma poção">Usar</button>')
      + recurso('r-arena', 'Entradas da Arena', ICONES.arena, arenaRotulo, arena)
      + '</div></div>';
  }

  // Redesenha a ficha e a barra de recursos sem mexer no resto da tela.
  function atualizarFicha() {
    [['.ficha', fichaHtml], ['#recursos', recursosHtml]].forEach(function (x) {
      var velho = document.querySelector(x[0]);
      if (!velho) return;
      var nova = document.createElement('div');
      nova.innerHTML = x[1]();
      velho.replaceWith(nova.firstChild);
    });
  }

  // As abas em 5 grupos (no celular viram a barra de baixo).
  var GRUPOS = [
    { id: 'heroi', nome: 'Herói', abas: ['personagem', 'encantar'] },
    { id: 'aventura', nome: 'Aventura', abas: ['cacar', 'masmorra'] },
    { id: 'arena', nome: 'Arena', abas: ['arena'] },
    { id: 'mercado', nome: 'Mercado', abas: ['mercado'] },
    { id: 'social', nome: 'Social', abas: ['social', 'ranking', 'alianca'] },
  ];
  var NOME_ABA = { personagem: 'Personagem', encantar: 'Encantar', cacar: 'Caçar', masmorra: 'Masmorra', social: 'Amigos', ranking: 'Ranking', alianca: 'Aliança' };
  function grupoDaAba(aba) { return GRUPOS.filter(function (g) { return g.abas.indexOf(aba) >= 0; })[0]; }
  function seloDaAba(aba) { return aba === 'masmorra' ? seloMasmorra() : aba === 'arena' ? seloArena() : aba === 'social' ? seloPedidos() : aba === 'alianca' ? seloAlianca() : ''; }
  function navHtml() {
    var atual = grupoDaAba(estado.aba);
    var nav = '<nav class="abas-jogo" id="abas-jogo">' + GRUPOS.map(function (g) {
      var destino = estado.subAba[g.id] || g.abas[0];
      return '<button data-acao="aba" data-aba="' + destino + '" class="' + (atual === g ? 'ativa' : '') + '">'
        + '<span class="aba-ico">' + ICONES[g.id] + g.abas.map(seloDaAba).join('') + '</span><span class="aba-nome">' + g.nome + '</span></button>';
    }).join('') + '</nav>';
    var sub = atual && atual.abas.length > 1 ? '<nav class="sub-abas" id="sub-abas">' + atual.abas.map(function (a) {
      return '<button data-acao="aba" data-aba="' + a + '" class="' + (estado.aba === a ? 'ativa' : '') + '">' + NOME_ABA[a] + seloDaAba(a) + '</button>';
    }).join('') + '</nav>' : '';
    return nav + sub;
  }
  // Atualiza só os selos das abas (pedidos de amizade, convites, ataques na Arena).
  function atualizarNav() {
    var nav = document.getElementById('abas-jogo');
    if (!nav) return;
    var sub = document.getElementById('sub-abas');
    var tmp = document.createElement('div');
    tmp.innerHTML = navHtml();
    nav.replaceWith(tmp.querySelector('#abas-jogo'));
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
      ['Defesa', mudanca(s.defesa, sNovo.defesa, String), 'Diminui em porcentagem o dano físico que você recebe.'],
      ['Defesa mágica', mudanca(s.defesaMagica, sNovo.defesaMagica, String), 'Diminui em porcentagem o dano mágico que você recebe.'],
      ['Velocidade', mudanca(s.velocidade, sNovo.velocidade, String), 'Quem é mais rápido ataca mais vezes. Sobe com o level.'],
      ['Precisão', mudanca(s.precisao, sNovo.precisao, pct), 'Chance de acertar o golpe.'],
      ['Evasão', mudanca(s.evasao, sNovo.evasao, pct), 'Chance de desviar de um ataque.'],
      ['Chance de crítico', mudanca(s.chanceCritico, sNovo.chanceCritico, pct), 'Chance de um golpe físico ser crítico.'],
      ['Dano crítico', mudanca(s.danoCritico, sNovo.danoCritico, pct), 'Quanto o golpe crítico físico causa (150% = 1,5x).'],
      ['Crítico mágico', mudanca(s.chanceCriticoMagico, sNovo.chanceCriticoMagico, pct), 'Chance de uma magia ser crítica.'],
      ['Dano crítico mágico', mudanca(s.danoCriticoMagico, sNovo.danoCriticoMagico, pct), 'Quanto a magia crítica causa.'],
      ['Sucesso no craft', mudanca(s.chanceCraft, sNovo.chanceCraft, pct), 'Chance de sucesso ao fabricar itens (em breve).'],
      ['Bônus de drop', mudanca(s.bonusDrop, sNovo.bonusDrop, function (v) { return '+' + v + '%'; }), 'Aumenta a chance de itens e pergaminhos caírem.'],
      ['Encantamento', mudanca(s.chanceEncantamento, sNovo.chanceEncantamento, pct), 'Bônus na chance de sucesso ao encantar.'],
    ].map(function (l) { return '<dt title="' + l[2] + '">' + l[0] + '</dt><dd>' + l[1] + '</dd>'; }).join('');

    return '<aside class="caixa ficha">'
      + '<div class="cabeca"><div class="moldura">' + F.personagem(p.raca, p.classe, p.sexo) + '</div><div>'
      + '<h2>' + esc(p.nome) + '</h2><div class="suave">' + D.racas[p.raca].nome + ' · ' + D.classes[p.classe].nome + '</div>'
      + '<div class="nivel">Level ' + p.nivel + '</div></div></div>'
      + '<div class="suave">Vida</div><div id="ficha-hp">' + barra('hp', p.hpAtual, s.hpMax, p.hpAtual + ' / ' + s.hpMax, 'ficha') + '</div>'
      + '<div class="suave">Experiência</div>' + (p.nivel >= D.NIVEL_MAXIMO
        ? barra('exp', 1, 1, 'Level máximo')
        : barra('exp', p.exp, precisa, p.exp.toLocaleString('pt-BR') + ' / ' + precisa.toLocaleString('pt-BR')))
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
      + '<div class="secao"><h3>Status</h3><dl class="status">' + status + '</dl></div></div>')
      + '</aside>';
  }

  // ----- Pontos de atributo: escolher com + e −, conferir a prévia e só então confirmar -----
  var DESCRICAO_ATRIBUTO = {
    for: 'Aumenta o ataque físico e o dano dos golpes críticos.',
    des: 'Aumenta a precisão, a evasão e a chance de magia crítica.',
    res: 'Aumenta a vida, a defesa e a defesa mágica.',
    int: 'Aumenta o ataque mágico (dano dos magos).',
    sor: 'Aumenta a chance de crítico, o dano crítico mágico, o drop, o encantamento e o craft.',
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
  var REGRAS_ATRIBUTO = {
    for: { ganhos: ['+1 de Ataque a cada 5 pontos (soma no dano dos golpes físicos)', '+1% de dano crítico por ponto'], degrau: [5, 'Ataque'] },
    des: { ganhos: ['+1% de precisão por ponto', '+0,5% de evasão por ponto', '+0,5% de chance de magia crítica por ponto'] },
    res: { ganhos: ['+' + D.HP_POR_RES + ' de vida por ponto', '+1 de defesa e +1 de defesa mágica a cada 10 pontos'], degrau: [10, 'Defesa'] },
    int: { ganhos: ['+1 de Ataque mágico a cada 5 pontos (soma no dano das magias)'], degrau: [5, 'Ataque mágico'] },
    sor: { ganhos: ['+0,5% de chance de crítico por ponto', '+1% de dano crítico mágico por ponto', '+1% de drop, de encantamento e de craft por ponto'] },
  };
  function dicaAtributo(p, k, pend) {
    var r = REGRAS_ATRIBUTO[k], total = p.atributos[k] + R.bonusEquipamentos(p)[k] + (pend[k] || 0);
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
    var extra = (arma.encanto || 0) * D.encantamento.danoPorNivel[arma.raridade];
    var chance = magico ? s.chanceCriticoMagico : s.chanceCritico, mult = magico ? s.danoCriticoMagico : s.danoCritico;
    function stat(rotulo, valor, dica) {
      return '<div class="arma-stat"' + (dica ? ' title="' + dica + '"' : '') + '><small>' + rotulo + '</small><strong>' + valor + '</strong></div>';
    }
    return '<div class="arma-carta carta-' + arma.raridade + '">'
      + '<div class="arma-topo"><div class="icone-pequeno arma-icone borda-' + arma.raridade + aura(arma) + '">' + F.icone(arma)
      + (arma.encanto ? '<span class="nivel-encanto">+' + arma.encanto + '</span>' : '') + '</div><div class="arma-nome">' + nomeItemHtml(arma)
      + '<div><span class="selo raridade-' + arma.raridade + '">' + D.raridades[arma.raridade].nome + '</span>'
      + ' <span class="suave pequeno">' + (magico ? 'Dano mágico' : 'Dano físico') + '</span></div></div></div>'
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

  function cartaMonstro(id) {
    var p = estado.personagem, s = R.status(p), m = D.monstros[id];
    var ritmo = m.velocidade / Math.max(1, s.velocidade);
    var fator = R.fatorExp(p, id);
    return '<article class="monstro"><div class="moldura">' + F.imagemMonstro(id) + '</div><div class="corpo">'
      + '<h3>' + m.nome + '</h3><p class="suave">' + m.descricao + '</p>'
      + '<dl class="ficha-monstro"><dt>Vida</dt><dd>' + m.hp.toLocaleString('pt-BR') + '</dd><dt>Ataque</dt><dd>' + dano(m.ataque) + '</dd>'
      + '<dt title="Reduz o seu dano em porcentagem">Defesa</dt><dd>' + m.defesa + ' <small class="suave">(−' + Math.round(100 - 10000 / (100 + m.defesa)) + '% de dano)</small></dd>'
      + '<dt>Velocidade</dt><dd>' + m.velocidade + '</dd><dt title="Quantas vezes o monstro ataca para cada ataque seu">Ataques/turno</dt><dd>' + fmt(ritmo) + '</dd>'
      + '<dt>Experiência</dt><dd>' + m.exp.toLocaleString('pt-BR') + '</dd><dt>Ouro</dt><dd>' + m.ouro.toLocaleString('pt-BR') + '</dd>'
      + (m.drops.length ? '<dt>Armas</dt><dd>' + textoDrops(m.drops) + '</dd>' : '')
      + (m.dropsArmadura.length ? '<dt>Armaduras</dt><dd>' + textoDrops(m.dropsArmadura) + '</dd>' : '')
      + (m.dropsItem.length ? '<dt title="Arma, armadura, colar ou anel">Qualquer item</dt><dd>' + textoDrops(m.dropsItem) + '</dd>' : '')
      + (m.pergaminho ? '<dt>Pergaminho</dt><dd>' + (m.pergaminho.raridade ? '<span class="raridade-' + m.pergaminho.raridade + '">' + D.raridades[m.pergaminho.raridade].nome + '</span> ' : 'da arma ') + m.pergaminho.chance + '%</dd>' : '')
      + '<dt>Abatidos</dt><dd>' + (p.abates[id] || 0) + '</dd></dl>'
      + (fator < 100 ? '<p class="menos pequeno">Exp reduzida: esta área está abaixo do seu nível (' + fator + '%).</p>' : '')
      + '<button class="btn largo" data-acao="cacar" data-monstro="' + id + '">Caçar</button></div></article>';
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

  function abaCacar() {
    var p = estado.personagem, s = R.status(p);
    var area = D.areas.find(function (a) { return a.id === estado.area; }) || D.areas[0];
    var lista = D.areas.map(function (a) {
      var livre = R.areaLiberada(p, a);
      var proxima = D.areas[D.areas.indexOf(a) + 1];
      var faixa = proxima ? 'Lv ' + a.nivelMin + '–' + proxima.nivelMin : 'Lv ' + a.nivelMin + '+';
      return '<button class="area' + (a.id === area.id ? ' selecionada' : '') + (livre ? '' : ' bloqueada') + '"'
        + (livre ? ' data-acao="area" data-valor="' + a.id + '"' : ' disabled') + '>'
        + '<span class="area-nome">' + (livre ? '' : '🔒 ') + a.nome + '</span>'
        + '<span class="area-nivel">' + (livre ? faixa : 'Libera no level ' + a.nivelMin) + '</span></button>';
    }).join('');
    return '<div class="areas">' + lista + '</div>'
      + '<h3 class="subtitulo">' + area.nome + '</h3><p class="suave">' + area.descricao + ' '
      + 'As armas e armaduras que caem são sempre da sua classe (colar e anel servem para todos). '
      + 'Sua Sorte aumenta as chances em +' + s.bonusDrop + '%.'
      + (R.mochilaCheia(p) ? ' <strong class="menos">Mochila cheia: venda itens para receber drops.</strong>' : '')
      + '</p><div class="monstros">' + area.monstros.map(function (m) { return cartaMonstro(m.id); }).join('') + cartaChefe(area) + '</div>';
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
  function fichaItemHtml(item) {
    var p = estado.personagem;
    if (!item) {
      return '<p class="suave">' + (temMouse ? 'Passe o mouse num item para ver a ficha. Um clique amplia e compara; dois cliques equipam ou desequipam.'
        : 'Toque num item para ampliar e comparar. Dois toques equipam ou desequipam.') + '</p>';
    }
    var slot = R.slotDoItem(p, item.id);
    var alvo = null;
    if (!slot) alvo = R.itemNoSlot(p, item.tipo === 'anel' ? 'anel1' : item.tipo);
    var linhas;
    if (item.tipo === 'arma') {
      var d = R.danoArma(item), media = (d[0] + d[1]) / 2;
      var comp = '';
      if (alvo) {
        var da = R.danoArma(alvo), diff = media - (da[0] + da[1]) / 2;
        if (diff) comp = ' <span class="' + (diff > 0 ? 'mais' : 'menos') + '">(' + (diff > 0 ? '+' : '') + fmt(diff) + ' de média)</span>';
      }
      linhas = '<li>Dano ' + dano(d) + comp + '</li>';
    } else {
      var b = R.bonusItem(item), ba = alvo ? R.bonusItem(alvo) : {};
      var chaves = Object.keys(D.bonus).filter(function (k) { return b[k] || ba[k]; });
      linhas = chaves.map(function (k) {
        var v = b[k] || 0, dif = v - (ba[k] || 0);
        var cmp = alvo && dif ? ' <span class="' + (dif > 0 ? 'mais' : 'menos') + '">(' + (dif > 0 ? '+' : '') + dif + ')</span>' : '';
        return '<li' + (v ? '' : ' class="suave"') + '>' + D.bonus[k] + ' +' + v + cmp + '</li>';
      }).join('');
    }
    var acoes = '';
    if (slot) {
      acoes += '<button class="btn" data-acao="desequipar" data-slot="' + slot + '"' + (R.mochilaCheia(p) ? ' disabled title="Mochila cheia"' : '') + '>Desequipar</button>';
    } else {
      acoes += R.podeUsar(p, item)
        ? '<button class="btn" data-acao="equipar" data-id="' + item.id + '">Equipar</button>'
        : '<span class="menos">Não é da sua classe</span>';
      acoes += item.travado ? '<span class="suave pequeno">🔒 Travado</span>' : estado.vendaPendente === item.id
        ? '<button class="btn perigo" data-acao="vender" data-id="' + item.id + '">Confirmar venda</button>'
        : '<button class="btn secundario" data-acao="pedir-venda" data-id="' + item.id + '">Vender (+' + R.precoVenda(item) + ' ouro)</button>';
    }
    return '<div class="ficha-item-topo"><div class="icone-grande borda-' + item.raridade + aura(item) + '">' + F.icone(item) + '</div>'
      + '<div><div class="ficha-item-nome">' + nomeItemHtml(item) + '</div>'
      + '<div class="suave">' + tipoItem(item) + ' · <span class="raridade-' + item.raridade + '">' + D.raridades[item.raridade].nome + '</span>'
      + (slot ? ' · equipado' : '') + '</div></div></div>'
      + '<ul class="ficha-item-bonus">' + linhas + '</ul>'
      + (alvo ? '<p class="suave">Comparado com ' + nomeItemHtml(alvo) + '</p>' : '')
      + '<div class="item-acoes">' + acoes + '</div>';
  }

  // ---------- Zoom do item: o item ampliado, lado a lado com o equipado no mesmo espaço ----------
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
  function cartaZoom(item, outro, rotulo) {
    var linhas = [];
    if (item.tipo === 'arma') {
      var d = R.danoArma(item), m = (d[0] + d[1]) / 2;
      var mo = outro ? (R.danoArma(outro)[0] + R.danoArma(outro)[1]) / 2 : null;
      linhas.push('<li><span>Dano</span><strong>' + dano(d) + '</strong></li>');
      linhas.push('<li><span>Dano médio</span><strong>' + fmt(m) + (outro ? diferenca(m, mo) : '') + '</strong></li>');
    } else {
      var b = R.bonusItem(item), bo = outro ? R.bonusItem(outro) : {};
      Object.keys(D.bonus).filter(function (k) { return b[k] || bo[k]; }).forEach(function (k) {
        linhas.push('<li' + (b[k] ? '' : ' class="suave"') + '><span>' + D.bonus[k] + '</span><strong>+' + (b[k] || 0) + (outro ? diferenca(b[k] || 0, bo[k] || 0) : '') + '</strong></li>');
      });
    }
    linhas.push('<li><span>Encantamento</span><strong>+' + (item.encanto || 0) + '</strong></li>');
    linhas.push('<li><span>Venda</span><strong class="cor-ouro">' + R.precoVenda(item).toLocaleString('pt-BR') + ' de ouro</strong></li>');
    return '<div class="zoom-carta"><div class="zoom-rotulo">' + rotulo + '</div>'
      + '<div class="icone-zoom borda-' + item.raridade + aura(item) + '">' + F.icone(item) + (item.encanto ? '<span class="nivel-encanto">+' + item.encanto + '</span>' : '') + '</div>'
      + '<div class="ficha-item-nome">' + nomeItemHtml(item) + '</div>'
      + '<div class="suave">' + tipoItem(item) + ' · <span class="raridade-' + item.raridade + '">' + D.raridades[item.raridade].nome + '</span></div>'
      + '<ul class="zoom-atributos">' + linhas.join('') + '</ul></div>';
  }

  function zoomHtml() {
    var p = estado.personagem;
    var item = estado.zoom && p.inventario.find(function (i) { return i.id === estado.zoom; });
    if (!item) return '';
    var slot = R.slotDoItem(p, item.id), outro = itemParaComparar(p, item);
    var acoes = '';
    if (slot) {
      acoes = '<button class="btn" data-acao="desequipar" data-slot="' + slot + '"' + (R.mochilaCheia(p) ? ' disabled title="Mochila cheia"' : '') + '>Desequipar</button>';
    } else {
      acoes = (R.podeUsar(p, item) ? '<button class="btn" data-acao="equipar" data-id="' + item.id + '">' + (outro ? 'Trocar pelo equipado' : 'Equipar') + '</button>'
          : '<span class="menos">Não é da sua classe</span>')
        + (item.travado ? '' : estado.vendaPendente === item.id
          ? '<button class="btn perigo" data-acao="vender" data-id="' + item.id + '">Confirmar venda</button>'
          : '<button class="btn secundario" data-acao="pedir-venda" data-id="' + item.id + '">Vender</button>');
    }
    acoes += '<button class="btn secundario" data-acao="item-travar" data-id="' + item.id + '">' + (item.travado ? 'Destravar' : 'Travar') + '</button>';
    return '<div class="zoom-fundo" data-acao="zoom-fechar"><div class="zoom-janela" role="dialog" aria-label="Item ampliado">'
      + '<button class="zoom-x" data-acao="zoom-fechar" title="Fechar">✕</button>'
      + '<div class="zoom-cartas' + (outro ? ' dupla' : '') + '">'
      + cartaZoom(item, outro, slot ? 'Equipado' : 'Este item')
      + (outro ? cartaZoom(outro, null, 'Equipado agora') : '')
      + '</div><div class="botoes">' + acoes + '<button class="btn secundario" data-acao="zoom-fechar">Fechar</button></div></div></div>';
  }

  function abaPersonagem() {
    var p = estado.personagem;
    var slots = Object.keys(D.slots).map(function (k) {
      var item = R.itemNoSlot(p, k);
      if (item) return '<div class="espaco espaco-' + k + '">' + quadroItem(item, 'slot', ' data-slot="' + k + '"') + '</div>';
      return '<div class="espaco espaco-' + k + '"><div class="slot vazio" title="' + D.slots[k].nome + '">'
        + F.silhueta(D.slots[k].tipo, p.classe) + '</div></div>';
    }).join('');
    var eq = R.bonusEquipamentos(p);
    var resumo = Object.keys(D.bonus).filter(function (k) { return eq[k]; }).map(function (k) {
      return '<dt>' + D.bonus[k] + '</dt><dd class="mais">+' + eq[k] + '</dd>';
    }).join('');
    var mochila = R.mochila(p), v = visaoMochila();
    var celulas = R.ordenarItens(mochila, v.ordem, v.crescente).map(celulaMochila);
    for (var n = mochila.length; n < D.MOCHILA_MAX; n++) celulas.push('<div class="celula vazia"></div>');
    var foco = estado.itemFoco ? p.inventario.find(function (i) { return i.id === estado.itemFoco; }) : null;
    return '<div class="personagem-tela"><div class="boneco">' + slots
      + '<div class="retrato-central">' + F.personagem(p.raca, p.classe, p.sexo) + '</div></div>'
      + '<div class="lateral"><div class="caixa-interna" id="ficha-item">' + fichaItemHtml(foco) + '</div>'
      + '<div class="caixa-interna"><h3>Bônus dos equipamentos</h3>'
      + (resumo ? '<dl class="status">' + resumo + '</dl>' : '<p class="suave">Nenhuma armadura equipada.</p>') + '</div></div></div>'
      + '<h3 class="subtitulo">Mochila <span class="suave">(' + mochila.length + '/' + D.MOCHILA_MAX + ')</span></h3>'
      + barraMochilaHtml()
      + '<div class="mochila' + (estado.vendaLote ? ' modo-venda' : '') + '">' + celulas.join('') + '</div>';
  }

  // ----- Mochila: ordem, filtro, trava e venda em lote -----
  // A ordem e o filtro só mudam a visão (os dados do personagem ficam iguais); "Organizar" grava a ordem.
  // Marcar itens e mudar o filtro só trocam classes e a posição dos quadros, sem redesenhar a tela.
  var ORDENS = [['mochila', 'Ordem da mochila'], ['forca', 'Força'], ['raridade', 'Raridade'], ['encanto', 'Encanto'], ['tipo', 'Tipo']];
  function visaoMochila() {
    return estado.mochilaVisao || (estado.mochilaVisao = { ordem: 'mochila', crescente: false, raridades: [], forcaMin: 0 });
  }
  function celulaMochila(item) {
    var v = visaoMochila(), lote = estado.vendaLote;
    var html = quadroItem(item, 'celula' + (R.passaFiltro(item, v) ? '' : ' apagado') + (lote && lote.ids[item.id] ? ' marcado' : ''),
      ' data-forca="' + R.forcaItem(item) + '"');
    return lote ? html.replace('data-acao="item"', 'data-acao="marcar"') : html;
  }
  function barraMochilaHtml() {
    var v = visaoMochila(), lote = estado.vendaLote;
    var html = '<div class="mochila-barra"><div class="mochila-linha">'
      + '<label class="mochila-campo">Ordenar <select id="ordem-mochila">' + ORDENS.map(function (o) {
        return '<option value="' + o[0] + '"' + (v.ordem === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>'
      + '<button class="btn secundario btn-pequeno" data-acao="mochila-direcao"' + (v.ordem === 'mochila' ? ' disabled' : '') + '>'
      + (v.crescente ? '↑ Crescente' : '↓ Decrescente') + '</button>'
      + '<button class="btn secundario btn-pequeno" data-acao="mochila-organizar" title="Grava esta ordem na mochila">Organizar</button>'
      + '<button class="btn btn-pequeno' + (lote ? ' perigo' : ' secundario') + '" data-acao="mochila-lote">' + (lote ? 'Sair da venda' : 'Vender vários') + '</button></div>'
      + '<div class="mochila-linha"><span class="suave pequeno">Mostrar:</span>' + R.RARIDADES.map(function (k) {
        return '<button class="chip-raridade raridade-' + k + (v.raridades.indexOf(k) >= 0 ? ' ativa' : '') + '" data-acao="mochila-filtro" data-valor="' + k + '">' + D.raridades[k].nome + '</button>';
      }).join('')
      + '<label class="mochila-campo">Força mín. <input id="forca-min" type="number" min="0" step="10" inputmode="numeric" value="' + (v.forcaMin || '') + '" placeholder="0"></label></div>';
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
      + '<button class="btn" data-acao="comprar" data-tipo="' + modelo.tipo + '" data-raridade="' + modelo.raridade + '"' + (faltas.length ? ' disabled' : '') + '>Comprar</button></div></div>';
  }

  function linhaRecomeco(p) {
    var preco = D.RECOMECO.precoReputacao, falta = preco - (p.reputacao || 0);
    return '<div class="item item-com-icone carta-lendaria"><div class="icone-pequeno borda-lendaria icone-recomeco">📜</div>'
      + '<div class="item-texto"><div><span class="raridade-lendaria">' + D.RECOMECO.nome + '</span></div>'
      + '<div class="suave">Devolve todos os pontos de atributo para você distribuir de novo · '
      + preco.toLocaleString('pt-BR') + ' de reputação · você tem ' + (p.recomecos || 0) + '</div></div>'
      + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta.toLocaleString('pt-BR') + ' de reputação</span>' : '')
      + '<button class="btn" data-acao="recomeco-comprar"' + (falta > 0 ? ' disabled' : '') + '>Comprar</button></div></div>';
  }

  function abaMercado() {
    var p = estado.personagem;
    return '<p class="suave">Você tem <strong class="cor-ouro">' + p.ouro.toLocaleString('pt-BR') + ' de ouro</strong> · mochila '
      + R.mochila(p).length + '/' + D.MOCHILA_MAX + '.</p><h3 class="subtitulo">Armas de ' + D.classes[p.classe].nome + '</h3><div class="itens">'
      + R.RARIDADES.map(function (k) {
        return linhaMercado({ tipo: 'arma', classe: p.classe, raridade: k, encanto: 0 });
      }).join('') + '</div>'
      + '<h3 class="subtitulo">Armaduras</h3><p class="suave pequeno">Colar e anel só nas masmorras.</p>'
      + '<div class="opcoes">' + R.RARIDADES.map(function (k) {
        return '<button class="opcao mini-opcao' + (estado.mercadoRaridade === k ? ' selecionada' : '') + '" data-acao="mercado-raridade" data-valor="' + k + '"><span class="raridade-' + k + '">' + D.raridades[k].nome + '</span></button>';
      }).join('') + '</div><div class="itens">'
      + R.TIPOS_ARMADURA.map(function (tipo) {
        return linhaMercado({ tipo: tipo, classe: R.TIPOS_JOIA.indexOf(tipo) >= 0 ? null : p.classe, raridade: estado.mercadoRaridade, encanto: 0 });
      }).join('') + '</div>'
      + '<h3 class="subtitulo">Itens especiais</h3><div class="itens">' + linhaRecomeco(p) + '</div>'
      + '<h3 class="subtitulo">Skins do Dado (Arena)</h3>'
      + '<p class="suave">Mudam a cor do seu D20 na Arena. O oponente vê o dado com a sua skin.</p><div class="skins">'
      + D.SKINS_DADO.map(function (k) {
        var tem = R.skinsDoPersonagem(p).indexOf(k.id) >= 0, uso = (p.skinDado || 'vermelho') === k.id;
        var botao = uso ? '<span class="online pequeno">✔ Em uso</span>'
          : tem ? '<button class="btn secundario" data-acao="skin-usar" data-valor="' + k.id + '">Usar</button>'
          : '<button class="btn" data-acao="skin-comprar" data-valor="' + k.id + '"' + (p.ouro < k.preco ? ' disabled' : '') + '>Comprar · ' + k.preco.toLocaleString('pt-BR') + ' de ouro</button>';
        return '<div class="skin-carta' + (uso ? ' em-uso' : '') + '">' + d20Bonito(20, k.id) + '<strong>' + k.nome + '</strong>'
          + '<span class="suave pequeno">' + (k.preco ? k.preco.toLocaleString('pt-BR') + ' de ouro' : 'Grátis') + '</span>' + botao + '</div>';
      }).join('') + '</div>'
      + '<h3 class="subtitulo">Pergaminhos de Encantamento</h3>'
      + '<p class="suave">Cada tentativa de encantar gasta 1 pergaminho da mesma raridade do item.</p><div class="itens">'
      + Object.keys(D.raridades).map(function (k) {
        var preco = D.encantamento.precoPergaminho[k];
        var falta = preco - p.ouro;
        return '<div class="item"><div>'
          + '<div>Pergaminho para item <span class="raridade-' + k + '">' + ITEM_RARIDADE[k] + '</span></div>'
          + '<div class="suave">' + preco.toLocaleString('pt-BR') + ' de ouro · você tem ' + p.pergaminhos[k] + '</div></div>'
          + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta.toLocaleString('pt-BR') + '</span>' : '')
          + '<button class="btn" data-acao="comprar-pergaminho" data-raridade="' + k + '"' + (falta > 0 ? ' disabled' : '') + '>Comprar</button></div></div>';
      }).join('') + '</div>';
  }

  function abaEncantar() {
    var p = estado.personagem, E = D.encantamento;
    var u = estado.ultimoEncanto;
    var aviso = '';
    if (u) {
      var nome = esc(R.nomeItem(Object.assign({}, u.item, { encanto: 0 })));
      var texto = u.sucesso ? 'SUCESSO! ' + nome + ' agora é +' + u.nivel + '!'
        : u.quebrou ? 'FALHOU! ' + nome + ' +' + u.nivel + ' se despedaçou...'
        : 'FALHOU! ' + nome + ' +' + u.nivel + ' voltou para +0.';
      aviso = '<div class="encanto-resultado ' + (u.sucesso ? 'sucesso' : 'falha') + '" role="status">' + texto + '</div>';
    }
    var cont = Object.keys(D.raridades).map(function (k) {
      return '<span class="raridade-' + k + '">' + D.raridades[k].nome + ': ' + p.pergaminhos[k] + '</span>';
    }).join(' · ');
    var ordem = Object.keys(D.raridades).reverse();
    var itens = p.inventario.slice().sort(function (a, b) {
      return ordem.indexOf(a.raridade) - ordem.indexOf(b.raridade) || b.encanto - a.encanto;
    });
    var lista = itens.map(function (i) {
      var acao, info;
      if (i.encanto >= E.maximo) {
        info = 'Nível máximo';
        acao = '<span class="suave">+' + E.maximo + '</span>';
      } else {
        var chance = R.chanceEncantar(p, i), risco = R.riscoEncantar(i);
        var falha = { nada: 'sem risco', zera: 'se falhar, volta para +0', quebra: 'se falhar, o item QUEBRA' }[risco];
        info = '+' + i.encanto + ' → +' + (i.encanto + 1) + ' · chance <strong>' + chance + '%</strong> · <span class="' + (risco === 'quebra' ? 'menos' : '') + '">' + falha + '</span>';
        var semPergaminho = p.pergaminhos[i.raridade] <= 0;
        acao = risco === 'quebra' && estado.encantoPendente === i.id
          ? '<button class="btn perigo" data-acao="encantar" data-id="' + i.id + '">Arriscar mesmo assim</button>'
          : '<button class="btn" data-acao="' + (risco === 'quebra' ? 'pedir-encanto' : 'encantar') + '" data-id="' + i.id + '"' + (semPergaminho ? ' disabled' : '') + '>Encantar</button>';
        if (semPergaminho) acao = '<span class="suave">Sem pergaminho</span>' + acao;
      }
      var equipado = !!R.slotDoItem(p, i.id);
      return '<div class="item item-com-icone' + (equipado ? ' equipado' : '') + '"><div class="icone-pequeno borda-' + i.raridade + aura(i) + '">' + F.icone(i) + '</div>'
        + '<div class="item-texto"><div>' + nomeItemHtml(i) + (equipado ? ' <span class="suave">(equipado)</span>' : '') + '</div>'
        + '<div class="suave">' + descricaoItem(i) + ' · ' + info + '</div></div>'
        + '<div class="item-acoes">' + acao + '</div></div>';
    }).join('');
    return aviso + '<p class="suave">Pergaminhos: ' + cont + '. Compre mais no Mercado. Sua Sorte soma +' + R.atributosTotais(p).sor + '% na chance a partir do +4.</p>'
      + '<div class="itens">' + lista + '</div>';
  }

  // Ranking: busca no servidor ao abrir a aba (e no botão Atualizar).
  function abaRanking() {
    var tipo = estado.rankingTipo || 'nivel';
    var r = estado.ranking;
    if (!r || r.tipo !== tipo) {
      carregarRanking(tipo);
      r = null;
    }
    var botoes = [['nivel', 'Level'], ['poder', 'Poder']].map(function (t) {
      return '<button class="btn mini-opcao' + (t[0] === tipo ? '' : ' secundario') + '" data-acao="ranking-tipo" data-valor="' + t[0] + '">' + t[1] + '</button>';
    }).join('');
    var meus = (estado.conta.personagens || []).map(function (x) { return x.nome.toLowerCase(); });
    var corpo;
    if (!r) corpo = '<p class="suave">Carregando…</p>';
    else if (r.erro) corpo = '<p class="menos">' + esc(r.erro) + '</p>';
    else if (!r.lista.length) corpo = '<p class="suave">Ninguém no ranking ainda.</p>';
    else corpo = '<table class="ranking"><thead><tr><th>#</th><th>Personagem</th><th>Classe</th><th>Level</th><th>Poder</th></tr></thead><tbody>'
      + r.lista.map(function (x, i) {
        var pos = i + 1;
        var medalha = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
        return '<tr class="' + (meus.indexOf(String(x.nome).toLowerCase()) >= 0 ? 'meu' : '') + '"><td class="pos">' + medalha + '</td>'
          + '<td>' + siglaHtml(x.sigla) + '<strong>' + esc(x.nome) + '</strong><div class="suave pequeno">' + (D.racas[x.raca] ? D.racas[x.raca].nome : '') + '</div></td>'
          + '<td>' + (D.classes[x.classe] ? D.classes[x.classe].nome : '') + '</td>'
          + '<td>' + x.nivel + '</td><td>' + Number(x.poder || 0).toLocaleString('pt-BR') + '</td></tr>';
      }).join('') + '</tbody></table>';
    return '<div class="ranking-topo"><div class="botoes">' + botoes + '</div>'
      + '<button class="btn secundario mini-opcao" data-acao="ranking-atualizar">Atualizar</button></div>'
      + '<p class="suave pequeno">Os 100 melhores de Tanka' + (tipo === 'nivel' ? ' por level (empate: quem tem mais exp).' : ' por poder, a força calculada pelos status e equipamentos.')
      + ' Seus personagens aparecem destacados. Contas de administrador não entram.</p>' + corpo;
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
    if (!visto) return '';
    var ms = C.agora() - Date.parse(visto);
    if (ms < ONLINE_MS) return '<span class="online">● Online</span>';
    var min = Math.floor(ms / 60000);
    var quando = min < 60 ? min + ' min' : min < 1440 ? Math.floor(min / 60) + ' h' : Math.floor(min / 1440) + ' dia(s)';
    return '<span class="suave">Visto há ' + quando + '</span>';
  }

  function linhaAmigo(x, botoes) {
    return '<div class="item amigo"><div class="amigo-info"><div>' + siglaHtml(x.sigla) + '<strong>' + esc(x.nome) + '</strong> ' + vistoTexto(x.visto_em) + '</div>'
      + '<div class="suave">' + (D.racas[x.raca] ? D.racas[x.raca].nome : '') + ' · ' + (D.classes[x.classe] ? D.classes[x.classe].nome : '')
      + ' · Level ' + x.nivel + ' · Poder ' + Number(x.poder || 0).toLocaleString('pt-BR') + '</div></div>'
      + '<div class="item-acoes">' + botoes + '</div></div>';
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
        return linhaAmigo(x, estado.removerAmigo === x.pedido
          ? bt('amigo-remover', x, 'Confirmar', 'perigo') + '<button class="btn secundario" data-acao="amigo-manter">Cancelar</button>'
          : '<button class="btn" data-acao="grupo-convidar" data-id="' + esc(x.id) + '" data-nome="' + esc(x.nome) + '">Convidar para o grupo</button>'
            + bt('amigo-pedir-remover', x, 'Remover', 'secundario'));
      }).join('') + '</div>' : '<p class="suave">Você ainda não tem amigos. Adicione pelo nome do personagem (dá para ver os nomes no chat e no ranking).</p>');
    if (enviados.length) html += '<h3 class="subtitulo">Pedidos enviados (' + enviados.length + ')</h3><div class="itens">'
      + enviados.map(function (x) { return linhaAmigo(x, '<span class="suave pequeno">Aguardando</span>' + bt('amigo-remover', x, 'Cancelar', 'secundario')); }).join('') + '</div>';
    return html + '<div class="botoes"><button class="btn secundario" data-acao="social-atualizar">Atualizar</button></div>';
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
    C.ranking(tipo).then(function (lista) {
      return { tipo: tipo, lista: lista };
    }, function (e) {
      return { tipo: tipo, erro: 'Não foi possível carregar o ranking: ' + e.message };
    }).then(function (r) {
      estado.rankingCarregando = null;
      estado.ranking = r;
      if (estado.aba === 'ranking' && !estado.batalha && !estado.resultado && !estado.chefeAviso) telaJogo();
    });
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
      + grupo('Ouro', 'Soma ou tira ouro do personagem.', botoes('ouro', [1000, 10000, 100000], function (v) { return '+' + v.toLocaleString('pt-BR'); })
        + botoes('ouro', [-1000, -10000], function (v) { return '−' + (-v).toLocaleString('pt-BR'); }, 'menos')
        + botoes('zerar-ouro', [0], function () { return 'Zerar'; }, 'menos'))
      + grupo('Reputação', 'Soma ou tira reputação do personagem (Arena, alianças e itens especiais).',
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
      + grupo('Vida e poções', 'Cura, devolve as poções do dia ou simula o reset da meia-noite.',
        '<button class="btn" data-acao="admin" data-op="curar" data-valor="0">Curar tudo</button>'
        + '<button class="btn" data-acao="admin" data-op="pocoes" data-valor="0">Recarregar poções</button>'
        + '<button class="btn" data-acao="admin" data-op="reset" data-valor="0">Simular reset diário</button>'
        + botoes('vida', [50, 10, 0], function (v) { return v ? 'Vida em ' + v + '%' : 'Zerar vida'; }, 'menos')
        + botoes('zerar-pocoes', [0], function () { return 'Zerar poções'; }, 'menos'))
      + grupo('Alianças', 'Todas as alianças do jogo: renomear, dar exp, trocar o líder ou apagar.',
        '<button class="btn" data-acao="al-admin-listar">' + (estado.adminAliancas ? 'Atualizar lista' : 'Ver alianças') + '</button>')
      + '</div>'
      + (estado.adminAliancas ? '<div class="itens">' + (estado.adminAliancas.length ? estado.adminAliancas.map(function (a) {
        return cartaAlianca(a, '<span class="suave pequeno">Líder: ' + esc(a.lider || '—') + '</span>'
          + ['renomear:Renomear', 'exp:+50.000 exp', 'lider:Trocar líder', 'apagar:Apagar'].map(function (o) {
            var x = o.split(':');
            return '<button class="btn btn-pequeno' + (x[0] === 'apagar' ? ' perigo' : ' secundario') + '" data-acao="al-admin" data-op="' + x[0] + '" data-id="' + a.id + '">' + x[1] + '</button>';
          }).join(''));
      }).join('') : '<p class="suave">Nenhuma aliança.</p>') + '</div>' : '');
  }

  function resultadoHtml() {
    var r = estado.resultado;
    if (!r) return '';
    var m = D.monstros[r.monstroId];
    var cacarDeNovo = r.escolhido ? '<button class="btn" data-acao="cacar" data-monstro="' + r.escolhido + '">Caçar de novo</button>' : '';
    if (r.resultado === 'vitoria') {
      return '<div class="resultado' + (m.chefe ? ' vitoria-chefe' : '') + '"><h2>' + (m.chefe ? 'CHEFE DERROTADO!' : 'Vitória!') + '</h2><p>Você derrotou ' + m.nome + ' e ganhou <strong>' + r.exp + ' de exp</strong>' + (r.fatorExp < 100 ? ' <span class="suave">(reduzida: área abaixo do seu nível)</span>' : '') + ' e <strong class="cor-ouro">' + r.ouro + ' de ouro</strong>.</p>'
        + (r.niveis ? '<p class="destaque">Subiu para o level ' + estado.personagem.nivel + '! +' + r.niveis * D.PONTOS_POR_NIVEL + ' pontos de atributo.</p>' : '')
        + (r.habilidadeEvoluiu ? '<p class="habilidade-usada">⚡ Sua habilidade evoluiu para o nível ' + r.habilidadeEvoluiu + '!</p>' : '')
        + (r.drop ? '<p>Drop: <strong class="raridade-' + r.drop.raridade + '">' + R.nomeItem(r.drop) + ' (' + D.raridades[r.drop.raridade].nome + ')</strong></p>' : '')
        + (r.dropArmadura ? '<p>Drop: <strong class="raridade-' + r.dropArmadura.raridade + '">' + R.nomeItem(r.dropArmadura) + ' (' + D.raridades[r.dropArmadura.raridade].nome + ')</strong></p>' : '')
        + (r.mochilaCheia ? '<p class="menos">Mochila cheia! Um item caiu e se perdeu. Venda itens na aba Personagem.</p>' : '')
        + (r.pergaminho ? '<p>Drop: <strong>' + (r.qtdPergaminhos > 1 ? r.qtdPergaminhos + ' Pergaminhos' : 'Pergaminho') + ' para item <span class="raridade-' + r.pergaminho + '">' + ITEM_RARIDADE[r.pergaminho] + '</span></strong></p>' : '')
        + '<div class="botoes">' + cacarDeNovo
        + '<button class="btn secundario" data-acao="fechar-resultado">Voltar</button></div></div>';
    }
    if (r.resultado === 'derrota') {
      return '<div class="resultado derrota"><h2>Derrota</h2><p>' + m.nome + ' foi mais forte. Você volta ao acampamento sem vida' + (r.expPerdida ? ' e perde <strong class="menos">' + r.expPerdida.toLocaleString('pt-BR') + ' de exp</strong>' : '') + '. Espere a vida voltar, acampe ou use uma poção. Cuidado com áreas difíceis demais!</p>'
        + '<div class="botoes">' + cacarDeNovo + '<button class="btn secundario" data-acao="fechar-resultado">Voltar</button></div></div>';
    }
    return '<div class="resultado"><p>Você fugiu de ' + m.nome + '.</p><div class="botoes">' + cacarDeNovo + '<button class="btn secundario" data-acao="fechar-resultado">Voltar</button></div></div>';
  }

  function barraPoder(b) {
    return '<div class="barra poder' + (b.jogador.poder >= D.PODER.maximo ? ' cheia' : '') + '"><i style="width:' + b.jogador.poder + '%"></i><b>Poder ' + b.jogador.poder + '</b></div>';
  }

  function controleHabilidade(b) {
    var cheia = b.jogador.poder >= D.PODER.maximo;
    var nome = D.habilidades[b.classe].nome;
    var botao = b.habilidadePendente
      ? '<button class="btn btn-habilidade preparada" disabled>⚡ ' + nome + ': preparada!</button>'
      : '<button class="btn btn-habilidade' + (cheia ? ' pronta' : '') + '" data-acao="habilidade"' + (cheia ? '' : ' disabled') + '>⚡ ' + nome + '</button>';
    var pocao = b.pocaoPendente
      ? '<button class="btn btn-pocao" disabled>🧪 Bebendo…</button>'
      : '<button class="btn btn-pocao" data-acao="beber-pocao"' + (b.pocoes > 0 && b.jogador.hp < b.jogador.hpMax ? '' : ' disabled') + '>🧪 Beber poção (' + b.pocoes + ')</button>';
    if (!D.HABILIDADES_ATIVAS) return pocao;
    return botao + pocao + '<label class="auto-habilidade"><input type="checkbox" id="auto-habilidade" data-acao="auto-habilidade"' + (b.auto ? ' checked' : '') + '> Usar automaticamente</label>';
  }

  function batalhaHtml() {
    var b = estado.batalha || estado.ultimaBatalha;
    var p = estado.personagem;
    var em = !!estado.batalha;
    return '<div class="arena">'
      + '<div class="lutador" id="lutador-jogador"><div class="moldura">' + F.personagem(p.raca, p.classe, p.sexo) + '</div><h3>' + esc(p.nome) + '</h3>'
      + '<div id="hp-jogador">' + barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax, 'jogador') + '</div>'
      + (D.HABILIDADES_ATIVAS ? '<div id="poder-jogador">' + barraPoder(b) + '</div>' : '')
      + '<div class="suave">Velocidade ' + b.jogador.vel + '</div>'
      + (em ? '<div id="controle-habilidade">' + controleHabilidade(b) + '</div>' : '') + '</div>'
      + '<div class="vs">VS</div>'
      + '<div class="lutador" id="lutador-monstro"><div class="moldura">' + F.imagemMonstro(b.monstroId) + '</div><h3>' + b.monstro.nome + '</h3>'
      + '<div id="hp-monstro">' + barra('hp', b.monstro.hp, b.monstro.hpMax, b.monstro.hp + ' / ' + b.monstro.hpMax, 'monstro') + '</div>'
      + '<div class="suave">Velocidade ' + b.monstro.vel + '</div></div></div>'
      + '<div class="registro" id="registro">' + estado.registro.join('') + '</div>'
      + (em ? '<div class="botoes"><button class="btn secundario" data-acao="velocidade">' + (estado.rapido ? 'Velocidade normal' : 'Acelerar ×3') + '</button>'
        + '<button class="btn perigo" data-acao="fugir">Fugir</button></div>' : '');
  }

  function telaJogo() {
    var painel;
    if (estado.lutaArena) {
      painel = lutaArenaHtml();
    } else if (estado.luta) {
      painel = lutaMasmorraHtml();
    } else if (estado.chefeAviso) {
      painel = avisoChefeHtml();
    } else if (estado.batalha || estado.resultado) {
      painel = resultadoHtml() + batalhaHtml();
    } else {
      painel = navHtml()
        + ({ personagem: abaPersonagem, cacar: abaCacar, mercado: abaMercado, encantar: abaEncantar, ranking: abaRanking, social: abaSocial, masmorra: abaMasmorra, arena: abaArena, admin: abaAdmin, alianca: abaAlianca })[estado.aba]();
    }
    var livre = !(estado.batalha || estado.luta || estado.lutaArena);
    var trocar = !livre ? '' : (ehAdmin() ? '<button class="btn-icone' + (estado.aba === 'admin' ? ' ativa' : '') + '" data-acao="aba" data-aba="admin" title="Admin" aria-label="Admin">' + ICONES.admin + '</button>' : '')
      + '<button class="btn secundario" data-acao="voltar-personagens">Trocar personagem</button>';
    app.innerHTML = topo(trocar) + recursosHtml() + '<div class="conteudo"><div class="jogo">' + fichaHtml()
      + '<section class="caixa">' + painel + '</section></div></div>' + rodape()
      + (estado.zoom && estado.aba === 'personagem' && !estado.batalha && !estado.luta ? zoomHtml() : '')
      + (estado.desafio && estado.aba === 'arena' && !estado.lutaArena ? desafioHtml() : '');
    if (estado.lutaArena) atualizarJanelaDado();
    var reg = document.getElementById('registro');
    if (reg) reg.scrollTop = reg.scrollHeight;
    chatVisivel(true);
  }

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
    estado.timer = setTimeout(turno, estado.rapido ? 160 : 550);
  }

  function golpe(id, forte) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('golpeado', 'golpe-forte');
    void el.offsetWidth;
    el.classList.add(forte ? 'golpe-forte' : 'golpeado');
  }

  function turno() {
    var b = estado.batalha;
    if (!b) return;
    var linhasAntes = estado.registro.length;
    var ev = R.passo(b);
    var nomeJ = esc(b.jogador.nome), nomeM = b.monstro.nome;
    if (ev.pocao) {
      linha('cura', '🧪 ' + nomeJ + ' bebe uma poção e recupera <strong>' + ev.cura + '</strong> de vida.');
    } else if (ev.habilidade) {
      if (!ev.acerto) linha('errou', '⚡ ' + ev.habilidade.toUpperCase() + '! Mas ' + nomeJ + ' erra o golpe.');
      else {
        var golpes = ev.golpes.length > 1 ? ' em ' + ev.golpes.filter(function (g) { return g.acerto; }).length + ' golpes' : '';
        linha('habilidade-usada', '⚡ ' + ev.habilidade.toUpperCase() + '! ' + nomeJ + ' causa <strong>' + ev.dano + '</strong> de dano' + golpes
          + (ev.critico ? ' (com crítico!)' : '') + '.');
        if (ev.atordoou) linha('destaque', nomeM + ' está atordoado!');
        if (ev.quebrouArmadura) linha('destaque', 'A armadura de ' + nomeM + ' rachou! Ele recebe +25% de dano.');
        golpe('lutador-monstro', true);
      }
    } else if (ev.atordoado) {
      linha('errou', nomeM + ' está atordoado e perde a vez.');
    } else if (ev.ator === 'jogador') {
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
        golpe('lutador-jogador');
      }
    }
    document.getElementById('hp-jogador').innerHTML = barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax, 'jogador');
    document.getElementById('hp-monstro').innerHTML = barra('hp', b.monstro.hp, b.monstro.hpMax, b.monstro.hp + ' / ' + b.monstro.hpMax, 'monstro');
    document.getElementById('ficha-hp').innerHTML = barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax, 'ficha');
    document.getElementById('ficha-pocoes').textContent = b.pocoes + '/' + D.VIDA.pocoesPorDia;
    if (D.HABILIDADES_ATIVAS) document.getElementById('poder-jogador').innerHTML = barraPoder(b);
    document.getElementById('controle-habilidade').innerHTML = controleHabilidade(b);
    var reg = document.getElementById('registro');
    reg.insertAdjacentHTML('beforeend', estado.registro.slice(linhasAntes).join(''));
    reg.scrollTop = reg.scrollHeight;

    if (b.fim) setTimeout(function () { encerrar(); }, 500);
    else agendar();
  }

  function encerrar() {
    var b = estado.batalha;
    if (!b) return;
    clearTimeout(estado.timer);
    var res = R.concluirBatalha(estado.personagem, b, C.agora(), bonusAlianca());
    var nivelHab = R.nivelHabilidade(estado.personagem);
    if (D.HABILIDADES_ATIVAS && nivelHab > b.nivelHab) res.habilidadeEvoluiu = nivelHab;
    res.monstroId = b.monstroId;
    res.escolhido = estado.escolhido;
    if (res.resultado === 'vitoria') {
      linha('destaque', 'Vitória! +' + res.exp + ' de exp' + (res.fatorExp < 100 ? ' (reduzida: área abaixo do seu nível)' : '') + '.');
      if (res.niveis) linha('destaque', 'Level up! Agora você é level ' + estado.personagem.nivel + '.');
      if (res.habilidadeEvoluiu) linha('habilidade-usada', '⚡ Sua habilidade evoluiu para o nível ' + res.habilidadeEvoluiu + '!');
      if (res.drop) linha('destaque', 'Drop: ' + R.nomeItem(res.drop) + ' (' + D.raridades[res.drop.raridade].nome + ')!');
      if (res.dropArmadura) linha('destaque', 'Drop: ' + R.nomeItem(res.dropArmadura) + ' (' + D.raridades[res.dropArmadura.raridade].nome + ')!');
      if (res.mochilaCheia) linha('dano-recebido', 'Mochila cheia! Um item se perdeu.');
      if (res.pergaminho) linha('destaque', 'Drop: ' + (res.qtdPergaminhos > 1 ? res.qtdPergaminhos + ' Pergaminhos' : 'Pergaminho') + ' para item ' + ITEM_RARIDADE[res.pergaminho] + '!');
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
      [res.drop, res.dropArmadura].forEach(function (it) { if (it) avisar('Item novo: ' + R.nomeItem(it), 'item'); });
      if (res.pergaminho) avisar('Pergaminho ' + ITEM_RARIDADE[res.pergaminho] + '!', 'item');
    } else if (res.resultado === 'derrota') avisar('Derrota…', 'ruim');
  }

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
      } else {
        estado.conta = await C.entrar(dados.usuario, dados.senha);
        telaPersonagens();
      }
    } catch (err) {
      form.querySelector('.erro').textContent = err.message;
      botao.disabled = false;
    }
  });

  app.addEventListener('change', function (e) {
    if (e.target.id === 'ordem-mochila') {
      visaoMochila().ordem = e.target.value;
      var dir = document.querySelector('[data-acao="mochila-direcao"]');
      if (dir) dir.disabled = e.target.value === 'mochila';
      aplicarVisaoMochila();
    }
  });

  app.addEventListener('input', function (e) {
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
    switch (el.dataset.acao) {
      case 'auth': telaAuth(el.dataset.modo); break;
      case 'sair':
        clearTimeout(estado.timer);
        C.sair();
        estado = Object.assign(estado, { conta: null, personagem: null, batalha: null, resultado: null });
        telaAuth('entrar');
        break;
      case 'voltar-personagens':
        estado.conta = C.contaAtual();
        estado.personagem = null;
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
      case 'aba':
        estado.aba = el.dataset.aba;
        if (grupoDaAba(estado.aba)) estado.subAba[grupoDaAba(estado.aba).id] = estado.aba;
        estado.vendaPendente = estado.encantoPendente = estado.ultimoEncanto = estado.itemFoco = null;
        estado.vendaLote = null;
        telaJogo();
        // Social e Masmorra buscam o estado novo ao abrir (pedidos e convites recentes).
        if (estado.aba === 'social') carregarSocial();
        if (estado.aba === 'masmorra') carregarGrupo();
        if (estado.aba === 'arena') { carregarArena(); marcarAtaquesVistos(); }
        if (estado.aba === 'alianca') carregarAlianca();
        break;
      case 'item': {
        // Um clique: amplia e compara (espera um instante para ver se é clique duplo).
        var alvoId = el.dataset.id;
        clearTimeout(estado.timerZoom);
        estado.timerZoom = setTimeout(function () {
          estado.vendaPendente = null;
          estado.itemFoco = alvoId;
          estado.zoom = alvoId;
          telaJogo();
        }, 260);
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
        abrirDesafio(el.dataset.id);
        break;
      case 'desafio-confirmar': {
        var alvoDesafio = estado.desafio && estado.desafio.id;
        if (!alvoDesafio) break;
        estado.desafio = null;
        telaJogo();
        comecarLutaArena(function () { return C.arena.desafiar(p.id, alvoDesafio); });
        break;
      }
      case 'desafio-cancelar':
        if (el.classList.contains('zoom-fundo') && e.target !== el) break;   // clique dentro da janela
        estado.desafio = null;
        telaJogo();
        break;
      case 'arena-revanche':
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
      case 'luta-pular':
        clearTimeout(estado.luta.timer);
        while (!estado.luta.fim) passoLuta(true);
        redesenharLuta();
        break;
      case 'luta-fechar':
        clearTimeout(estado.luta.timer);
        estado.luta = null;
        estado.aba = 'masmorra';
        telaJogo();
        resgatarRecompensas();
        break;
      case 'admin-masmorra-entradas':
        acaoGrupo(function () { return C.grupo.adminRecarregar(p.id); }, 'Entradas da masmorra recarregadas.');
        break;
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
        avisar(p.nome + ' monta acampamento junto à fogueira. A vida volta 3x mais rápido.');
        telaJogo();
        break;
      case 'levantar':
        R.acampar(p, C.agora(), false);
        salvar();
        telaJogo();
        break;
      case 'usar-pocao':
        if (R.usarPocao(p, C.agora())) { salvar(); avisar('Você bebe a poção e recupera toda a vida.'); }
        telaJogo();
        break;
      case 'beber-pocao':
        if (estado.batalha && R.beberPocao(estado.batalha)) {
          document.getElementById('controle-habilidade').innerHTML = controleHabilidade(estado.batalha);
        }
        break;
      case 'equipar':
        if (R.equipar(p, el.dataset.id)) { estado.vendaPendente = null; estado.zoom = null; salvar(); telaJogo(); }
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
        var comprado = R.comprar(p, el.dataset.raridade, el.dataset.tipo);
        if (typeof comprado === 'string') { avisar(comprado); break; }
        salvar();
        avisar('Você comprou ' + R.nomeItem(comprado) + '! Está na mochila.');
        telaJogo();
        break;
      }
      case 'comprar-pergaminho':
        if (R.comprarPergaminho(p, el.dataset.raridade)) {
          salvar();
          avisar('Pergaminho comprado! Use na aba Encantar.');
          telaJogo();
        }
        break;
      case 'pedir-encanto':
        estado.encantoPendente = el.dataset.id;
        estado.ultimoEncanto = null;
        telaJogo();
        break;
      case 'encantar': {
        var tentativa = R.encantar(p, el.dataset.id);
        estado.encantoPendente = null;
        if (tentativa) {
          estado.ultimoEncanto = tentativa;
          salvar();
          telaJogo();
        }
        break;
      }
      case 'admin': {
        if (!ehAdmin()) break;
        var op = el.dataset.op;
        var v = op === 'conjunto' || op === 'joia' ? el.dataset.valor : Number(el.dataset.valor);
        if (op === 'joia') {
          if (R.mochilaCheia(p)) { avisar('Mochila cheia!'); break; }
          var joia = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tipo: Math.random() < 0.5 ? 'colar' : 'anel', classe: null, raridade: v, encanto: 0 };
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
          curar: 'Vida recuperada.', pocoes: 'Poções recarregadas.', reset: 'Reset diário: vida cheia e poções do dia.',
          vida: 'Vida em ' + p.hpAtual + '.', 'zerar-pocoes': 'Poções zeradas.', 'esvaziar-mochila': 'Mochila esvaziada.', reputacao: 'Reputação: ' + (p.reputacao || 0) + '.' }[op]);
        telaJogo();
        break;
      }
      case 'habilidade':
        if (estado.batalha && R.prepararHabilidade(estado.batalha)) {
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
        if (!R.podeCacar(p, alvo)) { avisar('Essa área ainda não foi liberada.'); break; }
        if (R.atualizarTempo(p, C.agora())) salvar();
        if (p.hpAtual <= 0) { avisar('Você está sem vida. Espere a vida voltar, acampe ou use uma poção.'); break; }
        if (p.acampado) { avisar('Você está acampado. Levante acampamento para caçar.'); break; }
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
        estado.area = el.dataset.valor;
        telaJogo();
        break;
      case 'fugir': encerrar(); break;
      case 'velocidade':
        estado.rapido = !estado.rapido;
        el.textContent = estado.rapido ? 'Velocidade normal' : 'Acelerar ×3';
        break;
      case 'fechar-resultado':
        estado.resultado = null;
        estado.ultimaBatalha = null;
        telaJogo();
        break;
    }
  });

  // Dois cliques (ou dois toques) num item: equipa ou desequipa direto.
  app.addEventListener('dblclick', function (e) {
    var el = e.target.closest('[data-acao="item"]');
    var p = estado.personagem;
    if (!el || !p) return;
    clearTimeout(estado.timerZoom);
    var id = el.dataset.id, slot = R.slotDoItem(p, id);
    estado.zoom = null;
    estado.vendaPendente = null;
    if (slot) {
      if (!R.desequipar(p, slot)) avisar('Mochila cheia! Venda algo antes de desequipar.');
    } else {
      var it = p.inventario.find(function (i) { return i.id === id; });
      if (!R.equipar(p, id)) avisar(it && !R.podeUsar(p, it) ? 'Esse item não é da sua classe.' : 'Não foi possível equipar.');
    }
    salvar();
    telaJogo();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && estado.zoom) { estado.zoom = null; telaJogo(); }
    if (e.key === 'Escape' && estado.desafio) { estado.desafio = null; telaJogo(); }
  });

  // Mouse sobre um item: mostra a ficha dele depois de um instante (para não trocar ao só passar por cima).
  var timerFoco;
  app.addEventListener('mouseover', function (e) {
    if (!temMouse) return;
    var el = e.target.closest('[data-acao="item"]');
    if (!el || el.dataset.id === estado.itemFoco) return;
    clearTimeout(timerFoco);
    timerFoco = setTimeout(function () {
      var painel = document.getElementById('ficha-item');
      var p = estado.personagem;
      if (!painel || !p || !el.isConnected) return;
      estado.itemFoco = el.dataset.id;
      estado.vendaPendente = null;
      painel.innerHTML = fichaItemHtml(p.inventario.find(function (i) { return i.id === el.dataset.id; }));
      document.querySelectorAll('[data-acao="item"].focado').forEach(function (x) { x.classList.remove('focado'); });
      el.classList.add('focado');
    }, 180);
  });
  app.addEventListener('mouseout', function (e) {
    if (e.target.closest && e.target.closest('[data-acao="item"]')) clearTimeout(timerFoco);
  });

  // A vida volta com o tempo: atualiza a ficha a cada 20 s (fora da batalha).
  setInterval(function () {
    var p = estado.personagem;
    if (!p || estado.batalha || !document.querySelector('.ficha')) return;
    if (R.atualizarTempo(p, C.agora())) salvar();
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
    C.grupo.estado(p.id).then(function (g) {
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

  // Joias ganhas: entram na mochila (se couber) e o jogo salva.
  async function resgatarRecompensas() {
    var p = estado.personagem, g = estado.gm;
    if (!p || !g || !g.recompensas || !g.recompensas.length || estado.resgatando) return;
    estado.resgatando = true;
    try {
      for (var i = 0; i < g.recompensas.length; i++) {
        if (R.mochilaCheia(p)) { avisar('Mochila cheia! Sua joia da masmorra está guardada: libere espaço para recebê-la.'); break; }
        var item = await C.grupo.resgatar(p.id, g.recompensas[i].id);
        p.inventario.push(item);
        salvar();
        avisar('Você ganhou ' + R.nomeItem(item) + ' (' + D.raridades[item.raridade].nome + ')!');
      }
    } catch (e) { avisar(e.message); }
    estado.resgatando = false;
    g.recompensas = [];
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
    }, L.rapido ? Math.max(10, Math.round(L.atraso / 4)) : L.atraso);
  }

  function passoLuta(silencioso) {
    var L = estado.luta, ev = L.sim.eventos[L.idx++];
    if (!ev) {
      L.fim = true;
      var s = L.sim.inicio;
      L.registro.push(L.sim.vitoria
        ? '<p class="habilidade-usada">VITÓRIA! ' + esc(s.salas[2][0].nome) + ' caiu!</p>'
        : '<p class="dano-recebido">O grupo caiu na ' + NOMES_SALA[L.sim.sala].toLowerCase() + '.</p>');
      return;
    }
    var herois = L.sim.inicio.herois, monstros = L.sim.inicio.salas[L.sala];
    if (ev.tipo === 'sala') {
      L.sala = ev.sala;
      L.hpM = L.sim.inicio.salas[L.sala].map(function (m) { return m.hpMax; });
      L.registro.push('<p class="destaque">— ' + NOMES_SALA[L.sala] + ' —</p>');
    } else if (ev.de === 'h') {
      var h = herois[ev.i], m = monstros[ev.alvo];
      if (!ev.acerto) L.registro.push('<p class="errou">' + esc(h.nome) + ' erra ' + esc(m.nome) + '.</p>');
      else {
        L.hpM[ev.alvo] = Math.max(0, L.hpM[ev.alvo] - ev.dano);
        L.registro.push('<p class="' + (ev.critico ? 'critico' : '') + '">' + (ev.critico ? 'CRÍTICO! ' : '') + esc(h.nome) + ' acerta ' + esc(m.nome) + ': <strong>' + ev.dano + '</strong>.</p>');
        if (ev.caiu) L.registro.push('<p class="destaque">' + esc(m.nome) + ' caiu!</p>');
      }
    } else {
      var mo = monstros[ev.i], alvo = herois[ev.alvo];
      if (!ev.acerto) L.registro.push('<p class="errou">' + esc(mo.nome) + ' ataca ' + esc(alvo.nome) + ', que se esquiva.</p>');
      else {
        L.hpH[ev.alvo] = Math.max(0, L.hpH[ev.alvo] - ev.dano);
        L.registro.push('<p class="dano-recebido">' + esc(mo.nome) + ' acerta ' + esc(alvo.nome) + ': <strong>' + ev.dano + '</strong>.</p>');
        if (ev.caiu) L.registro.push('<p class="dano-recebido"><strong>' + esc(alvo.nome) + ' caiu!</strong></p>');
      }
    }
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
      return '<div class="mas-lutador' + (L.hpH[i] ? '' : ' caido') + '"><div class="moldura">' + F.personagem(h.raca, h.classe, h.sexo) + '</div>'
        + '<div class="mas-nome">' + esc(h.nome) + '</div>' + barra('hp', L.hpH[i], h.hpMax, L.hpH[i] + ' / ' + h.hpMax, 'heroi' + i) + '</div>';
    }).join('');
    var monstros = ini.salas[L.sala].map(function (m, i) {
      return '<div class="mas-lutador' + (L.hpM[i] ? '' : ' caido') + (m.chefe ? ' mas-chefe' : '') + '"><div class="moldura">' + F.imagemMonstro(m.id) + '</div>'
        + '<div class="mas-nome">' + (m.chefe ? '<span class="selo-chefe">Chefe</span> ' : m.elite ? '<span class="selo-elite">Elite</span> ' : '') + esc(m.nome) + '</div>'
        + barra('hp', L.hpM[i], m.hpMax, L.hpM[i].toLocaleString('pt-BR') + ' / ' + m.hpMax.toLocaleString('pt-BR'), 'mas' + i) + '</div>';
    }).join('');
    var fim = '';
    if (L.fim) {
      fim = L.sim.vitoria
        ? '<div class="resultado vitoria-chefe"><h2>VITÓRIA!</h2><p>O grupo venceu ' + esc(L.mm.nome) + '. Cada um ganhou um colar ou anel (vai para a mochila).</p>'
        : '<div class="resultado derrota"><h2>Derrota</h2><p>O grupo caiu na ' + NOMES_SALA[L.sim.sala].toLowerCase() + '. Ninguém perdeu nada e a entrada não foi gasta.</p>';
      fim += '<div class="botoes"><button class="btn" data-acao="luta-fechar">Voltar</button></div></div>';
    }
    return fim + '<h3 class="subtitulo">' + esc(L.mm.nome) + ' · ' + NOMES_SALA[L.sala] + '</h3>'
      + '<div class="mas-arena"><div class="mas-grupo">' + herois + '</div><div class="vs">VS</div><div class="mas-grupo">' + monstros + '</div></div>'
      + '<div class="registro" id="registro">' + L.registro.join('') + '</div>'
      + (L.fim ? '' : '<div class="botoes"><button class="btn secundario" data-acao="luta-velocidade">' + (L.rapido ? 'Velocidade normal' : 'Acelerar ×4') + '</button>'
        + '<button class="btn secundario" data-acao="luta-pular">Pular para o fim</button></div>');
  }

  function abaMasmorra() {
    var g = estado.gm, p = estado.personagem;
    if (!g) { carregarGrupo(); return '<p class="suave">' + (estado.gmErro ? esc(estado.gmErro) : 'Carregando…') + '</p>'; }
    if (g.local) return '<p class="suave">As masmorras são em grupo de 3 e precisam do servidor: jogue pelo site do Tanka para entrar com seus amigos.</p>';
    var M = D.MASMORRA, restam = M.entradasPorDia - g.entradas;
    var html = '<p class="suave">Grupo de 3, luta automática. A vida da masmorra é separada: morrer lá não tira vida nem exp. '
      + 'Vitória: cada um ganha um <strong>colar ou anel</strong>, a única forma de conseguir joias. Derrota não gasta entrada.</p>'
      + '<div class="secao ouro entradas-masmorra"><span>Entradas hoje</span><strong>' + restam + '/' + M.entradasPorDia + '</strong></div>';
    if (g.convites.length) html += '<h3 class="subtitulo">Convites para grupo</h3><div class="itens">' + g.convites.map(function (c) {
      return '<div class="item"><div><strong>' + esc(c.de) + '</strong> convidou você <span class="suave">(' + c.membros + '/3 no grupo)</span></div>'
        + '<div class="item-acoes"><button class="btn" data-acao="grupo-aceitar" data-convite="' + c.id + '">Aceitar</button>'
        + '<button class="btn secundario" data-acao="grupo-recusar" data-convite="' + c.id + '">Recusar</button></div></div>';
    }).join('') + '</div>';
    var gr = g.grupo;
    if (!gr) return html + '<p class="suave">Você não está num grupo. Na aba <strong>Social</strong>, use "Convidar para o grupo" num amigo para montar o seu.</p>' + listaMasmorras(null, false);
    var souLider = gr.lider === p.id, eu = gr.membros.find(function (m) { return m.id === p.id; }) || {};
    var vagas = [];
    for (var i = 0; i < M.tamanhoGrupo; i++) {
      var m = gr.membros[i];
      if (!m) { vagas.push('<div class="mas-vaga vazia">Vaga livre' + (gr.convidados[i - gr.membros.length] ? '<div class="suave pequeno">Convidado: ' + esc(gr.convidados[i - gr.membros.length]) + '</div>' : '') + '</div>'); continue; }
      vagas.push('<div class="mas-vaga' + (m.pronto ? ' pronto' : '') + '"><div class="moldura">' + F.personagem(m.raca, m.classe, m.sexo) + '</div>'
        + '<div><strong>' + (m.id === gr.lider ? '👑 ' : '') + esc(m.nome) + '</strong></div>'
        + '<div class="suave pequeno">' + (D.classes[m.classe] ? D.classes[m.classe].nome : '') + ' · Lv ' + m.nivel + ' · entradas ' + (M.entradasPorDia - m.entradas) + '/' + M.entradasPorDia + '</div>'
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

  function listaMasmorras(escolhida, souLider) {
    var p = estado.personagem;
    return '<h3 class="subtitulo">Masmorras</h3><div class="mas-lista">' + D.masmorras.map(function (mm) {
      var area = D.areas.find(function (a) { return a.id === mm.area; });
      var bloqueada = p.nivel < mm.nivelMin;
      return '<div class="mas-card' + (mm.id === escolhida ? ' selecionada' : '') + (bloqueada ? ' bloqueada' : '') + '">'
        + '<div class="mas-card-topo"><strong>' + (bloqueada ? '🔒 ' : '') + esc(mm.nome) + '</strong><span class="suave">Level ' + mm.nivelMin + '+</span></div>'
        + '<div class="suave pequeno">' + area.monstros.map(function (m) { return m.nome; }).join(', ') + ' · Elite: ' + esc(mm.elite) + ' · Chefe: ' + esc(mm.chefe) + '</div>'
        + '<div class="pequeno">Joia: ' + textoDrops(mm.joias) + '</div>'
        + (souLider ? (mm.id === escolhida ? '<div class="online pequeno">✔ Escolhida</div>'
          : '<button class="btn secundario mini-opcao" data-acao="grupo-escolher" data-valor="' + mm.id + '">Escolher</button>') : '')
        + '</div>';
    }).join('') + '</div>';
  }

  // Atualiza o grupo: a cada 4 s na aba Masmorra ou em grupo; senão a cada 30 s (convites).
  var ciclosGrupo = 0;
  setInterval(function () {
    if (!estado.personagem || estado.batalha || estado.luta || estado.lutaArena || document.hidden) return;
    ciclosGrupo++;
    var emGrupo = estado.gm && estado.gm.grupo;
    if (estado.aba === 'masmorra' || emGrupo || ciclosGrupo % 8 === 0) carregarGrupo();
    if (!estado.lutaArena && (ciclosGrupo % 8 === 4 || (estado.aba === 'arena' && ciclosGrupo % 3 === 0))) carregarArena();
  }, 4000);

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
  function abrirDesafio(id) {
    var p = estado.personagem;
    estado.desafio = { id: id, perfil: null, erro: null };
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
        return it ? '<div class="icone-pequeno borda-' + it.raridade + aura(it) + '" title="' + esc(R.nomeItem(it)) + ' (' + D.raridades[it.raridade].nome + ')">'
          + F.icone(it) + (it.encanto ? '<span class="nivel-encanto">+' + it.encanto + '</span>' : '') + '</div>'
          : '<div class="icone-pequeno vazio" title="' + D.slots[k].nome + ' vazio"></div>';
      }).join('');
      var sq = A.saque, ouro = pf.ouro || 0;
      var saque = Math.floor(ouro * sq.minimo / 100).toLocaleString('pt-BR') + ' a ' + Math.floor(ouro * sq.maximo / 100).toLocaleString('pt-BR');
      corpo = '<div class="desafio-topo"><div class="moldura">' + F.personagem(pf.raca, pf.classe, pf.sexo) + '</div><div>'
        + '<h2>' + esc(pf.nome) + '</h2><div class="suave">' + (D.racas[pf.raca] ? D.racas[pf.raca].nome : '') + ' · ' + (D.classes[pf.classe] ? D.classes[pf.classe].nome : '') + ' · Level ' + pf.nivel + '</div>'
        + (pf.alianca ? '<div class="desafio-alianca">' + brasaoSvg(pf.alianca.brasao) + '<span>' + esc(pf.alianca.nome) + ' ' + siglaHtml(pf.alianca.sigla) + '</span></div>' : '')
        + '<div class="desafio-selos">' + (pf.posicao ? '<span class="selo-pos">#' + pf.posicao + ' · ' + esc(nomeArena(pf.arena)) + '</span>' : '')
        + '<span class="selo-pos">' + pf.vitorias + ' V · ' + pf.derrotas + ' D</span></div>'
        + '<div class="veredito ' + veredito[0] + '">' + veredito[1] + '</div></div></div>'
        + '<h3 class="subtitulo">Equipamentos</h3><div class="desafio-equip">' + equip + '</div>'
        + tabela
        + '<p class="desafio-ouro">Ouro: <strong class="cor-ouro">' + ouro.toLocaleString('pt-BR') + '</strong> · se vencer, saque de <strong class="cor-ouro">' + saque + ' de ouro</strong>'
        + (pf.posicao === 1 ? ' e o <strong class="cor-ouro">jackpot</strong>' : '') + '.</p>';
    }
    var entradas = estado.arena && estado.arena.entradas;
    var semEntrada = entradas && entradas.valor <= 0;
    return '<div class="zoom-fundo" data-acao="desafio-cancelar"><div class="zoom-janela desafio-janela" role="dialog" aria-label="Perfil do adversário">'
      + '<button class="zoom-x" data-acao="desafio-cancelar" title="Fechar">✕</button>'
      + '<div class="zoom-rotulo">Desafiar na Arena?</div>' + corpo
      + '<div class="botoes"><button class="btn btn-rolar" data-acao="desafio-confirmar"' + (!pf || semEntrada ? ' disabled' : '') + '>⚔ Desafiar'
      + (entradas ? ' <small>(gasta 1 de ' + entradas.valor + ' entradas)</small>' : '') + '</button>'
      + '<button class="btn secundario" data-acao="desafio-cancelar">Cancelar</button></div></div></div>';
  }

  function linhaRanking(x, botao) {
    return '<div class="item arena-linha' + (x.id === estado.personagem.id ? ' meu' : '') + '"><div class="arena-pos">' + trofeu(x.posicao) + '</div>'
      + '<div class="amigo-info">' + siglaHtml(x.sigla) + '<strong>' + esc(x.nome) + '</strong><div class="suave pequeno">' + (D.classes[x.classe] ? D.classes[x.classe].nome : '')
      + ' · Lv ' + x.nivel + ' · Poder ' + Number(x.poder || 0).toLocaleString('pt-BR') + '</div></div>'
      + '<div class="item-acoes">' + (botao || '') + '</div></div>';
  }

  function abaArena() {
    var p = estado.personagem, ar = estado.arena;
    if (!ar) { carregarArena(); return '<p class="suave">' + (estado.arenaErro ? esc(estado.arenaErro) : 'Carregando…') + '</p>'; }
    if (ar.local) return '<p class="suave">A Arena é contra outros jogadores e precisa do servidor: jogue pelo site do Tanka.</p>';
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
      + '<p class="suave pequeno">Derrote o Top 1 para levar o jackpot. Ele cresce a cada 10 minutos com o mesmo Top 1 e é entregue ao Top 1 às 00:00. '
      + 'Na Arena só o D20 decide: 1 erra, 18 a 20 são críticos.</p>';
    html += '<h3 class="subtitulo">Top 5 · ' + esc(nomeArena(ar.arena)) + '</h3><div class="itens">'
      + (ar.top5.length ? ar.top5.map(function (x) { return linhaRanking(x); }).join('') : '<p class="suave">Ninguém nesta arena ainda.</p>') + '</div>';
    if (ar.arena === ar.minha_arena && ar.posicao) {
      var semEntrada = e.valor <= 0;
      html += '<h3 class="subtitulo">Sua posição: #' + ar.posicao + ' de ' + ar.total + '</h3><p class="suave pequeno">Você pode desafiar os 5 logo acima de você. Vencendo, toma a posição dele e saqueia parte do ouro.</p><div class="itens">'
        + ar.alvos.map(function (x) {
          if (x.id === p.id) return linhaRanking(x, '<span class="suave pequeno">Você</span>');
          var bloq = semEntrada ? ' disabled title="Sem entradas"' : x.conta_minha ? ' disabled title="Personagem seu"' : '';
          return linhaRanking(x, '<button class="btn" data-acao="arena-desafiar" data-id="' + esc(x.id) + '"' + bloq + '>Desafiar</button>');
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
      return '<div class="item"><div>' + (h.revanche ? '<span class="suave pequeno">Revanche · </span>' : '') + texto + ouro
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
    L.ultimo = { numero: ev.dado, quem: ev.de, texto: efeitoDado(ev.dado) + (ev.dano ? ' → ' + ev.dano + ' de dano' : '') };
    L.registro.push('<p class="' + (ev.dado === 1 ? 'errou' : ev.dado >= 18 ? 'critico' : ev.de === 'a' ? '' : 'dano-recebido') + '">🎲 <strong>' + ev.dado + '</strong> '
      + esc(atk.nome) + (ev.auto ? ' (tempo esgotado)' : '') + ': ' + efeitoDado(ev.dado) + (ev.dano ? ' — ' + esc(alvo.nome) + ' perde <strong>' + ev.dano + '</strong>' : '') + '.</p>');
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
      animarDado(ev.dado, ev.de, function () {
        aplicarEventoArena(ev);
        redesenharArena();
        L.timer = setTimeout(tocarEventosArena, 350);
      }, jaCaindo);
      return;
    }
    if (L.luta.situacao !== 'andamento') { L.fase = 'fim'; L.modal = null; fecharDado3d(); redesenharArena(); carregarArena(); return; }
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
      return '<div class="lutador arena-lutador" id="lutador-' + lado + '"><div class="moldura">' + F.personagem(x.raca, x.classe, x.sexo) + '</div>'
        + '<h3>' + esc(x.nome) + '</h3><div class="suave pequeno">' + (D.classes[x.classe] ? D.classes[x.classe].nome : '') + ' · Lv ' + x.nivel + '</div>'
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
  var FORMAS_BRASAO = {
    classico: 'M10 8H90V60C90 92 50 112 50 112C50 112 10 92 10 60Z',
    redondo: 'M50 10A50 50 0 1 1 49.9 10Z',
    pontudo: 'M8 8H92V50L50 114L8 50Z',
    estandarte: 'M14 4H86V112L50 92L14 112Z',
  };
  var SIMBOLOS_BRASAO = {
    dragao: 'M28 70C30 52 40 40 56 36L52 28L62 34L66 26L68 38C76 42 80 50 78 58L70 56L72 64L62 62C58 70 48 76 40 76L46 68C40 70 34 72 28 70ZM60 44A3 3 0 1 0 60.1 44Z',
    lobo: 'M32 34L42 48H58L68 34L66 56L58 74L50 80L42 74L34 56ZM42 56L47 58L42 60ZM58 56L53 58L58 60ZM46 68H54L50 73Z',
    coroa: 'M26 72L22 40L36 52L50 32L64 52L78 40L74 72ZM26 76H74V82H26Z',
    caveira: 'M50 30C36 30 28 40 28 52C28 60 32 64 36 66V76H64V66C68 64 72 60 72 52C72 40 64 30 50 30ZM40 50A6 6 0 1 0 40.1 50ZM60 50A6 6 0 1 0 60.1 50ZM46 64L50 58L54 64Z',
    espada: 'M48 24H52L54 30V66H46V30ZM36 66H64V71H36ZM47 71H53V82H47ZM45 82H55V87H45Z',
    machado: 'M47 26H53V88H47ZM53 32C68 30 76 40 76 50C76 60 68 68 53 66ZM47 34C38 36 32 42 32 50C32 56 38 62 47 62Z',
    olho: 'M22 58C32 42 68 42 78 58C68 74 32 74 22 58ZM50 48A10 10 0 1 0 50.1 48ZM50 54A4 4 0 1 0 50.1 54Z',
    chama: 'M50 24C54 38 68 44 68 62C68 74 60 82 50 82C40 82 32 74 32 62C32 54 38 48 42 42C44 50 46 54 50 56C48 46 46 34 50 24Z',
  };
  function brasaoSvg(b, classe) {
    b = b || {};
    var forma = FORMAS_BRASAO[b.forma] || FORMAS_BRASAO.classico, cor = /^#[0-9a-f]{6}$/i.test(b.cor || '') ? b.cor : AL.brasao.cores[0];
    var simbolo = SIMBOLOS_BRASAO[b.simbolo] || SIMBOLOS_BRASAO.dragao;
    return '<svg class="brasao ' + (classe || '') + '" viewBox="0 0 100 120" aria-hidden="true">'
      + '<defs><linearGradient id="br-luz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>'
      + '<path d="' + forma + '" fill="' + cor + '" stroke="#c9a24a" stroke-width="5" stroke-linejoin="round"/>'
      + '<path d="' + forma + '" fill="url(#br-luz)"/>'
      + '<path d="' + simbolo + '" fill="#f3e2b0" stroke="#5a4214" stroke-width="1.5" stroke-linejoin="round" fill-rule="evenodd"/></svg>';
  }
  // Na ficha: aliança e bônus ativos.
  function bonusFichaHtml() {
    var st = aliancaAtual(), a = st && st.alianca;
    if (!a) return '';
    var b = bonusAlianca(), partes = [];
    if (b.exp) partes.push('+' + b.exp + '% exp');
    if (b.ouro) partes.push('+' + b.ouro + '% ouro');
    return '<div class="ficha-alianca">' + brasaoSvg(a.brasao) + '<div><strong>' + esc(a.nome) + '</strong> ' + siglaHtml(a.sigla)
      + '<div class="suave pequeno">' + (partes.length ? 'Bônus ativos: <span class="mais">' + partes.join(' · ') + '</span>' : 'Nenhum bônus ativo') + '</div></div></div>';
  }
  function siglaHtml(sigla) { return sigla ? '<span class="sigla">[' + esc(sigla) + ']</span> ' : ''; }

  function aliancaAtual() {
    var st = estado.alianca;
    return st && estado.personagem && st.pid === estado.personagem.id ? st : null;
  }
  // Bônus de exp e ouro ativos para as caçadas (0 se não tem).
  function bonusAlianca() {
    var st = aliancaAtual(), a = st && st.alianca, agora = C.agora();
    if (!a) return { exp: 0, ouro: 0 };
    return { exp: a.bonus_exp_ate && Date.parse(a.bonus_exp_ate) > agora ? a.bonus_pct : 0,
      ouro: a.bonus_ouro_ate && Date.parse(a.bonus_ouro_ate) > agora ? a.bonus_pct : 0 };
  }
  function seloAlianca() {
    var st = aliancaAtual();
    if (!st || st.local) return '';
    var n = st.alianca ? (st.pedidos || []).length : (st.convites || []).length;
    return n ? ' <span class="selo-pedidos">' + n + '</span>' : '';
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
    if (st.local) return '<p class="suave">As alianças juntam vários jogadores e precisam do servidor: jogue pelo site do Tanka.</p>';
    if (st.erro) return '<p class="menos">' + esc(st.erro) + '</p><p class="suave pequeno">Se for a primeira vez, rode o supabase/schema.sql de novo no Supabase.</p>';
    return st.alianca ? telaMinhaAlianca(st) : telaSemAlianca(st);
  }

  function telaSemAlianca(st) {
    var p = estado.personagem, html = '';
    if (st.espera_ate) html += '<p class="menos">Você saiu de uma aliança: só pode entrar em outra depois de ' + dataCurta(st.espera_ate) + '.</p>';
    if (st.convites.length) {
      html += '<h3 class="subtitulo">Convites recebidos</h3><div class="itens">' + st.convites.map(function (a) {
        return cartaAlianca(a, '<button class="btn btn-pequeno" data-acao="al-responder" data-id="' + a.convite + '" data-sim="1">Aceitar</button>'
          + '<button class="btn secundario btn-pequeno" data-acao="al-responder" data-id="' + a.convite + '">Recusar</button>');
      }).join('') + '</div>';
    }
    var cria = estado.aliancaCriar;
    if (p.nivel < AL.nivelMin) {
      html += '<div class="caixa-interna"><h3>Criar uma aliança</h3><p class="suave">Abre no level ' + AL.nivelMin + '. Até lá, você pode entrar numa aliança que já existe.</p></div>';
    } else if (!cria) {
      html += '<div class="caixa-interna alianca-chamada"><div><h3>Funde a sua aliança</h3><p class="suave">' + AL.custoOuro.toLocaleString('pt-BR') + ' de ouro + '
        + AL.custoReputacao + ' de reputação. Você vira o líder.</p></div><button class="btn" data-acao="al-criar-abrir">Criar aliança</button></div>';
    } else {
      var faltaOuro = AL.custoOuro - p.ouro, faltaRep = AL.custoReputacao - (p.reputacao || 0);
      html += '<div class="caixa-interna"><h3>Nova aliança</h3>'
        + '<div class="alianca-form"><label>Nome (3 a 20 letras)<input id="al-nome" maxlength="20" value="' + esc(cria.nome) + '" autocomplete="off"></label>'
        + '<label>Sigla (3 ou 4 letras)<input id="al-sigla" maxlength="4" value="' + esc(cria.sigla) + '" autocomplete="off" style="text-transform:uppercase"></label></div>'
        + editorBrasao(cria.brasao)
        + '<div class="botoes"><button class="btn" data-acao="al-criar"' + (faltaOuro > 0 || faltaRep > 0 ? ' disabled' : '') + '>Fundar · '
        + AL.custoOuro.toLocaleString('pt-BR') + ' de ouro + ' + AL.custoReputacao + ' de reputação</button>'
        + '<button class="btn secundario" data-acao="al-criar-fechar">Cancelar</button></div>'
        + (faltaOuro > 0 || faltaRep > 0 ? '<p class="menos pequeno centro">Faltam ' + [faltaOuro > 0 ? faltaOuro.toLocaleString('pt-BR') + ' de ouro' : '', faltaRep > 0 ? faltaRep + ' de reputação' : ''].filter(Boolean).join(' e ') + '.</p>' : '')
        + '</div>';
    }
    html += '<h3 class="subtitulo">Alianças</h3><div class="linha-form"><input id="al-busca" placeholder="Buscar por nome ou sigla" value="' + esc(estado.aliancaBusca || '') + '" autocomplete="off">'
      + '<button class="btn secundario" data-acao="al-buscar">Buscar</button></div><div class="itens">'
      + (st.lista.length ? st.lista.map(function (a) {
        var pedido = st.pedidos_feitos.indexOf(a.id) >= 0, cheia = a.membros >= a.vagas;
        return cartaAlianca(a, pedido ? '<span class="suave pequeno">Pedido enviado</span>'
          : '<button class="btn btn-pequeno" data-acao="al-pedir" data-id="' + a.id + '"' + (cheia || st.espera_ate ? ' disabled' : '') + '>' + (cheia ? 'Cheia' : 'Pedir para entrar') + '</button>');
      }).join('') : '<p class="suave">Nenhuma aliança encontrada.</p>') + '</div>';
    return html;
  }

  function telaMinhaAlianca(st) {
    var p = estado.personagem, a = st.alianca, cargo = st.meu_cargo, chefe = cargo === 'lider', manda = cargo !== 'membro';
    var html = '<div class="alianca-topo">' + brasaoSvg(a.brasao, 'grande') + '<div class="alianca-titulo">'
      + '<h2>' + esc(a.nome) + ' ' + siglaHtml(a.sigla) + '</h2>'
      + '<div class="suave">Level ' + a.nivel + ' · ' + a.membros + '/' + a.vagas + ' membros · Poder ' + Number(a.poder).toLocaleString('pt-BR') + '</div>'
      + (a.exp_proximo ? barra('exp', a.exp, a.exp_proximo, Number(a.exp).toLocaleString('pt-BR') + ' / ' + Number(a.exp_proximo).toLocaleString('pt-BR') + ' de exp')
        : '<div class="cor-ouro">Level máximo!</div>')
      + '<div class="suave pequeno">Você é <strong>' + ({ lider: 'Líder', oficial: 'Oficial', membro: 'Membro' })[cargo] + '</strong></div></div>'
      + (chefe ? '<button class="btn secundario btn-pequeno" data-acao="al-brasao-abrir">Mudar brasão</button>' : '') + '</div>';
    if (chefe && estado.aliancaBrasao) {
      html += '<div class="caixa-interna">' + editorBrasao(estado.aliancaBrasao, 'Novo brasão')
        + '<div class="botoes"><button class="btn" data-acao="al-brasao-salvar">Salvar brasão</button><button class="btn secundario" data-acao="al-brasao-fechar">Cancelar</button></div></div>';
    }
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
        + (chefe ? '<button class="btn btn-pequeno" data-acao="al-bonus" data-valor="' + tipo + '"' + (a.tesouro < AL.bonus.custo ? ' disabled' : '') + '>'
          + (ativo ? 'Renovar' : 'Ativar') + ' · ' + AL.bonus.custo.toLocaleString('pt-BR') + '</button>' : '') + '</div>';
    }
    html += '<div class="caixa-interna"><h3>Tesouro: <span class="cor-ouro">' + Number(a.tesouro).toLocaleString('pt-BR') + ' de ouro</span></h3>'
      + '<p class="suave pequeno">Cada ouro doado vira exp da aliança e conta como sua contribuição. Os bônus valem para todos os membros por '
      + AL.bonus.dias + ' dias e crescem com o level da aliança.</p>'
      + '<div class="linha-form"><input id="al-doar" type="number" min="' + AL.doacaoMinima + '" step="100" inputmode="numeric" placeholder="Quanto doar (mín. ' + AL.doacaoMinima + ')">'
      + '<button class="btn" data-acao="al-doar">Doar ouro</button></div>'
      + '<div class="bonus-lista">' + cartaBonus('exp', 'de exp nas caçadas', a.bonus_exp_ate) + cartaBonus('ouro', 'de ouro dos monstros', a.bonus_ouro_ate) + '</div></div>';
    // Convidar e pedidos
    if (manda) {
      html += '<div class="caixa-interna"><h3>Convidar</h3><div class="linha-form"><input id="al-convidar" maxlength="16" placeholder="Nome do personagem" autocomplete="off">'
        + '<button class="btn" data-acao="al-convidar">Convidar</button></div>'
        + (st.pedidos.length ? '<h3 class="subtitulo">Pedidos para entrar</h3><div class="itens">' + st.pedidos.map(function (x) {
          return '<div class="item"><div><strong>' + esc(x.nome) + '</strong><div class="suave pequeno">' + (D.classes[x.classe] ? D.classes[x.classe].nome : '') + ' · Lv ' + x.nivel
            + ' · Poder ' + Number(x.poder).toLocaleString('pt-BR') + '</div></div><div class="item-acoes">'
            + '<button class="btn btn-pequeno" data-acao="al-decidir" data-id="' + x.id + '" data-sim="1">Aceitar</button>'
            + '<button class="btn secundario btn-pequeno" data-acao="al-decidir" data-id="' + x.id + '">Recusar</button></div></div>';
        }).join('') + '</div>' : '') + '</div>';
    }
    // Membros
    html += '<h3 class="subtitulo">Membros (' + a.membros + '/' + a.vagas + ')</h3><div class="itens">' + st.membros.map(function (x) {
      var eu = x.id === p.id, acoes = '';
      if (!eu && chefe) {
        acoes += x.cargo === 'oficial'
          ? '<button class="btn secundario btn-pequeno" data-acao="al-cargo" data-id="' + x.id + '" data-valor="membro">Rebaixar</button>'
          : '<button class="btn secundario btn-pequeno" data-acao="al-cargo" data-id="' + x.id + '" data-valor="oficial">Promover a oficial</button>';
        acoes += confirmar('lider:' + x.id, 'Passar liderança', 'Confirmar: passar');
      }
      if (!eu && (chefe || (cargo === 'oficial' && x.cargo === 'membro'))) acoes += confirmar('expulsar:' + x.id, 'Expulsar', 'Confirmar: expulsar');
      var icone = x.cargo === 'lider' ? '👑 ' : x.cargo === 'oficial' ? '⭐ ' : '';
      return '<div class="item alianca-membro' + (eu ? ' meu' : '') + '"><div class="item-texto"><div>' + icone + '<strong>' + esc(x.nome) + '</strong> ' + vistoTexto(x.visto_em) + '</div>'
        + '<div class="suave pequeno">' + ({ lider: 'Líder', oficial: 'Oficial', membro: 'Membro' })[x.cargo] + ' · ' + (D.classes[x.classe] ? D.classes[x.classe].nome : '')
        + ' · Lv ' + x.nivel + ' · Poder ' + Number(x.poder).toLocaleString('pt-BR') + ' · Contribuição <span class="cor-ouro">' + Number(x.contribuicao).toLocaleString('pt-BR') + '</span></div></div>'
        + '<div class="item-acoes">' + acoes + '</div></div>';
    }).join('') + '</div>';
    html += '<div class="botoes alianca-sair">' + (chefe ? confirmar('desfazer', 'Desfazer a aliança', 'Confirmar: desfazer para sempre')
      : confirmar('sair', 'Sair da aliança', 'Confirmar: sair (' + AL.esperaHoras + ' h sem poder entrar em outra)')) + '</div>';
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
          avisar('Aliança fundada! Você é o líder.', 'nivel');
          carregarAlianca(); carregarArena();
        }, function (e) { avisar(e.message); });
        return true;
      }
      case 'al-buscar': estado.aliancaBusca = valor('al-busca'); carregarAlianca(); return true;
      case 'al-pedir': acaoAlianca(A2.pedir(p.id, Number(el.dataset.id)), 'Pedido enviado. Espere o líder ou um oficial aceitar.'); return true;
      case 'al-responder': acaoAlianca(A2.responder(p.id, Number(el.dataset.id), !!el.dataset.sim), el.dataset.sim ? 'Bem-vindo à aliança!' : 'Convite recusado.', el.dataset.sim ? 'nivel' : ''); return true;
      case 'al-decidir': acaoAlianca(A2.decidir(p.id, Number(el.dataset.id), !!el.dataset.sim), el.dataset.sim ? 'Novo membro na aliança!' : 'Pedido recusado.'); return true;
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
        acaoAlianca(A2.doar(p.id, qtd), 'Você doou ' + qtd.toLocaleString('pt-BR') + ' de ouro ao tesouro!', 'item');
        return true;
      }
      case 'al-bonus': acaoAlianca(A2.bonus(p.id, el.dataset.valor), 'Bônus ativado por ' + AL.bonus.dias + ' dias para todos!', 'nivel'); return true;
      case 'al-cargo': acaoAlianca(A2.cargo(p.id, el.dataset.id, el.dataset.valor), el.dataset.valor === 'oficial' ? 'Promovido a oficial.' : 'Rebaixado a membro.'); return true;
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
      case 'al-pedir-confirmar': estado.aliancaConfirmar = el.dataset.chave; telaJogo(); return true;
      case 'al-cancelar': estado.aliancaConfirmar = null; telaJogo(); return true;
      case 'al-confirmado': {
        var partes = el.dataset.chave.split(':');
        if (partes[0] === 'lider') acaoAlianca(A2.cargo(p.id, partes[1], 'lider'), 'Liderança passada. Agora você é oficial.');
        else if (partes[0] === 'expulsar') acaoAlianca(A2.expulsar(p.id, partes[1]), 'Membro expulso.');
        else if (partes[0] === 'sair') acaoAlianca(A2.sair(p.id), 'Você saiu da aliança.');
        else if (partes[0] === 'desfazer') acaoAlianca(A2.desfazer(p.id), 'A aliança foi desfeita.');
        return true;
      }
      case 'al-admin-listar':
        A2.admin(p.id, null, 'listar', null).then(function (l) { estado.adminAliancas = l; telaJogo(); }, function (e) { avisar(e.message); });
        return true;
      case 'al-admin': {
        var op = el.dataset.op, id = Number(el.dataset.id), v = null;
        if (op === 'renomear') { v = window.prompt('Novo nome da aliança:'); if (!v) return true; }
        if (op === 'lider') { v = window.prompt('Nome do personagem que vira líder:'); if (!v) return true; }
        if (op === 'exp') v = 50000;
        if (op === 'apagar' && !window.confirm('Apagar a aliança para sempre?')) return true;
        A2.admin(p.id, id, op, v).then(function (l) { estado.adminAliancas = l; avisar('Feito.'); telaJogo(); carregarAlianca(); }, function (e) { avisar(e.message); });
        return true;
      }
    }
    return false;
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
    var classe = D.classes[m.classe] ? D.classes[m.classe].nome : '';
    var acoes = ehAdmin()
      ? '<span class="chat-admin"><button data-chat="apagar" data-id="' + m.id + '" title="Apagar mensagem">🗑</button>'
        + '<button data-chat="silenciar" data-nome="' + esc(m.personagem) + '" title="Silenciar jogador">🔇</button></span>'
      : '';
    return '<p class="chat-msg"><span class="chat-hora">' + hora + '</span> ' + siglaHtml(m.sigla) + '<strong class="chat-nome classe-' + esc(m.classe) + '">'
      + esc(m.personagem) + '</strong> <span class="chat-info">' + classe + ' Lv ' + m.nivel + '</span>: '
      + esc(m.texto) + acoes + '</p>';
  }

  function linhaChatAlianca(m) {
    var hora = new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return '<p class="chat-msg"><span class="chat-hora">' + hora + '</span> ' + (m.cargo === 'lider' ? '👑 ' : m.cargo === 'oficial' ? '⭐ ' : '')
      + '<strong class="chat-nome">' + esc(m.personagem) + '</strong>: ' + esc(m.texto) + '</p>';
  }
  function chatDaAlianca() { var st = aliancaAtual(); return !!(st && st.alianca); }

  function desenharChat() {
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
        + '<button data-chat="canal" data-canal="alianca" class="' + (daAlianca ? 'ativo' : '') + '">Aliança</button></span>'
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

  // ---------------- Início ----------------
  app.innerHTML = '<p class="carregando">Conectando ao servidor…</p>';
  C.iniciar().then(function (conta) {
    estado.conta = conta;
    if (conta) telaPersonagens(); else telaAuth('entrar');
  });
})();
