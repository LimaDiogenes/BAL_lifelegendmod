'use strict';
// Antagonistes et organisations (2.0) : le premier club passe dans « Clubs & organisations » (voix officielle) ; les
// antagonistes piquent sur Kop après les matchs et les achats de luxe, provoquent de temps en temps (une décision), et
// n'ont ni anniversaire, ni journée en famille, ni messages privés. Réglage « Vie du club ».

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const req = (p) => require(path.join(__dirname, '..', p));

const { normalizePersona } = req('src/world/persona.js');
const { tickAntagonists, antagonistFlex } = req('src/world/antagonists.js');
const { buildCircleKopReaction } = req('src/world/lifeScenes.js');
const { resolveCalendarDecision } = req('src/world/calendarEvents.js');
const { deliverFollowUps } = req('src/world/eventAftermath.js');
const { tickClubLife } = req('src/world/clubLife.js');

const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const D0 = '2027-09-01';
const career = () => ({
  careerId: 'rv1',
  profile: { handle: 'rui', displayName: 'Rui', followers: 40000 },
  snapshot: { gameDate: D0, club: { name: 'Lyon' }, player: { name: 'Rui' }, fixtures: [] },
  persona: normalizePersona({ circle: {
    family: [{ name: 'Ana', role: 'Sister', kopPersonality: 'playful' }],
    rivals: [{ name: 'Marco Bianchi', role: 'Rival', kopPersonality: 'rival_player' }, { name: 'TrollKing', role: 'Hater', kopPersonality: 'hater' }],
    roots: [{ name: 'AS Brionnais', role: 'Premier club', kopPersonality: 'supportive' }],
  } }),
  calendar: { simDate: D0, customEvents: [], systemEvents: [], pendingDecisions: [], resolvedDecisionIds: [] },
  lifeHub: { calibrated: true, stage: 'rising', cash: 0, meters: { sponsors: 50, media: 50, fans: 50, manager: 50, squad: 50 }, sponsors: [], assets: [], ledger: [], recentEvents: [], scenes: [], obligations: [] },
  feed: [], mail: [],
});
let n = 0;
const newId = () => `r${++n}`;
const result = (i, me, score) => ({ id: `m${i}`, date: addDays(D0, i), home: 'Lyon', away: 'Opp', score, me });

test('le premier club rangé dans « Racines » devient une organisation à voix officielle', () => {
  const st = career();
  assert.strictEqual(st.persona.circle.roots.length, 0);
  assert.strictEqual(st.persona.circle.orgs[0].name, 'AS Brionnais');
  assert.strictEqual(st.persona.circle.orgs[0].kopPersonality, 'official');
  const text = buildCircleKopReaction({ name: 'AS Brionnais', kopPersonality: 'official' }, '@rui', 'match', 'en', 's', st);
  assert.ok(/@rui/.test(text) && !/love you|miss you/i.test(text));
});

test('les antagonistes réagissent aux matchs (plus souvent après un mauvais), jamais avec un {X} oublié', () => {
  const st = career();
  let good = 0, bad = 0;
  for (let i = 0; i < 30; i += 1) {
    const before = st.feed.length;
    const badGame = i % 2 === 0;
    tickAntagonists(st, { newResults: [result(i, badGame ? { minutes: 90, goals: 0, assists: 0, rating: 5.6 } : { minutes: 90, goals: 1, assists: 0, rating: 7.8 }, badGame ? [0, 2] : [2, 0])] }, addDays(D0, i), { language: 'en', newId });
    const posted = st.feed.slice(before).filter((p) => p.antagonist && !/provoke/.test(p.id));
    if (posted.length) badGame ? bad += 1 : good += 1;
  }
  assert.ok(bad >= 6, `${bad} réactions après 15 mauvais matchs`);
  assert.ok(good >= 3, `${good} réactions après 15 bons matchs`);
  assert.ok(st.feed.every((p) => !/\{[A-Z]\}/.test(p.text)));
  assert.ok(st.feed.filter((p) => p.antagonist).every((p) => p.author.type === 'rival'));
});

test('une provocation de temps en temps ouvre une décision ; ignorer plaît au coach', () => {
  const st = career();
  let dec = null;
  for (let i = 0; i < 45 && !dec; i += 1) dec = tickAntagonists(st, { newResults: [] }, addDays(D0, i), { language: 'en', newId }).decision;
  assert.ok(dec && dec.kind === 'rival_provocation' && dec.quote, 'une provocation avec la phrase');
  const before = st.lifeHub.meters.manager;
  resolveCalendarDecision(st, dec.id, 'rival_ignore', dec.date, { language: 'en', newId });
  assert.ok(st.lifeHub.meters.manager > before);
});

test('un achat de luxe peut faire réagir un antagoniste ; une petite dépense, jamais', () => {
  const st = career();
  let hits = 0;
  for (let i = 0; i < 20; i += 1) if (antagonistFlex(st, { id: `a${i}`, catalogId: 'car_supercar', category: 'car', price: 300000 }, addDays(D0, i), { language: 'en', newId })) hits += 1;
  assert.ok(hits >= 3 && hits <= 14, `${hits} sur 20`);
  assert.strictEqual(antagonistFlex(st, { id: 'cheap', catalogId: 'x', category: 'car', price: 1000 }, D0, { language: 'en', newId }), null);
});

test('ni messages privés ni « tu nous manques » de la part des antagonistes et des organisations', () => {
  const st = career();
  st.circleTime = {};
  st.circleStartedOn = addDays(D0, -200);
  deliverFollowUps(st, D0, { language: 'en', newId });
  const writers = (st.dms || []).filter((t) => t.messages.length).map((t) => t.name);
  assert.ok(writers.every((w) => w === 'Ana'), writers.join(','));
});

test('réglage « Vie du club » : très active > normale > calme', () => {
  const count = (level) => {
    const st = career();
    let asks = 0;
    for (let i = 0; i < 42; i += 1) {
      const d = addDays(D0, i);
      const { ask } = tickClubLife(st, d, { language: 'en', newId, level });
      if (ask) { asks += 1; resolveCalendarDecision(st, ask.id, 'club_quick', d, { language: 'en', newId }); }
    }
    return asks;
  };
  const low = count('low'), normal = count('normal'), high = count('high');
  assert.ok(low < normal && normal < high, `${low} / ${normal} / ${high}`);
});
