// Desenha a "Constelação da Ascensão" v2: 6 domínios, 12 trilhas, pontes entre vizinhos e Pedras Angulares que se excluem.
// Mostra um exemplo de escolha acesa (Fúria/Carniceiro → ponte → Precisão/Lâmina Fina, e Vigor/Vampiro).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const P = require('./dados.js');
// medalhões (arte do Daniel, Gemini), embutidos na imagem
const NOMES = { furia: ['sede-de-sangue', 'execucao'], precisao: ['golpe-certeiro', 'ferida-aberta'], bastiao: ['inabalavel', 'couraca-de-espinhos'],
  vigor: ['regeneracao', 'sede-eterna'], tempestade: ['primeiro-golpe', 'eco'], fortuna: ['mao-dourada', 'sabedoria'] };
const BRASAO = Object.fromEntries(Object.keys(NOMES).map((k) => [k, 'data:image/webp;base64,' + fs.readFileSync('assets/ascensao/dominio-' + k + '.webp').toString('base64')]));
const MED = Object.fromEntries(Object.entries(NOMES).map(([k, v]) => [k, v.map((n) => 'data:image/webp;base64,' + fs.readFileSync('assets/ascensao/medalhao-' + n + '.webp').toString('base64'))]));
const W = 1520, C = W / 2;
const pt = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];
const rad = (g) => g * Math.PI / 180;
let s = '', defs = '';
let sem = 11; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
for (let i = 0; i < 320; i++) s += `<circle cx="${(rnd() * W).toFixed(1)}" cy="${(rnd() * W).toFixed(1)}" r="${(rnd() * 1.3 + .3).toFixed(2)}" fill="#fff" opacity="${(rnd() * .5 + .12).toFixed(2)}"/>`;
s += `<circle cx="${C}" cy="${C}" r="660" fill="url(#brilho)"/>`;
// anéis de fundo
[200, 330, 450, 570].forEach((r) => { s += `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="#d4a24c" stroke-opacity=".08" stroke-width="1.5"/>`; });
const n = P.dominios.length, R_TRONCO = [150, 205], R_TRILHA = [265, 330, 390, 450, 510], R_PEDRA = 590, ABRE = 15;
// acesos no exemplo: [domínio, trilha(0/1/-1 tronco), índice]
const aceso = new Set(['furia-t-0', 'furia-t-1', 'furia-0-0', 'furia-0-1', 'furia-0-2', 'furia-0-3', 'furia-0-4', 'furia-0-p',
  'ponte-furia-precisao-0', 'precisao-1-1', 'precisao-1-2', 'precisao-1-3', 'precisao-1-0',
  'vigor-t-0', 'vigor-t-1', 'vigor-1-0', 'vigor-1-1', 'vigor-1-2']);
const travada = new Set(['furia-1-p']);   // a outra Pedra do domínio fica trancada
const G = P.dominios.map((d, i) => {
  const ang = -90 + i * 360 / n;
  const tronco = R_TRONCO.map((r) => pt(r, rad(ang)));
  const trilhas = [-1, 1].map((lado, t) => ({ ang: ang + lado * ABRE, nos: R_TRILHA.map((r, k) => pt(r, rad(ang + lado * (ABRE + (k % 2 ? 2.5 : 0))))), pedra: pt(R_PEDRA, rad(ang + lado * (ABRE + 2))) }));
  return { d, ang, tronco, trilhas };
});
const L = (a, b, cor, op, w, extra) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${cor}" stroke-opacity="${op}" stroke-width="${w}" ${extra || ''}/>`;
const no = (p, cor, on, r, rotulo) => `<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${on ? cor : '#120f0c'}" stroke="${cor}" stroke-width="2.6" ${on ? 'filter="url(#luz)"' : 'stroke-opacity=".75"'}/>`
  + (rotulo ? `<text x="${p[0]}" y="${p[1] + 4}" text-anchor="middle" font-size="${r > 12 ? 12 : 10}" font-weight="700" fill="${on ? '#140f0a' : cor}" font-family="Georgia,serif">${rotulo}</text>` : '');
