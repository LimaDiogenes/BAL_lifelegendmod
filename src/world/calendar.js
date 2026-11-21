'use strict';
// Calendrier complet jour par jour (Phase D) : file d'attente anti-spoilers lorsque le joueur joue
// plusieurs matchs d'affilée dans PES / Football Life avant de revenir dans LifeLegend.

const CALENDAR_EVENT_CATEGORIES = ['family', 'sponsor', 'training', 'media', 'charity', 'personal'];
const MAX_CUSTOM_EVENTS = 40;
const MAX_REVEALED_IDS = 180;
const MAX_HISTORY = 60;

const cleanStr = (s, max = 120) => String(s || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());

function addDaysIso(iso, n) {
  const base = isIsoDate(iso) ? iso : '2026-08-01';
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(aIso, bIso) {
  if (!isIsoDate(aIso) || !isIsoDate(bIso)) return 0;
  return Math.round((Date.parse(`${bIso}T12:00:00Z`) - Date.parse(`${aIso}T12:00:00Z`)) / 864e5);
}

function ensureCalendar(state, snapshot = state?.snapshot) {
  const fallbackDate = snapshot?.gameDate || state?.saveSnapshot?.gameDate || null;
  if (!state.calendar || typeof state.calendar !== 'object') {
    state.calendar = {
      simDate: fallbackDate,
      saveDate: state?.saveSnapshot?.gameDate || fallbackDate,
      pendingMatches: [],
      revealedMatchIds: [],
      customEvents: [],
      history: [],
    };
  }
  const cal = state.calendar;
  cal.pendingMatches ||= [];
  cal.revealedMatchIds ||= [];
  cal.customEvents ||= [];
  cal.history ||= [];
  if (!cal.simDate && fallbackDate) cal.simDate = fallbackDate;
  if (!cal.saveDate && (state?.saveSnapshot?.gameDate || fallbackDate)) {
    cal.saveDate = state?.saveSnapshot?.gameDate || fallbackDate;
  }
  if (isIsoDate(cal.simDate) && isIsoDate(cal.saveDate) && cal.simDate > cal.saveDate) {
    cal.simDate = cal.saveDate;
  }
  return cal;
}

function maskFixture(f) {
  return {
    ...f,
    played: false,
    score: null,
    me: null,
    goalTimeline: undefined,
    clubLineup: undefined,
  };
}

function computeStatsFromFixtures(fixtures) {
  const mine = fixtures.filter((f) => f.played && f.me);
  const sum = { apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, ratingSum: 0, rated: 0 };
  const byComp = new Map();
  for (const f of mine) {
    const m = f.me;
    sum.apps++;
    sum.starts += m.starter ? 1 : 0;
    sum.minutes += Number(m.minutes) || 0;
    sum.goals += Number(m.goals) || 0;
    sum.assists += Number(m.assists) || 0;
    if (Number.isFinite(m.rating)) {
      sum.ratingSum += m.rating;
      sum.rated++;
    }
    const cname = f.competition || 'Competition';
    const cur = byComp.get(cname) || { competition: cname, apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, ratingSum: 0, rated: 0 };
    cur.apps++;
    cur.starts += m.starter ? 1 : 0;
    cur.minutes += Number(m.minutes) || 0;
    cur.goals += Number(m.goals) || 0;
    cur.assists += Number(m.assists) || 0;
    if (Number.isFinite(m.rating)) { cur.ratingSum += m.rating; cur.rated++; }
    byComp.set(cname, cur);
  }
  const finish = ({ ratingSum, rated, ...rest }) => ({
    ...rest,
    avgRating: rated ? Math.round((ratingSum / rated) * 100) / 100 : null,
  });
  return {
    total: finish(sum),
    byCompetition: [...byComp.values()].map(finish),
  };
}

function maskFixturesAndNext(fixtures = [], simDate, pendingIds) {
  const masked = fixtures.map((f) => {
    const id = String(f.id ?? `${f.date}|${f.home}|${f.away}`);
    if (f.played && ((f.date && f.date > simDate) || pendingIds.has(id))) return maskFixture(f);
    return f;
  });
  const played = masked.filter((f) => f.played);
  const last = played[played.length - 1] || null;
  const next = masked.find((f) => !f.played && (!f.date || f.date >= simDate)) || null;
  return { masked, played, last, next };
}

function nextUnplayedMatch(snap, afterOrOnIso = null) {
  const candidates = [
    ...(snap?.fixtures || []),
    ...(snap?.nationalTeam?.fixtures || []),
    snap?.next,
    snap?.nationalTeam?.next,
  ].filter((f) => f && !f.played && isIsoDate(f.date) && (!afterOrOnIso || f.date >= afterOrOnIso));
  candidates.sort((a, b) => a.date.localeCompare(b.date));
  return candidates[0] || null;
}

function calendarBounds(state) {
  const cal = ensureCalendar(state, state.snapshot);
  const saveDate = cal.saveDate || state.saveSnapshot?.gameDate || state.snapshot?.gameDate || cal.simDate || null;
  const simDate = (isIsoDate(cal.simDate) && isIsoDate(saveDate) && cal.simDate > saveDate)
    ? saveDate
    : (cal.simDate || state.snapshot?.gameDate || saveDate);
  const fullSnap = state.saveSnapshot || state.snapshot;
  const pendingCount = cal.pendingMatches?.length || 0;
  const nextMatch = isIsoDate(simDate) ? nextUnplayedMatch(fullSnap, simDate) : null;

  if (isIsoDate(simDate) && isIsoDate(saveDate) && (simDate < saveDate || pendingCount > 0)) {
    const capDate = (nextMatch && isIsoDate(nextMatch.date) && nextMatch.date < saveDate) ? nextMatch.date : saveDate;
    if (capDate > simDate || pendingCount > 0) {
      return { mode: 'catchup', simDate, saveDate, maxDate: capDate, canAdvance: true, nextMatch, pendingCount };
    }
  }
  return { mode: 'synced', simDate, saveDate, maxDate: saveDate, canAdvance: false, nextMatch, pendingCount: 0 };
}

// Renvoie un instantané garanti sans spoilers jusqu'à `simDate`.
function buildVisibleSnapshot(realSnapshot, simDate, pendingMatches = []) {
  if (!realSnapshot || !isIsoDate(simDate)) return realSnapshot;
  if (!realSnapshot.gameDate || simDate === realSnapshot.gameDate) return realSnapshot;
  if (simDate > realSnapshot.gameDate) {
    return { ...realSnapshot, gameDate: simDate };
  }

  const pendingIds = new Set(pendingMatches.map((m) => String(m.id)));
  const club = maskFixturesAndNext(realSnapshot.fixtures || [], simDate, pendingIds);
  const stats = computeStatsFromFixtures(club.masked);

  let nationalTeam = realSnapshot.nationalTeam || null;
  if (nationalTeam && Array.isArray(nationalTeam.fixtures)) {
    const nt = maskFixturesAndNext(nationalTeam.fixtures, simDate, pendingIds);
    const ntStats = computeStatsFromFixtures(nt.masked).total;
    nationalTeam = {
      ...nationalTeam,
      fixtures: nt.masked,
      stats: ntStats,
      last: nt.last,
      next: nt.next,
    };
  }

  const hideLastTimeline = Boolean(realSnapshot.last?.date && realSnapshot.last.date > simDate);

  return {
    ...realSnapshot,
    gameDate: simDate,
    fixtures: club.masked,
    last: club.last,
    next: club.next,
    stats,
    nationalTeam,
    lastTimeline: hideLastTimeline ? null : realSnapshot.lastTimeline,
    leagueComplete: false,
  };
}

function extractQueueItems(realSnapshot, simDate, alreadyRevealedIds) {
  const revealed = new Set((alreadyRevealedIds || []).map(String));
  const items = [];
  const collect = (list, kind) => {
    for (const f of list || []) {
      if (!f?.played || !f.date) continue;
      const id = String(f.id ?? `${f.date}|${f.home}|${f.away}`);
      if (f.date >= simDate && f.date <= realSnapshot.gameDate && !revealed.has(id)) {
        items.push({ id, date: f.date, home: f.home, away: f.away, competition: f.competition || '', kind });
      }
    }
  };
  collect(realSnapshot.fixtures, 'club');
  collect(realSnapshot.nationalTeam?.fixtures, 'nt');
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return items;
}

function ingestSyncCalendar(state, realSnapshot, { calendarMode = 'basic' } = {}) {
  const cal = ensureCalendar(state, realSnapshot);
  cal.saveDate = realSnapshot.gameDate;

  const isFirst = !state.snapshot;
  if (isFirst || calendarMode !== 'full' || !cal.simDate || cal.simDate >= realSnapshot.gameDate) {
    cal.simDate = realSnapshot.gameDate;
    cal.pendingMatches = [];
    const seenIds = [...(realSnapshot.fixtures || []), ...(realSnapshot.nationalTeam?.fixtures || [])]
      .filter((f) => f?.played)
      .map((f) => String(f.id ?? `${f.date}|${f.home}|${f.away}`));
    cal.revealedMatchIds = [...new Set([...cal.revealedMatchIds, ...seenIds])].slice(-MAX_REVEALED_IDS);
    state.saveSnapshot = null;
    return { deferred: false, queuedCount: 0, visibleSnapshot: realSnapshot };
  }

  // Mode calendrier complet et le jeu a avancé au-delà de simDate : on met la suite en file d'attente sans spoiler !
  state.saveSnapshot = realSnapshot;
  cal.pendingMatches = extractQueueItems(realSnapshot, cal.simDate, cal.revealedMatchIds);
  const visible = buildVisibleSnapshot(realSnapshot, cal.simDate, cal.pendingMatches);
  state.snapshot = visible;
  return { deferred: true, queuedCount: cal.pendingMatches.length, visibleSnapshot: visible };
}

function collectEventDates(state, simDate, maxDate) {
  const dates = new Set();
  const add = (d) => {
    if (isIsoDate(d) && d > simDate && d <= maxDate) dates.add(d);
  };
  const cal = state.calendar;
  const fullSnap = state.saveSnapshot || state.snapshot;

  for (const m of cal.pendingMatches || []) add(m.date);
  for (const f of fullSnap?.fixtures || []) add(f.date);
  for (const f of fullSnap?.nationalTeam?.fixtures || []) add(f.date);
  for (const ob of state.lifeHub?.obligations || []) if (ob.status === 'pending') add(ob.dueDate);
  for (const ev of state.lifeEvents || []) add(ev.date);
  for (const ev of cal.customEvents || []) add(ev.date);
  for (const w of fullSnap?.windows || []) {
    add(w.open);
    add(w.eve);
    add(w.close);
  }
  return [...dates].sort();
}

function advanceCalendar(state, { mode = 'day', targetDate = null } = {}) {
  const cal = ensureCalendar(state, state.snapshot);
  const bounds = calendarBounds(state);
  if (!bounds.canAdvance) {
    throw new Error('Tu es déjà à jour avec ta sauvegarde : joue dans le jeu puis synchronise.');
  }
  if (!state.saveSnapshot && state.snapshot) state.saveSnapshot = state.snapshot;

  const prevDate = cal.simDate;
  const maxDate = bounds.maxDate || cal.saveDate;
  let nextDate;
  if (mode === 'catch_up') {
    nextDate = maxDate;
  } else if (mode === 'target' && isIsoDate(targetDate)) {
    nextDate = targetDate <= prevDate ? addDaysIso(prevDate, 1) : targetDate;
    if (nextDate > maxDate) nextDate = maxDate;
  } else if (mode === 'next_event') {
    const upcoming = collectEventDates(state, prevDate, maxDate);
    nextDate = upcoming[0] || maxDate;
  } else {
    nextDate = addDaysIso(prevDate, 1);
    if (nextDate > maxDate) nextDate = maxDate;
  }

  const popped = [];
  const remaining = [];
  for (const m of cal.pendingMatches) {
    if (m.date <= nextDate) popped.push(m);
    else remaining.push(m);
  }
  cal.pendingMatches = remaining;
  for (const m of popped) {
    const id = String(m.id);
    if (!cal.revealedMatchIds.includes(id)) cal.revealedMatchIds.push(id);
  }
  if (cal.revealedMatchIds.length > MAX_REVEALED_IDS) {
    cal.revealedMatchIds = cal.revealedMatchIds.slice(-MAX_REVEALED_IDS);
  }

  const fullSnap = state.saveSnapshot || state.snapshot;
  const poppedIds = new Set(popped.map((m) => String(m.id)));
  const revealedFixtures = [];
  for (const f of [...(fullSnap?.fixtures || []), ...(fullSnap?.nationalTeam?.fixtures || [])]) {
    const fid = String(f.id ?? `${f.date}|${f.home}|${f.away}`);
    if (poppedIds.has(fid)) revealedFixtures.push(f);
  }

  cal.simDate = nextDate;
  const visible = buildVisibleSnapshot(fullSnap, nextDate, cal.pendingMatches);
  state.snapshot = visible;

  const reachedSaveDate = Boolean(cal.saveDate && nextDate === cal.saveDate && cal.pendingMatches.length === 0);
  if (reachedSaveDate) state.saveSnapshot = null;

  const rhythm = dayRhythm(state, nextDate);
  cal.history.unshift({ date: nextDate, matches: revealedFixtures.length, rhythm });
  if (cal.history.length > MAX_HISTORY) cal.history.length = MAX_HISTORY;

  return {
    prevDate,
    nextDate,
    days: Math.max(0, daysBetween(prevDate, nextDate)),
    revealedFixtures,
    remainingQueued: cal.pendingMatches.length,
    reachedSaveDate,
  };
}

function flushCalendarToSave(state) {
  const cal = ensureCalendar(state, state.snapshot);
  if (!state.saveSnapshot && !cal.pendingMatches.length && (!cal.saveDate || cal.simDate === cal.saveDate)) {
    return { flushed: false };
  }
  const fullSnap = state.saveSnapshot || state.snapshot;
  const prevDate = cal.simDate;
  for (const m of cal.pendingMatches) {
    const id = String(m.id);
    if (!cal.revealedMatchIds.includes(id)) cal.revealedMatchIds.push(id);
  }
  const poppedIds = new Set(cal.pendingMatches.map((m) => String(m.id)));
  const revealedFixtures = (fullSnap?.fixtures || []).filter((f) => poppedIds.has(String(f.id ?? `${f.date}|${f.home}|${f.away}`)));
  cal.pendingMatches = [];
  cal.simDate = fullSnap?.gameDate || cal.saveDate || cal.simDate;
  cal.saveDate = cal.simDate;
  if (state.saveSnapshot) state.snapshot = state.saveSnapshot;
  state.saveSnapshot = null;
  return { flushed: true, prevDate, nextDate: cal.simDate, revealedFixtures };
}

function addCustomCalendarEvent(state, { date, title, category = 'personal', customCategory = '' } = {}, newId = () => `ev_${Date.now()}`) {
  const cal = ensureCalendar(state, state.snapshot);
  const d = String(date || '').trim();
  const cleanTitle = cleanStr(title, 100);
  if (!isIsoDate(d) || !cleanTitle) throw new Error('Date et titre requis.');
  if (cal.customEvents.length >= MAX_CUSTOM_EVENTS) cal.customEvents.shift();
  const rawCat = cleanStr(category, 40);
  const rawCustom = cleanStr(customCategory, 40);
  const builtIn = CALENDAR_EVENT_CATEGORIES.includes(rawCat);
  const cat = builtIn ? rawCat : 'custom';
  const customCat = !builtIn ? (rawCustom || (rawCat && rawCat !== '__custom__' && rawCat !== 'custom' ? rawCat : '')) : '';
  const ev = { id: newId(), date: d, title: cleanTitle, category: cat, ...(customCat ? { customCategory: customCat } : {}) };
  cal.customEvents.push(ev);
  cal.customEvents.sort((a, b) => a.date.localeCompare(b.date));
  return ev;
}

function removeCustomCalendarEvent(state, id) {
  const cal = ensureCalendar(state, state.snapshot);
  const idx = cal.customEvents.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error('Élément introuvable.');
  return cal.customEvents.splice(idx, 1)[0];
}

function dayRhythm(state, isoDate) {
  if (!isIsoDate(isoDate)) return 'training';
  const fullFixtures = (state.snapshot?.fixtures || []);
  const pending = state.calendar?.pendingMatches || [];
  const allMatchDates = [...fullFixtures, ...pending].map((f) => f.date).filter(Boolean);
  if (allMatchDates.includes(isoDate)) return 'matchday';
  if (state.snapshot?.nationalTeam?.fixtures?.some((f) => f.date === isoDate)) return 'international';
  const yesterday = addDaysIso(isoDate, -1);
  if (allMatchDates.includes(yesterday)) return 'recovery';
  const tomorrow = addDaysIso(isoDate, 1);
  if (allMatchDates.includes(tomorrow)) return 'match_prep';
  const dow = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 1) return 'day_off';
  return 'training';
}

