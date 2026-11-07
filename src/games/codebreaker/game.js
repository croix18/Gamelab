/* ===== Codebreaker: the Game Lab edition =====
   Play, Daily and Board on engine.js. The computer hides a row of symbols; after each guess the clue counts
   ● the right symbol in the right spot and ○ the right symbol in a different spot. */
(function () {
  'use strict';
  const ID = 'codebreaker';
  const num = n => Number(n).toLocaleString('en-US');
  const NAMES = SYMBOLS.map(s => s[0].toUpperCase() + s.slice(1));
  /* Each symbol is its own shape and its own color. The shape alone tells them apart; there is no coral. */
  const FILLS = ['#2F7FE0', '#17324D', '#2A9D5C', '#8A5BD6', '#F2B640', '#19ADA0', '#A26B3B'];
  const EDGES = ['#2F7FE0', '#17324D', '#2A9D5C', '#8A5BD6', '#D99A1E', '#19ADA0', '#A26B3B'];
  const SHAPES = [
    '<circle cx="50" cy="50" r="41"/>',
    '<rect x="14" y="14" width="72" height="72" rx="7"/>',
    '<path d="M50 9 94 86H6z"/>',
    '<path d="M50 4 90 50 50 96 10 50z"/>',
    '<path d="M50 7 62 37.4 94.7 39.5 69.5 60.3 77.6 92 50 74.5 22.4 92 30.5 60.3 5.3 39.5 38 37.4z"/>',
    '<path d="M50 7 87.2 28.5 87.2 71.5 50 93 12.8 71.5 12.8 28.5z"/>',
    '<path d="M37 8h26v29h29v26H63v29H37V63H8V37h29z"/>'
  ];
  function symSVG(s, cls) {
    return '<svg class="' + (cls || 'cb-sym') + '" viewBox="0 0 100 100" aria-hidden="true"><g fill="' + FILLS[s] + '" stroke="' + EDGES[s] +
      '" stroke-width="5" stroke-linejoin="round">' + SHAPES[s] + '</g></svg>';
  }
  /* clue marks: a filled dot and a ring, each with its count, so the marks differ by shape as well as by fill */
  const MARK_RIGHT = '<svg class="cb-mk-i" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="currentColor"/></svg>';
  const MARK_WRONG = '<svg class="cb-mk-i" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';
  const MARK_NONE = '<svg class="cb-mk-i cb-mk-none" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>';
  const clueWords = c => c[0] + ' right symbol' + (c[0] === 1 ? '' : 's') + ' in the right spot, ' + c[1] + ' in a wrong spot';
  const clueHTML = c => '<span class="cb-clue" role="img" aria-label="' + clueWords(c) + '">' +
    '<span class="cb-mk' + (c[0] ? '' : ' cb-zero') + '">' + MARK_RIGHT + '<b>' + c[0] + '</b></span>' +
    '<span class="cb-mk' + (c[1] ? '' : ' cb-zero') + '">' + MARK_WRONG + '<b>' + c[1] + '</b></span></span>';
  /* a clue inside a sentence */
  const clueInline = c => '<span class="cb-ci" role="img" aria-label="' + clueWords(c) + '">' + MARK_RIGHT + '<b>' + c[0] + '</b>' + MARK_WRONG + '<b>' + c[1] + '</b></span>';
  const codeWords = code => code.map(s => SYMBOLS[s]).join(', ');
  const miniRow = code => '<span class="cb-minis">' + code.map(s => '<span class="cb-mini">' + symSVG(s) + '</span>').join('') + '</span>';
  /* a symbol's name in a sentence, with its shape beside it */
  const nameHTML = (s, many) => '<b class="cb-nm">' + symSVG(s, 'cb-sym-in') + (many ? PLURALS : SYMBOLS)[s] + '</b>';
  const repeatsText = L => L.repeats ? 'Repeats allowed' : 'No repeats';
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  /* "Guess 2", "Guesses 2 and 5", "Guesses 2–8", "Guesses 2–4 and 7" (ks: 0-based, in order) */
  function guessList(ks) {
    const runs = [], parts = [];
    ks.forEach(k => { const r = runs[runs.length - 1]; if (r && k === r[1] + 1) r[1] = k; else runs.push([k, k]); });
    runs.forEach(([a, b]) => { if (b - a >= 2) parts.push((a + 1) + '–' + (b + 1)); else for (let k = a; k <= b; k++) parts.push(String(k + 1)); });
    return (ks.length === 1 ? 'Guess ' : 'Guesses ') + (parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]);
  }
  /* Row sizes in pegs, matched by game.css: padding, number, gap, the pegs, gap, the clue; then gap and "N left". */
  const coreWidth = len => 0.3 + 0.6 + 0.3 + len + (len - 1) * 0.12 + 0.3 + 1.9 + 0.05;
  const REST_WIDTH = 0.3 + 2.4;
  const boardHeight = rows => rows * 1.12 + 0.18 + 0.05;

  /* The Daily: one Medium code for everyone that day (engine.js dailyCode). */
  const dailyMemo = [];
  const dailyFor = date => dailyCode(date, iso => Lab.dailyRng(ID, iso), dailyMemo);
  const resultKey = date => ID + '.daily.' + date;
  const RUN = ID + '.run'; /* today's Daily in progress */
  const BOARD = ID + '.board'; /* the Board round in progress */

  /* ---------- one session of a mode ---------- */
  function mount(mode, host, ctx) {
    const board = mode === 'board', daily = mode === 'daily';
    const saved = Lab.store.get(ID + '.settings', {}) || {};
    const isLevel = l => LEVEL_IDS.indexOf(l) >= 0;
    /* S carries the round's own fields (engine.js newRound) alongside the session's */
    const S = Object.assign(newRound('easy', [0, 1, 2, 3], board), {
      level: isLevel(saved.level) ? saved.level : 'easy',
      bLevel: isLevel(saved.bLevel) ? saved.bLevel : 'medium',
      L: LEVELS.easy, entry: [], outcome: null, endedAt: 0,
      count: 0, solvedCount: 0, streak: 0, best: Math.max(0, Math.floor(+Lab.store.get(ID + '.best', 0) || 0)),
      daily: null
    });
    /* one-shot motion: the symbol just placed, the row just scored, the code turning over, a row that isn't full */
    const fx = { fresh: -1, scored: -1, flip: false, nudge: false };
    let tick = 0;
    const q = sel => host.querySelector(sel);
    const saveSettings = () => Lab.store.set(ID + '.settings', { level: S.level, bLevel: S.bLevel });
    const blankRow = () => new Array(S.L.len).fill(null);
    const full = () => S.entry.length > 0 && S.entry.indexOf(null) < 0;

    host.classList.add('cb-host');
    host.innerHTML =
      '<div class="cb cb-m-' + mode + '">' +
        '<section class="card cb-stage" aria-label="Codebreaker" tabindex="-1">' +
          '<div class="cb-field"><div class="cb-board"></div></div>' +
          '<div class="cb-panel">' +
            '<p class="label cb-meta"></p>' +
            (board ? '<div class="cb-count"><p class="label">Codes left</p><p class="cb-count-n"></p></div>' : '') +
            '<p class="cb-verdict" hidden></p>' +
            '<div class="cb-legend" aria-hidden="true"><span>' + MARK_RIGHT + 'Right symbol, right spot</span><span>' + MARK_WRONG + 'Right symbol, wrong spot</span></div>' +
            '<div class="cb-keys" role="group" aria-label="Symbols"></div>' +
            '<div class="cb-actions"></div>' +
            '<div class="cb-reveal" aria-live="polite"></div>' +
          '</div>' +
          '<p class="cb-sr" aria-live="polite"></p>' +
        '</section>' +
      '</div>';
    const root = q('.cb'), stage = q('.cb-stage');

    /* ---------- a round ---------- */
    function begin(R, counted) {
      Object.assign(S, R);
      S.L = LEVELS[R.levelId]; S.entry = blankRow(); S.outcome = null; S.endedAt = 0;
      if (counted) S.count++;
      fx.fresh = -1; fx.scored = -1; fx.flip = false;
      root.style.setProperty('--pw-core', coreWidth(S.L.len).toFixed(2));
      root.style.setProperty('--pw-full', (coreWidth(S.L.len) + REST_WIDTH).toFixed(2));
      root.style.setProperty('--ph-all', boardHeight(S.L.guesses + 1).toFixed(2));
      root.style.setProperty('--syms', S.L.syms);
      renderKeys(); renderAll();
    }
    function deal() {
      const levelId = daily ? 'medium' : board ? S.bLevel : S.level;
      begin(newRound(levelId, daily ? S.daily.code : randomCode(levelId, Math.random), board), true);
      if (board) save();
    }

    /* ---------- entering a guess ---------- */
    function place(s) {
      if (S.over || s < 0 || s >= S.L.syms) return;
      const i = S.entry.indexOf(null);
      if (i < 0) { fx.nudge = true; renderBoard(); return; }
      S.entry[i] = s; fx.fresh = i;
      renderBoard(); syncCheck();
    }
    function clearSpot(i) {
      if (S.over || S.entry[i] === null || S.entry[i] === undefined) return;
      S.entry[i] = null;
      renderBoard(); syncCheck();
    }
    /* Backspace takes back the spot that has focus, or else the last one filled. */
    function backspace() {
      if (S.over) return;
      const a = document.activeElement;
      if (a && a.classList.contains('cb-slot') && host.contains(a)) return clearSpot(+a.dataset.spot);
      for (let i = S.entry.length - 1; i >= 0; i--) if (S.entry[i] !== null) { S.entry[i] = null; renderBoard(); syncCheck(); return; }
    }
    function useGuess(code) {
      if (S.over || !code) return;
      S.entry = code.slice(); fx.fresh = -1;
      renderBoard(); syncCheck();
    }
    function check() {
      if (S.over) return;
      if (!full()) { fx.nudge = true; renderBoard(); return; }
      if (sync() || S.over) return;
      const guess = S.entry.slice(), clue = addGuess(S, guess);
      S.entry = blankRow();
      fx.scored = S.history.length - 1; fx.fresh = -1;
      say('Guess ' + S.history.length + ': ' + clueWords(clue) + '.');
      if (S.over) { if (S.solved) Lab.sound.play('solve'); endRound(S.solved ? (S.hints ? 'helped' : 'clean') : 'shown'); }
      else { Lab.sound.play('step'); save(); }
      renderAll();
    }

    /* ---------- the end of a round: cracked, out of guesses, or shown ---------- */
    function endRound(outcome) {
      S.over = true; S.tips = []; fx.flip = true;
      S.endedAt = performance.now(); /* Next ignores a tap for a moment, so a double tap on Check can't skip the debrief */
      settle(outcome);
      const v = verdict();
      say(v[0] + (v[1] ? ', ' + v[1].toLowerCase() : '') + '. The code was ' + codeWords(S.secret) + '.');
    }
    /* A round's outcome is decided once. */
    function settle(outcome) {
      if (S.outcome) return;
      S.outcome = outcome;
      if (mode === 'play') {
        if (outcome === 'shown') S.streak = 0;
        else {
          S.solvedCount++; S.streak++;
          if (S.streak > S.best) { S.best = S.streak; Lab.store.set(ID + '.best', S.best); }
        }
      }
      if (daily) finishDaily();
      if (board) Lab.store.set(BOARD, null);
    }
    function show() {
      if (S.over) return;
      endRound('shown');
      renderAll();
    }
    /* Show me ends the day's Daily, or the class's round on the Board, so there it asks first. */
    function askShow() {
      if (S.over) return;
      if (!board && !(daily && !S.daily.replay)) return show();
      const sh = Lab.sheet('<h2>Show the code?</h2><p>' + (daily ? 'That ends today’s Daily, and it counts as shown.' : 'That ends this round.') + '</p>',
        { label: 'Show the code', done: 'Keep playing', extra: '<button class="btn" type="button" data-show>Show the code</button>' });
      sh.el.querySelector('[data-show]').addEventListener('click', () => { sh.close(true); show(); });
    }
    function next() {
      if (!S.over || performance.now() - S.endedAt < 500) return;
      if (daily) return showResults(S.daily.result, S.daily.replay);
      deal();
    }

    /* ---------- hints: how many codes fit, then a fact the clues prove, then a strong guess ---------- */
    function hint() {
      if (S.over || sync() || S.over) return;
      if (!addHint(S)) return;
      save();
      renderSide(); renderActions();
    }
    function tipHTML(t) {
      const n = S.codes.length;
      if (t.kind === 'count') return n === 1 ? 'Only <b>1</b> code fits every clue.' : '<b>' + num(n) + '</b> codes still fit every clue.';
      if (t.kind === 'fact') {
        if (!t.fact) return 'Make your next guess fit every clue so far.';
        const text = factText(t.fact, S.levelId, nameHTML), src = factSource(t.fact, S.levelId, S.history);
        return src < 0 ? text : text.replace(/\.$/, '') + ', because guess ' + (src + 1) + ' had ' + clueInline(S.history[src].clue) + '.';
      }
      const g = t.guess, lead = n === 1 ? 'It has to be' : S.history.length ? 'Try' : 'A strong start';
      const note = n === 1 ? '' : g.worst === 1 ? 'You’ll know the code after it.' : 'At most <b>' + num(g.worst) + '</b> codes will be left after it.';
      return '<span class="cb-try">' + lead + miniRow(g.code) + '<button class="mini" type="button" data-act="use">Use it</button></span>' +
        (note ? '<span class="cb-note">' + note + '</span>' : '');
    }

    /* ---------- rendering ---------- */
    function renderMeta() {
      const L = S.L, bits = [];
      if (daily) {
        bits.push('Daily');
        if (S.daily.replay) bits.push('Replay');
        bits.push(L.name, repeatsText(L), Lab.clock(elapsed()));
      } else if (mode === 'play') bits.push(L.name, repeatsText(L), 'Solved ' + S.solvedCount, 'Streak ' + S.streak);
      else bits.push('Code ' + S.count, L.name, repeatsText(L));
      q('.cb-meta').textContent = bits.join(' · ');
    }
    function renderBoard() {
      const L = S.L, a = document.activeElement;
      const focusSpot = a && a.classList && a.classList.contains('cb-slot') && host.contains(a) ? +a.dataset.spot : -1;
      const d = S.over && S.history.length ? debrief(S.levelId, S.history, S.solved) : null;
      /* every row keeps a place for its clue and its count of codes left, so nothing moves when they fill in */
      const rest = k => '<span class="cb-rest">' + ((board || S.over) && k >= 0 ? '<b>' + num(S.counts[k + 1]) + '</b> left' : '') + '</span>';
      const noClue = '<span class="cb-clue"></span>';
      let h = '<div class="cb-rows">';
      h += '<div class="cb-row cb-code"><span class="cb-num"></span>' +
        '<span class="cb-pegs" role="img" aria-label="' + (S.over ? 'The code: ' + codeWords(S.secret) : 'The hidden code') + '">' +
        S.secret.map((s, i) => S.over
          ? '<span class="cb-peg cb-shown' + (fx.flip ? ' cb-flip' : '') + '" style="--i:' + i + '">' + symSVG(s) + '</span>'
          : '<span class="cb-peg cb-hid">?</span>').join('') + '</span>' + noClue + rest(-1) + '</div>';
      for (let k = 0; k < L.guesses; k++) {
        const g = S.history[k];
        if (g) {
          const cls = (k === fx.scored ? ' cb-in' : '') + (S.solved && k === S.history.length - 1 ? ' cb-win' : '') +
            (d && d.best === k ? ' cb-best' : '') + (d && d.rows[k].broke >= 0 ? ' cb-broke' : '');
          h += '<div class="cb-row cb-done' + cls + '"><span class="cb-num">' + (k + 1) + '</span>' +
            '<span class="cb-pegs" role="img" aria-label="Guess ' + (k + 1) + ': ' + codeWords(g.guess) + '">' +
            g.guess.map(s => '<span class="cb-peg">' + symSVG(s) + '</span>').join('') + '</span>' + clueHTML(g.clue) + rest(k) + '</div>';
        } else if (k === S.history.length && !S.over) {
          const nextSpot = S.entry.indexOf(null);
          h += '<div class="cb-row cb-now' + (fx.nudge ? ' cb-shake' : '') + '"><span class="cb-num">' + (k + 1) + '</span><span class="cb-pegs">' +
            S.entry.map((s, i) => s === null
              ? '<span class="cb-peg cb-empty' + (i === nextSpot ? ' cb-next' : '') + '"></span>'
              : '<button class="cb-peg cb-slot' + (i === fx.fresh ? ' cb-pop' : '') + '" type="button" data-spot="' + i + '" aria-label="Spot ' + (i + 1) + ', ' +
                SYMBOLS[s] + '. Tap to take it back.">' + symSVG(s) + '</button>').join('') +
            '</span>' + noClue + rest(-1) + '</div>';
        } else {
          h += '<div class="cb-row cb-later"><span class="cb-num">' + (k + 1) + '</span><span class="cb-pegs">' +
            blankRow().map(() => '<span class="cb-peg"></span>').join('') + '</span>' + noClue + rest(-1) + '</div>';
        }
      }
      q('.cb-board').innerHTML = h + '</div>';
      root.classList.toggle('cb-over', S.over);
      root.style.setProperty('--ph-done', boardHeight(S.history.length + 1).toFixed(2));
      fx.fresh = -1; fx.scored = -1; fx.flip = false; fx.nudge = false;
      if (focusSpot >= 0) {
        const slots = host.querySelectorAll('.cb-slot');
        const again = host.querySelector('.cb-slot[data-spot="' + focusSpot + '"]') || slots[slots.length - 1];
        if (again) again.focus(); else stage.focus({ preventScroll: true });
      }
      /* on a screen too short for the whole board, keep the row being filled in view */
      const now = q('.cb-now');
      if (now && stage.scrollHeight > stage.clientHeight + 1) now.scrollIntoView({ block: 'nearest' });
    }
    function renderKeys() {
      const box = q('.cb-keys');
      if (box.children.length === S.L.syms) return;
      box.innerHTML = Array.from({ length: S.L.syms }, (_, s) => '<button class="cb-key" type="button" data-sym="' + s + '" aria-label="' + NAMES[s] + '">' +
        symSVG(s) + '<i aria-hidden="true">' + (s + 1) + '</i></button>').join('');
    }
    function debriefHTML() {
      if (!S.history.length) return '';
      const d = debrief(S.levelId, S.history, S.solved), last = S.history.length - 1;
      const row = (tag, body) => '<div class="cb-tip"><span class="label">' + tag + '</span><span class="cb-tip-body">' + body + '</span></div>';
      let h = '';
      if (d.best >= 0) {
        const r = d.rows[d.best], out = r.before - r.left;
        h += row('Best guess', '<span class="cb-gn">Guess ' + (d.best + 1) + '</span> ruled out <b>' + num(out) + ' of ' + num(r.before) +
          '</b> codes that were left (' + Math.floor(100 * out / r.before) + '%), the biggest share.');
      }
      if (d.settled >= 0 && (d.settled < last || !S.solved)) h += row('One left', 'After guess ' + (d.settled + 1) + ', only one code fit.');
      const broke = d.rows.map((r, k) => r.broke >= 0 ? k : -1).filter(k => k >= 0);
      if (broke.length) {
        const k = broke[0], r = d.rows[k];
        h += row('Clues', '<span class="cb-gn cb-gn-o">' + guessList(broke) + '</span> couldn’t have been the code. If ' + miniRow(S.history[k].guess) +
          ' were the code, guess ' + (r.broke + 1) + ' would have shown ' + clueInline(r.would) + ', not ' + clueInline(S.history[r.broke].clue) + '.');
      } else if (S.history.length > 1) h += row('Clues', 'Every guess fit all the clues before it.');
      return h;
    }
    /* [the big line, the small line under it] */
    function verdict() {
      const n = S.history.length;
      if (S.solved) return ['Cracked in ' + plural(n, 'guess', 'guesses'), S.hints ? 'With ' + plural(S.hints, 'hint', 'hints') : 'No hints'];
      return [n >= S.L.guesses ? 'Out of guesses' : 'Code shown', ''];
    }
    function renderSide() {
      const count = q('.cb-count');
      if (count) { count.hidden = S.over; q('.cb-count-n').textContent = num(S.codes.length); }
      q('.cb-reveal').innerHTML = S.over ? debriefHTML()
        : S.tips.map((t, i) => '<div class="cb-tip cb-hint"><span class="label">Hint ' + (i + 1) + '</span><span class="cb-tip-body">' + tipHTML(t) + '</span></div>').join('');
      q('.cb-keys').hidden = S.over;
      const v = q('.cb-verdict'), w = S.over ? verdict() : ['', ''];
      v.hidden = !S.over;
      v.innerHTML = Lab.esc(w[0]) + (w[1] ? '<span>' + Lab.esc(w[1]) + '</span>' : '');
    }
    function renderActions() {
      const a = document.activeElement, had = a && host.contains(a) && a.dataset ? a.dataset.act : null;
      const btn = (act, label, cls, off) => '<button class="btn' + (cls ? ' ' + cls : '') + '" type="button" data-act="' + act + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
      let h = '';
      if (!S.over) {
        h += btn('hint', 'Hint', '', S.rung >= ladderFor(board, S.history.length).length);
        h += btn('show', 'Show me');
        h += btn('check', 'Check', 'primary cb-go', !full());
      } else h += btn('next', daily ? 'See results' : 'Next code', 'primary cb-go');
      q('.cb-actions').innerHTML = h;
      if (had) {
        const again = q('.cb-actions [data-act="' + had + '"]:not(:disabled)');
        if (again) again.focus(); else stage.focus({ preventScroll: true });
      }
    }
    function syncCheck() { const c = q('[data-act="check"]'); if (c) c.disabled = !full(); }
    function say(text) { q('.cb-sr').textContent = text; }
    function renderAll() { renderMeta(); renderBoard(); renderSide(); renderActions(); }

    /* ---------- saving: the Daily in progress and the Board round, so leaving and coming back picks up there ---------- */
    const dailyWant = () => ({ board: false, level: 'medium', date: S.daily.date });
    const runNow = () => Object.assign(saveRound(S), { date: S.daily.date, ms: Math.min(Math.round(elapsed()), 864e5 - 1) });
    function save() {
      if (daily) {
        if (!S.daily || S.daily.replay || S.over) return;
        /* never write over what another tab saved: merge with it */
        Lab.store.set(RUN, mergeRuns(runNow(), readRun(Lab.store.get(RUN, null), dailyWant())));
      } else if (board) Lab.store.set(BOARD, S.over ? null : Object.assign(saveRound(S), { secret: S.secret.slice(), count: S.count }));
    }
    function resumeBoard() {
      const raw = Lab.store.get(BOARD, null);
      if (raw === null) return false;
      const run = readRun(raw, { board: true });
      const R = run && isCode(raw.secret, LEVELS[run.level]) && isInt(raw.count, 1, 1e6) ? loadRound(run, raw.secret, true) : null;
      if (!R || R.over) { Lab.store.set(BOARD, null); return false; }
      S.count = raw.count;
      begin(R, false);
      return true;
    }

    /* ---------- Daily ---------- */
    /* The clock counts only while the Daily is on screen and the tab is showing; it is saved with the progress. */
    function elapsed() { const d = S.daily; return d ? d.ms + (d.since === null ? 0 : performance.now() - d.since) : 0; }
    function pauseClock() { const d = S.daily; if (d && d.since !== null) { d.ms = elapsed(); d.since = null; } }
    function runClock() { const d = S.daily; if (d && d.since === null && !S.over && document.visibilityState !== 'hidden') d.since = performance.now(); }
    function startDaily(replay) {
      S.daily = { date: ctx.date, code: dailyFor(ctx.date), replay: !!replay, ms: 0, since: null, result: null };
      deal();
      if (!replay) {
        const raw = Lab.store.get(RUN, null), run = raw === null ? null : readRun(raw, dailyWant());
        if (run) adopt(run);
        else if (raw !== null) Lab.store.set(RUN, null); /* another day's, or unreadable */
      }
      runClock();
      renderMeta();
    }
    /* Take on a saved run: this tab's own after a reload, or one another tab got further with. */
    function adopt(run) {
      const entry = S.entry, ms = Math.max(elapsed(), run.ms);
      begin(loadRound(run, S.daily.code, false), false);
      if (entry.length === S.L.len) S.entry = entry;
      S.daily.ms = ms;
      if (S.daily.since !== null) S.daily.since = performance.now();
      if (S.over) endRound(S.solved ? (S.hints ? 'helped' : 'clean') : 'shown');
      renderAll();
    }
    /* Two tabs on one Daily: before acting, take on what the other one saved. Returns true when the other tab
       has already finished it, and this one turns into a replay with the day's result on top. */
    function sync() {
      if (!daily || !S.daily || S.daily.replay || S.over) return false;
      const date = S.daily.date, done = readResult(Lab.store.get(resultKey(date), null), date);
      if (done) { startDaily(true); showResults(done, false); return true; }
      const theirs = readRun(Lab.store.get(RUN, null), dailyWant());
      if (!theirs) return false;
      const mine = runNow(), m = mergeRuns(mine, theirs);
      if (m.guesses.length !== mine.guesses.length || m.hints !== mine.hints || m.rung !== mine.rung || m.facts.length !== mine.facts.length) adopt(m);
      else if (m.ms > mine.ms) { S.daily.ms = m.ms; if (S.daily.since !== null) S.daily.since = performance.now(); }
      return false;
    }
    function finishDaily() {
      const d = S.daily;
      pauseClock();
      d.result = { date: d.date, rows: S.history.map(h => h.clue.slice()), outcome: S.outcome, hints: S.hints,
        ms: Math.min(Math.round(d.ms), 864e5 - 1), len: S.L.len, limit: S.L.guesses };
      if (d.replay) return;
      /* the day's first finish stands: one made in another tab is never overwritten */
      if (readResult(Lab.store.get(resultKey(d.date), null), d.date)) d.replay = true;
      else Lab.store.set(resultKey(d.date), d.result);
      Lab.store.set(RUN, null);
    }
    function markRow(c, len) {
      let h = '';
      for (let i = 0; i < len; i++) h += i < c[0] ? MARK_RIGHT : i < c[0] + c[1] ? MARK_WRONG : MARK_NONE;
      return '<span class="cb-r-marks" role="img" aria-label="' + clueWords(c) + '">' + h + '</span>';
    }
    function showResults(result, replay) {
      const rows = result.rows, won = result.outcome !== 'shown', hints = result.hints;
      const body = '<div class="cb-r-rows">' + rows.map((c, i) => '<div class="cb-r-row' + (won && i === rows.length - 1 ? ' cb-r-win' : '') + '">' +
        '<span class="cb-r-n">' + (i + 1) + '</span>' + markRow(c, result.len) + '</div>').join('') + '</div>';
      const sh = Lab.results({
        game: 'Codebreaker',
        sub: 'Daily · ' + Lab.dateWords(result.date),
        replay: !!replay,
        squares: [result.outcome],
        body,
        stats: [[(won ? rows.length : 'X') + ' of ' + result.limit, 'Guesses'], [Lab.clock(result.ms), 'Time'], [String(hints), hints === 1 ? 'Hint' : 'Hints']]
      }, { done: 'Done', onClose: ctx.home, extra: '<button class="btn" type="button" data-again>Play again</button>' });
      sh.el.querySelector('[data-again]').addEventListener('click', () => { sh.close(true); startDaily(true); });
    }

    /* ---------- setup (Play and Board): only New code applies it; Escape or a tap outside changes nothing ---------- */
    function levelInfo(id) {
      const L = LEVELS[id], ways = [];
      for (let i = 0; i < L.len; i++) ways.push(L.repeats ? L.syms : L.syms - i);
      return miniRow(Array.from({ length: L.syms }, (_, s) => s)) + '<p>' + L.len + ' spots · ' + repeatsText(L) + ' · ' + L.guesses + ' guesses</p>' +
        '<p class="cb-lv-n">' + ways.join(' × ') + ' = <b>' + num(allCodes(id).length) + '</b> possible codes</p>';
    }
    function openSetup() {
      const pick = board ? S.bLevel : S.level;
      let chosen = pick, apply = false;
      const chip = l => '<button class="chip" type="button" data-level="' + l + '" aria-pressed="' + (l === pick) + '">' + LEVELS[l].name + '</button>';
      const sh = Lab.sheet('<h2>Setup</h2><p class="label">Level</p><div class="chips" role="group" aria-label="Level">' + LEVEL_IDS.map(chip).join('') + '</div>' +
        '<div class="cb-lv">' + levelInfo(pick) + '</div>', {
        label: 'Setup', done: 'New code',
        onClose() {
          if (!apply) return;
          if (board) S.bLevel = chosen; else S.level = chosen;
          saveSettings();
          /* as in Make 24: leaving a round that already has guesses ends the streak */
          if (mode === 'play' && !S.over && S.history.length) S.streak = 0;
          deal();
        }
      });
      sh.el.addEventListener('click', e => {
        if (e.target.closest('[data-close]')) { apply = true; return; }
        const c = e.target.closest('.chip');
        if (!c) return;
        chosen = c.dataset.level;
        sh.el.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === c ? 'true' : 'false'));
        sh.el.querySelector('.cb-lv').innerHTML = levelInfo(chosen);
      });
    }

    /* ---------- input ---------- */
    host.addEventListener('click', e => {
      const key = e.target.closest('.cb-key');
      if (key) return place(+key.dataset.sym);
      const slot = e.target.closest('.cb-slot');
      if (slot) return clearSpot(+slot.dataset.spot);
      const a = e.target.closest('[data-act]');
      if (!a || a.disabled) return;
      const act = a.dataset.act;
      if (act === 'check') check();
      else if (act === 'hint') hint();
      else if (act === 'show') askShow();
      else if (act === 'next') next();
      else if (act === 'use') { const t = S.tips.find(x => x.kind === 'guess'); if (t) useGuess(t.guess.code); }
    });
    /* Enter checks the guess (or goes on, once a round is over). A button reached with Tab answers Enter itself;
       a button that was tapped or clicked doesn't keep Enter from checking. Typing a symbol takes focus off any button.
       A held key's repeats are ignored, so holding Enter can't run past the end of a round. */
    let keyNav = false;
    const onPointer = () => { keyNav = false; };
    function typing() {
      const a = document.activeElement;
      if (a && a !== stage && a.tagName === 'BUTTON') stage.focus({ preventScroll: true });
    }
    function onKey(e) {
      if (e.key === 'Tab') { keyNav = true; return; }
      if (Lab.sheetOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      const k = e.key.toLowerCase();
      if (k.length === 1 && k >= '1' && k <= '9') { if (+k > S.L.syms || S.over) return; typing(); place(+k - 1); }
      else if (k === 'backspace' || k === 'delete') {
        if (S.over) return;
        if (!(document.activeElement && document.activeElement.classList.contains('cb-slot'))) typing();
        backspace();
      }
      else if (k === 'enter') {
        if (keyNav && e.target.closest && e.target.closest('button')) return;
        if (!e.repeat) { if (S.over) next(); else check(); }
      }
      else if (k === 'h') { if (!e.repeat) hint(); }
      else if (k === 'n') { if (e.repeat || !S.over) return; next(); }
      else return;
      e.preventDefault();
    }
    function onVisible() {
      if (document.visibilityState === 'hidden') { pauseClock(); save(); }
      else { runClock(); sync(); }
    }
    function onStorage() { if (daily && S.daily && !S.daily.replay && !S.over) sync(); }

    /* ---------- go: nothing saved can keep the game from opening ---------- */
    function go() {
      if (daily) {
        const raw = Lab.store.get(resultKey(ctx.date), null), done = readResult(raw, ctx.date);
        if (!done && raw !== null) Lab.store.set(resultKey(ctx.date), null);
        startDaily(!!done);
        if (done) showResults(done, false);
      } else if (!(board && resumeBoard())) deal();
    }
    try { go(); }
    catch (e) {
      Lab.closeSheet();
      if (daily || board) Lab.store.set(daily ? RUN : BOARD, null);
      try { if (daily) startDaily(!!readResult(Lab.store.get(resultKey(ctx.date), null), ctx.date)); else deal(); } catch (e2) { /* the screen stays as drawn */ }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    if (daily) {
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('storage', onStorage);
      tick = setInterval(() => { if (S.daily && !S.over && !Lab.sheetOpen()) renderMeta(); }, 1000);
    }
    if (!daily) ctx.setDock([{ label: 'Setup', onClick: openSetup }]);

    return {
      unmount() {
        pauseClock(); save();
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('pointerdown', onPointer, true);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('storage', onStorage);
        clearInterval(tick);
      },
      state: S /* for the tests */
    };
  }

  const peg = s => '<span class="cb-art-peg">' + symSVG(s) + '</span>';
  Lab.register({
    id: ID,
    name: 'Codebreaker',
    modes: ['play', 'daily', 'board'],
    accent: ['#F2B640', '#FCEFD0'],
    icon: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="7" fill="#17324D"/><rect x="34" y="2" width="28" height="28" rx="7" fill="#17324D"/>' +
      '<rect x="2" y="34" width="28" height="28" rx="7" fill="#17324D"/><rect x="34" y="34" width="28" height="28" rx="7" fill="#F2B640"/>' +
      '<g stroke-linejoin="round" stroke-width="2"><circle cx="16" cy="16" r="7" fill="#fff"/><path d="M48 8.5 56 22.5H40z" fill="#fff" stroke="#fff"/>' +
      '<path d="M16 39.5 23.5 48 16 56.5 8.5 48z" fill="#fff" stroke="#fff"/>' +
      '<path d="M48 39 50.3 44.8 56.6 45.2 51.7 49.2 53.3 55.3 48 51.9 42.7 55.3 44.3 49.2 39.4 45.2 45.7 44.8z" fill="#17324D" stroke="#17324D"/></g></svg>',
    art: '<div class="cb-art" aria-hidden="true">' + [0, 2, 4].map(peg).join('') + '<span class="cb-art-peg cb-art-hid">?</span></div>',
    howTo: '<h2>How to play</h2><p>Crack the hidden code: a row of symbols.</p>' +
      '<ol><li>Tap symbols to fill the row. Tap one in the row to take it back.</li><li>Tap <b>Check</b>. The clue counts:' +
        '<span class="cb-howto-key"><span>' + MARK_RIGHT + 'right symbol, right spot</span><span>' + MARK_WRONG + 'right symbol, wrong spot</span></span></li></ol>' +
      '<div class="cb-howto-ex"><span class="label">Code</span>' + miniRow([0, 1, 2, 3]) + '<span></span>' +
        '<span class="label">Guess</span>' + miniRow([0, 2, 4, 1]) + clueHTML([1, 2]) + '</div>' +
      '<p>The circle is in the right spot. The triangle and the square are in the code, but in other spots. The star isn’t in the code. The clue only counts: it never says which symbol is which.</p>' +
      '<p>On Medium and Hard, a symbol can be used more than once.</p>' +
      '<p><b>Hint</b> gives you a nudge. <b>Show me</b> shows the code. <b>Daily</b> is one code, the same for everyone today.</p>' +
      '<p class="cb-howto-keys">Keys: <b>1</b>–<b>7</b> symbols · <b>Backspace</b> · <b>Enter</b> check · <b>H</b> hint · <b>N</b> next</p>',
    dailyDone: date => !!readResult(Lab.store.get(resultKey(date), null), date),
    daily: dailyFor,
    mount
  });
})();
