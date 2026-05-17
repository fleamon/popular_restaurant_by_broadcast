# 백안맛지도 (Baekahn Matjido)

대한민국 **방송·유튜브 맛집 지도 웹앱** — 화면에 들어오는 영역의 식당을 한 장의 지도로 훑어보고, 좋아요/싫어요로 랭킹을 만들어갑니다.

- 브랜드 컬러: `#2B7FFF` · 본문 텍스트 강조: `#2C42A3`
- 스택: **Next.js 16**(App Router · Turbopack) + **FastAPI** + **Supabase** + **OpenAI** + **YouTube/Kakao/Naver API**
- 1인 개발자 친화 — 모노레포 · 함수형 지향 · 최소 설정

---

## 📁 저장소 구조

```
popular_restaurant_by_broadcast/
├── app/
│   ├── web/                # Next.js (Vercel 배포 대상)
│   │   ├── public/         # 로고/아이콘
│   │   └── src/
│   │       ├── app/        # App Router (page.tsx = 라우트)
│   │       ├── components/ # Map, NavTabs, VoteButton, VotePeriodCompare, admin/* ...
│   │       └── lib/        # api / supabase / me / role / geocode / kakao-share
│   └── api/                # FastAPI (REST + SSE)
│       ├── routers/        # restaurants / channels / requests / votes / admin / auth / users
│       ├── services/       # supabase / kakao_geo / naver_match / youtube_api / openai_extract / ingest_channel
│       ├── deps.py         # 인증 의존성 (require_user / require_admin / require_superadmin)
│       ├── settings.py     # 시크릿 로더 (환경변수 우선 → config/secrets.json)
│       └── main.py
├── database/
│   ├── schema.sql          # 전체 스키마 (한 번에 실행)
│   └── migrations/         # 0001 ~ 누적 마이그레이션
├── data/                   # 콘솔용 일회성/배치 스크립트
│   ├── ingest_channels.py
│   ├── seed_channel_thumbnails.py
│   └── seed_naver_places.py
├── config/
│   ├── secrets.example.json
│   └── secrets.json        # .gitignore (로컬 전용)
└── README.md
```

---

## 🚀 페이지 구성

| 경로 | 설명 |
|---|---|
| `/` | **검색 (홈)**. 채널 타입/채널명/시도/시군구/동/카테고리/이름 필터 + 지도·목록·격자 보기 + 카카오톡 공유 |
| `/vote` | 투표 규칙 안내 · 인기 급상승 영상 · 맛집/채널/영상 랭킹 · **기간별 투표 조회·비교** |
| `/request` | 요청 게시판 — 채널 추가요청 / 관리자 요청 / 버그 / 기타 / 공지사항 |
| `/about` | 사이트 소개 + 후원 |
| `/admin` | **admin / superadmin** 전용. 회원·채널 관리, 좌표 보정, 채널 자동 수집, **맛집/영상 통합 관리** (입력·수정·삭제), **수정/삭제 요청 승인** (superadmin) |
| `/auth/login` | 이메일+비밀번호 / 카카오 / 네이버 / 구글 로그인·회원가입 |
| `/auth/callback` | OAuth 콜백 |
| `/blocked` | 차단 계정 안내 |
| `/restaurants/[id]` | 맛집 상세 — YouTube 임베드, 네이버 plate 정보, 영상·채널·식당 투표 |

---

## 🔍 검색 동작 (`/`)

- 채널명 / 시도 / 시군구 / 동읍면 — `<datalist>` 자동완성. 타이핑 중에는 옵션 부분일치 dropdown 만 보이고,
  **옵션과 정확 일치하거나 비어있을 때만** 백엔드 fetch 가 트리거 → 타자 중 지도 핀이 흔들리지 않음.
