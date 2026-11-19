# Project Rules & Context (`BAL_lifelegendmod`)

## 1. Owner Collaboration Rules
- **Communication:** Keep responses concise, in plain words, with short numbered step lists for manual actions.
- **Safety First:** Ask before driving the screen or running `.exe` binaries.
- **Evidence Discipline:** Never guess binary offsets, save formats, or behavior. Label findings as **verified** (read/tested in code or files), **cited**, or **belief**.
- **Commit Attribution:** **Never** include AI attribution or `Co-Authored-By` trailers in git commits.
- **Bitdefender Warning:** Bitdefender Advanced Threat Control has previously quarantined Football Life executables and saves during memory/save research. Always keep save backups before any save-writing test.
- **Player-First Customization Rule:** Always preserve user choice — provide rich curated presets and default options alongside custom editable fields wherever feasible (traits, flavor details, sponsor names, personalities, life events, etc.), especially when those choices feed AI prompts (and ensure any personal words route cleanly through Privacy Shield).

## 2. Git & GitHub Workflow Rule (Mandatory)
- **Repository:** `https://github.com/LimaDiogenes/BAL_lifelegendmod`
- **Always push updates to GitHub.**
- **Version Branch Rule:** Before starting a new version or milestone on `main`, **always create and push a branch preserving the previous version** (for example: `v1.0.0-original`, `v1.0.1-original`, `v1.1.0-original`, etc.).
- **Never commit:**
  - KONAMI / Football Life game assets (`.cpk`, `.dds`, `.bin` game tables)
  - Save files (`BL00000000*`, `REPLAY0*`, `TEMBLEM*`)
  - Encryption keys (`FL_key.bin`, `data/keys/*.bin`)
  - API keys or `.env` files
  - `node_modules/`, `dist/`, or Electron runtime binaries (`LifeLegend.exe`, `.dll`, `.pak`, `locales/`)

## 3. Key Local Paths (Windows 10)
| Item | Path / URL |
|---|---|
| Fork workspace (active code) | `F:\_Antigravity_Projects\BAL_lifelegendmod\` |
| Upstream GitHub fork | `https://github.com/LimaDiogenes/BAL_lifelegendmod` |
| Unpacked 1.0.1 reference build | `F:\_SmokePatch\_FL27_INSTALL_FILES\LifeLegend-1.0.1-win-x64\` |
| FL27 game install | `F:\Games\SP Football Life 2027\` |
| FL27 BAL saves | `C:\Users\diord\Documents\SPGAME\Football Life\2027\save\` (`BL00000000`, etc.) |
| FL27 save encryption key (64 B) | `F:\_SmokePatch\_FL27_INSTALL_FILES\FL_key.bin` |
| LifeLegend runtime appdata | `%APPDATA%\LiveTweet\data` |
| Owner's main Studio app repo | `F:\_PES2021_STUDIO\pes2021-mod-studio` (C# / .NET 10, Avalonia MVVM; EN/ES/PT-BR UI) |

## 4. Initial Repository Baseline (Verified)
- Upstream commits already present when forked/cloned:
  - `d05922d` — `LifeLegend 1.0.0 — première version publique` (preserved on branch `v1.0.0-original`)
  - `b65f796` — `LifeLegend 1.0.1` (preserved on branch `v1.0.1-original`)
  - `3686e1b` — `LifeLegend 1.1.0` (preserved on branch `v1.1.0-original`)
- License: MIT (`LICENSE`, `THIRD-PARTY-NOTICES.txt`).
