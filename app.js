/* PayBox Split - academic prototype. Plain JS, no build, no backend. All money is fake. */
(function () {
  'use strict';
  var D = window.SPLIT_DATA;
  var KEY = 'pbsplit-demo-v1';
  var VIEWER = D.viewerId;
  var M = {}; D.members.forEach(function (m) { M[m.id] = m; });
  var IDS = D.members.map(function (m) { return m.id; });

  /* ---------- state ---------- */
  function fresh() {
    return {
      v: 1, route: 'start', created: false, invited: false, time: 'fri',
      expenses: [], payments: [], events: [],
      viewerAdded: false, balancesViewed: false, webViewed: false, danaMarked: false,
      closed: false, friction: 0, addTimes: [], tabView: 'expenses', pmOpen: false,
      guideOpen: false, animFrom: null, nextTabIntent: false
    };
  }
  var mem = null;
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); if (s && s.v === 1 && Array.isArray(s.expenses)) return s; }
    } catch (e) { /* storage blocked - fall back to memory */ }
    return mem || fresh();
  }
  var S = load();
  function save() {
    mem = S;
    try { window.localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }

  /* ---------- helpers ---------- */
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(ag) { var n = Math.round(ag) / 100; return n.toLocaleString('he-IL', { maximumFractionDigits: n % 1 ? 2 : 0 }); }
  function money(ag, cls) { return '<span class="money ' + (cls || '') + '" dir="ltr">' + fmt(ag) + '&nbsp;₪</span>'; }
  function name(id) { return id === VIEWER ? 'יובל' : M[id].name; }
  function avatar(id, extra) {
    var m = M[id];
    return '<span class="av ' + (extra || '') + '" style="--c:' + m.color + '" aria-hidden="true">' + esc(m.name.charAt(0)) + '</span>';
  }
  function icon(n) {
    var p = {
      back: '<path d="M9 5l7 7-7 7" />',
      plus: '<path d="M12 5v14M5 12h14" />',
      more: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
      check: '<path d="M5 12.5l4.5 4.5L19 7.5" />',
      lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
      arrow: '<path d="M19 12H5M11 6l-6 6 6 6" />',
      share: '<path d="M12 4v11M7 9l5-5 5 5M5 14v5h14v-5"/>',
      chart: '<path d="M5 19V9M12 19V5M19 19v-7"/>',
      reset: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>'
    }[n];
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }

  /* ---------- ledger maths (agorot, integers) ---------- */
  function participants(e) { return e.split === 'all' ? IDS.slice() : IDS.filter(function (id) { return e.split.indexOf(id) > -1; }); }
  function shares(e) {
    var ps = participants(e), total = Math.round(e.amount * 100), base = Math.floor(total / ps.length), rem = total - base * ps.length, out = {};
    ps.forEach(function (id, i) { out[id] = base + (i < rem ? 1 : 0); });
    return out;
  }
  function balances() {
    var b = {}; IDS.forEach(function (id) { b[id] = 0; });
    S.expenses.forEach(function (e) {
      b[e.payer] += Math.round(e.amount * 100);
      var sh = shares(e); Object.keys(sh).forEach(function (id) { b[id] -= sh[id]; });
    });
    S.payments.forEach(function (p) { b[p.from] += p.amount; b[p.to] -= p.amount; });
    return b;
  }
  // greedy heuristic: largest debtor pays largest creditor; member order breaks ties -> deterministic.
  // At most n-1 transfers (5 for 6 people); not a guaranteed global minimum, so the copy says "X instead of Y", never "minimum".
  function transfers() {
    var b = balances(), out = [];
    var deb = IDS.filter(function (id) { return b[id] < 0; }).map(function (id) { return { id: id, v: -b[id] }; });
    var cre = IDS.filter(function (id) { return b[id] > 0; }).map(function (id) { return { id: id, v: b[id] }; });
    function srt(a) { a.sort(function (x, y) { return y.v - x.v || IDS.indexOf(x.id) - IDS.indexOf(y.id); }); }
    var guard = 0;
    while (deb.length && cre.length && guard++ < 50) {
      srt(deb); srt(cre);
      var d = deb[0], c = cre[0], amt = Math.min(d.v, c.v);
      out.push({ from: d.id, to: c.id, amount: amt });
      d.v -= amt; c.v -= amt;
      deb = deb.filter(function (x) { return x.v > 0; }); cre = cre.filter(function (x) { return x.v > 0; });
    }
    return out;
  }
  function naiveCount() {
    return S.expenses.reduce(function (n, e) { var ps = participants(e); return n + ps.length - (ps.indexOf(e.payer) > -1 ? 1 : 0); }, 0);
  }
  function settledCount() {
    if (!S.expenses.length) return 0;
    var b = balances(); return IDS.filter(function (id) { return b[id] === 0; }).length;
  }
  function total() { return S.expenses.reduce(function (n, e) { return n + Math.round(e.amount * 100); }, 0); }
  function allEven() { var b = balances(); return S.expenses.length > 0 && IDS.every(function (id) { return b[id] === 0; }); }
  function walletBalance() {
    var paid = S.payments.filter(function (p) { return p.from === VIEWER && p.rail === 'paybox'; }).reduce(function (n, p) { return n + p.amount; }, 0);
    return D.viewerWalletBalance * 100 - paid;
  }

  /* ---------- events (feed the PM view) ---------- */
  var EV = {
    tab_created: 'נפתח חשבון', invite_sent: 'נשלחה הזמנה בוואטסאפ', invitee_joined: 'מוזמן הצטרף', time_skip: 'דילוג בזמן',
    expense_added: 'נרשמה הוצאה', balance_viewed: 'נצפה מסך מי חייב למי', invite_viewed_web: 'מוזמן צפה ביתרה בדפדפן',
    signup_prompt: 'הוצגה הרשמה ברגע התשלום', settled_paybox: 'חוב נסגר בכפתור PayBox', marked_settled: 'חוב סומן כסגור ע״י הנושה',
    friction_edit_other: 'חיכוך: ניסיון לערוך הוצאה של מישהו אחר', friction_member_left: 'חיכוך: חבר יצא מהחשבון',
    expense_deleted_own: 'הוצאה עצמית נמחקה', tab_closed: 'החשבון נסגר - כולם מאוזנים', next_tab_cta: 'לחיצה על חשבון לטיול הבא'
  };
  function track(name, props, story) {
    S.events.push({ n: name, p: props || {}, t: D.times[S.time].label, story: !!story });
  }

  /* ---------- guide steps ---------- */
  var STEPS = [
    { t: 'פתיחת חשבון לטיול', h: 'בדף הבית לוחצים על "פותחים חשבון".', done: function () { return S.created; }, go: 'home' },
    { t: 'הזמנת החברים בקישור', h: 'שולחים את הקישור לקבוצת הוואטסאפ.', done: function () { return S.invited; }, go: 'invite' },
    { t: 'דילוג למוצ״ש', h: 'בפס ההדגמה למעלה: "דילוג למוצ״ש". החברים כבר רשמו הוצאות.', done: function () { return S.time !== 'fri'; }, go: 'tab' },
    { t: 'הוספת הוצאה', h: 'לוחצים "+ הוצאה". חלוקה שווה כבר מסומנת - רק שומרים.', done: function () { return S.viewerAdded; }, go: 'tab' },
    { t: 'מי חייב למי', h: 'עוברים ל"מי חייב למי" - כמה העברות במקום עשרות.', done: function () { return S.balancesViewed; }, go: 'balances' },
    { t: 'רוני בלי האפליקציה', h: 'לוחצים "איך רוני רואה את זה?" - צפייה בדפדפן, ותשלום בביט שדנה מסמנת.', done: function () { return S.danaMarked; }, go: 'web' },
    { t: 'דילוג ליום ראשון', h: 'בפס ההדגמה: "דילוג ליום ראשון". חוזרים לדף הבית.', done: function () { return S.time === 'sun'; }, go: 'home' },
    { t: 'סגירת החוב', h: 'בכרטיס בדף הבית: "לסגור עכשיו" ואז אישור "לשלם ב-PayBox".', done: function () { return S.closed; }, go: 'home' }
  ];
  function curStep() { for (var i = 0; i < STEPS.length; i++) if (!STEPS[i].done()) return i; return STEPS.length; }
  function hint(stepIdx) { return curStep() === stepIdx ? ' pulse' : ''; }

  /* ---------- routing ---------- */
  var ROUTES = ['start', 'home', 'create', 'invite', 'tab', 'add', 'web', 'dana', 'done'];
  function go(r) { if (location.hash !== '#/' + r) location.hash = '#/' + r; else render(); }
  function routeFromHash() {
    var r = (location.hash || '').replace('#/', '');
    if (r === 'balances') { S.tabView = 'balances'; r = 'tab'; }
    if (ROUTES.indexOf(r) < 0) r = S.route || 'start';
    if (r !== 'start' && r !== 'home' && !S.created && r !== 'create') r = 'home';
    if ((r === 'add' || r === 'web' || r === 'dana') && S.time === 'fri') r = 'tab';
    if (r === 'add' && S.closed) r = 'tab';
    if (r === 'done' && !S.closed) r = 'tab';
    return r;
  }

  /* ---------- screens ---------- */
  function header(title, back, extra) {
    return '<header class="appbar">' +
      (back ? '<button class="iconbtn" data-a="nav" data-to="' + back + '" aria-label="חזרה">' + icon('back') + '</button>' : '<span class="iconbtn-sp"></span>') +
      '<h1 tabindex="-1">' + title + '</h1>' + (extra || '<span class="iconbtn-sp"></span>') + '</header>';
  }

  function vStart() {
    return '<section class="start">' +
      '<img class="start-logo" src="assets/logo.svg" alt="" width="84" height="84">' +
      '<h1 tabindex="-1">PayBox Split</h1>' +
      '<p class="start-tag">חשבון משותף לטיול עם חברים</p>' +
      '<p class="start-lead">כל אחד משלם על משהו, <bdi class="en">PayBox Split</bdi> אומר מי חייב למי - וסוגרים את החוב מאותו מסך.</p>' +
      '<div class="start-story"><strong>בהדגמה אתם יובל.</strong> יובל ו-5 חברים יוצאים לסופ״ש בגליל. 8 שלבים, בערך דקה וחצי.</div>' +
      '<button class="btn primary big pulse" data-a="begin">בואו נתחיל</button>' +
      '<button class="btn link" data-a="pm">מבט מנהל מוצר</button>' +
      '</section>';
  }

  function ring(done, of) {
    var r = 22, c = 2 * Math.PI * r, f = of ? done / of : 0;
    return '<svg class="ring" viewBox="0 0 56 56" role="img" aria-label="' + done + ' מתוך ' + of + ' סגרו">' +
      '<circle cx="28" cy="28" r="' + r + '" class="ring-bg"/>' +
      '<circle cx="28" cy="28" r="' + r + '" class="ring-fg" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '"/>' +
      '<text x="28" y="33" text-anchor="middle">' + done + '/' + of + '</text></svg>';
  }

  function myDebts() { return transfers().filter(function (t) { return t.from === VIEWER; }); }
  function owedToMe() { return transfers().filter(function (t) { return t.to === VIEWER; }); }

  function vHome() {
    var card;
    if (!S.created) {
      card = '<article class="card promo">' +
        '<p class="eyebrow">חדש: PayBox Split</p>' +
        '<h2>יוצאים לטיול?</h2>' +
        '<p>פותחים חשבון משותף, כל אחד רושם מה שילם, ואנחנו עושים את החשבון.</p>' +
        '<button class="btn coral' + hint(0) + '" data-a="nav" data-to="create">פותחים חשבון</button></article>';
    } else if (!S.closed) {
      var sc = settledCount(), debts = myDebts(), line, cta = '';
      if (S.time === 'fri') line = 'החשבון פתוח - מחכים להוצאות הראשונות';
      else if (debts.length && sc >= 4) line = 'נשאר רק החוב שלך: <span class="nw">' + money(debts[0].amount) + ' ל' + esc(name(debts[0].to)) + '</span>';
      else if (debts.length) line = 'החוב שלך: ' + money(debts.reduce(function (n, t) { return n + t.amount; }, 0));
      else if (owedToMe().length) line = 'מגיע לך: ' + money(owedToMe().reduce(function (n, t) { return n + t.amount; }, 0));
      else line = 'אצלך הכל מאוזן - מחכים לשאר החברים';
      if (debts.length && S.time === 'sun') cta = '<button class="btn coral' + hint(7) + '" data-a="settle" data-to="' + debts[0].to + '">לסגור עכשיו</button>';
      card = '<article class="card opentab">' +
        '<button class="opentab-main" data-a="nav" data-to="tab" aria-label="פתיחת החשבון ' + esc(D.tab.name) + '">' +
        ring(sc, IDS.length) +
        '<span class="opentab-txt"><span class="pill open">חשבון פתוח</span><strong>' + esc(D.tab.name) + '</strong>' +
        '<span class="muted">' + line + '</span>' +
        (S.expenses.length ? '<span class="muted small">' + sc + ' מתוך ' + IDS.length + ' כבר סגרו</span>' : '') +
        '</span></button>' + cta + '</article>';
    } else {
      card = '<article class="card closedtab"><span class="pill done">' + icon('check') + ' נסגר</span>' +
        '<p><strong>' + esc(D.tab.name) + '</strong> - כולם מאוזנים. החשבון עבר לארכיון, הסיכום נשמר כאן.</p>' +
        '<button class="btn ghost" data-a="nav" data-to="done">לסיכום הטיול</button></article>';
    }
    return '<section class="home">' +
      '<div class="home-top"><p class="muted">שלום יובל</p><h1 tabindex="-1">יתרה ' + money(walletBalance(), 'lg') + ' <span class="dummy">דמה</span></h1>' +
      '<div class="quick">' +
      ['העברה', 'בקשה', 'קבוצות'].map(function (q) { return '<button class="q" data-a="notdemo">' + q + '</button>'; }).join('') +
      '<button class="q q-split" data-a="nav" data-to="' + (S.created ? 'tab' : 'create') + '">Split</button></div></div>' +
      card +
      '<h3 class="sec">פעולות אחרונות</h3><ul class="activity">' +
      S.payments.filter(function (p) { return p.from === VIEWER && p.rail === 'paybox'; }).map(function (p) { return '<li><span>' + icon('check') + ' תשלום ל' + esc(name(p.to)) + ' - ' + esc(D.tab.name) + '</span>' + money(p.amount) + '</li>'; }).join('') +
      '<li><span>העברה מאמא (דמה)</span>' + money(20000) + '</li><li><span>קפה במשרד - קבוצת עבודה (דמה)</span>' + money(1800) + '</li></ul>' +
      '</section>';
  }

  function vCreate() {
    var friends = IDS.filter(function (id) { return id !== VIEWER; });
    return header('חשבון חדש', 'home') + '<section class="pad">' +
      '<label class="lbl" for="tabName">שם החשבון</label><input id="tabName" class="input" value="' + esc(D.tab.name) + '" readonly aria-readonly="true">' +
      '<div class="row2"><div><span class="lbl">מתחיל</span><div class="input ro" dir="ltr">' + D.tab.start + '</div></div>' +
      '<div><span class="lbl">מסתיים (חובה)</span><div class="input ro" dir="ltr">' + D.tab.end + '</div></div></div>' +
      '<p class="muted small">תאריך הסיום קובע מתי מתחיל שבוע הסגירה.</p>' +
      '<span class="lbl">מי בא?</span><div class="chips">' +
      friends.map(function (id) { return '<span class="chip on">' + avatar(id, 'sm') + esc(M[id].name) + (M[id].wallet === 'bit' ? ' <small>(ביט)</small>' : '') + '</span>'; }).join('') +
      '</div>' +
      '<p class="note">חברים בלי PayBox יכולים לראות את החשבון מהדפדפן, בלי להירשם.</p>' +
      '<p class="muted small">בהדגמה הפרטים ממולאים מראש.</p>' +
      '<button class="btn primary big' + hint(0) + '" data-a="create">יוצרים ומזמינים</button></section>';
  }

  function vInvite() {
    return header('ההזמנה', 'home') + '<section class="pad">' +
      '<p class="ok">' + icon('check') + ' החשבון נפתח</p>' +
      '<div class="wa" aria-label="תצוגה מקדימה של הודעת וואטסאפ (דמה)">' +
      '<p class="wa-top">וואטסאפ (דמה) · גליל 2026</p>' +
      '<div class="wa-bubble">פתחתי חשבון לסופ״ש בגליל. מי ששילם על משהו - רושם פה, ובסוף רואים מי חייב למי:' +
      '<span class="wa-link" dir="ltr">' + D.tab.link + '</span><span class="muted small">לא צריך להוריד אפליקציה כדי לצפות</span></div></div>' +
      (S.invited
        ? '<p class="ok">' + icon('check') + ' נשלח לקבוצה</p>' + (S.time === 'fri' ? '<p class="muted">עכשיו מדלגים קדימה בזמן.</p>' +
          '<button class="btn primary big' + hint(2) + '" data-a="skip">דילוג למוצ״ש</button>' : '<button class="btn primary big" data-a="nav" data-to="tab">לחשבון</button>')
        : '<button class="btn primary big' + hint(1) + '" data-a="invite">' + icon('share') + ' שולחים בוואטסאפ</button>' +
          '<button class="btn ghost" data-a="copy">העתקת קישור</button>') +
      '<p class="muted small">הקישור בדוי ולא נשלח באמת.</p></section>';
  }

  function socialStrip() {
    if (!S.expenses.length || !settledCount()) return '';
    var b = balances(), sc = settledCount();
    var txt = sc === IDS.length ? 'כולם סגרו' : sc >= 4 && myDebts().length ? sc + ' מתוך ' + IDS.length + ' כבר סגרו - נשאר רק החוב שלך' : sc + ' מתוך ' + IDS.length + ' כבר סגרו';
    return '<div class="social" aria-label="' + txt + '"><span class="avs">' +
      IDS.map(function (id) { return avatar(id, b[id] === 0 ? 'ok' : 'wait'); }).join('') + '</span><span>' + txt + '</span></div>';
  }

  function myCard() {
    var d = myDebts(), o = owedToMe(), label, amt, cls = '';
    if (!S.expenses.length) { label = 'עדיין אין הוצאות'; amt = ''; }
    else if (d.length) { label = 'החוב שלך'; amt = d.reduce(function (n, t) { return n + t.amount; }, 0); cls = 'owe'; }
    else if (o.length) { label = 'מגיע לך'; amt = o.reduce(function (n, t) { return n + t.amount; }, 0); cls = 'get'; }
    else { label = 'אצלך הכל מאוזן'; amt = ''; cls = 'even'; }
    var delta = '';
    if (S.animFrom != null && amt !== '') delta = '<span class="delta">עודכן: ירד ב-' + money(S.animFrom - amt) + '</span>';
    return '<div class="mycard ' + cls + '"><span>' + label + '</span>' +
      (amt !== '' ? '<strong class="bigmoney" id="myAmt" data-from="' + (S.animFrom != null ? S.animFrom : '') + '" data-to="' + amt + '">' + money(S.animFrom != null ? S.animFrom : amt) + '</strong>' : '') +
      delta + '</div>';
  }

  function vTab() {
    var menu = '<button class="iconbtn" data-a="menu" aria-label="אפשרויות">' + icon('more') + '</button>';
    var view = S.tabView === 'balances' ? balancesView() : expensesView();
    return header(esc(D.tab.name), 'home', menu) +
      '<section class="tabhead"><span class="pill ' + (S.closed ? 'done' : 'open') + '">' + (S.closed ? 'נסגר' : 'פתוח') + '</span>' +
      '<span class="muted small">' + IDS.length + ' חברים · <span dir="ltr">' + D.tab.start + '-' + D.tab.end + '</span></span>' +
      '<span class="muted small">סה״כ ' + money(total()) + '</span></section>' +
      '<section class="pad tight">' + myCard() + socialStrip() +
      '<div class="seg" role="group" aria-label="תצוגת החשבון">' +
      '<button aria-pressed="' + (S.tabView !== 'balances') + '" data-a="view" data-v="expenses">הוצאות</button>' +
      '<button class="' + (S.tabView !== 'balances' && S.viewerAdded ? hint(4).trim() : '') + '" aria-pressed="' + (S.tabView === 'balances') + '" data-a="view" data-v="balances">מי חייב למי</button></div>' +
      view + '</section>' +
      (S.tabView === 'expenses' && !S.closed && S.time !== 'fri' ? '<button class="fab' + hint(3) + '" data-a="nav" data-to="add">' + icon('plus') + ' הוצאה</button>' : '');
  }

  function expensesView() {
    if (!S.expenses.length) return '<div class="empty"><p><strong>עדיין אין הוצאות.</strong></p><p class="muted">מי ששילם על משהו רושם כאן, וכולם רואים את אותו חשבון.</p>' +
      (S.invited ? '<button class="btn primary' + hint(2) + '" data-a="skip">דילוג למוצ״ש</button>' : '<button class="btn primary" data-a="nav" data-to="invite">הזמנת חברים</button>') + '</div>';
    return '<ul class="exp">' + S.expenses.slice().reverse().map(function (e) {
      var n = participants(e).length;
      return '<li><button class="exp-row" data-a="expense" data-id="' + e.id + '">' + avatar(e.payer) +
        '<span class="exp-txt"><strong>' + esc(e.title) + '</strong><span class="muted small">שולם ע״י ' + esc(name(e.payer)) + ' · ' + (n === IDS.length ? 'כולם' : n + ' אנשים') + (e.viaWeb ? ' · נרשם מהדפדפן' : '') + '</span></span>' +
        money(Math.round(e.amount * 100)) + '</button></li>';
    }).join('') + '</ul>';
  }

  function balancesView() {
    var ts = transfers();
    var head = '<p class="netting">במקום <strong>' + naiveCount() + '</strong> העברות קטנות - <strong>' + (ts.length + S.payments.length) + '</strong> בלבד</p>';
    var rows = S.payments.map(function (p) {
      return '<li class="tr done">' + avatar(p.from, 'sm') + '<span class="tr-names">' + esc(name(p.from)) + ' <span aria-hidden="true">←</span><span class="sr"> ל</span> ' + esc(name(p.to)) + '</span>' + money(p.amount) +
        '<span class="st ok">' + icon('check') + (p.rail === 'paybox' ? ' שולם ב-PayBox' : ' סומן כסגור - ' + (p.rail === 'bit' ? 'ביט' : 'מזומן')) + '</span></li>';
    }).concat(ts.map(function (t) {
      var act = '<span class="st wait">פתוח</span>';
      if (t.from === VIEWER) act = S.time === 'sun' || S.time === 'sat' ? '<button class="btn coral sm' + hint(7) + '" data-a="settle" data-to="' + t.to + '" aria-label="לשלם ' + fmt(t.amount) + ' שקלים ל' + esc(name(t.to)) + '">לשלם</button>' : act;
      else if (t.to === VIEWER) act = '<button class="btn ghost sm" data-a="mark" data-from="' + t.from + '" aria-label="סמן כסגור את החוב של ' + esc(name(t.from)) + ', ' + fmt(t.amount) + ' שקלים">סמן כסגור</button>';
      return '<li class="tr' + (t.from === VIEWER ? ' mine' : '') + '">' + avatar(t.from, 'sm') + '<span class="tr-names">' + esc(name(t.from)) + ' <span aria-hidden="true">←</span><span class="sr"> ל</span> ' + esc(name(t.to)) + (M[t.from].wallet === 'bit' ? ' <small class="bit">ביט</small>' : '') + '</span>' + money(t.amount) + act + '</li>';
    })).join('');
    return head + '<ul class="trs">' + rows + '</ul>' +
      '<p class="muted small">חוב נסגר כשמשלמים ב-PayBox, או כשמי שמגיע לו הכסף מסמן שקיבל בביט או במזומן.</p>' +
      (S.time !== 'fri' ? '<button class="btn ghost wide' + hint(5) + '" data-a="nav" data-to="web">איך רוני רואה את זה? (בלי האפליקציה)</button>' : '');
  }

  var addOpenedAt = 0;
  function vAdd() {
    addOpenedAt = Date.now();
    var s = D.suggestedExpense;
    return header('הוצאה חדשה', 'tab') + '<form class="pad addform" id="addForm" novalidate>' +
      '<label class="lbl" for="amt">כמה?</label><div class="amtwrap"><input id="amt" class="input amt" inputmode="decimal" dir="ltr" value="' + s.amount + '" aria-describedby="perHead" autocomplete="off"><span>₪</span></div>' +
      '<label class="lbl" for="ttl">על מה?</label><input id="ttl" class="input" value="' + esc(s.title) + '" maxlength="40" autocomplete="off">' +
      '<fieldset><legend class="lbl">מי שילם?</legend><div class="chips" id="payer">' +
      IDS.map(function (id) { return '<button type="button" class="chip' + (id === VIEWER ? ' on' : '') + '" aria-pressed="' + (id === VIEWER) + '" data-a="payer" data-id="' + id + '">' + avatar(id, 'sm') + (id === VIEWER ? 'אני' : esc(M[id].name)) + '</button>'; }).join('') +
      '</div></fieldset>' +
      '<fieldset><legend class="lbl">מתחלק בין</legend><p class="default-tag">' + icon('check') + ' חלוקה שווה בין כולם - מסומן מראש</p><div class="chips" id="split">' +
      IDS.map(function (id) { return '<button type="button" class="chip on" aria-pressed="true" data-a="part" data-id="' + id + '">' + avatar(id, 'sm') + (id === VIEWER ? 'אני' : esc(M[id].name)) + '</button>'; }).join('') +
      '</div><p class="muted small">מישהו לא היה? לוחצים על השם כדי להוריד.</p></fieldset>' +
      '<p class="perhead" id="perHead"></p><p class="err" id="addErr" role="alert"></p>' +
      '<button type="submit" class="btn primary big' + hint(3) + '">שומרים הוצאה</button></form>';
  }
  function addFormState() {
    var f = document.getElementById('addForm'); if (!f) return null;
    var raw = String(document.getElementById('amt').value).trim().replace(/\s|₪/g, '');
    var amt = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(raw) ? parseFloat(raw.replace(/,/g, '')) : /^\d+([.,]\d{1,2})?$/.test(raw) ? parseFloat(raw.replace(',', '.')) : NaN;
    var payer = f.querySelector('#payer .chip.on'), parts = [].map.call(f.querySelectorAll('#split .chip.on'), function (c) { return c.dataset.id; });
    return { amt: amt, payer: payer ? payer.dataset.id : VIEWER, parts: parts, title: document.getElementById('ttl').value.trim() || 'הוצאה' };
  }
  function updatePerHead() {
    var st = addFormState(), el = document.getElementById('perHead'); if (!st || !el) return;
    el.innerHTML = st.parts.length && st.amt > 0 ? money(Math.round(st.amt * 100 / st.parts.length)) + ' לכל אחד · ' + st.parts.length + ' אנשים' : '';
  }

  function vWeb() {
    if (!S.webViewed) { S.webViewed = true; track('invite_viewed_web', { who: 'roni' }); save(); }
    var mine = transfers().filter(function (t) { return t.from === 'roni'; });
    var paid = S.payments.filter(function (p) { return p.from === 'roni'; });
    var logged = S.expenses.filter(function (e) { return e.loggedBy === 'roni'; });
    var bal = mine.length ? '<p>יש לך חוב של</p><strong class="bigmoney">' + money(mine.reduce(function (n, t) { return n + t.amount; }, 0)) + '</strong><p>' + mine.map(function (t) { return money(t.amount) + ' ל' + esc(name(t.to)); }).join(' · ') + '</p>'
      : paid.length ? '<p>' + icon('check') + ' החוב שלך סגור</p><p class="muted small">' + esc(name(paid[0].to)) + ' סימנה שקיבלה ' + (paid[0].rail === 'bit' ? 'בביט' : 'במזומן') + '</p>' : '<p>אצלך הכל מאוזן</p>';
    return '<div class="browser"><div class="urlbar">' + icon('lock') + '<span dir="ltr">' + D.tab.link + '</span></div></div>' +
      '<section class="pad web">' +
      '<p class="viewing">כך רוני, שמשתמש רק בביט, רואה את החשבון מהקישור בוואטסאפ - בלי אפליקציה ובלי הרשמה.</p>' +
      '<div class="webbrand"><img src="assets/logo.svg" alt="" width="28" height="28"> PayBox Split</div>' +
      '<h1 tabindex="-1">היי רוני</h1><p class="muted">הוזמנת לחשבון "' + esc(D.tab.name) + '" · ' + IDS.length + ' חברים</p>' +
      '<div class="mycard ' + (mine.length ? 'owe' : 'even') + '">' + bal + '</div>' +
      '<h3 class="sec">מה רשמת</h3><ul class="exp">' + logged.map(function (e) { return '<li class="exp-row static">' + avatar('roni') + '<span class="exp-txt"><strong>' + esc(e.title) + '</strong><span class="muted small">נרשם מהדפדפן</span></span>' + money(e.amount * 100) + '</li>'; }).join('') + '</ul>' +
      (mine.length ?
        '<button class="btn primary big" data-a="signup">לשלם ב-PayBox</button><p class="muted small center">הרשמה קצרה רק ברגע התשלום</p>' +
        '<div class="note">משלמים בביט או במזומן? מעבירים ל' + esc(name(mine[0].to)) + ' כרגיל, ומי שמקבל את הכסף מסמן בחשבון שהחוב נסגר.</div>' +
        '<button class="btn coral wide' + hint(5) + '" data-a="nav" data-to="dana">רוני העביר בביט - לראות את הצד של ' + esc(name(mine[0].to)) + '</button>' : '') +
      '<button class="btn ghost wide" data-a="nav" data-to="balances">חזרה לאפליקציה של יובל</button></section>';
  }

  function vDana() {
    var t = transfers().filter(function (x) { return x.from === 'roni'; })[0];
    var body;
    if (!t) body = '<p class="ok">' + icon('check') + ' אין לרוני חוב פתוח.</p><button class="btn primary big" data-a="nav" data-to="balances">חזרה ליובל</button>';
    else {
      var cred = name(t.to);
      body = '<p class="viewing">עכשיו אנחנו בטלפון של ' + esc(cred) + '. רוני העביר לה ' + money(t.amount) + ' בביט.</p>' +
        '<div class="card"><div class="dana-row">' + avatar('roni') + '<span><strong>רוני</strong><span class="muted small"> חייב לך</span></span>' + money(t.amount) + '</div>' +
        '<p>קיבלת את הכסף מחוץ ל-PayBox?</p>' +
        '<button class="btn primary big' + hint(5) + '" data-a="dmark" data-rail="bit">קיבלתי בביט - סמן כסגור</button>' +
        '<button class="btn ghost wide" data-a="dmark" data-rail="cash">קיבלתי במזומן</button></div>' +
        '<p class="muted small">רק מי שמגיע לו הכסף יכול לסמן חוב כסגור - לא החייב.</p>';
    }
    return header('הטלפון של ' + (t ? esc(name(t.to)) : 'דנה'), 'web') + '<section class="pad">' + body + '</section>';
  }

  function vDone() {
    var biggest = S.expenses.slice().sort(function (a, b) { return b.amount - a.amount; })[0];
    var pb = S.payments.filter(function (p) { return p.rail === 'paybox'; }).length;
    return '<section class="done-s"><div class="confetti" id="confetti" aria-hidden="true"></div>' +
      '<img src="assets/logo.svg" alt="" width="64" height="64"><h1 tabindex="-1">סגרנו!</h1>' +
      '<p class="lead">' + esc(D.tab.name) + ' - כולם מאוזנים</p>' +
      '<div class="recap"><div><strong>' + D.tab.days + '</strong><span>ימים</span></div><div><strong>' + IDS.length + '</strong><span>חברים</span></div><div><strong>' + S.expenses.length + '</strong><span>הוצאות</span></div></div>' +
      '<ul class="recap-list"><li>יצא ביחד ' + money(total()) + '</li><li>הכי יקר: ' + esc(biggest.title) + ' (' + money(biggest.amount * 100) + ')</li>' +
      '<li>' + S.payments.length + ' העברות במקום ' + naiveCount() + ', מתוכן ' + pb + ' בכפתור <bdi>PayBox</bdi></li><li>נסגר יום אחרי סוף הטיול</li></ul>' +
      '<button class="btn coral big" data-a="nexttab">פותחים חשבון לטיול הבא</button>' +
      '<button class="btn ghost wide pulse" data-a="pm">' + icon('chart') + ' מה זה אומר למנהל המוצר?</button>' +
      '<button class="btn link" data-a="nav" data-to="home">חזרה לבית</button></section>';
  }

  /* ---------- PM view ---------- */
  function gauge(val, lo, hi, reverse, label) {
    // val 0-100; lo/hi thresholds. reverse=true for guardrail (lower is better)
    var cls = val == null ? 'na' : (!reverse ? (val >= hi ? 'good' : val < lo ? 'bad' : 'mid') : (val <= lo ? 'good' : val > hi ? 'bad' : 'mid'));
    return '<div class="gauge ' + cls + '" role="img" aria-label="' + label + '"><div class="g-track">' +
      '<span class="g-mark" style="inset-inline-start:' + lo + '%"><i>' + lo + '%</i></span><span class="g-mark" style="inset-inline-start:' + hi + '%"><i>' + hi + '%</i></span>' +
      (val != null ? '<span class="g-val" style="inset-inline-start:' + val + '%"></span>' : '') + '</div></div>';
  }
  function vPM() {
    var K = D.kpis;
    var loggers = {}; S.expenses.forEach(function (e) { loggers[e.loggedBy] = 1; });
    var invitees = S.time === 'fri' ? 0 : IDS.length - 1;
    var contributed = Object.keys(loggers).filter(function (id) { return id !== VIEWER; }).length;
    var active = Object.keys(loggers).length > 1;
    var lead = invitees ? Math.round(100 * contributed / invitees) : null;
    var prim = active && S.closed ? 100 : null;
    var fr = active ? (S.friction > 0 ? 100 : 0) : null;
    var settledAmt = S.payments.reduce(function (n, p) { return n + p.amount; }, 0);
    var pbAmt = S.payments.filter(function (p) { return p.rail === 'paybox'; }).reduce(function (n, p) { return n + p.amount; }, 0);
    var manual = S.payments.filter(function (p) { return p.rail !== 'paybox'; }).length;
    var lastAdd = S.addTimes.length ? S.addTimes[S.addTimes.length - 1] : null;

    var funnel = [
      ['נפתח חשבון', S.created], ['נשלחה הזמנה', S.invited], ['מוזמנים הצטרפו', invitees ? invitees + '/' + (IDS.length - 1) : false],
      ['מוזמנים שרשמו הוצאה (תסריט)', invitees ? contributed + '/' + invitees : false], ['חשבון פעיל', active],
      ['מוזמן צפה מהדפדפן', S.webViewed], ['חובות שנסגרו', S.payments.length ? S.payments.length + '/' + (S.payments.length + transfers().length) : false],
      ['נסגר תוך 7 ימים', S.closed ? 'כן, תוך יום' : false]
    ];
    var primStatus = !active ? 'עוד לא חשבון פעיל' : S.closed ? 'החשבון נסגר תוך יום מתאריך הסיום' : 'פתוח - יש עוד ' + (S.time === 'sun' ? 6 : 7) + ' ימים בחלון';
    return '<div class="pm-head"><h2>מבט מנהל מוצר</h2><button class="iconbtn" data-a="pm" aria-label="סגירת מבט מנהל מוצר">' + icon('close') + '</button></div>' +
      '<p class="pm-hyp"><strong>ההשערה:</strong> לפחות 40% מהחשבונות הפעילים נסגרים במלואם, בכל אמצעי תשלום, תוך 7 ימים מתאריך הסיום. מתחת ל-25% - עוצרים או משנים כיוון.</p>' +
      '<p class="pm-note">זה חשבון הדגמה יחיד. האחוזים מחושבים מהאירועים בהדגמה - חלקם מהלחיצות שלכם וחלקם חלק מהתסריט (החברים ותשלומיהם, מסומנים ביומן). זו המחשה של איך המדדים יימדדו מול היעדים שהצבנו - לא תוצאה ולא נתוני פיילוט.</p>' +
      '<h3>משפך החשבון בהדגמה</h3><ol class="funnel">' + funnel.map(function (f) {
        return '<li class="' + (f[1] ? 'on' : '') + '"><span>' + f[0] + '</span><b>' + (f[1] === true ? icon('check') : f[1] ? f[1] : '-') + '</b></li>';
      }).join('') + '</ol>' +
      '<div class="kpi"><p class="kpi-role">KPI ראשי</p><h4>' + K.primary.name + '</h4>' +
      '<p class="kpi-val">' + (prim == null ? '-' : prim + '%') + ' <span class="muted small">' + primStatus + '</span></p>' +
      gauge(prim, K.primary.failure, K.primary.success, false, 'יעד הצלחה ' + K.primary.success + ' אחוז, כישלון מתחת ל-' + K.primary.failure) +
      '<p class="small muted">יעד: ' + K.primary.success + '% ומעלה · כישלון: מתחת ל-' + K.primary.failure + '%. בהדגמה יש חשבון אחד, לכן הערך הוא 0% או 100%.</p>' +
      '<p class="small">פילוח משני - חלק PayBox מהסכום שנסגר: <strong>' + (settledAmt ? Math.round(100 * pbAmt / settledAmt) + '%' : '-') + '</strong> · חובות שנסגרו רק בסימון: <strong>' + manual + '</strong></p></div>' +
      '<div class="kpi"><p class="kpi-role">KPI מקדים</p><h4>' + K.leading.name + '</h4>' +
      '<p class="kpi-val">' + (lead == null ? '-' : lead + '%') + ' <span class="muted small">' + (invitees ? contributed + ' מתוך ' + invitees + ' מוזמנים רשמו הוצאה' : 'עוד אין מוזמנים') + '</span></p>' +
      gauge(lead, K.leading.failure, K.leading.success, false, 'יעד ' + K.leading.success + ' אחוז, כישלון מתחת ל-' + K.leading.failure) +
      '<p class="small muted">יעד: ' + K.leading.success + '% ומעלה · כישלון: מתחת ל-' + K.leading.failure + '%. בודק את ההנחה המסוכנת - שחברים באמת רושמים הוצאות. בהדגמה ההוצאות של החברים הן חלק מהתסריט.</p></div>' +
      '<div class="kpi"><p class="kpi-role">מדד מגביל</p><h4>' + K.guardrail.name + '</h4>' +
      '<p class="kpi-val">' + (fr == null ? '-' : fr + '%') + ' <span class="muted small">' + S.friction + ' אירועי חיכוך בחשבון</span></p>' +
      gauge(fr, K.guardrail.ok, K.guardrail.stop, true, 'תקין עד ' + K.guardrail.ok + ' אחוז, עצירה מעל ' + K.guardrail.stop) +
      '<p class="small muted">תקין: עד ' + K.guardrail.ok + '% · מעל ' + K.guardrail.stop + '% עוצרים ומתקנים. אפשר להדמות אירוע חיכוך: "יציאה מהחשבון" בתפריט, או "יש פה טעות" בהוצאה של מישהו אחר (האירוע נרשם, המצב לא משתנה).</p></div>' +
      '<div class="kpi slim"><h4>' + K.usability.name + ' (מבחן שמישות)</h4><p class="kpi-val">' + (lastAdd == null ? '-' : lastAdd + ' שניות') + ' <span class="muted small">יעד בבדיקות: פחות מ-' + K.usability.target + ' שניות</span></p></div>' +
      '<h3>יומן אירועים</h3><ol class="evlog" reversed>' + (S.events.length ? S.events.slice().reverse().map(function (e) {
        return '<li><code dir="ltr">' + e.n + '</code> <span>' + (EV[e.n] || e.n) + (e.p.rail ? ' (' + e.p.rail + ')' : '') + (e.story ? ' <em>· חלק מהסיפור</em>' : '') + '</span><span class="muted small">' + e.t + '</span></li>';
      }).join('') : '<li class="muted">עוד אין אירועים - התחילו את ההדגמה.</li>') + '</ol>' +
      '<button class="btn ghost wide" data-a="reset">' + icon('reset') + ' איפוס הדגמה</button>';
  }

  /* ---------- chrome: guide + demo bar ---------- */
  function vGuide() {
    var c = curStep();
    return '<div class="guide-head"><img src="assets/logo.svg" alt="" width="36" height="36"><div><strong>PayBox Split</strong><span>מדריך הדגמה</span></div>' +
      '<button class="guide-toggle" data-a="guide" aria-expanded="' + S.guideOpen + '" aria-controls="guideBody">' + (c < STEPS.length ? 'שלב ' + (c + 1) + ' מתוך ' + STEPS.length : 'סיימתם') + '</button></div>' +
      '<div class="guide-body" id="guideBody"><p class="guide-lead">אב-טיפוס של חשבון משותף לטיול בתוך PayBox: פותחים, רושמים הוצאות, רואים מי חייב למי וסוגרים את החובות.</p>' +
      '<ol class="steps">' + STEPS.map(function (s, i) {
        return '<li class="' + (s.done() ? 'done' : i === c ? 'cur' : '') + '"><span class="n">' + (s.done() ? icon('check') : i + 1) + '</span><span><strong>' + s.t + '</strong>' +
          (i === c ? '<span class="h">' + s.h + '</span>' : '') + '</span></li>';
      }).join('') +
      '<li class="' + (c === STEPS.length ? 'cur' : '') + '"><span class="n">9</span><span><strong>מבט מנהל מוצר</strong>' + (c === STEPS.length ? '<span class="h">איך ההדגמה מודדת את ההשערה.</span>' : '') + '</span></li></ol>' +
      '<div class="guide-actions"><button class="btn primary wide" data-a="pm" aria-pressed="' + S.pmOpen + '">' + icon('chart') + ' מבט מנהל מוצר</button>' +
      '<button class="btn ghost wide" data-a="reset">' + icon('reset') + ' איפוס הדגמה</button></div>' +
      '<p class="guide-foot">אב-טיפוס אקדמי - קונספט של סטודנטים, לא מוצר רשמי של PayBox</p></div>';
  }
  function vDemobar() {
    var btn = '';
    if (S.created && S.invited && S.time === 'fri') btn = '<button class="skip-btn' + hint(2) + '" data-a="skip">דילוג למוצ״ש</button>';
    else if (S.time === 'sat' && S.viewerAdded) btn = '<button class="skip-btn' + hint(6) + '" data-a="skip">דילוג ליום ראשון</button>';
    return '<span class="demo-tag">הדגמה</span><span class="demo-time">' + D.times[S.time].label + '</span>' + btn;
  }

  /* ---------- render ---------- */
  var lastRoute = null, pmOpener = null;
  function focusKey(el) { if (!el || !el.dataset || !el.dataset.a) return null; return '[data-a="' + el.dataset.a + '"]' + (el.dataset.v ? '[data-v="' + el.dataset.v + '"]' : '') + (el.dataset.to ? '[data-to="' + el.dataset.to + '"]' : ''); }
  function render() {
    var ae = document.activeElement, fk = focusKey(ae), fIn = ae && ae.closest ? ae.closest('#guide, #screen, #pm') : null;
    var r = routeFromHash();
    if (location.hash !== '#/' + r && !(r === 'tab' && location.hash === '#/balances')) { history.replaceState(null, '', '#/' + r); }
    S.route = r;
    if (r === 'tab' && S.tabView === 'balances' && !S.balancesViewed && S.expenses.length) { S.balancesViewed = true; track('balance_viewed'); }
    var html = { start: vStart, home: vHome, create: vCreate, invite: vInvite, tab: vTab, add: vAdd, web: vWeb, dana: vDana, done: vDone }[r]();
    var scr = document.getElementById('screen');
    scr.innerHTML = html;
    scr.className = 'screen r-' + r;
    document.getElementById('demobar').innerHTML = vDemobar();
    document.getElementById('demobar').hidden = r === 'start';
    var g = document.getElementById('guide'); g.innerHTML = vGuide(); g.classList.toggle('open', !!S.guideOpen);
    var pm = document.getElementById('pm'); pm.hidden = !S.pmOpen; if (S.pmOpen) pm.innerHTML = vPM();
    document.getElementById('stage').classList.toggle('pm-open', !!S.pmOpen);
    if (r !== lastRoute) { scr.scrollTop = 0; var h = scr.querySelector('h1'); if (h && lastRoute !== null) h.focus({ preventScroll: true }); }
    else if (fk && fIn && !fIn.hidden) { var back = fIn.querySelector(fk); if (back) back.focus({ preventScroll: true }); }
    lastRoute = r;
    if (r === 'add') updatePerHead();
    animateAmount();
    if (r === 'done') confetti();
    save();
  }
  function animateAmount() {
    var el = document.getElementById('myAmt');
    if (!el || el.dataset.from === '') return;
    var from = +el.dataset.from, to = +el.dataset.to; S.animFrom = null; save();
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.innerHTML = money(to); return; }
    var t0 = null;
    function step(ts) { if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / 900); el.innerHTML = money(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); else el.classList.add('flash'); }
    setTimeout(function () { requestAnimationFrame(step); }, 250);
  }
  function confetti() {
    var box = document.getElementById('confetti'); if (!box) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cols = ['#FF7A59', '#1F5E4B', '#F2C14E', '#2E9E6A', '#FAF7F2'], out = '';
    for (var i = 0; i < 36; i++) out += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + cols[i % 5] + ';animation-delay:' + (Math.random() * .6).toFixed(2) + 's;transform:rotate(' + (Math.random() * 360 | 0) + 'deg)"></i>';
    box.innerHTML = out;
  }

  /* ---------- sheets & toast ---------- */
  var lastFocus = null, payTimer = null;
  function setInert(on) { ['screen', 'demobar', 'guide', 'pm'].forEach(function (id) { var el = document.getElementById(id); if (el) { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); } }); }
  function sheet(html) {
    var w = document.getElementById('sheetWrap');
    if (w.hidden) lastFocus = document.activeElement;
    setInert(true);
    w.innerHTML = '<div class="scrim" data-a="closesheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">' + html + '</div>';
    w.hidden = false;
    var f = w.querySelector('.sheet button, .sheet [tabindex]'); if (f) f.focus();
  }
  function closeSheet() {
    clearTimeout(payTimer); payTimer = null;
    var w = document.getElementById('sheetWrap'), was = !w.hidden; w.hidden = true; w.innerHTML = ''; setInert(false);
    if (was && lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  var toastT;
  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2800); }

  function settleSheet(to) {
    var t = myDebts().filter(function (x) { return x.to === to; })[0]; if (!t) return;
    sheet('<h2 id="sheetTitle">לסגור את החוב ל' + esc(name(to)) + '</h2><p class="bigmoney center">' + money(t.amount) + '</p>' +
      '<p class="muted center">מתוך יתרת PayBox שלך (' + money(walletBalance()) + ')</p>' +
      '<p class="fake">תשלום דמה - לא עובר כסף אמיתי ואין חיוב</p>' +
      (walletBalance() >= t.amount ? '<button class="btn primary big' + hint(7) + '" data-a="pay" data-to="' + to + '">לשלם ' + money(t.amount) + ' ב-PayBox (דמה)</button>'
        : '<p class="err">אין מספיק יתרה בארנק הדמה לתשלום הזה</p>') +
      '<p class="muted small center">שילמת בביט או במזומן? מי שמגיע לו הכסף מסמן את החוב כסגור.</p>' +
      '<button class="btn link" data-a="closesheet">ביטול</button>');
  }

  /* ---------- actions ---------- */
  function dayToSat() {
    S.time = 'sat';
    D.members.forEach(function (m) { if (m.id !== VIEWER) track('invitee_joined', { who: m.id }, true); });
    D.seedExpenses.forEach(function (e) {
      if (S.expenses.some(function (x) { return x.id === e.id; })) return;
      S.expenses.push(JSON.parse(JSON.stringify(e)));
      if (e.loggedBy !== VIEWER) track('expense_added', { by: e.loggedBy, amount: e.amount, web: !!e.viaWeb }, true);
    });
  }
  function dayToSun() {
    S.time = 'sun';
    for (var guard = 0; guard < 6; guard++) {
      var ts = transfers().filter(function (t) { return t.from !== VIEWER && t.to !== VIEWER; });
      if (!ts.length) break;
      ts.forEach(function (t) {
        var rail = M[t.from].wallet === 'bit' ? 'bit' : 'paybox';
        S.payments.push({ from: t.from, to: t.to, amount: t.amount, rail: rail });
        track(rail === 'paybox' ? 'settled_paybox' : 'marked_settled', { from: t.from, to: t.to, rail: rail }, true);
      });
    }
  }
  function checkClosed() {
    if (!S.closed && allEven()) { S.closed = true; track('tab_closed'); return true; }
    return false;
  }

  var A = {
    begin: function () { go('home'); },
    nav: function (el) { closeSheet(); if (el.dataset.to === 'balances') S.tabView = 'balances'; else if (el.dataset.to === 'tab') S.tabView = S.tabView || 'expenses'; go(el.dataset.to === 'balances' ? 'balances' : el.dataset.to); },
    notdemo: function () { toast('הכפתור הזה לא חלק מההדגמה - רק PayBox Split'); },
    create: function () { if (!S.created) { S.created = true; track('tab_created', { members: IDS.length, end: D.tab.end }); } go('invite'); },
    invite: function () { if (!S.invited) { S.invited = true; track('invite_sent', { channel: 'whatsapp' }); } toast('נשלח לקבוצה (דמה)'); render(); },
    copy: function () { toast('הקישור הועתק (דמה)'); },
    skip: function () {
      if (S.time === 'fri') { if (!S.invited) { S.invited = true; track('invite_sent', { channel: 'whatsapp' }); } dayToSat(); track('time_skip', { to: 'sat' }); S.tabView = 'expenses'; toast('מוצ״ש: החברים רשמו 6 הוצאות'); go('tab'); }
      else if (S.time === 'sat') { if (!S.viewerAdded) { toast('קודם מוסיפים את ההוצאה האחרונה'); go('tab'); return; } dayToSun(); track('time_skip', { to: 'sun' }); checkClosed(); toast('יום ראשון: החברים סגרו את החובות שלהם'); go(S.closed ? 'done' : 'home'); }
    },
    view: function (el) { S.tabView = el.dataset.v; history.replaceState(null, '', el.dataset.v === 'balances' ? '#/balances' : '#/tab'); render(); },
    payer: function (el) { [].forEach.call(document.querySelectorAll('#payer .chip'), function (c) { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); }); el.classList.add('on'); el.setAttribute('aria-pressed', 'true'); },
    part: function (el) { var on = !el.classList.contains('on'); el.classList.toggle('on', on); el.setAttribute('aria-pressed', String(on)); updatePerHead(); },
    expense: function (el) {
      var e = S.expenses.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!e) return;
      var sh = shares(e);
      sheet('<h2 id="sheetTitle">' + esc(e.title) + '</h2><p class="bigmoney center">' + money(e.amount * 100) + '</p>' +
        '<p class="muted center">שולם ע״י ' + esc(name(e.payer)) + ' · נרשם ע״י ' + esc(name(e.loggedBy)) + (e.viaWeb ? ' מהדפדפן' : '') + '</p>' +
        '<ul class="shares">' + Object.keys(sh).map(function (id) { return '<li>' + avatar(id, 'sm') + esc(name(id)) + money(sh[id]) + '</li>'; }).join('') + '</ul>' +
        (e.loggedBy === VIEWER && !S.closed ? '<button class="btn ghost wide" data-a="delexp" data-id="' + e.id + '">מחיקת ההוצאה שלי</button>' :
          e.loggedBy !== VIEWER && !S.closed ? '<button class="btn ghost wide" data-a="editother">יש פה טעות - לערוך</button>' : '') +
        '<button class="btn link" data-a="closesheet">סגירה</button>');
    },
    editother: function () { S.friction++; track('friction_edit_other'); closeSheet(); toast('הדמיה: העריכה לא מתבצעת, רק נספרת כאירוע חיכוך במבט מנהל מוצר'); render(); },
    delexp: function (el) {
      S.expenses = S.expenses.filter(function (x) { return x.id !== el.dataset.id; });
      if (!S.expenses.some(function (x) { return x.loggedBy === VIEWER && x.id.indexOf('u') === 0; })) S.viewerAdded = false;
      track('expense_deleted_own'); closeSheet(); toast('ההוצאה נמחקה'); render();
    },
    menu: function () {
      sheet('<h2 id="sheetTitle">אפשרויות</h2><button class="btn ghost wide" data-a="nav" data-to="invite">שליחת הקישור שוב</button>' +
        '<button class="btn ghost wide danger" data-a="leave">יציאה מהחשבון</button><button class="btn link" data-a="closesheet">סגירה</button>');
    },
    leave: function () {
      sheet('<h2 id="sheetTitle">לצאת מהחשבון?</h2><p>החובות שלך נשארים פתוחים, והחברים יראו שיצאת.</p>' +
        '<button class="btn primary wide danger-fill" data-a="leaveok">כן, לצאת</button><button class="btn link" data-a="closesheet">ביטול</button>');
    },
    leaveok: function () { S.friction++; track('friction_member_left'); closeSheet(); toast('הדמיה: לא יוצאים באמת - היציאה נספרת כאירוע חיכוך'); render(); },
    settle: function (el) { settleSheet(el.dataset.to); },
    pay: function (el) {
      var to = el.dataset.to, t = myDebts().filter(function (x) { return x.to === to; })[0]; if (!t || el.disabled) return;
      el.disabled = true; el.innerHTML = '<span class="spin" aria-hidden="true"></span> משלמים...';
      clearTimeout(payTimer);
      payTimer = setTimeout(function () {
        payTimer = null;
        var still = myDebts().filter(function (x) { return x.to === to && x.amount === t.amount; })[0];
        if (!still || document.getElementById('sheetWrap').hidden) return;
        S.payments.push({ from: VIEWER, to: to, amount: t.amount, rail: 'paybox' });
        track('settled_paybox', { from: VIEWER, to: to, rail: 'paybox' });
        closeSheet();
        if (checkClosed()) { go('done'); } else { toast('שולם ל' + name(to)); render(); }
        save();
      }, 900);
    },
    mark: function (el) {
      var from = el.dataset.from;
      sheet('<h2 id="sheetTitle">' + esc(name(from)) + ' שילם מחוץ ל-PayBox?</h2><button class="btn primary wide" data-a="vmark" data-from="' + from + '" data-rail="bit">קיבלתי בביט - סמן כסגור</button>' +
        '<button class="btn ghost wide" data-a="vmark" data-from="' + from + '" data-rail="cash">קיבלתי במזומן</button><button class="btn link" data-a="closesheet">ביטול</button>');
    },
    vmark: function (el) {
      var t = owedToMe().filter(function (x) { return x.from === el.dataset.from; })[0]; if (!t) return;
      S.payments.push({ from: t.from, to: VIEWER, amount: t.amount, rail: el.dataset.rail }); track('marked_settled', { rail: el.dataset.rail });
      closeSheet(); if (checkClosed()) go('done'); else render();
    },
    signup: function () {
      track('signup_prompt');
      sheet('<h2 id="sheetTitle">תשלום ב-PayBox</h2><p>כדי לשלם ב-PayBox צריך הרשמה קצרה - רק עכשיו, ברגע התשלום. עד עכשיו רוני צפה ורשם הוצאה בלי חשבון.</p>' +
        '<p class="fake">בהדגמה אין הרשמה ואין שדות אמיתיים</p><button class="btn primary wide" data-a="closesheet">הבנתי</button>'); save();
    },
    dmark: function (el) {
      var t = transfers().filter(function (x) { return x.from === 'roni'; })[0]; if (!t) return;
      S.payments.push({ from: 'roni', to: t.to, amount: t.amount, rail: el.dataset.rail });
      S.danaMarked = true; track('marked_settled', { from: 'roni', to: t.to, rail: el.dataset.rail });
      toast('החוב של רוני סומן כסגור'); S.tabView = 'balances';
      if (checkClosed()) go('done'); else go('balances');
    },
    nexttab: function () { if (!S.nextTabIntent) { S.nextTabIntent = true; track('next_tab_cta'); } toast('בגרסה המלאה נפתח כאן חשבון חדש. נספר במבט מנהל מוצר כסימן להרגל'); render(); },
    pm: function (el) {
      S.pmOpen = !S.pmOpen;
      if (S.pmOpen && el && !el.closest('#pm')) pmOpener = focusKey(el);
      render();
      if (S.pmOpen) { var p = document.getElementById('pm'); p.scrollTop = 0; var h = p.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } }
      else { var b = pmOpener && document.querySelector(pmOpener); if (b) b.focus(); }
    },
    guide: function () { S.guideOpen = !S.guideOpen; render(); },
    reset: function () {
      try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      mem = null; S = fresh(); closeSheet(); lastRoute = null; toast('ההדגמה אופסה'); go('start');
    },
    closesheet: function () { closeSheet(); }
  };

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-a]'); if (!el) return;
    var fn = A[el.dataset.a]; if (!fn) return;
    ev.preventDefault(); fn(el); save();
  });
  document.addEventListener('input', function (ev) { if (ev.target.id === 'amt') updatePerHead(); });
  document.addEventListener('submit', function (ev) {
    if (ev.target.id !== 'addForm') return;
    ev.preventDefault();
    var st = addFormState(), err = document.getElementById('addErr');
    if (!(st.amt > 0) || st.amt > 20000) { err.textContent = 'סכום בין 1 ל-20,000 ₪'; document.getElementById('amt').focus(); return; }
    if (!st.parts.length) { err.textContent = 'צריך לפחות אדם אחד בחלוקה'; return; }
    var before = myDebts().reduce(function (n, t) { return n + t.amount; }, 0);
    var isDefault = st.payer === VIEWER && st.parts.length === IDS.length;
    S.expenses.push({ id: 'u' + Date.now(), title: st.title, payer: st.payer, amount: Math.round(st.amt * 100) / 100, split: st.parts.length === IDS.length ? 'all' : st.parts, loggedBy: VIEWER });
    var secs = Math.max(1, Math.round((Date.now() - addOpenedAt) / 1000));
    S.addTimes.push(secs); S.viewerAdded = true;
    track('expense_added', { by: VIEWER, amount: st.amt, default_split: isDefault, secs: secs });
    var after = myDebts().reduce(function (n, t) { return n + t.amount; }, 0);
    S.animFrom = before > 0 && after > 0 && after < before ? before : null;
    S.tabView = 'expenses'; history.replaceState(null, '', '#/tab'); render();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (!document.getElementById('sheetWrap').hidden) closeSheet();
    else if (S.pmOpen) { A.pm(document.getElementById('pm')); save(); }
  });
  window.addEventListener('hashchange', render);
  if (!location.hash) history.replaceState(null, '', '#/' + (S.route || 'start'));
  render();
  window.__split = { state: function () { return S; }, transfers: transfers, balances: balances };
})();
