# PES 2021 / SP Football Life (FL26 / FL27 / GigaPack) — Complete Technical & Binary Handoff

> **Purpose:** This document consolidates all reverse-engineered binary layouts, offsets, bitfields, cryptographic routines, CPK/Sider asset pipelines, and critical edge-cases discovered while building **BAL LifeLegend Mod** (`F:\_Antigravity_Projects\BAL_lifelegendmod`). It is designed as a direct reference for **Claude** and other agents working on **PES Mod Studio** (`F:\_Antigravity_Projects\PES-Mod-Studio`) or related PES 2021 / Football Life tools.

---

## 1. Save File Cryptography & Container Format (`BL*`, `ML*`, `EDIT*`, `SYSTEM*`, `TEMBLEM*`, `REPLAY*`)

Reference implementation: `src/save/pesCrypt.js` (port of `libpesXcrypter`).

### 1.1 Master Keys (64 bytes)
- **Vanilla eFootball PES 2021 & SP Football Life 2026** use the standard 64-byte PES 2021 master key:
  ```text
  90 61 D8 66 43 77 24 F8 92 BA B8 71 21 C7 60 63
  F0 91 9A 7D ED 47 80 DE 51 F5 DD D1 08 FE 32 84
  F5 09 92 00 B2 3E 88 9F EB 24 43 05 58 76 00 22
  9B FE EC F6 50 00 29 D3 42 75 50 B9 EC D2 F6 75
  ```
- **SP Football Life 2027** encrypts its saves (`BL00000000`, `ML00000000`, `EDIT00000000`) with a custom 64-byte master key (`fl27_save_key.bin`).
- **Key Validation Trick:** You can auto-detect which 64-byte key unlocks a save without knowing the game version in advance by decrypting the `320`-byte Encryption Header and `208`-byte File Header and checking whether:
  ```text
  320 + 208 + sizes.desc + sizes.logo + sizes.data + (sizes.serial * 2) === fileBuffer.length
  ```

### 1.2 Container Layout
Every encrypted save file consists of 6 contiguous regions:
1. **Encryption Header (`0x000..0x13F`, `320` bytes):**
   - Bytes `0..255` (encrypted): Four `64`-byte `SHA-512` digests of the plaintext `desc`, `logo`, `data`, and `serial` buffers, in that exact order.
   - Bytes `256..319` (`tail`, `64` bytes, plaintext): Random salt/tail bytes.
   - `headerKey = xorRepeating(tail, reverseLongs(masterKey))` (where `reverseLongs` reverses the byte order of each 8-byte qword in the 64-byte key).
   - Decrypting bytes `0..255` with `cryptStream(headerKey, ...)` yields the 4 SHA-512 digests (`header[0..255]`), while `header[256..319] = tail`.
   - `rollingKey = xorRepeating(header[0..64], header[64..320])` (`64` bytes).
2. **File Header (`0x140..0x20F`, `208` bytes):**
   - Encrypted with `cryptStream(xorWithLong(rollingKey, 208), ...)`.
   - Decrypted fields:
     - `+64` (`0x40`): `u32LE dataSize`
     - `+68` (`0x44`): `u32LE logoSize`
     - `+72` (`0x48`): `u32LE descSize`
     - `+76` (`0x4C`): `u32LE serialChars` (`serialByteSize = serialChars * 2`)
     - `+144..+175` (`0x90..0xAF`): Null-terminated ASCII `fileType` (`"BL"`, `"ML"`, `"EDIT"`, `"SYSTEM"`, `"TEMBLEM"`, `"REPLAY"`).
     - `+176..+207` (`0xB0..0xCF`): Null-terminated ASCII `gameVersion`.
3. **Four Payload Sections (`desc`, `logo`, `data`, `serial`):**
   - Located sequentially starting at file offset `528` (`0x210`):
     - `desc` (`sizes.desc` bytes): Encrypted with `cryptStream(xorWithLong(rollingKey, 0), ...)`
     - `logo` (`sizes.logo` bytes): Encrypted with `cryptStream(xorWithLong(rollingKey, 1), ...)`
     - `data` (`sizes.data` bytes): Encrypted with `cryptStream(xorWithLong(rollingKey, 2), ...)`
     - `serial` (`sizes.serial` bytes): Encrypted with `cryptStream(xorWithLong(rollingKey, 3), ...)`
   - **Fast Peek Optimization:** To list saves in a UI with zero lag, pass `{ descriptionOnly: true }` and only decrypt the headers + `desc` section (skips ~13 MB of `data`).
   - **Re-Encryption (`joinSave`):** Recompute the 4 SHA-512 digests over `[desc, logo, data, serial]`, concatenate with the original 64-byte `tail`, derive the new `rollingKey = xorRepeating(header[0..64], header[64..320])`, and encrypt each section. Verified byte-exact roundtrip (`decryptSave(joinSave(splitSave(buf))) === buf`).

