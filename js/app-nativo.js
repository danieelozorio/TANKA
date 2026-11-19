// App Android (Capacitor, Henri, nov/2026). Só roda dentro do app; no site não faz nada.
// O jogo inteiro vem dentro do APK. Ao abrir, o app confere no GitHub (release "app-web", arquivo versao.json)
// se saiu versão nova:
//  - jogo novo (web maior que o deste app): cobre a tela, baixa o pacote do jogo (obrigatório) e reinicia;
//  - APK novo (apk maior que o instalado): mostra o link para baixar o APK.
// window.ELDRIN_APP = { web: N } é escrito no index.html por ferramentas/montar_app.js.
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var P = C.Plugins || {}, U = P.CapacitorUpdater, H = P.CapacitorHttp, A = P.App;
  var local = window.ELDRIN_APP || { web: 0 };
  var VERSOES = local.versoes || 'https://github.com/danieelozorio/TANKA/releases/download/app-web/versao.json';   // o teste usa o release app-teste
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

  // Jogo novo: atualização OBRIGATÓRIA (pedido do Henri, 16/11/2026). Jogo velho no app briga com o servidor novo
  // ("jogado em outra aba"), então o app cobre a tela, baixa e reinicia; se falhar, só dá para tentar de novo.
  var atualizando = false;
  function oferecerJogo(v) {
    if (atualizando) return;
    atualizando = true;
    var d = caixa('');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;'
      + 'padding:24px;text-align:center;background:rgba(7,8,12,.96);color:#e8dcc4;font:16px/1.5 Georgia,serif';
    function baixar() {
      d.innerHTML = '<strong style="color:#f4d9a0;font-size:20px">Atualizando o Eldrin…</strong>'
        + '<div style="margin-top:8px">Versão nova do jogo' + (v.tamanhoMB ? ' (' + v.tamanhoMB + ' MB)' : '') + ': <span id="app-atualizar-pct">0%</span></div>'
        + '<small style="color:#a8987a;margin-top:6px">Não feche o app. Ele reinicia sozinho no fim.</small>';
      var ouvinte = U.addListener && U.addListener('download', function (e) {
        var el = document.getElementById('app-atualizar-pct');
        if (el && e && e.percent !== undefined) el.textContent = Math.round(e.percent) + '%';
      });
      U.download({ url: v.webUrl, version: String(v.web), checksum: v.checksum || '' }).then(function (pacote) {
        return U.set({ id: pacote.id });   // troca o jogo e reinicia
      }).catch(function (erro) {
        if (ouvinte && ouvinte.then) ouvinte.then(function (o) { o.remove(); });
        var msg = (erro && (erro.message || erro.code)) || String(erro);
        console.error('[eldrin-app] atualização falhou: ' + msg);
        d.innerHTML = '<strong style="color:#f4d9a0;font-size:20px">Não deu para atualizar</strong>'
          + '<div style="margin-top:8px">Confira a internet e tente de novo.</div><small style="color:#a8987a">'
          + String(msg).replace(/</g, '&lt;').slice(0, 200) + '</small><div>' + botao('Tentar de novo', true) + '</div>';
        d.querySelector('button').onclick = baixar;
      });
    }
    baixar();
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
        else if (v.web && v.webUrl && v.checksum && Number(v.web) > Number(local.web || 0) && U && U.download) oferecerJogo(v);
        else if (v.apk && v.apkUrl && apk && Number(v.apk) > apk) oferecerApk(v);
      });
    }).catch(function () {});
  }
  // ---------------- Notificações (Henri, 19/11/2026) ----------------
  // Locais (o próprio celular agenda): estamina da caçada acabou, Chefe Mundial (20h de Brasília) e boss do clã.
  // Do servidor (Firebase): lance coberto no leilão e ataque na Arena. Só depois que o APK tem o Firebase
  // (window.ELDRIN_APP.pushDesde = versão do APK) — antes disso, registrar derrubaria o app.
  var LN = P.LocalNotifications, PN = P.PushNotifications, ID = { cacada: 1001, mundial: 1002, cla: 1003 };
  var BRT = -3;   // Brasília, sem horário de verão
  var permitido = null;
  function permissao() {
    if (permitido) return permitido;
    permitido = !LN ? Promise.resolve(false) : LN.checkPermissions().then(function (r) {
      if (r.display === 'granted') return true;
      return LN.requestPermissions().then(function (x) { return x.display === 'granted'; });
    }).then(function (ok) {
      if (ok && LN.createChannel) LN.createChannel({ id: 'eldrin', name: 'Eldrin', description: 'Avisos do jogo', importance: 4, sound: 'default', vibration: true }).catch(function () {});
      return ok;
    }).catch(function () { return false; });
    return permitido;
  }
  function agendar(id, quando, titulo, corpo, extra) {
    return permissao().then(function (ok) {
      if (!ok) return;
      return LN.cancel({ notifications: [{ id: id }] }).catch(function () {}).then(function () {
        return LN.schedule({ notifications: [Object.assign({ id: id, title: titulo, body: corpo, channelId: 'eldrin',
          schedule: { at: new Date(quando), allowWhileIdle: true } }, extra || {})] });
      });
    }).catch(function () {});
  }
  function cancelar(id) { if (LN) LN.cancel({ notifications: [{ id: id }] }).catch(function () {}); }
  // Próximo horário (hora cheia de Brasília) a partir de agora.
  function proximaHoraBrt(hora) {
    var d = new Date(), alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), (hora - BRT) % 24, 0, 0));
    if (hora - BRT >= 24) alvo = new Date(alvo.getTime() + 86400000);
    while (alvo.getTime() <= Date.now() + 30000) alvo = new Date(alvo.getTime() + 86400000);
    return alvo;
  }
  function agendarDiario(id, hora, titulo, corpo) {
    // agenda os próximos 7 dias (cada abertura do app renova)
    return permissao().then(function (ok) {
      if (!ok) return;
      var ids = [], lista = [], primeiro = proximaHoraBrt(hora).getTime();
      for (var i = 0; i < 7; i++) { ids.push({ id: id * 10 + i }); lista.push({ id: id * 10 + i, title: titulo, body: corpo, channelId: 'eldrin',
        schedule: { at: new Date(primeiro + i * 86400000), allowWhileIdle: true } }); }
      return LN.cancel({ notifications: ids }).catch(function () {}).then(function () { return LN.schedule({ notifications: lista }); });
    }).catch(function () {});
  }
  function cancelarDiario(id) { if (!LN) return; var ids = []; for (var i = 0; i < 7; i++) ids.push({ id: id * 10 + i }); LN.cancel({ notifications: ids }).catch(function () {}); }
  var contas = function () { return window.Tanka && window.Tanka.contas; };

  function registrarPush() {
    if (!PN || !A || !A.getInfo || !(Number(local.pushDesde) > 0)) return;
    A.getInfo().then(function (i) {
      if ((Number(i.build) || 0) < Number(local.pushDesde)) return;   // APK sem o Firebase: não registra
      PN.checkPermissions().then(function (r) {
        return r.receive === 'granted' ? r : PN.requestPermissions();
      }).then(function (r) {
        if (r.receive !== 'granted') return;
        if (PN.createChannel) PN.createChannel({ id: 'eldrin', name: 'Eldrin', description: 'Avisos do jogo', importance: 4, sound: 'default', vibration: true }).catch(function () {});
        PN.addListener('registration', function (t) {
          var C = contas(); if (C && C.push && t && t.value) C.push.registrar(t.value).catch(function () {});
        });
        PN.register();
      }).catch(function () {});
    }).catch(function () {});
  }

  window.EldrinNativo = {
    entrou: function (p) {
      permissao().then(function (ok) {
        if (!ok) return;
        agendarDiario(ID.mundial, 20, 'Chefe Mundial nasceu!', 'Ignaroth despertou! Todos à Aventura › Chefe Mundial.');
        var C = contas();
        if (C && C.alianca && C.alianca.boss && p) C.alianca.boss.estado(p.id).then(function (st) { window.EldrinNativo.bossCla(st); }, function () { cancelarDiario(ID.cla); });
      });
      registrarPush();
    },
    bossCla: function (st) {
      var h = st && st.boss && st.boss.hora;
      if (h === null || h === undefined || h === '') { cancelarDiario(ID.cla); return; }
      agendarDiario(ID.cla, Number(h), 'Chefe do clã nasceu!', 'O boss do seu clã apareceu: chame o grupo e ataque!');
    },
    cacadaFundo: function (p) {
      var C = contas();
      if (!C || !C.cacada || !p) return;
      C.cacada('previsao', { personagem: p.id }).then(function (r) {
        var pv = r && r.previsao;
        if (!pv || !pv.em) return;
        var quando = Number(pv.em) + (Date.now() - (Number(r.agora) || Date.now()));   // relógio do servidor → do celular
        agendar(ID.cacada, quando, pv.semEstamina ? 'A estamina acabou' : 'A caçada parou',
          pv.semEstamina ? 'A caçada de ' + p.nome + ' parou: a estamina acabou.' : (pv.motivo || 'A caçada de ' + p.nome + ' parou.'));
      }).catch(function () {});
    },
    cacadaVoltou: function () { cancelar(ID.cacada); },
  };

  function quandoPronto() { setTimeout(conferir, 2500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', quandoPronto); else quandoPronto();
  // Voltou para o app depois de um tempo: confere de novo.
  if (A && A.addListener) A.addListener('resume', function () { setTimeout(conferir, 1500); });
})();
