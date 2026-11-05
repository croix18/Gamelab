/* ===== Make 24: solver, rating, decks (no DOM) ===== */
const TARGET = 24;

/* ---- exact fractions ---- */
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }
function F(n, d) { if (d === undefined) d = 1; if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
const fAdd = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const fSub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
const fMul = (a, b) => F(a.n * b.n, a.d * b.d);
const fDiv = (a, b) => F(a.n * b.d, a.d * b.n);
const fEq = (a, b) => a.n === b.n && a.d === b.d;
const fNum = a => a.n / a.d;
const fKey = a => a.d === 1 ? String(a.n) : a.n + '/' + a.d;
const isInt = a => a.d === 1;
function isTerminating(a) { let d = a.d; while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; }
function apply(op, a, b) {
  if (op === '+') return fAdd(a, b);
  if (op === '-') return fSub(a, b);
  if (op === '*') return fMul(a, b);
  if (b.n === 0) return null;
  return fDiv(a, b);
}

/* ---- parse "3", "-4", "1/2", "0.75", "1 1/2" ---- */
function parseValue(str) {
  let s = String(str).trim().replace(/−/g, '-');
  let m;
  /* powers: 2^3, 2^-3, (1/2)^-2, (-2)^3 */
  if ((m = s.match(/^(?:(\d+)|\(\s*(-?\d+(?:\s*\/\s*\d+)?)\s*\))\s*\^\s*\(?\s*(-?\d+)\s*\)?$/))) {
    const bp = parseValue(m[1] !== undefined ? m[1] : m[2]), e = +m[3];
    if (!bp || Math.abs(e) > 6) return null;
    const b = bp.v;
    if (b.n === 0 && e <= 0) return null;
    const f = e < 0 ? F(b.d, b.n) : b;
    let v = F(1);
    for (let i = 0; i < Math.abs(e); i++) v = fMul(v, f);
    if (Math.abs(v.n) > 1e6 || v.d > 1e6) return null;
    return { v, form: 'pow', base: b, exp: e };
  }
  if ((m = s.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/))) {
    if (+m[4] === 0) return null;
    const v = fAdd(F(+m[2]), F(+m[3], +m[4]));
    return { v: m[1] ? F(-v.n, v.d) : v, form: 'frac' };
  }
  if ((m = s.match(/^(-?\d+)\s*\/\s*(\d+)$/))) {
    if (+m[2] === 0) return null;
    const v = F(+m[1], +m[2]);
    return { v, form: isInt(v) ? 'int' : 'frac' };
  }
  if ((m = s.match(/^(-?)(\d*)\.(\d{1,4})$/))) {
    const den = Math.pow(10, m[3].length);
    const v = F((+(m[2] || 0)) * den + (+m[3]), den);
    return { v: m[1] ? F(-v.n, v.d) : v, form: isInt(v) ? 'int' : 'dec' };
  }
  if ((m = s.match(/^-?\d+$/))) return { v: F(+s), form: 'int' };
  return null;
}

/* ---- canonical form: flattens + − and × ÷ chains so reordered answers count once ---- */
function canon(node) {
  if (node.leaf !== undefined) return { t: 'L', v: node.v, leaf: node.leaf, key: fKey(node.v) };
  const hi = (node.op === '+' || node.op === '-');
  const up = [], down = [];
  (function walk(n, sign) {
    const same = n.leaf === undefined && ((n.op === '+' || n.op === '-') === hi);
    if (same) {
      walk(n.l, sign);
      walk(n.r, (n.op === '-' || n.op === '/') ? !sign : sign);
    } else {
      (sign ? up : down).push(canon(n));
    }
  })(node, true);
  const order = (a, b) => (fNum(b.v) - fNum(a.v)) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  up.sort(order); down.sort(order);
  const key = (hi ? 'S(' : 'P(') + up.map(x => x.key).join(',') + '|' + down.map(x => x.key).join(',') + ')';
  return { t: hi ? 'S' : 'P', up, down, v: node.v, key };
}

/* ---- cost of one solution path: how hard is it to see? ---- */
const OP_COST = { '+': 1, '*': 1.2, '-': 1.6, '/': 2.6 };
function costOf(node, kind, isRoot) {
  if (node.leaf !== undefined) return 0;
  let c = costOf(node.l, kind, false) + costOf(node.r, kind, false);
  const one = x => x.n === 1 && x.d === 1;
  const trivial = ((node.op === '*' || node.op === '/') && one(node.r.v)) || (node.op === '*' && one(node.l.v));
  c += trivial ? 0.6 : OP_COST[node.op];
  if (!isRoot) {
    const v = node.v, mag = Math.abs(fNum(v));
    if (!isInt(v)) c += (kind === 'rational') ? 1.8 : 5;
    if (v.n < 0) c += (kind === 'signed') ? 0.8 : 2.5;
    if (v.n === 0) c += 2;
    if (mag > 24) c += 1;
    if (mag > 72) c += 1.5;
  }
  if (isRoot && (node.op === '/' ) && !isInt(node.r.v)) c += 1.5;
  return c;
}

