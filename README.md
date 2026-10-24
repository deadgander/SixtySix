# Sixty-Six

A single-player browser version of the classic trick-taking card game **Sixty-Six**, played against a computer opponent.

> This project was generated with [Claude Code](https://claude.com/claude-code) using the Claude Sonnet 5.5 model.

## Play

[**Launch the game**](https://deadgander.github.io/SixtySix/)

To run it locally instead:

```
npm start
```

Then open <http://localhost:3000>. Requires [Node.js](https://nodejs.org/); there are no dependencies to install.

The game is fully client-side, so you can also open [public/index.html](public/index.html) directly in a browser. A GitHub Actions workflow deploys the `public/` folder to GitHub Pages on every push to `main`.

## How the game works

Sixty-Six uses a 24-card deck (9, J, Q, K, 10, A in each suit). Each player is dealt 6 cards and one card is turned up to set the trump suit. The goal of a deal is to be the first to collect **66 points**.

| Card | A | 10 | K | Q | J | 9 |
|------|---|----|---|---|---|---|
| Points | 11 | 10 | 4 | 3 | 2 | 0 |

- **Tricks:** the higher card of the led suit wins; a trump beats any other suit. The winner of a trick draws first from the stock, then leads the next trick.
- **Marriages:** when leading a K or Q while holding its partner (and after you have won a trick), you declare a marriage for **+20**, or **+40** in the trump suit.
- **Trump 9 swap:** while leading, you may swap the trump 9 for the face-up trump card.
- **Closing the stock:** while leading, you may close the stock. Drawing stops, and you must reach 66 yourself; if you fail, the opponent scores 2 game points (3 if you took no tricks).
- **Endgame rules:** once the stock is closed or empty, you must follow suit, otherwise play a trump, and you must win the trick if you can.
- **Game points per deal:** reaching 66 scores 1 point, 2 if the opponent has fewer than 33 points, or 3 if the opponent took no tricks. If nobody reaches 66, the winner of the last trick scores 1.
- **Match:** first to **7 game points** wins.

Full rules: <https://bicyclecards.com/how-to-play/sixty-six/>

## Controls

Click a highlighted card to play it. Playing a K or Q that completes a marriage declares it automatically. Use the **Swap trump 9** and **Close stock** buttons when available. A deal ends automatically when someone reaches 66.

## Project layout

- `server.js`: tiny static file server
- `public/game.js`: rules engine and AI (works in the browser and Node)
- `public/app.js`, `public/index.html`: UI
- `test/simulate.js`: plays thousands of random and AI games to check the engine (`npm test`)

## AI

The computer opponent uses heuristics: it declares marriages, swaps the trump 9, leads low cards while the stock is open, closes the stock when strong, and plays by counting unseen cards in the endgame. It never looks at your hand.
