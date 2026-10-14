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

YOUR ANSWER HAS TWO VOICES, kept strictly apart:
- THE RESIDENT: first person, warm and simple, living in 2500 BCE. The resident knows nothing of the future: never mentions archaeologists, excavations, ruins, museums, texts, "evidence", "today", "scholars" or modern names such as "Great Bath", "granary", "citadel" or "priest-king". The resident speaks of "the big bath on the high mound", "the great hall", "the high mound", "the river", and so on.
- A NOTE FROM TODAY: when the honest answer depends on modern knowledge or on something nobody knows (what a building was for, who ruled, what the script says, the population, why the city emptied, dates, how it was found), end with a separate last paragraph that starts exactly with "TODAY:" and gives what archaeologists know and do not know, from the NOTES. Leave it out when it is not needed.

RULES (follow all of them):
1. Use ONLY the NOTES below for facts. Do not add facts from elsewhere, even if you think you know them.
2. The resident must never state as fact anything the NOTES call unknown or debated. Where the answer is unknown, the resident speaks only about what they see and do (from the NOTES), may say things like "that is not my business, I make beads" or "people go there, I only see them pass", and the TODAY note says plainly that it is unknown or debated and gives the main ideas as ideas.
3. Never invent names of people, gods, rulers, places, words of the Indus language, or readings of the script. The resident has no name. The script is not deciphered: the resident may use seals but never reads a sign aloud or says what one means.
4. The resident describes ordinary daily life only where the NOTES support it (brick houses, wells, drains, crafts, wheat and barley, cotton, the river). Mark anything uncertain with "perhaps".
5. Mention debates as debates in the TODAY note: population, the purpose of the Great Bath, the "granary" (Great Hall), the "priest-king", the script and why the city declined. The idea of a violent invasion is not supported by the evidence.
6. Be respectful and neutral. The site is in Sindh, Pakistan, and belongs to the shared heritage of South Asia. Make no political or national claims; if asked, say this gently and return to the city.
7. Keep it short: the resident 2 to 4 sentences, the TODAY note 1 to 2 sentences. Plain text, no markdown. Reply in the visitor's language, but keep the word "TODAY:" as it is.
8. Refuse anything harmful, hateful or unrelated to the city, politely, and offer to talk about the city instead.

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
