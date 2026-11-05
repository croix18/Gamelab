import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, buildAll, guard, manifest } from '../tools/build.mjs';
import { loadLab } from './harness.mjs';

test('every built file is up to date with src/', () => {
  for (const { name, html } of buildAll()) {
    assert.equal(readFileSync(join(ROOT, name), 'utf8'), html, `${name} is out of date: run node tools/build.mjs`);
  }
});

test('no built file can reach the network', () => {
  for (const { name, html } of buildAll()) assert.deepEqual(guard(html), [], name);
});

test('the guard catches what it should', () => {
  const bad = [
    '<script src="x.js"></script>', "fetch('/x')", 'new XMLHttpRequest()', 'new WebSocket(u)', 'navigator.sendBeacon(u)',
    'see https://example.com', '<link rel="stylesheet" href="a.css">', 'a { background: url(pic.png) }', '@import "a.css";',
    '<img src="cat.png">', '<iframe src="page.html">', '<form action="/send">', 'import("./x.js")'
  ];
  for (const b of bad) assert.ok(guard(b).length > 0, `missed: ${b}`);
  const ok = [
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'a { background: url(data:image/png;base64,AAAA) }',
    '<img src="data:image/png;base64,AAAA">', 'const x = 1; // fetchy', 'new Worker(URL.createObjectURL(blob))'
  ];
  for (const o of ok) assert.deepEqual(guard(o), [], `false alarm: ${o}`);
});

test('every built file is one page with its title', () => {
  const m = manifest();
  const files = Object.fromEntries(buildAll().map(f => [f.name, f.html]));
  assert.match(files[m.hub.file], /<title>Game Lab<\/title>/);
  assert.match(files[m.hub.file], /\nLab\.start\(\);\n<\/script>/);
  for (const g of m.games) {
    assert.match(files[g.file], new RegExp(`<title>${g.title}</title>`));
    assert.ok(files[g.file].includes(`Lab.start({ single: '${g.id}' });`), `${g.file} opens straight to its game`);
  }
});

test('the hub registers every game in the manifest, in order', () => {
  const { Lab } = loadLab();
  assert.deepEqual(Array.from(Lab._games, g => g.id), manifest().games.map(g => g.id));
  for (const g of Lab._games) {
    for (const k of ['id', 'name', 'modes', 'icon', 'howTo', 'mount']) assert.ok(g[k], `${g.id} is missing ${k}`);
    if (g.modes.includes('daily')) assert.equal(typeof g.dailyDone, 'function', `${g.id} has a Daily but no dailyDone`);
  }
});
