'use strict';

const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell, Notification, nativeImage, nativeTheme, net, clipboard } = require('electron');
const { tr, trError } = require('./src/i18n');
const fs = require('fs');
const path = require('path');
const { Store } = require('./src/store');
const { peekSave } = require('./src/save/blReader');
const { scanSaveFiles, snapshotWatchedFiles, detectModifiedSave, resolveSaveForSync } = require('./src/save/autoSaveWatch');
const { setSaveKeys } = require('./src/save/pesCrypt');
const { answerAdvice } = require('./src/world/coachAdvice');
const { answerSponsor } = require('./src/world/sponsors');
const { dmContacts, findDm } = require('./src/world/dms');
const { setBio } = require('./src/world/pantheon');
const { normalizePrivacy, previewMasked } = require('./src/ai/privacyShield');
const { PROVIDERS, isDailyQuota, listModels } = require('./src/ai/providers');
const { detectGameFolders, isGameDir } = require('./src/save/gameDb');
const { defaultClipsDir } = require('./src/world/media');
const world = require('./src/world/world');
const { buildReport } = require('./src/report');
const { externalUrl, samePage } = require('./src/links');
const { checkSettingsUpdate } = require('./src/settingsGuard');
const logoPack = require('./src/logoPack');
const { pathToFileURL } = require('url');
const { parseLaunchArgs, applyLaunchArgs } = require('./src/launchArgs');
const { playerFaces } = require('./src/world/playerFaces');
const { dominantColors } = require('./src/world/clubColors');

// La mod s'appelait LiveTweet : son dossier de données garde ce nom (carrières, réglages, clés, mémoire du
// navigateur), pour que le changement de nom ne perde rien.
app.setPath('userData', path.join(app.getPath('appData'), 'LiveTweet'));

// L'interface est LifeLegend (lifelegend/). L'ancienne, LegendLife, est archivée dans ../archives/legendlife-2026-10-21
// (avec le main.js qui savait ouvrir l'une ou l'autre).
const APP_NAME = 'LifeLegend';

let win;
let store;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 480,
    minHeight: 560,
    title: APP_NAME,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0c0c0d' : '#dfdfdc',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'lifelegend', 'index.html'));
  // Les liens s'ouvrent dans le vrai navigateur, jamais dans l'appli.
  // Seulement https:// et mailto: (src/links.js) ; tout le reste est bloqué.
  win.webContents.setWindowOpenHandler(({ url }) => {
    const ext = externalUrl(url);
    if (ext) shell.openExternal(ext);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (samePage(url, win.webContents.getURL())) return;
    e.preventDefault();
    const ext = externalUrl(url);
    if (ext) shell.openExternal(ext);
  });
}

// Sauvegardes Become a Legend trouvées dans Documents\KONAMI (PES 2021, Football Life jusqu'à 2026) et
// Documents\SPGAME (Football Life 2027 : SPGAME\Football Life\2027\save), triées de la plus récente à la plus ancienne.
function detectSaves() {
  const curSave = store?.getSettings()?.savePath;
  return scanSaveFiles({ documentsDir: app.getPath('documents'), extraFiles: curSave ? [curSave] : [] });
}

// Clés de sauvegarde ajoutées par le joueur (Football Life 2027…) : des fichiers de 64 octets dans data/keys, jamais
// fournis par LifeLegend ni envoyés ailleurs. Chargées au démarrage et après chaque ajout.
const keysDir = () => path.join(store.dir, 'keys');
function loadSaveKeys() {
  let files = [];
  try { files = fs.readdirSync(keysDir()).filter((f) => f.toLowerCase().endsWith('.bin')); } catch { /* aucune clé */ }
  const keys = files.map((f) => { try { return fs.readFileSync(path.join(keysDir(), f)); } catch { return null; } }).filter((k) => k?.length === 64);
  setSaveKeys(keys);
  return keys.length;
}

// La dernière raison pour laquelle un journal n'a pas pu s'écrire (montrée dans le rapport « Signaler un problème »).
let logWriteError = null;
function logError(where, err) {
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'data', 'errors.log'), `${new Date().toISOString()} [${where}] ${err.stack || err}\n\n`);
  } catch (e) { logWriteError = `errors.log : ${e.code || ''} ${e.message}`; }
}

