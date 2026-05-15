import { chromium } from 'playwright';
const url = process.argv[2];
const [w, h] = process.argv[3].split('x').map(Number);
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const body = document.body;
  const doc = document.documentElement;
  const scrollH = Math.max(body.scrollHeight, doc.scrollHeight);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity || '1') > 0;
  };
  function snapshot(el, depth = 0) {
    if (depth > 4) return null;
    const tag = el.tagName?.toLowerCase();
    if (!tag) return null;
    const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : '';
    const id = el.id || '';
    const r = el.getBoundingClientRect();
    const vis = visible(el);
    const children = [...el.children].map(c => snapshot(c, depth + 1)).filter(Boolean);
    return {
      tag, id, cls,
      box: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
      vis,
      text: el.children.length === 0 ? (el.textContent || '').trim().slice(0, 80) : null,
      children: children.length ? children : undefined,
    };
  }
  return {
    title: document.title,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    scrollHeight: scrollH,
    bodyClass: body.className,
    tree: snapshot(body),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
