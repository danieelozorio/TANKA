// Testes da Arena no banco (depois de testes/banco.test.sh criar o banco tanka_teste).
// Precisa do pacote pg: npm install pg   Uso: PGHOST=... PGPORT=... node testes/arena.test.js
const { Pool } = require('pg');
const vm = require('vm'), fs = require('fs'), assert = require('assert');
const ctx = {}; vm.createContext(ctx);
['dados', 'regras'].forEach((f) => vm.runInContext(fs.readFileSync('' + require('path').join(__dirname, '..', 'js') + '/' + f + '.js', 'utf8'), ctx));
const { dados: D, regras: R } = vm.runInContext('Tanka', ctx);
const pool = new Pool({ host: process.env.PGHOST, port: process.env.PGPORT, user: 'postgres', database: 'tanka_teste' });
const ok = (m) => console.log('ok  ', m);
async function como(uid, sql, args) {
  const c = await pool.connect();
  try { await c.query('begin'); await c.query('set local role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    const r = await c.query(sql, args); await c.query('commit'); return r.rows[0] && Object.values(r.rows[0])[0]; }
  catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}
(async () => {
  // 1) Força no servidor = força no jogo
  const classes = ['cavaleiro', 'arqueiro', 'mago', 'artesao'], rars = ['comum', 'rara', 'epica', 'lendaria'];
  for (let i = 0; i < 60; i++) {
    const p = R.criarPersonagem('P' + i, 'masculino', ['humano', 'elfo', 'orc', 'anao'][i % 4], classes[i % 4]);
    R.admin.subirNivel(p, i % 39);
    while (p.pontosLivres) R.distribuirPonto(p, R.ATRIBUTOS[Math.floor(Math.random() * 5)]);
    R.admin.conjunto(p, rars[i % 4]);
    p.inventario.forEach((it) => { it.encanto = Math.floor(Math.random() * 11); });
    p.inventario.slice(1).forEach((it) => R.equipar(p, it.id));
    const s = R.status(p);
    const q = (await pool.query('select public.tanka_status($1) as s', [p])).rows[0].s;
    assert.deepStrictEqual([q.hpMax, q.dano[0], q.dano[1], q.defesa, q.defesaMagica, q.velocidade, q.magico],
      [s.hpMax, s.dano[0], s.dano[1], s.defesa, s.defesaMagica, s.velocidade, s.tipoDano === 'magico'], 'personagem ' + i);
  }
  ok('força calculada no servidor igual à do jogo (60 personagens)');

  // 2) Arena: 8 jogadores level 6
  await pool.query("delete from auth.users; delete from public.arena_jackpot");
  const ids = [];
  for (let i = 0; i < 8; i++) {
    const uid = '00000000-0000-0000-0000-0000000001' + String(i).padStart(2, '0');
    await pool.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2)', [uid, { usuario: 'j' + i, email: 'j' + i + '@t.com' }]);
    const p = R.criarPersonagem('Jog' + i, 'masculino', 'humano', 'cavaleiro');
    R.admin.subirNivel(p, 5 + (i === 7 ? 0 : 0)); p.ouro = 1000;
    if (i === 7) { R.admin.conjunto(p, 'lendaria'); p.inventario.slice(1).forEach((it) => R.equipar(p, it.id)); } // o último é fortíssimo
    await pool.query('insert into public.personagens (id, conta_id, nome, dados) values ($1,$2,$3,$4)', [p.id, uid, p.nome, p]);
    ids.push({ uid, pid: p.id });
  }
  for (const j of ids) await como(j.uid, 'select public.arena_estado($1, null)', [j.pid]);
  const posicoes = (await pool.query("select p.nome, ap.posicao from arena_posicoes ap join personagens p on p.id = ap.personagem_id order by posicao")).rows;
  assert.deepStrictEqual(posicoes.map((r) => r.nome), ids.map((_, i) => 'Jog' + i)); ok('quem entra vai para o último lugar (ordem de chegada)');
  const ult = ids[7];
  const est = await como(ult.uid, 'select public.arena_estado($1, null)', [ult.pid]);
  assert.strictEqual(est.posicao, 8); assert.strictEqual(est.alvos.length, 6); assert.strictEqual(est.entradas.valor, 5); ok('estado: posição 8, 5 alvos acima, 5 entradas');
  await assert.rejects(como(ult.uid, 'select public.arena_desafiar($1,$2)', [ult.pid, ids[0].pid]), /5 logo acima/); ok('não desafia quem está mais de 5 acima');
  // luta contra o 3º lugar (5 acima)
  let luta = await como(ult.uid, 'select public.arena_desafiar($1,$2)', [ult.pid, ids[2].pid]);
  let n = 0;
  while (luta.situacao === 'andamento') { luta = await como(ult.uid, 'select public.arena_rolar($1,$2,$3)', [ult.pid, luta.id, n % 2 === 0]); n++; }
  const dados = luta.eventos.filter((e) => e.de === 'a').map((e) => e.dado);
  assert.ok(dados.every((d) => d >= 1 && d <= 20));
  assert.strictEqual(luta.situacao, 'vitoria', 'lendário vence'); assert.strictEqual(luta.pos_depois, 3);
  ok('vitória: ' + n + ' ataques do jogador, toma a 3ª posição (dados ' + dados.slice(0, 8).join(',') + '...)');
  const pos2 = (await pool.query("select p.nome from arena_posicoes ap join personagens p on p.id = ap.personagem_id order by posicao")).rows.map((r) => r.nome);
  assert.deepStrictEqual(pos2, ['Jog0', 'Jog1', 'Jog7', 'Jog2', 'Jog3', 'Jog4', 'Jog5', 'Jog6']); ok('quem estava entre os dois desceu uma posição');
  assert.ok([5, 6, 7, 8, 10].includes(luta.saque_pct)); assert.strictEqual(luta.saque, Math.floor(1000 * luta.saque_pct / 100));
  ok('saque de ' + luta.saque_pct + '% = ' + luta.saque + ' de ouro');
  const cred = (await pool.query("select personagem_id, ouro, reputacao from creditos order by id")).rows;
  assert.deepStrictEqual(cred.map((c) => [c.personagem_id, c.ouro, c.reputacao]), [[ult.pid, luta.saque, 10], [ids[2].pid, -luta.saque, 0]]); ok('créditos: vencedor +ouro +10 reputação, perdedor -ouro');
  const est2 = await como(ult.uid, 'select public.arena_estado($1, null)', [ult.pid]);
  assert.strictEqual(est2.entradas.valor, 4); assert.ok(est2.entradas.proxima_em); ok('entrada gasta (4/5) com horário da próxima');
  // revanche do Jog2
  const vit = ids[2];
  const h = (await como(vit.uid, 'select public.arena_estado($1, null)', [vit.pid])).historico[0];
  assert.ok(h.pode_revanche && !h.ataquei); assert.strictEqual(h.saque, luta.saque);
  let rev = await como(vit.uid, 'select public.arena_revanche($1,$2)', [vit.pid, h.id]);
  while (rev.situacao === 'andamento') rev = await como(vit.uid, 'select public.arena_rolar($1,$2,true)', [vit.pid, rev.id]);
  assert.strictEqual(rev.revanche, true);
  const pos3 = (await pool.query("select p.nome from arena_posicoes ap join personagens p on p.id = ap.personagem_id order by posicao")).rows.map((r) => r.nome);
  assert.deepStrictEqual(pos3, pos2); ok('revanche (' + rev.situacao + ') não muda o ranking');
  await assert.rejects(como(vit.uid, 'select public.arena_revanche($1,$2)', [vit.pid, h.id]), /já fez a revanche/); ok('só uma revanche por ataque');
  // aplicar crédito
  const c1 = (await pool.query('select id from creditos where personagem_id = $1 and not aplicado order by id limit 1', [ult.pid])).rows[0].id;
  const ap = await como(ult.uid, 'select public.credito_aplicar($1,$2)', [ult.pid, c1]);
  assert.strictEqual(ap.ouro, luta.saque); await assert.rejects(como(ult.uid, 'select public.credito_aplicar($1,$2)', [ult.pid, c1]), /não encontrado/); ok('crédito aplicado uma vez só');
  // entradas acabando e recarga por hora
  await pool.query('update arena_entradas set valor = 0, atualizado_em = now() where personagem_id = $1', [ids[6].pid]);
  await assert.rejects(como(ids[6].uid, 'select public.arena_desafiar($1,$2)', [ids[6].pid, ids[5].pid]), /Sem entradas/); ok('sem entradas não luta');
  await pool.query("update arena_entradas set atualizado_em = now() - interval '2 hours 5 minutes' where personagem_id = $1", [ids[6].pid]);
  assert.strictEqual((await como(ids[6].uid, 'select public.arena_estado($1, null)', [ids[6].pid])).entradas.valor, 2); ok('+1 entrada por hora (2h depois: 2)');
  // jackpot
  await pool.query("update arena_jackpot set valor = 0, ultima_soma = now() - interval '35 minutes', ultima_paga = now() where arena = 'a1'");
  assert.strictEqual((await como(ult.uid, 'select public.arena_estado($1, null)', [ult.pid])).jackpot.valor, 150); ok('jackpot +50 a cada 10 min na Arena 5~10 (35 min = 150)');
  await pool.query("update arena_jackpot set ultima_paga = now() - interval '1 hour 1 minute' where arena = 'a1'");
  assert.strictEqual((await como(ult.uid, 'select public.arena_estado($1, null)', [ult.pid])).jackpot.valor, 135);
  const pago = (await pool.query("select ouro from creditos where personagem_id = $1 and motivo like 'Jackpot da Arena (1 hora%'", [ids[0].pid])).rows[0].ouro;
  assert.strictEqual(pago, 15); ok('Top 1 recebe 10% do jackpot por hora (15)');
  await pool.query("update arena_jackpot set ultimo_dia = ultimo_dia - 1 where arena = 'a1'");
  await como(ult.uid, 'select public.arena_estado($1, null)', [ult.pid]);
  const diario = (await pool.query("select ouro, reputacao from creditos where personagem_id = $1 and motivo like 'Prêmio diário%'", [ids[0].pid])).rows[0];
  assert.deepStrictEqual([diario.ouro, diario.reputacao], [135, 500]); assert.strictEqual((await pool.query("select valor from arena_jackpot where arena='a1'")).rows[0].valor, 0);
  ok('00:00: Top 1 recebe o jackpot + 500 de reputação e o jackpot zera');
  // lendário sobe até o Top 1 e leva o jackpot
  await pool.query("update arena_jackpot set valor = 400, ultima_soma = now(), ultima_paga = now() where arena = 'a1'");
  await pool.query('update arena_entradas set valor = 5 where personagem_id = $1', [ult.pid]);
  luta = await como(ult.uid, 'select public.arena_desafiar($1,$2)', [ult.pid, ids[0].pid]);
  while (luta.situacao === 'andamento') luta = await como(ult.uid, 'select public.arena_rolar($1,$2,true)', [ult.pid, luta.id]);
  assert.strictEqual(luta.situacao, 'vitoria'); assert.strictEqual(luta.pos_depois, 1); assert.strictEqual(luta.jackpot, 400); ok('derrotou o Top 1: vira Top 1 e leva o jackpot (400)');
  // luta abandonada termina sozinha
  const fraco = ids[6];
  await pool.query('update arena_entradas set valor = 5 where personagem_id = $1', [fraco.pid]);
  const ab = await como(fraco.uid, 'select public.arena_desafiar($1,$2)', [fraco.pid, ids[5].pid]);
  assert.strictEqual(ab.situacao, 'andamento');
  await como(fraco.uid, 'select public.arena_estado($1, null)', [fraco.pid]);
  assert.notStrictEqual((await pool.query('select situacao from arena_lutas where id = $1', [ab.id])).rows[0].situacao, 'andamento'); ok('luta abandonada termina com ataques normais');
  // multiplicadores do dado
  const tab = (await pool.query("select public.tanka_dados()->'ARENA'->'dado' as d")).rows[0].d;
  const media = tab.reduce((a, b) => a + b, 0) / 20;
  ok('dado: média ' + media.toFixed(3) + 'x de dano; face 1 = ' + tab[0] + ', face 20 = ' + tab[19]);
  console.log('TODOS OS TESTES DA ARENA PASSARAM');
  await pool.end();
})().catch(async (e) => { console.error('FALHA', e.message); await pool.end(); process.exit(1); });
