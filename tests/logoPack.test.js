'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const { readZip, safeLogoName, installPack, listLogos } = require('../src/logoPack');

/** Minimal zip writer for the tests (stored or deflate entries). */
function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data, deflate } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const body = deflate ? zlib.deflateRawSync(data) : data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

describe('sponsor logo pack (separate download, 2.0)', () => {
  it('reads stored and deflate entries', () => {
    const zip = makeZip([{ name: 'nike.svg', data: Buffer.from('<svg/>') }, { name: 'adidas.png', data: Buffer.alloc(500, 7), deflate: true }]);
    const entries = readZip(zip);
    assert.deepEqual(entries.map((e) => e.name), ['nike.svg', 'adidas.png']);
    assert.equal(entries[1].data.length, 500);
  });

  it('refuses unsafe names (zip-slip) and non-image files', () => {
    assert.equal(safeLogoName('../evil.svg'), null);
    assert.equal(safeLogoName('C:/x/evil.svg'), null);
    assert.equal(safeLogoName('run.exe'), null);
    assert.equal(safeLogoName('sponsors/nike.svg'), 'nike.svg');
    assert.equal(safeLogoName('manifest.json'), 'manifest.json');
  });

  it('installs into the folder, checks the SHA-256, lists the logos', () => {
    const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'll-logos-')), 'sponsors');
    const zip = makeZip([{ name: 'nike.svg', data: Buffer.from('<svg/>') }, { name: '../evil.svg', data: Buffer.from('x') }, { name: 'manifest.json', data: Buffer.from('{}') }]);
    const sha = crypto.createHash('sha256').update(zip).digest('hex');
    assert.throws(() => installPack(zip, dir, { sha256: '0'.repeat(64) }), /SHA-256/);
    assert.equal(installPack(zip, dir, { sha256: sha }), 1);
    assert.deepEqual(Object.keys(listLogos(dir)), ['nike']);
    assert.ok(!fs.existsSync(path.join(path.dirname(dir), 'evil.svg')));
    assert.throws(() => installPack(makeZip([{ name: 'a.txt', data: Buffer.from('x') }]), dir, { sha256: 'PLACEHOLDER' }), /Aucun logo/);
    assert.ok(fs.existsSync(path.join(dir, 'nike.svg')));   // a failed install keeps the logos already there
  });
});
