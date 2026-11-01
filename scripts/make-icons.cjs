// Renders public/icon.svg to the PNG icons the PWA manifest and iOS need.
// Run: node scripts/make-icons.cjs  (needs Playwright with Chromium installed)
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const path = require('node:path');

(async () => {
  const pub = path.join(__dirname, '..', 'public');
  const svg = readFileSync(path.join(pub, 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:#0b0d12">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(pub, file) });
  }
  await browser.close();
})();
