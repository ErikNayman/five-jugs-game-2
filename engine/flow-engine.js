// СГЕНЕРИРОВАНО из cascade.html командой node tools/extract-engine.js — не править вручную.
/* Five Jars v3 «Каскад» — deterministic teaching simulation. Rates are fictional units/second.
   Reference engine for the ТЗ: same public API as v2, new rules (cascade overflow, priority,
   float valve, scripted shocks, speculation risk, income goal as a flow). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FlowEngine = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const VERSION = 3, FIXED_DT = 0.02, MAX_DT = 1, HOLD_SECONDS = 10;
  const JARS = ['income', 'consumption', 'savings', 'investments', 'speculation'];
  const EPS = 1e-8;
  const YIELD = 0.001;          // capital income: 0.1% of investments per second (accelerated model)
  const SKILL_STEP = 3;         // +3 u/s per training level
  const FLOAT_SHARE = 0.25;     // float line = 25% of the consumption target

  const LEVELS = {
    first: { title: 'Первая зарплата', icon: '💧', news: 'Два кувшина и одна труба. Научись включать кран.',
      description: 'К 00:20 подними Потребление выше золотой черты и удержи 10 секунд — не переливая через горлышко.',
      startOpening: 0.25, startEvent: 'Держи Потребление между золотой чертой и горлышком.',
      jars: ['income', 'consumption'], pipes: ['income-consumption'], training: false, overtime: false, challenge: 'noEat',
      salary: 10, expense: 3, comfortExpense: 2, volatility: 0, flowTarget: null, goalsAfter: 20,
      targets: { consumption: 120 }, brim: { consumption: 1.3 }, incomeCap: 1000,
      initial: { income: 60, consumption: 50, savings: 0, investments: 0, speculation: 0 }, upgradeCosts: [150, 250, 350],
      shocks: [], market: null },
    piggy: { title: 'Копилка', icon: '🐷', news: 'Новый кувшин — Сбережения. Первый перелив.',
      description: 'Излишек не проедай — пусть переливается в копилку.',
      jars: ['income', 'consumption', 'savings'], pipes: ['income-consumption', 'income-savings', 'consumption-savings'], training: false, overtime: false,
      salary: 12, expense: 4, comfortExpense: 2, volatility: 0, flowTarget: null,
      targets: { consumption: 120, savings: 250 }, brim: { consumption: 1.3, savings: 1.15 }, incomeCap: 400,
      initial: { income: 80, consumption: 60, savings: 0, investments: 0, speculation: 0 }, upgradeCosts: [150, 250, 350],
      shocks: [], market: null },
    rainy: { title: 'Чёрный день', icon: '☔', news: 'Страховка из подушки и первая беда: работа пропадёт.',
      description: 'Переживи 30 секунд без зарплаты и восстанови запасы.',
      jars: ['income', 'consumption', 'savings'], pipes: ['income-consumption', 'income-savings', 'consumption-savings', 'savings-consumption'], training: false, overtime: false,
      salary: 13, expense: 7, comfortExpense: 2, volatility: 0, flowTarget: null, goalsAfter: 75,
      targets: { consumption: 130, savings: 260 }, brim: { consumption: 1.3, savings: 1.15 }, incomeCap: 400,
      initial: { income: 60, consumption: 90, savings: 40, investments: 0, speculation: 0 }, upgradeCosts: [150, 250, 350],
      shocks: [{ id: 'layoff', type: 'jobLoss', at: 45, duration: 30, title: 'Работа закрылась' }], market: null },
    freelance: { title: 'Фриланс', icon: '💵', news: 'Зарплата приходит пачкой раз в 15 секунд.',
      description: 'Растяни каждую получку до следующей. Копилка и страховка помогут.',
      jars: ['income', 'consumption', 'savings'], pipes: ['income-consumption', 'income-savings', 'consumption-savings', 'savings-consumption'], training: false, overtime: false,
      salary: 13, payEvery: 15, expense: 6, comfortExpense: 2, volatility: 0, flowTarget: null,
      targets: { consumption: 130, savings: 280 }, brim: { consumption: 1.3, savings: 1.15 }, incomeCap: 400,
      initial: { income: 40, consumption: 90, savings: 40, investments: 0, speculation: 0 }, upgradeCosts: [150, 250, 350],
      shocks: [], market: null },
    invest: { title: 'Деньги работают', icon: '🌱', news: 'Инвестиции и новая цель — постоянный доход.',
      description: 'Вырасти инвестиции, чтобы они сами приносили деньги.',
      jars: ['income', 'consumption', 'savings', 'investments'], pipes: ['income-consumption', 'income-savings', 'income-investments', 'consumption-savings', 'savings-investments', 'savings-consumption'], training: false, overtime: false,
      salary: 14, expense: 5, comfortExpense: 2, volatility: 0, flowTarget: 14.3,
      targets: { consumption: 130, savings: 250, investments: 320 }, brim: { consumption: 1.3, savings: 1.15, investments: 1.3 }, incomeCap: 400,
      initial: { income: 80, consumption: 90, savings: 40, investments: 0, speculation: 0 }, upgradeCosts: [150, 250, 350],
      shocks: [{ id: 'bonus', type: 'bonus', at: 40, duration: 4, amount: 300, title: 'Премия' }], market: null },
    inflation: { title: 'Инфляция', icon: '🎈', news: 'Цены растут каждую секунду. Инвестиции помогают догнать их.',
      description: 'Жизнь дорожает на 3% каждые 10 секунд. Успей собрать запасы и доход.',
      jars: ['income', 'consumption', 'savings', 'investments'], pipes: ['income-consumption', 'income-savings', 'income-investments', 'consumption-savings', 'savings-investments', 'savings-consumption'], training: false, overtime: false,
      salary: 15, expense: 5, comfortExpense: 2, volatility: 0, inflation: 0.003, flowTarget: 15.35,
      targets: { consumption: 140, savings: 260, investments: 350 }, brim: { consumption: 1.3, savings: 1.15, investments: 1.3 }, incomeCap: 450,
      initial: { income: 80, consumption: 100, savings: 40, investments: 0, speculation: 0 }, upgradeCosts: [150, 250, 350],
      shocks: [], market: null },
    skills: { title: 'Учись и расти', icon: '🎓', news: 'Обучение навыкам и подработка.',
      description: 'Зарплаты не хватит до цели дохода — освой новый навык.',
      jars: ['income', 'consumption', 'savings', 'investments'], pipes: ['income-consumption', 'income-savings', 'income-investments', 'consumption-savings', 'savings-investments', 'savings-consumption'], training: true, overtime: true,
      salary: 14, expense: 5.5, comfortExpense: 3, volatility: 0, flowTarget: 17.35,
      targets: { consumption: 140, savings: 280, investments: 350 }, brim: { consumption: 1.3, savings: 1.15, investments: 1.3 }, incomeCap: 450,
      initial: { income: 90, consumption: 100, savings: 60, investments: 0, speculation: 0 }, upgradeCosts: [180, 280, 380],
      shocks: [{ id: 'repair', type: 'bill', at: 90, duration: 6, extraDrain: 20, title: 'Сломался телефон' }], market: null },
    crisis: { title: 'Кризис', icon: '⛈️', news: 'Инвестиции падают и восстанавливаются. Продавать или ждать?',
      description: 'Переживи кризис и не продай инвестиции на самом дне.',
      jars: ['income', 'consumption', 'savings', 'investments'], pipes: ['income-consumption', 'income-savings', 'income-investments', 'consumption-savings', 'savings-investments', 'savings-consumption', 'investments-income'], training: true, overtime: true,
      salary: 15, expense: 7.5, comfortExpense: 3, volatility: 0, flowTarget: 18.4, goalsAfter: 125,
      targets: { consumption: 150, savings: 320, investments: 400 }, brim: { consumption: 1.3, savings: 1.15, investments: 1.3 }, incomeCap: 500,
      initial: { income: 100, consumption: 110, savings: 80, investments: 0, speculation: 0 }, upgradeCosts: [200, 300, 400],
      shocks: [{ id: 'crisis', type: 'crisis', at: 90, duration: 35, invDrop: 0.2, specDrop: 0, recoverAfter: 50, title: 'Кризис' }], market: null },
    easy: { title: 'Спекуляции', icon: '🎢', optional: ['speculation'], news: 'Пятый кувшин: рискованные деньги и качели рынка. Полная система.', description: 'Стабильный доход и один короткий кризис. Все пять кувшинов.',
      salary: 18, expense: 6, comfortExpense: 4, volatility: 0, flowTarget: 21,
      targets: { consumption: 160, savings: 700, investments: 900, speculation: 220 },
      brim: { consumption: 1.3, savings: 1.15, investments: 1.3, speculation: 1.5 }, incomeCap: 600,
      initial: { income: 250, consumption: 150, savings: 80, investments: 0, speculation: 0 }, upgradeCosts: [220, 350, 500],
      shocks: [{ id: 'bonus', type: 'bonus', at: 50, duration: 4, amount: 350, title: 'Премия' }, { id: 'crisis', type: 'crisis', at: 100, duration: 20, invDrop: 0.15, specDrop: 0.25, recoverAfter: 40, title: 'Кризис' }],
      market: { start: 60, every: 30, swings: [0.08, -0.10, 0.06, -0.06] } },
    medium: { title: 'Переменный поток', icon: '🌊', optional: ['speculation'], news: 'Зарплата скачет вверх и вниз, случаются шоки.', description: 'Доход колеблется, случаются шоки. Без подушки придётся продавать.',
      salary: 17, expense: 7.5, comfortExpense: 4, volatility: 0.18, flowTarget: 21,
      targets: { consumption: 190, savings: 800, investments: 1050, speculation: 260 },
      brim: { consumption: 1.3, savings: 1.15, investments: 1.3, speculation: 1.5 }, incomeCap: 650,
      initial: { income: 210, consumption: 170, savings: 50, investments: 0, speculation: 0 }, upgradeCosts: [220, 350, 500],
      shocks: [{ id: 'bonus', type: 'bonus', at: 70, duration: 4, amount: 400, title: 'Премия' }, { id: 'crisis', type: 'crisis', at: 120, duration: 35, invDrop: 0.2, specDrop: 0.3, recoverAfter: 60, title: 'Кризис' },
               { id: 'repair', type: 'bill', at: 300, duration: 8, extraDrain: 35, title: 'Срочный ремонт' }],
      market: { start: 60, every: 30, swings: [0.10, -0.14, 0.08, -0.08] } },
    lab: { title: 'Испытания', icon: '🔧', lab: true, news: 'Собери систему из готового капитала и проверь её кризисом.', description: 'Головоломки: распредели деньги, настрой краны, проверь стресс-тестом.',
      salary: 16, expense: 8.5, comfortExpense: 5, volatility: 0, flowTarget: null, training: false, overtime: false,
      targets: { consumption: 220, savings: 950, investments: 1250, speculation: 300 },
      brim: { consumption: 1.3, savings: 2.6, investments: 2.4, speculation: 4 }, incomeCap: 2500,
      initial: { income: 0, consumption: 200, savings: 0, investments: 0, speculation: 0 }, upgradeCosts: [220, 350, 500], shocks: [] },
    hard: { title: 'Под давлением', icon: '🔥', optional: ['speculation'], news: 'Высокие расходы и серия бед подряд. Финальный экзамен.', description: 'Высокие расходы, сильные колебания и серия шоков.',
      salary: 16, expense: 8.5, comfortExpense: 5, volatility: 0.3, flowTarget: 22,
      targets: { consumption: 220, savings: 950, investments: 1250, speculation: 300 },
      brim: { consumption: 1.3, savings: 1.15, investments: 1.3, speculation: 1.5 }, incomeCap: 700,
      initial: { income: 170, consumption: 200, savings: 30, investments: 0, speculation: 0 }, upgradeCosts: [220, 350, 500],
      shocks: [{ id: 'crisis', type: 'crisis', at: 130, duration: 40, invDrop: 0.25, specDrop: 0.35, recoverAfter: 70, title: 'Кризис' },
               { id: 'illness', type: 'illness', at: 300, duration: 20, drainFactor: 2, title: 'Болезнь' },
               { id: 'repair', type: 'bill', at: 420, duration: 8, extraDrain: 40, title: 'Срочный ремонт' }],
      market: { start: 60, every: 30, swings: [0.12, -0.18, 0.10, -0.10] } },
    freedom: { title: 'Финансовая свобода', icon: '🏖', news: 'Главная цель — чтобы капитал сам оплачивал жизнь.',
      description: 'Доведи доход от инвестиций до 100% расходов на жизнь и удержи вместе с запасами.',
      jars: ['income', 'consumption', 'savings', 'investments'], pipes: ['income-consumption', 'income-savings', 'income-investments', 'consumption-savings', 'savings-investments', 'savings-consumption', 'investments-income'], training: true, overtime: true, freedomGoal: true,
      salary: 18, expense: 3, comfortExpense: 2, volatility: 0, flowTarget: null,
      targets: { consumption: 120, savings: 250, investments: 3000 }, brim: { consumption: 1.3, savings: 1.15, investments: 1.5 }, incomeCap: 600,
      initial: { income: 120, consumption: 100, savings: 60, investments: 0, speculation: 0 }, upgradeCosts: [200, 300, 400],
      shocks: [{ id: 'bonus', type: 'bonus', at: 60, duration: 4, amount: 400, title: 'Премия' }, { id: 'crisis', type: 'crisis', at: 150, duration: 20, invDrop: 0.15, specDrop: 0, recoverAfter: 30, title: 'Кризис' }],
      market: null },
    life: { title: 'Жизненный путь', icon: '🧭', endless: true, life: true, compound: 0.4, wageElasticity: 0.4, yield: 0.002,
      news: 'Профессия, жизненная цель, развилки и улучшения. Каждая партия — другая жизнь.',
      description: 'Выбери профессию и цель. Раз в два года — развилка или новое улучшение. Достигни цели и не опустоши Потребление.',
      training: true, overtime: true, salary: 16, expense: 6, comfortExpense: 3, volatility: 0, flowTarget: null,
      targets: { consumption: 150, savings: 500, investments: 2000, speculation: 300 }, brim: { consumption: 2, savings: 6, investments: 50, speculation: 60 }, incomeCap: 2000,
      initial: { income: 150, consumption: 150, savings: 100, investments: 0, speculation: 0 }, upgradeCosts: [200, 300, 400],
      shocks: [], market: { start: 15, every: 30, swings: [0] } },
    endless: { title: 'Экономический цикл', icon: '∞', endless: true, compound: 0.4, wageElasticity: 0.4, yield: 0.002,
      news: 'Бесконечный режим: подъёмы, перегревы, рецессии. Сколько лет продержишься?',
      description: 'Подъёмы, перегревы, рецессии и восстановления сменяют друг друга с разной вероятностью. Цены растут. Продержись как можно дольше — или построй систему, где капитал сам оплачивает жизнь.',
      training: true, overtime: true, salary: 16, expense: 6, comfortExpense: 3, volatility: 0, flowTarget: null,
      targets: { consumption: 150, savings: 500, investments: 2000, speculation: 300 }, brim: { consumption: 2, savings: 6, investments: 50, speculation: 60 }, incomeCap: 2000,
      initial: { income: 150, consumption: 150, savings: 100, investments: 0, speculation: 0 }, upgradeCosts: [200, 300, 400],
      shocks: [], market: { start: 15, every: 30, swings: [0] } }
  };

  // kind: valve — rate = opening × maxRate; float — opens by itself below the float line;
  // overflow — carries only the excess above the brim of `from`, no valve.
  const PIPES = [
    { id: 'income-consumption', from: 'income', to: 'consumption', title: 'На жизнь', kind: 'valve', priority: 1, maxRate: 30, loss: 0 },
    { id: 'income-savings', from: 'income', to: 'savings', title: 'В подушку', kind: 'valve', priority: 2, maxRate: 24, loss: 0 },
    { id: 'income-investments', from: 'income', to: 'investments', title: 'В инвестиции', kind: 'valve', priority: 3, maxRate: 24, loss: 0 },
    { id: 'income-speculation', from: 'income', to: 'speculation', title: 'В спекуляции', kind: 'valve', priority: 4, maxRate: 12, loss: 0 },
    { id: 'savings-consumption', from: 'savings', to: 'consumption', title: 'Страховка из подушки', kind: 'float', priority: 0, maxRate: 25, loss: 0 },
    { id: 'investments-income', from: 'investments', to: 'income', title: 'Продажа инвестиций', kind: 'valve', priority: 0, maxRate: 25, loss: 0.1 },
    { id: 'speculation-income', from: 'speculation', to: 'income', title: 'Выход из спекуляций', kind: 'valve', priority: 0, maxRate: 20, loss: 0.05 },
    { id: 'consumption-savings', from: 'consumption', to: 'savings', title: 'Перелив в подушку', kind: 'overflow', priority: 0, maxRate: null, loss: 0 },
    { id: 'savings-investments', from: 'savings', to: 'investments', title: 'Перелив в инвестиции', kind: 'overflow', priority: 0, maxRate: null, loss: 0 },
    { id: 'investments-speculation', from: 'investments', to: 'speculation', title: 'Перелив в спекуляции', kind: 'overflow', priority: 0, maxRate: null, loss: 0 }
  ];
  const OVERFLOW_OF = { consumption: 'consumption-savings', savings: 'savings-investments', investments: 'investments-speculation' };

  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  freeze(LEVELS); freeze(PIPES);
  const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
  const TOTAL_KEYS = ['salary', 'overtime', 'investmentIncome', 'consumption', 'shockCost', 'liquidationLoss',
    'eaten', 'spilled', 'training', 'marketResult', 'revaluation'];
  const zeroRates = () => ({ salary: 0, overtime: 0, investmentIncome: 0, drain: 0, consumption: 0, shockCost: 0,
    actual: Object.fromEntries(PIPES.map(p => [p.id, 0])), incomeOverflow: 0, eaten: 0, spilled: 0,
    spilledBy: { savings: 0, investments: 0, speculation: 0 }, liquidationLoss: 0, unpaid: 0 });
  const editable = s => s && ['ready', 'running', 'paused'].includes(s.status);
  const clone = s => ({ ...s, balances: { ...s.balances }, targets: { ...s.targets }, capacity: { ...s.capacity },
    pipes: s.pipes.map(p => ({ ...p })), training: s.training && { ...s.training },
    rates: { ...s.rates, actual: { ...s.rates.actual }, spilledBy: { ...s.rates.spilledBy } },
    totals: { ...s.totals }, events: s.events.map(e => ({ ...e })), _warned: { ...s._warned }, life: s.life ? JSON.parse(JSON.stringify(s.life)) : null });
  function event(s, text, type = 'info') {
    s.events.push({ id: ++s._eventId, time: s.time, text, type });
    if (s.events.length > 40) s.events.shift();
  }
  const fmt1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');

  function create(level = 'first', seedArg, opts = {}) {
    if (!Object.hasOwn(LEVELS, level)) level = 'first';
    const cfg = LEVELS[level];
    const capacity = { income: cfg.incomeCap }, targets = {}, on = cfg.jars || JARS;
    for (const id of JARS.slice(1)) {
      targets[id] = on.includes(id) ? cfg.targets[id] : 0;
      capacity[id] = on.includes(id) ? Math.round(cfg.targets[id] * cfg.brim[id]) : 100;
    }
    const s = { version: VERSION, level, status: 'ready', time: 0,
      balances: { ...cfg.initial }, targets, capacity,
      pipes: PIPES.map(p => ({ ...p, connected: p.id === 'income-consumption',
        opening: p.id === 'income-consumption' ? (cfg.startOpening ?? 0.5) : p.kind === 'valve' ? 0.25 : 1 })),
      overtime: 0, comfort: 0.35, energy: 100, salaryLevel: 0, training: null, holdTime: 0, seed: cfg.endless ? (Number.isSafeInteger(seedArg) && seedArg > 0 ? seedArg >>> 0 : ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0) || 1) : 0,
      events: [], totals: Object.fromEntries(TOTAL_KEYS.map(k => [k, 0])),
      rates: zeroRates(), _accumulator: 0, _eventId: 0, _incomePhase: 'normal', _marketIndex: 0,
      _warned: { eaten: false, savings: false, investments: false, speculation: false, float: false, energy: false, happy: false } };
    s.life = cfg.life ? { prof: PROFESSIONS[opts.prof] ? opts.prof : 'office', goal: GOALS[opts.goal] ? opts.goal : 'freedom', slots: [], used: [], log: [], fx: {}, projects: [],
      business: 0, pending: null, offers: 0, nextAt: 0, goalState: 'build', goalUntil: 0, mortgage: 0, freeHold: 0, pauseUntil: 0, extraUntil: 0, extraRate: 0,
      focus: 'rest', edu: 0, eduLvl: 0, proj: 0, dreams: [], qSum: 0, eSum: 0, diff: Number.isInteger(opts.diff) ? clamp(opts.diff, 0, DIFFS.length - 1) : 0 } : null;
    s._resAmt = 0; s._resGap = 0; s._yInv = 0; s._yCons = 0; s._drop = null; s.lifestyle = 1; s._lsHold = 0; s.happy = 70; s.lostBy = '';
    event(s, cfg.startEvent || 'Подключайте трубы и переливы. Потребление не должно опустеть.');
    return s;
  }
  function play(s) { if (!s || !['ready', 'paused'].includes(s.status)) return s; const n = clone(s); n.status = 'running'; return n; }
  function pause(s) { if (!s || s.status !== 'running') return s; const n = clone(s); n.status = 'paused'; return n; }
  function togglePipe(s, id) {
    if (!editable(s) || !s.pipes.some(p => p.id === id) || !pipeAvailable(s.level, id)) return s;
    const n = clone(s), p = n.pipes.find(p => p.id === id); p.connected = !p.connected; return n;
  }
  function setValve(s, id, opening) {
    const p = s && s.pipes.find(q => q.id === id);
    if (!editable(s) || !p || p.kind === 'overflow' || !Number.isFinite(opening) || opening < 0 || opening > 1) return s;
    const n = clone(s); n.pipes.find(q => q.id === id).opening = opening; return n;
  }
  function setSource(s, id, value) {
    if (!editable(s) || !['overtime', 'comfort'].includes(id) || !Number.isFinite(value) || value < 0 || value > 1) return s;
    if (id === 'overtime' && LEVELS[s.level].overtime === false && value > 0) return s;
    const n = clone(s); n[id] = value;
    if (id === 'overtime' && n.life) { if (value > 0) n.life.focus = 'work'; else if (n.life.focus === 'work') n.life.focus = 'rest'; }
    return n;
  }
  // «Свободное время» in life mode: one priority at a time. Work = overtime; the rest turn it off.
  function setFocus(s, f) {
    if (!editable(s) || !lifeOf(s) || !FOCUS[f] || s.life.focus === f) return s;
    const n = clone(s); n.life.focus = f; n.overtime = f === 'work' ? (s.overtime > 0 ? s.overtime : 0.3) : 0; return n;
  }
  function lifeGoalInfo(s) {
    const L = lifeOf(s); if (!L) return null;
    const M = effMods(s), p = priceLevel(s), drain = regularDrain(s);
    const mandatory = mandatoryDrain(s);
    if (L.goal === 'good') { const disc = 1 - projShare(L, 0.2, 500), dreams = Object.entries(DREAMS).map(([id, d]) => ({ id, ...d, price: d.cost * p * disc, done: (L.dreams || []).includes(id) }));
      const avgComfort = s.time > 1 ? (L.qSum || 0) / s.time : s.comfort, reserve = mandatory * YEAR;
      return { goal: L.goal, state: L.goalState, dreams, avgComfort, reserve, have: s.balances.savings, allDreams: dreams.every(d => d.done), hold: L.freeHold || 0, disc,
        ok: dreams.every(d => d.done) && avgComfort >= 0.5 - EPS && s.balances.savings >= reserve, cash: s.balances.income + s.balances.savings + s.balances.investments * 0.9 }; }
    if (L.goal === 'sabbatical') { const need = drain * 3 * YEAR * 1.4 * (1 - projShare(L, 0.25, 400)), have = s.balances.income + s.balances.consumption + s.balances.savings + s.balances.investments * 0.9;
      return { goal: L.goal, state: L.goalState, need, have, ready: have >= need, left: Math.max(0, L.goalUntil - s.time) }; }
    if (L.goal === 'house') { const price = 2000 * p * (1 - projShare(L, 0.2, 500)), down = price * 0.3;
      return { goal: L.goal, state: L.goalState, need: down, have: s.balances.savings, ready: s.balances.savings >= down, price, left: Math.max(0, L.goalUntil - s.time), mortgage: L.mortgage }; }
    const side = sideIncome(s), pass = s.balances.investments * yieldOf(s) + side;
    return { goal: L.goal, state: L.goalState, need: drain, have: pass, side, ready: pass >= drain, hold: L.freeHold || 0 };
  }
  function lifeGoalAction(s, arg) {
    const L = lifeOf(s), info = lifeGoalInfo(s);
    if (L && L.goal === 'good') {
      const d = editable(s) && info.dreams.find(x => x.id === arg && !x.done);
      if (!d || info.cash + EPS < d.price) return s;
      const n = clone(s), B = n.balances; let left = d.price; const a = Math.min(B.income, left); B.income -= a; left -= a;
      const b = Math.min(B.savings, left); B.savings -= b; left -= b; if (left > EPS) { B.investments = Math.max(0, B.investments - left / 0.9); n.totals.liquidationLoss += left / 9; }
      n.life.dreams.push(d.id); n.energy = Math.min(100, n.energy + 30); n.happy = Math.min(100, (n.happy ?? 70) + 25); n.life.log.push(`${d.icon} ${d.name} — мечта сбылась`);
      event(n, `${d.icon} ${d.name}: мечта сбылась! −${Math.round(d.price)}, здоровье +30, счастье +25.`, 'good'); return n;
    }
    if (!L || !editable(s) || L.goalState !== 'build' || !info.ready || L.goal === 'freedom') return s;
    const n = clone(s), N = n.life;
    if (L.goal === 'sabbatical') { N.goalState = 'active'; N.goalUntil = n.time + 3 * YEAR; event(n, 'Отпуск начался: три года без зарплаты. Продержись!', 'good'); }
    else { n.balances.savings -= info.need; N.mortgage = info.price * 0.7 * 1.15 / (6 * YEAR); N.fx.drainMul = (N.fx.drainMul || 1) * 0.85; N.goalState = 'active'; N.goalUntil = n.time + 6 * YEAR;
      event(n, `Дом куплен! Взнос ${Math.round(info.need)}, ипотека ${Math.round(N.mortgage * 10) / 10}/с на 6 лет. Аренда больше не нужна: расходы −15%.`, 'good'); }
    return n;
  }
  function lifeChoose(s, idx, replace = -1) {
    const L = lifeOf(s); if (!L || !L.pending || !['paused', 'running'].includes(s.status)) return s;
    const n = clone(s), N = n.life, P = N.pending, p = priceLevel(n), fx = N.fx;
    if (P.kind === 'upgrade') {
      if (idx >= 0 && idx < P.options.length) { const id = P.options[idx];
        if (N.slots.length < maxSlots(n)) N.slots.push(id); else if (replace >= 0 && replace < N.slots.length) N.slots[replace] = id; else return s;
        N.log.push(`${UPGRADES[id].icon} ${UPGRADES[id].name}`); event(n, `Улучшение: ${UPGRADES[id].name}.`, 'good'); }
    } else {
      const F = FORKS[P.id], opt = F.options[idx]; if (!opt) return s;
      const cost = (opt.cost || 0) * p;
      if (cost) { if (n.balances.income + n.balances.savings + EPS < cost) return s; const a = Math.min(n.balances.income, cost); n.balances.income -= a; n.balances.savings -= cost - a; }
      const t = n.time;
      if (P.id === 'contract') { if (idx === 0) { fx.crisisMin = Math.max(fx.crisisMin || 0, 0.5); fx.wageAdd = (fx.wageAdd || 0) - 0.1; }
        if (idx === 1) { N.pauseUntil = t + 20; fx.salaryMul = (fx.salaryMul || 1) * 1.25; }
        if (idx === 2) { fx.salaryMul = (fx.salaryMul || 1) * 0.6; N.projects.push({ at: t + YEAR, pay: 900, restore: 1 / 0.6, title: 'Проект' }); } }
      if (P.id === 'move' && idx === 0) { fx.salaryMul = (fx.salaryMul || 1) * 1.25; fx.drainMul = (fx.drainMul || 1) * 1.2; }
      if (P.id === 'startup' && idx === 0) N.projects.push({ at: t + 2 * YEAR, pay: P.luck < 0.5 ? 1800 : 0, title: 'Стартап' });
      if (P.id === 'promo' && idx === 0) { fx.salaryMul = (fx.salaryMul || 1) * 1.2; fx.tireAdd = (fx.tireAdd || 0) + 0.6; }
      if (P.id === 'parents') { if (idx === 1) { N.extraUntil = t + YEAR; N.extraRate = 12; } if (idx === 2) { n.energy = Math.max(1, n.energy - 35); n.happy = Math.max(1, (n.happy ?? 70) - 15); } }
      if (P.id === 'doctor') { if (idx === 0) { N.pauseUntil = t + 15; n.energy = 100; fx.noIllness = true; } else { fx.drainMul = (fx.drainMul || 1) * 1.05; fx.tireAdd = (fx.tireAdd || 0) + 0.2; } }
      N.used.push(P.id); N.log.push(`${F.icon} ${F.title}: ${opt.label}`); event(n, `${F.title}: ${opt.label.toLowerCase()}.`, 'info');
    }
    N.pending = null; N.nextAt = Math.max(N.nextAt, n.time) + 2 * YEAR;
    return n;
  }
  function finishEndless(s) {
    if (!s || !LEVELS[s.level].endless || !['running', 'paused'].includes(s.status)) return s;
    const n = clone(s); n.status = 'won'; n.holdTime = HOLD_SECONDS; event(n, 'Система построена: капитал сам оплачивает жизнь.', 'good'); return n;
  }
  function upcoming(s, horizon = 15) {
    return levelShocks(s, s.time + horizon).filter(sh => sh.at > s.time + EPS && sh.at <= s.time + horizon + EPS).sort((a, b) => a.at - b.at);
  }
  function upgrade(s) {
    if (!editable(s) || s.training || s.salaryLevel >= 3 || LEVELS[s.level].training === false) return s;
    const cost = LEVELS[s.level].upgradeCosts[s.salaryLevel];
    if (s.balances.income + EPS < cost) return s;
    const n = clone(s);
    n.balances.income -= cost; n.totals.training += cost;
    n.training = { remaining: 10, cost, nextLevel: s.salaryLevel + 1 };
    event(n, `Обучение началось: −${cost} мон. Через 10 секунд постоянный доход вырастет на ${SKILL_STEP} мон/с.`, 'training');
    return n;
  }

  // Endless mode: a «year» is 30 s; phases repeat; each year's events come from the run's seed.
  const REST = 3, BASE_TIRE = 0.5, WORK_TIRE = 6;
  // ❤️ Здоровье (s.energy) and 😊 Счастье (s.happy) live on levels with overtime: both low → you earn less, zero → game over.
  const vitals = s => LEVELS[s.level].overtime !== false;
  const productivity = s => !vitals(s) ? 1 : (0.6 + 0.4 * Math.min(1, s.energy / 50)) * (0.8 + 0.2 * Math.min(1, (s.happy ?? 70) / 50));
  const YEAR = 30, PHASES = [
    { id: 'boom', name: 'Подъём', icon: '📈', salary: 1.1, drain: 1, swing: 0.08, hint: 'Зарплаты растут, рынок спокойный — время копить.' },
    { id: 'heat', name: 'Перегрев', icon: '🔥', salary: 1, drain: 1.15, swing: 0.15, hint: 'Жизнь дорожает, рынок на пике.' },
    { id: 'bust', name: 'Рецессия', icon: '🌧', salary: 0.8, drain: 1, swing: -0.3, hint: 'Рынки падают, работу могут сократить.' },
    { id: 'recovery', name: 'Восстановление', icon: '🌱', salary: 0.95, drain: 1, swing: 0.05, hint: 'Активы дешёвые, экономика медленно разгоняется.' }];
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const PHASE_BY_ID = Object.fromEntries(PHASES.map(p => [p.id, p]));
  const PHASE_NEXT = { boom: [['heat', 0.6], ['boom', 0.4]], heat: [['bust', 0.6], ['heat', 0.25], ['boom', 0.15]],
    bust: [['recovery', 0.7], ['bust', 0.3]], recovery: [['boom', 0.7], ['recovery', 0.2], ['bust', 0.1]] };
  // Difficulty 3+ of «Жизненный путь»: recessions come more often and last longer.
  const PHASE_NEXT_HARD = { boom: [['heat', 0.7], ['boom', 0.3]], heat: [['bust', 0.75], ['heat', 0.15], ['boom', 0.1]],
    bust: [['recovery', 0.6], ['bust', 0.4]], recovery: [['boom', 0.6], ['recovery', 0.15], ['bust', 0.25]] };
  const phaseCache = new Map();
  function phaseSeq(seed, y, hard = false) {
    const key = hard ? -seed - 1 : seed;
    let a = phaseCache.get(key);
    if (!a) { if (phaseCache.size > 16) phaseCache.clear(); a = ['boom']; phaseCache.set(key, a); }
    while (a.length <= y) {
      const r = rng((seed ^ Math.imul(a.length + 7, 374761393)) >>> 0)(), opts = (hard ? PHASE_NEXT_HARD : PHASE_NEXT)[a[a.length - 1]];
      let acc = 0, pick = opts[opts.length - 1][0];
      for (const [id, pr] of opts) { acc += pr; if (r < acc) { pick = id; break; } }
      a.push(pick);
    }
    return a[y];
  }
  // «Великий кризис»: rare, two years, stocks −50%, pay down to half. Never in the first 4 years, never twice in a row.
  const greatRaw = (seed, y, hard) => y >= 4 && phaseSeq(seed, y, hard) === 'bust' && rng((seed ^ Math.imul(y + 11, 747796405)) >>> 0)() < (hard ? 0.2 : 0.12);
  const greatAt = (seed, y, hard) => greatRaw(seed, y, hard) && !greatRaw(seed, y - 1, hard);
  function yearShocks(seed, y, hard = false) {
    const ids = ['boom', 'heat', 'bust', 'recovery'], r = rng((seed ^ Math.imul(y + 1, 2654435761)) >>> 0), c = Math.floor(y / 4), t0 = y * YEAR, ph = ids.indexOf(phaseSeq(seed, y, hard)), list = [];
    if (ph === 0 && r() < 0.5) list.push({ id: `bonus-${y}`, type: 'bonus', at: t0 + 8 + Math.round(r() * 15), duration: 4, amount: Math.round(250 + r() * 100), title: 'Премия' });
    if (ph === 1 && r() < 0.6) list.push({ id: `repair-${y}`, type: 'bill', at: t0 + 5 + Math.round(r() * 18), duration: 6, extraDrain: 18, title: 'Срочный ремонт' });
    if (y > 0 && greatAt(seed, y - 1, hard)) return list; // the second year of a great crisis brings nothing else
    if (ph === 2 && greatAt(seed, y, hard)) {
      const d = r(), share = r(); void d;
      list.push({ id: `great-${y}`, type: 'crisis', great: true, at: t0 + 3, duration: 2 * YEAR, invDrop: 0.5, specDrop: 0.7, salaryFloor: 0.5, recoverAfter: 2 * YEAR + 15, recoverShare: Math.round((0.5 + share * 0.4) * 100) / 100, title: 'Великий кризис' });
      return list;
    }
    if (ph === 2) {
      list.push({ id: `crisis-${y}`, type: 'crisis', at: t0 + 3, duration: Math.min(25, 10 + 3 * c), invDrop: Math.round((0.12 + r() * 0.1) * 100) / 100, specDrop: 0.3, recoverAfter: 45, recoverShare: Math.round((0.35 + r() * 0.65) * 100) / 100, title: 'Рецессия' });
      if (r() < 0.3 + 0.05 * c) list.push({ id: `illness-${y}`, type: 'illness', at: t0 + 18, duration: 10, drainFactor: 1.8, title: 'Болезнь' });
    }
    if (ph === 3 && r() < 0.4) list.push({ id: `bonus-${y}`, type: 'bonus', at: t0 + 10 + Math.round(r() * 12), duration: 4, amount: 220, title: 'Премия' });
    return list;
  }
  function levelShocks(s, t = s.time) {
    const cfg = LEVELS[s.level]; if (s._stress) return [];
    if (!cfg.endless) return cfg.shocks;
    const y = Math.floor((t + EPS) / YEAR), out = [];
    for (let k = Math.max(0, y - 2); k <= y + 1; k++) out.push(...yearShocks(s.seed || 0, k, hardCycle(s)));
    return out;
  }
  // ---------- «Жизненный путь»
  const PROFESSIONS = {
    office: { name: 'Офис', icon: '🏢', text: 'Ровная зарплата 16/с без пауз между выплатами. Растёт вслед за ценами на 0,5 от их роста. В рецессию могут сократить — дохода не будет.', mods: { salary: 16, wageElast: 0.5 } },
    freelance: { name: 'Фриланс', icon: '💻', text: 'Платят больше — 22/с, но пачкой раз в 15 с. Растёт за ценами на 0,55. В рецессию заказов вдвое меньше, но не ноль.', mods: { salary: 22, payEvery: 15, wageElast: 0.55, crisisSalary: 0.5 } },
    business: { name: 'Своё дело', icon: '🛠', text: 'Начинаешь с 10/с, каждый спокойный год дело растёт на +1,5/с. Растёт за ценами на 0,7. Выручка колеблется, в рецессию падает до 30%.', mods: { salary: 10, bizGrowth: 1.5, wageElast: 0.7, crisisSalary: 0.3, volatile: true } }
  };
  const GOALS = {
    sabbatical: { name: 'Год для себя', icon: '🏝', text: 'Накопи запас на 3 года жизни и уйди в отпуск без зарплаты. Переживёшь их — победа.' },
    house: { name: 'Свой дом', icon: '🏠', text: 'Накопи наличными в подушке первый взнос 30%, купи дом и выплати ипотеку за 6 лет. Дом снижает расходы на жизнь.' },
    freedom: { name: 'Свобода', icon: '🏖', text: 'Построй капитал, который сам оплачивает всю жизнь, и удержи это 10 секунд.' },
    good: { name: 'Хорошая жизнь', icon: '🎈', text: 'Исполни три мечты, не отказывай себе в хотелках (в среднем от 50%) и держи в подушке запас на год жизни.' }
  };
  const DREAMS = { party: { icon: '🎉', name: 'Праздник', cost: 300 }, trip: { icon: '✈️', name: 'Путешествие', cost: 600 }, car: { icon: '🚗', name: 'Машина', cost: 1200 } };
  const FOCUS = { work: { icon: '💼', name: 'Подработка', text: 'Деньги сейчас. Отнимает ❤️ здоровье — силу подработки выбирай кнопкой 💪.' },
    study: { icon: '📚', name: 'Практика', text: 'Самостоятельная практика: каждые 30 с — зарплата +4% навсегда (до +40%). Бесплатно, но занимает свободное время и немного утомляет. Платный курс 🎓 на табличке труда — быстрее, но стоит денег.' },
    rest: { icon: '😌', name: 'Отдых', text: 'Здоровье восстанавливается быстрее, счастье растёт даже без хотелок. Денег не приносит.' },
    goal: { icon: '🎯', name: 'Личный проект', text: 'Двигает твою цель: удешевляет её или, для свободы, приносит свой доход. Немного утомляет, но радует.' } };
  const FOCUS_TIRE = { work: 0, study: 1, rest: -2, goal: 1 };
  const projShare = (L, cap, per) => Math.min(cap, (L.proj || 0) / per);
  const sideIncome = s => { const L = lifeOf(s); return L && L.goal === 'freedom' ? projShare(L, 2, 45) * priceLevel(s) : 0; };
  const UPGRADES = {
    insurance: { icon: '🛡', name: 'Страховой договор', text: 'Взнос 1,2/с, зато 70% счетов за ремонт и болезнь платит страховая.', mods: { premium: 1.2, billShare: 0.3 } },
    contract: { icon: '📜', name: 'Долгосрочный контракт', text: 'В рецессию доход не ниже 80%. Но зарплата слабее индексируется.', mods: { crisisFloor: 0.8, wageElastAdd: -0.2 } },
    special: { icon: '🎯', name: 'Узкая специализация', text: '+30% к зарплате. Но в рецессию такие специалисты не нужны: дохода нет.', mods: { salaryMul: 1.3, crisisZero: true } },
    autoinv: { icon: '🤖', name: 'Автоинвестирование', text: '15% зарплаты сразу уходит в Инвестиции, мимо Доходов.', mods: { autoInvest: 0.15 } },
    deposit: { icon: '🏦', name: 'Банковский вклад', text: 'Подушка на 60% защищена от инфляции. Но страховка из подушки работает вдвое медленнее.', mods: { savingsIndex: 0.6, floatMul: 0.5 } },
    health: { icon: '🏋', name: 'Спорт и врач', text: 'Не устаёшь сам по себе и не болеешь. Абонемент 0,6/с.', mods: { baseTire: 0, noIllness: true, premium: 0.6 } },
    index: { icon: '📈', name: 'Индексный фонд', text: 'Инвестиции падают в кризис на 40% меньше. Доходность на 20% ниже.', mods: { invDropMul: 0.6, yieldMul: 0.8 } },
    handy: { icon: '🧰', name: 'Мастер на все руки', text: 'Ремонт вдвое дешевле, подработка утомляет на 30% меньше.', mods: { repairMul: 0.5, workTireMul: 0.7 } },
    side: { icon: '💼', name: 'Любимая подработка', text: 'Подработка до 30% не утомляет. Основная зарплата −10%.', mods: { overtimeFreeTo: 0.3, salaryMul: 0.9 } }
  };
  const FORKS = {
    contract: { icon: '📄', title: 'Контракт заканчивается', text: 'Через месяц заканчивается контракт. Что дальше?', options: [
      { label: 'Продлить', text: 'Стабильность: в рецессию доход не ниже 50%. Но индексация чуть слабее.' },
      { label: 'Переучиться', cost: 250, text: 'Стоит 250 и 20 с без зарплаты. Потом зарплата +25% навсегда.' },
      { label: 'Взять проект', text: 'Год зарплата 60%, в конце года — выплата 900.' }] },
    move: { icon: '🏙', title: 'Работа в большом городе', text: 'Зовут в столицу: платят больше, но и жизнь дороже.', options: [
      { label: 'Переехать', text: 'Зарплата +25%, расходы на жизнь +20% навсегда.' },
      { label: 'Остаться', text: 'Всё как было.' }] },
    startup: { icon: '🚀', title: 'Друг зовёт в стартап', text: 'Нужно вложить деньги. Через 2 года — или большая выплата, или ничего.', options: [
      { label: 'Вложить 400', cost: 400, text: 'Шанс 50%: через 2 года получишь 1800. Или ноль.' },
      { label: 'Отказаться', text: 'Деньги останутся при тебе.' }] },
    promo: { icon: '📈', title: 'Повышение с переработками', text: 'Предлагают должность выше, но работы будет больше.', options: [
      { label: 'Согласиться', text: 'Зарплата +20%, но здоровье тает быстрее.' },
      { label: 'Отказаться', text: 'Всё как было.' }] },
    parents: { icon: '👵', title: 'Родителям нужен ремонт', text: 'Родители просят помочь с ремонтом.', options: [
      { label: 'Сразу 300', cost: 300, text: 'Одна крупная трата сейчас.' },
      { label: 'Частями', text: 'Год по 12/с к расходам — в сумме больше, зато без удара по запасам.' },
      { label: 'Отказать', text: 'Денег не тратишь, но переживаешь: здоровье −35, счастье −15.' }] },
    doctor: { icon: '🩺', title: 'Врач советует отдохнуть', text: 'Усталость копится. Врач предлагает перерыв.', options: [
      { label: 'Отдохнуть', text: '15 с без зарплаты, здоровье полностью восстановится, болезни больше не страшны.' },
      { label: 'Работать дальше', text: 'Здоровье подорвано: расходы +5%, устаёшь быстрее.' }] }
  };
  const lifeOf = s => (LEVELS[s.level].life && s.life) || null;
  // Difficulty steps of «Жизненный путь», each adds to the ones before. They take away slack, never give power.
  const DIFFS = [
    { icon: '🌱', name: 'Обычная', text: 'Правила как есть.' },
    { icon: '🎈', name: 'Дорогая жизнь', text: 'Цены растут быстрее: +55% за цикл вместо +40%.' },
    { icon: '🧩', name: 'Тесно', text: 'Только два слота улучшений.' },
    { icon: '🌧', name: 'Штормит', text: 'Рецессии приходят чаще и длятся дольше.' },
    { icon: '❤️', name: 'На износ', text: 'Здоровье и счастье тают быстрее.' },
    { icon: '🧾', name: 'Мастер потока', text: 'Расходы на жизнь +15%.' }];
  const lifeDiff = s => (lifeOf(s) && s.life.diff) || 0;
  const hardCycle = s => lifeDiff(s) >= 3;
  const maxSlots = s => lifeDiff(s) >= 2 ? 2 : 3;
  const compoundOf = s => (LEVELS[s.level].compound || 0) + (lifeDiff(s) >= 1 ? 0.15 : 0);
  // «Уровень жизни»: rewarded only when higher spending is carried by the flow, not by the reserve.
  const LIFESTYLE = [null,
    { icon: '🥪', name: 'Самое необходимое' },
    { icon: '🍕', name: 'Маленькие радости', comfort: 0.35 },
    { icon: '🛋', name: 'Уют', comfort: 0.7 },
    { icon: '✈️', name: 'Достаток', comfort: 1, free: 0.25 },
    { icon: '🏖', name: 'Изобилие', comfort: 1, free: 0.6 }];
  const LS_HOLD = 12;
  const lifestyleMax = s => activeJars(s.level).includes('investments') ? 5 : 3;
  function lifestyleCheck(s, r) {
    const T = LIFESTYLE[s.lifestyle + 1]; if (!T || s.lifestyle >= lifestyleMax(s)) return { tier: null, ok: false, why: '' };
    const free = regularDrain(s) > 0 ? (s.balances.investments * yieldOf(s) + sideIncome(s)) / regularDrain(s) : 0;
    const why = s.comfort < T.comfort - EPS ? `хотелки ${Math.round(T.comfort * 100)}%`
      : s.balances.consumption < floatLine(s) || r.unpaid > 0 ? 'Потребление выше красной черты'
      : (r.actual['savings-consumption'] || 0) > 0.01 ? 'не тратить подушку'
      : T.free && free < T.free ? `капитал покрывает ${Math.round(T.free * 100)}% расходов` : '';
    return { tier: s.lifestyle + 1, ok: !why, why };
  }
  function effMods(s) {
    const L = lifeOf(s); if (!L) return null;
    const cfg = LEVELS[s.level], prof = PROFESSIONS[L.prof] || PROFESSIONS.office, fx = L.fx || {};
    const M = { salary: cfg.salary, payEvery: 0, wageElast: cfg.wageElasticity, crisisSalary: 0, salaryMul: 1, drainMul: 1, premium: 0, billShare: 1, repairMul: 1,
      invDropMul: 1, yieldMul: 1, autoInvest: 0, savingsIndex: 0, floatMul: 1, baseTire: BASE_TIRE, workTireMul: 1, overtimeFreeTo: 0, noIllness: false, bizGrowth: 0, volatile: false, ...prof.mods };
    M.salaryMul *= fx.salaryMul || 1; M.drainMul *= fx.drainMul || 1; M.crisisSalary = Math.max(M.crisisSalary, fx.crisisMin || 0);
    M.wageElast += fx.wageAdd || 0; M.baseTire += fx.tireAdd || 0; if (fx.noIllness) M.noIllness = true;
    let floor = 0, zero = false;
    for (const id of L.slots || []) { const u = (UPGRADES[id] || {}).mods || {};
      if (u.salaryMul) M.salaryMul *= u.salaryMul; if (u.yieldMul) M.yieldMul *= u.yieldMul; if (u.invDropMul) M.invDropMul *= u.invDropMul;
      if (u.premium) M.premium += u.premium; if (u.billShare != null) M.billShare = Math.min(M.billShare, u.billShare); if (u.repairMul) M.repairMul *= u.repairMul;
      if (u.autoInvest) M.autoInvest += u.autoInvest; if (u.savingsIndex) M.savingsIndex = Math.max(M.savingsIndex, u.savingsIndex); if (u.floatMul) M.floatMul *= u.floatMul;
      if (u.baseTire != null) M.baseTire = Math.min(M.baseTire, u.baseTire + (fx.tireAdd || 0)); if (u.workTireMul) M.workTireMul *= u.workTireMul;
      if (u.overtimeFreeTo) M.overtimeFreeTo = Math.max(M.overtimeFreeTo, u.overtimeFreeTo); if (u.noIllness) M.noIllness = true;
      if (u.wageElastAdd) M.wageElast += u.wageElastAdd; if (u.crisisFloor) floor = Math.max(floor, u.crisisFloor); if (u.crisisZero) zero = true; }
    M.crisisSalary = zero ? 0 : Math.max(M.crisisSalary, floor); M.wageElast = Math.max(0, M.wageElast);
    M.salaryMul *= 1 + 0.04 * (L.eduLvl || 0);
    if (L.goal === 'sabbatical' && L.goalState === 'active') M.drainMul *= 1 - projShare(L, 0.25, 400);
    if ((L.diff || 0) >= 4) M.baseTire += 0.3;
    if ((L.diff || 0) >= 5) M.drainMul *= 1.15;
    return M;
  }
  const lifePaused = s => { const L = lifeOf(s); return !!L && ((L.goalState === 'active' && L.goal === 'sabbatical') || s.time < (L.pauseUntil || 0)); };
  function lifeOffer(s, n) {
    const L = s.life, r = rng((s.seed ^ Math.imul(n + 3, 2246822519)) >>> 0);
    const pickUp = () => { const pool = Object.keys(UPGRADES).filter(id => !L.slots.includes(id)); const out = [];
      while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); return { kind: 'upgrade', options: out }; };
    if (n % 2 === 0) return pickUp();
    const pool = Object.keys(FORKS).filter(id => !L.used.includes(id));
    if (!pool.length) return pickUp();
    const id = pool[Math.floor(r() * pool.length)];
    return { kind: 'fork', id, luck: r() };
  }
  const phaseAt = (s, t) => { const y = Math.floor((t + EPS) / YEAR); return PHASE_BY_ID[y > 0 && LEVELS[s.level].endless && greatAt(s.seed || 0, y - 1, hardCycle(s)) ? 'bust' : phaseSeq(s.seed || 0, y, hardCycle(s))]; };
  function salaryCondition(s) {
    const cfg = LEVELS[s.level], cycle = Math.floor((s.time + EPS) / 45), within = s.time - cycle * 45;
    if (!cfg.volatility || cycle === 0 || within >= 10 - EPS) return { factor: 1, phase: 'normal' };
    return cycle % 2 ? { factor: 1 - cfg.volatility, phase: 'low' } : { factor: 1 + cfg.volatility * 0.5, phase: 'high' };
  }
  function activeShocks(s) {
    return levelShocks(s).filter(sh => s.time + EPS >= sh.at && s.time + EPS < sh.at + sh.duration);
  }
  function scenario(s) {
    const phase = salaryCondition(s), m = { phase, salaryFactor: phase.factor, drainFactor: 1, extraDrain: 0, overtimeFactor: 1 };
    const M = effMods(s);
    if (LEVELS[s.level].endless) { const ph = phaseAt(s, s.time); m.salaryFactor *= ph.salary; m.drainFactor *= ph.drain; }
    if (M && M.volatile) m.salaryFactor *= 1 + 0.25 * Math.sin(s.time * 0.21);
    if (s._stress && s.time + EPS >= s._stress.from && s.time < s._stress.to) { m.salaryFactor = s.time < s._stress.jobless ? 0 : Math.min(m.salaryFactor, s._stress.salary); m.drainFactor *= s._stress.drainMul || 1; }
    for (const sh of activeShocks(s)) {
      if (sh.type === 'jobLoss' || sh.type === 'crisis') m.salaryFactor = Math.min(m.salaryFactor, Math.max(sh.salaryFloor || 0, M ? M.crisisSalary : 0));
      if (sh.type === 'illness' && !(M && M.noIllness)) { m.drainFactor *= 1 + (sh.drainFactor - 1) * (M ? M.billShare : 1); m.overtimeFactor = 0; }
      if (sh.type === 'bill') m.extraDrain += sh.extraDrain * rateScale(s) * (M ? M.billShare * M.repairMul : 1);
      if (sh.type === 'bonus') m.bonus = (m.bonus || 0) + sh.amount / sh.duration;
    }
    return m;
  }
  const activeJars = level => LEVELS[level].jars || JARS;
  const availablePipes = level => LEVELS[level].pipes || PIPES.map(p => p.id);
  const pipeAvailable = (level, id) => availablePipes(level).includes(id);
  const floatLine = s => s.targets.consumption * FLOAT_SHARE;
  const priceLevel = s => LEVELS[s.level].compound ? Math.pow(1 + compoundOf(s), s.time / (4 * YEAR)) : 1 + (LEVELS[s.level].inflation || 0) * s.time;
  // In endless mode every nominal amount (pipes, bills, bonuses) grows with prices; wages grow slower.
  const yieldOf = s => (LEVELS[s.level].yield ?? YIELD) * ((effMods(s) || {}).yieldMul || 1);
  const rateScale = s => LEVELS[s.level].endless ? priceLevel(s) : 1;
  const nominalDrain = s => (LEVELS[s.level].expense + LEVELS[s.level].comfortExpense * s.comfort) * priceLevel(s);
  // Regular obligations — one definition for the freedom goal, the freedom meter, the reserve and the life goals:
  // living costs and хотелки, premiums, a running mortgage and family payment. Short shocks and the phase surcharge are not regular.
  function regularDrain(s) {
    const M = effMods(s), L = lifeOf(s); if (!M) return nominalDrain(s);
    const k = rateScale(s);
    return nominalDrain(s) * M.drainMul + M.premium * k + (L.goalState === 'active' && L.goal === 'house' ? L.mortgage : 0) + (s.time < (L.extraUntil || 0) ? (L.extraRate || 0) * k : 0);
  }
  const mandatoryDrain = s => regularDrain(s) - LEVELS[s.level].comfortExpense * s.comfort * priceLevel(s) * ((effMods(s) || {}).drainMul || 1);

  // One physical step. Mutates s.balances and s.energy, returns rates. No events, no win/lose.
  function advance(s, dt) {
    const cfg = LEVELS[s.level], sc = scenario(s), r = zeroRates(), b = s.balances;
    const pipe = id => s.pipes.find(p => p.id === id);
    const M = effMods(s), L = lifeOf(s), off = lifePaused(s);
    const wage = cfg.endless ? Math.pow(priceLevel(s), M ? M.wageElast : cfg.wageElasticity) : 1, k = rateScale(s);
    const payEvery = M ? M.payEvery : cfg.payEvery, baseSal = (M ? M.salary + (L.business || 0) : cfg.salary) + s.salaryLevel * SKILL_STEP;
    r.salary = (payEvery || off ? 0 : baseSal * sc.salaryFactor * wage * productivity(s) * (M ? M.salaryMul : 1)) + (sc.bonus || 0) * k;
    r.overtime = off ? 0 : 9 * s.overtime * clamp(s.energy / 10, 0, 1) * sc.overtimeFactor * wage;
    r.investmentIncome = b.investments * yieldOf(s) + sideIncome(s);
    const base = nominalDrain(s) * (M ? M.drainMul : 1);
    r.drain = base * sc.drainFactor + sc.extraDrain + (M ? M.premium * k + (L.goalState === 'active' && L.goal === 'house' ? L.mortgage : 0) + (s.time < (L.extraUntil || 0) ? (L.extraRate || 0) * k : 0) : 0);

    // 1. Valve transfers from opening balances. Income pays by priority, not pro rata. No receiver throttling.
    const moves = [];
    let available = b.income;
    for (const p of s.pipes.filter(p => p.from === 'income' && p.kind === 'valve').sort((a, c) => a.priority - c.priority)) {
      const amount = p.connected ? Math.min(p.opening * p.maxRate * k * dt, available) : 0;
      available -= amount; moves.push([p, amount]);
    }
    for (const id of ['investments-income', 'speculation-income']) {
      const p = pipe(id);
      moves.push([p, p.connected ? Math.min(p.opening * p.maxRate * k * dt, b[p.from]) : 0]);
    }
    for (const [p, amount] of moves) {
      b[p.from] -= amount; b[p.to] += amount * (1 - p.loss);
      r.actual[p.id] = amount / dt; r.liquidationLoss += amount * p.loss / dt;
    }
    // 2. External inflow.
    const auto = M ? r.salary * M.autoInvest : 0;
    b.investments += auto * dt; r.auto = auto;
    b.income += (r.salary - auto + r.overtime + r.investmentIncome) * dt;
    // 3. Cascade overflow, top-down, in one pass.
    let excess = Math.max(0, b.income - s.capacity.income);
    b.income -= excess; b.consumption += excess; r.incomeOverflow = excess / dt;
    for (const jar of ['consumption', 'savings', 'investments', 'speculation']) {
      excess = Math.max(0, b[jar] - s.capacity[jar]);
      if (excess <= 0) continue;
      b[jar] -= excess;
      const link = OVERFLOW_OF[jar] && pipe(OVERFLOW_OF[jar]);
      if (link && link.connected) { b[link.to] += excess; r.actual[link.id] = excess / dt; }
      else if (jar === 'consumption') r.eaten += excess / dt;
      else { r.spilled += excess / dt; r.spilledBy[jar] = excess / dt; }
    }
    // 4. Float valve: opens only if consumption would fall below the float line, covers only that gap.
    const need = r.drain * dt, line = floatLine(s), R1 = pipe('savings-consumption');
    if (R1.connected && b.consumption - need < line) {
      const give = Math.max(0, Math.min(line + need - b.consumption, b.savings, R1.opening * R1.maxRate * k * (M ? M.floatMul : 1) * dt));
      b.savings -= give; b.consumption += give; r.actual[R1.id] = give / dt;
    }
    // 5. Living costs.
    const paid = Math.min(b.consumption, need);
    b.consumption -= paid; r.consumption = paid / dt; r.unpaid = (need - paid) / dt;
    r.shockCost = need > 0 ? (r.drain - base) * (paid / need) : 0;
    JARS.forEach(id => { if (b[id] < EPS) b[id] = 0; });
    // 6. Energy.
    // Rest comes from «хотелки»; overtime always costs strength. Levels without overtime keep strength full.
    if (cfg.overtime === false) s.energy = 100;
    else if (off) s.energy = clamp(s.energy + (4 - (L ? Math.max(0, FOCUS_TIRE[L.focus] || 0) : 0)) * dt, 0, 100);
    else s.energy = clamp(s.energy + (REST * s.comfort - (L ? FOCUS_TIRE[L.focus] || 0 : 0) - (M ? M.baseTire : BASE_TIRE) - WORK_TIRE * (M ? M.workTireMul : 1) * Math.max(0, s.overtime - (M ? M.overtimeFreeTo : 0)) * sc.overtimeFactor
      - (sc.overtimeFactor === 0 ? 1 : 0)) * dt, 0, 100);
    if (cfg.overtime !== false) {
      const hard = activeShocks(s).some(sh => sh.type === 'jobLoss' || sh.type === 'crisis');
      s.happy = clamp((s.happy ?? 70) + (2.5 * s.comfort - (lifeDiff(s) >= 4 ? 0.8 : 0.6) + (L && L.focus === 'rest' ? 0.8 : L && L.focus === 'goal' ? 0.4 : 0) + (off ? 1 : 0) - (hard ? 0.4 : 0)) * dt, 0, 100);
    }
    return r;
  }
  function previewRates(s) { return advance(clone(s), FIXED_DT); }

  // Market events already included in a state at this time. Treat the saved index as
  // derived metadata: a damaged index must never replay years of historical events.
  function marketIndexAt(level, time) {
    const m = LEVELS[level].market;
    if (!m) return 0;
    return Math.max(0, Math.floor((time + EPS - m.start) / m.every) + 1);
  }
  function applyMarket(s, t0, t1) {
    if (s._stress) return;
    if (!LEVELS[s.level].market) return;
    const m = LEVELS[s.level].market, beforeIndex = marketIndexAt(s.level, t0), afterIndex = marketIndexAt(s.level, t1);
    s._marketIndex = afterIndex;
    // A fixed physical step is 0.02 s; market events are at least 30 s apart.
    // Only the event crossed by this step can run, never events before t0.
    if (afterIndex === beforeIndex) return;
    const swing = LEVELS[s.level].endless ? Math.round((phaseAt(s, t1).swing + (rng((s.seed ^ Math.imul(afterIndex, 40503)) >>> 0)() - 0.5) * 0.12) * 100) / 100 : m.swings[(afterIndex - 1) % m.swings.length], before = s.balances.speculation;
    const delta = before * swing;
    s.balances.speculation = before + delta; s.totals.marketResult += delta;
    if (before > EPS) event(s, `Рынок: спекуляции ${swing > 0 ? '+' : '−'}${Math.round(Math.abs(swing) * 100)}% (${delta > 0 ? '+' : '−'}${Math.round(Math.abs(delta))} мон.).`, swing > 0 ? 'good' : 'warning');
  }
  const insured = s => !pipeAvailable(s.level, 'savings-consumption') ? '' : s.pipes.find(p => p.id === 'savings-consumption').connected ? ' Страховка из подушки подключена.' : ' Страховка из подушки выключена — подключите её.';
  function shockEvents(s, t0, t1) {
    const crosses = t => t0 + EPS < t && t <= t1 + EPS;
    for (const sh of levelShocks(s, t1)) {
      if (sh.type === 'crisis' && crosses(sh.at)) {
        const drop = sh.invDrop * ((effMods(s) || {}).invDropMul || 1), inv = s.balances.investments * drop, spec = s.balances.speculation * sh.specDrop;
        s._drop = { id: sh.id, v: drop }; // the recovery undoes this drop, whatever upgrades change later
        s.balances.investments -= inv; s.balances.speculation -= spec;
        s.totals.revaluation -= inv; s.totals.marketResult -= spec;
        const hit = [inv >= 0.5 ? `инвестиции −${Math.round(drop * 100)}%${drop < sh.invDrop - EPS ? ' — 📈 индексный фонд смягчил падение' : ''} (−${Math.round(inv)} мон., рынок вернётся, если не продавать на дне)` : '',
          spec >= 0.5 ? `спекуляции −${Math.round(sh.specDrop * 100)}% (−${Math.round(spec)} мон.)` : ''].filter(Boolean).join(', ');
        const keep = Math.max(sh.salaryFloor || 0, effMods(s) ? effMods(s).crisisSalary : 0);
        event(s, `${sh.great ? '🌋 Великий кризис на 2 года' : 'Кризис'}: ${keep > 0 ? `доход упал до ${Math.round(keep * 100)}%` : 'работы нет'}${sh.great ? '' : ' ' + sh.duration + ' с'}${hit ? ', ' + hit : ''}.${insured(s)}`, 'danger');
        continue;
      }
      if (sh.type === 'crisis' && crosses(sh.at + sh.recoverAfter)) {
        const d = s._drop && s._drop.id === sh.id ? s._drop.v : sh.invDrop * ((effMods(s) || {}).invDropMul || 1);
        const share = sh.recoverShare ?? 1, gain = s.balances.investments * (1 / (1 - d) - 1) * share;
        s.balances.investments += gain; s.totals.revaluation += gain;
        event(s, gain < 0.5 ? 'Рынок восстановился после кризиса.' : share >= 0.99 ? `Рынок восстановился: инвестиции +${Math.round(gain)} мон. Кто не продал на дне — вернул своё.` : `Рынок отыграл ${Math.round(share * 100)}% падения: инвестиции +${Math.round(gain)} мон.`, 'good');
      }
      if (sh.type === 'crisis') { if (crosses(sh.at + sh.duration)) event(s, `${sh.title}: доход восстановился. Пополните подушку.`, 'good'); continue; }
      if (sh.type === 'bonus') {
        if (crosses(sh.at)) event(s, `${sh.title}: +${sh.amount} монет за ${sh.duration} с! Открой краны, чтобы ничего не пролилось.`, 'good');
        if (crosses(sh.at + sh.duration)) event(s, `${sh.title} разложена по кувшинам.`, 'good');
        continue;
      }
      if (crosses(sh.at)) {
        const what = sh.type === 'jobLoss' ? `зарплата 0 на ${sh.duration} с`
          : sh.type === 'illness' ? `расходы ×${sh.drainFactor} и нет подработки ${sh.duration} с`
          : `счёт ${sh.extraDrain * sh.duration} мон. за ${sh.duration} с`;
        event(s, `Шок: ${sh.title} — ${what}.${insured(s)}`, 'danger');
      }
      if (crosses(sh.at + sh.duration)) event(s, `${sh.title}: шок закончился. Пополните подушку.`, 'good');
    }
  }

  // Whether a won state is legitimate for its mode: campaign jars, a finished life goal, a built system.
  function wonValid(s) {
    const cfg = LEVELS[s.level];
    if (cfg.life) return !!(s.life && s.life.goalState === 'done');
    if (cfg.endless) return true;
    return goals(s).all;
  }
  function goals(s) {
    const cfg = LEVELS[s.level], flow = cfg.salary + s.salaryLevel * SKILL_STEP + s.balances.investments * yieldOf(s);
    const g = {};
    if (cfg.flowTarget != null) g.income = flow + EPS >= cfg.flowTarget;
    for (const id of activeJars(s.level).slice(1)) if (!(cfg.optional || []).includes(id)) g[id] = s.balances[id] + EPS >= s.targets[id];
    if (cfg.freedomGoal) g.freedom = s.balances.investments * yieldOf(s) + EPS >= regularDrain(s);
    const keys = Object.keys(g), met = keys.filter(k => g[k]).length;
    return { flow, g, all: met === keys.length, met, total: keys.length };
  }

  function lumpPay(s) {
    const cfg = LEVELS[s.level], M = effMods(s), P = M ? M.payEvery : cfg.payEvery;
    if (!P || lifePaused(s)) return 0;
    return M ? ((M.salary + (s.life.business || 0) + s.salaryLevel * SKILL_STEP) * P * scenario(s).salaryFactor * Math.pow(priceLevel(s), M.wageElast) * productivity(s) * M.salaryMul)
      : (cfg.salary + s.salaryLevel * SKILL_STEP) * P * scenario(s).salaryFactor;
  }
  function payday(s, t0, t1) {
    const cfg = LEVELS[s.level], M = effMods(s), P = M ? M.payEvery : cfg.payEvery;
    if (!P || Math.floor((t1 + EPS) / P) === Math.floor((t0 + EPS) / P)) return;
    const pay = lumpPay(s); if (pay <= 0) return;
    const auto = M ? pay * M.autoInvest : 0; // the same split as a continuous salary
    s.balances.investments += auto; s.balances.income += pay - auto; s.totals.salary += pay;
  }
  function tick(s) {
    const dt = FIXED_DT, t0 = s.time, t1 = t0 + dt;
    const L = lifeOf(s);
    // An offer stops the tick before anything moves: time stays put, so nothing may be paid or priced twice.
    if (L && !L.pending && t1 + EPS >= L.nextAt) { L.pending = lifeOffer(s, L.offers); L.offers++; s.status = 'paused'; event(s, L.pending.kind === 'fork' ? `Развилка: ${FORKS[L.pending.id].title}.` : 'Можно взять новое улучшение.', 'info'); return; }
    applyMarket(s, t0, t1);
    payday(s, t0, t1);
    if (L) {
      const M = effMods(s), g = Math.log(1 + compoundOf(s)) / (4 * YEAR), crosses = t => t0 + EPS < t && t <= t1 + EPS;
      L.qSum = (L.qSum || 0) + s.comfort * dt; L.eSum = (L.eSum || 0) + s.energy * dt; L.hSum = (L.hSum || 0) + (s.happy ?? 70) * dt;
      if (L.focus === 'study' && (L.eduLvl || 0) < 10) { L.edu = (L.edu || 0) + dt * productivity(s);
        if (L.edu >= 30 - EPS) { L.edu = 0; L.eduLvl = (L.eduLvl || 0) + 1; event(s, `📚 Практика дала плоды: зарплата +4% (всего +${L.eduLvl * 4}%).`, 'good'); } }
      if (L.focus === 'goal' && L.goalState === 'build') { const before = L.proj || 0; L.proj = before + dt * productivity(s);
        const mark = L.goal === 'freedom' ? 45 : 100; if (Math.floor(L.proj / mark) > Math.floor(before / mark)) event(s, L.goal === 'freedom' ? `🎯 Свой проект растёт: приносит ${fmt1(sideIncome(s))}/с.` : `🎯 Личный проект: цель подешевела на ${Math.round((L.goal === 'sabbatical' ? projShare(L, 0.25, 400) : projShare(L, 0.2, 500)) * 100)}%.`, 'good'); }
      if (M.savingsIndex && s.balances.savings > 0) s.balances.savings *= Math.exp(g * M.savingsIndex * dt);
      if (Math.floor((t1 + EPS) / YEAR) !== Math.floor((t0 + EPS) / YEAR) && M.bizGrowth && phaseAt(s, t1).id !== 'bust') { L.business = Math.min(20, (L.business || 0) + M.bizGrowth); event(s, `Дело растёт: доход +${M.bizGrowth}/с.`, 'good'); }
      for (const pr of L.projects) if (!pr.done && crosses(pr.at)) {
        pr.done = true; const pay = pr.pay * priceLevel(s);
        if (pay > 0) { s.balances.income += pay; s.totals.salary += pay; }
        if (pr.restore) L.fx.salaryMul = (L.fx.salaryMul || 1) * pr.restore;
        event(s, pay > 0 ? `${pr.title}: выплата +${Math.round(pay)}.` : `${pr.title}: не выгорело — вложения потеряны.`, pay > 0 ? 'good' : 'warning');
      }
      if (L.goalState === 'active' && t1 + EPS >= L.goalUntil) { L.goalState = 'done'; if (L.goal === 'house') L.mortgage = 0;
        s.status = 'won'; s.holdTime = HOLD_SECONDS; s._accumulator = 0; event(s, L.goal === 'house' ? 'Ипотека выплачена — дом твой!' : 'Три года для себя прожиты — цель достигнута!', 'good'); }
      if (L.goal === 'freedom' && s.status === 'running') {
        const m = s.balances.investments * yieldOf(s) + sideIncome(s) >= regularDrain(s);
        L.freeHold = m ? (L.freeHold || 0) + dt : 0;
        if (L.freeHold >= 10 - EPS) { L.goalState = 'done'; s.status = 'won'; s.holdTime = HOLD_SECONDS; s._accumulator = 0; event(s, 'Капитал оплачивает жизнь — свобода достигнута!', 'good'); }
      }
      if (L.goal === 'good' && s.status === 'running') {
        const I = lifeGoalInfo(s); L.freeHold = I.ok ? (L.freeHold || 0) + dt : 0;
        if (L.freeHold >= 10 - EPS) { L.goalState = 'done'; s.status = 'won'; s.holdTime = HOLD_SECONDS; s._accumulator = 0; event(s, 'Мечты сбылись, запас цел — хорошая жизнь удалась!', 'good'); }
      }
      if (s.status !== 'running') return;
    }
    if (LEVELS[s.level].endless && s.balances.investments > 0) { // real assets keep up with prices; cash does not
      const g = Math.log(1 + compoundOf(s)) / (4 * YEAR), before = s.balances.investments;
      s.balances.investments = Math.min(s.capacity.investments, before * Math.exp(g * dt)); s.totals.revaluation += s.balances.investments - before;
    }
    if (LEVELS[s.level].endless && Math.floor((t1 + EPS) / YEAR) !== Math.floor((t0 + EPS) / YEAR)) { const y = Math.floor((t1 + EPS) / YEAR), ph = phaseAt(s, t1), inv = s.totals.investmentIncome - (s._yInv || 0), cons = s.totals.consumption - (s._yCons || 0);
      s._yInv = s.totals.investmentIncome; s._yCons = s.totals.consumption;
      if (inv >= 1 && cons > 0) event(s, `📈 За год капитал принёс ${Math.round(inv)} — это ${Math.round(inv / cons * 100)}% твоих расходов.`, 'good');
      event(s, `Год ${y + 1}: ${ph.name}. ${ph.hint}`, ph.id === 'bust' ? 'warning' : 'info'); }
    shockEvents(s, t0, t1);
    const phase = salaryCondition(s).phase;
    if (phase !== s._incomePhase) {
      if (phase === 'low') event(s, 'Поток дохода ослаб на 10 секунд. Проверьте запас потребления.', 'warning');
      else if (phase === 'high') event(s, 'Доход временно вырос на 10 секунд: есть возможность пополнить запасы.', 'good');
      else event(s, 'Обычный поток дохода восстановился.');
      s._incomePhase = phase;
    }
    const r = advance(s, dt);
    s.time = Math.round(t1 * 1e8) / 1e8;
    for (const k of ['salary', 'overtime', 'investmentIncome', 'consumption', 'shockCost', 'liquidationLoss', 'eaten', 'spilled']) s.totals[k] += r[k] * dt;
    s.rates = r;
    const warn = (key, on, text, type = 'warning') => {
      if (on && !s._warned[key]) { event(s, text, type); s._warned[key] = true; } else if (!on) s._warned[key] = false;
    };
    const av = id => pipeAvailable(s.level, id);
    warn('eaten', r.eaten > 0.01, av('consumption-savings') ? 'Потребление переполнено: излишек проедается. Подключите перелив в подушку.' : 'Потребление переполнено: излишек проедается. Убавьте кран.');
    warn('savings', r.spilledBy.savings > 0.01, av('savings-investments') ? 'Подушка полна: излишек льётся мимо. Подключите перелив в инвестиции или убавьте кран.' : 'Подушка полна: излишек льётся мимо. Прикройте вентиль.');
    warn('investments', r.spilledBy.investments > 0.01, av('investments-speculation') ? 'Инвестиции полны: излишек льётся мимо. Подключите перелив в спекуляции или убавьте кран.' : 'Инвестиции полны: излишек льётся мимо. Прикройте вентиль.');
    warn('speculation', r.spilledBy.speculation > 0.01, 'Спекуляции полны: излишек льётся мимо. Прикройте вентиль.');
    warn('float', r.actual['savings-consumption'] > 0.01, 'Страховка из подушки включилась: потребление у красной черты.', 'info');
    { const L = lifestyleCheck(s, r); s._lsHold = L.ok ? s._lsHold + dt : 0;
      if (L.ok && s._lsHold >= LS_HOLD - EPS) { s.lifestyle = L.tier; s._lsHold = 0; if (vitals(s)) s.happy = Math.min(100, (s.happy ?? 70) + 15); const T = LIFESTYLE[L.tier]; event(s, `${T.icon} Уровень жизни ${L.tier}: «${T.name}»! Система сама оплачивает такую жизнь.`, 'good'); } }
    const rescued = r.actual['savings-consumption'] * dt;
    if (rescued > 0) { s._resAmt += rescued; s._resGap = 0; }
    else if (s._resAmt > 0 && (s._resGap += dt) >= 2 - EPS) {
      if (s._resAmt >= 15) event(s, `🛟 Подушка спасла: перелила ${Math.round(s._resAmt)} в Потребление. В подушке осталось ${Math.round(s.balances.savings)}.`, 'good');
      s._resAmt = 0; s._resGap = 0;
    }
    if (vitals(s) && s.energy < 25 && !s._warned.energy) { event(s, '❤️ Здоровье на исходе: зарплата слабеет, а на нуле — выгорание. Убавь подработку 💪, отдохни или добавь хотелок.', 'warning'); s._warned.energy = true; }
    else if (s.energy > 40) s._warned.energy = false;
    if (s.training) {
      s.training.remaining = Math.max(0, s.training.remaining - dt);
      if (s.training.remaining < EPS) {
        s.salaryLevel = s.training.nextLevel; s.training = null;
        event(s, `Обучение завершено: постоянный доход вырос на ${SKILL_STEP} мон/с.`, 'good');
      }
    }
    if (s.balances.consumption <= EPS) {
      s.status = 'lost'; s.holdTime = 0; s._accumulator = 0; s.lostBy = 'money';
      event(s, 'Потребление опустело: жить не на что. Поток остановлен.', 'danger'); return;
    }
    if (vitals(s)) {
      warn('happy', s.happy < 25, '😊 Счастье на исходе: жизнь без радостей. Добавь хотелок 🛍 или отдохни.', 'warning');
      if (s.energy <= EPS || s.happy <= EPS) {
        const health = s.energy <= EPS; s.status = 'lost'; s.holdTime = 0; s._accumulator = 0; s.lostBy = health ? 'health' : 'happy';
        event(s, health ? '❤️ Здоровье на нуле: выгорание. Поток остановлен.' : '😊 Счастье на нуле: пора пересмотреть образ жизни. Поток остановлен.', 'danger'); return;
      }
    }
    if (LEVELS[s.level].endless) return;
    const gl = goals(s), oldHold = s.holdTime;
    const counts = gl.all && s.time + EPS >= (LEVELS[s.level].goalsAfter || 0);
    s.holdTime = counts ? Math.min(HOLD_SECONDS, s.holdTime + dt) : 0;
    if (counts && oldHold === 0) event(s, 'Все цели достигнуты. Удерживайте их 10 секунд.', 'good');
    if (s.holdTime >= HOLD_SECONDS - EPS) {
      s.holdTime = HOLD_SECONDS; s.status = 'won'; s._accumulator = 0;
      event(s, 'Победа! Все цели удержаны 10 секунд.', 'good');
    }
  }
  function step(s, dt) {
    if (!s || s.status !== 'running' || !Number.isFinite(dt) || dt <= 0 || dt > MAX_DT) return s;
    const n = clone(s); n._accumulator += dt;
    while (n._accumulator + EPS >= FIXED_DT && n.status === 'running') { n._accumulator = Math.max(0, n._accumulator - FIXED_DT); tick(n); }
    return n;
  }
  function metrics(s) {
    const cfg = LEVELS[s.level], r = previewRates(s), gl = goals(s);
    const cost = cfg.upgradeCosts[s.salaryLevel] ?? null, drain = regularDrain(s);
    const inbound = r.actual['income-consumption'] + r.actual['savings-consumption'] + r.incomeOverflow;
    const net = r.drain - inbound;
    return { total: JARS.reduce((sum, id) => sum + s.balances[id], 0),
      incomeFlow: gl.flow, flowTarget: cfg.flowTarget, goals: gl.g, goalsMet: gl.met, goalsTotal: gl.total, allFull: gl.all, goalsAfter: cfg.goalsAfter || 0,
      jars: [...activeJars(s.level)], pipes: [...availablePipes(s.level)], training: cfg.training !== false, overtime: cfg.overtime !== false,
      holdRemaining: Math.max(0, HOLD_SECONDS - s.holdTime), floatLine: floatLine(s),
      consumptionSeconds: net > EPS ? s.balances.consumption / net : Infinity,
      baseSalary: cfg.salary + s.salaryLevel * SKILL_STEP, passive: s.balances.investments * yieldOf(s),
      freedom: drain > 0 ? (s.balances.investments * yieldOf(s) + sideIncome(s)) / drain : 0, freedomGoal: !!cfg.freedomGoal, sustainableOvertime: 0.3,
      ...(() => { const M = effMods(s), P = M ? M.payEvery : cfg.payEvery || 0, base = M ? (M.salary + (s.life.business || 0) + s.salaryLevel * SKILL_STEP) * M.salaryMul * Math.pow(priceLevel(s), M.wageElast) : cfg.salary + s.salaryLevel * SKILL_STEP;
        return { payEvery: P, nextPayIn: P ? P - ((s.time + EPS) % P) : 0, payLump: P ? lumpPay(s) : 0, payBase: P ? base * P : 0 }; })(),
      pricePct: Math.round((priceLevel(s) - 1) * 100), drain, happy: s.happy ?? 70, vitals: vitals(s), diff: lifeDiff(s), slotsMax: maxSlots(s), lifestyle: s.lifestyle || 1, lifestyleMax: lifestyleMax(s), lsHold: s._lsHold || 0, lsNext: lifestyleCheck(s, r), reserveYears: (s.balances.savings + s.balances.consumption) / Math.max(EPS, mandatoryDrain(s) * YEAR), life: lifeGoalInfo(s), mods: effMods(s), lifeOff: lifePaused(s), realTotal: JARS.reduce((sum, id) => sum + s.balances[id], 0) / priceLevel(s), productivity: productivity(s),
      cycle: cfg.endless ? { year: Math.floor((s.time + EPS) / YEAR) + 1, years: Math.floor((s.time + EPS) / YEAR), phase: phaseAt(s, s.time), nextProbs: (hardCycle(s) ? PHASE_NEXT_HARD : PHASE_NEXT)[phaseAt(s, s.time).id].map(([id, p]) => ({ ...PHASE_BY_ID[id], p })), nextIn: YEAR - ((s.time + EPS) % YEAR), yearLen: YEAR } : null,
      activeShocks: activeShocks(s).map(sh => sh.id), nextShock: cfg.shocks.find(sh => sh.at > s.time + EPS) || null,
      upgradeCost: cost, canUpgrade: editable(s) && cfg.training !== false && !s.training && cost !== null && s.balances.income + EPS >= cost };
  }

  function validateSave(raw) {
    try {
      const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const number = (x, min = 0, max = 1e9) => Number.isFinite(x) && x >= min && x <= max;
      const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
      const assert = (ok, why) => { if (!ok) throw new Error(why); };
      assert(record(s), 'Сохранение не удалось прочитать.');
      assert(s.version === VERSION, s.version === 2 ? 'Сохранение от прошлой версии игры. Начните новую систему.' : 'Неподдерживаемая версия сохранения.');
      assert(Object.hasOwn(LEVELS, s.level), 'Неизвестный уровень.');
      assert(['ready', 'running', 'paused', 'won', 'lost'].includes(s.status), 'Неверное состояние игры.');
      assert(number(s.time) && number(s.holdTime, 0, HOLD_SECONDS) && number(s._accumulator, 0, FIXED_DT), 'Неверное игровое время.');
      const fresh = create(s.level);
      assert(record(s.balances) && record(s.targets) && record(s.capacity), 'Неверные кувшины.');
      JARS.forEach(id => {
        assert(s.capacity?.[id] === fresh.capacity[id], 'Размеры кувшинов повреждены.');
        assert(number(s.balances?.[id], 0, fresh.capacity[id] + 1e-6), 'Неверный баланс.');
      });
      JARS.slice(1).forEach(id => assert(s.targets?.[id] === fresh.targets[id], 'Цели сохранения повреждены.'));
      assert(Array.isArray(s.pipes) && s.pipes.length === PIPES.length, 'Неверные трубы.');
      PIPES.forEach((p, i) => {
        const saved = s.pipes[i];
        assert(record(saved) && ['id', 'from', 'to', 'kind', 'maxRate', 'loss'].every(k => saved[k] === p[k]) &&
          typeof saved.connected === 'boolean' && number(saved.opening, 0, 1), 'Неверный вентиль.');
      });
      assert(s.pipes.every(p => !p.connected || pipeAvailable(s.level, p.id)), 'Неверные трубы.');
      assert(number(s.energy, 0, 100) && number(s.overtime, 0, 1) && number(s.comfort, 0, 1), 'Неверные источники.');
      assert(Number.isInteger(s.salaryLevel) && s.salaryLevel >= 0 && s.salaryLevel <= 3, 'Неверный доход.');
      if (s.training !== null) assert(record(s.training) && s.salaryLevel < 3 && number(s.training.remaining, 0, 10) &&
        s.training.nextLevel === s.salaryLevel + 1 && s.training.cost === LEVELS[s.level].upgradeCosts[s.salaryLevel], 'Неверное обучение.');
      assert(record(s.totals), 'Неверные итоги.');
      TOTAL_KEYS.forEach(k => assert(number(s.totals[k], ['marketResult', 'revaluation'].includes(k) ? -1e9 : 0), 'Неверные итоги.'));
      assert(Array.isArray(s.events) && s.events.length <= 40 && Array.from(s.events).every(e =>
        record(e) && Number.isSafeInteger(e.id) && e.id >= 0 && number(e.time) && typeof e.text === 'string' && e.text.length < 500 &&
        ['info', 'warning', 'good', 'danger', 'training'].includes(e.type)), 'Неверный журнал.');
      assert(Number.isSafeInteger(s._eventId) && s._eventId >= 0 && ['normal', 'low', 'high'].includes(s._incomePhase), 'Неверные метаданные.');
      assert(Number.isSafeInteger(s._marketIndex) && s._marketIndex >= 0, 'Неверные метаданные.');
      assert(record(s._warned) && Object.keys(fresh._warned).every(k => s._warned[k] === undefined || typeof s._warned[k] === 'boolean'), 'Неверные метаданные.');
      assert((s.status !== 'lost' || s.balances.consumption === 0 || s.energy === 0 || s.happy === 0) && (s.status !== 'won' || s.holdTime === HOLD_SECONDS), 'Неверный итог игры.');
      const known = Object.fromEntries(Object.keys(fresh).map(k => [k, k === 'rates' ? fresh.rates : s[k]]));
      const n = clone(known);
      n.pipes = PIPES.map((p, i) => ({ ...p, connected: s.pipes[i].connected, opening: s.pipes[i].opening }));
      n.targets = { ...fresh.targets }; n.capacity = { ...fresh.capacity };
      n._marketIndex = marketIndexAt(n.level, n.time);
      n.rates = zeroRates();
      n.seed = Number.isSafeInteger(s.seed) && s.seed >= 0 ? s.seed : 0;
      n.lifestyle = Number.isInteger(s.lifestyle) && s.lifestyle >= 1 && s.lifestyle <= 5 ? s.lifestyle : 1; n._lsHold = number(s._lsHold, 0, LS_HOLD) ? s._lsHold : 0;
      n._warned = { ...fresh._warned, ...s._warned }; n.happy = number(s.happy, 0, 100) ? s.happy : 70; n.lostBy = ['money', 'health', 'happy'].includes(s.lostBy) ? s.lostBy : '';
      n._resAmt = 0; n._resGap = 0; n._yInv = n.totals.investmentIncome; n._yCons = n.totals.consumption;
      if (LEVELS[n.level].life) {
        const L = s.life;
        assert(record(L) && PROFESSIONS[L.prof] && GOALS[L.goal] && Array.isArray(L.slots) && L.slots.length <= 3 && L.slots.every(id => UPGRADES[id]) && Array.isArray(L.used) && Array.isArray(L.projects) && record(L.fx), 'Неверный жизненный путь.');
        assert(!L.focus || FOCUS[L.focus], 'Неверный жизненный путь.');
        assert(L.diff === undefined || (Number.isInteger(L.diff) && L.diff >= 0 && L.diff < DIFFS.length) && L.slots.length <= (L.diff >= 2 ? 2 : 3), 'Неверная сложность.');
        n.life = JSON.parse(JSON.stringify(L));
      } else n.life = null;
      assert(n.status !== 'won' || wonValid(n), 'Неверный итог игры.');
      n._drop = s._drop && typeof s._drop.id === 'string' && number(s._drop.v, 0, 1) ? { id: s._drop.id, v: s._drop.v } : null;
      if (n.status === 'running') n.status = 'paused';
      return { ok: true, state: n };
    } catch (error) { return { ok: false, error: error.message || 'Сохранение не удалось прочитать.' }; }
  }

  // ---------- «Стресс-тест»: the player's current system, taps frozen, through two years of hard crisis and one
  // year after it. It runs on a copy: the game itself is untouched. Like a bank stress test, nobody steps in.
  const STRESS = { years: 2, jobless: 1, invDrop: 0.5, specDrop: 0.7, salary: 0.5, recoverShare: 0.6, tail: 1 };
  function stressTest(s0, sc = {}) {
    const s = clone(s0), T = { ...STRESS, ...sc }, t0 = s.time, span = T.years * YEAR, end = t0 + span + T.tail * YEAR;
    s.status = 'running'; s.events = []; if (s.life) { s.life.pending = null; s.life.nextAt = Number.MAX_VALUE; }
    const drop = T.invDrop * ((effMods(s) || {}).invDropMul || 1), before = { ...s.balances }, liq0 = s.totals.liquidationLoss;
    const samples = [{ t: 0, income: before.income, consumption: before.consumption, savings: before.savings, investments: before.investments, speculation: before.speculation }];
    s.balances.investments *= 1 - drop; s.balances.speculation *= 1 - T.specDrop;
    s._stress = { from: t0, to: t0 + span, salary: T.salary, jobless: t0 + T.jobless * YEAR, drainMul: T.drainMul || 1 };
    const frames = sc.frames ? [clone(s0), clone(s)] : null;
    const low = { ...s.balances };
    const snap = () => samples.push({ t: s.time - t0, income: s.balances.income, consumption: s.balances.consumption, savings: s.balances.savings, investments: s.balances.investments, speculation: s.balances.speculation });
    snap(); let fail = null, recovered = false, k = 0;
    while (s.time < end - EPS) {
      tick(s);
      if (s.status === 'won') s.status = 'running';
      if (!recovered && s.time + EPS >= t0 + span + 15) { recovered = true; s.balances.investments += s.balances.investments * (1 / (1 - drop) - 1) * T.recoverShare; }
      for (const id of JARS) low[id] = Math.min(low[id], s.balances[id]);
      if (++k % 25 === 0) snap();
      if (frames && k % 10 === 0) frames.push(clone(s));
      if (s.status === 'lost') { fail = { t: s.time - t0, by: s.lostBy || 'money' }; snap(); if (frames) frames.push(clone(s)); break; }
    }
    return { survived: !fail, fail, samples, frames, t0, jobless: T.jobless * YEAR, scenario: T, before, low, after: { ...s.balances }, drop, specDrop: T.specDrop,
      lostCapital: before.investments * drop + before.speculation * T.specDrop, sold: s.totals.liquidationLoss - liq0, span, total: end - t0,
      floatOn: s.pipes.some(p => p.id === 'savings-consumption' && p.connected), floatAvailable: pipeAvailable(s.level, 'savings-consumption') };
  }

  // ---------- «Что если»: replay a life from its seed and action log, optionally changing one decision.
  // Deterministic: the same seed, profession, goal and actions give the same life. After the changed
  // decision the player's own later actions are applied as they were; ones that no longer fit are no-ops.
  const LOGGED = ['togglePipe', 'setValve', 'setSource', 'upgrade', 'setFocus', 'lifeGoalAction', 'lifeChoose'];
  const REPLAY_API = { togglePipe, setValve, setSource, upgrade, setFocus, lifeGoalAction };
  function describePick(s, idx, replace = -1) {
    const P = s && s.life && s.life.pending; if (!P) return null;
    if (P.kind === 'upgrade') return { kind: 'upgrade', up: P.options[idx] || null, rep: replace >= 0 ? s.life.slots[replace] || null : null, options: [...P.options], full: s.life.slots.length >= maxSlots(s) };
    return { kind: 'fork', id: P.id, idx };
  }
  function replayBegin(base, log, alter = null, horizon = 0) {
    const s = create(base.level, base.seed, base.opts || {}); s.status = 'running';
    return { s, log: log || [], alter, horizon, i: 0, k: 0, done: false, ticks: 0 };
  }
  function replayResolve(job, entry) {
    const s = job.s, P = s.life.pending, k = job.k++, last = P.kind === 'fork' ? FORKS[P.id].options.length - 1 : -1;
    const want = job.alter && job.alter.k === k ? job.alter.pick : entry && entry.pick;
    let idx = -1, rep = -1;
    if (want && P.kind === 'upgrade' && want.kind === 'upgrade' && want.up) {
      idx = P.options.indexOf(want.up);
      if (idx >= 0 && s.life.slots.length >= maxSlots(s)) { rep = want.rep ? s.life.slots.indexOf(want.rep) : -1; if (rep < 0) idx = -1; }
    }
    if (want && P.kind === 'fork' && want.kind === 'fork' && want.id === P.id) idx = want.idx;
    let ok = !want || (P.kind === 'upgrade' ? (want.up ? idx >= 0 : true) : want.id === P.id);
    if (P.kind === 'fork' && idx < 0) idx = last;
    let n = lifeChoose(s, idx, rep);
    if (n === s) { n = lifeChoose(s, last, -1); ok = false; }
    if (want && !ok) { if (job.alter && job.alter.k === k) job.altOk = false; else job.subs = (job.subs || 0) + 1; }
    n.status = 'running'; job.s = n;
  }
  function replayRun(job, maxTicks = 2000, onTick = null) {
    let ticks = 0;
    while (!job.done && ticks < maxTicks) {
      const s = job.s, e = job.log[job.i];
      if (s.status === 'won' || s.status === 'lost' || job.altOk === false) { job.done = true; break; }
      if (s.life && s.life.pending) { let entry = null; if (e && e.f === 'lifeChoose') { entry = e; job.i++; } replayResolve(job, entry); continue; }
      // A logged choice waits for its offer: the offer opens inside the next tick without moving time.
      if (e && s.time + EPS >= e.t && (e.f !== 'lifeChoose' || s.time > e.t + 2 * FIXED_DT)) {
        job.i++;
        if (e.f !== 'lifeChoose' && REPLAY_API[e.f]) { const n = REPLAY_API[e.f](s, ...(e.x || []).map(v => v === null ? undefined : v)); if (n !== s) { n.status = 'running'; job.s = n; } else job.dropped = (job.dropped || 0) + 1; }
        continue;
      }
      if (job.horizon && s.time + EPS >= job.horizon) { job.done = true; break; }
      tick(job.s); ticks++; job.ticks++; if (onTick) onTick(job.s);
      if (job.s.status === 'paused' && !(job.s.life && job.s.life.pending)) job.s.status = 'running';
    }
    const f = job.s; // every state in a job is private to it, so ticking in place is safe
    return { done: job.done, altOk: job.altOk !== false, subs: job.subs || 0, dropped: job.dropped || 0, status: f.status, time: f.time, years: Math.floor((f.time + EPS) / YEAR), real: JARS.reduce((a, id) => a + f.balances[id], 0) / priceLevel(f) };
  }

  // ---------- Проверка результата для сайта: сервер переигрывает запись действий и сам считает итог.
  // Цифрам от браузера не доверяем: годы, капитал и исход берутся только из переигрывания.
  // p = { level: 'endless'|'life', seed, opts, log: [{t,f,x,pick?}], claim: { status: 'won'|'lost', time } }
  // Сценарий недели: ключ ISO-недели по местному времени игрока ('2026-W39') и код событий из него.
  function isoWeek(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
    return `${y}-W${String(w).padStart(2, '0')}`;
  }
  function weekSeed(key) {
    let h = 0x811c9dc5;
    for (const c of 'cascade-week-' + key) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h || 1;
  }
  const VERIFY_MAX_TIME = 60 * YEAR;
  function verifyRun(p) {
    const bad = reason => ({ ok: false, reason });
    if (!p || typeof p !== 'object') return bad('no-payload');
    const cfg = LEVELS[p.level];
    if (!cfg || !(cfg.endless || cfg.life)) return bad('level');
    if (!Number.isSafeInteger(p.seed) || p.seed <= 0 || p.seed > 0xffffffff) return bad('seed');
    const claim = p.claim || {};
    if (!['won', 'lost'].includes(claim.status) || !Number.isFinite(claim.time) || claim.time < 0 || claim.time > VERIFY_MAX_TIME) return bad('claim');
    const log = Array.isArray(p.log) ? p.log : [];
    if (log.length > 20000) return bad('log-size');
    let last = -1;
    for (const e of log) {
      if (!e || typeof e !== 'object' || !LOGGED.includes(e.f) || !Number.isFinite(e.t) || e.t < last - EPS || e.t > claim.time + 1) return bad('log-entry');
      if (e.x !== undefined && !Array.isArray(e.x)) return bad('log-entry');
      if (e.f === 'lifeChoose' && !cfg.life) return bad('log-entry');
      last = e.t;
    }
    const opts = cfg.life ? { prof: p.opts && p.opts.prof, goal: p.opts && p.opts.goal, diff: p.opts && p.opts.diff } : {};
    // «Система построена» в Экономическом цикле — решение игрока закончить: доигрываем до его момента.
    const built = cfg.endless && claim.status === 'won';
    const job = replayBegin({ level: p.level, seed: p.seed, opts }, log, null, built ? claim.time : claim.time + 1);
    let peak = 0;
    const track = s => { const r = JARS.reduce((a, id) => a + s.balances[id], 0) / priceLevel(s); if (r > peak) peak = r; };
    track(job.s);
    let res;
    do res = replayRun(job, 50000, track); while (!res.done);
    const f = job.s, m = metrics(f), status = built ? (m.freedom >= 1 - 1e-9 && f.status !== 'lost' ? 'won' : f.status) : f.status;
    const out = { ok: false, status, time: Math.round(f.time * 100) / 100, years: Math.floor((f.time + EPS) / YEAR), real: Math.round(m.realTotal), peak: Math.round(peak),
      freedom: Math.round(m.freedom * 1000) / 1000, dropped: res.dropped, subs: res.subs, engine: VERSION };
    if (p.week != null) { out.week = String(p.week); out.weekOk = cfg.endless && /^\d{4}-W\d{2}$/.test(out.week) && weekSeed(out.week) === p.seed; }
    if (status !== claim.status) return { ...out, reason: 'status-mismatch' };
    if (Math.abs(f.time - claim.time) > 0.25) return { ...out, reason: 'time-mismatch' };
    return { ...out, ok: true };
  }

  return { VERSION, FIXED_DT, verifyRun, isoWeek, weekSeed, MAX_DT, HOLD_SECONDS, JARS: freeze([...JARS]), LEVELS, PIPES, YIELD, SKILL_STEP, FLOAT_SHARE,
    activeJars, availablePipes, levelShocks, upcoming, finishEndless, PROFESSIONS, GOALS, UPGRADES, FORKS, DREAMS, FOCUS, DIFFS, STRESS, stressTest, LIFESTYLE, LS_HOLD, setFocus, lifeChoose, LOGGED, describePick, replayBegin, replayRun, lifeGoalAction, lifeGoalInfo, PHASES, YEAR, create, start: create, play, pause, togglePipe, setValve, setSource, upgrade, step, previewRates, metrics, validateSave };
});
