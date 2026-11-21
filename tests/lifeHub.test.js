'use strict';

const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const providers = require('../src/ai/providers');
const origComplete = providers.complete;
let mockComplete = async () => '{}';
providers.complete = async (settings, apiKey, opts) => mockComplete(settings, apiKey, opts);

const { Store } = require('../src/store');
const {
  detectCareerStage,
  sponsorSlotCap,
  estimateStartProfile,
  ensureLifeHub,
  calibrateLifeHub,
  lifeHubTick,
  buyAsset,
  sellAsset,
  addSponsor,
  updateSponsor,
  removeSponsor,
  answerSponsorOffer,
  completeObligation,
  performAction,
  answerDilemma,
  lifeHubFacts,
} = require('../src/world/lifeHub');
const world = require('../src/world/world');
const { sponsorTick, sponsorFacts } = require('../src/world/sponsors');

const tmpDirs = [];
function makeTmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'll-lifehub-test-'));
  tmpDirs.push(d);
  return d;
}

function makeRookieSnapshot(gameDate = '2026-08-20') {
  return {
    gameDate,
    season: '2026-2027',
    player: { id: 1, name: 'Leo Silva', nationality: 'Brazil', salary: 120000, offers: [], interests: [], profile: { age: 18, marketValue: 450000 } },
    club: { ref: '5', name: 'FC Annecy', short: 'FCA', stadium: 'Parc des Sports' },
    league: { id: 2, name: 'Ligue 2' },
    stats: { total: { apps: 2, goals: 0, assists: 1, avgRating: 6.4 } },
    squad: [{ name: 'Theo Meyer', pos: 'MF' }],
    fixtures: [],
    table: [{ pos: 10, ref: '5', team: 'FC Annecy', p: 2, w: 0, d: 2, l: 0, gf: 2, ga: 2, pts: 2, form: ['D', 'D'] }],
    roundResults: [],
    nextRound: [],
  };
}

function makeSuperstarSnapshot(gameDate = '2028-09-10') {
  return {
    gameDate,
    season: '2028-2029',
    player: {
      id: 99,
      name: 'Rafael Mendes',
      nationality: 'Brazil',
      salary: 8500000,
      careerRecords: {
        combinedTotals: { apps: 275, goals: 555, assists: 349, avgRating: 7.3 },
        international: { apps: 39, goals: 90, assists: 53 },
      },
      offers: [],
      interests: [],
      profile: { age: 23, marketValue: 95000000, teamRole: 'Superstar', affection: 86 },
    },
    club: { ref: '10', name: 'Liverpool FC', short: 'LIV', stadium: 'Anfield' },
    league: { id: 1, name: 'Premier League' },
    stats: { total: { apps: 12, goals: 18, assists: 7, avgRating: 7.7 } },
    squad: [{ name: 'Dominik Szoboszlai', pos: 'AMF' }, { name: 'Virgil van Dijk', pos: 'CB' }],
    fixtures: [],
    table: [{ pos: 1, ref: '10', team: 'Liverpool FC', p: 4, w: 4, d: 0, l: 0, gf: 12, ga: 2, pts: 12, form: ['W', 'W', 'W', 'W'] }],
    roundResults: [],
    nextRound: [],
  };
}

