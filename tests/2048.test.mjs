import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine, loadLab, dates } from './harness.mjs';

const NAMES = ['slide', 'legalDirs', 'isOver', 'maxExp', 'newGame', 'makeSlide', 'rebuild', 'tileFor', 'analyze', 'lookMove', 'suggest',
  'lookaheadDaily', 'lookaheadRun', 'buildTables', 'moveRows', 'toRows', 'SCRATCH', 'VALUE', 'DIRS', 'CHALLENGES', 'CHALLENGE_ORDER',
  'DAILY_SLIDES', 'LOOK_DEPTH', 'CAREFUL_DEPTH'];
const engine = () => loadEngine('2048', ['engine.js'], NAMES);
const E = engine();
const G = loadLab({ games: ['2048'] }).game('2048');

/* boards are written as values ('2 2 4 .') and kept as exponents */
const row = s => s.split(' ').map(x => (x === '.' ? 0 : Math.log2(+x)));
const shown = b => Array.from(b, e => (e ? E.VALUE[e] : '.')).join(' ');
const pct = (n, of) => (100 * n / of).toFixed(1) + '%';
const rng = seed => { let a = seed; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/* a line of four cells placed so it slides `dir`: index 0 is the edge the tiles slide toward */
function placed(line, dir) {
  const b = new Array(16).fill(0);
  line.forEach((e, i) => {
    const at = { left: i, right: 3 - i, up: i * 4, down: (3 - i) * 4 }[dir];
    b[at] = e;
  });
  return b;
}
const lineOf = (b, dir) => [0, 1, 2, 3].map(i => b[{ left: i, right: 3 - i, up: i * 4, down: (3 - i) * 4 }[dir]]);

test('slides and merges follow the classic rules, in all four directions', () => {
  const cases = [
    ['2 2 2 2', '4 4 . .', 8],
    ['2 2 4 .', '4 4 . .', 4],
    ['4 . 4 4', '8 4 . .', 8],
    ['4 4 8 .', '8 8 . .', 8],
    ['8 8 8 .', '16 8 . .', 16],
    ['2 . . 2', '4 . . .', 4],
    ['. . . 2', '2 . . .', 0],
    ['2 4 2 4', '2 4 2 4', 0]
  ];
  for (const dir of E.DIRS) {
    for (const [from, to, score] of cases) {
      const r = E.slide(placed(row(from), dir), dir);
      assert.equal(shown(lineOf(r.board, dir)), to, `${from} slid ${dir}`);
      assert.equal(r.score, score, `${from} slid ${dir}: score`);
      assert.equal(r.moved, from !== to, `${from} slid ${dir}: moved`);
    }
  }
});

test('a merged tile never merges twice in one slide', () => {
  assert.equal(shown(E.slide(row('2 2 4 .').concat(new Array(12).fill(0)), 'left').board.slice(0, 4)), '4 4 . .');
  assert.equal(shown(E.slide(row('2 2 2 2').concat(new Array(12).fill(0)), 'left').board.slice(0, 4)), '4 4 . .');
  assert.equal(shown(E.slide(row('4 4 8 .').concat(new Array(12).fill(0)), 'left').board.slice(0, 4)), '8 8 . .');
  assert.equal(shown(E.slide(row('. 4 4 8').concat(new Array(12).fill(0)), 'right').board.slice(0, 4)), '. . 8 8');
});

test('a slide that moves nothing changes nothing and adds no tile', () => {
  const g = E.newGame(7);
  g.board = row('2 4 8 16').concat(new Array(12).fill(0));
  const before = JSON.stringify(g);
  assert.equal(E.makeSlide(g, 'left'), null);
  assert.equal(E.makeSlide(g, 'up'), null);
  assert.equal(JSON.stringify(g), before, 'board, score, slide count and tile count are untouched');
  const r = E.makeSlide(g, 'down');
  assert.ok(r, 'down moves the row');
  assert.equal(Array.from(g.board).filter(Boolean).length, 5, 'a slide that moves adds exactly one tile');
  assert.equal(g.slides, 1);
});

test('the look-ahead player slides by the same rules', () => {
  E.buildTables();
  const r = rng(11);
  for (let n = 0; n < 4000; n++) {
    const b = Array.from({ length: 16 }, () => (r() < 0.35 ? 0 : 1 + Math.floor(r() * (r() < 0.9 ? 6 : 14))));
    const rows = Array.from(E.toRows(b));
    for (let m = 0; m < 4; m++) {
      const moved = E.moveRows(m, rows[0], rows[1], rows[2], rows[3], 0);
      const fast = [];
      for (let i = 0; i < 16; i++) fast.push((E.SCRATCH[i >> 2] >> (4 * (i & 3))) & 15);
      const rule = E.slide(b, E.DIRS[m]);
      assert.deepEqual(fast, Array.from(rule.board), `${shown(b)} slid ${E.DIRS[m]}`);
      assert.equal(moved, rule.moved);
    }
  }
});

test('the game ends exactly when no slide moves anything', () => {
  const stuck = [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1];
  assert.equal(E.isOver(stuck), true);
  assert.equal(E.legalDirs(stuck).length, 0);
  const pairAcross = stuck.slice(); pairAcross[1] = 1;
  const pairDown = stuck.slice(); pairDown[4] = 1;
  const gap = stuck.slice(); gap[10] = 0;
  for (const [b, what] of [[pairAcross, 'two equal tiles side by side'], [pairDown, 'two equal tiles one above the other'], [gap, 'an empty square']]) {
    assert.equal(E.isOver(b), false, what);
  }
  const r = rng(5);
  let over = 0;
  for (let n = 0; n < 5000; n++) {
    const b = Array.from({ length: 16 }, () => (r() < 0.03 ? 0 : 1 + Math.floor(r() * 12)));
    const ends = E.isOver(b);
    if (ends) over++;
    assert.equal(ends, E.legalDirs(b).length === 0, shown(b));
  }
  assert.ok(over > 100, `enough stuck boards were tried (${over})`);
});

test('new tiles: a 2 nine times in ten, on a fair choice of empty square', () => {
  let fours = 0, all = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const g = E.newGame(seed);
    assert.equal(Array.from(g.board).filter(Boolean).length, 2, 'a game starts with two tiles');
    for (let k = 0; k < 50; k++) {
      const t = E.tileFor(new Array(16).fill(0), seed, k);
      if (t.exp === 2) fours++; else assert.equal(t.exp, 1);
      all++;
    }
  }
  assert.ok(fours / all > 0.085 && fours / all < 0.115, `4s: ${pct(fours, all)}`);
  const board = [1, 0, 2, 3, 0, 1, 2, 3, 1, 2, 0, 3, 1, 2, 3, 0], hits = {};
  for (let k = 0; k < 8000; k++) {
    const t = E.tileFor(board, 99, k);
    assert.equal(board[t.at], 0, 'a tile lands on an empty square');
    hits[t.at] = (hits[t.at] || 0) + 1;
  }
  for (const at of [1, 4, 10, 15]) assert.ok(hits[at] > 1800 && hits[at] < 2200, `square ${at}: ${hits[at]} of 8000`);
});

