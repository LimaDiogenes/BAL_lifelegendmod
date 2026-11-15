'use strict';
// Le joueur du mois de son club, élu par les supporters (1.1.0) : les trois meilleurs du mois d'avant, un sondage déjà
// dépouillé du compte du club, une fois par mois ; ses titres gardés.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { fanVote, monthBefore } = require(path.join(__dirname, '..', 'src/world/fanVote.js'));

const ME = 'Ilan Morel';
const line = (name, rating, goals = 0, assists = 0, minutes = 90) => ({ name, minutes, rating, goals, assists });
const game = (date, lineup) => ({ date, played: true, clubLineup: lineup });
const snap = (gameDate, fixtures) => ({ gameDate, club: { name: 'AS Nancy Lorraine' }, player: { name: ME }, fixtures });
const october = [
  game('2026-10-03', [line(ME, 8, 2), line('Enzo Basilio', 7), line('Léo Petit', 6.5), line('Remplaçant', 9, 1, 0, 20)]),
  game('2026-10-17', [line(ME, 7.5, 1, 1), line('Enzo Basilio', 7.5), line('Léo Petit', 6.5)]),
  game('2026-10-28', [line(ME, 7, 1), line('Enzo Basilio', 8), line('Léo Petit', 7)]),
];

test('vote des supporters : les trois meilleurs du mois fini, une fois par mois, son titre gardé', () => {
  assert.strictEqual(monthBefore('2026-11-02'), '2026-10');
  assert.strictEqual(monthBefore('2027-01-05'), '2026-12');
  const state = { careerId: 'x' };
  const v = fanVote(state, snap('2026-11-02', october), { language: 'fr', handle: 'ilanmorel' });
  assert.deepStrictEqual(v.post.poll.options, [ME, 'Enzo Basilio', 'Léo Petit'], 'note moyenne, puis buts et passes ; pas le remplaçant entré en fin de match');
  assert.strictEqual(v.post.poll.percents.reduce((a, b) => a + b, 0), 100);
  assert.ok(v.post.poll.votes >= 900);
  assert.match(v.post.text, /^🗳️ Joueur du mois d’octobre : vous avez voté !/);
  assert.strictEqual(v.won, v.winner === ME);
  if (v.won) { assert.match(v.post.text, /Ilan Morel \(@ilanmorel\), élu avec \d+ % des voix/); assert.deepStrictEqual(state.fanAwards.map((a) => a.month), ['2026-10']); }
  // Le même mois ne revient pas ; le mois suivant sans assez de matchs : rien.
  assert.strictEqual(fanVote(state, snap('2026-11-20', october)), null);
  assert.strictEqual(fanVote(state, snap('2026-12-03', october)), null, 'novembre sans match');
  assert.strictEqual(state.fanVote.month, '2026-11');
});

test('vote des supporters : le texte dans les autres langues', () => {
  const en = fanVote({ careerId: 'y' }, snap('2026-11-02', october), { language: 'en' });
  assert.match(en.post.text, /^🗳️ Player of the month for October: you voted!/);
  const de = fanVote({ careerId: 'y' }, snap('2026-11-02', october), { language: 'de' });
  assert.match(de.post.text, /Spieler des Monats Oktober/);
});
