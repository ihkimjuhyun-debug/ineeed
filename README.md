# 강의 노트 — GitHub + Vercel 배포 가이드

정적 HTML 한 장짜리 앱입니다. 빌드 과정이 전혀 없습니다.

## 저장소 구조 (이대로 두세요)

```
your-repo/
├── index.html      ← 반드시 이 이름, 반드시 루트
├── vercel.json
├── .gitignore
└── README.md
```

`index.html` 이라는 이름이 아니거나 하위 폴더에 있으면 Vercel 루트 주소가 **404 NOT_FOUND** 가 됩니다.

## Vercel 설정

Import 화면에서:

| 항목 | 값 |
|---|---|
| Framework Preset | **Other** |
| Build Command | **비워두기** (또는 끄기) |
| Output Directory | **비워두기** |
| Install Command | **비워두기** |
| Root Directory | `./` |

`package.json` 이 저장소에 있으면 Vercel이 Node 프로젝트로 오해해 빌드를 시도하다 실패합니다. 이 앱에는 필요 없으니 **넣지 마세요**.

## 배포 후 반드시 확인할 것

1. **Vercel 대시보드의 미리보기 창(iframe)에서 쓰지 마세요.** 주소를 새 탭에 직접 열어야 합니다. iframe 안에서는 마이크와 화면 소리 공유가 브라우저 정책상 차단됩니다.
2. **Deployment Protection** 이 켜져 있으면 Vercel 로그인 벽이 뜹니다.
   Project → Settings → Deployment Protection → Vercel Authentication **Disabled**.
3. **보관함이 비어 있는 건 정상입니다.** 저장은 브라우저의 localStorage를 쓰고, 이건 도메인별로 분리됩니다. 로컬 파일에서 녹음한 기록은 새 도메인에서 보이지 않습니다. (전문 텍스트를 다운로드해 뒀다면 "텍스트" 탭에 붙여넣어 되살릴 수 있습니다.)
4. **API 키를 코드에 절대 넣지 마세요.** 공개 저장소에 올라가고, OpenAI가 자동 감지해 키를 폐기합니다. 이 앱은 키를 각자 브라우저에만 저장하므로 파일에 넣을 필요가 없습니다.
5. **화면 소리 공유(getDisplayMedia)는 iOS Safari에서 지원되지 않습니다.** 아이폰/아이패드에서는 마이크 모드만 됩니다.

## 흔한 증상 → 원인

| 증상 | 원인 / 해결 |
|---|---|
| 404: NOT_FOUND | 파일 이름이 `index.html` 이 아님 / 루트에 없음 |
| 빌드 실패 (`No Output Directory named "public"`) | Framework Preset이 Other가 아님. Build Command·Output Directory 비우기 |
| 화면은 나오는데 로그인 벽 | Deployment Protection 끄기 |
| 마이크 버튼을 눌러도 아무 반응 없음 | Vercel 미리보기 iframe에서 열었음 → 새 탭에서 주소 직접 열기 |
| 마이크 권한 거부됨 | 브라우저 주소창 자물쇠 → 마이크 → 허용 |
| 예전 녹음이 안 보임 | localStorage는 도메인별. 정상 동작 |
| 수정했는데 옛 화면이 나옴 | 강제 새로고침 (Ctrl/Cmd+Shift+R). `vercel.json`의 no-store 설정이 이걸 줄여줍니다 |

## 로컬에서 그냥 쓰기

`index.html` 을 더블클릭해 브라우저로 열어도 전부 동작합니다. Chrome은 `file://` 을 보안 컨텍스트로 취급하므로 마이크도 됩니다. 배포는 다른 기기(휴대폰 등)에서 쓰려는 경우에만 필요합니다.