test('the Daily: the same tiles for the same slides, on every device', () => {
  const days = dates('2026-11-01', 366);
  const seeds = new Set();
  for (const date of days) {
    const d = G.daily(date);
    assert.equal(d.slides, 150);
    seeds.add(d.seed);
    assert.equal(Array.from(E.newGame(d.seed).board).filter(Boolean).length, 2);
  }
  assert.equal(seeds.size, days.length, 'every day of the year has its own tiles');
  for (const date of ['2026-11-07', '2027-02-14', '2027-06-01']) {
    const other = loadLab({ games: ['2048'] }).game('2048');
    assert.equal(G.daily(date).seed, other.daily(date).seed, `${date}: the seed differs between devices`);
    /* two devices, the same slides: the same tile after every slide */
    const A = engine(), B = engine(), r = rng(G.daily(date).seed);
    const a = A.newGame(G.daily(date).seed), b = B.newGame(other.daily(date).seed);
    assert.deepEqual(Array.from(a.board), Array.from(b.board));
    for (let i = 0; i < 150 && !A.isOver(a.board); i++) {
      const legal = A.legalDirs(a.board), dir = legal[Math.floor(r() * legal.length)];
      const ra = A.makeSlide(a, dir), rb = B.makeSlide(b, dir);
      assert.deepEqual([ra.tile.at, ra.tile.exp], [rb.tile.at, rb.tile.exp], `${date}: slide ${i + 1}`);
    }
    assert.deepEqual(Array.from(a.board), Array.from(b.board));
    assert.equal(a.score, b.score);
    assert.deepEqual(Array.from(A.rebuild(a.seed, a.moves).board), Array.from(a.board), 'a saved game rebuilds from its slides');
  }
});

test("the Daily card's look-ahead score is the same on every device", t => {
  for (const date of ['2026-11-07', '2026-12-18']) {
    const seed = G.daily(date).seed;
    const fresh = engine().lookaheadDaily(seed);
    /* a device that has already searched other boards (another Daily, some hints) gets the same answer */
    const busy = engine();
    busy.lookaheadDaily(G.daily('2026-11-08').seed);
    for (let s = 1; s <= 5; s++) busy.suggest(busy.newGame(s).board);
    const run = busy.lookaheadRun(seed);
    while (!run.step());
    assert.deepEqual(JSON.parse(JSON.stringify(run.result())), JSON.parse(JSON.stringify(fresh)), date);
    assert.equal(fresh.slides, 150);
    t.diagnostic(`${date}: the look-ahead player scores ${fresh.score} with a ${E.VALUE[fresh.top]} in 150 slides`);
  }
  assert.equal(E.LOOK_DEPTH, 3, 'a fixed depth, never a time limit');
});

