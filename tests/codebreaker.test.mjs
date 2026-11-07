import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine, loadLab, dates } from './harness.mjs';

const NAMES = ['LEVELS', 'LEVEL_IDS', 'allCodes', 'randomCode', 'score', 'filterCodes', 'stillFit', 'provenFacts', 'holds',
  'pickFact', 'factText', 'factSource', 'strongGuess', 'searchGuess', 'OPENERS', 'debrief', 'dailyCode',
  'ladderFor', 'newRound', 'addGuess', 'addHint', 'saveRound', 'loadRound', 'readRun', 'readResult', 'mergeRuns'];
const E = loadEngine('codebreaker', ['engine.js'], NAMES);
const { Lab, game } = loadLab({ games: ['codebreaker'] });
const CB = game('codebreaker');
const A = (x, f) => Array.from(x, f);
const key = c => A(c).join('');
/* Codes written as letters: A circle, B square, C triangle, D diamond, E star, F hexagon, G cross. */
const code = s => A(s, ch => 'ABCDEFG'.indexOf(ch));
const clue = (secret, guess) => A(E.score(code(secret), code(guess)));
const fk = f => f.kind + ':' + f.sym + ':' + f.spot;

/* An independent scorer: take out the exact matches, then pair off what is left one symbol at a time. */
function refScore(secret, guess) {
  let right = 0;
  const s = [], g = [];
  for (let i = 0; i < secret.length; i++) { if (secret[i] === guess[i]) right++; else { s.push(secret[i]); g.push(guess[i]); } }
  let wrong = 0;
  for (const x of g) { const j = s.indexOf(x); if (j >= 0) { wrong++; s.splice(j, 1); } }
  return [right, wrong];
}

test('scoring counts repeats the way the board game does', () => {
  assert.deepEqual(clue('AABB', 'ABBA'), [2, 2]);
  assert.deepEqual(clue('ABCD', 'AABB'), [1, 1]);
  assert.deepEqual(clue('ABCD', 'ABCD'), [4, 0]);
  assert.deepEqual(clue('ABCD', 'DCBA'), [0, 4]);
  assert.deepEqual(clue('ABCD', 'EEEE'), [0, 0]);
  assert.deepEqual(clue('AAAB', 'AAAA'), [3, 0], 'the fourth A has no A left in the code');
  assert.deepEqual(clue('ABBB', 'BAAA'), [0, 2], 'one A and one B, each counted once');
  assert.deepEqual(clue('AABC', 'CAAA'), [1, 2]);
  assert.deepEqual(clue('ABCDE', 'EDCBA'), [1, 4]);
  assert.deepEqual(clue('GGFFE', 'FGGEF'), [1, 4]);
  for (const level of ['easy', 'medium', 'hard']) {
    const rnd = Lab.rng('score|' + level);
    for (let i = 0; i < 20000; i++) {
      const s = A(E.randomCode(level, rnd)), g = A(E.randomCode(level, rnd));
      const c = A(E.score(s, g));
      assert.deepEqual(c, refScore(s, g), `${level}: ${s} / ${g}`);
      assert.deepEqual(A(E.score(g, s)), c, 'the same either way round');
    }
  }
});

test('every code at each level is listed once', () => {
  const want = { easy: [120, 5, false], medium: [1296, 6, true], hard: [16807, 7, true] };
  for (const level of A(E.LEVEL_IDS)) {
    const all = E.allCodes(level), L = E.LEVELS[level], [n, syms, repeats] = want[level];
    assert.equal(all.length, n, level);
    assert.equal(new Set(A(all, key)).size, n, `${level}: a code is listed twice`);
    assert.equal(L.syms, syms);
    for (const c of all) {
      assert.equal(c.length, L.len);
      assert.ok(A(c).every(s => s >= 0 && s < syms));
      if (!repeats) assert.equal(new Set(A(c)).size, c.length, `${level}: ${key(c)} repeats a symbol`);
    }
  }
});