- 백엔드는 sido/sigungu/dong/channel_name 에 대해 `ilike '%v%'` 부분일치 지원.
- 모든 필터 상태가 URL 쿼리스트링에 기록 (`ct`/`cn`/`sido`/`sigungu`/`dong`/`cuisine`/`q`) → 카카오 공유 한 장으로 그대로 복원.
- 결과 카운트는 `totalCount` (필터 전체) — viewport bounds 기반 fetch 의 `rows.length` 와 다른 값.

---

## 🗳 투표 규칙

- 한 아이디는 **하루(KST 자정 기준) 에 맛집·채널·영상 각 1회씩** 좋아요/싫어요 투표 가능.
- 같은 날 안에서: 같은 버튼 재클릭 = 오늘 분 취소(DELETE) · 반대 버튼 = 오늘 분 전환(UPDATE).
- 어제 이전 표는 그대로 누적 — 매일 한 표씩 쌓이는 구조. 집계 뷰가 누적 합산.
- DB 무결성: `votes` 테이블에 `vote_date date GENERATED` (KST) + `UNIQUE(user_id, target_type, target_id, vote_date)`.

### 랭킹 정렬

`likes desc` → `dislikes asc` (같은 좋아요면 싫어요 많은 쪽이 뒤로) → `id desc` 안정 키. 맛집·채널·영상·검색 페이지네이션 모두 동일.

### 기간별 조회 (`/vote` 하단)

대상(맛집·채널·영상) + 기간(YYYY-MM-DD) 지정 → `GET /votes/score` 가 KST 자정 경계 inclusive 로 좋아요/싫어요/순점수 합산. 여러 항목을 누적해 한 표에서 비교 가능.

---

## 🛠 맛집/영상 통합 관리 (`/admin`)

한 화면에서 **신규 입력 + 수정 + 삭제** 모두 처리. 채널을 먼저 선택하면 그 채널의 영상 일체가 datalist 옵션으로 노출되고, 가게 이름 입력으로 자동완성.

- **admin** 으로 로그인 시 `charge_channel` 1개면 그 채널이 자동 선택, 여러 개면 첫 번째 자동 선택.
- 가게 이름이 옵션과 정확 일치하면 **수정 모드** 진입 — 기존 값이 폼에 populate. (다른 필드를 사용자가 채운 상태에서는 자동 populate 안 함.)
- 옵션과 일치 안 하면 **신규 등록 모드**.
- 가게 이름 외 모든 필드: 주소, 카테고리, 전화, 네이버/카카오 지도 URL, 영상 URL/제목, 메모.

### admin 의 수정·삭제 요청

admin 이 신규 등록은 즉시 (`createRestaurant`), 수정·삭제는 superadmin 에게 요청.

- `POST /restaurants/appearances/{aid}/edit-request` — payload 에 **변경 전(before) / 변경 후(after) 둘 다 스냅샷** 저장. 요청 후 다른 admin 이 또 수정해도 요청자가 본 시점이 보존됨.
- `POST /restaurants/appearances/{aid}/delete-request` — 사유 옵션.
- 수정 요청 버튼은 값이 변경됐을 때(`dirty`) 만 enable. 삭제 요청 버튼은 항상 enable.

### superadmin 의 승인 (`/admin` 의 '맛집/영상 수정·삭제 요청')

대기 중 요청을 모두 리스트업. 각 행에:

- **수정 요청** — 4열 표 (구분 · 필드 · 변경 전 · → · 변경 후) 로 before/after 인라인 비교. 필드는 한국어 라벨, 변경 전 = 회색 + 취소선, 변경 후 = 굵은 초록.
- **삭제 요청** — 빨강 강조 박스에 사유.
- 행마다 **✅ 승인** / **🚫 반려** 버튼. 승인 시 `apply-restaurant-edit` / `apply-restaurant-delete` → restaurants/appearances 자동 update/delete + status='완료'. 반려는 status='반려'.

> 맛집/영상 수정·삭제 요청은 `/request` 탭에는 노출되지 않음 (`type=restaurant_edit` 또는 `restaurant_delete` 명시 시에만 반환). `/admin` 의 전용 UI 에서만 다룸.

