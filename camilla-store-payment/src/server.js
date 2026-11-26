import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PORT,
  PUBLIC_DIR,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  getPaths,
  hashPassword,
  verifyPassword,
  verifySessionToken
} from './config.js';
import {
  applySettingsPatch,
  ensureStore,
  runExclusive,
  sanitizeMethodInput,
  sanitizeProductInput,
  saveStore,
  toAdminStore,
  toPublicStore
} from './store.js';

const __filename = fileURLToPath(import.meta.url);
const MAX_JSON_BYTES = 5 * 1024 * 1024; // 5 MB (allows base64 QRIS uploads)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

function makeSessionCookie(token, maxAgeSeconds) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(
    token
  )}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BYTES) {
      const err = new Error('Ukuran data terlalu besar (maksimal 5 MB).');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }

  if (total === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    const err = new Error('Format JSON tidak valid.');
    err.statusCode = 400;
    throw err;
  }
}

function detectImageExtension(buffer) {
  if (buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return '.png';
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg';
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return '.webp';
  }
  return null;
}

async function serveSafeFile(res, baseDir, relativePath) {
  const normalizedBase = path.resolve(baseDir);
  const cleanRel = relativePath.replace(/^\/+/, '');
  const resolved = path.resolve(normalizedBase, cleanRel);

  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) {
    sendError(res, 403, 'Akses ditolak.');
    return;
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      sendError(res, 404, 'File tidak ditemukan.');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(resolved);
    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      sendError(res, 404, 'File tidak ditemukan.');
      return;
    }
    throw err;
  }
}

async function isAuthenticated(req, store) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  return verifySessionToken(token, store.auth.sessionSecret);
}

/**
 * Handle an incoming HTTP request (works both in standalone Node server and Vercel Serverless).
 */
