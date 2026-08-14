import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('.', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('PWA metadata declares standalone GubbSplinta and PNG icons', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));

  assert.equal(manifest.name, 'GubbSplinta Countdown');
  assert.equal(manifest.short_name, 'GubbSplinta');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.src === 'icons/icon-192.png' && icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.src === 'icons/icon-512.png' && icon.sizes === '512x512'));
});

test('page links its PWA metadata, installation UI, and offline worker', async () => {
  const page = await read('index.html');

  assert.match(page, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(page, /<link rel="apple-touch-icon" href="icons\/icon-180\.png">/);
  assert.match(page, /id="installApp"/);
  assert.match(page, /navigator\.serviceWorker\.register\('\.\/service-worker\.js'\)/);
});

test('service worker precaches the app shell and falls back to its cached page', async () => {
  const worker = await read('service-worker.js');

  assert.match(worker, /manifest\.webmanifest/);
  assert.match(worker, /index\.html/);
  assert.match(worker, /caches\.match\('\.\/index\.html'\)/);
});

for (const size of [180, 192, 512]) {
  test(`icon-${size} is a PNG`, async () => {
    const icon = await readFile(new URL(`icons/icon-${size}.png`, root));
    assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  });
}
