#!/usr/bin/env node
// Builds the Game Lab from src/: the hub (every game) and one file per game (that game alone).
// Every output is a single self-contained HTML page: the font is embedded and nothing loads from the network.
//
//   node tools/build.mjs          write the files and print their sizes
//   node tools/build.mjs --check  write nothing; fail if a committed file is out of date
//
// Needs nothing but Node.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

// Source files are stored with one trailing newline; the build joins them without it.
const read = path => readFileSync(join(SRC, path), 'utf8').replace(/\n$/, '');

export function manifest() {
  return JSON.parse(readFileSync(join(SRC, 'games.json'), 'utf8'));
}

function fontRule() {
  const b64 = readFileSync(join(SRC, 'kit/dm-sans.woff2')).toString('base64');
  return read('kit/font.css').replace('__DM_SANS_WOFF2__', () => b64);
}

/** One game's script, wrapped so nothing it declares leaks into another game. */
export function gameScript(game) {
  return "(function () {\n'use strict';\n" + game.js.map(f => read(`games/${game.id}/${f}`)).join('\n\n') + '\n\n})();';
}

export function kitScript() {
  return read('kit/kit.js');
}

/** The full page for a set of games. `single` is a game id, or null for the hub. */
export function page(games, { title, single }) {
  const css = [fontRule(), read('kit/kit.css'), ...games.flatMap(g => g.css.map(f => read(`games/${g.id}/${f}`)))].join('\n\n');
  const script = [kitScript(), ...games.map(gameScript)].join('\n\n');
  const start = single ? `Lab.start({ single: '${single}' });` : 'Lab.start();';
  const parts = { TITLE: title, CSS: css, SCRIPT: script, START: start };
  return read('page.html').replace(/\{\{(TITLE|CSS|SCRIPT|START)\}\}/g, (_, k) => parts[k]) + '\n';
}

/** Every output file: [{ name, html }]. */
export function buildAll() {
  const m = manifest();
  return [
    { name: m.hub.file, html: page(m.games, { title: m.hub.title, single: null }) },
    ...m.games.map(g => ({ name: g.file, html: page([g], { title: g.title, single: g.id }) }))
  ];
}

/* ---------- the guard: no file may reach the network ---------- */
const ALLOWED_URLS = ['http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink'];
const RULES = [
  [/https?:\/\/[^\s"'<>)]*/gi, 'a web address'],
  [/\bfetch\s*\(/g, 'fetch()'],
  [/\bXMLHttpRequest\b/g, 'XMLHttpRequest'],
  [/\bWebSocket\b/g, 'WebSocket'],
  [/\bEventSource\b/g, 'EventSource'],
  [/\bsendBeacon\b/g, 'sendBeacon'],
  [/\bimport\s*\(/g, 'a dynamic import'],
  [/<script\b[^>]*\bsrc\s*=/gi, 'an outside script'],
  [/<link\b[^>]*\bhref\s*=/gi, 'a linked file'],
  [/@import\b/gi, 'a CSS @import'],
  [/\burl\(\s*(?!["']?data:)/g, 'a CSS url() that is not data:'],
  [/<(?:iframe|img|audio|video|source|embed|object)\b[^>]*\bsrc\s*=\s*(?!["']?(?:data:|blob:))/gi, 'an element loading an outside file'],
  [/<form\b[^>]*\baction\s*=/gi, 'a form that submits somewhere']
];

/** Returns a list of problems; empty means the file is clean. The embedded font is skipped. */
export function guard(html) {
  const text = html.replace(/data:font\/woff2;base64,[A-Za-z0-9+/=]+/g, 'data:font/woff2;base64,');
  const problems = [];
  for (const [re, what] of RULES) {
    for (const hit of text.matchAll(re)) {
      if (what === 'a web address' && ALLOWED_URLS.includes(hit[0])) continue;
      const line = text.slice(0, hit.index).split('\n').length;
      problems.push(`${what} on line ${line}: ${hit[0].slice(0, 60)}`);
    }
  }
  return problems;
}

function main() {
  const check = process.argv.includes('--check');
  let failed = false;
  for (const { name, html } of buildAll()) {
    const problems = guard(html);
    if (problems.length) {
      failed = true;
      console.error(`${name}: blocked by the guard`);
      problems.forEach(p => console.error('  ' + p));
      continue;
    }
    const path = join(ROOT, name);
    if (check) {
      let current = null;
      try { current = readFileSync(path, 'utf8'); } catch (e) { /* missing */ }
      if (current !== html) { failed = true; console.error(`${name}: out of date (run node tools/build.mjs)`); }
      else console.log(`${name}: up to date`);
    } else {
      writeFileSync(path, html);
      console.log(`${name.padEnd(16)} ${(Buffer.byteLength(html) / 1024).toFixed(1).padStart(7)} KB`);
    }
  }
  if (failed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
