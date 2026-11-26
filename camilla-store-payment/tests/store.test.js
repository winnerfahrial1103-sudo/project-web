import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  applySettingsPatch,
  createDefaultStore,
  ensureStore,
  sanitizeMethodInput,
  saveStore,
  toAdminStore,
  toPublicStore
} from '../src/store.js';

describe('Camilla Store data layer', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'camilla-store-unit-'));
    process.env.CAMILLA_DATA_DIR = tmpDir;
  });

  after(async () => {
    delete process.env.CAMILLA_DATA_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('seeds Camilla Store with owner 089629619000, banner, products, and 5 wallets/QRIS', () => {
    const seed = createDefaultStore();
    assert.equal(seed.settings.storeName, 'Camilla Store');
    assert.equal(seed.settings.ownerPhone, '089629619000');
    assert.equal(seed.settings.whatsappNumber, '6289629619000');
    assert.equal(seed.settings.bannerImage, '/assets/camilla-banner.jpg');
    assert.equal(seed.methods.length, 5);
    assert.ok(seed.products.length >= 40);
    const names = seed.methods.map((m) => m.name);
    assert.deepEqual(names, [
      'DANA',
      'GoPay',
      'ShopeePay (SPay)',
      'QRIS 1 (Utama)',
      'QRIS 2 (Cadangan)'
    ]);
  });

  it('persists store on disk and strips auth secrets in public & admin projections', async () => {
    const store = await ensureStore();
    assert.ok(store.auth.passwordHash.includes(':'));

    store.methods[0].hidden = true;
    await saveStore(store);

    const reloaded = await ensureStore();
    const pub = toPublicStore(reloaded);
    const adm = toAdminStore(reloaded);

    assert.equal(pub.auth, undefined);
    assert.equal(adm.auth, undefined);
    assert.equal(pub.methods.length, 4);
    assert.equal(adm.methods.length, 5);
  });

  it('sanitizes settings and payment methods safely', () => {
    const seed = createDefaultStore();
    const updatedSettings = applySettingsPatch(seed.settings, {
      storeName: '  Camilla Boutique  ',
      whatsappNumber: '62 812-9999-0000',
      operationalStatus: 'invalid_status'
    });
    assert.equal(updatedSettings.storeName, 'Camilla Boutique');
    assert.equal(updatedSettings.whatsappNumber, '6281299990000');
    assert.equal(updatedSettings.operationalStatus, 'open');

    const badImg = sanitizeMethodInput({
      name: 'QRIS Baru',
      category: 'qris',
      qrisImage: 'javascript:alert(1)'
    });
    assert.equal(badImg.qrisImage, '');
  });
});
