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
8. **Visual Assets, Game Image Imports & Living Off-Pitch Scenes *(Planned in Phase H)*:**
   - Extract stadium thumbnails (`common/render/thumbnail/stadium/...`) and additional game textures via `cpk.js` / `dds.js`, add curated/generated asset illustrations + user custom image imports for properties/vehicles/lifestyle items in **My Life**, and build richer interactive off-pitch scenes so the hub feels vivid rather than button-driven.
9. **Richer Teammate & Squad Reading:**
   - Expand `gameDb.js` (`Player.bin` stride 312) to read overall rating, age, nationality, playing style, and merge with save roster/shirt numbers (`+0x2EA`) so unused bench teammates, position rivals, and captains are known to Vestiaire, tactical articles, and Influence.
10. **Custom Dates / Out-of-Football Life Events — *Implemented & Verified*:**
    - Added `state.lifeEvents` (up to 20 `(YYYY-MM-DD, title)` dates in *Settings › Your Player*), `dueLifeEvents` injection into `CHANGES.life_events` (`world.js`), `keyMemory` (max 10 one-liners), and Kop/Vestiaire/paper off-pitch hooks (`tribunePlan.js`, `prompts.js`).
11. **Seamless Auto-Read / Auto-Sync Flow:**
    - Enhance existing `setupAutoSync()` (optionally default-on, smoother non-blocking UX/notifications when the game writes `BL0000000*`).
12. **Auto-Load Latest Modified Save (Optional Toggle):**
    - Leverage `detectSaves()` (already sorted by `mtimeMs` descending) so LifeLegend can automatically watch and switch to whichever `BL0000000x` slot was saved most recently.

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
- **Phase G — Richer Squad & Teammate Reading *(Next Up)*:**
  - Expand `src/save/gameDb.js` (`Player.bin` stride 312) to read overall rating, age, nationality, and playing style, merging with save roster/shirt numbers (`+0x2EA`) so unused bench teammates, position rivals, and captains are visible to Vestiaire, tactical articles, and Influence.
- **Phase H — "Living My Life": Visual Assets, Custom Image Importer & Interactive Off-Pitch Scenes *(Planned)*:**
  - Bring **My Life** and editorial views alive with visual media and cross-feature reactivity rather than static button clicking:
    - Extract stadium/game textures (`cpk.js`/`dds.js`) where available.
    - Add curated/generated illustrations for properties, vehicles, luxury items, and lifestyle purchases, plus a user custom image importer (`data:image/*` / safe local staging in userData) so players can upload custom art for assets, sponsors, or profile scenes.
    - Richer narrative feedback & cross-reactions across Kop, Vestiaire, and press from major lifestyle purchases, inner circle milestones, and days-off scenes.
- **Phase I — Seamless Auto-Sync, Auto-Load Latest Save & `pes2021-mod-studio` Integration *(Planned)*:**
  - Refine `setupAutoSync()` for smoother non-blocking save detection & notifications, add an optional toggle to automatically follow the latest modified `BL0000000x` slot from `detectSaves()`, build side-by-side packaging/launcher integration for `pes2021-mod-studio`, and credit original LifeLegend author **Saamz09** prominently in the integration/About flow.
