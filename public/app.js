(function () {
  const G = Game;
  const $ = (id) => document.getElementById(id);
  const AI_DELAY = 900;
  const TRICK_DELAY = 1300;

  const RANK_NAME = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', '10': 'Ten', '9': 'Nine' };
  const SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
  const SYMBOL_SUIT = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };

  let st;
  let match = [0, 0];
  let dealer = 1;
  let timer = null;
  let lastLogLen = 0;
  let lastStatus = '';
  let wantFocusHand = false;
  let lastFocus = null;

  const cardName = (c) => `${RANK_NAME[c.r]} of ${SUIT_NAME[c.s]}`;

  // Turn "K♥" style log text into words for screen readers.
  function speak(line) {
    return line
      .replace(/\b(10|[9AKQJ])([♠♥♦♣])/g, (_, r, s) => `${RANK_NAME[r]} of ${SYMBOL_SUIT[s]}`)
      .replace(/[♠♥♦♣]/g, (s) => SYMBOL_SUIT[s]);
  }

  function cardEl(c, { tag = 'div', label = null } = {}) {
    const d = document.createElement(tag);
    if (!c) {
      d.className = 'card back';
      return d;
    }
    const red = c.s === 'H' || c.s === 'D';
    d.className = 'card' + (red ? ' red' : '');
    d.innerHTML = `<div class="tl" aria-hidden="true">${c.r}<br>${G.SYMBOL[c.s]}</div><div class="big" aria-hidden="true">${G.SYMBOL[c.s]}</div>`;
    if (tag === 'div') d.setAttribute('role', 'img');
    if (tag === 'button') d.type = 'button';
    d.setAttribute('aria-label', label || cardName(c));
    return d;
  }

  const suitSort = { S: 0, H: 1, D: 2, C: 3 };
  const rankSort = { A: 0, '10': 1, K: 2, Q: 3, J: 4, '9': 5 };

  function render() {
    const me = $('me');
    // The hand is rebuilt on every render; keep keyboard focus on it when it was there.
    const focusables = [...me.querySelectorAll('button')];
    const focusIdx = focusables.indexOf(document.activeElement);
    const restoreFocus = wantFocusHand || focusIdx >= 0;
    const restoreIdx = wantFocusHand ? 0 : Math.max(focusIdx, 0);
    wantFocusHand = false;

    $('m0').textContent = match[0];
    $('m1').textContent = match[1];
    $('p0').textContent = st.points[0];
    $('p1').textContent = st.points[1];
    const trumpEl = $('trump');
    trumpEl.innerHTML = `<span class="sr">${SUIT_NAME[st.trumpSuit]}</span><span aria-hidden="true">${G.SYMBOL[st.trumpSuit]}</span>`;
    trumpEl.style.color = st.trumpSuit === 'H' || st.trumpSuit === 'D' ? '#ff8a80' : '#fff';

    const opp = $('opp');
    opp.innerHTML = '';
    opp.setAttribute('aria-label', `Computer's hand, ${st.hands[1].length} cards`);
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
    if (st.closedBy === null && left > 0) $('stockInfo').textContent += `, trump card ${cardName(st.stock[0])}`;

    for (const p of [0, 1]) {
      const slot = $('slot' + p);
      slot.innerHTML = '';
      slot.style.border = st.trick.cards[p] ? 'none' : '';
      const c = st.trick.cards[p];
      if (c) slot.appendChild(cardEl(c, { label: `${p === 0 ? 'You' : 'Computer'} played ${cardName(c)}` }));
    }

    me.innerHTML = '';
    const myTurn = !st.over && st.turn === 0 && !timer;
    const legal = myTurn ? G.legalCards(st, 0) : [];
    const sorted = st.hands[0].slice().sort((a, b) => suitSort[a.s] - suitSort[b.s] || rankSort[a.r] - rankSort[b.r]);
    for (const c of sorted) {
      const ok = legal.some((l) => l.s === c.s && l.r === c.r);
      const trump = G.isTrump(st, c);
      const marry = ok && G.canMarry(st, 0, c);
      let label = cardName(c);
      if (trump) label += ', trump';
      if (marry) label += `, declares a marriage worth ${trump ? 40 : 20}`;
      const el = cardEl(c, { tag: 'button', label });
      if (trump) el.classList.add('trump');
      if (myTurn) el.classList.add(ok ? 'legal' : 'dim');
      el.setAttribute('aria-disabled', ok ? 'false' : 'true');
      if (marry) {
        const b = document.createElement('div');
        b.className = 'badge';
        b.setAttribute('aria-hidden', 'true');
        b.textContent = 'Marry ' + (trump ? 40 : 20);
        el.appendChild(b);
      }
      el.onclick = () => { if (ok) humanPlay(c); };
      me.appendChild(el);
    }
    if (restoreFocus && !document.querySelector('.modal.show')) {
      const btns = me.querySelectorAll('button');
      const target = btns[Math.min(restoreIdx, btns.length - 1)];
      if (target) target.focus({ preventScroll: true });
    }

    $('exchange').disabled = !(myTurn && G.canExchange(st, 0));
    $('close').disabled = !(myTurn && G.canClose(st, 0));

    let msg = '';
    if (st.over) msg = st.result.reason;
    else if (myTurn) {
      msg = st.trick.cards[1] ? 'Your turn: respond to the lead' : 'Your lead';
      if (st.trick.cards[1] && G.phase2(st)) msg += '. You must follow suit and win if you can.';
    } else msg = st.turn === 1 ? 'Computer is thinking...' : '';
    $('status').textContent = msg;

    const log = $('log');
    log.innerHTML = st.log.map((l) => `<div>${speak(l)}</div>`).join('');
    log.scrollTop = log.scrollHeight;

    // Announce only what is new since the last render (and the prompt when it is the player's turn).
    const fresh = st.log.slice(lastLogLen).map(speak);
    lastLogLen = st.log.length;
    if (myTurn && msg !== lastStatus) fresh.push(msg);
    lastStatus = myTurn ? msg : '';
    if (fresh.length) $('announce').textContent = fresh.join('. ');
  }

  function after(delay, fn) {
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, delay);
  }

  const SAVE_KEY = 'sixtysix-save-v1';

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ st, match, dealer }));
    } catch (e) { /* storage unavailable; game still works, just not resumable */ }
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.st && s.st.hands && Array.isArray(s.match) && (s.dealer === 0 || s.dealer === 1)) return s;
    } catch (e) { /* corrupt or unavailable save */ }
    return null;
  }

  // ---- modal helpers: focus moves into the dialog, the page behind is inert, focus returns on close ----
  const modals = () => [...document.querySelectorAll('.modal')];
  const anyModal = () => modals().some((m) => m.classList.contains('show'));

  function setBackgroundInert(on) {
    for (const el of [document.querySelector('header'), document.querySelector('main')]) el.inert = on;
  }

  function showModal(id, focusId) {
    if (!anyModal()) lastFocus = document.activeElement;
    $(id).classList.add('show');
    setBackgroundInert(true);
    $(focusId).focus();
  }

  function hideModal(id) {
    $(id).classList.remove('show');
    if (anyModal()) return;
    setBackgroundInert(false);
    if (lastFocus && lastFocus.isConnected && !lastFocus.disabled) lastFocus.focus({ preventScroll: true });
    else focusHand();
  }

  function focusHand() {
    const b = $('me').querySelector('button');
    if (b) b.focus({ preventScroll: true });
  }

  function advance() {
    save();
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
    wantFocusHand = true;
    G.play(st, 0, card);
    advance();
  }

  function endDeal() {
    const r = st.result;
    if (!st.scored) { // guard so a reload on the result screen doesn't score the deal twice
      st.scored = true;
      match[r.winner] += r.gamePoints;
      save();
    }
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
      lastFocus = null; // the hand is rebuilt for the new deal
      hideModal('modal');
      if (done) match = [0, 0];
      deal();
      focusHand();
    };
    const open = () => {
      if (!st.over) return; // a new match was started in the meantime
      if ($('confirmModal').classList.contains('show')) return setTimeout(open, 500);
      showModal('modal', 'mBtn');
    };
    setTimeout(open, 700);
  }

  function deal() {
    clearTimeout(timer);
    timer = null;
    dealer = 1 - dealer;
    st = G.newRound(dealer);
    lastLogLen = 0;
    lastStatus = '';
    advance();
  }

  $('exchange').onclick = () => { if (!timer) { wantFocusHand = true; G.exchange(st, 0); advance(); } };
  $('close').onclick = () => { if (!timer) { wantFocusHand = true; G.close(st, 0); advance(); } };
  $('newMatch').onclick = () => showModal('confirmModal', 'cNo');
  $('cNo').onclick = () => hideModal('confirmModal');
  $('cYes').onclick = () => {
    lastFocus = null;
    hideModal('confirmModal');
    hideModal('modal');
    match = [0, 0];
    deal();
    focusHand();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('confirmModal').classList.contains('show')) hideModal('confirmModal');
  });

  // Resume a saved game if there is one, otherwise start a fresh deal.
  const saved = load();
  if (saved) {
    ({ st, match, dealer } = saved);
    lastLogLen = st.log.length;
    advance();
  } else {
    deal();
  }
})();
