'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Store } = require('../src/store');
const { parseStadiumMap, ensureClubStadium, stadiumCode } = require('../src/save/stadiums');
const { saveLifeImage, removeLifeImage, MAX_BYTES } = require('../src/world/lifeMedia');
const { catalogDisplayName, buildSceneAndReactions } = require('../src/world/lifeScenes');
const { ensureLifeHub, calibrateLifeHub, lifeHubFacts } = require('../src/world/lifeHub');
const world = require('../src/world/world');

const tmpDirs = [];
function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'll-phaseh-'));
  tmpDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tmpDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

const PNG_BYTES = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0]);
const WEBP_BYTES = Buffer.from([82, 73, 70, 70, 20, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32]);

function makeDxt1Dds() {
  const buf = Buffer.alloc(136);
  buf.write('DDS ', 0, 'latin1');
  buf.writeUInt32LE(4, 12); // height
  buf.writeUInt32LE(4, 16); // width
  buf.writeUInt32LE(4, 80); // FLAG_FOURCC
  buf.write('DXT1', 84, 'latin1');
  buf.writeUInt16LE(0xf800, 128); // red
  buf.writeUInt16LE(0x07e0, 130); // green
  buf.writeUInt32LE(0x55555555, 132);
  return buf;
}

function makeRichCareerState() {
  const clubRef = (101 << 14) | 1;
  const snapshot = {
    gameDate: '2027-09-12',
    player: { id: 7, name: 'Rafael Mendes', nationality: 'Brazil', salary: 6500000, profile: { age: 25, affection: 74, teamRole: 'Star Player', marketValue: 68000000 } },
    club: { ref: clubRef, id: 101, name: 'Real Valen', short: 'RVA', stadium: 'Estadio Solis', coach: 'Marco Silva' },
    league: { id: 1, name: 'Liga Iberica' },
    stats: { total: { apps: 230, goals: 145, assists: 52 }, current: { goals: 9, assists: 4 } },
    nationalTeam: { apps: 28, goals: 14 },
    squad: [
      { id: 7, name: 'Rafael Mendes', me: true, pos: 'CF' },
      { id: 8, name: 'Mateo Cruz', me: false, pos: 'CM', captain: true },
      { id: 11, name: 'Lucas Dias', me: false, pos: 'LWF' },
    ],
    squadIntel: {
      captain: { id: 8, name: 'Mateo Cruz', me: false },
      positionRivals: [],
      unusedBench: [],
    },
    fixtures: [],
    windows: [],
  };

  const state = {
    careerId: '7-rafael-mendes',
    profile: { handle: 'rafamendes', displayName: 'Rafael Mendes', followers: 2200000 },
    privacy: { enabled: true, fields: { playerName: 'Rafael Mendes', handle: 'rafamendes' } },
    persona: {
      preset: 'showman',
      roots: { hometown: 'Niteroi' },
      circle: { family: [{ role: 'Sister', name: 'Camila Mendes', protect: true, lives: 'hometown' }] }, // 2.0: lives far, so the scene names her town
    },
    feed: [],
    accounts: {},
    editions: [],
    mail: [],
    dms: [],
    promises: [],
    onRecord: [],
    transfers: [],
    seasons: {},
    keyMemory: [],
    writers: { national_columnist: 'Elena Ortiz', national_desk: [] },
    huddles: [{
      id: 'hd1',
      clubRef,
      club: 'Real Valen',
      coach: 'Marco Silva',
      staff: [{ name: 'Hugo Renardy', role: 'physio' }, { name: 'Olivier Tessier', role: 'manager' }],
      players: ['Mateo Cruz', 'Lucas Dias'],
      messages: [],
      unread: 0,
      left: null,
      announced: null,
    }],
    snapshot,
  };
  ensureLifeHub(state, snapshot);
  calibrateLifeHub(state, snapshot, { startMode: 'cash_only', cash: 4500000 }, () => 'init_id');
  return state;
}

