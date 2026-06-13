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
│   │   ├── public/         # 로고/아이콘 + 후원 QR (tome.jpeg) + ads.txt
│   │   └── src/
│   │       ├── app/        # App Router (page.tsx = 라우트). / vote request about admin
│   │       │               #   mypage privacy auth/* restaurants/[id] blocked + robots/sitemap/ads.txt
│   │       ├── components/ # Header / Footer / NavTabs / Map / VoteButton / VoteLabel
│   │       │               #   BookmarkButton / VisitorCounter / Pagination / RankingList
│   │       │               #   RestaurantList / RestaurantGrid / ViewToggle / DonationSection / SocialLogos
│   │       │               #   HomeIntro(홈 콘텐츠) / VisitorChart / AdSenseLoader(콘텐츠 페이지 한정 로드)
│   │       │               #   AdSlot·AdFitUnit·CoupangBanner (광고 scaffolding) · admin/* · request/* · ui/*
│   │       └── lib/        # api / supabase / me / role / auth / geocode / kakao-share / site / visitor / kst
│   └── api/                # FastAPI (REST + SSE)
│       ├── routers/        # restaurants / channels / votes / bookmarks / requests / visits / admin / auth / users
│       ├── services/       # supabase_client / kakao_geo / youtube_api / openai_extract / ingest_channel / youtube_sync
│       ├── models/         # schemas.py (Pydantic 요청/응답 모델)
│       ├── deps.py         # 인증 의존성 (require_user / require_admin / require_superadmin)
│       ├── utils.py        # 공용 유틸 (norm_channel — 채널명 공백제거 비교)
│       ├── settings.py     # 시크릿 로더 (환경변수 우선 → config/secrets.json)
│       └── main.py
├── database/
│   ├── schema.sql          # 전체 스키마 (한 번에 실행 — 최신 상태)
│   ├── migrations/         # 0001 ~ 누적 마이그레이션 (운영 DB 증분 적용)
│   └── ERD.md              # 테이블 관계 다이어그램 (mermaid)
├── data/                   # 콘솔용 일회성/배치 스크립트 (모두 공식 API만 사용)
│   ├── ingest_channels.py        # YouTube 채널 자동 수집 (CLI 진입점)
│   ├── sync_youtube.py           # YouTube 저장 데이터 갱신/삭제 동기화 (CLI 진입점, 25일 cron)
│   └── utils/                    # get_config / get_logger
├── config/
│   ├── secrets.example.json
│   └── secrets.json        # .gitignore (로컬 전용)
└── README.md
```

---

## 🚀 페이지 구성

| 경로 | 설명 |
|---|---|
| `/` | **검색 (홈)**. 채널 타입/채널명/시도/시군구/동/카테고리/이름 필터 + 지도·목록·격자 보기 + 카카오톡 공유. 지도 우하단 **현재 위치** 버튼으로 내 위치 기준 주변 맛집 탐색 |
| `/vote` | 투표 규칙 안내 · 인기 급상승 영상 · 맛집/채널/영상 랭킹 · **기간별 투표 조회·비교** |
| `/request` | 요청 게시판 — 채널 추가요청 / 관리자 요청 / 버그 / 기타 / 공지사항 |
| `/mypage` | **내 페이지** (로그인 필요) — 좌측 내 투표 기록(맛집·채널·영상, 페이지네이션) / 우측 북마크 목록. **회원 탈퇴** 버튼. superadmin 은 최상단에 **일별 방문자 추이 + 유입 출처(referer) 그래프** 노출 |
| `/about` | 사이트 소개 + 후원 (토스 QR 모달) — 검색·요청 탭으로 바로 가는 inline 링크 포함 |
| `/terms` | 이용약관 (콘텐츠 출처·면책·업소 정정 창구·금지행위·준거법) |
| `/privacy` | 개인정보처리방침 (최소수집·국외이전/수탁자·보유기간·보호책임자·광고 쿠키 동의·유입 출처 고지) |
| `/admin` | **admin / superadmin** 전용. 채널 자동 수집, **YouTube 동기화**(갱신/삭제), 회원·채널 관리, 좌표 보정, **맛집/영상 통합 관리**, **수정/삭제 요청 승인** (superadmin) |
| `/auth/login` | 이메일+비밀번호 / 구글 로그인·회원가입 · 비밀번호 재설정 메일 |
| `/auth/callback` | OAuth 콜백 (PKCE code 교환) |
| `/auth/reset-password` | 비밀번호 재설정 (메일 링크에서 도달) |
| `/blocked` | 차단 계정 안내 |
| `/restaurants/[id]` | 맛집 상세 — YouTube 공식 임베드, 우리 DB 정보(주소·전화·cuisine·메모), 영상·채널·식당 좋아요, 네이버/카카오 지도 **링크아웃** (URL 없어도 가게이름 검색 fallback). ※ 네이버 플레이스 스크래핑은 법적 리스크로 제거 |

---

## 🔍 검색 동작 (`/`)

- 채널명 / 시도 / 시군구 / 동읍면 — `<datalist>` 자동완성. 타이핑 중에는 옵션 부분일치 dropdown 만 보이고,
  **옵션과 정확 일치하거나 비어있을 때만** 백엔드 fetch 가 트리거 → 타자 중 지도 핀이 흔들리지 않음.
- 백엔드는 sido/sigungu/dong/channel_name 에 대해 `ilike '%v%'` 부분일치 지원.
- 모든 필터 상태가 URL 쿼리스트링에 기록 (`ct`/`cn`/`sido`/`sigungu`/`dong`/`cuisine`/`q`) → 카카오 공유 한 장으로 그대로 복원.
- `listRestaurants` 의 limit cap 제거됨 — `limit=0` 으로 호출하면 fetch_all 페이지 누적으로 모든 맛집 반환 (좌표 일괄 보정 같은 관리 작업용).

## 🗳 투표 규칙

- 한 아이디는 **하루(KST 자정 기준) 에 맛집·채널·영상 각 1회씩** 좋아요/싫어요 투표 가능.
- 같은 날 안에서: 같은 버튼 재클릭 = 오늘 분 취소 · 반대 버튼 = 오늘 분 전환.
- 어제 이전 표는 그대로 누적 — 매일 한 표씩 쌓이는 구조.
- DB 무결성: `votes` 테이블에 `vote_date date GENERATED` (KST) + `UNIQUE(user_id, target_type, target_id, vote_date)`.
- 랭킹 정렬: `likes desc` → `dislikes asc` → `id desc`.
- `/vote` 하단 **기간별 조회** — 대상(맛집·채널·영상) + 기간 지정 → 그 사이에 받은 좋아요/싫어요 합산. 누적 비교.

## 🔖 북마크 · 방문자 위젯

- **북마크**: 맛집·채널·영상 옆 북마크 아이콘으로 저장 (로그인 필요). `/mypage` 우측에서 한눈에 조회.
- **내 투표 기록**: `/mypage` 좌측 — 내가 투표한 맛집·채널·영상 목록 (페이지네이션, 현재 누적 좋아요 동반 표시).
- **방문자 위젯**: 모든 페이지 좌측 하단 고정 — 오늘 / 누적 unique 방문자 수. **superadmin 로그인 시에만** 노출. 방문자 식별은 브라우저 로컬 `visitor_id`(익명 난수 UUID) 기반 (KST 자정 기준 일별 집계, IP·계정 미연결).
- **방문자 분석 그래프**: `/mypage` 최상단(superadmin) — 일별 방문 추이 꺾은선 + **유입 출처(referer) 막대**. 유입 출처는 브라우저에서 직전 페이지의 **도메인만** 추출해 전송하고(전체 URL·경로·검색어 미수집), 서버가 `네이버`/`Google`/`YouTube`/`직접`/`사이트 내` 등 라벨로 정규화해 저장.

## 🛠 맛집/영상 통합 관리 (`/admin`)

- 한 화면에서 **신규 입력 + 수정 + 삭제** 모두 처리.
- 진입 시 채널이 자동 선택 (admin 은 charge_channel 첫 번째 / superadmin 은 전체 첫 번째).
- 가게이름 input 이 datalist — 옵션과 정확 일치 시 그 영상의 기존 값으로 폼 populate(수정 모드), 일치 안 하면 신규 모드.
- **admin**: 신규는 즉시 등록, 수정·삭제는 superadmin 에게 요청 (payload 에 변경 전/후 둘 다 스냅샷).
- **superadmin**: 모두 즉시 적용. 추가로 `/admin` 의 **맛집/영상 수정·삭제 요청** 패널에서 admin 요청을 한 화면에서 승인/반려.
- 수정 요청 비교 UI: 4열 표 (구분 · 필드 · 변경 전 · → · 변경 후), 변경 전 = 회색 + 취소선, 변경 후 = 굵은 초록.
- 백엔드 `list_managed_appearances` 가 fetch_all 페이지 누적 — 1000 한도 없음.

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

# 광고 (선택 — 운영 단계에서 추가)
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_KAKAO_ADFIT_UNIT=DAN-xxxxxxxxxx
```

