# Texts (no AI)

All built-in texts that have variants live here. Each variant is one entry with the six languages:
`{ fr, en, pt, es, it, de }`. The app picks among them with `pickFresh` (lifeScenes.js), which avoids repeats.

| File | What |
|---|---|
| `scenes.js` | "My life" scenes: purchases, dilemmas, days off, calendar events (people, persona, media) |
| `kop.js` | Kop posts by close ones (per personality) and by brands |
| `messages.js` | Private messages from close ones after an event; "we miss you" (near and far) |
| `club.js` | The club's own posts (most days), its media team's small asks and their follow-up posts, big-ask mails |
| `posts.js` | Posts by clubs, competitions, media, coach, etc. (one structure per language) |
| `catalog.js` | Display names of the shop items |

**Add a variant:** add one entry to the right list. Keep the same `{X}` placeholders in every language
(each list's comment says what they mean). `tests/texts.test.js` fails if a language or placeholder is missing.

**Add a new choice** (a new button in a decision): that is not a text variant. It needs the choice and its
effects (personaEvents.js / calendarEvents.js / mediaOffers.js), its label in `lifelegend/app.js`
(`ML_DECISION_CHOICE_LABELS`), and the label in the five dictionaries `lifelegend/i18n/*.js`.
