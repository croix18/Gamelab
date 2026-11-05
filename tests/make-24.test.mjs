import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine, loadLab, dates } from './harness.mjs';

const E = loadEngine('make-24', ['engine.js'], ['parseValue', 'solve', 'generate', 'stepsOf', 'makeCards', 'DECKS', 'LEVELS']);
const { Lab, game } = loadLab({ games: ['make-24'] });
const M24 = game('make-24');
const val = s => { const p = E.parseValue(s); return p && [p.v.n, p.v.d, p.form]; };

test('cards parse to exact values', () => {
  assert.deepEqual(val('3'), [3, 1, 'int']);
  assert.deepEqual(val('-4'), [-4, 1, 'int']);
  assert.deepEqual(val('1/2'), [1, 2, 'frac']);
  assert.deepEqual(val('0.75'), [3, 4, 'dec']);
  assert.deepEqual(val('1 1/2'), [3, 2, 'frac']);
  assert.deepEqual(val('2^3'), [8, 1, 'pow']);
  assert.deepEqual(val('2^-3'), [1, 8, 'pow']);
  assert.deepEqual(val('(1/2)^-2'), [4, 1, 'pow']);
  assert.equal(E.parseValue('1/0'), null);
  assert.equal(E.parseValue('two'), null);
});

test('the solver finds 24 when it is there and only then', () => {
  const run = (hand, kind) => E.solve(E.makeCards(hand), kind);
  assert.ok(run(['1', '2', '3', '4']).count > 0);
  assert.ok(run(['3', '3', '8', '8'], 'rational').count > 0, '8 ÷ (3 − 8 ÷ 3)');
  assert.equal(run(['1', '1', '1', '1']).count, 0);
  const best = run(['6', '2', '3', '2']).solutions[0];
  const steps = E.stepsOf(best.tree);
  const last = steps[steps.length - 1].v;
  assert.deepEqual([last.n, last.d], [24, 1]);
});

test('every number set deals solvable puzzles at every level', () => {
  for (const deck of Object.keys(E.DECKS)) {
    for (const level of [...E.LEVELS, 'mixed']) {
      const rnd = Lab.rng(`test|${deck}|${level}`);
      let onLevel = 0;
      for (let i = 0; i < 10; i++) {
        const p = E.generate(deck, level, null, rnd);
        assert.ok(p && p.result.count > 0, `${deck} ${level} dealt an unsolvable hand`);
        assert.equal(p.cards.length, 4);
        if (E.DECKS[deck].kind !== 'rational') assert.equal(p.result.fractional, false, `${deck} needed a fraction along the way`);
        if (p.level === level) onLevel++;
      }
      if (level !== 'mixed') assert.ok(onLevel >= 8, `${deck} ${level}: only ${onLevel}/10 at the asked level`);
    }
  }
});

test('a year of Dailies: five solvable, different puzzles every day, the same on every device', () => {
  const ORDER = ['classic', 'classic', 'thirteen', 'integers', 'fractions'];
  for (const date of dates('2026-11-01', 366)) {
    const day = M24.daily(date);
    assert.deepEqual(Array.from(day, p => p.deckId), ORDER, date);
    assert.equal(new Set(day.map(p => p.key)).size, 5, `${date}: a puzzle repeats`);
    for (const p of day) {
      assert.ok(p.result.count > 0, `${date}: unsolvable`);
      if (p.kind !== 'rational') assert.equal(p.result.fractional, false, `${date}: a whole-number puzzle needs a fraction`);
    }
  }
  for (const date of ['2026-11-04', '2027-02-14', '2027-06-01']) {
    const other = loadLab({ games: ['make-24'] }).game('make-24');
    assert.deepEqual(Array.from(M24.daily(date), p => p.key), Array.from(other.daily(date), p => p.key), `${date} differs between devices`);
  }
});
