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

test('page links PWA metadata, gives a brief app note, and registers offline worker', async () => {
  const page = await read('index.html');

  assert.match(page, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(page, /<link rel="apple-touch-icon" href="icons\/icon-180\.png">/);
  assert.match(page, /TILLGÄNGLIG SOM APP/);
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

test('single-page tabs provide overview, availability, maps, and all-day scheduling', async () => {
  const page = await read('index.html');
  const styles = await read('style.css');

  for (const tab of ['overview', 'availability', 'maps', 'schedule']) {
    assert.match(page, new RegExp(`data-tab="${tab}"`));
    assert.match(page, new RegExp(`id="panel-${tab}"`));
  }
  assert.match(page, /function activateTab\(tabName\)/);
  assert.match(page, /id="dayDate"/);
  assert.match(page, /id="dayTime"/);
  assert.match(styles, /\.tab-bar/);
});

test('overview is compact with a single-row countdown, brief app note, and scanner backdrop', async () => {
  const page = await read('index.html');
  const styles = await read('style.css');

  assert.match(page, /class="radar-scan"/);
  assert.match(page, /TILLGÄNGLIG SOM APP/);
  assert.doesNotMatch(page, /HANTERA RSVP/);
  assert.doesNotMatch(page, /VÄLJ BANOR/);
  assert.match(styles, /\.countdown-panel\.compact/);
  assert.match(styles, /\.radar-scan/);
  assert.match(styles, /@media \(max-width:700px\).*\.countdown-panel\.compact \.grid\{grid-template-columns:repeat\(4,1fr\)/s);
});

test('Discord publishing appears below the map selection, not in overview actions', async () => {
  const page = await read('index.html');

  const mapPanel = page.indexOf('id="panel-maps"');
  const postButton = page.indexOf('id="postDiscord"');
  assert.ok(mapPanel >= 0 && postButton > mapPanel);
  assert.doesNotMatch(page.slice(0, mapPanel), /id="postDiscord"/);
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
