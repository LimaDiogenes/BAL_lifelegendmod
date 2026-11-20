'use strict';
// Phase E : journaux nationaux selon le pays du championnat, passage automatique lors d'un transfert,
// choix d'un autre pays ou d'un nom personnalisé, rédaction à 10 plumes, prompts, brief du matin et interview.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const np = require(path.join(ROOT, 'src/world/nationalPaper.js'));
const prompts = require(path.join(ROOT, 'src/ai/prompts.js'));
const world = require(path.join(ROOT, 'src/world/world.js'));
const { interviewDue } = require(path.join(ROOT, 'src/world/interview.js'));

test('detectLeagueCountry : associe chaque championnat majeur au bon pays sans collision', () => {
  const cases = [
    ['Premier League', 'england', 'The Touchline'],
    ['Sky Bet Championship', 'england', 'The Touchline'],
    ['FA Cup', 'england', 'The Touchline'],
    ['Scottish Premiership', 'scotland', 'The Caledonian Pitch'],
    ['Scottish Championship', 'scotland', 'The Caledonian Pitch'],
    ['Brasileirão Série A', 'brazil', 'Folha do Gramado'],
    ['Copa do Brasil', 'brazil', 'Folha do Gramado'],
    ['Serie A TIM', 'italy', 'Corriere del Pallone'],
    ['Serie B', 'italy', 'Corriere del Pallone'],
    ['LaLiga EA Sports', 'spain', 'Diario Balón'],
    ['Bundesliga', 'germany', 'Anstoß Kurier'],
    ['Ligue 1 McDonald’s', 'france', 'La Transversale'],
    ['Saudi Pro League', 'saudi', 'Al-Maydan Sports'],
    ['Jupiler Pro League', 'belgium', 'Le But Belge'],
    ['Liga Portugal', 'portugal', 'Jornal da Baliza'],
    ['Eredivisie', 'netherlands', 'De Buitenkant'],
    ['Liga Profesional Argentina', 'argentina', 'Crónica del Área'],
    ['Trendyol Süper Lig', 'turkey', 'Santra Gazetesi'],
    ['MLS', 'usa', 'The Pitchside Ledger'],
    ['J1 League', 'japan', 'Pitch Shimbun'],
    ['Liga BetPlay Dimayor', 'colombia', 'El Pitazo Deportivo'],
    ['Liga de Primera', 'chile', 'Gaceta del Sur'],
    ['Ekstraklasa', 'france', 'La Transversale'],
    ['', 'france', 'La Transversale'],
  ];
  for (const [leagueName, expectedId, expectedName] of cases) {
    assert.strictEqual(np.detectLeagueCountry(leagueName), expectedId, `country for "${leagueName}"`);
    const resolved = np.resolveNationalPaper({ snapshot: { league: { name: leagueName } } });
    assert.strictEqual(resolved.id, expectedId, `resolved id for "${leagueName}"`);
    assert.strictEqual(resolved.name, expectedName, `resolved name for "${leagueName}"`);
    assert.strictEqual(resolved.mode, 'auto');
  }
});

test('resolveNationalPaper : gère les préréglages, les noms personnalisés et la normalisation', () => {
  const preset = np.resolveNationalPaper({
    snapshot: { league: { name: 'Premier League' } },
    override: { mode: 'preset', presetId: 'brazil' },
  });
  assert.deepStrictEqual([preset.id, preset.name, preset.slug, preset.mode], ['brazil', 'Folha do Gramado', 'folhadogramado', 'preset']);
  assert.strictEqual(preset.leadDesk[0].name, 'Rodrigo Valente');

  const rawLong = `  La\n   Gazzetta   Bianca   ${'X'.repeat(70)}  `;
  const custom = np.resolveNationalPaper({
    snapshot: { league: { name: 'Bundesliga' } },
    override: { mode: 'custom', customName: rawLong },
  });
  assert.strictEqual(custom.id, 'germany');
  assert.strictEqual(custom.country, 'Germany');
  assert.strictEqual(custom.mode, 'custom');
  assert.strictEqual(custom.name.length, 60);
  assert.ok(!/[\r\n]|\s{2,}/.test(custom.name));
  assert.strictEqual(custom.showName, 'Der Spieltag-Talk');
  assert.match(custom.slug, /^lagazzettabianca/);

  const normInvalid = np.normalizePaperOverride({ mode: 'bogus', presetId: 'atlantis', customName: '  A \t B ' });
  assert.deepStrictEqual(normInvalid, { mode: 'auto', presetId: '', customName: 'A B', customShow: '' });
});

test('transfert & migration : fait tourner la rédaction (10 plumes) quand le pays change, y compris depuis une carrière pré-Phase E', () => {
  // Carrière pré-Phase E : rédaction française existante sans paperCountry.
  const state = {
    snapshot: { league: { name: 'Ligue 1' } },
    writers: {
      national_columnist: 'Marc Lhermitte',
      national_desk: [
        { name: 'Marc Lhermitte', role: 'Chroniqueur national' },
        { name: 'Sofiane Kerbrat', role: 'Analyste tactique' },
      ],
    },
  };
  const frPaper = np.resolveNationalPaper({ snapshot: state.snapshot });
  const frDesk = world.transversaleDesk(state, frPaper);
  assert.strictEqual(frDesk.length, 10);
  assert.strictEqual(frDesk[0].name, 'Marc Lhermitte');
  assert.strictEqual(state.writers.paperCountry, 'france');

  // Transfert vers la Premier League : la rédaction passe automatiquement à The Touchline.
  state.snapshot.league.name = 'Premier League';
  const ukPaper = np.resolveNationalPaper({ snapshot: state.snapshot });
  const ukDesk = world.transversaleDesk(state, ukPaper);
  assert.strictEqual(ukDesk.length, 10);
  assert.strictEqual(state.writers.national_columnist, 'Callum Vance');
  assert.strictEqual(ukDesk[0].name, 'Callum Vance');
  assert.strictEqual(state.writers.paperCountry, 'england');
});

