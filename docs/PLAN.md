# Game Lab plan

Updated 4 November 2026.

Games students want to play that happen to demand reasoning: an even mix of math and logic or strategy, played by early finishers, in set-aside game time, by the whole class on the board, and at home. Each game is one self-contained HTML file, every game is also in the hub, and Croix puts them on the class Google Site.

**Done:** the kit, Make 24 (Play, Daily, Board), and this repo.

## Calls on the brainstorm

The Game Lab started in a brainstorm with another assistant. What this plan keeps, changes and drops from it:

- **Games first, math inside.** The brainstorm's best idea, and how Make 24 already works.
- **Keep** Codebreaker, Pattern Hunt, the arithmetic grid, 2048, Hex and Go, plus chess: all of Tempo.
- **Go stays, with lessons the way chess has them.** If a game needs teaching, the Game Lab teaches it.
- **Probability Royale is out.** Hold or Roll (the dice game Pig) carries probability instead: a proven game, with no bets or mystery rewards.
- **The hub carries the tagline** "Train your brain. Master the game."
- **Hold the other three original games** (Ratio Wars, Coordinate Conquest, Equation Architect) until students have played season one. Their fun is the least proven, so the first one gets prototyped and playtested before it is built.
- **No accounts, leaderboards or online multiplayer.** The Daily results card is the social piece: students compare screenshots.
- **Original names and art.** SET, Mastermind and KenKen are trademarks, so those games get their own names and their own look.

## Season one

| # | Game | Kind | Practices | Modes | Job |
| --- | --- | --- | --- | --- | --- |
| 1 | Make 24 | Math | Operations, number flexibility | Play, Daily, Board | Done |
| — | Foundation | Build | One source, tests, a guard | — | Small |
| 2 | Codebreaker | Logic | Deduction, testing a guess | Play, Daily, Board | Small |
| 3 | 2048 | Math | Powers of two, exponents, planning | Play, Daily, Board | Small |
| 4 | Tempo | Strategy | Chess: tactics, planning ahead | Play, Daily, Board | Large |
| 5 | Arithmetic grid (working name) | Math | Operations, factors, elimination | Play, Daily, Board | Medium |
| 6 | Pattern Hunt | Logic | Patterns, classification | Play, Daily, Board | Medium |
| 7 | Hold or Roll | Math | Probability, simulation | Play, Daily, Board | Small to medium |
| 8 | Hex | Strategy | Spatial planning, reading an opponent | Play, Board | Medium to large |
| 9 | Go | Strategy | Territory, life and death, long-range planning | Play, Daily, Board | Large |

The order alternates math with logic or strategy so the mix stays even as games land. It also gets 2048 out while on-level learns exponents, puts chess in students' hands before winter break, and builds Hex before Go so Go's computer opponent starts from Hex's.

## What every game does

- **Short rounds.** Most rounds fit in the last ten minutes of a period; chess and Go also offer puzzles and small boards for that.
- **Three modes where they fit:** Play (solo), Daily (the same puzzle on every device that day, ending on a results card) and Board (one game on the Promethean panel, the class playing together).
- **Help is always there; clean play is what counts.** Hints climb a ladder to Show me, and the results card marks each puzzle solved clean, solved with hints, or shown. It is the same rule as Croix's practice tests.
- **Every round ends with something to learn.** Make 24's Another way is the model: show the idea behind a better move, not just a score.
- **No network, no names, nothing kept about a student.** Progress lives in that browser, and every game plays fine without it.
- **Chromebook, panel and phone.** Touch and keyboard, readable from the back of the room, playable at home on a phone.
- **Color never carries meaning alone,** so color-blind students can play everything.
- **Computer opponents never share a student's name** (Croix's Tempo rule). New ones are named for how they play.
- **The Game Lab look:** Make 24's white cards on the cream grid, the navy dock and the sea. Each game picks its own accent; coral is only for alerts.

## Before game two: the foundation

Right now the hub and Make 24's own file are two copies of the same code, so every change has to be made twice. One session splits them into sources and a build:

