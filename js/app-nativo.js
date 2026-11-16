// App Android (Capacitor, Henri, nov/2026). Só roda dentro do app; no site não faz nada.
// O jogo inteiro vem dentro do APK. Ao abrir, o app confere no GitHub (release "app-web", arquivo versao.json)
// se saiu versão nova:
//  - jogo novo (web maior que o deste app): pergunta e, se o jogador deixar, baixa o pacote do jogo e reinicia;
//  - APK novo (apk maior que o instalado): mostra o link para baixar o APK.
// window.ELDRIN_APP = { web: N } é escrito no index.html por ferramentas/montar_app.js.
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var P = C.Plugins || {}, U = P.CapacitorUpdater, H = P.CapacitorHttp, A = P.App;
  var VERSOES = 'https://github.com/danieelozorio/TANKA/releases/download/app-web/versao.json';
  var local = window.ELDRIN_APP || { web: 0 };
  if (U && U.notifyAppReady) U.notifyAppReady().catch(function () {});   // senão o app volta para a versão anterior

  function caixa(html) {
    var velha = document.getElementById('app-atualizar');
    if (velha) velha.remove();
    var d = document.createElement('div');
    d.id = 'app-atualizar';
    d.setAttribute('role', 'dialog');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;padding:14px 16px;border-radius:10px;'
      + 'background:#14110c;border:1px solid #e2b45c;color:#e8dcc4;font:15px/1.4 Georgia,serif;box-shadow:0 6px 30px rgba(0,0,0,.6)';
    d.innerHTML = html;
    document.body.appendChild(d);
    return d;
  }
  function botao(texto, primario) {
    return '<button style="margin:10px 8px 0 0;padding:8px 14px;border-radius:6px;font:inherit;cursor:pointer;'
      + (primario ? 'background:#e2b45c;color:#1a1408;border:0;font-weight:bold' : 'background:transparent;color:#e8dcc4;border:1px solid #7a6a48')
      + '">' + texto + '</button>';
  }
  function depois(chave) { try { sessionStorage.setItem('eldrin.app.depois', chave); } catch (e) {} }
  function jaDisseDepois(chave) { try { return sessionStorage.getItem('eldrin.app.depois') === chave; } catch (e) { return false; } }

  function oferecerJogo(v) {
    var chave = 'web' + v.web;
    if (jaDisseDepois(chave)) return;
    var d = caixa('<strong style="color:#f4d9a0">Atualização do Eldrin</strong><br>Saiu uma versão nova do jogo'
      + (v.tamanhoMB ? ' (' + v.tamanhoMB + ' MB)' : '') + '. Quer baixar agora?<br>' + botao('Atualizar agora', true) + botao('Depois'));
    var b = d.querySelectorAll('button');
    b[1].onclick = function () { depois(chave); d.remove(); };
    b[0].onclick = function () {
      d.innerHTML = '<strong style="color:#f4d9a0">Baixando a atualização…</strong> <span id="app-atualizar-pct">0%</span>'
        + '<br><small>Não feche o app. Ele reinicia sozinho no fim.</small>';
      var ouvinte = U.addListener && U.addListener('download', function (e) {
        var el = document.getElementById('app-atualizar-pct');
        if (el && e && e.percent !== undefined) el.textContent = Math.round(e.percent) + '%';
      });
      U.download({ url: v.webUrl, version: String(v.web) }).then(function (pacote) {
        return U.set({ id: pacote.id });   // troca o jogo e reinicia
      }).catch(function () {
        if (ouvinte && ouvinte.then) ouvinte.then(function (o) { o.remove(); });
        d.innerHTML = 'Não deu para baixar a atualização agora. Tente de novo mais tarde.<br>' + botao('Ok');
        d.querySelector('button').onclick = function () { d.remove(); };
      });
    };
  }
  function oferecerApk(v) {
    var chave = 'apk' + v.apk;
    if (jaDisseDepois(chave)) return;
    var d = caixa('<strong style="color:#f4d9a0">App novo do Eldrin</strong><br>Saiu uma versão nova do app. Baixe e instale por cima '
      + '(seus personagens continuam na conta).<br><a href="' + v.apkUrl + '" target="_blank" rel="noopener" style="display:inline-block;'
      + 'margin:10px 8px 0 0;padding:8px 14px;border-radius:6px;background:#e2b45c;color:#1a1408;font-weight:bold;text-decoration:none">Baixar o app</a>'
      + botao('Depois'));
    d.querySelector('button').onclick = function () { depois(chave); d.remove(); };
  }

  function conferir() {
    if (!H || !H.get) return;
    H.get({ url: VERSOES + '?t=' + Date.now(), responseType: 'json' }).then(function (r) {
      var v = r && r.data;
      if (typeof v === 'string') v = JSON.parse(v);
      if (!v) return;
      var instalado = A && A.getInfo ? A.getInfo().then(function (i) { return Number(i.build) || 0; }) : Promise.resolve(0);
      instalado.then(function (apk) {
        if (v.apk && v.apkUrl && apk && Number(v.apk) > apk && Number(v.apkMinimo || 0) > apk) oferecerApk(v);   // APK obrigatório
        else if (v.web && v.webUrl && Number(v.web) > Number(local.web || 0) && U && U.download) oferecerJogo(v);
        else if (v.apk && v.apkUrl && apk && Number(v.apk) > apk) oferecerApk(v);
      });
    }).catch(function () {});
  }
  function quandoPronto() { setTimeout(conferir, 2500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', quandoPronto); else quandoPronto();
  // Voltou para o app depois de um tempo: confere de novo.
  if (A && A.addListener) A.addListener('resume', function () { setTimeout(conferir, 1500); });
})();
