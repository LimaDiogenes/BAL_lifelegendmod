# LifeLegend Fork — Complete App Reference Map (`BAL_lifelegendmod`)

All symbols, file paths, IPC channels, and offsets below are **verified** in the `BAL_lifelegendmod` codebase (`v1.1.0` fork).

---

## 1. Runtime & Data Storage (`%APPDATA%\LiveTweet\data\`)
- **Electron userData (`main.js`):** `%APPDATA%\LiveTweet` (kept for backward compatibility; all JSON/data stays physically outside the Git repo and build output).
- **`settings.json` (`src/store.js`):**
  - UI `language` (default `'en'`, options: `en`, `pt` (`Português (Brasil)`), `es`, `fr`, `it`, `de`), `theme`, `colors`, `provider`, `model`, `fastModel`, `baseUrl`, encrypted API `keys` (Electron `safeStorage`), `savePath`, `gameDir`, `clipsDir`, `autoSync`, `factCheck`, `tribuneThreads`, `transversaleBrief`, `replays`, `offerRedirect`, `influenceWrites`, `lifeSaveEffects` (default `false`), `calendarMode` (`'basic'` | `'full'`, default `'basic'`), `fanVulgarity`, plus persisted `privacy` and `pendingBio`.
- **`keys/*.bin`:** User-supplied 64-byte save encryption keys (e.g. `FL_key.bin`).
- **`active.json`:** Points to active `{ careerId }`.
- **`careers/<playerId>-<slug>/`:**
  - `state.json`: `snapshot`, `saveSnapshot` (queued real save snapshot in Full Calendar mode until caught up), `calendar` (`simDate`, `saveDate`, `pendingMatches`, `revealedMatchIds`, `customEvents`, `history`), `seasons`, `prevCareerCombined`, `clubAliases`, `feed`, `accounts`, `follows`, `interactions`, `editions`, `mail`, `dms`, `huddles`, `agent`, `sponsor`, `lifeHub` (incl. `pendingSaveEffects`, `lastSaveEffectApplied`), `objectives`, `conduct`, `influence`, `rival`, `promises`, `onRecord`, `bio`, `persona`, `privacy`, `lifeEvents`, `keyMemory`, `pantheon`, `awards`, `progressLog`, `followerLog`, `lastSync`.
  - `scores.json`, `clubs.json`, `influence.json`, `backups/`, `emblems/`, `faces/`, `boots/`, `profile/`.

---

## 2. Electron Main Process & IPC (`main.js`, `preload.js`)
Window exposes `window.live` via `contextBridge` (`contextIsolation: true`, `sandbox: true`):

