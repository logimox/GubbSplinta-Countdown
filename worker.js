const DISCORD_API = 'https://discord.com/api/v10';
const PLAYERS = [
  { id: '322841126476447744', name: 'Kakan' },
  { id: '151053160847376384', name: 'LogiMOX' },
  { id: '877991544941076542', name: 'Bjestavs' },
  { id: '284415770291732490', name: 'Doxos' }
];

const ROLE_GROUPS = {
  team: {
    spies: { key: 'spies', label: 'Ventilationsnisse', emoji: '🕵️', description: 'Du smyger in, stjäl intel och ber om ursäkt till luftkanalen.' },
    mercs: { key: 'mercs', label: 'Ficklampsfascist', emoji: '🔦', description: 'Du har en minigun, en lampa och exakt noll tålamod för mörker.' },
    'double-agent': { key: 'double-agent', label: 'Misstänkt Dubbelagent', emoji: '🃏', description: 'Alla litar på dig. Vilket är exakt problemet.' },
    'fisher-fanclub': { key: 'fisher-fanclub', label: 'Sam Fisher Fanclub', emoji: '🥽', description: 'Tre gröna lampor, noll knäproblem — absolut helt realistiskt.' }
  },
  mode: {
    chaos: { key: 'chaos', label: 'Grön-Lamps-Syndikatet', emoji: '🟢', description: 'Chaos Theory, men med 34 % fler skuggor och 100 % fler ljuddämpare.' },
    versus: { key: 'versus', label: 'Spion mot Ficklampa', emoji: '⚔️', description: 'Diplomati är inställd. Batterierna är laddade.' },
    'svm-veteran': { key: 'svm-veteran', label: 'SvM-Pensionär', emoji: '🪑', description: 'Minns när Mercs såg något på skärmen och kallade det taktik.' }
  },
  dwarf: {
    scout: { key: 'scout', label: 'Fackel-Influencer', emoji: '🔫', description: 'Lyser upp grottan och glömmer sedan var laget är.' },
    gunner: { key: 'gunner', label: 'Bly-Sommelier', emoji: '💥', description: 'Noter av krut, bly och en subtil eftersmak av panik.' },
    driller: { key: 'driller', label: 'Geologisk Olycka', emoji: '⛏️', description: 'Genväg? Javisst. Vägg? Inte längre.' },
    engineer: { key: 'engineer', label: 'Plattformskonsult', emoji: '🛠️', description: 'Löser allt med en plattform. Även känslor, troligen.' }
  },
  beer: {
    'for-karl': { key: 'for-karl', label: 'FOR KARL!', emoji: '🍺', description: 'Du vet inte varför vi ropar, men du ropar högst.' },
    'rock-and-stone': { key: 'rock-and-stone', label: 'Rock and Stone!', emoji: '✊', description: 'Certifierad dvärg. HR godkänner det motvilligt.' },
    'molly-union': { key: 'molly-union', label: 'Mollys Fackombud', emoji: '🐴', description: 'M.U.L.E. förtjänar raster, lönepåslag och färre sprängradier.' },
    'leaf-lovers': { key: 'leaf-lovers', label: 'Leaf Lover (misstänkt)', emoji: '🌿', description: 'Det sägs att du beställer sallad på Abyss Bar. Utredning pågår.' }
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    if (url.pathname === '/interactions') return handleDiscordInteraction(request, env);
    if (url.pathname === '/post-maps') return handleMapPost(request, env);
    if (url.pathname === '/auth/discord') return beginDiscordLogin(url, env);
    if (url.pathname === '/auth/discord/callback') return finishDiscordLogin(url, env);
    if (url.pathname === '/auth/magic') return beginMagicLogin(url, env);
    if (url.pathname === '/auth/status') return authStatus(request, env);
    if (url.pathname === '/availability') return handleAvailability(request, env, url);
    return json({ error: 'Not found' }, 404);
  }
};

