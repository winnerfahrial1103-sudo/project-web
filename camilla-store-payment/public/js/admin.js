import {
  PRODUCT_CATEGORY_META,
  STATUS_META,
  apiFetch,
  copyText,
  escapeHtml,
  formatRupiah,
  formatTimeId,
  getBrandInfo,
  renderBrandSvg,
  showToast
} from './shared.js?v=13';

let adminData = null;
let adminProdQuery = '';

const els = {
  loginView: document.getElementById('loginView'),
  dashboardView: document.getElementById('dashboardView'),
  loginForm: document.getElementById('loginForm'),
  loginPassword: document.getElementById('loginPassword'),
  logoutBtn: document.getElementById('logoutBtn'),
  defaultPassBanner: document.getElementById('defaultPassBanner'),
  bannerChangePassBtn: document.getElementById('bannerChangePassBtn'),
  openPasswordModalBtn: document.getElementById('openPasswordModalBtn'),
  adminUpdatedText: document.getElementById('adminUpdatedText'),

  settingsForm: document.getElementById('settingsForm'),
  setStoreName: document.getElementById('setStoreName'),
  setOpStatus: document.getElementById('setOpStatus'),
  setTagline: document.getElementById('setTagline'),
  setOwnerPhone: document.getElementById('setOwnerPhone'),
  setWhatsapp: document.getElementById('setWhatsapp'),
  setBioOwnerName: document.getElementById('setBioOwnerName'),
  setAvatarBubble: document.getElementById('setAvatarBubble'),
  setBioQuote: document.getElementById('setBioQuote'),
  setBioDesc: document.getElementById('setBioDesc'),
  setWaGroupName: document.getElementById('setWaGroupName'),
  setWaGroupUrl: document.getElementById('setWaGroupUrl'),
  setWaChannelUrl: document.getElementById('setWaChannelUrl'),
  setTestimoniUrl: document.getElementById('setTestimoniUrl'),
  setAntreanUrl: document.getElementById('setAntreanUrl'),
  setBioHours: document.getElementById('setBioHours'),
  setBioLocation: document.getElementById('setBioLocation'),
  setFooter: document.getElementById('setFooter'),
  setAnnouncement: document.getElementById('setAnnouncement'),
  setShowAnnouncement: document.getElementById('setShowAnnouncement'),

  resetLimitsBtn: document.getElementById('resetLimitsBtn'),
  addMethodBtn: document.getElementById('addMethodBtn'),
  adminMethodsList: document.getElementById('adminMethodsList'),

  adminProductCount: document.getElementById('adminProductCount'),
  adminProductSearch: document.getElementById('adminProductSearch'),
  addProductBtn: document.getElementById('addProductBtn'),
  adminProductsList: document.getElementById('adminProductsList'),

  methodModal: document.getElementById('methodModal'),
  methodModalTitle: document.getElementById('methodModalTitle'),
  closeMethodModal: document.getElementById('closeMethodModal'),
  methodForm: document.getElementById('methodForm'),
  mId: document.getElementById('mId'),
  mName: document.getElementById('mName'),
  mCategory: document.getElementById('mCategory'),
  mBrand: document.getElementById('mBrand'),
  mStatus: document.getElementById('mStatus'),
  mLogoPreview: document.getElementById('mLogoPreview'),
  mLogoFile: document.getElementById('mLogoFile'),
  mLogoImageUrl: document.getElementById('mLogoImageUrl'),
  mClearLogoBtn: document.getElementById('mClearLogoBtn'),
  mNumberField: document.getElementById('mNumberField'),
  mAccountNumber: document.getElementById('mAccountNumber'),
  mHolderName: document.getElementById('mHolderName'),
  mLimitInfo: document.getElementById('mLimitInfo'),
  mLimitMax: document.getElementById('mLimitMax'),
  mLimitUsed: document.getElementById('mLimitUsed'),
  mQrisSection: document.getElementById('mQrisSection'),
  mQrisPreview: document.getElementById('mQrisPreview'),
  mQrisFile: document.getElementById('mQrisFile'),
  mQrisImageUrl: document.getElementById('mQrisImageUrl'),
  mNmidField: document.getElementById('mNmidField'),
  mNmid: document.getElementById('mNmid'),
  mNote: document.getElementById('mNote'),
  mHidden: document.getElementById('mHidden'),

  productModal: document.getElementById('productModal'),
  productModalTitle: document.getElementById('productModalTitle'),
  closeProductModal: document.getElementById('closeProductModal'),
  productForm: document.getElementById('productForm'),
  pId: document.getElementById('pId'),
  pName: document.getElementById('pName'),
  pCategory: document.getElementById('pCategory'),
  pBadge: document.getElementById('pBadge'),
  pPriceText: document.getElementById('pPriceText'),
  pDesc: document.getElementById('pDesc'),
  pAvailable: document.getElementById('pAvailable'),

  passwordModal: document.getElementById('passwordModal'),
  closePasswordModal: document.getElementById('closePasswordModal'),
  passwordForm: document.getElementById('passwordForm'),
  oldPassword: document.getElementById('oldPassword'),
  newPassword: document.getElementById('newPassword')
};

