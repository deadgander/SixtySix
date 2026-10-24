// Sixty-Six rules engine + AI. Player 0 = human, player 1 = AI.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Game = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SUITS = ['S', 'H', 'D', 'C'];
  const SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RANKS = ['9', 'J', 'Q', 'K', '10', 'A'];
  const VALUE = { '9': 0, J: 2, Q: 3, K: 4, '10': 10, A: 11 };
  const ORDER = { '9': 0, J: 1, Q: 2, K: 3, '10': 4, A: 5 };
  const WIN_SCORE = 66;
  const MATCH_TARGET = 7;

  const same = (a, b) => a.s === b.s && a.r === b.r;
  const other = (p) => 1 - p;

  function deck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ s, r });
    return d;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // The non-dealer leads. stock[0] is the face-up trump card; draws come from the end.
  function newRound(dealer) {
    const d = shuffle(deck());
    const hands = [d.splice(0, 6), d.splice(0, 6)];
    const trumpCard = d.splice(0, 1)[0];
    const stock = [trumpCard, ...d];
    const leader = other(dealer);
    return {
      hands, stock, trumpSuit: trumpCard.s,
      points: [0, 0], tricks: [0, 0],
      trick: { cards: [null, null], leader },
      turn: leader, dealer,
      closedBy: null, played: [],
      over: false, result: null, log: [],
    };
  }

  const isTrump = (st, c) => c.s === st.trumpSuit;
  const phase2 = (st) => st.closedBy !== null || st.stock.length === 0;
  const beats = (st, lead, resp) =>
    resp.s === lead.s ? ORDER[resp.r] > ORDER[lead.r] : resp.s === st.trumpSuit && lead.s !== st.trumpSuit;
  const trickEmpty = (st) => st.trick.cards[0] === null && st.trick.cards[1] === null;
  const trickComplete = (st) => st.trick.cards[0] !== null && st.trick.cards[1] !== null;

  // When the stock is closed or exhausted you must follow suit, then trump, and head the trick if you can.
  function legalCards(st, p) {
    const hand = st.hands[p];
    const lead = st.trick.cards[other(p)];
    if (!lead || !phase2(st)) return hand.slice();
    const suit = hand.filter((c) => c.s === lead.s);
    if (suit.length) {
      const higher = suit.filter((c) => ORDER[c.r] > ORDER[lead.r]);
      return higher.length ? higher : suit;
    }
    const trumps = hand.filter((c) => isTrump(st, c));
    return trumps.length ? trumps : hand.slice();
  }

  // A marriage may be declared only when leading, and only after winning a trick.
  function canMarry(st, p, card) {
    if (st.over || st.turn !== p || !trickEmpty(st) || st.tricks[p] === 0) return false;
    if (card.r !== 'K' && card.r !== 'Q') return false;
    const partner = card.r === 'K' ? 'Q' : 'K';
    return st.hands[p].some((c) => c.s === card.s && c.r === partner);
  }

  const canLeadSpecial = (st, p) =>
    !st.over && st.turn === p && trickEmpty(st) && st.closedBy === null && st.stock.length >= 3;
  const canExchange = (st, p) =>
    canLeadSpecial(st, p) && st.hands[p].some((c) => c.s === st.trumpSuit && c.r === '9');
  const canClose = (st, p) => canLeadSpecial(st, p);

  const name = (p) => (p === 0 ? 'You' : 'Computer');
  const cardName = (c) => `${c.r}${SYMBOL[c.s]}`;

  function exchange(st, p) {
    if (!canExchange(st, p)) throw new Error('illegal exchange');
    const hand = st.hands[p];
    const i = hand.findIndex((c) => c.s === st.trumpSuit && c.r === '9');
    const nine = hand[i];
    hand[i] = st.stock[0];
    st.stock[0] = nine;
    st.log.push(`${name(p)} swapped the trump 9 for ${cardName(hand[i])}.`);
  }

  function close(st, p) {
    if (!canClose(st, p)) throw new Error('illegal close');
    st.closedBy = p;
    st.log.push(`${name(p)} closed the stock.`);
  }

  function finish(st, winner, reason) {
    const loser = other(winner);
    let gp;
    if (st.closedBy === loser) gp = st.tricks[loser] === 0 ? 3 : 2;
    else if (st.tricks[loser] === 0) gp = 3;
    else if (st.points[loser] < 33) gp = 2;
    else gp = 1;
    st.over = true;
    st.result = { winner, gamePoints: gp, reason };
    st.log.push(`${name(winner)} won the deal: ${gp} game point${gp > 1 ? 's' : ''}.`);
  }

  function play(st, p, card) {
    if (st.over || st.turn !== p) throw new Error('not your turn');
    if (!legalCards(st, p).some((c) => same(c, card))) throw new Error('illegal card');
    const leading = trickEmpty(st);
    const married = leading && canMarry(st, p, card);
    const hand = st.hands[p];
    hand.splice(hand.findIndex((c) => same(c, card)), 1);
    st.trick.cards[p] = card;
    st.log.push(`${name(p)} played ${cardName(card)}.`);
    if (married) {
      const pts = card.s === st.trumpSuit ? 40 : 20;
      st.points[p] += pts;
      st.log.push(`${name(p)} declared a marriage in ${SYMBOL[card.s]}: +${pts}.`);
      if (st.points[p] >= WIN_SCORE) {
        finish(st, p, `${name(p)} reached 66`);
        return;
      }
    }
    st.turn = leading ? other(p) : null; // null once the trick is complete, until resolve()
  }

  function resolve(st) {
    const lp = st.trick.leader;
    const lead = st.trick.cards[lp], resp = st.trick.cards[other(lp)];
    const w = beats(st, lead, resp) ? other(lp) : lp;
    st.points[w] += VALUE[lead.r] + VALUE[resp.r];
    st.tricks[w]++;
    st.played.push(lead, resp);
    st.log.push(`${name(w)} won the trick.`);
    st.trick = { cards: [null, null], leader: w };
    st.turn = w;
    if (st.points[w] >= WIN_SCORE) {
      finish(st, w, `${name(w)} reached 66`);
      return w;
    }
    if (st.closedBy === null && st.stock.length > 0) {
      st.hands[w].push(st.stock.pop());
      st.hands[other(w)].push(st.stock.pop());
    }
    if (st.hands[0].length === 0) {
      st.over = true;
      if (st.closedBy !== null) {
        const c = st.closedBy, o = other(c);
        const gp = st.tricks[c] === 0 ? 3 : 2;
        st.result = { winner: o, gamePoints: gp, reason: `${name(c)} closed the stock but failed to reach 66` };
        st.log.push(`${name(c)} failed after closing. ${name(o)} scores ${gp}.`);
      } else {
        st.result = { winner: w, gamePoints: 1, reason: 'Nobody reached 66; last trick wins' };
        st.log.push(`Last trick: ${name(w)} scores 1.`);
      }
    }
    return w;
  }

  // ---------------- AI ----------------
  function unseenFor(st, p) {
    const known = [...st.hands[p], ...st.played];
    if (st.stock.length > 0) known.push(st.stock[0]); // face-up trump card
    for (const c of st.trick.cards) if (c) known.push(c);
    return deck().filter((c) => !known.some((k) => same(k, c)));
  }

  const cheap = (st, c) => VALUE[c.r] + (isTrump(st, c) ? 100 : 0);
  const minBy = (arr, f) => arr.reduce((b, c) => (b === null || f(c) < f(b) ? c : b), null);
  const maxBy = (arr, f) => arr.reduce((b, c) => (b === null || f(c) > f(b) ? c : b), null);
  const inPair = (hand, c) =>
    (c.r === 'K' || c.r === 'Q') && hand.some((o) => o.s === c.s && o.r === (c.r === 'K' ? 'Q' : 'K'));

  function marriageSuits(st, p) {
    if (st.tricks[p] === 0) return [];
    const h = st.hands[p];
    return SUITS.filter((s) => h.some((c) => c.s === s && c.r === 'K') && h.some((c) => c.s === s && c.r === 'Q'));
  }

  function aiChoose(st, p = 1) {
    const hand = st.hands[p];
    const lead = st.trick.cards[other(p)];
    if (!lead) return aiLead(st, p, hand);
    return { type: 'play', card: aiFollow(st, p, hand, lead) };
  }

  function aiLead(st, p, hand) {
    if (canExchange(st, p)) return { type: 'exchange' };
    const marriages = marriageSuits(st, p);
    const suit = marriages.find((s) => s === st.trumpSuit) || marriages[0];
    if (suit) return { type: 'play', card: hand.find((c) => c.s === suit && c.r === 'K') };
    if (canClose(st, p)) {
      const trumps = hand.filter((c) => isTrump(st, c)).length;
      const aces = hand.filter((c) => c.r === 'A').length;
      if (st.points[p] >= 55 || (st.points[p] >= 40 && trumps >= 3 && aces >= 1)) return { type: 'close' };
    }
    if (phase2(st)) {
      const unseen = unseenFor(st, p);
      const unseenTrumps = unseen.filter((c) => isTrump(st, c)).length;
      const sure = hand.filter((c) => {
        const higher = unseen.filter((u) => u.s === c.s && ORDER[u.r] > ORDER[c.r]).length;
        return higher === 0 && (isTrump(st, c) || unseenTrumps === 0);
      });
      if (sure.length) return { type: 'play', card: maxBy(sure, (c) => VALUE[c.r]) };
      return { type: 'play', card: minBy(hand, (c) => cheap(st, c)) };
    }
    // Stock open: lead low, avoid breaking up marriage pairs.
    return { type: 'play', card: minBy(hand, (c) => cheap(st, c) + (inPair(hand, c) ? 50 : 0)) };
  }

  function aiFollow(st, p, hand, lead) {
    const legal = legalCards(st, p);
    const winners = legal.filter((c) => beats(st, lead, c));
    if (phase2(st)) {
      return winners.length ? minBy(winners, (c) => cheap(st, c)) : minBy(legal, (c) => cheap(st, c));
    }
    if (winners.length) {
      const w = minBy(winners, (c) => cheap(st, c));
      const lv = VALUE[lead.r];
      let take;
      if (isTrump(st, w) && !isTrump(st, lead)) {
        take = lv >= 10 || (lv >= 4 && hand.filter((c) => isTrump(st, c)).length >= 3);
      } else {
        take = lv >= 3 || VALUE[w.r] <= 4;
      }
      if (take) return w;
    }
    return minBy(legal, (c) => cheap(st, c) + (inPair(hand, c) ? 5 : 0));
  }

  return {
    SUITS, SYMBOL, RANKS, VALUE, MATCH_TARGET,
    newRound, legalCards, canMarry, canExchange, canClose,
    exchange, close, play, resolve, trickComplete, aiChoose, phase2, isTrump,
  };
});
