/* ===== Codebreaker: codes, clues, the codes that still fit, hints and the debrief (no DOM) =====
   A code is an array of symbol numbers: 0 circle, 1 square, 2 triangle, 3 diamond, 4 star, 5 hexagon, 6 cross.
   A clue is [right, wrong]: how many are the right symbol in the right spot (●), and how many more are in
   the code but in a different spot (○). Repeats count the way the board game counts them: a symbol scores
   at most as many times as it appears in both the code and the guess. */
const SYMBOLS = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon', 'cross'];
const PLURALS = ['circles', 'squares', 'triangles', 'diamonds', 'stars', 'hexagons', 'crosses'];
const LEVELS = {
  easy: { id: 'easy', name: 'Easy', len: 4, syms: 5, repeats: false, guesses: 8 },
  medium: { id: 'medium', name: 'Medium', len: 4, syms: 6, repeats: true, guesses: 8 },
  hard: { id: 'hard', name: 'Hard', len: 5, syms: 7, repeats: true, guesses: 10 }
};
const LEVEL_IDS = ['easy', 'medium', 'hard'];

/* ---- every code at a level, listed once, in order (cached: callers never change these arrays) ---- */
const codeLists = {};
function allCodes(levelId) {
  if (codeLists[levelId]) return codeLists[levelId];
  const L = LEVELS[levelId], out = [], cur = [];
  (function rec() {
    if (cur.length === L.len) { out.push(cur.slice()); return; }
    for (let s = 0; s < L.syms; s++) {
      if (!L.repeats && cur.indexOf(s) >= 0) continue;
      cur.push(s); rec(); cur.pop();
    }
  })();
  return (codeLists[levelId] = out);
}
function randomCode(levelId, rnd) {
  const L = LEVELS[levelId], pool = [], out = [];
  for (let s = 0; s < L.syms; s++) pool.push(s);
  for (let p = 0; p < L.len; p++) out.push(L.repeats ? Math.floor(rnd() * L.syms) : pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
const sameCode = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const codeKey = c => c.join('');

/* ---- scoring: the same either way round, so "could X be the code?" is score(X, guess) === clue ---- */
const tallyA = new Int32Array(8), tallyB = new Int32Array(8);
function clueKey(code, guess) {
  let right = 0, common = 0;
  tallyA.fill(0); tallyB.fill(0);
  for (let i = 0; i < code.length; i++) {
    const a = code[i], b = guess[i];
    if (a === b) right++;
    tallyA[a]++; tallyB[b]++;
  }
  for (let s = 0; s < 8; s++) common += tallyA[s] < tallyB[s] ? tallyA[s] : tallyB[s];
  return right * 16 + common - right;
}
const keyOf = clue => clue[0] * 16 + clue[1];
function score(code, guess) { const k = clueKey(code, guess); return [k >> 4, k & 15]; }

/* history: [{ guess, clue }] in the order played */
function filterCodes(codes, guess, clue) {
  const want = keyOf(clue);
  return codes.filter(c => clueKey(c, guess) === want);
}
function fitsAll(code, history) { return history.every(h => clueKey(code, h.guess) === keyOf(h.clue)); }
function stillFit(levelId, history) {
  let codes = allCodes(levelId);
  for (const h of history) codes = filterCodes(codes, h.guess, h.clue);
  return codes;
}

/* ---- facts the clues prove: each is true of every code that still fits ----
   spot: a sym in spot · two: at least two syms · one: exactly one sym · some: at least one sym
   none: no sym in the code · notspot: no sym in spot */
const KIND_RANK = { spot: 0, two: 1, one: 2, none: 3, some: 4, notspot: 5 };
const factKey = f => f.kind + ':' + f.sym + (f.spot === undefined ? '' : ':' + f.spot);
function holds(f, code) {
  if (f.kind === 'spot') return code[f.spot] === f.sym;
  if (f.kind === 'notspot') return code[f.spot] !== f.sym;
  let n = 0;
  for (let i = 0; i < code.length; i++) if (code[i] === f.sym) n++;
  return f.kind === 'none' ? n === 0 : f.kind === 'some' ? n >= 1 : f.kind === 'one' ? n === 1 : n >= 2;
}
function provenFacts(codes, levelId) {
  const L = LEVELS[levelId], n = codes.length, out = [];
  if (!n) return out;
  const lo = new Array(L.syms).fill(99), hi = new Array(L.syms).fill(0), at = new Array(L.len * L.syms).fill(0), tally = new Array(L.syms);
  for (const c of codes) {
    tally.fill(0);
    for (let p = 0; p < L.len; p++) { tally[c[p]]++; at[p * L.syms + c[p]]++; }
    for (let s = 0; s < L.syms; s++) { if (tally[s] < lo[s]) lo[s] = tally[s]; if (tally[s] > hi[s]) hi[s] = tally[s]; }
  }
  for (let s = 0; s < L.syms; s++) {
    if (hi[s] === 0) { out.push({ kind: 'none', sym: s }); continue; }
    if (lo[s] >= 2) out.push({ kind: 'two', sym: s });
    else if (lo[s] === 1 && hi[s] === 1 && L.repeats) out.push({ kind: 'one', sym: s });
    else if (lo[s] >= 1) out.push({ kind: 'some', sym: s });
    for (let p = 0; p < L.len; p++) {
      const k = at[p * L.syms + s];
      if (k === n) out.push({ kind: 'spot', sym: s, spot: p });
      else if (k === 0) out.push({ kind: 'notspot', sym: s, spot: p });
    }
  }
  return out;
}
/* How much a fact says: the share of all codes at the level it rules out (the same for every symbol and spot). */
const strengths = {};
function strengthOf(f, levelId) {
  const k = levelId + ':' + f.kind;
  if (strengths[k] === undefined) {
    const all = allCodes(levelId), probe = { kind: f.kind, sym: 0, spot: 0 };
    strengths[k] = all.filter(c => !holds(probe, c)).length / all.length;
  }
  return strengths[k];
}
/* A fact in plain words. name(sym, plural) can dress the symbol's name (the game puts its shape beside it). */
function factText(f, levelId, name) {
  name = name || ((s, many) => (many ? PLURALS : SYMBOLS)[s]);
  if (f.kind === 'spot') return 'There’s a ' + name(f.sym) + ' in spot ' + (f.spot + 1) + '.';
  if (f.kind === 'notspot') return 'The ' + name(f.sym) + ' isn’t in spot ' + (f.spot + 1) + '.';
  if (f.kind === 'none') return 'The ' + name(f.sym) + ' isn’t in the code.';
  if (f.kind === 'two') return 'There are at least two ' + name(f.sym, true) + '.';
  if (f.kind === 'one') return 'There’s exactly one ' + name(f.sym) + '.';
  return LEVELS[levelId].repeats ? 'There’s at least one ' + name(f.sym) + '.' : 'There’s a ' + name(f.sym) + ' in the code.';
}
/* The hint's fact: the strongest one not already shown and not following from what was shown.
   Ties go to a fact that takes two or more clues together to see, the kind a student is likeliest to miss. */
const directMemo = new Map();
function directFacts(levelId, h) {
  const k = levelId + '|' + codeKey(h.guess) + '|' + keyOf(h.clue);
  if (!directMemo.has(k)) {
    if (directMemo.size > 500) directMemo.clear();
    directMemo.set(k, new Set(provenFacts(filterCodes(allCodes(levelId), h.guess, h.clue), levelId).map(factKey)));
  }
  return directMemo.get(k);
}
/* The first guess whose clue alone proves a fact, or -1 when it takes clues together. */
function factSource(f, levelId, history) {
  for (let j = 0; j < history.length; j++) if (directFacts(levelId, history[j]).has(factKey(f))) return j;
  return -1;
}
function pickFact(codes, levelId, history, shown) {
  shown = shown || [];
  const all = allCodes(levelId);
  const shownKeys = new Set(shown.map(factKey));
  const known = shown.length ? all.filter(c => shown.every(f => holds(f, c))) : all;
  const direct = new Set();
  for (const h of history) directFacts(levelId, h).forEach(k => direct.add(k));
  const cands = provenFacts(codes, levelId).filter(f => !shownKeys.has(factKey(f)) && !known.every(c => holds(f, c)));
  cands.sort((a, b) => (strengthOf(b, levelId) - strengthOf(a, levelId)) ||
    (direct.has(factKey(a)) - direct.has(factKey(b))) ||
    (KIND_RANK[a.kind] - KIND_RANK[b.kind]) || ((a.spot || 0) - (b.spot || 0)) || (a.sym - b.sym));
  return cands[0] || null;
}

/* ---- a strong next guess: of the codes that still fit, the one whose worst clue leaves the fewest ----
   It is always a code that could still be the answer, so it never breaks a clue (the debrief's warning).
   Ties go to the smaller average leftover, then to the first in order. Before any guess every code fits and
   only the pattern of a guess matters (two pairs, a triple, ...), so one guess per pattern is tried. Past
   BUDGET score checks (only on Hard, after a guess that rules out little), an even spread of the codes that
   fit stands in for all of them, so a hint never keeps a Chromebook waiting (the tests time every Hard hint). */
const BUDGET = 600000;
function firstOfPattern(c) {
  let top = -1;
  for (let i = 0; i < c.length; i++) { if (c[i] > top + 1) return false; if (c[i] > top) top = c[i]; }
  return true;
}
/* The opening guess never changes, so it is written down here instead of searched for (Hard's search takes about
   200 ms on a slow Chromebook). The tests check these against the search. */
const OPENERS = { easy: { code: [0, 1, 2, 3], worst: 44 }, medium: { code: [0, 0, 1, 1], worst: 256 }, hard: { code: [0, 0, 1, 1, 2], worst: 3012 } };
function strongGuess(codes, levelId, history) {
  const fresh = !history || !history.length;
  if (fresh && codes.length === allCodes(levelId).length) return { code: OPENERS[levelId].code.slice(), worst: OPENERS[levelId].worst };
  return searchGuess(codes, levelId, fresh);
}
function searchGuess(codes, levelId, fresh) {
  const L = LEVELS[levelId], m = codes.length, len = L.len, syms = L.syms;
  if (!m) return null;
  if (m === 1) return { code: codes[0].slice(), worst: 1 };
  const D = new Uint8Array(m * len), C = new Uint8Array(m * syms);
  for (let j = 0; j < m; j++) {
    const c = codes[j];
    for (let p = 0; p < len; p++) { D[j * len + p] = c[p]; C[j * syms + c[p]]++; }
  }
  let cand = [];
  if (fresh && m === allCodes(levelId).length) { for (let j = 0; j < m; j++) if (firstOfPattern(codes[j])) cand.push(j); }
  if (!cand.length) {
    const k = Math.min(m, Math.max(1, Math.floor(BUDGET / m)));
    for (let i = 0; i < k; i++) cand.push(Math.floor(i * m / k));
  }
  const hist = new Int32Array(64), g = new Uint8Array(len), gc = new Uint8Array(syms), gs = new Uint8Array(len);
  let best = -1, bestWorst = Infinity, bestSq = Infinity;
  for (const i of cand) {
    gc.fill(0);
    let nd = 0;
    for (let p = 0; p < len; p++) { const s = D[i * len + p]; g[p] = s; if (gc[s]++ === 0) gs[nd++] = s; }
    hist.fill(0);
    let worst = 0, cut = false;
    for (let j = 0, o = 0, oc = 0; j < m; j++, o += len, oc += syms) {
      let r = 0, t = 0;
      for (let p = 0; p < len; p++) if (D[o + p] === g[p]) r++;
      for (let q = 0; q < nd; q++) { const s = gs[q], x = C[oc + s], y = gc[s]; t += x < y ? x : y; }
      const v = ++hist[r * 8 + t - r];
      if (v > worst) { worst = v; if (worst > bestWorst) { cut = true; break; } }
    }
    if (cut) continue;
    let sq = 0;
    for (let k = 0; k < 64; k++) sq += hist[k] * hist[k];
    if (worst < bestWorst || (worst === bestWorst && sq < bestSq)) { best = i; bestWorst = worst; bestSq = sq; }
  }
  return { code: codes[best].slice(), worst: bestWorst };
}

/* ---- the Daily: one Medium code a day, never one used in the 30 days before ----
   A day's code is the first draw from that day's seed that is not among the previous 30 days' codes, which makes
   the codes a walk from a fixed first day. rngFor(iso) gives that day's seeded random numbers (Lab.dailyRng in the
   game). memo, an array kept between calls, saves walking from the first day every time. */
const DAILY_FROM = '2026-11-01', DAILY_GAP = 30, DAILY_SPAN = 7300;
const dayNumber = iso => { const p = iso.split('-').map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5); };
function isoOfDay(n) {
  const d = new Date(n * 864e5), two = x => String(x).padStart(2, '0');
  return d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate());
}
function dailyCode(date, rngFor, memo) {
  const first = dayNumber(DAILY_FROM), n = dayNumber(date);
  /* a clock set before the Daily began, or decades ahead: that day's own draw, still the same on every device */
  if (!(n >= first) || n - first > DAILY_SPAN) return randomCode('medium', rngFor(date));
  const days = memo || [];
  while (days.length <= n - first) {
    const i = days.length, recent = new Set(days.slice(Math.max(0, i - DAILY_GAP)).map(codeKey));
    const rnd = rngFor(isoOfDay(first + i));
    let c = randomCode('medium', rnd);
    while (recent.has(codeKey(c))) c = randomCode('medium', rnd);
    days.push(c);
  }
  return days[n - first].slice();
}

