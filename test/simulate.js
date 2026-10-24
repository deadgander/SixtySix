// Plays many random-vs-AI and AI-vs-AI deals to check the engine never throws and always terminates.
const assert = require('assert');
const G = require('../public/game.js');

function randomAct(st, p) {
  if (st.trick.cards[1 - p] === null) {
    if (G.canExchange(st, p) && Math.random() < 0.5) return { type: 'exchange' };
    if (G.canClose(st, p) && Math.random() < 0.1) return { type: 'close' };
  }
  const legal = G.legalCards(st, p);
  return { type: 'play', card: legal[Math.floor(Math.random() * legal.length)] };
}
const ai = (st, p) => G.aiChoose(st, p);

function playDeal(agents) {
  const st = G.newRound(Math.floor(Math.random() * 2));
  let guard = 0;
  while (!st.over) {
    assert(++guard < 500, 'did not terminate');
    if (G.trickComplete(st)) { G.resolve(st); continue; }
    const p = st.turn;
    const a = agents[p](st, p);
    if (a.type === 'exchange') G.exchange(st, p);
    else if (a.type === 'close') G.close(st, p);
    else G.play(st, p, a.card);
  }
  assert([1, 2, 3].includes(st.result.gamePoints));
  return st;
}

const N = 3000;
let wins = [0, 0];
for (let i = 0; i < N; i++) wins[playDeal([randomAct, ai]).result.winner]++;
console.log('random vs AI deal wins:', wins);
assert(wins[1] > wins[0] * 1.5, 'AI should clearly beat random play');
wins = [0, 0];
for (let i = 0; i < N; i++) wins[playDeal([ai, ai]).result.winner]++;
console.log('AI vs AI deal wins:', wins);
console.log('ok');