| Channel | `window.live` Method | Handler |
|---|---|---|
| `settings:get` / `settings:save` | `getSettings` / `saveSettings` | `store.publicSettings()` / `saveSettings()` + `setupAutoSync()` |
| `saves:detect` / `saves:browse` | `detectSaves` / `browseSave` | Scan `KONAMI` & `SPGAME` for `BL\d{8}` via `peekSave` |
| `keys:count` / `keys:add` | `saveKeyCount` / `addSaveKey` | Validate 64-byte `.bin` keys into `data/keys/` |
| `game:detect` / `game:browse` | `detectGame` / `browseGame` | `detectGameFolders` / `isGameDir` |
| `clips:default` / `clips:browse` | `defaultClipsDir` / `browseClips` | Replay video capture folder |
| `state:get` / `scores:get` / `mentions:list` | `getState` / `getScores` / `mentionDirectory` | Career state, Scoreline DB, Kop directory |
| `sync` | `sync` | `world.sync()` |
| `feed:post` / `feed:reply` / `feed:like` / `feed:repost` / `feed:follow` | `post` / `replyPost` / `likePost` / `repostPost` / `followAccount` | Kop social feed actions |
| `press:open` / `press:submit` / `press:skip` | `openPress` / `submitPress` / `skipPress` | Post-match press conference |
| `dictation:transcribe` | `transcribe` | Gemini audio transcription (`transcribeDictation`) |
| `agent:stance` / `agent:request` | `setAgentStance` / `setTransferRequest` | Agent negotiation stance & transfer wishlist |
| `offer:redirect` | `redirectOffer` | Safe write: redirect offer in BAL save |
| `influence:get` / `influence:search` / `influence:request` / `influence:apply` | `influence` / `influenceSearch` / `influenceRequest` / `influenceApply` | Influence requests & safe save writes |
| `conduct:apply` | `conductApply` | Safe write: apply suspension `unavailableDays` |
| `mail:reply` / `mail:read` | `replyMail` / `readMail` | Inbox mail replies & interview answers |
| `dm:send` / `dm:read` / `dm:contacts` | `sendDm` / `readDm` / `dmContacts` | Kop private DMs |
| `huddle:send` / `huddle:read` | `sendHuddle` / `readHuddle` | Vestiaire squad/NT group chats |
| `bio:save` / `life:save` / `lifeEvents:save` / `profile:save` / `career:new` / `career:aliasClub` | `saveBio` / `saveLife` / `saveLifeEvents` / `saveProfile` / `newCareerInfo` / `setClubAlias` | Player identity, custom club names, off-pitch dates |
| `privacy:save` / `privacy:preview` / `privacy:audit` | `savePrivacy` / `previewPrivacy` / `auditPrivacy` | Privacy Shield config, decoy preview (with `persona`), outgoing prompt log |
| `persona:save` | `savePersona` | Persist `state.persona` (presets, traits, roots, flavor, categorized inner circle) |
| `lifeHub:calibrate` / `lifeHub:buyAsset` / `lifeHub:sellAsset` / `lifeHub:addSponsor` / `lifeHub:updateSponsor` / `lifeHub:removeSponsor` / `lifeHub:answerOffer` / `lifeHub:completeObligation` / `lifeHub:action` / `lifeHub:dilemma` | `calibrateLifeHub`, `buyLifeAsset`, `sellLifeAsset`, `addLifeSponsor`, `updateLifeSponsor`, `removeLifeSponsor`, `answerLifeSponsorOffer`, `completeLifeObligation`, `doLifeAction`, `answerLifeDilemma` | My Life calibration, finances/assets, multi-slot sponsors, days-off actions & dilemmas |
| `lifeHub:applySaveEffects` / `lifeHub:dismissSaveEffects` | `applyLifeSaveEffects` / `dismissLifeSaveEffects` | Safe opt-in save writer (`+318` affection, `+327` form arrow, `+328` unavailable days) & dismissal |
| `calendar:advance` / `calendar:setMode` / `calendar:addEvent` / `calendar:removeEvent` | `advanceCalendar` / `setCalendarMode` / `addCalendarEvent` / `removeCalendarEvent` | Full Calendar day/next-event/catch-up stepping, Basic/Full toggle & custom calendar events |
| `report:make` / `update:check` | `makeReport` / `checkUpdate` | Sanitized bug report `.txt` / GitHub `LimaDiogenes/BAL_lifelegendmod` check |
| `share:image` / `share:save` | `shareImage` / `saveShot` | Capture UI PNG card to clipboard/file |
| `app:paths` / `emblem:colors` / `faces:get` | `paths` / `emblemColors` / `playerFaces` | Local portraits, emblems & palette colors |

---

## 3. Save Layer (`src/save/`)
- `pesCrypt.js`: MT19937 stream cipher + SHA-512 header verification (`splitSave` / `joinSave`, built-in PES 2021 key + extra 64-byte keys).
- `layout.js`: `standardFits()` + `detectLayout()` for Lua-expanded saves; `plausibleId` accepts `1..3,999,999` and created-player bit-31 IDs (`0x80000000..0x803FFFFF`); `assertStandard()` guards save writes.
- `blReader.js`: Reads teams, coaches, competitions, matches, lineups, last-match goal timeline, `history` + `debuts`, `careerRecords` (Club Records `L.player + 0x3AC` stride `0x30`, International Record `L.player + 0xEEC`, plus `clubTotals` and `combinedTotals`), offers, negotiations, interests, transfer windows, `playerOfYear`.
- `playerProfile.js`: Profile at `P - 48` (376 B): 25 7-bit abilities, height, weight, age, foot, position, style, role, `+318` affection, `+327` formArrow (3 bits), `+328` unavailableDays, `+330` listed flags, `+372` marketValue.
- `training.js`: Focus bars, skill/position in training (`P + (0xC7DCEC - 0xB7E2C4)`).
- `formations.js` / `influenceWrite.js` / `offerRedirect.js` / `conductWrite.js` / `lifeEffectsWrite.js`: Safe save-writers (blocked if `PES2021.exe`/`FL_*.exe` running or `!standardFits`, rolling backups, atomic write, post-write verification; `lifeEffectsWrite.js` updates `+318` affection, low 3 bits of `+327` preserving bits 3..7, and `+328` unavailableDays).
- `gameDb.js` / `cpk.js` / `dds.js` / `emblems.js` / `faces.js` / `boots.js` / `replays.js`: Sider `cpk.root` + `.cpk` readers, DXT1/3/5 textures, faces, boots, emblems, replays.

