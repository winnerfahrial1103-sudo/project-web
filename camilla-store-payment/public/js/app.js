import {
  PRODUCT_CATEGORY_META,
  STATUS_META,
  STORE_STATUS_META,
  apiFetch,
  copyText,
  escapeHtml,
  formatRupiah,
  formatTimeId,
  getBrandInfo,
  renderBrandSvg,
  showToast
} from './shared.js?v=13';

const CATEGORY_LABELS = {
  all: 'Semua',
  ewallet: 'E-Wallet',
  qris: 'QRIS',
  bank: 'Bank'
};

let storeData = null;
let activeCategory = 'all';
let activeProductCategory = 'all';
let productQuery = '';
let activeView = 'payment';
let highlightedMethodId = '';
let highlightedProductId = '';

const els = {
  storeBannerImg: document.getElementById('storeBannerImg'),
  storeName: document.getElementById('storeName'),
  storeTagline: document.getElementById('storeTagline'),
  storeStatusPill: document.getElementById('storeStatusPill'),
  productsCountPill: document.getElementById('productsCountPill'),
  availableCountPill: document.getElementById('availableCountPill'),
  updatedAtPill: document.getElementById('updatedAtPill'),
  ownerPhoneText: document.getElementById('ownerPhoneText'),
  copyOwnerBtn: document.getElementById('copyOwnerBtn'),
  chatOwnerBtn: document.getElementById('chatOwnerBtn'),
  announcementBox: document.getElementById('announcementBox'),
  announcementText: document.getElementById('announcementText'),

  copyPaymentLinkBtn: document.getElementById('copyPaymentLinkBtn'),
  copyCatalogLinkBtn: document.getElementById('copyCatalogLinkBtn'),

  catalogBlock: document.getElementById('catalogBlock'),
  productSearchInput: document.getElementById('productSearchInput'),
  productCategoryTabs: document.getElementById('productCategoryTabs'),
  productsGrid: document.getElementById('productsGrid'),

  paymentBlock: document.getElementById('paymentBlock'),
  categoryTabs: document.getElementById('categoryTabs'),
  paymentSections: document.getElementById('paymentSections'),

  confirmCard: document.getElementById('confirmCard'),
  confirmForm: document.getElementById('confirmForm'),
  waProduct: document.getElementById('waProduct'),
  waMethod: document.getElementById('waMethod'),
  waAmount: document.getElementById('waAmount'),
  waSender: document.getElementById('waSender'),
  waNote: document.getElementById('waNote'),
  footerNote: document.getElementById('footerNote'),
  footerOwnerWa: document.getElementById('footerOwnerWa'),

  qrisModal: document.getElementById('qrisModal'),
  modalQrisTitle: document.getElementById('modalQrisTitle'),
  modalQrisImg: document.getElementById('modalQrisImg'),
  modalQrisMeta: document.getElementById('modalQrisMeta'),
  modalQrisDownload: document.getElementById('modalQrisDownload'),
  closeQrisModal: document.getElementById('closeQrisModal'),

  openBioAvatar: document.getElementById('openBioAvatar'),
  avatarBubbleText: document.getElementById('avatarBubbleText'),
  bioModal: document.getElementById('bioModal'),
  closeBioModal: document.getElementById('closeBioModal'),
  bioModalAvatar: document.getElementById('bioModalAvatar'),
  bioModalStoreName: document.getElementById('bioModalStoreName'),
  bioModalQuote: document.getElementById('bioModalQuote'),
  bioModalDesc: document.getElementById('bioModalDesc'),
  bioModalOwnerName: document.getElementById('bioModalOwnerName'),
  bioModalOwnerPhone: document.getElementById('bioModalOwnerPhone'),
  bioCopyPhoneBtn: document.getElementById('bioCopyPhoneBtn'),
  bioChatOwnerBtn: document.getElementById('bioChatOwnerBtn'),
  bioHoursRow: document.getElementById('bioHoursRow'),
  bioModalHours: document.getElementById('bioModalHours'),
  bioLocationRow: document.getElementById('bioLocationRow'),
  bioModalLocation: document.getElementById('bioModalLocation'),
  bioGroupBox: document.getElementById('bioGroupBox'),
  bioModalGroupName: document.getElementById('bioModalGroupName'),
  bioModalGroupBtn: document.getElementById('bioModalGroupBtn'),
  bioModalChannelBtn: document.getElementById('bioModalChannelBtn'),
  bioModalTestimoniBtn: document.getElementById('bioModalTestimoniBtn'),
  bioModalAntreanBtn: document.getElementById('bioModalAntreanBtn')
};

