# LifeLegend 1.1.0 — Architecture Summary (Verified)

All file paths below are relative to `F:\_Antigravity_Projects\BAL_lifelegendmod\`. Every item is **verified** in the `1.1.0` codebase (`3686e1b`).

## 1. Tech Stack & Runtime
- **Platform:** Electron (`electron` ^44.7.2 devDependency for portable packaging; only `@anthropic-ai/sdk` ^0.133.0 runtime dependency).
- **No build step:** Plain Node.js (CommonJS) backend + vanilla HTML/CSS/JS renderer (`lifelegend/`).
- **Testing & Tooling:**
  - `npm test` runs Node's built-in test runner (`node --test tests/`) across **43** `.test.js` files.
  - `npm run check-save -- "<path>"` (`tools/check-save.js`) inspects a `BL00000000` save without launching Electron or calling AI.
  - `npm run dist` (`tools/build-portable.js`) builds `dist/LifeLegend-<version>-win-x64/` (renaming `electron.exe` to `LifeLegend.exe`, embedding `assets/icon.ico`, copying runtime files + `@anthropic-ai/sdk` + docs).

## 2. Main Process, IPC & Storage
- [`main.js`](../main.js):
  - Sets Electron `userData` to `%APPDATA%\LiveTweet` (kept for backward compatibility); actual JSON/assets live under `%APPDATA%\LiveTweet\data`.
  - Scans `Documents\KONAMI` and `Documents\SPGAME` for `BL\d{8}` saves (`detectSaves()`).
  - Loads 64-byte `.bin` save decryption keys from `%APPDATA%\LiveTweet\data\keys\`.
  - `setupAutoSync()` polls `settings.savePath` every 4 s (`fs.watchFile`), waits 8 s after modification finishes, validates with `peekSave()`, and calls `world.sync()`.
  - `startMediaWatch()` checks every 10 s (when not syncing) for new `REPLAY*` files and captured clips.
  - Registers IPC handlers including `share:image` / `share:save` (PNG card capture to clipboard/file), `privacy:save` / `privacy:preview` (Privacy Shield configuration & live preview), `update:check` (points to `LimaDiogenes/BAL_lifelegendmod`), `report:make`, and save-write endpoints.
  - Defaults fallback language (`lang0`) to `'en'`.
- [`preload.js`](../preload.js): Exposes `window.live` via `contextBridge` with `contextIsolation: true` and `sandbox: true` (including `savePrivacy` and `previewPrivacy`).
- [`src/store.js`](../src/store.js): Persists `settings.json` (defaults `language: 'en'`; API keys encrypted via Electron `safeStorage`), `active.json`, and per-career folders `careers/<playerId>-<slug>/` (`state.json`, `scores.json`, `clubs.json`, `influence.json`, `backups/`, `emblems/`, `faces/`, `boots/`, `profile/`).
- [`src/i18n.js`](../src/i18n.js): Shares `lifelegend/i18n/<lang>.js` dictionaries (`en`, `pt` as `Português (Brasil)`, `es`, `it`, `de`; French strings remain the source keys in JS code).
- [`src/report.js`](../src/report.js): Generates sanitized problem reports (`scrub()` masks user paths, player names, emails, API key patterns, and configured Privacy Shield words via `privacyWords()`).

## 3. Save Reading, Game DB & Safe Writing (`src/save/`)
- [`pesCrypt.js`](../src/save/pesCrypt.js): JS port of `libpesXcrypter` (MT19937 stream cipher + SHA-512 header hashes). Built-in PES 2021 key + extra 64-byte keys loaded via `setSaveKeys()`. `splitSave()` / `joinSave()` preserve the encryption key used to open the file.
- [`layout.js`](../src/save/layout.js) *(added in 1.1.0)*: Checks if standard vanilla/FL offsets match (`standardFits()`). If a save was resized by Lua modules (e.g., FL Mod Studio, Matozanato GigaPack), `detectLayout()` locates `player`, `coach`, `comp`, `match`, `calendar`, and `careerStart` dynamically by structural patterns. `assertStandard()` blocks save-writing on non-standard layouts to prevent corruption.
- [`blReader.js`](../src/save/blReader.js): Uses `saveLayout()` to read teams, coaches, competitions, logos, matches, lineups, last-match goal timeline, career history/debuts, offers/negotiations/deadlines/interests, transfer windows, and Footballer of the Year.
- [`playerProfile.js`](../src/save/playerProfile.js) & [`training.js`](../src/save/training.js): Read bit-packed abilities, playing style, team role, form arrow, `unavailableDays`, market value, training focus bars, learned skill bits, and skill/position in training (all relative to `L.player` so they follow expanded saves).
- [`formations.js`](../src/save/formations.js): Decodes 33-byte phase blocks and reads `TacticsFormation.bin` templates from the game DB.
- [`influenceWrite.js`](../src/save/influenceWrite.js), [`offerRedirect.js`](../src/save/offerRedirect.js), [`conductWrite.js`](../src/save/conductWrite.js):
  - Guarded by `gameRunning()` (`tasklist` check for `PES2021.exe` / `FL_*.exe`), `assertStandard()`, round-trip decrypt check before writing, rolling backups (last 10 per tag), atomic rename via `.legendlife-tmp`, and post-write re-read verification.
  - Writes: coach formation (`TACTIC_A/B` + coach tactics), club transfer (roster/shirts/count + arrival/departure message), offer redirection (offer + negotiation + interest + message + active list), and club disciplinary suspension (`unavailableDays`).
- [`gameDb.js`](../src/save/gameDb.js), [`cpk.js`](../src/save/cpk.js), [`dds.js`](../src/save/dds.js), [`emblems.js`](../src/save/emblems.js), [`faces.js`](../src/save/faces.js), [`boots.js`](../src/save/boots.js), [`replays.js`](../src/save/replays.js):
  - Resolves game files in priority order: Sider `cpk.root` (`sider.ini` / `SiderAddons/sider.ini`) -> `download/*.cpk` -> `Data/*.cpk`.
  - Validates DB against save (`matchRate >= 30%`).
  - Unpacks `@UTF` CPK tables, inflates `WESYS` zlib streams, decodes `DXT1`/`DXT3`/`DXT5` DDS to PNG, and reads `TEMBLEM*` / `REPLAY*` save slots.

## 4. AI Pipeline (`src/ai/`)
- [`privacyShield.js`](../src/ai/privacyShield.js) *(added in fork Phase 2)*: Deterministic local decoy substitution (`maskText`) and restoration (`unmaskText`) for personal identifiers (`playerName`, `nickname`, `handle`, `hometown`, `region`, family/friends/pet, youth club/coach, school, custom `real = decoy` entries) across all AI prompts (`world.js`, `factcheck.js`), voice dictation, and diagnostic reports (`src/report.js`).
- [`providers.js`](../src/ai/providers.js): Supports `anthropic` (`@anthropic-ai/sdk`), `google` (Gemini REST SSE), `openai`, `groq`, `openrouter`, and `custom` (OpenAI-compatible `baseUrl`). Handles rate-limit `retryAfter` waits (`<= 60 s`), 1-hour daily-quota cooldown tracking (`exhausted` map), backup model fallback chains (`google.backups`), `lightModel()` routing for lightweight chats/threads, and Gemini audio dictation (`transcribe()`).
- [`prompts.js`](../src/ai/prompts.js): Builds system/user prompts for *La Transversale*, repair pass, edition bundle (local paper, Kop, Mails, Panthéon, Vestiaire), Kop replies/threads/discussions, DMs, press conferences, agent mails, influence mails, interviews, and fact-check. Appends target-language rules via `withLanguage()` and checks for French leakage via `wrongLanguage()`.
- [`factcheck.js`](../src/ai/factcheck.js): Post-generation verification against `FACTS`/`CHANGES` + deterministic `paperRules` flags, applying literal `find -> replace` patches (with truncated-JSON salvage via `salvageCorrections()`). In fork Phase 2–3, adds deterministic banter pre-filtering (`hasFactualClaim`, `needsAiFactCheck`, `draftItems(..., { filterBanter: true })`) to skip empty AI checks and applies `privacyMap` masking/unmasking.

## 5. World Simulation (`src/world/`)
- [`world.js`](../src/world/world.js) orchestrates `sync()` and interactive actions (`post`, `replyToPost`, `sendDm`, `sendHuddle`, `replyMail`, `openPress`/`submitPress`, `influenceRequest`/`influenceApply`, `redirectOffer`, `conductApply`), plus `savePrivacy` / `privacyMapFor` / `previewMasked`. In fork Phase 3, trims interactive `FACTS` payloads via `kopInteractionFacts`, `pressFacts`, `mailReplyFacts`, and slims `checkFacts`.
- **Sync flow:**
  1. Read save + DB -> `snapshot.js` (`buildSnapshot`, `diffSnapshots`).
  2. Deterministic updates: `seasons.js`, `pantheon.js`, `awards.js`, `agent.js`, `promises.js`, `fanMood.js`, `toneContext.js`, `mercato.js`, `influence.js`, `rival.js`, `derby.js`, `reunion.js`, `fanVote.js`, `chant.js`, `clubPosts.js`, `competitions.js`, `media.js`, `coachAdvice.js`, `dms.js`, `huddle.js`, `conduct.js`, `objectives.js`, `sponsors.js`, `interview.js`.
  3. **1.1.0 Fallback Sync:** If no AI edition can be written (or no match/news occurred), deterministic state (`scores.json`, official posts, mails, career stats) is still saved cleanly.
  4. If `hasNews(changes)` or `mercatoNews`: runs **La Transversale** (`writeTransversale` + deterministic check/repair) and **Edition** (local paper + Kop + Mails + Panthéon + Vestiaire) **in parallel** via `Promise.allSettled`.
  5. Runs optional `factCheck()` pass and optional `writeDiscussions()` pass (`light: true`).
  6. Saves `state.json`, `clubs.json`, `influence.json`, `scores.json`, and extracts emblems/logos.

## 6. Frontend (`lifelegend/`)
- [`index.html`](../lifelegend/index.html), [`style.css`](../lifelegend/style.css), [`app.js`](../lifelegend/app.js), [`emoji.js`](../lifelegend/emoji.js), [`i18n/*.js`](../lifelegend/i18n/).
- Seven tabs + Settings: **La Transversale**, **Local Fan Blog**, **Kop**, **Mails** (includes Career File & Influence), **Vestiaire**, **Scoreline** (includes player comparator in 1.1.0), **Panthéon**, and **Settings**.
- Includes PNG card sharing (`share:image` / `share:save`), press conference voice dictation, themes, and custom color palettes.
