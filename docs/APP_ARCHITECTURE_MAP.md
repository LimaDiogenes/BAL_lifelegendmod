# LifeLegend (`BAL_lifelegendmod`) — Architecture & Single-Source-of-Truth Map

This document maps the runtime architecture, storage topology, module boundaries, and single-source-of-truth (SSOT) contracts established for the co-director overhaul.

---

## 1. Storage Topology

Located under Electron `app.getPath('userData')`:

- `settings.json`
  - AI provider, model, encrypted API keys (`safeStorage`), `savePath`, `gameDir`, `clipsDir`, `language`, `theme`, `colors`, `autoSync`, `autoLatestSave`, `factCheck`, `tribuneThreads`, `replays`, `offerRedirect`, `influenceWrites`, `lifeSaveEffects`, `calendarMode` (`'basic'` | `'full'`), `sponsorMode` (`'realistic'` | `'custom'`), `eventMode` (`'realistic'` | `'games_only'`), `pendingBio`.
- `active.json`
  - `{ careerId }`: points to the active career directory (cleared cleanly by `Store.deleteCareer`, never touching the user's PES/FL27 save).
- `careers/<careerId>/`
  - `state.json`: main career state (`snapshot`, `saveSnapshot`, `profile`, `persona`, `privacy`, `bio`, `agent`, `sponsor`, `lifeHub`, `calendar`, `feed`, `editions`, `mail`, `dms`, `huddles`, `dailyBriefs`, `squadBirthdays`, `clubAliases`, `seasons`, `transfers`, etc.).
  - `narrative-memory.json`: per-career narrative anti-repetition & callback memory (`pressHistory`, `interviewHistory`, `quoteVault`, `dramaArcs`, `usedAngles`).
  - `profile/`, `media/`, `backups/`: career images, custom My Life media, and save-write backups.

---

## 2. Module Dependency Layers

1. **Save & Asset Layer (`src/save/`)**
   - Read/decrypt/write PES 2021 / Football Life `BL0000000x` & `EDIT00000000`: `blReader.js`, `layout.js`, `pesCrypt.js`, `playerProfile.js`, `gameDb.js`, `boots.js`, `emblems.js`, `faces.js`, `stadiums.js`, `training.js`, `formations.js`, `replays.js`, `lifeEffectsWrite.js`, `influenceWrite.js`, `conductWrite.js`, `offerRedirect.js`, `autoSaveWatch.js`.
2. **AI & Privacy Layer (`src/ai/`)**
   - `privacyShield.js` (deterministically masks & unmasks personal names/places/custom terms locally; reads both `privacy` and `persona.circle`/`persona.roots` when protected), `providers.js`, `prompts.js`, `factcheck.js`.
3. **World & Simulation Layer (`src/world/`)**
   - Core orchestration: `world.js`
   - Profile & identity: `persona.js`, `agent.js`
   - Commercial & Lifestyle: `sponsorCatalog.js`, `sponsors.js`, `sponsorTexts.js`, `lifeHub.js`, `lifeScenes.js`, `lifeMedia.js`
   - Calendar & Daily Loop: `calendar.js`, `calendarEvents.js`, `dailyPulse.js`
   - Media & Social Simulation: `narrativeMemory.js`, `dramaEngine.js`, `toneContext.js`, `tribunePlan.js`, `huddle.js`, `dms.js`, `rumors.js`, `fanMood.js`, `fanVote.js`, `chant.js`, `interview.js`, `conduct.js`, `objectives.js`, `influence.js`, `competitions.js`, `worldFootball.js`, `nationalPaper.js`, `pantheon.js`.
4. **Electron & Renderer Layer**
   - `main.js` (IPC handlers), `preload.js` (`window.live` bridge), `lifelegend/index.html`, `lifelegend/app.js`, `lifelegend/style.css`, `lifelegend/i18n/{en,es,it,pt,de}.js`.

---

## 3. Single-Source-of-Truth Contracts (Eliminated Redundancies)

| Domain | Old Redundancy / Desync | New SSOT Contract |
|---|---|---|
| **Boots & Sponsors** | `state.sponsor.deal` and `state.lifeHub.sponsors` drifted; MailBox Dossier showed *"No deal yet"* when `boots` lived in My Life; `Boots.bin` brands and custom brands collided. | `src/world/sponsorCatalog.js` holds the canonical 21-category catalog, umbrella bundles, Global Partner add-on, & regional betting rules. `state.lifeHub.sponsors` is SSOT and `syncBootSponsor` mirrors any `boots` deal directly to `state.sponsor.deal` & clears stale boot offers/mail threads on every ensure/sync/load. |
| **Agent** | `state.agent` (MailBox / Dossier) ignored custom Agent names entered in `persona.circle.business`. | `extractPersonaAgent` + `syncAgentWithPersona(state)` keeps `state.agent.name`, agency fallback, and agent mail headers in sync with Persona Business contacts. |
| **Privacy Shield** | Users typed the same family/friends/hometown/academy twice (in Persona AND in 14 duplicate Privacy Shield fields). | Persona Roots and Inner Circle own person/place entries with inline Shield toggles + optional custom decoys. Privacy Shield UI shrinks to Master Switch, Auto-protected count summary, **Other words to mask** (`fields.custom`), Preview, and AI Audit (legacy backend compatibility kept in `privacyShield.js`). |
| **Calendar & Life Events** | `state.lifeEvents` (Settings) and `state.calendar.customEvents` (My Life) were disconnected; custom events & teammate birthdays never reached News/Kop/Huddle. | `src/world/calendarEvents.js` unifies fixtures, custom events, legacy `lifeEvents`, scheduled My Life activities, player/circle/squad birthdays (with `-1`/`+1` matchday clash shifting), system events, and sponsor obligations into one agenda, decision queue, and daily/sync feed. |
| **Profile & Navigation** | Avatar menu *"Your profile"* opened Kop Social instead of Player Profile; actual player settings were buried in Settings. | Dedicated `playerprofile` page (`Player Profile`) holds Identity, DOB, Bio, Persona Traits, Roots, Inner Circle (+ DOBs + inline Shield), Past Club Aliases, Streamlined Privacy, and 2-step Career Reset; Kop profile is explicitly labeled `Kop Social Profile`; Settings focuses strictly on Save, AI, Look, World modes (`sponsorMode`, `eventMode`, `calendarMode`), and About. |
