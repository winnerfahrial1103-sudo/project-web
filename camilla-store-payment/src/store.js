import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_ADMIN_PASSWORD, getKvConfig, getPaths, hashPassword } from './config.js';

const KV_STORE_KEY = 'camilla_store_data_v1';

async function kvGetStore(kv) {
  const res = await fetch(kv.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kv.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(['GET', KV_STORE_KEY])
  });
  if (!res.ok) throw new Error(`KV GET failed (${res.status})`);
  const data = await res.json();
  if (!data?.result) return null;
  return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
}

async function kvSetStore(kv, store) {
  const res = await fetch(kv.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kv.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(['SET', KV_STORE_KEY, JSON.stringify(store)])
  });
  if (!res.ok) throw new Error(`KV SET failed (${res.status})`);
}

export const VALID_CATEGORIES = new Set(['ewallet', 'qris', 'bank']);
export const VALID_STATUSES = new Set(['available', 'near_limit', 'limit_full', 'maintenance']);
export const VALID_STORE_STATUSES = new Set(['open', 'busy', 'closed']);
export const VALID_PRODUCT_CATEGORIES = new Set([
  'game',
  'app',
  'design',
  'sosmed',
  'jasa',
  'ppob'
]);

export function createDefaultProducts() {
  const items = [
    // Game & Topup
    { name: 'Topup All Game', category: 'game', badge: 'Best Seller', priceText: 'Mulai Rp 1.000', desc: 'Diamond, UC, Genesis Crystal, dan semua game populer proses kilat.' },
    { name: 'Gift Skin ML / Game', category: 'game', badge: 'Aman 100%', priceText: 'Tanya Admin', desc: 'Gift skin resmi & legal via pertemanan in-game.' },
    { name: 'Starlight Member', category: 'game', badge: 'Favorit', priceText: 'Harga Promo', desc: 'Starlight Card Basic & Plus Mobile Legends.' },
    { name: 'Promo / PO Event Game', category: 'game', badge: 'Murah', priceText: 'Open Slot', desc: 'Pre-order event skin, token, dan promo terbatas.' },
    { name: 'Vilog ML & FF', category: 'game', badge: 'Fast', priceText: 'Harga Bersahabat', desc: 'Topup via login Mobile Legends & Free Fire aman bergaransi.' },
    { name: 'Roblox Vilog & Visend', category: 'game', badge: 'Populer', priceText: 'Ready Stock', desc: 'Robux via login (vilog) maupun via send/group (visend).' },

    // App Prem & Media
    { name: 'App Prem (Aplikasi Premium)', category: 'app', badge: 'Garansi', priceText: 'Mulai Rp 5.000', desc: 'Netflix, Canva Pro, CapCut, Spotify, YouTube, Disney+, Viu, dll.' },
    { name: 'App Mod', category: 'app', badge: 'Lengkap', priceText: 'Murah', desc: 'Koleksi aplikasi mod premium siap pakai.' },
    { name: 'App HD', category: 'app', badge: 'Jernih', priceText: 'Ready', desc: 'Aplikasi peningkat kualitas foto & video HD (Wink, Remini, Meitu, dll).' },
    { name: 'App Bioskop', category: 'app', badge: 'Streaming', priceText: 'Ready', desc: 'Akses aplikasi nonton film & series bioskop terbaru.' },
    { name: 'HD Foto & Video', category: 'app', badge: 'Jasa HD', priceText: 'Per File', desc: 'Jasa menjernihkan foto & video buram jadi kualitas HD.' },

    // Design & Edit
    { name: 'Design Grafis & Banner', category: 'design', badge: 'Cute Style', priceText: 'Custom', desc: 'Request desain banner store, logo, poster, dan kebutuhan sosmed.' },
    { name: 'Edit List Jualan', category: 'design', badge: 'Estetik', priceText: 'Custom', desc: 'Jasa rapikan & hias teks list jualan biar makin menarik.' },
    { name: 'Edit PLP (Pixellab)', category: 'design', badge: 'Custom', priceText: 'Terjangkau', desc: 'Jasa edit template file PLP sesuai nama & tema tokomu.' },
    { name: 'Edit JJ (Jedag Jedug)', category: 'design', badge: 'Viral', priceText: 'Ready', desc: 'Jasa edit video JJ untuk foto/karakter/promosi.' },
    { name: 'File PLP & Bahan Design', category: 'design', badge: 'Siap Pakai', priceText: 'Murah', desc: 'Jual mentahan PLP cute & estetis siap edit.' },
    { name: 'All Symbol Aesthetic', category: 'design', badge: 'Lengkap', priceText: 'Paket Hemat', desc: 'Kumpulan simbol & font cute langka untuk bio dan list.' },

    // Sosmed, Promosi & Bot
    { name: 'Jaseb / Jasher', category: 'sosmed', badge: 'Ramai', priceText: 'Per Share', desc: 'Jasa sebar / share promosi jualan ke banyak grup aktif.' },
    { name: 'JPM GB & JPM CH', category: 'sosmed', badge: 'Aktif', priceText: 'Paket Hemat', desc: 'Jasa Push Member Grup WA (GB) & Saluran/Channel (CH).' },
    { name: 'Kebsos (Kebutuhan Sosmed)', category: 'sosmed', badge: 'Instant', priceText: 'Mulai Rp 1.000', desc: 'Suntik followers, likes, views TikTok, IG, YouTube, dll.' },
    { name: 'Joki Kontak / Push Kontak', category: 'sosmed', badge: 'Cepat', priceText: 'Open', desc: 'Perbanyak kontak WhatsApp aktif untuk jualan.' },
    { name: 'Sewa Bot WA / Tele', category: 'sosmed', badge: '24 Jam', priceText: 'Bulanan', desc: 'Sewa bot jaga grup, store otomatis, dan fitur lengkap.' },
    { name: 'Panel Bot / Pterodactyl', category: 'sosmed', badge: 'Anti Delay', priceText: 'Mulai 1GB-Unli', desc: 'Panel run bot WA/Tele server kencang & stabil.' },
    { name: 'All Nokos (Nomor Kosong)', category: 'sosmed', badge: 'All Negara', priceText: 'Ready', desc: 'Nomor virtual verifikasi OTP WA, Tele, dan aplikasi lainnya.' },

    // Jasa Digital & Keuangan
    { name: 'CV (Convert Saldo)', category: 'jasa', badge: 'Rate Rendah', priceText: 'Fast Respon', desc: 'Convert saldo antar e-wallet, bank, dan pulsa amanah.' },
    { name: 'Rekber / MC (Midman)', category: 'jasa', badge: 'Safe & Trusted', priceText: 'Fee Murah', desc: 'Jasa rekening bersama transaksi jual beli akun/item.' },
    { name: 'Jasa Buat Daget', category: 'jasa', badge: 'Praktis', priceText: 'Open', desc: 'Jasa pembuatan link DANA Kaget untuk giveaway/promosi.' },
    { name: 'Jasa Cek No GTC', category: 'jasa', badge: 'Getcontact', priceText: 'Per Nomor', desc: 'Cek tag & nama nomor HP di Getcontact.' },
    { name: 'Jasa SS IP (iPhone)', category: 'jasa', badge: 'iOS Asli', priceText: 'Murah', desc: 'Jasa screenshot tampilan iPhone untuk testimoni/profil.' },
    { name: 'Jasa Unband WA', category: 'jasa', badge: 'Banding', priceText: 'Tanya Admin', desc: 'Bantu proses pemulihan nomor WhatsApp yang terkena spam/banned.' },
    { name: 'Jasa Create Email', category: 'jasa', badge: 'Fresh', priceText: 'Per Akun', desc: 'Pembuatan akun email fresh tanpa ribet verifikasi.' },
    { name: 'Joktug (Joki Tugas)', category: 'jasa', badge: 'Rapi', priceText: 'Tanya Admin', desc: 'Bantu pengerjaan tugas sekolah/kuliah, ketik, PPT, makalah.' },
    { name: 'JP (Jasa Posting / Promosi)', category: 'jasa', badge: 'Trusted', priceText: 'Open', desc: 'Jasa titip posting di akun/status/grup ramai.' },
    { name: 'All Tutor / Web', category: 'jasa', badge: 'Lengkap', priceText: 'Paket', desc: 'Kumpulan tutorial cuan digital & pembuatan web simpel.' },

    // Pulsa, Kuota & PPOB
    { name: 'Kuota Internet All Operator', category: 'ppob', badge: '24 Jam', priceText: 'Harga Agen', desc: 'Telkomsel, Indosat, XL, Axis, Tri, Smartfren, by.U.' },
    { name: 'Pulsa All Operator', category: 'ppob', badge: 'Detikan', priceText: 'Mulai 5.000', desc: 'Isi pulsa reguler maupun pulsa transfer semua kartu.' },
    { name: 'Token Listrik PLN', category: 'ppob', badge: 'Instant', priceText: 'Mulai 20.000', desc: 'Kode token PLN langsung keluar dalam hitungan detik.' },
    { name: 'Topup E-Money', category: 'ppob', badge: 'Lengkap', priceText: 'Admin Ringan', desc: 'Isi saldo DANA, GoPay, ShopeePay, OVO, LinkAja.' },
    { name: 'E-SIM All Operator', category: 'ppob', badge: 'Resmi', priceText: 'Ready', desc: 'Pembelian nomor & paket E-SIM praktis langsung scan.' },
    { name: 'Masa Aktif Kartu', category: 'ppob', badge: 'Perpanjang', priceText: 'Murah', desc: 'Tambah masa aktif kartu tanpa harus beli pulsa mahal.' },
    { name: 'Voucher Game & Kuota', category: 'ppob', badge: 'Kode Instant', priceText: 'Ready', desc: 'Kode voucher kuota fisik & voucher game siap gosok/pakai.' }
  ];

  return items.map((item, idx) => ({
    id: `prod-${idx + 1}`,
    name: item.name,
    category: item.category,
    badge: item.badge,
    priceText: item.priceText,
    desc: item.desc,
    available: true,
    order: idx + 1
  }));
}

