/* ===== Game Lab kit: storage, daily seeds, sound, sheets, results card, dock and screens =====
   Every game registers with Lab.register() and only touches the element it is mounted in.
   Nothing here talks to the network, and nothing about a student is ever asked for or kept. */
(function (global) {
  'use strict';
  const doc = global.document;
  const Lab = global.Lab = {};
  const pad2 = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  Lab.esc = esc;

  /* ---------- storage: this browser only; every call survives storage being blocked or wiped ---------- */
  const PREFIX = 'gamelab.';
  Lab.store = {
    get(key, fallback) {
      try { const raw = global.localStorage.getItem(PREFIX + key); return raw === null ? fallback : JSON.parse(raw); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { global.localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    }
  };

  /* ---------- seeded randomness: a Daily is the same puzzle on every device that day ---------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  Lab.hash = hash;
  Lab.rng = seed => mulberry32(typeof seed === 'string' ? hash(seed) : seed);
  const isoOf = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  Lab.today = () => isoOf(new Date());
  Lab.dailyRng = (gameId, date) => Lab.rng(gameId + '|daily|' + (date || Lab.today()));
  Lab.dateWords = function (iso) {
    const p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };
  Lab.clock = function (ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  };

  /* ---------- sound: off by default for solo play (a room of Chromebooks), on for the board ---------- */
  let actx = null;
  const TONES = {
    solve: { type: 'sine', gain: .22, seq: [[523, 0], [659, .09], [784, .18], [1047, .27]] },
    up: { type: 'triangle', gain: .22, seq: [[660, 0], [660, .24], [440, .48]] },
    step: { type: 'sine', gain: .07, seq: [[740, 0]] }
  };
  Lab.sound = {
    on: false,
    play(kind) {
      const tone = TONES[kind];
      if (!this.on || !tone) return;
      try {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;
        actx = actx || new AC();
        if (actx.state === 'suspended') actx.resume();
        const now = actx.currentTime;
        tone.seq.forEach(([f, t]) => {
          const o = actx.createOscillator(), g = actx.createGain();
          o.type = tone.type;
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, now + t);
          g.gain.exponentialRampToValueAtTime(tone.gain, now + t + .02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + t + .34);
          o.connect(g); g.connect(actx.destination);
          o.start(now + t); o.stop(now + t + .4);
        });
      } catch (e) { /* no audio here: play on silently */ }
    }
  };

  /* ---------- sheets ---------- */
  let openSheet = null;
  Lab.sheetOpen = () => !!openSheet;
  Lab.closeSheet = () => { if (openSheet) openSheet.close(true); };
  Lab.sheet = function (inner, opts) {
    opts = opts || {};
    if (openSheet) openSheet.close(true);
    const back = doc.createElement('div');
    back.className = 'sheet-back';
    back.innerHTML = '<div class="card sheet' + (opts.cls ? ' ' + opts.cls : '') + '" role="dialog" aria-modal="true" aria-label="' +
      esc(opts.label || 'Dialog') + '" tabindex="-1">' + inner + '<div class="sheet-foot">' + (opts.extra || '') +
      '<button class="btn primary" type="button" data-close>' + esc(opts.done || 'Done') + '</button></div></div>';
    const box = back.firstElementChild;
    const before = doc.activeElement;
    function close(silent) {
      if (!back.isConnected) return;
      back.remove();
      doc.removeEventListener('keydown', onKey, true);
      if (openSheet && openSheet.el === box) openSheet = null;
      if (!silent && opts.onClose) opts.onClose();
      if (!silent && before && before.isConnected && before.focus) before.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') { /* keep focus inside the sheet */
        const f = Array.from(box.querySelectorAll('button:not(:disabled), [href], input, select, [tabindex]:not([tabindex="-1"])'));
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    doc.addEventListener('keydown', onKey, true);
    doc.body.appendChild(back);
    (box.querySelector('[data-close]') || box).focus({ preventScroll: true });
    openSheet = { el: box, close };
    return openSheet;
  };

  /* ---------- results card ---------- */
  const SQ = {
    clean: ['✓', 'solved without hints'],
    helped: ['✓', 'solved with hints'],
    shown: ['–', 'answer shown']
  };
  /* r: { game, sub, squares?: ['clean' | 'helped' | 'shown'], body?: html of the game's own, stats: [[value, label]], key?: false } */
  Lab.results = function (r, opts) {
    const sq = r.squares || [];
    const squares = sq.length ? '<div class="r-squares">' + sq.map((s, i) => '<span class="r-sq ' + s + '" role="img" aria-label="' + (i + 1) + ': ' + SQ[s][1] + '">' + SQ[s][0] + '</span>').join('') + '</div>' : '';
    const stats = r.stats.map(s => '<div class="r-stat"><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>').join('');
    const key = sq.length && r.key !== false ? '<p class="r-key">' + ['clean', 'helped', 'shown'].map(s => '<i><span class="r-sq ' + s + '" aria-hidden="true">' + SQ[s][0] + '</span>' +
      (s === 'clean' ? 'No hints' : s === 'helped' ? 'With hints' : 'Shown') + '</i>').join('') + '</p>' : '';
    const html = '<p class="r-game">' + esc(r.game) + '</p><p class="r-sub">' + esc(r.sub) + '</p>' + squares + (r.body || '') +
      '<div class="r-stats">' + stats + '</div>' + key;
    return Lab.sheet(html, Object.assign({ cls: 'results', label: r.game + ' results' }, opts));
  };

  /* ---------- screens: hub, a game's front page, a mode ---------- */
  const games = [];
  const MODE_NAME = { play: 'Play', daily: 'Daily', board: 'Board' };
  const ICON = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.2h3.8L12 5.5v13l-4.7-3.7H3.5z" fill="currentColor"/><path d="M15.4 9a4.2 4.2 0 0 1 0 6M17.9 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.2h3.8L12 5.5v13l-4.7-3.7H3.5z" fill="currentColor"/><path d="m15.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  const shell = { single: null, screen: null, game: null, mode: null, session: null, extras: [], redock: () => {} };

  Lab.register = function (game) { games.push(game); };
  const byId = id => games.find(g => g.id === id);

  /* The hub's name and tagline. */
  const HUB = { name: 'Game Lab', tagline: 'Train your brain. Master the game.' };

  /* Days in a row with at least one Daily done. Today counts once it is done, and a weekend never breaks a streak. */
  Lab.dailyStreak = function (from) {
    const dailies = games.filter(g => g.dailyDone);
    if (!dailies.length) return 0;
    const d = from ? new Date(from.getTime()) : new Date();
    const done = () => dailies.some(g => { try { return !!g.dailyDone(isoOf(d)); } catch (e) { return false; } });
    let n = 0;
    if (!done()) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 400; i++) {
      if (done()) n++;
      else if (d.getDay() !== 0 && d.getDay() !== 6) break;
      d.setDate(d.getDate() - 1);
    }
    return n;
  };

  function setAccent(game) {
    const root = doc.documentElement.style;
    if (game && game.accent) { root.setProperty('--accent', game.accent[0]); root.setProperty('--accent-pale', game.accent[1]); }
    else { root.removeProperty('--accent'); root.removeProperty('--accent-pale'); }
  }
  const soundKey = () => shell.mode === 'board' ? 'sound.board' : 'sound.solo';
  function loadSound() { Lab.sound.on = !!Lab.store.get(soundKey(), shell.mode === 'board'); }
  function toggleSound() {
    Lab.sound.on = !Lab.sound.on;
    Lab.store.set(soundKey(), Lab.sound.on);
    shell.redock();
    const b = doc.getElementById('soundPill');
    if (b) b.focus();
  }

  function dock(items) {
    const nav = doc.getElementById('dock');
    nav.innerHTML = '';
    items.forEach(it => {
      if (it.brand) {
        const s = doc.createElement('span');
        s.className = 'brand';
        s.textContent = it.brand;
        nav.appendChild(s);
        return;
      }
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'pill' + (it.pale ? ' pale' : '') + (it.round ? ' round' : '');
      if (it.id) b.id = it.id;
      if (it.html) b.innerHTML = it.html; else b.textContent = it.label;
      if (it.aria) b.setAttribute('aria-label', it.aria);
      if (it.pressed !== undefined) b.setAttribute('aria-pressed', String(it.pressed));
      b.addEventListener('click', it.onClick);
      nav.appendChild(b);
    });
  }
  function dockTail(game) {
    return [
      { round: true, pale: true, label: '?', aria: 'How to play', onClick: () => howTo(game) },
      { id: 'soundPill', round: true, pale: !Lab.sound.on, html: Lab.sound.on ? ICON.soundOn : ICON.soundOff, aria: 'Sound', pressed: Lab.sound.on, onClick: toggleSound }
    ];
  }
  function howTo(game) { Lab.sheet(game.howTo, { label: 'How to play', cls: 'howto' }); }

  function clearScreen() {
    Lab.closeSheet();
    if (shell.session && shell.session.unmount) shell.session.unmount();
    shell.session = null;
    shell.extras = [];
    const app = doc.getElementById('app');
    app.innerHTML = '';
    app.scrollTop = 0;
    return app;
  }

  function showHub() {
    shell.screen = 'hub'; shell.game = null; shell.mode = null;
    loadSound(); setAccent(null);
    const app = clearScreen();
    const date = Lab.today();
    const dailies = games.filter(g => g.modes.indexOf('daily') >= 0);
    let h = '<div class="hub"><header class="hub-head"><h1 class="hub-title">' + esc(HUB.name) + '</h1><p class="hub-tag">' + esc(HUB.tagline) + '</p></header>';
    if (dailies.length) {
      const streak = Lab.dailyStreak();
      h += '<section class="card today" aria-label="Daily puzzles"><p class="label">Daily · ' + esc(Lab.dateWords(date)) + '</p><div class="today-list">' +
        dailies.map(g => '<button class="btn daily-go" type="button" data-game="' + g.id + '">' + esc(g.name) +
          (g.dailyDone && g.dailyDone(date) ? '<span class="done" aria-label="done today">✓</span>' : '') + '</button>').join('') +
        '</div>' + (streak ? '<p class="today-streak">Streak <b>' + streak + '</b></p>' : '') + '</section>';
    }
    h += '<div class="games">' + games.map(g => '<button class="card gtile" type="button" data-game="' + g.id + '">' + g.icon +
      '<span class="gname">' + esc(g.name) + '</span></button>').join('') + '</div></div>';
    app.innerHTML = h;
    app.querySelectorAll('.gtile').forEach(b => b.addEventListener('click', () => showHome(byId(b.dataset.game))));
    app.querySelectorAll('.daily-go').forEach(b => b.addEventListener('click', () => showMode(byId(b.dataset.game), 'daily')));
    shell.redock = () => dock([{ brand: HUB.name }]);
    shell.redock();
  }

  function showHome(game) {
    shell.screen = 'home'; shell.game = game; shell.mode = null;
    loadSound(); setAccent(game);
    const app = clearScreen();
    const done = game.dailyDone && game.dailyDone(Lab.today());
    app.innerHTML = '<div class="home"><section class="card home-card" aria-label="' + esc(game.name) + '">' +
      '<h1 class="home-title">' + esc(game.name) + '</h1>' + (game.art || '') +
      '<div class="modes">' + game.modes.map(m => '<button class="btn' + (m === 'play' ? ' primary' : '') + '" type="button" data-mode="' + m + '">' +
        MODE_NAME[m] + (m === 'daily' && done ? '<span class="done" aria-label="done today">✓</span>' : '') + '</button>').join('') + '</div>' +
      '<button class="mini" type="button" data-howto>How to play</button></section></div>';
    app.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => showMode(game, b.dataset.mode)));
    app.querySelector('[data-howto]').addEventListener('click', () => howTo(game));
    shell.redock = () => dock((shell.single ? [] : [{ round: true, pale: true, html: ICON.back, aria: 'All games', onClick: showHub }]).concat(dockTail(game)));
    shell.redock();
  }

  function showMode(game, mode) {
    shell.screen = 'mode'; shell.game = game; shell.mode = mode;
    loadSound(); setAccent(game);
    const app = clearScreen();
    const host = doc.createElement('div');
    host.className = 'mode';
    app.appendChild(host);
    shell.redock = () => dock([{ round: true, pale: true, html: ICON.back, aria: 'Back', onClick: () => showHome(game) }, { brand: game.name }]
      .concat(shell.extras, dockTail(game)));
    shell.redock();
    const ctx = {
      mode,
      date: Lab.today(),
      setDock(extras) { shell.extras = extras || []; shell.redock(); },
      home: () => showHome(game)
    };
    shell.session = game.mount(mode, host, ctx) || null;
  }

  Lab.start = function (opts) {
    opts = opts || {};
    shell.single = opts.single ? byId(opts.single) : null;
    if (shell.single) showHome(shell.single); else showHub();
  };
  Lab._shell = shell; /* for the tests */
  Lab._games = games;
})(window);
