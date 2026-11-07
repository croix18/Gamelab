/* ===== 2048: slides, seeded tiles and the look-ahead player (no DOM) =====
   A board is 16 exponents in reading order: 0 is empty, 1 is a 2, 5 is a 32, 11 is 2048.
   Everything here gives the same answer on every device: integer tables, a seeded tile stream,
   a fixed search depth and no clocks. */
const CELLS = 16;
const DIRS = ['left', 'up', 'right', 'down']; /* also the order the look-ahead player breaks ties in */
const GOAL = 11; /* 2048 */
const DAILY_SLIDES = 150;
const LOOK_DEPTH = 3; /* the look-ahead player always thinks three slides deep: never a time limit */
const CAREFUL_DEPTH = 2; /* the careful player the Challenge limits are set for thinks two slides deep */
/* Challenges: make the goal tile within the slide limit. The limits are the brief's, checked by simulation
   (tests/2048.test.mjs runs it again): a player who thinks one slide ahead makes Easy and Medium nearly every
   time, and Hard takes real planning, which the careful player (two slides ahead) almost always makes. */
const CHALLENGES = {
  easy: { name: 'Easy', goal: 7, limit: 120 },
  medium: { name: 'Medium', goal: 8, limit: 220 },
  hard: { name: 'Hard', goal: 9, limit: 420 }
};
const CHALLENGE_ORDER = ['easy', 'medium', 'hard'];

/* tile values by exponent, built by doubling so every device holds the same numbers */
const VALUE = [0];
for (let e = 1; e < 32; e++) VALUE.push(e === 1 ? 2 : VALUE[e - 1] * 2);

/* ---------- slides ---------- */
/* Each line lists its four cells starting from the edge the tiles slide toward. */
const LINES = (function () {
  const n = [0, 1, 2, 3], back = [3, 2, 1, 0];
  return {
    left: n.map(r => n.map(c => r * 4 + c)),
    right: n.map(r => back.map(c => r * 4 + c)),
    up: n.map(c => n.map(r => r * 4 + c)),
    down: n.map(c => back.map(r => r * 4 + c))
  };
})();

/* One slide by the classic rules: every tile moves as far as it can, two equal tiles that meet merge into
   one worth double, and a merged tile doesn't merge again in the same slide.
   moves: where each tile went; merges: the cells that now hold a merged tile, with its exponent. */
function slide(board, dir) {
  const out = new Array(CELLS).fill(0), moves = [], merges = [];
  let score = 0, moved = false;
  for (const line of LINES[dir]) {
    let t = 0, last = 0, open = false;
    for (let i = 0; i < 4; i++) {
      const from = line[i], e = board[from];
      if (!e) continue;
      let to;
      if (open && e === last) {
        to = line[t - 1];
        out[to] = e + 1;
        score += VALUE[e + 1];
        merges.push({ at: to, exp: e + 1 });
        open = false;
      } else {
        to = line[t++];
        out[to] = e;
        last = e;
        open = true;
      }
      moves.push({ from, to });
      if (from !== to) moved = true;
    }
  }
  return { board: out, score, moved, moves, merges };
}
const canSlide = (board, dir) => slide(board, dir).moved;
const legalDirs = board => DIRS.filter(d => canSlide(board, d));
/* The game is over when no slide moves anything: no empty cell and no two equal neighbours. */
function isOver(board) {
  for (let i = 0; i < CELLS; i++) {
    if (!board[i]) return false;
    if (i % 4 < 3 && board[i] === board[i + 1]) return false;
    if (i < 12 && board[i] === board[i + 4]) return false;
  }
  return true;
}
const maxExp = board => Math.max.apply(null, board);
const emptyCount = board => board.reduce((n, e) => n + (e ? 0 : 1), 0);
const biggestMerge = merges => merges.reduce((m, x) => Math.max(m, x.exp), 0);

