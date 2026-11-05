#!/usr/bin/env node
// Opens the built files in headless Chrome at Chromebook, panel and phone sizes and plays through them:
// the hub, every game, every mode, and each game's own check (src/games/<id>/check.mjs). Fails on any
// page error, console error, sideways scrolling or failed check. Screenshots go to out/screens/.
//
//   node tools/check-browser.mjs
//
// Uses Playwright, from the project if installed, otherwise from the session's global tools.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, manifest } from './build.mjs';

const VIEWPORTS = {
  chromebook: { width: 1366, height: 768 },
  panel: { width: 1920, height: 1080 },
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true }
};
const SHOTS = join(ROOT, 'out/screens');

async function playwright() {
  try { return await import('playwright'); } catch (e) { /* not installed in the project */ }
  return import(pathToFileURL('/opt/npm-tools/node_modules/playwright/index.mjs').href);
}

const failures = [];
const expect = (ok, what) => { if (!ok) failures.push(what); };

async function gameCheck(id) {
  const path = join(ROOT, 'src/games', id, 'check.mjs');
  return existsSync(path) ? (await import(pathToFileURL(path).href)).default : null;
}

/** Back to the game's front page from wherever a mode left off. */
async function toHome(page) {
  for (let i = 0; i < 3 && await page.locator('.sheet-back').count(); i++) await page.keyboard.press('Escape');
  if (!(await page.locator('.home').count())) await page.locator('#dock .pill').first().click();
  await page.locator('.home').waitFor();
}

async function run(browser, file, vpName, body) {
  const { width, height, isMobile = false, hasTouch = false } = VIEWPORTS[vpName];
  const context = await browser.newContext({ viewport: { width, height }, isMobile, hasTouch, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const where = `${file} @ ${vpName}`;
  page.on('pageerror', e => failures.push(`${where}: page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') failures.push(`${where}: console error: ${m.text()}`); });
  const ctx = {
    viewport: vpName,
    expect: (ok, what) => expect(ok, `${where}: ${what}`),
    shot: name => page.screenshot({ path: join(SHOTS, `${file.replace('.html', '')}-${vpName}-${name}.png`) }),
    noSideScroll: async label => expect(await page.evaluate(() => {
      const app = document.getElementById('app');
      return document.documentElement.scrollWidth <= innerWidth + 1 && app.scrollWidth <= app.clientWidth + 1;
    }), `${where}: ${label} scrolls sideways`)
  };
  try {
    await page.goto(pathToFileURL(join(ROOT, file)).href);
    await page.locator('#app > *').first().waitFor();
    await body(page, ctx);
  } catch (e) {
    failures.push(`${where}: ${e.message.split('\n')[0]}`);
    await ctx.shot('failure').catch(() => {});
  }
  await context.close();
}

async function playModes(page, game, ctx) {
  await ctx.noSideScroll(`${game.id} front page`);
  await ctx.shot(`${game.id}-home`);
  const modes = await page.locator('.home .modes [data-mode]').evaluateAll(els => els.map(e => e.dataset.mode));
  ctx.expect(modes.length > 0, `${game.id} shows no modes`);
  const check = await gameCheck(game.id);
  for (const mode of modes) {
    await page.locator(`.home .modes [data-mode="${mode}"]`).click();
    await page.locator('.mode').waitFor();
    await page.waitForTimeout(120);
    await ctx.noSideScroll(`${game.id} ${mode}`);
    await ctx.shot(`${game.id}-${mode}`);
    if (check) await check(page, { ...ctx, mode, game });
    await ctx.noSideScroll(`${game.id} ${mode} after playing`);
    await ctx.shot(`${game.id}-${mode}-played`);
    await toHome(page);
  }
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const m = manifest();
  const { chromium } = await playwright();
  const browser = await chromium.launch();
  for (const vpName of Object.keys(VIEWPORTS)) {
    await run(browser, m.hub.file, vpName, async (page, ctx) => {
      ctx.expect((await page.locator('.hub-title').textContent()) === 'Game Lab', 'the hub title is missing');
      ctx.expect((await page.locator('.hub-tag').textContent()) === 'Train your brain. Master the game.', 'the tagline is missing');
      await ctx.noSideScroll('hub');
      await ctx.shot('hub');
      for (const game of m.games) {
        await page.locator(`.gtile[data-game="${game.id}"]`).click();
        await playModes(page, game, ctx);
        await page.locator('#dock .pill').first().click(); // All games
        await page.locator('.hub').waitFor();
      }
    });
  }
  for (const game of m.games) {
    await run(browser, game.file, 'chromebook', async (page, ctx) => {
      ctx.expect(await page.locator('.home-title').textContent() === game.title, 'does not open on its own front page');
      ctx.expect(await page.locator('.gtile').count() === 0, 'shows the hub');
      await page.locator('.home .modes [data-mode]').first().click();
      await page.locator('.mode').waitFor();
      await ctx.shot('first-mode');
    });
  }
  await browser.close();
  if (failures.length) {
    console.error(`Browser check: ${failures.length} problem${failures.length === 1 ? '' : 's'}`);
    failures.forEach(f => console.error('  ' + f));
    process.exit(1);
  }
  console.log(`Browser check passed: ${Object.keys(VIEWPORTS).join(', ')}; screenshots in out/screens/`);
}

main();
