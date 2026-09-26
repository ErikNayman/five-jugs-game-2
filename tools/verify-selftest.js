// Самопроверка verifyRun: бот играет со случайными действиями и записывает их так же, как игра.
// Честные результаты должны проходить проверку, подделанные — нет. Запуск: node tools/verify-selftest.js
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine', 'flow-engine.js'));
let rnd = 12345; const R = () => (rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0) / 2 ** 32;
const pick = a => a[Math.floor(R() * a.length)];

function play(level, seed, opts, maxTime) {
  let s = E.play(E.create(level, seed, opts)); const log = [];
  const act = (f, ...x) => { const pk = f === 'lifeChoose' ? E.describePick(s, x[0], x[1] ?? -1) : null; const n = E[f](s, ...x);
    if (n !== s) { const e = { t: s.time, f, x: x.map(v => v === undefined ? null : v) }; if (pk) e.pick = pk; log.push(e); } s = n; };
  const pipes = E.availablePipes(level);
  let peak = 0;
  while (!['won', 'lost'].includes(s.status) && s.time < maxTime) {
    if (s.life && s.life.pending) { const P = s.life.pending, n = P.kind === 'fork' ? E.FORKS[P.id].options.length : P.options.length;
      const full = P.kind === 'upgrade' && s.life.slots.length >= E.metrics(s).slotsMax; act('lifeChoose', Math.floor(R() * n), full ? 0 : -1); if (s.status === 'paused') s = E.play(s); continue; }
    if (s.status === 'paused') s = E.play(s);
    if (R() < 0.08) { const k = R();
      if (k < .35) act('setValve', pick(pipes), pick([0, .25, .5, .75, 1]));
      else if (k < .6) act('togglePipe', pick(pipes));
      else if (k < .8) act('setSource', 'comfort', pick([0, .35, .7, 1]));
      else if (k < .9) act('setSource', 'overtime', pick([0, .3, .6]));
      else act('upgrade'); }
    s = E.step(s, 0.016 + R() * 0.04);
    const m = E.metrics(s); if (m.realTotal > peak) peak = m.realTotal;
    if (level === 'endless' && m.freedom >= 1 && R() < 0.02) s = E.finishEndless(s);
  }
  return { s, log };
}

let pass = 0, fail = 0; const check = (name, cond, info) => { if (cond) pass++; else { fail++; console.log('FAIL', name, JSON.stringify(info)); } };
for (let i = 0; i < 12; i++) {
  const level = i % 3 === 2 ? 'life' : 'endless', seed = 1000 + i * 7919;
  const opts = level === 'life' ? { prof: pick(['office', 'freelance', 'business']), goal: pick(Object.keys(E.GOALS)), diff: 0 } : {};
  const { s, log } = play(level, seed, opts, 12 * E.YEAR);
  if (!['won', 'lost'].includes(s.status)) { console.log(level, seed, 'не закончилась за 12 лет — пропуск'); continue; }
  const p = { level, seed, opts, log, claim: { status: s.status, time: Math.round(s.time * 100) / 100 } };
  const v = E.verifyRun(p);
  console.log(`${level.padEnd(7)} seed ${seed}: ${s.status} за ${s.time.toFixed(2)} с, действий ${log.length} → ${v.ok ? 'OK' : 'ОТКАЗ ' + v.reason} (годы ${v.years}, капитал ${v.real}, пик ${v.peak})`);
  check('честный результат', v.ok, v);
  check('больше времени', !E.verifyRun({ ...p, claim: { ...p.claim, time: p.claim.time + 30 } }).ok);
  check('другой исход', !E.verifyRun({ ...p, claim: { ...p.claim, status: s.status === 'won' ? 'lost' : 'won' } }).ok);
  if (level === 'endless') check('ложная «система построена»', !E.verifyRun({ ...p, claim: { status: 'won', time: Math.min(p.claim.time, 20) } }).ok);
}
check('мусор', !E.verifyRun({ level: 'endless', seed: 5, log: [{ t: 1, f: 'eval', x: [] }], claim: { status: 'lost', time: 10 } }).ok);
check('кампания не принимается', !E.verifyRun({ level: 'hard', seed: 5, log: [], claim: { status: 'won', time: 10 } }).ok);
console.log(`\nпроверок: ${pass} прошло, ${fail} провалено`);
process.exit(fail ? 1 : 0);
