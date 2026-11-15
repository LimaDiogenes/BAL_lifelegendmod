'use strict';
// Les derbys (1.1.0) : reconnus par le code, puis vécus par La Transversale, Kop et le Vestiaire.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { derbyOf, derbyFacts } = require(path.join(ROOT, 'src/world/derby.js'));
const world = require(path.join(ROOT, 'src/world/world.js'));
const { huddleToday } = require(path.join(ROOT, 'src/world/huddle.js'));

test('derby : les grands derbys et les clubs d’une même ville, sans faux derby', () => {
  assert.strictEqual(derbyOf('AS Nancy Lorraine', 'FC Metz'), 'the Lorraine derby');
  assert.strictEqual(derbyOf('FC Metz', 'AS Nancy Lorraine'), 'the Lorraine derby', 'dans les deux sens');
  assert.strictEqual(derbyOf('Real Madrid CF', 'FC Barcelona'), 'El Clásico');
  assert.strictEqual(derbyOf('FC Barcelona', 'RCD Espanyol de Barcelona'), 'the Barcelona derby');
  assert.strictEqual(derbyOf('Real Madrid CF', 'RCD Espanyol de Barcelona'), null);
  assert.strictEqual(derbyOf('AC Milan', 'FC Internazionale Milano'), 'the Derby della Madonnina');
  assert.strictEqual(derbyOf('Manchester United', 'Manchester City'), 'the Manchester derby', 'même ville');
  assert.strictEqual(derbyOf('Paris FC', 'Paris Saint-Germain'), 'the Paris derby');
  assert.strictEqual(derbyOf('Manchester United', 'Leeds United'), null, '« United » n’est pas une ville');
  assert.strictEqual(derbyOf('Stade de Reims', 'Stade Lavallois'), null);
  assert.strictEqual(derbyOf('AS Nancy Lorraine', 'USL Dunkerque'), null);
});

const fx = (date, home, away, score = null) => ({ date, home, away, competition: 'Ligue 2 BKT', played: Boolean(score), ...(score ? { score } : {}) });
const snap = (gameDate, fixtures) => ({ gameDate, club: { name: 'AS Nancy Lorraine' }, fixtures });

test('derby : à venir dans la semaine, tout juste joué, sinon rien ; les rencontres de la saison', () => {
  const fixtures = [fx('2026-08-10', 'FC Metz', 'AS Nancy Lorraine', [1, 1]), fx('2026-11-01', 'AS Nancy Lorraine', 'Rodez AF', [2, 0]), fx('2026-11-07', 'AS Nancy Lorraine', 'FC Metz')];
  const up = derbyFacts(snap('2026-11-02', fixtures));
  assert.deepStrictEqual([up.name, up.opponent, up.status, up.in_days, up.venue], ['the Lorraine derby', 'FC Metz', 'upcoming', 5, 'home']);
  assert.deepStrictEqual(up.earlier_meetings_this_season, [{ date: '2026-08-10', competition: 'Ligue 2 BKT', match: 'FC Metz 1-1 AS Nancy Lorraine' }]);
  assert.strictEqual(derbyFacts(snap('2026-10-25', fixtures)), null, 'trop loin');
  const done = fixtures.map((f) => (f.date === '2026-11-07' ? { ...f, played: true, score: [3, 1] } : f));
  const after = derbyFacts(snap('2026-11-09', done));
  assert.deepStrictEqual([after.status, after.result], ['just_played', 'AS Nancy Lorraine 3-1 FC Metz']);
  assert.strictEqual(derbyFacts(snap('2026-11-14', done)), null, 'quatre jours au plus après');
});

const desk = ['A. Lead', 'B. Tactique', 'C. Edito', 'D. Consultant', 'E. Reporter', 'F. Compétitions'].map((name) => ({ name, role: '' }));
test('derby : l’avant-match dans La Transversale, le récit qui le dit, le Vestiaire qui en parle', () => {
  const derby = { name: 'the Lorraine derby', opponent: 'FC Metz', date: '2026-11-07', competition: 'Ligue 2 BKT', status: 'upcoming', in_days: 2 };
  const before = { match: 'AS Nancy Lorraine – FC Metz', competition: 'Ligue 2 BKT', date: '2026-11-07' };
  const plan = world.transversalePlan(desk, { after: null, before }, 'PREVIEW', 1, { derby });
  const preview = plan.find((p) => p.kind === 'avant-match');
  assert.ok(preview && /the Lorraine derby/.test(preview.subject) && /FACTS\.derby/.test(preview.subject), JSON.stringify(plan.map((p) => p.kind)));
  assert.deepStrictEqual(preview.teams, ['FC Metz']);
  const played = { ...derby, status: 'just_played', result: 'AS Nancy Lorraine 3-1 FC Metz' };
  const after = world.transversalePlan(desk, { after: { match: 'AS Nancy Lorraine 3-1 FC Metz', competition: 'Ligue 2 BKT', date: '2026-11-07' }, before: null }, 'POST-MATCH', 1, { derby: played });
  assert.match(after.find((p) => p.kind === 'récit du match').subject, /it was the Lorraine derby/);
  const group = { clubRef: 1, players: ['A', 'B', 'C'], messages: [], texting: {} };
  assert.match(huddleToday(group, { derby, date: '2026-11-05' }).side_topic, /derby against FC Metz/);
  assert.match(huddleToday(group, { derby: played, date: '2026-11-08' }).side_topic, /derby just played/);
});
