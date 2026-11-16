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
  if (u.pathname === '/rest/v1/masmorra_runs') return json(Number((u.searchParams.get('id') || '').replace('eq.', '')) === 5 ? [runMasmorra] : []);
  if (u.pathname === '/rest/v1/alianca_boss_runs') return json([runBoss]);
  if (u.pathname === '/rest/v1/rpc/masmorra_concluir' || u.pathname === '/rest/v1/rpc/alianca_boss_concluir' || u.pathname === '/rest/v1/rpc/boss_atacar') {
    lutasRegistradas.push({ rota: u.pathname, corpo: JSON.parse(init.body) });
    return json(u.pathname.endsWith('boss_atacar') ? { dano: JSON.parse(init.body).dano } : u.pathname.endsWith('alianca_boss_concluir') ? { dano: 1 } : null);
  }
  if (u.pathname === '/rest/v1/rpc/boss_estado') return json({ boss: { id: 1, vida: 5_000_000, vida_max: 5_000_000 } });
  return json({ erro: 'rota ' + u.pathname }, 404);
}) as typeof fetch;
const lutasRegistradas: any[] = [];
const heroi = { id: p0.id, dados: JSON.parse(JSON.stringify(p0)) };
const runMasmorra = { id: 5, lider: p0.id, membros: [p0.id], grupo_id: 1, estado: 'andamento', masmorra: Tanka.dados.masmorras[0].id, herois: [heroi], semente: 12345 };
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
x = await pedir({ personagem: p0.id, acao: 'sincronizarCla', args: { id: 1, skills: { exp: 10 } } });
ok(!x.j.erro && d().cla.skills.exp === 3, 'clã: as skills vêm do banco, não do navegador');
x = await pedir({ personagem: p0.id, acao: 'missao', args: ['diarias', 'monstros'] });
ok(x.j.erro, 'missão não concluída: recusada');
x = await pedir({ personagem: p0.id, acao: 'eventoJogo', args: { tipo: 'arena', vitoria: true } });
x = await pedir({ personagem: p0.id, acao: 'eventoJogo', args: { tipo: 'arena', vitoria: true } });
ok(x.j.resultado && x.j.resultado.ignorado, 'evento da Arena repetido em menos de 8 s: ignorado');
const ouroPref = d().ouro;
x = await pedir({ personagem: p0.id, acao: 'preferencias', args: { ouro: 99999999, nivel: 60, caixaVista: 123, prefsCacada: { pocao: 30, chefe: 'lutar' } } });
ok(!x.j.erro && d().ouro === ouroPref && d().nivel === 12 && d().caixaVista === 123 && d().prefsCacada.pocao === 30, 'preferências: grava só os campos permitidos');
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

console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES DA FUNÇÃO acao PASSARAM');
if (falhas) (g.Deno?.exit ?? g.process?.exit)?.(1);
