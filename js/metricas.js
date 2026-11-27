// Eldrin — métricas e erros (Henri, 27/11/2026).
// Grava no servidor (função registrar_metricas do schema.sql) o que acontece no jogo e os erros da tela,
// para saber em que parte as pessoas desistem e onde o jogo trava. Junta tudo numa fila e manda de vez em quando
// (a cada 20 s, com 10 na fila ou quando a aba some), para não pesar. Sem servidor (prévia) não faz nada.
// Carregado logo depois de contas.js: pega até os erros do app.js ao abrir.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.metricas = (function () {
  var fila = [];
  var timer = null;
  var contexto = null;          // função do app.js que diz personagem, level e área atuais
  var errosVistos = {};         // mesmo erro no máximo 3 vezes por visita
  var totalErros = 0;           // e no máximo 30 erros por visita

  function versao() {
    var s = document.querySelector('script[src*="js/app.js"]');
    var m = s && /[?&]v=(\d+)/.exec(s.getAttribute('src'));
    return m ? m[1] : '';
  }
  function aparelho() {
    return ((window.EldrinNativo ? 'app ' : '') + (navigator.userAgent || '')).slice(0, 120);
  }
  function podeMandar() {
    return Tanka.contas && typeof Tanka.contas.metricas === 'function';
  }

  function evento(tipo, campos) {
    try {
      var e = { tipo: tipo, versao: versao(), aparelho: aparelho() };
      var c = contexto ? contexto() : null;
      if (c) { e.personagem = c.personagem; e.nivel = c.nivel; e.area = c.area; }
      Object.keys(campos || {}).forEach(function (k) { if (campos[k] !== undefined && campos[k] !== null) e[k] = campos[k]; });
      fila.push(e);
      if (fila.length > 100) fila.splice(0, fila.length - 100);   // sem internet: não cresce sem fim
      if (fila.length >= 10) enviar(); else if (!timer) timer = setTimeout(enviar, 20000);
    } catch (x) { /* métrica nunca pode quebrar o jogo */ }
  }

  function enviar(saindo) {
    clearTimeout(timer); timer = null;
    if (!fila.length || !podeMandar()) return;
    var lote = fila.splice(0, 20);
    Tanka.contas.metricas(lote, saindo).catch(function () {
      if (!saindo) fila = lote.concat(fila).slice(0, 100);   // tenta de novo na próxima
    });
    if (fila.length && !saindo) timer = setTimeout(enviar, 5000);
  }

  function erro(msg, onde, pilha) {
    msg = String(msg || '').slice(0, 300);
    if (!msg || /^Script error\.?$/i.test(msg)) return;   // erro de outro site (sem detalhe nenhum)
    if (/ResizeObserver loop/i.test(msg)) return;         // aviso inofensivo do navegador
    var chave = msg + '|' + (onde || '');
    errosVistos[chave] = (errosVistos[chave] || 0) + 1;
    if (errosVistos[chave] > 3 || ++totalErros > 30) return;
    evento('erro', { detalhe: { msg: msg, onde: String(onde || '').slice(0, 200), pilha: String(pilha || '').slice(0, 1200), tela: location.pathname } });
  }

  window.addEventListener('error', function (e) {
    if (!e || e.target !== window && e.target && e.target.tagName) return;   // imagem/som que não carregou: não é erro do jogo
    var onde = e.filename ? e.filename.replace(/^.*\/(js\/)/, '$1').replace(/\?.*$/, '') + ':' + e.lineno + ':' + e.colno : '';
    erro(e.message, onde, e.error && e.error.stack);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    erro(r && r.message || r, 'promessa', r && r.stack);
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') enviar(true); });
  window.addEventListener('pagehide', function () { enviar(true); });

  return {
    evento: evento,
    erro: erro,
    contexto: function (f) { contexto = f; },
    enviar: enviar,
  };
})();
