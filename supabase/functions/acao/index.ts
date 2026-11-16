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

// Etapa 5 do plano "tudo no servidor": o jogador não grava mais a ficha direto (o banco tranca). A função grava com a
// chave secreta do projeto (variável que o Supabase põe sozinho nas funções; nunca vai para o navegador), depois de
// conferir que o personagem é de quem pediu. Sem a chave (teste local), grava com o login do jogador, como antes.
function cabecalhoServidor(): Record<string, string> | null {
  try {
    const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
    if (k) return { apikey: k, 'Content-Type': 'application/json' };
  } catch { /* sem a variável nova */ }
  const s = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (s) return { apikey: s, Authorization: 'Bearer ' + s, 'Content-Type': 'application/json' };
  return null;
}

// Lutas que o servidor refaz sozinho (Henri, nov/2026): o navegador só mostra; quem diz o resultado é o servidor.
const LUTAS = ['masmorraConcluir', 'bossClaConcluir', 'bossMundial', 'masmorraAvancar'];
const MAX_PASSOS_MUNDIAL = 5000;

// Chama uma função do banco com a chave do servidor. Se o banco ainda não tem a função nova (schema não rodado),
// usa a antiga com o login do jogador.
async function rpcServidor(base: string, cab: Record<string, string>, nome: string, corpo: unknown, antiga?: string) {
  const srv = cabecalhoServidor();
  if (srv) {
    const r = await fetch(base + '/rest/v1/rpc/' + nome, { method: 'POST', headers: srv, body: JSON.stringify(corpo) });
    if (r.ok) return { ok: true, dados: await r.json().catch(() => null) };
    const e = await r.json().catch(() => ({}));
    if (!(antiga && (r.status === 404 || e?.code === 'PGRST202'))) return { ok: false, erro: e?.message || 'Erro no servidor.' };
  }
  if (!antiga) return { ok: false, erro: 'Servidor sem chave.' };
  const r = await fetch(base + '/rest/v1/rpc/' + antiga, { method: 'POST', headers: cab, body: JSON.stringify(corpo) });
  if (r.ok) return { ok: true, dados: await r.json().catch(() => null) };
  const e = await r.json().catch(() => ({}));
  return { ok: false, erro: e?.message || 'Erro no servidor.' };
}

async function lerServidor(base: string, cab: Record<string, string>, caminho: string) {
  const r = await fetch(base + '/rest/v1/' + caminho, { headers: cabecalhoServidor() ?? cab });
  return r.ok ? await r.json() : [];
}

