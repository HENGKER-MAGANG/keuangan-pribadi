# Catatan Keuangan Pribadi

Web pencatat keuangan pribadi: catat uang masuk & keluar, foto bukti langsung dari kamera browser, semua data tersimpan otomatis ke **Google Spreadsheet** milik Anda sendiri (bisa dibuka & diedit manual kapan saja), plus halaman **Rekap** dengan ringkasan dan grafik sederhana.

Tidak perlu database berbayar — Google Sheets + Google Drive jadi "server" gratis Anda.

---

## Cara Setup (± 5 menit)

### 1. Buat Google Sheet
1. Buka [sheets.new](https://sheets.new) — beri nama bebas, misal **"Keuangan Pribadi"**.
2. Di menu atas: **Ekstensi > Apps Script**.
3. Hapus semua kode contoh di editor, lalu **copy-paste seluruh isi file `apps-script/Code.gs`** (ada di folder ini) ke sana.
4. Simpan (Ctrl+S / Cmd+S).

### 2. Deploy sebagai Web App
1. Klik tombol **Deploy > New deployment**.
2. Klik ikon gerigi ⚙️ di sebelah "Select type" → pilih **Web app**.
3. Isi:
   - **Execute as**: Me (akun Anda)
   - **Who has access**: **Anyone**
4. Klik **Deploy**.
5. Akan muncul jendela minta izin — klik **Authorize access**, pilih akun Google Anda, klik **Advanced > Go to (nama project) (unsafe)** lalu **Allow**. Ini normal karena scriptnya milik Anda sendiri dan hanya mengakses Sheet & Drive Anda.
6. Setelah selesai, **salin "Web app URL"** yang muncul (bentuknya seperti `https://script.google.com/macros/s/xxxxx/exec`).

> Sheet dan folder Google Drive **"Bukti Transaksi - Keuangan Pribadi"** akan otomatis dibuat saat transaksi pertama disimpan.

### 3. Hubungkan Web ke Google Sheet
1. Buka file **`config.js`** di folder ini.
2. Ganti `PASTE_URL_WEB_APP_GOOGLE_APPS_SCRIPT_DI_SINI` dengan URL yang barusan disalin.

```js
window.APP_CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/xxxxxxxxxxxx/exec"
};
```

### 4. Deploy ke Vercel
Paling gampang tanpa install apa pun:
1. Buka [vercel.com/new](https://vercel.com/new).
2. Pilih **"Deploy without Git" / drag & drop folder** (atau upload ulang folder/zip ini).
3. Vercel otomatis mendeteksi ini sebagai static site — tidak perlu isi Build Command / Output Directory, biarkan kosong/default.
4. Klik **Deploy**. Selesai — Anda dapat URL seperti `nama-project.vercel.app`.

Atau lewat CLI (jika sudah install Node.js):
```bash
npm i -g vercel
cd keuangan-pribadi
vercel --prod
```

### 5. Mulai Pakai
- Buka web-nya di HP (disarankan, karena kamera & FAB dioptimalkan untuk mobile).
- Ketuk tombol **+** di kanan bawah untuk tambah transaksi.
- Pilih **Pemasukan/Pengeluaran**, isi jumlah & keterangan, ambil foto bukti langsung dari kamera kalau perlu.
- Tab **Rekap** menampilkan ringkasan bulan ini, tren 7 hari, dan pengeluaran per kategori.
- Tombol **"Spreadsheet"** di pojok kanan atas membuka data mentah langsung di Google Sheets kapan saja.

---

## Struktur File
```
keuangan-pribadi/
├─ index.html          -> halaman utama (dashboard, form, kamera)
├─ style.css           -> tema oranye sesuai design system
├─ app.js              -> logic aplikasi (fetch data, kamera, render)
├─ config.js           -> tempat isi URL Google Apps Script Anda
├─ vercel.json         -> config deploy Vercel
└─ apps-script/
   └─ Code.gs          -> backend: Google Sheet sebagai DB + Drive utk foto
```

## Catatan
- Semua orang yang membuka Web App URL Apps Script Anda secara teknis bisa mengakses API-nya — untuk pemakaian pribadi ini aman selama URL tidak disebar. Untuk keamanan tambahan, Anda bisa menambahkan PIN sederhana kalau diperlukan.
- Foto bukti disimpan di folder Google Drive **"Bukti Transaksi - Keuangan Pribadi"** dengan akses "siapa saja yang punya link bisa melihat", supaya bisa ditampilkan sebagai gambar di web.
- Kamera browser butuh koneksi **HTTPS** — otomatis terpenuhi karena Vercel selalu pakai HTTPS.