test('filtering keeps exactly the codes that fit every clue', () => {
  for (const level of A(E.LEVEL_IDS)) {
    const rnd = Lab.rng('filter|' + level), all = E.allCodes(level);
    for (let game = 0; game < 20; game++) {
      const secret = A(E.randomCode(level, rnd)), history = [];
      for (let k = 0; k < 1 + game % 3; k++) {
        const guess = A(E.randomCode(level, rnd));
        history.push({ guess, clue: A(E.score(secret, guess)) });
      }
      const kept = A(E.stillFit(level, history), key);
      const brute = A(all).filter(c => history.every(h => String(refScore(A(c), h.guess)) === String(h.clue))).map(key);
      assert.deepEqual(kept, brute, `${level}, game ${game}`);
      assert.ok(kept.includes(secret.join('')), 'the code itself always fits');
    }
  }
});

test('facts read as plain words', () => {
  assert.equal(E.factText({ kind: 'none', sym: 4 }, 'medium'), 'The star isn’t in the code.');
  assert.equal(E.factText({ kind: 'spot', sym: 0, spot: 1 }, 'medium'), 'There’s a circle in spot 2.');
  assert.equal(E.factText({ kind: 'some', sym: 2 }, 'medium'), 'There’s at least one triangle.');
  assert.equal(E.factText({ kind: 'some', sym: 2 }, 'easy'), 'There’s a triangle in the code.');
  assert.equal(E.factText({ kind: 'two', sym: 6 }, 'hard'), 'There are at least two crosses.');
  assert.equal(E.factText({ kind: 'one', sym: 5 }, 'hard'), 'There’s exactly one hexagon.');
  assert.equal(E.factText({ kind: 'notspot', sym: 3, spot: 3 }, 'easy'), 'The diamond isn’t in spot 4.');
});

test('every fact a hint proves is true of the actual code, at every level', t => {
  const tally = {};
  for (const level of A(E.LEVEL_IDS)) {
    const rnd = Lab.rng('facts|' + level), L = E.LEVELS[level];
    tally[level] = 0;
    for (let game = 0; game < (level === 'hard' ? 30 : 150); game++) {
      const secret = A(E.randomCode(level, rnd)), history = [], shown = [];
      let codes = E.allCodes(level);
      for (let k = 0; k < L.guesses; k++) {
        /* a mix of a student's guesses and the strong-guess hint's */
        const guess = rnd() < 0.5 ? A(E.randomCode(level, rnd)) : A(E.strongGuess(codes, level, history).code);
        const c = A(E.score(secret, guess));
        history.push({ guess, clue: c });
        codes = E.filterCodes(codes, guess, c);
        for (const f of E.provenFacts(codes, level)) assert.ok(E.holds(f, secret), `${level} ${secret}: proven fact ${fk(f)} is false`);
        const f = E.pickFact(codes, level, history, shown);
        if (f) {
          assert.ok(E.holds(f, secret), `${level} ${secret}: hint "${E.factText(f, level)}" is false`);
          assert.ok(!shown.some(x => fk(x) === fk(f)), `${level}: a hint repeats a fact`);
          shown.push(f);
          tally[level]++;
        }
        if (c[0] === L.len) break;
      }
    }
  }
  for (const level of Object.keys(tally)) assert.ok(tally[level] > 50, `${level}: only ${tally[level]} facts were hinted`);
  t.diagnostic('facts hinted and checked: ' + Object.entries(tally).map(([l, n]) => l + ' ' + n).join(', '));
});

/** Plays a code by the strong-guess hint, after an optional first guess of the student's own. Returns the guesses used. */
function byHint(level, secret, first) {
  let codes = E.allCodes(level);
  const history = [];
  for (let n = 1; n <= 20; n++) {
    const guess = n === 1 && first ? first : A(E.strongGuess(codes, level, history).code);
    const c = A(E.score(secret, guess));
    history.push({ guess, clue: c });
    if (c[0] === secret.length) return n;
    codes = E.filterCodes(codes, guess, c);
  }
  return Infinity;
}
const stats = list => ({ avg: list.reduce((a, b) => a + b, 0) / list.length, worst: Math.max(...list) });

