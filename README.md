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
│   │   ├── public/         # 로고/아이콘 + 후원 QR (tome.jpeg 등)
│   │   └── src/
│   │       ├── app/        # App Router (page.tsx = 라우트)
│   │       ├── components/ # Map, NavTabs, VoteButton, VotePeriodCompare, DonationSection, admin/* ...
│   │       └── lib/        # api / supabase / me / role / geocode / kakao-share
│   └── api/                # FastAPI (REST + SSE)
│       ├── routers/        # restaurants / channels / requests / votes / admin / auth / users
│       ├── services/       # supabase / kakao_geo / naver_match / youtube_api / openai_extract / ingest_channel
│       ├── deps.py         # 인증 의존성 (require_user / require_admin / require_superadmin)
│       ├── settings.py     # 시크릿 로더 (환경변수 우선 → config/secrets.json)
│       └── main.py
├── database/
│   ├── schema.sql          # 전체 스키마 (한 번에 실행 — 최신 상태)
│   └── migrations/         # 0001 ~ 누적 마이그레이션 (운영 DB 증분 적용)
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
| `/about` | 사이트 소개 + 후원 (토스 QR 모달) — 검색·요청 탭으로 바로 가는 inline 링크 포함 |
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

## 🗳 투표 규칙

- 한 아이디는 **하루(KST 자정 기준) 에 맛집·채널·영상 각 1회씩** 좋아요/싫어요 투표 가능.
- 같은 날 안에서: 같은 버튼 재클릭 = 오늘 분 취소(DELETE) · 반대 버튼 = 오늘 분 전환(UPDATE).
- 어제 이전 표는 그대로 누적 — 매일 한 표씩 쌓이는 구조. 집계 뷰가 누적 합산.
- DB 무결성: `votes` 테이블에 `vote_date date GENERATED` (KST) + `UNIQUE(user_id, target_type, target_id, vote_date)`.
- 랭킹 정렬: `likes desc` → `dislikes asc` → `id desc` (모든 랭킹 동일).
- `/vote` 하단 **기간별 조회** — 대상(맛집·채널·영상) + 기간 지정 → 그 사이에 받은 좋아요/싫어요 합산. 누적해서 비교.

## 🛠 맛집/영상 통합 관리 (`/admin`)

- 한 화면에서 **신규 입력 + 수정 + 삭제** 모두 처리.
- admin 로그인 시 `charge_channel` 1개면 자동 선택, 여러 개면 첫 번째 자동 선택.
- 가게 이름 input 이 datalist — 옵션과 정확 일치 시 그 영상의 기존 값으로 폼 populate(수정 모드), 일치 안 하면 신규 모드.
- **admin**: 신규는 즉시 등록, 수정·삭제는 superadmin 에게 요청 (payload 에 변경 전/후 둘 다 스냅샷).
- **superadmin**: 모두 즉시 적용. 추가로 `/admin` 의 **맛집/영상 수정·삭제 요청** 패널에서 admin 요청을 한 화면에서 승인/반려.
- 수정 요청 비교 UI: 4열 표 (구분 · 필드 · 변경 전 · → · 변경 후), 변경 전 = 회색 + 취소선, 변경 후 = 굵은 초록.

## 🔐 권한 모델

| Role | 권한 |
|---|---|
| `user` | 검색·투표·요청 작성, 자기 요청 글 삭제 |
| `admin` | + 자기 `charge_channel` 채널 맛집 신규 입력. 그 채널 영상의 수정·삭제는 superadmin 에게 요청 |
| `superadmin` | + 회원/채널 관리, 좌표 보정, 채널 자동 수집, 공지사항 작성, 요청 다중 삭제, 채널 권한 부여, **맛집/영상 즉시 수정·삭제, 수정·삭제 요청 승인/반려** |

회원가입 직후 기본 role 은 `user`. `/admin` → 회원 관리에서 superadmin 이 승격하거나, 관리자 요청글에서 **✅ 채널 권한 부여** 클릭 시 자동으로 `admin` + charge_channel 부여.

---

# 🛠 로컬 개발 환경 셋업

### 사전 준비

- **Node.js** 20 이상 (`node -v`)
- **Python** 3.12 이상 (`python3.12 -v`)
- **Git**

