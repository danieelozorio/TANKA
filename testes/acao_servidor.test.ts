// Teste da Edge Function `acao` com um Supabase de mentira (fetch trocado).
// Rodar: deno run --allow-read --allow-env testes/acao_servidor.test.ts
//   (ou, sem Deno: node --experimental-strip-types testes/acao_servidor.test.ts). Antes: node ferramentas/gerar_servidor.js
const g = globalThis as any;
if (!g.Deno) g.Deno = { env: { get: () => '' } };
const Tanka = (await import('../supabase/functions/_shared/tanka.js')).default;
const { tratar } = await import('../supabase/functions/acao/index.ts');

const R = Tanka.regras;
let falhas = 0;
function ok(cond: unknown, msg: string) { if (cond) console.log('ok   ' + msg); else { falhas++; console.log('FALHA ' + msg); } }

const p0 = R.criarPersonagem('Henri', 'masculino', 'humano', 'cavaleiro');
R.admin.subirNivel(p0, 11);   // level 12: pontos de atributo e segunda classe
const banco: Record<string, { conta_id: string; dados: any }> = {
  [p0.id]: { conta_id: 'u1', dados: JSON.parse(JSON.stringify(p0)) },
  outro: { conta_id: 'u2', dados: JSON.parse(JSON.stringify(R.criarPersonagem('Outro', 'masculino', 'humano', 'mago'))) },
};
let recusarGravacao = '';
let pendentes: any = { recompensas: [], creditos: [] };
const marcados: string[] = [];
const bauGuardados: any[] = [];
const eventoRegistros: any[] = [];
let eventoAberto: any = null;
g.fetch = (async (url: string, init: any = {}) => {
  const u = new URL(url), h = init.headers || {};
  const token = String(h.Authorization || '').replace('Bearer ', '');
  const json = (x: unknown, st = 200) => new Response(JSON.stringify(x), { status: st });
  if (u.pathname === '/auth/v1/user') return token === 'tok-u1' ? json({ id: 'u1' }) : json({ msg: 'bad' }, 401);
  if (u.pathname === '/rest/v1/rpc/pendentes') return json(pendentes);
  if (u.pathname === '/rest/v1/rpc/cacada_bonus') return json({ cla: { id: 7, skills: { exp: 3 } }, exp: 0, ouro: 0 });
  if (u.pathname === '/rest/v1/rpc/recompensa_resgatar') { marcados.push('r' + JSON.parse(init.body).recompensa); return json({}); }
  if (u.pathname === '/rest/v1/rpc/credito_aplicar') { marcados.push('c' + JSON.parse(init.body).credito); return json({}); }
  if (u.pathname === '/rest/v1/personagens') {
    const id = (u.searchParams.get('id') || '').replace('eq.', '');
    const linha = banco[id];
    if (!init.method || init.method === 'GET') return json(linha && linha.conta_id === 'u1' ? [linha] : []);   // RLS
    if (init.method === 'PATCH') {
      if (recusarGravacao) return json({ message: recusarGravacao }, 400);   // a trava do banco
      const v = u.searchParams.get('dados->>versao');
      const atual = linha.dados.versao;
      if (!(v === 'is.null' ? atual == null : 'eq.' + atual === v)) return json([]);
      linha.dados = JSON.parse(init.body).dados;
      return json([{ id }]);
    }
  }
  // lutas que o servidor refaz (masmorra, boss do clã, Ignaroth)
  if (u.pathname === '/rest/v1/masmorra_runs') {
    const rid = Number((u.searchParams.get('id') || '').replace('eq.', ''));
    if (rid === 8) {   // masmorra com caminhos (gravação com a versão)
      if (init.method === 'PATCH') {
        if ('eq.' + runCam.versao !== u.searchParams.get('versao')) return json([]);
        Object.assign(runCam, JSON.parse(init.body)); return json([runCam]);
      }
      return json([JSON.parse(JSON.stringify(runCam))]);
    }
    return json(rid === 5 ? [runMasmorra] : []);
  }
  if (u.pathname === '/rest/v1/rpc/masmorra_finalizar') { finalizados.push(JSON.parse(init.body)); runCam.estado = JSON.parse(init.body).vitoria ? 'vitoria' : 'derrota'; return json(null); }
  if (u.pathname === '/rest/v1/alianca_boss_runs') return json([runBoss]);
  if (u.pathname === '/rest/v1/arena_lutas') {
    const lid = Number((u.searchParams.get('id') || '').replace('eq.', ''));
    return json(lid === 76 ? [{ id: 76, atacante: p0.id, situacao: 'vitoria' }] : lid === 77 ? [{ id: 77, atacante: 'outro', situacao: 'vitoria' }] : []);
  }
  if (u.pathname === '/rest/v1/torre_runs') {
    if (init.method === 'PATCH') {
      if ('eq.' + runTorre.versao !== u.searchParams.get('versao')) return json([]);
      Object.assign(runTorre, JSON.parse(init.body)); return json([runTorre]);
    }
    return json([JSON.parse(JSON.stringify(runTorre))]);
  }
  if (u.pathname === '/rest/v1/rpc/bau_guardar') { bauGuardados.push(JSON.parse(init.body)); return json(true); }
  if (u.pathname === '/rest/v1/rpc/evento_atual') return json(eventoAberto);
  if (u.pathname === '/rest/v1/rpc/evento_registrar') { eventoRegistros.push(JSON.parse(init.body)); return json(true); }
  if (u.pathname === '/rest/v1/rpc/torre_registrar') { torreReg.push(JSON.parse(init.body)); if (JSON.parse(init.body).fim) runTorre.estado = JSON.parse(init.body).fim; return json(null); }
  if (u.pathname === '/rest/v1/rpc/masmorra_concluir' || u.pathname === '/rest/v1/rpc/alianca_boss_concluir' || u.pathname === '/rest/v1/rpc/boss_atacar') {
    lutasRegistradas.push({ rota: u.pathname, corpo: JSON.parse(init.body) });
    return json(u.pathname.endsWith('boss_atacar') ? { dano: JSON.parse(init.body).dano } : u.pathname.endsWith('alianca_boss_concluir') ? { dano: 1 } : null);
  }
  if (u.pathname === '/rest/v1/rpc/boss_estado') return json({ boss: { id: 1, vida: 5_000_000, vida_max: 5_000_000 } });
  return json({ erro: 'rota ' + u.pathname }, 404);
}) as typeof fetch;
const lutasRegistradas: any[] = [];
const finalizados: any[] = [];
const heroi = { id: p0.id, dados: JSON.parse(JSON.stringify(p0)) };
const runMasmorra = { id: 5, lider: p0.id, membros: [p0.id], grupo_id: 1, estado: 'andamento', masmorra: Tanka.dados.masmorras[0].id, herois: [heroi], semente: 12345 };
const runCam: any = { id: 8, lider: p0.id, membros: [p0.id], estado: 'andamento', masmorra: 'toca', herois: [heroi], semente: 99, etapa: { fase: 0 }, versao: 0 };
const fichaT = (c: string, c2: string) => {
  const p = R.criarPersonagem('T' + c2, 'masculino', 'humano', c); R.admin.subirNivel(p, 29); R.escolherSegundaClasse(p, c2);
  const hs = Tanka.dados.SEGUNDAS_CLASSES[c2].habilidades.filter((h: any) => h.tipo !== 'passiva' && (!h.nivel || p.nivel >= h.nivel));
  let gg = 0, ii = 0; while (R.pontosHabilidadeLivres(p) > 0 && gg++ < 400) R.mudarPontoHabilidade(p, hs[ii++ % hs.length].id, 1);
  return p;
};
const torreHerois = [heroi.dados, fichaT('cavaleiro', 'paladino'), fichaT('mago', 'curandeiro'), fichaT('mago', 'bruxo')].map((d: any) => ({ id: d.id, dados: d }));
const runTorre: any = { id: 11, lider: p0.id, membros: torreHerois.map((h) => h.id), herois: torreHerois, andar_inicio: 1, semente: 4242,
  estado: 'andamento', torre: null, escolhas: {}, prazo: null, versao: 0 };
