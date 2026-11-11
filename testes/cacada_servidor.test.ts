// Teste da Edge Function `cacada` no Deno, com um Supabase de mentira (fetch trocado).
// Rodar: deno run --allow-read testes/cacada_servidor.test.ts
import Tanka from '../supabase/functions/_shared/tanka.js';
import { tratar } from '../supabase/functions/cacada/index.ts';

const R = Tanka.regras;
let falhas = 0;
function ok(cond: unknown, msg: string) { if (cond) console.log('ok   ' + msg); else { falhas++; console.log('FALHA ' + msg); } }

// "Banco": um personagem da conta u1 e um de outra conta
const p0 = R.criarPersonagem('Henri', 'masculino', 'humano', 'cavaleiro');
const banco: Record<string, { conta_id: string; dados: any }> = {
  [p0.id]: { conta_id: 'u1', dados: JSON.parse(JSON.stringify(p0)) },
  outro: { conta_id: 'u2', dados: JSON.parse(JSON.stringify(R.criarPersonagem('Outro', 'masculino', 'humano', 'mago'))) },
};
let bonusCla: any = { cla: null, exp: 0, ouro: 0 };
let gravacoes = 0;
let outraAbaNoMeio = false;   // simula outra aba gravando entre a leitura e a gravação
globalThis.fetch = (async (url: string, init: any = {}) => {
  const u = new URL(url), h = init.headers || {};
  const token = String(h.Authorization || '').replace('Bearer ', '');
  const json = (x: unknown, st = 200) => new Response(JSON.stringify(x), { status: st });
  if (u.pathname === '/auth/v1/user') return token === 'tok-u1' ? json({ id: 'u1' }) : json({ msg: 'bad' }, 401);
  if (u.pathname === '/rest/v1/rpc/cacada_bonus') return json(bonusCla);
  if (u.pathname === '/rest/v1/personagens') {
    const id = (u.searchParams.get('id') || '').replace('eq.', '');
    const linha = banco[id];
    if (!init.method || init.method === 'GET') return json(linha && linha.conta_id === 'u1' ? [linha] : []);   // RLS
    if (init.method === 'PATCH') {
      const v = u.searchParams.get('dados->>versao');
      if (outraAbaNoMeio) { linha.dados.versao = (linha.dados.versao || 0) + 1; outraAbaNoMeio = false; }
      const atual = linha.dados.versao;
      const bate = v === 'is.null' ? atual == null : 'eq.' + atual === v;
      if (!bate) return json([]);
      linha.dados = JSON.parse(init.body).dados; gravacoes++;
      return json([{ id }]);
    }
  }
  return json({ erro: 'rota ' + u.pathname }, 404);
}) as typeof fetch;