/* ---- the debrief: codes left after each guess, the guess that cut the biggest share, guesses that couldn't
   have been the code (with the clue each one breaks and what that clue would have been), and the guess after
   which only one code fit ---- */
function debrief(levelId, history, solved) {
  let codes = allCodes(levelId);
  const total = codes.length, rows = [];
  history.forEach((h, k) => {
    let broke = -1, would = null;
    for (let j = 0; j < k && broke < 0; j++) {
      const c = clueKey(h.guess, history[j].guess);
      if (c !== keyOf(history[j].clue)) { broke = j; would = [c >> 4, c & 15]; }
    }
    const before = codes.length;
    codes = filterCodes(codes, h.guess, h.clue);
    rows.push({ before, left: codes.length, broke, would });
  });
  /* The best guess is never the winning guess (cracking the code always rules out the rest) and never a guess
     that couldn't have been the code, so no guess is both praised and corrected. */
  let best = -1, share = 0;
  rows.forEach((r, k) => {
    if ((solved && k === rows.length - 1) || r.broke >= 0) return;
    const s = (r.before - r.left) / r.before;
    if (s > share) { share = s; best = k; }
  });
  const settled = rows.findIndex(r => r.left === 1);
  return { total, rows, best, settled };
}

/* ---- a round as plain data: the code, the guesses, the hints. A Daily or Board round is saved this way and
   picked up again; the game keeps these fields on its own state. ---- */