function calendarAgenda(state, monthIso = null) {
  const cal = ensureCalendar(state, state.snapshot);
  const ref = isIsoDate(`${monthIso}-01`) ? monthIso : String(cal.simDate || state.snapshot?.gameDate || '2026-08-01').slice(0, 7);
  const simDate = cal.simDate || state.snapshot?.gameDate || '';
  const items = [];
  const inMonth = (d) => String(d || '').startsWith(ref);
  const queuedIds = new Set((cal.pendingMatches || []).map((m) => String(m.id)));

  for (const f of state.snapshot?.fixtures || []) {
    if (!inMonth(f.date)) continue;
    const id = String(f.id ?? `${f.date}|${f.home}|${f.away}`);
    const queued = queuedIds.has(id);
    items.push({
      date: f.date,
      kind: 'match',
      title: `${f.home} – ${f.away}`,
      detail: f.played && !queued && Array.isArray(f.score) ? `${f.score[0]}-${f.score[1]}` : (f.competition || ''),
      spoilerHidden: queued || !f.played,
    });
  }
  for (const m of cal.pendingMatches || []) {
    if (!inMonth(m.date)) continue;
    if (items.some((x) => x.kind === 'match' && x.date === m.date && x.title === `${m.home} – ${m.away}`)) continue;
    items.push({ date: m.date, kind: 'match', title: `${m.home} – ${m.away}`, detail: m.competition || '', spoilerHidden: true });
  }
  for (const ob of state.lifeHub?.obligations || []) {
    if (inMonth(ob.dueDate)) items.push({ date: ob.dueDate, kind: 'sponsor', title: ob.brand, detail: ob.status });
  }
  for (const ev of state.lifeEvents || []) {
    if (inMonth(ev.date)) items.push({ date: ev.date, kind: 'life', title: ev.title, detail: '' });
  }
  for (const ev of cal.customEvents || []) {
    if (inMonth(ev.date)) items.push({ id: ev.id, date: ev.date, kind: 'custom', category: ev.category, customCategory: ev.customCategory || '', title: ev.title, detail: '' });
  }
  for (const w of state.snapshot?.windows || []) {
    if (inMonth(w.open)) items.push({ date: w.open, kind: 'window', title: w.kind, detail: 'open' });
    if (inMonth(w.close)) items.push({ date: w.close, kind: 'window', title: w.kind, detail: 'close' });
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  return { month: ref, simDate, saveDate: cal.saveDate, items };
}

module.exports = {
  CALENDAR_EVENT_CATEGORIES,
  ensureCalendar,
  calendarBounds,
  buildVisibleSnapshot,
  ingestSyncCalendar,
  advanceCalendar,
  flushCalendarToSave,
  addCustomCalendarEvent,
  removeCustomCalendarEvent,
  dayRhythm,
  calendarAgenda,
  addDaysIso,
  daysBetween,
};
