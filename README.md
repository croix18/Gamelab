# Game Lab

Math, logic and strategy games for 7th grade math: for early finishers, set-aside game time, the whole class on the board, and home.

Students reach the games through the class Google Site (GitHub and the class website are blocked on the school network), so every game ships as one self-contained HTML file that works as an uploaded page or straight from a downloaded file.

## What's here

| Path | What it is |
| --- | --- |
| `game-lab.html` | The Game Lab hub, with every game in it (built) |
| `make-24.html` | Make 24 on its own, opening straight to the game (built) |
| `2048.html` | 2048 on its own, opening straight to the game (built) |
| `src/` | The source: the kit, the font, and each game in `src/games/<id>/` |
| `src/games.json` | Which games are in, in hub order, and their file names |
| `tools/build.mjs` | Writes the built files from `src/` |
| `tools/check-browser.mjs` | Plays every game in headless Chrome at Chromebook, panel and phone sizes |
| `tests/` | Engine, kit and build tests |
| `tools/push.sh` | Commit and push from a Claude session (see below) |
| `docs/PLAN.md` | The plan: which games, in what order, and how each gets built |
| `docs/briefs/` | One page per game: rules, levels, modes, hints and debrief |

## Building

Edit `src/`, never the built `.html` files, then:

```sh
node tools/build.mjs           # write game-lab.html and each game's own file
node --test                    # engine, kit and build tests (a full year of Dailies included)
node tools/check-browser.mjs   # play everything in headless Chrome; screenshots in out/screens/
```

The build needs nothing but Node. It refuses to write a file that could reach the network: a web address, `fetch`, an outside script or stylesheet, or an element loading an outside file. `node tools/build.mjs --check` fails if a built file is out of date.

A game lives in `src/games/<id>/`: its CSS, its script files (wrapped together so nothing leaks between games), and optionally `check.mjs`, the browser check's script for it. Adding a game means adding its folder and its line in `src/games.json`.

## Games

**Make 24.** Use all four numbers, each once, with + − × ÷ to make 24.

- **Play**: solo, with a solved count and a streak.
- **Daily**: five puzzles that get harder, the same on every device that day, ending on a results card.
- **Board**: one puzzle projected for the whole class, with a timer (off, 0:30, 1:00, 2:00, 3:00).
- Number sets 1–9, 1–13, integers, fractions, decimals, powers and negative powers; Easy, Medium and Hard (plus Mixed on the board).
- Hints climb a ladder (any powers, then the last move, then the first), then Show me and Another way.
- Scaled back from the board version on purpose: no teams, no print sets, no typed-in hands.

**2048.** Slide the tiles; two matching tiles merge into one worth double. Make a 2048 tile before the board fills.

- **Play**: Classic, saved in the browser to finish later, or a Challenge: 128 in 100 slides, 256 in 190, 512 in 340.
- **Daily**: 150 slides on the same tiles for everyone that day, ending on a card with the final board, the score, the biggest tile and the look-ahead player's score on the same tiles.
- **Board**: for the panel, with big arrows to tap while the class votes each slide.
- Tiles as numbers (32) or powers (2⁵), with each slide's biggest merge under the board as an equation: 2⁵ + 2⁵ = 2⁶.
- **Hint** is the look-ahead player's slide and why. After every game, the slides that cost the most.

## Rules every game follows

The kit (`src/kit/`) and every game in it keep to these:

- **No network, no student data.** Nothing is fetched or sent, and nothing about a student is asked for or kept. Progress (Daily results, streaks, settings, sound) stays in that browser under `gamelab.` keys, and the games keep working when storage is blocked or wiped.
- **One way in.** A game calls `Lab.register({ id, name, modes, accent, icon, art, howTo, dailyDone, mount })` and touches only the element it is mounted in. `mount(mode, host, ctx)` returns `{ unmount }`, which removes its key handlers and timers.
- **Daily is shared.** `Lab.dailyRng(gameId)` is seeded from the date, so everyone gets the same puzzles that day. The hub counts a Daily streak across games; weekends never break it.
- **Sound** is off by default for solo play (a room of Chromebooks) and on for the board.
- **The look is Make 24's**: white cards with hard sand shadows on the cream grid, one navy dock bottom-left, the sea along the bottom. Coral is for alerts only; each game sets its own accent.

The full list, and how each new game gets built, is in `docs/PLAN.md`.

## Pushing from a Claude session

Use a fine-grained token limited to this repo (**Only select repositories** → `Gamelab`, **Contents: Read and write**). It lives in `.github-token` at the repo root (git-ignored, `chmod 600`), never in the remote URL, output or a commit message.

```sh
CLAUDE_MODEL_NAME="Claude Opus 5.5" tools/push.sh "what changed"
```

The script commits everything as Croix's GitHub no-reply address, sends the token as a Basic auth header up front (the session proxy turns git away before it would offer one), and reports `pushed:` only once the remote `main` matches the local commit. Set `CLAUDE_SESSION_URL` to add a `Claude-Session:` line.