function getWhatsappDigits() {
  const raw = storeData?.settings?.whatsappNumber || storeData?.settings?.ownerPhone || '6289629619000';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  }
  return digits || '6289629619000';
}

function formatDisplayPhone(phone) {
  const digits = String(phone || '089629619000').replace(/\D/g, '');
  const local = digits.startsWith('62') ? '0' + digits.slice(2) : digits;
  if (local.length >= 11) {
    return `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}`;
  }
  return phone || '0896-2961-9000';
}

function buildShortcutUrl(pathSuffix) {
  return `${window.location.origin}${pathSuffix}`;
}

function spawnKawaiiBurst(x, y) {
  const symbols = ['💖', '🌸', '✨', '🎀', '🩷', '♡'];
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('span');
    el.className = 'burst-particle';
    el.textContent = symbols[i % symbols.length];
    const angle = (Math.PI * 2 * i) / 6 + (Math.random() * 0.4 - 0.2);
    const dist = 32 + Math.random() * 28;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--dx', `${Math.round(Math.cos(angle) * dist)}px`);
    el.style.setProperty('--dy', `${Math.round(Math.sin(angle) * dist - 18)}px`);
    el.style.setProperty('--rot', `${Math.round(Math.random() * 60 - 30)}deg`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 880);
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button, .btn, .tab-btn, .nav-pill-btn');
  if (btn && e.clientX && e.clientY) {
    spawnKawaiiBurst(e.clientX, e.clientY);
  }
});

function applyViewMode(view, updateHistory = true) {
  activeView = view;
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.view === activeView);
  });
  els.paymentBlock.hidden = activeView === 'catalog';
  els.catalogBlock.hidden = activeView === 'payment';

  if (updateHistory && window.history?.replaceState) {
    const targetUrl =
      view === 'payment'
        ? '/payment'
        : view === 'catalog'
          ? '/produk'
          : '/';
    window.history.replaceState(null, '', targetUrl);
  }
}

document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => applyViewMode(btn.dataset.view, true));
});

if (els.copyPaymentLinkBtn) {
  els.copyPaymentLinkBtn.addEventListener('click', () => {
    const suffix = activeCategory !== 'all' ? `/payment/${activeCategory}` : '/payment';
    copyText(buildShortcutUrl(suffix), `Link Payment disalin: ${suffix} 🔗`);
  });
}

if (els.copyCatalogLinkBtn) {
  els.copyCatalogLinkBtn.addEventListener('click', () => {
    const suffix = activeProductCategory !== 'all' ? `/produk/${activeProductCategory}` : '/produk';
    copyText(buildShortcutUrl(suffix), `Link Produk disalin: ${suffix} 🔗`);
  });
}

/**
 * Parse initial shortcut URL (/payment, /payment/:target, /produk, /produk/:target, /order)
 */
