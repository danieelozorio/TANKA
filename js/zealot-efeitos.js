// Efeitos animados da interface Zealot, "Pedra Sombria" (Daniel, 20/11/2026). Só carrega quando o tema é Zealot.
// Uma tela (canvas) fixa por cima de tudo, sem receber cliques, desenha:
//  - brasas subindo devagar do pé da tela, balançando como fumaça, e umas cinzas caindo;
//  - brasas soltando de vez em quando em volta do nome do herói (.ficha .cabeca);
//  - faíscas de fogo e a carta tremendo quando um lutador da caçada leva um golpe.
// Leve: poucas partículas no celular, para quando a aba está escondida e não roda para quem pede menos movimento.
(function () {
  'use strict';
  if (document.documentElement.getAttribute('data-interface') !== 'zealot') return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var CELULAR = document.documentElement.hasAttribute('data-celular');
  var MAX_BRASAS = CELULAR ? 14 : 34, MAX_CINZAS = CELULAR ? 4 : 10;
  var cv, ctx, W = 0, H = 0, dpr = 1, parts = [], ultimo = 0, ultimaBusca = 0, nome = null, vidaAntes = {};
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  function iniciar() {
    cv = document.createElement('canvas');
    cv.id = 'zealot-efeitos';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:6';
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    medir();
    window.addEventListener('resize', medir);
    requestAnimationFrame(quadro);
  }
  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, CELULAR ? 1.5 : 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function caixa(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return r.width && r.bottom > 0 && r.top < H ? r : null;
  }

  // ---------- partículas ----------
  function brasa(x, y, forte) {
    parts.push({ t: 'brasa', x: x, y: y, vx: rnd(-8, 8), vy: -rnd(forte ? 30 : 14, forte ? 60 : 34), fase: rnd(0, 6.28),
      balanco: rnd(6, 18), vida: 0, max: rnd(4, 9), tam: rnd(0.8, forte ? 2.4 : 1.8), cor: Math.random() < 0.25 ? 1 : 0 });
  }
  function cinza() {
    parts.push({ t: 'cinza', x: rnd(0, W), y: -6, vx: rnd(-6, 6), vy: rnd(8, 18), fase: rnd(0, 6.28), balanco: rnd(10, 24),
      vida: 0, max: rnd(10, 18), tam: rnd(0.8, 1.6) });
  }
  function faiscaGolpe(r, forte) {
    var n = forte ? (CELULAR ? 18 : 30) : (CELULAR ? 10 : 18);
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2, vel = rnd(50, forte ? 240 : 150);
      parts.push({ t: 'golpe', x: r.left + r.width / 2 + rnd(-r.width * .2, r.width * .2), y: r.top + r.height * .45 + rnd(-r.height * .15, r.height * .15),
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 30, vida: 0, max: rnd(.3, .7), tam: rnd(1.2, 2.6) });
    }
  }
  // Golpes na caçada: a barra de vida de um lutador diminuiu -> a carta treme e solta faíscas.
  function golpes() {
    ['jogador', 'monstro'].forEach(function (quem) {
      var el = document.getElementById('lutador-' + quem), fill = el && el.querySelector('.barra > i');
      if (!fill) { delete vidaAntes[quem]; return; }
      var w = parseFloat(fill.style.width) || 0, antes = vidaAntes[quem];
      var txt = el.querySelector('.barra > b'), m = txt && /([\d.]+)/.exec(txt.textContent), vida = m ? Number(m[1].replace(/\./g, '')) : null;
      var vAntes = vidaAntes[quem + 'v'];
      vidaAntes[quem] = w; vidaAntes[quem + 'v'] = vida;
      if (antes === undefined || w >= antes - .01) return;
      var mold = el.querySelector('.moldura') || el, r = mold.getBoundingClientRect();
      if (!r.width) return;
      var forte = antes - w > 25;
      mold.classList.remove('zealot-golpe'); void mold.offsetWidth; mold.classList.add('zealot-golpe');
      faiscaGolpe(r, forte);
      // número do dano saltando por cima da carta (vermelho no herói, dourado no monstro; maior no golpe forte)
      if (vida !== null && vAntes !== null && vAntes > vida) {
        var n = document.createElement('div');
        n.className = 'zg-dano ' + (quem === 'jogador' ? 'no-heroi' : 'no-monstro') + (forte ? ' forte' : '');
        n.textContent = '-' + (vAntes - vida).toLocaleString('pt-BR');
        n.style.left = (r.left + r.width / 2 + rnd(-r.width * .18, r.width * .18)) + 'px';
        n.style.top = (r.top + r.height * .35) + 'px';
        document.body.appendChild(n);
        setTimeout(function () { n.remove(); }, 1100);
      }
      try { window.dispatchEvent(new CustomEvent('eldrin:golpe', { detail: { quem: quem, forte: forte } })); } catch (e) { /* antigo */ }
    });
  }

  function quadro(agora) {
    requestAnimationFrame(quadro);
    if (document.hidden) { ultimo = agora; return; }
    if (CELULAR && agora - ultimo < 32) return;   // celular: ~30 quadros por segundo
    var dt = Math.min(0.05, (agora - (ultimo || agora)) / 1000); ultimo = agora;
    if (agora - ultimaBusca > 250) { ultimaBusca = agora; nome = caixa('.ficha .cabeca'); golpes(); }

    var nB = 0, nC = 0;
    for (var i = 0; i < parts.length; i++) { if (parts[i].t === 'brasa') nB++; else if (parts[i].t === 'cinza') nC++; }
    if (nB < MAX_BRASAS && Math.random() < dt * (CELULAR ? 3 : 7)) brasa(rnd(0, W), H + 4, false);
    if (nC < MAX_CINZAS && Math.random() < dt * 0.8) cinza();
    if (nome && Math.random() < dt * (CELULAR ? 0.8 : 1.6)) brasa(rnd(nome.left, nome.right), rnd(nome.top + nome.height * .3, nome.bottom), true);

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (var k = parts.length - 1; k >= 0; k--) {
      var p = parts[k];
      p.vida += dt;
      if (p.vida >= p.max || p.y < -20 || p.y > H + 20) { parts.splice(k, 1); continue; }
      var f = p.vida / p.max;
      if (p.t === 'golpe') {
        p.vy += 260 * dt; p.vx *= 0.96;
        p.x += p.vx * dt; p.y += p.vy * dt;
        var ag = 1 - f;
        ctx.fillStyle = 'rgba(255,' + Math.round(150 + 90 * ag) + ',60,' + ag.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.tam * (0.6 + ag * 0.6), 0, 6.283); ctx.fill();
        continue;
      }
      p.fase += dt * 1.6;
      p.x += (p.vx + Math.sin(p.fase) * p.balanco) * dt; p.y += p.vy * dt;
      if (p.t === 'cinza') {
        var ac = Math.sin(f * Math.PI) * 0.35;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(170,160,150,' + ac.toFixed(3) + ')';
        ctx.fillRect(p.x, p.y, p.tam * 1.6, p.tam);
        ctx.globalCompositeOperation = 'lighter';
        continue;
      }
      // brasa: acende, brilha e apaga; algumas mais vermelhas
      var a = Math.sin(f * Math.PI) * (0.55 + 0.45 * Math.sin(p.fase * 3)), r = p.tam;
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
      g.addColorStop(0, p.cor ? 'rgba(255,90,40,' + (a * 0.9).toFixed(3) + ')' : 'rgba(255,190,90,' + (a * 0.9).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,190,' + (a * 0.8).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.7, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- Ganhos com "peso" (evento "eldrin:ganho" do app.js) ----------
  // +ouro e +exp flutuando no lugar certo, cena de level up e o raio dourado do drop lendário.
  var fmt = function (n) { return Math.round(n).toLocaleString('pt-BR'); };
  function flutuar(sel, texto, classe) {
    var el = document.querySelector(sel), r = el && el.getBoundingClientRect();
    if (!r || !r.width) return;
    var f = document.createElement('div');
    f.className = 'zg-flutua ' + classe;
    f.textContent = texto;
    f.style.left = (r.left + r.width / 2) + 'px';
    f.style.top = (r.top + r.height / 2) + 'px';
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 1600);
    el.classList.remove('zg-pulso'); void el.offsetWidth; el.classList.add('zg-pulso');
    for (var i = 0; i < (CELULAR ? 6 : 12); i++) brasa(r.left + r.width / 2 + rnd(-r.width / 2, r.width / 2), r.top + r.height / 2, true);
  }
  function cena(classe, html, ms) {
    var velho = document.querySelector('.' + classe);
    if (velho) velho.remove();
    var c = document.createElement('div');
    c.className = 'zg-cena ' + classe;
    c.innerHTML = html;
    c.addEventListener('click', function () { c.remove(); });
    document.body.appendChild(c);
    setTimeout(function () { c.classList.add('saindo'); setTimeout(function () { c.remove(); }, 500); }, ms);
    var n = CELULAR ? 30 : 70;
    for (var i = 0; i < n; i++) brasa(W / 2 + rnd(-W * .3, W * .3), H * .55 + rnd(-40, 40), true);
  }
  var pendente = { ouro: 0, exp: 0 }, timerGanho = null;
  window.addEventListener('eldrin:ganho', function (e) {
    var d = e.detail || {};
    pendente.ouro += d.ouro > 0 ? d.ouro : 0;
    pendente.exp += d.exp > 0 ? d.exp : 0;
    clearTimeout(timerGanho);   // junta ganhos seguidos (caçada rápida) num número só
    timerGanho = setTimeout(function () {
      if (pendente.ouro) flutuar('#recursos .r-ouro', '+' + fmt(pendente.ouro), 'zg-ouro');
      if (pendente.exp) flutuar('#ficha-exp', '+' + fmt(pendente.exp) + ' exp', 'zg-exp');
      pendente = { ouro: 0, exp: 0 };
    }, 250);
    if (d.nivel) cena('zg-levelup', '<div class="zg-brasao">' + d.nivel + '</div><strong>Level ' + d.nivel + '!</strong><small>Você ficou mais forte. Veja os pontos novos em Herói.</small>', 3200);
    if (d.lendarios && d.lendarios.length) cena('zg-lendario', '<div class="zg-raio"></div><strong>✦ Lendário! ✦</strong><small>' + d.lendarios.map(function (x) { return String(x).replace(/[<>&]/g, ''); }).join(' · ') + '</small>', 3000);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