test('following the strong-guess hint cracks Medium within 8 guesses every time', t => {
  const opener = E.strongGuess(E.allCodes('medium'), 'medium', []);
  assert.equal(opener.worst, 256, 'the opening hint leaves at most 256 codes, the best any first guess can do');
  const every = A(E.allCodes('medium'), c => byHint('medium', A(c)));
  const rnd = Lab.rng('medium|hint');
  const seeded = [];
  for (let i = 0; i < 400; i++) seeded.push(byHint('medium', A(E.randomCode('medium', rnd)), A(E.randomCode('medium', rnd))));
  const a = stats(every), b = stats(seeded);
  assert.ok(a.worst <= 8 && b.worst <= 8, `worst ${a.worst} / ${b.worst}`);
  t.diagnostic(`Medium, all 1,296 codes, hint from the first guess: average ${a.avg.toFixed(2)}, worst ${a.worst}`);
  t.diagnostic(`Medium, 400 seeded games, own first guess then the hint: average ${b.avg.toFixed(2)}, worst ${b.worst}`);
  const easy = stats(A(E.allCodes('easy'), c => byHint('easy', A(c))));
  assert.ok(easy.worst <= 8, `Easy worst ${easy.worst}`);
  const rh = Lab.rng('hard|hint'), hard = [];
  for (let i = 0; i < 30; i++) hard.push(byHint('hard', A(E.randomCode('hard', rh)), A(E.randomCode('hard', rh))));
  const h = stats(hard);
  assert.ok(h.worst <= 10, `Hard worst ${h.worst}`);
  t.diagnostic(`Easy, all 120 codes: average ${easy.avg.toFixed(2)}, worst ${easy.worst}; Hard, 30 seeded games: average ${h.avg.toFixed(2)}, worst ${h.worst}`);
});

test('the debrief counts codes left, finds the best guess and explains a guess that broke a clue', () => {
  const secret = code('ABCD');
  const history = ['AABB', 'AAAA', 'CDAB', 'ABCD'].map(g => ({ guess: code(g), clue: A(E.score(secret, code(g))) }));
  const d = E.debrief('medium', history, true);
  assert.equal(d.total, 1296);
  history.forEach((h, k) => assert.equal(d.rows[k].left, E.stillFit('medium', history.slice(0, k + 1)).length));
  assert.equal(d.rows[0].before, 1296);
  assert.equal(d.rows[3].left, 1);
  assert.equal(d.rows[0].broke, -1);
  assert.equal(d.rows[1].broke, 0, 'AAAA scores 2●0○ against AABB, but the clue was 1●1○');
  assert.deepEqual(A(d.rows[1].would), [2, 0], 'what guess 1 would have shown if AAAA were the code');
  assert.equal(d.rows[3].broke, -1, 'the code itself fits every clue');
  const share = r => (r.before - r.left) / r.before;
  const fair = [0, 1, 2].filter(k => d.rows[k].broke < 0);
  assert.equal(d.best, fair.reduce((b, k) => share(d.rows[k]) > share(d.rows[b]) ? k : b, fair[0]),
    'the best guess ruled out the biggest share, leaving out the winning guess and any guess that broke a clue');
  assert.ok(d.rows[d.best].broke < 0, 'never both the best guess and a broken clue');
  assert.equal(d.settled, d.rows.findIndex(r => r.left === 1));
  /* a guess that rules out the most but breaks a clue is not the best guess */
  const s2 = code('ABCD'), h2 = ['AAAA', 'BBBB', 'ABCD'].map(g => ({ guess: code(g), clue: A(E.score(s2, code(g))) }));
  const d2 = E.debrief('medium', h2, true);
  assert.equal(d2.rows[1].broke, 0);
  assert.equal(d2.best, 0);
  const shown = E.debrief('medium', history.slice(0, 2), false);
  assert.equal(shown.rows.length, 2);
  assert.ok(shown.best >= 0, 'an unsolved round still has a best guess');
});

