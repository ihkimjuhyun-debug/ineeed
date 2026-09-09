// POST /api/transcribe — 녹음 한 구간(WAV)을 받아 음성인식 결과를 돌려줍니다.
// 오디오는 base64 JSON 으로 받습니다. (multipart 파싱 차이에 휘둘리지 않게)
// 16kHz mono 16bit 기준: 30초 ≈ 1MB, base64 로도 ≈ 1.3MB → Vercel 본문 한도 4.5MB 안쪽.

const ALLOWED = ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'];
const RATE_PER_MIN = Number(process.env.STT_RATE_PER_MIN || 20); // 코드별 분당 구간 수 (10초 구간이면 분당 6개)
const MAX_BYTES = 8 * 1024 * 1024;

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

const HITS = globalThis.__lecnoteSttHits || (globalThis.__lecnoteSttHits = new Map());
function overRate(code) {
  const now = Date.now();
  const arr = (HITS.get(code) || []).filter((t) => now - t < 60000);
  if (arr.length >= RATE_PER_MIN) return true;
  arr.push(now);
  HITS.set(code, arr);
  return false;
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
  if (overRate(who.code)) return res.status(429).json({ error: '요청이 너무 잦습니다.' });

  try {
    const b = readBody(req);
    const buf = Buffer.from(String(b.audio || ''), 'base64');
    if (!buf.length) return res.status(400).json({ error: '오디오가 비어 있습니다.' });
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: '오디오가 너무 큽니다.' });

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

    console.log(`[stt] ${who.name} bytes=${buf.length} model=${model}`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