- **Sources and a build.** The code moves into `src/kit/` and `src/games/make-24/`. `tools/build.mjs` writes `game-lab.html` with every game and one file per game with that game alone, and needs nothing but Node. The first build has to reproduce today's two files byte for byte, which proves nothing was lost in the split.
- **Tests** (`node --test`): Make 24's engine across every number set and level, a year of Dailies generated and checked solvable, and the kit with storage blocked.
- **A guard.** The build fails if a file contains a web address, a network call or an outside script, and it prints each file's size.
- **A browser check** at Chromebook, panel and phone sizes: the page loads with no errors, a puzzle can be solved by tapping, and screenshots come back for review.
- **The tagline.** After the byte-for-byte check, the hub gets "Train your brain. Master the game."

Shared pieces (two-player turns, a computer opponent that thinks in the background, a Daily streak on the hub, since students already respond to streaks) go into the kit when the first game needs them, not before.

## How each game gets built

1. **Brief.** One page in `docs/briefs/`: rules, levels, modes, the hint ladder, the debrief, the Daily and what Board looks like. The session stops there until Croix okays it or changes it.
2. **Engine, with tests.** Generator, solver or computer opponent. Difficulty comes from sampling thousands of puzzles, the way Make 24's levels were set.
3. **Screens** on the kit, in the Game Lab look.
4. **Review.** A fresh reviewer plays it as a 7th grader on a Chromebook and on the panel; an adversarial one hunts bugs, unfair or broken puzzles, and ways to game the Daily. The session fixes what they find.
5. **Ship.** Build, push, and hand Croix the files for the Site.
6. **Playtest** with a class. What Croix sees goes into the next session.

One game per session where it fits (Tempo and Go will take more), on Opus 5.5. Each session starts from this plan, the game's brief, the push method and a token.

## The games

### 2. Codebreaker

Crack a hidden code of symbols. After each guess, clues say how many symbols are in the right spot and how many are in the code but somewhere else.

- **Levels** by code length, number of symbols, and whether symbols can repeat.
- **Symbols** are shapes in colors, and clues are marked by shape too, so nothing depends on color alone.
- **Daily:** one code for everyone, and a results card with each guess's clues. The loop is Wordle's, which Croix's students already love.
- **Board:** the class proposes guesses and argues for them; Croix enters them.
- **Debrief:** how many codes were still possible after each guess (1,296 → 84 → 9 → 1), and the guess that ruled out the most.
- **Engine:** small. Every possible code can be checked against every guess.

### 3. 2048

Slide every tile at once; two matching tiles merge into one worth double. Make a 2048 tile before the board fills.

- **Powers mode:** tiles read 2¹, 2², 2³ and up, so every merge shows 2ⁿ + 2ⁿ = 2ⁿ⁺¹. It is ready for on-level's exponents unit before winter break.
- **Challenges:** a target with a move limit, such as 256 in 100 moves.
- **Daily:** the same tiles for everyone; the card shows the biggest tile and the score.
- **Board:** the class votes on each slide.
- **Hint and debrief:** a computer player looks a few moves ahead to suggest a slide; after the game, the move where the board began to jam.
- **Engine:** small. The look-ahead player is the only real work.
- **Later:** an integers mode, where a tile and its opposite cancel.

### 4. Tempo

All of Croix's trainer: every bot up to The Admiral and Stockfish, rated puzzles, post-game review, guided lessons and the opening trainer.

- **One Tempo, not two.** The Game Lab build takes Tempo from croix18/Tempo and dresses it in the Game Lab look rather than rewriting it, so an improvement to Tempo reaches students with a rebuild.
- **No character pictures** (Croix, 4 Nov): the same Tempo as his website.
- **Daily:** one puzzle for everyone from Tempo's rated set. **Board:** the class plays a bot, voting on each move.
- **The engine starts only when chess opens,** so the rest of the hub stays quick.
- **Two or three sessions.** The first reads croix18/Tempo (it needs read access) and works out how Tempo goes in before the brief is written.

### 5. Arithmetic grid (working name)

Fill a grid so every row and column holds each number once and every outlined cage hits its target with its operation. In a 4×4, a two-cell "12×" cage must hold 3 and 4.

