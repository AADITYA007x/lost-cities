// Cloudflare Worker: serves the built site from ./dist and handles /api/* routes.
// Milestone 0: only a health check. The Gemini chat proxy arrives in a later milestone.

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
        app: 'mohenjo-daro',
        milestone: 0,
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