test('world.saveNationalPaper : persiste le choix préréglé, personnalisé ou auto et met à jour la rédaction', () => {
  let saved = null;
  const state = {
    careerId: 'c1',
    snapshot: { league: { name: 'LaLiga' } },
    writers: {},
  };
  const store = {
    activeCareer: () => state,
    saveCareer: (s) => { saved = s; },
  };

  const s1 = world.saveNationalPaper({ store, payload: { mode: 'preset', presetId: 'italy' } });
  assert.strictEqual(saved, state);
  assert.strictEqual(s1.nationalPaper.name, 'Corriere del Pallone');
  assert.strictEqual(s1.writers.paperCountry, 'italy');
  assert.strictEqual(s1.writers.national_columnist, 'Lorenzo Ferretti');
  assert.strictEqual(s1.writers.national_desk.length, 10);

  const s2 = world.saveNationalPaper({ store, payload: { mode: 'custom', customName: 'El Balón Ibérico' } });
  assert.strictEqual(s2.nationalPaper.name, 'El Balón Ibérico');
  assert.strictEqual(s2.nationalPaper.slug, 'elbaloniberico');
  assert.strictEqual(s2.nationalPaper.mode, 'custom');
  assert.strictEqual(s2.writers.paperCountry, 'spain');

  const s3 = world.saveNationalPaper({ store, payload: { mode: 'auto' } });
  assert.strictEqual(s3.nationalPaperOverride, undefined);
  assert.strictEqual(s3.nationalPaper.name, 'Diario Balón');
  assert.strictEqual(s3.nationalPaper.mode, 'auto');
});

test('prompts, brief du matin et interview utilisent le quotidien résolu', () => {
  const ukPaper = np.resolveNationalPaper({ snapshot: { league: { name: 'Premier League' } } });
  const brPaper = np.resolveNationalPaper({ snapshot: { league: { name: 'Brasileirão Série A' } } });

  const sysMain = prompts.transversaleSystem({ language: 'en' }, ukPaper);
  assert.match(sysMain, /THE PAPER: a factual daily of world football/);
  assert.match(sysMain, /The Touchline/);
  assert.match(sysMain, /British national sports daily/);
  assert.doesNotMatch(sysMain, /La Transversale/);

  const sysRepair = prompts.transversaleRepairSystem({ language: 'en' }, ukPaper);
  assert.match(sysRepair, /The Touchline/);
  assert.doesNotMatch(sysRepair, /La Transversale/);

  const sysEdition = prompts.editionSystem({ language: 'en' }, { transversale: true, interview: true, paper: brPaper });
  assert.match(sysEdition, /Folha do Gramado/);
  assert.doesNotMatch(sysEdition, /La Transversale/);

  const sysInterview = prompts.interviewSystem({ language: 'en' }, brPaper);
  assert.match(sysInterview, /Folha do Gramado/);
  assert.doesNotMatch(sysInterview, /La Transversale/);

  const sysPress = prompts.pressWriteupSystem({ language: 'en' }, ukPaper);
  assert.match(sysPress, /The Touchline/);
  assert.doesNotMatch(sysPress, /La Transversale/);

  const snapshot = {
    gameDate: '2026-11-01',
    club: { name: 'Arsenal' },
    league: { name: 'Premier League' },
    last: { played: true, score: [2, 0], home: 'Arsenal', away: 'Chelsea', competition: 'Premier League' },
    table: [{ pos: 1, pts: 28, mine: true }],
  };
  const edition = { paperName: 'The Touchline', paperSlug: 'thetouchline', national: [{ headline: 'Arsenal march on', dek: 'Two goals settle the derby.' }] };
  const defaultBrief = world.transversaleBrief(snapshot, {}, 'en');
  assert.strictEqual(defaultBrief.from, 'La Transversale');
  assert.match(defaultBrief.messages[0].body, /latransversale\.foot/);

  const ukBrief = world.transversaleBrief(snapshot, edition, 'en', ukPaper);
  assert.strictEqual(ukBrief.from, 'The Touchline');
  assert.match(ukBrief.messages[0].body, /thetouchline\.foot/);
  assert.doesNotMatch(ukBrief.messages[0].body, /La Transversale|latransversale/);

  const ivState = {
    editions: [{}, {}, {}],
    mail: [],
    nationalPaper: ukPaper,
    writers: { national_desk: [{ name: 'Callum Vance' }] },
  };
  assert.deepStrictEqual(interviewDue(ivState, { gameDate: '2026-11-01' }), { journalist: 'Callum Vance', outlet: 'The Touchline' });
});