const torreReg: any[] = [];
const runBoss = { id: 9, lider: p0.id, membros: [p0.id], estado: 'andamento', nivel: 1, hp_inicio: 49140, semente: 777, buff: 0, herois: [heroi] };

const base = 'https://x.supabase.co';
let relogio = 1_800_000_000_000;
const pedir = async (corpo: unknown, token = 'tok-u1') => {
  const r = await tratar(new Request(base + '/functions/v1/acao', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, apikey: 'pub', 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  }), base, () => relogio);
  return { status: r.status, j: await r.json() };
};
const d = () => banco[p0.id].dados;

let x = await pedir({ personagem: p0.id, acao: 'atributos', args: { for: 3 } }, 'tok-ruim');
ok(x.status === 401, 'sem login válido: 401');
x = await pedir({ personagem: 'outro', acao: 'atributos', args: { for: 1 } });
ok(x.status === 403, 'personagem de outra conta: 403');
x = await pedir({ personagem: p0.id, acao: 'darOuro', args: 999999 });
ok(x.status === 400, 'ação fora da lista: 400');

const forAntes = d().atributos.for, livres = d().pontosLivres;
x = await pedir({ personagem: p0.id, acao: 'atributos', args: { for: 3, des: 1 } });
ok(!x.j.erro && d().atributos.for === forAntes + 3 && d().pontosLivres === livres - 4, 'atributos: distribui no servidor e grava');
ok(x.j.personagem && x.j.personagem.versao === d().versao, 'devolve o personagem gravado');
x = await pedir({ personagem: p0.id, acao: 'atributos', args: { for: 999 } });
ok(x.j.erro && d().atributos.for === forAntes + 3, 'atributos: mais pontos do que tem é recusado');
x = await pedir({ personagem: p0.id, acao: 'atributos', args: { for: -5 } });
ok(x.j.erro, 'atributos: número negativo é recusado');

