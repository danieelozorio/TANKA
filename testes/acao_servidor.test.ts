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
g.fetch = (async (url: string, init: any = {}) => {
  const u = new URL(url), h = init.headers || {};
  const token = String(h.Authorization || '').replace('Bearer ', '');
  const json = (x: unknown, st = 200) => new Response(JSON.stringify(x), { status: st });
  if (u.pathname === '/auth/v1/user') return token === 'tok-u1' ? json({ id: 'u1' }) : json({ msg: 'bad' }, 401);
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
  return json({ erro: 'rota ' + u.pathname }, 404);
}) as typeof fetch;

const base = 'https://x.supabase.co';
const pedir = async (corpo: unknown, token = 'tok-u1') => {
  const r = await tratar(new Request(base + '/functions/v1/acao', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, apikey: 'pub', 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  }), base, () => 1_800_000_000_000);
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

recusarGravacao = 'Proteção do jogo: ouro demais de uma vez.';
const v = d().versao;
x = await pedir({ personagem: p0.id, acao: 'habilidadeAuto', args: true });
ok(x.j.erro === recusarGravacao && x.j.personagem && d().versao === v, 'banco recusou: devolve o erro e o personagem do banco');
recusarGravacao = '';

console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES DA FUNÇÃO acao PASSARAM');
if (falhas) (g.Deno?.exit ?? g.process?.exit)?.(1);
