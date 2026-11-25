// Teste da Edge Function `pagamento` (compra de Éter no site, Mercado Pago) com Supabase e Mercado Pago de mentira.
// Rodar: deno run --allow-env testes/pagamento_servidor.test.ts
//   (ou, sem Deno: node --experimental-strip-types testes/pagamento_servidor.test.ts)
const g = globalThis as any;
const ENV: Record<string, string> = { MP_ACCESS_TOKEN: 'tok-mp', MP_WEBHOOK_SECRET: 'segredo', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
if (!g.Deno) g.Deno = { env: { get: (k: string) => ENV[k] } };
else for (const k of Object.keys(ENV)) g.Deno.env.set(k, ENV[k]);
const { tratar, assinaturaValida } = await import('../supabase/functions/pagamento/index.ts');

let falhas = 0;
function ok(cond: unknown, msg: string) { if (cond) console.log('ok   ' + msg); else { falhas++; console.log('FALHA ' + msg); } }
const BASE = 'https://banco.teste';
const PEDIDO = '11111111-2222-3333-4444-555555555555';
const rpcs: any[] = [];
let preferencia: any = null;
let pagamentoMP: any = { id: 123, status: 'approved', transaction_amount: 30, currency_id: 'BRL', external_reference: PEDIDO };
g.fetch = (async (url: string, init: any = {}) => {
  const u = new URL(url), h = init.headers || {};
  const json = (x: unknown, st = 200) => new Response(JSON.stringify(x), { status: st });
  if (u.pathname === '/auth/v1/user') return h.Authorization === 'Bearer tok-u1' ? json({ id: 'u1' }) : json({}, 401);
  if (u.pathname.startsWith('/rest/v1/rpc/')) {
    if (h.apikey !== 'srv') return json({ message: 'sem permissão' }, 401);
    const nome = u.pathname.slice('/rest/v1/rpc/'.length), corpo = JSON.parse(init.body);
    rpcs.push({ nome, corpo });
    if (nome === 'eter_pedido_criar') return corpo.pacote === 'eter30' ? json({ id: PEDIDO, pacote: 'eter30', eter: 30, valor: 30 }) : json({ message: 'Pacote inválido.' }, 400);
    if (nome === 'eter_mp_atualizar') return json({ ok: true, creditou: 30 });
  }
  if (u.host === 'api.mercadopago.com') {
    if (h.Authorization !== 'Bearer tok-mp') return json({}, 401);
    if (u.pathname === '/checkout/preferences') { preferencia = JSON.parse(init.body); return json({ init_point: 'https://mp/pagar/1' }); }
    if (u.pathname === '/v1/payments/123') return json(pagamentoMP);
  }
  return json({ erro: 'rota ' + url }, 404);
}) as any;

async function hmac(segredo: string, texto: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto)))).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const jogador = (corpo: unknown, token = 'tok-u1') => new Request(BASE + '/functions/v1/pagamento', {
  method: 'POST', headers: { Authorization: 'Bearer ' + token, apikey: 'pub' }, body: JSON.stringify(corpo) });
async function aviso(id: string, assinar = true) {
  const ts = '1700000000', req = 'req-1';
  const v1 = assinar ? await hmac('segredo', 'id:' + id + ';request-id:' + req + ';ts:' + ts + ';') : 'abc';
  return new Request(BASE + '/functions/v1/pagamento?webhook=1&data.id=' + id + '&type=payment', {
    method: 'POST', headers: { 'x-signature': 'ts=' + ts + ',v1=' + v1, 'x-request-id': req },
    body: JSON.stringify({ type: 'payment', data: { id } }) });
}

// 1. criar o pagamento
let r = await tratar(jogador({ pacote: 'eter30' }), BASE);
let j = await r.json();
ok(r.status === 200 && j.url === 'https://mp/pagar/1', 'cria a página de pagamento');
ok(rpcs[0]?.nome === 'eter_pedido_criar' && rpcs[0].corpo.c === 'u1', 'o pedido é da conta do login (não do que o navegador manda)');
ok(preferencia?.items?.[0]?.unit_price === 30 && preferencia.external_reference === PEDIDO, 'preço e referência vêm do banco');
ok(/\/functions\/v1\/pagamento\?webhook=1$/.test(preferencia?.notification_url), 'aviso do Mercado Pago volta para a função');
r = await tratar(jogador({ pacote: 'eter30', preco: 1 }, 'tok-ruim'), BASE);
ok(r.status === 401, 'sem login não compra');
r = await tratar(jogador({ pacote: 'gratis' }), BASE);
ok(r.status === 400, 'pacote que não existe é recusado');

// 2. aviso do Mercado Pago
rpcs.length = 0;
r = await tratar(await aviso('123'), BASE);
j = await r.json();
ok(r.status === 200 && j.creditou === 30, 'aviso assinado: confere na API e dá o Éter');
ok(rpcs[0]?.nome === 'eter_mp_atualizar' && rpcs[0].corpo.st === 'approved' && rpcs[0].corpo.pago === 30 && rpcs[0].corpo.pedido === PEDIDO,
  'status e valor vêm da API do Mercado Pago');
rpcs.length = 0;
r = await tratar(await aviso('123', false), BASE);
ok(r.status === 401 && rpcs.length === 0, 'aviso sem assinatura certa é recusado');
pagamentoMP = { ...pagamentoMP, currency_id: 'USD' };
rpcs.length = 0;
r = await tratar(await aviso('123'), BASE);
ok(rpcs.length === 0, 'pagamento em outra moeda é ignorado');
ok(await assinaturaValida('segredo', 'ts=1,v1=' + await hmac('segredo', 'id:abc1;request-id:x;ts:1;'), 'x', 'ABC1'), 'assinatura: id com letras vai em minúsculas');

if (falhas) { console.log(falhas + ' FALHA(S)'); (g.Deno?.exit ?? process.exit)(1); }
console.log('TODOS OS TESTES DO PAGAMENTO PASSARAM');
