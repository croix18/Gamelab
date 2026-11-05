// Browser check for Make 24 (run by tools/check-browser.mjs): every mode is solved by real taps.

/** Solves the puzzle on screen by tapping tiles and operations along the solver's best path. */
async function solve(page) {
  const steps = await page.evaluate(() => {
    const S = Lab._shell.session.state, out = [];
    (function walk(n) { if (n.leaf === undefined) { walk(n.l); walk(n.r); out.push(n); } })(S.P.result.solutions[0].tree);
    window.__steps = out;
    window.__made = new Map();
    return out.length;
  });
  for (let k = 0; k < steps; k++) {
    const { a, b, op, sel } = await page.evaluate(k => {
      const S = Lab._shell.session.state, st = window.__steps[k];
      const find = n => S.tiles.findIndex(t => (n.leaf !== undefined ? t.node.leaf === n.leaf : t.node === window.__made.get(n)));
      return { a: find(st.l), b: find(st.r), op: st.op, sel: S.sel };
    }, k);
    if (sel !== a) await page.locator('.tiles .tile').nth(a).click();
    await page.locator(`.op[data-op="${op}"]`).click();
    await page.locator('.tiles .tile').nth(b).click();
    await page.evaluate(k => { const S = Lab._shell.session.state; window.__made.set(window.__steps[k], S.tiles[S.fresh].node); }, k);
  }
}

export default async function check(page, { mode, expect }) {
  if (mode === 'play') {
    await page.locator('[data-act="hint"]').click();
    expect(await page.locator('.reveal .row').count() === 1, 'Make 24 Play: a hint shows');
    await solve(page);
    expect(await page.locator('.work .verdict.good').count() === 1, 'Make 24 Play: solved by tapping');
    expect(/Solved 1/.test(await page.locator('.meta').textContent()), 'Make 24 Play: the solved count goes up');
  } else if (mode === 'daily') {
    for (let k = 0; k < 5; k++) {
      await solve(page);
      await page.locator('.actions .next').click();
    }
    const sheet = page.locator('.sheet.results');
    expect(await sheet.count() === 1, 'Make 24 Daily: the results card opens after five puzzles');
    expect(await sheet.locator('.r-squares .r-sq.clean').count() === 5, 'Make 24 Daily: five clean squares');
  } else if (mode === 'board') {
    await page.locator('[data-act="timer"]').click();
    await page.waitForTimeout(1300);
    expect((await page.locator('.clock').textContent()) !== '1:00', 'Make 24 Board: the timer runs');
    await solve(page);
    expect(await page.locator('.work .verdict.good').count() === 1, 'Make 24 Board: solved by tapping');
  }
}