// 1) pontes entre domínios vizinhos (2 por par): ligam a trilha "direita" de i com a "esquerda" de i+1
const lista = Object.entries(P.pontes);
G.forEach((g, i) => {
  const h = G[(i + 1) % n], chave = g.d.id + '-' + h.d.id, a = g.trilhas[1], b = h.trilhas[0];
  [[0, 1], [2, 3]].forEach(([ka, kb], q) => {
    const kx = q ? 3 : 1, pa = a.nos[kx], pb = b.nos[kx];
    const meio = pt(q ? 470 : 345, rad((g.ang + h.ang) / 2 + (i === n - 1 ? 180 : 0)));
    const id = 'g' + i + q, on = aceso.has('ponte-' + chave + '-' + q);
    defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${pa[0]}" y1="${pa[1]}" x2="${pb[0]}" y2="${pb[1]}"><stop offset="0" stop-color="${g.d.cor}"/><stop offset="1" stop-color="${h.d.cor}"/></linearGradient>`;
    s += `<path d="M${pa[0]} ${pa[1]} Q${meio[0]} ${meio[1]} ${pb[0]} ${pb[1]}" stroke="url(#${id})" stroke-width="${on ? 3.5 : 2.2}" stroke-opacity="${on ? 1 : .55}" fill="none"/>`;
    // nó da ponte no meio da curva
    const m = [(pa[0] + 2 * meio[0] + pb[0]) / 4, (pa[1] + 2 * meio[1] + pb[1]) / 4];
    s += `<rect x="${m[0] - 11}" y="${m[1] - 11}" width="22" height="22" rx="4" transform="rotate(45 ${m[0]} ${m[1]})" fill="${on ? '#f3e3bd' : '#120f0c'}" stroke="url(#${id})" stroke-width="2.6"/>`;
    s += `<text x="${m[0]}" y="${m[1] + 4.5}" text-anchor="middle" font-size="12" font-weight="700" fill="${on ? '#140f0a' : '#d9c7a3'}">⇄</text>`;
  });
});
// 2) ligações em cruz dentro de cada domínio (entre as duas trilhas, no meio)
G.forEach((g) => {
  const [a, b] = g.trilhas;
  s += L(a.nos[2], b.nos[2], g.d.cor, .35, 1.6, 'stroke-dasharray="4 5"');
  // Pedras do mesmo domínio se excluem: arco vermelho com ✕
  const mm = pt(R_PEDRA + 4, rad(g.ang));
  s += L(a.pedra, mm, '#c0392b', .85, 2, 'stroke-dasharray="4 4"') + L(b.pedra, mm, '#c0392b', .85, 2, 'stroke-dasharray="4 4"');
  s += `<circle cx="${mm[0]}" cy="${mm[1]}" r="10" fill="#2a0e0a" stroke="#c0392b" stroke-width="2"/><text x="${mm[0]}" y="${mm[1] + 4.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#ff8a7a">✕</text>`;
});
// 3) troncos, trilhas e Pedras
G.forEach((g) => {
  const d = g.d, cor = d.cor;
  const ini = pt(120, rad(g.ang));
  s += L(ini, g.tronco[0], cor, .8, 3) + L(g.tronco[0], g.tronco[1], cor, .8, 3);
  g.trilhas.forEach((t, ti) => {
    s += L(g.tronco[1], t.nos[0], cor, .7, 3);
    for (let k = 1; k < t.nos.length; k++) s += L(t.nos[k - 1], t.nos[k], cor, aceso.has(d.id + '-' + ti + '-' + k) ? 1 : .6, aceso.has(d.id + '-' + ti + '-' + k) ? 4 : 3);
    // atalho: do 2º nó pula para o 4º (caminho mais curto, sem o notável)
    s += `<path d="M${t.nos[1][0]} ${t.nos[1][1]} Q${pt(450, rad(t.ang + (ti ? 6 : -6)))[0]} ${pt(450, rad(t.ang + (ti ? 6 : -6)))[1]} ${t.nos[3][0]} ${t.nos[3][1]}" stroke="${cor}" stroke-opacity=".3" stroke-width="1.6" fill="none"/>`;
    s += L(t.nos[4], t.pedra, cor, .7, 3);
    t.nos.forEach((p, k) => { const on = aceso.has(d.id + '-' + ti + '-' + k); s += k === 2 ? no(p, cor, on, 15, '★') : no(p, cor, on, 11, '+'); });
    const on = aceso.has(d.id + '-' + ti + '-p'), off = travada.has(d.id + '-' + ti + '-p');
    // medalhão pintado (Gemini) no lugar da Pedra; trancado fica cinza e escuro
    const arq = MED[d.id][ti], ra = 44;
    s += `<circle cx="${t.pedra[0]}" cy="${t.pedra[1]}" r="${ra + 3}" fill="none" stroke="${off ? '#3a3028' : cor}" stroke-width="${on ? 5 : 2.5}" ${on ? 'filter="url(#luz)"' : 'stroke-opacity=".7"'}/>`;
    s += `<image href="${arq}" x="${t.pedra[0] - ra}" y="${t.pedra[1] - ra}" width="${2 * ra}" height="${2 * ra}" ${off ? 'filter="url(#cinza)" opacity=".45"' : ''}/>`;
    if (off) s += `<text x="${t.pedra[0] + 30}" y="${t.pedra[1] - 28}" text-anchor="middle" font-size="16">🔒</text>`;
    // nome da trilha e da Pedra, fora do círculo
    let lab = pt(R_PEDRA + 72, rad(t.ang + (ti ? 3 : -3)));
    if (Math.abs(Math.sin(rad(t.ang))) < 0.75) lab = [t.pedra[0], t.pedra[1] + 66];   // laterais: o nome vai embaixo da Pedra
    s += `<text x="${lab[0]}" y="${lab[1]}" text-anchor="middle" font-size="16" fill="${off ? '#6a5a4a' : cor}" font-family="Georgia,serif" font-weight="700">${d.trilhas[ti].pedra.nome}</text>`;
    s += `<text x="${lab[0]}" y="${lab[1] + 17}" text-anchor="middle" font-size="12" fill="#b9a98a" font-family="Georgia,serif">${d.trilhas[ti].nome}</text>`;
  });
  g.tronco.forEach((p, k) => { s += no(p, cor, aceso.has(d.id + '-t-' + k), 11, '+'); });
  // nome do domínio, entre as duas trilhas
  const lab = pt(300, rad(g.ang));
  s += `<image href="${BRASAO[d.id]}" x="${lab[0] - 30}" y="${lab[1] - 30}" width="60" height="60"/>`;   // brasão pintado (Gemini)
  const lab2 = pt(232, rad(g.ang + 9));
  s += `<text x="${lab2[0]}" y="${lab2[1] + 5}" text-anchor="middle" font-size="15" fill="${cor}" font-family="Georgia,serif" font-weight="700" letter-spacing="2">${d.nome.toUpperCase()}</text>`;
});
// 4) núcleo com 6 arcos
G.forEach((g) => {
  const a0 = rad(g.ang - 27), a1 = rad(g.ang + 27), [x0, y0] = pt(110, a0), [x1, y1] = pt(110, a1);
  s += `<path d="M${x0} ${y0} A110 110 0 0 1 ${x1} ${y1}" stroke="${g.d.cor}" stroke-width="16" fill="none" filter="url(#luz)"/>`;
});
s += `<circle cx="${C}" cy="${C}" r="92" fill="#0d0b09" stroke="#5a4528" stroke-width="2"/>`;
s += `<text x="${C}" y="${C - 14}" text-anchor="middle" font-size="12" letter-spacing="4" fill="#d4a24c" font-family="Georgia,serif">ASCENSÃO</text>`;
s += `<text x="${C}" y="${C + 14}" text-anchor="middle" font-size="22" fill="#f0c56a" font-family="Georgia,serif" font-weight="700">Constelação</text>`;
s += `<text x="${C}" y="${C + 36}" text-anchor="middle" font-size="12" fill="#b9a98a" font-family="Georgia,serif">a partir do level ${P.nivelInicio}</text>`;
// legenda
const leg = [['+', 'nó pequeno · 1 ponto'], ['★', 'notável · 2 pontos'], ['⇄', 'ponte entre domínios · 2 pontos'], ['◯', 'Pedra Angular · 4 pontos'], ['✕', 'as 2 Pedras do domínio se excluem']];
leg.forEach(([ic, t], i) => { s += `<text x="40" y="${W - 140 + i * 24}" font-size="15" fill="#d9c7a3" font-family="Georgia,serif"><tspan fill="#f0c56a" font-weight="700">${ic}</tspan>  ${t}</text>`; });
s += `<text x="${W - 40}" y="${W - 44}" text-anchor="end" font-size="14" fill="#b9a98a" font-family="Georgia,serif">aceso = exemplo de um herói (Carniceiro + Lâmina Fina + Vampiro)</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">
<defs>${defs}<radialGradient id="brilho"><stop offset="0" stop-color="#3a2a14" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<filter id="cinza"><feColorMatrix type="saturate" values="0"/></filter><filter id="luz" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect width="${W}" height="${W}" fill="#0a0806"/>${s}</svg>`;
const saida = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: W }, deviceScaleFactor: 1.5 });
  await p.setContent('<html><body style="margin:0;background:#0a0806">' + svg + '</body></html>'); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(saida, 'Eldrin-Constelacao.png') }); await b.close(); console.log('ok');
})();