function workerOrigin(url) { return `${url.protocol}//${url.host}`; }
function siteOrigin(env) { return env.SITE_ORIGIN || 'https://logimox.github.io'; }
function availabilityHeaders() { return { ...corsHeaders(), 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Cache-Control': 'no-store' }; }
function bearerToken(request) { const value = request.headers.get('Authorization') || ''; return value.startsWith('Bearer ') ? value.slice(7) : ''; }
async function digest(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
async function createSession(env, player) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await env.GUBBSPLINTA_STATE.put(`session:${await digest(token)}`, JSON.stringify({ id: player.id, expires: Date.now() + 1000 * 60 * 60 * 24 * 30 }), { expirationTtl: 60 * 60 * 24 * 30 });
  return token;
}
async function sessionPlayer(request, env) {
  const token = bearerToken(request);
  if (!token || !env.GUBBSPLINTA_STATE) return null;
  const session = await env.GUBBSPLINTA_STATE.get(`session:${await digest(token)}`, 'json');
  return session?.expires > Date.now() ? resolvePlayer(session.id) : null;
}
function redirectToSite(env, token, error = '') {
  const url = new URL(`${siteOrigin(env)}/GubbSplinta-Countdown/`);
  if (token) url.hash = `auth=${encodeURIComponent(token)}`;
  if (error) url.hash = `error=${encodeURIComponent(error)}`;
  return Response.redirect(url.toString(), 302);
}
async function beginDiscordLogin(url, env) {
  if (!env.DISCORD_OAUTH_CLIENT_ID || !env.DISCORD_OAUTH_CLIENT_SECRET || !env.GUBBSPLINTA_STATE) return json({ error: 'Discord OAuth is not configured' }, 503);
  const state = crypto.randomUUID();
  await env.GUBBSPLINTA_STATE.put(`oauth:${state}`, '1', { expirationTtl: 600 });
  const callback = `${workerOrigin(url)}/auth/discord/callback`;
  const login = new URL('https://discord.com/oauth2/authorize');
  login.searchParams.set('client_id', env.DISCORD_OAUTH_CLIENT_ID);
  login.searchParams.set('redirect_uri', callback);
  login.searchParams.set('response_type', 'code');
  login.searchParams.set('scope', 'identify');
  login.searchParams.set('state', state);
  return Response.redirect(login.toString(), 302);
}
async function finishDiscordLogin(url, env) {
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!state || !code || !(await env.GUBBSPLINTA_STATE.get(`oauth:${state}`))) return redirectToSite(env, '', 'Inloggningen gick ut — prova igen.');
  await env.GUBBSPLINTA_STATE.delete(`oauth:${state}`);
  const callback = `${workerOrigin(url)}/auth/discord/callback`;
  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.DISCORD_OAUTH_CLIENT_ID, client_secret: env.DISCORD_OAUTH_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: callback }).toString() });
  if (!tokenResponse.ok) return redirectToSite(env, '', 'Discord nekade inloggningen.');
  const { access_token } = await tokenResponse.json();
  const meResponse = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!meResponse.ok) return redirectToSite(env, '', 'Kunde inte läsa Discord-kontot.');
  const player = resolvePlayer((await meResponse.json()).id);
  if (!player) return redirectToSite(env, '', 'Detta Discord-konto är inte en av de fyra spelarna.');
  return redirectToSite(env, await createSession(env, player));
}
async function beginMagicLogin(url, env) {
  const token = url.searchParams.get('token') || '';
  if (!token || !env.GUBBSPLINTA_STATE) return redirectToSite(env, '', 'Ogiltig snabb-länk.');
  const playerId = await env.GUBBSPLINTA_STATE.get(`magic:${await digest(token)}`);
  const player = resolvePlayer(playerId);
  if (!player) return redirectToSite(env, '', 'Ogiltig eller återkallad snabb-länk.');
  return redirectToSite(env, await createSession(env, player));
}
async function authStatus(request, env) {
  const player = await sessionPlayer(request, env);
  return new Response(JSON.stringify({ player: player ? { id: player.id, name: player.name } : null }), { headers: { 'Content-Type': 'application/json', ...availabilityHeaders() } });
}
async function handleAvailability(request, env, url) {
  const date = normalizeMatchDate(url.searchParams.get('date'));
  if (!date) return json({ error: 'date must be YYYY-MM-DD' }, 400);
  const state = await readState(env);
  if (request.method === 'GET') return new Response(JSON.stringify({ date, ...availabilityForDate(state, date) }), { headers: { 'Content-Type': 'application/json', ...availabilityHeaders() } });
  if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
  const player = await sessionPlayer(request, env);
  if (!player) return json({ error: 'Logga in med Discord eller din privata snabb-länk.' }, 401);
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === 'string' ? body.status : body.unavailable === true ? 'out' : body.unavailable === false ? 'in' : '';
  if (!['in', 'late', 'out'].includes(status)) return json({ error: 'status must be in, late, or out' }, 400);
  const target = resolvePlayer(body.playerId || player.id);
  if (!target) return json({ error: 'Okänd spelare.' }, 400);
  if (!canManageAvailability(player, target)) return json({ error: 'Du kan bara ändra din egen tillgänglighet.' }, 403);
  // The website and Discord write the same three RSVP states for the same match date.
  await setRsvp(env, { id: target.id, global_name: target.name, username: target.name }, status, date);
  const latest = await readState(env);
  return new Response(JSON.stringify({ date, player: target, actor: player, ...availabilityForDate(latest, date) }), { headers: { 'Content-Type': 'application/json', ...availabilityHeaders() } });
}