x = await pedir({ personagem: p0.id, acao: 'segundaClasse', args: 'bruxo' });
ok(x.j.erro && !d().talentos?.classe2, 'segunda classe de outra classe base: recusada');
x = await pedir({ personagem: p0.id, acao: 'segundaClasse', args: 'paladino' });
ok(!x.j.erro && d().talentos.classe2 === 'paladino', 'segunda classe escolhida');
x = await pedir({ personagem: p0.id, acao: 'pontosHabilidade', args: { 'golpe-justo': 2 } });
ok(!x.j.erro && d().talentos.pontos['golpe-justo'] === 2, 'pontos de habilidade confirmados');
x = await pedir({ personagem: p0.id, acao: 'pontosHabilidade', args: { 'golpe-justo': 10 } });
ok(x.j.erro && d().talentos.pontos['golpe-justo'] === 2, 'pontos de habilidade além do limite: recusado e nada muda');
x = await pedir({ personagem: p0.id, acao: 'ordemHabilidade', args: ['arena', 'golpe-justo', 'tirar'] });
ok(!x.j.erro && d().talentos.ordem.arena.indexOf('golpe-justo') < 0, 'ordem das habilidades');

const arma = d().inventario[0].id;
x = await pedir({ personagem: p0.id, acao: 'desequipar', args: 'arma' });
ok(!x.j.erro && !d().equipados.arma, 'desequipar');
x = await pedir({ personagem: p0.id, acao: 'equipar', args: arma });
ok(!x.j.erro && d().equipados.arma === arma, 'equipar');
x = await pedir({ personagem: p0.id, acao: 'equipar', args: 'item-que-nao-existe' });
ok(x.j.erro, 'equipar item que não existe: recusado');
d().recomecos = 0;
x = await pedir({ personagem: p0.id, acao: 'usarRecomeco' });
ok(x.j.erro, 'recomeço sem pergaminho: recusado');
d().recomecos = 1;
x = await pedir({ personagem: p0.id, acao: 'usarRecomeco' });
ok(!x.j.erro && d().recomecos === 0 && d().pontosLivres === (d().nivel - 1) * 3, 'recomeço com pergaminho: pontos voltam');

