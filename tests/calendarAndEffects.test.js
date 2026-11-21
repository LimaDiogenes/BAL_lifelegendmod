'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Store } = require('../src/store');
const { PLAYER_REC } = require('../src/save/blReader');
const { readPlayerProfile, ABILITIES } = require('../src/save/playerProfile');
const {
  lifeEffectsInData,
  AFFECTION_REL,
  FORM_ARROW_REL,
  UNAVAILABLE_REL,
} = require('../src/save/lifeEffectsWrite');
const {
  ingestSyncCalendar,
  calendarBounds,
  advanceCalendar,
  flushCalendarToSave,
  maskCareerForDate,
  addCustomCalendarEvent,
  removeCustomCalendarEvent,
  dayRhythm,
  calendarAgenda,
} = require('../src/world/calendar');
const world = require('../src/world/world');

const tmpDirs = [];
function makeTmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'll-cal-fx-test-'));
  tmpDirs.push(d);
  return d;
}

after(() => {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function makeSnap(gameDate, fixtures, { ntFixtures = [], windows = [], lastTimeline = null } = {}) {
  const playedClub = fixtures.filter((f) => f.played);
  const lastClub = playedClub[playedClub.length - 1] || null;
  const nextClub = fixtures.find((f) => !f.played && f.date >= gameDate) || null;
  const totals = playedClub.reduce((acc, f) => ({
    apps: acc.apps + 1,
    starts: acc.starts + 1,
    minutes: acc.minutes + (f.me?.minutes || 90),
    goals: acc.goals + (f.me?.goals || 0),
    assists: acc.assists + (f.me?.assists || 0),
  }), { apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, avgRating: 7.5 });

  const playedNt = ntFixtures.filter((f) => f.played);
  return {
    gameDate,
    season: '2026-2027',
    player: { id: 42, name: 'Lucas Silva', nationality: 'Brazil', salary: 500000, offers: [], interests: [], profile: { age: 21, marketValue: 2500000, abilities: {} } },
    club: { ref: '10', name: 'Sporting Club', short: 'SPC', stadium: 'Stade Parc' },
    league: { id: 1, name: 'Ligue 1' },
    stats: { total: totals, byCompetition: [] },
    squad: [{ name: 'Marc Costa', pos: 'FW' }],
    fixtures,
    last: lastClub,
    next: nextClub,
    nationalTeam: ntFixtures.length ? {
      name: 'Brazil',
      fixtures: ntFixtures,
      stats: { apps: playedNt.length, starts: playedNt.length, minutes: playedNt.length * 90, goals: playedNt.reduce((s, f) => s + (f.me?.goals || 0), 0), assists: 0, avgRating: 7.2 },
      last: playedNt[playedNt.length - 1] || null,
      next: ntFixtures.find((f) => !f.played) || null,
    } : null,
    windows,
    lastTimeline,
    table: [{ pos: 1, ref: '10', team: 'Sporting Club', p: playedClub.length, w: playedClub.length, d: 0, l: 0, gf: 6, ga: 1, pts: playedClub.length * 3, form: ['W'] }],
    roundResults: [],
    nextRound: [],
  };
}

function writeBits7(buf, byteOff, bitOff, val) {
  const word = buf[byteOff] | (buf[byteOff + 1] << 8) | (buf[byteOff + 2] << 16) | (buf[byteOff + 3] << 24);
  const mask = 0x7f << bitOff;
  const next = (word & ~mask) | ((val & 0x7f) << bitOff);
  buf[byteOff] = next & 0xff;
  buf[byteOff + 1] = (next >>> 8) & 0xff;
  buf[byteOff + 2] = (next >>> 16) & 0xff;
  buf[byteOff + 3] = (next >>> 24) & 0xff;
}

function makeSyntheticSaveBuffer({ playerId = 42, affection = 50, formByte = 0xA0 | 2, unavailableDays = 0 } = {}) {
  const start = PLAYER_REC - 48;
  const buf = Buffer.alloc(start + 384, 0);
  buf.writeUInt32LE(playerId, PLAYER_REC);
  buf[start + 0] = 180;
  buf[start + 1] = 75;
  buf[start + 28] = 21;
  for (const [, , off, bit] of ABILITIES) writeBits7(buf, start + off, bit, 75);
  buf[start + AFFECTION_REL] = affection;
  buf[start + FORM_ARROW_REL] = formByte;
  buf[start + UNAVAILABLE_REL] = unavailableDays;
  return buf;
}

describe('Calendrier complet anti-spoilers (Phase D)', () => {
  const fx0 = { id: 'm0', date: '2026-08-01', home: 'Sporting Club', away: 'Nice', competition: 'Ligue 1', played: true, score: [2, 0], me: { starter: true, minutes: 90, goals: 1, assists: 0, rating: 7.5 } };
  const fx1 = { id: 'm1', date: '2026-08-05', home: 'Lyon', away: 'Sporting Club', competition: 'Ligue 1', played: true, score: [1, 3], me: { starter: true, minutes: 90, goals: 2, assists: 1, rating: 8.4 } };
  const fx2 = { id: 'm2', date: '2026-08-09', home: 'Sporting Club', away: 'Marseille', competition: 'Ligue 1', played: true, score: [0, 0], me: { starter: true, minutes: 90, goals: 0, assists: 0, rating: 6.5 } };
  const fx3 = { id: 'm3', date: '2026-08-14', home: 'Lille', away: 'Sporting Club', competition: 'Ligue 1', played: true, score: [0, 2], me: { starter: true, minutes: 85, goals: 1, assists: 1, rating: 7.9 } };
  const nt1 = { id: 'nt1', date: '2026-08-11', home: 'Brazil', away: 'Chile', competition: 'Friendly', played: true, score: [3, 0], me: { starter: true, minutes: 70, goals: 1, assists: 0, rating: 7.6 } };

  it('mode basique ne met pas en file d attente et synchro reste directe', () => {
    const prev = makeSnap('2026-08-01', [fx0]);
    const state = { snapshot: prev };
    const next = makeSnap('2026-08-15', [fx0, fx1, fx2, fx3]);
    const res = ingestSyncCalendar(state, next, { calendarMode: 'basic' });
    assert.equal(res.deferred, false);
    assert.equal(res.queuedCount, 0);
    assert.equal(state.calendar.simDate, '2026-08-15');
    assert.equal(state.saveSnapshot, null);
  });

  it('mode complet met en file 3 matchs club + 1 selection et masque stats/last/next/timeline sans spoiler', () => {
    const state = { snapshot: makeSnap('2026-08-01', [fx0]) };
    ingestSyncCalendar(state, state.snapshot, { calendarMode: 'full' });

    const real = makeSnap('2026-08-15', [fx0, fx1, fx2, fx3], {
      ntFixtures: [nt1],
      lastTimeline: { matchId: 'm3', goals: [{ min: 12, scorer: 'Lucas Silva' }] },
    });
    const res = ingestSyncCalendar(state, real, { calendarMode: 'full' });

    assert.equal(res.deferred, true);
    assert.equal(res.queuedCount, 4);
    assert.equal(state.snapshot.gameDate, '2026-08-01');
    assert.equal(state.snapshot.stats.total.apps, 1);
    assert.equal(state.snapshot.stats.total.goals, 1);
    assert.equal(state.snapshot.last.id, 'm0');
    assert.equal(state.snapshot.next.id, 'm1');
    assert.equal(state.snapshot.next.played, false);
    assert.equal(state.snapshot.next.score, null);
    assert.equal(state.snapshot.nationalTeam.stats.apps, 0);
    assert.equal(state.snapshot.nationalTeam.fixtures[0].played, false);
    assert.equal(state.snapshot.lastTimeline, null);

    // Zero spoiler dans agenda non plus
    const ag = calendarAgenda(state, '2026-08');
    const m1Item = ag.items.find((x) => x.date === '2026-08-05' && x.kind === 'match');
    assert.ok(m1Item);
    assert.equal(m1Item.spoilerHidden, true);
    assert.equal(m1Item.detail, 'Ligue 1');
  });

  it('advanceCalendar gere day (+1j), next_event chronologique, catch_up et rejette quand deja a jour', () => {
    const state = { snapshot: makeSnap('2026-08-01', [fx0]) };
    ingestSyncCalendar(state, state.snapshot, { calendarMode: 'full' });
    addCustomCalendarEvent(state, { date: '2026-08-03', title: 'Diner sponsor', category: 'sponsor' }, () => 'ev1');

    const real = makeSnap('2026-08-15', [fx0, fx1, fx2, fx3], { ntFixtures: [nt1] });
    ingestSyncCalendar(state, real, { calendarMode: 'full' });

    // day : 2026-08-02 sans match revele
    const s1 = advanceCalendar(state, { mode: 'day' });
    assert.equal(s1.nextDate, '2026-08-02');
    assert.equal(s1.days, 1);
    assert.equal(s1.revealedFixtures.length, 0);
    assert.equal(state.snapshot.stats.total.apps, 1);

    // next_event : saute a l'evenement custom du 2026-08-03
    const s2 = advanceCalendar(state, { mode: 'next_event' });
    assert.equal(s2.nextDate, '2026-08-03');
    assert.equal(s2.days, 1);
    assert.equal(s2.revealedFixtures.length, 0);

    // next_event : saute au 2026-08-05 et revele m1 uniquement
    const s3 = advanceCalendar(state, { mode: 'next_event' });
    assert.equal(s3.nextDate, '2026-08-05');
    assert.equal(s3.days, 2);
    assert.deepEqual(s3.revealedFixtures.map((f) => f.id), ['m1']);
    assert.equal(state.snapshot.stats.total.apps, 2);
    assert.equal(state.snapshot.stats.total.goals, 3);
    assert.equal(state.snapshot.last.id, 'm1');
    assert.equal(state.snapshot.next.id, 'm2');
    assert.equal(state.snapshot.next.score, null);

    // catch_up : va a 2026-08-15 et vide saveSnapshot
    const s4 = advanceCalendar(state, { mode: 'catch_up' });
    assert.equal(s4.nextDate, '2026-08-15');
    assert.equal(s4.reachedSaveDate, true);
    assert.equal(state.saveSnapshot, null);
    assert.equal(state.snapshot.stats.total.apps, 4);
    assert.equal(state.snapshot.nationalTeam.stats.apps, 1);

    assert.throws(
      () => advanceCalendar(state, { mode: 'day' }),
      /Tu es déjà à jour avec ta sauvegarde/
    );
  });

  it('flushCalendarToSave revele tout au retour vers mode basique', () => {
    const state = { snapshot: makeSnap('2026-08-01', [fx0]) };
    ingestSyncCalendar(state, state.snapshot, { calendarMode: 'full' });
    const real = makeSnap('2026-08-10', [fx0, fx1, fx2]);
    ingestSyncCalendar(state, real, { calendarMode: 'full' });

    const fl = flushCalendarToSave(state);
    assert.equal(fl.flushed, true);
    assert.equal(fl.nextDate, '2026-08-10');
    assert.equal(fl.revealedFixtures.length, 2);
    assert.equal(state.snapshot.stats.total.apps, 3);
    assert.equal(state.calendar.pendingMatches.length, 0);
    assert.equal(state.saveSnapshot, null);
  });

  it('evenements personnalises (validation, tri, suppression) et dayRhythm', () => {
    const state = {
      snapshot: makeSnap('2026-08-05', [
        { ...fx1, date: '2026-08-05' }, // Mercredi
      ], {
        ntFixtures: [{ id: 'ntx', date: '2026-08-08', home: 'Brazil', away: 'Peru', competition: 'Friendly', played: false }],
      }),
    };
    assert.throws(() => addCustomCalendarEvent(state, { date: 'bad', title: 'X' }), /Date et titre requis/);
    addCustomCalendarEvent(state, { date: '2026-08-12', title: 'Gala', category: 'charity' }, () => 'c2');
    addCustomCalendarEvent(state, { date: '2026-08-07', title: 'Famille', category: 'family' }, () => 'c1');
    addCustomCalendarEvent(state, { date: '2026-08-10', title: 'Twitch Live', category: '__custom__', customCategory: 'Streaming' }, () => 'c3');
    assert.deepEqual(state.calendar.customEvents.map((e) => e.id), ['c1', 'c3', 'c2']);
    const ag = calendarAgenda(state, '2026-08');
    const c3Item = ag.items.find((x) => x.id === 'c3');
    assert.equal(c3Item.category, 'custom');
    assert.equal(c3Item.customCategory, 'Streaming');
    removeCustomCalendarEvent(state, 'c1');
    removeCustomCalendarEvent(state, 'c3');
    assert.deepEqual(state.calendar.customEvents.map((e) => e.id), ['c2']);

    assert.equal(dayRhythm(state, '2026-08-04'), 'match_prep');
    assert.equal(dayRhythm(state, '2026-08-05'), 'matchday');
    assert.equal(dayRhythm(state, '2026-08-06'), 'recovery');
    assert.equal(dayRhythm(state, '2026-08-08'), 'international');
    // 2026-08-09 est dimanche -> day_off ; 2026-08-11 est mardi -> training
    assert.equal(dayRhythm(state, '2026-08-09'), 'day_off');
    assert.equal(dayRhythm(state, '2026-08-11'), 'training');
  });

  it('calendarBounds et advanceCalendar bloquent toute avance au-dela de saveDate ou d un match non joue', () => {
    const nextUnplayed = { ...fx1, played: false, score: null, me: null };
    const nextUnplayed2 = { ...fx2, played: false, score: null, me: null };
    const state = { snapshot: makeSnap('2026-08-01', [fx0, nextUnplayed, nextUnplayed2]) };
    ingestSyncCalendar(state, state.snapshot, { calendarMode: 'full' });

    const b = calendarBounds(state);
    assert.equal(b.mode, 'synced');
    assert.equal(b.canAdvance, false);
    assert.equal(b.maxDate, '2026-08-01');
    assert.throws(() => advanceCalendar(state, { mode: 'day' }), /Tu es déjà à jour avec ta sauvegarde/);

    // Si un ancien état avait poussé simDate au-delà de saveDate (ex. 2026-08-05 > 2026-08-01), ensureCalendar le recale à saveDate
    state.calendar.simDate = '2026-08-05';
    const clamped = calendarBounds(state);
    assert.equal(clamped.simDate, '2026-08-01');
    assert.equal(clamped.canAdvance, false);

    // Jouer ensuite 2 matchs et synchroniser le 2026-08-10 -> les deux sont mis en file jusqu'à saveDate
    const playedTwo = makeSnap('2026-08-10', [fx0, fx1, fx2]);
    const queuedAfter = ingestSyncCalendar(state, playedTwo, { calendarMode: 'full' });
    assert.equal(queuedAfter.deferred, true);
    assert.equal(queuedAfter.queuedCount, 2);
    assert.equal(state.snapshot.stats.total.apps, 1);
  });

  it('synchro 4 jours plus tard ne saute pas simDate et avance jour par jour via world.calendarAdvance sans spoiler', () => {
    const dir = makeTmpDir();
    const store = new Store(dir);
    const base = makeSnap('2026-08-01', [fx0, { ...fx1, played: false, score: null, me: null }]);
    base.player.salary = 500000;
    base.table = [{ pos: 3, ref: '10', team: 'Sporting Club', p: 1, w: 1, d: 0, l: 0, gf: 2, ga: 0, pts: 3, form: ['W'] }];
    const state = { careerId: 'c_42', snapshot: base, syncedSnapshot: base };
    ingestSyncCalendar(state, base, { calendarMode: 'full' });

    const real = makeSnap('2026-08-06', [fx0, fx1]);
    real.player.salary = 999999; // futur non encore atteint
    real.table = [{ pos: 1, ref: '10', team: 'Sporting Club', p: 2, w: 2, d: 0, l: 0, gf: 5, ga: 1, pts: 6, form: ['W', 'W'] }];
    const res = ingestSyncCalendar(state, real, { calendarMode: 'full' });

    assert.equal(res.deferred, true);
    assert.equal(res.queuedCount, 1);
    assert.equal(state.calendar.simDate, '2026-08-01');
    assert.equal(state.calendar.saveDate, '2026-08-06');
    assert.equal(state.snapshot.gameDate, '2026-08-01');
    assert.equal(state.snapshot.player.salary, 500000);
    assert.equal(state.snapshot.table[0].pos, 3);
    assert.equal(state.snapshot.next.played, false);
    assert.equal(state.snapshot.next.score, null);

    store.saveCareer(state);
    store.setActiveCareer('c_42');

    for (const expectedDate of ['2026-08-02', '2026-08-03', '2026-08-04']) {
      const r = world.calendarAdvance({ store, mode: 'day' });
      assert.equal(r.step.nextDate, expectedDate);
      assert.equal(r.step.revealedFixtures.length, 0);
      assert.equal(r.step.needsPublish, false);
      assert.equal(r.state.snapshot.next.played, false);
    }

    const matchDay = world.calendarAdvance({ store, mode: 'day' });
    assert.equal(matchDay.step.nextDate, '2026-08-05');
    assert.deepEqual(matchDay.step.revealedFixtures.map((f) => f.id), ['m1']);
    assert.equal(matchDay.step.needsPublish, true);
    assert.equal(matchDay.step.reachedSaveDate, false);
    assert.equal(matchDay.state.snapshot.stats.total.apps, 2);
    assert.equal(calendarBounds(matchDay.state).canAdvance, true);
    assert.equal(calendarBounds(matchDay.state).maxDate, '2026-08-06');
  });

  it('deja sur le jour du match (simDate === match.date), la synchro du lendemain revele le match sans sauter simDate', () => {
    const preMatch = makeSnap('2026-08-05', [fx0, { ...fx1, played: false, score: null, me: null }]);
    const state = { snapshot: preMatch, syncedSnapshot: preMatch };
    ingestSyncCalendar(state, preMatch, { calendarMode: 'full' });

    const nextMorning = makeSnap('2026-08-06', [fx0, fx1]);
    const res = ingestSyncCalendar(state, nextMorning, { calendarMode: 'full' });

    assert.equal(res.deferred, true);
    assert.equal(res.queuedCount, 0);
    assert.equal(state.calendar.simDate, '2026-08-05');
    assert.equal(state.calendar.saveDate, '2026-08-06');
    assert.equal(state.snapshot.last.id, 'm1');
    assert.equal(state.snapshot.fixtures.find((f) => f.id === 'm1').played, true);
    assert.equal(calendarBounds(state).canAdvance, true);
    assert.equal(calendarBounds(state).maxDate, '2026-08-06');
  });

  it('maskCareerForDate masque les matchs posterieurs a simDate et efface lastMatchEvents si masque', () => {
    const career = {
      save: { date: '2026-08-10', slot: 'BL00000001' },
      matches: [
        { key: 1, date: '2026-08-01', competitionId: 1, home: { ref: '10' }, away: { ref: '20' }, played: true, score: [2, 0], homeLineup: [{ playerId: 42 }], awayLineup: [{ playerId: 99 }] },
        { key: 2, date: '2026-08-05', competitionId: 1, home: { ref: '30' }, away: { ref: '10' }, played: true, score: [1, 3], homeLineup: [{ playerId: 77 }], awayLineup: [{ playerId: 42 }] },
      ],
      lastMatchEvents: { matchKey: 2, goals: [{ minute: 12, scorerId: 42 }] },
    };
    const masked = maskCareerForDate(career, '2026-08-03', []);
    assert.equal(masked.save.date, '2026-08-03');
    assert.equal(masked.matches[0].played, true);
    assert.equal(masked.matches[1].played, false);
    assert.equal(masked.matches[1].score, null);
    assert.deepEqual(masked.matches[1].homeLineup, []);
    assert.equal(masked.lastMatchEvents, null);

    // Match le jour meme mais marque comme en file d'attente -> masque aussi
    const pendingId = '2026-08-01|10|20|1';
    const maskedPending = maskCareerForDate(career, '2026-08-05', [{ id: pendingId }]);
    assert.equal(maskedPending.matches[0].played, false);
    assert.equal(maskedPending.matches[1].played, true);
    assert.ok(maskedPending.lastMatchEvents);
  });

  it('world.calendarAdvance signale needsPublish quand reachedSaveDate tombe sur matchday ou nouvelle offre', () => {
    const dir = makeTmpDir();
    const store = new Store(dir);
    const fxUpcoming = { id: 'm1', date: '2026-08-06', home: 'Lyon', away: 'Sporting Club', competition: 'Ligue 1', played: false, score: null, me: null };
    const start = makeSnap('2026-08-04', [fx0, fxUpcoming]);
    const state = { careerId: 'c_md', snapshot: start, syncedSnapshot: start };
    ingestSyncCalendar(state, start, { calendarMode: 'full' });

    const saveAtMatchday = makeSnap('2026-08-06', [fx0, fxUpcoming]);
    ingestSyncCalendar(state, saveAtMatchday, { calendarMode: 'full' });
    store.saveCareer(state);
    store.setActiveCareer('c_md');

    const quiet = world.calendarAdvance({ store, mode: 'day' });
    assert.equal(quiet.step.nextDate, '2026-08-05');
    assert.equal(quiet.step.needsPublish, false);

    const onMatchday = world.calendarAdvance({ store, mode: 'day' });
    assert.equal(onMatchday.step.nextDate, '2026-08-06');
    assert.equal(onMatchday.step.reachedSaveDate, true);
    assert.equal(onMatchday.step.needsPublish, true);

    // Meme chose avec une nouvelle offre recue a saveDate hors jour de match
    const base2 = makeSnap('2026-08-04', [fx0]);
    const state2 = { careerId: 'c_off', snapshot: base2, syncedSnapshot: base2 };
    ingestSyncCalendar(state2, base2, { calendarMode: 'full' });
    const saveWithOffer = makeSnap('2026-08-05', [fx0]);
    saveWithOffer.player.offers = [{ slot: 0, clubRef: '99', club: 'AS Monaco', salary: 1200000, contractUntil: '2029-06-30', status: 'pending' }];
    ingestSyncCalendar(state2, saveWithOffer, { calendarMode: 'full' });
    store.saveCareer(state2);
    store.setActiveCareer('c_off');

    const onOfferDay = world.calendarAdvance({ store, mode: 'day' });
    assert.equal(onOfferDay.step.reachedSaveDate, true);
    assert.equal(onOfferDay.step.needsPublish, true);
  });
});

describe('Effets Ma vie sur sauvegarde (opt-in)', () => {
  it('lifeEffectsInData borne affection et forme et preserve strictement les 5 bits hauts de +327', () => {
    const upperBits = 0xA8; // 10101_000b
    const raw = makeSyntheticSaveBuffer({ playerId: 42, affection: 50, formByte: upperBits | 2, unavailableDays: 5 });
    assert.ok(readPlayerProfile(raw, PLAYER_REC));

    const out = lifeEffectsInData(raw, {
      playerId: 42,
      affectionDelta: 25, // borne a +12 -> 62
      formArrowDelta: 5,  // borne a +2 -> min(4, 2+2) = 4
      unavailableDays: 2, // plus petit que 5 : reste 5
    });

    const start = PLAYER_REC - 48;
    assert.equal(out.after.affection, 62);
    assert.equal(out.after.formArrowLevel, 4);
    assert.equal(out.after.unavailableDays, 5);
    assert.equal(out.data[start + FORM_ARROW_REL], upperBits | 4);
    assert.equal(out.data[start + FORM_ARROW_REL] & 0xF8, upperBits);

    const lower = lifeEffectsInData(out.data, { playerId: 42, affectionDelta: -20, formArrowDelta: -3, unavailableDays: 8 });
    assert.equal(lower.after.affection, 50);
    assert.equal(lower.after.formArrowLevel, 2);
    assert.equal(lower.after.unavailableDays, 8);
    assert.equal(lower.data[start + FORM_ARROW_REL] & 0xF8, upperBits);

    // Aucun changement effectif quand deja aux bornes ou deltas nuls
    const atMax = makeSyntheticSaveBuffer({ playerId: 42, affection: 99, formByte: 0x50 | 4, unavailableDays: 10 });
    assert.throws(
      () => lifeEffectsInData(atMax, { playerId: 42, affectionDelta: 4, formArrowDelta: 1, unavailableDays: 3 }),
      /Aucun changement à écrire dans la sauvegarde/
    );
  });

  it('applyLifeSaveEffects refuse tant que settings.lifeSaveEffects est faux et dismissLifeSaveEffects remet a zero', () => {
    const dir = makeTmpDir();
    const store = new Store(dir);
    store.saveSettings({ lifeSaveEffects: false });
    const state = {
      careerId: 'c_42',
      snapshot: makeSnap('2026-08-05', []),
      lifeHub: {
        calibrated: true,
        pendingSaveEffects: { affectionDelta: 4, formArrowDelta: 1, reasons: ['extra_shooting'] },
      },
    };
    store.saveCareer(state);
    store.setActiveCareer('c_42');

    assert.throws(
      () => world.applyLifeSaveEffects({ store, settings: store.getSettings() }),
      /Les effets Ma vie sur la sauvegarde sont désactivés/
    );

    const dismissed = world.dismissLifeSaveEffects({ store });
    assert.deepEqual(dismissed.lifeHub.pendingSaveEffects, { affectionDelta: 0, formArrowDelta: 0, reasons: [] });
  });
});
