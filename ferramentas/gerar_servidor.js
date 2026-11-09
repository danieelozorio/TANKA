// Empacota as regras do jogo para as Edge Functions do Supabase (Deno): junta dados.js, historia.js, regras.js e
// servidor-cacada.js num módulo só (supabase/functions/_shared/tanka.js) que exporta o objeto Tanka.
// Rodar depois de mudar qualquer um desses arquivos: node ferramentas/gerar_servidor.js
// (o envio automático pelo GitHub roda isto antes de publicar; o teste de regras confere se está em dia).
const fs = require('fs'), path = require('path');
const raiz = path.resolve(__dirname, '..');
const ARQUIVOS = ['js/dados.js', 'js/historia.js', 'js/regras.js', 'js/servidor-cacada.js'];
function gerar() {
  return '// GERADO por ferramentas/gerar_servidor.js a partir de ' + ARQUIVOS.join(', ') + '. Não edite aqui.\n'
    + ARQUIVOS.map((f) => '// ---- ' + f + ' ----\n' + fs.readFileSync(path.join(raiz, f), 'utf8')).join('\n')
    + '\nexport default Tanka;\n';
}
module.exports = { gerar, destino: path.join(raiz, 'supabase/functions/_shared/tanka.js') };
if (require.main === module) {
  fs.writeFileSync(module.exports.destino, gerar());
  console.log('Gerado:', path.relative(raiz, module.exports.destino));
}
