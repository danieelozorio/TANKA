// PDF da proposta v2: "Constelação da Ascensão".
const fs = require('fs'), path = require('path');
const P = require('./dados.js');
const IMG = path.join(__dirname, 'Eldrin-Constelacao.png');
const K = P.custo;
const porTrilha = 4 * K.pequeno + K.notavel, porDominio = 2 * K.pequeno + 2 * porTrilha + 2 * K.pedra;
const nPontes = Object.keys(P.pontes).length * 2, total = P.dominios.length * porDominio + nPontes * K.ponte;
const custoBase = 2000000, sobe = 0.04, custo = (k) => custoBase * (1 + sobe * (k - 1));
const porLevel = (60 - P.nivelInicio) * P.pontosPorNivel, pelaExp = P.limitePontos - porLevel;
let ac = 0; const acum = []; for (let k = 1; k <= pelaExp; k++) { ac += custo(k); acum[k] = ac; }
const dt = (n) => n + (n === 1 ? ' dia' : ' dias');
const barra = 240 / 3 * 12000, dias = (e, b) => Math.ceil(e / (b * barra)), mi = (n) => (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
const css = fs.readFileSync('.claude/skills/pdf-eldrin/exemplos/anoes.html', 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1]
  + 'table.t td { vertical-align: top; text-align: left; font-size: 9.6pt; padding: 1.3mm 1.6mm; } table.t th { text-align: left; font-size: 9.6pt; }'
  + '.dom { margin: 3mm 0 1mm; font-size: 13pt; font-weight: 700; } .mini { font-size: 9pt; color: #b9a98a; } .neg { color: #e88a7a; } .pos { color: #f3e3bd; }'
  + '.build { border: 1px solid #5a4528; border-radius: 3mm; padding: 3mm 4mm; margin: 2mm 0; background: #1a140d; } .build b.n { color: #f0c56a; font-size: 12pt; }';
const rod = (t) => '<div class="rodape">Eldrin · Constelação da Ascensão · ' + t + '</div>';
const dom = (d) => '<div class="dom" style="color:' + d.cor + '">' + d.ico + ' ' + d.nome + ' <span class="mini">· ' + d.tema + ' · tronco: ' + d.tronco + ' (2 nós)</span></div>'
  + '<table class="t"><tr><th>Trilha</th><th>4 nós pequenos</th><th>★ Notável (2 pts)</th><th>Pedra Angular (4 pts)</th></tr>'
  + d.trilhas.map((t) => '<tr><td><b>' + t.nome + '</b></td><td>' + t.pequeno + '</td><td><b>' + t.notavel.nome + '</b><br>' + t.notavel.txt + '</td>'
    + '<td><b style="color:' + d.cor + '">' + t.pedra.ico + ' ' + t.pedra.nome + '</b><br><span class="pos">' + t.pedra.txt + '</span><br><span class="neg">Custo: ' + t.pedra.custo + '</span></td></tr>').join('')
  + '</table>';
const nomeDom = (id) => P.dominios.find((d) => d.id === id);
const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Constelação da Ascensão</title><style>' + css + '</style></head><body>'
  + '<div class="pg capa"><div class="fundo" style="background:url(\'' + IMG + '\') center 42%/cover;filter:brightness(.7)"></div><div class="sh"></div>'
  + '<div class="t"><h1>Constelação</h1><div class="sub">Ascensão a partir do level ' + P.nivelInicio + '</div><small>Proposta v2 para a equipe · números de sugestão · não está no jogo ainda</small></div></div>'
  // visão
  + '<div class="pg"><div class="num">Visão geral</div><h2>Escolher é perder alguma coisa</h2>'
  + '<p>A partir do <b>level ' + P.nivelInicio + '</b> o herói ganha <b>Pontos de Ascensão</b>: 1 por level até o 60 e, depois do 60, pela exp. A árvore tem <b>' + total + ' pontos</b> de nós, mas o herói só junta <b>' + P.limitePontos + '</b>: '
  + '<b>nunca dá para pegar tudo</b>. Cada caminho que você segue é um caminho que outro herói não seguiu.</p>'
  + '<img src="' + IMG + '" style="width:122mm;display:block;margin:2mm auto;border-radius:3mm;border:1px solid #5a4528">'
  + '<h3>As regras da escolha</h3><ol class="passos">'
  + '<li><b>6 domínios, 12 trilhas.</b> Cada domínio (Fúria, Precisão, Bastião, Vigor, Tempestade, Fortuna) tem um tronco e depois <b>se divide em 2 trilhas</b>.</li>'
  + '<li><b>Pedras Angulares se excluem:</b> no fim de cada trilha há uma Pedra (efeito forte <b>com um custo</b>). As 2 Pedras do mesmo domínio <b>não andam juntas</b> (✕): pegou uma, a outra tranca.</li>'
  + '<li><b>No máximo ' + P.maxPedras + ' Pedras</b> por herói, de 6 possíveis.</li>'
  + '<li><b>Pontes (⇄):</b> 12 pontes ligam domínios vizinhos, perto e longe do centro. Dá para <b>atravessar para o domínio do lado sem voltar ao centro</b>, e cada ponte mistura os dois temas.</li>'
  + '<li><b>Atalhos:</b> dentro de cada trilha dá para pular o ★ Notável (caminho mais barato, mais fraco).</li></ol>'
  + rod('Visão geral') + '</div>'
  // domínios
  + '<div class="pg"><div class="num">Parte 1</div><h2>Os domínios e as trilhas (1/2)</h2>' + P.dominios.slice(0, 3).map(dom).join('') + rod('Parte 1') + '</div>'
  + '<div class="pg"><div class="num">Parte 1</div><h2>Os domínios e as trilhas (2/2)</h2>' + P.dominios.slice(3).map(dom).join('')
  + '<div class="caixa"><b>Pedras pensadas para não quebrar o jogo</b><ul>'
  + '<li><b>Inabalável</b> não mexe no atordoar: as habilidades que atordoam continuam valendo contra ele.</li>'
  + '<li><b>Primeiro Golpe</b>: os dois lutadores com a Pedra começam com a barra cheia, e ataca primeiro o mais rápido (como hoje).</li>'
  + '<li><b>Sabedoria</b>: quando o herói não ganha mais pontos (limite de ' + P.limitePontos + '), o bônus de exp vira <b>+20% de drop</b>, para nunca ficar inútil.</li></ul></div>' + rod('Parte 1') + '</div>'
  // pontes e builds
  + '<div class="pg"><div class="num">Parte 2</div><h2>Pontes e caminhos</h2>'
  + '<table class="t"><tr><th>Liga</th><th>Ponte de dentro</th><th>Ponte de fora</th></tr>' + Object.entries(P.pontes).map(([k, v]) => {
    const [a, b] = k.split('-').map(nomeDom);
    return '<tr><td><b style="color:' + a.cor + '">' + a.ico + ' ' + a.nome + '</b> ⇄ <b style="color:' + b.cor + '">' + b.ico + ' ' + b.nome + '</b></td><td>' + v[0] + '</td><td>' + v[1] + '</td></tr>'; }).join('')
  + '</table><p class="mini">Cada ponte custa ' + K.ponte + ' pontos. As de fora ficam perto das Pedras: são caras de alcançar, mas dão mais.</p>'
  + '<h3>Exemplos de heróis diferentes (todos com ' + P.limitePontos + ' pontos)</h3>'
  + '<div class="build"><b class="n">🩸 O Carniceiro</b> · Fúria/Carniceiro → ponte → Precisão/Lâmina Fina → Vigor/Vampiro<br>Muito dano e crítico, se cura batendo. <span class="neg">Menos vida e não usa poção.</span> (é o exemplo aceso na imagem)</div>'
  + '<div class="build"><b class="n">🏰 A Muralha</b> · Bastião/Muralha → Bastião/Espinhos (só os nós) → Vigor/Sangue Vivo<br>Quase não cai e se cura sozinho. <span class="neg">Mais lento, bate pouco.</span></div>'
  + '<div class="build"><b class="n">🔮 O Arcanista</b> · Tempestade/Arcano → ponte → Fúria/Executor<br>Habilidades em dobro e acaba com quem está fraco. <span class="neg">Ataque normal mais fraco.</span></div>'
  + '<div class="build"><b class="n">🪙 O Mercador</b> · Fortuna/Saqueador → Tempestade/Relâmpago<br>Farma ouro e drop rápido. <span class="neg">Ganha menos exp e é frágil.</span></div>'
  + rod('Parte 2') + '</div>'
  // custo
  + '<div class="pg"><div class="num">Parte 3</div><h2>Pontos, custo e tempo</h2>'
  + '<table><tr><th>O quê</th><th>Pontos</th></tr>'
  + '<tr><td>Nó pequeno · ★ Notável · ⇄ Ponte · Pedra Angular</td><td>' + K.pequeno + ' · ' + K.notavel + ' · ' + K.ponte + ' · ' + K.pedra + '</td></tr>'
  + '<tr><td>Um domínio inteiro (tronco + 2 trilhas + 2 Pedras)</td><td>' + porDominio + '</td></tr>'
  + '<tr><td>As ' + nPontes + ' pontes</td><td>' + nPontes * K.ponte + '</td></tr>'
  + '<tr class="dest"><td>Árvore inteira</td><td>' + total + '</td></tr>'
  + '<tr class="dest"><td>O que um herói consegue juntar (limite)</td><td>' + P.limitePontos + ' (' + Math.round(P.limitePontos * 100 / total) + '% da árvore)</td></tr></table>'
  + '<h3>Como o herói ganha os pontos</h3><table><tr><th>De onde</th><th>Pontos</th></tr>'
  + '<tr><td>Subindo do level ' + (P.nivelInicio + 1) + ' ao 60 (1 por level, junto com os pontos normais)</td><td>' + porLevel + '</td></tr>'
  + '<tr><td>Depois do 60, pela exp (a barra de exp continua enchendo)</td><td>até ' + pelaExp + '</td></tr>'
  + '<tr class="dest"><td>Limite</td><td>' + P.limitePontos + '</td></tr></table>'
  + '<h3>Pontos pela exp (depois do 60)</h3><p>O 1º custa <b>' + mi(custoBase) + ' de exp</b>; cada um seguinte custa <b>' + Math.round(sobe * 100) + '% a mais</b> que o primeiro.</p>'
  + '<table><tr><th>Ponto pela exp</th><th>Exp somada</th><th>2 barras/dia</th><th>4 barras/dia</th></tr>'
  + [1, 10, 20, 30, 40, pelaExp].map((k) => '<tr' + (k === pelaExp ? ' class="dest"' : '') + '><td>' + k + 'º (' + (porLevel + k) + ' no total)</td><td>' + mi(acum[k]) + '</td><td>' + dt(dias(acum[k], 2)) + '</td><td>' + dt(dias(acum[k], 4)) + '</td></tr>').join('')
  + '</table><p class="mini">Barra de estamina no Cume do Fogo Eterno ≈ ' + mi(barra) + ' de exp (Elemental de Fogo). Sem bônus de exp.</p>'
  + '<h3>Trocar de caminho</h3><ul><li><b>Pergaminho da Ascensão</b> (loja): devolve todos os pontos para escolher de novo. Caro, para a escolha pesar.</li>'
  + '<li>Uma Pedra trancada (✕) só destranca devolvendo a outra.</li></ul>'
  + rod('Parte 3') + '</div>'
  // tela
  + '<div class="pg"><div class="num">Parte 4</div><h2>Na tela e perguntas</h2>'
  + '<h3>Celular</h3><ul><li>A constelação inteira dá para <b>arrastar e dar zoom</b> com os dedos.</li><li>Tocar num nó abre a ficha dele embaixo: o que dá, o custo e o botão "Pegar". Nós que ainda não dá para pegar ficam apagados; Pedras trancadas mostram 🔒 e o motivo.</li>'
  + '<li>Em cima: <b>"Pontos: 23/70 · Pedras: 1/3"</b>.</li></ul>'
  + '<h3>Computador</h3><ul><li>A árvore inteira; passar o mouse num nó mostra a ficha.</li></ul>'
  + '<h3>Perguntas para a equipe</h3><ol class="passos"><li>Limite de ' + P.limitePontos + ' pontos (' + porLevel + ' pelos levels + ' + pelaExp + ' pela exp) e ' + P.maxPedras + ' Pedras: está bom ou querem mais apertado?</li>'
  + '<li>As Pedras valem na Arena? (algumas mudam muito a luta, como Primeiro Golpe e Sede Eterna)</li><li>O custo das Pedras (a parte vermelha) está pesado o bastante?</li>'
  + '<li>Preço do Pergaminho da Ascensão (trocar de caminho).</li></ol>'
  + rod('Parte 4') + '</div></body></html>';
fs.writeFileSync(process.argv[2], html);
console.log('total', total, 'limite', P.limitePontos, 'por level', porLevel, 'exp', pelaExp, mi(acum[pelaExp]), dias(acum[pelaExp], 2), dias(acum[pelaExp], 4));