// Journal de la synchro automatique (diagnostic) : gardé court, les lignes les plus récentes à la fin.
function logActivity(msg) {
  try {
    const file = path.join(app.getPath('userData'), 'data', 'activity.log');
    if (fs.existsSync(file) && fs.statSync(file).size > 200000) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').slice(-100000));
    fs.appendFileSync(file, `${new Date().toISOString()} ${msg}\n`);
  } catch (e) { logWriteError = `activity.log : ${e.code || ''} ${e.message}`; }
}

// Progression des appels à l'IA, affichée dans le HUD de l'interface.
const progress = (event) => win?.webContents.send('ai:progress', event);

// Le journal de la dernière synchro, gardé en mémoire pour « Signaler un problème » (rien n'est écrit sur le disque).
let syncLog = [];
const syncLine = (msg) => { syncLog.push(`${new Date().toISOString().slice(11, 19)} ${msg}`); if (syncLog.length > 400) syncLog = syncLog.slice(-400); win?.webContents.send('sync:log', msg); };

// Une seule synchro à la fois : un clic pendant une synchro automatique attend la même.
let syncing = null;
function runSync() {
  if (!syncing) {
    logActivity('synchro : début');
    syncLog = [];
    const { settings, switchedTo } = resolveSaveForSync({ store, documentsDir: app.getPath('documents') });
    if (switchedTo) {
      logActivity(`sauvegarde la plus récente chargée : ${switchedTo.path}`);
      win?.webContents.send('sync:auto', { phase: 'switched-save', savePath: switchedTo.path, info: switchedTo, settings: store.publicSettings() });
    }
    syncing = world.sync({ store, settings, log: syncLine, progress })
      .then((state) => {
        const status = state.lastSync?.published ? 'édition publiée'
          : state.lastSync?.deferredCalendar ? `calendrier différé (${state.lastSync.queuedCount || 0} match(s), ${state.lastSync.daysBehind || 0} j)`
            : state.lastSync?.agentMail ? 'mail de l’agent'
              : 'rien de nouveau';
        logActivity(`synchro : terminée (${status}, ${state.lastSync?.gameDate})${state.lastSync?.durations ? ` · ${state.lastSync.durations}` : ''}`);
        return state;
      },
        (err) => { logActivity(`synchro : erreur (${err.message})`); throw err; })
      .finally(() => { syncing = null; });
  }
  return syncing;
}

// Synchro automatique : on surveille la sauvegarde (ou tous les emplacements BL0000000x si autoLatestSave est actif)
// et on synchronise en arrière-plan dès que le jeu a fini d'écrire.
let watchTimer = null;
let watchedSnap = new Map();
let pending = null;
function setupAutoSync() {
  if (watchTimer) {
    clearInterval(watchTimer);
    watchTimer = null;
  }
  const s0 = store.getSettings();
  if (s0.autoLatestSave && !s0.savePath) {
    resolveSaveForSync({ store, documentsDir: app.getPath('documents') });
  }
  const s = store.getSettings();
  if (!s.autoSync || (!s.savePath && !s.autoLatestSave)) {
    watchedSnap = new Map();
    return;
  }
  const docsDir = app.getPath('documents');
  watchedSnap = snapshotWatchedFiles({ documentsDir: docsDir, savePath: s.savePath, autoLatestSave: Boolean(s.autoLatestSave) });
  logActivity(`surveillance auto-sync (${s.autoLatestSave ? 'emplacement le plus récent' : s.savePath})`);
  watchTimer = setInterval(() => {
    const cur = store.getSettings();
    if (!cur.autoSync) return;
    const nextSnap = snapshotWatchedFiles({ documentsDir: docsDir, savePath: cur.savePath, autoLatestSave: Boolean(cur.autoLatestSave) });
    const changed = detectModifiedSave(watchedSnap, nextSnap);
    watchedSnap = nextSnap;
    if (!changed) return;
    logActivity(`sauvegarde modifiée (${changed.path}, ${changed.size} octets, ${new Date(changed.mtimeMs).toISOString()})`);
    win?.webContents.send('sync:auto', { phase: 'detected', savePath: changed.path });
    clearTimeout(pending);
    pending = setTimeout(() => autoSync(0, changed.path), 6000); // le jeu écrit en plusieurs fois : on attend qu'il ait fini
  }, 4000);
}

// Après un échec passager de l'IA (réseau, serveur surchargé), on retente plus tard, 3 fois au plus.
let aiRetries = 0;