### 1.3 `desc` Section Format (BL / Replay Metadata)
- **In `BL000000XX`:** UTF-8 strings separated by `\0` / `\n`:
  - `parts[0]`: Slot label (e.g., `"Vers une Légende 01"` / `"Become a Legend 01"`)
  - `parts[1]`: Player name
  - `parts[2]`: `"<Club Name> / <League Name>"`
  - `parts[3]`: In-game date as `"DD/MM/YYYY"`
- **In `REPLAY000000XX` (`src/save/replays.js`):**
  - Line 0: Replay title (`"Ralenti 01"`)
  - Subsequent lines: `"<HOME> vs <AWAY>"`, Mode name, `"Elapsed time: <N> min"`, `"Scorer: <PLAYER>"`.
- **In `TEMBLEM000000XX` (`src/save/emblems.js`):**
  - `data` section has an `80`-byte header (`0x50`), followed by `256 × 256 × 4` bytes (`262,144` bytes) of raw **BGRA** pixels (swap `B` at `[i]` and `R` at `[i+2]` to encode as RGBA PNG).

---

## 2. `BL00000000` (Become a Legend) — Binary Memory Map (`data` Section)

Reference implementations: `src/save/blReader.js`, `src/save/layout.js`, `src/save/playerProfile.js`, `src/save/training.js`, `src/save/formations.js`, `src/save/influenceWrite.js`, `src/save/offerRedirect.js`, `src/save/conductWrite.js`, `src/save/lifeEffectsWrite.js`.

