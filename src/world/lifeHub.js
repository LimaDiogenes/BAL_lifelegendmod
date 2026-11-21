'use strict';
// Phase C : Hub "Ma vie" — calibration de carrière (début ou mi-carrière), finances & patrimoine,
// jauges relationnelles, sponsors multi-slots éditables, activités hors terrain et dilemmes déterministes.
// Aucune requête d'IA supplémentaire : tout tourne localement à partir de la sauvegarde.

const { PERSONA_PRESETS } = require('./persona');
const { CATALOG_ENGLISH_NAMES } = require('./lifeScenes');
const {
  EXCLUSIVE_CATEGORIES,
  MULTI_BRAND_CATEGORIES,
  SPONSOR_CATEGORIES,
  BRAND_CATALOG,
  ONE_TIME_DEALS,
  canonicalCategory,
  isBettingAllowed,
  generateLocalSponsors,
  findCatalogBrand,
  brandsForCategory,
  findSponsorConflicts,
  catalogForUi,
} = require('./sponsorCatalog');

const SPONSOR_PRESETS = [
  { id: 'boots_pro', category: 'boots', categories: ['boots', 'apparel'], brand: 'Nike', baseFee: 240000, bonus: 4000, globalEligible: true },
  { id: 'apparel_ath', category: 'boots', categories: ['boots', 'apparel', 'grooming'], brand: 'Adidas', baseFee: 250000, bonus: 4200, globalEligible: true },
  { id: 'puma_pack', category: 'boots', categories: ['boots', 'apparel'], brand: 'Puma', baseFee: 175000, bonus: 3200, globalEligible: true },
  { id: 'fashion_lv', category: 'fashion', categories: ['fashion'], brand: 'Louis Vuitton', baseFee: 580000, bonus: 7500, globalEligible: true },
  { id: 'beverage_fuel', category: 'beverage', categories: ['beverage'], brand: 'Gatorade', baseFee: 145000, bonus: 2500, globalEligible: true },
  { id: 'healthy_green', category: 'healthy_beverage', categories: ['healthy_beverage'], brand: 'Oi Ocha (Ito En)', baseFee: 180000, bonus: 3000, globalEligible: true },
  { id: 'auto_drive', category: 'automotive', categories: ['automotive'], brand: 'Porsche', baseFee: 420000, bonus: 5800, globalEligible: true },
  { id: 'watch_lux', category: 'watches', categories: ['watches'], brand: 'TAG Heuer', baseFee: 420000, bonus: 6000, globalEligible: true },
  { id: 'tech_game', category: 'gaming', categories: ['gaming'], brand: 'EA Sports', baseFee: 260000, bonus: 4000, globalEligible: true },
  { id: 'global_air', category: 'airlines', categories: ['airlines'], brand: 'Emirates', baseFee: 650000, bonus: 8500, globalEligible: true },
  { id: 'eyewear_oak', category: 'eyewear', categories: ['eyewear'], brand: 'Oakley', baseFee: 130000, bonus: 2200, globalEligible: true },
  { id: 'phones_app', category: 'phones', categories: ['phones'], brand: 'Apple iPhone', baseFee: 560000, bonus: 7200, globalEligible: true },
  { id: 'telecom_star', category: 'telecom', categories: ['telecom'], brand: 'Starlink', baseFee: 460000, bonus: 6000, globalEligible: true },
];

const OFFER_PERSON_NAMES = [
  'Clara Weiss', 'Marco Ferri', 'Elena Duarte', 'Tom Hartley',
  'Inès Moreau', 'Jonas Keller', 'Sofia Marin', 'Daniel Reyes',
  'Lucas Nogueira', 'Hannah Sterling',
];

const ASSET_CATEGORIES = ['home', 'car', 'staff', 'investment', 'charity'];

const ASSET_CATALOG = [
  { id: 'rented_studio', category: 'home', minStage: 'rookie', price: 0, monthlyCost: 1800, passiveReturn: 0, perks: {} },
  { id: 'city_apartment', category: 'home', minStage: 'rookie', price: 240000, monthlyCost: 1400, passiveReturn: 0, perks: { fans: 1 } },
  { id: 'penthouse', category: 'home', minStage: 'rising', price: 950000, monthlyCost: 3500, passiveReturn: 0, perks: { sponsors: 2, media: 2 } },
  { id: 'luxury_villa', category: 'home', minStage: 'established', price: 2800000, monthlyCost: 8500, passiveReturn: 0, perks: { sponsors: 4, fans: 2 } },
  { id: 'sport_coupe', category: 'car', minStage: 'rookie', price: 65000, monthlyCost: 650, passiveReturn: 0, perks: { media: 1 } },
  { id: 'luxury_gt', category: 'car', minStage: 'rising', price: 185000, monthlyCost: 1500, passiveReturn: 0, perks: { sponsors: 2, media: 2 } },
  { id: 'exotic_supercar', category: 'car', minStage: 'established', price: 460000, monthlyCost: 3200, passiveReturn: 0, perks: { sponsors: 3, fans: 2 } },
  { id: 'personal_chef', category: 'staff', minStage: 'rookie', price: 12000, monthlyCost: 4200, passiveReturn: 0, perks: { manager: 2, squad: 1 } },
  { id: 'personal_physio', category: 'staff', minStage: 'rising', price: 18000, monthlyCost: 5800, passiveReturn: 0, perks: { manager: 3 } },
  { id: 'pr_manager', category: 'staff', minStage: 'rising', price: 25000, monthlyCost: 7500, passiveReturn: 0, perks: { media: 3, sponsors: 3 } },
  { id: 'social_team', category: 'staff', minStage: 'established', price: 32000, monthlyCost: 8500, passiveReturn: 0, perks: { fans: 3, followerBoost: 0.01 } },
  { id: 'youth_academy_fund', category: 'investment', minStage: 'rising', price: 180000, monthlyCost: 0, passiveReturn: 2400, perks: { fans: 3, manager: 1 } },
  { id: 'brand_portfolio', category: 'investment', minStage: 'established', price: 600000, monthlyCost: 0, passiveReturn: 9500, perks: { sponsors: 3 } },
  { id: 'real_estate_fund', category: 'investment', minStage: 'established', price: 1400000, monthlyCost: 0, passiveReturn: 21000, perks: {} },
  { id: 'local_clinic_gift', category: 'charity', minStage: 'rookie', price: 35000, monthlyCost: 0, passiveReturn: 0, perks: { fans: 5, media: 4 } },
  { id: 'foundation_launch', category: 'charity', minStage: 'established', price: 220000, monthlyCost: 2000, passiveReturn: 0, perks: { fans: 8, sponsors: 5, media: 6 } },
];

const OFF_PITCH_ACTIONS = [
  { id: 'recovery', ap: 1, cost: 0, effects: { manager: 4, squad: 1 }, saveEffects: { formArrowDelta: 1 }, memory: 'extra recovery & sleep discipline' },
  { id: 'extra_training', ap: 1, cost: 0, effects: { manager: 6, squad: 2 }, saveEffects: { affectionDelta: 2 }, memory: 'extra hours after training' },
  { id: 'team_dinner', ap: 1, cost: 2500, effects: { squad: 6, fans: 1 }, memory: 'hosted a squad dinner' },
  { id: 'inner_circle', ap: 1, cost: 0, effects: { manager: 2, squad: 3, media: 1 }, memory: 'quiet family & inner-circle time' },
  { id: 'sponsor_shoot', ap: 1, cost: 0, effects: { sponsors: 6, media: 3 }, bonusCash: 6000, memory: 'filmed a commercial campaign' },
  { id: 'charity_visit', ap: 1, cost: 5000, effects: { fans: 6, media: 5, sponsors: 2 }, memory: 'visited young patients & local kids' },
  { id: 'media_feature', ap: 1, cost: 0, effects: { media: 6, fans: 4, manager: -1 }, followerDelta: 0.015, memory: 'gave a long-form lifestyle feature' },
  { id: 'vip_night', ap: 1, cost: 8000, effects: { media: 4, fans: 2, manager: -3 }, saveEffects: { affectionDelta: -2, formArrowDelta: -1 }, memory: 'spotted at an exclusive VIP gala' },
];

const DILEMMA_POOL = [
  {
    id: 'late_party',
    choices: [
      { id: 'a', effects: { manager: 5, fans: 1, media: -2 }, saveEffects: { affectionDelta: 2 }, memory: 'left the afterparty early before curfew' },
      { id: 'b', effects: { squad: 5, media: 4, manager: -6 }, saveEffects: { affectionDelta: -3, formArrowDelta: -1 }, followerDelta: 0.015, memory: 'celebrated late with teammates after hours' },
      { id: 'c', effects: { squad: 3, fans: 2, manager: 1 }, cost: 2500, memory: 'moved the celebration to a quiet private dinner' },
    ],
  },
  {
    id: 'tabloid_deal',
    choices: [
      { id: 'a', effects: { media: 7, fans: 4, manager: -3 }, bonusCash: 35000, followerDelta: 0.02, memory: 'posed for a glossy celebrity magazine' },
      { id: 'b', effects: { manager: 4, squad: 2, sponsors: -2 }, memory: 'turned down a paid tabloid feature to focus on pitch' },
      { id: 'c', effects: { media: 3, sponsors: 4, fans: 3 }, memory: 'redirected media interest to his football craft' },
    ],
  },
  {
    id: 'youth_club_plea',
    choices: [
      { id: 'a', effects: { fans: 8, media: 5, sponsors: 3 }, cost: 40000, memory: 'funded new pitches for his childhood club' },
      { id: 'b', effects: { fans: 4, sponsors: 2 }, memory: 'donated signed shirts for the youth club raffle' },
      { id: 'c', effects: { manager: 2, fans: -3 }, memory: 'politely declined the youth club funding request' },
    ],
  },
  {
    id: 'teammate_vent',
    choices: [
      { id: 'a', effects: { squad: 7, manager: -2 }, memory: 'backed an unhappy teammate privately in the dressing room' },
      { id: 'b', effects: { manager: 5, squad: -3 }, memory: 'reminded a restless teammate of squad standards' },
      { id: 'c', effects: { squad: 3, manager: 3 }, memory: 'mediated a calm truce inside the dressing room' },
    ],
  },
  {
    id: 'edgy_campaign',
    choices: [
      { id: 'a', effects: { sponsors: 8, media: 6, manager: -4 }, bonusCash: 65000, followerDelta: 0.025, memory: 'starred in a provocative global ad campaign' },
      { id: 'b', effects: { sponsors: 3, media: 2, manager: 2 }, bonusCash: 25000, memory: 'negotiated a softer tone on a commercial shoot' },
      { id: 'c', effects: { manager: 4, sponsors: -5, fans: 2 }, memory: 'walked away from a flashy campaign over creative control' },
    ],
  },
  {
    id: 'training_gate',
    choices: [
      { id: 'a', effects: { manager: 7, fans: 4 }, saveEffects: { affectionDelta: 3 }, memory: 'stayed an extra hour signing autographs in the rain' },
      { id: 'b', effects: { manager: 4, squad: 2, fans: -2 }, saveEffects: { formArrowDelta: 1 }, memory: 'went straight to ice bath recovery after training' },
      { id: 'c', effects: { fans: 6, media: 4, sponsors: 3 }, cost: 3000, memory: 'invited academy kids onto the grass after session' },
    ],
  },
  {
    id: 'agent_leak',
    choices: [
      { id: 'a', effects: { manager: -5, media: 5, sponsors: 2 }, saveEffects: { affectionDelta: -2 }, memory: 'let transfer gossip swirl without comment' },
      { id: 'b', effects: { manager: 6, fans: 5, squad: 3 }, saveEffects: { affectionDelta: 3 }, memory: 'shut down transfer whispers publicly to steady the dressing room' },
      { id: 'c', effects: { manager: 2, media: 3 }, memory: 'told his agent to keep negotiations strictly behind closed doors' },
    ],
  },
  {
    id: 'docu_crew',
    choices: [
      { id: 'a', effects: { media: 8, fans: 5, sponsors: 5, manager: -4 }, bonusCash: 55000, followerDelta: 0.025, memory: 'allowed a documentary camera crew inside his daily week' },
      { id: 'b', effects: { media: 4, fans: 3, manager: 1 }, bonusCash: 20000, memory: 'filmed a short off-day feature away from training ground' },
      { id: 'c', effects: { manager: 5, squad: 3, media: -3 }, memory: 'refused documentary cameras to protect dressing-room privacy' },
    ],
  },
];

