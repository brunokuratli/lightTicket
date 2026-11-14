// Verbindungsdetail (Konzept Etappe 6), iPhone format.
// Golden test against a stored answer of transport.opendata.ch
// (Bern, Bundesplatz → Thun, 16.11.2026), changed by hand in one place:
// the IC 8 leaves from platform 7 instead of 6, 3 minutes late.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'connections-bern-bundesplatz-thun.json'), 'utf8');

async function shot(page, testInfo, name) {
  const dir = path.join(__dirname, '..', 'test-results', 'screenshots', testInfo.project.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
}

test.use({ serviceWorkers: 'block' });

test('Details: Teilstrecken, Gleise, Gleisänderung, Umsteigen, Zwischenhalte (gespeicherte Antwort)', async ({ page }, testInfo) => {
  await page.route(/\/v1\/connections/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: FIXTURE }));
  await page.route(/\/v1\/locations/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"stations":[]}' }));
  await page.goto('./');
  await page.getByRole('tab', { name: 'Fahrplan' }).click();
  await page.locator('#conn-from').fill('Bern, Bundesplatz');
  await page.locator('#conn-to').fill('Thun');
  await page.getByRole('button', { name: 'Verbindungen suchen' }).click();

  const card = page.locator('#conn-results .conn').first();
  await expect(card).toBeVisible();
  const detail = card.locator('.conn-detail');
  await expect(detail).toBeHidden();
  await card.getByRole('button', { name: 'Details' }).click();
  await expect(detail).toBeVisible();
  await expect(card.getByRole('button', { name: 'Details schliessen' })).toHaveAttribute('aria-expanded', 'true');

  // two rides, one walk between them
  const secs = detail.locator('.sec');
  await expect(secs).toHaveCount(2);
  await expect(secs.nth(0).locator('.leg')).toHaveText('B10');
  await expect(secs.nth(0)).toContainText('Richtung Schliern, Bus-Endstation');
  await expect(secs.nth(0).locator('.sec-stop').first()).toContainText('08:01');
  await expect(secs.nth(0).locator('.sec-stop').first()).toContainText('Bern, Bundesplatz');
  await expect(secs.nth(0).locator('.sec-stop').last()).toContainText('Bern, Bahnhof');
  await expect(secs.nth(0).locator('.sec-stop').last()).toContainText('Gleis I');
  await expect(detail.locator('.sec-walk')).toHaveText('Fussweg 5 min bis Bern');

  // platform change and delay are visible and marked
  const icDep = secs.nth(1).locator('.sec-stop').first();
  await expect(secs.nth(1).locator('.leg')).toHaveText('IC8');
  await expect(icDep).toContainText('08:07 +3');
  await expect(icDep.locator('.plat.changed')).toHaveText('Gleis 7 (statt 6) · Gleisänderung');
  await expect(secs.nth(1).locator('.sec-stop').last()).toContainText('08:26');
  await expect(secs.nth(1).locator('.sec-stop').last()).toContainText('Gleis 2');
  // the summary line of the card also shows the change of the first departure? (first ride is the bus: no)
  await expect(card.locator('.conn-sub .plat.changed')).toHaveCount(0);

  // transfer time: bus arrives 08:02, IC leaves 08:10 (real time) → 8 min
  await expect(detail.locator('.sec-change')).toHaveText('Umsteigen: 8 min');

  // intermediate stops, folded
  const s1 = page.locator('#conn-results .conn').nth(1);
  await s1.getByRole('button', { name: 'Details' }).click();
  const pass = s1.locator('.sec-pass');
  await expect(pass.locator('summary')).toHaveText('8 Zwischenhalte');
  await expect(pass.locator('li').first()).toBeHidden();
  await pass.locator('summary').click();
  await expect(pass.locator('li').first()).toBeVisible();
  await expect(pass.locator('li')).toHaveCount(8);
  await shot(page, testInfo, '11-verbindungsdetail');

  // platform name and «Gleisänderung» do not overlap the station name at 390 px
  const boxes = await icDep.evaluate((n) => ['.sec-name', '.plat'].map((c) => n.querySelector(c).getBoundingClientRect().toJSON()));
  const [nm, pl] = boxes;
  const overlap = nm.left < pl.right && pl.left < nm.right && nm.top < pl.bottom && pl.top < nm.bottom;
  expect(overlap).toBe(false);

  // closing again
  await card.getByRole('button', { name: 'Details schliessen' }).click();
  await expect(detail).toBeHidden();
});

test('Details live: Zürich HB → Bern', async ({ page }, testInfo) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Fahrplan' }).click();
  await page.locator('#conn-from').fill('Zürich HB');
  await page.locator('#conn-to').fill('Bern');
  await page.getByRole('button', { name: 'Verbindungen suchen' }).click();
  const card = page.locator('#conn-results .conn').first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole('button', { name: 'Details' }).click();
  const sec = card.locator('.conn-detail .sec').first();
  await expect(sec.locator('.sec-stop').first()).toContainText('Zürich HB');
  await expect(sec.locator('.sec-stop').first()).toContainText(/Gleis \w+/);
  await expect(card.locator('.conn-detail .sec').last().locator('.sec-stop').last()).toContainText('Bern');
  await shot(page, testInfo, '12-verbindungsdetail-live');
});

test('Details: Gleisänderung in der Kurzzeile, verpasster Anschluss, fehlende Zeiten', async ({ page }) => {
  const data = JSON.parse(FIXTURE);
  const c = data.connections[0];
  // first departure (bus) moved to platform C
  c.from.platform = 'B'; c.from.prognosis = { ...c.from.prognosis, platform: 'C' };
  c.sections[0].departure.platform = 'B'; c.sections[0].departure.prognosis.platform = 'C';
  // bus arrives late at 08:15 → the IC at 08:10 is missed
  c.sections[0].arrival.prognosis.arrival = '2026-11-16T08:15:00+0100';
  // a stop without any time is left out instead of showing a wrong one
  const pl = data.connections[1].sections[1].journey.passList;
  pl[1].arrival = null; pl[1].departure = null;
  // a walk without duration and times shows no absurd number
  const walk = data.connections[1].sections[0];
  walk.walk.duration = null; walk.departure.departure = null;
  await page.route(/\/v1\/connections/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }));
  await page.route(/\/v1\/locations/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"stations":[]}' }));
  await page.goto('./');
  await page.getByRole('tab', { name: 'Fahrplan' }).click();
  await page.locator('#conn-from').fill('Bern, Bundesplatz');
  await page.locator('#conn-to').fill('Thun');
  await page.getByRole('button', { name: 'Verbindungen suchen' }).click();

  const card = page.locator('#conn-results .conn').first();
  await expect(card.locator('.conn-sub .plat.changed')).toHaveText('Gleis C (statt B) · Gleisänderung');
  await card.getByRole('button', { name: 'Details' }).click();
  await expect(card.locator('.sec-change')).toHaveText('Anschluss gefährdet (Ankunft nach Abfahrt)');

  const s1 = page.locator('#conn-results .conn').nth(1);
  await s1.getByRole('button', { name: 'Details' }).click();
  await expect(s1.locator('.sec-pass summary')).toHaveText('7 Zwischenhalte');
  await expect(s1.locator('.sec-walk')).toHaveText('Fussweg bis Bern');
  await expect(s1.locator('.conn-detail')).not.toContainText('01:00');
});
