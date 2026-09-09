// POST /api/transcribe — 녹음 한 구간(WAV)을 받아 음성인식 결과를 돌려줍니다.
// 오디오는 base64 JSON 으로 받습니다. (multipart 파싱 차이에 휘둘리지 않게)
// 16kHz mono 16bit 기준: 30초 ≈ 1MB, base64 로도 ≈ 1.3MB → Vercel 본문 한도 4.5MB 안쪽.

const ALLOWED = ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'];

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
    const buf = Buffer.from(String(b.audio || ''), 'base64');
    if (!buf.length) return res.status(400).json({ error: '오디오가 비어 있습니다.' });
    if (buf.length > 24 * 1024 * 1024) return res.status(413).json({ error: '오디오가 너무 큽니다.' });

    const model = ALLOWED.indexOf(b.model) !== -1 ? b.model : 'gpt-4o-transcribe';
    const fmt = b.response_format === 'verbose_json' ? 'verbose_json' : 'json';

    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: 'audio/wav' }), 'a.wav');
    fd.append('model', model);
    fd.append('temperature', '0');
    fd.append('response_format', fmt);

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: fd,
    });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: text.slice(0, 400) });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
