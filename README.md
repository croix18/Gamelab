# Game Lab

Math, logic and strategy games for 7th grade math: for early finishers, set-aside game time, the whole class on the board, and home.

Students reach the games through the class Google Site (GitHub and the class website are blocked on the school network), so every game ships as one self-contained HTML file that works as an uploaded page or straight from a downloaded file.

## What's here

| File | What it is |
| --- | --- |
| `game-lab.html` | The Game Lab hub, with every game in it |
| `make-24.html` | Make 24 on its own: the same file, opening straight to the game |
| `tools/push.sh` | Commit and push from a Claude session (see below) |

## Games

**Make 24.** Use all four numbers, each once, with + − × ÷ to make 24.

- **Play**: solo, with a solved count and a streak.
- **Daily**: five puzzles that get harder, the same on every device that day, ending on a results card.
- **Board**: one puzzle projected for the whole class, with a timer (off, 0:30, 1:00, 2:00, 3:00).
- Number sets 1–9, 1–13, integers, fractions, decimals, powers and negative powers; Easy, Medium and Hard (plus Mixed on the board).
- Hints climb a ladder (any powers, then the last move, then the first), then Show me and Another way.
- Scaled back from the board version on purpose: no teams, no print sets, no typed-in hands.

## Rules every game follows

The kit (the shared code at the top of each file's script) and every game in it keep to these:

- **No network, no student data.** Nothing is fetched or sent, and nothing about a student is asked for or kept. Progress (Daily results, best streak, settings, sound) stays in that browser under `gamelab.` keys, and the games keep working when storage is blocked or wiped.
- **One way in.** A game calls `Lab.register({ id, name, modes, accent, icon, art, howTo, dailyDone, mount })` and touches only the element it is mounted in. `mount(mode, host, ctx)` returns `{ unmount }`, which removes its key handlers and timers.
- **Daily is shared.** `Lab.dailyRng(gameId)` is seeded from the date, so everyone gets the same puzzles that day.
- **Sound** is off by default for solo play (a room of Chromebooks) and on for the board.
- **The look is Make 24's**: white cards with hard sand shadows on the cream grid, one navy dock bottom-left, the sea along the bottom. Coral is for alerts only; each game sets its own accent.

## Hub and single-game editions

Today `make-24.html` is `game-lab.html` with two lines changed: the `<title>`, and `Lab.start()` becomes `Lab.start({ single: 'make-24' })`. A change to a game goes into both files, or they drift.

## Pushing from a Claude session

Use a fine-grained token limited to this repo (**Only select repositories** → `gamelab`, **Contents: Read and write**). It lives in `.github-token` at the repo root (git-ignored, `chmod 600`), never in the remote URL, output or a commit message.

```sh
CLAUDE_MODEL_NAME="Claude Opus 5.5" tools/push.sh "what changed"
```

The script commits everything as Croix's GitHub no-reply address, sends the token as a Basic auth header up front (the session proxy turns git away before it would offer one), and reports `pushed:` only once the remote `main` matches the local commit. Set `CLAUDE_SESSION_URL` to add a `Claude-Session:` line.
