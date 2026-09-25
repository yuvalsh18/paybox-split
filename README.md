# PayBox Split - clickable prototype (Part D)

Academic prototype, Hebrew RTL, mobile-first. A student concept, **not an official PayBox product**. All data, people and payments are fake. There are no real login, payment or contact fields.

## Run
- Double-click `index.html`, or
- `python -m http.server 8765` inside this folder and open http://localhost:8765
- Desktop: phone frame (390x844) + a demo guide + the "מבט מנהל מוצר" panel. Phone: full screen, the guide collapses into a "שלב X מתוך 8" pill.
- "איפוס הדגמה" (in the guide and at the bottom of the PM panel) clears the saved state (`localStorage`, key `pbsplit-demo-v1`).

## Files
| File | What |
|---|---|
| `index.html` | Shell: guide, phone, PM panel, disclaimers |
| `styles.css` | Palette A "ערב בגליל" (pine `#1F5E4B`, coral `#FF7A59`, Rubik), logical CSS properties only |
| `data.js` | Scenario - single source of truth (members, 7 seeded expenses, suggested 8th, KPI thresholds) |
| `app.js` | Hash router, ledger maths (agorot integers, greedy fewest transfers), event log, PM metrics |
| `assets/logo.svg` | Original mark: a receipt with a zig-zag edge cut into two halves |

## Grader walkthrough (about 90 seconds)
בואו נתחיל -> פותחים חשבון -> יוצרים ומזמינים -> שולחים בוואטסאפ -> דילוג למוצ״ש -> + הוצאה -> שומרים (530 -> 380) -> מי חייב למי (5 instead of 38) -> איך אריאל רואה את זה? -> אריאל שילם במזומן - לראות את הצד של נעה -> קיבלתי במזומן - סמן כסגור -> דילוג ליום ראשון -> לסגור עכשיו -> לשלם ב-PayBox -> סגרנו! -> מה זה אומר למנהל המוצר?

## MVP features -> screens
| Feature | Where |
|---|---|
| F1 open tab + invite link; invitee views without signup, signup only at settle | `#/create`, `#/invite`, `#/web` (אריאל) |
| F2 add expense, equal split preselected, untick who wasn't there | `#/add` |
| F3 who owes whom, fewest transfers | `#/balances` |
| F4 one-tap settle in PayBox, or creditor marks settled (cash - "קיבלתי במזומן") | settle sheet, `#/dana`, "סמן כסגור" rows |
| Not built (cut from the MVP) | reminders, custom split, receipt photo/OCR, multi-currency, recurring bills, payment links. The UI never names a competitor wallet: anyone outside PayBox pays in cash (team decision 2026-09-25) |

## Psychology map (principle -> screen -> element)
| Principle | Screen | Concrete UI element |
|---|---|---|
| Default effect (Thaler & Sunstein, 2008) | `#/add` | Payer "אני" and "חלוקה שווה בין כולם - מסומן מראש" are preselected; amount is the only thing to check. The event `expense_added` records `default_split` |
| Zeigarnik effect (Zeigarnik, 1927) | `#/home` | The open-tab card with an unfinished ring (x/6) stays pinned at the top until every balance is zero, then disappears. It is the return trigger - there is no push reminder in the MVP |
| Social proof (Cialdini, 2021) | `#/tab`, `#/balances`, `#/home` | "4 מתוך 6 כבר סגרו - נשאר רק החוב שלך" with ticked avatars; the ring shows the same count. Hidden while nobody has settled (a "0 of 6" strip would work against the principle) |
| Peak-end rule (Kahneman et al., 1993) | `#/done` | Confetti, "סגרנו!", trip recap (days, people, total, priciest item, 5 transfers vs 38) and "פותחים חשבון לטיול הבא" |
| Face-saving (design rationale) | `#/balances` | Neutral rows ("פתוח"), nobody is labelled late; only the creditor can mark a debt settled |

## PM view (company value, D2/D3)
Everything in the panel is computed from the viewer's own clicks - no invented results:
- Funnel for the demo tab: created -> invite sent -> invitees joined -> invitees who logged -> active tab -> invitee viewed on web -> debts closed -> closed within 7 days.
- Primary KPI "7-day settle rate (any rail)" vs targets >=40% / <25%; secondary: PayBox share of the settled amount and number of debts closed only by a manual mark.
- Leading KPI "invitee contribution rate" vs >=40% / <20%.
- Guardrail "friction rate" vs <=10% OK / >15% stop - try "יציאה מהחשבון" in the tab menu or "יש פה טעות - לערוך" on someone else's expense.
- Time to add an expense (usability target under 30 s) and the raw event log (`tab_created`, `invite_sent`, `expense_added`, `invite_viewed_web`, `signup_prompt`, `marked_settled`, `settled_paybox`, `tab_closed`, ...). Events that are part of the scripted story are tagged "חלק מהסיפור".
With one demo tab, the primary KPI can only be 0% or 100% - the panel says so.

## Accessibility & quality notes
Buttons are real `<button>`s with a 44px minimum; focus moves to the screen title on route change; bottom sheets are `role="dialog"`, close with Esc and return focus; toasts use `aria-live`; `prefers-reduced-motion` disables confetti and animations; amounts are bidi-isolated (`dir="ltr"`) so "2,400 ₪" never flips.
