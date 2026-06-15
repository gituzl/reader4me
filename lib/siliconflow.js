'use strict';

// Shared SiliconFlow lookup logic, used by both the Vercel serverless function
// (api/lookup.js) and the local Express server (server.js).
// The API key is supplied by the caller (always from a server-side env var) and
// NEVER comes from the browser.

const DEFAULT_SF_BASE = 'https://api.siliconflow.cn/v1';
// Model is overridable via env so a different model can be tried without code changes.
// Default = Qwen2.5-32B-Instruct: best balance of accuracy / speed / cost.
// (7B is unreliable for IPA; 72B & DeepSeek-V3 are great but slower / pricier.)
const SF_MODEL = process.env.SF_MODEL || 'Qwen/Qwen2.5-32B-Instruct';

const SYSTEM_PROMPT = [
  '你是一名语言学习助手。用户会给你一个【目标单词 word】和它所在的【句子 sentence】。',
  '句子只用来判断该词在此处的语境含义。',
  '你的任务:只针对这个【目标单词】给出读音和词义,**绝对不要翻译整句话**。',
  '',
  '只输出一个 JSON 对象,且只含这两个字段:',
  '{',
  '  "ipa": "目标单词的 IPA 国际音标,用斜杠包裹,例如 /həˈləʊ/",',
  '  "translation": "目标单词在该句语境下的简体中文意思,精简 2-8 个字"',
  '}',
  '',
  '规则:',
  '- translation 必须是【这个单词】的意思,不是整句话的意思',
  '- 语言可能是英语、法语或俄语,根据 Language 字段判断',
  '- IPA 必须准确,法语注意鼻元音和小舌音 /ʁ/、/ɑ̃/,俄语注意软音 /ʲ/ 和重音标记 ˈ',
  '- 同一个词在不同句子里意思不同,务必反映当前语境',
  '- 只输出 JSON,不要任何解释、markdown 围栏或前后缀'
].join('\n');

function getEndpoint(base) {
  return (base || DEFAULT_SF_BASE).replace(/\/+$/, '') + '/chat/completions';
}

// Tolerantly pull a string field out of the parsed object, trying several key aliases.
function pickField(obj, keys) {
  for (let i = 0; i < keys.length; i++) {
    const v = obj[keys[i]];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

// Parse the model's content robustly: strip markdown fences, extract the first
// {...} block, then read ipa/translation under several possible key names.
function parseLookupResult(content) {
  let raw = String(content).trim();
  // strip ```json ... ``` fences if present
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  // extract the first JSON object if the model added stray text around it
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) raw = m[0];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ipa: '', translation: '', _parseError: true };
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const ipa = pickField(parsed, ['ipa', 'IPA', 'phonetic', 'pronunciation', '音标', '读音']);
    const translation = pickField(parsed, [
      'translation', 'translate', 'meaning', 'definition', 'def', 'chinese', 'zh',
      '翻译', '释义', '解释', '词义', '意思', '中文'
    ]);
    return { ipa: ipa, translation: translation };
  }
  return { ipa: '', translation: '' };
}

/**
 * Look up a word's IPA + contextual Chinese translation via SiliconFlow.
 * @param {Object} opts
 * @param {string} opts.word      target word
 * @param {string} opts.sentence  full sentence the word appears in (context)
 * @param {string} opts.langName  e.g. 'English' | 'French' | 'Russian'
 * @param {string} opts.apiKey    SiliconFlow API key (from server env)
 * @param {AbortSignal} [opts.signal]
 * @param {string} [opts.base]    optional API base URL
 * @returns {Promise<{ipa: string, translation: string}>}
 */
async function lookup(opts) {
  const word = (opts && opts.word) || '';
  const sentence = (opts && opts.sentence) || '';
  const langName = (opts && opts.langName) || 'English';
  const apiKey = opts && opts.apiKey;
  const signal = opts && opts.signal;
  const base = opts && opts.base;

  if (!word) {
    const e = new Error('缺少 word 参数');
    e.status = 400;
    throw e;
  }
  if (!apiKey) {
    const e = new Error('服务端未配置 API Key');
    e.status = 500;
    throw e;
  }

  const response = await fetch(getEndpoint(base), {
    method: 'POST',
    signal: signal,
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: SF_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'Word: ' + word + '\nSentence: ' + sentence + '\nLanguage: ' + langName }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(function () { return ''; });
    const e = new Error('SiliconFlow ' + response.status + ': ' + (text || '').slice(0, 160));
    e.status = response.status === 401 ? 401 : 502;
    throw e;
  }

  const data = await response.json();
  const content =
    data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) {
    const e = new Error('SiliconFlow 响应为空');
    e.status = 502;
    throw e;
  }

  const result = parseLookupResult(content);

  // translation is required; ipa is optional (some words/scripts may lack it).
  if (!result.translation) {
    const snippet = String(content).replace(/\s+/g, ' ').slice(0, 160);
    const e = new Error('返回缺少翻译字段;原始返回: ' + snippet);
    e.status = 502;
    throw e;
  }

  return { ipa: result.ipa || '', translation: result.translation };
}

module.exports = { lookup, SF_MODEL, DEFAULT_SF_BASE };