function resolveShortcutRoute(data) {
  const rawPath = decodeURIComponent(window.location.pathname).replace(/\/+$/, '') || '/';
  const hash = window.location.hash.replace(/^#/, '').toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const parts = rawPath.split('/').filter(Boolean);
  const first = (parts[0] || '').toLowerCase();
  const second = (parts[1] || '').toLowerCase();

  // Payment shortcut: /payment or /pay or /payment/<method-or-cat>
  if (first === 'payment' || first === 'pay' || hash === 'payment' || params.get('view') === 'payment') {
    applyViewMode('payment', false);
    if (second) {
      if (['ewallet', 'qris', 'bank'].includes(second)) {
        activeCategory = second;
      } else {
        const matchedMethod = (data.methods || []).find(
          (m) =>
            m.id.toLowerCase() === second ||
            m.brand.toLowerCase() === second ||
            m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === second
        );
        if (matchedMethod) {
          highlightedMethodId = matchedMethod.id;
          els.waMethod.value = matchedMethod.name;
        }
      }
    }
    return 'payment';
  }

  // Product shortcut: /produk or /katalog or /list or /produk/<cat-or-id>
  if (
    first === 'produk' ||
    first === 'katalog' ||
    first === 'list' ||
    hash === 'produk' ||
    hash === 'katalog' ||
    params.get('view') === 'catalog'
  ) {
    applyViewMode('catalog', false);
    if (second) {
      if (PRODUCT_CATEGORY_META[second] && second !== 'all') {
        activeProductCategory = second;
      } else {
        const matchedProd = (data.products || []).find(
          (p) =>
            p.id.toLowerCase() === second ||
            p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === second
        );
        if (matchedProd) {
          highlightedProductId = matchedProd.id;
          activeProductCategory = matchedProd.category;
          els.waProduct.value = matchedProd.name;
        } else {
          productQuery = second.replace(/-/g, ' ');
          els.productSearchInput.value = productQuery;
        }
      }
    }
    return 'catalog';
  }

  if (first === 'order' || hash === 'order') {
    applyViewMode('all', false);
    return 'order';
  }

  applyViewMode('payment', false);
  return 'default';
}

function renderHeader(data) {
  const { settings, methods, products = [], updatedAt } = data;
  document.title = `${settings.storeName} — Safe & Trusted • Payment & Katalog`;
  els.storeName.textContent = settings.storeName;
  els.storeTagline.textContent = settings.tagline || '';
  if (settings.bannerImage) {
    els.storeBannerImg.src = settings.bannerImage;
  }
  if (els.avatarBubbleText) {
    const bubbleVal =
      settings.avatarBubbleText !== undefined ? settings.avatarBubbleText : 'klik akuu ><';
    els.avatarBubbleText.textContent = bubbleVal;
    els.avatarBubbleText.hidden = !bubbleVal;
  }

  const storeMeta = STORE_STATUS_META[settings.operationalStatus] || STORE_STATUS_META.open;
  els.storeStatusPill.className = `pill ${storeMeta.className}`;
  els.storeStatusPill.innerHTML = `<span class="status-dot"></span><span>${escapeHtml(storeMeta.label)}</span>`;

  els.productsCountPill.textContent = `${products.length} Layanan`;

  const readyCount = methods.filter(
    (m) => m.status === 'available' || m.status === 'near_limit'
  ).length;
  els.availableCountPill.textContent = `${readyCount}/${methods.length} Aktif`;
  if (els.updatedAtPill) {
    els.updatedAtPill.textContent = `Terakhir update: ${formatTimeId(updatedAt)}`;
  }

  const waDigits = getWhatsappDigits();
  if (els.ownerPhoneText) {
    const ownerRaw = settings.ownerPhone || '089629619000';
    els.ownerPhoneText.textContent = formatDisplayPhone(ownerRaw);
  }
  if (els.chatOwnerBtn) {
    els.chatOwnerBtn.href = `https://wa.me/${waDigits}?text=${encodeURIComponent(
      `Halo kak ${settings.storeName}! Aku mau tanya/order nih 🌸`
    )}`;
  }

  if (settings.showAnnouncement && settings.announcement) {
    els.announcementBox.hidden = false;
    els.announcementText.textContent = settings.announcement;
  } else {
    els.announcementBox.hidden = true;
  }

  const cleanFooter = (settings.footerNote || `Camilla Store • Safe & Trusted 🌸`)
    .replace(/\s*•?\s*WA Owner:\s*[0-9-]+\s*/i, ' ')
    .trim();
  els.footerNote.textContent = cleanFooter;
  if (els.footerOwnerWa) {
    const ownerRaw = settings.ownerPhone || '089629619000';
    els.footerOwnerWa.textContent = `WA Owner: ${formatDisplayPhone(ownerRaw)}`;
  }

  renderBioModal(settings);
}

function renderBioModal(settings) {
  if (!els.bioModal) return;
  if (settings.bannerImage && els.bioModalAvatar) {
    els.bioModalAvatar.src = settings.bannerImage;
  }
  els.bioModalStoreName.textContent = settings.storeName || 'Camilla Store';

  if (settings.bioQuote) {
    els.bioModalQuote.hidden = false;
    els.bioModalQuote.textContent = settings.bioQuote;
  } else {
    els.bioModalQuote.hidden = true;
  }

  if (settings.bioDescription) {
    els.bioModalDesc.hidden = false;
    els.bioModalDesc.textContent = settings.bioDescription;
  } else {
    els.bioModalDesc.hidden = true;
  }

  els.bioModalOwnerName.textContent = settings.bioOwnerName || 'Camilla';
  const ownerRaw = settings.ownerPhone || '089629619000';
  els.bioModalOwnerPhone.textContent = formatDisplayPhone(ownerRaw);

  const waDigits = getWhatsappDigits();
  els.bioChatOwnerBtn.href = `https://wa.me/${waDigits}?text=${encodeURIComponent(
    `Halo kak ${settings.storeName}! Aku mau tanya/order nih 🌸`
  )}`;

  if (settings.bioHours) {
    els.bioHoursRow.hidden = false;
    els.bioModalHours.textContent = settings.bioHours;
  } else {
    els.bioHoursRow.hidden = true;
  }

  if (settings.bioLocation) {
    els.bioLocationRow.hidden = false;
    els.bioModalLocation.textContent = settings.bioLocation;
  } else {
    els.bioLocationRow.hidden = true;
  }

  const hasGroup = Boolean(settings.waGroupUrl);
  const hasChannel = Boolean(settings.waChannelUrl);
  const hasTestimoni = Boolean(settings.testimoniUrl);
  const hasAntrean = Boolean(settings.antreanUrl);

  els.bioGroupBox.hidden = !hasGroup && !hasChannel && !hasTestimoni && !hasAntrean;
  els.bioModalGroupName.textContent = settings.waGroupName || 'Grup & Info Resmi Camilla Store';

  if (hasGroup) {
    els.bioModalGroupBtn.hidden = false;
    els.bioModalGroupBtn.href = settings.waGroupUrl;
  } else {
    els.bioModalGroupBtn.hidden = true;
  }

  if (hasChannel) {
    els.bioModalChannelBtn.hidden = false;
    els.bioModalChannelBtn.href = settings.waChannelUrl;
  } else {
    els.bioModalChannelBtn.hidden = true;
  }

  if (els.bioModalTestimoniBtn) {
    if (hasTestimoni) {
      els.bioModalTestimoniBtn.hidden = false;
      els.bioModalTestimoniBtn.href = settings.testimoniUrl;
    } else {
      els.bioModalTestimoniBtn.hidden = true;
    }
  }

  if (els.bioModalAntreanBtn) {
    if (hasAntrean) {
      els.bioModalAntreanBtn.hidden = false;
      els.bioModalAntreanBtn.href = settings.antreanUrl;
    } else {
      els.bioModalAntreanBtn.hidden = true;
    }
  }
}

function openBioModal() {
  if (!els.bioModal) return;
  els.bioModal.classList.add('is-open');
}

if (els.openBioAvatar) {
  els.openBioAvatar.addEventListener('click', openBioModal);
  els.openBioAvatar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openBioModal();
    }
  });
}
if (els.openBioHintBtn) {
  els.openBioHintBtn.addEventListener('click', openBioModal);
}
if (els.closeBioModal) {
  els.closeBioModal.addEventListener('click', () => els.bioModal.classList.remove('is-open'));
}
if (els.bioModal) {
  els.bioModal.addEventListener('click', (e) => {
    if (e.target === els.bioModal) els.bioModal.classList.remove('is-open');
  });
}
if (els.bioCopyPhoneBtn) {
  els.bioCopyPhoneBtn.addEventListener('click', () => {
    const ownerRaw = storeData?.settings?.ownerPhone || '089629619000';
    copyText(ownerRaw, 'Nomor WA Owner disalin! ♡');
  });
}