function showAuthView(authenticated) {
  els.loginView.hidden = authenticated;
  els.dashboardView.hidden = !authenticated;
}

function renderDashboard(data) {
  adminData = data;
  els.defaultPassBanner.hidden = !data.usingDefaultPassword;
  els.adminUpdatedText.textContent = `Terakhir diperbarui: ${formatTimeId(data.updatedAt)}`;

  const s = data.settings;
  els.setStoreName.value = s.storeName || '';
  els.setOpStatus.value = s.operationalStatus || 'open';
  els.setTagline.value = s.tagline || '';
  els.setOwnerPhone.value = s.ownerPhone || '089629619000';
  els.setWhatsapp.value = s.whatsappNumber || '6289629619000';
  els.setBioOwnerName.value = s.bioOwnerName || 'Camilla';
  els.setAvatarBubble.value = s.avatarBubbleText !== undefined ? s.avatarBubbleText : 'klik akuu ><';
  els.setBioQuote.value = s.bioQuote || '';
  els.setBioDesc.value = s.bioDescription || '';
  els.setWaGroupName.value = s.waGroupName || '';
  els.setWaGroupUrl.value = s.waGroupUrl || '';
  els.setWaChannelUrl.value = s.waChannelUrl || '';
  els.setTestimoniUrl.value = s.testimoniUrl || '';
  els.setAntreanUrl.value = s.antreanUrl || '';
  els.setBioHours.value = s.bioHours || '';
  els.setBioLocation.value = s.bioLocation || '';
  els.setFooter.value = s.footerNote || '';
  els.setAnnouncement.value = s.announcement || '';
  els.setShowAnnouncement.checked = Boolean(s.showAnnouncement);

  renderMethodsList(data.methods || []);
  renderProductsList(data.products || []);
}

