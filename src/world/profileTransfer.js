'use strict';
// Transfert de profil (2.0) : le joueur exporte ce qui fait son personnage (entourage, traits, racines, biographie,
// profil Kop, choix de confidentialité) dans un fichier JSON, pour le reprendre dans une autre carrière. En option :
// les réglages (jamais les clés d'IA ni les dossiers propres à ce PC), les sponsors et ses événements du calendrier.
// L'historique de la carrière (posts, mails, statistiques, calendrier du jeu) n'en fait jamais partie.

const { normalizePersona } = require('./persona');
const { normalizePrivacy } = require('../ai/privacyShield');
const { setBio } = require('./pantheon');
const { ensureLifeHub, isDuplicateSponsor, normalizeSponsorEntry } = require('./lifeHub');
const { ensureCalendar, addCustomCalendarEvent } = require('./calendar');
const { syncAgentWithPersona } = require('./agent');

const FORMAT = 'lifelegend-profile';
const VERSION = 1;
// Réglages propres à ce PC ou secrets : jamais exportés, jamais importés.
const SETTINGS_SKIP = new Set(['keys', 'apiKey', 'savedKeys', 'sessionKeys', 'keyEncryption', 'savePath', 'gameDir', 'clipsDir']);
const PROFILE_FIELDS = ['location', 'bio', 'website', 'bannerColor'];

const plain = (v) => JSON.parse(JSON.stringify(v ?? null));

function buildProfileExport(state, settings, { settings: withSettings = true, sponsors = false, calendar = false } = {}) {
  const out = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    player: state.profile?.displayName || '',
    persona: plain(state.persona),
    privacy: plain(state.privacy),
    bio: { text: state.bio?.text || '', playerKind: state.playerKind || null },
    profile: Object.fromEntries(PROFILE_FIELDS.filter((k) => state.profile?.[k] !== undefined).map((k) => [k, state.profile[k]])),
  };
  if (withSettings && settings) out.settings = Object.fromEntries(Object.entries(settings).filter(([k]) => !SETTINGS_SKIP.has(k)).map(([k, v]) => [k, plain(v)]));
  if (sponsors) out.sponsors = plain((state.lifeHub?.sponsors || []).filter((s) => !s.linkedBootDeal));
  if (calendar) out.customEvents = plain(state.calendar?.customEvents || []);
  return out;
}

function checkProfileFile(data) {
  if (!data || typeof data !== 'object' || data.format !== FORMAT || !Number.isInteger(data.version)) throw new Error('Ce fichier n’est pas un profil LifeLegend.');
  if (data.version > VERSION) throw new Error('Ce profil vient d’une version plus récente de LifeLegend : mets l’application à jour.');
  return data;
}

// Réglages du fichier qu'on peut reprendre : connus ici, du même type, ni secrets ni dossiers de ce PC.
function importableSettings(fileSettings, current) {
  if (!fileSettings || typeof fileSettings !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(fileSettings)) {
    if (SETTINGS_SKIP.has(k) || !(k in current)) continue;
    const cur = current[k];
    if (cur !== null && cur !== undefined && typeof cur !== typeof v) continue;
    out[k] = v;
  }
  return out;
}

// Applique le fichier à la carrière : le profil remplace l'actuel ; sponsors et événements s'ajoutent (sans doublons).
function applyProfileImport(state, data, { sponsors = false, calendar = false } = {}, newId = () => `id_${Date.now()}`) {
  checkProfileFile(data);
  const applied = { profile: true, sponsors: 0, events: 0 };
  if (data.persona) { state.persona = normalizePersona(data.persona); syncAgentWithPersona(state); }
  if (data.privacy) state.privacy = normalizePrivacy(data.privacy);
  if (data.bio && typeof data.bio === 'object') setBio(state, String(data.bio.text || ''), data.bio.playerKind === 'real' || data.bio.playerKind === 'created' ? data.bio.playerKind : null);
  if (data.profile && state.profile) {
    const p = data.profile;
    if (typeof p.location === 'string') state.profile.location = p.location.replace(/\s+/g, ' ').trim().slice(0, 30);
    if (typeof p.bio === 'string') state.profile.bio = p.bio.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 160);
    if (typeof p.website === 'string') state.profile.website = p.website.replace(/\s/g, '').slice(0, 100);
    if (typeof p.bannerColor === 'string') state.profile.bannerColor = p.bannerColor;
  }
  if (sponsors && Array.isArray(data.sponsors)) {
    const hub = ensureLifeHub(state, state.snapshot);
    const today = state.snapshot?.gameDate || '';
    for (const raw of data.sponsors) {
      const norm = normalizeSponsorEntry(raw, newId(), today);
      if (!norm || isDuplicateSponsor(hub.sponsors, norm)) continue;
      norm.id = newId();
      hub.sponsors.push(norm);
      applied.sponsors += 1;
    }
  }
  if (calendar && Array.isArray(data.customEvents)) {
    const cal = ensureCalendar(state, state.snapshot);
    for (const ev of data.customEvents) {
      if (cal.customEvents.some((e) => e.date === ev?.date && e.title === ev?.title)) continue;
      try { addCustomCalendarEvent(state, ev, newId); applied.events += 1; } catch { /* date ou titre invalide : ignoré */ }
    }
  }
  return applied;
}

module.exports = { FORMAT, VERSION, buildProfileExport, checkProfileFile, importableSettings, applyProfileImport };
