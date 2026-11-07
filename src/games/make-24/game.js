/* ===== Make 24: the Game Lab edition =====
   Play, Daily and Board on the board version's engine (engine.js: solve, generate, DECKS).
   Scaled back from the board version on purpose: no teams, no print sets, no typed-in hands. */
(function () {
  'use strict';
  const ID = 'make-24';
  const MINUS = '−';
  const OPCH = { '+': '+', '-': MINUS, '*': '×', '/': '÷' };
  const OP_WORD = { '+': 'Add', '-': 'Subtract', '*': 'Multiply', '/': 'Divide' };
  const DECK_ORDER = ['classic', 'thirteen', 'integers', 'fractions', 'decimals', 'powers', 'negpowers'];
  /* The Daily: five puzzles, easy to hard, the same for everyone that day. */
  const DAILY = [['classic', 'easy'], ['classic', 'medium'], ['thirteen', 'medium'], ['integers', 'medium'], ['fractions', 'medium']];
  const TIMES = [[0, 'Off'], [30, '0:30'], [60, '1:00'], [120, '2:00'], [180, '3:00']];
  const esc = Lab.esc;

  /* ---------- showing numbers (carried over from the board version) ---------- */
  function decText(v) { return (v.n / v.d).toFixed(6).replace(/0+$/, '').replace(/\.$/, ''); }
  function asDecimal(v, mode) { return mode === 'dec' && isTerminating(v) && decText(v).length <= 7; }
  function valHTML(v, mode) {
    const neg = v.n < 0 ? '<span class="neg">' + MINUS + '</span>' : '';
    if (v.d === 1) return neg + Math.abs(v.n);
    if (asDecimal(v, mode)) return neg + decText(v).replace('-', '');
    return neg + '<span class="fr"><span>' + Math.abs(v.n) + '</span><span>' + v.d + '</span></span>';
  }
  function valText(v, mode) {
    const neg = v.n < 0 ? 'negative ' : '';
    if (v.d === 1) return neg + Math.abs(v.n);
    if (asDecimal(v, mode)) return neg + decText(v).replace('-', '');
    return neg + Math.abs(v.n) + ' over ' + v.d;
  }
  function valSize(v, mode) {
    let len;
    if (v.d === 1) len = String(v.n).length;
    else if (asDecimal(v, mode)) len = decText(v).length;
    else len = Math.max(String(Math.abs(v.n)).length, String(v.d).length) + (v.n < 0 ? 1 : 0);
    return len <= 2 ? '' : len === 3 ? '3' : len === 4 ? '4' : '5';
  }
  const cardMode = c => c.form === 'dec' ? 'dec' : 'frac';
  function modeOf(p) { return p.cards.some(c => c.form === 'dec') && !p.cards.some(c => c.form === 'frac') ? 'dec' : 'frac'; }
  /* A power card shows as written (2 with a small -3), not as its value. */
  const plainBase = b => b.d === 1 && b.n >= 0;
  function cardHTML(c) {
    if (c.form !== 'pow') return valHTML(c.v, cardMode(c));
    const base = plainBase(c.base) ? String(c.base.n) : '(' + valHTML(c.base, 'frac') + ')';
    return '<span class="pw">' + base + '<sup class="ex">' + (c.exp < 0 ? '<span class="neg">' + MINUS + '</span>' : '') + Math.abs(c.exp) + '</sup></span>';
  }
  function cardText(c) {
    if (c.form !== 'pow') return valText(c.v, cardMode(c));
    return valText(c.base, 'frac') + ' to the power ' + (c.exp < 0 ? 'negative ' : '') + Math.abs(c.exp);
  }
  function cardSize(c) {
    if (c.form !== 'pow') return valSize(c.v, cardMode(c));
    const b = c.base, digits = n => String(Math.abs(n)).length;
    const baseW = plainBase(b) ? digits(b.n) : b.d === 1 ? digits(b.n) + 1.3 : 0.64 * Math.max(digits(b.n), digits(b.d)) + 1.9 + (b.n < 0 ? 0.5 : 0);
    const w = baseW + 0.5 * (String(Math.abs(c.exp)).length + (c.exp < 0 ? 1 : 0));
    return w <= 2.3 ? '' : w <= 3.2 ? '3' : w <= 4.2 ? '4' : '5';
  }
  const isPow = (n, p) => n.leaf !== undefined && p.cards[n.leaf].form === 'pow';
  const nodeHTML = (n, p) => n.leaf !== undefined ? cardHTML(p.cards[n.leaf]) : valHTML(n.v, p.mode);
  const nodeText = (n, p) => n.leaf !== undefined ? cardText(p.cards[n.leaf]) : valText(n.v, p.mode);
  const nodeSize = (n, p) => n.leaf !== undefined ? cardSize(p.cards[n.leaf]) : valSize(n.v, p.mode);
  function powerFacts(p) {
    const seen = new Set(), out = [];
    p.cards.forEach(c => { if (c.form === 'pow' && !seen.has(c.text)) { seen.add(c.text); out.push(cardHTML(c) + ' = ' + valHTML(c.v, 'frac')); } });
    return out;
  }
  /* One tidy expression for a whole solution, e.g. (9 − 1) × 3 */
  function exprHTML(node, p) {
    return (function show(c, lead) {
      if (c.t === 'L') { const h = nodeHTML({ leaf: c.leaf }, p); return (c.v.n < 0 && !lead && !isPow(c, p)) ? '(' + h + ')' : h; }
      const sum = c.t === 'S';
      let out = '';
      c.up.forEach((x, i) => {
        let h = show(x, i === 0 && (sum || lead));
        if (!sum && x.t === 'S') h = '(' + h + ')';
        out += (i ? (sum ? ' + ' : ' ' + OPCH['*'] + ' ') : '') + h;
      });
      c.down.forEach(x => {
        let h = show(x, false);
        if (!sum && x.t === 'S') h = '(' + h + ')';
        out += (sum ? ' ' + MINUS + ' ' : ' ' + OPCH['/'] + ' ') + h;
      });
      return out;
    })(canon(node), true);
  }
  function operandHTML(n, p, right) { const h = nodeHTML(n, p); return (right && n.v.n < 0 && !isPow(n, p)) ? '(' + h + ')' : h; }
  function stepHTML(s, p, withResult) {
    return operandHTML(s.a, p, false) + ' ' + OPCH[s.op] + ' ' + operandHTML(s.b, p, true) + (withResult ? ' = ' + valHTML(s.v, p.mode) : '');
  }
  /* Another way: answers that differ only by a × 1, ÷ 1, + 0 or − 0 count as the same way. */
  function looseKey(c) {
    if (c.t === 'L') return c.key;
    const ident = c.t === 'S' ? '0' : '1';
    const up = c.up.map(looseKey), down = c.down.map(looseKey).filter(k => k !== ident);
    const upKept = up.filter(k => k !== ident);
    return c.t + '(' + (upKept.length ? upKept : up).sort().join(',') + '|' + down.sort().join(',') + ')';
  }
  function waysOf(p) {
    if (p.ways) return p.ways;
    const seen = new Set(), out = [];
    p.result.solutions.forEach(s => { const k = looseKey(s.canon); if (!seen.has(k)) { seen.add(k); out.push(s); } });
    return (p.ways = out);
  }
  /* The hint ladder: the powers (if any), then the last move, then the first move. Show me gives the rest. */
  function hintList(p) {
    const steps = stepsOf(p.result.solutions[0].tree), facts = powerFacts(p), list = [];
    if (facts.length) list.push('Work out the ' + (facts.length === 1 ? 'power' : 'powers') + ' first: ' + facts.map(f => '<b>' + f + '</b>').join(' and ') + '.');
    list.push('Finish with <b>' + stepHTML(steps[steps.length - 1], p, false) + '</b>.');
    list.push('Start with <b>' + stepHTML(steps[0], p, true) + '</b>.');
    return list;
  }

  /* The day's five puzzles: the same on every device that day. */
  function dailyPuzzles(date) {
    const rnd = Lab.dailyRng(ID, date), avoid = new Set();
    return DAILY.map(([deckId, level]) => { const p = generate(deckId, level, avoid, rnd); avoid.add(p.key); return p; });
  }

  /* ---------- one session of a mode ---------- */
  function mount(mode, host, ctx) {
    const saved = Lab.store.get(ID + '.settings', {}) || {};
    const S = {
      deck: DECKS[saved.deck] ? saved.deck : 'classic',
      level: ['easy', 'medium', 'hard'].indexOf(saved.level) >= 0 ? saved.level : 'easy',
      bDeck: DECKS[saved.bDeck] ? saved.bDeck : 'classic',
      bLevel: ['easy', 'medium', 'hard', 'mixed'].indexOf(saved.bLevel) >= 0 ? saved.bLevel : 'mixed',
      timerDur: TIMES.some(t => t[0] === saved.timerDur) ? saved.timerDur : 60,
      P: null, tiles: [], history: [], log: [], sel: null, op: null, msg: null, solved: false, fresh: -1, shake: -1,
      hint: 0, shown: false, way: 0, outcome: null,
      count: 0, recent: [], solvedCount: 0, streak: 0, best: +Lab.store.get(ID + '.best', 0) || 0,
      daily: null
    };
    let nextId = 10, tick = 0;
    const timer = { left: 0, running: false, endAt: 0, up: false };
    const q = sel => host.querySelector(sel);
    const saveSettings = () => Lab.store.set(ID + '.settings', { deck: S.deck, level: S.level, bDeck: S.bDeck, bLevel: S.bLevel, timerDur: S.timerDur });

    host.innerHTML =
      '<div class="m24 m24-' + mode + '">' +
        '<section class="card stage" aria-label="Puzzle">' +
          '<div class="stage-top"><p class="label meta"></p>' + (mode === 'daily' ? '<div class="dots" role="img" aria-label="Progress"></div>' : '') + '</div>' +
          '<div class="play"><div class="tiles"></div>' +
            '<div class="ops">' + ['+', '-', '*', '/'].map(o => '<button class="op" type="button" data-op="' + o + '" aria-pressed="false" aria-label="' + OP_WORD[o] + '">' + OPCH[o] + '</button>').join('') + '</div>' +
            '<div class="work" aria-live="polite"></div>' +
          '</div>' +
          '<div class="grow"></div>' +
          '<div class="reveal" aria-live="polite"></div>' +
          '<div class="actions"></div>' +
        '</section>' +
        (mode === 'board' ? '<aside class="side" aria-label="Timer"><section class="card timer"><div class="clock">1:00</div><div class="bar"><i></i></div>' +
          '<div class="timer-btns"><button class="btn primary" type="button" data-act="timer">Start</button><button class="btn" type="button" data-act="treset">Reset</button></div></section></aside>' : '') +
      '</div>';

    /* ---------- dealing ---------- */
    function freshWork() {
      S.tiles = S.P.cards.map((c, i) => ({ id: i, node: { v: c.v, leaf: i } }));
      S.history = []; S.log = []; S.sel = null; S.op = null; S.msg = null; S.solved = false; S.fresh = -1; S.shake = -1;
    }
    function deal() {
      let p;
      if (mode === 'daily') p = S.daily.puzzles[S.daily.i];
      else {
        const deckId = mode === 'board' ? S.bDeck : S.deck, level = mode === 'board' ? S.bLevel : S.level;
        p = generate(deckId, level, new Set(S.recent)) || generate(deckId, level);
        S.recent.push(p.key); if (S.recent.length > 60) S.recent.shift();
      }
      p.mode = modeOf(p);
      S.P = p; S.count++;
      S.hint = 0; S.shown = false; S.way = 0; S.outcome = null;
      freshWork();
      if (mode === 'board') timerReset();
      renderAll();
    }

    /* ---------- playing ---------- */
    function tapTile(i) {
      if (S.solved || !S.tiles[i]) return;
      S.msg = null; S.fresh = -1; S.shake = -1;
      if (S.sel === null) S.sel = i;
      else if (S.sel === i) S.sel = null;
      else if (S.op) return combine(S.sel, S.op, i);
      else S.sel = i;
      renderPlay();
    }
    function tapOp(op) {
      if (S.solved) return;
      S.op = S.op === op ? null : op;
      S.msg = null; S.fresh = -1; S.shake = -1;
      renderPlay();
    }
    function combine(i, op, j) {
      const a = S.tiles[i].node, b = S.tiles[j].node;
      const v = apply(op, a.v, b.v);
      if (!v) { S.msg = "You can't divide by zero."; S.shake = j; renderPlay(); return; }
      S.history.push(S.tiles.slice());
      S.log.push({ op, a, b, v });
      const made = { id: nextId++, node: { v, op, l: a, r: b } };
      const jj = j > i ? j - 1 : j;
      S.tiles = S.tiles.filter((_, k) => k !== i);
      S.tiles[jj] = made;
      S.fresh = jj; S.op = null;
      S.sel = S.tiles.length > 1 ? jj : null;
      if (S.tiles.length === 1 && v.n === TARGET && v.d === 1) { S.solved = true; solvedNow(); }
      else Lab.sound.play('step');
      renderPlay(); renderReveal(); renderActions(); renderMeta();
    }
    function undo() {
      if (!S.history.length || S.solved) return;
      S.tiles = S.history.pop(); S.log.pop();
      S.sel = null; S.op = null; S.msg = null; S.fresh = -1; S.shake = -1;
      renderPlay();
    }
    function startOver() {
      if (S.solved || (!S.history.length && S.sel === null && !S.op)) return;
      freshWork(); renderPlay();
    }

    /* A puzzle's outcome is decided once: the first of solving it or asking to be shown. */
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
      if (mode === 'daily') { S.daily.results[S.daily.i] = { status: outcome, hints: S.hint }; renderDots(); }
    }
    function solvedNow() {
      Lab.sound.play('solve');
      if (mode === 'board') timerPause();
      settle(S.shown ? 'shown' : S.hint ? 'helped' : 'clean');
    }
    function hint() {
      if (S.shown || S.solved || S.hint >= hintList(S.P).length) return;
      S.hint++;
      renderReveal(); renderActions();
    }
    function show() {
      if (mode === 'board' && S.shown) { S.shown = false; renderReveal(); renderActions(); return; }
      if (S.shown) return;
      S.shown = true;
      if (!S.solved) settle('shown');
      if (mode === 'board') timerPause();
      renderReveal(); renderActions(); renderMeta();
    }
    /* the ways worth showing next: not the answer already on screen, and not the student's own way */
    function otherWays() {
      const ways = waysOf(S.P);
      const mine = S.solved ? looseKey(canon(S.tiles[0].node)) : null;
      return ways.filter((w, i) => !(S.shown && i === 0) && looseKey(w.canon) !== mine);
    }
    function anotherWay() {
      const n = otherWays().length;
      if (!n) return;
      S.way = S.way % n + 1;
      renderReveal(); renderActions();
    }
    function next() {
      if (mode === 'daily') {
        if (!S.outcome) return;
        if (S.daily.i >= S.daily.puzzles.length - 1) return finishDaily();
        S.daily.i++;
        deal();
        return;
      }
      if (mode === 'play' && !S.outcome) return;
      deal();
      if (mode === 'board' && S.timerDur) timerStart();
    }

    /* ---------- rendering ---------- */
    function renderMeta() {
      const p = S.P, bits = [];
      if (mode === 'daily') bits.push('Daily', 'Puzzle ' + (S.daily.i + 1) + ' of ' + S.daily.puzzles.length, LEVEL_NAME[p.level], Lab.clock(Date.now() - S.daily.start));
      else if (mode === 'play') bits.push(DECKS[S.deck].name, LEVEL_NAME[p.level], 'Solved ' + S.solvedCount, 'Streak ' + S.streak);
      else bits.push('Puzzle ' + S.count, DECKS[S.bDeck].name, LEVEL_NAME[p.level]);
      q('.meta').textContent = bits.join(' · ');
    }
    function renderDots() {
      const box = q('.dots');
      if (!box) return;
      box.innerHTML = S.daily.puzzles.map((_, i) => {
        const r = S.daily.results[i];
        return '<span class="dot' + (r ? ' ' + r.status : i === S.daily.i ? ' now' : '') + '"></span>';
      }).join('');
    }
    function renderPlay() {
      const box = q('.tiles'), P = S.P;
      const focusAt = Array.prototype.indexOf.call(box.children, document.activeElement);
      box.innerHTML = '';
      const last = S.tiles.length === 1;
      const showValues = S.shown || S.hint >= 1;
      S.tiles.forEach((t, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        const made = t.node.leaf === undefined;
        b.className = 'tile' + (made ? ' made' : '') + (S.sel === i ? ' sel' : '') + (S.fresh === i ? ' isNew' : '') + (S.shake === i ? ' shake' : '') + (last && S.solved ? ' win' : '');
        const size = nodeSize(t.node, P); if (size) b.dataset.size = size;
        b.setAttribute('aria-pressed', S.sel === i ? 'true' : 'false');
        b.setAttribute('aria-label', nodeText(t.node, P));
        const note = made ? (last ? '' : exprHTML(t.node, P)) : (showValues && isPow(t.node, P) ? '= ' + valHTML(t.node.v, 'frac') : '');
        b.innerHTML = '<span>' + nodeHTML(t.node, P) + '</span>' + (note ? '<span class="tile-note">' + note + '</span>' : '');
        b.addEventListener('click', () => tapTile(i));
        box.appendChild(b);
      });
      if (focusAt >= 0 && box.children.length) box.children[Math.min(S.sel !== null ? S.sel : focusAt, box.children.length - 1)].focus();
      host.querySelectorAll('.op').forEach(b => { b.setAttribute('aria-pressed', b.dataset.op === S.op ? 'true' : 'false'); b.disabled = S.solved; });

      let h = '';
      if (S.msg) h += '<div class="warn"><span>' + S.msg + '</span></div>';
      if (!S.log.length && !S.msg) h += '<span class="tip">Use all four numbers once to make 24.</span>';
      S.log.forEach(s => { h += '<span class="step">' + stepHTML(s, P, true) + '</span>'; });
      if (S.log.length && !S.solved) h += '<button class="mini" type="button" data-act="undo">Undo</button>';
      if (S.log.length > 1 && !S.solved) h += '<button class="mini" type="button" data-act="over">Start over</button>';
      if (last) {
        const n = S.tiles[0].node;
        h += S.solved
          ? '<div class="verdict good">' + exprHTML(n, P) + ' = 24</div>'
          : '<div class="verdict">That makes ' + valHTML(n.v, P.mode) + ', not 24.</div>';
      }
      q('.work').innerHTML = h;
    }
    function renderReveal() {
      const P = S.P, best = P.result.solutions[0], hints = hintList(P);
      const row = (tag, body) => '<div class="row"><span class="label">' + tag + '</span><span>' + body + '</span></div>';
      let h = '';
      if (!S.shown) hints.slice(0, S.hint).forEach((text, i) => { h += row('Hint ' + (i + 1), text); });
      else {
        h += row('Answer', '<span class="expr">' + exprHTML(best.tree, P) + ' = 24</span>');
        h += '<div class="row"><span class="label">Steps</span>' + powerFacts(P).map(f => '<span class="step">' + f + '</span>').join('') +
          stepsOf(best.tree).map(s => '<span class="step">' + stepHTML(s, P, true) + '</span>').join('') + '</div>';
      }
      const others = otherWays();
      if (S.way && others.length) h += row('Another way', '<span class="expr">' + exprHTML(others[(S.way - 1) % others.length].tree, P) + ' = 24</span>');
      q('.reveal').innerHTML = h;
    }
    function renderActions() {
      const done = !!S.outcome, hints = hintList(S.P), more = otherWays().length > 0;
      const btn = (act, label, cls, off) => '<button class="btn' + (cls ? ' ' + cls : '') + '" type="button" data-act="' + act + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
      let h = '';
      if (mode === 'board') {
        h += btn('hint', 'Hint', '', S.shown || S.solved || S.hint >= hints.length);
        h += btn('show', S.shown ? 'Hide' : 'Show me');
        if ((S.solved || S.shown) && more) h += btn('way', 'Another way');
        h += btn('next', 'Next puzzle', 'primary next');
      } else if (!done) {
        h += btn('hint', 'Hint', '', S.hint >= hints.length);
        h += btn('show', 'Show me');
      } else {
        if (more) h += btn('way', 'Another way');
        const lastDaily = mode === 'daily' && S.daily.i >= S.daily.puzzles.length - 1;
        h += btn('next', lastDaily ? 'See results' : 'Next puzzle', 'primary next');
      }
      q('.actions').innerHTML = h;
    }
    function renderAll() { renderMeta(); renderDots(); renderPlay(); renderReveal(); renderActions(); }

    /* ---------- Board timer ---------- */
    function timerReset() { timer.running = false; timer.up = false; timer.left = S.timerDur * 1000; renderTimer(); }
    function timerStart() {
      if (!S.timerDur || timer.running) return;
      if (timer.left <= 0 || timer.up) { timer.left = S.timerDur * 1000; timer.up = false; }
      timer.running = true; timer.endAt = performance.now() + timer.left; renderTimer();
    }
    function timerPause() { if (timer.running) { timer.left = Math.max(0, timer.endAt - performance.now()); timer.running = false; renderTimer(); } }
    function renderTimer() {
      if (mode !== 'board') return;
      const off = !S.timerDur;
      q('.side').hidden = off;
      q('.m24').classList.toggle('has-timer', !off);
      if (off) return;
      const clock = q('.clock');
      q('.timer').classList.toggle('up', timer.up);
      clock.classList.toggle('low', !timer.up && timer.running && timer.left <= 10000);
      clock.textContent = timer.up ? "TIME'S UP" : Lab.clock(Math.ceil(timer.left / 1000) * 1000);
      q('.bar i').style.transform = 'scaleX(' + (timer.up ? 0 : Math.max(0, Math.min(1, timer.left / (S.timerDur * 1000)))) + ')';
      q('[data-act="timer"]').textContent = timer.running ? 'Pause' : timer.up ? 'Restart' : (timer.left < S.timerDur * 1000 ? 'Resume' : 'Start');
    }

    /* ---------- Daily ---------- */
    function startDaily(replay) {
      const puzzles = dailyPuzzles(ctx.date);
      S.daily = { date: ctx.date, puzzles, i: 0, results: [], start: Date.now(), replay: !!replay };
      deal();
    }
    function finishDaily() {
      const d = S.daily;
      const result = { date: d.date, results: d.results, ms: Date.now() - d.start };
      if (!d.replay) Lab.store.set(ID + '.daily.' + d.date, result);
      d.finished = true;
      showResults(result, d.replay);
    }
    function showResults(result, replay) {
      const solved = result.results.filter(r => r.status !== 'shown').length;
      const hints = result.results.reduce((n, r) => n + (r.hints || 0), 0);
      const sh = Lab.results({
        game: 'Make 24',
        sub: 'Daily · ' + Lab.dateWords(result.date),
        replay,
        streak: true,
        squares: result.results.map(r => r.status),
        stats: [[solved + ' of ' + result.results.length, 'Solved'], [Lab.clock(result.ms), 'Time'], [String(hints), hints === 1 ? 'Hint' : 'Hints']]
      }, { done: 'Done', onClose: ctx.home, extra: '<button class="btn" type="button" data-again>Play again</button>' });
      sh.el.querySelector('[data-again]').addEventListener('click', () => { sh.close(true); startDaily(true); });
    }

    /* ---------- setup (Play and Board) ---------- */
    function openSetup() {
      const board = mode === 'board';
      const pickDeck = board ? S.bDeck : S.deck, pickLevel = board ? S.bLevel : S.level;
      const levels = board ? ['easy', 'medium', 'hard', 'mixed'] : ['easy', 'medium', 'hard'];
      const chip = (group, value, label, on) => '<button class="chip" type="button" data-group="' + group + '" data-value="' + value + '" aria-pressed="' + on + '">' + label + '</button>';
      let h = '<h2>Setup</h2>' +
        '<p class="label">Numbers</p><div class="chips" role="group" aria-label="Numbers">' + DECK_ORDER.map(id => chip('deck', id, DECKS[id].name, id === pickDeck)).join('') + '</div>' +
        '<p class="label">Level</p><div class="chips" role="group" aria-label="Level">' + levels.map(l => chip('level', l, l === 'mixed' ? 'Mixed' : LEVEL_NAME[l], l === pickLevel)).join('') + '</div>';
      if (board) h += '<p class="label">Timer</p><div class="chips" role="group" aria-label="Timer">' + TIMES.map(([s, t]) => chip('time', s, t, s === S.timerDur)).join('') + '</div>';
      const chosen = { deck: pickDeck, level: pickLevel, time: S.timerDur };
      const sh = Lab.sheet(h, {
        label: 'Setup', done: 'Deal',
        onClose() {
          const changed = chosen.deck !== pickDeck || chosen.level !== pickLevel;
          if (board) { S.bDeck = chosen.deck; S.bLevel = chosen.level; S.timerDur = chosen.time; } else { S.deck = chosen.deck; S.level = chosen.level; }
          saveSettings();
          if (changed) { if (mode === 'play' && !S.outcome && S.history.length) S.streak = 0; deal(); }
          else if (board) timerReset();
        }
      });
      sh.el.addEventListener('click', e => {
        const c = e.target.closest('.chip');
        if (!c) return;
        const g = c.dataset.group;
        chosen[g] = g === 'time' ? +c.dataset.value : c.dataset.value;
        sh.el.querySelectorAll('.chip[data-group="' + g + '"]').forEach(x => x.setAttribute('aria-pressed', x === c ? 'true' : 'false'));
      });
    }

    /* ---------- input ---------- */
    host.addEventListener('click', e => {
      const op = e.target.closest('.op');
      if (op) return tapOp(op.dataset.op);
      const a = e.target.closest('[data-act]');
      if (!a || a.disabled) return;
      const act = a.dataset.act;
      if (act === 'undo') undo();
      else if (act === 'over') startOver();
      else if (act === 'hint') hint();
      else if (act === 'show') show();
      else if (act === 'way') anotherWay();
      else if (act === 'next') next();
      else if (act === 'timer') timer.running ? timerPause() : timerStart();
      else if (act === 'treset') timerReset();
    });
    function onKey(e) {
      if (Lab.sheetOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '4') tapTile(+k - 1);
      else if (k === '+' || k === '=') tapOp('+');
      else if (k === '-') tapOp('-');
      else if (k === '*' || k === 'x') tapOp('*');
      else if (k === '/') tapOp('/');
      else if (k === 'u' || k === 'backspace') undo();
      else if (k === 'r') startOver();
      else if (k === 'h') hint();
      else if (k === 'n') { if (mode === 'board' || S.outcome) next(); }
      else if (k === 't' && mode === 'board') { timer.running ? timerPause() : timerStart(); }
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    if (mode === 'board') tick = setInterval(() => {
      if (!timer.running) return;
      timer.left = Math.max(0, timer.endAt - performance.now());
      if (timer.left <= 0) { timer.running = false; timer.up = true; Lab.sound.play('up'); }
      renderTimer();
    }, 100);
    if (mode === 'daily') tick = setInterval(() => { if (S.daily && !S.daily.finished && !Lab.sheetOpen()) renderMeta(); }, 1000);

    if (mode !== 'daily') ctx.setDock([{ label: 'Setup', onClick: openSetup }]);

    /* ---------- go ---------- */
    if (mode === 'daily') {
      const done = Lab.store.get(ID + '.daily.' + ctx.date, null);
      startDaily(!!done);
      if (done && Array.isArray(done.results)) showResults(done, false);
    } else deal();

    return {
      unmount() { document.removeEventListener('keydown', onKey); clearInterval(tick); },
      state: S /* for the tests */
    };
  }

  Lab.register({
    id: ID,
    name: 'Make 24',
    modes: ['play', 'daily', 'board'],
    accent: ['#40E0D0', '#D8F6F1'],
    icon: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="7" fill="#17324D"/><rect x="34" y="2" width="28" height="28" rx="7" fill="#17324D"/>' +
      '<rect x="2" y="34" width="28" height="28" rx="7" fill="#17324D"/><rect x="34" y="34" width="28" height="28" rx="7" fill="#40E0D0"/>' +
      '<g font-family="DM Sans, sans-serif" font-weight="900" text-anchor="middle"><text x="16" y="22.5" font-size="16" fill="#fff">2</text><text x="48" y="22.5" font-size="16" fill="#fff">3</text>' +
      '<text x="16" y="54.5" font-size="16" fill="#fff">4</text><text x="48" y="54" font-size="14" fill="#17324D">24</text></g></svg>',
    art: '<div class="m24-art" aria-hidden="true"><span>3</span><span>3</span><span>8</span><span>8</span></div>',
    howTo: '<h2>How to play</h2><p>Use all four numbers, each one once, to make <b>24</b>.</p>' +
      '<ol><li>Tap a number.</li><li>Tap <b>+</b>, <b>' + MINUS + '</b>, <b>×</b> or <b>÷</b>.</li><li>Tap another number. The two become one new number.</li></ol>' +
      '<p>Keep going until one number is left. If it is 24, you solved it.</p>' +
      '<div class="howto-ex"><span class="nums">6 2 3 2</span><span class="step">6 ' + MINUS + ' 2 = 4</span><span class="step">4 × 3 = 12</span><span class="step">12 × 2 = 24</span></div>' +
      '<p><b>Hint</b> gives you a nudge. <b>Show me</b> gives the answer. <b>Daily</b> is five puzzles, the same for everyone today.</p>' +
      '<p class="howto-keys">Keys: <b>1</b>–<b>4</b> numbers · <b>+ ' + MINUS + ' * /</b> · <b>U</b> undo · <b>R</b> start over · <b>H</b> hint · <b>N</b> next</p>',
    dailyDone: date => !!Lab.store.get(ID + '.daily.' + date, null),
    daily: dailyPuzzles,
    mount
  });
})();
