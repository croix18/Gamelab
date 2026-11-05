# Game Lab plan

Updated 4 November 2026.

Games students want to play that happen to demand reasoning: an even mix of math and logic or strategy, played by early finishers, in set-aside game time, by the whole class on the board, and at home. Each game is one self-contained HTML file, every game is also in the hub, and Croix puts them on the class Google Site.

**Done:** the kit, Make 24 (Play, Daily, Board), and this repo.

## Calls on the brainstorm

The Game Lab started in a brainstorm with another assistant. What this plan keeps, changes and drops from it:

- **Games first, math inside.** The brainstorm's best idea, and how Make 24 already works.
- **Keep** Codebreaker, Pattern Hunt, the arithmetic grid and Hex, with chess as a student edition of Tempo.
- **Swap Probability Royale for Hold or Roll** (the dice game Pig). It practices the same probability without bets and mystery rewards, which read as gambling and loot boxes at school. Pig is also a proven game; Probability Royale's fun would have to be designed from scratch.
- **Skip 2048.** Students already have it everywhere, and once they learn the corner trick it asks for little thinking.
- **Skip Go for now.** Its scoring takes a lesson before the fun starts, a decent computer opponent is a big job, and chess and Hex already cover deep strategy. If it comes back, Capture Go (first capture wins) on a small board is the way in.
- **Hold the other three original games** (Ratio Wars, Coordinate Conquest, Equation Architect) until students have played season one. Their fun is the least proven, so the first one gets prototyped and playtested before it is built.
- **No "Train your brain."** The brainstorm's own caveat says the evidence that game skills transfer is mixed, and Croix's rule keeps taglines and captions out of his tools. The hub shows plain game names: no tagline, no caption under each tile.
- **No accounts, leaderboards or online multiplayer.** The Daily results card is the social piece: students compare screenshots.
- **Original names and art.** SET, Mastermind and KenKen are trademarks, so those games get their own names and their own look.

## Season one

| # | Game | Kind | Practices | Modes | Job |
| --- | --- | --- | --- | --- | --- |
| 1 | Make 24 | Math | Operations, number flexibility | Play, Daily, Board | Done |
| — | Foundation | Build | One source, tests, a guard | — | Small |
| 2 | Codebreaker | Logic | Deduction, testing a guess | Play, Daily, Board | Small |
| 3 | Arithmetic grid (working name) | Math | Operations, factors, elimination | Play, Daily, Board | Medium |
| 4 | Tempo, student edition | Strategy | Planning ahead, tactics | Play, Daily, Board | Large |
| 5 | Hold or Roll | Math | Probability, simulation | Play, Daily, Board | Small to medium |
| 6 | Pattern Hunt | Logic | Patterns, classification | Play, Daily, Board | Medium |
| 7 | Hex | Strategy | Spatial planning, reading an opponent | Play, Board | Medium to large |

The order alternates math with logic or strategy, so the mix stays even as games land, and it puts chess in students' hands before winter break.

## What every game does

- **Short rounds.** A puzzle or game fits in the last ten minutes of a period; for chess that means puzzles and short bot games.
- **Three modes where they fit:** Play (solo), Daily (the same puzzle on every device that day, ending on a results card) and Board (one game on the Promethean panel, the class playing together).
- **Help is always there; clean play is what counts.** Hints climb a ladder to Show me, and the results card marks each puzzle solved clean, solved with hints, or shown. It is the same rule as Croix's practice tests.
- **Every round ends with something to learn.** Make 24's Another way is the model: show the idea behind a better move, not just a score.
- **No network, no names, nothing kept about a student.** Progress lives in that browser, and every game plays fine without it.
- **Chromebook, panel and phone.** Touch and keyboard, readable from the back of the room, playable at home on a phone.
- **Color never carries meaning alone,** so color-blind students can play everything.
- **Computer opponents are named for how they play,** never with a person's name, so none can match a student's.
- **The Game Lab look:** Make 24's white cards on the cream grid, the navy dock and the sea. Each game picks its own accent; coral is only for alerts.

## Before game two: the foundation

Right now the hub and Make 24's own file are two copies of the same code, so every change has to be made twice. One session splits them into sources and a build:

- **Sources and a build.** The code moves into `src/kit/` and `src/games/make-24/`. `tools/build.mjs` writes `game-lab.html` with every game and one file per game with that game alone, and needs nothing but Node. The first build has to reproduce today's two files byte for byte, which proves nothing was lost in the split.
- **Tests** (`node --test`): Make 24's engine across every number set and level, a year of Dailies generated and checked solvable, and the kit with storage blocked.
- **A guard.** The build fails if a file contains a web address, a network call or an outside script, and it prints each file's size.
- **A browser check** at Chromebook, panel and phone sizes: the page loads with no errors, a puzzle can be solved by tapping, and screenshots come back for review.

Shared pieces (two-player turns, a computer opponent that thinks in the background, a Daily streak on the hub, since students already respond to streaks) go into the kit when the first game needs them, not before.

## How each game gets built

