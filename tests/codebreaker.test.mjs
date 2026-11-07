import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine, loadLab, dates } from './harness.mjs';

const NAMES = ['LEVELS', 'LEVEL_IDS', 'allCodes', 'randomCode', 'score', 'filterCodes', 'stillFit', 'provenFacts', 'holds',
  'pickFact', 'factText', 'strongGuess', 'debrief', 'dailyCode'];
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

test('the debrief counts codes left, finds the best guess and catches a guess that broke a clue', () => {
  const secret = code('ABCD');
  const history = ['AABB', 'AAAA', 'CDAB', 'ABCD'].map(g => ({ guess: code(g), clue: A(E.score(secret, code(g))) }));
  const d = E.debrief('medium', history, true);
  assert.equal(d.total, 1296);
  history.forEach((h, k) => assert.equal(d.rows[k].left, E.stillFit('medium', history.slice(0, k + 1)).length));
  assert.equal(d.rows[0].before, 1296);
  assert.equal(d.rows[3].left, 1);
  assert.equal(d.rows[0].broke, -1);
  assert.equal(d.rows[1].broke, 0, 'AAAA scores 2●0○ against AABB, but the clue was 1●1○');
  assert.equal(d.rows[3].broke, -1, 'the code itself fits every clue');
  const share = r => (r.before - r.left) / r.before;
  const best = [0, 1, 2].reduce((b, k) => share(d.rows[k]) > share(d.rows[b]) ? k : b, 0);
  assert.equal(d.best, best, 'the best guess is the one that ruled out the biggest share, leaving out the winning guess');
  const shown = E.debrief('medium', history.slice(0, 2), false);
  assert.equal(shown.rows.length, 2);
  assert.ok(shown.best >= 0, 'an unsolved round still has a best guess');
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
