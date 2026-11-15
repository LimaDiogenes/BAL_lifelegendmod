'use strict';
// Le rival (1.1.0) : choisi dans son championnat (autre club, même ligne, chiffres proches), gardé toute la saison, et les
// moments qui font parler de lui (désigné, contre son club, un grand match, un dépassement).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { updateRival, rivalFacts, rivalInNews } = require(path.join(__dirname, '..', 'src/world/rival.js'));

// Des scores minimaux : son championnat (players), deux matchs, trois équipes.
const scoresOf = (players, matches = [], details = []) => ({
  comps: [{ name: 'Ligue 2 BKT', kind: 'league', main: true, players }],
  teams: { 1: ['AS Nancy Lorraine'], 2: ['AS Saint-Étienne'], 3: ['Grenoble Foot 38'] },
  matches, details,
});
const ME = 'Ilan Morel';
const snapshot = { player: { name: ME }, club: { ref: 1 }, season: '2026-2027', gameDate: '2026-10-30' };
const base = [
  [ME, 1, 10, 9, 6.8, 6, 2, 'att'],
  ['Zuriko Davitashvili', 2, 10, 9, 6.6, 6, 1, 'att'],
  ['Buteur Lointain', 3, 10, 10, 7.4, 14, 5, 'att'],
  ['Coéquipier', 1, 10, 9, 6.8, 6, 2, 'att'],
  ['Milieu Proche', 3, 10, 9, 6.8, 6, 2, 'mid'],
];

test('rival : un autre club, la même ligne, les chiffres les plus proches ; gardé toute la saison', () => {
  const state = {};
  const r = updateRival(state, scoresOf(base), snapshot);
  assert.strictEqual(r.name, 'Zuriko Davitashvili', 'ni un coéquipier, ni un milieu, ni le buteur loin devant');
  assert.deepStrictEqual([r.team, r.line, r.moment, r.since], ['AS Saint-Étienne', 'att', 'new', '2026-10-30']);
  // Plus tard dans la saison, un autre joueur lui ressemble davantage : le rival reste le même.
  const later = base.map((x) => (x[0] === 'Buteur Lointain' ? [x[0], 3, 12, 11, 6.8, 6, 2, 'att'] : x));
  const again = updateRival(state, scoresOf(later), { ...snapshot, gameDate: '2026-11-15' });
  assert.deepStrictEqual([again.name, again.since, again.moment], ['Zuriko Davitashvili', '2026-10-30', null]);
  // Saison suivante : choisi à nouveau.
  const next = updateRival(state, scoresOf(later), { ...snapshot, season: '2027-2028', gameDate: '2027-08-20' });
  assert.strictEqual(next.moment, 'new');
});

test('rival : rien avant trois matchs notés', () => {
  const state = {};
  assert.strictEqual(updateRival(state, scoresOf([[ME, 1, 2, 2, 7, 1, 0, 'att'], ['Autre', 2, 2, 2, 7, 1, 0, 'att']]), snapshot), null);
  assert.strictEqual(state.rival, null);
});

test('rival : contre son club, un grand match, un dépassement ; face à face et faits pour l’IA', () => {
  const state = {};
  updateRival(state, scoresOf(base), snapshot);
  // Il marque deux fois contre son club.
  const lu = [[[ME, 1, 90, 6.5, 0, 0, 9]], [['Zuriko Davitashvili', 1, 90, 8, 2, 0, 9]]];
  const s2 = scoresOf(base.map((x) => (x[0] === 'Zuriko Davitashvili' ? [x[0], 2, 11, 10, 6.7, 8, 1, 'att'] : x)), [['2026-11-02', 20, 0, 12, 1, 2, 1, 2]], [{ lu }]);
  const r = updateRival(state, s2, { ...snapshot, gameDate: '2026-11-03' }, { since: '2026-10-30' });
  assert.strictEqual(r.moment, 'against_us');
  assert.deepStrictEqual([r.last.goals, r.last.against_us, r.last.home, r.last.away], [2, true, 'AS Nancy Lorraine', 'AS Saint-Étienne']);
  assert.deepStrictEqual(r.h2h.map((m) => [m.score, m.him.goals, m.rival.goals]), [[[1, 2], 0, 2]]);
  const f = rivalFacts(r);
  assert.deepStrictEqual([f.name, f.club, f.plays_as, f.rival_season.goals, f.his_season.goals], ['Zuriko Davitashvili', 'AS Saint-Étienne', 'forward', 8, 6]);
  assert.match(f.today, /played against his club/);
  assert.match(f.rival_last_match.match, /AS Nancy Lorraine 1-2 AS Saint-Étienne/);
  // Sans rien de neuf : pas de moment ; il fait parler de lui une édition sur cinq.
  const calm = updateRival(state, s2, { ...snapshot, gameDate: '2026-11-10' }, { since: '2026-11-05' });
  assert.strictEqual(calm.moment, null);
  assert.ok(rivalInNews(calm, 10, 5) && !rivalInNews(calm, 11, 5) && rivalInNews(r, 11, 5) && !rivalInNews(null, 10, 5));
});