async function handleDiscordInteraction(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.DISCORD_PUBLIC_KEY || !env.DISCORD_BOT_TOKEN) return json({ error: 'Discord bot secrets are not configured' }, 500);
  if (!(await isValidDiscordRequest(request, env.DISCORD_PUBLIC_KEY))) return json({ error: 'Bad request signature' }, 401);

  const interaction = await request.json();
  if (interaction.type === 1) return discordResponse({ type: 1 }); // Discord ping

  if (interaction.type === 2) return handleApplicationCommand(interaction, env);

  if (interaction.type === 3) {
    const action = resolveRoleChange(interaction.data?.custom_id);
    if (action) {
      try {
        const roleIds = roleIdsFromEnv(env);
        await applyRoleChange(env, interaction.guild_id, interaction.member?.user?.id || interaction.user?.id, action, roleIds);
        return discordResponse(ephemeral(`${action.add.emoji} **${action.add.label}** aktiverad. ${action.add.description}`));
      } catch (error) {
        console.error(error);
        return discordResponse(ephemeral('Rollterminalen fick ett panikartat ljusfel. Be en admin kontrollera botbehörighet och roll-ID:n.'));
      }
    }
    if (interaction.data?.custom_id?.startsWith('rsvp:')) {
      const [, status, dateText] = interaction.data.custom_id.split(':');
      const date = normalizeMatchDate(dateText) || nextTuesdayDate();
      if (!['in', 'late', 'out'].includes(status)) return discordResponse(ephemeral('Okänd RSVP-signal.'));
      const user = interaction.member?.user || interaction.user;
      // Discord buttons and the website write to the same match-date RSVP box.
      await setRsvp(env, user, status, date);
      // Type 7 redraws the same shared Discord panel, so everyone sees the new answer.
      return discordResponse(rsvpInteractionResponse(status, availabilityForDate(await readState(env), date), date));
    }
    return discordResponse(ephemeral('Den knappen verkar ha blivit komprometterad av en lampa. Prova panelen igen.'));
  }

  return discordResponse(ephemeral('Okänd Third Echelon-signal.'));
}

