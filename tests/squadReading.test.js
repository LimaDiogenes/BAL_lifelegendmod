'use strict';
// Phase G : lecture enrichie de Player.bin (nationalité + repli nom), EDIT00000000,
// numéros de maillot (+0x2EA), capitaine (+593), tireurs (+584), onze type (+544),
// joueurs créés (0x80000000+), coéquipiers non alignés, Vestiaire et Influence.

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { parsePlayerBin, parseEditPlayers, mergeEditPlayers } = require(path.join(ROOT, 'src/save/gameDb.js'));
const { readTeams } = require(path.join(ROOT, 'src/save/blReader.js'));
const { buildSnapshot, nationalitiesFromTeams } = require(path.join(ROOT, 'src/world/snapshot.js'));
const { huddleToday, huddleContext } = require(path.join(ROOT, 'src/world/huddle.js'));
const { buildAux, assess } = require(path.join(ROOT, 'src/world/influence.js'));

function makePlayerBin(entries) {
  const PLAYER_STRIDE = 312;
  const buf = Buffer.alloc(8 + entries.length * PLAYER_STRIDE);
  entries.forEach((p, idx) => {
    const rec = idx * PLAYER_STRIDE;
    buf.writeUInt32LE(p.id, rec + 0x08);
    if (p.nationality) buf.writeUInt16LE((p.nationality & 0x1FF) << 1, rec + 0x1D);
    if (p.pos != null) buf[rec + 0x36] = (p.pos & 0xF) << 2;
    if (p.altName) Buffer.from(`${p.altName}\0`, 'utf8').copy(buf, rec + 0x44);
    if (p.name) Buffer.from(`${p.name}\0`, 'utf8').copy(buf, rec + 0xFB);
  });
  return buf;
}

function makeEditSave(entries) {
  const FIRST = 0x7C;
  const STRIDE = 0x138;
  const buf = Buffer.alloc(FIRST + entries.length * STRIDE);
  buf.writeUInt16LE(entries.length, 96);
  entries.forEach((e, i) => {
    const o = FIRST + i * STRIDE;
    buf.writeUInt32LE(e.id, o);
    if (e.nationality) buf.writeUInt16LE(e.nationality, o + 8);
    if (e.pos != null) {
      buf[o + 33] |= (e.pos & 0x7) << 5;
      buf[o + 34] |= (e.pos >> 3) & 1;
    }
    if (e.name) Buffer.from(`${e.name}\0`, 'utf8').copy(buf, o + 0x36);
  });
  return buf;
}

test('parsePlayerBin : lit id, nom (+0xFB et repli +0x44), poste (+0x36) et nationalité (+0x1D)', () => {
  const bin = makePlayerBin([
    { id: 1001, name: 'Alisson', altName: 'Alisson Becker', pos: 0, nationality: 146 },
    { id: 1002, name: '', altName: 'Declan Rice', pos: 4, nationality: 204 },
    { id: 1003, name: 'Kai Havertz', pos: 12, nationality: 210 },
  ]);
  const parsed = parsePlayerBin(bin);
  assert.strictEqual(parsed.names.get(1001), 'Alisson');
  assert.strictEqual(parsed.names.get(1002), 'Declan Rice');
  assert.strictEqual(parsed.names.get(1003), 'Kai Havertz');
  assert.strictEqual(parsed.positions.get(1001), 0);
  assert.strictEqual(parsed.positions.get(1002), 4);
  assert.strictEqual(parsed.positions.get(1003), 12);
  assert.strictEqual(parsed.nationalities.get(1001), 146);
  assert.strictEqual(parsed.nationalities.get(1002), 204);
  assert.strictEqual(parsed.nationalities.get(1003), 210);
});

test('parseEditPlayers & mergeEditPlayers : ajoute les joueurs créés et surcharge sans muter la base', () => {
  const baseDb = {
    source: 'Player.bin',
    ...parsePlayerBin(makePlayerBin([{ id: 1002, name: 'Old Name', pos: 5, nationality: 204 }])),
    teams: new Map(),
  };
  const edits = parseEditPlayers(makeEditSave([
    { id: 0x80000001, name: 'Gui Negao', pos: 12, nationality: 146 },
    { id: 1002, name: 'Declan Rice', pos: 4, nationality: 204 },
  ]));
  assert.strictEqual(edits.length, 2);
  assert.deepStrictEqual(edits[0], { id: 0x80000001, name: 'Gui Negao', position: 12, nationality: 146 });

  const merged = mergeEditPlayers(baseDb, edits);
  assert.strictEqual(merged.names.get(0x80000001), 'Gui Negao');
  assert.strictEqual(merged.positions.get(0x80000001), 12);
  assert.strictEqual(merged.nationalities.get(0x80000001), 146);
  assert.strictEqual(merged.names.get(1002), 'Declan Rice');
  assert.strictEqual(merged.positions.get(1002), 4);
  assert.strictEqual(baseDb.names.get(1002), 'Old Name', 'base DB not mutated');
  assert.strictEqual(baseDb.names.has(0x80000001), false);
});

