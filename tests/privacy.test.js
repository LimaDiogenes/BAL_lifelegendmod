'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Hook providers.complete BEFORE requiring factcheck.js or world.js (they destructure it at load time).
let mockComplete = async () => '{}';
const providers = require('../src/ai/providers');
providers.complete = async (settings, apiKey, opts) => mockComplete(settings, apiKey, opts);

const { Store } = require('../src/store');
const {
  DECOYS,
  PRIVACY_FIELDS,
  normalizePrivacy,
  buildPrivacyMap,
  maskText,
  unmaskText,
  privacyWords,
  previewMasked,
} = require('../src/ai/privacyShield');
const {
  factCheck,
  draftItems,
  needsAiFactCheck,
} = require('../src/ai/factcheck');
const { buildReport } = require('../src/report');
const world = require('../src/world/world');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'll-privacy-test-'));
}

describe('Phase 1 defaults & Phase 2 Privacy Shield', () => {
  beforeEach(() => {
    mockComplete = async () => '{}';
  });

  it('defaults Store language to en', () => {
    const dir = makeTmpDir();
    const store = new Store(dir, { isEncryptionAvailable: () => false });
    const settings = store.getSettings();
    assert.equal(settings.language, 'en');
  });

  it('normalizes privacy settings cleanly', () => {
    const def = normalizePrivacy();
    assert.equal(def.enabled, false);
    assert.equal(typeof def.fields, 'object');
    assert.equal(typeof def.overrides, 'object');
    for (const { key } of PRIVACY_FIELDS) {
      assert.equal(typeof def.fields[key], 'string');
    }

    const custom = normalizePrivacy({
      enabled: true,
      fields: {
        playerName: '  Diogenes Lima ',
        pet: 'Koda',
        custom: 'Ponta Negra = Praia Nova',
      },
      overrides: { hometown: 'Porto Claro' },
    });
    assert.equal(custom.enabled, true);
    assert.equal(custom.fields.playerName, 'Diogenes Lima');
    assert.equal(custom.fields.pet, 'Koda');
    assert.equal(custom.fields.custom, 'Ponta Negra = Praia Nova');
    assert.equal(custom.overrides.hometown, 'Porto Claro');
  });

  it('builds deterministic decoy map, masks and unmasks without collisions', () => {
    const privacy = {
      enabled: true,
      fields: {
        playerName: 'Diogenes Lima',
        handle: '@diogolima',
        nickname: 'Dio',
        hometown: 'Manaus',
        region: 'Amazonas',
        partner: 'Carolina',
        father: 'Marcos',
        mother: 'Helena',
        siblings: 'Rafael, Bruno',
        friend: 'Thiago',
        pet: 'Koda',
        youthClub: 'Nacional FC',
        school: 'Colegio Bosco',
        custom: 'Ponta Negra = Praia Nova',
      },
      overrides: { hometown: 'Porto Claro' },
    };

    const mapA = buildPrivacyMap(privacy, {
      careerId: 'career-42',
      playerName: 'Diogenes Lima',
      handle: 'diogolima',
    });
    const mapB = buildPrivacyMap(privacy, {
      careerId: 'career-42',
      playerName: 'Diogenes Lima',
      handle: 'diogolima',
    });
    assert.equal(mapA.enabled, true);
    assert.deepEqual(mapA.pairs, mapB.pairs);

    const sample =
      'DIOGENES LIMA (@diogolima), known as Dio from Manaus in Amazonas, visited Ponta Negra with Carolina, Marcos, Helena, Rafael, Bruno, Thiago and his dog Koda, remembering Nacional FC and Colegio Bosco.';
    const masked = maskText(sample, mapA);

    for (const secret of [
      'diogenes',
      'lima',
      'diogolima',
      'Dio',
      'Manaus',
      'Amazonas',
      'Ponta Negra',
      'Carolina',
      'Marcos',
      'Helena',
      'Rafael',
      'Bruno',
      'Thiago',
      'Koda',
      'Nacional FC',
      'Colegio Bosco',
    ]) {
      assert.equal(
        masked.toLowerCase().includes(secret.toLowerCase()),
        false,
        `Masked text leaked "${secret}": ${masked}`,
      );
    }

    // Explicit overrides & custom pair honored; ALL-CAPS player name masked cleanly
    assert.ok(masked.includes('Porto Claro'));
    assert.ok(masked.includes('Praia Nova'));
    assert.ok(Array.isArray(DECOYS.firstName) && DECOYS.firstName.length > 0);

    const restored = unmaskText(masked, mapA);
    assert.ok(restored.includes('DIOGENES LIMA'));
    assert.ok(restored.includes('@diogolima'));
    assert.ok(restored.includes('Manaus'));
    assert.ok(restored.includes('Ponta Negra'));
    assert.ok(restored.includes('Carolina'));
    assert.ok(restored.includes('Koda'));
    assert.ok(restored.includes('Nacional FC'));
    assert.ok(restored.includes('Colegio Bosco'));

    const words = privacyWords(privacy);
    assert.ok(words.includes('Diogenes Lima'));
    assert.ok(words.includes('Manaus'));
    assert.ok(words.includes('Ponta Negra'));

    const preview = previewMasked('Diogenes Lima walked Koda in Manaus.', privacy, { careerId: 'career-42' });
    assert.equal(preview.masked.includes('Diogenes'), false);
    assert.equal(preview.masked.includes('Koda'), false);
    assert.equal(preview.masked.includes('Manaus'), false);
    assert.ok(preview.pairs.length >= 3);
  });

  it('auto-protects save playerName & handle even when privacy fields are blank', () => {
    const map = buildPrivacyMap(
      { enabled: true, fields: {}, overrides: {} },
      { careerId: 'save-1', playerName: 'Diogenes Lima', handle: 'diogolima' },
    );
    const masked = maskText('Great goal by Diogenes Lima (@diogolima)! Also Lima worked hard.', map);
    assert.equal(masked.toLowerCase().includes('diogenes'), false);
    assert.equal(masked.toLowerCase().includes('lima'), false);
    assert.equal(masked.toLowerCase().includes('diogolima'), false);
    const restored = unmaskText(masked, map);
    assert.equal(restored, 'Great goal by Diogenes Lima (@diogolima)! Also Lima worked hard.');
  });

  it('returns original text unchanged when privacy shield is disabled', () => {
    const map = buildPrivacyMap(
      { enabled: false, fields: { hometown: 'Manaus' }, overrides: {} },
      { careerId: 'save-1', playerName: 'Diogenes Lima' },
    );
    assert.equal(map.enabled, false);
    const raw = 'Diogenes Lima lives in Manaus.';
    assert.equal(maskText(raw, map), raw);
    assert.equal(unmaskText(raw, map), raw);
  });

  it('scrubs configured privacy words from buildReport', () => {
    const report = buildReport({
      version: '1.1.0',
      settings: { language: 'en', provider: 'anthropic', model: 'claude-sonnet-4-6' },
      state: {
        privacy: {
          enabled: true,
          fields: {
            playerName: 'Diogenes Lima',
            hometown: 'Manaus',
            pet: 'Koda',
            custom: 'SecretDistrict = OldTown',
          },
          overrides: {},
        },
        bio: { text: 'Grew up in Manaus near SecretDistrict with Koda.' },
      },
      logs: ['2027-01-01 Player Diogenes Lima synced save from Manaus with Koda in SecretDistrict.'],
      env: { platform: 'win32', node: process.version },
      now: new Date('2027-01-01T12:00:00Z'),
    });
    const text = typeof report === 'string' ? report : JSON.stringify(report);
    for (const secret of ['Diogenes', 'Lima', 'Manaus', 'Koda', 'SecretDistrict']) {
      assert.equal(text.includes(secret), false, `Report leaked "${secret}"`);
    }
  });
});

