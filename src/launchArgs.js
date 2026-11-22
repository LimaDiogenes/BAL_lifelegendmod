'use strict';
// Lancement depuis blue41 PES2021 Mod Studio (ou un raccourci) :
//   LifeLegend.exe --save=<fichier BL ou dossier save> --game=<dossier du jeu> --lang=<en|fr|pt|es|it|de> --theme=<dark|light>
//   --from-studio : lancé par le Mod Studio, qui gère les mises à jour (la vérification de LifeLegend est masquée).
// --save et --game sont vérifiés comme dans les Réglages (src/settingsGuard.js) puis gardés ; --lang et --theme valent
// pour cette session seulement (Store.setSessionOverrides). Un second lancement les transmet à la fenêtre ouverte.

const { resolveSaveArg, validGameDir } = require('./settingsGuard');

const LANGS = ['en', 'fr', 'pt', 'es', 'it', 'de'];
const THEMES = ['dark', 'light'];

function parseLaunchArgs(argv = []) {
  const out = {};
  for (const arg of argv) {
    if (String(arg) === '--from-studio') { out.fromStudio = true; continue; }
    const m = /^--(save|game|lang|theme)=(.*)$/s.exec(String(arg));
    if (!m) continue;
    const v = m[2].trim().replace(/^"(.*)"$/s, '$1').trim();
    if (!v) continue;
    if (m[1] === 'lang') { if (LANGS.includes(v.toLowerCase())) out.lang = v.toLowerCase(); }
    else if (m[1] === 'theme') { if (THEMES.includes(v.toLowerCase())) out.theme = v.toLowerCase(); }
    else out[m[1]] = v;
  }
  return out;
}

// Applique les arguments : renvoie ce qui a changé et ce qui a été refusé (pour le journal).
function applyLaunchArgs(store, args, { peek = null } = {}) {
  const applied = [], rejected = [];
  const persist = {};
  if (args.save) {
    const file = resolveSaveArg(args.save, { peek });
    if (file) { persist.savePath = file; applied.push('save'); } else rejected.push('save');
  }
  if (args.game) {
    if (validGameDir(args.game)) { persist.gameDir = args.game; applied.push('game'); } else rejected.push('game');
  }
  if (Object.keys(persist).length) store.saveSettings(persist);
  const session = {};
  if (args.lang) { session.language = args.lang; applied.push('lang'); }
  if (args.theme) { session.theme = args.theme; applied.push('theme'); }
  if (args.fromStudio) { session.launchedByStudio = true; applied.push('from-studio'); }
  if (Object.keys(session).length) store.setSessionOverrides(session);
  return { applied, rejected };
}

module.exports = { parseLaunchArgs, applyLaunchArgs, LANGS, THEMES };
