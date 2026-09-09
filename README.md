# 강의 노트 — GitHub + Vercel 배포 가이드

정적 HTML 한 장 + 서버 함수 3개. 빌드 과정은 없습니다.

## 저장소 구조 (이대로 두세요)

```
your-repo/
├── index.html          ← 앱 본체. 반드시 이 이름, 반드시 루트
├── vercel.json
├── api/
│   ├── health.js       ← 서버에 키가 있는지만 알려줌
│   ├── chat.js         ← 요약·질문·단어장·문제·번역 대리 호출
│   └── transcribe.js   ← 음성인식 대리 호출
├── .gitignore
└── README.md
```

`package.json` 은 **넣지 마세요.** 의존성이 하나도 없고, 있으면 Vercel이 빌드를 시도하다 실패합니다.

## Vercel 설정

Import 화면에서:

| 항목 | 값 |
|---|---|
| Framework Preset | **Other** |
| Build Command / Output Directory / Install Command | **모두 비워두기** |
| Root Directory | `./` |

### 환경변수 (Settings → Environment Variables)

| 이름 | 값 | 필수 |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | ✅ 필수 |
| `APP_CODES` | 사람별 접속 코드 목록 (아래 설명) | ✅ 사실상 필수 |
| `OPENAI_CHAT_MODEL` | 기본 `gpt-4o-mini` | 선택 |
| `DAILY_LIMIT` | 코드별 하루 요청 수 (기본 0 = 무제한) | 선택 |
| `RATE_PER_MIN` | 코드별 분당 요청 수 (기본 40) | 선택 |
| `MAX_CHARS` | 한 요청 최대 글자 수 (기본 140000) | 선택 |
| `APP_PASSCODE` | 예전 방식의 공용 암호 하나 | 선택 |

Production / Preview / Development 세 곳 모두 체크하고 저장한 뒤 **Redeploy** 하세요. 환경변수는 재배포해야 반영됩니다.

## 사람별 접속 코드 (`APP_CODES`)

한 줄에 쉼표로 이어 붙입니다. 형식은 **`코드:이름`**.

```
qk1fyl8kqn:주현,ke4m9qvaux:민수,icny5gmnbu:지은
```

- **코드**는 사용자가 앱에 입력할 값입니다. 추측 못 하게 무작위 10자 이상을 권합니다.
- **이름**은 나만 보는 표시용입니다. Vercel 로그와 앱 화면("✅ 민수 님으로 사용 중")에 뜹니다.
- 코드를 하나도 설정하지 않으면 **누구나 쓸 수 있습니다.** 반드시 설정하세요.

### 한 명만 끊기

`APP_CODES` 값에서 그 사람 항목만 지우고 → Save → Redeploy.

```
qk1fyl8kqn:주현,ke4m9qvaux:민수,icny5gmnbu:지은
                                 ↑ 지은만 삭제
qk1fyl8kqn:주현,ke4m9qvaux:민수
```

다른 사람 코드는 그대로라 **아무도 영향을 받지 않습니다.**

### 누가 얼마나 썼는지 보기

Vercel → **Deployments** → 배포 클릭 → **Runtime Logs** 에 이렇게 찍힙니다.

```
[chat] 민수 chars=18422 tokens=2914
[stt]  주현 bytes=642000 model=gpt-4o-transcribe
```

무료 플랜은 로그를 1시간만 보관합니다. 길게 보려면 Pro가 필요합니다.

### 남용 방지

- `RATE_PER_MIN` — 코드별 분당 요청 제한. 반복 스크립트로 크레딧을 태우는 걸 막습니다.
- `DAILY_LIMIT` — 코드별 하루 요청 제한. 예: `300`
- 이 두 개는 서버 인스턴스 메모리에 세는 방식이라 **완벽하지는 않습니다**(인스턴스가 새로 뜨면 초기화). 확실한 상한은 **OpenAI 쪽 월 지출 한도**(platform.openai.com → Settings → Limits)로 거세요.

> **돈을 받고 공유한다면** Vercel Hobby 플랜은 [비상업적·개인 용도로만 제한](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)됩니다. Pro로 올려야 합니다.

## 동작 방식

- 배포된 주소에서 열면 → `/api/health` 로 서버에 키가 있는지 확인하고, 있으면 **"🔒 보안 모드"** 로 전환. 키 입력칸이 사라집니다.
- `index.html` 을 로컬 파일로 열면 → `/api` 가 없으므로 예전처럼 각자 **API 키를 직접 입력**해서 씁니다.

즉 한 파일로 두 방식 다 됩니다.

## Vercel 무료 플랜 제한 (2026-08 기준)

| 항목 | 값 | 이 앱에서 |
|---|---|---|
| 함수 최대 실행 시간 (Hobby) | **300초** | 가장 긴 호출도 1분 이내 — 여유 있음 |
| 요청·응답 본문 크기 | **4.5MB** | 30초 오디오 ≈ 1.3MB — 여유 있음 |
| Active CPU 과금 | AI 응답 **대기 시간은 미포함** | 중계만 하므로 거의 0 |

예전의 10초 제한은 없어졌습니다. 다만 **녹음 구간을 60초 이상으로 늘리는 개조**를 한다면 본문 4.5MB 한도를 다시 계산하세요(16kHz mono 기준 약 105초가 한계).

## 흔한 증상 → 원인

| 증상 | 원인 / 해결 |
|---|---|
| 404: NOT_FOUND | 파일 이름이 `index.html` 이 아님 / 루트에 없음 |
| 빌드 실패 (`No Output Directory named "public"`) | Framework Preset을 Other로, 빌드 명령 비우기 |
| 키 입력칸이 그대로 보임 | `OPENAI_API_KEY` 미설정 또는 저장 후 재배포 안 함 |
| 401 접속 암호 오류 | `APP_PASSCODE` 와 입력값 불일치 |
| 500 서버에 키가 없음 | 환경변수를 Production에 체크 안 함 |
| 화면은 뜨는데 로그인 벽 | Settings → Deployment Protection → Disabled |
| 마이크 버튼 무반응 | Vercel 미리보기 iframe에서 열었음 → 새 탭에서 주소 직접 열기 |
| 예전 녹음이 안 보임 | 저장은 브라우저 localStorage. 도메인이 다르면 따로 관리됨 (정상) |
| 수정했는데 옛 화면 | 강제 새로고침 (Ctrl/Cmd+Shift+R) |

## 로컬에서 그냥 쓰기

`index.html` 을 더블클릭해 브라우저로 열어도 전부 동작합니다(각자 키 입력 방식). Chrome은 `file://` 을 보안 컨텍스트로 취급하므로 마이크도 됩니다.
