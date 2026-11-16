// Monta a pasta do app Android (Capacitor): app-android/www com o jogo inteiro (js, css, assets) e o index.html
// tirado de jogar/index.html (sem o <base href="../">, sem o service worker, com o js/app-nativo.js).
// Uso: ELDRIN_VERSAO_WEB=123 node ferramentas/montar_app.js   (o GitHub roda isto em .github/workflows/app-android.yml)
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), saida = path.join(raiz, 'app-android', 'www');
const versao = Number(process.env.ELDRIN_VERSAO_WEB || 0);

fs.rmSync(saida, { recursive: true, force: true });
fs.mkdirSync(saida, { recursive: true });
['js', 'css', 'assets'].forEach((p) => fs.cpSync(path.join(raiz, p), path.join(saida, p), { recursive: true }));
fs.rmSync(path.join(saida, 'js', 'contas-local.js'), { force: true });   // só para a prévia

let html = fs.readFileSync(path.join(raiz, 'jogar', 'index.html'), 'utf8');
const troca = (de, para, nome) => { if (!de.test(html)) throw new Error('montar_app: não achei ' + nome + ' em jogar/index.html'); html = html.replace(de, para); };
troca(/\s*<base href="\.\.\/">/, '', '<base href="../">');
troca(/(<meta charset="utf-8">)/i, '$1\n  <script>window.ELDRIN_APP = { web: ' + versao + ' };</script>\n  <script src="js/app-nativo.js"></script>', '<meta charset>');
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
html = html.replace(/\s*<script>\s*\/\/ Instalar no celular[\s\S]*?<\/script>/, '');   // service worker: não no app
fs.writeFileSync(path.join(saida, 'index.html'), html);

let total = 0;
(function soma(d) { fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const f = path.join(d, e.name); if (e.isDirectory()) soma(f); else total += fs.statSync(f).size; }); })(saida);
console.log('app-android/www montado: versão do jogo ' + versao + ', ' + (total / 1048576).toFixed(1) + ' MB');