/**
 * Build the default store payload for Camilla Store with owner 089629619000, banner, products, and 5 payment methods.
 */
export function createDefaultStore() {
  return {
    auth: {
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      sessionSecret: crypto.randomBytes(32).toString('hex'),
      usingDefaultPassword: true
    },
    settings: {
      storeName: 'Camilla Store',
      tagline: 'Safe & Trusted • All Kebutuhan Digital, Topup Game & Payment Page ✨',
      operationalStatus: 'open',
      bannerImage: '/assets/camilla-banner.jpg',
      avatarBubbleText: 'klik akuu ><',
      ownerPhone: '089629619000',
      bioOwnerName: 'Camilla',
      bioDescription:
        'Pusat topup all game, aplikasi premium, design & edit, kebutuhan sosmed, CV saldo, rekber/MC, dan PPOB terlengkap. Transaksi aman, cepat, dan bergaransi 💕',
      waGroupName: 'Grup & Info Resmi Camilla Store',
      waGroupUrl: 'https://chat.whatsapp.com/',
      waChannelUrl: 'https://whatsapp.com/channel/',
      testimoniUrl: 'https://whatsapp.com/channel/',
      antreanUrl: 'https://chat.whatsapp.com/',
      bioHours: 'Setiap Hari • 08.00 - 23.00 WIB (Fast Respon)',
      bioLocation: 'Indonesia • Online Store Safe & Trusted',
      bioQuote: 'Safe, Fast & Trusted Digital Store 🌸',
      announcement:
        'Halo kak! Selamat datang di Camilla Store (Safe & Trusted) 💕 Pilih produk/jasa di katalog atau cek status limit payment sebelum transfer ya. Konfirmasi langsung ke WA Owner 0896-2961-9000 🌸',
      showAnnouncement: true,
      whatsappNumber: '6289629619000',
      footerNote: 'Camilla Store • Safe & Trusted 🌸'
    },
    methods: [
      {
        id: 'dana-1',
        name: 'DANA',
        category: 'ewallet',
        brand: 'dana',
        accountNumber: '0896-2961-9000',
        holderName: 'Camilla Store',
        status: 'available',
        limitInfo: 'Limit tersedia — bebas biaya admin sesama DANA',
        limitMax: 5000000,
        limitUsed: 1250000,
        note: 'Pastikan nomor 0896-2961-9000 sesuai sebelum kirim ya kak.',
        qrisImage: '',
        nmid: '',
        hidden: false,
        order: 1
      },
      {
        id: 'gopay-1',
        name: 'GoPay',
        category: 'ewallet',
        brand: 'gopay',
        accountNumber: '0896-2961-9000',
        holderName: 'Camilla Store',
        status: 'available',
        limitInfo: 'Siap menerima pembayaran (sisa limit aman)',
        limitMax: 5000000,
        limitUsed: 800000,
        note: 'Bisa kirim dari aplikasi Gojek atau transfer bank ke GoPay.',
        qrisImage: '',
        nmid: '',
        hidden: false,
        order: 2
      },
      {
        id: 'spay-1',
        name: 'ShopeePay (SPay)',
        category: 'ewallet',
        brand: 'spay',
        accountNumber: '0896-2961-9000',
        holderName: 'Camilla Store',
        status: 'near_limit',
        limitInfo: 'Hampir limit harian — konfirmasi dulu kalau nominal > Rp500rb',
        limitMax: 2000000,
        limitUsed: 1650000,
        note: 'Jika penuh, silakan pilih DANA, GoPay, atau QRIS ya kak.',
        qrisImage: '',
        nmid: '',
        hidden: false,
        order: 3
      },
      {
        id: 'qris-1',
        name: 'QRIS 1 (Utama)',
        category: 'qris',
        brand: 'qris',
        accountNumber: '',
        holderName: 'CAMILLA STORE',
        status: 'available',
        limitInfo: 'Support semua e-wallet & m-banking • Limit aman',
        limitMax: 10000000,
        limitUsed: 2100000,
        note: 'Klik gambar QR untuk memperbesar atau download.',
        qrisImage: '/assets/qris-sample-1.svg',
        nmid: 'ID1020304050601',
        hidden: false,
        order: 4
      },
      {
        id: 'qris-2',
        name: 'QRIS 2 (Cadangan)',
        category: 'qris',
        brand: 'qris',
        accountNumber: '',
        holderName: 'CAMILLA STORE 2',
        status: 'available',
        limitInfo: 'Gunakan QRIS 2 jika QRIS 1 sedang gangguan atau penuh',
        limitMax: 10000000,
        limitUsed: 450000,
        note: 'Support DANA, GoPay, OVO, SPay, BCA, BRI, Mandiri, dll.',
        qrisImage: '/assets/qris-sample-2.svg',
        nmid: 'ID1020304050602',
        hidden: false,
        order: 5
      }
    ],
    products: createDefaultProducts(),
    uploads: {},
    updatedAt: new Date().toISOString()
  };
}