async function handleApplicationCommand(interaction, env) {
  const name = interaction.data?.name;
  if (name === 'roles') return discordResponse({ type: 4, data: { content: '## Third Echelon × Deep Rock: rollterminal\nVälj en roll i varje rad. Ett nytt val ersätter det gamla i samma grupp — även Fisher och Karl har begränsad hattkapacitet.\n\n**ROCK AND STONE! FOR KARL!**', components: buildRoleSelectorMessage().components, flags: 64 } });
  if (name === 'rsvp') {
    const date = nextTuesdayDate();
    return discordResponse({ type: 4, data: buildRsvpMessage(buildAvailabilitySummary(availabilityForDate(await readState(env), date)), date) });
  }
  if (name === 'välkommen') return discordResponse({ type: 4, data: { content: buildWelcomeMessage() } });
  if (name === 'stats') {
    const [state, historic] = await Promise.all([readState(env), loadHistoricStats(env)]);
    return discordResponse({ type: 4, data: { content: buildStatsMessage(state, historic) } });
  }
  if (name === 'minne') {
    const text = normalizeMemory(interaction.data?.options?.find(option => option.name === 'text')?.value);
    if (!text) return discordResponse(ephemeral('Skriv ett minne på 1–500 tecken.'));
    const state = await readState(env);
    state.memories.unshift({ text, author: interaction.member?.user?.global_name || interaction.member?.user?.username || 'Okänd', at: new Date().toISOString() });
    state.memories = state.memories.slice(0, 20);
    await writeState(env, state);
    return discordResponse(ephemeral('📼 Minnet är arkiverat i GubbSplinta-valvet.'));
  }
  if (name === 'resultat') {
    const winner = interaction.data?.options?.find(option => option.name === 'vinnare')?.value;
    if (!['kakan_logimox', 'bjestavs_doxos'].includes(winner)) return discordResponse(ephemeral('Välj ett av de fasta lagen.'));
    const state = await readState(env);
    state.wins[winner] += 1;
    await writeState(env, state);
    return discordResponse({ type: 4, data: { content: `🏆 Resultat registrerat: **${teamLabel(winner)}**.\n\n${buildStatsMessage(state)}` } });
  }
  return discordResponse(ephemeral('Okänd GubbSplinta-signal.'));
}

function buildWelcomeMessage() {
  return [
    '## 🥽 Välkomna till GubbSplinta Command Center',
    '',
    '**Kakan + LogiMOX** är det gröna laget: skuggor, teamwork och förhoppningsvis färre oavsiktliga granater.',
    '**Bjestavs + Doxos** är det blå laget: motståndare, rivaler och statistiskt misstänkta ficklampsbärare.',
    '',
    '**Så här överlever ni administrationen:**',
    '• `/rsvp` — svara om ni är med, sena eller borta nästa match.',
    '• `/stats` — se lagens vinster, RSVP-svar och senaste arkiverade dumhet.',
    '• `/resultat` — registrera vilket fast lag som faktiskt vann.',
    '• `/minne` — spara ett citat, haveri eller taktiskt mästerverk i valvet.',
    '• `/roles` — välj era Splinter Cell- och Deep Rock-roller.',
    '',
    '> “Rock and Stone!” — den juridiskt bindande bekräftelsen på att planering är frivillig.',
    'Sam Fisher rekommenderar mörkerdisciplin. Molly rekommenderar att ni slutar stå i vägen. Båda har rätt.'
  ].join('\n');
}