test('readTeams : garde les joueurs créés (0x80000000+) et lit maillots, capitaine, tireurs et onze de départ', () => {
  const TEAM_STRIDE = 0x690;
  const COACH_TABLE = 0x1000;
  const buf = Buffer.alloc(COACH_TABLE + 0x258);
  const slot = 0;
  const ref = (103 << 14) | slot;
  buf.writeUInt32LE(ref, 0x50);
  Buffer.from('Arsenal\0', 'utf8').copy(buf, 0x54);
  Buffer.from('ARS\0', 'utf8').copy(buf, 0x9A);
  Buffer.from('Emirates\0', 'utf8').copy(buf, 0xA0);

  const roster = [1001, 1002, 0x80000001, 1003];
  const shirts = [1, 41, 10, 29];
  roster.forEach((pid, r) => {
    buf.writeUInt32LE(r + 10, 0x19C + 8 * r);
    buf.writeUInt32LE(pid, 0x19C + 8 * r + 4);
    buf.writeUInt16LE(shirts[r], 0x2EA + 2 * r);
  });
  buf.writeUInt32LE(0xFFFF, 0x19C + 8 * roster.length);

  const rec = COACH_TABLE - 8;
  buf.writeUInt32LE(slot, rec);
  Buffer.from('M. Arteta\0', 'utf8').copy(buf, COACH_TABLE);
  // XI de départ : emplacements 0, 1, 2
  buf[rec + 544] = 0;
  buf[rec + 545] = 1;
  buf[rec + 546] = 2;
  buf[rec + 547] = 0xFF;
  // Tireurs : LF=1, SF=2, FK2=1, CG=2, CD=2, Pen=2
  [1, 2, 1, 2, 2, 2].forEach((v, idx) => { buf[rec + 584 + idx] = v; });
  buf[rec + 593] = 1; // capitaine = emplacement 1 (pid 1002)

  const teams = readTeams(buf, { coach: COACH_TABLE });
  const club = teams.get(ref);
  assert.ok(club);
  assert.deepStrictEqual(club.roster, roster);
  assert.deepStrictEqual(club.shirts, { 1001: 1, 1002: 41, [0x80000001]: 10, 1003: 29 });
  assert.strictEqual(club.captainId, 1002);
  assert.strictEqual(club.penaltyTakerId, 0x80000001);
  assert.strictEqual(club.freeKickTakerId, 0x80000001);
  assert.deepStrictEqual(club.startingXiIds, [1001, 1002, 0x80000001]);
});

