'use strict';
// Profil psychologique, goûts et cercle intime du joueur (Phase B).
// Autonome : aucun import de privacyShield ou world pour éviter toute dépendance circulaire.

const CIRCLE_GROUPS = ['family', 'friends', 'business', 'roots'];
const MAX_GROUP_PEOPLE = 10;
const TRAIT_KEYS = ['media', 'temperament', 'ambition', 'loyalty', 'lifestyle', 'ego'];
const ROOT_KEYS = ['hometown', 'childhood', 'academy', 'heritage'];
const FLAVOR_KEYS = ['signature', 'hobby', 'favoriteDish', 'motto', 'turningPoint', 'idol', 'dream'];

const PERSONA_PRESETS = {
  humble_grinder: {
    id: 'humble_grinder',
    aiDesc: 'Humble grinder: quiet, tireless worker who lets the pitch talk',
    traits: {
      media: 'calm_humble',
      temperament: 'ice_cold',
      ambition: 'chasing_greatness',
      loyalty: 'one_club',
      lifestyle: 'family_first',
      ego: 'team_first',
    },
  },
  showman: {
    id: 'showman',
    aiDesc: 'Flashy showman: charismatic, thrives on spotlights and bold quotes',
    traits: {
      media: 'cocky_charismatic',
      temperament: 'expressive',
      ambition: 'trophy_hunter',
      loyalty: 'ambitious_climber',
      lifestyle: 'flashy_lux',
      ego: 'main_character',
    },
  },
  fiery_leader: {
    id: 'fiery_leader',
    aiDesc: 'Fiery captain: demands maximum standards, passionate dressing-room voice',
    traits: {
      media: 'diplomatic_leader',
      temperament: 'hot_headed',
      ambition: 'legacy_captain',
      loyalty: 'loyal_fighter',
      lifestyle: 'quiet_pro',
      ego: 'demanding_standards',
    },
  },
  hometown_kid: {
    id: 'hometown_kid',
    aiDesc: 'Hometown kid: deeply attached to roots, humble star with street hunger',
    traits: {
      media: 'warm_open',
      temperament: 'passionate',
      ambition: 'roots_pride',
      loyalty: 'homegrown_soul',
      lifestyle: 'street_roots',
      ego: 'humble_star',
    },
  },
  mercenary: {
    id: 'mercenary',
    aiDesc: 'Calculated mercenary: ice-cold professional chasing top wages and biggest stages',
    traits: {
      media: 'guarded_tactical',
      temperament: 'detached',
      ambition: 'big_money',
      loyalty: 'highest_bidder',
      lifestyle: 'jet_setter',
      ego: 'business_first',
    },
  },
  maverick: {
    id: 'maverick',
    aiDesc: 'Street maverick: unfiltered, emotional, unpredictable genius on and off the ball',
    traits: {
      media: 'unfiltered',
      temperament: 'volatile',
      ambition: 'prove_doubters',
      loyalty: 'restless_nomad',
      lifestyle: 'nightlife_music',
      ego: 'untamed_flair',
    },
  },
  silent_tactician: {
    id: 'silent_tactician',
    aiDesc: 'Silent tactician: composed student of the game, rarely speaks to press',
    traits: {
      media: 'media_shy',
      temperament: 'composed',
      ambition: 'craft_mastery',
      loyalty: 'mentor_driven',
      lifestyle: 'bookish_calm',
      ego: 'understated',
    },
  },
  fan_darling: {
    id: 'fan_darling',
    aiDesc: 'People’s champion: warm banter with supporters, feeds off stadium energy',
    traits: {
      media: 'banter_king',
      temperament: 'electric',
      ambition: 'entertain_crowd',
      loyalty: 'club_icon',
      lifestyle: 'community_heart',
      ego: 'crowd_fueled',
    },
  },
};

