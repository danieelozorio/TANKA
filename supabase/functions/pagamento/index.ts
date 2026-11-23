// Edge Function `pagamento` (Henri, 22/11/2026): compra de Éter no site com o Mercado Pago (Checkout Pro).
// Dois caminhos:
//   • O jogo (com o login do jogador) manda { pacote } → a função confere o login, cria o pedido no banco
//     (eter_pedido_criar: preço de LOJA.pacotes, no servidor) e cria a "preferência" no Mercado Pago. Devolve { url }:
//     o jogo abre essa página, onde o jogador paga com Pix, cartão ou boleto.
//   • O Mercado Pago avisa aqui (?webhook=1) quando um pagamento muda. A função confere a assinatura do aviso, busca o
//     pagamento na API do Mercado Pago (nunca confia no que veio no aviso) e chama eter_mp_atualizar, que dá o Éter
//     uma vez só por pagamento aprovado (e tira de volta se for estornado).
// Segredos (Supabase > Edge Functions > Secrets; nunca no código nem no chat):
//   MP_ACCESS_TOKEN   = Access Token de produção do Mercado Pago (Suas integrações > Credenciais de produção)
//   MP_WEBHOOK_SECRET = Assinatura secreta do webhook (Suas integrações > Webhooks)
//   SITE_URL (opcional) = endereço do jogo; padrão https://eldrinonline.com.br
// Publicada sem "verify JWT" do gateway: o Mercado Pago não manda login; o do jogador é conferido aqui.
const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const MP_API = 'https://api.mercadopago.com';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function env(nome: string) { return Deno.env.get(nome) ?? ''; }
function cabecalhoServidor(): Record<string, string> | null {
  try {
    const k = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}').default;
    if (k) return { apikey: k, 'Content-Type': 'application/json' };
  } catch { /* sem a variável nova */ }
  const s = env('SUPABASE_SERVICE_ROLE_KEY');
  if (s) return { apikey: s, Authorization: 'Bearer ' + s, 'Content-Type': 'application/json' };
  return null;
}
async function rpc(base: string, nome: string, corpo: unknown) {
  const srv = cabecalhoServidor();
  if (!srv) throw new Error('sem chave do servidor');
  const r = await fetch(base + '/rest/v1/rpc/' + nome, { method: 'POST', headers: srv, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && (j.message || j.msg)) || 'Erro no banco.');
  return j;
}

// Assinatura do aviso (x-signature: "ts=...,v1=..."): HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
export async function assinaturaValida(segredo: string, xSig: string, xReq: string, dataId: string) {
  if (!segredo || !xSig) return false;
  const partes: Record<string, string> = {};
  for (const p of xSig.split(',')) { const [k, v] = p.split('=').map((x) => (x || '').trim()); if (k) partes[k] = v; }
  if (!partes.ts || !partes.v1) return false;
  let manifesto = '';
  if (dataId) manifesto += 'id:' + (/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId) + ';';
  if (xReq) manifesto += 'request-id:' + xReq + ';';
  manifesto += 'ts:' + partes.ts + ';';
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(manifesto)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== partes.v1.length) return false;
  let dif = 0; for (let i = 0; i < hex.length; i++) dif |= hex.charCodeAt(i) ^ partes.v1.charCodeAt(i);
  return dif === 0;
}

async function webhook(req: Request, url: URL, base: string) {
  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* aviso sem corpo */ }
  const tipo = String(corpo?.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? '');
  const dataId = String(url.searchParams.get('data.id') ?? corpo?.data?.id ?? '');
  if (tipo !== 'payment' || !/^\d+$/.test(dataId)) return responder({ ok: true, ignorado: true });
  const ok = await assinaturaValida(env('MP_WEBHOOK_SECRET'), req.headers.get('x-signature') ?? '', req.headers.get('x-request-id') ?? '', dataId);
  if (!ok) return responder({ erro: 'assinatura inválida' }, 401);
  const token = env('MP_ACCESS_TOKEN');
  if (!token) return responder({ erro: 'sem MP_ACCESS_TOKEN' }, 500);
  // Busca o pagamento de verdade no Mercado Pago.
  const r = await fetch(MP_API + '/v1/payments/' + dataId, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return responder({ erro: 'Mercado Pago ' + r.status }, 502);   // o Mercado Pago tenta de novo depois
  const pg = await r.json();
  const pedido = String(pg.external_reference ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(pedido) || pg.currency_id !== 'BRL') return responder({ ok: true, ignorado: true });
  const res = await rpc(base, 'eter_mp_atualizar', { mp: String(pg.id), pedido, st: String(pg.status ?? ''), pago: Number(pg.transaction_amount) || 0 });
  return responder(res);
}

async function criar(req: Request, base: string) {
  const auth = req.headers.get('Authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  if (!auth.startsWith('Bearer ') || !apikey) return responder({ erro: 'Entre na sua conta.' }, 401);
  let pedido: any;
  try { pedido = await req.json(); } catch { return responder({ erro: 'Pedido inválido.' }, 400); }
  const pacote = String(pedido?.pacote ?? '');
  if (!/^[a-z0-9]{1,20}$/.test(pacote)) return responder({ erro: 'Pacote inválido.' }, 400);
  const u = await fetch(base + '/auth/v1/user', { headers: { apikey, Authorization: auth } });
  if (!u.ok) return responder({ erro: 'Sessão expirada. Entre novamente.' }, 401);
  const usuario = await u.json();
  const token = env('MP_ACCESS_TOKEN');
  if (!token) return responder({ erro: 'A compra de Éter ainda não abriu.' }, 503);
  let ped: any;
  try { ped = await rpc(base, 'eter_pedido_criar', { c: usuario.id, pacote }); }
  catch (e) { return responder({ erro: (e as Error).message }, 400); }
  const site = (env('SITE_URL') || 'https://eldrinonline.com.br').replace(/\/$/, '');
  const volta = site + '/jogar/?pagamento=';
  const pref = {
    items: [{ id: ped.pacote, title: ped.eter + ' Éter · Eldrin Online', description: 'Moeda especial do Eldrin Online',
      category_id: 'virtual_goods', quantity: 1, unit_price: Number(ped.valor), currency_id: 'BRL' }],
    external_reference: ped.id,
    notification_url: base + '/functions/v1/pagamento?webhook=1',
    back_urls: { success: volta + 'ok', pending: volta + 'pendente', failure: volta + 'falhou' },
    auto_return: 'approved',
    statement_descriptor: 'ELDRIN',
  };
  const r = await fetch(MP_API + '/checkout/preferences', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Idempotency-Key': ped.id },
    body: JSON.stringify(pref) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.init_point) return responder({ erro: 'Não foi possível abrir o pagamento. Tente de novo.' }, 502);
  return responder({ url: j.init_point, pedido: ped.id });
}

export async function tratar(req: Request, base = URL_SUPABASE): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ erro: 'Use POST.' }, 405);
  const url = new URL(req.url);
  try {
    if (url.searchParams.get('webhook') === '1') return await webhook(req, url, base);
    return await criar(req, base);
  } catch (e) {
    console.error('pagamento:', (e as Error).message);
    return responder({ erro: 'Erro no servidor.' }, 500);
  }
}

if (import.meta.main) Deno.serve((req) => tratar(req));
