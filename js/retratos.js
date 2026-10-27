// Tanka — retratos em SVG (rosto + busto) para cada combinação raça × classe,
// e ilustrações dos monstros que ainda não têm imagem própria.
var Tanka = typeof Tanka !== 'undefined' ? Tanka : {};

Tanka.retratos = (function () {
  var contador = 0;

  var RACA = {
    humano:    { pele: '#d9a982', sombra: '#b07f5c', cabelo: '#4a2f1c', olho: '#5a3b1e', orelha: 'redonda', cabeloTipo: 'curto', bravo: false },
    elfo:      { pele: '#f0d6c2', sombra: '#cfae98', cabelo: '#e6dfc8', olho: '#3f8f5a', orelha: 'elfica', cabeloTipo: 'longo', bravo: false },
    elfoNegro: { pele: '#646a8c', sombra: '#474c6b', cabelo: '#e9e9f2', olho: '#b04aa0', orelha: 'elfica', cabeloTipo: 'longo', bravo: true },
    orc:       { pele: '#6f8c4a', sombra: '#516b33', cabelo: '#1c1714', olho: '#e0b022', orelha: 'orc', cabeloTipo: 'coque', bravo: true },
    anao:      { pele: '#d69a72', sombra: '#ad7552', cabelo: '#9a4a1e', olho: '#3b6fa8', orelha: 'redonda', cabeloTipo: 'curto', bravo: false, barba: true },
  };

  var CLASSE = {
    cavaleiro: { fundo: ['#4a5568', '#141820'] },
    arqueiro:  { fundo: ['#3d5a35', '#10180f'] },
    mago:      { fundo: ['#4b3a7a', '#120d22'] },
    artesao:   { fundo: ['#7a5230', '#1c120a'] },
    nenhuma:   { fundo: ['#3a4250', '#11141a'] },
  };

  function cabeloAtras(r) {
    if (r.cabeloTipo === 'longo') {
      return '<path d="M56 104 Q50 42 100 46 Q150 42 144 104 L154 210 L130 180 L70 180 L46 210 Z" fill="' + r.cabelo + '"/>';
    }
    if (r.cabeloTipo === 'coque') {
      return '<ellipse cx="100" cy="52" rx="13" ry="11" fill="' + r.cabelo + '"/>'
        + '<rect x="95" y="58" width="10" height="10" fill="#6b4a2a"/>';
    }
    return '<path d="M60 112 Q54 46 100 50 Q146 46 140 112 L140 124 L60 124 Z" fill="' + r.cabelo + '"/>';
  }

  function cabeloFrente(r) {
    if (r.cabeloTipo === 'longo') {
      return '<path d="M64 108 Q58 56 100 60 Q142 56 136 108 Q128 74 102 68 L100 76 L98 68 Q72 74 64 108 Z" fill="' + r.cabelo + '"/>'
        + '<path d="M62 100 Q60 140 56 170 L66 168 Q66 130 68 104 Z" fill="' + r.cabelo + '"/>'
        + '<path d="M138 100 Q140 140 144 170 L134 168 Q134 130 132 104 Z" fill="' + r.cabelo + '"/>';
    }
    if (r.cabeloTipo === 'coque') {
      return '<path d="M66 92 Q72 64 100 62 Q128 64 134 92 Q118 76 100 76 Q82 76 66 92 Z" fill="' + r.cabelo + '" opacity=".85"/>';
    }
    return '<path d="M64 100 Q60 56 100 60 Q140 56 136 100 Q130 78 112 76 Q100 84 86 76 Q70 80 64 100 Z" fill="' + r.cabelo + '"/>';
  }

  function orelhas(r) {
    if (r.orelha === 'elfica') {
      return '<path d="M68 98 L36 70 L66 122 Z" fill="' + r.pele + '" stroke="' + r.sombra + '" stroke-width="1.5"/>'
        + '<path d="M132 98 L164 70 L134 122 Z" fill="' + r.pele + '" stroke="' + r.sombra + '" stroke-width="1.5"/>';
    }
    if (r.orelha === 'orc') {
      return '<path d="M68 98 L48 86 L66 120 Z" fill="' + r.pele + '" stroke="' + r.sombra + '" stroke-width="1.5"/>'
        + '<path d="M132 98 L152 86 L134 120 Z" fill="' + r.pele + '" stroke="' + r.sombra + '" stroke-width="1.5"/>';
    }
    return '<ellipse cx="66" cy="108" rx="6" ry="10" fill="' + r.pele + '" stroke="' + r.sombra + '" stroke-width="1.5"/>'
      + '<ellipse cx="134" cy="108" rx="6" ry="10" fill="' + r.pele + '" stroke="' + r.sombra + '" stroke-width="1.5"/>';
  }

  function rosto(r, raca) {
    var s = '';
    s += '<rect x="87" y="132" width="26" height="34" fill="' + r.sombra + '"/>';
    s += '<ellipse cx="100" cy="106" rx="34" ry="42" fill="' + r.pele + '"/>';
    s += '<path d="M70 120 Q100 156 130 120 Q126 146 100 148 Q74 146 70 120 Z" fill="' + r.sombra + '" opacity=".35"/>';
    // sobrancelhas
    var sob = r.bravo
      ? '<path d="M76 90 L95 98" /><path d="M124 90 L105 98" />'
      : '<path d="M77 93 Q86 89 95 94" /><path d="M123 93 Q114 89 105 94" />';
    s += '<g stroke="' + (raca === 'elfoNegro' ? '#d8d8e6' : r.cabelo) + '" stroke-width="3.5" stroke-linecap="round" fill="none">' + sob + '</g>';
    // olhos
    [86, 114].forEach(function (x) {
      s += '<ellipse cx="' + x + '" cy="104" rx="7" ry="3.8" fill="#f4efe6"/>';
      s += '<circle cx="' + x + '" cy="104" r="3" fill="' + r.olho + '"/>';
      s += '<circle cx="' + x + '" cy="104" r="1.3" fill="#111"/>';
    });
    // nariz e boca
    s += '<path d="M100 106 L95 121 Q100 124 105 121" fill="none" stroke="' + r.sombra + '" stroke-width="2" stroke-linecap="round"/>';
    s += r.labios
      ? '<path d="M91 131 Q100 127 109 131 Q100 137 91 131 Z" fill="#9a4048"/>'
      : '<path d="M90 132 Q100 ' + (r.bravo ? '129' : '135') + ' 110 132" fill="none" stroke="#5a2e26" stroke-width="2.4" stroke-linecap="round"/>';
    if (raca === 'orc') {
      s += '<path d="M90 133 L92 120 L95 133 Z" fill="#f2ead2"/><path d="M110 133 L108 120 L105 133 Z" fill="#f2ead2"/>';
      s += '<path d="M112 84 L120 112" stroke="#3a4a26" stroke-width="2" opacity=".7"/>';
    }
    if (r.barba) {
      s += '<path d="M66 110 Q64 178 100 194 Q136 178 134 110 Q128 140 100 140 Q72 140 66 110 Z" fill="' + r.cabelo + '"/>';
      s += '<path d="M84 128 Q100 120 116 128 Q108 134 100 130 Q92 134 84 128 Z" fill="#7d3a16"/>';
      s += '<path d="M92 160 L100 186 L108 160" fill="none" stroke="#7d3a16" stroke-width="2"/>';
    }
    return s;
  }

  function busto(classe, id) {
    switch (classe) {
      case 'cavaleiro':
        return '<defs><linearGradient id="aco' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ced6"/><stop offset="1" stop-color="#5d6470"/></linearGradient></defs>'
          + '<path d="M18 240 Q22 178 72 166 L128 166 Q178 178 182 240 Z" fill="url(#aco' + id + ')"/>'
          + '<ellipse cx="44" cy="194" rx="34" ry="22" fill="url(#aco' + id + ')" stroke="#3b414b" stroke-width="2"/>'
          + '<ellipse cx="156" cy="194" rx="34" ry="22" fill="url(#aco' + id + ')" stroke="#3b414b" stroke-width="2"/>'
          + '<path d="M80 160 L120 160 L126 176 L74 176 Z" fill="#8f96a2" stroke="#3b414b" stroke-width="2"/>'
          + '<path d="M100 186 L116 192 L114 214 Q108 226 100 230 Q92 226 86 214 L84 192 Z" fill="#b8913c" stroke="#5c4510" stroke-width="2"/>'
          + '<path d="M100 194 L100 222 M90 204 L110 204" stroke="#5c4510" stroke-width="2.5"/>';
      case 'arqueiro':
        return '<path d="M156 212 Q178 150 150 94" fill="none" stroke="#6b4a28" stroke-width="5" stroke-linecap="round"/>'
          + '<path d="M18 240 Q22 178 72 166 L128 166 Q178 178 182 240 Z" fill="#3e5a34"/>'
          + '<path d="M72 166 L100 206 L128 166 Z" fill="#6e4a2a"/>'
          + '<path d="M80 166 L100 196 L120 166" fill="none" stroke="#c9a96b" stroke-width="2"/>'
          + '<path d="M52 176 L150 240" stroke="#5a3a1e" stroke-width="10"/>'
          + '<g stroke="#d8c8a0" stroke-width="2"><path d="M140 176 L160 128"/><path d="M148 180 L170 136"/></g>'
          + '<g fill="#a33a2a"><path d="M160 128 L154 136 L162 140 Z"/><path d="M170 136 L164 144 L172 148 Z"/></g>';
      case 'mago':
        return '<path d="M18 240 Q22 178 72 166 L128 166 Q178 178 182 240 Z" fill="#3a2a6a"/>'
          + '<path d="M60 172 L80 140 L100 168 L120 140 L140 172 L120 182 L100 176 L80 182 Z" fill="#2a1d52" stroke="#b49be6" stroke-width="1.5"/>'
          + '<path d="M100 176 L100 240" stroke="#b49be6" stroke-width="2"/>'
          + '<circle cx="100" cy="200" r="9" fill="#5fe0f0" stroke="#d6c38a" stroke-width="3"/>'
          + '<circle cx="100" cy="200" r="16" fill="#5fe0f0" opacity=".18"/>';
      case 'artesao':
        return '<g><rect x="160" y="128" width="8" height="112" fill="#6b4a28" transform="rotate(14 164 184)"/>'
          + '<rect x="150" y="112" width="40" height="24" rx="3" fill="#80878f" stroke="#3b414b" stroke-width="2" transform="rotate(14 170 124)"/></g>'
          + '<path d="M18 240 Q22 178 72 166 L128 166 Q178 178 182 240 Z" fill="#8a6440"/>'
          + '<path d="M66 240 L68 190 Q100 180 132 190 L134 240 Z" fill="#4e331d"/>'
          + '<path d="M70 190 L56 168 M130 190 L144 168" stroke="#4e331d" stroke-width="6"/>'
          + '<rect x="88" y="206" width="24" height="16" rx="2" fill="none" stroke="#c9a96b" stroke-width="2"/>';
      default:
        return '<path d="M18 240 Q22 178 72 166 L128 166 Q178 178 182 240 Z" fill="#4a4f5c"/>'
          + '<path d="M78 166 L100 190 L122 166" fill="none" stroke="#8a8f9c" stroke-width="3"/>';
    }
  }

  function chapeu(classe) {
    if (classe === 'mago') {
      return '<path d="M56 78 Q90 60 104 4 Q112 40 144 78 Z" fill="#3a2a6a" stroke="#b49be6" stroke-width="1.5"/>'
        + '<ellipse cx="100" cy="78" rx="52" ry="10" fill="#2a1d52" stroke="#b49be6" stroke-width="1.5"/>'
        + '<path d="M70 70 Q100 62 132 70" stroke="#d6c38a" stroke-width="4" fill="none"/>';
    }
    if (classe === 'artesao') {
      return '<path d="M64 84 Q100 74 136 84" stroke="#3b2a1a" stroke-width="6" fill="none"/>'
        + '<circle cx="86" cy="80" r="9" fill="#9fd0d8" stroke="#6b4a28" stroke-width="3"/>'
        + '<circle cx="114" cy="80" r="9" fill="#9fd0d8" stroke="#6b4a28" stroke-width="3"/>';
    }
    if (classe === 'cavaleiro') {
      return '<path d="M68 82 Q100 70 132 82" stroke="#b8913c" stroke-width="4" fill="none"/>'
        + '<circle cx="100" cy="75" r="4" fill="#c0392b" stroke="#5c4510" stroke-width="1.5"/>';
    }
    if (classe === 'arqueiro') {
      return '<path d="M134 84 Q150 62 146 40" stroke="#2f4a28" stroke-width="5" fill="none" stroke-linecap="round"/>';
    }
    return '';
  }

  // Retrato completo de um personagem (rosto + busto) como string SVG.
  // Versão feminina do desenho: cabelo longo, sem barba, lábios marcados.
  function feminina(r) {
    return Object.assign({}, r, {
      barba: false,
      cabeloTipo: r.cabeloTipo === 'curto' ? 'longo' : r.cabeloTipo,
      labios: true,
    });
  }

  // Retrato desenhado em SVG (usado quando não há arte pintada).
  function desenho(raca, classe, sexo) {
    var id = 'r' + (++contador);
    var r = sexo === 'feminino' ? feminina(RACA[raca]) : RACA[raca];
    var c = CLASSE[classe] || CLASSE.nenhuma;
    return '<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" role="img" class="retrato-svg" preserveAspectRatio="xMidYMid slice">'
      + '<defs><radialGradient id="f' + id + '" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="' + c.fundo[0] + '"/><stop offset="1" stop-color="' + c.fundo[1] + '"/></radialGradient></defs>'
      + '<rect width="200" height="240" fill="url(#f' + id + ')"/>'
      + cabeloAtras(r) + busto(classe, id) + orelhas(r) + rosto(r, raca) + cabeloFrente(r) + chapeu(classe)
      + '</svg>';
  }

  function cobra() {
    var id = 'c' + (++contador);
    var corpo = '';
    [[100, 212, 70, 20], [100, 190, 58, 17], [100, 170, 46, 15]].forEach(function (e) {
      corpo += '<ellipse cx="' + e[0] + '" cy="' + e[1] + '" rx="' + e[2] + '" ry="' + e[3] + '" fill="url(#e' + id + ')" stroke="#1d3a12" stroke-width="2"/>';
    });
    return '<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" role="img" class="retrato-svg" preserveAspectRatio="xMidYMid slice">'
      + '<defs><radialGradient id="f' + id + '" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#2f4a2a"/><stop offset="1" stop-color="#0a120a"/></radialGradient>'
      + '<linearGradient id="e' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc04a"/><stop offset="1" stop-color="#3f6a1e"/></linearGradient>'
      + '<pattern id="p' + id + '" width="10" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 Q5 0 10 4 Q5 8 0 4Z" fill="none" stroke="#2d5216" stroke-width="1"/></pattern></defs>'
      + '<rect width="200" height="240" fill="url(#f' + id + ')"/>'
      + corpo
      + '<path d="M100 166 Q76 130 92 98 L112 98 Q122 132 112 168 Z" fill="url(#e' + id + ')" stroke="#1d3a12" stroke-width="2"/>'
      + '<path d="M100 166 Q76 130 92 98 L112 98 Q122 132 112 168 Z" fill="url(#p' + id + ')"/>'
      + '<path d="M70 70 Q102 34 134 70 Q140 98 102 108 Q64 98 70 70 Z" fill="url(#e' + id + ')" stroke="#1d3a12" stroke-width="2"/>'
      + '<ellipse cx="86" cy="72" rx="8" ry="6" fill="#f2d01e"/><ellipse cx="118" cy="72" rx="8" ry="6" fill="#f2d01e"/>'
      + '<ellipse cx="86" cy="72" rx="1.8" ry="5" fill="#111"/><ellipse cx="118" cy="72" rx="1.8" ry="5" fill="#111"/>'
      + '<path d="M102 106 L102 126 L96 134 M102 126 L108 134" stroke="#c0392b" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
      + '<g fill="#b6f07a" opacity=".75"><path d="M74 96 Q72 108 76 112 Q80 108 74 96Z"/><path d="M128 100 Q126 114 131 118 Q135 112 128 100Z"/><circle cx="60" cy="226" r="4"/><circle cx="146" cy="222" r="3"/></g>'
      + '</svg>';
  }

  function urso() {
    var id = 'u' + (++contador);
    return '<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" role="img" class="retrato-svg" preserveAspectRatio="xMidYMid slice">'
      + '<defs><radialGradient id="f' + id + '" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#4a3424"/><stop offset="1" stop-color="#120b06"/></radialGradient>'
      + '<radialGradient id="p' + id + '" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#7a5232"/><stop offset="1" stop-color="#3e2614"/></radialGradient></defs>'
      + '<rect width="200" height="240" fill="url(#f' + id + ')"/>'
      + '<path d="M10 240 Q20 170 100 160 Q180 170 190 240 Z" fill="#3e2614"/>'
      + '<circle cx="50" cy="62" r="22" fill="#4a2e18"/><circle cx="150" cy="62" r="22" fill="#4a2e18"/>'
      + '<circle cx="50" cy="62" r="11" fill="#2a180c"/><circle cx="150" cy="62" r="11" fill="#2a180c"/>'
      + '<ellipse cx="100" cy="112" rx="66" ry="64" fill="url(#p' + id + ')"/>'
      + '<path d="M60 84 L88 100" stroke="#1a0f08" stroke-width="5" stroke-linecap="round"/><path d="M140 84 L112 100" stroke="#1a0f08" stroke-width="5" stroke-linecap="round"/>'
      + '<circle cx="78" cy="104" r="6" fill="#e0402a"/><circle cx="122" cy="104" r="6" fill="#e0402a"/>'
      + '<circle cx="78" cy="104" r="2.2" fill="#111"/><circle cx="122" cy="104" r="2.2" fill="#111"/>'
      + '<ellipse cx="100" cy="142" rx="34" ry="28" fill="#b08a62"/>'
      + '<ellipse cx="100" cy="126" rx="13" ry="9" fill="#1a0f08"/>'
      + '<path d="M76 150 Q100 182 124 150 Z" fill="#5a1414"/>'
      + '<path d="M80 151 L86 162 L90 152 M110 152 L114 162 L120 151" fill="#f2ead2"/>'
      + '<path d="M84 172 L88 164 L92 172 M108 172 L112 164 L116 172" fill="#f2ead2"/>'
      + '<g stroke="#8a2a1a" stroke-width="2" opacity=".7"><path d="M138 70 L150 96"/><path d="M144 68 L156 92"/></g>'
      + '</svg>';
  }

  var MONSTROS = { cobra: cobra, urso: urso };

  // Arte pintada em assets/personagens/<raca>-<classe>[-f].jpg, ex.: elfonegro-mago-f.jpg.
  // Se o arquivo não existir, o <img> é trocado pelo desenho SVG (ver ouvinte abaixo).
  function personagem(raca, classe, sexo) {
    sexo = sexo || 'masculino';
    var arquivo = 'assets/personagens/' + raca.toLowerCase() + '-' + classe + (sexo === 'feminino' ? '-f' : '') + '.jpg';
    return '<img class="retrato-img" src="' + arquivo + '" alt="" data-raca="' + raca + '" data-classe="' + classe + '" data-sexo="' + sexo + '">';
  }

  // Carta de raça: o retrato de cavaleiro da raça, no sexo escolhido.
  function imagemRaca(raca, sexo) {
    return personagem(raca, 'cavaleiro', sexo);
  }

  function imagemMonstro(id) {
    var m = Tanka.dados.monstros[id];
    if (m.imagem) return '<img class="retrato-img" src="' + m.imagem + '" alt="' + m.nome + '" data-monstro="' + id + '">';
    return MONSTROS[id] ? MONSTROS[id]() : '';
  }

  // ---------- Ícones de itens ----------
  // Material conforme a raridade: ferro, aço, metal negro e ouro (sem brilho; o brilho vem do encantamento).
  var MATERIAL = {
    comum:    { m: '#8b9097', d: '#4d5258', a: '#7a5a3a' },
    rara:     { m: '#d5dbe3', d: '#7d8794', a: '#3e5f8a' },
    epica:    { m: '#5a5268', d: '#2a2533', a: '#9b6fc8' },
    lendaria: { m: '#e8c35a', d: '#9a7420', a: '#fff3c4' },
    vazio:    { m: '#3a404b', d: '#2a2f38', a: '#3a404b' },
  };
  var MADEIRA = '#7a5230';

  // Desenho de cada tipo. Arma e elmo mudam conforme a classe.
  function formaItem(tipo, classe, c) {
    switch (tipo === 'arma' ? classe : tipo === 'elmo' && (classe === 'arqueiro' || classe === 'mago') ? classe + '-elmo' : tipo) {
      case 'cavaleiro':
        return '<path d="M46 8 L56 8 L56 18 L25 49 L15 39 Z" fill="' + c.m + '" stroke="' + c.d + '" stroke-width="2"/>'
          + '<path d="M50 14 L22 42" stroke="' + c.d + '" stroke-width="1.5"/>'
          + '<path d="M10 34 L30 54" stroke="' + c.d + '" stroke-width="6" stroke-linecap="round"/>'
          + '<path d="M18 46 L9 55" stroke="' + c.a + '" stroke-width="5" stroke-linecap="round"/><circle cx="8" cy="56" r="4" fill="' + c.d + '"/>';
      case 'arqueiro':
        return '<path d="M22 6 Q60 32 22 58" fill="none" stroke="' + MADEIRA + '" stroke-width="5" stroke-linecap="round"/>'
          + '<path d="M22 6 L22 58" stroke="#d8d0bc" stroke-width="1.5"/>'
          + '<path d="M22 6 Q60 32 22 58" fill="none" stroke="' + c.m + '" stroke-width="2" stroke-dasharray="4 10"/>'
          + '<rect x="35" y="26" width="7" height="12" rx="2" fill="' + c.a + '"/>';
      case 'mago':
        return '<path d="M14 60 L42 18" stroke="' + MADEIRA + '" stroke-width="5" stroke-linecap="round"/>'
          + '<path d="M38 22 L36 14 M44 26 L52 24" stroke="' + c.d + '" stroke-width="3" stroke-linecap="round"/>'
          + '<circle cx="46" cy="14" r="8" fill="' + c.m + '" stroke="' + c.d + '" stroke-width="2"/><circle cx="43" cy="11" r="2.5" fill="#fff" opacity=".6"/>';
      case 'artesao':
        return '<path d="M12 58 L38 26" stroke="' + MADEIRA + '" stroke-width="6" stroke-linecap="round"/>'
          + '<rect x="28" y="8" width="28" height="16" rx="2" fill="' + c.m + '" stroke="' + c.d + '" stroke-width="2" transform="rotate(40 42 16)"/>'
          + '<path d="M17 52 L21 47" stroke="' + c.a + '" stroke-width="6"/>';
      case 'arqueiro-elmo':
        return '<path d="M12 56 Q8 14 32 8 Q56 14 52 56 L42 56 Q44 26 32 24 Q20 26 22 56 Z" fill="' + c.m + '" stroke="' + c.d + '" stroke-width="2"/>'
          + '<path d="M32 8 Q30 18 32 24" stroke="' + c.d + '" stroke-width="1.5" fill="none"/>';
      case 'mago-elmo':
        return '<path d="M18 46 L38 4 L46 44 Z" fill="' + c.m + '" stroke="' + c.d + '" stroke-width="2"/>'
          + '<path d="M6 48 Q32 38 58 48 Q32 58 6 48 Z" fill="' + c.m + '" stroke="' + c.d + '" stroke-width="2"/>'
          + '<path d="M20 42 Q32 38 44 42" stroke="' + c.a + '" stroke-width="3" fill="none"/>';
      case 'elmo':
        return '<path d="M14 42 Q14 10 32 10 Q50 10 50 42 L50 52 L38 52 L38 40 L26 40 L26 52 L14 52 Z" fill="' + c.m + '" stroke="' + c.d + '" stroke-width="2"/>'
          + '<rect x="18" y="28" width="28" height="4" fill="' + c.d + '"/><path d="M32 10 L32 40" stroke="' + c.d + '" stroke-width="2"/>'
          + '<path d="M22 12 Q32 6 42 12" stroke="' + c.a + '" stroke-width="3" fill="none"/>';
      case 'peitoral':
        return '<path d="M14 12 L24 8 Q32 14 40 8 L50 12 L56 30 L46 32 L46 56 L18 56 L18 32 L8 30 Z" fill="' + c.m + '" stroke="' + c.d + '" stroke-width="2"/>'
          + '<path d="M32 16 L32 56 M20 38 Q32 44 44 38" stroke="' + c.d + '" stroke-width="2" fill="none"/>'
          + '<path d="M24 8 Q32 14 40 8" stroke="' + c.a + '" stroke-width="3" fill="none"/>';
      case 'luvas':
        return '<path d="M20 58 L20 32 Q20 26 24 26 L24 14 Q24 10 28 10 Q31 10 31 14 L31 24 L33 12 Q34 8 37 9 Q40 10 39 14 L38 26 L41 18 Q43 14 46 16 Q48 18 46 22 L42 36 Q40 46 40 58 Z" fill="' + c.m + '" stroke="' + c.d + '" stroke-width="2"/>'
          + '<rect x="18" y="48" width="24" height="10" rx="2" fill="' + c.a + '"/>';
      case 'botas':
        return '<path d="M18 6 L36 6 L36 36 L52 42 Q58 45 56 52 L56 58 L16 58 Z" fill="' + c.m + '" stroke="' + c.d + '" stroke-width="2"/>'
          + '<rect x="16" y="6" width="22" height="8" rx="2" fill="' + c.a + '"/><path d="M16 50 L56 50" stroke="' + c.d + '" stroke-width="2"/>';
      case 'colar':
        return '<path d="M12 8 Q32 50 52 8" fill="none" stroke="' + c.m + '" stroke-width="3" stroke-dasharray="3 2"/>'
          + '<path d="M32 30 L41 41 L32 56 L23 41 Z" fill="' + c.a + '" stroke="' + c.d + '" stroke-width="2"/>';
      case 'anel':
        return '<circle cx="32" cy="40" r="15" fill="none" stroke="' + c.m + '" stroke-width="6"/>'
          + '<circle cx="32" cy="40" r="15" fill="none" stroke="' + c.d + '" stroke-width="1"/>'
          + '<path d="M32 12 L41 21 L32 29 L23 21 Z" fill="' + c.a + '" stroke="' + c.d + '" stroke-width="2"/>';
    }
    return '';
  }

  function iconeSvg(tipo, classe, raridade) {
    return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="icone-svg" aria-hidden="true" stroke-linejoin="round">'
      + formaItem(tipo, classe, MATERIAL[raridade] || MATERIAL.comum) + '</svg>';
  }

  // Arte pintada (quando existir) em assets/itens/:
  //   armas: arma-<classe>-<raridade>.jpg   armaduras: <classe>-<tipo>-<raridade>.jpg   joias: <tipo>-<raridade>.jpg
  var semImagem = {};
  function arquivoItem(item) {
    var base = item.tipo === 'arma' ? 'arma-' + item.classe : item.classe ? item.classe + '-' + item.tipo : item.tipo;
    return 'assets/itens/' + base + '-' + item.raridade + '.jpg';
  }
  function icone(item) {
    var url = arquivoItem(item);
    if (semImagem[url]) return iconeSvg(item.tipo, item.classe, item.raridade);
    return '<img class="icone-img" src="' + url + '" alt="" data-tipo="' + item.tipo + '" data-classe="' + (item.classe || '')
      + '" data-raridade="' + item.raridade + '">';
  }
  // Silhueta apagada para espaço vazio.
  function silhueta(tipo, classe) { return iconeSvg(tipo, classe, 'vazio'); }

  // Imagem que falhou ao carregar vira o desenho SVG correspondente.
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    var d = img.dataset;
    if (img.classList.contains('icone-img')) {
      semImagem[img.getAttribute('src')] = true;
      img.outerHTML = iconeSvg(d.tipo, d.classe || null, d.raridade);
      return;
    }
    if (!img.classList.contains('retrato-img')) return;
    var svg = d.monstro ? (MONSTROS[d.monstro] ? MONSTROS[d.monstro]() : '') : desenho(d.raca, d.classe, d.sexo);
    img.outerHTML = svg;
  }, true);

  return {
    personagem: personagem, desenho: desenho, imagemRaca: imagemRaca, imagemMonstro: imagemMonstro,
    icone: icone, silhueta: silhueta,
  };
})();
