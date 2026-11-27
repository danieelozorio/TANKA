// App Android (Capacitor, Henri, nov/2026). Só roda dentro do app; no site não faz nada.
// O jogo inteiro vem dentro do APK. Ao abrir, o app confere no GitHub (release "app-web", arquivo versao.json)
// se saiu versão nova:
//  - jogo novo (web maior que o deste app): pergunta "Atualizar agora" (baixa e reinicia) ou "Depois" (baixa em segundo
//    plano e entra na próxima abertura) (27/11/2026); só cobre a tela e obriga quando o versao.json tem webMinimo maior;
//  - APK novo (apk maior que o instalado): mostra o link para baixar o APK.
// window.ELDRIN_APP = { web: N } é escrito no index.html por ferramentas/montar_app.js.
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var P = C.Plugins || {}, U = P.CapacitorUpdater, H = P.CapacitorHttp, A = P.App;
  var local = window.ELDRIN_APP || { web: 0 };
  var VERSOES = local.versoes || 'https://github.com/danieelozorio/TANKA/releases/download/app-web/versao.json';   // o teste usa o release app-teste
  if (U && U.notifyAppReady) U.notifyAppReady().catch(function () {});   // senão o app volta para a versão anterior
  // Versões (Henri, 27/11/2026): app = versão do APK (1.0.N, N = número da montagem), jogo = vN do pacote do jogo.
  // As Configurações mostram qual está instalada e qual é a mais nova (EldrinNativo.versao()).
  var VERSAO = { web: Number(local.web) || 0, apk: 0, apkNome: '', ultimaWeb: 0, ultimaApk: 0, conferido: false };
  if (A && A.getInfo) A.getInfo().then(function (i) { VERSAO.apk = Number(i.build) || 0; VERSAO.apkNome = i.version || ''; }).catch(function () {});
  function nomeApp(n) { return '1.0.' + n; }

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
  // Jogo novo SEM travar a tela (Henri, 22/11/2026: abrir o app e esperar 0–100% toda vez era chato). Baixa em
  // segundo plano, com só um aviso pequeno embaixo, e deixa pronto para a próxima abertura (U.next); se o jogador
  // sair do app (vai para o fundo), troca na hora. A tela cheia obrigatória (oferecerJogo) só vale quando o
  // versao.json pede: webMinimo maior que a versão deste jogo.
  var pronto = null;
  function aviso(texto, some) {
    var d = document.getElementById('app-baixando');
    if (!d) {
      d = document.createElement('div');
      d.id = 'app-baixando';
      d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom));z-index:99998;'
        + 'padding:4px 12px;border-radius:999px;background:rgba(20,17,12,.88);border:1px solid #7a6a48;color:#d9c9a6;'
        + 'font:12px/1.4 Georgia,serif;pointer-events:none;white-space:nowrap;transition:opacity .4s';
      document.body.appendChild(d);
    }
    d.textContent = texto; d.style.opacity = '1';
    if (some) setTimeout(function () { d.style.opacity = '0'; setTimeout(function () { if (d.parentNode) d.remove(); }, 500); }, some);
  }
  function baixarEmSegundoPlano(v) {
    if (atualizando || pronto) return;
    atualizando = true;
    aviso('⬇ Baixando a versão nova do jogo…');
    var ouvinte = U.addListener && U.addListener('download', function (e) {
      if (e && e.percent !== undefined) aviso('⬇ Baixando a versão nova do jogo… ' + Math.round(e.percent) + '%');
    });
    U.download({ url: v.webUrl, version: String(v.web), checksum: v.checksum || '' }).then(function (pacote) {
      return (U.next ? U.next({ id: pacote.id }) : Promise.resolve()).then(function () {
        pronto = pacote;
        aviso('✔ Versão nova pronta: entra na próxima vez que abrir o app', 5000);
      });
    }).catch(function (erro) {
      console.error('[eldrin-app] download em segundo plano falhou: ' + ((erro && (erro.message || erro.code)) || erro));
      var d = document.getElementById('app-baixando'); if (d) d.remove();
    }).then(function () {
      atualizando = false;
      if (ouvinte && ouvinte.then) ouvinte.then(function (o) { o.remove(); });
    });
  }
  // Saiu do app com a versão nova pronta: troca agora (quando voltar, o jogo já abre novo).
  if (A && A.addListener) A.addListener('appStateChange', function (st) {
    if (st && st.isActive === false && pronto && U && U.set) U.set({ id: pronto.id }).catch(function () {});
  });
  // APK novo: avisa uma vez por versão (o "Depois" fica guardado), a não ser que o jogador peça nas Configurações.
  function oferecerApk(v, forcar) {
    var chave = 'apk' + v.apk;
    try { if (!forcar && localStorage.getItem('eldrin.app.apkDepois') === chave) return; } catch (e) { /* ignora */ }
    var d = caixa('<strong style="color:#f4d9a0">📱 App novo do Eldrin: ' + nomeApp(v.apk) + '</strong><br>'
      + (VERSAO.apk ? 'O seu é o ' + nomeApp(VERSAO.apk) + '. ' : '') + 'Baixe e instale por cima (seus personagens continuam na conta).<br>'
      + '<a href="' + v.apkUrl + '" target="_blank" rel="noopener" style="display:inline-block;'
      + 'margin:10px 8px 0 0;padding:8px 14px;border-radius:6px;background:#e2b45c;color:#1a1408;font-weight:bold;text-decoration:none">Baixar o app</a>'
      + botao('Depois'));
    d.querySelector('button').onclick = function () { try { localStorage.setItem('eldrin.app.apkDepois', chave); } catch (e) { /* ignora */ } d.remove(); };
  }
  // Jogo novo ao abrir o app (Henri, 27/11/2026): pergunta. "Atualizar agora" baixa com a tela de progresso e reinicia;
  // "Depois" baixa em segundo plano e entra na próxima abertura (como era desde 22/11).
  function oferecerAtualizacao(v, forcar) {
    var chave = 'web' + v.web;
    if (!forcar && jaDisseDepois(chave)) { baixarEmSegundoPlano(v); return; }
    var d = caixa('<strong style="color:#f4d9a0">⬆ Versão nova do Eldrin: v' + v.web + '</strong><br>'
      + 'Você está na v' + VERSAO.web + '.' + (v.tamanhoMB ? ' Download de ' + v.tamanhoMB + ' MB.' : '') + '<br>'
      + botao('Atualizar agora', true) + botao('Depois'));
    var bs = d.querySelectorAll('button');
    bs[0].onclick = function () { d.remove(); oferecerJogo(v); };
    bs[1].onclick = function () { depois(chave); d.remove(); baixarEmSegundoPlano(v); };
  }

  var tentativas = 0;
  function conferir(forcar) {
    if (!H || !H.get) return;
    H.get({ url: VERSOES + '?t=' + Date.now(), responseType: 'json' }).then(function (r) {
      if (r && r.status && r.status >= 400) throw new Error('versao.json: ' + r.status);
      var v = r && r.data;
      if (typeof v === 'string') v = JSON.parse(v);
      if (!v) return;
      VERSAO.ultimaWeb = Number(v.web) || 0; VERSAO.ultimaApk = Number(v.apk) || 0; VERSAO.conferido = true;
      var instalado = A && A.getInfo ? A.getInfo().then(function (i) { return Number(i.build) || 0; }) : Promise.resolve(0);
      instalado.then(function (apk) {
        if (apk) VERSAO.apk = apk;
        if (v.apk && v.apkUrl && apk && Number(v.apk) > apk && Number(v.apkMinimo || 0) > apk) oferecerApk(v, true);   // APK obrigatório
        else if (v.web && v.webUrl && v.checksum && Number(v.web) > Number(local.web || 0) && U && U.download) {
          if (Number(v.webMinimo || 0) > Number(local.web || 0)) oferecerJogo(v);   // obrigatória: só quando o versao.json pede
          else if (!pronto && !atualizando) oferecerAtualizacao(v, forcar);
        }
        else if (v.apk && v.apkUrl && apk && Number(v.apk) > apk) oferecerApk(v, forcar);
      });
      tentativas = 0;
    }).catch(function (e) {
      // sem internet ainda (logo ao abrir): tenta de novo mais 3 vezes, de 20 em 20 s
      console.error('[eldrin-app] conferir versão falhou: ' + ((e && e.message) || e));
      if (++tentativas <= 3) setTimeout(conferir, 20000);
    });
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
  // Sino amarelo na frente do título das notificações (Henri, 20/11/2026).
  function comSino(t) { return /^🔔/.test(t || '') ? t : '🔔 ' + (t || 'Eldrin'); }
  function agendar(id, quando, titulo, corpo, extra) {
    titulo = comSino(titulo);
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
    titulo = comSino(titulo);
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

  // Diagnóstico (19/11/2026): cada etapa do registro fica em EldrinNativo.push; se travar, mostra o motivo na tela.
  function avisoPush(txt, ok) {
    window.EldrinNativo.push = txt;
    try { if (ok && localStorage.getItem('eldrin.pushOk') === txt) return; if (ok) localStorage.setItem('eldrin.pushOk', txt); } catch (e) {}
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 12px);z-index:99999;padding:10px 14px;border-radius:8px;'
      + 'background:#14110c;border:1px solid ' + (ok ? '#5c9e5c' : '#c0504d') + ';color:#e8dcc4;font:14px/1.4 Georgia,serif';
    d.textContent = (ok ? '🔔 ' : '⚠ Notificações: ') + txt;
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, ok ? 4000 : 12000);
  }
  function erroTxt(e) { return (e && (e.message || e.error || (typeof e === 'string' ? e : JSON.stringify(e)))) || 'erro desconhecido'; }
  var pushLigado = false, tentativasPush = 0;
  function registrarPush() {
    if (!PN) return avisoPush('o app não tem o plugin de notificações (APK antigo?)');
    if (!A || !A.getInfo) return avisoPush('o app não informa a versão (APK antigo?)');
    if (!(Number(local.pushDesde) > 0)) return avisoPush('pacote do jogo sem pushDesde (web ' + local.web + ')');
    A.getInfo().then(function (i) {
      if ((Number(i.build) || 0) < Number(local.pushDesde)) return avisoPush('APK ' + i.build + ' é anterior ao ' + local.pushDesde + ': instale o APK novo');
      return PN.checkPermissions().then(function (r) {
        return r.receive === 'granted' ? r : PN.requestPermissions();
      }).then(function (r) {
        if (r.receive !== 'granted') return avisoPush('permissão negada (' + r.receive + ')');
        if (PN.createChannel) PN.createChannel({ id: 'eldrin', name: 'Eldrin', description: 'Avisos do jogo', importance: 4, sound: 'default', vibration: true }).catch(function () {});
        if (!pushLigado) {
          pushLigado = true;
          // SERVICE_NOT_AVAILABLE e parecidos (20/11/2026): o Google Play Services do celular não alcançou o Firebase naquela
          // hora (rede, economia de bateria). Tenta de novo sozinho (15 s, 1 min, 5 min, 15 min) e só avisa se todas falharem.
          PN.addListener('registrationError', function (e) {
            var txt = erroTxt(e), espera = [15000, 60000, 300000, 900000][tentativasPush++];
            if (espera && /SERVICE_NOT_AVAILABLE|TIMEOUT|IOException|network/i.test(txt)) {
              setTimeout(function () { try { PN.register(); } catch (x) { /* ignora */ } }, espera);
              return;
            }
            avisoPush(/SERVICE_NOT_AVAILABLE/.test(txt)
              ? 'o celular não conseguiu falar com o Google agora (Google Play Services sem conexão). Confira a internet e se o Google Play Services está atualizado e sem restrição de bateria; o app tenta de novo na próxima vez que abrir.'
              : 'o Firebase recusou o registro: ' + txt);
          });
          PN.addListener('registration', function (t) {
            var C = contas();
            if (!t || !t.value) return avisoPush('o Firebase não devolveu o código do aparelho');
            if (!C || !C.push) return avisoPush('jogo sem Tanka.contas.push');
            tentativasPush = 0;
            C.push.registrar(t.value).then(function () { avisoPush('Notificações ligadas neste aparelho.', true); },
              function (e) { avisoPush('o servidor recusou o aparelho: ' + erroTxt(e)); });
          });
        }
        return PN.register();
      });
    }).catch(function (e) { avisoPush('falhou: ' + erroTxt(e)); });
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
    // Versões instaladas e as mais novas (para as Configurações) e "Procurar atualização".
    versao: function () { return { app: VERSAO.apk ? nomeApp(VERSAO.apk) : (VERSAO.apkNome || '?'), jogo: VERSAO.web,
      ultimoJogo: VERSAO.ultimaWeb, ultimoApp: VERSAO.ultimaApk ? nomeApp(VERSAO.ultimaApk) : '', conferido: VERSAO.conferido,
      jogoNovo: VERSAO.ultimaWeb > VERSAO.web, appNovo: !!(VERSAO.ultimaApk && VERSAO.apk && VERSAO.ultimaApk > VERSAO.apk), pronto: !!pronto }; },
    conferir: function () { conferir(true); },
  };

  function quandoPronto() { setTimeout(conferir, 2500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', quandoPronto); else quandoPronto();
  // Voltou para o app depois de um tempo: confere de novo.
  if (A && A.addListener) A.addListener('resume', function () { setTimeout(conferir, 1500); });
})();