if (els.copyOwnerBtn) {
  els.copyOwnerBtn.addEventListener('click', () => {
    const ownerRaw = storeData?.settings?.ownerPhone || '089629619000';
    copyText(ownerRaw, 'Nomor Owner berhasil disalin! ♡');
  });
}

/* Clean Grouped Product Catalog */
function renderProductTabs(products) {
  const counts = { all: products.length };
  for (const key of Object.keys(PRODUCT_CATEGORY_META)) {
    if (key !== 'all') {
      counts[key] = products.filter((p) => p.category === key).length;
    }
  }

  const keys = Object.keys(PRODUCT_CATEGORY_META).filter((k) => k === 'all' || counts[k] > 0);
  if (!keys.includes(activeProductCategory)) activeProductCategory = 'all';

  els.productCategoryTabs.innerHTML = keys
    .map((key) => {
      const meta = PRODUCT_CATEGORY_META[key];
      const activeClass = activeProductCategory === key ? 'is-active' : '';
      return `<button type="button" class="tab-btn ${activeClass}" data-pcat="${key}">
        ${meta.icon} ${escapeHtml(meta.label)} (${counts[key]})
      </button>`;
    })
    .join('');

  els.productCategoryTabs.querySelectorAll('[data-pcat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeProductCategory = btn.dataset.pcat;
      if (window.history?.replaceState && activeView === 'catalog') {
        const url = activeProductCategory === 'all' ? '/produk' : `/produk/${activeProductCategory}`;
        window.history.replaceState(null, '', url);
      }
      renderProductTabs(products);
      renderProductsGrid(products);
    });
  });
}