const base = 'https://x.supabase.co';
let relogio = 1_800_000_000_000;
const pedir = (corpo: unknown, token = 'tok-u1') => tratar(new Request(base + '/functions/v1/cacada', {
  method: 'POST', headers: { Authorization: 'Bearer ' + token, apikey: 'pub', 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
}), base, () => relogio);

let r = await pedir({ acao: 'encontro', personagem: p0.id, alvos: ['lobo', 'javali'] }, 'tok-ruim');
ok(r.status === 401, 'sem login válido: 401');
r = await pedir({ acao: 'encontro', personagem: 'outro', alvos: ['lobo'] });
ok(r.status === 403, 'personagem de outra conta: 403');
r = await pedir({ acao: 'lutar', personagem: p0.id });
ok((await r.json()).erro, 'lutar sem encontro: erro');
r = await pedir({ acao: 'encontro', personagem: p0.id, alvos: ['lobo', 'urso-pardo-inexistente', 'chefe'] });
let j = await r.json();
ok(j.encontro && j.encontro.monstro === 'lobo', 'encontro só entre os monstros válidos');
ok(banco[p0.id].dados.encontro && banco[p0.id].dados.versao === 1, 'encontro gravado com versão 1');
r = await pedir({ acao: 'lutar', personagem: p0.id });
ok((await r.json()).erro, 'lutar antes do monstro aparecer: erro');
relogio += 5000;
bonusCla = { cla: { id: 1, skills: {} }, exp: 15, ouro: 15 };
r = await pedir({ acao: 'lutar', personagem: p0.id, alvos: ['lobo'] });
j = await r.json();
ok(j.res && j.res.resultado === 'vitoria' && j.eventos.length > 0, 'lutou e venceu o lobo (' + (j.eventos?.length) + ' eventos)');
const vit = Tanka.dados.VITALIDADE.ligada ? 2 : 1;
ok(j.res.exp === Math.floor(Tanka.dados.monstros.lobo.exp * 1.15) * vit && !!j.res.vitalidade === (vit === 2), 'bônus de 15% do clã vindo do banco' + (vit === 2 ? ' + Vitalidade x2' : ' (Vitalidade desligada)') + ' (exp ' + j.res.exp + ')');
ok(banco[p0.id].dados.estamina.pts === 239 && j.res.estamina === 1, 'Estamina: o lobo gastou 1 (gravado no banco)');
ok(banco[p0.id].dados.hpAtual === R.status(banco[p0.id].dados).hpMax, 'vida cheia depois da luta');
ok(j.personagem.ouro > 0 && banco[p0.id].dados.ouro === j.personagem.ouro, 'ouro gravado no banco');
ok(j.proximo && banco[p0.id].dados.encontro, 'já veio o próximo encontro');
ok(banco[p0.id].dados.versao === 2, 'versão 2 depois da luta');
// outra aba gravou no meio: conflito
const antes = JSON.stringify(banco[p0.id].dados);
outraAbaNoMeio = true;
relogio += 20000;
r = await pedir({ acao: 'lutar', personagem: p0.id });
ok(r.status === 409 && (await r.json()).conflito, 'gravação de outra aba no meio: conflito 409');
ok(JSON.parse(antes).ouro === banco[p0.id].dados.ouro, 'nada sobrescrito no conflito');
// ritmo: duas lutas seguidas sem esperar
r = await pedir({ acao: 'lutar', personagem: p0.id });
j = await r.json();
r = await pedir({ acao: 'encontro', personagem: p0.id, alvos: ['lobo'] });
ok((await r.json()).erro, 'nova busca logo depois da luta: barrada');
// Caçada com o jogo fechado (11/11/2026): liga no encontro, retomar faz as lutas do tempo fora, parar desliga.
r = await pedir({ acao: 'retomar', personagem: p0.id });
j = await r.json();
ok(j.ausente && j.ausente.lutas === 0 && !j.ausente.ligada, 'retomar sem caçada ligada: nada');
relogio += 10000;
r = await pedir({ acao: 'encontro', personagem: p0.id, alvos: ['lobo'], auto: { chefe: 'fugir', lutarSempre: false, pocao: 30 } });
j = await r.json();
ok(!j.erro && banco[p0.id].dados.cacadaAuto && banco[p0.id].dados.cacadaAuto.pocao === 30, 'encontro com auto: caçada ligada no banco');
const est0 = banco[p0.id].dados.estamina.pts, exp0 = banco[p0.id].dados.exp + 0, niv0 = banco[p0.id].dados.nivel;
relogio += 2 * 60 * 1000;   // 2 minutos com a aba fechada
r = await pedir({ acao: 'retomar', personagem: p0.id });
j = await r.json();
const lutas2min = j.ausente.lutas;
ok(lutas2min >= 8 && lutas2min <= 40, 'retomar depois de 2 min: ' + lutas2min + ' lutas, ' + j.ausente.vitorias + ' vitórias');
ok(banco[p0.id].dados.estamina.pts === est0 - lutas2min, 'a estamina gastou 1 por lobo (' + banco[p0.id].dados.estamina.pts + ')');
ok(banco[p0.id].dados.nivel > niv0 || banco[p0.id].dados.exp > exp0, 'ganhou exp no banco');
r = await pedir({ acao: 'retomar', personagem: p0.id });
ok((await r.json()).ausente.lutas === 0, 'retomar de novo na hora: nenhuma luta a mais');
// horas fora: para quando a estamina acaba
relogio += 6 * 60 * 60 * 1000;
r = await pedir({ acao: 'retomar', personagem: p0.id });
j = await r.json();
ok(!banco[p0.id].dados.cacadaAuto && j.ausente.parou, 'horas fora: caçou até ' + (j.ausente.derrotas ? 'morrer' : 'acabar a estamina') + ' e desligou (' + j.ausente.lutas + ' lutas, estamina ' + banco[p0.id].dados.estamina.pts + ')');
ok(j.ausente.lutas + lutas2min <= 240, 'nunca mais lutas do que a estamina paga');
// parar desliga
banco[p0.id].dados.estamina.pts = 240;
relogio += 10000;
r = await pedir({ acao: 'encontro', personagem: p0.id, alvos: ['lobo'], auto: { chefe: 'fugir' } });
ok(banco[p0.id].dados.cacadaAuto, 'ligou de novo');
r = await pedir({ acao: 'parar', personagem: p0.id });
ok(!banco[p0.id].dados.cacadaAuto, 'parar: desligou');
relogio += 60 * 60 * 1000;
r = await pedir({ acao: 'retomar', personagem: p0.id });
ok((await r.json()).ausente.lutas === 0, 'depois de parar, fechar o jogo não caça');
console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES DA CAÇADA NO SERVIDOR PASSARAM', '· gravações:', gravacoes);
if (falhas) Deno.exit(1);
