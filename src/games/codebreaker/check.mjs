// Browser check for Codebreaker (run by tools/check-browser.mjs): every mode played with real taps and keys.

/** The round on screen, read the way Make 24's check reads its solution. */
const peek = page => page.evaluate(() => {
  const S = Lab._shell.session.state;
  return { secret: Array.from(S.secret), len: S.L.len, syms: S.L.syms, made: S.history.length, left: S.codes.length, over: S.over, outcome: S.outcome };
});
const text = async loc => ((await loc.textContent()) || '').replace(/\s+/g, ' ').trim();
/** Waits for the motion on screen (a code turning over, a sheet fading in) to finish, so a screenshot shows where it lands. */
const settle = page => page.evaluate(() => Promise.all(document.getAnimations()
  .filter(a => a.effect && a.effect.getComputedTiming().endTime !== Infinity)
  .map(a => a.finished.catch(() => {})))).then(() => {});
/** A guess that can't be the code: the code with its first symbol changed. */
const notIt = s => [(s.secret[0] + 1) % s.syms, ...s.secret.slice(1)];

export default async function check(page, { mode, expect, shot: rawShot, viewport }) {
  const shot = async name => { await settle(page); await rawShot(name); };
  const press = loc => (viewport === 'phone' ? loc.tap() : loc.click());
  const tapSym = s => press(page.locator(`.cb-keys .cb-key[data-sym="${s}"]`));
  const act = name => press(page.locator(`[data-act="${name}"]`));
  const tapGuess = async code => { for (const s of code) await tapSym(s); await act('check'); };
  const typeGuess = async code => { for (const s of code) await page.keyboard.press(String(s + 1)); await page.keyboard.press('Enter'); };
  const doneRows = () => page.locator('.cb-board .cb-done').count();
  const pill = label => press(page.locator('#dock .pill', { hasText: label }));

  if (mode === 'play') {
    let s = await peek(page);
    await typeGuess(notIt(s));
    expect(await doneRows() === 1, 'Codebreaker Play: a guess typed with the number keys and Enter is checked');
    expect(await page.locator('.cb-done .cb-clue[role="img"]').count() === 1, 'Codebreaker Play: the guess gets its clue');
    await tapSym(0);
    await tapSym(1);
    await press(page.locator('.cb-now .cb-slot').first());
    expect(await page.locator('.cb-now .cb-slot').count() === 1, 'Codebreaker Play: tapping a filled spot takes it back');
    await page.keyboard.press('Backspace');
    expect(await page.locator('.cb-now .cb-slot').count() === 0, 'Codebreaker Play: Backspace takes a symbol back');
    for (let i = 0; i < 3; i++) await act('hint');
    expect(await page.locator('.cb-reveal .cb-hint').count() === 3, 'Codebreaker Play: three hints climb the ladder');
    expect(await page.locator('.cb-reveal [data-act="use"]').count() === 1, 'Codebreaker Play: the last hint offers a guess to use');
    expect(await page.locator('[data-act="hint"]').isDisabled(), 'Codebreaker Play: the ladder ends after three');
    await shot('codebreaker-play-hints');
    s = await peek(page);
    await tapGuess(s.secret);
    s = await peek(page);
    expect(s.over && s.outcome === 'helped', 'Codebreaker Play: solved by tapping symbols, marked solved with hints');
    expect(/Cracked in 2 guesses/.test(await text(page.locator('.cb-verdict'))), 'Codebreaker Play: the verdict shows');
    expect(/Solved 1/.test(await text(page.locator('.cb-meta'))), 'Codebreaker Play: the solved count goes up');
    expect(/Codes left/.test(await text(page.locator('.cb-reveal'))), 'Codebreaker Play: the debrief shows');
    expect(await page.locator('.cb-code .cb-shown').count() === s.len, 'Codebreaker Play: the code turns over');
    await shot('codebreaker-play-solved');
    await page.keyboard.press('n');
    expect(await doneRows() === 0 && !(await peek(page)).over, 'Codebreaker Play: N deals the next code');
    await pill('Setup');
    await press(page.locator('.sheet .chip[data-level="hard"]'));
    await shot('codebreaker-play-setup');
    await press(page.locator('.sheet [data-close]'));
    s = await peek(page);
    expect(s.len === 5 && await page.locator('.cb-keys .cb-key').count() === 7, 'Codebreaker Play: Setup deals a Hard code with seven symbols');
    await tapGuess([0, 0, 1, 1, 2]);
    expect(await doneRows() === 1, 'Codebreaker Play: a Hard guess is checked');
    await pill('?');
    expect(await page.locator('.sheet.howto .cb-howto-ex').count() === 1, 'Codebreaker: How to play has its worked example');
    await shot('codebreaker-howto');
    await page.keyboard.press('Escape');
  } else if (mode === 'daily') {
    let s = await peek(page);
    expect(s.len === 4 && s.syms === 6, 'Codebreaker Daily: a Medium code');
    await act('show');
    expect(await page.locator('.sheet [data-show]').count() === 1, 'Codebreaker Daily: Show me asks before ending the Daily');
    await page.keyboard.press('Escape');
    expect(!(await peek(page)).over, 'Codebreaker Daily: keep playing after saying no');
    await tapGuess(notIt(s));
    await typeGuess(s.secret);
    s = await peek(page);
    expect(s.over && s.outcome === 'clean' && s.made === 2, 'Codebreaker Daily: solved clean in two guesses');
    await act('next');
    const card = page.locator('.sheet.results');
    expect(await card.count() === 1, 'Codebreaker Daily: the results card opens');
    expect(await card.locator('.cb-r-row').count() === 2, 'Codebreaker Daily: one row of clue marks per guess');
    expect(await card.locator('.r-squares .r-sq.clean').count() === 1, 'Codebreaker Daily: marked solved clean');
    await shot('codebreaker-daily-results');
    await press(card.locator('[data-again]'));
    expect(/Replay/.test(await text(page.locator('.cb-meta'))), 'Codebreaker Daily: a replay says so');
    await tapGuess((await peek(page)).secret);
    await act('next');
    expect(/replay/.test(await text(page.locator('.sheet.results .r-sub'))), 'Codebreaker Daily: the replay results say replay');
    await page.keyboard.press('Escape');
    await page.locator('.home').waitFor();
    expect(await page.locator('.modes [data-mode="daily"] .done').count() === 1, 'Codebreaker Daily: marked done today');
    await press(page.locator('.home .modes [data-mode="daily"]'));
    expect(await page.locator('.sheet.results .cb-r-row').count() === 2, "Codebreaker Daily: the replay left the day's result alone");
  } else if (mode === 'board') {
    const count = () => text(page.locator('.cb-count-n'));
    expect(await count() === '1,296', 'Codebreaker Board: all 1,296 Medium codes fit before any guess');
    await tapGuess([0, 0, 1, 1]);
    const s = await peek(page), left = await count();
    expect(s.left < 1296 && left === s.left.toLocaleString('en-US'), 'Codebreaker Board: a guess shows the count of codes left');
    expect(await text(page.locator('.cb-done .cb-rest b').first()) === left, 'Codebreaker Board: the guess row shows the count too');
    await act('hint');
    expect(await page.locator('.cb-reveal .cb-hint').count() === 1, 'Codebreaker Board: a hint shows');
    await shot('codebreaker-board-guess');
    await act('show');
    expect((await peek(page)).over && await page.locator('.cb-code .cb-shown').count() === 4, 'Codebreaker Board: Show me turns the code over');
  }
  await settle(page);
}
