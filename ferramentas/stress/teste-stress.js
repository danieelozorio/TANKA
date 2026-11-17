// Teste de stress do Eldrin (Henri, 17/11/2026). Roda no GitHub (.github/workflows/teste-stress.yml) contra um
// projeto Supabase SÓ DE TESTE: cria jogadores falsos (stress0001...), cada um caça como no jogo (encontro → lutar → fim)
// e de vez em quando lê o chat e o ranking. Sobe por etapas (ex.: 100, 250, 500, 1000 ao mesmo tempo) e mede o tempo
// de cada pedido e os erros. NUNCA apontar para o projeto de verdade (cwlcdeqvwzpveduzhaol): o script recusa.
// Variáveis: STRESS_URL, STRESS_CHAVE (publishable do projeto de teste), STRESS_SENHA, STRESS_ETAPAS ("100,250,500,1000"),
//            STRESS_SEGUNDOS (por etapa, padrão 90), STRESS_CRIAR_JUNTOS (cadastros em paralelo, padrão 10).
const vm = require('vm'), fs = require('fs'), path = require('path');
const URL_ = (process.env.STRESS_URL || '').replace(/\/$/, ''), CHAVE = process.env.STRESS_CHAVE || '';
const SENHA = process.env.STRESS_SENHA || 'stress-' + 'eldrin-teste';
const ETAPAS = (process.env.STRESS_ETAPAS || '100,250,500,1000').split(',').map(Number);
const SEG = Number(process.env.STRESS_SEGUNDOS || 90), JUNTOS = Number(process.env.STRESS_CRIAR_JUNTOS || 10);
if (!URL_ || !CHAVE) { console.error('Faltam STRESS_URL e STRESS_CHAVE (projeto de teste).'); process.exit(1); }
if (/cwlcdeqvwzpveduzhaol/.test(URL_)) { console.error('Recusado: este é o banco de verdade do jogo. Use um projeto de teste.'); process.exit(1); }

