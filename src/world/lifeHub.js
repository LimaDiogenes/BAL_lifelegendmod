'use strict';
// Phase C : Hub "Ma vie" — calibration de carrière (début ou mi-carrière), finances & patrimoine,
// jauges relationnelles, sponsors multi-slots éditables, activités hors terrain et dilemmes déterministes.
// Aucune requête d'IA supplémentaire : tout tourne localement à partir de la sauvegarde.

const { PERSONA_PRESETS } = require('./persona');
const { CATALOG_ENGLISH_NAMES } = require('./lifeScenes');

const SPONSOR_CATEGORIES = [
  'boots', 'apparel', 'beverage', 'automotive', 'watches',
  'lifestyle', 'tech', 'travel', 'finance', 'grooming',
  'media', 'health', 'global',
];

const SPONSOR_PRESETS = [
  { id: 'boots_pro', category: 'boots', categories: ['boots', 'apparel'], brand: 'Nike Football', baseFee: 180000, bonus: 3500 },
  { id: 'apparel_ath', category: 'apparel', categories: ['apparel', 'boots'], brand: 'Adidas Originals', baseFee: 240000, bonus: 4000 },
  { id: 'puma_pack', category: 'boots', categories: ['boots', 'apparel'], brand: 'Puma Sport', baseFee: 170000, bonus: 3000 },
  { id: 'beverage_fuel', category: 'beverage', categories: ['beverage', 'health'], brand: 'Gatorade Fuel', baseFee: 140000, bonus: 2500 },
  { id: 'auto_drive', category: 'automotive', categories: ['automotive', 'lifestyle'], brand: 'Porsche Motorsport', baseFee: 380000, bonus: 5500 },
  { id: 'watch_lux', category: 'watches', categories: ['watches', 'lifestyle'], brand: 'TAG Heuer Chrono', baseFee: 420000, bonus: 6000 },
  { id: 'tech_game', category: 'tech', categories: ['tech', 'media'], brand: 'EA / HyperStrike Gaming', baseFee: 160000, bonus: 3000 },
  { id: 'global_air', category: 'global', categories: ['travel', 'global'], brand: 'Emirates Fly', baseFee: 650000, bonus: 9000 },
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
    if (low === '__custom__') continue;
    const val = SPONSOR_CATEGORIES.includes(low) ? low : clean;
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
    sp.categories = normalizeSponsorCategories(sp);
    sp.category = sp.categories[0];
  }
  hub.offers ||= [];
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
  const categories = normalizeSponsorCategories(raw);
  const fee = Math.max(0, Math.round(Number(raw?.fee) || 0));
  const bonus = Math.max(0, Math.round(Number(raw?.bonus) || 0));
  const since = cleanText(raw?.since, 10) || today || '';
  const until = cleanText(raw?.until, 10) || addDaysIso(today, 365);
  return {
    id: cleanText(raw?.id, 40) || fallbackId,
    linkedBootDeal: Boolean(raw?.linkedBootDeal),
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

function syncBootSponsor(state, hub) {
  const deal = state?.sponsor?.deal;
  const existingIdx = hub.sponsors.findIndex((s) => s.linkedBootDeal);
  if (!deal) {
    if (existingIdx >= 0) hub.sponsors.splice(existingIdx, 1);
    hub.renamedBootBrand = false;
    return;
  }
  if (existingIdx >= 0) {
    const cur = hub.sponsors[existingIdx];
    if (!hub.renamedBootBrand) cur.brand = deal.brand;
    cur.fee = deal.fee;
    cur.bonus = deal.bonus;
    cur.until = deal.until;
    cur.categories = normalizeSponsorCategories(cur.categories?.length ? cur : { category: 'boots' });
    cur.category = cur.categories[0];
    return;
  }
  const entry = {
    id: 'boot_deal',
    linkedBootDeal: true,
    category: 'boots',
    categories: ['boots'],
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
    beverage: 'kit_shoot',
    automotive: 'vip_event',
    watches: 'vip_event',
    lifestyle: 'vip_event',
    tech: 'stream_promo',
    media: 'stream_promo',
    travel: 'brand_gala',
    global: 'brand_gala',
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
  syncBootSponsor(state, hub);
  const cap = sponsorSlotCap(state.profile?.followers || est.followers, est.stage);
  const rawList = Array.isArray(payload.existingSponsors) ? payload.existingSponsors : [];
  for (const item of rawList) {
    if (cap !== null && hub.sponsors.length >= cap) break;
    const norm = normalizeSponsorEntry(item, newId(), today);
    if (!norm) continue;
    if (isDuplicateSponsor(hub.sponsors, norm)) continue;
    hub.sponsors.push(norm);
  }

  hub.ledger = [];
  addLedger(hub, { date: today, amount: chosenCash, kind: 'opening', label: `calibration:${startMode}` });
  if (hub.sponsors.length) scheduleNextObligation(hub, today, newId);
  return hub;
}

function makeSponsorOffer(state, snapshot, hub, newId) {
  const today = snapshot.gameDate;
  const est = estimateStartProfile(snapshot, state);
  const openKeys = new Set(hub.offers.map((o) => `${o.brand.toLowerCase()}|${normalizeSponsorCategories(o).join(',')}`));
  const candidates = SPONSOR_PRESETS.filter((p) => !isDuplicateSponsor(hub.sponsors, p) && !openKeys.has(`${p.brand.toLowerCase()}|${normalizeSponsorCategories(p).join(',')}`));
  if (!candidates.length) return null;

  const idx = hashStr(`${state.careerId}|${today}|mloff`) % candidates.length;
  const base = candidates[idx];
  const categories = normalizeSponsorCategories(base);
  const scale = { rookie: 0.45, rising: 1.0, established: 2.0, superstar: 3.6 }[est.stage] || 1;
  const wageBoost = Math.max(0, (snapshot?.player?.salary || 0) * 0.08);
  const meterScale = 0.85 + (hub.meters.sponsors / 100) * 0.35;
  const fee = roundStep(Math.max(15000, (base.baseFee * scale + wageBoost) * meterScale), 5000);
  const bonus = roundStep(Math.max(1000, base.bonus * scale), 500);
  const person = OFFER_PERSON_NAMES[hashStr(`${today}|${base.brand}`) % OFFER_PERSON_NAMES.length];
  return {
    id: newId(),
    category: categories[0],
    categories,
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

function lifeHubTick(state, snapshot, { changes = {}, newId = () => `id_${Date.now()}` } = {}) {
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

  // Génère une nouvelle offre de sponsor si une place est libre (tous les ~14 jours).
  const cap = sponsorSlotCap(state.profile?.followers || 0, hub.stage);
  const cooldownDone = !hub.offerCooldownUntil || today >= hub.offerCooldownUntil;
  if ((cap === null || hub.sponsors.length < cap) && hub.offers.length < 2 && cooldownDone && results.length > 0) {
    const offer = makeSponsorOffer(state, snapshot, hub, newId);
    if (offer) {
      hub.offers.push(offer);
      hub.offerCooldownUntil = addDaysIso(today, 14);
    }
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

function addSponsor(state, payload = {}, gameDate = '', newId = () => `id_${Date.now()}`) {
  const hub = ensureLifeHub(state, state.snapshot);
  const cap = sponsorSlotCap(state.profile?.followers || 0, hub.stage);
  if (cap !== null && hub.sponsors.length >= cap) throw new Error('Toutes les places de sponsors sont occupées pour ta notoriété actuelle.');
  const entry = normalizeSponsorEntry(payload, newId(), gameDate);
  if (!entry) throw new Error('Nom de sponsor requis.');
  if (isDuplicateSponsor(hub.sponsors, entry)) throw new Error('Ce sponsor existe déjà.');
  hub.sponsors.push(entry);
  hub.meters.sponsors = clamp(hub.meters.sponsors + 4, 0, 100);
  scheduleNextObligation(hub, gameDate, newId);
  pushRecent(hub, { date: gameDate, kind: 'sponsor', text: `Signed sponsor deal with ${entry.brand}` });
  return entry;
}

function updateSponsor(state, payload = {}) {
  const hub = ensureLifeHub(state, state.snapshot);
  const sp = hub.sponsors.find((s) => s.id === payload.id);
  if (!sp) throw new Error('Élément introuvable.');
  const brand = cleanText(payload.brand, 80);
  if (!brand) throw new Error('Nom de sponsor requis.');
  sp.brand = brand;
  if (payload.categories !== undefined || payload.category !== undefined || payload.customCategories !== undefined) {
    sp.categories = normalizeSponsorCategories(payload);
    sp.category = sp.categories[0];
  }
  if (payload.fee !== undefined) sp.fee = Math.max(0, Math.round(Number(payload.fee) || 0));
  if (payload.bonus !== undefined) sp.bonus = Math.max(0, Math.round(Number(payload.bonus) || 0));
  if (payload.until !== undefined) sp.until = cleanText(payload.until, 10);
  if (payload.notes !== undefined) sp.notes = cleanText(payload.notes, 140);

  if (sp.linkedBootDeal && state.sponsor?.deal) {
    state.sponsor.deal.brand = sp.brand;
    state.sponsor.deal.fee = sp.fee;
    state.sponsor.deal.bonus = sp.bonus;
    if (sp.until) state.sponsor.deal.until = sp.until;
    hub.renamedBootBrand = true;
  }
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
  if (removed.linkedBootDeal && state.sponsor?.deal) state.sponsor.deal = null;
  pushRecent(hub, { date: gameDate, kind: 'sponsor', text: `Ended deal with ${removed.brand}` });
  return hub;
}

function answerSponsorOffer(state, offerId, choice, gameDate = '', newId = () => `id_${Date.now()}`) {
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

  const cap = sponsorSlotCap(state.profile?.followers || 0, hub.stage);
  if (cap !== null && hub.sponsors.length >= cap) throw new Error('Toutes les places de sponsors sont occupées pour ta notoriété actuelle.');
  hub.offers.splice(idx, 1);
  const signed = addSponsor(state, { ...offer, id: newId(), since: gameDate }, gameDate, newId);
  return { status: 'signed', sponsor: signed };
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
    .slice(0, 8)
    .map((s) => `${s.brand} (${normalizeSponsorCategories(s).join(', ')})`);
  const notableAssets = (hub.assets || [])
    .filter((a) => ['home', 'car', 'charity', 'staff'].includes(a.category) || a.custom)
    .map((a) => (a.custom ? a.name : (CATALOG_ENGLISH_NAMES[a.catalogId || a.name] || a.name)))
    .filter(Boolean)
    .slice(0, 6);
  const recent = (hub.recentEvents || []).slice(0, 3).map((e) => e.text);
  return {
    career_stage: hub.stage || 'rookie',
    ...(activeSponsors.length ? { active_sponsors: activeSponsors } : {}),
    relationships: { ...hub.meters },
    ...(notableAssets.length ? { notable_lifestyle: notableAssets } : {}),
    ...(recent.length ? { recent_off_pitch: recent } : {}),
  };
}

module.exports = {
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
  ownedMonthlyCost,
  assetNetWorth,
  lifeHubFacts,
  clearPendingSaveEffects,
};
