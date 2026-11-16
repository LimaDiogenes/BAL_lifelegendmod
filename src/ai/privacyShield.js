'use strict';
// Privacy Shield: substitutes personal identifiers (player name, handle, hometown, family, pets, youth club,
// custom words) with consistent fictional decoys locally before any text is sent to an AI provider, and restores
// the real words locally when the response returns. Zero personal identifiers leave the user's PC.

// Distinctive fictional decoys chosen to avoid colliding with real-world football clubs or common player surnames.
const DECOYS = {
  firstName: ['Dorian', 'Cassian', 'Bastien', 'Valentin', 'Soren', 'Henrik', 'Evander', 'Caleb', 'Nolan', 'Tarek', 'Arnaud', 'Kieran', 'Gideon', 'Leander', 'Corbin', 'Alistair'],
  lastName: ['Valcourt', 'Vandenberg', 'Belcourt', 'Montresor', 'Falkner', 'Lindqvist', 'Hargreaves', 'Davenport', 'Bramwell', 'Rovelli', 'Delacroix', 'Solberg', 'Castelmar', 'Lindenhof', 'Pellegrino', 'Valmora'],
  femaleName: ['Clarisse', 'Mireille', 'Coralie', 'Solene', 'Elodie', 'Annelise', 'Juliette', 'Maelle', 'Vivienne', 'Severine', 'Celine', 'Heloise', 'Nadia', 'Valerie', 'Sabine', 'Estelle'],
  nickname: ['Dori', 'Basti', 'Soren', 'Valou', 'Kiki', 'Rico', 'Nolo', 'Taro', 'Cassy', 'Giddy', 'Ari', 'Corby'],
  hometown: ['Montclair', 'Valverde', 'Belleville', 'Silverstone', 'Crestwood', 'Alderwood', 'Oakridge', 'Clairmont', 'Westbrook', 'Cedarvale', 'Riverton', 'Sunridge', 'Fairmeadow', 'Kestrel Bay', 'Lindenberg'],
  region: ['Nordland', 'Alta Vista', 'Costa Verde', 'Montefiore', 'Valcrest', 'Sierra Alta', 'Sunnyland', 'Bela Vista'],
  pet: ['Koda', 'Zephyr', 'Barnaby', 'Otis', 'Pippin', 'Jasper', 'Baxter', 'Ziggy', 'Biscuit', 'Gizmo', 'Comet', 'Scout'],
  youthClub: ['Etoile Valcourt', 'Sporting Valmont', 'Union Clairmont', 'Atletico Riverton', 'Olympique Oakridge', 'FC Crestwood', 'Real Silverstone', 'AS Westbrook'],
  school: ['Oakridge Academy', 'Clairmont High', 'St. Jude Institute', 'Valmont College', 'Riverton Lycee', 'Westbrook School'],
  generic: ['Valmont', 'Clairmont', 'Oakridge', 'Riverton', 'Crestwood', 'Alderwood', 'Westbrook', 'Cedarvale', 'Sunridge', 'Fairmeadow', 'Briarwood', 'Stonebridge'],
};

const PRIVACY_FIELDS = [
  { key: 'playerName', kind: 'fullName' },
  { key: 'nickname', kind: 'nickname' },
  { key: 'handle', kind: 'handle' },
  { key: 'hometown', kind: 'hometown' },
  { key: 'region', kind: 'region' },
  { key: 'partner', kind: 'femaleName' },
  { key: 'father', kind: 'firstName' },
  { key: 'mother', kind: 'femaleName' },
  { key: 'siblings', kind: 'personList' },
  { key: 'friend', kind: 'firstName' },
  { key: 'pet', kind: 'pet' },
  { key: 'youthClub', kind: 'youthClub' },
  { key: 'youthCoach', kind: 'fullName' },
  { key: 'school', kind: 'school' },
  { key: 'custom', kind: 'customList' },
];

const MAX_CUSTOM_PEOPLE = 10;

const PARTICLES = new Set(['de', 'da', 'do', 'dos', 'das', 'du', 'des', 'di', 'del', 'della', 'la', 'le', 'les', 'van', 'von', 'den', 'der', 'el', 'al', 'y', 'e']);

