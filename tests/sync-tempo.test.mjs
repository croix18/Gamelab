import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../tools/build.mjs';
import { tempoProblems, offline } from '../tools/sync-tempo.mjs';

test('the synced Tempo reaches nothing but its Lichess credit link', () => {
  const path = join(ROOT, 'tempo.html');
  assert.ok(existsSync(path), 'tempo.html is missing: run node tools/sync-tempo.mjs ../tempo');
  assert.deepEqual(tempoProblems(readFileSync(path, 'utf8')), []);
  assert.match(readFileSync(join(ROOT, 'src/tempo.version'), 'utf8'), /^[0-9a-f]{7,} \d{4}-\d{2}-\d{2}\n$/);
});

test('the Tempo check still catches a real outside file', () => {
  assert.ok(tempoProblems('a { background: url(pic.png) }').length > 0);
  assert.ok(tempoProblems('<script src="x.js"></script>').length > 0);
  assert.ok(tempoProblems('see https://example.com').length > 0);
  // what Tempo does: data: images built in script, and SVGs referring to their own gradients
  assert.deepEqual(tempoProblems(`out += '{background-image:url("' + uri(c, t) + '")}'`), []);
  assert.deepEqual(tempoProblems('<rect fill="url(#f)"/> url(%23f)'), []);
  assert.deepEqual(tempoProblems('var out = unb64url(bytes); b64url(m[2])'), []); // code, not CSS
  assert.deepEqual(tempoProblems("return fetch(siteUrl(parts.shift()), { credentials: 'same-origin' })"), []); // the engine download, inert here
  assert.ok(tempoProblems("return fetch(siteUrl(x))\n<script>window.TEMPO_ENGINE={}</script>").length > 0); // but not with a site engine named
  assert.ok(tempoProblems("return fetch('https://example.com/x')").length > 0);
  assert.deepEqual(tempoProblems('<a href="https://lichess.org/training/abc">Open on Lichess</a>'), []);
});

test('Tempo’s Chess.com download is cut out of the Game Lab’s copy', () => {
  const tempo = "var x = 1;\n  /*net:chesscom*/\n  var ChessCom = { recent: function (n) { return fetch('https://api.chess.com/pub/player/' + n); } };\n  /*net:end*/\nvar y = 2;";
  assert.ok(tempoProblems(tempo).length > 0);            // as Tempo builds it, the guard would block it
  const cut = offline(tempo);
  assert.deepEqual(tempoProblems(cut), []);             // cut out, nothing reaches the network
  assert.match(cut, /var ChessCom = null;/);            // and Tempo sees no Chess.com, so it offers the paste alone
  assert.doesNotMatch(cut, /api\.chess\.com|fetch\(/);
  // the synced copy has no Chess.com code at all
  const synced = readFileSync(join(ROOT, 'tempo.html'), 'utf8');
  assert.doesNotMatch(synced, /api\.chess\.com/);
});