// deno-lint-ignore no-explicit-any
async function luta(acao: string, id: string, p: any, args: any, base: string, cab: Record<string, string>, sorteio: () => number) {
  args = args || {};
  if (acao === 'masmorraAvancar') {
    // Masmorra com caminhos (Henri, 16/11/2026): avança lutas e votações pelo relógio do servidor; no fim, sorteia e guarda os prêmios.
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const run = (await lerServidor(base, cab, 'masmorra_runs?id=eq.' + Number(args.run) + '&select=*'))[0];
      if (!run || !run.etapa) return { erro: 'Masmorra não encontrada.' };
      if (!(run.membros || []).includes(id)) return { erro: 'Você não está nessa masmorra.' };
      const pronto = (r: typeof run) => ({ resultado: { etapa: r.etapa, versao: r.versao, estado: r.estado, agora: Date.now() } });
      let etapa = run.etapa;
      if (run.estado === 'andamento' && !etapa.fim) etapa = R.avancarMasmorra(run, run.etapa, Date.now());
      if (etapa.fim && !etapa.premios) etapa.premios = etapa.fim === 'vitoria' ? R.lootMasmorra(run, etapa) : [];
      if (JSON.stringify(etapa) !== JSON.stringify(run.etapa)) {
        const srv = cabecalhoServidor();
        if (!srv) return { erro: 'Servidor sem chave.' };
        const w = await fetch(base + '/rest/v1/masmorra_runs?id=eq.' + run.id + '&versao=eq.' + run.versao, {
          method: 'PATCH', headers: { ...srv, Prefer: 'return=representation' }, body: JSON.stringify({ etapa, versao: run.versao + 1 }) });
        const linhas = w.ok ? await w.json() : [];
        if (!linhas.length) continue;   // outro jogador avançou ao mesmo tempo: lê de novo
        run.etapa = etapa; run.versao++;
      }
      if (etapa.fim && run.estado === 'andamento') {   // guarda os prêmios (uma vez só; repetir não faz nada)
        const f = await rpcServidor(base, cab, 'masmorra_finalizar', { run_id: run.id, vitoria: etapa.fim === 'vitoria', premios: etapa.premios || [] });
        if (f.ok) run.estado = etapa.fim;
      }
      return pronto(run);
    }
    return { erro: 'A masmorra está ocupada; tente de novo.' };
  }
  if (acao === 'masmorraConcluir') {
    const run = (await lerServidor(base, cab, 'masmorra_runs?id=eq.' + Number(args.run) + '&select=*'))[0];
    if (!run) return { erro: 'Masmorra não encontrada.' };
    if (run.etapa) return { erro: 'Atualize a página (F5) para jogar a masmorra nova.' };
    const sim = R.simularMasmorra(run.herois.map((h: { dados: unknown }) => h.dados), run.masmorra, run.semente);
    const r = await rpcServidor(base, cab, 'masmorra_registrar', { meu: id, run_id: run.id, vitoria: !!sim.vitoria }, 'masmorra_concluir');
    return r.ok ? { resultado: { vitoria: !!sim.vitoria } } : { erro: r.erro };
  }
  if (acao === 'bossClaConcluir') {
    const run = (await lerServidor(base, cab, 'alianca_boss_runs?id=eq.' + Number(args.run) + '&select=*'))[0];
    if (!run) return { erro: 'Investida não encontrada.' };
    const sim = R.simularBossAlianca(run.herois.map((h: { dados: unknown }) => h.dados), run.nivel, Number(run.hp_inicio), run.semente, Number(run.buff) || 0);
    const r = await rpcServidor(base, cab, 'alianca_boss_registrar', { meu: id, run_id: run.id, danos: sim.danos }, 'alianca_boss_concluir');
    return r.ok ? { resultado: r.dados } : { erro: r.erro };
  }
  // bossMundial: a luta inteira aqui (vida cheia, sem poção, até `acoesPorAtaque` ações do herói)
  const est = await fetch(base + '/rest/v1/rpc/boss_estado', { method: 'POST', headers: cab, body: JSON.stringify({ meu: id }) });
  const st = est.ok ? await est.json() : null;
  const bs = st && st.boss;
  if (!bs || !(Number(bs.vida) > 0)) return { erro: 'Ignaroth não está acordado agora.' };
  const chefe = R.chefeDoNivel(p);
  const b = R.iniciarBatalha(p, chefe, sorteio, { mundial: true });
  b.monstro.hp = Number(bs.vida); b.monstro.hpMax = Number(bs.vida_max);
  const vidaInicial = b.monstro.hp, limite = Tanka.dados.CHEFE_MUNDIAL.acoesPorAtaque;
  const eventos = [];
  let acoes = 0;
  for (let n = 0; !b.fim && n < MAX_PASSOS_MUNDIAL; n++) {
    const ev = R.passo(b);
    if (!ev) break;
    eventos.push({ ev, jh: b.jogador.hp, jm: b.jogador.hpMax, mh: b.monstro.hp, po: b.jogador.poder, pc: b.pocoes,
      at: b.monstro.atordoado || 0, tu: b.lutador ? b.lutador.turno : 0, pr: b.lutador ? Object.assign({}, b.lutador.pronto) : null });
    if ((ev.ator === 'jogador' || ev.habilidade) && ++acoes >= limite && !b.fim) b.fim = 'tempo';
  }
  if (!b.fim) b.fim = 'tempo';
  const dano = Math.max(0, Math.round(vidaInicial - Math.max(0, b.monstro.hp)));
  const r = await rpcServidor(base, cab, 'boss_atacar_servidor', { meu: id, dano, chefe }, 'boss_atacar');
  if (!r.ok) return { erro: r.erro };
  return { resultado: r.dados, eventos, fim: b.fim, chefe, vidaInicial };
}

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
  if (!id || !(A.acoes.includes(acao) || LUTAS.includes(acao))) return responder({ erro: 'Pedido inválido.' }, 400);

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
  if (LUTAS.includes(acao)) return responder({ ...(await luta(acao, id, p, pedido.args, base, cab, sorteio)), agora: agora() });

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
    method: 'PATCH', headers: { ...(cabecalhoServidor() ?? cab), Prefer: 'return=representation' }, body: JSON.stringify({ dados: p }),
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
  // missão do clã: o encanto conta aqui (o navegador não manda mais)
  if (acao === 'encantar' && saida.resultado) await rpcServidor(base, cab, 'alianca_missao_servidor', { pid: id, tipo: 'encantar', qtd: 1 }).catch(() => null);
  return responder({ personagem: p, agora: t, resultado: saida.resultado });
}

if (import.meta.main) Deno.serve((req) => tratar(req));
