// Tanka — D20 em 3D (Three.js) para a Arena: dado de joia com os 20 números, que gira, cai na mesa e
// para com o resultado virado para a tela. Carrega o Three.js só quando a Arena precisa.
// Sem WebGL (ou sem internet para o Three.js), o jogo usa o D20 desenhado em SVG.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.dado3d = (function () {
  var URL_THREE = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var carregando = null;

  // Cores de cada skin: face (centro e borda do degradê), número e brilho.
  var SKINS = {
    vermelho: { a: '#ff4a4f', b: '#9e0d14', numero: '#ffffff', sombraNumero: 'rgba(90,0,0,.6)', aresta: 'rgba(255,220,220,.55)' },
    azul: { a: '#4f9dff', b: '#0f3a92', numero: '#ffffff', sombraNumero: 'rgba(0,20,80,.6)', aresta: 'rgba(210,230,255,.55)' },
    dourada: { a: '#ffe08a', b: '#b8770e', numero: '#3a2400', sombraNumero: 'rgba(255,240,200,.5)', aresta: 'rgba(255,250,220,.7)' },
    obsidiana: { a: '#4a4258', b: '#0c0a12', numero: '#d4b0ff', sombraNumero: 'rgba(140,80,255,.8)', aresta: 'rgba(190,150,255,.5)' },
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

  // Textura com os 20 números (uma célula triangular por face).
  var COLS = 5, LINHAS = 4, TAM = 1024;
  function textura(T, skin) {
    var cor = SKINS[skin] || SKINS.vermelho;
    var c = document.createElement('canvas'); c.width = c.height = TAM;
    var g = c.getContext('2d');
    var cw = TAM / COLS, ch = TAM / LINHAS;
    for (var i = 0; i < 20; i++) {
      var x0 = (i % COLS) * cw, y0 = Math.floor(i / COLS) * ch;
      // triângulo da face (mesma forma das coordenadas UV abaixo; o canvas tem y para baixo)
      var ax = x0 + cw * 0.5, ay = y0 + ch * 0.08, bx = x0 + cw * 0.08, by = y0 + ch * 0.88, cx = x0 + cw * 0.92, cy = by;
      var grad = g.createLinearGradient(ax, ay, ax, by);
      grad.addColorStop(0, cor.a); grad.addColorStop(1, cor.b);
      g.fillStyle = grad;
      g.fillRect(x0, y0, cw, ch);
      // brilho de joia no alto da face
      var luz = g.createRadialGradient(ax - cw * 0.1, ay + ch * 0.25, 2, ax, ay + ch * 0.35, cw * 0.55);
      luz.addColorStop(0, 'rgba(255,255,255,.35)'); luz.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = luz; g.fillRect(x0, y0, cw, ch);
      g.lineWidth = 5; g.strokeStyle = cor.aresta;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath(); g.stroke();
      var n = String(i + 1), mx = (ax + bx + cx) / 3, my = (ay + by + cy) / 3 + ch * 0.07;
      g.font = '900 ' + Math.round(ch * (n.length > 1 ? 0.3 : 0.36)) + 'px "Arial Black", Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = cor.sombraNumero; g.strokeText(n, mx, my);
      g.fillStyle = cor.numero; g.fillText(n, mx, my);
      if (n === '6' || n === '9') { g.fillRect(mx - ch * 0.08, my + ch * 0.16, ch * 0.16, ch * 0.03); }
    }
    var t = new T.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
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

  // Cria o dado dentro de `onde`. Retorna { parado(n), cair(), pousar(n, aoFim), brilho(tipo), destruir() }.
  function criar(onde, skin) {
    var T = window.THREE;
    var largura = onde.clientWidth || 360, altura = onde.clientHeight || 240;
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(largura, altura);
    renderer.domElement.className = 'dado3d-canvas';
    onde.appendChild(renderer.domElement);
    var cena = new T.Scene();
    var cam = new T.PerspectiveCamera(32, largura / altura, 0.1, 100);
    cam.position.set(0, 0, 6.2);
    cena.add(new T.AmbientLight(0xffffff, 0.55));
    var chave = new T.DirectionalLight(0xffffff, 0.85); chave.position.set(-4, 6, 2); cena.add(chave);
    var contra = new T.PointLight(0xffd9a0, 0.7, 20); contra.position.set(3, -2, 4); cena.add(contra);
    var G = geometria(T);
    var material = new T.MeshPhongMaterial({ map: textura(T, skin), shininess: 70, specular: 0x555555, flatShading: true, transparent: true, opacity: 0.97 });
    var dado = new T.Mesh(G.geo, material);
    dado.scale.setScalar(1.05);
    cena.add(dado);

    var estado = { modo: 'parado', inicio: 0, alvo: null, de: new T.Quaternion(), giro: new T.Vector3(1.3, 2.1, 0.7), aoFim: null, brilho: null };
    var rodando = true;
    function quadro(agora) {
      if (!rodando) return;
      var t = agora / 1000;
      if (estado.modo === 'parado') {
        dado.position.set(0, Math.sin(t * 2) * 0.08, 0);
        if (estado.alvo) dado.quaternion.copy(estado.alvo).multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.sin(t * 1.4) * 0.18, Math.sin(t * 1.1) * 0.25, 0)));
      } else if (estado.modo === 'caindo') {
        var k = Math.min(1, (agora - estado.inicio) / 650);
        dado.position.set((1 - k) * -1.4 * estado.lado, 3.2 * (1 - k * k) - 0.0, 0);
        var q = new T.Quaternion().setFromEuler(new T.Euler(t * estado.giro.x * 6, t * estado.giro.y * 6, t * estado.giro.z * 6));
        dado.quaternion.copy(q);
        if (k >= 1) dado.position.y = Math.abs(Math.sin((agora - estado.inicio) / 160)) * 0.35 * Math.max(0, 1 - (agora - estado.inicio - 650) / 900);
      } else if (estado.modo === 'pousando') {
        var p = Math.min(1, (agora - estado.inicio) / 750);
        var e = 1 - Math.pow(1 - p, 3);
        dado.quaternion.copy(estado.de).slerp(estado.alvo, e);
        dado.position.set(0, Math.abs(Math.sin(p * Math.PI * 2)) * 0.45 * (1 - p), 0);
        if (p >= 1) {
          estado.modo = 'pousou';
          dado.position.set(0, 0, 0);
          if (estado.aoFim) { var fn = estado.aoFim; estado.aoFim = null; fn(); }
        }
      }
      if (estado.brilho) {
        var pulso = 0.5 + 0.5 * Math.sin(t * 7);
        material.emissive.setRGB(estado.brilho[0] * pulso, estado.brilho[1] * pulso, estado.brilho[2] * pulso);
      } else material.emissive.setRGB(0, 0, 0);
      renderer.render(cena, cam);
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);

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
      // 'ouro' (20 natural), 'critico' (18-19), 'falha' (1) ou null
      brilho: function (tipo) {
        estado.brilho = tipo === 'ouro' ? [0.55, 0.38, 0.02] : tipo === 'critico' ? [0.35, 0.25, 0.02] : null;
        material.color.setRGB(tipo === 'falha' ? 0.45 : 1, tipo === 'falha' ? 0.45 : 1, tipo === 'falha' ? 0.48 : 1);
      },
      destruir: function () { rodando = false; renderer.dispose(); material.map.dispose(); material.dispose(); G.geo.dispose(); renderer.domElement.remove(); },
    };
  }

  return { carregar: carregar, temWebgl: temWebgl, criar: criar };
})();
