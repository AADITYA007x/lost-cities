// /api/chat: talk to an imagined resident of Mohenjo-daro through Gemini.
// The key stays here on the server (a Cloudflare secret); the browser never sees it.
// Answers are grounded only in the curated notes, and the resident says plainly when
// nobody knows.

import { NOTES } from './notes.js';

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
// tried in order when a model is busy, missing or failing
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];

const PERSONAS = {
  beads: 'a bead maker who works carnelian in a small workshop in the lower town',
  potter: 'a potter with a wheel and a kiln near the edge of the lower town',
  water: 'someone who lives in a courtyard house off First Street and draws water from the house well every day',
};

const MAX_MESSAGES = 12;
const MAX_CHARS = 600;
const LIMIT = { count: 20, windowMs: 10 * 60 * 1000 }; // per visitor, per server instance
const seen = new Map();

function systemPrompt(persona, context) {
  return `You are an imagined resident of Mohenjo-daro around 2500 BCE: ${PERSONAS[persona] || PERSONAS.water}. You talk with a visitor exploring a 3D reconstruction of the city.

RULES (follow all of them):
1. Use ONLY the NOTES below for facts. Do not add facts from elsewhere, even if you think you know them.
2. When something is not in the NOTES, or the NOTES say it is unknown or debated, say so honestly and kindly, for example "Nobody knows that today" or "The finds don't tell us". Never guess and present it as fact.
3. Never invent names of people, gods, rulers, places, words of the Indus language, or readings of the script. You have no name that anyone knows today. The script is not deciphered: do not read it.
4. Speak in the first person, warmly and simply, as this resident. You may describe ordinary daily life only where the NOTES support it (brick houses, wells, drains, crafts, wheat and barley, cotton, the river). Mark anything uncertain with "perhaps" or "we think".
5. When the visitor asks something only modern archaeology can answer (how it was found, what scholars think, dates), step briefly out of the role with "(Today, archaeologists ...)" and answer from the NOTES.
6. Mention debates as debates: population, the purpose of the Great Bath, the "granary" (Great Hall), the "priest-king", the script and why the city declined. The idea of a violent invasion is not supported by the evidence.
7. Be respectful and neutral. The site is in Sindh, Pakistan, and belongs to the shared heritage of South Asia. Make no political or national claims; if asked, say this gently and return to the city.
8. Keep answers short: 2 to 5 sentences. Reply in the visitor's language.
9. Refuse anything harmful, hateful or unrelated to the city, politely, and offer to talk about the city instead.

WHAT THE VISITOR IS LOOKING AT NOW: ${context}

NOTES:
${NOTES}`;
}

function describeContext(c = {}) {
  const parts = [];
  if (c.era) parts.push(`moment in time: ${String(c.era).slice(0, 40)}`);
  if (c.time) parts.push(`time of day: ${String(c.time).slice(0, 30)}`);
  if (c.season) parts.push(`season: ${String(c.season).slice(0, 30)}`);
  if (c.rain) parts.push('it is raining');
  if (c.place) parts.push(`nearby: ${String(c.place).slice(0, 60)}`);
  return parts.join('; ') || 'the city from above';
}

async function callGemini(env, model, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`gemini ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) {
    const err = new Error('empty answer');
    err.status = data.promptFeedback?.blockReason ? 451 : 502;
    throw err;
  }
  return text;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function handleChat(request, env, json) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);
  if (!env.GEMINI_API_KEY) return json({ ok: false, error: 'not-configured' }, 503);

  // only this site may use the chat (stops other pages spending the key)
  const origin = request.headers.get('origin');
  const host = new URL(request.url).host;
  if (origin && new URL(origin).host !== host) return json({ ok: false, error: 'Forbidden' }, 403);

  // a simple limit per visitor
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const now = Date.now();
  const hits = (seen.get(ip) || []).filter((t) => now - t < LIMIT.windowMs);
  if (hits.length >= LIMIT.count) return json({ ok: false, error: 'busy' }, 429);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 5000) seen.clear();

  let input;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return json({ ok: false, error: 'Too long' }, 413);
    input = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'Bad request' }, 400);
  }
  const messages = (Array.isArray(input.messages) ? input.messages : [])
    .slice(-MAX_MESSAGES)
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.role === 'resident' ? 'model' : 'user', parts: [{ text: m.text.slice(0, MAX_CHARS) }] }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ ok: false, error: 'Bad request' }, 400);

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(input.persona, describeContext(input.context)) }] },
    contents: messages,
    generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
  };

  const models = [env.GEMINI_MODEL || DEFAULT_MODEL, ...FALLBACK_MODELS.filter((m) => m !== (env.GEMINI_MODEL || DEFAULT_MODEL))];
  let lastStatus = 502;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await callGemini(env, model, body);
        return json({ ok: true, text, model });
      } catch (err) {
        lastStatus = err.status || 502;
        console.log(`chat: ${model} failed (${lastStatus})`);
        if (lastStatus === 451) return json({ ok: false, error: 'blocked' }, 200);
        // a wrong or missing key will not work with any model
        if (lastStatus === 400 || lastStatus === 401 || lastStatus === 403) return json({ ok: false, error: 'unavailable' }, 503);
        // busy or failing: wait a little and try again; missing model: next one
        if (lastStatus === 429 || lastStatus >= 500) await sleep(400 * (attempt + 1));
        else break;
      }
    }
  }
  return json({ ok: false, error: lastStatus === 429 ? 'busy' : 'unavailable' }, 503);
}
