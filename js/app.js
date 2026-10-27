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

  // Nome da arma com cor da raridade e brilho do encantamento.
  function nomeArmaHtml(item) {
    var e = item.encanto || 0;
    var brilho = e >= 10 ? ' brilho-dourado' : e >= 7 ? ' brilho-roxo' : e >= 4 ? ' brilho-azul' : '';
    return '<span class="raridade-' + item.raridade + brilho + '">' + esc(R.nomeArma(item)) + '</span>';
  }

  function ehAdmin() {
    return !!estado.conta && D.ADMINS.indexOf(estado.conta.usuario.toLowerCase()) >= 0;
  }

  function salvar() {
    try { C.salvarPersonagem(estado.personagem); } catch (e) { avisar(e.message); }
  }

  // ---------------- Login / cadastro ----------------

  function telaAuth(modo, erro) {
    var cadastro = modo === 'cadastro';
    var form = cadastro
      ? '<form data-form="cadastro" novalidate>'
        + '<label>Nome de usuário<input name="usuario" autocomplete="username" required maxlength="16"></label>'
        + '<label>Senha<input name="senha" type="password" autocomplete="new-password" required></label>'
        + '<label>Confirmar senha<input name="confirmar" type="password" autocomplete="new-password" required></label>'
        + '<label>E-mail<input name="email" type="email" autocomplete="email" required></label>'
        + '<label>WhatsApp<input name="whatsapp" type="tel" autocomplete="tel" placeholder="(11) 91234-5678" required></label>'
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

  function criarPersonagem() {
    var c = estado.criacao;
    var nome = c.nome.trim();
    var erro = document.getElementById('erro-criacao');
    if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]{2,15}$/.test(nome)) {
      erro.textContent = 'O nome deve ter de 3 a 16 letras ou números, começando com letra, sem espaços.';
      return;
    }
    if (!C.nomePersonagemLivre(nome)) { erro.textContent = 'Esse nome já está em uso em Tanka.'; return; }
    var p = R.criarPersonagem(nome, c.sexo, c.raca, c.classe);
    estado.personagem = p;
    salvar();
    estado.conta = C.contaAtual();
    estado.criacao = null;
    avisar('Bem-vindo a Tanka, ' + nome + '!');
    abrirJogo(p.id);
  }

  // ---------------- Jogo ----------------

  function abrirJogo(id) {
    estado.personagem = R.normalizar(estado.conta.personagens.find(function (p) { return p.id === id; }));
    estado.aba = 'cacar';
    estado.vendaPendente = null;
    estado.resultado = null;
    telaJogo();
  }

  function fichaHtml() {
    var p = estado.personagem, s = R.status(p);
    var precisa = R.expNecessaria(p.nivel);
    var arma = R.armaEquipada(p);
    var emBatalha = !!estado.batalha;
    var atrs = R.ATRIBUTOS.map(function (k) {
      var botao = p.pontosLivres > 0 && !emBatalha
        ? '<button class="btn mini" data-acao="ponto" data-atributo="' + k + '" title="Aumentar ' + D.atributos[k].nome + '">+</button>'
        : '<span></span>';
      return '<div class="linha-atr" title="' + esc(D.atributos[k].efeito) + '"><span>' + D.atributos[k].nome + '</span>'
        + '<span class="valor">' + p.atributos[k] + '</span>' + botao + '</div>';
    }).join('');
    var magico = s.tipoDano === 'magico';
    var status = [
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
      + '<div class="suave">Experiência</div>' + barra('exp', p.exp, precisa, p.exp + ' / ' + precisa)
      + '<button class="btn secundario largo" data-acao="descansar"' + (emBatalha || p.hpAtual >= s.hpMax ? ' disabled' : '') + '>Descansar (recupera a vida)</button>'
      + '<div class="secao ouro"><span>Ouro</span><strong>' + p.ouro.toLocaleString('pt-BR') + '</strong></div>'
      + '<div class="secao"><h3>Atributos' + (p.pontosLivres > 0 ? ' <span class="pontos">' + p.pontosLivres + ' ponto(s) livre(s)</span>' : '') + '</h3>' + atrs + '</div>'
      + '<div class="secao"><h3>Arma</h3>' + (arma
        ? '<div>' + nomeArmaHtml(arma) + ' <span class="selo raridade-' + arma.raridade + '">' + D.raridades[arma.raridade].nome + '</span></div>'
        : '<div class="suave">Nenhuma</div>') + '</div>'
      + '<div class="secao"><h3>Status</h3><dl class="status">' + status + '</dl></div>'
      + '</aside>';
  }

  function textoDrops(m) {
    if (!m.drops.length) return 'Nenhum';
    return m.drops.map(function (d) {
      return '<span class="raridade-' + d.raridade + '">' + D.raridades[d.raridade].nome + ' ' + d.chance + '%</span>';
    }).join(', ');
  }

  function abaCacar() {
    var p = estado.personagem, s = R.status(p);
    var cartas = Object.keys(D.monstros).map(function (id) {
      var m = D.monstros[id];
      var ritmo = m.velocidade / Math.max(1, s.velocidade);
      return '<article class="monstro"><div class="moldura">' + F.imagemMonstro(id) + '</div><div class="corpo">'
        + '<h3>' + m.nome + '</h3><p class="suave">' + m.descricao + '</p>'
        + '<dl class="ficha-monstro"><dt>Vida</dt><dd>' + m.hp + '</dd><dt>Ataque</dt><dd>' + dano(m.ataque) + '</dd>'
        + '<dt>Velocidade</dt><dd>' + m.velocidade + '</dd><dt title="Quantas vezes o monstro ataca para cada ataque seu">Ataques/turno</dt><dd>' + fmt(ritmo) + '</dd>'
        + '<dt>Experiência</dt><dd>' + m.exp + '</dd><dt>Drops</dt><dd>' + textoDrops(m) + '</dd>'
        + '<dt>Abatidos</dt><dd>' + (p.abates[id] || 0) + '</dd></dl>'
        + '<button class="btn largo" data-acao="cacar" data-monstro="' + id + '">Caçar</button></div></article>';
    }).join('');
    return '<p class="suave">Os drops sempre trazem a arma da sua classe (' + D.armas[p.classe].tipo + '). '
      + 'Sua Sorte aumenta as chances em +' + s.bonusDrop + '%.</p><div class="monstros">' + cartas + '</div>';
  }

  function abaInventario() {
    var p = estado.personagem;
    var ordem = Object.keys(D.raridades).reverse();
    var itens = p.inventario.slice().sort(function (a, b) { return ordem.indexOf(a.raridade) - ordem.indexOf(b.raridade); });
    return '<p class="suave">Venda qualquer arma, menos a equipada.</p><div class="itens">' + itens.map(function (i) {
      var equipado = i.id === p.armaEquipada;
      var preco = R.precoVenda(i);
      var acoes = equipado
        ? '<span class="suave">Equipada</span>'
        : '<button class="btn" data-acao="equipar" data-id="' + i.id + '">Equipar</button>'
          + (estado.vendaPendente === i.id
            ? '<button class="btn perigo" data-acao="vender" data-id="' + i.id + '">Confirmar venda</button>'
            : '<button class="btn secundario" data-acao="pedir-venda" data-id="' + i.id + '">Vender (+' + preco + ' ouro)</button>');
      return '<div class="item' + (equipado ? ' equipado' : '') + '"><div>'
        + '<div>' + nomeArmaHtml(i) + ' <span class="selo raridade-' + i.raridade + '">' + D.raridades[i.raridade].nome + '</span></div>'
        + '<div class="suave">' + D.armas[i.classe].tipo + ' · dano ' + dano(R.danoArma(i)) + '</div></div>'
        + '<div class="item-acoes">' + acoes + '</div></div>';
    }).join('') + '</div>';
  }

  function abaMercado() {
    var p = estado.personagem;
    return '<p class="suave">Armas de ' + D.classes[p.classe].nome + ' (' + D.armas[p.classe].tipo + '). Você tem <strong class="cor-ouro">'
      + p.ouro.toLocaleString('pt-BR') + ' de ouro</strong>.</p><div class="itens">'
      + Object.keys(D.raridades).map(function (k) {
        var r = D.raridades[k];
        var falta = r.compra - p.ouro;
        return '<div class="item"><div>'
          + '<div class="raridade-' + k + '">' + D.armas[p.classe][k] + ' <span class="selo">' + r.nome + '</span></div>'
          + '<div class="suave">Dano ' + dano(r.dano) + ' · ' + r.compra.toLocaleString('pt-BR') + ' de ouro</div></div>'
          + '<div class="item-acoes">' + (falta > 0 ? '<span class="suave">Faltam ' + falta.toLocaleString('pt-BR') + '</span>' : '')
          + '<button class="btn" data-acao="comprar" data-raridade="' + k + '"' + (falta > 0 ? ' disabled' : '') + '>Comprar</button></div></div>';
      }).join('') + '</div>'
      + '<h3 class="subtitulo">Pergaminhos de Encantamento</h3>'
      + '<p class="suave">Cada tentativa de encantar gasta 1 pergaminho da mesma raridade da arma.</p><div class="itens">'
      + Object.keys(D.raridades).map(function (k) {
        var preco = D.encantamento.precoPergaminho[k];
        var falta = preco - p.ouro;
        return '<div class="item"><div>'
          + '<div>Pergaminho para arma <span class="raridade-' + k + '">' + D.raridades[k].nome.toLowerCase() + '</span></div>'
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
      var nome = esc(D.armas[u.item.classe][u.item.raridade]);
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
        var falha = { nada: 'sem risco', zera: 'se falhar, volta para +0', quebra: 'se falhar, a arma QUEBRA' }[risco];
        info = '+' + i.encanto + ' → +' + (i.encanto + 1) + ' · chance <strong>' + chance + '%</strong> · <span class="' + (risco === 'quebra' ? 'menos' : '') + '">' + falha + '</span>';
        var semPergaminho = p.pergaminhos[i.raridade] <= 0;
        acao = risco === 'quebra' && estado.encantoPendente === i.id
          ? '<button class="btn perigo" data-acao="encantar" data-id="' + i.id + '">Arriscar mesmo assim</button>'
          : '<button class="btn" data-acao="' + (risco === 'quebra' ? 'pedir-encanto' : 'encantar') + '" data-id="' + i.id + '"' + (semPergaminho ? ' disabled' : '') + '>Encantar</button>';
        if (semPergaminho) acao = '<span class="suave">Sem pergaminho</span>' + acao;
      }
      return '<div class="item' + (i.id === p.armaEquipada ? ' equipado' : '') + '"><div>'
        + '<div>' + nomeArmaHtml(i) + (i.id === p.armaEquipada ? ' <span class="suave">(equipada)</span>' : '') + '</div>'
        + '<div class="suave">Dano ' + dano(R.danoArma(i)) + ' · ' + info + '</div></div>'
        + '<div class="item-acoes">' + acao + '</div></div>';
    }).join('');
    return aviso + '<p class="suave">Pergaminhos: ' + cont + '. Compre mais no Mercado. Sua Sorte soma +' + p.atributos.sor + '% na chance a partir do +4.</p>'
      + '<div class="itens">' + lista + '</div>';
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
      + grupo('Pergaminhos', 'De todas as raridades.', botoes('pergaminhos', [10, 100], function (v) { return '+' + v + ' de cada'; }))
      + grupo('Vida', 'Recupera toda a vida.', '<button class="btn" data-acao="admin" data-op="curar" data-valor="0">Curar</button>')
      + '</div>';
  }

  function resultadoHtml() {
    var r = estado.resultado;
    if (!r) return '';
    var m = D.monstros[r.monstroId];
    if (r.resultado === 'vitoria') {
      return '<div class="resultado"><h2>Vitória!</h2><p>Você derrotou ' + m.nome + ' e ganhou <strong>' + r.exp + ' de exp</strong> e <strong class="cor-ouro">' + r.ouro + ' de ouro</strong>.</p>'
        + (r.niveis ? '<p class="destaque">Subiu para o level ' + estado.personagem.nivel + '! +' + r.niveis * D.PONTOS_POR_NIVEL + ' pontos de atributo.</p>' : '')
        + (r.drop ? '<p>Drop: <strong class="raridade-' + r.drop.raridade + '">' + R.nomeArma(r.drop) + ' (' + D.raridades[r.drop.raridade].nome + ')</strong></p>' : '')
        + (r.pergaminho ? '<p>Drop: <strong>Pergaminho para arma <span class="raridade-' + r.pergaminho + '">' + D.raridades[r.pergaminho].nome.toLowerCase() + '</span></strong></p>' : '')
        + '<div class="botoes"><button class="btn" data-acao="cacar" data-monstro="' + r.monstroId + '">Caçar de novo</button>'
        + '<button class="btn secundario" data-acao="fechar-resultado">Voltar</button></div></div>';
    }
    if (r.resultado === 'derrota') {
      return '<div class="resultado derrota"><h2>Derrota</h2><p>' + m.nome + ' foi mais forte. Você volta ao acampamento com metade da vida.</p>'
        + '<div class="botoes"><button class="btn secundario" data-acao="fechar-resultado">Voltar</button></div></div>';
    }
    return '<div class="resultado"><p>Você fugiu de ' + m.nome + '.</p><div class="botoes"><button class="btn secundario" data-acao="fechar-resultado">Voltar</button></div></div>';
  }

  function batalhaHtml() {
    var b = estado.batalha || estado.ultimaBatalha;
    var p = estado.personagem;
    var em = !!estado.batalha;
    return '<div class="arena">'
      + '<div class="lutador" id="lutador-jogador"><div class="moldura">' + F.personagem(p.raca, p.classe, p.sexo) + '</div><h3>' + esc(p.nome) + '</h3>'
      + '<div id="hp-jogador">' + barra('hp', b.jogador.hp, b.jogador.hpMax, b.jogador.hp + ' / ' + b.jogador.hpMax) + '</div>'
      + '<div class="suave">Velocidade ' + b.jogador.vel + '</div></div>'
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
    if (estado.batalha || estado.resultado) {
      painel = resultadoHtml() + batalhaHtml();
    } else {
      painel = '<nav class="abas-jogo"><button data-acao="aba" data-aba="cacar" class="' + (estado.aba === 'cacar' ? 'ativa' : '') + '">Caçar</button>'
        + '<button data-acao="aba" data-aba="inventario" class="' + (estado.aba === 'inventario' ? 'ativa' : '') + '">Inventário (' + estado.personagem.inventario.length + ')</button>'
        + '<button data-acao="aba" data-aba="mercado" class="' + (estado.aba === 'mercado' ? 'ativa' : '') + '">Mercado</button>'
        + '<button data-acao="aba" data-aba="encantar" class="' + (estado.aba === 'encantar' ? 'ativa' : '') + '">Encantar</button>'
        + (ehAdmin() ? '<button data-acao="aba" data-aba="admin" class="aba-admin' + (estado.aba === 'admin' ? ' ativa' : '') + '">Admin</button>' : '')
        + '</nav>'
        + ({ cacar: abaCacar, inventario: abaInventario, mercado: abaMercado, encantar: abaEncantar, admin: abaAdmin })[estado.aba]();
    }
    var trocar = estado.batalha ? '' : '<button class="btn secundario" data-acao="voltar-personagens">Trocar personagem</button>';
    app.innerHTML = topo(trocar) + '<div class="conteudo"><div class="jogo">' + fichaHtml()
      + '<section class="caixa">' + painel + '</section></div></div>' + rodape();
    var reg = document.getElementById('registro');
    if (reg) reg.scrollTop = reg.scrollHeight;
  }

  // ---------------- Batalha ----------------

  function linha(classe, texto) {
    estado.registro.push('<p class="' + classe + '">' + texto + '</p>');
  }

  function iniciarCaca(monstroId) {
    var p = estado.personagem;
    estado.resultado = null;
    estado.batalha = R.iniciarBatalha(p, monstroId);
    estado.registro = [];
    linha('destaque', esc(p.nome) + ' encontra ' + D.monstros[monstroId].nome + '!');
    telaJogo();
    agendar();
  }

  function agendar() {
    clearTimeout(estado.timer);
    estado.timer = setTimeout(turno, estado.rapido ? 160 : 550);
  }

  function golpe(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('golpeado');
    void el.offsetWidth;
    el.classList.add('golpeado');
  }

  function turno() {
    var b = estado.batalha;
    if (!b) return;
    var ev = R.passo(b);
    var nomeJ = esc(b.jogador.nome), nomeM = b.monstro.nome;
    if (ev.ator === 'jogador') {
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
    var reg = document.getElementById('registro');
    reg.insertAdjacentHTML('beforeend', estado.registro[estado.registro.length - 1]);
    reg.scrollTop = reg.scrollHeight;

    if (b.fim) setTimeout(function () { encerrar(); }, 500);
    else agendar();
  }

  function encerrar() {
    var b = estado.batalha;
    if (!b) return;
    clearTimeout(estado.timer);
    var res = R.concluirBatalha(estado.personagem, b);
    res.monstroId = b.monstroId;
    if (res.resultado === 'vitoria') {
      linha('destaque', 'Vitória! +' + res.exp + ' de exp.');
      if (res.niveis) linha('destaque', 'Level up! Agora você é level ' + estado.personagem.nivel + '.');
      if (res.drop) linha('destaque', 'Drop: ' + R.nomeArma(res.drop) + ' (' + D.raridades[res.drop.raridade].nome + ')!');
      if (res.pergaminho) linha('destaque', 'Drop: Pergaminho para arma ' + D.raridades[res.pergaminho].nome.toLowerCase() + '!');
    } else if (res.resultado === 'derrota') {
      linha('dano-recebido', esc(estado.personagem.nome) + ' caiu em batalha.');
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
        estado.vendaPendente = estado.encantoPendente = estado.ultimoEncanto = null;
        telaJogo();
        break;
      case 'ponto':
        if (R.distribuirPonto(p, el.dataset.atributo)) { salvar(); telaJogo(); }
        break;
      case 'descansar':
        R.descansar(p);
        salvar();
        avisar(p.nome + ' descansa junto à fogueira e recupera toda a vida.');
        telaJogo();
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
          avisar('Você vendeu ' + R.nomeArma(item) + ' por ' + valor + ' de ouro.');
        }
        estado.vendaPendente = null;
        telaJogo();
        break;
      }
      case 'comprar': {
        var comprado = R.comprar(p, el.dataset.raridade);
        if (comprado) {
          salvar();
          avisar('Você comprou ' + R.nomeArma(comprado) + '! Já está no inventário.');
          telaJogo();
        }
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
        var v = Number(el.dataset.valor);
        var op = el.dataset.op;
        if (op === 'ouro') R.admin.ouro(p, v);
        else if (op === 'nivel') R.admin.subirNivel(p, v);
        else if (op === 'armas') R.admin.armas(p, v);
        else if (op === 'pergaminhos') R.admin.pergaminhos(p, v);
        else if (op === 'curar') R.descansar(p);
        salvar();
        avisar({ ouro: '+' + v.toLocaleString('pt-BR') + ' de ouro.', nivel: 'Agora no level ' + p.nivel + '.',
          armas: 'Armas +' + v + ' adicionadas ao inventário.', pergaminhos: '+' + v + ' pergaminhos de cada raridade.',
          curar: 'Vida recuperada.' }[op]);
        telaJogo();
        break;
      }
      case 'cacar': iniciarCaca(el.dataset.monstro); break;
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

  // ---------------- Início ----------------
  estado.conta = C.contaAtual();
  if (estado.conta) telaPersonagens(); else telaAuth('entrar');
})();
