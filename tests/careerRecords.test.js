'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Store } = require('../src/store');
const { setSaveKeys } = require('../src/save/pesCrypt');
const { readCareer } = require('../src/save/blReader');
const { archiveSeason, careerFacts, resolveCareerRecords, resolveHistory } = require('../src/world/seasons');
const { pantheonEvents } = require('../src/world/pantheon');
const { formerClubs, reunionFacts } = require('../src/world/reunion');
const { tribunePlan } = require('../src/world/tribunePlan');
const world = require('../src/world/world');

const RESEARCH_SAVE = path.join(__dirname, 'fixtures', 'research_BL00000003');
const FL_KEY = path.join(process.env.APPDATA || '', 'LiveTweet', 'data', 'keys', 'cle-c01c15e42400.bin');

describe('Full career records, club aliases, life events, and key memory', () => {
  it('reads Club Records + International Records + Combined Totals from research_BL00000003', {
    skip: !(fs.existsSync(RESEARCH_SAVE) && fs.existsSync(FL_KEY)) && 'research_BL00000003 or key absent',
  }, () => {
    setSaveKeys([fs.readFileSync(FL_KEY)]);
    const career = readCareer(RESEARCH_SAVE);
    const rec = career.player.careerRecords;
    assert.ok(rec);
    assert.equal(rec.clubs.length, 3);
    assert.deepEqual(
      rec.clubs.map((c) => [c.apps, c.goals, c.assists]),
      [[23, 31, 8], [95, 170, 133], [112, 247, 147]],
    );
    assert.equal(rec.clubs[0].name, 'Volta Redonda');
    assert.equal(rec.clubs[1].name, 'SC Corinthians');
    assert.equal(rec.clubs[2].name, 'Liverpool FC');
    assert.equal(rec.international.name, 'Brazil');
    assert.equal(rec.international.apps, 39);
    assert.equal(rec.international.goals, 90);
    assert.equal(rec.international.assists, 53);
    assert.equal(rec.clubTotals.apps, 230);
    assert.equal(rec.clubTotals.goals, 448);
    assert.equal(rec.clubTotals.assists, 288);
    assert.equal(rec.combinedTotals.apps, 269);
    assert.equal(rec.combinedTotals.goals, 538);
    assert.equal(rec.combinedTotals.assists, 341);
  });

  it('resolves unknown club aliases and exposes save_career_records in careerFacts', () => {
    const state = {
      clubAliases: { 84345314: 'Santos FC' },
      seasons: {},
      snapshot: {
        player: {
          history: null,
          careerRecords: {
            clubs: [{ clubRef: 84345314, name: null, apps: 23, goals: 31, assists: 8, avgRating: 7.4 }],
            international: { teamRef: 737961, name: 'Brazil', apps: 39, goals: 90, assists: 53, avgRating: 7.1 },
            clubTotals: { apps: 23, goals: 31, assists: 8, avgRating: 7.4 },
            combinedTotals: { apps: 62, goals: 121, assists: 61, avgRating: 7.2 },
          },
        },
      },
    };
    const resolved = resolveCareerRecords(state);
    assert.equal(resolved.clubs[0].name, 'Santos FC');
    const facts = careerFacts(state);
    assert.equal(facts.save_career_records.clubs[0].club, 'Santos FC');
    assert.equal(facts.save_career_records.combined_totals.goals, 121);
    assert.equal(facts.totals.apps, 62);
    assert.equal(facts.totals.goals, 121);
    assert.equal(facts.totals_cover_whole_career, true);

    const hist = resolveHistory({
      clubAliases: { 84345314: 'Santos FC' },
      snapshot: {
        player: {
          history: { firstClub: null, previousClub: null, debuts: [{ kind: 'club', date: '2025-01', team: null, opponent: 'Rival' }] },
          careerRecords: { clubs: [{ clubRef: 84345314, name: null }, { clubRef: 99, name: 'Liverpool FC' }] },
        },
      },
    });
    assert.equal(hist.firstClub, 'Santos FC');
    assert.equal(hist.debuts[0].team, 'Santos FC');
  });

  it('tracks combined career milestones cleanly without spamming first sync', () => {
    const baseSnap = (apps, goals, assists) => ({
      season: '2028-2029',
      gameDate: '2028-12-01',
      club: { ref: 10, name: 'Liverpool FC' },
      league: { name: 'Premier League' },
      table: [],
      fixtures: [],
      stats: { total: { apps: 24, starts: 24, minutes: 2160, goals: 47, assists: 32, avgRating: 7.3 } },
      scorerRace: { myRank: 1 },
      trophies: [],
      player: {
        history: { debuts: [{ kind: 'club', date: '2025-01' }] },
        careerRecords: { combinedTotals: { apps, goals, assists, avgRating: 7.3 } },
      },
    });
    const state = { seasons: {} };
    const first = archiveSeason(state, baseSnap(249, 499, 299));
    assert.deepEqual(first.milestones, []);
    const crossed = archiveSeason(state, baseSnap(250, 500, 300));
    assert.ok(crossed.milestones.some((m) => m.includes('250e')));
    assert.ok(crossed.milestones.some((m) => m.includes('500e')));
    assert.ok(crossed.milestones.some((m) => m.includes('300e')));
  });

  it('suppresses false first_match/first_goal in pantheonEvents when careerRecords shows prior matches', () => {
    const state = { pantheon: { chapters: [{ title: 'Origins' }] }, seasons: { '2028-2029|10': { season: '2028-2029', club: 'Liverpool FC', stats: { apps: 24, goals: 47 } } } };
    const snapshot = {
      season: '2028-2029',
      club: { ref: 10, name: 'Liverpool FC' },
      player: { careerRecords: { clubs: [{ clubRef: 10, name: 'Liverpool FC', apps: 118, goals: 264 }] } },
    };
    const ev = pantheonEvents({ state, before: [], snapshot, changes: { transfer: null, contractSigned: null } });
    assert.equal(ev.some((e) => e.kind === 'first_match'), false);
    assert.equal(ev.some((e) => e.kind === 'first_goal'), false);
  });

  it('merges careerRecords and clubAliases into reunion formerClubs and reunionFacts', () => {
    const state = {
      clubAliases: { 84345314: 'Volta Redonda' },
      seasons: { '2028-2029|10': { season: '2028-2029', club: 'Liverpool FC', stats: { apps: 24, goals: 47 } } },
    };
    const snapshot = {
      gameDate: '2028-12-02',
      club: { name: 'Liverpool FC' },
      player: {
        history: { previousClub: 'SC Corinthians' },
        careerRecords: {
          clubs: [
            { clubRef: 84345314, name: null, startYear: 2025, apps: 23, goals: 31, assists: 8 },
            { clubRef: 20430967, name: 'SC Corinthians', startYear: 2025, apps: 95, goals: 170, assists: 133 },
          ],
        },
      },
      fixtures: [{ date: '2028-12-05', home: 'Liverpool FC', away: 'SC Corinthians', competition: 'FIFA Club World Cup', played: false }],
    };
    const list = formerClubs(state, snapshot);
    assert.ok(list.some((c) => c.club === 'Volta Redonda' && c.matches === 23));
    const r = reunionFacts(state, snapshot);
    assert.equal(r.club, 'SC Corinthians');
    assert.deepEqual(r.his_time_there.matches, 95);
    assert.deepEqual(r.his_time_there.goals, 170);
  });

  it('persists club aliases, life events, and capped keyMemory via world helpers', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'll-career-rec-'));
    const store = new Store(dir, { isEncryptionAvailable: () => false });
    const state = {
      careerId: 'c-rec-1',
      profile: { handle: 'hero', displayName: 'Hero', followers: 100 },
      feed: [],
      accounts: {},
      editions: [],
      mail: [],
      snapshot: { gameDate: '2028-12-10', player: { name: 'Hero' }, club: { ref: '10', name: 'Liverpool FC' } },
    };
    store.saveCareer(state);
    store.setActiveCareer(state.careerId);

    const s1 = world.saveClubAlias({ store, clubRef: 84345314, name: 'Youth Academy' });
    assert.equal(s1.clubAliases['84345314'], 'Youth Academy');

    const s2 = world.saveLifeEvents({
      store,
      events: [
        { date: '2028-12-12', title: 'Charity match in hometown' },
        { date: '2028-12-20', title: 'Anniversary dinner' },
        { date: 'bad-date', title: 'Should skip' },
      ],
    });
    assert.equal(s2.lifeEvents.length, 2);

    for (let i = 0; i < 14; i++) world.noteKeyMemory(s2, `Milestone ${i + 1}`, '2028-12-10');
    assert.equal(s2.keyMemory.length, 10);
    assert.equal(s2.keyMemory[0], '2028-12-10: Milestone 5');
  });

  it('schedules off-pitch gossip or life_events slot in tribunePlan', () => {
    const state = {
      careerId: 'c-plan',
      bio: { text: 'Grew up in Manaus and loves music.' },
      editions: [{ gameDate: '2028-12-01' }],
      feed: [],
      accounts: {},
    };
    const snapshot = {
      gameDate: '2028-12-10',
      club: { ref: '10', name: 'Liverpool FC', coach: 'Coach' },
      league: { id: 1, name: 'Premier League' },
      player: { history: { joinedClub: '2027-01-01' }, contractUntil: '2030-06-30' },
      table: [{ ref: '10', team: 'Liverpool FC', pos: 1, mine: true }],
      fixtures: [],
    };
    const slots = tribunePlan({
      state,
      snapshot,
      changes: { newResults: [], life_events: [{ date: '2028-12-10', event: 'Charity gala' }] },
      handle: 'hero',
    });
    assert.ok(slots.some((s) => s.angle.includes('CHANGES.life_events')));

    const gossipSlots = tribunePlan({
      state,
      snapshot,
      changes: { newResults: [] },
      handle: 'hero',
    });
    assert.ok(gossipSlots.some((s) => s.angle.includes('off-pitch life')));
  });
});
