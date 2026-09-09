// POST /api/chat  — 요약 / 질문 / 단어장 / 문제 / 번역용 텍스트 모델 호출을 대신합니다.
// 브라우저는 API 키를 전혀 모릅니다. 키는 Vercel 환경변수 OPENAI_API_KEY 에만 있습니다.

const MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const MAX_CHARS = Number(process.env.MAX_CHARS || 140000);   // 한 요청에 보낼 수 있는 글자 수 상한
const RATE_PER_MIN = Number(process.env.RATE_PER_MIN || 40); // 코드별 분당 요청 수
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 0);    // 코드별 하루 요청 수 (0 = 무제한)

// ── 접속 코드 ──────────────────────────────────────────────
function parseCodes() {
  const map = new Map();
  String(process.env.APP_CODES || '').split(',').forEach((chunk) => {
    const t = chunk.trim();
    if (!t) return;
    const i = t.indexOf(':');
    const code = (i === -1 ? t : t.slice(0, i)).trim();
    const name = (i === -1 ? '' : t.slice(i + 1)).trim() || code;
    if (code) map.set(code, name);
  });
  const legacy = String(process.env.APP_PASSCODE || '').trim();
  if (legacy && !map.has(legacy)) map.set(legacy, '공용');
  return map;
}
function auth(req) {
  const codes = parseCodes();
  if (!codes.size) return { ok: true, name: '(코드 미설정)', code: 'open' };
  const given = String(req.headers['x-app-pass'] || '').trim();
  if (codes.has(given)) return { ok: true, name: codes.get(given), code: given };
  return { ok: false };
}

// ── 남용 방지 (같은 인스턴스가 살아있는 동안 유효한 최선의 방어) ──
const HITS = globalThis.__lecnoteHits || (globalThis.__lecnoteHits = new Map());
const DAY = globalThis.__lecnoteDay || (globalThis.__lecnoteDay = { d: '', m: new Map() });

function overRate(code) {
  const now = Date.now();
  const arr = (HITS.get(code) || []).filter((t) => now - t < 60000);
  if (arr.length >= RATE_PER_MIN) return true;
  arr.push(now);
  HITS.set(code, arr);
  return false;
}
function overDaily(code) {
  if (!DAILY_LIMIT) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (DAY.d !== today) { DAY.d = today; DAY.m = new Map(); }
  const n = (DAY.m.get(code) || 0) + 1;
  DAY.m.set(code, n);
  return n > DAILY_LIMIT;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 만 허용됩니다.' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: '서버에 OPENAI_API_KEY 가 설정되지 않았습니다.' });

  const who = auth(req);
  if (!who.ok) return res.status(401).json({ error: '접속 코드가 올바르지 않습니다.' });
  if (overRate(who.code)) return res.status(429).json({ error: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' });
  if (overDaily(who.code)) return res.status(429).json({ error: '오늘 사용 한도를 모두 썼습니다.' });

  try {
    const b = readBody(req);
    if (!Array.isArray(b.messages) || !b.messages.length) {
      return res.status(400).json({ error: 'messages 가 필요합니다.' });
    }
    const chars = b.messages.reduce((s, m) => s + String((m && m.content) || '').length, 0);
    if (chars > MAX_CHARS) return res.status(413).json({ error: '보낸 내용이 너무 깁니다.' });

    const payload = {
      model: MODEL,
      messages: b.messages,
      temperature: typeof b.temperature === 'number' ? b.temperature : 0.3,
    };
    if (b.json) payload.response_format = { type: 'json_object' };
    if (b.max_tokens) payload.max_tokens = Math.min(16000, Number(b.max_tokens) || 2000);

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: text.slice(0, 400) });

    const d = JSON.parse(text);
    // Vercel → Deployments → Runtime Logs 에서 누가 얼마나 썼는지 볼 수 있습니다
    const used = (d.usage && d.usage.total_tokens) || 0;
    console.log(`[chat] ${who.name} chars=${chars} tokens=${used}`);

    const content = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    return res.status(200).json({ content });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
