export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/post-maps') {
      return json({ error: 'Not found' }, 404);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      const body = await request.json();
      const payload = normalizePayload(body);
      const discordMessage = buildDiscordMessage(payload);
      const githubText = buildRepoText(payload);

      const lastMessageId = await getLastMessageId(env);
      if (lastMessageId) {
        await deleteDiscordMessage(env.DISCORD_WEBHOOK_URL, lastMessageId);
      }
      const newMessageId = await postToDiscord(env.DISCORD_WEBHOOK_URL, discordMessage);
      await setLastMessageId(env, newMessageId);
      await updateGithubFile(env, githubText);

      return json({ ok: true, messageId: newMessageId }, 200);
    } catch (error) {
      return json({ error: error.message || 'Bad request' }, 400);
    }
  }
};

function normalizePayload(body) {
  const title = safe(body.title, 'GubbSplinta Matchoff');
  const weekday = safe(body.weekday, 'Tisdag');
  const time = safe(body.time, '20:30');
  const targetDate = safe(body.targetDate, `${weekday} KL ${time}`);
  const remaining = safe(body.remaining, 'okänt');
  const maps = Array.isArray(body.maps) ? body.maps.slice(0, 4).map(map => ({
    file: safe(map.file, 'unknown'),
    full: safe(map.full, 'unknown')
  })) : [];

  if (!maps.length) throw new Error('No maps supplied');
  return { title, weekday, time, targetDate, remaining, maps };
}

function buildDiscordMessage({ title, weekday, time, targetDate, remaining, maps }) {
  return [
    `**${title}**`,
    `Spel: ${weekday} ${time}`,
    `Nästa tillfälle: ${targetDate}`,
    `Tid kvar: ${remaining}`,
    '',
    '**Aktuellt kartförslag**',
    ...maps.map((map, index) => `${index + 1}. ${map.file} — ${map.full}`)
  ].join('\n').slice(0, 2000);
}

function buildRepoText({ title, weekday, time, targetDate, remaining, maps }) {
  const now = new Date().toISOString();
  return [
    `${title}`,
    `Uppdaterad: ${now}`,
    `Spel: ${weekday} ${time}`,
    `Nästa tillfälle: ${targetDate}`,
    `Tid kvar: ${remaining}`,
    '',
    'Aktuellt kartförslag:',
    ...maps.map((map, index) => `${index + 1}. ${map.file} — ${map.full}`),
    ''
  ].join('\n');
}

async function postToDiscord(webhookUrl, content) {
  const response = await fetch(webhookUrl + '?wait=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
      username: 'GubbSplinta Bot'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error('Discord rejected request: ' + text);
  }

  const data = await response.json();
  return data.id;
}

async function deleteDiscordMessage(webhookUrl, messageId) {
  const url = webhookUrl.replace(/\?.*$/, '') + '/messages/' + messageId;
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error('Discord delete failed: ' + text);
  }
}

async function getLastMessageId(env) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const path = env.GITHUB_MESSAGE_ID_PATH || '.gubbsplinta-last-discord-message.txt';
  const branch = env.GITHUB_BRANCH || 'main';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = githubHeaders(env);
  const current = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (current.status === 404) return '';
  if (!current.ok) {
    const text = await current.text();
    throw new Error('GitHub read failed: ' + text);
  }
  const currentJson = await current.json();
  return decodeBase64Utf8(currentJson.content || '').trim();
}

async function setLastMessageId(env, messageId) {
  return writeGithubFile(env, env.GITHUB_MESSAGE_ID_PATH || '.gubbsplinta-last-discord-message.txt', String(messageId), 'Store last Discord message id');
}

async function updateGithubFile(env, textContent) {
  return writeGithubFile(env, env.GITHUB_FILE_PATH || 'current-match.txt', textContent, 'Update current match proposal');
}

async function writeGithubFile(env, path, textContent, message) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || 'main';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = githubHeaders(env);

  let sha;
  const current = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (current.ok) {
    const currentJson = await current.json();
    sha = currentJson.sha;
  } else if (current.status !== 404) {
    const text = await current.text();
    throw new Error('GitHub read failed: ' + text);
  }

  const payload = {
    message,
    content: encodeBase64Utf8(textContent),
    branch
  };
  if (sha) payload.sha = sha;

  const update = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!update.ok) {
    const text = await update.text();
    throw new Error('GitHub write failed: ' + text);
  }
}

function githubHeaders(env) {
  return {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'gubbsplinta-discord-proxy'
  };
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function safe(value, fallback) {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[@`]/g, '').trim() || fallback;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders()
    }
  });
}
