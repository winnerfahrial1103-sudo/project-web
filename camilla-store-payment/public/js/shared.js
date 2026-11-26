export const STATUS_META = {
  available: { label: 'Tersedia', className: 'status--available' },
  near_limit: { label: 'Hampir Penuh', className: 'status--near_limit' },
  limit_full: { label: 'Limit Penuh', className: 'status--limit_full' },
  maintenance: { label: 'Maintenance', className: 'status--maintenance' }
};

export const STORE_STATUS_META = {
  open: { label: 'Buka • 99+ Chat Open Now!', className: 'status--available' },
  busy: { label: 'Antre • Konfirmasi Sedikit Lambat', className: 'status--near_limit' },
  closed: { label: 'Tutup Sementara', className: 'status--limit_full' }
};

export const PRODUCT_CATEGORY_META = {
  all: { label: 'Semua Produk', icon: '✨' },
  game: { label: 'Topup & Game', icon: '🎮' },
  app: { label: 'App Prem & Media', icon: '📱' },
  design: { label: 'Design & Edit', icon: '🎨' },
  sosmed: { label: 'Sosmed, JPM & Bot', icon: '🚀' },
  jasa: { label: 'Jasa Digital & CV', icon: '🛠️' },
  ppob: { label: 'Pulsa, Kuota & PPOB', icon: '⚡' }
};

export const BRAND_META = {
  dana: { label: 'DANA', bg: 'linear-gradient(135deg, #38bdf8, #0284c7)', short: 'DN' },
  gopay: { label: 'GoPay', bg: 'linear-gradient(135deg, #22d3ee, #0d9488)', short: 'GP' },
  spay: { label: 'ShopeePay', bg: 'linear-gradient(135deg, #fb923c, #ea580c)', short: 'SP' },
  ovo: { label: 'OVO', bg: 'linear-gradient(135deg, #a78bfa, #7c3aed)', short: 'OV' },
  qris: { label: 'QRIS', bg: 'linear-gradient(135deg, #f472b6, #db2777)', short: 'QR' },
  bca: { label: 'BCA', bg: 'linear-gradient(135deg, #60a5fa, #1d4ed8)', short: 'BC' },
  bri: { label: 'BRI', bg: 'linear-gradient(135deg, #38bdf8, #1e40af)', short: 'BR' },
  mandiri: { label: 'Mandiri', bg: 'linear-gradient(135deg, #facc15, #ca8a04)', short: 'MD' },
  seabank: { label: 'SeaBank', bg: 'linear-gradient(135deg, #fb923c, #f97316)', short: 'SB' },
  bank: { label: 'Bank', bg: 'linear-gradient(135deg, #f472b6, #ec4899)', short: 'BK' },
  ewallet: { label: 'E-Wallet', bg: 'linear-gradient(135deg, #f472b6, #ec4899)', short: 'EW' }
};

export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatRupiah(amount) {
  const num = Number(amount) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

export function formatTimeId(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getBrandInfo(method) {
  return BRAND_META[method.brand] || BRAND_META[method.category] || BRAND_META.ewallet;
}

export function renderBrandSvg(method) {
  if (method.logoImage) {
    return `<img src="${escapeHtml(method.logoImage)}" alt="${escapeHtml(method.name)}" class="brand-logo-img">`;
  }
  if (method.category === 'qris' || method.brand === 'qris') {
    return `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <path d="M14 14h3v3h-3zM19 14h2v2M14 19h2v2M19 19h2v2"/>
      </svg>`;
  }
  const info = getBrandInfo(method);
  return `<span style="font-size:0.86rem;letter-spacing:0.03em">${escapeHtml(info.short)}</span>`;
}

let toastTimer = null;

export function showToast(message, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('toast--error', Boolean(isError));
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-visible');
  }, 2600);
}

export async function copyText(text, successMsg = 'Nomor berhasil disalin! ♡') {
  if (!text) return;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast(successMsg);
  } catch {
    showToast('Gagal menyalin otomatis, silakan salin manual ya kak.', true);
  }
}

export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Terjadi kesalahan.');
    err.status = res.status;
    throw err;
  }
  return data;
}