async function autoSync(attempt, detectedPath = null) {
  const s0 = store.getSettings();
  const targetPath = detectedPath || s0.savePath;
  if (!win || !targetPath) return;
  let info = null;
  try {
    info = peekSave(targetPath); // fichier complet et lisible ?
  } catch (err) {
    logActivity(`sauvegarde pas encore lisible (essai ${attempt + 1}) : ${err.message}`);
    if (attempt < 3) pending = setTimeout(() => autoSync(attempt + 1, targetPath), 8000);
    return;
  }
  if (s0.autoLatestSave && targetPath !== s0.savePath) {
    store.saveSettings({ savePath: targetPath });
    logActivity(`bascule automatique sur la sauvegarde la plus récente : ${targetPath}`);
    win.webContents.send('sync:auto', { phase: 'switched-save', savePath: targetPath, info: { path: targetPath, ...info }, settings: store.publicSettings() });
  }
  const s = store.getSettings();
  const fresh = s.pendingBio?.savePath === targetPath ? null : world.newCareerInfo({ store, settings: s });
  if (fresh) { win.webContents.send('sync:auto', { phase: 'new-career', info: fresh, savePath: targetPath }); return; }
  win.webContents.send('sync:auto', { phase: 'start', savePath: targetPath });
  logActivity(syncing ? 'synchro auto : une synchro est déjà en cours, on attend la même' : 'synchro auto : début');
  try {
    const state = await runSync();
    aiRetries = 0;
    win.webContents.send('sync:auto', { phase: 'done', state });
    const lang = lang0();
    if (state.lastSync?.published && !win.isFocused() && Notification.isSupported()) {
      const head = state.editions.at(-1)?.local?.[0]?.headline || tr(lang, 'Nouvelle édition publiée');
      new Notification({ title: `${APP_NAME} · ${tr(lang, 'nouvelle édition')}`, body: head }).show();
    } else if (state.lastSync?.agentMail && !win.isFocused() && Notification.isSupported()) {
      new Notification({ title: `${APP_NAME} · Mails`, body: tr(lang, 'Offre de contrat reçue : ton agent t’a écrit.') }).show();
    }
  } catch (err) {
    logError('auto-sync', err);
    let error = withHint(err, trError(lang0(), err.message || String(err)));
    // Quota du jour épuisé : rien ne sert de réessayer dans 3 minutes.
    if (err.retryable && syncHint(err) !== 'quota' && aiRetries < 3) {
      aiRetries++;
      error += ` ${tr(lang0(), 'Nouvel essai automatique dans 3 minutes ({n}/3).', { n: aiRetries })}`;
      clearTimeout(pending);
      pending = setTimeout(() => autoSync(0), 3 * 60 * 1000);
    } else {
      aiRetries = 0;
    }
    win.webContents.send('sync:auto', { phase: 'error', error });
  }
}

// Ralentis et vidéos : vérifiés toutes les 10 s quand l'app est ouverte (jamais pendant une synchro).
function startMediaWatch() {
  setInterval(() => {
    if (syncing || !win) return;
    try {
      const state = world.refreshMedia({ store, settings: store.getSettings() });
      if (state) win.webContents.send('media:update', state);
    } catch (err) {
      logError('media', err);
    }
  }, 10000);
}

// Dossier des logos téléchargés (pack séparé, 2.0).
const logosDir = () => path.join(app.getPath('userData'), 'media', 'sponsors');

// Langue choisie dans les réglages (interface et contenus).
const lang0 = () => { try { return store?.getSettings().language || 'en'; } catch { return 'en'; } };

// Toutes les erreurs remontent à l'interface sous forme de message lisible, dans la langue choisie,
// et sont gardées dans errors.log (en français) pour le diagnostic.
function handle(channel, fn, { hint = false } = {}) {
  ipcMain.handle(channel, async (_e, arg) => {
    try {
      return { ok: true, value: await fn(arg) };
    } catch (err) {
      logError(channel, err);
      return { ok: false, error: withHint(hint && err, trError(lang0(), err.message || String(err))) };
    }
  });
}

