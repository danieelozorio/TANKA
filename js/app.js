// Tanka — interface: telas de login, personagens, criação e jogo.
(function () {
  var D = Tanka.dados, R = Tanka.regras, C = Tanka.contas, F = Tanka.retratos;
  var app = document.getElementById('app');
  var aviso = document.getElementById('aviso');

  var estado = {
    conta: null,
    personagem: null,
    aba: 'cacar',
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

  var timerAviso;
  function avisar(msg) {
    aviso.textContent = msg;
    aviso.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(function () { aviso.hidden = true; }, 3200);
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
  function barra(classe, atual, max, texto) {
    var pct = max > 0 ? Math.min(100, (atual / max) * 100) : 0;
    return '<div class="barra ' + classe + '"><i style="width:' + pct + '%"></i><b>' + texto + '</b></div>';
  }
  function fmt(n) { return Number.isInteger(n) ? n : n.toFixed(1); }
  function dano(d) { return d[0] === d[1] ? d[0] : d[0] + '–' + d[1]; }

  // Faixa de brilho do encantamento: +4 a +6 azul, +7 a +9 roxo, +10 dourado.
  function brilho(item) {
    var e = item.encanto || 0;
    return e >= 10 ? 'dourado' : e >= 7 ? 'roxo' : e >= 4 ? 'azul' : '';
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
    if (item.tipo === 'arma') return 'Dano ' + dano(R.danoArma(item));
    var b = R.bonusItem(item);
    return Object.keys(b).map(function (k) { return D.bonus[k] + ' +' + b[k]; }).join(' · ');
  }

  // Quadradinho com ícone, borda da raridade, brilho do encantamento e "+N".
  function quadroItem(item, classe, atributos) {
    var b = brilho(item);
    return '<button class="' + classe + ' borda-' + item.raridade + (b ? ' aura-' + b : '')
      + (estado.itemFoco === item.id ? ' focado' : '') + '" data-acao="item" data-id="' + item.id + '"'
      + ' title="' + esc(R.nomeItem(item)) + '"' + (atributos || '') + '>'
      + F.icone(item) + (item.encanto ? '<span class="nivel-encanto">+' + item.encanto + '</span>' : '') + '</button>';
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
      return '<div class="carta"><div class="moldura">' + F.personagem(p.raca, p.classe, p.sexo) + '</div>'
        + '<div class="nome">' + esc(p.nome) + '</div>'
        + '<div class="detalhe">' + D.racas[p.raca].nome + ' · ' + D.classes[p.classe].nome + ' · Lv ' + p.nivel + '</div>'
        + '<button class="btn largo" data-acao="jogar" data-id="' + p.id + '">Jogar</button></div>';
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
      + '<p class="suave" style="margin-top:.8em">Começa no level 1 com ' + D.HP_INICIAL + ' HP e ' + D.armas[c.classe].comum + ' (dano 1–1).</p>'
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
    if (R.atualizarTempo(estado.personagem, C.agora())) salvar();
    telaJogo();
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
    var podeUsar = !emBatalha && p.pocoes > 0 && p.hpAtual < s.hpMax;
    return '<div class="suave pequeno vida-tempo">' + texto + '</div>' + acampar
      + '<div class="secao pocoes"><span>🧪 Poções: <strong id="ficha-pocoes">' + (emBatalha ? estado.batalha.pocoes : p.pocoes) + '/' + D.VIDA.pocoesPorDia + '</strong></span>'
      + '<button class="btn mini-opcao" data-acao="usar-pocao"' + (podeUsar ? '' : ' disabled') + '>Usar</button></div>'
      + '<div class="suave pequeno">Próximo reset em ' + tempoTexto(R.msAteReset(C.agora())) + ' (vida cheia e 2 poções)</div>';
  }

  function fichaHtml() {
    var p = estado.personagem, s = R.status(p);
    var precisa = R.expNecessaria(p.nivel);
    var arma = R.armaEquipada(p);
    var emBatalha = !!estado.batalha;
    var eq = R.bonusEquipamentos(p);
    var atrs = R.ATRIBUTOS.map(function (k) {
      var botao = p.pontosLivres > 0 && !emBatalha
        ? '<button class="btn mini" data-acao="ponto" data-atributo="' + k + '" title="Aumentar ' + D.atributos[k].nome + '">+</button>'
        : '<span></span>';
      return '<div class="linha-atr" title="' + esc(D.atributos[k].efeito) + '"><span>' + D.atributos[k].nome + '</span>'
        + '<span class="valor">' + (p.atributos[k] + eq[k]) + (eq[k] ? ' <small class="mais">(+' + eq[k] + ')</small>' : '') + '</span>' + botao + '</div>';
    }).join('');
    var magico = s.tipoDano === 'magico';
    var status = [
      ['Poder', '<strong class="cor-ouro">' + R.poder(p).toLocaleString('pt-BR') + '</strong>'],
      ['Dano por golpe', dano(s.dano) + (magico ? ' (mágico)' : '')],
      [magico ? 'Ataque mágico' : 'Ataque', '+' + (magico ? s.ataqueMagico : s.ataque)],
      ['Defesa', s.defesa],
      ['Defesa mágica', s.defesaMagica],
      ['Velocidade', s.velocidade],
      ['Precisão', fmt(s.precisao) + '%'],
      ['Evasão', fmt(s.evasao) + '%'],
      ['Chance de crítico', fmt(s.chanceCritico) + '%'],
      ['Dano crítico', s.danoCritico + '%'],
      ['Crítico mágico', fmt(s.chanceCriticoMagico) + '%'],
      ['Dano crítico mágico', s.danoCriticoMagico + '%'],
      ['Sucesso no craft', s.chanceCraft + '%'],
      ['Bônus de drop', '+' + s.bonusDrop + '%'],
      ['Encantamento', s.chanceEncantamento + '%'],
    ].map(function (l) { return '<dt>' + l[0] + '</dt><dd>' + l[1] + '</dd>'; }).join('');

    return '<aside class="caixa ficha">'
      + '<div class="cabeca"><div class="moldura">' + F.personagem(p.raca, p.classe, p.sexo) + '</div><div>'
      + '<h2>' + esc(p.nome) + '</h2><div class="suave">' + D.racas[p.raca].nome + ' · ' + D.classes[p.classe].nome + '</div>'
      + '<div class="nivel">Level ' + p.nivel + '</div></div></div>'
      + '<div class="suave">Vida</div><div id="ficha-hp">' + barra('hp', p.hpAtual, s.hpMax, p.hpAtual + ' / ' + s.hpMax) + '</div>'
      + '<div class="suave">Experiência</div>' + (p.nivel >= D.NIVEL_MAXIMO
        ? barra('exp', 1, 1, 'Level máximo')
        : barra('exp', p.exp, precisa, p.exp.toLocaleString('pt-BR') + ' / ' + precisa.toLocaleString('pt-BR')))
      + vidaTempoHtml(p, s, emBatalha)
      + '<div class="secao ouro"><span>Ouro</span><strong>' + p.ouro.toLocaleString('pt-BR') + '</strong></div>'
      + '<div class="secao"><h3>Atributos' + (p.pontosLivres > 0 ? ' <span class="pontos">' + p.pontosLivres + ' ponto(s) livre(s)</span>' : '') + '</h3>' + atrs + '</div>'
      + (!D.HABILIDADES_ATIVAS ? '' : '<div class="secao"><h3>Habilidade <span class="pontos">Nível ' + R.nivelHabilidade(p) + '</span></h3>'
      + '<div class="nome-habilidade">⚡ ' + D.habilidades[p.classe].nome + '</div>'
      + '<p class="suave pequeno">' + D.habilidades[p.classe].descricao + ' ' + textoHabilidade(p.classe, R.nivelHabilidade(p)) + '</p></div>')
      + '<div class="secao"><h3>Arma</h3>' + (arma
        ? '<div>' + nomeItemHtml(arma) + ' <span class="selo raridade-' + arma.raridade + '">' + D.raridades[arma.raridade].nome + '</span></div>'
        : '<div class="suave">Nenhuma</div>') + '</div>'
      + '<div class="secao"><h3>Status</h3><dl class="status">' + status + '</dl></div>'
      + '</aside>';
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
      + '<dt>Velocidade</dt><dd>' + m.velocidade + '</dd><dt title="Quantas vezes o monstro ataca para cada ataque seu">Ataques/turno</dt><dd>' + fmt(ritmo) + '</dd>'
      + '<dt>Experiência</dt><dd>' + m.exp.toLocaleString('pt-BR') + '</dd><dt>Ouro</dt><dd>' + m.ouro.toLocaleString('pt-BR') + '</dd>'
      + '<dt>Armas</dt><dd>' + textoDrops(m.drops) + '</dd><dt>Armaduras</dt><dd>' + textoDrops(m.dropsArmadura) + '</dd>'
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
      return '<p class="suave">' + (temMouse ? 'Passe o mouse num item para ver a ficha. Clique para equipar ou desequipar.'
        : 'Toque num item para ver a ficha e equipar.') + '</p>';
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
      acoes += estado.vendaPendente === item.id
        ? '<button class="btn perigo" data-acao="vender" data-id="' + item.id + '">Confirmar venda</button>'
        : '<button class="btn secundario" data-acao="pedir-venda" data-id="' + item.id + '">Vender (+' + R.precoVenda(item) + ' ouro)</button>';
    }
    return '<div class="ficha-item-topo"><div class="icone-grande borda-' + item.raridade + (brilho(item) ? ' aura-' + brilho(item) : '') + '">' + F.icone(item) + '</div>'
      + '<div><div class="ficha-item-nome">' + nomeItemHtml(item) + '</div>'
      + '<div class="suave">' + tipoItem(item) + ' · <span class="raridade-' + item.raridade + '">' + D.raridades[item.raridade].nome + '</span>'
      + (slot ? ' · equipado' : '') + '</div></div></div>'
      + '<ul class="ficha-item-bonus">' + linhas + '</ul>'
      + (alvo ? '<p class="suave">Comparado com ' + nomeItemHtml(alvo) + '</p>' : '')
      + '<div class="item-acoes">' + acoes + '</div>';
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
    var mochila = R.mochila(p);
    var celulas = mochila.map(function (i) { return quadroItem(i, 'celula'); });
    for (var n = mochila.length; n < D.MOCHILA_MAX; n++) celulas.push('<div class="celula vazia"></div>');
    var foco = estado.itemFoco ? p.inventario.find(function (i) { return i.id === estado.itemFoco; }) : null;
    return '<div class="personagem-tela"><div class="boneco">' + slots
      + '<div class="retrato-central">' + F.personagem(p.raca, p.classe, p.sexo) + '</div></div>'
      + '<div class="lateral"><div class="caixa-interna" id="ficha-item">' + fichaItemHtml(foco) + '</div>'
      + '<div class="caixa-interna"><h3>Bônus dos equipamentos</h3>'
      + (resumo ? '<dl class="status">' + resumo + '</dl>' : '<p class="suave">Nenhuma armadura equipada.</p>') + '</div></div></div>'
      + '<h3 class="subtitulo">Mochila <span class="suave">(' + mochila.length + '/' + D.MOCHILA_MAX + ')</span></h3>'
      + '<div class="mochila">' + celulas.join('') + '</div>';
  }

  function linhaMercado(modelo) {
    var p = estado.personagem, preco = D.raridades[modelo.raridade].compra, falta = preco - p.ouro;
    return '<div class="item item-com-icone"><div class="icone-pequeno borda-' + modelo.raridade + '">' + F.icone(modelo) + '</div>'
      + '<div class="item-texto"><div>' + nomeItemHtml(modelo) + ' <span class="selo raridade-' + modelo.raridade + '">' + D.raridades[modelo.raridade].nome + '</span></div>'
      + '<div class="suave">' + descricaoItem(modelo) + ' · ' + preco.toLocaleString('pt-BR') + ' de ouro</div></div>'
      + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta.toLocaleString('pt-BR') + '</span>' : '')
      + '<button class="btn" data-acao="comprar" data-tipo="' + modelo.tipo + '" data-raridade="' + modelo.raridade + '"' + (falta > 0 ? ' disabled' : '') + '>Comprar</button></div></div>';
  }

  function abaMercado() {
    var p = estado.personagem;
    return '<p class="suave">Você tem <strong class="cor-ouro">' + p.ouro.toLocaleString('pt-BR') + ' de ouro</strong> · mochila '
      + R.mochila(p).length + '/' + D.MOCHILA_MAX + '.</p><h3 class="subtitulo">Armas de ' + D.classes[p.classe].nome + '</h3><div class="itens">'
      + R.RARIDADES.map(function (k) {
        return linhaMercado({ tipo: 'arma', classe: p.classe, raridade: k, encanto: 0 });
      }).join('') + '</div>'
      + '<h3 class="subtitulo">Armaduras e joias</h3>'
      + '<div class="opcoes">' + R.RARIDADES.map(function (k) {
        return '<button class="opcao mini-opcao' + (estado.mercadoRaridade === k ? ' selecionada' : '') + '" data-acao="mercado-raridade" data-valor="' + k + '"><span class="raridade-' + k + '">' + D.raridades[k].nome + '</span></button>';
      }).join('') + '</div><div class="itens">'
      + R.TIPOS_ARMADURA.concat(R.TIPOS_JOIA).map(function (tipo) {
        return linhaMercado({ tipo: tipo, classe: R.TIPOS_JOIA.indexOf(tipo) >= 0 ? null : p.classe, raridade: estado.mercadoRaridade, encanto: 0 });
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
      return '<div class="item item-com-icone' + (equipado ? ' equipado' : '') + '"><div class="icone-pequeno borda-' + i.raridade + (brilho(i) ? ' aura-' + brilho(i) : '') + '">' + F.icone(i) + '</div>'
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
          + '<td><strong>' + esc(x.nome) + '</strong><div class="suave pequeno">' + (D.racas[x.raca] ? D.racas[x.raca].nome : '') + '</div></td>'
          + '<td>' + (D.classes[x.classe] ? D.classes[x.classe].nome : '') + '</td>'
          + '<td>' + x.nivel + '</td><td>' + Number(x.poder || 0).toLocaleString('pt-BR') + '</td></tr>';
      }).join('') + '</tbody></table>';
    return '<div class="ranking-topo"><div class="botoes">' + botoes + '</div>'
      + '<button class="btn secundario mini-opcao" data-acao="ranking-atualizar">Atualizar</button></div>'
      + '<p class="suave pequeno">Os 100 melhores de Tanka' + (tipo === 'nivel' ? ' por level (empate: quem tem mais exp).' : ' por poder, a força calculada pelos status e equipamentos.')
      + ' Seus personagens aparecem destacados. Contas de administrador não entram.</p>' + corpo;
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
    function botoes(op, valores, rotulo) {
      return valores.map(function (v) {
        return '<button class="btn" data-acao="admin" data-op="' + op + '" data-valor="' + v + '">' + rotulo(v) + '</button>';
      }).join('');
    }
    function grupo(titulo, descricao, conteudo) {
      return '<div class="item"><div><div>' + titulo + '</div><div class="suave">' + descricao + '</div></div>'
        + '<div class="item-acoes">' + conteudo + '</div></div>';
    }
    return '<p class="suave">Ferramentas de teste. Valem só para este personagem e ficam salvas como qualquer progresso.</p>'
      + '<div class="itens">'
      + grupo('Ouro', 'Soma ouro ao personagem.', botoes('ouro', [1000, 10000, 100000], function (v) { return '+' + v.toLocaleString('pt-BR'); }))
      + grupo('Level', 'Sobe de level com os pontos de atributo.', botoes('nivel', [1, 5, 10], function (v) { return '+' + v; }))
      + grupo('Armas', 'Uma arma de cada raridade da classe.', botoes('armas', [0, 7, 10], function (v) { return 'Todas +' + v; }))
      + grupo('Conjunto completo', 'Arma, 4 armaduras da classe, colar e 2 anéis.', R.RARIDADES.map(function (k) {
        return '<button class="btn" data-acao="admin" data-op="conjunto" data-valor="' + k + '">' + D.raridades[k].nome + '</button>';
      }).join(''))
      + grupo('Pergaminhos', 'De todas as raridades.', botoes('pergaminhos', [10, 100], function (v) { return '+' + v + ' de cada'; }))
      + grupo('Vida e poções', 'Cura, devolve as poções do dia ou simula o reset da meia-noite.',
        '<button class="btn" data-acao="admin" data-op="curar" data-valor="0">Curar tudo</button>'
        + '<button class="btn" data-acao="admin" data-op="pocoes" data-valor="0">Recarregar poções</button>'
        + '<button class="btn" data-acao="admin" data-op="reset" data-valor="0">Simular reset diário</button>')
      + '</div>';
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
      + '<div id="hp-jogador">' + barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax) + '</div>'
      + (D.HABILIDADES_ATIVAS ? '<div id="poder-jogador">' + barraPoder(b) + '</div>' : '')
      + '<div class="suave">Velocidade ' + b.jogador.vel + '</div>'
      + (em ? '<div id="controle-habilidade">' + controleHabilidade(b) + '</div>' : '') + '</div>'
      + '<div class="vs">VS</div>'
      + '<div class="lutador" id="lutador-monstro"><div class="moldura">' + F.imagemMonstro(b.monstroId) + '</div><h3>' + b.monstro.nome + '</h3>'
      + '<div id="hp-monstro">' + barra('hp', b.monstro.hp, b.monstro.hpMax, b.monstro.hp + ' / ' + b.monstro.hpMax) + '</div>'
      + '<div class="suave">Velocidade ' + b.monstro.vel + '</div></div></div>'
      + '<div class="registro" id="registro">' + estado.registro.join('') + '</div>'
      + (em ? '<div class="botoes"><button class="btn secundario" data-acao="velocidade">' + (estado.rapido ? 'Velocidade normal' : 'Acelerar ×3') + '</button>'
        + '<button class="btn perigo" data-acao="fugir">Fugir</button></div>' : '');
  }

  function telaJogo() {
    var painel;
    if (estado.chefeAviso) {
      painel = avisoChefeHtml();
    } else if (estado.batalha || estado.resultado) {
      painel = resultadoHtml() + batalhaHtml();
    } else {
      painel = '<nav class="abas-jogo"><button data-acao="aba" data-aba="personagem" class="' + (estado.aba === 'personagem' ? 'ativa' : '') + '">Personagem</button>'
        + '<button data-acao="aba" data-aba="cacar" class="' + (estado.aba === 'cacar' ? 'ativa' : '') + '">Caçar</button>'
        + '<button data-acao="aba" data-aba="mercado" class="' + (estado.aba === 'mercado' ? 'ativa' : '') + '">Mercado</button>'
        + '<button data-acao="aba" data-aba="encantar" class="' + (estado.aba === 'encantar' ? 'ativa' : '') + '">Encantar</button>'
        + '<button data-acao="aba" data-aba="ranking" class="' + (estado.aba === 'ranking' ? 'ativa' : '') + '">Ranking</button>'
        + (ehAdmin() ? '<button data-acao="aba" data-aba="admin" class="aba-admin' + (estado.aba === 'admin' ? ' ativa' : '') + '">Admin</button>' : '')
        + '</nav>'
        + ({ personagem: abaPersonagem, cacar: abaCacar, mercado: abaMercado, encantar: abaEncantar, ranking: abaRanking, admin: abaAdmin })[estado.aba]();
    }
    var trocar = estado.batalha ? '' : '<button class="btn secundario" data-acao="voltar-personagens">Trocar personagem</button>';
    app.innerHTML = topo(trocar) + '<div class="conteudo"><div class="jogo">' + fichaHtml()
      + '<section class="caixa">' + painel + '</section></div></div>' + rodape();
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
    document.getElementById('hp-jogador').innerHTML = barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax);
    document.getElementById('hp-monstro').innerHTML = barra('hp', b.monstro.hp, b.monstro.hpMax, b.monstro.hp + ' / ' + b.monstro.hpMax);
    document.getElementById('ficha-hp').innerHTML = barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax);
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
    var res = R.concluirBatalha(estado.personagem, b, C.agora());
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
  }

  // ---------------- Eventos ----------------

  app.addEventListener('submit', async function (e) {
    e.preventDefault();
    var form = e.target;
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

  app.addEventListener('input', function (e) {
    if (e.target.id === 'nome-personagem' && estado.criacao) estado.criacao.nome = e.target.value;
  });

  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-acao]');
    if (!el) return;
    var p = estado.personagem;
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
        estado.vendaPendente = estado.encantoPendente = estado.ultimoEncanto = estado.itemFoco = null;
        telaJogo();
        break;
      case 'item': {
        // Toque: mostra a ficha do item. Mouse: clique equipa ou desequipa.
        var alvoId = el.dataset.id;
        estado.vendaPendente = null;
        estado.itemFoco = alvoId;
        if (temMouse) {
          var slotAtual = R.slotDoItem(p, alvoId);
          if (slotAtual) {
            if (!R.desequipar(p, slotAtual)) avisar('Mochila cheia! Venda algo antes de desequipar.');
          } else {
            var itemClicado = p.inventario.find(function (i) { return i.id === alvoId; });
            if (!R.equipar(p, alvoId)) avisar(itemClicado && !R.podeUsar(p, itemClicado) ? 'Esse item não é da sua classe.' : 'Não foi possível equipar.');
          }
          salvar();
        }
        telaJogo();
        break;
      }
      case 'desequipar':
        if (R.desequipar(p, el.dataset.slot)) { salvar(); telaJogo(); }
        else avisar('Mochila cheia! Venda algo antes de desequipar.');
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
      case 'ponto':
        if (R.distribuirPonto(p, el.dataset.atributo)) { salvar(); telaJogo(); }
        break;
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
        if (R.equipar(p, el.dataset.id)) { estado.vendaPendente = null; salvar(); telaJogo(); }
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
        var v = op === 'conjunto' ? el.dataset.valor : Number(el.dataset.valor);
        if (op === 'ouro') R.admin.ouro(p, v);
        else if (op === 'nivel') R.admin.subirNivel(p, v);
        else if (op === 'armas') R.admin.armas(p, v);
        else if (op === 'pergaminhos') R.admin.pergaminhos(p, v);
        else if (op === 'conjunto') R.admin.conjunto(p, v);
        else if (op === 'curar') R.descansar(p, C.agora());
        else if (op === 'pocoes') R.admin.recarregarPocoes(p);
        else if (op === 'reset') R.admin.resetDiario(p, C.agora());
        salvar();
        avisar({ ouro: '+' + Number(v).toLocaleString('pt-BR') + ' de ouro.', nivel: 'Agora no level ' + p.nivel + '.',
          armas: 'Armas +' + v + ' adicionadas à mochila.', conjunto: 'Conjunto adicionado à mochila.', pergaminhos: '+' + v + ' pergaminhos de cada raridade.',
          curar: 'Vida recuperada.', pocoes: 'Poções recarregadas.', reset: 'Reset diário: vida cheia e poções do dia.' }[op]);
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
    var aberta = document.querySelector('.ficha');
    var nova = document.createElement('div');
    nova.innerHTML = fichaHtml();
    aberta.replaceWith(nova.firstChild);
  }, 20000);

  // ---------------- Chat global ----------------
  // Fica fora do #app para não sumir quando a tela é redesenhada.
  // Atualiza a cada 4 s com a janela aberta e a cada 20 s fechada (para o contador de novas).
  var chat = { el: null, aberto: false, mensagens: [], ultimoId: 0, naoLidas: 0, timer: null, ativo: false, ultimaCompleta: 0 };

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
    return '<p class="chat-msg"><span class="chat-hora">' + hora + '</span> <strong class="chat-nome classe-' + esc(m.classe) + '">'
      + esc(m.personagem) + '</strong> <span class="chat-info">' + classe + ' Lv ' + m.nivel + '</span>: '
      + esc(m.texto) + acoes + '</p>';
  }

  function desenharChat() {
    if (!chat.aberto) {
      chat.el.innerHTML = '<button class="chat-botao" data-chat="abrir">💬 Chat'
        + (chat.naoLidas ? ' <span class="chat-badge">' + (chat.naoLidas > 99 ? '99+' : chat.naoLidas) + '</span>' : '') + '</button>';
      return;
    }
    var texto = document.getElementById('chat-texto');
    var rascunho = texto ? texto.value : '';
    var focado = texto && document.activeElement === texto;
    chat.el.innerHTML = '<div class="chat-janela"><div class="chat-topo"><strong>Chat Global</strong>'
      + '<button data-chat="fechar" title="Fechar">✕</button></div>'
      + '<div class="chat-lista" id="chat-lista">' + (chat.mensagens.length ? chat.mensagens.map(linhaChat).join('')
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
      if (chat.ativo) desenharChat();
    } catch (e) { /* sem conexão: tenta de novo no próximo ciclo */ }
    if (chat.ativo) chat.timer = setTimeout(buscarChat, document.hidden ? 60000 : chat.aberto ? 4000 : 20000);
  }

  async function enviarChat() {
    var campo = document.getElementById('chat-texto');
    var texto = campo.value.trim();
    if (!texto || !estado.personagem) return;
    try {
      await C.chat.enviar(estado.personagem.nome, texto);
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
