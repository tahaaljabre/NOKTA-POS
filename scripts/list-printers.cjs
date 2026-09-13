const { execFile } = require('child_process');

const ps = `
$printers = Get-CimInstance -ClassName Win32_Printer | Select-Object Name, PrinterStatus, PortName, DriverName
foreach ($p in $printers) {
    Write-Output "$($p.Name)|$($p.PrinterStatus)|$($p.PortName)|$($p.DriverName)"
}
`;

execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps],
  { timeout: 10000, windowsHide: true }, (err, stdout, stderr) => {
    if (err) { console.error('Error:', stderr || err.message); process.exit(1); }
    console.log('=== الطابعات المثبتة في Windows ===');
    console.log('الاسم                          | الحالة | المنفذ           | التعريف');
    console.log('-'.repeat(80));
    const lines = stdout.trim().split('\n').filter(Boolean);
    if (!lines.length) { console.log('لا توجد طابعات'); return; }
    for (const line of lines) {
      const [name, status, port, driver] = line.split('|');
      const st = { 1: 'جاهز', 2: 'معلق', 3: 'جاري الحذف', 4: 'مسحوب', 5: 'توقف', 6: 'مشغول' }[status] || status;
      console.log(`${name.padEnd(30)} | ${st.padEnd(8)} | ${(port||'').padEnd(16)} | ${driver || ''}`);
    }
  });
