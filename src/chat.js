// Talk to a resident: a small chat panel. Questions go to /api/chat on our Worker,
// which asks Gemini with the app's own notes; the key never reaches the browser.

// each one is someone the city shows at work (see life.js and bustle.js)
const PERSONAS = [
  { id: 'water', label: 'Neighbour by the well' },
  { id: 'beads', label: 'Bead maker' },
  { id: 'potter', label: 'Potter' },
  { id: 'shell', label: 'Shell worker' },
  { id: 'seals', label: 'Seal carver' },
  { id: 'spinning', label: 'Spinner' },
  { id: 'metal', label: 'Metalworker' },
  { id: 'grinding', label: 'Grinding grain' },
  { id: 'carter', label: 'Carter' },
  { id: 'farmer', label: 'Farmer' },
];

const SUGGESTIONS = [
  'What is your day like?',
  'What was the Great Bath for?',
  'Who ruled the city?',
  'Can you read the writing on the seals?',
  'Why did the city empty?',
];

const ERRORS = {
  'not-configured': 'The resident can’t talk yet: the chat is not set up on this server.',
  busy: 'Many people are talking at once. Please try again in a minute.',
  unavailable: 'The resident can’t answer right now. Please try again a little later.',
  blocked: 'Let’s talk about something else in the city.',
  offline: 'The chat needs the server. Run it with “npx wrangler dev”, or try the live site.',
};

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// the browser's own speech: reading answers aloud everywhere it exists, listening
// where the browser offers it (Chrome and Edge do; it uses their speech service)
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// the answer's last paragraph may be a note from today ("TODAY: ...")
function splitToday(text) {
  const m = text.match(/^([\s\S]*?)\s*\(?\bTODAY:\s*([\s\S]+?)\)?\s*$/i);
  if (!m || !m[1].trim()) return { said: text, today: '' };
  return { said: m[1].trim(), today: m[2].trim() };
}

