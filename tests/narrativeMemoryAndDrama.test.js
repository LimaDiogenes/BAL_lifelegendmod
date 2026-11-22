'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Store } = require('../src/store');
const providers = require('../src/ai/providers');
const origComplete = providers.complete;
let mockComplete = null;
providers.complete = async (...args) => (mockComplete ? mockComplete(...args) : origComplete(...args));
const {
  MAX_PRESS_HISTORY,
  MAX_QUOTE_VAULT,
  loadNarrativeMemory,
  saveNarrativeMemory,
  recordPressQuestions,
  recordPressAnswers,
  recordPressSkip,
  recordInterviewQuestions,
  recordInterviewAnswer,
  recordKopQuote,
  dismissDramaArc,
  clearMediaQuestionHistory,
  findRepeatedQuestions,
  pickPressBeats,
} = require('../src/world/narrativeMemory');
const { detectDramaCandidates, tickDramaArcs, dramaFacts } = require('../src/world/dramaEngine');
const { toneContext } = require('../src/world/toneContext');
const { tribunePlan } = require('../src/world/tribunePlan');
const { huddleToday } = require('../src/world/huddle');
const world = require('../src/world/world');

const tmpDirs = [];
function makeTmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'll-drama-test-'));
  tmpDirs.push(d);
  return d;
}

