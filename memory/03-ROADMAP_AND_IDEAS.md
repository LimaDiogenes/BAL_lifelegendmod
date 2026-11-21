# Roadmap, Owner Ideas & Integration Notes (`BAL_lifelegendmod`)

## 1. Upstream `1.1.0` Features Already Present (Do Not Duplicate)
**Verified** in `CHANGELOG.md` and `src/` at `3686e1b`:
- Dynamic save table discovery (`src/save/layout.js`) for Lua-expanded saves (FL Mod Studio, GigaPack) — read-only safe guard.
- PNG card export to clipboard/file ("Partager en image" via `share:image` / `share:save`).
- Scoreline player comparator.
- Seasonal Rival (`rival.js`), Derbies (`derby.js`), Former-Club Reunions (`reunion.js`), Club POTM Fan Vote (`fanVote.js`), Fan Chant (`chant.js`), Exclusive Interview (`interview.js`).
- Quota-resilient fallback sync ("synchro de secours") saving non-AI progress when daily quota runs out.
- 43 automated unit tests (`npm test`) and portable Windows build script (`npm run dist`).

---

## 2. Owner's 12 Improvement Ideas (Tracked Scope)

1. **English-Based Core + More Translations — *Phase 1 Implemented & Verified*:**
   - Default language switched to English (`en`) in `src/store.js`, `main.js`, and `lifelegend/app.js`; `Português (Brasil)` (`pt`) prioritized second in `LANGS`; `update:check` in `main.js` updated to `LimaDiogenes/BAL_lifelegendmod`. Preserved `fr/es/it/pt/de` with full parity verified by `tests/i18n.test.js` (`tests 229, pass 206, fail 0, skipped 23`).
   - Remaining future work: optional source-key migration from French literals and adding extra languages.
2. **UI Improvements:**
   - Pure HTML/CSS/vanilla JS in `lifelegend/` (zero build step). Clean up UX, layouts, onboarding, and readability.
3. **Country-Specific Newspapers (`La Transversale` -> Regional Dailies) — *Phase E Implemented & Verified*:**
   - Mapped `snapshot.league.name` across 17 footballing nations in `src/world/nationalPaper.js` (`The Touchline`, `Folha do Gramado`, `Diario Balón`, `Corriere del Pallone`, `Anstoß Kurier`, `La Transversale`, `Jornal da Baliza`, `De Buitenkant`, `Crónica del Área`, `Al-Maydan Sports`, `The Caledonian Pitch`, `Le But Belge`, `Santra Gazetesi`, `The Pitchside Ledger`, `Pitch Shimbun`, `El Pitazo Deportivo`, `Gaceta del Sur`), with regional TV debate shows, 10-writer newsrooms (`paperDeskTemplate`), auto-switching on club country transfers, Settings › World (`rg-natpaper`) override (`Auto` / 17 presets / Custom name via `paper:save`), and full prompt/brief/interview/UI/i18n wiring.
4. **AI Usage & Token Efficiency — *Phase 3 Implemented & Verified*:**
   - Added deterministic `hasFactualClaim` / `needsAiFactCheck` pre-filtering and `filterBanter` support in `src/ai/factcheck.js` so banter-only drafts skip AI calls (`skipped: true`), trimmed interactive `FACTS` builders (`kopInteractionFacts`, `pressFacts`, `mailReplyFacts`), and slimmed `factCheck` `checkFacts` in `src/world/world.js` (verified by `npm test`, `tests/privacy.test.js`).
   - Remaining future work: consider structured output schemas (`responseSchema`) where supported.
5. **Privacy via Local Decoy Aliases / Variables — *Phase 2 Implemented & Verified*:**
   - Implemented `src/ai/privacyShield.js` (`normalizePrivacy`, `buildPrivacyMap`, `maskText`, `unmaskText`, `privacyWords`, `previewMasked`) wired across all AI prompts (`world.js`, `factcheck.js`), voice dictation, and `src/report.js`, plus IPC `privacy:save`/`privacy:preview` and UI Privacy Shield controls + live preview in Setup Step 3 & Settings › *Your Player* across all 5 `i18n/*.js` dictionaries.
   - Zero personal identifiers leave the PC; verified by `tests/privacy.test.js` (`pass 10/10`) and full `npm test` (`pass 206, fail 0, skipped 23`).