### 1) 클론

```bash
git clone https://github.com/<your-org>/popular_restaurant_by_broadcast.git
cd popular_restaurant_by_broadcast
```

### 2) 의존성 설치

```bash
# 백엔드
python3.12 -m venv venv
source venv/bin/activate
pip install -r app/api/requirements.txt
pip install -r data/requirements.txt   # 콘솔 스크립트용 (선택)

# 프론트엔드
cd app/web && npm install && cd -
```

### 3) 시크릿 작성

```bash
cp config/secrets.example.json config/secrets.json
# 에디터로 열어 supabase / kakao / naver / openai / youtube 값 채우기
```

`config/secrets.json` 예시:

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

웹 환경변수 (`app/web/.env.local`):

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_KAKAO_JS_KEY=...

# 후원 (선택 — 비어있으면 후원 섹션 자동 숨김)
NEXT_PUBLIC_TOSS_QR=/tome.jpeg          # public/ 정적 이미지 경로 또는 외부 URL
NEXT_PUBLIC_KAKAOPAY_URL=https://qr.kakaopay.com/...
```

> `config/secrets.json`, `.env.local` 모두 `.gitignore` 처리되어 있어 커밋되지 않음.
> 변경 후 dev 서버 재시작 필수 (Next.js 의 `NEXT_PUBLIC_*` 은 빌드 시 inline).

### 4) Supabase 스키마 적용

신규 환경: [Supabase Dashboard](https://supabase.com) → SQL Editor → `database/schema.sql` 통째로 붙여넣고 Run.
운영 중인 DB: `database/migrations/` 의 새 파일만 순서대로 실행.

### 5) 실행

```bash
# 터미널 A — FastAPI
source venv/bin/activate
uvicorn app.api.main:app --reload
# → http://localhost:8000/docs (Swagger)

# 터미널 B — Next.js
cd app/web
npm run dev
# → http://localhost:3000
```

---

# 🗄 Supabase 셋업 (운영) — 단계별

> 무료 플랜으로 시작 가능. 한국 사용자라면 Region 은 `Northeast Asia (Seoul)` 권장.

### 1단계. 프로젝트 생성

1. https://supabase.com 가입 → 우측 상단 **New project**
2. Organization 선택 (또는 Create new) → 프로젝트 이름, DB password 설정
3. Region: **Northeast Asia (Seoul)**
4. Pricing plan: Free
5. 생성 후 좌측 **Settings → API** 탭에서 다음 값 복사:
   - `Project URL` → `supabase.url`
   - `anon public` 키 → `supabase.anon_key`
   - `service_role` 키 → `supabase.service_role_key` (절대 노출 X — 백엔드에서만 사용)

### 2단계. 스키마 적용

1. 좌측 **SQL Editor** → New query
2. 이 리포의 `database/schema.sql` 전체 복사 → 붙여넣기 → **Run**
3. 정상 종료되면 좌측 **Table Editor** 에서 `users`, `channels`, `restaurants`, `appearances`, `votes`, `requests` 테이블이 보임
4. 마이그레이션 파일들 ([database/migrations/](database/migrations/))은 `schema.sql` 에 모두 포함되어 있으니 신규 환경에선 따로 실행할 필요 없음. **이미 운영 중인 DB** 만 새 파일을 차례로 실행:
   - `0001_init.sql` ~ `0005_request_notice.sql` — 초기 + 요청 게시판
   - `0006_daily_votes.sql` — 하루 1회 투표 (KST `vote_date` generated column + unique index)
   - `0007_request_restaurant_edit.sql` — 맛집/영상 수정·삭제 요청 type + 컬럼
   - `0008_reject_pending_restaurant_requests.sql` — (일회성) 옛 payload 스키마 요청 일괄 반려

### 3단계. 인증 (Auth) Provider 설정

좌측 **Authentication → Providers**:

| Provider | 활성화 방법 |
|---|---|
| **Email** | 토글 On. 이메일 가입 즉시 활성화 원하면 **Confirm email** 옵션 Off (이메일 검증 메일 안 보냄) |
| **Google** | Google Cloud Console 에서 OAuth Client ID/Secret 생성 → Supabase 의 Google provider 에 입력 |
| **Kakao** | 카카오 Developers 에서 OAuth Client ID/Secret → Supabase 에 입력 |
| **Naver** | Supabase 가 기본 지원 안 함 → **Authentication → Providers → Custom** 으로 추가. authorize URL, token URL, userinfo URL 입력 ([Supabase Discussion #naver](https://github.com/supabase/auth/discussions) 참고) |

### 4단계. URL 등록 (가장 자주 빠지는 단계)

좌측 **Authentication → URL Configuration**:

- **Site URL**: 로컬은 `http://localhost:3000`, 운영은 Vercel 도메인 (`https://your-app.vercel.app`).
- **Redirect URLs** (Add URL):
  - `http://localhost:3000/auth/callback`
  - `https://your-app.vercel.app/auth/callback`
  - (커스텀 도메인 추가 시 동일)

