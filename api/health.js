// GET /api/health
// 앱이 켜질 때 "서버에 키가 있는지 / 코드가 필요한지"만 확인합니다. 키 값은 절대 내보내지 않습니다.
// x-app-pass 헤더를 같이 보내면 그 코드가 누구 것인지("you")도 알려줍니다.

function parseCodes() {
  // APP_CODES 형식:  "코드1:이름1,코드2:이름2"   (":이름" 은 생략 가능)
  // 예:              "ryan-a91:주현,minsu-4k2:민수,jieun-77x:지은"
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

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const codes = parseCodes();
  const given = String(req.headers['x-app-pass'] || '').trim();
  res.status(200).json({
    ok: true,
    key: !!process.env.OPENAI_API_KEY,
    pass: codes.size > 0,
    you: given && codes.has(given) ? codes.get(given) : null,
  });
};