test('the opening guesses written into the engine are the ones the search finds', () => {
  for (const level of A(E.LEVEL_IDS)) {
    const found = E.searchGuess(E.allCodes(level), level, true);
    assert.deepEqual(A(found.code), A(E.OPENERS[level].code), level);
    assert.equal(found.worst, E.OPENERS[level].worst, level);
  }
});

/* ---------- rounds: hints, saving, two tabs, damaged saves ---------- */
test('hints: before the first guess Hint goes straight to the opening guess, and each guess counts once however many steps it took', () => {
  for (const board of [false, true]) {
    const R = E.newRound('medium', code('ABCD'), board);
    const first = E.addHint(R);
    assert.equal(first.kind, 'guess', 'no count or fact before any clue');
    assert.deepEqual(A(first.guess.code), A(E.OPENERS.medium.code));
    assert.equal(E.addHint(R), null, 'one step before the first guess');
    assert.equal(R.hints, 1);
    E.addGuess(R, code('AABB'));
    assert.deepEqual(A(E.ladderFor(board, 1)), board ? ['fact', 'guess'] : ['count', 'fact', 'guess']);
    const kinds = [];
    for (let t; (t = E.addHint(R));) kinds.push(t.kind);
    assert.deepEqual(kinds, board ? ['fact', 'guess'] : ['count', 'fact', 'guess']);
    assert.equal(R.hints, 2, 'all the steps on guess 2 count as one hint');
    E.addGuess(R, code('CCDD'));
    assert.equal(R.rung, 0, 'a new guess starts the ladder again');
    E.addGuess(R, code('ABCD'));
    assert.ok(R.over && R.solved);
    assert.equal(R.hints, 2, 'guesses with no help add nothing');
    assert.equal(E.addHint(R), null, 'no hints once the round is over');
  }
});

test('a round saved mid-guess comes back with its guesses, its place on the hint ladder and the hints on screen', () => {
  const rnd = Lab.rng('save|round');
  for (const level of A(E.LEVEL_IDS)) {
    for (let i = 0; i < 12; i++) {
      const secret = A(E.randomCode(level, rnd)), R = E.newRound(level, secret, i % 2 === 1);
      for (let k = 0; k < 1 + i % 3 && !R.over; k++) { E.addHint(R); E.addGuess(R, A(E.randomCode(level, rnd))); }
      if (R.over) continue;
      for (let k = 0; k <= i % 3; k++) E.addHint(R);
      const saved = JSON.parse(JSON.stringify(E.saveRound(R)));
      const read = E.readRun(saved, { board: R.board });
      assert.ok(read, `${level}: a saved round reads back`);
      const B = E.loadRound(read, secret, R.board);
      assert.deepEqual(A(B.history, h => key(h.guess) + A(h.clue).join('')), A(R.history, h => key(h.guess) + A(h.clue).join('')));
      assert.equal(B.hints, R.hints);
      assert.equal(B.rung, R.rung);
      assert.equal(B.codes.length, R.codes.length);
      assert.deepEqual(A(B.tips, t => t.kind), A(R.tips, t => t.kind), 'the same hints on screen');
      B.tips.forEach((t, j) => {
        if (t.kind === 'fact') assert.equal(JSON.stringify(t.fact), JSON.stringify(R.tips[j].fact));
        if (t.kind === 'guess') assert.equal(key(t.guess.code), key(R.tips[j].guess.code));
      });
      assert.equal(B.facts.length, R.facts.length, 'facts already shown stay shown');
    }
  }
});