// Genre d'une erreur de synchro, pour que l'interface dise quoi faire et propose le bon bouton : réglages de la
// sauvegarde ou de l'IA, quota du jour épuisé, sauvegarde en cours d'écriture par le jeu, ou erreur passagère.
function syncHint(err) {
  const msg = String(err?.message || '');
  if (['EBUSY', 'EPERM', 'EACCES'].includes(err?.code)) return 'busy';
  if (err?.code === 'SAVE_KEY') return 'key';
  if (/^Choisis ta sauvegarde/.test(msg)) return 'pick';
  if (err?.code === 'ENOENT' || /^(Sauvegarde illisible|Fichier trop petit|Ce fichier est une sauvegarde)/.test(msg)) return 'save';
  if (isDailyQuota(err)) return 'quota';
  if (/^(Aucune clé d'IA|Clé .+ refusée|Modèle introuvable|Aucun modèle choisi|Le modèle « .+ » est introuvable|Renseigne l'adresse|Fournisseur inconnu)/.test(msg)) return 'ai';
  return err?.retryable ? 'retry' : null;
}
// Le genre passe devant le message (« ⟦quota⟧ … ») : entre le processus principal et la page, une erreur ne garde
// que son message.
const withHint = (err, message) => { const h = err && syncHint(err); return h ? `⟦${h}⟧ ${message}` : message; };

// Arguments de lancement (blue41 PES2021 Mod Studio, raccourcis) : --save= --game= --lang= --theme= (src/launchArgs.js).
const launchArgs = parseLaunchArgs(process.argv);
function useLaunchArgs(args, where) {
  if (!store || !Object.keys(args).length) return false;
  const { applied, rejected } = applyLaunchArgs(store, args, { peek: peekSave });
  if (applied.length || rejected.length) logActivity(`arguments de lancement (${where}) : appliqués [${applied.join(', ')}], refusés [${rejected.join(', ')}]`);
  return applied.length > 0;
}