---

## 🔐 권한 모델

| Role | 권한 |
|---|---|
| `user` | 검색·투표·요청 작성, 자기 요청 글 삭제 |
| `admin` | + 자기 `charge_channel` 채널 맛집 신규 입력. 그 채널 영상의 수정·삭제는 superadmin 에게 요청 |
| `superadmin` | + 회원/채널 관리, 좌표 보정, 채널 자동 수집, 공지사항 작성, 요청 다중 삭제, 채널 권한 부여, **맛집/영상 즉시 수정·삭제, 수정·삭제 요청 승인/반려** |

회원가입 직후 기본 role 은 `user`. `/admin` → 회원 관리에서 superadmin 이 승격하거나, 관리자 요청글에서 **✅ 채널 권한 부여** 클릭 시 자동으로 `admin` + charge_channel 부여.

---

## 🛠 로컬 개발 환경 셋업

### 사전 준비
- **Node.js** 20 이상 (`node -v`)
- **Python** 3.12 이상 (`python3.12 -v`)
- **Git**

### 1) 저장소 클론

```bash
git clone https://github.com/<your-org>/popular_restaurant_by_broadcast.git
cd popular_restaurant_by_broadcast
```

### 2) Python 가상환경 + FastAPI 의존성

```bash
python3.12 -m venv venv
source venv/bin/activate
pip install -r app/api/requirements.txt
pip install -r data/requirements.txt   # 콘솔 스크립트용 (선택)
```

### 3) 웹 의존성

```bash
cd app/web
npm install
cd -
```

### 4) 시크릿 작성 ([👉 자세히](#-시크릿secrets-관리))

```bash
cp config/secrets.example.json config/secrets.json
# 에디터로 열어 supabase / kakao / naver / openai / youtube 값 채우기
```

웹 환경변수:

```bash
cp app/web/.env.example app/web/.env.local 2>/dev/null || true
# .env.local 에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#               NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_KAKAO_JS_KEY 등 입력
```

### 5) Supabase 스키마 적용 ([👉 자세히](#-supabase-셋업))

`database/schema.sql` 을 Supabase SQL Editor 에 통째로 실행한 뒤, `database/migrations/` 의 최신 변경분을 순서대로 실행.

### 6) 실행

터미널 두 개 또는 백그라운드:

```bash
# (A) FastAPI
source venv/bin/activate
uvicorn app.api.main:app --reload
# → http://localhost:8000/docs (Swagger)

# (B) Next.js
cd app/web
npm run dev
# → http://localhost:3000
```

---

## 🔑 시크릿(secrets) 관리

### 백엔드 — `config/secrets.json`

`app/api/settings.py` 가 **환경변수 우선 → 파일 fallback** 으로 읽습니다. 로컬은 파일 채워두기, 운영은 환경변수.

`config/secrets.example.json` 을 복사해 채우세요:

```json
{
  "supabase":     { "url": "https://xxx.supabase.co", "anon_key": "eyJ...", "service_role_key": "eyJ..." },
  "kakao":        { "rest_api_key": "...", "javascript_key": "..." },
  "naver":        { "client_id": "...", "client_secret": "..." },
  "openai":       { "api_key": "sk-...", "model": "gpt-4o-mini" },
  "youtube":      { "api_key": "AIza..." },
  "google_oauth": { "client_id": "", "client_secret": "" },
  "admin":        { "email": "", "signup_id": "", "signup_password": "" }
}
```

각 키 발급처:

| 키 | 발급 |
|---|---|
| `supabase.*` | https://supabase.com → 프로젝트 → Settings → API |
| `kakao.rest_api_key` / `javascript_key` | https://developers.kakao.com → 내 애플리케이션 |
| `naver.client_id` / `client_secret` | https://developers.naver.com → 애플리케이션 등록 (검색 API) |
| `openai.api_key` | https://platform.openai.com/api-keys |
| `youtube.api_key` | https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보 → YouTube Data API v3 활성화 |
| `google_oauth.*` | Google Cloud Console — OAuth 클라이언트 ID |