const LADDER = ['count', 'fact', 'guess'], BOARD_LADDER = ['fact', 'guess'];
/* The hint ladder: how many codes fit, a fact the clues prove, a strong guess. Board always shows the count. Before
   the first guess there is nothing to count or prove, so Hint goes straight to a strong opening guess. */
function ladderFor(board, made) { return !made ? ['guess'] : board ? BOARD_LADDER : LADDER; }
function newRound(levelId, secret, board) {
  const all = allCodes(levelId);
  return { levelId, board: !!board, secret: secret.slice(), history: [], codes: all, counts: [all.length],
    rung: 0, tips: [], facts: [], hints: 0, over: false, solved: false };
}
function addGuess(R, guess) {
  if (R.over) return null;
  const clue = score(R.secret, guess);
  R.history.push({ guess: guess.slice(), clue });
  R.codes = filterCodes(R.codes, guess, clue);
  R.counts.push(R.codes.length);
  R.rung = 0; R.tips = [];
  if (clue[0] === R.secret.length) R.over = R.solved = true;
  else if (R.history.length >= LEVELS[R.levelId].guesses) R.over = true;
  return clue;
}
function tipFor(R, kind, fact) {
  if (kind === 'fact') return { kind, fact: fact !== undefined ? fact : pickFact(R.codes, R.levelId, R.history, R.facts) };
  if (kind === 'guess') return { kind, guess: strongGuess(R.codes, R.levelId, R.history) };
  return { kind };
}
/* One step up the ladder. Help on a guess counts once, however many steps it took: "with 3 hints" means three
   guesses had help. */
