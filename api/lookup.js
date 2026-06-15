'use strict';

// Vercel serverless function: POST /api/lookup
// Proxies word lookups to SiliconFlow. The API key lives ONLY in the
// SILICONFLOW_API_KEY environment variable — it never reaches the browser.

const { lookup } = require('../lib/siliconflow');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '服务端未配置 SILICONFLOW_API_KEY 环境变量' });
    return;
  }

  // Vercel parses JSON bodies automatically; fall back to manual parse just in case.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  try {
    const result = await lookup({
      word: body.word,
      sentence: body.sentence,
      langName: body.langName,
      apiKey: apiKey
    });
    res.status(200).json(result);
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    res.status(status).json({ error: (err && err.message) || '请求失败' });
  }
};
