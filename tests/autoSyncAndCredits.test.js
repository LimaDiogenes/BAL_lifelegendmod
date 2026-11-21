'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { Store } = require('../src/store');
const { buildReport } = require('../src/report');
const {
  scanSaveFiles,
  pickLatestSave,
  snapshotWatchedFiles,
  detectModifiedSave,
  resolveSaveForSync,
} = require('../src/save/autoSaveWatch');

function makeTempDocs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'll-autosave-'));
  const flSaveDir = path.join(dir, 'SPGAME', 'Football Life 2026', '76561198000000000', 'save');
  const pesSaveDir = path.join(dir, 'KONAMI', 'eFootball PES 2021 SEASON UPDATE', '76561198000000000', 'save');
  fs.mkdirSync(flSaveDir, { recursive: true });
  fs.mkdirSync(pesSaveDir, { recursive: true });
  return { dir, flSaveDir, pesSaveDir };
}

function writeFakeSlot(filePath, mtimeSec, size = 1024) {
  fs.writeFileSync(filePath, Buffer.alloc(size, 0x42));
  fs.utimesSync(filePath, mtimeSec, mtimeSec);
}

describe('Phase I — Auto-Sync defaults, Latest Save detection & Author Credits', () => {
  test('Store default settings enable autoSync by default and initialize autoLatestSave to false', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'll-store-defaults-'));
    try {
      const store = new Store(tmp);
      const settings = store.getSettings();
      assert.equal(settings.autoSync, true);
      assert.equal(settings.autoLatestSave, false);

      store.saveSettings({ autoLatestSave: true });
      assert.equal(store.getSettings().autoLatestSave, true);

      const reportText = buildReport({
        version: '0.1.5',
        platform: 'win32',
        arch: 'x64',
        electron: '35.7.5',
        settings: store.getSettings(),
        world: null,
        logText: '',
      });
      assert.match(reportText, /autoLatestSave : true/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('scanSaveFiles and pickLatestSave discover multiple slots and pick the newest readable BL save', () => {
    const { dir, flSaveDir, pesSaveDir } = makeTempDocs();
    try {
      const slot0 = path.join(flSaveDir, 'BL00000000');
      const slot1 = path.join(flSaveDir, 'BL00000001');
      const slotPes = path.join(pesSaveDir, 'BL00000000');

      writeFakeSlot(slot0, 1700000100);
      writeFakeSlot(slot1, 1700000500);
      writeFakeSlot(slotPes, 1700000300);

      const fakePeek = (file) => {
        if (file === slot0) return { fileType: 'BL', playerName: 'Lucas', playerId: 1001 };
        if (file === slot1) return { fileType: 'BL', playerName: 'Lucas (Slot 2)', playerId: 1001 };
        return { fileType: 'BL', playerName: 'Mateo', playerId: 2002 };
      };

      const saves = scanSaveFiles({ documentsDir: dir, peek: fakePeek });
      assert.equal(saves.length, 3);
      assert.equal(saves[0].path, slot1);
      assert.equal(saves[1].path, slotPes);
      assert.equal(saves[2].path, slot0);

      const picked = pickLatestSave(saves, slot0);
      assert.ok(picked.latest);
      assert.equal(picked.latest.path, slot1);
      assert.equal(picked.switched, true);
      assert.equal(picked.previousPath, slot0);

      const notSwitched = pickLatestSave(saves, slot1);
      assert.equal(notSwitched.switched, false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('pickLatestSave skips locked or errored saves when choosing the latest readable slot', () => {
    const saves = [
      { path: 'C:\\saves\\BL00000002', modified: 5000, locked: true, error: 'SAVE_KEY' },
      { path: 'C:\\saves\\BL00000001', modified: 4000, fileType: 'BL', playerName: 'Valid Newer' },
      { path: 'C:\\saves\\BL00000000', modified: 3000, fileType: 'BL', playerName: 'Valid Older' },
    ];
    const { latest, switched } = pickLatestSave(saves, 'C:\\saves\\BL00000000');
    assert.ok(latest);
    assert.equal(latest.path, 'C:\\saves\\BL00000001');
    assert.equal(switched, true);
  });

  test('snapshotWatchedFiles and detectModifiedSave detect single-slot and multi-slot save updates', () => {
    const { dir, flSaveDir } = makeTempDocs();
    try {
      const slot0 = path.join(flSaveDir, 'BL00000000');
      const slot1 = path.join(flSaveDir, 'BL00000001');
      writeFakeSlot(slot0, 1700000100);
      writeFakeSlot(slot1, 1700000200);

      // Single-slot watch (autoLatestSave = false)
      const singlePrev = snapshotWatchedFiles({ documentsDir: dir, savePath: slot0, autoLatestSave: false });
      assert.equal(singlePrev.size, 1);

      // Updating slot1 does not trigger single-slot watch on slot0
      writeFakeSlot(slot1, 1700000600);
      const singleNext = snapshotWatchedFiles({ documentsDir: dir, savePath: slot0, autoLatestSave: false });
      assert.equal(detectModifiedSave(singlePrev, singleNext), null);

      // Multi-slot watch (autoLatestSave = true) watches both slots and detects when slot1 updates
      const multiPrev = snapshotWatchedFiles({ documentsDir: dir, savePath: slot0, autoLatestSave: true });
      assert.equal(multiPrev.size, 2);

      writeFakeSlot(slot1, 1700000900);
      const multiNext = snapshotWatchedFiles({ documentsDir: dir, savePath: slot0, autoLatestSave: true });
      const changed = detectModifiedSave(multiPrev, multiNext);
      assert.ok(changed);
      assert.equal(changed.path, slot1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('resolveSaveForSync switches store.savePath to the newest slot only when autoLatestSave is enabled', () => {
    const { dir, flSaveDir } = makeTempDocs();
    const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'll-resolve-store-'));
    try {
      const slot0 = path.join(flSaveDir, 'BL00000000');
      const slot1 = path.join(flSaveDir, 'BL00000001');
      writeFakeSlot(slot0, 1700000100);
      writeFakeSlot(slot1, 1700000800);

      const fakePeek = (file) => ({
        fileType: 'BL',
        playerName: file.endsWith('01') ? 'Slot 1 Player' : 'Slot 0 Player',
        playerId: 99,
      });

      const store = new Store(storeDir);
      store.saveSettings({ savePath: slot0, autoLatestSave: false });

      const keepRes = resolveSaveForSync({ store, documentsDir: dir, peek: fakePeek });
      assert.equal(keepRes.switchedTo, null);
      assert.equal(store.getSettings().savePath, slot0);

      store.saveSettings({ autoLatestSave: true });
      const switchRes = resolveSaveForSync({ store, documentsDir: dir, peek: fakePeek });
      assert.ok(switchRes.switchedTo);
      assert.equal(switchRes.switchedTo.path, slot1);
      assert.equal(store.getSettings().savePath, slot1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.rmSync(storeDir, { recursive: true, force: true });
    }
  });

  test('Original author Saamz09 and community PES tools are explicitly credited in THIRD-PARTY-NOTICES.txt and Settings UI', () => {
    const notices = fs.readFileSync(path.join(__dirname, '..', 'THIRD-PARTY-NOTICES.txt'), 'utf8');
    assert.match(notices, /Saamz09/);
    assert.match(notices, /pesXdecrypter/);
    assert.match(notices, /AlexDelPiero23/);
    assert.match(notices, /TyNet/);

    const appJs = fs.readFileSync(path.join(__dirname, '..', 'lifelegend', 'app.js'), 'utf8');
    assert.match(appJs, /Saamz09/);
    assert.match(appJs, /rg-credits/);
  });
});