이게 안 되면 OAuth 로그인 후 콜백에서 "redirect_uri_mismatch" 오류.

### 5단계. RLS (Row Level Security)

`schema.sql` 이 이미 RLS 정책을 같이 만들어줌 (`public.users` 만 RLS 활성). 다른 테이블은 FastAPI 가 service_role 키로 RLS 우회.

### 6단계. 첫 superadmin 만들기

1. 앱에서 회원가입 (이메일 또는 OAuth)
2. Supabase SQL Editor 에서:
   ```sql
   UPDATE public.users SET role = 'superadmin' WHERE email = 'you@example.com';
   ```
3. 다시 로그인하면 `/admin` 탭 접근 가능

### 7단계. (선택) 초기 데이터 채우기

`/admin` 의 **채널 자동 수집** 에 YouTube 채널 핸들 입력 (`@sungsikyung` 등) → SSE 로 진행 상황 표시되며 영상 메타 → OpenAI 추출 → Kakao/Naver 매칭 → DB 저장.

또는 콘솔에서 일괄 실행:

```bash
python -m data.ingest_channels --handles "@sungsikyung,@bimirya" --max 100
```

좌표 비어있는 맛집은 `/admin` → **🌏 기존 좌표 일괄 보정** (superadmin only) 으로 한 번에 정리.

---

# 🌐 Vercel 배포 — 단계별

> 모노레포라 root directory 설정이 필수. 못 하면 build 가 root 의 빈 package.json 을 보고 실패.

### 1단계. Vercel 가입 + GitHub 연결

1. https://vercel.com → GitHub 계정으로 가입 (권장)
2. 첫 진입에서 GitHub 권한 허용 → 이 리포가 자동 노출

### 2단계. New Project

1. Vercel 대시보드 → **Add New → Project**
2. 이 리포 선택 → **Import**
3. 설정 화면에서:
   - **Project Name**: `baekahn-matjido` (자유)
   - **Framework Preset**: Next.js (자동 감지)
   - **Root Directory**: **`app/web`** 로 변경 ⚠️ (Edit 버튼 클릭해서 수정)
   - **Build Command**: 자동 (`next build`)
   - **Output Directory**: 자동 (`.next`)

### 3단계. Environment Variables 등록

같은 화면 또는 배포 후 **Settings → Environment Variables** 에서 다음 등록 (모두 Production + Preview + Development 체크):

| Name | Value | 비고 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://your-fastapi-host` | FastAPI 배포 호스트. 4단계 참고 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase anon public key |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | `...` | 카카오 JavaScript 키 (지도 SDK + 공유) |
| `NEXT_PUBLIC_TOSS_QR` | `/tome.jpeg` 또는 외부 URL | 토스 QR 이미지. 없으면 토스 후원 버튼 자동 숨김 |
| `NEXT_PUBLIC_KAKAOPAY_URL` | `https://qr.kakaopay.com/...` | 카카오페이 송금링크. 없으면 자동 숨김 |

→ **Deploy** 클릭.

### 4단계. FastAPI 배포

Vercel 은 Next.js 만 서빙. FastAPI 는 별도 호스트가 필요.

**옵션 A — Fly.io (추천, 무료 한도 충분)**

1. https://fly.io 가입 + `brew install flyctl` (Mac)
2. `flyctl auth login`
3. 리포 루트에서:
   ```bash
   flyctl launch --no-deploy --copy-config --dockerfile app/api/Dockerfile
   # 앱 이름, region(nrt = 도쿄) 등 선택
   ```
