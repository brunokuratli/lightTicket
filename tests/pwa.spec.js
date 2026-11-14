// Click tests of the PWA in iPhone format: real timetable search (network),
// PDF ticket import with QR crop, viewer, offline start.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { createServer } = require('./serve');

const FIX = path.join(__dirname, '..', 'test-results', 'fixtures');
const PDF = path.join(FIX, 'muster-billett.pdf');
const QR_PNG = path.join(FIX, 'muster-qr.png');
const BAD = path.join(FIX, 'not-a-pdf.pdf');
const QR_TEXT = () => fs.readFileSync(path.join(FIX, 'qr-text.txt'), 'utf8');

async function shot(page, testInfo, name, fullPage = false) {
  const dir = path.join(__dirname, '..', 'test-results', 'screenshots', testInfo.project.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
}

async function openTab(page, name) {
  await page.getByRole('tab', { name }).click();
  await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
}

async function addTicket(page, file, title) {
  await openTab(page, 'Tickets');
  await page.getByRole('button', { name: 'Ticket hinzufügen' }).click();
  if (title) await page.locator('#t-title').fill(title);
  await page.locator('#t-file').setInputFiles(file);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /SBB/ })).toBeVisible();
});

test('Fahrplan: echte Suche Zürich HB → Bern mit Quellenangabe', async ({ page }, testInfo) => {
  await openTab(page, 'Fahrplan');
  await page.locator('#conn-from').fill('Zürich HB');
  await page.locator('#conn-to').fill('Bern');
  await page.getByRole('button', { name: 'Verbindungen suchen' }).click();
  const cards = page.locator('#conn-results .conn');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(cards.first()).toContainText('Bern');
  await expect(cards.first().locator('.conn-times')).toHaveText(/\d\d:\d\d.*→ \d\d:\d\d/);
  const source = page.locator('#fahrplan .source');
  await expect(source).toContainText('Fahrplandaten: opentransportdata.swiss');
  await expect(source.getByRole('link', { name: 'opentransportdata.swiss' })).toHaveAttribute('href', 'https://opentransportdata.swiss');
  // the whole form fits the iPhone width (Ab/An used to be pushed off-screen)
  const mode = await page.locator('#conn-mode').boundingBox();
  expect(mode.x + mode.width).toBeLessThanOrEqual(page.viewportSize().width);
  await shot(page, testInfo, '01-fahrplan-zuerich-bern', true);
});

