// Browser check for Codebreaker (run by tools/check-browser.mjs): every mode played with real taps and keys.

/** The round on screen, read the way Make 24's check reads its solution. */
const peek = page => page.evaluate(() => {
  const S = Lab._shell.session.state;
  return { secret: Array.from(S.secret), len: S.L.len, syms: S.L.syms, level: S.levelId, made: S.history.length, left: S.codes.length,
    over: S.over, outcome: S.outcome, hints: S.hints, count: S.count };
});
const text = async loc => ((await loc.textContent()) || '').replace(/\s+/g, ' ').trim();
/** Waits for the motion on screen (a code turning over, a sheet fading in) to finish, so a screenshot shows where it lands. */
const settle = page => page.evaluate(() => Promise.all(document.getAnimations()
  .filter(a => a.effect && a.effect.getComputedTiming().endTime !== Infinity)
  .map(a => a.finished.catch(() => {})))).then(() => {});
/** A guess that can't be the code: the code with its first symbol changed. */
const notIt = s => [(s.secret[0] + 1) % s.syms, ...s.secret.slice(1)];
/** Where row k's first peg sits on screen (row 0 is the code). */
const pegX = (page, k) => page.evaluate(k => document.querySelectorAll('.cb-board .cb-row')[k].querySelector('.cb-peg').getBoundingClientRect().left, k);

