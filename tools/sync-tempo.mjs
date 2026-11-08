#!/usr/bin/env node
// Brings Tempo (chess) in from its own repo, so the Game Lab always carries the latest build instead of a copy
// pasted by hand. One Tempo, not two: fix it in croix18/Tempo, rebuild there, then run this here.
//
//   node tools/sync-tempo.mjs [path-to-tempo-repo]     default: ../tempo
//
// Writes tempo.html (Tempo on its own, for the Google Site) and src/tempo.version (which Tempo commit it is).
// Runs the build's network guard over it. Tempo's one outside link, "Open on Lichess" on a puzzle's card (the
// puzzles come from Lichess's free set), is allowed; anything else fails the sync.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guard, ROOT } from './build.mjs';

const ALLOWED = [/^a web address on line \d+: https:\/\/lichess\.org\/training\//, /^a CSS url\(\) that is not data: /];

/* The guard's url() rule can't read code: Tempo builds its piece images as data: URLs in script ("url(\"' + uri(..."),
   and its SVGs refer to their own gradients and clips (url(#f), url(%23f) inside a data: URL). Those are the only
   non-data url() forms allowed; anything else is a file loaded from somewhere. */
function urlProblems(html) {
  const out = [];
  // \burl( so that a function whose name ends in url, like b64url(bytes), isn't read as CSS
  for (const hit of html.matchAll(/\burl\(\s*(?!["']?data:)([^)]{0,40})/g)) {
    const next = hit[1];
    if (/^#/.test(next) || /^%23/.test(next) || /^["']\s*'\s*\+/.test(next) || /^["']'\s*\+/.test(next)) continue;
    out.push(`a CSS url() that is not data: ${hit[0].slice(0, 60)}`);
  }
  return out;
}

/** What in a Tempo build could reach the network; empty means it's clean. */
export function tempoProblems(html) {
  return guard(html).filter(p => !ALLOWED.some(re => re.test(p))).concat(urlProblems(html));
}

export function syncTempo(repo) {
  const src = join(repo, 'dist', 'Tempo.html');
  if (!existsSync(src)) throw new Error(`no built Tempo at ${src} (run python3 build/build.py in the Tempo repo)`);
  const html = readFileSync(src, 'utf8');
  const problems = tempoProblems(html);
  if (problems.length) throw new Error('tempo.html blocked by the guard:\n  ' + problems.join('\n  '));
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD', { cwd: repo, encoding: 'utf8' }).trim(); } catch (e) { /* not a git checkout */ }
  const version = `${commit} ${new Date().toISOString().slice(0, 10)}\n`;
  writeFileSync(join(ROOT, 'tempo.html'), html);
  writeFileSync(join(ROOT, 'src', 'tempo.version'), version);
  return { bytes: Buffer.byteLength(html), commit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repo = resolve(process.argv[2] || join(ROOT, '..', 'tempo'));
  try {
    const r = syncTempo(repo);
    console.log(`tempo.html ${(r.bytes / 1024).toFixed(1)} KB from Tempo ${r.commit}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
