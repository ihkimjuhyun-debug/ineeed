// GET /api/health
// 앱이 켜질 때 "서버에 키가 있는지"만 확인합니다. 키 값 자체는 절대 내보내지 않습니다.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    key: !!process.env.OPENAI_API_KEY,   // 키가 설정돼 있는가 (true/false 만)
    pass: !!process.env.APP_PASSCODE,    // 접속 암호를 요구하는가
  });
};
