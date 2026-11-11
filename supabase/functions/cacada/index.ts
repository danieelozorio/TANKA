// Edge Function `cacada` (plano anti-trapaça, etapa 1): a caçada é decidida aqui, no servidor.
// O jogo manda { acao: 'encontro' | 'lutar' | 'pocao' | 'fim' | 'fugir', personagem, alvos?, pocao?, continuar?,
// trocarPorNormal?, etapas?, turno? } (etapas: luta em etapas; pocao: bebe no `turno`; fim: aplica o resultado).
// com o login do jogador (Authorization). A função:
//   1. confere o login (Auth do Supabase) e carrega o personagem do banco COM o login do jogador (só lê o que é dele);
//   2. pega o bônus do clã no banco (rpc cacada_bonus), sem confiar no que o navegador diz;
//   3. roda a regra (js/servidor-cacada.js, empacotado em _shared/tanka.js) com o relógio e o sorteio do servidor;
//   4. grava o personagem com a proteção de versão (como o jogo faz) e devolve o resultado + o personagem novo.
// Publicada sem "verify JWT" do gateway (as chaves novas do Supabase não usam o segredo antigo): o login é conferido
// no passo 1. Não usa a chave secreta: tudo passa pelas regras de segurança do banco (RLS).
import Tanka from '../_shared/tanka.js';

const R = Tanka.regras, S = Tanka.servidorCacada;
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
  if (!id || !['encontro', 'lutar', 'pocao', 'fim', 'fugir'].includes(acao)) return responder({ erro: 'Pedido inválido.' }, 400);

  // 1. login
  const u = await fetch(base + '/auth/v1/user', { headers: cab });
  if (!u.ok) return responder({ erro: 'Sessão expirada. Entre novamente.' }, 401);
  const usuario = await u.json();

  // 2. personagem (com o login do jogador: o banco só devolve se for dele)
  const r = await fetch(base + '/rest/v1/personagens?id=eq.' + encodeURIComponent(id) + '&select=conta_id,dados', { headers: cab });
  const linhas = r.ok ? await r.json() : [];
  if (!linhas.length || linhas[0].conta_id !== usuario.id) return responder({ erro: 'Personagem não encontrado.' }, 403);
  const p = R.normalizar(linhas[0].dados);
  const versao = Number(linhas[0].dados.versao) || 0;

  // 3. bônus do clã (skills e bônus de 7 dias), direto do banco
  let bonus = { exp: 0, ouro: 0 };
  if (acao === 'lutar') {
    const b = await fetch(base + '/rest/v1/rpc/cacada_bonus', { method: 'POST', headers: cab, body: JSON.stringify({ meu: id }) });
    if (b.ok) {
      const cla = await b.json();
      if (cla && cla.cla) p.cla = cla.cla; else delete p.cla;
      bonus = { exp: R.bonusCla(p, 'exp') + (Number(cla?.exp) || 0), ouro: R.bonusCla(p, 'ouro') + (Number(cla?.ouro) || 0) };
    }
  }

  // 4. a regra, com o relógio e o sorteio do servidor
  const t = agora();
  let saida: Record<string, unknown>;
  if (acao === 'encontro') saida = S.encontro(p, pedido.alvos, t, sorteio);
  else if (acao === 'fugir') saida = S.fugir(p, t, !!pedido.trocarPorNormal);
  else if (acao === 'pocao') saida = S.pocao(p, t, pedido.turno);
  else if (acao === 'fim') saida = S.fim(p, t, sorteio, { alvos: pedido.alvos, continuar: pedido.continuar });
  else saida = S.lutar(p, t, sorteio, bonus, { alvos: pedido.alvos, pocao: pedido.pocao, continuar: pedido.continuar, etapas: !!pedido.etapas });
  if (saida.erro) return responder(saida);

  // 5. grava com a proteção de versão (se outra aba gravou antes, nada é sobrescrito)
  p.versao = versao + 1;
  const filtro = versao ? 'dados->>versao=eq.' + versao : 'dados->>versao=is.null';
  const g = await fetch(base + '/rest/v1/personagens?id=eq.' + encodeURIComponent(id) + '&' + filtro + '&select=id', {
    method: 'PATCH', headers: { ...cab, Prefer: 'return=representation' }, body: JSON.stringify({ dados: p }),
  });
  const gravou = g.ok ? await g.json() : [];
  if (!gravou.length) return responder({ erro: 'Este personagem foi jogado em outra aba ou aparelho. Recarregando...', conflito: true }, 409);
  return responder({ ...saida, personagem: p, agora: t });
}

if (import.meta.main) Deno.serve((req) => tratar(req));
