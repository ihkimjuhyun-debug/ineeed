// POST /api/chat  — 요약 / 질문 / 단어장 / 문제 / 번역에 쓰는 텍스트 모델 호출을 대신합니다.
// 브라우저는 키를 전혀 모릅니다. 키는 Vercel 환경변수 OPENAI_API_KEY 에만 있습니다.

const MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

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

  const pass = process.env.APP_PASSCODE;
  if (pass && req.headers['x-app-pass'] !== pass) {
    return res.status(401).json({ error: '접속 암호가 올바르지 않습니다.' });
  }

  try {
    const b = readBody(req);
    if (!Array.isArray(b.messages) || !b.messages.length) {
      return res.status(400).json({ error: 'messages 가 필요합니다.' });
    }
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
    const content = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    return res.status(200).json({ content });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