6. **Expanded AI Model & Free/Open-Source API Support — *Phase F Implemented & Verified*:**
   - Expanded `src/ai/providers.js` to 13 presets: local zero-key endpoints (`ollama`, `lmstudio`) plus free-tier/open-weight cloud presets (`cerebras`, `sambanova`, `mistral`, `github`, `deepseek`, alongside `anthropic`, `google`, `openai`, `groq`, `openrouter`, `custom`), live model discovery (`listModels` via `ai:models`), `<think>…</think>` stripping in `parseJson`, and live refresh + editable local Base URL in Setup Step 2 and Settings › AI.
7. **Multi-Season Career History Reading (Beyond Current Season) — *Implemented & Verified*:**
   - **Verified & implemented** in `src/save/blReader.js` (`readCareerRecords`: Club Records at `L.player + 0x3AC` stride `0x30`, International Record at `L.player + 0xEEC`, plus high-bit created-player IDs `0x80000000+` in `layout.js`), `seasons.js`, `pantheon.js`, `reunion.js`, `snapshot.js`, and Panthéon/Scoreline/Mails UI (including inline club naming via `clubAliases` and `playerOfYear` honours).
8. **Visual Assets, Game Image Imports & Living Off-Pitch Scenes *(Phase H Implemented & Verified)*:**
   - Implemented `src/save/stadiums.js` (`parseStadiumMap`, `ensureClubStadium`, `stadiumCode` for Sider `stadium-server` / CPK PNG & DDS thumbnails into `stadiums/`), `src/world/lifeMedia.js` (`saveLifeImage`, `removeLifeImage` into `life-media/`), `src/world/lifeScenes.js` (6-language catalog names, narrative scene generator & Kop/Vestiaire cross-reactions with zero extra AI calls), and curated inline SVG art + custom image uploader + interactive Scene Modal in `lifelegend/app.js`.
9. **Richer Teammate & Squad Reading — *Phase G Implemented & Verified*:**
   - Expanded `src/save/gameDb.js` (`Player.bin` stride 312 for position `+0x36` & 9-bit nationality `+0x1D`, fallback primary name `+0x44`, plus `EDIT00000000` created/edited player overlay via `parseEditPlayers`/`mergeEditPlayers`) and `src/save/blReader.js` (`plausibleId` for created IDs `0x80000000+`, shirt numbers `+0x2EA`, captain `+593`, set-piece takers `+584..+589`, starting XI order `+544`), enriching `snapshot.js` (`squad` including unused bench + `squadIntel`), Vestiaire, Influence (`club_captain`), prompts, and Scoreline UI.
10. **Custom Dates / Out-of-Football Life Events — *Implemented & Verified*:**
    - Added `state.lifeEvents` (up to 20 `(YYYY-MM-DD, title)` dates in *Settings › Your Player*), `dueLifeEvents` injection into `CHANGES.life_events` (`world.js`), `keyMemory` (max 10 one-liners), and Kop/Vestiaire/paper off-pitch hooks (`tribunePlan.js`, `prompts.js`).
11. **Seamless Auto-Read / Auto-Sync Flow — *Phase I Implemented & Verified*:**
    - Enabled `DEFAULT_SETTINGS.autoSync = true` in `src/store.js`, enhanced `setupAutoSync()` in `main.js` with `src/save/autoSaveWatch.js` (`snapshotWatchedFiles`, `detectModifiedSave`), added non-blocking `'detected'` / `'switched-save'` / `'new-career'` `sync:auto` IPC notifications, and guarded `onAutoSync` in `lifelegend/app.js` so active typing or Settings edits aren't interrupted when a new career is detected (showing a non-intrusive toast with a `Configurer` action instead).
12. **Auto-Load Latest Modified Save (Optional Toggle) — *Phase I Implemented & Verified*:**
    - Added `autoLatestSave` setting (`src/store.js`, `src/report.js`), switches in Setup Step 1 (`#su-autolatest`) and Settings › Save (`#autolatestsave`), `"Latest"` (`Plus récente`) badge on the most recently modified readable save slot, and automatic slot switching across `BL\d{8}` saves on both manual sync and background watch (`scanSaveFiles`, `pickLatestSave`, `resolveSaveForSync` in `src/save/autoSaveWatch.js`).

