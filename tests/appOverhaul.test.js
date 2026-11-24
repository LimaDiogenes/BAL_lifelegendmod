'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Store } = require('../src/store');
const {
  normalizeDob,
  normalizePersona,
  personaFacts,
  extractPersonaAgent,
  personaPrivacyEntries,
} = require('../src/world/persona');
const { syncAgentWithPersona } = require('../src/world/agent');
const {
  SPONSOR_CATEGORIES,
  BRAND_CATALOG,
  brandSlug,
  isBettingAllowed,
  brandsForCategory,
  findSponsorConflicts,
} = require('../src/world/sponsorCatalog');
const {
  ASSET_CATALOG,
  ensureLifeHub,
  addSponsor,
  updateSponsor,
  buyAsset,
  sellAsset,
  grantSponsorCars,
  ownedMonthlyCost,
  syncBootSponsor,
  maybeStartBiddingWar,
  answerBiddingWar,
  maybeOfferOneTimeDeal,
  answerOneTimeDeal,
  rescheduleObligation,
} = require('../src/world/lifeHub');
const { addLifeSponsor, advanceCalendar, updateAgent, generateBackstory } = require('../src/world/world');
const {
  birthdaysForYear,
  flipBirthdayShift,
  seedSystemEvents,
  collectDueDecisions,
  resolveCalendarDecision,
  scheduleOffPitchActivity,
} = require('../src/world/calendarEvents');
const { calendarAgenda } = require('../src/world/calendar');
const { runProceduralDailyPulse, runHybridAiDailyPulse } = require('../src/world/dailyPulse');
const { detectDramaCandidates } = require('../src/world/dramaEngine');
const { MAX_CUSTOM_WORDS, buildPrivacyMap, maskText, unmaskText } = require('../src/ai/privacyShield');

function mkTmpStore(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'll-overhaul-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fakeSafeStorage = {
    isEncryptionAvailable: () => false,
    encryptString: (s) => Buffer.from(s, 'utf8'),
    decryptString: (b) => b.toString('utf8'),
  };
  return new Store(dir, fakeSafeStorage);
}

function baseSnapshot(overrides = {}) {
  return {
    gameDate: '2026-09-10',
    player: {
      id: 101,
      name: 'Lucas Silva',
      age: 23,
      salary: 1800000,
      marketValue: 22000000,
    },
    club: { ref: 1, name: 'Santos FC', stadium: 'Vila Belmiro' },
    league: { id: 0x16, name: 'Liga Portugal' },
    stats: {
      season: { apps: 12, goals: 9, assists: 4, avgRating: 7.5 },
      total: { apps: 95, goals: 52, assists: 24, avgRating: 7.3 },
    },
    fixtures: [
      { id: 'fx1', date: '2026-09-10', homeRef: 1, home: 'Santos FC', awayRef: 2, away: 'Palmeiras', competition: 'Cup', played: true, score: [2, 1] },
      { id: 'fx2', date: '2026-09-15', homeRef: 1, home: 'Santos FC', awayRef: 3, away: 'Porto', competition: 'Liga Portugal', played: false, score: null },
    ],
    next: { id: 'fx2', date: '2026-09-15', homeRef: 1, home: 'Santos FC', awayRef: 3, away: 'Porto', competition: 'Liga Portugal' },
    squad: [
      { id: 101, name: 'Lucas Silva', pos: 'CF', age: 23, me: true },
      { id: 102, name: 'Bruno Costa', pos: 'CM', age: 27, me: false },
      { id: 103, name: 'Diogo Reis', pos: 'GK', age: 25, me: false },
      { id: 104, name: 'Pedro Nunes', pos: 'CB', age: 24, me: false },
      { id: 105, name: 'André Moura', pos: 'LB', age: 22, me: false },
      { id: 106, name: 'Tiago Gomes', pos: 'RW', age: 21, me: false },
    ],
    squadIntel: { captain: { name: 'Bruno Costa' } },
    ...overrides,
  };
}

function baseState(snap = baseSnapshot()) {
  return {
    careerId: 'career_test_1',
    snapshot: snap,
    profile: { handle: 'lucassilva', displayName: 'Lucas Silva', followers: 650000 },
    mail: [{ id: 'm1', role: 'agent', from: 'Julien Moreau', subject: 'Report', unread: false, messages: [{ who: 'them', body: 'Hello', gameDate: '2026-09-01' }] }],
    feed: [],
    huddles: [{ id: 'g1', clubRef: snap.club.ref, scope: 'club', name: 'Squad Group', players: ['Bruno Costa', 'Diogo Reis'], messages: [], unread: 0 }],
    editions: [{ gameDate: '2026-09-05', national: [], local: [] }],
    calendar: { simDate: '2026-09-10', saveDate: '2026-09-14', pendingMatches: [], revealedMatchIds: [], customEvents: [], systemEvents: [], pendingDecisions: [], history: [] },
    sponsor: { deal: null, offer: null, history: [] },
  };
}