const stripAccents = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cleanVal = (s) => String(s || '').replace(/["\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
const cleanMulti = (s) => String(s || '').replace(/["]+/g, ' ').trim().slice(0, 1000);
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hashStr(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function normalizeCustomPeople(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (out.length >= MAX_CUSTOM_PEOPLE) break;
    if (!item || typeof item !== 'object') continue;
    const label = cleanVal(item.label).slice(0, 60);
    const real = cleanVal(item.real).slice(0, 120);
    const decoy = cleanVal(item.decoy).slice(0, 120);
    if (!label && !real && !decoy) continue;
    out.push({ label, real, decoy });
  }
  return out;
}

function normalizePrivacy(raw) {
  const fields = {};
  const overrides = {};
  for (const { key, kind } of PRIVACY_FIELDS) {
    const val = raw?.fields?.[key];
    fields[key] = kind === 'customList' ? cleanMulti(val) : cleanVal(val);
    const ov = cleanVal(raw?.overrides?.[key]);
    if (ov) overrides[key] = ov;
  }
  return {
    enabled: raw?.enabled !== false,
    fields,
    customPeople: normalizeCustomPeople(raw?.customPeople),
    overrides,
  };
}

function pickFrom(pool, seed, usedDecoys, realLower) {
  const start = hashStr(seed) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(start + i) % pool.length];
    const low = candidate.toLowerCase();
    if (low !== realLower && !usedDecoys.has(low)) {
      usedDecoys.add(low);
      return candidate;
    }
  }
  const fallback = `${pool[start]}_${(hashStr(seed) % 89) + 10}`;
  usedDecoys.add(fallback.toLowerCase());
  return fallback;
}

function parseOverridePair(entry, explicitOverride) {
  const eq = entry.indexOf('=');
  if (eq > 0) {
    const real = cleanVal(entry.slice(0, eq));
    const decoy = cleanVal(entry.slice(eq + 1));
    return real ? { real, decoy: decoy || null } : null;
  }
  const real = cleanVal(entry);
  return real ? { real, decoy: explicitOverride ? cleanVal(explicitOverride) : null } : null;
}

function buildPrivacyMap(privacy, { careerId = '', playerName = '', handle = '' } = {}) {
  const norm = normalizePrivacy(privacy);
  if (!norm.enabled) return { enabled: false, pairs: [], maskRegex: null, unmaskRegex: null };

  const rawEntries = [];
  const usedDecoys = new Set();
  const realLowers = new Set();

  const effectiveFields = { ...norm.fields };
  if (!effectiveFields.playerName && playerName) effectiveFields.playerName = cleanVal(playerName);
  if (!effectiveFields.handle && handle) effectiveFields.handle = cleanVal(handle).replace(/^@/, '');

  // Pre-collect real lowers so auto-picked decoys never collide with any real word.
  for (const { key, kind } of PRIVACY_FIELDS) {
    const raw = effectiveFields[key];
    if (!raw) continue;
    const parts = kind === 'personList' || kind === 'customList' ? raw.split(/[,;\n]+/) : [raw];
    for (const part of parts) {
      const p = parseOverridePair(part, norm.overrides[key]);
      if (!p) continue;
      realLowers.add(p.real.toLowerCase());
      for (const tok of p.real.split(/\s+/)) if (tok.length >= 3) realLowers.add(tok.toLowerCase());
    }
  }
  for (const person of norm.customPeople) {
    if (!person.real) continue;
    realLowers.add(person.real.toLowerCase());
    for (const tok of person.real.split(/\s+/)) if (tok.length >= 3) realLowers.add(tok.toLowerCase());
  }

  const addPair = (real, decoy, kind) => {
    const r = cleanVal(real);
    const d = cleanVal(decoy);
    if (!r || !d || r.toLowerCase() === d.toLowerCase()) return;
    rawEntries.push({ real: r, decoy: d, kind });
  };

  let playerDecoyFirst = null;
  let playerDecoyLast = null;

  for (const { key, kind } of PRIVACY_FIELDS) {
    const raw = effectiveFields[key];
    if (!raw) continue;
    const override = norm.overrides[key];

    if (kind === 'handle') {
      const realHandle = raw.replace(/^@/, '').replace(/[^\w]/g, '');
      if (!realHandle || realHandle.length < 2) continue;
      const decoyHandle = override
        ? override.replace(/^@/, '').replace(/[^\w]/g, '')
        : `${(playerDecoyFirst || pickFrom(DECOYS.firstName, `${careerId}:handle`, usedDecoys, realHandle.toLowerCase())).toLowerCase()}_${(playerDecoyLast || 'fc').slice(0, 3).toLowerCase()}`.replace(/[^\w]/g, '');
      if (decoyHandle) addPair(realHandle, decoyHandle, 'handle');
      continue;
    }

    if (kind === 'fullName') {
      const parsed = parseOverridePair(raw, override);
      if (!parsed) continue;
      const tokens = parsed.real.split(/\s+/).filter(Boolean);
      let decoyFull = parsed.decoy;
      let decoyTokens;
      if (decoyFull) {
        decoyTokens = decoyFull.split(/\s+/).filter(Boolean);
        for (const t of decoyTokens) usedDecoys.add(t.toLowerCase());
      } else {
        const f = pickFrom(DECOYS.firstName, `${careerId}:${key}:f`, usedDecoys, parsed.real.toLowerCase());
        const l = tokens.length > 1 ? pickFrom(DECOYS.lastName, `${careerId}:${key}:l`, usedDecoys, parsed.real.toLowerCase()) : '';
        decoyFull = l ? `${f} ${l}` : f;
        decoyTokens = l ? [f, l] : [f];
      }
      if (key === 'playerName') {
        playerDecoyFirst = decoyTokens[0] || null;
        playerDecoyLast = decoyTokens.at(-1) || null;
      }
      addPair(parsed.real, decoyFull, key);
      // Map significant individual name tokens (>= 3 chars, not particles) so "Diogenes" and "Lima" alone are masked.
      const sigReal = tokens.filter((t) => t.length >= 3 && !PARTICLES.has(t.toLowerCase()));
      if (sigReal.length >= 2) {
        sigReal.forEach((tok, idx) => {
          const dt = idx === 0
            ? decoyTokens[0]
            : idx === sigReal.length - 1
              ? decoyTokens[decoyTokens.length - 1]
              : pickFrom(DECOYS.lastName, `${careerId}:${key}:m${idx}:${tok}`, usedDecoys, tok.toLowerCase());
          if (dt && !realLowers.has(dt.toLowerCase())) addPair(tok, dt, `${key}_part`);
        });
      }
      continue;
    }

    const items = kind === 'personList' || kind === 'customList' ? raw.split(/[,;\n]+/) : [raw];
    for (const [idx, item] of items.entries()) {
      const parsed = parseOverridePair(item, items.length === 1 ? override : null);
      if (!parsed || parsed.real.length < 2) continue;
      const poolKey = kind === 'personList' ? 'firstName' : kind === 'customList' ? 'generic' : kind;
      const pool = DECOYS[poolKey] || DECOYS.generic;
      const decoy = parsed.decoy || pickFrom(pool, `${careerId}:${key}:${idx}:${parsed.real}`, usedDecoys, parsed.real.toLowerCase());
      usedDecoys.add(decoy.toLowerCase());
      addPair(parsed.real, decoy, key);
      // If multi-word name in a person field (e.g. partner "Ana Paula"), also map multi-char parts if unambiguous.
      if (['partner', 'father', 'mother', 'friend', 'siblings'].includes(key)) {
        const realWords = parsed.real.split(/\s+/).filter((w) => w.length >= 3 && !PARTICLES.has(w.toLowerCase()));
        if (realWords.length > 1) {
          const decoyParts = decoy.split(/\s+/);
          realWords.forEach((w, wi) => {
            const dw = decoyParts[wi] || pickFrom(pool, `${careerId}:${key}:${idx}:p${wi}:${w}`, usedDecoys, w.toLowerCase());
            addPair(w, dw, `${key}_part`);
          });
        }
      }
    }
  }

  for (const [idx, person] of norm.customPeople.entries()) {
    if (!person.real || person.real.length < 2) continue;
    const tokens = person.real.split(/\s+/).filter(Boolean);
    let decoyFull = person.decoy || '';
    let decoyTokens;
    if (decoyFull) {
      decoyTokens = decoyFull.split(/\s+/).filter(Boolean);
      for (const t of decoyTokens) usedDecoys.add(t.toLowerCase());
    } else {
      const f = pickFrom(DECOYS.firstName, `${careerId}:customPerson:${idx}:f:${person.real}`, usedDecoys, person.real.toLowerCase());
      const l = tokens.length > 1 ? pickFrom(DECOYS.lastName, `${careerId}:customPerson:${idx}:l:${person.real}`, usedDecoys, person.real.toLowerCase()) : '';
      decoyFull = l ? `${f} ${l}` : f;
      decoyTokens = l ? [f, l] : [f];
    }
    const kindTag = person.label ? `custom:${person.label}` : 'customPerson';
    addPair(person.real, decoyFull, kindTag);
    const sigReal = tokens.filter((t) => t.length >= 3 && !PARTICLES.has(t.toLowerCase()));
    if (sigReal.length >= 2) {
      sigReal.forEach((tok, ti) => {
        const dt = ti === 0
          ? decoyTokens[0]
          : ti === sigReal.length - 1
            ? decoyTokens[decoyTokens.length - 1]
            : pickFrom(DECOYS.lastName, `${careerId}:customPerson:${idx}:m${ti}:${tok}`, usedDecoys, tok.toLowerCase());
        if (dt && !realLowers.has(dt.toLowerCase())) addPair(tok, dt, `${kindTag}_part`);
      });
    }
  }

  // Deduplicate by lowercase `real` (longest/most-specific kept first).
  const byReal = new Map();
  for (const p of rawEntries) {
    const k = p.real.toLowerCase();
    if (!byReal.has(k)) byReal.set(k, p);
  }
  const pairs = [...byReal.values()].sort((a, b) => b.real.length - a.real.length);

  // Build single-pass lookup tables (including accent-insensitive aliases for outgoing masking).
  const maskLookup = new Map();
  for (const p of pairs) {
    maskLookup.set(p.real.toLowerCase(), p.decoy);
    const ascii = stripAccents(p.real).toLowerCase();
    if (ascii !== p.real.toLowerCase() && !maskLookup.has(ascii)) maskLookup.set(ascii, p.decoy);
  }
  const maskTerms = [...maskLookup.keys()].sort((a, b) => b.length - a.length);
  const maskRegex = maskTerms.length
    ? new RegExp(`(?<![\\p{L}\\p{N}_])(${maskTerms.map(escapeRe).join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
    : null;

  // Build single-pass lookup for unmasking (`decoy -> real`).
  const unmaskLookup = new Map();
  for (const p of pairs) {
    const dk = p.decoy.toLowerCase();
    if (!unmaskLookup.has(dk)) unmaskLookup.set(dk, p.real);
    const ascii = stripAccents(p.decoy).toLowerCase();
    if (ascii !== dk && !unmaskLookup.has(ascii)) unmaskLookup.set(ascii, p.real);
  }
  const unmaskTerms = [...unmaskLookup.keys()].sort((a, b) => b.length - a.length);
  const unmaskRegex = unmaskTerms.length
    ? new RegExp(`(?<![\\p{L}\\p{N}_])(${unmaskTerms.map(escapeRe).join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
    : null;

  return { enabled: true, pairs, maskLookup, maskRegex, unmaskLookup, unmaskRegex };
}

function matchCase(matched, replacement) {
  if (matched.length >= 2 && matched === matched.toUpperCase() && matched !== matched.toLowerCase()) {
    return replacement.toUpperCase();
  }
  return replacement;
}

function maskText(text, map) {
  if (!map?.enabled || !map.maskRegex || typeof text !== 'string' || !text) return text;
  return text.replace(map.maskRegex, (m) => {
    const hit = map.maskLookup.get(m.toLowerCase()) || map.maskLookup.get(stripAccents(m).toLowerCase());
    return hit ? matchCase(m, hit) : m;
  });
}

function unmaskText(text, map) {
  if (!map?.enabled || !map.unmaskRegex || typeof text !== 'string' || !text) return text;
  return text.replace(map.unmaskRegex, (m) => {
    const hit = map.unmaskLookup.get(m.toLowerCase()) || map.unmaskLookup.get(stripAccents(m).toLowerCase());
    return hit ? matchCase(m, hit) : m;
  });
}

function privacyWords(privacy) {
  const norm = normalizePrivacy(privacy);
  const words = [];
  for (const { key, kind } of PRIVACY_FIELDS) {
    const raw = norm.fields[key];
    if (!raw) continue;
    const parts = kind === 'personList' || kind === 'customList' ? raw.split(/[,;\n]+/) : [raw];
    for (const part of parts) {
      const p = parseOverridePair(part);
      if (!p) continue;
      words.push(p.real);
      for (const tok of p.real.split(/\s+/)) if (tok.length >= 3 && !PARTICLES.has(tok.toLowerCase())) words.push(tok);
    }
  }
  for (const person of norm.customPeople) {
    if (!person.real) continue;
    words.push(person.real);
    for (const tok of person.real.split(/\s+/)) if (tok.length >= 3 && !PARTICLES.has(tok.toLowerCase())) words.push(tok);
  }
  return [...new Set(words)];
}

function previewMasked(text, privacy, ctx = {}) {
  const map = buildPrivacyMap({ ...normalizePrivacy(privacy), enabled: true }, ctx);
  return {
    masked: maskText(String(text || ''), map),
    pairs: map.pairs.map(({ real, decoy, kind }) => ({ real, decoy, kind })),
  };
}

module.exports = {
  DECOYS,
  PRIVACY_FIELDS,
  MAX_CUSTOM_PEOPLE,
  normalizePrivacy,
  buildPrivacyMap,
  maskText,
  unmaskText,
  privacyWords,
  previewMasked,
};