function nextTuesdayDate(now = new Date()) {
  const date = new Date(now);
  const days = (2 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + days + (days === 0 && date.getHours() >= 20 ? 7 : 0));
  return date.toISOString().slice(0, 10);
}
function buildRsvpMessage(availability = '', date = nextTuesdayDate()) {
  return {
    content: `## GubbSplinta RSVP\n**Fasta lag**\n🟢 Kakan + LogiMOX\n🔵 Bjestavs + Doxos\n\nSvara för nästa match. Statusen sparas och visas med \`/stats\`.${date ? `\n\n**Matchdatum:** ${date}` : ''}${availability ? `\n\n${availability}` : ''}`,
    components: [{ type: 1, components: [
      { type: 2, style: 3, label: 'Jag är med', emoji: { name: '✅' }, custom_id: `rsvp:in:${date}` },
      { type: 2, style: 1, label: 'Sen', emoji: { name: '⏱️' }, custom_id: `rsvp:late:${date}` },
      { type: 2, style: 4, label: 'Kan inte', emoji: { name: '❌' }, custom_id: `rsvp:out:${date}` }
    ] }]
  };
}

function normalizeMemory(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/[@`]/g, '');
  return text ? text.slice(0, 500) : null;
}

function teamLabel(key) { return key === 'kakan_logimox' ? 'Kakan + LogiMOX' : 'Bjestavs + Doxos'; }
function normalizeMatchDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function resolvePlayer(discordId) { return PLAYERS.find(player => player.id === String(discordId)) || null; }
function canManageAvailability(actor, target) { return Boolean(actor && target && (actor.id === target.id || actor.id === '151053160847376384')); }
function rsvpForDate(state, date) {
  // New answers live under the date. These fallbacks gently understand old saved answers too.
  if (state?.rsvps?.[date]) return state.rsvps[date];
  const oldCancellations = state?.availability?.[date] || {};
  if (Object.keys(oldCancellations).length) return Object.fromEntries(Object.keys(oldCancellations).map(id => [id, { status: 'out' }]));
  const oldRsvps = state?.rsvps || {};
  // Old answers had no date. They belong only to the currently upcoming Tuesday,
  // never to a later match.
  return date === nextTuesdayDate() && Object.values(oldRsvps).some(value => value?.status) ? oldRsvps : {};
}
function availabilityForDate(state, date) {
  const answers = rsvpForDate(state, date);
  const unavailable = PLAYERS.filter(player => answers[player.id]?.status === 'out');
  const late = PLAYERS.filter(player => answers[player.id]?.status === 'late');
  return { available: PLAYERS.filter(player => answers[player.id]?.status !== 'out'), unavailable, late };
}
function buildAvailabilitySummary({ available, unavailable, late = [] }) {
  const yes = available.length ? available.map(player => `✅ ${player.name}`).join(', ') : '_Ingen_';
  const lateList = late.length ? late.map(player => `⏱️ ${player.name}`).join(', ') : '_Ingen_';
  const no = unavailable.length ? unavailable.map(player => `❌ ${player.name}`).join(', ') : '_Ingen_';
  return `**Tillgänglighet** _(standard: tillgänglig om man inte avbokar)_\n${yes}\n\n**Sen**\n${lateList}\n\n**Kan inte**\n${no}`;
}
function emptyState() { return { wins: { kakan_logimox: 0, bjestavs_doxos: 0 }, rsvps: {}, memories: [], availability: {} }; }
async function readState(env) {
  if (!env.GUBBSPLINTA_STATE) return emptyState();
  const state = await env.GUBBSPLINTA_STATE.get('state', 'json');
  return { ...emptyState(), ...state, wins: { ...emptyState().wins, ...(state?.wins || {}) }, rsvps: state?.rsvps || {}, memories: state?.memories || [] };
}
async function writeState(env, state) { if (env.GUBBSPLINTA_STATE) await env.GUBBSPLINTA_STATE.put('state', JSON.stringify(state)); }
async function setRsvp(env, user, status, date = nextTuesdayDate()) {
  const state = await readState(env);
  // One folder per match date means Discord and the website always read the same answer.
  state.rsvps[date] ||= {};
  state.rsvps[date][user.id] = { name: user.global_name || user.username || 'Okänd', status, at: new Date().toISOString() };
  await writeState(env, state);
}
function rsvpConfirmation(status) { return ({ in: '✅ Du är markerad som **med**.', late: '⏱️ Du är markerad som **sen**.', out: '❌ Du är markerad som **kan inte**.' })[status]; }
function rsvpInteractionResponse(status, availability, date) {
  return { type: 7, data: buildRsvpMessage(`${rsvpConfirmation(status)}\n\n${buildAvailabilitySummary(availability)}`, date) };
}
function buildHistoricStatsMessage(historic) {
  if (!historic?.matches) return '';
  const latest = historic.latest ? `${historic.latest.date} · ${historic.latest.map} · ${historic.latest.winner}` : 'okänd';
  const players = Object.entries(historic.players || {}).map(([id, stats]) => {
    const name = { kakan: 'Kakan', logimox: 'LogiMOX', bjestavs: 'Bjestavs', doxos: 'Doxos' }[id] || id;
    return `• ${name}: ${stats.kills || 0} K · ${stats.deaths || 0} D · ${stats.objectives || 0} mål`;
  }).join('\n');
  return `**Chaos Theory-arkiv**\n${historic.matches} avslutade matcher · 🕵️ SPY ${historic.spyWins || 0} · 🔦 MERCS ${historic.mercWins || 0}\nVanligaste karta: **${historic.topMap?.name || 'okänd'}** (${historic.topMap?.matches || 0})\nSenaste: ${latest}${players ? `\n\n**Spelarstatistik**\n${players}` : ''}`;
}
function buildStatsMessage(state, historic = null) {
  const rsvp = Object.values(rsvpForDate(state, nextTuesdayDate())).map(entry => `${entry.status === 'in' ? '✅' : entry.status === 'late' ? '⏱️' : '❌'} ${entry.name}`).join('\n') || '_Inga svar ännu._';
  const archive = buildHistoricStatsMessage(historic);
  const memory = state.memories?.[0] ? `\n\n**Senaste minnet**\n> ${state.memories[0].text} — ${state.memories[0].author}` : '';
  return `## GubbSplinta-statistik${archive ? `\n\n${archive}` : ''}\n\n🟢 **Kakan + LogiMOX:** ${state.wins.kakan_logimox} manuella vinster\n🔵 **Bjestavs + Doxos:** ${state.wins.bjestavs_doxos} manuella vinster\n\n**Nästa match – RSVP**\n${rsvp}${memory}`;
}

function buildRoleSelectorMessage() {
  return {
    content: '## Third Echelon × Deep Rock: rollterminal\n**ROCK AND STONE! FOR KARL!** — välj en roll per rad, eller få en mycket bestämd ficklampa efter dig.',
    components: Object.entries(ROLE_GROUPS).map(([group, choices]) => ({
      type: 1,
      components: Object.values(choices).map(role => ({
        type: 2,
        style: group === 'team' ? 2 : 3,
        label: role.label,
        emoji: { name: role.emoji },
        custom_id: `role:${group}:${role.key}`
      }))
    }))
  };
}

function parseCustomId(customId) {
  if (typeof customId !== 'string') return null;
  const match = /^role:(team|mode|dwarf|beer):([a-z-]+)$/.exec(customId);
  if (!match || !ROLE_GROUPS[match[1]]?.[match[2]]) return null;
  return { group: match[1], choice: match[2] };
}

function resolveRoleChange(customId) {
  const parsed = parseCustomId(customId);
  if (!parsed) return null;
  const choices = ROLE_GROUPS[parsed.group];
  return { add: choices[parsed.choice], remove: Object.values(choices).filter(role => role.key !== parsed.choice) };
}

function roleIdsFromEnv(env) {
  const roleIds = {
    spies: env.ROLE_SPIES_ID,
    mercs: env.ROLE_MERCS_ID,
    'double-agent': env.ROLE_DOUBLE_AGENT_ID,
    'fisher-fanclub': env.ROLE_FISHER_FANCLUB_ID,
    chaos: env.ROLE_CHAOS_ID,
    versus: env.ROLE_VERSUS_ID,
    'svm-veteran': env.ROLE_SVM_VETERAN_ID,
    scout: env.ROLE_SCOUT_ID,
    gunner: env.ROLE_GUNNER_ID,
    driller: env.ROLE_DRILLER_ID,
    engineer: env.ROLE_ENGINEER_ID,
    'for-karl': env.ROLE_FOR_KARL_ID,
    'rock-and-stone': env.ROLE_ROCK_AND_STONE_ID,
    'molly-union': env.ROLE_MOLLY_UNION_ID,
    'leaf-lovers': env.ROLE_LEAF_LOVERS_ID
  };
  for (const [key, value] of Object.entries(roleIds)) {
    if (!value) throw new Error(`Missing role ID for ${key}`);
  }
  return roleIds;
}

async function applyRoleChange(env, guildId, userId, action, roleIds) {
  if (!guildId || !userId) throw new Error('This control must be used in a Discord server');
  await Promise.all(action.remove.map(role => discordRoleRequest(env, guildId, userId, roleIds[role.key], 'DELETE')));
  await discordRoleRequest(env, guildId, userId, roleIds[action.add.key], 'PUT');
}

async function discordRoleRequest(env, guildId, userId, roleId, method) {
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method,
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }
  });
  if (!response.ok) throw new Error(`Discord role API failed (${response.status}): ${await response.text()}`);
}

