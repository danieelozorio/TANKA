// Efeitos animados da interface Arcane (Henri, nov/2026). Só carrega quando o tema é Arcane (jogar/index.html).
// Uma tela (canvas) fixa por cima de tudo, sem receber cliques, desenha:
//  - faíscas douradas em volta do nome do herói (.ficha .cabeca);
//  - pó arcano verde/azul/roxo subindo em volta do retrato (.retrato-central) e da mochila (.pg-mochila);
//  - o fogo das tochas e velas das paredes do castelo (fundo lateral) tremulando, com brasas subindo.
// Não mexe no jogo: só lê a posição dos elementos. Para quando a aba está escondida ou o jogador pede menos movimento.
(function () {
  'use strict';
  if (document.documentElement.getAttribute('data-interface') !== 'arcane') return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Chamas nas artes das laterais (em % da imagem). lateral-esq: 148x1960; lateral-dir: 160x1960.
  var CHAMAS = [
    { lado: 'esq', x: 56.4, y: 76.8, tam: 1.6, tocha: true },
    { lado: 'esq', x: 81.1, y: 40.9, tam: 0.9 },
    { lado: 'dir', x: 16.0, y: 39.5, tam: 1.0 },
    { lado: 'dir', x: 86.4, y: 82.8, tam: 0.9 },
    { lado: 'dir', x: 71.8, y: 84.2, tam: 0.7 },
  ];
  var LARG = { esq: 148, dir: 160 }, ALT = 1960;

  var cv, ctx, dpr = 1, W = 0, H = 0, parts = [], alvos = {}, ultimaBusca = 0, t0 = performance.now(), ultimo = t0;

  function iniciar() {
    cv = document.createElement('canvas');
    cv.id = 'arcane-efeitos';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:6';
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    medir();
    window.addEventListener('resize', medir);
    requestAnimationFrame(quadro);
  }
  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function retangulo(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    if (!r.width || r.bottom < -50 || r.top > H + 50) return null;
    return r;
  }
  function buscar(agora) {
    if (agora - ultimaBusca < 200) return;
    ultimaBusca = agora;
    alvos.nome = retangulo('.ficha .cabeca');
    alvos.retrato = retangulo('.retrato-central');
    alvos.mochila = retangulo('.pg-mochila');
    alvos.conteudo = retangulo('.conteudo .jogo') || retangulo('.conteudo');
    golpes();
  }
  // Golpes na caçada: quando a barra de vida de um lutador diminui, a carta treme e soltam faíscas.
  var vidaAntes = {};
  function golpes() {
    ['jogador', 'monstro'].forEach(function (quem) {
      var el = document.getElementById('lutador-' + quem), fill = el && el.querySelector('.barra > i');
      if (!fill) { delete vidaAntes[quem]; return; }
      var w = parseFloat(fill.style.width) || 0, antes = vidaAntes[quem];
      vidaAntes[quem] = w;
      if (antes === undefined || w >= antes - .01) return;
      var mold = el.querySelector('.moldura'), r = mold && mold.getBoundingClientRect();
      if (!r || !r.width) return;
      mold.classList.remove('arcane-golpe'); void mold.offsetWidth; mold.classList.add('arcane-golpe');
      var forte = antes - w > 25, n = forte ? 40 : 22;
      for (var i = 0; i < n; i++) {
        var ang = Math.random() * Math.PI * 2, vel = rnd(60, forte ? 260 : 170);
        parts.push({ tipo: 'golpe', x: r.left + r.width / 2 + rnd(-r.width * .2, r.width * .2), y: r.top + r.height * .45 + rnd(-r.height * .15, r.height * .15),
          vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 30, vida: 0, max: rnd(.35, .8), tam: rnd(1.2, 2.8), herói: quem === 'jogador' });
      }
    });
  }
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  // ---------- criação das partículas ----------
  function faisca(r) {
    // num ponto da borda do quadro do nome
    var per = 2 * (r.width + r.height), d = Math.random() * per, x, y;
    if (d < r.width) { x = r.left + d; y = r.top; }
    else if (d < r.width + r.height) { x = r.right; y = r.top + d - r.width; }
    else if (d < 2 * r.width + r.height) { x = r.right - (d - r.width - r.height); y = r.bottom; }
    else { x = r.left; y = r.bottom - (d - 2 * r.width - r.height); }
    parts.push({ tipo: 'faisca', x: x + rnd(-4, 4), y: y + rnd(-4, 4), vx: rnd(-6, 6), vy: rnd(-14, -2), vida: 0, max: rnd(.6, 1.1), tam: rnd(1.1, 2.8) });
  }
  // pó dourado fininho grudado na borda do quadro do nome (mais denso em cima e embaixo)
  function poeira(r) {
    var lado = Math.random(), x, y;
    if (lado < .4) { x = rnd(r.left, r.right); y = r.top + rnd(-6, 8); }
    else if (lado < .8) { x = rnd(r.left, r.right); y = r.bottom + rnd(-8, 10); }
    else { x = Math.random() < .5 ? r.left + rnd(-6, 6) : r.right + rnd(-6, 6); y = rnd(r.top, r.bottom); }
    parts.push({ tipo: 'poeira', x: x, y: y, vx: rnd(-4, 4), vy: rnd(-8, 3), vida: 0, max: rnd(.6, 1.2), tam: rnd(.5, 1.2), fase: rnd(0, 6.28) });
  }
  var CORES_PO = { verde: [74, 222, 128], azul: [96, 165, 250], roxo: [192, 132, 252] };
  function po(r, onde) {
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2, a = Math.random() * Math.PI * 2;
    var rx = r.width * rnd(.5, .75), ry = r.height * rnd(.5, .7), x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    var cor = onde === 'mochila' ? CORES_PO.roxo : x < cx - r.width * .15 ? CORES_PO.verde : y > cy + r.height * .2 && x > cx ? CORES_PO.roxo : CORES_PO.azul;
    parts.push({ tipo: 'po', x: x, y: y, vx: rnd(-6, 6), vy: rnd(-30, -12), fase: rnd(0, 6.28), vida: 0, max: rnd(.9, 1.7), tam: rnd(1, 2.4), cor: cor });
  }
  function brasa(x, y, tam) {
    parts.push({ tipo: 'brasa', x: x + rnd(-3, 3) * tam, y: y, vx: rnd(-6, 6), vy: rnd(-40, -18) * tam, fase: rnd(0, 6.28), vida: 0, max: rnd(.8, 1.8), tam: rnd(.8, 1.8) * tam });
  }

  // ---------- chamas das paredes ----------
  function posChama(c) {
    var w = LARG[c.lado] / ALT * H;
    var x = c.lado === 'esq' ? c.x / 100 * w : W - w + c.x / 100 * w;
    return { x: x, y: c.y / 100 * H, esc: H / ALT * 6 };
  }
  function desenharChamas(t, dt) {
    var r = alvos.conteudo;
    CHAMAS.forEach(function (c, i) {
      var p = posChama(c);
      if (r && p.x > r.left - 10 && p.x < r.right + 10) return;   // atrás dos painéis: não desenha
      var tremor = .86 + .09 * Math.sin(t * 2.7 + i * 2) + .05 * Math.sin(t * 4.3 + i * 3) * Math.sin(t * 1.3 + i);
      var raio = (c.tocha ? 46 : 26) * c.tam * p.esc / 6 * tremor;
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, raio * 2.4);
      g.addColorStop(0, 'rgba(255, 210, 120, ' + (.55 * tremor) + ')');
      g.addColorStop(.25, 'rgba(255, 150, 50, ' + (.28 * tremor) + ')');
      g.addColorStop(1, 'rgba(255, 110, 20, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, raio * 2.4, 0, Math.PI * 2); ctx.fill();
      // miolo da chama, mexendo
      var nucleo = ctx.createRadialGradient(p.x, p.y - raio * .15, 0, p.x, p.y, raio * .55);
      nucleo.addColorStop(0, 'rgba(255, 250, 220, ' + (.7 * tremor) + ')');
      nucleo.addColorStop(1, 'rgba(255, 190, 80, 0)');
      ctx.fillStyle = nucleo;
      ctx.beginPath(); ctx.ellipse(p.x + Math.sin(t * 2.2 + i) * 1, p.y - raio * .1, raio * .35, raio * .6, 0, 0, Math.PI * 2); ctx.fill();
      if (c.tocha && Math.random() < dt * 9) brasa(p.x, p.y - raio * .3, c.tam * .8);
      else if (!c.tocha && Math.random() < dt * 1.5) brasa(p.x, p.y - raio * .3, .5);
    });
  }

  // ---------- desenho ----------
  function estrela(x, y, s, a) {
    ctx.globalAlpha = a;
    var g = ctx.createRadialGradient(x, y, 0, x, y, s * 3);
    g.addColorStop(0, 'rgba(255, 236, 170, 1)'); g.addColorStop(.35, 'rgba(255, 200, 90, .55)'); g.addColorStop(1, 'rgba(255, 180, 60, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 248, 220, 1)';
    ctx.beginPath();   // brilho em cruz
    ctx.moveTo(x, y - s * 2.6); ctx.lineTo(x + s * .35, y); ctx.lineTo(x, y + s * 2.6); ctx.lineTo(x - s * .35, y); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - s * 2.6, y); ctx.lineTo(x, y + s * .35); ctx.lineTo(x + s * 2.6, y); ctx.lineTo(x, y - s * .35); ctx.closePath(); ctx.fill();
  }
  function quadro(agora) {
    requestAnimationFrame(quadro);
    if (document.hidden) { ultimo = agora; return; }
    var dt = Math.min(.05, (agora - ultimo) / 1000), t = (agora - t0) / 1000;
    ultimo = agora;
    buscar(agora);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    if (alvos.nome) {
      if (Math.random() < dt * 12) faisca(alvos.nome);
      for (var q = 0; q < 2; q++) if (Math.random() < dt * 22) poeira(alvos.nome);
    }
    if (alvos.retrato && Math.random() < dt * 22) po(alvos.retrato, 'retrato');
    if (alvos.mochila && Math.random() < dt * 5) {
      var m = alvos.mochila;
      po({ left: m.left + m.width * .55, top: m.top - 70, width: m.width * .45, height: 60 }, 'mochila');
    }
    desenharChamas(t, dt);

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.vida += dt;
      if (p.vida >= p.max) { parts.splice(i, 1); continue; }
      var k = p.vida / p.max, a = Math.sin(Math.PI * k);
      if (p.tipo === 'faisca') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        estrela(p.x, p.y, p.tam * (.6 + .4 * Math.sin(k * Math.PI)), a * (.8 + .2 * Math.sin(t * 3 + i)));
      } else if (p.tipo === 'po') {
        p.x += (p.vx + Math.sin(t * 1.5 + p.fase) * 8) * dt; p.y += p.vy * dt;
        var c = p.cor, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.tam * 4);
        ctx.globalAlpha = a * .9;
        g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',1)');
        g.addColorStop(.3, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',.45)');
        g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.tam * 4, 0, Math.PI * 2); ctx.fill();
      } else if (p.tipo === 'golpe') {
        p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p['herói'] ? 'rgba(255, 90, 70, 1)' : 'rgba(255, ' + Math.round(220 - 120 * k) + ', 80, 1)';
        ctx.lineWidth = p.tam; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); ctx.stroke();
      } else if (p.tipo === 'poeira') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = a * (.75 + .25 * Math.sin(t * 2.5 + p.fase));
        ctx.fillStyle = 'rgba(255, 214, 120, 1)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.tam, 0, Math.PI * 2); ctx.fill();
      } else {
        p.x += (p.vx + Math.sin(t * 6 + p.fase) * 10) * dt; p.y += p.vy * dt;
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(255, ' + Math.round(200 - 90 * k) + ', 60, 1)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.tam, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
