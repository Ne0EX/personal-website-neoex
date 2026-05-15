import { chromium } from 'playwright';
const url = process.argv[2];
const out = process.argv[3];
const [w, h] = process.argv[4].split('x').map(Number);
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });

// Wait for any <canvas> to appear
try {
  await page.waitForSelector('canvas', { timeout: 8000 });
  console.log('canvas detected');
} catch (e) {
  console.log('NO canvas appeared within 8s');
}

// Give Three.js a long beat to render at least one frame
await page.waitForTimeout(6000);

// Force-trigger entry-card opacity animations (scroll once to top to settle)
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);

const canvasInfo = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return { found: false };
  const r = c.getBoundingClientRect();
  return {
    found: true,
    box: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    width: c.width, height: c.height,
    style: c.getAttribute('style')?.slice(0, 200),
  };
});
console.log('canvas:', JSON.stringify(canvasInfo));

await page.screenshot({ path: out, fullPage: false });
console.log('saved', out);
await browser.close();