---

## 3. Integration with `pes2021-mod-studio`
- **Target repo:** `F:\_PES2021_STUDIO\pes2021-mod-studio` (C# / .NET 10 Avalonia MVVM; EN/ES/PT-BR).
- **Recommended integration (side-by-side packaging & launch):**
  - Package LifeLegend portable build inside a Mod Studio subfolder (or downloadable module) using `tools/build-portable.js`.
  - Add a Mod Studio launcher action that pre-populates `%APPDATA%\LiveTweet\data\settings.json` (and copies/registers `FL_key.bin` into `%APPDATA%\LiveTweet\data\keys/` if missing) with the game path, language, and active save path, then starts `LifeLegend.exe`.
  - `update:check` URL in `main.js` now points to `LimaDiogenes/BAL_lifelegendmod` (updated in Phase 1).

---

## 4. Interactive RPG, Immersion & Integration Roadmap (Phases A–I)

Per owner customization rule: always offer rich curated presets + custom user-editable options wherever feasible.

- **Phase A — Full-App Consistency Sweep & Map *(Done — branch `v1.1.0-phaseA`, commit `bee6af0`)*:**
  - Synced `careerRecords`, `clubAliases`, mid-career milestone tracking (`prevCareerCombined`), `pantheonEvents` guards, `reunion.js` former-club stats, Mails › Career File, Scoreline `careerCard`, `prompts.js` off-pitch cues, and wrote `memory/04-APP_MAP.md`.
- **Phase B — Onboarding Questionnaire, Personality Presets & Categorized Inner Circle *(Done — branch `v1.1.0-phaseB`, commit `453fbec`)*:**
  - `src/world/persona.js`: 8 curated Personality Presets + custom option, 6 traits (preset options + `'__custom__'` text override), 4 roots fields, 4 flavor fields (curated datalist suggestions + free text), and 4 categorized Inner Circle sections (`family`, `friends`, `business`, `roots` — starter roles, up to 10/group, `-` delete with `kConfirm()`).
  - Auto-linked directly into `src/ai/privacyShield.js` + `src/report.js` (`roots.hometown`/`childhood`/`academy` + `circle` contacts with role-aware decoy pools, `protect: true` by default, opt-out toggle) and wired into Setup Step 3, Settings › *Your Player*, `factsFor`, and `prompts.js` (`FACTS.persona`).
- **Phase C — "My Life" Hub Tab & Active Between-Match RPG Sim *(Done)*:**
  - `src/world/lifeHub.js`: Career-stage detection (`rookie` / `rising` / `established` / `superstar`), mid-career calibration card (Status-Matched Starter Pack, All Cash, or Humble Grind, editable starting balance, optional follower calibration, pre-existing active sponsors), Finances & Ledger, Catalog + Custom Shop (`Buy`/`Sell 75%`/`Dismiss`), 5 Relationship Meters, unlimited superstar / multi-category sponsors (13 categories + multi-select/custom chips), Partner Obligations, Days-Off Actions (8 curated + Custom), and 8 deterministic Dilemmas (zero extra AI calls), grounded via `FACTS.off_pitch_hub`.
  - Verified with `node -c lifelegend/app.js` and `npm test` (`249` tests across `6` suites: `226` pass, `0` fail, `23` skipped).
- **Phase D — Full Calendar Mode (Spoiler-Safe Catch-Up Queue) + Optional Save Effects *(Done)*:**
  - Switchable `'basic'` vs `'full'` calendar mode (`settings.calendarMode`) via `src/world/calendar.js` (`ingestSyncCalendar`, `buildVisibleSnapshot`, `advanceCalendar`, `flushCalendarToSave`, `addCustomCalendarEvent`, `removeCustomCalendarEvent`, `dayRhythm`, `calendarAgenda`): when multiple matches are played in PES/FL before syncing, `state.saveSnapshot` is queued behind `state.calendar.simDate` + `state.calendar.pendingMatches` so stats/tables/results stay spoiler-free until stepped forward via `Next day (+1d)`, `Next event`, or `Catch up`. Includes an interactive month grid, day rhythm tags, custom events, and hero mode pill in **My Life › Calendar** plus **Settings › World**.
  - Opt-in save effects writer (`src/save/lifeEffectsWrite.js` gated by `settings.lifeSaveEffects`, default `false`) that applies accumulated `pendingSaveEffects` (`+318` affection, `+327` low 3 bits formArrow preserving upper 5 bits, `+328` unavailableDays never shrinking existing longer wounds) via **My Life** Overview card when FL27/PES is closed on standard layouts.
  - Verified with `node -c` across all edited JS files and `npm test` (`256` tests across `8` suites: `233` pass, `0` fail, `23` skipped for absent local fixtures/FL key).
- **Phase E — Country-Specific National Newspapers *(Done)*:**
  - `src/world/nationalPaper.js`: 17 league-country sports dailies (`The Touchline`, `Folha do Gramado`, `Diario Balón`, `Corriere del Pallone`, `Anstoß Kurier`, `La Transversale`, `Jornal da Baliza`, `De Buitenkant`, `Crónica del Área`, `Al-Maydan Sports`, `The Caledonian Pitch`, `Le But Belge`, `Santra Gazetesi`, `The Pitchside Ledger`, `Pitch Shimbun`, `El Pitazo Deportivo`, `Gaceta del Sur`) with distinct editorial voices, TV debate show names, and 10-writer newsrooms (`paperDeskTemplate`).
  - Auto-switches paper & desk on foreign club transfer (including pre-Phase-E career migration), plus **Settings › World › National newspaper (`rg-natpaper`)** selector (`Automatic by league` / 17 presets / `Custom name…` via `paper:save` -> `world.saveNationalPaper`), wired through `src/ai/prompts.js` (`applyPaper`), `src/world/interview.js`, `src/world/world.js` (`writeTransversale`, `editionSystem`, `pressPanel`, `submitPressInner`, `transversaleBrief`), `lifelegend/app.js` (`natPaper(edition)`), and all 5 `lifelegend/i18n/` dictionaries.
  - Verified with `node -c` across all edited files, new `tests/nationalPaper.test.js`, and full `npm test` (`262` tests across `8` suites: `239` pass, `0` fail, `23` skipped for absent local fixtures/FL27 key).
- **Phase F — Expanded AI & Local Model Presets *(Done)*:**
  - `src/ai/providers.js`: Added local zero-key presets (`ollama` `127.0.0.1:11434/v1`, `lmstudio` `127.0.0.1:1234/v1` with optional API key, editable Base URL, single loaded-model preservation on `light: true`) and free-tier/open-weight cloud presets (`cerebras`, `sambanova`, `mistral`, `github`, `deepseek`, updated free OpenRouter/Groq defaults) while keeping Google Gemini free-tier model & backup order intact.
  - Added `listModels` (OpenAI `/models`, Ollama native `/api/tags` fallback, GitHub bare arrays, Google `generateContent` filter, Anthropic `/v1/models`) wired over `ai:models` / `window.live.listModels` with live **Refresh list** buttons in Setup Step 2 and Settings › AI, widened `response_format`/`json_object` fallback retry, and stripped `<think>…</think>` reasoning blocks in `parseJson`.
  - Verified with `node -c` across all edited files, new `tests/providers.test.js`, and full `npm test` (`268` tests across `8` suites: `245` pass, `0` fail, `23` skipped for absent local fixtures/FL27 key).
- **Phase G — Richer Squad & Teammate Reading *(Done)*:**
  - `src/save/gameDb.js`: Extracted pure `parsePlayerBin` (reading ID `+0x08`, display name `+0xF3` with `+0x44` primary fallback, registered position `+0x36`, and 9-bit nationality `+0x1D`), `parseEditPlayers` / `loadEditPlayers` / `mergeEditPlayers` (decrypting optional `EDIT00000000` for created `0x80000000+` players & edited overrides without mutating base DB).
  - `src/save/blReader.js`: Updated `readTeams` to accept `plausibleId` in club rosters (keeping created players), read shirt numbers (`+0x2EA`), captain slot (`+593`), set-piece takers (`+584..+589`), and preferred starting XI order (`+544`).
  - `src/world/snapshot.js`: Added `nationalitiesFromTeams` (resolving 9-bit nationality codes to country names from 11+ player national squads), merged unused `apps === 0` roster teammates into `squad`, attached `shirt`/`pos`/`nationality`/`captain`/`penaltyTaker`/`freeKickTaker`/`inStartingXi`/`status`, and added `squadIntel` (`captain`, `penaltyTaker`, `freeKickTaker`, `positionRivals`, `unusedBench`, `squadSize`).
  - Wired through `world.js` (`factsFor.club_squad` + `squad_roles`, `playerDb` EDIT overlay), `huddle.js` (`huddleToday` captain/position-rival voice cues & `huddleContext`), `influence.js` (`club_captain` sale/keep modifier & `shirt`/`unused`), `prompts.js`, Scoreline/Vestiaire/Influence UI, and all 5 i18n dictionaries.
  - Verified with `node -c` across all edited files, new `tests/squadReading.test.js`, and full `npm test` (`272` tests across `8` suites: `249` pass, `0` fail, `23` skipped for absent local fixtures/FL27 key).
- **Phase H — "Living My Life": Visual Assets, Custom Image Importer & Interactive Off-Pitch Scenes *(Done)*:**
  - `src/save/stadiums.js`: Extracts home club stadium thumbnails (`SiderAddons/content/stadium-server/map_teams.txt`, `siderRoots`, CPK `st<id>.png|.dds`, `preview.png`/`thumbnail.png`) into `<careerDir>/stadiums/` during `refreshEmblems` (`state.clubStadiumImage`), with graceful SVG stadium backdrop fallback.
  - `src/world/lifeMedia.js` & `lifeHub:setMedia`: Validates PNG/JPEG/WebP magic bytes & MIME match (`<= 4 MB`), persists custom artwork in `<careerDir>/life-media/` for My Life hero banner, catalog/custom assets, and sponsor logos, and automatically cleans up unreferenced files on replace/clear/sell/remove.
  - `src/world/lifeScenes.js` & `src/world/lifeHub.js`: Eliminated raw `snake_case` IDs in scenes and `FACTS.off_pitch_hub.notable_lifestyle` (`CATALOG_NAMES` in `fr/en/pt/es/it/de`), and built contextual off-pitch scenes (`state.lifeHub.scenes`) + instant Kop supporter posts (`state.feed` with `lifeScene: true`) and Vestiaire squad banter (`addMessage`, keeping `inner_circle` strictly private) on purchases, days-off actions, dilemmas, and sponsor obligations.
  - `lifelegend/app.js` & `lifelegend/style.css`: Curated editorial SVG illustrations for all 16 shop items + 6 categories, action category badges, sponsor monogram medallions, Owned Showcase strip, interactive **Scene & Impacts** modal with direct jumps to Kop / Vestiaire, and custom image upload/reset controls across hero banner, shop cards, custom purchases, and sponsors.
  - Verified with `node -c` across all edited/new files, new `tests/livingMyLife.test.js`, `tests/charte.test.js`, `tests/i18n.test.js`, and full `npm test` (`276` tests across `9` suites: `253` pass, `0` fail, `23` skipped for absent local fixtures/FL27 key).
- **Phase I — Seamless Auto-Sync, Auto-Load Latest Save & Original Author Credits *(Done — `pes2021-mod-studio` integration deferred until requested)*:**
  - `src/save/autoSaveWatch.js`, `src/store.js`, `src/report.js`, `main.js`, `lifelegend/app.js`: Defaulted `autoSync: true`, added `autoLatestSave` setting + UI toggles (`#su-autolatest`, `#autolatestsave`) + `"Latest"` (`Plus récente`) save badge, multi-slot background save watcher (`snapshotWatchedFiles`, `detectModifiedSave`, `resolveSaveForSync`), non-blocking `sync:auto` phases (`detected`, `switched-save`, non-intrusive `new-career` toast while typing/in Settings), and prominent credits to original LifeLegend creator **Saamz09** alongside community PES tools (`pesXdecrypter (the4chancup), PES21 BAL Ultimate Editor (AlexDelPiero23), TyNet`) in Settings › About (`rg-about` & `rg-credits`) and `THIRD-PARTY-NOTICES.txt`.
  - Verified with `node -c` across all edited/new files, new `tests/autoSyncAndCredits.test.js`, `tests/charte.test.js`, `tests/i18n.test.js`, and full `npm test` (`282` tests across `10` suites: `259` pass, `0` fail, `23` skipped for absent local fixtures/FL27 key).
  - External `pes2021-mod-studio` launcher/packaging integration remains deferred per owner request.
