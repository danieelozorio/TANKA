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
        var f = R.faixaBonus(def.bonus[k][idx]);
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
    avisar('Este personagem foi jogado em outra aba ou aparelho. Carregando o progresso mais novo...');
    setTimeout(function () { location.reload(); }, 2500);
  });

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

    var base = D.classes[c.classe].atributos;
    var final = R.atributosIniciais(c.raca, c.classe);
    var linhas = R.ATRIBUTOS.map(function (k) {
      var mod = final[k] - base[k];
      var modTxt = mod > 0 ? '<span class="mais">+' + mod + '</span>' : mod < 0 ? '<span class="menos">' + mod + '</span>' : '—';
      return '<tr><td>' + D.atributos[k].nome + '</td><td>' + base[k] + '</td><td>' + modTxt + '</td><td><strong>' + final[k] + '</strong></td></tr>';
    }).join('');

    mostrarCenario(false);
    areaMusica(true);
    app.innerHTML = topo('<button class="btn secundario" data-acao="voltar-personagens">Voltar</button>')
      + '<div class="conteudo"><div class="criacao"><div>'
      + '<section class="etapa"><h2>1. Nome</h2><label>Nome do personagem'
      + '<input id="nome-personagem" maxlength="16" value="' + esc(c.nome) + '" placeholder="Ex.: Aldric"></label></section>'
      + '<section class="etapa"><h2>2. Sexo</h2><div class="opcoes">' + sexos + '</div></section>'
      + '<section class="etapa"><h2>3. Raça <small>— ' + esc(D.racas[c.raca].descricao) + '</small></h2><div class="grade">' + racas + '</div></section>'
      + '<section class="etapa"><h2>4. Classe <small>— ' + esc(D.classes[c.classe].descricao) + '</small></h2><div class="grade">' + classes + '</div></section>'
      + '</div><aside class="caixa previa"><div class="moldura">' + F.personagem(c.raca, c.classe, c.sexo) + '</div>'
      + '<h3 class="centro">' + nomeRaca(c.raca, c.sexo) + ' ' + nomeClasse(c.classe, c.sexo) + ' · ' + D.sexos[c.sexo].nome + '</h3>'
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
    iniciarAtividade();
    var presente = estado.personagem.recomecoPresente === 1;
    if (presente) estado.personagem.recomecoPresente = 2;
    salvar();   // também marca o personagem como online para os amigos
    if (presente) setTimeout(function () {
      avisar('🎁 Os atributos mudaram! Você ganhou 1 ' + D.RECOMECO.nome + ' para redistribuir seus pontos (Herói > Atributos).', 'item');
    }, 800);
    estado.social = null;
    estado.gm = null;
    estado.luta = null;
    if (estado.cacada) { clearTimeout(estado.cacada.timer); clearInterval(estado.cacada.relogio); }
    estado.cacada = null;
    estado.areaAberta = null;
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
    { id: 'heroi', nome: 'Herói', abas: ['personagem', 'encantar', 'habilidades'] },
    { id: 'aventura', nome: 'Aventura', abas: ['cacar', 'masmorra'] },
    { id: 'arena', nome: 'Arena', abas: ['arena'] },
    { id: 'mercado', nome: 'Mercado', abas: ['mercado', 'leilao'] },
    { id: 'social', nome: 'Social', abas: ['social', 'ranking', 'alianca'] },
  ];
  var NOME_ABA = { mercado: 'Loja', leilao: 'Leilão', personagem: 'Personagem', encantar: 'Encantar', habilidades: 'Habilidades', cacar: 'Caçar', masmorra: 'Masmorra', social: 'Amigos', ranking: 'Ranking', alianca: 'Aliança' };
  function grupoDaAba(aba) { return GRUPOS.filter(function (g) { return g.abas.indexOf(aba) >= 0; })[0]; }
  // Raça e classe concordam com o gênero da personagem (sem o sexo, fica no masculino).
  function nomeRaca(r, sexo) { var x = D.racas[r]; return x ? (sexo === 'feminino' && x.nomeF || x.nome) : ''; }
  function nomeClasse(k, sexo) { var x = D.classes[k]; return x ? (sexo === 'feminino' && x.nomeF || x.nome) : ''; }
  // Retrato: o da segunda classe quando já escolheu (assets/personagens/<raca>-<segunda classe>[-f].jpg).
  function classeRetrato(x) { var c2 = x.classe2 || (x.talentos && x.talentos.classe2); return c2 && D.SEGUNDAS_CLASSES[c2] ? c2 : x.classe; }
  // Classe de um lutador vindo do servidor (com a segunda classe, quando tiver).
  function nomeClasseX(x) { var c = x.classe2 && D.SEGUNDAS_CLASSES[x.classe2]; return c ? (x.sexo === 'feminino' && c.nomeF || c.nome) : nomeClasse(x.classe, x.sexo); }
  // Classe do próprio personagem: mostra a segunda classe quando já escolheu (ex.: Paladina).
  function nomeClasseP(p) { var c = R.segundaClasse(p); return c ? (p.sexo === 'feminino' && c.nomeF || c.nome) : nomeClasse(p.classe, p.sexo); }
  function seloDaAba(aba) { return aba === 'habilidades' ? seloHabilidades() : aba === 'masmorra' ? seloMasmorra() : aba === 'arena' ? seloArena() : aba === 'social' ? seloPedidos() : aba === 'alianca' ? seloAlianca() : ''; }
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
      + '<h2>' + esc(p.nome) + '</h2><div class="suave">' + nomeRaca(p.raca, p.sexo) + ' · ' + nomeClasseP(p) + '</div>'
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
      + atividadesHtml(p)
      + '</aside>';
  }

  // ----- Pontos de atributo: escolher com + e −, conferir a prévia e só então confirmar -----
  var DESCRICAO_ATRIBUTO = {
    for: 'Aumenta o ataque físico e o dano dos golpes críticos.',
    des: 'Aumenta a precisão, a evasão e a chance de magia crítica.',
    res: 'Aumenta a vida, a defesa e a defesa mágica.',
    int: 'Aumenta o ataque mágico (dano dos magos).',
    sor: 'Aumenta o crítico mágico, o dano crítico mágico, o encantamento e o craft.',
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
      res: { ganhos: ['+' + D.HP_POR_RES + ' de vida por ponto', '+' + D.DEFESA.fator + ' de defesa e +' + D.DEFESA.fator + ' de defesa mágica a cada 10 pontos'], degrau: [10, 'Defesa'] },
      int: { ganhos: dano === 'int' ? ['+1 de Ataque mágico a cada ' + n + ' pontos (soma no dano das magias)'] : ['Não ajuda a sua classe na luta'],
        degrau: dano === 'int' ? [n, 'Ataque mágico'] : null },
      sor: { ganhos: ['+1% de chance de crítico mágico por ponto', '+1% de dano crítico mágico por ponto',
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
    return '<article class="monstro' + (R.monstroLiberado(p, id) ? '' : ' monstro-bloqueado') + (selecionado ? ' monstro-escolhido' : '') + '"><div class="moldura">' + F.imagemMonstro(id) + '</div><div class="corpo">'
      + '<h3>' + m.nome + '</h3><p class="suave">' + m.descricao + '</p>'
      + '<dl class="ficha-monstro"><dt>Vida</dt><dd>' + m.hp.toLocaleString('pt-BR') + '</dd><dt title="Dano de cada golpe (a sua defesa diminui)">Dano</dt><dd>' + dano(m.ataque) + '</dd>'
      + '<dt title="Reduz o seu dano em porcentagem">Defesa</dt><dd>' + m.defesa + ' <small class="suave">(−' + Math.round(100 - 10000 / (100 + m.defesa)) + '% de dano)</small></dd>'
      + '<dt>Velocidade</dt><dd>' + m.velocidade + '</dd><dt title="Quantas vezes o monstro ataca para cada ataque seu">Ataques/turno</dt><dd>' + fmt(ritmo) + '</dd>'
      + '<dt>Experiência</dt><dd>' + m.exp.toLocaleString('pt-BR') + '</dd><dt>Ouro</dt><dd>' + m.ouro.toLocaleString('pt-BR') + '</dd>'
      + (m.chanceArma ? '<dt>Armas</dt><dd>' + m.chanceArma + '%</dd>' : '')
      + (m.chanceArmadura ? '<dt>Armaduras</dt><dd>' + m.chanceArmadura + '%</dd>' : '')
      + (m.pergaminho ? '<dt>Pergaminho</dt><dd>' + m.pergaminho.chance + '%</dd>' : '')
      + '<dt>Abatidos</dt><dd>' + (p.abates[id] || 0) + '</dd></dl>'
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
  function fichaItemHtml(item) {
    var p = estado.personagem;
    if (!item) {
      return '<p class="suave">' + (temMouse ? 'Passe o mouse num item para ver a ficha. Um clique amplia e compara; dois cliques equipam ou desequipam; o botão direito equipa. A seta verde ▲ mostra o que é melhor que o equipado.'
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
      linhas = '<li>Dano ' + dano(d) + comp + '</li>' + extrasArma(item).map(function (x) { return '<li class="suave">' + x + '</li>'; }).join('');
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
      + '<ul class="ficha-item-bonus">' + linhas + '</ul>' + conjuntoHtml(p, item)
      + (alvo ? '<p class="suave">Comparado com ' + nomeItemHtml(alvo) + '</p>' : '')
      + '<div class="item-acoes">' + acoes + '</div>';
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
      extrasArma(item).forEach(function (x) { linhas.push('<li class="suave"><span>' + x + '</span></li>'); });
    } else {
      var b = R.bonusItem(item), bo = outro ? R.bonusItem(outro) : {};
      Object.keys(D.bonus).filter(function (k) { return b[k] || bo[k]; }).forEach(function (k) {
        linhas.push('<li' + (b[k] ? '' : ' class="suave"') + '><span>' + D.bonus[k] + '</span><strong>+' + (b[k] || 0) + (outro ? diferenca(b[k] || 0, bo[k] || 0) : '') + '</strong></li>');
      });
    }
    linhas.push('<li><span>Encantamento</span><strong>+' + (item.encanto || 0) + '</strong></li>');
    linhas.push('<li><span>Venda</span><strong class="cor-ouro">' + R.precoVenda(item).toLocaleString('pt-BR') + ' de ouro</strong></li>');
    return '<div class="zoom-carta"><div class="zoom-rotulo">' + rotulo + '</div>'
      + '<div class="icone-zoom borda-' + corItem(item) + aura(item) + '">' + F.icone(item) + (item.encanto ? '<span class="nivel-encanto">+' + item.encanto + '</span>' : '') + '</div>'
      + '<div class="ficha-item-nome">' + nomeItemHtml(item) + '</div>'
      + '<div class="suave">' + tipoItem(item) + ' · <span class="raridade-' + corItem(item) + '">' + nomeRaridadeItem(item) + '</span>'
      + (item.nivel ? ' · nível ' + item.nivel : '') + '</div>'
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
          : '<span class="menos">' + esc(R.motivoNaoEquipa(estado.personagem, item) || 'Não é da sua classe') + '</span>')
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
    return '<div class="personagem-tela"><div class="boneco">' + slots
      + '<div class="retrato-central">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</div></div>'
      + '<div class="lateral"><div class="caixa-interna" id="ficha-item">' + (cFoco ? fichaConsumivelHtml(cFoco) : fichaItemHtml(foco)) + '</div>'
      + '<div class="caixa-interna"><h3>Bônus dos equipamentos</h3>'
      + (resumo ? '<dl class="status">' + resumo + '</dl>' : '<p class="suave">Nenhuma armadura equipada.</p>') + '</div></div></div>'
      + '<h3 class="subtitulo">Mochila</h3>' + abas + baixo;
  }

  // ----- Consumíveis: pergaminhos (e, no futuro, cristais e outros), empilhados com a quantidade -----
  function itemConsumivel(c) { return { tipo: c.tipo, classe: null, raridade: c.raridade, encanto: 0 }; }
  function consumiveisHtml(lista) {
    if (!lista.length) return '<p class="suave">Nenhum consumível. Pergaminhos de encantamento caem do 3º monstro de cada área, dos chefes, '
      + 'das masmorras e vêm das missões. Cristais sobram quando um item quebra na Forja.</p>';
    var celulas = lista.map(function (c) {
      return '<button class="celula borda-' + c.raridade + (estado.consumivelFoco === c.id ? ' focado' : '') + '" data-acao="consumivel" data-id="' + c.id + '"'
        + ' title="' + esc(R.nomeConsumivel(c)) + ' · ' + c.qtd + '">' + F.icone(itemConsumivel(c))
        + '<span class="qtd-consumivel">' + c.qtd.toLocaleString('pt-BR') + '</span></button>';
    });
    for (var n = lista.length; n < 8; n++) celulas.push('<div class="celula vazia"></div>');
    return '<p class="suave pequeno">Clique num consumível para ver para que serve. Não ocupam espaço na mochila.</p>'
      + '<div class="mochila consumiveis">' + celulas.join('') + '</div>';
  }
  function fichaConsumivelHtml(c) {
    var def = D.CONSUMIVEIS[c.tipo] || {};
    var acoes = c.tipo === 'pergaminho'
      ? '<button class="btn" data-acao="aba" data-aba="encantar">Ir para Encantar</button>'
        + (R.proximaRaridade(c.raridade) ? '<button class="btn secundario" data-acao="aba" data-aba="mercado">Trocar no Mercado</button>' : '')
      : '';
    return '<div class="ficha-item-topo"><div class="icone-grande borda-' + c.raridade + '">' + F.icone(itemConsumivel(c)) + '</div>'
      + '<div><div class="ficha-item-nome raridade-' + c.raridade + '">' + esc(R.nomeConsumivel(c)) + '</div>'
      + '<div class="suave">Consumível · <span class="raridade-' + c.raridade + '">' + D.raridades[c.raridade].nome + '</span>'
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

  function linhaRecomecoHab(p) {
    var R2 = D.RECOMECO_HABILIDADES, falta = R2.precoOuro - (p.ouro || 0);
    return '<div class="item item-com-icone carta-lendaria"><div class="icone-pequeno borda-lendaria icone-recomeco">📘</div>'
      + '<div class="item-texto"><div><span class="raridade-lendaria">' + R2.nome + '</span></div>'
      + '<div class="suave">Devolve os pontos de habilidade e deixa escolher a segunda classe de novo · '
      + R2.precoOuro.toLocaleString('pt-BR') + ' de ouro · você tem ' + (p.recomecosHab || 0) + '</div></div>'
      + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta.toLocaleString('pt-BR') + ' de ouro</span>' : '')
      + '<button class="btn" data-acao="hab-pergaminho-comprar"' + (falta > 0 ? ' disabled' : '') + '>Comprar</button></div></div>';
  }

  // ----- Aba Habilidades: habilidade inicial, segunda classe, pontos e ordem de uso -----
  var TIPO_HAB = { unico: 'Golpe', multiplo: 'Golpe duplo', area: 'Área', atordoar: 'Atordoar', reforco: 'Reforço', furtivo: 'Reforço', provocar: 'Reforço', cura: 'Cura', passiva: 'Passiva' };
  var CAMPO_HAB = { dano: 'dano', danoCritico: 'dano crítico', critico: 'chance de crítico', velocidade: 'velocidade', precisao: 'precisão',
    vidaPct: 'vida máxima', defesaPct: 'defesa', evasao: 'esquiva', danoCriticoMagico: 'dano crítico mágico', recompensa: 'ouro e exp' };
  var NOME_ATR = { for: 'Força', des: 'Destreza', res: 'Resistência', int: 'Inteligência', sor: 'Sorte' };
  // O que a habilidade faz com N pontos (com 0 pontos mostra como fica com 1).
  function efeitoHabilidade(def, pts) {
    var n = def.inicial ? 0 : Math.max(1, pts), T = D.TALENTOS;
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
    return '<div class="carta-hab' + (def.tipo === 'passiva' ? ' passiva' : '') + (total ? '' : ' sem-ponto') + '">'
      + '<div class="hab-topo"><span class="hab-titulo">' + iconeHab(def) + '<strong>' + def.nome + '</strong></span><span class="hab-tipo">' + TIPO_HAB[def.tipo] + '</span></div>'
      + '<p class="hab-efeito">' + efeitoHabilidade(def, total) + '</p>'
      + '<p class="suave pequeno">' + (def.recarga ? 'Recarga: ' + def.recarga + ' turnos' : 'Sempre ligada') + (emGrupo(def) && def.tipo !== 'passiva' ? ' · melhor em grupo' : '')
      + (def.tipo === 'reforco' || def.tipo === 'furtivo' || def.tipo === 'provocar' ? ' · não gasta a vez' : '') + '</p>'
      + (editavel ? '<div class="hab-pontos"><button class="btn-mini" data-acao="hab-menos" data-id="' + def.id + '"' + (pend ? '' : ' disabled') + '>−</button>'
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
            + '<ul>' + sc.habilidades.map(function (x) { return '<li><b>' + x.nome + '</b> <span class="hab-tipo">' + TIPO_HAB[x.tipo] + '</span><br><span class="suave pequeno">' + x.descricao + '</span></li>'; }).join('') + '</ul>'
            + (pode ? '<button class="btn" data-acao="hab-classe" data-valor="' + id + '">Ser ' + (fem && sc.nomeF || sc.nome) + '</button>' : '') + '</div>';
        }).join('') + '</div>';
    } else {
      var livres = R.pontosHabilidadeLivres(p) - totalPendHab(), pd = pendHab();
      h += '<div class="hab-cabeca"><div><h3 class="subtitulo">' + (fem && c.nomeF || c.nome) + '</h3><p class="suave pequeno">' + c.descricao + '</p></div>'
        + '<div class="hab-livres">Pontos livres <b>' + livres + '</b></div></div>'
        + '<p class="suave pequeno">Cada habilidade precisa de pelo menos 1 ponto para ser usada (máximo ' + T.maxPorHabilidade + '). '
        + 'Você ganha +' + T.pontosPorNivel + ' ponto a cada level.</p>'
        + '<div class="grade-hab">' + c.habilidades.map(function (x) { return cartaHabilidade(x, R.pontosDistribuidos(p, x.id), pd[x.id] || 0, true, R.pontosDaArma(p)[x.id] || 0); }).join('') + '</div>'
        + (totalPendHab() ? '<div class="botoes"><button class="btn" data-acao="hab-confirmar">Confirmar pontos</button><button class="btn secundario" data-acao="hab-cancelar">Cancelar</button></div>' : '');
      var ativas = c.habilidades.filter(function (x) { return x.tipo !== 'passiva'; });
      h += '<h3 class="subtitulo">Ordem de uso</h3><p class="suave pequeno">Na luta, a cada vez do herói, ele usa a primeira habilidade pronta desta lista. '
        + 'Se nenhuma estiver pronta, ataca normalmente. <b>Arena · Defesa</b> é a ordem usada quando outro jogador desafia você.</p><p class="suave pequeno">Na Arena não existe crítico: os bônus de crítico viram dano, '
        + 'a Sombra faz o próximo golpe valer o 20 do dado e a esquiva da passiva vira chance de desviar.</p><div class="ordem-hab">'
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

  function linhaRecomeco(p) {
    var preco = D.RECOMECO.precoOuro, falta = preco - (p.ouro || 0);
    return '<div class="item item-com-icone carta-lendaria"><div class="icone-pequeno borda-lendaria icone-recomeco">📜</div>'
      + '<div class="item-texto"><div><span class="raridade-lendaria">' + D.RECOMECO.nome + '</span></div>'
      + '<div class="suave">Devolve todos os pontos de atributo para você distribuir de novo · '
      + preco.toLocaleString('pt-BR') + ' de ouro · você tem ' + (p.recomecos || 0) + '</div></div>'
      + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta.toLocaleString('pt-BR') + ' de ouro</span>' : '')
      + '<button class="btn" data-acao="recomeco-comprar"' + (falta > 0 ? ' disabled' : '') + '>Comprar</button></div></div>';
  }

  function abaMercado() {
    var p = estado.personagem;
    return '<p class="suave">Você tem <strong class="cor-ouro">' + p.ouro.toLocaleString('pt-BR') + ' de ouro</strong> · mochila '
      + R.mochila(p).length + '/' + D.MOCHILA_MAX + '.</p>'
      + '<p class="suave pequeno">Cada compra vem com nível sorteado entre <strong>' + Math.max(1, p.nivel - D.ITEM_NIVEL.variacao) + ' e ' + Math.min(D.ITEM_NIVEL.maximo, p.nivel + D.ITEM_NIVEL.variacao)
      + '</strong> (o seu level ±' + D.ITEM_NIVEL.variacao + ') e qualidade <span class="raridade-comum">Comum</span> ou <span class="raridade-rara">Rara</span>. '
      + 'Itens Épicos e Lendários só caem dos monstros.</p>'
      + '<h3 class="subtitulo">Armas de ' + nomeClasseP(p) + '</h3><div class="itens">'
      + R.armasPermitidas(p).map(function (a) { return linhaMercadoNivel({ tipo: 'arma', classe: D.TIPOS_ARMA[a].classe, arma: a, raridade: 'rara', encanto: 0 }, a); }).join('') + '</div>'
      + (R.maoPermitida(p).length ? '<h3 class="subtitulo">Mão esquerda</h3><div class="itens">' + R.maoPermitida(p).map(function (m) {
        return linhaMercadoNivel({ tipo: 'secundaria', classe: null, mao: m, raridade: 'rara', encanto: 0 }, m);
      }).join('') + '</div>' : '')
      + '<h3 class="subtitulo">Armaduras</h3><p class="suave pequeno">Colar e anel só nas masmorras.</p><div class="itens">'
      + R.TIPOS_ARMADURA.map(function (tipo) { return linhaMercadoNivel({ tipo: tipo, classe: p.classe, raridade: 'rara', encanto: 0 }, ''); }).join('') + '</div>'
      + '<h3 class="subtitulo">Itens especiais</h3><div class="itens">' + linhaRecomeco(p) + linhaRecomecoHab(p) + '</div>'
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
      + trocaPergaminhosHtml(p);
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
    estado.leilaoTimer = setTimeout(function () { if (estado.aba === 'leilao' && estado.personagem) carregarLeilao(); }, 20000);
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
      + '<p class="suave pequeno">O Reino leiloa 12 lotes por vez. Cada lance novo precisa ser pelo menos ' + L.incrementoPct + '% maior. '
      + 'O ouro do lance sai na hora; se alguém cobrir, ele volta para você. Quem tiver o maior lance no fim leva o item. '
      + 'Quando acaba, outro leilão começa com itens novos.</p></div>'
      + '<div class="leilao-tempo fase-' + r.fase.id + '" title="Tempo que falta (o fim exato é secreto: em Muito curto pode acabar a qualquer momento)">'
      + '<small>Tempo</small><strong>' + esc(r.fase.nome) + '</strong></div></div>'
      + '<div class="leilao-barra"><span>Seu ouro: <strong class="cor-ouro">' + ouroTxt(p.ouro) + '</strong></span>'
      + '<button class="btn secundario btn-pequeno" data-acao="leilao-atualizar">Atualizar</button></div>';
    var lotes = '<div class="leilao-lotes">' + r.lotes.map(function (l) {
      var it = l.item, prox = l.proximo;
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
        + '<div><div class="leilao-nome raridade-' + l.raridade + '">' + esc(nomeLote(l)) + '</div>'
        + '<div class="suave pequeno">' + D.raridades[l.raridade].nome + (l.classe ? ' · ' + NOME_CLASSE_LOTE[l.classe] : '')
        + (it.nivel ? ' · nível ' + it.nivel : '') + '</div>'
        + '<div class="suave pequeno">' + esc(resumoLote(l)) + '</div></div></div>'
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
      if (i.encanto >= E.maximo) {
        info = 'Nível máximo';
        acao = '<span class="suave">+' + E.maximo + '</span>';
      } else {
        var chance = R.chanceEncantar(p, i), risco = R.riscoEncantar(i);
        var falha = { nada: 'sem risco', zera: 'se falhar, volta para +0',
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
        + '<div class="suave">' + descricaoItem(i) + ' · ' + info + '</div></div>'
        + '<div class="item-acoes">' + acao + '</div></div>';
    }).join('');
    return aviso + '<p class="suave">Pergaminhos: ' + cont + '. Consiga mais nas caçadas (3º monstro de cada área), nas masmorras e nas missões. Sua Sorte soma +' + fmtDec(R.atributosTotais(p).sor * D.SORTE.encanto) + '% na chance a partir do +4.</p>'
      + '<div class="itens">' + lista + '</div>';
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
    var agora = C.agora(), m = R.garantirMissoes(p, agora), M = D.MISSOES, prontas = R.missoesProntas(p, agora);
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
    var bau = '<div class="missao-carta missao-bau' + (m.bonus ? ' feita' : todas ? ' pronta' : '') + '"><div class="missao-topo"><strong>🎁 Baú do dia</strong></div>'
      + '<div class="missao-texto">Resgate todas as diárias</div><div class="missao-pe"><span class="cor-ouro">' + R.premioTexto(p, M.bonusDiario) + '</span>'
      + (m.bonus ? '<span class="mais">✔</span>' : todas ? '<button class="btn btn-pequeno" data-missao="bau">Abrir</button>' : '') + '</div></div>';
    var dias = Math.floor(R.msAteSemana(agora) / 86400000);
    missoesUI.el.className = 'aberto';
    missoesUI.el.innerHTML = aba + '<div class="missoes-painel" role="dialog" aria-label="Missões"><div class="missoes-titulo"><span>📜 Missões</span>'
      + '<button data-missao="painel" title="Fechar">✕</button></div>'
      + secao('diarias', 'Diárias', 'renova em ' + tempoTexto(R.msAteReset(agora)), M.diarias, bau)
      + secao('semanais', 'Semanais', 'renova em ' + (dias ? dias + 'd ' : '') + tempoTexto(R.msAteSemana(agora) % 86400000), M.semanais) + '</div>';
  }
  function cliqueMissoes(e) {
    var el = e.target.closest('[data-missao]'), p = estado.personagem;
    if (!el || !p) return;
    var acao = el.dataset.missao;
    if (acao === 'painel') missoesUI.aberto = !missoesUI.aberto;
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
    var tentativa = R.encantar(p, id);
    estado.encantoPendente = null;
    if (tentativa) {
      R.registrarMissao(p, 'encantar', 1, C.agora());
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
    var botoes = [['nivel', 'Level'], ['poder', 'Poder']].map(function (t) {
      return '<button class="btn mini-opcao' + (t[0] === tipo ? '' : ' secundario') + '" data-acao="ranking-tipo" data-valor="' + t[0] + '">' + t[1] + '</button>';
    }).join('');
    var meus = (estado.conta.personagens || []).map(function (x) { return x.nome.toLowerCase(); });
    var corpo, eu = estado.personagem, possoAtacar = eu && eu.nivel >= 5;
    if (!r) corpo = '<p class="suave">Carregando…</p>';
    else if (r.erro) corpo = '<p class="menos">' + esc(r.erro) + '</p>';
    else if (!r.lista.length) corpo = '<p class="suave">Ninguém no ranking ainda.</p>';
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
      + '<p class="suave pequeno">Os 100 melhores de ' + D.NOME_JOGO + (tipo === 'nivel' ? ' por level (empate: quem tem mais exp).' : ' por poder, a força calculada pelos status e equipamentos.')
      + ' Seus personagens aparecem destacados. Contas de administrador não entram.'
      + (possoAtacar ? ' Em "Atacar" você luta com qualquer um da Arena (level 5+): gasta 1 entrada e não muda a posição.' : '') + '</p>' + corpo;
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
      + '<div class="suave">' + nomeRaca(x.raca, x.sexo) + ' · ' + nomeClasseX(x)
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
      + grupo('Pedidos de senha', 'Jogadores que clicaram em "Esqueci a senha" com usuário e e-mail certos. Gere a senha temporária e mande para o e-mail do cadastro.',
        '<button class="btn" data-acao="senha-pedidos">' + (estado.adminSenhas ? 'Atualizar pedidos' : 'Ver pedidos') + '</button>')
      + '</div>' + adminSenhasHtml() + '<div class="itens">'
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
      return '<div class="resultado' + (m.chefe ? ' vitoria-chefe' : '') + '"><h2>' + (m.chefe ? 'CHEFE DERROTADO!' : 'Vitória!') + '</h2><p>Você derrotou ' + m.nome + ' e ganhou <strong>' + r.exp + ' de exp</strong> e <strong class="cor-ouro">' + r.ouro + ' de ouro</strong>' + (r.fatorExp < 100 ? ' <span class="suave">(reduzidos e sem drops: área abaixo do seu nível)</span>' : '') + '.</p>'
        + (r.niveis ? '<p class="destaque">Subiu para o level ' + estado.personagem.nivel + '! +' + r.niveis * D.PONTOS_POR_NIVEL + ' pontos de atributo.</p>' : '')
        + (r.habilidadeEvoluiu ? '<p class="habilidade-usada">⚡ Sua habilidade evoluiu para o nível ' + r.habilidadeEvoluiu + '!</p>' : '')
        + (r.drop ? '<p>Drop: <strong class="raridade-' + corItem(r.drop) + '">' + R.nomeItem(r.drop) + ' (' + nomeRaridadeItem(r.drop) + ')</strong></p>' : '')
        + (r.dropArmadura ? '<p>Drop: <strong class="raridade-' + corItem(r.dropArmadura) + '">' + R.nomeItem(r.dropArmadura) + ' (' + nomeRaridadeItem(r.dropArmadura) + ')</strong></p>' : '')
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
      + '<div class="lutador" id="lutador-jogador"><div class="moldura">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</div><h3>' + esc(p.nome) + '</h3>'
      + '<div id="hp-jogador">' + barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax, 'jogador') + '</div>'
      + (D.HABILIDADES_ATIVAS ? '<div id="poder-jogador">' + barraPoder(b) + '</div>' : '')
      + '<div class="suave">Velocidade ' + b.jogador.vel + '</div>'
      + (em ? '<div id="controle-habilidade">' + controleHabilidade(b) + '</div>' : '') + '</div>'
      + '<div class="vs">VS</div>'
      + '<div class="lutador" id="lutador-monstro"><div class="moldura">' + F.imagemMonstro(b.monstroId) + '</div><h3>' + b.monstro.nome + '</h3>'
      + '<div id="hp-monstro">' + barra('hp', b.monstro.hp, b.monstro.hpMax, b.monstro.hp + ' / ' + b.monstro.hpMax, 'monstro') + '</div>'
      + '<div class="suave">Velocidade ' + b.monstro.vel + '</div></div></div>'
      + '<div class="registro" id="registro">' + estado.registro.join('') + '</div>'
      + (em ? '<div class="botoes"><button class="btn secundario" data-acao="velocidade">' + (estado.rapido ? 'Velocidade normal' : 'Acelerar 2x') + '</button>'
        + '<button class="btn perigo" data-acao="fugir">Fugir</button></div>' : '');
  }

  function telaJogo() {
    var painel;
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
      painel = navHtml()
        + (({ personagem: abaPersonagem, habilidades: abaHabilidades, cacar: abaCacar, mercado: abaMercado, leilao: abaLeilao, encantar: abaEncantar, ranking: abaRanking, social: abaSocial, masmorra: abaMasmorra, arena: abaArena, admin: abaAdmin, alianca: abaAlianca })[estado.aba] || abaCacar)();
    }
    var livre = !(estado.batalha || estado.luta || estado.lutaArena || (estado.cacada && estado.cacada.ativa));
    var trocar = !livre ? '' : (ehAdmin() ? '<button class="btn-icone' + (estado.aba === 'admin' ? ' ativa' : '') + '" data-acao="aba" data-aba="admin" title="Admin" aria-label="Admin">' + ICONES.admin + '</button>' : '')
      + '<button class="btn secundario" data-acao="voltar-personagens">Trocar personagem</button>';
    mostrarCenario(false);
    atualizarMusica();
    app.innerHTML = topo(trocar) + recursosHtml() + '<div class="conteudo"><div class="jogo">' + fichaHtml()
      + '<section class="caixa">' + painel + '</section></div></div>' + rodape()
      + (estado.zoom && estado.aba === 'personagem' && !estado.batalha && !estado.luta ? zoomHtml() : '')
      + (estado.desafio && (estado.aba === 'arena' || estado.aba === 'ranking') && !estado.lutaArena ? desafioHtml() : '');
    if (estado.lutaArena) atualizarJanelaDado();
    var reg = document.getElementById('registro');
    if (reg) reg.scrollTop = reg.scrollHeight;
    chatVisivel(true);
    desenharMissoes(true);
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
    estado.timer = setTimeout(turno, estado.rapido ? 275 : 550);
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
    if (estado.cacada && R.precisaPocao(b, prefsCacada().pocao)) R.beberPocao(b);
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
        if (ev.atordoou) linha('destaque', nomeM + (ev.congelou ? ' está congelado!' : ' está atordoado!'));
        if (ev.quebrouArmadura) linha('destaque', 'A armadura de ' + nomeM + ' rachou! Ele recebe +25% de dano.');
        golpe('lutador-monstro', true);
      }
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
    var primeiraVez = !(estado.personagem.abates[b.monstroId] || 0);
    var res = R.concluirBatalha(estado.personagem, b, C.agora(), bonusAlianca());
    if (res.resultado === 'vitoria') {
      R.registrarMissao(estado.personagem, 'abate', 1, C.agora());
      if (D.monstros[b.monstroId].chefe) R.registrarMissao(estado.personagem, 'chefe', 1, C.agora());
    }
    if (estado.cacada) {
      if (res.resultado === 'vitoria') linha('destaque', 'Vitória! +' + res.exp + ' de exp e +' + res.ouro + ' de ouro.');
      else if (res.resultado === 'derrota') linha('dano-recebido', esc(estado.personagem.nome) + ' caiu em batalha.');
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
      [res.drop, res.dropArmadura].forEach(function (it) { if (it) avisar('Item novo: ' + R.nomeItem(it), 'item'); });
      if (res.pergaminho) avisar('Pergaminho ' + ITEM_RARIDADE[res.pergaminho] + '!', 'item');
    } else if (res.resultado === 'derrota') avisar('Derrota…', 'ruim');
  }

  // ---------------- Caçada contínua ----------------
  // Ciclo: procurando → encontrou (Lutar/Fugir; luta sozinho em 3 s, chefe sempre pergunta) → luta (o mesmo combate
  // de sempre) → resultado entra no resumo → procura de novo. Para com a vida em ≤5% ou quando o jogador para.
  function prefsCacada() {
    var p = estado.personagem;
    return p.prefsCacada || (p.prefsCacada = { lutarSempre: false, pocao: 0, chefe: 'perguntar' });
  }
  function iniciarCacada(areaId) {
    var p = estado.personagem, area = D.areas.find(function (a) { return a.id === areaId; });
    var alvos = area ? selecaoArea(area).slice() : [];
    if (!alvos.length) { avisar('Escolha pelo menos um monstro.'); return; }
    if (R.atualizarTempo(p, C.agora())) salvar();
    if (p.acampado) { avisar('Você está acampado. Levante acampamento para caçar.'); return; }
    if (!R.vidaParaCacar(p)) { avisar('Vida baixa demais: é preciso ter mais de ' + D.CACADA.vidaMinima + '% da vida para caçar.'); return; }
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
    if (!R.vidaParaCacar(p)) { pararCacada('Vida baixa: a caçada parou. Espere a vida voltar, acampe ou use uma poção.'); return; }
    c.fase = 'buscando';
    c.encontro = null;
    c.prazo = null;
    // O monstro é sorteado já no começo: o mais forte demora mais para ser achado.
    c.proximo = R.escolherMonstroCacada(p, c.alvos);
    if (!c.proximo) { pararCacada('Nenhum dos monstros escolhidos pode ser caçado agora.'); return; }
    c.busca = Math.round(R.tempoBusca(p, c.proximo) / (estado.rapido ? 2 : 1));
    telaJogo();
    clearTimeout(c.timer);
    c.timer = setTimeout(encontrarMonstro, c.busca);
  }
  function encontrarMonstro() {
    var c = estado.cacada, p = estado.personagem;
    if (!c || !c.ativa) return;
    var id = c.proximo && R.podeCacar(p, c.proximo) ? c.proximo : R.escolherMonstroCacada(p, c.alvos);
    if (!id) { pararCacada('Nenhum dos monstros escolhidos pode ser caçado agora.'); return; }
    var chefe = R.sortearChefe(p, id);
    c.encontro = { monstro: chefe || id, normal: id, chefe: !!chefe };
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
    if (c.encontro.chefe && R.evitarChefe(estado.personagem, c.encontro.monstro)) salvar();   // evitou o chefe: a chance zera
    c.historico.unshift({ monstro: c.encontro.monstro, resultado: 'evitou' });
    c.historico = c.historico.slice(0, D.CACADA.historico);
    procurarMonstro();
  }
  function pararCacada(motivo) {
    var c = estado.cacada;
    if (!c) return;
    c.ativa = false;
    clearTimeout(c.timer);
    c.prazo = null;
    c.motivo = motivo || 'Você parou a caçada.';
    if (estado.batalha) { encerrar(); return; }        // parar no meio da luta = fugir dela
    if (c.fase === 'encontrou' && c.encontro && c.encontro.chefe && R.evitarChefe(estado.personagem, c.encontro.monstro)) salvar();   // parou com o chefe na frente
    c.fase = 'parada';
    clearInterval(c.relogio);
    telaJogo();
  }
  // Nome de um drop da caçada: equipável ou consumível (pergaminho, com a quantidade).
  function nomeDrop(it) {
    if (!it.consumivel) return R.nomeItem(it);
    return (it.qtd > 1 ? it.qtd + 'x ' : '') + R.nomeConsumivel(it);
  }
  // Chamado pelo encerrar(): soma no resumo e segue para o próximo monstro (ou para).
  function fimLutaCacada(res, b, primeiraVez) {
    var c = estado.cacada, p = estado.personagem;
    var itens = [res.drop, res.dropArmadura].filter(Boolean);
    // Pergaminho também é item: entra na lista de drops junto com os equipáveis (chefe pode dar vários de uma vez).
    if (res.pergaminho) itens.push({ tipo: 'pergaminho', classe: null, raridade: res.pergaminho, encanto: 0, qtd: res.qtdPergaminhos || 1, consumivel: true });
    if (res.resultado === 'vitoria') { c.mortos++; c.exp += res.exp; c.ouro += res.ouro; c.itens = itens.concat(c.itens).slice(0, 30); }
    c.historico.unshift({ monstro: b.monstroId, resultado: res.resultado, exp: res.exp, ouro: res.ouro, itens: itens.map(nomeDrop) });
    c.historico = c.historico.slice(0, D.CACADA.historico);
    estado.ultimaBatalha = b;
    estado.batalha = null;
    salvar();
    if (res.niveis) avisar('Level up! Level ' + p.nivel, 'nivel');
    var proximo = res.resultado === 'vitoria' && primeiraVez && Object.keys(D.monstros).filter(function (k) { return R.monstroAnterior(k) === b.monstroId; })[0];
    if (proximo) avisar('Nova caçada liberada: ' + D.monstros[proximo].nome + '!', 'nivel');
    itens.forEach(function (it) { if (!it.consumivel) avisar('Item novo: ' + R.nomeItem(it), 'item'); });   // pergaminho tem aviso próprio
    if (res.resultado === 'derrota') { pararCacada(esc(p.nome) + ' caiu em batalha' + (res.expPerdida ? ' e perdeu ' + res.expPerdida + ' de exp' : '') + '. A caçada parou.'); return; }
    if (!c.ativa) { c.fase = 'parada'; clearInterval(c.relogio); telaJogo(); return; }
    c.fase = 'pausa';
    telaJogo();
    clearTimeout(c.timer);
    c.timer = setTimeout(procurarMonstro, estado.rapido ? 450 : 900);
  }
  function fecharCacada() {
    pararTimersCacada();
    estado.cacada = null;
    estado.ultimaBatalha = null;
    telaJogo();
  }

  function cacadaHtml() {
    var c = estado.cacada, p = estado.personagem, b = estado.batalha, s = R.status(p), pref = prefsCacada();
    var area = D.areas.find(function (a) { return a.id === c.area; }), e = estiloArea(area, D.areas.indexOf(area));
    var emLuta = c.fase === 'lutando' && b;
    var hpJ = emLuta ? b.jogador.hp : p.hpAtual, hpMaxJ = emLuta ? b.jogador.hpMax : s.hpMax;
    var jogador = '<div class="lutador" id="lutador-jogador"><div class="moldura">' + F.personagem(p.raca, classeRetrato(p), p.sexo) + '</div><h3>' + esc(p.nome) + '</h3>'
      + '<div id="hp-jogador">' + barra('hp', hpJ, hpMaxJ, hpJ + ' / ' + hpMaxJ, 'jogador') + '</div>'
      + (emLuta ? '<div id="controle-habilidade">' + controleHabilidade(b) + '</div>' : '') + '</div>';
    var direita;
    if (c.fase === 'buscando' || c.fase === 'pausa') {
      direita = '<div class="cacada-busca"><div class="busca-icone">🔎</div><div class="busca-txt">' + (c.fase === 'pausa' ? 'Recuperando o fôlego…' : 'Caçada em andamento…') + '</div>'
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
      direita = '<div class="lutador" id="lutador-monstro"><div class="moldura">' + F.imagemMonstro(b.monstroId) + '</div><h3>' + b.monstro.nome + '</h3>'
        + '<div id="hp-monstro">' + barra('hp', b.monstro.hp, b.monstro.hpMax, b.monstro.hp + ' / ' + b.monstro.hpMax, 'monstro') + '</div></div>';
    } else {
      direita = '<div class="cacada-busca parada"><div class="busca-icone">⛺</div><div class="busca-txt">Caçada encerrada</div><p class="suave">' + c.motivo + '</p>'
        + '<div class="botoes"><button class="btn" data-acao="cacada-continuar"' + (R.vidaParaCacar(p) ? '' : ' disabled') + '>Continuar caçada</button>'
        + '<button class="btn secundario" data-acao="cacada-fechar">Voltar à região</button></div>'
        + (R.vidaParaCacar(p) ? '' : '<p class="suave pequeno">Precisa de mais de ' + D.CACADA.vidaMinima + '% da vida. Use uma poção ou acampe.</p>') + '</div>';
    }
    var ativa = c.ativa;
    var topo = '<div class="cacada-topo" style="--cor:' + e.cor + '"><div><h3>' + iconeArea(area) + ' Caçada · ' + area.nome + '</h3>'
      + '<span class="suave pequeno">' + c.alvos.map(function (id) { return D.monstros[id].nome; }).join(', ') + '</span></div>'
      + '<div class="botoes">' + (ativa ? '<button class="btn secundario btn-pequeno" data-acao="velocidade">' + (estado.rapido ? 'Velocidade 2x' : 'Velocidade normal') + '</button>'
        + '<button class="btn perigo btn-pequeno" data-acao="cacada-parar">■ Parar caçada</button>' : '') + '</div></div>';
    var opcoes = '<div class="cacada-opcoes"><label><input type="checkbox" data-acao="cacada-sempre"' + (pref.lutarSempre ? ' checked' : '') + '> Lutar sempre sem perguntar</label>'
      + '<label>Chefes <select id="cacada-chefe">' + [['perguntar', 'sempre perguntar'], ['fugir', 'sempre fugir'], ['lutar', 'sempre lutar']].map(function (o) {
        return '<option value="' + o[0] + '"' + ((pref.chefe || 'perguntar') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>'
      + '<label>Poção automática <select id="cacada-pocao"><option value="0"' + (pref.pocao ? '' : ' selected') + '>desligada</option>'
      + D.CACADA.pocaoAuto.map(function (v) { return '<option value="' + v + '"' + (pref.pocao === v ? ' selected' : '') + '>abaixo de ' + v + '% da vida</option>'; }).join('')
      + '</select></label></div>';
    var resumo = '<div class="cacada-resumo">'
      + [['⚔', 'Derrotados', c.mortos], ['✦', 'Exp', c.exp.toLocaleString('pt-BR')], ['◎', 'Ouro', c.ouro.toLocaleString('pt-BR')], ['🎒', 'Itens', c.itens.reduce(function (t, it) { return t + (it.qtd || 1); }, 0)],
        ['⏱', 'Tempo', '<span id="cacada-tempo">' + duracaoTexto(Date.now() - c.inicio) + '</span>']].map(function (x) {
        return '<div class="cacada-num"><small>' + x[0] + ' ' + x[1] + '</small><strong>' + x[2] + '</strong></div>';
      }).join('') + '</div>';
    var itens = c.itens.length ? '<div class="cacada-itens">' + c.itens.map(function (it) {
      return '<div class="icone-pequeno borda-' + (it.consumivel ? it.raridade : corItem(it)) + '" title="' + esc(nomeDrop(it)) + '">' + F.icone(it)
        + (it.consumivel && it.qtd > 1 ? '<span class="qtd-consumivel">' + it.qtd + '</span>' : '') + '</div>';
    }).join('') + '</div>' : '';
    var historico = '<div class="cacada-historico"><h4>Últimos combates</h4>' + (c.historico.length ? c.historico.map(function (h) {
      var nome = D.monstros[h.monstro].nome;
      if (h.resultado === 'vitoria') return '<p class="mais">✔ ' + nome + ' <span class="suave">+' + h.exp + ' exp · +' + h.ouro + ' ouro'
        + (h.itens.length ? ' · ' + esc(h.itens.join(', ')) : '') + '</span></p>';
      if (h.resultado === 'derrota') return '<p class="menos">✖ ' + nome + ' <span class="suave">derrota</span></p>';
      return '<p class="suave">↷ ' + nome + ' <span>' + (h.resultado === 'evitou' ? 'evitado' : 'fugiu') + '</span></p>';
    }).join('') : '<p class="suave pequeno">Nenhum combate ainda.</p>') + '</div>';
    var fundo = ESTILO_AREA[area.id] ? ' style="background-image:radial-gradient(ellipse at center, rgba(8,10,14,.25), rgba(8,10,14,.8)),url(assets/regioes/fundo-' + area.id + '.webp)"' : '';
    return topo + '<div class="arena cacada-arena"' + fundo + '>' + jogador + '<div class="vs">' + (emLuta ? 'VS' : '') + '</div>' + direita + '</div>'
      + (emLuta || estado.registro.length ? '<div class="registro" id="registro">' + estado.registro.join('') + '</div>' : '')
      + opcoes + resumo + itens + historico;
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
    if (e.target.id === 'cacada-pocao') { prefsCacada().pocao = Number(e.target.value) || 0; salvar(); }
    if (e.target.id === 'cacada-chefe') {
      prefsCacada().chefe = e.target.value; salvar();
      var cc = estado.cacada;   // chefe esperando resposta agora: já aplica a escolha
      if (cc && cc.fase === 'encontrou' && cc.encontro.chefe) { if (e.target.value === 'lutar') lutarCacada(); else if (e.target.value === 'fugir') fugirEncontro(); }
    }
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
      case 'trocar-senha': telaTrocarSenha(false); break;
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
      case 'sair':
        clearTimeout(estado.timer);
        encerrarAtividade();
        C.sair();
        estado = Object.assign(estado, { conta: null, personagem: null, batalha: null, resultado: null });
        telaAuth('entrar');
        break;
      case 'voltar-personagens':
        encerrarAtividade();
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
      case 'leilao-atualizar': estado.leilao = null; carregarLeilao(); telaJogo(); break;
      case 'leilao-ver': estado.leilaoVer = el.dataset.id; telaJogo(); break;
      case 'leilao-fechar':
        if (e && e.target && e.target.closest('.zoom-janela') && !e.target.closest('[data-acao="leilao-fechar"].btn')) break;
        estado.leilaoVer = null; telaJogo(); break;
      case 'mochila-aba':
        estado.mochilaAba = el.dataset.valor === 'consumiveis' ? 'consumiveis' : 'equipamentos';
        estado.vendaLote = null;
        telaJogo();
        break;
      case 'consumivel':
        estado.consumivelFoco = el.dataset.id;
        estado.itemFoco = null;
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
        if (!R.monstroLiberado(p, alvo)) { avisar('Derrote ' + D.monstros[R.monstroAnterior(alvo)].nome + ' primeiro.'); break; }
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
        estado.area = estado.areaAberta = el.dataset.valor;
        telaJogo();
        mostrarPainel();
        break;
      case 'fugir': encerrar(); break;
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
      if (!R.equipar(p, id)) avisar(R.motivoNaoEquipa(p, it) || 'Não foi possível equipar (mochila cheia?).');
    }
    salvar();
    telaJogo();
  });
  // Ao esconder a aba ou fechar o jogo, guarda o tempo de atividade contado até agora.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'hidden' || !estado.personagem || !atividade.relogio) return;
    tiqueAtividade();
    atividade.desdeSalvar = 0;
    salvar();
  });
  // Dentro do jogo o botão direito não abre o menu do navegador: a única função dele é equipar um item da mochila.
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
    estado.zoom = null;
    estado.vendaPendente = null;
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

  // Prêmios da masmorra: joias entram na mochila (se couber); pergaminhos vão para os Consumíveis.
  async function resgatarRecompensas(lista) {
    var p = estado.personagem, g = estado.gm;
    lista = lista || (g && g.recompensas);
    if (!p || !lista || !lista.length || estado.resgatando) return;
    estado.resgatando = true;
    try {
      var avisouCheia = false;
      for (var i = 0; i < lista.length; i++) {
        var rec = lista[i];
        // Lote ganho no leilão: o item é gerado da semente (igual ao que todos viram no leilão).
        if (rec.item && rec.item.leilao) {
          var ganho = R.itemDoLote(rec.item);
          if (ganho.consumivel) {
            await C.grupo.resgatar(p.id, rec.id);
            R.mudarPergaminho(p, ganho.raridade, ganho.qtd);
            salvar();
            avisar('Você venceu o leilão: ' + nomeDrop(ganho) + '! (Mochila › Consumíveis)', 'item');
            continue;
          }
          if (R.mochilaCheia(p)) {
            if (!avisouCheia) avisar('Mochila cheia! Seu item do leilão está guardado: libere espaço para recebê-lo.');
            avisouCheia = true;
            continue;
          }
          await C.grupo.resgatar(p.id, rec.id);
          p.inventario.push(ganho);
          salvar();
          avisar('Você venceu o leilão: ' + R.nomeItem(ganho) + ' (' + nomeRaridadeItem(ganho) + ')!', 'item');
          continue;
        }
        // Pergaminho de encantamento: não ocupa a mochila.
        if (rec.item && rec.item.tipo === 'pergaminho') {
          var perg = await C.grupo.resgatar(p.id, rec.id);
          if (!D.raridades[perg.raridade]) continue;
          R.mudarPergaminho(p, perg.raridade, 1);
          salvar();
          avisar('Você ganhou um Pergaminho para item ' + ITEM_RARIDADE[perg.raridade] + ' na masmorra!', 'item');
          continue;
        }
        if (R.mochilaCheia(p)) {
          if (!avisouCheia) avisar('Mochila cheia! Sua joia da masmorra está guardada: libere espaço para recebê-la.');
          avisouCheia = true;
          continue;
        }
        var item = R.completarItem(p, await C.grupo.resgatar(p.id, rec.id));
        p.inventario.push(item);
        salvar();
        avisar('Você ganhou ' + R.nomeItem(item) + ' (' + nomeRaridadeItem(item) + ')!');
      }
    } catch (e) { avisar(e.message); }
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
    // Missão: cada masmorra vencida conta uma vez por personagem.
    var mis = R.garantirMissoes(estado.personagem, C.agora());
    if (sim.vitoria && mis.runs.indexOf(run.id) < 0) {
      mis.runs = mis.runs.concat(run.id).slice(-20);
      R.registrarMissao(estado.personagem, 'masmorra', 1, C.agora());
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
      atualizarMusica();
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
        L.registro.push('<p class="' + (ev.critico ? 'critico' : '') + '">' + (ev.critico ? 'CRÍTICO! ' : '') + esc(h.nome) + ' acerta ' + esc(m.nome) + ': <strong>' + ev.dano + '</strong>.</p>');
        if (ev.caiu) L.registro.push('<p class="destaque">' + esc(m.nome) + ' caiu!</p>');
        else if (ev.atordoou) L.registro.push('<p class="destaque">' + esc(m.nome) + (ev.congelou ? ' está congelado!' : ' está atordoado!') + '</p>');
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
    if (L.fim) {
      fim = L.sim.vitoria
        ? '<div class="resultado vitoria-chefe"><h2>VITÓRIA!</h2><p>O grupo venceu ' + esc(L.mm.nome) + '. Cada um ganhou um colar ou anel (vai para a mochila) e tem ' + D.MASMORRA.pergaminho + '% de chance de ganhar um pergaminho de encantamento.</p>'
        : '<div class="resultado derrota"><h2>Derrota</h2><p>O grupo caiu na ' + NOMES_SALA[L.sim.sala].toLowerCase() + '. Ninguém perdeu nada e a entrada não foi gasta.</p>';
      fim += '<div class="botoes"><button class="btn" data-acao="luta-fechar">Voltar</button></div></div>';
    }
    return fim + '<h3 class="subtitulo">' + esc(L.mm.nome) + ' · ' + NOMES_SALA[L.sala] + '</h3>'
      + '<div class="mas-arena"><div class="mas-grupo">' + herois + '</div><div class="vs">VS</div><div class="mas-grupo">' + monstros + '</div></div>'
      + '<div class="registro" id="registro">' + L.registro.join('') + '</div>'
      + (L.fim ? '' : '<div class="botoes"><button class="btn secundario" data-acao="luta-velocidade">' + (L.rapido ? 'Velocidade normal' : 'Acelerar ×4') + '</button></div>');
  }

  function abaMasmorra() {
    var g = estado.gm, p = estado.personagem;
    if (!g) { carregarGrupo(); return '<p class="suave">' + (estado.gmErro ? esc(estado.gmErro) : 'Carregando…') + '</p>'; }
    if (g.local) return '<p class="suave">As masmorras são em grupo de 3 e precisam do servidor: jogue pelo site do ' + D.NOME_JOGO + ' para entrar com seus amigos.</p>';
    var M = D.MASMORRA, restam = M.entradasPorDia - g.entradas;
    var html = '<p class="suave">Grupo de 3, luta automática. A vida da masmorra é separada: morrer lá não tira vida nem exp. '
      + 'Vitória: cada um ganha um <strong>colar ou anel</strong>, a única forma de conseguir joias, e tem ' + M.pergaminho
      + '% de chance de ganhar um <strong>pergaminho de encantamento</strong>. Derrota não gasta entrada.</p>'
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

  function listaMasmorras(escolhida, souLider) {
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
  // tipo: 'escada' (lista da Arena; o servidor decide se é para cima ou Top 5 para baixo) ou 'livre' (pelo Ranking).
  function abrirDesafio(id, tipo) {
    var p = estado.personagem;
    estado.desafio = { id: id, perfil: null, erro: null, tipo: tipo || 'escada' };
    if (!estado.arena) carregarArena();   // entradas e a minha posição (para mostrar a recompensa)
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
        + recompensaDesafioHtml(pf, d.tipo, ouro, saque);
    }
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
      + '<p class="suave pequeno">Derrote o Top 1 para levar o jackpot. Ele cresce a cada 10 minutos com o mesmo Top 1 e é entregue ao Top 1 às 00:00. '
      + 'Na Arena só o D20 decide: 1 erra, 18 a 20 são críticos.</p>';
    html += '<h3 class="subtitulo">Top 5 · ' + esc(nomeArena(ar.arena)) + '</h3><div class="itens">'
      + (ar.top5.length ? ar.top5.map(function (x) { return linhaRanking(x); }).join('') : '<p class="suave">Ninguém nesta arena ainda.</p>') + '</div>';
    if (ar.arena === ar.minha_arena && ar.posicao) {
      var semEntrada = e.valor <= 0;
      html += '<h3 class="subtitulo">Sua posição: #' + ar.posicao + ' de ' + ar.total + '</h3><p class="suave pequeno">Você pode desafiar os 5 logo acima de você. Vencendo, toma a posição dele e saqueia parte do ouro.'
        + (ar.posicao < 5 ? ' No Top 5 você também ataca os de baixo até o 5º lugar: não muda a posição, vale o saque e metade da reputação.' : '')
        + ' Pelo Ranking (Social) dá para atacar jogadores de qualquer arena.</p><div class="itens">'
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
      + esc(atk.nome) + (ev.auto ? ' (tempo esgotado)' : '') + ': ' + efeitoDado(ev.dado) + (ev.garantido ? ' (Sombra: vale o 20!)' : '') + (ev.dano ? ' — ' + esc(alvo.nome) + ' perde <strong>' + ev.dano + '</strong>' : '') + '.</p>');
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
    if (st.local) return '<p class="suave">As alianças juntam vários jogadores e precisam do servidor: jogue pelo site do ' + D.NOME_JOGO + '.</p>';
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
          return '<div class="item"><div><strong>' + esc(x.nome) + '</strong><div class="suave pequeno">' + nomeClasseX(x) + ' · Lv ' + x.nivel
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
        + '<div class="suave pequeno">' + ({ lider: 'Líder', oficial: 'Oficial', membro: 'Membro' })[x.cargo] + ' · ' + nomeClasseX(x)
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
    var classe = nomeClasseX(m);
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

  // ---------------- Instalar o jogo na tela inicial (app) ----------------
  // Android/Chrome: o navegador avisa que dá para instalar (beforeinstallprompt) e o botão abre a janela de instalar.
  // iPhone: não existe essa janela; o botão explica o caminho pelo Safari. Já instalado: o botão some.
  var instalacao = { evento: null };
  function jaInstalado() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function ehIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function ehCelular() { return ehIOS() || /android|mobi/i.test(navigator.userAgent); }
  // No celular aparece sempre (se ainda não instalou); no computador, só quando o navegador deixa instalar.
  function podeInstalar() { return !jaInstalado() && (!!instalacao.evento || ehCelular()); }
  function botaoInstalar() {
    return '<button class="btn largo btn-instalar" data-acao="instalar-app"' + (podeInstalar() ? '' : ' hidden') + '>📲 Instalar para celular</button>';
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
  // Some com um áudio aos poucos (~1,2 s) e pausa.
  function sumir(audio) {
    if (!audio) return;
    var t = setInterval(function () {
      var v = audio.volume - 0.04;
      if (v <= 0.01 || audio.paused) { clearInterval(t); audio.pause(); } else audio.volume = v;
    }, 50);
  }
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
  function alternarPainel(fechar) {
    if (musica.painel || fechar) {
      if (musica.painel) { musica.painel.remove(); musica.painel = null; }
      return;
    }
    var p = musica.painel = document.createElement('div');
    p.id = 'config-painel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Configurações');
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
      if (musica.ligada) tocarMusica(); else if (musica.atual) musica.atual.audio.pause();
      desenharBotaoMusica();
    });
    p.querySelector('#config-volume').addEventListener('input', function (e) {
      musica.volume = parseInt(e.target.value, 10);
      p.querySelector('#config-vol-txt').textContent = musica.volume + '%';
      if (musica.atual) musica.atual.audio.volume = volumeAlvo();
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
    if (musica.painel && !e.target.closest('#config-painel') && !e.target.closest('#botao-musica')) alternarPainel(true);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && musica.painel) alternarPainel(true); });
  // Eventos que o navegador aceita como "o jogador interagiu" (no celular o toque conta no fim: touchend/click).
  var TOQUES = ['click', 'touchend', 'keydown'];
  function primeiroToque(e) {
    if (e && e.target && e.target.closest && e.target.closest('#botao-musica')) return;   // o próprio botão cuida
    if (musica.atual && !musica.atual.audio.paused) return;
    tocarMusica();
  }
  TOQUES.forEach(function (ev) { document.addEventListener(ev, primeiroToque, true); });
  desenharBotaoMusica();

  // ---------------- Início ----------------
  app.innerHTML = '<p class="carregando">Conectando ao servidor…</p>';
  C.iniciar().then(function (conta) {
    estado.conta = conta;
    if (conta) depoisDeEntrar(); else telaAuth('entrar');
  });
})();
