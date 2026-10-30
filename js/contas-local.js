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

  // Chat local (só neste navegador), com as mesmas regras do servidor.
  var CHAVE_CHAT = 'tanka.chat';
  function lerChat() { try { return JSON.parse(localStorage.getItem(CHAVE_CHAT)) || []; } catch (e) { return []; } }
  function gravarChat(l) { try { localStorage.setItem(CHAVE_CHAT, JSON.stringify(l.slice(-100))); } catch (e) { /* sem armazenamento */ } }
  var silenciados = {};
  var chat = {
    recentes: async function () { return lerChat(); },
    novas: async function (desdeId) { return lerChat().filter(function (m) { return m.id > desdeId; }); },
    enviar: async function (personagem, texto) {
      var conta = contaAtual();
      var p = conta && conta.personagens.find(function (x) { return x.nome === personagem; });
      if (!p) throw new Error('Personagem inválido.');
      if (silenciados[conta.usuario.toLowerCase()] > Date.now()) throw new Error('Você não pode falar no chat (decisão do administrador).');
      var lista = lerChat();
      var ultima = lista.filter(function (m) { return m.conta === conta.usuario; }).pop();
      if (ultima && Date.now() - Date.parse(ultima.criado_em) < 3000) throw new Error('Calma! Espere 3 segundos entre as mensagens.');
      lista.push({ id: (lista.length ? lista[lista.length - 1].id : 0) + 1, conta: conta.usuario, personagem: p.nome,
        classe: p.classe, nivel: p.nivel, texto: texto.trim().slice(0, 200), criado_em: new Date().toISOString() });
      gravarChat(lista);
    },
    apagar: async function (id) { gravarChat(lerChat().filter(function (m) { return m.id !== id; })); },
    silenciar: async function (personagem, horas) {
      var m = lerChat().find(function (x) { return x.personagem.toLowerCase() === personagem.toLowerCase(); });
      if (!m) throw new Error('Personagem não encontrado.');
      silenciados[m.conta.toLowerCase()] = horas === null ? Infinity : horas <= 0 ? 0 : Date.now() + horas * 3600000;
    },
  };

  async function ranking(tipo) {
    var contas = ler();
    var lista = [];
    Object.keys(contas).forEach(function (k) {
      if (Tanka.dados.ADMINS.indexOf(k) >= 0) return;
      contas[k].personagens.forEach(function (p) {
        lista.push({ nome: p.nome, classe: p.classe, raca: p.raca, nivel: p.nivel, exp: p.exp, poder: p.poder || 0 });
      });
    });
    lista.sort(function (a, b) {
      return tipo === 'poder' ? b.poder - a.poder || b.nivel - a.nivel : b.nivel - a.nivel || b.exp - a.exp;
    });
    return lista.slice(0, 100);
  }

  // Amigos locais: entre personagens das contas deste navegador.
  var CHAVE_AMIZADES = 'tanka.amizades';
  function lerAmizades() { try { return JSON.parse(localStorage.getItem(CHAVE_AMIZADES)) || []; } catch (e) { return []; } }
  function gravarAmizades(l) { try { localStorage.setItem(CHAVE_AMIZADES, JSON.stringify(l)); } catch (e) { /* sem armazenamento */ } }
  function todosPersonagens() {
    var contas = ler(), lista = [];
    Object.keys(contas).forEach(function (k) {
      contas[k].personagens.forEach(function (p) { lista.push({ conta: k, p: p }); });
    });
    return lista;
  }
  var amigos = {
    listar: async function (meu) {
      var todos = todosPersonagens();
      return lerAmizades().filter(function (a) { return a.de === meu || a.para === meu; }).map(function (a) {
        var outroId = a.de === meu ? a.para : a.de;
        var o = (todos.find(function (x) { return x.p.id === outroId; }) || {}).p;
        if (!o) return null;
        return { pedido: a.id, situacao: a.status === 'aceita' ? 'amigo' : a.de === meu ? 'enviado' : 'recebido',
          id: o.id, nome: o.nome, classe: o.classe, raca: o.raca, nivel: o.nivel, poder: o.poder || 0, visto_em: null };
      }).filter(Boolean);
    },
    pedir: async function (meu, nome) {
      var todos = todosPersonagens();
      var eu = todos.find(function (x) { return x.p.id === meu; });
      var alvo = todos.find(function (x) { return x.p.nome.toLowerCase() === nome.trim().toLowerCase(); });
      if (!alvo) throw new Error('Nenhum personagem com esse nome.');
      if (eu && alvo.conta === eu.conta) throw new Error('Esse personagem é seu.');
      var l = lerAmizades();
      var ex = l.find(function (a) { return (a.de === meu && a.para === alvo.p.id) || (a.de === alvo.p.id && a.para === meu); });
      if (ex) {
        if (ex.status === 'aceita') throw new Error('Vocês já são amigos.');
        if (ex.de === meu) throw new Error('Pedido já enviado. Espere a resposta.');
        ex.status = 'aceita'; gravarAmizades(l); return 'aceita';
      }
      l.push({ id: Date.now(), de: meu, para: alvo.p.id, status: 'pendente' });
      gravarAmizades(l);
      return 'enviado';
    },
    responder: async function (meu, pedido, aceitar) {
      var l = lerAmizades();
      var a = l.find(function (x) { return x.id === pedido && x.para === meu; });
      if (!a) return;
      if (aceitar) a.status = 'aceita'; else l.splice(l.indexOf(a), 1);
      gravarAmizades(l);
    },
    remover: async function (meu, pedido) {
      gravarAmizades(lerAmizades().filter(function (x) { return !(x.id === pedido && (x.de === meu || x.para === meu)); }));
    },
  };

  // Masmorras precisam de outros jogadores: só funcionam com o servidor.
  function soServidor() { return Promise.reject(new Error('As masmorras precisam do servidor: jogue pelo site do Tanka.')); }
  var grupo = {
    estado: function () { return Promise.resolve({ local: true, entradas: 0, convites: [], grupo: null, run: null, recompensas: [] }); },
    convidar: soServidor, responder: soServidor, sair: soServidor, expulsar: soServidor, pronto: soServidor,
    escolher: soServidor, iniciar: soServidor, concluir: soServidor, resgatar: soServidor, adminRecarregar: soServidor,
  };

  var arena = {
    estado: function () { return Promise.resolve({ local: true }); },
    desafiar: soServidor, revanche: soServidor, rolar: soServidor, aplicarCredito: soServidor, adminRecarregar: soServidor,
  };

  return {
    arena: arena,
    grupo: grupo,
    amigos: amigos,
    ranking: ranking,
    chat: chat,
    iniciar: async function () { return contaAtual(); },
    agora: function () { return Date.now(); },
    criarPersonagem: async function (p) { salvarPersonagem(p); },
    excluirPersonagem: async function (id) {
      var chave = sessao(), contas = ler();
      if (!chave || !contas[chave]) throw new Error('Sessão expirada. Entre novamente.');
      contas[chave].personagens = contas[chave].personagens.filter(function (x) { return x.id !== id; });
      gravar(contas);
      gravarAmizades(lerAmizades().filter(function (a) { return a.de !== id && a.para !== id; }));
    },
    registrar: registrar,
    entrar: entrar,
    sair: sair,
    contaAtual: contaAtual,
    nomePersonagemLivre: nomePersonagemLivre,
    salvarPersonagem: salvarPersonagem,
  };
})();