### 2.1 Overview of Standard vs. Expanded (Lua / GigaPack / FL Mod Studio) Saves
In standard PES 2021 and SP Football Life 2026/2027 saves, all major tables reside at fixed offsets (`STANDARD` in `src/save/layout.js`). However, when a user installs Lua expansion modules (such as **FL Mod Studio** or **Matozanato's GigaPack**, which expand the save to 736+ teams, more competitions, more matches, and wider calendar day blocks), every table shifts by a different delta!

| Table / Block | Standard Offset | Record Stride | Count / Span | Notes & Dynamic Signature (`src/save/layout.js`) |
| :--- | :--- | :--- | :--- | :--- |
| **Team Table** | `0x000000` | `0x690` (`1680` B) | Up to `750` slots (`(L.coach - 8) / 0x690`) | Starts at byte `0` of `data`. **Contains empty slot holes — never `break` on empty slots!** |
| **Coach & Lineup Table** | `0x133A38` (coach name) | `0x258` (`600` B) | Indexed by `team.slot` | Record starts at `name - 0x10`; `u32 teamSlot` is at `name - 8`. Dynamic finder looks for 40 consecutive records with `u32` at `o + k*0x258 - 8 === k` (`k = 0..39`). |
| **Competition Table** | `0x1F1DFE` (comp name) | `0x314` (`788` B) | Variable (~100+) | `u16 compId` at `name - 2`; `u16 emblemLcLogoId` at `name + 0x7E`. Dynamic finder looks for 30 consecutive printable names with `u16(o - 2) < 0x1000`, then walks backward. |
| **Match Table** | `0x329B08` (match 0 date) | `0x254` (`596` B) | `13,001` slots | Each match starts with a 4-byte date (`[u16 year][u8 month][u8 day]`), with its competition/round `u32` at **`o - 4`**. |
| **365-Day Calendar** | `0xA8D6CC` (Jan 1) | `0x2C4` (`708` B) | `365` days | Each day starts with `u32 0xFFFFFFFF` followed by non-`0xFFFFFFFF`, then 8-byte events (`type === 0x3F` terminates the day). Expanded saves have a larger `calendarDay` stride (deduced via transfer window event distances in `findCalendar`). |
| **BAL Player Profile** | `0xB7E294` (`PLAYER_REC - 48`) | `376` B (`0x178`) | 1 (Active Player) | Bit-packed PES 2021 player structure (abilities, positions, skills, form, affection, market value). |
| **BAL Player ID & Name** | `0xB7E2C4` (`PLAYER_REC`) | — | 1 | `u32LE playerId` at `+0`, UTF-8 `playerName` (`61` B) at `+8`. Dynamic finder searches for `playerName + \0` preceded 8 bytes earlier by a plausible `playerId`. **All player-relative blocks below keep a fixed delta from `L.player` even in expanded saves!** |
| **Player Club & Contract** | `0xB7E3C0` (`P + 0xFC`) | — | 1 | Current `clubRef`, `nationalTeamRef`, contract end date, salary, previous/first club, debuts. |
| **Player Club Career Records** | `0xB7E670` (`P + 0x3AC`) | `0x30` (`48` B) | `16` club stints | Season-by-season / club-by-club career appearances, goals, assists, rating sum, start year/month. |
| **Player NT Career Record** | `0xB7F1B0` (`P + 0xEEC`) | `0x30` (`48` B) | 1 | International career totals (`teamRef`, apps, goals, assists, rating sum). |
| **Last Match Event Log** | `0xBE6388` (`P + 0x680C4`) | `40` B (`0x28`) | Span `0x2000` | Detailed goal/assist log (minute, scorer ID, assist ID, shot distance in meters, goal type) for the **last played match only**. |
| **In-Game Inbox Messages** | `0xBE8B84` / `0xBE8BCC` | `0x50` (`80` B) | `128` messages | Shared BAL/ML message inbox (transfer arrival `type 35`, departure `type 33`, offer received `type 0x47`). |
| **Player of the Year (Ballon d'Or)** | `0xBEE290` (`P + 0x6FFCC`) | `0x17D8` (`6104` B) | `6` annual slots | Annual top-3 podium (`playerId`, `teamRef`, `points`). |
| **Training Allocations** | `0xC7DCEC` (`P + 0xFFA28`) | `0x11` (`17` B) | 1 | 8 training focus bars (`0..6`), skill/position points, active skill (`67..108`) & position (`1..13` or `108`) in training. |
| **Career Start Anchor** | `0x10C0078` | `0x20` | 1 | Career start date at `+4`, `u32 playerId` at `+0x1C`. |
| **Transfer Offers Table** | Dynamic (`~0x1217D8D` vanilla / `~0x1282C02` FL) | `0x30` (`48` B) | `40` slots | Anchored by 16-byte `OFFER_MARKER`: `74 45 07 00 00 00 00 00 00 00 00 00 00 00 00 00` (search from `0x1000000`). First offer is at `marker + 0x10`. |
| **Club-to-Club Negotiations** | `marker + 0x14 + 0xD5B8` | `0x3C` (`60` B) | `64` slots | Must exist alongside an external club's offer for the game to display the offer. |
| **Interested Clubs List** | `marker + 0x14 + 0x56294` | `0x2C` (`44` B) | `64` slots | Hidden scout/interest table (`playerId`, `clubRef`, `sinceDate`, `valuation`, `offerMade`, `level`). |
| **Offer Deadlines & Dossiers** | `marker + 0x57F70` | `100` B (`0x64`) | `20` blocks × 8 rows | **Critical internal dossier ID (`N != 0xFF`)** required for an accepted offer to execute a transfer! |

---

## 3. Detailed Record Layouts & Critical Gotchas

### 3.1 Team Table (`0x000000`, Stride `0x690`)
For slot index `k` (`0 <= k < maxTeams`, where `maxTeams = Math.floor((L.coach - 8) / 0x690)` = `750` in standard saves):
- Base offset: `o = k * 0x690`.
- **CRITICAL GOTCHA (Sparse Slots at `k = 80`):**
  - Do **NOT** stop reading the team table when `d[o + 0x54] === 0` or `0xFF`!
  - In standard PES 2021 / Football Life saves, slot `k = 80` is an empty gap (`d[o + 0x54] === 0`), while slots `81..749` contain **590 valid clubs and national teams** (including Brazilian Serie A clubs like `SC Corinthians` at `k = 392`, `Inter Miami CF` at `k = 720`, and all National Teams like `Brazil` at `k = 45`).
  - Always use `continue` on empty slots and verify `(ref & 0x3FFF) === k && (ref >>> 14) > 0`.
- **How `teamRef` Works (`u32LE` at `o + 0x50`):**
  - Every match, contract, offer, and career record in the save references teams by a 32-bit packed integer `ref`:
    ```js
    const ref = d.readUInt32LE(o + 0x50);
    const teamId = ref >>> 14;     // True PES database Team ID (e.g. 103 = Liverpool, 1247 = Corinthians, 45 = Brazil)
    const teamSlot = ref & 0x3FFF; // 0-based index k in the save's Team & Coach tables
    ```
- **Fields inside each `0x690` Team Block:**
  - `+0x50`: `u32LE ref` (`(teamId << 14) | k`)
  - `+0x54`: UTF-8 `name` (`0x46` = `70` bytes, null-terminated)
  - `+0x9A`: UTF-8 `shortName` / 3-letter abbreviation (`4` bytes, null-terminated)
  - `+0xA0`: UTF-8 `stadiumName` (`0x80` = `128` bytes, null-terminated)
  - `+0x19C`: **Roster Table** (`40` slots × `8` bytes = `0x140` bytes):
    - Entry `r` (`0..39`) at `o + 0x19C + 8 * r`:
      - `+0`: `u32LE internalSlot` (`(val & 0xFFFF) === 0xFFFF` means end of roster / empty slot). **Note:** Every player in a career has a unique internal registration number (`internalSlot`) that stays with them when transferred!
      - `+4`: `u32LE playerId`
  - `+0x2E8`: `u16LE customEmblemSlot` (`0xFFFF` = none; otherwise loads `TEMBLEM` file `TEMBLEM${slot.toString(16).toUpperCase().padStart(8, '0')}`).
  - `+0x2EA`: **Shirt Numbers** (`40` × `u16LE` = `80` bytes, parallel to the 40 roster entries; valid shirts are `1..99`, empty slots are `0`).
  - `+0x476`: `u8 playerCount` (exact number of active players in the roster).
    - **CRITICAL GOTCHA for Transfers:** When moving a player between clubs in the save, you **must** update `d[o + 0x476] = roster.length` on both the selling and buying clubs! If `+0x476` is not updated, the game fails to render the player in either squad.
  - `+0x4B0`: **Club Tactic A** (`3` phases × `33` bytes = `99` bytes, followed by `61` bytes of tactical settings = `0xA0` bytes total).
  - `+0x550`: **Club Tactic B** (`3` phases × `33` bytes + `61` bytes settings).

### 3.2 Coach & Tactics Lineup Table (`0x133A38`, Stride `0x258`)
For a team with `slot = ref & 0x3FFF`:
- Coach name offset: `c = L.coach + 0x258 * slot` (where `L.coach = 0x133A38` in standard saves).
- The full coach record starts at `recFull = c - 0x10`, and the tactics pointer base in `blReader.js` is `rec = c - 8`:
  - `c - 8` (`rec + 0`): `u32LE teamSlot` (must equal `team.slot`).
  - `c` (`rec + 8`): UTF-8 `coachName` (`0x40` = `64` bytes).
  - `(c - 0x10) + 0x48`, `+0xE8`, `+0x188`: Coach's 3 tactical presets (each is `3 × 33` bytes of formation phases + `61` bytes of sliders). When writing a new formation to a club (`src/save/influenceWrite.js`), overwrite both `Club Tactic A/B` (`+0x4B0`, `+0x550`) **and** all valid coach tactics (`+0x48`, `+0xE8`, `+0x188`).
  - `(c - 8) + 544` (`+0x220`): **Starting XI & Bench Order** (`40` × `u8`). Each byte is a `0..39` index into `team.roster` (`0xFF` = unused). The first 11 distinct valid indices are the current Starting XI.
  - `(c - 8) + 584` (`+0x248`): **Set-Piece Takers** (`6` × `u8` indices into `team.roster`):
    - `+584`: Long Free Kick
    - `+585`: Short Free Kick
    - `+586`: Free Kick Taker #2
    - `+587`: Left Corner
    - `+588`: Right Corner
    - `+589`: Penalty Taker
  - `(c - 8) + 593` (`+0x251`): **Captain** (`u8` index into `team.roster`, `0xFF` = none).

### 3.3 Formation Phase Format (`33` bytes — `src/save/formations.js`)
Each formation phase (In Possession, Out of Possession, Kick-Off) is `33` bytes:
- Bytes `0..10` (`11` × `u8`): Role code for each of the 11 on-pitch players (`0` = `GK`, `1` = `CB`, `2` = `LB`, `3` = `RB`, `4` = `DMF`, `5` = `CMF`, `6` = `LMF`, `7` = `RMF`, `8` = `AMF`, `9` = `LWF`, `10` = `RWF`, `11` = `SS`, `12` = `CF`). Byte 0 is always `0` (`GK`).
- Bytes `11..32` (`11` × `[u8 x, u8 y]`): Pitch coordinates for each player:
  - `x`: Depth (`3` for GK, `~10..43` for outfielders from defense to attack).
  - `y`: Width (`16` left touchline to `88` right touchline, `52` center).

### 3.4 Competition Table (`0x1F1DFE`, Stride `0x314`)
Starting at `o = L.comp` (`0x1F1DFE`), while `d[o]` is a printable byte (`0x20..0xF7`), stepping by `0x314`:
- `o - 2`: `u16LE competitionId`
- `o`: UTF-8 `competitionName` (`0x46` = `70` bytes)
- `o + 0x7E`: `u16LE emblemLcLogoId` (maps to `common/render/symbol/emblemLc/emb_XXXX_l.png`).

### 3.5 Match Table (`0x329B08`, Stride `0x254`, `13,001` Records)
For match index `i` (`0 <= i < 13001`), at `o = L.match + i * 0x254`:
- **`o - 4` (`u32LE compField`):**
  - **CRITICAL GOTCHA:** The competition & round word for match `i` is located **4 bytes BEFORE the match date (`o - 4`)**, NOT at `o + 0x250`! Reading `o + 0x250` reads the *next* match's competition header.
  - `competitionId = compField & 0xFFFF`
  - `round = (compField >>> 16) & 0xFF`
- `o + 0x00`: `u16LE year` (`2000..2100`), `u8 month` (`o + 2`), `u8 day` (`o + 3`)
- `o + 0x08`: `u32LE kickoffHour`
- `o + 0x0C`: `u32LE homeTeamRef`
- `o + 0x10`: `u32LE awayTeamRef`
- `o + 0x14`: `u8 homeGoals` (only valid if `played === true`)
- `o + 0x17`: `u8 awayGoals` (only valid if `played === true`)
- `o + 0x1C`: **Home Lineup** (`17` slots × `16` bytes = `272` bytes = `0x110`)
- `o + 0x12C`: **Away Lineup** (`17` slots × `16` bytes = `272` bytes = `0x110`)
  - **CRITICAL GOTCHA (`played` detection):** Never rely on bit 30 of `compField` to check if a match was played — it is missing on UCL playoff first legs and prematurely set on unplayed second legs. Instead, parse `homeLineup` and `awayLineup`; a match is played iff `homeLineup.length >= 7 && awayLineup.length >= 7`.
  - **Each 16-byte Lineup Slot (`e = base + 16 * k`, `k = 0..16`):**
    - `e + 0`: `u32LE internalSlot` (`0xFFFF` = empty)
    - `e + 4`: `u32LE playerId` (`0` = empty)
    - `e + 8`: `u32LE events` → `goals = events & 0xFF`, `assists = (events >>> 8) & 0xFF`
    - `e + 12`: `u32LE packed`:
      - `minutes = packed & 0x7F`
      - `ratingRaw = (packed >>> 8) & 0x3F`
      - `posPlayed = (packed >>> 14) & 0xF` (`0`=GK, `1`=CB, `2`=FB, `3`=DMF, `4`=CMF, `5`=WMF, `6`=AMF, `7`=SS, `8`=WF, `9`=CF)
      - **`starter = ((packed >>> 21) & 1) === 1`** (**CRITICAL:** The first 11 slots in the 17-slot array are NOT always the 11 starters! Verified across 1,032 lineups: bit 21 always identifies the exact 11 starters).

### 3.6 BAL Player Profile (`PLAYER_REC - 48` = `0xB7E294`, `376` Bytes)
Let `P = L.player` (`0xB7E2C4` in standard saves, where `d.readUInt32LE(P)` is `playerId` and `P + 8` is the 61-byte UTF-8 `playerName`).
Let `o = P - 48` (`0xB7E294`). Helper: `bits(d, off, bit, len) = ((d.readUInt32LE(off)) >>> bit) & ((1 << len) - 1)`.
- `o + 0`: `u8 heightCm` (`140..215`)
- `o + 1`: `u8 weightKg` (`45..130`)
- `o + 3`, bit `7` (`1` bit): `strongFoot` (`0` = Right, `1` = Left)
- `o + 7`, bits `4..7` (`4` bits): `registeredPosition` (`0`=GK, `1`=CB, `2`=LB, `3`=RB, `4`=DMF, `5`=CMF, `6`=LMF, `7`=RMF, `8`=AMF, `9`=LWF, `10`=RWF, `11`=SS, `12`=CF)
- `o + 28`, bits `0..5` (`6` bits): `age` (`15..45`)
- `o + 29`, bits `3..7` (`5` bits): `playingStyle` (`1`..`21`, e.g. `1`=Goal Poacher, `2`=Dummy Runner, `3`=Fox in the Box, `4`=Prolific Winger, `5`=Classic No.10, `6`=Hole Player, `7`=Box-to-Box, `8`=Anchor Man, `9`=The Destroyer, `10`=Extra Frontman, `11`=Offensive Full-back, `12`=Defensive Full-back, `13`=Target Man, `14`=Creative Playmaker, `15`=Build Up, `16`=Offensive GK, `17`=Defensive GK, `18`=Roaming Flank, `19`=Cross Specialist, `20`=Orchestrator, `21`=Full-back Finisher)
- **25 Player Abilities (each is `7` bits, range `25..99`, at `o + byteOffset`, starting at `bitOffset`):**
  | Ability | `byteOffset` | `bitOffset` | Ability | `byteOffset` | `bitOffset` |
  | :--- | :---: | :---: | :--- | :---: | :---: |
  | `offensiveAwareness` | `+3` | `0` | `jump` | `+25` | `6` |
  | `defensiveAwareness` | `+4` | `0` | `physicalContact` | `+21` | `6` |
  | `gkAwareness` | `+4` | `7` | `balance` | `+22` | `5` |
  | `dribbling` | `+5` | `6` | `stamina` | `+26` | `5` |
  | `ballControl` | `+6` | `5` | `ballWinning` | `+12` | `7` |
  | `tightPossession` | `+8` | `0` | `aggression` | `+13` | `6` |
  | `finishing` | `+8` | `7` | `gkCatching` | `+16` | `7` |
  | `lowPass` | `+9` | `6` | `gkClearing` | `+17` | `6` |
  | `loftedPass` | `+10` | `5` | `gkReflexes` | `+18` | `5` |
  | `heading` | `+12` | `0` | `gkReach` | `+20` | `0` |
  | `placeKicking` | `+14` | `5` | `speed` | `+20` | `7` |
  | `curl` | `+16` | `0` | `kickingPower` | `+24` | `0` |
  | `acceleration` | `+24` | `7` | | | |
- **41 Player Skills (`o + 28`, bit index `code = 67..107`):**
  - Checked via `Boolean(d[o + 28 + (code >> 3)] & (1 << (code & 7)))`.
  - Codes `67..107` map directly to the 41 PES player skills (see `SKILLS` table in `src/save/training.js`, e.g. `67`=Scissors Feint, `68`=Flip Flap, `69`=Marseille Turn, ..., `92`=Captaincy, `93`=Super-sub, `94`=Fighting Spirit, ..., `106`=Long Range Shooting, `107`=Through Passing).
- **Dynamic Status & Career Fields inside the `376`-Byte Profile (`o = P - 48`):**
  - `o + 318` (`u8`): **Coach Affection / Trust** (`0..99`). Safe to read & write!
  - `o + 327`, bits `0..2` (`3` bits): **Form Arrow** (`0` = Very Poor, `1` = Poor, `2` = Normal, `3` = Good, `4` = Excellent). When writing, preserve the top 5 bits: `d[o + 327] = (d[o + 327] & ~0x07) | (newArrow & 0x07)`.
  - `o + 328` (`u8`): **Unavailable / Injury Days** (`0..255`). Writing a positive value here sidelines the player for that many days.
  - `o + 330`, bit `1`: `transferListed` (`bool`)
  - `o + 330`, bit `2`: `loanListed` (`bool`)
  - `o + 336`, bits `0..4` (`5` bits): `teamRole` (`1`..`22`, e.g. `1`=Youth Prospect, `2`=Protégé, `3`=Team Player, ..., `5`=Star Player, `6`=Leader, ..., `13`=Key Player, `14`=Superstar, `18`=Bandiera/Symbol, `19`=Legend).
  - `o + 372` (`i32LE`): `marketValueDiv100` (multiply by `100` for Euros).

### 3.7 Player Club, Contract, History & Multi-Season Career Records
Let `PC = P + 0xFC` (`0xB7E3C0` in standard saves):
- `PC + 0x00`: `u32LE currentClubRef`
- `PC + 0x04`: `u32LE nationalTeamRef`
- `PC + 0x0C`: `4`-byte Date (`[u16 year][u8 month][u8 day]`) — `contractUntil`
- `PC + 0x30`: `u32LE annualSalaryDiv100` (multiply by `100` for Euros)
- `PC + 0x34`: `u32LE previousClubRef` (`0xFFFFFFFF` if none)
- `PC + 0x38`: `u32LE firstClubRef` (`0xFFFFFFFF` if none)
- `PC + 0x3C`: `4`-byte Date — `joinedClubDate`
- `PC + 0x70` and `PC + 0xA0` (stride `0x30`): **Club & National Team Debut Records**:
  - `+0`: `u32LE kind` (`0` = club debut, `2` = national team debut)
  - `+4`: `u32LE year`, `+8`: `u32LE month`, `+12`: `u32LE competitionId`, `+16`: `u32LE teamRef`, `+20`: `u32LE opponentRef`.
- **Multi-Season Club Career Records (`P + 0x3AC`, up to `16` records × `0x30` bytes):**
  - Record `i` at `o = P + 0x3AC + i * 0x30`:
    - `o + 0x00`: `u32LE clubRef` (`0` or `0xFFFFFFFF` = end of list)
    - `o + 0x08`: `u32LE w2` → `apps = w2 & 0xFFF`, `goals = (w2 >>> 12) & 0xFFF`
    - `o + 0x0C`: `u32LE w3` → `ratingSumX10` (`avgRating = Math.round(w3 / apps) / 10`)
    - `o + 0x10`: `u32LE w4` → `assists = (w4 >>> 12) & 0xFFF`
    - `o + 0x14`: `u16LE yearBits` → `startYear = yearBits & 0x7FF`
    - `o + 0x2C`: `u8 startMonth` (`1..12`), `o + 0x2D`: `u8 endMonth` (`1..12`)
- **International Career Totals (`P + 0xEEC`, `0x30` bytes):**
  - Same layout as a club record (`teamRef` at `+0`, `w2` apps/goals at `+8`, `w3` ratingSumX10 at `+12`, `w4` assists at `+16`).

### 3.8 Transfer Offers & Atomic Offer Redirection (`src/save/offerRedirect.js`)
Searching from `0x1000000` (or `Math.min(0x1000000, L.player)`) for the 16-byte `OFFER_MARKER`:
```text
74 45 07 00 00 00 00 00 00 00 00 00 00 00 00 00
```
Let `m = d.indexOf(OFFER_MARKER, 0x1000000)`:
1. **Offers Table (`m + 0x10`, `40` slots × `0x30` bytes):**
   - `+0x00`: `u16LE offerId` (`0xFFFF` = free slot)
   - `+0x04`: `u32LE offeringClubRef`
   - `+0x08`: `u8 state` (`1` = open/pending, `2` = closed, `3` = accepted/planned transfer)
   - `+0x1C`: `u32LE careerKey`
   - `+0x20`: `u32LE playerId`
   - `+0x24`: `u32LE offeredSalaryDiv100`
   - `+0x28`: `u32LE playerMarketValuationDiv100`
   - `+0x2C`: `4`-byte Date (`contractUntil`)
2. **Club-to-Club Negotiations Table (`m + 0x14 + 0xD5B8`, `64` slots × `0x3C` bytes):**
   - `+0x04`: `u16LE negoId` (`0xFFFF` = free)
   - `+0x08`: `u32LE buyingClubRef`
   - `+0x20`: `u32LE sellingClubRef`
   - `+0x28`: `u32LE playerId`
3. **Interested Clubs Table (`m + 0x14 + 0x56294`, `64` slots × `0x2C` bytes):**
   - `+0x00`: `u32LE careerKey`, `+0x04`: `u32LE playerId`, `+0x08`: `u32LE clubRef`, `+0x1D`: `u8 interestLevel`, `+0x20`: `4`-byte `sinceDate`, `+0x24`: `u32LE valuationDiv100`, `+0x28`: `u8 offerMadeFlag`.
4. **Deadlines & Internal Dossier Blocks (`m + 0x57F70`, `20` blocks × `100` bytes):**
   - Block header (`4` bytes): `[0x00][u8 dossierNumber][0xFF][0xFF]`.
   - Followed by `8` rows × `12` bytes: `[u16LE offerId][u8 activeFlag (1)][u8 x][4-byte receivedDate][4-byte deadlineDate]`.
   - **CRITICAL FINDING:** An offer created from scratch in the Offers Table will display in the UI, but accepting it **never triggers a transfer** because it lacks an internal engine dossier (`dossierNumber != 0xFF`). However, if you **redirect** an existing real offer (which already has a valid `dossierNumber`) by replacing `fromClubRef` with `toClubRef` across:
     1. The Offer (`o + 4`),
     2. The Club-to-Club Negotiation (`n + 8`),
     3. The Interested Club entry (`i + 8`),
     4. The In-Game Inbox Message (`0xBE8BCC + k * 0x50 + 0x20`, where `type at +8 === 0x47`), and
     5. The Active Offer Club List (`0xC01638`, `32 × u32LE`),
     then accepting the redirected offer in-game executes the full transfer to `toClubRef` on the spot!

---

## 4. Game Database Files (`common/etc/pesdb/*.bin`), CPK Archives & WESYS Compression

Reference implementations: `src/save/cpk.js`, `src/save/gameDb.js`, `src/save/boots.js`, `src/save/faces.js`, `src/save/formations.js`.

### 4.1 Loading Order (Sider Priority Over CPKs)
Always resolve virtual paths in the exact order the game engine uses:
1. **Sider `cpk.root` directories** declared in `<gameDir>/sider.ini` or `<gameDir>/SiderAddons/sider.ini` (`^\s*cpk\.root\s*=\s*"?([^"\r\n]+?)"?\s*$`, resolved relative to the `sider.ini` folder).
2. **`<gameDir>/download/*.cpk`** (sorted in reverse alphabetical order so newer DLC/DP packs win).
3. **`<gameDir>/Data/*.cpk`** (sorted in reverse alphabetical order: `dt36.cpk`, `dt15_x64.cpk`, etc.).

### 4.2 CRI CPK `@UTF` Table Decryption & `WESYS` Zlib Unwrapping (`src/save/cpk.js`)
- **CPK `@UTF` XOR Cipher:** If the table header at offset `0` (or `TocOffset`) does not start with `"@UTF"`, decrypt it byte-by-byte:
  ```js
  let m = 0x655F;
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ (m & 0xFF);
    m = Math.imul(m, 0x4115) >>> 0;
  }
  ```
- **`WESYS` Compression Wrapper:** Many `.bin` and `.dds` files inside CPKs or Sider folders have `"WESYS"` at bytes `3..7`. Unwrap them via:
  ```js
  if (buf.length >= 16 && buf.toString('latin1', 3, 8) === 'WESYS') {
    const compressedSize = buf.readUInt32LE(8);
    return zlib.inflateSync(buf.subarray(16, 16 + compressedSize));
  }
  ```

### 4.3 Database Binary Schemas (`common/etc/pesdb/`)
1. **`Player.bin` (`src/save/gameDb.js`):**
   - Header: `8` bytes (`PLAYER_FIRST = 8`).
   - Record stride: `312` bytes (`0x138`).
   - Fields relative to record start `o` (`o = 8 + k * 312`):
     - `o + 0x00`: `u32LE playerId`
     - `o + 0x15` (`+0x1D` from file start if not subtracting header): `u16LE` → `nationalityId = (readUInt16LE(o + 0x15) >> 1) & 0x1FF` (`9` bits)
     - `o + 46` (`0x2E`): `u8` → `registeredPosition = (d[o + 46] >> 2) & 0xF`
     - `o + 0x3C`: UTF-8 `databaseName` (`61` bytes)
     - `o + 0xF3`: UTF-8 `displayName / printName` (`61` bytes — prefer `+0xF3`, fallback to `+0x3C`).
2. **`PlayerAssignment.bin` (`src/save/gameDb.js`):**
   - Record stride: `16` bytes (`0x10`), starting at offset `0`.
   - `o + 4`: `u32LE playerId`
   - `o + 8`: `u32LE teamId`
3. **`EDIT00000000` (Decrypted Edit Data in User's Save Folder — `src/save/gameDb.js`):**
   - Always overlay `EDIT00000000` on top of `Player.bin` so user-edited player names/transfers take effect!
   - `u16LE editedPlayerCount` is at offset `0x60` (`96`).
   - First player record starts at `0x7C`, stride `0x138` (`312` bytes):
     - `r + 0x00`: `u32LE playerId`
     - `r + 0x08`: `u16LE nationalityId`
     - `r + 33..34`: `position = ((r[33] >> 5) | ((r[34] & 1) << 3)) & 0xF`
     - `r + 0x36`: UTF-8 `name` (`61` bytes).
4. **`Coach.bin` (`src/save/faces.js`):**
   - Record stride: `100` bytes (`0x64`), starting at `0`.
   - `o + 0`: `u32LE coachId`
   - `o + 8`: UTF-8 `coachName` (`46` bytes).
5. **`Boots.bin` (`src/save/boots.js`):**
   - Record stride: `304` bytes (`0x130`), starting at `0`.
   - `o + 0`: `u16LE bootId`
   - `o + 204`: UTF-8 `brandName` (`100` bytes; note vanilla typo `"New Balace"` → `"New Balance"`).
6. **`TacticsFormation.bin` (`src/save/formations.js`):**
   - Record stride: `12` bytes, starting at `0`: `[u32LE tacticId][u32LE role][u8 x][u8 y][u8 slot][u8 zero]`.
   - `slot` ranges: `0..10` (Phase 0), `16..26` (Phase 1), `32..42` (Phase 2).

---

## 5. Game Graphic Assets (Emblems, Competition Logos, Minifaces, Boots, Stadiums)

Reference implementations: `src/save/emblems.js`, `src/save/faces.js`, `src/save/boots.js`, `src/save/stadiums.js`, `src/save/dds.js`.

| Asset Type | Virtual Path Pattern (inside Sider `cpk.root` or CPK Archives) | Format & Notes |
| :--- | :--- | :--- |
| **Club / NT Badges** | `common/render/symbol/flag/e_<6-digit teamId>_<r\|f>[_b\|_w][_l\|_ll].png` | Standard PNG (sometimes WESYS-wrapped in Sider). `_r` = real licensed badge, `_f` = fake/unlicensed slot in vanilla (in patched games like FL26/FL27, `_f` slots also contain real badges!). Prefer `_l` / `_ll` without `_b`/`_w`. |
| **Option-File Badges** | `<saveDir>/TEMBLEM<8-digit hex slot>` | Encrypted save container. Plaintext `data` at `+80` (`0x50`) is raw `256×256` BGRA pixels. |
| **Competition Logos** | `common/render/symbol/emblemLc/emb_<4-digit logoId>[_b\|_w]_l.png` | Standard PNG. `logoId` comes from the save's Competition Table at `compNameOffset + 0x7E`. Avoid `_w` (all-white silhouette). |
| **Player Minifaces** | `common/render/symbol/player/<playerId>.dds` | WESYS-wrapped or raw DDS (`DXT1`, `DXT3`, or `DXT5`). Decode top mipmap level to RGBA and encode as PNG. |
| **Coach Faces** | `common/render/symbol/coach/coach_<coachId>.png` | Standard PNG (match `coachName` from save against `Coach.bin` to get `coachId`). |
| **Boot Thumbnails** | `common/render/thumbnail/spike/k<4-digit bootId>_t.dds` (boot) & `k<4-digit bootId>_l.dds` (brand logo) | WESYS-wrapped or raw DDS (`DXT5`). |
| **Stadium Thumbnails** | `common/render/thumbnail/stadium/st<3-digit stadiumId>[_l].png\|.dds` | In Sider `stadium-server`, parse `<gameDir>/SiderAddons/content/stadium-server/map_teams.txt` (`teamId, stadiumId, stadiumName, relativePath`) and check `<packDir>/common/render/thumbnail/stadium/stXXX.png\|.dds` or `<packDir>/preview.png`. |