test('Store defaults & deleteCareer cleanup', (t) => {
  const store = mkTmpStore(t);
  const stg = store.getSettings();
  assert.strictEqual(stg.sponsorMode, 'realistic');
  assert.strictEqual(stg.eventMode, 'realistic');

  const st = baseState();
  store.saveCareer(st);
  store.setActiveCareer(st.careerId);
  store.saveSettings({ pendingBio: { savePath: 'BL00000000', text: 'temp' } });
  assert.ok(store.activeCareer());

  const res = store.deleteCareer(st.careerId);
  assert.strictEqual(res.deletedId, st.careerId);
  assert.strictEqual(store.activeCareer(), null);
  assert.strictEqual(store.getSettings().pendingBio, undefined);
  assert.throws(() => store.deleteCareer('../escape'), /Identifiant de carrière invalide/);
});

test('Persona DOBs, rootProtect shield toggles & Agent sync', () => {
  assert.strictEqual(normalizeDob('2003-09-12'), '2003-09-12');
  assert.strictEqual(normalizeDob('--02-29'), '--02-29');
  assert.strictEqual(normalizeDob('invalid'), '');

  const pers = normalizePersona({
    preset: 'showman',
    playerDob: '2003-09-12',
    roots: { hometown: 'Guarujá', childhood: 'Enfance Rue 7', academy: 'Meninos da Vila', heritage: 'Brazilian' },
    rootProtect: { hometown: false, childhood: true, academy: true },
    circle: {
      family: [{ id: 'fam_1', role: 'Mère', name: 'Maria Silva', dob: '1975-09-15', close: true, protect: true }],
      business: [{ id: 'bus_1', role: 'Agent', name: 'Rafael Mendes', dob: '1980-04-04', close: false, protect: false }],
    },
  });
  assert.strictEqual(pers.playerDob, '2003-09-12');
  assert.strictEqual(pers.rootProtect.hometown, false);

  const entries = personaPrivacyEntries(pers);
  assert.strictEqual(entries.roots.hometown, ''); // unprotected root excluded
  assert.strictEqual(entries.roots.childhood, 'Enfance Rue 7');
  assert.strictEqual(entries.roots.academy, 'Meninos da Vila');
  assert.ok(entries.people.some((p) => p.real === 'Maria Silva'));
  assert.ok(!entries.people.some((p) => p.real === 'Rafael Mendes'));

  const st = baseState();
  st.persona = pers;
  assert.deepStrictEqual(extractPersonaAgent(pers)?.name, 'Rafael Mendes');
  const changed = syncAgentWithPersona(st);
  assert.strictEqual(changed, true);
  assert.strictEqual(st.agent.name, 'Rafael Mendes');
  assert.strictEqual(st.agent.customFromPersona, true);
  assert.strictEqual(st.mail[0].from, 'Rafael Mendes');
});

test('Sponsor Catalog 21 categories, 25+ airlines, umbrellas & betting laws', () => {
  assert.strictEqual(SPONSOR_CATEGORIES.length, 21);
  const airlines = brandsForCategory('airlines');
  assert.ok(airlines.length >= 25, `expected >= 25 airlines, got ${airlines.length}`);
  for (const name of ['Emirates', 'Qatar Airways', 'Lufthansa', 'ANA (All Nippon Airways)', 'Japan Airlines', 'Turkish Airlines', 'TUI', 'Asiana Airlines', 'Iberia', 'Air France / KLM']) {
    assert.ok(airlines.some((b) => b.brand === name), `missing airline ${name}`);
  }

  const boots = brandsForCategory('boots');
  const adidas = boots.find((b) => b.brand === 'Adidas');
  const nike = boots.find((b) => b.brand === 'Nike');
  assert.deepStrictEqual(adidas.categories, ['boots', 'apparel', 'grooming']);
  assert.deepStrictEqual(nike.categories, ['boots', 'apparel']);

  const fashion = brandsForCategory('fashion');
  assert.deepStrictEqual(fashion.find((b) => b.brand === 'Dior').categories, ['fashion', 'grooming']);
  assert.deepStrictEqual(fashion.find((b) => b.brand === 'Prada').categories, ['fashion', 'eyewear']);

  for (const restrictedLeague of ['Premier League', 'Serie A', 'LaLiga', 'Ligue 1', 'Bundesliga', 'Eredivisie', 'Saudi Pro League']) {
    assert.strictEqual(isBettingAllowed({ league: { name: restrictedLeague } }).allowed, false, restrictedLeague);
  }
  for (const allowedLeague of ['Brasileirão Série A', 'Liga Portugal', 'Liga Profesional', 'MLS']) {
    assert.strictEqual(isBettingAllowed({ league: { name: allowedLeague } }).allowed, true, allowedLeague);
  }
});