describe('Phase 3 factCheck token filtering & masking', () => {
  beforeEach(() => {
    mockComplete = async () => JSON.stringify({ corrections: [] });
  });

  it('filters banter from draftItems only when filterBanter is enabled', () => {
    const out = {
      articles: [],
      posts: [
        { author: { handle: 'fan1' }, text: 'What a vibe at the stadium today, love this squad!' },
        { author: { handle: 'fan2' }, text: 'He scored 2 goals in 78 minutes to make it 3-1 at home.' },
        { author: { handle: 'fan3' }, text: 'Best atmosphere all season!' },
      ],
      huddle: [
        { from: 'Mate1', text: 'Great training session lads, coffee after?' },
      ],
    };

    const all = draftItems(out);
    assert.equal(all.length, 4);

    const filtered = draftItems(out, { filterBanter: true, flags: [] });
    assert.equal(filtered.length, 1);
    assert.ok(filtered[0].text.includes('3-1'));
    assert.equal(needsAiFactCheck(out, { flags: [] }), true);

    const banterOnly = {
      articles: [],
      posts: [{ author: { handle: 'fan1' }, text: 'Love this team so much, come on lads!' }],
      huddle: [{ from: 'Mate1', text: 'See you tomorrow at training!' }],
    };
    assert.equal(needsAiFactCheck(banterOnly, { flags: [] }), false);
    assert.equal(needsAiFactCheck(banterOnly, { flags: ['suspicious claim'] }), true);
  });

  it('skips AI call in factCheck when drafts contain only non-factual banter', async () => {
    let called = 0;
    mockComplete = async () => {
      called++;
      return JSON.stringify({ corrections: [] });
    };

    const res = await factCheck(
      {
        articles: [],
        posts: [{ author: { handle: 'fan1' }, text: 'Vamos lads, amazing energy tonight!' }],
        huddle: [{ from: 'Mate1', text: 'Good recovery session!' }],
      },
      {
        settings: { language: 'en', provider: 'anthropic', model: 'claude-sonnet-4-6' },
        apiKey: 'sk-test',
        facts: { player: { name: 'Diogenes Lima' } },
        changes: {},
        flags: [],
      },
    );

    assert.equal(called, 0);
    assert.equal(res.checked, true);
    assert.equal(res.skipped, true);
  });

  it('masks prompt sent to factCheck AI when factual articles are present', async () => {
    let seenSystem = '';
    let seenUser = '';
    mockComplete = async (_settings, _apiKey, { system, user }) => {
      seenSystem = String(system || '');
      seenUser = String(user || '');
      return JSON.stringify({ corrections: [] });
    };

    const privacyMap = buildPrivacyMap(
      { enabled: true, fields: { hometown: 'Manaus', partner: 'Carolina' }, overrides: {} },
      { careerId: 'c1', playerName: 'Diogenes Lima', handle: 'diogolima' },
    );

    const res = await factCheck(
      {
        national: [
          {
            headline: 'Diogenes Lima scores twice in 2-0 win',
            body: 'From Manaus with Carolina watching, Diogenes Lima scored 2 goals in 90 minutes.',
          },
        ],
      },
      {
        settings: { language: 'en', provider: 'anthropic', model: 'claude-sonnet-4-6' },
        apiKey: 'sk-test',
        facts: {
          player: { name: 'Diogenes Lima', club: 'Racing Club', goals: 2 },
        },
        changes: {},
        flags: [],
        privacyMap,
      },
    );

    assert.equal(res.checked, true);
    assert.ok(seenUser.length > 50, 'Expected non-empty user prompt sent to factCheck');
    const combined = `${seenSystem}\n${seenUser}`;
    assert.ok(combined.includes(maskText('Diogenes Lima', privacyMap)), 'Expected decoy player name in prompt');
    assert.ok(combined.includes(maskText('Manaus', privacyMap)), 'Expected decoy town in prompt');
    assert.ok(combined.includes(maskText('Carolina', privacyMap)), 'Expected decoy partner in prompt');
    for (const secret of ['Diogenes', 'Lima', 'Manaus', 'Carolina']) {
      assert.equal(combined.includes(secret), false, `factCheck prompt leaked "${secret}"`);
    }
  });
});

