import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createAppServer } from '../src/server.js';

describe('Camilla Store HTTP API & Admin flows', () => {
  let tmpDir;
  let server;
  let baseUrl;
  let adminCookie = '';

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'camilla-store-api-'));
    process.env.CAMILLA_DATA_DIR = tmpDir;
    server = createAppServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.CAMILLA_DATA_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('serves HTML pages, shortcut URLs (/payment, /produk), and public store JSON without leaking secrets', async () => {
    const homeRes = await fetch(`${baseUrl}/`);
    assert.equal(homeRes.status, 200);
    const homeHtml = await homeRes.text();
    assert.ok(homeHtml.includes('Camilla Store'));

    for (const shortcut of ['/payment', '/payment/dana-1', '/produk', '/produk/game', '/order']) {
      const res = await fetch(`${baseUrl}${shortcut}`);
      assert.equal(res.status, 200, `Expected 200 for shortcut ${shortcut}`);
    }

    const apiRes = await fetch(`${baseUrl}/api/store`);
    assert.equal(apiRes.status, 200);
    const data = await apiRes.json();
    assert.equal(data.settings.storeName, 'Camilla Store');
    assert.equal(data.methods.length, 5);
    assert.equal(data.auth, undefined);
  });

  it('blocks unauthenticated admin endpoints', async () => {
    const res = await fetch(`${baseUrl}/api/admin/store`);
    assert.equal(res.status, 401);
  });

  it('logs in, updates wallet number & limit info, increments limit, and resets daily limits', async () => {
    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' })
    });
    assert.equal(badLogin.status, 401);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'camilla123' })
    });
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers.get('set-cookie');
    assert.ok(setCookie);
    adminCookie = setCookie.split(';')[0];

    // Edit DANA number and limit info
    const editRes = await fetch(`${baseUrl}/api/admin/methods/dana-1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie
      },
      body: JSON.stringify({
        accountNumber: '0899-1122-3344',
        logoImage: '/assets/camilla-banner.jpg',
        limitInfo: 'Sisa limit hari ini Rp 1.000.000',
        limitMax: 1000000,
        limitUsed: 750000
      })
    });
    assert.equal(editRes.status, 200);
    const editData = await editRes.json();
    assert.equal(editData.method.accountNumber, '0899-1122-3344');
    assert.equal(editData.method.logoImage, '/assets/camilla-banner.jpg');

    // Add 300k used -> auto-switches to limit_full (1,050,000 >= 1,000,000)
    const addRes = await fetch(`${baseUrl}/api/admin/methods/dana-1/limit-add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie
      },
      body: JSON.stringify({ amount: 300000 })
    });
    assert.equal(addRes.status, 200);
    const addData = await addRes.json();
    assert.equal(addData.method.limitUsed, 1050000);
    assert.equal(addData.method.status, 'limit_full');

    // Verify public store reflects updated number and status
    const pubRes = await fetch(`${baseUrl}/api/store`);
    const pubData = await pubRes.json();
    const dana = pubData.methods.find((m) => m.id === 'dana-1');
    assert.equal(dana.accountNumber, '0899-1122-3344');
    assert.equal(dana.status, 'limit_full');

    // Reset daily limits
    const resetRes = await fetch(`${baseUrl}/api/admin/methods/reset-limits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie
      },
      body: JSON.stringify({ resetStatus: true })
    });
    assert.equal(resetRes.status, 200);
    const resetData = await resetRes.json();
    const danaReset = resetData.methods.find((m) => m.id === 'dana-1');
    assert.equal(danaReset.limitUsed, 0);
    assert.equal(danaReset.status, 'available');
  });

  it('accepts valid PNG QRIS upload and rejects invalid file payloads', async () => {
    // 1x1 PNG bytes
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const okRes = await fetch(`${baseUrl}/api/admin/upload-qris`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie
      },
      body: JSON.stringify({ dataUrl: `data:image/png;base64,${pngBase64}` })
    });
    assert.equal(okRes.status, 201);
    const okData = await okRes.json();
    assert.ok(okData.url.startsWith('/uploads/qris-'));

    const fetchImg = await fetch(`${baseUrl}${okData.url}`);
    assert.equal(fetchImg.status, 200);
    assert.equal(fetchImg.headers.get('content-type'), 'image/png');

    // Fake PNG with non-PNG magic bytes
    const fakeRes = await fetch(`${baseUrl}/api/admin/upload-qris`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie
      },
      body: JSON.stringify({
        dataUrl: `data:image/png;base64,${Buffer.from('not-a-real-png-file-at-all').toString('base64')}`
      })
    });
    assert.equal(fakeRes.status, 400);
  });

  it('allows admin password change and invalidates old session token', async () => {
    const oldCookie = adminCookie;
    const changeRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: oldCookie
      },
      body: JSON.stringify({
        currentPassword: 'camilla123',
        newPassword: 'new-cute-password'
      })
    });
    assert.equal(changeRes.status, 200);
    const newSetCookie = changeRes.headers.get('set-cookie');
    assert.ok(newSetCookie);
    adminCookie = newSetCookie.split(';')[0];

    // Old session should be rejected because sessionSecret rotated
    const oldSessionRes = await fetch(`${baseUrl}/api/admin/store`, {
      headers: { Cookie: oldCookie }
    });
    assert.equal(oldSessionRes.status, 401);

    // New session works
    const newSessionRes = await fetch(`${baseUrl}/api/admin/store`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(newSessionRes.status, 200);
    const adminData = await newSessionRes.json();
    assert.equal(adminData.usingDefaultPassword, false);
  });

  it('supports updating store settings, adding, reordering, and deleting payment methods', async () => {
    const settingsRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie
      },
      body: JSON.stringify({
        announcement: 'Promo hari ini gratis admin!',
        operationalStatus: 'busy',
        bioOwnerName: 'Camilla Cantik',
        avatarBubbleText: 'klik akuu ><',
        waGroupUrl: 'https://chat.whatsapp.com/InviteCamilla123',
        testimoniUrl: 'https://whatsapp.com/channel/TestimoniCamilla',
        antreanUrl: 'https://camillastore.id/antrean'
      })
    });
    assert.equal(settingsRes.status, 200);
    const settingsData = await settingsRes.json();
    assert.equal(settingsData.settings.announcement, 'Promo hari ini gratis admin!');
    assert.equal(settingsData.settings.operationalStatus, 'busy');
    assert.equal(settingsData.settings.bioOwnerName, 'Camilla Cantik');
    assert.equal(settingsData.settings.avatarBubbleText, 'klik akuu ><');
    assert.equal(settingsData.settings.waGroupUrl, 'https://chat.whatsapp.com/InviteCamilla123');
    assert.equal(settingsData.settings.testimoniUrl, 'https://whatsapp.com/channel/TestimoniCamilla');
    assert.equal(settingsData.settings.antreanUrl, 'https://camillastore.id/antrean');

    const createRes = await fetch(`${baseUrl}/api/admin/methods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie
      },
      body: JSON.stringify({
        name: 'SeaBank',
        category: 'bank',
        brand: 'seabank',
        accountNumber: '901234567890',
        holderName: 'Camilla Putri',
        limitInfo: 'Tanpa limit harian'
      })
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    const createdId = createData.created.id;
    assert.equal(createData.store.methods.length, 6);

    const reorderRes = await fetch(`${baseUrl}/api/admin/methods/reorder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie
      },
      body: JSON.stringify({
        orderedIds: [createdId, 'dana-1', 'gopay-1', 'spay-1', 'qris-1', 'qris-2']
      })
    });
    assert.equal(reorderRes.status, 200);
    const reorderData = await reorderRes.json();
    assert.equal(reorderData.methods[0].id, createdId);

    const delRes = await fetch(`${baseUrl}/api/admin/methods/${encodeURIComponent(createdId)}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie }
    });
    assert.equal(delRes.status, 200);
    const delData = await delRes.json();
    assert.equal(delData.methods.length, 5);

    // Create, update, and delete a product in the catalog
    const prodCreateRes = await fetch(`${baseUrl}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie
      },
      body: JSON.stringify({
        name: 'Joki Rank ML',
        category: 'game',
        badge: 'Fast',
        priceText: 'Mulai 5rb/Bintang',
        desc: 'Joki rank amanah.'
      })
    });
    assert.equal(prodCreateRes.status, 201);
    const prodCreateData = await prodCreateRes.json();
    const prodId = prodCreateData.created.id;

    const prodUpdateRes = await fetch(`${baseUrl}/api/admin/products/${encodeURIComponent(prodId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie
      },
      body: JSON.stringify({
        priceText: 'Promo 4rb/Bintang'
      })
    });
    assert.equal(prodUpdateRes.status, 200);
    const prodUpdateData = await prodUpdateRes.json();
    assert.equal(prodUpdateData.product.priceText, 'Promo 4rb/Bintang');

    const prodDelRes = await fetch(`${baseUrl}/api/admin/products/${encodeURIComponent(prodId)}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie }
    });
    assert.equal(prodDelRes.status, 200);
  });
});