test('LifeHub exclusivity, buyouts, Global Partner, Bidding Wars, One-Time Deals, Dossier sync & realistic guard', (t) => {
  const st = baseState();
  const hub = ensureLifeHub(st, st.snapshot);
  hub.calibrated = true;
  hub.cash = 400000;
  hub.stage = 'established';

  // Multi-brand categories allow multiple distinct brands
  addSponsor(st, { brand: 'Whoop', categories: ['health'], fee: 180000, bonus: 2500 }, '2026-09-10', () => 'sp1', { enforceExclusivity: true });
  addSponsor(st, { brand: 'Therabody', categories: ['health'], fee: 160000, bonus: 2200 }, '2026-09-10', () => 'sp2', { enforceExclusivity: true });
  assert.strictEqual(hub.sponsors.length, 2);

  // Exclusive boots + apparel conflict & buyout
  const nikeSp = addSponsor(st, { brand: 'Nike', categories: ['boots', 'apparel'], fee: 240000, bonus: 4000, isGlobalPartner: true }, '2026-09-10', () => 'sp_nike', { enforceExclusivity: true });
  assert.strictEqual(nikeSp.isGlobalPartner, true);
  assert.strictEqual(st.sponsor.deal?.brand, 'Nike');
  assert.strictEqual(st.sponsor.deal?.isGlobalPartner, true);

  assert.throws(
    () => addSponsor(st, { brand: 'Puma', categories: ['boots', 'apparel'], fee: 300000, bonus: 4500 }, '2026-09-10', () => 'sp_puma', { enforceExclusivity: true }),
    /Conflit de catégorie avec un sponsor actif/,
  );

  // Buyout succeeds cleanly and replaces Nike in boots/apparel + Dossier boot deal
  addSponsor(st, { brand: 'Adidas', categories: ['boots', 'apparel', 'grooming'], fee: 360000, bonus: 5000 }, '2026-09-10', () => 'sp_adi', { enforceExclusivity: true, allowBuyout: true });
  assert.ok(!hub.sponsors.some((s) => s.brand === 'Nike'));
  assert.strictEqual(st.sponsor.deal?.brand, 'Adidas');
  assert.strictEqual(hub.lastSponsorSwitch?.kind, 'buyout_switch');
  assert.ok(hub.cash < 400000);

  // Betting restriction check
  const ukState = baseState(baseSnapshot({ league: { id: 0x11, name: 'Premier League' } }));
  ensureLifeHub(ukState, ukState.snapshot).calibrated = true;
  assert.throws(
    () => addSponsor(ukState, { brand: 'Bet365', categories: ['betting'], fee: 350000 }, '2026-09-10', () => 'sp_bet', { enforceExclusivity: true }),
    /Les sponsors de paris sportifs sont interdits/,
  );

  // Bidding war lifecycle: create -> leverage -> sign rival (buyoutCovered)
  st.agent = { name: 'Rafael Mendes', agency: 'Mendes Sports Management' };
  const war = maybeStartBiddingWar(st, st.snapshot, hub, '2026-09-10', (() => { let n = 0; return () => `war_${++n}`; })());
  assert.ok(war && war.bids.length >= 2);
  const feeBefore = war.bids[0].fee;
  const lev = answerBiddingWar(st, war.id, { action: 'leverage' }, '2026-09-10', () => 'w1');
  assert.strictEqual(lev.status, 'leveraged');
  assert.ok(war.bids.some((b) => !b.walkedAway && b.fee >= feeBefore));
  const topBid = war.bids.find((b) => !b.walkedAway);
  const signed = answerBiddingWar(st, war.id, { action: 'accept', bidId: topBid.id }, '2026-09-10', () => 'w2');
  assert.strictEqual(signed.status, 'signed');
  assert.strictEqual(hub.biddingWars.length, 0);

  // One-Time Deal -> 25% deposit + scheduled calendar event
  const ot = maybeOfferOneTimeDeal(st, st.snapshot, hub, '2026-09-10', () => 'ot_1');
  assert.ok(ot);
  const cashBeforeOt = hub.cash;
  const otRes = answerOneTimeDeal(st, ot.id, 'accept', '2026-09-10', '2026-09-18', (() => { let n = 0; return () => `evot_${++n}`; })());
  assert.strictEqual(otRes.status, 'scheduled');
  assert.strictEqual(otRes.event.date, '2026-09-18');
  assert.strictEqual(otRes.event.kind, 'onetime');
  assert.ok(hub.cash > cashBeforeOt);

  // Obligation rescheduling rejects matchday & out-of-window, accepts free day
  const ob = hub.obligations[0];
  ob.dueDate = '2026-09-12';
  const matchSet = new Set(['2026-09-15']);
  assert.throws(() => rescheduleObligation(st, ob.id, '2026-09-15', matchSet), /jour de match/);
  assert.throws(() => rescheduleObligation(st, ob.id, '2026-10-20', matchSet), /fenêtre permise/);
  rescheduleObligation(st, ob.id, '2026-09-14', matchSet);
  assert.strictEqual(ob.dueDate, '2026-09-14');

  // world.addLifeSponsor realistic-mode guard
  const store = mkTmpStore(t);
  store.saveSettings({ sponsorMode: 'realistic' });
  store.saveCareer(st);
  store.setActiveCareer(st.careerId);
  assert.throws(
    () => addLifeSponsor({ store, payload: { brand: 'Tissot', categories: ['watches'], fee: 200000 }, manual: true }),
    /Mode sponsors réaliste actif/,
  );
  store.saveSettings({ sponsorMode: 'custom' });
  const addedState = addLifeSponsor({ store, payload: { brand: 'Tissot', categories: ['watches'], fee: 200000 }, manual: true });
  assert.ok(addedState.lifeHub.sponsors.some((s) => s.brand === 'Tissot'));
});

