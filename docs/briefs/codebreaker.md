# Codebreaker: brief

Crack a hidden code. Logic: deduction, and testing a guess against evidence.

## Rules

- The computer hides a code: a row of symbols. Every guess is a row of the same length.
- After each guess, two clues: **●** how many are the right symbol in the right spot, and **○** how many are in the code but in a different spot. The clues are counts, not positions.
- Crack it within the guess limit.

## Symbols

Seven symbols, each its own shape and its own color: circle, square, triangle, diamond, star, hexagon, cross. Shape alone tells them apart, so color never carries meaning. No coral (alerts only). Clues read as marks with their counts beside them, for example "● 2  ○ 1".

## Levels

| Level | Code length | Symbols | Repeats | Guesses | Possible codes |
| --- | --- | --- | --- | --- | --- |
| Easy | 4 | 5 | No | 8 | 120 |
| Medium | 4 | 6 | Yes | 8 | 1,296 |
| Hard | 5 | 7 | Yes | 10 | 16,807 |

## Modes

- **Play:** a new code each round. Setup picks the level. Solved count and streak, like Make 24.
- **Daily:** one Medium code for everyone that day. The results card shows each guess's clue marks in rows (the Wordle-style card), with guesses used, time and hints. A replay is marked as one and doesn't overwrite the day's result.
- **Board:** for the panel. Big pieces, and the number of codes that still fit shows after every guess, so the class can argue about the next one. Setup picks the level.

## Entering a guess

Tap a symbol to fill the next empty spot, tap a filled spot to clear it, and Check when the row is full. Keys: 1–7 for symbols, Backspace, Enter, H for a hint, N for the next code.

## Hint ladder

1. How many codes still fit every clue so far.
2. One fact the clues prove, in words: "The star isn't in the code", "There's a circle in spot 2", "There's at least one triangle". If nothing is proven yet, the advice that the next guess should fit every clue so far.
3. A strong next guess: the one that leaves the fewest codes in the worst case.

**Show me** reveals the code. Running out of guesses reveals it too. The results mark each round solved clean, solved with hints, or shown.

## Debrief, after every round

- Each guess with the number of codes left after it (1,296 → 256 → 44 → 3 → 1).
- The guess that ruled out the most.
- Any guess that couldn't have been the code because it broke an earlier clue, the most common beginner mistake.

## Engine

Every possible code is listed once per round, and a guess is scored against a code with repeats counted properly. Hints and the debrief work from the list of codes that still fit. On Hard, the strong-guess search may limit itself to the codes that still fit, so that every hint answers in under a quarter second on a Chromebook.

## Look

Gold accent (`#F2B640`, pale `#FCEFD0`) on the Game Lab kit.
