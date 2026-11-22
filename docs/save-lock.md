# Shared save write lock (LifeLegend and blue41 PES2021 Mod Studio)

Both apps can write a Become a Legend save (`BL0000000x`). To make sure they never write the same save at the same
time, each app takes a lock file before it touches the save, and removes it when it is done.

## The lock file

- Path: `<folder of the save file>\.blue41-save.lock` (one lock per save folder, so it also covers the other slots).
- Created **exclusively** (`O_CREAT | O_EXCL`; Node `fs.openSync(file, 'wx')`, .NET `FileMode.CreateNew`).
- Content: UTF-8 JSON, no BOM:

```json
{ "app": "LifeLegend", "pid": 12345, "started": "2026-11-22T21:04:05.123Z" }
```

`app` is a display name (the studio writes `"blue41 PES2021 Mod Studio"`), `pid` is the process id of the writer,
`started` is an ISO-8601 UTC timestamp.

## Taking the lock

1. Try to create the file exclusively. If it works, write the JSON, flush it, close it: you own the lock.
2. If the file already exists, read it:
   - it is **stale** if the JSON is valid and `started` is more than **2 minutes** ago, or the process `pid` is not
     running; also stale if the JSON cannot be read and the file was last modified more than 2 minutes ago;
   - if it is stale, delete it and try step 1 once more;
   - otherwise **refuse** to write and tell the user which app is writing ("the Mod Studio is writing this save, try
     again when it has finished"). Do not wait in a loop inside a UI action.
3. Write the save (backup, temp file, fsync, rename, re-read).
4. In a `finally` block, delete the lock — but only if it still contains your own `app` and `pid` (a stale lock may
   have been taken over by the other app).

A write must never take more than 2 minutes while holding the lock, otherwise the other app may treat it as stale.

## Where it lives in LifeLegend

- `src/save/saveLock.js`: `acquireSaveLock(savePath)` / `withSaveLock(savePath, fn)`.
- `src/save/safeWrite.js`: every save write (Influence, club sanction, My Life effects, offer redirect) runs inside
  `withSaveLock`, after checking the game is closed.
- Tests: `tests/safeWrite.test.js`.
