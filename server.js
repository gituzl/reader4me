const express = require('express');
const path = require('path');
const { lookup } = require('./lib/siliconflow');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Disable caching for development
app.use(function(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Health check — also reports whether the server-side key is configured.
app.get('/api/health', function(req, res) {
  res.json({ ok: true, keyConfigured: !!process.env.SILICONFLOW_API_KEY });
});

// Word lookup proxy. The API key comes from the server env, never the browser.
app.post('/api/lookup', async function(req, res) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '服务端未配置 SILICONFLOW_API_KEY 环境变量' });
    return;
  }
  const body = req.body || {};
  try {
    const result = await lookup({
      word: body.word,
      sentence: body.sentence,
      langName: body.langName,
      apiKey: apiKey
    });
    res.json(result);
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    res.status(status).json({ error: (err && err.message) || '请求失败' });
  }
});

// Static frontend lives in public/
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let ip = '0.0.0.0';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ip = net.address;
      }
    }
  }
  console.log(`reader4me running at http://localhost:${PORT}`);
  console.log(`LAN access: http://${ip}:${PORT}`);
  if (!process.env.SILICONFLOW_API_KEY) {
    console.warn('⚠ 未检测到 SILICONFLOW_API_KEY 环境变量,查词会失败。请先设置后再启动。');
  }
});
