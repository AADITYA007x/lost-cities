// Cloudflare Worker: serves the built site from ./dist and handles /api/* routes.
// For now only a health check. The Gemini chat proxy (/api/chat) arrives in milestone 11.

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        app: 'lost-cities',
        site: 'mohenjo-daro',
        chatConfigured: Boolean(env.GEMINI_API_KEY),
        time: new Date().toISOString(),
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ ok: false, error: 'Not found' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
