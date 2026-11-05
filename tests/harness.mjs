// Loads the kit and games outside a browser, exactly as the build ships them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { ROOT, manifest, kitScript, gameScript } from '../tools/build.mjs';

/**
 * A fresh Lab with games loaded (every game in the manifest unless `games` lists ids).
 * storage: 'memory' (default) or 'blocked', where every touch of localStorage throws, as on a locked-down browser.
 */
export function loadLab({ games: ids, storage = 'memory' } = {}) {
  const ctx = vm.createContext({ console });
  ctx.window = ctx;
  ctx.document = {};
  const mem = new Map();
  if (storage === 'blocked') {
    Object.defineProperty(ctx, 'localStorage', { get() { throw new Error('storage is blocked'); } });
  } else {
    ctx.localStorage = {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: k => { mem.delete(k); }
    };
  }
  vm.runInContext(kitScript(), ctx, { filename: 'kit.js' });
  for (const g of manifest().games) {
    if (!ids || ids.includes(g.id)) vm.runInContext(gameScript(g), ctx, { filename: `${g.id}.js` });
  }
  return { Lab: ctx.Lab, game: id => ctx.Lab._games.find(g => g.id === id), mem };
}

/** A game's engine files run on their own (no DOM); returns the named top-level bindings.
 *  Values come from another realm: compare arrays with Array.from(...) and objects through JSON. */
export function loadEngine(id, files, names) {
  const src = files.map(f => readFileSync(join(ROOT, 'src/games', id, f), 'utf8')).join('\n\n');
  return vm.runInContext(`${src}\n;({ ${names.join(', ')} })`, vm.createContext({}), { filename: `${id}-engine.js` });
}

/** Local dates as YYYY-MM-DD, `days` of them starting at `from`. */
export function dates(from, days) {
  const [y, m, d] = from.split('-').map(Number), out = [];
  for (let i = 0; i < days; i++) {
    const t = new Date(y, m - 1, d + i);
    out.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`);
  }
  return out;
}