// ---- Etapa 2: Mochila e Mercado ----
d().ouro = 100000; d().reputacao = 1000;
const nAntes = d().inventario.length;
x = await pedir({ personagem: p0.id, acao: 'comprar', args: { tipo: 'elmo' } });
ok(!x.j.erro && d().inventario.length === nAntes + 1 && d().ouro < 100000, 'comprar: o item é sorteado e cobrado no servidor');
const novo = d().inventario[d().inventario.length - 1].id, ouroAntes = d().ouro;
x = await pedir({ personagem: p0.id, acao: 'travarItem', args: novo });
ok(!x.j.erro && d().inventario.find((i: any) => i.id === novo).travado, 'travar item');
x = await pedir({ personagem: p0.id, acao: 'vender', args: novo });
ok(x.j.erro && d().inventario.some((i: any) => i.id === novo), 'item travado não vende');
await pedir({ personagem: p0.id, acao: 'travarItem', args: novo });
x = await pedir({ personagem: p0.id, acao: 'vender', args: novo });
ok(!x.j.erro && !d().inventario.some((i: any) => i.id === novo) && d().ouro > ouroAntes, 'vender: tira o item e paga o preço do servidor');
x = await pedir({ personagem: p0.id, acao: 'vender', args: d().equipados.arma });
ok(x.j.erro, 'item equipado não vende');
x = await pedir({ personagem: p0.id, acao: 'venderVarios', args: ['nao-existe'] });
ok(x.j.erro, 'venda em lote sem itens válidos: recusada');
d().ouro = 0;
x = await pedir({ personagem: p0.id, acao: 'comprar', args: { tipo: 'elmo' } });
ok(x.j.erro && d().inventario.length === nAntes, 'comprar sem ouro: recusado');
x = await pedir({ personagem: p0.id, acao: 'comprarRecomeco' });
ok(x.j.erro, 'pergaminho do recomeço sem ouro: recusado');

// ---- Etapa 3: Forja, Oficina e Minas ----
d().ouro = 100000;
R.mudarPergaminho(d(), d().inventario.find((i: any) => i.id === d().equipados.arma).raridade, 3);
const armaId = d().equipados.arma;
x = await pedir({ personagem: p0.id, acao: 'encantar', args: [armaId, false] });
ok(!x.j.erro && x.j.resultado && x.j.resultado.sucesso === true && d().inventario.find((i: any) => i.id === armaId).encanto === 1, 'encantar: +1 sorteado e gravado no servidor (até +3 nunca falha)');
ok(d().missoes && JSON.stringify(d().missoes).includes('encantar'), 'encantar conta na missão');
x = await pedir({ personagem: p0.id, acao: 'encantar', args: ['nao-existe', false] });
ok(x.j.erro, 'encantar item que não existe: recusado');
x = await pedir({ personagem: p0.id, acao: 'forjar', args: { area: 'floresta', classe: 'cavaleiro', tipo: 'arma' } });
ok(x.j.erro && /Ferreiro/.test(x.j.erro), 'forjar sem ser Ferreiro: recusado');
x = await pedir({ personagem: p0.id, acao: 'iniciarMinas', args: [0, 'floresta'] });
ok(!x.j.erro && d().minas && d().minas.area === 'floresta', 'minas: começa no servidor');
x = await pedir({ personagem: p0.id, acao: 'recolherMinas' });
ok(x.j.erro, 'minas: não recolhe antes do fim');
relogio += 31 * 60000;
x = await pedir({ personagem: p0.id, acao: 'recolherMinas' });
ok(!x.j.erro && x.j.resultado && x.j.resultado.qtd > 0 && !d().minas, 'minas: recolhe com a quantidade sorteada no servidor');

// ---- Etapa 4: prêmios e progresso ----
d().ouro = 1000;
pendentes = { recompensas: [{ id: 11, origem: 'masmorra', item: { tipo: 'pergaminho', raridade: 'rara', qtd: 2 } }],
  creditos: [{ id: 21, ouro: 500, reputacao: 3, motivo: 'Vitória na Arena' }] };
