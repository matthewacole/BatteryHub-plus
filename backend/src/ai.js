const http = require('http');
const https = require('https');

const DEFAULT_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_API_KEY = '';

let apiUrl = process.env.AI_API_URL || DEFAULT_API_URL;
let model = process.env.AI_MODEL || DEFAULT_MODEL;
let apiKey = process.env.AI_API_KEY || DEFAULT_API_KEY;

function configure(url, m, key) {
  if (url) apiUrl = url.replace(/\/$/, '');
  if (m) model = m;
  if (key !== undefined) apiKey = key;
}

function getConfig() {
  return { apiUrl, model, apiKey };
}

function isGemini() {
  return apiUrl.includes('googleapis.com');
}

function buildSystemPrompt(context) {
  let prompt = `You are a classroom battery management assistant.

## Battery Rules
- Small rooms: 4 batteries (2 in mics + 2 spares)
- Large rooms: 6 batteries (2 in mics + 4 spares)
- >6 class hours/day → check batteries
- Class ≤8:30 AM → check batteries night before

`;
  if (context.inventory && context.inventory.length > 0) {
    prompt += `## Inventory\n`;
    for (const i of context.inventory) {
      prompt += `- ${i.room_type}: ${i.count} rooms, ${i.battery_req} bat each = ${i.count * i.battery_req} total\n`;
    }
    prompt += '\n';
  }
  if (context.dailyUsage && context.dailyUsage.length > 0) {
    prompt += `## Daily Room Usage (hours)\n\`\`\`\nDate       Building  Room      Hrs  Cls  First\n`;
    for (const d of context.dailyUsage) {
      prompt += `${d.date}  ${d.building.padEnd(9)} ${(d.room||'').padEnd(9)} ${(d.total_hours||'').toString().padEnd(4)} ${d.class_count}    ${d.first_class}\n`;
    }
    prompt += '```\n';
  }
  if (context.overSix && context.overSix.length > 0) {
    prompt += `## Over 6h Rooms\n\`\`\`\n`;
    for (const o of context.overSix) {
      prompt += `${o.date}  ${o.building}  ${o.room}  ${o.total_hours}h\n`;
    }
    prompt += '```\n';
  }
  if (context.earlyClasses && context.earlyClasses.length > 0) {
    prompt += `## Early Classes (≤8:30)\n\`\`\`\n`;
    for (const e of context.earlyClasses) {
      prompt += `${e.date}  ${e.building}  ${e.room}  ${e.start_time}  ${e.class_name}\n`;
    }
    prompt += '```\n';
  }
  if (context.pendingChecks && context.pendingChecks.length > 0) {
    prompt += `## Pending Checks\n\`\`\`\n`;
    for (const b of context.pendingChecks) {
      prompt += `${b.date}  ${b.building}  ${b.room}  ${b.reason}\n`;
    }
    prompt += '```\n';
  }
  prompt += `## Constraints
- You CAN search, summarize, explain, compare, and answer questions.
- You CANNOT modify schedules or battery rules.
- Only answer based on the data above. If you don't know, say so.`;
  return prompt;
}

function httpRequest(method, urlStr, body, timeout) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const isHttps = urlObj.protocol === 'https:';
    const transport = isHttps ? https : http;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout,
    };
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    if (body) req.write(body);
    req.end();
  });
}

async function ask(query, context = {}) {
  const systemPrompt = buildSystemPrompt(context);
  const name = isGemini() ? 'Gemini' : 'AI';
  console.log(`AI ask: model="${model}" provider=${name}`);

  if (isGemini()) {
    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: query }] }],
    });
    const url = `${apiUrl}/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
    const { status, body: raw } = await httpRequest('POST', url, body, 120000);
    if (status !== 200) {
      console.error(`Gemini HTTP ${status}: ${raw.slice(0, 500)}`);
      return `Gemini API error (${status}). Check your API key and model name in Settings.`;
    }
    try {
      const json = JSON.parse(raw);
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      const blockage = json.promptFeedback?.blockReason;
      if (blockage) return `Request blocked: ${blockage}`;
      console.error('Gemini empty response:', JSON.stringify(json).slice(0, 1000));
      return 'No response';
    } catch {
      return raw || 'Error parsing Gemini response';
    }
  }

  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ],
    stream: false,
  });
  const url = `${apiUrl}/chat/completions`;
  const { status, body: raw } = await httpRequest('POST', url, body, 120000);
  if (status !== 200) {
    console.error(`OpenAI API HTTP ${status}: ${raw.slice(0, 500)}`);
    return `API error (${status}). Check the URL and model name in Settings.`;
  }
  try {
    const json = JSON.parse(raw);
    const text = json.choices?.[0]?.message?.content;
    if (text) return text;
    console.error('API empty response:', JSON.stringify(json).slice(0, 1000));
    return 'No response';
  } catch {
    return raw || 'Error parsing response';
  }
}

async function listModels() {
  const name = isGemini() ? 'Gemini' : 'AI';

  if (isGemini()) {
    try {
      const url = `${apiUrl}/models?key=${apiKey}`;
      const { status, body: raw } = await httpRequest('GET', url, null, 10000);
      if (status !== 200) return [];
      const json = JSON.parse(raw);
      return (json.models || []).map(m => m.name.replace(/^models\//, '')).filter(Boolean);
    } catch {
      return [];
    }
  }

  try {
    const url = `${apiUrl}/models`;
    const { status, body: raw } = await httpRequest('GET', url, null, 10000);
    if (status !== 200) return [];
    const json = JSON.parse(raw);
    return (json.data || []).map(m => m.id).filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = { configure, getConfig, ask, listModels };
