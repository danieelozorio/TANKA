// Tanka — versão LOCAL das contas (sem servidor), com a mesma interface de js/contas.js.
// Usada só na prévia offline e nos testes: os dados ficam no localStorage do navegador.
// A senha nunca é guardada em texto: salvamos só o hash PBKDF2 com sal.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.contas = (function () {
  var CHAVE_CONTAS = 'tanka.contas';
  var CHAVE_SESSAO = 'tanka.sessao';

  function ler() {
    try { return JSON.parse(localStorage.getItem(CHAVE_CONTAS)) || {}; } catch (e) { return {}; }
  }
  function gravar(contas) {
    try { localStorage.setItem(CHAVE_CONTAS, JSON.stringify(contas)); } catch (e) {
      throw new Error('Não foi possível salvar: o navegador bloqueou o armazenamento local.');
    }
  }
  function sessao(valor) {
    try {
      if (valor === undefined) return sessionStorage.getItem(CHAVE_SESSAO);
      if (valor === null) sessionStorage.removeItem(CHAVE_SESSAO); else sessionStorage.setItem(CHAVE_SESSAO, valor);
    } catch (e) { return null; }
    return valor;
  }

  function paraHex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  async function hashSenha(senha, salHex) {
    if (!window.crypto || !crypto.subtle) {
      throw new Error('Seu navegador não permite criptografia nesta página. Abra o jogo via https ou localhost.');
    }
    var sal = new Uint8Array(salHex.match(/../g).map(function (h) { return parseInt(h, 16); }));
    var chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: sal, iterations: 100000, hash: 'SHA-256' }, chave, 256);
    return paraHex(bits);
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
    var contas = ler();
    var chave = d.usuario.toLowerCase();
    if (contas[chave]) throw new Error('Esse nome de usuário já existe.');
    var emailUsado = Object.keys(contas).some(function (k) { return contas[k].email === d.email.toLowerCase(); });
    if (emailUsado) throw new Error('Esse e-mail já está cadastrado.');
    var sal = paraHex(crypto.getRandomValues(new Uint8Array(16)));
    contas[chave] = {
      usuario: d.usuario,
      email: d.email.toLowerCase(),
      sal: sal,
      hash: await hashSenha(d.senha, sal),
      criadoEm: new Date().toISOString(),
      personagens: [],
    };
    gravar(contas);
  }

  async function entrar(usuario, senha) {
    var contas = ler();
    var conta = contas[String(usuario).toLowerCase()];
    if (!conta || (await hashSenha(senha, conta.sal)) !== conta.hash) {
      throw new Error('Usuário ou senha incorretos.');
    }
    sessao(conta.usuario.toLowerCase());
    return contaAtual();
  }

  function sair() { sessao(null); }

  function contaAtual() {
    var chave = sessao();
    var conta = chave ? ler()[chave] || null : null;
    if (conta) conta.admin = Tanka.dados.ADMINS.indexOf(chave) >= 0;
    return conta;
  }

  async function nomePersonagemLivre(nome) {
    var alvo = nome.toLowerCase();
    var contas = ler();
    return !Object.keys(contas).some(function (k) {
      return contas[k].personagens.some(function (p) { return p.nome.toLowerCase() === alvo; });
    });
  }

  // Grava (insere ou atualiza) um personagem da conta logada.
  function salvarPersonagem(p) {
    var chave = sessao();
    var contas = ler();
    if (!chave || !contas[chave]) throw new Error('Sessão expirada. Entre novamente.');
    var lista = contas[chave].personagens;
    var i = lista.findIndex(function (x) { return x.id === p.id; });
    if (i >= 0) lista[i] = p; else lista.push(p);
    gravar(contas);
    return Promise.resolve();
  }

  return {
    iniciar: async function () { return contaAtual(); },
    agora: function () { return Date.now(); },
    criarPersonagem: async function (p) { salvarPersonagem(p); },
    registrar: registrar,
    entrar: entrar,
    sair: sair,
    contaAtual: contaAtual,
    nomePersonagemLivre: nomePersonagemLivre,
    salvarPersonagem: salvarPersonagem,
  };
})();
