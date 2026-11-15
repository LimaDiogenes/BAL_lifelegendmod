'use strict';
// La langue des textes de l'IA (2026-11-14, joueurs réglés en anglais qui recevaient du français) : la consigne ajoutée
// à chaque requête hors français, et le repérage d'une réponse revenue en français (redemandée une fois).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const prompts = require(path.join(__dirname, '..', 'src/ai/prompts.js'));

test('consigne de langue : en fin de requête hors français, rien en français', () => {
  const en = prompts.withLanguage({ language: 'en' }, { system: 'SYS', user: 'USER {"style":"posé, argumente avec des chiffres simples","likely_role":"au moins remplaçant"}' });
  assert.match(en.system, /^SYS\n\nLANGUAGE — ENGLISH ONLY/);
  assert.match(en.user, /\(Reminder: write everything in English\.\)$/);
  assert.match(en.user, /"style":"calm, argues with simple numbers"/, 'les façons d’écrire du code passent en anglais');
  assert.match(en.user, /"likely_role":"at least a substitute"/);
  const fr = { system: 'SYS', user: 'USER' };
  assert.strictEqual(prompts.withLanguage({ language: 'fr' }, fr), fr, 'en français, la requête ne change pas');
  assert.match(prompts.languageRetry({ language: 'de' }), /entirely in German/);
});

test('réponse revenue en français : repérée, sans confondre les autres langues', () => {
  const one = (t) => JSON.stringify({ messages: [{ from: 'A', text: t }] });
  assert.ok(prompts.wrongLanguage(one('compte sur moi pour le gros son ce soir, on va arriver chauds à picot'), 'en'), 'le message du Vestiaire du 2026-11-14');
  assert.ok(prompts.wrongLanguage(one('Je suis très content pour les supporters, nous avons fait un grand match avec le groupe'), 'es'));
  // L'écrit des supporters, court et abrégé (essai réel du 2026-11-14).
  for (const t of ['c clair 5 c payé mais basilio ns a sauvés', 'vs a pris le point c le principal tkt', 'exactement, espérons qu’il plante ce soir à Picot', 'même chanson qu’à chaque déplacement, on tremble pendant 90 minutes']) assert.ok(prompts.wrongLanguage(one(t), 'en'), t);
  assert.ok(!prompts.wrongLanguage(one('Great win lads, who is up for a game tonight? Count me in'), 'en'));
  assert.ok(!prompts.wrongLanguage(one('C’mon lads, Nancy vs Grenoble tonight, we go all in at Picot'), 'en'), 'c’mon et vs restent de l’anglais');
  assert.ok(!prompts.wrongLanguage(one('Vamos à luta, o estádio vai estar cheio e a equipa está pronta'), 'pt'), 'le « à » portugais');
  assert.ok(!prompts.wrongLanguage(one('Le Débrief: the TV debate after the 0-0 at Stade de Reims, with the host and two pundits'), 'en'), 'des noms français dans un texte anglais');
  assert.ok(!prompts.wrongLanguage(one('La verdad es que el equipo jugó muy bien y los aficionados son lo mejor que hay'), 'es'));
  assert.ok(!prompts.wrongLanguage(one('Le ragazze e i ragazzi della curva sono stati fantastici oggi, che partita per tutti'), 'it'));
  assert.ok(!prompts.wrongLanguage(one('Mais uma vitória para a equipa, os adeptos estão de parabéns e o mister também'), 'pt'));
  assert.ok(!prompts.wrongLanguage(one('Wir sind stolz auf die Mannschaft und die Fans waren heute wieder unglaublich laut'), 'de'));
  assert.ok(!prompts.wrongLanguage(one('compte sur moi pour le gros son ce soir, on va arriver chauds à picot'), 'fr'), 'en français, jamais');
  // Une longue réponse (une édition) : un seul texte en français ne suffit pas, deux oui.
  const posts = (frCount) => JSON.stringify({ posts: [...Array(8)].map((_, i) => ({ text: i < frCount ? 'Quelle soirée pour les supporters, on est très fiers de ce groupe avec le coach' : 'What a night for the fans, we are so proud of this group and the coach' })) });
  assert.ok(!prompts.wrongLanguage(posts(1), 'en'));
  assert.ok(prompts.wrongLanguage(posts(2), 'en'));
});

