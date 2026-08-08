import test from 'node:test';
import assert from 'node:assert/strict';
import { __testables } from './worker.js';

const { buildRoleSelectorMessage, parseCustomId, resolveRoleChange, buildRsvpMessage, normalizeMemory, buildStatsMessage, buildWelcomeMessage, normalizeMatchDate, availabilityForDate, buildAvailabilitySummary, resolvePlayer, canManageAvailability } = __testables;

test('buildRoleSelectorMessage creates expanded Chaos Theory and Deep Rock role panels', () => {
  const message = buildRoleSelectorMessage();

  assert.match(message.content, /Third Echelon/);
  assert.equal(message.components.length, 4);
  assert.equal(message.components[0].components.length, 4);
  assert.equal(message.components[1].components.length, 3);
  assert.equal(message.components[2].components.length, 4);
  assert.equal(message.components[3].components.length, 4);
  assert.equal(message.components[2].components[0].custom_id, 'role:dwarf:scout');
  assert.equal(message.components[3].components[3].custom_id, 'role:beer:leaf-lovers');
  assert.match(message.content, /For Karl/i);
});

test('parseCustomId accepts only known role groups and choices', () => {
  assert.deepEqual(parseCustomId('role:team:mercs'), { group: 'team', choice: 'mercs' });
  assert.equal(parseCustomId('role:team:banana'), null);
  assert.equal(parseCustomId('delete:team:spies'), null);
});

test('resolveRoleChange adds selected role and removes the other roles in its group', () => {
  const action = resolveRoleChange('role:team:mercs');

  assert.equal(action.add.key, 'mercs');
  assert.deepEqual(action.remove.map(role => role.key), ['spies', 'double-agent', 'fisher-fanclub']);
});

test('resolveRoleChange keeps Deep Rock classes mutually exclusive', () => {
  const action = resolveRoleChange('role:dwarf:gunner');

  assert.equal(action.add.key, 'gunner');
  assert.deepEqual(action.remove.map(role => role.key), ['scout', 'driller', 'engineer']);
});

test('buildRsvpMessage keeps the fixed teams visible and provides RSVP controls', () => {
  const message = buildRsvpMessage();
  assert.match(message.content, /Kakan.*LogiMOX/i);
  assert.match(message.content, /Bjestavs.*Doxos/i);
  assert.equal(message.components[0].components.length, 3);
  assert.equal(message.components[0].components[0].custom_id, 'rsvp:in');
});

test('normalizeMemory rejects empty notes and limits stored memory text', () => {
  assert.equal(normalizeMemory('   '), null);
  assert.equal(normalizeMemory('  FOR KARL!  '), 'FOR KARL!');
  assert.equal(normalizeMemory('x'.repeat(600)).length, 500);
});

test('buildStatsMessage shows fixed teams and a remembered moment', () => {
  const message = buildStatsMessage({
    wins: { kakan_logimox: 2, bjestavs_doxos: 1 },
    memories: [{ text: 'Doxos gick vilse i ventilationsschaktet.', author: 'LogiMOX' }]
  });
  assert.match(message, /Kakan.*LogiMOX.*2/i);
  assert.match(message, /Bjestavs.*Doxos.*1/i);
  assert.match(message, /ventilationsschaktet/i);
});

test('buildWelcomeMessage welcomes all four players and explains the bot with a game joke', () => {
  const message = buildWelcomeMessage();
  for (const player of ['Kakan', 'LogiMOX', 'Bjestavs', 'Doxos']) assert.match(message, new RegExp(player, 'i'));
  for (const command of ['/rsvp', '/stats', '/resultat', '/minne', '/roles']) assert.match(message, new RegExp(command.replace('/', '\\/')));
  assert.match(message, /Sam Fisher|Rock and Stone|Karl|Molly/i);
});

test('availability defaults every mapped player to available and only marks explicit cancellations unavailable', () => {
  const date = normalizeMatchDate('2026-08-11');
  assert.equal(date, '2026-08-11');
  assert.equal(normalizeMatchDate('2026-8-11'), null);
  assert.equal(resolvePlayer('322841126476447744').name, 'Kakan');
  assert.equal(resolvePlayer('not-a-player'), null);
  const availability = availabilityForDate({ availability: { [date]: { '322841126476447744': { unavailable: true } } } }, date);
  assert.deepEqual(availability.available.map(player => player.name), ['LogiMOX', 'Bjestavs', 'Doxos']);
  assert.deepEqual(availability.unavailable.map(player => player.name), ['Kakan']);
});

test('buildAvailabilitySummary makes explicit unavailable players visible for Discord and web', () => {
  const summary = buildAvailabilitySummary({ available: [{ name: 'LogiMOX' }], unavailable: [{ name: 'Doxos' }] });
  assert.match(summary, /✅ LogiMOX/);
  assert.match(summary, /❌ Doxos/);
  assert.match(summary, /Standard: tillgänglig/i);
});

test('only LogiMOX can manage another player availability', () => {
  const logimox = resolvePlayer('151053160847376384');
  const kakan = resolvePlayer('322841126476447744');
  const doxos = resolvePlayer('284415770291732490');
  assert.equal(canManageAvailability(logimox, doxos), true);
  assert.equal(canManageAvailability(logimox, logimox), true);
  assert.equal(canManageAvailability(kakan, doxos), false);
  assert.equal(canManageAvailability(null, doxos), false);
});

