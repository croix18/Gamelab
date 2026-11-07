/* ===== 2048: the Game Lab edition =====
   Play (Classic and Challenge), Daily and Board on engine.js. Tiles show numbers (32) or powers (2⁵), and each slide's
   biggest merge shows as an equation: 32 + 32 = 64, or in powers 2⁵ + 2⁵ = 2¹ · 2⁵ = 2⁶, the product rule. */
(function () {
  'use strict';
  const ID = '2048';
  const KEY_DIR = { arrowleft: 'left', arrowup: 'up', arrowright: 'right', arrowdown: 'down', a: 'left', w: 'up', d: 'right', s: 'down' };
  const DIR_WORD = { left: 'Left', up: 'Up', right: 'Right', down: 'Down' };
  const MOVE_MS = 110; /* keep in step with --t48-move in game.css */
  /* A slide that leaves the look-ahead player's value at least this far below its own slide "cost" something.
     Small differences between good slides stay far under it; real mistakes run several times over. */
  const COSTLY = 25000;
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5.5M11.5 5.5 5 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const arrow = dir => '<span class="t48-arrow t48-to-' + dir + '">' + ARROW + '</span>';

  /* ---------- tiles and numbers ---------- */
  const fmt = n => Number(n).toLocaleString('en-US');
  const plural = (n, word) => fmt(n) + ' ' + word + (n === 1 ? '' : 's');
  const sup = e => '<span class="t48-pw">2<sup class="t48-ex">' + e + '</sup></span>';
  const tileHTML = (e, powers) => powers ? sup(e) : String(VALUE[e]);
  const tileSay = (e, powers) => powers ? '2 to the ' + e : String(VALUE[e]);
  const aTile = (e, powers) => powers ? sup(e) : (String(VALUE[e])[0] === '8' ? 'an ' : 'a ') + VALUE[e];
  const twoTiles = (e, powers) => 'two ' + (powers ? sup(e) + ' tiles' : VALUE[e] + 's');
  const tileSize = (e, powers) => powers ? (e >= 10 ? 'p2' : 'p1') : 'd' + String(VALUE[e]).length;
  const tileClass = e => 't48-e' + Math.min(e, 12);
  /* a small board; `keys` are the squares to outline */
  function miniHTML(board, powers, label, keys) {
    keys = keys || [];
    return '<div class="t48-mini" role="img" aria-label="' + Lab.esc(label) + '">' + Array.from(board, (e, i) => e
      ? '<span class="' + tileClass(e) + (keys.indexOf(i) >= 0 ? ' t48-key' : '') + '" data-d="' + tileSize(e, powers) + '">' + tileHTML(e, powers) + '</span>'
      : '<span></span>').join('') + '</div>';
  }
  /* a slide's biggest merge as an equation; in powers it shows the product rule */
  function eqHTML(e, powers) {
    const chip = x => '<span class="t48-q ' + tileClass(x) + '">' + tileHTML(x, powers) + '</span>';
    const op = s => '<span class="t48-op">' + s + '</span>';
    return '<span class="t48-ln">' + chip(e - 1) + op('+') + chip(e - 1) + '</span><span class="t48-ln">' + op('=') +
      (powers ? '<span class="t48-prod">' + sup(1) + op('·') + sup(e - 1) + '</span>' + op('=') : '') + chip(e) + '</span>';
  }
  const eqSay = (e, powers) => powers
    ? '2 to the ' + (e - 1) + ' plus 2 to the ' + (e - 1) + ' equals 2 to the 1 times 2 to the ' + (e - 1) + ', which is 2 to the ' + e
    : VALUE[e - 1] + ' plus ' + VALUE[e - 1] + ' equals ' + VALUE[e];

  /* ---------- why a slide is good, in plain words that name the tiles (the reasons come from explain() in engine.js) ---------- */
  function whyText(h, powers, past) {
    switch (h.why) {
      case 'only': return 'is the only slide that moves anything';
      case 'merge': return 'makes ' + aTile(h.exp, powers);
      case 'corner': return 'keeps your ' + tileHTML(h.exp, powers) + ' in its corner';
      case 'into-corner': return 'moves your ' + tileHTML(h.exp, powers) + ' into a corner';
      case 'merges': return 'makes ' + h.n + ' merges';
      case 'pair': return h.fresh ? 'puts your new ' + tileHTML(h.exp, powers) + ' beside the other ' + tileHTML(h.exp, powers)
        : (h.kept ? 'keeps ' : 'puts ') + twoTiles(h.exp, powers) + ' side by side';
      case 'space': return 'leaves ' + plural(h.n, 'empty square') + (past ? '; yours left ' + fmt(h.m) : '');
      case 'order': return 'keeps your rows in order';
      default: return past ? 'was safer a few slides ahead' : 'is safest a few slides ahead';
    }
  }

  /* The Daily's tiles come from the date: the same seed, so the same tiles, on every device that day. */
  const dailySeed = date => Math.floor(Lab.dailyRng(ID, date)() * 4294967296) >>> 0;
  const dailyGame = date => ({ date, seed: dailySeed(date), slides: DAILY_SLIDES });

  /* ---------- what is saved, read back with care: anything damaged counts as absent ---------- */
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const isNum = x => typeof x === 'number' && Number.isFinite(x);
  const count = x => isNum(x) && x > 0 ? Math.floor(x) : 0;
  const cleanCosts = (list, slides) => Array.isArray(list) ? list.filter(c => isObj(c) && Number.isInteger(c.i) && c.i > 0 && c.i <= slides &&
    DIRS.indexOf(c.b) >= 0 && isNum(c.c) && c.c > 0).slice(0, 12).map(c => ({ i: c.i, c: c.c, b: c.b })) : [];
  const cleanPend = (list, slides) => Array.isArray(list) ? list.filter(i => Number.isInteger(i) && i > 0 && i <= slides).slice(-40) : [];
  const cleanLook = x => isObj(x) && isNum(x.score) ? { score: x.score, top: count(x.top), slides: count(x.slides) } : null;
  /* A finished Daily: an object with a string date and moves and a finite seed, under its own date. */
  const isResult = (x, date) => isObj(x) && typeof x.date === 'string' && typeof x.moves === 'string' && isNum(x.seed) && (!date || x.date === date);
  function readResult(x, date) {
    if (!isResult(x, date)) return null;
    const g = rebuild(x.seed >>> 0, x.moves);
    return { date: x.date, seed: g.seed, moves: g.moves, score: g.score, top: maxExp(g.board), slides: g.slides, stuck: isOver(g.board),
      hints: count(x.hints), costs: cleanCosts(x.costs, g.slides), look: cleanLook(x.look) };
  }
  /* A game saved part-way (Play, Board, or the Daily in progress), rebuilt from its seed and slides. */
  function readGame(x) {
    if (!isObj(x) || typeof x.moves !== 'string' || !isNum(x.seed)) return null;
    const g = rebuild(x.seed >>> 0, x.moves);
    return { g, hints: count(x.hints), won: x.won === true, costs: cleanCosts(x.costs, g.slides), pend: cleanPend(x.pend, g.slides), date: x.date, level: x.level };
  }
  /* Two tabs on one Daily. Before this tab writes: a finished result stands, so this tab becomes a replay ('replay');
     a stored run with slides this tab doesn't have is picked up rather than written over ('reload'); else 'write'. */
  function dailyDecision(result, run, moves) {
    if (result) return 'replay';
    if (run && moves.indexOf(run.moves) !== 0) return 'reload';
    return 'write';
  }
  /* Where a Play or Board game is saved: one Classic game, and one per Challenge level. */
  const saveKey = (mode, kind, level) => ID + '.' + mode + '.' + (kind === 'challenge' ? 'challenge.' + level : 'classic');

  /* ---------- one session of a mode ---------- */
  function mount(mode, host, ctx) {
    host.classList.add('t48-host');
    const raw = Lab.store.get(ID + '.settings', null), saved = isObj(raw) ? raw : {};
    const kindOf = k => k === 'challenge' ? 'challenge' : 'classic';
    const levelOf = l => Object.prototype.hasOwnProperty.call(CHALLENGES, l) ? l : 'easy';
    const S = {
      kind: kindOf(saved.kind), level: levelOf(saved.level), bKind: kindOf(saved.bKind), bLevel: levelOf(saved.bLevel),
      powers: saved.powers === true,
      best: count(Lab.store.get(ID + '.best', 0)),
      game: null, gid: 0, last: null, end: null, won: false,
      hints: 0, hintAt: -1, hint: null,
      analysis: null, costs: [], pending: [],
      daily: null, look: null, lookRun: null, result: null
    };
    const onBoard = mode === 'board';
    const kind = () => mode === 'daily' ? 'daily' : onBoard ? S.bKind : S.kind;
    const level = () => onBoard ? S.bLevel : S.level;
    const challenge = () => kind() === 'challenge' ? CHALLENGES[level()] : null;
    const RUN = ID + '.dailyrun', resultKey = date => ID + '.daily.' + date;
    const q = sel => host.querySelector(sel);
    let endTimer = 0, idleId = 0, dead = false, review = null, eqKey = '';

    host.innerHTML =
      '<div class="t48-game t48-m-' + mode + '">' +
        '<section class="card t48-stage" aria-label="2048">' +
          '<div class="t48-head"><p class="label t48-meta"></p><div class="t48-stats"></div></div>' +
          '<div class="t48-play"><div class="t48-board" role="img" aria-label="Board">' +
            '<div class="t48-cells" aria-hidden="true">' + '<i></i>'.repeat(16) + '</div><div class="t48-tiles" aria-hidden="true"></div>' +
          '</div></div>' +
          '<div class="t48-eq" aria-live="polite"></div>' +
          '<div class="t48-info" aria-live="polite"></div>' +
          (onBoard ? '<div class="t48-pad" role="group" aria-label="Slide">' + ['up', 'left', 'right', 'down'].map(d =>
            '<button class="t48-pad-btn" type="button" data-dir="' + d + '" aria-label="Slide ' + d + '">' + arrow(d) + '</button>').join('') + '</div>' : '') +
          '<div class="t48-actions"></div>' +
        '</section>' +
      '</div>';

    /* ---------- games ---------- */
    /* data: what readGame() gave back, or nothing for a new game */
    function begin(g, data) {
      data = data || {};
      clearTimeout(endTimer);
      S.game = g; S.gid++;
      S.last = null; S.hint = null; S.analysis = null; eqKey = '';
      S.hints = data.hints || 0; S.hintAt = -1;
      S.won = !!data.won;
      S.costs = data.costs || [];
      /* slides that were waiting to be looked at when the game was saved */
      S.pending = (data.pend || []).map(i => ({ gid: S.gid, i, board: rebuild(g.seed, g.moves.slice(0, i - 1)).board, made: CH_DIR[g.moves[i - 1]] }));
      S.end = whatEnded();
      renderAll(null);
      wake();
    }
    function freshGame() {
      begin(newGame((Math.random() * 4294967296) >>> 0));
      save();
    }
    /* Picks up the saved game for this mode, kind and level, or starts a new one. */
    function resume() {
      let data = readGame(Lab.store.get(saveKey(mode, kind(), level()), null));
      if (!data && kind() === 'challenge') { /* saved before each level had its own save */
        const old = readGame(Lab.store.get(ID + '.' + mode + '.challenge', null));
        if (old && old.level === level()) data = old;
      }
      if (data) { begin(data.g, data); if (!S.end) return; }
      freshGame();
    }
    function save() {
      const g = S.game;
      const data = { seed: g.seed, moves: g.moves, hints: S.hints, won: S.won, costs: S.costs, pend: S.pending.filter(p => p.gid === S.gid).map(p => p.i) };
      if (mode !== 'daily') { Lab.store.set(saveKey(mode, kind(), level()), Object.assign({ level: level() }, data)); return; }
      if (!S.end && dailyCheck()) Lab.store.set(RUN, Object.assign({ date: S.daily.date }, data, { hints: S.hints }));
    }
    const saveSettings = () => Lab.store.set(ID + '.settings', { kind: S.kind, level: S.level, bKind: S.bKind, bLevel: S.bLevel, powers: S.powers });
    function whatEnded() {
      const g = S.game, ch = challenge();
      if (mode === 'daily') return g.slides >= DAILY_SLIDES || isOver(g.board) ? 'done' : null;
      if (ch && maxExp(g.board) >= ch.goal) return 'won';
      if (ch && g.slides >= ch.limit) return 'out';
      return isOver(g.board) ? 'over' : null;
    }

    /* ---------- two tabs on one Daily: before every write, look at what is stored ---------- */
    function storedRun() {
      const x = readGame(Lab.store.get(RUN, null));
      return x && x.date === S.daily.date && x.g.seed === S.daily.seed ? x : null;
    }
    /* True when this tab may write. Otherwise it has become a replay of the finished result, or picked up the slides
       another tab made. Hints count the larger of the two tabs' counts. */
    function dailyCheck() {
      const d = S.daily;
      if (!d || d.replay) return false;
      const raw = Lab.store.get(resultKey(d.date), null), run = storedRun();
      const act = dailyDecision(isResult(raw, d.date) ? raw : null, run && { moves: run.g.moves }, S.game.moves);
      if (act === 'replay') { becomeReplay(readResult(raw, d.date)); return false; }
      if (act === 'reload') { const mine = S.hints; begin(run.g, run); S.hints = Math.max(mine, run.hints); renderSide(); return false; }
      if (run && run.hints > S.hints) { S.hints = run.hints; renderSide(); }
      return true;
    }
    /* Another tab finished today's Daily first: its result stands, and this game goes on as a replay. */
    function becomeReplay(result) {
      clearTimeout(endTimer);
      S.daily.replay = true;
      S.result = null;
      renderSide();
      showResults(result, false, false);
    }
    function onStorage() {
      if (!dead && mode === 'daily' && S.daily && !S.daily.replay && !S.result) dailyCheck();
    }

    /* ---------- sliding ---------- */
    function doSlide(dir) {
      if (!S.game || S.end || Lab.sheetOpen()) return;
      if (mode === 'daily' && !S.daily.replay && !dailyCheck()) return; /* another tab moved on: catch up first */
      const g = S.game, before = g.board, i = g.slides + 1;
      const a = current(S.analysis) ? S.analysis : null;
      const r = makeSlide(g, dir);
      if (!r) { nudge(dir); return; }
      if (a) noteCost(i, dir, a);
      else S.pending.push({ gid: S.gid, i, board: before, made: dir });
      S.last = r; S.hint = null;
      if (mode === 'play' && kind() === 'classic' && g.score > S.best) { S.best = g.score; Lab.store.set(ID + '.best', S.best); }
      S.end = whatEnded();
      let cheer = false;
      if (!S.end && !S.won && kind() === 'classic' && maxExp(g.board) >= GOAL) { S.won = true; cheer = true; }
      if (S.end) Lab.sound.play(S.end === 'won' || S.end === 'done' ? 'solve' : 'up');
      else if (cheer) Lab.sound.play('solve');
      else if (r.merges.length) Lab.sound.play('step');
      save();
      renderTiles(r); renderEq(); renderSide();
      if (S.end) {
        if (mode !== 'daily') endTimer = setTimeout(openEnd, MOVE_MS + 340);
        else if (recordDaily()) endTimer = setTimeout(finishDaily, MOVE_MS + 340);
      } else if (cheer) endTimer = setTimeout(celebrate, MOVE_MS + 340);
      wake();
    }
    function nudge(dir) {
      const b = q('.t48-board');
      b.classList.remove('t48-nudge');
      void b.offsetWidth;
      b.style.setProperty('--t48-nx', dir === 'left' ? '-5px' : dir === 'right' ? '5px' : '0px');
      b.style.setProperty('--t48-ny', dir === 'up' ? '-5px' : dir === 'down' ? '5px' : '0px');
      b.classList.add('t48-nudge');
    }

    /* ---------- the look-ahead player: hints and the slides that cost the most ---------- */
    const current = a => !!(a && a.gid === S.gid && a.at === S.game.slides);
    function analysisNow() {
      if (!current(S.analysis)) S.analysis = Object.assign({ gid: S.gid, at: S.game.slides }, analyze(S.game.board, LOOK_DEPTH));
      return S.analysis;
    }
    function noteCost(i, made, a) {
      if (!a.best || a.best === made || a.values[made] === null || a.values[made] === undefined) return;
      const cost = a.values[a.best] - a.values[made];
      if (!(cost >= COSTLY)) return;
      S.costs.push({ i, c: Math.round(cost), b: a.best });
      S.costs.sort((x, y) => y.c - x.c || x.i - y.i);
      if (S.costs.length > 12) S.costs.length = 12;
    }
    const canHint = () => !!S.game && !S.end && !isOver(S.game.board);
    function hintNow() {
      if (!canHint() || Lab.sheetOpen()) return;
      if (mode === 'daily' && !S.daily.replay && !dailyCheck()) return;
      const a = analysisNow();
      if (!a.best) return;
      /* why it beats the next-best slide */
      const next = DIRS.filter(d => d !== a.best && a.values[d] !== null).sort((x, y) => a.values[y] - a.values[x])[0];
      S.hint = Object.assign({ at: S.game.slides, dir: a.best }, explain(S.game.board, a.best, next, true));
      if (S.hintAt !== S.game.slides) { S.hintAt = S.game.slides; S.hints++; save(); }
      renderSide();
    }
    /* The two or three costliest slides, at least three slides apart. */
    function picks(costs) {
      const out = [];
      costs.slice().sort((x, y) => y.c - x.c || x.i - y.i).forEach(c => { if (out.length < 3 && out.every(o => Math.abs(o.i - c.i) >= 3)) out.push(c); });
      return out.sort((x, y) => x.i - y.i);
    }

    /* Background work, a little at a time while the page is idle, so nothing ever freezes it:
       the look-ahead tables, the board on screen (so a hint is instant), slides still to look at,
       and on the Daily the look-ahead player's own 150 slides. */
    const ric = window.requestIdleCallback ? fn => window.requestIdleCallback(fn, { timeout: 200 }) : fn => setTimeout(() => fn(null), 16);
    const cic = window.cancelIdleCallback ? id => window.cancelIdleCallback(id) : id => clearTimeout(id);
    function wake() { if (!idleId && !dead) idleId = ric(work); }
    function work(deadline) {
      idleId = 0;
      if (dead) return;
      const until = performance.now() + (deadline && !deadline.didTimeout ? Math.max(4, Math.min(12, deadline.timeRemaining())) : 8);
      let more = true;
      try { do more = step(); while (more && performance.now() < until); }
      catch (err) { console.error(err); S.pending = []; more = false; } /* never let one bad step stop the game */
      if (more) wake();
    }
    function step() {
      if (!tablesReady()) { buildTables(8192); return true; }
      if (S.game && !S.end && !current(S.analysis) && !isOver(S.game.board)) { analysisNow(); return true; }
      if (S.pending.length) {
        const p = S.pending.shift();
        if (p.gid === S.gid) noteCost(p.i, p.made, analyze(p.board, LOOK_DEPTH));
        if (!S.pending.length) costsReady();
        return true;
      }
      if (S.lookRun && !S.lookRun.done) { if (S.lookRun.step()) lookDone(); return true; }
      return false;
    }
    function costsReady() {
      if (S.game && !S.end) save();
      if (S.result && !S.daily.replay) {
        S.result.costs = S.costs.slice();
        const key = resultKey(S.result.date), stored = Lab.store.get(key, null);
        if (isResult(stored, S.result.date) && stored.moves === S.result.moves) Lab.store.set(key, S.result); /* only ever this tab's own result */
      }
      if (review && review.live) fillCosts();
    }

    /* ---------- rendering ---------- */
    function tileEl(e, cell, cls) {
      const t = document.createElement('div');
      t.className = 't48-tile' + (cls || '');
      t.style.setProperty('--t48-x', cell % 4);
      t.style.setProperty('--t48-y', cell >> 2);
      t.innerHTML = '<div class="t48-face ' + tileClass(e) + '" data-d="' + tileSize(e, S.powers) + '">' + tileHTML(e, S.powers) + '</div>';
      return t;
    }
    /* r: the slide just made (tiles glide from where they were), or null to draw the board as it stands */
    function renderTiles(r) {
      const layer = q('.t48-tiles'), board = S.game.board, frag = document.createDocumentFragment(), moving = [];
      layer.textContent = '';
      if (!r) board.forEach((e, i) => { if (e) frag.appendChild(tileEl(e, i)); });
      else {
        const mergedAt = new Set(r.merges.map(m => m.at));
        r.moves.forEach(m => {
          const t = tileEl(r.before[m.from], m.from, mergedAt.has(m.to) ? ' t48-under' : '');
          frag.appendChild(t);
          if (m.from !== m.to) moving.push([t, m.to]);
        });
        r.merges.forEach(m => frag.appendChild(tileEl(m.exp, m.at, ' t48-merged')));
        frag.appendChild(tileEl(r.tile.exp, r.tile.at, ' t48-new'));
      }
      layer.appendChild(frag);
      if (moving.length) {
        void layer.offsetWidth; /* start from the old cells so the tiles glide */
        moving.forEach(([t, to]) => { t.style.setProperty('--t48-x', to % 4); t.style.setProperty('--t48-y', to >> 2); });
      }
      q('.t48-board').setAttribute('aria-label', 'Board: biggest tile ' + tileSay(maxExp(board), S.powers) + ', ' + plural(emptyCount(board), 'empty square'));
    }
    /* The latest merge stays up, dimmed after a slide that merged nothing, until the next one. */
    function renderEq() {
      const el = q('.t48-eq'), g = S.game, e = g.lastMerge || 0;
      const key = e ? [S.gid, e, g.mergeAt, S.powers].join('|') : g.slides ? 'none' : 'tip';
      el.classList.toggle('t48-dim', !!e && g.mergeAt !== g.slides);
      if (key === eqKey) return;
      eqKey = key;
      if (!e) {
        el.innerHTML = g.slides ? '' : '<span class="t48-tip"><span class="t48-tip-touch">Swipe to slide the tiles</span><span class="t48-tip-keys">Use the arrow keys or swipe</span></span>';
        return;
      }
      el.innerHTML = '<span class="t48-sum" role="img" aria-label="' + eqSay(e, S.powers) + '">' + eqHTML(e, S.powers) + '</span>';
    }
    function endTitle() {
      if (S.end === 'won') return 'You made ' + tileHTML(challenge().goal, S.powers) + '!';
      if (S.end === 'out') return 'Out of slides';
      if (S.end === 'done') return S.game.slides >= DAILY_SLIDES ? DAILY_SLIDES + ' slides done' : 'Game over';
      return 'Game over';
    }
    function renderSide() {
      const g = S.game, ch = challenge();
      const bits = mode === 'daily' ? ['Daily', Lab.dateWords(S.daily.date)].concat(S.daily.replay ? ['Replay'] : [])
        : ch ? ['Challenge', ch.name] : ['Classic'];
      if (S.hints) bits.push('With hints');
      q('.t48-meta').textContent = bits.join(' · ');

      /* "Slides left" carries its own bar, in a neutral colour, so it never reads as progress toward the goal */
      const stat = (label, value, left) => '<div class="t48-stat' + (left === undefined ? '' : ' t48-left') + '"><span class="label">' + label + '</span><b>' + value + '</b>' +
        (left === undefined ? '' : '<i class="t48-lbar"><i style="transform: scaleX(' + Math.max(0, Math.min(1, left)) + ')"></i></i>') + '</div>';
      let stats;
      if (mode === 'daily') stats = stat('Slides left', fmt(DAILY_SLIDES - g.slides), (DAILY_SLIDES - g.slides) / DAILY_SLIDES) + stat('Score', fmt(g.score));
      else if (ch) stats = stat('Goal', tileHTML(ch.goal, S.powers)) + stat('Slides left', fmt(Math.max(0, ch.limit - g.slides)), (ch.limit - g.slides) / ch.limit) + stat('Score', fmt(g.score));
      else if (onBoard) stats = stat('Score', fmt(g.score)) + stat('Slides', fmt(g.slides));
      else stats = stat('Score', fmt(g.score)) + stat('Best', fmt(Math.max(S.best, g.score)));
      q('.t48-stats').innerHTML = stats;

      const hint = S.hint && S.hint.at === g.slides ? S.hint : null;
      let info = '';
      if (S.end) info = '<p class="t48-end">' + endTitle() + '</p>';
      else if (hint) info = '<div class="t48-hint"><span class="label">Hint</span><p>' + arrow(hint.dir) + '<span><b>' + DIR_WORD[hint.dir] + '</b> ' + whyText(hint, S.powers) + '.</span></p></div>';
      q('.t48-info').innerHTML = info;

      const btn = (act, label, cls, off) => '<button class="btn' + (cls ? ' ' + cls : '') + '" type="button" data-act="' + act + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
      let acts;
      if (mode === 'daily') acts = S.end ? btn('results', 'See results', 'primary') : btn('hint', 'Hint', '', !canHint());
      else if (S.end) acts = btn('review', 'Review') + btn('new', 'New game', 'primary');
      else acts = btn('hint', 'Hint', '', !canHint()) + btn('new', 'New game');
      q('.t48-actions').innerHTML = acts;

      host.querySelectorAll('.t48-pad-btn').forEach(b => {
        b.disabled = !!S.end;
        b.classList.toggle('t48-pad-hint', !!hint && b.dataset.dir === hint.dir);
      });
    }
    function renderAll(r) { renderTiles(r); renderEq(); renderSide(); }

    /* ---------- the end of a game: what happened, and the slides that cost the most ---------- */
    /* One costly slide: the board after it beside the board after the better slide, the key tiles outlined and named. */
    function costHTML(rec, c) {
      const before = rebuild(rec.seed, rec.moves.slice(0, c.i - 1)).board, made = CH_DIR[rec.moves[c.i - 1]];
      const ended = rec.stuck && c.i === rec.moves.length;
      const h = explain(before, c.b, made);
      const mine = ended ? rebuild(rec.seed, rec.moves).board : slide(before, made).board, better = slide(before, c.b).board;
      const why = ended ? 'This slide ended the game.' : '<b>' + DIR_WORD[c.b] + '</b> ' + whyText(h, S.powers, true) + '.';
      return '<div class="t48-cost"><p class="label">Slide ' + fmt(c.i) + '</p><div class="t48-pair">' +
        '<figure>' + miniHTML(mine, S.powers, 'After your slide ' + made, ended ? [] : h.mark.b) + '<figcaption>You: ' + arrow(made) + '<b>' + DIR_WORD[made] + '</b></figcaption></figure>' +
        '<figure>' + miniHTML(better, S.powers, 'After a slide ' + c.b, ended ? [] : h.mark.a) + '<figcaption>Better: ' + arrow(c.b) + '<b>' + DIR_WORD[c.b] + '</b></figcaption></figure>' +
        '</div><p class="t48-why">' + why + '</p></div>';
    }
    function costsHTML(rec) {
      if (rec.waiting) return '<p class="t48-wait">Looking back over your slides…</p>';
      const list = picks(rec.costs);
      if (!list.length) return '<p class="t48-none">None. Every slide was close to what the look-ahead player would do.</p>';
      return list.map(c => costHTML(rec, c)).join('');
    }
    function fillCosts() {
      if (!review || !review.el.isConnected) return;
      review.rec.waiting = review.live && S.pending.length > 0;
      review.rec.costs = review.live ? S.costs : review.rec.costs;
      review.el.querySelector('.t48-costs').innerHTML = costsHTML(review.rec);
    }
    const rstat = (value, label) => '<div class="r-stat"><b>' + value + '</b><span>' + label + '</span></div>';
    /* rec: { title, bits, seed, moves, score, top, stuck, costs, waiting }; live: this session's game, still being looked at.
       On the Board it is big enough to read across a classroom. */
    function openReview(rec, live, opts) {
      const h = '<h2>' + rec.title + '</h2><p class="label">' + rec.bits.join(' · ') + '</p>' +
        '<div class="r-stats t48-rstats">' + rstat(fmt(rec.score), 'Score') + rstat(tileHTML(rec.top, S.powers), 'Biggest tile') + '</div>' +
        '<p class="label t48-costs-label">Slides that cost the most</p><div class="t48-costs">' + costsHTML(rec) + '</div>';
      const sh = Lab.sheet(h, Object.assign({ cls: 't48-sheet t48-review' + (onBoard ? ' t48-big' : ''), label: 'Review' }, opts));
      review = { el: sh.el, rec, live };
      return sh;
    }
    function liveRecord() {
      const g = S.game, ch = challenge();
      const bits = [mode === 'daily' ? 'Daily' : ch ? 'Challenge · ' + ch.name : 'Classic',
        ch && S.end === 'won' ? fmt(g.slides) + ' of ' + fmt(ch.limit) + ' slides' : plural(g.slides, 'slide')];
      if (S.hints) bits.push('With hints');
      return { title: endTitle(), bits, seed: g.seed, moves: g.moves, score: g.score, top: maxExp(g.board), stuck: isOver(g.board), costs: S.costs, waiting: S.pending.length > 0 };
    }
    /* After a game in Play or Board: Close keeps the final board on screen; New game starts over. */
    function openEnd() {
      if (!S.end || mode === 'daily') return;
      let pick = null;
      const sh = openReview(liveRecord(), true, {
        done: 'New game',
        extra: '<button class="btn" type="button" data-close data-keep>Close</button>',
        onClose() { review = null; if (pick === 'new') freshGame(); }
      });
      sh.el.addEventListener('click', e => { const b = e.target.closest('[data-close]'); if (b) pick = b.hasAttribute('data-keep') ? 'keep' : 'new'; });
    }
    /* Classic: a 2048 tile. Keep going, or start a new game. */
    function celebrate() {
      if (S.end || Lab.sheetOpen()) return;
      /* Keep going is the button that has focus, so Enter never ends the game by accident */
      const sh = Lab.sheet('<h2>You made ' + tileHTML(GOAL, S.powers) + '!</h2>' + (S.hints ? '<p class="label">With hints</p>' : '') +
        '<div class="r-stats t48-rstats">' + rstat(fmt(S.game.score), 'Score') + rstat(fmt(S.game.slides), 'Slides') + '</div>', {
        cls: 't48-sheet t48-cheer', label: 'You made 2048', done: 'Keep going',
        extra: '<button class="btn" type="button" data-new>New game</button>'
      });
      sh.el.querySelector('[data-new]').addEventListener('click', () => { sh.close(true); freshGame(); });
    }
    /* New game asks first once a game is under way. */
    function askNew() {
      if (mode === 'daily' || Lab.sheetOpen()) return;
      if (S.end || S.game.slides < 10) return freshGame();
      let pick = null;
      const sh = Lab.sheet('<h2>Start a new game?</h2>', {
        cls: 't48-sheet', label: 'New game', done: 'New game',
        extra: '<button class="btn" type="button" data-close data-keep>Keep playing</button>',
        onClose() { if (pick === 'new') freshGame(); }
      });
      sh.el.addEventListener('click', e => { const b = e.target.closest('[data-close]'); if (b) pick = b.hasAttribute('data-keep') ? 'keep' : 'new'; });
    }

    /* ---------- Daily ---------- */
    function startDaily(replay, clean) {
      const date = ctx.date, seed = dailySeed(date);
      S.daily = { date, seed, replay: !!replay };
      S.result = null;
      const run = replay || clean ? null : storedRun();
      begin(run ? run.g : newGame(seed), run);
      if (!S.look && !S.lookRun) S.lookRun = lookaheadRun(seed, DAILY_SLIDES);
      wake();
      if (S.end && !replay && recordDaily()) endTimer = setTimeout(finishDaily, 0);
    }
    function lookDone() {
      S.look = S.lookRun.result();
      const key = resultKey(S.daily.date), stored = Lab.store.get(key, null);
      /* the same tiles give every tab the same score, so it may join any finished result for today */
      if (isResult(stored, S.daily.date) && !cleanLook(stored.look)) { stored.look = S.look; Lab.store.set(key, stored); }
      if (S.result && !S.result.look) S.result.look = S.look;
      const vs = document.querySelector('.t48-results .t48-vs');
      if (vs) showVs(vs, S.look);
    }
    /* Records the finished Daily, unless another tab finished first: the first result stands, and this tab becomes a
       replay showing it (null comes back). A replay is never recorded. */
    function recordDaily() {
      if (S.result) return S.result;
      const g = S.game, d = S.daily;
      const res = { date: d.date, seed: d.seed, moves: g.moves, score: g.score, top: maxExp(g.board), slides: g.slides, stuck: isOver(g.board),
        hints: S.hints, costs: S.costs.slice(), look: S.look };
      if (!d.replay) {
        const raw = Lab.store.get(resultKey(d.date), null);
        if (isResult(raw, d.date)) { becomeReplay(readResult(raw, d.date)); return null; }
        const run = storedRun();
        if (run && run.hints > res.hints) res.hints = S.hints = run.hints;
        Lab.store.set(resultKey(d.date), res);
        Lab.store.set(RUN, null);
      }
      S.result = res;
      return res;
    }
    function finishDaily() {
      if (!S.end) return;
      const res = recordDaily();
      if (res) showResults(res, S.daily.replay, true);
    }
    /* "Look-ahead player: 2,004", and a cheer when the student beats it */
    function showVs(el, look) {
      const score = +el.dataset.score;
      if (!look) { el.innerHTML = 'Look-ahead player: <b>…</b>'; return; }
      const beat = score > look.score;
      el.classList.toggle('t48-beat', beat);
      el.innerHTML = 'Look-ahead player: <b>' + fmt(look.score) + '</b>' +
        (beat ? '<span class="t48-won">You beat it!</span>' : score === look.score ? '<span class="t48-won">You tied it!</span>' : '');
      if (beat && el.dataset.live === '1' && !el.dataset.cheered) { el.dataset.cheered = '1'; Lab.sound.play('solve'); }
    }
    function showResults(res, replay, live) {
      const g = rebuild(res.seed, res.moves), top = maxExp(g.board);
      const sub = 'Daily · ' + Lab.dateWords(res.date) + (g.slides < DAILY_SLIDES ? ' · ' + plural(g.slides, 'slide') : '') + (res.hints ? ' · with hints' : '');
      const sh = Lab.results({
        game: '2048', sub, replay: !!replay, streak: true,
        body: miniHTML(g.board, S.powers, 'Final board'),
        stats: [[fmt(g.score), 'Score'], [String(VALUE[top]), 'Biggest tile']]
      }, {
        cls: 'results t48-sheet t48-results' + (replay ? ' replay' : ''), done: 'Done', onClose: ctx.home,
        extra: '<button class="btn" type="button" data-review>Review</button><button class="btn" type="button" data-again>Play again</button>'
      });
      if (S.powers) sh.el.querySelectorAll('.r-stat b')[1].innerHTML = tileHTML(top, true);
      const vs = document.createElement('p');
      vs.className = 't48-vs';
      vs.dataset.score = g.score;
      vs.dataset.live = live ? '1' : '0';
      sh.el.querySelector('.r-stats').after(vs);
      showVs(vs, res.look || S.look);
      sh.el.querySelector('[data-again]').addEventListener('click', () => { sh.close(true); startDaily(true); });
      sh.el.querySelector('[data-review]').addEventListener('click', () => {
        sh.close(true);
        const mine = S.result === res;
        openReview({
          title: g.slides >= DAILY_SLIDES ? DAILY_SLIDES + ' slides done' : 'Game over',
          bits: ['Daily', plural(g.slides, 'slide')].concat(res.hints ? ['With hints'] : []),
          seed: res.seed, moves: g.moves, score: g.score, top, stuck: isOver(g.board),
          costs: mine ? S.costs : res.costs || [], waiting: mine && S.pending.length > 0
        }, mine, { done: 'Back', onClose() { review = null; showResults(res, replay, false); } });
      });
    }

    /* ---------- setup: the game (Play and Board) and the tiles (every mode). Only Done applies it. ---------- */
    function openSetup() {
      const daily = mode === 'daily';
      const chosen = { kind: daily ? null : kind(), level: level(), powers: S.powers };
      const chip = (group, value, label, on) => '<button class="chip" type="button" data-group="' + group + '" data-value="' + value + '" aria-pressed="' + on + '">' + label + '</button>';
      let h = '<h2>Setup</h2>';
      if (!daily) {
        h += '<p class="label">Game</p><div class="chips" role="group" aria-label="Game">' +
          chip('kind', 'classic', 'Classic', chosen.kind === 'classic') + chip('kind', 'challenge', 'Challenge', chosen.kind === 'challenge') + '</div>' +
          '<div class="t48-levels"' + (chosen.kind === 'challenge' ? '' : ' hidden') + '><p class="label">Level</p><div class="chips" role="group" aria-label="Level">' +
          CHALLENGE_ORDER.map(l => chip('level', l, CHALLENGES[l].name, l === chosen.level)).join('') + '</div><p class="t48-goal"></p></div>';
      }
      h += '<p class="label">Tiles</p><div class="chips" role="group" aria-label="Tiles">' +
        chip('powers', '0', 'Numbers <span class="t48-chipx">32</span>', !chosen.powers) +
        chip('powers', '1', 'Powers <span class="t48-chipx">' + sup(5) + '</span>', chosen.powers) + '</div>';
      let done = false; /* Escape and a tap outside cancel */
      const sh = Lab.sheet(h, { cls: 't48-sheet t48-setup', label: 'Setup', onClose() { if (done) apply(); } });
      const goalLine = () => {
        const p = sh.el.querySelector('.t48-goal');
        if (p) { const c = CHALLENGES[chosen.level]; p.innerHTML = 'Make ' + tileHTML(c.goal, chosen.powers) + ' within ' + fmt(c.limit) + ' slides.'; }
      };
      goalLine();
      sh.el.addEventListener('click', e => {
        if (e.target.closest('.sheet-foot [data-close]')) { done = true; return; }
        const c = e.target.closest('.chip');
        if (!c) return;
        const g = c.dataset.group;
        chosen[g] = g === 'powers' ? c.dataset.value === '1' : c.dataset.value;
        sh.el.querySelectorAll('.chip[data-group="' + g + '"]').forEach(x => x.setAttribute('aria-pressed', x === c ? 'true' : 'false'));
        const lv = sh.el.querySelector('.t48-levels');
        if (lv) lv.hidden = chosen.kind !== 'challenge';
        goalLine();
      });
      function apply() {
        const tiles = chosen.powers !== S.powers;
        const switched = !daily && (chosen.kind !== kind() || (chosen.kind === 'challenge' && chosen.level !== level()));
        if (switched) save(); /* the game being left stays saved under its own kind and level */
        S.powers = chosen.powers;
        if (!daily) {
          if (onBoard) { S.bKind = chosen.kind; S.bLevel = chosen.level; } else { S.kind = chosen.kind; S.level = chosen.level; }
        }
        saveSettings();
        if (switched) resume();
        else if (tiles) renderAll(null);
      }
    }

    /* ---------- input ---------- */
    host.addEventListener('click', e => {
      const pad = e.target.closest('.t48-pad-btn');
      if (pad) { if (e.detail) pad.blur(); return doSlide(pad.dataset.dir); } /* a tap leaves no ring that could pass for a hint */
      const a = e.target.closest('[data-act]');
      if (!a || a.disabled) return;
      const act = a.dataset.act;
      if (act === 'hint') hintNow();
      else if (act === 'new') askNew();
      else if (act === 'review') openEnd();
      else if (act === 'results') finishDaily();
    });
    function onKey(e) {
      if (Lab.sheetOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      const k = (e.key || '').toLowerCase(), dir = KEY_DIR[k];
      if (dir) { e.preventDefault(); if (!e.repeat) doSlide(dir); return; }
      if (k === 'h') hintNow();
      else if (k === 'n') askNew();
      else return;
      e.preventDefault();
    }
    /* Swipes on the board, by touch or mouse: one finger at a time. A second touch is ignored until the first lifts,
       so two fingers make one slide. touch-action: none (game.css) keeps the page still. */
    const play = q('.t48-play');
    let sw = null;
    function swipeDir(e, min) {
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y, ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) < min || Math.abs(ax - ay) < min * 0.3) return null;
      return ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    const swipeMin = () => Math.max(14, q('.t48-board').clientWidth * 0.05);
    play.addEventListener('pointerdown', e => {
      if (sw) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      sw = { id: e.pointerId, x: e.clientX, y: e.clientY, used: false };
      try { play.setPointerCapture(e.pointerId); } catch (err) { /* fine without it */ }
    });
    play.addEventListener('pointermove', e => {
      if (!sw || sw.id !== e.pointerId || sw.used) return;
      const dir = swipeDir(e, swipeMin());
      if (dir) { sw.used = true; doSlide(dir); }
    });
    function lift(e) { /* only the tracked finger's own lift or cancel ends a swipe */
      if (!sw || sw.id !== e.pointerId) return;
      if (e.type === 'pointerup' && !sw.used) { const dir = swipeDir(e, swipeMin() * 0.6); if (dir) doSlide(dir); }
      sw = null;
    }
    window.addEventListener('pointerup', lift);
    window.addEventListener('pointercancel', lift);
    /* for browsers without touch-action: a swipe on the board never scrolls the page */
    play.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });

    ctx.setDock([{ label: 'Setup', onClick: openSetup }]);

    /* ---------- go: a damaged save is read as absent, and nothing here may stop the game from opening ---------- */
    function start() {
      if (mode === 'daily') {
        const done = readResult(Lab.store.get(resultKey(ctx.date), null), ctx.date);
        if (done && done.look) S.look = done.look;
        startDaily(!!done);
        if (done) showResults(done, false, false);
      } else resume();
    }
    try { start(); }
    catch (err) {
      console.error(err);
      Lab.closeSheet();
      try { if (mode === 'daily') startDaily(false, true); else freshGame(); } catch (err2) { console.error(err2); }
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('storage', onStorage);

    return {
      unmount() {
        dead = true;
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('pointerup', lift);
        window.removeEventListener('pointercancel', lift);
        clearTimeout(endTimer);
        if (idleId) cic(idleId);
      },
      state: S, /* for the tests */
      bot: () => lookMove(S.game.board), /* for the browser check: the look-ahead player's slide */
      redraw: () => { eqKey = ''; renderAll(null); } /* for the browser check: draws S.game.board as it stands */
    };
  }

  const THEN = '<svg class="t48-then" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5.5 6.5 6.5L9 18.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const exRow = row => '<span class="t48-mini t48-exrow" role="img" aria-label="' + row.map(e => e ? VALUE[e] : 'empty').join(', ') + '">' + row.map(e => e ? '<span class="' + tileClass(e) + '" data-d="d1">' + VALUE[e] + '</span>' : '<span></span>').join('') + '</span>';

  Lab.register({
    id: ID,
    name: '2048',
    modes: ['play', 'daily', 'board'],
    accent: ['#5FD3A4', '#DDF6EC'],
    icon: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="7" fill="#E6D5B8"/><rect x="34" y="2" width="28" height="28" rx="7" fill="#8FE5DC"/>' +
      '<rect x="2" y="34" width="28" height="28" rx="7" fill="#127A85"/><rect x="34" y="34" width="28" height="28" rx="7" fill="#F2B640"/>' +
      '<g font-family="DM Sans, sans-serif" font-weight="900" text-anchor="middle"><text x="16" y="22.5" font-size="16" fill="#17324D">2</text><text x="48" y="22.5" font-size="16" fill="#17324D">4</text>' +
      '<text x="16" y="54.5" font-size="16" fill="#fff">8</text><text x="48" y="51.8" font-size="10.5" fill="#17324D">2048</text></g></svg>',
    art: '<div class="t48-art" aria-hidden="true"><span class="t48-e10">1024</span><i>+</i><span class="t48-e10">1024</span><i>=</i><span class="t48-e11">2048</span></div>',
    howTo: '<h2>How to play</h2><p>Swipe, or use the arrow keys, to slide all the tiles. Two tiles with the same number merge into one worth double.</p>' +
      '<div class="t48-howto-ex"><span class="t48-howto-step">Slide left twice:</span>' + exRow([1, 1, 2, 0]) + THEN + exRow([2, 2, 0, 0]) + THEN + exRow([3, 0, 0, 0]) + '</div>' +
      '<p>A tile merges once per slide, so the new 4 waits for the next slide. Make a <b>2048</b> tile before the board fills up.</p>' +
      '<p><b>Powers</b> shows 32 as ' + sup(5) + '. Two ' + sup(5) + ' tiles are 2 · ' + sup(5) + ', which is ' + sup(1) + ' · ' + sup(5) +
        '. To multiply powers with the same base, add the exponents: ' + sup(1) + ' · ' + sup(5) + ' = ' + sup('1+5') + ' = ' + sup(6) + '.</p>' +
      '<p><b>Hint</b> shows the slide the look-ahead player would make. <b>Challenge</b> gives you a slide limit. <b>Daily</b> is 150 slides, the same tiles for everyone today.</p>' +
      '<p class="t48-keys">Keys: arrows or <b>W A S D</b> slide · <b>H</b> hint · <b>N</b> new game</p>',
    dailyDone: date => isResult(Lab.store.get(ID + '.daily.' + date, null), date),
    daily: dailyGame,
    saved: { result: readResult, game: readGame, isResult, decide: dailyDecision, key: saveKey }, /* for the tests */
    mount
  });
})();