test('two tabs on one Daily: the longer list of guesses and the most hints win, so a second tab cannot launder hints', () => {
  const date = '2026-11-04', secret = A(CB.daily(date)), want = { board: false, level: 'medium', date };
  const save = R => JSON.parse(JSON.stringify(Object.assign(E.saveRound(R), { date, ms: 1000 })));
  /* tab A takes every hint before guessing; tab B, opened earlier, has nothing */
  const tabA = E.newRound('medium', secret, false), tabB = E.newRound('medium', secret, false);
  E.addHint(tabA);
  const merged = E.mergeRuns(E.readRun(save(tabB), want), E.readRun(save(tabA), want));
  assert.equal(merged.hints, 1, "tab A's hint counts in tab B");
  const B = E.loadRound(merged, secret, false);
  E.addGuess(B, secret);
  assert.ok(B.solved && B.hints === 1, 'solving in tab B is solved with hints');
  /* tab A guesses on; tab B catches up to the longer list before its own guess */
  E.addGuess(tabA, code('AABB')); E.addHint(tabA); E.addHint(tabA);
  const m2 = E.mergeRuns(E.readRun(save(tabB), want), E.readRun(save(tabA), want));
  assert.equal(m2.guesses.length, 1);
  assert.equal(m2.rung, 2, "tab A's place on the ladder comes along");
  assert.equal(m2.hints, 2);
  assert.equal(m2.ms, 1000);
  assert.equal(E.mergeRuns(m2, null), m2);
  /* merging either way round agrees */
  const m3 = E.mergeRuns(E.readRun(save(tabA), want), E.readRun(save(tabB), want));
  assert.equal(JSON.stringify([m3.guesses, m3.hints, m3.rung]), JSON.stringify([m2.guesses, m2.hints, m2.rung]));
});

test('a damaged save is dropped, never trusted: results, Daily progress and dailyDone', () => {
  const date = '2026-11-04';
  const good = { date, rows: [[1, 1], [4, 0]], outcome: 'helped', hints: 1, ms: 5000, len: 4, limit: 8 };
  assert.ok(E.readResult(good, date));
  const bad = [
    null, 7, 'x', [], { rows: [[1, 2]], outcome: 'clean' }, { ...good, date: 20261104 }, { ...good, date: '2026-11-03' },
    { ...good, rows: [null, [4, 0]] }, { ...good, rows: [[1, 2], [4, 0, 1]] }, { ...good, rows: [[3, 1], [4, 0]] }, { ...good, rows: [[5, 0]] },
    { ...good, rows: 'abc' }, { ...good, outcome: 'won' }, { ...good, outcome: 'clean' }, { ...good, outcome: 'shown' },
    { ...good, rows: [[1, 1], [2, 0]] }, { ...good, hints: -1 }, { ...good, hints: 9 }, { ...good, hints: 1.5 }, { ...good, ms: 'soon' },
    { ...good, ms: Infinity }, { ...good, rows: new Array(9).fill([0, 0]).concat([[4, 0]]) }
  ];
  for (const b of bad) assert.equal(E.readResult(b, date), null, JSON.stringify(b));
  const run = { level: 'medium', date, guesses: [[0, 0, 1, 1]], hints: 1, rung: 1, tips: [{ kind: 'count' }], facts: [], ms: 100 };
  assert.ok(E.readRun(run, { board: false, level: 'medium', date }));
  const badRuns = [
    { ...run, date: 1 }, { ...run, level: 'impossible' }, { ...run, guesses: [[0, 0, 1]] }, { ...run, guesses: [[0, 0, 1, 9]] },
    { ...run, guesses: [null] }, { ...run, hints: 3 }, { ...run, rung: 2 }, { ...run, tips: [{ kind: 'guess' }] }, { ...run, tips: [] },
    { ...run, facts: [{ kind: 'none', sym: 9 }] }, { ...run, facts: [{ kind: 'spot', sym: 1 }] }, { ...run, facts: 'none' }, { ...run, ms: -5 },
    { ...run, rung: 2, tips: [{ kind: 'count' }, { kind: 'fact', fact: { kind: 'odd', sym: 0 } }] }
  ];
  for (const b of badRuns) assert.equal(E.readRun(b, { board: false, level: 'medium', date }), null, JSON.stringify(b));
  /* the hub's tick for a day is the same check */
  const { game: g, mem } = loadLab({ games: ['codebreaker'] });
  mem.set('gamelab.codebreaker.daily.' + date, JSON.stringify({ rows: [[1, 2]], outcome: 'clean' }));
  assert.equal(g('codebreaker').dailyDone(date), false, 'a damaged result is not a done Daily');
  mem.set('gamelab.codebreaker.daily.' + date, JSON.stringify(good));
  assert.equal(g('codebreaker').dailyDone(date), true);
});