/* ---------- the seeded tile stream: the same slides give the same tiles ---------- */
function mix(seed, k) {
  let h = (seed ^ Math.imul(k + 1, 0x9E3779B1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
  return (h ^ (h >>> 16)) >>> 0;
}
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/* Tile number k of a game. Every tile k has its own shuffled order of the 16 cells and lands in the first
   empty one, so it is a fair pick among the empty cells; it is a 4 one time in ten, otherwise a 2.
   The draws never depend on the board, so tile k is the same 2 or 4 for everyone playing that seed, and
   lands in the same cell whenever that cell is free. */
function tileFor(board, seed, k) {
  const r = mulberry(mix(seed, k));
  const order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  for (let i = 15; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
  const exp = r() < 0.9 ? 1 : 2;
  for (let i = 0; i < CELLS; i++) if (!board[order[i]]) return { at: order[i], exp };
  return null;
}

/* A game: its seed, the board, the score, its slides so far ('l', 'u', 'r', 'd') and k, the tiles dealt. */
function newGame(seed) {
  const g = { seed: seed >>> 0, board: new Array(CELLS).fill(0), k: 0, score: 0, slides: 0, moves: '', lastMerge: 0, mergeAt: 0 };
  for (let i = 0; i < 2; i++) { const t = tileFor(g.board, g.seed, g.k++); g.board[t.at] = t.exp; }
  return g;
}
const DIR_CH = { left: 'l', up: 'u', right: 'r', down: 'd' };
const CH_DIR = { l: 'left', u: 'up', r: 'right', d: 'down' };
/* Makes one slide. A slide that moves nothing changes nothing: no new tile, and it doesn't count. */
function makeSlide(g, dir) {
  const r = slide(g.board, dir);
  if (!r.moved) return null;
  r.before = g.board;
  r.slid = r.board.slice(); /* after the slide, before the new tile */
  const t = tileFor(r.board, g.seed, g.k++);
  r.board[t.at] = t.exp;
  r.tile = t;
  g.board = r.board;
  g.score += r.score;
  g.slides++;
  g.moves += DIR_CH[dir];
  if (r.merges.length) { g.lastMerge = biggestMerge(r.merges); g.mergeAt = g.slides; } /* the latest merge, and the slide that made it */
  return r;
}
/* Rebuilds a game from its seed and its slides; stops at the first slide that can't be made. */
function rebuild(seed, moves) {
  const g = newGame(seed);
  for (const ch of String(moves || '')) {
    const dir = CH_DIR[ch];
    if (!dir || !makeSlide(g, dir)) break;
  }
  return g;
}

/* ---------- the look-ahead player ----------
   Expectimax: after each of its slides, every empty cell might get a 2 (9 in 10) or a 4, and it plans for
   the average. It judges a board by empty space, ordered rows, possible merges and keeping big tiles few.
   Rows are 16-bit numbers (four 4-bit exponents); all of a row's work is looked up in tables. */
const W = { alive: 200000, empty: 270, merges: 700, order: 47, sum: 11 };
/* r^3.5 and r^4 for r = 0..15, written out so every device builds exactly the same tables */
const SUM_POW = [0, 1, 11, 47, 128, 280, 529, 907, 1448, 2187, 3162, 4414, 5986, 7921, 10267, 13071];
const POW4 = [0, 1, 16, 81, 256, 625, 1296, 2401, 4096, 6561, 10000, 14641, 20736, 28561, 38416, 50625];
const ROW_LEFT = new Uint16Array(65536), ROW_RIGHT = new Uint16Array(65536), HEUR = new Float64Array(65536);
let built = 0; /* rows built so far: the page builds the tables a slice at a time while it is idle */
const reverseRow = r => ((r & 15) << 12) | ((r >> 4 & 15) << 8) | ((r >> 8 & 15) << 4) | (r >> 12 & 15);
/* Builds the next `rows` rows of the tables (all that remain if omitted); true once they are complete. */
function buildTables(rows) {
  const to = rows ? Math.min(65536, built + rows) : 65536;
  for (let row = built; row < to; row++) {
    const a = row & 15, b = row >> 4 & 15, c = row >> 8 & 15, d = row >> 12 & 15;
    /* empty cells, and merges waiting to happen: a run of k equal tiles (gaps skipped) counts k */
    let empty = 0, merges = 0, prev = 0, run = 0;
    for (let i = 0; i < 4; i++) {
      const r = i === 0 ? a : i === 1 ? b : i === 2 ? c : d;
      if (!r) { empty++; continue; }
      if (prev === r) run++;
      else { if (run) merges += 1 + run; run = 0; }
      prev = r;
    }
    if (run) merges += 1 + run;
    /* ordered rows: how far the row is from rising or falling steadily */
    let fall = 0, rise = 0;
    if (a > b) fall += POW4[a] - POW4[b]; else rise += POW4[b] - POW4[a];
    if (b > c) fall += POW4[b] - POW4[c]; else rise += POW4[c] - POW4[b];
    if (c > d) fall += POW4[c] - POW4[d]; else rise += POW4[d] - POW4[c];
    const sum = SUM_POW[a] + SUM_POW[b] + SUM_POW[c] + SUM_POW[d];
    HEUR[row] = W.alive + W.empty * empty + W.merges * merges - W.order * (fall < rise ? fall : rise) - W.sum * sum;
    /* the row slid left (two 15s stay apart: 16 doesn't fit in four bits) */
    let o0 = 0, o1 = 0, o2 = 0, o3 = 0, t = 0, last = 0, open = false;
    for (let i = 0; i < 4; i++) {
      const e = i === 0 ? a : i === 1 ? b : i === 2 ? c : d;
      if (!e) continue;
      let put = e;
      if (open && e === last && e < 15) { t--; put = e + 1; open = false; }
      else { last = e; open = true; }
      if (t === 0) o0 = put; else if (t === 1) o1 = put; else if (t === 2) o2 = put; else o3 = put;
      t++;
    }
    const left = o0 | o1 << 4 | o2 << 8 | o3 << 12;
    ROW_LEFT[row] = left;
    ROW_RIGHT[reverseRow(row)] = reverseRow(left);
  }
  built = to;
  return built >= 65536;
}
const tablesReady = () => built >= 65536;

const toRows = board => [0, 1, 2, 3].map(r => {
  let v = 0;
  for (let c = 0; c < 4; c++) v |= Math.min(15, board[r * 4 + c]) << (4 * c);
  return v;
});

/* scratch space: one board (four rows) per level of the search */
const SCRATCH = new Int32Array(4 * 16);
/* Slides rows r0..r3 in direction m (0 left, 1 up, 2 right, 3 down) into SCRATCH at o; true if anything moved. */
function moveRows(m, r0, r1, r2, r3, o) {
  const S = SCRATCH;
  if (m === 0) { S[o] = ROW_LEFT[r0]; S[o + 1] = ROW_LEFT[r1]; S[o + 2] = ROW_LEFT[r2]; S[o + 3] = ROW_LEFT[r3]; }
  else if (m === 2) { S[o] = ROW_RIGHT[r0]; S[o + 1] = ROW_RIGHT[r1]; S[o + 2] = ROW_RIGHT[r2]; S[o + 3] = ROW_RIGHT[r3]; }
  else {
    const T = m === 1 ? ROW_LEFT : ROW_RIGHT;
    const c0 = T[(r0 & 15) | (r1 & 15) << 4 | (r2 & 15) << 8 | (r3 & 15) << 12];
    const c1 = T[(r0 >> 4 & 15) | (r1 >> 4 & 15) << 4 | (r2 >> 4 & 15) << 8 | (r3 >> 4 & 15) << 12];
    const c2 = T[(r0 >> 8 & 15) | (r1 >> 8 & 15) << 4 | (r2 >> 8 & 15) << 8 | (r3 >> 8 & 15) << 12];
    const c3 = T[(r0 >> 12 & 15) | (r1 >> 12 & 15) << 4 | (r2 >> 12 & 15) << 8 | (r3 >> 12 & 15) << 12];
    S[o] = (c0 & 15) | (c1 & 15) << 4 | (c2 & 15) << 8 | (c3 & 15) << 12;
    S[o + 1] = (c0 >> 4 & 15) | (c1 >> 4 & 15) << 4 | (c2 >> 4 & 15) << 8 | (c3 >> 4 & 15) << 12;
    S[o + 2] = (c0 >> 8 & 15) | (c1 >> 8 & 15) << 4 | (c2 >> 8 & 15) << 8 | (c3 >> 8 & 15) << 12;
    S[o + 3] = (c0 >> 12 & 15) | (c1 >> 12 & 15) << 4 | (c2 >> 12 & 15) << 8 | (c3 >> 12 & 15) << 12;
  }
  return S[o] !== r0 || S[o + 1] !== r1 || S[o + 2] !== r2 || S[o + 3] !== r3;
}
/* How good a board is: every row and every column scored from the table. */
function judge(r0, r1, r2, r3) {
  return HEUR[r0] + HEUR[r1] + HEUR[r2] + HEUR[r3] +
    HEUR[(r0 & 15) | (r1 & 15) << 4 | (r2 & 15) << 8 | (r3 & 15) << 12] +
    HEUR[(r0 >> 4 & 15) | (r1 >> 4 & 15) << 4 | (r2 >> 4 & 15) << 8 | (r3 >> 4 & 15) << 12] +
    HEUR[(r0 >> 8 & 15) | (r1 >> 8 & 15) << 4 | (r2 >> 8 & 15) << 8 | (r3 >> 8 & 15) << 12] +
    HEUR[(r0 >> 12 & 15) | (r1 >> 12 & 15) << 4 | (r2 >> 12 & 15) << 8 | (r3 >> 12 & 15) << 12];
}

/* Remembered chance-node values. A value depends only on the board and the depth, and the whole board and
   depth are the key, so a remembered value is exactly what the search would work out again: it only saves
   time, and an answer never depends on what was searched before. */
const TT_SIZE = 1 << 16;
const TT_A = new Int32Array(TT_SIZE), TT_B = new Int32Array(TT_SIZE), TT_D = new Int8Array(TT_SIZE), TT_V = new Float64Array(TT_SIZE);

/* The player to slide, with d slides left to think about. A board with no slide is worth nothing. */
function maxNode(r0, r1, r2, r3, d) {
  const o = 4 * d;
  let best = 0;
  for (let m = 0; m < 4; m++) {
    if (!moveRows(m, r0, r1, r2, r3, o)) continue;
    const a = SCRATCH[o], b = SCRATCH[o + 1], c = SCRATCH[o + 2], e = SCRATCH[o + 3];
    const v = d === 1 ? judge(a, b, c, e) : chanceNode(a, b, c, e, d - 1);
    if (v > best) best = v;
  }
  return best;
}
/* A new tile is about to appear: the average over every empty cell, a 2 nine times in ten, otherwise a 4. */
function chanceNode(r0, r1, r2, r3, d) {
  const ka = (r0 << 16 | r1) | 0, kb = (r2 << 16 | r3) | 0;
  let h = Math.imul(ka ^ Math.imul(kb, 0x9E3779B1), 0x85EBCA6B) ^ d;
  h = (h ^ (h >>> 15)) & (TT_SIZE - 1);
  if (TT_D[h] === d && TT_A[h] === ka && TT_B[h] === kb) return TT_V[h];
  let sum = 0, n = 0;
  for (let i = 0; i < 16; i++) {
    const row = i >> 2, shift = (i & 3) * 4;
    const r = row === 0 ? r0 : row === 1 ? r1 : row === 2 ? r2 : r3;
    if ((r >> shift) & 15) continue;
    const two = r | (1 << shift), four = r | (2 << shift);
    let v2, v4;
    if (row === 0) { v2 = maxNode(two, r1, r2, r3, d); v4 = maxNode(four, r1, r2, r3, d); }
    else if (row === 1) { v2 = maxNode(r0, two, r2, r3, d); v4 = maxNode(r0, four, r2, r3, d); }
    else if (row === 2) { v2 = maxNode(r0, r1, two, r3, d); v4 = maxNode(r0, r1, four, r3, d); }
    else { v2 = maxNode(r0, r1, r2, two, d); v4 = maxNode(r0, r1, r2, four, d); }
    sum += 0.9 * v2 + 0.1 * v4;
    n++;
  }
  const v = n ? sum / n : judge(r0, r1, r2, r3);
  TT_D[h] = d; TT_A[h] = ka; TT_B[h] = kb; TT_V[h] = v;
  return v;
}

/* Every slide from this board, valued `depth` slides deep. values[dir] is null for a slide that moves
   nothing; best is the highest value, ties going to the first in DIRS. */
function analyze(board, depth) {
  if (!tablesReady()) buildTables();
  depth = depth || LOOK_DEPTH;
  const [r0, r1, r2, r3] = toRows(board);
  const values = {};
  let best = null, bestV = -Infinity;
  for (let m = 0; m < 4; m++) {
    const dir = DIRS[m];
    if (!canSlide(board, dir)) { values[dir] = null; continue; }
    moveRows(m, r0, r1, r2, r3, 0);
    const a = SCRATCH[0], b = SCRATCH[1], c = SCRATCH[2], e = SCRATCH[3];
    const v = depth === 1 ? judge(a, b, c, e) : chanceNode(a, b, c, e, depth - 1);
    values[dir] = v;
    if (v > bestV) { bestV = v; best = dir; }
  }
  return { best, values };
}
const lookMove = board => analyze(board, LOOK_DEPTH).best;
const carefulMove = board => analyze(board, CAREFUL_DEPTH).best;

/* ---------- why a slide is good: concrete reasons that name the tiles ---------- */
const CORNERS = [0, 3, 12, 15];
/* every pair of equal tiles side by side: { exp, cells } */
function pairsIn(board) {
  const out = [];
  for (let i = 0; i < CELLS; i++) {
    const e = board[i];
    if (!e) continue;
    if (i % 4 < 3 && board[i + 1] === e) out.push({ exp: e, cells: [i, i + 1] });
    if (i < 12 && board[i + 4] === e) out.push({ exp: e, cells: [i, i + 4] });
  }
  return out;
}
/* how far the rows and columns are from rising or falling steadily */
function disorder(board) {
  let n = 0;
  for (const dir of ['left', 'up']) {
    for (const line of LINES[dir]) {
      let fall = 0, rise = 0;
      for (let i = 1; i < 4; i++) {
        const a = POW4[Math.min(15, board[line[i - 1]])], b = POW4[Math.min(15, board[line[i]])];
        if (a > b) fall += a - b; else rise += b - a;
      }
      n += Math.min(fall, rise);
    }
  }
  return n;
}
/* What one slide does, before its new tile arrives. */
function outcome(board, dir) {
  const r = slide(board, dir), top = maxExp(r.board);
  return {
    moved: r.moved, board: r.board, merges: r.merges, merge: biggestMerge(r.merges), empty: emptyCount(r.board), top,
    corner: top ? CORNERS.filter(i => r.board[i] === top) : [], pairs: pairsIn(r.board), disorder: disorder(r.board)
  };
}
/* Why slide `dir` beats slide `than` (the slide that was made, or the next-best slide), with the tiles it is about.
   { why: 'only' | 'merge' | 'corner' | 'into-corner' | 'merges' | 'pair' | 'space' | 'order' | 'ahead',
     exp?, n?, m?, fresh?, kept?, mark: { a: cells to outline after dir, b: cells to outline after than } }
   Concrete reasons come first; 'ahead' (safest a few slides ahead) is the last resort. With `own` (a hint), when
   nothing sets the two slides apart, a concrete thing the slide does comes before 'order' and 'ahead'. */
function explain(board, dir, than, own) {
  const A = outcome(board, dir), B = than ? outcome(board, than) : null;
  const none = { a: [], b: [] };
  if (!B || !B.moved) return { why: 'only', mark: none };
  const top = maxExp(board);
  const madeAt = (o, e) => o.merges.filter(x => x.exp === e).map(x => x.at);
  /* it makes a bigger tile (an 8 or more) */
  if (A.merge >= 3 && A.merge > B.merge) return { why: 'merge', exp: A.merge, mark: { a: madeAt(A, A.merge), b: [] } };
  /* it keeps the biggest tile (an 8 or more) in a corner, or puts it there, and the other slide doesn't */
  if (top >= 3 && A.top === top && A.corner.length && !B.corner.length) {
    const was = CORNERS.some(i => board[i] === top);
    return { why: was ? 'corner' : 'into-corner', exp: top, mark: { a: A.corner.slice(0, 1), b: [B.board.indexOf(B.top)] } };
  }
  /* it makes more merges */
  if (A.merges.length >= 2 && A.merges.length > B.merges.length) return { why: 'merges', n: A.merges.length, mark: { a: A.merges.map(x => x.at), b: [] } };
  /* it lines up the biggest pair of equal tiles that the other slide doesn't */
  const has = (pairs, e) => pairs.some(p => p.exp === e);
  const pair = A.pairs.filter(p => p.exp >= 2 && !has(B.pairs, p.exp)).sort((x, y) => y.exp - x.exp)[0];
  if (pair) {
    const fresh = pair.cells.some(c => A.merges.some(x => x.at === c && x.exp === pair.exp));
    return { why: 'pair', exp: pair.exp, fresh, kept: !fresh && has(pairsIn(board), pair.exp), mark: { a: pair.cells, b: [] } };
  }
  if (A.empty > B.empty) return { why: 'space', n: A.empty, m: B.empty, mark: none };
  if (A.merge > B.merge) return { why: 'merge', exp: A.merge, mark: { a: madeAt(A, A.merge), b: [] } };
  if (own) {
    const made = A.pairs.filter(p => p.exp >= 2 && p.cells.some(c => A.merges.some(x => x.at === c && x.exp === p.exp))).sort((x, y) => y.exp - x.exp)[0];
    if (A.merge >= 3) return { why: 'merge', exp: A.merge, mark: { a: madeAt(A, A.merge), b: [] } };
    if (made) return { why: 'pair', exp: made.exp, fresh: true, mark: { a: made.cells, b: [] } };
    if (A.merges.length >= 2) return { why: 'merges', n: A.merges.length, mark: { a: A.merges.map(x => x.at), b: [] } };
    if (top >= 3 && A.top === top && A.corner.length && CORNERS.some(i => board[i] === top)) return { why: 'corner', exp: top, mark: { a: A.corner.slice(0, 1), b: [] } };
    if (A.merge) return { why: 'merge', exp: A.merge, mark: { a: madeAt(A, A.merge), b: [] } };
  }
  if (A.disorder <= B.disorder) return { why: 'order', mark: none };
  return { why: 'ahead', mark: none };
}
/* The hint: the look-ahead player's slide, and why it beats the next-best slide. */
function suggest(board) {
  const a = analyze(board, LOOK_DEPTH);
  if (!a.best) return null;
  const next = DIRS.filter(d => d !== a.best && a.values[d] !== null).sort((x, y) => a.values[y] - a.values[x])[0];
  return Object.assign({ dir: a.best }, explain(board, a.best, next, true));
}

/* ---------- whole games: the Daily card, the tests and the Challenge limits ---------- */
/* One slide of game g by a player ('look' or 'careful'); false once the board is stuck. */
function botSlide(g, who) {
  if (isOver(g.board)) return false;
  const dir = who === 'careful' ? carefulMove(g.board) : lookMove(g.board);
  return !!(dir && makeSlide(g, dir));
}
/* The look-ahead player's Daily on the same tiles, as a game it plays a slide at a time,
   so the page can spread the work over idle moments. */
function lookaheadRun(seed, slides) {
  const g = newGame(seed), limit = slides || DAILY_SLIDES;
  let done = false;
  return {
    game: g,
    step() {
      if (!done && (g.slides >= limit || !botSlide(g, 'look'))) done = true;
      return done;
    },
    get done() { return done; },
    result() { return { score: g.score, top: maxExp(g.board), slides: g.slides }; }
  };
}
function lookaheadDaily(seed, slides) {
  const run = lookaheadRun(seed, slides);
  while (!run.step());
  return run.result();
}