describe('End-to-end world.post & world.sendHuddle privacy masking', () => {
  it('masks outgoing prompts and unmasks saved responses in world.post and world.sendHuddle', async () => {
    const dir = makeTmpDir();
    const store = new Store(dir, { isEncryptionAvailable: () => false });
    const settings = {
      ...store.getSettings(),
      language: 'en',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      fastModel: 'claude-haiku-4-5',
      apiKeys: { anthropic: 'sk-test-key' },
    };
    store.saveSettings(settings);

    const privacy = {
      enabled: true,
      fields: {
        playerName: 'Diogenes Lima',
        handle: '@diogolima',
        hometown: 'Manaus',
        partner: 'Carolina',
        pet: 'Koda',
        youthClub: 'Nacional FC',
        custom: 'Botafogo = Estrela Sul',
      },
      overrides: {},
    };

    const state = {
      careerId: '1001-diogenes-lima',
      profile: {
        handle: 'diogolima',
        displayName: 'Diogenes Lima',
        followers: 1200,
      },
      bio: {
        text: 'Born in Manaus, played for Nacional FC with Carolina and Koda cheering.',
      },
      privacy,
      feed: [],
      accounts: {},
      editions: [],
      mail: [],
      dms: [],
      promises: [],
      onRecord: [],
      transfers: [],
      seasons: {},
      writers: { national_columnist: 'Jean Dupont', national_desk: [] },
      huddles: [
        {
          id: 'club-10',
          clubRef: '10',
          club: 'Racing Club',
          name: 'Racing Club',
          coach: 'Marco Rossi',
          staff: [],
          players: ['Lucas Meyer', 'Mateo Silva'],
          styles: {},
          messages: [{ who: 'system', kind: 'created', gameDate: '2026-09-01' }],
          unread: 0,
        },
      ],
      snapshot: {
        gameDate: '2026-09-15',
        season: '2026-2027',
        player: {
          id: 1001,
          name: 'Diogenes Lima',
          nationality: 'Brazil',
          age: 21,
          overall: 78,
          position: 'CF',
          profile: null,
          training: null,
          offers: [],
          interests: [],
        },
        club: { ref: '10', name: 'Racing Club', short: 'RAC', stadium: 'Stade Municipal' },
        league: { id: 1, name: 'Ligue 1' },
        coaches: { my: 'Marco Rossi' },
        stats: { apps: 3, goals: 2, assists: 1, avgRating: 7.4 },
        scorerRace: [],
        squad: [
          { name: 'Lucas Meyer', pos: 'CM' },
          { name: 'Mateo Silva', pos: 'CB' },
        ],
        table: [
          { pos: 1, ref: '10', team: 'Racing Club', p: 3, w: 3, d: 0, l: 0, gf: 6, ga: 1, pts: 9, form: ['W', 'W', 'W'] },
        ],
        fixtures: [],
        roundResults: [],
        nextRound: [],
        rosters: {},
      },
    };
    store.saveCareer(state);
    store.setActiveCareer(state.careerId);

    const savedState = world.savePrivacy({ store, privacy });
    assert.equal(savedState.privacy.enabled, true);

    const capturedPrompts = [];
    mockComplete = async (_settings, _apiKey, { system, user }) => {
      const s = String(system || '');
      const u = String(user || '');
      capturedPrompts.push({ system: s, user: u });

      const map = world.privacyMapFor(store.activeCareer(), settings);
      const decoyName = maskText('Diogenes Lima', map);
      const decoyTown = maskText('Manaus', map);
      const decoyPartner = maskText('Carolina', map);
      const decoyPet = maskText('Koda', map);

      if (s.includes('"Vestiaire"')) {
        return JSON.stringify({
          messages: [
            {
              from: 'Lucas Meyer',
              text: `Haha ${decoyName}, tell ${decoyPartner} and ${decoyPet} we are proud of ${decoyTown} tonight!`,
            },
          ],
        });
      }

      return JSON.stringify({
        replies: [
          {
            handle: 'supporter99',
            name: 'Supporter 99',
            type: 'fan',
            text: `Big love to ${decoyName} from ${decoyTown} — and say hi to ${decoyPet} and ${decoyPartner}!`,
          },
        ],
      });
    };

    await world.post({
      store,
      settings,
      text: 'Thinking of Manaus, Carolina, Koda and Nacional FC after training!',
    });

    await world.sendHuddle({
      store,
      settings,
      text: 'Greetings from Manaus, Carolina and Koda say hello!',
      groupId: 'club-10',
    });

    assert.equal(capturedPrompts.length, 2);
    for (const p of capturedPrompts) {
      const both = `${p.system}\n${p.user}`;
      for (const secret of ['Diogenes', 'Lima', 'diogolima', 'Manaus', 'Carolina', 'Koda', 'Nacional FC']) {
        assert.equal(
          both.includes(secret),
          false,
          `Outgoing AI prompt leaked "${secret}":\n${both.slice(0, 600)}`,
        );
      }
    }

    const updated = store.activeCareer();
    const kopPost = updated.feed[0];
    assert.ok(kopPost);
    assert.ok(kopPost.text.includes('Manaus'));
    assert.ok(kopPost.text.includes('Carolina'));
    assert.ok(kopPost.replies && kopPost.replies.length > 0);
    const replyText = kopPost.replies[0].text;
    assert.ok(replyText.includes('Diogenes Lima'), `Unmasked Kop reply missing real name: ${replyText}`);
    assert.ok(replyText.includes('Manaus'), `Unmasked Kop reply missing town: ${replyText}`);
    assert.ok(replyText.includes('Koda'), `Unmasked Kop reply missing pet: ${replyText}`);
    assert.ok(replyText.includes('Carolina'), `Unmasked Kop reply missing partner: ${replyText}`);

    const huddleMsgs = updated.huddles[0].messages.filter((m) => m.who === 'them');
    assert.ok(huddleMsgs.length > 0, 'Expected unmasked huddle reply message');
    const huddleText = huddleMsgs[0].text;
    assert.ok(huddleText.includes('Diogenes Lima'), `Unmasked huddle reply missing real name: ${huddleText}`);
    assert.ok(huddleText.includes('Manaus'), `Unmasked huddle reply missing town: ${huddleText}`);
    assert.ok(huddleText.includes('Carolina'), `Unmasked huddle reply missing partner: ${huddleText}`);
    assert.ok(huddleText.includes('Koda'), `Unmasked huddle reply missing pet: ${huddleText}`);
  });
});