let writeQueue = Promise.resolve();

/**
 * Serialize store mutations to prevent concurrent write races.
 */
export function runExclusive(task) {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => {});
  return next;
}

/**
 * Ensure data and upload directories exist, initializing or upgrading store.json.
 */
export async function ensureStore() {
  const kv = getKvConfig();
  const { dataDir, uploadsDir, storeFile } = getPaths();
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });

  try {
    let parsed = null;
    if (kv) {
      parsed = await kvGetStore(kv);
    }
    if (!parsed) {
      const raw = await fs.readFile(storeFile, 'utf8');
      parsed = JSON.parse(raw);
    }
    if (!parsed || !parsed.auth || !parsed.settings || !Array.isArray(parsed.methods)) {
      throw new Error('Invalid store schema');
    }
    if (!parsed.uploads || typeof parsed.uploads !== 'object') {
      parsed.uploads = {};
    }

    let changed = false;
    if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
      parsed.products = createDefaultProducts();
      changed = true;
    }
    if (!parsed.settings.bannerImage) {
      parsed.settings.bannerImage = '/assets/camilla-banner.jpg';
      changed = true;
    }
    if (parsed.settings.avatarBubbleText === undefined) {
      parsed.settings.avatarBubbleText = 'klik akuu ><';
      changed = true;
    }
    if (parsed.settings.bioDescription === undefined) {
      parsed.settings.bioOwnerName = 'Camilla';
      parsed.settings.bioDescription =
        'Pusat topup all game, aplikasi premium, design & edit, kebutuhan sosmed, CV saldo, rekber/MC, dan PPOB terlengkap. Transaksi aman, cepat, dan bergaransi 💕';
      parsed.settings.waGroupName = 'Grup WhatsApp Camilla Store';
      parsed.settings.waGroupUrl = 'https://chat.whatsapp.com/';
      parsed.settings.waChannelUrl = '';
      parsed.settings.bioHours = 'Setiap Hari • 08.00 - 23.00 WIB (Fast Respon)';
      parsed.settings.bioLocation = 'Indonesia • Online Store Safe & Trusted';
      parsed.settings.bioQuote = 'Safe, Fast & Trusted Digital Store 🌸';
      changed = true;
    }
    if (!parsed.settings.ownerPhone || parsed.settings.whatsappNumber === '6281234567890') {
      parsed.settings.ownerPhone = '089629619000';
      parsed.settings.whatsappNumber = '6289629619000';
      parsed.settings.tagline = 'Safe & Trusted • All Kebutuhan Digital, Topup Game & Payment Page ✨';
      parsed.settings.footerNote = 'Camilla Store • Safe & Trusted • WA Owner: 0896-2961-9000 🌸';
      for (const m of parsed.methods) {
        if (m.accountNumber === '0812-3456-7890') {
          m.accountNumber = '0896-2961-9000';
        }
      }
      changed = true;
    }
    if (parsed.settings.testimoniUrl === undefined || parsed.settings.antreanUrl === undefined) {
      parsed.settings.waChannelUrl = parsed.settings.waChannelUrl || 'https://whatsapp.com/channel/';
      parsed.settings.testimoniUrl = parsed.settings.testimoniUrl ?? 'https://whatsapp.com/channel/';
      parsed.settings.antreanUrl = parsed.settings.antreanUrl ?? 'https://chat.whatsapp.com/';
      changed = true;
    }
    if (
      parsed.settings.footerNote ===
      'Camilla Store • Safe & Trusted • WA Owner: 0896-2961-9000 🌸'
    ) {
      parsed.settings.footerNote = 'Camilla Store • Safe & Trusted 🌸';
      changed = true;
    }
    if (changed) {
      await saveStore(parsed);
    }
    return parsed;
  } catch (err) {
    if (err.code !== 'ENOENT' && err.message !== 'Invalid store schema') {
      throw err;
    }
    const seed = createDefaultStore();
    await saveStore(seed);
    return seed;
  }
}