describe('Phase C My Life Hub, Mid-Career Calibration & Sim Engine', () => {
  beforeEach(() => {
    mockComplete = async () => '{}';
  });

  after(() => {
    providers.complete = origComplete;
    for (const d of tmpDirs) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('detects Rookie vs Superstar career stages accurately and scales start estimates', () => {
    const rookie = estimateStartProfile(makeRookieSnapshot());
    assert.equal(rookie.stage, 'rookie');
    assert.equal(rookie.followers >= 4200, true);
    assert.equal(rookie.followers < 25000, true);
    assert.equal(rookie.slotCap, 1);
    assert.equal(rookie.cashHumble, 15000);
    assert.deepEqual(rookie.bundleAssetIds, ['rented_studio']);

    const starSnap = makeSuperstarSnapshot();
    const det = detectCareerStage(starSnap);
    assert.equal(det.stage, 'superstar');
    assert.equal(det.apps, 275);
    assert.equal(det.goals, 555);

    const star = estimateStartProfile(starSnap, { persona: { preset: 'showman' } });
    assert.equal(star.stage, 'superstar');
    assert.ok(star.followers >= 1200000);
    assert.ok(star.cashOnly > star.cashBundle);
    assert.ok(star.cashBundle > 1000000);
    assert.equal(sponsorSlotCap(4200, 'rookie'), 1);
    assert.equal(sponsorSlotCap(30000, 'rising'), 2);
    assert.equal(sponsorSlotCap(200000, 'established'), 3);
    assert.equal(sponsorSlotCap(750000, 'established'), 5);
    assert.equal(sponsorSlotCap(star.followers, star.stage), null);
    assert.equal(sponsorSlotCap(2100000, 'established'), null);
    assert.ok(star.meters.manager >= 80);
    assert.ok(star.meters.sponsors >= 80);
    assert.ok(star.bundleAssetIds.includes('luxury_villa'));
  });

  it('calibrates bundle, cash_only, and humble starts with custom followers and pre-existing sponsors', () => {
    const snap = makeSuperstarSnapshot();
    const state = { careerId: '99-star', profile: { followers: 4200 }, mail: [] };

    const bundleHub = calibrateLifeHub(state, snap, {
      startMode: 'bundle',
      cash: 6000000,
      applyFollowers: true,
      followers: 3200000,
      existingSponsors: [
        { brand: 'Custom Sportswear', category: 'apparel', fee: 450000, bonus: 5000, until: '2030-06-30' },
        { brand: 'Custom Watch', category: 'lifestyle', fee: 300000, bonus: 3000, until: '2030-06-30' },
      ],
    }, () => 'id1');

    assert.equal(bundleHub.calibrated, true);
    assert.equal(bundleHub.cash, 6000000);
    assert.equal(state.profile.followers, 3200000);
    assert.ok(bundleHub.assets.some((a) => a.catalogId === 'luxury_villa'));
    assert.equal(bundleHub.sponsors.length, 2);
    assert.equal(bundleHub.obligations.length, 1);

    const cashOnlyState = { careerId: '99-star-2', profile: { followers: 2000000 }, mail: [] };
    const cashOnlyHub = calibrateLifeHub(cashOnlyState, snap, { startMode: 'cash_only' });
    assert.equal(cashOnlyHub.assets.length, 0);
    assert.equal(cashOnlyHub.cash, estimateStartProfile(snap).cashOnly);

    const humbleState = { careerId: '99-star-3', profile: { followers: 2000000 }, mail: [] };
    const humbleHub = calibrateLifeHub(humbleState, snap, { startMode: 'humble' });
    assert.equal(humbleHub.cash, 15000);
    assert.equal(humbleHub.assets.length, 1);
    assert.equal(humbleHub.assets[0].catalogId, 'rented_studio');
  });

  it('manages multi-slot editable sponsors, syncs boot deal renames, negotiates offers, and resolves obligations', () => {
    const snap = makeSuperstarSnapshot();
    const state = {
      careerId: '99-sp',
      profile: { followers: 2500000 },
      snapshot: snap,
      sponsor: { deal: { id: 'b1', brand: 'Nike', fee: 200000, bonus: 3000, since: '2028-08-01', until: '2030-06-30' } },
      mail: [],
    };
    calibrateLifeHub(state, snap, { startMode: 'cash_only', cash: 1000000 });
    const hub = state.lifeHub;
    // Linked boot deal synced into slot #1
    assert.equal(hub.sponsors.length, 1);
    assert.equal(hub.sponsors[0].linkedBootDeal, true);

    // Rename synced boot sponsor in My Life & add multiple/custom categories -> propagates!
    updateSponsor(state, { id: hub.sponsors[0].id, brand: 'Nike Custom Gold', categories: ['boots', 'apparel', 'Signature Pack'], fee: 250000, notes: 'Gold signature pack' });
    assert.equal(state.sponsor.deal.brand, 'Nike Custom Gold');
    assert.equal(hub.renamedBootBrand, true);
    assert.deepEqual(hub.sponsors[0].categories, ['boots', 'apparel', 'Signature Pack']);

    // Same brand on a NEW category succeeds, while duplicate covered category throws
    addSponsor(state, { brand: 'Nike Custom Gold', categories: ['automotive'], fee: 120000 }, snap.gameDate, () => 'sp_auto');
    assert.throws(() => addSponsor(state, { brand: 'Nike Custom Gold', categories: ['boots'], fee: 90000 }, snap.gameDate), /Ce sponsor existe déjà/);

    // Superstar has unlimited sponsor slots (can sign 7+ deals without error)
    for (let i = 1; i <= 6; i++) {
      addSponsor(state, { brand: `Brand ${i}`, categories: ['beverage', 'lifestyle'], fee: 100000 }, snap.gameDate, () => `sp_${i}`);
    }
    assert.equal(hub.sponsors.length, 8);

    // Lower career stage still enforces slotCap
    const rookieSnap = makeRookieSnapshot();
    const rookieState = { careerId: '1-cap', profile: { followers: 5000 }, snapshot: rookieSnap, mail: [] };
    calibrateLifeHub(rookieState, rookieSnap, { startMode: 'cash_only', cash: 30000 });
    addSponsor(rookieState, { brand: 'Local Cafe', categories: ['beverage'], fee: 15000 }, rookieSnap.gameDate, () => 'sp_r1');
    assert.throws(() => addSponsor(rookieState, { brand: 'Brand 2', fee: 15000 }, rookieSnap.gameDate), /Toutes les places/);

    // Inbound offer negotiate (+15%) -> accept
    hub.offers.push({ id: 'off1', category: 'tech', categories: ['tech', 'media'], brand: 'Sony PlayStation', person: 'Elena Duarte', fee: 200000, bonus: 4000, until: '2030-06-30', negotiated: false });
    const neg = answerSponsorOffer(state, 'off1', 'negotiate', snap.gameDate);
    assert.equal(neg.offer.negotiated, true);
    assert.throws(() => answerSponsorOffer(state, 'off1', 'negotiate', snap.gameDate), /déjà négocié/);
    const signed = answerSponsorOffer(state, 'off1', 'accept', snap.gameDate, () => 'sp_off1');
    assert.equal(signed.status, 'signed');
    assert.equal(hub.sponsors.some((s) => s.brand === 'Sony PlayStation'), true);

    // Fulfill pending obligation for cash + meter reward
    const ob = hub.obligations.find((o) => o.status === 'pending');
    assert.ok(ob);
    const cashBefore = hub.cash;
    completeObligation(state, ob.id, { skip: false }, snap.gameDate);
    assert.equal(ob.status, 'done');
    assert.ok(hub.cash > cashBefore);
  });

  it('handles catalog & custom shop purchases, insufficient funds, 75% resale, and sync wages/bonuses', () => {
    const snap = makeRookieSnapshot('2026-08-20');
    const state = { careerId: '1-rookie', profile: { followers: 5000 }, snapshot: snap, mail: [] };
    calibrateLifeHub(state, snap, { startMode: 'cash_only', cash: 300000 });
    const hub = state.lifeHub;

    buyAsset(state, { catalogId: 'city_apartment' }, '2026-08-20');
    assert.equal(hub.cash, 60000);
    buyAsset(state, { custom: true, name: 'Parents House Downpayment', category: 'home', price: 40000, monthlyCost: 200 }, '2026-08-20', () => 'cust1');
    buyAsset(state, { custom: true, name: 'Custom Yacht', category: '__custom__', customCategory: 'Marine', price: 10000, monthlyCost: 100 }, '2026-08-20', () => 'cust2');
    const yacht = hub.assets.find((a) => a.id === 'cust2');
    assert.equal(yacht.category, 'custom');
    assert.equal(yacht.customCategory, 'Marine');
    assert.equal(hub.cash, 10000);
    assert.throws(() => buyAsset(state, { catalogId: 'penthouse' }, '2026-08-20'), /Fonds insuffisants/);

    // Sell city apartment at 75% (240000 * 0.75 = 180000 -> 10000 + 180000 = 190000)
    sellAsset(state, 'city_apartment', '2026-08-21');
    assert.equal(hub.cash, 190000);

    // Advance sync +10 days with a goal+assist match -> adds pro-rated wage + match bonus
    const snapLater = makeRookieSnapshot('2026-08-30');
    state.snapshot = snapLater;
    const cashBeforeTick = hub.cash;
    lifeHubTick(state, snapLater, {
      changes: {
        newResults: [{ id: 'm1', date: '2026-08-28', played: true, home: 'FC Annecy', away: 'Pau', me: { goals: 1, assists: 1, rating: 7.5, starter: true } }],
      },
      newId: () => 'tick_id',
    });
    assert.ok(hub.cash > cashBeforeTick);
    assert.ok(hub.ledger.some((l) => l.kind === 'wage'));
    assert.ok(hub.ledger.some((l) => l.kind === 'bonus'));
  });

  it('spends AP on actions (with Privacy Shield safe masking in FACTS) and resolves dilemmas via world wrappers', async () => {
    const dir = makeTmpDir();
    const store = new Store(dir, { isEncryptionAvailable: () => false });
    const settings = {
      ...store.getSettings(),
      language: 'en',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      fastModel: 'claude-haiku-4-5',
      apiKeys: { anthropic: 'sk-test-key' },
    };
    store.saveSettings(settings);

    const snap = makeSuperstarSnapshot('2028-09-10');
    const state = {
      careerId: '99-rafael',
      profile: { handle: 'rafamendes', displayName: 'Rafael Mendes', followers: 2000000 },
      privacy: { enabled: true, fields: { playerName: 'Rafael Mendes', handle: 'rafamendes' } },
      persona: {
        roots: { hometown: 'Niteroi' },
        circle: { family: [{ role: 'Mother', name: 'Sonia Mendes', protect: true }] },
      },
      feed: [], accounts: {}, editions: [], mail: [], dms: [], promises: [], onRecord: [], transfers: [], seasons: {},
      writers: { national_columnist: 'Alex Scott', national_desk: [] }, huddles: [],
      snapshot: snap,
    };
    ensureLifeHub(state, snap);
    store.saveCareer(state);
    store.setActiveCareer(state.careerId);

    world.calibrateCareerLifeHub({ store, payload: { startMode: 'bundle', cash: 3000000 } });

    // Custom action referencing a protected inner-circle name + town
    world.doLifeAction({ store, payload: { custom: true, title: 'Dinner with Sonia Mendes in Niteroi', focus: 'squad', cost: 1500 } });
    let loaded = store.activeCareer();
    assert.equal(loaded.lifeHub.ap, 1);
    assert.equal(loaded.lifeHub.cash, 2998500);
    assert.ok(loaded.keyMemory.some((m) => m.includes('Sonia Mendes')));

    // Second action depletes AP -> 3rd throws until matchday
    world.doLifeAction({ store, payload: { actionId: 'recovery' } });
    assert.throws(() => world.doLifeAction({ store, payload: { actionId: 'extra_training' } }), /Plus de points d’action/);

    // Trigger & resolve a dilemma
    loaded = store.activeCareer();
    loaded.lifeHub.pendingDilemma = { id: 'dil_1', dilemmaId: 'late_party', createdAt: '2028-09-10' };
    store.saveCareer(loaded);
    world.answerLifeDilemma({ store, dilemmaId: 'dil_1', choiceId: 'c' });
    loaded = store.activeCareer();
    assert.equal(loaded.lifeHub.pendingDilemma, null);
    assert.ok(loaded.lifeHub.cash < 2998500);

    // FACTS.off_pitch_hub masks Sonia Mendes and Niteroi before reaching AI!
    const facts = lifeHubFacts(loaded);
    assert.ok(facts.recent_off_pitch.some((x) => x.includes('Sonia Mendes')));

    const outgoingPrompts = [];
    mockComplete = async (_settings, _key, { system, user }) => {
      outgoingPrompts.push(`${system}\n${user}`);
      return JSON.stringify({ replies: [{ handle: 'kopfan', name: 'Kop Fan', type: 'fan', text: 'Focus on Saturday!' }] });
    };

    await world.post({ store, settings, text: 'Great night out!' });
    assert.equal(outgoingPrompts.length, 1);
    assert.ok(outgoingPrompts[0].includes('"off_pitch_hub"'));
    for (const secret of ['Sonia', 'Mendes', 'Niteroi', '2996000']) {
      assert.equal(outgoingPrompts[0].includes(secret), false, `Prompt leaked secret "${secret}"`);
    }
  });

  it('syncs My Life boots sponsors into state.sponsor.deal, blocks competing offers, and propagates FACTS', () => {
    const snap = makeSuperstarSnapshot('2028-10-15');
    snap.fixtures = [{ id: 'f1', played: true, date: '2028-10-14', me: { goals: 1, assists: 1, rating: 7.5, starter: true } }];
    const catalog = [
      ...Array.from({ length: 20 }, (_, i) => ({ id: 1000 + i, brand: 'Nike' })),
      ...Array.from({ length: 20 }, (_, i) => ({ id: 2000 + i, brand: 'PUMA' })),
      ...Array.from({ length: 20 }, (_, i) => ({ id: 3000 + i, brand: 'adidas' })),
    ];
    const state = {
      careerId: '99-boots-sync',
      profile: { followers: 2500000 },
      snapshot: snap,
      agent: { name: 'Lucas Vermeulen' },
      sponsor: { offer: { id: 'old_puma', brand: 'PUMA', status: 'open' }, deal: null, history: [], news: null, closedOn: null },
      mail: [],
    };

    calibrateLifeHub(state, snap, {
      startMode: 'cash_only',
      cash: 500000,
      existingSponsors: [
        { brand: 'adidas', categories: ['boots', 'apparel'], fee: 3000000, bonus: 1500, until: '2035-12-31' },
      ],
    }, () => 'sp_adidas');

    assert.ok(state.sponsor.deal, 'calibrating a boots sponsor populates state.sponsor.deal');
    assert.equal(state.sponsor.deal.brand, 'adidas');
    assert.equal(state.sponsor.offer, null, 'open competing boot offer is cleared');
    assert.equal(sponsorFacts(state).brand, 'adidas');

    const tickOut = sponsorTick(state, snap, { language: 'en', newId: () => 'm_id', catalog });
    assert.equal(tickOut.mail, null);
    assert.equal(tickOut.offer, null);

    // Next matchday tick in lifeHub should not offer competing 'boots' or 'apparel' presets
    const laterSnap = makeSuperstarSnapshot('2028-10-20');
    state.snapshot = laterSnap;
    lifeHubTick(state, laterSnap, {
      changes: { newResults: [{ id: 'f2', played: true, date: '2028-10-19', me: { goals: 1, assists: 0, rating: 7.4, starter: true } }] },
      newId: () => 'off_next',
    });
    for (const off of state.lifeHub.offers) {
      assert.ok(!['boots', 'apparel'].includes(String(off.category).toLowerCase()), `Unexpected competing offer category: ${off.category}`);
    }

    // Removing the boots sponsor clears state.sponsor.deal, and adding another boots sponsor re-syncs it
    removeSponsor(state, state.lifeHub.sponsors[0].id, laterSnap.gameDate);
    assert.equal(state.sponsor.deal, null);

    addSponsor(state, { brand: 'Mizuno Pro', category: 'boots', fee: 450000, bonus: 2000, until: '2032-06-30' }, laterSnap.gameDate, () => 'sp_miz');
    assert.equal(state.sponsor.deal?.brand, 'Mizuno Pro');
  });
});