/* ---- solve: every distinct way to reach 24 using each card once ---- */
function solve(cards, kind) {
  kind = kind || 'whole';
  const found = new Map();
  const start = cards.map((c, i) => ({ v: c.v, leaf: i }));
  const OPS = ['+', '*', '-', '/'];
  (function rec(list) {
    if (list.length === 1) {
      const t = list[0];
      if (t.v.n === TARGET && t.v.d === 1) {
        const cf = canon(t), cost = costOf(t, kind, true), prev = found.get(cf.key);
        if (!prev || cost < prev.cost) found.set(cf.key, { cost, tree: t, canon: cf });
      }
      return;
    }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const rest = list.filter((_, k) => k !== i && k !== j);
      const a = list[i], b = list[j];
      for (const op of OPS) {
        const pairs = (op === '+' || op === '*') ? [[a, b]] : [[a, b], [b, a]];
        for (const [l, r] of pairs) {
          const v = apply(op, l.v, r.v);
          if (!v) continue;
          rest.push({ v, op, l, r });
          rec(rest);
          rest.pop();
        }
      }
    }
  })(start);
  const list = Array.from(found.values()).sort((x, y) => x.cost - y.cost);
  if (!list.length) return { count: 0, solutions: [], score: Infinity };
  const score = list[0].cost + 3 / Math.sqrt(list.length);
  const fractional = stepsOf(list[0].tree).slice(0, -1).some(s => !isInt(s.v));
  return { count: list.length, solutions: list, score, fractional };
}

/* ---- steps of a solution in the order you would do them ---- */
function stepsOf(tree) {
  const out = [];
  (function walk(n) {
    if (n.leaf !== undefined) return;
    walk(n.l); walk(n.r);
    out.push({ op: n.op, a: n.l, b: n.r, v: n.v });
  })(tree);
  return out;
}

/* ---- decks ---- */
const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const FRACTIONS = ['1/2', '1/2', '1/2', '1/3', '1/3', '2/3', '2/3', '1/4', '1/4', '3/4', '3/4', '3/2', '3/2', '5/2', '4/3', '1/5', '2/5', '1/6', '1/8', '3/8'];
const DECIMALS = ['0.5', '0.5', '0.5', '1.5', '1.5', '2.5', '2.5', '3.5', '4.5', '0.25', '0.25', '0.75', '0.75', '1.25', '0.2', '0.4', '0.6', '0.8', '1.2', '2.4', '0.1'];

const POWERS = ['2^2', '2^3', '2^3', '2^4', '2^5', '3^2', '3^2', '3^3', '4^2', '5^2', '6^2', '1^6', '7^0', '9^0', '4^0', '3^1', '8^1'];
const NEG_POWERS = ['2^-1', '2^-1', '2^-1', '2^-2', '2^-2', '2^-3', '3^-1', '3^-1', '3^-2', '4^-1', '4^-1', '5^-1', '6^-1', '8^-1', '10^-1',
  '(1/2)^-1', '(1/2)^-2', '(1/2)^-3', '(1/3)^-1', '(1/3)^-2', '(1/4)^-1', '(2/3)^-1'];