test('Calendar birthdays, -1/+1 clash shift, 4-choice gifts vs close party, scheduler & games_only', () => {
  const st = baseState();
  st.lifeHub = ensureLifeHub(st, st.snapshot);
  st.lifeHub.calibrated = true;
  st.persona = normalizePersona({
    playerDob: '2003-09-12',
    circle: {
      family: [{ id: 'f1', role: 'Mère', name: 'Maria Silva', dob: '1975-09-15', close: true, protect: true }],
    },
  });
  st.squadBirthdays = { sq_103: '2001-09-13', sq_106: '2005-09-11' }; // sq_103 close teammate (3 choices), sq_106 regular teammate (4 gift choices)

  // Match on 2026-09-15 clashes with Maria Silva's birthday -> default shift -1d to 2026-09-14
  const bdays = birthdaysForYear(st, 2026, { includeAutoSquad: true });
  const maria = bdays.find((b) => b.name === 'Maria Silva');
  assert.ok(maria);
  assert.strictEqual(maria.actualDate, '2026-09-15');
  assert.strictEqual(maria.clash, true);
  assert.strictEqual(maria.date, '2026-09-14');
  assert.strictEqual(maria.shiftedBy, -1);

  // Flip clash toggle -> +1d (2026-09-16) and back
  flipBirthdayShift(st, maria.key);
  const mariaAfter = birthdaysForYear(st, 2026, { includeAutoSquad: true }).find((b) => b.name === 'Maria Silva');
  assert.strictEqual(mariaAfter.date, '2026-09-16');
  assert.strictEqual(mariaAfter.shiftedBy, 1);

  // Regular teammate due decision has 4 gift/message choices
  const decsTeammate = collectDueDecisions(st, st.snapshot, '2026-09-11', { eventMode: 'realistic' });
  const regDec = decsTeammate.find((d) => d.personName === 'Tiago Gomes');
  assert.ok(regDec);
  assert.strictEqual(regDec.choices.length, 4);

  // Resolve teammate gift decision -> awards squad meter & adds Huddle message
  const res = resolveCalendarDecision(st, regDec.id, 'thoughtful_gift', '2026-09-11', { language: 'en' });
  assert.ok(res.choice);
  assert.ok(st.huddles[0].messages.some((m) => /Tiago Gomes/i.test(m.text)));

  // Close contact shifted birthday due decision has 3 party/dinner choices
  const decsMaria = collectDueDecisions(st, st.snapshot, '2026-09-16', { eventMode: 'realistic' });
  const mariaDec = decsMaria.find((d) => d.personName === 'Maria Silva');
  assert.ok(mariaDec);
  assert.strictEqual(mariaDec.choices.length, 3);

  // Player own birthday due decision has 3 choices
  const decsSelf = collectDueDecisions(st, st.snapshot, '2026-09-12', { eventMode: 'realistic' });
  assert.strictEqual(decsSelf.find((d) => d.closeness === 'self')?.choices.length, 3);

  // games_only suppresses non-match decisions and system events
  assert.deepStrictEqual(collectDueDecisions(st, st.snapshot, '2026-09-13', { eventMode: 'games_only' }), []);
  assert.deepStrictEqual(seedSystemEvents(st, st.snapshot, '2026-09-10', { eventMode: 'games_only' }), []);

  // Advance off-pitch activity scheduling
  const ev = scheduleOffPitchActivity(st, { date: '2026-09-20', activityId: 'team_dinner', companion: 'Bruno Costa' }, () => 'sched_1');
  assert.strictEqual(ev.kind, 'scheduled');
  const ag = calendarAgenda(st, '2026-09');
  assert.ok(ag.items.some((x) => x.kind === 'scheduled' && x.date === '2026-09-20'));
});