export default async function check(page, { mode, expect, shot: rawShot, viewport }) {
  const shot = async name => { await settle(page); await rawShot(name); };
  const press = loc => (viewport === 'phone' ? loc.tap() : loc.click());
  const tapSym = s => press(page.locator(`.cb-keys .cb-key[data-sym="${s}"]`));
  const act = name => press(page.locator(`[data-act="${name}"]`));
  const tapGuess = async code => { for (const s of code) await tapSym(s); await act('check'); };
  const typeCode = async code => { for (const s of code) await page.keyboard.press(String(s + 1)); };
  const doneRows = () => page.locator('.cb-board .cb-done').count();
  const pill = label => press(page.locator('#dock .pill', { hasText: label }));
  const reopen = async m => {
    await press(page.locator('#dock .pill').first());
    await page.locator('.home').waitFor();
    await press(page.locator(`.home .modes [data-mode="${m}"]`));
    await page.locator('.cb-stage').waitFor();
  };
  /** Two quick taps on Check. The second lands where Next code is drawn and must not skip the result and debrief. */
  async function doubleCheck() {
    const b = await page.locator('.cb-actions [data-act="check"]').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
    if (viewport === 'phone') { await page.touchscreen.tap(x, y); await page.touchscreen.tap(x, y); }
    else await page.mouse.dblclick(x, y);
  }

  if (mode === 'play') {
    let s = await peek(page);
    await act('hint');
    expect(await page.locator('.cb-reveal [data-act="use"]').count() === 1, 'Codebreaker Play: before any guess, Hint goes straight to an opening guess');
    expect(await page.locator('[data-act="hint"]').isDisabled(), 'Codebreaker Play: before any guess the ladder is that one step');
    const x0 = await pegX(page, 1);
    await typeCode(notIt(s));
    await page.keyboard.press('Enter');
    expect(await doneRows() === 1, 'Codebreaker Play: a guess typed with the number keys and Enter is checked');
    const x1 = await pegX(page, 1);
    expect(Math.abs(x1 - x0) < 1, `Codebreaker Play: the board stays put on the first Check (moved ${(x1 - x0).toFixed(1)} px)`);
    await tapSym(0);
    await tapSym(1);
    await press(page.locator('.cb-now .cb-slot').first());
    expect(await page.locator('.cb-now .cb-slot').count() === 1, 'Codebreaker Play: tapping a filled spot takes it back');
    await page.keyboard.press('Backspace');
    expect(await page.locator('.cb-now .cb-slot').count() === 0, 'Codebreaker Play: Backspace takes a symbol back');
    for (let i = 0; i < 3; i++) await act('hint');
    expect(await page.locator('.cb-reveal .cb-hint').count() === 3 || viewport === 'phone', 'Codebreaker Play: three hints climb the ladder');
    expect(await page.locator('[data-act="hint"]').isDisabled(), 'Codebreaker Play: the ladder ends after three');
    await shot('codebreaker-play-hints');
    s = await peek(page);
    for (const sym of s.secret) await tapSym(sym);
    await doubleCheck();
    s = await peek(page);
    expect(s.over && s.count === 1, 'Codebreaker Play: a double tap on the winning Check stops at the result');
    expect(s.outcome === 'helped' && s.hints === 2, 'Codebreaker Play: two guesses had help, so two hints, however many steps');
    expect(/Cracked in 2 guesses\s*With 2 hints/i.test(await text(page.locator('.cb-verdict'))), 'Codebreaker Play: the result shows');
    expect(/Solved 1/.test(await text(page.locator('.cb-meta'))), 'Codebreaker Play: the solved count goes up');
    expect(await page.locator('.cb-done .cb-rest b').count() === 2, 'Codebreaker Play: each guess shows the codes left after it');
    expect(await page.locator('.cb-code .cb-shown').count() === s.len, 'Codebreaker Play: the code turns over');
    await shot('codebreaker-play-solved');
    await page.waitForTimeout(550);
    await page.keyboard.press('n');
    s = await peek(page);
    expect(!s.over && s.count === 2 && await doneRows() === 0, 'Codebreaker Play: N deals the next code');
    await typeCode(s.secret);
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    s = await peek(page);
    expect(s.over && s.count === 2, 'Codebreaker Play: holding Enter stops at the result');
    await pill('Setup');
    await press(page.locator('.sheet .chip[data-level="hard"]'));
    await page.keyboard.press('Escape');
    s = await peek(page);
    expect(s.level === 'easy' && s.count === 2 && s.over, 'Codebreaker Play: Escape leaves Setup without changing anything');
    await pill('Setup');
    await press(page.locator('.sheet .chip[data-level="hard"]'));
    expect(/7 × 7 × 7 × 7 × 7 = 16,807/.test(await text(page.locator('.sheet .cb-lv'))), 'Codebreaker Play: Setup shows how the codes are counted');
    await shot('codebreaker-play-setup');
    await press(page.locator('.sheet [data-close]'));
    s = await peek(page);
    expect(s.len === 5 && s.count === 3 && await page.locator('.cb-keys .cb-key').count() === 7, 'Codebreaker Play: New code deals a Hard code with seven symbols');
    await tapGuess([0, 0, 1, 1, 2]);
    expect(await doneRows() === 1, 'Codebreaker Play: a Hard guess is checked');
    await pill('?');
    expect(await page.locator('.sheet.howto .cb-howto-ex').count() === 1, 'Codebreaker: How to play has its worked example');
    await shot('codebreaker-howto');
    await page.keyboard.press('Escape');
  } else if (mode === 'daily') {
    await page.evaluate(() => localStorage.setItem('gamelab.codebreaker.daily.' + Lab.today(), JSON.stringify({ rows: [[1, 2]], outcome: 'clean' })));
    await reopen('daily');
    let s = await peek(page);
    expect(await page.locator('.sheet').count() === 0 && s.made === 0, 'Codebreaker Daily: a damaged saved result is dropped and the Daily opens');
    expect(s.len === 4 && s.syms === 6, 'Codebreaker Daily: a Medium code');
    await act('show');
    expect(await page.locator('.sheet [data-show]').count() === 1, 'Codebreaker Daily: Show me asks before ending the Daily');
    await page.keyboard.press('Escape');
    expect(!(await peek(page)).over, 'Codebreaker Daily: keep playing after saying no');
    await tapGuess(notIt(s));
    await typeCode(s.secret);
    await page.keyboard.press('Enter');
    s = await peek(page);
    expect(s.over && s.outcome === 'clean' && s.made === 2, 'Codebreaker Daily: solved clean in two guesses');
    await page.waitForTimeout(550);
    await act('next');
    const card = page.locator('.sheet.results');
    expect(await card.count() === 1, 'Codebreaker Daily: the results card opens');
    expect(await card.locator('.cb-r-row').count() === 2, 'Codebreaker Daily: one row of clue marks per guess');
    expect(await card.locator('.r-squares .r-sq.clean').count() === 1, 'Codebreaker Daily: marked solved clean');
    await shot('codebreaker-daily-results');
    await press(card.locator('[data-again]'));
    expect(/Replay/.test(await text(page.locator('.cb-meta'))), 'Codebreaker Daily: a replay says so');
    await tapGuess((await peek(page)).secret);
    await page.waitForTimeout(550);
    await act('next');
    expect(await page.locator('.sheet.results .r-replay').count() === 1 && !/replay/i.test(await text(page.locator('.sheet.results .r-sub'))),
      'Codebreaker Daily: the replay card carries the replay badge');
    await page.keyboard.press('Escape');
    await page.locator('.home').waitFor();
    expect(await page.locator('.modes [data-mode="daily"] .done').count() === 1, 'Codebreaker Daily: marked done today');
    await press(page.locator('.home .modes [data-mode="daily"]'));
    expect(await page.locator('.sheet.results .cb-r-row').count() === 2, "Codebreaker Daily: the replay left the day's result alone");
  } else if (mode === 'board') {
    const count = () => text(page.locator('.cb-count-n'));
    expect(await count() === '1,296', 'Codebreaker Board: all 1,296 Medium codes fit before any guess');
    const x0 = await pegX(page, 1);
    await tapGuess([0, 0, 1, 1]);
    const x1 = await pegX(page, 1);
    expect(Math.abs(x1 - x0) < 1, `Codebreaker Board: the board stays put on the first Check (moved ${(x1 - x0).toFixed(1)} px)`);
    let s = await peek(page);
    const left = await count();
    expect(s.left < 1296 && left === s.left.toLocaleString('en-US'), 'Codebreaker Board: a guess shows the count of codes left');
    expect(await text(page.locator('.cb-done .cb-rest b').first()) === left, 'Codebreaker Board: the guess row shows the count too');
    await act('hint');
    expect(await page.locator('.cb-reveal .cb-hint').count() === 1, 'Codebreaker Board: a hint shows');
    await shot('codebreaker-board-guess');
    await reopen('board');
    const back = await peek(page);
    expect(back.made === 1 && back.secret.join() === s.secret.join() && back.count === s.count && back.hints === 1, 'Codebreaker Board: Back, then Board, picks up the same round');
    expect(await page.locator('.cb-reveal .cb-hint').count() === 1, 'Codebreaker Board: the hint on screen comes back too');
    await act('show');
    expect(await page.locator('.sheet [data-show]').count() === 1, 'Codebreaker Board: Show me asks first');
    await page.keyboard.press('Escape');
    expect(!(await peek(page)).over, 'Codebreaker Board: keep playing after saying no');
    await pill('Setup');
    await press(page.locator('.sheet .chip[data-level="hard"]'));
    await page.keyboard.press('Escape');
    s = await peek(page);
    expect(s.level === 'medium' && s.made === 1, 'Codebreaker Board: Escape leaves Setup without changing the round');
    await act('show');
    await press(page.locator('.sheet [data-show]'));
    expect((await peek(page)).over && await page.locator('.cb-code .cb-shown').count() === 4, 'Codebreaker Board: Show me turns the code over');
    expect(await page.locator('.cb-count').isHidden() && await page.locator('.cb-verdict').isVisible(), 'Codebreaker Board: the result takes the place of the count');
  }
  await settle(page);
}
