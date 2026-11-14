// Playwright tests for the PWA, in iPhone format.
// Locally only Chromium is installed; CI also runs WebKit (the engine of iOS Safari).
const { defineConfig, devices } = require('@playwright/test');

const iphone = devices['iPhone 13'];
const projects = [
  { name: 'iphone-chromium', use: { ...iphone, browserName: 'chromium', defaultBrowserType: 'chromium' } },
];
if (process.env.CI || process.env.PW_WEBKIT) {
  projects.push({ name: 'iphone-webkit', use: { ...iphone } });
}
if (process.env.PW_CHROMIUM_PATH) {
  projects[0].use.launchOptions = { executablePath: process.env.PW_CHROMIUM_PATH };
}

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1, // be gentle with transport.opendata.ch
  reporter: [['list']],
  globalSetup: require.resolve('./tests/global-setup.js'),
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
    serviceWorkers: 'allow',
  },
  projects,
  webServer: {
    command: 'node tests/serve.js',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
  },
});
