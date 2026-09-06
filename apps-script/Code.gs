/**
 * ============================================================
 *  BACKEND "Catatan Keuangan Pribadi"
 *  Google Apps Script - menjadikan Google Sheets sebagai database
 *  dan Google Drive sebagai penyimpanan foto bukti transaksi.
 *
 *  CARA PAKAI:
 *  1. Buka https://sheets.new  -> beri nama terserah, misal "Keuangan Pribadi".
 *  2. Di menu Sheet: Ekstensi > Apps Script.
 *  3. Hapus semua kode contoh (Code.gs bawaan), lalu tempel SELURUH isi file ini.
 *  4. Klik Deploy > New deployment.
 *     - Klik ikon gerigi di "Select type" -> pilih "Web app".
 *     - Description : bebas.
 *     - Execute as  : Me (akun Anda).
 *     - Who has access : Anyone.
 *  5. Klik Deploy, lalu klik "Authorize access" dan izinkan semua permission
 *     (ini normal karena script perlu akses Sheet & Drive milik Anda sendiri).
 *  6. Salin "Web app URL" yang muncul -> tempel ke file config.js pada
 *     folder web (SCRIPT_URL).
 *  7. Selesai. Sheet & folder Drive akan dibuat otomatis saat transaksi
 *     pertama disimpan.
 * ============================================================
 */

var SHEET_NAME = 'Transaksi';
var DRIVE_FOLDER_NAME = 'Bukti Transaksi - Keuangan Pribadi';
var HEADERS = ['id', 'tanggal', 'tipe', 'jumlah', 'keterangan', 'kategori', 'fotoUrl', 'dibuatPada'];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getFolder_() {
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowToObj_(row) {
  var obj = {};
  for (var i = 0; i < HEADERS.length; i++) obj[HEADERS[i]] = row[i];
  return obj;
}

function doGet(e) {
  try {
    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    var data = [];
    for (var i = 1; i < values.length; i++) {
      if (values[i][0]) data.push(rowToObj_(values[i]));
    }
    // urutkan terbaru dulu berdasarkan tanggal lalu dibuatPada
    data.sort(function (a, b) {
      var da = new Date(a.tanggal).getTime();
      var db = new Date(b.tanggal).getTime();
      if (db !== da) return db - da;
      return new Date(b.dibuatPada) - new Date(a.dibuatPada);
    });
    return jsonOut_({
      success: true,
      data: data,
      sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl()
    });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if (action === 'add') {
      var sheet = getSheet_();
      var id = Utilities.getUuid();
      var fotoUrl = '';

      if (body.fotoBase64) {
        var folder = getFolder_();
        var raw = body.fotoBase64.indexOf(',') > -1
          ? body.fotoBase64.split(',')[1]
          : body.fotoBase64;
        var bytes = Utilities.base64Decode(raw);
        var blob = Utilities.newBlob(bytes, 'image/jpeg', id + '.jpg');
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fotoUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
      }

      var now = new Date();
      var row = [
        id,
        body.tanggal || Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        body.tipe,
        Number(body.jumlah) || 0,
        body.keterangan || '',
        body.kategori || 'Lainnya',
        fotoUrl,
        now.toISOString()
      ];
      sheet.appendRow(row);

      return jsonOut_({ success: true, data: rowToObj_(row) });
    }

    if (action === 'delete') {
      var sheet2 = getSheet_();
      var values = sheet2.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] === body.id) {
          sheet2.deleteRow(i + 1);
          return jsonOut_({ success: true });
        }
      }
      return jsonOut_({ success: false, error: 'ID tidak ditemukan' });
    }

    return jsonOut_({ success: false, error: 'Aksi tidak dikenal' });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}