/**
 * Atomically persist the store JSON to disk.
 */
export async function saveStore(store) {
  const kv = getKvConfig();
  const { dataDir, storeFile } = getPaths();
  await fs.mkdir(dataDir, { recursive: true });
  store.updatedAt = new Date().toISOString();

  if (kv) {
    await kvSetStore(kv, store);
  }

  const tempFile = path.join(dataDir, `store.${crypto.randomUUID()}.tmp`);
  await fs.writeFile(tempFile, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(tempFile, storeFile);
  return store;
}

/**
 * Convert store data into a safe public response for customers.
 */
export function toPublicStore(store) {
  const visibleMethods = [...store.methods]
    .filter((m) => !m.hidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const visibleProducts = [...(store.products || [])]
    .filter((p) => p.available !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return {
    settings: store.settings,
    methods: visibleMethods,
    products: visibleProducts,
    updatedAt: store.updatedAt
  };
}

/**
 * Convert store data into an admin response (excludes passwordHash and sessionSecret).
 */
export function toAdminStore(store) {
  return {
    usingDefaultPassword: Boolean(store.auth?.usingDefaultPassword),
    settings: store.settings,
    methods: [...store.methods].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    products: [...(store.products || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    updatedAt: store.updatedAt
  };
}

function cleanText(val, maxLen = 200) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function cleanAmount(val) {
  if (val === '' || val === null || val === undefined) return 0;
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

/**
 * Sanitize and merge store settings patch.
 */
export function applySettingsPatch(current, patch) {
  const next = { ...current };
  if ('storeName' in patch) next.storeName = cleanText(patch.storeName, 60) || 'Camilla Store';
  if ('tagline' in patch) next.tagline = cleanText(patch.tagline, 140);
  if ('operationalStatus' in patch && VALID_STORE_STATUSES.has(patch.operationalStatus)) {
    next.operationalStatus = patch.operationalStatus;
  }
  if ('bannerImage' in patch) {
    const img = sanitizeImageUrl(patch.bannerImage);
    if (img) next.bannerImage = img;
  }
  if ('ownerPhone' in patch) {
    next.ownerPhone = cleanText(patch.ownerPhone, 25);
  }
  if ('avatarBubbleText' in patch) {
    next.avatarBubbleText = cleanText(patch.avatarBubbleText, 40);
  }
  if ('bioOwnerName' in patch) next.bioOwnerName = cleanText(patch.bioOwnerName, 60);
  if ('bioDescription' in patch) next.bioDescription = cleanText(patch.bioDescription, 400);
  if ('waGroupName' in patch) next.waGroupName = cleanText(patch.waGroupName, 80);
  if ('waGroupUrl' in patch) next.waGroupUrl = sanitizeExternalUrl(patch.waGroupUrl);
  if ('waChannelUrl' in patch) next.waChannelUrl = sanitizeExternalUrl(patch.waChannelUrl);
  if ('testimoniUrl' in patch) next.testimoniUrl = sanitizeExternalUrl(patch.testimoniUrl);
  if ('antreanUrl' in patch) next.antreanUrl = sanitizeExternalUrl(patch.antreanUrl);
  if ('bioHours' in patch) next.bioHours = cleanText(patch.bioHours, 100);
  if ('bioLocation' in patch) next.bioLocation = cleanText(patch.bioLocation, 100);
  if ('bioQuote' in patch) next.bioQuote = cleanText(patch.bioQuote, 140);
  if ('announcement' in patch) next.announcement = cleanText(patch.announcement, 300);
  if ('showAnnouncement' in patch) next.showAnnouncement = Boolean(patch.showAnnouncement);
  if ('whatsappNumber' in patch) {
    next.whatsappNumber = cleanText(patch.whatsappNumber, 25).replace(/[^\d+]/g, '');
  }
  if ('footerNote' in patch) next.footerNote = cleanText(patch.footerNote, 140);
  return next;
}

/**
 * Validate and sanitize a payment method payload for creation or update.
 */
export function sanitizeMethodInput(input, existing = null) {
  const name = 'name' in input ? cleanText(input.name, 50) : existing?.name || '';
  if (!name) {
    throw new Error('Nama metode pembayaran wajib diisi.');
  }

  const category =
    'category' in input && VALID_CATEGORIES.has(input.category)
      ? input.category
      : existing?.category || 'ewallet';

  const status =
    'status' in input && VALID_STATUSES.has(input.status)
      ? input.status
      : existing?.status || 'available';

  const brandRaw = 'brand' in input ? cleanText(input.brand, 30).toLowerCase() : existing?.brand;
  const brand = brandRaw || inferBrand(name, category);

  const qrisImage =
    'qrisImage' in input ? sanitizeImageUrl(input.qrisImage) : existing?.qrisImage || '';

  const logoImage =
    'logoImage' in input ? sanitizeImageUrl(input.logoImage) : existing?.logoImage || '';

  return {
    id: existing?.id || `${brand}-${crypto.randomUUID().slice(0, 6)}`,
    name,
    category,
    brand,
    logoImage,
    accountNumber:
      'accountNumber' in input
        ? cleanText(input.accountNumber, 60)
        : existing?.accountNumber || '',
    holderName:
      'holderName' in input ? cleanText(input.holderName, 80) : existing?.holderName || '',
    status,
    limitInfo: 'limitInfo' in input ? cleanText(input.limitInfo, 220) : existing?.limitInfo || '',
    limitMax: 'limitMax' in input ? cleanAmount(input.limitMax) : existing?.limitMax ?? 0,
    limitUsed: 'limitUsed' in input ? cleanAmount(input.limitUsed) : existing?.limitUsed ?? 0,
    note: 'note' in input ? cleanText(input.note, 220) : existing?.note || '',
    qrisImage,
    nmid: 'nmid' in input ? cleanText(input.nmid, 50) : existing?.nmid || '',
    hidden: 'hidden' in input ? Boolean(input.hidden) : Boolean(existing?.hidden),
    order:
      'order' in input && Number.isFinite(Number(input.order))
        ? Number(input.order)
        : existing?.order ?? 99
  };
}

/**
 * Validate and sanitize a product/service item for creation or update.
 */
export function sanitizeProductInput(input, existing = null) {
  const name = 'name' in input ? cleanText(input.name, 80) : existing?.name || '';
  if (!name) {
    throw new Error('Nama produk/layanan wajib diisi.');
  }
  const category =
    'category' in input && VALID_PRODUCT_CATEGORIES.has(input.category)
      ? input.category
      : existing?.category || 'game';

  return {
    id: existing?.id || `prod-${crypto.randomUUID().slice(0, 6)}`,
    name,
    category,
    badge: 'badge' in input ? cleanText(input.badge, 35) : existing?.badge || 'Ready',
    priceText: 'priceText' in input ? cleanText(input.priceText, 45) : existing?.priceText || 'Tanya Admin',
    desc: 'desc' in input ? cleanText(input.desc, 200) : existing?.desc || '',
    available: 'available' in input ? Boolean(input.available) : existing?.available ?? true,
    order:
      'order' in input && Number.isFinite(Number(input.order))
        ? Number(input.order)
        : existing?.order ?? 999
  };
}

function inferBrand(name, category) {
  const lower = name.toLowerCase();
  if (category === 'qris' || lower.includes('qris')) return 'qris';
  if (lower.includes('dana')) return 'dana';
  if (lower.includes('gopay')) return 'gopay';
  if (lower.includes('shopee') || lower.includes('spay')) return 'spay';
  if (lower.includes('ovo')) return 'ovo';
  if (lower.includes('bca')) return 'bca';
  if (lower.includes('bri')) return 'bri';
  if (lower.includes('mandiri')) return 'mandiri';
  if (lower.includes('seabank')) return 'seabank';
  return category === 'bank' ? 'bank' : 'ewallet';
}

function sanitizeImageUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 500);
  return '';
}

function sanitizeExternalUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 500);
  return '';
}
