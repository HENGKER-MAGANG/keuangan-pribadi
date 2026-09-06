(function () {
  'use strict';

  var SCRIPT_URL = (window.APP_CONFIG && window.APP_CONFIG.SCRIPT_URL) || '';

  var state = {
    transactions: [],
    sheetUrl: '',
    filter: 'all',
    pendingPhoto: null, // base64
    currentType: 'income',
    detailId: null,
    loading: false
  };

  // ---------- Helpers ----------
  function formatRupiah(n) {
    n = Number(n) || 0;
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function formatDateHuman(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function isSameDay(a, b) { return a.toDateString() === b.toDateString(); }
  function startOfWeek(d) {
    var date = new Date(d);
    var day = date.getDay();
    var diff = (day === 0 ? -6 : 1) - day; // senin sebagai awal minggu
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function showToast(msg, type) {
    var el = document.getElementById('toast');
    el.className = 'flash show ' + (type || 'success');
    var icon = type === 'error' ? 'ti-alert-circle' : (type === 'info' ? 'ti-info-circle' : 'ti-circle-check');
    el.innerHTML = '<i class="ti ' + icon + '"></i><span>' + msg + '</span>';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  // ---------- API ----------
  function apiList() {
    if (!SCRIPT_URL || SCRIPT_URL.indexOf('PASTE_URL') > -1) {
      showToast('Isi dulu SCRIPT_URL di config.js', 'error');
      return Promise.resolve({ success: false, data: [] });
    }
    return fetch(SCRIPT_URL + '?action=list&t=' + Date.now())
      .then(function (r) { return r.json(); })
      .catch(function (err) {
        showToast('Gagal memuat data. Cek koneksi / SCRIPT_URL.', 'error');
        return { success: false, data: [] };
      });
  }

  function apiPost(payload) {
    return fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function loadData() {
    return apiList().then(function (res) {
      if (res.success) {
        state.transactions = res.data || [];
        state.sheetUrl = res.sheetUrl || '';
        if (state.sheetUrl) {
          var link = document.getElementById('sheetLink');
          link.href = state.sheetUrl;
          link.style.display = 'flex';
        }
      }
      renderAll();
    });
  }

  // ---------- Filtering ----------
  function filteredTransactions() {
    var now = new Date();
    var list = state.transactions.slice();
    if (state.filter === 'today') {
      list = list.filter(function (t) { return isSameDay(new Date(t.tanggal), now); });
    } else if (state.filter === 'week') {
      var sow = startOfWeek(now);
      list = list.filter(function (t) { return new Date(t.tanggal) >= sow; });
    } else if (state.filter === 'month') {
      list = list.filter(function (t) {
        var d = new Date(t.tanggal);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }
    return list;
  }

  // ---------- Rendering: Home ----------
  function renderAll() {
    renderBalance();
    renderList();
    renderRecap();
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
      var thumb = t.fotoUrl
        ? '<img class="proof-thumb" src="' + t.fotoUrl + '" alt="bukti" />'
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

  // ---------- Rendering: Recap ----------
  function renderRecap() {
    var now = new Date();
    var monthList = state.transactions.filter(function (t) {
      var d = new Date(t.tanggal);
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

    // Kategori bars
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

    // Trend 7 hari
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    var trendRow = document.getElementById('trendRow');
    var dayTotals = days.map(function (d) {
      var inc = 0, exp = 0;
      state.transactions.forEach(function (t) {
        var td = new Date(t.tanggal);
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

  // ---------- Detail / Delete ----------
  function openDetail(id) {
    var t = state.transactions.find(function (x) { return x.id === id; });
    if (!t) return;
    state.detailId = id;
    var isIncome = t.tipe === 'income';
    var body = document.getElementById('detailBody');
    body.innerHTML =
      (t.fotoUrl ? '<img class="detail-photo" src="' + t.fotoUrl + '" alt="bukti" />' : '') +
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

  // ---------- Overlay helpers ----------
  function openOverlay(id) { document.getElementById(id).classList.add('open'); }
  function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

  // ---------- Form: Tambah Transaksi ----------
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

  // ---------- Kamera langsung di web ----------
  var cameraStream = null;

  function openCamera() {
    var modal = document.getElementById('cameraModal');
    var video = document.getElementById('cameraVideo');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Kamera tidak didukung, gunakan "Dari Galeri"', 'info');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(function (stream) {
        cameraStream = stream;
        video.srcObject = stream;
        modal.classList.add('open');
      })
      .catch(function () {
        showToast('Tidak bisa mengakses kamera. Izinkan akses kamera di browser.', 'error');
      });
  }

  function closeCamera() {
    document.getElementById('cameraModal').classList.remove('open');
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) { t.stop(); });
      cameraStream = null;
    }
  }

  function capturePhoto() {
    var video = document.getElementById('cameraVideo');
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

  // ---------- Navigasi ----------
  function showPage(page) {
    document.getElementById('pageHome').style.display = page === 'home' ? 'block' : 'none';
    document.getElementById('pageRecap').style.display = page === 'recap' ? 'block' : 'none';
    document.getElementById('navHome').classList.toggle('active', page === 'home');
    document.getElementById('navRecap').classList.toggle('active', page === 'recap');
    if (page === 'recap') renderRecap();
  }

  // ---------- Init / Event bindings ----------
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('inpTanggal').value = todayISO();

    document.getElementById('navHome').addEventListener('click', function () { showPage('home'); });
    document.getElementById('navRecap').addEventListener('click', function () { showPage('recap'); });

    document.getElementById('fabAdd').addEventListener('click', function () {
      resetForm();
      openOverlay('overlayForm');
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