test('Daily Pulse (spoiler-free Tier 1 & Privacy-shielded Tier 2) + Drama Engine sponsor arcs', async () => {
  const st = baseState();
  st.lifeHub = ensureLifeHub(st, st.snapshot);
  st.lifeHub.calibrated = true;
  st.lifeHub.stage = 'superstar';
  st.lifeHub.biddingWars = [{ id: 'w1', category: 'watches', bids: [{ brand: 'Rolex' }, { brand: 'Omega' }] }];
  addSponsor(st, { brand: 'Guarujá Sports Clinic', categories: ['local'], fee: 45000 }, '2026-09-10', () => 'sp_loc');

  // Unplayed future fixture on 2026-09-15 (must never reveal any score)
  st.snapshot.fixtures[1].score = [4, 0]; // simulate raw underlying fixture before reveal
  const dueBdays = [{ closeness: 'self', name: 'Lucas Silva', ageTurning: 24, date: '2026-09-12' }];
  const pulse = runProceduralDailyPulse(st, st.snapshot, {
    step: { nextDate: '2026-09-12' },
    settings: { eventMode: 'realistic', language: 'en' },
    dueBirthdays: dueBdays,
  });
  assert.strictEqual(pulse.skipped, false);
  assert.ok(pulse.posts >= 1);
  assert.ok(st.dailyBriefs.length >= 1);
  assert.ok(!JSON.stringify(st.dailyBriefs).includes('4-0'));
  assert.strictEqual(pulse.notablePulse?.kind, 'birthday');

  // Drama engine detects sponsor_war & sponsor_roots
  const candidates = detectDramaCandidates({ state: st, snapshot: st.snapshot, changes: {}, mem: {} });
  assert.ok(candidates.some((c) => c.kind === 'sponsor_war'));
  assert.ok(candidates.some((c) => c.kind === 'sponsor_roots'));

  // Hybrid AI daily pulse masks sensitive hometown/circle names before sending to complete()
  st.persona = normalizePersona({
    roots: { hometown: 'Guarujá Secret' },
    rootProtect: { hometown: true },
    circle: { family: [{ id: 'f1', role: 'Mère', name: 'Rosana Secret', protect: true }] },
  });
  const privMap = buildPrivacyMap({ enabled: true, fields: { custom: 'Guarujá Secret' } }, {
    playerName: st.snapshot.player.name,
    persona: st.persona,
  });
  st.lifeHub.biddingWars[0].bids[0].brand = 'Guarujá Secret Luxury'; // also ensure any leaked real name in facts is checked

  let seenPromptToAi = '';
  const aiRes = await runHybridAiDailyPulse({
    state: st,
    snapshot: st.snapshot,
    settings: { eventMode: 'realistic', language: 'en' },
    apiKey: 'fake',
    notable: { kind: 'match_eve', date: '2026-09-14', opponent: 'Porto', competition: 'Liga Portugal' },
    privacyMap: privMap,
    newId: (() => { let n = 0; return () => `ai_${++n}`; })(),
    complete: async (_stg, _key, opts) => {
      seenPromptToAi = maskText(opts.user, opts.privacyMap);
      assert.ok(!seenPromptToAi.includes('Rosana Secret'));
      const decoyHometown = privMap.pairs.find((p) => p.real === 'Guarujá Secret')?.decoy || 'Valverde';
      const fakeJson = JSON.stringify({
        brief: { headline: `Training ahead of Porto from ${decoyHometown}`, body: `Star feels support from ${decoyHometown}.`, tag: 'match_eve' },
        kop: [{ name: 'Porto Insider', handle: 'PortoWire', type: 'journalist', text: `Calm build-up from ${decoyHometown}.` }],
        huddle: { from: 'Bruno Costa', text: 'Big night tomorrow boys!' },
      });
      return unmaskText(fakeJson, opts.privacyMap);
    },
  });
  assert.strictEqual(aiRes.ok, true);
  assert.ok(st.dailyBriefs.some((b) => b.source === 'ai' && b.headline.includes('Guarujá Secret')));
  assert.ok(st.huddles[0].messages.some((m) => m.dailyPulse && m.from === 'Bruno Costa'));
});

