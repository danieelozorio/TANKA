// Edge Function `acao` (plano "tudo no servidor", Henri, nov/2026): ações do herói decididas aqui, no servidor.
// O jogo manda { personagem, acao, args } com o login do jogador (Authorization). A função:
//   1. confere o login (Auth do Supabase) e carrega o personagem do banco COM o login do jogador (só lê o que é dele);
//   2. roda a ação (js/servidor-acoes.js, empacotado em _shared/tanka.js) com o relógio e o sorteio do servidor;
//   3. grava o personagem com a proteção de versão (como o jogo faz) e devolve o personagem novo.
// Ação recusada: devolve { erro } e o personagem como está no banco (o jogo volta para ele).
// Publicada sem "verify JWT" do gateway, como a `cacada`: o login é conferido no passo 1.
import Tanka from '../_shared/tanka.js';

const R = Tanka.regras, A = Tanka.servidorAcoes;
const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export async function tratar(req: Request, base = URL_SUPABASE, agora = () => Date.now(), sorteio = Math.random): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ erro: 'Use POST.' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  if (!auth.startsWith('Bearer ') || !apikey) return responder({ erro: 'Entre na sua conta.' }, 401);
  const cab = { apikey, Authorization: auth, 'Content-Type': 'application/json' };

  let pedido: Record<string, unknown>;
  try { pedido = await req.json(); } catch { return responder({ erro: 'Pedido inválido.' }, 400); }
  const id = String(pedido.personagem ?? '');
  const acao = String(pedido.acao ?? '');
  if (!id || !A.acoes.includes(acao)) return responder({ erro: 'Pedido inválido.' }, 400);

  // 1. login e personagem (com o login do jogador: o banco só devolve se for dele)
  const u = await fetch(base + '/auth/v1/user', { headers: cab });
  if (!u.ok) return responder({ erro: 'Sessão expirada. Entre novamente.' }, 401);
  const usuario = await u.json();
  const r = await fetch(base + '/rest/v1/personagens?id=eq.' + encodeURIComponent(id) + '&select=conta_id,dados', { headers: cab });
  const linhas = r.ok ? await r.json() : [];
  if (!linhas.length || linhas[0].conta_id !== usuario.id) return responder({ erro: 'Personagem não encontrado.' }, 403);
  const p = R.normalizar(linhas[0].dados);
  const versao = Number(linhas[0].dados.versao) || 0;
  const antesNormal = JSON.stringify(p);

  // 2. o que vem do banco (nunca do navegador): prêmios/créditos pendentes e as skills do clã
  const extra: Record<string, unknown> = {};
  const rpc = (nome: string, corpo: unknown) => fetch(base + '/rest/v1/rpc/' + nome, { method: 'POST', headers: cab, body: JSON.stringify(corpo) });
  if (acao === 'receber') {
    const pd = await rpc('pendentes', { meu: id });
    if (!pd.ok) return responder({ erro: 'Não foi possível ler os prêmios.', personagem: linhas[0].dados });
    extra.pendentes = await pd.json();
  }
  if (acao === 'sincronizarCla') {
    const b = await rpc('cacada_bonus', { meu: id });
    if (b.ok) { const cla = await b.json(); extra.cla = cla && cla.cla ? cla.cla : null; }
  }

  // 3. a regra, com o relógio e o sorteio do servidor
  const t = agora();
  const antesTempo = JSON.parse(antesNormal);
  R.atualizarTempo(antesTempo, t);
  antesTempo.poder = R.poder(antesTempo);
  const antes = JSON.stringify(antesTempo);   // (a estamina que encheu sozinha não conta como mudança)
  const saida = A.executar(p, acao, pedido.args, t, sorteio, extra);
  if (saida.erro) return responder({ erro: saida.erro, personagem: linhas[0].dados, agora: t });

  // nada mudou (ex.: prêmio que não cabe na mochila): não grava de novo (preferências gravam sempre: marca "online")
  if (acao !== 'preferencias' && JSON.stringify(p) === antes) return responder({ personagem: linhas[0].dados, agora: t, resultado: saida.resultado });

  // 4. grava com a proteção de versão (se outra aba gravou antes, nada é sobrescrito)
  p.versao = versao + 1;
  const filtro = versao ? 'dados->>versao=eq.' + versao : 'dados->>versao=is.null';
  const g = await fetch(base + '/rest/v1/personagens?id=eq.' + encodeURIComponent(id) + '&' + filtro + '&select=id', {
    method: 'PATCH', headers: { ...cab, Prefer: 'return=representation' }, body: JSON.stringify({ dados: p }),
  });
  if (!g.ok) {
    let msg = 'Não foi possível salvar.';
    try { const e = await g.json(); if (e && e.message) msg = e.message; } catch { /* sem corpo */ }
    return responder({ erro: msg, personagem: linhas[0].dados, agora: t });
  }
  const gravou = await g.json();
  if (!gravou.length) return responder({ erro: 'Este personagem foi jogado em outra aba ou aparelho. Recarregando...', conflito: true }, 409);
  // 5. prêmios entregues: só agora (depois de gravar) marca como recebidos (p.recebidas evita repetir se falhar)
  if (acao === 'receber' && saida.resultado) {
    const r5 = saida.resultado as { entregues: number[]; creditos: number[] };
    for (const rid of r5.entregues) await rpc('recompensa_resgatar', { meu: id, recompensa: rid }).catch(() => null);
    for (const cid of r5.creditos) await rpc('credito_aplicar', { meu: id, credito: cid }).catch(() => null);
  }
  return responder({ personagem: p, agora: t, resultado: saida.resultado });
}

if (import.meta.main) Deno.serve((req) => tratar(req));