function renderMethodsList(methods) {
  if (!methods.length) {
    els.adminMethodsList.innerHTML = `<div class="empty-state">Belum ada metode pembayaran. Klik "+ Tambah Metode" untuk menambahkan 🌸</div>`;
    return;
  }

  els.adminMethodsList.innerHTML = methods
    .map((m, idx) => {
      const brand = getBrandInfo(m);
      const status = STATUS_META[m.status] || STATUS_META.available;
      const max = Number(m.limitMax) || 0;
      const used = Number(m.limitUsed) || 0;
      const remaining = Math.max(0, max - used);

      return `
        <div class="admin-method-card" data-id="${escapeHtml(m.id)}">
          <div class="admin-method-header">
            <div class="brand-wrap">
              <div class="brand-icon" style="background:${brand.bg}">${renderBrandSvg(m)}</div>
              <div>
                <h3 class="brand-name">
                  ${escapeHtml(m.name)}
                  ${m.hidden ? '<span class="pill status--maintenance" style="margin-left:6px;padding:2px 9px;font-size:0.72rem;">Disembunyikan</span>' : ''}
                </h3>
                <p class="brand-holder">
                  ${
                    m.category === 'qris'
                      ? `QRIS • ${escapeHtml(m.holderName || 'Camilla Store')}${m.nmid ? ` • NMID ${escapeHtml(m.nmid)}` : ''}`
                      : `${escapeHtml(m.accountNumber || '(Nomor belum diisi)')} • a.n. ${escapeHtml(m.holderName || '-')}`
                  }
                </p>
              </div>
            </div>
            <span class="pill ${status.className}">
              <span class="status-dot"></span>
              <span>${escapeHtml(status.label)}</span>
            </span>
          </div>

          <div style="font-size:0.84rem;font-weight:700;color:var(--plum-700);">
            🌸 Info Limit: ${escapeHtml(m.limitInfo || 'Belum ada catatan limit')}
            ${
              max > 0
                ? `<span style="display:block;font-size:0.78rem;color:var(--plum-500);margin-top:3px;">
                    Terpakai ${escapeHtml(formatRupiah(used))} dari ${escapeHtml(formatRupiah(max))} (Sisa ${escapeHtml(formatRupiah(remaining))})
                   </span>`
                : ''
            }
          </div>

          <div class="quick-controls">
            <select class="select" style="width:auto;min-width:145px;padding:6px 10px;font-size:0.82rem;" data-quick-status="${escapeHtml(m.id)}" aria-label="Ubah status ${escapeHtml(m.name)}">
              <option value="available" ${m.status === 'available' ? 'selected' : ''}>Tersedia</option>
              <option value="near_limit" ${m.status === 'near_limit' ? 'selected' : ''}>Hampir Penuh</option>
              <option value="limit_full" ${m.status === 'limit_full' ? 'selected' : ''}>Limit Penuh</option>
              <option value="maintenance" ${m.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
            </select>

            ${
              max > 0
                ? `<button type="button" class="btn btn--outline btn--sm" data-add-used="${escapeHtml(m.id)}" data-amount="100000">+100rb</button>
                   <button type="button" class="btn btn--outline btn--sm" data-add-used="${escapeHtml(m.id)}" data-amount="500000">+500rb</button>`
                : ''
            }

            <button type="button" class="btn btn--outline btn--sm" data-toggle-hide="${escapeHtml(m.id)}">
              ${m.hidden ? '👁 Tampilkan' : '🙈 Sembunyikan'}
            </button>

            <button type="button" class="btn btn--outline btn--sm" data-move="${escapeHtml(m.id)}" data-dir="-1" ${idx === 0 ? 'disabled' : ''} title="Geser naik">↑</button>
            <button type="button" class="btn btn--outline btn--sm" data-move="${escapeHtml(m.id)}" data-dir="1" ${idx === methods.length - 1 ? 'disabled' : ''} title="Geser turun">↓</button>

            <button type="button" class="btn btn--outline btn--sm" data-copy-link="/payment/${escapeHtml(m.id)}" title="Salin link khusus ${escapeHtml(m.name)}">🔗 Link</button>
            <button type="button" class="btn btn--soft btn--sm" style="margin-left:auto;" data-edit="${escapeHtml(m.id)}">✏️ Edit Detail</button>
            <button type="button" class="btn btn--danger btn--sm" data-delete="${escapeHtml(m.id)}">Hapus</button>
          </div>
        </div>
      `;
    })
    .join('');

  bindMethodActions();
}

