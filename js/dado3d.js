// Tanka — D20 em 3D (Three.js) para a Arena: dado de resina com números gravados, com sombra suave no chão.
// Gira, cai na mesa, quica e para com o resultado virado para a câmera.
// Carrega o Three.js só quando a Arena precisa. Sem WebGL (ou sem internet), o jogo usa o D20 em SVG.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.dado3d = (function () {
  var URL_THREE = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var carregando = null;

  // Cada skin: cor do meio e da borda das faces, os 3 tons do número (claro, meio, escuro),
  // brilho próprio dos números (obsidiana) e se a resina é metálica (ouro).
  var SKINS = {
    vermelho: { meio: '#a8141c', borda: '#3a0306', veio: 'rgba(255,140,120,.08)', numero: ['#fff3b8', '#f0b83a', '#a46a0c'], brilhoNumero: 0, metal: 0 },
    azul: { meio: '#3a8cff', borda: '#061f55', veio: 'rgba(180,220,255,.12)', numero: ['#ffffff', '#d3dceb', '#7f8ba0'], brilhoNumero: 0, metal: 0 },
    dourada: { meio: '#ffd76a', borda: '#7a4c05', veio: 'rgba(255,250,210,.16)', numero: ['#6a3c00', '#3d2100', '#1c0e00'], brilhoNumero: 0, metal: 0.55 },
    obsidiana: { meio: '#3d3550', borda: '#050408', veio: 'rgba(170,130,255,.10)', numero: ['#f3e2ff', '#b98cff', '#6236c8'], brilhoNumero: 0.55, metal: 0.1 },
  };

  function carregar() {
    if (window.THREE) return Promise.resolve(true);
    if (carregando) return carregando;
    carregando = new Promise(function (ok) {
      var s = document.createElement('script');
      s.src = URL_THREE;
      s.onload = function () { ok(!!window.THREE); };
      s.onerror = function () { ok(false); };
      document.head.appendChild(s);
    });
    return carregando;
  }

  function temWebgl() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; }
  }

  function sorteio(semente) {
    return function () { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
  }

  // Três texturas com a mesma arrumação (uma célula triangular por face):
  // cor (resina + número dourado), relevo (número afundado) e máscara do número (para ele brilhar).
  var COLS = 5, LINHAS = 4, TAM = 2048;
  function texturas(T, skin) {
    var cor = SKINS[skin] || SKINS.vermelho;
    var cw = TAM / COLS, ch = TAM / LINHAS, rnd = sorteio(7);
    function tela() { var c = document.createElement('canvas'); c.width = c.height = TAM; return c; }
    var cCor = tela(), cRel = tela(), cMas = tela();
    var g = cCor.getContext('2d'), r = cRel.getContext('2d'), k = cMas.getContext('2d');
    r.fillStyle = '#fff'; r.fillRect(0, 0, TAM, TAM);
    k.fillStyle = '#000'; k.fillRect(0, 0, TAM, TAM);
    for (var i = 0; i < 20; i++) {
      var x0 = (i % COLS) * cw, y0 = Math.floor(i / COLS) * ch;
      var ax = x0 + cw * 0.5, ay = y0 + ch * 0.08, bx = x0 + cw * 0.08, by = y0 + ch * 0.88, cx = x0 + cw * 0.92, cy = by;
      var mx = (ax + bx + cx) / 3, my = (ay + by + cy) / 3;
      // resina: mais clara no meio (a luz atravessa), escura nas bordas
      var fundo = g.createRadialGradient(mx, my + ch * 0.05, ch * 0.05, mx, my, ch * 0.62);
      fundo.addColorStop(0, cor.meio); fundo.addColorStop(1, cor.borda);
      g.fillStyle = fundo; g.fillRect(x0, y0, cw, ch);
      // veios da resina
      g.save(); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath(); g.clip();
      g.strokeStyle = cor.veio; g.lineCap = 'round';
      for (var v = 0; v < 7; v++) {
        g.lineWidth = 6 + rnd() * 26;
        g.beginPath();
        g.moveTo(x0 + rnd() * cw, y0 + rnd() * ch);
        g.bezierCurveTo(x0 + rnd() * cw, y0 + rnd() * ch, x0 + rnd() * cw, y0 + rnd() * ch, x0 + rnd() * cw, y0 + rnd() * ch);
        g.stroke();
      }
      // pontinhos de brilho dentro da resina
      for (var b = 0; b < 26; b++) {
        g.fillStyle = 'rgba(255,255,255,' + (0.05 + rnd() * 0.18) + ')';
        g.beginPath(); g.arc(x0 + rnd() * cw, y0 + rnd() * ch, 1 + rnd() * 3, 0, 7); g.fill();
      }
      g.restore();
      // aresta chanfrada: faixa clara por dentro do triângulo
      g.lineJoin = 'round';
      g.lineWidth = 30; g.strokeStyle = 'rgba(255,255,255,.12)';
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath(); g.stroke();
      g.lineWidth = 7; g.strokeStyle = 'rgba(255,225,200,.5)'; g.stroke();
      // número gravado
      var n = String(i + 1), ny = my + ch * 0.07;
      var fonte = '700 ' + Math.round(ch * (n.length > 1 ? 0.34 : 0.4)) + 'px "Cinzel", "Times New Roman", Georgia, serif';
      [g, r, k].forEach(function (c) { c.font = fonte; c.textAlign = 'center'; c.textBaseline = 'middle'; });
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(n, mx + 5, ny + 6);              // sombra do sulco
      g.lineWidth = 10; g.strokeStyle = 'rgba(30,0,0,.55)'; g.strokeText(n, mx, ny);   // contorno escuro: número legível
      var ouro = g.createLinearGradient(mx, ny - ch * 0.16, mx, ny + ch * 0.16);
      ouro.addColorStop(0, cor.numero[0]); ouro.addColorStop(0.5, cor.numero[1]); ouro.addColorStop(1, cor.numero[2]);
      g.fillStyle = ouro; g.fillText(n, mx, ny);
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText(n, mx, ny);
      r.fillStyle = '#000'; r.fillText(n, mx, ny);
      k.fillStyle = '#fff'; k.fillText(n, mx, ny);
      if (n === '6' || n === '9') {
        var lx = mx - ch * 0.08, ly = ny + ch * 0.17, lw = ch * 0.16, lh = ch * 0.028;
        g.fillStyle = ouro; g.fillRect(lx, ly, lw, lh);
        r.fillStyle = '#000'; r.fillRect(lx, ly, lw, lh);
        k.fillStyle = '#fff'; k.fillRect(lx, ly, lw, lh);
      }
    }
    var mapa = new T.CanvasTexture(cCor); mapa.encoding = T.sRGBEncoding; mapa.anisotropy = 8;
    var relevo = new T.CanvasTexture(cRel); relevo.anisotropy = 8;
    var mascara = new T.CanvasTexture(cMas);
    return { mapa: mapa, relevo: relevo, mascara: mascara };
  }

  // Ambiente para os reflexos (sala escura com luz de vela/janela): deixa a resina brilhante.
  function ambiente(T, renderer) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 256;
    var g = c.getContext('2d');
    var ceu = g.createLinearGradient(0, 0, 0, 256);
    ceu.addColorStop(0, '#5a4636'); ceu.addColorStop(0.5, '#1e140d'); ceu.addColorStop(1, '#0c0705');
    g.fillStyle = ceu; g.fillRect(0, 0, 512, 256);
    [[120, 70, 60, 'rgba(255,225,170,1)'], [330, 60, 40, 'rgba(255,190,120,.9)'], [450, 110, 30, 'rgba(200,220,255,.6)']].forEach(function (l) {
      var luz = g.createRadialGradient(l[0], l[1], 0, l[0], l[1], l[2]);
      luz.addColorStop(0, l[3]); luz.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = luz; g.fillRect(0, 0, 512, 256);
    });
    var tex = new T.CanvasTexture(c);
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.encoding = T.sRGBEncoding;
    var pmrem = new T.PMREMGenerator(renderer);
    var rt = pmrem.fromEquirectangular(tex);
    tex.dispose(); pmrem.dispose();
    return rt;
  }

  function geometria(T) {
    var geo = new T.IcosahedronGeometry(1, 0);
    var pos = geo.attributes.position, uv = [];
    var cw = 1 / COLS, ch = 1 / LINHAS;
    for (var i = 0; i < 20; i++) {
      var u0 = (i % COLS) * cw, v0 = 1 - (Math.floor(i / COLS) + 1) * ch;
      uv.push(u0 + cw * 0.5, v0 + ch * 0.92, u0 + cw * 0.08, v0 + ch * 0.12, u0 + cw * 0.92, v0 + ch * 0.12);
    }
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    // Para cada face: a rotação que deixa o número dela de frente e em pé.
    var alvos = [];
    for (var f = 0; f < 20; f++) {
      var a = new T.Vector3().fromBufferAttribute(pos, f * 3), b = new T.Vector3().fromBufferAttribute(pos, f * 3 + 1), c = new T.Vector3().fromBufferAttribute(pos, f * 3 + 2);
      var centro = a.clone().add(b).add(c).divideScalar(3);
      var normal = centro.clone().normalize();
      var cima = a.clone().sub(centro); cima.sub(normal.clone().multiplyScalar(cima.dot(normal))).normalize();
      var lado = cima.clone().cross(normal);
      var m = new T.Matrix4().makeBasis(lado, cima, normal);
      alvos.push(new T.Quaternion().setFromRotationMatrix(m).invert());
    }
    return { geo: geo, alvos: alvos };
  }

  // Cria o dado dentro de `onde`. Retorna { parado(n), cair(lado), pousar(n, aoFim), brilho(tipo), destruir() }.
  function criar(onde, skin) {
    var T = window.THREE, cor = SKINS[skin] || SKINS.vermelho;
    var largura = onde.clientWidth || 360, altura = onde.clientHeight || 250;
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(largura, altura);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = 'dado3d-canvas';
    onde.appendChild(renderer.domElement);

    var cena = new T.Scene();
    var env = ambiente(T, renderer);
    cena.environment = env.texture;

    // Câmera um pouco acima, olhando a mesa de cima para baixo (como no vídeo de referência).
    var cam = new T.PerspectiveCamera(30, largura / altura, 0.1, 60);
    cam.position.set(0, 2.6, 6.6);
    cam.lookAt(0, -0.25, 0);
    var inclinacao = Math.atan2(2.6 + 0.25, 6.6);

    cena.add(new T.HemisphereLight(0xffe8cc, 0x2a160a, 0.45));
    var chave = new T.DirectionalLight(0xfff0dd, 1.6);
    chave.position.set(-3, 7, 3);
    cena.add(chave);
    var contra = new T.PointLight(0xffb070, 0.9, 14); contra.position.set(3.5, 1.5, -2.5); cena.add(contra);
    var aura = new T.PointLight(0xffc040, 0, 6); aura.position.set(0, 0.6, 1.4); cena.add(aura);

    // Sombra suave no chão (o fundo é o painel da interface): fica maior e mais clara quando o dado sobe.
    var cSombra = document.createElement('canvas'); cSombra.width = cSombra.height = 128;
    var gs = cSombra.getContext('2d'), rs = gs.createRadialGradient(64, 64, 0, 64, 64, 64);
    rs.addColorStop(0, 'rgba(0,0,0,.85)'); rs.addColorStop(0.45, 'rgba(0,0,0,.45)'); rs.addColorStop(1, 'rgba(0,0,0,0)');
    gs.fillStyle = rs; gs.fillRect(0, 0, 128, 128);
    var mesa = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cSombra), transparent: true, depthWrite: false }));
    mesa.rotation.x = -Math.PI / 2;
    mesa.position.y = -1.0;
    cena.add(mesa);

    var G = geometria(T), tex = texturas(T, skin);
    var material = new T.MeshPhysicalMaterial({
      map: tex.mapa, bumpMap: tex.relevo, bumpScale: 0.025, emissiveMap: tex.mascara, emissive: new T.Color(0, 0, 0),
      roughness: 0.14, metalness: cor.metal, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.25, flatShading: true,
    });
    var pivo = new T.Group();                  // vira o dado para a câmera
    pivo.rotation.x = -inclinacao;
    var dado = new T.Mesh(G.geo, material);
    pivo.add(dado);
    cena.add(pivo);
    var corNumero = new T.Color(cor.numero[1]);

    // Auréola dourada atrás do dado (crítico e 20 natural).
    var cHalo = document.createElement('canvas'); cHalo.width = cHalo.height = 256;
    var gh = cHalo.getContext('2d'), rad = gh.createRadialGradient(128, 128, 0, 128, 128, 128);
    rad.addColorStop(0, 'rgba(255,240,180,1)'); rad.addColorStop(0.25, 'rgba(255,190,60,.75)'); rad.addColorStop(1, 'rgba(255,120,0,0)');
    gh.fillStyle = rad; gh.fillRect(0, 0, 256, 256);
    for (var raio = 0; raio < 18; raio++) {
      gh.save(); gh.translate(128, 128); gh.rotate(raio / 18 * Math.PI * 2);
      var fr = gh.createLinearGradient(0, 0, 128, 0); fr.addColorStop(0, 'rgba(255,230,140,.7)'); fr.addColorStop(1, 'rgba(255,200,80,0)');
      gh.fillStyle = fr; gh.beginPath(); gh.moveTo(0, -3); gh.lineTo(128, -9); gh.lineTo(128, 9); gh.lineTo(0, 3); gh.fill(); gh.restore();
    }
    var halo = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cHalo), blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    halo.scale.set(4.2, 4.2, 1);
    halo.position.set(0, 0.1, -1.4);
    cena.add(halo);

    var estado = { modo: 'parado', inicio: 0, alvo: G.alvos[19].clone(), de: new T.Quaternion(), giro: new T.Vector3(1.3, 2.1, 0.7), aoFim: null, brilho: null, lado: 1 };
    var rodando = true, antes = performance.now();
    var balanco = new T.Quaternion(), euler = new T.Euler();

    function quadro(agora) {
      if (!rodando) return;
      var t = agora / 1000, dt = Math.min(0.05, (agora - antes) / 1000);
      antes = agora;
      if (estado.modo === 'parado') {
        pivo.position.set(0, 0.12 + Math.sin(t * 2) * 0.08, 0);
        balanco.setFromEuler(euler.set(Math.sin(t * 1.4) * 0.14, Math.sin(t * 1.1) * 0.2, 0));
        var alvoAgora = estado.alvo.clone().premultiply(balanco);
        dado.quaternion.slerp(alvoAgora, 1 - Math.exp(-dt * 7));
      } else if (estado.modo === 'caindo') {
        var ms = agora - estado.inicio, k = Math.min(1, ms / 450);
        var x = (1 - k) * -2.6 * estado.lado, z = (1 - k) * -1.5;
        var y = 3.4 * (1 - k * k);
        if (k >= 1) y = Math.abs(Math.sin((ms - 450) / 130)) * 0.55 * Math.max(0, 1 - (ms - 450) / 700);
        pivo.position.set(x, y, z);
        dado.quaternion.setFromEuler(euler.set(t * estado.giro.x * 7, t * estado.giro.y * 7, t * estado.giro.z * 7));
      } else if (estado.modo === 'pousando') {
        var p = Math.min(1, (agora - estado.inicio) / 750);
        var e = 1 - Math.pow(1 - p, 3);
        dado.quaternion.copy(estado.de).slerp(estado.alvo, e);
        pivo.position.set(0, Math.abs(Math.sin(p * Math.PI * 2)) * 0.4 * (1 - p), 0);
        if (p >= 1) {
          estado.modo = 'pousou';
          pivo.position.set(0, 0, 0);
          if (estado.aoFim) { var fn = estado.aoFim; estado.aoFim = null; fn(); }
        }
      }
      // Números: brilho próprio (obsidiana) ou pulsando no crítico / 20 natural.
      if (estado.brilho) {
        var pulso = 0.6 + 0.4 * Math.sin(t * 6);
        material.emissive.setRGB(estado.brilho[0] * pulso, estado.brilho[1] * pulso, estado.brilho[2] * pulso);
        aura.intensity = estado.brilho[3] * pulso;
        halo.material.opacity = Math.min(1, estado.brilho[3] / 2.2) * (0.75 + 0.25 * pulso);
        halo.material.rotation = t * 0.6;
      } else {
        halo.material.opacity = 0;
        material.emissive.copy(corNumero).multiplyScalar(cor.brilhoNumero);
        aura.intensity = 0;
      }
      var altura = Math.max(0, pivo.position.y);
      mesa.position.x = pivo.position.x; mesa.position.z = pivo.position.z;
      mesa.scale.setScalar(2.3 * (1 + altura * 0.35));
      mesa.material.opacity = 0.75 / (1 + altura * 0.8);
      renderer.render(cena, cam);
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);

    // A mesa muda de largura com a tela (celular, janela redimensionada).
    var observador = window.ResizeObserver ? new ResizeObserver(function () {
      var w = onde.clientWidth, h = onde.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }) : null;
    if (observador) observador.observe(onde);

    return {
      parado: function (n) { estado.modo = 'parado'; estado.alvo = G.alvos[(n || 20) - 1]; estado.brilho = null; },
      cair: function (lado) {
        estado.modo = 'caindo'; estado.inicio = performance.now(); estado.lado = lado || 1; estado.brilho = null;
        estado.giro.set(0.8 + Math.random(), 0.8 + Math.random(), 0.3 + Math.random() * 0.6);
      },
      pousar: function (n, aoFim) {
        estado.de.copy(dado.quaternion);
        estado.alvo = G.alvos[n - 1];
        estado.inicio = performance.now();
        estado.aoFim = aoFim || null;
        estado.modo = 'pousando';
      },
      // 'ouro' (20 natural), 'critico' (18-19), 'falha' (1) ou null. [r, g, b, luz em volta]
      brilho: function (tipo) {
        estado.brilho = tipo === 'ouro' ? [2.2, 1.4, 0.25, 2.2] : tipo === 'critico' ? [1.2, 0.8, 0.15, 0.9] : null;
        var c = tipo === 'falha' ? 0.4 : 1;
        material.color.setRGB(c, c, c * 1.05);
      },
      destruir: function () {
        rodando = false;
        if (observador) observador.disconnect();
        [tex.mapa, tex.relevo, tex.mascara, halo.material.map].forEach(function (x) { x.dispose(); });
        material.dispose(); halo.material.dispose(); mesa.material.map.dispose(); mesa.material.dispose(); mesa.geometry.dispose(); G.geo.dispose(); env.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      },
    };
  }

  return { carregar: carregar, temWebgl: temWebgl, criar: criar };
})();
