// Every file the service worker precaches must also be published to GitHub Pages,
// otherwise the live app breaks offline (install of the worker fails).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const root = path.join(__dirname, '..');

test('Deploy-Liste enthält alle Offline-Dateien', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-chromium', 'Dateiprüfung genügt einmal');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)]
    .map((m) => m[1]).filter(Boolean);
  const wf = fs.readFileSync(path.join(root, '.github/workflows/deploy-pages.yml'), 'utf8');
  const copied = wf.match(/cp (index\.html[^\n]*) _site\//)[1].split(/\s+/);
  const dirs = [...wf.matchAll(/cp -r (\S+) _site\//g)].map((m) => m[1]);
  for (const f of shell) {
    const ok = copied.includes(f) || dirs.some((d) => f.startsWith(d + '/'));
    expect(ok, `${f} fehlt im Deploy`).toBe(true);
    expect(fs.existsSync(path.join(root, f)), `${f} fehlt im Repo`).toBe(true);
  }
});
