const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PS_SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'raw-print.ps1');

function systemPrint(printerName, data) {
  return new Promise((resolve, reject) => {
    if (!printerName) return reject(new Error('اسم الطابعة غير محدد'));
    if (!data || !data.length) return reject(new Error('بيانات الطباعة فارغة'));

    console.log(`[SYSTEM-PRINT] Printer: "${printerName}", Data: ${data.length} bytes`);

    const tempFile = path.join(os.tmpdir(), `nokta_${Date.now()}.prn`);
    try {
      fs.writeFileSync(tempFile, data);
    } catch (e) {
      return reject(new Error('تعذر إنشاء ملف مؤقت: ' + e.message));
    }

    execFile('powershell', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', PS_SCRIPT,
      tempFile, printerName
    ], { timeout: 15000, windowsHide: true }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch (e) {}
      if (err) {
        const msg = stderr || err.message || 'خطأ غير معروف';
        console.error(`[SYSTEM-PRINT] FAILED: ${msg}`);
        return reject(new Error('فشل الطباعة على ' + printerName + ': ' + msg));
      }
      console.log(`[SYSTEM-PRINT] PowerShell completed OK`);
      resolve();
    });
  });
}

function createSystemDevice(printerName) {
  const chunks = [];

  return {
    open(callback) {
      callback(null);
    },

    write(data, callback) {
      chunks.push(Buffer.from(data));
      if (callback) callback(null);
    },

    close(callback) {
      const buffer = Buffer.concat(chunks);
      const done = (err) => {
        if (callback) callback(err || null);
      };
      if (buffer.length === 0) return done(null);
      systemPrint(printerName, buffer)
        .then(() => done(null))
        .catch((err) => done(err));
    }
  };
}

module.exports = { systemPrint, createSystemDevice };