async function isValidDiscordRequest(request, publicKey) {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  if (!signature || !timestamp) return false;
  try {
    const body = await request.clone().text();
    const key = await crypto.subtle.importKey('raw', hexToBytes(publicKey), { name: 'Ed25519', namedCurve: 'Ed25519' }, false, ['verify']);
    return crypto.subtle.verify('Ed25519', key, hexToBytes(signature), new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}

function hexToBytes(value) {
  if (!/^[\da-f]+$/i.test(value) || value.length % 2) throw new Error('Invalid hexadecimal string');
  return Uint8Array.from(value.match(/.{2}/g), byte => parseInt(byte, 16));
}

function ephemeral(content) { return { type: 4, data: { content, flags: 64 } }; }
function discordResponse(data) { return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }); }

async function handleMapPost(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const payload = normalizePayload(await request.json());
    const discordMessage = buildDiscordMessage(payload);
    const githubText = buildRepoText(payload);
    const lastMessageId = await getLastMessageId(env);
    if (lastMessageId) await deleteDiscordMessage(env.DISCORD_WEBHOOK_URL, lastMessageId);
    const newMessageId = await postToDiscord(env.DISCORD_WEBHOOK_URL, discordMessage);
    await setLastMessageId(env, newMessageId);
    await updateGithubFile(env, githubText);
    return json({ ok: true, messageId: newMessageId });
  } catch (error) { return json({ error: error.message || 'Bad request' }, 400); }
}