> `config/secrets.json`, `.env.local` 모두 `.gitignore` 처리되어 있어 커밋되지 않음.

### 4) Supabase 스키마 적용

신규 환경: [Supabase Dashboard](https://supabase.com) → SQL Editor → `database/schema.sql` 통째로 붙여넣고 Run.
운영 중인 DB: `database/migrations/` 의 새 파일만 순서대로 실행.

### 5) 실행

```bash
# 터미널 A — FastAPI (프로젝트 루트에서)
source venv/bin/activate
uvicorn app.api.main:app --reload
# → http://localhost:8000/docs

# 터미널 B — Next.js
cd app/web
npm run dev
# → http://localhost:3000
```

---

## 🧭 실행 환경별 차이 (헷갈리는 부분 한 번에)

`app/api/main.py` 는 `from .routers import ...` 형태의 **relative import** 라 모듈을 어떻게 띄우느냐가 환경마다 달라집니다.

| 환경 | cwd / Root | Start Command | 이유 |
|---|---|---|---|
| **로컬** | 프로젝트 루트 | `uvicorn app.api.main:app --reload` | `app/__init__.py` + `app/api/__init__.py` 가 모두 있어 `app.api` 가 패키지 경로로 풀림 |
| **Render** | **루트 (Root Directory 비움)** | `gunicorn app.api.main:app -k uvicorn.workers.UvicornWorker -w 1 --max-requests 2000 --max-requests-jitter 200 --timeout 120 --bind 0.0.0.0:$PORT` | Root 를 `app/api` 로 잡으면 부모 패키지가 없어 `attempted relative import with no known parent package` 오류. gunicorn `--max-requests` 로 워커를 주기적으로 재시작해 누수 메모리 회수(512MB OOM 예방) |
| **Vercel** | `app/web` | `next build` (자동) | Vercel 은 Next.js 만 서빙. `app/web` 을 Root 로 잡아야 monorepo 의 다른 폴더가 build 컨텍스트에 안 들어옴 |

→ 즉 **Vercel 만 Root = `app/web`** 이고, **Render 는 Root 를 비워둠**. 헷갈리지 마세요.

---

# 🗄 Supabase 셋업 (운영) — 단계별

> 무료 플랜으로 시작 가능. 한국 사용자라면 Region 은 `Northeast Asia (Seoul)` 권장.

### 1단계. 프로젝트 생성

1. https://supabase.com 가입 → 우측 상단 **New project**
2. Organization 선택 → 프로젝트 이름, DB password 설정
3. Region: **Northeast Asia (Seoul)**
4. Pricing plan: **Free**
5. 생성 후 좌측 **Settings → API** 탭에서 다음 값 복사:
   - `Project URL` → `supabase.url`
   - `anon public` 키 → `supabase.anon_key`
   - `service_role` 키 → `supabase.service_role_key` (절대 노출 X — 백엔드에서만 사용)

### 2단계. 스키마 적용

1. 좌측 **SQL Editor** → New query
2. `database/schema.sql` 전체 복사 → 붙여넣기 → **Run**
3. 좌측 **Table Editor** 에서 `users`, `channels`, `restaurants`, `appearances`, `votes`, `requests`, `visits`, `bookmarks` 테이블 확인
4. 운영 중인 DB 는 새 파일만 차례로: `0006_daily_votes.sql` → `0007_request_restaurant_edit.sql` → `0008_reject_pending_restaurant_requests.sql` → `0009_visits.sql` → `0010_bookmarks.sql` → `0011_visits_referer.sql`(방문 유입 출처 컬럼)

### 3단계. Auth Provider 설정

좌측 **Authentication → Providers**:

| Provider | 활성화 방법 |
|---|---|
| **Email** | 토글 On. 이메일 가입 즉시 활성화 원하면 **Confirm email** 옵션 Off (운영은 On 권장) |
| **Google** | Google Cloud Console 에서 OAuth Client ID/Secret 생성 → Supabase 의 Google provider 에 입력 → Enable |

> **Kakao / Naver 는 UI 에서 제거** — 카카오는 이메일 권한 검수 대기, 네이버는 Supabase Free 플랜이 Custom OIDC 미지원이라 일단 빼두었습니다. 향후 추가 시:
> - 카카오: 카카오 개발자 콘솔에서 "카카오계정(이메일)" 동의 항목 검수 신청 → 승인 후 Supabase 에 Kakao provider Enable
> - 네이버: Supabase Pro 플랜 ($25/월) 의 Custom OIDC Provider 사용, 또는 자체 백엔드 OAuth 라우트 구현

### 4단계. URL 등록 (가장 자주 빠지는 단계)

좌측 **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (초기) → 운영 단계에서 Vercel 도메인 또는 자체 도메인으로 갱신
- **Redirect URLs** (Add URL) — 다음을 **모두** 추가:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/reset-password`
  - 운영 (Vercel 임시 도메인): `https://your-app.vercel.app/auth/callback`, `https://your-app.vercel.app/auth/reset-password`
  - 자체 도메인 사용 시: `https://www.your-domain.com/auth/callback`, `https://www.your-domain.com/auth/reset-password`

이게 안 되면 OAuth 로그인 후 콜백에서 "redirect_uri_mismatch", 비밀번호 재설정 메일 링크는 차단됨.

### Google Cloud Console (OAuth 클라이언트) 도 같이 등록

위 Redirect URLs 와 같은 URL 들을 Google Cloud Console 의 OAuth 클라이언트 **승인된 리디렉션 URI** + **승인된 자바스크립트 출처** 둘 다 추가. 빠지면 구글 로그인이 redirect_uri_mismatch 로 실패.

### 5단계. 첫 superadmin 만들기

1. 앱에서 회원가입
2. Supabase SQL Editor 에서:
   ```sql
   UPDATE public.users SET role = 'superadmin' WHERE email = 'you@example.com';
   ```
3. 다시 로그인하면 `/admin` 탭 접근 가능

### 6단계. 초기 데이터 채우기

`/admin` → **채널 자동 수집** 에 YouTube 채널 핸들 (`@sungsikyung` 등) 입력 → SSE 진행상황 → DB 저장.
또는 콘솔: `python -m data.ingest_channels @sungsikyung @bimirya --max-videos 100`

좌표 비어있는 맛집은 `/admin` → **🌏 기존 좌표 일괄 보정** (superadmin only).

---

# 🌐 Vercel 배포 — 단계별

> 모노레포라 root directory 설정이 필수. 못 하면 build 가 root 의 빈 package.json 을 보고 실패.

### 1단계. Vercel 가입 + GitHub 연결

1. https://vercel.com → GitHub 계정으로 가입
2. 첫 진입에서 GitHub 권한 허용 → 이 리포가 자동 노출

### 2단계. New Project

1. Vercel 대시보드 → **Add New → Project**
2. 이 리포 선택 → **Import**
3. 설정 화면에서:
   - **Project Name**: `baekahn-matjido` (자유)
   - **Framework Preset**: Next.js (자동 감지)
   - **Root Directory**: **`app/web`** 로 변경 ⚠️ (Edit 버튼 클릭)
   - **Build Command**: 자동 (`next build`)

### 3단계. Environment Variables

Vercel → Project Settings → **Environment Variables** (Production + Preview + Development):

| Name | Value | 비고 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://popular-restaurant-by-broadcast.onrender.com` | FastAPI 배포 호스트 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | `...` | 지도 SDK + 공유 |
| `NEXT_PUBLIC_TOSS_QR` | `/tome.jpeg` | 토스 QR 모달 이미지 |
| `NEXT_PUBLIC_KAKAOPAY_URL` | `https://qr.kakaopay.com/...` | |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | `ca-pub-XXXX...` | AdSense (광고 섹션 참고) |
| `NEXT_PUBLIC_KAKAO_ADFIT_UNIT` | `DAN-xxxxx...` | 카카오 애드핏 (광고 섹션 참고) |

→ **Deploy** 클릭. `https://baekahn-matjido.vercel.app` 임시 도메인.

### 4단계. FastAPI 배포 (호스팅 0원 옵션)

#### 옵션 A — Render Free Tier (가장 단순, 추천)

> 15분 idle 시 sleep → 첫 요청에 ~30초 cold start. 트래픽 적은 초기엔 충분.

1. https://render.com → GitHub 가입
2. **New +** → **Web Service** → 리포 연결
3. 설정 — ⚠️ **Root Directory 는 반드시 비워둘 것** (프로젝트 루트):
   - **Root Directory**: **비움** (또는 `.`)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r app/api/requirements.txt`
   - **Start Command**: `gunicorn app.api.main:app -k uvicorn.workers.UvicornWorker -w 1 --max-requests 2000 --max-requests-jitter 200 --timeout 120 --bind 0.0.0.0:$PORT`
     - `--max-requests 2000`: 워커가 2000요청마다 자동 재시작 → 슬금슬금 새는 메모리 회수(512MB OOM 예방). `-w 1` 은 Free(512MB)에 맞춘 단일 워커.
   - **Instance Type**: **Free**

   > Vercel 의 `app/web` 처럼 `app/api` 를 Root 로 잡으면 안 됩니다. `main.py` 가 `from .routers import ...` (relative import) 패턴이라 패키지 부모(`app.api`) 가 있어야 import 됩니다.
   > Root 가 비어 있어야 `app/__init__.py` + `app/api/__init__.py` 가 모두 인식돼 `app.api.main` 모듈 경로가 작동.

4. **Environment** 탭에서 시크릿 등록:
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   KAKAO_REST_API_KEY=...
   OPENAI_API_KEY=sk-...
   YOUTUBE_API_KEY=AIza...
   NAVER_CLIENT_ID=...
   NAVER_CLIENT_SECRET=...
   ADMIN_EMAIL=you@example.com
   ```
5. Deploy → URL 확인 (예: `https://popular-restaurant-by-broadcast.onrender.com`)
6. Vercel 의 `NEXT_PUBLIC_API_BASE_URL` 갱신 → Redeploy
7. 헬스체크: `curl https://popular-restaurant-by-broadcast.onrender.com/healthz`

#### 옵션 B — Cloudflare Tunnel + 자체 PC (sleep 없음, 전기료만)

1. https://dash.cloudflare.com → Zero Trust → Networks → Tunnels → Create
2. 터널 이름 부여 → connector 설치 명령 → 자체 PC 에서 실행
3. Tunnel routes: hostname `api.white_eyes_matmap.com` → Service `http://localhost:8000`
4. 자체 PC 에서 `uvicorn app.api.main:app --host 0.0.0.0 --port 8000` 항상 실행 (systemd / launchd / pm2)
5. Vercel `NEXT_PUBLIC_API_BASE_URL` = `https://api.white_eyes_matmap.com`

> Cloudflare Tunnel 은 완전 무료. PC 가 꺼지면 API 불가 — 24h 가능 환경에서 추천.

### 5단계. 외부 콘솔에 운영 URL 등록

배포 직후 Vercel 이 알려준 임시 도메인(`https://your-app.vercel.app`) 또는 자체 도메인 도입 후 그 도메인을 다음 콘솔들에 모두 등록:

| 콘솔 | 등록 위치 | 등록 값 |
|---|---|---|
| **Supabase** | Authentication → URL Configuration | Site URL = 운영 도메인, Redirect URLs 에 `/auth/callback` + `/auth/reset-password` |
| **Google Cloud Console** | OAuth 클라이언트 → 승인된 자바스크립트 출처 / 리디렉션 URI | 운영 도메인 + Supabase callback URL (`https://xxx.supabase.co/auth/v1/callback`) |
| **Kakao Developers** (지도 SDK / 공유) | 내 애플리케이션 → 플랫폼 → **Web** → 사이트 도메인 | 운영 도메인 (로그인은 안 쓰지만 지도/공유에 필요) |

> 카카오 로그인 / 네이버 로그인은 UI 에서 빠진 상태 — 카카오 로그인 OAuth Redirect URI 등록은 추후 활성화 시점에 추가.

---

# 🌍 도메인 운영 — 옵션

> **기본 운영**은 자체 도메인 없이 Vercel 의 임시 도메인(`https://your-app.vercel.app`) 그대로 사용 가능.
> 단 **광고(AdSense 등) 운영 의지가 있으면 자체 도메인이 사실상 필수** — 아래 "광고 붙이기" 섹션 참고.
> 한글 도메인(`맛지도.com`) 같은 IDN 은 추가 비용이라 우선 보류 권장. 영문 도메인 하나만 사면 광고 검수에 충분.

## 비용 구조

| 항목 | 비용 | 비고 |
|---|---|---|
| Vercel (웹) | 0원 | Free Plan, 100GB 월 트래픽 |
| Supabase (DB + Auth) | 0원 | Free Plan, 500MB DB |
| Render (API) | 0원 | Free Tier, 15분 idle sleep |
| Vercel 임시 도메인 (`*.vercel.app`) | 0원 | 자동 발급, SSL 자동, 광고 운영엔 부적합 |
| **자체 영문 도메인 (예: `white_eyes_matmap.com`)** | **약 15,000원/년** | 광고 운영 시 권장 |
| 한글 IDN 도메인 (예: `맛지도.com`) | 약 15,000원/년 | **선택** — 영문 도메인으로도 광고 운영 충분 |

→ **광고 안 붙임**: 도메인 비용 0원. Vercel 임시 도메인만으로 운영.
→ **광고 붙임**: 영문 도메인 하나(약 15,000원/년).

## A. 자체 도메인 없이 Vercel 임시 도메인만 사용 (가장 간단)

특별한 추가 작업 없음. Vercel 에 배포하면 자동으로 `https://your-app.vercel.app` 발급되고 SSL 자동.

후속 작업:
1. **Supabase**: Authentication → URL Configuration → Site URL = `https://your-app.vercel.app`, Redirect URLs 에 `/auth/callback`, `/auth/reset-password` 추가
2. **Google Cloud (OAuth)**: 클라이언트 → 승인된 자바스크립트 출처 + 리디렉션 URI 에 `https://your-app.vercel.app` + 콜백 URL 추가
3. **Kakao Developers** (지도 SDK 도메인): 내 애플리케이션 → 플랫폼 → Web → `https://your-app.vercel.app`
4. **Vercel 환경변수**: 그대로 사용

## B. 자체 도메인 운영 (광고용 권장)

### 1단계. 도메인 등록

**Porkbun** 또는 **가비아** — 둘 다 `.com` 약 15,000원/년, WHOIS 보호 무료/포함.

1. https://porkbun.com (영문) 또는 https://www.gabia.com (한국)
2. 원하는 도메인 검색 → 결제
3. Auto-renew **ON** (만료 방지)

### 2단계. Vercel 에 도메인 연결

1. Vercel 대시보드 → 프로젝트 → **Settings → Domains**
2. **Add Domain** → `your-domain.com` → Add
3. Vercel 이 표시하는 DNS 레코드 메모 (A `76.76.21.21` + CNAME `cname.vercel-dns.com`)
4. (선택) **`www.your-domain.com`** 도 같이 Add → apex 와 www 둘 다 운영 가능

### 3단계. DNS 레코드 설정

등록자(Porkbun/가비아)의 DNS 관리 페이지:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` | 자동 |
| CNAME | `www` | `cname.vercel-dns.com` | 자동 |

> Vercel "Configure DNS" 가 보여주는 값 그대로 따르기.

### 4단계. SSL — Vercel 자동 (Let's Encrypt). 1-5분 내 자동 활성.

### 5단계. 외부 콘솔 모두 갱신

| 콘솔 | 등록 위치 | 값 |
|---|---|---|
| **Supabase** | Authentication → URL Configuration | Site URL = `https://your-domain.com`, Redirect URLs 에 `/auth/callback` + `/auth/reset-password` |
| **Google Cloud** | OAuth 클라이언트 → 승인된 자바스크립트 출처 / 리디렉션 URI | 같은 도메인 |
| **Kakao Developers** | 플랫폼 → Web → 사이트 도메인 | 같은 도메인 (지도 SDK + 카카오 공유용) |

### (선택) 한글 도메인 추가

광고 운영에 필수는 아님. 브랜딩 의지가 있을 때만:

1. 가비아에서 `맛지도.com` 검색 → Punycode `xn--hq1bm9i1sp.com` 으로 등록
2. Vercel → Add Domain → Punycode 형태로 입력
3. 같은 절차로 DNS / SSL / 외부 콘솔에 추가
4. (권장) 한글 도메인 → 영문 도메인 301 redirect — SEO canonical 단일화

## 헬스체크 (배포 후)

| 항목 | 확인 |
|---|---|
| 웹 | `https://your-app.vercel.app/about` (또는 자체 도메인) 정상 렌더, SSL 자물쇠 |
| API | `https://popular-restaurant-by-broadcast.onrender.com/healthz` → `{"ok": true}` |
| 지도 | `/` 진입 후 카카오 지도 로드. 회색이면 Kakao 콘솔에 도메인 등록 누락 |
| 로그인 | `/auth/login` → 구글 로그인 콜백 성공, 헤더에 본인 닉네임 표시 |
| 비밀번호 재설정 | 이메일 가입 계정 → "비밀번호를 잊으셨나요?" → 메일 수신 → 링크 클릭 → `/auth/reset-password` 정상 |
| 투표 | 좋아요 클릭, 같은 버튼 재클릭 시 취소 (KST 자정 갱신) |

---

# 📢 광고 붙이기 (수익화)

> ⚠️ **자체 도메인이 사실상 필수**. `https://your-app.vercel.app` 같은 서브도메인은 AdSense 정책상 거의 거절됨 (blogspot/wordpress.com 과 같은 카테고리). 카카오 애드핏 / 쿠팡 파트너스도 자체 도메인 권장.
>
> 광고 운영 의지가 있다면 위 [B. 자체 도메인 운영](#b-자체-도메인-운영-광고용-권장) 의 영문 도메인 하나(연 15,000원)부터.

호스팅이 0원이라도 도메인비·전기료 정도는 광고로 충당 가능. 한국 사용자 대상 사이트라면 **AdSense + 카카오 애드핏** 동시 운영이 가장 무난.

## 1. Google AdSense (메인)

가장 보편적. 한국 거주자도 신청·수익화 가능. 단 **승인 절차** 가 까다로움 (콘텐츠 충분 + **본인 소유 도메인** + 1~4주 검수). Vercel 임시 도메인은 거절 사유 됨.

### 1-1. AdSense 가입 + 사이트 등록

1. https://adsense.google.com → Google 계정으로 가입
2. **사이트 추가** → `white_eyes_matmap.com` 입력
3. AdSense 가 제공하는 **인증 스니펫** 복사 (예시):
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
           crossorigin="anonymous"></script>
   ```
4. 이 스니펫을 사이트 `<head>` 에 삽입 (다음 단계 참고)
5. AdSense → "검토 요청" — 1~4주 내 승인 메일 / 거절 시 사유 안내

> 한글 도메인을 추가로 운영 중이라면 같은 AdSense 계정에서 **사이트 추가** 로 별도 등록 (각각 승인 받아야 광고 노출).

### 1-2. Next.js 에 AdSense 스크립트 삽입

`NEXT_PUBLIC_ADSENSE_CLIENT` 환경변수에 `ca-pub-XXXXXXXXXXXXXXXX` 등록.

**`app/web/src/app/layout.tsx`** 에 `<head>` 부분 (또는 `<Script>` 컴포넌트로) 추가:

```tsx
import Script from "next/script";

const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {AD_CLIENT && (
          <Script
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

> `next/script` 의 `afterInteractive` 전략은 페이지 인터랙티브 직후 로드 → CLS(레이아웃 시프트) 최소화.

### 1-3. 광고 슬롯 컴포넌트 (`<AdSlot />`)

AdSense 콘솔에서 **광고 → 광고 단위 만들기** → 디스플레이 광고 → slot id 발급.

`app/web/src/components/AdSlot.tsx` 신규 작성:

```tsx
"use client";

import { useEffect } from "react";

const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

declare global {
  interface Window { adsbygoogle: unknown[] }
}

export default function AdSlot({ slot, format = "auto" }: { slot: string; format?: string }) {
  useEffect(() => {
    if (!AD_CLIENT) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch { /* AdSense 로드 전이거나 차단됨 — 조용히 무시 */ }
  }, []);

  if (!AD_CLIENT) return null;
  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={AD_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
```

사용 예 — 검색 결과 그리드 사이, 맛집 상세 페이지 하단 등:

```tsx
<AdSlot slot="1234567890" />
```

### 1-4. ads.txt 설치

AdSense 가 요구하는 신뢰 파일. 운영 중인 모든 도메인에서 `/ads.txt` 로 서빙되어야 함.

**`app/web/public/ads.txt`** 생성:

```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

> Vercel 의 public/ 은 자동으로 정적 서빙 → `https://www.white_eyes_matmap.com/ads.txt` 접근 가능.
> AdSense → 사이트 → ads.txt 상태 확인.

### 1-5. 자동 광고 (대안)

광고 단위 일일이 안 만들고 AdSense 가 알아서 배치하길 원하면:

1. AdSense 콘솔 → **광고 → 사이트별** → 자동 광고 **사용**
2. layout.tsx 의 Script 만으로 작동 (수동 `<AdSlot />` 불필요)
3. 배치 미세 조정은 AdSense 콘솔에서

장점: 손쉬움. 단점: 광고가 어디 뜰지 예측 불가, 가독성 해칠 수 있음.

권장: **수동 슬롯** + 자동 광고 OFF → 사용자 경험 보호.

## 2. 카카오 애드핏 (보조)

한국 사용자 대상 모바일 친화 광고. AdSense 와 **동시 운영 가능**. 승인 비교적 빠름.

### 2-1. 가입

1. https://adfit.kakao.com → 카카오 계정 로그인
2. **인벤토리 추가** → 매체(웹사이트) 정보 입력
3. 광고 단위 생성 → **DAN-xxxxxxxxxx** 형식의 `unit-id` 발급

### 2-2. 코드 삽입

`app/web/src/components/AdFitUnit.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

const AD_UNIT = process.env.NEXT_PUBLIC_KAKAO_ADFIT_UNIT ?? "";

export default function AdFitUnit({ width = 320, height = 100 }: { width?: number; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!AD_UNIT || !wrapRef.current) return;
    const ins = document.createElement("ins");
    ins.className = "kakao_ad_area";
    ins.style.display = "none";
    ins.setAttribute("data-ad-unit", AD_UNIT);
    ins.setAttribute("data-ad-width", String(width));
    ins.setAttribute("data-ad-height", String(height));
    wrapRef.current.appendChild(ins);

    const s = document.createElement("script");
    s.async = true;
    s.src = "//t1.daumcdn.net/kas/static/ba.min.js";
    wrapRef.current.appendChild(s);
    return () => { wrapRef.current && (wrapRef.current.innerHTML = ""); };
  }, [width, height]);
  if (!AD_UNIT) return null;
  return <div ref={wrapRef} />;
}
```

사용:
```tsx
<AdFitUnit width={320} height={100} />  // 모바일 배너
<AdFitUnit width={728} height={90}  />  // 데스크탑 리더보드
```

## 3. 쿠팡 파트너스 (보조 — 맛집/식기 콘텐츠와 매칭)

식당 후기 콘텐츠에 식기/식재료/양념 등을 추천 링크로 제공. **추천 클릭 → 24시간 내 결제** 시 수익.

### 3-1. 가입

1. https://partners.coupang.com → 가입 (사업자 미등록 개인 OK)
2. 승인 후 — **다이내믹 배너**, **검색 위젯**, **상품 링크** 등 생성

### 3-2. 코드 삽입

쿠팡이 제공하는 JS 스니펫을 `<AdSlot>` 처럼 컴포넌트로 감싸 페이지에 삽입:

```tsx
"use client";
import { useEffect, useRef } from "react";

export default function CoupangBanner({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const s = document.createElement("script");
    s.src = `https://ads-partners.coupang.com/g.js`;
    s.async = true;
    s.onload = () => {
      // 쿠팡이 제공하는 dynamic 초기화 코드 호출
      // (실제 코드는 쿠팡 파트너스 콘솔에서 복사)
    };
    ref.current.appendChild(s);
  }, [id]);
  return <div ref={ref} data-coupang-id={id} />;
}
```

> 쿠팡 정책: 광고 라벨("쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 제공받습니다") 명시 필수.

## 4. 광고 삽입 위치 권장

| 페이지 | 위치 | 형태 |
|---|---|---|
| `/` (검색) | 결과 리스트/그리드 10개 마다 1칸 | 인-피드, responsive |
| `/` (지도뷰) | 헤더 아래 sticky | 리더보드 728×90 / 모바일 320×100 |
| `/restaurants/[id]` | 가게 정보 ↔ 영상 목록 사이 | 디스플레이 box |
| `/vote` | 인기 급상승 영상 ↔ 랭킹 사이 | 디스플레이 box |
| `/request` | 목록 아래 푸터 | 작은 배너 |

### 광고 노출 가이드

- `/admin` `/auth/login` `/auth/callback` `/blocked` 같은 **기능 페이지엔 광고 금지** (AdSense 정책 위반 가능)
- 클릭 유도 ("Click here!" 등) 금지
- 광고임을 명확히 라벨링 (광고 / Advertisement)
- 개인정보처리방침에 광고 쿠키 사용 명시 — 한국 PIPA / 유럽 GDPR 대응

### AdSense 승인·콘텐츠 품질 대응

> 거절 사유 "게시자 콘텐츠가 없는 화면에 광고 / 가치 낮은 콘텐츠"에 대한 조치.

- **광고 로더를 콘텐츠 페이지에서만 로드** — `AdSenseLoader` (`usePathname`) 가 `/admin` `/auth/*` `/mypage` `/blocked` 에서는 `adsbygoogle.js` 를 렌더하지 않는다. (콘텐츠 없는 화면의 광고 금지)
- **유틸리티 화면 색인 제외** — `robots.ts` 에 위 경로 `disallow`, 각 폴더 `layout.tsx` 에 `robots: { index:false }`. thin 페이지가 색인돼 '저가치'로 평가되는 것 방지.
- **콘텐츠 보강**:
  - 홈(`/`) 하단 `HomeIntro` (슬림) — 한 줄 소개 + 지역/카테고리 빠른 필터 칩(내부 링크). '지도 한 장' 컨셉 유지 위해 STEP·FAQ 는 제외.
  - 맛집 상세 — `RestaurantSummary` 가 채널·카테고리·위치로 한 줄 소개를 생성해 각 페이지에 원문 텍스트를 더함. YouTube 는 공식 임베드 + 원본 링크.
- 재검토 요청 전 체크: 충분한 맛집 데이터(상세 페이지 다수)·고유 콘텐츠·정상 동작 페이지. 준비 중/빈 페이지 없도록.

## 5. 정책·법적 사항 (법적 컴플라이언스)

> 변호사 자문이 아닌 운영 원칙 정리. 본 프로젝트는 법적 리스크에 보수적으로 대응한다.

### 적용된 조치

| 영역 | 조치 | 위치 |
|---|---|---|
| **저작권/스크래핑** | 비공식 API·HTML 스크래핑 전면 제거. 외부 데이터는 **공식 API만**(YouTube Data API / Kakao Local / OpenAI). 네이버 플레이스는 **링크아웃**만. 영상은 **공식 임베드 플레이어**로만 재생, 원본 링크·채널 출처 표기 | `services/*`, `restaurants/[id]` |
| **YouTube API 약관** | 저장 데이터(제목·썸네일) **주기 갱신 + 삭제 영상 동기 삭제**. 25일 주기 cron + admin 수동 실행 | `youtube_sync.py`, `youtube-sync.yml` |
| **개인정보(PIPA)** | 최소수집(이메일·닉네임), **판매·공개 안 함**, 국외이전·수탁자(Supabase/Vercel/Google) 고지, 항목별 보유기간, 개인정보 보호책임자, **회원 탈퇴**(즉시 파기) | `/privacy`, `DELETE /auth/me` |
| **방문 통계** | 익명 난수 `visitor_id`(IP·계정 미연결). 유입 출처는 **도메인만** 수집(전체 URL 미수집) → 개인정보 아님 | `visitor.ts`, `visits.py` |
| **이용약관/UGC** | `/terms` — 콘텐츠 출처·면책, **업소 관계자 정정/삭제 창구**, 금지행위, 운영자 게시물 삭제권, 준거법 | `/terms` |
| **투표** | 부정 평가 노출 최소화 — **좋아요만**(싫어요 UI 제거), 랭킹은 likes 집계. 약관에 "투표=주관적 의견" 면책 | `VoteButton.tsx` |
| **가입 동의** | 이메일 가입 시 **약관·방침 동의 체크박스**(필수), 소셜 로그인은 동의 간주 고지 | `auth/login` |
| **광고(AdSense)** | 방침에 쿠키·웹비콘·IP·식별자·DoubleClick·제3자 공급업체·**Google 파트너 데이터 링크**·맞춤형 광고 동의/거부(aboutads)·COPPA 명시. `ads.txt` 게재 | `/privacy`, `ads.txt` |

### 콘솔/대시보드에서 별도 처리 필요 (코드 아님)

- **EU 사용자 동의(CMP)** — AdSense → **개인정보 보호 및 메시지**에서 GDPR/CCPA 메시지 게시. 그러면 `adsbygoogle.js` 가 EEA/영국 방문자에게 동의 배너 자동 표시(별도 배너 구현 불필요). 무료 [Funding Choices](https://fundingchoices.google.com).
- **운영자/사업자 정보** — 광고·제휴 수익 발생 시 정통망법 고지·사업자등록/통신판매업 신고 검토.
- **상표** — "백안맛지도" KIPRIS 조회 권장.
- **쿠팡 파트너스** — 수수료 고지 문구 필수(이미 적용, `about` `AdNotice`).

## 6. 그 외 (트래픽 늘었을 때)

| 서비스 | 진입 요건 | 특징 |
|---|---|---|
| **Mediavine** | 50k MAU | RPM 가장 높음 |
| **Raptive (구 AdThrive)** | 100k MAU | 프리미엄 |
| **Ezoic** | 10k MAU | 진입 쉬움, 머신러닝 최적화 |
| **EthicalAds** | 개발자 사이트 | 트래커리스, 낮은 RPM |

초기엔 AdSense + AdFit + 쿠팡 으로 충분. MAU 10k 넘으면 Ezoic 검토.

---

## 🔧 운영 후 주기적 관리

- **Vercel** 은 main 브랜치 push 시 자동 재배포. PR 은 Preview 환경 자동 생성.
- **Render** 는 main push 시 자동 재배포. Start Command 는 `gunicorn ... --max-requests 2000`(워커 주기 재활용 → 512MB OOM 예방, [메모리 관리](#-메모리-관리-render-512mb) 참조).
- **YouTube 동기화**: `.github/workflows/youtube-sync.yml` 이 **25일 주기**(매월 1·26일)로 저장 영상 갱신/삭제 자동 실행 — YouTube API 약관 준수. `/admin` 에서 수동 실행도 가능.
- **채널 수집**: 대량 수집은 `.github/workflows/data-ingest.yml`(Actions → Run workflow, 핸들·영상수 입력)로 — 512MB 웹 인스턴스 부하 회피.
- DB 스키마 변경: 새 마이그레이션 파일을 `database/migrations/000N_*.sql` 로 추가 → Supabase SQL Editor 에서 실행 → 코드 push.
- 도메인 만료 알림: 등록자 계정의 auto-renew **반드시 ON**.
- AdSense 정책 변동 주기적 확인 (특히 GDPR/IDFA 등 개인정보 관련).

---

## 🧠 메모리 관리 (Render 512MB)

Render Free(512MB)에서 며칠 주기로 `Ran out of memory` 가 났던 원인과 대응:

- **OpenAI 클라이언트 누수(주원인, 수정 완료)** — `openai_extract` 가 영상마다 새 `OpenAI()` 를 만들어 httpx 커넥션 풀이 누적됐다. `@lru_cache` 로 **1개 재사용**하도록 변경(supabase 클라이언트와 동일 패턴). 응답 데이터는 캐시하지 않으므로(매 호출 새 API 요청) staleness 문제 없음.
- **워커 주기 재활용** — `gunicorn ... --max-requests 2000` 으로 2000요청마다 워커 자동 재시작 → 어느 라이브러리에서 새든 메모리 회수. SSE 스트림 호환 위해 `--timeout 120`.
- **무거운 작업은 웹 밖으로** — 대량 채널 수집·YouTube 동기화는 **GitHub Actions**(`data-ingest.yml` / `youtube-sync.yml`)에서 실행해 512MB 웹 인스턴스 피크를 낮춘다. admin UI 수집은 소량만.
- (확장 시) `fetch_all` 이 전체 테이블을 메모리 적재하는 랭킹/`managed` 엔드포인트는 데이터가 커지면 DB측 페이지네이션으로 전환 검토.

### DB 연결 안정성

- **Supabase 클라이언트는 HTTP/1.1 강제** (`supabase_client._force_http1`). postgrest 기본 HTTP/2 는 캐시된 클라이언트 1개를 threadpool 여러 스레드가 공유할 때 스트림 상태머신이 깨져 `LocalProtocolError`/httpcore `KeyError` 로 500 이 난다. HTTP/1.1 은 요청마다 별도 커넥션을 써 안전.
- **IN 절 청크 100** — `id=in.(...)` URL 이 길어지면 Supabase 앞단(Cloudflare/Kong) URI 한도 초과로 400(HTML) → postgrest JSON 파싱 실패. id 가 커질수록 위험하므로 청크를 작게(100) 유지.
- **Python 3.12 고정** (`.python-version`) — Render 가 3.14 등 최신으로 올리면 httpcore 등 호환 이슈 소지. 3.12 로 고정.
- 전송 transient 오류(`ProtocolError`/`ConnectError`/타임아웃)는 `exec_with_retry` 가 클라이언트 재생성 후 자동 재시도.

---

## 🧰 확장성 · 기술 부채 백로그

전체 점검에서 도출한 리팩터/개선 항목. **안전한 소규모 정리는 적용**했고, 위험·대규모는 아래에 백로그로 남긴다.

**적용 완료**
- 미사용 코드 제거: `models/schemas.py` 의 미사용 응답 모델(Channel/Restaurant/Appearance/RankingRow), `VisitorChart` 의 미사용 `useRef`·`max` prop, `RankingList` 미사용 re-export.
- 중복 KST 날짜 함수(`vote/page`·`RankingList`)를 `lib/kst.ts` 로 통합.

**백로그 (검토 후 적용)**
| 항목 | 내용 | 위험도 |
|---|---|---|
| `in_chunks` 공통화 | `id=in.(...)` 청크 로직이 channels/restaurants/requests 에 중복 → `supabase_client` 공용 헬퍼로 추출 | 🟢 낮음 |
| `useVoteState`/`useBookmarks` 훅 | 투표·북마크 상태 동기화 로직이 page/Map/RankingList/vote/mypage 반복 → 커스텀 훅 | 🟡 중간(다수 파일) |
| `VoteState` 타입 중앙화 | 동일 타입이 3곳 정의 → `lib` 로 export | 🟢 낮음 |
| `enrich_scores` 헬퍼 | 점수 뷰 enrich 패턴(restaurants/channels/votes) 추상화 | 🟡 중간 |
| `visits.get_stats()` distinct | 전체 `visitor_id` 를 메모리 set 으로 unique 계산 → 데이터 폭증 시 OOM. `count(distinct)` RPC/뷰로 이전 | 🔴 스케일 시 필수 |
| `dislikes` 완전 제거 | UI 제거 완료, 백엔드 컬럼/타입 잔존(레거시). DB 컬럼 DROP + 타입 정리(마이그레이션 필요) | 🟡 중간 |
| `Map.tsx` 분할 | 660+줄 — 핀/모달/뷰포트 로직 분리 | 🟡 중간 |

## 💡 향후 기능 아이디어

- **상세 페이지 SSR/메타데이터** — `/restaurants/[id]` 를 서버 컴포넌트화해 가게별 `title`/`description`/OG 동적 생성 → SEO·AdSense 콘텐츠 강화, 공유 카드 개선.
- **맛집 설명(notes) 입력 UI** — admin 에서 가게별 원문 소개를 채우면 상세 페이지 고유 콘텐츠 증가(이미 렌더링됨).
- **검색 결과 URL 공유 OG** — 필터 조합별 동적 OG 이미지/설명.
- **'근처 맛집' / 연관 추천** — 같은 지역·카테고리·채널의 다른 맛집 링크(내부 링크·체류시간↑).
- **방문자 분석 확장** — 유입 출처를 검색/SNS/직접 등 그룹으로 묶고 기간 비교.
- **요청 게시판 알림** — 내 요청에 답변 달리면 메일 알림(Supabase Edge Function).
- **이미지/지도 정적 캡처** — 상세에 정적 지도 미리보기(콘텐츠·접근성).
- **다국어(i18n)** — 외국인 관광객 대상 영어 지원.

> 위 기능은 제안 단계이며, 진행 시 항목별로 범위·DB 영향을 다시 협의한다.

---

## 📜 콘솔 스크립트

| 스크립트 | 설명 |
|---|---|
| `python -m data.ingest_channels @sungsikyung @bimirya --max-videos 100` | YouTube 채널 자동 수집 |
| `python -m data.sync_youtube` | YouTube 저장 데이터 갱신 + 삭제 영상 정리 (약관 준수 동기화) |

---

## 🧪 검증

```bash
# TypeScript 타입체크 + 프로덕션 빌드 (CI 와 동일 경로 — .github/workflows/web-deploy.yml)
cd app/web && npm run typecheck && npm run build

# Python 문법 sanity
python3 -c "import ast, glob; [ast.parse(open(f).read()) for f in glob.glob('app/api/**/*.py', recursive=True)]"
```

UI 변경은 `npm run dev` 로 띄워서 직접 클릭/탭 전환 확인.

---

## 🤝 기여

- 이슈 환영. 데이터 정확도 보강 PR (가게 이름·주소·channel handle 등) 환영합니다.
- 권한이 필요한 작업(채널 추가/관리)은 `/request` 의 **관리자 요청** 으로 superadmin 에게 권한 부여를 받을 수 있습니다.