const pergAntes = R.qtdPergaminho(d(), 'rara');
x = await pedir({ personagem: p0.id, acao: 'receber', args: { recompensas: [{ id: 99, item: { tipo: 'pergaminho', raridade: 'lendaria', qtd: 99 } }] } });
ok(!x.j.erro && R.qtdPergaminho(d(), 'rara') === pergAntes + 2 && R.qtdPergaminho(d(), 'lendaria') === 0, 'receber: entrega o que está no banco e ignora o que o navegador manda');
ok(d().ouro === 1500 && marcados.join() === 'r11,c21', 'receber: aplica o crédito e marca os dois como recebidos depois de gravar');
ok(x.j.resultado.avisos.length === 2, 'receber: devolve os avisos para a tela');
const vRec = d().versao;
x = await pedir({ personagem: p0.id, acao: 'receber' });
ok(R.qtdPergaminho(d(), 'rara') === pergAntes + 2 && d().ouro === 1500, 'receber de novo (marcação falhou): p.recebidas não entrega duas vezes');
pendentes = { recompensas: [], creditos: [] };
x = await pedir({ personagem: p0.id, acao: 'receber' });
ok(d().versao === vRec, 'nada para receber: não grava de novo');
pendentes = { recompensas: [], creditos: [{ id: 31, ouro: 0, reputacao: 0, motivo: 'Mensagem do Reino: Obrigado por testar!' }] };
x = await pedir({ personagem: p0.id, acao: 'receber' });
ok(x.j.resultado && x.j.resultado.avisos[0].texto === 'Obrigado por testar!' && x.j.resultado.avisos[0].origem === 'admin' && d().ouro === 1500 && marcados.includes('c31'),
  'mensagem do Reino: só o texto, na caixa, sem mexer no ouro, e marcada como entregue');
{ const nivelAntes = d().nivel, expAntes = d().exp;
  pendentes = { recompensas: [], creditos: [{ id: 41, ouro: 60000, reputacao: 0, exp: 60000, motivo: 'Torre do Eclipse: andar 1 (primeira vez)' }] };
  x = await pedir({ personagem: p0.id, acao: 'receber' });
  ok(!x.j.erro && d().ouro === 61500 && (d().nivel > nivelAntes || d().exp === expAntes + 60000) && /EXP/.test(x.j.resultado.avisos[0].texto),
    'torre: crédito com EXP sobe a experiência e avisa'); }
x = await pedir({ personagem: p0.id, acao: 'sincronizarCla', args: { id: 1, skills: { exp: 10 } } });
ok(!x.j.erro && d().cla.skills.exp === 3, 'clã: as skills vêm do banco, não do navegador');
x = await pedir({ personagem: p0.id, acao: 'missao', args: ['diarias', 'monstros'] });
ok(x.j.erro, 'missão não concluída: recusada');
// missões da Arena/masmorra: só contam com a luta conferida no banco (segurança, nov/2026)
const arenaAntes = JSON.stringify((d().missoes || {}));
x = await pedir({ personagem: p0.id, acao: 'eventoJogo', args: { tipo: 'arena', vitoria: true } });
ok(x.j.resultado && x.j.resultado.ignorado, 'Arena: "venci" sem luta de verdade não conta');
x = await pedir({ personagem: p0.id, acao: 'eventoJogo', args: { tipo: 'arena', luta: 77 } });
ok(x.j.resultado && x.j.resultado.ignorado, 'Arena: luta de outra pessoa não conta');
x = await pedir({ personagem: p0.id, acao: 'eventoJogo', args: { tipo: 'arena', luta: 76 } });
ok(x.j.resultado && !x.j.resultado.ignorado && JSON.stringify(d().missoes) !== arenaAntes, 'Arena: luta de verdade conta');
x = await pedir({ personagem: p0.id, acao: 'eventoJogo', args: { tipo: 'arena', luta: 76 } });
ok(x.j.resultado && x.j.resultado.ignorado, 'Arena: a mesma luta não conta duas vezes');
x = await pedir({ personagem: p0.id, acao: 'eventoJogo', args: { tipo: 'masmorra', run: 999 } });
ok(x.j.resultado && x.j.resultado.ignorado, 'masmorra: número inventado não conta');
const ouroPref = d().ouro;
x = await pedir({ personagem: p0.id, acao: 'preferencias', args: { ouro: 99999999, nivel: 60, caixaVista: 123, prefsCacada: { pocao: 30, chefe: 'lutar' } } });
ok(!x.j.erro && d().ouro === ouroPref && d().nivel < 60 && d().caixaVista === 123 && d().prefsCacada.pocao === 30, 'preferências: grava só os campos permitidos');
x = await pedir({ personagem: p0.id, acao: 'acampar', args: true });
ok(!x.j.erro && !!d().acampado === (Tanka.dados.ESTAMINA.acampar !== false), 'acampar');