function renderProductsList(products) {
  els.adminProductCount.textContent = String(products.length);
  const q = adminProdQuery.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.desc || '').toLowerCase().includes(q) ||
      (p.badge || '').toLowerCase().includes(q)
    );
  });

  if (!filtered.length) {
    els.adminProductsList.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Tidak ada produk yang cocok 🌸</div>`;
    return;
  }

  els.adminProductsList.innerHTML = filtered
    .map((p) => {
      const catMeta = PRODUCT_CATEGORY_META[p.category] || PRODUCT_CATEGORY_META.game;
      return `
        <article class="prod-card" style="${p.available === false ? 'opacity:0.62;' : ''}">
          <div>
            <div class="prod-top">
              <div style="display:flex;align-items:center;gap:8px;">
                <div class="prod-cat-icon">${catMeta.icon}</div>
                <div>
                  <h3 class="prod-title">${escapeHtml(p.name)}</h3>
                  <span style="font-size:0.74rem;font-weight:700;color:var(--plum-500);">${escapeHtml(catMeta.label)}</span>
                </div>
              </div>
              <span class="prod-badge">${escapeHtml(p.available === false ? 'Disembunyikan' : p.badge || 'Ready')}</span>
            </div>
            ${p.desc ? `<p class="prod-desc" style="margin-top:6px;">${escapeHtml(p.desc)}</p>` : ''}
          </div>
          <div class="prod-bottom">
            <span class="prod-price">${escapeHtml(p.priceText || 'Tanya Admin')}</span>
            <div class="prod-actions">
              <button type="button" class="btn btn--outline btn--sm" data-copy-link="/produk/${escapeHtml(p.id)}" title="Salin link khusus produk ini">🔗 Link</button>
              <button type="button" class="btn btn--soft btn--sm" data-edit-prod="${escapeHtml(p.id)}">✏️ Edit</button>
              <button type="button" class="btn btn--danger btn--sm" data-del-prod="${escapeHtml(p.id)}">Hapus</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  els.adminProductsList.querySelectorAll('[data-copy-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = `${window.location.origin}${btn.dataset.copyLink}`;
      copyText(url, `Link produk disalin: ${btn.dataset.copyLink} 🔗`);
    });
  });

  els.adminProductsList.querySelectorAll('[data-edit-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prod = adminData.products.find((item) => item.id === btn.dataset.editProd);
      if (prod) openProductModal(prod);
    });
  });

  els.adminProductsList.querySelectorAll('[data-del-prod]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const prod = adminData.products.find((item) => item.id === btn.dataset.delProd);
      if (!prod) return;
      if (!window.confirm(`Hapus produk "${prod.name}"?`)) return;
      try {
        const updated = await apiFetch(`/api/admin/products/${encodeURIComponent(prod.id)}`, {
          method: 'DELETE'
        });
        renderDashboard(updated);
        showToast('Produk dihapus.');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

els.adminProductSearch.addEventListener('input', () => {
  adminProdQuery = els.adminProductSearch.value;
  if (adminData) renderProductsList(adminData.products || []);
});

function openProductModal(prod = null) {
  els.productModalTitle.textContent = prod ? `Edit ${prod.name}` : 'Tambah Produk / Jasa Baru';
  els.pId.value = prod?.id || '';
  els.pName.value = prod?.name || '';
  els.pCategory.value = prod?.category || 'game';
  els.pBadge.value = prod?.badge || 'Ready';
  els.pPriceText.value = prod?.priceText || 'Tanya Admin';
  els.pDesc.value = prod?.desc || '';
  els.pAvailable.checked = prod ? prod.available !== false : true;
  els.productModal.classList.add('is-open');
  setTimeout(() => els.pName.focus(), 50);
}

els.addProductBtn.addEventListener('click', () => openProductModal(null));
els.closeProductModal.addEventListener('click', () => els.productModal.classList.remove('is-open'));
els.productModal.addEventListener('click', (e) => {
  if (e.target === els.productModal) els.productModal.classList.remove('is-open');
});

els.productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = els.pId.value.trim();
  const payload = {
    name: els.pName.value.trim(),
    category: els.pCategory.value,
    badge: els.pBadge.value.trim(),
    priceText: els.pPriceText.value.trim(),
    desc: els.pDesc.value.trim(),
    available: els.pAvailable.checked
  };

  try {
    const res = id
      ? await apiFetch(`/api/admin/products/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      : await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
    renderDashboard(res.store);
    els.productModal.classList.remove('is-open');
    showToast(id ? 'Produk berhasil diperbarui! 💕' : 'Produk baru ditambahkan! 🌸');
  } catch (err) {
    showToast(err.message, true);
  }
});

function bindMethodActions() {
  els.adminMethodsList.querySelectorAll('[data-quick-status]').forEach((select) => {
    select.addEventListener('change', async () => {
      try {
        const res = await apiFetch(`/api/admin/methods/${encodeURIComponent(select.dataset.quickStatus)}`, {
          method: 'PUT',
          body: JSON.stringify({ status: select.value })
        });
        renderDashboard(res.store);
        showToast('Status metode diperbarui! ✨');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });

  els.adminMethodsList.querySelectorAll('[data-add-used]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const res = await apiFetch(`/api/admin/methods/${encodeURIComponent(btn.dataset.addUsed)}/limit-add`, {
          method: 'POST',
          body: JSON.stringify({ amount: Number(btn.dataset.amount) })
        });
        renderDashboard(res.store);
        showToast('Nominal terpakai ditambahkan! 💕');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });

  els.adminMethodsList.querySelectorAll('[data-toggle-hide]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const m = adminData.methods.find((item) => item.id === btn.dataset.toggleHide);
      if (!m) return;
      try {
        const res = await apiFetch(`/api/admin/methods/${encodeURIComponent(m.id)}`, {
          method: 'PUT',
          body: JSON.stringify({ hidden: !m.hidden })
        });
        renderDashboard(res.store);
        showToast(m.hidden ? 'Metode ditampilkan kembali 🌸' : 'Metode disembunyikan');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });

  els.adminMethodsList.querySelectorAll('[data-move]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.move;
      const dir = Number(btn.dataset.dir);
      const ids = adminData.methods.map((m) => m.id);
      const idx = ids.indexOf(id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= ids.length) return;
      [ids[idx], ids[target]] = [ids[target], ids[idx]];

      try {
        const updated = await apiFetch('/api/admin/methods/reorder', {
          method: 'POST',
          body: JSON.stringify({ orderedIds: ids })
        });
        renderDashboard(updated);
        showToast('Urutan metode diperbarui ✨');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });

  els.adminMethodsList.querySelectorAll('[data-copy-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = `${window.location.origin}${btn.dataset.copyLink}`;
      copyText(url, `Link payment disalin: ${btn.dataset.copyLink} 🔗`);
    });
  });

  els.adminMethodsList.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const method = adminData.methods.find((item) => item.id === btn.dataset.edit);
      if (method) openMethodModal(method);
    });
  });

  els.adminMethodsList.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const method = adminData.methods.find((item) => item.id === btn.dataset.delete);
      if (!method) return;
      if (!window.confirm(`Hapus metode "${method.name}"?`)) return;
      try {
        const updated = await apiFetch(`/api/admin/methods/${encodeURIComponent(method.id)}`, {
          method: 'DELETE'
        });
        renderDashboard(updated);
        showToast('Metode berhasil dihapus.');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

function toggleCategoryFields() {
  const isQris = els.mCategory.value === 'qris';
  els.mQrisSection.hidden = !isQris;
  els.mNmidField.hidden = !isQris;
  els.mNumberField.hidden = isQris;
}

function openMethodModal(method = null) {
  els.methodModalTitle.textContent = method ? `Edit ${method.name}` : 'Tambah Metode Pembayaran';
  els.mId.value = method?.id || '';
  els.mName.value = method?.name || '';
  els.mCategory.value = method?.category || 'ewallet';
  els.mBrand.value = method?.brand || 'ewallet';
  els.mStatus.value = method?.status || 'available';
  const logoUrl = method?.logoImage || '';
  els.mLogoImageUrl.value = logoUrl;
  els.mLogoFile.value = '';
  if (logoUrl) {
    els.mLogoPreview.src = logoUrl;
    els.mLogoPreview.hidden = false;
  } else {
    els.mLogoPreview.hidden = true;
  }
  els.mAccountNumber.value = method?.accountNumber || '';
  els.mHolderName.value = method?.holderName || 'Camilla Store';
  els.mLimitInfo.value = method?.limitInfo || '';
  els.mLimitMax.value = method?.limitMax ?? 0;
  els.mLimitUsed.value = method?.limitUsed ?? 0;
  const isQris = (method?.category || 'ewallet') === 'qris';
  els.mQrisImageUrl.value = method?.qrisImage || (isQris ? '/assets/qris-sample-1.svg' : '');
  els.mQrisPreview.src = method?.qrisImage || '/assets/qris-sample-1.svg';
  els.mQrisFile.value = '';
  els.mNmid.value = method?.nmid || '';
  els.mNote.value = method?.note || '';
  els.mHidden.checked = Boolean(method?.hidden);

  toggleCategoryFields();
  els.methodModal.classList.add('is-open');
}

els.mCategory.addEventListener('change', () => {
  if (els.mCategory.value === 'qris') {
    els.mBrand.value = 'qris';
    if (!els.mQrisImageUrl.value.trim()) {
      els.mQrisImageUrl.value = '/assets/qris-sample-1.svg';
      els.mQrisPreview.src = '/assets/qris-sample-1.svg';
    }
  }
  toggleCategoryFields();
});

els.mQrisImageUrl.addEventListener('input', () => {
  const val = els.mQrisImageUrl.value.trim();
  if (val) els.mQrisPreview.src = val;
});

els.mLogoImageUrl.addEventListener('input', () => {
  const val = els.mLogoImageUrl.value.trim();
  if (val) {
    els.mLogoPreview.src = val;
    els.mLogoPreview.hidden = false;
  } else {
    els.mLogoPreview.hidden = true;
  }
});

els.mClearLogoBtn.addEventListener('click', () => {
  els.mLogoImageUrl.value = '';
  els.mLogoFile.value = '';
  els.mLogoPreview.hidden = true;
});

els.mLogoFile.addEventListener('change', () => {
  const file = els.mLogoFile.files?.[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    showToast('Ukuran foto maksimal 3 MB ya kak.', true);
    els.mLogoFile.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const result = await apiFetch('/api/admin/upload-qris', {
        method: 'POST',
        body: JSON.stringify({ dataUrl: reader.result })
      });
      els.mLogoImageUrl.value = result.url;
      els.mLogoPreview.src = result.url;
      els.mLogoPreview.hidden = false;
      showToast('Foto/logo metode berhasil diupload! ✨');
    } catch (err) {
      showToast(err.message, true);
    }
  };
  reader.readAsDataURL(file);
});

els.mQrisFile.addEventListener('change', () => {
  const file = els.mQrisFile.files?.[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    showToast('Ukuran gambar maksimal 3 MB ya kak.', true);
    els.mQrisFile.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const result = await apiFetch('/api/admin/upload-qris', {
        method: 'POST',
        body: JSON.stringify({ dataUrl: reader.result })
      });
      els.mQrisImageUrl.value = result.url;
      els.mQrisPreview.src = result.url;
      showToast('Gambar QRIS berhasil diupload! ✨');
    } catch (err) {
      showToast(err.message, true);
    }
  };
  reader.readAsDataURL(file);
});

els.methodForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = els.mId.value.trim();
  const payload = {
    name: els.mName.value.trim(),
    category: els.mCategory.value,
    brand: els.mBrand.value,
    logoImage: els.mLogoImageUrl.value.trim(),
    status: els.mStatus.value,
    accountNumber: els.mAccountNumber.value.trim(),
    holderName: els.mHolderName.value.trim(),
    limitInfo: els.mLimitInfo.value.trim(),
    limitMax: Number(els.mLimitMax.value) || 0,
    limitUsed: Number(els.mLimitUsed.value) || 0,
    qrisImage: els.mCategory.value === 'qris' ? els.mQrisImageUrl.value.trim() : '',
    nmid: els.mNmid.value.trim(),
    note: els.mNote.value.trim(),
    hidden: els.mHidden.checked
  };

  try {
    const res = id
      ? await apiFetch(`/api/admin/methods/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      : await apiFetch('/api/admin/methods', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

    renderDashboard(res.store);
    els.methodModal.classList.remove('is-open');
    showToast(id ? 'Perubahan metode disimpan! 💕' : 'Metode baru ditambahkan! 🌸');
  } catch (err) {
    showToast(err.message, true);
  }
});

els.settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const updated = await apiFetch('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        storeName: els.setStoreName.value.trim(),
        operationalStatus: els.setOpStatus.value,
        tagline: els.setTagline.value.trim(),
        ownerPhone: els.setOwnerPhone.value.trim(),
        whatsappNumber: els.setWhatsapp.value.trim(),
        bioOwnerName: els.setBioOwnerName.value.trim(),
        avatarBubbleText: els.setAvatarBubble.value.trim(),
        bioQuote: els.setBioQuote.value.trim(),
        bioDescription: els.setBioDesc.value.trim(),
        waGroupName: els.setWaGroupName.value.trim(),
        waGroupUrl: els.setWaGroupUrl.value.trim(),
        waChannelUrl: els.setWaChannelUrl.value.trim(),
        testimoniUrl: els.setTestimoniUrl.value.trim(),
        antreanUrl: els.setAntreanUrl.value.trim(),
        bioHours: els.setBioHours.value.trim(),
        bioLocation: els.setBioLocation.value.trim(),
        footerNote: els.setFooter.value.trim(),
        announcement: els.setAnnouncement.value.trim(),
        showAnnouncement: els.setShowAnnouncement.checked
      })
    });
    renderDashboard(updated);
    showToast('Pengaturan toko disimpan! 🌸');
  } catch (err) {
    showToast(err.message, true);
  }
});

