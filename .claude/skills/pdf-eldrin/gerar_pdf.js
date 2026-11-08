// Transforma um HTML no PDF do Eldrin (A4, fundo escuro, fonte EB Garamond).
// Uso: node .claude/skills/pdf-eldrin/gerar_pdf.js entrada.html saida.pdf
// Caminhos no HTML são relativos à raiz do repositório (ex.: assets/itens/receita.webp).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const [entrada, saida] = process.argv.slice(2);
  if (!entrada || !saida) { console.error('uso: node gerar_pdf.js entrada.html saida.pdf'); process.exit(1); }
  const raiz = path.resolve(__dirname, '../../..');
  let html = fs.readFileSync(entrada, 'utf8');
  if (!/<base /i.test(html)) html = html.replace(/<head>/i, '<head><base href="file://' + raiz + '/">');
  const tmp = path.join(path.dirname(path.resolve(saida)), '.pdf-eldrin-tmp.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + tmp, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const faltando = await p.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
  if (faltando.length) console.warn('Imagens que não carregaram:', faltando.join(', '));
  await p.pdf({ path: saida, preferCSSPageSize: true, printBackground: true });
  await b.close(); fs.unlinkSync(tmp);
  console.log('PDF pronto:', saida);
})();