test('a year of Dailies: valid Medium codes, the same on every device, different day to day', () => {
  const days = dates('2026-11-01', 366);
  const codes = days.map(d => key(CB.daily(d)));
  codes.forEach((c, i) => {
    assert.match(c, /^[0-5]{4}$/, `${days[i]}: not a Medium code`);
    for (let j = Math.max(0, i - 30); j < i; j++) assert.notEqual(c, codes[j], `${days[i]} repeats ${days[j]}`);
  });
  assert.ok(new Set(codes).size > 300, 'a year of Dailies uses many different codes');
  /* a fresh device works any day out from scratch, in any order, and gets the same code */
  const other = loadLab({ games: ['codebreaker'] }).game('codebreaker');
  for (const d of ['2027-10-31', '2026-11-04', '2027-02-14', '2027-06-01']) assert.equal(key(other.daily(d)), codes[days.indexOf(d)], `${d} differs between devices`);
  /* a clock set wrong still gets a valid code, the same everywhere */
  for (const d of ['2026-10-15', '2099-01-01']) {
    const c = key(CB.daily(d));
    assert.match(c, /^[0-5]{4}$/);
    assert.equal(key(loadLab({ games: ['codebreaker'] }).game('codebreaker').daily(d)), c);
  }
});

test('every hint answers in under 250 ms on Hard', t => {
  const H = loadEngine('codebreaker', ['engine.js'], NAMES); /* nothing cached yet, the opening guess included */
  const level = 'hard';
  H.allCodes(level); /* the list is made when a round is dealt, not when a hint is asked */
  const positions = [[]];
  for (const first of ['AAAAA', 'AAAAB', 'AABBC', 'AABCD', 'ABCDE', 'ABCDA', 'GGGGG']) {
    for (const secret of ['BCDEF', 'GGGGG', 'FAFAF', 'ABCDE', 'EEDDC']) positions.push([{ guess: code(first), clue: A(H.score(code(secret), code(first))) }]);
  }
  const rnd = Lab.rng('hard|timing');
  for (let i = 0; i < 24; i++) {
    const secret = A(H.randomCode(level, rnd)), history = [];
    for (let k = 0; k < 1 + i % 3; k++) { const g = A(H.randomCode(level, rnd)); history.push({ guess: g, clue: A(H.score(secret, g)) }); }
    positions.push(history);
  }
  let slowest = 0, where = '';
  for (const history of positions) {
    const t0 = performance.now();
    const codes = H.stillFit(level, history); /* hint 1: how many codes fit (the game keeps this list as it goes) */
    const t1 = performance.now();
    H.pickFact(codes, level, history, []); /* hint 2: a fact the clues prove */
    const t2 = performance.now();
    H.strongGuess(codes, level, history); /* hint 3: a strong next guess */
    const t3 = performance.now();
    for (const [ms, rung] of [[t1 - t0, 'count'], [t2 - t1, 'fact'], [t3 - t2, 'strong guess']]) {
      assert.ok(ms < 250, `${rung} took ${ms.toFixed(0)} ms after ${history.map(h => key(h.guess)).join(', ') || 'no guesses'}`);
      if (ms > slowest) { slowest = ms; where = `${rung}, ${codes.length} codes left`; }
    }
  }
  t.diagnostic(`Hard: slowest hint ${slowest.toFixed(1)} ms (${where}) over ${positions.length} positions`);
});