`config/secrets.json` 은 `.gitignore` 처리되어 있어 커밋되지 않습니다.

### 프론트엔드 — `app/web/.env.local`

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_KAKAO_JS_KEY=...

# 후원 링크 (선택)
NEXT_PUBLIC_BMC_URL=https://www.buymeacoffee.com/your_handle
NEXT_PUBLIC_TOSS_URL=https://toss.me/your_handle
NEXT_PUBLIC_KAKAOPAY_URL=https://qr.kakaopay.com/...
NEXT_PUBLIC_GITHUB_URL=https://github.com/your-org/popular_restaurant_by_broadcast
```

값이 비어있으면 후원/GitHub 섹션은 자동으로 숨겨집니다.

---

## 🗄 Supabase 셋업

### 1) 프로젝트 생성
- https://supabase.com 가입 → New project
- Region: `Northeast Asia (Seoul)` 권장
- 프로젝트 URL / anon key / service_role key 를 위 시크릿에 입력

### 2) 스키마 적용

대시보드 좌측 **SQL Editor** 에서 다음 순서로 실행:

1. `database/schema.sql` — 전체 스키마 (테이블·뷰·트리거 일괄)
2. `database/migrations/` 의 최신분 적용:
   - `0001_init.sql` — 초기 스키마
   - `0002_username.sql`
   - `0003_full_reset.sql`
   - `0004_requests.sql` — 요청 게시판
   - `0005_request_notice.sql` — 공지 타입 + 길이 제약 완화
   - `0006_daily_votes.sql` — 하루 1회 투표 (KST `vote_date` generated column + unique index)
   - `0007_request_restaurant_edit.sql` — 맛집/영상 수정·삭제 요청 type + 컬럼 (restaurant_id, appearance_id, payload jsonb)
   - `0008_reject_pending_restaurant_requests.sql` — (일회성) 옛 payload 스키마 요청 일괄 반려

> `schema.sql` 은 매번 멱등하게 재생성하도록 작성되어 있고, 최신 마이그레이션 내용이 모두 포함된 상태입니다. 신규 환경은 `schema.sql` 한 번만 실행해도 OK.
> 운영 중인 DB 는 새 마이그레이션을 누락하지 말 것.

### 3) Auth 설정
- **Authentication → Providers**
  - Email: Enable + (선택) `Confirm email` 끄기
  - Google / Kakao / Naver 사용 시 각각 Client ID/Secret 등록 (Naver 는 Custom OAuth 로 추가)
- **URL Configuration**
  - Site URL: `http://localhost:3000` (운영 시 도메인)
  - Redirect URLs: `http://localhost:3000/auth/callback`, 운영 도메인 동일 경로

### 4) RLS (Row Level Security)
- `public.users` 만 RLS 활성화 (auth 와 연동). 그 외 테이블은 FastAPI service_role 키로 접근하므로 RLS 비활성/우회 정책 사용.
- **anon 키** 로 직접 호출하는 곳 (검색 / 채널 목록 / 투표 점수 등) 은 SELECT 만 허용하는 정책.

### 5) 첫 superadmin 만들기

회원가입 후, Supabase SQL Editor 에서:

```sql
UPDATE public.users SET role = 'superadmin' WHERE email = 'you@example.com';
```

### 6) 데이터 채우기
- `/admin` → **채널 자동 수집** 에 채널 핸들 입력 (예: `@sungsikyung`) 또는
- 콘솔: `python -m data.ingest_channels --handles @sungsikyung,@bimirya --max 50`
- 좌표 비어있으면 `/admin` → **🌏 기존 좌표 보정** (superadmin only)
- 네이버 place_id 보정: `python -m data.seed_naver_places`