test('Accent-insensitive Privacy Shield, customWords (+)/(-), 3 new Persona fields & strict Privacy-Filtered AI backstory', async (t) => {
  const persona = normalizePersona({
    roots: { hometown: 'Guarujá', childhood: 'Bairro da Enseada', academy: 'Santos FC' },
    rootProtect: { hometown: true, childhood: true, academy: false },
    flavor: {
      signature: 'Bandage blanc',
      turningPoint: 'Écarté à 16 ans avant de percer à Guarujá',
      idol: 'Ronaldinho',
      dream: 'Soulever la Coupe du monde',
    },
    circle: {
      family: [{ id: 'f1', role: 'Mère', name: 'Élodie Silva', protect: true }],
    },
  });
  const facts = personaFacts(persona);
  assert.ok(facts.flavor.turning_point.includes('Guarujá'));
  assert.strictEqual(facts.flavor.football_idol, 'Ronaldinho');
  assert.strictEqual(facts.flavor.career_dream, 'Soulever la Coupe du monde');

  // Verify customWords dynamic rows (capped at MAX_CUSTOM_WORDS) and NFC/accent-insensitive matching
  const overflowing = Array.from({ length: MAX_CUSTOM_WORDS + 5 }, (_, i) => ({ word: `SecretPlace${i}`, decoy: `Alias${i}` }));
  const map = buildPrivacyMap(
    { enabled: true, customWords: [{ word: 'Padaria Central', decoy: 'Café do Porto' }, ...overflowing] },
    { careerId: 'c1', playerName: 'Lucas Silva', handle: 'lucassilva', persona },
  );
  assert.ok(map.pairs.some((p) => p.real === 'Padaria Central' && p.decoy === 'Café do Porto'));
  const overflowCount = map.pairs.filter((p) => p.real.startsWith('SecretPlace')).length;
  assert.ok(overflowCount <= MAX_CUSTOM_WORDS);

  // Unaccented / accented mixed casing variants must mask & restore cleanly
  const sampleIn = 'lucassilva et Elodie Silva viennent de Guaruja pres de Padaria Central et GUARUJÁ.';
  const maskedSample = maskText(sampleIn, map);
  assert.ok(!/Guaruja/i.test(maskedSample));
  assert.ok(!/Elodie Silva/i.test(maskedSample));
  assert.ok(maskedSample.includes('Café do Porto'));
  const restored = unmaskText(maskedSample, map);
  assert.ok(restored.includes('Padaria Central'));

  // generateBackstory strictly masks prompt sent to completeFn and unmasks back for user editing
  const store = mkTmpStore(t);
  store.saveSettings({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
  const st = baseState();
  st.persona = persona;
  store.saveCareer(st);
  store.setActiveCareer(st.careerId);

  const personaWithDob = normalizePersona({
    playerDob: '2003-04-18',
    roots: { hometown: 'Guarujá', childhood: 'Bairro da Enseada', academy: 'Santos FC' },
    rootProtect: { hometown: true, childhood: true, academy: false },
    flavor: {
      signature: 'Bandage blanc',
      turningPoint: 'Écarté à 16 ans avant de percer à Guarujá',
      idol: 'Ronaldinho',
      dream: 'Soulever la Coupe du monde',
    },
    circle: {
      family: [{ id: 'f1', role: 'Mère', name: 'Élodie Silva', dob: '1975-09-02', protect: true }],
    },
  });
  let sentSystem = '';
  let sentUser = '';
  const res = await generateBackstory({
    store,
    settings: { ...store.getSettings(), language: 'fr' },
    persona: personaWithDob,
    privacy: { enabled: true, customWords: [{ word: 'Padaria Central', decoy: 'Café do Porto' }] },
    playerName: 'Lucas Silva',
    club: 'Santos FC',
    completeFn: async (_stg, _key, opts) => {
      sentSystem = maskText(opts.system, opts.privacyMap);
      sentUser = maskText(opts.user, opts.privacyMap);
      assert.ok(sentSystem.includes('Write the entire biography in French.'), 'fr target language enforced in prompt');
      assert.ok(!/Guaruj[áa]/i.test(sentUser), 'real hometown leaked to AI');
      assert.ok(!/[EÉ]lodie Silva/i.test(sentUser), 'real mother name leaked to AI');
      assert.ok(!/Lucas Silva/i.test(sentUser), 'real player name leaked to AI');
      assert.ok(!sentUser.includes('2003-04-18'), 'real player_dob leaked to AI');
      assert.ok(!sentUser.includes('1975-09-02'), 'real circle member dob leaked to AI');
      const pDecoy = opts.privacyMap.pairs.find((p) => p.real === 'Lucas Silva')?.decoy || 'Player';
      const hDecoy = opts.privacyMap.pairs.find((p) => p.real === 'Guarujá')?.decoy || 'Town';
      const rawJson = JSON.stringify({
        bio: `${pDecoy} grew up in ${hDecoy}, inspired by Ronaldinho, aiming to win the World Cup.`,
      });
      return unmaskText(rawJson, opts.privacyMap);
    },
  });
  assert.ok(sentSystem.length > 0 && sentUser.length > 0);
  assert.strictEqual(res.masked, true);
  assert.ok(res.pairs >= 3);
  assert.ok(res.text.includes('Lucas Silva'));
  assert.ok(res.text.includes('Guarujá'));
  assert.ok(res.text.includes('Ronaldinho'));

  let sentEnSystem = '';
  await generateBackstory({
    store,
    settings: { ...store.getSettings(), language: 'en' },
    persona: personaWithDob,
    privacy: { enabled: false },
    playerName: 'Lucas Silva',
    completeFn: async (_stg, _key, opts) => {
      sentEnSystem = opts.system;
      return JSON.stringify({ bio: 'English bio.' });
    },
  });
  assert.ok(sentEnSystem.includes('Write the entire biography in English.'));
});

test('Agent two-way sync via world.updateAgent, global sponsors catalog (250+), 8 car categories & sponsor gifted cars', (t) => {
  const store = mkTmpStore(t);
  assert.strictEqual(store.getSettings().autoUpdateCheck, true);

  const st = baseState();
  st.agent = { name: 'Old Agent', agency: 'Old Agency' };
  st.mail = [{ id: 'm_agent_1', role: 'agent', from: 'Old Agent', subject: 'Contract', messages: [] }];
  st.persona = normalizePersona({});
  store.saveCareer(st);
  store.setActiveCareer(st.careerId);

  const updated = updateAgent({ store, name: 'Jorge Costa', agency: 'Gestifute' });
  assert.strictEqual(updated.agent.name, 'Jorge Costa');
  assert.strictEqual(updated.agent.agency, 'Gestifute');
  assert.strictEqual(updated.mail[0].from, 'Jorge Costa');
  assert.ok(updated.persona.circle.business.some((p) => /agent/i.test(p.role) && p.name === 'Jorge Costa'));

  // Expanded global sponsor catalog & logo slug helper
  assert.ok(BRAND_CATALOG.length >= 250, `expected >= 250 global brands, got ${BRAND_CATALOG.length}`);
  assert.strictEqual(brandSlug('Oi Ocha (Ito En)'), 'oi_ocha_ito_en');
  assert.strictEqual(brandSlug('Air France / KLM'), 'air_france_klm');

  // 8 refactored car categories + backward compatibility alias
  const carIds = ASSET_CATALOG.filter((a) => a.category === 'car').map((a) => a.id);
  assert.deepStrictEqual(carIds, ['car_hatch', 'car_sedan', 'car_minivan', 'car_suv', 'car_electric_gt', 'car_sports', 'car_classic', 'car_supercar']);

  const hub = ensureLifeHub(updated, updated.snapshot);
  hub.calibrated = true;
  hub.stage = 'superstar';
  hub.cash = 1000000;
  updated.snapshot.stats.season = { apps: 28, goals: 22, assists: 12, avgRating: 8.1 }; // 34 G+A -> unlocks milestone cars

  // Buying legacy ID resolves transparently
  const afterBuy = buyAsset(updated, { catalogId: 'exotic_supercar' }, '2026-09-10', () => 'a_legacy');
  assert.strictEqual(afterBuy.assets.find((a) => a.catalogId === 'car_supercar')?.catalogId, 'car_supercar');

  // Signing an automotive sponsor automatically gifts annual company car + high-profile milestone cars at €0 cost/upkeep
  addSponsor(updated, { brand: 'Porsche', categories: ['automotive'], fee: 450000, bonus: 6000, isGlobalPartner: true, until: '2028-09-10' }, '2026-09-10', (() => { let n = 0; return () => `auto_${++n}`; })());
  // 2.0 : chaque voiture est d'abord un choix de modèle dans le calendrier (gamme réelle de la marque)
  const carDecs = updated.calendar.pendingDecisions.filter((d) => d.kind === 'car_gift' && d.brand === 'Porsche');
  assert.ok(carDecs.length >= 2, 'high-profile automotive deal offers annual + milestone cars');
  assert.ok(carDecs[0].choices.some((c) => c.label === '911 Turbo S' || c.label === '911 Carrera' || c.label === 'Taycan'), 'real Porsche models');
  assert.ok(carDecs[0].choices.every((c) => c.catId !== 'car_minivan'), 'never a type the brand does not make');
  for (const d of carDecs) resolveCalendarDecision(updated, d.id, d.choices[0].id, '2026-09-10', { newId: (() => { let k = 0; return () => `pick_${d.id}_${++k}`; })() });
  const gifted = hub.assets.filter((a) => a.giftedBy === 'Porsche');
  assert.ok(gifted.length >= 2, 'picked cars arrive');
  assert.ok(gifted.every((g) => g.model), 'with their model name');
  for (const g of gifted) {
    assert.strictEqual(g.price, 0);
    assert.strictEqual(g.monthlyCost, 0);
    assert.strictEqual(g.resaleValue, 0);
  }
  const cashBeforeReturn = hub.cash;
  sellAsset(updated, gifted[0].id, '2026-09-11', () => 'ret_1');
  assert.ok(!hub.assets.some((a) => a.id === gifted[0].id));
  assert.strictEqual(hub.cash, cashBeforeReturn);
  assert.strictEqual(ownedMonthlyCost({ assets: gifted }), 0);

  // Next year (>365d, early new season) grants another annual car cleanly
  updated.snapshot.stats.season = { apps: 3, goals: 2, assists: 1, avgRating: 7.2 };
  const nextYear = grantSponsorCars(updated, hub, updated.snapshot, '2027-09-15', () => 'yr2_car');
  assert.strictEqual(nextYear.length, 1);
  assert.strictEqual(nextYear[0].brand, 'Porsche');
  assert.strictEqual(nextYear[0].reason, 'annual');

  // Editing an existing sponsor to add automotive category triggers grantSponsorCars immediately
  const lifeSp = addSponsor(updated, { brand: 'TAG Heuer', categories: ['watches'], fee: 200000, bonus: 3000, until: '2028-09-10' }, '2027-09-15', () => 'tag_1');
  updateSponsor(updated, { id: lifeSp.id, brand: 'Mercedes-Benz', categories: ['automotive'] }, { gameDate: '2027-09-16', newId: () => 'merc_car_1' });
  assert.ok(updated.calendar.pendingDecisions.some((d) => d.kind === 'car_gift' && d.brand === 'Mercedes-Benz'));
});

test('décisions 2.0 : un choix risqué peut se retourner (tirage stable) et revenir en suite ; les choix « sages » jamais', () => {
  const mk = () => ({
    careerId: 'risk-test',
    snapshot: { gameDate: '2026-09-10', player: { name: 'Test' } },
    calendar: { simDate: '2026-09-10', systemEvents: [], resolvedDecisionIds: [], pendingDecisions: [] },
  });
  const decision = (choice) => ({ id: 'dec_sys_x1', kind: 'system_event', eventKey: 'club_media_day', date: '2026-09-10', title: 'club_media_day', choices: [choice] });
  // risque certain : pénalité, souvenir « backfire » et une suite programmée 2 à 4 jours plus tard
  const a = mk();
  a.calendar.pendingDecisions.push(decision({ id: 'go_all_in', cost: 0, effects: { media: 5 }, memory: 'went big', risk: { chance: 1, effects: { media: -4 }, memory: 'went viral badly', followUp: 'fu_viral_quote' } }));
  const ra = resolveCalendarDecision(a, 'dec_sys_x1', 'go_all_in', '2026-09-10', { language: 'en' });
  assert.ok(ra.backfire);
  assert.strictEqual(a.lastDecisionOutcome.backfire, true);
  assert.ok(a.lifeHub.recentEvents.some((e) => e.kind === 'backfire'));
  const fu = a.calendar.systemEvents.find((e) => e.eventKey === 'fu_viral_quote');
  assert.ok(fu && fu.date >= '2026-09-12' && fu.date <= '2026-09-14');
  const fuDecs = collectDueDecisions(a, a.snapshot, fu.date, { eventMode: 'realistic' });
  assert.ok(fuDecs.some((d) => d.kind === 'follow_up' && d.choices.some((c) => c.id === 'fu_stay_silent' && !c.risk)));
  // sans risque : jamais de retour de bâton
  const b = mk();
  b.calendar.pendingDecisions.push(decision({ id: 'skip_focus', cost: 0, effects: { manager: 3 }, memory: 'focused' }));
  assert.strictEqual(resolveCalendarDecision(b, 'dec_sys_x1', 'skip_focus', '2026-09-10', { language: 'en' }).backfire, null);
  // le tirage ne dépend que de la décision : même issue à chaque fois
  const c1 = mk(); const c2 = mk();
  const half = { id: 'go_all_in', cost: 0, effects: {}, memory: 'm', risk: { chance: 0.5, effects: {}, memory: 'r' } };
  c1.calendar.pendingDecisions.push(decision({ ...half })); c2.calendar.pendingDecisions.push(decision({ ...half }));
  assert.strictEqual(Boolean(resolveCalendarDecision(c1, 'dec_sys_x1', 'go_all_in').backfire), Boolean(resolveCalendarDecision(c2, 'dec_sys_x1', 'go_all_in').backfire));
});
