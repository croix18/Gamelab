// Browser check for 2048 (run by tools/check-browser.mjs). Every mode is played with real keys, taps and swipes, and:
// damaged saves open cleanly; two tabs can't undo a Daily's slides, drop its hints or replace its result; Setup applies
// only through Done and keeps one game per Challenge level; two fingers make one slide and no drag scrolls the page;
// the merge equation stays up, beside the board on wide screens; the review shows each costly slide's two boards.
// The Daily card's look-ahead score is checked against the same game worked out in Node.
import { loadEngine } from '../../../tests/harness.mjs';

const E = loadEngine('2048', ['engine.js'], ['lookaheadDaily', 'analyze', 'slide', 'legalDirs', 'DAILY_SLIDES']);
const ARROWS = { left: 'ArrowLeft', up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown' };
const WASD = { left: 'a', up: 'w', right: 'd', down: 's' };
const DIRS = ['left', 'up', 'right', 'down'];
const fmt = n => Number(n).toLocaleString('en-US');

const state = page => page.evaluate(() => {
  const S = Lab._shell.session && Lab._shell.session.state;
  return S && S.game && { slides: S.game.slides, score: S.game.score, end: S.end, hints: S.hints, seed: S.game.seed, moves: S.game.moves, board: Array.from(S.game.board),
    mergeAt: S.game.mergeAt, lastMerge: S.game.lastMerge, daily: S.daily && { seed: S.daily.seed, date: S.daily.date, replay: S.daily.replay } };
});
const botDir = page => page.evaluate(() => { const s = Lab._shell.session; return s.state.end ? null : s.bot(); });
const scrolled = page => page.evaluate(() => scrollY + document.getElementById('app').scrollTop);
const meta = page => page.locator('.t48-meta').textContent();

/** Up to n slides by the look-ahead player, pressed as real keys (arrows and WASD in turn).
 *  With `slip`, every slip-th slide is the worst one instead, so the review has slides to show. */
async function slideKeys(page, n, slip) {
  let made = 0;
  for (let i = 0; i < n; i++) {
    let dir = await botDir(page);
    if (!dir) break;
    if (slip && i % slip === slip - 1) {
      const v = E.analyze((await state(page)).board, 3).values;
      dir = Object.keys(v).filter(d => v[d] !== null).sort((a, b) => v[a] - v[b])[0];
    }
    await page.keyboard.press((i % 3 === 2 ? WASD : ARROWS)[dir]);
    made++;
  }
  return made;
}

/** A real swipe across the board: touch points on touch screens, a mouse drag otherwise. */
async function swipe(page, dir, touch) {
  const box = await page.locator('.t48-board').boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2, d = box.width * 0.3;
  const [dx, dy] = { left: [-d, 0], right: [d, 0], up: [0, -d], down: [0, d] }[dir];
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    const at = f => [{ x: x + dx * f, y: y + dy * f, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
    for (const f of [0.2, 0.45, 0.7, 1]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(f) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (const f of [0.2, 0.45, 0.7, 1]) await page.mouse.move(x + dx * f, y + dy * f);
    await page.mouse.up();
  }
  await page.waitForTimeout(60);
}

/** Two fingers: a second finger lands while the first is swiping. Returns the slides the gesture made. */
async function twoFingers(page, dir) {
  const box = await page.locator('.t48-board').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  const s0 = (await state(page)).slides;
  await touch('touchStart', [[cx, cy]]);
  await touch('touchMove', [[cx + dx * 30, cy + dy * 30]]);
  await touch('touchStart', [[cx + dx * 30, cy + dy * 30], [cx + 25, cy + 25]]);
  await touch('touchMove', [[cx + dx * 60, cy + dy * 60], [cx + 25 + dx * 30, cy + 25 + dy * 30]]);
  await touch('touchMove', [[cx + dx * 90, cy + dy * 90], [cx + 25 + dx * 60, cy + 25 + dy * 60]]);
  await touch('touchEnd', []);
  await cdp.detach();
  await page.waitForTimeout(60);
  return (await state(page)).slides - s0;
}

/** A finger drag the way the browser scrolls one: how far did the page move? */
async function dragScroll(page, sel) {
  const b = await page.locator(sel).boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.synthesizeScrollGesture', { x: b.x + b.width / 2, y: b.y + b.height / 2, yDistance: -200, gestureSourceType: 'touch', speed: 2000 });
  await cdp.detach();
  await page.waitForTimeout(120);
  return scrolled(page);
}

/** Setup: pick chips, then leave by Done, Escape or a tap on the backdrop. */
async function setup(page, picks, close = 'done', shot) {
  await page.locator('#dock .pill', { hasText: 'Setup' }).click();
  for (const [group, value] of picks) await page.locator(`.t48-setup .chip[data-group="${group}"][data-value="${value}"]`).click();
  if (shot) { await page.waitForTimeout(250); await shot(); }
  if (close === 'done') await page.locator('.t48-setup .sheet-foot [data-close]').click();
  else if (close === 'escape') await page.keyboard.press('Escape');
  else { await page.waitForTimeout(500); await page.mouse.click(4, 4); } /* the kit ignores the backdrop for 450 ms */
  await page.waitForTimeout(80);
}

/** Back to the game's front page and into a mode again. */
async function reenter(page, mode) {
  for (let i = 0; i < 3 && await page.locator('.sheet-back').count(); i++) await page.keyboard.press('Escape');
  if (!(await page.locator('.home').count())) await page.locator('#dock .pill').first().click();
  await page.locator('.home').waitFor();
  await page.locator(`.home .modes [data-mode="${mode}"]`).click();
  await page.locator('.t48-board').waitFor();
  await page.waitForTimeout(100);
}

/** Every tile color on one board (numbers or powers), then the real board back. */
async function palette(page, shot, name) {
  await page.evaluate(() => {
    const s = Lab._shell.session;
    window.__real = s.state.game.board;
    s.state.game.board = [1, 2, 3, 4, 8, 7, 6, 5, 9, 10, 11, 12, 0, 1, 2, 0];
    s.redraw();
  });
  await page.waitForTimeout(350);
  await shot(name);
  await page.evaluate(() => { const s = Lab._shell.session; s.state.game.board = window.__real; s.state.analysis = null; s.redraw(); });
}

/** The merge equation: shown after a merge (beside the board on wide screens, about tile size), then dimmed but still up
 *  after a slide that merges nothing. */
async function equation(page, expect, viewport, who) {
  for (let i = 0; i < 60; i++) {
    const s = await state(page);
    if (s.lastMerge && s.mergeAt === s.slides) break;
    await page.keyboard.press(ARROWS[await botDir(page)]);
  }
  await page.waitForTimeout(350);
  expect(await page.locator('.t48-eq .t48-sum').count() === 1 && !(await page.locator('.t48-eq.t48-dim').count()), `${who}: a merge shows as an equation`);
  const eq = await page.locator('.t48-eq .t48-q').first().boundingBox(), board = await page.locator('.t48-board').boundingBox();
  const cell = await page.locator('.t48-cells i').first().boundingBox();
  if (viewport === 'phone') expect(eq.y > board.y + board.height, `${who}: on a phone the equation is under the board`);
  else {
    expect(eq.x > board.x + board.width, `${who}: the equation is beside the board`);
    expect(eq.height >= 0.4 * cell.height, `${who}: the equation is big (${Math.round(eq.height)} px chips, ${Math.round(cell.height)} px tiles)`);
  }
  for (let i = 0; i < 30; i++) {
    const s = await state(page);
    if (s.end) break;
    const quiet = E.legalDirs(s.board).find(d => !E.slide(s.board, d).merges.length);
    await page.keyboard.press(ARROWS[quiet || await botDir(page)]);
    if (quiet) break;
  }
  expect(await page.locator('.t48-eq.t48-dim .t48-sum').count() === 1, `${who}: after a slide with no merge the last merge stays up, dimmed`);
}

/** The review: each costly slide shows two boards and why, with the tiles it names outlined. */
async function review(page, expect, who, final) {
  await page.locator('.t48-review').waitFor();
  await page.locator('.t48-review .t48-wait').waitFor({ state: 'detached', timeout: 8000 });
  const cards = page.locator('.t48-review .t48-cost'), n = await cards.count();
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i), why = await card.locator('.t48-why').textContent();
    expect(await card.locator('.t48-mini').count() === 2, `${who}: a costly slide shows the board after it and after the better slide`);
    if (/ makes | in its corner| into a corner| beside | side by side/.test(why)) expect(await card.locator('.t48-key').count() > 0, `${who}: "${why}" outlines its tiles`);
    if (final && (await card.locator('.label').textContent()) === 'Slide ' + fmt(final)) expect(why === 'This slide ended the game.', `${who}: the last slide says it ended the game (${why})`);
  }
  return n;
}

export default async function check(page, { mode, expect, viewport, shot }) {
  const touch = viewport === 'phone';
  if (mode === 'play') {
    expect(await page.locator('.t48-tiles .t48-tile').count() === 2, '2048 Play: a new game starts with two tiles');
    expect(await slideKeys(page, 12) === 12 && (await state(page)).slides === 12, '2048 Play: twelve slides by arrow keys and WASD');
    await swipe(page, await botDir(page), touch);
    expect((await state(page)).slides === 13, `2048 Play: a ${touch ? 'touch swipe' : 'mouse swipe'} slides the tiles`);
    expect(await scrolled(page) === 0, '2048 Play: a swipe leaves the page where it was');
    if (touch) {
      for (const sel of ['.t48-board', '.t48-head', '.t48-actions']) expect(await dragScroll(page, sel) === 0, `2048 Play: a finger drag on ${sel} leaves the page where it was`);
      let doubles = 0;
      for (const d of ['left', 'right', 'up', 'down', 'left', 'right']) if (await twoFingers(page, d) > 1) doubles++;
      expect(doubles === 0, `2048 Play: two fingers make one slide (${doubles} of 6 made two)`);
    }
    await page.locator('[data-act="hint"]').click();
    expect(await page.locator('.t48-hint').count() === 1, '2048 Play: a hint shows');
    expect(/With hints/.test(await meta(page)), '2048 Play: a hint marks the game');
    await page.keyboard.press('h');
    expect((await state(page)).hints === 1, '2048 Play: asking again on the same board is still one hint');
    await shot('2048-play-hint');
    await equation(page, expect, viewport, '2048 Play');
    await palette(page, shot, '2048-tiles-numbers');

    await page.locator('#dock .pill[aria-label="How to play"]').click();
    await page.waitForTimeout(250);
    await shot('2048-howto');
    await page.keyboard.press('Escape');
    await setup(page, [['kind', 'challenge'], ['level', 'easy'], ['powers', '1']], 'done', () => shot('2048-setup'));
    expect(/Challenge · Easy/.test(await meta(page)), '2048 Play: Setup starts an Easy Challenge');
    expect((await state(page)).slides === 0, '2048 Play: the Challenge is a new game');
    expect(await page.locator('.t48-tile sup').count() === 2, '2048 Play: powers show as 2 with an exponent');
    await shot('2048-challenge');
    await palette(page, shot, '2048-tiles-powers');
    await equation(page, expect, viewport, '2048 Play, powers');
    expect(await page.locator('.t48-eq .t48-prod').count() === 1, '2048 Play: in powers the equation shows the product rule');
    await shot('2048-challenge-equation');
    await slideKeys(page, 120, 5);
    const end = (await state(page)).end;
    expect(['won', 'out', 'over'].includes(end), `2048 Play: the Challenge ends within its 120 slides (${end})`);
    expect(await review(page, expect, '2048 Play') > 0, '2048 Play: the review shows the slides that cost the most');
    expect(await page.locator('.t48-review .r-stat').count() === 2, '2048 Play: the review shows the score and the biggest tile');
    await shot('2048-challenge-review');
    await page.locator('.t48-review [data-keep]').click();
    expect(await page.locator('.t48-actions [data-act="review"]').count() === 1, '2048 Play: the final board stays, with Review');
  } else if (mode === 'daily') {
    const s0 = await state(page), today = s0.daily.date, seed = s0.daily.seed;
    expect(s0.slides === 0 && !s0.daily.replay, '2048 Daily: a fresh Daily');
    /* damaged saves read as absent (or cleaned): the Daily opens, plays and shows no NaN */
    const damaged = [
      ['2048.daily.' + today, { moves: 'lrud' }],
      ['2048.daily.' + today, true],
      ['2048.daily.' + today, { date: today, seed, moves: 'lrud', look: 5 }],
      ['2048.daily.' + today, { date: today, seed, moves: 'lrud', costs: [{ i: 2, c: 30000, b: 'sideways' }] }, 'review'],
      ['2048.dailyrun', { date: today, seed, moves: 'lrudq', pend: [2, 'x'], costs: [{ i: 1, c: 1e5, b: 'nowhere' }], hints: 'lots' }]
    ];
    for (const [key, value, then] of damaged) {
      await page.evaluate(([k, v]) => { Lab.store.set('2048.dailyrun', null); Lab.store.set(k, v); }, [key, value]);
      await reenter(page, 'daily');
      if (then === 'review') { await page.locator('.t48-results [data-review]').click(); await page.waitForTimeout(150); }
      const what = JSON.stringify(value).slice(0, 48);
      expect(!!(await state(page)), `2048 Daily: opens with a damaged save ${what}`);
      expect(!/NaN|undefined/.test(await page.locator('body').innerText()), `2048 Daily: no NaN with a damaged save ${what}`);
    }
    await page.evaluate(d => { Lab.store.set('2048.daily.' + d, null); Lab.store.set('2048.dailyrun', null); }, today);
    await reenter(page, 'daily');
    expect((await state(page)).slides === 0, '2048 Daily: a fresh Daily again');

    /* two tabs on one Daily (Chromebook): no slide undone, no hint dropped, and the first result stands */
    let B = null, ahead = '';
    if (viewport === 'chromebook') {
      await slideKeys(page, 3);
      B = await page.context().newPage();
      await B.goto(page.url());
      if (await B.locator('.gtile[data-game="2048"]').count()) await B.locator('.gtile[data-game="2048"]').click();
      await B.locator('.home .modes [data-mode="daily"]').click();
      await B.locator('.t48-board').waitFor();
      expect((await state(B)).slides === 3, '2048 Daily, two tabs: the second tab opens where the first is');
      await page.keyboard.press('h');
      const hinted = await page.evaluate(() => Lab._shell.session.state.hint.dir);
      await page.keyboard.press(ARROWS[hinted]);
      ahead = (await state(page)).moves;
      await B.waitForTimeout(250); /* switching tabs takes a moment; localStorage reaches the other tab a few ms after a write */
      await B.keyboard.press(ARROWS[DIRS.find(d => d !== hinted)]);
      await B.waitForTimeout(80);
      const b = await state(B), run = await page.evaluate(() => Lab.store.get('2048.dailyrun', null));
      expect(b.moves.startsWith(ahead) && run.moves.startsWith(ahead), `2048 Daily, two tabs: the other tab can't undo a slide (first ${ahead}, other ${b.moves}, saved ${run.moves})`);
      expect(run.hints >= 1 && b.hints >= 1, "2048 Daily, two tabs: a hint can't be dropped");
    }

    await slideKeys(page, E.DAILY_SLIDES);
    const card = page.locator('.sheet.t48-results');
    await card.waitFor();
    await page.waitForFunction(() => { const b = document.querySelector('.t48-results .t48-vs b'); return b && b.textContent !== '…'; }, null, { timeout: 15000 });
    const s1 = await state(page), look = E.lookaheadDaily(seed);
    expect(s1.slides === E.DAILY_SLIDES, `2048 Daily: all ${E.DAILY_SLIDES} slides made (${s1.slides})`);
    expect((await card.locator('.r-stat b').first().textContent()) === fmt(s1.score), '2048 Daily: the card shows the score');
    const vs = await card.locator('.t48-vs').textContent();
    expect(vs.startsWith('Look-ahead player: ' + fmt(look.score)), `2048 Daily: the card reads "Look-ahead player: ${fmt(look.score)}" (${vs})`);
    expect(/Day streak/.test(await card.textContent()), '2048 Daily: the card shows the day streak');
    expect(!/replay/i.test(await card.locator('.r-sub').textContent()), "2048 Daily: today's card isn't a replay");
    expect(await card.locator('.t48-mini > span').count() === 16, '2048 Daily: the card shows the final board');
    await shot('2048-daily-results');
    const stored = await page.evaluate(d => Lab.store.get('2048.daily.' + d, null), today);
    if (B) {
      await B.waitForTimeout(150);
      await B.keyboard.press('ArrowLeft');
      const b = await state(B);
      expect(b.daily.replay && await B.locator('.sheet.t48-results').count() === 1, '2048 Daily, two tabs: once the Daily is finished the other tab shows its result and plays on as a replay');
      const after = await page.evaluate(d => Lab.store.get('2048.daily.' + d, null), today);
      expect(after.moves === stored.moves && stored.moves.startsWith(ahead), `2048 Daily, two tabs: the first finished result stands (${ahead} / ${stored.moves.slice(0, 8)} / ${after.moves.slice(0, 8)})`);
      await B.close();
    }
    await card.locator('[data-review]').click();
    await page.locator('.t48-review .t48-wait').waitFor({ state: 'detached', timeout: 8000 });
    await shot('2048-daily-review');
    await page.locator('.t48-review [data-close]').click();
    await page.locator('.sheet.t48-results [data-again]').click();
    await slideKeys(page, 3);
    const replay = await state(page);
    expect(replay.daily.replay && replay.slides === 3, '2048 Daily: Play again is a replay');
    expect(/Replay/.test(await meta(page)), '2048 Daily: a replay is marked');
    if (viewport === 'chromebook') {
      await slideKeys(page, E.DAILY_SLIDES);
      await page.locator('.sheet.t48-results.replay .r-replay').waitFor();
      await shot('2048-daily-replay-card');
    }
    const kept = await page.evaluate(d => Lab.store.get('2048.daily.' + d, null), today);
    expect(kept.moves === stored.moves && kept.score === s1.score, "2048 Daily: a replay keeps the day's result");
  } else if (mode === 'board') {
    /* Setup applies only through Done, and each Challenge level keeps its own game */
    await setup(page, [['kind', 'challenge'], ['level', 'hard'], ['powers', '0']]);
    expect(/Challenge · Hard/.test(await meta(page)), '2048 Board: Setup starts a Hard Challenge');
    await slideKeys(page, 12);
    const hard = await state(page);
    const same = async what => { const s = await state(page); expect(s.seed === hard.seed && s.slides === hard.slides && /Hard/.test(await meta(page)), `2048 Board: ${what}`); };
    await setup(page, [['level', 'easy']], 'escape');
    await same('Escape cancels Setup');
    await setup(page, [['level', 'easy']], 'backdrop');
    await same('a tap outside Setup cancels it');
    await setup(page, [['level', 'easy']]);
    expect(/Challenge · Easy/.test(await meta(page)) && (await state(page)).seed !== hard.seed, '2048 Board: Done switches to Easy');
    await slideKeys(page, 2);
    await setup(page, [['level', 'hard']]);
    await same('back on Hard, the Hard game is still there');
    await setup(page, [['kind', 'classic']]);
    if (!touch) {
      for (let i = 0; i < 6; i++) await page.locator(`.t48-pad-btn[data-dir="${await botDir(page)}"]`).click();
      await page.keyboard.press('h');
      expect(await page.locator('.t48-pad-btn.t48-pad-hint').count() === 1, '2048 Board: a hint lights its arrow');
    } else {
      for (let i = 0; i < 3; i++) await swipe(page, await botDir(page), true);
      expect(await scrolled(page) === 0, '2048 Board: swipes leave the page where it was');
    }
    await equation(page, expect, viewport, '2048 Board');
    await slideKeys(page, 20);
    await page.waitForTimeout(400);
    await shot('2048-board-game');
    /* to the end, by the worst slides: the review, big enough for the room */
    for (let i = 0; i < 600; i++) {
      const s = await state(page);
      if (s.end) break;
      const v = E.analyze(s.board, 1).values;
      await page.keyboard.press(ARROWS[Object.keys(v).filter(d => v[d] !== null).sort((a, b) => v[a] - v[b])[0]]);
    }
    const final = (await state(page)).slides;
    expect(await review(page, expect, '2048 Board', final) > 0, '2048 Board: the review shows the slides that cost the most');
    if (viewport === 'panel') {
      const small = await page.evaluate(() => Array.from(document.querySelectorAll('.t48-review .label, .t48-review .r-stat span, .t48-review .t48-why, .t48-review figcaption, .t48-review .btn'))
        .map(el => [el.textContent.trim().slice(0, 24), parseFloat(getComputedStyle(el).fontSize)]).filter(([, px]) => px < 24));
      expect(!small.length, `2048 Board: every word in the review is 24 px or more on the panel (${JSON.stringify(small)})`);
    }
    await shot('2048-board-review');
    await page.locator('.t48-review [data-keep]').click();
  }
}
