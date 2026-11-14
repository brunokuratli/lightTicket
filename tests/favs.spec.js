// Favourites (Etappe 5) and last results without network (Etappe 7), iPhone format.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

async function shot(page, testInfo, name) {
  const dir = path.join(__dirname, '..', 'test-results', 'screenshots', testInfo.project.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file });
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
}

async function searchZurichBern(page) {
  await page.getByRole('tab', { name: 'Fahrplan' }).click();
  await page.locator('#conn-from').fill('Zürich HB');
  await page.locator('#conn-to').fill('Bern');
  await page.getByRole('button', { name: 'Verbindungen suchen' }).click();
  await expect(page.locator('#conn-results .conn').first()).toBeVisible({ timeout: 30_000 });
}

// The service worker only serves the app's own files; block it here so page.route
// is guaranteed to see every timetable request.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('Favorit: Strecke merken, nach Neustart mit einem Tipp suchen, entfernen', async ({ page }, testInfo) => {
  await searchZurichBern(page);
  await page.getByRole('button', { name: '☆ Als Favorit merken' }).click();
  await expect(page.getByRole('button', { name: '★ Favorit' })).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await page.getByRole('tab', { name: 'Fahrplan' }).click();
  const chip = page.locator('#conn-favs').getByRole('button', { name: 'Zürich HB → Bern', exact: true });
  await expect(chip).toBeVisible();
  await expect(page.locator('#conn-results .conn')).toHaveCount(0);
  // the tap must really ask the timetable (no stored result to fall back on)
  await page.evaluate(() => localStorage.removeItem('sbb.last.conn'));
  const req = page.waitForRequest(/\/v1\/connections/);
  await chip.click(); // one tap: fills the form with "now" and searches
  await req;
  await expect(page.locator('#conn-results .conn').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#conn-results .stale')).toHaveCount(0);
  await expect(page.locator('#conn-from')).toHaveValue('Zürich HB');
  await shot(page, testInfo, '08-favorit-strecke');

  await page.locator('#conn-favs').getByRole('button', { name: 'Zürich HB → Bern entfernen' }).click();
  await expect(page.locator('#conn-favs')).toBeHidden();
  await page.reload();
  await expect(page.locator('#conn-favs')).toBeHidden();
});

test('Ohne Netz: letztes Ergebnis mit «Ohne Echtzeit, Stand hh:mm»', async ({ page }, testInfo) => {
  await searchZurichBern(page);
  const first = await page.locator('#conn-results .conn-times').first().innerText();

  // timetable API unreachable from now on
  await page.route(/transport\.opendata\.ch/, (r) => r.abort('internetdisconnected'));
  await page.locator('#conn-time').fill('23:59'); // a different request, so it must go to the network
  await page.getByRole('button', { name: 'Verbindungen suchen' }).click();
  const note = page.locator('#conn-results .stale');
  await expect(note).toContainText(/Ohne Echtzeit, Stand \d\d:\d\d/);
  // the note says which search the stored result belongs to (not the 23:59 one)
  await expect(note).toContainText(/Suche für \d\d\.\d\d\. \d\d:\d\d ab/);
  await expect(note).not.toContainText('23:59');
  await expect(page.locator('#conn-results .conn-times').first()).toHaveText(first);
  await shot(page, testInfo, '09-ohne-netz-letztes-ergebnis');

  // a route never searched before still gets the plain error
  await page.locator('#conn-to').fill('Chur');
  await page.getByRole('button', { name: 'Verbindungen suchen' }).click();
  await expect(page.locator('#conn-results .err')).toBeVisible();
  await expect(page.locator('#conn-results .stale')).toHaveCount(0);
});

test('Abfahrten: Haltestelle als Favorit, ohne Netz letztes Ergebnis', async ({ page }) => {
  await page.getByRole('tab', { name: 'Abfahrten' }).click();
  await page.locator('#board-station').fill('Bern');
  await page.getByRole('button', { name: 'Abfahrten anzeigen' }).click();
  await expect(page.locator('#board-results .board-row').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '☆ Als Favorit merken' }).click();

  await page.route(/transport\.opendata\.ch/, (r) => r.abort('internetdisconnected'));
  await page.reload();
  await page.getByRole('tab', { name: 'Abfahrten' }).click();
  // within 30 s the same request is answered locally; force the network path by clearing the timestamp
  await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('sbb.last.board'));
    l[0].at -= 60_000;
    localStorage.setItem('sbb.last.board', JSON.stringify(l));
  });
  await page.locator('#board-favs').getByRole('button', { name: 'Bern', exact: true }).click();
  await expect(page.locator('#board-results .stale')).toContainText('Ohne Echtzeit');
  await expect(page.locator('#board-results .board-row').first()).toBeVisible();
});

test('Langsame ältere Suche überschreibt die neuere nicht', async ({ page }) => {
  await page.getByRole('tab', { name: 'Fahrplan' }).click();
  // first request (to Chur) hangs for 4 s, the second (to Bern) answers normally
  await page.route(/\/v1\/connections.*to=Chur/, async (r) => { await new Promise((x) => setTimeout(x, 4000)); await r.continue(); });
  await page.locator('#conn-from').fill('Zürich HB');
  await page.locator('#conn-to').fill('Chur');
  await page.getByRole('button', { name: 'Verbindungen suchen' }).click();
  const churDone = page.waitForResponse(/\/v1\/connections.*to=Chur/, { timeout: 40_000 });
  await page.locator('#conn-to').fill('Bern');
  await page.getByRole('button', { name: 'Verbindungen suchen' }).click();
  await expect(page.locator('#conn-results .result-head')).toContainText('Zürich HB → Bern', { timeout: 30_000 });
  await churDone; // the older answer has arrived
  await page.waitForTimeout(500);
  await expect(page.locator('#conn-results .result-head')).toContainText('Zürich HB → Bern');
});

test('Gleiche Suche innerhalb 30 s fragt die API nicht erneut', async ({ page }) => {
  let calls = 0;
  page.on('request', (r) => { if (r.url().includes('/v1/connections')) calls++; });
  await searchZurichBern(page);
  await page.getByRole('button', { name: 'Verbindungen suchen' }).click();
  await expect(page.locator('#conn-results .conn').first()).toBeVisible();
  expect(calls).toBe(1);
});