const METER_KEYS = ['manager', 'squad', 'fans', 'sponsors', 'media'];
const MAX_LEDGER = 120;
const MAX_RECENT_EVENTS = 25;
const MAX_CUSTOM_SPONSORS = 5;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
const cleanText = (s, max = 120) => String(s || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function hashStr(str) {
  let h = 2166136261;
  for (const c of String(str || '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function daysBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return 0;
  const a = Date.parse(`${fromIso}T12:00:00Z`);
  const b = Date.parse(`${toIso}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 864e5));
}

function addDaysIso(iso, n) {
  const base = iso || '2026-08-01';
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function roundStep(val, step = 500) {
  const n = Math.max(0, Number(val) || 0);
  return Math.round(n / step) * step;
}

function detectCareerStage(snapshot, state = null) {
  const p = snapshot?.player || {};
  const prof = p.profile || {};
  const rec = p.careerRecords || {};
  const combined = rec.combinedTotals;
  const clubTotals = rec.clubTotals;
  const seasonStats = snapshot?.stats?.total || {};
  const archivedApps = Object.values(state?.seasons || {}).reduce((acc, s) => acc + (s?.stats?.apps || 0), 0);

  const apps = combined?.apps ?? Math.max(clubTotals?.apps || 0, archivedApps, seasonStats.apps || 0);
  const goals = combined?.goals ?? Math.max(clubTotals?.goals || 0, seasonStats.goals || 0);
  const ntApps = rec.international?.apps || 0;
  const salary = Number(p.salary) || 0;
  const marketValue = Number(prof.marketValue) || 0;
  const age = prof.age || null;
  const teamRole = prof.teamRole || '';
  const starRole = /star|superstar|l[eé]gende|legend|ic[oô]ne|bandiera|leader|capitaine|key player/i.test(teamRole);

  let stage = 'rookie';
  if (apps >= 200 || marketValue >= 45000000 || salary >= 5000000 || (apps >= 120 && (starRole || ntApps >= 25))) {
    stage = 'superstar';
  } else if (apps >= 90 || marketValue >= 12000000 || salary >= 1500000 || ntApps >= 10) {
    stage = 'established';
  } else if (apps >= 25 || marketValue >= 2500000 || salary >= 350000) {
    stage = 'rising';
  }

  return { stage, apps, goals, ntApps, salary, marketValue, age, teamRole };
}

function sponsorSlotCap(followers = 0, stage = 'rookie') {
  if (stage === 'superstar' || followers >= 2000000) return null;
  const stageFloor = { rookie: 1, rising: 2, established: 3 }[stage] || 1;
  let fCap = 1;
  if (followers >= 600000) fCap = 5;
  else if (followers >= 150000) fCap = 3;
  else if (followers >= 25000) fCap = 2;
  return Math.max(stageFloor, fCap);
}

function seedMeters(snapshot, state, info) {
  const prof = snapshot?.player?.profile || {};
  const stats = snapshot?.stats?.total || {};
  const fixtures = (snapshot?.fixtures || []).filter((f) => f.played && f.me);
  const starterRate = fixtures.length ? fixtures.filter((f) => f.me.starter).length / fixtures.length : 0.5;
  const moodLvl = state?.fanMood && (state.fanMood.target === 'player' || state.fanMood.target === 'both') ? (state.fanMood.level || 0) : 0;

  const affection = Number.isFinite(prof.affection) ? clamp(prof.affection, 25, 95) : null;
  const stageBase = { rookie: 46, rising: 56, established: 66, superstar: 75 }[info.stage] || 50;

  let manager = affection !== null ? affection : Math.round(stageBase * 0.65 + starterRate * 25);
  let squad = Math.round(52 + starterRate * 14 + (/leader|captain|capitaine|legend|superstar/i.test(info.teamRole) ? 14 : 0));
  let fans = Math.round(44 + Math.min(34, (stats.goals || 0) * 1.4 + (stats.apps || 0) * 0.4 + info.ntApps * 0.3) - moodLvl * 10);
  let sponsors = Math.round({ rookie: 36, rising: 52, established: 68, superstar: 82 }[info.stage]);
  let media = Math.round(48 + Math.min(20, info.apps * 0.08));

  const preset = PERSONA_PRESETS[state?.persona?.preset]?.id;
  if (preset === 'showman' || preset === 'fan_darling') { media += 10; sponsors += 6; fans += 5; }
  if (preset === 'fiery_leader') { squad += 8; manager += 4; }
  if (preset === 'silent_tactician' || preset === 'humble_grinder') { manager += 6; media -= 6; }
  if (preset === 'maverick') { fans += 4; media += 6; manager -= 5; }
  if (preset === 'mercenary') { sponsors += 5; fans -= 5; }

  return {
    manager: clamp(manager, 10, 100),
    squad: clamp(squad, 10, 100),
    fans: clamp(fans, 10, 100),
    sponsors: clamp(sponsors, 10, 100),
    media: clamp(media, 10, 100),
  };
}

function estimateStartProfile(snapshot, state = null) {
  const info = detectCareerStage(snapshot, state);
  const { stage, apps, goals, ntApps, salary, marketValue } = info;

  let followers = 4200;
  if (stage === 'rookie') {
    followers = roundStep(4200 + apps * 420 + goals * 180 + ntApps * 1200 + Math.round(marketValue / 2500), 100);
    followers = Math.max(4200, Math.min(24000, followers));
  } else if (stage === 'rising') {
    followers = roundStep(28000 + apps * 900 + goals * 650 + ntApps * 5000 + Math.round(marketValue / 1200), 500);
    followers = Math.max(25000, Math.min(220000, followers));
  } else if (stage === 'established') {
    followers = roundStep(160000 + apps * 1800 + goals * 1100 + ntApps * 14000 + Math.round(marketValue / 800), 1000);
    followers = Math.max(150000, Math.min(1200000, followers));
  } else {
    followers = roundStep(1100000 + apps * 3200 + goals * 2400 + ntApps * 32000 + Math.round(marketValue / 40), 5000);
    followers = Math.max(1200000, followers);
  }

  const effectiveWage = salary > 0 ? salary : ({ rookie: 120000, rising: 650000, established: 2800000, superstar: 7500000 }[stage]);
  const bundleMap = {
    rookie: ['rented_studio'],
    rising: ['city_apartment', 'sport_coupe'],
    established: ['penthouse', 'luxury_gt', 'personal_physio'],
    superstar: ['luxury_villa', 'exotic_supercar', 'personal_physio', 'pr_manager', 'brand_portfolio'],
  };
  const bundleAssetIds = bundleMap[stage];
  const cashOnlyRaw = {
    rookie: Math.max(30000, effectiveWage * 0.2),
    rising: Math.max(220000, effectiveWage * 0.45 + apps * 2500),
    established: Math.max(1100000, effectiveWage * 0.75 + apps * 6000),
    superstar: Math.max(4200000, effectiveWage * 1.05 + apps * 12000),
  }[stage];
  const cashOnly = roundStep(cashOnlyRaw, stage === 'rookie' ? 1000 : 5000);
  const cashBundle = roundStep(cashOnly * ({ rookie: 0.9, rising: 0.65, established: 0.55, superstar: 0.45 }[stage]), 1000);
  const cashHumble = 15000;

  return {
    stage,
    apps,
    goals,
    ntApps,
    followers,
    effectiveWage,
    cashBundle,
    cashOnly,
    cashHumble,
    bundleAssetIds,
    slotCap: sponsorSlotCap(state?.profile?.followers ?? followers, stage),
    meters: seedMeters(snapshot, state, info),
  };
}

function stampEstimate(hub, est) {
  hub.estimate = {
    stage: est.stage,
    apps: est.apps || 0,
    goals: est.goals || 0,
    followers: est.followers,
    cashBundle: est.cashBundle,
    cashOnly: est.cashOnly,
    cashHumble: est.cashHumble,
    bundleAssetIds: est.bundleAssetIds || [],
    slotCap: est.slotCap === undefined ? 1 : est.slotCap,
  };
}

function normalizeSponsorCategories(raw) {
  const list = [];
  if (Array.isArray(raw?.categories)) list.push(...raw.categories);
  else if (typeof raw?.categories === 'string') list.push(...raw.categories.split(','));
  if (raw?.category && raw.category !== '__custom__') list.push(raw.category);
  if (Array.isArray(raw?.customCategories)) list.push(...raw.customCategories);
  else if (typeof raw?.customCategories === 'string') list.push(...raw.customCategories.split(','));

  const out = [];
  const seen = new Set();
  for (const item of list) {
    const clean = cleanText(item, 40);
    if (!clean) continue;
    const low = clean.toLowerCase();
    if (low === '__custom__' || low === 'global') continue;
    const canon = canonicalCategory(clean);
    const val = canon || clean;
    if (seen.has(val.toLowerCase())) continue;
    seen.add(val.toLowerCase());
    out.push(val);
    if (out.length >= 8) break;
  }
  return out.length ? out : ['lifestyle'];
}

function isDuplicateSponsor(sponsors, entry) {
  const b = cleanText(entry?.brand, 80).toLowerCase();
  if (!b) return false;
  const incoming = normalizeSponsorCategories(entry).map((c) => c.toLowerCase());
  return (sponsors || []).some((s) => {
    if (cleanText(s.brand, 80).toLowerCase() !== b) return false;
    const existing = new Set(normalizeSponsorCategories(s).map((c) => c.toLowerCase()));
    return incoming.every((c) => existing.has(c));
  });
}

function ensureLifeHub(state, snapshot = state?.snapshot) {
  const est = snapshot ? estimateStartProfile(snapshot, state) : {
    stage: 'rookie', apps: 0, goals: 0, cashHumble: 15000, cashBundle: 30000, cashOnly: 45000, bundleAssetIds: ['rented_studio'], followers: 4200, slotCap: 1,
    meters: { manager: 50, squad: 52, fans: 48, sponsors: 36, media: 48 },
  };
  if (!state.lifeHub || typeof state.lifeHub !== 'object') {
    state.lifeHub = {
      calibrated: false,
      startMode: 'bundle',
      stage: est.stage,
      cash: est.cashHumble,
      ap: 2,
      maxAp: 2,
      meters: { ...est.meters },
      assets: [],
      sponsors: [],
      renamedBootBrand: false,
      offers: [],
      obligations: [],
      ledger: [],
      recentEvents: [],
      scenes: [],
      catalogImages: {},
      heroImage: null,
      pendingDilemma: null,
      dilemmaCooldownUntil: null,
      offerCooldownUntil: null,
      lastTickDate: snapshot?.gameDate || null,
      matchCountedIds: [],
      pendingSaveEffects: { affectionDelta: 0, formArrowDelta: 0, reasons: [] },
      lastSaveEffectApplied: null,
    };
  }
  const hub = state.lifeHub;
  hub.meters ||= { manager: 50, squad: 52, fans: 48, sponsors: 40, media: 48 };
  hub.assets ||= [];
  hub.sponsors ||= [];
  for (const sp of hub.sponsors) {
    const hadGlobal = String(sp.category || '').toLowerCase() === 'global'
      || (Array.isArray(sp.categories) && sp.categories.some((c) => String(c || '').toLowerCase() === 'global'));
    if (hadGlobal && sp.isGlobalPartner === undefined) sp.isGlobalPartner = true;
    sp.categories = normalizeSponsorCategories(sp);
    sp.category = sp.categories[0];
  }
  hub.offers ||= [];
  hub.biddingWars ||= [];
  hub.oneTimeOffers ||= [];
  hub.completedOneTime ||= [];
  hub.obligations ||= [];
  hub.ledger ||= [];
  hub.recentEvents ||= [];
  hub.scenes ||= [];
  hub.catalogImages ||= {};
  if (hub.heroImage === undefined) hub.heroImage = null;
  hub.matchCountedIds ||= [];
  hub.pendingSaveEffects ||= { affectionDelta: 0, formArrowDelta: 0, reasons: [] };
  hub.pendingSaveEffects.reasons ||= [];
  hub.maxAp = 2;
  if (!Number.isFinite(hub.ap)) hub.ap = 2;
  if (snapshot) {
    hub.stage = est.stage;
    stampEstimate(hub, est);
  }
  syncBootSponsor(state, hub);
  return hub;
}

function addLedger(hub, { date, amount, kind, label }) {
  const n = Math.round(Number(amount) || 0);
  if (!n && kind !== 'opening') return;
  hub.ledger.unshift({ date: date || '', amount: n, kind: kind || 'misc', label: cleanText(label, 120) });
  if (hub.ledger.length > MAX_LEDGER) hub.ledger.length = MAX_LEDGER;
}

function pushRecent(hub, { date, kind, text }) {
  const line = cleanText(text, 140);
  if (!line) return;
  hub.recentEvents.unshift({ date: date || '', kind: kind || 'life', text: line });
  if (hub.recentEvents.length > MAX_RECENT_EVENTS) hub.recentEvents.length = MAX_RECENT_EVENTS;
}

function applyEffects(state, hub, effects = {}, { cost = 0, bonusCash = 0, followerDelta = 0 } = {}, date = '', label = '') {
  for (const k of METER_KEYS) {
    if (effects[k]) hub.meters[k] = clamp((hub.meters[k] ?? 50) + effects[k], 0, 100);
  }
  if (cost > 0) {
    hub.cash = Math.max(0, Math.round(hub.cash - cost));
    addLedger(hub, { date, amount: -cost, kind: 'expense', label });
  }
  if (bonusCash > 0) {
    hub.cash = Math.round(hub.cash + bonusCash);
    addLedger(hub, { date, amount: bonusCash, kind: 'income', label });
  }
  if (followerDelta && state?.profile) {
    const cur = state.profile.followers || 4200;
    state.profile.followers = Math.max(100, Math.round(cur * (1 + followerDelta)));
  }
}

function ownedMonthlyCost(hub) {
  return (hub.assets || []).reduce((s, a) => s + (Number(a.monthlyCost) || 0), 0);
}

function assetNetWorth(hub) {
  const assetsVal = (hub.assets || []).reduce((s, a) => {
    if (a.category === 'staff' || a.category === 'charity') return s;
    const base = Number(a.resaleValue ?? a.price ?? 0);
    return s + Math.round(base * (a.category === 'investment' ? 1 : 0.75));
  }, 0);
  return Math.round((hub.cash || 0) + assetsVal);
}

function normalizeSponsorEntry(raw, fallbackId, today) {
  const brand = cleanText(raw?.brand, 80);
  if (!brand) return null;
  let categories = normalizeSponsorCategories(raw);
  const catalogMatch = findCatalogBrand(brand);
  if (raw?.applyUmbrella && catalogMatch && Array.isArray(catalogMatch.categories)) {
    const seen = new Set(categories.map((c) => c.toLowerCase()));
    for (const c of catalogMatch.categories) {
      if (!seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase());
        categories.push(c);
      }
    }
  }
  const hadGlobalTag = String(raw?.category || '').toLowerCase() === 'global'
    || (Array.isArray(raw?.categories) && raw.categories.some((c) => String(c || '').toLowerCase() === 'global'));
  const isGlobalPartner = Boolean(raw?.isGlobalPartner || hadGlobalTag);
  const fee = Math.max(0, Math.round(Number(raw?.fee) || 0));
  const bonus = Math.max(0, Math.round(Number(raw?.bonus) || 0));
  const since = cleanText(raw?.since, 10) || today || '';
  const until = cleanText(raw?.until, 10) || addDaysIso(today, 365);
  return {
    id: cleanText(raw?.id, 40) || fallbackId,
    linkedBootDeal: Boolean(raw?.linkedBootDeal),
    isGlobalPartner,
    category: categories[0],
    categories,
    brand,
    fee,
    bonus,
    since,
    until,
    notes: cleanText(raw?.notes, 140),
  };
}

function isBootCategorySponsor(s) {
  if (!s) return false;
  if (s.linkedBootDeal || String(s.category || '').toLowerCase() === 'boots') return true;
  return Array.isArray(s.categories) && s.categories.some((c) => String(c || '').toLowerCase() === 'boots');
}

function closeOpenBootMailThreads(state) {
  if (!Array.isArray(state?.mail)) return;
  for (const m of state.mail) {
    if (m && m.sponsorOffer && !m.closed) {
      m.closed = true;
    }
  }
}

function syncBootSponsor(state, hub) {
  if (!hub) return;
  const deal = state?.sponsor?.deal;
  const bootSp = (hub.sponsors || []).find(isBootCategorySponsor);

  // Cas 1 : Un sponsor 'boots' existe dans Ma vie -> toujours reflété comme sponsor crampons officiel dans state.sponsor.deal.
  if (bootSp) {
    for (const s of hub.sponsors) s.linkedBootDeal = (s === bootSp);
    if (state) {
      if (!state.sponsor) state.sponsor = { offer: null, deal: null, history: [], news: null, closedOn: null };
      const prevBrand = state.sponsor.deal?.brand;
      const shouldCopyIntoDeal = !deal
        || bootSp.id !== 'boot_deal'
        || hub.renamedBootBrand
        || String(deal.brand || '').toLowerCase() !== String(bootSp.brand || '').toLowerCase();
      if (shouldCopyIntoDeal) {
        state.sponsor.deal = {
          ...(state.sponsor.deal || {}),
          id: state.sponsor.deal?.id || bootSp.id,
          brand: bootSp.brand,
          fee: bootSp.fee || 0,
          bonus: bootSp.bonus || 0,
          since: bootSp.since || state.sponsor.deal?.since || state?.snapshot?.gameDate || '',
          until: bootSp.until || state.sponsor.deal?.until || '',
          status: 'signed',
          isGlobalPartner: Boolean(bootSp.isGlobalPartner),
          person: state.sponsor.deal?.person || 'Marco Ferri',
          via: state.sponsor.deal?.via || (state?.agent?.name ? 'agent' : 'direct'),
          contributions: state.sponsor.deal?.contributions || 0,
          counted: Array.isArray(state.sponsor.deal?.counted) ? state.sponsor.deal.counted : [],
        };
        if (prevBrand && prevBrand.toLowerCase() !== bootSp.brand.toLowerCase()) {
          state.sponsor.deal.bootId = null;
          state.sponsor.deal.photo = null;
          state.sponsor.deal.logo = null;
        }
      }
      if (state.sponsor.offer) {
        state.sponsor.offer = null;
        closeOpenBootMailThreads(state);
      }
    }
    if (Array.isArray(hub.offers)) {
      hub.offers = hub.offers.filter((o) => !isBootCategorySponsor(o));
    }
    return;
  }

  const existingIdx = hub.sponsors.findIndex((s) => s.linkedBootDeal);
  if (!deal) {
    if (existingIdx >= 0 && hub.sponsors[existingIdx].id === 'boot_deal') {
      hub.sponsors.splice(existingIdx, 1);
    }
    hub.renamedBootBrand = false;
    return;
  }
  if (existingIdx >= 0) {
    const cur = hub.sponsors[existingIdx];
    if (!hub.renamedBootBrand) cur.brand = deal.brand;
    cur.fee = deal.fee;
    cur.bonus = deal.bonus;
    cur.until = deal.until;
    cur.isGlobalPartner = Boolean(deal.isGlobalPartner || cur.isGlobalPartner);
    cur.categories = normalizeSponsorCategories(cur.categories?.length ? cur : { category: 'boots' });
    cur.category = cur.categories[0];
    return;
  }
  const entry = {
    id: 'boot_deal',
    linkedBootDeal: true,
    isGlobalPartner: Boolean(deal.isGlobalPartner),
    category: 'boots',
    categories: ['boots', 'apparel'],
    brand: deal.brand,
    fee: deal.fee || 0,
    bonus: deal.bonus || 0,
    since: deal.since || state?.snapshot?.gameDate || '',
    until: deal.until || '',
    notes: '',
  };
  hub.sponsors.unshift(entry);
}

function scheduleNextObligation(hub, today, newId) {
  if (!hub.sponsors.length || hub.obligations.filter((o) => o.status === 'pending').length >= 2) return;
  const active = hub.sponsors.filter((s) => !s.until || s.until > today);
  if (!active.length) return;
  const pick = active[hashStr(`${today}|ob|${hub.obligations.length}`) % active.length];
  const alreadyForBrand = hub.obligations.some((o) => o.status === 'pending' && o.sponsorId === pick.id);
  if (alreadyForBrand) return;
  const kinds = {
    boots: 'boot_launch',
    apparel: 'kit_shoot',
    fashion: 'vip_event',
    eyewear: 'kit_shoot',
    watches: 'vip_event',
    automotive: 'vip_event',
    beverage: 'kit_shoot',
    healthy_beverage: 'kit_shoot',
    health: 'kit_shoot',
    phones: 'stream_promo',
    telecom: 'brand_appearance',
    airlines: 'brand_gala',
    hospitality: 'brand_gala',
    appliances: 'brand_appearance',
    grooming: 'kit_shoot',
    finance: 'brand_gala',
    betting: 'stream_promo',
    gaming: 'stream_promo',
    media: 'stream_promo',
    lifestyle: 'vip_event',
    local: 'brand_appearance',
  };
  const primaryCat = pick.categories?.[0] || pick.category;
  hub.obligations.push({
    id: newId(),
    sponsorId: pick.id,
    brand: pick.brand,
    kind: kinds[primaryCat] || 'brand_appearance',
    dueDate: addDaysIso(today, 21),
    rewardCash: roundStep(Math.max(2500, (pick.fee || 40000) * 0.04), 500),
    status: 'pending',
  });
}

function calibrateLifeHub(state, snapshot, payload = {}, newId = () => `id_${Date.now()}`) {
  const hub = ensureLifeHub(state, snapshot);
  const est = estimateStartProfile(snapshot, state);
  const today = snapshot?.gameDate || hub.lastTickDate || '';
  const startMode = ['bundle', 'cash_only', 'humble'].includes(payload.startMode) ? payload.startMode : 'bundle';

  if (payload.applyFollowers && Number.isFinite(Number(payload.followers)) && Number(payload.followers) >= 100) {
    state.profile ||= { followers: est.followers };
    state.profile.followers = Math.round(Number(payload.followers));
  }

  const defaultCash = startMode === 'cash_only' ? est.cashOnly : startMode === 'humble' ? est.cashHumble : est.cashBundle;
  const chosenCash = Number.isFinite(Number(payload.cash)) && Number(payload.cash) >= 0 ? Math.round(Number(payload.cash)) : defaultCash;

  const starterAssetIds = startMode === 'bundle' ? est.bundleAssetIds : startMode === 'humble' ? ['rented_studio'] : [];
  hub.assets = starterAssetIds
    .map((id) => ASSET_CATALOG.find((a) => a.id === id))
    .filter(Boolean)
    .map((a) => ({
      id: a.id,
      catalogId: a.id,
      category: a.category,
      name: a.id,
      price: a.price,
      resaleValue: a.price,
      monthlyCost: a.monthlyCost,
      passiveReturn: a.passiveReturn,
      perks: { ...a.perks },
      since: today,
      custom: false,
    }));

  hub.calibrated = true;
  hub.startMode = startMode;
  hub.stage = est.stage;
  hub.cash = chosenCash;
  hub.ap = 2;
  hub.meters = { ...est.meters };
  hub.lastTickDate = today;

  // Préserve le deal équipementier éventuel et ajoute jusqu'au plafond les sponsors existants choisis.
  hub.sponsors = [];
  const cap = sponsorSlotCap(state.profile?.followers || est.followers, est.stage);
  const rawList = Array.isArray(payload.existingSponsors) ? payload.existingSponsors : [];
  const incomingHasBoots = rawList.some(isBootCategorySponsor);
  if (!incomingHasBoots) syncBootSponsor(state, hub);
  for (const item of rawList) {
    if (cap !== null && hub.sponsors.length >= cap) break;
    const norm = normalizeSponsorEntry(item, newId(), today);
    if (!norm) continue;
    if (isDuplicateSponsor(hub.sponsors, norm)) continue;
    hub.sponsors.push(norm);
  }
  syncBootSponsor(state, hub);

  hub.ledger = [];
  addLedger(hub, { date: today, amount: chosenCash, kind: 'opening', label: `calibration:${startMode}` });
  if (hub.sponsors.length) scheduleNextObligation(hub, today, newId);
  return hub;
}

function makeSponsorOffer(state, snapshot, hub, newId) {
  const today = snapshot.gameDate;
  const est = estimateStartProfile(snapshot, state);
  const openKeys = new Set(hub.offers.map((o) => `${o.brand.toLowerCase()}|${normalizeSponsorCategories(o).join(',')}`));
  const bettingOk = isBettingAllowed(snapshot).allowed;
  const stageOrder = { rookie: 0, rising: 1, established: 2, superstar: 3 };
  const sRank = stageOrder[est.stage] ?? 0;

  const localPool = generateLocalSponsors(state, snapshot);
  const catalogPool = [...BRAND_CATALOG, ...localPool].filter((p) => {
    if ((stageOrder[p.minStage] ?? 0) > sRank) return false;
    if (!bettingOk && (p.category === 'betting' || (p.categories || []).includes('betting'))) return false;
    if (isDuplicateSponsor(hub.sponsors, p)) return false;
    if (openKeys.has(`${p.brand.toLowerCase()}|${normalizeSponsorCategories(p).join(',')}`)) return false;
    if (findSponsorConflicts(hub.sponsors, p).length > 0) return false;
    return true;
  });

  // Occasional Global Partner upgrade offer for an existing eligible non-global sponsor at Established/Superstar
  const upgradeTarget = sRank >= 2
    ? (hub.sponsors || []).find((s) => !s.isGlobalPartner && findCatalogBrand(s.brand)?.globalEligible && !hub.offers.some((o) => o.upgradeSponsorId === s.id))
    : null;
  if (upgradeTarget && (!catalogPool.length || hashStr(`${state.careerId}|${today}|gpup`) % 5 === 0)) {
    const newFee = roundStep(Math.max(upgradeTarget.fee * 1.65, 320000), 5000);
    const newBonus = roundStep(Math.max((upgradeTarget.bonus || 2000) * 1.4, 4000), 500);
    return {
      id: newId(),
      upgradeSponsorId: upgradeTarget.id,
      isGlobalPartner: true,
      category: upgradeTarget.category,
      categories: normalizeSponsorCategories(upgradeTarget),
      brand: upgradeTarget.brand,
      person: OFFER_PERSON_NAMES[hashStr(`${today}|${upgradeTarget.brand}|gp`) % OFFER_PERSON_NAMES.length],
      fee: newFee,
      bonus: newBonus,
      until: addDaysIso(today, 730),
      expires: addDaysIso(today, 30),
      on: today,
      negotiated: false,
    };
  }

  if (!catalogPool.length) return null;
  const idx = hashStr(`${state.careerId}|${today}|mloff`) % catalogPool.length;
  const base = catalogPool[idx];
  const categories = normalizeSponsorCategories(base);
  const scale = { rookie: 0.45, rising: 1.0, established: 1.9, superstar: 3.3 }[est.stage] || 1;
  const wageBoost = Math.max(0, (snapshot?.player?.salary || 0) * 0.06);
  const meterScale = 0.85 + (hub.meters.sponsors / 100) * 0.35;
  const globalRoll = sRank >= 2 && base.globalEligible && (hashStr(`${today}|${base.brand}|isgp`) % 4 === 0);
  const feeMult = globalRoll ? 1.55 : 1;
  const fee = roundStep(Math.max(15000, (base.baseFee * scale + wageBoost) * meterScale * feeMult), 5000);
  const bonus = roundStep(Math.max(500, base.bonus * scale * (globalRoll ? 1.3 : 1)), 250);
  const person = OFFER_PERSON_NAMES[hashStr(`${today}|${base.brand}`) % OFFER_PERSON_NAMES.length];
  return {
    id: newId(),
    category: categories[0],
    categories,
    isGlobalPartner: globalRoll,
    brand: base.brand,
    person,
    fee,
    bonus,
    until: addDaysIso(today, 365 * (est.stage === 'rookie' ? 1 : 2)),
    expires: addDaysIso(today, 35),
    on: today,
    negotiated: false,
  };
}

function maybeStartBiddingWar(state, snapshot, hub, today, newId) {
  hub.biddingWars ||= [];
  hub.biddingWars = hub.biddingWars.filter((w) => !w.expires || today < w.expires);
  if (hub.biddingWars.length >= 1) return null;
  if (hub.warCooldownUntil && today < hub.warCooldownUntil) return null;

  const est = estimateStartProfile(snapshot, state);
  const stageOrder = { rookie: 0, rising: 1, established: 2, superstar: 3 };
  const sRank = stageOrder[est.stage] ?? 0;
  const followers = state.profile?.followers || est.followers || 0;
  if (sRank < 2 && !(sRank === 1 && followers >= 120000)) return null;

  const bettingOk = isBettingAllowed(snapshot).allowed;
  const poachCandidates = (hub.sponsors || []).filter((sp) => {
    if (!sp?.brand || !EXCLUSIVE_CATEGORIES.includes(sp.category)) return false;
    if (sp.category === 'betting' && !bettingOk) return false;
    const rivals = brandsForCategory(sp.category, { stage: est.stage })
      .filter((b) => b.brand.toLowerCase() !== sp.brand.toLowerCase());
    return rivals.length >= 2;
  });

  // Prefer poaching an expiring or high-profile deal ~40% of the time at established/superstar, else open exclusive category war
  const openWarCats = EXCLUSIVE_CATEGORIES.filter((cat) => {
    if (cat === 'betting' && !bettingOk) return false;
    if (cat === 'apparel') return false; // handled under boots war
    const pool = brandsForCategory(cat, { stage: est.stage });
    if (pool.length < 2) return false;
    return findSponsorConflicts(hub.sponsors, { brand: '__probe__', categories: [cat] }).length === 0;
  });

  let kind = 'open_war';
  let existing = null;
  let targetCat = null;

  if (poachCandidates.length && (openWarCats.length === 0 || hashStr(`${state.careerId}|${today}|warkind`) % 5 < 2)) {
    kind = 'poach_war';
    existing = poachCandidates[hashStr(`${state.careerId}|${today}|poach`) % poachCandidates.length];
    targetCat = existing.category;
  } else if (openWarCats.length) {
    targetCat = openWarCats[hashStr(`${state.careerId}|${today}|warcat`) % openWarCats.length];
  } else {
    return null;
  }

  const rivals = brandsForCategory(targetCat, { stage: est.stage })
    .filter((b) => !existing || b.brand.toLowerCase() !== existing.brand.toLowerCase());
  if (rivals.length < 2) return null;

  const picked = [];
  const startIdx = hashStr(`${today}|${targetCat}|wpick`) % rivals.length;
  for (let i = 0; i < Math.min(3, rivals.length); i++) {
    picked.push(rivals[(startIdx + i) % rivals.length]);
  }

  const scale = { rookie: 0.6, rising: 1.15, established: 2.1, superstar: 3.6 }[est.stage] || 1.5;
  const buyoutCost = existing ? roundStep(Math.max(40000, (existing.fee || 150000) * 0.28), 5000) : 0;

  const bids = picked.map((b, i) => {
    const eager = i === 0 || (sRank >= 3 && hashStr(`${b.brand}|${today}`) % 2 === 0);
    const isGp = sRank >= 2 && Boolean(b.globalEligible) && (i === 0 || sRank === 3);
    const base = Math.max(b.baseFee * scale, existing ? (existing.fee || b.baseFee) * 1.18 : 0);
    const fee = roundStep(base * (1 + i * 0.06) * (isGp ? 1.45 : 1), 5000);
    const bonus = roundStep(b.bonus * scale * (isGp ? 1.25 : 1), 500);
    const signingBonus = roundStep(fee * (eager ? 0.15 : 0.08), 5000);
    return {
      id: newId(),
      brand: b.brand,
      category: targetCat,
      categories: normalizeSponsorCategories(b),
      person: OFFER_PERSON_NAMES[hashStr(`${today}|war|${b.brand}`) % OFFER_PERSON_NAMES.length],
      fee,
      bonus,
      signingBonus,
      isGlobalPartner: isGp,
      until: addDaysIso(today, 365 * (sRank >= 2 ? 2 : 1)),
      eager,
      buyoutCovered: Boolean(existing && eager),
      walkedAway: false,
    };
  });

  const war = {
    id: newId(),
    kind,
    category: targetCat,
    existingSponsorId: existing?.id || null,
    existingBrand: existing?.brand || null,
    existingFee: existing?.fee || 0,
    buyoutCost,
    incumbentMatch: null,
    round: 0,
    createdOn: today,
    expires: addDaysIso(today, 30),
    bids,
  };
  hub.biddingWars.push(war);
  hub.warCooldownUntil = addDaysIso(today, 40);
  return war;
}

function maybeOfferOneTimeDeal(state, snapshot, hub, today, newId) {
  hub.oneTimeOffers ||= [];
  hub.oneTimeOffers = hub.oneTimeOffers.filter((o) => !o.expires || today < o.expires);
  if (hub.oneTimeOffers.length >= 2) return null;
  if (hub.oneTimeCooldownUntil && today < hub.oneTimeCooldownUntil) return null;

  const est = estimateStartProfile(snapshot, state);
  const stageOrder = { rookie: 0, rising: 1, established: 2, superstar: 3 };
  const sRank = stageOrder[est.stage] ?? 0;
  const openIds = new Set(hub.oneTimeOffers.map((o) => o.dealKey));
  const candidates = ONE_TIME_DEALS.filter((d) => (stageOrder[d.minStage] ?? 0) <= sRank && !openIds.has(d.id));
  if (!candidates.length) return null;

  const pick = candidates[hashStr(`${state.careerId}|${today}|1time`) % candidates.length];
  const scale = { rookie: 0.6, rising: 1.0, established: 1.8, superstar: 3.0 }[est.stage] || 1;
  const matchingActive = (hub.sponsors || []).find((s) => normalizeSponsorCategories(s).includes(pick.category));
  const brand = matchingActive?.brand || pick.defaultBrand;
  const fee = roundStep(pick.fee * scale, 2500);
  const suggestedDate = addDaysIso(today, 6);

  const offer = {
    id: newId(),
    dealKey: pick.id,
    brand,
    category: pick.category,
    fee,
    mediaBoost: pick.mediaBoost,
    fanBoost: pick.fanBoost,
    followerBoost: pick.followerBoost,
    suggestedDate,
    on: today,
    expires: addDaysIso(today, 21),
  };
  hub.oneTimeOffers.push(offer);
  hub.oneTimeCooldownUntil = addDaysIso(today, 24);
  return offer;
}

function lifeHubTick(state, snapshot, { changes = {}, newId = () => `id_${Date.now()}`, sponsorMode = 'realistic' } = {}) {
  const hub = ensureLifeHub(state, snapshot);
  const est = estimateStartProfile(snapshot, state);
  hub.stage = est.stage;
  syncBootSponsor(state, hub);

  if (!hub.calibrated) {
    hub.meters = { ...est.meters };
    hub.cash = est.cashHumble;
    hub.lastTickDate = snapshot.gameDate;
    return hub;
  }

  const today = snapshot.gameDate;
  const prev = hub.lastTickDate || today;
  const days = Math.min(180, daysBetween(prev, today));

  if (days > 0) {
    const netAnnualWage = Math.max(0, (snapshot?.player?.salary || est.effectiveWage) * 0.55);
    const wageEarned = Math.round((netAnnualWage * days) / 365);
    if (wageEarned > 0) {
      hub.cash += wageEarned;
      addLedger(hub, { date: today, amount: wageEarned, kind: 'wage', label: `wage:${days}d` });
    }

    const activeSponsors = hub.sponsors.filter((s) => !s.until || s.until > prev);
    const sponsorRetainer = activeSponsors.reduce((sum, s) => sum + Math.round(((Number(s.fee) || 0) * days) / 365), 0);
    if (sponsorRetainer > 0) {
      hub.cash += sponsorRetainer;
      addLedger(hub, { date: today, amount: sponsorRetainer, kind: 'sponsor', label: `retainers:${activeSponsors.length}` });
    }

    const passive = (hub.assets || []).reduce((sum, a) => sum + Math.round(((Number(a.passiveReturn) || 0) * days) / 30), 0);
    if (passive > 0) {
      hub.cash += passive;
      addLedger(hub, { date: today, amount: passive, kind: 'investment', label: 'passive_yield' });
    }

    const upkeep = Math.round((ownedMonthlyCost(hub) * days) / 30);
    if (upkeep > 0) {
      hub.cash = Math.max(0, hub.cash - upkeep);
      addLedger(hub, { date: today, amount: -upkeep, kind: 'upkeep', label: `upkeep:${days}d` });
    }

    // Staff follower perks
    const followerBoost = (hub.assets || []).reduce((b, a) => b + (a.perks?.followerBoost || 0), 0);
    if (followerBoost > 0 && state.profile && days >= 5) {
      state.profile.followers = Math.round((state.profile.followers || 4200) * (1 + followerBoost * (days / 30)));
    }
  }

  // Conformité paris sportifs : si le joueur signe dans un pays où la loi l'interdit, le contrat tombe automatiquement.
  const bettingPolicy = isBettingAllowed(snapshot);
  if (!bettingPolicy.allowed) {
    const bannedBrands = [];
    hub.sponsors = hub.sponsors.filter((s) => {
      const cats = normalizeSponsorCategories(s).map((c) => c.toLowerCase());
      if (!cats.includes('betting')) return true;
      if (cats.length > 1) {
        s.categories = s.categories.filter((c) => String(c).toLowerCase() !== 'betting');
        s.category = s.categories[0] || 'lifestyle';
        bannedBrands.push(s.brand);
        return true;
      }
      bannedBrands.push(s.brand);
      hub.obligations = hub.obligations.filter((o) => o.sponsorId !== s.id);
      return false;
    });
    hub.offers = hub.offers.filter((o) => !normalizeSponsorCategories(o).map((c) => c.toLowerCase()).includes('betting'));
    hub.biddingWars = (hub.biddingWars || []).filter((w) => w.category !== 'betting');
    if (bannedBrands.length) {
      for (const b of bannedBrands) pushRecent(hub, { date: today, kind: 'sponsor', text: `Betting ban terminated deal: ${b}` });
      hub.regulatoryNews = { kind: 'betting_ban', brands: bannedBrands, country: bettingPolicy.country, on: today };
    }
  }

  // Primes de match et évolution douce des jauges après les matchs récents.
  const results = Array.isArray(changes.newResults) ? changes.newResults : [];
  let contribTotal = 0;
  let avgRatingSum = 0;
  let ratedCount = 0;
  for (const m of results) {
    if (!m?.me) continue;
    const mid = String(m.id || `${m.date}|${m.home}|${m.away}`);
    if (hub.matchCountedIds.includes(mid)) continue;
    hub.matchCountedIds.push(mid);
    if (hub.matchCountedIds.length > 80) hub.matchCountedIds.shift();
    contribTotal += (m.me.goals || 0) + (m.me.assists || 0);
    if (Number.isFinite(m.me.rating)) {
      avgRatingSum += m.me.rating;
      ratedCount++;
    }
  }
  if (contribTotal > 0) {
    const sponsorBonus = hub.sponsors.reduce((sum, s) => sum + (Number(s.bonus) || 0) * contribTotal, 0);
    const clubBonus = contribTotal * 2000;
    const totalBonus = sponsorBonus + clubBonus;
    if (totalBonus > 0) {
      hub.cash += totalBonus;
      addLedger(hub, { date: today, amount: totalBonus, kind: 'bonus', label: `match_bonus:x${contribTotal}` });
    }
  }
  if (ratedCount > 0) {
    const avg = avgRatingSum / ratedCount;
    if (avg >= 7.0) {
      hub.meters.manager = clamp(hub.meters.manager + 2, 0, 100);
      hub.meters.fans = clamp(hub.meters.fans + 3, 0, 100);
      hub.meters.media = clamp(hub.meters.media + 2, 0, 100);
    } else if (avg < 5.6) {
      hub.meters.manager = clamp(hub.meters.manager - 2, 0, 100);
      hub.meters.fans = clamp(hub.meters.fans - 3, 0, 100);
    }
  }

  // Expire les sponsors terminés, les offres périmées et vérifie les échéances en retard.
  const expiredBrands = [];
  hub.sponsors = hub.sponsors.filter((s) => {
    if (!s.linkedBootDeal && s.until && today >= s.until) {
      expiredBrands.push(s.brand);
      return false;
    }
    return true;
  });
  for (const b of expiredBrands) pushRecent(hub, { date: today, kind: 'sponsor', text: `Sponsor contract ended: ${b}` });

  hub.offers = hub.offers.filter((o) => !o.expires || today < o.expires);
  for (const ob of hub.obligations) {
    if (ob.status === 'pending' && ob.dueDate && today > addDaysIso(ob.dueDate, 7)) {
      ob.status = 'missed';
      hub.meters.sponsors = clamp(hub.meters.sponsors - 6, 0, 100);
      pushRecent(hub, { date: today, kind: 'sponsor', text: `Missed sponsor commitment (${ob.brand})` });
    }
  }

  // Recharge les points d'action après un match ou ≥ 4 jours écoulés.
  if (results.length > 0 || changes.matchday || days >= 4) {
    hub.ap = hub.maxAp;
  }

  // Offres, guerres d'enchères & deals ponctuels (actifs surtout en mode réaliste)
  const cap = sponsorSlotCap(state.profile?.followers || 0, hub.stage);
  const cooldownDone = !hub.offerCooldownUntil || today >= hub.offerCooldownUntil;
  if (sponsorMode === 'realistic' && (cap === null || hub.sponsors.length < cap) && hub.offers.length < 2 && cooldownDone && results.length > 0) {
    const offer = makeSponsorOffer(state, snapshot, hub, newId);
    if (offer) {
      hub.offers.push(offer);
      hub.offerCooldownUntil = addDaysIso(today, 14);
    }
  }
  if (sponsorMode === 'realistic' && results.length > 0) {
    maybeStartBiddingWar(state, snapshot, hub, today, newId);
    maybeOfferOneTimeDeal(state, snapshot, hub, today, newId);
  }
  if (hub.sponsors.length > 0 && (results.length > 0 || days >= 10)) {
    scheduleNextObligation(hub, today, newId);
  }

  // Déclenche un dilemme hors-terrain périodique (au plus un en attente).
  const dilReady = !hub.pendingDilemma && (!hub.dilemmaCooldownUntil || today >= hub.dilemmaCooldownUntil);
  if (dilReady && (results.length > 0 || days >= 12)) {
    const pick = DILEMMA_POOL[hashStr(`${state.careerId}|${today}|dil`) % DILEMMA_POOL.length];
    hub.pendingDilemma = { id: newId(), dilemmaId: pick.id, createdAt: today };
    hub.dilemmaCooldownUntil = addDaysIso(today, 18);
  }

  hub.lastTickDate = today;
  return hub;
}

function buyAsset(state, payload = {}, gameDate = '', newId = () => `id_${Date.now()}`) {
  const hub = ensureLifeHub(state, state.snapshot);
  const custom = Boolean(payload.custom);
  let item;
  if (custom) {
    const name = cleanText(payload.name, 80);
    if (!name) throw new Error('Nom de l’élément requis.');
    const rawCat = cleanText(payload.category, 40);
    const customLabel = cleanText(payload.customCategory, 40);
    let category = ASSET_CATEGORIES.includes(rawCat) ? rawCat : 'custom';
    let customCategory = '';
    if (rawCat === '__custom__' || rawCat === 'custom' || customLabel || !ASSET_CATEGORIES.includes(rawCat)) {
      category = 'custom';
      customCategory = customLabel || (rawCat && rawCat !== '__custom__' && rawCat !== 'custom' ? rawCat : '');
    }
    const price = Math.max(0, Math.round(Number(payload.price) || 0));
    const monthlyCost = Math.max(0, Math.round(Number(payload.monthlyCost) || 0));
    const customImage = payload.customImage ? cleanText(payload.customImage, 120) : '';
    item = { id: newId(), catalogId: null, category, ...(customCategory ? { customCategory } : {}), ...(customImage ? { customImage } : {}), name, price, resaleValue: price, monthlyCost, passiveReturn: 0, perks: { fans: category === 'charity' ? 4 : 1, media: 1 }, custom: true };
  } else {
    const cat = ASSET_CATALOG.find((a) => a.id === payload.catalogId);
    if (!cat) throw new Error('Élément introuvable.');
    if (cat.category !== 'charity' && hub.assets.some((a) => a.catalogId === cat.id)) {
      throw new Error('Élément déjà possédé.');
    }
    const savedImg = cleanText(payload.customImage || hub.catalogImages?.[cat.id], 120);
    item = { id: cat.category === 'charity' ? newId() : cat.id, catalogId: cat.id, category: cat.category, name: cat.id, price: cat.price, resaleValue: cat.price, monthlyCost: cat.monthlyCost, passiveReturn: cat.passiveReturn, perks: { ...cat.perks }, ...(savedImg ? { customImage: savedImg } : {}), custom: false };
  }

  if (hub.cash < item.price) throw new Error('Fonds insuffisants.');
  hub.cash -= item.price;
  if (item.price > 0) addLedger(hub, { date: gameDate, amount: -item.price, kind: 'asset_buy', label: item.name });
  if (item.perks) applyEffects(state, hub, item.perks, {}, gameDate, '');
  hub.assets.push({ ...item, since: gameDate });
  pushRecent(hub, { date: gameDate, kind: 'asset', text: `Acquired ${item.custom ? item.name : item.id}` });
  return hub;
}

function sellAsset(state, assetId, gameDate = '') {
  const hub = ensureLifeHub(state, state.snapshot);
  const idx = hub.assets.findIndex((a) => a.id === assetId);
  if (idx < 0) throw new Error('Élément introuvable.');
  const asset = hub.assets[idx];
  const isStaff = asset.category === 'staff';
  const refund = isStaff || asset.category === 'charity' ? 0 : Math.round((asset.resaleValue ?? asset.price ?? 0) * (asset.category === 'investment' ? 0.9 : 0.75));
  if (refund > 0) {
    hub.cash += refund;
    addLedger(hub, { date: gameDate, amount: refund, kind: 'asset_sell', label: asset.name });
  }
  hub.assets.splice(idx, 1);
  pushRecent(hub, { date: gameDate, kind: 'asset', text: `${isStaff ? 'Dismissed' : 'Sold'} ${asset.custom ? asset.name : asset.id}` });
  return hub;
}

function executeSponsorBuyout(state, conflicts, gameDate = '', { buyoutCoveredByBuyer = false, buyoutCost = 0, buyerBrand = '' } = {}) {
  const hub = ensureLifeHub(state, state.snapshot);
  const fee = buyoutCoveredByBuyer ? 0 : Math.max(0, Math.round(Number(buyoutCost) || 0));
  if (fee > 0) {
    if (hub.cash < fee) throw new Error('Fonds insuffisants.');
    hub.cash -= fee;
    addLedger(hub, { date: gameDate, amount: -fee, kind: 'expense', label: `buyout:${buyerBrand || 'sponsor'}` });
  }
  const removedBrands = [];
  for (const c of conflicts || []) {
    const sp = c?.sponsor || c;
    if (!sp?.id) continue;
    removedBrands.push(sp.brand);
    removeSponsor(state, sp.id, gameDate);
  }
  if (!buyoutCoveredByBuyer && removedBrands.length) {
    hub.meters.sponsors = clamp(hub.meters.sponsors - 4, 0, 100);
  }
  hub.lastSponsorSwitch = {
    kind: 'buyout_switch',
    from: removedBrands,
    to: buyerBrand || '',
    buyoutCovered: Boolean(buyoutCoveredByBuyer),
    on: gameDate,
  };
  return { removedBrands, paid: fee };
}

function addSponsor(state, payload = {}, gameDate = '', newId = () => `id_${Date.now()}`, { enforceExclusivity = false, allowBuyout = false, buyoutCovered = false } = {}) {
  const hub = ensureLifeHub(state, state.snapshot);
  const entry = normalizeSponsorEntry(payload, newId(), gameDate);
  if (!entry) throw new Error('Nom de sponsor requis.');
  if (isDuplicateSponsor(hub.sponsors, entry)) throw new Error('Ce sponsor existe déjà.');

  if (enforceExclusivity) {
    if (entry.categories.some((c) => String(c).toLowerCase() === 'betting')) {
      const check = isBettingAllowed(state.snapshot);
      if (!check.allowed) throw new Error('Les sponsors de paris sportifs sont interdits dans ce championnat.');
    }
    const conflicts = findSponsorConflicts(hub.sponsors, entry);
    if (conflicts.length) {
      if (!allowBuyout) throw new Error('Conflit de catégorie avec un sponsor actif.');
      const totalConflictFee = conflicts.reduce((sum, c) => sum + Math.max(40000, Number(c.sponsor?.fee) || 0), 0);
      const buyoutCost = roundStep(totalConflictFee * 0.28, 5000);
      executeSponsorBuyout(state, conflicts, gameDate, { buyoutCoveredByBuyer: buyoutCovered, buyoutCost, buyerBrand: entry.brand });
    }
  }

  const cap = sponsorSlotCap(state.profile?.followers || 0, hub.stage);
  if (cap !== null && hub.sponsors.length >= cap) throw new Error('Toutes les places de sponsors sont occupées pour ta notoriété actuelle.');
  hub.sponsors.push(entry);
  syncBootSponsor(state, hub);
  hub.meters.sponsors = clamp(hub.meters.sponsors + 4, 0, 100);
  scheduleNextObligation(hub, gameDate, newId);
  pushRecent(hub, { date: gameDate, kind: 'sponsor', text: `Signed sponsor deal with ${entry.brand}${entry.isGlobalPartner ? ' (Global Partner)' : ''}` });
  return entry;
}

function updateSponsor(state, payload = {}, { enforceExclusivity = false } = {}) {
  const hub = ensureLifeHub(state, state.snapshot);
  const sp = hub.sponsors.find((s) => s.id === payload.id);
  if (!sp) throw new Error('Élément introuvable.');
  const wasBoot = isBootCategorySponsor(sp);
  const brand = cleanText(payload.brand, 80);
  if (!brand) throw new Error('Nom de sponsor requis.');
  const nextCategories = (payload.categories !== undefined || payload.category !== undefined || payload.customCategories !== undefined)
    ? normalizeSponsorCategories(payload)
    : sp.categories;

  if (enforceExclusivity) {
    if (nextCategories.some((c) => String(c).toLowerCase() === 'betting') && !isBettingAllowed(state.snapshot).allowed) {
      throw new Error('Les sponsors de paris sportifs sont interdits dans ce championnat.');
    }
    const conflicts = findSponsorConflicts(hub.sponsors, { brand, categories: nextCategories }, { ignoreId: sp.id });
    if (conflicts.length) throw new Error('Conflit de catégorie avec un sponsor actif.');
  }

  sp.brand = brand;
  sp.categories = nextCategories;
  sp.category = nextCategories[0];
  if (payload.isGlobalPartner !== undefined) sp.isGlobalPartner = Boolean(payload.isGlobalPartner);
  if (payload.fee !== undefined) sp.fee = Math.max(0, Math.round(Number(payload.fee) || 0));
  if (payload.bonus !== undefined) sp.bonus = Math.max(0, Math.round(Number(payload.bonus) || 0));
  if (payload.until !== undefined) sp.until = cleanText(payload.until, 10);
  if (payload.notes !== undefined) sp.notes = cleanText(payload.notes, 140);

  if (sp.linkedBootDeal || isBootCategorySponsor(sp)) {
    hub.renamedBootBrand = true;
    if (state.sponsor?.deal) {
      state.sponsor.deal.brand = sp.brand;
      state.sponsor.deal.fee = sp.fee;
      state.sponsor.deal.bonus = sp.bonus;
      state.sponsor.deal.isGlobalPartner = Boolean(sp.isGlobalPartner);
      if (sp.until) state.sponsor.deal.until = sp.until;
    }
  }
  if (wasBoot && !isBootCategorySponsor(sp)) {
    sp.linkedBootDeal = false;
    if (state.sponsor?.deal) state.sponsor.deal = null;
  }
  syncBootSponsor(state, hub);
  for (const ob of hub.obligations) {
    if (ob.sponsorId === sp.id) ob.brand = sp.brand;
  }
  return sp;
}

function removeSponsor(state, id, gameDate = '') {
  const hub = ensureLifeHub(state, state.snapshot);
  const idx = hub.sponsors.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error('Élément introuvable.');
  const removed = hub.sponsors.splice(idx, 1)[0];
  hub.obligations = hub.obligations.filter((o) => o.sponsorId !== id);
  if ((removed.linkedBootDeal || isBootCategorySponsor(removed)) && state.sponsor?.deal) {
    state.sponsor.deal = null;
  }
  syncBootSponsor(state, hub);
  pushRecent(hub, { date: gameDate, kind: 'sponsor', text: `Ended deal with ${removed.brand}` });
  return hub;
}

function answerSponsorOffer(state, offerId, choice, gameDate = '', newId = () => `id_${Date.now()}`, { allowBuyout = false } = {}) {
  const hub = ensureLifeHub(state, state.snapshot);
  const idx = hub.offers.findIndex((o) => o.id === offerId);
  if (idx < 0) throw new Error('Offre de sponsor introuvable.');
  if (!['accept', 'negotiate', 'decline'].includes(choice)) throw new Error('Choix inconnu.');
  const offer = hub.offers[idx];

  if (choice === 'decline') {
    hub.offers.splice(idx, 1);
    return { status: 'declined', offer };
  }
  if (choice === 'negotiate') {
    if (offer.negotiated) throw new Error('Tu as déjà négocié cette offre.');
    offer.negotiated = true;
    const up = hashStr(`${offer.id}|neg`) % 100 < 70;
    if (up) {
      offer.fee = roundStep(offer.fee * 1.15, 5000);
      offer.bonus = roundStep(offer.bonus * 1.15, 500);
    }
    return { status: up ? 'raised' : 'held', offer };
  }

  if (offer.upgradeSponsorId) {
    const target = hub.sponsors.find((s) => s.id === offer.upgradeSponsorId);
    hub.offers.splice(idx, 1);
    if (target) {
      target.isGlobalPartner = true;
      target.fee = offer.fee;
      target.bonus = offer.bonus;
      target.until = offer.until;
      syncBootSponsor(state, hub);
      hub.meters.sponsors = clamp(hub.meters.sponsors + 6, 0, 100);
      pushRecent(hub, { date: gameDate, kind: 'sponsor', text: `Upgraded ${target.brand} to Global Partner` });
      return { status: 'signed', sponsor: target };
    }
  }

  const conflicts = findSponsorConflicts(hub.sponsors, offer);
  if (conflicts.length && !allowBuyout) {
    throw new Error('Conflit de catégorie avec un sponsor actif.');
  }
  const signed = addSponsor(
    state,
    { ...offer, id: newId(), since: gameDate },
    gameDate,
    newId,
    { enforceExclusivity: true, allowBuyout: Boolean(allowBuyout), buyoutCovered: Boolean(offer.buyoutCovered) },
  );
  hub.offers.splice(idx, 1);
  return { status: 'signed', sponsor: signed };
}

function answerBiddingWar(state, warId, { action = 'accept', bidId = null } = {}, gameDate = '', newId = () => `id_${Date.now()}`) {
  const hub = ensureLifeHub(state, state.snapshot);
  hub.biddingWars ||= [];
  const idx = hub.biddingWars.findIndex((w) => w.id === warId);
  if (idx < 0) throw new Error('Enchère de sponsors introuvable.');
  const war = hub.biddingWars[idx];

  if (action === 'decline') {
    hub.biddingWars.splice(idx, 1);
    pushRecent(hub, { date: gameDate, kind: 'sponsor', text: `Walked away from ${war.category} bidding war` });
    return { status: 'declined', war };
  }

  if (action === 'leverage') {
    if (!state.agent?.name) throw new Error('Tu n’as pas d’agent pour négocier.');
    if ((war.round || 0) >= 2) throw new Error('Enchère déjà poussée au maximum.');
    war.round = (war.round || 0) + 1;
    const activeBids = war.bids.filter((b) => !b.walkedAway);
    let kept = 0;
    for (let i = 0; i < activeBids.length; i++) {
      const b = activeBids[i];
      const walkRoll = war.round >= 2 && activeBids.length - kept > 1 && (hashStr(`${war.id}|walk|${b.id}|${war.round}`) % 10 < 4);
      if (walkRoll) {
        b.walkedAway = true;
        continue;
      }
      kept++;
      const boost = 1.12 + ((hashStr(`${b.id}|r${war.round}`) % 7) / 100);
      b.fee = roundStep(b.fee * boost, 5000);
      b.bonus = roundStep(b.bonus * 1.1, 250);
      b.signingBonus = roundStep((b.signingBonus || b.fee * 0.1) * 1.15, 5000);
    }
    if (war.existingSponsorId && !war.incumbentMatch) {
      const topBid = war.bids.filter((b) => !b.walkedAway).sort((a, b) => b.fee - a.fee)[0];
      if (topBid && (hashStr(`${war.id}|match|${gameDate}`) % 10 < 7)) {
        const curSp = hub.sponsors.find((s) => s.id === war.existingSponsorId);
        if (curSp) {
          war.incumbentMatch = {
            brand: curSp.brand,
            fee: roundStep(topBid.fee * 0.96, 5000),
            bonus: topBid.bonus,
            isGlobalPartner: Boolean(curSp.isGlobalPartner || topBid.isGlobalPartner),
            until: topBid.until,
          };
        }
      }
    }
    return { status: 'leveraged', war };
  }

  if (action === 'match_incumbent') {
    if (!war.incumbentMatch || !war.existingSponsorId) throw new Error('Offre de maintien introuvable.');
    const curSp = hub.sponsors.find((s) => s.id === war.existingSponsorId);
    if (!curSp) throw new Error('Élément introuvable.');
    curSp.fee = war.incumbentMatch.fee;
    curSp.bonus = war.incumbentMatch.bonus;
    curSp.isGlobalPartner = Boolean(war.incumbentMatch.isGlobalPartner);
    curSp.until = war.incumbentMatch.until;
    syncBootSponsor(state, hub);
    hub.meters.sponsors = clamp(hub.meters.sponsors + 6, 0, 100);
    hub.lastSponsorSwitch = {
      kind: 'loyalty_renewal',
      brand: curSp.brand,
      rivals: war.bids.filter((b) => !b.walkedAway).map((b) => b.brand),
      on: gameDate,
    };
    hub.biddingWars.splice(idx, 1);
    pushRecent(hub, { date: gameDate, kind: 'sponsor', text: `Renewed with ${curSp.brand} after bidding war` });
    return { status: 'matched', sponsor: curSp };
  }

  const chosen = war.bids.find((b) => b.id === bidId && !b.walkedAway)
    || war.bids.filter((b) => !b.walkedAway).sort((a, b) => b.fee - a.fee)[0];
  if (!chosen) throw new Error('Élément introuvable.');

  const conflicts = findSponsorConflicts(hub.sponsors, chosen);
  if (conflicts.length) {
    executeSponsorBuyout(state, conflicts, gameDate, {
      buyoutCoveredByBuyer: Boolean(chosen.buyoutCovered),
      buyoutCost: war.buyoutCost || 0,
      buyerBrand: chosen.brand,
    });
  }
  const signed = addSponsor(
    state,
    { ...chosen, id: newId(), since: gameDate },
    gameDate,
    newId,
    { enforceExclusivity: false },
  );
  if (chosen.signingBonus > 0) {
    hub.cash += chosen.signingBonus;
    addLedger(hub, { date: gameDate, amount: chosen.signingBonus, kind: 'sponsor', label: `signing_bonus:${chosen.brand}` });
  }
  hub.biddingWars.splice(idx, 1);
  return { status: 'signed', sponsor: signed, war };
}

function answerOneTimeDeal(state, dealId, choice, gameDate = '', chosenDate = null, newId = () => `id_${Date.now()}`) {
  const hub = ensureLifeHub(state, state.snapshot);
  hub.oneTimeOffers ||= [];
  hub.completedOneTime ||= [];
  const idx = hub.oneTimeOffers.findIndex((o) => o.id === dealId);
  if (idx < 0) throw new Error('Offre ponctuelle introuvable.');
  const offer = hub.oneTimeOffers[idx];

  if (choice === 'decline') {
    hub.oneTimeOffers.splice(idx, 1);
    return { status: 'declined', offer };
  }
  if (choice !== 'accept') throw new Error('Choix inconnu.');

  hub.oneTimeOffers.splice(idx, 1);
  const deposit = roundStep(offer.fee * 0.25, 500);
  const remainder = Math.max(0, offer.fee - deposit);
  if (deposit > 0) {
    hub.cash += deposit;
    addLedger(hub, { date: gameDate, amount: deposit, kind: 'sponsor', label: `onetime_deposit:${offer.brand}` });
  }
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(chosenDate || '')) && String(chosenDate) > gameDate
    ? String(chosenDate)
    : (offer.suggestedDate && offer.suggestedDate > gameDate ? offer.suggestedDate : addDaysIso(gameDate, 6));

  state.calendar ||= { simDate: gameDate, saveDate: gameDate, pendingMatches: [], revealedMatchIds: [], customEvents: [], history: [] };
  state.calendar.customEvents ||= [];
  const calEv = {
    id: newId(),
    date: targetDate,
    title: `${offer.brand} — ${offer.dealKey.replace(/_/g, ' ')}`,
    category: 'sponsor',
    kind: 'onetime',
    oneTimeDeal: {
      dealKey: offer.dealKey,
      brand: offer.brand,
      remainderFee: remainder,
      mediaBoost: offer.mediaBoost || 5,
      fanBoost: offer.fanBoost || 4,
      followerBoost: offer.followerBoost || 0.015,
    },
  };
  state.calendar.customEvents.push(calEv);
  state.calendar.customEvents.sort((a, b) => a.date.localeCompare(b.date));
  pushRecent(hub, { date: gameDate, kind: 'sponsor', text: `Booked ${offer.brand} (${offer.dealKey}) for ${targetDate}` });
  return { status: 'scheduled', offer, event: calEv, deposit };
}

function rescheduleObligation(state, obligationId, newDate, matchDatesSet = null) {
  const hub = ensureLifeHub(state, state.snapshot);
  const ob = hub.obligations.find((o) => o.id === obligationId);
  if (!ob) throw new Error('Élément introuvable.');
  const clean = String(newDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error('Date et titre requis.');
  const today = state.snapshot?.gameDate || hub.lastTickDate || clean;
  const maxDate = addDaysIso(ob.dueDate || today, 14);
  if (clean < today || clean > maxDate) throw new Error('La date choisie est hors de la fenêtre permise.');
  if (matchDatesSet && matchDatesSet.has(clean)) throw new Error('Impossible de décaler une obligation sur un jour de match.');
  ob.dueDate = clean;
  return ob;
}

function completeObligation(state, obligationId, { skip = false } = {}, gameDate = '') {
  const hub = ensureLifeHub(state, state.snapshot);
  const ob = hub.obligations.find((o) => o.id === obligationId);
  if (!ob) throw new Error('Élément introuvable.');
  if (skip) {
    ob.status = 'skipped';
    hub.meters.sponsors = clamp(hub.meters.sponsors - 5, 0, 100);
    pushRecent(hub, { date: gameDate, kind: 'sponsor', text: `Skipped ${ob.brand} commitment` });
    return ob;
  }
  ob.status = 'done';
  hub.meters.sponsors = clamp(hub.meters.sponsors + 5, 0, 100);
  hub.meters.media = clamp(hub.meters.media + 2, 0, 100);
  if (ob.rewardCash > 0) {
    hub.cash += ob.rewardCash;
    addLedger(hub, { date: gameDate, amount: ob.rewardCash, kind: 'sponsor', label: `event:${ob.brand}` });
  }
  pushRecent(hub, { date: gameDate, kind: 'sponsor', text: `Completed ${ob.brand} appearance` });
  return ob;
}

function pickCompanionName(state, snapshot, actionId) {
  const seed = `${snapshot?.gameDate || ''}|${actionId}`;
  if (actionId === 'inner_circle' && state?.persona?.circle) {
    const people = Object.values(state.persona.circle).flat().filter((p) => p?.name);
    if (people.length) return people[hashStr(seed) % people.length].name;
  }
  const squad = (snapshot?.squad || []).filter((p) => p?.name && !p.me);
  if ((actionId === 'team_dinner' || actionId === 'extra_training') && squad.length) {
    return squad[hashStr(seed) % squad.length].name;
  }
  return '';
}

function queueSaveEffects(hub, saveEffects, reason = '') {
  if (!saveEffects) return;
  const p = (hub.pendingSaveEffects ||= { affectionDelta: 0, formArrowDelta: 0, reasons: [] });
  if (saveEffects.affectionDelta) p.affectionDelta = clamp((p.affectionDelta || 0) + saveEffects.affectionDelta, -8, 8);
  if (saveEffects.formArrowDelta) p.formArrowDelta = clamp((p.formArrowDelta || 0) + saveEffects.formArrowDelta, -1, 1);
  const cleanReason = cleanText(reason, 80);
  if (cleanReason && !p.reasons.includes(cleanReason)) {
    p.reasons = [...p.reasons, cleanReason].slice(-5);
  }
}

function clearPendingSaveEffects(state, applied = null) {
  const hub = ensureLifeHub(state, state.snapshot);
  if (applied) hub.lastSaveEffectApplied = applied;
  hub.pendingSaveEffects = { affectionDelta: 0, formArrowDelta: 0, reasons: [] };
  return hub;
}

function performAction(state, snapshot, payload = {}, newId = () => `id_${Date.now()}`) {
  const hub = ensureLifeHub(state, snapshot);
  const today = snapshot?.gameDate || hub.lastTickDate || '';
  if ((hub.ap || 0) < 1) throw new Error('Plus de points d’action disponibles : synchronise après un match ou quelques jours en jeu.');

  let memoryLine = '';
  let companion = '';
  let deltas = { meters: {}, cost: 0, bonusCash: 0, followerDelta: 0, saveEffects: null };
  if (payload.custom) {
    const title = cleanText(payload.title, 80);
    if (!title) throw new Error('Nom de l’élément requis.');
    const focus = METER_KEYS.includes(payload.focus) ? payload.focus : 'fans';
    const cost = Math.max(0, Math.round(Number(payload.cost) || 0));
    if (hub.cash < cost) throw new Error('Fonds insuffisants.');
    hub.ap -= 1;
    applyEffects(state, hub, { [focus]: 5 }, { cost }, today, title);
    deltas = { meters: { [focus]: 5 }, cost, bonusCash: 0, followerDelta: 0, saveEffects: null };
    memoryLine = title;
    pushRecent(hub, { date: today, kind: 'action', text: title });
  } else {
    const act = OFF_PITCH_ACTIONS.find((a) => a.id === payload.actionId);
    if (!act) throw new Error('Élément introuvable.');
    const cost = act.cost || 0;
    if (hub.cash < cost) throw new Error('Fonds insuffisants.');
    hub.ap -= act.ap || 1;
    companion = cleanText(payload.companion, 60) || pickCompanionName(state, snapshot, act.id);
    applyEffects(state, hub, act.effects, { cost, bonusCash: act.bonusCash || 0, followerDelta: act.followerDelta || 0 }, today, act.id);
    queueSaveEffects(hub, act.saveEffects, act.id);
    deltas = { meters: { ...(act.effects || {}) }, cost, bonusCash: act.bonusCash || 0, followerDelta: act.followerDelta || 0, saveEffects: act.saveEffects ? { ...act.saveEffects } : null };
    memoryLine = companion ? `${act.memory} (${companion})` : act.memory;
    pushRecent(hub, { date: today, kind: 'action', text: memoryLine });
  }
  return { hub, memoryLine, companion, deltas };
}

function answerDilemma(state, dilemmaId, choiceId, gameDate = '') {
  const hub = ensureLifeHub(state, state.snapshot);
  const cur = hub.pendingDilemma;
  if (!cur || cur.id !== dilemmaId) throw new Error('Dilemme introuvable.');
  const def = DILEMMA_POOL.find((d) => d.id === cur.dilemmaId);
  const ch = def?.choices?.find((c) => c.id === choiceId);
  if (!ch) throw new Error('Choix inconnu.');
  const cost = ch.cost || 0;
  if (hub.cash < cost) throw new Error('Fonds insuffisants.');

  applyEffects(state, hub, ch.effects, { cost, bonusCash: ch.bonusCash || 0, followerDelta: ch.followerDelta || 0 }, gameDate, cur.dilemmaId);
  queueSaveEffects(hub, ch.saveEffects, cur.dilemmaId);
  hub.pendingDilemma = null;
  pushRecent(hub, { date: gameDate, kind: 'dilemma', text: ch.memory });
  const deltas = { meters: { ...(ch.effects || {}) }, cost, bonusCash: ch.bonusCash || 0, followerDelta: ch.followerDelta || 0, saveEffects: ch.saveEffects ? { ...ch.saveEffects } : null };
  return { hub, memoryLine: ch.memory, dilemmaId: cur.dilemmaId, choiceId, deltas };
}

function lifeHubFacts(state) {
  const hub = state?.lifeHub;
  if (!hub?.calibrated) return undefined;
  const activeSponsors = (hub.sponsors || [])
    .filter((s) => s?.brand)
    .slice(0, 10)
    .map((s) => `${s.brand} (${normalizeSponsorCategories(s).join(', ')}${s.isGlobalPartner ? ' · Global Partner' : ''})`);
  const activeWars = (hub.biddingWars || [])
    .map((w) => `${w.category} bidding war (${w.bids.filter((b) => !b.walkedAway).map((b) => b.brand).join(' vs ')})`);
  const notableAssets = (hub.assets || [])
    .filter((a) => ['home', 'car', 'charity', 'staff'].includes(a.category) || a.custom)
    .map((a) => (a.custom ? a.name : (CATALOG_ENGLISH_NAMES[a.catalogId || a.name] || a.name)))
    .filter(Boolean)
    .slice(0, 6);
  const recent = (hub.recentEvents || []).slice(0, 3).map((e) => e.text);
  return {
    career_stage: hub.stage || 'rookie',
    ...(activeSponsors.length ? { active_sponsors: activeSponsors } : {}),
    ...(activeWars.length ? { active_bidding_wars: activeWars } : {}),
    relationships: { ...hub.meters },
    ...(notableAssets.length ? { notable_lifestyle: notableAssets } : {}),
    ...(recent.length ? { recent_off_pitch: recent } : {}),
  };
}

module.exports = {
  EXCLUSIVE_CATEGORIES,
  MULTI_BRAND_CATEGORIES,
  SPONSOR_CATEGORIES,
  SPONSOR_PRESETS,
  ASSET_CATEGORIES,
  ASSET_CATALOG,
  OFF_PITCH_ACTIONS,
  DILEMMA_POOL,
  METER_KEYS,
  detectCareerStage,
  sponsorSlotCap,
  normalizeSponsorCategories,
  isDuplicateSponsor,
  estimateStartProfile,
  ensureLifeHub,
  addLedger,
  syncBootSponsor,
  isBootCategorySponsor,
  calibrateLifeHub,
  lifeHubTick,
  buyAsset,
  sellAsset,
  addSponsor,
  updateSponsor,
  removeSponsor,
  executeSponsorBuyout,
  answerSponsorOffer,
  maybeStartBiddingWar,
  answerBiddingWar,
  maybeOfferOneTimeDeal,
  answerOneTimeDeal,
  completeObligation,
  rescheduleObligation,
  performAction,
  answerDilemma,
  ownedMonthlyCost,
  assetNetWorth,
  lifeHubFacts,
  clearPendingSaveEffects,
};