after(() => {
  mockComplete = null;
  providers.complete = origComplete;
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function makePeakCareerState() {
  const form = ['V', 'V', 'V', 'V', 'V'];
  const state = {
    careerId: 'peak_42',
    profile: { handle: 'diordi', displayName: 'Diordi', position: 'AMF', followers: 2800000 },
    bio: { text: 'Born in Manaíra, came up through street pitches and academy setbacks before conquering Europe.', kind: 'created' },
    persona: {
      preset: 'custom',
      traits: {
        media: 'guarded_tactical',
        temperament: 'passionate',
        ambition: 'Become a World Champion with Brazil',
        loyalty: 'loyal_fighter',
        lifestyle: 'bookish_calm',
        ego: 'humble_star',
      },
      roots: { hometown: 'João Pessoa', childhood: 'Street futsal', academy: '', heritage: '' },
      flavor: { signature: 'Quiet headphones walk', hobby: 'Reading tactics', favoriteDish: 'Feijoada', motto: 'Let the pitch speak' },
      circle: {
        family: [{ id: 'f1', role: 'Father', name: 'Carlos', decoy: '', protect: false }],
        friends: [{ id: 'fr1', role: 'Confidant', name: 'Rafa', decoy: '', protect: false }],
        business: [],
        roots: [],
      },
    },
    lifeHub: {
      calibrated: true,
      stage: 'superstar',
      meters: { manager: 100, squad: 86, fans: 100, sponsors: 100, media: 93 },
      sponsors: [
        { id: 's1', brand: 'adidas' },
        { id: 's2', brand: 'RedBull' },
        { id: 's3', brand: 'Samsung' },
        { id: 's4', brand: 'Sony' },
        { id: 's5', brand: 'Canon' },
        { id: 's6', brand: 'All Nippon Airways' },
      ],
      assets: [
        { id: 'a1', catalogId: 'luxury_villa', category: 'home', name: 'Luxury Villa' },
        { id: 'a2', custom: true, category: 'car', name: 'Nissan Elgrand' },
        { id: 'a3', custom: true, category: 'car', name: 'Custom Chopper Bike' },
      ],
      recentEvents: [{ date: '2029-01-01', text: 'Invited academy kids onto the grass after session' }],
    },
    fanMood: { level: 0, target: null, reasons: [], since: '2029-01-10' },
    editions: [{ gameDate: '2029-01-01', national: [], local: [] }, { gameDate: '2029-01-05', national: [], local: [] }],
    feed: [],
    accounts: {},
    writers: { national_columnist: 'Marc Lhermitte', local_beat_writer: 'Tommy Finch', national_desk: [{ name: 'Marc Lhermitte', role: 'Reporter' }, { name: 'Hélène Marchetti', role: 'Éditorialiste' }] },
    localPaper: { name: 'The Anfield Kop Chronicle', city: 'Liverpool' },
    storylines: [],
    onRecord: [],
    promises: [],
    mail: [],
    agent: { name: 'Elena Vance', stance: 'je veux prolonger' },
  };
  const snapshot = {
    gameDate: '2029-01-10',
    season: '2028-2029',
    player: { id: 42, name: 'Diordi', nationality: 'Brazil', contractUntil: '2031-06-30', salary: 12000000, offers: [], interests: [], profile: { age: 24, marketValue: 135000000, abilities: { offensiveAwareness: 92 } }, history: { joinedClub: '2026-07-01' } },
    club: { ref: '10', name: 'Liverpool FC', short: 'LIV', stadium: 'Anfield', coach: 'A. Slot' },
    league: { id: 17, name: 'Premier League' },
    stats: { total: { apps: 20, starts: 20, minutes: 1780, goals: 37, assists: 26, avgRating: 8.6 }, byCompetition: {} },
    squad: [{ name: 'Diordi', me: true, goals: 37 }, { name: 'M. Salah', pos: 'RWF', apps: 20, goals: 14 }],
    squadIntel: {
      captain: { name: 'V. van Dijk', me: false },
      positionRivals: [{ name: 'M. Rosiak', pos: 'AMF' }],
      unusedBench: [{ name: 'L. Chambers' }],
      squadSize: 25,
    },
    table: [
      { pos: 1, ref: '10', team: 'Liverpool FC', p: 20, w: 20, d: 0, l: 0, gf: 72, ga: 12, pts: 60, mine: true, form },
      { pos: 2, ref: '20', team: 'Arsenal FC', p: 20, w: 15, d: 2, l: 3, gf: 45, ga: 18, pts: 47, mine: false, form: ['V', 'V', 'N', 'V', 'V'] },
    ],
    fixtures: [
      { id: 'm20', date: '2029-01-10', home: 'Brighton', away: 'Liverpool FC', competition: 'Premier League', venue: 'extérieur', played: true, score: [2, 4], me: { starter: true, minutes: 90, goals: 2, assists: 1, rating: 8.5, ratingWord: 'exceptionnel' }, goalTimeline: [{ minute: 18, scorer: 'Diordi', side: 'away' }, { minute: 67, scorer: 'Diordi', side: 'away' }], clubLineup: [{ name: 'Diordi', starter: true, position: 'milieu offensif', goals: 2, assists: 1, rating: 8.5 }, { name: 'M. Salah', starter: true, goals: 1, assists: 1, rating: 8.0 }] },
      { id: 'm21', date: '2029-01-14', home: 'Brentford FC', away: 'Liverpool FC', competition: 'FA Cup', venue: 'extérieur', played: false, score: null, me: null },
    ],
    last: { id: 'm20', date: '2029-01-10', home: 'Brighton', away: 'Liverpool FC', competition: 'Premier League', venue: 'extérieur', played: true, score: [2, 4], me: { starter: true, minutes: 90, goals: 2, assists: 1, rating: 8.5, ratingWord: 'exceptionnel' }, goalTimeline: [{ minute: 18, scorer: 'Diordi', side: 'away' }] },
    next: { id: 'm21', date: '2029-01-14', home: 'Brentford FC', away: 'Liverpool FC', competition: 'FA Cup', venue: 'extérieur', played: false, score: null, me: null },
    roundResults: [],
    nextRound: [],
    windows: [],
    nationalTeam: { ref: '500', name: 'Brazil', inSquad: true, squad: ['Vinícius Jr', 'Rodrygo'], fixtures: [], stats: { apps: 4, goals: 5, assists: 2, avgRating: 8.1 } },
    coaches: { mine: 'A. Slot', nextOpponent: 'T. Frank' },
  };
  return { state: { ...state, snapshot }, snapshot };
}

describe('Mémoire narrative locale et anti-répétition', () => {
  it('persiste narrative-memory.json sur disque via Store et borne les historiques', () => {
    const dir = makeTmpDir();
    const store = new Store(dir);
    const mem = loadNarrativeMemory(store, 'c_1');
    assert.equal(mem.pressHistory.length, 0);

    for (let i = 0; i < MAX_PRESS_HISTORY + 10; i++) {
      recordPressQuestions(mem, {
        gameDate: `2029-01-${String((i % 28) + 1).padStart(2, '0')}`,
        matchId: `m_${i}`,
        questions: [{ journalist: 'Reporter', outlet: 'Paper', beat: 'tactical_moment', focus: 'tactics', question: `Question unique numéro ${i} sur le jeu collectif ?` }],
      });
    }
    for (let i = 0; i < MAX_QUOTE_VAULT + 6; i++) {
      recordKopQuote(mem, { gameDate: '2029-01-10', text: `We stay hungry every match and never lift our foot off the gas #${i}` });
    }
    recordInterviewQuestions(mem, { gameDate: '2029-01-05', journalist: 'Marc', questions: ['How did your roots shape you today?'] });
    recordInterviewAnswer(mem, { gameDate: '2029-01-06', journalist: 'Marc', text: 'Street football taught me everything about poise under fire.' });

    const saved = saveNarrativeMemory(store, 'c_1', mem);
    assert.equal(saved.pressHistory.length, MAX_PRESS_HISTORY);
    assert.equal(saved.quoteVault.length, MAX_QUOTE_VAULT);
    assert.ok(fs.existsSync(path.join(dir, 'careers', 'c_1', 'narrative-memory.json')));

    const reloaded = loadNarrativeMemory(store, 'c_1');
    assert.equal(reloaded.pressHistory.length, MAX_PRESS_HISTORY);
    assert.equal(reloaded.quoteVault.length, MAX_QUOTE_VAULT);

    clearMediaQuestionHistory(reloaded);
    assert.equal(reloaded.pressHistory.length, 0);
    assert.equal(reloaded.interviewHistory.length, 0);
    assert.equal(reloaded.quoteVault.length, MAX_QUOTE_VAULT);
  });

  it('findRepeatedQuestions repère les doublons sémantiques et les formules clichés', () => {
    const mem = { pressHistory: [], interviewHistory: [] };
    assert.deepEqual(findRepeatedQuestions(['Unique question one?'], mem), []);

    recordPressQuestions(mem, {
      gameDate: '2029-01-07',
      matchId: 'm19',
      questions: [
        { journalist: 'J1', outlet: 'O1', question: 'Diordi, with 60 points from 20 matches, how are you maintaining this level of consistency before facing Brentford?' },
        { journalist: 'J2', outlet: 'O2', question: 'Do you think nine commercial sponsors distract you on matchdays?' },
      ],
    });

    const repeats = findRepeatedQuestions([
      'After reaching 60 points in 20 games, how are you maintaining this level of consistency ahead of Arsenal?',
      'That switch to a double pivot freed your left half-space at 18 minutes—was it rehearsed in training?',
      'How do you feel about the suggestion that your sponsors distract from football?',
    ], mem);

    assert.ok(repeats.some((r) => r.index === 0), 'repère le cliché consistency');
    assert.ok(!repeats.some((r) => r.index === 1), 'laisse passer une question tactique originale');
  });

  it('pickPressBeats tourne sur des angles variés sans répéter les facettes récentes', () => {
    const { state, snapshot } = makePeakCareerState();
    const mem = loadNarrativeMemory(null, 'peak_42');
    const drama = tickDramaArcs({ state, snapshot, changes: { newResults: [snapshot.last] }, mem });

    const b1 = pickPressBeats({ state, snapshot, mem, activeArcs: drama.active, match: snapshot.last });
    assert.ok(b1.length >= 5 && b1.length <= 7, `expected 5..7 beats, got ${b1.length}`);
    assert.notEqual(b1[0].beat, b1[1].beat);
    assert.notEqual(b1[1].beat, b1[2].beat);
    assert.ok(b1[1].beat.startsWith('drama:'), 'la question piquante exploite un arc actif');

    recordPressQuestions(mem, {
      gameDate: '2029-01-10',
      matchId: 'm20',
      questions: b1.map((b, i) => ({ journalist: `J${i}`, outlet: 'O', beat: b.beat, focus: b.focusLabel, question: `Q ${b.beat}?` })),
    });
    const b2 = pickPressBeats({ state, snapshot, mem, activeArcs: drama.active, match: snapshot.last });
    assert.notEqual(b2[0].beat, b1[0].beat, 'le thème du match tourne entre deux conférences');
  });
});

describe('Moteur de drame et phase faste (Spotlight Drama Engine)', () => {
  it('crée des arcs dramatiques fondés sur les faits même à fanMood = 0 en pleine domination', () => {
    const { state, snapshot } = makePeakCareerState();
    const mem = { dramaArcs: [], quoteVault: [], pressBehavior: { skips: 0, noComments: 0, totalDone: 0 }, pressHistory: [], interviewHistory: [], personaBeatsUsed: [] };

    const detected = detectDramaCandidates({ state, snapshot, changes: { newResults: [snapshot.last] }, mem });
    const kinds = new Set(detected.map((d) => d.kind));
    assert.ok(kinds.has('tall_poppy_skeptics'));
    assert.ok(kinds.has('brand_vs_football'));
    assert.ok(kinds.has('persona_friction'));
    assert.ok(kinds.has('divided_loyalties'));
    assert.ok(kinds.has('dressing_room_shadow'));
    assert.ok(kinds.has('roots_backstory_echo'));
    assert.ok(kinds.has('invincible_target'));

    const d1 = tickDramaArcs({ state, snapshot, changes: {}, mem });
    assert.equal(d1.active.length, 2);
    assert.ok(d1.spotlight >= 75);
    assert.ok(dramaFacts(mem)?.active_arcs?.length === 2);

    // Faire passer 4 éditions pour que les arcs initiaux passent en cooldown et tournent vers d'autres angles
    const firstKinds = d1.active.map((a) => a.kind);
    tickDramaArcs({ state, snapshot: { ...snapshot, gameDate: '2029-01-13' }, changes: {}, mem });
    tickDramaArcs({ state, snapshot: { ...snapshot, gameDate: '2029-01-16' }, changes: {}, mem });
    const afterCycle = tickDramaArcs({ state, snapshot: { ...snapshot, gameDate: '2029-01-20' }, changes: {}, mem });
    const nextKinds = afterCycle.active.map((a) => a.kind);
    assert.ok(nextKinds.some((k) => !firstKinds.includes(k)), 'les sujets médiatiques tournent et se renouvellent');

    // Sécher la conférence active ou renforce media_cold_war
    recordPressSkip(mem, { gameDate: '2029-01-21' });
    dismissDramaArc(mem, afterCycle.active[0].id, '2029-01-21');
    const cold = tickDramaArcs({ state, snapshot: { ...snapshot, gameDate: '2029-01-22' }, changes: {}, mem });
    assert.ok(cold.active.some((a) => a.kind === 'media_cold_war'));
  });

  it('toneContext reflète la pression de domination, les sponsors et les arcs actifs à fanMood = 0', () => {
    const { state, snapshot } = makePeakCareerState();
    const mem = { dramaArcs: [], quoteVault: [], pressBehavior: { skips: 0, noComments: 0, totalDone: 0 } };
    const drama = tickDramaArcs({ state, snapshot, changes: {}, mem });
    const tone = toneContext({ snapshot, state, dramaArcs: drama.active });
    assert.ok(tone.drama >= 65, `expected drama >= 65, got ${tone.drama}`);
    assert.ok(tone.spotlight >= 70);
    assert.ok(tone.why.drama.some((w) => w.includes('cible') || w.includes('projecteur')));
  });

  it('tribunePlan et huddleToday injectent le drame actif sans casser le mode sans drame', () => {
    const { state, snapshot } = makePeakCareerState();
    const mem = { dramaArcs: [], quoteVault: [], pressBehavior: { skips: 0, noComments: 0, totalDone: 0 } };
    const drama = tickDramaArcs({ state, snapshot, changes: {}, mem });

    const slots = tribunePlan({ state, snapshot, changes: { newResults: [snapshot.last] }, handle: 'diordi', drama });
    assert.ok(slots.some((s) => s.angle.includes('media & fan drama')), 'créneau drame sur Kop');
    assert.ok(slots.some((s) => s.angle.includes('off-pitch life')), 'créneau hors-terrain/persona conservé');

    const hud = huddleToday(
      { clubRef: '10', club: 'Liverpool FC', coach: 'A. Slot', players: ['M. Salah', 'V. van Dijk'], messages: [] },
      { last: snapshot.last, edition: 2, date: '2029-01-10', squadIntel: snapshot.squadIntel, drama },
    );
    assert.match(hud.side_topic, /media\/fan buzz|FACTS\.media_spotlight/);
  });

  it('openPress relance une fois si l IA répète une question et sauvegarde dans narrative-memory.json', async () => {
    const dir = makeTmpDir();
    const store = new Store(dir, { isEncryptionAvailable: () => false });
    store.saveSettings({ provider: 'google', apiKey: 'test-key' });
    const { state } = makePeakCareerState();
    state.press = { id: '000005abcdef', matchId: 'm20', match: 'Brighton 2-4 Liverpool FC', gameDate: '2029-01-10', status: 'pending', questions: null, answers: null };
    store.saveCareer(state);
    store.setActiveCareer(state.careerId);

    const existingMem = loadNarrativeMemory(store, state.careerId);
    recordPressQuestions(existingMem, {
      gameDate: '2029-01-05',
      matchId: 'm19',
      questions: [{ journalist: 'Marc Lhermitte', outlet: 'La Transversale', question: 'How are you maintaining this level of consistency before facing Brentford?' }],
    });
    saveNarrativeMemory(store, state.careerId, existingMem);

    const calls = [];
    mockComplete = async (_settings, _key, req) => {
      calls.push(req);
      if (calls.length === 1 && /Five to seven journalists/.test(req.system)) {
        return JSON.stringify({
          questions: [
            { journalist: 'Marc Lhermitte', outlet: 'La Transversale', question: 'How are you maintaining this level of consistency ahead of Brentford?' },
            { journalist: 'Hélène Marchetti', outlet: 'La Transversale', question: 'Do ten commercials clash with Anfield?' },
            { journalist: 'Sam Doyle', outlet: 'Premier Wire', question: 'Does your quiet style frustrate fans?' },
            { journalist: 'Claire Vasseur', outlet: 'La Transversale', question: 'How did your link-up with Salah open up the Brighton back line?' },
            { journalist: 'Tom Reeves', outlet: 'Football Daily', question: 'Where does your rivalry in the Golden Boot race stand right now?' },
          ],
        });
      }
      if (calls.length === 2 && /Five to seven journalists/.test(req.system)) {
        return JSON.stringify({
          questions: [
            { journalist: 'Marc Lhermitte', outlet: 'La Transversale', question: 'Your 18th-minute goal came after switching inside—was that Slot’s tweak?' },
            { journalist: 'Hélène Marchetti', outlet: 'La Transversale', question: 'Do eleven commercial sponsors risk overshadowing football at Liverpool?' },
            { journalist: 'Sam Doyle', outlet: 'Premier Wire', question: 'Does keeping things guarded with the press shield the dressing room or widen the gap?' },
            { journalist: 'Claire Vasseur', outlet: 'La Transversale', question: 'How did your second-half combination with Salah break Brighton’s low block?' },
            { journalist: 'Tom Reeves', outlet: 'Football Daily', question: 'With the title gap widening, what did Slot demand inside the dressing room?' },
          ],
        });
      }
      return JSON.stringify({
        article: { headline: 'Diordi hits back at critics', dek: 'Focused only on the pitch', author: 'Marc Lhermitte', body: 'He faced the room cleanly. "Tactics won us the game at 18 minutes." That settled the room.' },
        posts: [],
        promises: [],
      });
    };

    try {
      const settings = { provider: 'google', model: 'gemini-3.6-flash', language: 'en', factCheck: false };
      const opened = await world.openPress({ store, settings, progress: () => {} });
      assert.equal(calls.length, 2, 'relance déclenchée après détection de répétition');
      assert.match(calls[1].user, /REMINDER:/);
      assert.match(opened.press.questions[0].question, /18th-minute goal/);

      await world.submitPress({
        store,
        settings,
        answers: [
          'Tactics won us the game at 18 minutes and the whole squad stuck to the plan.',
          'My commercial deals happen strictly outside training hours.',
          '',
        ],
        progress: () => {},
      });

      const memAfter = world.getNarrativeMemory({ store });
      assert.ok(memAfter.quoteVault.some((q) => q.text.includes('Tactics won us the game at 18 minutes')));
      assert.ok(memAfter.pressHistory.some((q) => q.declined === true));

      const dismissed = world.dismissNarrativeArc({ store, arcId: memAfter.dramaArcs[0]?.id });
      assert.ok(dismissed.memory);
      const cleared = world.clearNarrativeQuestions({ store });
      assert.equal(cleared.memory.pressHistory.length, 0);

      // Skipping or ignoring interviews generates both complaining and supporting reactions on Kop, Vestiaire & My Life
      state.press = { id: '000006abcdef', matchId: 'm21', match: 'Liverpool FC 3-1 Brentford', gameDate: '2029-01-14', status: 'pending', questions: null, answers: null };
      state.feed = [];
      state.huddles = [{ id: 'h1', clubRef: '10', club: 'Liverpool FC', coach: 'A. Slot', players: ['M. Salah', 'V. van Dijk'], messages: [] }];
      store.saveCareer(state);
      const afterSkip = world.skipPress({ store });
      assert.equal(afterSkip.press.status, 'skipped');
      assert.ok(afterSkip.feed.length >= 2, 'Kop receives both complaining journalist post and supporting fan post');
      assert.ok(afterSkip.feed.some((p) => p.author.type === 'journalist' && p.replies?.length > 0));
      assert.ok(afterSkip.feed.some((p) => p.author.type === 'fan' && p.replies?.length > 0));
      assert.ok(afterSkip.huddles[0].messages.length >= 1, 'Vestiaire teammate reacts to press silence');
    } finally {
      mockComplete = null;
    }
  });
});