const TRAIT_AI_LABELS = {
  media: {
    calm_humble: 'calm & humble in press',
    cocky_charismatic: 'bold, quotable & charismatic',
    diplomatic_leader: 'measured, captain-like in mic',
    warm_open: 'warm, candid & approachable',
    guarded_tactical: 'guarded, short tactical answers',
    unfiltered: 'blunt & unfiltered',
    media_shy: 'reluctant with media',
    banter_king: 'witty banter with fans & press',
  },
  temperament: {
    ice_cold: 'ice-cold composure',
    expressive: 'animated & expressive',
    hot_headed: 'fiery, quick to boil over',
    passionate: 'wears heart on sleeve',
    detached: 'coolly detached',
    volatile: 'mercurial & emotional',
    composed: 'level-headed & analytical',
    electric: 'high-energy sparkplug',
  },
  ambition: {
    chasing_greatness: 'relentless pursuit of elite status',
    trophy_hunter: 'obsessed with major silverware',
    legacy_captain: 'wants lasting club & NT legacy',
    roots_pride: 'plays to make family & hometown proud',
    big_money: 'maximizing career earnings & status',
    prove_doubters: 'chip on shoulder, proving doubters wrong',
    craft_mastery: 'perfectionist about craft & tactics',
    entertain_crowd: 'plays for pure joy & crowd roar',
  },
  loyalty: {
    one_club: 'one-club devotion at heart',
    ambitious_climber: 'always eyeing a bigger step up',
    loyal_fighter: 'sticks through storms before leaving',
    homegrown_soul: 'tied to badge and teammates',
    highest_bidder: 'strictly business about transfers',
    restless_nomad: 'craves new leagues and challenges',
    mentor_driven: 'follows trusted coaches & project fit',
    club_icon: 'wants cult-hero bond with supporters',
  },
  lifestyle: {
    family_first: 'quiet home & family routine',
    flashy_lux: 'fashion, supercars & VIP spotlight',
    quiet_pro: 'monastic recovery, sleep & gym focus',
    street_roots: 'grounded in old neighborhood & friends',
    jet_setter: 'luxury travel & global brand circles',
    nightlife_music: 'loves music scene & late nights',
    bookish_calm: 'low-key reader, gamer & thinker',
    community_heart: 'active in youth & local charity work',
  },
  ego: {
    team_first: 'collective always comes first',
    main_character: 'expects spotlight & starring role',
    demanding_standards: 'tough on teammates’ standards',
    humble_star: 'brushes off praise, shares credit',
    business_first: 'treats football as an elite craft/job',
    untamed_flair: 'needs freedom, bristles at cages',
    understated: 'prefers quiet influence over noise',
    crowd_fueled: 'energized by chanting & recognition',
  },
};

const DEFAULT_CIRCLE_STARTERS = {
  family: ['Mère', 'Père', 'Frère / Sœur', 'Conjoint(e)'],
  friends: ['Meilleur ami', 'Ami d’enfance', 'Confident du vestiaire'],
  business: ['Agent', 'Préparateur personnel', 'Conseiller médias'],
  roots: ['Entraîneur formateur', 'Premier club', 'Idole / Mentor', 'Animal de compagnie'],
};