recusarGravacao = 'Proteção do jogo: ouro demais de uma vez.';
const v = d().versao;
x = await pedir({ personagem: p0.id, acao: 'habilidadeAuto', args: true });
ok(x.j.erro === recusarGravacao && x.j.personagem && d().versao === v, 'banco recusou: devolve o erro e o personagem do banco');
recusarGravacao = '';

// Brechas (Henri, nov/2026): o servidor refaz a luta e diz o resultado; o que o navegador manda não conta
const simM = R.simularMasmorra([heroi.dados], runMasmorra.masmorra, runMasmorra.semente);
x = await pedir({ personagem: p0.id, acao: 'masmorraConcluir', args: { run: 5, vitoria: !simM.vitoria } });
ok(x.j.resultado && x.j.resultado.vitoria === !!simM.vitoria && lutasRegistradas.at(-1).corpo.vitoria === !!simM.vitoria,
  'masmorra: o resultado é o da luta refeita no servidor (' + (simM.vitoria ? 'vitória' : 'derrota') + ')');
x = await pedir({ personagem: p0.id, acao: 'masmorraConcluir', args: { run: 6 } });
ok(x.j.erro, 'masmorra que não existe: erro');
const simB = R.simularBossAlianca([heroi.dados], 1, 49140, 777, 0);
x = await pedir({ personagem: p0.id, acao: 'bossClaConcluir', args: { run: 9, danos: [999999999] } });
ok(JSON.stringify(lutasRegistradas.at(-1).corpo.danos) === JSON.stringify(simB.danos), 'boss do clã: o dano é o da luta refeita no servidor');
x = await pedir({ personagem: p0.id, acao: 'bossMundial', args: { dano: 999999 } });
const ultimo = lutasRegistradas.at(-1).corpo;
ok(x.j.eventos && x.j.eventos.length > 0 && ultimo.dano === 5_000_000 - x.j.eventos.at(-1).mh && ultimo.dano < 999999,
  'Ignaroth: a luta é no servidor e o dano sai dela (' + ultimo.dano + ')');
const acoesJ = x.j.eventos.filter((e: any) => e.ev.ator === 'jogador' || e.ev.habilidade).length;
ok(acoesJ <= Tanka.dados.CHEFE_MUNDIAL.acoesPorAtaque, 'Ignaroth: no máximo ' + Tanka.dados.CHEFE_MUNDIAL.acoesPorAtaque + ' ações (' + acoesJ + ')');
ok(d().versao === v, 'lutas do servidor não mexem na ficha');

