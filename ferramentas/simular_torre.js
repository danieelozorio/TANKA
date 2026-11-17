// Torre do Eclipse (Daniel, nov/2026): até que andar cada tipo de grupo sobe (bots com a escolha automática).
// Heróis como no simular_pesadelo.js (tudo da raridade/encanto pedidos, do level do herói).
// Alvo: grupo equilibrado (tanque + cura + 2 dano) passa bem mais longe que grupo sem tanque ou sem cura.
// Uso: node ferramentas/simular_torre.js [subidas por grupo, padrão 20] [level, 30] [raridade, epica] [encanto, 3]
const { heroi } = require('./simular_pesadelo.js');
const { D, R } = require('./simular_cacada.js');
const BASE = { paladino: 'cavaleiro', destruidor: 'cavaleiro', cacador: 'arqueiro', assassino: 'arqueiro', bruxo: 'mago', curandeiro: 'mago', ferreiro: 'artesao', coletor: 'artesao' };
const GRUPOS = {
  'equilibrado (pal+cura+bru+ass)': ['paladino', 'curandeiro', 'bruxo', 'assassino'],
  'equilibrado (pal+cura+des+cac)': ['paladino', 'curandeiro', 'destruidor', 'cacador'],
  'sem cura (pal+bru+ass+des)': ['paladino', 'bruxo', 'assassino', 'destruidor'],
  'sem tanque (cura+bru+ass+des)': ['curandeiro', 'bruxo', 'assassino', 'destruidor'],
  '4 dano (des+bru+ass+cac)': ['destruidor', 'bruxo', 'assassino', 'cacador'],
};
function subir(fichas, maxAndar) {
  const t = R.novaTorre(fichas, 1);
  let semente = Math.floor(Math.random() * 1e9), turnos = 0;
  for (;;) {
    while (!t.fim) { R.resolverTurnoTorre(t, [], semente++); turnos++; }
    if (t.fim === 'derrota' || t.andar >= maxAndar) return { andar: t.fim === 'derrota' ? t.andar - 1 : t.andar, turnos };
    R.subirTorre(t);
  }
}
if (require.main === module) {
  const N = Number(process.argv[2]) || 20, nivel = Number(process.argv[3]) || 30, rar = process.argv[4] || 'epica', enc = process.argv[5] != null ? Number(process.argv[5]) : 3;
  console.log('Level ' + nivel + ', ' + rar + ' +' + enc + ', ' + N + ' subidas por grupo: andar vencido (mediana / melhor)');
  Object.entries(GRUPOS).forEach(([nome, cls]) => {
    const fichas = cls.map((c2) => heroi(BASE[c2], c2, nivel, rar, enc));
    const r = []; let tt = 0;
    for (let i = 0; i < N; i++) { const x = subir(fichas, 200); r.push(x.andar); tt += x.turnos; }
    r.sort((a, b) => a - b);
    console.log(nome.padEnd(34) + 'mediana ' + String(r[Math.floor(N / 2)]).padStart(3) + '   melhor ' + String(r[N - 1]).padStart(3) + '   pior ' + String(r[0]).padStart(3) + '   turnos/andar ' + (tt / Math.max(1, r.reduce((a, b) => a + b, 0) + N)).toFixed(1));
  });
}
module.exports = { subir, GRUPOS, BASE };