// Une seule fenêtre à la fois : un second lancement ramène la première au premier plan, avec ses arguments (le Mod
// Studio peut ainsi changer de sauvegarde, de jeu ou de langue dans la fenêtre déjà ouverte).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', (_e, argv) => {
  if (!win) return;
  if (useLaunchArgs(parseLaunchArgs(argv), 'second lancement')) {
    setupAutoSync();
    win.webContents.reload();
  }
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  if (!gotLock) return;
  store = new Store(path.join(app.getPath('userData'), 'data'), safeStorage);
  useLaunchArgs(launchArgs, 'démarrage');

  handle('settings:get', () => ({ settings: store.publicSettings(), providers: PROVIDERS, version: app.getVersion() }));
  handle('settings:save', (update) => {
    const saved = store.saveSettings(checkSettingsUpdate(update, store.getSettings(), { peek: peekSave }));
    setupAutoSync();
    return saved;
  });
  handle('ai:models', async (payload = {}) => {
    const cur = store.getSettings();
    const provider = payload.provider || cur.provider;
    const baseUrl = payload.baseUrl !== undefined ? String(payload.baseUrl || '').trim() : cur.baseUrl;
    const apiKey = String(payload.apiKey || '').trim() || store.getKey(provider);
    return listModels({ ...cur, provider, baseUrl }, apiKey);
  });
  loadSaveKeys();
  handle('saves:detect', () => detectSaves());
  handle('keys:count', () => loadSaveKeys());
  handle('keys:add', async () => {
    const r = await dialog.showOpenDialog(win, { title: tr(lang0(), 'Choisir la clé de sauvegarde (fichier de 64 octets)'), properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const key = fs.readFileSync(r.filePaths[0]);
    if (key.length !== 64) throw new Error('Ce fichier n’est pas une clé de sauvegarde : une clé fait 64 octets.');
    const name = `cle-${require('crypto').createHash('sha256').update(key).digest('hex').slice(0, 12)}.bin`;
    const added = !fs.existsSync(path.join(keysDir(), name));
    fs.mkdirSync(keysDir(), { recursive: true });
    fs.writeFileSync(path.join(keysDir(), name), key);
    return { added, count: loadSaveKeys() };
  });
  handle('saves:browse', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: tr(lang0(), 'Choisir la sauvegarde Become a Legend (BL00000000, BL00000001…)'),
      defaultPath: path.join(app.getPath('documents'), fs.existsSync(path.join(app.getPath('documents'), 'SPGAME')) ? 'SPGAME' : 'KONAMI'),
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const info = peekSave(r.filePaths[0]);
    if (info.fileType !== 'BL') throw new Error(`Ce fichier est une sauvegarde « ${info.fileType} ». Choisis un fichier BL0000000x, jeu fermé.`);
    return { path: r.filePaths[0], ...info };
  });
  handle('game:detect', () => detectGameFolders());
  handle('game:browse', async () => {
    const r = await dialog.showOpenDialog(win, { title: tr(lang0(), 'Choisir le dossier du jeu (Football Life ou PES 2021)'), properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    if (!isGameDir(r.filePaths[0])) throw new Error('Ce dossier n’est pas celui du jeu (Football Life ou PES 2021). Choisis son dossier d’installation.');
    return r.filePaths[0];
  });
  handle('clips:default', () => defaultClipsDir());
  handle('clips:browse', async () => {
    const r = await dialog.showOpenDialog(win, { title: tr(lang0(), 'Choisir le dossier de tes vidéos (captures)'), defaultPath: defaultClipsDir(), properties: ['openDirectory'] });
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  });
  handle('state:get', () => world.loadState(store));
  handle('scores:get', () => world.loadScores({ store }));
  handle('mentions:list', () => world.mentionDirectory(store.activeCareer()));
  handle('sync', () => runSync(), { hint: true });
  handle('feed:post', (arg) => { const { text, quote, poll } = typeof arg === 'string' ? { text: arg } : arg || {}; return world.post({ store, settings: store.getSettings(), text, quote, poll, progress }); });
  handle('feed:like', ({ postId, replyId }) => world.likePost({ store, postId, replyId }));
  handle('feed:repost', ({ postId, replyId }) => world.repostPost({ store, postId, replyId }));
  handle('feed:follow', (handle) => world.followAccount({ store, handle }));
  handle('feed:reply', ({ postId, replyId, text }) => world.replyToPost({ store, settings: store.getSettings(), postId, replyId, text, progress }));
  handle('press:open', () => world.openPress({ store, settings: store.getSettings(), progress }));
  handle('press:submit', (answers) => world.submitPress({ store, settings: store.getSettings(), answers, progress }));
  handle('press:skip', () => world.skipPress({ store }));
  handle('dictation:transcribe', (audio) => world.transcribeDictation({ store, settings: store.getSettings(), audio }));
  handle('agent:stance', (stance) => world.setAgentStance({ store, stance }));
  handle('agent:request', (club) => world.setTransferRequest({ store, club }));
  // Écrit dans la sauvegarde (jeu fermé, copie gardée) : la surveillance relance ensuite une synchro.
  handle('offer:redirect', ({ offerId, toRef }) => {
    const r = world.redirectOffer({ store, settings: store.getSettings(), offerId, toRef });
    logActivity(`offre réorientée : ${r.result.from} -> ${r.result.to} (${r.result.changes.join(', ')})`);
    return r;
  });
  // Influence : demandes à l'entraîneur et au club, et décisions écrites dans la sauvegarde (jeu fermé, copie gardée).
  handle('influence:get', () => world.influenceView({ store, settings: store.getSettings() }));
  handle('influence:search', ({ query, pos }) => world.influenceSearch({ store, query, pos }));
  handle('influence:request', ({ kind, params, message }) => world.influenceRequest({ store, settings: store.getSettings(), kind, params, message, progress }));
  handle('influence:apply', (effectId) => {
    const r = world.influenceApply({ store, settings: store.getSettings(), effectId });
    logActivity(`influence écrite dans la sauvegarde : ${r.result.kind} ${r.result.name || ''} (${r.result.changes.join(', ')})`);
    return r;
  });
  // Mise à l'écart décidée par le club : ses jours d'indisponibilité écrits dans la sauvegarde (jeu fermé, copie gardée).
  handle('conduct:apply', () => {
    const r = world.conductApply({ store, settings: store.getSettings() });
    logActivity(`mise à l'écart écrite dans la sauvegarde : ${r.result.changes.join(', ')}`);
    return r;
  });
  handle('mail:reply', ({ threadId, text }) => world.replyMail({ store, settings: store.getSettings(), threadId, text, progress }));
  handle('mail:read', (threadId) => {
    const state = store.activeCareer();
    const t = state?.mail.find((m) => m.id === threadId);
    if (t) { t.unread = false; store.saveCareer(state); }
    return state;
  });
  handle('dm:send', ({ handle: to, text }) => world.sendDm({ store, settings: store.getSettings(), handle: to, text, progress }));
  handle('dm:contacts', () => { const state = store.activeCareer(); return state ? dmContacts(state) : []; });
  handle('huddle:send', ({ text, groupId }) => world.sendHuddle({ store, settings: store.getSettings(), text, groupId, progress }));
  handle('huddle:read', (groupId) => world.readHuddle({ store, settings: store.getSettings(), groupId }));
  handle('dm:read', (to) => {
    const state = store.activeCareer();
    const t = state && findDm(state, to);
    if (t?.unread) { t.unread = false; store.saveCareer(state); }
    return state;
  });
  handle('coach:advice', (choice) => {
    const state = store.activeCareer();
    if (!state) throw new Error('Synchronise ta sauvegarde une première fois.');
    answerAdvice(state, choice, { language: lang0(), gameDate: state.snapshot?.gameDate });
    store.saveCareer(state);
    return state;
  });
  handle('sponsor:answer', (choice) => {
    const state = store.activeCareer();
    if (!state) throw new Error('Synchronise ta sauvegarde une première fois.');
    answerSponsor(state, choice, { language: lang0(), gameDate: state.snapshot?.gameDate });
    store.saveCareer(state);
    return state;
  });
  handle('career:new', () => world.newCareerInfo({ store, settings: store.getSettings() }));
  handle('career:reset', () => world.resetCareer({ store }));
  handle('squad:saveBirthdays', (overrides) => world.saveSquadBirthdays({ store, overrides }));
  handle('bio:save', ({ text, kind }) => {
    const state = store.activeCareer();
    if (!state) throw new Error('Synchronise ta sauvegarde une première fois.');
    setBio(state, text, kind);
    store.saveCareer(state);
    return state;
  });
  handle('privacy:save', (privacy) => world.savePrivacy({ store, privacy }));
  handle('persona:save', (persona) => world.savePersona({ store, persona }));
  handle('agent:update', (payload) => world.updateAgent({ store, ...(payload || {}) }));
  handle('bio:generate', (payload) => world.generateBackstory({ store, settings: store.getSettings(), ...(payload || {}) }));
  handle('lifeHub:calibrate', (payload) => world.calibrateCareerLifeHub({ store, payload }));
  handle('lifeHub:buyAsset', (payload) => world.buyLifeAsset({ store, payload }));
  handle('lifeHub:sellAsset', (assetId) => world.sellLifeAsset({ store, assetId }));
  handle('lifeHub:catalog', () => world.getSponsorCatalog({ store }));
  handle('lifeHub:addSponsor', (payload) => world.addLifeSponsor({ store, payload, manual: true }));
  handle('lifeHub:updateSponsor', (payload) => world.updateLifeSponsor({ store, payload, manual: true }));
  handle('lifeHub:removeSponsor', (id) => world.removeLifeSponsor({ store, id, manual: true }));
  handle('lifeHub:answerOffer', ({ offerId, choice, allowBuyout }) => world.answerLifeSponsorOffer({ store, offerId, choice, allowBuyout }));
  handle('lifeHub:answerBiddingWar', ({ warId, action, bidId }) => world.answerLifeBiddingWar({ store, warId, action, bidId }));
  handle('lifeHub:answerOneTimeDeal', ({ dealId, choice, date }) => world.answerLifeOneTimeDeal({ store, dealId, choice, date }));
  handle('lifeHub:completeObligation', ({ obligationId, skip }) => world.completeLifeObligation({ store, obligationId, skip }));
  handle('lifeHub:rescheduleObligation', ({ obligationId, date }) => world.rescheduleLifeObligation({ store, obligationId, date }));
  handle('lifeHub:action', (payload) => world.doLifeAction({ store, payload }));
  handle('lifeHub:dilemma', ({ dilemmaId, choiceId }) => world.answerLifeDilemma({ store, dilemmaId, choiceId }));
  handle('lifeHub:setMedia', (payload) => world.setLifeMedia({ store, payload }));
  handle('lifeHub:applySaveEffects', () => {
    const r = world.applyLifeSaveEffects({ store, settings: store.getSettings() });
    logActivity(`effets Ma vie écrits dans la sauvegarde : ${r.result.changes.join(', ')}`);
    return r;
  });
  handle('lifeHub:dismissSaveEffects', () => world.dismissLifeSaveEffects({ store }));
  handle('calendar:agenda', ({ month } = {}) => world.getCalendarAgenda({ store, month }));
  handle('calendar:advance', async ({ mode, targetDate } = {}) => {
    const res = world.calendarAdvance({ store, mode, targetDate });
    const stg = store.getSettings();
    if (res?.step?.notablePulse && (stg.eventMode || 'realistic') !== 'games_only') {
      try {
        const ai = await world.runDailyAiPulse({ store, settings: stg, notable: res.step.notablePulse });
        if (ai?.state) res.state = ai.state;
      } catch { /* le mode quotidien procédural suffit en cas d'indisponibilité de l'IA */ }
    }
    return res;
  });
  handle('calendar:resolveDecision', ({ decisionId, choiceId }) => world.resolveLifeCalendarDecision({ store, decisionId, choiceId }));
  handle('calendar:flipBirthdayShift', ({ bdayKey }) => world.flipCalendarBirthdayShift({ store, bdayKey }));
  handle('calendar:scheduleActivity', (payload) => world.scheduleCalendarActivity({ store, payload }));
  handle('calendar:setMode', ({ mode }) => {
    const r = world.calendarSetMode({ store, mode });
    return { state: r.state, settings: store.publicSettings(), flushed: r.flushed, revealedCount: r.revealedCount };
  });
  handle('calendar:addEvent', (payload) => world.calendarAddEvent({ store, payload }));
  handle('calendar:removeEvent', (id) => world.calendarRemoveEvent({ store, id }));
  handle('narrative:get', () => world.getNarrativeMemory({ store }));
  handle('narrative:dismissArc', (arcId) => world.dismissNarrativeArc({ store, arcId }));
  handle('narrative:clearQuestions', () => world.clearNarrativeQuestions({ store }));
  handle('career:aliasClub', ({ clubRef, name }) => world.saveClubAlias({ store, clubRef, name }));
  handle('paper:save', (payload) => world.saveNationalPaper({ store, payload }));
  handle('lifeEvents:save', (events) => world.saveLifeEvents({ store, events }));
  handle('privacy:preview', ({ text, privacy, player, handle: h, persona } = {}) => {
    const state = store.activeCareer();
    return previewMasked(text, normalizePrivacy(privacy), {
      careerId: state?.careerId || '',
      playerName: player || state?.snapshot?.player?.name || '',
      handle: h || state?.profile?.handle || '',
      persona: persona || state?.persona || null,
    });
  });
  handle('privacy:audit', () => world.getAiAuditLog());
  handle('life:save', (facts) => {
    const state = store.activeCareer();
    if (!state) throw new Error('Synchronise ta sauvegarde une première fois.');
    state.myLife = facts.map((f) => String(f).trim()).filter(Boolean).slice(0, 30);
    store.saveCareer(state);
    return state;
  });
  handle('profile:save', (update) => world.updateProfile({ store, update }));
  // Logos des sponsors (2.0) : un pack téléchargé à part, installé dans les données de l'utilisateur.
  handle('logos:status', () => ({ count: Object.keys(logoPack.listLogos(logosDir())).length }));
  handle('logos:download', async () => {
    const buf = await logoPack.downloadPack(logoPack.LOGO_PACK_URL, (p) => win?.webContents.send('logos:progress', p));
    const count = logoPack.installPack(buf, logosDir(), { warn: (msg) => logError('logos', new Error(msg)) });
    return { count };
  });
  // Dossier des carrières : l'interface y lit la photo et la bannière du profil, ainsi que les images déposées dans lifelegend/media/mylife/ et les logos dans lifelegend/media/sponsors/.
  handle('app:paths', () => {
    const mylifeMedia = {};
    const mylifeDir = path.join(__dirname, 'lifelegend', 'media', 'mylife');
    try {
      for (const f of fs.readdirSync(mylifeDir)) {
        const m = /^([a-z0-9_-]+)\.(png|jpe?g|webp)$/i.exec(f);
        if (m) mylifeMedia[m[1].toLowerCase()] = f;
      }
    } catch { /* dossier optionnel */ }
    // logos : le pack téléchargé (Réglages) d'abord, puis ceux du dossier de l'app (mode développement) ; adresses file:
    const sponsorLogos = {};
    for (const dir of [path.join(__dirname, 'lifelegend', 'media', 'sponsors'), logosDir()]) {
      for (const [key, file] of Object.entries(logoPack.listLogos(dir))) sponsorLogos[key] = pathToFileURL(file).href;
    }
    return { careersDir: path.join(store.dir, 'careers'), mylifeMedia, sponsorLogos };
  });
  // « Signaler un problème » : le rapport (sans clé, e-mail ni textes personnels), enregistré là où il le choisit, puis
  // montré dans l'Explorateur. Rien n'est envoyé.
  handle('report:make', async ({ title } = {}) => {
    const read = (name) => { try { return fs.readFileSync(path.join(app.getPath('userData'), 'data', name), 'utf8'); } catch { return ''; } };
    const text = buildReport({ version: app.getVersion(), settings: store.publicSettings(), state: store.activeCareer(), logs: { errors: read('errors.log'), activity: read('activity.log'), sync: syncLog.join('\n'), writeError: logWriteError, folder: path.join(app.getPath('userData'), 'data') } });
    const r = await dialog.showSaveDialog(win, { title: title || 'LifeLegend', defaultPath: path.join(app.getPath('desktop'), `LifeLegend-rapport-${new Date().toISOString().slice(0, 10)}.txt`), filters: [{ name: 'Texte', extensions: ['txt'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, text, 'utf8');
    shell.showItemInFolder(r.filePath);
    return { path: r.filePath };
  });
  // Partager en image : la zone de la page (pixels CSS, ramenés à l'écran), copiée dans le presse-papiers ; gardée pour
  // « Enregistrer », qui l'écrit en PNG là où il le choisit.
  let lastShot = null;
  handle('share:image', async (r = {}) => {
    const z = win.webContents.getZoomFactor() || 1;
    const rect = { x: Math.max(0, Math.floor(r.x * z)), y: Math.max(0, Math.floor(r.y * z)), width: Math.max(1, Math.ceil(r.width * z)), height: Math.max(1, Math.ceil(r.height * z)) };
    const img = await win.webContents.capturePage(rect);
    if (img.isEmpty()) throw new Error(tr(lang0(), 'Image impossible pour l’instant.'));
    clipboard.writeImage(img);
    lastShot = img;
    return { width: img.getSize().width, height: img.getSize().height };
  });
  handle('share:save', async ({ title } = {}) => {
    if (!lastShot) return null;
    const r = await dialog.showSaveDialog(win, { title: title || 'LifeLegend', defaultPath: path.join(app.getPath('pictures'), `LifeLegend-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`), filters: [{ name: 'PNG', extensions: ['png'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, lastShot.toPNG());
    return { path: r.filePath };
  });
  // « Vérifier les mises à jour » : la dernière version publiée sur la page GitHub de LifeLegend, seulement quand il
  // clique. Rien d'autre n'est envoyé (ni identifiant, ni réglage, ni donnée de carrière).
  handle('update:check', async () => {
    const res = await net.fetch('https://api.github.com/repos/LimaDiogenes/BAL_lifelegendmod/releases/latest', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'LifeLegend' } });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const r = await res.json();
    const latest = String(r.tag_name || '').replace(/^v/, '');
    const parts = (v) => String(v).split('-')[0].split('.').map((x) => parseInt(x, 10) || 0);
    const [a, b] = [parts(latest), parts(app.getVersion())];
    const diff = [0, 1, 2].map((i) => (a[i] || 0) - (b[i] || 0)).find((d) => d !== 0) || 0;
    const url = /^https:\/\/github\.com\/LimaDiogenes\/BAL_lifelegendmod\//.test(r.html_url || '') ? r.html_url : 'https://github.com/LimaDiogenes/BAL_lifelegendmod/releases/latest';
    return { current: app.getVersion(), latest, newer: Boolean(latest) && diff > 0, url };
  });
  // Visages des joueurs qu'une page affiche, lus dans le jeu : { nom : fichier du dossier faces de la carrière }.
  handle('faces:get', (names) => playerFaces({ store, settings: store.getSettings(), names }));
  // Couleurs d'un écusson (le blog des supporters prend les couleurs du club) : fichier du dossier emblems de la carrière.
  handle('emblem:colors', (file) => {
    const state = store.activeCareer();
    if (!state || typeof file !== 'string' || path.basename(file) !== file) return null;
    const img = nativeImage.createFromPath(path.join(store.dir, 'careers', state.careerId, 'emblems', file));
    if (img.isEmpty()) return null;
    const { width, height } = img.getSize();
    return dominantColors(img.toBitmap(), width, height, 'bgra');
  });

  createWindow();
  setupAutoSync();
  startMediaWatch();
});

app.on('window-all-closed', () => app.quit());