els.resetLimitsBtn.addEventListener('click', async () => {
  if (!window.confirm('Reset nominal terpakai menjadi Rp 0 dan ubah status limit penuh menjadi Tersedia?')) {
    return;
  }
  try {
    const updated = await apiFetch('/api/admin/methods/reset-limits', {
      method: 'POST',
      body: JSON.stringify({ resetStatus: true })
    });
    renderDashboard(updated);
    showToast('Limit harian berhasil direset! ✨');
  } catch (err) {
    showToast(err.message, true);
  }
});

els.addMethodBtn.addEventListener('click', () => openMethodModal(null));
els.closeMethodModal.addEventListener('click', () => els.methodModal.classList.remove('is-open'));
els.methodModal.addEventListener('click', (e) => {
  if (e.target === els.methodModal) els.methodModal.classList.remove('is-open');
});

function openPasswordModal() {
  els.oldPassword.value = '';
  els.newPassword.value = '';
  els.passwordModal.classList.add('is-open');
}

els.openPasswordModalBtn.addEventListener('click', openPasswordModal);
els.bannerChangePassBtn.addEventListener('click', openPasswordModal);
els.closePasswordModal.addEventListener('click', () => els.passwordModal.classList.remove('is-open'));
els.passwordModal.addEventListener('click', (e) => {
  if (e.target === els.passwordModal) els.passwordModal.classList.remove('is-open');
});

els.passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiFetch('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: els.oldPassword.value,
        newPassword: els.newPassword.value
      })
    });
    els.passwordModal.classList.remove('is-open');
    await loadDashboard();
    showToast('Password admin berhasil diganti! 🔑');
  } catch (err) {
    showToast(err.message, true);
  }
});

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: els.loginPassword.value })
    });
    els.loginPassword.value = '';
    await loadDashboard();
    showToast('Selamat datang kembali, Admin! 🎀');
  } catch (err) {
    showToast(err.message, true);
  }
});

els.logoutBtn.addEventListener('click', async () => {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  showAuthView(false);
  showToast('Berhasil keluar.');
});

async function loadDashboard() {
  const data = await apiFetch('/api/admin/store');
  showAuthView(true);
  renderDashboard(data);
}

async function init() {
  try {
    const auth = await apiFetch('/api/auth/me');
    if (auth.authenticated) {
      await loadDashboard();
    } else {
      showAuthView(false);
    }
  } catch {
    showAuthView(false);
  }
}

document.querySelectorAll('[data-copy-shortcut]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const suffix = btn.dataset.copyShortcut;
    copyText(`${window.location.origin}${suffix}`, `Shortcut disalin: ${suffix} 🔗`);
  });
});

init();