4. 시크릿 등록:
   ```bash
   flyctl secrets set \
     SUPABASE_URL=https://xxx.supabase.co \
     SUPABASE_ANON_KEY=eyJ... \
     SUPABASE_SERVICE_ROLE_KEY=eyJ... \
     KAKAO_REST_API_KEY=... \
     OPENAI_API_KEY=sk-... \
     YOUTUBE_API_KEY=AIza... \
     NAVER_CLIENT_ID=... \
     NAVER_CLIENT_SECRET=...
   ```
5. `flyctl deploy` → 배포 URL 확인 (예: `https://your-app.fly.dev`)
6. 헬스체크: `curl https://your-app.fly.dev/healthz` → `{"ok": true}`
7. Vercel 의 `NEXT_PUBLIC_API_BASE_URL` 을 이 URL 로 갱신 → Vercel 에서 **Redeploy**.

**옵션 B — Railway**

1. https://railway.app → New Project → Deploy from GitHub repo
2. Root Directory: `app/api`
3. Service Settings → Variables 에 위 시크릿 등록
4. Settings → Networking → **Generate Domain** → URL 받기
5. 동일하게 Vercel 의 API_BASE_URL 갱신

**옵션 C — 자체 서버 / 라즈베리파이 + ngrok (임시)**

- 로컬에서 `uvicorn app.api.main:app --host 0.0.0.0 --port 8000`
- `ngrok http 8000` → 공개 URL 받아 Vercel 에 등록
- 영구는 아님 — 데모용

### 5단계. 외부 콘솔에 운영 도메인 등록

이 단계를 빠뜨리면 지도가 회색으로 뜨고, 카카오 공유 / OAuth 로그인이 실패함.

| 콘솔 | 등록 위치 | 등록 값 |
|---|---|---|
| **Kakao Developers** | 내 애플리케이션 → 플랫폼 → **Web** → 사이트 도메인 | `https://your-app.vercel.app` (지도 SDK + 카카오 공유) |
| **Kakao Developers** | 카카오 로그인 → Redirect URI | `https://xxx.supabase.co/auth/v1/callback` |
| **Naver Developers** | 애플리케이션 → API 설정 → 웹 서비스 URL | `https://your-app.vercel.app` |
| **Google Cloud Console** | OAuth 클라이언트 → 승인된 자바스크립트 출처 / 리디렉션 URI | Vercel 도메인 + Supabase callback URL |
| **Supabase** | Authentication → URL Configuration | Site URL = Vercel 도메인, Redirect URLs 에 `https://your-app.vercel.app/auth/callback` 추가 |

### 6단계. 배포 후 헬스체크

| 항목 | 확인 |
|---|---|
| 웹 | `https://your-app.vercel.app/about` 정상 렌더 |
| API | `https://your-api-host/healthz` → `{"ok": true}` |
| 지도 | `/` 진입 후 카카오 지도 로드. 회색이면 Kakao 콘솔 도메인 등록 누락 |
| 로그인 | `/auth/login` → OAuth 로그인 콜백 성공 |
| 검색 | 시도/시군구 datalist 자동완성 + 옵션 선택 시 핀 갱신 |
| 투표 | 로그인 후 좋아요 클릭. 같은 버튼 재클릭 시 취소 |

### 7단계. 운영 후 첫 superadmin 지정

배포 후 본인 회원가입 → Supabase SQL Editor 에서:

```sql
UPDATE public.users SET role = 'superadmin' WHERE email = 'you@example.com';
```

이제 운영 도메인의 `/admin` 접근 가능. 채널 자동 수집부터 시작하면 데이터가 빠르게 쌓입니다.

### 운영 후 주기적으로

- **Vercel** 은 main 브랜치 push 시 자동 재배포. PR 은 Preview 환경 자동 생성.
- **Fly.io / Railway** 는 GitHub Actions 연동 또는 `flyctl deploy` 수동.
- DB 스키마 변경 시: 새 마이그레이션 파일을 `database/migrations/000N_*.sql` 로 추가 → Supabase SQL Editor 에서 실행 → 코드 push.

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