// Masmorra com caminhos (16/11/2026): o servidor luta, abre a votação, resolve pelo relógio e guarda os prêmios uma vez
g.Deno.env.get = (k: string) => k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'chave-teste' : '';
x = await pedir({ personagem: p0.id, acao: 'masmorraAvancar', args: { run: 8 } });
ok(x.j.resultado && x.j.resultado.etapa.log.length === 1 && (x.j.resultado.etapa.prazo || x.j.resultado.etapa.fim) && runCam.versao === 1, 'masmorra: 1ª luta e votação aberta ou fim (versão 1)');
x = await pedir({ personagem: p0.id, acao: 'masmorraAvancar', args: { run: 8 } });
ok(runCam.versao === 1, 'masmorra: antes do prazo não muda nada');
const real = Date.now; let falso = real() + 60_000; Date.now = () => (falso += 60_000);
for (let i = 0; i < 12 && runCam.estado === 'andamento'; i++) await pedir({ personagem: p0.id, acao: 'masmorraAvancar', args: { run: 8 } });
Date.now = real;
ok(runCam.etapa.fim && finalizados.length === 1 && (runCam.etapa.fim === 'derrota' || finalizados[0].premios.length > 0), 'masmorra: terminou e guardou os prêmios uma vez (' + runCam.etapa.fim + ')');
x = await pedir({ personagem: 'outro', acao: 'masmorraAvancar', args: { run: 8 } });
ok(x.j.erro, 'masmorra: quem não é do grupo não avança');
// Torre do Eclipse: monta, espera as escolhas, resolve, narra e sobe; quem não é do grupo não mexe
x = await pedir({ personagem: p0.id, acao: 'torreAvancar', args: { run: 11 } });
ok(x.j.resultado && runTorre.torre && runTorre.torre.fase === 'escolha' && runTorre.versao === 1 && runTorre.torre.herois.length === 4, 'torre: montou o andar 1 (escolha aberta)');
x = await pedir({ personagem: p0.id, acao: 'torreAvancar', args: { run: 11 } });
ok(runTorre.versao === 1, 'torre: sem escolhas e antes do prazo, nada muda');
runTorre.escolhas = Object.fromEntries(runTorre.membros.map((m: string) => [m, { acao: 'atacar', alvo: 0, ordem: 2 }]));
x = await pedir({ personagem: p0.id, acao: 'torreAvancar', args: { run: 11 } });
ok(runTorre.torre.fase === 'narrando' && runTorre.torre.turno === 1 && runTorre.torre.log.length > 0 && Object.keys(runTorre.escolhas).length === 0, 'torre: os 4 escolheram e o turno foi resolvido');
const realT = Date.now; let falsoT = realT(); Date.now = () => (falsoT += 30_000);
for (let i = 0; i < 400 && runTorre.estado === 'andamento' && runTorre.torre.andar < 3; i++) await pedir({ personagem: p0.id, acao: 'torreAvancar', args: { run: 11 } });
Date.now = realT;
ok(torreReg.length > 0 && (torreReg[0].andar === 1 || torreReg[0].fim === 'derrota'), 'torre: andar vencido vai para o recorde (ou derrota registrada): ' + JSON.stringify(torreReg[0]));
x = await pedir({ personagem: 'outro', acao: 'torreAvancar', args: { run: 11 } });
ok(x.j.erro, 'torre: quem não é do grupo não avança');
g.Deno.env.get = () => '';

// Baú da conta (Henri, 18/11/2026): guardar tira da ficha; com a chave do servidor vai para o banco e a fila zera
{
  const pb = banco[p0.id].dados; pb.ouro = 10000; R.mudarConsumivel(pb, 'pergaminho', 'rara', 4);
  const pergAntes = R.qtdConsumivel(pb, 'pergaminho', 'rara');
  let y = await pedir({ personagem: p0.id, acao: 'bauDepositar', args: { ouro: 99999 } });
  ok(y.j.erro, 'baú: não guarda ouro que não tem');
  y = await pedir({ personagem: p0.id, acao: 'bauDepositar', args: { tipo: 'arma', raridade: 'rara', qtd: 1 } });
  ok(y.j.erro, 'baú: item não entra');
  y = await pedir({ personagem: p0.id, acao: 'bauDepositar', args: { ouro: 3000 } });
  ok(y.j.erro && banco[p0.id].dados.ouro === 10000, 'baú: ouro não fica guardado (precisa de um personagem que recebe)');
  y = await pedir({ personagem: p0.id, acao: 'bauDepositar', args: { ouro: 3000, para: 'outro' } });   // sem a chave: fica na fila
  ok(!y.j.erro && banco[p0.id].dados.ouro === 7000 && banco[p0.id].dados.bauSaida.length === 1 && !bauGuardados.length, 'baú: sem a chave do servidor o depósito espera na fila');
  g.Deno.env.get = (k: string) => k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'chave-teste' : '';
  y = await pedir({ personagem: p0.id, acao: 'bauDepositar', args: { tipo: 'pergaminho', raridade: 'rara', qtd: 3 } });
  const fim = banco[p0.id].dados;
  ok(!y.j.erro && bauGuardados.length === 2 && fim.bauSaida.length === 0 && R.qtdConsumivel(fim, 'pergaminho', 'rara') === pergAntes - 3,
    'baú: com a chave os dois depósitos vão para o banco e a fila zera');
  ok(bauGuardados[0].mov.ouro === 3000 && bauGuardados[0].mov.para === 'outro' && bauGuardados[1].mov.qtd === 3, 'baú: o banco recebe o que saiu da ficha');
  g.Deno.env.get = () => '';
  pendentes = { recompensas: [{ id: 901, origem: 'bau', item: { tipo: 'bau', ctipo: 'pergaminho', raridade: 'rara', qtd: 2 } }], creditos: [] };
  y = await pedir({ personagem: p0.id, acao: 'receber' });
  ok(R.qtdConsumivel(banco[p0.id].dados, 'pergaminho', 'rara') === pergAntes - 1, 'baú: o que foi retirado chega na ficha pelo receber');
  pendentes = { recompensas: [], creditos: [] };
}

