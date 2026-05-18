# 책 분석기 (Book Analyzer) — Gemini 무료 버전

비문학 책의 챕터를 정해진 4파트 구조로 분석해주는 웹앱.  
사용자는 **책 제목 · 챕터 · 핵심 개념**만 입력하면, 시스템 프롬프트에 박혀 있는 분석 방법론대로 결과를 받을 수 있어.

**Google Gemini API 의 무료 한도** 안에서 동작하므로 카드 등록 / 결제 없이 0원으로 운영 가능.

## 어떻게 동작해?

- **분석 방법론(시스템 프롬프트)** 은 `lib/prompt.ts` 에 박혀 있어. 사용자는 못 바꿔 — 너가 정한 4파트 구조와 욕구 목록을 그대로 따라.
- **사용자 입력** 은 책 제목, 챕터, 핵심 개념 3개 (+ 선택적 추가 맥락).
- **결과** 는 Google Gemini 2.5 Flash 가 4파트(① 배경지식 → ② 욕구와 행동 → ③ 챕터 연결 → ④ 세포 비유)로 작성해서 실시간 스트리밍으로 보여줘.

---

## 1. 한 번에 배포하기 (가장 쉬운 길)

### 준비물

1. **Google AI Studio API 키** — [aistudio.google.com](https://aistudio.google.com) 에서 무료 발급. Google 계정만 있으면 됨. **신용카드 등록 불필요.**
2. **GitHub 계정** — 이 저장소를 fork 하거나 그대로 사용.
3. **Vercel 계정** — [vercel.com](https://vercel.com) 무료. GitHub로 로그인.

### API 키 발급

1. [aistudio.google.com](https://aistudio.google.com) → Google 로그인
2. 왼쪽 메뉴 **Get API key** → **Create API key in new project**
3. `AIza...` 로 시작하는 키 복사 → 메모장에 임시 보관

### Vercel 배포 절차

1. 이 저장소를 GitHub에서 fork (혹은 직접 clone 후 자신의 repo로 push).
2. [vercel.com/new](https://vercel.com/new) 에서 "Import Git Repository" 클릭.
3. 위에서 fork 한 저장소 선택.
4. **Environment Variables** 섹션에서 추가:
   - `GOOGLE_AI_API_KEY` = 발급받은 키 (`AIza...`)
   - (선택) `ACCESS_CODE` = 공유받은 사람만 쓰게 하고 싶다면 코드 입력. 비워두면 누구나 접근 가능.
5. **Deploy** 클릭. 1~2분 뒤 `your-app-name.vercel.app` 같은 공개 URL 생성.

그 URL을 공유하면 끝. 누구나 그 링크에서 너가 설정한 방법론대로 책 분석을 받을 수 있어.

---

## 2. 로컬에서 돌려보기

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열고 GOOGLE_AI_API_KEY 채우기

# 3. 개발 서버
npm run dev
# → http://localhost:3000
```

---

## 3. 비용 안내 — 0원

Gemini 2.5 Flash 무료 한도 (Google AI Studio, 2026년 기준):

- **하루 ~1,500 요청** (한 사용자가 1500번 분석 가능)
- **분당 15 요청** (학생 여럿이 동시에 써도 거의 안 막힘)
- **분당 100만 토큰**

학생 30명이 매일 50번씩 써도 한도에 안 닿아. **실질적으로 무료.**

품질을 더 올리고 싶다면 `app/api/analyze/route.ts` 에서 모델을 바꿔:

```ts
model: "gemini-2.5-pro",  // 더 정교한 분석, 단 하루 ~25회 무료 한도
```

Pro 는 한도가 빡빡해서 클래스 단위 사용에는 비추천. **Flash 가 정답.**

---

## 4. 분석 방법론 바꾸기

`lib/prompt.ts` 의 `SYSTEM_PROMPT` 를 수정하면 돼.

- **4파트 구조** 를 다른 책 종류에 맞게 바꿀 수 있어 (예: 자기계발서, 인문학, 과학 등).
- **15가지 욕구 목록** 도 다른 분석 체계로 교체 가능 (예: 9가지 가치, 5가지 동기 등).
- **금지 사항** 으로 원치 않는 답변 방식을 차단.

수정한 뒤 commit → push 하면 Vercel이 자동으로 재배포해.

---

## 5. 파일 구조

```
.
├── app/
│   ├── api/analyze/route.ts   ← Gemini API 스트리밍 라우트
│   ├── globals.css            ← 전역 스타일
│   ├── layout.tsx             ← HTML 레이아웃
│   └── page.tsx               ← 메인 UI (폼 + 결과 표시)
├── lib/
│   └── prompt.ts              ← 분석 방법론 (시스템 프롬프트)
├── share.html                 ← (보너스) 백엔드 없이 쓰는 프롬프트 생성기
├── .env.example               ← 환경 변수 템플릿
├── package.json
└── README.md (이 파일)
```

---

## FAQ

**Q. ChatGPT의 GPTs 처럼 누구나 그 링크에서 바로 쓸 수 있어?**  
A. 응. Vercel에 배포한 URL을 공유하면 끝. 별도 로그인 없이 폼에 입력만 하면 돼.

**Q. Claude 가 더 좋다는데 왜 Gemini?**  
A. Claude API 는 한국 계정 가입 시 결제 등록을 요구해서 0원으로 운영이 어려워. Gemini 는 카드 없이 무료로 쓸 수 있어서 학교/스터디용에 적합. 책 분석 품질도 충분히 좋아.

**Q. 그러면 누가 마구 써서 한도 초과될 수 있는 거 아냐?**  
A. 가능성 낮음 — Gemini Flash 무료 한도가 하루 1,500회라서 학교 1~2반이 매일 써도 안 닿아. 그래도 걱정되면:
1. `ACCESS_CODE` 환경 변수 설정 → 코드 아는 사람만 사용.
2. 한도 초과 시 자동으로 "Gemini 무료 한도에 도달했어" 메시지 표시 → 다음 날 자동 복구.

**Q. 사용자 입력을 저장해?**  
A. 안 해. 요청은 그때그때 Gemini API로 흘러갈 뿐, 데이터베이스나 로그에 남기지 않아. Vercel 함수 로그에만 잠시 남고 자동 삭제돼.

**Q. share.html 은 뭐야?**  
A. 백업 옵션. 백엔드도 API 키도 필요 없이, 사용자가 입력한 정보로 완성된 프롬프트를 만들어주고, 사용자가 직접 claude.ai 또는 gemini.google.com 무료 채팅에 붙여넣기로 분석받게 하는 단일 HTML. 배포가 귀찮으면 이것만 공유해도 돼.
