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

test('page links PWA metadata, gives text-only install instructions, and registers offline worker', async () => {
  const page = await read('index.html');

  assert.match(page, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(page, /<link rel="apple-touch-icon" href="icons\/icon-180\.png">/);
  assert.match(page, /SAFARI → DELA → LÄGG TILL PÅ HEMSKÄRMEN/);
  assert.match(page, /CHROME → ⋮ → INSTALLERA APP/);
  assert.doesNotMatch(page, /id="installApp"/);
  assert.doesNotMatch(page, /beforeinstallprompt/);
  assert.match(page, /navigator\.serviceWorker\.register\('\.\/service-worker\.js'\)/);
});

test('web availability controls include a late RSVP action that writes Discord-compatible status', async () => {
  const page = await read('index.html');

  assert.match(page, /id="availabilityLate"/);
  assert.match(page, /MARKERA.*SOM SEN/);
  assert.match(page, /function setAvailabilityStatus\(status\)/);
  assert.match(page, /JSON\.stringify\(\{ status, playerId: targetId \}\)/);
});

test('map section places the randomize control with compact visible map cards', async () => {
  const page = await read('index.html');
  const styles = await read('style.css');

  assert.match(page, /<section class="panel maps"/);
  assert.match(page, /<button class="btn primary" type="button" id="randomizeMaps">⚙ SLUMPA BANOR<\/button>/);
  assert.match(page, /class="map-list map-list-compact"/);
  assert.match(styles, /\.maps-toolbar/);
  assert.match(styles, /\.map-list-compact/);
  assert.match(styles, /@media \(max-width:700px\).*\.map-list-compact\{grid-template-columns:1fr 1fr/s);
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
