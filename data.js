/* PayBox Split - demo data (mock only; single source of truth for the scenario).
   Must match research/direction.md "Locked for prototype". Amounts in whole ILS. */
window.SPLIT_DATA = {
  product: 'PayBox Split',
  tab: {
    name: 'סופ״ש בגליל',
    start: '16.10.2026',
    end: '17.10.2026',
    days: 2,
    link: 'split.demo/t/galil'
  },
  viewerId: 'yuval',
  // order matters: used as the deterministic tie-break in the netting algorithm
  members: [
    { id: 'yuval', name: 'יובל', wallet: 'paybox', color: '#1F5E4B', viewer: true },
    { id: 'dana',  name: 'נעה',  wallet: 'paybox', color: '#B4472C' },
    { id: 'itai',  name: "ג'קי", wallet: 'paybox', color: '#3E5C8A' },
    { id: 'gal',   name: 'גל',   wallet: 'paybox', color: '#7A4E9E' },
    { id: 'maya',  name: 'סאלי', wallet: 'paybox', color: '#8A6A12' },
    { id: 'roni',  name: 'אריאל', wallet: 'bit',    color: '#2F7D7A' }
  ],
  // expenses 1-7 exist when the story jumps to Saturday night; #8 is added live by the viewer
  seedExpenses: [
    { id: 'e1', title: 'צימר, 2 לילות',        payer: 'dana',  amount: 2400, split: 'all', loggedBy: 'dana' },
    { id: 'e2', title: 'דלק בדרך לצפון',       payer: 'yuval', amount: 360,  split: 'all', loggedBy: 'yuval' },
    { id: 'e3', title: 'סופר לשישי',            payer: 'gal',   amount: 540,  split: 'all', loggedBy: 'gal' },
    { id: 'e4', title: 'ארוחת ערב בראש פינה',  payer: 'itai',  amount: 780,  split: 'all', loggedBy: 'itai' },
    { id: 'e5', title: 'קיאקים בירדן',          payer: 'maya',  amount: 480,  split: ['yuval', 'dana', 'itai', 'maya'], loggedBy: 'maya' },
    { id: 'e6', title: 'יין וגבינות ביקב',     payer: 'roni',  amount: 300,  split: 'all', loggedBy: 'roni', viaWeb: true },
    { id: 'e7', title: 'ארוחת בוקר',            payer: 'itai',  amount: 240,  split: 'all', loggedBy: 'itai' }
  ],
  suggestedExpense: { title: 'חניה ודלק בחזור', amount: 180 },
  viewerWalletBalance: 1240,
  // story clock shown in the demo bar
  times: {
    fri: { label: 'שישי 16.10, 09:30', short: 'שישי בבוקר' },
    sat: { label: 'מוצ״ש 17.10, 21:10', short: 'מוצ״ש' },
    sun: { label: 'ראשון 18.10, 20:00', short: 'יום ראשון' }
  },
  // KPI targets from research/direction.md section 8 (hypothesis thresholds, not results)
  kpis: {
    primary:   { name: 'שיעור סגירה תוך 7 ימים (כל מסילה)', en: '7-day settle rate (any rail)', success: 40, failure: 25,
                 formula: 'חשבונות פעילים שכל החובות בהם נסגרו תוך 7 ימים מתאריך הסיום / חשבונות פעילים שהגיעו לתאריך הסיום' },
    leading:   { name: 'שיעור תרומת מוזמנים', en: 'Invitee contribution rate', success: 40, failure: 20,
                 formula: 'מוזמנים שרשמו לפחות הוצאה אחת עד תאריך הסיום / מוזמנים שהצטרפו (בלי פותח החשבון)' },
    guardrail: { name: 'שיעור חיכוך', en: 'Friction rate', ok: 10, stop: 15,
                 formula: 'חשבונות פעילים עם יציאה של חבר, או עריכה/מחיקה של הוצאה בידי מי שלא רשם אותה / חשבונות פעילים' },
    usability: { name: 'זמן הוספת הוצאה', target: 30 }
  }
};