const DECKS = {
  classic: {
    name: '1 to 9', blurb: 'Whole numbers 1 through 9', kind: 'whole', cuts: [0, 0],
    deal(rnd) { return [0, 0, 0, 0].map(() => String(pick(range(1, 9), rnd))); }
  },
  thirteen: {
    name: '1 to 13', blurb: 'Whole numbers 1 through 13', kind: 'whole', cuts: [0, 0],
    deal(rnd) { return [0, 0, 0, 0].map(() => String(pick(range(1, 13), rnd))); }
  },
  integers: {
    name: 'Integers', blurb: 'Positive and negative integers', kind: 'signed', cuts: [0, 0],
    deal(rnd) {
      const negs = rnd() < 0.6 ? 1 : 2, hand = [];
      for (let i = 0; i < 4; i++) hand.push(String((i < negs ? -1 : 1) * pick(range(1, 12), rnd)));
      return hand;
    }
  },
  fractions: {
    name: 'Fractions', blurb: 'One or two fraction cards', kind: 'rational', cuts: [0, 0],
    deal(rnd) {
      const k = rnd() < 0.7 ? 1 : 2, hand = [];
      for (let i = 0; i < 4; i++) hand.push(i < k ? pick(FRACTIONS, rnd) : String(pick(range(1, 12), rnd)));
      return hand;
    }
  },
  decimals: {
    name: 'Decimals', blurb: 'One or two decimal cards', kind: 'rational', cuts: [0, 0],
    deal(rnd) {
      const k = rnd() < 0.7 ? 1 : 2, hand = [];
      for (let i = 0; i < 4; i++) hand.push(i < k ? pick(DECIMALS, rnd) : String(pick(range(1, 12), rnd)));
      return hand;
    }
  },
  powers: {
    name: 'Powers', blurb: 'Whole-number exponents, including 0 and 1', kind: 'whole', cuts: [0, 0],
    deal(rnd) {
      const k = rnd() < 0.6 ? 1 : 2, hand = [];
      for (let i = 0; i < 4; i++) hand.push(i < k ? pick(POWERS, rnd) : String(pick(range(1, 12), rnd)));
      return hand;
    }
  },
  negpowers: {
    name: 'Negative powers', blurb: 'Negative exponents, some with fraction bases', kind: 'rational', cuts: [0, 0],
    deal(rnd) {
      const r = rnd(), hand = [pick(NEG_POWERS, rnd)];
      if (r > 0.8) hand.push(pick(POWERS, rnd)); else if (r > 0.55) hand.push(pick(NEG_POWERS, rnd));
      while (hand.length < 4) hand.push(String(pick(range(1, 12), rnd)));
      return hand;
    }
  }
};
/* Score cut-offs between Easy | Medium | Hard, set from 4,000 sampled hands per deck (36% / 36% / 28%). */
Object.assign(DECKS.classic, { cuts: [5.13, 5.92] });
Object.assign(DECKS.thirteen, { cuts: [5.3, 6.6] });
Object.assign(DECKS.integers, { cuts: [5.53, 6.92] });
Object.assign(DECKS.fractions, { cuts: [6.72, 9.02] });
Object.assign(DECKS.decimals, { cuts: [6.53, 8.4] });
Object.assign(DECKS.powers, { cuts: [5.3, 6.6] });
Object.assign(DECKS.negpowers, { cuts: [6, 8.32] });

const LEVELS = ['easy', 'medium', 'hard'];
const LEVEL_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const LEVEL_POINTS = { easy: 1, medium: 2, hard: 3 };

function makeCards(strs) {
  const cards = [];
  for (const s of strs) { const p = parseValue(s); if (!p) return null; cards.push({ v: p.v, form: p.form, text: String(s).trim(), base: p.base, exp: p.exp }); }
  return cards;
}
function shuffle(arr, rnd) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function handKey(cards) { return cards.map(c => fKey(c.v)).sort().join(' '); }
function levelFor(score, deck) { return score <= deck.cuts[0] ? 'easy' : score <= deck.cuts[1] ? 'medium' : 'hard'; }

/* Build one puzzle from a deck at the wanted level ('easy' | 'medium' | 'hard' | 'mixed'). */
function generate(deckId, level, avoid, rnd) {
  rnd = rnd || Math.random;
  const deck = DECKS[deckId];
  const want = level === 'mixed' ? pick(LEVELS, rnd) : level;
  let fallback = null;
  for (let tries = 0; tries < 3000; tries++) {
    const cards = makeCards(shuffle(deck.deal(rnd), rnd));
    const key = handKey(cards);
    if (avoid && avoid.has(key)) continue;
    if (new Set(cards.map(c => fKey(c.v))).size === 1) continue;
    const res = solve(cards, deck.kind);
    if (!res.count) continue;
    if (deck.kind !== 'rational' && res.fractional) continue; /* whole-number decks never need a fraction along the way */
    const lv = levelFor(res.score, deck);
    const puzzle = { deckId, kind: deck.kind, cards, key, level: lv, points: LEVEL_POINTS[lv], result: res };
    if (lv === want) return puzzle;
    if (!fallback) fallback = puzzle;
  }
  return fallback;
}

/* Rate a hand the teacher typed in. */
function customPuzzle(strs) {
  const cards = makeCards(strs);
  if (!cards || cards.length !== 4) return null;
  const hasFrac = cards.some(c => !isInt(c.v)), hasNeg = cards.some(c => c.v.n < 0);
  const kind = hasFrac ? 'rational' : hasNeg ? 'signed' : 'whole';
  const deck = hasFrac ? DECKS.fractions : hasNeg ? DECKS.integers : DECKS.thirteen;
  const res = solve(cards, kind);
  const lv = res.count ? levelFor(res.score, deck) : 'hard';
  return { deckId: 'custom', kind, cards, key: handKey(cards), level: lv, points: LEVEL_POINTS[lv], result: res };
}