// Conférence de presse (2026-11-16, retours sur Evoweb : en anglais, les questions des journalistes arrivaient encore en
// français) : la règle de politesse ne parle que de la langue choisie, et les rôles des journalistes passent en anglais.
test('conférence de presse : rien qui pousse vers le français hors français', () => {
  const en = prompts.pressQuestionsSystem({ language: 'en' });
  assert.doesNotMatch(en, /"vous"|"tu"|\btutoie/, 'pas de vouvoiement à la française en anglais');
  assert.match(en, /Every question is written in English/);
  assert.match(prompts.pressQuestionsSystem({ language: 'es' }), /formally, with "usted"/);
  assert.doesNotMatch(prompts.pressQuestionsSystem({ language: 'es' }), /"vous"/);
  assert.match(prompts.pressQuestionsSystem({ language: 'fr' }), /"vous" \(never "tu"/, 'en français, le vouvoiement reste');
  const panel = [{ name: 'Marc Lhermitte', outlet: 'La Transversale', role: 'Chroniqueur national', address: 'formal' }, { name: 'Bruno Vidaillac', outlet: 'La Transversale', role: 'Consultant, ancien milieu de terrain', address: 'formal' }];
  const user = prompts.pressQuestionsUser({ facts: {}, memory: {}, conference: { match: 'Watford 0-2 Swansea', panel } });
  const out = prompts.withLanguage({ language: 'en' }, { system: en, user }).user;
  assert.match(out, /"role":"Chief football writer"/);
  assert.match(out, /"role":"Pundit, former midfielder"/);
  assert.doesNotMatch(out, /Chroniqueur|ancien milieu/);
});

// Les valeurs que le code met en français dans FACTS partent en anglais hors français (la requête reste du JSON valide).
test('valeurs du code dans FACTS : en anglais hors français, intactes en français', () => {
  const facts = { last_match: { venue: 'extérieur', clubLineup: [{ position: 'défenseur central' }, { position: 'avant-centre' }], me: { ratingWord: 'très bon' } },
    next_match: { venue: 'domicile', kickoff: '2027-03-21 à 19h (le soir)' }, player: { game_profile: { strong_foot: 'gauche', form_arrow: 'Très mauvaise' } },
    league_table: [{ form: 'VVNDV' }], mercato: { window: { next: { season: 'été' } } }, agent: { player_stance: 'ouvert à tout' },
    fan_mood: { reasons: ['défaite 0-3 contre FC Metz', 'sa note : 4.5 (catastrophique)', '3 défaites de suite', 'zone rouge (18e)', 'promesse non tenue : « 10 buts »'] } };
  const user = `FACTS: ${JSON.stringify(facts)}`;
  const en = JSON.parse(prompts.withLanguage({ language: 'en' }, { system: 'S', user }).user.replace(/^FACTS: /, '').replace(/\n\n\(Reminder.*$/s, ''));
  assert.deepStrictEqual(en, { last_match: { venue: 'away', clubLineup: [{ position: 'centre-back' }, { position: 'centre-forward' }], me: { ratingWord: 'very good' } },
    next_match: { venue: 'home', kickoff: '2027-03-21 at 19:00 (evening)' }, player: { game_profile: { strong_foot: 'left', form_arrow: 'very poor' } },
    league_table: [{ form: 'WWDLW' }], mercato: { window: { next: { season: 'summer' } } }, agent: { player_stance: 'open to anything' },
    fan_mood: { reasons: ['defeat 0-3 against FC Metz', 'his rating: 4.5 (catastrophic)', '3 defeats in a row', 'relegation zone (18th)', 'broken promise: "10 buts"'] } });
  assert.strictEqual(prompts.withLanguage({ language: 'fr' }, { system: 'S', user }).user, user, 'en français, rien ne change');
});
