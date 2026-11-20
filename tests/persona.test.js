'use strict';

const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const providers = require('../src/ai/providers');
const origComplete = providers.complete;
let mockComplete = async () => '{}';
providers.complete = async (settings, apiKey, opts) => mockComplete(settings, apiKey, opts);

const { Store } = require('../src/store');
const {
  CIRCLE_GROUPS,
  MAX_GROUP_PEOPLE,
  normalizePersona,
  defaultStarterCircle,
  personaFacts,
  personaPrivacyEntries,
} = require('../src/world/persona');
const {
  DECOYS,
  buildPrivacyMap,
  maskText,
  unmaskText,
  privacyWords,
  previewMasked,
} = require('../src/ai/privacyShield');
const { buildReport } = require('../src/report');
const world = require('../src/world/world');

const tmpDirs = [];
function makeTmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'll-persona-test-'));
  tmpDirs.push(d);
  return d;
}

describe('Phase B Persona, Presets, Inner Circle & Privacy Shield', () => {
  beforeEach(() => {
    mockComplete = async () => '{}';
  });

  after(() => {
    providers.complete = origComplete;
    for (const d of tmpDirs) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('normalizes persona safely, caps inner circle groups at 10, and preserves custom traits', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      role: `Cousin ${i + 1}`,
      name: `Name${i + 1}`,
      protect: i === 2 ? false : true,
    }));
    const raw = {
      preset: 'hometown_kid',
      traits: {
        media: 'warm_open',
        temperament: 'Never steps on the pitch lines first',
        ambition: 'roots_pride',
      },
      roots: {
        hometown: '  "Manaus" \n ',
        childhood: 'Zona Norte',
        academy: 'Nacional FC',
        heritage: 'Amazonian-Italian',
      },
      flavor: {
        signature: 'White ankle tape',
        motto: 'Hungry every matchday',
      },
      circle: {
        family: many,
        friends: [{ role: 'Best friend', name: '' }, { role: '', name: 'Pedro Souza', decoy: 'Rafael', protect: true }],
      },
    };

    const norm = normalizePersona(raw);
    assert.equal(norm.preset, 'hometown_kid');
    assert.equal(norm.traits.temperament, 'Never steps on the pitch lines first');
    assert.equal(norm.roots.hometown, 'Manaus');
    assert.deepEqual(Object.keys(norm.circle), CIRCLE_GROUPS);
    assert.equal(norm.circle.family.length, MAX_GROUP_PEOPLE);
    assert.equal(norm.circle.family[0].protect, true);
    assert.equal(norm.circle.family[2].protect, false);
    assert.equal(norm.circle.friends.length, 2);
  });

  it('compiles compact personaFacts and omits empty starter rows', () => {
    const empty = normalizePersona({ circle: defaultStarterCircle() });
    assert.equal(personaFacts(empty), undefined);

    const p = normalizePersona({
      preset: 'fiery_leader',
      traits: { media: 'diplomatic_leader', ego: 'Obsessed with 6am film sessions' },
      roots: { hometown: 'Curitiba', heritage: 'Polish-Brazilian' },
      flavor: { motto: 'Work in silence' },
      circle: {
        family: [
          { role: 'Mother', name: '' },
          { role: 'Mother', name: 'Clara Rocha' },
        ],
        business: [{ role: 'Agent', name: 'Carlos Mendes' }],
      },
    });
    const facts = personaFacts(p);
    assert.ok(facts.archetype.includes('Fiery captain'));
    assert.equal(facts.traits.media, 'measured, captain-like in mic');
    assert.equal(facts.traits.ego, 'Obsessed with 6am film sessions');
    assert.deepEqual(facts.roots, { hometown: 'Curitiba', heritage: 'Polish-Brazilian' });
    assert.deepEqual(facts.flavor, { motto: 'Work in silence' });
    assert.deepEqual(facts.inner_circle, [
      { group: 'family', role: 'Mother', name: 'Clara Rocha' },
      { group: 'business', role: 'Agent', name: 'Carlos Mendes' },
    ]);
  });

  it('auto-masks persona roots and inner circle with role-aware pools, case insensitivity, overrides, and opt-out', () => {
    const persona = normalizePersona({
      roots: {
        hometown: 'Volta Redonda',
        childhood: 'Laranjal',
        academy: 'Esporte Clube Barra',
        heritage: 'Italian-Brazilian',
      },
      circle: {
        family: [
          { role: 'Mãe', name: 'Ana Paula', protect: true },
          { role: 'Irmã', name: 'Fernanda', protect: true },
        ],
        friends: [
          { role: 'Best friend', name: 'Gabriel Costa', decoy: 'Henrik Lind', protect: true },
        ],
        business: [
          { role: 'Agent', name: 'Marco Tavares', protect: false },
        ],
        roots: [
          { role: 'Animal de compagnie', name: 'Bidu', protect: true },
          { role: 'Premier club', name: 'Escolinha Sul', protect: true },
        ],
      },
    });

    const entries = personaPrivacyEntries(persona);
    assert.equal(entries.people.find((p) => p.role === 'Mãe').kind, 'femaleName');
    assert.equal(entries.people.find((p) => p.role === 'Irmã').kind, 'femaleName');
    assert.equal(entries.people.find((p) => p.role === 'Animal de compagnie').kind, 'pet');
    assert.equal(entries.people.find((p) => p.role === 'Premier club').kind, 'youthClub');
    assert.equal(entries.people.some((p) => p.real === 'Marco Tavares'), false);

    const map = buildPrivacyMap({ enabled: true, fields: {} }, {
      careerId: '99-test',
      playerName: 'Lucas Ribeiro',
      persona,
    });

    const sample = 'VOLTA REDONDA raised him in laranjal near Esporte Clube Barra. His Italian-Brazilian roots shine with Ana Paula, Bidu, Escolinha Sul, GABRIEL COSTA and Marco Tavares.';
    const masked = maskText(sample, map);

    for (const secret of ['VOLTA REDONDA', 'laranjal', 'Esporte Clube Barra', 'Ana', 'Paula', 'Bidu', 'Escolinha Sul', 'GABRIEL', 'COSTA']) {
      assert.equal(masked.toLowerCase().includes(secret.toLowerCase()), false, `Expected "${secret}" to be masked in: ${masked}`);
    }
    // Heritage adjective & opt-out contact must NOT be masked.
    assert.ok(masked.includes('Italian-Brazilian'), `Heritage should stay intact: ${masked}`);
    assert.ok(masked.includes('Marco Tavares'), `protect:false contact should stay unmasked: ${masked}`);
    // Custom decoy override applied with matched uppercase styling.
    assert.ok(masked.includes('HENRIK LIND'), `Expected custom decoy casing preserved: ${masked}`);

    // Role-aware pool check for pet & mother.
    const maskedPet = maskText('Bidu', map);
    assert.ok(DECOYS.pet.includes(maskedPet), `Pet decoy ${maskedPet} should come from pet pool`);
    const maskedSister = maskText('Fernanda', map);
    assert.ok(DECOYS.femaleName.includes(maskedSister), `Sister decoy ${maskedSister} should come from femaleName pool`);

    // Unmask restores original user casing seamlessly.
    const apiReply = masked.replace('VOLTA REDONDA', 'montclair').replace(maskedPet, maskedPet.toLowerCase());
    const unmasked = unmaskText(apiReply, map);
    assert.ok(unmasked.toLowerCase().includes('volta redonda'));
    assert.ok(unmasked.toLowerCase().includes('ana paula'));
    assert.ok(unmasked.toLowerCase().includes('bidu'));
    assert.ok(unmasked.includes('GABRIEL COSTA') || unmasked.toLowerCase().includes('gabriel costa'));

    // Preview & privacyWords agree.
    const words = privacyWords({ enabled: true, fields: {} }, persona);
    assert.ok(words.includes('Volta Redonda'));
    assert.ok(words.includes('Ana Paula'));
    assert.equal(words.includes('Marco Tavares'), false);
    const preview = previewMasked('Greetings from Volta Redonda to Bidu', { enabled: true, fields: {} }, { persona, careerId: '99-test' });
    assert.equal(preview.masked.includes('Volta Redonda'), false);
    assert.equal(preview.masked.includes('Bidu'), false);
  });

  it('scrubs persona details from diagnostic report', () => {
    const report = buildReport({
      version: '1.1.0',
      state: {
        careerId: '101-lucas-ribeiro',
        profile: { handle: 'lucas10', displayName: 'Lucas Ribeiro' },
        snapshot: { gameDate: '2026-10-01', season: '2026-2027', player: { name: 'Lucas Ribeiro' }, club: { name: 'Liverpool FC' }, league: { name: 'Premier League' }, stats: {} },
        persona: {
          roots: { hometown: 'Campinas', childhood: 'Cambui', academy: 'Guarani Youth' },
          circle: { family: [{ role: 'Mother', name: 'Dona Neide', protect: true }] },
        },
        editions: [],
        mail: [],
      },
      logs: {
        activity: 'Synced player from Campinas (Cambui) raised at Guarani Youth cheering with Dona Neide.',
      },
    });
    for (const secret of ['Campinas', 'Cambui', 'Guarani Youth', 'Dona Neide']) {
      assert.equal(report.includes(secret), false, `Report leaked "${secret}"`);
    }
  });

  it('sends masked FACTS.persona in world.post and restores real persona names on return', async () => {
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

    const state = {
      careerId: '501-rafael-mendes',
      profile: { handle: 'rafamendes', displayName: 'Rafael Mendes', followers: 900 },
      privacy: { enabled: true, fields: { playerName: 'Rafael Mendes', handle: 'rafamendes' } },
      feed: [],
      accounts: {},
      editions: [],
      mail: [],
      dms: [],
      promises: [],
      onRecord: [],
      transfers: [],
      seasons: {},
      writers: { national_columnist: 'Alex Scott', national_desk: [] },
      huddles: [],
      snapshot: {
        gameDate: '2026-09-20',
        season: '2026-2027',
        player: { id: 501, name: 'Rafael Mendes', nationality: 'Brazil', age: 20, overall: 77, position: 'AMF', offers: [], interests: [] },
        club: { ref: '20', name: 'Porto', short: 'POR', stadium: 'Dragão' },
        league: { id: 2, name: 'Liga Portugal' },
        coaches: { my: 'Vitor Bruno' },
        stats: { apps: 2, goals: 1, assists: 1, avgRating: 7.2 },
        scorerRace: [],
        squad: [{ name: 'Diogo Costa', pos: 'GK' }],
        table: [{ pos: 1, ref: '20', team: 'Porto', p: 2, w: 2, d: 0, l: 0, gf: 4, ga: 1, pts: 6, form: ['W', 'W'] }],
        fixtures: [],
        roundResults: [],
        nextRound: [],
        rosters: {},
      },
    };
    store.saveCareer(state);
    store.setActiveCareer(state.careerId);

    world.savePersona({
      store,
      persona: {
        preset: 'hometown_kid',
        traits: { media: 'warm_open', motto: 'unknown_key' },
        roots: { hometown: 'Niteroi', academy: 'Canto do Rio' },
        flavor: { motto: 'Never stop dreaming' },
        circle: {
          family: [{ role: 'Mother', name: 'Sonia Mendes', protect: true }],
          friends: [{ role: 'Best friend', name: 'Thiago Alves', protect: true }],
        },
      },
    });

    const promptsSeen = [];
    mockComplete = async (_settings, _key, { system, user }) => {
      promptsSeen.push(`${system}\n${user}`);
      const map = world.privacyMapFor(store.activeCareer(), settings);
      const decoyTown = maskText('Niteroi', map);
      const decoyMom = maskText('Sonia Mendes', map);
      const decoyFriend = maskText('Thiago Alves', map);
      return JSON.stringify({
        replies: [
          {
            handle: 'portofan',
            name: 'Porto Fan',
            type: 'fan',
            text: `Big respect to ${decoyTown}, ${decoyMom} and ${decoyFriend} must be proud!`,
          },
        ],
      });
    };

    await world.post({ store, settings, text: 'Dedicating tonight to Niteroi, Sonia Mendes and Thiago Alves!' });

    assert.equal(promptsSeen.length, 1);
    const outgoing = promptsSeen[0];
    assert.ok(outgoing.includes('"archetype":"Hometown kid'));
    assert.ok(outgoing.includes('"motto":"Never stop dreaming"'));
    for (const secret of ['Rafael', 'Mendes', 'Niteroi', 'Canto do Rio', 'Sonia', 'Thiago', 'Alves']) {
      assert.equal(outgoing.includes(secret), false, `Outgoing AI prompt leaked "${secret}"`);
    }

    const updated = store.activeCareer();
    const reply = updated.feed[0].replies[0].text;
    assert.ok(reply.includes('Niteroi'));
    assert.ok(reply.includes('Sonia Mendes'));
    assert.ok(reply.includes('Thiago Alves'));
  });
});
