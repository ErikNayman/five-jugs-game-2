// Выносит движок игры из cascade.html в engine/flow-engine.js — модуль для Node (сервер сайта).
// Источник правды — cascade.html. После правок движка запусти: node tools/extract-engine.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'cascade.html'), 'utf8');
const m = /<script>(\/\* Five Jars v3[\s\S]*?)<\/script>/.exec(html);
if (!m) throw new Error('Движок не найден в cascade.html');
const out = '// СГЕНЕРИРОВАНО из cascade.html командой node tools/extract-engine.js — не править вручную.\n' + m[1].trim() + '\n';
fs.mkdirSync(path.join(root, 'engine'), { recursive: true });
fs.writeFileSync(path.join(root, 'engine', 'flow-engine.js'), out);
const E = require(path.join(root, 'engine', 'flow-engine.js'));
console.log(`engine/flow-engine.js: движок v${E.VERSION}, verifyRun: ${typeof E.verifyRun}`);
