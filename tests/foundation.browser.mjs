/* File name: tests/foundation.browser.mjs — Chromium UI checks with a real SQL backend and mocked models. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
process.env.RYC_BROWSER_FIXTURES = '1';
const { installed, storageHarness } = await import('./foundation.test.mjs');
import { ExtremeCase } from '../extreme-worker.js';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright')); }
await mkdir('test-results', { recursive: true });
const initial = await installed(), map = new Map([[initial.caseId, initial.server]]);
const http = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const bytes = await readFile(join(new URL('../', import.meta.url).pathname, path === '/' ? 'index.html' : path));
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[extname(path)] || 'application/octet-stream'); res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => http.listen(8081, '127.0.0.1', resolve));
let browser;
try {
browser = await chromium.launch({ headless: true, timeout: 15000, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext(); context.setDefaultTimeout(15000); context.setDefaultNavigationTimeout(15000);
let loseNext = false;
await context.route('https://rest-your-case.spacexmzez.workers.dev/extreme', async route => {
  const input = route.request().postDataJSON();
  if (!map.has(input.caseId)) {
    const h = storageHarness(), server = new ExtremeCase(h.ctx, {}); await h.ready;
    server.ai = initial.server.ai; map.set(input.caseId, server);
  }
  const response = await map.get(input.caseId).fetch(new Request('https://fixture/', { method: 'POST', headers: route.request().headers(), body: JSON.stringify(input) }));
  if (loseNext && input.op === 'action') { loseNext = false; await route.abort('failed'); return; }
  await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
});
await context.route('https://cdn.tailwindcss.com/**', route => route.abort());
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
console.log('Browser: opening terminal'); await page.goto('http://127.0.0.1:8081/extreme.html');
await page.waitForFunction(() => window.RYCExtreme);
const standard = '{"hasActiveCase":true,"profile":{"title":"Preserve Standard"},"notes":"DO NOT CHANGE","complexity":3}';
await page.evaluate(async ({ c, capability, standard }) => {
  localStorage.setItem('ryc_language', 'en'); localStorage.setItem('rest_your_case_state', standard);
  localStorage.setItem('ryc_pending_cases', '[{"id":"standard-pending"}]'); localStorage.setItem('ryc_shelf_cases', '[{"id":"standard-shelf"}]');
  const db = await RYCExtreme.db();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['cases', 'meta', 'drafts'], 'readwrite');
    tx.objectStore('cases').put({ caseId: c, capability, createdAt: Date.now(), lifecycle: 'active', localRevision: 0, lastSyncedSeq: 0 });
    tx.objectStore('meta').put({ name: 'activeCaseId', value: c });
    tx.objectStore('drafts').put({ caseId: c, channel: 'compose', recipientId: 'CLIENT', text: 'Previously saved draft' });
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}, { c: initial.caseId, capability: initial.capability, standard });
console.log('Browser: seeded storage, reloading'); await page.reload(); await page.waitForSelector('#ex-terminal:not([hidden])');
assert.equal(await page.locator('#ex-message').inputValue(), 'Previously saved draft');
console.log('Browser: accepting fixture'); await page.getByRole('button', { name: 'Accept case', exact: true }).click();
await page.waitForSelector('#ex-phase-buttons button:has-text("Begin trial")');
console.log('Browser: starting trial'); await page.getByRole('button', { name: 'Begin trial', exact: true }).click();
await page.waitForFunction(() => document.getElementById('ex-hud').textContent.includes('trial'));
await page.getByRole('button', { name: 'Witnesses', exact: true }).click();
await page.getByRole('button', { name: 'Call witness', exact: true }).first().click();
await page.waitForFunction(() => document.getElementById('ex-stand').textContent.includes('Person 0'));
await page.getByRole('button', { name: 'Court', exact: true }).click();
await page.locator('#ex-message').fill('Question about the original bank record.'); await page.waitForTimeout(250);
loseNext = true;
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.waitForSelector('#ex-pending:not([hidden])');
const afterLost = initial.server.meta('caseState');
await page.getByRole('button', { name: 'Check status', exact: true }).click();
await page.waitForSelector('#ex-pending[hidden]');
assert.equal(initial.server.meta('caseState').revision, afterLost.revision);
assert.equal(await page.evaluate(() => localStorage.getItem('rest_your_case_state')), standard);
await page.getByRole('button', { name: 'Notes', exact: true }).click();
await context.setOffline(true);
await page.locator('#ex-notes').fill('Offline notes remain private.'); await page.waitForTimeout(400);
const notes = await page.evaluate(async () => (await RYCExtreme.all('notes'))[0].text); assert.equal(notes, 'Offline notes remain private.');
await context.setOffline(false);
await page.locator('#ex-language').click(); assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: process.env.RYC_BROWSER_SCREENSHOT || 'test-results/extreme-mobile.png', fullPage: true });
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await page.locator('#ex-language').click();
await page.locator('#ex-menu').click(); assert.ok(await page.getByRole('link', { name: 'Extreme terminal', exact: true }).isVisible());
await page.getByRole('button', { name: 'Close menu', exact: true }).click();
await page.goto('http://127.0.0.1:8081/shelf.html?mode=extreme');
await page.waitForSelector('#ex-shelf .ex-card');
assert.equal(await page.locator('#ex-standard-panel').isVisible(), false);
const activeBefore = await page.evaluate(async () => (await RYCExtreme.read('meta', 'activeCaseId')).value);
await page.getByRole('button', { name: 'Standard', exact: true }).click();
assert.equal(await page.locator('#ex-standard-panel').isVisible(), true);
assert.equal(await page.evaluate(async () => (await RYCExtreme.read('meta', 'activeCaseId')).value), activeBefore);
await page.getByRole('button', { name: 'Extreme', exact: true }).click();
await page.getByRole('button', { name: 'Generate Extreme brief', exact: true }).click();
await page.locator('#ex-dialog select').nth(1).selectOption('robbery');
await page.getByRole('button', { name: 'Generate', exact: true }).click();
await page.waitForSelector('#ex-dialog h2:has-text("Review brief")');
await page.getByRole('button', { name: 'Accept case', exact: true }).click();
await page.waitForSelector('#ex-dialog h2:has-text("Purge case")');
await page.locator('#ex-dialog input').fill('Fixture bank case');
await page.getByRole('button', { name: 'Permanently delete', exact: true }).click();
await page.waitForSelector('#ex-dialog h2:has-text("Confirm permanent deletion")');
assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Keep case');
await page.getByRole('button', { name: 'Permanently delete', exact: true }).click();
await page.waitForURL('**/extreme.html?caseId=*');
await page.waitForSelector('#ex-terminal:not([hidden])');
assert.equal(initial.server.meta('blueprint'), null);
assert.equal(await page.evaluate(() => localStorage.getItem('rest_your_case_state')), standard);
const newServer = map.get(new URL(page.url()).searchParams.get('caseId')); assert.equal(newServer.meta('caseState').stage, 'preparation');
await page.screenshot({ path: 'test-results/extreme-desktop.png', fullPage: true });
console.log('BROWSER PASSED: draft resume, playable actions, response loss, offline notes, RTL/mobile, navigation, mode isolation, generation and destructive replacement.');
console.log('PAGE ERRORS:', errors);
assert.deepEqual(errors, []);
} finally { await browser?.close(); await new Promise(resolve => http.close(resolve)); }