- **Sizes:** 4×4, 5×5 and 6×6. Every puzzle has exactly one answer, checked by a solver before anyone sees it.
- **Hints explain a deduction in words,** rather than just filling in a cell.
- **Daily:** one grid. **Board:** the class calls deductions and Croix fills them in.
- **Later:** an integers level, with negative numbers in the grid.

### 6. Pattern Hunt

Twelve cards on the table. Find three where each feature (shape, color, number, fill) is either all the same or all different.

- **Levels:** three features to start, then all four.
- **Original card art,** in colors that color-blind students can tell apart.
- **Daily:** one deal with a known number of sets; find them all. **Board:** a class race to call sets.
- **Debrief:** every set you missed, and any wrong pick explained feature by feature.

### 7. Hold or Roll

The dice game Pig. Roll to build a turn total and hold to bank it, but a 1 wipes the turn. First to 100 wins.

- **Computer players are named for their strategy** ("Holds at 20", "Three rolls and stop"), so students work out which strategy wins.
- **Daily:** the same dice for everyone. Reach 100 in as few turns as you can; the card compares you with "Holds at 20" on the same dice.
- **Board:** the class plays Croix, voting roll or hold.
- **Debrief:** the chance of busting on the next roll (1 in 6, every time), whether one more roll is worth it at your total, and a simulator that runs two strategies against each other 1,000 times. That puts experimental and theoretical probability side by side, which is MA.7.DP.2.4 almost word for word.

### 8. Hex

Two players take turns placing stones. The first to connect their two sides of the board wins, and a game can never end in a draw.

- **Boards:** 5×5 to learn, then 7×7 and 9×9.
- **Computer opponent:** Monte Carlo tree search, with its strength set by how long it thinks.
- **Play** against the computer, or two students on one Chromebook. **Board:** one half of the room against the other.
- **Debrief:** the winning chain, and the move where the win chance swung most.
- **The work is the computer opponent.** It has to lose believably to beginners and still push strong players, and it becomes the start of Go's.

### 9. Go

Surround territory and capture stones, taught from the first stone the way Tempo teaches chess.

- **Lessons:** placing stones, liberties and capture, atari, ko, eyes and life and death, then territory and counting. The first games are Capture Go (first capture wins), the classic way to start beginners.
- **Boards:** 5×5 and 7×7 while learning, then 9×9, 13×13 and the full 19×19. The computer plays best on the smaller boards.
- **Scoring:** area scoring (stones plus surrounded points), with games played out until both players pass, so there are no arguments over dead stones at the end.
- **Computer opponents:** Hex's search grown into Go's, as a ladder like Tempo's bots.
- **Daily:** a capture or life-and-death problem. **Board:** the class plays the computer, voting on each move, or one half of the room plays the other.
- **Debrief:** territory through the game, and the moves where it swung.
- **The work** is the computer opponent and the lessons. Large, but it starts from Hex's search and Tempo's lessons.

## Later, by what students choose

- **Nim** as a Board lesson: the class plays the computer until someone cracks the pattern. Cheap to build.
- **Puzzles in the style of Lights Out and Sokoban,** under names of their own. Sokoban's work is level design.
- **Coordinate Conquest** for accelerated: the coordinate plane and transformations.
- **Ratio Wars,** prototyped and playtested first.
- **Mathle,** already in Deckhand, as a Game Lab Daily if Croix wants it outside Deckhand.

## Timeline (targets)

- **By Thanksgiving break:** the foundation, Codebreaker and 2048.
- **By winter break:** Tempo, so students have chess at home over the break.
- **January:** the arithmetic grid and Pattern Hunt.
- **February:** Hold or Roll and Hex.
- **March:** Go.
- **Then:** the next pick from Later, chosen by what students actually play.

## Decisions

- **4 Nov 2026 (Croix):** Probability Royale is out. 2048 and Go stay, and Go gets lessons the way chess does ("Don't underestimate my students"). The hub keeps "Train your brain. Master the game." All of Tempo goes in, without the character pictures. The plan is approved: build it.

## Open decisions (Croix)

1. The hub's title: "Game Lab" as built, or "Wolf Pack Game Lab" as in the brainstorm's mockup.
