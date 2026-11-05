import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLab } from './harness.mjs';

test('storage round-trips and falls back for missing keys', () => {
  const { Lab, mem } = loadLab({ games: [] });
  assert.equal(Lab.store.get('nothing', 'fallback'), 'fallback');
  assert.equal(Lab.store.set('k', { a: 1 }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(Lab.store.get('k', null))), { a: 1 });
  assert.ok(mem.has('gamelab.k'), 'keys carry the gamelab. prefix');
});

test('blocked storage never throws: reads fall back, writes report false', () => {
  const { Lab } = loadLab({ storage: 'blocked' });
  assert.equal(Lab.store.get('k', 7), 7);
  assert.equal(Lab.store.set('k', 1), false);
  for (const g of Lab._games) if (g.dailyDone) assert.equal(g.dailyDone('2026-11-04'), false, `${g.id}.dailyDone with storage blocked`);
});

test('a Daily seed is the same on every device and differs by date and game', () => {
  const run = (game, date) => { const r = loadLab({ games: [] }).Lab.dailyRng(game, date); return [r(), r(), r(), r()]; };
  assert.deepEqual(run('make-24', '2026-11-04'), run('make-24', '2026-11-04'));
  assert.notDeepEqual(run('make-24', '2026-11-04'), run('make-24', '2026-11-05'));
  assert.notDeepEqual(run('make-24', '2026-11-04'), run('codebreaker', '2026-11-04'));
});

test('dates read the way they do on screen', () => {
  const { Lab } = loadLab({ games: [] });
  assert.equal(Lab.dateWords('2026-11-04'), 'Wednesday, November 4');
  assert.equal(Lab.clock(65000), '1:05');
  assert.match(Lab.today(), /^\d{4}-\d{2}-\d{2}$/);
});

test('the Daily streak counts days in a row, and weekends never break it', () => {
  const streak = (doneDates, from) => {
    const { Lab } = loadLab({ games: [] });
    const done = new Set(doneDates);
    Lab.register({ id: 'fake', dailyDone: d => done.has(d) });
    return Lab.dailyStreak(from);
  };
  const wed = new Date(2026, 10, 4); // Wednesday 4 Nov 2026
  assert.equal(streak([], wed), 0);
  assert.equal(streak(['2026-11-04', '2026-11-03', '2026-11-02'], wed), 3);
  assert.equal(streak(['2026-11-03', '2026-11-02'], wed), 2, "today not done yet doesn't end the streak");
  assert.equal(streak(['2026-11-04', '2026-11-02'], wed), 1, 'a missed weekday ends it');
  assert.equal(streak(['2026-11-02', '2026-10-30', '2026-10-29'], new Date(2026, 10, 2)), 3, 'Saturday and Sunday are skipped');
  assert.equal(streak(['2026-11-02', '2026-11-01', '2026-10-30'], new Date(2026, 10, 2)), 3, 'a weekend Daily counts');
  const { Lab } = loadLab({ games: [] });
  assert.equal(Lab.dailyStreak(wed), 0, 'no Daily games, no streak');
});
