'use strict';
// Stockage local : réglages (clés chiffrées par Windows) et un dossier par carrière.

const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  savePath: '',
  gameDir: '',       // dossier du jeu (vide = détection automatique)
  autoSync: true,    // synchroniser dès que le jeu réécrit la sauvegarde (activé par défaut)
  autoLatestSave: false, // basculer automatiquement sur l'emplacement BL0000000x modifié le plus récemment
  factCheck: true,   // relire chaque édition face aux faits avant publication (2e requête)
  tribuneThreads: true, // faire discuter les internautes sous les posts après chaque édition (requête de plus)
  transversaleBrief: false, // « Le brief du matin » de La Transversale dans Mails à chaque édition (abonnement sur le site, sans IA)
  replays: true,     // publier les ralentis sauvegardés dans le jeu
  offerRedirect: false, // réorienter une vraie offre vers un autre club en modifiant la sauvegarde (expérimental)
  influenceWrites: false, // écrire dans la sauvegarde les décisions obtenues par l'influence : formation, transferts (expérimental)
  lifeSaveEffects: false, // écrire les effets Ma vie (forme, confiance coach) dans la sauvegarde (expérimental)
  calendarMode: 'basic', // 'basic' (synchro directe) ou 'full' (calendrier jour par jour sans spoiler)
  sponsorMode: 'realistic', // 'realistic' (offres, enchères, exclusivités) ou 'custom' (édition manuelle)
  eventMode: 'realistic', // 'realistic' (anniversaires, vie quotidienne, décisions) ou 'games_only' (matchs seulement)
  autoUpdateCheck: true, // vérifier discrètement les nouvelles versions GitHub au lancement
  clipsDir: '',      // dossier des vidéos enregistrées (vide = Vidéos\Captures, captures du jeu seulement)
  provider: 'google',
  model: 'gemini-3.6-flash',
  baseUrl: '',
  language: 'en',
  fanVulgarity: true, // supporters vulgaires possibles après de très mauvais résultats (décochable)
  theme: 'auto',
  keys: {},          // fournisseur -> clé chiffrée (base64)
};

class Store {
  constructor(dir, safeStorage) {
    this.dir = dir;
    this.safeStorage = safeStorage;
    // Réglages valables pour cette session seulement (--lang, --theme : src/launchArgs.js), jamais écrits sur le disque.
    this.overrides = {};
    // Clés d'IA gardées en mémoire quand Windows ne peut pas les chiffrer : jamais écrites en clair, perdues à la fermeture.
    this.sessionKeys = {};
    fs.mkdirSync(path.join(dir, 'careers'), { recursive: true });
  }

  readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
  }

  writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file);
  }

  // Réglages enregistrés, sans ceux de la session.
  storedSettings() {
    const s = this.readJson(path.join(this.dir, 'settings.json'), {});
    return { ...DEFAULT_SETTINGS, ...s, keys: s.keys || {} };
  }

  getSettings() {
    return { ...this.storedSettings(), ...this.overrides };
  }

  setSessionOverrides(overrides = {}) {
    this.overrides = { ...this.overrides, ...overrides };
  }

  // Le chiffrement des clés par Windows (safeStorage) est-il disponible ?
  canEncrypt() {
    try { return Boolean(this.safeStorage?.isEncryptionAvailable()); } catch { return false; }
  }

  // Version envoyée à l'interface : jamais les clés, seulement lesquelles existent.
  publicSettings() {
    const { keys, ...rest } = this.getSettings();
    const session = Object.keys(this.sessionKeys).filter((k) => !(k in keys));
    return { ...rest, savedKeys: [...Object.keys(keys), ...session], sessionKeys: Object.keys(this.sessionKeys), keyEncryption: this.canEncrypt(), launchedByStudio: Boolean(this.overrides.launchedByStudio) };
  }

  saveSettings(update) {
    const cur = this.storedSettings();
    const next = { ...cur, ...update, keys: { ...cur.keys } };
    delete next.apiKey;
    delete next.savedKeys;
    delete next.sessionKeys;
    delete next.keyEncryption;
    // Un réglage choisi par le joueur remplace celui de la session (et il est gardé).
    for (const k of Object.keys(update)) delete this.overrides[k];
    if (update.apiKey) {
      const provider = update.provider || this.getSettings().provider;
      if (this.canEncrypt()) {
        next.keys[provider] = this.safeStorage.encryptString(update.apiKey).toString('base64');
        delete this.sessionKeys[provider];
      } else {
        // Pas de chiffrement Windows : la clé reste en mémoire pour cette session, jamais écrite en clair.
        this.sessionKeys[provider] = update.apiKey;
        delete next.keys[provider];
      }
    }
    this.writeJson(path.join(this.dir, 'settings.json'), next);
    return this.publicSettings();
  }

  getKey(provider) {
    if (this.sessionKeys[provider]) return this.sessionKeys[provider];
    const enc = this.getSettings().keys[provider];
    if (!enc) return '';
    // Ancienne version : clé écrite en clair quand le chiffrement manquait. Encore lue, plus jamais écrite.
    if (enc.startsWith('plain:')) return enc.slice(6);
    return this.safeStorage.decryptString(Buffer.from(enc, 'base64'));
  }

  careerFile(careerId) {
    return path.join(this.dir, 'careers', careerId, 'state.json');
  }

  loadCareer(careerId) {
    return this.readJson(this.careerFile(careerId), null);
  }

  saveCareer(state) {
    this.writeJson(this.careerFile(state.careerId), state);
  }

  loadAux(careerId, name) {
    return this.readJson(path.join(this.dir, 'careers', careerId, `${name}.json`), null);
  }

  saveAux(careerId, name, value) {
    this.writeJson(path.join(this.dir, 'careers', careerId, `${name}.json`), value);
  }

  setActiveCareer(careerId) {
    this.writeJson(path.join(this.dir, 'active.json'), { careerId });
  }

  activeCareer() {
    const a = this.readJson(path.join(this.dir, 'active.json'), null);
    return a ? this.loadCareer(a.careerId) : null;
  }

  deleteCareer(careerId = null) {
    const active = this.readJson(path.join(this.dir, 'active.json'), null);
    const targetId = String(careerId || active?.careerId || '').trim();
    if (targetId) {
      if (targetId.includes('..') || /[\\/]/.test(targetId)) {
        throw new Error('Identifiant de carrière invalide.');
      }
      const dir = path.join(this.dir, 'careers', targetId);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
      if (!active || active.careerId === targetId) {
        try { fs.rmSync(path.join(this.dir, 'active.json'), { force: true }); } catch { /* ignore */ }
      }
    } else {
      try { fs.rmSync(path.join(this.dir, 'active.json'), { force: true }); } catch { /* ignore */ }
    }
    const cur = this.readJson(path.join(this.dir, 'settings.json'), {});
    if (cur && cur.pendingBio) {
      const next = { ...cur };
      delete next.pendingBio;
      this.writeJson(path.join(this.dir, 'settings.json'), next);
    }
    return { deletedId: targetId || null };
  }
}

module.exports = { Store };