describe('Phase H Living My Life: stadium thumbnails, custom media importer & interactive scenes', () => {
  it('parses stadium-server map_teams.txt and extracts PNG & DDS thumbnails safely', () => {
    const map = parseStadiumMap(`
# Sider map_teams
101, 042, Estadio Solis, Spain\\Solis
# Missing fields ignored
202, 099
202, 099, Arena Verde, "Italy\\Verde"
    `);
    assert.equal(map.length, 2);
    assert.deepEqual(map[0], { teamId: 101, stadiumId: 42, name: 'Estadio Solis', relPath: 'Spain\\Solis' });
    assert.equal(stadiumCode(42), 'st042');

    const gameDir = makeTmpDir();
    const outDir = makeTmpDir();
    const serverDir = path.join(gameDir, 'SiderAddons', 'content', 'stadium-server');
    const pack1 = path.join(serverDir, 'Spain', 'Solis', 'common', 'render', 'thumbnail', 'stadium');
    const pack2 = path.join(serverDir, 'Italy', 'Verde', 'common', 'render', 'thumbnail', 'stadium');
    fs.mkdirSync(pack1, { recursive: true });
    fs.mkdirSync(pack2, { recursive: true });
    fs.writeFileSync(path.join(serverDir, 'map_teams.txt'), '101, 42, Estadio Solis, Spain\\Solis\n202, 99, Arena Verde, Italy\\Verde\n');
    fs.writeFileSync(path.join(pack1, 'st042.png'), PNG_BYTES);
    fs.writeFileSync(path.join(pack2, 'st099.dds'), makeDxt1Dds());

    // Direct PNG hit by teamId
    const file1 = ensureClubStadium({ gameDir, teamId: 101, stadiumName: 'Estadio Solis', outDir });
    assert.equal(file1, 'club-101.png');
    assert.ok(fs.existsSync(path.join(outDir, file1)));

    // Cache hit (second call returns existing file even if source is removed)
    fs.rmSync(path.join(pack1, 'st042.png'));
    assert.equal(ensureClubStadium({ gameDir, teamId: 101, stadiumName: 'Estadio Solis', outDir }), 'club-101.png');

    // DDS decode by stadiumName match
    const file2 = ensureClubStadium({ gameDir, stadiumName: 'Arena Verde', outDir });
    assert.equal(file2, 'name-arena-verde.png');
    const decodedPng = fs.readFileSync(path.join(outDir, file2));
    assert.ok(decodedPng.subarray(0, 8).equals(PNG_BYTES.subarray(0, 8)));

    // Graceful null fallback when missing
    assert.equal(ensureClubStadium({ gameDir, teamId: 999, stadiumName: 'Unknown Ground', outDir }), null);
  });

  it('validates JPEG/PNG/WebP uploads locally and blocks traversal on deletion', () => {
    const dir = makeTmpDir();

    const jpg = saveLifeImage({ dir, prefix: 'Asset../Villa!!', dataUrl: `data:image/jpeg;base64,${JPEG_BYTES.toString('base64')}` });
    assert.match(jpg, /^assetvilla-.*\.jpg$/);
    assert.ok(fs.existsSync(path.join(dir, jpg)));

    const png = saveLifeImage({ dir, prefix: 'sponsor', dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}` });
    assert.match(png, /^sponsor-.*\.png$/);

    const webp = saveLifeImage({ dir, prefix: 'hero', dataUrl: `data:image/webp;base64,${WEBP_BYTES.toString('base64')}` });
    assert.match(webp, /^hero-.*\.webp$/);

    // Reject spoofed magic bytes
    assert.throws(
      () => saveLifeImage({ dir, prefix: 'bad', dataUrl: `data:image/png;base64,${JPEG_BYTES.toString('base64')}` }),
      /Image illisible/,
    );
    // Reject non-image data URL
    assert.throws(
      () => saveLifeImage({ dir, prefix: 'bad', dataUrl: 'data:text/plain;base64,SGVsbG8=' }),
      /Image illisible/,
    );
    // Reject oversized > 4 MB
    const big = Buffer.alloc(MAX_BYTES + 16);
    PNG_BYTES.copy(big);
    assert.throws(
      () => saveLifeImage({ dir, prefix: 'big', dataUrl: `data:image/png;base64,${big.toString('base64')}` }),
      /Image trop lourde/,
    );

    // Path-traversal blocked
    assert.equal(removeLifeImage(dir, '../escape.png'), false);
    assert.equal(removeLifeImage(dir, 'nested/file.png'), false);
    assert.equal(removeLifeImage(dir, jpg), true);
    assert.equal(fs.existsSync(path.join(dir, jpg)), false);
  });

  it('humanizes catalog names across languages and emits rich scenes & Kop/Vestiaire reactions without raw variable leaks', () => {
    assert.equal(catalogDisplayName('exotic_supercar', 'en'), 'Exotic supercar');
    assert.equal(catalogDisplayName('luxury_villa', 'pt'), 'Mansão de luxo');
    assert.equal(catalogDisplayName('foundation_launch', 'fr'), 'Fondation pour la jeunesse');
    assert.equal(catalogDisplayName({ custom: true, name: 'Custom Yacht' }, 'en'), 'Custom Yacht');

    const store = new Store(makeTmpDir(), { isEncryptionAvailable: () => false });
    store.saveSettings({ ...store.getSettings(), language: 'en' });
    const state = makeRichCareerState();
    store.saveCareer(state);
    store.setActiveCareer(state.careerId);

    // 1. Purchase supercar -> generates scene, Kop post & Vestiaire banter
    world.buyLifeAsset({ store, payload: { catalogId: 'car_supercar' } });
    let loaded = store.activeCareer();
    assert.equal(loaded.lifeHub.scenes.length, 1);
    const carScene = loaded.lifeHub.scenes[0];
    assert.match(carScene.headline, /Supercar/);
    assert.equal(carScene.headline.includes('car_supercar'), false);
    assert.equal(loaded.feed.length, 1);
    assert.equal(loaded.feed[0].lifeScene, true);
    assert.ok(loaded.feed[0].text.includes('Supercar'));
    assert.equal(loaded.huddles[0].messages.length, 1);
    assert.equal(loaded.huddles[0].unread, 1);

    // 2. Check FACTS.off_pitch_hub has zero raw snake_case variable leaks
    const facts = lifeHubFacts(loaded);
    assert.ok(facts.notable_lifestyle.includes('Supercar'));
    assert.equal(facts.notable_lifestyle.includes('car_supercar'), false);

    // 3. Days-off actions: team_dinner -> Vestiaire thank-you using squad mate; inner_circle -> private (zero Kop post!)
    const feedBeforeInner = loaded.feed.length;
    world.doLifeAction({ store, payload: { actionId: 'inner_circle' } });
    loaded = store.activeCareer();
    assert.equal(loaded.feed.length, feedBeforeInner, 'inner_circle must never post publicly to Kop');
    assert.match(loaded.lifeHub.scenes[0].headline, /Camila Mendes/);
    assert.match(loaded.lifeHub.scenes[0].narrative, /Niteroi/);

    world.doLifeAction({ store, payload: { actionId: 'team_dinner' } });
    loaded = store.activeCareer();
    assert.equal(loaded.huddles[0].messages.length, 2);
    assert.equal(loaded.huddles[0].unread, 2);

    // 4. Dilemma + Sponsor obligation -> scenes created cleanly
    loaded.lifeHub.pendingDilemma = { id: 'd1', dilemmaId: 'youth_club_plea', createdAt: '2027-09-12' };
    loaded.lifeHub.obligations.push({ id: 'ob1', sponsorId: 'sp1', brand: 'Nike Football', kind: 'boot_launch', dueDate: '2027-09-20', rewardCash: 5000, status: 'pending' });
    store.saveCareer(loaded);

    world.answerLifeDilemma({ store, dilemmaId: 'd1', choiceId: 'a' });
    world.completeLifeObligation({ store, obligationId: 'ob1', skip: false });
    loaded = store.activeCareer();
    assert.ok(loaded.lifeHub.scenes.length >= 4);
    assert.ok(loaded.feed.some((p) => p.text.includes('Nike Football')));

    // Direct call in another language produces Portuguese narrative cleanly
    const ptScene = buildSceneAndReactions(loaded, loaded.snapshot, {
      kind: 'purchase',
      refId: 'luxury_villa',
      category: 'home',
      asset: { catalogId: 'luxury_villa', category: 'home', price: 2800000, custom: false },
    }, { language: 'pt', newId: () => 'pt1' });
    assert.match(ptScene.headline, /Mansão de luxo/);
  });

  it('persists custom images via setLifeMedia & buyLifeAsset and deletes orphaned files cleanly', () => {
    const dataRoot = makeTmpDir();
    const store = new Store(dataRoot, { isEncryptionAvailable: () => false });
    store.saveSettings({ ...store.getSettings(), language: 'en' });
    const state = makeRichCareerState();
    store.saveCareer(state);
    store.setActiveCareer(state.careerId);

    const mediaDir = path.join(store.dir, 'careers', state.careerId, 'life-media');
    const jpgUrl = `data:image/jpeg;base64,${JPEG_BYTES.toString('base64')}`;
    const pngUrl = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;

    // Hero custom banner: set, replace (old deleted), reset (file deleted)
    world.setLifeMedia({ store, payload: { target: 'hero', dataUrl: jpgUrl } });
    let loaded = store.activeCareer();
    const firstHero = loaded.lifeHub.heroImage;
    assert.ok(fs.existsSync(path.join(mediaDir, firstHero)));

    world.setLifeMedia({ store, payload: { target: 'hero', dataUrl: pngUrl } });
    loaded = store.activeCareer();
    const secondHero = loaded.lifeHub.heroImage;
    assert.notEqual(secondHero, firstHero);
    assert.equal(fs.existsSync(path.join(mediaDir, firstHero)), false);
    assert.ok(fs.existsSync(path.join(mediaDir, secondHero)));

    world.setLifeMedia({ store, payload: { target: 'hero', dataUrl: null } });
    loaded = store.activeCareer();
    assert.equal(loaded.lifeHub.heroImage, null);
    assert.equal(fs.existsSync(path.join(mediaDir, secondHero)), false);

    // Custom asset purchased with uploaded photo -> scene preserves image -> sell removes file
    world.buyLifeAsset({
      store,
      payload: { custom: true, name: 'Lake Villa', category: 'home', price: 300000, monthlyCost: 800, imageDataUrl: jpgUrl },
    });
    loaded = store.activeCareer();
    const customAsset = loaded.lifeHub.assets.find((a) => a.custom && a.name === 'Lake Villa');
    assert.ok(customAsset?.customImage);
    assert.equal(loaded.lifeHub.scenes[0].image, customAsset.customImage);
    assert.ok(fs.existsSync(path.join(mediaDir, customAsset.customImage)));

    world.sellLifeAsset({ store, assetId: customAsset.id });
    assert.equal(fs.existsSync(path.join(mediaDir, customAsset.customImage)), false);

    // Sponsor logo upload + removal cleanup
    world.addLifeSponsor({ store, payload: { brand: 'Apex Gear', categories: ['boots', 'apparel'], fee: 200000, bonus: 3000 } });
    loaded = store.activeCareer();
    const sp = loaded.lifeHub.sponsors.find((s) => s.brand === 'Apex Gear');
    world.setLifeMedia({ store, payload: { target: 'sponsor', id: sp.id, dataUrl: pngUrl } });
    loaded = store.activeCareer();
    const logoFile = loaded.lifeHub.sponsors.find((s) => s.id === sp.id).customImage;
    assert.ok(logoFile && fs.existsSync(path.join(mediaDir, logoFile)));

    world.removeLifeSponsor({ store, id: sp.id });
    assert.equal(fs.existsSync(path.join(mediaDir, logoFile)), false);
  });
});
