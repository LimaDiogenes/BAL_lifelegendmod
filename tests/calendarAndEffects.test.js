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
  advanceCalendar,
  flushCalendarToSave,
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
    player: { id: 42, name: 'Lucas Silva', nationality: 'Brazil', salary: 500000, offers: [], interests: [], profile: { age: 21, marketValue: 2500000 } },
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
