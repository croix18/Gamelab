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
  const codeWords = code => code.map(s => SYMBOLS[s]).join(', ');
  const miniRow = code => '<span class="cb-minis">' + code.map(s => '<span class="cb-mini">' + symSVG(s) + '</span>').join('') + '</span>';
  /* a symbol's name in a sentence, with its shape beside it */
  const nameHTML = (s, many) => '<b class="cb-nm">' + symSVG(s, 'cb-sym-in') + (many ? PLURALS : SYMBOLS)[s] + '</b>';
  const repeatsText = L => L.repeats ? 'Repeats allowed' : 'No repeats';
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  /* The Daily: one Medium code for everyone that day (engine.js dailyCode). */
  const dailyMemo = [];
  const dailyFor = date => dailyCode(date, iso => Lab.dailyRng(ID, iso), dailyMemo);

  /* ---------- one session of a mode ---------- */
  function mount(mode, host, ctx) {
    const saved = Lab.store.get(ID + '.settings', {}) || {};
    const isLevel = l => LEVEL_IDS.indexOf(l) >= 0;
    const board = mode === 'board';
    const S = {
      level: isLevel(saved.level) ? saved.level : 'easy',
      bLevel: isLevel(saved.bLevel) ? saved.bLevel : 'medium',
      L: null, secret: [], history: [], entry: [], codes: [], counts: [],
      rung: 0, hints: 0, facts: [], tips: [],
      over: false, solved: false, outcome: null,
      count: 0, solvedCount: 0, streak: 0, best: +Lab.store.get(ID + '.best', 0) || 0,
      daily: null
    };
    /* one-shot motion: the symbol just placed, the row just scored, the code turning over, a row that isn't full */
    const fx = { fresh: -1, scored: -1, flip: false, nudge: false };
    /* Board always shows how many codes are left, so its ladder starts at the fact */
    const ladder = board ? ['fact', 'guess'] : ['count', 'fact', 'guess'];
    let tick = 0;
    const q = sel => host.querySelector(sel);
    const saveSettings = () => Lab.store.set(ID + '.settings', { level: S.level, bLevel: S.bLevel });
    const blankRow = () => new Array(S.L.len).fill(null);
    const full = () => S.entry.indexOf(null) < 0;

    host.classList.add('cb-host');
    host.innerHTML =
      '<div class="cb cb-m-' + mode + '">' +
        '<section class="card cb-stage" aria-label="Codebreaker" tabindex="-1">' +
          '<div class="cb-top"><p class="label cb-meta"></p></div>' +
          '<div class="cb-main">' +
            '<div class="cb-field"><div class="cb-board"></div></div>' +
            '<div class="cb-side">' +
              (board ? '<div class="cb-count"><p class="label">Codes left</p><p class="cb-count-n"></p></div>' : '') +
              '<div class="cb-legend" aria-hidden="true"><span>' + MARK_RIGHT + 'Right symbol, right spot</span><span>' + MARK_WRONG + 'Right symbol, wrong spot</span></div>' +
              '<div class="cb-reveal" aria-live="polite"></div>' +
              '<div class="cb-grow"></div>' +
              '<div class="cb-keys" role="group" aria-label="Symbols"></div>' +
              '<p class="cb-verdict" hidden></p>' +
            '</div>' +
          '</div>' +
          '<div class="cb-actions"></div>' +
          '<p class="cb-sr" aria-live="polite"></p>' +
        '</section>' +
      '</div>';
    const root = q('.cb'), stage = q('.cb-stage');

    /* ---------- dealing ---------- */
    function deal() {
      const levelId = mode === 'daily' ? 'medium' : board ? S.bLevel : S.level;
      S.L = LEVELS[levelId];
      S.secret = mode === 'daily' ? S.daily.code.slice() : randomCode(levelId, Math.random);
      S.history = []; S.entry = blankRow(); S.codes = allCodes(levelId); S.counts = [S.codes.length];
      S.rung = 0; S.hints = 0; S.facts = []; S.tips = [];
      S.over = false; S.solved = false; S.outcome = null; S.count++;
      fx.fresh = -1; fx.scored = -1; fx.flip = false;
      sizeBoard(); renderKeys(); renderAll();
    }
    /* The board's size in peg widths and heights, for game.css to fit the pegs to the space (it matches the rows' CSS).
       --ph-done is the height of just the code and the guesses made: phones drop the empty rows once a round is over. */
    const rowsHigh = rows => (rows * 1.2 + 0.35).toFixed(2);
    function sizeBoard() {
      const L = S.L;
      const pw = 0.5 + 0.7 + 0.35 + L.len + (L.len - 1) * 0.14 + 0.35 + 2.1 + (board ? 0.35 + 2.6 : 0) + 0.1;
      root.style.setProperty('--pw', pw.toFixed(2));
      root.style.setProperty('--ph-all', rowsHigh(L.guesses + 1));
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
      const guess = S.entry.slice(), clue = score(S.secret, guess);
      S.history.push({ guess, clue });
      S.codes = filterCodes(S.codes, guess, clue);
      S.counts.push(S.codes.length);
      S.entry = blankRow(); S.rung = 0; S.tips = [];
      fx.scored = S.history.length - 1; fx.fresh = -1;
      say('Guess ' + S.history.length + ': ' + clueWords(clue) + '.');
      if (clue[0] === S.L.len) { S.solved = true; Lab.sound.play('solve'); endRound(S.hints ? 'helped' : 'clean'); }
      else if (S.history.length >= S.L.guesses) endRound('shown');
      else { Lab.sound.play('step'); saveRun(); }
      renderAll();
    }

    /* ---------- the end of a round: cracked, out of guesses, or shown ---------- */
    function endRound(outcome) {
      S.over = true; S.tips = []; fx.flip = true;
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
      if (mode === 'daily') finishDaily();
    }
    function show() {
      if (S.over) return;
      endRound('shown');
      renderAll();
    }
    /* On the day's Daily, Show me ends the Daily for good, so it asks first. */
    function askShow() {
      if (S.over) return;
      if (mode !== 'daily' || S.daily.replay) return show();
      const sh = Lab.sheet('<h2>Show the code?</h2><p>That ends today’s Daily, and it counts as shown.</p>',
        { label: 'Show the code', done: 'Keep playing', extra: '<button class="btn" type="button" data-show>Show the code</button>' });
      sh.el.querySelector('[data-show]').addEventListener('click', () => { sh.close(true); show(); });
    }
    function next() {
      if (!S.over) return;
      if (mode === 'daily') return showResults(S.daily.result, S.daily.replay);
      deal();
    }

    /* ---------- hints: how many codes fit, then a fact the clues prove, then a strong guess ---------- */
    function hint() {
      if (S.over || S.rung >= ladder.length) return;
      const kind = ladder[S.rung++];
      S.hints++;
      const tip = { kind };
      if (kind === 'fact' && S.history.length) {
        tip.fact = pickFact(S.codes, S.L.id, S.history, S.facts);
        if (tip.fact) S.facts.push(tip.fact);
      }
      if (kind === 'guess') tip.guess = strongGuess(S.codes, S.L.id, S.history);
      S.tips.push(tip);
      saveRun();
      renderSide(); renderActions();
    }
    function tipHTML(t) {
      const n = S.codes.length;
      if (t.kind === 'count') {
        if (!S.history.length) return 'Any of the <b>' + num(n) + '</b> codes could be the one.';
        return n === 1 ? 'Only <b>1</b> code fits every clue.' : '<b>' + num(n) + '</b> codes still fit every clue.';
      }
      if (t.kind === 'fact') {
        if (!S.history.length) return 'No clues yet, so any guess is a good start.';
        return t.fact ? factText(t.fact, S.L.id, nameHTML) : 'Make your next guess fit every clue so far.';
      }
      const g = t.guess, lead = n === 1 ? 'It has to be' : S.history.length ? 'Try' : 'A strong start';
      const note = n === 1 ? '' : g.worst === 1 ? 'Whatever the clue, you’ll know the code after it.' :
        'Whatever the clue, no more than <b>' + num(g.worst) + '</b> codes will be left.';
      return '<span class="cb-try">' + lead + miniRow(g.code) + '<button class="mini" type="button" data-act="use">Use it</button></span>' +
        (note ? '<span class="cb-note">' + note + '</span>' : '');
    }

    /* ---------- rendering ---------- */
    function renderMeta() {
      const L = S.L, bits = [];
      if (mode === 'daily') {
        bits.push('Daily');
        if (S.daily.replay) bits.push('Replay');
        bits.push(L.name, repeatsText(L), Lab.clock((S.daily.end || Date.now()) - S.daily.start));
      } else if (mode === 'play') bits.push(L.name, repeatsText(L), 'Solved ' + S.solvedCount, 'Streak ' + S.streak);
      else bits.push('Code ' + S.count, L.name, repeatsText(L));
      q('.cb-meta').textContent = bits.join(' · ');
    }
    function renderBoard() {
      const L = S.L, a = document.activeElement;
      const focusSpot = a && a.classList && a.classList.contains('cb-slot') && host.contains(a) ? +a.dataset.spot : -1;
      const d = S.over && S.history.length ? debrief(L.id, S.history, S.solved) : null;
      let h = '<div class="cb-rows">';
      h += '<div class="cb-row cb-code"><span class="cb-num"></span>' +
        '<span class="cb-pegs" role="img" aria-label="' + (S.over ? 'The code: ' + codeWords(S.secret) : 'The hidden code') + '">' +
        S.secret.map((s, i) => S.over
          ? '<span class="cb-peg cb-shown' + (fx.flip ? ' cb-flip' : '') + '" style="--i:' + i + '">' + symSVG(s) + '</span>'
          : '<span class="cb-peg cb-hid">?</span>').join('') + '</span></div>';
      for (let k = 0; k < L.guesses; k++) {
        const g = S.history[k];
        if (g) {
          const cls = (k === fx.scored ? ' cb-in' : '') + (S.solved && k === S.history.length - 1 ? ' cb-win' : '') +
            (d && d.best === k ? ' cb-best' : '') + (d && d.rows[k].broke >= 0 ? ' cb-broke' : '');
          h += '<div class="cb-row cb-done' + cls + '"><span class="cb-num">' + (k + 1) + '</span>' +
            '<span class="cb-pegs" role="img" aria-label="Guess ' + (k + 1) + ': ' + codeWords(g.guess) + '">' +
            g.guess.map(s => '<span class="cb-peg">' + symSVG(s) + '</span>').join('') + '</span>' +
            clueHTML(g.clue) + (board ? '<span class="cb-rest"><b>' + num(S.counts[k + 1]) + '</b> left</span>' : '') + '</div>';
        } else if (k === S.history.length && !S.over) {
          const nextSpot = S.entry.indexOf(null);
          h += '<div class="cb-row cb-now' + (fx.nudge ? ' cb-shake' : '') + '"><span class="cb-num">' + (k + 1) + '</span><span class="cb-pegs">' +
            S.entry.map((s, i) => s === null
              ? '<span class="cb-peg cb-empty' + (i === nextSpot ? ' cb-next' : '') + '"></span>'
              : '<button class="cb-peg cb-slot' + (i === fx.fresh ? ' cb-pop' : '') + '" type="button" data-spot="' + i + '" aria-label="Spot ' + (i + 1) + ', ' +
                SYMBOLS[s] + '. Tap to take it back.">' + symSVG(s) + '</button>').join('') +
            '</span></div>';
        } else {
          h += '<div class="cb-row cb-later"><span class="cb-num">' + (k + 1) + '</span><span class="cb-pegs">' +
            blankRow().map(() => '<span class="cb-peg"></span>').join('') + '</span></div>';
        }
      }
      q('.cb-board').innerHTML = h + '</div>';
      root.classList.toggle('cb-over', S.over);
      root.style.setProperty('--ph-done', rowsHigh(S.history.length + 1));
      fx.fresh = -1; fx.scored = -1; fx.flip = false; fx.nudge = false;
      if (focusSpot >= 0) {
        const slots = host.querySelectorAll('.cb-slot');
        const again = host.querySelector('.cb-slot[data-spot="' + focusSpot + '"]') || slots[slots.length - 1];
        if (again) again.focus(); else stage.focus({ preventScroll: true });
      }
    }
    function renderKeys() {
      const box = q('.cb-keys');
      if (box.children.length === S.L.syms) return;
      box.style.setProperty('--syms', S.L.syms);
      box.innerHTML = Array.from({ length: S.L.syms }, (_, s) => '<button class="cb-key" type="button" data-sym="' + s + '" aria-label="' + NAMES[s] + '">' +
        symSVG(s) + '<i aria-hidden="true">' + (s + 1) + '</i></button>').join('');
    }
    function debriefHTML() {
      if (!S.history.length) return '';
      const d = debrief(S.L.id, S.history, S.solved);
      const row = (tag, body) => '<div class="cb-tip"><span class="label">' + tag + '</span><span class="cb-tip-body">' + body + '</span></div>';
      let h = row('Codes left', '<span class="cb-chain">' + [d.total].concat(d.rows.map(r => r.left)).map(n => '<span class="cb-step">' + num(n) + '</span>')
        .join('<span class="cb-arrow" aria-hidden="true">→</span>') + '</span>');
      if (d.best >= 0) {
        const r = d.rows[d.best], out = r.before - r.left;
        h += row('Best guess', '<span class="cb-gn">Guess ' + (d.best + 1) + '</span> ruled out <b>' + num(out) + ' of ' + num(r.before) + '</b> codes (' +
          Math.floor(100 * out / r.before) + '%), the biggest share of any guess.');
      }
      const broke = d.rows.map((r, k) => ({ k, j: r.broke })).filter(x => x.j >= 0);
      if (broke.length) h += row('Broke a clue', broke.map(x => '<span class="cb-gn cb-gn-o">Guess ' + (x.k + 1) + '</span> couldn’t have been the code. It didn’t fit the clue from guess ' + (x.j + 1) + '.').join('<br>'));
      else if (S.history.length > 1) h += row('Clues', 'Every guess fit all the clues before it.');
      return h;
    }
    /* [the big line, the small line under it] */
    function verdict() {
      const n = S.history.length;
      if (S.solved) return ['Cracked in ' + plural(n, 'guess', 'guesses'), S.hints ? 'With ' + plural(S.hints, 'hint', 'hints') : 'No hints'];
      return [n >= S.L.guesses ? 'Out of guesses' : 'Code shown', ''];
    }
    function renderSide() {
      if (board) q('.cb-count-n').textContent = num(S.codes.length);
      q('.cb-reveal').innerHTML = S.over ? debriefHTML()
        : S.tips.map((t, i) => '<div class="cb-tip cb-hint"><span class="label">Hint ' + (i + 1) + '</span><span class="cb-tip-body">' + tipHTML(t) + '</span></div>').join('');
      q('.cb-keys').hidden = S.over;
      const v = q('.cb-verdict');
      v.hidden = !S.over;
      const w = S.over ? verdict() : ['', ''];
      v.innerHTML = Lab.esc(w[0]) + (w[1] ? '<span>' + Lab.esc(w[1]) + '</span>' : '');
    }
    function renderActions() {
      const a = document.activeElement, had = a && host.contains(a) && a.dataset ? a.dataset.act : null;
      const btn = (act, label, cls, off) => '<button class="btn' + (cls ? ' ' + cls : '') + '" type="button" data-act="' + act + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
      let h = '';
      if (!S.over) {
        h += btn('hint', 'Hint', '', S.rung >= ladder.length);
        h += btn('show', 'Show me');
        h += btn('check', 'Check', 'primary cb-go', !full());
      } else h += btn('next', mode === 'daily' ? 'See results' : 'Next code', 'primary cb-go');
      q('.cb-actions').innerHTML = h;
      if (had) {
        const again = q('.cb-actions [data-act="' + had + '"]:not(:disabled)');
        if (again) again.focus(); else stage.focus({ preventScroll: true });
      }
    }
    function syncCheck() { const c = q('[data-act="check"]'); if (c) c.disabled = !full(); }
    function say(text) { q('.cb-sr').textContent = text; }
    function renderAll() { renderMeta(); renderBoard(); renderSide(); renderActions(); }

    /* ---------- Daily ---------- */
    const doneKey = date => ID + '.daily.' + date;
    const RUN = ID + '.run'; /* today's Daily in progress: leaving and coming back picks up where you were */
    function startDaily(replay) {
      S.daily = { date: ctx.date, code: dailyFor(ctx.date), replay: !!replay, start: Date.now(), end: 0, result: null };
      deal();
      if (!replay) resume();
    }
    function resume() {
      const run = Lab.store.get(RUN, null);
      if (!run || run.date !== S.daily.date || !Array.isArray(run.guesses)) return;
      const ok = g => Array.isArray(g) && g.length === S.L.len && g.every(s => s === (s | 0) && s >= 0 && s < S.L.syms);
      for (const guess of run.guesses.filter(ok).slice(0, S.L.guesses)) {
        const clue = score(S.secret, guess);
        S.history.push({ guess: guess.slice(), clue });
        S.codes = filterCodes(S.codes, guess, clue);
        S.counts.push(S.codes.length);
        if (clue[0] === S.L.len) break;
      }
      S.hints = Math.max(0, run.hints | 0);
      S.facts = Array.isArray(run.facts) ? run.facts.filter(f => f && typeof f.kind === 'string') : [];
      S.daily.start = Date.now() - Math.max(0, +run.ms || 0);
      const last = S.history[S.history.length - 1];
      if (last && last.clue[0] === S.L.len) { S.solved = true; endRound(S.hints ? 'helped' : 'clean'); }
      else if (S.history.length >= S.L.guesses) endRound('shown');
      renderAll();
    }
    function saveRun() {
      if (mode !== 'daily' || S.daily.replay || S.over) return;
      Lab.store.set(RUN, { date: S.daily.date, guesses: S.history.map(h => h.guess), hints: S.hints, facts: S.facts, ms: Date.now() - S.daily.start });
    }
    function finishDaily() {
      const d = S.daily;
      d.end = Date.now();
      d.result = { date: d.date, rows: S.history.map(h => h.clue), outcome: S.outcome, hints: S.hints, ms: d.end - d.start, len: S.L.len, limit: S.L.guesses };
      if (d.replay) return;
      /* the day's first finish stands: one made in another tab is never overwritten */
      if (Lab.store.get(doneKey(d.date), null)) d.replay = true;
      else Lab.store.set(doneKey(d.date), d.result);
      Lab.store.set(RUN, null);
    }
    function markRow(c, len) {
      let h = '';
      for (let i = 0; i < len; i++) h += i < c[0] ? MARK_RIGHT : i < c[0] + c[1] ? MARK_WRONG : MARK_NONE;
      return '<span class="cb-r-marks" role="img" aria-label="' + clueWords(c) + '">' + h + '</span>';
    }
    function showResults(result, replay) {
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const len = result.len || LEVELS.medium.len, won = result.outcome !== 'shown', hints = result.hints || 0;
      const body = '<div class="cb-r-rows">' + rows.map((c, i) => '<div class="cb-r-row' + (won && i === rows.length - 1 ? ' cb-r-win' : '') + '">' +
        '<span class="cb-r-n">' + (i + 1) + '</span>' + markRow(c, len) + '</div>').join('') + '</div>';
      const sh = Lab.results({
        game: 'Codebreaker',
        sub: 'Daily · ' + Lab.dateWords(result.date) + (replay ? ' · replay' : ''),
        squares: [['clean', 'helped', 'shown'].indexOf(result.outcome) >= 0 ? result.outcome : 'shown'],
        body,
        stats: [[(won ? rows.length : 'X') + ' of ' + (result.limit || LEVELS.medium.guesses), 'Guesses'], [Lab.clock(result.ms || 0), 'Time'],
          [String(hints), hints === 1 ? 'Hint' : 'Hints']]
      }, { done: 'Done', onClose: ctx.home, extra: '<button class="btn" type="button" data-again>Play again</button>' });
      sh.el.querySelector('[data-again]').addEventListener('click', () => { sh.close(true); startDaily(true); });
    }

    /* ---------- setup (Play and Board) ---------- */
    function levelInfo(id) {
      const L = LEVELS[id];
      return miniRow(Array.from({ length: L.syms }, (_, s) => s)) +
        '<p>' + L.len + ' spots · ' + repeatsText(L) + ' · ' + L.guesses + ' guesses · ' + num(allCodes(id).length) + ' possible codes</p>';
    }
    function openSetup() {
      const pick = board ? S.bLevel : S.level;
      let chosen = pick;
      const chip = l => '<button class="chip" type="button" data-level="' + l + '" aria-pressed="' + (l === pick) + '">' + LEVELS[l].name + '</button>';
      const sh = Lab.sheet('<h2>Setup</h2><p class="label">Level</p><div class="chips" role="group" aria-label="Level">' + LEVEL_IDS.map(chip).join('') + '</div>' +
        '<div class="cb-lv">' + levelInfo(pick) + '</div>', {
        label: 'Setup',
        onClose() {
          if (chosen === pick) return;
          if (board) S.bLevel = chosen; else S.level = chosen;
          saveSettings();
          if (mode === 'play' && !S.over && S.history.length) S.streak = 0;
          deal();
        }
      });
      sh.el.addEventListener('click', e => {
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
       a button that was tapped or clicked doesn't keep Enter from checking. Typing a symbol takes focus off any button. */
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
        if (S.over) next(); else check();
      }
      else if (k === 'h') hint();
      else if (k === 'n') { if (!S.over) return; next(); }
      else return;
      e.preventDefault();
    }
    function onHide() { if (document.visibilityState === 'hidden') saveRun(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    if (mode === 'daily') {
      document.addEventListener('visibilitychange', onHide);
      tick = setInterval(() => { if (S.daily && !S.over && !Lab.sheetOpen()) renderMeta(); }, 1000);
    }
    if (mode !== 'daily') ctx.setDock([{ label: 'Setup', onClick: openSetup }]);

    /* ---------- go ---------- */
    if (mode === 'daily') {
      const done = Lab.store.get(doneKey(ctx.date), null);
      startDaily(!!done);
      if (done && Array.isArray(done.rows)) showResults(done, false);
    } else deal();

    return {
      unmount() {
        saveRun();
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('pointerdown', onPointer, true);
        document.removeEventListener('visibilitychange', onHide);
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
    dailyDone: date => !!Lab.store.get(ID + '.daily.' + date, null),
    daily: dailyFor,
    mount
  });
})();