function addHint(R) {
  const ladder = ladderFor(R.board, R.history.length);
  if (R.over || R.rung >= ladder.length) return null;
  const tip = tipFor(R, ladder[R.rung]);
  if (tip.fact) R.facts.push(tip.fact);
  if (R.rung === 0) R.hints++;
  R.rung++;
  R.tips.push(tip);
  return tip;
}
/* What a round saves. The rest (the clues, the codes that fit, a strong guess) follows from the code and these. */
function saveRound(R) {
  return { level: R.levelId, guesses: R.history.map(h => h.guess.slice()), hints: R.hints, rung: R.rung,
    tips: R.tips.map(t => (t.kind === 'fact' ? { kind: t.kind, fact: t.fact } : { kind: t.kind })), facts: R.facts.slice() };
}
/* A saved round (already through readRun) played back onto its code. */
function loadRound(saved, secret, board) {
  const R = newRound(saved.level, secret, board);
  for (const g of saved.guesses) { addGuess(R, g); if (R.over) break; }
  R.hints = saved.hints;
  R.facts = saved.facts.slice();
  if (!R.over) { R.rung = saved.rung; R.tips = saved.tips.map(t => tipFor(R, t.kind, t.kind === 'fact' ? t.fact : undefined)); }
  return R;
}

/* ---- reading what was saved: anything that isn't exactly what this game writes comes back null, never throws ---- */
const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const isCode = (c, L) => Array.isArray(c) && c.length === L.len && c.every(s => isInt(s, 0, L.syms - 1));
/* a clue that can happen: counts that fit the code's length, and never all but one right with one in the wrong spot */
const isClue = (c, L) => Array.isArray(c) && c.length === 2 && isInt(c[0], 0, L.len) && isInt(c[1], 0, L.len) &&
  c[0] + c[1] <= L.len && !(c[0] === L.len - 1 && c[1] === 1);