1. **Brief.** One page in `docs/briefs/`: rules, levels, modes, the hint ladder, the debrief, the Daily and what Board looks like. The session stops there until Croix okays it or changes it.
2. **Engine, with tests.** Generator, solver or computer opponent. Difficulty comes from sampling thousands of puzzles, the way Make 24's levels were set.
3. **Screens** on the kit, in the Game Lab look.
4. **Review.** A fresh reviewer plays it as a 7th grader on a Chromebook and on the panel; an adversarial one hunts bugs, unfair or broken puzzles, and ways to game the Daily. The session fixes what they find.
5. **Ship.** Build, push, and hand Croix the files for the Site.
6. **Playtest** with a class. What Croix sees goes into the next session.

One game per session, on Opus 5.5. Each session starts from this plan, the game's brief, the push method and a token.

## The games

### 2. Codebreaker

Crack a hidden code of symbols. After each guess, clues say how many symbols are in the right spot and how many are in the code but somewhere else.

- **Levels** by code length, number of symbols, and whether symbols can repeat.
- **Symbols** are shapes in colors, and clues are marked by shape too, so nothing depends on color alone.
- **Daily:** one code for everyone, and a results card with each guess's clues. The loop is Wordle's, which Croix's students already love.
- **Board:** the class proposes guesses and argues for them; Croix enters them.
- **Debrief:** how many codes were still possible after each guess (1,296 → 84 → 9 → 1), and the guess that ruled out the most.
- **Engine:** small. Every possible code can be checked against every guess.

### 3. Arithmetic grid (working name)

Fill a grid so every row and column holds each number once and every outlined cage hits its target with its operation. In a 4×4, a two-cell "12×" cage must hold 3 and 4.

- **Sizes:** 4×4, 5×5 and 6×6. Every puzzle has exactly one answer, checked by a solver before anyone sees it.
- **Hints explain a deduction in words,** rather than just filling in a cell.
- **Daily:** one grid. **Board:** the class calls deductions and Croix fills them in.
- **Later:** an integers level, with negative numbers in the grid.

### 4. Tempo, student edition

Chess from Croix's trainer, in the Game Lab look.

- **For students:** the bot ladder, guided lessons for students who have never played, puzzles, and post-game review (the move where the game turned, and a better one).
- **Stays out:** the character pictures (Croix's own copy only) and any character or line from a show, film or book.
- **Daily:** one puzzle for everyone from Tempo's rated set. **Board:** the class plays a bot, voting on each move.
- **The engine starts only when chess opens,** so the rest of the hub stays quick.
- **The biggest job on the list.** The session needs read access to croix18/Tempo and scopes the port from its code before writing the brief.

### 5. Hold or Roll

The dice game Pig. Roll to build a turn total and hold to bank it, but a 1 wipes the turn. First to 100 wins.

- **Computer players are named for their strategy** ("Holds at 20", "Three rolls and stop"), so students work out which strategy wins.
- **Daily:** the same dice for everyone. Reach 100 in as few turns as you can; the card compares you with "Holds at 20" on the same dice.
- **Board:** the class plays Croix, voting roll or hold.
- **Debrief:** the chance of busting on the next roll (1 in 6, every time), whether one more roll is worth it at your total, and a simulator that runs two strategies against each other 1,000 times. That puts experimental and theoretical probability side by side, which is MA.7.DP.2.4 almost word for word.

### 6. Pattern Hunt

Twelve cards on the table. Find three where each feature (shape, color, number, fill) is either all the same or all different.

- **Levels:** three features to start, then all four.
- **Original card art,** in colors that color-blind students can tell apart.
- **Daily:** one deal with a known number of sets; find them all. **Board:** a class race to call sets.
- **Debrief:** every set you missed, and any wrong pick explained feature by feature.

### 7. Hex

Two players take turns placing stones. The first to connect their two sides of the board wins, and a game can never end in a draw.

- **Boards:** 5×5 to learn, then 7×7 and 9×9.
- **Computer opponent:** Monte Carlo tree search, with its strength set by how long it thinks.
- **Play** against the computer, or two students on one Chromebook. **Board:** one half of the room against the other.
- **Debrief:** the winning chain, and the move where the win chance swung most.
- **The work is the computer opponent.** It has to lose believably to beginners and still push strong players.

## Later, by what students choose

- **Nim** as a Board lesson: the class plays the computer until someone cracks the pattern. Cheap to build.
- **Puzzles in the style of Lights Out and Sokoban,** under names of their own. Sokoban's work is level design.
- **Coordinate Conquest** for accelerated: the coordinate plane and transformations.
- **Ratio Wars,** prototyped and playtested first.
- **Mathle,** already in Deckhand, as a Game Lab Daily if Croix wants it outside Deckhand.

## Timeline (targets)

- **By Thanksgiving break:** the foundation and Codebreaker, so the hub has two Dailies.
- **By winter break:** the arithmetic grid and Tempo's student edition, so students have chess at home over the break.
- **January:** Hold or Roll and Pattern Hunt.
- **February:** Hex.
- **Then:** the next pick from Later, chosen by what students actually play.

## Open decisions (Croix)

1. The lineup and order above, including Hold or Roll in place of Probability Royale and leaving out 2048 and Go.
2. What of Tempo goes to students. The plan sends the bots, lessons, puzzles and review, and leaves the opening trainer for later.