function normalizePayload(body) {
  const title = safe(body.title, 'GubbSplinta Matchoff');
  const weekday = safe(body.weekday, 'Tisdag');
  const time = safe(body.time, '20:30');
  const targetDate = safe(body.targetDate, `${weekday} KL ${time}`);
  const remaining = safe(body.remaining, 'okänt');
  const maps = Array.isArray(body.maps) ? body.maps.slice(0, 4).map(map => ({ file: safe(map.file, 'unknown'), full: safe(map.full, 'unknown') })) : [];
  if (!maps.length) throw new Error('No maps supplied');
  return { title, weekday, time, targetDate, remaining, maps };
}
function buildDiscordMessage({ title, weekday, time, targetDate, remaining, maps }) { return [`**${title}**`, `Spel: ${weekday} ${time}`, `Nästa tillfälle: ${targetDate}`, `Tid kvar: ${remaining}`, '', '**Aktuellt kartförslag**', ...maps.map((map, index) => `${index + 1}. ${map.file} — ${map.full}`)].join('\n').slice(0, 2000); }
function buildRepoText({ title, weekday, time, targetDate, remaining, maps }) { return [`${title}`, `Uppdaterad: ${new Date().toISOString()}`, `Spel: ${weekday} ${time}`, `Nästa tillfälle: ${targetDate}`, `Tid kvar: ${remaining}`, '', 'Aktuellt kartförslag:', ...maps.map((map, index) => `${index + 1}. ${map.file} — ${map.full}`), ''].join('\n'); }
async function postToDiscord(webhookUrl, content) { const response = await fetch(webhookUrl + '?wait=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, allowed_mentions: { parse: [] }, username: 'GubbSplinta Bot' }) }); if (!response.ok) throw new Error('Discord rejected request: ' + await response.text()); return (await response.json()).id; }
async function deleteDiscordMessage(webhookUrl, messageId) { const response = await fetch(webhookUrl.replace(/\?.*$/, '') + '/messages/' + messageId, { method: 'DELETE' }); if (!response.ok && response.status !== 404) throw new Error('Discord delete failed: ' + await response.text()); }
async function loadHistoricStats(env) {
  // The full game log stays in the repo; the Worker reads only this tiny generated summary.
  const path = env.GITHUB_CHAOS_STATS_PATH || 'chaostheory-stats.json';
  try {
    const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`, { headers: githubHeaders(env) });
    if (!response.ok) return null;
    return JSON.parse(decodeBase64Utf8((await response.json()).content || ''));
  } catch { return null; }
}
async function getLastMessageId(env) { const current = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${env.GITHUB_MESSAGE_ID_PATH || '.gubbsplinta-last-discord-message.txt'}?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`, { headers: githubHeaders(env) }); if (current.status === 404) return ''; if (!current.ok) throw new Error('GitHub read failed: ' + await current.text()); return decodeBase64Utf8((await current.json()).content || '').trim(); }
async function setLastMessageId(env, messageId) { return writeGithubFile(env, env.GITHUB_MESSAGE_ID_PATH || '.gubbsplinta-last-discord-message.txt', String(messageId), 'Store last Discord message id'); }
async function updateGithubFile(env, textContent) { return writeGithubFile(env, env.GITHUB_FILE_PATH || 'current-match.txt', textContent, 'Update current match proposal'); }
async function writeGithubFile(env, path, textContent, message) { const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`; const headers = githubHeaders(env); const current = await fetch(`${apiUrl}?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`, { headers }); let sha; if (current.ok) sha = (await current.json()).sha; else if (current.status !== 404) throw new Error('GitHub read failed: ' + await current.text()); const payload = { message, content: encodeBase64Utf8(textContent), branch: env.GITHUB_BRANCH || 'main' }; if (sha) payload.sha = sha; const update = await fetch(apiUrl, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!update.ok) throw new Error('GitHub write failed: ' + await update.text()); }
function githubHeaders(env) { return { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'gubbsplinta-discord-proxy' }; }
function encodeBase64Utf8(value) { const bytes = new TextEncoder().encode(value); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function decodeBase64Utf8(value) { const binary = atob(value.replace(/\n/g, '')); return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0))); }
function safe(value, fallback) { return typeof value === 'string' ? value.replace(/[@`]/g, '').trim() || fallback : fallback; }
function corsHeaders() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }; }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() } }); }

export const __testables = { buildRoleSelectorMessage, parseCustomId, resolveRoleChange, roleIdsFromEnv, buildRsvpMessage, rsvpInteractionResponse, normalizeMemory, buildStatsMessage, buildHistoricStatsMessage, buildWelcomeMessage, normalizeMatchDate, availabilityForDate, buildAvailabilitySummary, resolvePlayer, canManageAvailability, rsvpForDate };