function renderProductRow(p) {
  const isHighlighted = highlightedProductId === p.id;
  return `
    <div id="product-card-${escapeHtml(p.id)}" class="prod-item ${isHighlighted ? 'is-highlighted' : ''}">
      <div class="prod-item__info">
        <div class="prod-item__name">
          <span>${escapeHtml(p.name)}</span>
          ${p.badge ? `<span class="prod-badge">${escapeHtml(p.badge)}</span>` : ''}
        </div>
        <div class="prod-item__sub">${escapeHtml(p.priceText || 'Ready')} ${p.desc ? `• ${escapeHtml(p.desc)}` : ''}</div>
      </div>
      <div style="display:flex;gap:4px;flex:none;">
        <button type="button" class="btn btn--outline btn--sm" data-share-prod="${escapeHtml(p.id)}" title="Salin link produk ini">🔗</button>
        <button type="button" class="btn btn--soft btn--sm" data-ask-wa="${escapeHtml(p.name)}" title="Tanya via WhatsApp">💬</button>
        <button type="button" class="btn btn--primary btn--sm" data-order-prod="${escapeHtml(p.name)}">Order</button>
      </div>
    </div>
  `;
}

function renderProductsGrid(products) {
  const q = productQuery.trim().toLowerCase();
  const filtered = products.filter((p) => {
    const matchCat = activeProductCategory === 'all' || p.category === activeProductCategory;
    if (!matchCat) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.desc || '').toLowerCase().includes(q) ||
      (p.badge || '').toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) {
    els.productsGrid.innerHTML = `<div class="empty-state">Layanan tidak ditemukan. Coba kata kunci lain atau chat WA Owner ya kak 🌸</div>`;
    return;
  }

  const catKeys = ['game', 'app', 'design', 'sosmed', 'jasa', 'ppob'];
  const groups = catKeys
    .map((key) => ({
      key,
      meta: PRODUCT_CATEGORY_META[key],
      items: filtered.filter((p) => p.category === key)
    }))
    .filter((g) => g.items.length > 0);

  const singleGroup = groups.length === 1;

  els.productsGrid.innerHTML = `
    <div class="catalog-groups">
      ${groups
        .map(
          (g) => `
          <div class="cat-group-card ${singleGroup ? 'cat-group-card--full' : ''}">
            <h3 class="cat-group-title">
              <span>${g.meta.icon} ${escapeHtml(g.meta.label)}</span>
              <span style="font-size:0.75rem;color:var(--plum-500);">${g.items.length} item</span>
            </h3>
            <div class="prod-list">
              ${g.items.map(renderProductRow).join('')}
            </div>
          </div>
        `
        )
        .join('')}
    </div>
  `;

  els.productsGrid.querySelectorAll('[data-share-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.shareProd;
      copyText(buildShortcutUrl(`/produk/${id}`), 'Link shortcut produk disalin! 🔗');
    });
  });

  els.productsGrid.querySelectorAll('[data-ask-wa]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodName = btn.dataset.askWa;
      const waDigits = getWhatsappDigits();
      const text = `Halo kak ${storeData?.settings?.storeName || 'Camilla Store'}! 🌸\nAku mau tanya / order: *${prodName}*\nMasih ready kak?`;
      window.open(`https://wa.me/${waDigits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    });
  });

  els.productsGrid.querySelectorAll('[data-order-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodName = btn.dataset.orderProd;
      els.waProduct.value = prodName;
      applyViewMode('all', false);
      showToast(`"${prodName}" dipilih! Silakan pilih metode pembayaran 💕`);
      els.paymentBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

els.productSearchInput.addEventListener('input', () => {
  productQuery = els.productSearchInput.value;
  if (storeData) renderProductsGrid(storeData.products || []);
});

/* Payment Methods */
function renderTabs(methods) {
  const counts = {
    all: methods.length,
    ewallet: methods.filter((m) => m.category === 'ewallet').length,
    qris: methods.filter((m) => m.category === 'qris').length,
    bank: methods.filter((m) => m.category === 'bank').length
  };

  const keys = ['all', 'ewallet', 'qris', 'bank'].filter((k) => k === 'all' || counts[k] > 0);
  if (!keys.includes(activeCategory)) activeCategory = 'all';

  els.categoryTabs.innerHTML = keys
    .map((key) => {
      const activeClass = activeCategory === key ? 'is-active' : '';
      return `<button type="button" class="tab-btn ${activeClass}" data-cat="${key}">
        ${escapeHtml(CATEGORY_LABELS[key])} (${counts[key]})
      </button>`;
    })
    .join('');

  els.categoryTabs.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      if (window.history?.replaceState && activeView === 'payment') {
        const url = activeCategory === 'all' ? '/payment' : `/payment/${activeCategory}`;
        window.history.replaceState(null, '', url);
      }
      renderTabs(methods);
      renderMethods(methods);
    });
  });
}

function renderLimitSection(method) {
  const hasLimitText = Boolean(method.limitInfo);
  const max = Number(method.limitMax) || 0;
  const used = Number(method.limitUsed) || 0;
  if (!hasLimitText && max <= 0) return '';

  let barHtml = '';
  let sisaHtml = '';
  if (max > 0) {
    const pct = Math.min(100, Math.round((used / max) * 100));
    const remaining = Math.max(0, max - used);
    const fillClass =
      pct >= 100 || method.status === 'limit_full'
        ? 'progress-fill--full'
        : pct >= 75 || method.status === 'near_limit'
          ? 'progress-fill--warn'
          : '';

    sisaHtml = `<span class="limit-numbers">Sisa limit: ${escapeHtml(formatRupiah(remaining))}</span>`;
    barHtml = `
      <div class="progress-track" aria-label="Penggunaan limit ${pct}%">
        <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
      </div>
    `;
  }

  return `
    <div class="limit-box">
      <div class="limit-row">
        <span>🌸 ${escapeHtml(method.limitInfo || 'Limit tersedia')}</span>
        ${sisaHtml}
      </div>
      ${barHtml}
    </div>
  `;
}

function getDownloadFilename(id, src) {
  const cleanSrc = String(src || '').split('?')[0];
  const extMatch = cleanSrc.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
  return `${id}.${ext}`;
}

function renderMethodCard(method) {
  const brand = getBrandInfo(method);
  const status = STATUS_META[method.status] || STATUS_META.available;
  const isBlocked = method.status === 'limit_full' || method.status === 'maintenance';
  const isHighlighted = highlightedMethodId === method.id;
  const holderLabel = method.holderName ? `a.n. ${method.holderName}` : 'Camilla Store';

  let bodyHtml = '';
  if (method.category === 'qris') {
    const imgSrc = method.qrisImage || '/assets/qris-sample-1.svg';
    const dlName = getDownloadFilename(method.id, imgSrc);
    bodyHtml = `
      <div class="qris-frame">
        <img
          src="${escapeHtml(imgSrc)}"
          alt="QRIS ${escapeHtml(method.name)}"
          class="qris-thumb ${isBlocked ? 'qris-thumb--blocked' : ''}"
          data-open-qris="${escapeHtml(method.id)}"
        >
        ${
          isBlocked
            ? `<div class="qris-blocked-overlay">
                <span class="pill ${status.className}">⚠ ${escapeHtml(status.label)}</span>
              </div>`
            : ''
        }
        ${
          method.nmid
            ? `<div class="nmid-row">
                <span>NMID: ${escapeHtml(method.nmid)}</span>
                <button type="button" class="btn btn--soft btn--sm" data-copy="${escapeHtml(method.nmid)}" data-copy-msg="NMID disalin! ♡">Salin</button>
              </div>`
            : ''
        }
        <div class="qris-actions">
          <button type="button" class="btn btn--primary btn--sm" style="flex:1" data-open-qris="${escapeHtml(method.id)}" ${isBlocked ? 'disabled' : ''}>
            🔍 Perbesar
          </button>
          <a class="btn btn--soft btn--sm" style="flex:1;${isBlocked ? 'pointer-events:none;opacity:0.5' : ''}" href="${escapeHtml(imgSrc)}" download="${escapeHtml(dlName)}">
            ⬇ Simpan
          </a>
        </div>
      </div>
    `;
  } else {
    bodyHtml = `
      <div class="number-box">
        <span class="account-number ${isBlocked ? 'account-number--muted' : ''}">
          ${escapeHtml(method.accountNumber || 'Belum diatur')}
        </span>
        <button
          type="button"
          class="btn ${isBlocked ? 'btn--outline' : 'btn--primary'} btn--sm"
          data-copy="${escapeHtml(method.accountNumber)}"
          data-copy-msg="Nomor ${escapeHtml(method.name)} disalin! ♡"
          ${isBlocked || !method.accountNumber ? 'disabled' : ''}
        >
          ${isBlocked ? escapeHtml(status.label) : 'Salin Nomor'}
        </button>
      </div>
    `;
  }

  return `
    <article id="method-card-${escapeHtml(method.id)}" class="pay-card ${isBlocked ? 'pay-card--disabled' : ''} ${isHighlighted ? 'is-highlighted' : ''}">
      <div class="pay-card__top">
        <div class="brand-wrap">
          <div class="brand-icon" style="background:${brand.bg}">${renderBrandSvg(method)}</div>
          <div>
            <h3 class="brand-name">${escapeHtml(method.name)}</h3>
            <p class="brand-holder">${escapeHtml(holderLabel)}</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="pill ${status.className}">
            <span class="status-dot"></span>
            <span>${escapeHtml(status.label)}</span>
          </span>
          <button type="button" class="btn btn--outline btn--sm" data-share-method="${escapeHtml(method.id)}" title="Salin link shortcut ${escapeHtml(method.name)}">🔗</button>
        </div>
      </div>
      ${bodyHtml}
      ${renderLimitSection(method)}
      ${
        method.note
          ? `<div class="method-note">💡 ${escapeHtml(method.note)}</div>`
          : ''
      }
    </article>
  `;
}

function renderMethods(methods) {
  const filtered =
    activeCategory === 'all' ? methods : methods.filter((m) => m.category === activeCategory);

  if (filtered.length === 0) {
    els.paymentSections.innerHTML = `<div class="empty-state">Belum ada metode pembayaran di kategori ini 🌸</div>`;
    return;
  }

  const walletsAndBanks = filtered.filter((m) => m.category !== 'qris');
  const qrisList = filtered.filter((m) => m.category === 'qris');

  let html = '';
  if (walletsAndBanks.length > 0) {
    html += `<div class="wallet-stack">${walletsAndBanks.map(renderMethodCard).join('')}</div>`;
  }
  if (qrisList.length > 0) {
    html += `<div class="qris-grid">${qrisList.map(renderMethodCard).join('')}</div>`;
  }

  els.paymentSections.innerHTML = html;
  bindMethodEvents(methods);
}

function bindMethodEvents(methods) {
  els.paymentSections.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyText(btn.dataset.copy, btn.dataset.copyMsg);
    });
  });

  els.paymentSections.querySelectorAll('[data-share-method]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.shareMethod;
      copyText(buildShortcutUrl(`/payment/${id}`), `Link shortcut payment disalin! 🔗`);
    });
  });

  els.paymentSections.querySelectorAll('[data-open-qris]').forEach((el) => {
    el.addEventListener('click', () => {
      const method = methods.find((m) => m.id === el.dataset.openQris);
      if (!method || method.status === 'limit_full' || method.status === 'maintenance') return;
      openQrisModal(method);
    });
  });
}

function openQrisModal(method) {
  const src = method.qrisImage || '/assets/qris-sample-1.svg';
  els.modalQrisTitle.textContent = method.name;
  els.modalQrisImg.src = src;
  els.modalQrisMeta.textContent = `${method.holderName || 'Camilla Store'}${
    method.nmid ? ` • NMID: ${method.nmid}` : ''
  }`;
  els.modalQrisDownload.href = src;
  els.modalQrisDownload.setAttribute('download', getDownloadFilename(method.id, src));
  els.qrisModal.classList.add('is-open');
}

function renderWhatsappSection(data) {
  const { methods } = data;
  const activeChoices = methods.filter((m) => m.status !== 'maintenance');
  const list = activeChoices.length > 0 ? activeChoices : methods;

  els.waMethod.innerHTML = list
    .map((m) => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`)
    .join('');
}