// regras do jogo (para criar um personagem válido)
const raiz = path.join(__dirname, '..', '..'), ctx = { console, Math, Date, JSON };
ctx.window = ctx; vm.createContext(ctx);
['js/dados.js', 'js/historia.js', 'js/regras.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx));
const R = ctx.Tanka.regras, D = ctx.Tanka.dados;
const area = D.areas.find((a) => a.monstros && a.monstros.length);
const ALVOS = area.monstros.map((m) => m.id || m).filter((id) => D.monstros[id] && !D.monstros[id].chefe).slice(0, 3);

const medidas = {};   // nome → { t: [ms], erros, status: {} }
function anotar(nome, ms, ok, status) {
  const m = medidas[nome] || (medidas[nome] = { t: [], erros: 0, status: {} });
  m.t.push(ms); if (!ok) { m.erros++; m.status[status] = (m.status[status] || 0) + 1; }
}
async function pedir(nome, caminho, { metodo = 'GET', token, corpo, medir = true } = {}) {
  const h = { apikey: CHAVE, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || CHAVE) };
  const t0 = performance.now(); let r, txt = '', st = 0;
  try {
    r = await fetch(URL_ + caminho, { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(30000) });
    st = r.status; txt = await r.text();
  } catch (e) { st = e.name === 'TimeoutError' ? 'tempo' : 'rede'; }
  const ms = performance.now() - t0, ok = typeof st === 'number' && st < 400;
  if (medir) anotar(nome, ms, ok, st);
  let json = null; try { json = txt ? JSON.parse(txt) : null; } catch (e) {}
  return { ok, status: st, json, ms };
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const nomeDe = (i) => 'stress' + String(i).padStart(4, '0');
const emailDe = (u) => u.toLowerCase() + '@jogador.tankaarena.com';

async function prepararJogador(i) {
  const u = nomeDe(i);
  let s = await pedir('login', '/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email: emailDe(u), password: SENHA }, medir: false });
  if (!s.ok) {
    const c = await pedir('cadastro', '/auth/v1/signup', { metodo: 'POST', corpo: { email: emailDe(u), password: SENHA, data: { usuario: u, email: u + '@teste.invalid' } }, medir: false });
    if (!c.ok) throw new Error('cadastro ' + u + ': ' + c.status + ' ' + JSON.stringify(c.json).slice(0, 150));
    s = await pedir('login', '/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email: emailDe(u), password: SENHA }, medir: false });
    if (!s.ok) throw new Error('login ' + u + ': ' + s.status + ' ' + JSON.stringify(s.json).slice(0, 150));
  }
  const token = s.json.access_token;
  let ps = await pedir('personagens', '/rest/v1/personagens?select=id', { token, medir: false });
  let id = ps.json && ps.json[0] && ps.json[0].id;
  if (!id) {
    const p = R.criarPersonagem('Stress' + String(i).padStart(4, '0'), 'masculino', 'humano', 'cavaleiro');
    const c = await pedir('criar', '/rest/v1/personagens', { metodo: 'POST', token, corpo: { id: p.id, nome: p.nome, dados: p }, medir: false });
    if (!c.ok) throw new Error('personagem ' + u + ': ' + c.status + ' ' + JSON.stringify(c.json).slice(0, 150));
    id = p.id;
  }
  return { u, token, id };
}

async function jogar(j, ate) {
  let proximoChat = Date.now() + Math.random() * 30000, proximoRanking = Date.now() + Math.random() * 60000;
  await dormir(Math.random() * 5000);   // não começam todos no mesmo milissegundo
  while (Date.now() < ate) {
    const e = await pedir('caçada: encontro', '/functions/v1/cacada', { metodo: 'POST', token: j.token, corpo: { acao: 'encontro', personagem: j.id, alvos: ALVOS, auto: null } });
    await dormir(2000);   // o monstro aparece em ~2 s
    const l = await pedir('caçada: lutar', '/functions/v1/cacada', { metodo: 'POST', token: j.token, corpo: { acao: 'lutar', personagem: j.id, alvos: ALVOS, pocao: 0, etapas: true } });
    await dormir(3000);   // a luta animando na tela
    await pedir('caçada: fim', '/functions/v1/cacada', { metodo: 'POST', token: j.token, corpo: { acao: 'fim', personagem: j.id, alvos: ALVOS, continuar: false, auto: null } });
    if (Date.now() > proximoChat) { await pedir('chat: ler', '/rest/v1/mensagens?select=id,nome,texto&order=id.desc&limit=50', { token: j.token }); proximoChat = Date.now() + 30000; }
    if (Date.now() > proximoRanking) { await pedir('ranking', '/rest/v1/rpc/ranking', { metodo: 'POST', token: j.token, corpo: { tipo: 'nivel' } }); proximoRanking = Date.now() + 60000; }
    if ((e.status === 401 || l.status === 401)) {   // token venceu: entra de novo
      const s = await pedir('login', '/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email: emailDe(j.u), password: SENHA } });
      if (s.ok) j.token = s.json.access_token;
    }
    await dormir(500 + Math.random() * 1000);
  }
}

function pct(a, p) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; }
function relatorio(etapa, seg) {
  const linhas = Object.entries(medidas).map(([nome, m]) => ({ nome, n: m.t.length, erros: m.erros,
    p50: Math.round(pct(m.t, 50)), p95: Math.round(pct(m.t, 95)), p99: Math.round(pct(m.t, 99)), status: m.status }));
  const total = linhas.reduce((s, l) => s + l.n, 0), erros = linhas.reduce((s, l) => s + l.erros, 0);
  let txt = `\n### ${etapa} jogadores ao mesmo tempo (${seg} s)\n\n| Pedido | Quantos | Erros | Metade abaixo de (ms) | 95% abaixo de (ms) | 99% abaixo de (ms) |\n|---|---|---|---|---|---|\n`;
  linhas.forEach((l) => { txt += `| ${l.nome} | ${l.n} | ${l.erros}${l.erros ? ' ' + JSON.stringify(l.status) : ''} | ${l.p50} | ${l.p95} | ${l.p99} |\n`; });
  txt += `\nTotal: ${total} pedidos (${(total / seg).toFixed(1)} por segundo), ${erros} erros (${total ? (erros / total * 100).toFixed(1) : 0}%).\n`;
  return { txt, total, erros };
}

(async () => {
  const max = Math.max(...ETAPAS);
  console.log(`Preparando ${max} jogadores falsos (alvos: ${ALVOS.join(', ')})...`);
  const jogadores = [];
  for (let i = 1; i <= max; i += JUNTOS) {
    const lote = await Promise.allSettled(Array.from({ length: Math.min(JUNTOS, max - i + 1) }, (_, k) => prepararJogador(i + k)));
    lote.forEach((r) => { if (r.status === 'fulfilled') jogadores.push(r.value); else console.log('  erro:', r.reason.message); });
    if (i % 100 === 1) console.log(`  ${jogadores.length} prontos`);
  }
  console.log(`${jogadores.length} jogadores prontos.`);
  let resumo = '# Teste de stress do Eldrin\n\nProjeto: ' + URL_.replace(/^https:\/\//, '') + '\n';
  for (const n of ETAPAS) {
    for (const k of Object.keys(medidas)) delete medidas[k];
    const grupo = jogadores.slice(0, n);
    console.log(`\n== Etapa: ${grupo.length} jogadores por ${SEG} s`);
    const ate = Date.now() + SEG * 1000;
    await Promise.all(grupo.map((j) => jogar(j, ate)));
    const r = relatorio(grupo.length, SEG);
    console.log(r.txt); resumo += r.txt;
    if (r.total && r.erros / r.total > 0.3) { resumo += '\nParei aqui: mais de 30% de erros.\n'; break; }
    await dormir(15000);   // respiro entre etapas
  }
  fs.writeFileSync('resultado-stress.md', resumo);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumo);
})();