---

## 🌐 Vercel 호스팅 (웹)

### 1) GitHub 연동
- Vercel → New Project → Import Git Repository → 이 리포 선택
- **Root Directory** 를 `app/web` 으로 지정 (중요 — 모노레포라 자동 감지 안 됨)
- Framework Preset: **Next.js** (자동)

### 2) 환경변수 등록
Vercel Project Settings → **Environment Variables** 에 다음을 등록 (Production + Preview):

```
NEXT_PUBLIC_API_BASE_URL       https://<fastapi-host>            # ngrok / fly.io / 자체 서버
NEXT_PUBLIC_SUPABASE_URL       https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  eyJ...
NEXT_PUBLIC_KAKAO_JS_KEY       ...
NEXT_PUBLIC_BMC_URL            (선택)
NEXT_PUBLIC_TOSS_URL           (선택)
NEXT_PUBLIC_KAKAOPAY_URL       (선택)
NEXT_PUBLIC_GITHUB_URL         (선택)
```

### 3) Kakao / Naver / Supabase 콘솔에 도메인 추가
- **Kakao Developers** → 내 애플리케이션 → 플랫폼 → Web → 사이트 도메인에 `https://your-app.vercel.app` 추가 (지도 SDK / 카카오 공유)
- **Naver Developers** → 애플리케이션 → Web 서비스 URL 에 vercel 도메인 추가
- **Supabase** → Authentication → URL Configuration 의 Site URL 과 Redirect URLs 갱신

### 4) FastAPI 배포 (필요 시)
- 가장 빠른 옵션: **Fly.io** 또는 **Railway** 에 `app/api/Dockerfile` 로 배포. 무료/소규모 가능.
- 또는 **Vercel Python Runtime** — 다만 SSE 스트리밍 제약 있어 추천 안 함.
- 또는 자체 서버 / 라즈베리파이 + ngrok 으로 임시 노출 가능.

FastAPI 운영 시 `app/api/settings.py` 는 환경변수에서 읽으므로, 호스팅 환경의 **환경변수** 에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KAKAO_REST_API_KEY`, `OPENAI_API_KEY`, `YOUTUBE_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 등을 등록하세요.

### 5) 배포 후 헬스체크
- 웹: `https://your-app.vercel.app/about` 정상 렌더
- API: `https://<fastapi-host>/healthz` → `{"ok": true}`
- 지도: Kakao 콘솔에 도메인 등록 안 되어 있으면 핀이 빈 회색으로 보임

---

## 📜 콘솔 스크립트

| 스크립트 | 설명 |
|---|---|
| `python -m data.ingest_channels --handles "@sungsikyung,@bimirya" --max 100` | YouTube 채널 자동 수집 — 영상 메타 + OpenAI 추출 + Kakao/Naver 매칭 → DB |
| `python -m data.seed_channel_thumbnails` | 채널 썸네일 일괄 보정 |
| `python -m data.seed_naver_places --sleep 0.3` | 기존 식당의 naver_place_id 일괄 매칭 (분점 변형 자동 시도) |

---

## 🧪 검증

PR 보내실 때 다음을 통과시켜 주세요:

```bash
# TypeScript 타입 + 미사용 변수 체크
cd app/web && npx tsc --noEmit --noUnusedLocals --noUnusedParameters

# Python 문법 sanity
python3 -c "import ast; [ast.parse(open(f).read()) for f in __import__('glob').glob('app/api/**/*.py', recursive=True)]"
```

UI 변경은 가능하면 `npm run dev` 로 띄워서 직접 클릭/탭 전환 확인.

---

## 🤝 기여

- 이슈 환영. 데이터 정확도 보강 PR (가게 이름·주소·channel handle 등) 환영합니다.
- 권한이 필요한 작업(채널 추가/관리)은 `/request` 의 **관리자 요청** 으로 superadmin 에게 권한 부여를 받을 수 있습니다.