test('the look-ahead player is strong: how often it reaches 512, 1024 and 2048', t => {
  const N = 20, reach = { 9: 0, 10: 0, 11: 0 };
  for (let i = 0; i < N; i++) {
    const g = E.newGame((Math.imul(i + 1, 0x9E3779B1) ^ 0x48) >>> 0);
    while (!E.isOver(g.board) && E.maxExp(g.board) < 11) E.makeSlide(g, E.lookMove(g.board));
    for (const e of [9, 10, 11]) if (E.maxExp(g.board) >= e) reach[e]++;
  }
  t.diagnostic(`look-ahead player over ${N} seeded games: 512 in ${pct(reach[9], N)}, 1024 in ${pct(reach[10], N)}, 2048 in ${pct(reach[11], N)}`);
  assert.equal(reach[9], N, 'it always reaches 512');
  assert.ok(reach[10] >= 0.9 * N, '1024 in at least 90%');
  assert.ok(reach[11] >= 0.75 * N, '2048 in at least 75%');
});

test('the Challenge limits are set by simulation: the careful player makes each in at least 95% of games', t => {
  const N = 400, goals = E.CHALLENGE_ORDER.map(l => E.CHALLENGES[l].goal), top = Math.max(...goals);
  const play = depth => {
    const at = {}; /* at[goal]: the slide each game first made that tile (Infinity if never) */
    goals.forEach(e => { at[e] = []; });
    for (let i = 0; i < N; i++) {
      const g = E.newGame((Math.imul(i + 1, 2654435761) ^ 0x2048) >>> 0), got = {};
      while (!E.isOver(g.board) && E.maxExp(g.board) < top) {
        E.makeSlide(g, E.analyze(g.board, depth).best);
        for (const e of goals) if (!(e in got) && E.maxExp(g.board) >= e) got[e] = g.slides;
      }
      for (const e of goals) at[e].push(e in got ? got[e] : Infinity);
    }
    return (e, limit) => at[e].filter(s => s <= limit).length / N;
  };
  const careful = play(E.CAREFUL_DEPTH), quick = play(1);
  const start = { easy: 120, medium: 220, hard: 420 }; /* the brief's starting limits */
  for (const level of E.CHALLENGE_ORDER) {
    const { name, goal, limit } = E.CHALLENGES[level];
    const made = careful(goal, limit);
    t.diagnostic(`${name}: ${E.VALUE[goal]} in ${limit} slides. Careful player (${E.CAREFUL_DEPTH} slides ahead) ${pct(made * N, N)}; ` +
      `one slide ahead ${pct(quick(goal, limit) * N, N)}. At the brief's ${start[level]}: ${pct(careful(goal, start[level]) * N, N)} and ${pct(quick(goal, start[level]) * N, N)}`);
    assert.ok(made >= 0.95, `${name}: the careful player makes it in ${pct(made * N, N)}`);
    assert.ok(careful(goal, limit - 10) < 0.95, `${name}: ${limit - 10} slides would do, so the limit is out of date`);
    assert.equal(limit % 10, 0);
  }
});

test('a hint answers in well under 150 ms', t => {
  const D = engine();
  let ms = performance.now();
  D.buildTables();
  const tables = performance.now() - ms;
  const boards = [];
  for (let s = 1; s <= 4; s++) {
    const g = E.newGame(s * 977 + 3);
    while (!E.isOver(g.board) && g.slides < 700) { boards.push(Array.from(g.board)); E.makeSlide(g, E.lookMove(g.board)); }
  }
  const times = [];
  for (const b of boards) {
    ms = performance.now();
    const h = D.suggest(b);
    times.push(performance.now() - ms);
    assert.ok(h && D.legalDirs(b).includes(h.dir), 'the hint is a slide that moves');
  }
  times.sort((a, b) => a - b);
  const worst = times[times.length - 1];
  t.diagnostic(`hints on ${times.length} boards: median ${times[times.length >> 1].toFixed(2)} ms, slowest ${worst.toFixed(1)} ms (tables built once in ${tables.toFixed(0)} ms)`);
  assert.ok(worst < 150, `slowest hint ${worst.toFixed(1)} ms`);
  assert.equal(D.suggest([1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1]), null, 'no hint once the game is over');
  const onlyUp = [0, 0, 0, 0, 1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2];
  assert.deepEqual(Array.from(D.legalDirs(onlyUp)), ['up']);
  assert.deepEqual([D.suggest(onlyUp).dir, D.suggest(onlyUp).why], ['up', 'only'], 'the only slide that moves, and it says so');
});
