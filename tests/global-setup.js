// Builds the test fixtures: a sample ticket PDF ("MUSTER", not a real ticket)
// with a QR code, and the same QR code as PNG. Nothing real goes into the repo.
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, '..', 'test-results', 'fixtures');
const QR_TEXT = 'MUSTER-BILLETT SBB-LIGHT-TEST 0000-0000-0000';

module.exports = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const qrPng = await QRCode.toBuffer(QR_TEXT, { margin: 2, scale: 8, errorCorrectionLevel: 'M' });
  fs.writeFileSync(path.join(OUT, 'muster-qr.png'), qrPng);
  const qr = 'data:image/png;base64,' + qrPng.toString('base64');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;margin:0;padding:18mm;color:#000}
    .top{display:flex;justify-content:space-between;align-items:flex-start}
    h1{font-size:22pt;margin:0}.ot{font-size:10pt;text-align:right}
    .box{border:1px solid #000;padding:6mm;margin-top:8mm;display:flex;gap:10mm;align-items:center}
    .qr{width:42mm;height:42mm;image-rendering:pixelated}
    .muster{font-size:40pt;color:#999;transform:rotate(-20deg);margin-top:30mm;text-align:center}
    td{padding:2mm 6mm 2mm 0;font-size:11pt}
  </style></head><body>
    <div class="top"><h1>Billett</h1><div class="ot">OT-Nr. 000000000000<br>MUSTER</div></div>
    <div class="box"><img class="qr" src="${qr}"><table>
      <tr><td>Strecke</td><td><b>Zürich HB → Bern</b></td></tr>
      <tr><td>Gültig</td><td>15.11.2026</td></tr>
      <tr><td>Klasse</td><td>2.</td></tr>
      <tr><td>Reisende</td><td>Max Muster</td></tr></table></div>
    <div class="muster">MUSTER – KEIN GÜLTIGES BILLETT</div>
  </body></html>`;

  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: path.join(OUT, 'muster-billett.pdf'), format: 'A4', printBackground: true });
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'not-a-pdf.pdf'), 'das ist kein PDF');
  fs.writeFileSync(path.join(OUT, 'qr-text.txt'), QR_TEXT);
};
