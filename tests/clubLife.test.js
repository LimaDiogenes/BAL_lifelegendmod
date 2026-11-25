'use strict';
// Le club vit (2.0, round B) : posts presque tous les jours (toujours le jour de match), petites demandes 1 à 2 fois par
// semaine (jamais un jour de match), grandes demandes 1 à 2 fois par mois par mail, et trop de refus se remarquent.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const req = (p) => require(path.join(__dirname, '..', p));

const { tickClubLife, tickClubPosts, PASSES_NOTICED } = req('src/world/clubLife.js');
const { tickMediaOffers, answerMediaOffer } = req('src/world/mediaOffers.js');
const { resolveCalendarDecision } = req('src/world/calendarEvents.js');

const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const START = '2027-09-01';
const fixtures = Array.from({ length: 20 }, (_, i) => ({ id: `f${i}`, date: addDays(START, 3 + i * 7), home: i % 2 ? 'Rivals' : 'Lyon', away: i % 2 ? 'Lyon' : `Opp${i}`, played: false }));
const career = () => ({
  careerId: 'club1',
  profile: { handle: 'rui', displayName: 'Rui', followers: 50000 },
  snapshot: { gameDate: START, club: { name: 'Lyon' }, player: { name: 'Rui' }, fixtures },
  persona: { circle: {} },
  calendar: { simDate: START, customEvents: [], systemEvents: [], pendingDecisions: [], resolvedDecisionIds: [] },
  lifeHub: { calibrated: true, stage: 'rising', cash: 0, meters: { sponsors: 50, media: 50, fans: 50, manager: 50, squad: 50 }, sponsors: [], assets: [], ledger: [], recentEvents: [], scenes: [], obligations: [] },
  feed: [], mail: [],
});
let n = 0;
const newId = () => `c${++n}`;
const clubPosts = (st) => st.feed.filter((p) => p.clubLife);

test('le club poste presque tous les jours, toujours le jour de match, jamais deux fois le même jour', () => {
  const st = career();
  for (let i = 0; i < 28; i += 1) { const d = addDays(START, i); tickClubPosts(st, d, { language: 'en', newId }); tickClubPosts(st, d, { language: 'en', newId }); }
  const posts = clubPosts(st);
  assert.ok(posts.length >= 16 && posts.length <= 28, `${posts.length} posts en 4 semaines`);
  assert.strictEqual(new Set(posts.map((p) => p.gameDate)).size, posts.length, 'un seul post par jour');
  for (const f of fixtures.filter((x) => x.date < addDays(START, 28))) assert.ok(posts.some((p) => p.gameDate === f.date), `jour de match ${f.date}`);
  assert.ok(posts.every((p) => p.author.type === 'club' && p.official));
  assert.ok(posts.every((p) => !/\{[A-Z]\}/.test(p.text)), 'aucun {X} oublié');
});

test('petites demandes : 1 à 2 par semaine, jamais un jour de match ; le club publie le résultat', () => {
  const st = career();
  const asks = [];
  for (let i = 0; i < 28; i += 1) {
    const d = addDays(START, i);
    st.calendar.simDate = d;
    const { ask } = tickClubLife(st, d, { language: 'en', newId });
    if (ask) {
      asks.push(ask);
      assert.ok(!fixtures.some((f) => f.date === d), 'pas un jour de match');
      const before = clubPosts(st).length;
      resolveCalendarDecision(st, ask.id, 'club_full', d, { language: 'en', newId });
      assert.ok(clubPosts(st).length > before && clubPosts(st).at(-1).text.includes('@rui'), 'le club publie et le tague');
      assert.strictEqual(st.lifeHub.scenes[0].artId, 'club_ask', 'une scène avec son image');
    }
  }
  assert.ok(asks.length >= 4 && asks.length <= 9, `${asks.length} demandes en 4 semaines`);
});

test('trop de refus en peu de temps : le coach le remarque', () => {
  const st = career();
  const seen = [];
  for (let i = 0; i < 40 && seen.length < PASSES_NOTICED + 1; i += 1) {
    const d = addDays(START, i);
    const { ask } = tickClubLife(st, d, { language: 'en', newId });
    if (!ask) continue;
    seen.push(ask.choices.find((c) => c.id === 'club_pass').effects);
    resolveCalendarDecision(st, ask.id, 'club_pass', d, { language: 'en', newId });
  }
  assert.deepStrictEqual(seen.slice(0, PASSES_NOTICED), Array(PASSES_NOTICED).fill({}));
  assert.deepStrictEqual(seen[PASSES_NOTICED], { manager: -1 });
});

test('grandes demandes : par le club (pas l’agent), 1 à 2 par mois ; un refus compte', () => {
  const st = career();
  for (let i = 0; i < 90; i += 1) {
    const d = addDays(START, i);
    tickMediaOffers(st, d, newId);
    tickClubLife(st, d, { language: 'en', newId });
    for (const o of st.lifeHub.mediaOffers.filter((x) => x.status === 'open' && x.source === 'club')) answerMediaOffer(st, o.id, 'decline', d, newId);
  }
  const club = st.lifeHub.mediaOffers.filter((o) => o.source === 'club');
  assert.ok(club.length >= 3 && club.length <= 6, `${club.length} demandes du club en 3 mois`);
  assert.ok(club.every((o) => o.kind === 'club_channel' && o.outlet.includes('Lyon') && o.fee === 0));
  assert.ok(!st.lifeHub.mediaOffers.some((o) => o.source !== 'club' && o.kind === 'club_channel'), 'l’agent ne propose plus la chaîne du club');
  assert.ok((st.lifeHub.clubLife.passes || []).length >= 1);
});