els.closeQrisModal.addEventListener('click', () => els.qrisModal.classList.remove('is-open'));
els.qrisModal.addEventListener('click', (e) => {
  if (e.target === els.qrisModal) els.qrisModal.classList.remove('is-open');
});

els.confirmForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!storeData) return;
  const waDigits = getWhatsappDigits();

  const product = els.waProduct.value.trim();
  const method = els.waMethod.value;
  const amount = formatRupiah(els.waAmount.value);
  const sender = els.waSender.value.trim();
  const note = els.waNote.value.trim();

  const lines = [
    `Halo kak ${storeData.settings.storeName}! 🌸`,
    `Aku mau order & konfirmasi pembayaran ya:`
  ];
  if (product) lines.push(`• Produk/Jasa: *${product}*`);
  lines.push(`• Metode Bayar: ${method}`);
  lines.push(`• Nominal: *${amount}*`);
  lines.push(`• Pengirim: ${sender}`);
  if (note) lines.push(`• Catatan: ${note}`);
  lines.push(`Terima kasih kak 💕`);

  const url = `https://wa.me/${waDigits}?text=${encodeURIComponent(lines.join('\n'))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
});

async function init() {
  try {
    storeData = await apiFetch('/api/store');
    renderHeader(storeData);
    renderWhatsappSection(storeData);
    const routeMode = resolveShortcutRoute(storeData);
    renderProductTabs(storeData.products || []);
    renderProductsGrid(storeData.products || []);
    renderTabs(storeData.methods || []);
    renderMethods(storeData.methods || []);

    if (highlightedMethodId) {
      document.getElementById(`method-card-${highlightedMethodId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    } else if (highlightedProductId) {
      document.getElementById(`product-card-${highlightedProductId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    } else if (routeMode === 'order') {
      els.confirmCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    els.paymentSections.innerHTML = `<div class="empty-state">Gagal memuat data pembayaran: ${escapeHtml(err.message)}</div>`;
  }
}

init();
