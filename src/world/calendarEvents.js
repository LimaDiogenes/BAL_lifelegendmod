'use strict';
// Calendrier unifié : anniversaires (joueur, cercle intime, coéquipiers avec report hors jour de match),
// planification à l'avance d'activités & d'événements, événements système et décisions interactives.

const { OFF_PITCH_ACTIONS, ensureLifeHub, addLedger, pushGiftedSponsorCar } = require('./lifeHub');
const { normalizeDob } = require('./persona');
const { buildSceneAndReactions } = require('./lifeScenes');
const { activeHuddle, addMessage: addHuddleMessage } = require('./huddle');
const { seedPersonaEvents, personaDecision, eventChoicesToDecision } = require('./personaEvents');
const { mediaDecision } = require('./mediaOffers');
const { queueFollowUps } = require('./eventAftermath');
const { matchDates: lifeMatchDates, nextFreeDay } = require('./lifeGeo');

const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());

function addDaysIso(iso, n) {
  const base = isIsoDate(iso) ? iso : '2026-08-01';
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function hashStr(str) {
  let h = 2166136261;
  for (const c of String(str || '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

const SCHEDULED_ACTIVITY_TEMPLATES = [
  'team_dinner', 'inner_circle', 'charity_visit', 'sponsor_shoot',
  'media_feature', 'extra_training', 'recovery', 'vip_night',
];

function collectAllMatchDates(state) {
  return lifeMatchDates(state);
}

function parseMonthDay(dob) {
  const norm = normalizeDob(dob);
  if (!norm) return null;
  if (norm.startsWith('--')) {
    const [, m, d] = norm.split('-');
    return { birthYear: null, mm: m, dd: d };
  }
  const [y, m, d] = norm.split('-');
  return { birthYear: Number(y), mm: m, dd: d };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampDayForYear(year, mm, dd) {
  const maxD = daysInMonth(year, Number(mm));
  const d = Math.min(Number(dd), maxD);
  return `${year}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function deterministicSquadDob(player) {
  const key = String(player?.id || player?.name || '').trim();
  const h = hashStr(`squad_dob:${key}`);
  const month = (h % 12) + 1;
  const day = ((h >>> 4) % 28) + 1;
  return `--${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function squadBirthdayRoster(state, snapshot = state?.snapshot) {
  const squad = Array.isArray(snapshot?.squad) ? snapshot.squad : [];
  const overrides = state?.squadBirthdays || {};
  const playerName = String(snapshot?.player?.name || '').toLowerCase();
  const captainName = String(snapshot?.squadIntel?.captain?.name || '').toLowerCase();
  const huddlePlayers = new Set((activeHuddle(state)?.players || []).map((n) => String(n || '').toLowerCase()));
  const out = [];
  const seen = new Set();
  for (const p of squad) {
    if (!p?.name || p.me || String(p.name).toLowerCase() === playerName) continue;
    const key = p.id ? `sq_${p.id}` : `sq_${String(p.name).toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const manual = overrides[key] || overrides[p.name] || '';
    const dob = normalizeDob(manual) || deterministicSquadDob(p);
    const lowName = String(p.name).toLowerCase();
    const isClose = (captainName && lowName === captainName) || (out.filter((x) => x.isClose).length < 3 && huddlePlayers.has(lowName));
    out.push({
      key,
      id: p.id || null,
      name: p.name,
      pos: p.pos || '',
      age: Number.isFinite(p.age) ? p.age : null,
      dob,
      custom: Boolean(normalizeDob(manual)),
      isClose,
    });
  }
  return out;
}

function resolveBirthdayCelebrationDate(actualIso, bdayKey, matchDatesSet, shiftOverrides = {}) {
  if (!isIsoDate(actualIso) || !matchDatesSet || !matchDatesSet.has(actualIso)) {
    return { date: actualIso, shiftedBy: 0, clash: false };
  }
  const preferred = shiftOverrides[bdayKey] === 1 ? 1 : -1;
  const order = [preferred, -preferred, -2, 2];
  for (const offset of order) {
    const candidate = addDaysIso(actualIso, offset);
    if (!matchDatesSet.has(candidate)) {
      return { date: candidate, shiftedBy: offset, clash: true };
    }
  }
  return { date: addDaysIso(actualIso, preferred), shiftedBy: preferred, clash: true };
}

function birthdaysForYear(state, year, { includeAutoSquad = true } = {}) {
  const numYear = Number(year);
  if (!Number.isFinite(numYear) || numYear < 1900 || numYear > 2150) return [];
  const snapshot = state?.saveSnapshot || state?.snapshot;
  const matchDates = collectAllMatchDates(state);
  const overrides = state?.calendar?.birthdayShiftOverrides || {};
  const entries = [];

  // 1. Player birthday
  if (state?.persona?.playerDob) {
    const parts = parseMonthDay(state.persona.playerDob);
    if (parts) {
      const actualDate = clampDayForYear(numYear, parts.mm, parts.dd);
      const res = resolveBirthdayCelebrationDate(actualDate, 'self', matchDates, overrides);
      entries.push({
        id: `bday_self_${numYear}`,
        key: 'self',
        name: snapshot?.player?.name || state?.profile?.displayName || 'Player',
        role: 'player',
        closeness: 'self',
        actualDate,
        date: res.date,
        shiftedBy: res.shiftedBy,
        clash: res.clash,
        ageTurning: parts.birthYear ? Math.max(15, numYear - parts.birthYear) : (snapshot?.player?.profile?.age || null),
      });
    }
  }

  // 2. Inner circle birthdays
  const circle = state?.persona?.circle || {};
  for (const group of ['family', 'friends', 'business', 'roots']) { // pas d'anniversaire pour les antagonistes ni les organisations
    for (const [idx, person] of (Array.isArray(circle[group]) ? circle[group] : []).entries()) {
      if (!person?.name || !person?.dob) continue;
      const parts = parseMonthDay(person.dob);
      if (!parts) continue;
      const bKey = `circle:${group}:${person.id || idx}`;
      const actualDate = clampDayForYear(numYear, parts.mm, parts.dd);
      const res = resolveBirthdayCelebrationDate(actualDate, bKey, matchDates, overrides);
      entries.push({
        id: `bday_${bKey}_${numYear}`,
        key: bKey,
        name: person.name,
        role: person.role || group,
        group,
        closeness: person.close !== false && (person.close || group === 'family' || group === 'friends') ? 'close' : 'contact',
        actualDate,
        date: res.date,
        shiftedBy: res.shiftedBy,
        clash: res.clash,
        ageTurning: parts.birthYear ? Math.max(1, numYear - parts.birthYear) : null,
      });
    }
  }

  // 3. Squad birthdays
  if (includeAutoSquad && snapshot) {
    for (const sq of squadBirthdayRoster(state, snapshot)) {
      const parts = parseMonthDay(sq.dob);
      if (!parts) continue;
      const actualDate = clampDayForYear(numYear, parts.mm, parts.dd);
      const res = resolveBirthdayCelebrationDate(actualDate, sq.key, matchDates, overrides);
      entries.push({
        id: `bday_${sq.key}_${numYear}`,
        key: sq.key,
        name: sq.name,
        role: sq.pos || 'teammate',
        closeness: sq.isClose ? 'close_teammate' : 'teammate',
        actualDate,
        date: res.date,
        shiftedBy: res.shiftedBy,
        clash: res.clash,
        ageTurning: parts.birthYear ? Math.max(15, numYear - parts.birthYear) : sq.age,
      });
    }
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

function birthdaysInMonth(state, monthIso, opts = {}) {
  const year = Number(String(monthIso || '').slice(0, 4));
  if (!Number.isFinite(year)) return [];
  const years = [year];
  if (String(monthIso).endsWith('-12')) years.push(year + 1);
  if (String(monthIso).endsWith('-01')) years.push(year - 1);
  return years.flatMap((y) => birthdaysForYear(state, y, opts))
    .filter((b) => String(b.date).startsWith(monthIso));
}

function birthdaysOnDate(state, isoDate, opts = {}) {
  if (!isIsoDate(isoDate)) return [];
  const month = isoDate.slice(0, 7);
  return birthdaysInMonth(state, month, opts).filter((b) => b.date === isoDate);
}

function flipBirthdayShift(state, bdayKey) {
  if (!state.calendar) state.calendar = { customEvents: [], pendingMatches: [], revealedMatchIds: [], history: [] };
  state.calendar.birthdayShiftOverrides ||= {};
  const cur = state.calendar.birthdayShiftOverrides[bdayKey] === 1 ? 1 : -1;
  state.calendar.birthdayShiftOverrides[bdayKey] = cur === -1 ? 1 : -1;
  return state.calendar.birthdayShiftOverrides[bdayKey];
}

const SYSTEM_EVENT_TEMPLATES = [
  { key: 'squad_team_dinner', category: 'family', minOffset: 5, maxOffset: 14, stageMin: 'rookie' },
  { key: 'youth_charity_clinic', category: 'charity', minOffset: 6, maxOffset: 16, stageMin: 'rookie' },
  { key: 'vip_charity_gala', category: 'charity', minOffset: 8, maxOffset: 19, stageMin: 'established' },
];

function findFreeFutureDate(baseIso, minOff, maxOff, blockedSet) {
  for (let i = minOff; i <= maxOff; i++) {
    const d = addDaysIso(baseIso, i);
    if (!blockedSet.has(d)) return d;
  }
  return addDaysIso(baseIso, minOff);
}

function seedSystemEvents(state, snapshot, simDate, { eventMode = 'realistic', newId = () => `sysev_${Date.now()}` } = {}) {
  if (eventMode === 'games_only' || !isIsoDate(simDate) || !state?.calendar) return [];
  state.calendar.systemEvents ||= [];
  // Prune stale unresolved system events well in the past
  const cutoff = addDaysIso(simDate, -14);
  state.calendar.systemEvents = state.calendar.systemEvents.filter((e) => e.date >= cutoff);

  const matchDates = collectAllMatchDates(state);
  const occupied = new Set([...matchDates, ...state.calendar.systemEvents.map((e) => e.date)]);
  for (const ev of state.calendar.customEvents || []) occupied.add(ev.date);

  const stage = state?.lifeHub?.stage || 'rookie';
  const stageRank = { rookie: 0, rising: 1, established: 2, superstar: 3 }[stage] ?? 0;
  const added = [];

  // 1. Seed match_eve prep for notable upcoming fixtures within next 10 days (unplayed or pending)
  const upcomingMatches = [
    ...(snapshot?.fixtures || []).filter((f) => !f.played),
    ...(snapshot?.nationalTeam?.fixtures || []).filter((f) => !f.played),
    ...(state.calendar.pendingMatches || []),
  ].filter((f) => f?.date && f.date > simDate && f.date <= addDaysIso(simDate, 10));

  for (const m of upcomingMatches.slice(0, 2)) {
    const eve = addDaysIso(m.date, -1);
    if (eve <= simDate || matchDates.has(eve)) continue;
    const exists = state.calendar.systemEvents.some((e) => e.eventKey === 'match_eve' && e.date === eve);
    if (!exists) {
      const opp = m.away === snapshot?.club?.name ? m.home : (m.away || m.home || 'Matchday');
      const ev = {
        id: newId(),
        eventKey: 'match_eve',
        date: eve,
        category: 'training',
        title: opp,
        competition: m.competition || '',
        systemGenerated: true,
      };
      state.calendar.systemEvents.push(ev);
      added.push(ev);
      occupied.add(eve);
    }
  }

  // 2. Seed up to 3 lifestyle / community / media events ahead
  const activeCount = state.calendar.systemEvents.filter((e) => e.date >= simDate && e.eventKey !== 'match_eve').length;
  if (activeCount < 2) {
    const pool = SYSTEM_EVENT_TEMPLATES.filter((t) => ({ rookie: 0, rising: 1, established: 2, superstar: 3 }[t.stageMin] ?? 0) <= stageRank);
    const seed = hashStr(`${state.careerId || ''}|${simDate}|sysev`);
    for (let i = 0; i < pool.length && (activeCount + added.filter((x) => x.eventKey !== 'match_eve').length) < 3; i++) {
      const tpl = pool[(seed + i) % pool.length];
      if (state.calendar.systemEvents.some((e) => e.eventKey === tpl.key && e.date >= simDate)) continue;
      const date = findFreeFutureDate(simDate, tpl.minOffset, tpl.maxOffset, occupied);
      const ev = {
        id: newId(),
        eventKey: tpl.key,
        date,
        category: tpl.category,
        title: tpl.key,
        systemGenerated: true,
      };
      state.calendar.systemEvents.push(ev);
      added.push(ev);
      occupied.add(date);
    }
  }

  // 3. Ce que le joueur a écrit : passion, ville natale, idole, rêve, tournant, premier club (2.0)
  try { added.push(...seedPersonaEvents(state, snapshot, simDate, occupied, newId)); } catch { /* jamais bloquant */ }

  state.calendar.systemEvents.sort((a, b) => a.date.localeCompare(b.date));
  return added;
}

function decisionForBirthday(b, newId) {
  const base = {
    id: `dec_${b.id}`,
    kind: 'birthday',
    date: b.date,
    bdayKey: b.key,
    personName: b.name,
    role: b.role,
    closeness: b.closeness,
    actualDate: b.actualDate,
    shiftedBy: b.shiftedBy,
    ageTurning: b.ageTurning || null,
  };

  if (b.closeness === 'self') {
    return {
      ...base,
      choices: [
        { id: 'party_squad', cost: 4000, effects: { squad: 5, media: 3, manager: -1 }, followerDelta: 0.01, memory: `Hosted a squad & close-circle birthday dinner`, reqType: 'self_party',
          risk: { chance: 0.25, effects: { manager: -3, media: -3 }, memory: `Photos from his birthday party leaked online: a late night just before training`, followUp: 'fu_party_photos' } },
        { id: 'family_quiet', cost: 800, effects: { squad: 2, manager: 3, fans: 2 }, saveEffects: { formArrowDelta: 1 }, memory: `Celebrated his birthday quietly with family & focused on recovery`, reqType: 'self_quiet' },
        { id: 'fans_charity', cost: 5000, effects: { fans: 7, media: 5, sponsors: 3 }, followerDelta: 0.02, memory: `Celebrated his birthday by hosting a youth foundation initiative`, reqType: 'self_charity' },
      ],
    };
  }

  if (b.closeness === 'close' || b.closeness === 'close_teammate') {
    return {
      ...base,
      choices: [
        { id: 'attend_party', cost: 2000, effects: { squad: b.closeness === 'close_teammate' ? 6 : 3, fans: 2, media: 2, manager: -1 }, memory: `Attended ${b.name}'s birthday celebration`, reqType: 'close_party',
          risk: { chance: 0.15, effects: { manager: -2 }, memory: `Stayed out far too late at ${b.name}'s party and looked tired at training` } },
        { id: 'dinner_gift', cost: 1200, effects: { squad: 4, manager: 2 }, saveEffects: { affectionDelta: 1 }, memory: `Shared a quiet birthday dinner & thoughtful gift with ${b.name}`, reqType: 'close_dinner' },
        { id: 'call_deliver', cost: 400, effects: { squad: 2, manager: 2 }, memory: `Sent a heartfelt birthday gift & video call to ${b.name}`, reqType: 'close_call' },
      ],
    };
  }

  // Regular squad teammate or non-close contact -> 4 crisp message/gift options
  return {
    ...base,
    choices: [
      { id: 'huddle_wish', cost: 0, effects: { squad: 2 }, memory: `Sent a warm birthday message to ${b.name}`, reqType: 'gift_msg' },
      { id: 'thoughtful_gift', cost: 500, effects: { squad: 4 }, memory: `Picked up a thoughtful birthday gift for ${b.name}`, reqType: 'gift_small' },
      { id: 'luxury_gift', cost: 5000, effects: { squad: 6, media: 2 }, memory: `Gifted ${b.name} a luxury watch / collector sneakers for his birthday`, reqType: 'gift_lux' },
      { id: 'quick_wish', cost: 0, effects: { squad: 1, manager: 1 }, memory: `Wished ${b.name} happy birthday on the training pitch`, reqType: 'gift_quick' },
    ],
  };
}

// La décision d'un événement à soi, d'une activité planifiée ou d'un tournage ponctuel.
function customEventDecision(ev, state = null) {
  const id = `dec_cust_${ev.id}`;
  if (ev.kind === 'media') return mediaDecision(ev, state);
  let dec;
  if (ev.kind === 'onetime' && ev.oneTimeDeal) {
    dec = {
      id,
      kind: 'onetime',
      date: ev.date,
      title: ev.title,
      brand: ev.oneTimeDeal.brand,
      dealKey: ev.oneTimeDeal.dealKey,
      choices: [
        { id: 'complete_shoot', cost: 0, bonusCash: ev.oneTimeDeal.remainderFee || 0, effects: { media: ev.oneTimeDeal.mediaBoost || 5, fans: ev.oneTimeDeal.fanBoost || 4, sponsors: 4 }, followerDelta: ev.oneTimeDeal.followerBoost || 0.015, memory: `Completed headline campaign with ${ev.oneTimeDeal.brand}` },
        { id: 'quick_cut', cost: 0, bonusCash: Math.round((ev.oneTimeDeal.remainderFee || 0) * 0.7), effects: { media: 3, sponsors: 2, manager: 1 }, followerDelta: 0.008, memory: `Completed streamlined shoot with ${ev.oneTimeDeal.brand}` },
      ],
    };
  } else if (ev.aiChoices?.length) {
    dec = { id, kind: 'scheduled', activityId: ev.activityId || null, category: ev.category || 'personal', date: ev.date, title: ev.title, people: (ev.people || []).map((p) => p.name), choices: eventChoicesToDecision(ev) };
  } else if (ev.kind === 'scheduled' || ev.category) {
    const tpl = ev.activityId ? OFF_PITCH_ACTIONS.find((a) => a.id === ev.activityId) : null;
    dec = {
      id,
      kind: 'scheduled',
      activityId: ev.activityId || null,
      category: ev.category || 'personal',
      date: ev.date,
      title: ev.title,
      choices: [
        { id: 'do_planned', cost: tpl?.cost || ev.cost || 0, effects: tpl?.effects ? { ...tpl.effects } : { fans: 3, media: 2, squad: 2 }, saveEffects: tpl?.saveEffects || null, memory: `Completed scheduled plan: ${ev.title}` },
        { id: 'keep_light', cost: 0, effects: { manager: 1, squad: 1 }, memory: `Kept scheduled ${ev.title} short and returned early` },
        { id: 'reschedule_skip', cost: 0, effects: { manager: 2, fans: -1 }, memory: `Postponed ${ev.title} to prioritize training` },
      ],
    };
  }
  return dec || null;
}

function collectDueDecisions(state, snapshot, targetDate, { eventMode = 'realistic', newId = () => `dec_${Date.now()}` } = {}) {
  if (eventMode === 'games_only' || !isIsoDate(targetDate) || !state?.calendar) return [];
  const cal = state.calendar;
  cal.pendingDecisions ||= [];
  cal.resolvedDecisionIds ||= [];
  const resolved = new Set(cal.resolvedDecisionIds);
  const existing = new Set(cal.pendingDecisions.map((d) => d.id));
  const added = [];

  // 1. Birthdays due today
  for (const b of birthdaysOnDate(state, targetDate, { includeAutoSquad: true })) {
    const id = `dec_${b.id}`;
    if (resolved.has(id) || existing.has(id)) continue;
    const dec = decisionForBirthday(b, newId);
    cal.pendingDecisions.push(dec);
    added.push(dec);
    existing.add(id);
  }

  // 2. System events due today (never on a match day: the app moves them to the next free day; his own events may)
  const busyDays = lifeMatchDates(state);
  for (const sys of cal.systemEvents || []) {
    if (sys.date !== targetDate) continue;
    if (sys.eventKey !== 'match_eve' && busyDays.has(sys.date)) { sys.date = nextFreeDay(state, sys.date, busyDays); continue; }
    const id = `dec_sys_${sys.id}`;
    if (resolved.has(id) || existing.has(id)) continue;
    let dec;
    if (FOLLOW_UPS[sys.eventKey]) {
      dec = { id, kind: 'follow_up', eventKey: sys.eventKey, category: 'media', date: sys.date, title: sys.title, choices: FOLLOW_UPS[sys.eventKey](sys.title) };
    } else if (sys.eventKey === 'first_club_return' || String(sys.eventKey || '').startsWith('persona_')) {
      dec = personaDecision(sys);
    } else if (sys.eventKey === 'match_eve') {
      dec = {
        id,
        kind: 'match_eve',
        eventKey: 'match_eve',
        date: sys.date,
        title: sys.title,
        competition: sys.competition || '',
        choices: [
          { id: 'extra_drills', cost: 0, effects: { manager: 3, media: 1 }, saveEffects: { formArrowDelta: 1, affectionDelta: 1 }, memory: `Put in extra match-eve finishing & video prep before ${sys.title}` },
          { id: 'film_recovery', cost: 0, effects: { manager: 2, squad: 2 }, saveEffects: { affectionDelta: 1 }, memory: `Kept a calm match-eve tactical routine ahead of ${sys.title}` },
          { id: 'unwind_family', cost: 0, effects: { squad: 2, fans: 2 }, memory: `Unwound away from the noise on the eve of ${sys.title}` },
        ],
      };
    } else {
      dec = {
        id,
        kind: 'system_event',
        eventKey: sys.eventKey,
        category: sys.category,
        date: sys.date,
        title: sys.title,
        choices: [
          { id: 'go_all_in', cost: sys.eventKey === 'vip_charity_gala' ? 6000 : sys.eventKey === 'squad_team_dinner' ? 2500 : 0, effects: { fans: 5, media: 5, squad: 2, manager: -1 }, followerDelta: 0.012, memory: `Made a strong impression at ${sys.eventKey.replace(/_/g, ' ')}`,
            risk: { chance: 0.22, effects: { media: -4, manager: -2 }, memory: `An offhand remark he made at ${sys.eventKey.replace(/_/g, ' ')} went viral for the wrong reasons`, followUp: 'fu_viral_quote' } },
          { id: 'keep_balanced', cost: 0, effects: { media: 2, sponsors: 2, manager: 1 }, memory: `Attended ${sys.eventKey.replace(/_/g, ' ')} briefly and stayed focused on training` },
          { id: 'skip_focus', cost: 0, effects: { manager: 3, media: -2 }, saveEffects: { affectionDelta: 1 }, memory: `Skipped ${sys.eventKey.replace(/_/g, ' ')} to focus exclusively on pitch preparation` },
        ],
      };
    }
    cal.pendingDecisions.push(dec);
    added.push(dec);
    existing.add(id);
  }

  // 2b. Partner obligations due (or overdue) today
  const dueOwn = collectObligationDecisions(state, targetDate);
  for (const d of dueOwn) existing.add(d.id); // sinon la section 3 l'ajoutait une deuxième fois
  added.push(...dueOwn);

  // 3. Custom / scheduled activities / one-time shoots due today
  for (const ev of cal.customEvents || []) {
    if (ev.date !== targetDate) continue;
    const id = `dec_cust_${ev.id}`;
    if (resolved.has(id) || existing.has(id)) continue;
    const dec = customEventDecision(ev, state);
    if (dec) {
      cal.pendingDecisions.push(dec);
      added.push(dec);
      existing.add(id);
    }
  }

  // Cap unresolved queue cleanly at 8
  if (cal.pendingDecisions.length > 8) {
    cal.pendingDecisions = cal.pendingDecisions.slice(-8);
  }
  return added;
}

// Conséquences qui reviennent quelques jours plus tard (2.0) : une nouvelle décision. Se taire n'est jamais puni.
const FOLLOW_UPS = {
  fu_party_photos: () => [
    { id: 'fu_apologise', cost: 0, effects: { manager: 3, media: 1, fans: -1 }, memory: 'Apologised to the club and the fans for the late-night party photos' },
    { id: 'fu_laugh_off', cost: 0, effects: { fans: 3, media: -1 }, memory: 'Laughed off the party photos on social media',
      risk: { chance: 0.3, effects: { manager: -2 }, memory: 'The coach did not find the joke about the party photos funny' } },
    { id: 'fu_stay_silent', cost: 0, effects: {}, memory: 'Said nothing and let the party-photo story die down' },
  ],
  fu_viral_quote: () => [
    { id: 'fu_clarify', cost: 0, effects: { media: 3, manager: 1 }, memory: 'Clarified his viral remark in a short statement' },
    { id: 'fu_double_down', cost: 0, effects: { fans: 4, media: 2 }, followerDelta: 0.01, memory: 'Doubled down on his viral remark',
      risk: { chance: 0.35, effects: { media: -4, sponsors: -3 }, memory: 'Doubling down on the viral remark worried his sponsors' } },
    { id: 'fu_stay_silent', cost: 0, effects: {}, memory: 'Ignored the viral remark until the next story came along' },
  ],
};

// Tirage stable (même décision, même choix : même issue, même après un rechargement).
function riskRoll(key) {
  let h = 2166136261;
  for (const c of String(key)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return (h % 10000) / 10000;
}

function applyMeters(hub, effects) {
  for (const [k, delta] of Object.entries(effects || {})) {
    if (hub.meters[k] !== undefined && delta) hub.meters[k] = Math.max(0, Math.min(100, Math.round((hub.meters[k] ?? 50) + delta)));
  }
}

// Obligations des partenaires (2.0) : à leur date, elles deviennent une décision du calendrier, avec de vrais choix
// (au lieu d'un bouton « Honorer »). Y aller n'est jamais puni ; décaler coûte un peu de confiance (une fois) ; ne pas
// y aller en coûte davantage, et trois absences font partir le partenaire. Valable dans tous les modes de calendrier.
function obligationDecision(ob) {
  const what = String(ob.kind || 'brand_appearance').replace(/_/g, ' ');
  const reward = Math.max(0, Math.round(Number(ob.rewardCash) || 0));
  const choices = [
    { id: 'ob_all_in', cost: 0, bonusCash: Math.round((reward * 1.25) / 500) * 500, effects: { sponsors: 6, media: 3, fans: 2 }, followerDelta: 0.006, memory: `Went all in at the ${ob.brand} ${what}` },
    { id: 'ob_standard', cost: 0, bonusCash: reward, effects: { sponsors: 3, media: 1 }, memory: `Did the ${ob.brand} ${what}, professional and on time` },
  ];
  if (!ob.rescheduled) choices.push({ id: 'ob_reschedule', cost: 0, effects: { sponsors: -1 }, memory: `Asked ${ob.brand} to move the ${what} to another day` });
  choices.push({ id: 'ob_skip', cost: 0, effects: { sponsors: -5 }, memory: `Did not show up at the ${ob.brand} ${what}` });
  return { id: `dec_ob_${ob.id}_${ob.dueDate}`, kind: 'obligation', obligationId: ob.id, obligationKind: ob.kind, brand: ob.brand, category: 'sponsor', date: ob.dueDate, title: ob.brand, choices };
}

function collectObligationDecisions(state, targetDate) {
  const hub = state?.lifeHub;
  if (!hub || !isIsoDate(targetDate)) return [];
  const cal = (state.calendar ||= {});
  cal.pendingDecisions ||= [];
  cal.resolvedDecisionIds ||= [];
  cal.pendingDecisions = cal.pendingDecisions.filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i); // doublons d'avant 2.0
  // une obligation réglée autrement (expirée, partenaire parti) n'attend plus de réponse
  const live = new Set((hub.obligations || []).filter((o) => o.status === 'pending').map((o) => o.id));
  cal.pendingDecisions = cal.pendingDecisions.filter((d) => d.kind !== 'obligation' || live.has(d.obligationId));
  const resolved = new Set(cal.resolvedDecisionIds);
  const existing = new Set(cal.pendingDecisions.map((d) => d.id));
  const added = [];
  const busyDays = lifeMatchDates(state);
  for (const ob of hub.obligations || []) {
    if (ob.status !== 'pending' || !isIsoDate(ob.dueDate) || ob.dueDate > targetDate) continue;
    // une obligation de partenaire n'arrive jamais un jour de match (2.0)
    if (busyDays.has(ob.dueDate)) { ob.dueDate = nextFreeDay(state, ob.dueDate, busyDays); if (ob.dueDate > targetDate) continue; }
    const dec = obligationDecision(ob);
    if (resolved.has(dec.id) || existing.has(dec.id)) continue;
    cal.pendingDecisions.push(dec);
    added.push(dec);
    existing.add(dec.id);
  }
  // ses propres événements et activités planifiées aussi (2.0), dans tous les modes : à leur date, ou jusqu'à 7 jours après
  const oldest = addDaysIso(targetDate, -7);
  for (const ev of cal.customEvents || []) {
    if (!isIsoDate(ev.date) || ev.date > targetDate || ev.date < oldest) continue;
    // une interview proposée par l'agent non plus ; ses propres événements, oui (dîner après le match…)
    if (ev.mediaOfferId && busyDays.has(ev.date)) { ev.date = nextFreeDay(state, ev.date, busyDays); if (ev.date > targetDate) continue; }
    const id = `dec_cust_${ev.id}`;
    if (resolved.has(id) || existing.has(id)) continue;
    const dec = customEventDecision(ev, state);
    if (!dec) continue;
    cal.pendingDecisions.push(dec);
    added.push(dec);
    existing.add(id);
  }
  return added;
}

function firstFreeDate(fromIso, minOff, maxOff, blocked, notAfter) {
  for (let i = minOff; i <= maxOff; i += 1) {
    const d = addDaysIso(fromIso, i);
    if (notAfter && d > notAfter) break;
    if (!blocked.has(d)) return d;
  }
  return null;
}

function applyObligationChoice(state, hub, dec, choice, today, { language = 'en', newId } = {}) {
  const ob = (hub.obligations || []).find((o) => o.id === dec.obligationId);
  if (!ob || ob.status !== 'pending') return {};
  if (choice.id === 'ob_all_in' || choice.id === 'ob_standard') {
    ob.status = 'done';
    ob.doneHow = choice.id;
    try {
      buildSceneAndReactions(state, state.snapshot, {
        kind: 'obligation', refId: ob.id, obligationKind: ob.kind, sponsorCategory: ob.category || '', category: 'sponsor', brand: ob.brand,
        deltas: { meters: choice.effects || {}, bonusCash: choice.bonusCash || 0 },
      }, { language, newId });
    } catch { /* la scène est un bonus */ }
    return {};
  }
  if (choice.id === 'ob_reschedule') {
    ob.originalDue ||= ob.dueDate;
    const next = firstFreeDate(today || ob.dueDate, 3, 10, collectAllMatchDates(state), addDaysIso(ob.originalDue, 14)) || addDaysIso(today || ob.dueDate, 3);
    ob.dueDate = next;
    ob.rescheduled = true;
    return { rescheduledTo: next };
  }
  if (choice.id === 'ob_skip') {
    ob.status = 'skipped';
    const sp = (hub.sponsors || []).find((s) => s.id === ob.sponsorId);
    if (sp && !sp.linkedBootDeal) {
      sp.skippedObligations = (Number(sp.skippedObligations) || 0) + 1;
      if (sp.skippedObligations >= 3) {
        hub.sponsors = hub.sponsors.filter((s) => s !== sp);
        hub.obligations = hub.obligations.filter((o) => o.sponsorId !== sp.id || o.status !== 'pending');
        hub.recentEvents ||= [];
        hub.recentEvents.unshift({ date: today, kind: 'sponsor', text: `${sp.brand} ended the partnership after three missed commitments` });
        return { contractEnded: sp.brand };
      }
    }
  }
  return {};
}

function resolveCalendarDecision(state, decisionId, choiceId, gameDate = '', { language = 'en', newId = () => `res_${Date.now()}` } = {}) {
  const cal = state?.calendar;
  if (!cal || !Array.isArray(cal.pendingDecisions)) throw new Error('Décision introuvable.');
  const idx = cal.pendingDecisions.findIndex((d) => d.id === decisionId);
  if (idx < 0) throw new Error('Décision introuvable.');
  const dec = cal.pendingDecisions[idx];
  const choice = (dec.choices || []).find((c) => c.id === choiceId);
  if (!choice) throw new Error('Choix inconnu.');

  const hub = ensureLifeHub(state, state.snapshot);
  const cost = Math.max(0, Math.round(Number(choice.cost) || 0));
  if (cost > 0 && (hub.cash || 0) < cost) throw new Error('Fonds insuffisants.');

  const today = gameDate || dec.date || state.snapshot?.gameDate || '';
  if (cost > 0) {
    hub.cash -= cost;
    addLedger(hub, { date: today, amount: -cost, kind: 'expense', label: choice.memory || dec.title || dec.personName });
  }
  if (choice.bonusCash > 0) {
    hub.cash += Math.round(choice.bonusCash);
    addLedger(hub, { date: today, amount: Math.round(choice.bonusCash), kind: 'sponsor', label: dec.brand || dec.title });
  }
  for (const [k, delta] of Object.entries(choice.effects || {})) {
    if (hub.meters[k] !== undefined && delta) {
      hub.meters[k] = Math.max(0, Math.min(100, Math.round((hub.meters[k] ?? 50) + delta)));
    }
  }
  if (choice.followerDelta && state.profile) {
    state.profile.followers = Math.max(100, Math.round((state.profile.followers || 4200) * (1 + choice.followerDelta)));
  }
  // choix risqué : parfois, ça se retourne contre lui (pénalité, souvenir que la presse et les supporters reprennent,
  // et parfois une suite quelques jours plus tard)
  let backfire = null;
  if (choice.risk && riskRoll(`${decisionId}|${choiceId}|${state.careerId || ''}`) < (choice.risk.chance || 0)) {
    applyMeters(hub, choice.risk.effects);
    backfire = { text: choice.risk.memory, followUp: choice.risk.followUp || null };
    hub.recentEvents ||= [];
    hub.recentEvents.unshift({ date: today, kind: 'backfire', text: choice.risk.memory });
    if (choice.risk.followUp && FOLLOW_UPS[choice.risk.followUp]) {
      cal.systemEvents ||= [];
      const d = new Date(`${(today || '2026-08-01').slice(0, 10)}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 2 + Math.floor(riskRoll(`${decisionId}|days`) * 3));
      cal.systemEvents.push({ id: newId(), eventKey: choice.risk.followUp, date: nextFreeDay(state, d.toISOString().slice(0, 10)), category: 'media', title: dec.title || dec.personName || '', systemGenerated: true, origin: decisionId });
    }
  }
  state.lastDecisionOutcome = backfire ? { decisionId, backfire: true, text: backfire.text } : { decisionId, backfire: false };
  if (dec.kind === 'obligation') Object.assign(state.lastDecisionOutcome, applyObligationChoice(state, hub, dec, choice, today, { language, newId }));
  // ses événements, ceux tirés de son profil et les interviews : une scène et des réactions tout de suite, des messages
  // de ceux qui étaient là un ou deux jours après (2.0)
  if (['scheduled', 'persona_event', 'media_event'].includes(dec.kind) && choiceId !== 'reschedule_skip') {
    const ev = (cal.customEvents || []).find((e) => `dec_cust_${e.id}` === decisionId);
    const people = ev?.people || [];
    const choiceKind = (ev?.aiChoices || []).find((c) => c.id === choiceId)?.kind || choiceId;
    try {
      buildSceneAndReactions(state, state.snapshot, { kind: 'calendar', decKind: dec.kind, refId: decisionId, title: dec.title, eventKey: dec.eventKey, mediaKind: dec.mediaKind, category: dec.category || 'life', people, choiceKind, date: today }, { language, newId });
    } catch { /* la scène est un bonus */ }
    try { queueFollowUps(state, { title: dec.title, people, decisionId }, today); } catch { /* idem */ }
  }
  if (dec.kind === 'club_ask') {
    try { require('./clubLife').afterClubAsk(state, dec, choiceId, today, { language, newId }); } catch { /* bonus */ }
  }
  if (dec.kind === 'car_gift' && choice.catId) {
    const sp = (hub.sponsors || []).find((s) => s.id === dec.sponsorId) || { id: dec.sponsorId, brand: dec.brand };
    pushGiftedSponsorCar(state, hub, sp, choice.catId, dec.reason || 'annual', today, newId, choice.label || '');
  }
  if (choice.saveEffects) {
    const p = (hub.pendingSaveEffects ||= { affectionDelta: 0, formArrowDelta: 0, reasons: [] });
    if (choice.saveEffects.affectionDelta) p.affectionDelta = Math.max(-8, Math.min(8, (p.affectionDelta || 0) + choice.saveEffects.affectionDelta));
    if (choice.saveEffects.formArrowDelta) p.formArrowDelta = Math.max(-1, Math.min(1, (p.formArrowDelta || 0) + choice.saveEffects.formArrowDelta));
  }

  cal.pendingDecisions.splice(idx, 1);
  cal.resolvedDecisionIds ||= [];
  if (!cal.resolvedDecisionIds.includes(decisionId)) cal.resolvedDecisionIds.push(decisionId);
  if (cal.resolvedDecisionIds.length > 180) cal.resolvedDecisionIds = cal.resolvedDecisionIds.slice(-180);
  if (choiceId === 'reschedule_skip' && decisionId.startsWith('dec_cust_') && Array.isArray(cal.customEvents)) {
    const custId = decisionId.slice('dec_cust_'.length);
    cal.customEvents = cal.customEvents.filter((e) => e.id !== custId);
  }
  if (choiceId === 'skip_focus' && decisionId.startsWith('dec_sys_') && Array.isArray(cal.systemEvents)) {
    const sysId = decisionId.slice('dec_sys_'.length);
    cal.systemEvents = cal.systemEvents.filter((e) => e.id !== sysId);
  }

  hub.recentEvents ||= [];
  hub.recentEvents.unshift({ date: today, kind: dec.kind || 'life', text: choice.memory });
  if (hub.recentEvents.length > 25) hub.recentEvents.length = 25;

  // Immediate social resonance (Huddle wish on birthdays, Kop/scene for big shoots & parties)
  if (dec.kind === 'birthday' && dec.personName) {
    const group = activeHuddle(state);
    if (group) {
      if (dec.closeness === 'self') {
        const sender = group.players?.[0];
        if (sender) {
          addHuddleMessage(group, {
            who: 'them',
            from: sender,
            role: 'player',
            gameDate: today,
            reactions: [['🎂', 5], ['🔥', 3]],
            text: language === 'fr' ? `Joyeux anniversaire chef 🎂🥂 !`
              : language === 'pt' ? `Feliz aniversário craque 🎂🥂!`
                : language === 'es' ? `¡Feliz cumpleaños crack 🎂🥂!`
                  : language === 'it' ? `Buon compleanno campione 🎂🥂!`
                    : language === 'de' ? `Alles Gute zum Geburtstag 🎂🥂!`
                      : `Happy birthday legend 🎂🥂!`,
          });
        }
      } else if (dec.closeness === 'teammate' || dec.closeness === 'close_teammate') {
        addHuddleMessage(group, {
          who: 'me',
          gameDate: today,
          reactions: choice.id === 'luxury_gift' ? [['🔥', 6], ['🤩', 4]] : [['❤️', 4], ['😂', 2]],
          text: language === 'fr' ? `Joyeux anniversaire ${dec.personName} ! 🎂`
            : language === 'pt' ? `Feliz aniversário, ${dec.personName}! 🎂`
              : language === 'es' ? `¡Feliz cumpleaños, ${dec.personName}! 🎂`
                : language === 'it' ? `Tanti auguri ${dec.personName}! 🎂`
                  : language === 'de' ? `Alles Gute, ${dec.personName}! 🎂`
                    : `Happy birthday ${dec.personName}! 🎂`,
        });
      }
    }
  } else if (dec.kind === 'onetime' && (choice.id === 'complete_shoot' || choice.id === 'quick_cut')) {
    try {
      const sp = (state.lifeHub?.sponsors || []).find((s) => String(s?.brand || '').toLowerCase() === String(dec.brand || dec.title || '').toLowerCase());
      buildSceneAndReactions(state, state.snapshot, {
        kind: 'obligation',
        refId: dec.dealKey || dec.id,
        obligationKind: dec.dealKey || 'onetime_shoot',
        sponsorCategory: sp?.categories?.[0] || sp?.category || '',
        category: 'sponsor',
        brand: dec.brand || dec.title,
        deltas: { meters: choice.effects || {}, bonusCash: choice.bonusCash || 0 },
      }, { language, newId });
    } catch { /* ignore */ }
  }

  return { decision: dec, choice, memoryLine: choice.memory, backfire };
}

function scheduleOffPitchActivity(state, { date, activityId, title = '', companion = '', people = [] } = {}, newId = () => `ev_${Date.now()}`) {
  const cleanDate = String(date || '').trim();
  if (!isIsoDate(cleanDate)) throw new Error('Date et titre requis.');
  const act = OFF_PITCH_ACTIONS.find((a) => a.id === activityId);
  if (!act && !String(title || '').trim()) throw new Error('Date et titre requis.');
  state.calendar ||= { customEvents: [], pendingMatches: [], revealedMatchIds: [], history: [] };
  state.calendar.customEvents ||= [];
  const ev = {
    id: newId(),
    date: cleanDate,
    title: String(title || '').trim().slice(0, 100) || (act ? act.id.replace(/_/g, ' ') : 'Activity'),
    category: act ? (activityId === 'sponsor_shoot' ? 'sponsor' : activityId === 'charity_visit' ? 'charity' : activityId === 'extra_training' || activityId === 'recovery' ? 'training' : activityId === 'media_feature' ? 'media' : activityId === 'inner_circle' || activityId === 'team_dinner' ? 'family' : 'personal') : 'personal',
    kind: 'scheduled',
    ...(act ? { activityId: act.id, cost: act.cost || 0 } : {}),
    ...(companion ? { companion: String(companion).trim().slice(0, 60) } : {}),
  };
  const guests = (Array.isArray(people) ? people : []).map((p) => ({ name: String(p?.name || '').trim().slice(0, 60), role: String(p?.role || '').trim().slice(0, 40) })).filter((p) => p.name).slice(0, 10);
  if (guests.length) ev.people = guests;
  state.calendar.customEvents.push(ev);
  state.calendar.customEvents.sort((a, b) => a.date.localeCompare(b.date));
  return ev;
}

module.exports = {
  SCHEDULED_ACTIVITY_TEMPLATES,
  collectAllMatchDates,
  squadBirthdayRoster,
  resolveBirthdayCelebrationDate,
  birthdaysForYear,
  birthdaysInMonth,
  birthdaysOnDate,
  flipBirthdayShift,
  seedSystemEvents,
  collectDueDecisions,
  collectObligationDecisions,
  resolveCalendarDecision,
  scheduleOffPitchActivity,
};
