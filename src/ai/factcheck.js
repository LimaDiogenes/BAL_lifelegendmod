'use strict';
// Secrétariat de rédaction : une deuxième requête relit le brouillon de l'édition face aux faits
// de la sauvegarde, puis l'app applique elle-même les corrections, mot pour mot.

const providers = require('./providers');
const prompts = require('./prompts');

const FIELDS = {
  national: ['headline', 'dek', 'body'],
  local: ['headline', 'dek', 'body'],
  posts: ['text'],
  emails: ['subject', 'body'],
  pantheon: ['title', 'text'],
  huddle: ['text'],
  huddle_national: ['text'],
};

const LABELS = { national: 'La Transversale', local: 'Journal local', posts: 'Kop', emails: 'Mails', pantheon: 'Panthéon', huddle: 'Vestiaire', huddle_national: 'Vestiaire' };

// Brouillon à relire : un élément par article, post ou mail, repéré par « section.index ».
function draftItems(out) {
  const items = [];
  for (const [section, fields] of Object.entries(FIELDS)) {
    (out[section] || []).forEach((entry, i) => {
      const item = { item: `${section}.${i}` };
      if (section === 'posts') item.author = `@${entry.handle}`;
      if (section === 'huddle' || section === 'huddle_national') item.author = entry.from;
      if (section === 'emails') item.from = entry.from;
      for (const f of fields) if (typeof entry[f] === 'string') item[f] = entry[f];
      items.push(item);
    });
  }
  return items;
}

function locate(out, ref) {
  const [section, index] = String(ref || '').split('.');
  if (!FIELDS[section]) return null;
  return { section, entry: out[section]?.[Number(index)] || null };
}

// Applique les corrections valides et renvoie celles qui ont vraiment été faites.
function applyCorrections(out, corrections) {
  const applied = [];
  for (const c of Array.isArray(corrections) ? corrections : []) {
    const loc = locate(out, c.item);
    if (!loc?.entry || !FIELDS[loc.section].includes(c.field)) continue;
    const text = loc.entry[c.field];
    const find = typeof c.find === 'string' ? c.find : '';
    const replace = typeof c.replace === 'string' ? c.replace : '';
    // Le passage doit exister tel quel : le vérificateur ne peut pas réécrire ce qu'il n'a pas cité.
    if (!find || find === replace || typeof text !== 'string' || !text.includes(find)) continue;
    if (find.length > 400 || replace.length > find.length * 3 + 80) continue;
    loc.entry[c.field] = replace ? text.replace(find, replace) : text.replace(find, '').replace(/ {2,}/g, ' ').replace(/ +\n/g, '\n').replace(/\n +/g, '\n').trim();
    applied.push({
      where: loc.section === 'posts' ? `${LABELS.posts} (@${loc.entry.handle})` : LABELS[loc.section],
      before: find,
      after: replace,
      reason: typeof c.reason === 'string' ? c.reason : '',
    });
  }
  return applied;
}

// Une réponse illisible, souvent coupée net : les corrections arrivées complètes dans « corrections » sont gardées (chaque
// objet relu à part), les autres perdues. null si la réponse n'a même pas de liste de corrections.
function salvageCorrections(text) {
  const t = String(text || '');
  const key = t.indexOf('"corrections"');
  const open = key >= 0 ? t.indexOf('[', key) : -1;
  if (open < 0) return null;
  const out = [];
  let depth = 0, inStr = false, esc = false, start = -1;
  for (let i = open + 1; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') { depth--; if (depth === 0 && start >= 0) { try { out.push(JSON.parse(t.slice(start, i + 1))); } catch { /* objet abîmé */ } start = -1; } }
    else if (c === ']' && depth === 0) break;
  }
  return out;
}

// flags : les phrases que le code a prises en faute (src/world/paperRules.js), corrigées dans la même requête.
async function factCheck(out, { settings, apiKey, facts, changes, flags = [], log, onProgress }) {
  const draft = draftItems(out);
  if (!draft.length) return { checked: true, corrections: [] };
  const text = await providers.complete(settings, apiKey, prompts.withLanguage(settings, {
    system: prompts.factcheckSystem(settings),
    user: prompts.factcheckUser({ facts, changes, draft, flags }),
    maxTokens: 9000,
    log,
    onProgress,
  }));
  let result;
  try { result = providers.parseJson(text); } catch (err) {
    const saved = salvageCorrections(text);
    if (!saved) throw err;
    result = { corrections: saved };
    log?.(`Vérification des faits : réponse coupée, ${saved.length} correction(s) gardée(s).`);
  }
  return { checked: true, corrections: applyCorrections(out, result.corrections) };
}

module.exports = { factCheck, applyCorrections, draftItems, salvageCorrections };