function readFact(f, L) {
  if (!f || typeof f !== 'object' || !(f.kind in KIND_RANK) || !isInt(f.sym, 0, L.syms - 1)) return null;
  const spotted = f.kind === 'spot' || f.kind === 'notspot';
  if (spotted ? !isInt(f.spot, 0, L.len - 1) : f.spot !== undefined) return null;
  return spotted ? { kind: f.kind, sym: f.sym, spot: f.spot } : { kind: f.kind, sym: f.sym };
}
const isPlain = x => !!x && typeof x === 'object' && !Array.isArray(x);
/* A saved round: want = { board, level?, date? }. Daily progress carries its date and time on screen (ms). */
function readRun(raw, want) {
  try {
    if (!isPlain(raw) || !(raw.level in LEVELS) || (want.level && raw.level !== want.level)) return null;
    if (want.date !== undefined && raw.date !== want.date) return null;
    const L = LEVELS[raw.level], made = Array.isArray(raw.guesses) ? raw.guesses.length : -1;
    if (made < 0 || made > L.guesses || !raw.guesses.every(g => isCode(g, L))) return null;
    const ladder = ladderFor(want.board, made);
    if (!isInt(raw.hints, 0, made + 1) || !isInt(raw.rung, 0, ladder.length) || (raw.rung > 0 && raw.hints < 1)) return null;
    if (!Array.isArray(raw.tips) || raw.tips.length !== raw.rung || !Array.isArray(raw.facts) || raw.facts.length > 64) return null;
    const tips = [];
    for (let i = 0; i < raw.rung; i++) {
      const t = raw.tips[i];
      if (!isPlain(t) || t.kind !== ladder[i]) return null;
      if (t.kind !== 'fact') { tips.push({ kind: t.kind }); continue; }
      const fact = t.fact === null ? null : readFact(t.fact, L);
      if (fact === null && t.fact !== null) return null;
      tips.push({ kind: 'fact', fact });
    }
    const facts = raw.facts.map(f => readFact(f, L));
    if (facts.some(f => !f)) return null;
    const ms = raw.ms === undefined ? 0 : raw.ms;
    if (typeof ms !== 'number' || !(ms >= 0 && ms < 864e5)) return null;
    const out = { level: raw.level, guesses: raw.guesses.map(g => g.slice()), hints: raw.hints, rung: raw.rung, tips, facts, ms };
    if (want.date !== undefined) out.date = want.date;
    return out;
  } catch (e) { return null; }
}
/* The day's Daily result. */
function readResult(raw, date) {
  try {
    if (!isPlain(raw) || typeof date !== 'string' || raw.date !== date) return null;
    const L = LEVELS.medium, rows = raw.rows, outcome = raw.outcome;
    if (['clean', 'helped', 'shown'].indexOf(outcome) < 0 || !Array.isArray(rows) || rows.length > L.guesses) return null;
    if (!rows.every(c => isClue(c, L))) return null;
    const wins = rows.filter(c => c[0] === L.len).length;
    if (outcome === 'shown' ? wins !== 0 : (wins !== 1 || rows[rows.length - 1][0] !== L.len)) return null;
    const hints = raw.hints === undefined ? 0 : raw.hints;
    if (!isInt(hints, 0, rows.length + 1) || (outcome === 'clean' && hints) || (outcome === 'helped' && !hints)) return null;
    const ms = raw.ms === undefined ? 0 : raw.ms;
    if (typeof ms !== 'number' || !(ms >= 0 && ms < 864e5)) return null;
    return { date, rows: rows.map(c => [c[0], c[1]]), outcome, hints, ms, len: L.len, limit: L.guesses };
  } catch (e) { return null; }
}
/* Two tabs on one Daily: whatever either one did counts. The longer list of guesses wins (with its place on the
   hint ladder), hints and time on screen take the larger, and facts already shown stay shown. */
function mergeRuns(a, b) {
  if (!a || !b) return a || b;
  const lead = b.guesses.length > a.guesses.length || (b.guesses.length === a.guesses.length && b.rung > a.rung) ? b : a;
  const facts = a.facts.slice();
  for (const f of b.facts) if (!facts.some(x => factKey(x) === factKey(f))) facts.push(f);
  return Object.assign({}, lead, { guesses: lead.guesses.map(g => g.slice()), tips: lead.tips.slice(), facts,
    hints: Math.max(a.hints, b.hints), ms: Math.max(a.ms, b.ms) });
}
