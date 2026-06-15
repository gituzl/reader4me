// Cloudflare Pages Function — production proxy for /api/lookup.
// File-based routing: functions/api/lookup.js  ->  POST /api/lookup
//
// Runs on the Cloudflare Workers runtime (not Node):
//   - the API key comes from context.env.SILICONFLOW_API_KEY (a Pages env var),
//     NEVER from the browser.
//   - global fetch / Response are available; there is no process.env.
//
// The shared lookup logic lives in lib/siliconflow.js and is bundled in by
// Cloudflare's build (esbuild). Only POST is handled; other methods auto-405.

import { lookup } from '../../lib/siliconflow.js';

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env && env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return json({ error: '服务端未配置 SILICONFLOW_API_KEY 环境变量' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }
  body = body || {};

  try {
    const result = await lookup({
      word: body.word,
      sentence: body.sentence,
      langName: body.langName,
      apiKey: apiKey,
      // Optional model override via a Pages env var (defaults inside lib).
      model: env && env.SF_MODEL,
    });
    return json(result, 200);
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    return json({ error: (err && err.message) || '请求失败' }, status);
  }
}
