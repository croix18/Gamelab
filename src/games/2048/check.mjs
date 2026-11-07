// Browser check for 2048 (run by tools/check-browser.mjs): every mode is played with real keys, taps and swipes,
// and the Daily card's look-ahead score is checked against the same game worked out in Node.
import { loadEngine } from '../../../tests/harness.mjs';

const E = loadEngine('2048', ['engine.js'], ['lookaheadDaily', 'analyze', 'DAILY_SLIDES']);
const ARROWS = { left: 'ArrowLeft', up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown' };
const WASD = { left: 'a', up: 'w', right: 'd', down: 's' };
const fmt = n => Number(n).toLocaleString('en-US');

const state = page => page.evaluate(() => {
  const S = Lab._shell.session.state;
  return { slides: S.game.slides, score: S.game.score, end: S.end, hints: S.hints, seed: S.game.seed, board: Array.from(S.game.board), daily: S.daily && { seed: S.daily.seed, date: S.daily.date, replay: S.daily.replay } };
});
const botDir = page => page.evaluate(() => { const s = Lab._shell.session; return s.state.end ? null : s.bot(); });
const scrolled = page => page.evaluate(() => scrollY !== 0 || document.getElementById('app').scrollTop !== 0);

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

async function setup(page, picks, shot) {
  await page.locator('#dock .pill', { hasText: 'Setup' }).click();
  if (shot) { await page.waitForTimeout(250); await shot(); }
  for (const [group, value] of picks) await page.locator(`.t48-setup .chip[data-group="${group}"][data-value="${value}"]`).click();
  await page.locator('.t48-setup [data-close]').click();
  await page.waitForTimeout(80);
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

export default async function check(page, { mode, expect, viewport, shot }) {
  const touch = viewport === 'phone';
  if (mode === 'play') {
    expect(await page.locator('.t48-tiles .t48-tile').count() === 2, '2048 Play: a new game starts with two tiles');
    expect(await slideKeys(page, 12) === 12 && (await state(page)).slides === 12, '2048 Play: twelve slides by arrow keys and WASD');
    const dir = await botDir(page);
    await swipe(page, dir, touch);
    expect((await state(page)).slides === 13, `2048 Play: a ${touch ? 'touch swipe' : 'mouse swipe'} slides the tiles`);
    expect(!(await scrolled(page)), '2048 Play: a swipe leaves the page where it was');
    await page.locator('[data-act="hint"]').click();
    expect(await page.locator('.t48-hint').count() === 1, '2048 Play: a hint shows');
    expect(/With hints/.test(await page.locator('.t48-meta').textContent()), '2048 Play: a hint marks the game');
    await page.keyboard.press('h');
    expect((await state(page)).hints === 1, '2048 Play: asking again on the same board is still one hint');
    await shot('2048-play-hint');
    await palette(page, shot, '2048-tiles-numbers');

    await page.locator('#dock .pill[aria-label="How to play"]').click();
    await page.waitForTimeout(250);
    await shot('2048-howto');
    await page.keyboard.press('Escape');
    await setup(page, [['kind', 'challenge'], ['level', 'easy'], ['powers', '1']], () => shot('2048-setup'));
    expect(/Challenge · Easy/.test(await page.locator('.t48-meta').textContent()), '2048 Play: Setup starts an Easy Challenge');
    expect((await state(page)).slides === 0, '2048 Play: the Challenge is a new game');
    expect(await page.locator('.t48-tile sup').count() === 2, '2048 Play: powers show as 2 with an exponent');
    await shot('2048-challenge');
    await palette(page, shot, '2048-tiles-powers');
    await slideKeys(page, 100, 5);
    const end = (await state(page)).end;
    expect(end === 'won' || end === 'out', `2048 Play: the Challenge ends within 100 slides (${end})`);
    await page.locator('.t48-review').waitFor();
    await page.locator('.t48-review .t48-wait').waitFor({ state: 'detached', timeout: 8000 });
    expect(await page.locator('.t48-review .r-stat').count() === 2, '2048 Play: the review shows the score and the biggest tile');
    await shot('2048-challenge-review');
    await page.locator('.t48-review [data-keep]').click();
    expect(await page.locator('.t48-actions [data-act="review"]').count() === 1, '2048 Play: the final board stays, with Review');
  } else if (mode === 'daily') {
    const s0 = await state(page);
    expect(s0.slides === 0 && !s0.daily.replay, '2048 Daily: a fresh Daily');
    const made = await slideKeys(page, E.DAILY_SLIDES);
    expect(made === E.DAILY_SLIDES, `2048 Daily: all ${E.DAILY_SLIDES} slides made (${made})`);
    const card = page.locator('.sheet.t48-results');
    await card.waitFor();
    await page.waitForFunction(() => { const b = document.querySelector('.t48-results .t48-look b'); return b && b.textContent !== '…'; }, null, { timeout: 15000 });
    const s1 = await state(page);
    const look = E.lookaheadDaily(s0.daily.seed);
    const shown = await card.locator('.r-stat b').allTextContents();
    expect(shown[0] === fmt(s1.score), `2048 Daily: the card shows the score (${shown[0]})`);
    expect(shown[2] === fmt(look.score), `2048 Daily: the look-ahead score matches Node (${shown[2]} vs ${fmt(look.score)})`);
    expect(await card.locator('.t48-mini > span').count() === 16, '2048 Daily: the card shows the final board');
    await shot('2048-daily-results');
    await card.locator('[data-review]').click();
    await page.locator('.t48-review .t48-wait').waitFor({ state: 'detached', timeout: 8000 });
    await shot('2048-daily-review');
    await page.locator('.t48-review [data-close]').click();
    await page.locator('.sheet.t48-results [data-again]').click();
    await slideKeys(page, 3);
    const replay = await state(page);
    const stored = await page.evaluate(d => Lab.store.get('2048.daily.' + d, null), s0.daily.date);
    expect(replay.daily.replay && replay.slides === 3, '2048 Daily: Play again is a replay');
    expect(stored && stored.moves.length === E.DAILY_SLIDES && stored.score === s1.score, "2048 Daily: a replay keeps the day's result");
    expect(/Replay/.test(await page.locator('.t48-meta').textContent()), '2048 Daily: a replay is marked');
  } else if (mode === 'board') {
    await setup(page, [['kind', 'classic'], ['powers', '0']]);
    if (!touch) {
      for (let i = 0; i < 6; i++) await page.locator(`.t48-pad-btn[data-dir="${await botDir(page)}"]`).click();
      expect((await state(page)).slides === 6, '2048 Board: six slides from the arrow pad');
      await page.keyboard.press('h');
      expect(await page.locator('.t48-pad-btn.t48-pad-hint').count() === 1, '2048 Board: a hint lights its arrow');
    } else {
      for (let i = 0; i < 3; i++) await swipe(page, await botDir(page), true);
      expect((await state(page)).slides === 3, '2048 Board: three touch swipes');
      expect(!(await scrolled(page)), '2048 Board: swipes leave the page where it was');
    }
    await slideKeys(page, 30);
    await shot('2048-board-game');
  }
}
