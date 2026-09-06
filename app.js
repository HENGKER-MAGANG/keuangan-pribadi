(function () {
  'use strict';

  var SCRIPT_URL = (window.APP_CONFIG && window.APP_CONFIG.SCRIPT_URL) || '';

  var state = {
    transactions: [],
    sheetUrl: '',
    filter: 'all',
    pendingPhoto: null,
    currentType: 'income',
    detailId: null,
    loading: false
  };

  window.__onProofImgError = function (img) {
    var div = document.createElement('div');
    div.className = 'proof-thumb empty';
    div.innerHTML = '<i class="ti ti-photo-off"></i>';
    if (img.parentNode) img.parentNode.replaceChild(div, img);
  };

  window.__onDetailImgError = function (img) {
    img.style.display = 'none';
  };

  function normalizeFotoUrl(url) {
    if (!url) return '';
    var s = String(url).trim();
    var m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return 'https://lh3.googleusercontent.com/d/' + m[1];
    return s;
  }

  function formatRupiah(n) {
    n = Number(n) || 0;
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function parseTanggal(value) {
    if (!value) return new Date(NaN);
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    var s = String(value).trim();

    var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

    var dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));

    return new Date(s);
  }

  function formatDateHuman(value) {
    var d = parseTanggal(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function isSameDay(a, b) { return a.toDateString() === b.toDateString(); }
  function startOfWeek(d) {
    var date = new Date(d);
    var day = date.getDay();
    var diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function showToast(msg, type) {
    type = type || 'success';
    var toastEl = document.getElementById('toast');
    var iconEl = document.getElementById('toastIcon');
    var msgEl = document.getElementById('toastMsg');
    var progressEl = document.getElementById('toastProgress');

    var iconClass = type === 'error' ? 'ti-alert-circle' : (type === 'info' ? 'ti-info-circle' : 'ti-circle-check');

    toastEl.classList.remove('show', 'animate-progress', 'success', 'error', 'info');
    progressEl.classList.remove('animate-progress');
    iconEl.className = 'ti ' + iconClass;
    msgEl.textContent = msg;

    toastEl.classList.add(type);
    void toastEl.offsetWidth;

    requestAnimationFrame(function () {
      toastEl.classList.add('show');
      requestAnimationFrame(function () {
        progressEl.classList.add('animate-progress');
      });
    });

    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2800);
  }

  function apiList() {
    if (!SCRIPT_URL || SCRIPT_URL.indexOf('PASTE_URL') > -1) {
      showToast('Isi dulu SCRIPT_URL di config.js', 'error');
      return Promise.resolve({ success: false, data: [] });
    }
    return fetch(SCRIPT_URL + '?action=list&t=' + Date.now())
      .then(function (r) { return r.json(); })
      .catch(function () {
        showToast('Gagal memuat data. Cek koneksi / SCRIPT_URL.', 'error');
        return { success: false, data: [] };
      });
  }

  function apiPost(payload) {
    return fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function loadData() {
    return apiList().then(function (res) {
      if (res.success) {
        state.transactions = res.data || [];
        state.sheetUrl = res.sheetUrl || '';
        if (state.sheetUrl) {
          ['sheetLink', 'sheetLinkDesktop'].forEach(function (id) {
            var link = document.getElementById(id);
            if (link) { link.href = state.sheetUrl; link.style.display = 'flex'; }
          });
        }
      }
      renderAll();
    });
  }

  function filteredTransactions() {
    var now = new Date();
    var list = state.transactions.slice();
    if (state.filter === 'today') {
      list = list.filter(function (t) { return isSameDay(parseTanggal(t.tanggal), now); });
    } else if (state.filter === 'week') {
      var sow = startOfWeek(now);
      list = list.filter(function (t) { return parseTanggal(t.tanggal) >= sow; });
    } else if (state.filter === 'month') {
      list = list.filter(function (t) {
        var d = parseTanggal(t.tanggal);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }
    return list;
  }

  function renderAll() {
    renderBalance();
    renderList();
    renderRecap();
    renderSidePanel();
  }

  function renderBalance() {
    var totalIncome = 0, totalExpense = 0;
    state.transactions.forEach(function (t) {
      if (t.tipe === 'income') totalIncome += Number(t.jumlah);
      else totalExpense += Number(t.jumlah);
    });
    document.getElementById('totalBalance').textContent = formatRupiah(totalIncome - totalExpense);
    document.getElementById('sumIncome').textContent = formatRupiah(totalIncome);
    document.getElementById('sumExpense').textContent = formatRupiah(totalExpense);
  }

  function renderSidePanel() {
    var miniIncomeEl = document.getElementById('miniIncome');
    var miniExpenseEl = document.getElementById('miniExpense');
    var miniNetEl = document.getElementById('miniNet');
    var miniTopCatEl = document.getElementById('miniTopCategory');
    if (!miniIncomeEl || !miniExpenseEl || !miniNetEl || !miniTopCatEl) return;

    var now = new Date();
    var monthList = state.transactions.filter(function (t) {
      var d = parseTanggal(t.tanggal);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    var income = 0, expense = 0;
    var catTotals = {};
    monthList.forEach(function (t) {
      if (t.tipe === 'income') {
        income += Number(t.jumlah);
      } else {
        expense += Number(t.jumlah);
        var cat = t.kategori || 'Lainnya';
        catTotals[cat] = (catTotals[cat] || 0) + Number(t.jumlah);
      }
    });

    miniIncomeEl.textContent = formatRupiah(income);
    miniExpenseEl.textContent = formatRupiah(expense);
    miniNetEl.textContent = formatRupiah(income - expense);

    var cats = Object.keys(catTotals).sort(function (a, b) { return catTotals[b] - catTotals[a]; });
    if (!cats.length) {
      miniTopCatEl.innerHTML = '<p class="muted-text">Belum ada data.</p>';
    } else {
      miniTopCatEl.innerHTML = cats.slice(0, 3).map(function (c) {
        return (
          '<div class="mini-stat">' +
            '<span class="mini-stat-label">' + escapeHtml(c) + '</span>' +
            '<span class="mini-stat-value expense">' + formatRupiah(catTotals[c]) + '</span>' +
          '</div>'
        );
      }).join('');
    }
  }

  function renderList() {
    var list = filteredTransactions();
    var wrap = document.getElementById('txnList');
    document.getElementById('txnCount').textContent = list.length ? list.length + ' transaksi' : '';

    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state"><i class="ti ti-receipt-off"></i><p>Belum ada transaksi pada periode ini.<br>Ketuk tombol + untuk mulai mencatat.</p></div>';
      return;
    }

    wrap.innerHTML = list.map(function (t) {
      var isIncome = t.tipe === 'income';
      var iconCat = isIncome ? 'ti-arrow-down-circle' : 'ti-arrow-up-circle';
      var fotoUrl = normalizeFotoUrl(t.fotoUrl);
      var thumb = fotoUrl
        ? '<img class="proof-thumb" src="' + fotoUrl + '" alt="bukti" onerror="window.__onProofImgError(this)" />'
        : '<div class="proof-thumb empty"><i class="ti ti-photo-off"></i></div>';
      return (
        '<div class="txn-item ' + (isIncome ? 'income' : 'expense') + '" data-id="' + t.id + '">' +
          '<div class="icon-badge"><i class="ti ' + iconCat + '"></i></div>' +
          '<div class="mid">' +
            '<div class="note">' + escapeHtml(t.keterangan || '(tanpa keterangan)') + '</div>' +
            '<div class="meta">' + formatDateHuman(t.tanggal) + ' &middot; ' + escapeHtml(t.kategori || 'Lainnya') + '</div>' +
          '</div>' +
          '<div class="right">' +
            '<div class="amount ' + (isIncome ? 'income' : 'expense') + '">' + (isIncome ? '+' : '-') + ' ' + formatRupiah(t.jumlah) + '</div>' +
            thumb +
          '</div>' +
        '</div>'
      );
    }).join('');

    wrap.querySelectorAll('.txn-item').forEach(function (el) {
      el.addEventListener('click', function () { openDetail(el.getAttribute('data-id')); });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function renderRecap() {
    var now = new Date();
    var monthList = state.transactions.filter(function (t) {
      var d = parseTanggal(t.tanggal);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    var income = 0, expense = 0;
    var catTotals = {};
    monthList.forEach(function (t) {
      if (t.tipe === 'income') income += Number(t.jumlah);
      else {
        expense += Number(t.jumlah);
        var cat = t.kategori || 'Lainnya';
        catTotals[cat] = (catTotals[cat] || 0) + Number(t.jumlah);
      }
    });
    document.getElementById('recapIncome').textContent = formatRupiah(income);
    document.getElementById('recapExpense').textContent = formatRupiah(expense);
    document.getElementById('recapNet').textContent = formatRupiah(income - expense);

    var catBox = document.getElementById('categoryBars');
    var cats = Object.keys(catTotals).sort(function (a, b) { return catTotals[b] - catTotals[a]; });
    if (!cats.length) {
      catBox.innerHTML = '<div class="empty-state" style="padding:1rem;"><p>Belum ada data pengeluaran bulan ini.</p></div>';
    } else {
      var max = catTotals[cats[0]];
      catBox.innerHTML = cats.map(function (c) {
        var pct = Math.max(4, Math.round((catTotals[c] / max) * 100));
        return (
          '<div class="bar-row">' +
            '<div class="bar-top"><span class="bcat">' + escapeHtml(c) + '</span><span class="bval">' + formatRupiah(catTotals[c]) + '</span></div>' +
            '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;"></div></div>' +
          '</div>'
        );
      }).join('');
    }

    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    var trendRow = document.getElementById('trendRow');
    var dayTotals = days.map(function (d) {
      var inc = 0, exp = 0;
      state.transactions.forEach(function (t) {
        var td = parseTanggal(t.tanggal);
        if (isSameDay(td, d)) {
          if (t.tipe === 'income') inc += Number(t.jumlah); else exp += Number(t.jumlah);
        }
      });
      return { d: d, inc: inc, exp: exp };
    });
    var maxVal = Math.max.apply(null, dayTotals.map(function (x) { return Math.max(x.inc, x.exp); }).concat([1]));
    trendRow.innerHTML = dayTotals.map(function (x) {
      var hInc = Math.round((x.inc / maxVal) * 70);
      var hExp = Math.round((x.exp / maxVal) * 70);
      var label = x.d.toLocaleDateString('id-ID', { weekday: 'short' });
      return (
        '<div class="trend-col">' +
          '<div style="display:flex;gap:2px;align-items:flex-end;height:70px;">' +
            '<div class="trend-bar income" style="height:' + hInc + 'px;"></div>' +
            '<div class="trend-bar expense" style="height:' + hExp + 'px;"></div>' +
          '</div>' +
          '<div class="trend-label">' + label + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function openDetail(id) {
    var t = state.transactions.find(function (x) { return x.id === id; });
    if (!t) return;
    state.detailId = id;
    var isIncome = t.tipe === 'income';
    var fotoUrl = normalizeFotoUrl(t.fotoUrl);
    var body = document.getElementById('detailBody');
    body.innerHTML =
      (fotoUrl ? '<img class="detail-photo" src="' + fotoUrl + '" alt="bukti" onerror="window.__onDetailImgError(this)" />' : '') +
      '<div class="detail-row"><span class="dl">Tipe</span><span class="dv" style="color:' + (isIncome ? 'var(--c-income-text)' : 'var(--c-expense-text)') + '">' + (isIncome ? 'Pemasukan' : 'Pengeluaran') + '</span></div>' +
      '<div class="detail-row"><span class="dl">Jumlah</span><span class="dv">' + formatRupiah(t.jumlah) + '</span></div>' +
      '<div class="detail-row"><span class="dl">Keterangan</span><span class="dv">' + escapeHtml(t.keterangan || '-') + '</span></div>' +
      '<div class="detail-row"><span class="dl">Kategori</span><span class="dv">' + escapeHtml(t.kategori || 'Lainnya') + '</span></div>' +
      '<div class="detail-row"><span class="dl">Tanggal</span><span class="dv">' + formatDateHuman(t.tanggal) + '</span></div>';
    openOverlay('overlayDetail');
  }

  function deleteCurrentDetail() {
    if (!state.detailId) return;
    var btn = document.getElementById('btnDelete');
    btn.disabled = true;
    apiPost({ action: 'delete', id: state.detailId }).then(function (res) {
      btn.disabled = false;
      if (res.success) {
        state.transactions = state.transactions.filter(function (x) { return x.id !== state.detailId; });
        closeOverlay('overlayDetail');
        renderAll();
        showToast('Transaksi dihapus', 'success');
      } else {
        showToast('Gagal menghapus: ' + (res.error || ''), 'error');
      }
    });
  }

  function openOverlay(id) { document.getElementById(id).classList.add('open'); }
  function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

  function resetForm() {
    document.getElementById('inpJumlah').value = '';
    document.getElementById('inpKeterangan').value = '';
    document.getElementById('inpKategori').value = '';
    document.getElementById('inpTanggal').value = todayISO();
    state.pendingPhoto = null;
    state.currentType = 'income';
    setTypeToggle('income');
    renderProofArea();
  }

  function setTypeToggle(type) {
    state.currentType = type;
    document.querySelectorAll('.type-toggle button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-type') === type);
    });
  }

  function renderProofArea() {
    var area = document.getElementById('proofArea');
    if (state.pendingPhoto) {
      area.innerHTML =
        '<div class="proof-preview">' +
          '<img src="' + state.pendingPhoto + '" alt="preview" />' +
          '<button type="button" class="remove-btn" id="btnRemovePhoto"><i class="ti ti-x"></i></button>' +
        '</div>';
      document.getElementById('btnRemovePhoto').addEventListener('click', function () {
        state.pendingPhoto = null;
        renderProofArea();
      });
    } else {
      area.innerHTML =
        '<div class="proof-upload" id="proofEmptyState">' +
          '<i class="ti ti-camera icon"></i>' +
          '<div class="hint">Ketuk untuk ambil foto struk/bukti</div>' +
          '<div class="proof-actions">' +
            '<button type="button" id="btnOpenCamera"><i class="ti ti-camera"></i> Buka Kamera</button>' +
            '<button type="button" id="btnOpenGallery"><i class="ti ti-photo"></i> Dari Galeri</button>' +
          '</div>' +
        '</div>';
      document.getElementById('btnOpenCamera').addEventListener('click', openCamera);
      document.getElementById('btnOpenGallery').addEventListener('click', function () {
        document.getElementById('fileInput').click();
      });
    }
  }

  function submitForm() {
    var jumlah = Number(document.getElementById('inpJumlah').value);
    var keterangan = document.getElementById('inpKeterangan').value.trim();
    var kategori = document.getElementById('inpKategori').value.trim() || 'Lainnya';
    var tanggal = document.getElementById('inpTanggal').value || todayISO();

    if (!jumlah || jumlah <= 0) { showToast('Isi jumlah dengan benar', 'error'); return; }
    if (!keterangan) { showToast('Isi keterangan / untuk apa transaksi ini', 'error'); return; }

    var btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="border-top-color:#fff;border-color:rgba(255,255,255,.4);"></span> Menyimpan...';

    apiPost({
      action: 'add',
      tipe: state.currentType,
      jumlah: jumlah,
      keterangan: keterangan,
      kategori: kategori,
      tanggal: tanggal,
      fotoBase64: state.pendingPhoto || ''
    }).then(function (res) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-check"></i> Simpan Transaksi';
      if (res.success) {
        state.transactions.unshift(res.data);
        closeOverlay('overlayForm');
        renderAll();
        showToast('Transaksi tersimpan', 'success');
      } else {
        showToast('Gagal menyimpan: ' + (res.error || ''), 'error');
      }
    }).catch(function () {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-check"></i> Simpan Transaksi';
      showToast('Gagal menyimpan. Cek koneksi internet.', 'error');
    });
  }

  var cameraStream = null;

  function openCamera() {
    var modal = document.getElementById('cameraModal');
    var video = document.getElementById('cameraVideo');

    if (!window.isSecureContext) {
      showToast('Kamera butuh koneksi HTTPS. Gunakan "Dari Galeri" saja.', 'error');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Kamera tidak didukung di browser ini, gunakan "Dari Galeri"', 'info');
      return;
    }

    closeCamera();

    function start(constraints) {
      return navigator.mediaDevices.getUserMedia(constraints);
    }

    start({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .catch(function () {
        return start({ video: true, audio: false });
      })
      .then(function (stream) {
        cameraStream = stream;
        video.srcObject = stream;
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
        modal.classList.add('open');
      })
      .catch(function (err) {
        var msg = 'Tidak bisa mengakses kamera. Izinkan akses kamera di pengaturan browser.';
        if (err && err.name === 'NotFoundError') msg = 'Kamera tidak ditemukan di perangkat ini.';
        if (err && err.name === 'NotAllowedError') msg = 'Akses kamera ditolak. Izinkan akses kamera di pengaturan browser.';
        showToast(msg, 'error');
      });
  }

  function closeCamera() {
    document.getElementById('cameraModal').classList.remove('open');
    var video = document.getElementById('cameraVideo');
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) { t.stop(); });
      cameraStream = null;
    }
    if (video) video.srcObject = null;
  }

  function capturePhoto() {
    var video = document.getElementById('cameraVideo');
    if (!video.videoWidth || !video.videoHeight) {
      showToast('Kamera belum siap, coba lagi sebentar.', 'info');
      return;
    }
    var canvas = document.getElementById('cameraCanvas');
    var maxW = 900;
    var scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    state.pendingPhoto = canvas.toDataURL('image/jpeg', 0.8);
    closeCamera();
    renderProofArea();
  }

  function handleGalleryFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var maxW = 900;
        var scale = Math.min(1, maxW / img.width);
        var canvas = document.getElementById('cameraCanvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        state.pendingPhoto = canvas.toDataURL('image/jpeg', 0.8);
        renderProofArea();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function showPage(page) {
    document.getElementById('pageHome').style.display = page === 'home' ? 'block' : 'none';
    document.getElementById('pageRecap').style.display = page === 'recap' ? 'block' : 'none';

    document.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-nav') === page);
    });

    var titleEl = document.getElementById('pageTitle');
    var subEl = document.getElementById('pageSubtitle');
    if (titleEl && subEl) {
      if (page === 'home') {
        titleEl.textContent = 'Beranda';
        subEl.textContent = 'Ringkasan saldo & riwayat transaksi Anda';
      } else {
        titleEl.textContent = 'Rekap';
        subEl.textContent = 'Ringkasan pemasukan & pengeluaran Anda';
      }
    }

    if (page === 'recap') renderRecap();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('inpTanggal').value = todayISO();

    document.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () { showPage(btn.getAttribute('data-nav')); });
    });

    document.querySelectorAll('[data-add-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        resetForm();
        openOverlay('overlayForm');
      });
    });

    document.getElementById('closeForm').addEventListener('click', function () { closeOverlay('overlayForm'); });
    document.getElementById('overlayForm').addEventListener('click', function (e) {
      if (e.target.id === 'overlayForm') closeOverlay('overlayForm');
    });

    document.getElementById('closeDetail').addEventListener('click', function () { closeOverlay('overlayDetail'); });
    document.getElementById('overlayDetail').addEventListener('click', function (e) {
      if (e.target.id === 'overlayDetail') closeOverlay('overlayDetail');
    });
    document.getElementById('btnDelete').addEventListener('click', deleteCurrentDetail);

    document.querySelectorAll('.type-toggle button').forEach(function (b) {
      b.addEventListener('click', function () { setTypeToggle(b.getAttribute('data-type')); });
    });

    document.getElementById('btnSubmit').addEventListener('click', submitForm);

    document.getElementById('fileInput').addEventListener('change', function (e) {
      handleGalleryFile(e.target.files[0]);
      e.target.value = '';
    });

    document.getElementById('camClose').addEventListener('click', closeCamera);
    document.getElementById('camShutter').addEventListener('click', capturePhoto);

    document.getElementById('toastClose').addEventListener('click', function () {
      document.getElementById('toast').classList.remove('show');
      clearTimeout(showToast._t);
    });

    document.getElementById('filterChips').addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-chip');
      if (!btn) return;
      state.filter = btn.getAttribute('data-filter');
      document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      renderList();
    });

    renderProofArea();
    loadData();
  });
})();