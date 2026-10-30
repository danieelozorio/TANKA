// Tanka — cadastro, login e gravação de personagens no servidor (Supabase).
// Fala direto com a API REST do Supabase (Auth + PostgREST), sem biblioteca externa.
// O login é por nome de usuário: por baixo, o Auth recebe um e-mail interno
// <usuario>@jogador.tankaarena.com. O e-mail real fica na tabela `contas`.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.contas = (function () {
  var CFG = Tanka.config;
  var CHAVE_SESSAO = 'tanka.sessao';
  var sessao = null;        // { access_token, refresh_token, expires_at, user }
  var conta = null;         // { usuario, email, admin, personagens: [...] }
  var diferencaRelogio = 0; // servidor - aparelho (ms)
  var fila = Promise.resolve();

  function emailInterno(usuario) { return String(usuario).toLowerCase() + '@jogador.tankaarena.com'; }

  function guardarSessao(s) {
    sessao = s;
    try {
      if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); else localStorage.removeItem(CHAVE_SESSAO);
    } catch (e) { /* sem armazenamento: a sessão vale só nesta aba */ }
  }
  function lerSessao() {
    try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO)); } catch (e) { return null; }
  }

  async function pedir(caminho, opcoes) {
    opcoes = opcoes || {};
    var cab = { apikey: CFG.supabaseChave, 'Content-Type': 'application/json' };
    if (opcoes.logado !== false && sessao) cab.Authorization = 'Bearer ' + sessao.access_token;
    Object.assign(cab, opcoes.cabecalhos || {});
    var resp;
    try {
      resp = await fetch(CFG.supabaseUrl + caminho, {
        method: opcoes.metodo || 'GET', headers: cab,
        body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      });
    } catch (e) {
      throw new Error('Sem conexão com o servidor. Verifique sua internet.');
    }
    var texto = await resp.text();
    var dados = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch (e) { dados = texto; }
    if (!resp.ok) {
      var erro = new Error((dados && (dados.msg || dados.message || dados.error_description || dados.error)) || 'Erro no servidor (' + resp.status + ').');
      erro.status = resp.status;
      erro.codigo = dados && (dados.code || dados.error_code);
      throw erro;
    }
    return dados;
  }
  function rpc(nome, args) {
    return pedir('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: args || {} });
  }

  // Renova o token se faltar menos de 1 minuto para vencer.
  async function sessaoValida() {
    if (!sessao) return false;
    if (sessao.expires_at && sessao.expires_at * 1000 - Date.now() > 60000) return true;
    try {
      guardarSessao(await pedir('/auth/v1/token?grant_type=refresh_token', {
        metodo: 'POST', logado: false, corpo: { refresh_token: sessao.refresh_token },
      }));
      return true;
    } catch (e) {
      if (e.status >= 400 && e.status < 500) guardarSessao(null);
      return !!sessao;
    }
  }

  async function sincronizarRelogio() {
    try {
      var antes = Date.now();
      var servidor = Date.parse(await rpc('agora'));
      diferencaRelogio = servidor - (antes + Date.now()) / 2;
    } catch (e) { diferencaRelogio = 0; }
  }
  function agora() { return Date.now() + diferencaRelogio; }

  async function carregarConta() {
    if (!(await sessaoValida())) { conta = null; return null; }
    var linhas = await pedir('/rest/v1/contas?select=usuario,email,admin');
    if (!linhas || !linhas.length) { guardarSessao(null); conta = null; return null; }
    var pers = await pedir('/rest/v1/personagens?select=dados&order=criado_em');
    conta = Object.assign(linhas[0], { personagens: pers.map(function (x) { return x.dados; }) });
    return conta;
  }

  // Ao abrir a página: retoma a sessão salva e acerta o relógio.
  async function iniciar() {
    sessao = lerSessao();
    await sincronizarRelogio();
    try { return await carregarConta(); } catch (e) { return null; }
  }

  function validarCadastro(d) {
    if (!/^[A-Za-z0-9_]{3,16}$/.test(d.usuario)) return 'Usuário deve ter de 3 a 16 caracteres (letras, números ou _).';
    if (d.senha.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (d.senha !== d.confirmar) return 'As senhas não conferem.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'E-mail inválido.';
    return null;
  }

  async function registrar(d) {
    var erro = validarCadastro(d);
    if (erro) throw new Error(erro);
    if (!(await rpc('usuario_livre', { u: d.usuario }))) throw new Error('Esse nome de usuário já existe.');
    if (!(await rpc('email_livre', { e: d.email }))) throw new Error('Esse e-mail já está cadastrado.');
    try {
      await pedir('/auth/v1/signup', {
        metodo: 'POST', logado: false,
        corpo: { email: emailInterno(d.usuario), password: d.senha,
          data: { usuario: d.usuario, email: d.email.toLowerCase() } },
      });
    } catch (e) {
      if (e.codigo === 'user_already_exists' || /already/i.test(e.message)) throw new Error('Esse nome de usuário já existe.');
      if (e.codigo === 'weak_password') throw new Error('Senha fraca. Use pelo menos 6 caracteres.');
      if (e.status === 429) throw new Error('Muitos cadastros seguidos. Tente de novo em alguns minutos.');
      throw new Error('Não foi possível criar a conta: ' + e.message);
    }
    // O cadastro já entra na conta; o jogo pede o login em seguida, então saímos.
    guardarSessao(null);
  }

  async function entrar(usuario, senha) {
    try {
      guardarSessao(await pedir('/auth/v1/token?grant_type=password', {
        metodo: 'POST', logado: false, corpo: { email: emailInterno(usuario), password: senha },
      }));
    } catch (e) {
      if (e.codigo === 'email_not_confirmed') throw new Error('Conta ainda não confirmada. No Supabase, desligue "Confirm email" (Authentication > Sign In / Providers > Email).');
      if (e.status === 400) throw new Error('Usuário ou senha incorretos.');
      throw e;
    }
    await sincronizarRelogio();
    var c = await carregarConta();
    if (!c) throw new Error('Conta não encontrada. Fale com o administrador.');
    return c;
  }

  function sair() {
    var s = sessao;
    guardarSessao(null);
    conta = null;
    if (s) fetch(CFG.supabaseUrl + '/auth/v1/logout', { method: 'POST',
      headers: { apikey: CFG.supabaseChave, Authorization: 'Bearer ' + s.access_token } }).catch(function () {});
  }

  function contaAtual() { return conta; }

  function nomePersonagemLivre(nome) { return rpc('nome_personagem_livre', { n: nome }); }

  async function criarPersonagem(p) {
    await sessaoValida();
    try {
      await pedir('/rest/v1/personagens', { metodo: 'POST', cabecalhos: { Prefer: 'return=minimal' },
        corpo: { id: p.id, nome: p.nome, dados: p } });
    } catch (e) {
      if (e.codigo === '23505') throw new Error('Esse nome já está em uso em Tanka.');
      if (/Limite/.test(e.message)) throw new Error('Limite de 3 personagens por conta.');
      throw e;
    }
    conta.personagens.push(p);
  }

  // Apaga o personagem do servidor (amizades vão junto).
  async function excluirPersonagem(id) {
    await logado();
    await fila.catch(function () {});   // espera gravações pendentes desse personagem
    await pedir('/rest/v1/personagens?id=eq.' + encodeURIComponent(id), { metodo: 'DELETE', cabecalhos: { Prefer: 'return=minimal' } });
    conta.personagens = conta.personagens.filter(function (x) { return x.id !== id; });
  }

  // Grava o personagem. As gravações saem em fila, na ordem em que foram pedidas.
  function salvarPersonagem(p) {
    var copia = JSON.parse(JSON.stringify(p));
    var i = conta ? conta.personagens.findIndex(function (x) { return x.id === p.id; }) : -1;
    if (i >= 0) conta.personagens[i] = p;
    fila = fila.catch(function () {}).then(async function () {
      if (!(await sessaoValida())) throw new Error('Sessão expirada. Entre novamente.');
      await pedir('/rest/v1/personagens?id=eq.' + encodeURIComponent(copia.id), {
        metodo: 'PATCH', cabecalhos: { Prefer: 'return=minimal' }, corpo: { dados: copia } });
    });
    return fila;
  }

  // ---------- Chat global ----------
  var CAMPOS_CHAT = 'select=id,personagem,classe,nivel,texto,criado_em,sigla';
  async function logado() {
    if (!(await sessaoValida())) throw new Error('Sessão expirada. Entre novamente.');
  }
  var chat = {
    // Últimas 100 mensagens (da mais antiga para a mais nova).
    recentes: async function () {
      await logado();
      return (await pedir('/rest/v1/mensagens?' + CAMPOS_CHAT + '&order=id.desc&limit=100')).reverse();
    },
    novas: async function (desdeId) {
      await logado();
      return pedir('/rest/v1/mensagens?' + CAMPOS_CHAT + '&id=gt.' + Number(desdeId) + '&order=id.asc&limit=100');
    },
    // O servidor confere flood, silêncio e preenche classe/level a partir do personagem salvo.
    enviar: async function (personagem, texto) {
      await logado();
      await pedir('/rest/v1/mensagens', { metodo: 'POST', cabecalhos: { Prefer: 'return=minimal' },
        corpo: { personagem: personagem, texto: texto, classe: '-', nivel: 0 } });
    },
    apagar: async function (id) {
      await logado();
      await pedir('/rest/v1/mensagens?id=eq.' + Number(id), { metodo: 'DELETE', cabecalhos: { Prefer: 'return=minimal' } });
    },
    silenciar: async function (personagem, horas) {
      await logado();
      await rpc('silenciar', { nome_personagem: personagem, horas: horas });
    },
  };

  // Top 100 por 'nivel' ou 'poder' (o servidor junta os personagens de todas as contas).
  async function ranking(tipo) {
    await sessaoValida();
    return rpc('ranking', { tipo: tipo });
  }

  // ---------- Amigos (sempre do ponto de vista do personagem "meu") ----------
  var amigos = {
    listar: async function (meu) { await logado(); return rpc('amigos_listar', { meu: meu }); },
    pedir: async function (meu, nome) { await logado(); return rpc('amigo_pedir', { meu: meu, nome_amigo: nome }); },
    responder: async function (meu, pedido, aceitar) { await logado(); await rpc('amigo_responder', { meu: meu, pedido: pedido, aceitar: aceitar }); },
    remover: async function (meu, pedido) { await logado(); await rpc('amigo_remover', { meu: meu, pedido: pedido }); },
  };

  // ---------- Grupo e masmorras ----------
  function chamar(nome, args) { return logado().then(function () { return rpc(nome, args); }); }
  var grupo = {
    estado: function (meu) { return chamar('grupo_estado', { meu: meu }); },
    convidar: function (meu, amigo) { return chamar('grupo_convidar', { meu: meu, amigo: amigo }); },
    responder: function (meu, convite, aceitar) { return chamar('grupo_responder', { meu: meu, convite: convite, aceitar: aceitar }); },
    sair: function (meu) { return chamar('grupo_sair', { meu: meu }); },
    expulsar: function (meu, alvo) { return chamar('grupo_expulsar', { meu: meu, alvo: alvo }); },
    pronto: function (meu, pronto) { return chamar('grupo_pronto', { meu: meu, pronto: pronto }); },
    escolher: function (meu, masmorra) { return chamar('grupo_escolher', { meu: meu, masmorra: masmorra }); },
    iniciar: function (meu) { return chamar('masmorra_iniciar', { meu: meu }); },
    concluir: function (meu, run, vitoria) { return chamar('masmorra_concluir', { meu: meu, run_id: run, vitoria: vitoria }); },
    resgatar: function (meu, id) { return chamar('recompensa_resgatar', { meu: meu, recompensa: id }); },
    adminRecarregar: function (meu) { return chamar('masmorra_admin_recarregar', { meu: meu }); },
  };

  // ---------- Arena (a luta roda no servidor) ----------
  // ---------- Alianças ----------
  var alianca = {
    estado: function (meu, busca) { return chamar('alianca_estado', { meu: meu, busca: busca || null }); },
    criar: function (meu, nome, sigla, brasao) { return chamar('alianca_criar', { meu: meu, nome: nome, sigla: sigla, brasao: brasao }); },
    convidar: function (meu, nome) { return chamar('alianca_convidar', { meu: meu, nome_alvo: nome }); },
    responder: function (meu, convite, aceitar) { return chamar('alianca_responder', { meu: meu, convite: convite, aceitar: aceitar }); },
    pedir: function (meu, id) { return chamar('alianca_pedir', { meu: meu, aid: id }); },
    decidir: function (meu, pedido, aceitar) { return chamar('alianca_decidir', { meu: meu, pedido: pedido, aceitar: aceitar }); },
    sair: function (meu) { return chamar('alianca_sair', { meu: meu }); },
    expulsar: function (meu, alvo) { return chamar('alianca_expulsar', { meu: meu, alvo: alvo }); },
    cargo: function (meu, alvo, cargo) { return chamar('alianca_cargo', { meu: meu, alvo: alvo, cargo: cargo }); },
    desfazer: function (meu) { return chamar('alianca_desfazer', { meu: meu }); },
    mural: function (meu, texto) { return chamar('alianca_mural', { meu: meu, texto: texto }); },
    brasao: function (meu, brasao) { return chamar('alianca_brasao', { meu: meu, brasao: brasao }); },
    doar: function (meu, valor) { return chamar('alianca_doar', { meu: meu, valor: valor }); },
    bonus: function (meu, tipo) { return chamar('alianca_bonus', { meu: meu, tipo: tipo }); },
    chat: function (meu, depois) { return chamar('alianca_chat', { meu: meu, depois: depois || 0 }); },
    chatEnviar: function (meu, texto) { return chamar('alianca_chat_enviar', { meu: meu, texto: texto }); },
    admin: function (meu, id, acao, valor) { return chamar('alianca_admin', { meu: meu, aid: id, acao: acao, valor: valor == null ? null : String(valor) }); },
  };

  var arena = {
    estado: function (meu, ver) { return chamar('arena_estado', { meu: meu, ver: ver || null }); },
    perfil: function (meu, alvo) { return chamar('arena_perfil', { meu: meu, alvo: alvo }); },
    desafiar: function (meu, alvo) { return chamar('arena_desafiar', { meu: meu, alvo: alvo }); },
    revanche: function (meu, luta) { return chamar('arena_revanche', { meu: meu, luta: luta }); },
    rolar: function (meu, luta, rolar) { return chamar('arena_rolar', { meu: meu, luta: luta, rolar: rolar }); },
    aplicarCredito: function (meu, id) { return chamar('credito_aplicar', { meu: meu, credito: id }); },
    adminRecarregar: function (meu) { return chamar('arena_admin_recarregar', { meu: meu }); },
  };

  return {
    arena: arena,
    alianca: alianca,
    grupo: grupo,
    amigos: amigos,
    ranking: ranking,
    chat: chat,
    iniciar: iniciar,
    agora: agora,
    registrar: registrar,
    entrar: entrar,
    sair: sair,
    contaAtual: contaAtual,
    nomePersonagemLivre: nomePersonagemLivre,
    criarPersonagem: criarPersonagem,
    excluirPersonagem: excluirPersonagem,
    salvarPersonagem: salvarPersonagem,
  };
})();