test('nationalitiesFromTeams & buildSnapshot : déduit les pays, fusionne les remplaçants à 0 match et bâtit squadIntel', () => {
  const clubRef = 100;
  const brRef = 200;
  const localRef = 201;
  const otherRef = 300;
  const playerId = 0x80000001;

  const brIds = Array.from({ length: 11 }, (_, i) => 5000 + i);
  const localIds = Array.from({ length: 11 }, (_, i) => 6000 + i);
  const nationalities = new Map();
  for (const id of [...brIds, ...localIds, playerId, 1003]) nationalities.set(id, 146);
  nationalities.set(1002, 204);

  const names = new Map([
    [1001, 'Alisson'],
    [1002, 'Declan Rice'],
    [1003, 'Kai Havertz'],
    [playerId, 'Diogo Lima'],
    ...brIds.map((id) => [id, `BR${id}`]),
    ...localIds.map((id) => [id, `LOC${id}`]),
  ]);
  const positions = new Map([[1001, 0], [1002, 4], [1003, 12], [playerId, 12]]);

  const club = {
    ref: clubRef,
    name: 'Arsenal',
    short: 'ARS',
    stadium: 'Emirates',
    coach: 'M. Arteta',
    roster: [playerId, 1001, 1002, 1003],
    shirts: { [playerId]: 9, 1001: 1, 1002: 41, 1003: 29 },
    captainId: 1002,
    penaltyTakerId: playerId,
    freeKickTakerId: 1002,
    startingXiIds: [playerId, 1001, 1002],
  };
  const teams = new Map([
    [clubRef, club],
    [brRef, { ref: brRef, index: 584, name: 'Brazil', roster: [...brIds, playerId] }],
    [localRef, { ref: localRef, index: 120, name: 'Chapecoense', roster: localIds }],
    [otherRef, { ref: otherRef, index: 50, name: 'Club Abroad', roster: brIds }],
  ]);

  const career = {
    game: 'FL27',
    save: { slot: 0, date: '2026-11-20', league: 'Premier League' },
    player: { id: playerId, name: 'Diogo Lima', nationality: 'Brazil', profile: { position: 'AC' } },
    club,
    teams,
    competitions: new Map([[17, 'Premier League']]),
    matches: [{
      key: 0,
      date: '2026-11-18',
      hour: 15,
      competitionId: 17,
      competition: 'Premier League',
      round: 0,
      home: club,
      away: { ref: 99, name: 'Chelsea' },
      score: [2, 0],
      played: true,
      homeLineup: [
        { playerId, starter: true, pos: 9, minutes: 90, ratingRaw: 40, goals: 2, assists: 0 },
        { playerId: 1001, starter: true, pos: 0, minutes: 90, ratingRaw: 35, goals: 0, assists: 0 },
        { playerId: 1002, starter: true, pos: 4, minutes: 90, ratingRaw: 37, goals: 0, assists: 1 },
      ],
      awayLineup: [],
    }],
  };

  const natNames = nationalitiesFromTeams(career, nationalities);
  assert.strictEqual(natNames.get(146), 'Brazil');

  const snap = buildSnapshot(career, { names, positions, nationalities });
  assert.strictEqual(snap.squad.length, 4);
  const unused = snap.squad.find((p) => p.name === 'Kai Havertz');
  assert.ok(unused, 'unused bench player merged from roster');
  assert.strictEqual(unused.apps, 0);
  assert.strictEqual(unused.shirt, 29);
  assert.strictEqual(unused.pos, 'AC');
  assert.strictEqual(unused.nationality, 'Brazil');
  assert.strictEqual(unused.status, 'unused');

  const cap = snap.squad.find((p) => p.name === 'Declan Rice');
  assert.strictEqual(cap.captain, true);
  assert.strictEqual(cap.shirt, 41);
  assert.strictEqual(cap.pos, 'MDC');

  assert.strictEqual(snap.squadIntel.captain.name, 'Declan Rice');
  assert.strictEqual(snap.squadIntel.penaltyTaker.name, 'Diogo Lima');
  assert.strictEqual(snap.squadIntel.penaltyTaker.me, true);
  assert.strictEqual(snap.squadIntel.freeKickTaker.name, 'Declan Rice');
  assert.strictEqual(snap.squadIntel.positionRivals[0].name, 'Kai Havertz');
  assert.strictEqual(snap.squadIntel.unusedBench[0].name, 'Kai Havertz');

  // Vestiaire : capitaine et rival de poste mis en avant
  const group = { clubRef, club: 'Arsenal', coach: 'M. Arteta', staff: [], players: ['Alisson', 'Declan Rice', 'Kai Havertz'], messages: [], texting: {} };
  const today = huddleToday(group, { last: snap.last, date: '2026-11-20', squadIntel: snap.squadIntel });
  assert.ok(today.voices_today.some((v) => v.name === 'Declan Rice' && /captain/.test(v.why)));
  assert.ok(today.voices_today.some((v) => v.name === 'Kai Havertz' && /competes with him for the AC spot/.test(v.why)));
  const ctxH = huddleContext(group, snap);
  assert.strictEqual(ctxH.captain, 'Declan Rice');
  assert.deepStrictEqual(ctxH.position_rivals, ['Kai Havertz (AC)']);

  // Influence : bonus/malus capitaine + shirt + unused
  const aux = buildAux(career, snap, { nameOf: (id) => names.get(id), clubs: {}, prestige: new Map([[clubRef, { team: 'Arsenal', prestige: 0.7 }]]), formations: [], positions });
  const riceAux = aux.squad.find((p) => p.id === 1002);
  const havertzAux = aux.squad.find((p) => p.id === 1003);
  assert.strictEqual(riceAux.captain, true);
  assert.strictEqual(riceAux.shirt, 41);
  assert.strictEqual(havertzAux.unused, true);

  const stateInf = { careerId: 'c1', influence: { requests: [], effects: [], keeps: [], track: 0, scoreInfo: { score: 50 } } };
  const saleCap = assess('sale', { playerId: 1002, toRef: 888 }, {
    state: stateInf,
    s: snap,
    aux: { ...aux, saleTargets: [{ ref: 888, name: 'PSG', full: false }] },
  });
  const keepCap = assess('keep', { playerId: 1002 }, { state: stateInf, s: snap, aux });
  assert.ok(saleCap.reasons.includes('club_captain'));
  assert.ok(keepCap.reasons.includes('club_captain'));
});