// Evento Altar dos Elementos (Daniel, 18/11/2026): só entra com o evento aberto; 5 partidas por dia; pontos vão para o banco
{
  let y = await pedir({ personagem: p0.id, acao: 'altarEntrar' });
  ok(y.j.erro, 'evento: fechado, não entra');
  eventoAberto = { id: 'altar-teste', tipo: 'altar', nome: 'Altar' };
  y = await pedir({ personagem: p0.id, acao: 'altarEntrar' });
  const pt = banco[p0.id].dados.altar.partida;
  ok(!y.j.erro && pt && pt.dados.length === 5 && pt.rolagens === R.novaPartidaAltar(Math.random).rolagens, 'evento: entra e o servidor sorteia a mesa e os elementos');
  y = await pedir({ personagem: p0.id, acao: 'altarEntrar' });
  ok(y.j.erro, 'evento: não abre outra com uma aberta');
  y = await pedir({ personagem: p0.id, acao: 'altarRolar', args: { manter: [0] } });
  ok(!y.j.erro && banco[p0.id].dados.altar.partida.rolagens === pt.rolagens - 1, 'evento: rolar gasta 1');
  y = await pedir({ personagem: p0.id, acao: 'altarPagar', args: { monte: 0, dados: [0, 1, 2, 3, 4] } });
  ok(y.j.erro || y.j.resultado, 'evento: pagar responde (aceita só se bater)');
  g.Deno.env.get = (k: string) => k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'chave-teste' : '';
  y = await pedir({ personagem: p0.id, acao: 'altarEncerrar' });
  ok(!y.j.erro && eventoRegistros.length === 1 && eventoRegistros[0].reg.evento === 'altar-teste' && !banco[p0.id].dados.altar.partida
    && banco[p0.id].dados.eventoSaida.length === 0, 'evento: encerrar manda os pontos para o ranking e a fila zera');
  g.Deno.env.get = () => '';
  for (let k = 0; k < 4; k++) { await pedir({ personagem: p0.id, acao: 'altarEntrar' }); await pedir({ personagem: p0.id, acao: 'altarEncerrar' }); }
  y = await pedir({ personagem: p0.id, acao: 'altarEntrar' });
  ok(y.j.erro && /5 partidas/.test(y.j.erro), 'evento: só 5 partidas por dia');
}

// Ficha resumida (21/11/2026): "preferencias" (a cada minuto) volta só com o que mudou, e a ficha montada bate
{
  const jogo = JSON.parse(JSON.stringify(d()));
  const z = await pedir({ personagem: p0.id, acao: 'preferencias', args: { caixaVista: 7 }, versaoCliente: jogo.versao });
  const m = R.aplicarFicha(jogo, z.j);
  ok(!z.j.personagem && z.j.mudou && m.ok && R.hashFicha(m.ficha) === R.hashFicha(d()),
    'ficha resumida: preferências voltam com ' + JSON.stringify(z.j).length + ' bytes (ficha: ' + JSON.stringify(d()).length + ') e batem com o banco');
  const z2 = await pedir({ personagem: p0.id, acao: 'preferencias', args: { caixaVista: 8 }, versaoCliente: 1 });
  ok(z2.j.personagem && !z2.j.mudou, 'ficha resumida: versão velha recebe a ficha inteira');
}
console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES DA FUNÇÃO acao PASSARAM');
if (falhas) (g.Deno?.exit ?? g.process?.exit)?.(1);