---

## 4. AI Layer (`src/ai/`)
- `privacyShield.js`: Default-ON local decoy mapper (`PRIVACY_FIELDS`, up to 10 renamable `customPeople`, `real = decoy` lines/overrides, single-pass `giu` case-insensitive regex, preserves lowercase/Title Case/ALL CAPS on output); auto-ingests `persona.roots` (`hometown`, `childhood`, `academy`) and `persona.circle` (`protect !== false`, role-aware pools via `personaPrivacyEntries`); `previewMasked`, `privacyWords`.
- `providers.js`: `anthropic`, `google` (Gemini + auto backups + audio `transcribe`), `openai`, `groq`, `openrouter`, `custom` (OpenAI-compatible).
- `prompts.js`: System/user prompts for *La Transversale*, edition bundle, Kop replies/threads/discussions, DMs, press, interviews, mails, Vestiaire, `factCheck`, `OFF-PITCH LIFE`, `PERSONA & INNER CIRCLE` (`FACTS.persona`), `OFF-PITCH HUB` (`FACTS.off_pitch_hub`).
- `factcheck.js`: Deterministic pre-filter (`hasFactualClaim`, `needsAiFactCheck`, `filterBanter`) + `privacyMap` masking + `onAudit` logging + `salvageCorrections`.

---

## 5. World Simulation (`src/world/`) & Frontend (`lifelegend/`)
- **Orchestrator:** `world.js` (Sync pipeline + interactive handlers + in-memory `aiAuditLog`).
- **Simulation modules:** `snapshot.js`, `calendar.js` (Basic vs Full spoiler-safe catch-up queue, `buildVisibleSnapshot`, day rhythm, custom events), `persona.js` (8 presets, 6 traits, roots, flavor, 4-group Inner Circle), `lifeHub.js` (career-stage calibration, finances/ledger, lifestyle shop, 5 relationship meters, 1→5 multi-slot sponsors, days-off actions, dilemmas & pending save effects), `seasons.js` (`resolveCareerRecords`, `resolveHistory`, `careerFacts`), `pantheon.js`, `reunion.js`, `scores.js`, `worldFootball.js`, `agent.js`, `sponsors.js` / `sponsorTexts.js`, `objectives.js`, `conduct.js`, `influence.js`, `rival.js`, `derby.js`, `fanVote.js`, `chant.js`, `interview.js`, `promises.js`, `rumors.js`, `coachAdvice.js`, `dms.js`, `huddle.js`, `fanMood.js`, `toneContext.js`, `mercato.js`, `notoriety.js`, `clubAccounts.js`, `clubPosts.js`, `clubFollowers.js`, `clubColors.js`, `competitions.js`, `competitionDesk.js`, `paperRules.js`, `tribunePlan.js`, `postTexts.js`, `media.js`, `playerFaces.js`.
- **Frontend Views (`lifelegend/app.js`):**
  1. **La Transversale** (`national`) — national sports daily & press conference portal
  2. **Local Fan Blog** (`local`) — club-colored fan blog
  3. **Kop** (`tribune`) — social feed, mentions, quotes, polls, DMs
  4. **Mails** (`mail`) — inbox, agent/coach/sponsor negotiations & Career File (`ds`/`dc-*`)
  5. **Vestiaire** (`huddle`) — club & national team private group chats
  6. **Scoreline** (`stats`) — live stats, comparator, career table, league/club hubs
  7. **Panthéon** (`pantheon`) — bio chapters, Full Career Records (`Club + International`), inline unknown-club naming, Career Path, Debuts/Records, Honours (`playerOfYear`)
  8. **My Life** (`mylife`) — calibration, overview (dilemmas, opt-in Save Effects card, 5 relationship meters, days-off AP actions, off-pitch log), **Calendar** (Basic/Full spoiler-safe queue toggle, `Next day`/`Next event`/`Catch up`, interactive month grid, day rhythm tags, custom events), multi-slot editable sponsors, lifestyle shop & financial ledger
  9. **Settings** (`settings`) — Save/Key (`lifeSaveEffects`), AI provider/backups, Language (`en` default, `pt` second), Appearance, Gameplay (`calendarMode`), *Your Player* (`bio`, `Persona & Inner Circle`, `Privacy Shield`, `Life dates`), About/Report/Updates.
- **Dictionaries (`lifelegend/i18n/`):** `en.js`, `pt.js`, `es.js`, `it.js`, `de.js` (strict key & placeholder parity enforced by `tests/i18n.test.js`).
