'use strict';
// Les retrouvailles avec un ancien club (1.1.0) : ses anciens clubs viennent de ses saisons, ses anciens coéquipiers du
// groupe Vestiaire de l'époque encore dans l'effectif ; La Transversale, le Vestiaire en parlent.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { formerClubs, reunionFacts } = require(path.join(ROOT, 'src/world/reunion.js'));
const world = require(path.join(ROOT, 'src/world/world.js'));
const { huddleToday } = require(path.join(ROOT, 'src/world/huddle.js'));

const state = {
  seasons: {
    '2025-2026|42': { season: '2025-2026', club: 'Stade Rennais FC', stats: { apps: 30, goals: 11, assists: 4 }, lastGameDate: '2026-05-20' },
    '2026-2027|7': { season: '2026-2027', club: 'AS Nancy Lorraine', stats: { apps: 9, goals: 3, assists: 1 } },
  },
  huddles: [{ clubRef: 42, players: ['Léo Martin', 'Hugo Petit', 'Parti Ailleurs'], messages: [] }, { clubRef: 7, players: ['X'], messages: [] }],
};
const fx = (date, home, away, score = null, extra = {}) => ({ date, home, away, competition: 'Coupe de France', played: Boolean(score), ...(score ? { score } : {}), ...extra });
const snap = (gameDate, fixtures) => ({ gameDate, club: { name: 'AS Nancy Lorraine' }, player: { history: { previousClub: 'FC Lorient' } }, fixtures });

test('retrouvailles : ses anciens clubs, le match à venir, son passage là-bas, les anciens coéquipiers encore là', () => {
  const s = snap('2026-11-02', [fx('2026-11-06', 'Stade Rennais FC', 'AS Nancy Lorraine')]);
  assert.deepStrictEqual(formerClubs(state, s).map((c) => [c.club, c.matches, c.goals]), [['Stade Rennais FC', 30, 11], ['FC Lorient', 0, 0]]);
  const r = reunionFacts(state, s, { squadOf: (ref) => (ref === 42 ? ['Léo Martin', 'Hugo Petit', 'Nouveau Venu'] : null) });
  assert.deepStrictEqual([r.club, r.status, r.in_days, r.venue], ['Stade Rennais FC', 'upcoming', 4, 'away']);
  assert.deepStrictEqual(r.his_time_there, { seasons: ['2025-2026'], matches: 30, goals: 11, assists: 4, last_match_there: '2026-05-20' });
  assert.deepStrictEqual(r.former_teammates_still_there, ['Léo Martin', 'Hugo Petit']);
  // Tout juste joué : le résultat et son match ; rien quand aucun ancien club n'est au calendrier.
  const done = reunionFacts(state, snap('2026-11-08', [fx('2026-11-06', 'Stade Rennais FC', 'AS Nancy Lorraine', [0, 2], { me: { minutes: 90, goals: 1, assists: 0, rating: 7.5 } })]));
  assert.deepStrictEqual([done.status, done.result, done.his_match.goals], ['just_played', 'Stade Rennais FC 0-2 AS Nancy Lorraine', 1]);
  assert.strictEqual(reunionFacts(state, snap('2026-11-02', [fx('2026-11-06', 'AS Nancy Lorraine', 'Rodez AF')])), null);
});

const desk = ['A. Lead', 'B. Tactique', 'C. Edito', 'D. Consultant', 'E. Reporter', 'F. Compétitions'].map((name) => ({ name, role: '' }));
test('retrouvailles : « le retour » avant le match, le récit après, le Vestiaire', () => {
  const reunion = { club: 'Stade Rennais FC', date: '2026-11-06', competition: 'Coupe de France', status: 'upcoming', in_days: 4 };
  const plan = world.transversalePlan(desk, { after: null, before: { match: 'Stade Rennais FC – AS Nancy Lorraine', competition: 'Coupe de France', date: '2026-11-06' } }, 'PREVIEW', 1, { reunion });
  const back = plan.find((p) => p.kind === 'portrait');
  assert.ok(back && /his return against Stade Rennais FC/.test(back.subject) && /FACTS\.reunion/.test(back.subject));
  const after = world.transversalePlan(desk, { after: { match: 'Stade Rennais FC 0-2 AS Nancy Lorraine', competition: 'Coupe de France', date: '2026-11-06' }, before: null }, 'POST-MATCH', 1, { reunion: { ...reunion, status: 'just_played' } });
  assert.match(after.find((p) => p.kind === 'récit du match').subject, /he faced his former club Stade Rennais FC/);
  assert.match(huddleToday({ clubRef: 7, players: ['A'], messages: [], texting: {} }, { reunion, date: '2026-11-03' }).side_topic, /coming return against his former club Stade Rennais FC/);
});