const cleanStr = (s, max = 120) => String(s || '').replace(/["\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function normalizeDob(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const mm = Number(m[2]), dd = Number(m[3]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${m[1]}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
    return '';
  }
  m = /^--(\d{1,2})-(\d{1,2})$/.exec(s) || /^(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const mm = Number(m[1]), dd = Number(m[2]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `--${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  return '';
}

const CIRCLE_KOP_PERSONALITIES = {
  supportive: 'Active on Kop: warm, proud, always encouraging and celebrating milestones.',
  playful: 'Active on Kop: playful, bantering, teasing with inside jokes while affectionate.',
  hype: 'Active on Kop: loud #1 supporter, hyping every goal, look, and big moment.',
  protective: 'Active on Kop: fiercely protective, defends the player against critics and media.',
  professional: 'Active on Kop: polished, composed, and strictly professional public voice.',
};

function circlePersonHandle(person) {
  const base = String(person?.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20);
  return base || 'inner_circle';
}

function normalizeCirclePerson(item, idx = 0, group = '') {
  if (!item || typeof item !== 'object') return null;
  const role = cleanStr(item.role, 60);
  const name = cleanStr(item.name, 120);
  const decoy = cleanStr(item.decoy, 120);
  const dob = normalizeDob(item.dob);
  const close = item.close !== undefined ? Boolean(item.close) : (group === 'family' || group === 'friends');
  const kopRaw = cleanStr(item.kopPersonality, 32);
  const kopPersonality = CIRCLE_KOP_PERSONALITIES[kopRaw] ? kopRaw : '';
  if (!role && !name && !decoy && !dob) return null;
  const id = cleanStr(item.id, 32) || `p${idx + 1}`;
  return {
    id,
    role,
    name,
    decoy,
    dob,
    close,
    protect: item.protect !== false,
    kopPersonality,
  };
}

function normalizePersona(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const presetRaw = cleanStr(src.preset, 40);
  const preset = presetRaw === 'custom' || PERSONA_PRESETS[presetRaw] ? presetRaw : '';

  const traits = {};
  for (const k of TRAIT_KEYS) {
    traits[k] = cleanStr(src.traits?.[k], 80);
  }

  const roots = {};
  for (const k of ROOT_KEYS) {
    roots[k] = cleanStr(src.roots?.[k], 120);
  }
  const rootProtect = {
    hometown: src.rootProtect?.hometown !== false,
    childhood: src.rootProtect?.childhood !== false,
    academy: src.rootProtect?.academy !== false,
  };

  const flavor = {};
  for (const k of FLAVOR_KEYS) {
    flavor[k] = cleanStr(src.flavor?.[k], 160);
  }

  const circle = {};
  for (const g of CIRCLE_GROUPS) {
    const list = Array.isArray(src.circle?.[g]) ? src.circle[g] : [];
    const out = [];
    for (const [i, item] of list.entries()) {
      if (out.length >= MAX_GROUP_PEOPLE) break;
      const p = normalizeCirclePerson(item, i, g);
      if (p) out.push(p);
    }
    circle[g] = out;
  }

  return {
    preset,
    playerDob: normalizeDob(src.playerDob),
    traits,
    roots,
    rootProtect,
    flavor,
    circle,
  };
}

function defaultStarterCircle(trFn = (s) => s) {
  const circle = {};
  for (const g of CIRCLE_GROUPS) {
    circle[g] = DEFAULT_CIRCLE_STARTERS[g].map((roleKey, idx) => ({
      id: `${g}_${idx + 1}`,
      role: trFn(roleKey),
      name: '',
      decoy: '',
      dob: '',
      close: g === 'family' || g === 'friends',
      protect: true,
    }));
  }
  return circle;
}

const AGENT_ROLE_RE = /\b(agent|agente|berater|procuratore|empres[aá]rio|representante)\b/i;

function extractPersonaAgent(persona) {
  const norm = normalizePersona(persona);
  for (const person of norm.circle.business) {
    if (person.name && AGENT_ROLE_RE.test(person.role || '')) {
      return { name: person.name, dob: person.dob || '', protect: person.protect !== false };
    }
  }
  return null;
}

function upsertPersonaAgent(persona, agentName = '') {
  const norm = normalizePersona(persona);
  const cleanName = cleanStr(agentName, 120);
  const list = [...(norm.circle.business || [])];
  const idx = list.findIndex((person) => AGENT_ROLE_RE.test(person.role || ''));
  if (idx >= 0) {
    list[idx] = { ...list[idx], name: cleanName };
  } else if (cleanName) {
    list.unshift({
      id: 'business_agent',
      role: 'Agent',
      name: cleanName,
      decoy: '',
      dob: '',
      close: false,
      protect: true,
    });
  }
  norm.circle.business = list.slice(0, MAX_GROUP_PEOPLE);
  return norm;
}

function personaFacts(persona, { includeDob = false } = {}) {
  const norm = normalizePersona(persona);
  const presetObj = PERSONA_PRESETS[norm.preset] || null;

  const traitsOut = {};
  for (const k of TRAIT_KEYS) {
    const v = norm.traits[k];
    if (!v) continue;
    traitsOut[k] = TRAIT_AI_LABELS[k]?.[v] || v;
  }

  const rootsOut = {};
  if (norm.roots.hometown) rootsOut.hometown = norm.roots.hometown;
  if (norm.roots.childhood) rootsOut.childhood = norm.roots.childhood;
  if (norm.roots.academy) rootsOut.academy = norm.roots.academy;
  if (norm.roots.heritage) rootsOut.heritage = norm.roots.heritage;

  const flavorOut = {};
  if (norm.flavor.signature) flavorOut.signature_habit = norm.flavor.signature;
  if (norm.flavor.hobby) flavorOut.hobby = norm.flavor.hobby;
  if (norm.flavor.favoriteDish) flavorOut.favorite_dish = norm.flavor.favoriteDish;
  if (norm.flavor.motto) flavorOut.motto = norm.flavor.motto;
  if (norm.flavor.turningPoint) flavorOut.turning_point = norm.flavor.turningPoint;
  if (norm.flavor.idol) flavorOut.football_idol = norm.flavor.idol;
  if (norm.flavor.dream) flavorOut.career_dream = norm.flavor.dream;

  const innerCircle = [];
  for (const g of CIRCLE_GROUPS) {
    for (const person of norm.circle[g]) {
      if (!person.name) continue;
      innerCircle.push({
        group: g,
        ...(person.role ? { role: person.role } : {}),
        name: person.name,
        ...(person.kopPersonality && CIRCLE_KOP_PERSONALITIES[person.kopPersonality]
          ? { kop_profile: CIRCLE_KOP_PERSONALITIES[person.kopPersonality] }
          : {}),
        ...(includeDob && person.dob ? { dob: person.dob } : {}),
      });
    }
  }

  const hasContent = Boolean(
    presetObj
    || (includeDob && norm.playerDob)
    || Object.keys(traitsOut).length
    || Object.keys(rootsOut).length
    || Object.keys(flavorOut).length
    || innerCircle.length,
  );
  if (!hasContent) return undefined;

  return {
    ...(presetObj ? { archetype: presetObj.aiDesc } : {}),
    ...(includeDob && norm.playerDob ? { player_dob: norm.playerDob } : {}),
    ...(Object.keys(traitsOut).length ? { traits: traitsOut } : {}),
    ...(Object.keys(rootsOut).length ? { roots: rootsOut } : {}),
    ...(Object.keys(flavorOut).length ? { flavor: flavorOut } : {}),
    ...(innerCircle.length ? { inner_circle: innerCircle.slice(0, 20) } : {}),
  };
}

const WB_START = '(?:^|[\\s,.;:/(-])';
const WB_END = '(?=$|[\\s,.;:/)-])';
const FEMALE_ROLE_RE = new RegExp(`${WB_START}(m[eè]re|mother|maman|mom|m[aã]e|madre|mutter|s[oœ]ur|sister|irm[aã]|sorella|schwester|conjointe?|femme|[eé]pouse|wife|girlfriend|namorada|esposa|moglie|fidanzata|frau|freundin|tante|aunt|tia|zia|grand-?m[eè]re|grandma|av[oó]|nonna|oma|fille|daughter|filha|figlia|tochter|cousine|prima)${WB_END}`, 'i');
const PET_ROLE_RE = new RegExp(`${WB_START}(animal(?: de compagnie)?|pet|chien|dog|chat|cat|cachorro|c[aã]o|gato|cane|gatto|hund|katze|mascota|bicho)${WB_END}`, 'i');
const CLUB_ROLE_RE = new RegExp(`${WB_START}(club|premier club|acad[eé]mie|academy|escolinha|[eé]cole|school|scuola|schule|clube|team)${WB_END}`, 'i');

function inferCircleEntryKind(group, role) {
  const r = String(role || '');
  if (PET_ROLE_RE.test(r)) return 'pet';
  if (CLUB_ROLE_RE.test(r)) return 'youthClub';
  if (FEMALE_ROLE_RE.test(r)) return 'femaleName';
  if (group === 'roots' && /mentor|coach|entraîneur|técnico|allenatore|trainer/i.test(r)) return 'fullName';
  return 'person';
}

function personaPrivacyEntries(persona) {
  const norm = normalizePersona(persona);
  const rp = norm.rootProtect || {};
  const roots = {
    hometown: rp.hometown !== false ? norm.roots.hometown : '',
    childhood: rp.childhood !== false ? norm.roots.childhood : '',
    academy: rp.academy !== false ? norm.roots.academy : '',
  };
  const people = [];
  for (const g of CIRCLE_GROUPS) {
    for (const [idx, person] of norm.circle[g].entries()) {
      if (!person.name || !person.protect) continue;
      people.push({
        group: g,
        idx,
        role: person.role,
        real: person.name,
        decoy: person.decoy,
        kind: inferCircleEntryKind(g, person.role),
      });
    }
  }
  return { roots, people };
}

module.exports = {
  CIRCLE_GROUPS,
  MAX_GROUP_PEOPLE,
  TRAIT_KEYS,
  ROOT_KEYS,
  FLAVOR_KEYS,
  PERSONA_PRESETS,
  TRAIT_AI_LABELS,
  DEFAULT_CIRCLE_STARTERS,
  CIRCLE_KOP_PERSONALITIES,
  circlePersonHandle,
  normalizeDob,
  normalizePersona,
  defaultStarterCircle,
  extractPersonaAgent,
  upsertPersonaAgent,
  personaFacts,
  personaPrivacyEntries,
};
