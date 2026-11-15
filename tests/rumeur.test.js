'use strict';
// Les rumeurs reprises par la presse (1.1.0), et deux articles spéciaux de son club au plus par édition.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const world = require(path.join(ROOT, 'src/world/world.js'));
const prompts = require(path.join(ROOT, 'src/ai/prompts.js'));

const desk = ['A. Lead', 'B. Tactique', 'C. Edito', 'D. Consultant', 'E. Reporter', 'F. Compétitions'].map((name) => ({ name, role: '' }));
const before = { match: 'AS Nancy Lorraine – FC Metz', competition: 'Ligue 2 BKT', date: '2026-11-07' };
const rumour = { club: 'RC Lens', reliability: 'serious', insider: '@InsideFootball' };

test('rumeur : La Transversale reprend une piste sérieuse ou une offre, jamais l’invérifiable', () => {
  const plan = world.transversalePlan(desk, { after: null, before }, 'PREVIEW', 1, { rumour });
  const piece = plan.find((p) => /mercato: the rumour/.test(p.subject));
  assert.ok(piece && piece.kind === 'chronique' && /@InsideFootball/.test(piece.subject) && /never a done deal/.test(piece.subject));
  assert.ok(!('extra' in piece), 'la priorité ne part pas vers l’IA');
  assert.match(prompts.editionSystem({ language: 'fr' }, { transversale: true }), /40\. Transfer rumour: CHANGES\.transfer_rumour/);
});

test('articles spéciaux : deux au plus, le derby d’abord, puis les retrouvailles, la rumeur, le duel', () => {
  const derby = { name: 'the Lorraine derby', opponent: 'FC Metz', date: '2026-11-07', competition: 'Ligue 2 BKT', status: 'upcoming', in_days: 2 };
  const reunion = { club: 'FC Metz', date: '2026-11-07', competition: 'Ligue 2 BKT', status: 'upcoming', in_days: 2 };
  const rival = { name: 'Zuriko Davitashvili', team: 'AS Saint-Étienne', league: 'Ligue 2 BKT', moment: 'new' };
  const plan = world.transversalePlan(desk, { after: null, before }, 'PREVIEW', 1, { derby, reunion, rumour, rival });
  const extras = plan.filter((p) => (p.kind === 'avant-match' && /derby/.test(p.subject)) || (p.kind === 'portrait' && /his return/.test(p.subject)) || /mercato: the rumour/.test(p.subject) || p.kind === 'le duel');
  assert.deepStrictEqual(extras.map((p) => p.kind), ['avant-match', 'portrait']);
  const two = world.transversalePlan(desk, { after: null, before }, 'PREVIEW', 1, { rumour, rival });
  assert.deepStrictEqual(two.filter((p) => p.kind === 'le duel' || /mercato: the rumour/.test(p.subject)).length, 2);
});
