(function () {
  const G = Game;
  const $ = (id) => document.getElementById(id);
  const AI_DELAY = 900;
  const TRICK_DELAY = 1300;

  let st;
  let match = [0, 0];
  let dealer = 1;
  let timer = null;

  function cardEl(c, opts = {}) {
    const d = document.createElement('div');
    if (!c) {
      d.className = 'card back';
      return d;
    }
    const red = c.s === 'H' || c.s === 'D';
    d.className = 'card' + (red ? ' red' : '');
    d.innerHTML = `<div class="tl">${c.r}<br>${G.SYMBOL[c.s]}</div><div class="big">${G.SYMBOL[c.s]}</div>`;
    return d;
  }

  const suitSort = { S: 0, H: 1, D: 2, C: 3 };
  const rankSort = { A: 0, '10': 1, K: 2, Q: 3, J: 4, '9': 5 };

  function render() {
    $('m0').textContent = match[0];
    $('m1').textContent = match[1];
    $('p0').textContent = st.points[0];
    $('p1').textContent = st.points[1];
    $('trump').textContent = G.SYMBOL[st.trumpSuit];
    $('trump').style.color = st.trumpSuit === 'H' || st.trumpSuit === 'D' ? '#ff8a80' : '#fff';

    const opp = $('opp');
    opp.innerHTML = '';
    st.hands[1].forEach(() => opp.appendChild(cardEl(null)));

    // stock: face-down pile with the trump card tucked underneath, sideways
    const stock = $('stock');
    stock.innerHTML = '';
    if (st.stock.length > 0) {
      if (st.closedBy === null) {
        const t = cardEl(st.stock[0]);
        t.classList.add('sideways');
        t.style.left = '40px';
        t.style.top = '0';
        stock.appendChild(t);
      }
      if (st.stock.length > 1 || st.closedBy !== null) {
        const b = cardEl(null);
        b.style.left = '0';
        b.style.top = '0';
        stock.appendChild(b);
      }
    }
    const left = st.stock.length;
    $('stockInfo').textContent = st.closedBy !== null
      ? `Stock closed by ${st.closedBy === 0 ? 'you' : 'computer'}`
      : left > 0 ? `${left} card${left > 1 ? 's' : ''} in stock` : 'Stock empty';

    for (const p of [0, 1]) {
      const slot = $('slot' + p);
      slot.innerHTML = '';
      slot.style.border = st.trick.cards[p] ? 'none' : '';
      if (st.trick.cards[p]) slot.appendChild(cardEl(st.trick.cards[p]));
    }

    const me = $('me');
    me.innerHTML = '';
    const myTurn = !st.over && st.turn === 0 && !timer;
    const legal = myTurn ? G.legalCards(st, 0) : [];
    const sorted = st.hands[0].slice().sort((a, b) => suitSort[a.s] - suitSort[b.s] || rankSort[a.r] - rankSort[b.r]);
    for (const c of sorted) {
      const el = cardEl(c);
      const ok = legal.some((l) => l.s === c.s && l.r === c.r);
      if (G.isTrump(st, c)) el.classList.add('trump');
      if (myTurn) el.classList.add(ok ? 'legal' : 'dim');
      if (ok && G.canMarry(st, 0, c)) {
        const b = document.createElement('div');
        b.className = 'badge';
        b.textContent = 'Marry ' + (c.s === st.trumpSuit ? 40 : 20);
        el.appendChild(b);
      }
      if (ok) el.onclick = () => humanPlay(c);
      me.appendChild(el);
    }

    $('exchange').disabled = !(myTurn && G.canExchange(st, 0));
    $('close').disabled = !(myTurn && G.canClose(st, 0));

    let msg = '';
    if (st.over) msg = st.result.reason;
    else if (myTurn) {
      msg = st.trick.cards[1] ? 'Your turn: respond to the lead.' : 'Your lead.';
      if (st.trick.cards[1] && G.phase2(st)) msg += ' You must follow suit and win if you can.';
    } else msg = st.turn === 1 ? 'Computer is thinking...' : '';
    $('status').textContent = msg;

    const log = $('log');
    log.innerHTML = st.log.map((l) => `<div>${l}</div>`).join('');
    log.scrollTop = log.scrollHeight;
  }

  function after(delay, fn) {
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, delay);
  }

  function advance() {
    render();
    if (st.over) return endDeal();
    if (G.trickComplete(st)) return after(TRICK_DELAY, () => { G.resolve(st); advance(); });
    if (st.turn === 1) {
      return after(AI_DELAY, () => {
        const a = G.aiChoose(st, 1);
        if (a.type === 'exchange') G.exchange(st, 1);
        else if (a.type === 'close') G.close(st, 1);
        else G.play(st, 1, a.card);
        advance();
      });
    }
  }

  function humanPlay(card) {
    if (st.over || st.turn !== 0 || timer) return;
    G.play(st, 0, card);
    advance();
  }

  function endDeal() {
    const r = st.result;
    match[r.winner] += r.gamePoints;
    render();
    const done = match[0] >= G.MATCH_TARGET || match[1] >= G.MATCH_TARGET;
    $('mTitle').textContent = done
      ? (match[0] > match[1] ? 'You win the match!' : 'Computer wins the match')
      : (r.winner === 0 ? 'You won the deal' : 'Computer won the deal');
    $('mReason').textContent = r.reason;
    $('mGain').textContent = `${r.winner === 0 ? 'You score' : 'Computer scores'} ${r.gamePoints} game point${r.gamePoints > 1 ? 's' : ''}`;
    $('mYou').textContent = match[0];
    $('mCpu').textContent = match[1];
    $('mBtn').textContent = done ? 'New match' : 'Next deal';
    $('mBtn').onclick = () => {
      $('modal').classList.remove('show');
      if (done) match = [0, 0];
      deal();
    };
    setTimeout(() => $('modal').classList.add('show'), 700);
  }

  function deal() {
    clearTimeout(timer);
    timer = null;
    dealer = 1 - dealer;
    st = G.newRound(dealer);
    advance();
  }

  $('exchange').onclick = () => { if (!timer) { G.exchange(st, 0); advance(); } };
  $('close').onclick = () => { if (!timer) { G.close(st, 0); advance(); } };
  $('newMatch').onclick = () => {
    $('modal').classList.remove('show');
    match = [0, 0];
    deal();
  };

  deal();
})();
