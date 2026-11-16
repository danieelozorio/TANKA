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

  // 2. a regra, com o relógio do servidor
  const t = agora();
  const saida = A.executar(p, acao, pedido.args, t, sorteio);
  if (saida.erro) return responder({ erro: saida.erro, personagem: linhas[0].dados, agora: t });

  // 3. grava com a proteção de versão (se outra aba gravou antes, nada é sobrescrito)
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
  return responder({ personagem: p, agora: t, resultado: saida.resultado });
}

if (import.meta.main) Deno.serve((req) => tratar(req));