test('Abfahrten: Zürich HB mit Quellenangabe', async ({ page }, testInfo) => {
  await openTab(page, 'Abfahrten');
  await page.locator('#board-station').fill('Zürich HB');
  await page.getByRole('button', { name: 'Abfahrten anzeigen' }).click();
  await expect(page.locator('#board-results .board-row').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#abfahrten .source')).toContainText('opentransportdata.swiss');
  await shot(page, testInfo, '02-abfahrten-zuerich');
});

test('Ticket: Original-PDF ablegen, QR gross und ganze Seite zeigen', async ({ page }, testInfo) => {
  await addTicket(page, PDF);
  // title is prefilled from the file name
  await expect(page.locator('#t-title')).toHaveValue('muster-billett');
  await page.locator('#t-title').fill('Zürich HB → Bern');
  await expect(page.locator('#t-status')).toContainText('QR-Code gefunden', { timeout: 30_000 });
  await expect(page.locator('#t-preview')).toBeVisible();
  await page.locator('#t-from-date').fill('2026-11-15');
  await page.locator('#t-to-date').fill('2099-12-31');
  await shot(page, testInfo, '03-ticket-dialog-pdf');
  await page.getByRole('button', { name: 'Speichern' }).click();

  const card = page.locator('.ticket').filter({ hasText: 'Zürich HB → Bern' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('PDF');
  await shot(page, testInfo, '04-ticketliste');

  await card.getByRole('button', { name: 'Zeigen' }).click();
  const viewer = page.locator('#ticket-viewer');
  await expect(viewer).toBeVisible();
  await expect(page.getByRole('tab', { name: 'QR gross' })).toHaveAttribute('aria-selected', 'true');
  const img = page.locator('#viewer-image');
  await expect(img).toBeVisible();

  // The crop must contain the original code: decode it again in the page.
  const decoded = await page.evaluate(async () => {
    const im = document.querySelector('#viewer-image');
    await im.decode();
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(im, 0, 0);
    const jsQR = await window.TicketRender.loadJsqr();
    const r = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
    return { text: r && r.data, w: im.naturalWidth, h: im.naturalHeight };
  });
  expect(decoded.text).toBe(QR_TEXT());
  expect(Math.abs(decoded.w - decoded.h)).toBeLessThanOrEqual(2); // square crop
  // shown large: at least 80 % of the screen width
  const box = await img.boundingBox();
  expect(box.width).toBeGreaterThan(0.8 * page.viewportSize().width);
  await expect(page.getByRole('link', { name: 'Original-PDF öffnen' })).toBeVisible();
  await shot(page, testInfo, '05-vorzeigen-qr-gross');

  await page.getByRole('tab', { name: 'Ganze Seite' }).click();
  const pageImg = page.locator('.viewer-page').first();
  await expect(pageImg).toBeVisible();
  await expect(img).toBeHidden();
  const ratio = await pageImg.evaluate((i) => i.naturalHeight / i.naturalWidth);
  expect(ratio).toBeGreaterThan(1.3); // A4 portrait
  await shot(page, testInfo, '06-vorzeigen-ganze-seite');

  await page.getByRole('button', { name: 'Schliessen' }).click();
  await expect(viewer).toBeHidden();
});

test('Ticket: bleibt offline sichtbar (Service Worker, IndexedDB)', async ({ page }, testInfo) => {
  // "Offline" = the web server is really gone (connection refused). This works the
  // same in Chromium and WebKit, unlike the browser's offline emulation.
  const server = createServer();
  const sockets = new Set();
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}/`;
  const stop = () => new Promise((r) => { server.close(r); for (const s of sockets) s.destroy(); });
  try {
    await page.goto(origin);
    await addTicket(page, PDF, 'Offline-Test');
    await expect(page.locator('#t-status')).toContainText('QR-Code gefunden', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.locator('.ticket').filter({ hasText: 'Offline-Test' })).toBeVisible();

    // wait until the service worker controls the page and has cached the shell
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      }
    });
    await expect.poll(() => page.evaluate(async () => {
      const keys = await caches.keys();
      if (!keys.includes('sbb-light-v2')) return 0;
      return (await (await caches.open('sbb-light-v2')).keys()).length;
    })).toBeGreaterThanOrEqual(10);

    await stop();
    await page.reload();
    await expect(page.getByRole('heading', { name: /SBB/ })).toBeVisible();
    await openTab(page, 'Tickets');
    const card = page.locator('.ticket').filter({ hasText: 'Offline-Test' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Zeigen' }).click();
    await expect(page.locator('#viewer-image')).toBeVisible();
    await shot(page, testInfo, '07-offline-vorzeigen');
    await page.getByRole('button', { name: 'Schliessen' }).click();

    // import also works offline (libraries come from the cache)
    await addTicket(page, PDF, 'Offline-Import');
    await expect(page.locator('#t-status')).toContainText('QR-Code gefunden', { timeout: 30_000 });
  } finally {
    if (server.listening) await stop();
  }
});

test('Ticket: Bild des QR-Codes ablegen', async ({ page }) => {
  await addTicket(page, QR_PNG, 'QR-Bild');
  await expect(page.locator('#t-status')).toContainText('Bild gelesen', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Speichern' }).click();
  const card = page.locator('.ticket').filter({ hasText: 'QR-Bild' });
  await expect(card).toContainText('Bild');
  await card.getByRole('button', { name: 'Zeigen' }).click();
  // an image that is only the code is shown as it is, no mode switch needed
  await expect(page.locator('#viewer-modes')).toBeHidden();
  await expect(page.locator('.viewer-page').first()).toBeVisible();
});

test('Ticket: kaputtes PDF gibt eine klare Meldung und wird nicht gespeichert', async ({ page }) => {
  await addTicket(page, BAD, 'Kaputt');
  await expect(page.locator('#t-status')).toContainText('konnte nicht gelesen werden', { timeout: 20_000 });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Speichern' }).click();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('.ticket').filter({ hasText: 'Kaputt' })).toHaveCount(0);
});

test('Ticket: abgelaufenes Billett ist markiert', async ({ page }) => {
  await addTicket(page, QR_PNG, 'Alt');
  await expect(page.locator('#t-status')).toContainText('Bild gelesen', { timeout: 20_000 });
  await page.locator('#t-to-date').fill('2020-01-01');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('.ticket.expired').filter({ hasText: 'Alt' })).toContainText('abgelaufen');
});