export function createChat({ panel, button, getContext, onPersona, onSpeaking }) {
  panel.innerHTML = `
    <div class="chat-head">
      <div>
        <p class="chat-kicker">Imagined</p>
        <h2>Talk to a resident</h2>
      </div>
      <button type="button" class="close" aria-label="Close">×</button>
    </div>
    <div class="chat-personas" role="radiogroup" aria-label="Who to talk to">
      ${PERSONAS.map((p) => `<button type="button" role="radio" data-persona="${p.id}" aria-checked="false">${p.label}</button>`).join('')}
    </div>
    <p class="chat-note">An imagined person, not a real one. They speak from their own time; what archaeologists know, and don’t know, comes as a separate note from today. Answers use only the notes in this app. AI can still make mistakes: check the info panels.</p>
    <div class="chat-tools">
      <button type="button" class="chat-voice" aria-pressed="true">Read aloud: on</button>
    </div>
    <div class="chat-log" aria-live="polite"></div>
    <div class="chat-suggest">${SUGGESTIONS.map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form class="chat-form">
      <input type="text" maxlength="400" placeholder="Ask something…" aria-label="Your question" autocomplete="off" />
      <button type="button" class="chat-mic" aria-label="Ask by speaking" title="Ask by speaking (uses your browser’s speech service)" hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
      <button type="submit" aria-label="Send">Ask</button>
    </form>
  `;
  const log = panel.querySelector('.chat-log');
  const form = panel.querySelector('.chat-form');
  const input = form.querySelector('input');
  const send = form.querySelector('button');
  const suggest = panel.querySelector('.chat-suggest');
  let persona = 'water';
  let messages = [];
  let waiting = false;

  // ---------- reading aloud ----------
  const voiceButton = panel.querySelector('.chat-voice');
  let readAloud = Boolean(synth);
  if (!synth) voiceButton.hidden = true;
  function pickVoice() {
    const lang = (navigator.language || 'en').slice(0, 2);
    const voices = synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith(lang));
    // a calm, natural voice if the system has one
    return voices.find((v) => /natural|neural|google/i.test(v.name)) || voices[0] || null;
  }
  function speak(text) {
    if (!synth || !readAloud) return;
    synth.cancel();
    // only the resident's own words are spoken; the note from today is for reading
    const { said } = splitToday(text);
    const parts = [[said, 0.95, 1]];
    const v = pickVoice();
    parts.forEach(([t, rate, pitch], i) => {
      const u = new SpeechSynthesisUtterance(t.replace(/[()]/g, ' '));
      if (v) u.voice = v;
      u.rate = rate;
      u.pitch = pitch;
      if (i === 0) u.onstart = () => onSpeaking?.(true);
      if (i === parts.length - 1) u.onend = () => onSpeaking?.(false);
      u.onerror = () => onSpeaking?.(false);
      synth.speak(u);
    });
  }
  function stopSpeaking() {
    if (synth) synth.cancel();
    onSpeaking?.(false);
  }
  voiceButton.addEventListener('click', () => {
    readAloud = !readAloud;
    voiceButton.textContent = readAloud ? 'Read aloud: on' : 'Read aloud: off';
    voiceButton.setAttribute('aria-pressed', String(readAloud));
    if (!readAloud) stopSpeaking();
  });

  // ---------- asking by voice ----------
  const mic = panel.querySelector('.chat-mic');
  let listening = null;
  if (Recognition) {
    mic.hidden = false;
    mic.addEventListener('click', () => {
      if (listening) {
        listening.stop();
        return;
      }
      stopSpeaking();
      const r = new Recognition();
      r.lang = navigator.language || 'en-US';
      r.interimResults = true;
      r.maxAlternatives = 1;
      listening = r;
      mic.classList.add('on');
      input.placeholder = 'Listening…';
      let heard = '';
      r.onresult = (e) => {
        heard = Array.from(e.results).map((x) => x[0].transcript).join(' ');
        input.value = heard;
      };
      r.onend = () => {
        listening = null;
        mic.classList.remove('on');
        input.placeholder = 'Ask something…';
        if (heard.trim()) {
          input.value = '';
          ask(heard);
        }
      };
      r.onerror = () => r.stop();
      r.start();
    });
  }

  function render() {
    panel.querySelectorAll('[data-persona]').forEach((b) => {
      const on = b.dataset.persona === persona;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    log.innerHTML = messages
      .map((m) => {
        if (m.role !== 'resident' || m.error) return `<div class="msg ${m.role}${m.error ? ' error' : ''}"><p>${esc(m.text)}</p></div>`;
        // the resident lives in 2500 BCE; what we know (and don't) today is a separate note
        const { said, today } = splitToday(m.text);
        return `<div class="msg resident"><p>${esc(said)}</p>${today ? `<p class="msg-today"><b>From today</b>${esc(today)}</p>` : ''}</div>`;
      })
      .join('');
    if (waiting) log.insertAdjacentHTML('beforeend', '<div class="msg resident waiting"><p><span></span><span></span><span></span></p></div>');
    suggest.hidden = messages.length > 0;
    send.disabled = waiting;
    log.scrollTop = log.scrollHeight;
  }

  async function ask(text) {
    text = text.trim();
    if (!text || waiting) return;
    stopSpeaking();
    messages.push({ role: 'visitor', text });
    waiting = true;
    render();
    let reply;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          persona,
          context: getContext(),
          messages: messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const type = res.headers.get('content-type') || '';
      if (!type.includes('json')) throw new Error('offline');
      const data = await res.json();
      reply = data.ok ? { role: 'resident', text: data.text } : { role: 'resident', text: ERRORS[data.error] || ERRORS.unavailable, error: true };
    } catch {
      reply = { role: 'resident', text: ERRORS.offline, error: true };
    }
    waiting = false;
    messages.push(reply);
    render();
    if (!reply.error) speak(reply.text);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    ask(text);
  });
  suggest.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (b) ask(b.dataset.q);
  });
  panel.querySelector('.chat-personas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-persona]');
    if (!b || b.dataset.persona === persona) return;
    persona = b.dataset.persona;
    messages = [];
    stopSpeaking();
    render();
    onPersona?.(persona);
  });
  // keys typed here are for the chat, not for walking or closing panels
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') e.stopPropagation();
  });

  function open(on) {
    const was = panel.classList.contains('open');
    panel.classList.toggle('open', on);
    button.setAttribute('aria-expanded', String(on));
    if (on && !was) {
      // go to the person you are talking to
      onPersona?.(persona);
      if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => input.focus({ preventScroll: true }), 300);
    }
    if (!on) stopSpeaking();
  }
  button.addEventListener('click', () => open(!panel.classList.contains('open')));
  panel.querySelector('.close').addEventListener('click', () => open(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') open(false);
  });

  render();
  return { open };
}