export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const rewrittenPath = url.searchParams.get('__path');
    const rawPathname =
      rewrittenPath ||
      (url.pathname !== '/api/index.js' && url.pathname !== '/api/index'
        ? url.pathname
        : req.headers['x-vercel-original-path'] || req.headers['x-matched-path'] || url.pathname);
    const decodedPath = decodeURIComponent(rawPathname);
    const pathname = decodedPath.length > 1 ? decodedPath.replace(/\/+$/, '') : decodedPath;
    const method = req.method || 'GET';

    // Page routes (including shortcut links /payment, /produk, /katalog, /order)
    const isCustomerRoute =
      pathname === '/' ||
      pathname === '/index.html' ||
      pathname === '/payment' ||
      pathname === '/pay' ||
      pathname.startsWith('/payment/') ||
      pathname === '/produk' ||
      pathname === '/katalog' ||
      pathname === '/list' ||
      pathname.startsWith('/produk/') ||
      pathname.startsWith('/katalog/') ||
      pathname === '/order';

    if (method === 'GET' && isCustomerRoute) {
      await serveSafeFile(res, PUBLIC_DIR, 'index.html');
      return;
    }
    if (method === 'GET' && (pathname === '/admin' || pathname === '/admin.html')) {
      await serveSafeFile(res, PUBLIC_DIR, 'admin.html');
      return;
    }

    // Uploaded QRIS & logo images (serves from disk or persisted store.uploads on Vercel)
    if (method === 'GET' && pathname.startsWith('/uploads/')) {
      const filename = path.basename(pathname.slice('/uploads/'.length));
      const { uploadsDir } = getPaths();
      const filePath = path.join(uploadsDir, filename);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          await serveSafeFile(res, uploadsDir, filename);
          return;
        }
      } catch {
        // Fallback to store.uploads (useful on Vercel serverless cold start)
      }
      const store = await ensureStore();
      const entry = store.uploads?.[filename];
      if (entry && entry.base64) {
        const buf = Buffer.from(entry.base64, 'base64');
        res.writeHead(200, {
          'Content-Type': entry.contentType || 'image/png',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(buf);
        return;
      }
      sendError(res, 404, 'File gambar tidak ditemukan.');
      return;
    }

      // Public API
      if (method === 'GET' && pathname === '/api/store') {
        const store = await ensureStore();
        sendJson(res, 200, toPublicStore(store));
        return;
      }

      // Auth endpoints
      if (method === 'GET' && pathname === '/api/auth/me') {
        const store = await ensureStore();
        const authenticated = await isAuthenticated(req, store);
        sendJson(res, 200, {
          authenticated,
          usingDefaultPassword: authenticated ? Boolean(store.auth.usingDefaultPassword) : undefined
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJsonBody(req);
        const password = typeof body.password === 'string' ? body.password : '';
        const store = await ensureStore();

        if (!verifyPassword(password, store.auth.passwordHash)) {
          sendError(res, 401, 'Password admin salah. Silakan coba lagi.');
          return;
        }

        const token = createSessionToken(store.auth.sessionSecret);
        sendJson(
          res,
          200,
          { ok: true, usingDefaultPassword: Boolean(store.auth.usingDefaultPassword) },
          { 'Set-Cookie': makeSessionCookie(token, Math.floor(SESSION_TTL_MS / 1000)) }
        );
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        sendJson(
          res,
          200,
          { ok: true },
          { 'Set-Cookie': makeSessionCookie('', 0) }
        );
        return;
      }

      // Protected Admin endpoints
      if (pathname.startsWith('/api/admin/') || pathname === '/api/auth/password') {
        const currentStore = await ensureStore();
        const authed = await isAuthenticated(req, currentStore);
        if (!authed) {
          sendError(res, 401, 'Sesi berakhir atau belum login.');
          return;
        }

        if (method === 'POST' && pathname === '/api/auth/password') {
          const body = await readJsonBody(req);
          const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
          const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';

          if (newPassword.length < 6) {
            sendError(res, 400, 'Password baru minimal 6 karakter.');
            return;
          }

          const result = await runExclusive(async () => {
            const store = await ensureStore();
            if (!verifyPassword(currentPassword, store.auth.passwordHash)) {
              return { error: 'Password lama tidak sesuai.', status: 400 };
            }
            store.auth.passwordHash = hashPassword(newPassword);
            store.auth.sessionSecret = crypto.randomBytes(32).toString('hex');
            store.auth.usingDefaultPassword = false;
            await saveStore(store);
            return { token: createSessionToken(store.auth.sessionSecret) };
          });

          if (result.error) {
            sendError(res, result.status, result.error);
            return;
          }

          sendJson(
            res,
            200,
            { ok: true },
            { 'Set-Cookie': makeSessionCookie(result.token, Math.floor(SESSION_TTL_MS / 1000)) }
          );
          return;
        }

        if (method === 'GET' && pathname === '/api/admin/store') {
          const store = await ensureStore();
          sendJson(res, 200, toAdminStore(store));
          return;
        }

        if (method === 'PUT' && pathname === '/api/admin/settings') {
          const body = await readJsonBody(req);
          const updated = await runExclusive(async () => {
            const store = await ensureStore();
            store.settings = applySettingsPatch(store.settings, body);
            await saveStore(store);
            return toAdminStore(store);
          });
          sendJson(res, 200, updated);
          return;
        }

        if (method === 'POST' && pathname === '/api/admin/methods') {
          const body = await readJsonBody(req);
          const updated = await runExclusive(async () => {
            const store = await ensureStore();
            const maxOrder = store.methods.reduce((max, m) => Math.max(max, m.order ?? 0), 0);
            const created = sanitizeMethodInput({ ...body, order: body.order ?? maxOrder + 1 });
            store.methods.push(created);
            await saveStore(store);
            return { created, store: toAdminStore(store) };
          });
          sendJson(res, 201, updated);
          return;
        }

        if (method === 'POST' && pathname === '/api/admin/methods/reorder') {
          const body = await readJsonBody(req);
          const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : [];
          const updated = await runExclusive(async () => {
            const store = await ensureStore();
            const rank = new Map(orderedIds.map((id, idx) => [String(id), idx + 1]));
            let fallbackOrder = orderedIds.length + 1;
            for (const m of store.methods) {
              m.order = rank.has(m.id) ? rank.get(m.id) : fallbackOrder++;
            }
            await saveStore(store);
            return toAdminStore(store);
          });
          sendJson(res, 200, updated);
          return;
        }

        if (method === 'POST' && pathname === '/api/admin/methods/reset-limits') {
          const body = await readJsonBody(req);
          const resetStatus = body.resetStatus !== false;
          const updated = await runExclusive(async () => {
            const store = await ensureStore();
            for (const m of store.methods) {
              m.limitUsed = 0;
              if (resetStatus && (m.status === 'limit_full' || m.status === 'near_limit')) {
                m.status = 'available';
              }
            }
            await saveStore(store);
            return toAdminStore(store);
          });
          sendJson(res, 200, updated);
          return;
        }

        const limitAddMatch = pathname.match(/^\/api\/admin\/methods\/([^/]+)\/limit-add$/);
        if (method === 'POST' && limitAddMatch) {
          const methodId = limitAddMatch[1];
          const body = await readJsonBody(req);
          const amount = Number(body.amount);
          if (!Number.isFinite(amount) || amount <= 0) {
            sendError(res, 400, 'Nominal tambahan harus lebih dari 0.');
            return;
          }

          const result = await runExclusive(async () => {
            const store = await ensureStore();
            const target = store.methods.find((m) => m.id === methodId);
            if (!target) return null;

            target.limitUsed = Math.round((target.limitUsed || 0) + amount);
            if (target.limitMax > 0) {
              if (target.limitUsed >= target.limitMax) {
                target.status = 'limit_full';
              } else if (target.limitUsed >= target.limitMax * 0.8 && target.status === 'available') {
                target.status = 'near_limit';
              }
            }
            await saveStore(store);
            return { method: target, store: toAdminStore(store) };
          });

          if (!result) {
            sendError(res, 404, 'Metode pembayaran tidak ditemukan.');
            return;
          }
          sendJson(res, 200, result);
          return;
        }

        const methodMatch = pathname.match(/^\/api\/admin\/methods\/([^/]+)$/);
        if (methodMatch) {
          const methodId = methodMatch[1];

          if (method === 'PUT') {
            const body = await readJsonBody(req);
            const result = await runExclusive(async () => {
              const store = await ensureStore();
              const idx = store.methods.findIndex((m) => m.id === methodId);
              if (idx === -1) return null;
              store.methods[idx] = sanitizeMethodInput(body, store.methods[idx]);
              await saveStore(store);
              return { method: store.methods[idx], store: toAdminStore(store) };
            });

            if (!result) {
              sendError(res, 404, 'Metode pembayaran tidak ditemukan.');
              return;
            }
            sendJson(res, 200, result);
            return;
          }

          if (method === 'DELETE') {
            const result = await runExclusive(async () => {
              const store = await ensureStore();
              const idx = store.methods.findIndex((m) => m.id === methodId);
              if (idx === -1) return null;
              store.methods.splice(idx, 1);
              await saveStore(store);
              return toAdminStore(store);
            });

            if (!result) {
              sendError(res, 404, 'Metode pembayaran tidak ditemukan.');
              return;
            }
            sendJson(res, 200, result);
            return;
          }
        }

        if (method === 'POST' && pathname === '/api/admin/upload-qris') {
          const body = await readJsonBody(req);
          const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
          const match = dataUrl.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
          if (!match) {
            sendError(res, 400, 'Format gambar harus PNG, JPG, atau WebP.');
            return;
          }

          const buffer = Buffer.from(match[1], 'base64');
          if (buffer.length > 3 * 1024 * 1024) {
            sendError(res, 400, 'Ukuran gambar maksimal 3 MB.');
            return;
          }

          const ext = detectImageExtension(buffer);
          if (!ext) {
            sendError(res, 400, 'File gambar tidak valid (hanya PNG, JPG, WebP).');
            return;
          }

          const { uploadsDir } = getPaths();
          await fs.mkdir(uploadsDir, { recursive: true });
          const filename = `qris-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
          await fs.writeFile(path.join(uploadsDir, filename), buffer);

          await runExclusive(async () => {
            const store = await ensureStore();
            if (!store.uploads || typeof store.uploads !== 'object') store.uploads = {};
            store.uploads[filename] = {
              contentType: MIME_TYPES[ext] || 'image/png',
              base64: buffer.toString('base64')
            };
            await saveStore(store);
          });

          sendJson(res, 201, { url: `/uploads/${filename}` });
          return;
        }

        if (method === 'POST' && pathname === '/api/admin/products') {
          const body = await readJsonBody(req);
          const updated = await runExclusive(async () => {
            const store = await ensureStore();
            if (!Array.isArray(store.products)) store.products = [];
            const minOrder = store.products.reduce((min, p) => Math.min(min, p.order ?? 1), 1);
            const created = sanitizeProductInput({ ...body, order: body.order ?? minOrder - 1 });
            store.products.unshift(created);
            await saveStore(store);
            return { created, store: toAdminStore(store) };
          });
          sendJson(res, 201, updated);
          return;
        }

        const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
        if (productMatch) {
          const productId = productMatch[1];

          if (method === 'PUT') {
            const body = await readJsonBody(req);
            const result = await runExclusive(async () => {
              const store = await ensureStore();
              if (!Array.isArray(store.products)) store.products = [];
              const idx = store.products.findIndex((p) => p.id === productId);
              if (idx === -1) return null;
              store.products[idx] = sanitizeProductInput(body, store.products[idx]);
              await saveStore(store);
              return { product: store.products[idx], store: toAdminStore(store) };
            });
            if (!result) {
              sendError(res, 404, 'Produk tidak ditemukan.');
              return;
            }
            sendJson(res, 200, result);
            return;
          }

          if (method === 'DELETE') {
            const result = await runExclusive(async () => {
              const store = await ensureStore();
              if (!Array.isArray(store.products)) store.products = [];
              const idx = store.products.findIndex((p) => p.id === productId);
              if (idx === -1) return null;
              store.products.splice(idx, 1);
              await saveStore(store);
              return toAdminStore(store);
            });
            if (!result) {
              sendError(res, 404, 'Produk tidak ditemukan.');
              return;
            }
            sendJson(res, 200, result);
            return;
          }
        }

        sendError(res, 404, 'Endpoint tidak ditemukan.');
        return;
      }

      // Static assets inside /public
      if (method === 'GET') {
        await serveSafeFile(res, PUBLIC_DIR, pathname);
        return;
      }

      sendError(res, 405, 'Method tidak diizinkan.');
    } catch (err) {
      const status = err.statusCode || 400;
      if (status >= 500) {
        console.error(err);
      }
      sendError(res, status, err.message || 'Terjadi kesalahan pada server.');
    }
}

/**
 * Create the Camilla Store HTTP server instance.
 */
export function createAppServer() {
  return http.createServer(handleRequest);
}

export default handleRequest;

if (!process.env.VERCEL && process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  ensureStore()
    .then(() => {
      const server = createAppServer();
      server.listen(PORT, () => {
        console.log(`Camilla Store Payment Page berjalan di http://localhost:${PORT}`);
        console.log(`Admin Panel tersedia di http://localhost:${PORT}/admin`);
      });
    })
    .catch((err) => {
      console.error('Gagal menjalankan server:', err);
      process.exit(1);
    });
}
